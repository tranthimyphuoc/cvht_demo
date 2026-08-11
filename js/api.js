/**
 * api.js — Frontend HTTP Helper cho CVHT Hub
 *
 * Tự động:
 *  - Đính kèm Authorization: Bearer <token>
 *  - Nếu nhận 401 → tự refresh token → retry request 1 lần
 *  - Lưu/đọc token từ sessionStorage
 *
 * Cách dùng:
 *
 *   // Đăng nhập
 *   const { user, accessToken } = await Api.login('cvht@rikkei.edu', '123456');
 *
 *   // Gọi API có auth
 *   const surveys = await Api.get('/surveys');
 *   const newSurvey = await Api.post('/surveys', { title: 'Khảo sát tuần 1' });
 *   await Api.put('/surveys/sv_abc', { status: 'CLOSED' });
 *   await Api.delete('/surveys/sv_abc');
 *
 *   // Đăng xuất
 *   await Api.logout();
 */

const Api = (() => {
  // ─── Storage keys ──────────────────────────────────────────────────────────
  const KEY_ACCESS  = 'cvht_access_token';
  const KEY_REFRESH = 'cvht_refresh_token';
  const KEY_USER    = 'cvht_api_user';

  // ─── Lấy base URL từ config hiện có ───────────────────────────────────────
  function _baseUrl() {
    return (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.sheetsWebAppUrl)
      ? APP_CONFIG.sheetsWebAppUrl
      : '';
  }

  // ─── Token storage ─────────────────────────────────────────────────────────
  function getAccessToken()  { return sessionStorage.getItem(KEY_ACCESS)  || ''; }
  function getRefreshToken() { return sessionStorage.getItem(KEY_REFRESH) || ''; }
  function getUser()         {
    try { return JSON.parse(sessionStorage.getItem(KEY_USER) || 'null'); }
    catch (_) { return null; }
  }

  function _saveTokens(accessToken, refreshToken, user) {
    if (accessToken)  sessionStorage.setItem(KEY_ACCESS,  accessToken);
    if (refreshToken) sessionStorage.setItem(KEY_REFRESH, refreshToken);
    if (user)         sessionStorage.setItem(KEY_USER, JSON.stringify(user));
  }

  function _clearTokens() {
    sessionStorage.removeItem(KEY_ACCESS);
    sessionStorage.removeItem(KEY_REFRESH);
    sessionStorage.removeItem(KEY_USER);
  }

  // ─── Core fetch ────────────────────────────────────────────────────────────
  /**
   * Thực hiện HTTP request đến Apps Script Web App.
   * Vì Apps Script chỉ hỗ trợ GET và POST, PUT/DELETE được gửi qua POST với body._method.
   * Headers được gửi qua query param ?headers=<JSON> (Apps Script giới hạn header access).
   *
   * @param {string} path      - e.g. '/auth/login'
   * @param {string} method    - GET | POST | PUT | DELETE
   * @param {object} [body]    - Request body
   * @param {boolean} [withAuth=true] - Có đính token không
   * @param {boolean} [isRetry=false] - Đây có phải là lần retry sau refresh không
   * @returns {Promise<object>} Response data
   */
  async function _fetch(path, method, body, withAuth = true, isRetry = false) {
    const baseUrl = _baseUrl();
    if (!baseUrl) throw new Error('sheetsWebAppUrl chưa được cấu hình trong APP_CONFIG');

    // Xây dựng header info (truyền qua query param vì GAS không đọc được custom HTTP headers)
    const authHeaders = {};
    if (withAuth) {
      const token = getAccessToken();
      if (token) authHeaders['Authorization'] = 'Bearer ' + token;
    }

    // Truyền Authorization token qua query param (không phải HTTP header)
    // → tránh CORS preflight do custom header gây ra
    const params = new URLSearchParams({ path });
    if (Object.keys(authHeaders).length > 0) {
      params.set('headers', JSON.stringify(authHeaders));
    }
    const url = `${baseUrl}?${params.toString()}`;

    let fetchMethod = 'POST';
    let fetchBody;

    if (method === 'GET') {
      fetchMethod = 'GET';
      fetchBody   = undefined;
    } else {
      // PUT/DELETE → POST + body._method
      const bodyToSend = Object.assign({}, body || {});
      if (method === 'PUT' || method === 'DELETE') bodyToSend._method = method;
      fetchBody = JSON.stringify(bodyToSend);
    }

    // ⚠️ QUAN TRỌNG — Apps Script & CORS:
    // 'Content-Type: application/json' kích hoạt CORS preflight (OPTIONS request)
    // Apps Script không xử lý OPTIONS → fetch bị lỗi network.
    // Fix: dùng 'text/plain' → "simple request" → không cần preflight → hoạt động đúng.
    const res = await fetch(url, {
      method:   fetchMethod,
      headers:  fetchMethod === 'POST' ? { 'Content-Type': 'text/plain;charset=UTF-8' } : {},
      body:     fetchBody,
      redirect: 'follow',
    });

    // Apps Script luôn trả HTTP 200; lỗi nghiệp vụ nằm trong JSON body
    let data;
    try {
      data = await res.json();
    } catch (_) {
      throw new Error(`Server trả về phản hồi không hợp lệ (HTTP ${res.status})`);
    }

    // ── Auto-refresh khi 401 ─────────────────────────────────────────────
    if (!data.success && data.status === 401 && !isRetry) {
      const refreshed = await _tryRefresh();
      if (refreshed) {
        // Retry request 1 lần với token mới
        return _fetch(path, method, body, withAuth, true);
      } else {
        // Refresh thất bại → bắt user đăng nhập lại
        _clearTokens();
        if (typeof App !== 'undefined' && App.go) {
          App.go('login');
        } else {
          location.href = 'index.html';
        }
        throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
      }
    }

    if (!data.success) {
      const err = new Error(data.message || 'API Error');
      err.status  = data.status;
      err.details = data.details;
      throw err;
    }

    return data.data;
  }

  // ─── Refresh token ─────────────────────────────────────────────────────────
  async function _tryRefresh() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await _fetch('/auth/refresh', 'POST', { refreshToken }, false, true);
      _saveTokens(res.accessToken, res.refreshToken, null);
      return true;
    } catch (_) {
      return false;
    }
  }

  // ─── Public HTTP methods ───────────────────────────────────────────────────
  const get    = (path)             => _fetch(path, 'GET',    null,  true);
  const post   = (path, body)       => _fetch(path, 'POST',   body,  true);
  const put    = (path, body)       => _fetch(path, 'PUT',    body,  true);
  const del    = (path)             => _fetch(path, 'DELETE', null,  true);

  // ─── Auth shortcuts ────────────────────────────────────────────────────────
  /**
   * Đăng nhập.
   * @param {string} usernameOrEmail
   * @param {string} password
   * @returns {Promise<{ user, accessToken, refreshToken, expiresIn }>}
   *
   * @example
   *   const session = await Api.login('cvht@rikkei.edu', '123456');
   *   console.log(session.user.name); // "Phạm Viết Hùng"
   */
  async function login(usernameOrEmail, password) {
    const data = await _fetch('/auth/login', 'POST',
      { username: usernameOrEmail, password },
      false
    );
    _saveTokens(data.accessToken, data.refreshToken, data.user);
    return data;
  }

  /**
   * Đăng ký tài khoản mới.
   * @param {{ email, password, name, primaryRole }} userData
   * @returns {Promise<{ user, accessToken, refreshToken }>}
   *
   * @example
   *   await Api.register({
   *     email: 'newlt@rikkei.edu',
   *     password: 'MyPass123',
   *     name: 'Trần Thị B',
   *     primaryRole: 'LOP_TRUONG',
   *   });
   */
  async function register(userData) {
    const data = await _fetch('/auth/register', 'POST', userData, false);
    _saveTokens(data.accessToken, data.refreshToken, data.user);
    return data;
  }

  /**
   * Đăng xuất.
   * @returns {Promise<void>}
   */
  async function logout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try { await _fetch('/auth/logout', 'POST', { refreshToken }, false); } catch (_) {}
    }
    _clearTokens();
  }

  /**
   * Kiểm tra đang đăng nhập chưa (dựa trên token trong storage).
   * @returns {boolean}
   */
  function isLoggedIn() {
    return !!getAccessToken();
  }

  /**
   * User tự đổi mật khẩu (cần đăng nhập, phải nhập đúng mật khẩu cũ).
   * @param {string} oldPassword
   * @param {string} newPassword
   */
  async function changePassword(oldPassword, newPassword) {
    return _fetch('/auth/change-password', 'POST', { oldPassword, newPassword }, true);
  }

  /**
   * Admin reset mật khẩu cho user bất kỳ (không cần mật khẩu cũ).
   * @param {string} userId
   * @param {string} newPassword
   */
  async function adminResetPassword(userId, newPassword) {
    return _fetch(`/users/${userId}/reset-password`, 'POST', { newPassword }, true);
  }

  // ─── Public API ────────────────────────────────────────────────────────────
  return {
    // HTTP methods
    get, post, put, delete: del,
    // Auth
    login, register, logout, isLoggedIn,
    changePassword, adminResetPassword,
    // Token info
    getAccessToken, getRefreshToken, getUser,
  };
})();

// ══════════════════════════════════════════════════════════════════════════════
// VÍ DỤ SỬ DỤNG (copy vào console để test)
// ══════════════════════════════════════════════════════════════════════════════
/*

// ── 1. Đăng nhập ──────────────────────────────────────────────────────────
const session = await Api.login('cvht@rikkei.edu', '123456');
console.log(session.user);        // { id, email, name, primaryRole, ... }
console.log(session.accessToken); // eyJhbGc...

// ── 2. Gọi API có auth ────────────────────────────────────────────────────
const surveys = await Api.get('/surveys');
console.log(surveys);

// Tạo survey mới
const newSurvey = await Api.post('/surveys', {
  title:       'Khảo sát tình hình học tập tuần 1',
  description: 'Vui lòng điền đầy đủ thông tin',
});
console.log(newSurvey.id);

// Cập nhật survey
await Api.put('/surveys/' + newSurvey.id, { status: 'CLOSED' });

// Xóa survey
await Api.delete('/surveys/' + newSurvey.id);

// ── 3. Quản lý user (QLDT only) ───────────────────────────────────────────
const users = await Api.get('/users');
const user  = await Api.get('/users/u_abc123');

// Tạo user mới
const newUser = await Api.post('/users', {
  email:       'newcvht@rikkei.edu',
  name:        'Nguyễn Văn X',
  password:    'Pass@2025',
  primaryRole: 'CVHT',
  campus:      'HCM',
});

// ── 4. Xem profile của mình ───────────────────────────────────────────────
const me = await Api.get('/me');

// ── 5. Đăng xuất ──────────────────────────────────────────────────────────
await Api.logout();

*/

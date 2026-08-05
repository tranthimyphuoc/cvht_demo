/* CVHT Hub — BT/LT/LT NN → CVHT → QLĐT */
(() => {
  const user = Store.getSession();
  if (!user) { location.href = 'index.html'; return; }

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const role = () => userRole(user);
  const real = () => Store.realId(user);
  const isAdmin = () => role() === 'QLDT';

  let route = 'dashboard';
  let routeParams = {};
  const state = {
    reportDraft: null,
    nnAttachments: [],
    cvhtAttachments: [],
    editingReportId: null,
    reportFilterKind: '',
    reportFilterStatus: '',
    reportFilterClass: '',
    reportFilterSemester: '',
    reportFilterSubject: '',
    reportFilterQ: '',
    reportFilterFrom: '',
    reportFilterTo: '',
    classFilterCampus: '',
    classFilterMajor: '',
    classFilterProgram: '',
    trace: {},
  };

  window.App = {
    go: (p) => navigate(p),
    editDraft: (id) => editDraftReport(id),
    submitDraft: (id) => submitDraftNow(id),
  };

  function canEditDraft(r) {
    if (!r || r.status !== 'DRAFT') return false;
    if (isAdmin()) return true;
    return r.reporterId === user.id || r.reporterId === real();
  }

  function editRouteForKind(kind) {
    return {
      BI_THU: 'report-bt',
      LOP_TRUONG: 'report-lt',
      LOP_TRUONG_NN: 'report-nn',
      CVHT_TONG_HOP: 'report-cvht',
    }[kind];
  }

  function submitStatusForKind(kind) {
    return kind === 'CVHT_TONG_HOP' ? 'SENT_TO_QLDT' : 'SENT_TO_CVHT';
  }

  function editDraftReport(id) {
    const r = db().reports.find((x) => x.id === id);
    if (!canEditDraft(r)) return toast('Không thể sửa báo cáo này', 'err');
    const go = editRouteForKind(r.reportKind);
    if (!go) return toast('Loại báo cáo không hỗ trợ sửa', 'err');
    state.editingReportId = id;
    state.reportDraft = null;
    if (r.reportKind === 'LOP_TRUONG_NN') state.nnAttachments = [...(r.attachments || [])];
    else if (r.reportKind === 'CVHT_TONG_HOP') state.cvhtAttachments = [...(r.attachments || [])];
    navigate(go);
  }

  function submitDraftNow(id) {
    const r = db().reports.find((x) => x.id === id);
    if (!canEditDraft(r)) return toast('Không thể gửi báo cáo này', 'err');
    const cls = classById(r.classId);
    const status = submitStatusForKind(r.reportKind);
    const now = new Date();
    const isLate = Scoring.isLate(now);
    Store.update((d) => {
      const item = d.reports.find((x) => x.id === id);
      if (!item || item.status !== 'DRAFT') return;
      item.status = status;
      item.submittedAt = now.toISOString();
      item.isLate = isLate;
      item.updatedAt = now.toISOString();
      if (isLate) {
        const key = `${item.reporterId}_${item.classId}`;
        d.lateCounts[key] = (d.lateCounts[key] || 0) + 1;
      }
      d.auditLog.unshift({
        id: Store.uid('al'), actorId: user.id, actorName: user.name,
        action: 'REPORT_SUBMIT', entity: 'Report', entityId: id,
        beforeJson: 'DRAFT', afterJson: JSON.stringify({ status, classId: item.classId }),
        at: now.toISOString(),
      });
    });

    if (status === 'SENT_TO_CVHT' && cls) {
      notify(cvhtNotifyIds(cls.cvhtId), `BC mới — ${cls.code}`, `${user.name} đã gửi báo cáo từ bản nháp.`);
    }
    if (status === 'SENT_TO_QLDT') {
      notify(['u_admin'], `BC tổng hợp CVHT — ${cls?.code || ''}`, `${user.name} đã gửi báo cáo tổng hợp từ bản nháp.`);
    }
    toast(status === 'SENT_TO_QLDT' ? 'Đã gửi QLĐT' : 'Đã gửi CVHT');
    navigate(`reports/${id}`);
  }

  function cvhtNotifyIds(cvhtId) {
    const ids = [cvhtId].filter(Boolean);
    if (cvhtId === 'u_nq' || cvhtId === 'u_pvh') ids.push('u_cvht_demo');
    return ids;
  }

  function db() { return Store.get(); }
  function allClasses() { return db().classes; }
  function allUsers() { return db().users; }
  function allStudents() { return db().students; }
  function findUser(id) { return Store.findUser(id); }
  function userName(id) { return findUser(id)?.name || '—'; }
  function classById(id) { return allClasses().find((c) => c.id === id); }
  function majorName(id) { return SEED.majors.find((m) => m.id === id)?.name || id; }
  function subjectOf(c) {
    if (!c) return '—';
    if (c.subjectCode) {
      const hit = Curriculum.subjectByCode(c.code, c.subjectCode);
      if (hit) return hit.name;
    }
    return c.subject || majorName(c.majorId) || '—';
  }
  function classLabel(c) {
    if (!c) return '—';
    return `${c.code} · ${subjectOf(c)}`;
  }
  function shortName(id) {
    const n = userName(id);
    if (n === '—') return n;
    return n.split(' ').slice(-2).join(' ');
  }

  function matchPerson(classPersonId, viewer = user) {
    if (!classPersonId) return false;
    const vid = Store.realId(viewer);
    return classPersonId === viewer.id || classPersonId === vid || classPersonId === viewer.aliasOf;
  }

  function classesForUser(u = user) {
    const r = userRole(u);
    const list = allClasses();
    if (r === 'QLDT') return list;
    if (r === 'CVHT') return list.filter((c) => matchPerson(c.cvhtId, u));
    if (r === 'LOP_TRUONG') return list.filter((c) => c.programType !== 'NGOAI_NGU' && (matchPerson(c.ltId, u) || c.id === u.classId));
    if (r === 'LOP_TRUONG_NN') return list.filter((c) => c.programType === 'NGOAI_NGU' && (matchPerson(c.ltId, u) || c.id === u.classId));
    if (r === 'BI_THU') return list.filter((c) => matchPerson(c.btId, u) || c.id === u.classId);
    return [];
  }

  function studentsInScope() {
    const ids = new Set(classesForUser().map((c) => c.id));
    return allStudents().filter((s) => ids.has(s.classId));
  }

  function toast(msg, type = 'ok') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    $('#toastWrap').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) {
    return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  /** Ngày local YYYY-MM-DD từ ISO / date string */
  function isoDay(iso) {
    if (!iso) return '';
    const s = String(iso);
    if (/^\d{4}-\d{2}-\d{2}/.test(s) && s.length <= 10) return s.slice(0, 10);
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return s.slice(0, 10);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function inDateRange(iso, from, to) {
    if (!from && !to) return true;
    const day = isoDay(iso);
    if (!day) return true;
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  }

  function textMatch(hay, q) {
    if (!q) return true;
    return String(hay || '').toLowerCase().includes(String(q).trim().toLowerCase());
  }

  function getTrace(key) {
    if (!state.trace) state.trace = {};
    if (!state.trace[key]) {
      state.trace[key] = { q: '', classId: '', dateFrom: '', dateTo: '', kind: 'all', status: '' };
    }
    return state.trace[key];
  }

  function clearTrace(key) {
    state.trace[key] = { q: '', classId: '', dateFrom: '', dateTo: '', kind: 'all', status: '' };
  }

  /**
   * Thanh lọc truy vết chung: tìm kiếm · lớp · khoảng ngày · (tuỳ chọn) loại/trạng thái
   */
  function traceBarHTML(key, {
    classes = [],
    kinds = null,
    statuses = null,
    placeholder = 'Tìm theo tên, lớp, nội dung…',
    resultText = '',
    extra = '',
  } = {}) {
    const t = getTrace(key);
    return `<div class="trace-bar" data-trace="${escAttr(key)}">
      <input type="search" id="traceQ" class="trace-q" placeholder="${escAttr(placeholder)}" value="${escAttr(t.q)}" />
      ${classes.length ? `<select id="traceClass" class="trace-class">
        <option value="">Tất cả lớp</option>
        ${classes.map((c) => `<option value="${c.id}" ${t.classId === c.id ? 'selected' : ''}>${esc(c.code)}</option>`).join('')}
      </select>` : ''}
      <label class="trace-date"><span>Từ ngày</span><input type="date" id="traceFrom" value="${escAttr(t.dateFrom)}" /></label>
      <label class="trace-date"><span>Đến ngày</span><input type="date" id="traceTo" value="${escAttr(t.dateTo)}" /></label>
      ${kinds ? `<select id="traceKind">${kinds.map(([v, l]) =>
        `<option value="${v}" ${(t.kind || 'all') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
      ${statuses ? `<select id="traceStatus">${statuses.map(([v, l]) =>
        `<option value="${v}" ${(t.status || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
      ${extra}
      <button type="button" class="btn btn-ghost btn-sm" id="traceClear">Xóa lọc</button>
      ${resultText ? `<span class="trace-result">${esc(resultText)}</span>` : ''}
    </div>`;
  }

  function bindTraceBar(key, redraw) {
    const read = () => {
      const t = getTrace(key);
      t.q = $('#traceQ')?.value || '';
      t.classId = $('#traceClass')?.value || '';
      t.dateFrom = $('#traceFrom')?.value || '';
      t.dateTo = $('#traceTo')?.value || '';
      if ($('#traceKind')) t.kind = $('#traceKind').value;
      if ($('#traceStatus')) t.status = $('#traceStatus').value;
    };
    const run = () => { read(); redraw(); };
    const q = $('#traceQ');
    if (q) q.oninput = run;
    ['traceClass', 'traceFrom', 'traceTo', 'traceKind', 'traceStatus'].forEach((id) => {
      const el = $(`#${id}`);
      if (el) el.onchange = run;
    });
    const clr = $('#traceClear');
    if (clr) clr.onclick = () => { clearTrace(key); redraw(); };
  }

  function passTrace(t, { at, classId, searchText }) {
    if (t.classId && classId !== t.classId) return false;
    if (!inDateRange(at, t.dateFrom, t.dateTo)) return false;
    if (!textMatch(searchText, t.q)) return false;
    return true;
  }

  function lateCountFor(reporterId, classId) {
    return db().lateCounts[`${reporterId}_${classId}`] || 0;
  }

  function statusBadge(r) {
    const s = STATUS_LABELS[r.status] || { label: r.status, cls: 'badge-muted' };
    return `<span class="badge ${s.cls}">${s.label}</span>`;
  }

  const STUDENT_STATUS = {
    ACTIVE: { label: 'Ổn định', cls: 'badge-ok' },
    WATCH: { label: 'Có vấn đề', cls: 'badge-warn' },
    AT_RISK: { label: 'Nguy cơ', cls: 'badge-danger' },
    INACTIVE: { label: 'Tạm ngưng', cls: 'badge-muted' },
  };

  function studentStatusBadge(s) {
    const meta = STUDENT_STATUS[s?.status] || STUDENT_STATUS.ACTIVE;
    return `<span class="badge ${meta.cls}">${meta.label}</span>`;
  }

  function studentNoteText(s) {
    return s?.statusNote || s?.riskReason || s?.enrollStatus || '';
  }

  function canEditStudentStatus() {
    return ['LOP_TRUONG', 'LOP_TRUONG_NN', 'BI_THU', 'CVHT', 'QLDT'].includes(role());
  }

  function applyStudentStatus(studentId, { status, note, riskLevel }, opts = {}) {
    const now = new Date().toISOString();
    let studentName = '';
    Store.update((d) => {
      const s = d.students.find((x) => x.id === studentId);
      if (!s) return;
      studentName = s.name;
      const before = `${s.status || 'ACTIVE'}: ${s.statusNote || s.riskReason || ''}`;
      s.status = status;
      s.statusNote = note || '';
      s.riskReason = (status === 'AT_RISK' || status === 'WATCH') ? (note || '') : '';
      s.riskLevel = (status === 'AT_RISK' || status === 'WATCH') ? (riskLevel || 'MEDIUM') : '';
      s.statusUpdatedAt = now;
      s.statusUpdatedBy = user.id;
      d.auditLog.unshift({
        id: Store.uid('al'), actorId: user.id, actorName: user.name,
        action: 'STUDENT_STATUS', entity: 'Student', entityId: studentId,
        beforeJson: before,
        afterJson: `${status}: ${note || ''}`,
        at: now,
      });
    });
    return studentName;
  }

  function parseStatusSnippet(raw) {
    const s = String(raw || '').trim();
    const m = s.match(/^([A-Z_]+):\s*(.*)$/s);
    if (!m) return { code: null, note: s };
    return { code: m[1], note: (m[2] || '').trim() };
  }

  function statusBadgeByCode(code) {
    const meta = STUDENT_STATUS[code];
    if (!meta) return `<span class="badge badge-muted">${esc(code || '—')}</span>`;
    return `<span class="badge ${meta.cls}">${meta.label}</span>`;
  }

  /** Lịch sử CSSV: đổi trạng thái + biên bản tư vấn + chuyển QLĐT */
  function buildCssvHistory() {
    const scopeIds = isAdmin() ? null : new Set(studentsInScope().map((s) => s.id));
    const inScope = (studentId) => !scopeIds || scopeIds.has(studentId);
    const events = [];

    db().auditLog.forEach((l) => {
      if (l.action !== 'STUDENT_STATUS') return;
      if (!inScope(l.entityId)) return;
      const s = allStudents().find((x) => x.id === l.entityId);
      const from = parseStatusSnippet(l.beforeJson);
      const to = parseStatusSnippet(l.afterJson);
      events.push({
        id: l.id,
        kind: 'status',
        at: l.at,
        studentId: l.entityId,
        classId: s?.classId || '',
        actorId: l.actorId,
        actorName: l.actorName || userName(l.actorId),
        fromCode: from.code,
        toCode: to.code,
        note: to.note || from.note || '',
      });
    });

    db().atRiskNotes.forEach((n) => {
      if (!inScope(n.studentId)) return;
      /* Bỏ ghi chú tự sinh từ đổi trạng thái cũ (tránh trùng audit) */
      if (/^\[(Ổn định|Có vấn đề|Nguy cơ|Tạm ngưng)\]/.test(n.note || '')) return;
      const s = allStudents().find((x) => x.id === n.studentId);
      events.push({
        id: n.id,
        kind: 'counsel',
        at: n.createdAt,
        studentId: n.studentId,
        classId: s?.classId || '',
        actorId: n.cvhtId,
        actorName: userName(n.cvhtId),
        note: n.note || '',
        status: n.status,
      });
    });

    db().escalations.forEach((e) => {
      if (!inScope(e.studentId)) return;
      const latest = Array.isArray(e.notes) && e.notes.length
        ? e.notes[e.notes.length - 1].text
        : (e.resolveNote || e.reason || '');
      events.push({
        id: e.id,
        kind: 'escalate',
        at: e.resolvedAt || e.createdAt,
        studentId: e.studentId,
        classId: e.classId || '',
        actorId: e.resolvedBy || e.cvhtId,
        actorName: e.resolvedByName || userName(e.cvhtId),
        note: e.status === 'CLOSED' && e.resolveNote
          ? `${e.reason}\n→ Kết luận: ${e.resolveNote}`
          : (latest || e.reason || ''),
        status: e.status,
      });
    });

    return events.sort((a, b) => new Date(b.at) - new Date(a.at));
  }

  function openStudentStatusModal(studentId, classId) {
    if (!canEditStudentStatus()) return denyAccess();
    const s = allStudents().find((x) => x.id === studentId);
    if (!s) return toast('Không tìm thấy SV', 'err');
    const cls = classById(s.classId || classId);
    const cur = s.status || 'ACTIVE';
    $('#modalRoot').innerHTML = `<div class="modal-overlay" id="modalOv"><div class="modal">
      <div class="modal-head"><h3>Cập nhật trạng thái SV</h3><button class="btn btn-ghost btn-sm" id="mClose">✕</button></div>
      <div class="modal-body">
        <div class="field"><label>Sinh viên</label>
          <input type="text" value="${escAttr(s.name)} · ${escAttr(s.studentCode || '')}" disabled /></div>
        <div class="field"><label>Lớp</label>
          <input type="text" value="${escAttr(cls?.code || '—')}" disabled /></div>
        <div class="field"><label>Trạng thái</label>
          <select id="mStatus">
            <option value="ACTIVE" ${cur === 'ACTIVE' ? 'selected' : ''}>Ổn định</option>
            <option value="WATCH" ${cur === 'WATCH' ? 'selected' : ''}>Có vấn đề</option>
            <option value="AT_RISK" ${cur === 'AT_RISK' ? 'selected' : ''}>Nguy cơ</option>
            <option value="INACTIVE" ${cur === 'INACTIVE' ? 'selected' : ''}>Tạm ngưng</option>
          </select>
        </div>
        <div class="field" id="mLevelWrap">
          <label>Mức độ (nếu Có vấn đề / Nguy cơ)</label>
          <select id="mLevel">
            <option value="LOW" ${s.riskLevel === 'LOW' ? 'selected' : ''}>Thấp</option>
            <option value="MEDIUM" ${!s.riskLevel || s.riskLevel === 'MEDIUM' ? 'selected' : ''}>Trung bình</option>
            <option value="HIGH" ${s.riskLevel === 'HIGH' ? 'selected' : ''}>Cao</option>
          </select>
        </div>
        <div class="field"><label>Ghi chú / lý do</label>
          <textarea id="mNote" rows="3" placeholder="VD: Nghỉ 2 buổi liên tiếp, chưa nộp BTVN…">${esc(studentNoteText(s) && studentNoteText(s) !== s.enrollStatus ? studentNoteText(s) : '')}</textarea>
          <div style="font-size:11.5px;color:var(--muted);margin-top:4px">Ghi chú này hiện ở cột Ghi chú trên danh sách lớp và trang SV nguy cơ.</div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" id="mCancel">Hủy</button><button class="btn btn-primary" id="mSave">Lưu</button></div>
    </div></div>`;
    const close = () => { $('#modalRoot').innerHTML = ''; };
    $('#mClose').onclick = $('#mCancel').onclick = close;
    $('#modalOv').onclick = (e) => { if (e.target.id === 'modalOv') close(); };
    const syncLevel = () => {
      const st = $('#mStatus').value;
      $('#mLevelWrap').style.display = (st === 'AT_RISK' || st === 'WATCH') ? '' : 'none';
    };
    $('#mStatus').onchange = syncLevel;
    syncLevel();
    $('#mSave').onclick = () => {
      const status = $('#mStatus').value;
      const note = ($('#mNote').value || '').trim();
      if ((status === 'AT_RISK' || status === 'WATCH') && !note) {
        return toast('Nhập ghi chú / lý do', 'err');
      }
      applyStudentStatus(studentId, {
        status,
        note,
        riskLevel: $('#mLevel').value,
      }, { addCounselNote: role() === 'CVHT' || role() === 'QLDT' });
      toast(`Đã cập nhật: ${STUDENT_STATUS[status]?.label || status}`);
      close();
      if (route === 'at-risk') pageAtRisk();
      else if (route === 'classes' && routeParams.id) pageClassDetail(routeParams.id);
      else render();
    };
  }

  function notify(userIds, title, body) {
    const now = new Date().toISOString();
    Store.update((d) => {
      [...new Set(userIds.filter(Boolean))].forEach((uid) => {
        d.notifications.unshift({ id: Store.uid('n'), userId: uid, title, body, read: false, createdAt: now });
      });
    });
  }

  /* ---------- Attachments (ảnh + file, lưu local base64) ---------- */
  const ATTACH = {
    MAX_FILES: 8,
    MAX_BYTES: 1.5 * 1024 * 1024, // 1.5MB / file (localStorage)
    ACCEPT: 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip',
  };

  function fmtSize(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1048576).toFixed(1)} MB`;
  }

  function isImageType(type, name = '') {
    return (type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
  }

  function attachPanelHtml(list = []) {
    const imgs = list.filter((a) => a.kind === 'image');
    const files = list.filter((a) => a.kind !== 'image');
    return `
      <div class="attach-panel" id="attachPanel">
        <div class="attach-head">
          <div>
            <strong>Đính kèm minh chứng</strong>
            <div class="attach-hint">Ảnh chụp màn hình, biên bản, file báo cáo · tối đa ${ATTACH.MAX_FILES} file · mỗi file ≤ 1.5MB</div>
          </div>
        </div>
        <div class="attach-actions">
          <label class="btn btn-ghost btn-sm attach-btn">
            🖼 Thêm ảnh
            <input type="file" id="attachImages" accept="image/*" multiple hidden />
          </label>
          <label class="btn btn-ghost btn-sm attach-btn">
            📎 Thêm file
            <input type="file" id="attachFiles" accept="${ATTACH.ACCEPT}" multiple hidden />
          </label>
        </div>
        <div class="attach-drop" id="attachDrop">Kéo thả ảnh / file vào đây, hoặc dùng nút bên trên</div>
        <div class="attach-previews" id="attachPreviews">
          ${imgs.map((a) => `
            <div class="attach-thumb" data-aid="${a.id}">
              <img src="${a.dataUrl}" alt="${escAttr(a.name)}" />
              <button type="button" class="attach-remove" data-remove="${a.id}" title="Xóa">×</button>
              <span class="attach-name">${esc(a.name)}</span>
            </div>`).join('')}
        </div>
        <div class="attach-files" id="attachFilesList">
          ${files.map((a) => `
            <div class="attach-file-row" data-aid="${a.id}">
              <span class="attach-file-icon">📄</span>
              <div class="attach-file-meta">
                <strong>${esc(a.name)}</strong>
                <span>${fmtSize(a.size)} · ${esc(a.type || 'file')}</span>
              </div>
              <button type="button" class="btn btn-ghost btn-sm" data-remove="${a.id}">Xóa</button>
            </div>`).join('')}
        </div>
        ${!list.length ? '<div class="attach-empty" id="attachEmpty">Chưa có đính kèm</div>' : ''}
      </div>`;
  }

  function attachViewHtml(list = []) {
    const items = list || [];
    if (!items.length) {
      return `<div class="panel"><div class="panel-head"><h2>Đính kèm minh chứng</h2></div>
        <div class="panel-body"><div class="attach-empty">Không có file / ảnh đính kèm</div></div></div>`;
    }
    const imgs = items.filter((a) => a.kind === 'image');
    const files = items.filter((a) => a.kind !== 'image');
    return `
      <div class="panel"><div class="panel-head"><h2>Đính kèm minh chứng (${items.length})</h2></div>
        <div class="panel-body">
          ${imgs.length ? `<div class="attach-previews view">${imgs.map((a) => `
            <a class="attach-thumb" href="${a.dataUrl}" target="_blank" rel="noopener" title="${escAttr(a.name)}">
              <img src="${a.dataUrl}" alt="${escAttr(a.name)}" />
              <span class="attach-name">${esc(a.name)}</span>
            </a>`).join('')}</div>` : ''}
          ${files.length ? `<div class="attach-files">${files.map((a) => `
            <a class="attach-file-row" href="${a.dataUrl}" download="${escAttr(a.name)}" target="_blank" rel="noopener">
              <span class="attach-file-icon">📄</span>
              <div class="attach-file-meta">
                <strong>${esc(a.name)}</strong>
                <span>${fmtSize(a.size)} · Tải xuống</span>
              </div>
            </a>`).join('')}</div>` : ''}
        </div>
      </div>`;
  }

  function bindAttachments(getList, setList, onChange) {
    const readFiles = (fileList, forceKind) => {
      const files = [...fileList];
      if (!files.length) return;
      let list = getList();
      files.forEach((file) => {
        if (list.length >= ATTACH.MAX_FILES) {
          toast(`Tối đa ${ATTACH.MAX_FILES} file`, 'err');
          return;
        }
        if (file.size > ATTACH.MAX_BYTES) {
          toast(`“${file.name}” vượt 1.5MB — hãy nén hoặc chọn file nhỏ hơn`, 'err');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const kind = forceKind || (isImageType(file.type, file.name) ? 'image' : 'file');
          list = getList();
          if (list.length >= ATTACH.MAX_FILES) return;
          list.push({
            id: Store.uid('att'),
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            kind,
            dataUrl: reader.result,
          });
          setList(list);
          onChange();
        };
        reader.onerror = () => toast(`Không đọc được “${file.name}”`, 'err');
        reader.readAsDataURL(file);
      });
    };

    const imgInput = $('#attachImages');
    const fileInput = $('#attachFiles');
    if (imgInput) imgInput.onchange = () => { readFiles(imgInput.files, 'image'); imgInput.value = ''; };
    if (fileInput) fileInput.onchange = () => { readFiles(fileInput.files); fileInput.value = ''; };

    $$('[data-remove]').forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setList(getList().filter((a) => a.id !== btn.dataset.remove));
        onChange();
      };
    });

    const drop = $('#attachDrop');
    if (drop) {
      ['dragenter', 'dragover'].forEach((ev) => {
        drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
      });
      ['dragleave', 'drop'].forEach((ev) => {
        drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); });
      });
      drop.addEventListener('drop', (e) => {
        readFiles(e.dataTransfer?.files || []);
      });
    }
  }

  /* ---------- RBAC ---------- */
  const ROLE_MENUS = {
    BI_THU: [
      { id: 'dashboard', label: 'Tổng quan', icon: '▣' },
      { id: 'classes', label: 'Lớp của tôi', icon: '▦' },
      { id: 'report-bt', label: 'BC hoạt động', icon: '✎' },
      { id: 'reports', label: 'Lịch sử BC', icon: '☰' },
      { id: 'at-risk', label: 'SV nguy cơ', icon: '⚠' },
      { id: 'notifications', label: 'Thông báo', icon: '◉' },
    ],
    LOP_TRUONG: [
      { id: 'dashboard', label: 'Tổng quan', icon: '▣' },
      { id: 'classes', label: 'Lớp của tôi', icon: '▦' },
      { id: 'report-lt', label: 'BC gửi CVHT', icon: '✎' },
      { id: 'reports', label: 'Lịch sử BC', icon: '☰' },
      { id: 'at-risk', label: 'SV nguy cơ', icon: '⚠' },
      { id: 'notifications', label: 'Thông báo', icon: '◉' },
    ],
    LOP_TRUONG_NN: [
      { id: 'dashboard', label: 'Tổng quan', icon: '▣' },
      { id: 'classes', label: 'Lớp NN của tôi', icon: '▦' },
      { id: 'report-nn', label: 'BC chuyên cần', icon: '✎' },
      { id: 'reports', label: 'Lịch sử BC', icon: '☰' },
      { id: 'at-risk', label: 'SV nguy cơ', icon: '⚠' },
      { id: 'notifications', label: 'Thông báo', icon: '◉' },
    ],
    CVHT: [
      { id: 'dashboard', label: 'Tổng quan', icon: '▣' },
      { id: 'classes', label: 'Lớp phụ trách', icon: '▦' },
      { id: 'inbox', label: 'Nhận báo cáo', icon: '✉', badge: 'lt' },
      { id: 'visits', label: 'Vào lớp / quan sát', icon: '◎' },
      { id: 'report-cvht', label: 'BC Tổng hợp', icon: '✎' },
      { id: 'rpoint', label: 'R-Point NN', icon: '★' },
      { id: 'reports', label: 'Lịch sử BC', icon: '☰' },
      { id: 'at-risk', label: 'SV nguy cơ', icon: '⚠' },
      { id: 'counseling', label: 'Lịch sử CSSV', icon: '◷' },
      { id: 'escalations', label: 'Chuyển QLĐT', icon: '↑' },
      { id: 'notifications', label: 'Thông báo', icon: '◉' },
    ],
    QLDT: [
      { group: 'Điều hành' },
      { id: 'dashboard', label: 'Tổng quan', icon: '▣' },
      { id: 'inbox', label: 'Nhận báo cáo', icon: '✉', badge: 'cvht' },
      { id: 'notifications', label: 'Thông báo', icon: '◉' },

      { group: 'Lớp · Cơ sở' },
      { id: 'classes', label: 'Danh sách lớp', icon: '▦', clearClassFilters: true },
      { classScopePicker: true },

      { group: 'Học vụ & báo cáo', collapse: true, routes: ['reports', 'visits', 'rpoint', 'at-risk', 'counseling', 'escalations'] },
      { id: 'reports', label: 'Mọi báo cáo', icon: '☰' },
      { id: 'visits', label: 'Lịch vào lớp', icon: '◎' },
      { id: 'rpoint', label: 'R-Point NN', icon: '★' },
      { id: 'at-risk', label: 'SV nguy cơ', icon: '⚠' },
      { id: 'counseling', label: 'Lịch sử CSSV', icon: '◷' },
      { id: 'escalations', label: 'Chuyển QLĐT', icon: '↑' },

      { group: 'Nhân sự & hệ thống', collapse: true, routes: ['people', 'admin', 'subjects', 'audit', 'sheets'] },
      { id: 'people', label: 'Nhân sự & vai trò', icon: '☺' },
      { id: 'admin', label: 'Phân công lớp', icon: '⚙' },
      { id: 'subjects', label: 'Khung CT · Khóa', icon: '☰' },
      { id: 'audit', label: 'Nhật ký', icon: '◷' },
      { id: 'sheets', label: 'Google Sheets', icon: '⧉' },
    ],
  };

  const ROLE_ROUTES = {
    BI_THU: ['dashboard', 'classes', 'report-bt', 'reports', 'at-risk', 'notifications', 'demo', 'guide'],
    LOP_TRUONG: ['dashboard', 'classes', 'report-lt', 'reports', 'at-risk', 'notifications', 'demo', 'guide'],
    LOP_TRUONG_NN: ['dashboard', 'classes', 'report-nn', 'reports', 'at-risk', 'notifications', 'demo', 'guide'],
    CVHT: ['dashboard', 'classes', 'inbox', 'visits', 'report-cvht', 'rpoint', 'reports', 'at-risk', 'counseling', 'escalations', 'notifications', 'demo', 'guide'],
    QLDT: ['dashboard', 'classes', 'inbox', 'reports', 'visits', 'rpoint', 'at-risk', 'counseling', 'escalations', 'people', 'admin', 'subjects', 'audit', 'sheets', 'notifications', 'demo', 'guide', 'report-bt', 'report-lt', 'report-nn', 'report-cvht'],
  };

  function pendingForRole() {
    const ids = new Set(classesForUser().map((c) => c.id));
    const reports = db().reports.filter((r) => ids.has(r.classId) || isAdmin());
    if (role() === 'CVHT') {
      return reports.filter((r) =>
        ['BI_THU', 'LOP_TRUONG', 'LOP_TRUONG_NN'].includes(r.reportKind) && r.status === 'SENT_TO_CVHT'
      );
    }
    if (role() === 'QLDT') return reports.filter((r) => r.reportKind === 'CVHT_TONG_HOP' && r.status === 'SENT_TO_QLDT');
    return [];
  }

  function unreadCount() {
    return db().notifications.filter((n) => (n.userId === user.id || n.userId === real()) && !n.read).length;
  }

  function canAccessRoute(id) {
    return (ROLE_ROUTES[role()] || ['dashboard', 'demo']).includes(id);
  }

  function canAccessClass(classId) {
    return isAdmin() || classesForUser().some((c) => c.id === classId);
  }

  function canAccessReport(r) {
    if (!r) return false;
    if (isAdmin()) return true;
    if (!canAccessClass(r.classId)) return false;
    if (role() === 'BI_THU') return r.reporterId === user.id && r.reportKind === 'BI_THU';
    if (role() === 'LOP_TRUONG') {
      return r.reportKind === 'LOP_TRUONG' && r.reporterId === user.id;
    }
    if (role() === 'LOP_TRUONG_NN') {
      return r.reportKind === 'LOP_TRUONG_NN' && r.reporterId === user.id;
    }
    if (role() === 'CVHT') {
      return ['LOP_TRUONG', 'LOP_TRUONG_NN', 'BI_THU', 'CVHT_TONG_HOP'].includes(r.reportKind);
    }
    return true;
  }

  function denyAccess(msg = 'Bạn không có quyền truy cập phần này') {
    toast(msg, 'err');
    navigate('dashboard');
  }

  /* ---------- Shell ---------- */
  function navItemActive(i) {
    return !!(i.id && route === i.id);
  }

  function classScopeSummary() {
    const bits = [];
    if (state.classFilterCampus === 'HN') bits.push('Hà Nội');
    else if (state.classFilterCampus === 'HCM') bits.push('HCM');
    if (state.classFilterMajor) bits.push(majorName(state.classFilterMajor));
    if (state.classFilterProgram === 'CHUYEN_NGANH') bits.push('CN');
    else if (state.classFilterProgram === 'NGOAI_NGU') bits.push('NN');
    return bits.length ? bits.join(' · ') : 'Tất cả cơ sở & ngành';
  }

  function renderNavItemHtml(i, pending) {
    if (i.classScopePicker) {
      const camp = state.classFilterCampus || '';
      const maj = state.classFilterMajor || '';
      const prog = state.classFilterProgram || '';
      const open = route === 'classes' || camp || maj || prog;
      return `<details class="nav-dropdown" ${open ? 'open' : ''} data-nav-scope>
        <summary class="nav-dropdown-sum">
          <span class="icon">▾</span>
          <span class="nav-dropdown-text">
            <strong>Lọc lớp</strong>
            <small>${esc(classScopeSummary())}</small>
          </span>
        </summary>
        <div class="nav-dropdown-body">
          <label class="nav-select-label">Cơ sở
            <select id="navCampus" class="nav-select">
              <option value="">Tất cả cơ sở</option>
              <option value="HN" ${camp === 'HN' ? 'selected' : ''}>Hà Nội</option>
              <option value="HCM" ${camp === 'HCM' ? 'selected' : ''}>Hồ Chí Minh</option>
            </select>
          </label>
          <label class="nav-select-label">Chuyên ngành
            <select id="navMajor" class="nav-select">
              <option value="">Tất cả ngành</option>
              ${(SEED.majors || []).map((m) =>
                `<option value="${m.id}" ${maj === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
            </select>
          </label>
          <label class="nav-select-label">Chương trình
            <select id="navProgram" class="nav-select">
              <option value="">Tất cả</option>
              <option value="CHUYEN_NGANH" ${prog === 'CHUYEN_NGANH' ? 'selected' : ''}>Chuyên ngành</option>
              <option value="NGOAI_NGU" ${prog === 'NGOAI_NGU' ? 'selected' : ''}>Ngoại ngữ</option>
            </select>
          </label>
          <div class="nav-filter-actions">
            <button type="button" class="btn btn-primary btn-sm btn-block" id="navApplyFilter">Áp dụng lọc</button>
            <button type="button" class="btn btn-ghost btn-sm btn-block" id="navClearFilter">Xóa lọc</button>
          </div>
        </div>
      </details>`;
    }

    let badge = '';
    if (i.badge && pending) badge = `<span class="badge-count">${pending}</span>`;
    if (i.id === 'notifications' && unreadCount()) badge = `<span class="badge-count">${unreadCount()}</span>`;
    const attrs = [
      `data-route="${i.id}"`,
      i.clearClassFilters ? 'data-clear-class-filters="1"' : '',
    ].filter(Boolean).join(' ');
    return `<button class="nav-item ${navItemActive(i) ? 'active' : ''}" ${attrs}>
      <span class="icon">${i.icon}</span> ${i.label} ${badge}
    </button>`;
  }

  function renderShell() {
    const items = ROLE_MENUS[role()] || [];
    const pending = pendingForRole().length;
    const hasGroups = items.some((i) => i.group);

    let html = hasGroups ? '' : `<div class="nav-label">Menu · ${ROLE_LABELS[role()]}</div>`;
    let collapseOpen = false;
    let collapseActive = false;

    const closeCollapse = () => {
      if (collapseOpen) {
        html += '</div></details>';
        collapseOpen = false;
      }
    };

    items.forEach((i) => {
      if (i.group) {
        closeCollapse();
        if (i.collapse) {
          collapseActive = (i.routes || []).includes(route);
          collapseOpen = true;
          html += `<details class="nav-group-drop" ${collapseActive ? 'open' : ''}>
            <summary class="nav-group-sum ${collapseActive ? 'has-active' : ''}">
              <span>${esc(i.group)}</span>
              <span class="chev">▾</span>
            </summary>
            <div class="nav-group-body">`;
        } else {
          html += `<div class="nav-label">${esc(i.group)}</div>`;
        }
        return;
      }
      html += renderNavItemHtml(i, pending);
    });
    closeCollapse();

    $('#sidebarNav').innerHTML = html;
    $('#sidebarUser').innerHTML = `
      <div class="avatar">${user.initials}</div>
      <div class="meta"><strong>${user.name}</strong><span>${ROLE_LABELS[role()]}</span></div>
      <button class="btn-logout" id="btnLogout" title="Đăng xuất">⎋</button>
    `;

    $$('.nav-item', $('#sidebarNav')).forEach((btn) => btn.addEventListener('click', () => {
      if (btn.dataset.clearClassFilters) clearClassFilters();
      else navigate(btn.dataset.route);
    }));

    $('#navApplyFilter')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyClassFilters();
    });
    $('#navClearFilter')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearClassFilters();
    });

    $('#btnLogout').onclick = () => { Store.clearSession(); location.href = 'index.html'; };

    const cd = Scoring.formatCountdown(Scoring.getWeekDeadline());
    $('#topbarActions').innerHTML = `
      <span class="badge badge-brand">${ROLE_LABELS[role()]}</span>
      <div class="deadline-pill ${cd.urgent ? 'urgent' : ''}">⏱ ${cd.text} · T6 23:00</div>
    `;
  }

  function navigate(path) { location.hash = path; }

  function applyClassFilters() {
    const navCampus = $('#navCampus');
    const navMajor = $('#navMajor');
    const navProgram = $('#navProgram');
    if (navCampus) state.classFilterCampus = navCampus.value;
    if (navMajor) state.classFilterMajor = navMajor.value;
    if (navProgram) state.classFilterProgram = navProgram.value;
    route = 'classes';
    routeParams = {};
    location.hash = 'classes';
    render();
  }

  function clearClassFilters() {
    state.classFilterCampus = '';
    state.classFilterMajor = '';
    state.classFilterProgram = '';
    route = 'classes';
    routeParams = {};
    location.hash = 'classes';
    render();
  }

  function parseRoute() {
    const hash = location.hash.slice(1) || 'dashboard';
    const parts = hash.split('/');
    route = parts[0];
    routeParams = { id: parts[1] };
  }
  function setPage(title, sub) {
    $('#pageTitle').textContent = title;
    $('#pageSub').textContent = sub || '';
    document.title = `${title} · CVHT Hub`;
  }

  function flowBanner() {
    const r = role();
    if (r === 'LOP_TRUONG_NN') {
      return `<div class="flow-banner">
        <span class="on">Lớp trưởng NN</span>
        <span class="arrow">→</span>
        <span>CVHT</span>
        <span class="arrow">→</span>
        <span>QLĐT</span>
        <span class="arrow" style="margin-left:8px">·</span>
        <span style="font-weight:500;opacity:.7">R-Point cuối HP</span>
      </div>`;
    }
    if (r === 'BI_THU') {
      return `<div class="flow-banner">
        <span class="on">Bí thư</span>
        <span class="arrow">→</span>
        <span>CVHT</span>
        <span class="arrow">→</span>
        <span>QLĐT</span>
      </div>`;
    }
    if (r === 'LOP_TRUONG') {
      return `<div class="flow-banner">
        <span class="on">LT (CN)</span>
        <span class="arrow">→</span>
        <span>CVHT</span>
        <span class="arrow">→</span>
        <span>QLĐT</span>
      </div>`;
    }
    return `<div class="flow-banner">
      <span style="font-weight:500;opacity:.75">BT</span>
      <span class="arrow">/</span>
      <span style="font-weight:500;opacity:.75">LT</span>
      <span class="arrow">→</span>
      <span class="${r === 'CVHT' ? 'on' : ''}">CVHT</span>
      <span class="arrow">→</span>
      <span class="${r === 'QLDT' ? 'on' : ''}">QLĐT</span>
    </div>`;
  }

  /* ========== DASHBOARD ========== */
  function groupClassesBySemesterSubject(list) {
    const out = {};
    list.forEach((c) => {
      const cur = Curriculum.forClass(c.code, c.semester);
      const sem = c.semester || cur?.semesterId || 'Khác';
      const sub = c.subject || cur?.subjects?.[0]?.name || subjectOf(c);
      if (!out[sem]) out[sem] = {};
      if (!out[sem][sub]) out[sem][sub] = [];
      out[sem][sub].push(c);
    });
    return out;
  }

  function semesterLabel(sem) {
    return Curriculum.semesterLabel(sem);
  }

  function reportSubjectLine(report, cls) {
    const ctx = Curriculum.resolveReportContext(report, cls);
    return ctx.subjectName + (ctx.subjectCode ? ` (${ctx.subjectCode})` : '');
  }

  function getReportSelection(classId, kind) {
    const cls = classById(classId);
    const draft = state.reportDraft;
    const editing = state.editingReportId
      ? db().reports.find((x) => x.id === state.editingReportId && x.status === 'DRAFT')
      : null;
    let semesterId = draft?.semesterId || editing?.semesterId || cls?.semester || '';
    const cur = cls ? Curriculum.forClass(cls.code, semesterId) : null;
    if (!semesterId) semesterId = cur?.semesterId || '';
    let subjectCode = draft?.subjectCode || editing?.subjectCode || cls?.subjectCode || '';
    if (!subjectCode && cur?.subjects?.length) subjectCode = cur.subjects[0].code;
    const subj = cur ? Curriculum.subjectByCode(cls.code, subjectCode, semesterId) : null;
    return {
      cls,
      cur,
      semesterId,
      subjectCode,
      subject: subj || { code: subjectCode, name: editing?.subjectName || editing?.subject || cls?.subject || '—' },
    };
  }

  function semesterScoreSummary(classId, semesterId, subjectCode, reportKind, reporterId) {
    const reports = db().reports;
    const lookup = (id) => classById(id);
    const mine = Scoring.semesterAverage(reports, {
      classId, semesterId, subjectCode, reportKind, reporterId,
    }, lookup);
    const all = Scoring.semesterAverage(reports, { classId, semesterId, subjectCode, reportKind }, lookup);
    const tenures = Scoring.tenureAverages(reports, db().assignmentHistory, {
      classId, semesterId, subjectCode, reportKind,
    }, lookup);
    const classAvg = Scoring.classWeeklySemesterAvg(reports, { classId, semesterId, subjectCode }, lookup);
    return { mine, all, tenures, classAvg };
  }

  function renderScoreSummaryHtml(sel, kind, weekScore) {
    const { cls, semesterId, subjectCode, subject } = sel;
    if (!cls || !semesterId || !subjectCode) return '';
    const sum = semesterScoreSummary(cls.id, semesterId, subjectCode, kind, user.id);
    const tenure = sum.tenures.find((t) => t.reporterId === user.id || t.reporterId === Store.realId(user));
    const displayAvg = tenure?.avg ?? sum.mine.avg;
    const grade = displayAvg != null ? Scoring.gradeLabel(displayAvg) : null;
    const tenureNote = sum.tenures.length > 1
      ? `<div class="score-tenure-note">Đã có ${sum.tenures.length} người giữ chức trong HK này — TB tính theo từng kỳ đảm nhiệm.</div>`
      : '';
    return `
      <div class="score-summary-panel">
        <div class="score-summary-item">
          <span class="lbl">Tuần này</span>
          <strong class="val week">${weekScore}<small>/100</small></strong>
        </div>
        <div class="score-summary-divider"></div>
        <div class="score-summary-item">
          <span class="lbl">TB học kỳ · ${esc(subject.code)}</span>
          <strong class="val semester">${displayAvg != null ? displayAvg : '—'}<small>/100</small></strong>
          ${displayAvg != null ? `<span class="badge ${grade.cls}" style="margin-top:4px">${grade.label}</span>` : ''}
          <span class="hint">${tenure ? `${tenure.count} tuần đã nộp` : (sum.mine.count ? `${sum.mine.count} BC của bạn` : 'Chưa có BC đã gửi')}</span>
        </div>
        ${(role() === 'CVHT' || role() === 'QLDT') && sum.classAvg.avg != null ? `
        <div class="score-summary-divider"></div>
        <div class="score-summary-item">
          <span class="lbl">TB lớp (BT+LT/tuần)</span>
          <strong class="val">${sum.classAvg.avg}<small>/100</small></strong>
          <span class="hint">${sum.classAvg.weekCount} tuần có BC</span>
        </div>` : ''}
      </div>
      ${tenureNote}`;
  }

  function reportContextFields(sel) {
    return {
      semesterId: sel.semesterId,
      subjectCode: sel.subject.code,
      subjectName: sel.subject.name,
      subject: sel.subject.name,
    };
  }

  function classScopeStudentCount(classId) {
    return allStudents().filter((s) => s.classId === classId).length;
  }

  function renderBcsDashboard(classes, atRisk, h) {
    const grouped = groupClassesBySemesterSubject(classes);
    const totalSv = classes.reduce((n, c) => n + classScopeStudentCount(c.id), 0);
    const semesters = Object.keys(grouped).sort().reverse();

    return `
      <div class="cta-hero">
        <div><h2>${h.title}</h2><p>${h.sub}</p></div>
        <button class="btn btn-primary" onclick="App.go('${h.go}')">${h.cta}</button>
      </div>
      <div class="kpi-grid kpi-grid-3">
        <div class="kpi"><div class="label">Lớp phụ trách</div><div class="value">${classes.length}</div><div class="hint">Theo học kỳ & môn</div></div>
        <div class="kpi info"><div class="label">Sinh viên</div><div class="value">${totalSv}</div><div class="hint">Trong phạm vi lớp</div></div>
        <div class="kpi danger"><div class="label">SV nguy cơ</div><div class="value">${atRisk.length}</div><div class="hint">Cần theo dõi</div></div>
      </div>
      ${semesters.map((sem) => `
        <section class="semester-block">
          <div class="semester-block-head">
            <h2>${esc(semesterLabel(sem))}</h2>
            <span class="badge badge-muted">${Object.values(grouped[sem]).flat().length} lớp</span>
          </div>
          ${Object.entries(grouped[sem]).map(([sub, clsList]) => `
            <div class="subject-block">
              <div class="subject-block-head">
                <h3>${esc(sub)}</h3>
                <span>${clsList.length} lớp · ${clsList.reduce((n, c) => n + classScopeStudentCount(c.id), 0)} SV</span>
              </div>
              <div class="grid-3">${clsList.map((c, i) => `
                <div class="class-card" style="animation-delay:${i * 0.03}s" onclick="App.go('classes/${c.id}')">
                  <div class="code">${c.code}</div>
                  <div class="meta">${c.campusId === 'HN' ? 'Hà Nội' : 'HCM'} · ${majorName(c.majorId)}${c.note || c.level ? ' · ' + (c.level || c.note) : ''}</div>
                  <div class="people">
                    <span class="badge badge-brand">CVHT: ${shortName(c.cvhtId)}</span>
                    ${c.ltId ? `<span class="badge badge-muted">LT: ${shortName(c.ltId)}</span>` : ''}
                    ${c.btId ? `<span class="badge badge-muted">BT: ${shortName(c.btId)}</span>` : ''}
                  </div>
                  <div style="margin-top:12px;font-size:12.5px;color:var(--muted)">${classScopeStudentCount(c.id)} sinh viên</div>
                </div>`).join('')}
              </div>
            </div>`).join('')}
        </section>`).join('') || '<div class="empty panel">Chưa được gán lớp</div>'}`;
  }

  function pageDashboard() {
    const classes = classesForUser();
    const atRisk = studentsInScope().filter((s) => s.status === 'AT_RISK' || s.status === 'WATCH');
    const pending = pendingForRole();
    const range = Scoring.getWeekRange();
    const r = role();

    const heroes = {
      BI_THU: {
        title: `Báo cáo hoạt động ${Scoring.fmtDate(range.start)} – ${Scoring.fmtDate(range.end)}`,
        sub: 'Truyền thông, phong trào, hoạt động lớp → gửi Cố vấn học tập.',
        cta: 'Tạo BC hoạt động →', go: 'report-bt',
      },
      LOP_TRUONG: {
        title: 'Báo cáo tuần gửi CVHT',
        sub: 'Tổng hợp tình hình lớp theo môn → gửi CVHT trước 23:00 Thứ 6.',
        cta: 'BC gửi CVHT →',
        go: 'report-lt',
      },
      LOP_TRUONG_NN: {
        title: 'Báo cáo chuyên cần Ngoại ngữ',
        sub: 'Theo dõi sĩ số, BTVN, SV nguy cơ → gửi CVHT trước 23:00 Thứ 6.',
        cta: 'Tạo BC chuyên cần →', go: 'report-nn',
      },
      CVHT: {
        title: `Xin chào, ${user.name.split(' ').slice(-2).join(' ')}`,
        sub: `${pending.length} BC từ Bí thư / LT (CN+NN) chờ xử lý · Vào lớp quan sát · Tổng hợp gửi QLĐT.`,
        cta: pending.length ? 'Nhận báo cáo →' : 'BC Tổng hợp →',
        go: pending.length ? 'inbox' : 'report-cvht',
      },
      QLDT: {
        title: 'Giám sát toàn chương trình',
        sub: `${pending.length} BC tổng hợp CVHT chờ xác nhận · Xem full CN + Ngoại ngữ.`,
        cta: pending.length ? 'Nhận báo cáo →' : 'Mọi báo cáo →',
        go: pending.length ? 'inbox' : 'reports',
      },
    };
    const h = heroes[r] || heroes.QLDT;

    setPage('Tổng quan', ROLE_LABELS[r]);

    if (r === 'BI_THU' || r === 'LOP_TRUONG' || r === 'LOP_TRUONG_NN') {
      $('#content').innerHTML = renderBcsDashboard(classes, atRisk, h);
      return;
    }

    $('#content').innerHTML = `
      ${flowBanner()}
      <div class="cta-hero">
        <div><h2>${h.title}</h2><p>${h.sub}</p></div>
        <button class="btn btn-primary" onclick="App.go('${h.go}')">${h.cta}</button>
      </div>
      <div class="kpi-grid">
        <div class="kpi"><div class="label">Lớp phụ trách</div><div class="value">${classes.length}</div><div class="hint">Trong phạm vi của bạn</div></div>
        <div class="kpi warn"><div class="label">Chờ xử lý</div><div class="value">${pending.length}</div><div class="hint">Chờ nhận báo cáo</div></div>
        <div class="kpi danger"><div class="label">SV nguy cơ</div><div class="value">${atRisk.length}</div><div class="hint">Cần theo dõi</div></div>
        <div class="kpi info"><div class="label">Thông báo chưa đọc</div><div class="value">${unreadCount()}</div><div class="hint">Trong hộp thư</div></div>
      </div>
      <div class="grid-2">
        <div class="panel">
          <div class="panel-head"><h2>Lớp của bạn</h2><button class="btn btn-ghost btn-sm" onclick="App.go('classes')">Tất cả</button></div>
          <div class="table-wrap"><table>
            <thead><tr><th>Mã lớp</th><th>Môn</th><th>CVHT</th><th>LT</th><th>BT</th></tr></thead>
            <tbody>${classes.slice(0, 6).map((c) => `
              <tr style="cursor:pointer" onclick="App.go('classes/${c.id}')">
                <td><strong>${c.code}</strong></td>
                <td style="font-size:12.5px">${esc(subjectOf(c))}</td>
                <td>${shortName(c.cvhtId)}</td>
                <td>${c.ltId ? shortName(c.ltId) : '—'}</td>
                <td>${c.btId ? shortName(c.btId) : '—'}</td>
              </tr>`).join('') || '<tr><td colspan="5" class="empty">Chưa có lớp</td></tr>'}
            </tbody>
          </table></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Luồng của bạn</h2></div>
          <div class="panel-body" style="font-size:.9rem;line-height:1.75;color:var(--muted)">
            ${role() === 'BI_THU' ? '<p><strong style="color:var(--ink)">Bí thư</strong> phụ trách hoạt động, phong trào, truyền thông — gửi báo cáo thẳng <strong style="color:var(--ink)">CVHT</strong>.</p>' : ''}
            ${role() === 'LOP_TRUONG' ? '<p><strong style="color:var(--ink)">Lớp trưởng CN</strong> tổng hợp tình hình lớp — gửi <strong style="color:var(--ink)">CVHT</strong> (song song với Bí thư).</p>' : ''}
            ${role() === 'LOP_TRUONG_NN' ? '<p><strong style="color:var(--ink)">Lớp trưởng NN</strong> theo dõi chuyên cần, thông báo, SV nguy cơ — gửi CVHT hàng tuần; cuối học phần xét <strong style="color:var(--ink)">R-Point /10</strong>.</p>' : ''}
            ${role() === 'CVHT' ? '<p><strong style="color:var(--ink)">CVHT</strong> nhận BC từ Bí thư + Lớp trưởng (CN/NN), vào lớp quan sát, tổng hợp — gửi <strong style="color:var(--ink)">QLĐT</strong>.</p>' : ''}
            ${role() === 'QLDT' ? '<p><strong style="color:var(--ink)">QLĐT</strong> nhận BC tổng hợp từ CVHT và xem toàn bộ hệ thống (CN + Ngoại ngữ).</p>' : ''}
          </div>
        </div>
      </div>`;
  }

  /* ========== CLASSES ========== */
  function pageClasses() {
    if (routeParams.id) return pageClassDetail(routeParams.id);
    let classes = classesForUser();
    const campF = state.classFilterCampus || '';
    const majF = state.classFilterMajor || '';
    const progF = state.classFilterProgram || '';
    if (campF) classes = classes.filter((c) => c.campusId === campF);
    if (majF) classes = classes.filter((c) => c.majorId === majF);
    if (progF) classes = classes.filter((c) => c.programType === progF);

    const campusLabel = campF === 'HN' ? 'Hà Nội' : campF === 'HCM' ? 'Hồ Chí Minh' : '';
    const majorLabel = majF ? majorName(majF) : '';
    const scopeBits = [campusLabel, majorLabel].filter(Boolean);
    const scopeText = scopeBits.length
      ? scopeBits.join(' · ')
      : (isAdmin() ? 'Tất cả cơ sở · mọi chuyên ngành' : `${classes.length} lớp trong phạm vi`);

    setPage(isAdmin() ? 'Danh sách lớp' : 'Lớp học', `${classes.length} lớp · ${scopeText}`);

    const classCard = (c, i) => `
      <div class="class-card" style="animation-delay:${i * 0.03}s" onclick="App.go('classes/${c.id}')">
        <div class="code">${c.code}</div>
        <div class="meta"><strong style="color:var(--ink)">${esc(subjectOf(c))}</strong> · ${majorName(c.majorId)} · ${c.campusId === 'HN' ? 'Hà Nội' : 'HCM'} · ${c.programType === 'NGOAI_NGU' ? 'Ngoại ngữ' : 'Chuyên ngành'} · ${c.semester}${c.note || c.level ? ' · ' + (c.level || c.note) : ''}</div>
        <div class="people">
          <span class="badge badge-brand">CVHT: ${shortName(c.cvhtId)}</span>
          ${c.ltId ? `<span class="badge badge-muted">${c.programType === 'NGOAI_NGU' ? 'LT NN' : 'LT'}: ${shortName(c.ltId)}</span>` : ''}
          ${c.btId ? `<span class="badge badge-muted">BT: ${shortName(c.btId)}</span>` : ''}
        </div>
        <div style="margin-top:12px;font-size:12.5px;color:var(--muted)">${c.studentCount} sinh viên</div>
      </div>`;

    let bodyHtml = '';
    const emptyMsg = (() => {
      if (!campF && !majF && !progF) return 'Không có lớp';
      const bits = [];
      if (campF) bits.push(campF === 'HN' ? 'Hà Nội' : 'Hồ Chí Minh');
      if (majF) bits.push(majorName(majF));
      if (progF) bits.push(progF === 'NGOAI_NGU' ? 'Ngoại ngữ' : 'Chuyên ngành');
      return `Không có lớp khớp bộ lọc: ${bits.join(' · ')}`;
    })();

    if (isAdmin() && !campF && !majF && !progF) {
      const campuses = SEED.campuses || [{ id: 'HN', name: 'Hà Nội' }, { id: 'HCM', name: 'Hồ Chí Minh' }];
      bodyHtml = campuses.map((camp) => {
        const inCamp = classes.filter((c) => c.campusId === camp.id);
        if (!inCamp.length) return '';
        const byMajor = {};
        inCamp.forEach((c) => {
          (byMajor[c.majorId] = byMajor[c.majorId] || []).push(c);
        });
        return `<section class="campus-block">
          <div class="campus-block-head">
            <h2>${esc(camp.name)}</h2>
            <span class="badge badge-muted">${inCamp.length} lớp</span>
          </div>
          ${Object.entries(byMajor).map(([mid, list]) => `
            <div class="major-block">
              <div class="major-block-head">${esc(majorName(mid))} <span>${list.length}</span></div>
              <div class="grid-3">${list.map((c, i) => classCard(c, i)).join('')}</div>
            </div>`).join('')}
        </section>`;
      }).join('') || `<div class="empty">${emptyMsg}</div>`;
    } else {
      bodyHtml = `<div class="grid-3">${classes.map((c, i) => classCard(c, i)).join('') || `<div class="empty" style="grid-column:1/-1">${esc(emptyMsg)}</div>`}</div>`;
    }

    /* Bộ lọc nằm ở sidebar (dropdown) — tránh trùng trên trang */
    $('#content').innerHTML = `
      ${flowBanner()}
      ${bodyHtml}`;
  }

  function pageClassDetail(id) {
    const c = classById(id);
    if (!c) { toast('Không tìm thấy lớp', 'err'); return navigate('classes'); }
    if (!canAccessClass(id)) return denyAccess('Bạn không phụ trách lớp này');
    const students = allStudents().filter((s) => s.classId === id);
    const reports = reportsForViewer()
      .filter((r) => r.classId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    setPage(c.code, `${subjectOf(c)} · ${majorName(c.majorId)} · ${c.campusId}`);
    $('#content').innerHTML = `
      <div class="kpi-grid">
        <div class="kpi"><div class="label">Môn học</div><div class="value" style="font-size:.95rem">${esc(subjectOf(c))}</div></div>
        <div class="kpi"><div class="label">Giảng viên</div><div class="value" style="font-size:.95rem">${esc(c.gvName || '—')}</div></div>
        <div class="kpi"><div class="label">Trợ giảng</div><div class="value" style="font-size:.95rem">${esc(c.tgName || '—')}</div></div>
        <div class="kpi"><div class="label">CVHT</div><div class="value" style="font-size:.95rem">${userName(c.cvhtId)}</div></div>
        <div class="kpi"><div class="label">${c.programType === 'NGOAI_NGU' ? 'Lớp trưởng NN' : 'Lớp trưởng'}</div><div class="value" style="font-size:.95rem">${c.ltId ? userName(c.ltId) : 'Chưa bầu'}</div></div>
        <div class="kpi"><div class="label">${c.programType === 'NGOAI_NGU' ? 'Sĩ số' : 'Bí thư'}</div><div class="value" style="font-size:.95rem">${c.programType === 'NGOAI_NGU' ? c.studentCount : (c.btId ? userName(c.btId) : 'Chưa bầu')}</div></div>
      </div>
      <div class="tabs">
        <button class="tab active" data-tab="sv">Sinh viên</button>
        <button class="tab" data-tab="rp">Báo cáo</button>
      </div>
      <div id="tabBody"></div>`;

    const show = (tab) => {
      $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
      if (tab === 'sv') {
        const canEdit = canEditStudentStatus();
        $('#tabBody').innerHTML = `<div class="panel">
          <div class="panel-head" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
            <h2 style="margin:0;font-size:.95rem">Danh sách sinh viên</h2>
            ${canEdit ? `<button type="button" class="btn btn-primary btn-sm" id="btnMarkRisk">+ Ghi nhận trạng thái</button>` : ''}
          </div>
          <div class="table-wrap"><table>
          <thead><tr><th>Họ tên</th><th>Email</th><th>Giới tính</th><th>Trạng thái</th><th>Ghi chú</th>${canEdit ? '<th></th>' : ''}</tr></thead>
          <tbody>${(students.length ? students : [{ name: 'Chưa có SV', email: '—', gender: '—', status: 'ACTIVE' }]).map((s) => `
            <tr>
              <td><strong>${esc(s.name)}</strong>${s.studentCode ? `<div style="font-size:12px;color:var(--muted)">${esc(s.studentCode)}</div>` : ''}</td>
              <td style="font-size:12.5px">${esc(s.email || '—')}</td>
              <td>${esc(s.gender || '—')}</td>
              <td>${studentStatusBadge(s)}</td>
              <td style="font-size:13px;color:var(--muted);max-width:220px">${esc(studentNoteText(s) || '—')}</td>
              ${canEdit && s.id ? `<td><button type="button" class="btn btn-ghost btn-sm" data-status-sv="${s.id}">Cập nhật</button></td>` : (canEdit ? '<td></td>' : '')}
            </tr>`).join('')}
          </tbody></table></div>
          ${canEdit ? `<div class="panel-body" style="padding:10px 16px;font-size:12.5px;color:var(--muted);border-top:1px solid var(--line)">
            LT / Bí thư / CVHT ghi nhận: <span class="badge badge-ok">Ổn định</span>
            <span class="badge badge-warn">Có vấn đề</span>
            <span class="badge badge-danger">Nguy cơ</span>
            — ghi chú lưu trên hồ sơ SV và vào mục <strong>SV nguy cơ</strong>.
          </div>` : ''}
        </div>`;
        $$('[data-status-sv]').forEach((b) => {
          b.onclick = () => openStudentStatusModal(b.dataset.statusSv, id);
        });
        const markBtn = $('#btnMarkRisk');
        if (markBtn) markBtn.onclick = () => openPickStudentStatusModal(id);
      } else {
        const emptyHint = role() === 'BI_THU'
          ? 'Chỉ hiển thị báo cáo Bí thư do bạn gửi'
          : role() === 'LOP_TRUONG' || role() === 'LOP_TRUONG_NN'
            ? 'Chỉ hiển thị báo cáo do bạn gửi'
            : 'Chưa có báo cáo';
        $('#tabBody').innerHTML = reports.length ? `<div class="panel"><div class="table-wrap"><table>
          <thead><tr><th>Loại</th><th>Người gửi</th><th>Điểm</th><th>TT</th><th></th></tr></thead>
          <tbody>${reports.map((r) => `<tr>
            <td>${REPORT_KIND_LABELS[r.reportKind] || r.reportKind}</td>
            <td>${userName(r.reporterId)}</td>
            <td>${r.totalScore ?? '—'}</td>
            <td>${statusBadge(r)}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="App.go('reports/${r.id}')">Xem</button></td>
          </tr>`).join('')}</tbody></table></div></div>` : `<div class="empty">${emptyHint}</div>`;
      }
    };
    $$('.tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
    show('sv');
  }

  /* ========== REPORT FORMS ========== */
  function pageReportBT() {
    if (!['BI_THU', 'QLDT'].includes(role())) return denyAccess();
    const list = classesForUser();
    if (!list.length) { setPage('BC hoạt động', ''); $('#content').innerHTML = '<div class="empty">Chưa được gán lớp</div>'; return; }
    openCriteriaForm({
      title: 'Báo cáo hoạt động / phong trào — Bí thư',
      subtitle: 'Gửi tới Cố vấn học tập',
      criteria: SEED.criteriaBT,
      kind: 'BI_THU',
      classes: list,
      submitStatus: 'SENT_TO_CVHT',
      submitLabel: 'Gửi Cố vấn học tập',
      extraField: { id: 'activityNote', label: 'Tóm tắt hoạt động / phong trào tuần này', placeholder: 'VD: Sinh hoạt lớp, truyền thông lịch thi, hỗ trợ SV…' },
      onSubmitNotify: (report, cls) => {
        notify(cvhtNotifyIds(cls.cvhtId), `BC Bí thư — ${cls.code} · ${subjectOf(cls)}`, `${user.name} đã gửi báo cáo hoạt động tuần.`);
      },
    });
  }

  function pageReportLT() {
    if (!['LOP_TRUONG', 'QLDT'].includes(role())) return denyAccess();
    const list = classesForUser();
    if (!list.length) { setPage('BC gửi CVHT', ''); $('#content').innerHTML = '<div class="empty">Chưa được gán lớp</div>'; return; }

    openCriteriaForm({
      title: 'Báo cáo Lớp trưởng — gửi CVHT',
      subtitle: 'Tổng hợp tình hình lớp theo môn',
      criteria: SEED.criteriaLT,
      kind: 'LOP_TRUONG',
      classes: list,
      submitStatus: 'SENT_TO_CVHT',
      submitLabel: 'Gửi Cố vấn học tập',
      extraField: { id: 'summaryNote', label: 'Ghi chú gửi CVHT', placeholder: 'Tóm tắt tình hình + đề xuất…' },
      onSubmitNotify: (report, cls) => {
        notify(cvhtNotifyIds(cls.cvhtId), `BC Lớp trưởng — ${cls.code} · ${subjectOf(cls)}`, `${user.name} đã gửi báo cáo tuần.`);
      },
    });
  }

  function pageReportNN() {
    if (!['LOP_TRUONG_NN', 'QLDT'].includes(role())) return denyAccess();
    const classList = classesForUser();
    if (!classList.length) { setPage('BC chuyên cần', ''); $('#content').innerHTML = '<div class="empty">Chưa được gán lớp Ngoại ngữ</div>'; return; }
    const range = Scoring.getWeekRange();
    const cd = Scoring.formatCountdown(Scoring.getWeekDeadline());
    const editingNn = state.editingReportId
      ? db().reports.find((x) => x.id === state.editingReportId && x.reportKind === 'LOP_TRUONG_NN' && x.status === 'DRAFT')
      : null;
    let selectedId = editingNn?.classId || classList[0].id;
    if (editingNn) state.nnAttachments = [...(editingNn.attachments || [])];

    const paint = () => {
      const cls = classList.find((c) => c.id === selectedId) || classList[0];
      const total = cls.studentCount || 25;
      const f = editingNn?.formData || {};
      setPage(editingNn ? 'Sửa bản nháp · BC chuyên cần NN' : 'Báo cáo chuyên cần NN', `${classLabel(cls)} · Gửi CVHT`);
      $('#content').innerHTML = `
        ${flowBanner()}
        ${editingNn ? `<div class="panel" style="margin-bottom:14px"><div class="panel-body" style="padding:12px 18px;font-size:.9rem;color:var(--muted)">Đang sửa bản <span class="badge badge-muted">Nháp</span>.</div></div>` : ''}
        <div class="panel" style="margin-bottom:14px"><div class="panel-body" style="padding:14px 18px">
          <div class="grid-2" style="gap:12px;align-items:end">
            <div class="field" style="margin:0">
              <label>Lớp · Môn báo cáo</label>
              <select id="nnClassSel" ${editingNn ? 'disabled' : ''}>${classList.map((c) =>
                `<option value="${c.id}" ${c.id === cls.id ? 'selected' : ''}>${esc(c.code)} — ${esc(subjectOf(c))}</option>`
              ).join('')}</select>
            </div>
            <div class="field" style="margin:0">
              <label>Môn của lớp</label>
              <input type="text" value="${escAttr(subjectOf(cls))}" disabled />
            </div>
          </div>
        </div></div>
        <div class="cta-hero" style="padding:18px 24px">
          <div>
            <h2>${esc(cls.code)} · ${esc(subjectOf(cls))}</h2>
            <p>${Scoring.fmtDate(range.start)} – ${Scoring.fmtDate(range.end)} · Hạn T6 23:00 · ${cd.text}</p>
          </div>
        </div>
        <div class="panel"><div class="panel-body">
          <div class="grid-2">
            <div class="field"><label>Sĩ số có mặt</label><input type="number" id="nnPresent" min="0" max="${total}" value="${f.present ?? (total - 2)}" /></div>
            <div class="field"><label>Tổng sĩ số lớp</label><input type="number" id="nnTotal" value="${f.total ?? total}" disabled /></div>
            <div class="field"><label>Vắng có phép</label><input type="number" id="nnExcused" min="0" value="${f.excused ?? 1}" /></div>
            <div class="field"><label>Vắng không phép</label><input type="number" id="nnUnexcused" min="0" value="${f.unexcused ?? 1}" /></div>
            <div class="field"><label>Nộp BTVN đúng hạn</label><input type="number" id="nnHw" min="0" max="${total}" value="${f.homeworkOk ?? (total - 3)}" /></div>
            <div class="field"><label>Số SV nguy cơ tuần này</label><input type="number" id="nnRisk" min="0" value="${f.riskCount ?? 1}" /></div>
          </div>
          <div class="field"><label>Danh sách / ghi chú SV nguy cơ</label>
            <textarea id="nnRiskNote" rows="2" placeholder="VD: Trần Quốc Bảo nghỉ 2 buổi, chưa nộp 3 BTVN…">${esc(f.riskNote || '')}</textarea></div>
          <div class="field"><label>Vấn đề phát sinh & đề xuất</label>
            <textarea id="nnIssues" rows="2" placeholder="Khó khăn lớp, đề xuất hỗ trợ…">${esc(f.issues || '')}</textarea></div>
          <div class="field"><label>Tóm tắt gửi CVHT</label>
            <textarea id="nnSummary" rows="2" placeholder="Tóm tắt tuần…">${esc(editingNn?.summaryNote || '')}</textarea></div>
          ${attachPanelHtml(state.nnAttachments || [])}
          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
            ${editingNn ? '<button type="button" class="btn btn-ghost" id="btnCancelNn">Hủy</button>' : ''}
            <button type="button" class="btn btn-ghost" id="btnDraftNn">Lưu nháp</button>
            <button type="button" class="btn btn-primary" id="btnSubmitNn">${editingNn ? 'Gửi đi' : 'Gửi CVHT'}</button>
          </div>
        </div></div>`;

      if (!editingNn) {
        $('#nnClassSel').onchange = () => { selectedId = $('#nnClassSel').value; state.nnAttachments = []; paint(); };
      }

      if (!state.nnAttachments) state.nnAttachments = [];
      const refreshNnAttach = () => {
        const panel = $('#attachPanel');
        if (!panel) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = attachPanelHtml(state.nnAttachments || []);
        panel.replaceWith(wrap.firstElementChild);
        bindAttachments(() => state.nnAttachments || [], (l) => { state.nnAttachments = l; }, refreshNnAttach);
      };
      bindAttachments(() => state.nnAttachments || [], (l) => { state.nnAttachments = l; }, refreshNnAttach);

      const save = (status) => {
        const formData = {
          present: Number($('#nnPresent').value) || 0,
          total: Number($('#nnTotal').value) || total,
          excused: Number($('#nnExcused').value) || 0,
          unexcused: Number($('#nnUnexcused').value) || 0,
          homeworkOk: Number($('#nnHw').value) || 0,
          riskCount: Number($('#nnRisk').value) || 0,
          riskNote: $('#nnRiskNote').value,
          issues: $('#nnIssues').value,
        };
        const now = new Date();
        const isLate = status !== 'DRAFT' && Scoring.isLate(now);
        const attachments = [...(state.nnAttachments || [])];
        const editId = state.editingReportId;
        let reportId = editId;
        Store.update((d) => {
          const existing = editId ? d.reports.find((x) => x.id === editId && x.status === 'DRAFT') : null;
          if (existing) {
            Object.assign(existing, {
              status, formData, isLate, attachments,
              summaryNote: $('#nnSummary').value,
              subject: subjectOf(cls),
              updatedAt: now.toISOString(),
              submittedAt: status !== 'DRAFT' ? now.toISOString() : null,
              recipientRole: 'CVHT',
            });
            reportId = existing.id;
          } else {
            reportId = Store.uid('rp');
            d.reports.unshift({
              id: reportId,
              classId: cls.id,
              subject: subjectOf(cls),
              reporterId: user.id,
              reportKind: 'LOP_TRUONG_NN',
              reportType: 'TUAN',
              weekStart: range.start.toISOString(),
              weekEnd: range.end.toISOString(),
              status,
              formData,
              totalScore: null,
              isLate,
              summaryNote: $('#nnSummary').value,
              attachments,
              createdAt: now.toISOString(),
              submittedAt: status !== 'DRAFT' ? now.toISOString() : null,
              recipientRole: 'CVHT',
            });
          }
          if (status !== 'DRAFT' && isLate) {
            const key = `${user.id}_${cls.id}`;
            d.lateCounts[key] = (d.lateCounts[key] || 0) + 1;
          }
          if (status !== 'DRAFT') {
            d.auditLog.unshift({
              id: Store.uid('al'), actorId: user.id, actorName: user.name,
              action: 'REPORT_SUBMIT', entity: 'Report', entityId: reportId,
              beforeJson: editId ? 'DRAFT' : '',
              afterJson: JSON.stringify({ kind: 'LOP_TRUONG_NN', classId: cls.id, subject: subjectOf(cls) }),
              at: now.toISOString(),
            });
          }
        });
        if (status !== 'DRAFT') {
          notify(cvhtNotifyIds(cls.cvhtId), `BC LT Ngoại ngữ — ${cls.code} · ${subjectOf(cls)}`, `${user.name} đã gửi báo cáo chuyên cần tuần.`);
          state.nnAttachments = [];
          state.editingReportId = null;
          toast(attachments.length ? `Đã gửi CVHT · ${attachments.length} đính kèm` : 'Đã gửi CVHT');
          navigate(`reports/${reportId}`);
        } else {
          state.editingReportId = null;
          toast('Đã lưu nháp');
          navigate('reports');
        }
      };
      $('#btnDraftNn').onclick = () => save('DRAFT');
      $('#btnSubmitNn').onclick = () => save('SENT_TO_CVHT');
      const btnCancelNn = $('#btnCancelNn');
      if (btnCancelNn) {
        btnCancelNn.onclick = () => {
          const back = editingNn?.id;
          state.editingReportId = null;
          state.nnAttachments = [];
          navigate(back ? `reports/${back}` : 'reports');
        };
      }
    };
    paint();
  }

  function pageReportCvht() {
    if (!['CVHT', 'QLDT'].includes(role())) return denyAccess();
    const classList = classesForUser();
    if (!classList.length) { setPage('BC tổng hợp', ''); $('#content').innerHTML = '<div class="empty">Chưa phụ trách lớp</div>'; return; }
    const range = Scoring.getWeekRange();
    const editingCvht = state.editingReportId
      ? db().reports.find((x) => x.id === state.editingReportId && x.reportKind === 'CVHT_TONG_HOP' && x.status === 'DRAFT')
      : null;
    let selectedId = editingCvht?.classId || classList[0].id;
    if (editingCvht) state.cvhtAttachments = [...(editingCvht.attachments || [])];

    const paint = () => {
      const cls = classList.find((c) => c.id === selectedId) || classList[0];
      const ltReports = db().reports.filter((r) =>
        r.classId === cls.id && ['BI_THU', 'LOP_TRUONG', 'LOP_TRUONG_NN'].includes(r.reportKind) && ['SENT_TO_CVHT', 'SEEN_BY_CVHT'].includes(r.status)
      );
      const visits = (db().visits || []).filter((v) => v.classId === cls.id).slice(0, 3);
      const f = editingCvht?.formData || {};

      setPage(editingCvht ? 'Sửa bản nháp · BC tổng hợp CVHT' : 'Báo cáo tổng hợp CVHT', `${classLabel(cls)} · Gửi QLĐT`);
      $('#content').innerHTML = `
        ${flowBanner()}
        ${editingCvht ? `<div class="panel" style="margin-bottom:14px"><div class="panel-body" style="padding:12px 18px;font-size:.9rem;color:var(--muted)">Đang sửa bản <span class="badge badge-muted">Nháp</span>.</div></div>` : ''}
        <div class="panel" style="margin-bottom:14px"><div class="panel-body" style="padding:14px 18px">
          <div class="grid-2" style="gap:12px;align-items:end">
            <div class="field" style="margin:0">
              <label>Lớp · Môn báo cáo</label>
              <select id="cvhtClassSel" ${editingCvht ? 'disabled' : ''}>${classList.map((c) =>
                `<option value="${c.id}" ${c.id === cls.id ? 'selected' : ''}>${esc(c.code)} — ${esc(subjectOf(c))}</option>`
              ).join('')}</select>
            </div>
            <div class="field" style="margin:0">
              <label>Môn của lớp</label>
              <input type="text" value="${escAttr(subjectOf(cls))}" disabled />
            </div>
          </div>
        </div></div>
        <div class="cta-hero" style="padding:18px 24px">
          <div>
            <h2>Tổng hợp · ${esc(cls.code)} · ${esc(subjectOf(cls))}</h2>
            <p>Tuần ${Scoring.fmtDate(range.start)} – ${Scoring.fmtDate(range.end)} · Gửi Bộ phận Quản lý đào tạo.</p>
          </div>
        </div>
        ${ltReports.length ? `<div class="panel"><div class="panel-head"><h2>BC Bí thư / Lớp trưởng tham chiếu</h2></div>
          <div class="panel-body">${ltReports.map((r) => `
            <label class="check-row">
              <input type="checkbox" data-link="${r.id}" checked />
              <span>${userName(r.reporterId)} · ${REPORT_KIND_LABELS[r.reportKind] || ''} · ${r.totalScore != null ? r.totalScore + '/100' : 'NN'} · ${statusBadge(r)}
              <div style="font-size:12px;color:var(--muted)">${esc(r.summaryNote || r.activityNote || '')}</div></span>
            </label>`).join('')}</div></div>` : ''}
        ${visits.length ? `<div class="panel"><div class="panel-head"><h2>Buổi vào lớp gần đây</h2></div>
          <div class="panel-body" style="font-size:.9rem">${visits.map((v) => `
            <div style="padding:8px 0;border-bottom:1px solid var(--line-soft)">
              <strong>${Scoring.fmtDate(v.visitDate)}</strong>
              <div style="color:var(--muted);margin-top:4px">${esc(v.observation)}</div>
            </div>`).join('')}</div></div>` : ''}
        <div class="panel"><div class="panel-body">
          <div class="field"><label>Không khí / tình hình lớp</label>
            <input id="classMood" placeholder="VD: Ổn định, chuyên cần tốt…" value="${escAttr(f.classMood || 'Ổn định')}" /></div>
          <div class="field"><label>Tóm tắt SV nguy cơ</label>
            <textarea id="riskSummary" rows="2" placeholder="Số case, đã xử lý…">${esc(f.riskSummary || '')}</textarea></div>
          <div class="field"><label>Nhận xét & đề xuất gửi QLĐT</label>
            <textarea id="recommendation" rows="3" placeholder="Đề xuất can thiệp, khen thưởng, hỗ trợ…">${esc(f.recommendation || '')}</textarea></div>
          <div class="field"><label>Ghi chú tổng hợp</label>
            <textarea id="summaryNote" rows="2">${esc(editingCvht?.summaryNote || '')}</textarea></div>
          ${attachPanelHtml(state.cvhtAttachments || [])}
          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
            ${editingCvht ? '<button type="button" class="btn btn-ghost" id="btnCancelCvht">Hủy</button>' : ''}
            <button type="button" class="btn btn-ghost" id="btnDraftCvht">Lưu nháp</button>
            <button type="button" class="btn btn-primary" id="btnSubmitCvht">${editingCvht ? 'Gửi đi' : 'Gửi QLĐT'}</button>
          </div>
        </div></div>`;

      if (!editingCvht) {
        $('#cvhtClassSel').onchange = () => { selectedId = $('#cvhtClassSel').value; state.cvhtAttachments = []; paint(); };
      }

      if (!state.cvhtAttachments) state.cvhtAttachments = [];
      const refreshCvhtAttach = () => {
        const panel = $('#attachPanel');
        if (!panel) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = attachPanelHtml(state.cvhtAttachments || []);
        panel.replaceWith(wrap.firstElementChild);
        bindAttachments(() => state.cvhtAttachments || [], (l) => { state.cvhtAttachments = l; }, refreshCvhtAttach);
      };
      bindAttachments(() => state.cvhtAttachments || [], (l) => { state.cvhtAttachments = l; }, refreshCvhtAttach);

      const save = (status) => {
        const linkedReportIds = $$('[data-link]:checked').map((el) => el.dataset.link);
        const attachments = [...(state.cvhtAttachments || [])];
        const formData = {
          visitDone: visits.length > 0,
          classMood: $('#classMood').value,
          riskSummary: $('#riskSummary').value,
          recommendation: $('#recommendation').value,
        };
        const now = new Date().toISOString();
        const editId = editingCvht?.id || null;
        let reportId = editId;
        Store.update((d) => {
          const existing = editId ? d.reports.find((x) => x.id === editId && x.status === 'DRAFT') : null;
          if (existing) {
            Object.assign(existing, {
              status, formData, linkedReportIds, attachments,
              summaryNote: $('#summaryNote').value,
              subject: subjectOf(cls),
              updatedAt: now,
              submittedAt: status === 'SENT_TO_QLDT' ? now : null,
              recipientRole: 'QLDT',
            });
            reportId = existing.id;
          } else {
            reportId = Store.uid('rp');
            d.reports.unshift({
              id: reportId,
              classId: cls.id,
              subject: subjectOf(cls),
              reporterId: Store.realId(user),
              reportKind: 'CVHT_TONG_HOP',
              reportType: 'TUAN',
              weekStart: range.start.toISOString(),
              weekEnd: range.end.toISOString(),
              status,
              formData,
              totalScore: null,
              isLate: false,
              linkedReportIds,
              summaryNote: $('#summaryNote').value,
              attachments,
              createdAt: now,
              submittedAt: status === 'SENT_TO_QLDT' ? now : null,
              recipientRole: 'QLDT',
            });
          }
          if (status === 'SENT_TO_QLDT') {
            linkedReportIds.forEach((lid) => {
              const item = d.reports.find((x) => x.id === lid);
              if (item && item.status === 'SENT_TO_CVHT') item.status = 'SEEN_BY_CVHT';
            });
            d.auditLog.unshift({
              id: Store.uid('al'), actorId: user.id, actorName: user.name,
              action: 'REPORT_SUBMIT', entity: 'Report', entityId: reportId,
              beforeJson: editId ? 'DRAFT' : '',
              afterJson: JSON.stringify({ kind: 'CVHT_TONG_HOP', classId: cls.id, subject: subjectOf(cls) }),
              at: now,
            });
          }
        });
        if (status === 'SENT_TO_QLDT') {
          notify(['u_admin'], `BC tổng hợp CVHT — ${cls.code} · ${subjectOf(cls)}`, `${user.name} đã gửi báo cáo tổng hợp tuần.`);
          state.cvhtAttachments = [];
          state.editingReportId = null;
          toast(attachments.length ? `Đã gửi QLĐT · ${attachments.length} đính kèm` : 'Đã gửi QLĐT');
          navigate(`reports/${reportId}`);
        } else {
          state.editingReportId = null;
          toast('Đã lưu nháp');
          navigate('reports');
        }
      };
      $('#btnDraftCvht').onclick = () => save('DRAFT');
      $('#btnSubmitCvht').onclick = () => save('SENT_TO_QLDT');
      const btnCancelCvht = $('#btnCancelCvht');
      if (btnCancelCvht) {
        btnCancelCvht.onclick = () => {
          const back = editingCvht?.id;
          state.editingReportId = null;
          state.cvhtAttachments = [];
          navigate(back ? `reports/${back}` : 'reports');
        };
      }
    };
    paint();
  }

  function openCriteriaForm(opts) {
    const {
      title, subtitle, criteria, kind, classes: classList, submitStatus, submitLabel,
      extraField, prependForClass, collectExtra, onSubmitNotify,
    } = opts;
    const range = Scoring.getWeekRange();
    const cd = Scoring.formatCountdown(Scoring.getWeekDeadline());

    let selectedId = state.reportDraft?.kind === kind && classList.some((c) => c.id === state.reportDraft.classId)
      ? state.reportDraft.classId
      : classList[0].id;

    const editing = state.editingReportId
      ? db().reports.find((x) => x.id === state.editingReportId && x.reportKind === kind && x.status === 'DRAFT')
      : null;
    if (editing) selectedId = editing.classId;

    const getCls = () => classList.find((c) => c.id === selectedId) || classList[0];

    const syncSelectionFromDraft = () => {
      const cls = getCls();
      const prog = Curriculum.programForClass(cls.code);
      if (!state.reportDraft || state.reportDraft.kind !== kind) return;
      const preferred = state.reportDraft.semesterId || cls.semester || prog?.semesters?.[0]?.semesterId || '';
      state.reportDraft.semesterId = preferred;
      const cur = Curriculum.forClass(cls.code, preferred);
      if (!state.reportDraft.subjectCode) {
        state.reportDraft.subjectCode = cls.subjectCode || cur?.subjects?.[0]?.code || '';
      }
    };

    const getSel = () => {
      syncSelectionFromDraft();
      const cls = getCls();
      const semesterId = state.reportDraft?.semesterId || cls.semester || '';
      const cur = Curriculum.forClass(cls.code, semesterId);
      let subjectCode = state.reportDraft?.subjectCode || cls.subjectCode || cur?.subjects?.[0]?.code || '';
      const subj = cur
        ? (Curriculum.subjectByCode(cls.code, subjectCode, semesterId) || cur.subjects.find((s) => s.code === subjectCode) || cur.subjects[0])
        : { code: subjectCode, name: cls.subject || '—' };
      if (subj && !subjectCode) subjectCode = subj.code;
      return {
        cls,
        cur,
        semesterId: cur?.semesterId || semesterId,
        subjectCode: subj?.code || subjectCode,
        subject: subj || { code: subjectCode, name: cls.subject || '—' },
      };
    };

    const ensureDraft = () => {
      const cls = getCls();
      const sel = getSel();
      const late = lateCountFor(user.id, cls.id);
      if (editing && (!state.reportDraft || state.reportDraft.kind !== kind || state.reportDraft.fromId !== editing.id)) {
        const formData = {};
        criteria.forEach((c) => {
          const fd = editing.formData?.[c.id];
          formData[c.id] = {
            value: c.type === 'late_count' ? late : (fd?.value ?? 100),
            note: fd?.note || '',
          };
        });
        const ctx = Curriculum.resolveReportContext(editing, cls);
        state.reportDraft = {
          kind, classId: editing.classId, fromId: editing.id,
          semesterId: ctx.semesterId,
          subjectCode: ctx.subjectCode,
          formData,
          extra: editing.activityNote || editing.summaryNote || '',
          attachments: [...(editing.attachments || [])],
        };
        selectedId = editing.classId;
      } else if (!state.reportDraft || state.reportDraft.kind !== kind || state.reportDraft.classId !== cls.id) {
        state.reportDraft = {
          kind, classId: cls.id, fromId: state.reportDraft?.fromId || null,
          semesterId: sel.semesterId,
          subjectCode: sel.subjectCode,
          formData: Object.fromEntries(criteria.map((c) => [c.id, { value: c.type === 'late_count' ? late : 100, note: '' }])),
          extra: '',
          attachments: [],
        };
      }
      if (!state.reportDraft.attachments) state.reportDraft.attachments = [];
    };

    const refreshScores = () => {
      const cls = getCls();
      const sel = getSel();
      const late = lateCountFor(user.id, cls.id);
      const formData = state.reportDraft.formData;
      criteria.forEach((c) => {
        const val = c.type === 'late_count' ? late : (formData[c.id]?.value ?? 0);
        const pts = Scoring.scoreCriterion(c, val, late);
        const el = $(`#pts-${c.id}`);
        if (el) el.textContent = `${pts}/${c.max}`;
      });
      const total = Scoring.total(criteria, formData, late);
      const totalEl = $('#totalScore');
      if (totalEl) totalEl.innerHTML = `${total} <small>/ 100</small>`;
      const ring = $('#scoreRing');
      if (ring) {
        ring.style.setProperty('--p', `${total}%`);
        const span = ring.querySelector('span');
        if (span) span.textContent = total;
      }
      const sumEl = $('#scoreSummary');
      if (sumEl) sumEl.innerHTML = renderScoreSummaryHtml(sel, kind, total);
    };

    const paint = () => {
      ensureDraft();
      const sel = getSel();
      const cls = sel.cls;
      const late = lateCountFor(user.id, cls.id);
      const formData = state.reportDraft.formData;
      const total = Scoring.total(criteria, formData, late);
      const prependHtml = prependForClass ? prependForClass(cls) : '';
      const subjectOptions = sel.cur?.subjects?.length
        ? sel.cur.subjects.map((s) =>
          `<option value="${escAttr(s.code)}" ${s.code === sel.subjectCode ? 'selected' : ''}>${esc(s.name)} (${esc(s.code)})</option>`).join('')
        : `<option value="${escAttr(sel.subjectCode)}">${esc(sel.subject.name)}</option>`;
      const semesterOptions = (sel.cur?.semesters || []).length
        ? sel.cur.semesters.map((s) =>
          `<option value="${escAttr(s.semesterId)}" ${s.semesterId === sel.semesterId ? 'selected' : ''}>${esc(s.label || Curriculum.semesterLabel(s.semesterId))}</option>`).join('')
        : `<option value="${escAttr(sel.semesterId)}">${esc(Curriculum.semesterLabel(sel.semesterId))}</option>`;

      setPage(editing ? `Sửa bản nháp · ${title}` : title, `${classLabel(cls)} · ${sel.subject.name}`);
      $('#content').innerHTML = `
        ${flowBanner()}
        ${Curriculum.leadershipPolicyHtml()}
        ${editing ? `<div class="panel" style="margin-bottom:14px"><div class="panel-body" style="padding:12px 18px;font-size:.9rem;color:var(--muted)">
          Đang chỉnh sửa bản <span class="badge badge-muted">Nháp</span> — lưu lại hoặc gửi đi khi đã ổn.
        </div></div>` : ''}
        <div class="panel report-context-panel"><div class="panel-body" style="padding:14px 18px">
          <div class="grid-3" style="gap:12px;align-items:end">
            <div class="field" style="margin:0">
              <label>Lớp${sel.cur?.cohortLabel ? ` · ${esc(sel.cur.cohortLabel)}` : ''}</label>
              <select id="reportClassSel" ${editing ? 'disabled' : ''}>${classList.map((c) =>
                `<option value="${c.id}" ${c.id === cls.id ? 'selected' : ''}>${esc(c.code)}</option>`
              ).join('')}</select>
            </div>
            <div class="field" style="margin:0">
              <label>Học kỳ (theo khóa)</label>
              <select id="reportSemesterSel" ${editing || !(sel.cur?.semesters?.length) ? 'disabled' : ''}>${semesterOptions}</select>
            </div>
            <div class="field" style="margin:0">
              <label>Môn học</label>
              <select id="reportSubjectSel" ${editing ? 'disabled' : ''}>${subjectOptions}</select>
            </div>
          </div>
        </div></div>
        <div class="cta-hero" style="padding:18px 24px">
          <div>
            <h2>${esc(cls.code)} · ${esc(sel.subject.name)}</h2>
            <p>${esc(sel.cur?.cohortLabel || '')}${sel.cur?.cohortLabel ? ' · ' : ''}${esc(Curriculum.semesterLabel(sel.semesterId))} · ${Scoring.fmtDate(range.start)} – ${Scoring.fmtDate(range.end)} · ${esc(subtitle)} · Hạn T6 23:00 · ${cd.text}</p>
          </div>
          <div class="score-ring" id="scoreRing" style="--p:${total}%"><span>${total}</span></div>
        </div>
        <div id="scoreSummary">${renderScoreSummaryHtml(sel, kind, total)}</div>
        ${prependHtml || ''}
        ${criteria.map((c, i) => {
          const fd = formData[c.id] || { value: 0, note: '' };
          const pts = Scoring.scoreCriterion(c, c.type === 'late_count' ? late : fd.value, late);
          return `<div class="criterion" style="animation-delay:${i * 0.04}s">
            <div class="criterion-head">
              <div><h3>${c.id}. ${c.title}</h3>
                <div style="font-size:12.5px;color:var(--muted);margin-top:3px">${c.desc}</div></div>
              <div class="max">Max ${c.max}đ</div>
            </div>
            <div class="criterion-grid">
              ${c.type === 'late_count' ? `
                <div class="field" style="margin:0"><label>Số lần trễ</label><input type="number" value="${late}" disabled /></div>
                <div class="field" style="margin:0"><label>Ghi chú</label><input value="Tự động từ lịch sử" disabled /></div>
              ` : `
                <div class="field" style="margin:0"><label>% hoàn thành</label>
                  <input type="number" min="0" max="100" data-cid="${c.id}" data-field="value" value="${fd.value}" /></div>
                <div class="field" style="margin:0"><label>Ghi chú</label>
                  <input type="text" data-cid="${c.id}" data-field="note" value="${escAttr(fd.note)}" /></div>
              `}
              <div class="score-preview" id="pts-${c.id}">${pts}/${c.max}</div>
            </div>
          </div>`;
        }).join('')}
        ${extraField ? `<div class="panel"><div class="panel-body">
          <div class="field"><label>${extraField.label}</label>
            <textarea id="extraField" rows="3" placeholder="${escAttr(extraField.placeholder || '')}">${esc(state.reportDraft.extra || '')}</textarea>
          </div>
          ${attachPanelHtml(state.reportDraft.attachments || [])}
        </div></div>` : `<div class="panel"><div class="panel-body">${attachPanelHtml(state.reportDraft.attachments || [])}</div></div>`}
        <div class="form-sticky">
          <div>
            <div style="font-size:11.5px;color:var(--muted)">Tuần này · ${esc(sel.subject.code)}</div>
            <div class="total-score" id="totalScore">${total} <small>/ 100</small></div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn btn-ghost" id="btnCancelEdit" ${editing ? '' : 'hidden'}>Hủy</button>
            <button type="button" class="btn btn-ghost" id="btnDraft">${editing ? 'Lưu nháp' : 'Lưu nháp'}</button>
            <button type="button" class="btn btn-primary" id="btnSubmit">${editing ? 'Gửi đi' : submitLabel}</button>
          </div>
        </div>`;

      const subjSel = $('#reportSubjectSel');
      if (subjSel) {
        subjSel.onchange = () => {
          state.reportDraft.subjectCode = subjSel.value;
          refreshScores();
        };
      }

      const semSel = $('#reportSemesterSel');
      if (semSel && !semSel.disabled) {
        semSel.onchange = () => {
          state.reportDraft.semesterId = semSel.value;
          const cur = Curriculum.forClass(getCls().code, semSel.value);
          state.reportDraft.subjectCode = cur?.subjects?.[0]?.code || '';
          paint();
        };
      }

      const selEl = $('#reportClassSel');
      if (selEl) {
        selEl.onchange = () => {
          if ($('#extraField')) state.reportDraft.extra = $('#extraField').value;
          selectedId = selEl.value;
          state.reportDraft = null;
          paint();
        };
      }

      $$('[data-cid]').forEach((input) => {
        input.addEventListener('input', () => {
          const cid = input.dataset.cid;
          if (!state.reportDraft.formData[cid]) state.reportDraft.formData[cid] = { value: 0, note: '' };
          if (input.dataset.field === 'value') {
            state.reportDraft.formData[cid].value = Number(input.value) || 0;
            refreshScores();
          } else {
            state.reportDraft.formData[cid].note = input.value;
          }
        });
      });

      const extraEl = $('#extraField');
      if (extraEl) {
        extraEl.addEventListener('input', () => { state.reportDraft.extra = extraEl.value; });
      }

      const refreshAttachOnly = () => {
        const panel = $('#attachPanel');
        if (!panel) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = attachPanelHtml(state.reportDraft.attachments || []);
        panel.replaceWith(wrap.firstElementChild);
        bindAttachments(
          () => state.reportDraft.attachments || [],
          (list) => { state.reportDraft.attachments = list; },
          refreshAttachOnly,
        );
      };
      bindAttachments(
        () => state.reportDraft.attachments || [],
        (list) => { state.reportDraft.attachments = list; },
        refreshAttachOnly,
      );

      const persist = (status) => {
        const current = getCls();
        const sel = getSel();
        const ctx = reportContextFields(sel);
        const lateNow = lateCountFor(user.id, current.id);
        if ($('#extraField')) state.reportDraft.extra = $('#extraField').value;
        const scored = {};
        criteria.forEach((c) => {
          const val = c.type === 'late_count' ? lateNow : (state.reportDraft.formData[c.id]?.value ?? 0);
          scored[c.id] = {
            value: val,
            note: state.reportDraft.formData[c.id]?.note || '',
            point: Scoring.scoreCriterion(c, val, lateNow),
          };
        });
        const totalScore = Object.values(scored).reduce((s, x) => s + x.point, 0);
        const now = new Date();
        const isLate = status !== 'DRAFT' && Scoring.isLate(now);
        const extra = collectExtra ? collectExtra() : {};
        const extraVal = state.reportDraft.extra || '';
        const attachments = [...(state.reportDraft.attachments || [])];
        const editId = editing?.id || null;

        let reportId = editId;
        Store.update((d) => {
          const existing = editId ? d.reports.find((x) => x.id === editId && x.status === 'DRAFT') : null;
          if (existing) {
            existing.classId = current.id;
            Object.assign(existing, ctx);
            existing.status = status;
            existing.formData = scored;
            existing.totalScore = totalScore;
            existing.isLate = isLate;
            existing.activityNote = kind === 'BI_THU' ? extraVal : undefined;
            existing.summaryNote = kind === 'LOP_TRUONG' ? extraVal : undefined;
            existing.linkedReportIds = extra.linkedReportIds || [];
            existing.attachments = attachments;
            existing.updatedAt = now.toISOString();
            existing.submittedAt = status !== 'DRAFT' ? now.toISOString() : null;
            existing.recipientRole = status === 'SENT_TO_CVHT' ? 'CVHT' : null;
            reportId = existing.id;
          } else {
            reportId = Store.uid('rp');
            d.reports.unshift({
              id: reportId,
              classId: current.id,
              ...ctx,
              reporterId: user.id,
              reportKind: kind,
              reportType: 'TUAN',
              weekStart: range.start.toISOString(),
              weekEnd: range.end.toISOString(),
              status,
              formData: scored,
              totalScore,
              isLate,
              activityNote: kind === 'BI_THU' ? extraVal : undefined,
              summaryNote: kind === 'LOP_TRUONG' ? extraVal : undefined,
              linkedReportIds: extra.linkedReportIds || [],
              attachments,
              createdAt: now.toISOString(),
              submittedAt: status !== 'DRAFT' ? now.toISOString() : null,
              recipientRole: status === 'SENT_TO_CVHT' ? 'CVHT' : null,
            });
          }
          if (status !== 'DRAFT' && isLate) {
            const key = `${user.id}_${current.id}`;
            d.lateCounts[key] = (d.lateCounts[key] || 0) + 1;
          }
          if (status !== 'DRAFT') {
            d.auditLog.unshift({
              id: Store.uid('al'), actorId: user.id, actorName: user.name,
              action: 'REPORT_SUBMIT', entity: 'Report', entityId: reportId,
              beforeJson: editId ? 'DRAFT' : '',
              afterJson: JSON.stringify({ kind, status, totalScore, classId: current.id, ...ctx }),
              at: now.toISOString(),
            });
          }
        });

        const report = db().reports.find((x) => x.id === reportId);
        if (status !== 'DRAFT' && onSubmitNotify && report) onSubmitNotify(report, current);
        state.reportDraft = null;
        state.editingReportId = null;
        toast(status === 'DRAFT' ? 'Đã lưu nháp' : `Đã gửi · ${totalScore}/100 · ${ctx.subjectName}${attachments.length ? ` · ${attachments.length} đính kèm` : ''}`);
        navigate(status === 'DRAFT' ? 'reports' : `reports/${reportId}`);
      };

      $('#btnDraft').onclick = () => persist('DRAFT');
      $('#btnSubmit').onclick = () => persist(submitStatus);
      const btnCancel = $('#btnCancelEdit');
      if (btnCancel) {
        btnCancel.onclick = () => {
          const backId = editing?.id;
          state.editingReportId = null;
          state.reportDraft = null;
          navigate(backId ? `reports/${backId}` : 'reports');
        };
      }
    };

    paint();
  }

  /* ========== INBOX ========== */
  function pageInbox() {
    const list = pendingForRole().sort((a, b) => (b.submittedAt || b.createdAt).localeCompare(a.submittedAt || a.createdAt));
    const titles = {
      CVHT: 'Nhận báo cáo — Bí thư / LT (CN + NN)',
      QLDT: 'Nhận báo cáo — BC tổng hợp từ CVHT',
    };
    setPage(titles[role()] || 'Nhận báo cáo', `${list.length} mục`);
    $('#content').innerHTML = `
      ${flowBanner()}
      <div class="panel"><div class="table-wrap"><table>
        <thead><tr><th>Lớp</th><th>Môn</th><th>Loại</th><th>Người gửi</th><th>Điểm</th><th>Thời gian</th><th></th></tr></thead>
        <tbody>${list.length ? list.map((r) => `
          <tr>
            <td><strong>${classById(r.classId)?.code}</strong></td>
            <td style="font-size:12.5px">${esc(r.subject || subjectOf(classById(r.classId)))}</td>
            <td style="font-size:12.5px">${REPORT_KIND_LABELS[r.reportKind] || r.reportKind}</td>
            <td>${userName(r.reporterId)}</td>
            <td>${r.totalScore ?? '—'}</td>
            <td style="font-size:12px">${Scoring.fmtDateTime(r.submittedAt || r.createdAt)}</td>
            <td><button class="btn btn-primary btn-sm" onclick="App.go('reports/${r.id}')">Xử lý</button></td>
          </tr>`).join('') : '<tr><td colspan="7"><div class="empty">Chưa có báo cáo chờ nhận</div></td></tr>'}
        </tbody>
      </table></div></div>`;
  }

  /* ========== REPORTS LIST / DETAIL ========== */
  function reportsForViewer() {
    const ids = new Set(classesForUser().map((c) => c.id));
    const all = db().reports || [];
    const r = role();
    if (r === 'BI_THU') {
      return all.filter((x) => x.reportKind === 'BI_THU' && (x.reporterId === user.id || x.reporterId === real()));
    }
    if (r === 'LOP_TRUONG') {
      return all.filter((x) => x.reportKind === 'LOP_TRUONG' && (x.reporterId === user.id || x.reporterId === real()));
    }
    if (r === 'LOP_TRUONG_NN') {
      return all.filter((x) => x.reportKind === 'LOP_TRUONG_NN' && (x.reporterId === user.id || x.reporterId === real()));
    }
    if (r === 'CVHT') {
      return all.filter((x) => ids.has(x.classId) && ['BI_THU', 'LOP_TRUONG', 'LOP_TRUONG_NN', 'CVHT_TONG_HOP'].includes(x.reportKind));
    }
    // QLĐT — full
    return [...all];
  }

  function kindShort(kind) {
    return {
      BI_THU: { label: 'Bí thư', cls: 'kind-bt' },
      LOP_TRUONG: { label: 'LT (CN)', cls: 'kind-lt' },
      LOP_TRUONG_NN: { label: 'LT (NN)', cls: 'kind-nn' },
      CVHT_TONG_HOP: { label: 'CVHT tổng hợp', cls: 'kind-cvht' },
    }[kind] || { label: kind, cls: '' };
  }

  function pageReports() {
    if (routeParams.id) return pageReportDetail(routeParams.id);

    let reports = reportsForViewer().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const filterKind = state.reportFilterKind || '';
    const filterStatus = state.reportFilterStatus || '';
    const filterClass = state.reportFilterClass || '';
    const filterSemester = state.reportFilterSemester || '';
    const filterSubject = state.reportFilterSubject || '';
    const filterQ = state.reportFilterQ || '';
    const filterFrom = state.reportFilterFrom || '';
    const filterTo = state.reportFilterTo || '';
    if (filterKind) reports = reports.filter((r) => r.reportKind === filterKind);
    if (filterStatus) reports = reports.filter((r) => r.status === filterStatus);
    if (filterClass) reports = reports.filter((r) => r.classId === filterClass);
    if (filterSemester) reports = reports.filter((r) => {
      const ctx = Curriculum.resolveReportContext(r, classById(r.classId));
      return ctx.semesterId === filterSemester;
    });
    if (filterSubject) reports = reports.filter((r) => {
      const ctx = Curriculum.resolveReportContext(r, classById(r.classId));
      return ctx.subjectCode === filterSubject;
    });
    reports = reports.filter((r) => {
      const at = r.submittedAt || r.createdAt;
      if (!inDateRange(at, filterFrom, filterTo)) return false;
      if (!filterQ) return true;
      const cls = classById(r.classId);
      const ctx = Curriculum.resolveReportContext(r, cls);
      const note = r.summaryNote || r.activityNote || '';
      return textMatch([
        cls?.code, userName(r.reporterId), note, ctx.subjectName, ctx.subjectCode,
        kindShort(r.reportKind).label, STATUS_LABELS[r.status]?.label,
      ].join(' '), filterQ);
    });

    const scopeClasses = classesForUser().filter((c) => c.programType !== 'NGOAI_NGU' || role() === 'QLDT' || role() === 'CVHT');
    const semesterOpts = [...new Set(scopeClasses.flatMap((c) => {
      const prog = Curriculum.programForClass(c.code);
      return (prog?.semesters || []).map((s) => s.semesterId).concat(c.semester || []).filter(Boolean);
    }))];
    const subjectOpts = [];
    scopeClasses.forEach((c) => {
      const prog = Curriculum.programForClass(c.code);
      if (!prog) return;
      (prog.semesters || []).forEach((sem) => {
        if (filterSemester && sem.semesterId !== filterSemester) return;
        (sem.subjects || []).forEach((s) => {
          if (!subjectOpts.some((x) => x.code === s.code)) subjectOpts.push(s);
        });
      });
    });

    const r = role();
    const titles = {
      BI_THU: ['Lịch sử báo cáo của tôi', 'Chỉ báo cáo Bí thư do bạn gửi'],
      LOP_TRUONG: ['Lịch sử báo cáo của tôi', 'Chỉ báo cáo Lớp trưởng do bạn gửi'],
      LOP_TRUONG_NN: ['Lịch sử báo cáo của tôi', 'Chỉ báo cáo LT Ngoại ngữ do bạn gửi'],
      CVHT: ['Báo cáo lớp phụ trách', 'Bí thư + Lớp trưởng (CN/NN) + BC tổng hợp của bạn'],
      QLDT: ['Toàn bộ báo cáo', 'Xem full mọi vai trò · mọi lớp'],
    };
    const [title, sub] = titles[r] || ['Lịch sử báo cáo', `${reports.length} báo cáo`];
    setPage(title, `${reports.length} báo cáo · Lọc theo tên / lớp / ngày`);

    const showKindFilter = r === 'CVHT' || r === 'QLDT';
    const kindOpts = r === 'CVHT'
      ? [['', 'Tất cả loại'], ['BI_THU', 'Bí thư'], ['LOP_TRUONG', 'LT (CN)'], ['LOP_TRUONG_NN', 'LT (NN)'], ['CVHT_TONG_HOP', 'Tổng hợp CVHT']]
      : [['', 'Tất cả loại'], ['BI_THU', 'Bí thư'], ['LOP_TRUONG', 'LT (CN)'], ['LOP_TRUONG_NN', 'LT (NN)'], ['CVHT_TONG_HOP', 'Tổng hợp CVHT']];

    const statusOpts = [
      ['', 'Tất cả trạng thái'],
      ['DRAFT', 'Nháp'],
      ['SENT_TO_CVHT', 'Đã gửi CVHT'],
      ['SEEN_BY_CVHT', 'CVHT đã xử lý'],
      ['SENT_TO_QLDT', 'Đã gửi QLĐT'],
      ['SEEN_BY_QLDT', 'QLĐT đã nắm'],
    ];

    const counts = {
      draft: reportsForViewer().filter((x) => x.status === 'DRAFT').length,
      sent: reportsForViewer().filter((x) => x.status === 'SENT_TO_CVHT' || x.status === 'SENT_TO_QLDT').length,
      done: reportsForViewer().filter((x) => x.status === 'SEEN_BY_CVHT' || x.status === 'SEEN_BY_QLDT').length,
    };

    $('#content').innerHTML = `
      ${flowBanner()}
      <div class="report-scope">${esc(sub)}</div>
      <div class="report-stats">
        <div class="report-stat"><span class="n">${counts.draft}</span><span class="l">Nháp</span></div>
        <div class="report-stat"><span class="n">${counts.sent}</span><span class="l">Đã gửi</span></div>
        <div class="report-stat"><span class="n">${counts.done}</span><span class="l">Đã tiếp nhận</span></div>
        <div class="report-stat"><span class="n">${reportsForViewer().length}</span><span class="l">Tổng</span></div>
      </div>
      <div class="filters report-filters report-filters-wide trace-bar" style="margin-bottom:12px">
        <input type="search" id="fQ" class="trace-q" placeholder="Tìm lớp, người gửi, môn, nội dung…" value="${escAttr(filterQ)}" />
        <select id="fClass"><option value="">Tất cả lớp</option>${scopeClasses.map((c) =>
          `<option value="${c.id}" ${filterClass === c.id ? 'selected' : ''}>${esc(c.code)}</option>`).join('')}</select>
        <label class="trace-date"><span>Từ ngày</span><input type="date" id="fFrom" value="${escAttr(filterFrom)}" /></label>
        <label class="trace-date"><span>Đến ngày</span><input type="date" id="fTo" value="${escAttr(filterTo)}" /></label>
        <select id="fSemester"><option value="">Tất cả học kỳ</option>${semesterOpts.map((s) =>
          `<option value="${s}" ${filterSemester === s ? 'selected' : ''}>${esc(Curriculum.semesterLabel(s))}</option>`).join('')}</select>
        <select id="fSubject"><option value="">Tất cả môn</option>${subjectOpts.map((s) =>
          `<option value="${s.code}" ${filterSubject === s.code ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
        ${showKindFilter ? `<select id="fKind">${kindOpts.map(([v, l]) =>
          `<option value="${v}" ${filterKind === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
        <select id="fStatus">${statusOpts.map(([v, l]) =>
          `<option value="${v}" ${filterStatus === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button type="button" class="btn btn-ghost btn-sm" id="fClear">Xóa lọc</button>
        <span class="trace-result">${reports.length} kết quả</span>
      </div>
      <div class="report-list">
        ${reports.length ? reports.map((rep) => {
          const cls = classById(rep.classId);
          const k = kindShort(rep.reportKind);
          const when = Scoring.fmtDateTime(rep.submittedAt || rep.createdAt);
          const note = rep.summaryNote || rep.activityNote || '';
          const ctx = Curriculum.resolveReportContext(rep, cls);
          const subLine = `${ctx.subjectName}${ctx.subjectCode ? ` (${ctx.subjectCode})` : ''}`;
          return `<article class="report-card ${k.cls}">
            <div class="report-card-top">
              <div class="report-card-title">
                <span class="kind-pill ${k.cls}">${k.label}</span>
                ${statusBadge(rep)}
                ${rep.attachments?.length ? `<span class="badge badge-muted">📎 ${rep.attachments.length}</span>` : ''}
              </div>
              <div class="report-card-score">${rep.totalScore != null ? `<strong>${rep.totalScore}</strong><small>/100</small>` : '<span class="muted">—</span>'}</div>
            </div>
            <div class="report-card-main">
              <div class="report-card-class"><strong>${esc(cls?.code || '—')}</strong> · ${esc(subLine)}</div>
              <div class="report-card-meta">${esc(Curriculum.semesterLabel(ctx.semesterId))} · ${esc(userName(rep.reporterId))} · ${when}</div>
              ${note ? `<p class="report-card-note">${esc(note.slice(0, 140))}${note.length > 140 ? '…' : ''}</p>` : ''}
            </div>
            <div class="report-card-actions">
              <button class="btn btn-ghost btn-sm" onclick="App.go('reports/${rep.id}')">Xem chi tiết</button>
              ${canEditDraft(rep) ? `<button class="btn btn-primary btn-sm" onclick="App.editDraft('${rep.id}')">Sửa</button>` : ''}
              ${canEditDraft(rep) ? `<button class="btn btn-ok btn-sm" onclick="App.submitDraft('${rep.id}')">Gửi</button>` : ''}
            </div>
          </article>`;
        }).join('') : `<div class="empty panel" style="padding:32px">Không có báo cáo khớp bộ lọc</div>`}
      </div>`;

    const bind = (id, key, redraw = true) => {
      const el = $(id);
      if (!el) return;
      const apply = () => {
        state[key] = el.value;
        if (redraw) pageReports();
      };
      if (el.type === 'search' || el.tagName === 'INPUT' && el.type !== 'date') el.oninput = apply;
      else el.onchange = apply;
    };
    bind('#fQ', 'reportFilterQ');
    bind('#fKind', 'reportFilterKind');
    bind('#fStatus', 'reportFilterStatus');
    bind('#fClass', 'reportFilterClass');
    bind('#fFrom', 'reportFilterFrom');
    bind('#fTo', 'reportFilterTo');
    const fsem = $('#fSemester');
    if (fsem) fsem.onchange = () => { state.reportFilterSemester = fsem.value; state.reportFilterSubject = ''; pageReports(); };
    bind('#fSubject', 'reportFilterSubject');
    const clr = $('#fClear');
    if (clr) {
      clr.onclick = () => {
        state.reportFilterKind = '';
        state.reportFilterStatus = '';
        state.reportFilterClass = '';
        state.reportFilterSemester = '';
        state.reportFilterSubject = '';
        state.reportFilterQ = '';
        state.reportFilterFrom = '';
        state.reportFilterTo = '';
        pageReports();
      };
    }
  }

  function pageReportDetail(id) {
    const r = db().reports.find((x) => x.id === id);
    if (!r) { toast('Không tìm thấy', 'err'); return navigate('reports'); }
    if (!canAccessReport(r)) return denyAccess('Bạn không được xem báo cáo này');
    const cls = classById(r.classId);

    let actions = '';
    if (canEditDraft(r)) {
      actions = `<div class="panel"><div class="panel-head"><h2>Bản nháp</h2></div>
        <div class="panel-body">
          <p style="margin-bottom:12px;font-size:.9rem;color:var(--muted)">Bạn có thể tiếp tục chỉnh sửa hoặc gửi ngay nếu nội dung đã ổn.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary" id="btnEditDraft">Chỉnh sửa</button>
            <button class="btn btn-ok" id="btnSendDraft">Gửi đi</button>
          </div>
        </div></div>`;
    }
    if (role() === 'CVHT' && ['BI_THU', 'LOP_TRUONG', 'LOP_TRUONG_NN'].includes(r.reportKind) && r.status === 'SENT_TO_CVHT') {
      actions = `<div class="panel"><div class="panel-head"><h2>Xử lý báo cáo</h2></div>
        <div class="panel-body">
          <div class="field"><label>Ghi chú nội bộ</label><textarea id="reviewNote" rows="2"></textarea></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-ok" id="btnAck">Xác nhận đã đọc</button>
            <button class="btn btn-primary" onclick="App.go('report-cvht')">Lập BC Tổng hợp →</button>
            ${r.reportKind === 'LOP_TRUONG_NN' ? '<button class="btn btn-ghost" onclick="App.go(\'rpoint\')">Đánh giá R-Point →</button>' : ''}
          </div>
        </div></div>`;
    }
    if (role() === 'QLDT' && r.reportKind === 'CVHT_TONG_HOP' && r.status === 'SENT_TO_QLDT') {
      actions = `<div class="panel"><div class="panel-body">
        <div class="field"><label>Ghi chú QLĐT</label><textarea id="reviewNote" rows="2"></textarea></div>
        <button class="btn btn-ok" id="btnAck">Xác nhận đã nắm</button>
      </div></div>`;
    }

    let body = '';
    if (r.reportKind === 'CVHT_TONG_HOP') {
      const f = r.formData || {};
      body = `
        <div class="kpi-grid">
          <div class="kpi"><div class="label">Tình hình lớp</div><div class="value" style="font-size:1rem">${esc(f.classMood || '—')}</div></div>
          <div class="kpi"><div class="label">Đã vào lớp</div><div class="value" style="font-size:1rem">${f.visitDone ? 'Có' : 'Chưa'}</div></div>
        </div>
        <div class="panel"><div class="panel-body">
          <p><strong>SV nguy cơ:</strong> ${esc(f.riskSummary || '—')}</p>
          <p style="margin-top:10px"><strong>Đề xuất QLĐT:</strong> ${esc(f.recommendation || '—')}</p>
          ${r.summaryNote ? `<p style="margin-top:10px;color:var(--muted)">${esc(r.summaryNote)}</p>` : ''}
        </div></div>`;
    } else if (r.reportKind === 'LOP_TRUONG_NN') {
      const f = r.formData || {};
      body = `
        <div class="kpi-grid">
          <div class="kpi"><div class="label">Có mặt</div><div class="value">${f.present ?? '—'}/${f.total ?? '—'}</div></div>
          <div class="kpi warn"><div class="label">Vắng KP</div><div class="value">${f.unexcused ?? 0}</div></div>
          <div class="kpi"><div class="label">BTVN đúng hạn</div><div class="value">${f.homeworkOk ?? '—'}</div></div>
          <div class="kpi danger"><div class="label">SV nguy cơ</div><div class="value">${f.riskCount ?? 0}</div></div>
        </div>
        <div class="panel"><div class="panel-body">
          <p><strong>Ghi chú nguy cơ:</strong> ${esc(f.riskNote || '—')}</p>
          <p style="margin-top:10px"><strong>Vấn đề / đề xuất:</strong> ${esc(f.issues || '—')}</p>
          <p style="margin-top:10px;color:var(--muted)">${esc(r.summaryNote || '')}</p>
        </div></div>`;
    } else {
      const criteria = r.reportKind === 'BI_THU' ? SEED.criteriaBT : SEED.criteriaLT;
      body = criteria.map((c) => {
        const fd = r.formData?.[c.id] || {};
        return `<div class="criterion"><div class="criterion-head">
          <div><h3>${c.id}. ${c.title}</h3>
            <div style="font-size:12.5px;color:var(--muted);margin-top:3px">${esc(fd.note || '—')}</div>
            <div style="font-size:13px;margin-top:5px">Giá trị: <strong>${fd.value}${c.type === 'late_count' ? ' lần trễ' : '%'}</strong></div>
          </div>
          <div class="score-preview">${fd.point ?? 0}/${c.max}</div>
        </div></div>`;
      }).join('');
      if (r.activityNote || r.summaryNote) {
        body += `<div class="panel"><div class="panel-body"><strong>Ghi chú:</strong>
          <p style="margin-top:6px;color:var(--muted)">${esc(r.activityNote || r.summaryNote)}</p></div></div>`;
      }
    }

    const ctx = Curriculum.resolveReportContext(r, cls);
    let semesterPanel = '';
    if (['BI_THU', 'LOP_TRUONG'].includes(r.reportKind) && ctx.semesterId && ctx.subjectCode) {
      const sum = semesterScoreSummary(r.classId, ctx.semesterId, ctx.subjectCode, r.reportKind, r.reporterId);
      const classSum = Scoring.classWeeklySemesterAvg(db().reports, {
        classId: r.classId, semesterId: ctx.semesterId, subjectCode: ctx.subjectCode,
      }, (id) => classById(id));
      const tenureRows = sum.tenures.map((t) =>
        `<li>${esc(userName(t.reporterId))}: <strong>${t.avg}/100</strong> (${t.count} tuần)</li>`).join('');
      semesterPanel = `<div class="score-summary-panel detail">
        <div class="score-summary-item"><span class="lbl">Tuần này</span><strong class="val week">${r.totalScore ?? '—'}<small>/100</small></strong></div>
        <div class="score-summary-divider"></div>
        <div class="score-summary-item"><span class="lbl">TB HK · người gửi</span><strong class="val semester">${sum.mine.avg ?? '—'}<small>/100</small></strong></div>
        ${(role() === 'CVHT' || role() === 'QLDT') ? `
        <div class="score-summary-divider"></div>
        <div class="score-summary-item"><span class="lbl">TB HK · lớp (BT+LT)</span><strong class="val">${classSum.avg ?? '—'}<small>/100</small></strong></div>` : ''}
      </div>
      ${sum.tenures.length > 1 ? `<div class="panel"><div class="panel-body" style="font-size:.9rem"><strong>Lịch sử đảm nhiệm trong HK:</strong><ul style="margin:8px 0 0 18px">${tenureRows}</ul></div></div>` : ''}`;
    }

    setPage('Chi tiết báo cáo', classLabel(cls));
    $('#content').innerHTML = `
      ${flowBanner()}
      <div class="cta-hero" style="padding:18px 24px">
        <div>
          <h2>${REPORT_KIND_LABELS[r.reportKind] || r.reportKind}</h2>
          <p>${esc(cls?.code || '')} · <strong>${esc(ctx.subjectName)}</strong>${ctx.subjectCode ? ` (${esc(ctx.subjectCode)})` : ''} · ${esc(Curriculum.semesterLabel(ctx.semesterId))} · ${userName(r.reporterId)} · ${Scoring.fmtDateTime(r.createdAt)} · ${statusBadge(r)}</p>
        </div>
        ${r.totalScore != null ? `<div class="score-ring" style="--p:${r.totalScore}%"><span>${r.totalScore}</span></div>` : ''}
      </div>
      ${semesterPanel}
      ${body}
      ${attachViewHtml(r.attachments || [])}
      ${actions}
      <button class="btn btn-ghost" style="margin-top:8px" onclick="App.go('reports')">← Quay lại</button>`;

    const ack = $('#btnAck');
    if (ack) {
      ack.onclick = () => {
        const next = {
          SENT_TO_CVHT: 'SEEN_BY_CVHT',
          SENT_TO_QLDT: 'SEEN_BY_QLDT',
        }[r.status];
        if (!next) return;
        Store.update((d) => {
          const item = d.reports.find((x) => x.id === id);
          item.status = next;
          item.reviewedAt = new Date().toISOString();
          item.reviewerId = user.id;
          item.reviewNote = $('#reviewNote')?.value || '';
          d.notifications.unshift({
            id: Store.uid('n'), userId: item.reporterId,
            title: 'Báo cáo đã được tiếp nhận',
            body: `${user.name} đã xác nhận báo cáo ${cls?.code}.`,
            read: false, createdAt: new Date().toISOString(),
          });
        });
        toast('Đã xác nhận');
        pageReportDetail(id);
        renderShell();
      };
    }
    const btnEdit = $('#btnEditDraft');
    if (btnEdit) btnEdit.onclick = () => editDraftReport(id);
    const btnSend = $('#btnSendDraft');
    if (btnSend) btnSend.onclick = () => {
      if (!confirm('Gửi báo cáo nháp này đi ngay?')) return;
      submitDraftNow(id);
    };
  }

  /* ========== VISITS ========== */
  function pageVisits() {
    if (!['CVHT', 'QLDT'].includes(role())) return denyAccess();
    const classes = classesForUser();
    const allVisits = (db().visits || []).filter((v) => isAdmin() || classes.some((c) => c.id === v.classId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const t = getTrace('visits');
    const visits = allVisits.filter((v) => passTrace(t, {
      at: v.visitDate || v.createdAt,
      classId: v.classId,
      searchText: [
        classById(v.classId)?.code,
        subjectOf(classById(v.classId)),
        userName(v.cvhtId),
        v.observation,
      ].join(' '),
    }));

    setPage('Vào lớp / quan sát', 'Lọc lịch sử theo lớp · ngày · nội dung');
    $('#content').innerHTML = `
      ${flowBanner()}
      ${role() === 'CVHT' ? `<div class="panel"><div class="panel-head"><h2>Ghi nhận buổi vào lớp</h2></div>
        <div class="panel-body">
          <div class="grid-2">
            <div class="field"><label>Lớp · Môn</label>
              <select id="vClass">${classes.map((c) => `<option value="${c.id}">${c.code} — ${esc(subjectOf(c))}</option>`).join('')}</select></div>
            <div class="field"><label>Ngày</label><input type="date" id="vDate" value="${new Date().toISOString().slice(0, 10)}" /></div>
          </div>
          <div class="field"><label>Quan sát / nhận xét</label>
            <textarea id="vNote" rows="3" placeholder="Sĩ số, không khí lớp, vấn đề phát sinh…"></textarea></div>
          <button class="btn btn-primary" id="btnSaveVisit">Lưu buổi vào lớp</button>
        </div></div>` : ''}
      <div class="panel"><div class="panel-head"><h2>Lịch sử vào lớp</h2>
        <span style="font-size:12px;color:var(--muted)">${visits.length}/${allVisits.length} buổi</span></div>
        <div class="panel-body" style="padding-top:0">
          ${traceBarHTML('visits', {
            classes,
            placeholder: 'Tìm lớp, CVHT, nội dung quan sát…',
            resultText: `${visits.length} buổi`,
          })}
          <div class="table-wrap"><table class="trace-table">
            <thead><tr><th>Ngày</th><th>Lớp</th><th>Môn</th><th>CVHT</th><th>Quan sát</th></tr></thead>
            <tbody>${visits.length ? visits.map((v) => {
              const cls = classById(v.classId);
              return `<tr>
                <td class="trace-time">${Scoring.fmtDate(v.visitDate)}</td>
                <td><strong>${esc(cls?.code || '—')}</strong></td>
                <td>${esc(subjectOf(cls))}</td>
                <td>${esc(userName(v.cvhtId))}</td>
                <td><div class="trace-cell-note">${esc(v.observation)}</div></td>
              </tr>`;
            }).join('') : `<tr><td colspan="5"><div class="empty">${allVisits.length ? 'Không có buổi khớp bộ lọc' : 'Chưa có buổi vào lớp'}</div></td></tr>`}
            </tbody>
          </table></div>
        </div>
      </div>`;

    bindTraceBar('visits', pageVisits);
    const btn = $('#btnSaveVisit');
    if (btn) {
      btn.onclick = () => {
        const note = $('#vNote').value.trim();
        if (!note) return toast('Nhập nhận xét', 'err');
        Store.update((d) => {
          if (!d.visits) d.visits = [];
          d.visits.unshift({
            id: Store.uid('vis'),
            classId: $('#vClass').value,
            cvhtId: Store.realId(user),
            visitDate: $('#vDate').value,
            observation: note,
            createdAt: new Date().toISOString(),
          });
        });
        toast('Đã lưu buổi vào lớp');
        pageVisits();
      };
    }
  }

  /* ========== R-POINT NN ========== */
  function pageRPoint() {
    if (!['CVHT', 'QLDT'].includes(role())) return denyAccess();
    const nnClasses = classesForUser().filter((c) => c.programType === 'NGOAI_NGU');
    const allEvals = (db().rpointEvals || []).filter((e) => isAdmin() || nnClasses.some((c) => c.id === e.classId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const t = getTrace('rpoint');
    const evals = allEvals.filter((e) => {
      const g = Scoring.rpointLabel(e.total);
      return passTrace(t, {
        at: e.createdAt,
        classId: e.classId,
        searchText: [
          classById(e.classId)?.code,
          userName(e.ltId),
          userName(e.evaluatorId),
          e.note,
          g.label,
          String(e.total),
        ].join(' '),
      });
    });

    setPage('R-Point Ngoại ngữ', 'Điều 13 · tối đa 10 điểm / học phần');
    $('#content').innerHTML = `
      ${flowBanner()}
      <div class="cta-hero" style="padding:18px 24px">
        <div>
          <h2>Đánh giá Lớp trưởng Ngoại ngữ</h2>
          <p>Theo quy chế do Giảng viên chấm cuối học phần. Trong demo, CVHT/QLĐT ghi nhận kết quả để theo dõi &amp; phê duyệt.</p>
        </div>
      </div>
      ${nnClasses.length ? `<div class="panel"><div class="panel-head"><h2>Chấm R-Point</h2></div>
        <div class="panel-body">
          <div class="field"><label>Lớp</label>
            <select id="rpClass">${nnClasses.map((c) => `<option value="${c.id}">${c.code} · LT: ${userName(c.ltId)}</option>`).join('')}</select></div>
          ${SEED.criteriaRPoint.map((c) => `
            <div class="field"><label>${c.id}. ${c.title} <span style="color:var(--muted)">(max ${c.max})</span></label>
              <select data-rp="${c.id}">${RPOINT_LEVELS.map((l) => `<option value="${l.value}" ${l.value === 2 ? 'selected' : ''}>${l.label}</option>`).join('')}</select>
            </div>`).join('')}
          <div class="field"><label>Ghi chú</label><textarea id="rpNote" rows="2"></textarea></div>
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
            <div>Tổng tạm tính: <strong id="rpTotal">10</strong> / 10</div>
            <button class="btn btn-primary" id="btnSaveRp">Lưu đánh giá R-Point</button>
          </div>
        </div></div>` : '<div class="empty">Không có lớp Ngoại ngữ trong phạm vi</div>'}
      <div class="panel"><div class="panel-head"><h2>Lịch sử R-Point</h2></div>
        <div class="panel-body" style="padding-top:0">
          ${traceBarHTML('rpoint', {
            classes: nnClasses,
            placeholder: 'Tìm lớp, LT, người chấm, ghi chú…',
            resultText: `${evals.length}/${allEvals.length}`,
          })}
          <div class="table-wrap"><table class="trace-table">
            <thead><tr><th>Thời gian</th><th>Lớp</th><th>Lớp trưởng</th><th>Điểm</th><th>Xếp loại</th><th>Người chấm</th><th>Ghi chú</th></tr></thead>
            <tbody>${evals.length ? evals.map((e) => {
              const g = Scoring.rpointLabel(e.total);
              return `<tr>
                <td class="trace-time">${Scoring.fmtDateTime(e.createdAt)}</td>
                <td><strong>${classById(e.classId)?.code || '—'}</strong></td>
                <td>${userName(e.ltId)}</td>
                <td><strong>${e.total}</strong>/10</td>
                <td><span class="badge ${g.cls}">${g.label}</span></td>
                <td>${userName(e.evaluatorId)}</td>
                <td><div class="trace-cell-note">${esc(e.note || '—')}</div></td>
              </tr>`;
            }).join('') : `<tr><td colspan="7"><div class="empty">${allEvals.length ? 'Không có mục khớp bộ lọc' : 'Chưa có đánh giá'}</div></td></tr>`}
          </tbody></table></div>
        </div>
      </div>`;

    bindTraceBar('rpoint', pageRPoint);
    const updateTotal = () => {
      const scores = {};
      $$('[data-rp]').forEach((el) => { scores[el.dataset.rp] = Number(el.value); });
      const t = Scoring.rpointTotal(scores);
      const el = $('#rpTotal');
      if (el) el.textContent = t;
    };
    $$('[data-rp]').forEach((el) => el.addEventListener('change', updateTotal));
    updateTotal();

    const btn = $('#btnSaveRp');
    if (btn) {
      btn.onclick = () => {
        const classId = $('#rpClass').value;
        const cls = classById(classId);
        const scores = {};
        $$('[data-rp]').forEach((el) => { scores[el.dataset.rp] = Number(el.value); });
        const total = Scoring.rpointTotal(scores);
        Store.update((d) => {
          d.rpointEvals.unshift({
            id: Store.uid('rpnt'),
            classId,
            ltId: cls.ltId,
            evaluatorId: user.id,
            scores,
            total,
            note: $('#rpNote').value,
            createdAt: new Date().toISOString(),
          });
          d.auditLog.unshift({
            id: Store.uid('al'), actorId: user.id, actorName: user.name,
            action: 'RPOINT_EVAL', entity: 'RPoint', entityId: classId,
            beforeJson: '', afterJson: JSON.stringify({ total, ltId: cls.ltId }),
            at: new Date().toISOString(),
          });
        });
        if (cls.ltId) notify([cls.ltId], 'Kết quả R-Point', `${cls.code}: ${total}/10 — ${Scoring.rpointLabel(total).label}`);
        toast(`Đã lưu R-Point ${total}/10`);
        pageRPoint();
      };
    }
  }

  /* ========== AT-RISK / COUNSEL / ESCALATE ========== */
  function openPickStudentStatusModal(fixedClassId) {
    if (!canEditStudentStatus()) return denyAccess();
    const classes = fixedClassId
      ? classesForUser().filter((c) => c.id === fixedClassId)
      : classesForUser();
    if (!classes.length) return toast('Không có lớp trong phạm vi', 'err');
    const classId0 = fixedClassId || classes[0].id;
    const studentsOf = (cid) => allStudents().filter((s) => s.classId === cid);

    const paintBody = (cid) => {
      const list = studentsOf(cid);
      return `
        <div class="field"><label>Lớp</label>
          <select id="mClass" ${fixedClassId ? 'disabled' : ''}>${classes.map((c) =>
            `<option value="${c.id}" ${c.id === cid ? 'selected' : ''}>${esc(c.code)}</option>`).join('')}</select></div>
        <div class="field"><label>Sinh viên trong lớp</label>
          <select id="mStudent">
            <option value="">— Chọn sinh viên —</option>
            ${list.map((s) => `<option value="${s.id}">${esc(s.name)}${s.studentCode ? ` (${esc(s.studentCode)})` : ''} · ${STUDENT_STATUS[s.status]?.label || 'Ổn định'}</option>`).join('')}
          </select>
          ${list.length ? '' : '<div style="font-size:12px;color:var(--muted);margin-top:4px">Lớp chưa có SV.</div>'}
        </div>
        <div class="field"><label>Trạng thái</label>
          <select id="mStatus">
            <option value="WATCH">Có vấn đề</option>
            <option value="AT_RISK" selected>Nguy cơ</option>
            <option value="ACTIVE">Ổn định</option>
            <option value="INACTIVE">Tạm ngưng</option>
          </select>
        </div>
        <div class="field" id="mLevelWrap">
          <label>Mức độ</label>
          <select id="mLevel">
            <option value="LOW">Thấp</option>
            <option value="MEDIUM" selected>Trung bình</option>
            <option value="HIGH">Cao</option>
          </select>
        </div>
        <div class="field"><label>Ghi chú / lý do</label>
          <textarea id="mNote" rows="3" placeholder="VD: Nghỉ học, mất liên lạc, chậm BTVN…"></textarea></div>`;
    };

    $('#modalRoot').innerHTML = `<div class="modal-overlay" id="modalOv"><div class="modal">
      <div class="modal-head"><h3>Ghi nhận trạng thái SV</h3><button class="btn btn-ghost btn-sm" id="mClose">✕</button></div>
      <div class="modal-body" id="mBody">${paintBody(classId0)}</div>
      <div class="modal-foot"><button class="btn btn-ghost" id="mCancel">Hủy</button><button class="btn btn-primary" id="mSave">Lưu</button></div>
    </div></div>`;
    const close = () => { $('#modalRoot').innerHTML = ''; };
    $('#mClose').onclick = $('#mCancel').onclick = close;
    $('#modalOv').onclick = (e) => { if (e.target.id === 'modalOv') close(); };

    const bindInner = () => {
      const syncLevel = () => {
        const st = $('#mStatus')?.value;
        const wrap = $('#mLevelWrap');
        if (wrap) wrap.style.display = (st === 'AT_RISK' || st === 'WATCH') ? '' : 'none';
      };
      $('#mStatus').onchange = syncLevel;
      syncLevel();
      const sel = $('#mClass');
      if (sel && !fixedClassId) {
        sel.onchange = () => {
          $('#mBody').innerHTML = paintBody(sel.value);
          bindInner();
        };
      }
    };
    bindInner();

    $('#mSave').onclick = () => {
      const studentId = $('#mStudent')?.value;
      if (!studentId) return toast('Chọn sinh viên trong lớp', 'err');
      const status = $('#mStatus').value;
      const note = ($('#mNote').value || '').trim();
      if ((status === 'AT_RISK' || status === 'WATCH') && !note) {
        return toast('Nhập ghi chú / lý do', 'err');
      }
      applyStudentStatus(studentId, {
        status,
        note,
        riskLevel: $('#mLevel').value,
      }, { addCounselNote: role() === 'CVHT' || role() === 'QLDT' });
      toast(`Đã cập nhật: ${STUDENT_STATUS[status]?.label || status}`);
      close();
      if (route === 'at-risk') pageAtRisk();
      else if (route === 'classes' && routeParams.id) pageClassDetail(routeParams.id);
      else render();
    };
  }

  function pageAtRisk() {
    const watch = studentsInScope().filter((s) => s.status === 'WATCH');
    const risk = studentsInScope().filter((s) => s.status === 'AT_RISK');
    const list = [...risk, ...watch];
    const isManager = ['CVHT', 'QLDT'].includes(role());
    setPage(isManager ? 'Quản lý SV nguy cơ' : 'Sinh viên nguy cơ', `${risk.length} nguy cơ · ${watch.length} có vấn đề`);
    $('#content').innerHTML = `
      <div class="panel" style="margin-bottom:14px"><div class="panel-body" style="padding:12px 18px;font-size:.9rem;color:var(--muted)">
        ${isManager
          ? 'Quản lý sinh viên đang theo dõi: cập nhật trạng thái, ghi biên bản tư vấn, chuyển QLĐT hoặc đưa về ổn định. Mọi thay đổi được lưu ở <strong style="color:var(--ink)">Lịch sử CSSV</strong>.'
          : 'Ghi nhận trên <strong style="color:var(--ink)">SV đã có trong lớp</strong> (chi tiết lớp → Cập nhật, hoặc nút bên dưới). Ghi chú lưu trên hồ sơ SV.'}
      </div></div>
      <div class="kpi-grid kpi-grid-3" style="margin-bottom:14px">
        <div class="kpi danger"><div class="label">Nguy cơ</div><div class="value">${risk.length}</div></div>
        <div class="kpi warn"><div class="label">Có vấn đề</div><div class="value">${watch.length}</div></div>
        <div class="kpi"><div class="label">Tổng theo dõi</div><div class="value">${list.length}</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Danh sách theo dõi</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${isManager ? '<button class="btn btn-ghost btn-sm" onclick="App.go(\'counseling\')">Lịch sử CSSV →</button>' : ''}
            ${canEditStudentStatus() ? '<button class="btn btn-primary btn-sm" id="btnAddRisk">+ Ghi nhận trạng thái</button>' : ''}
          </div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Sinh viên</th><th>Lớp</th><th>Trạng thái</th><th>Ghi chú</th><th>Mức</th><th></th></tr></thead>
          <tbody>${list.length ? list.map((s) => `
            <tr>
              <td><strong>${esc(s.name)}</strong><div style="font-size:11.5px;color:var(--muted)">${esc(s.studentCode || '')}</div></td>
              <td>${classById(s.classId)?.code || '—'}</td>
              <td>${studentStatusBadge(s)}</td>
              <td style="font-size:13px;max-width:240px">${esc(studentNoteText(s) || '—')}</td>
              <td>${(s.status === 'AT_RISK' || s.status === 'WATCH')
                ? `<span class="badge ${s.riskLevel === 'HIGH' ? 'badge-danger' : s.riskLevel === 'LOW' ? 'badge-muted' : 'badge-warn'}">${s.riskLevel === 'HIGH' ? 'Cao' : s.riskLevel === 'LOW' ? 'Thấp' : 'TB'}</span>`
                : '—'}</td>
              <td style="display:flex;gap:5px;flex-wrap:wrap">
                ${canEditStudentStatus() ? `<button class="btn btn-ghost btn-sm" data-status-sv="${s.id}">Cập nhật</button>` : ''}
                ${isManager ? `<button class="btn btn-ghost btn-sm" onclick="App.counsel('${s.id}')">Ghi tư vấn</button>` : ''}
                ${role() === 'CVHT' || isAdmin() ? `<button class="btn btn-warn btn-sm" onclick="App.escalate('${s.id}')">Chuyển QLĐT</button>` : ''}
                ${isManager ? `<button class="btn btn-ok btn-sm" onclick="App.resolveRisk('${s.id}')">Ổn định lại</button>` : ''}
              </td>
            </tr>`).join('') : '<tr><td colspan="6"><div class="empty">Chưa có SV nguy cơ / có vấn đề — bấm + Ghi nhận trạng thái</div></td></tr>'}
          </tbody>
        </table></div>
      </div>`;
    const btn = $('#btnAddRisk');
    if (btn) btn.onclick = () => openPickStudentStatusModal();
    $$('[data-status-sv]').forEach((b) => {
      b.onclick = () => openStudentStatusModal(b.dataset.statusSv);
    });
  }

  function openAddRiskModal() {
    openPickStudentStatusModal();
  }

  App.counsel = (studentId) => {
    if (!['CVHT', 'QLDT'].includes(role())) return denyAccess();
    const s = allStudents().find((x) => x.id === studentId);
    const note = prompt(`Biên bản tư vấn — ${s?.name}:`, 'Đã liên hệ, thống nhất kế hoạch cải thiện.');
    if (note == null) return;
    const text = note.trim();
    if (!text) return toast('Nhập nội dung tư vấn', 'err');
    const now = new Date().toISOString();
    Store.update((d) => {
      d.atRiskNotes.unshift({
        id: Store.uid('cn'), studentId, cvhtId: Store.realId(user),
        note: text, status: 'IN_PROGRESS', createdAt: now,
      });
      d.auditLog.unshift({
        id: Store.uid('al'), actorId: user.id, actorName: user.name,
        action: 'COUNSEL_NOTE', entity: 'Student', entityId: studentId,
        beforeJson: '', afterJson: text, at: now,
      });
    });
    toast('Đã lưu biên bản tư vấn');
    navigate('counseling');
  };

  App.escalate = (studentId) => {
    if (role() !== 'CVHT' && !isAdmin()) return denyAccess();
    const s = allStudents().find((x) => x.id === studentId);
    const reason = prompt('Lý do chuyển QLĐT:', 'Không liên hệ được sau 48h');
    if (reason == null) return;
    const text = reason.trim();
    if (!text) return toast('Nhập lý do chuyển', 'err');
    const now = new Date().toISOString();
    Store.update((d) => {
      d.escalations.unshift({
        id: Store.uid('e'), studentId, classId: s.classId, cvhtId: Store.realId(user),
        reason: text, status: 'OPEN', createdAt: now, notes: [],
      });
      d.auditLog.unshift({
        id: Store.uid('al'), actorId: user.id, actorName: user.name,
        action: 'ESCALATE', entity: 'Student', entityId: studentId,
        beforeJson: s?.status || '', afterJson: text, at: now,
      });
    });
    notify(['u_admin'], 'Case chuyển QLĐT mới', `${user.name}: ${s.name} — ${text}`);
    toast('Đã chuyển QLĐT'); navigate('escalations');
  };

  App.resolveRisk = (studentId) => {
    if (!['CVHT', 'QLDT'].includes(role())) return denyAccess();
    applyStudentStatus(studentId, { status: 'ACTIVE', note: 'Đã xử lý — ổn định lại', riskLevel: '' });
    toast('Đã chuyển về Ổn định');
    pageAtRisk();
  };

  function pageCounseling() {
    if (!['CVHT', 'QLDT'].includes(role())) return denyAccess();
    const all = buildCssvHistory();
    const t = getTrace('cssv');
    const scopeClasses = classesForUser();
    const kindMeta = {
      status: { label: 'Trạng thái', badge: 'badge-brand' },
      counsel: { label: 'Tư vấn', badge: 'badge-ok' },
      escalate: { label: 'Chuyển QLĐT', badge: 'badge-warn' },
    };
    const filtered = all.filter((e) => {
      if (t.kind && t.kind !== 'all' && e.kind !== t.kind) return false;
      const s = allStudents().find((x) => x.id === e.studentId);
      const cls = classById(e.classId || s?.classId);
      return passTrace(t, {
        at: e.at,
        classId: e.classId || s?.classId || '',
        searchText: [
          s?.name, s?.studentCode, cls?.code, e.note, e.actorName,
          kindMeta[e.kind]?.label, e.fromCode, e.toCode,
        ].join(' '),
      });
    });

    setPage('Lịch sử CSSV', 'Truy vết theo tên · lớp · ngày · loại sự kiện');
    $('#content').innerHTML = `
      ${traceBarHTML('cssv', {
        classes: scopeClasses,
        kinds: [
          ['all', 'Tất cả loại'],
          ['status', 'Đổi trạng thái'],
          ['counsel', 'Tư vấn'],
          ['escalate', 'Chuyển QLĐT'],
        ],
        placeholder: 'Tìm SV, mã SV, lớp, người ghi, nội dung…',
        resultText: `${filtered.length}/${all.length} mục`,
        extra: '<button type="button" class="btn btn-ghost btn-sm" onclick="App.go(\'at-risk\')">← Quản lý SV</button>',
      })}
      <div class="panel"><div class="table-wrap"><table class="trace-table">
        <thead><tr>
          <th style="width:120px">Thời gian</th>
          <th style="width:110px">Loại</th>
          <th>Sinh viên</th>
          <th style="width:130px">Lớp</th>
          <th>Nội dung</th>
          <th style="width:140px">Người ghi</th>
        </tr></thead>
        <tbody>${filtered.length ? filtered.map((e) => {
          const s = allStudents().find((x) => x.id === e.studentId);
          const cls = classById(e.classId || s?.classId);
          const km = kindMeta[e.kind] || kindMeta.status;
          let content = '';
          if (e.kind === 'status') {
            content = `<div class="hist-change">${statusBadgeByCode(e.fromCode || 'ACTIVE')}<span class="hist-arrow">→</span>${statusBadgeByCode(e.toCode || 'ACTIVE')}</div>
              ${e.note ? `<div class="trace-cell-note">${esc(e.note)}</div>` : ''}`;
          } else if (e.kind === 'escalate') {
            content = `<div class="trace-cell-note">${esc(e.note)}</div>
              ${e.status === 'OPEN' ? '<span class="badge badge-danger">Đang mở</span>' : '<span class="badge badge-ok">Đã đóng</span>'}`;
          } else {
            content = `<div class="trace-cell-note">${esc(e.note)}</div>`;
          }
          return `<tr>
            <td class="trace-time">${Scoring.fmtDateTime(e.at)}</td>
            <td><span class="badge ${km.badge}">${km.label}</span></td>
            <td><strong>${esc(s?.name || e.studentId)}</strong>
              <div class="trace-sub">${esc(s?.studentCode || '')}</div></td>
            <td>${esc(cls?.code || '—')}</td>
            <td>${content}</td>
            <td class="trace-actor">${esc(e.actorName || '—')}</td>
          </tr>`;
        }).join('') : `<tr><td colspan="6"><div class="empty">${all.length ? 'Không có mục khớp bộ lọc' : 'Chưa có lịch sử — cập nhật SV nguy cơ hoặc ghi tư vấn để bắt đầu truy vết.'}</div></td></tr>`}
        </tbody>
      </table></div></div>`;
    bindTraceBar('cssv', pageCounseling);
  }

  function pageEscalations() {
    if (!['CVHT', 'QLDT'].includes(role())) return denyAccess();
    let list = db().escalations;
    if (!isAdmin()) {
      const ids = new Set(classesForUser().map((c) => c.id));
      list = list.filter((e) => ids.has(e.classId) || e.cvhtId === real());
    }
    const t = getTrace('esc');
    const scopeClasses = classesForUser();
    const filtered = list.filter((e) => {
      if (t.status === 'OPEN' && e.status !== 'OPEN') return false;
      if (t.status === 'CLOSED' && e.status !== 'CLOSED') return false;
      const s = allStudents().find((x) => x.id === e.studentId);
      const noteBlob = [
        e.reason,
        e.resolveNote,
        ...(Array.isArray(e.notes) ? e.notes.map((n) => n.text) : []),
      ].join(' ');
      return passTrace(t, {
        at: e.createdAt,
        classId: e.classId,
        searchText: [s?.name, s?.studentCode, classById(e.classId)?.code, userName(e.cvhtId), noteBlob].join(' '),
      });
    });
    const openN = list.filter((e) => e.status === 'OPEN').length;
    setPage('Case chuyển QLĐT', `${openN} đang mở · Lọc theo tên / lớp / ngày`);

    const canNote = ['CVHT', 'QLDT'].includes(role());
    const canResolve = isAdmin();

    const renderNotes = (e) => {
      const notes = Array.isArray(e.notes) ? e.notes : [];
      if (!notes.length && !e.resolveNote) {
        return '<div class="esc-notes-empty">Chưa có ghi chú xử lý</div>';
      }
      const rows = notes.map((n) => `
        <div class="esc-note ${n.kind === 'resolve' ? 'is-resolve' : ''}">
          <div class="esc-note-meta">
            <strong>${esc(n.byName || userName(n.by) || '—')}</strong>
            <span>${Scoring.fmtDateTime(n.at)}</span>
            ${n.kind === 'resolve' ? '<span class="badge badge-ok">Kết luận</span>' : ''}
          </div>
          <p>${esc(n.text)}</p>
        </div>`).join('');
      const legacy = e.resolveNote && !notes.some((n) => n.kind === 'resolve')
        ? `<div class="esc-note is-resolve">
            <div class="esc-note-meta"><strong>${esc(e.resolvedByName || 'QLĐT')}</strong>
              <span>${e.resolvedAt ? Scoring.fmtDateTime(e.resolvedAt) : ''}</span>
              <span class="badge badge-ok">Kết luận</span></div>
            <p>${esc(e.resolveNote)}</p>
          </div>`
        : '';
      return `<div class="esc-notes">${rows}${legacy}</div>`;
    };

    $('#content').innerHTML = `
      <div class="panel" style="margin-bottom:14px"><div class="panel-body" style="padding:12px 18px;font-size:.9rem;color:var(--muted)">
        Mỗi case cần <strong style="color:var(--ink)">ghi chú quá trình xử lý</strong>.
        QLĐT đóng case bằng <strong style="color:var(--ink)">Xử lý xong</strong> kèm nội dung kết luận.
      </div></div>
      ${traceBarHTML('esc', {
        classes: scopeClasses,
        statuses: [
          ['', 'Tất cả trạng thái'],
          ['OPEN', 'Đang mở'],
          ['CLOSED', 'Đã đóng'],
        ],
        placeholder: 'Tìm SV, lớp, CVHT, lý do, ghi chú…',
        resultText: `${filtered.length}/${list.length} case`,
      })}
      <div class="esc-list">
        ${filtered.length ? filtered.map((e) => {
          const s = allStudents().find((x) => x.id === e.studentId);
          const open = e.status === 'OPEN';
          return `<article class="esc-card ${open ? 'is-open' : 'is-closed'}">
            <div class="esc-card-head">
              <div>
                <div class="esc-title">
                  <strong>${esc(s?.name || '—')}</strong>
                  ${open ? '<span class="badge badge-danger">Mở</span>' : '<span class="badge badge-ok">Đóng</span>'}
                </div>
                <div class="esc-sub">${esc(classById(e.classId)?.code || '—')} · CVHT ${esc(userName(e.cvhtId))} · ${Scoring.fmtDateTime(e.createdAt)}</div>
              </div>
              <div class="esc-actions">
                ${canNote && open ? `<button class="btn btn-ghost btn-sm" data-esc-note="${e.id}">+ Ghi chú</button>` : ''}
                ${canResolve && open ? `<button class="btn btn-ok btn-sm" data-esc-resolve="${e.id}">Xử lý xong</button>` : ''}
                ${canNote && !open ? `<button class="btn btn-ghost btn-sm" data-esc-note="${e.id}">+ Ghi chú thêm</button>` : ''}
              </div>
            </div>
            <div class="esc-reason"><span class="esc-label">Lý do chuyển</span><p>${esc(e.reason)}</p></div>
            <div class="esc-thread">
              <div class="esc-label">Ghi chú xử lý</div>
              ${renderNotes(e)}
            </div>
          </article>`;
        }).join('') : `<div class="panel"><div class="empty">${list.length ? 'Không có case khớp bộ lọc' : 'Không có case'}</div></div>`}
      </div>`;

    bindTraceBar('esc', pageEscalations);
    $$('[data-esc-note]').forEach((btn) => {
      btn.onclick = () => openEscalationNoteModal(btn.dataset.escNote, false);
    });
    $$('[data-esc-resolve]').forEach((btn) => {
      btn.onclick = () => openEscalationNoteModal(btn.dataset.escResolve, true);
    });
  }

  function openEscalationNoteModal(escalationId, resolve) {
    if (!['CVHT', 'QLDT'].includes(role())) return denyAccess();
    if (resolve && !isAdmin()) return denyAccess();
    const e = db().escalations.find((x) => x.id === escalationId);
    if (!e) return toast('Không tìm thấy case', 'err');
    const s = allStudents().find((x) => x.id === e.studentId);
    $('#modalRoot').innerHTML = `<div class="modal-overlay" id="modalOv"><div class="modal">
      <div class="modal-head">
        <h3>${resolve ? 'Xử lý xong case' : 'Thêm ghi chú'}</h3>
        <button class="btn btn-ghost btn-sm" id="mClose">✕</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Sinh viên</label>
          <input type="text" value="${escAttr(s?.name || '—')} · ${escAttr(classById(e.classId)?.code || '')}" disabled /></div>
        <div class="field"><label>Lý do chuyển</label>
          <textarea rows="2" disabled>${esc(e.reason)}</textarea></div>
        <div class="field"><label>${resolve ? 'Kết luận xử lý (bắt buộc)' : 'Nội dung ghi chú'}</label>
          <textarea id="mEscNote" rows="4" placeholder="${resolve
            ? 'VD: Đã liên hệ phụ huynh, SV quay lại học từ tuần sau…'
            : 'VD: Đã gọi điện lần 2, hẹn gặp thứ 5…'}"></textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="mCancel">Hủy</button>
        <button class="btn ${resolve ? 'btn-ok' : 'btn-primary'}" id="mSave">${resolve ? 'Đóng case' : 'Lưu ghi chú'}</button>
      </div>
    </div></div>`;
    const close = () => { $('#modalRoot').innerHTML = ''; };
    $('#mClose').onclick = $('#mCancel').onclick = close;
    $('#modalOv').onclick = (ev) => { if (ev.target.id === 'modalOv') close(); };
    $('#mSave').onclick = () => {
      const text = ($('#mEscNote').value || '').trim();
      if (!text) return toast(resolve ? 'Nhập kết luận xử lý' : 'Nhập nội dung ghi chú', 'err');
      const now = new Date().toISOString();
      Store.update((d) => {
        const item = d.escalations.find((x) => x.id === escalationId);
        if (!item) return;
        if (!Array.isArray(item.notes)) item.notes = [];
        item.notes.push({
          id: Store.uid('en'),
          text,
          by: user.id,
          byName: user.name,
          at: now,
          kind: resolve ? 'resolve' : 'note',
        });
        if (resolve) {
          item.status = 'CLOSED';
          item.resolveNote = text;
          item.resolvedAt = now;
          item.resolvedBy = user.id;
          item.resolvedByName = user.name;
        }
        d.auditLog.unshift({
          id: Store.uid('al'), actorId: user.id, actorName: user.name,
          action: resolve ? 'ESCALATE_RESOLVE' : 'ESCALATE_NOTE',
          entity: 'Student', entityId: item.studentId,
          beforeJson: item.reason || '',
          afterJson: text,
          at: now,
        });
      });
      if (resolve) {
        const cvhtId = e.cvhtId;
        if (cvhtId) notify([cvhtId], 'Case QLĐT đã đóng', `${s?.name || 'SV'}: ${text}`);
        toast('Đã đóng case kèm kết luận');
      } else {
        toast('Đã thêm ghi chú');
      }
      close();
      pageEscalations();
    };
  }

  /* ========== ADMIN (simplified) ========== */
  function pagePeople() {
    if (!isAdmin()) return denyAccess();
    if (routeParams.id) return pagePersonDetail(routeParams.id);
    const q = (state.peopleQ || '').trim().toLowerCase();
    const staff = allUsers()
      .filter((u) => !u.aliasOf && APP_ROLES.includes(userRole(u)) && userRole(u) !== 'QLDT')
      .filter((u) => !q || [u.name, u.email, u.campus, ROLE_LABELS[userRole(u)], u.phone]
        .join(' ').toLowerCase().includes(q))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi'));
    const total = allUsers().filter((u) => !u.aliasOf && APP_ROLES.includes(userRole(u)) && userRole(u) !== 'QLDT').length;
    setPage('Nhân sự & vai trò', `${staff.length}${q ? `/${total}` : ''} người`);
    $('#content').innerHTML = `
      <div class="admin-toolbar">
        <span style="font-size:13px;color:var(--muted)">Quản lý CVHT · Lớp trưởng · Bí thư</span>
        <input type="search" id="peopleQ" class="trace-q" style="flex:1;min-width:180px;max-width:280px;height:34px"
          placeholder="Tìm tên, email, vai trò…" value="${escAttr(state.peopleQ || '')}" />
        <button class="btn btn-primary btn-sm" id="btnAddPerson">+ Thêm</button>
      </div>
      <div id="peopleList">${staff.length ? staff.map((u) => `
        <div class="person-card" onclick="App.go('people/${u.id}')">
          <div class="avatar">${u.initials}</div>
          <div style="flex:1"><strong>${esc(u.name)}</strong>
            <div style="font-size:12px;color:var(--muted)">${esc(u.email)} · ${esc(u.campus)}</div>
            <div class="role-chips"><span class="badge badge-brand">${ROLE_LABELS[userRole(u)]}</span></div>
          </div>
          <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm" data-edit-user="${u.id}">Sửa</button>
            <button class="btn btn-primary btn-sm" data-assign-user="${u.id}">Gán lớp</button>
          </div>
        </div>`).join('') : `<div class="empty panel" style="padding:28px">${q ? 'Không tìm thấy nhân sự khớp' : 'Chưa có nhân sự'}</div>`}</div>`;
    const pq = $('#peopleQ');
    if (pq) pq.oninput = () => { state.peopleQ = pq.value; pagePeople(); };
    $('#btnAddPerson').onclick = openCreateUserModal;
    $$('[data-edit-user]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); openEditUserModal(b.dataset.editUser); }; });
    $$('[data-assign-user]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); openAssignPersonModal(b.dataset.assignUser); }; });
  }

  function pagePersonDetail(id) {
    if (!isAdmin()) return denyAccess();
    const u = findUser(id);
    if (!u) return navigate('people');
    const roles = [];
    allClasses().forEach((c) => {
      if (c.cvhtId === u.id) roles.push({ role: 'CVHT', code: c.code, classId: c.id });
      if (c.ltId === u.id) roles.push({ role: 'LOP_TRUONG', code: c.code, classId: c.id });
      if (c.btId === u.id) roles.push({ role: 'BI_THU', code: c.code, classId: c.id });
    });
    setPage(u.name, ROLE_LABELS[userRole(u)]);
    $('#content').innerHTML = `
      <div class="panel"><div class="panel-body" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
        <div class="avatar" style="width:52px;height:52px">${u.initials}</div>
        <div style="flex:1"><strong style="font-size:1.1rem">${u.name}</strong>
          <div style="color:var(--muted);font-size:13px">${u.email}</div>
          <div class="role-chips" style="margin-top:6px"><span class="badge badge-brand">${ROLE_LABELS[userRole(u)]}</span></div>
        </div>
        <button class="btn btn-ghost btn-sm" id="btnEdit">Sửa</button>
        <button class="btn btn-primary btn-sm" id="btnAssign">Gán lớp</button>
      </div></div>
      <div class="panel"><div class="panel-head"><h2>Phân công hiện tại</h2></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Vai trò</th><th>Lớp</th><th></th></tr></thead>
          <tbody>${roles.length ? roles.map((r) => `<tr>
            <td><span class="badge badge-brand">${ASSIGN_ROLE_LABELS[r.role]}</span></td>
            <td>${r.code}</td>
            <td><button class="btn btn-danger btn-sm" data-unassign="${r.classId}|${r.role}">Gỡ</button></td>
          </tr>`).join('') : '<tr><td colspan="3"><div class="empty">Chưa gán</div></td></tr>'}
          </tbody>
        </table></div>
      </div>
      <button class="btn btn-ghost" onclick="App.go('people')">← Quay lại</button>`;
    $('#btnEdit').onclick = () => openEditUserModal(u.id);
    $('#btnAssign').onclick = () => openAssignPersonModal(u.id);
    $$('[data-unassign]').forEach((btn) => {
      btn.onclick = () => {
        const [classId, roleKey] = btn.dataset.unassign.split('|');
        const reason = prompt('Lý do gỡ:', 'Điều chuyển') || 'Gỡ phân công';
        Store.changeAssignment(user, classId, roleKey, null, reason);
        toast('Đã gỡ'); pagePersonDetail(u.id);
      };
    });
  }

  function closeModal() { $('#modalRoot').innerHTML = ''; }

  function openCreateUserModal() {
    $('#modalRoot').innerHTML = `<div class="modal-overlay" id="modalOv"><div class="modal">
      <div class="modal-head"><h3>Thêm nhân sự</h3><button class="btn btn-ghost btn-sm" id="mClose">✕</button></div>
      <div class="modal-body">
        <div class="field"><label>Họ tên</label><input id="cName" /></div>
        <div class="field"><label>Email</label><input id="cEmail" type="email" /></div>
        <div class="field"><label>Vai trò</label>
          <select id="cRole">${APP_ROLES.filter((r) => r !== 'QLDT').map((k) => `<option value="${k}">${ROLE_LABELS[k]}</option>`).join('')}</select></div>
        <div class="field"><label>Campus</label><select id="cCampus"><option value="HN">Hà Nội</option><option value="HCM">HCM</option></select></div>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" id="mCancel">Hủy</button><button class="btn btn-primary" id="mSave">Tạo</button></div>
    </div></div>`;
    $('#mClose').onclick = $('#mCancel').onclick = closeModal;
    $('#mSave').onclick = () => {
      const name = $('#cName').value.trim(), email = $('#cEmail').value.trim();
      if (!name || !email) return toast('Nhập đủ thông tin', 'err');
      const nu = Store.createUser(user, { name, email, primaryRole: $('#cRole').value, campus: $('#cCampus').value });
      toast(`Đã tạo ${nu.name}`); closeModal(); navigate(`people/${nu.id}`);
    };
  }

  function openEditUserModal(userId) {
    const u = findUser(userId);
    $('#modalRoot').innerHTML = `<div class="modal-overlay" id="modalOv"><div class="modal">
      <div class="modal-head"><h3>Sửa — ${escAttr(u.name)}</h3><button class="btn btn-ghost btn-sm" id="mClose">✕</button></div>
      <div class="modal-body">
        <div class="field"><label>Họ tên</label><input id="eName" value="${escAttr(u.name)}" /></div>
        <div class="field"><label>Email</label><input id="eEmail" value="${escAttr(u.email)}" /></div>
        <div class="field"><label>Vai trò</label>
          <select id="eRole">${APP_ROLES.map((k) => `<option value="${k}" ${userRole(u) === k ? 'selected' : ''}>${ROLE_LABELS[k]}</option>`).join('')}</select></div>
        <div class="field"><label>Lý do</label><input id="eReason" value="Cập nhật hồ sơ" /></div>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" id="mCancel">Hủy</button><button class="btn btn-primary" id="mSave">Lưu</button></div>
    </div></div>`;
    $('#mClose').onclick = $('#mCancel').onclick = closeModal;
    $('#mSave').onclick = () => {
      Store.updateUser(user, userId, {
        name: $('#eName').value, email: $('#eEmail').value, primaryRole: $('#eRole').value,
      }, $('#eReason').value);
      toast('Đã cập nhật'); closeModal();
      if (routeParams.id) pagePersonDetail(userId); else pagePeople();
    };
  }

  function openAssignPersonModal(userId) {
    const u = findUser(userId);
    const classes = allClasses();
    $('#modalRoot').innerHTML = `<div class="modal-overlay" id="modalOv"><div class="modal">
      <div class="modal-head"><h3>Gán lớp — ${escAttr(u.name)}</h3><button class="btn btn-ghost btn-sm" id="mClose">✕</button></div>
      <div class="modal-body">
        <div class="field"><label>Lớp</label><select id="apClass">${classes.map((c) => `<option value="${c.id}">${c.code}</option>`).join('')}</select></div>
        <div class="field"><label>Vai trò</label>
          <select id="apRole">${Object.keys(ASSIGN_ROLE_FIELDS).map((k) =>
            `<option value="${k}" ${userRole(u) === k ? 'selected' : ''}>${ASSIGN_ROLE_LABELS[k]}</option>`).join('')}</select></div>
        <div class="field"><label>Lý do</label><input id="apReason" value="Phân công bởi QLĐT" /></div>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" id="mCancel">Hủy</button><button class="btn btn-primary" id="mSave">Gán</button></div>
    </div></div>`;
    $('#mClose').onclick = $('#mCancel').onclick = closeModal;
    $('#mSave').onclick = () => {
      Store.changeAssignment(user, $('#apClass').value, $('#apRole').value, u.id, $('#apReason').value);
      toast('Đã gán lớp'); closeModal();
      if (routeParams.id) pagePersonDetail(userId); else pagePeople();
    };
  }

  function pageAdmin() {
    if (!isAdmin()) return denyAccess();
    setPage('Phân công lớp', 'CVHT · LT CN · LT NN · Bí thư · Môn theo khóa');
    $('#content').innerHTML = `
      <div class="panel" style="margin-bottom:14px"><div class="panel-body" style="padding:12px 18px;font-size:.9rem;color:var(--muted)">
        Mỗi lớp thuộc một <strong style="color:var(--ink)">khóa</strong> (K24, K25…) — chọn học kỳ & môn từ khung chương trình của khóa đó.
        Quản lý tại <button type="button" class="btn btn-ghost btn-sm" onclick="App.go('subjects')">Khung CT · Khóa</button>
      </div></div>
      <div class="panel"><div class="table-wrap"><table>
        <thead><tr><th>Lớp</th><th>Khóa</th><th>Môn</th><th>Học kỳ</th><th>Loại</th><th>CVHT</th><th>Lớp trưởng</th><th>Bí thư</th><th></th></tr></thead>
        <tbody>${allClasses().map((c) => {
          const cur = Curriculum.forClass(c.code, c.semester);
          const cohort = cur?.cohortLabel || Curriculum.cohortFromClassCode(c.code) || '—';
          const subLabel = c.subjectCode
            ? `${c.subject || '—'} (${c.subjectCode})`
            : subjectOf(c);
          return `<tr>
          <td><strong>${c.code}</strong><div style="font-size:11px;color:var(--muted)">${c.campusId}${c.level ? ' · ' + c.level : ''}</div></td>
          <td><span class="badge badge-muted">${esc(cohort)}</span></td>
          <td style="font-size:12.5px">${esc(subLabel)}</td>
          <td style="font-size:12px">${esc(Curriculum.semesterLabel(c.semester || cur?.semesterId))}</td>
          <td><span class="badge ${c.programType === 'NGOAI_NGU' ? 'badge-info' : 'badge-muted'}">${c.programType === 'NGOAI_NGU' ? 'NN' : 'CN'}</span></td>
          <td>${userName(c.cvhtId)}</td>
          <td>${c.ltId ? userName(c.ltId) : '—'}</td>
          <td>${c.programType === 'NGOAI_NGU' ? '—' : (c.btId ? userName(c.btId) : '—')}</td>
          <td><button class="btn btn-primary btn-sm" data-edit="${c.id}">Sửa</button></td>
        </tr>`;
        }).join('')}</tbody>
      </table></div></div>
      <button class="btn btn-ghost btn-sm" id="btnReset">Reset dữ liệu local</button>`;
    $$('[data-edit]').forEach((btn) => {
      btn.onclick = () => {
        const c = classById(btn.dataset.edit);
        const isNn = c.programType === 'NGOAI_NGU';
        const prog = Curriculum.programForClass(c.code);
        let semesterId = c.semester || prog?.semesters?.[0]?.semesterId || '';
        const found = c.subjectCode ? Curriculum.findSubjectInProgram(prog, c.subjectCode) : null;
        if (found) semesterId = found.semester.semesterId;
        const paintModal = () => {
          const cur = Curriculum.forClass(c.code, semesterId);
          const subjects = cur?.subjects || [];
          const currentCode = c.subjectCode
            || subjects.find((s) => s.name === c.subject)?.code
            || subjects[0]?.code
            || '';
          const staff = allUsers().filter((u) => !u.aliasOf && APP_ROLES.includes(userRole(u)));
          const opts = (sel, roles) => staff
            .filter((u) => !roles || roles.includes(userRole(u)) || u.id === sel)
            .map((u) => `<option value="${u.id}" ${u.id === sel ? 'selected' : ''}>${u.name} (${ROLE_LABELS[userRole(u)]})</option>`).join('');
          const semOpts = (prog?.semesters || []).map((s) =>
            `<option value="${escAttr(s.semesterId)}" ${s.semesterId === semesterId ? 'selected' : ''}>${esc(s.label || Curriculum.semesterLabel(s.semesterId))}</option>`).join('');
          const subjectOpts = subjects.length
            ? subjects.map((s) =>
              `<option value="${escAttr(s.code)}" ${s.code === currentCode ? 'selected' : ''}>${esc(s.name)} (${esc(s.code)})</option>`).join('')
            : `<option value="">${esc(c.subject || 'Chưa có môn trong HK này')}</option>`;
          $('#modalRoot').innerHTML = `<div class="modal-overlay" id="modalOv"><div class="modal">
            <div class="modal-head"><h3>${c.code}</h3><button class="btn btn-ghost btn-sm" id="mClose">✕</button></div>
            <div class="modal-body">
              <div class="field"><label>Khóa / khung CT</label>
                <input type="text" value="${escAttr((cur?.cohortLabel || Curriculum.cohortFromClassCode(c.code) || '—') + (prog ? ` · ${Curriculum.majorName(prog.majorId)}` : ''))}" disabled /></div>
              <div class="field"><label>Học kỳ</label>
                <select id="aSemester"${prog?.semesters?.length ? '' : ' disabled'}>${semOpts || '<option value="">—</option>'}</select></div>
              <div class="field"><label>Môn học của lớp</label>
                <select id="aSubject"${subjects.length ? '' : ' disabled'}>${subjectOpts}</select>
                ${prog ? '' : '<div style="font-size:12px;color:var(--muted);margin-top:6px">Chưa có khung CT cho khóa này — thêm tại <strong>Khung CT · Khóa</strong>.</div>'}
              </div>
              <div class="field"><label>CVHT</label><select id="aCvht"><option value="">—</option>${opts(c.cvhtId, ['CVHT', 'QLDT'])}</select></div>
              <div class="field"><label>${isNn ? 'Lớp trưởng NN' : 'Lớp trưởng CN'}</label>
                <select id="aLt"><option value="">—</option>${opts(c.ltId, isNn ? ['LOP_TRUONG_NN', 'SINH_VIEN'] : ['LOP_TRUONG', 'SINH_VIEN'])}</select></div>
              ${isNn ? '' : `<div class="field"><label>Bí thư</label><select id="aBt"><option value="">—</option>${opts(c.btId, ['BI_THU', 'SINH_VIEN'])}</select></div>`}
              <div class="field"><label>Lý do</label><input id="aReason" value="Cập nhật phân công" /></div>
            </div>
            <div class="modal-foot"><button class="btn btn-ghost" id="mCancel">Hủy</button><button class="btn btn-primary" id="mSave">Lưu</button></div>
          </div></div>`;
          const close = () => { $('#modalRoot').innerHTML = ''; };
          $('#mClose').onclick = $('#mCancel').onclick = close;
          const aSem = $('#aSemester');
          if (aSem) {
            aSem.onchange = () => {
              semesterId = aSem.value;
              paintModal();
            };
          }
          $('#mSave').onclick = () => {
            const reason = $('#aReason').value;
            const code = ($('#aSubject')?.value || '').trim();
            const semId = ($('#aSemester')?.value || semesterId || '').trim();
            const picked = Curriculum.subjectByCode(c.code, code, semId)
              || (Curriculum.forClass(c.code, semId)?.subjects || []).find((x) => x.code === code);
            Store.update((d) => {
              const item = d.classes.find((x) => x.id === c.id);
              if (item && picked) {
                const before = `${item.subject || ''} (${item.subjectCode || ''})`;
                item.subject = picked.name;
                item.subjectCode = picked.code;
                item.semester = semId || picked.semesterId || item.semester;
                d.auditLog.unshift({
                  id: Store.uid('al'), actorId: user.id, actorName: user.name,
                  action: 'CLASS_SUBJECT', entity: 'Class', entityId: c.id,
                  beforeJson: before, afterJson: `${picked.name} (${picked.code}) · ${semId}`, at: new Date().toISOString(),
                });
              }
            });
            const ltRole = isNn ? 'LOP_TRUONG_NN' : 'LOP_TRUONG';
            const changes = [
              ['CVHT', $('#aCvht').value || null, c.cvhtId],
              [ltRole, $('#aLt').value || null, c.ltId],
            ];
            if (!isNn) changes.push(['BI_THU', $('#aBt').value || null, c.btId]);
            changes.forEach(([rk, next, prev]) => { if (next !== (prev || null)) Store.changeAssignment(user, c.id, rk, next, reason); });
            toast('Đã cập nhật'); close(); pageAdmin();
          };
        };
        paintModal();
      };
    });
    $('#btnReset').onclick = () => {
      if (!confirm('Reset toàn bộ dữ liệu local?')) return;
      Store.reset(); Store.setSession(user); toast('Đã reset'); location.reload();
    };
  }

  function pageSubjects() {
    if (!isAdmin()) return denyAccess();
    const programs = Curriculum.programEntries();
    const majorFilter = state.subjectMajorFilter || '';
    const cohortFilter = state.subjectCohortFilter || '';
    let filtered = programs;
    if (majorFilter) filtered = filtered.filter((p) => p.majorId === majorFilter);
    if (cohortFilter) filtered = filtered.filter((p) => Curriculum.normalizeCohort(p.cohort) === cohortFilter);
    const majors = SEED.majors.filter((m) => m.id !== 'ENG');
    const cohorts = [...new Set(programs.map((p) => Curriculum.normalizeCohort(p.cohort)).filter(Boolean))]
      .sort((a, b) => b.localeCompare(a));

    setPage('Khung chương trình · Khóa', `${programs.length} khóa/ngành · mỗi khóa có khung HK riêng`);
    $('#content').innerHTML = `
      <div class="panel" style="margin-bottom:14px"><div class="panel-body" style="padding:12px 18px;font-size:.9rem;color:var(--muted)">
        Cấu trúc: <strong style="color:var(--ink)">Ngành → Khóa (K24, K25…)</strong> → Học kỳ → Môn.
        Mỗi khóa có khung chương trình riêng; thêm K26/K27 khi có lớp mới.
      </div></div>
      <div class="admin-toolbar" style="margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <select id="subMajorFilter" style="min-width:160px">
          <option value="">Tất cả ngành</option>
          ${majors.map((m) => `<option value="${m.id}" ${majorFilter === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
        </select>
        <select id="subCohortFilter" style="min-width:140px">
          <option value="">Tất cả khóa</option>
          ${cohorts.map((k) => `<option value="${k}" ${cohortFilter === k ? 'selected' : ''}>Khóa ${k.replace(/^K/i, '')}</option>`).join('')}
        </select>
        <button type="button" class="btn btn-primary btn-sm" id="btnAddProgram">+ Thêm khóa / ngành</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="App.go('admin')">← Phân công lớp</button>
      </div>
      ${filtered.length ? filtered.map((p) => `
        <section class="panel subject-track-panel" style="margin-bottom:18px">
          <div class="panel-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
            <div>
              <h2 style="margin:0;font-size:1.05rem">${esc(Curriculum.majorName(p.majorId))} · ${esc(p.cohortLabel || `Khóa ${String(p.cohort || '').replace(/^K/i, '')}`)}</h2>
              <div style="font-size:12px;color:var(--muted);margin-top:4px">
                ID: <code>${esc(p.id)}</code>
                · Match lớp: <code>${esc(p.matchPattern || '')}</code>
                · ${(p.semesters || []).length} học kỳ
                · ${(p.semesters || []).reduce((n, s) => n + (s.subjects || []).length, 0)} môn
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="btn btn-ghost btn-sm" data-edit-prog="${escAttr(p.id)}">Sửa khóa</button>
              <button type="button" class="btn btn-primary btn-sm" data-add-sem="${escAttr(p.id)}">+ Học kỳ</button>
            </div>
          </div>
          ${(p.semesters || []).length ? p.semesters.map((sem, sIdx) => `
            <div class="semester-curr-block" style="padding:12px 16px;border-top:1px solid var(--line)">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
                <div>
                  <strong>${esc(sem.label || Curriculum.semesterLabel(sem.semesterId))}</strong>
                  <span style="font-size:12px;color:var(--muted)"> · ${esc(sem.semesterId)} · ${(sem.subjects || []).length} môn</span>
                </div>
                <div style="display:flex;gap:6px">
                  <button type="button" class="btn btn-ghost btn-sm" data-edit-sem="${escAttr(p.id)}" data-sidx="${sIdx}">Sửa HK</button>
                  <button type="button" class="btn btn-primary btn-sm" data-add-subj="${escAttr(p.id)}" data-sidx="${sIdx}">+ Môn</button>
                </div>
              </div>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Mã môn</th><th>Tên môn</th><th style="width:120px"></th></tr></thead>
                  <tbody>
                    ${(sem.subjects || []).length ? sem.subjects.map((s, idx) => `
                      <tr>
                        <td><code>${esc(s.code)}</code></td>
                        <td>${esc(s.name)}</td>
                        <td>
                          <button type="button" class="btn btn-ghost btn-sm" data-edit-subj="${escAttr(p.id)}" data-sidx="${sIdx}" data-idx="${idx}">Sửa</button>
                          <button type="button" class="btn btn-ghost btn-sm" data-del-subj="${escAttr(p.id)}" data-sidx="${sIdx}" data-idx="${idx}">Xóa</button>
                        </td>
                      </tr>`).join('') : '<tr><td colspan="3" style="color:var(--muted)">Chưa có môn — bấm + Môn</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>`).join('') : '<div style="padding:16px;color:var(--muted)">Chưa có học kỳ — bấm <strong>+ Học kỳ</strong> để thêm khung HK cho khóa này.</div>'}
        </section>`).join('') : '<div class="empty panel" style="padding:28px">Chưa có khung CT. Bấm <strong>+ Thêm khóa / ngành</strong> (vd. CNTT · K26).</div>'}`;

    const mf = $('#subMajorFilter');
    if (mf) mf.onchange = () => { state.subjectMajorFilter = mf.value; pageSubjects(); };
    const cf = $('#subCohortFilter');
    if (cf) cf.onchange = () => { state.subjectCohortFilter = cf.value; pageSubjects(); };

    const openProgramModal = (progId = null) => {
      const p = progId ? Curriculum.programById(progId) : null;
      const cohortVal = Curriculum.normalizeCohort(p?.cohort) || 'K26';
      $('#modalRoot').innerHTML = `<div class="modal-overlay"><div class="modal">
        <div class="modal-head"><h3>${progId ? 'Sửa khóa / ngành' : 'Thêm khóa / ngành'}</h3>
          <button class="btn btn-ghost btn-sm" id="mClose">✕</button></div>
        <div class="modal-body">
          <div class="field"><label>Ngành</label>
            <select id="pMajor" ${progId ? 'disabled' : ''}>${majors.map((m) =>
              `<option value="${m.id}" ${(p?.majorId || 'CNTT') === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Khóa</label>
            <select id="pCohort" ${progId ? 'disabled' : ''}>
              ${['K23', 'K24', 'K25', 'K26', 'K27', 'K28'].map((k) =>
                `<option value="${k}" ${cohortVal === k ? 'selected' : ''}>Khóa ${k.replace('K', '')}</option>`).join('')}
            </select>
            <div style="font-size:11.5px;color:var(--muted);margin-top:4px">Mỗi khóa có khung chương trình & học kỳ riêng.</div>
          </div>
          <div class="field"><label>Nhãn khóa</label>
            <input id="pCohortLabel" value="${escAttr(p?.cohortLabel || '')}" placeholder="Khóa 26" /></div>
          <div class="field"><label>Regex match mã lớp</label>
            <input id="pMatch" value="${escAttr(p?.matchPattern || '')}" placeholder="Tự sinh theo ngành + khóa" />
            <div style="font-size:11.5px;color:var(--muted);margin-top:4px">Để trống sẽ tự tạo (vd. CNTT K25 → <code>^(HN|HCM)-KS25-CNTT</code>).</div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="mCancel">Hủy</button>
          <button class="btn btn-primary" id="mSave">Lưu</button>
        </div>
      </div></div>`;
      const close = () => { $('#modalRoot').innerHTML = ''; };
      $('#mClose').onclick = $('#mCancel').onclick = close;
      const syncMatchHint = () => {
        if (progId) return;
        const el = $('#pMatch');
        if (el && !el.dataset.touched) {
          el.value = Curriculum.defaultMatchPattern($('#pMajor').value, $('#pCohort').value);
        }
      };
      if (!progId) {
        syncMatchHint();
        $('#pMajor').onchange = syncMatchHint;
        $('#pCohort').onchange = () => {
          $('#pCohortLabel').value = `Khóa ${$('#pCohort').value.replace(/^K/i, '')}`;
          syncMatchHint();
        };
        $('#pMatch').oninput = () => { $('#pMatch').dataset.touched = '1'; };
      }
      $('#mSave').onclick = () => {
        const majorId = progId ? p.majorId : $('#pMajor').value;
        const cohort = Curriculum.normalizeCohort(progId ? p.cohort : $('#pCohort').value);
        const id = progId || `${majorId}_${cohort}`;
        if (!progId && Curriculum.programById(id)) {
          toast('Khóa + ngành này đã tồn tại', 'err');
          return;
        }
        const cohortLabel = ($('#pCohortLabel').value || '').trim() || `Khóa ${cohort.replace(/^K/i, '')}`;
        const matchPattern = ($('#pMatch').value || '').trim() || Curriculum.defaultMatchPattern(majorId, cohort);
        Store.update((d) => {
          if (!d.curriculumPrograms) d.curriculumPrograms = Curriculum.defaultPrograms();
          const prev = d.curriculumPrograms[id] || { semesters: [] };
          d.curriculumPrograms[id] = {
            ...prev,
            majorId,
            cohort,
            cohortLabel,
            matchPattern,
            semesters: prev.semesters || [],
          };
          d.auditLog.unshift({
            id: Store.uid('al'), actorId: user.id, actorName: user.name,
            action: progId ? 'CURRICULUM_UPDATE' : 'CURRICULUM_CREATE',
            entity: 'Curriculum', entityId: id,
            beforeJson: progId ? JSON.stringify({ cohort: p.cohort }) : '',
            afterJson: JSON.stringify({ majorId, cohort, matchPattern }),
            at: new Date().toISOString(),
          });
        });
        toast(progId ? 'Đã cập nhật khóa' : `Đã thêm ${Curriculum.majorName(majorId)} · ${cohortLabel}`);
        close();
        pageSubjects();
      };
    };

    const openSemesterModal = (progId, sIdx = null) => {
      const p = Curriculum.programById(progId);
      const sem = sIdx != null ? p?.semesters?.[sIdx] : null;
      $('#modalRoot').innerHTML = `<div class="modal-overlay"><div class="modal">
        <div class="modal-head"><h3>${sem ? 'Sửa học kỳ' : 'Thêm học kỳ'} · ${esc(p?.cohortLabel || '')}</h3>
          <button class="btn btn-ghost btn-sm" id="mClose">✕</button></div>
        <div class="modal-body">
          <div class="field"><label>Mã học kỳ</label>
            <input id="sSemId" value="${escAttr(sem?.semesterId || '2026-HK1')}" placeholder="2026-HK1" /></div>
          <div class="field"><label>Key ngắn</label>
            <input id="sKey" value="${escAttr(sem?.key || 'HK1')}" placeholder="HK1" /></div>
          <div class="field"><label>Nhãn hiển thị</label>
            <input id="sLabel" value="${escAttr(sem?.label || '')}" placeholder="Học kỳ 1 · 2026–2027" /></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="mCancel">Hủy</button>
          <button class="btn btn-primary" id="mSave">Lưu</button>
        </div>
      </div></div>`;
      const close = () => { $('#modalRoot').innerHTML = ''; };
      $('#mClose').onclick = $('#mCancel').onclick = close;
      $('#mSave').onclick = () => {
        const semesterId = ($('#sSemId').value || '').trim();
        const key = ($('#sKey').value || '').trim() || semesterId.replace(/^\d{4}-/, '');
        const label = ($('#sLabel').value || '').trim() || Curriculum.semesterLabel(semesterId);
        if (!semesterId) { toast('Nhập mã học kỳ', 'err'); return; }
        let duplicate = false;
        Store.update((d) => {
          const prog = d.curriculumPrograms?.[progId];
          if (!prog) return;
          const list = [...(prog.semesters || [])];
          if (sIdx != null) {
            list[sIdx] = { ...list[sIdx], key, semesterId, label, subjects: list[sIdx].subjects || [] };
          } else {
            if (list.some((x) => x.semesterId === semesterId)) {
              duplicate = true;
              return;
            }
            list.push({ key, semesterId, label, subjects: [] });
          }
          prog.semesters = list;
          d.auditLog.unshift({
            id: Store.uid('al'), actorId: user.id, actorName: user.name,
            action: sIdx != null ? 'SEMESTER_UPDATE' : 'SEMESTER_CREATE',
            entity: 'Curriculum', entityId: progId,
            beforeJson: sem ? sem.semesterId : '',
            afterJson: semesterId,
            at: new Date().toISOString(),
          });
        });
        if (duplicate) { toast('Học kỳ đã tồn tại trong khóa', 'err'); return; }
        toast(sem ? 'Đã cập nhật HK' : 'Đã thêm học kỳ');
        close();
        pageSubjects();
      };
    };

    const openSubjectModal = (progId, sIdx, idx = null) => {
      const p = Curriculum.programById(progId);
      const sem = p?.semesters?.[sIdx];
      const s = idx != null ? sem?.subjects?.[idx] : null;
      $('#modalRoot').innerHTML = `<div class="modal-overlay"><div class="modal">
        <div class="modal-head"><h3>${s ? 'Sửa môn' : 'Thêm môn'} · ${esc(sem?.label || '')}</h3>
          <button class="btn btn-ghost btn-sm" id="mClose">✕</button></div>
        <div class="modal-body">
          <div class="field"><label>Mã môn</label>
            <input id="sCode" value="${escAttr(s?.code || '')}" placeholder="VD: IT212-K24" /></div>
          <div class="field"><label>Tên môn</label>
            <input id="sName" value="${escAttr(s?.name || '')}" placeholder="VD: AI Application in Action" /></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="mCancel">Hủy</button>
          <button class="btn btn-primary" id="mSave">Lưu</button>
        </div>
      </div></div>`;
      const close = () => { $('#modalRoot').innerHTML = ''; };
      $('#mClose').onclick = $('#mCancel').onclick = close;
      $('#mSave').onclick = () => {
        const code = ($('#sCode').value || '').trim();
        const name = ($('#sName').value || '').trim();
        if (!code || !name) { toast('Nhập đủ mã và tên môn', 'err'); return; }
        const existing = sem?.subjects || [];
        if (idx == null && existing.some((x) => x.code === code)) {
          toast('Mã môn đã có trong học kỳ', 'err');
          return;
        }
        if (idx != null && existing.some((x, i) => i !== idx && x.code === code)) {
          toast('Mã môn đã có trong học kỳ', 'err');
          return;
        }
        Store.update((d) => {
          const list = d.curriculumPrograms?.[progId]?.semesters?.[sIdx]?.subjects;
          if (!list) return;
          const next = [...list];
          if (idx != null) next[idx] = { code, name };
          else next.push({ code, name });
          d.curriculumPrograms[progId].semesters[sIdx].subjects = next;
          d.auditLog.unshift({
            id: Store.uid('al'), actorId: user.id, actorName: user.name,
            action: idx != null ? 'SUBJECT_UPDATE' : 'SUBJECT_CREATE',
            entity: 'Curriculum', entityId: progId,
            beforeJson: s ? `${s.code} · ${s.name}` : '',
            afterJson: `${code} · ${name}`,
            at: new Date().toISOString(),
          });
        });
        toast(s ? 'Đã cập nhật môn' : 'Đã thêm môn');
        close();
        pageSubjects();
      };
    };

    $('#btnAddProgram').onclick = () => openProgramModal(null);
    $$('[data-edit-prog]').forEach((b) => { b.onclick = () => openProgramModal(b.dataset.editProg); });
    $$('[data-add-sem]').forEach((b) => { b.onclick = () => openSemesterModal(b.dataset.addSem); });
    $$('[data-edit-sem]').forEach((b) => {
      b.onclick = () => openSemesterModal(b.dataset.editSem, Number(b.dataset.sidx));
    });
    $$('[data-add-subj]').forEach((b) => {
      b.onclick = () => openSubjectModal(b.dataset.addSubj, Number(b.dataset.sidx));
    });
    $$('[data-edit-subj]').forEach((b) => {
      b.onclick = () => openSubjectModal(b.dataset.editSubj, Number(b.dataset.sidx), Number(b.dataset.idx));
    });
    $$('[data-del-subj]').forEach((b) => {
      b.onclick = () => {
        const progId = b.dataset.delSubj;
        const sIdx = Number(b.dataset.sidx);
        const idx = Number(b.dataset.idx);
        const sub = Curriculum.programById(progId)?.semesters?.[sIdx]?.subjects?.[idx];
        if (!sub || !confirm(`Xóa môn ${sub.code} — ${sub.name}?`)) return;
        Store.update((d) => {
          const list = d.curriculumPrograms?.[progId]?.semesters?.[sIdx]?.subjects;
          if (!list) return;
          const removed = list.splice(idx, 1)[0];
          d.auditLog.unshift({
            id: Store.uid('al'), actorId: user.id, actorName: user.name,
            action: 'SUBJECT_DELETE', entity: 'Curriculum', entityId: progId,
            beforeJson: `${removed.code} · ${removed.name}`, afterJson: '', at: new Date().toISOString(),
          });
        });
        toast('Đã xóa môn');
        pageSubjects();
      };
    });
  }

  function pageAudit() {
    if (!isAdmin()) return denyAccess();
    const tab = state.auditTab || 'a';
    const t = getTrace('audit');
    const logs = db().auditLog || [];
    const ah = db().assignmentHistory || [];
    const scopeClasses = allClasses();

    const filteredLogs = logs.filter((l) => {
      const s = l.entity === 'Student' ? allStudents().find((x) => x.id === l.entityId) : null;
      const cls = l.entity === 'Class' ? classById(l.entityId) : (s ? classById(s.classId) : null);
      return passTrace(t, {
        at: l.at,
        classId: cls?.id || s?.classId || '',
        searchText: [
          l.actorName, auditActionLabel(l.action), auditEntityLabel(l.entity),
          l.entityId, formatAuditSnippet(l.beforeJson), formatAuditSnippet(l.afterJson),
          s?.name, cls?.code,
        ].join(' '),
      });
    });

    const filteredAh = ah.filter((h) => passTrace(t, {
      at: h.at,
      classId: h.classId,
      searchText: [
        classById(h.classId)?.code,
        ASSIGN_ROLE_LABELS[h.role],
        h.fromUserName, h.toUserName, h.reason,
      ].join(' '),
    }));

    setPage('Nhật ký thay đổi', 'Truy vết theo nội dung · lớp · ngày');
    $('#content').innerHTML = `
      <div class="tabs" id="auditTabs">
        <button class="tab ${tab === 'a' ? 'active' : ''}" data-tab="a">Hệ thống (${filteredLogs.length}/${logs.length})</button>
        <button class="tab ${tab === 'b' ? 'active' : ''}" data-tab="b">Phân công (${filteredAh.length}/${ah.length})</button>
      </div>
      ${traceBarHTML('audit', {
        classes: scopeClasses,
        placeholder: 'Tìm người, hành động, lớp, nội dung trước/sau…',
        resultText: tab === 'a' ? `${filteredLogs.length} sự kiện` : `${filteredAh.length} phân công`,
      })}
      <div id="auditBody">${tab === 'a' ? `
        <div class="panel"><div class="table-wrap"><table class="trace-table">
          <thead><tr><th>Thời gian</th><th>Hành động</th><th>Đối tượng</th><th>Người</th><th>Trước → Sau</th></tr></thead>
          <tbody>${filteredLogs.length ? filteredLogs.map((l) => {
            const s = l.entity === 'Student' ? allStudents().find((x) => x.id === l.entityId) : null;
            const who = s?.name || (l.entity === 'Class' ? classById(l.entityId)?.code : l.entityId) || '—';
            return `<tr>
              <td class="trace-time">${Scoring.fmtDateTime(l.at)}</td>
              <td><span class="badge badge-brand">${esc(auditActionLabel(l.action))}</span></td>
              <td><span class="badge badge-muted">${esc(auditEntityLabel(l.entity))}</span>
                <div class="trace-sub">${esc(who)}</div></td>
              <td>${esc(l.actorName || '—')}</td>
              <td>
                <div class="trace-diff-inline">
                  <span class="from">${esc(formatAuditSnippet(l.beforeJson))}</span>
                  <span class="hist-arrow">→</span>
                  <span class="to">${esc(formatAuditSnippet(l.afterJson))}</span>
                </div>
              </td>
            </tr>`;
          }).join('') : `<tr><td colspan="5"><div class="empty">${logs.length ? 'Không có sự kiện khớp bộ lọc' : 'Trống'}</div></td></tr>`}
          </tbody></table></div></div>` : `
        <div class="panel"><div class="table-wrap"><table class="trace-table">
          <thead><tr><th>Thời gian</th><th>Lớp</th><th>Vai trò</th><th>Trước</th><th>Sau</th><th>Lý do</th></tr></thead>
          <tbody>${filteredAh.length ? filteredAh.map((h) => `<tr>
            <td class="trace-time">${Scoring.fmtDateTime(h.at)}</td>
            <td><strong>${esc(classById(h.classId)?.code || '—')}</strong></td>
            <td>${esc(ASSIGN_ROLE_LABELS[h.role] || h.role)}</td>
            <td>${esc(h.fromUserName || '—')}</td>
            <td>${esc(h.toUserName || '—')}</td>
            <td><div class="trace-cell-note">${esc(h.reason || '—')}</div></td>
          </tr>`).join('') : `<tr><td colspan="6"><div class="empty">${ah.length ? 'Không có mục khớp bộ lọc' : 'Trống'}</div></td></tr>`}
          </tbody></table></div></div>`}
      </div>`;

    $$('#auditTabs .tab').forEach((btn) => {
      btn.onclick = () => {
        state.auditTab = btn.dataset.tab;
        pageAudit();
      };
    });
    bindTraceBar('audit', pageAudit);
  }

  function auditActionLabel(action) {
    return {
      REPORT_SUBMIT: 'Gửi báo cáo',
      RPOINT_EVAL: 'Chấm R-Point',
      SEED_IMPORT: 'Khởi tạo dữ liệu',
      USER_CREATE: 'Tạo người dùng',
      USER_UPDATE: 'Cập nhật người dùng',
      ASSIGNMENT_CHANGE: 'Đổi phân công',
      CLASS_SUBJECT: 'Đổi môn học lớp',
      STUDENT_STATUS: 'Cập nhật trạng thái SV',
      COUNSEL_NOTE: 'Biên bản tư vấn',
      ESCALATE: 'Chuyển QLĐT',
      ESCALATE_NOTE: 'Ghi chú case QLĐT',
      ESCALATE_RESOLVE: 'Đóng case QLĐT',
      CURRICULUM_CREATE: 'Tạo khóa / ngành',
      CURRICULUM_UPDATE: 'Sửa khóa / ngành',
      SEMESTER_CREATE: 'Thêm học kỳ',
      SEMESTER_UPDATE: 'Sửa học kỳ',
      SUBJECT_CREATE: 'Thêm môn',
      SUBJECT_UPDATE: 'Sửa môn',
      SUBJECT_DELETE: 'Xóa môn',
    }[action] || action;
  }

  function auditEntityLabel(entity) {
    return {
      Report: 'Báo cáo',
      RPoint: 'R-Point',
      System: 'Hệ thống',
      User: 'Người dùng',
      Class: 'Lớp',
      Assignment: 'Phân công',
      Student: 'Sinh viên',
      Curriculum: 'Chương trình môn',
    }[entity] || entity;
  }

  function formatAuditSnippet(raw) {
    if (raw == null || raw === '') return '—';
    const s = String(raw).trim();
    if (!s) return '—';
    if (s === 'DRAFT') return 'Bản nháp';
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        return humanizeAuditObject(JSON.parse(s));
      } catch { /* plain text below */ }
    }
    return s;
  }

  function humanizeAuditObject(o) {
    if (o == null) return '—';
    if (typeof o !== 'object') return String(o);
    if (Array.isArray(o)) return o.map(humanizeAuditObject).join(', ');

    const parts = [];
    if (o.kind) parts.push(`Loại: ${REPORT_KIND_LABELS[o.kind] || o.kind}`);
    if (o.status) parts.push(`Trạng thái: ${STATUS_LABELS[o.status]?.label || o.status}`);
    if (o.classId) {
      const c = classById(o.classId);
      parts.push(`Lớp: ${c?.code || o.classId}`);
    }
    if (o.subject) parts.push(`Môn: ${o.subject}`);
    if (o.totalScore != null) parts.push(`Điểm: ${o.totalScore}/100`);
    if (o.total != null) parts.push(`R-Point: ${o.total}/10`);
    if (o.ltId) parts.push(`Lớp trưởng: ${userName(o.ltId)}`);
    if (o.itId) parts.push(`Người liên quan: ${userName(o.itId)}`);
    if (o.name) parts.push(`Họ tên: ${o.name}`);
    if (o.email) parts.push(`Email: ${o.email}`);
    if (o.primaryRole) parts.push(`Vai trò: ${ROLE_LABELS[o.primaryRole] || o.primaryRole}`);
    if (o.role) parts.push(`Vai trò gán: ${ASSIGN_ROLE_LABELS[o.role] || ROLE_LABELS[o.role] || o.role}`);
    if (o.reason) parts.push(`Lý do: ${o.reason}`);
    if (o.cvhtId) parts.push(`CVHT: ${userName(o.cvhtId)}`);
    if (o.btId) parts.push(`Bí thư: ${userName(o.btId)}`);

    const used = new Set(['kind', 'status', 'classId', 'subject', 'totalScore', 'total', 'ltId', 'itId', 'name', 'email', 'primaryRole', 'role', 'reason', 'cvhtId', 'btId']);
    Object.entries(o).forEach(([k, v]) => {
      if (used.has(k) || v == null || v === '') return;
      if (typeof v === 'object') return;
      parts.push(`${k}: ${v}`);
    });

    return parts.length ? parts.join(' · ') : '—';
  }

  function pageSheets() {
    if (!isAdmin()) return denyAccess();
    const on = SheetsAPI.enabled();
    const tabs = (SheetsAPI.SHEET_NAMES || []).join(', ');
    setPage('Google Sheets', on ? 'Đang dùng Sheets (chia sẻ qua Web App)' : 'Đang dùng localStorage trên máy này');
    $('#content').innerHTML = `
      <div class="panel" style="margin-bottom:14px">
        <div class="panel-body" style="line-height:1.75;font-size:.9rem;color:var(--muted)">
          <p><strong style="color:var(--ink)">Kiến trúc:</strong> GitHub Pages (static) + Google Apps Script Web App (API) + Google Spreadsheet (DB).</p>
          <ol style="margin:10px 0 0 18px">
            <li>Tạo Spreadsheet mới → Extensions → Apps Script → dán <code>sheets/Code.gs.txt</code> → Save.</li>
            <li>Trong Apps Script: chọn hàm <code>setupSheets</code> → Run (cấp quyền) → tạo đủ tab.</li>
            <li>Deploy → New deployment → Type <strong>Web app</strong> → Execute as <em>Me</em> · Who has access <em>Anyone</em> → Deploy → copy URL.</li>
            <li>Sửa <code>js/config.js</code>: <code>mode: 'sheets'</code>, <code>sheetsWebAppUrl: 'URL…'</code> → commit &amp; push GitHub.</li>
            <li>Đăng nhập QLĐT → trang này → <strong>Đẩy lên Sheets</strong> (seed lần đầu) · sau đó mọi máy <strong>Kéo từ Sheets</strong> / app tự kéo khi mở.</li>
          </ol>
          <p style="margin-top:12px">Tabs: <code style="font-size:11.5px">${esc(tabs)}</code></p>
          <p style="margin-top:8px">Trạng thái: <span class="badge ${on ? 'badge-ok' : 'badge-warn'}">${on ? 'sheets' : 'local'}</span>
            ${on ? '' : ' — sửa config.js rồi reload để bật đồng bộ.'}</p>
        </div>
      </div>
      <div class="panel" style="margin-bottom:14px">
        <div class="panel-head"><h2>Đồng bộ</h2></div>
        <div class="panel-body" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" id="btnPullSheets" ${on ? '' : 'disabled'}>↓ Kéo từ Sheets</button>
          <button class="btn btn-ok btn-sm" id="btnPushSheets" ${on ? '' : 'disabled'}>↑ Đẩy lên Sheets</button>
          ${!on ? '<span style="font-size:12.5px;color:var(--muted);align-self:center">Bật mode sheets trong config.js để dùng 2 nút này</span>' : ''}
        </div>
      </div>
      <div class="panel"><div class="panel-head"><h2>Xuất CSV (sao lưu tay)</h2></div>
        <div class="panel-body">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" data-csv="classes">Xuất Classes</button>
            <button class="btn btn-ghost btn-sm" data-csv="users">Xuất Users</button>
            <button class="btn btn-ghost btn-sm" data-csv="reports">Xuất Reports</button>
            <button class="btn btn-ghost btn-sm" data-csv="auditLog">Xuất AuditLog</button>
          </div>
        </div>
      </div>`;
    const pull = $('#btnPullSheets');
    if (pull) {
      pull.onclick = async () => {
        pull.disabled = true;
        try {
          await Store.pullFromSheets();
          toast('Đã kéo dữ liệu từ Google Sheets');
          pageSheets();
        } catch (err) {
          toast(err.message || 'Lỗi kéo Sheets', 'err');
          pull.disabled = false;
        }
      };
    }
    const push = $('#btnPushSheets');
    if (push) {
      push.onclick = async () => {
        push.disabled = true;
        try {
          const r = await Store.pushAllToSheets();
          toast(`Đã đẩy ${r.sheets} tab lên Google Sheets`);
        } catch (err) {
          toast(err.message || 'Lỗi đẩy Sheets', 'err');
        }
        push.disabled = false;
      };
    }
    $$('[data-csv]').forEach((btn) => {
      btn.onclick = () => {
        const map = {
          classes: { cols: SheetsAPI.SCHEMA.Classes, rows: allClasses() },
          users: { cols: SheetsAPI.SCHEMA.Users, rows: allUsers() },
          reports: { cols: ['id', 'classId', 'reporterId', 'reportKind', 'status', 'totalScore', 'createdAt'], rows: db().reports },
          auditLog: { cols: SheetsAPI.SCHEMA.AuditLog, rows: db().auditLog },
        };
        const conf = map[btn.dataset.csv];
        SheetsAPI.downloadCSV(`cvht_${btn.dataset.csv}.csv`, SheetsAPI.toCSV(conf.rows, conf.cols));
        toast('Đã xuất CSV');
      };
    });
  }

  function pageNotifications() {
    const list = db().notifications.filter((n) => n.userId === user.id || n.userId === real());
    setPage('Thông báo', `${list.filter((n) => !n.read).length} chưa đọc`);
    $('#content').innerHTML = `<div class="panel"><div class="panel-body">
      ${list.length ? list.map((n) => `
        <div style="padding:12px 0;border-bottom:1px solid var(--line-soft);display:flex;gap:12px">
          <div style="width:8px;height:8px;border-radius:50%;margin-top:6px;background:${n.read ? 'var(--line)' : 'var(--brand)'}"></div>
          <div><strong>${esc(n.title)}</strong>
            <p style="font-size:.875rem;color:var(--muted);margin-top:3px">${esc(n.body)}</p>
            <div style="font-size:11.5px;color:var(--muted)">${Scoring.fmtDateTime(n.createdAt)}</div>
          </div>
        </div>`).join('') : '<div class="empty">Không có thông báo</div>'}
      ${list.length ? '<button class="btn btn-ghost btn-sm" id="btnReadAll" style="margin-top:12px">Đánh dấu đã đọc</button>' : ''}
    </div></div>`;
    const btn = $('#btnReadAll');
    if (btn) btn.onclick = () => {
      Store.update((d) => d.notifications.forEach((n) => { if (n.userId === user.id || n.userId === real()) n.read = true; }));
      toast('Đã đọc hết'); renderShell(); pageNotifications();
    };
  }

  /* ========== GUIDE ========== */
  function pageGuide() {
    setPage('Hướng dẫn', 'Chuyên ngành + Ngoại ngữ');
    $('#content').innerHTML = `
      ${flowBanner()}
      <div class="cta-hero" style="padding:20px 24px">
        <div>
          <h2>Hai luồng vận hành</h2>
          <p><strong>Chuyên ngành:</strong> Bí thư → CVHT · Lớp trưởng → CVHT · rồi CVHT → QLĐT. &nbsp; <strong>Ngoại ngữ:</strong> Lớp trưởng NN → CVHT → QLĐT (+ R-Point).</p>
        </div>
      </div>
      <div class="grid-2">
        <div class="panel">
          <div class="panel-head"><h2>1. Bí thư (CN)</h2></div>
          <div class="panel-body" style="font-size:.9rem;line-height:1.7;color:var(--muted)">
            <p>Phụ trách <strong style="color:var(--ink)">hoạt động, phong trào, truyền thông</strong>.</p>
            <p style="margin-top:8px">Gửi báo cáo tuần thẳng cho <strong style="color:var(--ink)">CVHT</strong> (không qua Lớp trưởng).</p>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>2. Lớp trưởng (CN)</h2></div>
          <div class="panel-body" style="font-size:.9rem;line-height:1.7;color:var(--muted)">
            <p>Tổng hợp tình hình lớp → gửi <strong style="color:var(--ink)">CVHT</strong> (song song với Bí thư).</p>
            <p style="margin-top:8px">Thang đánh giá cuối kỳ: <strong style="color:var(--ink)">100 điểm</strong>.</p>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>3. Lớp trưởng Ngoại ngữ</h2></div>
          <div class="panel-body" style="font-size:.9rem;line-height:1.7;color:var(--muted)">
            <p>Mỗi lớp NN chỉ có <strong style="color:var(--ink)">01 Lớp trưởng</strong> (không Bí thư).</p>
            <p style="margin-top:8px">Báo cáo tuần: chuyên cần, BTVN, SV nguy cơ → <strong style="color:var(--ink)">CVHT</strong>.</p>
            <p style="margin-top:8px">Cuối học phần: đánh giá <strong style="color:var(--ink)">R-Point tối đa 10</strong> (Điều 13).</p>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>4. CVHT → QLĐT</h2></div>
          <div class="panel-body" style="font-size:.9rem;line-height:1.7;color:var(--muted)">
            <p><strong style="color:var(--ink)">CVHT</strong> nhận BC từ Bí thư + LT (CN/NN), vào lớp quan sát, tổng hợp gửi QLĐT; ghi nhận R-Point NN.</p>
            <p style="margin-top:8px"><strong style="color:var(--ink)">QLĐT</strong> xem full mọi phần và phê duyệt.</p>
          </div>
        </div>
      </div>
      <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="App.go('demo')">Mở Demo luồng →</button>
        <button class="btn btn-ghost" onclick="App.go('dashboard')">Về tổng quan</button>
      </div>`;
  }

  /* ========== DEMO ========== */
  function pageDemo() {
    setPage('Demo luồng', 'BT→CVHT · LT→CVHT · LT NN→CVHT · CVHT→QLĐT');
    const overall = DEMO_FLOWS.reduce((acc, f) => {
      const p = DemoKit.flowProgress(f);
      return { done: acc.done + p.done, total: acc.total + p.total };
    }, { done: 0, total: 0 });
    const pct = overall.total ? Math.round((overall.done / overall.total) * 100) : 0;

    $('#content').innerHTML = `
      ${flowBanner()}
      <div class="cta-hero">
        <div>
          <h2>Demo end-to-end · CN + Ngoại ngữ</h2>
          <p>Bí thư &amp; Lớp trưởng gửi song song tới CVHT · LT NN → CVHT · CVHT tổng hợp → QLĐT (+ R-Point NN).</p>
        </div>
        <div class="score-ring" style="--p:${pct}%"><span>${pct}%</span></div>
      </div>
      <div class="admin-toolbar">
        <strong style="font-size:13px;align-self:center">Chuyển vai trò:</strong>
        ${DEMO_ACCOUNTS.map((a) => `
          <button class="btn ${a.email === user.email ? 'btn-primary' : 'btn-ghost'} btn-sm" data-switch="${a.email}">${a.label}</button>
        `).join('')}
        <span style="flex:1"></span>
        <button class="btn btn-ok btn-sm" id="btnSeed">Gieo dữ liệu demo</button>
        <button class="btn btn-ghost btn-sm" id="btnResetProg">Reset checklist</button>
      </div>
      ${DEMO_FLOWS.map((flow) => {
        const prog = DemoKit.flowProgress(flow);
        return `<div class="flow-card">
          <div class="flow-head">
            <div>
              <h3>${esc(flow.title)}</h3>
              <p>${esc(flow.desc)}</p>
              <div class="role-chips" style="margin-top:8px">${flow.roles.map((r) => `<span class="badge badge-muted">${ROLE_LABELS[r]}</span>`).join('')}</div>
            </div>
            <div class="flow-prog">
              <div class="progress-bar" style="width:80px"><span style="width:${prog.pct}%"></span></div>
              <span style="font-size:12px;color:var(--muted)">${prog.done}/${prog.total}</span>
            </div>
          </div>
          <div class="flow-steps">${flow.steps.map((s) => {
            const done = DemoKit.isDone(flow.id, s.n);
            return `<div class="flow-step ${done ? 'done' : ''}">
              <button class="step-check" data-flow="${flow.id}" data-step="${s.n}">${done ? '✓' : s.n}</button>
              <div class="step-body">
                <div class="step-role"><span class="badge badge-brand">${esc(s.role)}</span> <code>${esc(s.account)}</code></div>
                <div class="step-action">${esc(s.action)}</div>
              </div>
              <button class="btn btn-ghost btn-sm" data-switch="${s.account}" data-go="${s.go}">Đăng nhập &amp; mở</button>
            </div>`;
          }).join('')}</div>
        </div>`;
      }).join('')}`;

    $$('[data-switch]').forEach((btn) => {
      btn.onclick = () => {
        const u = allUsers().find((x) => x.email === btn.dataset.switch);
        if (!u) return toast('Không tìm thấy TK', 'err');
        Store.setSession(u);
        location.href = `app.html#${btn.dataset.go || 'demo'}`;
        location.reload();
      };
    });
    $$('[data-flow]').forEach((btn) => {
      btn.onclick = () => { DemoKit.toggleStep(btn.dataset.flow, Number(btn.dataset.step)); pageDemo(); };
    });
    $('#btnSeed').onclick = () => { DemoKit.seedFullScenario(user); toast('Đã gieo demo CN + NN + R-Point'); renderShell(); };
    $('#btnResetProg').onclick = () => { DemoKit.resetProgress(); pageDemo(); };
  }

  /* ---------- Router ---------- */
  function render() {
    parseRoute();
    if (!canAccessRoute(route)) {
      toast('Không có quyền truy cập trang này', 'err');
      route = 'dashboard';
      history.replaceState(null, '', '#dashboard');
    }
    renderShell();
    $('#sidebar').classList.remove('open');
    $('#sidebarBackdrop').classList.remove('show');

    const pages = {
      dashboard: pageDashboard,
      classes: pageClasses,
      'report-bt': pageReportBT,
      'report-lt': pageReportLT,
      'report-nn': pageReportNN,
      'report-cvht': pageReportCvht,
      inbox: pageInbox,
      reports: pageReports,
      visits: pageVisits,
      rpoint: pageRPoint,
      'at-risk': pageAtRisk,
      counseling: pageCounseling,
      escalations: pageEscalations,
      people: pagePeople,
      admin: pageAdmin,
      subjects: pageSubjects,
      audit: pageAudit,
      sheets: pageSheets,
      notifications: pageNotifications,
      demo: pageDemo,
      guide: pageGuide,
    };
    (pages[route] || pageDashboard)();
  }

  $('#mobileToggle').onclick = () => {
    $('#sidebar').classList.toggle('open');
    $('#sidebarBackdrop').classList.toggle('show');
  };
  $('#sidebarBackdrop').onclick = () => {
    $('#sidebar').classList.remove('open');
    $('#sidebarBackdrop').classList.remove('show');
  };
  window.addEventListener('hashchange', render);

  (async () => {
    if (typeof SheetsAPI !== 'undefined' && SheetsAPI.enabled()) {
      try {
        await Store.pullFromSheets();
      } catch (err) {
        console.warn('Sheets pull on boot failed', err);
      }
    }
    render();
  })();
})();

/**
 * Google Sheets bridge — zero backend
 * Giao tiếp với Apps Script Web App (JSON).
 * Khi mode = local: mọi thứ qua Store/localStorage.
 */
const SheetsAPI = {
  enabled() {
    return APP_CONFIG.mode === 'sheets' && !!APP_CONFIG.sheetsWebAppUrl;
  },

  /** Schema các tab — dùng để tạo Sheet / validate */
  SCHEMA: {
    Users: ['id', 'email', 'password', 'name', 'primaryRole', 'campus', 'initials', 'phone', 'active', 'updatedAt'],
    Classes: ['id', 'code', 'majorId', 'subject', 'campusId', 'programType', 'semester', 'level', 'note', 'studentCount', 'active'],
    Assignments: ['id', 'classId', 'semester', 'role', 'userId', 'userName', 'fromDate', 'toDate', 'status', 'replacedBy', 'note'],
    AssignmentHistory: ['id', 'classId', 'semester', 'role', 'fromUserId', 'fromUserName', 'toUserId', 'toUserName', 'changedById', 'changedByName', 'reason', 'at'],
    RoleHistory: ['id', 'userId', 'userName', 'fromRole', 'toRole', 'classId', 'changedById', 'changedByName', 'reason', 'at'],
    AuditLog: ['id', 'actorId', 'actorName', 'action', 'entity', 'entityId', 'beforeJson', 'afterJson', 'at'],
    Students: ['id', 'classId', 'name', 'studentCode', 'status', 'riskReason', 'riskLevel', 'updatedAt'],
    Reports: ['id', 'classId', 'reporterId', 'reportKind', 'reportType', 'weekStart', 'weekEnd', 'status', 'totalScore', 'isLate', 'formDataJson', 'createdAt', 'submittedAt', 'reviewedAt', 'reviewerId', 'reviewNote'],
    Notifications: ['id', 'userId', 'title', 'body', 'read', 'createdAt'],
  },

  async request(action, payload = {}) {
    if (!this.enabled()) throw new Error('Sheets mode chưa cấu hình');
    const res = await fetch(APP_CONFIG.sheetsWebAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action,
        apiKey: APP_CONFIG.sheetsApiKey || undefined,
        ...payload,
      }),
    });
    if (!res.ok) throw new Error(`Sheets HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  },

  async pullAll() {
    return this.request('pullAll');
  },

  async pushEntity(sheet, rows) {
    return this.request('push', { sheet, rows });
  },

  async appendAudit(entry) {
    return this.request('append', { sheet: 'AuditLog', row: entry });
  },

  /** Xuất CSV từ mảng object (dùng khi chưa có Sheets) */
  toCSV(rows, columns) {
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = columns.join(',');
    const body = rows.map((r) => columns.map((c) => esc(r[c])).join(',')).join('\n');
    return `${head}\n${body}`;
  },

  downloadCSV(filename, csv) {
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  parseCSV(text) {
    const lines = text.replace(/^\ufeff/, '').trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cols = line.match(/("([^"]|"")*"|[^,]*)/g) || [];
      const obj = {};
      headers.forEach((h, i) => {
        let v = (cols[i] || '').trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/""/g, '"');
        obj[h] = v;
      });
      return obj;
    });
  },
};

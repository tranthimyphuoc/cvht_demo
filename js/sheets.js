/**
 * Google Sheets bridge — Apps Script thay backend
 * mode local  → Store/localStorage
 * mode sheets → fetch Web App + cache localStorage
 */
const SheetsAPI = {
  /** Thứ tự tab — phải khớp Spreadsheet + Code.gs */
  SHEET_NAMES: [
    'Users',
    'Classes',
    'Students',
    'Reports',
    'Visits',
    'AtRiskNotes',
    'Escalations',
    'RPointEvals',
    'Notifications',
    'AssignmentHistory',
    'RoleHistory',
    'AuditLog',
    'Curriculum',
    'LateCounts',
  ],

  /** Header dòng 1 mỗi tab */
  SCHEMA: {
    Users: ['id', 'email', 'password', 'name', 'primaryRole', 'campus', 'initials', 'phone', 'active', 'aliasOf', 'classId', 'updatedAt'],
    Classes: ['id', 'code', 'majorId', 'subject', 'subjectCode', 'campusId', 'programType', 'semester', 'level', 'note', 'studentCount', 'active', 'cvhtId', 'ltId', 'btId', 'gvName', 'tgName'],
    Students: ['id', 'classId', 'name', 'studentCode', 'email', 'phone', 'status', 'statusNote', 'riskReason', 'riskLevel', 'enrollStatus', 'statusUpdatedAt', 'statusUpdatedBy', 'updatedAt'],
    Reports: ['id', 'classId', 'reporterId', 'reportKind', 'reportType', 'weekStart', 'weekEnd', 'semesterId', 'subjectCode', 'subjectName', 'status', 'totalScore', 'isLate', 'formDataJson', 'attachmentsJson', 'summaryNote', 'activityNote', 'linkedReportIdsJson', 'createdAt', 'submittedAt', 'reviewedAt', 'reviewerId', 'reviewNote', 'demoTag'],
    Visits: ['id', 'classId', 'cvhtId', 'visitDate', 'observation', 'createdAt', 'demoTag'],
    AtRiskNotes: ['id', 'studentId', 'cvhtId', 'note', 'status', 'createdAt'],
    Escalations: ['id', 'studentId', 'classId', 'cvhtId', 'reason', 'status', 'notesJson', 'resolveNote', 'resolvedAt', 'resolvedBy', 'resolvedByName', 'createdAt'],
    RPointEvals: ['id', 'classId', 'ltId', 'evaluatorId', 'scoresJson', 'total', 'note', 'createdAt', 'demoTag'],
    Notifications: ['id', 'userId', 'title', 'body', 'read', 'createdAt', 'demoTag'],
    AssignmentHistory: ['id', 'classId', 'semester', 'role', 'fromUserId', 'fromUserName', 'toUserId', 'toUserName', 'changedById', 'changedByName', 'reason', 'at'],
    RoleHistory: ['id', 'userId', 'userName', 'fromRole', 'toRole', 'classId', 'changedById', 'changedByName', 'reason', 'at'],
    AuditLog: ['id', 'actorId', 'actorName', 'action', 'entity', 'entityId', 'beforeJson', 'afterJson', 'at'],
    Curriculum: ['id', 'majorId', 'cohort', 'cohortLabel', 'matchPattern', 'semestersJson'],
    LateCounts: ['key', 'count'],
  },

  enabled() {
    return APP_CONFIG.mode === 'sheets' && !!APP_CONFIG.sheetsWebAppUrl;
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
    const cols = this.SCHEMA[sheet];
    const normalized = (rows || []).map((r) => this.toSheetRow(sheet, r, cols));
    return this.request('push', { sheet, rows: normalized, headers: cols });
  },

  async appendAudit(entry) {
    return this.request('append', {
      sheet: 'AuditLog',
      row: this.toSheetRow('AuditLog', entry, this.SCHEMA.AuditLog),
    });
  },

  jsonStr(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'string') {
      try { JSON.parse(v); return v; } catch { return v; }
    }
    try { return JSON.stringify(v); } catch { return ''; }
  },

  jsonParse(v, fallback) {
    if (v == null || v === '') return fallback;
    if (typeof v === 'object') return v;
    try { return JSON.parse(String(v)); } catch { return fallback; }
  },

  bool(v, defaultVal = true) {
    if (v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1') return true;
    if (v === false || v === 'FALSE' || v === 'false' || v === 0 || v === '0') return false;
    return defaultVal;
  },

  /** Object runtime → hàng Sheets (chỉ cột schema) */
  toSheetRow(sheet, obj, cols) {
    const c = cols || this.SCHEMA[sheet] || Object.keys(obj || {});
    const o = obj || {};
    const row = {};
    c.forEach((k) => {
      let v = o[k];
      if (k === 'formDataJson') v = this.jsonStr(o.formDataJson ?? o.formData);
      else if (k === 'attachmentsJson') v = this.jsonStr(o.attachmentsJson ?? o.attachments);
      else if (k === 'linkedReportIdsJson') v = this.jsonStr(o.linkedReportIdsJson ?? o.linkedReportIds);
      else if (k === 'notesJson') v = this.jsonStr(o.notesJson ?? o.notes);
      else if (k === 'scoresJson') v = this.jsonStr(o.scoresJson ?? o.scores);
      else if (k === 'semestersJson') v = this.jsonStr(o.semestersJson ?? o.semesters);
      else if (k === 'active' || k === 'read' || k === 'isLate' || k === 'demoTag') {
        if (o[k] === true || o[k] === 'TRUE' || o[k] === 'true' || o[k] === 1 || o[k] === '1') v = 'TRUE';
        else if (o[k] === false || o[k] === 'FALSE' || o[k] === 'false' || o[k] === 0 || o[k] === '0') v = 'FALSE';
        else v = o[k] ?? '';
      } else if (v != null && typeof v === 'object') {
        v = this.jsonStr(v);
      } else {
        v = v == null ? '' : v;
      }
      row[k] = v;
    });
    return row;
  },

  /** Hàng Sheets → object runtime */
  fromSheetRow(sheet, row) {
    const o = { ...(row || {}) };
    if (sheet === 'Users') {
      o.active = this.bool(o.active, true);
      o.primaryRole = o.primaryRole || o.role || 'CVHT';
    }
    if (sheet === 'Classes') {
      o.active = this.bool(o.active, true);
      if (o.studentCount !== '' && o.studentCount != null) o.studentCount = Number(o.studentCount);
    }
    if (sheet === 'Reports') {
      o.formData = this.jsonParse(o.formDataJson, {});
      o.attachments = this.jsonParse(o.attachmentsJson, []);
      o.linkedReportIds = this.jsonParse(o.linkedReportIdsJson, []);
      o.totalScore = o.totalScore === '' || o.totalScore == null ? null : Number(o.totalScore);
      o.isLate = this.bool(o.isLate, false);
      o.demoTag = this.bool(o.demoTag, false);
    }
    if (sheet === 'Visits') o.demoTag = this.bool(o.demoTag, false);
    if (sheet === 'Escalations') {
      o.notes = this.jsonParse(o.notesJson, Array.isArray(o.notes) ? o.notes : []);
    }
    if (sheet === 'RPointEvals') {
      o.scores = this.jsonParse(o.scoresJson, {});
      o.total = o.total === '' || o.total == null ? 0 : Number(o.total);
      o.demoTag = this.bool(o.demoTag, false);
    }
    if (sheet === 'Notifications') {
      o.read = this.bool(o.read, false);
      o.demoTag = this.bool(o.demoTag, false);
    }
    if (sheet === 'Curriculum') {
      o.semesters = this.jsonParse(o.semestersJson, []);
    }
    if (sheet === 'LateCounts') o.count = Number(o.count) || 0;
    return o;
  },

  mapRows(sheet, rows) {
    return (rows || []).map((r) => this.fromSheetRow(sheet, r));
  },

  /** Snapshot Store → payload đẩy Sheets */
  serializeStore(d) {
    const curriculumRows = Object.entries(d.curriculumPrograms || {}).map(([id, p]) => ({
      id,
      majorId: p.majorId,
      cohort: p.cohort,
      cohortLabel: p.cohortLabel,
      matchPattern: p.matchPattern,
      semesters: p.semesters || [],
    }));
    const lateRows = Object.entries(d.lateCounts || {}).map(([key, count]) => ({ key, count }));
    return {
      Users: d.users || [],
      Classes: d.classes || [],
      Students: d.students || [],
      Reports: d.reports || [],
      Visits: d.visits || [],
      AtRiskNotes: d.atRiskNotes || [],
      Escalations: d.escalations || [],
      RPointEvals: d.rpointEvals || [],
      Notifications: d.notifications || [],
      AssignmentHistory: d.assignmentHistory || [],
      RoleHistory: d.roleHistory || [],
      AuditLog: d.auditLog || [],
      Curriculum: curriculumRows,
      LateCounts: lateRows,
    };
  },

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
};

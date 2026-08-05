/**
 * Parse CSV / TSV / Excel (xlsx via SheetJS CDN) → rows object
 * Dùng để import danh sách sinh viên nhanh từ Excel.
 */
const CsvImport = {
  STUDENT_TEMPLATE_HEADERS: [
    'ho_ten', 'ma_sv', 'email', 'sdt', 'gioi_tinh', 'tinh_trang_hoc', 'trang_thai', 'ma_lop',
  ],

  STUDENT_TEMPLATE_SAMPLE: [
    ['Nguyễn Văn An', 'SV25001', 'an.nguyen@example.com', '0901234567', 'Nam', 'Đang theo học', 'Ổn định', ''],
    ['Trần Thị Bình', 'SV25002', 'binh.tran@example.com', '0912345678', 'Nữ', 'Đang theo học', 'Ổn định', ''],
  ],

  /** Chuẩn hóa tên cột → key nội bộ */
  HEADER_MAP: {
    name: 'name', hoten: 'name', 'ho_ten': 'name', 'ho ten': 'name', 'họ tên': 'name', 'họ và tên': 'name',
    'ho va ten': 'name', 'full name': 'name', 'fullname viên': 'name', 'sinh vien': 'name', student: 'name',
    studentcode: 'studentCode', 'student_code': 'studentCode', masv: 'studentCode', 'ma_sv': 'studentCode',
    'ma sv': 'studentCode', 'mã sv': 'studentCode', mssv: 'studentCode', 'mã sinh viên': 'studentCode',
    'ma sinh vien': 'studentCode', code: 'studentCode',
    email: 'email', 'e-mail': 'email', mail: 'email',
    phone: 'phone', sdt: 'phone', 'sđt': 'phone', 'so dien thoai': 'phone', 'số điện thoại': 'phone',
    'so_dien_thoai': 'phone', mobile: 'phone', tel: 'phone',
    gender: 'gender', gioitinh: 'gender', 'gioi_tinh': 'gender', 'giới tính': 'gender', sex: 'gender',
    enrollstatus: 'enrollStatus', 'enroll_status': 'enrollStatus', 'tinh_trang_hoc': 'enrollStatus',
    'tinh trang hoc': 'enrollStatus', 'tình trạng học': 'enrollStatus', 'tinh trang': 'enrollStatus',
    status: 'status', 'trang_thai': 'status', 'trạng thái': 'status', 'trang thai': 'status',
    classcode: 'classCode', 'class_code': 'classCode', malop: 'classCode', 'ma_lop': 'classCode',
    'ma lop': 'classCode', 'mã lớp': 'classCode', 'lop': 'classCode', class: 'classCode',
    classid: 'classId', 'class_id': 'classId',
  },

  STATUS_MAP: {
    active: 'ACTIVE', 'on dinh': 'ACTIVE', 'ổn định': 'ACTIVE', 'on định': 'ACTIVE', ok: 'ACTIVE',
    watch: 'WATCH', 'co van de': 'WATCH', 'có vấn đề': 'WATCH', 'van de': 'WATCH',
    atrisk: 'AT_RISK', 'at_risk': 'AT_RISK', 'nguy co': 'AT_RISK', 'nguy cơ': 'AT_RISK', risk: 'AT_RISK',
    inactive: 'INACTIVE', 'tam ngung': 'INACTIVE', 'tạm ngưng': 'INACTIVE', 'ngung': 'INACTIVE',
  },

  normHeader(h) {
    return String(h || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  },

  mapHeader(h) {
    const n = this.normHeader(h);
    if (!n) return null;
    if (this.HEADER_MAP[n]) return this.HEADER_MAP[n];
    const compact = n.replace(/\s+/g, '_');
    if (this.HEADER_MAP[compact]) return this.HEADER_MAP[compact];
    const nospace = n.replace(/\s+/g, '');
    return this.HEADER_MAP[nospace] || null;
  },

  mapStatus(raw) {
    if (raw == null || raw === '') return 'ACTIVE';
    const s = String(raw).trim();
    if (['ACTIVE', 'WATCH', 'AT_RISK', 'INACTIVE'].includes(s.toUpperCase().replace(/\s+/g, '_'))) {
      return s.toUpperCase().replace(/\s+/g, '_').replace('AT RISK', 'AT_RISK');
    }
    const key = this.normHeader(s);
    return this.STATUS_MAP[key] || this.STATUS_MAP[key.replace(/\s+/g, '')] || 'ACTIVE';
  },

  /** Parse 1 dòng CSV với dấu ngoặc kép */
  splitCsvLine(line, delim) {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i += 1; }
          else inQ = false;
        } else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  },

  detectDelim(headerLine) {
    const commas = (headerLine.match(/,/g) || []).length;
    const semis = (headerLine.match(/;/g) || []).length;
    const tabs = (headerLine.match(/\t/g) || []).length;
    if (tabs >= commas && tabs >= semis && tabs > 0) return '\t';
    if (semis > commas) return ';';
    return ',';
  },

  parseDelimited(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!raw) return { headers: [], rows: [] };
    const lines = raw.split('\n').filter((l) => l.trim().length);
    if (!lines.length) return { headers: [], rows: [] };
    const delim = this.detectDelim(lines[0]);
    const headers = this.splitCsvLine(lines[0], delim).map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const cells = this.splitCsvLine(line, delim);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (cells[i] != null ? String(cells[i]) : '').trim(); });
      return obj;
    });
    return { headers, rows };
  },

  /** Map raw sheet rows → student payloads */
  normalizeStudentRows(rawRows, opts = {}) {
    const defaultClassId = opts.defaultClassId || '';
    const defaultClassCode = opts.defaultClassCode || '';
    const errors = [];
    const rows = [];

    rawRows.forEach((raw, idx) => {
      const lineNo = idx + 2; // + header
      const mapped = {};
      Object.keys(raw || {}).forEach((h) => {
        const key = this.mapHeader(h);
        if (key) mapped[key] = String(raw[h] ?? '').trim();
      });
      // Nếu không map được header (file không có header chuẩn) — thử positional
      if (!mapped.name && !mapped.studentCode && !mapped.email) {
        const vals = Object.values(raw || {});
        if (vals[0]) mapped.name = String(vals[0]).trim();
        if (vals[1]) mapped.studentCode = String(vals[1]).trim();
        if (vals[2]) mapped.email = String(vals[2]).trim();
        if (vals[3]) mapped.phone = String(vals[3]).trim();
        if (vals[4]) mapped.gender = String(vals[4]).trim();
      }

      const name = (mapped.name || '').trim();
      if (!name) {
        errors.push(`Dòng ${lineNo}: thiếu họ tên`);
        return;
      }
      rows.push({
        name,
        studentCode: (mapped.studentCode || '').trim(),
        email: (mapped.email || '').trim().toLowerCase(),
        phone: (mapped.phone || '').trim(),
        gender: (mapped.gender || '').trim(),
        enrollStatus: (mapped.enrollStatus || 'Đang theo học').trim(),
        status: this.mapStatus(mapped.status),
        classCode: (mapped.classCode || defaultClassCode || '').trim(),
        classId: (mapped.classId || defaultClassId || '').trim(),
        _line: lineNo,
      });
    });

    return { rows, errors };
  },

  async loadXlsxLib() {
    if (typeof XLSX !== 'undefined') return XLSX;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Không tải được thư viện đọc Excel'));
      document.head.appendChild(s);
    });
    if (typeof XLSX === 'undefined') throw new Error('Thư viện Excel chưa sẵn sàng');
    return XLSX;
  },

  async parseFile(file) {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const XLSX = await this.loadXlsxLib();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      return { headers: json[0] ? Object.keys(json[0]) : [], rows: json, source: 'xlsx' };
    }
    const text = await file.text();
    const parsed = this.parseDelimited(text);
    return { ...parsed, source: 'csv' };
  },

  downloadStudentTemplate(classCode = '') {
    const headers = this.STUDENT_TEMPLATE_HEADERS;
    const sample = this.STUDENT_TEMPLATE_SAMPLE.map((r) => {
      const copy = [...r];
      copy[7] = classCode || '';
      return copy;
    });
    const lines = [headers.join(',')].concat(sample.map((r) => r.map((c) => {
      const s = String(c ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')));
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = classCode ? `mau_sv_${classCode}.csv` : 'mau_danh_sach_sinh_vien.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  },
};

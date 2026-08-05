/**
 * Build js/staff-import.js from data_thayco.md + data_loptruong_bithu.md
 * Run: node scripts/build-staff-import.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function normClassCode(raw) {
  let c = (raw || '').trim().replace(/\s+/g, '');
  const ALIASES = {
    'PTIT-KS24-CNTT1': 'HCM-KS24-CNTT1',
    'PTIT-K25-CNTT7': 'HCM-KS25-CNTT7',
    'PTIT-K25-CNTT8': 'HCM-KS25-CNTT8',
    'HN-K25-CNTT7': 'HCM-KS25-CNTT7',
    'HN-K25-CNTT8': 'HCM-KS25-CNTT8',
  };
  if (ALIASES[c]) return ALIASES[c];
  c = c.replace(/^PTIT-/, 'HN-');
  if (/^(HN|HCM)-K(\d+)-(CNTT\d*)$/i.test(c) && !/KS\d+/i.test(c)) {
    c = c.replace(/^(HN|HCM)-K(\d+)-(CNTT)/i, '$1-KS$2-$3');
  }
  return c;
}

function parseClassCodeLine(line) {
  const m = line.trim().match(/^(\d+\.\s*)?((?:HN|HCM|PTIT)-[A-Z0-9]+(?:-[A-Z0-9]+)*)/i);
  return m ? normClassCode(m[2]) : null;
}

function slugId(name) {
  const s = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `ust_${s.slice(0, 48)}`;
}

function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

function emailFor(name, role) {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  const domain = role === 'CVHT' ? 'rikkei.edu' : 'student.ptit.edu.vn';
  return `${slug}@${domain}`;
}

/** Known CVHT id aliases from SEED */
const KNOWN_CVHT = {
  'nguyễn thị như quỳnh': 'u_nq',
  'mai xuân chinh': 'u_mxc',
  'phạm tuấn bình': 'u_ptb',
  'phạm ngọc kiên': 'u_pnk',
  'phạm viết hùng': 'u_pvh',
  'lưu xuân hoàng nguyên': 'u_lxhn',
};

function parseThayCo(text) {
  const classStaff = {};
  let currentCode = null;
  text.split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t) return;
    const code = parseClassCodeLine(t);
    if (code) {
      currentCode = code;
      if (!classStaff[currentCode]) classStaff[currentCode] = {};
      const noteMatch = t.match(/\(([^)]+)\)/);
      if (noteMatch) classStaff[currentCode].note = noteMatch[1];
      return;
    }
    const roleMatch = t.match(/^-\s*(Giảng viên|Trợ giảng|Cố vấn học tập)\s*:\s*(.+)$/i);
    if (roleMatch && currentCode) {
      const val = roleMatch[2].trim();
      if (/giảng viên/i.test(roleMatch[1])) classStaff[currentCode].gv = val;
      else if (/trợ giảng/i.test(roleMatch[1])) classStaff[currentCode].tg = val;
      else classStaff[currentCode].cvht = val;
    }
  });
  return classStaff;
}

function isActiveStatus(s) {
  const x = (s || '').toLowerCase();
  return x.includes('tiếp tục') || x.includes('đang đảm nhiệm');
}

function isResigned(s) {
  return (s || '').toLowerCase().includes('thôi làm');
}

function parseOfficers(text) {
  const officers = [];
  const byClassRole = {};

  const add = (row) => {
    const classCode = normClassCode(row.classCode);
    if (!classCode) return;
    const roleKey = /bí thư/i.test(row.role) ? 'BI_THU' : 'LOP_TRUONG';
    if (row.resigned) return;
    if (!isActiveStatus(row.status) && row.status) return;
    const key = `${classCode}::${roleKey}`;
    if (byClassRole[key]) return;
    byClassRole[key] = true;
    officers.push({
      name: row.name.trim(),
      email: row.email || emailFor(row.name, roleKey),
      phone: row.phone || '',
      role: roleKey,
      classCode,
      status: row.status || 'Tiếp tục',
    });
  };

  text.split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('Đào Trọng') === false && !t.includes('\t') && !/\d{2}\/\d{2}\/\d{4}/.test(t) && !/\t/.test(t)) {
      /* skip headers */
    }
    const parts = t.split('\t').map((p) => p.trim()).filter(Boolean);
    if (parts.length < 4) return;

    // Format A: name, dob, phone, email, id, status, class, role, cohort, note...
    if (parts.length >= 8 && /@/.test(parts[3])) {
      const role = parts[7];
      if (!/lớp trưởng|bí thư/i.test(role)) return;
      add({
        name: parts[0],
        phone: parts[2],
        email: parts[3],
        status: parts[5],
        classCode: parts[6],
        role,
        resigned: isResigned(parts[9] || parts[8] || ''),
      });
      return;
    }

    // Format B: name, dob, phone, class, role, note, ...
    if (parts.length >= 5 && /CNTT|QTKD/i.test(parts[3])) {
      const role = parts[4];
      if (!/lớp trưởng|bí thư/i.test(role)) return;
      add({
        name: parts[0],
        phone: parts[2],
        classCode: parts[3],
        role,
        status: parts[6] || parts[5] || 'Tiếp tục',
        resigned: isResigned(parts[5] || '') || isResigned(parts[6] || ''),
      });
      return;
    }

    // Format C: name, dob, class, role, file, campus, status
    if (parts.length >= 6 && /CNTT|QTKD/i.test(parts[2])) {
      const role = parts[3];
      if (!/lớp trưởng|bí thư/i.test(role)) return;
      add({
        name: parts[0],
        classCode: parts[2],
        role,
        status: parts[6] || parts[5] || 'Tiếp tục',
        resigned: isResigned(parts[6] || ''),
      });
    }
  });

  return officers;
}

function buildUsers(classStaff, officers) {
  const users = new Map();
  const ensure = (name, role, extra = {}) => {
    const n = name.trim();
    if (!n) return null;
    const lower = n.toLowerCase();
    let id = KNOWN_CVHT[lower];
    if (!id) id = slugId(n);
    if (!users.has(id)) {
      users.set(id, {
        id,
        email: extra.email || emailFor(n, role),
        password: '123456',
        name: n,
        primaryRole: role,
        campus: extra.campus || 'HN',
        initials: initials(n),
        active: true,
        ...extra,
      });
    }
    return id;
  };

  Object.entries(classStaff).forEach(([code, s]) => {
    const campus = code.startsWith('HCM') ? 'HCM' : 'HN';
    if (s.cvht) ensure(s.cvht, 'CVHT', { campus });
    if (s.gv) ensure(s.gv, 'GV', { campus, primaryRole: 'GV' });
    if (s.tg) ensure(s.tg, 'TG', { campus, primaryRole: 'TG' });
  });

  officers.forEach((o) => {
    const campus = o.classCode.startsWith('HCM') ? 'HCM' : 'HN';
    ensure(o.name, o.role, { email: o.email, phone: o.phone, campus, classCode: o.classCode });
  });

  return [...users.values()];
}

const thayCo = fs.readFileSync(path.join(ROOT, 'data_thayco.md'), 'utf8');
const officersRaw = fs.readFileSync(path.join(ROOT, 'data_loptruong_bithu.md'), 'utf8');
const classStaff = parseThayCo(thayCo);
const officers = parseOfficers(officersRaw);
const users = buildUsers(classStaff, officers);

const out = `/* Auto-generated from data_thayco.md + data_loptruong_bithu.md */
const STAFF_IMPORT = ${JSON.stringify({ classStaff, officers, users }, null, 2)};
`;

fs.writeFileSync(path.join(ROOT, 'js', 'staff-import.js'), out);
console.log('classStaff', Object.keys(classStaff).length);
console.log('officers', officers.length);
console.log('users', users.length);

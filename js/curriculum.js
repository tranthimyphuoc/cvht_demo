/* Khung chương trình: Ngành → Khóa (K24/K25…) → Học kỳ → Môn */
const Curriculum = {
  programs: {
    CNTT_K24: {
      majorId: 'CNTT',
      cohort: 'K24',
      cohortLabel: 'Khóa 24',
      matchPattern: '^(HN|HCM)-KS24-CNTT',
      semesters: [
        {
          key: 'HK4',
          semesterId: '2025-HK4',
          label: 'Học kỳ 4 · 2025–2026',
          subjects: [
            { code: 'IT212-K24', name: 'AI Application in Action' },
            { code: 'PRJ-HOL', name: 'Dự án hè' },
            { code: 'IT213-K24', name: 'AI Integration in Action' },
            { code: 'SKL05', name: 'Kỹ năng Chinh phục nhà tuyển dụng' },
            { code: 'IT214-K24', name: 'Microservices System Design' },
            { code: 'IT209-K24', name: 'DevOps Fundamentals' },
            { code: 'ITTTRK304-K24', name: 'Thực tập Rikasoft 4' },
          ],
        },
      ],
    },
    CNTT_K25: {
      majorId: 'CNTT',
      cohort: 'K25',
      cohortLabel: 'Khóa 25',
      matchPattern: '^(HN|HCM)-KS25-CNTT',
      semesters: [
        {
          key: 'HK2',
          semesterId: '2025-HK2',
          label: 'Học kỳ 2 · 2025–2026',
          subjects: [
            { code: 'IT202-K25', name: 'Cơ sở dữ liệu' },
            { code: 'SKL01', name: 'Kỹ năng làm việc nhóm và giải quyết xung đột' },
            { code: 'IT205-K25', name: 'Lập trình ứng dụng với Python' },
            { code: 'IT215-K25', name: 'Phát triển ứng dụng web với FastAPI' },
            { code: 'IT105-K25', name: 'Phân tích & thiết kế hệ thống' },
            { code: 'IT106-K25', name: 'Quy trình phát triển phần mềm với Agile/Scrum' },
            { code: 'ITTTRK301-K25', name: 'Thực tập Rikkei Lab 2' },
          ],
        },
      ],
    },
    QTKD_K25: {
      majorId: 'QTKD',
      cohort: 'K25',
      cohortLabel: 'Khóa 25',
      matchPattern: '^(HN|HCM)-K25-QTKD',
      semesters: [
        {
          key: 'HK3',
          semesterId: '2025-HK3',
          label: 'Học kỳ 3 · 2025–2026',
          subjects: [
            { code: 'BA201', name: 'Phân tích nghiệp vụ kinh doanh (BA)' },
            { code: 'SKL104', name: 'Kỹ năng giao tiếp, thuyết trình và tư duy phản biện' },
            { code: 'BA202', name: 'Thống kê trong kinh doanh' },
            { code: 'MAN107', name: 'Quản trị chiến lược doanh nghiệp số' },
            { code: 'DA204', name: 'Trực quan hóa dữ liệu với Power BI' },
            { code: 'DA205', name: 'Truy vấn dữ liệu nâng cao' },
            { code: 'PRJ404', name: 'Dự án chuyển đổi số và phân tích dữ liệu kinh doanh' },
          ],
        },
      ],
    },
  },

  _runtime: null,

  use(programs) {
    this._runtime = programs || null;
  },

  defaultPrograms() {
    return JSON.parse(JSON.stringify(this.programs));
  },

  /** Migrate flat tracks (old) → programs by cohort */
  migrateFromTracks(tracks) {
    if (!tracks || typeof tracks !== 'object') return null;
    const first = Object.values(tracks)[0];
    if (first && Array.isArray(first.semesters)) return tracks; // already programs
    if (!first || !Array.isArray(first.subjects)) return null;

    const out = {};
    Object.entries(tracks).forEach(([id, t]) => {
      const cohort = this.normalizeCohort(t.cohort)
        || this.cohortFromPattern(t.matchPattern)
        || this.cohortFromId(id)
        || 'K?';
      const progId = `${t.majorId || 'UNK'}_${cohort}`;
      if (!out[progId]) {
        out[progId] = {
          majorId: t.majorId || 'UNK',
          cohort,
          cohortLabel: `Khóa ${String(cohort).replace(/^KS?/i, '')}`,
          matchPattern: t.matchPattern || '',
          semesters: [],
        };
      }
      const key = (t.semesterId || '').replace(/^\d{4}-/, '') || t.key || `HK${out[progId].semesters.length + 1}`;
      out[progId].semesters.push({
        key,
        semesterId: t.semesterId || '',
        label: t.label || this.semesterLabel(t.semesterId),
        subjects: [...(t.subjects || [])],
      });
      if (t.matchPattern && !out[progId].matchPattern) out[progId].matchPattern = t.matchPattern;
    });
    return out;
  },

  activePrograms() {
    return this._runtime || this.programs;
  },

  programEntries() {
    return Object.entries(this.activePrograms()).map(([id, p]) => ({ id, ...p }));
  },

  programById(id) {
    return this.activePrograms()[id] || null;
  },

  normalizeCohort(raw) {
    if (!raw) return null;
    const m = String(raw).trim().toUpperCase().match(/K?S?(\d{2})/);
    return m ? `K${m[1]}` : null;
  },

  cohortFromId(id) {
    const m = String(id || '').match(/_K(?:S)?(\d{2})(?:_|$)/i) || String(id || '').match(/K(?:S)?(\d{2})/i);
    return m ? `K${m[1]}` : null;
  },

  cohortFromPattern(pattern) {
    const m = String(pattern || '').match(/KS?(\d{2})/i);
    return m ? `K${m[1]}` : null;
  },

  /** Trích khóa từ mã lớp: HN-KS24-CNTT1 → K24 ; HN-K25-QTKD1 → K25 */
  cohortFromClassCode(classCode) {
    const m = String(classCode || '').match(/-(?:KS|K)(\d{2})(?:[A-Z]?)-/i)
      || String(classCode || '').match(/-(?:KS|K)(\d{2})$/i);
    return m ? `K${m[1]}` : null;
  },

  matchProgram(prog, classCode) {
    if (!prog || !classCode) return false;
    if (prog.matchPattern) {
      try {
        if (new RegExp(prog.matchPattern, 'i').test(classCode)) return true;
      } catch { /* ignore */ }
    }
    const cohort = this.cohortFromClassCode(classCode);
    if (!cohort || this.normalizeCohort(prog.cohort) !== cohort) return false;
    const major = prog.majorId || '';
    if (major && !new RegExp(major, 'i').test(classCode)) return false;
    return true;
  },

  programIdForClass(classCode) {
    if (!classCode) return null;
    const hit = Object.entries(this.activePrograms()).find(([, p]) => this.matchProgram(p, classCode));
    return hit ? hit[0] : null;
  },

  programForClass(classCode) {
    const id = this.programIdForClass(classCode);
    return id ? { id, ...this.programById(id) } : null;
  },

  semesterOf(prog, semesterId) {
    if (!prog?.semesters?.length) return null;
    return prog.semesters.find((s) => s.semesterId === semesterId || s.key === semesterId) || null;
  },

  /** Ngữ cảnh lớp: khóa + danh sách HK + môn theo HK đang chọn */
  forClass(classCode, preferredSemesterId) {
    const prog = this.programForClass(classCode);
    if (!prog) return null;
    const semesters = prog.semesters || [];
    let sem = preferredSemesterId
      ? this.semesterOf(prog, preferredSemesterId)
      : null;
    if (!sem) sem = semesters[0] || null;
    const subjects = sem?.subjects || [];
    return {
      programId: prog.id,
      majorId: prog.majorId,
      cohort: prog.cohort,
      cohortLabel: prog.cohortLabel || `Khóa ${String(prog.cohort || '').replace(/^K/i, '')}`,
      matchPattern: prog.matchPattern,
      semesters,
      semesterId: sem?.semesterId || '',
      semesterKey: sem?.key || '',
      semesterLabel: sem?.label || this.semesterLabel(sem?.semesterId),
      subjects,
    };
  },

  subjectsForClass(classCode, semesterId) {
    return this.forClass(classCode, semesterId)?.subjects || [];
  },

  subjectByCode(classCode, subjectCode, semesterId) {
    const prog = this.programForClass(classCode);
    if (!prog) return null;
    const search = semesterId
      ? [this.semesterOf(prog, semesterId)].filter(Boolean)
      : (prog.semesters || []);
    for (const sem of search) {
      const hit = (sem.subjects || []).find((s) => s.code === subjectCode);
      if (hit) return { ...hit, semesterId: sem.semesterId, semesterKey: sem.key };
    }
    return null;
  },

  findSubjectInProgram(prog, subjectCode) {
    if (!prog) return null;
    for (const sem of prog.semesters || []) {
      const hit = (sem.subjects || []).find((s) => s.code === subjectCode);
      if (hit) return { subject: hit, semester: sem };
    }
    return null;
  },

  subjectLabel(subj) {
    if (!subj) return '—';
    return `${subj.name} (${subj.code})`;
  },

  /**
   * Ngữ cảnh môn/học kỳ để HIỂN THỊ một báo cáo.
   *
   * Báo cáo là bản ghi đã chốt tại thời điểm gửi: tên môn, mã môn và học kỳ lưu
   * trên chính báo cáo luôn thắng. Khung CT chỉ dùng để suy ra phần báo cáo còn
   * thiếu (dữ liệu cũ). Nhờ vậy đổi tên môn trong Khung CT không làm báo cáo cũ
   * đổi theo — chỉ báo cáo gửi sau khi đổi mới mang tên mới.
   */
  resolveReportContext(report, cls) {
    const classCode = cls?.code || '';
    const ownName = String(report?.subjectName || report?.subject || '').trim();
    const ownCode = String(report?.subjectCode || '').trim();
    const ownSem = String(report?.semesterId || '').trim();
    const selfDescribed = !!(ownName || ownCode);

    const cur = this.forClass(classCode, ownSem || cls?.semester || '');
    let subjectCode = ownCode;
    let subjectName = ownName;
    let semesterId = ownSem;

    if (!selfDescribed) {
      // Báo cáo không lưu gì về môn → đành suy từ lớp + khung CT hiện tại
      subjectCode = String(cls?.subjectCode || '').trim();
      subjectName = String(cls?.subject || '').trim();
      if (!subjectCode && subjectName && cur) {
        const hit = cur.subjects.find((s) => s.name === subjectName);
        if (hit) subjectCode = hit.code;
      }
      if (!subjectCode && !subjectName && cur?.subjects?.[0]) {
        subjectCode = cur.subjects[0].code;
        subjectName = cur.subjects[0].name;
      }
    } else if (!subjectName && subjectCode) {
      // Chỉ lưu mã, chưa lưu tên → tra tên hiện có (tốt nhất trong khả năng)
      subjectName = this.subjectByCode(classCode, subjectCode)?.name || '';
    } else if (subjectName && !subjectCode && cur) {
      // Chỉ lưu tên → dò mã để lọc/thống kê chạy được, nhưng KHÔNG ghi đè tên
      const hit = cur.subjects.find((s) => s.name === subjectName);
      if (hit) subjectCode = hit.code;
    }

    if (!semesterId) {
      const found = subjectCode ? this.subjectByCode(classCode, subjectCode) : null;
      semesterId = found?.semesterId || cls?.semester || cur?.semesterId || '';
    }

    const sem = cur ? this.semesterOf(cur, semesterId) : null;
    return {
      semesterId,
      semesterLabel: sem?.label || this.semesterLabel(semesterId),
      subjectCode,
      subjectName: subjectName || '—',
      cohort: cur?.cohort || this.cohortFromClassCode(classCode),
      cohortLabel: cur?.cohortLabel,
      programId: cur?.programId,
    };
  },

  semesterLabel(semesterId) {
    const map = {
      '2025-HK1': 'Học kỳ 1 · 2025–2026',
      '2025-HK2': 'Học kỳ 2 · 2025–2026',
      '2025-HK3': 'Học kỳ 3 · 2025–2026',
      '2025-HK4': 'Học kỳ 4 · 2025–2026',
      '2026-HK1': 'Học kỳ 1 · 2026–2027',
      '2026-HK2': 'Học kỳ 2 · 2026–2027',
    };
    if (map[semesterId]) return map[semesterId];
    for (const p of Object.values(this.activePrograms())) {
      const sem = (p.semesters || []).find((s) => s.semesterId === semesterId);
      if (sem?.label) return sem.label;
    }
    return semesterId || '—';
  },

  majorName(majorId) {
    return (typeof SEED !== 'undefined' && SEED.majors.find((m) => m.id === majorId)?.name) || majorId || '—';
  },

  defaultMatchPattern(majorId, cohort) {
    const k = this.normalizeCohort(cohort) || 'K25';
    const num = k.replace(/^K/i, '');
    if (majorId === 'QTKD') return `^(HN|HCM)-K${num}-QTKD`;
    if (majorId === 'CNTT') return `^(HN|HCM)-KS${num}-CNTT`;
    return `^(HN|HCM)-K(?:S)?${num}-${majorId || ''}`;
  },

  leadershipPolicyHtml() {
    return `<details class="policy-box">
      <summary>Quy tắc tính điểm khi đổi Lớp trưởng / Bí thư</summary>
      <ul>
        <li><strong>Điểm cá nhân (LT/BT):</strong> Trung bình các tuần đã nộp BC khi đang giữ chức trong học kỳ + môn đó. Tuần không nộp không cộng vào mẫu số.</li>
        <li><strong>Sau khi bị thay:</strong> Điểm học kỳ của người cũ chốt tại tuần cuối đảm nhiệm; người mới tính TB riêng từ tuần nhận nhiệm.</li>
        <li><strong>Rà soát lớp (CVHT/QLĐT):</strong> Mỗi tuần lấy BC của người đang giữ chức (theo lịch sử bổ nhiệm). TB học kỳ lớp = trung bình điểm các tuần đã có BC hợp lệ.</li>
      </ul>
    </details>`;
  },
};

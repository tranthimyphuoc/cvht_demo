/* Scoring engine — quy tắc bậc điểm BCS */
const Scoring = {
  /** @param {number} pct 0–100 */
  tier_80(pct, max) {
    if (pct >= 100) return max;
    if (pct >= 90) return max === 20 ? 18 : Math.round(max * 0.9);
    if (pct >= 80) return max === 20 ? 16 : Math.round(max * 0.8);
    return 0;
  },

  tier_90(pct, max) {
    if (pct >= 100) return max;
    if (pct >= 90) return max === 15 ? 13 : Math.round(max * 0.87);
    return 0;
  },

  tier_95(pct, max) {
    if (pct >= 95) return max;
    if (pct >= 90) return 12;
    return 0;
  },

  all_or_nothing(pct, max) {
    return pct >= 100 ? max : 0;
  },

  late_count(lateTimes, max) {
    if (lateTimes <= 0) return max;
    if (lateTimes === 1) return 10;
    return 0;
  },

  scoreCriterion(criterion, value, lateTimes = 0) {
    const max = criterion.max;
    switch (criterion.type) {
      case 'tier_80': return this.tier_80(Number(value) || 0, max);
      case 'tier_90': return this.tier_90(Number(value) || 0, max);
      case 'tier_95': return this.tier_95(Number(value) || 0, max);
      case 'all_or_nothing': return this.all_or_nothing(Number(value) || 0, max);
      case 'late_count': return this.late_count(lateTimes, max);
      default: return 0;
    }
  },

  total(criteria, formData, lateTimes = 0) {
    return criteria.reduce((sum, c) => {
      const val = c.type === 'late_count' ? lateTimes : (formData[c.id]?.value ?? 0);
      return sum + this.scoreCriterion(c, val, lateTimes);
    }, 0);
  },

  gradeLabel(score) {
    if (score >= 90) return { label: 'Hoàn thành xuất sắc', cls: 'badge-ok' };
    if (score >= 80) return { label: 'Hoàn thành tốt', cls: 'badge-info' };
    if (score >= 70) return { label: 'Hoàn thành', cls: 'badge-warn' };
    return { label: 'Không hoàn thành', cls: 'badge-danger' };
  },

  /** R-Point NN: tổng 5 tiêu chí × tối đa 2 điểm = 10 */
  rpointTotal(scores) {
    return SEED.criteriaRPoint.reduce((sum, c) => sum + (Number(scores[c.id]) || 0), 0);
  },

  rpointLabel(total) {
    if (total >= 9) return { label: 'Xuất sắc', cls: 'badge-ok' };
    if (total >= 7) return { label: 'Tốt', cls: 'badge-info' };
    if (total >= 5) return { label: 'Đạt', cls: 'badge-warn' };
    return { label: 'Không đạt (0 R-Point)', cls: 'badge-danger' };
  },

  /** Deadline: Friday 23:00 Asia/Ho_Chi_Minh */
  getWeekDeadline(fromDate = new Date()) {
    const d = new Date(fromDate.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const day = d.getDay(); // 0 Sun … 5 Fri
    const daysUntilFri = day <= 5 ? 5 - day : 6;
    const fri = new Date(d);
    fri.setDate(d.getDate() + daysUntilFri);
    fri.setHours(23, 0, 0, 0);
    return fri;
  },

  getWeekRange(fromDate = new Date()) {
    const deadline = this.getWeekDeadline(fromDate);
    const start = new Date(deadline);
    start.setDate(deadline.getDate() - 4); // Mon
    start.setHours(0, 0, 0, 0);
    return { start, end: deadline };
  },

  isLate(submittedAt = new Date()) {
    return new Date(submittedAt) > this.getWeekDeadline(submittedAt);
  },

  formatCountdown(deadline) {
    const now = new Date();
    const ms = deadline - now;
    if (ms <= 0) return { text: 'Đã quá hạn', urgent: true, overdue: true };
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h < 24) return { text: `Còn ${h}g ${m}p`, urgent: true, overdue: false };
    const d = Math.floor(h / 24);
    return { text: `Còn ${d} ngày ${h % 24}g`, urgent: false, overdue: false };
  },

  fmtDate(d) {
    return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  fmtDateTime(d) {
    return new Date(d).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },

  /** BC đã gửi (không nháp) trong phạm vi lớp · HK · môn */
  filterSemesterReports(reports, { classId, semesterId, subjectCode, reportKind, reporterId }, classLookup) {
    return (reports || []).filter((r) => {
      if (r.classId !== classId) return false;
      if (r.status === 'DRAFT') return false;
      if (reportKind && r.reportKind !== reportKind) return false;
      if (r.totalScore == null) return false;
      const cls = classLookup ? classLookup(r.classId) : null;
      const ctx = Curriculum.resolveReportContext(r, cls || { semester: semesterId });
      const sem = r.semesterId || ctx.semesterId;
      if (semesterId && sem !== semesterId) return false;
      const code = r.subjectCode || ctx.subjectCode;
      if (subjectCode && code !== subjectCode) return false;
      if (reporterId && r.reporterId !== reporterId) return false;
      return true;
    });
  },

  semesterAverage(reports, opts, classLookup) {
    const list = this.filterSemesterReports(reports, opts, classLookup);
    if (!list.length) return { avg: null, count: 0, reports: [] };
    const sum = list.reduce((s, r) => s + (r.totalScore || 0), 0);
    const avg = Math.round((sum / list.length) * 10) / 10;
    return { avg, count: list.length, reports: list };
  },

  /** Ai giữ chức tại thời điểm (theo assignmentHistory) */
  officerAtTime(assignmentHistory, classId, role, atIso) {
    const at = atIso || new Date().toISOString();
    const rows = (assignmentHistory || [])
      .filter((h) => h.classId === classId && h.role === role)
      .sort((a, b) => a.at.localeCompare(b.at));
    let holder = null;
    rows.forEach((h) => {
      if (h.at <= at) holder = h.toUserId;
    });
    return holder;
  },

  /** TB học kỳ theo từng kỳ đảm nhiệm (khi đổi LT/BT) */
  tenureAverages(reports, assignmentHistory, { classId, semesterId, subjectCode, reportKind }, classLookup) {
    const list = this.filterSemesterReports(reports, { classId, semesterId, subjectCode, reportKind }, classLookup);
    const byReporter = {};
    list.forEach((r) => {
      const key = r.reporterId;
      if (!byReporter[key]) byReporter[key] = [];
      byReporter[key].push(r);
    });
    return Object.entries(byReporter).map(([uid, reps]) => {
      const sum = reps.reduce((s, x) => s + x.totalScore, 0);
      return {
        reporterId: uid,
        count: reps.length,
        avg: Math.round((sum / reps.length) * 10) / 10,
        from: reps[reps.length - 1]?.weekStart,
        to: reps[0]?.weekEnd || reps[0]?.submittedAt,
      };
    });
  },

  /** TB tuần lớp: gộp BT + LT (mỗi tuần 1 điểm) — dùng cho rà soát CVHT */
  classWeeklySemesterAvg(reports, { classId, semesterId, subjectCode }, classLookup) {
    const bt = this.filterSemesterReports(reports, { classId, semesterId, subjectCode, reportKind: 'BI_THU' }, classLookup);
    const lt = this.filterSemesterReports(reports, { classId, semesterId, subjectCode, reportKind: 'LOP_TRUONG' }, classLookup);
    const weekKey = (r) => (r.weekStart || r.submittedAt || '').slice(0, 10);
    const weeks = new Set([...bt.map(weekKey), ...lt.map(weekKey)]);
    const scores = [];
    weeks.forEach((wk) => {
      const btR = bt.find((r) => weekKey(r) === wk);
      const ltR = lt.find((r) => weekKey(r) === wk);
      const parts = [btR?.totalScore, ltR?.totalScore].filter((x) => x != null);
      if (parts.length) scores.push(parts.reduce((a, b) => a + b, 0) / parts.length);
    });
    if (!scores.length) return { avg: null, weekCount: 0 };
    const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    return { avg, weekCount: scores.length };
  },
};

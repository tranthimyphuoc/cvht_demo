/* Demo — BT→CVHT · LT→CVHT · LT NN→CVHT · CVHT→QLĐT (lớp HCM-KS24-CNTT1) */
const DEMO_ACCOUNTS = [
  { email: 'bt@rikkei.edu', role: 'BI_THU', label: 'Bí thư' },
  { email: 'lt@rikkei.edu', role: 'LOP_TRUONG', label: 'LT (CN)' },
  { email: 'lt.nn@rikkei.edu', role: 'LOP_TRUONG_NN', label: 'LT (NN)' },
  { email: 'cvht@rikkei.edu', role: 'CVHT', label: 'CVHT' },
  { email: 'admin@rikkei.edu', role: 'QLDT', label: 'QLĐT' },
];

const DEMO_CLASS_ID = 'c15';
const DEMO_CLASS_CODE = 'HCM-KS24-CNTT1';
const DEMO_CUR = Curriculum.forClass(DEMO_CLASS_CODE);
const DEMO_SEMESTER = DEMO_CUR?.semesterId || '2025-HK4';
const DEMO_SUBJECT = DEMO_CUR?.subjects?.[0]?.name || 'AI Application in Action';
const DEMO_SUBJECT_CODE = DEMO_CUR?.subjects?.[0]?.code || 'IT212-K24';

function demoReportCtx() {
  return {
    semesterId: DEMO_SEMESTER,
    subjectCode: DEMO_SUBJECT_CODE,
    subjectName: DEMO_SUBJECT,
    subject: DEMO_SUBJECT,
  };
}

const DEMO_FLOWS = [
  {
    id: 'f1',
    title: '1. [CN] Bí thư → CVHT',
    desc: 'Bí thư báo cáo hoạt động / phong trào → gửi thẳng Cố vấn học tập.',
    roles: ['BI_THU', 'CVHT'],
    steps: [
      { n: 1, account: 'bt@rikkei.edu', role: 'Bí thư', action: 'Tạo BC hoạt động → Gửi CVHT', go: 'report-bt' },
      { n: 2, account: 'cvht@rikkei.edu', role: 'CVHT', action: 'Nhận báo cáo → Xác nhận BC Bí thư', go: 'inbox' },
    ],
  },
  {
    id: 'f2',
    title: '2. [CN] Lớp trưởng → CVHT → QLĐT',
    desc: 'LT gửi BC lớp cho CVHT (song song với Bí thư); CVHT khảo sát & tổng hợp gửi QLĐT.',
    roles: ['LOP_TRUONG', 'CVHT', 'QLDT'],
    steps: [
      { n: 1, account: 'lt@rikkei.edu', role: 'Lớp trưởng', action: 'BC gửi CVHT', go: 'report-lt' },
      { n: 2, account: 'cvht@rikkei.edu', role: 'CVHT', action: 'Nhận báo cáo → Xác nhận + Vào lớp', go: 'inbox' },
      { n: 3, account: 'cvht@rikkei.edu', role: 'CVHT', action: 'BC Tổng hợp → Gửi QLĐT', go: 'report-cvht' },
      { n: 4, account: 'admin@rikkei.edu', role: 'QLĐT', action: 'Nhận báo cáo → Xác nhận đã nắm', go: 'inbox' },
    ],
  },
  {
    id: 'f3',
    title: '3. [NN] Lớp trưởng Ngoại ngữ → CVHT',
    desc: 'LT NN báo cáo chuyên cần hàng tuần → CVHT xác nhận. Không có Bí thư.',
    roles: ['LOP_TRUONG_NN', 'CVHT'],
    steps: [
      { n: 1, account: 'lt.nn@rikkei.edu', role: 'LT Ngoại ngữ', action: 'BC chuyên cần → Gửi CVHT', go: 'report-nn' },
      { n: 2, account: 'cvht@rikkei.edu', role: 'CVHT', action: 'Nhận báo cáo → Xác nhận BC NN', go: 'inbox' },
    ],
  },
  {
    id: 'f4',
    title: '4. [NN] Đánh giá R-Point cuối học phần',
    desc: 'Điều 13: 5 tiêu chí × 2 điểm = tối đa 10 R-Point. Demo: CVHT/QLĐT ghi nhận.',
    roles: ['CVHT', 'QLDT', 'LOP_TRUONG_NN'],
    steps: [
      { n: 1, account: 'cvht@rikkei.edu', role: 'CVHT', action: 'Chấm R-Point /10 cho LT NN', go: 'rpoint' },
      { n: 2, account: 'admin@rikkei.edu', role: 'QLĐT', action: 'Xem / phê duyệt kết quả R-Point', go: 'rpoint' },
    ],
  },
  {
    id: 'f5',
    title: '5. Cảnh báo sớm SV nguy cơ',
    desc: 'LT/BT/LT NN ghi nhận → CVHT tư vấn → chuyển QLĐT.',
    roles: ['LOP_TRUONG', 'LOP_TRUONG_NN', 'CVHT', 'QLDT'],
    steps: [
      { n: 1, account: 'lt@rikkei.edu', role: 'Lớp trưởng', action: 'Ghi nhận SV nguy cơ', go: 'at-risk' },
      { n: 2, account: 'cvht@rikkei.edu', role: 'CVHT', action: 'SV nguy cơ → Ghi tư vấn / xem Lịch sử CSSV', go: 'at-risk' },
      { n: 3, account: 'admin@rikkei.edu', role: 'QLĐT', action: 'Ghi chú / Xử lý xong case QLĐT', go: 'escalations' },
    ],
  },
];

const DemoKit = {
  seedFullScenario(actor) {
    const range = Scoring.getWeekRange();
    const now = new Date().toISOString();
    const ctx = demoReportCtx();

    Store.update((d) => {
      d.reports = (d.reports || []).filter((r) => !r.demoTag);
      d.visits = (d.visits || []).filter((v) => !v.demoTag);
      d.rpointEvals = (d.rpointEvals || []).filter((e) => !e.demoTag);
      d.notifications = (d.notifications || []).filter((n) => !n.demoTag);

      const scoreForm = (criteria, pct) => {
        const formData = {};
        criteria.forEach((c) => {
          const val = c.type === 'late_count' ? 0 : pct;
          formData[c.id] = {
            value: val,
            note: `Demo: ${c.title}`,
            point: Scoring.scoreCriterion(c, val, 0),
          };
        });
        return {
          formData,
          totalScore: Object.values(formData).reduce((s, x) => s + x.point, 0),
        };
      };

      const bt = scoreForm(SEED.criteriaBT, 100);
      const btId = Store.uid('rp');
      d.reports.unshift({
        id: btId, demoTag: true, classId: DEMO_CLASS_ID, ...ctx, reporterId: 'u_bt',
        reportKind: 'BI_THU', reportType: 'TUAN',
        weekStart: range.start.toISOString(), weekEnd: range.end.toISOString(),
        status: 'SENT_TO_CVHT', formData: bt.formData, totalScore: bt.totalScore,
        isLate: false, activityNote: 'Tuần này tổ chức sinh hoạt lớp + truyền thông lịch thi giữa kỳ.',
        createdAt: now, submittedAt: now, recipientRole: 'CVHT',
      });

      const lt = scoreForm(SEED.criteriaLT, 95);
      const ltId = Store.uid('rp');
      d.reports.unshift({
        id: ltId, demoTag: true, classId: DEMO_CLASS_ID, ...ctx, reporterId: 'u_lt',
        reportKind: 'LOP_TRUONG', reportType: 'TUAN',
        weekStart: range.start.toISOString(), weekEnd: range.end.toISOString(),
        status: 'SENT_TO_CVHT', formData: lt.formData, totalScore: lt.totalScore,
        isLate: false,
        summaryNote: '2 SV nguy cơ đang theo dõi. Đề nghị CVHT hỗ trợ case mất liên lạc.',
        createdAt: now, submittedAt: now, recipientRole: 'CVHT',
      });

      d.reports.unshift({
        id: Store.uid('rp'), demoTag: true, classId: 'cnn1', subject: 'English Communication L3', reporterId: 'u_ltnn',
        reportKind: 'LOP_TRUONG_NN', reportType: 'TUAN',
        weekStart: range.start.toISOString(), weekEnd: range.end.toISOString(),
        status: 'SENT_TO_CVHT',
        formData: {
          1: { point: 2, note: '@all Thông báo lịch học bù thứ Bảy từ GV trên Lark Group.', max: 2 },
          2: { point: 2, note: 'Động viên nhóm thuyết trình; nhắc SV thụ động tham gia thảo luận.', max: 2 },
          3: { point: 1, note: 'Trần Quốc Bảo nghỉ 2 buổi, chưa nộp 3 BTVN — đã báo GV/TG.', max: 2 },
          4: { point: 2, note: 'BC tuần trên Lark Base: 23/25 chuyên cần; 1 SV nguy cơ.', max: 2 },
          5: { point: 2, note: 'Triển khai yêu cầu bổ sung BTVN trước 17:00, cập nhật GV.', max: 2 },
        },
        totalScore: 9, isLate: false,
        summaryNote: 'Lớp ổn định; 1 case nguy cơ cần theo dõi.',
        createdAt: now, submittedAt: now, recipientRole: 'CVHT',
      });

      d.visits.unshift({
        id: Store.uid('vis'), demoTag: true, classId: DEMO_CLASS_ID, cvhtId: 'u_pvh',
        visitDate: now.slice(0, 10),
        observation: 'Lớp ổn định, sĩ số tốt. Nhắc LT đôn đốc SV nghỉ học.',
        createdAt: now,
      });

      d.reports.unshift({
        id: Store.uid('rp'), demoTag: true, classId: DEMO_CLASS_ID, ...ctx, reporterId: 'u_pvh',
        reportKind: 'CVHT_TONG_HOP', reportType: 'TUAN',
        weekStart: range.start.toISOString(), weekEnd: range.end.toISOString(),
        status: 'SENT_TO_QLDT',
        formData: {
          visitDone: true,
          classMood: 'Ổn định',
          riskSummary: '2 SV nguy cơ CN + 1 SV NN — đã liên hệ phần lớn',
          recommendation: 'Đề nghị QLĐT hỗ trợ case mất liên lạc nếu tuần sau chưa phản hồi',
        },
        totalScore: null, isLate: false, linkedReportIds: [btId, ltId],
        summaryNote: 'Tổng hợp từ BC Bí thư + LT CN + ghi nhận BC LT NN tuần này.',
        attachments: [
          {
            id: Store.uid('att'),
            name: 'bien_ban_vao_lop.png',
            type: 'image/png',
            size: 420,
            kind: 'image',
            dataUrl: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect fill="#F4F4F5" width="320" height="200"/><rect fill="#C8102E" x="20" y="20" width="48" height="48" rx="10"/><text x="80" y="50" font-family="sans-serif" font-size="16" font-weight="700" fill="#0F0F10">Biên bản vào lớp</text><text x="20" y="100" font-family="sans-serif" font-size="13" fill="#71717A">' + DEMO_CLASS_CODE + ' · Demo minh chứng</text><text x="20" y="128" font-family="sans-serif" font-size="12" fill="#A1A1AA">CVHT đính kèm khi gửi QLĐT</text></svg>'),
          },
          {
            id: Store.uid('att'),
            name: 'tom_tat_tuan.txt',
            type: 'text/plain',
            size: 86,
            kind: 'file',
            dataUrl: 'data:text/plain;base64,' + btoa('Tom tat tuan — lop on dinh, 2 SV nguy co dang theo doi.'),
          },
        ],
        createdAt: now, submittedAt: now, recipientRole: 'QLDT',
      });

      d.rpointEvals.unshift({
        id: Store.uid('rpnt'), demoTag: true, classId: 'cnn1', ltId: 'u_ltnn',
        evaluatorId: 'u_pvh',
        scores: { 1: 2, 2: 2, 3: 1.5, 4: 2, 5: 1.5 },
        total: 9,
        note: 'Demo: hoàn thành tốt nhiệm vụ học phần L3.',
        createdAt: now,
      });

      [
        { userId: 'u_pvh', title: '[Demo] BC Bí thư mới', body: `${DEMO_CLASS_CODE} — Đào Trọng Trí đã gửi báo cáo hoạt động.` },
        { userId: 'u_pvh', title: '[Demo] BC Lớp trưởng CN', body: `${DEMO_CLASS_CODE} — Lu Nhựt Đình đã gửi báo cáo tuần.` },
        { userId: 'u_nq', title: '[Demo] BC Lớp trưởng NN', body: 'HN-ENG-L3A — Nguyễn Bảo Châu đã gửi BC chuyên cần.' },
        { userId: 'u_cvht_demo', title: '[Demo] Nhận báo cáo', body: 'Có BC Bí thư + LT (CN/NN) chờ xử lý.' },
        { userId: 'u_ltnn', title: '[Demo] R-Point', body: 'Kết quả R-Point học phần: 9/10.' },
        { userId: 'u_admin', title: '[Demo] BC tổng hợp CVHT', body: 'Phạm Viết Hùng đã gửi báo cáo tổng hợp.' },
      ].forEach((n) => {
        d.notifications.unshift({ id: Store.uid('n'), demoTag: true, ...n, read: false, createdAt: now });
      });

      d.auditLog.unshift({
        id: Store.uid('al'), actorId: actor?.id || 'u_admin', actorName: actor?.name || 'Demo',
        action: 'SEED_IMPORT', entity: 'System', entityId: 'DEMO',
        beforeJson: '', afterJson: 'Gieo demo: BT→CVHT · LT→CVHT · NN · R-Point', at: now,
      });
    });
  },

  progressKey: 'cvht_demo_progress_v8',
  getProgress() {
    try { return JSON.parse(localStorage.getItem(this.progressKey) || '{}'); }
    catch { return {}; }
  },
  toggleStep(flowId, stepN) {
    const p = this.getProgress();
    p[`${flowId}_${stepN}`] = !p[`${flowId}_${stepN}`];
    localStorage.setItem(this.progressKey, JSON.stringify(p));
  },
  isDone(flowId, stepN) { return !!this.getProgress()[`${flowId}_${stepN}`]; },
  flowProgress(flow) {
    const done = flow.steps.filter((s) => this.isDone(flow.id, s.n)).length;
    return { done, total: flow.steps.length, pct: Math.round((done / flow.steps.length) * 100) };
  },
  resetProgress() { localStorage.removeItem(this.progressKey); },
};

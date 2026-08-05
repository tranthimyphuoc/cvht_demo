/* Seed — Chuyên ngành: BT → LT → CVHT → QLĐT | Ngoại ngữ: LT NN → CVHT → QLĐT */
const SEED = {
  users: [
    { id: 'u_admin', email: 'admin@rikkei.edu', password: '123456', name: 'Phòng Quản lý Đào tạo', primaryRole: 'QLDT', campus: 'ALL', initials: 'QL', phone: '', active: true },

    { id: 'u_nq', email: 'nhuquynh@rikkei.edu', password: '123456', name: 'Nguyễn Thị Như Quỳnh', primaryRole: 'CVHT', campus: 'HN', initials: 'NQ', active: true },
    { id: 'u_mxc', email: 'xuanchinh@rikkei.edu', password: '123456', name: 'Mai Xuân Chinh', primaryRole: 'CVHT', campus: 'HN', initials: 'XC', active: true },
    { id: 'u_ptb', email: 'tuanbinh@rikkei.edu', password: '123456', name: 'Phạm Tuấn Bình', primaryRole: 'CVHT', campus: 'HN', initials: 'TB', active: true },
    { id: 'u_pnk', email: 'ngockien@rikkei.edu', password: '123456', name: 'Phạm Ngọc Kiên', primaryRole: 'CVHT', campus: 'HN', initials: 'NK', active: true },
    { id: 'u_pvh', email: 'viethung@rikkei.edu', password: '123456', name: 'Phạm Viết Hùng', primaryRole: 'CVHT', campus: 'HCM', initials: 'VH', active: true },
    { id: 'u_lxhn', email: 'hoangnguyen@rikkei.edu', password: '123456', name: 'Lưu Xuân Hoàng Nguyên', primaryRole: 'CVHT', campus: 'HCM', initials: 'HN', active: true },

    { id: 'u_lt', email: 'lt@rikkei.edu', password: '123456', name: 'Lu Nhựt Đình', primaryRole: 'LOP_TRUONG', campus: 'HCM', initials: 'Đ', classId: 'c15', active: true },
    { id: 'u_bt', email: 'bt@rikkei.edu', password: '123456', name: 'Đào Trọng Trí', primaryRole: 'BI_THU', campus: 'HCM', initials: 'T', classId: 'c15', active: true },
    { id: 'u_ltnn', email: 'lt.nn@rikkei.edu', password: '123456', name: 'Nguyễn Bảo Châu', primaryRole: 'LOP_TRUONG_NN', campus: 'HN', initials: 'BC', classId: 'cnn1', active: true },

    { id: 'u_cvht_demo', email: 'cvht@rikkei.edu', password: '123456', name: 'Phạm Viết Hùng', primaryRole: 'CVHT', campus: 'HCM', initials: 'VH', active: true, aliasOf: 'u_pvh' },
  ],

  campuses: [
    { id: 'HN', name: 'Hà Nội' },
    { id: 'HCM', name: 'Hồ Chí Minh' },
  ],

  majors: [
    { id: 'QTKD', name: 'Quản trị Kinh doanh' },
    { id: 'CNTT', name: 'Công nghệ Thông tin' },
    { id: 'ENG', name: 'Ngoại ngữ' },
  ],

  classes: [
    { id: 'c1', code: 'HN-K25-QTKD1', majorId: 'QTKD', subject: 'Quản trị Kinh doanh', campusId: 'HN', programType: 'CHUYEN_NGANH', cvhtId: 'u_nq', ltId: null, btId: null, semester: '2025-HK2', studentCount: 28, active: true },
    { id: 'c2', code: 'HN-K25-QTKD2', majorId: 'QTKD', subject: 'Quản trị Kinh doanh', campusId: 'HN', programType: 'CHUYEN_NGANH', cvhtId: 'u_nq', ltId: null, btId: null, semester: '2025-HK2', studentCount: 26, active: true },
    { id: 'c3', code: 'HN-K25-QTKD3', majorId: 'QTKD', subject: 'Quản trị Kinh doanh', campusId: 'HN', programType: 'CHUYEN_NGANH', cvhtId: 'u_nq', ltId: null, btId: null, semester: '2025-HK2', studentCount: 27, active: true },
    { id: 'c4', code: 'HN-KS24-CNTT1', majorId: 'CNTT', subject: 'Lập trình Web Frontend', campusId: 'HN', programType: 'CHUYEN_NGANH', cvhtId: 'u_mxc', ltId: null, btId: null, semester: '2025-HK2', studentCount: 30, active: true },
    { id: 'c5', code: 'HN-KS24-CNTT2', majorId: 'CNTT', subject: 'Lập trình Backend Java', campusId: 'HN', programType: 'CHUYEN_NGANH', cvhtId: 'u_mxc', ltId: null, btId: null, semester: '2025-HK2', studentCount: 29, active: true },
    { id: 'c6', code: 'HN-KS25-CNTT1', majorId: 'CNTT', subject: 'Cơ sở dữ liệu', campusId: 'HN', programType: 'CHUYEN_NGANH', cvhtId: 'u_pnk', ltId: null, btId: null, semester: '2025-HK2', studentCount: 32, active: true },
    { id: 'c15', code: 'HCM-KS24-CNTT1', majorId: 'CNTT', subject: 'AI Application in Action', campusId: 'HCM', programType: 'CHUYEN_NGANH', cvhtId: 'u_pvh', ltId: 'u_lt', btId: 'u_bt', semester: '2025-HK4', studentCount: 25, note: 'Sáng', active: true },
    { id: 'c16', code: 'HCM-KS25-CNTT5', majorId: 'CNTT', subject: 'Lập trình Backend Java', campusId: 'HCM', programType: 'CHUYEN_NGANH', cvhtId: 'u_pvh', ltId: null, btId: null, semester: '2025-HK2', studentCount: 28, note: 'Chiều', active: true },
    { id: 'c17', code: 'HCM-K25-QTKD1', majorId: 'QTKD', subject: 'Quản trị Kinh doanh', campusId: 'HCM', programType: 'CHUYEN_NGANH', cvhtId: 'u_lxhn', ltId: null, btId: null, semester: '2025-HK2', studentCount: 27, note: 'Sáng', active: true },
    { id: 'c18', code: 'HCM-K25-QTKD2', majorId: 'QTKD', subject: 'Quản trị Kinh doanh', campusId: 'HCM', programType: 'CHUYEN_NGANH', cvhtId: 'u_lxhn', ltId: null, btId: null, semester: '2025-HK2', studentCount: 24, note: 'Chiều', active: true },
    { id: 'cnn1', code: 'HN-ENG-L3A', majorId: 'ENG', subject: 'English Communication L3', campusId: 'HN', programType: 'NGOAI_NGU', cvhtId: 'u_nq', ltId: 'u_ltnn', btId: null, semester: '2025-HK2', level: 'L3', studentCount: 25, active: true },
    { id: 'cnn2', code: 'HCM-ENG-L2B', majorId: 'ENG', subject: 'English Communication L2', campusId: 'HCM', programType: 'NGOAI_NGU', cvhtId: 'u_pvh', ltId: null, btId: null, semester: '2025-HK2', level: 'L2', studentCount: 22, active: true },
  ],

  students: [
    { id: 's1', classId: 'c1', name: 'Nguyễn Văn An', studentCode: 'SV25001', status: 'ACTIVE' },
    { id: 's2', classId: 'c1', name: 'Trần Thị Bình', studentCode: 'SV25002', status: 'ACTIVE' },
    { id: 's3', classId: 'c1', name: 'Lê Hoàng Cường', studentCode: 'SV25003', status: 'AT_RISK', riskReason: 'Nghỉ 2 buổi liên tiếp, mất liên lạc', riskLevel: 'HIGH' },
    { id: 's4', classId: 'c1', name: 'Phạm Thu Dung', studentCode: 'SV25004', status: 'ACTIVE' },
    { id: 's5', classId: 'c1', name: 'Hoàng Minh Em', studentCode: 'SV25005', status: 'AT_RISK', riskReason: 'Không nộp 3 bài tập', riskLevel: 'MEDIUM' },
    { id: 's6', classId: 'c1', name: 'Vũ Thị Phương', studentCode: 'SV25006', status: 'ACTIVE' },
    { id: 's7', classId: 'c1', name: 'Đặng Quốc Gia', studentCode: 'SV25007', status: 'ACTIVE' },
    { id: 's8', classId: 'c1', name: 'Bùi Lan Hương', studentCode: 'SV25008', status: 'ACTIVE' },
    { id: 's9', classId: 'c1', name: 'Ngô Đức Khoa', studentCode: 'SV25009', status: 'AT_RISK', riskReason: 'Chuyên cần < 70%', riskLevel: 'MEDIUM' },
    { id: 's10', classId: 'c1', name: 'Đỗ Mỹ Linh', studentCode: 'SV25010', status: 'ACTIVE' },
    { id: 's14', classId: 'c4', name: 'Phan Văn Sơn', studentCode: 'SV24001', status: 'AT_RISK', riskReason: 'Nguy cơ thôi học — mất liên lạc', riskLevel: 'HIGH' },
    { id: 'sn1', classId: 'cnn1', name: 'Lê Minh Anh', studentCode: 'EN25001', status: 'ACTIVE' },
    { id: 'sn2', classId: 'cnn1', name: 'Trần Quốc Bảo', studentCode: 'EN25002', status: 'AT_RISK', riskReason: 'Nghỉ 2 buổi liên tiếp, chưa nộp BTVN', riskLevel: 'HIGH' },
    { id: 'sn3', classId: 'cnn1', name: 'Phạm Ngọc Chi', studentCode: 'EN25003', status: 'ACTIVE' },
  ],

  /** Bí thư — hoạt động, phong trào, truyền thông */
  criteriaBT: [
    { id: 1, title: 'Triển khai truyền thông / thông báo lớp', desc: '% thông báo triển khai kịp thời (trong 12 giờ)', max: 20, type: 'all_or_nothing' },
    { id: 2, title: 'Theo dõi tiếp cận thông tin', desc: '% SV nhận thông tin trong 06 giờ', max: 15, type: 'tier_95' },
    { id: 3, title: 'Tổ chức hoạt động / phong trào lớp', desc: '% hoạt động đúng kế hoạch', max: 20, type: 'all_or_nothing' },
    { id: 4, title: 'Phối hợp hỗ trợ sinh viên', desc: '% case được phối hợp với Lớp trưởng / CVHT', max: 15, type: 'tier_90' },
    { id: 5, title: 'Chế độ báo cáo', desc: 'Nộp đúng hạn cho CVHT', max: 15, type: 'late_count', readonly: true },
    { id: 6, title: 'Nhiệm vụ được giao', desc: '% nhiệm vụ hoàn thành đúng hạn', max: 15, type: 'tier_90' },
  ],

  /** Lớp trưởng chuyên ngành — tình hình lớp gửi CVHT */
  criteriaLT: [
    { id: 1, title: 'Theo dõi tình hình học tập của lớp', desc: '% SV nguy cơ được cập nhật trong 03 ngày', max: 20, type: 'tier_80' },
    { id: 2, title: 'Hỗ trợ sinh viên có nguy cơ', desc: '% trường hợp được liên hệ hỗ trợ', max: 20, type: 'tier_80' },
    { id: 3, title: 'Triển khai thông báo', desc: '% thông báo triển khai trong 12 giờ', max: 15, type: 'all_or_nothing' },
    { id: 4, title: 'Điều phối Ban cán sự lớp', desc: '% nhiệm vụ BCS được phân công và theo dõi đúng tiến độ', max: 15, type: 'tier_90' },
    { id: 5, title: 'Chế độ báo cáo', desc: 'Nộp đúng hạn cho CVHT', max: 15, type: 'late_count', readonly: true },
    { id: 6, title: 'Nhiệm vụ được giao', desc: '% nhiệm vụ hoàn thành đúng hạn', max: 15, type: 'tier_90' },
  ],

  /**
   * R-Point Lớp trưởng Ngoại ngữ (Điều 13) — cuối học phần, tối đa 10 điểm.
   * Theo quy chế do Giảng viên chấm; trong demo CVHT/QLĐT ghi nhận để theo dõi.
   */
  criteriaRPoint: [
    { id: 1, title: 'Hoàn thành nhiệm vụ Lớp trưởng đúng thời hạn', max: 2 },
    { id: 2, title: 'Phối hợp hiệu quả với giảng viên và trợ giảng', max: 2 },
    { id: 3, title: 'Truyền đạt thông tin và hỗ trợ sinh viên', max: 2 },
    { id: 4, title: 'Điều phối lớp học, duy trì nề nếp và môi trường học tập', max: 2 },
    { id: 5, title: 'Tinh thần trách nhiệm và đóng góp cho tập thể', max: 2 },
  ],

  seedAssignmentHistory: [
    {
      id: 'ah1', classId: 'c15', semester: '2025-HK2', role: 'LOP_TRUONG',
      fromUserId: null, fromUserName: '—', toUserId: 'u_lt', toUserName: 'Lu Nhựt Đình',
      changedById: 'u_admin', changedByName: 'Phòng Quản lý Đào tạo',
      reason: 'Công nhận Ban cán sự học kỳ 2025-HK2', at: '2026-01-15T09:00:00+07:00',
    },
    {
      id: 'ah2', classId: 'c15', semester: '2025-HK2', role: 'BI_THU',
      fromUserId: null, fromUserName: '—', toUserId: 'u_bt', toUserName: 'Đào Trọng Trí',
      changedById: 'u_admin', changedByName: 'Phòng Quản lý Đào tạo',
      reason: 'Công nhận Ban cán sự học kỳ 2025-HK2', at: '2026-01-15T09:05:00+07:00',
    },
    {
      id: 'ah3', classId: 'cnn1', semester: '2025-HK2', role: 'LOP_TRUONG_NN',
      fromUserId: null, fromUserName: '—', toUserId: 'u_ltnn', toUserName: 'Nguyễn Bảo Châu',
      changedById: 'u_admin', changedByName: 'Phòng Quản lý Đào tạo',
      reason: 'Công nhận Lớp trưởng Ngoại ngữ học phần L3', at: '2026-01-20T09:00:00+07:00',
    },
  ],

  seedRoleHistory: [
    {
      id: 'rh1', userId: 'u_lt', userName: 'Lu Nhựt Đình',
      fromRole: 'SINH_VIEN', toRole: 'LOP_TRUONG', classId: 'c15',
      changedById: 'u_admin', changedByName: 'Phòng Quản lý Đào tạo',
      reason: 'Công nhận Lớp trưởng HCM-KS24-CNTT1', at: '2026-01-15T09:00:00+07:00',
    },
    {
      id: 'rh2', userId: 'u_bt', userName: 'Đào Trọng Trí',
      fromRole: 'SINH_VIEN', toRole: 'BI_THU', classId: 'c15',
      changedById: 'u_admin', changedByName: 'Phòng Quản lý Đào tạo',
      reason: 'Công nhận Bí thư HCM-KS24-CNTT1', at: '2026-01-15T09:05:00+07:00',
    },
    {
      id: 'rh3', userId: 'u_ltnn', userName: 'Nguyễn Bảo Châu',
      fromRole: 'SINH_VIEN', toRole: 'LOP_TRUONG_NN', classId: 'cnn1',
      changedById: 'u_admin', changedByName: 'Phòng Quản lý Đào tạo',
      reason: 'Công nhận Lớp trưởng HN-ENG-L3A', at: '2026-01-20T09:00:00+07:00',
    },
  ],

  seedAuditLog: [
    {
      id: 'al1', actorId: 'u_admin', actorName: 'Phòng Quản lý Đào tạo',
      action: 'SEED_IMPORT', entity: 'System', entityId: 'ALL',
      beforeJson: '', afterJson: 'Khởi tạo: BT→CVHT · LT→CVHT · LT NN→CVHT · CVHT→QLĐT',
      at: '2026-01-10T08:00:00+07:00',
    },
    {
      id: 'al_st1', actorId: 'u_lt', actorName: 'Lu Nhựt Đình',
      action: 'STUDENT_STATUS', entity: 'Student', entityId: 'simp_246',
      beforeJson: 'ACTIVE: ',
      afterJson: 'WATCH: Nghỉ 1 buổi, chưa nộp BTVN',
      at: '2026-03-27T09:15:00+07:00',
    },
    {
      id: 'al_st2', actorId: 'u_pvh', actorName: 'Phạm Viết Hùng',
      action: 'STUDENT_STATUS', entity: 'Student', entityId: 'simp_246',
      beforeJson: 'WATCH: Nghỉ 1 buổi, chưa nộp BTVN',
      afterJson: 'AT_RISK: Mất liên lạc 48h — nâng mức nguy cơ',
      at: '2026-03-28T08:40:00+07:00',
    },
  ],

  notifications: [
    { id: 'n1', userId: 'u_bt', title: 'Nhắc báo cáo hoạt động tuần', body: 'Gửi báo cáo phong trào / truyền thông cho CVHT trước 23:00 Thứ 6.', read: false, createdAt: new Date().toISOString() },
    { id: 'n2', userId: 'u_lt', title: 'Nhắc báo cáo tuần', body: 'Gửi báo cáo tình hình lớp cho CVHT trước 23:00 Thứ 6.', read: false, createdAt: new Date().toISOString() },
    { id: 'n3', userId: 'u_ltnn', title: 'Báo cáo tuần Ngoại ngữ', body: 'Gửi báo cáo chuyên cần / tình hình lớp cho CVHT trước 23:00 Thứ 6.', read: false, createdAt: new Date().toISOString() },
    { id: 'n4', userId: 'u_nq', title: 'Nhận báo cáo', body: 'Nhận BC từ Bí thư, Lớp trưởng (CN) và Lớp trưởng NN.', read: false, createdAt: new Date().toISOString() },
    { id: 'n5', userId: 'u_cvht_demo', title: 'Nhận báo cáo', body: 'Nhận BC từ Bí thư, Lớp trưởng (CN) và Lớp trưởng NN.', read: false, createdAt: new Date().toISOString() },
    { id: 'n6', userId: 'u_admin', title: 'Báo cáo CVHT', body: 'Theo dõi báo cáo tổng hợp từ CVHT.', read: false, createdAt: new Date().toISOString() },
  ],

  counseling: [
    { id: 'cn1', studentId: 'simp_246', cvhtId: 'u_pvh', note: 'Đã gọi điện, SV báo lý do gia đình. Kế hoạch học bù trong tuần.', status: 'IN_PROGRESS', createdAt: '2026-03-28T10:00:00+07:00' },
    { id: 'cn2', studentId: 'simp_246', cvhtId: 'u_pvh', note: 'Theo dõi sau buổi học bù — SV đã nộp 1 bài, chuyên cần cải thiện.', status: 'IN_PROGRESS', createdAt: '2026-03-30T16:00:00+07:00' },
  ],

  escalations: [
    {
      id: 'e1', studentId: 's14', classId: 'c4', cvhtId: 'u_mxc',
      reason: 'Không liên hệ được SV sau 48h — đề xuất QLĐT',
      status: 'OPEN', createdAt: '2026-03-30T14:00:00+07:00',
      notes: [
        {
          id: 'en1', text: 'Đã gọi 2 lần, SMS 1 lần — chưa phản hồi.',
          by: 'u_mxc', byName: 'Mai Xuân Chinh', at: '2026-03-30T14:05:00+07:00', kind: 'note',
        },
      ],
    },
  ],
};

const ROLE_LABELS = {
  QLDT: 'Quản lý Đào tạo',
  CVHT: 'Cố vấn học tập',
  LOP_TRUONG: 'Lớp trưởng',
  LOP_TRUONG_NN: 'Lớp trưởng Ngoại ngữ',
  BI_THU: 'Bí thư',
  SINH_VIEN: 'Sinh viên',
};

const APP_ROLES = ['QLDT', 'CVHT', 'LOP_TRUONG', 'LOP_TRUONG_NN', 'BI_THU'];

const ASSIGN_ROLE_FIELDS = {
  CVHT: 'cvhtId',
  LOP_TRUONG: 'ltId',
  LOP_TRUONG_NN: 'ltId',
  BI_THU: 'btId',
};

const ASSIGN_ROLE_LABELS = {
  CVHT: 'Cố vấn học tập',
  LOP_TRUONG: 'Lớp trưởng (CN)',
  LOP_TRUONG_NN: 'Lớp trưởng (NN)',
  BI_THU: 'Bí thư',
};

/** Chuỗi luồng báo cáo — BT & LT gửi song song tới CVHT */
const FLOW_CHAIN = [
  { from: 'BI_THU', to: 'CVHT', label: 'Bí thư → CVHT' },
  { from: 'LOP_TRUONG', to: 'CVHT', label: 'Lớp trưởng CN → CVHT' },
  { from: 'LOP_TRUONG_NN', to: 'CVHT', label: 'Lớp trưởng NN → CVHT' },
  { from: 'CVHT', to: 'QLDT', label: 'CVHT → QLĐT' },
];

const REPORT_KIND_LABELS = {
  BI_THU: 'Báo cáo Bí thư (hoạt động / phong trào)',
  LOP_TRUONG: 'Báo cáo Lớp trưởng CN (gửi CVHT)',
  LOP_TRUONG_NN: 'Báo cáo Lớp trưởng NN (chuyên cần)',
  CVHT_TONG_HOP: 'Báo cáo tổng hợp CVHT (gửi QLĐT)',
};

const STATUS_LABELS = {
  DRAFT: { label: 'Nháp', cls: 'badge-muted' },
  SENT_TO_CVHT: { label: 'Đã gửi CVHT', cls: 'badge-warn' },
  SEEN_BY_CVHT: { label: 'CVHT đã xử lý', cls: 'badge-info' },
  SENT_TO_QLDT: { label: 'Đã gửi QLĐT', cls: 'badge-warn' },
  SEEN_BY_QLDT: { label: 'QLĐT đã nắm', cls: 'badge-ok' },
  /* legacy — báo cáo cũ BT→LT (nếu còn trong local) */
  SENT_TO_LT: { label: 'Đã gửi Lớp trưởng (cũ)', cls: 'badge-muted' },
  SEEN_BY_LT: { label: 'LT đã tiếp nhận (cũ)', cls: 'badge-muted' },
};

const RPOINT_LEVELS = [
  { value: 2, label: '2.0 — Hoàn thành đầy đủ' },
  { value: 1.5, label: '1.5 — Hoàn thành tốt' },
  { value: 1, label: '1.0 — Hoàn thành khá' },
  { value: 0.5, label: '0.5 — Hoàn thành một phần' },
  { value: 0, label: '0 — Không hoàn thành' },
];

function userRole(u) {
  return u?.primaryRole || u?.role;
}

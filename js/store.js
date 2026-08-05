/* LocalStorage + Audit + Sheets bridge */
const Store = {
  KEY: 'cvht_hub_v15',

  nameToUserId(name, users) {
    if (!name) return null;
    const n = name.trim().toLowerCase();
    const KNOWN = {
      'nguyễn thị như quỳnh': 'u_nq',
      'mai xuân chinh': 'u_mxc',
      'phạm tuấn bình': 'u_ptb',
      'phạm ngọc kiên': 'u_pnk',
      'phạm viết hùng': 'u_pvh',
      'lưu xuân hoàng nguyên': 'u_lxhn',
      'lu nhựt đình': 'u_lt',
      'đào trọng trí': 'u_bt',
      'trần minh đức': 'u_lt',
      'lê thu hà': 'u_bt',
    };
    if (KNOWN[n]) return KNOWN[n];
    const u = users.find((x) => x.name.trim().toLowerCase() === n);
    return u?.id || null;
  },

  mergeStaffData(classes, users) {
    if (typeof STAFF_IMPORT === 'undefined') return { classes, users };

    const mergedUsers = JSON.parse(JSON.stringify(users));
    const byName = new Map(mergedUsers.map((u) => [u.name.trim().toLowerCase(), u]));

    STAFF_IMPORT.users.forEach((su) => {
      const key = su.name.trim().toLowerCase();
      const ex = byName.get(key);
      if (ex) {
        if (!ex.phone && su.phone) ex.phone = su.phone;
        if (su.primaryRole === 'CVHT' && ex.primaryRole !== 'QLDT') ex.primaryRole = 'CVHT';
      } else if (!mergedUsers.some((u) => u.id === su.id)) {
        mergedUsers.push(su);
        byName.set(key, su);
      }
    });

    const officerMap = {};
    STAFF_IMPORT.officers.forEach((o) => {
      if (!officerMap[o.classCode]) officerMap[o.classCode] = {};
      const uid = this.nameToUserId(o.name, mergedUsers);
      if (!uid) return;
      if (o.role === 'LOP_TRUONG') officerMap[o.classCode].ltId = uid;
      if (o.role === 'BI_THU') officerMap[o.classCode].btId = uid;
    });

    const mergedClasses = classes.map((c) => {
      const staff = STAFF_IMPORT.classStaff[c.code];
      const off = officerMap[c.code];
      const patch = {};
      if (staff) {
        const cvhtId = this.nameToUserId(staff.cvht, mergedUsers);
        if (cvhtId) patch.cvhtId = cvhtId;
        if (staff.gv) patch.gvName = staff.gv;
        if (staff.tg) patch.tgName = staff.tg;
        if (staff.note && !c.note) patch.note = staff.note;
      }
      if (off?.ltId) patch.ltId = off.ltId;
      if (off?.btId) patch.btId = off.btId;
      return Object.keys(patch).length ? { ...c, ...patch } : c;
    });

    return { classes: mergedClasses, users: mergedUsers };
  },

  catalogFromImport() {
    const baseUsers = JSON.parse(JSON.stringify(SEED.users));
    if (typeof STUDENT_IMPORT === 'undefined') {
      const { classes, users } = this.mergeStaffData(JSON.parse(JSON.stringify(SEED.classes)), baseUsers);
      return {
        classes,
        users,
        students: JSON.parse(JSON.stringify(SEED.students)),
      };
    }
    const seedByCode = Object.fromEntries(SEED.classes.map((c) => [c.code, c]));
    const useStaff = typeof STAFF_IMPORT !== 'undefined';
    let classes = STUDENT_IMPORT.classes.map((c) => {
      const s = seedByCode[c.code];
      if (!s) {
        const { cvhtId, ltId, btId, ...rest } = c;
        return rest;
      }
      return {
        ...c,
        id: s.id,
        subject: s.subject || c.subject,
        note: s.note ?? c.note,
        level: s.level,
        semester: s.semester || c.semester,
        programType: s.programType || c.programType,
        ...(useStaff ? {} : { ltId: s.ltId, btId: s.btId, cvhtId: s.cvhtId }),
        ...(useStaff && s.ltId ? { ltId: s.ltId } : {}),
        ...(useStaff && s.btId ? { btId: s.btId } : {}),
      };
    });
    const codes = new Set(classes.map((c) => c.code));
    SEED.classes.forEach((c) => {
      if (!codes.has(c.code)) classes.push(JSON.parse(JSON.stringify(c)));
    });
    const idByCode = Object.fromEntries(classes.map((c) => [c.code, c.id]));
    const students = STUDENT_IMPORT.students.map((s) => ({
      ...s,
      classId: idByCode[s.classCode] || s.classId,
      status: s.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
    }));
    const merged = this.mergeStaffData(classes, baseUsers);
    return { classes: merged.classes, users: merged.users, students };
  },

  defaults() {
    const { classes, students, users } = this.catalogFromImport();
    const curriculumPrograms = typeof Curriculum !== 'undefined'
      ? Curriculum.defaultPrograms()
      : {};
    return {
      classes,
      users,
      students,
      curriculumPrograms,
      reports: [],
      visits: [],
      atRiskNotes: [...SEED.counseling],
      escalations: [...SEED.escalations],
      notifications: [...SEED.notifications],
      evaluations: [],
      rpointEvals: [],
      lateCounts: {},
      assignmentHistory: [...SEED.seedAssignmentHistory],
      roleHistory: [...SEED.seedRoleHistory],
      auditLog: [...SEED.seedAuditLog],
    };
  },

  mergeClassOverrides(catalogClasses, savedClasses) {
    if (!savedClasses?.length) return catalogClasses;
    const byId = Object.fromEntries(savedClasses.map((c) => [c.id, c]));
    return catalogClasses.map((c) => {
      const s = byId[c.id];
      if (!s) return c;
      return {
        ...c,
        subject: s.subject ?? c.subject,
        subjectCode: s.subjectCode ?? c.subjectCode,
        semester: s.semester ?? c.semester,
        ltId: s.ltId !== undefined ? s.ltId : c.ltId,
        btId: s.btId !== undefined ? s.btId : c.btId,
        cvhtId: s.cvhtId !== undefined ? s.cvhtId : c.cvhtId,
        note: s.note ?? c.note,
        gvName: s.gvName ?? c.gvName,
        tgName: s.tgName ?? c.tgName,
      };
    });
  },

  /** Giữ trạng thái/ghi chú nguy cơ đã cập nhật trên SV import */
  mergeStudentOverrides(catalogStudents, savedStudents) {
    if (!savedStudents?.length) return catalogStudents;
    const byId = Object.fromEntries(savedStudents.map((s) => [s.id, s]));
    const catalogIds = new Set(catalogStudents.map((s) => s.id));
    const merged = catalogStudents.map((s) => {
      const o = byId[s.id];
      if (!o) return s;
      return {
        ...s,
        status: o.status ?? s.status,
        statusNote: o.statusNote ?? s.statusNote,
        riskReason: o.riskReason ?? s.riskReason,
        riskLevel: o.riskLevel ?? s.riskLevel,
        statusUpdatedAt: o.statusUpdatedAt ?? s.statusUpdatedAt,
        statusUpdatedBy: o.statusUpdatedBy ?? s.statusUpdatedBy,
      };
    });
    // SV ghi nhận thủ công (id không có trong catalog)
    savedStudents.forEach((s) => {
      if (!catalogIds.has(s.id)) merged.push(s);
    });
    return merged;
  },

  resolveCurriculumPrograms(saved) {
    if (typeof Curriculum === 'undefined') return {};
    if (saved?.curriculumPrograms) {
      const migrated = Curriculum.migrateFromTracks(saved.curriculumPrograms);
      return migrated || saved.curriculumPrograms;
    }
    if (saved?.curriculumTracks) {
      return Curriculum.migrateFromTracks(saved.curriculumTracks) || Curriculum.defaultPrograms();
    }
    return Curriculum.defaultPrograms();
  },

  applyCurriculum(data) {
    if (typeof Curriculum !== 'undefined') {
      Curriculum.use(data.curriculumPrograms || Curriculum.defaultPrograms());
    }
    return data;
  },

  load() {
    try {
      const catalog = this.defaults();
      const raw = localStorage.getItem(this.KEY);
      if (!raw) {
        this.save(catalog);
        return this.applyCurriculum(catalog);
      }
      const saved = JSON.parse(raw);
      const data = {
        ...catalog,
        classes: this.mergeClassOverrides(catalog.classes, saved.classes),
        students: this.mergeStudentOverrides(catalog.students, saved.students),
        curriculumPrograms: this.resolveCurriculumPrograms(saved) || catalog.curriculumPrograms,
        reports: saved.reports || [],
        visits: saved.visits || [],
        atRiskNotes: saved.atRiskNotes ?? catalog.atRiskNotes,
        escalations: saved.escalations ?? catalog.escalations,
        notifications: saved.notifications ?? catalog.notifications,
        evaluations: saved.evaluations || [],
        rpointEvals: saved.rpointEvals || [],
        lateCounts: saved.lateCounts || {},
        assignmentHistory: saved.assignmentHistory ?? catalog.assignmentHistory,
        roleHistory: saved.roleHistory ?? catalog.roleHistory,
        auditLog: saved.auditLog ?? catalog.auditLog,
      };
      return this.applyCurriculum(data);
    } catch {
      return this.applyCurriculum(this.defaults());
    }
  },

  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },

  get() {
    return this.load();
  },

  update(fn) {
    const data = this.load();
    fn(data);
    this.save(data);
    return this.applyCurriculum(data);
  },

  reset() {
    localStorage.removeItem(this.KEY);
    localStorage.removeItem('cvht_session');
  },

  setSession(user) {
    localStorage.setItem('cvht_session', JSON.stringify({ id: user.id, at: Date.now() }));
  },

  getSession() {
    try {
      const s = JSON.parse(localStorage.getItem('cvht_session'));
      if (!s) return null;
      const data = this.load();
      return data.users.find((u) => u.id === s.id) || SEED.users.find((u) => u.id === s.id) || null;
    } catch {
      return null;
    }
  },

  clearSession() {
    localStorage.removeItem('cvht_session');
  },

  /** id thực (bỏ alias demo) */
  realId(userOrId) {
    const id = typeof userOrId === 'string' ? userOrId : userOrId?.id;
    const u = this.get().users.find((x) => x.id === id) || SEED.users.find((x) => x.id === id);
    return u?.aliasOf || id;
  },

  findUser(id) {
    if (!id) return null;
    const data = this.get();
    return data.users.find((u) => u.id === id) || SEED.users.find((u) => u.id === id) || null;
  },

  uid(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  },

  audit(actor, action, entity, entityId, before, after) {
    const entry = {
      id: this.uid('al'),
      actorId: actor.id,
      actorName: actor.name,
      action,
      entity,
      entityId: entityId || '',
      beforeJson: typeof before === 'string' ? before : JSON.stringify(before || ''),
      afterJson: typeof after === 'string' ? after : JSON.stringify(after || ''),
      at: new Date().toISOString(),
    };
    this.update((d) => { d.auditLog.unshift(entry); });
    if (typeof SheetsAPI !== 'undefined' && SheetsAPI.enabled()) {
      SheetsAPI.appendAudit(entry).catch(() => {});
    }
    return entry;
  },

  /** Cập nhật hồ sơ nhân sự + audit / role history nếu đổi primaryRole */
  updateUser(actor, userId, patch, reason = '') {
    let updated = null;
    this.update((d) => {
      const u = d.users.find((x) => x.id === userId);
      if (!u) throw new Error('Không tìm thấy người dùng');
      const before = {
        name: u.name, email: u.email, phone: u.phone || '',
        campus: u.campus, primaryRole: userRole(u), initials: u.initials,
        active: u.active !== false, password: '***',
      };
      const prevRole = userRole(u);

      if (patch.name != null) u.name = patch.name.trim();
      if (patch.email != null) u.email = patch.email.trim().toLowerCase();
      if (patch.phone != null) u.phone = patch.phone.trim();
      if (patch.campus != null) u.campus = patch.campus;
      if (patch.initials != null) u.initials = patch.initials.trim().slice(0, 3).toUpperCase();
      if (patch.active != null) u.active = !!patch.active;
      if (patch.password) u.password = patch.password;
      if (patch.primaryRole != null && patch.primaryRole !== prevRole) {
        d.roleHistory.unshift({
          id: this.uid('rh'),
          userId: u.id,
          userName: u.name,
          fromRole: prevRole,
          toRole: patch.primaryRole,
          classId: null,
          changedById: actor.id,
          changedByName: actor.name,
          reason: reason || 'Đổi vai trò chính',
          at: new Date().toISOString(),
        });
        u.primaryRole = patch.primaryRole;
        u.role = patch.primaryRole;
      }

      const after = {
        name: u.name, email: u.email, phone: u.phone || '',
        campus: u.campus, primaryRole: userRole(u), initials: u.initials,
        active: u.active !== false, password: patch.password ? '(đã đổi)' : '***',
      };
      d.auditLog.unshift({
        id: this.uid('al'),
        actorId: actor.id,
        actorName: actor.name,
        action: 'USER_UPDATE',
        entity: 'User',
        entityId: userId,
        beforeJson: JSON.stringify(before),
        afterJson: JSON.stringify({ ...after, reason }),
        at: new Date().toISOString(),
      });
      updated = u;
    });
    return updated;
  },

  createUser(actor, payload) {
    const id = this.uid('u');
    const name = (payload.name || '').trim();
    const parts = name.split(/\s+/);
    const initials = payload.initials || (parts.length >= 2
      ? (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase()
      : (name.slice(0, 2) || 'U').toUpperCase());
    const nu = {
      id,
      email: (payload.email || '').trim().toLowerCase(),
      password: payload.password || '123456',
      name,
      primaryRole: payload.primaryRole || 'CVHT',
      campus: payload.campus || 'HN',
      initials,
      phone: payload.phone || '',
      active: true,
    };
    this.update((d) => {
      d.users.push(nu);
      d.roleHistory.unshift({
        id: this.uid('rh'),
        userId: id,
        userName: nu.name,
        fromRole: '—',
        toRole: nu.primaryRole,
        classId: null,
        changedById: actor.id,
        changedByName: actor.name,
        reason: 'Tạo nhân sự mới',
        at: new Date().toISOString(),
      });
      d.auditLog.unshift({
        id: this.uid('al'),
        actorId: actor.id,
        actorName: actor.name,
        action: 'USER_CREATE',
        entity: 'User',
        entityId: id,
        beforeJson: '',
        afterJson: JSON.stringify({ name: nu.name, email: nu.email, primaryRole: nu.primaryRole }),
        at: new Date().toISOString(),
      });
    });
    return nu;
  },

  /**
   * Đổi phân công trên lớp + ghi AssignmentHistory + RoleHistory + AuditLog
   */
  changeAssignment(actor, classId, roleKey, newUserId, reason = '') {
    const field = ASSIGN_ROLE_FIELDS[roleKey];
    if (!field) throw new Error('Vai trò không hợp lệ');

    let result = null;
    this.update((d) => {
      const cls = d.classes.find((c) => c.id === classId);
      if (!cls) throw new Error('Không tìm thấy lớp');

      const fromId = cls[field];
      const fromUser = fromId ? (d.users.find((u) => u.id === fromId) || SEED.users.find((u) => u.id === fromId)) : null;
      const toUser = newUserId ? (d.users.find((u) => u.id === newUserId) || SEED.users.find((u) => u.id === newUserId)) : null;

      const before = { [field]: fromId, name: fromUser?.name || '—' };
      cls[field] = newUserId || null;
      const after = { [field]: newUserId, name: toUser?.name || '—' };

      const ah = {
        id: this.uid('ah'),
        classId,
        semester: cls.semester,
        role: roleKey,
        fromUserId: fromId,
        fromUserName: fromUser?.name || '—',
        toUserId: newUserId,
        toUserName: toUser?.name || '—',
        changedById: actor.id,
        changedByName: actor.name,
        reason: reason || 'Cập nhật phân công',
        at: new Date().toISOString(),
      };
      d.assignmentHistory.unshift(ah);

      if (toUser && ['LOP_TRUONG', 'LOP_TRUONG_NN', 'BI_THU'].includes(roleKey)) {
        const prevRole = userRole(toUser);
        if (prevRole !== roleKey) {
          d.roleHistory.unshift({
            id: this.uid('rh'),
            userId: toUser.id,
            userName: toUser.name,
            fromRole: prevRole,
            toRole: roleKey,
            classId,
            changedById: actor.id,
            changedByName: actor.name,
            reason: reason || `Bổ nhiệm ${ASSIGN_ROLE_LABELS[roleKey]}`,
            at: new Date().toISOString(),
          });
          toUser.primaryRole = roleKey;
          if (['LOP_TRUONG', 'LOP_TRUONG_NN', 'BI_THU'].includes(roleKey)) toUser.classId = classId;
        }
      }

      if (fromUser && ['LOP_TRUONG', 'LOP_TRUONG_NN', 'BI_THU'].includes(roleKey) && fromId !== newUserId) {
        d.roleHistory.unshift({
          id: this.uid('rh'),
          userId: fromUser.id,
          userName: fromUser.name,
          fromRole: roleKey,
          toRole: 'SINH_VIEN',
          classId,
          changedById: actor.id,
          changedByName: actor.name,
          reason: reason || `Miễn nhiệm / thay thế ${ASSIGN_ROLE_LABELS[roleKey]}`,
          at: new Date().toISOString(),
        });
      }

      d.auditLog.unshift({
        id: this.uid('al'),
        actorId: actor.id,
        actorName: actor.name,
        action: 'ASSIGNMENT_CHANGE',
        entity: 'Class',
        entityId: classId,
        beforeJson: JSON.stringify(before),
        afterJson: JSON.stringify({ ...after, role: roleKey, reason }),
        at: new Date().toISOString(),
      });

      result = { cls, ah };
    });
    return result;
  },
};

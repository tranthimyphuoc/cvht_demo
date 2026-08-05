/* LocalStorage + Audit + Sheets bridge */
const Store = {
  KEY: 'cvht_hub_v9',

  defaults() {
    return {
      classes: JSON.parse(JSON.stringify(SEED.classes)),
      users: JSON.parse(JSON.stringify(SEED.users)),
      students: JSON.parse(JSON.stringify(SEED.students)),
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

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) {
        const d = this.defaults();
        this.save(d);
        return d;
      }
      return { ...this.defaults(), ...JSON.parse(raw) };
    } catch {
      return this.defaults();
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
    return data;
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

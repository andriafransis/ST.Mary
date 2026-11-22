// src/lib/permissions.js

export const SCREEN_ORDER = [
  'admin_panel',
  'priest_panel',
  'servant_panel',
  'member_panel',
  'parent_panel',
  'approvals',
  'permissions',
  'trips_office',
  'deacons',
  'certs',
  'public_editor',
  'public_page'
];

export const SCREEN_LABELS = {
  admin_panel: '🛠️ لوحة الإدارة',
  priest_panel: '✝ لوحة الأب الكاهن',
  servant_panel: '📖 لوحة الخادم',
  member_panel: '👤 فقرة المخدوم',
  parent_panel: '👨‍👩‍👦 متابعة ولي الأمر',
  approvals: '✅ طلبات الانضمام',
  permissions: '🔐 إدارة الصلاحيات',
  trips_office: '🚌 مكتب الرحلات',
  deacons: '🕯️ جدول الشمامسة',
  certs: '📜 سجل الشهادات',
  public_editor: '✏️ تعديل الصفحة العامة',
  public_page: '🌐 صفحة الكنيسة العامة'
};

export const ROLE_DEFAULT_PERMISSIONS = {
  admin: {
    defaultScreen: 'admin_panel',
    screens: {
      admin_panel: { view: true, create: true, edit: true, delete: true },
      priest_panel: { view: true, create: true, edit: true, delete: true },
      servant_panel: { view: true, create: true, edit: true, delete: true },
      member_panel: { view: true, create: true, edit: true, delete: true },
      parent_panel: { view: true, create: true, edit: true, delete: true },
      approvals: { view: true, create: true, edit: true, delete: true },
      permissions: { view: true, create: true, edit: true, delete: true },
      trips_office: { view: true, create: true, edit: true, delete: true },
      deacons: { view: true, create: true, edit: true, delete: true },
      certs: { view: true, create: true, edit: true, delete: true },
      public_editor: { view: true, create: true, edit: true, delete: true },
      public_page: { view: true, create: false, edit: false, delete: false }
    }
  },
  priest: {
    defaultScreen: 'priest_panel',
    screens: {
      priest_panel: { view: true, create: true, edit: true, delete: true },
      servant_panel: { view: true, create: true, edit: true, delete: false },
      member_panel: { view: true, create: false, edit: false, delete: false },
      approvals: { view: true, create: false, edit: true, delete: false },
      trips_office: { view: true, create: true, edit: true, delete: false },
      deacons: { view: true, create: true, edit: true, delete: false },
      certs: { view: true, create: true, edit: true, delete: false },
      public_editor: { view: true, create: true, edit: true, delete: false },
      public_page: { view: true, create: false, edit: false, delete: false }
    }
  },
  head_servant: {
    defaultScreen: 'servant_panel',
    screens: {
      servant_panel: { view: true, create: true, edit: true, delete: false },
      member_panel: { view: true, create: false, edit: false, delete: false },
      approvals: { view: true, create: false, edit: true, delete: false },
      trips_office: { view: true, create: true, edit: false, delete: false },
      deacons: { view: true, create: false, edit: false, delete: false },
      public_page: { view: true, create: false, edit: false, delete: false }
    }
  },
  vice_head_servant: {
    defaultScreen: 'servant_panel',
    screens: {
      servant_panel: { view: true, create: true, edit: true, delete: false },
      member_panel: { view: true, create: false, edit: false, delete: false },
      trips_office: { view: true, create: true, edit: false, delete: false },
      deacons: { view: true, create: false, edit: false, delete: false },
      public_page: { view: true, create: false, edit: false, delete: false }
    }
  },
  servant: {
    defaultScreen: 'servant_panel',
    screens: {
      servant_panel: { view: true, create: true, edit: true, delete: false },
      member_panel: { view: true, create: false, edit: false, delete: false },
      trips_office: { view: true, create: false, edit: false, delete: false },
      public_page: { view: true, create: false, edit: false, delete: false }
    }
  },
  meeting_servant: {
    defaultScreen: 'servant_panel',
    screens: {
      servant_panel: { view: true, create: true, edit: true, delete: false },
      public_page: { view: true, create: false, edit: false, delete: false }
    }
  },
  mercy_servant: {
    defaultScreen: 'servant_panel',
    screens: {
      servant_panel: { view: true, create: true, edit: true, delete: false },
      public_page: { view: true, create: false, edit: false, delete: false }
    }
  },
  member: {
    defaultScreen: 'member_panel',
    screens: {
      member_panel: { view: true, create: false, edit: false, delete: false },
      trips_office: { view: true, create: false, edit: false, delete: false },
      public_page: { view: true, create: false, edit: false, delete: false }
    }
  },
  parent: {
    defaultScreen: 'parent_panel',
    screens: {
      parent_panel: { view: true, create: true, edit: false, delete: false },
      public_page: { view: true, create: false, edit: false, delete: false }
    }
  },
  worker: {
    defaultScreen: 'public_page',
    screens: {
      public_page: { view: true, create: false, edit: false, delete: false },
      deacons: { view: true, create: false, edit: false, delete: false }
    }
  }
};

export function getDetailedScreenPermissions(user, screenKey, roleScreens = []) {
  const role = user?.role || 'member';
  const roleCfg = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.member;
  const base = roleCfg.screens?.[screenKey] || { view: false, create: false, edit: false, delete: false };

  // 1) تطبيق إعدادات جدول role_screens إن وُجدت للدور والشاشة
  const dbRow = Array.isArray(roleScreens)
    ? roleScreens.find(r => r.role === role && r.screen_key === screenKey)
    : null;

  let perms = {
    view: dbRow ? (dbRow.can_view ?? dbRow.allowed ?? base.view) : base.view,
    create: dbRow ? (dbRow.can_create ?? false) : base.create,
    edit: dbRow ? (dbRow.can_edit ?? false) : base.edit,
    delete: dbRow ? (dbRow.can_delete ?? false) : base.delete
  };

  // 2) لو تم تفعيل وضع "عرض فقط" على الدور أو المستخدم
  if (user?.permissions?.read_only === true) {
    perms = { ...perms, create: false, edit: false, delete: false };
  }

  // 3) تطبيق التخصيص الفردي للشاشة على مستوى المستخدم إن وُجد
  const userScreenOverride = user?.permissions?.screens?.[screenKey];
  if (userScreenOverride && typeof userScreenOverride === 'object') {
    perms = {
      view: userScreenOverride.view !== undefined ? Boolean(userScreenOverride.view) : perms.view,
      create: userScreenOverride.create !== undefined ? Boolean(userScreenOverride.create) : perms.create,
      edit: userScreenOverride.edit !== undefined ? Boolean(userScreenOverride.edit) : perms.edit,
      delete: userScreenOverride.delete !== undefined ? Boolean(userScreenOverride.delete) : perms.delete
    };
  }

  // لو لم يُسمح بالعرض (view = false) فلا يُسمح بالإضافة أو التعديل أو الحذف
  if (!perms.view) {
    return { view: false, create: false, edit: false, delete: false };
  }

  return perms;
}

export function resolveScreens(user, roleScreens = []) {
  const allowed = new Set();
  const detailedByScreen = {};

  if (!user) {
    return { allowed, defaultScreen: '', detailedByScreen };
  }

  const role = user.role || 'member';
  const roleCfg = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.member;

  // أي شاشة مضافة صراحة في role_screens لهذا الدور أو في user.permissions.screens
  const candidateKeys = new Set([
    ...SCREEN_ORDER,
    ...Object.keys(roleCfg.screens || {}),
    ...(Array.isArray(roleScreens) ? roleScreens.filter(r => r.role === role).map(r => r.screen_key) : []),
    ...Object.keys(user?.permissions?.screens || {})
  ]);

  candidateKeys.forEach(scrKey => {
    const p = getDetailedScreenPermissions(user, scrKey, roleScreens);
    detailedByScreen[scrKey] = p;
    if (p.view) {
      allowed.add(scrKey);
    }
  });

  // لو الأدمن حدد شاشات مخصصة صراحة في user.permissions.allowed_screens
  if (Array.isArray(user?.permissions?.allowed_screens)) {
    const customSet = new Set(user.permissions.allowed_screens);
    Array.from(allowed).forEach(k => {
      if (!customSet.has(k) && k !== 'public_page') {
        allowed.delete(k);
        if (detailedByScreen[k]) detailedByScreen[k].view = false;
      }
    });
  }

  const preferredDefault = user?.permissions?.default_screen || roleCfg.defaultScreen;
  const defaultScreen =
    preferredDefault && allowed.has(preferredDefault)
      ? preferredDefault
      : Array.from(allowed)[0] || '';

  return { allowed, defaultScreen, detailedByScreen };
}

export function getScreenAccess(user, screenKey, roleScreens = []) {
  return getDetailedScreenPermissions(user, screenKey, roleScreens);
}
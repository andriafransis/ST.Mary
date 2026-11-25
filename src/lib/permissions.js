// src/lib/permissions.js

export const SCREEN_ORDER = [
  'admin_panel',
  'priest_panel',
  'servant_panel',
  'member_panel',
  'parent_panel',
  'edu_center',
  'joseph_arimathea',
  'approvals',
  'permissions',
  'trips_office',
  'deacons',
  'certs',
  'social_status',
  'public_editor',
  'public_page'
];

export const ALL_SCREENS = [...SCREEN_ORDER];
export const ALL_AVAILABLE_SCREENS = [...SCREEN_ORDER];

export const SCREEN_LABELS = {
  admin_panel: '🛠️ لوحة الإدارة',
  priest_panel: '✝ لوحة الأب الكاهن',
  servant_panel: '📖 لوحة الخادم',
  member_panel: '👤 فقرة المخدوم',
  parent_panel: '👨‍👩‍👦 متابعة ولي الأمر',
  edu_center: '🎓 المركز التعليمي',
  joseph_arimathea: '🕊️ خدمة يوسف الرامي',
  approvals: '✅ طلبات الانضمام',
  permissions: '🔐 إدارة الصلاحيات',
  trips_office: '🚌 مكتب الرحلات',
  deacons: '🕯️ جدول الشمامسة',
  certs: '📜 سجل الشهادات',
  social_status: '👪 الحالة الاجتماعية والعمل',
  public_editor: '✏️ تعديل الصفحة العامة',
  public_page: '🌐 صفحة الكنيسة العامة'
};

export const ROLES = [
  { key: 'admin', label: '🛡️ سوبر أدمن الكنيسة' },
  { key: 'priest', label: '✝ أب كاهن' },
  { key: 'head_servant', label: '⭐ أمين الخدمة' },
  { key: 'vice_head_servant', label: '🌟 مساعد أمين الخدمة' },
  { key: 'servant', label: '📖 خادم مرحلة' },
  { key: 'meeting_servant', label: '🎤 خادم اجتماع' },
  { key: 'mercy_servant', label: '🤝 خادم إخوة رب' },
  { key: 'member', label: '👤 مخدوم (شعب)' },
  { key: 'parent', label: '👨‍👩‍👦 ولي أمر' },
  { key: 'worker', label: '🛠️ عامل / فراش الكنيسة' }
];

const EMPTY_PERM = { view: false, create: false, edit: false, delete: false };

export const ROLE_DEFAULT_PERMISSIONS = {
  admin: {
    defaultScreen: 'admin_panel',
    screens: SCREEN_ORDER.reduce((acc, s) => {
      acc[s] = s === 'public_page'
        ? { view: true, create: false, edit: false, delete: false }
        : { view: true, create: true, edit: true, delete: true };
      return acc;
    }, {})
  },
  priest: {
    defaultScreen: 'priest_panel',
    screens: {
      priest_panel: { view: true, create: true, edit: true, delete: true },
      servant_panel: { view: true, create: true, edit: true, delete: false },
      member_panel: { view: true, create: false, edit: false, delete: false },
      edu_center: { view: true, create: true, edit: true, delete: false },
      joseph_arimathea: { view: true, create: true, edit: true, delete: false },
      approvals: { view: true, create: false, edit: true, delete: false },
      trips_office: { view: true, create: true, edit: true, delete: false },
      deacons: { view: true, create: true, edit: true, delete: false },
      certs: { view: true, create: true, edit: true, delete: false },
      social_status: { view: true, create: false, edit: true, delete: false },
      public_editor: { view: true, create: true, edit: true, delete: false },
      public_page: { view: true, create: false, edit: false, delete: false }
    }
  },
  head_servant: {
    defaultScreen: 'servant_panel',
    screens: {
      servant_panel: { view: true, create: true, edit: true, delete: false },
      member_panel: { view: true, create: false, edit: false, delete: false },
      edu_center: { view: true, create: true, edit: true, delete: false },
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
      edu_center: { view: true, create: true, edit: false, delete: false },
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
      edu_center: { view: true, create: false, edit: false, delete: false },
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
      edu_center: { view: true, create: false, edit: false, delete: false },
      trips_office: { view: true, create: false, edit: false, delete: false },
      public_page: { view: true, create: false, edit: false, delete: false }
    }
  },
  parent: {
    defaultScreen: 'parent_panel',
    screens: {
      parent_panel: { view: true, create: false, edit: false, delete: false },
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

export const DEFAULT_ROLE_SCREENS = Object.entries(ROLE_DEFAULT_PERMISSIONS).reduce(
  (acc, [roleKey, cfg]) => {
    acc[roleKey] = Object.entries(cfg.screens || {}).map(([screen, p]) => ({
      role: roleKey,
      screen,
      is_default: cfg.defaultScreen === screen,
      can_view: Boolean(p.view),
      can_create: Boolean(p.create),
      can_edit: Boolean(p.edit),
      can_delete: Boolean(p.delete)
    }));
    return acc;
  },
  {}
);

export function mergeUserPolicies(user, policies = []) {
  const perms = user?.permissions || {};
  const policyKeys = Array.isArray(perms.policy_keys) && perms.policy_keys.length > 0
    ? perms.policy_keys
    : (perms.template_key ? [perms.template_key] : []);

  const matchedPolicies = policyKeys
    .map((k) => policies.find((p) => p.key === k))
    .filter(Boolean);

  const mergedScreens = {};
  SCREEN_ORDER.forEach((scr) => {
    mergedScreens[scr] = { ...EMPTY_PERM };
  });

  const mergedActions = { ...(perms.actions || {}) };

  matchedPolicies.forEach((tpl) => {
    const tplScreens = Array.isArray(tpl.screens) ? tpl.screens : [];
    tplScreens.forEach((scr) => {
      if (mergedScreens[scr]) {
        mergedScreens[scr].view = true;
      }
    });

    if (tpl.screen_permissions && typeof tpl.screen_permissions === 'object') {
      Object.entries(tpl.screen_permissions).forEach(([scr, sp]) => {
        if (!mergedScreens[scr]) mergedScreens[scr] = { ...EMPTY_PERM };
        const canView = Boolean(sp?.view);
        const canCreate = canView && Boolean(sp?.create ?? sp?.add);
        const canEdit = canView && Boolean(sp?.edit);
        const canDelete = canView && Boolean(sp?.delete);

        mergedScreens[scr] = {
          view: mergedScreens[scr].view || canView,
          create: mergedScreens[scr].create || canCreate,
          edit: mergedScreens[scr].edit || canEdit,
          delete: mergedScreens[scr].delete || canDelete
        };
      });
    }

    if (tpl.actions && typeof tpl.actions === 'object') {
      Object.entries(tpl.actions).forEach(([actKey, actVal]) => {
        if (typeof actVal === 'boolean') {
          mergedActions[actKey] = Boolean(mergedActions[actKey]) || actVal;
        } else if (typeof actVal === 'string' && actVal.trim() !== '') {
          mergedActions[actKey] = actVal;
        }
      });
    }
  });

  return {
    policyKeys,
    matchedPolicies,
    mergedScreens,
    mergedActions
  };
}

export function getDetailedScreenPermissions(user, screenKey, roleScreens = [], policies = []) {
  const role = user?.role || 'member';
  const roleCfg = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.member;
  const base = roleCfg.screens?.[screenKey] || { ...EMPTY_PERM };

  const dbRow = Array.isArray(roleScreens)
    ? roleScreens.find((r) => r.role === role && r.screen === screenKey)
    : null;

  let perms = {
    view: dbRow ? Boolean(dbRow.can_view ?? base.view) : Boolean(base.view),
    create: dbRow ? Boolean(dbRow.can_create ?? base.create) : Boolean(base.create),
    edit: dbRow ? Boolean(dbRow.can_edit ?? base.edit) : Boolean(base.edit),
    delete: dbRow ? Boolean(dbRow.can_delete ?? base.delete) : Boolean(base.delete)
  };

  if (Array.isArray(policies) && policies.length > 0) {
    const { mergedScreens } = mergeUserPolicies(user, policies);
    const polScr = mergedScreens[screenKey];
    if (polScr) {
      perms = {
        view: perms.view || polScr.view,
        create: perms.create || polScr.create,
        edit: perms.edit || polScr.edit,
        delete: perms.delete || polScr.delete
      };
    }
  }

  if (user?.permissions?.read_only === true) {
    perms = { ...perms, create: false, edit: false, delete: false };
  }

  const userScreenOverride =
    user?.permissions?.screens?.[screenKey] ||
    user?.permissions?.screen_permissions?.[screenKey];

  if (userScreenOverride && typeof userScreenOverride === 'object') {
    const nextView = userScreenOverride.view !== undefined ? Boolean(userScreenOverride.view) : perms.view;
    const nextCreate = userScreenOverride.create !== undefined
      ? Boolean(userScreenOverride.create)
      : (userScreenOverride.add !== undefined ? Boolean(userScreenOverride.add) : perms.create);
    const nextEdit = userScreenOverride.edit !== undefined ? Boolean(userScreenOverride.edit) : perms.edit;
    const nextDelete = userScreenOverride.delete !== undefined ? Boolean(userScreenOverride.delete) : perms.delete;

    perms = {
      view: nextView,
      create: nextView && nextCreate,
      edit: nextView && nextEdit,
      delete: nextView && nextDelete
    };
  }

  if (!perms.view) {
    return { ...EMPTY_PERM };
  }

  return perms;
}

export function resolveScreens(user, roleScreens = [], policies = []) {
  const allowed = new Set();
  const detailedByScreen = {};

  if (!user) {
    return { allowed, defaultScreen: '', detailedByScreen };
  }

  const role = user.role || 'member';
  const roleCfg = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.member;
  const roleDbRows = Array.isArray(roleScreens) ? roleScreens.filter((r) => r.role === role) : [];

  const candidateKeys = new Set([
    ...SCREEN_ORDER,
    ...Object.keys(roleCfg.screens || {}),
    ...roleDbRows.map((r) => r.screen).filter(Boolean),
    ...Object.keys(user?.permissions?.screens || {}),
    ...Object.keys(user?.permissions?.screen_permissions || {})
  ]);

  candidateKeys.forEach((scrKey) => {
    const p = getDetailedScreenPermissions(user, scrKey, roleScreens, policies);
    detailedByScreen[scrKey] = p;
    if (p.view) {
      allowed.add(scrKey);
    }
  });

  const dbDefaultRow = roleDbRows.find((r) => r.is_default === true && allowed.has(r.screen));
  const preferredDefault =
    user?.permissions?.default_screen ||
    dbDefaultRow?.screen ||
    roleCfg.defaultScreen;

  const defaultScreen =
    preferredDefault && allowed.has(preferredDefault)
      ? preferredDefault
      : Array.from(allowed)[0] || '';

  return { allowed, defaultScreen, detailedByScreen };
}

export function getScreenAccess(user, screenKey, roleScreens = [], policies = []) {
  return getDetailedScreenPermissions(user, screenKey, roleScreens, policies);
}
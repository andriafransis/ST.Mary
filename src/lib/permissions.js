// src/lib/permissions.js

export const SCREEN_ORDER = [
  'admin_panel',
  'priest_panel',
  'servant_panel',
  'member_panel',
  'parent_panel',
  'edu_center',
  'joseph_arimathea',
  'hidden_families',
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
  hidden_families: '🕊️ خدمة الأسر المستترة',
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

// الفئات الرئيسية الموحدة لتسهيل الاختيار دفعة واحدة (Select All للفئة)
export const CATEGORY_PRESETS = {
  member: {
    key: 'member',
    label: '👤 المخدوم / الشعب (عرض فقط)',
    baseRole: 'member',
    defaultScreen: 'member_panel',
    screens: ['public_page', 'member_panel', 'edu_center', 'trips_office', 'deacons'],
    actions: { view: true, create: false, edit: false, delete: false, send_invitations: false, scan_invitations: false }
  },
  parent: {
    key: 'parent',
    label: '👨‍👩‍👦 ولي الأمر (عرض ومتابعة أوسع)',
    baseRole: 'parent',
    defaultScreen: 'parent_panel',
    screens: ['public_page', 'parent_panel', 'member_panel', 'edu_center', 'trips_office', 'deacons'],
    actions: { view: true, create: false, edit: false, delete: false, send_invitations: false, scan_invitations: false }
  },
  servant: {
    key: 'servant',
    label: '📖 الخدام (يشوف ويكتب/يعدّل — بدون حذف)',
    baseRole: 'servant',
    defaultScreen: 'servant_panel',
    screens: [
      'servant_panel',
      'member_panel',
      'parent_panel',
      'edu_center',
      'trips_office',
      'deacons',
      'certs',
      'social_status',
      'public_page'
    ],
    actions: { view: true, create: true, edit: true, delete: false, send_invitations: false, scan_invitations: false }
  },
  head_servant: {
    key: 'head_servant',
    label: '⭐ أمين الخدمة (كل شيء ما عدا صلاحيات الأدمن)',
    baseRole: 'head_servant',
    defaultScreen: 'servant_panel',
    screens: [
      'servant_panel',
      'member_panel',
      'parent_panel',
      'edu_center',
      'joseph_arimathea',
      'hidden_families',
      'approvals',
      'trips_office',
      'deacons',
      'certs',
      'social_status',
      'public_editor',
      'public_page'
    ],
    actions: { view: true, create: true, edit: true, delete: true, send_invitations: true, scan_invitations: true }
  },
  priest: {
    key: 'priest',
    label: '✝ الأب الكاهن (يشوف ويعمل ويعمل إيديت)',
    baseRole: 'priest',
    defaultScreen: 'priest_panel',
    screens: [
      'priest_panel',
      'servant_panel',
      'member_panel',
      'parent_panel',
      'edu_center',
      'joseph_arimathea',
      'hidden_families',
      'approvals',
      'trips_office',
      'deacons',
      'certs',
      'social_status',
      'public_editor',
      'public_page'
    ],
    actions: { view: true, create: true, edit: true, delete: false, send_invitations: true, scan_invitations: true }
  },
  admin: {
    key: 'admin',
    label: '🛡️ السوبر أدمن (يشوف ويعمل كل حاجة)',
    baseRole: 'admin',
    defaultScreen: 'admin_panel',
    screens: SCREEN_ORDER,
    actions: { view: true, create: true, edit: true, delete: true, send_invitations: true, scan_invitations: true }
  }
};

const EMPTY_PERM = { view: false, create: false, edit: false, delete: false };

function buildPresetScreens(
  screens = [],
  { view = true, create = false, edit = false, delete: del = false },
  excludePublicEdit = false
) {
  const map = {};
  SCREEN_ORDER.forEach((scr) => {
    const isAllowed = screens.includes(scr);
    if (!isAllowed) {
      map[scr] = { ...EMPTY_PERM };
      return;
    }
    if (scr === 'public_page') {
      map[scr] = { view: true, create: false, edit: false, delete: false };
      return;
    }
    if (excludePublicEdit && (scr === 'admin_panel' || scr === 'permissions')) {
      map[scr] = { ...EMPTY_PERM };
      return;
    }
    map[scr] = {
      view: Boolean(view),
      create: Boolean(view && create),
      edit: Boolean(view && edit),
      delete: Boolean(view && del)
    };
  });
  return map;
}

export const ROLE_DEFAULT_PERMISSIONS = {
  admin: {
    defaultScreen: CATEGORY_PRESETS.admin.defaultScreen,
    screens: buildPresetScreens(CATEGORY_PRESETS.admin.screens, CATEGORY_PRESETS.admin.actions)
  },
  priest: {
    defaultScreen: CATEGORY_PRESETS.priest.defaultScreen,
    screens: buildPresetScreens(CATEGORY_PRESETS.priest.screens, CATEGORY_PRESETS.priest.actions, true)
  },
  head_servant: {
    defaultScreen: CATEGORY_PRESETS.head_servant.defaultScreen,
    screens: buildPresetScreens(CATEGORY_PRESETS.head_servant.screens, CATEGORY_PRESETS.head_servant.actions, true)
  },
  vice_head_servant: {
    defaultScreen: 'servant_panel',
    screens: buildPresetScreens(CATEGORY_PRESETS.servant.screens, { view: true, create: true, edit: true, delete: false })
  },
  servant: {
    defaultScreen: CATEGORY_PRESETS.servant.defaultScreen,
    screens: buildPresetScreens(CATEGORY_PRESETS.servant.screens, CATEGORY_PRESETS.servant.actions)
  },
  meeting_servant: {
    defaultScreen: 'servant_panel',
    screens: buildPresetScreens(['servant_panel', 'member_panel', 'edu_center', 'public_page'], { view: true, create: true, edit: true, delete: false })
  },
  mercy_servant: {
    defaultScreen: 'servant_panel',
    screens: buildPresetScreens(['servant_panel', 'member_panel', 'hidden_families', 'joseph_arimathea', 'public_page'], { view: true, create: true, edit: true, delete: false })
  },
  member: {
    defaultScreen: CATEGORY_PRESETS.member.defaultScreen,
    screens: buildPresetScreens(CATEGORY_PRESETS.member.screens, CATEGORY_PRESETS.member.actions)
  },
  parent: {
    defaultScreen: CATEGORY_PRESETS.parent.defaultScreen,
    screens: buildPresetScreens(CATEGORY_PRESETS.parent.screens, CATEGORY_PRESETS.parent.actions)
  },
  worker: {
    defaultScreen: 'public_page',
    screens: buildPresetScreens(['public_page', 'deacons', 'trips_office'], { view: true, create: false, edit: false, delete: false })
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

// صلاحية إرسال الدعوات: للأدمن، أو الكاهن، أو أمين الخدمة، أو أي خادم/مستخدم مُفعّل له الصلاحية
export function canSendChurchInvitations(user, policies = []) {
  if (!user) return false;
  if (user.permissions?.read_only === true) return false;
  if (user.role === 'admin' || user.role === 'priest' || user.role === 'head_servant') {
    return true;
  }

  const perms = user.permissions || {};
  if (
    perms.can_send_invitations === true ||
    perms.actions?.send_invitations === true ||
    user.can_send_invitations === true
  ) {
    return true;
  }

  if (Array.isArray(policies) && policies.length > 0) {
    const { mergedActions } = mergeUserPolicies(user, policies);
    if (mergedActions.send_invitations === true || mergedActions.can_send_invitations === true) {
      return true;
    }
  }

  return false;
}

// صلاحية مسح QR الدعوات: للأدمن، الكاهن، أمين الخدمة، خادم الاجتماع، أو من تم تفعيل الصلاحية له
export function canScanChurchInvitations(user, policies = []) {
  if (!user) return false;
  if (user.permissions?.read_only === true) return false;
  if (
    user.role === 'admin' ||
    user.role === 'priest' ||
    user.role === 'head_servant' ||
    user.role === 'meeting_servant'
  ) {
    return true;
  }

  const perms = user.permissions || {};
  if (
    perms.can_scan_invitations === true ||
    perms.actions?.scan_invitations === true ||
    user.can_scan_invitations === true
  ) {
    return true;
  }

  if (Array.isArray(policies) && policies.length > 0) {
    const { mergedActions } = mergeUserPolicies(user, policies);
    if (mergedActions.scan_invitations === true || mergedActions.can_scan_invitations === true) {
      return true;
    }
  }

  return false;
}

export function canManageChurchInvitations(user, policies = []) {
  return canSendChurchInvitations(user, policies) || canScanChurchInvitations(user, policies);
}

export function canViewChurchInvitations(user, policies = []) {
  return Boolean(user);
}
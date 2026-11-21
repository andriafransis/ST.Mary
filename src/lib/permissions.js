export const SCREEN_ORDER = [
  'admin_panel', 'priest_panel', 'servant_panel', 'member_panel', 'parent_panel',
  'trips_office', 'approvals', 'deacons', 'certs', 'public_page', 'permissions'
];

export const SCREEN_LABELS = {
  admin_panel: 'لوحة الإدارة',
  priest_panel: 'شاشة الكاهن',
  servant_panel: 'شاشة الخادم',
  member_panel: 'شاشة المخدوم',
  parent_panel: 'شاشة ولي الأمر',
  trips_office: 'مكتب الرحلات العامة',
  approvals: 'طلبات الانضمام',
  deacons: 'جدول الشمامسة',
  certs: 'الشهادات والأسرار',
  public_page: 'صفحة الكنيسة',
  public_editor: 'تعديل صفحة الكنيسة',
  permissions: 'الصلاحيات'
};

export const ALL_SCREENS = [...SCREEN_ORDER, 'public_editor'];

export const ALL_AVAILABLE_SCREENS = [
  { id: 'public_page', label: '1) 🌐 صفحة الكنيسة العامة' },
  { id: 'member_panel', label: '2) 👤 شاشة المخدوم / الشعب' },
  { id: 'parent_panel', label: '3) 👨‍👩‍👦 شاشة ولي الأمر' },
  { id: 'servant_panel', label: '4) 📖 شاشة الخادم' },
  { id: 'priest_panel', label: '5) ✝ شاشة الأب الكاهن' },
  { id: 'edu_center', label: '6) 🎓 المركز التعليمي' },
  { id: 'joseph_arimathea', label: '7) 🕊️ خدمة يوسف الرامي' },
  { id: 'trips_office', label: '8) 🚌 مكتب الرحلات العامة' },
  { id: 'deacons', label: '9) 🕯️ جدول الشمامسة' },
  { id: 'certs', label: '10) 📜 الشهادات والأسرار' },
  { id: 'approvals', label: '11) ✅ طلبات الانضمام' },
  { id: 'public_editor', label: '12) ✏️ تعديل صفحة الكنيسة' },
  { id: 'permissions', label: '13) 🔐 شاشة الصلاحيات' },
  { id: 'admin_panel', label: '14) 🛡️ لوحة الإدارة' }
];

export const ROLES = [
  { key: 'admin', label: '🛡️ سوبر أدمن' },
  { key: 'priest', label: '✝ أب كاهن' },
  { key: 'head_servant', label: '⭐ أمين الخدمة' },
  { key: 'vice_head_servant', label: '🌟 مساعد أمين الخدمة' },
  { key: 'servant', label: '📖 خادم مرحلة' },
  { key: 'meeting_servant', label: '🎤 خادم اجتماع' },
  { key: 'mercy_servant', label: '🤝 خادم إخوة رب' },
  { key: 'member', label: '👤 مخدوم' },
  { key: 'parent', label: '👨‍👩‍👦 ولي أمر' },
  { key: 'worker', label: '🛠️ عامل' }
];

export const DEFAULT_ROLE_SCREENS = {
  admin: { screens: ALL_SCREENS, def: 'admin_panel' },
  priest: { screens: ['priest_panel', 'trips_office', 'approvals', 'public_page', 'public_editor', 'deacons', 'certs'], def: 'priest_panel' },
  head_servant: { screens: ['admin_panel', 'trips_office', 'approvals', 'public_page'], def: 'admin_panel' },
  vice_head_servant: { screens: ['admin_panel', 'approvals', 'public_page'], def: 'admin_panel' },
  servant: { screens: ['servant_panel', 'public_page'], def: 'servant_panel' },
  meeting_servant: { screens: ['servant_panel', 'public_page'], def: 'servant_panel' },
  mercy_servant: { screens: ['servant_panel', 'public_page'], def: 'servant_panel' },
  member: { screens: ['member_panel', 'public_page'], def: 'member_panel' },
  worker: { screens: ['member_panel', 'public_page'], def: 'member_panel' },
  parent: { screens: ['parent_panel', 'public_page'], def: 'parent_panel' }
};

const LEGACY_FLAGS = {
  view_priest_panel: 'priest_panel',
  view_servant_panel: 'servant_panel',
  view_member_panel: 'member_panel',
  view_parent_panel: 'parent_panel',
  view_deacons: 'deacons',
  view_certs: 'certs'
};

export function resolveScreens(user, roleScreensRows = []) {
  const allowed = new Set();
  let def = null;

  if (!user) return { allowed, defaultScreen: null };

  if (user.role === 'admin') {
    ALL_SCREENS.forEach(k => allowed.add(k));
    def = 'admin_panel';
  } else {
    const rows = roleScreensRows.filter(r => r.role === user.role);
    if (rows.length > 0) {
      rows.forEach(r => {
        allowed.add(r.screen);
        if (r.is_default) def = r.screen;
      });
    } else if (DEFAULT_ROLE_SCREENS[user.role]) {
      DEFAULT_ROLE_SCREENS[user.role].screens.forEach(k => allowed.add(k));
      def = DEFAULT_ROLE_SCREENS[user.role].def;
    }
  }

  const p = user.permissions || {};
  (p.extra_screens || []).forEach(k => allowed.add(k));
  Object.entries(LEGACY_FLAGS).forEach(([flag, screen]) => {
    if (p[flag] === true) allowed.add(screen);
    if (p[flag] === false && user.role !== 'admin') allowed.delete(screen);
  });
  if (user.is_deacon && p.view_deacons !== false) allowed.add('deacons');

  if (p.screen_permissions && typeof p.screen_permissions === 'object' && Object.keys(p.screen_permissions).length > 0) {
    Object.entries(p.screen_permissions).forEach(([scr, sp]) => {
      if (sp?.view === true) allowed.add(scr);
      else if (sp?.view === false && user.role !== 'admin') allowed.delete(scr);
    });
  }

  if (user.role !== 'admin') (p.denied_screens || []).forEach(k => allowed.delete(k));

  if (p.default_screen && allowed.has(p.default_screen)) def = p.default_screen;
  if (!def || !allowed.has(def)) def = SCREEN_ORDER.find(k => allowed.has(k)) || null;

  return { allowed, defaultScreen: def };
}

export function getScreenAccess(user, screenId, roleScreensRows = []) {
  if (!user) return { view: false, add: false, edit: false, delete: false };
  if (user.role === 'admin') return { view: true, add: true, edit: true, delete: true };

  const p = user.permissions || {};
  const sp = p.screen_permissions?.[screenId];
  const { allowed } = resolveScreens(user, roleScreensRows);

  if (sp && typeof sp === 'object') {
    const canView = Boolean(sp.view) && !(p.denied_screens || []).includes(screenId);
    return {
      view: canView,
      add: canView && Boolean(sp.add),
      edit: canView && Boolean(sp.edit),
      delete: canView && Boolean(sp.delete)
    };
  }

  const canView = allowed.has(screenId);
  return {
    view: canView,
    add: canView && Boolean(p.can_add),
    edit: canView && Boolean(p.can_edit_members),
    delete: canView && Boolean(p.can_delete)
  };
}
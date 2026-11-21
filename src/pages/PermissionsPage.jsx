import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  ALL_SCREENS, ALL_AVAILABLE_SCREENS, SCREEN_LABELS, ROLES, DEFAULT_ROLE_SCREENS, resolveScreens
} from '../lib/permissions';
import { Shield, Save, Users, Layers, Lock, Search, Edit3, Trash2, Copy, CheckCircle2, ShieldCheck } from 'lucide-react';

const ROLE_LABELS = {
  admin: 'سوبر أدمن',
  priest: 'أب كاهن',
  head_servant: 'أمين الخدمة',
  vice_head_servant: 'مساعد أمين الخدمة',
  servant: 'خادم مرحلة',
  meeting_servant: 'خادم اجتماع',
  mercy_servant: 'خادم إخوة رب',
  member: 'مخدوم (رعية)',
  parent: 'ولي أمر',
  worker: 'عامل / فراش كنيسة'
};

export const DEFAULT_ROLE_TEMPLATES = [
  {
    key: 'tpl_parent',
    label: 'ولي الأمر (أب / أم — عرض فقط View Only)',
    base_role: 'parent',
    screens: ['parent_panel', 'public_page'],
    actions: {
      can_view: true, can_add: false, can_edit_members: false, can_delete: false,
      view_parent_panel: true, manage_edu_center: false, manage_trips: false,
      manage_joseph: false, joseph_role: '', joseph_can_edit: false, can_edit_public: false,
      edu_view_schedule: false, edu_view_students_attendance: false, edu_view_prices: false,
      edu_view_teachers_attendance: false, edu_view_revenue: false, edu_edit: false
    },
    screen_permissions: {
      parent_panel: { view: true, add: false, edit: false, delete: false },
      public_page: { view: true, add: false, edit: false, delete: false }
    }
  },
  {
    key: 'tpl_parish',
    label: 'الشعب (رعية / أولياء أمور)',
    base_role: 'parent',
    screens: ['public_page', 'member_panel', 'parent_panel', 'edu_center'],
    actions: {
      can_view: true, can_add: false, can_edit_members: false, can_delete: false,
      view_parent_panel: true, manage_edu_center: false, manage_trips: false,
      manage_joseph: false, joseph_role: '', joseph_can_edit: false, can_edit_public: false,
      edu_view_schedule: true, edu_view_students_attendance: false, edu_view_prices: false,
      edu_view_teachers_attendance: false, edu_view_revenue: false, edu_edit: false
    }
  },
  {
    key: 'tpl_member',
    label: 'المخدوم',
    base_role: 'member',
    screens: ['public_page', 'member_panel', 'edu_center', 'trips_office'],
    actions: {
      can_view: true, can_add: false, can_edit_members: false, can_delete: false,
      manage_edu_center: false, manage_trips: false, manage_joseph: false,
      joseph_role: '', joseph_can_edit: false, can_edit_public: false,
      edu_view_schedule: true, edu_view_students_attendance: false, edu_view_prices: false,
      edu_view_teachers_attendance: false, edu_view_revenue: false, edu_edit: false
    }
  },
  {
    key: 'tpl_priest',
    label: 'الأب الكاهن',
    base_role: 'priest',
    screens: ['priest_panel', 'public_page', 'public_editor', 'edu_center', 'joseph_arimathea', 'trips_office', 'deacons', 'certs', 'approvals'],
    actions: {
      can_view: true, can_add: true, can_edit_members: true, can_delete: true,
      manage_edu_center: true, manage_trips: true, manage_joseph: true,
      joseph_role: 'committee', joseph_can_edit: true,
      view_cases: true, view_deacons: true, can_edit_public: true,
      edu_view_schedule: true, edu_view_students_attendance: true, edu_view_prices: true,
      edu_view_teachers_attendance: true, edu_view_revenue: true, edu_edit: true
    }
  },
  {
    key: 'tpl_servant',
    label: 'الخادم',
    base_role: 'servant',
    screens: ['servant_panel', 'public_page', 'edu_center', 'deacons'],
    actions: {
      can_view: true, can_add: true, can_edit_members: true, can_delete: false,
      manage_edu_center: false, manage_trips: false, manage_joseph: false,
      joseph_role: '', joseph_can_edit: false, can_edit_public: false,
      edu_view_schedule: true, edu_view_students_attendance: true, edu_view_prices: false,
      edu_view_teachers_attendance: false, edu_view_revenue: false, edu_edit: false
    }
  },
  {
    key: 'tpl_edu_observer',
    label: 'مراقب المركز التعليمي (جدول الدروس وحضور الطلاب فقط - بدون أسعار أو إيراد)',
    base_role: 'member',
    screens: ['member_panel', 'public_page', 'edu_center'],
    actions: {
      can_view: true, can_add: false, can_edit_members: false, can_delete: false,
      manage_edu_center: false, is_edu_teacher: false, manage_joseph: false,
      edu_view_schedule: true, edu_view_students_attendance: true, edu_view_prices: false,
      edu_view_teachers_attendance: false, edu_view_revenue: false, edu_edit: false
    }
  },
  {
    key: 'tpl_joseph_driver',
    label: 'سواق خدمة يوسف الرامي',
    base_role: 'worker',
    screens: ['member_panel', 'public_page', 'joseph_arimathea'],
    actions: {
      can_view: true, can_add: false, can_edit_members: false, can_delete: false,
      manage_joseph: true, joseph_role: 'driver', joseph_can_edit: false,
      manage_edu_center: false, manage_trips: false
    }
  },
  {
    key: 'tpl_joseph_worker',
    label: 'فراش / مرافق خدمة يوسف الرامي',
    base_role: 'worker',
    screens: ['member_panel', 'public_page', 'joseph_arimathea'],
    actions: {
      can_view: true, can_add: false, can_edit_members: false, can_delete: false,
      manage_joseph: true, joseph_role: 'worker', joseph_can_edit: false,
      manage_edu_center: false, manage_trips: false
    }
  },
  {
    key: 'tpl_joseph',
    label: 'مسؤول لجنة يوسف الرامي (كامل الصلاحية)',
    base_role: 'member',
    screens: ['member_panel', 'public_page', 'joseph_arimathea'],
    actions: {
      can_view: true, can_add: true, can_edit_members: true, can_delete: false,
      manage_joseph: true, joseph_role: 'committee', joseph_can_edit: true,
      manage_edu_center: false, manage_trips: false
    }
  },
  {
    key: 'tpl_teacher',
    label: 'مدرس / مسؤول المركز التعليمي (كامل)',
    base_role: 'member',
    screens: ['member_panel', 'public_page', 'edu_center'],
    actions: {
      can_view: true, can_add: true, can_edit_members: true, can_delete: false,
      manage_edu_center: true, is_edu_teacher: true, manage_joseph: false,
      edu_view_schedule: true, edu_view_students_attendance: true, edu_view_prices: true,
      edu_view_teachers_attendance: true, edu_view_revenue: true, edu_edit: true
    }
  }
];

export const buildScreenPermissionsMap = (screens = [], actions = {}, existingMap = {}) => {
  const map = { ...(existingMap || {}) };
  ALL_AVAILABLE_SCREENS.forEach(scr => {
    const hasExplicit = Object.prototype.hasOwnProperty.call(map, scr.id);
    const isVisible = hasExplicit ? Boolean(map[scr.id]?.view) : screens.includes(scr.id);
    map[scr.id] = {
      view: isVisible,
      add: isVisible ? (map[scr.id]?.add ?? Boolean(actions.can_add)) : false,
      edit: isVisible ? (map[scr.id]?.edit ?? Boolean(actions.can_edit_members)) : false,
      delete: isVisible ? (map[scr.id]?.delete ?? Boolean(actions.can_delete)) : false
    };
  });
  return map;
};

export const extractAllowedScreensFromMap = (screenPermMap = {}) =>
  ALL_AVAILABLE_SCREENS
    .filter(scr => Boolean(screenPermMap?.[scr.id]?.view))
    .map(scr => scr.id);

const EMPTY_TPL_FORM = {
  id: null,
  key: '',
  label: '',
  base_role: 'member',
  screens: ['public_page', 'member_panel'],
  screen_permissions: buildScreenPermissionsMap(['public_page', 'member_panel'], { can_view: true }),
  actions: {
    can_view: true,
    can_add: false,
    can_edit_members: false,
    can_delete: false,
    manage_edu_center: false,
    is_edu_teacher: false,
    edu_view_schedule: true,
    edu_view_students_attendance: false,
    edu_view_prices: false,
    edu_view_teachers_attendance: false,
    edu_view_revenue: false,
    edu_edit: false,
    manage_trips: false,
    manage_joseph: false,
    joseph_role: '',
    joseph_can_edit: false,
    view_cases: false,
    view_deacons: false,
    view_parent_panel: false,
    can_edit_public: false
  }
};

export default function PermissionsPage({
  users = [],
  roleScreens = [],
  currentUser = null,
  initialUserId = null,
  initialTab = 'users',
  onRefresh
}) {
  const isAdmin = currentUser?.role === 'admin';

  const [tab, setTab] = useState(initialTab);
  const [saving, setSaving] = useState(false);

  const [selectedRole, setSelectedRole] = useState('priest');
  const [roleAllowed, setRoleAllowed] = useState(new Set());
  const [roleDefault, setRoleDefault] = useState('');

  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);

  const [roleTemplates, setRoleTemplates] = useState(() =>
    DEFAULT_ROLE_TEMPLATES.map(t => ({
      ...t,
      screen_permissions: buildScreenPermissionsMap(t.screens, t.actions, t.screen_permissions)
    }))
  );
  const [newTplForm, setNewTplForm] = useState(EMPTY_TPL_FORM);
  const [syncUsersOnTplSave, setSyncUsersOnTplSave] = useState(false);

  const [bulkTemplateKey, setBulkTemplateKey] = useState('tpl_parent');
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkRoleFilter, setBulkRoleFilter] = useState('all');
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]);

  const requireAdminGuard = () => {
    if (!isAdmin) {
      alert('🔒 غير مسموح! تعديل الصلاحيات متاح للسوبر أدمن فقط.');
      return false;
    }
    return true;
  };

  const loadRoleTemplates = async () => {
    const { data } = await supabase
      .from('church_public_content')
      .select('*')
      .eq('kind', 'role_template')
      .order('created_at', { ascending: true });

    const mergedMap = new Map();
    DEFAULT_ROLE_TEMPLATES.forEach(t => {
      mergedMap.set(t.key, {
        ...t,
        screen_permissions: buildScreenPermissionsMap(t.screens, t.actions, t.screen_permissions)
      });
    });

    if (data && data.length > 0) {
      data.forEach(row => {
        try {
          const obj = JSON.parse(row.body || '{}');
          const screens = Array.isArray(obj.screens) ? obj.screens : [];
          const actions = obj.actions || {};
          mergedMap.set(row.title, {
            dbId: row.id,
            key: row.title,
            ...obj,
            screens,
            actions,
            screen_permissions: buildScreenPermissionsMap(screens, actions, obj.screen_permissions)
          });
        } catch {
          // ignore
        }
      });
    }
    setRoleTemplates(Array.from(mergedMap.values()));
  };

  useEffect(() => {
    loadRoleTemplates();
  }, []);

  useEffect(() => {
    const rows = roleScreens.filter(r => r.role === selectedRole);
    if (rows.length > 0) {
      setRoleAllowed(new Set(rows.map(r => r.screen)));
      setRoleDefault(rows.find(r => r.is_default)?.screen || rows[0].screen);
    } else if (DEFAULT_ROLE_SCREENS[selectedRole]) {
      setRoleAllowed(new Set(DEFAULT_ROLE_SCREENS[selectedRole].screens));
      setRoleDefault(DEFAULT_ROLE_SCREENS[selectedRole].def);
    } else {
      setRoleAllowed(new Set());
      setRoleDefault('');
    }
  }, [selectedRole, roleScreens]);

  const selectUserForEdit = (u) => {
    if (!u) return;
    const rawPerms = u.permissions || {};
    const effectiveSet = resolveScreens(u, roleScreens).allowed;
    const baseScreens = Array.from(effectiveSet);
    const normalizedMap = buildScreenPermissionsMap(baseScreens, rawPerms, rawPerms.screen_permissions);

    setSelectedUser({
      ...u,
      permissions: {
        custom_role_label: '',
        template_key: '',
        default_screen: '',
        can_view: true,
        can_add: false,
        can_edit_members: false,
        can_delete: false,
        view_parent_panel: false,
        manage_edu_center: false,
        is_edu_teacher: false,
        edu_view_schedule: true,
        edu_view_students_attendance: Boolean(rawPerms.manage_edu_center),
        edu_view_prices: Boolean(rawPerms.manage_edu_center),
        edu_view_teachers_attendance: Boolean(rawPerms.manage_edu_center),
        edu_view_revenue: Boolean(rawPerms.manage_edu_center),
        edu_edit: Boolean(rawPerms.manage_edu_center),
        manage_trips: false,
        manage_joseph: false,
        joseph_role: '',
        joseph_can_edit: false,
        view_cases: false,
        view_deacons: false,
        can_edit_public: false,
        ...rawPerms,
        screen_permissions: normalizedMap,
        allowed_screens: extractAllowedScreensFromMap(normalizedMap),
        extra_screens: extractAllowedScreensFromMap(normalizedMap),
        denied_screens: Array.isArray(rawPerms.denied_screens) ? rawPerms.denied_screens : []
      }
    });
  };

  useEffect(() => {
    if (initialUserId && users.length > 0) {
      const target = users.find(u => u.id === initialUserId);
      if (target) {
        setTab('users');
        selectUserForEdit(target);
      }
    }
  }, [initialUserId, users.length]);

  const toggleRoleScreen = (scr) => {
    if (!requireAdminGuard()) return;
    const next = new Set(roleAllowed);
    if (next.has(scr)) next.delete(scr);
    else next.add(scr);
    setRoleAllowed(next);
    if (!next.has(roleDefault)) {
      setRoleDefault(Array.from(next)[0] || '');
    }
  };

  const saveRoleScreens = async () => {
    if (!requireAdminGuard()) return;
    setSaving(true);
    try {
      await supabase.from('role_screens').delete().eq('role', selectedRole);
      const rows = Array.from(roleAllowed).map(scr => ({
        role: selectedRole,
        screen: scr,
        is_default: scr === roleDefault
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from('role_screens').insert(rows);
        if (error) return alert('خطأ في الحفظ: ' + error.message);
      }
      if (onRefresh) await onRefresh();
      alert('تم حفظ صلاحيات الدور بنجاح ✅');
    } finally {
      setSaving(false);
    }
  };

  const toggleUserScreenAction = (screenId, actionKey, checked) => {
    if (!isAdmin || !selectedUser) return;
    const currentMap = { ...(selectedUser.permissions?.screen_permissions || {}) };
    const prevScr = currentMap[screenId] || { view: false, add: false, edit: false, delete: false };
    const nextScr = { ...prevScr, [actionKey]: checked };

    if (actionKey !== 'view' && checked) nextScr.view = true;
    if (actionKey === 'view' && !checked) {
      nextScr.add = false;
      nextScr.edit = false;
      nextScr.delete = false;
    }

    currentMap[screenId] = nextScr;
    const allowed = extractAllowedScreensFromMap(currentMap);
    const denied = ALL_AVAILABLE_SCREENS
      .filter(s => currentMap[s.id]?.view === false)
      .map(s => s.id);

    setSelectedUser({
      ...selectedUser,
      permissions: {
        ...selectedUser.permissions,
        screen_permissions: currentMap,
        allowed_screens: allowed,
        extra_screens: allowed,
        denied_screens: denied
      }
    });
  };

  const applyTemplateToSelectedUser = (tpl) => {
    if (!isAdmin || !selectedUser) return;
    const scrMap = buildScreenPermissionsMap(tpl.screens || [], tpl.actions || {}, tpl.screen_permissions);
    const allowed = extractAllowedScreensFromMap(scrMap);
    const denied = ALL_AVAILABLE_SCREENS.filter(s => !scrMap[s.id]?.view).map(s => s.id);
    const nextPerms = {
      ...(selectedUser.permissions || {}),
      ...tpl.actions,
      template_key: tpl.key,
      custom_role_label: tpl.label,
      allowed_screens: allowed,
      extra_screens: allowed,
      denied_screens: denied,
      screen_permissions: scrMap
    };
    setSelectedUser({
      ...selectedUser,
      role: selectedUser.role === 'admin' ? 'admin' : (tpl.base_role || selectedUser.role),
      permissions: nextPerms
    });
  };

  const handleSaveUserPermissions = async () => {
    if (!requireAdminGuard() || !selectedUser) return;
    setSaving(true);
    try {
      const normalizedScreens = extractAllowedScreensFromMap(selectedUser.permissions.screen_permissions);
      const denied = ALL_AVAILABLE_SCREENS
        .filter(s => selectedUser.permissions.screen_permissions?.[s.id]?.view === false)
        .map(s => s.id);

      const finalPerms = {
        ...selectedUser.permissions,
        allowed_screens: normalizedScreens,
        extra_screens: normalizedScreens,
        denied_screens: denied
      };

      const { error } = await supabase
        .from('church_users')
        .update({
          ...(selectedUser.role !== 'admin' ? { role: selectedUser.role } : {}),
          permissions: finalPerms
        })
        .eq('id', selectedUser.id);

      if (error) return alert('خطأ في الحفظ: ' + error.message);

      setSelectedUser(prev => prev ? { ...prev, permissions: finalPerms } : null);
      if (onRefresh) await onRefresh();
      alert(`تم حفظ صلاحيات (${selectedUser.full_name}) بنجاح ✅`);
    } finally {
      setSaving(false);
    }
  };

  const toggleTplScreenAction = (screenId, actionKey, checked) => {
    if (!isAdmin) return;
    const currentMap = { ...(newTplForm.screen_permissions || {}) };
    const prevScr = currentMap[screenId] || { view: false, add: false, edit: false, delete: false };
    const nextScr = { ...prevScr, [actionKey]: checked };

    if (actionKey !== 'view' && checked) nextScr.view = true;
    if (actionKey === 'view' && !checked) {
      nextScr.add = false;
      nextScr.edit = false;
      nextScr.delete = false;
    }

    currentMap[screenId] = nextScr;
    setNewTplForm({
      ...newTplForm,
      screen_permissions: currentMap,
      screens: extractAllowedScreensFromMap(currentMap)
    });
  };

  const handleSaveRoleTemplate = async (e) => {
    e.preventDefault();
    if (!requireAdminGuard()) return;
    if (!newTplForm.label.trim()) return alert('اكتب اسم الصلاحية / الدور');

    const key = newTplForm.key || ('tpl_' + Date.now());
    const finalScreens = extractAllowedScreensFromMap(newTplForm.screen_permissions);
    const denied = ALL_AVAILABLE_SCREENS.filter(s => !newTplForm.screen_permissions?.[s.id]?.view).map(s => s.id);

    const bodyObj = {
      label: newTplForm.label.trim(),
      base_role: newTplForm.base_role,
      screens: finalScreens,
      screen_permissions: newTplForm.screen_permissions,
      actions: newTplForm.actions
    };
    const bodyJson = JSON.stringify(bodyObj);

    const existingTpl = roleTemplates.find(t => t.key === key && t.dbId);
    const targetDbId = newTplForm.id || existingTpl?.dbId || null;

    if (targetDbId) {
      const { error } = await supabase
        .from('church_public_content')
        .update({ title: key, body: bodyJson })
        .eq('id', targetDbId);
      if (error) return alert('خطأ أثناء تعديل القالب: ' + error.message);
    } else {
      const { error } = await supabase
        .from('church_public_content')
        .insert([{ kind: 'role_template', title: key, body: bodyJson }]);
      if (error) return alert('خطأ أثناء إنشاء القالب: ' + error.message);
    }

    if (syncUsersOnTplSave) {
      const affectedUsers = users.filter(
        u => u.role !== 'admin' && (
          u.permissions?.template_key === key ||
          u.permissions?.custom_role_label === bodyObj.label
        )
      );
      for (const u of affectedUsers) {
        const nextPerms = {
          ...(u.permissions || {}),
          ...bodyObj.actions,
          template_key: key,
          custom_role_label: bodyObj.label,
          allowed_screens: finalScreens,
          extra_screens: finalScreens,
          denied_screens: denied,
          screen_permissions: bodyObj.screen_permissions
        };
        await supabase.from('church_users').update({ permissions: nextPerms }).eq('id', u.id);
      }
      if (onRefresh && affectedUsers.length > 0) await onRefresh();
    }

    await loadRoleTemplates();
    setNewTplForm(EMPTY_TPL_FORM);
    setSyncUsersOnTplSave(false);
    alert('تم حفظ قالب الصلاحية بنجاح ✅');
  };

  const handleDeleteRoleTemplate = async (tpl) => {
    if (!requireAdminGuard() || !tpl.dbId) return;
    const isDefaultOverride = DEFAULT_ROLE_TEMPLATES.some(d => d.key === tpl.key);
    const msg = isDefaultOverride
      ? `استعادة القالب الافتراضي لـ (${tpl.label})؟`
      : `هل أنت متأكد من حذف قالب الصلاحية (${tpl.label})؟`;
    if (!window.confirm(msg)) return;
    const { error } = await supabase.from('church_public_content').delete().eq('id', tpl.dbId);
    if (!error) await loadRoleTemplates();
  };

  const handleBulkApplyTemplate = async () => {
    if (!requireAdminGuard()) return;
    const tpl = roleTemplates.find(t => t.key === bulkTemplateKey);
    if (!tpl) return alert('اختر قالب صلاحية أولاً');
    if (bulkSelectedIds.length === 0) return alert('اختر شخصاً واحداً على الأقل');

    setSaving(true);
    try {
      const scrMap = buildScreenPermissionsMap(tpl.screens || [], tpl.actions || {}, tpl.screen_permissions);
      const allowed = extractAllowedScreensFromMap(scrMap);
      const denied = ALL_AVAILABLE_SCREENS.filter(s => !scrMap[s.id]?.view).map(s => s.id);
      let updatedCount = 0;

      for (const uid of bulkSelectedIds) {
        const u = users.find(x => x.id === uid);
        if (!u || u.role === 'admin') continue;
        const nextPerms = {
          ...(u.permissions || {}),
          ...tpl.actions,
          template_key: tpl.key,
          custom_role_label: tpl.label,
          allowed_screens: allowed,
          extra_screens: allowed,
          denied_screens: denied,
          screen_permissions: scrMap
        };
        const { error } = await supabase
          .from('church_users')
          .update({
            role: tpl.base_role || u.role,
            permissions: nextPerms
          })
          .eq('id', uid);
        if (!error) updatedCount++;
      }

      if (onRefresh) await onRefresh();
      setBulkSelectedIds([]);
      alert(`تم تطبيق صلاحية "${tpl.label}" على (${updatedCount}) فرد بنجاح ✅`);
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white p-10 rounded-3xl border text-center space-y-3" dir="rtl">
        <Lock size={44} className="mx-auto text-red-600" />
        <h3 className="text-base font-black text-red-900">غير مصرح لك بتعديل الصلاحيات</h3>
        <p className="text-xs text-gray-600">التحكم في الصلاحيات وتحديد من يشوف ومن يعدل متاح لحساب الأدمن فقط.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-xs md:text-sm" dir="rtl">
      <div className="bg-white p-4 rounded-3xl border shadow-sm space-y-3">
        <div>
          <h2 className="text-base md:text-lg font-black text-[#7a1c24] flex items-center gap-2">
            <Shield size={20} /> المركز الموحد للصلاحيات والأدوار وتعدد الشاشات (Group Policy)
          </h2>
          <p className="text-xs text-gray-500">تحكم شامل من مكان واحد: قوالب Group Policy (ولي الأمر / الخادم / المخدوم...)، الصلاحيات الجزئية، وتطبيقها على الأفراد أو المجموعات</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('users')}
            className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer ${tab === 'users' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <Users size={15} /> 👤 صلاحيات فرد معين
          </button>
          <button
            type="button"
            onClick={() => setTab('templates')}
            className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer ${tab === 'templates' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <ShieldCheck size={15} /> 🧩 قوالب الصلاحيات (Group Policy)
          </button>
          <button
            type="button"
            onClick={() => setTab('roles')}
            className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer ${tab === 'roles' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <Layers size={15} /> 📋 الجدول الممركز للأدوار الأساسية
          </button>
          <button
            type="button"
            onClick={() => setTab('bulk')}
            className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer ${tab === 'bulk' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            ⚡ تعيين جماعي لعدة أفراد
          </button>
        </div>
      </div>

      {/* TAB 1: صلاحيات فرد معين */}
      {tab === 'users' && (
        <div className="grid lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 bg-white p-4 rounded-3xl border space-y-3">
            <strong className="text-[#7a1c24] block">1) اختر الشخص لتحديد ما يراه وما يعدّله:</strong>
            <div className="relative">
              <Search size={14} className="absolute right-3 top-3 text-gray-400" />
              <input
                placeholder="ابحث بالاسم أو اليوزر..."
                className="w-full pr-8 pl-3 py-2 border rounded-xl text-xs"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </div>
            <select
              className="w-full p-2 border rounded-xl text-xs bg-gray-50 font-bold"
              value={userRoleFilter}
              onChange={e => setUserRoleFilter(e.target.value)}
            >
              <option value="all">كل الأدوار ({users.length})</option>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <div className="space-y-1.5 max-h-[540px] overflow-y-auto">
              {users
                .filter(u => u.role !== 'admin')
                .filter(u => userRoleFilter === 'all' || u.role === userRoleFilter)
                .filter(u => ((u.full_name || '') + ' ' + (u.username || '') + ' ' + (u.phone || '') + ' ' + (u.permissions?.custom_role_label || '')).toLowerCase().includes(userSearch.toLowerCase()))
                .map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => selectUserForEdit(u)}
                    className={`w-full text-right p-3 rounded-2xl border transition cursor-pointer flex justify-between items-center ${
                      selectedUser?.id === u.id ? 'bg-[#f9ecee] border-[#7a1c24]' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div>
                      <strong className="text-gray-900 block">{u.full_name}</strong>
                      <span className="text-[11px] text-gray-600">
                        {u.permissions?.custom_role_label || ROLE_LABELS[u.role] || u.role} • @{u.username}
                      </span>
                    </div>
                    <span className="px-2 py-1 bg-white border rounded-lg text-[10px] font-bold">
                      {u.permissions?.can_edit_members ? '✏️ يعدل' : '👀 يشوف'}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          <div className="lg:col-span-8 bg-white p-5 rounded-3xl border space-y-4">
            {!selectedUser ? (
              <div className="p-12 text-center text-gray-400 space-y-2">
                <ShieldCheck size={40} className="mx-auto text-[#7a1c24]/60" />
                <strong className="block text-gray-700">اختر شخصاً من القائمة لتحديد صلاحياته بدقة</strong>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-between items-center border-b pb-3 gap-2">
                  <div>
                    <h3 className="text-base font-black text-[#7a1c24]">صلاحيات: {selectedUser.full_name}</h3>
                    <span className="text-xs text-gray-500">الدور الأساسي: {ROLE_LABELS[selectedUser.role] || selectedUser.role}</span>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveUserPermissions}
                    className="px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save size={15} /> {saving ? 'جاري الحفظ...' : 'حفظ صلاحيات الشخص ✅'}
                  </button>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-2xl border">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1 font-bold">مسمى الصلاحية:</label>
                    <input
                      className="w-full p-2 border rounded-xl bg-white text-xs font-bold"
                      placeholder="مثال: ولي أمر / خادم..."
                      value={selectedUser.permissions?.custom_role_label || ''}
                      onChange={e => setSelectedUser({
                        ...selectedUser,
                        permissions: { ...selectedUser.permissions, custom_role_label: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1 font-bold">الدور الأساسي:</label>
                    <select
                      className="w-full p-2 border rounded-xl bg-white text-xs font-bold"
                      value={selectedUser.role}
                      onChange={e => setSelectedUser({ ...selectedUser, role: e.target.value })}
                    >
                      {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'admin').map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1 font-bold">الشاشة الافتراضية:</label>
                    <select
                      className="w-full p-2 border rounded-xl bg-white text-xs font-bold"
                      value={selectedUser.permissions?.default_screen || ''}
                      onChange={e => setSelectedUser({
                        ...selectedUser,
                        permissions: { ...selectedUser.permissions, default_screen: e.target.value }
                      })}
                    >
                      <option value="">(حسب افتراضي الدور)</option>
                      {ALL_SCREENS.map(scr => (
                        <option key={scr} value={scr}>{SCREEN_LABELS[scr] || scr}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 space-y-2">
                  <strong className="text-amber-950 text-xs block">⚡ تطبيق قالب Group Policy جاهز بضغطة واحدة:</strong>
                  <div className="flex flex-wrap gap-1.5">
                    {roleTemplates.map(tpl => (
                      <button
                        key={tpl.key}
                        type="button"
                        onClick={() => applyTemplateToSelectedUser(tpl)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition ${
                          selectedUser.permissions?.template_key === tpl.key || selectedUser.permissions?.custom_role_label === tpl.label
                            ? 'bg-[#7a1c24] text-white border-[#7a1c24]'
                            : 'bg-white hover:bg-amber-100 text-amber-950'
                        }`}
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-emerald-50/40 p-3.5 rounded-2xl border border-emerald-200 space-y-2.5">
                  <strong className="text-emerald-950 block">🖥️ جدول الشاشات المسموحة (يشوف / يضيف / يعدل / يحذف):</strong>
                  <div className="overflow-x-auto bg-white rounded-2xl border">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-gray-100 text-gray-800">
                        <tr>
                          <th className="p-2.5">الشاشة / القسم</th>
                          <th className="p-2.5 text-center">👀 يشوف</th>
                          <th className="p-2.5 text-center">➕ يضيف</th>
                          <th className="p-2.5 text-center">✏️ يعدل</th>
                          <th className="p-2.5 text-center">🗑️ يحذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {ALL_AVAILABLE_SCREENS.map(scr => {
                          const sp = selectedUser.permissions?.screen_permissions?.[scr.id] || { view: false, add: false, edit: false, delete: false };
                          return (
                            <tr key={scr.id} className={sp.view ? 'bg-emerald-50/30' : ''}>
                              <td className="p-2.5 font-bold text-gray-900">{scr.label}</td>
                              <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={Boolean(sp.view)} onChange={e => toggleUserScreenAction(scr.id, 'view', e.target.checked)} /></td>
                              <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={Boolean(sp.add)} onChange={e => toggleUserScreenAction(scr.id, 'add', e.target.checked)} /></td>
                              <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={Boolean(sp.edit)} onChange={e => toggleUserScreenAction(scr.id, 'edit', e.target.checked)} /></td>
                              <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={Boolean(sp.delete)} onChange={e => toggleUserScreenAction(scr.id, 'delete', e.target.checked)} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: قوالب الصلاحيات */}
      {tab === 'templates' && (
        <div className="space-y-4">
          <form onSubmit={handleSaveRoleTemplate} className="bg-white p-5 rounded-3xl border space-y-4 font-bold">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h3 className="text-base font-black text-[#7a1c24]">
                {newTplForm.key ? `✏️ تعديل قالب Group Policy (${newTplForm.label})` : '➕ إنشاء قالب Group Policy جديد'}
              </h3>
              {newTplForm.key && (
                <button type="button" onClick={() => { setNewTplForm(EMPTY_TPL_FORM); setSyncUsersOnTplSave(false); }} className="px-3 py-1.5 bg-gray-100 rounded-xl text-xs cursor-pointer">+ قالب جديد</button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">اسم الصلاحية / القالب *</label>
                <input required placeholder="مثال: ولي أمر، خادم، مراقب دروس..." className="w-full p-2.5 border rounded-xl" value={newTplForm.label} onChange={e => setNewTplForm({ ...newTplForm, label: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">الدور الأساسي المرتبط به:</label>
                <select className="w-full p-2.5 border rounded-xl bg-white" value={newTplForm.base_role} onChange={e => setNewTplForm({ ...newTplForm, base_role: e.target.value })}>
                  {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'admin').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-2xl border space-y-2">
              <strong className="block text-xs text-gray-800">الشاشات المسموحة في القالب (يشوف / يضيف / يعدل / يحذف):</strong>
              <div className="overflow-x-auto bg-white rounded-2xl border">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-100 text-gray-800">
                    <tr>
                      <th className="p-2.5">الشاشة</th>
                      <th className="p-2.5 text-center">👀 يشوف</th>
                      <th className="p-2.5 text-center">➕ يضيف</th>
                      <th className="p-2.5 text-center">✏️ يعدل</th>
                      <th className="p-2.5 text-center">🗑️ يحذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ALL_AVAILABLE_SCREENS.map(scr => {
                      const sp = newTplForm.screen_permissions?.[scr.id] || { view: false, add: false, edit: false, delete: false };
                      return (
                        <tr key={scr.id} className={sp.view ? 'bg-emerald-50/30' : ''}>
                          <td className="p-2.5 font-bold text-gray-900">{scr.label}</td>
                          <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={Boolean(sp.view)} onChange={e => toggleTplScreenAction(scr.id, 'view', e.target.checked)} /></td>
                          <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={Boolean(sp.add)} onChange={e => toggleTplScreenAction(scr.id, 'add', e.target.checked)} /></td>
                          <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={Boolean(sp.edit)} onChange={e => toggleTplScreenAction(scr.id, 'edit', e.target.checked)} /></td>
                          <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={Boolean(sp.delete)} onChange={e => toggleTplScreenAction(scr.id, 'delete', e.target.checked)} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {newTplForm.key && (
              <label className="flex items-center gap-2 text-xs text-[#7a1c24] bg-red-50 p-3 rounded-xl border border-red-200 cursor-pointer">
                <input type="checkbox" checked={syncUsersOnTplSave} onChange={e => setSyncUsersOnTplSave(e.target.checked)} />
                🔄 تحديث صلاحيات كل الأشخاص المرتبطين بهذا القالب تلقائياً عند الحفظ
              </label>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="submit" className="px-6 py-2.5 bg-[#7a1c24] text-white rounded-xl cursor-pointer flex items-center gap-1.5">
                <CheckCircle2 size={15} /> {newTplForm.key ? 'حفظ تعديل القالب' : '+ إنشاء القالب الجديد'}
              </button>
              {newTplForm.key && (
                <button type="button" onClick={() => { setNewTplForm(EMPTY_TPL_FORM); setSyncUsersOnTplSave(false); }} className="px-4 py-2 border rounded-xl cursor-pointer">إلغاء</button>
              )}
            </div>
          </form>

          <div className="grid md:grid-cols-2 gap-3">
            {roleTemplates.map(tpl => (
              <div key={tpl.key} className="bg-white p-4 rounded-2xl border space-y-2.5 shadow-2xs">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <strong className="text-sm text-[#7a1c24] block">{tpl.label}</strong>
                    <span className="text-[11px] text-gray-500">الدور: {ROLE_LABELS[tpl.base_role] || tpl.base_role}</span>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" title="تعديل" onClick={() => { setNewTplForm({ id: tpl.dbId || null, key: tpl.key, label: tpl.label, base_role: tpl.base_role, screens: tpl.screens || [], screen_permissions: buildScreenPermissionsMap(tpl.screens || [], tpl.actions || {}, tpl.screen_permissions), actions: { ...EMPTY_TPL_FORM.actions, ...(tpl.actions || {}) } }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"><Edit3 size={13} /></button>
                    <button type="button" title="نسخ" onClick={() => { setNewTplForm({ id: null, key: '', label: `${tpl.label} (نسخة)`, base_role: tpl.base_role, screens: tpl.screens || [], screen_permissions: buildScreenPermissionsMap(tpl.screens || [], tpl.actions || {}, tpl.screen_permissions), actions: { ...EMPTY_TPL_FORM.actions, ...(tpl.actions || {}) } }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg cursor-pointer"><Copy size={13} /></button>
                    <button type="button" onClick={() => { setBulkTemplateKey(tpl.key); setTab('bulk'); }} className="px-2 py-1 bg-amber-50 text-amber-900 hover:bg-amber-100 rounded-lg text-[10px] font-black cursor-pointer">تعيين لناس</button>
                    {tpl.dbId && <button type="button" onClick={() => handleDeleteRoleTemplate(tpl)} className="p-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg cursor-pointer"><Trash2 size={13} /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: الأدوار الأساسية */}
      {tab === 'roles' && (
        <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-4">
          <div className="flex flex-wrap gap-2">
            {ROLES.filter(r => r.key !== 'admin').map(r => (
              <button key={r.key} type="button" onClick={() => setSelectedRole(r.key)} className={`px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer ${selectedRole === r.key ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-gray-50 text-gray-800'}`}>{r.label}</button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {ALL_SCREENS.map(scr => {
              const checked = roleAllowed.has(scr);
              const isDef = roleDefault === scr;
              return (
                <div key={scr} className={`p-3 rounded-2xl border-2 flex justify-between items-center gap-2 ${checked ? 'bg-red-50/40 border-[#7a1c24]' : 'bg-gray-50 border-gray-200'}`}>
                  <label className="flex items-center gap-2 font-bold cursor-pointer flex-1"><input type="checkbox" checked={checked} onChange={() => toggleRoleScreen(scr)} /><span>{SCREEN_LABELS[scr] || scr}</span></label>
                  {checked && <button type="button" onClick={() => setRoleDefault(scr)} className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer ${isDef ? 'bg-[#7a1c24] text-white' : 'bg-white border text-gray-600'}`}>{isDef ? 'الافتراضية ⭐' : 'تعيين افتراضية'}</button>}
                </div>
              );
            })}
          </div>
          <button type="button" disabled={saving} onClick={saveRoleScreens} className="px-6 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer">
            <Save size={15} /> {saving ? 'جاري الحفظ...' : 'حفظ صلاحيات الدور الأساسي'}
          </button>
        </div>
      )}

      {/* TAB 4: التعيين الجماعي */}
      {tab === 'bulk' && (
        <div className="bg-white p-5 rounded-3xl border space-y-4 font-bold">
          <h3 className="text-base font-black text-[#7a1c24]">⚡ تطبيق قالب Group Policy على مجموعة أشخاص دفعة واحدة</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <div><label className="block text-xs text-gray-600 mb-1">1) القالب:</label><select className="w-full p-2.5 border rounded-xl bg-amber-50/40" value={bulkTemplateKey} onChange={e => setBulkTemplateKey(e.target.value)}>{roleTemplates.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
            <div><label className="block text-xs text-gray-600 mb-1">2) فلترة الدور:</label><select className="w-full p-2.5 border rounded-xl bg-white" value={bulkRoleFilter} onChange={e => setBulkRoleFilter(e.target.value)}><option value="all">الكل</option>{Object.entries(ROLE_LABELS).filter(([k]) => k !== 'admin').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="block text-xs text-gray-600 mb-1">3) بحث:</label><input placeholder="ابحث..." className="w-full p-2.5 border rounded-xl" value={bulkSearch} onChange={e => setBulkSearch(e.target.value)} /></div>
          </div>
          {(() => {
            const eligibleUsers = users.filter(u => u.role !== 'admin').filter(u => bulkRoleFilter === 'all' || u.role === bulkRoleFilter).filter(u => ((u.full_name || '') + ' ' + (u.username || '') + ' ' + (u.phone || '')).toLowerCase().includes(bulkSearch.toLowerCase()));
            return (
              <>
                <div className="flex flex-wrap justify-between items-center gap-2 bg-gray-50 p-3 rounded-2xl border text-xs">
                  <span>تم اختيار: <strong className="text-[#7a1c24]">{bulkSelectedIds.length}</strong> من {eligibleUsers.length}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setBulkSelectedIds(eligibleUsers.map(u => u.id))} className="px-3 py-1.5 bg-white border rounded-xl cursor-pointer">تحديد الكل</button>
                    <button type="button" onClick={() => setBulkSelectedIds([])} className="px-3 py-1.5 bg-white border rounded-xl cursor-pointer">إلغاء التحديد</button>
                    <button type="button" disabled={saving || bulkSelectedIds.length === 0} onClick={handleBulkApplyTemplate} className="px-4 py-1.5 bg-[#7a1c24] text-white rounded-xl font-black cursor-pointer disabled:opacity-50">{saving ? 'جاري التطبيق...' : 'تطبيق الصلاحية ✅'}</button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                  {eligibleUsers.map(u => {
                    const checked = bulkSelectedIds.includes(u.id);
                    return (
                      <label key={u.id} className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer text-xs ${checked ? 'bg-[#f9ecee] border-[#7a1c24]' : 'bg-white hover:bg-gray-50'}`}>
                        <input type="checkbox" checked={checked} onChange={e => setBulkSelectedIds(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id))} />
                        <div><strong className="block text-gray-900">{u.full_name}</strong><span className="text-[11px] text-gray-500">{u.permissions?.custom_role_label || ROLE_LABELS[u.role] || u.role}</span></div>
                      </label>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
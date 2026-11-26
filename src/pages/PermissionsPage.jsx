import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  ALL_SCREENS,
  SCREEN_LABELS,
  ROLES,
  CATEGORY_PRESETS,
  DEFAULT_ROLE_SCREENS,
  resolveScreens,
  mergeUserPolicies
} from '../lib/permissions';
import {
  Shield,
  Save,
  Users,
  Layers,
  Lock,
  Search,
  Edit3,
  Trash2,
  Copy,
  CheckCircle2,
  ShieldCheck,
  Eye,
  Plus,
  CheckSquare,
  Square,
  Sparkles,
  MailPlus,
  QrCode
} from 'lucide-react';

const LOCAL_ALL_SCREENS = Array.from(new Set([...ALL_SCREENS, 'hidden_families']));
const LOCAL_SCREEN_LABELS = {
  ...SCREEN_LABELS,
  hidden_families: '🕊️ خدمة الأسر المستترة'
};

const ROLE_LABELS = {
  admin: '🛡️ سوبر أدمن',
  priest: '✝ أب كاهن',
  head_servant: '⭐ أمين الخدمة',
  vice_head_servant: '🌟 مساعد أمين الخدمة',
  servant: '📖 خادم مرحلة',
  meeting_servant: '🎤 خادم اجتماع',
  mercy_servant: '🤝 خادم إخوة رب',
  member: '👤 مخدوم (رعية)',
  parent: '👨‍👩‍👦 ولي أمر',
  worker: '🛠️ عامل / فراش كنيسة'
};

const EMPTY_PERM_ROW = { view: false, create: false, edit: false, delete: false };

function makePresetScreenMap(presetKey) {
  const preset = CATEGORY_PRESETS[presetKey] || CATEGORY_PRESETS.member;
  const map = {};
  LOCAL_ALL_SCREENS.forEach((scrKey) => {
    const active = preset.screens.includes(scrKey);
    if (!active) {
      map[scrKey] = { ...EMPTY_PERM_ROW };
      return;
    }
    if (scrKey === 'public_page') {
      map[scrKey] = { view: true, create: false, edit: false, delete: false };
      return;
    }
    map[scrKey] = {
      view: Boolean(preset.actions.view),
      create: Boolean(preset.actions.view && preset.actions.create),
      edit: Boolean(preset.actions.view && preset.actions.edit),
      delete: Boolean(preset.actions.view && preset.actions.delete)
    };
  });
  return map;
}

export const DEFAULT_ROLE_TEMPLATES = [
  {
    key: 'tpl_member',
    label: '👤 المخدوم / الشعب (يشوف فقط)',
    base_role: 'member',
    screens: CATEGORY_PRESETS.member.screens,
    actions: {
      can_view: true,
      can_create: false,
      can_edit: false,
      can_delete: false,
      can_send_invitations: false,
      can_scan_invitations: false,
      send_invitations: false,
      scan_invitations: false,
      manage_edu_center: false,
      manage_trips: false,
      manage_joseph: false,
      can_edit_public: false
    },
    screen_permissions: makePresetScreenMap('member')
  },
  {
    key: 'tpl_parent',
    label: '👨‍👩‍👦 ولي الأمر (يشوف فقط بمتابعات أوسع)',
    base_role: 'parent',
    screens: CATEGORY_PRESETS.parent.screens,
    actions: {
      can_view: true,
      can_create: false,
      can_edit: false,
      can_delete: false,
      can_send_invitations: false,
      can_scan_invitations: false,
      send_invitations: false,
      scan_invitations: false,
      view_parent_panel: true,
      manage_edu_center: false,
      manage_trips: false,
      manage_joseph: false,
      can_edit_public: false
    },
    screen_permissions: makePresetScreenMap('parent')
  },
  {
    key: 'tpl_servant',
    label: '📖 الخادم (يشوف ويكتب — بدون حذف)',
    base_role: 'servant',
    screens: CATEGORY_PRESETS.servant.screens,
    actions: {
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: false,
      can_send_invitations: false,
      can_scan_invitations: false,
      send_invitations: false,
      scan_invitations: false,
      manage_edu_center: false,
      manage_trips: false,
      manage_joseph: false,
      can_edit_public: false
    },
    screen_permissions: makePresetScreenMap('servant')
  },
  {
    key: 'tpl_head_servant',
    label: '⭐ أمين الخدمة (كل شيء ما عدا صلاحيات الأدمن)',
    base_role: 'head_servant',
    screens: CATEGORY_PRESETS.head_servant.screens,
    actions: {
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: true,
      can_send_invitations: true,
      can_scan_invitations: true,
      send_invitations: true,
      scan_invitations: true,
      manage_edu_center: true,
      manage_trips: true,
      manage_joseph: true,
      can_edit_public: true
    },
    screen_permissions: makePresetScreenMap('head_servant')
  },
  {
    key: 'tpl_priest',
    label: '✝ الأب الكاهن (يشوف ويعمل ويعمل إيديت)',
    base_role: 'priest',
    screens: CATEGORY_PRESETS.priest.screens,
    actions: {
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: false,
      can_send_invitations: true,
      can_scan_invitations: true,
      send_invitations: true,
      scan_invitations: true,
      manage_edu_center: true,
      manage_trips: true,
      manage_joseph: true,
      joseph_role: 'committee',
      joseph_can_edit: true,
      view_cases: true,
      view_deacons: true,
      can_edit_public: true
    },
    screen_permissions: makePresetScreenMap('priest')
  },
  {
    key: 'tpl_hidden_families',
    label: '🕊️ خادم الأسر المستترة (إضافة فقط — التعديل والحذف للكاهن والأدمن)',
    base_role: 'mercy_servant',
    screens: ['hidden_families', 'public_page'],
    actions: {
      can_view: true,
      can_create: true,
      can_edit: false,
      can_delete: false,
      can_send_invitations: false,
      can_scan_invitations: false,
      send_invitations: false,
      scan_invitations: false,
      view_cases: true,
      manage_edu_center: false,
      manage_trips: false,
      manage_joseph: false,
      can_edit_public: false
    },
    screen_permissions: {
      hidden_families: { view: true, create: true, edit: false, delete: false },
      public_page: { view: true, create: false, edit: false, delete: false }
    }
  }
];

function normalizeScreenPermRow(row = {}) {
  const view = Boolean(row.view);
  const create = view && Boolean(row.create ?? row.add);
  const edit = view && Boolean(row.edit);
  const deletePerm = view && Boolean(row.delete);
  return { view, create, edit, delete: deletePerm };
}

export const buildScreenPermissionsMap = (screens = [], actions = {}, existingMap = {}) => {
  const map = {};
  LOCAL_ALL_SCREENS.forEach((scrKey) => {
    const prev = existingMap?.[scrKey];
    const hasExplicit = prev && typeof prev === 'object';
    const isVisible = hasExplicit ? Boolean(prev.view) : screens.includes(scrKey);
    const defaultCreate = Boolean(actions?.can_create ?? actions?.can_add);
    const defaultEdit = Boolean(actions?.can_edit ?? actions?.can_edit_members);
    const defaultDelete = Boolean(actions?.can_delete);

    map[scrKey] = {
      view: isVisible,
      create: isVisible ? (hasExplicit ? Boolean(prev.create ?? prev.add) : defaultCreate) : false,
      edit: isVisible ? (hasExplicit ? Boolean(prev.edit) : defaultEdit) : false,
      delete: isVisible ? (hasExplicit ? Boolean(prev.delete) : defaultDelete) : false
    };
  });
  return map;
};

export const extractAllowedScreensFromMap = (screenPermMap = {}) =>
  LOCAL_ALL_SCREENS.filter((scrKey) => Boolean(screenPermMap?.[scrKey]?.view));

const EMPTY_TPL_FORM = {
  id: null,
  key: '',
  label: '',
  base_role: 'member',
  screens: CATEGORY_PRESETS.member.screens,
  screen_permissions: makePresetScreenMap('member'),
  actions: {
    can_view: true,
    can_create: false,
    can_edit: false,
    can_delete: false,
    can_send_invitations: false,
    can_scan_invitations: false,
    send_invitations: false,
    scan_invitations: false,
    manage_edu_center: false,
    manage_trips: false,
    manage_joseph: false,
    can_edit_public: false
  }
};

function getInvitationPermissionState(perms = {}) {
  const canSend = Boolean(
    perms?.can_send_invitations === true ||
    perms?.actions?.send_invitations === true ||
    perms?.actions?.can_send_invitations === true
  );
  const canScan = Boolean(
    perms?.can_scan_invitations === true ||
    perms?.actions?.scan_invitations === true ||
    perms?.actions?.can_scan_invitations === true
  );
  return { canSend, canScan };
}

function buildMergedUserFromPolicies(user, selectedPolicyKeys, allPolicies, preserveCustom = true) {
  const prevPerms = user?.permissions || {};
  const policyKeys = Array.from(new Set(selectedPolicyKeys || []));

  const syntheticUser = {
    ...user,
    permissions: {
      ...prevPerms,
      policy_keys: policyKeys,
      template_key: policyKeys[0] || ''
    }
  };

  const { mergedScreens, mergedActions, matchedPolicies } = mergeUserPolicies(syntheticUser, allPolicies);

  const nextScreenPerms = {};
  LOCAL_ALL_SCREENS.forEach((scrKey) => {
    const fromPolicies = mergedScreens[scrKey] || { ...EMPTY_PERM_ROW };
    const manualOverride = preserveCustom ? prevPerms?.manual_overrides?.[scrKey] : null;
    if (manualOverride && typeof manualOverride === 'object') {
      nextScreenPerms[scrKey] = normalizeScreenPermRow(manualOverride);
    } else {
      nextScreenPerms[scrKey] = normalizeScreenPermRow(fromPolicies);
    }
  });

  const primaryPolicy = matchedPolicies[0];
  const combinedLabel = matchedPolicies.length > 0
    ? matchedPolicies.map((p) => p.label).join(' + ')
    : (ROLE_LABELS[user.role] || user.role);

  const nextRole = user.role === 'admin'
    ? 'admin'
    : (primaryPolicy?.base_role || user.role || 'member');

  const canSend = Boolean(
    mergedActions.send_invitations === true ||
    mergedActions.can_send_invitations === true ||
    (preserveCustom && prevPerms.can_send_invitations === true)
  );
  const canScan = Boolean(
    mergedActions.scan_invitations === true ||
    mergedActions.can_scan_invitations === true ||
    (preserveCustom && prevPerms.can_scan_invitations === true)
  );

  return {
    ...user,
    role: nextRole,
    permissions: {
      ...prevPerms,
      ...mergedActions,
      can_send_invitations: canSend,
      can_scan_invitations: canScan,
      actions: {
        ...(prevPerms.actions || {}),
        ...mergedActions,
        send_invitations: canSend,
        scan_invitations: canScan
      },
      policy_keys: policyKeys,
      template_key: policyKeys[0] || '',
      custom_role_label: combinedLabel,
      screen_permissions: nextScreenPerms,
      allowed_screens: extractAllowedScreensFromMap(nextScreenPerms)
    }
  };
}

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
    DEFAULT_ROLE_TEMPLATES.map((t) => ({
      ...t,
      screen_permissions: buildScreenPermissionsMap(t.screens, t.actions, t.screen_permissions)
    }))
  );
  const [newTplForm, setNewTplForm] = useState(EMPTY_TPL_FORM);
  const [syncUsersOnTplSave, setSyncUsersOnTplSave] = useState(true);

  const [bulkPolicyKeys, setBulkPolicyKeys] = useState(['tpl_member']);
  const [bulkMode, setBulkMode] = useState('replace');
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
    DEFAULT_ROLE_TEMPLATES.forEach((t) => {
      mergedMap.set(t.key, {
        ...t,
        screen_permissions: buildScreenPermissionsMap(t.screens, t.actions, t.screen_permissions)
      });
    });

    if (data && data.length > 0) {
      data.forEach((row) => {
        try {
          const obj = JSON.parse(row.body || '{}');
          if (obj.hidden) {
            mergedMap.delete(row.title);
            return;
          }
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
          // ignore malformed row
        }
      });
    }
    const finalTemplates = Array.from(mergedMap.values());
    setRoleTemplates(finalTemplates);
    setBulkPolicyKeys((prev) => prev.filter((k) => finalTemplates.some((t) => t.key === k)));
  };

  useEffect(() => {
    loadRoleTemplates();
  }, []);

  useEffect(() => {
    const rows = roleScreens.filter((r) => r.role === selectedRole);
    if (rows.length > 0) {
      setRoleAllowed(new Set(rows.map((r) => r.screen)));
      const defRow = rows.find((r) => r.is_default);
      setRoleDefault(defRow ? defRow.screen : rows[0].screen);
    } else if (DEFAULT_ROLE_SCREENS[selectedRole]) {
      const defList = DEFAULT_ROLE_SCREENS[selectedRole];
      const allowedFromDef = defList.filter((item) => item.can_view).map((item) => item.screen);
      const defScreen = defList.find((item) => item.is_default)?.screen || allowedFromDef[0] || '';
      setRoleAllowed(new Set(allowedFromDef));
      setRoleDefault(defScreen);
    } else {
      setRoleAllowed(new Set());
      setRoleDefault('');
    }
  }, [selectedRole, roleScreens]);

  const selectUserForEdit = (u) => {
    if (!u) return;
    const rawPerms = u.permissions || {};
    const policyKeys = Array.isArray(rawPerms.policy_keys) && rawPerms.policy_keys.length > 0
      ? rawPerms.policy_keys
      : (rawPerms.template_key ? [rawPerms.template_key] : []);

    const effectiveSet = resolveScreens(u, roleScreens, roleTemplates).allowed;
    if (rawPerms.screen_permissions?.hidden_families?.view || (Array.isArray(rawPerms.allowed_screens) && rawPerms.allowed_screens.includes('hidden_families'))) {
      effectiveSet.add('hidden_families');
    }
    const baseScreens = Array.from(effectiveSet);
    const normalizedMap = buildScreenPermissionsMap(baseScreens, rawPerms, rawPerms.screen_permissions);
    const invState = getInvitationPermissionState(rawPerms);

    setSelectedUser({
      ...u,
      permissions: {
        ...rawPerms,
        can_send_invitations: invState.canSend,
        can_scan_invitations: invState.canScan,
        actions: {
          ...(rawPerms.actions || {}),
          send_invitations: invState.canSend,
          scan_invitations: invState.canScan
        },
        policy_keys: policyKeys,
        template_key: policyKeys[0] || rawPerms.template_key || '',
        custom_role_label: rawPerms.custom_role_label || ROLE_LABELS[u.role] || u.role,
        default_screen: rawPerms.default_screen || '',
        manual_overrides: rawPerms.manual_overrides || {},
        screen_permissions: normalizedMap,
        allowed_screens: extractAllowedScreensFromMap(normalizedMap)
      }
    });
  };

  useEffect(() => {
    if (initialUserId && users.length > 0) {
      const target = users.find((u) => u.id === initialUserId);
      if (target) {
        setTab('users');
        selectUserForEdit(target);
      }
    }
  }, [initialUserId, users.length, roleTemplates.length]);

  const toggleSelectedUserInvitationPerm = (permType, checked) => {
    if (!isAdmin || !selectedUser) return;
    const prevPerms = selectedUser.permissions || {};
    const prevActions = prevPerms.actions || {};

    if (permType === 'send') {
      setSelectedUser({
        ...selectedUser,
        permissions: {
          ...prevPerms,
          can_send_invitations: checked,
          actions: {
            ...prevActions,
            send_invitations: checked
          }
        }
      });
    } else if (permType === 'scan') {
      setSelectedUser({
        ...selectedUser,
        permissions: {
          ...prevPerms,
          can_scan_invitations: checked,
          actions: {
            ...prevActions,
            scan_invitations: checked
          }
        }
      });
    } else if (permType === 'both') {
      setSelectedUser({
        ...selectedUser,
        permissions: {
          ...prevPerms,
          can_send_invitations: checked,
          can_scan_invitations: checked,
          actions: {
            ...prevActions,
            send_invitations: checked,
            scan_invitations: checked
          }
        }
      });
    }
  };

  const toggleTemplateInvitationPerm = (permType, checked) => {
    if (!isAdmin) return;
    const prevActions = newTplForm.actions || {};
    if (permType === 'send') {
      setNewTplForm({
        ...newTplForm,
        actions: {
          ...prevActions,
          can_send_invitations: checked,
          send_invitations: checked
        }
      });
    } else if (permType === 'scan') {
      setNewTplForm({
        ...newTplForm,
        actions: {
          ...prevActions,
          can_scan_invitations: checked,
          scan_invitations: checked
        }
      });
    } else if (permType === 'both') {
      setNewTplForm({
        ...newTplForm,
        actions: {
          ...prevActions,
          can_send_invitations: checked,
          can_scan_invitations: checked,
          send_invitations: checked,
          scan_invitations: checked
        }
      });
    }
  };

  const applyPresetToSelectedUser = (presetKey) => {
    if (!isAdmin || !selectedUser) return;
    const preset = CATEGORY_PRESETS[presetKey];
    if (!preset) return;

    const nextMap = makePresetScreenMap(presetKey);
    const tplKeyByPreset = {
      member: 'tpl_member',
      parent: 'tpl_parent',
      servant: 'tpl_servant',
      head_servant: 'tpl_head_servant',
      priest: 'tpl_priest'
    };
    const mappedTplKey = tplKeyByPreset[presetKey];
    const nextPolicyKeys = mappedTplKey && roleTemplates.some((t) => t.key === mappedTplKey)
      ? [mappedTplKey]
      : (selectedUser.permissions?.policy_keys || []);

    const canSend = presetKey === 'head_servant' || presetKey === 'priest';
    const canScan = presetKey === 'head_servant' || presetKey === 'priest';

    setSelectedUser({
      ...selectedUser,
      role: selectedUser.role === 'admin' ? 'admin' : preset.baseRole,
      permissions: {
        ...selectedUser.permissions,
        policy_keys: nextPolicyKeys,
        template_key: nextPolicyKeys[0] || '',
        custom_role_label: ROLE_LABELS[preset.baseRole] || preset.label,
        default_screen: preset.defaultScreen,
        manual_overrides: {},
        can_view: true,
        can_create: preset.actions.create,
        can_edit: preset.actions.edit,
        can_delete: preset.actions.delete,
        can_send_invitations: canSend,
        can_scan_invitations: canScan,
        actions: {
          ...(selectedUser.permissions?.actions || {}),
          send_invitations: canSend,
          scan_invitations: canScan
        },
        screen_permissions: nextMap,
        allowed_screens: extractAllowedScreensFromMap(nextMap)
      }
    });
  };

  const applyPresetToTemplateForm = (presetKey) => {
    if (!isAdmin) return;
    const preset = CATEGORY_PRESETS[presetKey];
    if (!preset) return;
    const nextMap = makePresetScreenMap(presetKey);
    const canSend = presetKey === 'head_servant' || presetKey === 'priest';
    const canScan = presetKey === 'head_servant' || presetKey === 'priest';
    setNewTplForm((prev) => ({
      ...prev,
      base_role: preset.baseRole,
      screens: preset.screens,
      screen_permissions: nextMap,
      actions: {
        ...prev.actions,
        can_view: true,
        can_create: preset.actions.create,
        can_edit: preset.actions.edit,
        can_delete: preset.actions.delete,
        can_send_invitations: canSend,
        can_scan_invitations: canScan,
        send_invitations: canSend,
        scan_invitations: canScan,
        manage_edu_center: presetKey === 'head_servant' || presetKey === 'priest',
        manage_trips: presetKey === 'head_servant' || presetKey === 'priest',
        manage_joseph: presetKey === 'head_servant' || presetKey === 'priest',
        can_edit_public: presetKey === 'head_servant' || presetKey === 'priest'
      }
    }));
  };

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
      const rows = Array.from(roleAllowed).map((scr) => ({
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

  const toggleUserPolicyGroup = (policyKey) => {
    if (!isAdmin || !selectedUser) return;
    const currentKeys = Array.isArray(selectedUser.permissions?.policy_keys)
      ? selectedUser.permissions.policy_keys
      : (selectedUser.permissions?.template_key ? [selectedUser.permissions.template_key] : []);

    const nextKeys = currentKeys.includes(policyKey)
      ? currentKeys.filter((k) => k !== policyKey)
      : [...currentKeys, policyKey];

    const updatedUser = buildMergedUserFromPolicies(selectedUser, nextKeys, roleTemplates, true);
    setSelectedUser(updatedUser);
  };

  const toggleUserScreenAction = (screenId, actionKey, checked) => {
    if (!isAdmin || !selectedUser) return;
    const currentMap = { ...(selectedUser.permissions?.screen_permissions || {}) };
    const prevScr = normalizeScreenPermRow(currentMap[screenId]);
    const nextScr = { ...prevScr, [actionKey]: checked };

    if (actionKey !== 'view' && checked) nextScr.view = true;
    if (actionKey === 'view' && !checked) {
      nextScr.create = false;
      nextScr.edit = false;
      nextScr.delete = false;
    }

    currentMap[screenId] = nextScr;
    const nextOverrides = {
      ...(selectedUser.permissions?.manual_overrides || {}),
      [screenId]: nextScr
    };

    setSelectedUser({
      ...selectedUser,
      permissions: {
        ...selectedUser.permissions,
        screen_permissions: currentMap,
        manual_overrides: nextOverrides,
        allowed_screens: extractAllowedScreensFromMap(currentMap)
      }
    });
  };

  const clearUserManualOverrides = () => {
    if (!isAdmin || !selectedUser) return;
    const keys = selectedUser.permissions?.policy_keys || [];
    const resetUser = buildMergedUserFromPolicies(
      { ...selectedUser, permissions: { ...selectedUser.permissions, manual_overrides: {} } },
      keys,
      roleTemplates,
      false
    );
    setSelectedUser(resetUser);
  };

  const handleSaveUserPermissions = async () => {
    if (!requireAdminGuard() || !selectedUser) return;
    setSaving(true);
    try {
      const normalizedMap = buildScreenPermissionsMap(
        extractAllowedScreensFromMap(selectedUser.permissions?.screen_permissions),
        selectedUser.permissions,
        selectedUser.permissions?.screen_permissions
      );
      const normalizedScreens = extractAllowedScreensFromMap(normalizedMap);
      const policyKeys = Array.isArray(selectedUser.permissions?.policy_keys)
        ? selectedUser.permissions.policy_keys
        : [];

      const invState = getInvitationPermissionState(selectedUser.permissions);

      const finalPerms = {
        ...selectedUser.permissions,
        can_send_invitations: invState.canSend,
        can_scan_invitations: invState.canScan,
        actions: {
          ...(selectedUser.permissions?.actions || {}),
          send_invitations: invState.canSend,
          scan_invitations: invState.canScan
        },
        policy_keys: policyKeys,
        template_key: policyKeys[0] || '',
        screen_permissions: normalizedMap,
        allowed_screens: normalizedScreens
      };

      const { error } = await supabase
        .from('church_users')
        .update({
          ...(selectedUser.role !== 'admin' ? { role: selectedUser.role } : {}),
          permissions: finalPerms
        })
        .eq('id', selectedUser.id);

      if (error) return alert('خطأ في الحفظ: ' + error.message);

      setSelectedUser((prev) => (prev ? { ...prev, permissions: finalPerms } : null));
      if (onRefresh) await onRefresh();
      alert(`تم حفظ صلاحيات (${selectedUser.full_name}) بنجاح ✅`);
    } finally {
      setSaving(false);
    }
  };

  const toggleTplScreenAction = (screenId, actionKey, checked) => {
    if (!isAdmin) return;
    const currentMap = { ...(newTplForm.screen_permissions || {}) };
    const prevScr = normalizeScreenPermRow(currentMap[screenId]);
    const nextScr = { ...prevScr, [actionKey]: checked };

    if (actionKey !== 'view' && checked) nextScr.view = true;
    if (actionKey === 'view' && !checked) {
      nextScr.create = false;
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
    if (!newTplForm.label.trim()) return alert('اكتب اسم الصلاحية / الجروب');

    const key = newTplForm.key || ('tpl_' + Date.now());
    const finalScreens = extractAllowedScreensFromMap(newTplForm.screen_permissions);
    const invState = getInvitationPermissionState({ actions: newTplForm.actions });

    const finalActions = {
      ...newTplForm.actions,
      can_send_invitations: invState.canSend,
      can_scan_invitations: invState.canScan,
      send_invitations: invState.canSend,
      scan_invitations: invState.canScan
    };

    const bodyObj = {
      label: newTplForm.label.trim(),
      base_role: newTplForm.base_role,
      screens: finalScreens,
      screen_permissions: newTplForm.screen_permissions,
      actions: finalActions,
      hidden: false
    };
    const bodyJson = JSON.stringify(bodyObj);

    const existingTpl = roleTemplates.find((t) => t.key === key && t.dbId);
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

    const updatedPolicyObj = { key, ...bodyObj };
    const nextPoliciesList = roleTemplates.some((p) => p.key === key)
      ? roleTemplates.map((p) => (p.key === key ? { ...p, ...updatedPolicyObj } : p))
      : [...roleTemplates, updatedPolicyObj];

    if (syncUsersOnTplSave) {
      const affectedUsers = users.filter((u) => {
        if (u.role === 'admin') return false;
        const uKeys = Array.isArray(u.permissions?.policy_keys) ? u.permissions.policy_keys : [];
        return uKeys.includes(key) || u.permissions?.template_key === key;
      });

      for (const u of affectedUsers) {
        const existingKeys = Array.isArray(u.permissions?.policy_keys) && u.permissions.policy_keys.length > 0
          ? u.permissions.policy_keys
          : [key];
        const merged = buildMergedUserFromPolicies(u, existingKeys, nextPoliciesList, true);
        await supabase
          .from('church_users')
          .update({ permissions: merged.permissions })
          .eq('id', u.id);
      }
      if (onRefresh && affectedUsers.length > 0) await onRefresh();
    }

    await loadRoleTemplates();
    setNewTplForm(EMPTY_TPL_FORM);
    alert('تم حفظ جروب البوليسي بنجاح ✅');
  };

  const handleDeleteRoleTemplate = async (tpl) => {
    if (!requireAdminGuard()) return;
    const isDefaultTpl = DEFAULT_ROLE_TEMPLATES.some((d) => d.key === tpl.key);
    const msg = `هل أنت متأكد من حذف جروب البوليسي (${tpl.label})؟`;
    if (!window.confirm(msg)) return;

    if (tpl.dbId && !isDefaultTpl) {
      const { error } = await supabase.from('church_public_content').delete().eq('id', tpl.dbId);
      if (error) return alert('خطأ أثناء الحذف: ' + error.message);
    } else {
      const hiddenBody = JSON.stringify({
        label: tpl.label,
        base_role: tpl.base_role,
        screens: tpl.screens || [],
        screen_permissions: tpl.screen_permissions || {},
        actions: tpl.actions || {},
        hidden: true
      });

      if (tpl.dbId) {
        const { error } = await supabase
          .from('church_public_content')
          .update({ title: tpl.key, body: hiddenBody })
          .eq('id', tpl.dbId);
        if (error) return alert('خطأ أثناء الحذف: ' + error.message);
      } else {
        const { error } = await supabase
          .from('church_public_content')
          .insert([{ kind: 'role_template', title: tpl.key, body: hiddenBody }]);
        if (error) return alert('خطأ أثناء الحذف: ' + error.message);
      }
    }

    if (newTplForm.key === tpl.key) {
      setNewTplForm(EMPTY_TPL_FORM);
    }
    await loadRoleTemplates();
    alert('تم حذف الجروب بنجاح ✅');
  };

  const toggleBulkPolicyKey = (key) => {
    setBulkPolicyKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleBulkApplyPolicies = async () => {
    if (!requireAdminGuard()) return;
    if (bulkPolicyKeys.length === 0) return alert('اختر جروب بوليسي واحداً على الأقل');
    if (bulkSelectedIds.length === 0) return alert('اختر شخصاً واحداً على الأقل');

    setSaving(true);
    try {
      let updatedCount = 0;

      for (const uid of bulkSelectedIds) {
        const u = users.find((x) => x.id === uid);
        if (!u || u.role === 'admin') continue;

        const prevKeys = Array.isArray(u.permissions?.policy_keys) ? u.permissions.policy_keys : [];
        const finalKeys = bulkMode === 'merge'
          ? Array.from(new Set([...prevKeys, ...bulkPolicyKeys]))
          : [...bulkPolicyKeys];

        const mergedUser = buildMergedUserFromPolicies(u, finalKeys, roleTemplates, bulkMode === 'merge');

        const { error } = await supabase
          .from('church_users')
          .update({
            role: mergedUser.role,
            permissions: mergedUser.permissions
          })
          .eq('id', uid);

        if (!error) updatedCount++;
      }

      if (onRefresh) await onRefresh();
      setBulkSelectedIds([]);
      alert(`تم تطبيق الجروبات المختارة على (${updatedCount}) فرد بنجاح ✅`);
    } finally {
      setSaving(false);
    }
  };

  const selectedUserSummary = useMemo(() => {
    if (!selectedUser) return null;
    const spMap = selectedUser.permissions?.screen_permissions || {};
    const viewable = [];
    const creatable = [];
    const editable = [];
    const deletable = [];

    LOCAL_ALL_SCREENS.forEach((scrKey) => {
      const row = normalizeScreenPermRow(spMap[scrKey]);
      const name = LOCAL_SCREEN_LABELS[scrKey] || scrKey;
      if (row.view) viewable.push(name);
      if (row.create) creatable.push(name);
      if (row.edit) editable.push(name);
      if (row.delete) deletable.push(name);
    });

    return { viewable, creatable, editable, deletable };
  }, [selectedUser]);

  if (!isAdmin) {
    return (
      <div className="bg-white p-10 rounded-3xl border text-center space-y-3" dir="rtl">
        <Lock size={44} className="mx-auto text-red-600" />
        <h3 className="text-base font-black text-red-900">غير مصرح لك بتعديل الصلاحيات</h3>
        <p className="text-xs text-gray-600">
          التحكم في الصلاحيات وتحديد من يشوف ومن يعدل متاح لحساب الأدمن فقط.
        </p>
      </div>
    );
  }

  const activeUserPolicyKeys = Array.isArray(selectedUser?.permissions?.policy_keys)
    ? selectedUser.permissions.policy_keys
    : (selectedUser?.permissions?.template_key ? [selectedUser.permissions.template_key] : []);

  const selectedUserInvState = getInvitationPermissionState(selectedUser?.permissions);
  const templateFormInvState = getInvitationPermissionState({ actions: newTplForm.actions });

  return (
    <div className="space-y-4 text-xs md:text-sm" dir="rtl">
      <div className="bg-white p-4 rounded-3xl border shadow-sm space-y-3">
        <div>
          <h2 className="text-base md:text-lg font-black text-[#7a1c24] flex items-center gap-2">
            <Shield size={20} /> المركز الموحد للصلاحيات والأدوار وتعدد الجروبات (Multi-Group Policy)
          </h2>
          <p className="text-xs text-gray-500">
            إمكانية ربط الشخص بأكثر من جروب بوليسي في نفس الوقت وتطبيق فئات كاملة (مخدوم، ولي أمر، خادم، أمين خدمة، كاهن) دفعة واحدة.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setTab('users')} className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer ${tab === 'users' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <Users size={15} /> 👤 صلاحيات فرد معين
          </button>
          <button type="button" onClick={() => setTab('templates')} className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer ${tab === 'templates' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <ShieldCheck size={15} /> 🧩 قوالب Group Policy
          </button>
          <button type="button" onClick={() => setTab('roles')} className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer ${tab === 'roles' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <Layers size={15} /> 📋 الأدوار الأساسية
          </button>
          <button type="button" onClick={() => setTab('bulk')} className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer ${tab === 'bulk' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            ⚡ تعيين جماعي لعدة أفراد
          </button>
        </div>
      </div>

      {/* TAB 1: صلاحيات فرد معين */}
      {tab === 'users' && (
        <div className="grid lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 bg-white p-4 rounded-3xl border space-y-3">
            <strong className="text-[#7a1c24] block">1) اختر الشخص لتحديد جروباته وصلاحياته</strong>
            <div className="relative">
              <Search size={14} className="absolute right-3 top-3 text-gray-400" />
              <input placeholder="ابحث بالاسم أو اليوزر أو الجروب..." className="w-full pr-8 pl-3 py-2 border rounded-xl text-xs" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
            </div>
            <select className="w-full p-2 border rounded-xl text-xs bg-gray-50 font-bold" value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)}>
              <option value="all">كل الأدوار ({users.length})</option>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <div className="space-y-1.5 max-h-[560px] overflow-y-auto">
              {users
                .filter((u) => u.role !== 'admin')
                .filter((u) => userRoleFilter === 'all' || u.role === userRoleFilter)
                .filter((u) =>
                  ((u.full_name || '') + ' ' + (u.username || '') + ' ' + (u.phone || '') + ' ' + (u.permissions?.custom_role_label || ''))
                    .toLowerCase()
                    .includes(userSearch.toLowerCase())
                )
                .map((u) => {
                  const pCount = Array.isArray(u.permissions?.policy_keys) ? u.permissions.policy_keys.length : 0;
                  const uInv = getInvitationPermissionState(u.permissions);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => selectUserForEdit(u)}
                      className={`w-full text-right p-3 rounded-2xl border transition cursor-pointer flex justify-between items-center gap-2 ${
                        selectedUser?.id === u.id ? 'bg-[#f9ecee] border-[#7a1c24]' : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div>
                        <strong className="text-gray-900 block">{u.full_name}</strong>
                        <span className="text-[11px] text-gray-600 block">
                          {u.permissions?.custom_role_label || ROLE_LABELS[u.role] || u.role} • @{u.username}
                        </span>
                        {(uInv.canSend || uInv.canScan) && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded bg-purple-100 text-purple-900 text-[10px] font-black">
                            💌 دعوات: {[uInv.canSend ? 'إضافة' : '', uInv.canScan ? 'Scan' : ''].filter(Boolean).join(' + ')}
                          </span>
                        )}
                      </div>
                      <span className="px-2 py-1 bg-white border rounded-lg text-[10px] font-bold shrink-0">
                        {pCount > 1 ? `${pCount} جروبات` : (u.permissions?.can_edit ? '✏️ يعدل' : '👀 يشوف')}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="lg:col-span-8 bg-white p-5 rounded-3xl border space-y-4">
            {!selectedUser ? (
              <div className="p-12 text-center text-gray-400 space-y-2">
                <ShieldCheck size={40} className="mx-auto text-[#7a1c24]/60" />
                <strong className="block text-gray-700">اختر شخصاً من القائمة لتحديد جروباته وصلاحياته بدقة</strong>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-between items-center border-b pb-3 gap-2">
                  <div>
                    <h3 className="text-base font-black text-[#7a1c24]">صلاحيات {selectedUser.full_name}</h3>
                    <span className="text-xs text-gray-500">الدور الأساسي: {ROLE_LABELS[selectedUser.role] || selectedUser.role}</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={clearUserManualOverrides} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs cursor-pointer">
                      مطابقة الجروبات فقط
                    </button>
                    <button type="button" disabled={saving} onClick={handleSaveUserPermissions} className="px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer">
                      <Save size={15} /> {saving ? 'جاري الحفظ...' : 'حفظ صلاحيات الشخص ✅'}
                    </button>
                  </div>
                </div>

                {/* تطبيق فئة كاملة دفعة واحدة */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border space-y-2">
                  <strong className="text-slate-900 text-xs flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[#7a1c24]" /> تطبيق فئة كاملة دفعة واحدة (Select All للفئة):
                  </strong>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(CATEGORY_PRESETS)
                      .filter(([k]) => k !== 'admin')
                      .map(([k, preset]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => applyPresetToSelectedUser(k)}
                          className="px-3 py-1.5 rounded-xl border bg-white hover:bg-[#f9ecee] hover:border-[#7a1c24] text-xs font-bold cursor-pointer transition"
                        >
                          {preset.label}
                        </button>
                      ))}
                  </div>
                </div>

                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <strong className="text-amber-950 text-xs block">⚡ الجروبات / البوليسيز المرتبطة بالشخص (يمكن اختيار أكثر من جروب معاً)</strong>
                    <span className="text-[11px] font-bold text-amber-800">مختار: {activeUserPolicyKeys.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {roleTemplates.map((tpl) => {
                      const active = activeUserPolicyKeys.includes(tpl.key);
                      return (
                        <button
                          key={tpl.key}
                          type="button"
                          onClick={() => toggleUserPolicyGroup(tpl.key)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition flex items-center gap-1.5 ${
                            active ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white hover:bg-amber-100 text-amber-950'
                          }`}
                        >
                          {active ? <CheckSquare size={13} /> : <Square size={13} />}
                          {tpl.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* صندوق واضح لصلاحيات الدعوات (إضافة الدعوات + مسح QR الدعوات) */}
                <div className="bg-purple-50/70 p-3.5 rounded-2xl border-2 border-purple-200 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <strong className="text-purple-950 text-xs flex items-center gap-1.5">
                        💌 صلاحيات الدعوات (إضافة الدعوات + مسح QR الدعوات — Scan)
                      </strong>
                      <p className="text-[11px] text-purple-800 font-normal mt-0.5">
                        حدد هنا إذا كان هذا الشخص يقدر <strong>يضيف/يبعت دعوات</strong> أو يعمل لها <strong>Scan</strong> أو الاثنين معاً.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        toggleSelectedUserInvitationPerm(
                          'both',
                          !(selectedUserInvState.canSend && selectedUserInvState.canScan)
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black cursor-pointer border ${
                        selectedUserInvState.canSend && selectedUserInvState.canScan
                          ? 'bg-purple-800 text-white border-purple-800'
                          : 'bg-white text-purple-900 border-purple-300 hover:bg-purple-100'
                      }`}
                    >
                      {selectedUserInvState.canSend && selectedUserInvState.canScan
                        ? '✅ مفعّلان معاً (إضافة + Scan)'
                        : 'تفعيل الاثنين معاً (إضافة + Scan)'}
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <label className={`p-3 rounded-2xl border flex items-center justify-between gap-2 cursor-pointer font-bold ${
                      selectedUserInvState.canSend
                        ? 'bg-white border-purple-500 text-purple-950'
                        : 'bg-white/70 border-purple-200 text-gray-700'
                    }`}>
                      <span className="flex items-center gap-2 text-xs">
                        <MailPlus size={15} className="text-purple-700" />
                        ➕ إضافة / إرسال الدعوات
                      </span>
                      <input
                        type="checkbox"
                        className="w-4 h-4 cursor-pointer"
                        checked={selectedUserInvState.canSend}
                        onChange={(e) => toggleSelectedUserInvitationPerm('send', e.target.checked)}
                      />
                    </label>

                    <label className={`p-3 rounded-2xl border flex items-center justify-between gap-2 cursor-pointer font-bold ${
                      selectedUserInvState.canScan
                        ? 'bg-white border-emerald-500 text-emerald-950'
                        : 'bg-white/70 border-purple-200 text-gray-700'
                    }`}>
                      <span className="flex items-center gap-2 text-xs">
                        <QrCode size={15} className="text-emerald-700" />
                        📷 مسح QR الدعوات (Scan)
                      </span>
                      <input
                        type="checkbox"
                        className="w-4 h-4 cursor-pointer"
                        checked={selectedUserInvState.canScan}
                        onChange={(e) => toggleSelectedUserInvitationPerm('scan', e.target.checked)}
                      />
                    </label>
                  </div>
                </div>

                {selectedUserSummary && (
                  <div className="grid sm:grid-cols-3 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border text-xs">
                    <div className="bg-white p-2.5 rounded-xl border">
                      <span className="font-black text-emerald-700 flex items-center gap-1 mb-1"><Eye size={13} /> يقدر يشوف ({selectedUserSummary.viewable.length})</span>
                      <p className="text-[11px] text-gray-700 leading-relaxed">{selectedUserSummary.viewable.length > 0 ? selectedUserSummary.viewable.join('، ') : 'لا يوجد'}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border">
                      <span className="font-black text-blue-700 flex items-center gap-1 mb-1"><Plus size={13} /> يقدر يضيف ({selectedUserSummary.creatable.length})</span>
                      <p className="text-[11px] text-gray-700 leading-relaxed">{selectedUserSummary.creatable.length > 0 ? selectedUserSummary.creatable.join('، ') : 'لا يوجد'}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border">
                      <span className="font-black text-amber-700 flex items-center gap-1 mb-1"><Edit3 size={13} /> يعدل / يحذف ({selectedUserSummary.editable.length} / {selectedUserSummary.deletable.length})</span>
                      <p className="text-[11px] text-gray-700 leading-relaxed">{selectedUserSummary.editable.length > 0 ? selectedUserSummary.editable.join('، ') : 'عرض فقط'}</p>
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-2xl border">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1 font-bold">المسمى الظاهر</label>
                    <input className="w-full p-2 border rounded-xl bg-white text-xs font-bold" value={selectedUser.permissions?.custom_role_label || ''} onChange={(e) => setSelectedUser({ ...selectedUser, permissions: { ...selectedUser.permissions, custom_role_label: e.target.value } })} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1 font-bold">الدور الأساسي</label>
                    <select className="w-full p-2 border rounded-xl bg-white text-xs font-bold" value={selectedUser.role} onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}>
                      {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'admin').map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1 font-bold">الشاشة الافتراضية عند الدخول</label>
                    <select className="w-full p-2 border rounded-xl bg-white text-xs font-bold" value={selectedUser.permissions?.default_screen || ''} onChange={(e) => setSelectedUser({ ...selectedUser, permissions: { ...selectedUser.permissions, default_screen: e.target.value } })}>
                      <option value="">(حسب افتراضي الدور / الجروب)</option>
                      {LOCAL_ALL_SCREENS.map((scr) => (
                        <option key={scr} value={scr}>{LOCAL_SCREEN_LABELS[scr] || scr}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-emerald-50/40 p-3.5 rounded-2xl border border-emerald-200 space-y-2.5">
                  <strong className="text-emerald-950 block">🖥️ جدول الشاشات الفعلي للشخص (يشوف / يضيف / يعدل / يحذف)</strong>
                  <div className="overflow-x-auto bg-white rounded-2xl border max-h-96 overflow-y-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-gray-100 text-gray-800 sticky top-0">
                        <tr>
                          <th className="p-2.5">الشاشة / القسم</th>
                          <th className="p-2.5 text-center">👀 يشوف</th>
                          <th className="p-2.5 text-center">➕ يضيف</th>
                          <th className="p-2.5 text-center">✏️ يعدل</th>
                          <th className="p-2.5 text-center">🗑️ يحذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {LOCAL_ALL_SCREENS.map((scrKey) => {
                          const sp = normalizeScreenPermRow(selectedUser.permissions?.screen_permissions?.[scrKey]);
                          return (
                            <tr key={scrKey} className={sp.view ? 'bg-emerald-50/30' : ''}>
                              <td className="p-2.5 font-bold text-gray-900">{LOCAL_SCREEN_LABELS[scrKey] || scrKey}</td>
                              <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={sp.view} onChange={(e) => toggleUserScreenAction(scrKey, 'view', e.target.checked)} /></td>
                              <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={sp.create} onChange={(e) => toggleUserScreenAction(scrKey, 'create', e.target.checked)} /></td>
                              <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={sp.edit} onChange={(e) => toggleUserScreenAction(scrKey, 'edit', e.target.checked)} /></td>
                              <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={sp.delete} onChange={(e) => toggleUserScreenAction(scrKey, 'delete', e.target.checked)} /></td>
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

      {/* TAB 2: قوالب Group Policy */}
      {tab === 'templates' && (
        <div className="space-y-4">
          <form onSubmit={handleSaveRoleTemplate} className="bg-white p-5 rounded-3xl border space-y-4 font-bold">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h3 className="text-base font-black text-[#7a1c24]">
                {newTplForm.key ? `✏️ تعديل جروب Policy (${newTplForm.label})` : '➕ إنشاء جروب Policy جديد'}
              </h3>
              {newTplForm.key && (
                <button type="button" onClick={() => setNewTplForm(EMPTY_TPL_FORM)} className="px-3 py-1.5 bg-gray-100 rounded-xl text-xs cursor-pointer">+ قالب جديد</button>
              )}
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border space-y-2">
              <span className="text-xs text-slate-800 block">اختصار ملء القالب حسب الفئة:</span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(CATEGORY_PRESETS)
                  .filter(([k]) => k !== 'admin')
                  .map(([k, preset]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => applyPresetToTemplateForm(k)}
                      className="px-3 py-1.5 rounded-xl border bg-white hover:bg-[#f9ecee] hover:border-[#7a1c24] text-xs font-bold cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">اسم الصلاحية / الجروب</label>
                <input required placeholder="مثال: المخدوم / الشعب، الخدام، أمين الخدمة، أب كاهن..." className="w-full p-2.5 border rounded-xl" value={newTplForm.label} onChange={(e) => setNewTplForm({ ...newTplForm, label: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">الدور الأساسي المرتبط به</label>
                <select className="w-full p-2.5 border rounded-xl bg-white" value={newTplForm.base_role} onChange={(e) => setNewTplForm({ ...newTplForm, base_role: e.target.value })}>
                  {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'admin').map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* صندوق واضح لصلاحيات الدعوات داخل جروب الـ Policy */}
            <div className="bg-purple-50/70 p-3.5 rounded-2xl border-2 border-purple-200 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-purple-950 text-xs">
                  💌 صلاحيات الدعوات داخل الجروب (إضافة الدعوات + مسح QR الدعوات — Scan)
                </strong>
                <button
                  type="button"
                  onClick={() =>
                    toggleTemplateInvitationPerm(
                      'both',
                      !(templateFormInvState.canSend && templateFormInvState.canScan)
                    )
                  }
                  className="px-3 py-1 rounded-xl bg-white border border-purple-300 text-purple-900 text-[11px] font-black cursor-pointer"
                >
                  {templateFormInvState.canSend && templateFormInvState.canScan
                    ? '✅ مفعّلان معاً'
                    : 'تفعيل الاثنين معاً'}
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-2.5">
                <label className="p-2.5 rounded-xl bg-white border border-purple-200 flex items-center justify-between gap-2 cursor-pointer text-xs">
                  <span className="flex items-center gap-1.5">
                    <MailPlus size={14} className="text-purple-700" /> ➕ إضافة / إرسال الدعوات
                  </span>
                  <input
                    type="checkbox"
                    className="w-4 h-4 cursor-pointer"
                    checked={templateFormInvState.canSend}
                    onChange={(e) => toggleTemplateInvitationPerm('send', e.target.checked)}
                  />
                </label>

                <label className="p-2.5 rounded-xl bg-white border border-purple-200 flex items-center justify-between gap-2 cursor-pointer text-xs">
                  <span className="flex items-center gap-1.5">
                    <QrCode size={14} className="text-emerald-700" /> 📷 مسح QR الدعوات (Scan)
                  </span>
                  <input
                    type="checkbox"
                    className="w-4 h-4 cursor-pointer"
                    checked={templateFormInvState.canScan}
                    onChange={(e) => toggleTemplateInvitationPerm('scan', e.target.checked)}
                  />
                </label>
              </div>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-2xl border space-y-2">
              <strong className="block text-xs text-gray-800">الشاشات المسموحة في الجروب (يشوف / يضيف / يعدل / يحذف)</strong>
              <div className="overflow-x-auto bg-white rounded-2xl border max-h-80 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-100 text-gray-800 sticky top-0">
                    <tr>
                      <th className="p-2.5">الشاشة</th>
                      <th className="p-2.5 text-center">👀 يشوف</th>
                      <th className="p-2.5 text-center">➕ يضيف</th>
                      <th className="p-2.5 text-center">✏️ يعدل</th>
                      <th className="p-2.5 text-center">🗑️ يحذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {LOCAL_ALL_SCREENS.map((scrKey) => {
                      const sp = normalizeScreenPermRow(newTplForm.screen_permissions?.[scrKey]);
                      return (
                        <tr key={scrKey} className={sp.view ? 'bg-emerald-50/30' : ''}>
                          <td className="p-2.5 font-bold text-gray-900">{LOCAL_SCREEN_LABELS[scrKey] || scrKey}</td>
                          <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={sp.view} onChange={(e) => toggleTplScreenAction(scrKey, 'view', e.target.checked)} /></td>
                          <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={sp.create} onChange={(e) => toggleTplScreenAction(scrKey, 'create', e.target.checked)} /></td>
                          <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={sp.edit} onChange={(e) => toggleTplScreenAction(scrKey, 'edit', e.target.checked)} /></td>
                          <td className="p-2.5 text-center"><input type="checkbox" className="cursor-pointer w-4 h-4" checked={sp.delete} onChange={(e) => toggleTplScreenAction(scrKey, 'delete', e.target.checked)} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {newTplForm.key && (
              <label className="flex items-center gap-2 text-xs text-[#7a1c24] bg-red-50 p-3 rounded-xl border border-red-200 cursor-pointer">
                <input type="checkbox" checked={syncUsersOnTplSave} onChange={(e) => setSyncUsersOnTplSave(e.target.checked)} />
                🔄 تحديث صلاحيات كل الأشخاص المرتبطين بهذا الجروب تلقائياً عند الحفظ
              </label>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="submit" className="px-6 py-2.5 bg-[#7a1c24] text-white rounded-xl cursor-pointer flex items-center gap-1.5">
                <CheckCircle2 size={15} /> {newTplForm.key ? 'حفظ تعديل الجروب' : '+ إنشاء الجروب الجديد'}
              </button>
              {newTplForm.key && (
                <button type="button" onClick={() => setNewTplForm(EMPTY_TPL_FORM)} className="px-4 py-2 border rounded-xl cursor-pointer">إلغاء</button>
              )}
            </div>
          </form>

          <div className="grid md:grid-cols-2 gap-3">
            {roleTemplates.map((tpl) => {
              const membersCount = users.filter((u) => {
                const keys = Array.isArray(u.permissions?.policy_keys) ? u.permissions.policy_keys : [];
                return keys.includes(tpl.key) || u.permissions?.template_key === tpl.key;
              }).length;

              return (
                <div key={tpl.key} className="bg-white p-4 rounded-2xl border space-y-2 shadow-2xs">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <strong className="text-sm text-[#7a1c24] block">{tpl.label}</strong>
                      <span className="text-[11px] text-gray-500">الدور: {ROLE_LABELS[tpl.base_role] || tpl.base_role} • الأعضاء: {membersCount}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="تعديل"
                        onClick={() => {
                          setNewTplForm({
                            id: tpl.dbId || null,
                            key: tpl.key,
                            label: tpl.label,
                            base_role: tpl.base_role,
                            screens: tpl.screens || [],
                            screen_permissions: buildScreenPermissionsMap(tpl.screens || [], tpl.actions || {}, tpl.screen_permissions),
                            actions: { ...EMPTY_TPL_FORM.actions, ...(tpl.actions || {}) }
                          });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        title="نسخ"
                        onClick={() => {
                          setNewTplForm({
                            id: null,
                            key: '',
                            label: `${tpl.label} (نسخة)`,
                            base_role: tpl.base_role,
                            screens: tpl.screens || [],
                            screen_permissions: buildScreenPermissionsMap(tpl.screens || [], tpl.actions || {}, tpl.screen_permissions),
                            actions: { ...EMPTY_TPL_FORM.actions, ...(tpl.actions || {}) }
                          });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg cursor-pointer"
                      >
                        <Copy size={13} />
                      </button>
                      <button type="button" onClick={() => { setBulkPolicyKeys([tpl.key]); setTab('bulk'); }} className="px-2 py-1 bg-amber-50 text-amber-900 hover:bg-amber-100 rounded-lg text-[10px] font-black cursor-pointer">
                        تعيين لناس
                      </button>
                      <button type="button" title="حذف" onClick={() => handleDeleteRoleTemplate(tpl)} className="p-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg cursor-pointer">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(tpl.screens || []).map((scrKey) => (
                      <span key={scrKey} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[10px] font-bold">
                        {LOCAL_SCREEN_LABELS[scrKey] || scrKey}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: الأدوار الأساسية */}
      {tab === 'roles' && (
        <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-4">
          <div className="flex flex-wrap gap-2">
            {ROLES.filter((r) => r.key !== 'admin').map((r) => (
              <button key={r.key} type="button" onClick={() => setSelectedRole(r.key)} className={`px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer ${selectedRole === r.key ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-gray-50 text-gray-800'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {LOCAL_ALL_SCREENS.map((scr) => {
              const checked = roleAllowed.has(scr);
              const isDef = roleDefault === scr;
              return (
                <div key={scr} className={`p-3 rounded-2xl border-2 flex justify-between items-center gap-2 ${checked ? 'bg-red-50/40 border-[#7a1c24]' : 'bg-gray-50 border-gray-200'}`}>
                  <label className="flex items-center gap-2 font-bold cursor-pointer flex-1">
                    <input type="checkbox" checked={checked} onChange={() => toggleRoleScreen(scr)} />
                    <span>{LOCAL_SCREEN_LABELS[scr] || scr}</span>
                  </label>
                  {checked && (
                    <button type="button" onClick={() => setRoleDefault(scr)} className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer ${isDef ? 'bg-[#7a1c24] text-white' : 'bg-white border text-gray-600'}`}>
                      {isDef ? 'الافتراضية ⭐' : 'تعيين افتراضية'}
                    </button>
                  )}
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
          <h3 className="text-base font-black text-[#7a1c24]">⚡ تطبيق جروبات Group Policy على مجموعة أشخاص دفعة واحدة</h3>

          <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200 space-y-2">
            <span className="block text-xs text-amber-950">1) اختر الفئة / الجروب المراد تطبيقه:</span>
            <div className="flex flex-wrap gap-1.5">
              {roleTemplates.map((t) => {
                const active = bulkPolicyKeys.includes(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => toggleBulkPolicyKey(t.key)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer flex items-center gap-1 ${active ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-amber-950'}`}
                  >
                    {active ? <CheckSquare size={13} /> : <Square size={13} />}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">2) طريقة التطبيق</label>
              <select className="w-full p-2.5 border rounded-xl bg-white" value={bulkMode} onChange={(e) => setBulkMode(e.target.value)}>
                <option value="replace">تطبيق الفئة بالكامل (استبدال الصلاحيات السابقة)</option>
                <option value="merge">إضافة ودمج مع جروبات الشخص الحالية</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">3) فلترة الدور</label>
              <select className="w-full p-2.5 border rounded-xl bg-white" value={bulkRoleFilter} onChange={(e) => setBulkRoleFilter(e.target.value)}>
                <option value="all">الكل</option>
                {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'admin').map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">4) بحث</label>
              <input placeholder="ابحث بالاسم أو اليوزر..." className="w-full p-2.5 border rounded-xl" value={bulkSearch} onChange={(e) => setBulkSearch(e.target.value)} />
            </div>
          </div>

          {(() => {
            const eligibleUsers = users
              .filter((u) => u.role !== 'admin')
              .filter((u) => bulkRoleFilter === 'all' || u.role === bulkRoleFilter)
              .filter((u) => ((u.full_name || '') + ' ' + (u.username || '') + ' ' + (u.phone || '')).toLowerCase().includes(bulkSearch.toLowerCase()));
            return (
              <>
                <div className="flex flex-wrap justify-between items-center gap-2 bg-gray-50 p-3 rounded-2xl border text-xs">
                  <span>تم اختيار <strong className="text-[#7a1c24]">{bulkSelectedIds.length}</strong> من {eligibleUsers.length}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setBulkSelectedIds(eligibleUsers.map((u) => u.id))} className="px-3 py-1.5 bg-white border rounded-xl cursor-pointer">تحديد الكل</button>
                    <button type="button" onClick={() => setBulkSelectedIds([])} className="px-3 py-1.5 bg-white border rounded-xl cursor-pointer">إلغاء التحديد</button>
                    <button type="button" disabled={saving || bulkSelectedIds.length === 0} onClick={handleBulkApplyPolicies} className="px-4 py-1.5 bg-[#7a1c24] text-white rounded-xl font-black cursor-pointer disabled:opacity-50">
                      {saving ? 'جاري التطبيق...' : 'تطبيق الصلاحية ✅'}
                    </button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                  {eligibleUsers.map((u) => {
                    const checked = bulkSelectedIds.includes(u.id);
                    return (
                      <label key={u.id} className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer text-xs ${checked ? 'bg-[#f9ecee] border-[#7a1c24]' : 'bg-white hover:bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setBulkSelectedIds((prev) => (e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)))
                          }
                        />
                        <div>
                          <strong className="block text-gray-900">{u.full_name}</strong>
                          <span className="text-[11px] text-gray-500">{u.permissions?.custom_role_label || ROLE_LABELS[u.role] || u.role}</span>
                        </div>
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
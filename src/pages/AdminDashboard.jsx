import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import AdminLogsAndWaWidget from '../components/AdminLogsAndWaWidget';
import AdminChurchSettingsAndBurial from '../components/AdminChurchSettingsAndBurial';
import AdminPageDesigner from '../components/AdminPageDesigner';
import EducationalCenterManager from '../components/EducationalCenterManager';
import JosephArimatheaManager from '../components/JosephArimatheaManager';
import MasterCongregationSheet, { canExtractMasterSheet } from '../components/MasterCongregationSheet';
import { DEFAULT_SERVICE_GROUPS, normalizeGroupStages } from '../components/ServiceGroupFeed';
import NestedCardsBuilder, { loadAdminCardsConfig } from '../components/NestedCardsBuilder';
import PermissionsPage from './PermissionsPage';
import PasswordChangeButton from '../components/PasswordChangeButton';

import ChurchIdentitySettings from '../components/admin/ChurchIdentitySettings';
import AdminEventsSection from '../components/admin/AdminEventsSection';
import {
  AdminCategoriesSection,
  AdminPriestCustomCardsSection
} from '../components/admin/AdminCategoriesAndCards';
import AdminUsersSection from '../components/admin/AdminUsersSection';
import UserFormModal from '../components/admin/UserFormModal';
import TransferUsersModal from '../components/admin/TransferUsersModal';
import AdminServicesSection from '../components/admin/AdminServicesSection';

import {
  emptyUser,
  SERVANT_ROLES,
  normalizeDeaconRank,
  detectGuardianType,
  splitList
} from '../utils/churchHierarchy';
import { RefreshCw, ArrowRight, Lock, X } from 'lucide-react';

const SETUP_SUB_CARDS = ['users', 'roles_permissions', 'page_designer', 'settings', 'logs', 'nested_cards'];

export default function AdminDashboard({
  users = [], events = [], services = [], serviceGroups = [], caseCategories = [], customCards = [],
  familiesTree = [], roleScreens = [], currentUserId, currentUser = null,
  churchName = 'كنيسة السيدة العذراء مريم بالمطرية',
  onRefresh,
  onAddUser, onUpdateUser, onDeleteUser,
  onAddEvent, onUpdateEvent, onDeleteEvent,
  onAddService, onUpdateService, onDeleteService,
  onAddCategory, onUpdateCategory, onDeleteCategory,
  onAddCustomCard, onDeleteCustomCard
}) {
  const effectiveUser = currentUser || users.find(u => u.id === currentUserId) || null;
  const isAdmin = effectiveUser?.role === 'admin';
  const canExtractSheet = canExtractMasterSheet(effectiveUser);
  const todayISO = new Date().toISOString().split('T')[0];

  const [activeCard, setActiveCard] = useState('hub');
  const [servicesSubTab, setServicesSubTab] = useState('browse');
  const [nestedRootId, setNestedRootId] = useState(null);
  const [activeCustomInfoCard, setActiveCustomInfoCard] = useState(null);
  const [adminCardsConfig, setAdminCardsConfig] = useState({ rowId: null, overrides: {}, customScreenCards: [], cardMeta: {} });
  const [activeNestedRows, setActiveNestedRows] = useState([]);

  const [userSubTab, setUserSubTab] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [permTargetUserId, setPermTargetUserId] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(emptyUser);

  const [transferModal, setTransferModal] = useState({
    open: false,
    mode: 'single',
    targetKind: 'servant',
    singleUser: null,
    selectedUserIds: [],
    filterSourceService: '',
    filterSourceClass: '',
    transferAction: 'move',
    targetService: '',
    targetClasses: [],
    targetSingleClass: '',
    targetGenderScope: ''
  });

  const [priestTransferForm, setPriestTransferForm] = useState({
    fromPriestId: '',
    toPriestId: '',
    serviceName: '',
    yearFilter: '',
    classId: '',
    mode: 'by_service',
    syncPriestSupervisedServices: true
  });

  const [dbServiceGroups, setDbServiceGroups] = useState([]);
  const [roleTemplatesCount, setRoleTemplatesCount] = useState(0);

  const requireAdminGuard = () => {
    if (!isAdmin) {
      alert('🔒 غير مسموح! التعديل وإدارة الصلاحيات متاح للسوبر أدمن فقط.');
      return false;
    }
    return true;
  };

  const loadRoleTemplates = async () => {
    const { data } = await supabase
      .from('church_public_content')
      .select('id')
      .eq('kind', 'role_template');
    setRoleTemplatesCount(data?.length || 0);
  };

  const loadServiceGroups = async () => {
    const { data } = await supabase
      .from('service_groups')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (data && data.length > 0) setDbServiceGroups(data);
    else if (Array.isArray(serviceGroups) && serviceGroups.length > 0) setDbServiceGroups(serviceGroups);
    else setDbServiceGroups(DEFAULT_SERVICE_GROUPS);
  };

  const loadCardsState = async () => {
    const [cfg, nestedRes] = await Promise.all([
      loadAdminCardsConfig(),
      supabase
        .from('nested_cards')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
    ]);
    setAdminCardsConfig(cfg);
    if (!nestedRes.error) setActiveNestedRows(nestedRes.data || []);
  };

  useEffect(() => {
    loadRoleTemplates();
    loadServiceGroups();
    loadCardsState();
  }, []);

  const handleFullRefresh = async () => {
    await Promise.all([loadRoleTemplates(), loadServiceGroups(), loadCardsState()]);
    if (onRefresh) await onRefresh();
  };

  const effectiveGroups = dbServiceGroups.length > 0 ? dbServiceGroups : DEFAULT_SERVICE_GROUPS;

  const availableServantServices = [...new Set([
    ...effectiveGroups.map(g => g.group_name).filter(Boolean),
    ...services.map(s => s.stage_name).filter(Boolean)
  ])];

  const persistUserUpdate = async (updatedPayload) => {
    if (onUpdateUser) {
      await onUpdateUser(updatedPayload);
    } else {
      const { id, created_at, ...clean } = updatedPayload;
      const { error } = await supabase.from('church_users').update(clean).eq('id', id);
      if (error) throw new Error(error.message);
      if (onRefresh) await onRefresh();
    }
  };

  const persistServiceUpdate = async (updatedServicePayload) => {
    if (onUpdateService) {
      await onUpdateService(updatedServicePayload);
    } else {
      const { id, created_at, ...clean } = updatedServicePayload;
      const { error } = await supabase.from('services').update(clean).eq('id', id);
      if (error) throw new Error(error.message);
      if (onRefresh) await onRefresh();
    }
  };

  const getPriestCoverage = (priestId) => {
    const supervisedClasses = services.filter(s => s.priest_id === priestId);
    const priestObj = users.find(u => u.id === priestId);
    const explicitSupervised = Array.isArray(priestObj?.permissions?.supervised_services)
      ? priestObj.permissions.supervised_services
      : [];

    const stageNamesFromClasses = supervisedClasses.map(s => s.stage_name).filter(Boolean);
    const groupNamesFromClasses = effectiveGroups
      .filter(g => supervisedClasses.some(sc => sc.stage_name === g.group_name || normalizeGroupStages(g.stages).includes(sc.stage_name)))
      .map(g => g.group_name);

    const assignedServices = [...new Set([
      ...explicitSupervised,
      ...stageNamesFromClasses,
      ...groupNamesFromClasses
    ])];

    const unassignedServices = availableServantServices.filter(srv => !assignedServices.includes(srv));

    return { supervisedClasses, assignedServices, unassignedServices };
  };

  const parentIdsFromMembers = [...new Set(
    users.flatMap(u => [u.parent_id, u.father_id, u.mother_id].filter(Boolean))
  )];
  const priestsList = users.filter(u => u.role === 'priest');
  const servantsList = users.filter(u => SERVANT_ROLES.includes(u.role));
  const deaconsList = users.filter(u => u.is_deacon);
  const membersList = users.filter(u => u.role === 'member');
  const parentsWorkersList = users.filter(u => u.role === 'parent' || u.role === 'worker' || parentIdsFromMembers.includes(u.id));
  const assignableUsersList = users.filter(u => ['member', ...SERVANT_ROLES].includes(u.role));

  const openSingleTransferModal = (u) => {
    if (!requireAdminGuard()) return;
    const isServant = SERVANT_ROLES.includes(u.role);
    const currentStages = splitList(u.detailed_stage || u.service_stage);
    const currentClasses = splitList(u.assigned_class);
    const defaultService = currentStages[0] || availableServantServices[0] || 'أولى ابتدائي';

    setTransferModal({
      open: true,
      mode: 'single',
      targetKind: isServant ? 'servant' : 'member',
      singleUser: u,
      selectedUserIds: [u.id],
      filterSourceService: '',
      filterSourceClass: '',
      transferAction: 'move',
      targetService: defaultService,
      targetClasses: isServant ? currentClasses : [],
      targetSingleClass: !isServant ? (currentClasses[0] || '') : '',
      targetGenderScope: u.permissions?.service_gender_scope || ''
    });
  };

  const openBulkTransferModal = (kind = 'servant') => {
    if (!requireAdminGuard()) return;
    const pool = kind === 'servant'
      ? users.filter(u => SERVANT_ROLES.includes(u.role))
      : users.filter(u => u.role === 'member');
    const defaultService = availableServantServices[0] || 'أولى ابتدائي';

    setTransferModal({
      open: true,
      mode: 'bulk',
      targetKind: kind,
      singleUser: null,
      selectedUserIds: pool.length === 1 ? [pool[0].id] : [],
      filterSourceService: '',
      filterSourceClass: '',
      transferAction: 'move',
      targetService: defaultService,
      targetClasses: [],
      targetSingleClass: '',
      targetGenderScope: ''
    });
  };

  const openAdd = () => {
    if (!requireAdminGuard()) return;
    setIsEditing(false);
    const presetRole =
      userSubTab === 'priests' ? 'priest' :
      userSubTab === 'servants' ? 'servant' :
      userSubTab === 'parents' ? 'parent' : 'member';
    setFormData({
      ...emptyUser,
      role: presetRole,
      gender: 'ذكر',
      guardian_type: presetRole === 'parent' ? 'father' : '',
      family_role: presetRole === 'parent' ? 'الأب' : 'ابن/ابنة',
      member_status: 'active',
      is_deacon: userSubTab === 'deacons',
      deacon_rank: 'أبصالتس',
      permissions: { ...emptyUser.permissions }
    });
    setShowModal(true);
  };

  const openEdit = (u) => {
    if (!requireAdminGuard()) return;
    setIsEditing(true);
    const parts = (u.full_name || '').split(' ');
    const resolvedGuardianType = u.role === 'parent' ? detectGuardianType(u) : (u.guardian_type || '');

    setFormData({
      ...emptyUser,
      ...u,
      id: u.id,
      first_name: u.first_name || parts[0] || '',
      second_name: u.second_name || parts[1] || '',
      third_name: u.third_name || parts[2] || '',
      fourth_name: u.fourth_name || parts.slice(3).join(' ') || '',
      gender: u.gender || (resolvedGuardianType === 'mother' ? 'أنثى' : 'ذكر'),
      username: u.username || '',
      password: u.password || '',
      role: u.role || 'member',
      guardian_type: resolvedGuardianType,
      sector: u.sector || '',
      detailed_stage: u.detailed_stage || u.service_stage || 'أولى ابتدائي',
      assigned_class: u.assigned_class || '',
      family_role: u.role === 'parent'
        ? (resolvedGuardianType === 'mother' ? 'الأم' : 'الأب')
        : (u.family_role || 'ابن/ابنة'),
      member_status: u.member_status || 'active',
      phone: u.phone || '',
      whatsapp_sender_phone: u.whatsapp_sender_phone || '',
      can_manage_wa_templates: u.can_manage_wa_templates !== false,
      dob: u.dob || '',
      address: u.address || '',
      job_title: u.job_title || '',
      parent_id: u.parent_id || u.father_id || '',
      father_id: u.father_id || u.parent_id || '',
      mother_id: u.mother_id || '',
      family_tree_id: u.family_tree_id || '',
      confession_father_id: u.confession_father_id || '',
      father_full_name: u.father_full_name || '',
      father_phone: u.father_phone || '',
      mother_full_name: u.mother_full_name || '',
      mother_phone: u.mother_phone || '',
      is_deacon: Boolean(u.is_deacon),
      deacon_rank: normalizeDeaconRank(u.deacon_rank),
      priest_degree: u.priest_degree || 'قس',
      ordination_date: u.ordination_date || '',
      promotion_date: u.promotion_date || '',
      priest_wife_full_name: u.priest_wife_full_name || '',
      priest_wife_phone: u.priest_wife_phone || '',
      priest_family_notes: u.priest_family_notes || '',
      church_job: u.church_job || '',
      permissions: { ...emptyUser.permissions, ...(u.permissions || {}) }
    });
    setShowModal(true);
  };

  const handleSubmitUserForm = async (e) => {
    e.preventDefault();
    if (!requireAdminGuard()) return;

    if (!formData.first_name || !formData.second_name || !formData.third_name || !formData.fourth_name) {
      alert('يجب إدخال الاسم الرباعي كاملاً (الأول، الثاني، الثالث، الرابع)!');
      return;
    }

    const full_name = [
      formData.first_name,
      formData.second_name,
      formData.third_name,
      formData.fourth_name
    ].map(s => s.trim()).filter(Boolean).join(' ');

    const chosenFatherId = formData.parent_id || formData.father_id || '';
    const chosenMotherId = formData.mother_id || '';
    const isParentRole = formData.role === 'parent';
    const normalizedGuardianType = isParentRole
      ? (formData.guardian_type === 'mother' ? 'mother' : 'father')
      : (formData.guardian_type || '');

    const normalizedRank = formData.is_deacon ? normalizeDeaconRank(formData.deacon_rank) : null;

    const payload = {
      ...formData,
      gender: formData.gender || 'ذكر',
      full_name,
      guardian_type: normalizedGuardianType,
      family_role: isParentRole
        ? (normalizedGuardianType === 'mother' ? 'الأم' : 'الأب')
        : (formData.family_role || 'ابن/ابنة'),
      member_status: formData.member_status || 'active',
      service_stage: formData.detailed_stage,
      dob: formData.dob || null,
      ordination_date: formData.ordination_date || null,
      promotion_date: formData.promotion_date || null,
      parent_id: formData.role === 'member' && (chosenFatherId || chosenMotherId)
        ? (chosenFatherId || chosenMotherId)
        : null,
      father_id: formData.role === 'member' && chosenFatherId
        ? chosenFatherId
        : null,
      mother_id: formData.role === 'member' && chosenMotherId
        ? chosenMotherId
        : null,
      family_tree_id: formData.family_tree_id || null,
      confession_father_id: formData.confession_father_id || null,
      is_deacon: Boolean(formData.is_deacon),
      deacon_rank: normalizedRank,
      permissions: {
        ...emptyUser.permissions,
        ...(formData.permissions || {}),
        extra_services: splitList(formData.detailed_stage)
      }
    };

    if (isEditing) {
      await persistUserUpdate(payload);
    } else {
      if (onAddUser) await onAddUser(payload);
      else {
        const { id, created_at, ...clean } = payload;
        const { error } = await supabase.from('church_users').insert([clean]);
        if (error) return alert(error.message);
        if (onRefresh) await onRefresh();
      }
    }
    setShowModal(false);
  };

  const isSetupChildCard = SETUP_SUB_CARDS.includes(activeCard);

  const rawSetupCards = useMemo(() => [
    { id: 'users', icon: '👥', title: 'حسابات الكنيسة', desc: 'إدارة الكهنة، الخدام، الشمامسة، المخدومين، وأولياء الأمور ونقلهم فردي وجماعي', count: `${users.length} فرد`, color: 'border-red-200 bg-white' },
    { id: 'roles_permissions', icon: '🔐', title: 'الصلاحيات والأدوار', desc: 'إنشاء قوالب صلاحيات وتحديد مين يشوف ومين يعدل لكل شاشة ولكل فرد', count: `${roleTemplatesCount} قالب • موحّد`, color: 'border-emerald-300 bg-emerald-50/30' },
    { id: 'page_designer', icon: '🎨', title: 'التصميم وتعديل الصفحات', desc: 'ترتيب الأقسام، إضافة ونشر الأخبار والقداسات والرحلات والفيديوهات والكهنة والروابط', count: 'تحكم كامل', color: 'border-pink-300 bg-pink-50/30' },
    { id: 'settings', icon: '⚙️', title: 'الإعدادات وهوية الكنيسة', desc: 'تغيير اسم الكنيسة، الشعار، رفع لوجو الكنيسة وصورة السيدة العذراء، وتليفون الطوارئ', count: 'تخصيص كامل', color: 'border-amber-300 bg-amber-50/40' },
    { id: 'nested_cards', icon: '🧩', title: 'إضافة وتعديل كروت', desc: 'كروت جوا كروت + صلاحية مكان الظهور (في شاشة كذا أم جوا كارت كذا) + صلاحية الأدوار', count: `${activeNestedRows.length} كارت مضاف`, color: 'border-rose-300 bg-rose-50/30' },
    ...(isAdmin ? [{ id: 'logs', icon: '📊', title: 'سجل النشاط واللوجات والواتساب', desc: 'مين دخل ومين مدخلش، الأجهزة، مدة الجلسة، وصلاحيات الواتساب للكهنة', count: 'للأدمن فقط', color: 'border-indigo-300 bg-indigo-50/40' }] : [])
  ], [users.length, roleTemplatesCount, activeNestedRows.length, isAdmin]);

  const rawAdminCards = useMemo(() => [
    { id: 'setup_hub', icon: '🛠️', title: 'الإعدادات SETUP', desc: 'حسابات الكنيسة، الصلاحيات، التصميم، الإعدادات، إضافة وتعديل كروت، وسجل النشاط', count: `${rawSetupCards.length} كروت`, color: 'border-rose-300 bg-rose-50/40' },
    ...(canExtractSheet ? [{ id: 'master_sheet', icon: '📋', title: 'شيت التسلسل والافتقاد والترحيم', desc: 'سحب الشيت الرسمي بالترقيم التسلسلي للخدام والمخدومين والرعايا + حالة الافتقاد وذكرى الترحيم + تصدير وطباعة (أدمن / أب كاهن / أمين خدمة)', count: `${users.length} مسجل`, color: 'border-teal-300 bg-teal-50/30' }] : []),
    { id: 'events', icon: '⛪', title: 'مواعيد القداسات والاجتماعات', desc: 'إضافة وتعديل مواعيد القداسات، العشيات، والاجتماعات العامة', count: `${events.length} موعد`, color: 'border-amber-200 bg-white' },
    { id: 'services', icon: '🏫', title: 'الخدمات والاجتماعات والفصول', desc: 'تصفح متدرج بالكروت: الخدمة ← السنة الدراسية ← الفصول، مع الإضافة والتعديل والنقل من جوه الكروت', count: `${dbServiceGroups.length} خدمة • ${services.length} فصل`, color: 'border-blue-200 bg-white' },
    { id: 'edu_center', icon: '🎓', title: 'المركز التعليمي', desc: 'جدول الدروس، المراحل، المواد، الأسعار، حضور الطلاب والمدرسين، وشيت المحاسبة', count: 'إدارة الدروس', color: 'border-indigo-200 bg-white' },
    { id: 'joseph_arimathea', icon: '🕊️', title: 'خدمة يوسف الرامي', desc: 'حالات الوفاة بالليل، الطقوس التلقائية، الصناديق، خط سير السائق، ومتابعة المرافقين', count: 'خدمة المنتقلين', color: 'border-slate-300 bg-white' },
    { id: 'burial_and_caskets', icon: '⚰️', title: 'أماكن الدفن والصناديق وألحان يوسف الرامي', desc: 'جدول أماكن الدفن بالترقيم المتسلسل ورسوم الانتقال + مخزون الصناديق + ألحان يوسف الرامي وسلايدر الصوت', count: 'جداول وألحان', color: 'border-cyan-200 bg-white' },
    { id: 'categories', icon: '📂', title: 'كروت بحث الحالة', desc: 'تعديل وإضافة تصنيفات الأسر في مكتب الكاهن', count: `${caseCategories.length} تصنيف`, color: 'border-emerald-200 bg-white' },
    { id: 'custom_cards', icon: '📌', title: 'كروت إضافية للكاهن', desc: 'إنشاء كروت مخصصة تظهر داخل شاشة الأب الكاهن', count: `${customCards.length} كارت`, color: 'border-purple-200 bg-white' }
  ], [rawSetupCards.length, canExtractSheet, users.length, events.length, dbServiceGroups.length, services.length, caseCategories.length, customCards.length]);

  const isRoleAllowedForCard = (allowedRoles) => {
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0 || allowedRoles.includes('all')) return true;
    return allowedRoles.includes(effectiveUser?.role);
  };

  const countChildrenInKey = (parentKey) => {
    const metaMap = adminCardsConfig.cardMeta || {};
    const ovMap = adminCardsConfig.overrides || {};
    const nestedChildren = activeNestedRows.filter(r => {
      const pk = r.parent_id ? `nested:${r.parent_id}` : (metaMap[r.id]?.parent_key || null);
      return pk === parentKey;
    }).length;
    const builtinChildren = Object.values(ovMap).filter(ov => ov?.parent_key === parentKey && ov?.is_active !== false).length;
    return nestedChildren + builtinChildren;
  };

  const resolveScreenCards = (screenKey) => {
    const overrides = adminCardsConfig.overrides || {};
    const cardMeta = adminCardsConfig.cardMeta || {};
    const allBuiltins = [
      ...rawAdminCards.map(c => ({ ...c, defaultScreen: 'admin_hub' })),
      ...rawSetupCards.map(c => ({ ...c, defaultScreen: 'setup_hub' }))
    ];

    const builtinsForScreen = allBuiltins
      .map(c => {
        const ov = overrides[c.id] || {};
        return {
          ...c,
          title: ov.title || c.title,
          desc: ov.desc !== undefined ? ov.desc : c.desc,
          icon: ov.icon || c.icon,
          is_active: ov.is_active !== undefined ? ov.is_active : true,
          placement_screen: ov.placement_screen || c.defaultScreen,
          parent_key: ov.parent_key || null,
          allowed_roles: Array.isArray(ov.allowed_roles) && ov.allowed_roles.length > 0 ? ov.allowed_roles : ['all'],
          innerCount: countChildrenInKey(`builtin:${c.id}`)
        };
      })
      .filter(c => c.is_active !== false && !c.parent_key && c.placement_screen === screenKey && isRoleAllowedForCard(c.allowed_roles));

    const nestedForScreen = activeNestedRows
      .filter(row => {
        if (row.parent_id) return false;
        const meta = cardMeta[row.id] || {};
        if (meta.parent_key) return false;
        const targetScreen = meta.placement_screen || 'admin_hub';
        if (targetScreen !== screenKey) return false;
        return isRoleAllowedForCard(meta.allowed_roles);
      })
      .map(nc => {
        const meta = cardMeta[nc.id] || {};
        const innerCount = countChildrenInKey(`nested:${nc.id}`);
        return {
          id: `nested-root-${nc.id}`,
          icon: nc.icon || '🗂️',
          title: nc.title,
          desc: nc.description || nc.subtitle || 'كارت متداخل مخصص',
          count: nc.badge_text || (innerCount > 0 ? `${innerCount} بالداخل` : 'مخصص'),
          color: screenKey === 'setup_hub' ? 'border-amber-200 bg-amber-50/30' : 'border-indigo-200 bg-indigo-50/30',
          isNestedRoot: true,
          nestedData: nc,
          nestedMeta: meta,
          innerCount
        };
      });

    return [...builtinsForScreen, ...nestedForScreen];
  };

  const visibleAdminCards = useMemo(() => resolveScreenCards('admin_hub'), [rawAdminCards, rawSetupCards, adminCardsConfig, activeNestedRows, effectiveUser?.role]);
  const visibleSetupCards = useMemo(() => resolveScreenCards('setup_hub'), [rawAdminCards, rawSetupCards, adminCardsConfig, activeNestedRows, effectiveUser?.role]);

  const cardsInsideCurrentScreen = useMemo(() => {
    if (!activeCard || activeCard === 'hub' || activeCard === 'setup_hub' || activeCard === 'nested_cards') return [];
    const targetKey = `builtin:${activeCard}`;
    const cardMeta = adminCardsConfig.cardMeta || {};
    const overrides = adminCardsConfig.overrides || {};

    const nestedInside = activeNestedRows
      .filter(r => !r.parent_id && cardMeta[r.id]?.parent_key === targetKey && isRoleAllowedForCard(cardMeta[r.id]?.allowed_roles))
      .map(nc => ({
        id: `nested-root-${nc.id}`,
        icon: nc.icon || '🗂️',
        title: nc.title,
        desc: nc.description || nc.subtitle || '',
        isNestedRoot: true,
        nestedData: nc,
        nestedMeta: cardMeta[nc.id] || {}
      }));

    const builtinsInside = [...rawAdminCards, ...rawSetupCards]
      .filter(c => overrides[c.id]?.parent_key === targetKey && overrides[c.id]?.is_active !== false && isRoleAllowedForCard(overrides[c.id]?.allowed_roles))
      .map(c => ({
        ...c,
        title: overrides[c.id]?.title || c.title,
        icon: overrides[c.id]?.icon || c.icon,
        desc: overrides[c.id]?.desc !== undefined ? overrides[c.id].desc : c.desc
      }));

    return [...builtinsInside, ...nestedInside];
  }, [activeCard, activeNestedRows, adminCardsConfig, rawAdminCards, rawSetupCards, effectiveUser?.role]);

  const handleLaunchAdminOrSetupCard = (card) => {
    if (card.isNestedRoot && card.nestedData) {
      const nc = card.nestedData;
      const meta = card.nestedMeta || {};
      const action = meta.target_action || nc.target_action || 'children';
      if (action === 'link' && nc.target_url) { window.open(nc.target_url, '_blank', 'noopener,noreferrer'); return; }
      if (action === 'screen' && meta.target_screen) { setActiveCard(meta.target_screen); return; }
      if (action === 'info') { setActiveCustomInfoCard({ icon: nc.icon, title: nc.title, desc: nc.description || nc.subtitle }); return; }
      setNestedRootId(nc.id);
      setActiveCard('nested_cards');
      return;
    }
    if (card.id === 'users') { setUserSubTab(null); setSearchQ(''); }
    if (card.id === 'roles_permissions') { setPermTargetUserId(null); }
    if (card.id === 'nested_cards') { setNestedRootId(null); }
    setActiveCard(card.id);
  };

  const quickNavTabs = [
    { id: 'hub', label: '🏠 الإدارة' },
    { id: 'setup_hub', label: '🛠️ SETUP' },
    { id: 'users', label: '👥 الحسابات' },
    { id: 'services', label: '🏫 الخدمات' },
    { id: 'events', label: '⛪ القداسات' },
    { id: 'nested_cards', label: '🧩 الكروت' },
    { id: 'roles_permissions', label: '🔐 الصلاحيات' },
    { id: 'page_designer', label: '🎨 التصميم' },
    { id: 'settings', label: '⚙️ الهوية' }
  ];

  const renderQuickNavBar = () => (
    <div className="bg-white px-3 py-2 rounded-2xl border shadow-2xs flex items-center gap-1.5 overflow-x-auto print:hidden">
      {quickNavTabs.map(tab => {
        const isCurrent = activeCard === tab.id || (tab.id === 'setup_hub' && isSetupChildCard && !['users', 'nested_cards', 'roles_permissions', 'page_designer', 'settings'].includes(activeCard));
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              if (tab.id === 'users') { setUserSubTab(null); setSearchQ(''); }
              if (tab.id === 'roles_permissions') setPermTargetUserId(null);
              if (tab.id === 'nested_cards') setNestedRootId(null);
              setActiveCard(tab.id);
            }}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black shrink-0 transition cursor-pointer ${
              activeCard === tab.id ? 'bg-[#7a1c24] text-white shadow-2xs' : isCurrent ? 'bg-amber-100 text-amber-950' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
      {onRefresh && (
        <button type="button" onClick={handleFullRefresh} className="mr-auto px-3 py-1.5 bg-white border hover:bg-gray-50 rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer">
          <RefreshCw size={12} /> تحديث
        </button>
      )}
    </div>
  );

  const renderTopBack = (title) => (
    <div className="space-y-2 print:hidden">
      <div className="bg-white p-3.5 rounded-2xl border shadow-2xs flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => { setNestedRootId(null); setActiveCard(isSetupChildCard ? 'setup_hub' : 'hub'); }}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRight size={14} /> {isSetupChildCard ? 'رجوع لكروت الإعدادات SETUP' : 'رجوع لكروت الإدارة'}
          </button>
          {isSetupChildCard && (
            <button type="button" onClick={() => { setNestedRootId(null); setActiveCard('hub'); }} className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 rounded-xl text-xs font-black cursor-pointer">
              🏠 الرئيسية للإدارة
            </button>
          )}
          <h2 className="text-sm md:text-base font-black text-[#7a1c24]">{title}</h2>
          {!isAdmin && !canExtractSheet && (
            <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-[10px] font-black flex items-center gap-1">
              <Lock size={11} /> قراءة فقط
            </span>
          )}
        </div>
        {onRefresh && (
          <button type="button" onClick={handleFullRefresh} className="px-3 py-2 bg-white border hover:bg-gray-50 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
            <RefreshCw size={13} /> تحديث
          </button>
        )}
      </div>

      {cardsInsideCurrentScreen.length > 0 && (
        <div className="bg-amber-50/70 p-2.5 rounded-2xl border border-amber-200 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-black text-amber-950 shrink-0">🧩 كروت مضافة داخل هذا القسم:</span>
          {cardsInsideCurrentScreen.map(subC => (
            <button key={subC.id} type="button" onClick={() => handleLaunchAdminOrSetupCard(subC)} className="px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl text-[11px] font-black text-gray-900 shrink-0 flex items-center gap-1 cursor-pointer shadow-2xs">
              <span>{subC.icon}</span>
              <span>{subC.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (activeCard === 'hub' || activeCard === 'setup_hub') {
    const isSetup = activeCard === 'setup_hub';
    const cardsList = isSetup ? visibleSetupCards : visibleAdminCards;
    return (
      <div className="space-y-3">
        {renderQuickNavBar()}
        {isSetup ? (
          <div className="bg-white p-3.5 rounded-2xl border shadow-2xs flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={() => setActiveCard('hub')} className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer">
                <ArrowRight size={14} /> رجوع لكروت الإدارة
              </button>
              <h2 className="text-base font-black text-[#7a1c24]">🛠️ الإعدادات SETUP</h2>
            </div>
            {effectiveUser && <PasswordChangeButton user={effectiveUser} />}
            {onRefresh && (
              <button type="button" onClick={handleFullRefresh} className="px-3 py-2 bg-white border hover:bg-gray-50 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                <RefreshCw size={13} /> تحديث
              </button>
            )}
          </div>
        ) : (
          <div className="bg-linear-to-r from-[#5c1319] to-[#7a1c24] text-white p-4 rounded-3xl shadow flex flex-wrap justify-between items-center gap-3">
            <div>
              <h2 className="text-lg font-black text-amber-200">🛡️ لوحة الإدارة — {churchName}</h2>
              <p className="text-xs text-white/85 mt-0.5">اختر الكارت المطلوب للإدارة والتحكم الكامل</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {effectiveUser && <PasswordChangeButton user={effectiveUser} variant="hero" />}
              {isAdmin && (
                <button type="button" onClick={() => { setNestedRootId(null); setActiveCard('nested_cards'); }} className="px-3.5 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer">
                  🧩 إدارة وتعديل الكروت
                </button>
              )}
              {onRefresh && (
                <button type="button" onClick={handleFullRefresh} className="px-3.5 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                  <RefreshCw size={14} /> تحديث البيانات
                </button>
              )}
            </div>
          </div>
        )}

        <div className={isSetup ? 'max-h-[calc(100vh-230px)] overflow-y-auto pr-1' : 'max-h-[calc(100vh-250px)] overflow-y-auto pr-1'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cardsList.map(c => (
              <button key={c.id} type="button" onClick={() => handleLaunchAdminOrSetupCard(c)} className={`${c.color} border-2 p-4 rounded-2xl text-right shadow-2xs hover:shadow-md hover:border-[#7a1c24] transition flex flex-col justify-between gap-2.5 cursor-pointer`}>
                <div className="flex justify-between items-start w-full gap-1">
                  <span className="text-3xl">{c.icon}</span>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {c.innerCount > 0 && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded-full text-[10px] font-black">🧩 {c.innerCount} جواه</span>}
                    <span className="px-2.5 py-0.5 bg-[#f9ecee] text-[#7a1c24] rounded-full text-[11px] font-black">{c.count}</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">{c.title}</h3>
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{c.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {activeCustomInfoCard && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-base font-black text-gray-900">{activeCustomInfoCard.icon} {activeCustomInfoCard.title}</h3>
                <button type="button" onClick={() => setActiveCustomInfoCard(null)} className="p-1 text-gray-500 cursor-pointer"><X size={16} /></button>
              </div>
              <p className="text-gray-700 whitespace-pre-line">{activeCustomInfoCard.desc || 'لا توجد تفاصيل إضافية.'}</p>
              <div className="flex justify-end">
                <button type="button" onClick={() => setActiveCustomInfoCard(null)} className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl font-bold cursor-pointer">إغلاق</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {renderQuickNavBar()}

      <div className="max-h-[calc(100vh-195px)] overflow-y-auto pr-1 space-y-3">
        {activeCard === 'nested_cards' && (
          <div className="space-y-3">
            {renderTopBack('🧩 إضافة وتعديل كروت (كروت جوا كروت وصلاحيات الظهور)')}
            <NestedCardsBuilder
              currentUser={effectiveUser}
              isAdmin={isAdmin}
              rootParentId={nestedRootId}
              title="إدارة الكروت المتداخلة وصلاحيات الظهور"
              hubCards={rawAdminCards}
              setupCards={rawSetupCards}
              serviceGroups={effectiveGroups}
              services={services}
              caseCategories={caseCategories}
              customCards={customCards}
              priests={priestsList}
              onNavigateScreen={(screenId) => setActiveCard(screenId)}
              onExit={nestedRootId ? () => { setNestedRootId(null); setActiveCard('hub'); } : undefined}
              onRefresh={handleFullRefresh}
            />
          </div>
        )}

        {activeCard === 'master_sheet' && canExtractSheet && (
          <div className="space-y-3">
            {renderTopBack('📋 شيت التسلسل والافتقاد والترحيم')}
            <MasterCongregationSheet users={users} currentUser={effectiveUser} churchName={churchName} onUpdateUser={onUpdateUser} onRefresh={onRefresh} />
          </div>
        )}

        {activeCard === 'roles_permissions' && (
          <div className="space-y-3 text-xs md:text-sm">
            {renderTopBack('🔐 الصلاحيات والأدوار')}
            <PermissionsPage
              users={users}
              roleScreens={roleScreens}
              currentUser={effectiveUser}
              initialUserId={permTargetUserId}
              onRefresh={() => { loadRoleTemplates(); if (onRefresh) onRefresh(); }}
            />
          </div>
        )}

        {activeCard === 'page_designer' && (
          <div className="space-y-3">
            {renderTopBack('🎨 التصميم وتعديل الصفحات')}
            <AdminPageDesigner currentUser={effectiveUser} onSaved={onRefresh} />
          </div>
        )}

        {activeCard === 'users' && (
          <div className="space-y-3">
            {renderTopBack('👥 حسابات الكنيسة')}
            <AdminUsersSection
              users={users}
              priestsList={priestsList}
              servantsList={servantsList}
              deaconsList={deaconsList}
              membersList={membersList}
              parentsWorkersList={parentsWorkersList}
              parentIdsFromMembers={parentIdsFromMembers}
              userSubTab={userSubTab}
              setUserSubTab={setUserSubTab}
              searchQ={searchQ}
              setSearchQ={setSearchQ}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              getPriestCoverage={getPriestCoverage}
              onOpenAdd={openAdd}
              onOpenEdit={openEdit}
              onOpenSingleTransfer={openSingleTransferModal}
              onOpenBulkTransfer={openBulkTransferModal}
              onGoToPriestTransfer={(priestId) => {
                setPriestTransferForm(prev => ({ ...prev, fromPriestId: priestId, mode: 'replace_priest' }));
                setServicesSubTab('priest_transfer');
                setActiveCard('services');
              }}
              onGoToPermissions={(userId) => { setPermTargetUserId(userId); setActiveCard('roles_permissions'); }}
              onDeleteUser={onDeleteUser}
            />
          </div>
        )}

        {activeCard === 'events' && (
          <div className="space-y-3">
            {renderTopBack('⛪ مواعيد القداسات والاجتماعات')}
            <AdminEventsSection
              events={events}
              isAdmin={isAdmin}
              requireAdminGuard={requireAdminGuard}
              onAddEvent={onAddEvent}
              onUpdateEvent={onUpdateEvent}
              onDeleteEvent={onDeleteEvent}
            />
          </div>
        )}

        {activeCard === 'services' && (
          <div className="space-y-3">
            {renderTopBack('🏫 الخدمات والاجتماعات والسنوات الدراسية وفصولها')}
            <AdminServicesSection
              effectiveGroups={effectiveGroups}
              dbServiceGroups={dbServiceGroups}
              setDbServiceGroups={setDbServiceGroups}
              services={services}
              users={users}
              priestsList={priestsList}
              servantsList={servantsList}
              assignableUsersList={assignableUsersList}
              availableServantServices={availableServantServices}
              effectiveUser={effectiveUser}
              isAdmin={isAdmin}
              requireAdminGuard={requireAdminGuard}
              persistUserUpdate={persistUserUpdate}
              persistServiceUpdate={persistServiceUpdate}
              getPriestCoverage={getPriestCoverage}
              servicesSubTab={servicesSubTab}
              setServicesSubTab={setServicesSubTab}
              priestTransferForm={priestTransferForm}
              setPriestTransferForm={setPriestTransferForm}
              onOpenSingleTransfer={openSingleTransferModal}
              onGoToPermissions={(userId) => { setPermTargetUserId(userId); setActiveCard('roles_permissions'); }}
              onAddService={onAddService}
              onDeleteService={onDeleteService}
              onRefresh={onRefresh}
            />
          </div>
        )}

        {activeCard === 'edu_center' && (
          <div className="space-y-3">
            {renderTopBack('🎓 المركز التعليمي الكنسي')}
            <EducationalCenterManager currentUser={effectiveUser} todayISO={todayISO} />
          </div>
        )}

        {activeCard === 'joseph_arimathea' && (
          <div className="space-y-3">
            {renderTopBack('🕊️ خدمة يوسف الرامي')}
            <JosephArimatheaManager currentUser={effectiveUser} users={users} todayISO={todayISO} />
          </div>
        )}

        {activeCard === 'burial_and_caskets' && (
          <div className="space-y-3">
            {renderTopBack('⚰️ أماكن الدفن وأسعار الانتقال والصناديق وألحان يوسف الرامي')}
            <AdminChurchSettingsAndBurial currentUser={effectiveUser} />
          </div>
        )}

        {activeCard === 'categories' && (
          <div className="space-y-3">
            {renderTopBack('📂 كروت بحث الحالة')}
            <AdminCategoriesSection
              caseCategories={caseCategories}
              isAdmin={isAdmin}
              requireAdminGuard={requireAdminGuard}
              onAddCategory={onAddCategory}
              onUpdateCategory={onUpdateCategory}
              onDeleteCategory={onDeleteCategory}
            />
          </div>
        )}

        {activeCard === 'custom_cards' && (
          <div className="space-y-3">
            {renderTopBack('📌 كروت إضافية للكاهن')}
            <AdminPriestCustomCardsSection
              customCards={customCards}
              priestsList={priestsList}
              isAdmin={isAdmin}
              requireAdminGuard={requireAdminGuard}
              onAddCustomCard={onAddCustomCard}
              onDeleteCustomCard={onDeleteCustomCard}
            />
          </div>
        )}

        {activeCard === 'logs' && isAdmin && (
          <div className="space-y-3 text-xs">
            {renderTopBack('📊 سجل النشاط واللوجات والواتساب')}
            <AdminLogsAndWaWidget currentUser={effectiveUser} priests={priestsList} allUsers={users} onRefreshUsers={onRefresh} />
          </div>
        )}

        {activeCard === 'settings' && (
          <div className="space-y-3">
            {renderTopBack('⚙️ الإعدادات وهوية الكنيسة')}
            <ChurchIdentitySettings churchName={churchName} requireAdminGuard={requireAdminGuard} onRefresh={onRefresh} />
          </div>
        )}
      </div>

      {transferModal.open && isAdmin && (
        <TransferUsersModal
          transferModal={transferModal}
          setTransferModal={setTransferModal}
          users={users}
          servantsList={servantsList}
          membersList={membersList}
          availableServantServices={availableServantServices}
          effectiveGroups={effectiveGroups}
          services={services}
          persistUserUpdate={persistUserUpdate}
          requireAdminGuard={requireAdminGuard}
        />
      )}

      {showModal && isAdmin && (
        <UserFormModal
          isEditing={isEditing}
          formData={formData}
          setFormData={setFormData}
          priestsList={priestsList}
          parentsWorkersList={parentsWorkersList}
          availableServantServices={availableServantServices}
          effectiveGroups={effectiveGroups}
          services={services}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmitUserForm}
        />
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { uploadChurchMedia } from '../lib/mediaUpload';
import AdminLogsAndWaWidget from '../components/AdminLogsAndWaWidget';
import AdminChurchSettingsAndBurial from '../components/AdminChurchSettingsAndBurial';
import AdminPageDesigner from '../components/AdminPageDesigner';
import EducationalCenterManager from '../components/EducationalCenterManager';
import JosephArimatheaManager from '../components/JosephArimatheaManager';
import MasterCongregationSheet, { canExtractMasterSheet } from '../components/MasterCongregationSheet';
import ServiceGroupFeed, { DEFAULT_SERVICE_GROUPS, normalizeGroupStages } from '../components/ServiceGroupFeed';
import ServiceDrillDownCards from '../components/ServiceDrillDownCards';
import NestedCardsBuilder from '../components/NestedCardsBuilder';
import PermissionsPage from './PermissionsPage';
import {
  UserPlus, Edit3, Trash2, CalendarPlus, BookOpen,
  Search, RefreshCw, FolderEdit, Sparkles, ArrowRight,
  Users, Settings, Save, Upload, ShieldCheck, Lock, Layers, X, UserCheck, ArrowLeftRight
} from 'lucide-react';

export const DEACON_RANKS = [
  { value: 'أبصالتس', label: 'أبصالتس (مرتل)' },
  { value: 'اغنسطس', label: 'اغنسطس (قارئ)' },
  { value: 'إبصاديا', label: 'إبصاديا (مبدأ شماس)' },
  { value: 'دياكون', label: 'دياكون (شماس كامل)' },
  { value: 'أرشيدياكون', label: 'أرشيدياكون (رئيس شمامسة)' }
];

export const normalizeDeaconRank = (rank) => {
  if (!rank) return 'أبصالتس';
  const clean = String(rank).trim();
  if (clean.includes('أبصالت') || clean.includes('ابصالت') || clean.includes('مرتل')) return 'أبصالتس';
  if (clean.includes('اغنسط') || clean.includes('أغنسط') || clean.includes('قارئ')) return 'اغنسطس';
  if (clean.includes('إبصاد') || clean.includes('ابصاد') || clean.includes('مبدأ')) return 'إبصاديا';
  if (clean.includes('أرشي') || clean.includes('ارشي') || clean.includes('رئيس')) return 'أرشيدياكون';
  if (clean.includes('دياكون') || clean.includes('كامل')) return 'دياكون';
  return clean;
};

export const getDeaconRankLabel = (rank) => {
  const norm = normalizeDeaconRank(rank);
  const found = DEACON_RANKS.find(r => r.value === norm);
  return found ? found.label : (rank || 'شماس');
};

const emptyUser = {
  first_name: '', second_name: '', third_name: '', fourth_name: '',
  gender: 'ذكر',
  username: '', password: '', role: 'member', guardian_type: '',
  sector: '', detailed_stage: 'أولى ابتدائي', assigned_class: '', family_role: 'ابن/ابنة',
  member_status: 'active',
  phone: '', whatsapp_sender_phone: '', can_manage_wa_templates: true,
  dob: '', address: '', job_title: '',
  parent_id: '', father_id: '', mother_id: '', family_tree_id: '', confession_father_id: '',
  father_full_name: '', father_phone: '', mother_full_name: '', mother_phone: '',
  is_deacon: false, deacon_rank: 'أبصالتس',
  priest_degree: 'قس', ordination_date: '', promotion_date: '',
  priest_wife_full_name: '', priest_wife_phone: '', priest_family_notes: '',
  church_job: '',
  permissions: {
    custom_role_label: '',
    template_key: '',
    allowed_screens: [],
    extra_screens: [],
    screen_permissions: {},
    view_cases: false,
    view_deacons: false,
    can_view: true,
    can_add: false,
    can_edit_members: false,
    can_delete: false,
    view_parent_panel: false,
    manage_edu_center: false,
    is_edu_teacher: false,
    manage_trips: false,
    manage_joseph: false,
    can_edit_public: false,
    extra_services: [],
    supervised_services: [],
    service_gender_scope: 'الكل'
  }
};

const emptyEvent = {
  event_type: 'قداس إلهي', title: '', event_time: '',
  place: '', priest_name: '', target_stage: 'الكل'
};

const emptyService = {
  stage_name: '', academic_year: '', class_name: '', class_gender: 'عام', meeting_time: '',
  room_name: '', head_servant_name: '', vice_head_name: '', priest_id: ''
};

const emptyGroup = {
  group_name: '',
  icon: '🏫',
  gender_target: 'عام (الكل: ذكور وإناث)',
  has_classes: true,
  head_servant_name: '',
  servants_names: '',
  service_day: 'الجمعة',
  start_time: '09:00',
  end_time: '12:00',
  stagesText: '',
  sort_order: 1
};

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

const STAGE_OPTIONS = [
  'حضانة',
  'أولى ابتدائي', 'ثانية ابتدائي', 'ثالثة ابتدائي', 'رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي',
  'أولى إعدادي', 'ثانية إعدادي', 'ثالثة إعدادي',
  'أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي',
  'جامعة وخريجين',
  'حرفيين ومهنيين',
  'أصحاب معاشات',
  'اجتماع الأرامل',
  'إخوة الرب',
  'اجتماع الصدى',
  'شمامسة وألحان'
];

const SERVANT_ROLES = ['head_servant', 'vice_head_servant', 'servant', 'meeting_servant', 'mercy_servant'];
const SETUP_SUB_CARDS = ['users', 'roles_permissions', 'page_designer', 'settings', 'logs'];

const detectGuardianType = (u) => {
  if (!u) return 'father';
  if (u.guardian_type === 'mother' || u.guardian_type === 'father') return u.guardian_type;
  if (['الأم', 'أم', 'والدة'].includes(String(u.family_role || '').trim())) return 'mother';
  return 'father';
};

const splitList = (val) =>
  String(val || '')
    .split(/[,،]/)
    .map(s => s.trim())
    .filter(Boolean);

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
  const [savingTransfer, setSavingTransfer] = useState(false);

  const [priestTransferForm, setPriestTransferForm] = useState({
    fromPriestId: '',
    toPriestId: '',
    serviceName: '',
    yearFilter: '',
    classId: '',
    mode: 'by_service',
    syncPriestSupervisedServices: true
  });
  const [savingPriestTransfer, setSavingPriestTransfer] = useState(false);

  const [evForm, setEvForm] = useState(emptyEvent);
  const [editingEvId, setEditingEvId] = useState(null);

  const [srvForm, setSrvForm] = useState(emptyService);
  const [editingSrvId, setEditingSrvId] = useState(null);

  const [dbServiceGroups, setDbServiceGroups] = useState([]);
  const [grpForm, setGrpForm] = useState(emptyGroup);
  const [editingGrpId, setEditingGrpId] = useState(null);

  const [quickAssignByGroup, setQuickAssignByGroup] = useState({});
  const [assigningGroupKey, setAssigningGroupKey] = useState('');

  const [catForm, setCatForm] = useState({ name: '', icon: '📂' });
  const [editingCat, setEditingCat] = useState(null);

  const [cardForm, setCardForm] = useState({ priest_id: '', card_title: '', card_icon: '📌', description: '' });

  const [roleTemplatesCount, setRoleTemplatesCount] = useState(0);

  const [logoRowId, setLogoRowId] = useState(null);
  const [settingsRowId, setSettingsRowId] = useState(null);
  const [churchSettingsForm, setChurchSettingsForm] = useState({
    title: churchName,
    body: 'مواعيد القداسات، الرحلات، أخبار الكنيسة، والآباء الكهنة',
    url: '',
    virgin_mary_image_url: '',
    church_phone: '',
    emergency_notice: ''
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingMary, setUploadingMary] = useState(false);

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

  useEffect(() => {
    loadRoleTemplates();
    loadServiceGroups();
  }, []);

  const effectiveGroups = dbServiceGroups.length > 0 ? dbServiceGroups : DEFAULT_SERVICE_GROUPS;

  const availableServantServices = [...new Set([
    ...effectiveGroups.map(g => g.group_name).filter(Boolean),
    ...services.map(s => s.stage_name).filter(Boolean)
  ])];

  const getServiceHierarchy = (serviceName) => {
    if (!serviceName) return { years: [], ungroupedClasses: [], allClasses: [] };

    const grpObj = effectiveGroups.find(g => g.group_name === serviceName);
    const configuredYears = grpObj ? normalizeGroupStages(grpObj.stages) : [];

    const matchedDbClasses = services.filter(
      s =>
        s.stage_name === serviceName ||
        configuredYears.includes(s.stage_name) ||
        (grpObj && grpObj.group_name.includes(s.stage_name))
    );

    const inferredYears = new Set(configuredYears);
    matchedDbClasses.forEach(cls => {
      if (cls.stage_name && cls.stage_name !== serviceName && !grpObj?.group_name?.includes(cls.stage_name)) {
        inferredYears.add(cls.stage_name);
      }
      const txt = `${cls.class_name || ''} ${cls.stage_name || ''}`;
      STAGE_OPTIONS.forEach(st => {
        if (txt.includes(st)) inferredYears.add(st);
      });
      if (/kg\s*1|كي\s*جي\s*1/i.test(txt)) inferredYears.add('KG 1');
      if (/kg\s*2|كي\s*جي\s*2/i.test(txt)) inferredYears.add('KG 2');
    });

    const yearsList = [...inferredYears].filter(Boolean);

    const years = yearsList.map((yr, yIdx) => {
      const yrClasses = matchedDbClasses.filter(cls => {
        const clsStage = String(cls.stage_name || '').trim();
        const clsName = String(cls.class_name || '').trim();
        if (clsStage === yr) return true;
        if (clsName.includes(yr)) return true;
        if (/kg\s*1|كي\s*جي\s*1/i.test(yr) && /kg\s*1|كي\s*جي\s*1/i.test(`${clsStage} ${clsName}`)) return true;
        if (/kg\s*2|كي\s*جي\s*2/i.test(yr) && /kg\s*2|كي\s*جي\s*2/i.test(`${clsStage} ${clsName}`)) return true;
        return false;
      });

      const selectableOptions = yrClasses.length > 0
        ? yrClasses.map(c => ({
            id: c.id,
            label: c.class_name,
            value: c.class_name,
            isVirtual: false,
            rawClass: c
          }))
        : [{
            id: `yr-opt-${serviceName}-${yr}-${yIdx}`,
            label: `${yr} (شعبة عامة)`,
            value: yr,
            isVirtual: true,
            rawClass: null
          }];

      return {
        yearName: yr,
        dbClasses: yrClasses,
        selectableOptions
      };
    });

    const assignedClassIds = new Set(years.flatMap(y => y.dbClasses.map(c => c.id)));
    const ungroupedClasses = matchedDbClasses.filter(c => !assignedClassIds.has(c.id));

    const allClasses = [
      ...ungroupedClasses.map(c => ({
        id: c.id,
        label: c.class_name,
        value: c.class_name,
        yearName: '',
        isVirtual: false,
        rawClass: c
      })),
      ...years.flatMap(y => y.selectableOptions.map(opt => ({ ...opt, yearName: y.yearName })))
    ];

    return { years, ungroupedClasses, allClasses };
  };

  const getClassesForService = (serviceName) => getServiceHierarchy(serviceName).allClasses;

  const handleQuickAddYearFromCard = async (grp, rawYearName) => {
    if (!requireAdminGuard()) return false;
    const cleanYear = String(rawYearName || '').trim();
    if (!cleanYear) {
      alert('اكتب اسم السنة أو المرحلة الدراسية أولاً (مثال: أولى ابتدائي)');
      return false;
    }
    if (!grp?.id) {
      alert('قم بتشغيل SQL جدول service_groups أولاً حتى يتم حفظ السنوات في الداتابيز.');
      return false;
    }

    const existingStages = normalizeGroupStages(grp.stages);
    if (existingStages.includes(cleanYear)) {
      alert('هذه السنة الدراسية مضافة بالفعل داخل هذه الخدمة.');
      return false;
    }

    const nextStages = [...existingStages, cleanYear];
    const { data, error } = await supabase
      .from('service_groups')
      .update({ stages: nextStages, has_classes: true })
      .eq('id', grp.id)
      .select()
      .single();

    if (error) {
      alert('تعذر إضافة السنة الدراسية: ' + error.message);
      return false;
    }
    if (data) {
      setDbServiceGroups(dbServiceGroups.map(g => (g.id === grp.id ? data : g)));
      if (onRefresh) await onRefresh();
      return true;
    }
    return false;
  };

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

    return {
      supervisedClasses,
      assignedServices,
      unassignedServices
    };
  };

  const handlePriestServiceTransfer = async (e) => {
    e.preventDefault();
    if (!requireAdminGuard()) return;
    if (!priestTransferForm.toPriestId) {
      alert('اختر الأب الكاهن الجديد المسؤول');
      return;
    }

    setSavingPriestTransfer(true);
    try {
      let affectedClasses = [];

      if (priestTransferForm.mode === 'by_class') {
        if (!priestTransferForm.classId) {
          alert('اختر الفصل المطلوب تعديل كاهنه');
          return;
        }
        affectedClasses = services.filter(s => s.id === priestTransferForm.classId);
      } else if (priestTransferForm.mode === 'replace_priest') {
        if (!priestTransferForm.fromPriestId) {
          alert('اختر الأب الكاهن الحالي المراد نقله/استبداله');
          return;
        }
        affectedClasses = services.filter(s => s.priest_id === priestTransferForm.fromPriestId);
      } else {
        if (!priestTransferForm.serviceName) {
          alert('اختر الخدمة المطلوب نقل أو تعديل الكاهن المسؤول عنها');
          return;
        }
        const hierarchy = getServiceHierarchy(priestTransferForm.serviceName);
        let matchedDb = hierarchy.allClasses.filter(c => !c.isVirtual && c.rawClass).map(c => c.rawClass);
        if (priestTransferForm.yearFilter) {
          const yrObj = hierarchy.years.find(y => y.yearName === priestTransferForm.yearFilter);
          const yrIds = new Set((yrObj?.dbClasses || []).map(c => c.id));
          matchedDb = matchedDb.filter(
            c => yrIds.has(c.id) || String(`${c.class_name || ''} ${c.stage_name || ''}`).includes(priestTransferForm.yearFilter)
          );
        }
        affectedClasses = priestTransferForm.fromPriestId
          ? matchedDb.filter(c => c.priest_id === priestTransferForm.fromPriestId)
          : matchedDb;
      }

      for (const cls of affectedClasses) {
        await persistServiceUpdate({
          ...cls,
          priest_id: priestTransferForm.toPriestId
        });
      }

      if (priestTransferForm.syncPriestSupervisedServices) {
        const toPriest = users.find(u => u.id === priestTransferForm.toPriestId);
        if (toPriest) {
          const prevSup = Array.isArray(toPriest.permissions?.supervised_services)
            ? toPriest.permissions.supervised_services
            : [];
          const nextSup = priestTransferForm.serviceName
            ? [...new Set([...prevSup, priestTransferForm.serviceName])]
            : prevSup;

          await persistUserUpdate({
            ...toPriest,
            permissions: {
              ...(toPriest.permissions || {}),
              supervised_services: nextSup
            }
          });
        }

        if (priestTransferForm.fromPriestId && priestTransferForm.fromPriestId !== priestTransferForm.toPriestId && priestTransferForm.serviceName) {
          const fromPriest = users.find(u => u.id === priestTransferForm.fromPriestId);
          if (fromPriest) {
            const remainingForFrom = services.filter(
              s => s.priest_id === fromPriest.id &&
                !affectedClasses.some(ac => ac.id === s.id) &&
                s.stage_name === priestTransferForm.serviceName
            );
            if (remainingForFrom.length === 0) {
              const prevFromSup = Array.isArray(fromPriest.permissions?.supervised_services)
                ? fromPriest.permissions.supervised_services
                : [];
              await persistUserUpdate({
                ...fromPriest,
                permissions: {
                  ...(fromPriest.permissions || {}),
                  supervised_services: prevFromSup.filter(srv => srv !== priestTransferForm.serviceName)
                }
              });
            }
          }
        }
      }

      if (onRefresh) await onRefresh();
      alert(`تم تحديث مسؤولية الكاهن بنجاح على ${affectedClasses.length} ${affectedClasses.length === 1 ? 'فصل' : 'فصول'} ✅`);
    } catch (err) {
      alert('تعذر تحديث الكاهن: ' + err.message);
    } finally {
      setSavingPriestTransfer(false);
    }
  };

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

  const applyTransferToSingleUser = (u, cfg) => {
    const isServant = SERVANT_ROLES.includes(u.role);
    const prevStages = splitList(u.detailed_stage || u.service_stage);
    const prevClasses = splitList(u.assigned_class);
    const prevExtra = Array.isArray(u.permissions?.extra_services) ? u.permissions.extra_services : [];

    let nextStages = [...prevStages];
    let nextClasses = [...prevClasses];
    let nextExtra = [...prevExtra];

    if (isServant) {
      const chosenClasses = Array.isArray(cfg.targetClasses) ? cfg.targetClasses : [];
      if (cfg.transferAction === 'add') {
        if (cfg.targetService && !nextStages.includes(cfg.targetService)) nextStages.push(cfg.targetService);
        chosenClasses.forEach(c => {
          if (!nextClasses.includes(c)) nextClasses.push(c);
        });
      } else {
        const classesOfOldService = cfg.filterSourceService
          ? getClassesForService(cfg.filterSourceService).map(c => c.value)
          : [];
        if (cfg.filterSourceService) {
          nextStages = nextStages.filter(st => st !== cfg.filterSourceService);
          nextExtra = nextExtra.filter(st => st !== cfg.filterSourceService);
          nextClasses = nextClasses.filter(c => !classesOfOldService.includes(c));
        } else {
          nextStages = [];
          nextClasses = [];
        }
        if (cfg.targetService && !nextStages.includes(cfg.targetService)) nextStages.push(cfg.targetService);
        chosenClasses.forEach(c => {
          if (!nextClasses.includes(c)) nextClasses.push(c);
        });
      }

      if (cfg.targetService && !nextExtra.includes(cfg.targetService)) {
        nextExtra.push(cfg.targetService);
      }

      const finalStageStr = nextStages.join(', ');
      return {
        ...u,
        detailed_stage: finalStageStr,
        service_stage: finalStageStr,
        assigned_class: nextClasses.join(', '),
        permissions: {
          ...(u.permissions || {}),
          extra_services: nextExtra,
          ...(cfg.targetGenderScope ? { service_gender_scope: cfg.targetGenderScope } : {})
        }
      };
    } else {
      const newStage = cfg.targetService || u.detailed_stage || '';
      const newClass = cfg.targetSingleClass || '';
      return {
        ...u,
        detailed_stage: newStage,
        service_stage: newStage,
        assigned_class: newClass,
        permissions: {
          ...(u.permissions || {}),
          extra_services: newStage ? [newStage] : []
        }
      };
    }
  };

  const handleConfirmTransfer = async (e) => {
    e.preventDefault();
    if (!requireAdminGuard()) return;
    if (!transferModal.targetService) {
      alert('اختر الخدمة أو المرحلة الهدف أولاً');
      return;
    }

    const targets = transferModal.mode === 'single'
      ? (transferModal.singleUser ? [transferModal.singleUser] : [])
      : users.filter(u => transferModal.selectedUserIds.includes(u.id));

    if (targets.length === 0) {
      alert('اختر فرداً واحداً على الأقل للنقل');
      return;
    }

    setSavingTransfer(true);
    try {
      for (const person of targets) {
        const updated = applyTransferToSingleUser(person, transferModal);
        await persistUserUpdate(updated);
      }
      setTransferModal(prev => ({ ...prev, open: false }));
      alert(`تم نقل ${targets.length} ${targets.length === 1 ? 'فرد' : 'أفراد'} بنجاح ✅`);
    } catch (err) {
      alert('حدث خطأ أثناء النقل: ' + err.message);
    } finally {
      setSavingTransfer(false);
    }
  };

  const handleSaveServiceGroup = async (e) => {
    e.preventDefault();
    if (!requireAdminGuard()) return;
    const stagesArr = normalizeGroupStages(grpForm.stagesText);
    const payload = {
      group_name: grpForm.group_name.trim(),
      icon: grpForm.icon.trim() || (grpForm.has_classes ? '🏫' : '🕊️'),
      gender_target: grpForm.gender_target || 'عام (الكل: ذكور وإناث)',
      has_classes: Boolean(grpForm.has_classes),
      head_servant_name: grpForm.head_servant_name.trim(),
      servants_names: grpForm.servants_names.trim(),
      service_day: grpForm.service_day.trim(),
      start_time: grpForm.start_time || '',
      end_time: grpForm.end_time || '',
      stages: stagesArr,
      sort_order: Number(grpForm.sort_order || dbServiceGroups.length + 1)
    };
    if (!payload.group_name) return alert('اكتب اسم الخدمة أو الاجتماع');

    if (editingGrpId) {
      const { data, error } = await supabase.from('service_groups').update(payload).eq('id', editingGrpId).select().single();
      if (error) return alert('خطأ في التعديل: ' + error.message);
      if (data) {
        setDbServiceGroups(dbServiceGroups.map(g => (g.id === editingGrpId ? data : g)).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
        setEditingGrpId(null);
        setGrpForm({ ...emptyGroup, sort_order: dbServiceGroups.length + 1 });
        if (onRefresh) await onRefresh();
      }
    } else {
      const { data, error } = await supabase.from('service_groups').insert([payload]).select().single();
      if (error) return alert('خطأ في الإضافة (تأكد من تشغيل SQL جدول service_groups): ' + error.message);
      if (data) {
        const cleanExisting = dbServiceGroups.filter(g => g.id);
        setDbServiceGroups([...cleanExisting, data].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
        if (data.has_classes !== false) {
          setSrvForm(prev => ({
            ...prev,
            stage_name: data.group_name,
            academic_year: stagesArr[0] || ''
          }));
        }
        setGrpForm({ ...emptyGroup, sort_order: cleanExisting.length + 2 });
        if (onRefresh) await onRefresh();
      }
    }
  };

  const handleDeleteServiceGroup = async (grp) => {
    if (!requireAdminGuard()) return;
    if (!grp.id) return alert('قم بتشغيل كود SQL جدول service_groups أولاً حتى يتم الحفظ والحذف في الداتابيز.');
    if (!confirm(`حذف "${grp.group_name}"؟`)) return;
    const { error } = await supabase.from('service_groups').delete().eq('id', grp.id);
    if (!error) {
      setDbServiceGroups(dbServiceGroups.filter(g => g.id !== grp.id));
      if (onRefresh) await onRefresh();
    }
  };

  const handleToggleUserServiceAssignment = async (targetUserId, serviceName, shouldAssign = true, groupKey = '') => {
    if (!requireAdminGuard()) return;
    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser || !serviceName) return;

    const currentStages = splitList(targetUser.detailed_stage || targetUser.service_stage);
    const nextStages = shouldAssign
      ? [...new Set([...currentStages, serviceName])]
      : currentStages.filter(st => st !== serviceName);

    const nextStageString = nextStages.join(', ');
    const currentExtraServices = Array.isArray(targetUser.permissions?.extra_services)
      ? targetUser.permissions.extra_services
      : [];
    const nextExtraServices = shouldAssign
      ? [...new Set([...currentExtraServices, serviceName])]
      : currentExtraServices.filter(st => st !== serviceName);

    const updatedPayload = {
      ...targetUser,
      detailed_stage: nextStageString,
      service_stage: nextStageString || targetUser.service_stage || '',
      permissions: {
        ...(targetUser.permissions || {}),
        extra_services: nextExtraServices
      }
    };

    setAssigningGroupKey(groupKey);
    try {
      await persistUserUpdate(updatedPayload);
    } finally {
      setAssigningGroupKey('');
    }
  };

  const loadChurchIdentity = async () => {
    const [pubLogo, stRow] = await Promise.all([
      supabase.from('church_public_content').select('*').eq('kind', 'logo').limit(1).maybeSingle(),
      supabase.from('church_settings').select('*').limit(1).maybeSingle()
    ]);

    if (pubLogo.data) setLogoRowId(pubLogo.data.id);
    if (stRow.data) setSettingsRowId(stRow.data.id);

    const savedNotice = localStorage.getItem('church_emergency_notice') || '';
    const savedPhone = localStorage.getItem('church_emergency_phone') || '';

    setChurchSettingsForm({
      title: pubLogo.data?.title || stRow.data?.church_name || churchName,
      body: pubLogo.data?.body || 'مواعيد القداسات، الرحلات، أخبار الكنيسة، والآباء الكهنة',
      url: pubLogo.data?.url || stRow.data?.logo_url || '',
      virgin_mary_image_url: stRow.data?.virgin_mary_image_url || '',
      church_phone: stRow.data?.church_phone || savedPhone,
      emergency_notice: stRow.data?.emergency_notice || savedNotice
    });
  };

  useEffect(() => {
    if (activeCard === 'settings') loadChurchIdentity();
  }, [activeCard]);

  const handleUploadLogo = async (e) => {
    if (!requireAdminGuard()) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadChurchMedia(file, 'logo');
      setChurchSettingsForm(prev => ({ ...prev, url }));
    } catch (err) {
      alert('تعذر رفع اللوجو: ' + err.message);
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleUploadMaryImage = async (e) => {
    if (!requireAdminGuard()) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMary(true);
    try {
      const url = await uploadChurchMedia(file, 'virgin_mary');
      setChurchSettingsForm(prev => ({ ...prev, virgin_mary_image_url: url }));
    } catch (err) {
      alert('تعذر رفع صورة السيدة العذراء: ' + err.message);
    } finally {
      setUploadingMary(false);
      e.target.value = '';
    }
  };

  const handleSaveChurchIdentity = async (e) => {
    e.preventDefault();
    if (!requireAdminGuard()) return;
    setSavingSettings(true);
    try {
      const finalName = churchSettingsForm.title.trim() || 'كنيسة السيدة العذراء مريم بالمطرية';
      const payload = {
        kind: 'logo',
        title: finalName,
        body: churchSettingsForm.body.trim(),
        url: churchSettingsForm.url.trim(),
        sort_order: 0
      };
      if (logoRowId) {
        await supabase.from('church_public_content').update(payload).eq('id', logoRowId);
      } else {
        const { data } = await supabase.from('church_public_content').insert([payload]).select().single();
        if (data) setLogoRowId(data.id);
      }

      await supabase.from('church_settings').upsert([{
        id: settingsRowId || 1,
        church_name: finalName,
        logo_url: churchSettingsForm.url.trim(),
        virgin_mary_image_url: churchSettingsForm.virgin_mary_image_url.trim(),
        updated_at: new Date().toISOString()
      }]);

      localStorage.setItem('church_emergency_phone', churchSettingsForm.church_phone?.trim() || '');
      localStorage.setItem('church_emergency_notice', churchSettingsForm.emergency_notice?.trim() || '');

      if (onRefresh) await onRefresh();
      alert('تم حفظ اسم وهوية الكنيسة وتليفون الطوارئ واللوجو وصورة العذراء بنجاح ✅');
    } finally {
      setSavingSettings(false);
    }
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

  const getUsersBySubTab = () => {
    if (userSubTab === 'priests') return priestsList;
    if (userSubTab === 'servants') return servantsList;
    if (userSubTab === 'deacons') return deaconsList;
    if (userSubTab === 'members') return membersList;
    if (userSubTab === 'parents') return parentsWorkersList;
    if (userSubTab === 'all') return users;
    return searchQ.trim() ? users : [];
  };

  const shouldShowUsersList = Boolean(userSubTab) || searchQ.trim().length > 0;
  const filteredUsers = getUsersBySubTab().filter(u =>
    ((u.full_name || '') + ' ' + (u.username || '') + ' ' + (u.phone || '') + ' ' + (u.sector || '') + ' ' + (u.assigned_class || '') + ' ' + (u.detailed_stage || '')).toLowerCase().includes(searchQ.toLowerCase())
  );

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

  const toggleMultiFieldValue = (fieldName, value) => {
    const current = splitList(formData[fieldName]);
    const next = current.includes(value)
      ? current.filter(x => x !== value)
      : [...current, value];
    setFormData({ ...formData, [fieldName]: next.join(', ') });
  };

  const handleSubmit = async (e) => {
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

  const addButtonLabel =
    userSubTab === 'priests' ? 'إضافة كاهن' :
    userSubTab === 'servants' ? 'إضافة خادم / أمين خدمة' :
    userSubTab === 'deacons' ? 'إضافة شماس' :
    userSubTab === 'members' ? 'إضافة مخدوم' :
    userSubTab === 'parents' ? 'إضافة ولي أمر / عامل' : 'إضافة شخص جديد';

  const isSetupChildCard = SETUP_SUB_CARDS.includes(activeCard);

  const renderTopBack = (title) => (
    <div className="bg-white p-4 rounded-2xl border shadow-2xs flex flex-wrap justify-between items-center gap-2 print:hidden">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveCard(isSetupChildCard ? 'setup_hub' : 'hub')}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowRight size={15} /> {isSetupChildCard ? 'رجوع لكروت الإعدادات SETUP' : 'رجوع لكروت الإدارة'}
        </button>
        {isSetupChildCard && (
          <button
            type="button"
            onClick={() => setActiveCard('hub')}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 rounded-xl text-xs font-black cursor-pointer"
          >
            🏠 الرئيسية للإدارة
          </button>
        )}
        <h2 className="text-base md:text-lg font-black text-[#7a1c24]">{title}</h2>
        {!isAdmin && !canExtractSheet && (
          <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-[10px] font-black flex items-center gap-1">
            <Lock size={11} /> قراءة فقط
          </span>
        )}
      </div>
      {onRefresh && (
        <button type="button" onClick={onRefresh} className="px-3 py-2 bg-white border hover:bg-gray-50 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
          <RefreshCw size={13} /> تحديث
        </button>
      )}
    </div>
  );

  const setupCards = [
    {
      id: 'users',
      icon: '👥',
      title: 'حسابات الكنيسة',
      desc: 'إدارة الكهنة، الخدام، الشمامسة، المخدومين، وأولياء الأمور ونقلهم فردي وجماعي',
      count: `${users.length} فرد`,
      color: 'border-red-200 bg-white'
    },
    {
      id: 'roles_permissions',
      icon: '🔐',
      title: 'الصلاحيات والأدوار',
      desc: 'إنشاء قوالب صلاحيات وتحديد مين يشوف ومين يعدل لكل شاشة ولكل فرد',
      count: `${roleTemplatesCount} قالب • موحّد`,
      color: 'border-emerald-300 bg-emerald-50/30'
    },
    {
      id: 'page_designer',
      icon: '🎨',
      title: 'التصميم وتعديل الصفحات',
      desc: 'ترتيب الأقسام، إضافة ونشر الأخبار والقداسات والرحلات والفيديوهات والكهنة والروابط',
      count: 'تحكم كامل',
      color: 'border-pink-300 bg-pink-50/30'
    },
    {
      id: 'settings',
      icon: '⚙️',
      title: 'الإعدادات وهوية الكنيسة',
      desc: 'تغيير اسم الكنيسة، الشعار، رفع لوجو الكنيسة وصورة السيدة العذراء، وتليفون الطوارئ',
      count: 'تخصيص كامل',
      color: 'border-amber-300 bg-amber-50/40'
    },
    ...(isAdmin ? [{
      id: 'logs',
      icon: '📊',
      title: 'سجل النشاط واللوجات والواتساب',
      desc: 'مين دخل ومين مدخلش، الأجهزة، مدة الجلسة، وصلاحيات الواتساب للكهنة',
      count: 'للأدمن فقط',
      color: 'border-indigo-300 bg-indigo-50/40'
    }] : [])
  ];

  if (activeCard === 'hub') {
    const adminCards = [
      {
        id: 'setup_hub',
        icon: '🛠️',
        title: 'الإعدادات SETUP',
        desc: 'حسابات الكنيسة، الصلاحيات، التصميم، الإعدادات، وسجل النشاط',
        count: `${setupCards.length} كروت`,
        color: 'border-rose-300 bg-rose-50/40'
      },
      {
        id: 'nested_cards',
        icon: '🧩',
        title: 'كروت داخل كروت',
        desc: 'إضافة وتعديل وحذف كروت متداخلة بأي عمق مباشرة من الصفحة وحفظها في قاعدة البيانات',
        count: 'ديناميكي',
        color: 'border-rose-300 bg-white'
      },
      ...(canExtractSheet ? [{
        id: 'master_sheet',
        icon: '📋',
        title: 'شيت التسلسل والافتقاد والترحيم',
        desc: 'سحب الشيت الرسمي بالترقيم التسلسلي للخدام والمخدومين والرعايا + حالة الافتقاد وذكرى الترحيم + تصدير وطباعة (أدمن / أب كاهن / أمين خدمة)',
        count: `${users.length} مسجل`,
        color: 'border-teal-300 bg-teal-50/30'
      }] : []),
      { id: 'events', icon: '⛪', title: 'مواعيد القداسات والاجتماعات', desc: 'إضافة وتعديل مواعيد القداسات، العشيات، والاجتماعات العامة', count: `${events.length} موعد`, color: 'border-amber-200 bg-white' },
      { id: 'services', icon: '🏫', title: 'الخدمات والاجتماعات والفصول', desc: 'تصفح متدرج بالكروت: الخدمة ← السنة الدراسية ← الفصول، مع الإضافة والتعديل والنقل من جوه الكروت', count: `${dbServiceGroups.length} خدمة • ${services.length} فصل`, color: 'border-blue-200 bg-white' },
      { id: 'edu_center', icon: '🎓', title: 'المركز التعليمي', desc: 'جدول الدروس، المراحل، المواد، الأسعار، حضور الطلاب والمدرسين، وشيت المحاسبة', count: 'إدارة الدروس', color: 'border-indigo-200 bg-white' },
      { id: 'joseph_arimathea', icon: '🕊️', title: 'خدمة يوسف الرامي', desc: 'حالات الوفاة بالليل، الطقوس التلقائية، الصناديق، خط سير السائق، ومتابعة المرافقين', count: 'خدمة المنتقلين', color: 'border-slate-300 bg-white' },
      { id: 'burial_and_caskets', icon: '⚰️', title: 'أماكن الدفن والصناديق وألحان يوسف الرامي', desc: 'جدول أماكن الدفن بالترقيم المتسلسل ورسوم الانتقال + مخزون الصناديق + ألحان يوسف الرامي وسلايدر الصوت', count: 'جداول وألحان', color: 'border-cyan-200 bg-white' },
      { id: 'categories', icon: '📂', title: 'كروت بحث الحالة', desc: 'تعديل وإضافة تصنيفات الأسر في مكتب الكاهن', count: `${caseCategories.length} تصنيف`, color: 'border-emerald-200 bg-white' },
      { id: 'custom_cards', icon: '📌', title: 'كروت إضافية للكاهن', desc: 'إنشاء كروت مخصصة تظهر داخل شاشة الأب الكاهن', count: `${customCards.length} كارت`, color: 'border-purple-200 bg-white' }
    ];

    return (
      <div className="space-y-4">
        <div className="bg-linear-to-r from-[#5c1319] to-[#7a1c24] text-white p-6 rounded-3xl shadow flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-xl font-black text-amber-200">🛡️ لوحة الإدارة — {churchName}</h2>
            <p className="text-xs md:text-sm text-white/85 mt-1">اختر الكارت المطلوب للإدارة والتحكم الكامل</p>
          </div>
          {onRefresh && (
            <button type="button" onClick={onRefresh} className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
              <RefreshCw size={14} /> تحديث البيانات
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminCards.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCard(c.id)}
              className={`${c.color} border-2 p-5 rounded-3xl text-right shadow-sm hover:shadow-md hover:border-[#7a1c24] transition flex flex-col justify-between gap-3 cursor-pointer`}
            >
              <div className="flex justify-between items-start w-full">
                <span className="text-4xl">{c.icon}</span>
                <span className="px-3 py-1 bg-[#f9ecee] text-[#7a1c24] rounded-full text-xs font-black">{c.count}</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">{c.title}</h3>
                <p className="text-xs md:text-sm text-gray-600 mt-1">{c.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (activeCard === 'setup_hub') {
    return (
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-2xl border shadow-2xs flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveCard('hub')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRight size={15} /> رجوع لكروت الإدارة
            </button>
            <h2 className="text-base md:text-lg font-black text-[#7a1c24]">🛠️ الإعدادات SETUP</h2>
          </div>
          {onRefresh && (
            <button type="button" onClick={onRefresh} className="px-3 py-2 bg-white border hover:bg-gray-50 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
              <RefreshCw size={13} /> تحديث
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {setupCards.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                if (c.id === 'users') {
                  setUserSubTab(null);
                  setSearchQ('');
                }
                if (c.id === 'roles_permissions') {
                  setPermTargetUserId(null);
                }
                setActiveCard(c.id);
              }}
              className={`${c.color} border-2 p-5 rounded-3xl text-right shadow-sm hover:shadow-md hover:border-[#7a1c24] transition flex flex-col justify-between gap-3 cursor-pointer`}
            >
              <div className="flex justify-between items-start w-full">
                <span className="text-4xl">{c.icon}</span>
                <span className="px-3 py-1 bg-[#f9ecee] text-[#7a1c24] rounded-full text-xs font-black">{c.count}</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">{c.title}</h3>
                <p className="text-xs md:text-sm text-gray-600 mt-1">{c.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const groupsWithClasses = effectiveGroups.filter(g => g.has_classes !== false);
  const chosenClassServiceName = srvForm.stage_name || groupsWithClasses[0]?.group_name || '';
  const selectedClassServiceObj = groupsWithClasses.find(g => g.group_name === chosenClassServiceName);
  const selectedServiceHierarchy = getServiceHierarchy(chosenClassServiceName);
  const selectedServantTagsInForm = splitList(grpForm.servants_names);

  const allGroupStagesFlat = [...new Set([
    ...STAGE_OPTIONS,
    ...effectiveGroups.map(g => g.group_name).filter(Boolean),
    ...effectiveGroups.flatMap(g => normalizeGroupStages(g.stages)),
    ...services.map(s => s.stage_name).filter(Boolean)
  ])];
  const isServantRoleSelected = SERVANT_ROLES.includes(formData.role);
  const selectedServantStages = splitList(formData.detailed_stage);
  const selectedServantClasses = splitList(formData.assigned_class);

  const bulkPoolUsers = (transferModal.targetKind === 'servant' ? servantsList : membersList).filter(u => {
    if (transferModal.filterSourceService) {
      const stages = splitList(`${u.detailed_stage || ''} ${u.service_stage || ''}`);
      const extra = Array.isArray(u.permissions?.extra_services) ? u.permissions.extra_services : [];
      if (![...stages, ...extra].includes(transferModal.filterSourceService)) return false;
    }
    if (transferModal.filterSourceClass) {
      const classes = splitList(u.assigned_class);
      if (!classes.includes(transferModal.filterSourceClass)) return false;
    }
    return true;
  });

  const priestTransferHierarchy = getServiceHierarchy(priestTransferForm.serviceName);

  return (
    <div className="space-y-4">
      {activeCard === 'nested_cards' && (
        <div className="space-y-4">
          {renderTopBack('🧩 كروت داخل كروت')}
          <NestedCardsBuilder
            currentUser={effectiveUser}
            isAdmin={isAdmin}
            title="إدارة الكروت المتداخلة"
          />
        </div>
      )}

      {activeCard === 'master_sheet' && canExtractSheet && (
        <div className="space-y-4">
          {renderTopBack('📋 شيت التسلسل والافتقاد والترحيم')}
          <MasterCongregationSheet
            users={users}
            currentUser={effectiveUser}
            churchName={churchName}
            onUpdateUser={onUpdateUser}
            onRefresh={onRefresh}
          />
        </div>
      )}

      {activeCard === 'roles_permissions' && (
        <div className="space-y-4 text-xs md:text-sm">
          {renderTopBack('🔐 الصلاحيات والأدوار')}
          <PermissionsPage
            users={users}
            roleScreens={roleScreens}
            currentUser={effectiveUser}
            initialUserId={permTargetUserId}
            onRefresh={() => {
              loadRoleTemplates();
              if (onRefresh) onRefresh();
            }}
          />
        </div>
      )}

      {activeCard === 'page_designer' && (
        <div className="space-y-4">
          {renderTopBack('🎨 التصميم وتعديل الصفحات')}
          <AdminPageDesigner currentUser={effectiveUser} onSaved={onRefresh} />
        </div>
      )}

      {activeCard === 'users' && (
        <div className="space-y-3">
          {renderTopBack('👥 حسابات الكنيسة')}

          <div className="bg-white p-3 rounded-2xl border flex flex-wrap gap-2 text-xs font-bold shadow-2xs">
            <button onClick={() => setUserSubTab('priests')} className={`px-3.5 py-2 rounded-xl cursor-pointer ${userSubTab === 'priests' ? 'bg-[#7a1c24] text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>✝ الكهنة ({priestsList.length})</button>
            <button onClick={() => setUserSubTab('servants')} className={`px-3.5 py-2 rounded-xl cursor-pointer ${userSubTab === 'servants' ? 'bg-[#7a1c24] text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>📖 الخدام وأمناء الخدمة ({servantsList.length})</button>
            <button onClick={() => setUserSubTab('deacons')} className={`px-3.5 py-2 rounded-xl cursor-pointer ${userSubTab === 'deacons' ? 'bg-purple-800 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>🕯️ الشمامسة ({deaconsList.length})</button>
            <button onClick={() => setUserSubTab('members')} className={`px-3.5 py-2 rounded-xl cursor-pointer ${userSubTab === 'members' ? 'bg-[#7a1c24] text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>🎓 المخدومون ({membersList.length})</button>
            <button onClick={() => setUserSubTab('parents')} className={`px-3.5 py-2 rounded-xl cursor-pointer ${userSubTab === 'parents' ? 'bg-[#7a1c24] text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>👨‍👩‍👦 أولياء الأمور والشعب ({parentsWorkersList.length})</button>
            <button onClick={() => setUserSubTab('all')} className={`px-3.5 py-2 rounded-xl cursor-pointer ${userSubTab === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>📋 عرض الكل ({users.length})</button>
          </div>

          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="relative flex-1 min-w-55 text-xs">
              <Search size={15} className="absolute right-3 top-2.5 text-gray-400" />
              <input type="text" placeholder="بحث بالاسم، اليوزر، التليفون، الفصل، أو القطاع..." className="w-full pr-9 pl-3 py-2.5 bg-white border rounded-xl outline-none focus:border-[#7a1c24]" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
            </div>
            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openBulkTransferModal('servant')}
                  className="px-3.5 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-black rounded-xl flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <ArrowLeftRight size={15} /> نقل جماعي للخدام
                </button>
                <button
                  type="button"
                  onClick={() => openBulkTransferModal('member')}
                  className="px-3.5 py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-950 border border-blue-300 text-xs font-black rounded-xl flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <ArrowLeftRight size={15} /> نقل جماعي للمخدومين
                </button>
                <button onClick={openAdd} className="px-4 py-2.5 bg-[#7a1c24] text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow cursor-pointer">
                  <UserPlus size={16} /> {addButtonLabel}
                </button>
              </div>
            )}
          </div>

          {!shouldShowUsersList ? (
            <div className="bg-white p-10 rounded-3xl border text-center space-y-2">
              <Users size={36} className="mx-auto text-[#7a1c24]/70" />
              <strong className="block text-sm text-gray-800">اختر الفئة المطلوبة من الأزرار بالأعلى أو اكتب في شريط البحث</strong>
              <p className="text-xs text-gray-500">لا يتم عرض كل الحسابات دفعة واحدة للحفاظ على سرعة وخصوصية لوحة الإدارة.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredUsers.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border text-center text-xs text-gray-400">لا توجد نتائج مطابقة</div>
              ) : (
                filteredUsers.map(u => {
                  const famTree = u.family_tree_id ? familiesTree.find(f => f.id === u.family_tree_id) : null;
                  const isParentOfChild = parentIdsFromMembers.includes(u.id);
                  const guardianKind = detectGuardianType(u);
                  const canTransferUser = SERVANT_ROLES.includes(u.role) || u.role === 'member';
                  const priestCoverage = u.role === 'priest' ? getPriestCoverage(u.id) : null;
                  return (
                    <div key={u.id} className="bg-white p-4 rounded-3xl border text-xs flex flex-wrap justify-between items-center gap-3 shadow-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-sm text-gray-950">{u.full_name}</strong>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-[#7a1c24]">{u.permissions?.custom_role_label || ROLE_LABELS[u.role] || u.role}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-50 text-pink-900">
                            {u.gender === 'أنثى' ? '♀️ أنثى' : '♂️ ذكر'}
                          </span>
                          {u.role === 'parent' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-950">
                              {guardianKind === 'mother' ? '👩 الأم' : '👨 الأب'}
                            </span>
                          )}
                          {isParentOfChild && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-950">👨‍👦 ولي أمر مسجل</span>}
                          {u.role === 'priest' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">{u.priest_degree} {u.ordination_date ? `(سيامة: ${u.ordination_date})` : ''}</span>}

                          {u.is_deacon && (
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-200">
                              🕯️ شماس: {getDeaconRankLabel(u.deacon_rank)}
                            </span>
                          )}

                          {u.detailed_stage && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-900">{SERVANT_ROLES.includes(u.role) ? 'خادم' : 'مرحلة'}: {u.detailed_stage}</span>}
                          {u.permissions?.service_gender_scope && SERVANT_ROLES.includes(u.role) && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-900">نطاق: {u.permissions.service_gender_scope}</span>}
                          {u.assigned_class && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800">فصل: {u.assigned_class}</span>}
                          {u.permissions?.manage_edu_center && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-900">🎓 مدير مركز تعليمي</span>}
                          {u.permissions?.manage_trips && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900">🚌 صلاحية رحلات</span>}
                          {u.permissions?.manage_joseph && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-900">🕊️ لجنة يوسف الرامي</span>}
                          {u.permissions?.can_edit_members && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900">✏️ يقدر يعدل</span>}
                        </div>

                        {priestCoverage && (
                          <div className="text-[11px] bg-amber-50/70 border border-amber-200 px-2.5 py-1.5 rounded-xl text-amber-950 space-y-0.5">
                            <div>
                              <strong>✝ خدمات ماسكها ({priestCoverage.assignedServices.length}):</strong>{' '}
                              {priestCoverage.assignedServices.length > 0 ? priestCoverage.assignedServices.join('، ') : 'غير محدد بعد'}
                            </div>
                            <div>
                              <strong>⏳ خدمات غير ماسكها ({priestCoverage.unassignedServices.length}):</strong>{' '}
                              {priestCoverage.unassignedServices.length > 0 ? priestCoverage.unassignedServices.join('، ') : 'ماسك كل الخدمات'}
                            </div>
                          </div>
                        )}

                        <p className="text-gray-500">
                          يوزر: <code className="text-red-700 font-bold bg-red-50 px-1 rounded">{u.username}</code>
                          {u.phone && ` • 📞 ${u.phone}`}
                          {u.sector && ` • 📍 ${u.sector}`}
                          {famTree && ` • 🌳 ${famTree.family_surname}`}
                          {u.church_job && ` • 🛠️ ${u.church_job}`}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {u.role === 'priest' && (
                            <button
                              type="button"
                              onClick={() => {
                                setPriestTransferForm(prev => ({
                                  ...prev,
                                  fromPriestId: u.id,
                                  mode: 'replace_priest'
                                }));
                                setActiveCard('services');
                              }}
                              className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <ArrowLeftRight size={13} /> نقل / تعديل الكاهن
                            </button>
                          )}
                          {canTransferUser && (
                            <button
                              type="button"
                              onClick={() => openSingleTransferModal(u)}
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <ArrowLeftRight size={13} /> نقل
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setPermTargetUserId(u.id);
                              setActiveCard('roles_permissions');
                            }}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <ShieldCheck size={13} /> الصلاحيات
                          </button>
                          <button onClick={() => openEdit(u)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold flex items-center gap-1 cursor-pointer"><Edit3 size={13} /> تعديل</button>
                          {u.id !== currentUserId && (
                            <button onClick={() => onDeleteUser(u.id)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold flex items-center gap-1 cursor-pointer"><Trash2 size={13} /> حذف</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {activeCard === 'events' && (
        <div className="space-y-4 text-xs">
          {renderTopBack('⛪ مواعيد القداسات والاجتماعات')}
          {isAdmin && (
            <form onSubmit={e => { e.preventDefault(); if (!requireAdminGuard()) return; if (editingEvId) { onUpdateEvent({ ...evForm, id: editingEvId }); setEditingEvId(null); } else { onAddEvent(evForm); } setEvForm(emptyEvent); }} className="bg-white p-4 rounded-3xl border space-y-3 font-bold shadow-sm">
              <h3 className="text-sm font-extrabold flex items-center gap-1 text-[#7a1c24]"><CalendarPlus size={16} /> {editingEvId ? 'تعديل الموعد' : 'إضافة ميعاد قداس أو عشية أو اجتماع عام'}</h3>
              <div className="grid md:grid-cols-3 gap-2">
                <select className="p-2.5 border rounded-xl" value={evForm.event_type} onChange={e => setEvForm({ ...evForm, event_type: e.target.value })}>
                  <option value="قداس إلهي">قداس إلهي</option><option value="عشية وتسبحة">عشية وتسبحة</option><option value="اجتماع عام">اجتماع عام</option><option value="نهضة / مناسبة">نهضة / مناسبة</option>
                </select>
                <input required placeholder="الاسم *" className="p-2.5 border rounded-xl" value={evForm.title} onChange={e => setEvForm({ ...evForm, title: e.target.value })} />
                <input required placeholder="الموعد *" className="p-2.5 border rounded-xl" value={evForm.event_time} onChange={e => setEvForm({ ...evForm, event_time: e.target.value })} />
              </div>
              <div className="grid md:grid-cols-3 gap-2">
                <input required placeholder="المكان *" className="p-2.5 border rounded-xl" value={evForm.place} onChange={e => setEvForm({ ...evForm, place: e.target.value })} />
                <input placeholder="الأب الكاهن المصلي" className="p-2.5 border rounded-xl" value={evForm.priest_name} onChange={e => setEvForm({ ...evForm, priest_name: e.target.value })} />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-[#7a1c24] text-white rounded-xl p-2.5 shadow cursor-pointer">{editingEvId ? 'حفظ التعديل' : 'حفظ الموعد'}</button>
                  {editingEvId && <button type="button" onClick={() => { setEditingEvId(null); setEvForm(emptyEvent); }} className="px-3 border rounded-xl">إلغاء</button>}
                </div>
              </div>
            </form>
          )}
          <div className="grid gap-2">
            {events.map(ev => (
              <div key={ev.id} className="bg-white p-3.5 rounded-2xl border flex justify-between items-center shadow-2xs gap-2">
                <div><span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] ml-2">{ev.event_type}</span><strong className="text-sm text-gray-900">{ev.title}</strong><span className="text-gray-500 block mt-1">⏰ {ev.event_time} • 📍 {ev.place}</span></div>
                {isAdmin && (
                  <div className="flex gap-1.5">
                    <button onClick={() => { setEditingEvId(ev.id); setEvForm({ ...emptyEvent, ...ev }); }} className="px-2.5 py-1.5 bg-gray-100 rounded-xl font-bold flex items-center gap-1 cursor-pointer"><Edit3 size={13} /> تعديل</button>
                    <button onClick={() => onDeleteEvent(ev.id)} className="px-2.5 py-1.5 bg-red-50 text-red-700 rounded-xl font-bold flex items-center gap-1 cursor-pointer"><Trash2 size={13} /> حذف</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeCard === 'services' && (
        <div className="space-y-4 text-xs">
          {renderTopBack('🏫 الخدمات والاجتماعات والسنوات الدراسية وفصولها')}

          <ServiceDrillDownCards
            groups={effectiveGroups}
            services={services}
            users={users}
            isAdmin={isAdmin}
            onSelectService={(grp) => {
              if (!isAdmin) return;
              setSrvForm(prev => ({
                ...prev,
                stage_name: grp.group_name,
                academic_year: ''
              }));
            }}
            onSelectYear={(grp, yr) => {
              if (!isAdmin) return;
              setSrvForm(prev => ({
                ...prev,
                stage_name: grp.group_name,
                academic_year: yr.yearName || ''
              }));
            }}
            onQuickAddYear={handleQuickAddYearFromCard}
            onQuickAddClassForYear={(grp, yr) => {
              setEditingSrvId(null);
              setSrvForm({
                ...emptyService,
                stage_name: grp.group_name,
                academic_year: yr.yearName || '',
                head_servant_name: grp.head_servant_name || ''
              });
              document.getElementById('add-class-form')?.scrollIntoView({ behavior: 'smooth' });
            }}
            onEditGroup={(grp, idx) => {
              if (!grp.id) return alert('قم بتشغيل SQL جدول service_groups أولاً.');
              setEditingGrpId(grp.id);
              setGrpForm({
                group_name: grp.group_name,
                icon: grp.icon || '🏫',
                gender_target: grp.gender_target || 'عام (الكل: ذكور وإناث)',
                has_classes: grp.has_classes !== false,
                head_servant_name: grp.head_servant_name || '',
                servants_names: grp.servants_names || '',
                service_day: grp.service_day || '',
                start_time: grp.start_time || '',
                end_time: grp.end_time || '',
                stagesText: normalizeGroupStages(grp.stages).join(', '),
                sort_order: grp.sort_order || idx + 1
              });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onDeleteGroup={handleDeleteServiceGroup}
            onTransferGroupPriest={(grp) => {
              setPriestTransferForm(prev => ({
                ...prev,
                mode: 'by_service',
                serviceName: grp.group_name,
                yearFilter: ''
              }));
            }}
            onEditClass={(cls, grp, yr) => {
              setEditingSrvId(cls.id);
              setSrvForm({
                ...emptyService,
                ...cls,
                stage_name: grp?.group_name || cls.stage_name || '',
                academic_year: yr?.yearName || '',
                class_gender: 'عام'
              });
              document.getElementById('add-class-form')?.scrollIntoView({ behavior: 'smooth' });
            }}
            onDeleteClass={onDeleteService}
            onTransferClassPriest={(cls) => {
              setPriestTransferForm(prev => ({
                ...prev,
                mode: 'by_class',
                classId: cls.id,
                fromPriestId: cls.priest_id || ''
              }));
            }}
          />

          {isAdmin && (
            <div className="bg-purple-50/50 p-4 rounded-3xl border-2 border-purple-200 space-y-3 font-bold shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black flex items-center gap-1.5 text-purple-950">
                  <ArrowLeftRight size={16} /> ✝ نقل وتعديل الكاهن المسؤول عن خدمة أو سنة دراسية أو فصل
                </h3>
                <div className="flex gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPriestTransferForm(prev => ({ ...prev, mode: 'by_service' }))}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer ${priestTransferForm.mode === 'by_service' ? 'bg-purple-800 text-white' : 'bg-white border text-gray-700'}`}
                  >
                    حسب الخدمة / السنة
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriestTransferForm(prev => ({ ...prev, mode: 'by_class' }))}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer ${priestTransferForm.mode === 'by_class' ? 'bg-purple-800 text-white' : 'bg-white border text-gray-700'}`}
                  >
                    حسب فصل محدد
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriestTransferForm(prev => ({ ...prev, mode: 'replace_priest' }))}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer ${priestTransferForm.mode === 'replace_priest' ? 'bg-purple-800 text-white' : 'bg-white border text-gray-700'}`}
                  >
                    نقل كل فصول كاهن لكاهن
                  </button>
                </div>
              </div>

              <form onSubmit={handlePriestServiceTransfer} className="space-y-2.5">
                <div className="grid md:grid-cols-4 gap-2">
                  {priestTransferForm.mode === 'by_service' && (
                    <>
                      <div>
                        <label className="block text-[10px] text-gray-600 mb-0.5">① الخدمة المستهدفة *</label>
                        <select
                          className="w-full p-2.5 border rounded-xl bg-white"
                          value={priestTransferForm.serviceName}
                          onChange={e => setPriestTransferForm(prev => ({ ...prev, serviceName: e.target.value, yearFilter: '' }))}
                        >
                          <option value="">-- اختر الخدمة --</option>
                          {availableServantServices.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-600 mb-0.5">السنة الدراسية (اختياري)</label>
                        <select
                          className="w-full p-2.5 border rounded-xl bg-white"
                          value={priestTransferForm.yearFilter}
                          onChange={e => setPriestTransferForm(prev => ({ ...prev, yearFilter: e.target.value }))}
                        >
                          <option value="">-- كل سنوات الخدمة --</option>
                          {priestTransferHierarchy.years.map((yr, idx) => (
                            <option key={idx} value={yr.yearName}>{yr.yearName}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {priestTransferForm.mode === 'by_class' && (
                    <div className="md:col-span-2">
                      <label className="block text-[10px] text-gray-600 mb-0.5">① الفصل المحدد *</label>
                      <select
                        className="w-full p-2.5 border rounded-xl bg-white"
                        value={priestTransferForm.classId}
                        onChange={e => setPriestTransferForm(prev => ({ ...prev, classId: e.target.value }))}
                      >
                        <option value="">-- اختر الفصل --</option>
                        {services.map(s => <option key={s.id} value={s.id}>{s.class_name} ({s.stage_name})</option>)}
                      </select>
                    </div>
                  )}

                  {priestTransferForm.mode === 'replace_priest' && (
                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">① الكاهن الحالي المراد نقله *</label>
                      <select
                        className="w-full p-2.5 border rounded-xl bg-white"
                        value={priestTransferForm.fromPriestId}
                        onChange={e => setPriestTransferForm(prev => ({ ...prev, fromPriestId: e.target.value }))}
                      >
                        <option value="">-- اختر الكاهن الحالي --</option>
                        {priestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] text-gray-600 mb-0.5">② الأب الكاهن الجديد المسؤول *</label>
                    <select
                      required
                      className="w-full p-2.5 border rounded-xl bg-white"
                      value={priestTransferForm.toPriestId}
                      onChange={e => setPriestTransferForm(prev => ({ ...prev, toPriestId: e.target.value }))}
                    >
                      <option value="">-- اختر الأب الكاهن --</option>
                      {priestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={savingPriestTransfer}
                      className="w-full p-2.5 bg-purple-800 hover:bg-purple-900 text-white rounded-xl cursor-pointer shadow"
                    >
                      {savingPriestTransfer ? 'جاري التحديث...' : 'تطبيق نقل / تعديل الكاهن'}
                    </button>
                  </div>
                </div>

                {priestTransferForm.mode !== 'replace_priest' && (
                  <div className="max-w-xs">
                    <label className="block text-[10px] text-gray-600 mb-0.5">تصفية بكاهن سابق محدد (اختياري)</label>
                    <select
                      className="w-full p-2 border rounded-xl bg-white text-[11px]"
                      value={priestTransferForm.fromPriestId}
                      onChange={e => setPriestTransferForm(prev => ({ ...prev, fromPriestId: e.target.value }))}
                    >
                      <option value="">-- الكل --</option>
                      {priestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </div>
                )}

                <label className="flex items-center gap-2 text-[11px] text-purple-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={priestTransferForm.syncPriestSupervisedServices}
                    onChange={e => setPriestTransferForm(prev => ({ ...prev, syncPriestSupervisedServices: e.target.checked }))}
                  />
                  تحديث قائمة الخدمات المسندة للكاهن تلقائياً (اللي ماسكها واللي مش ماسكها)
                </label>

                {priestsList.length > 0 && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                    {priestsList.map(pr => {
                      const cov = getPriestCoverage(pr.id);
                      return (
                        <div key={pr.id} className="bg-white p-2.5 rounded-2xl border space-y-1 text-[11px]">
                          <div className="font-black text-gray-900">✝ {pr.full_name}</div>
                          <div className="text-emerald-900">
                            <strong>ماسك:</strong> {cov.assignedServices.length > 0 ? cov.assignedServices.join('، ') : 'لا يوجد'}
                          </div>
                          <div className="text-gray-500">
                            <strong>مش ماسك:</strong> {cov.unassignedServices.length > 0 ? cov.unassignedServices.join('، ') : 'ماسك الكل'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </form>
            </div>
          )}

          {isAdmin && (
            <div className="bg-amber-50/50 p-4 rounded-3xl border-2 border-amber-300 space-y-3 font-bold shadow-sm">
              <h3 className="text-sm font-extrabold flex items-center gap-1.5 text-[#7a1c24]">
                <Layers size={16} /> {editingGrpId ? '✏️ تعديل الخدمة / الاجتماع' : '① أولاً: إضافة خدمة أو اجتماع والسنوات الدراسية التابعة لها'}
              </h3>
              <form onSubmit={handleSaveServiceGroup} className="space-y-3">
                <div className="grid md:grid-cols-4 gap-2">
                  <input
                    required
                    placeholder="اسم الخدمة (مثال: خدمة ابتدائي / حضانة / شعب عام) *"
                    className="md:col-span-2 p-2.5 border rounded-xl bg-white"
                    value={grpForm.group_name}
                    onChange={e => setGrpForm({ ...grpForm, group_name: e.target.value })}
                  />
                  <select
                    className="p-2.5 border rounded-xl bg-white"
                    value={grpForm.has_classes ? 'yes' : 'no'}
                    onChange={e => {
                      const hasCls = e.target.value === 'yes';
                      setGrpForm({
                        ...grpForm,
                        has_classes: hasCls,
                        icon: hasCls ? '🏫' : '🕊️',
                        gender_target: !hasCls ? 'عام (الكل: ذكور وإناث)' : grpForm.gender_target
                      });
                    }}
                  >
                    <option value="yes">📚 خدمة لها سنوات / فصول بداخلها</option>
                    <option value="no">🕊️ اجتماع عام / خدمة بدون فصول</option>
                  </select>
                  <select
                    className="p-2.5 border rounded-xl bg-white"
                    value={grpForm.gender_target || 'عام (الكل: ذكور وإناث)'}
                    onChange={e => setGrpForm({ ...grpForm, gender_target: e.target.value })}
                  >
                    <option value="عام (الكل: ذكور وإناث)">👥 عام (الكل: ذكور وإناث)</option>
                    <option value="ذكور / بنين فقط">♂️ ذكور / بنين فقط</option>
                    <option value="إناث / بنات فقط">♀️ إناث / بنات فقط</option>
                    <option value="أطفال (بنين وبنات)">🧸 أطفال (بنين وبنات)</option>
                    <option value="مقسمة (بنين / بنات)">⚖️ مقسمة (بنين / بنات)</option>
                  </select>
                </div>

                <div className="grid md:grid-cols-2 gap-2 bg-white p-3 rounded-2xl border">
                  <div>
                    <label className="block text-[10px] text-gray-600 mb-1">⭐ أمين الخدمة / المسؤول (اختيار أو كتابة):</label>
                    <div className="flex gap-1.5">
                      <select
                        className="p-2 border rounded-xl bg-gray-50 text-[11px] max-w-40"
                        value=""
                        onChange={e => { if (e.target.value) setGrpForm({ ...grpForm, head_servant_name: e.target.value }); }}
                      >
                        <option value="">-- اختر أمين --</option>
                        {servantsList.map(sv => <option key={sv.id} value={sv.full_name}>{sv.full_name}</option>)}
                      </select>
                      <input
                        placeholder="اسم أمين الخدمة..."
                        className="flex-1 p-2 border rounded-xl bg-white"
                        value={grpForm.head_servant_name || ''}
                        onChange={e => setGrpForm({ ...grpForm, head_servant_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-gray-600">👥 الخدام بالخدمة (اختيار متعدد أو كتابة):</label>
                    <div className="flex gap-1.5">
                      <select
                        className="p-2 border rounded-xl bg-gray-50 text-[11px] max-w-40"
                        value=""
                        onChange={e => {
                          const v = e.target.value;
                          if (!v) return;
                          const cur = splitList(grpForm.servants_names);
                          if (!cur.includes(v)) setGrpForm({ ...grpForm, servants_names: [...cur, v].join(', ') });
                        }}
                      >
                        <option value="">+ إضافة خادم --</option>
                        {servantsList.map(sv => <option key={sv.id} value={sv.full_name}>{sv.full_name}</option>)}
                      </select>
                      <input
                        placeholder="أسماء الخدام (مفصولة بفاصلة)..."
                        className="flex-1 p-2 border rounded-xl bg-white"
                        value={grpForm.servants_names || ''}
                        onChange={e => setGrpForm({ ...grpForm, servants_names: e.target.value })}
                      />
                    </div>
                    {selectedServantTagsInForm.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {selectedServantTagsInForm.map((name, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-950 rounded-lg text-[10px]">
                            {name}
                            <button
                              type="button"
                              onClick={() => setGrpForm({ ...grpForm, servants_names: selectedServantTagsInForm.filter((_, idx) => idx !== i).join(', ') })}
                              className="text-red-700 hover:text-red-900 cursor-pointer"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-600 mb-0.5">يوم الخدمة / الاجتماع</label>
                    <input
                      placeholder="مثال: الجمعة"
                      className="w-full p-2 border rounded-xl bg-white"
                      value={grpForm.service_day || ''}
                      onChange={e => setGrpForm({ ...grpForm, service_day: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-600 mb-0.5">من الساعة</label>
                    <input
                      type="time"
                      className="w-full p-2 border rounded-xl bg-white"
                      value={grpForm.start_time || ''}
                      onChange={e => setGrpForm({ ...grpForm, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-600 mb-0.5">إلى الساعة</label>
                    <input
                      type="time"
                      className="w-full p-2 border rounded-xl bg-white"
                      value={grpForm.end_time || ''}
                      onChange={e => setGrpForm({ ...grpForm, end_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-600 mb-0.5">الأيقونة</label>
                    <input
                      placeholder="🏫"
                      className="w-full p-2 border rounded-xl bg-white text-center"
                      value={grpForm.icon}
                      onChange={e => setGrpForm({ ...grpForm, icon: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-600 mb-0.5">الترتيب</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full p-2 border rounded-xl bg-white text-center"
                      value={grpForm.sort_order}
                      onChange={e => setGrpForm({ ...grpForm, sort_order: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    placeholder="السنوات الدراسية أو المراحل الفرعية جوه الخدمة (مثال: أولى ابتدائي, ثانية ابتدائي أو KG 1, KG 2)"
                    className="flex-1 min-w-55 p-2.5 border rounded-xl bg-white font-normal"
                    value={grpForm.stagesText}
                    onChange={e => setGrpForm({ ...grpForm, stagesText: e.target.value })}
                  />
                  <button type="submit" className="px-5 py-2.5 bg-[#7a1c24] text-white rounded-xl cursor-pointer shadow">
                    {editingGrpId ? 'حفظ التعديل' : '+ حفظ الخدمة / الاجتماع'}
                  </button>
                  {editingGrpId && (
                    <button
                      type="button"
                      onClick={() => { setEditingGrpId(null); setGrpForm({ ...emptyGroup, sort_order: effectiveGroups.length + 1 }); }}
                      className="px-4 py-2 border rounded-xl bg-white"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {isAdmin && (
            <form
              id="add-class-form"
              onSubmit={e => {
                e.preventDefault();
                if (!requireAdminGuard()) return;
                const chosenServiceName = srvForm.stage_name || groupsWithClasses[0]?.group_name || '';
                if (!chosenServiceName) return alert('أضف أولاً خدمة لها فصول ثم اخترها هنا');

                const yearTag = String(srvForm.academic_year || '').trim();
                const baseClassName = String(srvForm.class_name || '').trim();
                const fullClassTitle = yearTag && !baseClassName.includes(yearTag)
                  ? `${yearTag} - ${baseClassName}`
                  : baseClassName;

                const finalClassName =
                  srvForm.class_gender && srvForm.class_gender !== 'عام' && !fullClassTitle.includes(srvForm.class_gender)
                    ? `${fullClassTitle} (${srvForm.class_gender})`
                    : fullClassTitle;

                const { class_gender, academic_year, ...cleanSrv } = srvForm;
                const payload = {
                  ...cleanSrv,
                  class_name: finalClassName,
                  stage_name: yearTag || chosenServiceName,
                  priest_id: srvForm.priest_id || null
                };
                if (editingSrvId) { onUpdateService({ ...payload, id: editingSrvId }); setEditingSrvId(null); }
                else { onAddService(payload); }
                setSrvForm({ ...emptyService, stage_name: chosenServiceName, academic_year: yearTag });
              }}
              className="bg-white p-4 rounded-3xl border space-y-3 font-bold shadow-sm"
            >
              <h3 className="text-sm font-extrabold flex items-center gap-1 text-[#7a1c24]">
                <BookOpen size={16} /> {editingSrvId ? '✏️ تعديل الفصل' : '② ثانياً: إضافة فصل (باسم قديس مثلاً) وربطه بالخدمة والسنة الدراسية'}
              </h3>
              <div className="grid md:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-600 mb-0.5">① الخدمة *</label>
                  <select
                    required
                    className="w-full p-2.5 border rounded-xl bg-amber-50/50"
                    value={chosenClassServiceName}
                    onChange={e => setSrvForm({ ...srvForm, stage_name: e.target.value, academic_year: '' })}
                  >
                    <option value="">-- اختر الخدمة * --</option>
                    {groupsWithClasses.map((g, i) => (
                      <option key={g.id || i} value={g.group_name}>
                        {g.icon || '🏫'} {g.group_name} ({g.gender_target || 'عام'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-600 mb-0.5">② العام الدراسي / المرحلة الفرعية</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white"
                    value={srvForm.academic_year || ''}
                    onChange={e => setSrvForm({ ...srvForm, academic_year: e.target.value })}
                  >
                    <option value="">-- عام / بدون سنة محددة --</option>
                    {selectedServiceHierarchy.years.map((yr, yIdx) => (
                      <option key={yIdx} value={yr.yearName}>{yr.yearName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-600 mb-0.5">③ اسم الفصل (قديس أو فصل) *</label>
                  <input
                    required
                    placeholder="مثال: فصل مارمينا / مارجرجس *"
                    className="w-full p-2.5 border rounded-xl"
                    value={srvForm.class_name}
                    onChange={e => setSrvForm({ ...srvForm, class_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-600 mb-0.5">نوع الفصل والأب الكاهن</label>
                  <div className="flex gap-1.5">
                    <select
                      className="p-2.5 border rounded-xl bg-white"
                      value={srvForm.class_gender || 'عام'}
                      onChange={e => setSrvForm({ ...srvForm, class_gender: e.target.value })}
                    >
                      <option value="عام">👥 عام</option>
                      <option value="بنين">♂️ بنين</option>
                      <option value="بنات">♀️ بنات</option>
                    </select>
                    <select className="flex-1 p-2.5 border rounded-xl bg-amber-50/40" value={srvForm.priest_id || ''} onChange={e => setSrvForm({ ...srvForm, priest_id: e.target.value })}>
                      <option value="">-- الكاهن --</option>
                      {priestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {selectedClassServiceObj?.gender_target?.includes('متقسمة') && (
                <p className="text-[11px] text-amber-900 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                  💡 الخدمة المختارة ({selectedClassServiceObj.group_name}) مقسّمة — حدد من القائمة هل الفصل ده **بنين** أم **بنات**.
                </p>
              )}

              <div className="grid md:grid-cols-4 gap-2">
                <input placeholder="أمين الفصل / الخدمة" className="p-2.5 border rounded-xl" value={srvForm.head_servant_name} onChange={e => setSrvForm({ ...srvForm, head_servant_name: e.target.value })} />
                <input placeholder="مساعد / خدام الفصل" className="p-2.5 border rounded-xl" value={srvForm.vice_head_name} onChange={e => setSrvForm({ ...srvForm, vice_head_name: e.target.value })} />
                <input placeholder="ميعاد وقاعة الفصل" className="p-2.5 border rounded-xl" value={srvForm.meeting_time} onChange={e => setSrvForm({ ...srvForm, meeting_time: e.target.value })} />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-[#7a1c24] text-white rounded-xl p-2.5 shadow cursor-pointer">{editingSrvId ? 'حفظ التعديل' : 'حفظ الفصل للخدمة'}</button>
                  {editingSrvId && <button type="button" onClick={() => { setEditingSrvId(null); setSrvForm(emptyService); }} className="px-3 border rounded-xl">إلغاء</button>}
                </div>
              </div>
            </form>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {effectiveGroups.map((grp, idx) => {
              const groupKey = String(grp.id || grp.group_name || idx);
              const hierarchy = getServiceHierarchy(grp.group_name);
              const stagesArr = hierarchy.years.map(y => y.yearName);
              const subScopeOptions = [...new Set([grp.group_name, ...stagesArr, ...hierarchy.allClasses.map(c => c.value)].filter(Boolean))];
              const selectedQuickScope = quickAssignByGroup[groupKey]?.scope || grp.group_name;
              const selectedQuickUserId = quickAssignByGroup[groupKey]?.userId || '';

              const linkedUsersForGroup = assignableUsersList.filter(u => {
                const uStages = splitList(`${u.detailed_stage || ''} ${u.service_stage || ''}`);
                const uExtra = Array.isArray(u.permissions?.extra_services) ? u.permissions.extra_services : [];
                const combined = [...uStages, ...uExtra];
                return subScopeOptions.some(opt => combined.includes(opt) || combined.some(item => item.includes(opt)));
              });

              const classesInThisService = hierarchy.allClasses.filter(c => !c.isVirtual && c.rawClass).map(c => c.rawClass);

              const priestsInThisService = [...new Set(
                classesInThisService.map(c => c.priest_id).filter(Boolean)
              )].map(pid => priestsList.find(p => p.id === pid)).filter(Boolean);

              return (
                <div key={groupKey} className="bg-white p-4 rounded-3xl border-2 border-gray-200 space-y-3 shadow-2xs">
                  <div className="flex flex-wrap justify-between items-start gap-2 border-b pb-2.5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xl">{grp.icon || (grp.has_classes !== false ? '🏫' : '🕊️')}</span>
                        <strong className="text-sm text-[#7a1c24]">{grp.group_name}</strong>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-900">
                          {grp.gender_target || 'عام (الكل: ذكور وإناث)'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${grp.has_classes !== false ? 'bg-emerald-50 text-emerald-900' : 'bg-purple-50 text-purple-900'}`}>
                          {grp.has_classes !== false ? '📚 لها سنوات / فصول' : '🕊️ اجتماع عام بدون فصول'}
                        </span>
                      </div>
                      {(grp.service_day || grp.start_time) && (
                        <p className="text-[11px] text-amber-900 font-bold">
                          ⏰ {grp.service_day} {grp.start_time && `من ${grp.start_time}`} {grp.end_time && `إلى ${grp.end_time}`}
                        </p>
                      )}
                      {priestsInThisService.length > 0 && (
                        <p className="text-[11px] text-purple-900">
                          ✝ <strong>الكاهن المسؤول:</strong> {priestsInThisService.map(p => p.full_name).join('، ')}
                        </p>
                      )}
                      {grp.head_servant_name && (
                        <p className="text-[11px] text-gray-800">⭐ <strong>الأمين:</strong> {grp.head_servant_name}</p>
                      )}
                      {grp.servants_names && (
                        <p className="text-[11px] text-gray-600">👥 <strong>الخدام:</strong> {grp.servants_names}</p>
                      )}
                      {stagesArr.length > 0 && (
                        <p className="text-[11px] text-gray-500">السنوات / المراحل: {stagesArr.join(' • ')}</p>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setPriestTransferForm(prev => ({
                            ...prev,
                            mode: 'by_service',
                            serviceName: grp.group_name,
                            yearFilter: ''
                          }))}
                          className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-950 rounded-lg font-bold cursor-pointer"
                        >
                          ✝ نقل كاهن الخدمة
                        </button>
                        {grp.has_classes !== false && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSrvId(null);
                              setSrvForm({
                                ...emptyService,
                                stage_name: grp.group_name,
                                academic_year: stagesArr[0] || '',
                                head_servant_name: grp.head_servant_name || ''
                              });
                              document.getElementById('add-class-form')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-lg font-bold cursor-pointer"
                          >
                            + إضافة فصل
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (!grp.id) return alert('قم بتشغيل SQL جدول service_groups أولاً.');
                            setEditingGrpId(grp.id);
                            setGrpForm({
                              group_name: grp.group_name,
                              icon: grp.icon || '🏫',
                              gender_target: grp.gender_target || 'عام (الكل: ذكور وإناث)',
                              has_classes: grp.has_classes !== false,
                              head_servant_name: grp.head_servant_name || '',
                              servants_names: grp.servants_names || '',
                              service_day: grp.service_day || '',
                              start_time: grp.start_time || '',
                              end_time: grp.end_time || '',
                              stagesText: normalizeGroupStages(grp.stages).join(', '),
                              sort_order: grp.sort_order || idx + 1
                            });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="p-1.5 bg-gray-100 hover:bg-amber-100 rounded-lg cursor-pointer"
                          title="تعديل"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteServiceGroup(grp)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="bg-emerald-50/50 p-2.5 rounded-2xl border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-emerald-950 flex items-center gap-1">
                          <UserCheck size={13} /> ربط خدام أو مخدومين بـ ({grp.group_name}):
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800">
                          {linkedUsersForGroup.length} مرتبط
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {subScopeOptions.length > 1 && (
                          <select
                            className="p-1.5 border rounded-xl bg-white text-[11px] font-bold"
                            value={selectedQuickScope}
                            onChange={e => setQuickAssignByGroup(prev => ({
                              ...prev,
                              [groupKey]: { ...(prev[groupKey] || {}), scope: e.target.value }
                            }))}
                          >
                            {subScopeOptions.map((opt, oIdx) => (
                              <option key={oIdx} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}

                        <select
                          className="flex-1 min-w-40 p-1.5 border rounded-xl bg-white text-[11px] font-bold"
                          value={selectedQuickUserId}
                          onChange={e => setQuickAssignByGroup(prev => ({
                            ...prev,
                            [groupKey]: {
                              scope: prev[groupKey]?.scope || grp.group_name,
                              userId: e.target.value
                            }
                          }))}
                        >
                          <option value="">-- اختر خادم أو مخدوم لربطه --</option>
                          {assignableUsersList.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.full_name} ({ROLE_LABELS[u.role] || u.role})
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          disabled={!selectedQuickUserId || assigningGroupKey === groupKey}
                          onClick={async () => {
                            if (!selectedQuickUserId) return;
                            await handleToggleUserServiceAssignment(selectedQuickUserId, selectedQuickScope, true, groupKey);
                            setQuickAssignByGroup(prev => ({
                              ...prev,
                              [groupKey]: { ...(prev[groupKey] || {}), userId: '' }
                            }));
                          }}
                          className="px-3 py-1.5 bg-[#7a1c24] disabled:bg-gray-300 text-white rounded-xl text-[11px] font-black cursor-pointer"
                        >
                          {assigningGroupKey === groupKey ? 'جاري الربط...' : '+ ربط بالخدمة'}
                        </button>
                      </div>

                      {linkedUsersForGroup.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {linkedUsersForGroup.map(u => {
                            const matchingScopes = subScopeOptions.filter(opt => {
                              const uStages = splitList(`${u.detailed_stage || ''} ${u.service_stage || ''}`);
                              const uExtra = Array.isArray(u.permissions?.extra_services) ? u.permissions.extra_services : [];
                              const combined = [...uStages, ...uExtra];
                              return combined.includes(opt) || combined.some(item => item.includes(opt));
                            });
                            const scopeToRemove = matchingScopes[0] || grp.group_name;

                            return (
                              <span
                                key={u.id}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-emerald-300 text-emerald-950 rounded-xl text-[10px] font-bold shadow-2xs"
                              >
                                <span>{u.full_name}</span>
                                <span className="text-gray-400">({matchingScopes.join('، ') || grp.group_name})</span>
                                <button
                                  type="button"
                                  onClick={() => openSingleTransferModal(u)}
                                  className="text-amber-800 hover:underline mr-0.5 cursor-pointer"
                                  title="نقل هذا المستخدم لخدمة أو فصل آخر"
                                >
                                  نقل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPermTargetUserId(u.id);
                                    setActiveCard('roles_permissions');
                                  }}
                                  className="text-indigo-700 hover:underline mr-0.5 cursor-pointer"
                                  title="تعديل صلاحيات هذا المستخدم"
                                >
                                  صلاحيات
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleUserServiceAssignment(u.id, scopeToRemove, false, groupKey)}
                                  className="text-red-700 hover:text-red-900 cursor-pointer"
                                  title="إلغاء ربط هذه الخدمة"
                                >
                                  <X size={11} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {grp.has_classes !== false ? (
                    <div className="space-y-2">
                      {hierarchy.years.map((yr, yIdx) => (
                        <div key={yIdx} className="p-2.5 bg-[#fbfaf7] rounded-2xl border space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-xs text-[#7a1c24]">📘 {yr.yearName}</strong>
                            <span className="text-[10px] text-gray-500">
                              {yr.dbClasses.length > 0 ? `${yr.dbClasses.length} فصل` : 'شعبة عامة (بدون فصول مضافة)'}
                            </span>
                          </div>
                          {yr.dbClasses.length > 0 && (
                            <div className="space-y-1">
                              {yr.dbClasses.map(srv => {
                                const pObj = priestsList.find(p => p.id === srv.priest_id);
                                return (
                                  <div key={srv.id} className="p-2 bg-white rounded-xl border flex justify-between items-center gap-2">
                                    <div>
                                      <strong className="text-xs text-gray-900 block">{srv.class_name}</strong>
                                      <span className="text-[11px] text-gray-500">
                                        {pObj && `✝ ${pObj.full_name} • `}
                                        {srv.head_servant_name && `⭐ الأمين: ${srv.head_servant_name} `}
                                        {srv.vice_head_name && `• الخدام: ${srv.vice_head_name} `}
                                        {srv.meeting_time && `• ⏰ ${srv.meeting_time}`}
                                      </span>
                                    </div>
                                    {isAdmin && (
                                      <div className="flex gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setPriestTransferForm(prev => ({
                                            ...prev,
                                            mode: 'by_class',
                                            classId: srv.id,
                                            fromPriestId: srv.priest_id || ''
                                          }))}
                                          className="px-2 py-1 bg-purple-50 text-purple-900 rounded-lg text-[10px] font-bold cursor-pointer"
                                          title="نقل / تعديل كاهن الفصل"
                                        >
                                          ✝ كاهن
                                        </button>
                                        <button onClick={() => { setEditingSrvId(srv.id); setSrvForm({ ...emptyService, ...srv, stage_name: grp.group_name, academic_year: yr.yearName, class_gender: 'عام' }); document.getElementById('add-class-form')?.scrollIntoView({ behavior: 'smooth' }); }} className="p-1.5 bg-white border rounded-lg cursor-pointer"><Edit3 size={12} /></button>
                                        <button onClick={() => onDeleteService(srv.id)} className="p-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer"><Trash2 size={12} /></button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}

                      {hierarchy.ungroupedClasses.length > 0 && (
                        <div className="space-y-1.5">
                          {hierarchy.ungroupedClasses.map(srv => {
                            const pObj = priestsList.find(p => p.id === srv.priest_id);
                            return (
                              <div key={srv.id} className="p-2.5 bg-[#fbfaf7] rounded-2xl border flex justify-between items-center gap-2">
                                <div>
                                  <strong className="text-xs text-gray-900 block">{srv.class_name}</strong>
                                  <span className="text-[11px] text-gray-500">
                                    {pObj && `✝ ${pObj.full_name} • `}
                                    {srv.head_servant_name && `⭐ الأمين: ${srv.head_servant_name} `}
                                    {srv.vice_head_name && `• الخدام: ${srv.vice_head_name} `}
                                    {srv.meeting_time && `• ⏰ ${srv.meeting_time}`}
                                  </span>
                                </div>
                                {isAdmin && (
                                  <div className="flex gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setPriestTransferForm(prev => ({
                                        ...prev,
                                        mode: 'by_class',
                                        classId: srv.id,
                                        fromPriestId: srv.priest_id || ''
                                      }))}
                                      className="px-2 py-1 bg-purple-50 text-purple-900 rounded-lg text-[10px] font-bold cursor-pointer"
                                      title="نقل / تعديل كاهن الفصل"
                                    >
                                      ✝ كاهن
                                    </button>
                                    <button onClick={() => { setEditingSrvId(srv.id); setSrvForm({ ...emptyService, ...srv, stage_name: grp.group_name, academic_year: '', class_gender: 'عام' }); document.getElementById('add-class-form')?.scrollIntoView({ behavior: 'smooth' }); }} className="p-1.5 bg-white border rounded-lg cursor-pointer"><Edit3 size={12} /></button>
                                    <button onClick={() => onDeleteService(srv.id)} className="p-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer"><Trash2 size={12} /></button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {hierarchy.years.length === 0 && hierarchy.ungroupedClasses.length === 0 && (
                        <p className="text-[11px] text-gray-500 bg-[#fbfaf7] p-2.5 rounded-xl border">
                          عامة / بدون فصول فرعية مسجلة حالياً (تظهر كاختيار مباشر باسم الخدمة).
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-purple-900 bg-purple-50/50 p-2 rounded-xl border border-purple-100">
                      🕊️ اجتماع عام / خدمة مفتوحة بدون فصول فرعية (تظهر ككارت لأعضائها وخدامها).
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <ServiceGroupFeed currentUser={effectiveUser} services={services} groups={effectiveGroups} canPost={isAdmin} />
        </div>
      )}

      {activeCard === 'edu_center' && (
        <div className="space-y-4">
          {renderTopBack('🎓 المركز التعليمي الكنسي')}
          <EducationalCenterManager currentUser={effectiveUser} todayISO={todayISO} />
        </div>
      )}

      {activeCard === 'joseph_arimathea' && (
        <div className="space-y-4">
          {renderTopBack('🕊️ خدمة يوسف الرامي')}
          <JosephArimatheaManager currentUser={effectiveUser} users={users} todayISO={todayISO} />
        </div>
      )}

      {activeCard === 'burial_and_caskets' && (
        <div className="space-y-4">
          {renderTopBack('⚰️ أماكن الدفن وأسعار الانتقال والصناديق وألحان يوسف الرامي')}
          <AdminChurchSettingsAndBurial currentUser={effectiveUser} />
        </div>
      )}

      {activeCard === 'categories' && (
        <div className="space-y-4 text-xs">
          {renderTopBack('📂 كروت بحث الحالة')}
          {isAdmin && (
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!requireAdminGuard()) return;
                if (editingCat) {
                  onUpdateCategory(editingCat.id, editingCat.name, catForm.name, catForm.icon);
                  setEditingCat(null);
                } else {
                  onAddCategory(catForm);
                }
                setCatForm({ name: '', icon: '📂' });
              }}
              className="bg-white p-4 rounded-3xl border space-y-3 font-bold shadow-sm"
            >
              <h3 className="text-sm font-extrabold flex items-center gap-1 text-[#7a1c24]">
                <FolderEdit size={16} /> {editingCat ? `تعديل اسم كارت (${editingCat.name})` : 'تعديل وإضافة أسماء كروت تصنيفات الأسر'}
              </h3>
              <div className="grid md:grid-cols-3 gap-2">
                <input required placeholder="اسم الكارت / التصنيف *" className="p-2.5 border rounded-xl" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} />
                <input placeholder="الأيقونة (🕊️ أو ❤️)" className="p-2.5 border rounded-xl" value={catForm.icon} onChange={e => setCatForm({ ...catForm, icon: e.target.value })} />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-[#7a1c24] text-white rounded-xl p-2.5 cursor-pointer">{editingCat ? 'حفظ التعديل' : 'إضافة التصنيف'}</button>
                  {editingCat && <button type="button" onClick={() => { setEditingCat(null); setCatForm({ name: '', icon: '📂' }); }} className="px-3 border rounded-xl">إلغاء</button>}
                </div>
              </div>
            </form>
          )}

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {caseCategories.map(cat => (
              <div key={cat.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center shadow-2xs">
                <div><span className="text-xl ml-2">{cat.icon}</span><strong className="text-sm">{cat.name}</strong></div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingCat(cat); setCatForm({ name: cat.name, icon: cat.icon }); }} className="p-1.5 bg-gray-100 rounded-lg cursor-pointer"><Edit3 size={13} /></button>
                    <button onClick={() => onDeleteCategory(cat.id)} className="p-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeCard === 'custom_cards' && (
        <div className="space-y-4 text-xs">
          {renderTopBack('📌 كروت إضافية للكاهن')}
          {isAdmin && (
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!requireAdminGuard()) return;
                onAddCustomCard({ ...cardForm, priest_id: cardForm.priest_id || null });
                setCardForm({ priest_id: '', card_title: '', card_icon: '📌', description: '' });
              }}
              className="bg-white p-4 rounded-3xl border space-y-3 font-bold shadow-sm"
            >
              <h3 className="text-sm font-extrabold flex items-center gap-1 text-[#7a1c24]">
                <Sparkles size={16} /> إنشاء كارت جديد في صفحة الأب الكاهن
              </h3>
              <div className="grid md:grid-cols-4 gap-2">
                <select className="p-2.5 border rounded-xl" value={cardForm.priest_id} onChange={e => setCardForm({ ...cardForm, priest_id: e.target.value })}>
                  <option value="">لكل الآباء الكهنة</option>
                  {priestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                <input required placeholder="عنوان الكارت (مثال: الرحلات / المعموديات) *" className="p-2.5 border rounded-xl" value={cardForm.card_title} onChange={e => setCardForm({ ...cardForm, card_title: e.target.value })} />
                <input placeholder="الأيقونة (📌)" className="p-2.5 border rounded-xl" value={cardForm.card_icon} onChange={e => setCardForm({ ...cardForm, card_icon: e.target.value })} />
                <button type="submit" className="bg-[#7a1c24] text-white rounded-xl p-2.5 cursor-pointer">إنشاء الكارت</button>
              </div>
              <input placeholder="وصف مختصر للكارت..." className="w-full p-2.5 border rounded-xl" value={cardForm.description} onChange={e => setCardForm({ ...cardForm, description: e.target.value })} />
            </form>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {customCards.map(cc => {
              const targetPriest = priestsList.find(p => p.id === cc.priest_id);
              return (
                <div key={cc.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center shadow-2xs">
                  <div>
                    <span className="text-xl ml-2">{cc.card_icon}</span>
                    <strong className="text-sm">{cc.card_title}</strong>
                    <span className="mr-2 px-2 py-0.5 bg-amber-50 text-amber-900 rounded text-[10px] font-bold">{targetPriest ? targetPriest.full_name : 'لكل الكهنة'}</span>
                    <p className="text-gray-500 mt-0.5">{cc.description}</p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => onDeleteCustomCard(cc.id)} className="p-2 bg-red-50 text-red-700 rounded-xl cursor-pointer"><Trash2 size={14} /></button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeCard === 'logs' && isAdmin && (
        <div className="space-y-4 text-xs">
          {renderTopBack('📊 سجل النشاط واللوجات والواتساب')}
          <AdminLogsAndWaWidget
            currentUser={effectiveUser}
            priests={priestsList}
            allUsers={users}
            onRefreshUsers={onRefresh}
          />
        </div>
      )}

      {activeCard === 'settings' && (
        <div className="space-y-4 text-xs">
          {renderTopBack('⚙️ الإعدادات وهوية الكنيسة')}
          <form onSubmit={handleSaveChurchIdentity} className="bg-white p-6 rounded-3xl border shadow-sm space-y-4 max-w-2xl font-bold">
            <div className="flex items-center gap-2 text-[#7a1c24] text-sm font-black border-b pb-2">
              <Settings size={18} /> تخصيص اسم الكنيسة، لوجو الكنيسة، صورة السيدة العذراء، وأرقام التواصل
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block mb-1">اسم الكنيسة الرسمي *</label>
                <input
                  required
                  placeholder="كنيسة السيدة العذراء مريم..."
                  className="w-full p-2.5 border rounded-xl text-sm bg-white"
                  value={churchSettingsForm.title}
                  onChange={e => setChurchSettingsForm({ ...churchSettingsForm, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block mb-1">📞 تليفون الكنيسة / الخط الساخن للطوارئ</label>
                <input
                  placeholder="01xxxxxxxxx / 02xxxxxxx"
                  className="w-full p-2.5 border rounded-xl bg-white"
                  value={churchSettingsForm.church_phone || ''}
                  onChange={e => setChurchSettingsForm({ ...churchSettingsForm, church_phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block mb-1">الشعار / الوصف المختصر أسفل الاسم</label>
              <input
                className="w-full p-2.5 border rounded-xl bg-white"
                value={churchSettingsForm.body}
                onChange={e => setChurchSettingsForm({ ...churchSettingsForm, body: e.target.value })}
              />
            </div>

            <div>
              <label className="block mb-1 text-red-700 font-black">🚨 شريط تنبيه / خبر عاجل (يظهر للجميع في الصفحة الرئيسية):</label>
              <input
                placeholder="اكتب أي إشعار أو تنبيه طارئ يظهر للكل في الصفحة الرئيسية..."
                className="w-full p-2.5 border border-red-300 rounded-xl bg-red-50/50"
                value={churchSettingsForm.emergency_notice || ''}
                onChange={e => setChurchSettingsForm({ ...churchSettingsForm, emergency_notice: e.target.value })}
              />
            </div>

            <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200 space-y-2">
              <label className="block text-indigo-950 font-black">لوجو الكنيسة (رفع ملف مباشر من جهازك JPG / PNG / WEBP):</label>
              <div className="flex flex-wrap gap-2 items-center">
                <label className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 ${uploadingLogo ? 'bg-gray-300 text-gray-600' : 'bg-indigo-700 hover:bg-indigo-800 text-white shadow'}`}>
                  <Upload size={14} /> {uploadingLogo ? 'جاري الرفع...' : 'اختر لوجو الكنيسة من جهازك'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={handleUploadLogo} />
                </label>
                {churchSettingsForm.url && (
                  <button
                    type="button"
                    onClick={() => setChurchSettingsForm(prev => ({ ...prev, url: '' }))}
                    className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-bold cursor-pointer"
                  >
                    حذف اللوجو الحالي
                  </button>
                )}
              </div>
              {churchSettingsForm.url && (
                <div className="pt-1">
                  <img src={churchSettingsForm.url} alt="لوجو الكنيسة" className="h-20 rounded-xl border-2 object-cover bg-white p-1" />
                </div>
              )}
            </div>

            <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200 space-y-2">
              <label className="block text-amber-950 font-black">صورة السيدة العذراء مريم (رفع ملف مباشر من جهازك JPG / PNG / WEBP):</label>
              <div className="flex flex-wrap gap-2 items-center">
                <label className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 ${uploadingMary ? 'bg-gray-300 text-gray-600' : 'bg-amber-700 hover:bg-amber-800 text-white shadow'}`}>
                  <Upload size={14} /> {uploadingMary ? 'جاري الرفع...' : 'اختر صورة السيدة العذراء من جهازك'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingMary} onChange={handleUploadMaryImage} />
                </label>
                {churchSettingsForm.virgin_mary_image_url && (
                  <button
                    type="button"
                    onClick={() => setChurchSettingsForm(prev => ({ ...prev, virgin_mary_image_url: '' }))}
                    className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-bold cursor-pointer"
                  >
                    حذف صورة العذراء
                  </button>
                )}
              </div>
              {churchSettingsForm.virgin_mary_image_url && (
                <div className="pt-1">
                  <img src={churchSettingsForm.virgin_mary_image_url} alt="السيدة العذراء" className="h-24 rounded-xl border-2 object-cover bg-white p-1" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button type="submit" disabled={savingSettings || uploadingLogo || uploadingMary} className="px-6 py-3 bg-[#7a1c24] text-white rounded-xl font-black text-sm flex items-center gap-2 cursor-pointer shadow">
                <Save size={16} /> {savingSettings ? 'جاري الحفظ...' : 'حفظ هوية الكنيسة والتليفون والصور ✅'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirm('مسح الحقول وتفريغ الصور؟')) return;
                  setChurchSettingsForm({ title: '', body: '', url: '', virgin_mary_image_url: '', church_phone: '', emergency_notice: '' });
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold cursor-pointer"
              >
                مسح الحقول
              </button>
            </div>
          </form>
        </div>
      )}

      {transferModal.open && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-3 text-xs font-bold max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5">
                <ArrowLeftRight size={16} />
                {transferModal.mode === 'single'
                  ? `نقل فردي: ${transferModal.singleUser?.full_name || ''}`
                  : transferModal.targetKind === 'servant'
                    ? 'نقل جماعي للخدام'
                    : 'نقل جماعي للمخدومين'}
              </h3>
              <button type="button" onClick={() => setTransferModal(prev => ({ ...prev, open: false }))} className="p-1 text-gray-500 hover:text-gray-800 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmTransfer} className="space-y-3">
              {transferModal.mode === 'bulk' && (
                <div className="bg-gray-50 p-3 rounded-2xl border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-800">اختر الفئة للنقل الجماعي:</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setTransferModal(prev => ({
                          ...prev,
                          targetKind: 'servant',
                          selectedUserIds: [],
                          filterSourceService: '',
                          filterSourceClass: '',
                          targetClasses: [],
                          targetSingleClass: ''
                        }))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] cursor-pointer ${transferModal.targetKind === 'servant' ? 'bg-[#7a1c24] text-white' : 'bg-white border'}`}
                      >
                        الخدام ({servantsList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransferModal(prev => ({
                          ...prev,
                          targetKind: 'member',
                          selectedUserIds: [],
                          filterSourceService: '',
                          filterSourceClass: '',
                          targetClasses: [],
                          targetSingleClass: ''
                        }))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] cursor-pointer ${transferModal.targetKind === 'member' ? 'bg-[#7a1c24] text-white' : 'bg-white border'}`}
                      >
                        المخدومين ({membersList.length})
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block mb-1 text-[10px] text-gray-600">تصفية بالخدمة/المرحلة الحالية:</label>
                      <select
                        className="w-full p-2 border rounded-xl bg-white text-[11px]"
                        value={transferModal.filterSourceService}
                        onChange={e => setTransferModal(prev => ({ ...prev, filterSourceService: e.target.value, filterSourceClass: '' }))}
                      >
                        <option value="">-- الكل --</option>
                        {availableServantServices.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1 text-[10px] text-gray-600">تصفية بالفصل الحالي:</label>
                      <select
                        className="w-full p-2 border rounded-xl bg-white text-[11px]"
                        value={transferModal.filterSourceClass}
                        onChange={e => setTransferModal(prev => ({ ...prev, filterSourceClass: e.target.value }))}
                      >
                        <option value="">-- الكل --</option>
                        {getClassesForService(transferModal.filterSourceService || availableServantServices[0]).map((c, idx) => (
                          <option key={c.id || idx} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-gray-700">المحدد: {transferModal.selectedUserIds.length} من {bulkPoolUsers.length}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = bulkPoolUsers.map(u => u.id);
                        const allChecked = allIds.length > 0 && allIds.every(id => transferModal.selectedUserIds.includes(id));
                        setTransferModal(prev => ({ ...prev, selectedUserIds: allChecked ? [] : allIds }));
                      }}
                      className="text-[11px] text-[#7a1c24] hover:underline cursor-pointer"
                    >
                      تحديد / إلغاء الكل
                    </button>
                  </div>

                  <div className="max-h-36 overflow-y-auto bg-white p-2 rounded-xl border space-y-1">
                    {bulkPoolUsers.length === 0 ? (
                      <p className="text-[11px] text-gray-400 text-center py-2">لا يوجد أفراد مطابقون للتصفية</p>
                    ) : (
                      bulkPoolUsers.map(person => {
                        const checked = transferModal.selectedUserIds.includes(person.id);
                        return (
                          <label key={person.id} className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-[11px]">
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setTransferModal(prev => ({
                                    ...prev,
                                    selectedUserIds: checked
                                      ? prev.selectedUserIds.filter(id => id !== person.id)
                                      : [...prev.selectedUserIds, person.id]
                                  }));
                                }}
                              />
                              <span>{person.full_name}</span>
                            </span>
                            <span className="text-[10px] text-gray-500">{person.detailed_stage || '-'} {person.assigned_class ? `(${person.assigned_class})` : ''}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {transferModal.targetKind === 'servant' && (
                <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200 space-y-2">
                  <label className="block text-amber-950">نوع النقل للخادم:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTransferModal(prev => ({ ...prev, transferAction: 'move' }))}
                      className={`p-2 rounded-xl border text-[11px] cursor-pointer ${transferModal.transferAction === 'move' ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-gray-800'}`}
                    >
                      🔄 نقل للخدمة / الفصول الجديدة
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferModal(prev => ({ ...prev, transferAction: 'add' }))}
                      className={`p-2 rounded-xl border text-[11px] cursor-pointer ${transferModal.transferAction === 'add' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-gray-800'}`}
                    >
                      ➕ إضافة خدمة / فصل بجانب الحالي
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block mb-1 text-[#7a1c24]">① اختر الخدمة / المرحلة الهدف *</label>
                <select
                  required
                  className="w-full p-2.5 border rounded-xl bg-amber-50/40"
                  value={transferModal.targetService}
                  onChange={e => setTransferModal(prev => ({
                    ...prev,
                    targetService: e.target.value,
                    targetClasses: [],
                    targetSingleClass: ''
                  }))}
                >
                  <option value="">-- اختر الخدمة أو المرحلة --</option>
                  {availableServantServices.map((srvName, idx) => (
                    <option key={idx} value={srvName}>{srvName}</option>
                  ))}
                </select>
              </div>

              {transferModal.targetKind === 'servant' ? (
                <div className="bg-blue-50/40 p-3 rounded-2xl border border-blue-200 space-y-2">
                  <label className="block text-blue-950">② اختر السنوات أو الفصول التابعة لـ ({transferModal.targetService || 'الخدمة'}):</label>
                  {getServiceHierarchy(transferModal.targetService).years.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {getServiceHierarchy(transferModal.targetService).years.map((yr, yIdx) => (
                        <div key={yIdx} className="bg-white p-2 rounded-xl border space-y-1">
                          <div className="text-[10px] font-black text-[#7a1c24]">{yr.yearName}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {yr.selectableOptions.map((optItem) => {
                              const checked = transferModal.targetClasses.includes(optItem.value);
                              return (
                                <button
                                  key={optItem.id || optItem.value}
                                  type="button"
                                  onClick={() => setTransferModal(prev => ({
                                    ...prev,
                                    targetClasses: checked
                                      ? prev.targetClasses.filter(c => c !== optItem.value)
                                      : [...prev.targetClasses, optItem.value]
                                  }))}
                                  className={`px-2.5 py-1 rounded-xl border text-[11px] cursor-pointer ${
                                    checked ? 'bg-blue-700 text-white border-blue-700' : 'bg-gray-50 text-gray-800'
                                  }`}
                                >
                                  {checked ? '✓ ' : '+ '}{optItem.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {getServiceHierarchy(transferModal.targetService).ungroupedClasses.length > 0 && (
                        <div className="bg-white p-2 rounded-xl border flex flex-wrap gap-1.5">
                          {getServiceHierarchy(transferModal.targetService).ungroupedClasses.map((clsItem) => {
                            const checked = transferModal.targetClasses.includes(clsItem.class_name);
                            return (
                              <button
                                key={clsItem.id}
                                type="button"
                                onClick={() => setTransferModal(prev => ({
                                  ...prev,
                                  targetClasses: checked
                                    ? prev.targetClasses.filter(c => c !== clsItem.class_name)
                                    : [...prev.targetClasses, clsItem.class_name]
                                }))}
                                className={`px-2.5 py-1 rounded-xl border text-[11px] cursor-pointer ${
                                  checked ? 'bg-blue-700 text-white border-blue-700' : 'bg-gray-50 text-gray-800'
                                }`}
                              >
                                {checked ? '✓ ' : '+ '}{clsItem.class_name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : getClassesForService(transferModal.targetService).length === 0 ? (
                    <p className="text-[11px] text-gray-500">خدمة عامة / بدون فصول فرعية (تُعتمد الخدمة نفسها).</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {getClassesForService(transferModal.targetService).map((clsItem) => {
                        const checked = transferModal.targetClasses.includes(clsItem.value);
                        return (
                          <button
                            key={clsItem.id || clsItem.value}
                            type="button"
                            onClick={() => setTransferModal(prev => ({
                              ...prev,
                              targetClasses: checked
                                ? prev.targetClasses.filter(c => c !== clsItem.value)
                                : [...prev.targetClasses, clsItem.value]
                            }))}
                            className={`px-2.5 py-1.5 rounded-xl border text-[11px] cursor-pointer ${
                              checked ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-800'
                            }`}
                          >
                            {checked ? '✓ ' : '+ '}{clsItem.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-1">
                    <label className="block mb-1 text-[11px] text-cyan-950">نطاق النوع للخادم (اختياري):</label>
                    <select
                      className="w-full p-2 border rounded-xl bg-white text-[11px]"
                      value={transferModal.targetGenderScope}
                      onChange={e => setTransferModal(prev => ({ ...prev, targetGenderScope: e.target.value }))}
                    >
                      <option value="">-- الإبقاء على النطاق الحالي --</option>
                      <option value="الكل">👥 الكل (بنين وبنات / عام)</option>
                      <option value="بنين">♂️ بنين فقط (ذكور)</option>
                      <option value="بنات">♀️ بنات فقط (إناث)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block mb-1 text-blue-950">② السنة الدراسية / الفصل التابع للمرحلة الهدف</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white"
                    value={transferModal.targetSingleClass}
                    onChange={e => setTransferModal(prev => ({ ...prev, targetSingleClass: e.target.value }))}
                  >
                    <option value="">-- اختر السنة أو الفصل --</option>
                    {getClassesForService(transferModal.targetService).map((clsItem) => (
                      <option key={clsItem.id || clsItem.value} value={clsItem.value}>
                        {clsItem.yearName ? `${clsItem.yearName} ← ${clsItem.label}` : clsItem.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setTransferModal(prev => ({ ...prev, open: false }))} className="px-4 py-2 border rounded-xl cursor-pointer">
                  إلغاء
                </button>
                <button type="submit" disabled={savingTransfer} className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl shadow cursor-pointer">
                  {savingTransfer ? 'جاري التنفيذ...' : 'تأكيد النقل ✅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-3 text-xs font-bold max-h-[92vh] overflow-y-auto">
            <h3 className="font-extrabold text-sm text-gray-900">{isEditing ? 'تعديل بيانات الفرد' : 'إضافة فرد جديد بالاسم الرباعي'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block mb-1 text-[#7a1c24]">الاسم الرباعي (إلزامي) *</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input required placeholder="الأول *" className="p-2.5 border rounded-xl" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
                  <input required placeholder="الثاني *" className="p-2.5 border rounded-xl" value={formData.second_name} onChange={e => setFormData({ ...formData, second_name: e.target.value })} />
                  <input required placeholder="الثالث *" className="p-2.5 border rounded-xl" value={formData.third_name} onChange={e => setFormData({ ...formData, third_name: e.target.value })} />
                  <input required placeholder="الرابع *" className="p-2.5 border rounded-xl" value={formData.fourth_name} onChange={e => setFormData({ ...formData, fourth_name: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div><label className="block mb-1">اسم الدخول (Username) *</label><input required className="w-full p-2.5 border rounded-xl" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} /></div>
                <div><label className="block mb-1">كلمة المرور *</label><input required className="w-full p-2.5 border rounded-xl" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} /></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block mb-1">الدور والصلاحية *</label>
                  <select
                    className="w-full p-2.5 border rounded-xl"
                    value={formData.role}
                    onChange={e => {
                      const nextRole = e.target.value;
                      const nextGuardianType = nextRole === 'parent' ? (formData.guardian_type === 'mother' ? 'mother' : 'father') : '';
                      setFormData({
                        ...formData,
                        role: nextRole,
                        guardian_type: nextGuardianType,
                        family_role: nextRole === 'parent' ? (nextGuardianType === 'mother' ? 'الأم' : 'الأب') : formData.family_role
                      });
                    }}
                  >
                    <option value="priest">أب كاهن</option>
                    <option value="head_servant">خادم (أمين خدمة)</option>
                    <option value="vice_head_servant">خادم (مساعد أمين خدمة)</option>
                    <option value="servant">خادم مرحلة</option>
                    <option value="meeting_servant">خادم اجتماع</option>
                    <option value="mercy_servant">خادم إخوة رب</option>
                    <option value="member">مخدوم</option>
                    <option value="parent">ولي أمر</option>
                    <option value="worker">عامل / فراش كنيسة</option>
                    <option value="admin">سوبر أدمن</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1">النوع *</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white"
                    value={formData.gender || 'ذكر'}
                    onChange={e => setFormData({ ...formData, gender: e.target.value })}
                  >
                    <option value="ذكر">♂️ ذكر</option>
                    <option value="أنثى">♀️ أنثى</option>
                  </select>
                </div>
                <div><label className="block mb-1">تاريخ الميلاد</label><input type="date" className="w-full p-2.5 border rounded-xl" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} /></div>
              </div>

              {formData.role === 'parent' && (
                <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 space-y-1.5">
                  <label className="block text-[#7a1c24] font-extrabold">نوع ولي الأمر (الأب / الأم) *</label>
                  <select
                    className="w-full p-2.5 border border-amber-300 rounded-xl bg-white"
                    value={formData.guardian_type || 'father'}
                    onChange={e => {
                      const nextG = e.target.value === 'mother' ? 'mother' : 'father';
                      setFormData({
                        ...formData,
                        guardian_type: nextG,
                        gender: nextG === 'mother' ? 'أنثى' : 'ذكر',
                        family_role: nextG === 'mother' ? 'الأم' : 'الأب'
                      });
                    }}
                  >
                    <option value="father">👨 الأب</option>
                    <option value="mother">👩 الأم</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block mb-1">حالة الفرد (افتقاد / متابعة / ترحيم)</label>
                <select
                  className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
                  value={formData.member_status || 'active'}
                  onChange={e => setFormData({ ...formData, member_status: e.target.value })}
                >
                  <option value="active">نشط / موجود</option>
                  <option value="needs_visitation">محتاج افتقاد</option>
                  <option value="inactive">منقطع / غياب</option>
                  <option value="transferred">منتقل خارج الكنيسة</option>
                  <option value="departed">منتقل للسماء (ذكرى ترحيم)</option>
                </select>
              </div>

              {formData.role === 'priest' && (
                <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 space-y-2">
                  <span className="block text-[11px] text-amber-950 font-extrabold">✝ بيانات الكهنوت والسيامة والعائلة والواتساب:</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block mb-1 text-[10px]">الدرجة</label>
                      <select className="w-full p-2 border rounded-xl bg-white" value={formData.priest_degree} onChange={e => setFormData({ ...formData, priest_degree: e.target.value })}>
                        <option value="قس">قس</option><option value="قمص">قمص</option><option value="أسقف / مطران">أسقف / مطران</option>
                      </select>
                    </div>
                    <div><label className="block mb-1 text-[10px]">تاريخ السيامة</label><input type="date" className="w-full p-2 border rounded-xl bg-white" value={formData.ordination_date} onChange={e => setFormData({ ...formData, ordination_date: e.target.value })} /></div>
                    <div><label className="block mb-1 text-[10px]">تاريخ الترقية</label><input type="date" className="w-full p-2 border rounded-xl bg-white" value={formData.promotion_date} onChange={e => setFormData({ ...formData, promotion_date: e.target.value })} /></div>
                  </div>
                  {formData.priest_degree !== 'أسقف / مطران' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="الاسم الرباعي لزوجة الأب الكاهن" className="p-2 border rounded-xl bg-white" value={formData.priest_wife_full_name} onChange={e => setFormData({ ...formData, priest_wife_full_name: e.target.value })} />
                      <input type="tel" placeholder="تليفون الزوجة" className="p-2 border rounded-xl bg-white" value={formData.priest_wife_phone} onChange={e => setFormData({ ...formData, priest_wife_phone: e.target.value })} />
                    </div>
                  )}
                  <input placeholder="تفاصيل الأبناء / ملاحظات اليوبيل..." className="w-full p-2 border rounded-xl bg-white" value={formData.priest_family_notes} onChange={e => setFormData({ ...formData, priest_family_notes: e.target.value })} />
                  <div className="grid sm:grid-cols-2 gap-2 pt-1 border-t border-amber-200">
                    <input placeholder="رقم الواتساب الخاص بأبونا للإرسال" className="p-2 border rounded-xl bg-white" value={formData.whatsapp_sender_phone || ''} onChange={e => setFormData({ ...formData, whatsapp_sender_phone: e.target.value })} />
                    <label className="flex items-center gap-2 text-[11px] text-amber-950 cursor-pointer">
                      <input type="checkbox" checked={formData.can_manage_wa_templates !== false} onChange={e => setFormData({ ...formData, can_manage_wa_templates: e.target.checked })} />
                      السماح بتعديل وإضافة قوالب الواتساب
                    </label>
                  </div>
                </div>
              )}

              <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-950">
                  <input type="checkbox" checked={formData.is_deacon} onChange={e => setFormData({ ...formData, is_deacon: e.target.checked })} />
                  هل هذا الشخص شماس بخدمة الكنيسة؟
                </label>
                {formData.is_deacon && (
                  <div>
                    <label className="block mb-1 text-purple-900 text-[11px]">رتبة الشماس الحالية *</label>
                    <select
                      className="w-full p-2 border rounded-xl bg-white"
                      value={normalizeDeaconRank(formData.deacon_rank)}
                      onChange={e => setFormData({ ...formData, deacon_rank: e.target.value })}
                    >
                      {DEACON_RANKS.map(rk => (
                        <option key={rk.value} value={rk.value}>{rk.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {formData.role === 'worker' && (
                <div><label className="block mb-1">وظيفة العامل / الفراش</label><input className="w-full p-2.5 border rounded-xl" placeholder="فراش الكنيسة / أمن..." value={formData.church_job} onChange={e => setFormData({ ...formData, church_job: e.target.value })} /></div>
              )}

              {formData.role === 'member' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block mb-1">① المرحلة / الخدمة</label>
                      <select
                        className="w-full p-2.5 border rounded-xl bg-amber-50/40"
                        value={formData.detailed_stage}
                        onChange={e => {
                          const nextStage = e.target.value;
                          const nextStageClasses = getClassesForService(nextStage);
                          const keepCurrentClass = nextStageClasses.some(c => c.value === formData.assigned_class);
                          setFormData({
                            ...formData,
                            detailed_stage: nextStage,
                            assigned_class: keepCurrentClass ? formData.assigned_class : ''
                          });
                        }}
                      >
                        {allGroupStagesFlat.map((st, i) => <option key={i} value={st}>{st}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1">② السنة الدراسية / الفصل التابع للمرحلة</label>
                      <select
                        className="w-full p-2.5 border rounded-xl bg-white"
                        value={formData.assigned_class || ''}
                        onChange={e => setFormData({ ...formData, assigned_class: e.target.value })}
                      >
                        <option value="">-- اختر السنة أو الفصل --</option>
                        {getClassesForService(formData.detailed_stage).map((srv) => (
                          <option key={srv.id || srv.value} value={srv.value}>
                            {srv.yearName ? `${srv.yearName} ← ${srv.label}` : srv.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1">أب الاعتراف</label>
                    <select className="w-full p-2.5 border rounded-xl bg-white" value={formData.confession_father_id || ''} onChange={e => setFormData({ ...formData, confession_father_id: e.target.value })}>
                      <option value="">-- اختر --</option>
                      {priestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </div>
                </>
              )}

              {isServantRoleSelected && (
                <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-200 space-y-3">
                  <div>
                    <label className="block mb-1 text-cyan-950 font-extrabold">
                      ⚖️ تخصيص النوع للخادم (مهم في إعدادي وثانوي والخدمات المقسمة):
                    </label>
                    <select
                      className="w-full p-2.5 border border-cyan-300 rounded-xl bg-white"
                      value={formData.permissions?.service_gender_scope || 'الكل'}
                      onChange={e => setFormData({
                        ...formData,
                        permissions: { ...emptyUser.permissions, ...(formData.permissions || {}), service_gender_scope: e.target.value }
                      })}
                    >
                      <option value="الكل">👥 الكل (بنين وبنات / عام)</option>
                      <option value="بنين">♂️ بنين فقط (ذكور)</option>
                      <option value="بنات">♀️ بنات فقط (إناث)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1.5 text-[#7a1c24] font-extrabold">
                      ① اختر الخدمة التابعة للخادم (يمكن اختيار أكثر من خدمة):
                    </label>
                    <div className="flex flex-wrap gap-1.5 bg-white p-2.5 rounded-xl border max-h-36 overflow-y-auto">
                      {availableServantServices.map((srvName, idx) => {
                        const isSelected = selectedServantStages.includes(srvName);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleMultiFieldValue('detailed_stage', srvName)}
                            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer transition ${
                              isSelected
                                ? 'bg-[#7a1c24] text-white border-[#7a1c24]'
                                : 'bg-gray-50 text-gray-800 hover:bg-amber-50'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}{srvName}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedServantStages.length > 0 && (
                    <div className="space-y-2">
                      <label className="block text-blue-950 font-extrabold">
                        ② اختر السنوات أو الفصول التابعة لكل خدمة للخادم:
                      </label>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {selectedServantStages.map((srvName, sIdx) => {
                          const hierarchy = getServiceHierarchy(srvName);
                          return (
                            <div key={sIdx} className="bg-white p-2.5 rounded-xl border space-y-2">
                              <div className="text-[11px] font-black text-[#7a1c24] flex items-center justify-between">
                                <span>📌 خدمة: {srvName}</span>
                                <span className="text-[10px] text-gray-400">{hierarchy.allClasses.length} خيار</span>
                              </div>

                              {hierarchy.years.length > 0 ? (
                                <div className="space-y-1.5">
                                  {hierarchy.years.map((yr, yIdx) => (
                                    <div key={yIdx} className="p-2 rounded-lg bg-[#fbfaf7] border space-y-1">
                                      <div className="text-[10px] font-black text-gray-800">
                                        {yr.yearName}
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {yr.selectableOptions.map((optItem) => {
                                          const checked = selectedServantClasses.includes(optItem.value);
                                          return (
                                            <label
                                              key={optItem.id || optItem.value}
                                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer text-[11px] ${
                                                checked ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-800'
                                              }`}
                                            >
                                              <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={checked}
                                                onChange={() => toggleMultiFieldValue('assigned_class', optItem.value)}
                                              />
                                              {checked ? '✓ ' : ''}{optItem.label}
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}

                                  {hierarchy.ungroupedClasses.length > 0 && (
                                    <div className="p-2 rounded-lg bg-[#fbfaf7] border flex flex-wrap gap-1.5">
                                      {hierarchy.ungroupedClasses.map((clsItem) => {
                                        const checked = selectedServantClasses.includes(clsItem.class_name);
                                        return (
                                          <label
                                            key={clsItem.id}
                                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer text-[11px] ${
                                              checked ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-800'
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              className="hidden"
                                              checked={checked}
                                              onChange={() => toggleMultiFieldValue('assigned_class', clsItem.class_name)}
                                            />
                                            {checked ? '✓ ' : ''}{clsItem.class_name}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ) : hierarchy.ungroupedClasses.length === 0 ? (
                                <p className="text-[11px] text-gray-500">
                                  خدمة عامة / بدون فصول فرعية (تُعتمد الخدمة نفسها).
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {hierarchy.ungroupedClasses.map((clsItem) => {
                                    const checked = selectedServantClasses.includes(clsItem.class_name);
                                    return (
                                      <label
                                        key={clsItem.id}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer text-[11px] ${
                                          checked ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-800'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          className="hidden"
                                          checked={checked}
                                          onChange={() => toggleMultiFieldValue('assigned_class', clsItem.class_name)}
                                        />
                                        {checked ? '✓ ' : ''}{clsItem.class_name}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block mb-1">أب الاعتراف</label>
                    <select className="w-full p-2.5 border rounded-xl bg-white" value={formData.confession_father_id || ''} onChange={e => setFormData({ ...formData, confession_father_id: e.target.value })}>
                      <option value="">-- اختر --</option>
                      {priestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {formData.role === 'member' && (
                <div className="bg-blue-50/40 p-3 rounded-2xl border border-blue-200 space-y-2.5">
                  <span className="block text-[#7a1c24] font-extrabold">
                    👨‍👩‍👦 ربط بحساب ولي الأمر (تحديد الأب والأم بشكل منفصل):
                  </span>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block mb-1 text-[11px] text-sky-950">👨 ولي الأمر (الأب):</label>
                      <select
                        className="w-full p-2.5 border rounded-xl bg-white"
                        value={formData.parent_id || ''}
                        onChange={e => setFormData({
                          ...formData,
                          parent_id: e.target.value,
                          father_id: e.target.value
                        })}
                      >
                        <option value="">-- اختر الأب (اختياري) --</option>
                        {parentsWorkersList
                          .filter(p => p.role === 'parent' && detectGuardianType(p) !== 'mother')
                          .map(p => (
                            <option key={p.id} value={p.id}>
                              {p.full_name} {p.phone ? `(${p.phone})` : ''}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block mb-1 text-[11px] text-pink-950">👩 ولي الأمر (الأم):</label>
                      <select
                        className="w-full p-2.5 border rounded-xl bg-white"
                        value={formData.mother_id || ''}
                        onChange={e => setFormData({
                          ...formData,
                          mother_id: e.target.value
                        })}
                      >
                        <option value="">-- اختر الأم (اختياري) --</option>
                        {parentsWorkersList
                          .filter(p => p.role === 'parent' && (detectGuardianType(p) === 'mother' || p.guardian_type === 'mother' || ['الأم', 'أم', 'والدة'].includes(String(p.family_role || '').trim())))
                          .map(p => (
                            <option key={p.id} value={p.id}>
                              {p.full_name} {p.phone ? `(${p.phone})` : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div><label className="block mb-1">رقم الهاتف *</label><input required type="tel" className="w-full p-2.5 border rounded-xl" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                <div><label className="block mb-1">العمل / الوظيفة</label><input className="w-full p-2.5 border rounded-xl" placeholder="مهندس / طالب..." value={formData.job_title} onChange={e => setFormData({ ...formData, job_title: e.target.value })} /></div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div><label className="block mb-1">القطاع / المنطقة</label><input className="w-full p-2.5 border rounded-xl" value={formData.sector} onChange={e => setFormData({ ...formData, sector: e.target.value })} /></div>
                <div><label className="block mb-1">العنوان بالتفصيل</label><input className="w-full p-2.5 border rounded-xl" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} /></div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl">إلغاء</button>
                <button type="submit" className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl shadow cursor-pointer">{isEditing ? 'حفظ التعديلات' : 'إنشاء'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
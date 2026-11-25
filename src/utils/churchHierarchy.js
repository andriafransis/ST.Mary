import { normalizeGroupStages } from '../components/ServiceGroupFeed';

export const DEACON_RANKS = [
  { value: 'أبصالتس', label: 'أبصالتس (مرتل)' },
  { value: 'اغنسطس', label: 'اغنسطس (قارئ)' },
  { value: 'إبصاديا', label: 'إبصاديا (مبدأ شماس)' },
  { value: 'دياكون', label: 'دياكون (شماس كامل)' },
  { value: 'أرشيدياكون', label: 'أرشيدياكون (رئيس شمامسة)' }
];

export const ROLE_LABELS = {
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

export const STAGE_OPTIONS = [
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

export const SERVANT_ROLES = [
  'head_servant',
  'vice_head_servant',
  'servant',
  'meeting_servant',
  'mercy_servant'
];

export const emptyUser = {
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

export const emptyEvent = {
  event_type: 'قداس إلهي',
  title: '',
  event_time: '',
  place: '',
  priest_name: '',
  target_stage: 'الكل'
};

export const emptyService = {
  stage_name: '',
  academic_year: '',
  class_name: '',
  class_gender: 'عام',
  meeting_time: '',
  room_name: '',
  head_servant_name: '',
  vice_head_name: '',
  priest_id: ''
};

export const emptyGroup = {
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

export const detectGuardianType = (u) => {
  if (!u) return 'father';
  if (u.guardian_type === 'mother' || u.guardian_type === 'father') return u.guardian_type;
  if (['الأم', 'أم', 'والدة'].includes(String(u.family_role || '').trim())) return 'mother';
  return 'father';
};

export const splitList = (val) =>
  String(val || '')
    .split(/[,،]/)
    .map(s => s.trim())
    .filter(Boolean);

export const buildServiceHierarchy = (serviceName, effectiveGroups = [], services = []) => {
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

export const getClassesForServiceHelper = (serviceName, effectiveGroups = [], services = []) =>
  buildServiceHierarchy(serviceName, effectiveGroups, services).allClasses;
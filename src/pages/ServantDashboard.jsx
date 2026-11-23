import { useState, useEffect } from 'react';
import {
  Phone, Search, UserPlus, Calendar, MessageSquareText, Layers,
  MessageCircle, AlertTriangle, Users, MapPin, X, FileSpreadsheet,
  ArrowRight, BookOpen, Plus, Pencil, Trash2, Check, LayoutGrid, List, Sparkles
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import BirthdayBanner from '../components/BirthdayBanner';
import MasterCongregationSheet, { canExtractMasterSheet } from '../components/MasterCongregationSheet';
import { DEFAULT_SERVICE_GROUPS, normalizeGroupStages } from '../components/ServiceGroupFeed';

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
  'اجتماع الصدى'
];

const CORE_SERVICE_GROUPS = [
  'خدمة حضانة وطفولة',
  'خدمة ابتدائي',
  'خدمة إعدادي',
  'خدمة ثانوي',
  'خدمة جامعة وخريجين',
  'خدمات واجتماعات خاصة'
];

const GENDER_SCOPES = ['الكل', 'بنين', 'بنات'];

const isMaleMember = (m) => {
  const g = String(m?.gender || '').trim();
  return g === 'ذكر' || g === 'بنين' || g.toLowerCase() === 'male';
};

const isFemaleMember = (m) => {
  const g = String(m?.gender || '').trim();
  return g === 'أنثى' || g === 'بنات' || g.toLowerCase() === 'female';
};

const isPrepOrSecondaryScope = (scope = '') => {
  const s = String(scope || '');
  return (
    s.includes('إعدادي') ||
    s.includes('اعدادي') ||
    s.includes('ثانوي') ||
    s.includes('أولى') ||
    s.includes('ثانية') ||
    s.includes('ثالثة')
  );
};

export default function ServantDashboard({
  servant, users = [], services = [], serviceGroups = [], activities = [], memberNotes = [], birthdays = [],
  onAddMember, onSaveActivity, onSaveMemberNote, onAcknowledgeNote, onRefresh, onUpdateServiceStructure
}) {
  const isAdminUser = servant?.role === 'admin';
  const canAdd = isAdminUser || servant?.permissions?.can_add !== false;
  const canManageStructure = true;
  const canExtractSheet = canExtractMasterSheet(servant);
  const [showMasterSheet, setShowMasterSheet] = useState(false);

  const acknowledgedStorageKey = `acked_member_notes_${servant?.id || servant?.username || 'default'}`;

  const [hiddenNotes, setHiddenNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(acknowledgedStorageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(acknowledgedStorageKey);
      setHiddenNotes(saved ? JSON.parse(saved) : {});
    } catch {
      setHiddenNotes({});
    }
  }, [acknowledgedStorageKey]);

  const handleAcknowledgeNote = async (note) => {
    if (!note?.id) return;

    const updatedMap = { ...hiddenNotes, [note.id]: true };
    setHiddenNotes(updatedMap);
    try {
      localStorage.setItem(acknowledgedStorageKey, JSON.stringify(updatedMap));
    } catch {
      // تجاهل خطأ التخزين المحلي إذا كان غير متاح
    }

    if (typeof onAcknowledgeNote === 'function') {
      try {
        await onAcknowledgeNote(note);
      } catch {
        // استمرار العمل حتى لو الدالة غير مفعلة
      }
    }

    if (supabase && typeof supabase.from === 'function') {
      try {
        const { error } = await supabase
          .from('member_notes')
          .update({
            is_read: true,
            acknowledged: true,
            acknowledged_at: new Date().toISOString(),
            acknowledged_by: servant?.full_name || servant?.username || servant?.id || 'servant'
          })
          .eq('id', note.id);

        if (error) {
          console.error('خطأ في حفظ تأكيد الملاحظة في قاعدة البيانات:', error.message);
        } else if (typeof onRefresh === 'function') {
          onRefresh();
        }
      } catch (err) {
        console.error('تعذر تحديث الملاحظة في قاعدة البيانات:', err);
      }
    }
  };

  const baseGroups = Array.isArray(serviceGroups) && serviceGroups.length > 0
    ? serviceGroups
    : DEFAULT_SERVICE_GROUPS;

  const [localGroups, setLocalGroups] = useState(baseGroups);
  const [localServices, setLocalServices] = useState(Array.isArray(services) ? services : []);
  const [customGroupYears, setCustomGroupYears] = useState({});
  const [deletedYearsByGroup, setDeletedYearsByGroup] = useState({});
  const [renamedYearsMap, setRenamedYearsMap] = useState({});

  useEffect(() => {
    setLocalGroups(Array.isArray(serviceGroups) && serviceGroups.length > 0 ? serviceGroups : DEFAULT_SERVICE_GROUPS);
  }, [serviceGroups]);

  useEffect(() => {
    setLocalServices(Array.isArray(services) ? services : []);
  }, [services]);

  const effectiveGroups = [...new Map([
    ...CORE_SERVICE_GROUPS.map((name, idx) => {
      const existing = localGroups.find(g => g.group_name === name);
      if (existing) return [name, existing];
      const fallback = DEFAULT_SERVICE_GROUPS.find(g => g.group_name === name);
      return [name, fallback || { id: `core-${idx}`, group_name: name, stages: [] }];
    }),
    ...localGroups.map(g => [g.group_name, g])
  ]).values()];

  const assignedClass = (servant?.assigned_class || '').trim();
  const baseStages = (servant?.service_stage || servant?.detailed_stage || '')
    .split(/[,،]/)
    .map(s => s.trim())
    .filter(Boolean);
  const extraServices = Array.isArray(servant?.permissions?.extra_services) ? servant.permissions.extra_services : [];

  function splitCommaClasses(val) {
    return String(val || '')
      .split(/[,،]/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  const rawBoundTargets = [...new Set([
    ...(assignedClass ? splitCommaClasses(assignedClass) : []),
    ...baseStages,
    ...extraServices
  ])].filter(Boolean);

  const mainServiceNames = effectiveGroups.map(g => g.group_name).filter(Boolean);

  const resolveParentGroupName = (targetName) => {
    if (!targetName) return mainServiceNames[0] || 'خدمة حضانة وطفولة';
    const directGroup = effectiveGroups.find(g => g.group_name === targetName);
    if (directGroup) return directGroup.group_name;

    const groupByStage = effectiveGroups.find(g => normalizeGroupStages(g.stages).includes(targetName));
    if (groupByStage) return groupByStage.group_name;

    const classObj = localServices.find(s => s.class_name === targetName || s.stage_name === targetName);
    if (classObj) {
      const grp = effectiveGroups.find(
        g => g.group_name === classObj.stage_name || normalizeGroupStages(g.stages).includes(classObj.stage_name)
      );
      if (grp) return grp.group_name;
    }

    if (targetName.includes('حضانة') || targetName.includes('طفولة')) return 'خدمة حضانة وطفولة';
    if (targetName.includes('ابتدائي')) return 'خدمة ابتدائي';
    if (targetName.includes('إعدادي') || targetName.includes('اعدادي')) return 'خدمة إعدادي';
    if (targetName.includes('ثانوي')) return 'خدمة ثانوي';
    if (targetName.includes('جامعة') || targetName.includes('خريجين')) return 'خدمة جامعة وخريجين';
    return 'خدمات واجتماعات خاصة';
  };

  const servantBoundMainGroups = isAdminUser
    ? mainServiceNames
    : [...new Set(rawBoundTargets.map(resolveParentGroupName))];

  const availableServicesList = mainServiceNames.length > 0
    ? mainServiceNames
    : ['خدمة حضانة وطفولة', 'خدمة ابتدائي', 'خدمة إعدادي', 'خدمة ثانوي', 'خدمة جامعة وخريجين', 'خدمات واجتماعات خاصة'];

  const initialDefaultScope = isAdminUser
    ? (availableServicesList[0] || 'خدمة حضانة وطفولة')
    : (servantBoundMainGroups[0] || availableServicesList[0] || 'خدمة حضانة وطفولة');

  const [selectedScope, setSelectedScope] = useState(initialDefaultScope);
  const [selectedYearFilter, setSelectedYearFilter] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [showAllChurchServices, setShowAllChurchServices] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupOriginal, setEditingGroupOriginal] = useState('');
  const [editingGroupValue, setEditingGroupValue] = useState('');

  const [newYearName, setNewYearName] = useState('');
  const [editingYearOriginal, setEditingYearOriginal] = useState('');
  const [editingYearValue, setEditingYearValue] = useState('');

  const [newClassName, setNewClassName] = useState('');

  const defaultGenderScope = (() => {
    const saved = servant?.permissions?.service_gender_scope;
    if (saved && GENDER_SCOPES.includes(saved)) return saved;
    const clsText = assignedClass;
    if (clsText.includes('بنات')) return 'بنات';
    if (clsText.includes('بنين')) return 'بنين';
    return 'الكل';
  })();

  const [selectedGenderFilter, setSelectedGenderFilter] = useState(defaultGenderScope);
  const [viewMode, setViewMode] = useState('list');
  const [cardDensity, setCardDensity] = useState('compact');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [actModal, setActModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [actForm, setActForm] = useState({ activity_date: new Date().toISOString().split('T')[0], activity_type: 'مدارس أحد', attended: true, notes: '' });

  const [noteModal, setNoteModal] = useState(false);
  const [noteMember, setNoteMember] = useState(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteTag, setNewNoteTag] = useState('عادي');

  const emptyMember = {
    username: '',
    password: '123',
    role: 'member',
    first_name: '', second_name: '', third_name: '', fourth_name: '',
    father_first: '', father_second: '', father_third: '', father_fourth: '',
    mother_first: '', mother_second: '', mother_third: '', mother_fourth: '',
    father_phone: '', mother_phone: '', phone: '',
    gender: 'ذكر',
    marital_status: 'أعزب',
    church_name: '',
    confession_father: '',
    is_studying: true,
    detailed_stage: baseStages[0] || 'أولى ابتدائي',
    service_stage: baseStages[0] || 'أولى ابتدائي',
    assigned_class: splitCommaClasses(assignedClass)[0] || '',
    dob: '', address: '',
    confession_status: 'منتظم',
    has_communion: true,
    member_status: 'active'
  };
  const [newMember, setNewMember] = useState(emptyMember);

  useEffect(() => {
    if (!availableServicesList.includes(selectedScope) && availableServicesList.length > 0) {
      setSelectedScope(initialDefaultScope);
      setSelectedYearFilter('');
      setSelectedClassFilter('');
    }
  }, [localGroups, localServices, servant]);

  useEffect(() => {
    if (!supabase || typeof supabase.channel !== 'function' || typeof onRefresh !== 'function') return;
    const channel = supabase
      .channel('servant-dashboard-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_groups' }, () => {
        onRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => {
        onRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'church_users' }, () => {
        onRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_notes' }, () => {
        onRefresh();
      })
      .subscribe();

    return () => {
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel);
      }
    };
  }, [onRefresh]);

  const notifyStructureChange = (nextGroups, nextServices, actionMeta) => {
    setLocalGroups(nextGroups);
    setLocalServices(nextServices);
    if (typeof onUpdateServiceStructure === 'function') {
      onUpdateServiceStructure({
        serviceGroups: nextGroups,
        services: nextServices,
        ...actionMeta
      });
    }
  };

  const getScopeStructure = (scope) => {
    const matchedGroup = effectiveGroups.find(g => g.group_name === scope) || null;
    const rawGroupStages = matchedGroup ? normalizeGroupStages(matchedGroup.stages) : [];
    const addedYears = customGroupYears[scope] || [];
    const deletedYears = deletedYearsByGroup[scope] || [];
    const scopeRenames = renamedYearsMap[scope] || {};

    const groupClasses = localServices.filter(
      s =>
        s.stage_name === scope ||
        rawGroupStages.includes(s.stage_name) ||
        addedYears.includes(s.stage_name) ||
        Object.values(scopeRenames).includes(s.stage_name) ||
        (matchedGroup && s.stage_name === matchedGroup.group_name)
    );

    const inferredYears = new Set([...rawGroupStages, ...addedYears]);
    groupClasses.forEach(cls => {
      if (cls.stage_name && cls.stage_name !== scope && !matchedGroup?.group_name?.includes(cls.stage_name)) {
        inferredYears.add(cls.stage_name);
      }
      const txt = `${cls.class_name || ''} ${cls.stage_name || ''}`;
      STAGE_OPTIONS.forEach(st => {
        if (txt.includes(st)) inferredYears.add(st);
      });
    });

    const filteredYears = [...inferredYears]
      .filter(Boolean)
      .filter(yr => !deletedYears.includes(yr))
      .map(yr => scopeRenames[yr] || yr);

    const years = [...new Set(filteredYears)].map(yrName => {
      const classesForYr = groupClasses.filter(
        c => c.stage_name === yrName || String(c.class_name || '').includes(yrName)
      );
      return { yearName: yrName, classes: classesForYr };
    });

    return {
      matchedGroup,
      groupStages: filteredYears,
      groupClasses,
      years
    };
  };

  const isBoundToSpecificService = (scope) => {
    if (!scope) return false;
    if (servantBoundMainGroups.includes(scope)) return true;
    return rawBoundTargets.some(t => resolveParentGroupName(t) === scope);
  };

  const memberMatchesScope = (m, scope, genderFilter = 'الكل', yearFilter = '', classFilter = '') => {
    if (!scope) return false;
    const mClass = (m.assigned_class || '').trim();
    const mStages = `${m.detailed_stage || ''} ${m.service_stage || ''}`;
    const mExtra = Array.isArray(m.permissions?.extra_services) ? m.permissions.extra_services.join(' ') : '';
    const combinedMemberText = `${mClass} ${mStages} ${mExtra}`;

    const { matchedGroup, groupStages, groupClasses } = getScopeStructure(scope);
    const groupClassNames = groupClasses.map(s => (s.class_name || '').trim()).filter(Boolean);

    const matchesServiceOrClass =
      mClass === scope ||
      mStages.includes(scope) ||
      mExtra.includes(scope) ||
      groupStages.some(st => combinedMemberText.includes(st)) ||
      groupClassNames.some(cName => mClass === cName || combinedMemberText.includes(cName)) ||
      (matchedGroup && combinedMemberText.includes(matchedGroup.group_name));

    if (!matchesServiceOrClass) return false;

    if (yearFilter && !combinedMemberText.includes(yearFilter)) {
      const yrObj = getScopeStructure(scope).years.find(y => y.yearName === yearFilter);
      const yrClassNames = (yrObj?.classes || []).map(c => c.class_name);
      if (!yrClassNames.includes(mClass)) return false;
    }

    if (classFilter && mClass !== classFilter && !combinedMemberText.includes(classFilter)) {
      return false;
    }

    if (genderFilter === 'بنين') {
      return isMaleMember(m) || mClass.includes('بنين');
    }
    if (genderFilter === 'بنات') {
      return isFemaleMember(m) || mClass.includes('بنات');
    }

    const boundGender = servant?.permissions?.service_gender_scope;
    if (!isAdminUser && isPrepOrSecondaryScope(scope) && boundGender && boundGender !== 'الكل') {
      if (boundGender === 'بنين') return isMaleMember(m) || mClass.includes('بنين');
      if (boundGender === 'بنات') return isFemaleMember(m) || mClass.includes('بنات');
    }

    return true;
  };

  const handleAddMainService = () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    if (localGroups.some(g => g.group_name === trimmed)) {
      setSelectedScope(trimmed);
      setNewGroupName('');
      return;
    }
    const created = {
      id: `grp-${Date.now()}`,
      group_name: trimmed,
      icon: '⛪',
      stages: []
    };
    const nextGroups = [...localGroups, created];
    notifyStructureChange(nextGroups, localServices, { type: 'add_group', group: created });
    setSelectedScope(trimmed);
    setSelectedYearFilter('');
    setSelectedClassFilter('');
    setNewGroupName('');
  };

  const handleSaveGroupRename = (oldName) => {
    const trimmed = editingGroupValue.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingGroupOriginal('');
      return;
    }
    const exists = localGroups.some(g => g.group_name === oldName);
    const nextGroups = exists
      ? localGroups.map(g => (g.group_name === oldName ? { ...g, group_name: trimmed } : g))
      : [...localGroups, { id: `grp-${Date.now()}`, group_name: trimmed, icon: '⛪', stages: [] }];

    const nextServices = localServices.map(s =>
      s.stage_name === oldName ? { ...s, stage_name: trimmed } : s
    );

    setCustomGroupYears(prev => {
      const copy = { ...prev };
      if (copy[oldName]) {
        copy[trimmed] = copy[oldName];
        delete copy[oldName];
      }
      return copy;
    });

    notifyStructureChange(nextGroups, nextServices, { type: 'rename_group', oldName, newName: trimmed });
    if (selectedScope === oldName) setSelectedScope(trimmed);
    setEditingGroupOriginal('');
  };

  const handleDeleteGroup = (groupName) => {
    if (!window.confirm(`هل أنت متأكد من حذف الخدمة "${groupName}"؟`)) return;
    const nextGroups = localGroups.filter(g => g.group_name !== groupName);
    const nextServices = localServices.filter(s => s.stage_name !== groupName);
    notifyStructureChange(nextGroups, nextServices, { type: 'delete_group', groupName });
    if (selectedScope === groupName) {
      const fallback = nextGroups[0]?.group_name || CORE_SERVICE_GROUPS[0];
      setSelectedScope(fallback);
      setSelectedYearFilter('');
      setSelectedClassFilter('');
    }
  };

  const handleAddYearToScope = () => {
    const trimmed = newYearName.trim();
    if (!trimmed || !selectedScope) return;

    setCustomGroupYears(prev => ({
      ...prev,
      [selectedScope]: [...new Set([...(prev[selectedScope] || []), trimmed])]
    }));
    setDeletedYearsByGroup(prev => ({
      ...prev,
      [selectedScope]: (prev[selectedScope] || []).filter(y => y !== trimmed)
    }));

    const existsInGroups = localGroups.some(g => g.group_name === selectedScope);
    const nextGroups = existsInGroups
      ? localGroups.map(g => {
          if (g.group_name !== selectedScope) return g;
          const currentStages = normalizeGroupStages(g.stages);
          if (currentStages.includes(trimmed)) return g;
          return { ...g, stages: [...currentStages, trimmed] };
        })
      : [
          ...localGroups,
          {
            id: `grp-${Date.now()}`,
            group_name: selectedScope,
            icon: '🏫',
            stages: [trimmed]
          }
        ];

    notifyStructureChange(nextGroups, localServices, { type: 'add_year', scope: selectedScope, yearName: trimmed });
    setSelectedYearFilter(trimmed);
    setSelectedClassFilter('');
    setNewYearName('');
  };

  const handleSaveYearRename = (oldYear) => {
    const trimmed = editingYearValue.trim();
    if (!trimmed || trimmed === oldYear) {
      setEditingYearOriginal('');
      return;
    }

    setRenamedYearsMap(prev => ({
      ...prev,
      [selectedScope]: {
        ...(prev[selectedScope] || {}),
        [oldYear]: trimmed
      }
    }));

    const existsInGroups = localGroups.some(g => g.group_name === selectedScope);
    const nextGroups = existsInGroups
      ? localGroups.map(g => {
          if (g.group_name !== selectedScope) return g;
          const currentStages = normalizeGroupStages(g.stages);
          const updated = currentStages.includes(oldYear)
            ? currentStages.map(st => (st === oldYear ? trimmed : st))
            : [...currentStages, trimmed];
          return { ...g, stages: [...new Set(updated)] };
        })
      : [
          ...localGroups,
          {
            id: `grp-${Date.now()}`,
            group_name: selectedScope,
            icon: '🏫',
            stages: [trimmed]
          }
        ];

    const nextServices = localServices.map(s =>
      s.stage_name === oldYear ? { ...s, stage_name: trimmed } : s
    );

    notifyStructureChange(nextGroups, nextServices, { type: 'rename_year', scope: selectedScope, oldYear, newYear: trimmed });
    if (selectedYearFilter === oldYear) setSelectedYearFilter(trimmed);
    setEditingYearOriginal('');
  };

  const handleDeleteYear = (yearName) => {
    if (!window.confirm(`هل تريد حذف "${yearName}" من ${selectedScope}؟`)) return;

    setDeletedYearsByGroup(prev => ({
      ...prev,
      [selectedScope]: [...new Set([...(prev[selectedScope] || []), yearName])]
    }));

    const nextGroups = localGroups.map(g => {
      if (g.group_name !== selectedScope) return g;
      return { ...g, stages: normalizeGroupStages(g.stages).filter(st => st !== yearName) };
    });
    const nextServices = localServices.filter(s => s.stage_name !== yearName);
    notifyStructureChange(nextGroups, nextServices, { type: 'delete_year', scope: selectedScope, yearName });
    if (selectedYearFilter === yearName) {
      setSelectedYearFilter('');
      setSelectedClassFilter('');
    }
  };

  const handleAddClassToCurrentLevel = () => {
    const trimmed = newClassName.trim();
    if (!trimmed) return;
    const targetStage = selectedYearFilter || selectedScope;
    const createdClass = {
      id: `cls-${Date.now()}`,
      stage_name: targetStage,
      class_name: trimmed
    };
    const nextServices = [...localServices, createdClass];
    notifyStructureChange(localGroups, nextServices, { type: 'add_class', classItem: createdClass });
    setSelectedClassFilter(trimmed);
    setNewClassName('');
  };

  const handleDeleteClass = (classItem) => {
    if (!window.confirm(`هل تريد حذف الفصل "${classItem.class_name}"؟`)) return;
    const nextServices = localServices.filter(s => s.id !== classItem.id);
    notifyStructureChange(localGroups, nextServices, { type: 'delete_class', classItem });
    if (selectedClassFilter === classItem.class_name) {
      setSelectedClassFilter('');
    }
  };

  const displayedServiceTabs = showAllChurchServices
    ? availableServicesList
    : (servantBoundMainGroups.length > 0 ? servantBoundMainGroups : availableServicesList);

  const allMembers = users.filter(u => u.role === 'member');
  const scopeMembers = allMembers.filter(m =>
    memberMatchesScope(m, selectedScope, selectedGenderFilter, selectedYearFilter, selectedClassFilter)
  );

  const currentScopeStructure = getScopeStructure(selectedScope);
  const currentYearObj = currentScopeStructure.years.find(y => y.yearName === selectedYearFilter) || null;
  const visibleClassesForSelection = currentYearObj
    ? currentYearObj.classes
    : currentScopeStructure.groupClasses;

  const scopeMemberIds = new Set(scopeMembers.map(m => m.id));
  const scopeBirthdays = birthdays.filter(b => scopeMemberIds.has(b.id));

  const getAttendanceInfo = (memberId) => {
    const mActs = activities
      .filter(a => a.member_id === memberId)
      .sort((a, b) => new Date(b.activity_date) - new Date(a.activity_date));

    if (mActs.length === 0) {
      return {
        needsFollowUp: true,
        label: 'لم يسجل حضور بعد',
        badgeColor: 'bg-gray-100 text-gray-700',
        accentBar: 'border-r-4 border-r-gray-400',
        avatarTone: 'bg-slate-100 text-slate-700 border-slate-200'
      };
    }
    const lastAct = mActs[0];
    const daysSinceLast = Math.floor((Date.now() - new Date(lastAct.activity_date).getTime()) / 86400000);
    if (!lastAct.attended || daysSinceLast > 14) {
      return {
        needsFollowUp: true,
        label: !lastAct.attended ? 'غائب آخر لقاء ⚠️' : `مفتقد منذ ${daysSinceLast} يوم ⚠️`,
        badgeColor: 'bg-red-100 text-red-800',
        accentBar: 'border-r-4 border-r-red-600',
        avatarTone: 'bg-red-50 text-[#7a1c24] border-red-200'
      };
    }
    return {
      needsFollowUp: false,
      label: 'حضر آخر لقاء ✅',
      badgeColor: 'bg-green-100 text-green-800',
      accentBar: 'border-r-4 border-r-emerald-600',
      avatarTone: 'bg-emerald-50 text-emerald-800 border-emerald-200'
    };
  };

  const getInitials = (fullName = '') => {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'م';
    if (parts.length === 1) return parts[0].slice(0, 2);
    return `${parts[0][0]}${parts[1][0]}`;
  };

  const followUpMembers = scopeMembers.filter(m => getAttendanceInfo(m.id).needsFollowUp);
  const basePool = viewMode === 'followup' ? followUpMembers : scopeMembers;

  const displayedMembers = searchQuery.trim() === ''
    ? basePool
    : basePool.filter(m => (
      (m.full_name || '') + ' ' +
      (m.phone || '') + ' ' +
      (m.father_full_name || '') + ' ' +
      (m.mother_full_name || '') + ' ' +
      (m.address || '') + ' ' +
      (m.assigned_class || '')
    ).toLowerCase().includes(searchQuery.toLowerCase()));

  const openAddMemberModal = () => {
    if (!canAdd) return alert('🔒 غير مسموح لك بإضافة مخدومين حسب صلاحياتك الحالية.');
    const matchingClass = localServices.find(
      s =>
        s.class_name === (selectedClassFilter || selectedScope) ||
        s.stage_name === (selectedYearFilter || selectedScope)
    );
    const defaultGenderForModal =
      selectedGenderFilter === 'بنات' ? 'أنثى' :
      selectedGenderFilter === 'بنين' ? 'ذكر' : 'ذكر';

    setNewMember({
      ...emptyMember,
      gender: defaultGenderForModal,
      assigned_class: selectedClassFilter || matchingClass?.class_name || splitCommaClasses(assignedClass)[0] || '',
      detailed_stage: selectedYearFilter || (STAGE_OPTIONS.includes(selectedScope) ? selectedScope : (matchingClass?.stage_name || selectedScope || baseStages[0] || 'أولى ابتدائي')),
      service_stage: selectedYearFilter || (STAGE_OPTIONS.includes(selectedScope) ? selectedScope : (matchingClass?.stage_name || selectedScope || baseStages[0] || 'أولى ابتدائي'))
    });
    setShowAddModal(true);
  };

  const handleCreateMember = (e) => {
    e.preventDefault();
    if (!canAdd) return;
    const full_name = [newMember.first_name, newMember.second_name, newMember.third_name, newMember.fourth_name].map(s => s.trim()).filter(Boolean).join(' ');
    const father_full_name = [newMember.father_first, newMember.father_second, newMember.father_third, newMember.father_fourth].map(s => s.trim()).filter(Boolean).join(' ');
    const mother_full_name = [newMember.mother_first, newMember.mother_second, newMember.mother_third, newMember.mother_fourth].map(s => s.trim()).filter(Boolean).join(' ');

    if (!full_name || !father_full_name || !mother_full_name || !newMember.father_phone || !newMember.mother_phone) {
      alert('يجب إدخال الاسم الرباعي للمخدوم، وأسماء وأرقام تليفونات الأب والأم بشكل إلزامي!');
      return;
    }

    if (typeof onAddMember === 'function') {
      onAddMember({
        ...newMember,
        full_name,
        father_full_name,
        mother_full_name,
        service_stage: newMember.detailed_stage,
        username: newMember.username ? newMember.username.trim().toLowerCase() : ('m_' + Date.now()),
        password: newMember.password || '123',
        dob: newMember.dob || null
      });
    }

    setShowAddModal(false);
    setNewMember(emptyMember);
  };

  const handleNoteSubmit = (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    if (typeof onSaveMemberNote === 'function') {
      onSaveMemberNote({ member_id: noteMember.id, author_id: servant?.id, note_text: newNoteText, behavior_tag: newNoteTag });
    }
    setNewNoteText('');
    setNoteModal(false);
  };

  if (canExtractSheet && showMasterSheet) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="bg-white p-4 rounded-2xl border shadow-2xs flex justify-between items-center print:hidden">
          <button
            type="button"
            onClick={() => setShowMasterSheet(false)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black cursor-pointer"
          >
            ← رجوع لشاشة الخدمة
          </button>
          <span className="text-xs font-black text-[#7a1c24]">📋 شيت التسلسل والافتقاد</span>
        </div>
        <MasterCongregationSheet
          users={users}
          currentUser={servant}
          onRefresh={onRefresh}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <BirthdayBanner birthdays={scopeBirthdays} />

      {canExtractSheet && (
        <div className="bg-teal-50/70 border border-teal-200 p-3.5 rounded-2xl flex flex-wrap justify-between items-center gap-2 text-xs">
          <div className="font-bold text-teal-950">
            📋 {isAdminUser ? 'بصفتك سوبر أدمن' : 'بصفتك أمين الخدمة'}، يمكنك سحب شيت التسلسل والافتقاد والترحيم وتصديره أو طباعته.
          </div>
          <button
            type="button"
            onClick={() => setShowMasterSheet(true)}
            className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet size={15} /> فتح شيت التسلسل والافتقاد
          </button>
        </div>
      )}

      <div className="space-y-3 bg-white p-4 rounded-3xl border border-gray-200 shadow-2xs">
        <div className="flex flex-wrap justify-between items-center gap-2 px-1">
          <div className="flex items-center gap-1.5 text-xs font-black text-gray-800">
            <Layers size={15} className="text-[#7a1c24]" /> الخدمات الرئيسية (اضغط على الخدمة لفتح سنواتها وفصولها بالداخل):
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setShowAllChurchServices(true)}
              className={`px-3 py-1 rounded-xl cursor-pointer transition ${showAllChurchServices ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              كل خدمات الكنيسة ({availableServicesList.length})
            </button>
            {servantBoundMainGroups.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowAllChurchServices(false);
                  if (!servantBoundMainGroups.includes(selectedScope)) {
                    setSelectedScope(servantBoundMainGroups[0]);
                    setSelectedYearFilter('');
                    setSelectedClassFilter('');
                  }
                }}
                className={`px-3 py-1 rounded-xl cursor-pointer transition ${!showAllChurchServices ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                خدماتي المربوطة ({servantBoundMainGroups.length})
              </button>
            )}
            {canManageStructure && (
              <button
                type="button"
                onClick={() => setEditMode(prev => !prev)}
                className={`px-3 py-1 rounded-xl cursor-pointer transition flex items-center gap-1 ${
                  editMode ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-900 border border-amber-200'
                }`}
              >
                <Pencil size={12} /> {editMode ? 'إنهاء التعديل' : 'إضافة / تعديل / حذف'}
              </button>
            )}
          </div>
        </div>

        {editMode && canManageStructure && (
          <div className="bg-amber-50/70 p-3 rounded-2xl border border-amber-200 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-black text-amber-950">إضافة خدمة رئيسية جديدة:</span>
            <input
              type="text"
              placeholder="مثال: خدمة الشباب أو خدمة أسر..."
              className="px-3 py-1.5 bg-white border rounded-xl text-xs font-bold flex-1 min-w-[180px]"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
            />
            <button
              type="button"
              onClick={handleAddMainService}
              className="px-3.5 py-1.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> إضافة خدمة
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {displayedServiceTabs.map((srv, idx) => {
            const count = allMembers.filter(m => memberMatchesScope(m, srv, selectedGenderFilter)).length;
            const srvStructure = getScopeStructure(srv);
            const isSelected = selectedScope === srv;
            const isBound = isBoundToSpecificService(srv);

            return (
              <div
                key={idx}
                className={`p-3.5 rounded-3xl border transition shadow-2xs flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-linear-to-l from-[#5c1319] to-[#7a1c24] text-white border-[#7a1c24]'
                    : 'bg-[#fbfaf7] text-gray-900 hover:bg-red-50/40 border-gray-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedScope(srv);
                    setSelectedYearFilter('');
                    setSelectedClassFilter('');
                    setSearchQuery('');
                    if (srv.includes('بنات')) setSelectedGenderFilter('بنات');
                    else if (srv.includes('بنين')) setSelectedGenderFilter('بنين');
                  }}
                  className="w-full text-right cursor-pointer flex justify-between items-start gap-2"
                >
                  <div>
                    <span className={`text-[10px] font-bold block mb-0.5 ${isSelected ? 'text-amber-200' : 'text-gray-400'}`}>
                      {isAdminUser ? '🛡️ متاح للسوبر أدمن' : (isBound ? '⭐ خدمة مخصصة لك' : '⛪ خدمة بالكنيسة')}
                    </span>
                    <strong className="text-sm sm:text-base font-black block">{srv}</strong>
                    <span className={`text-[10px] font-bold block mt-1 ${isSelected ? 'text-white/85' : 'text-gray-500'}`}>
                      {srvStructure.years.length} سنوات/مراحل • {srvStructure.groupClasses.length} فصول
                    </span>
                  </div>
                  <div className={`px-3 py-1 rounded-2xl text-xs font-black shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-red-50 text-[#7a1c24]'}`}>
                    {count} مخدوم
                  </div>
                </button>

                {editMode && canManageStructure && (
                  <div className="pt-2 border-t border-black/10 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                    {editingGroupOriginal === srv ? (
                      <div className="flex items-center gap-1 w-full">
                        <input
                          type="text"
                          className="px-2 py-1 rounded-lg bg-white text-gray-900 border flex-1 text-xs font-bold"
                          value={editingGroupValue}
                          onChange={e => setEditingGroupValue(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveGroupRename(srv)}
                          className="px-2 py-1 bg-green-700 text-white rounded-lg cursor-pointer"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingGroupOriginal('')}
                          className="px-2 py-1 bg-gray-200 text-gray-800 rounded-lg cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGroupOriginal(srv);
                            setEditingGroupValue(srv);
                          }}
                          className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer ${
                            isSelected ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-white text-gray-800 border'
                          }`}
                        >
                          <Pencil size={11} /> تعديل الاسم
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(srv)}
                          className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer ${
                            isSelected ? 'bg-red-950/60 text-red-100 hover:bg-red-950' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          <Trash2 size={11} /> حذف
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-[#fbfaf7] p-3.5 rounded-2xl border border-amber-200/80 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 font-black">
              <button
                type="button"
                onClick={() => {
                  setSelectedYearFilter('');
                  setSelectedClassFilter('');
                }}
                className={`px-3 py-1 rounded-xl cursor-pointer ${
                  !selectedYearFilter && !selectedClassFilter ? 'bg-[#7a1c24] text-white' : 'bg-white border text-gray-800'
                }`}
              >
                🏫 {selectedScope}
              </button>
              {selectedYearFilter && (
                <>
                  <span className="text-gray-400">/</span>
                  <button
                    type="button"
                    onClick={() => setSelectedClassFilter('')}
                    className={`px-3 py-1 rounded-xl cursor-pointer ${
                      !selectedClassFilter ? 'bg-amber-700 text-white' : 'bg-amber-50 border text-amber-950'
                    }`}
                  >
                    📘 {selectedYearFilter}
                  </button>
                </>
              )}
              {selectedClassFilter && (
                <>
                  <span className="text-gray-400">/</span>
                  <span className="px-3 py-1 rounded-xl bg-blue-700 text-white">
                    📖 {selectedClassFilter}
                  </span>
                </>
              )}
            </div>

            {(selectedYearFilter || selectedClassFilter) && (
              <button
                type="button"
                onClick={() => {
                  if (selectedClassFilter) setSelectedClassFilter('');
                  else setSelectedYearFilter('');
                }}
                className="px-2.5 py-1 bg-white hover:bg-gray-100 border rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <ArrowRight size={12} /> رجوع للمستوى السابق
              </button>
            )}
          </div>

          {currentScopeStructure.matchedGroup && (
            <div className="flex flex-wrap gap-3 text-[11px] text-gray-600 font-bold">
              {currentScopeStructure.matchedGroup.head_servant_name && (
                <span>⭐ الأمين: <strong className="text-gray-900">{currentScopeStructure.matchedGroup.head_servant_name}</strong></span>
              )}
              {(currentScopeStructure.matchedGroup.service_day || currentScopeStructure.matchedGroup.start_time) && (
                <span>
                  ⏰ {currentScopeStructure.matchedGroup.service_day}
                  {currentScopeStructure.matchedGroup.start_time && ` (${currentScopeStructure.matchedGroup.start_time}`}
                  {currentScopeStructure.matchedGroup.end_time && ` - ${currentScopeStructure.matchedGroup.end_time}`}
                  {currentScopeStructure.matchedGroup.start_time && ')'}
                </span>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-gray-700 block">
              السنوات / المراحل داخل ({selectedScope}):
            </span>
            {currentScopeStructure.years.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {currentScopeStructure.years.map((yr, yIdx) => {
                  const yrCount = allMembers.filter(m => memberMatchesScope(m, selectedScope, selectedGenderFilter, yr.yearName, '')).length;
                  const activeYr = selectedYearFilter === yr.yearName;

                  return (
                    <div
                      key={yIdx}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition ${
                        activeYr ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-gray-800 hover:bg-amber-50'
                      }`}
                    >
                      {editMode && editingYearOriginal === yr.yearName ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            className="px-2 py-0.5 rounded bg-white text-gray-900 border text-xs font-bold"
                            value={editingYearValue}
                            onChange={e => setEditingYearValue(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveYearRename(yr.yearName)}
                            className="px-1.5 py-0.5 bg-green-700 text-white rounded cursor-pointer"
                          >
                            <Check size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingYearOriginal('')}
                            className="px-1.5 py-0.5 bg-gray-200 text-gray-800 rounded cursor-pointer"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedYearFilter(activeYr ? '' : yr.yearName);
                              setSelectedClassFilter('');
                            }}
                            className="cursor-pointer font-bold"
                          >
                            {yr.yearName} ({yrCount})
                          </button>
                          {editMode && canManageStructure && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingYearOriginal(yr.yearName);
                                  setEditingYearValue(yr.yearName);
                                }}
                                className="p-0.5 hover:opacity-80 cursor-pointer"
                                title="تعديل الاسم"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteYear(yr.yearName)}
                                className="p-0.5 hover:opacity-80 cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 size={11} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-gray-500">لا توجد سنوات مسجلة بعد داخل هذه الخدمة — يمكنك إضافتها مباشرة من هنا.</p>
            )}

            {editMode && canManageStructure && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <input
                  type="text"
                  placeholder={`إضافة سنة أو اجتماع جديد داخل ${selectedScope}...`}
                  className="px-3 py-1.5 bg-white border rounded-xl text-xs font-bold min-w-[180px]"
                  value={newYearName}
                  onChange={e => setNewYearName(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleAddYearToScope}
                  className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} /> إضافة سنة / اجتماع
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-1 border-t border-amber-200/60">
            <span className="text-[11px] font-bold text-gray-700 block">
              الفصول {selectedYearFilter ? `التابعة لـ (${selectedYearFilter})` : `التابعة لـ (${selectedScope})`}:
            </span>
            {visibleClassesForSelection.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {visibleClassesForSelection.map((cls) => {
                  const clsCount = allMembers.filter(m => memberMatchesScope(m, selectedScope, selectedGenderFilter, selectedYearFilter, cls.class_name)).length;
                  const activeCls = selectedClassFilter === cls.class_name;
                  return (
                    <div
                      key={cls.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition ${
                        activeCls ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-blue-950 hover:bg-blue-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedClassFilter(activeCls ? '' : cls.class_name)}
                        className="inline-flex items-center gap-1 cursor-pointer font-bold"
                      >
                        <BookOpen size={12} /> {cls.class_name} ({clsCount})
                      </button>
                      {editMode && canManageStructure && (
                        <button
                          type="button"
                          onClick={() => handleDeleteClass(cls)}
                          className="p-0.5 hover:opacity-80 cursor-pointer"
                          title="حذف الفصل"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-gray-500">لا توجد فصول مضافة في هذا المستوى حالياً.</p>
            )}

            {editMode && canManageStructure && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <input
                  type="text"
                  placeholder={`إضافة فصل داخل (${selectedYearFilter || selectedScope})...`}
                  className="px-3 py-1.5 bg-white border rounded-xl text-xs font-bold min-w-[180px]"
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleAddClassToCurrentLevel}
                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} /> إضافة فصل
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-gray-700">
            تخصيص الفئة داخل <strong className="text-[#7a1c24]">{selectedClassFilter || selectedYearFilter || selectedScope}</strong> (مفيد في إعدادي وثانوي):
          </span>
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl font-bold">
            {GENDER_SCOPES.map(gScope => (
              <button
                key={gScope}
                type="button"
                onClick={() => setSelectedGenderFilter(gScope)}
                className={`px-3 py-1 rounded-lg cursor-pointer transition ${
                  selectedGenderFilter === gScope ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-white'
                }`}
              >
                {gScope === 'الكل' ? '👥 الكل' : gScope === 'بنين' ? '♂️ بنين' : '♀️ بنات'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* قسم التحكم وكارت البحث السريع في وش الصفحة */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3.5 text-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-gray-900">
              📖 {selectedScope}
              {selectedYearFilter ? ` ← ${selectedYearFilter}` : ''}
              {selectedClassFilter ? ` ← ${selectedClassFilter}` : ''}
              {selectedGenderFilter !== 'الكل' ? ` (${selectedGenderFilter})` : ''}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-gray-500 font-bold">المسؤول: {servant?.full_name || ''}</span>
              <span className="px-2.5 py-0.5 bg-gray-100 text-gray-800 rounded-full font-bold text-[11px]">
                المخدومين: {scopeMembers.length}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${followUpMembers.length > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                يحتاجون افتقاد: {followUpMembers.length}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center bg-gray-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setCardDensity('compact')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition ${
                  cardDensity === 'compact' ? 'bg-white text-[#7a1c24] shadow-2xs' : 'text-gray-600'
                }`}
                title="عرض مدمج لتقليل السكرول"
              >
                <LayoutGrid size={13} /> عرض مدمج
              </button>
              <button
                type="button"
                onClick={() => setCardDensity('detailed')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition ${
                  cardDensity === 'detailed' ? 'bg-white text-[#7a1c24] shadow-2xs' : 'text-gray-600'
                }`}
                title="عرض تفصيلي كامل"
              >
                <List size={13} /> عرض تفصيلي
              </button>
            </div>

            {canAdd && (
              <button
                type="button"
                onClick={openAddMemberModal}
                className="flex-1 md:flex-initial px-4 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white text-xs font-black rounded-2xl flex items-center justify-center gap-1.5 shadow cursor-pointer transition"
              >
                <UserPlus size={16} /> إضافة مخدوم للفصل
              </button>
            )}
          </div>
        </div>

        {/* كارت البحث السريع المباشر في وش الصفحة */}
        <div className="bg-linear-to-l from-[#fbfaf7] to-red-50/40 p-3.5 rounded-2xl border border-amber-200/90 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-black text-[#7a1c24] flex items-center gap-1.5 text-xs">
              <Sparkles size={14} /> كارت البحث السريع (وصول فوري لأي مخدوم بدون سكرول طويل)
            </span>
            <span className="text-[11px] font-bold text-gray-600">
              الظاهر حالياً: <strong className="text-gray-900">{displayedMembers.length}</strong> من {basePool.length}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center">
            <div className="lg:col-span-7 relative">
              <Search size={16} className="absolute right-3.5 top-3 text-[#7a1c24]" />
              <input
                type="text"
                placeholder="اكتب اسم المخدوم، الأب، الأم، رقم التليفون، أو العنوان للوصول السريع..."
                className="w-full pr-10 pl-9 py-2.5 bg-white border border-gray-300 rounded-2xl text-xs font-bold outline-none focus:border-[#7a1c24] transition"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-2.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                  title="مسح البحث"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="lg:col-span-5 grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`py-2 px-3 rounded-xl font-bold cursor-pointer transition text-center ${
                  viewMode === 'list' ? 'bg-gray-900 text-white shadow-xs' : 'text-gray-700 hover:bg-white/60'
                }`}
              >
                كل المخدومين ({scopeMembers.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('followup')}
                className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer transition ${
                  viewMode === 'followup' ? 'bg-red-700 text-white shadow-xs' : 'text-red-800 hover:bg-red-50'
                }`}
              >
                <AlertTriangle size={14} /> الافتقاد ({followUpMembers.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {displayedMembers.length === 0 ? (
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-dashed border-gray-300 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#7a1c24] flex items-center justify-center mx-auto">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-black text-gray-800">لا يوجد مخدومون في هذه القائمة حالياً</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {searchQuery ? 'جرّب البحث بكلمة مختلفة أو امسح خانة البحث.' : 'يمكنك إضافة أول مخدوم للفصل بسهولة من الزر بالأسفل.'}
            </p>
          </div>
          {!searchQuery && viewMode === 'list' && canAdd && (
            <button
              type="button"
              onClick={openAddMemberModal}
              className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus size={15} /> إضافة مخدوم الآن
            </button>
          )}
        </div>
      ) : (
        <div className={cardDensity === 'compact' ? 'grid grid-cols-1 xl:grid-cols-2 gap-3' : 'grid gap-3'}>
          {displayedMembers.map((m, index) => {
            const mActs = activities.filter(a => a.member_id === m.id);
            const mNotes = memberNotes.filter(
              n => n.member_id === m.id && !hiddenNotes[n.id] && !n.is_read && !n.acknowledged
            );
            const attInfo = getAttendanceInfo(m.id);
            const callPhone = m.phone || m.father_phone || m.mother_phone;

            return (
              <div
                key={m.id}
                className={`p-4 rounded-3xl border text-xs space-y-3 shadow-2xs hover:shadow-sm transition bg-white border-gray-200 ${attInfo.accentBar}`}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                  <div className="flex items-start gap-2.5 w-full">
                    <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center font-black text-xs shrink-0 ${attInfo.avatarTone}`}>
                      {getInitials(m.full_name)}
                    </div>

                    <div className="space-y-1.5 w-full min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 bg-[#7a1c24] text-white rounded-lg text-[10px] font-black">#{index + 1}</span>
                        <h3 className="text-sm font-black text-gray-900">{m.full_name}</h3>
                        {m.gender && (
                          <span className="px-2 py-0.5 bg-pink-50 text-pink-900 rounded-lg text-[10px] font-bold">
                            {m.gender === 'أنثى' ? '♀️ بنات' : '♂️ بنين'}
                          </span>
                        )}
                        {m.assigned_class && (
                          <span className="px-2 py-0.5 bg-red-50 text-[#7a1c24] rounded-lg text-[10px] font-bold">
                            ⛪ {m.assigned_class}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${attInfo.badgeColor}`}>
                          {attInfo.label}
                        </span>
                      </div>

                      <div className="text-gray-600 space-y-1 text-[11px]">
                        <p className="flex flex-wrap gap-x-3 gap-y-1">
                          <span>👨‍👦 الأب: <strong className="text-gray-800">{m.father_full_name || '—'}</strong> (📞 {m.father_phone || '—'})</span>
                          <span>👩‍👦 الأم: <strong className="text-gray-800">{m.mother_full_name || '—'}</strong> (📞 {m.mother_phone || '—'})</span>
                        </p>
                        <p className="text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-1"><Phone size={11} /> {m.phone || 'غير مسجل'}</span>
                          <span className="inline-flex items-center gap-1"><MapPin size={11} /> {m.address || 'بدون عنوان'}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                  {callPhone ? (
                    <>
                      <a
                        href={`https://wa.me/2${callPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-1 transition"
                      >
                        <MessageCircle size={13} /> واتس
                      </a>
                      <a
                        href={`tel:${callPhone}`}
                        className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold flex items-center justify-center gap-1 transition"
                      >
                        <Phone size={13} /> اتصال
                      </a>
                    </>
                  ) : (
                    <>
                      <span className="px-2.5 py-2 bg-gray-50 text-gray-400 rounded-xl font-bold flex items-center justify-center gap-1">
                        <MessageCircle size={13} /> واتس
                      </span>
                      <span className="px-2.5 py-2 bg-gray-50 text-gray-400 rounded-xl font-bold flex items-center justify-center gap-1">
                        <Phone size={13} /> اتصال
                      </span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => { setNoteMember(m); setNoteModal(true); }}
                    className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <MessageSquareText size={13} /> ملاحظة ({memberNotes.filter(n => n.member_id === m.id).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedMember(m); setActModal(true); }}
                    className="px-2.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <Calendar size={13} /> حضور ونشاط
                  </button>
                </div>

                {mNotes.length > 0 && (
                  <div className="bg-amber-50/90 p-3 rounded-2xl border border-amber-300 space-y-2 text-[11px]">
                    <span className="font-black text-[#7a1c24] block">🕊️ تنبيهات وملاحظات الأب الكاهن:</span>
                    {mNotes.map(n => (
                      <div key={n.id} className="bg-white p-2.5 rounded-xl border border-amber-200 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div className="space-y-1">
                          <span className="px-1.5 py-0.5 bg-red-100 text-[#7a1c24] rounded text-[9px] font-bold ml-1">{n.behavior_tag || 'عادي'}</span>
                          <span className="text-gray-800 font-bold">{n.note_text}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAcknowledgeNote(n)}
                          className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-xl font-bold text-[11px] shrink-0 cursor-pointer self-end sm:self-center transition"
                        >
                          علمت ✅
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#fbfaf7] p-2.5 rounded-2xl border border-gray-100 text-[11px]">
                  <div>
                    <span className="text-gray-400 block text-[10px]">أب الاعتراف:</span>
                    <strong className="text-[#7a1c24]">{m.confession_father || 'غير محدد'}</strong>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">الاعتراف:</span>
                    <span className={`px-2 py-0.5 rounded font-bold inline-block text-[10px] ${m.confession_status === 'منتظم' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>
                      {m.confession_status}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">التناول:</span>
                    <strong className={m.has_communion ? 'text-green-700' : 'text-red-600'}>
                      {m.has_communion ? 'تناول ✅' : 'لم يتناول ❌'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">الأنشطة:</span>
                    <strong className="text-blue-700">{mActs.length} نشاط مسجل</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-xl p-4 sm:p-6 space-y-3 text-xs font-bold max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-extrabold text-sm text-[#7a1c24]">إضافة مخدوم جديد لفصل: {selectedClassFilter || selectedYearFilter || selectedScope}</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateMember} className="space-y-3">
              <div className="bg-indigo-50/60 p-3 rounded-2xl border border-indigo-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-indigo-950">اسم المستخدم للدخول *</label>
                  <input required placeholder="andrew.1990" className="w-full p-2 border rounded-xl bg-white" value={newMember.username} onChange={e => setNewMember({ ...newMember, username: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-1 text-indigo-950">كلمة المرور *</label>
                  <input required type="text" placeholder="123" className="w-full p-2 border rounded-xl bg-white" value={newMember.password} onChange={e => setNewMember({ ...newMember, password: e.target.value })} />
                </div>
              </div>

              <div className="bg-red-50/50 p-3 rounded-2xl border border-red-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-[#7a1c24]">الفصل المسجل به</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white font-bold"
                    value={newMember.assigned_class}
                    onChange={e => setNewMember({ ...newMember, assigned_class: e.target.value })}
                  >
                    <option value="">-- اختر الفصل --</option>
                    {localServices.map(srv => (
                      <option key={srv.id} value={srv.class_name}>{srv.class_name} ({srv.stage_name})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-[#7a1c24]">النوع *</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white font-bold"
                    value={newMember.gender || 'ذكر'}
                    onChange={e => setNewMember({ ...newMember, gender: e.target.value })}
                  >
                    <option value="ذكر">♂️ ذكر (بنين)</option>
                    <option value="أنثى">♀️ أنثى (بنات)</option>
                  </select>
                </div>
              </div>

              <div className="bg-[#fbfaf7] p-3 rounded-2xl border">
                <label className="block mb-1 text-[#7a1c24]">الاسم الرباعي للمخدوم *</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input required placeholder="الأول *" className="p-2 border rounded-xl bg-white" value={newMember.first_name} onChange={e => setNewMember({ ...newMember, first_name: e.target.value })} />
                  <input required placeholder="الثاني *" className="p-2 border rounded-xl bg-white" value={newMember.second_name} onChange={e => setNewMember({ ...newMember, second_name: e.target.value })} />
                  <input required placeholder="الثالث *" className="p-2 border rounded-xl bg-white" value={newMember.third_name} onChange={e => setNewMember({ ...newMember, third_name: e.target.value })} />
                  <input required placeholder="الرابع *" className="p-2 border rounded-xl bg-white" value={newMember.fourth_name} onChange={e => setNewMember({ ...newMember, fourth_name: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div><label className="block mb-1">تاريخ الميلاد *</label><input required type="date" className="w-full p-2 border rounded-xl bg-white" value={newMember.dob} onChange={e => setNewMember({ ...newMember, dob: e.target.value })} /></div>
                <div><label className="block mb-1">تليفون المخدوم</label><input type="tel" className="w-full p-2 border rounded-xl bg-white" value={newMember.phone} onChange={e => setNewMember({ ...newMember, phone: e.target.value })} /></div>
                <div>
                  <label className="block mb-1">المرحلة *</label>
                  <select className="w-full p-2 border rounded-xl bg-white" value={newMember.detailed_stage} onChange={e => setNewMember({ ...newMember, detailed_stage: e.target.value, service_stage: e.target.value })}>
                    {STAGE_OPTIONS.map((st, i) => <option key={i} value={st}>{st}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-200">
                <label className="block mb-1 text-blue-950">الاسم الرباعي للأب وتليفونه *</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                  <input required placeholder="الأول *" className="p-2 border rounded-xl bg-white" value={newMember.father_first} onChange={e => setNewMember({ ...newMember, father_first: e.target.value })} />
                  <input required placeholder="الثاني *" className="p-2 border rounded-xl bg-white" value={newMember.father_second} onChange={e => setNewMember({ ...newMember, father_second: e.target.value })} />
                  <input required placeholder="الثالث *" className="p-2 border rounded-xl bg-white" value={newMember.father_third} onChange={e => setNewMember({ ...newMember, father_third: e.target.value })} />
                  <input required placeholder="الرابع *" className="p-2 border rounded-xl bg-white" value={newMember.father_fourth} onChange={e => setNewMember({ ...newMember, father_fourth: e.target.value })} />
                </div>
                <input required type="tel" className="w-full p-2 border rounded-xl bg-white" placeholder="رقم تليفون الأب *" value={newMember.father_phone} onChange={e => setNewMember({ ...newMember, father_phone: e.target.value })} />
              </div>

              <div className="bg-pink-50/50 p-3 rounded-2xl border border-pink-200">
                <label className="block mb-1 text-pink-950">الاسم الرباعي للأم وتليفونها *</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                  <input required placeholder="الأول *" className="p-2 border rounded-xl bg-white" value={newMember.mother_first} onChange={e => setNewMember({ ...newMember, mother_first: e.target.value })} />
                  <input required placeholder="الثاني *" className="p-2 border rounded-xl bg-white" value={newMember.mother_second} onChange={e => setNewMember({ ...newMember, mother_second: e.target.value })} />
                  <input required placeholder="الثالث *" className="p-2 border rounded-xl bg-white" value={newMember.mother_third} onChange={e => setNewMember({ ...newMember, mother_third: e.target.value })} />
                  <input required placeholder="الرابع *" className="p-2 border rounded-xl bg-white" value={newMember.mother_fourth} onChange={e => setNewMember({ ...newMember, mother_fourth: e.target.value })} />
                </div>
                <input required type="tel" className="w-full p-2 border rounded-xl bg-white" placeholder="رقم تليفون الأم *" value={newMember.mother_phone} onChange={e => setNewMember({ ...newMember, mother_phone: e.target.value })} />
              </div>

              <div><label className="block mb-1">العنوان السكني *</label><input required className="w-full p-2 border rounded-xl" value={newMember.address} onChange={e => setNewMember({ ...newMember, address: e.target.value })} /></div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-xl cursor-pointer">إلغاء</button>
                <button type="submit" className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer">حفظ المخدوم</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {noteModal && noteMember && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-55">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 sm:p-6 space-y-3 text-xs font-bold">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-[#7a1c24]">تسجيل ملاحظة لـ: {noteMember.full_name}</h3>
              <button type="button" onClick={() => setNoteModal(false)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleNoteSubmit} className="space-y-3">
              <select className="w-full p-2.5 border rounded-xl bg-white" value={newNoteTag} onChange={e => setNewNoteTag(e.target.value)}>
                <option value="عادي">ملاحظة عادية</option>
                <option value="يحتاج متابعة خاصة">يحتاج متابعة خاصة</option>
                <option value="مشاكل عائلية">مشاكل عائلية / ظروف خاصة ⚠️</option>
                <option value="مجد ومجتهد">مجد ومجتهد ⭐</option>
              </select>
              <textarea required className="w-full p-2.5 border rounded-xl" rows="3" placeholder="اكتب الملاحظة..." value={newNoteText} onChange={e => setNewNoteText(e.target.value)} />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNoteModal(false)} className="px-4 py-2 border rounded-xl cursor-pointer">إلغاء</button>
                <button type="submit" className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {actModal && selectedMember && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-55">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 sm:p-6 space-y-3 text-xs font-bold">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-[#7a1c24]">تسجيل حضور أو نشاط لـ: {selectedMember.full_name}</h3>
              <button type="button" onClick={() => setActModal(false)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); if (typeof onSaveActivity === 'function') onSaveActivity(selectedMember.id, actForm); setActModal(false); }} className="space-y-3">
              <select className="w-full p-2.5 border rounded-xl bg-white" value={actForm.activity_type} onChange={e => setActForm({ ...actForm, activity_type: e.target.value })}>
                <option value="مدارس أحد">مدارس أحد</option>
                <option value="قداس">قداس إلهي</option>
                <option value="عشية">صلاة عشية</option>
                <option value="رحلة ترفيهية">رحلة ترفيهية 🏖️</option>
              </select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="date" className="w-full p-2.5 border rounded-xl" value={actForm.activity_date} onChange={e => setActForm({ ...actForm, activity_date: e.target.value })} />
                <select className="w-full p-2.5 border rounded-xl bg-white" value={actForm.attended ? 'yes' : 'no'} onChange={e => setActForm({ ...actForm, attended: e.target.value === 'yes' })}>
                  <option value="yes">حضر ✅</option><option value="no">غائب ❌</option>
                </select>
              </div>
              <input placeholder="ملاحظات الافتقاد أو الغياب..." className="w-full p-2.5 border rounded-xl" value={actForm.notes} onChange={e => setActForm({ ...actForm, notes: e.target.value })} />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setActModal(false)} className="px-4 py-2 border rounded-xl cursor-pointer">إلغاء</button>
                <button type="submit" className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer">حفظ حالة الحضور</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
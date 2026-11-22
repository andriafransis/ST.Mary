import { useState, useEffect } from 'react';
import { Phone, Search, UserPlus, Calendar, MessageSquareText, Layers, MessageCircle, AlertTriangle, Users, MapPin, X, FileSpreadsheet } from 'lucide-react';
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
  onAddMember, onSaveActivity, onSaveMemberNote, onRefresh
}) {
  const canAdd = servant?.permissions?.can_add !== false;
  const canExtractSheet = canExtractMasterSheet(servant);
  const [showMasterSheet, setShowMasterSheet] = useState(false);

  const effectiveGroups = Array.isArray(serviceGroups) && serviceGroups.length > 0
    ? serviceGroups
    : DEFAULT_SERVICE_GROUPS;

  const assignedClass = (servant?.assigned_class || '').trim();
  const baseStages = (servant?.service_stage || servant?.detailed_stage || '')
    .split(/[,،]/)
    .map(s => s.trim())
    .filter(Boolean);
  const extraServices = Array.isArray(servant?.permissions?.extra_services) ? servant.permissions.extra_services : [];

  // جميع الخدمات والمراحل المتاحة في الكنيسة (التي يضيفها الأدمن في الخدمات أو الفصول أو المراحل)
  const allChurchServicesList = [...new Set([
    ...effectiveGroups.map(g => g.group_name).filter(Boolean),
    ...effectiveGroups.flatMap(g => normalizeGroupStages(g.stages)),
    ...services.map(s => s.stage_name).filter(Boolean),
    ...services.map(s => s.class_name).filter(Boolean),
    ...STAGE_OPTIONS
  ])];

  // الخدمات والفصول المربوطة مباشرة بهذا الخادم
  const servantBoundTargets = [...new Set([
    ...(assignedClass ? splitCommaClasses(assignedClass) : []),
    ...baseStages,
    ...extraServices
  ])].filter(Boolean);

  // القائمة الافتراضية المعروضة: خدمات الكنيسة المضافة (إن لم يكن مقيداً بقائمة فرعية ضيقة أو لعرض الكل المضاف من الأدمن)
  const availableServicesList = allChurchServicesList.length > 0
    ? allChurchServicesList
    : (servantBoundTargets.length > 0 ? servantBoundTargets : ['أولى ابتدائي']);

  function splitCommaClasses(val) {
    return String(val || '')
      .split(/[,،]/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  const initialDefaultScope = servantBoundTargets[0] || availableServicesList[0] || 'أولى ابتدائي';
  const [selectedScope, setSelectedScope] = useState(initialDefaultScope);
  const [showAllChurchServices, setShowAllChurchServices] = useState(true);

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
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [hiddenNotes, setHiddenNotes] = useState({});

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
      setSelectedScope(servantBoundTargets[0] || availableServicesList[0]);
    }
  }, [serviceGroups, services, servant]);

  // التحقق هل هذا الخادم/النطاق مخصص لخدمة بعينها أو متعدد الخدمات
  const isBoundToSpecificService = (scope) => {
    if (!scope) return false;
    if (servantBoundTargets.includes(scope)) return true;
    const matchedGroup = effectiveGroups.find(g => g.group_name === scope);
    if (matchedGroup) {
      const subStages = normalizeGroupStages(matchedGroup.stages);
      return subStages.some(st => servantBoundTargets.includes(st)) || servantBoundTargets.includes(matchedGroup.group_name);
    }
    return false;
  };

  const memberMatchesScope = (m, scope, genderFilter = 'الكل') => {
    if (!scope) return false;
    const mClass = (m.assigned_class || '').trim();
    const mStages = `${m.detailed_stage || ''} ${m.service_stage || ''}`;
    const matchedGroup = effectiveGroups.find(g => g.group_name === scope);
    const groupStages = matchedGroup ? normalizeGroupStages(matchedGroup.stages) : [];
    const groupClasses = services
      .filter(s => s.stage_name === scope || (matchedGroup && s.stage_name === matchedGroup.group_name))
      .map(s => (s.class_name || '').trim());

    const matchesServiceOrClass =
      mClass === scope ||
      mStages.includes(scope) ||
      groupStages.some(st => mStages.includes(st) || mClass.includes(st)) ||
      groupClasses.includes(mClass);

    if (!matchesServiceOrClass) return false;

    // فلترة النوع (بنين / بنات) في إعدادي وثانوي أو عند اختيار بنين/بنات
    if (genderFilter === 'بنين') {
      return isMaleMember(m) || mClass.includes('بنين');
    }
    if (genderFilter === 'بنات') {
      return isFemaleMember(m) || mClass.includes('بنات');
    }

    // لو الخادم محدد له بنين أو بنات في صلاحياته في إعدادي/ثانوي
    const boundGender = servant?.permissions?.service_gender_scope;
    if (isPrepOrSecondaryScope(scope) && boundGender && boundGender !== 'الكل') {
      if (boundGender === 'بنين') return isMaleMember(m) || mClass.includes('بنين');
      if (boundGender === 'بنات') return isFemaleMember(m) || mClass.includes('بنات');
    }

    return true;
  };

  const displayedServiceTabs = showAllChurchServices
    ? availableServicesList
    : (servantBoundTargets.length > 0 ? servantBoundTargets : availableServicesList);

  const allMembers = users.filter(u => u.role === 'member');
  const scopeMembers = allMembers.filter(m => memberMatchesScope(m, selectedScope, selectedGenderFilter));

  const scopeMemberIds = new Set(scopeMembers.map(m => m.id));
  const scopeBirthdays = birthdays.filter(b => scopeMemberIds.has(b.id));

  const getAttendanceInfo = (memberId) => {
    const mActs = activities
      .filter(a => a.member_id === memberId)
      .sort((a, b) => new Date(b.activity_date) - new Date(a.activity_date));

    if (mActs.length === 0) {
      return { needsFollowUp: true, label: 'لم يسجل حضور بعد', badgeColor: 'bg-gray-100 text-gray-700' };
    }
    const lastAct = mActs[0];
    const daysSinceLast = Math.floor((Date.now() - new Date(lastAct.activity_date).getTime()) / 86400000);
    if (!lastAct.attended || daysSinceLast > 14) {
      return {
        needsFollowUp: true,
        label: !lastAct.attended ? 'غائب آخر لقاء ⚠️' : `مفتقد منذ ${daysSinceLast} يوم ⚠️`,
        badgeColor: 'bg-red-100 text-red-800'
      };
    }
    return { needsFollowUp: false, label: 'حضر آخر لقاء ✅', badgeColor: 'bg-green-100 text-green-800' };
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
      (m.address || '')
    ).toLowerCase().includes(searchQuery.toLowerCase()));

  const openAddMemberModal = () => {
    if (!canAdd) return alert('🔒 غير مسموح لك بإضافة مخدومين حسب صلاحياتك الحالية.');
    const matchingClass = services.find(
      s => s.class_name === selectedScope || s.stage_name === selectedScope
    );
    const defaultGenderForModal =
      selectedGenderFilter === 'بنات' ? 'أنثى' :
      selectedGenderFilter === 'بنين' ? 'ذكر' : 'ذكر';

    setNewMember({
      ...emptyMember,
      gender: defaultGenderForModal,
      assigned_class: matchingClass?.class_name || splitCommaClasses(assignedClass)[0] || '',
      detailed_stage: STAGE_OPTIONS.includes(selectedScope) ? selectedScope : (matchingClass?.stage_name || selectedScope || baseStages[0] || 'أولى ابتدائي'),
      service_stage: STAGE_OPTIONS.includes(selectedScope) ? selectedScope : (matchingClass?.stage_name || selectedScope || baseStages[0] || 'أولى ابتدائي')
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

    setShowAddModal(false);
    setNewMember(emptyMember);
  };

  const handleNoteSubmit = (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    onSaveMemberNote({ member_id: noteMember.id, author_id: servant.id, note_text: newNoteText, behavior_tag: newNoteTag });
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
          <span className="text-xs font-black text-[#7a1c24]">📋 شيت التسلسل والافتقاد (أمين الخدمة)</span>
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
            📋 بصفتك <strong>أمين الخدمة</strong>، يمكنك سحب شيت التسلسل والافتقاد والترحيم وتصديره أو طباعته.
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

      <div className="space-y-2.5 bg-white p-4 rounded-3xl border border-gray-200 shadow-2xs">
        <div className="flex flex-wrap justify-between items-center gap-2 px-1">
          <div className="flex items-center gap-1.5 text-xs font-black text-gray-800">
            <Layers size={15} className="text-[#7a1c24]" /> الخدمات والفصول المتاحة (اختر خدمة لعرض بياناتها فقط):
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setShowAllChurchServices(true)}
              className={`px-3 py-1 rounded-xl cursor-pointer transition ${showAllChurchServices ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              كل خدمات الكنيسة ({availableServicesList.length})
            </button>
            {servantBoundTargets.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowAllChurchServices(false);
                  if (!servantBoundTargets.includes(selectedScope)) setSelectedScope(servantBoundTargets[0]);
                }}
                className={`px-3 py-1 rounded-xl cursor-pointer transition ${!showAllChurchServices ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                خدماتي المربوطة ({servantBoundTargets.length})
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {displayedServiceTabs.map((srv, idx) => {
            const count = allMembers.filter(m => memberMatchesScope(m, srv, selectedGenderFilter)).length;
            const isSelected = selectedScope === srv;
            const isBound = isBoundToSpecificService(srv);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSelectedScope(srv);
                  setSearchQuery('');
                  if (srv.includes('بنات')) setSelectedGenderFilter('بنات');
                  else if (srv.includes('بنين')) setSelectedGenderFilter('بنين');
                }}
                className={`p-3.5 rounded-3xl border text-right cursor-pointer transition shadow-2xs flex justify-between items-center gap-3 ${
                  isSelected
                    ? 'bg-linear-to-l from-[#5c1319] to-[#7a1c24] text-white border-[#7a1c24]'
                    : 'bg-[#fbfaf7] text-gray-900 hover:bg-red-50/40 border-gray-200'
                }`}
              >
                <div>
                  <span className={`text-[10px] font-bold block mb-0.5 ${isSelected ? 'text-amber-200' : 'text-gray-400'}`}>
                    {isBound ? '⭐ خدمة مخصصة لك' : '⛪ خدمة بالكنيسة'}
                  </span>
                  <strong className="text-sm sm:text-base font-black block">{srv}</strong>
                </div>
                <div className={`px-3 py-1 rounded-2xl text-xs font-black shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-red-50 text-[#7a1c24]'}`}>
                  {count} مخدوم
                </div>
              </button>
            );
          })}
        </div>

        {/* تخصيص النوع (بنين / بنات / الكل) للخدمة المختارة خصوصاً في إعدادي وثانوي */}
        <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-gray-700">
            تخصيص الفئة داخل <strong className="text-[#7a1c24]">{selectedScope}</strong> (مفيد في إعدادي وثانوي):
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

      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3 text-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-gray-900">
              📖 {selectedScope} {selectedGenderFilter !== 'الكل' ? `(${selectedGenderFilter})` : ''}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-gray-500 font-bold">الخادم: {servant.full_name}</span>
              <span className="px-2.5 py-0.5 bg-gray-100 text-gray-800 rounded-full font-bold text-[11px]">
                المخدومين: {scopeMembers.length}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${followUpMembers.length > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                يحتاجون افتقاد: {followUpMembers.length}
              </span>
            </div>
          </div>

          {canAdd && (
            <button
              type="button"
              onClick={openAddMemberModal}
              className="w-full md:w-auto px-4 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white text-xs font-black rounded-2xl flex items-center justify-center gap-1.5 shadow cursor-pointer transition"
            >
              <UserPlus size={16} /> إضافة مخدوم للفصل
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-2xl">
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

          <div className="relative">
            <Search size={16} className="absolute right-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="بحث سريع بالاسم أو التليفون..."
              className="w-full pr-10 pl-8 py-2.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl text-xs outline-none focus:border-[#7a1c24] focus:bg-white transition"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-2.5 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
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
              {searchQuery ? 'جرّب البحث بكلمة مختلفة.' : 'يمكنك إضافة أول مخدوم للفصل بسهولة من الزر بالأسفل.'}
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
        <div className="grid gap-3">
          {displayedMembers.map((m, index) => {
            const mActs = activities.filter(a => a.member_id === m.id);
            const mNotes = memberNotes.filter(n => n.member_id === m.id && !hiddenNotes[n.id]);
            const attInfo = getAttendanceInfo(m.id);
            const callPhone = m.phone || m.father_phone || m.mother_phone;

            return (
              <div key={m.id} className="p-4 rounded-3xl border text-xs space-y-3 shadow-sm bg-white border-gray-200">
                <div className="flex flex-col lg:flex-row justify-between items-start gap-3">
                  <div className="space-y-1.5 w-full">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 bg-[#7a1c24] text-white rounded-lg text-[11px] font-black">#{index + 1}</span>
                      <h3 className="text-sm sm:text-base font-black text-gray-900">{m.full_name}</h3>
                      {m.gender && <span className="px-2 py-0.5 bg-pink-50 text-pink-900 rounded-lg text-[10px] font-bold">{m.gender === 'أنثى' ? '♀️ بنات' : '♂️ بنين'}</span>}
                      {m.assigned_class && <span className="px-2 py-0.5 bg-red-50 text-[#7a1c24] rounded-lg text-[10px] font-bold">⛪ {m.assigned_class}</span>}
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${attInfo.badgeColor}`}>{attInfo.label}</span>
                    </div>

                    <div className="text-gray-600 space-y-1">
                      <p className="flex flex-wrap gap-x-3 gap-y-1">
                        <span>👨‍👦 الأب: <strong>{m.father_full_name || '—'}</strong> (📞 {m.father_phone || '—'})</span>
                        <span>👩‍👦 الأم: <strong>{m.mother_full_name || '—'}</strong> (📞 {m.mother_phone || '—'})</span>
                      </p>
                      <p className="text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        <span className="inline-flex items-center gap-1"><Phone size={12} /> {m.phone || 'غير مسجل'}</span>
                        <span className="inline-flex items-center gap-1"><MapPin size={12} /> {m.address || 'بدون عنوان'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 w-full lg:w-auto shrink-0">
                    {callPhone && (
                      <>
                        <a href={`https://wa.me/2${callPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-1">
                          <MessageCircle size={13} /> واتس
                        </a>
                        <a href={`tel:${callPhone}`} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold flex items-center justify-center gap-1">
                          <Phone size={13} /> اتصال
                        </a>
                      </>
                    )}
                    <button type="button" onClick={() => { setNoteMember(m); setNoteModal(true); }} className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer">
                      <MessageSquareText size={13} /> ملاحظة ({memberNotes.filter(n => n.member_id === m.id).length})
                    </button>
                    <button type="button" onClick={() => { setSelectedMember(m); setActModal(true); }} className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer">
                      <Calendar size={13} /> حضور ونشاط
                    </button>
                  </div>
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
                          onClick={() => setHiddenNotes(prev => ({ ...prev, [n.id]: true }))}
                          className="px-3 py-1.5 bg-green-700 text-white rounded-xl font-bold text-[11px] shrink-0 cursor-pointer self-end sm:self-center"
                        >
                          علمت ✅
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-[#fbfaf7] p-3 rounded-2xl border border-gray-100 text-[11px]">
                  <div><span className="text-gray-400 block mb-0.5">أب الاعتراف:</span><strong className="text-[#7a1c24] text-xs">{m.confession_father || 'غير محدد'}</strong></div>
                  <div><span className="text-gray-400 block mb-0.5">حالة الاعتراف:</span><span className={`px-2 py-0.5 rounded font-bold inline-block ${m.confession_status === 'منتظم' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>{m.confession_status}</span></div>
                  <div><span className="text-gray-400 block mb-0.5">التناول:</span><strong className={m.has_communion ? 'text-green-700' : 'text-red-600'}>{m.has_communion ? 'تناول ✅' : 'لم يتناول ❌'}</strong></div>
                  <div><span className="text-gray-400 block mb-0.5">سجل الأنشطة:</span><strong className="text-blue-700">{mActs.length} نشاط مسجل</strong></div>
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
              <h3 className="font-extrabold text-sm text-[#7a1c24]">إضافة مخدوم جديد لفصل: {selectedScope}</h3>
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
                    {services.map(srv => (
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
                    {availableServicesList.map((st, i) => <option key={i} value={st}>{st}</option>)}
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
            <form onSubmit={e => { e.preventDefault(); onSaveActivity(selectedMember.id, actForm); setActModal(false); }} className="space-y-3">
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
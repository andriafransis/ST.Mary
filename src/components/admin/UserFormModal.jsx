import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  DEACON_RANKS,
  STAGE_OPTIONS,
  SERVANT_ROLES,
  detectGuardianType,
  splitList,
  buildServiceHierarchy,
  getClassesForServiceHelper,
  normalizeDeaconRank
} from '../../utils/churchHierarchy';

const ARABIC_ONLY_REGEX = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]+$/;

function isPureArabicName(val = '') {
  const cleaned = String(val || '').trim();
  if (!cleaned) return false;
  if (/[A-Za-z]/.test(cleaned)) return false;
  return ARABIC_ONLY_REGEX.test(cleaned);
}

function sanitizeArabicInput(val = '') {
  return String(val || '').replace(/[A-Za-z]/g, '');
}

export default function UserFormModal({
  isEditing = false,
  isVisitorMode = false,
  formData,
  setFormData,
  priestsList = [],
  parentsWorkersList = [],
  availableServantServices = [],
  effectiveGroups = [],
  services = [],
  deaconRanksTable = [],
  onClose,
  onSubmit,
  onVisitorSuccess
}) {
  const [submittingVisitor, setSubmittingVisitor] = useState(false);
  const [visitorStatus, setVisitorStatus] = useState({ type: '', msg: '' });
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    setVisitorStatus({ type: '', msg: '' });
    setNameError('');
  }, [isVisitorMode, isEditing]);

  const effectiveRole = formData.role || 'member';
  const isObserverVisitor = Boolean(formData.is_site_observer) || effectiveRole === 'site_visitor';
  const isServantRoleSelected = !isObserverVisitor && SERVANT_ROLES.includes(effectiveRole);
  const isParishRole = effectiveRole === 'parish' || effectiveRole === 'parent' || Boolean(formData.is_parish);
  const isMarried = (formData.marital_status || 'single') === 'married';
  const isParentWithChildren =
    !isObserverVisitor &&
    (effectiveRole === 'parent' || (isMarried && Boolean(formData.is_parent_guardian)));

  const safeParentsList = isVisitorMode ? [] : parentsWorkersList;
  const safePriestsList = isVisitorMode ? [] : priestsList;

  const selectedServantStages = splitList(formData.detailed_stage);
  const selectedServantClasses = splitList(formData.assigned_class);

  const effectiveDeaconRanks = (() => {
    const fromTable = (Array.isArray(deaconRanksTable) ? deaconRanksTable : [])
      .map(row => {
        if (typeof row === 'string') return { value: row, label: row };
        const val = row.rank_name || row.name || row.title || row.value || '';
        const lbl = row.rank_label || row.label || row.rank_name || row.name || val;
        return val ? { value: val, label: lbl } : null;
      })
      .filter(Boolean);

    if (fromTable.length > 0) return fromTable;
    if (Array.isArray(DEACON_RANKS) && DEACON_RANKS.length > 0) return DEACON_RANKS;

    return [
      { value: 'إبصالتس', label: 'إبصالتس' },
      { value: 'أغنسطس', label: 'أغنسطس' },
      { value: 'إيبودياكون', label: 'إيبودياكون' },
      { value: 'دياكون', label: 'دياكون' },
      { value: 'أرشيدياكون', label: 'أرشيدياكون' }
    ];
  })();

  const effectiveStageOptions = Array.isArray(STAGE_OPTIONS) && STAGE_OPTIONS.length > 0
    ? STAGE_OPTIONS
    : [
        'حضانة', 'أولى ابتدائي', 'ثانية ابتدائي', 'ثالثة ابتدائي',
        'رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي',
        'أولى إعدادي', 'ثانية إعدادي', 'ثالثة إعدادي',
        'أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي',
        'جامعة وخريجين', 'خريجين وعاملين', 'اجتماع الشباب', 'اجتماع الأسرة', 'اجتماع عام'
      ];

  const allGroupStagesFlat = [...new Set([
    ...effectiveStageOptions,
    ...(Array.isArray(effectiveGroups) ? effectiveGroups : []).map(g => g.group_name).filter(Boolean),
    ...(Array.isArray(effectiveGroups) ? effectiveGroups : []).flatMap(g => {
      const st = g?.stages;
      if (Array.isArray(st)) return st;
      return String(st || '').split(/[,،]/).map(s => s.trim()).filter(Boolean);
    }),
    ...(Array.isArray(services) ? services : []).map(s => s.stage_name).filter(Boolean)
  ])];

  const servantServicesList = [...new Set([
    ...(Array.isArray(availableServantServices) ? availableServantServices : []),
    ...allGroupStagesFlat
  ])];

  const handleArabicNameChange = (field, rawValue) => {
    const filtered = sanitizeArabicInput(rawValue);
    if (/[A-Za-z]/.test(rawValue)) {
      setNameError('الاسم الرباعي يجب أن يُكتب باللغة العربية فقط بدون حروف إنجليزية.');
    } else {
      setNameError('');
    }
    setFormData({ ...formData, [field]: filtered });
  };

  const validateArabicQuadName = () => {
    const parts = [
      formData.first_name,
      formData.second_name,
      formData.third_name,
      formData.fourth_name
    ];
    if (parts.some(p => !(p || '').trim())) {
      setNameError('يرجى إدخال الاسم الرباعي بالكامل (الأول، الثاني، الثالث، الرابع) باللغة العربية.');
      return false;
    }
    if (!parts.every(p => isPureArabicName(p))) {
      setNameError('ممنوع كتابة أي حروف إنجليزية في الاسم الرباعي؛ يجب أن يكون باللغة العربية فقط.');
      return false;
    }
    setNameError('');
    return true;
  };

  const toggleMultiFieldValue = (fieldName, value) => {
    const current = splitList(formData[fieldName]);
    const next = current.includes(value)
      ? current.filter(x => x !== value)
      : [...current, value];
    setFormData({ ...formData, [fieldName]: next.join(', ') });
  };

  const handleRoleChange = (nextRole) => {
    const isObserver = nextRole === 'site_visitor';
    const nextGuardianType =
      nextRole === 'parent'
        ? (formData.guardian_type === 'mother' ? 'mother' : 'father')
        : '';

    setFormData({
      ...formData,
      role: nextRole,
      is_site_observer: isObserver,
      is_parish: nextRole === 'parish' || nextRole === 'parent' || Boolean(formData.is_parish),
      guardian_type: nextGuardianType,
      family_role:
        nextRole === 'parent'
          ? (nextGuardianType === 'mother' ? 'الأم' : 'الأب')
          : (isObserver ? 'زائر موقع' : formData.family_role),
      service_membership_status: isObserver ? 'not_in_service' : 'in_service',
      detailed_stage: isObserver ? '' : formData.detailed_stage,
      assigned_class: isObserver ? '' : formData.assigned_class
    });
  };

  const buildStandardPayload = (forVisitor = false) => {
    const full_name = [
      formData.first_name,
      formData.second_name,
      formData.third_name,
      formData.fourth_name
    ].map(s => (s || '').trim()).filter(Boolean).join(' ');

    const cleanUser = (formData.username || '').trim().replace(/\s+/g, '');
    const observer = Boolean(formData.is_site_observer) || formData.role === 'site_visitor';
    const resolvedRole = observer
      ? 'member'
      : (formData.role === 'parish' ? 'member' : (formData.role || 'member'));

    const marriedFlag = (formData.marital_status || 'single') === 'married';
    const guardianActive = !observer && (formData.role === 'parent' || (marriedFlag && Boolean(formData.is_parent_guardian)));
    const resolvedGuardianType = guardianActive
      ? (formData.guardian_type === 'mother' || formData.gender === 'أنثى' ? 'mother' : 'father')
      : '';

    const inService = !observer && (formData.service_membership_status || 'in_service') === 'in_service';
    const resolvedStage = inService ? (formData.detailed_stage || '') : 'خارج الخدمة / متفرج على الموقع';
    const resolvedClass = inService ? (formData.assigned_class || '') : '';
    const resolvedSector =
      observer
        ? 'زائر موقع (خارج الخدمة)'
        : (formData.role === 'parish' || guardianActive
            ? (formData.sector || 'شعب (رعية)')
            : (formData.sector || ''));

    return {
      username: forVisitor ? cleanUser.toLowerCase() : cleanUser,
      password: formData.password,
      full_name,
      first_name: (formData.first_name || '').trim(),
      second_name: (formData.second_name || '').trim(),
      third_name: (formData.third_name || '').trim(),
      fourth_name: (formData.fourth_name || '').trim(),
      role: resolvedRole,
      requested_role: formData.role || resolvedRole,
      status: forVisitor ? 'pending' : (formData.status || 'active'),
      member_status: observer ? 'site_observer' : (formData.member_status || 'active'),
      marital_status: marriedFlag ? 'married' : 'single',
      is_parent_guardian: guardianActive,
      is_parish: observer ? false : (formData.role === 'parish' || guardianActive || Boolean(formData.is_parish)),
      is_site_observer: observer,
      service_membership_status: observer ? 'not_in_service' : (formData.service_membership_status || 'in_service'),
      gender: formData.gender || 'ذكر',
      guardian_type: resolvedGuardianType,
      family_role: guardianActive
        ? (resolvedGuardianType === 'mother' ? 'الأم' : 'الأب')
        : (marriedFlag ? 'متزوج' : (observer ? 'زائر موقع' : (formData.family_role || 'فرد'))),
      dob: formData.dob || null,
      is_deacon: Boolean(formData.is_deacon),
      deacon_rank: formData.is_deacon ? (formData.deacon_rank || effectiveDeaconRanks[0]?.value || '') : '',
      church_job: formData.church_job || '',
      detailed_stage: resolvedStage,
      service_stage: resolvedStage,
      assigned_class: resolvedClass,
      confession_father_id: forVisitor ? null : (formData.confession_father_id || null),
      parent_id: forVisitor ? null : (formData.parent_id || formData.father_id || null),
      father_id: forVisitor ? null : (formData.father_id || formData.parent_id || null),
      mother_id: forVisitor ? null : (formData.mother_id || null),
      phone: (formData.phone || '').trim(),
      job_title: formData.job_title || '',
      sector: resolvedSector,
      address: (formData.address || '').trim(),
      permissions: {
        ...(formData.permissions || {}),
        is_site_observer: observer,
        service_membership_status: observer ? 'not_in_service' : (formData.service_membership_status || 'in_service'),
        after_accept_action: observer ? 'click_out_non_member' : 'standard_access',
        view_parent_panel: guardianActive,
        ...(resolvedGuardianType ? { guardian_type: resolvedGuardianType } : {})
      }
    };
  };

  const handleAdminFormSubmit = (e) => {
    e.preventDefault();
    if (!validateArabicQuadName()) return;
    if (typeof onSubmit === 'function') {
      onSubmit(e, buildStandardPayload(false));
    }
  };

  const handleVisitorSubmit = async (e) => {
    e.preventDefault();
    setVisitorStatus({ type: '', msg: '' });

    if (!validateArabicQuadName()) return;

    const cleanUser = (formData.username || '').trim().replace(/\s+/g, '');
    if (cleanUser.length < 3 || cleanUser.toLowerCase() === 'admin') {
      return setVisitorStatus({ type: 'error', msg: 'يرجى إدخال اسم دخول مناسب (3 أحرف على الأقل).' });
    }
    if ((formData.password || '').length < 3) {
      return setVisitorStatus({ type: 'error', msg: 'كلمة المرور يجب أن تكون 3 أحرف على الأقل.' });
    }
    if (!(formData.phone || '').trim()) {
      return setVisitorStatus({ type: 'error', msg: 'يرجى إدخال رقم الهاتف.' });
    }
    if (!(formData.address || '').trim()) {
      return setVisitorStatus({ type: 'error', msg: 'يرجى إدخال العنوان التفصيلي.' });
    }

    setSubmittingVisitor(true);
    try {
      const payload = buildStandardPayload(true);
      const { data, error } = await supabase
        .from('church_users')
        .insert([payload])
        .select()
        .single();

      if (error) {
        return setVisitorStatus({
          type: 'error',
          msg: error.code === '23505'
            ? 'اسم الدخول مستخدم بالفعل، اختر اسم دخول آخر.'
            : 'حدث خطأ أثناء إرسال طلب التسجيل: ' + error.message
        });
      }

      setVisitorStatus({
        type: 'success',
        msg: 'تم إرسال طلب التسجيل بنجاح ✅ وسيقوم المسؤول بمراجعته وربط الأسرة والخدمة من الداخل.'
      });
      onVisitorSuccess?.(data);
    } finally {
      setSubmittingVisitor(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-xl p-6 space-y-3 text-xs font-bold max-h-[92vh] overflow-y-auto text-gray-900">
        <div className="flex items-center justify-between border-b pb-2.5">
          <h3 className="font-extrabold text-sm text-[#7a1c24]">
            {isEditing
              ? 'تعديل بيانات الفرد بالاسم الرباعي'
              : 'إضافة فرد جديد بالاسم الرباعي'}
          </h3>
          {typeof onClose === 'function' && (
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] cursor-pointer"
            >
              إغلاق
            </button>
          )}
        </div>

        {(nameError || (isVisitorMode && visitorStatus.msg)) && (
          <div
            className={`p-3 rounded-2xl border text-xs font-bold ${
              nameError || visitorStatus.type === 'error'
                ? 'bg-red-50 border-red-300 text-red-800'
                : 'bg-green-50 border-green-300 text-green-900'
            }`}
          >
            {nameError || visitorStatus.msg}
          </div>
        )}

        <form onSubmit={isVisitorMode ? handleVisitorSubmit : handleAdminFormSubmit} className="space-y-3">
          {/* الاسم الرباعي الإلزامي بالعربي فقط */}
          <div>
            <label className="block mb-1 text-[#7a1c24]">
              الاسم الرباعي (إلزامي — عربي فقط) *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input
                required
                placeholder="الأول (عربي) *"
                className="p-2.5 border rounded-xl bg-white"
                value={formData.first_name || ''}
                onChange={e => handleArabicNameChange('first_name', e.target.value)}
              />
              <input
                required
                placeholder="الثاني (عربي) *"
                className="p-2.5 border rounded-xl bg-white"
                value={formData.second_name || ''}
                onChange={e => handleArabicNameChange('second_name', e.target.value)}
              />
              <input
                required
                placeholder="الثالث (عربي) *"
                className="p-2.5 border rounded-xl bg-white"
                value={formData.third_name || ''}
                onChange={e => handleArabicNameChange('third_name', e.target.value)}
              />
              <input
                required
                placeholder="الرابع (عربي) *"
                className="p-2.5 border rounded-xl bg-white"
                value={formData.fourth_name || ''}
                onChange={e => handleArabicNameChange('fourth_name', e.target.value)}
              />
            </div>
          </div>

          {/* اسم الدخول (يقبل إنجليزي وعربي) + كلمة المرور */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block mb-1">اسم الدخول (Username - يقبل إنجليزي) *</label>
              <input
                required
                dir="ltr"
                placeholder="username / اسم الدخول"
                className="w-full p-2.5 border rounded-xl bg-white text-left"
                value={formData.username || ''}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div>
              <label className="block mb-1">كلمة المرور *</label>
              <input
                required
                type="text"
                className="w-full p-2.5 border rounded-xl bg-white"
                value={formData.password || ''}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          {/* الدور والصفة + النوع + الحالة الاجتماعية */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block mb-1">الصفة / الدور *</label>
              <select
                className="w-full p-2.5 border rounded-xl bg-white"
                value={formData.role || 'member'}
                onChange={e => handleRoleChange(e.target.value)}
              >
                <option value="member">مخدوم</option>
                <option value="servant">خادم مرحلة</option>
                <option value="head_servant">خادم (أمين خدمة)</option>
                <option value="vice_head_servant">خادم (مساعد أمين خدمة)</option>
                <option value="meeting_servant">خادم اجتماع</option>
                <option value="mercy_servant">خادم إخوة رب</option>
                <option value="parent">ولي أمر (شعب)</option>
                <option value="parish">شعب (رعية)</option>
                <option value="worker">عامل / فراش كنيسة</option>
                <option value="site_visitor">زائر / متفرج على الموقع فقط (خارج الخدمة)</option>
                {!isVisitorMode && <option value="priest">أب كاهن</option>}
                {!isVisitorMode && <option value="admin">سوبر أدمن</option>}
              </select>
            </div>

            <div>
              <label className="block mb-1">النوع *</label>
              <select
                className="w-full p-2.5 border rounded-xl bg-white"
                value={formData.gender || 'ذكر'}
                onChange={e => {
                  const nextGender = e.target.value;
                  setFormData({
                    ...formData,
                    gender: nextGender,
                    guardian_type:
                      formData.role === 'parent' || formData.is_parent_guardian
                        ? (nextGender === 'أنثى' ? 'mother' : 'father')
                        : formData.guardian_type
                  });
                }}
              >
                <option value="ذكر">♂️ ذكر</option>
                <option value="أنثى">♀️ أنثى</option>
              </select>
            </div>

            <div>
              <label className="block mb-1">الحالة الاجتماعية *</label>
              <select
                className="w-full p-2.5 border rounded-xl bg-white"
                value={formData.marital_status || 'single'}
                onChange={e => {
                  const nextMarital = e.target.value;
                  setFormData({
                    ...formData,
                    marital_status: nextMarital,
                    is_parent_guardian: nextMarital === 'married' ? Boolean(formData.is_parent_guardian) : false,
                    guardian_type:
                      nextMarital === 'married' && (formData.role === 'parent' || formData.is_parent_guardian)
                        ? (formData.guardian_type || (formData.gender === 'أنثى' ? 'mother' : 'father'))
                        : (formData.role === 'parent' ? (formData.gender === 'أنثى' ? 'mother' : 'father') : '')
                  });
                }}
              >
                <option value="single">أعزب</option>
                <option value="married">متزوج</option>
              </select>
            </div>
          </div>

          {/* لو متزوج: يختار هل هو ولي أمر لإضافة الأولاد أم متزوج فقط بدون أولاد */}
          {!isObserverVisitor && isMarried && (
            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-extrabold text-amber-950">
                <input
                  type="checkbox"
                  checked={effectiveRole === 'parent' || Boolean(formData.is_parent_guardian)}
                  onChange={e => {
                    const checked = e.target.checked;
                    setFormData({
                      ...formData,
                      is_parent_guardian: checked,
                      is_parish: checked ? true : formData.is_parish,
                      guardian_type: checked
                        ? (formData.guardian_type || (formData.gender === 'أنثى' ? 'mother' : 'father'))
                        : '',
                      family_role: checked
                        ? ((formData.guardian_type || (formData.gender === 'أنثى' ? 'mother' : 'father')) === 'mother' ? 'الأم' : 'الأب')
                        : 'متزوج'
                    });
                  }}
                />
                <span>متزوج ولي أمر (لإضافة الأولاد وربط الأسرة — لو غير محدد يبقى متزوج فقط بدون أولاد)</span>
              </label>

              {(effectiveRole === 'parent' || Boolean(formData.is_parent_guardian)) && (
                <div className="pt-1">
                  <label className="block mb-1 text-[#7a1c24] font-extrabold">صفة ولي الأمر (الأب / الأم) — شعب:</label>
                  <select
                    className="w-full p-2.5 border border-amber-300 rounded-xl bg-white"
                    value={formData.guardian_type || (formData.gender === 'أنثى' ? 'mother' : 'father')}
                    onChange={e => {
                      const nextG = e.target.value === 'mother' ? 'mother' : 'father';
                      setFormData({
                        ...formData,
                        guardian_type: nextG,
                        gender: nextG === 'mother' ? 'أنثى' : 'ذكر',
                        family_role: nextG === 'mother' ? 'الأم' : 'الأب',
                        is_parish: true
                      });
                    }}
                  >
                    <option value="father">👨 الأب (شعب / ولي أمر)</option>
                    <option value="mother">👩 الأم (شعب / ولي أمر)</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* لو اختار ولي أمر مباشرة وهو أعزب أو لم يحدد متزوج */}
          {!isObserverVisitor && !isMarried && effectiveRole === 'parent' && (
            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 space-y-1.5">
              <label className="block text-[#7a1c24] font-extrabold">نوع ولي الأمر (الأب / الأم — شعب):</label>
              <select
                className="w-full p-2.5 border border-amber-300 rounded-xl bg-white"
                value={formData.guardian_type || (formData.gender === 'أنثى' ? 'mother' : 'father')}
                onChange={e => {
                  const nextG = e.target.value === 'mother' ? 'mother' : 'father';
                  setFormData({
                    ...formData,
                    guardian_type: nextG,
                    gender: nextG === 'mother' ? 'أنثى' : 'ذكر',
                    family_role: nextG === 'mother' ? 'الأم' : 'الأب',
                    is_parish: true
                  });
                }}
              >
                <option value="father">👨 الأب (شعب / ولي أمر)</option>
                <option value="mother">👩 الأم (شعب / ولي أمر)</option>
              </select>
            </div>
          )}

          {/* تاريخ الميلاد وحالة الفرد */}
          <div className={`grid grid-cols-1 ${!isVisitorMode ? 'sm:grid-cols-2' : ''} gap-2`}>
            <div>
              <label className="block mb-1">تاريخ الميلاد</label>
              <input
                type="date"
                className="w-full p-2.5 border rounded-xl bg-white"
                value={formData.dob || ''}
                onChange={e => setFormData({ ...formData, dob: e.target.value })}
              />
            </div>

            {!isVisitorMode && (
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
            )}
          </div>

          {/* شماس + رتبة الشماسية من الجدول بدون كتابة يدوية */}
          <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-950">
              <input
                type="checkbox"
                checked={Boolean(formData.is_deacon)}
                onChange={e => {
                  const checked = e.target.checked;
                  setFormData({
                    ...formData,
                    is_deacon: checked,
                    deacon_rank: checked
                      ? (formData.deacon_rank || effectiveDeaconRanks[0]?.value || '')
                      : ''
                  });
                }}
              />
              هل هذا الشخص شماس؟
            </label>
            {formData.is_deacon && (
              <div>
                <label className="block mb-1 text-purple-900 text-[11px]">رتبة الشماسية (اختيار من الجدول فقط — بدون كتابة يدوية) *</label>
                <select
                  required
                  className="w-full p-2 border rounded-xl bg-white"
                  value={formData.deacon_rank || normalizeDeaconRank(formData.deacon_rank) || effectiveDeaconRanks[0]?.value || ''}
                  onChange={e => setFormData({ ...formData, deacon_rank: e.target.value })}
                >
                  <option value="">-- اختر رتبة الشماسية من الجدول --</option>
                  {effectiveDeaconRanks.map((rk, idx) => (
                    <option key={rk.value || idx} value={rk.value}>
                      {rk.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ربط الخدمة بعد القبول (Accepted) أو كونه متفرج / زائر للموقع فقط */}
          <div className="bg-cyan-50/60 p-3 rounded-2xl border border-cyan-200 space-y-2">
            <label className="block text-cyan-950 font-extrabold">
              🔗 ارتباط الخدمة بعد القبول (Accepted) وحالة التواجد في الكنيسة:
            </label>
            <select
              className="w-full p-2.5 border border-cyan-300 rounded-xl bg-white"
              value={isObserverVisitor ? 'not_in_service' : (formData.service_membership_status || 'in_service')}
              onChange={e => {
                const statusVal = e.target.value;
                const isNotInService = statusVal === 'not_in_service';
                setFormData({
                  ...formData,
                  service_membership_status: statusVal,
                  is_site_observer: isNotInService ? true : (formData.role === 'site_visitor'),
                  role: isNotInService && !['servant', 'head_servant', 'vice_head_servant', 'meeting_servant', 'mercy_servant', 'member', 'parent', 'parish'].includes(formData.role)
                    ? 'site_visitor'
                    : formData.role,
                  detailed_stage: isNotInService ? '' : formData.detailed_stage,
                  assigned_class: isNotInService ? '' : formData.assigned_class
                });
              }}
            >
              <option value="in_service">✅ نعم: تابع للخدمة / المرحلة (يظهر في الخدمة بعد القبول)</option>
              <option value="not_in_service">🚪 لا / زائر موقع فقط: غير تابع للخدمة أو الكنيسة حالياً (Click Out / خروج بدون خدمة)</option>
            </select>
            {(isObserverVisitor || (formData.service_membership_status || 'in_service') === 'not_in_service') && (
              <p className="text-[11px] text-cyan-900 font-normal">
                تم تحديده كزائر/متفرج على الموقع خارج الخدمة — عند قبوله (Accepted) يُسجل غير مرتبط بمرحلة أو خدمة (Click Out).
              </p>
            )}
          </div>

          {!isVisitorMode && !isObserverVisitor && formData.role === 'priest' && (
            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 space-y-2">
              <span className="block text-[11px] text-amber-950 font-extrabold">✝ بيانات الكهنوت والسيامة والعائلة والواتساب:</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block mb-1 text-[10px]">الدرجة</label>
                  <select className="w-full p-2 border rounded-xl bg-white" value={formData.priest_degree || 'قس'} onChange={e => setFormData({ ...formData, priest_degree: e.target.value })}>
                    <option value="قس">قس</option><option value="قمص">قمص</option><option value="أسقف / مطران">أسقف / مطران</option>
                  </select>
                </div>
                <div><label className="block mb-1 text-[10px]">تاريخ السيامة</label><input type="date" className="w-full p-2 border rounded-xl bg-white" value={formData.ordination_date || ''} onChange={e => setFormData({ ...formData, ordination_date: e.target.value })} /></div>
                <div><label className="block mb-1 text-[10px]">تاريخ الترقية</label><input type="date" className="w-full p-2 border rounded-xl bg-white" value={formData.promotion_date || ''} onChange={e => setFormData({ ...formData, promotion_date: e.target.value })} /></div>
              </div>
              {formData.priest_degree !== 'أسقف / مطران' && (
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="الاسم الرباعي لزوجة الأب الكاهن" className="p-2 border rounded-xl bg-white" value={formData.priest_wife_full_name || ''} onChange={e => setFormData({ ...formData, priest_wife_full_name: e.target.value })} />
                  <input type="tel" placeholder="تليفون الزوجة" className="p-2 border rounded-xl bg-white" value={formData.priest_wife_phone || ''} onChange={e => setFormData({ ...formData, priest_wife_phone: e.target.value })} />
                </div>
              )}
              <input placeholder="تفاصيل الأبناء / ملاحظات اليوبيل..." className="w-full p-2 border rounded-xl bg-white" value={formData.priest_family_notes || ''} onChange={e => setFormData({ ...formData, priest_family_notes: e.target.value })} />
              <div className="grid sm:grid-cols-2 gap-2 pt-1 border-t border-amber-200">
                <input placeholder="رقم الواتساب الخاص بأبونا للإرسال" className="p-2 border rounded-xl bg-white" value={formData.whatsapp_sender_phone || ''} onChange={e => setFormData({ ...formData, whatsapp_sender_phone: e.target.value })} />
                <label className="flex items-center gap-2 text-[11px] text-amber-950 cursor-pointer">
                  <input type="checkbox" checked={formData.can_manage_wa_templates !== false} onChange={e => setFormData({ ...formData, can_manage_wa_templates: e.target.checked })} />
                  السماح بتعديل وإضافة قوالب الواتساب
                </label>
              </div>
            </div>
          )}

          {!isObserverVisitor && formData.role === 'worker' && (
            <div><label className="block mb-1">وظيفة العامل / الفراش</label><input className="w-full p-2.5 border rounded-xl" placeholder="فراش الكنيسة / أمن..." value={formData.church_job || ''} onChange={e => setFormData({ ...formData, church_job: e.target.value })} /></div>
          )}

          {/* بيانات المخدوم / الشعب عند التواجد في الخدمة */}
          {!isObserverVisitor && (formData.service_membership_status || 'in_service') === 'in_service' && (formData.role === 'member' || formData.role === 'parish' || isParishRole) && !isServantRoleSelected && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1">① المرحلة / الخدمة</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-amber-50/40"
                    value={formData.detailed_stage || ''}
                    onChange={e => {
                      const nextStage = e.target.value;
                      const nextStageClasses = getClassesForServiceHelper(nextStage, effectiveGroups, services);
                      const keepCurrentClass = nextStageClasses.some(c => c.value === formData.assigned_class);
                      setFormData({
                        ...formData,
                        detailed_stage: nextStage,
                        assigned_class: keepCurrentClass ? formData.assigned_class : ''
                      });
                    }}
                  >
                    <option value="">-- اختر المرحلة أو الخدمة --</option>
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
                    {getClassesForServiceHelper(formData.detailed_stage, effectiveGroups, services).map((srv) => (
                      <option key={srv.id || srv.value} value={srv.value}>
                        {srv.yearName ? `${srv.yearName} ← ${srv.label}` : srv.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!isVisitorMode && (
                <div>
                  <label className="block mb-1">أب الاعتراف</label>
                  <select className="w-full p-2.5 border rounded-xl bg-white" value={formData.confession_father_id || ''} onChange={e => setFormData({ ...formData, confession_father_id: e.target.value })}>
                    <option value="">-- اختر --</option>
                    {safePriestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          {/* بيانات الخادم والخدمات المتاحة عنده */}
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
                    permissions: { ...(formData.permissions || {}), service_gender_scope: e.target.value }
                  })}
                >
                  <option value="الكل">👥 الكل (بنين وبنات / عام)</option>
                  <option value="بنين">♂️ بنين فقط (ذكور)</option>
                  <option value="بنات">♀️ بنات فقط (إناث)</option>
                </select>
              </div>

              <div>
                <label className="block mb-1.5 text-[#7a1c24] font-extrabold">
                  ① اختر الخدمة التي يخدم فيها الخادم (من الخدمات المتاحة — يمكن اختيار أكثر من خدمة):
                </label>
                <div className="flex flex-wrap gap-1.5 bg-white p-2.5 rounded-xl border max-h-36 overflow-y-auto">
                  {servantServicesList.map((srvName, idx) => {
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
                      const hierarchy = buildServiceHierarchy(srvName, effectiveGroups, services);
                      return (
                        <div key={sIdx} className="bg-white p-2.5 rounded-xl border space-y-2">
                          <div className="text-[11px] font-black text-[#7a1c24] flex items-center justify-between">
                            <span>📌 خدمة: {srvName}</span>
                            <span className="text-[10px] text-gray-400">{hierarchy.allClasses.length} خيار</span>
                          </div>

                          {hierarchy.years.length > 0 && (
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
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!isVisitorMode && (
                <div>
                  <label className="block mb-1">أب الاعتراف</label>
                  <select className="w-full p-2.5 border rounded-xl bg-white" value={formData.confession_father_id || ''} onChange={e => setFormData({ ...formData, confession_father_id: e.target.value })}>
                    <option value="">-- اختر --</option>
                    {safePriestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* ربط ولي الأمر للأولاد / المخدومين — يظهر فقط للأدمن/الكاهن/أمين الخدمة من الداخل وليس للزائر من بره */}
          {!isVisitorMode && !isObserverVisitor && (formData.role === 'member' || isParentWithChildren) && (
            <div className="bg-blue-50/40 p-3 rounded-2xl border border-blue-200 space-y-2.5">
              <span className="block text-[#7a1c24] font-extrabold">
                👨‍👩‍👦 ربط بحساب ولي الأمر (تحديد الأب والأم من الداخل عند القبول أو التعديل):
              </span>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-[11px] text-sky-950">👨 ولي الأمر (الأب / خادم / شعب):</label>
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
                    {safeParentsList
                      .filter(p => detectGuardianType(p) !== 'mother')
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-[11px] text-pink-950">👩 ولي الأمر (الأم / خادمة / شعب):</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white"
                    value={formData.mother_id || ''}
                    onChange={e => setFormData({
                      ...formData,
                      mother_id: e.target.value
                    })}
                  >
                    <option value="">-- اختر الأم (اختياري) --</option>
                    {safeParentsList
                      .filter(p => detectGuardianType(p) === 'mother' || p.guardian_type === 'mother' || ['الأم', 'أم', 'والدة'].includes(String(p.family_role || '').trim()))
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* رقم الهاتف + العمل / الوظيفة */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block mb-1">رقم الهاتف *</label>
              <input
                required
                type="tel"
                className="w-full p-2.5 border rounded-xl bg-white"
                value={formData.phone || ''}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block mb-1">العمل / الوظيفة</label>
              <input
                className="w-full p-2.5 border rounded-xl bg-white"
                placeholder="مهندس / طالب..."
                value={formData.job_title || ''}
                onChange={e => setFormData({ ...formData, job_title: e.target.value })}
              />
            </div>
          </div>

          {/* القطاع / المنطقة + العنوان التفصيلي */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block mb-1">القطاع / المنطقة</label>
              <input
                className="w-full p-2.5 border rounded-xl bg-white"
                value={formData.sector || ''}
                onChange={e => setFormData({ ...formData, sector: e.target.value })}
              />
            </div>
            <div>
              <label className="block mb-1">العنوان التفصيلي *</label>
              <input
                required
                placeholder="الشارع، رقم العقار، المنطقة..."
                className="w-full p-2.5 border rounded-xl bg-white"
                value={formData.address || ''}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-xl cursor-pointer">
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submittingVisitor}
              className="px-5 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl shadow cursor-pointer"
            >
              {submittingVisitor
                ? 'جاري الإرسال...'
                : isEditing
                  ? 'حفظ التعديلات'
                  : isVisitorMode
                    ? 'إرسال طلب التسجيل'
                    : 'إنشاء'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
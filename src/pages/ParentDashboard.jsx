import { useState, useMemo } from 'react';
import {
  CalendarCheck, MessageSquareHeart, ShieldCheck, Info, Calendar,
  MapPin, School, Search, UserCheck, Sparkles, X, Check, Unlink, RotateCcw, Bell
} from 'lucide-react';

export const isArabicOnlyName = (value = '') => {
  const cleaned = String(value || '').trim();
  if (!cleaned) return false;
  if (/[A-Za-z]/.test(cleaned)) return false;
  return /^[\u0600-\u06FF\s]+$/.test(cleaned);
};

export const validateQuadArabicName = ({
  first_name = '',
  second_name = '',
  third_name = '',
  fourth_name = '',
  full_name = ''
}) => {
  const parts = [first_name, second_name, third_name, fourth_name].map(p => String(p || '').trim());
  const hasPartInput = parts.some(Boolean);

  if (hasPartInput) {
    const labels = ['الاسم الأول', 'الاسم الثاني', 'الاسم الثالث', 'الاسم الرابع'];
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i]) {
        return { valid: false, error: `يرجى كتابة ${labels[i]} باللغة العربية.` };
      }
      if (!isArabicOnlyName(parts[i])) {
        return { valid: false, error: `${labels[i]} يجب أن يكون باللغة العربية فقط (ممنوع الإنجليزي).` };
      }
    }
    return { valid: true, fullName: parts.join(' ') };
  }

  const normalizedFull = String(full_name || '').trim().replace(/\s+/g, ' ');
  const words = normalizedFull.split(' ').filter(Boolean);
  if (words.length < 4) {
    return { valid: false, error: 'يرجى كتابة الاسم الرباعي كاملاً (4 أسماء) باللغة العربية.' };
  }
  if (!isArabicOnlyName(normalizedFull)) {
    return { valid: false, error: 'الاسم الرباعي يجب أن يكون باللغة العربية فقط (ممنوع الإنجليزي).' };
  }

  return { valid: true, fullName: normalizedFull };
};

const normalizeArabic = (str = '') =>
  String(str)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\b(عبد|ابو|ام|بن|بنت)\s+/g, '$1')
    .replace(/\s+/g, ' ');

const normalizePhone = (phone = '') => {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('20') && digits.length === 12) return '0' + digits.slice(2);
  if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
  return digits;
};

const getNameTokens = (user) => {
  if (!user) return [];
  const combinedSplit = [user.first_name, user.second_name, user.third_name, user.fourth_name]
    .map(s => (s || '').trim())
    .filter(Boolean)
    .join(' ');
  const source = (user.full_name || '').trim() || combinedSplit;
  return normalizeArabic(source).split(' ').filter(Boolean);
};

const detectParentIsMother = (parent) => {
  if (!parent) return false;
  if (
    parent.guardian_type === 'mother' ||
    parent.parent_type === 'mother' ||
    parent.permissions?.guardian_type === 'mother' ||
    parent.permissions?.parent_type === 'mother'
  ) {
    return true;
  }
  if (
    parent.guardian_type === 'father' ||
    parent.parent_type === 'father' ||
    parent.permissions?.guardian_type === 'father' ||
    parent.permissions?.parent_type === 'father'
  ) {
    return false;
  }
  if (parent.family_role === 'أم' || parent.family_role === 'الأم' || parent.family_role === 'والدة') {
    return true;
  }
  const firstToken = normalizeArabic(parent.first_name || getNameTokens(parent)[0] || '');
  return ['مدام', 'ام', 'مريم', 'ماري', 'ايريني', 'ايزيس', 'هناء', 'سوزان', 'ناهد', 'نجلاء', 'داليا', 'مونيكا', 'كريستين', 'فيفيان', 'نادية'].includes(firstToken);
};

const isCandidateLinkedToCurrentParent = (parent, candidate) => {
  if (!parent?.id || !candidate) return false;
  return (
    candidate.parent_id === parent.id ||
    candidate.father_id === parent.id ||
    candidate.mother_id === parent.id
  );
};

const isCandidateBlockedByOtherParent = (parent, candidate, isMother, existingUserIds) => {
  if (!parent?.id || !candidate) return false;
  if (isCandidateLinkedToCurrentParent(parent, candidate)) return false;

  const pName = getNameTokens(parent).join(' ');
  const cFather = normalizeArabic(candidate.father_full_name);
  const cMother = normalizeArabic(candidate.mother_full_name);

  if (isMother) {
    if (cMother && pName && (cMother === pName || cMother.startsWith(pName) || pName.startsWith(cMother))) {
      return false;
    }
    return Boolean(candidate.mother_id && candidate.mother_id !== parent.id && existingUserIds.has(candidate.mother_id));
  } else {
    if (cFather && pName && (cFather === pName || cFather.startsWith(pName) || pName.startsWith(cFather))) {
      return false;
    }
    return Boolean(
      (candidate.father_id && candidate.father_id !== parent.id && existingUserIds.has(candidate.father_id)) ||
      (!candidate.mother_id && candidate.parent_id && candidate.parent_id !== parent.id && existingUserIds.has(candidate.parent_id))
    );
  }
};

const getAutoMatchReason = (parent, candidate, isMother) => {
  if (!parent || !candidate || candidate.id === parent.id) return null;

  const pOwnPhone = normalizePhone(parent.phone);
  const pSpousePhone = normalizePhone(parent.spouse_phone);
  const cFatherPhone = normalizePhone(candidate.father_phone);
  const cMotherPhone = normalizePhone(candidate.mother_phone);
  const cOwnPhone = normalizePhone(candidate.phone);

  if (isMother) {
    if (pOwnPhone && cMotherPhone && pOwnPhone === cMotherPhone) return 'تطابق رقم تليفون الأم';
    if (pSpousePhone && cFatherPhone && pSpousePhone === cFatherPhone) return 'تطابق رقم تليفون الأب';
  } else {
    if (pOwnPhone && cFatherPhone && pOwnPhone === cFatherPhone) return 'تطابق رقم تليفون الأب';
    if (pSpousePhone && cMotherPhone && pSpousePhone === cMotherPhone) return 'تطابق رقم تليفون الأم';
  }

  const allParentPhones = [pOwnPhone, pSpousePhone].filter(p => p.length >= 8);
  if (allParentPhones.some(p => cOwnPhone && p === cOwnPhone)) {
    return 'تطابق رقم التليفون المسجل';
  }

  const pTokens = getNameTokens(parent);
  if (pTokens.length === 0) return null;
  const pName = pTokens.join(' ');

  const cTokens = getNameTokens(candidate);
  const cFirst = normalizeArabic(candidate.first_name || cTokens[0] || '');
  const cSecond = normalizeArabic(candidate.second_name || cTokens[1] || '');
  const cThird = normalizeArabic(candidate.third_name || cTokens[2] || '');
  const cFourth = normalizeArabic(candidate.fourth_name || cTokens[3] || '');

  const cFather = normalizeArabic(candidate.father_full_name);
  const cMother = normalizeArabic(candidate.mother_full_name);

  if (isMother) {
    if (cMother && (cMother === pName || pName.startsWith(cMother) || cMother.startsWith(pName) || (pTokens.length >= 2 && cMother.startsWith(pTokens.slice(0, 2).join(' '))))) {
      return 'تطابق اسم الأم المسجل للابن';
    }
    const spouseNorm = normalizeArabic(parent.spouse_name);
    if (spouseNorm && cFather && (cFather === spouseNorm || cFather.startsWith(spouseNorm))) {
      return 'تطابق اسم الأب/الزوج المسجل';
    }
  } else {
    if (cFather && (cFather === pName || (pTokens.length >= 2 && cFather.startsWith(pTokens.slice(0, 2).join(' '))))) {
      return 'تطابق اسم الأب بالكامل';
    }

    const cLineageTokens = cTokens.length > 1
      ? cTokens.slice(1)
      : [cSecond, cThird, cFourth].filter(Boolean);
    const cLineageStr = cLineageTokens.join(' ');

    if (pTokens.length >= 2) {
      const pFirstTwo = pTokens.slice(0, 2).join(' ');
      if (cLineageTokens.length >= 2 && cLineageTokens[0] === pTokens[0] && cLineageTokens[1] === pTokens[1]) {
        return `تطابق نسب الابن (${cFirst} ← ${pTokens[0]} ${pTokens[1]})`;
      }
      if (cLineageStr && (cLineageStr === pName || pName.startsWith(cLineageStr) || cLineageStr.startsWith(pFirstTwo))) {
        return 'تطابق الاسم الرباعي تحت اسم الأب';
      }
    } else if (pTokens.length === 1 && pTokens[0].length >= 3) {
      const single = pTokens[0];
      if (cSecond === single || cFather.split(' ')[0] === single) {
        return `تطابق الاسم الثاني للابن مع (${single})`;
      }
    }
  }

  const pChildrenNames = normalizeArabic(parent.children_names);
  if (cFirst.length >= 3 && pChildrenNames && pChildrenNames.includes(cFirst)) {
    return 'مذكور ضمن أسماء الأبناء';
  }

  return null;
};

export default function ParentDashboard({
  parent,
  childrenList = [],
  allUsers = [],
  attendance = [],
  spiritualNotes = [],
  events = [],
  services = [],
  linkRequests = [],
  onLinkChild,
  onApproveLinkRequest,
  onRejectLinkRequest,
  canManageLinks = true
}) {
  const curYear = new Date().getFullYear();
  const isMother = useMemo(() => detectParentIsMother(parent), [parent]);
  const dismissedStorageKey = `parent_dismissed_children_${parent.id}`;

  const [phoneQuery, setPhoneQuery] = useState('');
  const [validationError, setValidationError] = useState('');
  const [busyChildId, setBusyChildId] = useState(null);
  const [busyRequestId, setBusyRequestId] = useState(null);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(dismissedStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const effectiveChildrenList = useMemo(() => {
    const map = new Map();
    childrenList.forEach(c => map.set(c.id, c));
    allUsers.forEach(u => {
      if (isCandidateLinkedToCurrentParent(parent, u)) {
        map.set(u.id, u);
      }
    });
    return Array.from(map.values());
  }, [childrenList, allUsers, parent]);

  const linkedIds = useMemo(() => new Set(effectiveChildrenList.map(c => c.id)), [effectiveChildrenList]);
  const existingUserIds = useMemo(() => new Set(allUsers.map(u => u.id)), [allUsers]);

  const candidatePool = useMemo(
    () => allUsers.filter(u => u.id !== parent.id && !['admin', 'priest', 'parent'].includes(u.role)),
    [allUsers, parent.id]
  );

  const autoSuggestions = useMemo(() => {
    return candidatePool
      .filter(u => {
        const blocked = isCandidateBlockedByOtherParent(parent, u, isMother, existingUserIds);
        return !linkedIds.has(u.id) && !blocked && !dismissedIds.includes(u.id);
      })
      .map(u => ({ user: u, reason: getAutoMatchReason(parent, u, isMother) }))
      .filter(item => Boolean(item.reason));
  }, [candidatePool, linkedIds, existingUserIds, dismissedIds, parent, isMother]);

  const phoneLookupResults = useMemo(() => {
    const qPhone = normalizePhone(phoneQuery);
    if (qPhone.length < 7) return [];

    return candidatePool
      .filter(u => !linkedIds.has(u.id))
      .map(u => {
        const fatherPhone = normalizePhone(u.father_phone);
        const motherPhone = normalizePhone(u.mother_phone);
        const matchedFather = Boolean(fatherPhone && (fatherPhone === qPhone || fatherPhone.includes(qPhone) || qPhone.includes(fatherPhone)));
        const matchedMother = Boolean(motherPhone && (motherPhone === qPhone || motherPhone.includes(qPhone) || qPhone.includes(motherPhone)));

        if (!matchedFather && !matchedMother) return null;

        const matchLabel =
          matchedFather && matchedMother
            ? 'مطابق لرقم تليفون الأب والأم'
            : matchedMother
              ? 'مطابق لرقم تليفون الأم'
              : 'مطابق لرقم تليفون الأب';

        return { user: u, matchLabel };
      })
      .filter(Boolean)
      .slice(0, 15);
  }, [phoneQuery, candidatePool, linkedIds]);

  const handleConfirmLink = async (child) => {
    if (!onLinkChild || !canManageLinks) return;
    setValidationError('');

    setBusyChildId(child.id);
    try {
      const ok = await onLinkChild(child.id, true, isMother ? 'mother' : 'father');
      if (ok) setPhoneQuery('');
    } finally {
      setBusyChildId(null);
    }
  };

  const handleUnlink = async (child) => {
    if (!onLinkChild || !canManageLinks) return;
    if (!confirm(`هل تريد إلغاء ربط (${child.full_name}) من حسابك؟`)) return;
    setBusyChildId(child.id);
    try {
      await onLinkChild(child.id, false, isMother ? 'mother' : 'father');
    } finally {
      setBusyChildId(null);
    }
  };

  const handleDismissSuggestion = (childId) => {
    const next = [...new Set([...dismissedIds, childId])];
    setDismissedIds(next);
    try {
      localStorage.setItem(dismissedStorageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleResetDismissed = () => {
    setDismissedIds([]);
    try {
      localStorage.removeItem(dismissedStorageKey);
    } catch {
      // ignore
    }
  };

  const handleApproveReq = async (req) => {
    if (!onApproveLinkRequest) return;
    setBusyRequestId(req.id);
    try {
      await onApproveLinkRequest(req);
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleRejectReq = async (req) => {
    if (!onRejectLinkRequest) return;
    setBusyRequestId(req.id);
    try {
      await onRejectLinkRequest(req);
    } finally {
      setBusyRequestId(null);
    }
  };

  const renderNameBreakdown = (child) => {
    const tokens = getNameTokens(child);
    const first = child.first_name || tokens[0] || '';
    const rest = [child.second_name, child.third_name, child.fourth_name].filter(Boolean).join(' ') || tokens.slice(1).join(' ');
    return (
      <div className="space-y-0.5">
        <strong className="text-sm text-[#7a1c24] block">{child.full_name || `${first} ${rest}`.trim()}</strong>
        {first && rest && (
          <p className="text-[11px] text-gray-600">
            الاسم الأول: <strong className="text-gray-900">{first}</strong> • اسم الأب/النسب: <strong className="text-gray-900">{rest}</strong>
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 text-xs" dir="rtl">
      <div className="bg-linear-to-l from-[#5c1319] via-[#7a1c24] to-[#91212b] text-white p-4 sm:p-5 rounded-3xl shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base sm:text-xl font-black text-amber-200">أهلاً بحضرتك، {parent.full_name}</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-amber-100 text-[11px] font-black">
            {isMother ? '👩 حساب ولي الأمر: الأم' : '👨 حساب ولي الأمر: الأب'}
          </span>
        </div>
        <p className="text-xs text-white/85 mt-1">
          متابعة الأبناء في الكنيسة: الحضور السنوي، الاعتراف، وملاحظات الأب الكاهن • الأبناء المربوطون حالياً: <strong>{effectiveChildrenList.length}</strong>
        </p>
      </div>

      {linkRequests.length > 0 && (
        <div className="bg-emerald-50 border-2 border-emerald-300 p-4 sm:p-5 rounded-3xl shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-emerald-950">
            <Bell size={18} className="text-emerald-700 shrink-0" />
            <div>
              <h3 className="text-sm font-black">طلبات ربط أبناء تنتظر موافقتك ({linkRequests.length})</h3>
              <p className="text-[11px] text-emerald-900/80">
                راجع بيانات الابن واضغط «قبول الربط» لتأكيد صلته بك أو «رفض» لتجاهل الطلب.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {linkRequests.map(req => {
              const childUser = allUsers.find(u => u.id === req.child_id);
              const displayName = childUser?.full_name || req.child_name || 'حساب ابن';
              const guardianLabel = req.guardian_type === 'mother' ? 'الأم' : 'الأب';

              return (
                <div key={req.id} className="bg-white p-3.5 rounded-2xl border border-emerald-200 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm text-[#7a1c24]">{displayName}</strong>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-lg text-[10px] font-bold shrink-0">
                        طلب ربط بـ {guardianLabel}
                      </span>
                    </div>
                    {childUser && (
                      <p className="text-gray-500">
                        المرحلة: {childUser.detailed_stage || childUser.service_stage || '—'}
                        {childUser.assigned_class ? ` • فصل: ${childUser.assigned_class}` : ''}
                      </p>
                    )}
                    {(childUser?.father_phone || childUser?.mother_phone) && (
                      <p className="text-[11px] text-gray-500">
                        {childUser.father_phone ? `تليفون الأب: ${childUser.father_phone}` : ''}
                        {childUser.father_phone && childUser.mother_phone ? ' • ' : ''}
                        {childUser.mother_phone ? `تليفون الأم: ${childUser.mother_phone}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={busyRequestId === req.id}
                      onClick={() => handleApproveReq(req)}
                      className="py-2 px-3 bg-green-700 hover:bg-green-800 text-white rounded-xl font-black flex items-center justify-center gap-1 cursor-pointer transition"
                    >
                      <Check size={14} /> {busyRequestId === req.id ? 'جاري القبول...' : 'قبول الربط'}
                    </button>
                    <button
                      type="button"
                      disabled={busyRequestId === req.id}
                      onClick={() => handleRejectReq(req)}
                      className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                    >
                      <X size={14} /> رفض
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {validationError && (
        <div className="bg-red-50 border border-red-300 text-red-900 p-3.5 rounded-2xl font-bold flex items-center justify-between gap-2">
          <span>⚠️ {validationError}</span>
          <button type="button" onClick={() => setValidationError('')} className="text-red-700 font-black cursor-pointer">✕</button>
        </div>
      )}

      {canManageLinks && autoSuggestions.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 p-4 sm:p-5 rounded-3xl shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-amber-950">
            <Sparkles size={18} className="text-[#7a1c24] shrink-0" />
            <div>
              <h3 className="text-sm font-black">تم العثور على أبناء مطابقين لبياناتك تلقائياً — هل هم أبناؤك؟</h3>
              <p className="text-[11px] text-amber-900/80">
                اضغط «نعم، ده ابني» لربط الحساب القائم بحسابك مباشرة (الطفل الأول والثاني وكل ابن) دون إنشاء حسابات مكررة.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {autoSuggestions.map(({ user: child, reason }) => (
              <div key={child.id} className="bg-white p-3.5 rounded-2xl border border-amber-200 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-start justify-between gap-1.5">
                    {renderNameBreakdown(child)}
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-lg text-[10px] font-bold shrink-0">
                      {reason}
                    </span>
                  </div>
                  <p className="text-gray-500">
                    المرحلة: {child.detailed_stage || child.service_stage || '—'}
                    {child.assigned_class ? ` • فصل: ${child.assigned_class}` : ''}
                  </p>
                  {(child.father_full_name || child.mother_full_name) && (
                    <p className="text-[11px] text-gray-500">
                      {child.father_full_name ? `الأب: ${child.father_full_name}` : ''}
                      {child.father_full_name && child.mother_full_name ? ' • ' : ''}
                      {child.mother_full_name ? `الأم: ${child.mother_full_name}` : ''}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busyChildId === child.id}
                    onClick={() => handleConfirmLink(child)}
                    className="py-2 px-3 bg-green-700 hover:bg-green-800 text-white rounded-xl font-black flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <Check size={14} /> {busyChildId === child.id ? 'جاري الربط...' : 'نعم، ده ابني'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismissSuggestion(child.id)}
                    className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <X size={14} /> لأ، مش ابني
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {canManageLinks && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <UserCheck size={17} className="text-[#7a1c24] shrink-0" />
              <div>
                <h3 className="font-black text-sm text-[#7a1c24]">إظهار تفاصيل الأبناء وربطهم برقم تليفون الأب أو الأم</h3>
                <p className="text-[11px] text-gray-500">
                  اكتب رقم تليفون الأب أو الأم (7 أرقام فأكثر) لإظهار تفاصيل الابن المطابق وربطه على الحساب.
                </p>
              </div>
            </div>

            {dismissedIds.length > 0 && (
              <button
                type="button"
                onClick={handleResetDismissed}
                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={12} /> إظهار المقترحات المخفية
              </button>
            )}
          </div>

          <div className="relative">
            <Search size={16} className="absolute right-3.5 top-3 text-gray-400" />
            <input
              type="tel"
              inputMode="tel"
              placeholder="اكتب رقم تليفون الأب أو الأم لإظهار التفاصيل..."
              className="w-full pr-10 pl-9 py-2.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl text-xs outline-none focus:border-[#7a1c24] focus:bg-white transition"
              value={phoneQuery}
              onChange={e => setPhoneQuery(e.target.value)}
            />
            {phoneQuery && (
              <button
                type="button"
                onClick={() => setPhoneQuery('')}
                className="absolute left-3 top-2.5 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {phoneQuery.trim() && normalizePhone(phoneQuery).length < 7 && (
            <p className="text-[11px] text-amber-800 bg-amber-50/80 px-3 py-2 rounded-xl border border-amber-200">
              أكمل كتابة رقم تليفون الأب أو الأم (7 أرقام على الأقل) لإظهار التفاصيل.
            </p>
          )}

          {normalizePhone(phoneQuery).length >= 7 && (
            <div className="space-y-2 pt-1">
              {phoneLookupResults.length === 0 ? (
                <p className="text-center text-gray-400 py-3 bg-[#fbfaf7] rounded-2xl border border-dashed">
                  لا يوجد أبناء غير مربوطين مسجل لديهم رقم تليفون الأب أو الأم هذا.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {phoneLookupResults.map(({ user: child, matchLabel }) => {
                    const linkedToOther = isCandidateBlockedByOtherParent(parent, child, isMother, existingUserIds);
                    return (
                      <div key={child.id} className="p-3.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl flex flex-col justify-between gap-2.5">
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-1.5">
                            {renderNameBreakdown(child)}
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-lg text-[10px] font-bold shrink-0">
                              {matchLabel}
                            </span>
                          </div>
                          <p className="text-gray-500">
                            المرحلة: {child.detailed_stage || child.service_stage || '—'}
                            {child.assigned_class ? ` • ${child.assigned_class}` : ''}
                          </p>
                          {(child.father_full_name || child.mother_full_name) && (
                            <p className="text-[11px] text-gray-500">
                              {child.father_full_name ? `الأب: ${child.father_full_name}` : ''}
                              {child.father_full_name && child.mother_full_name ? ' • ' : ''}
                              {child.mother_full_name ? `الأم: ${child.mother_full_name}` : ''}
                            </p>
                          )}
                          {(child.father_phone || child.mother_phone) && (
                            <p className="text-[11px] text-gray-500">
                              {child.father_phone ? `تليفون الأب: ${child.father_phone}` : ''}
                              {child.father_phone && child.mother_phone ? ' • ' : ''}
                              {child.mother_phone ? `تليفون الأم: ${child.mother_phone}` : ''}
                            </p>
                          )}
                        </div>

                        {linkedToOther ? (
                          <span className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-center text-[11px]">
                            مربوط بحساب ولي أمر آخر (راجع أدمن الكنيسة لو في خطأ)
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={busyChildId === child.id}
                            onClick={() => handleConfirmLink(child)}
                            className="w-full py-2 px-3 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center justify-center gap-1.5 cursor-pointer transition"
                          >
                            <Check size={14} /> {busyChildId === child.id ? 'جاري الربط...' : 'نعم، ربط هذا الابن بحسابي'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {effectiveChildrenList.length === 0 ? (
        <div className="bg-amber-50/70 border border-amber-200 p-5 rounded-3xl flex flex-col sm:flex-row items-center gap-3 text-center sm:text-right">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 text-[#7a1c24] flex items-center justify-center shrink-0">
            <Info size={22} />
          </div>
          <div>
            <strong className="text-sm text-amber-950 block">لا يوجد أبناء مربوطون بحسابك حتى الآن</strong>
            <p className="text-amber-900/80 mt-0.5">
              يمكنك ربط أبنائك من الاقتراحات التلقائية بالأعلى أو بكتابة رقم تليفون الأب أو الأم لإظهار التفاصيل.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {effectiveChildrenList.map(child => {
            const childAtt = attendance.filter(a => a.member_id === child.id && a.event_date?.startsWith(String(curYear)));
            const presentCount = childAtt.filter(a => a.present).length;
            const totalCount = childAtt.length;
            const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

            const noteObj = spiritualNotes.find(n => n.member_id === child.id);

            return (
              <div key={child.id} className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-[#7a1c24]">{child.full_name}</h3>
                    <p className="text-gray-500 mt-0.5">
                      المرحلة: {child.detailed_stage || child.service_stage || '—'}
                      {child.assigned_class ? ` • ${child.assigned_class}` : ''}
                      {child.sector ? ` • ${child.sector}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="px-3.5 py-1.5 bg-amber-100 text-amber-950 rounded-xl font-black">
                      حضور {curYear}: {rate}%
                    </span>
                    {onLinkChild && canManageLinks && (
                      <button
                        type="button"
                        disabled={busyChildId === child.id}
                        onClick={() => handleUnlink(child)}
                        title="إلغاء ربط الابن"
                        className="p-2 bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-700 rounded-xl cursor-pointer transition"
                      >
                        <Unlink size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-[#fbfaf7] p-3.5 rounded-2xl border border-gray-200/70 space-y-1">
                    <div className="flex items-center gap-1.5 font-black text-gray-800">
                      <CalendarCheck size={16} className="text-green-700" /> الحضور خلال سنة {curYear}
                    </div>
                    <p className="text-gray-600">
                      حضر <strong className="text-green-700 text-sm">{presentCount}</strong> مرة من أصل <strong>{totalCount}</strong> لقاء مسجل.
                    </p>
                  </div>

                  <div className="bg-[#fbfaf7] p-3.5 rounded-2xl border border-gray-200/70 space-y-1">
                    <div className="flex items-center gap-1.5 font-black text-gray-800">
                      <ShieldCheck size={16} className="text-[#7a1c24]" /> متابعة الاعتراف
                    </div>
                    {noteObj ? (
                      <>
                        <p className="text-gray-700">
                          الحالة: <strong className="text-[#7a1c24]">{noteObj.confession_status}</strong>
                        </p>
                        <p className="text-gray-500">آخر اعتراف مسجل: {noteObj.last_confession_date || 'غير مسجل'}</p>
                      </>
                    ) : (
                      <p className="text-gray-400">لم يقم الأب الكاهن بتسجيل متابعة اعتراف بعد.</p>
                    )}
                  </div>
                </div>

                <div className="bg-[#f9ecee] border border-[#ebd0d4] p-3.5 rounded-2xl">
                  <div className="flex items-center gap-1.5 font-black text-[#7a1c24] mb-1">
                    <MessageSquareHeart size={16} /> ملاحظات الأب الكاهن على الابن/الابنة:
                  </div>
                  <p className="text-[#4a0e13] leading-relaxed">
                    {noteObj?.priest_note ? noteObj.priest_note : 'لا توجد ملاحظات مسجلة من الأب الكاهن حالياً.'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
        <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5 border-b border-gray-100 pb-3">
          <Calendar size={17} /> مواعيد القداسات والاجتماعات بالكنيسة
        </h3>
        {events.length === 0 ? (
          <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
            لا توجد مواعيد مضافة حالياً.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {events.map(ev => (
              <div key={ev.id} className="p-3.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-bold text-[10px]">{ev.event_type || 'قداس'}</span>
                    <strong className="text-sm text-gray-900">{ev.title}</strong>
                  </div>
                  <span className="text-gray-500 flex items-center gap-1">
                    <MapPin size={12} className="text-[#7a1c24]" /> {ev.place}
                  </span>
                </div>
                <span className="self-start sm:self-center px-3 py-1 bg-red-50 text-[#7a1c24] rounded-xl font-black text-[11px] shrink-0">
                  {ev.event_time}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {services.length > 0 && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
          <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5 border-b border-gray-100 pb-3">
            <School size={17} /> الفصول والخدمات المتاحة بالكنيسة
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {services.map(srv => (
              <div key={srv.id} className="p-3.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm text-gray-900">{srv.class_name}</strong>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-lg font-bold text-[10px]">{srv.stage_name}</span>
                </div>
                <span className="text-gray-500 block">⏰ {srv.meeting_time} {srv.room_name ? `• 📍 ${srv.room_name}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
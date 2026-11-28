import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ReceivedInvitationsSection from '../components/ReceivedInvitationsSection';
import BellNotificationsPanel from '../components/priest/BellNotificationsPanel';
import {
  CalendarCheck,
  MessageSquareHeart,
  ShieldCheck,
  Info,
  Calendar,
  MapPin,
  School,
  Search,
  UserCheck,
  Sparkles,
  X,
  Check,
  Unlink,
  RotateCcw,
  Bell,
  Award,
  Gift,
  Link2,
  Bus,
  QrCode
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
  const parts = [first_name, second_name, third_name, fourth_name].map((p) =>
    String(p || '').trim()
  );
  const hasPartInput = parts.some(Boolean);

  if (hasPartInput) {
    const labels = ['الاسم الأول', 'الاسم الثاني', 'الاسم الثالث', 'الاسم الرابع'];
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i]) {
        return { valid: false, error: `يرجى كتابة ${labels[i]} باللغة العربية.` };
      }
      if (!isArabicOnlyName(parts[i])) {
        return {
          valid: false,
          error: `${labels[i]} يجب أن يكون باللغة العربية فقط (ممنوع الإنجليزي).`
        };
      }
    }
    return { valid: true, fullName: parts.join(' ') };
  }

  const normalizedFull = String(full_name || '').trim().replace(/\s+/g, ' ');
  const words = normalizedFull.split(' ').filter(Boolean);
  if (words.length < 4) {
    return {
      valid: false,
      error: 'يرجى كتابة الاسم الرباعي كاملاً (4 أسماء) باللغة العربية.'
    };
  }
  if (!isArabicOnlyName(normalizedFull)) {
    return {
      valid: false,
      error: 'الاسم الرباعي يجب أن يكون باللغة العربية فقط (ممنوع الإنجليزي).'
    };
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
  if (!digits) return '';
  if (digits.startsWith('0020') && digits.length >= 13) return '0' + digits.slice(4);
  if (digits.startsWith('20') && digits.length === 12) return '0' + digits.slice(2);
  if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
  return digits;
};

const getNameTokens = (user) => {
  if (!user) return [];
  const combinedSplit = [user.first_name, user.second_name, user.third_name, user.fourth_name]
    .map((s) => (s || '').trim())
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
  if (
    parent.family_role === 'أم' ||
    parent.family_role === 'الأم' ||
    parent.family_role === 'والدة'
  ) {
    return true;
  }
  const firstToken = normalizeArabic(parent.first_name || getNameTokens(parent)[0] || '');
  return [
    'مدام',
    'ام',
    'مريم',
    'ماري',
    'ايريني',
    'ايزيس',
    'هناء',
    'سوزان',
    'ناهد',
    'نجلاء',
    'داليا',
    'مونيكا',
    'كريستين',
    'فيفيان',
    'نادية'
  ].includes(firstToken);
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
    if (
      cMother &&
      pName &&
      (cMother === pName || cMother.startsWith(pName) || pName.startsWith(cMother))
    ) {
      return false;
    }
    return Boolean(
      candidate.mother_id &&
        candidate.mother_id !== parent.id &&
        existingUserIds.has(candidate.mother_id)
    );
  } else {
    if (
      cFather &&
      pName &&
      (cFather === pName || cFather.startsWith(pName) || pName.startsWith(cFather))
    ) {
      return false;
    }
    return Boolean(
      (candidate.father_id &&
        candidate.father_id !== parent.id &&
        existingUserIds.has(candidate.father_id)) ||
        (!candidate.mother_id &&
          candidate.parent_id &&
          candidate.parent_id !== parent.id &&
          existingUserIds.has(candidate.parent_id))
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

  const allParentPhones = [pOwnPhone, pSpousePhone].filter((p) => p.length >= 8);
  if (allParentPhones.some((p) => cOwnPhone && p === cOwnPhone)) {
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
    if (
      cMother &&
      (cMother === pName ||
        pName.startsWith(cMother) ||
        cMother.startsWith(pName) ||
        (pTokens.length >= 2 && cMother.startsWith(pTokens.slice(0, 2).join(' '))))
    ) {
      return 'تطابق اسم الأم المسجل للابن';
    }
    const spouseNorm = normalizeArabic(parent.spouse_name);
    if (spouseNorm && cFather && (cFather === spouseNorm || cFather.startsWith(spouseNorm))) {
      return 'تطابق اسم الأب/الزوج المسجل';
    }
  } else {
    if (
      cFather &&
      (cFather === pName || (pTokens.length >= 2 && cFather.startsWith(pTokens.slice(0, 2).join(' '))))
    ) {
      return 'تطابق اسم الأب بالكامل';
    }

    const cLineageTokens =
      cTokens.length > 1 ? cTokens.slice(1) : [cSecond, cThird, cFourth].filter(Boolean);
    const cLineageStr = cLineageTokens.join(' ');

    if (pTokens.length >= 2) {
      const pFirstTwo = pTokens.slice(0, 2).join(' ');
      if (
        cLineageTokens.length >= 2 &&
        cLineageTokens[0] === pTokens[0] &&
        cLineageTokens[1] === pTokens[1]
      ) {
        return `تطابق نسب الابن (${cFirst} ← ${pTokens[0]} ${pTokens[1]})`;
      }
      if (
        cLineageStr &&
        (cLineageStr === pName ||
          pName.startsWith(cLineageStr) ||
          cLineageStr.startsWith(pFirstTwo))
      ) {
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

const isGeneralChurchTrip = (tr) => {
  const tgt = normalizeArabic(tr?.target_service || tr?.stage_name || tr?.service_name || '');
  const sc = normalizeArabic(tr?.trip_scope || tr?.scope_type || '');
  return (
    Boolean(tr?.is_general_trip) ||
    sc === 'general' ||
    sc === 'trips_office' ||
    !tgt ||
    tgt === 'عام' ||
    tgt === 'رحلات عام' ||
    tgt === 'مكتب الرحلات' ||
    tgt.includes('مكتب الرحلات')
  );
};

export default function ParentDashboard({
  parent,
  childrenList = [],
  allUsers = [],
  attendance = [],
  spiritualNotes = [],
  visibleMemberNotes = [],
  commitmentStats = [],
  memberRewards = [],
  rewardCampaigns = [],
  serviceGroups = [],
  events = [],
  services = [],
  linkRequests = [],
  onLinkChild,
  onApproveLinkRequest,
  onRejectLinkRequest,
  onAcknowledgeNote,
  canManageLinks = true
}) {
  const curYear = new Date().getFullYear();
  const parentId = parent?.id || 'guest';
  const isMother = useMemo(() => detectParentIsMother(parent), [parent]);
  const dismissedStorageKey = `parent_dismissed_children_${parentId}`;

  const [activeTab, setActiveTab] = useState('children');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [validationError, setValidationError] = useState('');
  const [busyChildId, setBusyChildId] = useState(null);
  const [busyRequestId, setBusyRequestId] = useState(null);
  const [ackedNoteIds, setAckedNoteIds] = useState(() => new Set());
  const [parentTrips, setParentTrips] = useState([]);
  const [tripSubTab, setTripSubTab] = useState('children'); // 'children' | 'general'
  const [receivedInvitesCount, setReceivedInvitesCount] = useState(0);
  const [liveInviteToast, setLiveInviteToast] = useState('');
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(dismissedStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(dismissedStorageKey);
      setDismissedIds(saved ? JSON.parse(saved) : []);
    } catch {
      setDismissedIds([]);
    }
  }, [dismissedStorageKey]);

  useEffect(() => {
    if (!supabase || typeof supabase.from !== 'function') return;
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('church_trips')
          .select('*')
          .order('trip_date', { ascending: true });
        if (active && !error && Array.isArray(data)) {
          setParentTrips(data);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!parent?.id || !supabase || typeof supabase.channel !== 'function') return;

    const normParentPhone = normalizePhone(parent.phone);

    const channel = supabase
      .channel(`parent-invites-alert-${parent.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'church_invitations'
        },
        (payload) => {
          const row = payload.new || payload.old;
          const matchesParent =
            row?.recipient_user_id === parent.id ||
            (normParentPhone && normalizePhone(row?.recipient_phone) === normParentPhone);
          if (!matchesParent) return;

          if (payload.eventType === 'INSERT' && payload.new) {
            const tierLabel = payload.new.invite_tier === 'vip' ? 'VIP' : 'عامة';
            setLiveInviteToast(
              `وصلتك دعوة ${tierLabel}: ${payload.new.event_title}${
                payload.new.seat_or_zone ? ` (${payload.new.seat_or_zone})` : ''
              } — كود: ${payload.new.qr_token}`
            );
          } else if (payload.eventType === 'UPDATE' && payload.new?.status === 'checked_in') {
            setLiveInviteToast(
              `تم مسح QR الدعوة (${payload.new.event_title}) وتسجيل الدخول.`
            );
          }
        }
      )
      .subscribe();

    return () => {
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel);
      }
    };
  }, [parent?.id, parent?.phone]);

  const effectiveChildrenList = useMemo(() => {
    const map = new Map();
    childrenList.forEach((c) => map.set(c.id, c));
    allUsers.forEach((u) => {
      if (isCandidateLinkedToCurrentParent(parent, u)) {
        map.set(u.id, u);
      }
    });
    return Array.from(map.values());
  }, [childrenList, allUsers, parent]);

  const linkedIds = useMemo(
    () => new Set(effectiveChildrenList.map((c) => c.id)),
    [effectiveChildrenList]
  );
  const existingUserIds = useMemo(() => new Set(allUsers.map((u) => u.id)), [allUsers]);

  const { generalTripsForParent, childrenTripsForParent } = useMemo(() => {
    const childTokens = effectiveChildrenList
      .flatMap((ch) => [ch.assigned_class, ch.detailed_stage, ch.service_stage, ch.sector])
      .map(normalizeArabic)
      .filter((t) => t.length >= 2);

    const gen = [];
    const chTrips = [];

    for (const tr of parentTrips) {
      if (isGeneralChurchTrip(tr)) {
        gen.push(tr);
        continue;
      }
      const tgt = normalizeArabic(
        tr.target_service || tr.stage_name || tr.service_name || tr.assigned_class || ''
      );
      const matchesChild = childTokens.some(
        (tok) =>
          tgt === tok ||
          (tgt.length >= 3 && tok.includes(tgt)) ||
          (tok.length >= 3 && tgt.includes(tok))
      );
      if (matchesChild) {
        chTrips.push(tr);
      }
    }

    return { generalTripsForParent: gen, childrenTripsForParent: chTrips };
  }, [parentTrips, effectiveChildrenList]);

  const displayedParentTrips =
    tripSubTab === 'general' ? generalTripsForParent : childrenTripsForParent;

  const candidatePool = useMemo(
    () =>
      allUsers.filter(
        (u) => u.id !== parent?.id && !['admin', 'priest', 'parent'].includes(u.role)
      ),
    [allUsers, parent?.id]
  );

  const autoSuggestions = useMemo(() => {
    return candidatePool
      .filter((u) => {
        const blocked = isCandidateBlockedByOtherParent(parent, u, isMother, existingUserIds);
        return !linkedIds.has(u.id) && !blocked && !dismissedIds.includes(u.id);
      })
      .map((u) => ({ user: u, reason: getAutoMatchReason(parent, u, isMother) }))
      .filter((item) => Boolean(item.reason));
  }, [candidatePool, linkedIds, existingUserIds, dismissedIds, parent, isMother]);

  const phoneLookupResults = useMemo(() => {
    const qPhone = normalizePhone(phoneQuery);
    if (qPhone.length < 7) return [];

    return candidatePool
      .filter((u) => !linkedIds.has(u.id))
      .map((u) => {
        const fatherPhone = normalizePhone(u.father_phone);
        const motherPhone = normalizePhone(u.mother_phone);
        const matchedFather = Boolean(
          fatherPhone &&
            (fatherPhone === qPhone || fatherPhone.includes(qPhone) || qPhone.includes(fatherPhone))
        );
        const matchedMother = Boolean(
          motherPhone &&
            (motherPhone === qPhone || motherPhone.includes(qPhone) || qPhone.includes(motherPhone))
        );

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
      if (ok) {
        setPhoneQuery('');
        setActiveTab('children');
      }
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

  const handleAcknowledge = async (noteId) => {
    if (!noteId) return;
    setAckedNoteIds((prev) => new Set([...prev, noteId]));

    if (onAcknowledgeNote) {
      try {
        await onAcknowledgeNote(noteId);
      } catch {
        // ignore
      }
    }

    try {
      const { data, error } = await supabase
        .from('member_notes')
        .update({ acknowledged: true, is_read: true })
        .eq('id', noteId)
        .select('id');

      if (error || !Array.isArray(data) || data.length === 0) {
        setAckedNoteIds((prev) => {
          const next = new Set(prev);
          next.delete(noteId);
          return next;
        });
        console.error(
          'فشل حفظ تأكيد الاطلاع:',
          error?.message || 'لم يتم تحديث أي صف (غالباً صلاحيات RLS)'
        );
        alert('تعذر حفظ تأكيد الاطلاع، حاول مرة أخرى.');
        return;
      }

      try {
        await supabase
          .from('member_notes')
          .update({
            acknowledged_at: new Date().toISOString(),
            acknowledged_by: parent?.full_name || String(parent?.id || 'parent'),
            acknowledged_by_role: 'parent'
          })
          .eq('id', noteId);
      } catch {
        // ignore
      }
    } catch (err) {
      console.error('تعذر تحديث الملاحظة:', err);
    }
  };

  const renderNameBreakdown = (child) => {
    const tokens = getNameTokens(child);
    const first = child.first_name || tokens[0] || '';
    const rest =
      [child.second_name, child.third_name, child.fourth_name].filter(Boolean).join(' ') ||
      tokens.slice(1).join(' ');
    return (
      <div className="space-y-0.5">
        <strong className="text-sm text-[#7a1c24] block">
          {child.full_name || `${first} ${rest}`.trim()}
        </strong>
        {first && rest && (
          <p className="text-[11px] text-gray-600">
            الاسم الأول: <strong className="text-gray-900">{first}</strong> • اسم الأب/النسب:{' '}
            <strong className="text-gray-900">{rest}</strong>
          </p>
        )}
      </div>
    );
  };

  const linkAlertCount = linkRequests.length + (canManageLinks ? autoSuggestions.length : 0);

  const bellNoteItems = visibleMemberNotes
    .filter(
      (n) =>
        linkedIds.has(n.member_id) &&
        n.visible_to_parent !== false &&
        !n.acknowledged &&
        !ackedNoteIds.has(n.id)
    )
    .map((n) => ({
      id: n.id,
      note_text: n.note_text,
      behavior_tag: n.behavior_tag,
      child_name: allUsers.find((u) => String(u.id) === String(n.member_id))?.full_name || ''
    }));

  const tabsList = [
    { id: 'children', label: `👨‍👩‍👦 الأبناء والمتابعة (${effectiveChildrenList.length})` },
    { id: 'my_invites', label: 'دعواتي QR', badge: receivedInvitesCount },
    ...(canManageLinks || linkRequests.length > 0
      ? [{ id: 'linking', label: '🔗 ربط الأبناء', badge: linkAlertCount }]
      : []),
    {
      id: 'trips',
      label: '🚌 الرحلات',
      badge: childrenTripsForParent.length + generalTripsForParent.length
    },
    { id: 'campaigns', label: `🎁 العروض والرحلات (${rewardCampaigns.length})` },
    { id: 'masses', label: `⛪ القداسات والاجتماعات (${events.length})` },
    { id: 'services', label: `🏫 الفصول والخدمات (${services.length})` }
  ];

  return (
    <div className="space-y-3 text-xs" dir="rtl">
      {liveInviteToast && (
        <div className="bg-emerald-50 border-2 border-emerald-400 p-3 rounded-2xl flex items-center justify-between gap-2 text-emerald-950 font-black">
          <span>{liveInviteToast}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('my_invites')}
              className="px-3 py-1 bg-emerald-700 text-white rounded-xl cursor-pointer"
            >
              عرض الـ QR
            </button>
            <button
              type="button"
              onClick={() => setLiveInviteToast('')}
              className="text-emerald-800 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="bg-linear-to-l from-[#5c1319] via-[#7a1c24] to-[#91212b] text-white p-4 sm:p-5 rounded-3xl shadow-md flex flex-col lg:flex-row justify-between lg:items-center gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base sm:text-xl font-black text-amber-200">
              أهلاً بحضرتك، {parent?.full_name}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-amber-100 text-[11px] font-black">
              {isMother ? '👩 حساب ولي الأمر: الأم' : '👨 حساب ولي الأمر: الأب'}
            </span>
          </div>
          <p className="text-xs text-white/85 mt-1">
            متابعة الأبناء في الكنيسة: الحضور السنوي، الالتزام، الاعتراف، العروض، وملاحظات الأب الكاهن
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
          <div className="col-span-2 sm:col-span-1 flex justify-center">
            <BellNotificationsPanel
              role="parent"
              currentUser={parent}
              readerId={parent?.id}
              allUsers={allUsers}
              linkRequests={linkRequests}
              noteItems={bellNoteItems}
              onAckNote={handleAcknowledge}
              birthdayItems={effectiveChildrenList}
              trips={[...childrenTripsForParent, ...generalTripsForParent]}
              todayISO={new Date().toLocaleDateString('en-CA')}
              onNavigateCard={(cardId) => setActiveTab(cardId)}
            />
          </div>
          <div className="bg-white/15 border border-white/15 px-3.5 py-2 rounded-2xl text-center">
            <span className="text-[10px] opacity-85 font-bold block">الأبناء المربوطون</span>
            <strong className="text-sm sm:text-base text-amber-200 font-black">
              {effectiveChildrenList.length}
            </strong>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('my_invites')}
            className="bg-white/15 hover:bg-white/25 border border-white/20 px-3.5 py-2 rounded-2xl text-center cursor-pointer transition"
          >
            <span className="text-[10px] opacity-85 font-bold block flex items-center justify-center gap-1">
              <QrCode size={11} /> دعواتي QR
            </span>
            <strong className="text-sm sm:text-base text-amber-200 font-black">
              {receivedInvitesCount}
            </strong>
          </button>
          {linkAlertCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('linking')}
              className="bg-amber-100 hover:bg-amber-200 text-[#4a0e13] px-3.5 py-2 rounded-2xl text-center font-black cursor-pointer shadow transition"
            >
              <span className="text-[10px] block">طلبات / مقترحات ربط</span>
              <strong className="text-sm">{linkAlertCount} ↗</strong>
            </button>
          )}
        </div>
      </div>

      {linkRequests.length > 0 && activeTab !== 'linking' && (
        <div className="bg-emerald-50 border-2 border-emerald-300 px-4 py-2.5 rounded-2xl flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2 text-emerald-950 font-black">
            <Bell size={16} className="text-emerald-700" />
            <span>يوجد ({linkRequests.length}) طلب ربط ابن ينتظر موافقتك</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('linking')}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black cursor-pointer"
          >
            مراجعة وقبول الطلبات ↗
          </button>
        </div>
      )}

      <div className="bg-white p-2 rounded-2xl border shadow-2xs flex items-center gap-1.5 overflow-x-auto font-black">
        {tabsList.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-xl shrink-0 cursor-pointer flex items-center gap-1.5 transition ${
              activeTab === tab.id
                ? 'bg-[#7a1c24] text-white shadow-2xs'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-400 text-[#4a0e13] rounded-full text-[10px] font-black">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {validationError && (
        <div className="bg-red-50 border border-red-300 text-red-900 p-3 rounded-2xl font-bold flex items-center justify-between gap-2">
          <span>⚠️ {validationError}</span>
          <button
            type="button"
            onClick={() => setValidationError('')}
            className="text-red-700 font-black cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <div className="max-h-[calc(100dvh-265px)] overflow-y-auto pr-1 space-y-4">
        {activeTab === 'my_invites' && (
          <ReceivedInvitationsSection
            currentUser={parent}
            onCountChange={setReceivedInvitesCount}
          />
        )}

        {activeTab === 'trips' && (
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5">
                <Bus size={17} /> الرحلات المتاحة (رحلات أبنائي ورحلات عام)
              </h3>
              <div className="flex items-center gap-1.5 bg-[#fbfaf7] p-1 rounded-2xl border">
                <button
                  type="button"
                  onClick={() => setTripSubTab('children')}
                  className={`px-3.5 py-1.5 rounded-xl font-black text-xs cursor-pointer transition ${
                    tripSubTab === 'children'
                      ? 'bg-[#7a1c24] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  رحلات أبنائي ({childrenTripsForParent.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTripSubTab('general')}
                  className={`px-3.5 py-1.5 rounded-xl font-black text-xs cursor-pointer transition ${
                    tripSubTab === 'general'
                      ? 'bg-[#7a1c24] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  رحلات عام ({generalTripsForParent.length})
                </button>
              </div>
            </div>

            {displayedParentTrips.length === 0 ? (
              <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
                {tripSubTab === 'general'
                  ? 'لا توجد رحلات عامة معلنة من مكتب الرحلات حالياً.'
                  : 'لا توجد رحلات خاصة بفصول أو مراحل أبنائك حالياً.'}
              </div>
            ) : (
              <div className="grid gap-3">
                {displayedParentTrips.map((tr) => {
                  const isOvernight =
                    Number(tr.days_count || 1) > 1 ||
                    (Array.isArray(tr.rooms) && tr.rooms.length > 0);
                  return (
                    <div
                      key={tr.id}
                      className="p-4 bg-purple-50/40 border border-purple-200 rounded-2xl space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-950 rounded-lg text-[10px] font-black">
                            {tripSubTab === 'general'
                              ? '🌐 رحلات عام (مكتب الرحلات)'
                              : `👨‍👩‍👦 رحلات أبنائي (${tr.target_service || 'فصل الابن'})`}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-lg text-[10px] font-bold">
                            {tr.trip_category || 'رحلة'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                              isOvernight
                                ? 'bg-indigo-100 text-indigo-950'
                                : 'bg-amber-100 text-amber-950'
                            }`}
                          >
                            {isOvernight ? `🌙 ${tr.days_count} أيام` : '☀️ يوم واحد'}
                          </span>
                          <strong className="text-sm text-gray-900">{tr.title}</strong>
                        </div>
                        <span className="text-xs font-bold text-gray-600">
                          📅 {tr.trip_date || 'قريباً'}
                        </span>
                      </div>
                      {tr.monasteries && (
                        <p className="text-gray-800">
                          ⛪ <strong>الأماكن:</strong> {tr.monasteries}
                        </p>
                      )}
                      {tr.daily_program && (
                        <div className="p-3 bg-white border border-purple-100 rounded-xl text-gray-700 whitespace-pre-line">
                          {tr.daily_program}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'children' && (
          <>
            {effectiveChildrenList.length === 0 ? (
              <div className="bg-amber-50/70 border border-amber-200 p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-100 text-[#7a1c24] flex items-center justify-center shrink-0">
                    <Info size={22} />
                  </div>
                  <div>
                    <strong className="text-sm text-amber-950 block">
                      لا يوجد أبناء مربوطون بحسابك حتى الآن
                    </strong>
                    <p className="text-amber-900/80 mt-0.5">
                      يمكنك ربط أبنائك من تاب «ربط الأبناء» عبر الاقتراحات التلقائية أو البحث برقم تليفون الأب أو الأم.
                    </p>
                  </div>
                </div>
                {canManageLinks && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('linking')}
                    className="px-4 py-2.5 bg-[#7a1c24] text-white rounded-xl font-black shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Link2 size={14} /> الانتقال لربط الأبناء
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                {effectiveChildrenList.map((child) => {
                  const childAtt = attendance.filter(
                    (a) => a.member_id === child.id && a.event_date?.startsWith(String(curYear))
                  );
                  const presentCount = childAtt.filter((a) => a.present).length;
                  const totalCount = childAtt.length;
                  const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

                  const commStat = commitmentStats.find(
                    (c) => String(c.member_id) === String(child.id)
                  );
                  const noteObj = spiritualNotes.find((n) => n.member_id === child.id);
                  const childVisibleNotes = visibleMemberNotes.filter(
                    (n) => String(n.member_id) === String(child.id) && n.visible_to_parent !== false
                  );
                  const childRewardsList = memberRewards.filter(
                    (r) => String(r.member_id) === String(child.id)
                  );

                  return (
                    <div
                      key={child.id}
                      className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-gray-100 pb-3">
                        <div>
                          <h3 className="text-base font-black text-[#7a1c24]">{child.full_name}</h3>
                          <p className="text-gray-500 mt-0.5">
                            المرحلة: {child.detailed_stage || child.service_stage || '—'}
                            {child.assigned_class ? ` • ${child.assigned_class}` : ''}
                            {child.sector ? ` • ${child.sector}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                          <span className="px-3.5 py-1.5 bg-amber-100 text-amber-950 rounded-xl font-black">
                            حضور {curYear}: {commStat?.attendance_percentage ?? rate}%
                          </span>
                          {commStat?.commitment_status && (
                            <span className="px-3 py-1.5 bg-teal-50 text-teal-900 border border-teal-200 rounded-xl font-black">
                              {commStat.commitment_status}
                            </span>
                          )}
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
                            <CalendarCheck size={16} className="text-green-700" /> الحضور والالتزام خلال سنة {curYear}
                          </div>
                          <p className="text-gray-600">
                            حضر <strong className="text-green-700 text-sm">{presentCount}</strong> مرة من أصل{' '}
                            <strong>{totalCount}</strong> لقاء مسجل.
                          </p>
                          {commStat && (
                            <p className="text-[11px] text-gray-500">
                              الغياب: <strong>{commStat.absent_count ?? 0}</strong> • التأخير:{' '}
                              <strong>{commStat.late_count ?? 0}</strong> • الانصراف المبكر:{' '}
                              <strong>{commStat.early_leave_count ?? 0}</strong>
                            </p>
                          )}
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
                              <p className="text-gray-500">
                                آخر اعتراف مسجل: {noteObj.last_confession_date || 'غير مسجل'}
                              </p>
                            </>
                          ) : (
                            <p className="text-gray-400">
                              لم يقم الأب الكاهن بتسجيل متابعة اعتراف بعد.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="bg-[#f9ecee] border border-[#ebd0d4] p-3.5 rounded-2xl space-y-2">
                        <div className="flex items-center gap-1.5 font-black text-[#7a1c24]">
                          <MessageSquareHeart size={16} /> ملاحظات الأب الكاهن والمتابعة على الابن/الابنة:
                        </div>
                        {(noteObj?.priest_note || childVisibleNotes.length === 0) && (
                          <p className="text-[#4a0e13] leading-relaxed">
                            {noteObj?.priest_note
                              ? noteObj.priest_note
                              : 'لا توجد ملاحظات مسجلة من الأب الكاهن حالياً.'}
                          </p>
                        )}

                        {childVisibleNotes.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {childVisibleNotes.map((mn) => {
                              const isAcked = mn.acknowledged || ackedNoteIds.has(mn.id);
                              return (
                                <div
                                  key={mn.id}
                                  className="bg-white/90 p-2.5 rounded-xl border border-[#e3c2c7] flex flex-wrap justify-between items-center gap-2"
                                >
                                  <div>
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-950 rounded-lg text-[10px] font-black ml-1.5">
                                      {mn.behavior_tag || 'ملاحظة متابعة'}
                                    </span>
                                    <span className="text-[#4a0e13] font-bold">{mn.note_text}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleAcknowledge(mn.id)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer ${
                                      isAcked
                                        ? 'bg-emerald-100 text-emerald-900'
                                        : 'bg-[#7a1c24] text-white'
                                    }`}
                                  >
                                    {isAcked ? 'تم الاطلاع ✓' : 'تأكيد الاطلاع'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {childRewardsList.length > 0 && (
                        <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl space-y-2">
                          <div className="flex items-center gap-1.5 font-black text-emerald-950">
                            <Gift size={16} className="text-emerald-700" /> مكافآت وعروض وخصومات مستحقة
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {childRewardsList.map((rw) => (
                              <div
                                key={rw.id}
                                className="bg-white p-2.5 rounded-xl border border-emerald-200 flex justify-between items-center gap-2"
                              >
                                <div>
                                  <strong className="text-gray-900 block">{rw.reward_title}</strong>
                                  <span className="text-[11px] text-gray-500">
                                    {rw.reward_type} {rw.granted_date ? `• ${rw.granted_date}` : ''}
                                  </span>
                                </div>
                                {Number(rw.discount_percent || 0) > 0 && (
                                  <span className="px-2 py-1 bg-emerald-100 text-emerald-900 rounded-lg font-black text-[11px] shrink-0">
                                    خصم {rw.discount_percent}%
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'linking' && (
          <div className="space-y-4">
            {linkRequests.length > 0 && (
              <div className="bg-emerald-50 border-2 border-emerald-300 p-4 sm:p-5 rounded-3xl shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-emerald-950">
                  <Bell size={18} className="text-emerald-700 shrink-0" />
                  <div>
                    <h3 className="text-sm font-black">
                      طلبات ربط أبناء تنتظر موافقتك ({linkRequests.length})
                    </h3>
                    <p className="text-[11px] text-emerald-900/80">
                      راجع بيانات الابن واضغط «قبول الربط» لتأكيد صلته بك أو «رفض» لتجاهل الطلب.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {linkRequests.map((req) => {
                    const childUser = allUsers.find((u) => u.id === req.child_id);
                    const displayName = childUser?.full_name || req.child_name || 'حساب ابن';
                    const guardianLabel = req.guardian_type === 'mother' ? 'الأم' : 'الأب';

                    return (
                      <div
                        key={req.id}
                        className="bg-white p-3.5 rounded-2xl border border-emerald-200 flex flex-col justify-between gap-3"
                      >
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
                            <Check size={14} />{' '}
                            {busyRequestId === req.id ? 'جاري القبول...' : 'قبول الربط'}
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

            {canManageLinks && autoSuggestions.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-300 p-4 sm:p-5 rounded-3xl shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-amber-950">
                  <Sparkles size={18} className="text-[#7a1c24] shrink-0" />
                  <div>
                    <h3 className="text-sm font-black">
                      تم العثور على أبناء مطابقين لبياناتك تلقائياً — هل هم أبناؤك؟
                    </h3>
                    <p className="text-[11px] text-amber-900/80">
                      اضغط «نعم، ده ابني» لربط الحساب القائم بحسابك مباشرة (الطفل الأول والثاني وكل ابن) دون إنشاء حسابات مكررة.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {autoSuggestions.map(({ user: child, reason }) => (
                    <div
                      key={child.id}
                      className="bg-white p-3.5 rounded-2xl border border-amber-200 flex flex-col justify-between gap-3"
                    >
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
                          <Check size={14} />{' '}
                          {busyChildId === child.id ? 'جاري الربط...' : 'نعم، ده ابني'}
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
                      <h3 className="font-black text-sm text-[#7a1c24]">
                        إظهار تفاصيل الأبناء وربطهم برقم تليفون الأب أو الأم
                      </h3>
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
                    onChange={(e) => setPhoneQuery(e.target.value)}
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
                          const linkedToOther = isCandidateBlockedByOtherParent(
                            parent,
                            child,
                            isMother,
                            existingUserIds
                          );
                          return (
                            <div
                              key={child.id}
                              className="p-3.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl flex flex-col justify-between gap-2.5"
                            >
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
                                  <Check size={14} />{' '}
                                  {busyChildId === child.id
                                    ? 'جاري الربط...'
                                    : 'نعم، ربط هذا الابن بحسابي'}
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
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
            <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5 border-b border-gray-100 pb-3">
              <Award size={17} /> العروض والرحلات والمؤتمرات المتاحة ({rewardCampaigns.length})
            </h3>
            {rewardCampaigns.length === 0 ? (
              <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
                لا توجد عروض أو رحلات مضافة حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rewardCampaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="p-3.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm text-gray-900">{camp.title}</strong>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-950 rounded-lg font-bold text-[10px]">
                        {camp.target_scope || 'عام'}
                      </span>
                    </div>
                    {camp.description && <p className="text-gray-600">{camp.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'masses' && (
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
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-bold text-[10px]">
                          {ev.event_type || 'قداس'}
                        </span>
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
        )}

        {activeTab === 'services' && (
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
            <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5 border-b border-gray-100 pb-3">
              <School size={17} /> الفصول والخدمات المتاحة بالكنيسة
            </h3>
            {services.length === 0 ? (
              <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
                لا توجد فصول أو خدمات مسجلة حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {services.map((srv) => {
                  const grp = serviceGroups.find((g) => g.id === srv.group_id);
                  return (
                    <div
                      key={srv.id}
                      className="p-3.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-sm text-gray-900">{srv.class_name}</strong>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-lg font-bold text-[10px]">
                          {grp?.group_name ? `${grp.group_name} • ` : ''}
                          {srv.stage_name}
                        </span>
                      </div>
                      <span className="text-gray-500 block">
                        ⏰ {srv.meeting_time} {srv.room_name ? `• 📍 ${srv.room_name}` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
import { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';
import PriestInvitationModal from '../components/priest/PriestInvitationModal';
import ReceivedInvitationsSection from '../components/ReceivedInvitationsSection';
import BellNotificationsPanel from '../components/priest/BellNotificationsPanel';
import ChangePasswordBox from '../components/ChangePasswordBox';
import {
  Phone,
  AlertCircle,
  CheckCircle2,
  Calendar,
  BookOpen,
  Clock,
  UserCheck,
  MessageCircle,
  Bus,
  MapPin,
  Layers,
  XCircle,
  MailPlus,
  QrCode,
  X,
  RefreshCw,
  Download,
  ShieldCheck,
  User
} from 'lucide-react';

const normalizeText = (val = '') =>
  String(val || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');

const normalizePhoneNumber = (phone = '') => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('20') && digits.length === 12) {
    return digits.slice(2);
  }
  if (digits.startsWith('0020') && digits.length === 14) {
    return digits.slice(4);
  }
  return digits;
};

const splitList = (val) =>
  String(val || '')
    .split(/[,،]/)
    .map((s) => s.trim())
    .filter(Boolean);

function buildMemberQrPayload(member = {}) {
  return JSON.stringify({
    v: 1,
    type: 'church_member_attendance',
    user_id: member.id || '',
    username: member.username || '',
    full_name: member.full_name || member.name || '',
    role: member.role || 'member',
    role_label: member.permissions?.custom_role_label || member.role || 'مخدوم'
  });
}

function MemberPersonalQrModal({ member, onClose }) {
  const [qrUrl, setQrUrl] = useState('');

  const generateQr = () => {
    if (!member?.id && !member?.username) {
      setQrUrl('');
      return;
    }
    const payload = buildMemberQrPayload(member);
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 3,
      width: 340,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => setQrUrl(url))
      .catch(() => setQrUrl(''));
  };

  useEffect(() => {
    generateQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.id, member?.username, member?.full_name, member?.role]);

  if (!member) return null;

  const displayName = member.full_name || member.name || member.username || 'مخدوم';
  const roleLabel = member.permissions?.custom_role_label || member.role || 'مخدوم';

  const handleDownload = () => {
    if (!qrUrl) return;
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `My-QR-${member.username || member.id || 'member'}.png`;
    link.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-5 space-y-4 text-xs border border-slate-200">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 text-[#7a1c24]">
            <div className="p-2 rounded-2xl bg-[#f9ecee]">
              <QrCode size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black">الـ QR Code بتاعي</h3>
              <p className="text-[11px] text-gray-500">
                اعرضه للخادم عند الدخول لتسجيل الحضور وعند الخروج لتسجيل الانصراف
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center bg-[#fbfaf7] border-2 border-slate-200 rounded-3xl p-4 space-y-3">
          <div className="w-48 h-48 rounded-2xl bg-white border-2 border-slate-900/15 p-2.5 flex items-center justify-center shadow-inner">
            {qrUrl ? (
              <img
                src={qrUrl}
                alt="My Attendance QR Code"
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <span className="text-gray-400 text-xs font-bold">جاري توليد الـ QR...</span>
            )}
          </div>

          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 font-black text-sm text-gray-900">
              <User size={15} className="text-[#7a1c24]" />
              <span>{displayName}</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-600 font-bold">
              <ShieldCheck size={13} className="text-emerald-700" />
              <span>{roleLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={generateQr}
              className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={13} /> تحديث
            </button>
            {qrUrl && (
              <button
                type="button"
                onClick={handleDownload}
                className="px-3 py-2 rounded-xl bg-[#7a1c24] hover:bg-[#5c1319] text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={13} /> حفظ QR
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs cursor-pointer"
          >
            تم
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MemberDashboard({
  member,
  servants = [],
  events = [],
  services = [],
  serviceGroups = [],
  attendance = [],
  confessionSlots = [],
  priestMasses = [],
  priests = [],
  onMemberUpdated
}) {
  const [activeTab, setActiveTab] = useState('services'); // 'services' | 'confessions' | 'masses' | 'trips' | 'my_invites' | 'invite'
  const [tripSubTab, setTripSubTab] = useState('my_service'); // 'my_service' | 'general'
  const [selectedPriestId, setSelectedPriestId] = useState(member?.confession_father_id || '');
  const [savingFather, setSavingFather] = useState(false);
  const [filterPriestId, setFilterPriestId] = useState(member?.confession_father_id || 'all');
  const [myBookings, setMyBookings] = useState([]);
  const [bookingBusy, setBookingBusy] = useState(null);

  const [allTrips, setAllTrips] = useState([]);
  const [myTripRegs, setMyTripRegs] = useState([]);
  const [tripBusy, setTripBusy] = useState(null);
  const [confessionIntervalDays, setConfessionIntervalDays] = useState(45);
  const [receivedInvitesCount, setReceivedInvitesCount] = useState(0);
  const [liveInviteToast, setLiveInviteToast] = useState('');
  const [showMyQrModal, setShowMyQrModal] = useState(false);

  const todayISO = new Date().toLocaleDateString('en-CA');

  const myAtt = useMemo(
    () => attendance.filter((a) => a.member_id === member?.id),
    [attendance, member?.id]
  );

  const presentCount = useMemo(
    () => myAtt.filter((a) => a.present).length,
    [myAtt]
  );

  const myConfFather = useMemo(
    () => priests.find((p) => p.id === member?.confession_father_id),
    [priests, member?.confession_father_id]
  );

  useEffect(() => {
    setSelectedPriestId(member?.confession_father_id || '');
    setFilterPriestId(member?.confession_father_id || 'all');
  }, [member?.confession_father_id]);

  useEffect(() => {
    if (!member?.id) return;
    let cancelled = false;

    Promise.all([
      supabase
        .from('confession_bookings')
        .select('*')
        .eq('member_id', member.id)
        .order('booking_date', { ascending: true }),
      supabase
        .from('church_trips')
        .select('*')
        .order('trip_date', { ascending: true }),
      supabase
        .from('trip_registrations')
        .select('*')
        .eq('user_id', member.id),
      supabase
        .from('service_settings')
        .select('value')
        .eq('key', 'confession_interval_days')
        .maybeSingle()
    ]).then(([cb, tr, reg, intv]) => {
      if (cancelled) return;
      if (!cb.error && cb.data) setMyBookings(cb.data);
      if (!tr.error && tr.data) setAllTrips(tr.data);
      if (!reg.error && reg.data) setMyTripRegs(reg.data);
      if (!intv.error && intv.data?.value?.days) {
        setConfessionIntervalDays(Number(intv.data.value.days) || 45);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [member?.id]);

  useEffect(() => {
    if (!member?.id || !supabase || typeof supabase.channel !== 'function') return;

    const userPhones = [member.phone, member.father_phone, member.mother_phone]
      .map(normalizePhoneNumber)
      .filter(Boolean);
    const normMemberName = normalizeText(member.full_name);

    const channel = supabase
      .channel(`member-invites-alert-${member.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'church_invitations'
        },
        (payload) => {
          const row = payload.new || payload.old;
          if (!row) return;

          const rowRecipientId = String(row.recipient_user_id || '').trim();
          const matchesUser = rowRecipientId
            ? rowRecipientId === String(member.id)
            : (normalizePhoneNumber(row.recipient_phone) &&
                userPhones.includes(normalizePhoneNumber(row.recipient_phone))) ||
              (normMemberName && normalizeText(row.recipient_name) === normMemberName);

          if (!matchesUser) return;

          if (payload.eventType === 'INSERT' && payload.new) {
            const tierLabel = payload.new.invite_tier === 'vip' ? 'VIP' : 'عامة';
            setLiveInviteToast(
              `وصلتك دعوة ${tierLabel}: ${payload.new.event_title}${
                payload.new.seat_or_zone ? ` (${payload.new.seat_or_zone})` : ''
              } — كود: ${payload.new.qr_token}`
            );
          } else if (payload.eventType === 'UPDATE' && payload.new?.status === 'checked_in') {
            setLiveInviteToast(
              `تم مسح QR الدعوة (${payload.new.event_title}) وتسجيل دخولك.`
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
  }, [
    member?.id,
    member?.phone,
    member?.father_phone,
    member?.mother_phone,
    member?.full_name
  ]);

  const myServiceCards = useMemo(() => {
    if (!member) return [];

    const assignedClasses = splitList(member.assigned_class);
    const generalNames = splitList(member.general_service_name);
    const detailedStages = splitList(member.detailed_stage || member.service_stage);
    const extraServices = Array.isArray(member?.permissions?.extra_services)
      ? member.permissions.extra_services.map((s) => String(s || '').trim()).filter(Boolean)
      : [];

    const matchedMap = new Map();

    const getServantsForTarget = (targetTokens = [], targetServiceId = null) => {
      const normTokens = targetTokens.map((t) => normalizeText(t)).filter(Boolean);
      return servants.filter((sv) => {
        if (targetServiceId && sv.service_id === targetServiceId) return true;
        const svTokens = [
          ...splitList(sv.assigned_class),
          ...splitList(sv.detailed_stage || sv.service_stage),
          ...splitList(sv.general_service_name),
          ...splitList(sv.sector),
          ...(Array.isArray(sv.permissions?.extra_services) ? sv.permissions.extra_services : [])
        ]
          .map((t) => normalizeText(t))
          .filter(Boolean);

        return normTokens.some((tk) => svTokens.includes(tk));
      });
    };

    const addCard = ({
      key,
      title,
      stageLabel,
      kindLabel,
      meetingTime,
      roomName,
      headServant,
      serviceId,
      matchTokens
    }) => {
      const normKey = normalizeText(key || title);
      if (!normKey || matchedMap.has(normKey)) return;
      matchedMap.set(normKey, {
        id: normKey,
        title,
        stageLabel,
        kindLabel,
        meetingTime,
        roomName,
        headServant,
        servants: getServantsForTarget(matchTokens, serviceId)
      });
    };

    if (member.service_id) {
      const exactSrv = services.find((s) => s.id === member.service_id);
      if (exactSrv) {
        addCard({
          key: `srv-${exactSrv.id}`,
          title: exactSrv.class_name || exactSrv.stage_name,
          stageLabel: exactSrv.stage_name || 'خدمة',
          kindLabel: exactSrv.has_classes === false ? 'خدمة عامة' : 'فصلك',
          meetingTime: exactSrv.meeting_time,
          roomName: exactSrv.room_name,
          headServant: exactSrv.head_servant_name,
          serviceId: exactSrv.id,
          matchTokens: [exactSrv.class_name, exactSrv.stage_name]
        });
      }
    }

    assignedClasses.forEach((clsName) => {
      const normCls = normalizeText(clsName);
      const foundSrv = services.find((s) => normalizeText(s.class_name) === normCls);
      if (foundSrv) {
        addCard({
          key: `cls-${normCls}`,
          title: foundSrv.class_name,
          stageLabel: foundSrv.stage_name || 'فصل',
          kindLabel: 'فصلك',
          meetingTime: foundSrv.meeting_time,
          roomName: foundSrv.room_name,
          headServant: foundSrv.head_servant_name,
          serviceId: foundSrv.id,
          matchTokens: [foundSrv.class_name, foundSrv.stage_name]
        });
      } else {
        addCard({
          key: `cls-${normCls}`,
          title: clsName,
          stageLabel: detailedStages[0] || 'فصل',
          kindLabel: 'فصلك',
          meetingTime: '',
          roomName: '',
          headServant: '',
          serviceId: null,
          matchTokens: [clsName]
        });
      }
    });

    const otherNames = [
      ...new Set([
        ...generalNames,
        ...extraServices,
        ...(assignedClasses.length === 0 ? detailedStages : [])
      ])
    ].filter((n) => n && normalizeText(n) !== 'شعب عام');

    otherNames.forEach((srvName) => {
      const normName = normalizeText(srvName);
      const isExplicitExtra =
        extraServices.some((ex) => normalizeText(ex) === normName) ||
        generalNames.some((gn) => normalizeText(gn) === normName);
      if (assignedClasses.length > 0 && !isExplicitExtra && detailedStages.length <= 1) return;

      const grp = serviceGroups.find((g) => normalizeText(g.group_name) === normName);
      const srvRow = services.find(
        (s) => normalizeText(s.stage_name) === normName || normalizeText(s.class_name) === normName
      );

      if (grp) {
        addCard({
          key: `grp-${normName}`,
          title: grp.group_name,
          stageLabel: grp.gender_target || 'خدمة',
          kindLabel: grp.has_classes === false ? 'اجتماع / خدمة عامة' : 'خدمة مشترك بها',
          meetingTime: grp.service_day
            ? `${grp.service_day} ${grp.start_time || ''}`.trim()
            : srvRow?.meeting_time || '',
          roomName: srvRow?.room_name || '',
          headServant: grp.head_servant_name || srvRow?.head_servant_name || '',
          serviceId: srvRow?.id || null,
          matchTokens: [grp.group_name]
        });
      } else if (srvRow) {
        addCard({
          key: `srvname-${normName}`,
          title: srvRow.stage_name || srvRow.class_name,
          stageLabel: srvRow.stage_name || 'خدمة',
          kindLabel: 'خدمة مشترك بها',
          meetingTime: srvRow.meeting_time || '',
          roomName: srvRow.room_name || '',
          headServant: srvRow.head_servant_name || '',
          serviceId: srvRow.id,
          matchTokens: [srvName, srvRow.class_name, srvRow.stage_name]
        });
      } else {
        addCard({
          key: `custom-${normName}`,
          title: srvName,
          stageLabel: 'خدمة',
          kindLabel: 'خدمة مشترك بها',
          meetingTime: '',
          roomName: '',
          headServant: '',
          serviceId: null,
          matchTokens: [srvName]
        });
      }
    });

    return Array.from(matchedMap.values());
  }, [member, services, serviceGroups, servants]);

  const { generalTrips, myServiceTrips } = useMemo(() => {
    const memberServiceTokens = [
      ...myServiceCards.map((c) => c.title),
      ...myServiceCards.map((c) => c.stageLabel),
      ...splitList(member?.assigned_class),
      ...splitList(member?.detailed_stage),
      ...splitList(member?.service_stage),
      ...splitList(member?.general_service_name),
      ...(Array.isArray(member?.permissions?.extra_services)
        ? member.permissions.extra_services
        : [])
    ]
      .map((t) => normalizeText(t))
      .filter((t) => t.length >= 2);

    const gen = [];
    const mine = [];

    for (const tr of allTrips) {
      const targetSrvRaw = String(
        tr.target_service || tr.stage_name || tr.service_name || tr.assigned_class || ''
      ).trim();
      const normTarget = normalizeText(targetSrvRaw);
      const scopeType = normalizeText(tr.trip_scope || tr.scope_type || '');

      const isGeneralTrip =
        Boolean(tr.is_general_trip) ||
        scopeType === 'general' ||
        scopeType === 'trips_office' ||
        !normTarget ||
        normTarget === 'عام' ||
        normTarget === 'رحلات عام' ||
        normTarget === 'مكتب الرحلات' ||
        normTarget.includes('مكتب الرحلات');

      if (isGeneralTrip) {
        if (tr.is_public !== false) gen.push(tr);
        continue;
      }

      const matchesMine = memberServiceTokens.some(
        (tok) =>
          normTarget === tok ||
          (normTarget.length >= 3 && tok.includes(normTarget)) ||
          (tok.length >= 3 && normTarget.includes(tok))
      );

      if (matchesMine) {
        mine.push(tr);
      }
    }

    return { generalTrips: gen, myServiceTrips: mine };
  }, [allTrips, myServiceCards, member]);

  const onlyMassEvents = useMemo(
    () =>
      events.filter(
        (ev) => (ev.event_type || '').includes('قداس') || (ev.event_type || '').includes('عشية')
      ),
    [events]
  );

  const handleChooseConfessionFather = async (e) => {
    e.preventDefault();
    if (!selectedPriestId) return alert('اختر الأب الكاهن أولاً');
    const priestObj = priests.find((p) => p.id === selectedPriestId);
    setSavingFather(true);
    try {
      const { data, error } = await supabase
        .from('church_users')
        .update({
          confession_father_id: selectedPriestId,
          confession_father: priestObj?.full_name || ''
        })
        .eq('id', member.id)
        .select()
        .single();

      if (error) alert('تعذر الحفظ: ' + error.message);
      else if (data) {
        if (onMemberUpdated) onMemberUpdated(data);
        logActivity({
          user: member,
          actionType: 'تحديد_أب_الاعتراف',
          targetTable: 'church_users',
          targetId: member.id,
          description: `اختار ${member.full_name} أب الاعتراف: ${priestObj?.full_name}`
        });
        alert(`تم تسجيل أب الاعتراف (${priestObj?.full_name}) بنجاح ✅`);
      }
    } finally {
      setSavingFather(false);
    }
  };

  const handleBookSlot = async (slot) => {
    const already = myBookings.some((b) => b.slot_id === slot.id && b.status === 'محجوز');
    if (already) return alert('أنت حاجز هذا الميعاد بالفعل ✅');
    setBookingBusy(slot.id);
    try {
      const { data, error } = await supabase
        .from('confession_bookings')
        .insert([
          {
            slot_id: slot.id,
            priest_id: slot.priest_id,
            member_id: member.id,
            member_name: member.full_name,
            member_phone: member.phone || '',
            booking_date: slot.slot_date,
            booking_time: slot.start_time || '',
            status: 'محجوز'
          }
        ])
        .select()
        .single();

      if (error) alert('تعذر الحجز: ' + error.message);
      else if (data) {
        setMyBookings((prev) => [...prev, data]);
        logActivity({
          user: member,
          actionType: 'حجز_ميعاد_اعتراف',
          targetTable: 'confession_bookings',
          targetId: data.id,
          description: `حجز ${member.full_name} ميعاد اعتراف يوم ${slot.slot_date}`
        });
        alert(`تم حجز ميعاد الاعتراف يوم ${slot.slot_date} بنجاح 🙏`);
      }
    } finally {
      setBookingBusy(null);
    }
  };

  const handleCancelBooking = async (booking) => {
    if (!booking?.id) return;
    if (!confirm(`هل تريد إلغاء حجز ميعاد الاعتراف يوم ${booking.booking_date}؟`)) return;
    setBookingBusy(booking.slot_id || booking.id);
    try {
      const { data, error } = await supabase
        .from('confession_bookings')
        .update({ status: 'ملغي' })
        .eq('id', booking.id)
        .select()
        .single();

      if (error) alert('تعذر إلغاء الحجز: ' + error.message);
      else if (data) {
        setMyBookings((prev) => prev.map((b) => (b.id === booking.id ? data : b)));
        logActivity({
          user: member,
          actionType: 'إلغاء_حجز_اعتراف',
          targetTable: 'confession_bookings',
          targetId: booking.id,
          description: `ألغى ${member.full_name} حجز اعتراف يوم ${booking.booking_date}`
        });
      }
    } finally {
      setBookingBusy(null);
    }
  };

  const handleJoinTrip = async (trip) => {
    const countInput = prompt(
      `اشتراك في رحلة (${trip.title}):\nاكتب عدد الأفراد المطلوب حجزهم:`,
      '1'
    );
    if (!countInput) return;
    const seatsCount = Math.max(1, Number(countInput) || 1);
    const notesInput = prompt('أي ملاحظات للرحلة (اختياري):', '') || '';

    setTripBusy(trip.id);
    try {
      const { data, error } = await supabase
        .from('trip_registrations')
        .insert([
          {
            trip_id: trip.id,
            user_id: member.id,
            user_name: member.full_name,
            user_phone: member.phone || '',
            seats_count: seatsCount,
            notes: notesInput,
            status: 'طلب اشتراك'
          }
        ])
        .select()
        .single();

      if (error) return alert('تعذر إرسال الاشتراك: ' + error.message);
      if (data) {
        setMyTripRegs((prev) => [...prev, data]);
        logActivity({
          user: member,
          actionType: 'اشتراك_رحلة',
          targetTable: 'trip_registrations',
          targetId: data.id,
          description: `اشترك ${member.full_name} في رحلة (${trip.title}) — عدد الأفراد: ${seatsCount}`
        });
        alert(`تم تسجيل اشتراكك في (${trip.title}) بنجاح ✅`);
      }
    } finally {
      setTripBusy(null);
    }
  };

  const handleCancelTripReg = async (regObj, tripTitle) => {
    if (!regObj?.id) return;
    if (!confirm(`هل تريد إلغاء اشتراكك في (${tripTitle || 'الرحلة'})؟`)) return;
    setTripBusy(regObj.trip_id);
    try {
      const { error } = await supabase
        .from('trip_registrations')
        .delete()
        .eq('id', regObj.id);

      if (error) alert('تعذر إلغاء الاشتراك: ' + error.message);
      else {
        setMyTripRegs((prev) => prev.filter((r) => r.id !== regObj.id));
        logActivity({
          user: member,
          actionType: 'إلغاء_اشتراك_رحلة',
          targetTable: 'trip_registrations',
          targetId: regObj.id,
          description: `ألغى ${member.full_name} اشتراكه في رحلة (${tripTitle || ''})`
        });
      }
    } finally {
      setTripBusy(null);
    }
  };

  const displayedSlots = useMemo(
    () =>
      confessionSlots.filter(
        (s) =>
          s.slot_date >= todayISO &&
          (filterPriestId === 'all' || s.priest_id === filterPriestId)
      ),
    [confessionSlots, todayISO, filterPriestId]
  );

  const activeBookingsCount = useMemo(
    () => myBookings.filter((b) => b.status === 'محجوز').length,
    [myBookings]
  );

  const intervalLabel =
    confessionIntervalDays === 45
      ? 'كل شهر ونصف (45 يوم)'
      : confessionIntervalDays === 60
        ? 'كل شهرين (60 يوم)'
        : `كل ${confessionIntervalDays} يوم`;

  const visibleTripsList = tripSubTab === 'general' ? generalTrips : myServiceTrips;

  const renderTripCards = (list, isGeneralSection) => {
    if (list.length === 0) {
      return (
        <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
          {isGeneralSection
            ? 'لا توجد رحلات عامة معلنة من مكتب الرحلات حالياً.'
            : 'لا توجد رحلات مضافة لخدمتك أو اجتماعك حالياً.'}
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        {list.map((tr) => {
          const myReg = myTripRegs.find((r) => r.trip_id === tr.id);
          const isOvernight =
            Number(tr.days_count || 1) > 1 || (Array.isArray(tr.rooms) && tr.rooms.length > 0);
          return (
            <div
              key={tr.id}
              className="p-4 bg-purple-50/40 border border-purple-200 rounded-2xl space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-950 rounded-lg text-[10px] font-black">
                      {isGeneralSection
                        ? '🌐 رحلات عام (مكتب الرحلات)'
                        : `🏫 رحلات خدمتي (${tr.target_service || tr.stage_name || 'خدمتي'})`}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-lg text-[10px] font-bold">
                      {tr.trip_category || 'رحلة'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                        isOvernight ? 'bg-indigo-100 text-indigo-950' : 'bg-amber-100 text-amber-950'
                      }`}
                    >
                      {isOvernight ? `🌙 ${tr.days_count} أيام` : '☀️ يوم واحد (داي يوز)'}
                    </span>
                    {Number(tr.cost_per_person) > 0 && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-lg text-[10px] font-black">
                        💰 {tr.cost_per_person} ج.م
                      </span>
                    )}
                  </div>
                  <strong className="text-sm sm:text-base text-gray-900 block">{tr.title}</strong>
                  <p className="text-gray-600">
                    📅 {tr.trip_date || 'قريباً'}
                    {tr.gathering_time && ` • تجمع: ${tr.gathering_time}`}
                    {tr.departure_time && ` • تحرك: ${tr.departure_time}`}
                    {tr.return_time && ` • عودة: ${tr.return_time}`}
                  </p>
                </div>

                {myReg ? (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="px-3.5 py-2 bg-green-100 text-green-900 rounded-xl font-black text-xs">
                      ✅ تم تسجيل اشتراكك ({myReg.seats_count} فرد)
                    </span>
                    <button
                      type="button"
                      disabled={tripBusy === tr.id}
                      onClick={() => handleCancelTripReg(myReg, tr.title)}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold text-xs cursor-pointer transition"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={tripBusy === tr.id}
                    onClick={() => handleJoinTrip(tr)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black text-xs cursor-pointer shrink-0 transition"
                  >
                    {tripBusy === tr.id ? 'جاري التسجيل...' : '✋ اشتراك في الرحلة'}
                  </button>
                )}
              </div>

              {tr.monasteries && (
                <p className="text-gray-800">
                  ⛪ <strong>الأماكن والزيارات:</strong> {tr.monasteries}
                </p>
              )}
              {tr.daily_program && (
                <div className="p-3 bg-white border border-purple-100 rounded-xl text-gray-700 whitespace-pre-line">
                  <strong className="text-[#7a1c24] block mb-1">📋 برنامج الرحلة التفصيلي:</strong>
                  {tr.daily_program}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3 text-xs" dir="rtl">
      {showMyQrModal && (
        <MemberPersonalQrModal
          member={member}
          onClose={() => setShowMyQrModal(false)}
        />
      )}

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

      <div className="bg-linear-to-l from-[#5c1319] via-[#7a1c24] to-[#91212b] text-white p-4 sm:p-5 rounded-3xl shadow-md flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div className="space-y-2">
          <h2 className="text-base sm:text-xl font-black text-amber-300">
            أهلاً بك، {member?.full_name}
          </h2>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="px-2.5 py-1 bg-white/15 rounded-xl font-bold">
              {myConfFather
                ? `✝ أب الاعتراف: ${myConfFather.full_name}`
                : 'لم يتم تحديد أب الاعتراف بعد'}
            </span>
            <span className="px-2.5 py-1 bg-amber-400/20 text-amber-200 rounded-xl font-bold">
              {myServiceCards.length > 1
                ? `📚 مشترك في ${myServiceCards.length} خدمات`
                : myServiceCards.length === 1
                  ? `🏫 خدمتك: ${myServiceCards[0].title}`
                  : 'غير مسكن في خدمة بعد'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2.5 shrink-0">
          <div className="col-span-2 sm:col-span-1 flex justify-center">
            <BellNotificationsPanel
              role="member"
              currentUser={member}
              confessionBookings={myBookings}
              masses={priestMasses}
              trips={[...myServiceTrips, ...generalTrips]}
              registeredTripIds={myTripRegs.map((r) => r.trip_id)}
              needsConfessionFather={!member?.confession_father_id}
              todayISO={todayISO}
              onNavigateCard={(cardId) => setActiveTab(cardId)}
            />
          </div>
          <div className="bg-white/15 border border-white/15 px-3.5 py-2 rounded-2xl text-center">
            <span className="text-[10px] opacity-85 font-bold block">حجوزات الاعتراف</span>
            <strong className="text-sm sm:text-base text-white font-black">
              {activeBookingsCount}
            </strong>
          </div>
          <div className="bg-white/15 border border-white/15 px-4 py-2 rounded-2xl text-center">
            <span className="text-[10px] opacity-85 font-bold block">نسبة حضورك</span>
            <strong className="text-base sm:text-lg text-amber-200 font-black">
              {myAtt.length > 0 ? `${Math.round((presentCount / myAtt.length) * 100)}%` : 'جديد'}
            </strong>
          </div>
          <button
            type="button"
            onClick={() => setShowMyQrModal(true)}
            className="px-4 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-2xl font-black flex items-center justify-center gap-1.5 cursor-pointer shadow"
          >
            <QrCode size={15} /> الـ QR Code بتاعي
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invite')}
            className="col-span-2 sm:col-span-1 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#4a0e13] rounded-2xl font-black flex items-center justify-center gap-1.5 cursor-pointer shadow"
          >
            <MailPlus size={15} /> دعوة لأبونا
          </button>
        </div>
      </div>

      {member && <ChangePasswordBox user={member} />}

      {!member?.confession_father_id && (
        <form
          onSubmit={handleChooseConfessionFather}
          className="bg-amber-50 border-2 border-amber-300 p-4 rounded-3xl space-y-2.5 shadow-sm"
        >
          <strong className="text-sm text-amber-950 flex items-center gap-1.5">
            <UserCheck size={17} className="text-[#7a1c24]" /> تحديد أب الاعتراف لأول مرة:
          </strong>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <select
              required
              className="w-full sm:max-w-md p-2.5 border border-amber-300 rounded-xl bg-white font-bold outline-none focus:border-[#7a1c24]"
              value={selectedPriestId}
              onChange={(e) => setSelectedPriestId(e.target.value)}
            >
              <option value="">-- اختر الأب الكاهن --</option>
              {priests.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={savingFather}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer transition"
            >
              {savingFather ? 'جاري الحفظ...' : 'تأكيد أب الاعتراف'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white p-2 rounded-2xl border shadow-2xs flex items-center gap-1.5 overflow-x-auto font-black">
        <button
          type="button"
          onClick={() => setActiveTab('services')}
          className={`px-3.5 py-2 rounded-xl shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'services'
              ? 'bg-[#7a1c24] text-white'
              : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
          }`}
        >
          <BookOpen size={14} /> خدماتي ({myServiceCards.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('my_invites')}
          className={`px-3.5 py-2 rounded-xl shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'my_invites'
              ? 'bg-[#7a1c24] text-white'
              : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
          }`}
        >
          <QrCode size={14} /> دعواتي QR
          {receivedInvitesCount > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-400 text-[#4a0e13] rounded-full text-[10px] font-black">
              {receivedInvitesCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('confessions')}
          className={`px-3.5 py-2 rounded-xl shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'confessions'
              ? 'bg-[#7a1c24] text-white'
              : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
          }`}
        >
          <Clock size={14} /> مواعيد الاعتراف ({displayedSlots.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('masses')}
          className={`px-3.5 py-2 rounded-xl shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'masses'
              ? 'bg-[#7a1c24] text-white'
              : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
          }`}
        >
          <Calendar size={14} /> القداسات والصلوات
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('trips')}
          className={`px-3.5 py-2 rounded-xl shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'trips'
              ? 'bg-[#7a1c24] text-white'
              : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
          }`}
        >
          <Bus size={14} /> الرحلات ({myServiceTrips.length + generalTrips.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('invite')}
          className={`px-3.5 py-2 rounded-xl shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'invite'
              ? 'bg-[#7a1c24] text-white'
              : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200'
          }`}
        >
          <MailPlus size={14} /> دعوة لأبونا لمناسبة
        </button>
      </div>

      <div className="max-h-[calc(100vh-260px)] overflow-y-auto pr-1 space-y-3">
        {activeTab === 'my_invites' && (
          <ReceivedInvitationsSection
            currentUser={member}
            onCountChange={setReceivedInvitesCount}
          />
        )}

        {activeTab === 'services' && (
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5">
                <BookOpen size={17} />
                {myServiceCards.length > 1
                  ? `الخدمات المشترك بها (${myServiceCards.length} كروت)`
                  : 'خدمتك الخاصة وخدامك'}
              </h3>
              <span className="px-2.5 py-1 rounded-xl bg-[#fbfaf7] border border-gray-200 text-[11px] font-bold text-gray-700 flex items-center gap-1">
                <Layers size={13} className="text-[#7a1c24]" />
                {myServiceCards.length > 1 ? 'كارت مستقل لكل خدمة' : 'تظهر خدمتك فقط'}
              </span>
            </div>

            {myServiceCards.length === 0 ? (
              <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
                لم يتم تسكينك في فصل أو خدمة بعد. راجع خادمك أو أدمن الكنيسة.
              </div>
            ) : (
              <div
                className={`grid gap-3.5 ${
                  myServiceCards.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {myServiceCards.map((card) => (
                  <div
                    key={card.id}
                    className="p-4 bg-[#fbfaf7] border-2 border-amber-200/80 rounded-3xl space-y-3 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-amber-200/60 pb-2.5">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-900 font-bold text-[10px]">
                            {card.stageLabel}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-950 font-black text-[10px]">
                            {card.kindLabel}
                          </span>
                        </div>
                        <strong className="text-base text-[#7a1c24] block">{card.title}</strong>
                      </div>
                      <span className="text-2xl">🏫</span>
                    </div>

                    <div className="space-y-1 text-gray-700 font-bold">
                      {card.meetingTime && <p>⏰ الميعاد: {card.meetingTime}</p>}
                      {card.roomName && <p>📍 القاعة / المكان: {card.roomName}</p>}
                      {card.headServant && <p>⭐ أمين الخدمة / الفصل: {card.headServant}</p>}
                    </div>

                    <div className="pt-2 border-t border-gray-200 space-y-2">
                      <span className="text-[11px] font-black text-gray-700 block">
                        👥 خدام هذه الخدمة ({card.servants.length}):
                      </span>
                      {card.servants.length === 0 ? (
                        <p className="text-[11px] text-gray-400">
                          لا يوجد خدام مسجلون لهذه الخدمة حالياً.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {card.servants.map((s) => (
                            <div
                              key={s.id}
                              className="p-2.5 bg-white border border-gray-200 rounded-2xl flex flex-wrap justify-between items-center gap-2"
                            >
                              <div>
                                <strong className="block text-gray-900 text-xs">{s.full_name}</strong>
                                {s.phone && (
                                  <span className="text-[11px] text-gray-500">📞 {s.phone}</span>
                                )}
                              </div>
                              {s.phone && (
                                <div className="flex gap-1.5 shrink-0">
                                  <a
                                    href={`https://wa.me/2${String(s.phone).replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center gap-1 text-[11px]"
                                  >
                                    <MessageCircle size={12} /> واتس
                                  </a>
                                  <a
                                    href={`tel:${s.phone}`}
                                    className="px-2.5 py-1.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-bold flex items-center gap-1 text-[11px]"
                                  >
                                    <Phone size={12} /> اتصال
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'confessions' && (
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-amber-950 font-bold">
              <span>
                🙏 نظام الاعتراف بالكنيسة لكل الشعب: <strong>{intervalLabel}</strong>
              </span>
              <span className="text-[11px] text-[#7a1c24]">
                يرجى الحفاظ على ميعاد الاعتراف بانتظام
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2.5 border-b border-gray-100 pb-3">
              <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5">
                <Clock size={17} /> مواعيد الاعتراف للآباء الكهنة
              </h3>
              <select
                className="w-full sm:w-64 p-2.5 border border-gray-200 rounded-xl bg-[#fbfaf7] font-bold text-xs outline-none focus:border-[#7a1c24]"
                value={filterPriestId}
                onChange={(e) => setFilterPriestId(e.target.value)}
              >
                <option value="all">كل آباء الكنيسة</option>
                {priests.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>

            {displayedSlots.length === 0 ? (
              <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
                لا توجد مواعيد اعتراف قادمة منشورة حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {displayedSlots.map((s) => {
                  const slotPriest = priests.find((p) => p.id === s.priest_id);
                  const activeBooking = myBookings.find(
                    (b) => b.slot_id === s.id && b.status === 'محجوز'
                  );

                  return (
                    <div
                      key={s.id}
                      className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                        s.is_cancelled
                          ? 'bg-red-50/70 border-red-200'
                          : 'bg-[#fbfaf7] border-gray-200'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-start gap-2">
                          <strong className="text-sm text-gray-900">
                            {s.confession_title} ({s.period})
                          </strong>
                          <span
                            className={`px-2.5 py-1 rounded-full font-bold text-[10px] flex items-center gap-1 shrink-0 ${
                              s.is_cancelled
                                ? 'bg-red-600 text-white'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {s.is_cancelled ? (
                              <>
                                <AlertCircle size={12} /> معتذر
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={12} /> متاح
                              </>
                            )}
                          </span>
                        </div>

                        {slotPriest && (
                          <span className="text-[#7a1c24] font-black block">
                            ✝ {slotPriest.full_name}
                          </span>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-600">
                          <span>📅 {s.slot_date}</span>
                          <span>
                            ⏰ {s.start_time} - {s.end_time}
                          </span>
                        </div>
                        {s.location && (
                          <span className="text-gray-500 flex items-center gap-1">
                            <MapPin size={12} className="text-[#7a1c24]" /> {s.location}
                          </span>
                        )}
                        {s.is_cancelled && (
                          <p className="text-red-700 font-bold pt-1">
                            ⚠️ اعتذر أبونا: {s.cancel_reason}
                          </p>
                        )}
                      </div>

                      {!s.is_cancelled && (
                        <div className="pt-2 border-t border-gray-200/70">
                          {activeBooking ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 py-2 bg-blue-100 text-blue-900 rounded-xl font-black text-center">
                                محجوز ✅
                              </div>
                              <button
                                type="button"
                                disabled={bookingBusy === s.id}
                                onClick={() => handleCancelBooking(activeBooking)}
                                className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition"
                              >
                                <XCircle size={14} /> إلغاء
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={bookingBusy === s.id}
                              onClick={() => handleBookSlot(s)}
                              className="w-full py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer transition"
                            >
                              {bookingBusy === s.id ? 'جاري الحجز...' : 'حجز ميعاد'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'masses' && (
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
            <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5 border-b border-gray-100 pb-3">
              <Calendar size={17} /> مواعيد القداسات الإلهية والصلوات
            </h3>
            {priestMasses.filter((m) => m.is_available).length === 0 &&
            onlyMassEvents.length === 0 ? (
              <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
                لا توجد مواعيد قداسات أو صلوات منشورة حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {priestMasses
                  .filter((m) => m.is_available)
                  .map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-900 font-bold text-[10px]">
                            {m.target_audience}
                          </span>
                          <strong className="text-sm text-gray-900">{m.mass_name}</strong>
                        </div>
                        <p className="text-gray-500 flex items-center gap-1">
                          <MapPin size={12} className="text-[#7a1c24]" /> {m.church_name}
                        </p>
                      </div>
                      <span className="self-start sm:self-center px-3 py-1 bg-red-50 text-[#7a1c24] rounded-xl font-black text-[11px] shrink-0">
                        {m.mass_date} ({m.mass_time})
                      </span>
                    </div>
                  ))}
                {onlyMassEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-bold text-[10px]">
                          {ev.event_type}
                        </span>
                        <strong className="text-sm text-gray-900">{ev.title}</strong>
                      </div>
                      <p className="text-gray-500 flex items-center gap-1">
                        <MapPin size={12} className="text-[#7a1c24]" /> {ev.place}
                      </p>
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

        {activeTab === 'trips' && (
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5">
                <Bus size={17} /> الرحلات المتاحة لك
              </h3>
              <div className="flex items-center gap-1.5 bg-[#fbfaf7] p-1 rounded-2xl border">
                <button
                  type="button"
                  onClick={() => setTripSubTab('my_service')}
                  className={`px-3.5 py-1.5 rounded-xl font-black text-xs cursor-pointer transition ${
                    tripSubTab === 'my_service'
                      ? 'bg-[#7a1c24] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  رحلات خدمتي ({myServiceTrips.length})
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
                  رحلات عام ({generalTrips.length})
                </button>
              </div>
            </div>

            {renderTripCards(visibleTripsList, tripSubTab === 'general')}
          </div>
        )}

        {activeTab === 'invite' && (
          <PriestInvitationModal
            inline={true}
            currentUser={member}
            priests={priests}
            defaultRoleLabel="مخدوم"
          />
        )}
      </div>
    </div>
  );
}
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Bell,
  Volume2,
  VolumeX,
  X,
  Check,
  CheckCheck,
  Eye,
  RotateCcw,
  RefreshCw,
  Clock,
  Sparkles
} from 'lucide-react';

export function playTingTingChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const playTone = (freq, startOffset, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + duration);
    };
    playTone(880, 0, 0.22);
    playTone(1174.66, 0.24, 0.35);
    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // تجاهل
      }
    }, 1000);
  } catch {
    // تجاهل إذا منع المتصفح الصوت
  }
}

function formatDateTimeAr(val) {
  if (!val) return 'الآن';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString('ar-EG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function BellNotificationsPanel({
  role = 'priest', // 'priest' | 'servant' | 'member' | 'parent'
  readerId = null, // معرّف المستخدم لتسجيل (اتقرت) في الداتابيز
  senderName = '',
  canSend = false, // يظهر زر إرسال تنبيه لباقي الأدوار
  onAckNote = null, // لما يتعلّم تنبيه ملاحظة كمقروء يتم حفظه في الداتابيز عن طريق الصفحة
  priestId = null,
  currentUser = null,
  trips = [],
  registeredTripIds = [],
  linkRequests = [],
  noteItems = [],
  birthdayItems = [],
  followUpItems = [],
  needsConfessionFather = false,
  personalItems = [],
  masses = [],
  confessionBookings = [],
  myConfessors = [],
  allUsers = [],
  todayISO,
  onOpenConfessor,
  onOpenWhatsApp,
  onNavigateCard
}) {
  const isPriest = role === 'priest';
  const effectiveActorId = priestId || currentUser?.id || null;
  const storageScope = isPriest
    ? effectiveActorId ||
      myConfessors?.[0]?.confession_father_id ||
      personalItems?.[0]?.priest_id ||
      masses?.[0]?.priest_id ||
      'default'
    : effectiveActorId || 'default';

  // مفاتيح الكاهن كما هي بالظبط حتى لا ترجع تنبيهات اتقرت قبل كده
  const keyPrefix = isPriest ? 'priest' : role;
  const READ_STORAGE_KEY = `${keyPrefix}_read_alerts_${storageScope}`;
  const SOUND_STORAGE_KEY = `${keyPrefix}_bell_sound_${storageScope}`;
  const actorPhones = [currentUser?.phone, currentUser?.father_phone, currentUser?.mother_phone]
    .map((p) => String(p || '').trim())
    .filter(Boolean);
  const actorPhonesKey = actorPhones.join('|');
  const dbReaderId = readerId || effectiveActorId || null;

  const [open, setOpen] = useState(false);
  const [showReadAlerts, setShowReadAlerts] = useState(false);
  const [liveBookings, setLiveBookings] = useState([]);
  const [liveInvitations, setLiveInvitations] = useState([]);
  const [liveAttendanceLogs, setLiveAttendanceLogs] = useState([]);
  const [specialAlertsFromDb, setSpecialAlertsFromDb] = useState([]);
  const [refreshingLive, setRefreshingLive] = useState(false);
  const [dbReadIds, setDbReadIds] = useState([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [composeMsg, setComposeMsg] = useState('');
  const [composeForm, setComposeForm] = useState({ title: '', message: '', target: '', urgent: false });

  const [readIds, setReadIds] = useState(() => {
    try {
      const raw = localStorage.getItem(READ_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(SOUND_STORAGE_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const playedOnceRef = useRef(false);
  const prevUnreadCountRef = useRef(0);

  const fetchLiveDatabaseNotifications = useCallback(async () => {
    if (!supabase || typeof supabase.from !== 'function') return;

    // الإشعارات اللي قراها المستخدم ده (محفوظة في الداتابيز ومتزامنة بين الأجهزة)
    if (dbReaderId) {
      try {
        const { data: rd, error: rdErr } = await supabase
          .from('church_notification_reads')
          .select('notification_id')
          .eq('user_id', String(dbReaderId));
        if (!rdErr && Array.isArray(rd)) setDbReadIds(rd.map((r) => String(r.notification_id)));
      } catch {
        // تجاهل
      }
    }

    // ===== غير الكاهن: كل واحد يشوف بياناته هو بس =====
    if (!isPriest) {
      const actorId = currentUser?.id;
      if (!actorId) return;
      setRefreshingLive(true);
      const safe = async (builder) => {
        try {
          const res = await builder;
          return !res.error && Array.isArray(res.data) ? res.data : [];
        } catch {
          return [];
        }
      };
      try {
        const phones = actorPhonesKey ? actorPhonesKey.split('|') : [];
        const [invById, invByPhone, spById, spByRole, bks] = await Promise.all([
          safe(
            supabase
              .from('church_invitations')
              .select('*')
              .eq('recipient_user_id', actorId)
              .order('created_at', { ascending: false })
              .limit(20)
          ),
          phones.length > 0
            ? safe(
                supabase
                  .from('church_invitations')
                  .select('*')
                  .in('recipient_phone', phones)
                  .order('created_at', { ascending: false })
                  .limit(20)
              )
            : Promise.resolve([]),
          safe(
            supabase
              .from('church_notifications')
              .select('*')
              .eq('target_user_id', actorId)
              .order('created_at', { ascending: false })
              .limit(20)
          ),
          safe(
            supabase
              .from('church_notifications')
              .select('*')
              .in('target_role', [role, 'all'])
              .order('created_at', { ascending: false })
              .limit(20)
          ),
          role === 'member'
            ? safe(
                supabase
                  .from('confession_bookings')
                  .select('*')
                  .eq('member_id', actorId)
                  .order('created_at', { ascending: false })
                  .limit(20)
              )
            : Promise.resolve([])
        ]);

        const mergeById = (...lists) => {
          const map = new Map();
          lists.flat().forEach((r) => {
            if (r?.id != null && !map.has(r.id)) map.set(r.id, r);
          });
          return Array.from(map.values());
        };

        setLiveInvitations(mergeById(invById, invByPhone));
        setSpecialAlertsFromDb(
          mergeById(spById, spByRole).filter((r) => r.type !== 'hidden_family_edit_request')
        );
        setLiveBookings(bks);
        setLiveAttendanceLogs([]);
      } finally {
        setRefreshingLive(false);
      }
      return;
    }

    setRefreshingLive(true);
    try {
      const [bkRes, invRes, attRes, spRes] = await Promise.all([
        supabase
          .from('confession_bookings')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('church_invitations')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('church_attendance_logs')
          .select('*')
          .order('checked_in_at', { ascending: false })
          .limit(20),
        supabase
          .from('church_notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      if (!bkRes.error && Array.isArray(bkRes.data)) {
        // حجوزات اعتراف الكاهن ده بس (مش حجوزات باقي الآباء)
        setLiveBookings(
          dbReaderId
            ? bkRes.data.filter((b) => String(b.priest_id) === String(dbReaderId))
            : bkRes.data
        );
      }
      if (!invRes.error && Array.isArray(invRes.data)) {
        // دعوات الكاهن ده بس: اللي هو أرسلها، أو اتسجل دخولها بواسطته، أو وصلته هو
        const me = dbReaderId ? String(dbReaderId) : '';
        const myName = String(senderName || currentUser?.full_name || '').trim();
        setLiveInvitations(
          me
            ? invRes.data.filter(
                (inv) =>
                  String(inv.created_by || '') === me ||
                  (myName && String(inv.created_by || '').trim() === myName) ||
                  String(inv.checked_in_by_id || '') === me ||
                  String(inv.recipient_user_id || '') === me
              )
            : invRes.data
        );
      }
      if (!attRes.error && Array.isArray(attRes.data)) {
        setLiveAttendanceLogs(attRes.data);
      }
      if (!spRes.error && Array.isArray(spRes.data)) {
        setSpecialAlertsFromDb(spRes.data);
      }
    } catch {
      // تجاهل أي خطأ شبكة مؤقت
    } finally {
      setRefreshingLive(false);
    }
  }, [isPriest, role, currentUser?.id, actorPhonesKey, dbReaderId]);

  useEffect(() => {
    fetchLiveDatabaseNotifications();
  }, [fetchLiveDatabaseNotifications]);

  useEffect(() => {
    if (!supabase || typeof supabase.channel !== 'function') return;

    // الكاهن: نفس القنوات القديمة. غيره: دعوات + إشعارات (+ حجوزات اعتراف للمخدوم)
    let builder = supabase.channel(`bell-live-sync-${role}-${storageScope}`);
    const watchTables = isPriest
      ? ['confession_bookings', 'church_invitations', 'church_attendance_logs', 'church_notifications', 'church_notification_reads']
      : role === 'member'
        ? ['confession_bookings', 'church_invitations', 'church_notifications', 'church_notification_reads']
        : ['church_invitations', 'church_notifications', 'church_notification_reads'];
    watchTables.forEach((table) => {
      builder = builder.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => fetchLiveDatabaseNotifications()
      );
    });
    const channel = builder.subscribe();

    return () => {
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel);
      }
    };
  }, [storageScope, role, isPriest, fetchLiveDatabaseNotifications]);

  useEffect(() => {
    const syncRead = () => {
      try {
        const raw = localStorage.getItem(READ_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) setReadIds(parsed);
      } catch {
        // ignore
      }
    };
    syncRead();
    window.addEventListener('priest_alerts_updated', syncRead);
    return () => window.removeEventListener('priest_alerts_updated', syncRead);
  }, [READ_STORAGE_KEY]);

  const persistReadIds = (nextList) => {
    const unique = Array.from(new Set(nextList));
    setReadIds(unique);
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(unique));
      window.dispatchEvent(new Event('priest_alerts_updated'));
    } catch {
      // ignore
    }
  };

  const DB_PREFIX = 'special_db_';
  const isDbAlertId = (id) => String(id || '').startsWith(DB_PREFIX);
  const isAlertRead = (id) =>
    readIds.includes(id) || (isDbAlertId(id) && dbReadIds.includes(String(id).slice(DB_PREFIX.length)));

  const setDbRead = async (alertId, read) => {
    const nid = String(alertId).slice(DB_PREFIX.length);
    setDbReadIds((prev) => (read ? Array.from(new Set([...prev, nid])) : prev.filter((x) => x !== nid)));
    try {
      if (read) {
        await supabase.from('church_notification_reads').upsert(
          {
            notification_id: nid,
            user_id: String(dbReaderId),
            reader_name: senderName || currentUser?.full_name || '',
            reader_role: role,
            read_at: new Date().toISOString()
          },
          { onConflict: 'notification_id,user_id' }
        );
      } else {
        await supabase
          .from('church_notification_reads')
          .delete()
          .eq('notification_id', nid)
          .eq('user_id', String(dbReaderId));
      }
    } catch {
      // تجاهل: الحالة المحلية اتحدثت
    }
  };

  const markAsRead = (alertId, alertObj) => {
    if (!alertId || isAlertRead(alertId)) return;
    if (alertObj?.onRead) alertObj.onRead();
    if (isDbAlertId(alertId) && dbReaderId) {
      setDbRead(alertId, true);
      return;
    }
    persistReadIds([...readIds, alertId]);
  };

  const restoreAlert = (alertId) => {
    if (isDbAlertId(alertId) && dbReaderId) {
      setDbRead(alertId, false);
      return;
    }
    persistReadIds(readIds.filter((id) => id !== alertId));
  };

  const baseToday = todayISO || new Date().toISOString().split('T')[0];
  const tomorrowDate = new Date(`${baseToday}T00:00:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowISO = tomorrowDate.toISOString().split('T')[0];

  const weekLimitDate = new Date(`${baseToday}T00:00:00`);
  weekLimitDate.setDate(weekLimitDate.getDate() + 7);
  const weekLimitISO = weekLimitDate.toISOString().split('T')[0];

  const daysUntilBirthday = (dobStr) => {
    if (!dobStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [, m, d] = dobStr.split('-').map(Number);
    if (!m || !d) return null;
    let next = new Date(today.getFullYear(), m - 1, d);
    if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
    const diff = Math.round((next - today) / 86400000);
    return diff >= 0 && diff <= 7 ? diff : null;
  };

  const alerts = [];
  const seenAlertKeys = new Set();

  const pushAlert = (al) => {
    if (!al?.id || seenAlertKeys.has(al.id)) return;
    seenAlertKeys.add(al.id);
    alerts.push(al);
  };

  // 1. مناسبات الجدول الخاص (الكاهن فقط)
  (isPriest ? personalItems : []).forEach((p) => {
    if (!p.event_date) return;
    if (p.event_date === baseToday) {
      pushAlert({
        id: `pers_today_${p.id}_${baseToday}`,
        urgency: 'urgent',
        badge: 'اليوم 🔴',
        icon: '📅',
        title: `اليوم: ${p.event_type || 'مناسبة'} — ${p.title || ''}`,
        sub: `${p.event_time ? `⏰ الساعة ${p.event_time}` : ''} ${p.location ? `• 📍 ${p.location}` : ''}`,
        action: () => {
          setOpen(false);
          onNavigateCard?.('personal');
        }
      });
    } else if (p.event_date === tomorrowISO) {
      pushAlert({
        id: `pers_tmr_${p.id}_${baseToday}`,
        urgency: 'urgent',
        badge: 'بكرة (قبلها بيوم) 🔔',
        icon: '👑',
        title: `تذكير: عندك بكرة ${p.event_type || 'مناسبة'} — ${p.title || ''}`,
        sub: `📅 ${p.event_date} ${p.event_time ? `• ⏰ الساعة ${p.event_time}` : ''} ${p.location ? `• 📍 ${p.location}` : ''}`,
        action: () => {
          setOpen(false);
          onNavigateCard?.('personal');
        }
      });
    } else if (p.event_date > tomorrowISO && p.event_date <= weekLimitISO) {
      pushAlert({
        id: `pers_wk_${p.id}_${p.event_date}`,
        urgency: 'week',
        badge: 'هذا الأسبوع 📆',
        icon: '📅',
        title: `${p.event_type || 'مناسبة'}: ${p.title || ''}`,
        sub: `📅 ${p.event_date} ${p.event_time ? `• ⏰ الساعة ${p.event_time}` : ''}`,
        action: () => {
          setOpen(false);
          onNavigateCard?.('personal');
        }
      });
    }
  });

  // 2. جدول القداسات (الكاهن: كل قداساته — المخدوم: القداسات المتاحة)
  let nonPriestMassCount = 0;
  masses.forEach((m) => {
    if (!m.mass_date || m.is_available === false) return;
    if (!isPriest) {
      if (m.mass_date < baseToday || m.mass_date > weekLimitISO) return;
      if (role !== 'member') return;
      if (nonPriestMassCount >= 5) return;
      nonPriestMassCount += 1;
    }
    if (m.mass_date === baseToday) {
      pushAlert({
        id: `mass_today_${m.id}_${baseToday}`,
        urgency: 'urgent',
        badge: 'قداس اليوم ⛪',
        icon: '⛪',
        title: `اليوم قداس: ${m.mass_name} (${m.church_name})`,
        sub: `⏰ ${m.mass_time || ''} ${m.priest_role ? `• ${m.priest_role}` : ''}`,
        action: () => {
          setOpen(false);
          onNavigateCard?.('masses');
        }
      });
    } else if (m.mass_date === tomorrowISO) {
      pushAlert({
        id: `mass_tmr_${m.id}_${baseToday}`,
        urgency: 'urgent',
        badge: 'قداس بكرة 🔔',
        icon: '⛪',
        title: `تذكير: قداس بكرة (${m.mass_name})`,
        sub: `📅 ${m.mass_date} • ⏰ ${m.mass_time || ''} • 📍 ${m.church_name || ''}`,
        action: () => {
          setOpen(false);
          onNavigateCard?.('masses');
        }
      });
    } else if (m.mass_date > tomorrowISO && m.mass_date <= weekLimitISO) {
      pushAlert({
        id: `mass_wk_${m.id}_${m.mass_date}`,
        urgency: 'week',
        badge: 'قداس الأسبوع 📆',
        icon: '⛪',
        title: `لديك قداس يوم ${m.mass_date}: ${m.mass_name}`,
        sub: `⏰ ${m.mass_time || ''} • 📍 ${m.church_name || ''} ${m.priest_role ? `(${m.priest_role})` : ''}`,
        action: () => {
          setOpen(false);
          onNavigateCard?.('masses');
        }
      });
    }
  });

  // 3. حجوزات المعترفين (من الـ props + التحديثات اللحظية)
  const combinedBookings = [
    ...confessionBookings,
    ...liveBookings.filter((lb) => !confessionBookings.some((cb) => cb.id === lb.id))
  ];

  combinedBookings
    .filter(
      (b) =>
        (isPriest || (role === 'member' && String(b.member_id) === String(effectiveActorId))) &&
        b.status === 'محجوز' &&
        b.booking_date >= baseToday &&
        b.booking_date <= weekLimitISO
    )
    .forEach((b) => {
      const memberObj = allUsers.find((u) => u.id === b.member_id);
      const isUrgent = b.booking_date === baseToday || b.booking_date === tomorrowISO;
      pushAlert({
        id: `book_${b.id}_${b.booking_date}`,
        urgency: isUrgent ? 'urgent' : 'week',
        badge:
          b.booking_date === baseToday
            ? 'حجز اعتراف اليوم 🙏'
            : b.booking_date === tomorrowISO
              ? 'حجز اعتراف بكرة 🔔'
              : 'حجز اعتراف قادم',
        icon: '🙏',
        title: isPriest
          ? `${b.member_name || memberObj?.full_name || 'معترف'} حاجز اعتراف ${
              b.booking_date === baseToday ? 'اليوم' : b.booking_date === tomorrowISO ? 'بكرة' : `يوم ${b.booking_date}`
            }`
          : `ميعاد اعترافك ${
              b.booking_date === baseToday ? 'اليوم' : b.booking_date === tomorrowISO ? 'بكرة' : `يوم ${b.booking_date}`
            }`,
        sub: isPriest
          ? `${b.booking_time ? `⏰ ${b.booking_time} • ` : ''}اضغط لفتح الملف الروحي والقانون السابق`
          : `${b.booking_time ? `⏰ ${b.booking_time} • ` : ''}لا تنس ميعادك مع أبونا`,
        action: () => {
          setOpen(false);
          if (isPriest && memberObj && onOpenConfessor) onOpenConfessor(memberObj);
          else onNavigateCard?.('confessions');
        }
      });
    });

  // 4. أعياد الميلاد
  const currentYear = new Date().getFullYear();
  (isPriest ? myConfessors : []).forEach((m) => {
    const d = daysUntilBirthday(m.dob);
    if (d === null) return;
    pushAlert({
      id: `bday_${m.id}_${currentYear}`,
      urgency: d === 0 ? 'urgent' : 'week',
      badge: d === 0 ? 'عيد ميلاد اليوم 🎂' : `عيد ميلاد خلال ${d} يوم 🎂`,
      icon: '🎂',
      title: `عيد ميلاد: ${m.full_name}`,
      sub: `📅 ${m.dob} • اضغط لفتح تهنئة واتساب`,
      action: () => {
        setOpen(false);
        onOpenWhatsApp?.({
          name: m.full_name,
          phone: m.phone || '',
          targetId: m.id,
          defaultCategory: 'معايدة'
        });
      }
    });
  });

  // 5. تنبيهات خاصة من قاعدة البيانات (church_notifications) ببياناتها الكاملة
  specialAlertsFromDb.forEach((sp) => {
    const targetMatches =
      !sp.target_user_id ||
      !effectiveActorId ||
      String(sp.target_user_id) === String(effectiveActorId);
    const roleMatches = !sp.target_role || sp.target_role === 'all' || sp.target_role === role;
    if (!targetMatches || !roleMatches) return;

    pushAlert({
      id: `special_db_${sp.id}`,
      urgency: sp.is_urgent ? 'urgent' : 'special',
      badge: sp.category || 'تنبيه خاص ✨',
      icon: '✨',
      title: sp.title || 'تنبيه خاص',
      sub: [
        sp.message || sp.body || sp.description || '',
        sp.created_by_name ? `✍️ ${sp.created_by_name}` : '',
        sp.created_at ? `🕒 ${formatDateTimeAr(sp.created_at)}` : ''
      ]
        .filter(Boolean)
        .join(' • '),
      action: () => {
        setOpen(false);
        if (sp.target_card) onNavigateCard?.(sp.target_card);
      }
    });
  });

  // 6. مستجدات الدعوات وحضور وانصراف QR اللحظية مع تفاصيلها الكاملة
  liveInvitations.slice(0, 6).forEach((inv) => {
    const isChecked = inv.status === 'checked_in';
    pushAlert({
      id: `inv_live_${inv.id}_${inv.status}`,
      urgency: isChecked ? 'special' : isPriest ? 'week' : 'urgent',
      badge: isChecked
        ? 'تم Scan دعوة ✅'
        : isPriest
          ? 'دعوة جديدة 🎟️'
          : `وصلتك دعوة ${inv.invite_tier === 'vip' ? 'VIP' : ''} 🎟️`,
      icon: '🎟️',
      title: isPriest
        ? `${inv.event_title || 'دعوة'} — ${inv.recipient_name || ''}`
        : `${inv.event_title || 'دعوة'}`,
      sub: [
        inv.seat_or_zone ? `📍 ${inv.seat_or_zone}` : '',
        inv.checked_in_by ? `بواسطة: ${inv.checked_in_by}` : '',
        `🕒 ${formatDateTimeAr(inv.checked_in_at || inv.created_at)}`
      ]
        .filter(Boolean)
        .join(' • '),
      action: () => {
        setOpen(false);
        onNavigateCard?.(isPriest ? 'invitations' : 'my_invites');
      }
    });
  });

  liveAttendanceLogs.slice(0, 6).forEach((log) => {
    const isOut = Boolean(log.checked_out_at);
    pushAlert({
      id: `att_live_${log.id}_${isOut ? 'out' : 'in'}`,
      urgency: 'special',
      badge: isOut ? 'انصراف QR 👋' : 'حضور QR ✅',
      icon: isOut ? '👋' : '✅',
      title: `${log.full_name} — ${isOut ? 'تسجيل انصراف' : 'تسجيل حضور'}`,
      sub: [
        `🕒 ${formatDateTimeAr(isOut ? log.checked_out_at : log.checked_in_at)}`,
        isOut
          ? log.checked_out_by
            ? `بواسطة: ${log.checked_out_by}`
            : ''
          : log.checked_in_by
            ? `بواسطة: ${log.checked_in_by}`
            : ''
      ]
        .filter(Boolean)
        .join(' • '),
      action: () => {
        setOpen(false);
        onNavigateCard?.('attendance');
      }
    });
  });

  // ===== تنبيهات خاصة بكل دور (غير الكاهن) =====
  const inWindow = (dateStr) => {
    const d = String(dateStr || '').slice(0, 10);
    return d >= baseToday && d <= weekLimitISO ? d : null;
  };
  const dayBadge = (d) => (d === baseToday ? 'اليوم 🔴' : d === tomorrowISO ? 'بكرة 🔔' : 'هذا الأسبوع 📆');
  const dayUrgency = (d) => (d === baseToday || d === tomorrowISO ? 'urgent' : 'week');

  if (!isPriest) {
    // رحلات قريبة (للجميع)
    trips.slice(0, 50).forEach((tr) => {
      const d = inWindow(tr.trip_date);
      if (!d) return;
      const registered = registeredTripIds.map(String).includes(String(tr.id));
      pushAlert({
        id: `trip_${tr.id}_${d}_${registered ? 'reg' : 'open'}`,
        urgency: registered ? dayUrgency(d) : 'week',
        badge: registered ? `رحلتك — ${dayBadge(d)}` : 'رحلة متاحة 🚌',
        icon: '🚌',
        title: registered ? `رحلتك قريبة: ${tr.title || 'رحلة'}` : `رحلة متاحة للاشتراك: ${tr.title || 'رحلة'}`,
        sub: `📅 ${d}${tr.departure_time ? ` • ⏰ ${tr.departure_time}` : ''}${tr.destination ? ` • 📍 ${tr.destination}` : ''}`,
        action: () => {
          setOpen(false);
          onNavigateCard?.('trips');
        }
      });
    });

    // المخدوم: لم يختر أب اعتراف
    if (role === 'member' && needsConfessionFather) {
      pushAlert({
        id: `member_no_father_${effectiveActorId || 'x'}`,
        urgency: 'urgent',
        badge: 'مطلوب منك 🙏',
        icon: '✝',
        title: 'اختر أب الاعتراف الخاص بك',
        sub: 'لازم تحدد الأب الكاهن أول مرة عشان تقدر تحجز ميعاد اعتراف.',
        action: () => {
          setOpen(false);
          onNavigateCard?.('confessions');
        }
      });
    }

    // الخادم: مخدومين محتاجين افتقاد
    if (role === 'servant') {
      followUpItems.slice(0, 5).forEach((m) => {
        pushAlert({
          id: `fu_${m.id}_${baseToday}`,
          urgency: 'special',
          badge: 'يحتاج افتقاد ⚠️',
          icon: '⚠️',
          title: `${m.full_name || 'مخدوم'} محتاج افتقاد`,
          sub: [m.phone ? `📞 ${m.phone}` : '', m.assigned_class ? `فصل: ${m.assigned_class}` : '']
            .filter(Boolean)
            .join(' • '),
          action: () => {
            setOpen(false);
            onNavigateCard?.('followup');
          }
        });
      });
      if (followUpItems.length > 5) {
        pushAlert({
          id: `fu_more_${followUpItems.length}_${baseToday}`,
          urgency: 'special',
          badge: 'افتقاد ⚠️',
          icon: '⚠️',
          title: `و ${followUpItems.length - 5} مخدوم آخرين محتاجين افتقاد`,
          sub: 'افتح تبويب الافتقاد والغياب لمراجعة الكل.',
          action: () => {
            setOpen(false);
            onNavigateCard?.('followup');
          }
        });
      }
    }

    // أعياد ميلاد (الخادم: مخدوميه — ولي الأمر: أبناؤه)
    if (role === 'servant' || role === 'parent') {
      birthdayItems.forEach((m) => {
        const d = daysUntilBirthday(m.dob);
        if (d === null) return;
        pushAlert({
          id: `bday_${m.id}_${currentYear}`,
          urgency: d === 0 ? 'urgent' : 'week',
          badge: d === 0 ? 'عيد ميلاد اليوم 🎂' : `عيد ميلاد خلال ${d} يوم 🎂`,
          icon: '🎂',
          title: `عيد ميلاد: ${m.full_name}`,
          sub: `📅 ${m.dob}`,
          action: () => {
            setOpen(false);
            onNavigateCard?.(role === 'servant' ? 'birthdays' : 'children');
          }
        });
      });
    }

    // ولي الأمر: طلبات ربط + ملاحظات جديدة على الأبناء
    if (role === 'parent') {
      linkRequests.forEach((req) => {
        const childObj = allUsers.find((u) => u.id === req.child_id);
        pushAlert({
          id: `link_${req.id}`,
          urgency: 'urgent',
          badge: 'طلب ربط ابن 🔗',
          icon: '🔗',
          title: `${childObj?.full_name || req.child_name || 'حساب ابن'} ينتظر موافقتك على الربط`,
          sub: 'اضغط لمراجعة الطلب وقبوله أو رفضه.',
          action: () => {
            setOpen(false);
            onNavigateCard?.('linking');
          }
        });
      });

    }

    // ملاحظات الكاهن: الخادم عن مخدوميه — ولي الأمر عن أبنائه
    if (role === 'servant' || role === 'parent') {
      noteItems.forEach((n) => {
        pushAlert({
          id: `${role === 'servant' ? 'snote' : 'pnote'}_${n.id}`,
          urgency: 'special',
          badge: n.behavior_tag || 'ملاحظة متابعة 📝',
          icon: '📝',
          title:
            role === 'servant'
              ? `ملاحظة جديدة عن ${n.child_name || 'مخدوم'}`
              : `ملاحظة جديدة عن ${n.child_name || 'ابنك'}`,
          sub: n.note_text || '',
          onRead: () => onAckNote?.(n.id),
          action: () => {
            setOpen(false);
            onNavigateCard?.(role === 'servant' ? 'cases' : 'children');
          }
        });
      });
    }
  }

  const markAllAsRead = () => {
    const unread = alerts.filter((a) => !isAlertRead(a.id));
    unread.forEach((a) => a.onRead?.());
    const dbOnes = dbReaderId ? unread.filter((a) => isDbAlertId(a.id)) : [];
    const localOnes = unread.filter((a) => !dbOnes.includes(a));
    if (localOnes.length > 0) persistReadIds([...readIds, ...localOnes.map((a) => a.id)]);
    dbOnes.forEach((a) => setDbRead(a.id, true));
  };

  const unreadAlerts = alerts.filter((a) => !isAlertRead(a.id));
  const readAlertsList = alerts.filter((a) => isAlertRead(a.id));

  // ===== إرسال تنبيه لباقي الأدوار =====
  const targetOptions =
    role === 'priest'
      ? [
          { v: 'all', l: 'الجميع' },
          { v: 'servant', l: 'الخدام' },
          { v: 'member', l: 'المخدومين' },
          { v: 'parent', l: 'أولياء الأمور' }
        ]
      : [
          { v: 'priest', l: 'الآباء الكهنة' },
          { v: 'servant', l: 'الخدام' }
        ];

  const sendNotification = async () => {
    const title = composeForm.title.trim();
    const target = composeForm.target || targetOptions[0].v;
    if (!title) {
      setComposeMsg('اكتب عنوان التنبيه');
      return;
    }
    if (!dbReaderId) {
      setComposeMsg('تعذر تحديد المرسل');
      return;
    }
    setSending(true);
    setComposeMsg('');
    try {
      const { error } = await supabase.from('church_notifications').insert([
        {
          type: 'broadcast',
          title,
          message: composeForm.message.trim(),
          category: 'إعلان 📢',
          is_urgent: composeForm.urgent,
          target_role: target,
          created_by: String(dbReaderId),
          created_by_name: senderName || currentUser?.full_name || '',
          created_by_role: role
        }
      ]);
      if (error) {
        setComposeMsg('تعذر الإرسال: ' + error.message);
      } else {
        setComposeMsg('✅ تم الإرسال');
        setComposeForm({ title: '', message: '', target: '', urgent: false });
        setTimeout(() => {
          setComposeOpen(false);
          setComposeMsg('');
        }, 900);
      }
    } finally {
      setSending(false);
    }
  };

  const urgentAlerts = unreadAlerts.filter((a) => a.urgency === 'urgent');
  const specialAlerts = unreadAlerts.filter((a) => a.urgency === 'special');
  const weekAlerts = unreadAlerts.filter((a) => a.urgency === 'week');

  useEffect(() => {
    if (!soundEnabled || playedOnceRef.current || unreadAlerts.length === 0) return;
    const trigger = () => {
      if (!playedOnceRef.current && soundEnabled) {
        playedOnceRef.current = true;
        playTingTingChime();
      }
      window.removeEventListener('pointerdown', trigger);
    };
    window.addEventListener('pointerdown', trigger, { once: true });
    return () => window.removeEventListener('pointerdown', trigger);
  }, [unreadAlerts.length, soundEnabled]);

  useEffect(() => {
    if (unreadAlerts.length > prevUnreadCountRef.current && soundEnabled) {
      playTingTingChime();
    }
    prevUnreadCountRef.current = unreadAlerts.length;
  }, [unreadAlerts.length, soundEnabled]);

  const handleAlertClick = (al) => {
    markAsRead(al.id, al);
    al.action?.();
  };

  const renderAlertCard = (al, containerStyle, badgeStyle) => (
    <div
      key={al.id}
      className={`w-full p-3 rounded-2xl flex items-start justify-between gap-2 transition ${containerStyle}`}
    >
      <button
        type="button"
        onClick={() => handleAlertClick(al)}
        className="flex-1 text-right cursor-pointer space-y-1"
      >
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${badgeStyle}`}>
          {al.badge}
        </span>
        <strong className="text-sm text-gray-900 block">
          {al.icon} {al.title}
        </strong>
        {al.sub && (
          <span className="text-xs text-gray-700 block leading-relaxed">
            {al.sub}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => markAsRead(al.id, al)}
        className="px-2.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-gray-200 rounded-xl text-[11px] font-black flex items-center gap-1 shrink-0 cursor-pointer"
        title="تمت القراءة / إزالة التنبيه"
      >
        <Check size={13} /> تمت القراءة
      </button>
    </div>
  );

  return (
    <div className="relative print:hidden" dir="rtl">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (!open) {
              fetchLiveDatabaseNotifications();
              if (soundEnabled && unreadAlerts.length > 0) playTingTingChime();
            }
            setOpen(!open);
          }}
          className="relative px-3.5 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#4a0e13] rounded-2xl font-black text-xs md:text-sm flex items-center gap-1.5 cursor-pointer shadow transition"
          title="جرس التنبيهات والمواعيد والتنبيهات الخاصة"
        >
          <Bell size={18} className={urgentAlerts.length > 0 ? 'animate-bounce' : ''} />
          <span>التنبيهات</span>
          {unreadAlerts.length > 0 && (
            <span className="px-2 py-0.5 bg-[#7a1c24] text-white rounded-full text-[11px] font-black">
              {unreadAlerts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            const next = !soundEnabled;
            setSoundEnabled(next);
            try {
              localStorage.setItem(SOUND_STORAGE_KEY, String(next));
            } catch {
              // ignore
            }
            if (next) playTingTingChime();
          }}
          className="p-2.5 bg-amber-100 hover:bg-amber-200 text-[#7a1c24] rounded-2xl cursor-pointer border border-amber-300"
          title={soundEnabled ? 'كتم صوت التنبيه (تن تن)' : 'تفعيل صوت التنبيه (تن تن)'}
        >
          {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-16 z-80">
          <div className="bg-white text-gray-900 rounded-3xl w-full max-w-xl p-5 space-y-4 shadow-2xl max-h-[82vh] overflow-y-auto">
            <div className="flex flex-wrap justify-between items-center border-b pb-3 gap-2">
              <div className="flex items-center gap-2">
                <Bell className="text-[#7a1c24]" size={20} />
                <h3 className="text-base font-black text-[#7a1c24]">
                  الإشعارات والبيانات التفصيلية ({unreadAlerts.length} جديد)
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={fetchLiveDatabaseNotifications}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="تحديث البيانات من قاعدة البيانات"
                >
                  <RefreshCw size={13} className={refreshingLive ? 'animate-spin' : ''} /> تحديث
                </button>
                {unreadAlerts.length > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck size={14} /> تعليم الكل كمقروء
                  </button>
                )}
                {readAlertsList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowReadAlerts(!showReadAlerts)}
                    className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Eye size={13} />{' '}
                    {showReadAlerts ? 'إخفاء المقروءة' : `المقروءة (${readAlertsList.length})`}
                  </button>
                )}
                {canSend && (
                  <button
                    type="button"
                    onClick={() => setComposeOpen(true)}
                    className="px-2.5 py-1.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl text-xs font-black cursor-pointer"
                  >
                    ✉️ إرسال تنبيه
                  </button>
                )}
                <button
                  type="button"
                  onClick={playTingTingChime}
                  className="px-2.5 py-1.5 bg-amber-100 text-amber-950 rounded-xl text-xs font-bold cursor-pointer"
                >
                  🔔 تجربة الصوت
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {unreadAlerts.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 space-y-1">
                <strong className="block text-emerald-800">✅ لا توجد تنبيهات غير مقروءة حالياً</strong>
                <span className="text-xs">كل التنبيهات تمت قراءتها.</span>
              </div>
            ) : (
              <div className="space-y-4">
                {urgentAlerts.length > 0 && (
                  <div className="space-y-2">
                    <strong className="text-xs text-red-800 block">
                      🔴 تنبيهات عاجلة (اليوم وبكرة - قبلها بيوم):
                    </strong>
                    {urgentAlerts.map((al) =>
                      renderAlertCard(
                        al,
                        'bg-red-50 hover:bg-red-100 border-2 border-red-200',
                        'bg-red-700 text-white'
                      )
                    )}
                  </div>
                )}

                {specialAlerts.length > 0 && (
                  <div className="space-y-2">
                    <strong className="text-xs text-indigo-900 flex items-center gap-1">
                      <Sparkles size={13} /> تنبيهات خاصة ومستجدات (دعوات / حضور وانصراف / إشعارات):
                    </strong>
                    {specialAlerts.map((al) =>
                      renderAlertCard(
                        al,
                        'bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200',
                        'bg-indigo-700 text-white'
                      )
                    )}
                  </div>
                )}

                {weekAlerts.length > 0 && (
                  <div className="space-y-2">
                    <strong className="text-xs text-amber-900 flex items-center gap-1">
                      <Clock size={13} /> مواعيد وأحداث هذا الأسبوع:
                    </strong>
                    {weekAlerts.map((al) =>
                      renderAlertCard(
                        al,
                        'bg-amber-50/70 hover:bg-amber-100 border border-amber-200',
                        'bg-amber-200 text-amber-950'
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {showReadAlerts && readAlertsList.length > 0 && (
              <div className="border-t pt-3 space-y-2">
                <strong className="text-xs text-gray-600 block">
                  📂 تنبيهات تمت قراءتها ({readAlertsList.length}):
                </strong>
                {readAlertsList.map((al) => (
                  <div
                    key={al.id}
                    className="p-2.5 bg-gray-50 border rounded-2xl flex items-center justify-between gap-2 opacity-75"
                  >
                    <button
                      type="button"
                      onClick={al.action}
                      className="flex-1 text-right cursor-pointer"
                    >
                      <strong className="text-xs text-gray-800 block">
                        {al.icon} {al.title}
                      </strong>
                      <span className="text-[11px] text-gray-500">{al.sub}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => restoreAlert(al.id)}
                      className="px-2 py-1 bg-white border rounded-lg text-[10px] font-bold text-gray-700 hover:bg-gray-100 flex items-center gap-1 shrink-0 cursor-pointer"
                      title="إعادة كغير مقروء"
                    >
                      <RotateCcw size={11} /> استعادة
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {composeOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-90">
          <div className="bg-white text-gray-900 rounded-3xl w-full max-w-md p-5 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-black text-[#7a1c24]">✉️ إرسال تنبيه</h3>
              <button type="button" onClick={() => setComposeOpen(false)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <label className="block text-xs font-bold">
              إلى:
              <select
                className="w-full mt-1 p-2.5 border rounded-xl bg-white"
                value={composeForm.target || targetOptions[0].v}
                onChange={(e) => setComposeForm({ ...composeForm, target: e.target.value })}
              >
                {targetOptions.map((o) => (
                  <option key={o.v} value={o.v}>{o.l}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold">
              العنوان:
              <input
                className="w-full mt-1 p-2.5 border rounded-xl"
                value={composeForm.title}
                onChange={(e) => setComposeForm({ ...composeForm, title: e.target.value })}
              />
            </label>
            <label className="block text-xs font-bold">
              التفاصيل:
              <textarea
                rows={3}
                className="w-full mt-1 p-2.5 border rounded-xl"
                value={composeForm.message}
                onChange={(e) => setComposeForm({ ...composeForm, message: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={composeForm.urgent}
                onChange={(e) => setComposeForm({ ...composeForm, urgent: e.target.checked })}
              />
              تنبيه عاجل 🔴
            </label>
            {composeMsg && <p className="text-xs font-black text-[#7a1c24]">{composeMsg}</p>}
            <button
              type="button"
              disabled={sending}
              onClick={sendNotification}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl font-black cursor-pointer"
            >
              {sending ? 'جاري الإرسال...' : 'إرسال'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
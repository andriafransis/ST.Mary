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
  Sparkles,
  Trash2
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

function normalizeStr(v) {
  return String(v || '').trim().toLowerCase();
}

export default function BellNotificationsPanel({
  priestId = null,
  currentUser = null,
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
  const effectiveActorId = priestId || currentUser?.id || null;
  const userRole = normalizeStr(currentUser?.role);
  const userService = normalizeStr(
    currentUser?.service_name ||
      currentUser?.service ||
      currentUser?.meeting_name ||
      currentUser?.department ||
      currentUser?.permissions?.service_name
  );

  const storageScope =
    effectiveActorId ||
    myConfessors?.[0]?.confession_father_id ||
    personalItems?.[0]?.priest_id ||
    masses?.[0]?.priest_id ||
    'default';

  const READ_STORAGE_KEY = `priest_read_alerts_${storageScope}`;
  const CLEARED_SINCE_KEY = `bell_cleared_since_${storageScope}`;
  const SOUND_STORAGE_KEY = `priest_bell_sound_${storageScope}`;

  const [open, setOpen] = useState(false);
  const [showReadAlerts, setShowReadAlerts] = useState(false);
  const [liveBookings, setLiveBookings] = useState([]);
  const [liveInvitations, setLiveInvitations] = useState([]);
  const [liveAttendanceLogs, setLiveAttendanceLogs] = useState([]);
  const [specialAlertsFromDb, setSpecialAlertsFromDb] = useState([]);
  const [refreshingLive, setRefreshingLive] = useState(false);

  const [readIds, setReadIds] = useState(() => {
    try {
      const raw = localStorage.getItem(READ_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [clearedSince, setClearedSince] = useState(() => {
    try {
      return localStorage.getItem(CLEARED_SINCE_KEY) || '';
    } catch {
      return '';
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(READ_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setReadIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setReadIds([]);
    }
    try {
      setClearedSince(localStorage.getItem(CLEARED_SINCE_KEY) || '');
    } catch {
      setClearedSince('');
    }
  }, [READ_STORAGE_KEY, CLEARED_SINCE_KEY]);

  const fetchLiveDatabaseNotifications = useCallback(async () => {
    if (!supabase || typeof supabase.from !== 'function') return;
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
          .limit(30)
      ]);

      if (!bkRes.error && Array.isArray(bkRes.data)) {
        setLiveBookings(bkRes.data);
      }
      if (!invRes.error && Array.isArray(invRes.data)) {
        setLiveInvitations(invRes.data);
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
  }, []);

  useEffect(() => {
    fetchLiveDatabaseNotifications();
  }, [fetchLiveDatabaseNotifications]);

  useEffect(() => {
    if (!supabase || typeof supabase.channel !== 'function') return;

    const channel = supabase
      .channel(`bell-live-sync-${storageScope}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'confession_bookings' },
        () => fetchLiveDatabaseNotifications()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'church_invitations' },
        () => fetchLiveDatabaseNotifications()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'church_attendance_logs' },
        () => fetchLiveDatabaseNotifications()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'church_notifications' },
        () => fetchLiveDatabaseNotifications()
      )
      .subscribe();

    return () => {
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel);
      }
    };
  }, [storageScope, fetchLiveDatabaseNotifications]);

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

  const markAsRead = (alertId) => {
    if (!alertId || readIds.includes(alertId)) return;
    persistReadIds([...readIds, alertId]);
  };

  const restoreAlert = (alertId) => {
    persistReadIds(readIds.filter((id) => id !== alertId));
  };

  const clearAllNotifications = () => {
    const nowIso = new Date().toISOString();
    setClearedSince(nowIso);
    try {
      localStorage.setItem(CLEARED_SINCE_KEY, nowIso);
    } catch {
      // ignore
    }
    persistReadIds([...readIds, ...alerts.map((a) => a.id)]);
  };

  const isClearedByTime = (timestampVal) => {
    if (!clearedSince || !timestampVal) return false;
    const clearedMs = new Date(clearedSince).getTime();
    const itemMs = new Date(timestampVal).getTime();
    if (Number.isNaN(clearedMs) || Number.isNaN(itemMs)) return false;
    return itemMs <= clearedMs;
  };

  const isTargetedToCurrentUser = (record) => {
    if (!record || typeof record !== 'object') return true;

    const targetUserId = record.target_user_id || record.recipient_user_id || record.user_id || null;
    const targetRole = normalizeStr(record.target_role || record.audience_role || record.role);
    const targetService = normalizeStr(
      record.target_service || record.service_name || record.service || record.audience_service
    );
    const isGeneral =
      Boolean(record.is_general) ||
      normalizeStr(record.audience) === 'all' ||
      normalizeStr(record.audience) === 'general' ||
      (!targetUserId && !targetRole && !targetService);

    if (isGeneral) return true;

    if (targetUserId && effectiveActorId) {
      if (String(targetUserId) === String(effectiveActorId)) return true;
      return false;
    }

    if (targetRole && userRole) {
      const roleMatches =
        targetRole === userRole ||
        (targetRole === 'all' || targetRole === 'general' || targetRole === 'everyone');
      if (!roleMatches) return false;
    }

    if (targetService && userService) {
      if (targetService !== userService) return false;
    }

    return true;
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
    if (al.timestamp && isClearedByTime(al.timestamp)) return;
    seenAlertKeys.add(al.id);
    alerts.push(al);
  };

  // 1. مناسبات وإعلانات الجدول الخاص / العامة التلقائية (اجتماع، رحلة، مناسبة، تدشين...)
  personalItems.forEach((p) => {
    if (!p.event_date || !isTargetedToCurrentUser(p)) return;
    const ts = p.created_at || `${p.event_date}T08:00:00`;
    if (p.event_date === baseToday) {
      pushAlert({
        id: `pers_today_${p.id}_${baseToday}`,
        urgency: 'urgent',
        badge: 'اليوم 🔴',
        icon: '📅',
        title: `اليوم: ${p.event_type || 'مناسبة'} — ${p.title || ''}`,
        sub: `${p.event_time ? `⏰ الساعة ${p.event_time}` : ''} ${p.location ? `• 📍 ${p.location}` : ''}`,
        timestamp: ts,
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
        timestamp: ts,
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
        timestamp: ts,
        action: () => {
          setOpen(false);
          onNavigateCard?.('personal');
        }
      });
    }
  });

  // 2. جدول القداسات التلقائي
  masses.forEach((m) => {
    if (!m.mass_date || m.is_available === false || !isTargetedToCurrentUser(m)) return;
    const ts = m.created_at || `${m.mass_date}T06:00:00`;
    if (m.mass_date === baseToday) {
      pushAlert({
        id: `mass_today_${m.id}_${baseToday}`,
        urgency: 'urgent',
        badge: 'قداس اليوم ⛪',
        icon: '⛪',
        title: `اليوم قداس: ${m.mass_name} (${m.church_name})`,
        sub: `⏰ ${m.mass_time || ''} ${m.priest_role ? `• ${m.priest_role}` : ''}`,
        timestamp: ts,
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
        timestamp: ts,
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
        title: `قداس يوم ${m.mass_date}: ${m.mass_name}`,
        sub: `⏰ ${m.mass_time || ''} • 📍 ${m.church_name || ''} ${m.priest_role ? `(${m.priest_role})` : ''}`,
        timestamp: ts,
        action: () => {
          setOpen(false);
          onNavigateCard?.('masses');
        }
      });
    }
  });

  // 3. حجوزات الاعتراف الخاصة بالمستخدم/الكاهن
  const combinedBookings = [
    ...confessionBookings,
    ...liveBookings.filter((lb) => !confessionBookings.some((cb) => cb.id === lb.id))
  ];

  combinedBookings
    .filter(
      (b) =>
        b.status === 'محجوز' &&
        b.booking_date >= baseToday &&
        b.booking_date <= weekLimitISO &&
        (!effectiveActorId ||
          !b.confession_father_id ||
          String(b.confession_father_id) === String(effectiveActorId) ||
          String(b.member_id) === String(effectiveActorId))
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
        title: `${b.member_name || memberObj?.full_name || 'معترف'} حاجز اعتراف ${
          b.booking_date === baseToday
            ? 'اليوم'
            : b.booking_date === tomorrowISO
              ? 'بكرة'
              : `يوم ${b.booking_date}`
        }`,
        sub: `${b.booking_time ? `⏰ ${b.booking_time} • ` : ''}اضغط لفتح الملف الروحي والقانون السابق`,
        timestamp: b.created_at || `${b.booking_date}T09:00:00`,
        action: () => {
          setOpen(false);
          if (memberObj && onOpenConfessor) onOpenConfessor(memberObj);
          else onNavigateCard?.('confessions');
        }
      });
    });

  // 4. أعياد الميلاد
  const currentYear = new Date().getFullYear();
  myConfessors.forEach((m) => {
    const d = daysUntilBirthday(m.dob);
    if (d === null) return;
    pushAlert({
      id: `bday_${m.id}_${currentYear}`,
      urgency: d === 0 ? 'urgent' : 'week',
      badge: d === 0 ? 'عيد ميلاد اليوم 🎂' : `عيد ميلاد خلال ${d} يوم 🎂`,
      icon: '🎂',
      title: `عيد ميلاد: ${m.full_name}`,
      sub: `📅 ${m.dob} • اضغط لفتح تهنئة واتساب`,
      timestamp: `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}T08:00:00`,
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

  // 5. إشعارات قاعدة البيانات (church_notifications): عامة، أو حسب الدور، أو حسب الخدمة، أو ترحيب/شخصي
  specialAlertsFromDb.forEach((sp) => {
    if (!isTargetedToCurrentUser(sp)) return;

    const categoryLabel =
      sp.category ||
      (sp.type === 'welcome' ? 'ترحيب 👋' : sp.type === 'general' ? 'إشعار عام 📢' : 'تنبيه خاص ✨');

    pushAlert({
      id: `special_db_${sp.id}`,
      urgency: sp.is_urgent ? 'urgent' : 'special',
      badge: categoryLabel,
      icon: sp.type === 'welcome' ? '👋' : '✨',
      title: sp.title || 'إشعار جديد',
      sub: [
        sp.message || sp.body || sp.description || '',
        sp.created_at ? `🕒 ${formatDateTimeAr(sp.created_at)}` : ''
      ]
        .filter(Boolean)
        .join(' • '),
      timestamp: sp.created_at,
      action: () => {
        setOpen(false);
        if (sp.target_card) onNavigateCard?.(sp.target_card);
      }
    });
  });

  // 6. مستجدات الدعوات وحضور وانصراف QR الخاصة بالمستخدم الحالي
  liveInvitations
    .filter(
      (inv) =>
        !effectiveActorId ||
        String(inv.recipient_user_id) === String(effectiveActorId) ||
        String(inv.created_by_user_id) === String(effectiveActorId)
    )
    .slice(0, 6)
    .forEach((inv) => {
      const isChecked = inv.status === 'checked_in';
      const ts = inv.checked_in_at || inv.created_at;
      pushAlert({
        id: `inv_live_${inv.id}_${inv.status}`,
        urgency: isChecked ? 'special' : 'week',
        badge: isChecked ? 'تم Scan دعوة ✅' : 'دعوة جديدة 🎟️',
        icon: '🎟️',
        title: `${inv.event_title || 'دعوة'} — ${inv.recipient_name || ''}`,
        sub: [
          inv.seat_or_zone ? `📍 ${inv.seat_or_zone}` : '',
          inv.checked_in_by ? `بواسطة: ${inv.checked_in_by}` : '',
          `🕒 ${formatDateTimeAr(ts)}`
        ]
          .filter(Boolean)
          .join(' • '),
        timestamp: ts,
        action: () => {
          setOpen(false);
          onNavigateCard?.('invitations');
        }
      });
    });

  liveAttendanceLogs
    .filter(
      (log) => !effectiveActorId || String(log.user_id) === String(effectiveActorId)
    )
    .slice(0, 6)
    .forEach((log) => {
      const isOut = Boolean(log.checked_out_at);
      const ts = isOut ? log.checked_out_at : log.checked_in_at;
      pushAlert({
        id: `att_live_${log.id}_${isOut ? 'out' : 'in'}`,
        urgency: 'special',
        badge: isOut ? 'انصراف QR 👋' : 'حضور QR ✅',
        icon: isOut ? '👋' : '✅',
        title: `${log.full_name} — ${isOut ? 'تسجيل انصراف' : 'تسجيل حضور'}`,
        sub: [
          `🕒 ${formatDateTimeAr(ts)}`,
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
        timestamp: ts,
        action: () => {
          setOpen(false);
          onNavigateCard?.('attendance');
        }
      });
    });

  const markAllAsRead = () => {
    persistReadIds([...readIds, ...alerts.map((a) => a.id)]);
  };

  const unreadAlerts = alerts.filter((a) => !readIds.includes(a.id));
  const readAlertsList = alerts.filter((a) => readIds.includes(a.id));

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
    markAsRead(al.id);
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
          <span className="text-xs text-gray-700 block leading-relaxed">{al.sub}</span>
        )}
      </button>
      <button
        type="button"
        onClick={() => markAsRead(al.id)}
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
          title="جرس التنبيهات والمواعيد وأعياد الميلاد والتنبيهات الخاصة"
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
                {alerts.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllNotifications}
                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
                    title="مسح كل الإشعارات الحالية"
                  >
                    <Trash2 size={13} /> مسح الكل
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
                <strong className="block text-emerald-800">
                  ✅ لا توجد تنبيهات غير مقروءة حالياً
                </strong>
                <span className="text-xs">كل التنبيهات تمت قراءتها أو مسحها.</span>
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
    </div>
  );
}
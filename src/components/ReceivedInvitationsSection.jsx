import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Ticket,
  Crown,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  RefreshCw,
  BellRing,
  ScanLine
} from 'lucide-react';

function normalizeArabicName(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ');
}

function normalizePhoneNumber(phone = '') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('20') && digits.length === 12) {
    return digits.slice(2);
  }
  if (digits.startsWith('0020') && digits.length === 14) {
    return digits.slice(4);
  }
  return digits;
}

function isInvitationStrictlyMine(row, currentUser) {
  if (!row || !currentUser) return false;

  const userId = String(currentUser.id || '').trim();
  const rowRecipientId = String(row.recipient_user_id || '').trim();

  // إذا كانت الدعوة مرتبطة بـ recipient_user_id محدد، يجب أن تطابقه بالضبط ولا تظهر لغيره
  if (rowRecipientId) {
    return Boolean(userId) && rowRecipientId === userId;
  }

  // عند غياب recipient_user_id، نطابق رقم التليفون الموحد أو الاسم الكامل بدقة فقط
  const userPhones = [
    currentUser.phone,
    currentUser.father_phone,
    currentUser.mother_phone
  ]
    .map(normalizePhoneNumber)
    .filter(Boolean);

  const rowPhone = normalizePhoneNumber(row.recipient_phone);
  if (rowPhone && userPhones.length > 0 && userPhones.includes(rowPhone)) {
    return true;
  }

  const userName = normalizeArabicName(currentUser.full_name);
  const rowName = normalizeArabicName(row.recipient_name);
  if (userName && rowName && userName === rowName) {
    return true;
  }

  return false;
}

function QrCodeBox({ value, size = 88 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const modules = 21;
    const margin = 2;
    const total = modules + margin * 2;
    const cell = Math.floor(size / total);
    const actualSize = cell * total;

    canvas.width = actualSize;
    canvas.height = actualSize;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, actualSize, actualSize);

    const grid = Array.from({ length: modules }, () => Array(modules).fill(false));
    const reserved = Array.from({ length: modules }, () => Array(modules).fill(false));

    const drawFinder = (r0, c0) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = r0 + r;
          const cc = c0 + c;
          if (rr < 0 || rr >= modules || cc < 0 || cc >= modules) continue;
          reserved[rr][cc] = true;
          const inBox = r >= 0 && r <= 6 && c >= 0 && c <= 6;
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[rr][cc] = inBox && (isBorder || isCenter);
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, modules - 7);
    drawFinder(modules - 7, 0);

    let hash = 2166136261;
    const text = String(value);
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    let seed = hash >>> 0;
    const nextBit = () => {
      seed ^= seed << 13;
      seed >>>= 0;
      seed ^= seed >>> 17;
      seed >>>= 0;
      seed ^= seed << 5;
      seed >>>= 0;
      return (seed & 1) === 1;
    };

    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (!reserved[r][c]) {
          grid[r][c] = nextBit();
        }
      }
    }

    ctx.fillStyle = '#111827';
    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (grid[r][c]) {
          ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
        }
      }
    }
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={`QR Code ${value}`}
      className="block rounded-lg"
    />
  );
}

export default function ReceivedInvitationsSection({ currentUser, onCountChange }) {
  const [myInvites, setMyInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [liveBanner, setLiveBanner] = useState('');
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const normalizedUserPhones = useMemo(() => {
    if (!currentUser) return [];
    return [
      currentUser.phone,
      currentUser.father_phone,
      currentUser.mother_phone
    ]
      .map(normalizePhoneNumber)
      .filter(Boolean);
  }, [currentUser]);

  const triggerMobileNotification = useCallback((inv, isScanUpdate = false) => {
    const title = isScanUpdate
      ? `تم مسح QR الدعوة: ${inv.event_title}`
      : inv.invite_tier === 'vip'
        ? `دعوة VIP جديدة: ${inv.event_title}`
        : `دعوة جديدة: ${inv.event_title}`;

    const body = [
      inv.seat_or_zone ? `المكان: ${inv.seat_or_zone}` : '',
      inv.event_date ? `التاريخ: ${inv.event_date}` : '',
      inv.event_time ? `الموعد: ${inv.event_time}` : '',
      `كود: ${inv.qr_token}`
    ]
      .filter(Boolean)
      .join(' • ');

    setLiveBanner(`${title} — ${body}`);

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/ST.Mary/icon-192.png',
          tag: `inv-${inv.qr_token}-${isScanUpdate ? 'scanned' : 'new'}`
        });
      } catch {
        // ignore
      }
    }
  }, []);

  const requestMobileAlertPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  const fetchMyInvites = useCallback(async () => {
    if (!currentUser?.id || !supabase || typeof supabase.from !== 'function') return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('church_invitations')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && Array.isArray(data)) {
        const strictlyMine = data.filter((row) => isInvitationStrictlyMine(row, currentUser));
        const uniqueByKey = Array.from(
          new Map(strictlyMine.map((row) => [row.id || row.qr_token, row])).values()
        );
        setMyInvites(uniqueByKey);
        if (onCountChange) {
          onCountChange(uniqueByKey.filter((i) => i.status !== 'checked_in').length);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser, onCountChange]);

  useEffect(() => {
    fetchMyInvites();
  }, [fetchMyInvites]);

  useEffect(() => {
    if (!currentUser?.id || !supabase || typeof supabase.channel !== 'function') return;

    const channel = supabase
      .channel(`user-invitations-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'church_invitations'
        },
        (payload) => {
          const row = payload.new || payload.old;
          if (!isInvitationStrictlyMine(row, currentUser)) return;

          fetchMyInvites();
          if (payload.eventType === 'INSERT' && payload.new) {
            triggerMobileNotification(payload.new, false);
          } else if (
            payload.eventType === 'UPDATE' &&
            payload.new?.status === 'checked_in' &&
            payload.old?.status !== 'checked_in'
          ) {
            triggerMobileNotification(payload.new, true);
          }
        }
      )
      .subscribe();

    return () => {
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUser, normalizedUserPhones, fetchMyInvites, triggerMobileNotification]);

  return (
    <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3 text-xs" dir="rtl">
      {liveBanner && (
        <div className="p-3 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 font-black flex items-center justify-between gap-2">
          <span>{liveBanner}</span>
          <button
            type="button"
            onClick={() => setLiveBanner('')}
            className="text-emerald-800 hover:text-emerald-950 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div>
          <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5">
            <Ticket size={17} /> دعواتي وكود الـ QR ({myInvites.length})
          </h3>
          <p className="text-[11px] text-gray-500 font-bold mt-0.5">
            تظهر هنا الدعوات الموجهة باسمك وحسابك فقط ومرتبة من الترتيب رقم 1.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {typeof Notification !== 'undefined' && notifPermission !== 'granted' && (
            <button
              type="button"
              onClick={requestMobileAlertPermission}
              className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl font-black flex items-center gap-1 cursor-pointer"
            >
              <BellRing size={13} /> تفعيل إشعار الموبايل
            </button>
          )}
          <button
            type="button"
            onClick={fetchMyInvites}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث
          </button>
        </div>
      </div>

      {myInvites.length === 0 ? (
        <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
          لا توجد دعوات مناسبات مرسلة لحسابك حالياً.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {myInvites.map((inv, index) => {
            const serialNumber = index + 1;
            const isVip = inv.invite_tier === 'vip';
            const isChecked = inv.status === 'checked_in';

            return (
              <div
                key={inv.id || inv.qr_token}
                className={`p-4 rounded-3xl border-2 space-y-3 ${
                  isVip
                    ? 'bg-amber-50/70 border-amber-400 shadow-xs'
                    : 'bg-[#fbfaf7] border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="px-2 py-0.5 rounded-lg bg-[#7a1c24] text-white text-[10px] font-black">
                        #{serialNumber}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black inline-flex items-center gap-1 ${
                          isVip
                            ? 'bg-amber-400 text-[#4a0e13]'
                            : 'bg-red-50 text-[#7a1c24]'
                        }`}
                      >
                        {isVip && <Crown size={11} />}
                        {isVip ? 'دعوة VIP' : 'دعوة عامة'}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-white border text-gray-700 text-[10px] font-bold">
                        {inv.event_type || 'مناسبة كنسية'}
                      </span>
                    </div>
                    <strong className="text-sm sm:text-base font-black text-gray-900">
                      {serialNumber}. {inv.event_title}
                    </strong>
                    {inv.recipient_name && (
                      <p className="text-[11px] text-gray-600 font-bold mt-0.5">
                        المدعو: {inv.recipient_name}
                      </p>
                    )}
                  </div>

                  {isChecked ? (
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-900 text-[10px] font-black shrink-0 inline-flex items-center gap-1">
                      <CheckCircle2 size={13} /> تم عمل Scan (دخل)
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-900 border border-blue-200 text-[10px] font-black shrink-0 inline-flex items-center gap-1">
                      <ScanLine size={13} /> جاهز للـ Scan
                    </span>
                  )}
                </div>

                <div className="bg-white/90 p-3 rounded-2xl border border-gray-200/80 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500 font-bold">المكان / التسكين:</span>
                    <strong className="text-[#7a1c24] font-black text-xs inline-flex items-center gap-1">
                      <MapPin size={12} />
                      {[inv.seat_or_zone, inv.location].filter(Boolean).join(' — ') || 'يُحدد عند الدخول'}
                    </strong>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-600 font-bold">
                    {inv.event_date && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={12} className="text-[#7a1c24]" /> {inv.event_date}
                      </span>
                    )}
                    {inv.event_time && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} className="text-[#7a1c24]" /> {inv.event_time}
                      </span>
                    )}
                  </div>
                  {inv.notes && (
                    <p className="text-gray-700 pt-1 border-t border-gray-100">
                      {inv.notes}
                    </p>
                  )}
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-gray-200 flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <span className="text-[11px] font-black text-gray-800 block">
                      {isChecked
                        ? 'تم تأكيد دخولك بواسطة الخادم/الكشافة'
                        : 'اعرض هذا الـ QR على الخادم عند الدخول'}
                    </span>
                    <code className="inline-block px-2.5 py-1 bg-[#fbfaf7] border rounded-lg font-mono font-black text-xs text-[#7a1c24]">
                      {inv.qr_token}
                    </code>
                    {isChecked && inv.checked_in_at && (
                      <span className="block text-[10px] text-emerald-700 font-bold">
                        وقت المسح: {new Date(inv.checked_in_at).toLocaleString('ar-EG')}
                      </span>
                    )}
                  </div>

                  <div className="p-2 bg-white border-2 border-gray-900 rounded-2xl shrink-0">
                    <QrCodeBox value={inv.qr_token} size={88} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
import { useEffect, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
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

export default function ReceivedInvitationsSection({ currentUser, onCountChange }) {
  const [myInvites, setMyInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const triggerMobileNotification = useCallback((inv, isScanUpdate = false) => {
    const title = isScanUpdate
      ? `✅ تم مسح QR الدعوة: ${inv.event_title}`
      : inv.invite_tier === 'vip'
        ? `👑 دعوة VIP جديدة: ${inv.event_title}`
        : `🎟️ دعوة جديدة: ${inv.event_title}`;

    const body = [
      inv.seat_or_zone ? `المكان: ${inv.seat_or_zone}` : '',
      inv.event_date ? `التاريخ: ${inv.event_date}` : '',
      inv.event_time ? `الموعد: ${inv.event_time}` : '',
      `كود: ${inv.qr_token}`
    ]
      .filter(Boolean)
      .join(' • ');

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/ST.Mary/icon-192.png',
          tag: `inv-${inv.qr_token}-${isScanUpdate ? 'scanned' : 'new'}`
        });
      } catch {
        // بعض متصفحات الموبايل تفضل إشعار Service Worker
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
        .eq('recipient_user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        setMyInvites(data);
        if (onCountChange) {
          onCountChange(data.filter((i) => i.status !== 'checked_in').length);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, onCountChange]);

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
          table: 'church_invitations',
          filter: `recipient_user_id=eq.${currentUser.id}`
        },
        (payload) => {
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
  }, [currentUser?.id, fetchMyInvites, triggerMobileNotification]);

  return (
    <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3 text-xs" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5">
          <Ticket size={17} /> دعواتي وكود الـ QR ({myInvites.length})
        </h3>

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
          {myInvites.map((inv) => {
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
                {/* الصف العلوي: نوع الدعوة + VIP/عام + حالة الـ Scan */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black inline-flex items-center gap-1 ${
                          isVip
                            ? 'bg-amber-400 text-[#4a0e13]'
                            : 'bg-red-50 text-[#7a1c24]'
                        }`}
                      >
                        {isVip && <Crown size={11} />}
                        {isVip ? '👑 دعوة VIP' : '👥 دعوة عامة'}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-white border text-gray-700 text-[10px] font-bold">
                        {inv.event_type || 'مناسبة كنسية'}
                      </span>
                    </div>
                    <strong className="text-sm sm:text-base font-black text-gray-900">
                      {inv.event_title}
                    </strong>
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

                {/* المكان والموعد والتاريخ */}
                <div className="bg-white/90 p-3 rounded-2xl border border-gray-200/80 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500 font-bold">المكان / التسكين:</span>
                    <strong className="text-[#7a1c24] font-black text-xs">
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
                      📌 {inv.notes}
                    </p>
                  )}
                </div>

                {/* صندوق الـ QR Code للمدعو ليقرأه الخادم/الكشافة */}
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
                    <QRCodeSVG value={inv.qr_token} size={88} level="M" />
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
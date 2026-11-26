import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import InvitationQrCard from './InvitationQrCard';
import { Bell, Crown, Users, QrCode, CheckCircle2, Calendar, MapPin } from 'lucide-react';

export default function MyInvitationsNotificationPanel({ currentUser }) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeInvite, setActiveInvite] = useState(null);

  const loadMyInvitations = async () => {
    if (!currentUser?.id || !supabase || typeof supabase.from !== 'function') return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('church_invitations')
        .select('*')
        .eq('recipient_user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        setInvitations(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyInvitations();
  }, [currentUser?.id]);

  const handleCloseCard = async () => {
    setActiveInvite(null);
    await loadMyInvitations();
  };

  return (
    <div className="space-y-3 text-xs" dir="rtl">
      <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-sm flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[#7a1c24]">
          <Bell size={18} />
          <div>
            <h3 className="text-sm font-black">إشعارات الدعوات ({invitations.length})</h3>
            <p className="text-[11px] text-gray-500">
              اضغط على أي دعوة لإظهار كود الـ QR الخاص بك عند الكشاف أو الخادم
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadMyInvitations}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold cursor-pointer"
        >
          تحديث
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-gray-400 bg-white rounded-3xl border">
          جاري تحميل الدعوات...
        </div>
      ) : invitations.length === 0 ? (
        <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-3xl border border-dashed">
          لا توجد دعوات مناسبات مرسلة إلى حسابك حالياً.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {invitations.map((inv) => {
            const isVip = inv.invite_tier === 'vip';
            const isCheckedIn = inv.status === 'checked_in';

            return (
              <div
                key={inv.id || inv.qr_token}
                className={`p-4 rounded-3xl border-2 flex flex-col justify-between gap-3 shadow-2xs ${
                  isVip
                    ? 'bg-amber-50/50 border-amber-300'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 ${
                        isVip
                          ? 'bg-amber-400 text-[#4a0e13]'
                          : 'bg-[#f9ecee] text-[#7a1c24]'
                      }`}
                    >
                      {isVip ? <Crown size={12} /> : <Users size={12} />}
                      {isVip ? 'دعوة VIP' : 'دعوة عامة'}
                    </span>

                    {isCheckedIn ? (
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 text-[10px] font-black flex items-center gap-1">
                        <CheckCircle2 size={12} /> تم الدخول
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-800 text-[10px] font-bold">
                        دعوة جديدة
                      </span>
                    )}
                  </div>

                  <strong className="text-sm text-gray-900 block">{inv.event_title}</strong>
                  <span className="text-[11px] text-gray-500 block">
                    {inv.event_type || 'مناسبة كنسية'}
                    {inv.seat_or_zone ? ` • ${inv.seat_or_zone}` : ''}
                  </span>

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-600 pt-1">
                    {inv.event_date && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-[#7a1c24]" /> {inv.event_date}
                      </span>
                    )}
                    {inv.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-[#7a1c24]" /> {inv.location}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveInvite(inv)}
                  className="w-full py-2.5 px-3 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-2xl font-black flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <QrCode size={15} /> فتح بطاقة الدعوة والـ QR Code
                </button>
              </div>
            );
          })}
        </div>
      )}

      {activeInvite && (
        <InvitationQrCard
          invitation={activeInvite}
          onClose={handleCloseCard}
        />
      )}
    </div>
  );
}
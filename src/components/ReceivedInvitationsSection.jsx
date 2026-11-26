import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Ticket, Crown, Calendar, Clock, MapPin, CheckCircle2, RefreshCw } from 'lucide-react';

export default function ReceivedInvitationsSection({ currentUser }) {
  const [myInvites, setMyInvites] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchMyInvites = async () => {
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
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyInvites();
  }, [currentUser?.id]);

  return (
    <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3 text-xs" dir="rtl">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5">
          <Ticket size={17} /> الدعوات الواردة إليك ({myInvites.length})
        </h3>
        <button
          type="button"
          onClick={fetchMyInvites}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      {myInvites.length === 0 ? (
        <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
          لا توجد دعوات مناسبات مرسلة لحسابك حالياً.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {myInvites.map((inv) => {
            const isVip = inv.invite_tier === 'vip';
            const isChecked = inv.status === 'checked_in';

            return (
              <div
                key={inv.id || inv.qr_token}
                className={`p-4 rounded-2xl border space-y-2 ${
                  isVip ? 'bg-amber-50/70 border-amber-300' : 'bg-[#fbfaf7] border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black inline-flex items-center gap-1 ${
                          isVip ? 'bg-amber-400 text-[#4a0e13]' : 'bg-red-50 text-[#7a1c24]'
                        }`}
                      >
                        {isVip && <Crown size={11} />}
                        {isVip ? 'دعوة VIP' : 'دعوة عامة'}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 text-[10px] font-bold">
                        {inv.event_type || 'مناسبة كنسية'}
                      </span>
                    </div>
                    <strong className="text-sm font-black text-gray-900">{inv.event_title}</strong>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0 ${
                      isChecked ? 'bg-emerald-100 text-emerald-900' : 'bg-blue-50 text-blue-800'
                    }`}
                  >
                    {isChecked ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 size={12} /> تم تسجيل الدخول
                      </span>
                    ) : (
                      'دعوة سارية'
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-600 font-bold">
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
                  {(inv.seat_or_zone || inv.location) && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} className="text-[#7a1c24]" />
                      {[inv.seat_or_zone, inv.location].filter(Boolean).join(' • ')}
                    </span>
                  )}
                </div>

                {inv.notes && <p className="text-gray-700 bg-white/80 p-2 rounded-xl border">{inv.notes}</p>}

                <div className="pt-1 flex items-center justify-between border-t border-gray-200/70 text-[11px]">
                  <span className="text-gray-500">كود الدعوة (QR):</span>
                  <code className="px-2.5 py-1 bg-white border rounded-lg font-mono font-black text-[#7a1c24]">
                    {inv.qr_token}
                  </code>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
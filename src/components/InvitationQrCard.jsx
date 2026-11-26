import { QRCodeCanvas } from 'qrcode.react';
import { Crown, Users, MapPin, Calendar, Clock, CheckCircle2, Ticket } from 'lucide-react';

export default function InvitationQrCard({ invitation, onClose }) {
  if (!invitation) return null;

  const isVip = invitation.invite_tier === 'vip';
  const isCheckedIn = invitation.status === 'checked_in';

  // نضع رمز الدعوة الفريد داخل الـ QR ليقرأه الكشاف/الخادم فوراً
  const qrPayload = JSON.stringify({
    type: 'church_invite',
    token: invitation.qr_token
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
        {/* رأس البطاقة */}
        <div
          className={`p-4 text-white flex items-center justify-between ${
            isVip
              ? 'bg-gradient-to-l from-[#3b0d11] via-[#7a1c24] to-[#b45309]'
              : 'bg-gradient-to-l from-[#5c1319] to-[#7a1c24]'
          }`}
        >
          <div className="flex items-center gap-2">
            {isVip ? <Crown size={20} className="text-amber-300" /> : <Ticket size={20} className="text-amber-200" />}
            <div>
              <span className="text-[11px] font-bold opacity-90 block">
                {invitation.event_type || 'دعوة رسمية'}
              </span>
              <h3 className="text-base font-black text-amber-200">{invitation.event_title}</h3>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-black ${
              isVip ? 'bg-amber-400 text-[#4a0e13]' : 'bg-white/20 text-white'
            }`}
          >
            {isVip ? '👑 دعوة VIP' : '👥 دعوة عامة'}
          </span>
        </div>

        {/* تفاصيل المدعو والمكان */}
        <div className="p-5 space-y-4 text-xs">
          <div className="bg-[#fbfaf7] border border-gray-200 rounded-2xl p-3.5 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-bold">اسم المدعو:</span>
              <strong className="text-sm text-gray-900">{invitation.recipient_name}</strong>
            </div>

            {invitation.seat_or_zone && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-bold flex items-center gap-1">
                  <Users size={13} className="text-[#7a1c24]" /> المكان / التسكين:
                </span>
                <strong className="text-[#7a1c24] font-black">{invitation.seat_or_zone}</strong>
              </div>
            )}

            {invitation.event_date && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-bold flex items-center gap-1">
                  <Calendar size={13} className="text-[#7a1c24]" /> التاريخ:
                </span>
                <span className="font-bold text-gray-800">{invitation.event_date}</span>
              </div>
            )}

            {invitation.event_time && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-bold flex items-center gap-1">
                  <Clock size={13} className="text-[#7a1c24]" /> الموعد:
                </span>
                <span className="font-bold text-gray-800">{invitation.event_time}</span>
              </div>
            )}

            {invitation.location && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-bold flex items-center gap-1">
                  <MapPin size={13} className="text-[#7a1c24]" /> الموقع:
                </span>
                <span className="font-bold text-gray-800">{invitation.location}</span>
              </div>
            )}
          </div>

          {/* مربع الـ QR Code */}
          <div className="flex flex-col items-center justify-center bg-white border-2 border-dashed border-[#7a1c24]/40 rounded-3xl p-4 space-y-2">
            <QRCodeCanvas
              value={qrPayload}
              size={190}
              level="H"
              includeMargin={true}
            />
            <span className="font-mono text-xs font-black tracking-wider text-gray-700 bg-gray-100 px-3 py-1 rounded-lg">
              {invitation.qr_token}
            </span>
            <p className="text-[11px] text-gray-500 text-center">
              ارفع سطوع الشاشة وقدّم الكود للكشاف أو الخادم عند الدخول
            </p>
          </div>

          {invitation.notes && (
            <div className="bg-amber-50 border border-amber-200 text-amber-950 p-3 rounded-2xl text-xs leading-relaxed">
              {invitation.notes}
            </div>
          )}

          {/* حالة الدخول */}
          {isCheckedIn ? (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-2xl flex items-center justify-center gap-2 font-black">
              <CheckCircle2 size={17} className="text-emerald-700" />
              <span>تم تأكيد دخول الدعوة بنجاح</span>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 text-blue-900 p-2.5 rounded-2xl text-center font-bold">
              الدعوة سارية — بانتظار المسح عند الوصول
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-2xl font-black cursor-pointer transition"
          >
            إغلاق البطاقة
          </button>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, RefreshCw, User, Shield } from 'lucide-react';

export function buildMemberAttendancePayload(user = {}) {
  return JSON.stringify({
    v: 1,
    type: 'church_member_attendance',
    user_id: user.id || '',
    username: user.username || '',
    full_name: user.full_name || user.name || '',
    role: user.role || 'member',
    role_label: user.permissions?.custom_role_label || user.role || ''
  });
}

export default function MemberAttendanceQr({ user }) {
  const [qrUrl, setQrUrl] = useState('');

  const generateCode = () => {
    if (!user?.id && !user?.username) return;
    const payload = buildMemberAttendancePayload(user);
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 3,
      width: 300,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => setQrUrl(url))
      .catch(() => setQrUrl(''));
  };

  useEffect(() => {
    generateCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.username, user?.full_name, user?.role]);

  if (!user) return null;

  return (
    <div
      className="bg-white border-2 border-slate-200 rounded-3xl p-4 shadow-sm space-y-3 text-xs"
      dir="rtl"
    >
      <div className="flex items-center justify-between border-b pb-2.5">
        <div className="flex items-center gap-2 text-[#7a1c24]">
          <QrCode size={18} />
          <strong className="text-sm font-black">QR الحضور والانصراف الشخصي</strong>
        </div>
        <button
          type="button"
          onClick={generateCode}
          className="px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw size={12} /> تحديث
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-36 h-36 shrink-0 rounded-2xl border bg-white p-2 flex items-center justify-center">
          {qrUrl ? (
            <img src={qrUrl} alt="Personal Attendance QR" className="w-full h-full object-contain" />
          ) : (
            <span className="text-gray-400 text-[11px]">جاري التوليد...</span>
          )}
        </div>

        <div className="flex-1 space-y-1.5 text-center sm:text-right">
          <div className="flex items-center justify-center sm:justify-start gap-1.5 font-black text-sm text-gray-900">
            <User size={15} className="text-[#7a1c24]" />
            <span>{user.full_name || user.username}</span>
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-1.5 text-gray-600">
            <Shield size={13} className="text-emerald-700" />
            <span>{user.permissions?.custom_role_label || user.role || 'عضو'}</span>
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed pt-1">
            اعرض هذا الكود عند الدخول لتسجيل <strong>الحضور</strong>، وعند المغادرة لتسجيل <strong>الانصراف</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
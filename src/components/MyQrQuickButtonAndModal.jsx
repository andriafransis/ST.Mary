import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, X, RefreshCw, Download, User, ShieldCheck } from 'lucide-react';

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

export default function MyQrQuickButtonAndModal({
  user,
  buttonLabel = 'الـ QR Code بتاعي',
  className = ''
}) {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const generateQr = () => {
    if (!user?.id && !user?.username) {
      setQrDataUrl('');
      return;
    }
    const payload = buildMemberAttendancePayload(user);
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 3,
      width: 340,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  };

  useEffect(() => {
    if (open) {
      generateQr();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id, user?.username, user?.full_name, user?.role]);

  if (!user) return null;

  const displayName = user.full_name || user.name || user.username || 'مخدوم';
  const roleLabel = user.permissions?.custom_role_label || user.role || 'مخدوم';

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `My-QR-${user.username || user.id || 'member'}.png`;
    link.click();
  };

  return (
    <>
      {/* الزرار الأساسي الظاهر في شاشة المخدوم */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`px-4 py-2.5 rounded-2xl bg-[#7a1c24] hover:bg-[#5c1319] text-white font-black text-xs inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer transition ${className}`}
      >
        <QrCode size={17} />
        <span>{buttonLabel}</span>
      </button>

      {/* نافذة عرض الـ QR Code عند الضغط على الزرار */}
      {open && (
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
                  <h3 className="text-sm sm:text-base font-black">الـ QR Code الشخصي</h3>
                  <p className="text-[11px] text-gray-500">
                    اعرض هذا الكود للخادم لتسجيل الحضور والانصراف
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center bg-[#fbfaf7] border-2 border-slate-200 rounded-3xl p-4 space-y-3">
              <div className="w-48 h-48 rounded-2xl bg-white border-2 border-slate-900/15 p-2.5 flex items-center justify-center shadow-inner">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="My QR Code"
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
                {qrDataUrl && (
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
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs cursor-pointer"
              >
                تم
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
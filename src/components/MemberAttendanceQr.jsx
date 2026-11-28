import { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { QrCode, RefreshCw, User, Shield, Download, Copy, Check } from 'lucide-react';

const ROLE_AR_LABELS = {
  admin: 'سوبر أدمن',
  priest: 'أب كاهن',
  head_servant: 'أمين الخدمة',
  vice_head_servant: 'مساعد أمين الخدمة',
  servant: 'خادم مرحلة',
  meeting_servant: 'خادم اجتماع',
  mercy_servant: 'خادم إخوة رب',
  deacon: 'شماس',
  member: 'مخدوم',
  parent: 'ولي أمر',
  worker: 'عامل / فراش'
};

export function buildMemberAttendancePayload(user = {}) {
  const customRole = user?.permissions?.custom_role_label || '';
  const rawRole = user?.role || 'member';
  return JSON.stringify({
    v: 1,
    type: 'church_member_attendance',
    user_id: user?.id || '',
    username: user?.username || '',
    full_name: user?.full_name || user?.name || '',
    role: rawRole,
    role_label: customRole || ROLE_AR_LABELS[rawRole] || rawRole
  });
}

export default function MemberAttendanceQr({ user }) {
  const [qrUrl, setQrUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const userId = user?.id || '';
  const username = user?.username || '';
  const fullName = user?.full_name || '';
  const nameFallback = user?.name || '';
  const role = user?.role || 'member';
  const customRoleLabel = user?.permissions?.custom_role_label || '';
  const lookupCode = String(userId || username || '').trim();

  const generateCode = useCallback(
    async (isCancelled = () => false) => {
      if (!userId && !username) {
        if (!isCancelled()) {
          setQrUrl('');
          setIsGenerating(false);
        }
        return;
      }

      if (!isCancelled()) {
        setIsGenerating(true);
      }

      const payload = buildMemberAttendancePayload({
        id: userId,
        username,
        full_name: fullName,
        name: nameFallback,
        role,
        permissions: { custom_role_label: customRoleLabel }
      });

      try {
        const url = await QRCode.toDataURL(payload, {
          errorCorrectionLevel: 'M',
          margin: 4,
          width: 400,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        });
        if (!isCancelled()) {
          setQrUrl(url);
          setIsGenerating(false);
        }
      } catch {
        if (!isCancelled()) {
          setQrUrl('');
          setIsGenerating(false);
        }
      }
    },
    [userId, username, fullName, nameFallback, role, customRoleLabel]
  );

  useEffect(() => {
    let cancelled = false;
    generateCode(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [generateCode]);

  if (!user) return null;

  const displayName = fullName || nameFallback || username || 'مستخدم';
  const roleText = customRoleLabel || ROLE_AR_LABELS[role] || role || 'عضو';

  const handleDownload = () => {
    if (!qrUrl) return;
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `Attendance-QR-${username || userId || 'member'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyCode = async () => {
    if (!lookupCode) return;
    try {
      await navigator.clipboard.writeText(lookupCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // تجاهل خطأ الحافظة في حال منع المتصفح للوصول المباشر
    }
  };

  return (
    <div
      className="bg-white border-2 border-slate-200 rounded-3xl p-4 shadow-sm space-y-3 text-xs"
      dir="rtl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
        <div className="flex items-center gap-2 text-[#7a1c24]">
          <QrCode size={18} />
          <strong className="text-sm font-black">QR الحضور والانصراف الشخصي</strong>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => generateCode()}
            disabled={isGenerating}
            className="px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-60 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition"
          >
            <RefreshCw size={12} className={isGenerating ? 'animate-spin' : ''} /> تحديث
          </button>
          {qrUrl && (
            <button
              type="button"
              onClick={handleDownload}
              className="px-2.5 py-1 rounded-xl bg-[#7a1c24] hover:bg-[#5c1319] text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition"
            >
              <Download size={12} /> حفظ
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-40 h-40 shrink-0 rounded-2xl border-2 border-slate-200/80 bg-white p-2 flex items-center justify-center shadow-inner">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt={`Personal Attendance QR - ${displayName}`}
              className="w-full h-full object-contain rounded-xl select-none"
            />
          ) : (
            <span className="text-gray-400 text-[11px] text-center px-1">
              {isGenerating ? 'جاري التوليد...' : 'لا يوجد معرف صالح لتوليد QR'}
            </span>
          )}
        </div>

        <div className="flex-1 space-y-1.5 text-center sm:text-right">
          <div className="flex items-center justify-center sm:justify-start gap-1.5 font-black text-sm text-gray-900">
            <User size={15} className="text-[#7a1c24] shrink-0" />
            <span>{displayName}</span>
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-1.5 text-gray-600">
            <Shield size={13} className="text-emerald-700 shrink-0" />
            <span>{roleText}</span>
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed pt-1">
            اعرض هذا الـ QR من موبايلك عند الدخول لتسجيل <strong>الحضور</strong>، وعند المغادرة لتسجيل <strong>الانصراف</strong>.
          </p>
          {lookupCode && (
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              <span className="px-2.5 py-1 rounded-lg bg-slate-50 border text-slate-700 font-mono text-[11px] break-all">
                {lookupCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
              >
                {copied ? (
                  <Check size={12} className="text-emerald-700" />
                ) : (
                  <Copy size={12} />
                )}
                {copied ? 'تم النسخ' : 'نسخ'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
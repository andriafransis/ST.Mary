import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Download, Copy, Check, Crown, Users, X } from 'lucide-react';

export function buildInvitationQrPayload(invite = {}) {
  const token = String(invite.qr_token || invite.code || invite.id || '').trim();
  return JSON.stringify({
    v: 1,
    type: 'church_invitation',
    attendance_mode: 'check_in',
    token,
    recipient_name: invite.recipient_name || '',
    role_or_title: invite.recipient_role || invite.recipient_type || 'مدعو',
    event_title: invite.event_title || '',
    tier: invite.invite_tier === 'vip' ? 'vip' : 'general',
    seat_or_zone: invite.seat_or_zone || '',
    status: invite.status || 'issued'
  });
}

export default function InvitationQrCard({ invite, invitation, onClose }) {
  const dataInvite = invite || invitation || {};
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const token = String(dataInvite.qr_token || dataInvite.code || dataInvite.id || '').trim();

  useEffect(() => {
    let active = true;
    const payload = buildInvitationQrPayload(dataInvite);
    if (!payload || !token) {
      setQrDataUrl('');
      return;
    }

    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 3,
      width: 360,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [
    token,
    dataInvite.recipient_name,
    dataInvite.recipient_role,
    dataInvite.recipient_type,
    dataInvite.event_title,
    dataInvite.invite_tier,
    dataInvite.seat_or_zone,
    dataInvite.status
  ]);

  const handleCopyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // تجاهل خطأ الحافظة
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR-${token || 'invitation'}.png`;
    link.click();
  };

  const isVip = dataInvite.invite_tier === 'vip';

  const cardBody = (
    <div
      className="bg-white border-2 border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3 w-full max-w-xl"
      dir="rtl"
    >
      {typeof onClose === 'function' && (
        <div className="flex items-center justify-between border-b pb-2.5">
          <span className="text-xs font-black text-[#7a1c24]">بطاقة الدعوة ورمز QR</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer inline-flex items-center gap-1 text-xs font-bold"
          >
            <X size={14} /> إغلاق
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-44 h-44 shrink-0 rounded-2xl border-2 border-slate-900/15 bg-white p-2 flex items-center justify-center shadow-inner">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code ${token}`}
              className="w-full h-full object-contain rounded-xl"
            />
          ) : (
            <div className="text-center text-[11px] text-gray-400 space-y-1">
              <QrCode size={28} className="mx-auto" />
              <span>جاري توليد QR...</span>
            </div>
          )}
        </div>

        <div className="flex-1 w-full space-y-2 text-center sm:text-right">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span
              className={`px-2.5 py-1 rounded-xl text-[11px] font-black inline-flex items-center gap-1 ${
                isVip ? 'bg-amber-400 text-[#4a0e13]' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {isVip ? <Crown size={12} /> : <Users size={12} />}
              {isVip ? 'دعوة VIP' : 'دعوة عامة'}
            </span>
            <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {dataInvite.status === 'checked_in' ? '✅ تم تسجيل الحضور' : '🎟️ صالحة للحضور'}
            </span>
          </div>

          <div>
            <strong className="text-sm font-black text-gray-900 block">
              {dataInvite.recipient_name || 'اسم المدعو'}
            </strong>
            <span className="text-xs text-gray-600 block">
              {dataInvite.recipient_role || dataInvite.recipient_type || 'مدعو'}
              {dataInvite.event_title ? ` • ${dataInvite.event_title}` : ''}
            </span>
            {dataInvite.seat_or_zone && (
              <span className="text-[11px] font-bold text-[#7a1c24] block mt-0.5">
                المكان / المقعد: {dataInvite.seat_or_zone}
              </span>
            )}
          </div>

          <p className="text-[11px] text-gray-500">
            اعرض هذا الـ QR على الخادم عند الدخول لقراءة بياناتك وتسجيل الحضور فوراً.
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
            <span className="px-3 py-1.5 rounded-xl border border-[#7a1c24]/40 bg-[#fdf8f8] text-[#7a1c24] font-mono font-black text-xs">
              {token || 'NO-TOKEN'}
            </span>

            <button
              type="button"
              onClick={handleCopyToken}
              className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check size={13} className="text-emerald-700" /> : <Copy size={13} />}
              {copied ? 'تم النسخ' : 'نسخ الكود'}
            </button>

            {qrDataUrl && (
              <button
                type="button"
                onClick={handleDownloadQr}
                className="px-3 py-1.5 rounded-xl bg-[#7a1c24] hover:bg-[#5c1319] text-white font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
              >
                <Download size={13} /> حفظ QR
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof onClose === 'function') {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
        {cardBody}
      </div>
    );
  }

  return cardBody;
}
import { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Copy,
  Check,
  Crown,
  Users,
  X,
  Printer,
  Calendar,
  MapPin,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

export function buildInvitationQrPayload(invite = {}) {
  return String(invite?.qr_token || invite?.code || invite?.id || '').trim();
}

export default function InvitationQrCard({ invite, invitation, onClose }) {
  const dataInvite = invite || invitation || {};
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const token = buildInvitationQrPayload(dataInvite);
  const isVip = dataInvite.invite_tier === 'vip' || dataInvite.tier === 'vip';
  const isCheckedIn = dataInvite.status === 'checked_in';
  const recipientName = dataInvite.recipient_name || 'اسم المدعو';
  const recipientRole = dataInvite.recipient_role || dataInvite.recipient_type || 'مدعو';
  const eventTitle = dataInvite.event_title || '';
  const seatOrZone = dataInvite.seat_or_zone || '';

  useEffect(() => {
    let active = true;

    if (!token) {
      setQrDataUrl('');
      setQrLoading(false);
      return;
    }

    setQrLoading(true);
    QRCode.toDataURL(token, {
      errorCorrectionLevel: 'M',
      margin: 4,
      width: 420,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (active) {
          setQrDataUrl(url);
          setQrLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setQrDataUrl('');
          setQrLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  const handleCopyToken = useCallback(async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // تجاهل خطأ الحافظة في حال عدم توفر صلاحية النسخ المباشر
    }
  }, [token]);

  const handleDownloadQr = useCallback(() => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR-${token || 'invitation'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [qrDataUrl, token]);

  const handlePrintCard = useCallback(() => {
    if (!qrDataUrl) return;
    const printWin = window.open('', '_blank', 'width=520,height=680');
    if (!printWin) {
      window.print();
      return;
    }

    const safeName = String(recipientName).replace(/</g, '&lt;');
    const safeRole = String(recipientRole).replace(/</g, '&lt;');
    const safeEvent = String(eventTitle).replace(/</g, '&lt;');
    const safeSeat = String(seatOrZone).replace(/</g, '&lt;');
    const safeToken = String(token).replace(/</g, '&lt;');

    printWin.document.write(`
      <!doctype html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>دعوة - ${safeName}</title>
        <style>
          body {
            font-family: Tahoma, Arial, sans-serif;
            background: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 16px;
          }
          .card {
            background: #ffffff;
            border: 2px solid #0f172a;
            border-radius: 20px;
            padding: 24px;
            max-width: 380px;
            width: 100%;
            text-align: center;
          }
          .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 999px;
            font-weight: bold;
            font-size: 12px;
            background: ${isVip ? '#fbbf24' : '#f1f5f9'};
            color: #0f172a;
            margin-bottom: 10px;
          }
          h2 { margin: 6px 0; font-size: 20px; color: #0f172a; }
          .meta { color: #334155; font-size: 13px; margin: 4px 0; }
          .qr-box {
            margin: 16px auto;
            padding: 10px;
            border: 1px solid #cbd5e1;
            border-radius: 14px;
            background: #ffffff;
            width: 220px;
            height: 220px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-box img { width: 100%; height: 100%; object-fit: contain; }
          .token {
            font-family: monospace;
            font-weight: bold;
            font-size: 13px;
            background: #f8fafc;
            border: 1px dashed #64748b;
            padding: 6px 12px;
            border-radius: 8px;
            color: #0f172a;
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">${isVip ? 'دعوة VIP مميزة' : 'دعوة حضور'}</div>
          <h2>${safeName}</h2>
          <div class="meta">${safeRole}${safeEvent ? ` • ${safeEvent}` : ''}</div>
          ${safeSeat ? `<div class="meta"><strong>المكان / المقعد:</strong> ${safeSeat}</div>` : ''}
          <div class="qr-box">
            <img src="${qrDataUrl}" alt="QR Code" />
          </div>
          <div class="token">${safeToken}</div>
        </div>
        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }, [qrDataUrl, recipientName, recipientRole, eventTitle, seatOrZone, token, isVip]);

  const cardBody = (
    <div
      className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 w-full max-w-2xl text-slate-900"
      dir="rtl"
    >
      {/* شريط العنوان */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-2xl bg-[#f9ecee] text-[#7a1c24]">
            <Sparkles size={18} />
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900">
              بطاقة الدعوة ورمز QR
            </h3>
            <p className="text-[11px] text-slate-500">
              جاهزة للعرض على الشاشة أو الحفظ أو الطباعة
            </p>
          </div>
        </div>

        {typeof onClose === 'function' && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer inline-flex items-center gap-1 text-xs font-bold transition"
          >
            <X size={14} /> إغلاق
          </button>
        )}
      </div>

      {/* محتوى البطاقة */}
      <div className="flex flex-col sm:flex-row items-center gap-5">
        {/* صندوق الـ QR */}
        <div className="w-52 h-52 shrink-0 rounded-2xl border-2 border-slate-200 bg-white p-2.5 flex items-center justify-center shadow-sm">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code ${token}`}
              className="w-full h-full object-contain rounded-xl select-none"
            />
          ) : (
            <div className="text-center text-xs text-slate-400 space-y-1.5 px-2">
              <QrCode size={30} className="mx-auto text-slate-300" />
              <span>
                {qrLoading
                  ? 'جاري توليد رمز QR...'
                  : 'لا يوجد كود صالح لتوليد رمز QR'}
              </span>
            </div>
          )}
        </div>

        {/* تفاصيل الدعوة */}
        <div className="flex-1 w-full space-y-3 text-center sm:text-right">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span
              className={`px-3 py-1 rounded-xl text-xs font-black inline-flex items-center gap-1 ${
                isVip
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {isVip ? <Crown size={13} /> : <Users size={13} />}
              {isVip ? 'دعوة VIP' : 'دعوة عامة'}
            </span>

            <span
              className={`px-3 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1 border ${
                isCheckedIn
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-sky-50 text-sky-800 border-sky-200'
              }`}
            >
              <ShieldCheck size={13} />
              {isCheckedIn ? 'تم تسجيل الحضور' : 'صالحة للدخول'}
            </span>
          </div>

          <div className="space-y-1">
            <strong className="text-base sm:text-lg font-black text-slate-950 block">
              {recipientName}
            </strong>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-xs text-slate-600 font-medium">
              <span>{recipientRole}</span>
              {eventTitle && (
                <span className="inline-flex items-center gap-1">
                  <Calendar size={12} className="text-[#7a1c24]" />
                  {eventTitle}
                </span>
              )}
            </div>

            {seatOrZone && (
              <div className="inline-flex items-center gap-1 text-xs font-bold text-[#7a1c24] bg-[#fdf6f7] px-2.5 py-1 rounded-lg mt-1">
                <MapPin size={13} />
                <span>المكان / المقعد: {seatOrZone}</span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            وجّه رمز QR نحو الكاميرا عند الوصول للتحقق السريع وتسجيل الحضور تلقائياً.
          </p>

          {/* الكود وأزرار الإجراءات */}
          <div className="space-y-2 pt-1">
            <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold text-xs break-all select-all">
              {token || 'NO-TOKEN'}
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <button
                type="button"
                onClick={handleCopyToken}
                disabled={!token}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                {copied ? (
                  <Check size={14} className="text-emerald-700" />
                ) : (
                  <Copy size={14} />
                )}
                {copied ? 'تم النسخ' : 'نسخ الكود'}
              </button>

              {qrDataUrl && (
                <>
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="px-3 py-2 rounded-xl bg-[#7a1c24] hover:bg-[#5c1319] text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Download size={14} /> حفظ QR
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintCard}
                    className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Printer size={14} /> طباعة البطاقة
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof onClose === 'function') {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[1px] flex items-center justify-center p-4">
        {cardBody}
      </div>
    );
  }

  return cardBody;
}
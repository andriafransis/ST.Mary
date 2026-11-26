import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { ScanLine, CheckCircle2, AlertTriangle, XCircle, Crown, Users, Search } from 'lucide-react';

export default function InvitationScannerModal({ currentUser, onClose }) {
  const scannerRef = useRef(null);
  const isProcessingRef = useRef(false);

  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { kind: 'success' | 'warning' | 'error', title, message, invite }
  const [recentLogs, setRecentLogs] = useState([]);

  const extractToken = (rawText = '') => {
    const trimmed = String(rawText || '').trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.token) return String(parsed.token).trim();
    } catch {
      // ليس JSON — نتعامل معه ككود نصي مباشر
    }
    return trimmed;
  };

  const processToken = async (rawValue) => {
    const token = extractToken(rawValue);
    if (!token || isProcessingRef.current) return;

    isProcessingRef.current = true;
    try {
      const { data: invite, error } = await supabase
        .from('church_invitations')
        .select('*')
        .eq('qr_token', token)
        .maybeSingle();

      if (error || !invite) {
        setScanResult({
          kind: 'error',
          title: 'دعوة غير موجودة',
          message: `لم يتم العثور على دعوة بالكود (${token}).`
        });
        return;
      }

      if (invite.status === 'checked_in') {
        setScanResult({
          kind: 'warning',
          title: 'تم مسح هذه الدعوة مسبقاً',
          message: `تم تسجيل دخول (${invite.recipient_name}) من قبل${
            invite.checked_in_at ? ` في ${new Date(invite.checked_in_at).toLocaleTimeString('ar-EG')}` : ''
          }.`,
          invite
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const { data: updated, error: updErr } = await supabase
        .from('church_invitations')
        .update({
          status: 'checked_in',
          checked_in_at: nowIso,
          checked_in_by: currentUser?.full_name || 'كشاف / خادم'
        })
        .eq('id', invite.id)
        .select()
        .single();

      if (updErr) {
        setScanResult({
          kind: 'error',
          title: 'تعذر تحديث حالة الدخول',
          message: updErr.message
        });
        return;
      }

      setScanResult({
        kind: 'success',
        title: 'تم التحقق وتسجيل الدخول بنجاح',
        message: invite.seat_or_zone
          ? `توجيه المدعو إلى: ${invite.seat_or_zone}`
          : 'الدعوة صالحة وتم تسجيل الحضور.',
        invite: updated || { ...invite, status: 'checked_in', checked_in_at: nowIso }
      });

      setRecentLogs((prev) => [updated || invite, ...prev.slice(0, 9)]);
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 1200);
    }
  };

  useEffect(() => {
    const readerId = 'church-qr-scanner-box';
    const html5QrCode = new Html5Qrcode(readerId);
    scannerRef.current = html5QrCode;

    html5QrCode
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (decodedText) => {
          processToken(decodedText);
        },
        () => {}
      )
      .then(() => setScanning(true))
      .catch(() => setScanning(false));

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await processToken(manualCode.trim());
    setManualCode('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-5 space-y-4 text-xs max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 text-[#7a1c24]">
            <ScanLine size={20} />
            <div>
              <h3 className="text-base font-black">سكان QR للدعوات (كشاف / خادم)</h3>
              <p className="text-[11px] text-gray-500">وجّه الكاميرا نحو كود الدعوة للتحقق من الفئة والمكان</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold cursor-pointer"
          >
            إغلاق
          </button>
        </div>

        {/* منطقة الكاميرا */}
        <div className="bg-slate-950 rounded-2xl overflow-hidden min-h-[240px] flex items-center justify-center relative">
          <div id="church-qr-scanner-box" className="w-full" />
          {!scanning && (
            <span className="text-slate-300 text-xs p-4 text-center">
              جاري تشغيل الكاميرا... (يمكنك أيضاً إدخال كود الدعوة يدوياً بالأسفل)
            </span>
          )}
        </div>

        {/* إدخال يدوي احتياطي */}
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute right-3 top-3 text-gray-400" />
            <input
              placeholder="إدخال كود الدعوة يدوياً (مثال: INV-...)"
              className="w-full pr-9 pl-3 py-2.5 border rounded-xl text-xs font-bold"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer shrink-0"
          >
            تحقق
          </button>
        </form>

        {/* نتيجة المسح */}
        {scanResult && (
          <div
            className={`p-4 rounded-2xl border-2 space-y-2 ${
              scanResult.kind === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : scanResult.kind === 'warning'
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-red-50 border-red-300 text-red-950'
            }`}
          >
            <div className="flex items-center gap-2 font-black text-sm">
              {scanResult.kind === 'success' && <CheckCircle2 size={18} className="text-emerald-700" />}
              {scanResult.kind === 'warning' && <AlertTriangle size={18} className="text-amber-700" />}
              {scanResult.kind === 'error' && <XCircle size={18} className="text-red-700" />}
              <span>{scanResult.title}</span>
            </div>
            <p className="font-bold">{scanResult.message}</p>

            {scanResult.invite && (
              <div className="bg-white/90 rounded-xl p-3 border flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong className="text-gray-900 block text-sm">{scanResult.invite.recipient_name}</strong>
                  <span className="text-gray-600">{scanResult.invite.event_title}</span>
                </div>
                <span
                  className={`px-3 py-1 rounded-xl font-black flex items-center gap-1 ${
                    scanResult.invite.invite_tier === 'vip'
                      ? 'bg-amber-400 text-[#4a0e13]'
                      : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {scanResult.invite.invite_tier === 'vip' ? <Crown size={13} /> : <Users size={13} />}
                  {scanResult.invite.invite_tier === 'vip' ? 'VIP' : 'عام'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* آخر من تم مسحهم في الجلسة */}
        {recentLogs.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <strong className="text-gray-700 block">آخر من تم تسجيل دخولهم الآن:</strong>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {recentLogs.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-[#fbfaf7] border px-3 py-2 rounded-xl"
                >
                  <span className="font-bold text-gray-900">{item.recipient_name}</span>
                  <span className="text-[11px] text-emerald-700 font-black">
                    {item.invite_tier === 'vip' ? '👑 VIP' : 'عام'} • {item.seat_or_zone || 'تم الدخول'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
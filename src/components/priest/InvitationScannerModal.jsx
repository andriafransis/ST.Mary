import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../../lib/supabase';
import {
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Crown,
  Users,
  Search,
  RefreshCw,
  SwitchCamera,
  Clock,
  UserCheck,
  ShieldCheck,
  Volume2,
  VolumeX
} from 'lucide-react';

const ROLE_AR_LABELS = {
  admin: 'سوبر أدمن',
  priest: 'أب كاهن',
  head_servant: 'أمين الخدمة',
  vice_head_servant: 'مساعد أمين الخدمة',
  servant: 'خادم مرحلة',
  meeting_servant: 'خادم اجتماع',
  mercy_servant: 'خادم إخوة رب',
  member: 'مخدوم',
  parent: 'ولي أمر',
  worker: 'عامل / فراش'
};

function formatDateTimeAr(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function playFeedbackTone(kind = 'success', enabled = true) {
  if (!enabled) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(kind === 'success' ? [80] : [120, 60, 120]);
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === 'success' ? 'sine' : 'triangle';
    osc.frequency.value = kind === 'success' ? 880 : 320;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.19);
    setTimeout(() => ctx.close().catch(() => {}), 250);
  } catch {
    // تجاهل في حال منع الصوت من المتصفح
  }
}

export default function InvitationScannerModal({ currentUser, onClose }) {
  const scannerRef = useRef(null);
  const isProcessingRef = useRef(false);
  const isStartingRef = useRef(false);
  const soundEnabledRef = useRef(true);

  const [manualCode, setManualCode] = useState('');
  const [cameraStatus, setCameraStatus] = useState('starting'); // 'starting' | 'active' | 'error'
  const [cameraErrorMsg, setCameraErrorMsg] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const scannerDisplayName =
    currentUser?.full_name ||
    currentUser?.name ||
    currentUser?.username ||
    'مستخدم غير مسجل';

  const scannerRoleLabel =
    currentUser?.permissions?.custom_role_label ||
    ROLE_AR_LABELS[currentUser?.role] ||
    currentUser?.role ||
    'مستخدم';

  const extractToken = (rawText = '') => {
    const trimmed = String(rawText || '').trim();
    if (!trimmed) return '';
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.qr_token) return String(parsed.qr_token).trim();
      if (parsed?.token) return String(parsed.token).trim();
      if (parsed?.code) return String(parsed.code).trim();
    } catch {
      // كود نصي مباشر
    }
    const urlMatch = trimmed.match(/[?&](?:token|qr|code)=([^&#]+)/i);
    if (urlMatch?.[1]) {
      return decodeURIComponent(urlMatch[1]).trim();
    }
    return trimmed;
  };

  const applyContinuousFocusIfSupported = async (html5QrCode) => {
    try {
      const state = html5QrCode.getState?.();
      if (state !== 2) return;
      const videoEl = document.querySelector('#church-qr-scanner-box video');
      const track = videoEl?.srcObject?.getVideoTracks?.()?.[0];
      if (!track || typeof track.getCapabilities !== 'function') return;
      const caps = track.getCapabilities();
      const advanced = [];
      if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      }
      if (caps.zoom && typeof caps.zoom.min === 'number') {
        const targetZoom = Math.min(caps.zoom.max || 1, Math.max(caps.zoom.min, 1));
        if (targetZoom > 1) advanced.push({ zoom: targetZoom });
      }
      if (advanced.length > 0 && typeof track.applyConstraints === 'function') {
        await track.applyConstraints({ advanced }).catch(() => {});
      }
    } catch {
      // بعض الأجهزة لا تدعم قيود الكاميرا الإضافية
    }
  };

  const stopScannerSafe = useCallback(async () => {
    const inst = scannerRef.current;
    if (!inst) return;
    try {
      if (inst.isScanning) {
        await inst.stop();
      }
    } catch {
      // تجاهل خطأ الإيقاف
    }
    try {
      await inst.clear();
    } catch {
      // تجاهل خطأ التنظيف
    }
  }, []);

  const startScanner = useCallback(
    async (targetFacing = facingMode) => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;
      setCameraStatus('starting');
      setCameraErrorMsg('');

      try {
        await stopScannerSafe();

        const readerId = 'church-qr-scanner-box';
        const containerEl = document.getElementById(readerId);
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const html5QrCode = new Html5Qrcode(readerId, { verbose: false });
        scannerRef.current = html5QrCode;

        const boxSize = Math.min(
          270,
          Math.max(190, Math.floor((containerEl.clientWidth || 320) * 0.72))
        );

        await html5QrCode.start(
          { facingMode: targetFacing },
          {
            fps: 15,
            qrbox: { width: boxSize, height: boxSize },
            aspectRatio: 1.333333,
            disableFlip: false
          },
          (decodedText) => {
            processToken(decodedText);
          },
          () => {}
        );

        setCameraStatus('active');
        setTimeout(() => {
          applyContinuousFocusIfSupported(html5QrCode);
        }, 400);
      } catch (err) {
        setCameraStatus('error');
        setCameraErrorMsg(
          err?.message ||
            'تعذر تشغيل الكاميرا أو لم يتم السماح بالوصول إليها. يمكنك استخدام الإدخال اليدوي بالأسفل.'
        );
      } finally {
        isStartingRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facingMode, stopScannerSafe]
  );

  useEffect(() => {
    startScanner(facingMode);
    return () => {
      stopScannerSafe();
    };
  }, [facingMode, startScanner, stopScannerSafe]);

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
        playFeedbackTone('error', soundEnabledRef.current);
        setScanResult({
          kind: 'error',
          title: 'دعوة غير موجودة أو كود غير صحيح',
          message: `لم يتم العثور على دعوة بالكود (${token}).`,
          scannedAt: new Date().toISOString(),
          scannedBy: scannerDisplayName,
          scannedByRole: scannerRoleLabel
        });
        return;
      }

      if (invite.status === 'checked_in') {
        playFeedbackTone('warning', soundEnabledRef.current);
        setScanResult({
          kind: 'warning',
          title: 'تم مسح هذه الدعوة مسبقاً',
          message: `تم تسجيل دخول (${invite.recipient_name}) مسبقاً${
            invite.checked_in_at ? ` في (${formatDateTimeAr(invite.checked_in_at)})` : ''
          }${invite.checked_in_by ? ` بواسطة (${invite.checked_in_by})` : ''}.`,
          invite,
          scannedAt: invite.checked_in_at || new Date().toISOString(),
          scannedBy: invite.checked_in_by || scannerDisplayName,
          scannedByRole: invite.checked_in_by_role || scannerRoleLabel
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const actorLabel = `${scannerDisplayName} (${scannerRoleLabel})`;

      const baseUpdatePayload = {
        status: 'checked_in',
        checked_in_at: nowIso,
        checked_in_by: actorLabel
      };

      const extendedUpdatePayload = {
        ...baseUpdatePayload,
        checked_in_by_id: currentUser?.id || null,
        checked_in_by_name: scannerDisplayName,
        checked_in_by_role: scannerRoleLabel
      };

      let updatedRow = null;
      let updErr = null;

      const firstAttempt = await supabase
        .from('church_invitations')
        .update(extendedUpdatePayload)
        .eq('id', invite.id)
        .select()
        .single();

      if (firstAttempt.error) {
        const secondAttempt = await supabase
          .from('church_invitations')
          .update(baseUpdatePayload)
          .eq('id', invite.id)
          .select()
          .single();
        updatedRow = secondAttempt.data;
        updErr = secondAttempt.error;
      } else {
        updatedRow = firstAttempt.data;
      }

      if (updErr) {
        playFeedbackTone('error', soundEnabledRef.current);
        setScanResult({
          kind: 'error',
          title: 'تعذر تحديث حالة الدخول في قاعدة البيانات',
          message: updErr.message,
          scannedAt: nowIso,
          scannedBy: scannerDisplayName,
          scannedByRole: scannerRoleLabel
        });
        return;
      }

      const finalInvite = {
        ...(updatedRow || invite),
        status: 'checked_in',
        checked_in_at: updatedRow?.checked_in_at || nowIso,
        checked_in_by: updatedRow?.checked_in_by || actorLabel,
        checked_in_by_name: updatedRow?.checked_in_by_name || scannerDisplayName,
        checked_in_by_role: updatedRow?.checked_in_by_role || scannerRoleLabel
      };

      playFeedbackTone('success', soundEnabledRef.current);
      setScanResult({
        kind: 'success',
        title: 'تم التحقق وتسجيل الحضور بنجاح ✅',
        message: finalInvite.seat_or_zone
          ? `توجيه المدعو إلى: ${finalInvite.seat_or_zone}`
          : 'الدعوة صالحة وتم تسجيل وقت الحضور ومن قام بالمسح.',
        invite: finalInvite,
        scannedAt: finalInvite.checked_in_at,
        scannedBy: scannerDisplayName,
        scannedByRole: scannerRoleLabel
      });

      setRecentLogs((prev) => [finalInvite, ...prev.slice(0, 14)]);
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 1100);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualCode.trim() || submittingManual) return;
    setSubmittingManual(true);
    try {
      await processToken(manualCode.trim());
      setManualCode('');
    } finally {
      setSubmittingManual(false);
    }
  };

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-4"
      dir="rtl"
    >
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-4 sm:p-5 space-y-4 text-xs max-h-[94vh] overflow-y-auto">
        {/* الهيدر وبيانات الشخص الذي يقوم بالمسح الآن */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2.5 text-[#7a1c24]">
            <div className="p-2.5 rounded-2xl bg-[#f9ecee]">
              <ScanLine size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black">مسح QR الدعوات وتسجيل الحضور</h3>
              <p className="text-[11px] text-gray-500 flex items-center gap-1 flex-wrap mt-0.5">
                <UserCheck size={12} className="text-emerald-700" />
                <span>القائم بالمسح:</span>
                <strong className="text-gray-900">{scannerDisplayName}</strong>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                  {scannerRoleLabel}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              title={soundEnabled ? 'كتم الصوت' : 'تفعيل الصوت'}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer text-gray-700"
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>

        {/* أزرار التحكم في الكاميرا والفوكس */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-2xl border">
          <span className="text-[11px] font-bold text-slate-700">
            الكاميرا الحالية:{' '}
            <strong className="text-[#7a1c24]">
              {facingMode === 'environment' ? 'الخلفية' : 'الأمامية'}
            </strong>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="px-2.5 py-1.5 bg-white hover:bg-gray-100 border rounded-xl font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <SwitchCamera size={13} /> تبديل الكاميرا
            </button>
            <button
              type="button"
              onClick={() => startScanner(facingMode)}
              className="px-2.5 py-1.5 bg-white hover:bg-gray-100 border rounded-xl font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={13} /> إعادة ضبط / فوكس
            </button>
          </div>
        </div>

        {/* منطقة الكاميرا — مملوءة بالكامل بدون تقسيم أسود */}
        <div className="bg-slate-950 rounded-2xl overflow-hidden relative border border-slate-800">
          <div
            id="church-qr-scanner-box"
            className="w-full [&>video]:w-full [&>video]:h-[270px] [&>video]:object-cover [&>canvas]:hidden"
          />

          {cameraStatus === 'active' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-52 h-52 border-2 border-emerald-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(2,6,23,0.35)] relative">
                <span className="absolute -bottom-7 inset-x-0 text-center text-[11px] font-bold text-white drop-shadow">
                  ضع رمز الـ QR داخل الإطار
                </span>
              </div>
            </div>
          )}

          {cameraStatus !== 'active' && (
            <div className="min-h-[250px] flex flex-col items-center justify-center p-5 text-center space-y-2">
              <span className="text-slate-200 text-xs font-bold">
                {cameraStatus === 'starting'
                  ? 'جاري تشغيل الكاميرا وضبط التركيز...'
                  : cameraErrorMsg}
              </span>
              {cameraStatus === 'error' && (
                <button
                  type="button"
                  onClick={() => startScanner(facingMode)}
                  className="px-3.5 py-1.5 bg-white text-slate-900 rounded-xl font-black text-xs cursor-pointer"
                >
                  إعادة محاولة تشغيل الكاميرا
                </button>
              )}
            </div>
          )}
        </div>

        {/* إدخال يدوي احتياطي */}
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute right-3 top-3 text-gray-400" />
            <input
              placeholder="إدخال أو لصق كود الدعوة يدوياً (مثال: INV-...)"
              className="w-full pr-9 pl-3 py-2.5 border rounded-xl text-xs font-bold focus:outline-none focus:border-[#7a1c24]"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={submittingManual}
            className="px-4 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer shrink-0 disabled:opacity-60"
          >
            {submittingManual ? 'جاري التحقق...' : 'تسجيل دخول'}
          </button>
        </form>

        {/* نتيجة المسح وتفاصيل الوقت ومن قام بالمسح */}
        {scanResult && (
          <div
            className={`p-4 rounded-2xl border-2 space-y-2.5 ${
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
              <div className="bg-white/95 rounded-xl p-3 border space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <strong className="text-gray-900 block text-sm">
                      {scanResult.invite.recipient_name}
                    </strong>
                    <span className="text-gray-600">{scanResult.invite.event_title}</span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-xl font-black flex items-center gap-1 ${
                      scanResult.invite.invite_tier === 'vip'
                        ? 'bg-amber-400 text-[#4a0e13]'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {scanResult.invite.invite_tier === 'vip' ? (
                      <Crown size={13} />
                    ) : (
                      <Users size={13} />
                    )}
                    {scanResult.invite.invite_tier === 'vip' ? 'VIP' : 'عام'}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t text-[11px] text-gray-700">
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-[#7a1c24] shrink-0" />
                    <span>
                      وقت الحضور / الـ Scan:{' '}
                      <strong className="text-gray-900">
                        {formatDateTimeAr(scanResult.invite.checked_in_at || scanResult.scannedAt)}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-emerald-700 shrink-0" />
                    <span>
                      تم المسح بواسطة:{' '}
                      <strong className="text-gray-900">
                        {scanResult.invite.checked_in_by ||
                          `${scanResult.scannedBy} (${scanResult.scannedByRole})`}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* سجل الحضور والـ Scan في الجلسة الحالية */}
        {recentLogs.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <strong className="text-gray-800 block">
              سجل من تم تسجيل دخولهم في هذه الجلسة ({recentLogs.length}):
            </strong>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {recentLogs.map((item) => (
                <div
                  key={`${item.id}-${item.checked_in_at}`}
                  className="flex flex-wrap items-center justify-between gap-2 bg-[#fbfaf7] border px-3 py-2 rounded-xl"
                >
                  <div>
                    <span className="font-black text-gray-900 block">
                      {item.recipient_name}{' '}
                      <span className="text-[10px] font-bold text-gray-500">
                        ({item.invite_tier === 'vip' ? '👑 VIP' : 'عام'}
                        {item.seat_or_zone ? ` • ${item.seat_or_zone}` : ''})
                      </span>
                    </span>
                    <span className="text-[10px] text-gray-600 block">
                      بواسطة: <strong>{item.checked_in_by || scannerDisplayName}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-800 font-black bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                    {formatDateTimeAr(item.checked_in_at)}
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
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
  VolumeX,
  LogIn,
  LogOut,
  Ticket,
  ImagePlus
} from 'lucide-react';

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
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
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

export function parseQrContent(rawText = '') {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return { kind: 'empty', token: '', memberInfo: null, embedded: null };

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      if (parsed.type === 'church_member_attendance' || parsed.user_id || parsed.username) {
        return {
          kind: 'member',
          token: String(parsed.user_id || parsed.username || '').trim(),
          memberInfo: {
            user_id: parsed.user_id || '',
            username: parsed.username || '',
            full_name: parsed.full_name || '',
            role: parsed.role || 'member',
            role_label: parsed.role_label || ''
          },
          embedded: null
        };
      }

      const token = String(parsed.token || parsed.qr_token || parsed.code || parsed.id || '').trim();
      return {
        kind: 'invitation',
        token,
        memberInfo: null,
        embedded: {
          recipient_name: parsed.recipient_name || '',
          recipient_role: parsed.role_or_title || parsed.recipient_role || '',
          event_title: parsed.event_title || '',
          invite_tier: parsed.tier === 'vip' ? 'vip' : 'general',
          seat_or_zone: parsed.seat_or_zone || '',
          attendance_mode: parsed.attendance_mode || 'check_in',
          raw_status: parsed.status || ''
        }
      };
    }
  } catch {
    // نص مباشر أو رابط
  }

  const urlMatch = trimmed.match(/[?&](?:token|qr|code|user)=([^&#]+)/i);
  if (urlMatch?.[1]) {
    const extracted = decodeURIComponent(urlMatch[1]).trim();
    return {
      kind: 'unknown',
      token: extracted,
      memberInfo: { user_id: extracted, username: extracted, full_name: '' },
      embedded: null
    };
  }

  return {
    kind: 'unknown',
    token: trimmed,
    memberInfo: { user_id: trimmed, username: trimmed, full_name: '' },
    embedded: null
  };
}

export default function InvitationScannerModal({
  currentUser,
  onClose,
  initialTab = 'invitations'
}) {
  const scannerRef = useRef(null);
  const isProcessingRef = useRef(false);
  const isStartingRef = useRef(false);
  const lastRawRef = useRef({ text: '', at: 0 });
  const soundEnabledRef = useRef(true);
  const activeTabRef = useRef(initialTab);
  const attendanceModeRef = useRef('auto');

  const [activeTab, setActiveTab] = useState(initialTab); // 'invitations' | 'attendance'
  const [attendanceMode, setAttendanceMode] = useState('auto'); // 'auto' | 'check_in' | 'check_out'
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

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    attendanceModeRef.current = attendanceMode;
  }, [attendanceMode]);

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

  const actorLabel = `${scannerDisplayName} (${scannerRoleLabel})`;

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
      if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
        advanced.push({ exposureMode: 'continuous' });
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

        const html5QrCode = new Html5Qrcode(readerId, {
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        });
        scannerRef.current = html5QrCode;

        const containerW = containerEl.clientWidth || 340;
        const boxSize = Math.min(310, Math.max(220, Math.floor(containerW * 0.82)));

        await html5QrCode.start(
          {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          {
            fps: 22,
            qrbox: { width: boxSize, height: boxSize },
            disableFlip: false
          },
          (decodedText) => {
            const cleaned = String(decodedText || '').trim();
            if (!cleaned) return;
            const now = Date.now();
            if (lastRawRef.current.text === cleaned && now - lastRawRef.current.at < 1200) {
              return;
            }
            lastRawRef.current = { text: cleaned, at: now };
            processAnyScan(cleaned);
          },
          () => {}
        );

        setCameraStatus('active');
        setTimeout(() => {
          applyContinuousFocusIfSupported(html5QrCode);
        }, 300);
      } catch (err) {
        setCameraStatus('error');
        setCameraErrorMsg(
          err?.message ||
            'تعذر تشغيل الكاميرا أو لم يتم السماح بالوصول إليها. يمكنك استخدام قراءة صورة أو الإدخال اليدوي.'
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

  const handleScanImageFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !scannerRef.current) return;

    try {
      const decodedText = await scannerRef.current.scanFile(file, true);
      if (decodedText) {
        await processAnyScan(decodedText);
      }
    } catch {
      playFeedbackTone('error', soundEnabledRef.current);
      setScanResult({
        kind: 'error',
        title: 'تعذر قراءة كود QR من الصورة',
        message: 'حاول التقاط صورة أوضح للـ QR بدون انعكاس إضاءة قوي على الشاشة.'
      });
    }
  };

  const handleInvitationScan = async (token, embedded) => {
    const { data: invite, error } = await supabase
      .from('church_invitations')
      .select('*')
      .or(`qr_token.eq.${token},id.eq.${token}`)
      .maybeSingle();

    if (error || !invite) {
      playFeedbackTone('error', soundEnabledRef.current);
      setScanResult({
        kind: 'error',
        title: embedded?.recipient_name
          ? `كود غير مسجل في قاعدة البيانات (${embedded.recipient_name})`
          : 'دعوة غير موجودة أو كود غير صحيح',
        message: `لم يتم العثور على دعوة بالكود (${token}) في سجل الدعوات.`,
        embedded,
        scannedAt: new Date().toISOString(),
        scannedBy: scannerDisplayName,
        scannedByRole: scannerRoleLabel
      });
      return;
    }

    const mergedInvitePreview = {
      ...invite,
      recipient_name: invite.recipient_name || embedded?.recipient_name || 'مدعو',
      recipient_role: invite.recipient_role || embedded?.recipient_role || '',
      event_title: invite.event_title || embedded?.event_title || '',
      invite_tier: invite.invite_tier || embedded?.invite_tier || 'general',
      seat_or_zone: invite.seat_or_zone || embedded?.seat_or_zone || ''
    };

    if (invite.status === 'checked_in') {
      playFeedbackTone('warning', soundEnabledRef.current);
      setScanResult({
        kind: 'warning',
        title: 'تم مسح هذه الدعوة مسبقاً',
        message: `تم تسجيل دخول (${mergedInvitePreview.recipient_name}) مسبقاً${
          invite.checked_in_at ? ` في (${formatDateTimeAr(invite.checked_in_at)})` : ''
        }${invite.checked_in_by ? ` بواسطة (${invite.checked_in_by})` : ''}.`,
        invite: mergedInvitePreview,
        embedded,
        scannedAt: invite.checked_in_at || new Date().toISOString(),
        scannedBy: invite.checked_in_by || scannerDisplayName,
        scannedByRole: invite.checked_in_by_role || scannerRoleLabel
      });
      return;
    }

    const nowIso = new Date().toISOString();
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
        invite: mergedInvitePreview,
        embedded,
        scannedAt: nowIso,
        scannedBy: scannerDisplayName,
        scannedByRole: scannerRoleLabel
      });
      return;
    }

    const finalInvite = {
      ...mergedInvitePreview,
      ...(updatedRow || {}),
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
        : 'الدعوة صالحة وتم تسجيل وقت الحضور وبيانات من قام بالمسح.',
      invite: finalInvite,
      embedded,
      scannedAt: finalInvite.checked_in_at,
      scannedBy: scannerDisplayName,
      scannedByRole: scannerRoleLabel
    });

    setRecentLogs((prev) => [
      {
        id: `inv-${finalInvite.id}-${finalInvite.checked_in_at}`,
        title: finalInvite.recipient_name,
        subtitle: `${finalInvite.invite_tier === 'vip' ? '👑 VIP' : 'عام'}${
          finalInvite.seat_or_zone ? ` • ${finalInvite.seat_or_zone}` : ''
        } • بواسطة: ${finalInvite.checked_in_by || actorLabel}`,
        badge: 'حضور دعوة',
        timeLabel: formatDateTimeAr(finalInvite.checked_in_at)
      },
      ...prev.slice(0, 14)
    ]);
  };

  const handleMemberAttendanceScan = async (memberInfo, token) => {
    const userId = String(memberInfo?.user_id || '').trim();
    const username = String(memberInfo?.username || '').trim();
    const lookupKey = userId || username || token;

    if (!lookupKey) {
      playFeedbackTone('error', soundEnabledRef.current);
      setScanResult({
        kind: 'error',
        title: 'كود حضور غير واضح',
        message: 'لم يتم العثور على بيانات الخادم أو المخدوم داخل الـ QR.'
      });
      return;
    }

    let memberQuery = supabase.from('church_users').select('*');
    if (userId && username) {
      memberQuery = memberQuery.or(`id.eq.${userId},username.eq.${username}`);
    } else if (userId) {
      memberQuery = memberQuery.or(`id.eq.${userId},username.eq.${userId}`);
    } else {
      memberQuery = memberQuery.eq('username', username);
    }

    const { data: member, error: memberErr } = await memberQuery.maybeSingle();

    if (memberErr || !member) {
      playFeedbackTone('error', soundEnabledRef.current);
      setScanResult({
        kind: 'error',
        title: 'حساب غير موجود في قاعدة البيانات',
        message: `لم يتم العثور على خادم أو مخدوم مطابق للكود (${lookupKey}).`
      });
      return;
    }

    const memberName =
      member.full_name || member.name || member.username || memberInfo?.full_name || 'عضو';
    const memberRoleLabel =
      member.permissions?.custom_role_label ||
      ROLE_AR_LABELS[member.role] ||
      member.role ||
      memberInfo?.role_label ||
      'عضو';

    const now = new Date();
    const nowIso = now.toISOString();
    const todayStr = nowIso.slice(0, 10);
    const mode = attendanceModeRef.current;

    const { data: openLog } = await supabase
      .from('church_attendance_logs')
      .select('*')
      .eq('user_id', String(member.id))
      .eq('attendance_date', todayStr)
      .is('checked_out_at', null)
      .order('checked_in_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const doCheckOut = mode === 'check_out' || (mode === 'auto' && Boolean(openLog));

    if (!doCheckOut && openLog?.checked_in_at) {
      const diffSec = (now.getTime() - new Date(openLog.checked_in_at).getTime()) / 1000;
      if (diffSec < 25) {
        playFeedbackTone('warning', soundEnabledRef.current);
        setScanResult({
          kind: 'warning',
          title: 'تم تسجيل الحضور للتو',
          message: `تم تسجيل حضور (${memberName}) بالفعل منذ ثوانٍ في ${formatDateTimeAr(openLog.checked_in_at)}.`,
          scannedAt: openLog.checked_in_at,
          scannedBy: openLog.checked_in_by || actorLabel
        });
        return;
      }
    }

    if (doCheckOut) {
      if (!openLog?.id) {
        playFeedbackTone('warning', soundEnabledRef.current);
        setScanResult({
          kind: 'warning',
          title: 'لا يوجد تسجيل حضور مفتوح اليوم',
          message: `يجب تسجيل حضور (${memberName}) أولاً قبل تسجيل الانصراف.`
        });
        return;
      }

      const { data: updatedLog, error: outErr } = await supabase
        .from('church_attendance_logs')
        .update({
          checked_out_at: nowIso,
          checked_out_by: actorLabel,
          status: 'checked_out'
        })
        .eq('id', openLog.id)
        .select()
        .single();

      if (outErr) {
        playFeedbackTone('error', soundEnabledRef.current);
        setScanResult({
          kind: 'error',
          title: 'تعذر تسجيل الانصراف',
          message: outErr.message
        });
        return;
      }

      playFeedbackTone('success', soundEnabledRef.current);
      setScanResult({
        kind: 'success',
        title: 'تم تسجيل الانصراف بنجاح 👋',
        message: `انصرف (${memberName}) — ${memberRoleLabel} — في ${formatDateTimeAr(nowIso)} بواسطة ${actorLabel}.`,
        scannedAt: nowIso,
        scannedBy: actorLabel
      });

      setRecentLogs((prev) => [
        {
          id: `att-out-${updatedLog.id}-${nowIso}`,
          title: `${memberName} (${memberRoleLabel})`,
          subtitle: `انصراف • بواسطة: ${actorLabel}`,
          badge: 'انصراف',
          timeLabel: formatDateTimeAr(nowIso)
        },
        ...prev.slice(0, 14)
      ]);
      return;
    }

    const { data: createdLog, error: inErr } = await supabase
      .from('church_attendance_logs')
      .insert([
        {
          user_id: String(member.id),
          full_name: memberName,
          role: member.role || 'member',
          attendance_date: todayStr,
          checked_in_at: nowIso,
          checked_in_by: actorLabel,
          status: 'checked_in'
        }
      ])
      .select()
      .single();

    if (inErr) {
      playFeedbackTone('error', soundEnabledRef.current);
      setScanResult({
        kind: 'error',
        title: 'تعذر تسجيل الحضور',
        message: inErr.message
      });
      return;
    }

    playFeedbackTone('success', soundEnabledRef.current);
    setScanResult({
      kind: 'success',
      title: 'تم تسجيل الحضور بنجاح ✅',
      message: `حضر (${memberName}) — ${memberRoleLabel} — في ${formatDateTimeAr(nowIso)} بواسطة ${actorLabel}.`,
      scannedAt: nowIso,
      scannedBy: actorLabel
    });

    setRecentLogs((prev) => [
      {
        id: `att-in-${createdLog.id}-${nowIso}`,
        title: `${memberName} (${memberRoleLabel})`,
        subtitle: `حضور • بواسطة: ${actorLabel}`,
        badge: 'حضور',
        timeLabel: formatDateTimeAr(nowIso)
      },
      ...prev.slice(0, 14)
    ]);
  };

  const processAnyScan = async (rawValue) => {
    const parsed = parseQrContent(rawValue);
    if (!parsed.token || isProcessingRef.current) return;

    isProcessingRef.current = true;
    try {
      if (parsed.kind === 'member') {
        await handleMemberAttendanceScan(parsed.memberInfo, parsed.token);
        return;
      }
      if (parsed.kind === 'invitation') {
        await handleInvitationScan(parsed.token, parsed.embedded);
        return;
      }

      if (activeTabRef.current === 'attendance') {
        await handleMemberAttendanceScan(parsed.memberInfo, parsed.token);
      } else {
        await handleInvitationScan(parsed.token, parsed.embedded);
      }
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 900);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualCode.trim() || submittingManual) return;
    setSubmittingManual(true);
    try {
      await processAnyScan(manualCode.trim());
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
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2.5 text-[#7a1c24]">
            <div className="p-2.5 rounded-2xl bg-[#f9ecee]">
              <ScanLine size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black">
                سكان QR للدعوات والحضور والانصراف
              </h3>
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

        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('invitations')}
            className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition ${
              activeTab === 'invitations'
                ? 'bg-[#7a1c24] text-white shadow'
                : 'text-slate-700 hover:bg-white/70'
            }`}
          >
            <Ticket size={14} /> مسح الدعوات
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition ${
              activeTab === 'attendance'
                ? 'bg-[#7a1c24] text-white shadow'
                : 'text-slate-700 hover:bg-white/70'
            }`}
          >
            <Users size={14} /> حضور وانصراف (خدام / مخدومين)
          </button>
        </div>

        {activeTab === 'attendance' && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50/80 border border-amber-200 px-3 py-2 rounded-2xl">
            <span className="text-[11px] font-bold text-amber-950">وضع التسجيل:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAttendanceMode('auto')}
                className={`px-2.5 py-1 rounded-xl font-bold text-[11px] cursor-pointer ${
                  attendanceMode === 'auto'
                    ? 'bg-amber-500 text-[#4a0e13]'
                    : 'bg-white text-gray-700 border'
                }`}
              >
                تلقائي (حضور / انصراف)
              </button>
              <button
                type="button"
                onClick={() => setAttendanceMode('check_in')}
                className={`px-2.5 py-1 rounded-xl font-bold text-[11px] flex items-center gap-1 cursor-pointer ${
                  attendanceMode === 'check_in'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-gray-700 border'
                }`}
              >
                <LogIn size={12} /> حضور
              </button>
              <button
                type="button"
                onClick={() => setAttendanceMode('check_out')}
                className={`px-2.5 py-1 rounded-xl font-bold text-[11px] flex items-center gap-1 cursor-pointer ${
                  attendanceMode === 'check_out'
                    ? 'bg-rose-600 text-white'
                    : 'bg-white text-gray-700 border'
                }`}
              >
                <LogOut size={12} /> انصراف
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-2xl border">
          <span className="text-[11px] font-bold text-slate-700">
            الكاميرا الحالية:{' '}
            <strong className="text-[#7a1c24]">
              {facingMode === 'environment' ? 'الخلفية' : 'الأمامية'}
            </strong>
            <span className="text-gray-500 font-normal">
              {' '}
              • أبعِد الموبايل قليلاً عن شاشة الهاتف لتجنب انعكاس الضوء
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            <label className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl font-bold text-[11px] flex items-center gap-1 cursor-pointer">
              <ImagePlus size={13} /> قراءة صورة
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleScanImageFile}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="px-2.5 py-1.5 bg-white hover:bg-gray-100 border rounded-xl font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <SwitchCamera size={13} /> تبديل
            </button>
            <button
              type="button"
              onClick={() => startScanner(facingMode)}
              className="px-2.5 py-1.5 bg-white hover:bg-gray-100 border rounded-xl font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={13} /> فوكس
            </button>
          </div>
        </div>

        <div className="bg-slate-950 rounded-2xl overflow-hidden relative border border-slate-800">
          <div
            id="church-qr-scanner-box"
            className="w-full [&>video]:w-full [&>video]:h-[290px] [&>video]:object-cover [&>canvas]:hidden"
          />

          {cameraStatus === 'active' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-60 h-60 border-2 border-emerald-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(2,6,23,0.3)] relative">
                <span className="absolute -bottom-7 inset-x-0 text-center text-[11px] font-bold text-white drop-shadow">
                  وجّه الكاميرا نحو شاشة الـ QR
                </span>
              </div>
            </div>
          )}

          {cameraStatus !== 'active' && (
            <div className="min-h-[260px] flex flex-col items-center justify-center p-5 text-center space-y-2">
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

        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute right-3 top-3 text-gray-400" />
            <input
              placeholder={
                activeTab === 'attendance'
                  ? 'إدخال اسم المستخدم أو المعرف يدوياً...'
                  : 'إدخال أو لصق كود الدعوة يدوياً (مثال: INV-...)'
              }
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
            {submittingManual ? 'جاري التحقق...' : 'تسجيل'}
          </button>
        </form>

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
              {scanResult.kind === 'success' && (
                <CheckCircle2 size={18} className="text-emerald-700" />
              )}
              {scanResult.kind === 'warning' && (
                <AlertTriangle size={18} className="text-amber-700" />
              )}
              {scanResult.kind === 'error' && <XCircle size={18} className="text-red-700" />}
              <span>{scanResult.title}</span>
            </div>

            <p className="font-bold">{scanResult.message}</p>

            {(scanResult.invite || scanResult.embedded?.recipient_name) && (
              <div className="bg-white/95 rounded-xl p-3 border space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <strong className="text-gray-900 block text-sm">
                      {scanResult.invite?.recipient_name || scanResult.embedded?.recipient_name}
                    </strong>
                    <span className="text-gray-600 block">
                      {scanResult.invite?.recipient_role || scanResult.embedded?.recipient_role
                        ? `${scanResult.invite?.recipient_role || scanResult.embedded?.recipient_role} • `
                        : ''}
                      {scanResult.invite?.event_title || scanResult.embedded?.event_title || ''}
                    </span>
                    {(scanResult.invite?.seat_or_zone || scanResult.embedded?.seat_or_zone) && (
                      <span className="text-[11px] font-bold text-[#7a1c24] block mt-0.5">
                        المكان / المقعد:{' '}
                        {scanResult.invite?.seat_or_zone || scanResult.embedded?.seat_or_zone}
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-xl font-black flex items-center gap-1 ${
                      (scanResult.invite?.invite_tier || scanResult.embedded?.invite_tier) ===
                      'vip'
                        ? 'bg-amber-400 text-[#4a0e13]'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {(scanResult.invite?.invite_tier || scanResult.embedded?.invite_tier) ===
                    'vip' ? (
                      <Crown size={13} />
                    ) : (
                      <Users size={13} />
                    )}
                    {(scanResult.invite?.invite_tier || scanResult.embedded?.invite_tier) === 'vip'
                      ? 'VIP'
                      : 'عام'}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t text-[11px] text-gray-700">
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-[#7a1c24] shrink-0" />
                    <span>
                      الوقت:{' '}
                      <strong className="text-gray-900">
                        {formatDateTimeAr(scanResult.invite?.checked_in_at || scanResult.scannedAt)}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-emerald-700 shrink-0" />
                    <span>
                      تم المسح بواسطة:{' '}
                      <strong className="text-gray-900">
                        {scanResult.invite?.checked_in_by || scanResult.scannedBy || actorLabel}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {recentLogs.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <strong className="text-gray-800 block">
              سجل العمليات في هذه الجلسة ({recentLogs.length}):
            </strong>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {recentLogs.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 bg-[#fbfaf7] border px-3 py-2 rounded-xl"
                >
                  <div>
                    <span className="font-black text-gray-900 block">{item.title}</span>
                    <span className="text-[10px] text-gray-600 block">{item.subtitle}</span>
                  </div>
                  <div className="text-left space-y-0.5">
                    <span className="text-[10px] text-emerald-800 font-black bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg inline-block">
                      {item.badge} • {item.timeLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
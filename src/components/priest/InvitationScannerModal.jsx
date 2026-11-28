import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  ImagePlus,
  QrCode,
  Armchair
} from 'lucide-react';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

const ROW_LABELS_AR = [
  'الصف الأول',
  'الصف الثاني',
  'الصف الثالث',
  'الصف الرابع',
  'الصف الخامس',
  'الصف السادس'
];

function getRowLabel(rowIndex) {
  return ROW_LABELS_AR[rowIndex] || `الصف ${rowIndex + 1}`;
}

function extractSeatNumber(seatText = '') {
  const match = String(seatText || '').match(/كرسي\s*(\d+)/i);
  return match?.[1] ? Number(match[1]) : null;
}

function isValidUuid(val) {
  return UUID_REGEX.test(String(val || '').trim());
}

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
      navigator.vibrate(kind === 'success' ? [70] : [110, 50, 110]);
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    if (kind === 'success') {
      // نغمة "تن" واضحة وسريعة لتأكيد التقاط الـ QR وتسجيله
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1180, now);
      osc.frequency.exponentialRampToValueAtTime(1480, now + 0.04);
      osc.frequency.exponentialRampToValueAtTime(1040, now + 0.16);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.32, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    } else {
      // نغمة تنبيه في حالة تحذير أو عدم تطابق
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.setValueAtTime(310, now + 0.11);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 320);
  } catch {
    // تجاهل في حال منع الصوت من المتصفح
  }
}

export function parseQrContent(rawText = '') {
  const raw = String(rawText ?? '');
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      kind: 'empty',
      rawText: raw,
      token: '',
      memberInfo: null,
      embedded: null
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const hasMemberHint =
        parsed.type === 'church_member_attendance' ||
        parsed.kind === 'member' ||
        Boolean(parsed.user_id || parsed.username || parsed.member_id);

      if (hasMemberHint) {
        const userId = String(parsed.user_id || parsed.member_id || '').trim();
        const username = String(parsed.username || '').trim();
        return {
          kind: 'member',
          rawText: trimmed,
          token: userId || username || trimmed,
          memberInfo: {
            user_id: userId,
            username,
            full_name: String(parsed.full_name || '').trim(),
            role: String(parsed.role || '').trim(),
            role_label: String(parsed.role_label || '').trim()
          },
          embedded: null
        };
      }

      const token = String(
        parsed.token || parsed.qr_token || parsed.code || parsed.invitation_code || parsed.id || ''
      ).trim();

      return {
        kind: 'invitation',
        rawText: trimmed,
        token: token || trimmed,
        memberInfo: null,
        embedded: {
          recipient_name: String(parsed.recipient_name || '').trim(),
          recipient_role: String(parsed.role_or_title || parsed.recipient_role || '').trim(),
          event_title: String(parsed.event_title || '').trim(),
          invite_tier: parsed.tier === 'vip' || parsed.invite_tier === 'vip' ? 'vip' : 'general',
          seat_or_zone: String(parsed.seat_or_zone || '').trim(),
          attendance_mode: String(parsed.attendance_mode || '').trim(),
          raw_status: String(parsed.status || '').trim()
        }
      };
    }
  } catch {
    // ليس JSON — نتعامل معه كرابط أو نص/كود مباشر
  }

  const urlMatch = trimmed.match(/[?&](?:token|qr|code|user|user_id|username)=([^&#]+)/i);
  if (urlMatch?.[1]) {
    try {
      const extracted = decodeURIComponent(urlMatch[1]).trim();
      if (extracted) {
        return {
          kind: 'generic',
          rawText: trimmed,
          token: extracted,
          memberInfo: { user_id: extracted, username: extracted, full_name: '' },
          embedded: null
        };
      }
    } catch {
      // fallback للنص الأصلي
    }
  }

  return {
    kind: 'generic',
    rawText: trimmed,
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
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);
  const isStartingRef = useRef(false);
  const lastRawRef = useRef({ text: '', at: 0 });
  const soundEnabledRef = useRef(true);
  const activeTabRef = useRef(initialTab);
  const attendanceModeRef = useRef('auto');
  const processAnyScanRef = useRef(null);

  const [activeTab, setActiveTab] = useState(
    initialTab === 'attendance' ? 'attendance' : 'invitations'
  );
  const [attendanceMode, setAttendanceMode] = useState('auto'); // 'auto' | 'check_in' | 'check_out'
  const [manualCode, setManualCode] = useState('');
  const [cameraStatus, setCameraStatus] = useState('starting'); // 'starting' | 'active' | 'error'
  const [cameraErrorMsg, setCameraErrorMsg] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);

  // خريطة الكراسي لترصيص مكان المدعو عند المسح
  const [rowsCount, setRowsCount] = useState(3);
  const [seatsPerRow, setSeatsPerRow] = useState(6);
  const [eventSeatsMap, setEventSeatsMap] = useState({});
  const [highlightedSeatNum, setHighlightedSeatNum] = useState(null);
  const [activeSeatEventTitle, setActiveSeatEventTitle] = useState('');

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

  const syncEventSeatsMap = useCallback(async (eventTitle, focusedInvite = null) => {
    const cleanTitle = String(eventTitle || '').trim();
    if (!cleanTitle || !supabase || typeof supabase.from !== 'function') return;

    setActiveSeatEventTitle(cleanTitle);

    const { data, error } = await supabase
      .from('church_invitations')
      .select('id, recipient_name, seat_or_zone, status, invite_tier')
      .eq('event_title', cleanTitle);

    if (error || !Array.isArray(data)) return;

    const nextMap = {};
    let maxSeat = 0;

    data.forEach((row) => {
      const seatNum = extractSeatNumber(row.seat_or_zone);
      if (seatNum) {
        if (seatNum > maxSeat) maxSeat = seatNum;
        nextMap[seatNum] = {
          name: row.recipient_name || 'مدعو',
          checkedIn: row.status === 'checked_in',
          vip: row.invite_tier === 'vip',
          id: row.id
        };
      }
    });

    if (focusedInvite) {
      const fSeat = extractSeatNumber(focusedInvite.seat_or_zone);
      if (fSeat) {
        if (fSeat > maxSeat) maxSeat = fSeat;
        nextMap[fSeat] = {
          name: focusedInvite.recipient_name || 'مدعو',
          checkedIn: true,
          vip: focusedInvite.invite_tier === 'vip',
          id: focusedInvite.id
        };
        setHighlightedSeatNum(fSeat);
      } else {
        setHighlightedSeatNum(null);
      }
    }

    if (maxSeat > 0) {
      const neededRows = Math.min(6, Math.max(rowsCount, Math.ceil(maxSeat / seatsPerRow)));
      setRowsCount(neededRows);
    }

    setEventSeatsMap(nextMap);
  }, [rowsCount, seatsPerRow]);

  const applyContinuousFocusIfSupported = async (html5QrCode) => {
    try {
      if (!isMountedRef.current) return;
      const state = html5QrCode?.getState?.();
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
    scannerRef.current = null;

    try {
      const containerEl = document.getElementById('church-qr-scanner-box');
      const videoEl = containerEl?.querySelector('video');
      const stream = videoEl?.srcObject;
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // تجاهل
          }
        });
      }
      if (videoEl) {
        videoEl.srcObject = null;
      }
    } catch {
      // تجاهل
    }

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
    async (targetFacing = 'environment') => {
      if (!isMountedRef.current) return;

      if (isStartingRef.current) {
        await stopScannerSafe();
        isStartingRef.current = false;
      }

      isStartingRef.current = true;
      setCameraStatus('starting');
      setCameraErrorMsg('');

      try {
        await stopScannerSafe();
        if (!isMountedRef.current) return;

        if (
          typeof window === 'undefined' ||
          !navigator?.mediaDevices ||
          typeof navigator.mediaDevices.getUserMedia !== 'function'
        ) {
          throw new Error(
            'المتصفح لا يدعم الكاميرا هنا (تأكد من فتح الموقع على HTTPS أو localhost والسماح بالوصول للكاميرا).'
          );
        }

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
        const scanConfig = {
          fps: 18,
          qrbox: { width: boxSize, height: boxSize },
          disableFlip: false
        };

        const onScanSuccess = (decodedText) => {
          if (!isMountedRef.current) return;
          const cleaned = String(decodedText || '').trim();
          if (!cleaned) return;
          const now = Date.now();
          if (lastRawRef.current.text === cleaned && now - lastRawRef.current.at < 1400) {
            return;
          }
          lastRawRef.current = { text: cleaned, at: now };
          processAnyScanRef.current?.(cleaned);
        };

        try {
          await html5QrCode.start(
            { facingMode: targetFacing },
            scanConfig,
            onScanSuccess,
            () => {}
          );
        } catch (firstErr) {
          const cameras = await Html5Qrcode.getCameras().catch(() => []);
          if (!Array.isArray(cameras) || cameras.length === 0) {
            throw firstErr;
          }

          const preferred =
            cameras.find((cam) =>
              targetFacing === 'environment'
                ? /back|rear|environment|خلفي/i.test(cam.label || '')
                : /front|user|أمامي/i.test(cam.label || '')
            ) || cameras[0];

          await html5QrCode.start(preferred.id, scanConfig, onScanSuccess, () => {});
        }

        if (!isMountedRef.current) {
          await stopScannerSafe();
          return;
        }

        setCameraStatus('active');
        setTimeout(() => {
          applyContinuousFocusIfSupported(html5QrCode);
        }, 300);
      } catch (err) {
        if (!isMountedRef.current) return;
        const errName = err?.name ? `[${err.name}] ` : '';
        setCameraStatus('error');
        setCameraErrorMsg(
          `${errName}${
            err?.message ||
            'تعذر تشغيل الكاميرا. تأكد من صلاحية الكاميرا في المتصفح وعدم استخدامها في مكان آخر.'
          }`
        );
      } finally {
        isStartingRef.current = false;
      }
    },
    [stopScannerSafe]
  );

  useEffect(() => {
    isMountedRef.current = true;
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        startScanner(facingMode);
      }
    }, 80);

    return () => {
      clearTimeout(timer);
      isMountedRef.current = false;
      stopScannerSafe();
    };
  }, [facingMode, startScanner, stopScannerSafe]);

  const handleScanImageFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isMountedRef.current) return;

    let tempScanner = scannerRef.current;
    let createdTemp = false;

    try {
      if (!tempScanner) {
        const readerId = 'church-qr-scanner-box';
        if (document.getElementById(readerId)) {
          tempScanner = new Html5Qrcode(readerId, { verbose: false });
          createdTemp = true;
        }
      }
      if (!tempScanner) return;

      const decodedText = await tempScanner.scanFile(file, true);
      if (decodedText && isMountedRef.current) {
        await processAnyScanRef.current?.(decodedText);
      }
    } catch {
      if (!isMountedRef.current) return;
      playFeedbackTone('warning', soundEnabledRef.current);
      setScanResult({
        kind: 'unmatched',
        title: 'لم يتم التعرف على QR في الصورة',
        message: 'حاول اختيار صورة أوضح يكون فيها رمز الـ QR ظاهراً بدون انعكاس ضوء قوي.',
        rawQrText: file.name,
        scannedAt: new Date().toISOString()
      });
    } finally {
      if (createdTemp && tempScanner) {
        try {
          await tempScanner.clear();
        } catch {
          // تجاهل
        }
      }
    }
  };

  const handleInvitationScan = async (parsed) => {
    const token = String(parsed.token || '').trim();
    const nowIso = new Date().toISOString();

    if (!token) {
      playFeedbackTone('warning', soundEnabledRef.current);
      setScanResult({
        kind: 'unmatched',
        title: 'رمز QR فارغ',
        message: 'لم يتم العثور على كود داخل الـ QR.',
        rawQrText: parsed.rawText || '',
        scannedAt: nowIso
      });
      return;
    }

    let invite = null;
    let queryError = null;

    if (isValidUuid(token)) {
      const res = await supabase
        .from('church_invitations')
        .select('*')
        .or(`qr_token.eq.${token},id.eq.${token}`)
        .maybeSingle();
      invite = res.data;
      queryError = res.error;
    } else {
      const res = await supabase
        .from('church_invitations')
        .select('*')
        .eq('qr_token', token)
        .maybeSingle();
      invite = res.data;
      queryError = res.error;
    }

    if (!isMountedRef.current) return;

    if (queryError || !invite) {
      playFeedbackTone('warning', soundEnabledRef.current);
      setScanResult({
        kind: 'unmatched',
        title: 'تمت قراءة الـ QR — غير مسجل في قاعدة البيانات',
        message:
          'هذا الكود غير موجود ضمن الدعوات المسجلة لديك، لذا لم يتم عرض أو ربط أي بيانات من قاعدة البيانات.',
        rawQrText: parsed.rawText || token,
        scannedAt: nowIso
      });
      return;
    }

    if (invite.status === 'checked_in') {
      playFeedbackTone('warning', soundEnabledRef.current);
      setScanResult({
        kind: 'warning',
        title: 'تم مسح هذه الدعوة مسبقاً',
        message: `تم تسجيل دخول (${invite.recipient_name || 'مدعو'}) مسبقاً${
          invite.checked_in_at ? ` في (${formatDateTimeAr(invite.checked_in_at)})` : ''
        }${invite.checked_in_by ? ` بواسطة (${invite.checked_in_by})` : ''}.`,
        invite,
        scannedAt: invite.checked_in_at || nowIso,
        scannedBy: invite.checked_in_by || scannerDisplayName,
        scannedByRole: invite.checked_in_by_role || scannerRoleLabel
      });
      await syncEventSeatsMap(invite.event_title, invite);
      return;
    }

    const baseUpdatePayload = {
      status: 'checked_in',
      checked_in_at: nowIso,
      checked_in_by: actorLabel
    };

    const extendedUpdatePayload = {
      ...baseUpdatePayload,
      checked_in_by_id: isValidUuid(currentUser?.id) ? currentUser.id : null,
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
      .maybeSingle();

    if (firstAttempt.error) {
      const secondAttempt = await supabase
        .from('church_invitations')
        .update(baseUpdatePayload)
        .eq('id', invite.id)
        .select()
        .maybeSingle();
      updatedRow = secondAttempt.data;
      updErr = secondAttempt.error;
    } else {
      updatedRow = firstAttempt.data;
    }

    if (!isMountedRef.current) return;

    if (updErr) {
      playFeedbackTone('error', soundEnabledRef.current);
      setScanResult({
        kind: 'error',
        title: 'تعذر تحديث حالة الدخول في قاعدة البيانات',
        message: updErr.message,
        invite,
        rawQrText: parsed.rawText || token,
        scannedAt: nowIso,
        scannedBy: scannerDisplayName,
        scannedByRole: scannerRoleLabel
      });
      return;
    }

    const finalInvite = {
      ...invite,
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
      scannedAt: finalInvite.checked_in_at,
      scannedBy: scannerDisplayName,
      scannedByRole: scannerRoleLabel
    });

    await syncEventSeatsMap(finalInvite.event_title, finalInvite);

    setRecentLogs((prev) => [
      {
        id: `inv-${finalInvite.id}-${finalInvite.checked_in_at}`,
        title: finalInvite.recipient_name || 'مدعو',
        subtitle: `${finalInvite.invite_tier === 'vip' ? '👑 VIP' : 'عام'}${
          finalInvite.seat_or_zone ? ` • ${finalInvite.seat_or_zone}` : ''
        } • بواسطة: ${finalInvite.checked_in_by || actorLabel}`,
        badge: 'حضور دعوة',
        timeLabel: formatDateTimeAr(finalInvite.checked_in_at)
      },
      ...prev.slice(0, 14)
    ]);
  };

  const handleMemberAttendanceScan = async (parsed) => {
    const memberInfo = parsed.memberInfo || {};
    const userId = String(memberInfo.user_id || '').trim();
    const username = String(memberInfo.username || '').trim();
    const token = String(parsed.token || '').trim();
    const lookupKey = userId || username || token;
    const now = new Date();
    const nowIso = now.toISOString();

    if (!lookupKey) {
      playFeedbackTone('warning', soundEnabledRef.current);
      setScanResult({
        kind: 'unmatched',
        title: 'رمز QR فارغ',
        message: 'لم يتم العثور على كود حضور داخل الـ QR.',
        rawQrText: parsed.rawText || '',
        scannedAt: nowIso
      });
      return;
    }

    let member = null;
    let memberErr = null;

    if (isValidUuid(userId)) {
      const res = await supabase
        .from('church_users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      member = res.data;
      memberErr = res.error;
    }

    if (!member && username) {
      const res = await supabase
        .from('church_users')
        .select('*')
        .eq('username', username)
        .maybeSingle();
      member = res.data;
      memberErr = res.error;
    }

    if (!member && !username && token && !isValidUuid(token)) {
      const res = await supabase
        .from('church_users')
        .select('*')
        .eq('username', token)
        .maybeSingle();
      member = res.data;
      memberErr = res.error;
    }

    if (!isMountedRef.current) return;

    if (memberErr || !member) {
      playFeedbackTone('warning', soundEnabledRef.current);
      setScanResult({
        kind: 'unmatched',
        title: 'تمت قراءة الـ QR — غير موجود في قاعدة البيانات',
        message:
          'هذا الكود غير مطابق لأي حساب مسجل لديك، لذلك لم يتم عرض أو تسجيل أي بيانات من قاعدة البيانات.',
        rawQrText: parsed.rawText || lookupKey,
        scannedAt: nowIso
      });
      return;
    }

    const memberName = member.full_name || member.name || member.username || 'عضو';
    const memberRoleLabel =
      member.permissions?.custom_role_label ||
      ROLE_AR_LABELS[member.role] ||
      member.role ||
      'عضو';

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

    if (!isMountedRef.current) return;

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
        .maybeSingle();

      if (!isMountedRef.current) return;

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
          id: `att-out-${updatedLog?.id || member.id}-${nowIso}`,
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
      .maybeSingle();

    if (!isMountedRef.current) return;

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
        id: `att-in-${createdLog?.id || member.id}-${nowIso}`,
        title: `${memberName} (${memberRoleLabel})`,
        subtitle: `حضور • بواسطة: ${actorLabel}`,
        badge: 'حضور',
        timeLabel: formatDateTimeAr(nowIso)
      },
      ...prev.slice(0, 14)
    ]);
  };

  const processAnyScan = useCallback(
    async (rawValue) => {
      if (!isMountedRef.current || isProcessingRef.current) return;

      const parsed = parseQrContent(rawValue);
      if (!parsed.token) return;

      isProcessingRef.current = true;
      try {
        if (parsed.kind === 'member') {
          await handleMemberAttendanceScan(parsed);
          return;
        }
        if (parsed.kind === 'invitation') {
          await handleInvitationScan(parsed);
          return;
        }

        if (activeTabRef.current === 'attendance') {
          await handleMemberAttendanceScan(parsed);
        } else {
          await handleInvitationScan(parsed);
        }
      } finally {
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 900);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actorLabel, currentUser?.id, scannerDisplayName, scannerRoleLabel]
  );

  useEffect(() => {
    processAnyScanRef.current = processAnyScan;
  }, [processAnyScan]);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualCode.trim() || submittingManual) return;
    setSubmittingManual(true);
    try {
      await processAnyScan(manualCode.trim());
      if (isMountedRef.current) {
        setManualCode('');
      }
    } finally {
      if (isMountedRef.current) {
        setSubmittingManual(false);
      }
    }
  };

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleCloseModal = async () => {
    await stopScannerSafe();
    onClose?.();
  };

  const seatRowsArray = useMemo(() => {
    const safeRows = Math.min(6, Math.max(1, Number(rowsCount) || 3));
    const safeCols = Math.min(12, Math.max(2, Number(seatsPerRow) || 6));
    let num = 1;
    return Array.from({ length: safeRows }, (_, rIdx) => {
      const seats = Array.from({ length: safeCols }, () => {
        const seatNumber = num++;
        return {
          rowIndex: rIdx,
          rowLabel: getRowLabel(rIdx),
          seatNumber
        };
      });
      return {
        rowIndex: rIdx,
        rowLabel: getRowLabel(rIdx),
        seats
      };
    });
  }, [rowsCount, seatsPerRow]);

  const showSeatMap =
    activeTab === 'invitations' &&
    (Boolean(activeSeatEventTitle) || Object.keys(eventSeatsMap).length > 0);

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
              onClick={() => playFeedbackTone('success', true)}
              title="تجربة صوت التن"
              className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl font-bold text-[11px] cursor-pointer"
            >
              🔊 تن
            </button>
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
              onClick={handleCloseModal}
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
                  ? 'إدخال اسم المستخدم أو المعرف أو أي QR يدوياً...'
                  : 'إدخال أو لصق كود الدعوة أو أي QR يدوياً...'
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
                : scanResult.kind === 'warning' || scanResult.kind === 'unmatched'
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-red-50 border-red-300 text-red-950'
            }`}
          >
            <div className="flex items-center gap-2 font-black text-sm">
              {scanResult.kind === 'success' && (
                <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
              )}
              {(scanResult.kind === 'warning' || scanResult.kind === 'unmatched') && (
                <AlertTriangle size={18} className="text-amber-700 shrink-0" />
              )}
              {scanResult.kind === 'error' && (
                <XCircle size={18} className="text-red-700 shrink-0" />
              )}
              <span>{scanResult.title}</span>
            </div>

            <p className="font-bold">{scanResult.message}</p>

            {scanResult.kind === 'unmatched' && scanResult.rawQrText && (
              <div className="bg-white/95 rounded-xl p-3 border space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700">
                  <QrCode size={14} className="text-[#7a1c24]" />
                  <span>محتوى الـ QR المقروء:</span>
                </div>
                <div className="font-mono text-[11px] bg-slate-50 border rounded-lg p-2 break-all text-slate-900 select-all">
                  {scanResult.rawQrText}
                </div>
              </div>
            )}

            {scanResult.invite && scanResult.kind !== 'unmatched' && (
              <div className="bg-white/95 rounded-xl p-3 border space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <strong className="text-gray-900 block text-sm">
                      {scanResult.invite.recipient_name || 'مدعو'}
                    </strong>
                    <span className="text-gray-600 block">
                      {scanResult.invite.recipient_role
                        ? `${scanResult.invite.recipient_role} • `
                        : ''}
                      {scanResult.invite.event_title || ''}
                    </span>
                    {scanResult.invite.seat_or_zone && (
                      <span className="text-[11px] font-bold text-[#7a1c24] inline-flex items-center gap-1 mt-1 bg-[#f9ecee] px-2.5 py-1 rounded-lg">
                        <Armchair size={13} /> المكان / المقعد: {scanResult.invite.seat_or_zone}
                      </span>
                    )}
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
                      الوقت:{' '}
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
                        {scanResult.invite.checked_in_by || scanResult.scannedBy || actorLabel}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {showSeatMap && (
          <div className="bg-[#fbfaf7] border border-gray-200 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Armchair size={15} className="text-[#7a1c24]" />
                <strong className="text-gray-900">
                  خريطة الكراسي وتسكين الحضور ({activeSeatEventTitle})
                </strong>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <label className="flex items-center gap-1">
                  <span>صفوف:</span>
                  <select
                    className="px-1.5 py-0.5 border rounded bg-white"
                    value={rowsCount}
                    onChange={(e) => setRowsCount(Number(e.target.value))}
                  >
                    {[2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1">
                  <span>كراسي الصف:</span>
                  <select
                    className="px-1.5 py-0.5 border rounded bg-white"
                    value={seatsPerRow}
                    onChange={(e) => setSeatsPerRow(Number(e.target.value))}
                  >
                    {[4, 5, 6, 8, 10].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-gray-600">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-white border border-slate-300 inline-block" /> متاح
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" /> محجوز
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-emerald-600 inline-block" /> حضر
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-[#7a1c24] inline-block" /> كرسي الممسوح الآن
              </span>
            </div>

            <div className="space-y-2 overflow-x-auto">
              {seatRowsArray.map((row) => (
                <div
                  key={row.rowIndex}
                  className="bg-white border border-slate-200 rounded-xl p-2 flex flex-col sm:flex-row sm:items-center gap-2"
                >
                  <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-800 font-black text-[10px] shrink-0 text-center sm:w-20">
                    {row.rowLabel}
                  </span>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 flex-1">
                    {row.seats.map((seat) => {
                      const info = eventSeatsMap[seat.seatNumber];
                      const isCurrent = highlightedSeatNum === seat.seatNumber;
                      const isChecked = Boolean(info?.checkedIn);
                      const isReserved = Boolean(info);

                      return (
                        <div
                          key={seat.seatNumber}
                          title={
                            info
                              ? `كرسي ${seat.seatNumber} — ${info.name}`
                              : `${row.rowLabel} - كرسي ${seat.seatNumber}`
                          }
                          className={`py-1.5 px-1 rounded-lg border font-black text-[10px] flex flex-col items-center justify-center text-center ${
                            isCurrent
                              ? 'bg-[#7a1c24] border-[#7a1c24] text-white ring-2 ring-[#7a1c24]/40'
                              : isChecked
                                ? 'bg-emerald-600 border-emerald-700 text-white'
                                : isReserved
                                  ? 'bg-amber-100 border-amber-300 text-amber-950'
                                  : 'bg-[#fbfaf7] border-slate-300 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-0.5">
                            <Armchair size={11} />
                            <span>{seat.seatNumber}</span>
                          </div>
                          {info?.name && (
                            <span className="truncate max-w-full text-[9px] font-bold">
                              {info.name}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
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
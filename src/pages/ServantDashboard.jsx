import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Phone, Search, UserPlus, Calendar, MessageSquareText, Layers,
  MessageCircle, Users, MapPin, X, FileSpreadsheet,
  Plus, Pencil, LayoutGrid, List,
  CheckCircle2, SlidersHorizontal, Camera, Cake, Award, MailPlus, Bus, QrCode, KeyRound
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { canScanChurchInvitations, canSendChurchInvitations } from '../lib/permissions';
import { isScoutServant } from '../utils/scoutAccess';
import BirthdayBanner from '../components/BirthdayBanner';
import BellNotificationsPanel from '../components/priest/BellNotificationsPanel';
import MasterCongregationSheet, { canExtractMasterSheet } from '../components/MasterCongregationSheet';
import { DEFAULT_SERVICE_GROUPS, normalizeGroupStages } from '../components/ServiceGroupFeed';
import MonthlyAnalyticsAndRewards from '../components/MonthlyAnalyticsAndRewards';
import PriestInvitationModal from '../components/priest/PriestInvitationModal';
import InvitationScannerModal from '../components/priest/InvitationScannerModal';
import PriestInvitationsTab from '../components/priest/PriestInvitationsTab';
import ReceivedInvitationsSection from '../components/ReceivedInvitationsSection';

const STAGE_OPTIONS = [
  'حضانة',
  'أولى ابتدائي', 'ثانية ابتدائي', 'ثالثة ابتدائي', 'رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي',
  'أولى إعدادي', 'ثانية إعدادي', 'ثالثة إعدادي',
  'أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي',
  'جامعة وخريجين',
  'حرفيين ومهنيين',
  'أصحاب معاشات',
  'اجتماع الأرامل',
  'إخوة الرب',
  'اجتماع الصدى'
];

const CORE_SERVICE_GROUPS = [
  'خدمة حضانة وطفولة',
  'خدمة ابتدائي',
  'خدمة إعدادي',
  'خدمة ثانوي',
  'خدمة جامعة وخريجين',
  'خدمات واجتماعات خاصة'
];

const GENDER_SCOPES = ['الكل', 'بنين', 'بنات'];

const DEFAULT_NOTE_TAGS = [
  'عادي',
  'يحتاج متابعة',
  'مشاكل',
  'مجد ومجتهد',
  'ظروف صحية',
  'متابعة دراسية / سلوكية',
  'احتياج افتقاد'
];

const DEFAULT_ACTIVITY_TYPES = [
  'مدارس أحد',
  'قداس إلهي',
  'صلاة عشية',
  'اجتماع خدمة / درس كتاب',
  'ألحان / كورال / شماسة',
  'مؤتمر / خلوة / رحلة'
];

const DEFAULT_ATTENDANCE_STATUSES = [
  { code: 'present', label: 'حاضر', emoji: '✅', attended: true },
  { code: 'absent', label: 'غائب', emoji: '❌', attended: false },
  { code: 'early_leave', label: 'انصراف مبكر', emoji: '🚪', attended: true },
  { code: 'late', label: 'تأخير', emoji: '⏱️', attended: true },
  { code: 'excused', label: 'معتذر', emoji: '📝', attended: false }
];

const CUSTOM_ITEMS_STORAGE_KEY = 'servant_custom_service_items_v1';

const getTodayLocalDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getNowHHMM = () => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const parseTimeToMinutes = (timeStr = '') => {
  const match = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hrs = Number(match[1]);
  const mins = Number(match[2]);
  if (Number.isNaN(hrs) || Number.isNaN(mins)) return null;
  return hrs * 60 + mins;
};

const getBirthMonthDay = (dobStr) => {
  if (!dobStr) return null;
  const parts = String(dobStr).trim().split(/[-/]/);
  if (parts.length < 3) return null;
  if (parts[0].length === 4) {
    return { month: Number(parts[1]), day: Number(parts[2]) };
  }
  return { month: Number(parts[1]), day: Number(parts[0]) };
};

const normalizePhone = (phone = '') => {
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0020') && digits.length >= 13) return '0' + digits.slice(4);
  if (digits.startsWith('20') && digits.length === 12) return '0' + digits.slice(2);
  if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
  return digits;
};

const compressPhotoFile = (file, maxSide = 480, quality = 0.72) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round((img.width || 300) * scale));
        const height = Math.max(1, Math.round((img.height || 300) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const isMaleMember = (m) => {
  const g = String(m?.gender || '').trim();
  return g === 'ذكر' || g === 'بنين' || g.toLowerCase() === 'male';
};

const isFemaleMember = (m) => {
  const g = String(m?.gender || '').trim();
  return g === 'أنثى' || g === 'بنات' || g.toLowerCase() === 'female';
};

const isPrepOrSecondaryScope = (scope = '') => {
  const s = String(scope || '');
  return (
    s.includes('إعدادي') ||
    s.includes('اعدادي') ||
    s.includes('ثانوي') ||
    s.includes('أولى') ||
    s.includes('ثانية') ||
    s.includes('ثالثة')
  );
};

const canManageOfficialSchedule = (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const roleStr = `${user.role || ''} ${user.job_title || ''} ${user.service_role || ''}`.toLowerCase();
  return (
    roleStr.includes('priest') ||
    roleStr.includes('father') ||
    roleStr.includes('أبونا') ||
    roleStr.includes('ابونا') ||
    roleStr.includes('كاهن') ||
    user.permissions?.can_manage_schedule === true
  );
};

const normalizeTripText = (val = '') =>
  String(val || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');

const isGeneralChurchTrip = (tr) => {
  const tgt = normalizeTripText(tr?.target_service || tr?.stage_name || tr?.service_name || '');
  const sc = normalizeTripText(tr?.trip_scope || tr?.scope_type || '');
  return (
    Boolean(tr?.is_general_trip) ||
    sc === 'general' ||
    sc === 'trips_office' ||
    !tgt ||
    tgt === 'عام' ||
    tgt === 'رحلات عام' ||
    tgt === 'مكتب الرحلات' ||
    tgt.includes('مكتب الرحلات')
  );
};

export default function ServantDashboard({
  servant, users = [], services = [], serviceGroups = [], activities = [], memberNotes = [], birthdays = [],
  onAddMember, onSaveActivity, onSaveMemberNote, onAcknowledgeNote, onRefresh, onUpdateServiceStructure
}) {
  const scrollBoxRef = useRef(null);
  const isAdminUser = servant?.role === 'admin';
  const canEditSchedule = canManageOfficialSchedule(servant);
  const canAdd = isAdminUser || servant?.permissions?.can_add !== false;
  const canManageStructure = true;
  const canExtractSheet = canExtractMasterSheet(servant);
  const canSendInvites = useMemo(() => canSendChurchInvitations(servant), [servant]);
  const [showMasterSheet, setShowMasterSheet] = useState(false);

  const [localMemberPhotos, setLocalMemberPhotos] = useState({});
  const [uploadingPhotoMemberId, setUploadingPhotoMemberId] = useState(null);
  const cameraInputRef = useRef(null);
  const pendingPhotoMemberRef = useRef(null);

  const [birthdayTab, setBirthdayTab] = useState('members');

  const [servantTrips, setServantTrips] = useState([]);
  const [tripSubTab, setTripSubTab] = useState('my_service');

  const [scannerOpen, setScannerOpen] = useState(false);
  const [receivedInvitesCount, setReceivedInvitesCount] = useState(0);
  const [liveInviteToast, setLiveInviteToast] = useState('');

  const [noteTags, setNoteTags] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_ITEMS_STORAGE_KEY) || '{}');
      return Array.isArray(saved.noteTags) && saved.noteTags.length > 0 ? saved.noteTags : DEFAULT_NOTE_TAGS;
    } catch {
      return DEFAULT_NOTE_TAGS;
    }
  });

  const [activityTypes, setActivityTypes] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_ITEMS_STORAGE_KEY) || '{}');
      return Array.isArray(saved.activityTypes) && saved.activityTypes.length > 0 ? saved.activityTypes : DEFAULT_ACTIVITY_TYPES;
    } catch {
      return DEFAULT_ACTIVITY_TYPES;
    }
  });

  const [attendanceStatuses, setAttendanceStatuses] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_ITEMS_STORAGE_KEY) || '{}');
      return Array.isArray(saved.attendanceStatuses) && saved.attendanceStatuses.length > 0
        ? saved.attendanceStatuses
        : DEFAULT_ATTENDANCE_STATUSES;
    } catch {
      return DEFAULT_ATTENDANCE_STATUSES;
    }
  });

  const [irregularThreshold, setIrregularThreshold] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_ITEMS_STORAGE_KEY) || '{}');
      return Number(saved.irregularThreshold) > 0 ? Number(saved.irregularThreshold) : 2;
    } catch {
      return 2;
    }
  });

  const [absenceDaysThreshold, setAbsenceDaysThreshold] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_ITEMS_STORAGE_KEY) || '{}');
      return Number(saved.absenceDaysThreshold) > 0 ? Number(saved.absenceDaysThreshold) : 14;
    } catch {
      return 14;
    }
  });

  const [rewardStreakThreshold, setRewardStreakThreshold] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_ITEMS_STORAGE_KEY) || '{}');
      return Number(saved.rewardStreakThreshold) > 0 ? Number(saved.rewardStreakThreshold) : 4;
    } catch {
      return 4;
    }
  });

  const [officialStartTime, setOfficialStartTime] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_ITEMS_STORAGE_KEY) || '{}');
      return saved.officialStartTime || '10:00';
    } catch {
      return '10:00';
    }
  });

  const [graceMinutes, setGraceMinutes] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_ITEMS_STORAGE_KEY) || '{}');
      return Number.isFinite(Number(saved.graceMinutes)) && Number(saved.graceMinutes) >= 0
        ? Number(saved.graceMinutes)
        : 10;
    } catch {
      return 10;
    }
  });

  const [showItemsManager, setShowItemsManager] = useState(false);

  const persistCustomItems = async (
    nextNoteTags,
    nextActivityTypes,
    nextAttendanceStatuses,
    nextIrregularThreshold = irregularThreshold,
    nextAbsenceDaysThreshold = absenceDaysThreshold,
    nextOfficialStartTime = officialStartTime,
    nextGraceMinutes = graceMinutes,
    nextRewardStreakThreshold = rewardStreakThreshold
  ) => {
    const payload = {
      noteTags: nextNoteTags,
      activityTypes: nextActivityTypes,
      attendanceStatuses: nextAttendanceStatuses,
      irregularThreshold: nextIrregularThreshold,
      absenceDaysThreshold: nextAbsenceDaysThreshold,
      officialStartTime: nextOfficialStartTime,
      graceMinutes: nextGraceMinutes,
      rewardStreakThreshold: nextRewardStreakThreshold
    };
    try {
      localStorage.setItem(CUSTOM_ITEMS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }

    if (supabase && typeof supabase.from === 'function') {
      try {
        await supabase
          .from('service_settings')
          .upsert(
            {
              key: 'servant_custom_items',
              value: payload,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'key' }
          );
      } catch {
        // works locally
      }
    }
  };

  useEffect(() => {
    if (!supabase || typeof supabase.from !== 'function') return;
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('service_settings')
          .select('value')
          .eq('key', 'servant_custom_items')
          .maybeSingle();

        if (!active || error || !data?.value) return;
        if (Array.isArray(data.value.noteTags) && data.value.noteTags.length > 0) {
          setNoteTags(data.value.noteTags);
        }
        if (Array.isArray(data.value.activityTypes) && data.value.activityTypes.length > 0) {
          setActivityTypes(data.value.activityTypes);
        }
        if (Array.isArray(data.value.attendanceStatuses) && data.value.attendanceStatuses.length > 0) {
          setAttendanceStatuses(data.value.attendanceStatuses);
        }
        if (Number(data.value.irregularThreshold) > 0) {
          setIrregularThreshold(Number(data.value.irregularThreshold));
        }
        if (Number(data.value.absenceDaysThreshold) > 0) {
          setAbsenceDaysThreshold(Number(data.value.absenceDaysThreshold));
        }
        if (data.value.officialStartTime) {
          setOfficialStartTime(data.value.officialStartTime);
        }
        if (Number.isFinite(Number(data.value.graceMinutes)) && Number(data.value.graceMinutes) >= 0) {
          setGraceMinutes(Number(data.value.graceMinutes));
        }
        if (Number(data.value.rewardStreakThreshold) > 0) {
          setRewardStreakThreshold(Number(data.value.rewardStreakThreshold));
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase || typeof supabase.from !== 'function') return;
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('church_trips')
          .select('*')
          .order('trip_date', { ascending: true });
        if (active && !error && Array.isArray(data)) {
          setServantTrips(data);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!servant?.id || !supabase || typeof supabase.channel !== 'function') return;

    const normServantPhone = normalizePhone(servant.phone);

    const channel = supabase
      .channel(`servant-invites-alert-${servant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'church_invitations'
        },
        (payload) => {
          const row = payload.new || payload.old;
          const matchesServant =
            row?.recipient_user_id === servant.id ||
            (normServantPhone && normalizePhone(row?.recipient_phone) === normServantPhone);
          if (!matchesServant) return;

          if (payload.eventType === 'INSERT' && payload.new) {
            const tierLabel = payload.new.invite_tier === 'vip' ? 'VIP' : 'عامة';
            setLiveInviteToast(
              `وصلتك دعوة ${tierLabel}: ${payload.new.event_title}${payload.new.seat_or_zone ? ` (${payload.new.seat_or_zone})` : ''} — كود: ${payload.new.qr_token}`
            );
          } else if (payload.eventType === 'UPDATE' && payload.new?.status === 'checked_in') {
            setLiveInviteToast(`تم مسح QR الدعوة (${payload.new.event_title}) وتسجيل دخولك.`);
          }
        }
      )
      .subscribe();

    return () => {
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel);
      }
    };
  }, [servant?.id, servant?.phone]);

  const triggerMemberPhotoCapture = (member) => {
    if (!member?.id) return;
    pendingPhotoMemberRef.current = member;
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  };

  const handlePhotoFileChange = async (e) => {
    const file = e.target.files?.[0];
    const targetMember = pendingPhotoMemberRef.current;
    if (!file || !targetMember?.id) return;

    setUploadingPhotoMemberId(targetMember.id);
    try {
      const compressedDataUrl = await compressPhotoFile(file, 480, 0.72);
      let finalPhotoUrl = compressedDataUrl;

      if (supabase?.storage && typeof supabase.storage.from === 'function') {
        try {
          const filePath = `${targetMember.id}/${Date.now()}.jpg`;
          const blob = await (await fetch(compressedDataUrl)).blob();
          const { error: uploadErr } = await supabase.storage
            .from('member-photos')
            .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

          if (!uploadErr) {
            const { data: pubData } = supabase.storage.from('member-photos').getPublicUrl(filePath);
            if (pubData?.publicUrl) {
              finalPhotoUrl = pubData.publicUrl;
            }
          }
        } catch {
          // ignore
        }
      }

      setLocalMemberPhotos(prev => ({ ...prev, [targetMember.id]: finalPhotoUrl }));

      if (supabase && typeof supabase.from === 'function') {
        const { error: dbErr } = await supabase
          .from('church_users')
          .update({ avatar_url: finalPhotoUrl })
          .eq('id', targetMember.id);

        if (!dbErr && typeof onRefresh === 'function') {
          onRefresh();
        }
      }
    } catch (err) {
      console.error('خطأ أثناء التقاط/حفظ صورة المخدوم:', err);
      alert('تعذر معالجة الصورة، حاول مرة أخرى.');
    } finally {
      setUploadingPhotoMemberId(null);
      pendingPhotoMemberRef.current = null;
    }
  };

  const acknowledgedStorageKey = `acked_member_notes_${servant?.id || servant?.username || 'default'}`;

  const [hiddenNotes, setHiddenNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(acknowledgedStorageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(acknowledgedStorageKey);
      setHiddenNotes(saved ? JSON.parse(saved) : {});
    } catch {
      setHiddenNotes({});
    }
  }, [acknowledgedStorageKey]);

  const handleAcknowledgeNote = async (note) => {
    if (!note?.id) return;

    const persistHidden = (map) => {
      try {
        localStorage.setItem(acknowledgedStorageKey, JSON.stringify(map));
      } catch {
        // ignore
      }
    };

    const updatedMap = { ...hiddenNotes, [note.id]: true };
    setHiddenNotes(updatedMap);
    persistHidden(updatedMap);

    if (typeof onAcknowledgeNote === 'function') {
      try {
        await onAcknowledgeNote(note);
      } catch {
        // ignore
      }
    }

    if (!supabase || typeof supabase.from !== 'function') return;

    try {
      const { data, error } = await supabase
        .from('member_notes')
        .update({ is_read: true, acknowledged: true })
        .eq('id', note.id)
        .select('id');

      if (error || !Array.isArray(data) || data.length === 0) {
        const rolledBack = { ...updatedMap };
        delete rolledBack[note.id];
        setHiddenNotes(rolledBack);
        persistHidden(rolledBack);
        console.error('فشل حفظ تأكيد الملاحظة:', error?.message || 'لم يتم تحديث أي صف (غالباً صلاحيات RLS)');
        alert('تعذر حفظ "علمت" في قاعدة البيانات، حاول مرة أخرى أو راجع الصلاحيات.');
        return;
      }

      try {
        await supabase
          .from('member_notes')
          .update({
            acknowledged_at: new Date().toISOString(),
            acknowledged_by: servant?.full_name || servant?.username || String(servant?.id || 'servant'),
            acknowledged_by_role: 'servant'
          })
          .eq('id', note.id);
      } catch {
        // ignore
      }

      if (typeof onRefresh === 'function') onRefresh();
    } catch (err) {
      console.error('تعذر تحديث الملاحظة في قاعدة البيانات:', err);
    }
  };

  const baseGroups = Array.isArray(serviceGroups) && serviceGroups.length > 0
    ? serviceGroups
    : DEFAULT_SERVICE_GROUPS;

  const [localGroups, setLocalGroups] = useState(baseGroups);
  const [localServices, setLocalServices] = useState(Array.isArray(services) ? services : []);

  useEffect(() => {
    setLocalGroups(Array.isArray(serviceGroups) && serviceGroups.length > 0 ? serviceGroups : DEFAULT_SERVICE_GROUPS);
  }, [serviceGroups]);

  useEffect(() => {
    setLocalServices(Array.isArray(services) ? services : []);
  }, [services]);

  const effectiveGroups = [...new Map([
    ...CORE_SERVICE_GROUPS.map((name, idx) => {
      const existing = localGroups.find(g => g.group_name === name);
      if (existing) return [name, existing];
      const fallback = DEFAULT_SERVICE_GROUPS.find(g => g.group_name === name);
      return [name, fallback || { id: `core-${idx}`, group_name: name, stages: [] }];
    }),
    ...localGroups.map(g => [g.group_name, g])
  ]).values()];

  const canScanInvitations = useMemo(
    () =>
      canScanChurchInvitations(servant) ||
      isScoutServant(servant, localServices, localGroups),
    [servant, localServices, localGroups]
  );

  const assignedClass = (servant?.assigned_class || '').trim();
  const baseStages = (servant?.service_stage || servant?.detailed_stage || '')
    .split(/[,،]/)
    .map(s => s.trim())
    .filter(Boolean);
  const extraServices = Array.isArray(servant?.permissions?.extra_services) ? servant.permissions.extra_services : [];

  function splitCommaClasses(val) {
    return String(val || '')
      .split(/[,،]/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  const rawBoundTargets = [...new Set([
    ...(assignedClass ? splitCommaClasses(assignedClass) : []),
    ...baseStages,
    ...extraServices
  ])].filter(Boolean);

  const mainServiceNames = effectiveGroups.map(g => g.group_name).filter(Boolean);

  const resolveParentGroupName = (targetName) => {
    if (!targetName) return mainServiceNames[0] || 'خدمة حضانة وطفولة';
    const directGroup = effectiveGroups.find(g => g.group_name === targetName);
    if (directGroup) return directGroup.group_name;

    const groupByStage = effectiveGroups.find(g => normalizeGroupStages(g.stages).includes(targetName));
    if (groupByStage) return groupByStage.group_name;

    const classObj = localServices.find(s => s.class_name === targetName || s.stage_name === targetName);
    if (classObj) {
      const grp = effectiveGroups.find(
        g => g.group_name === classObj.stage_name || normalizeGroupStages(g.stages).includes(classObj.stage_name)
      );
      if (grp) return grp.group_name;
    }

    if (targetName.includes('حضانة') || targetName.includes('طفولة')) return 'خدمة حضانة وطفولة';
    if (targetName.includes('ابتدائي')) return 'خدمة ابتدائي';
    if (targetName.includes('إعدادي') || targetName.includes('اعدادي')) return 'خدمة إعدادي';
    if (targetName.includes('ثانوي')) return 'خدمة ثانوي';
    if (targetName.includes('جامعة') || targetName.includes('خريجين')) return 'خدمة جامعة وخريجين';
    return 'خدمات واجتماعات خاصة';
  };

  const servantBoundMainGroups = isAdminUser
    ? mainServiceNames
    : [...new Set(rawBoundTargets.map(resolveParentGroupName))];

  const availableServicesList = mainServiceNames.length > 0
    ? mainServiceNames
    : ['خدمة حضانة وطفولة', 'خدمة ابتدائي', 'خدمة إعدادي', 'خدمة ثانوي', 'خدمة جامعة وخريجين', 'خدمات واجتماعات خاصة'];

  const initialDefaultScope = isAdminUser
    ? (availableServicesList[0] || 'خدمة حضانة وطفولة')
    : (servantBoundMainGroups[0] || availableServicesList[0] || 'خدمة حضانة وطفولة');

  const [selectedScope, setSelectedScope] = useState(initialDefaultScope);
  const [selectedYearFilter, setSelectedYearFilter] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [showAllChurchServices, setShowAllChurchServices] = useState(isAdminUser || servantBoundMainGroups.length === 0);
  const [editMode, setEditMode] = useState(false);

  const [newGroupName, setNewGroupName] = useState('');
  const [newYearName, setNewYearName] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newClassStage, setNewClassStage] = useState('');

  const defaultGenderScope = (() => {
    const saved = servant?.permissions?.service_gender_scope;
    if (saved && GENDER_SCOPES.includes(saved)) return saved;
    const clsText = assignedClass;
    if (clsText.includes('بنات')) return 'بنات';
    if (clsText.includes('بنين')) return 'بنين';
    return 'الكل';
  })();

  const [selectedGenderFilter, setSelectedGenderFilter] = useState(defaultGenderScope);
  const [activeTab, setActiveTab] = useState('search');
  const [selectedCaseTagFilter, setSelectedCaseTagFilter] = useState('الكل');

  const [cardDensity, setCardDensity] = useState('compact');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [quickStatusModal, setQuickStatusModal] = useState({
    open: false,
    member: null,
    statusCode: 'late',
    statusLabel: 'تأخير',
    activity_date: getTodayLocalDate(),
    activity_type: activityTypes[0] || 'مدارس أحد',
    expected_time: officialStartTime,
    check_in_time: getNowHHMM(),
    check_out_time: getNowHHMM(),
    reason: ''
  });

  const [rewardModal, setRewardModal] = useState({
    open: false,
    member: null,
    streakCount: 0,
    reward_type: 'رحلة مجانية',
    reward_title: 'رحلة مجانية للمواظبين',
    notes: ''
  });

  const [actModal, setActModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [actForm, setActForm] = useState({
    activity_date: getTodayLocalDate(),
    activity_type: activityTypes[0] || 'مدارس أحد',
    status_code: 'present',
    expected_time: officialStartTime,
    check_in_time: getNowHHMM(),
    check_out_time: '',
    attended: true,
    notes: ''
  });

  const [noteModal, setNoteModal] = useState(false);
  const [noteMember, setNoteMember] = useState(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteTag, setNewNoteTag] = useState(noteTags[0] || 'عادي');

  const emptyMember = {
    username: '',
    password: '123',
    role: 'member',
    first_name: '', second_name: '', third_name: '', fourth_name: '',
    father_first: '', father_second: '', father_third: '', father_fourth: '',
    mother_first: '', mother_second: '', mother_third: '', mother_fourth: '',
    father_phone: '', mother_phone: '', phone: '',
    gender: 'ذكر',
    marital_status: 'أعزب',
    church_name: '',
    confession_father: '',
    is_studying: true,
    detailed_stage: baseStages[0] || 'أولى ابتدائي',
    service_stage: baseStages[0] || 'أولى ابتدائي',
    assigned_class: splitCommaClasses(assignedClass)[0] || '',
    dob: '', address: '',
    confession_status: 'منتظم',
    has_communion: true,
    member_status: 'active'
  };
  const [newMember, setNewMember] = useState(emptyMember);

  useEffect(() => {
    if (!availableServicesList.includes(selectedScope) && availableServicesList.length > 0) {
      setSelectedScope(initialDefaultScope);
      setSelectedYearFilter('');
      setSelectedClassFilter('');
    }
  }, [localGroups, localServices, servant]);

  useEffect(() => {
    if (!supabase || typeof supabase.channel !== 'function' || typeof onRefresh !== 'function') return;
    const channel = supabase
      .channel('servant-dashboard-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_groups' }, () => {
        onRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => {
        onRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'church_users' }, () => {
        onRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_notes' }, () => {
        onRefresh();
      })
      .subscribe();

    return () => {
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel);
      }
    };
  }, [onRefresh]);

  const notifyStructureChange = (nextGroups, nextServices, actionMeta) => {
    setLocalGroups(nextGroups);
    setLocalServices(nextServices);
    if (typeof onUpdateServiceStructure === 'function') {
      onUpdateServiceStructure({
        serviceGroups: nextGroups,
        services: nextServices,
        ...actionMeta
      });
    }
  };

  const getScopeStructure = (scope) => {
    const matchedGroup = effectiveGroups.find(g => g.group_name === scope) || null;
    const rawGroupStages = matchedGroup ? normalizeGroupStages(matchedGroup.stages) : [];

    const groupClasses = localServices.filter(
      s =>
        s.stage_name === scope ||
        rawGroupStages.includes(s.stage_name) ||
        (matchedGroup && s.stage_name === matchedGroup.group_name)
    );

    const inferredYears = new Set([...rawGroupStages]);
    groupClasses.forEach(cls => {
      if (cls.stage_name && cls.stage_name !== scope && !matchedGroup?.group_name?.includes(cls.stage_name)) {
        inferredYears.add(cls.stage_name);
      }
      const txt = `${cls.class_name || ''} ${cls.stage_name || ''}`;
      STAGE_OPTIONS.forEach(st => {
        if (txt.includes(st)) inferredYears.add(st);
      });
    });

    const filteredYears = [...inferredYears].filter(Boolean);

    const years = [...new Set(filteredYears)].map(yrName => {
      const classesForYr = groupClasses.filter(
        c => c.stage_name === yrName || String(c.class_name || '').includes(yrName)
      );
      return { yearName: yrName, classes: classesForYr };
    });

    return {
      matchedGroup,
      groupStages: filteredYears,
      groupClasses,
      years
    };
  };

  const memberMatchesScope = (m, scope, genderFilter = 'الكل', yearFilter = '', classFilter = '') => {
    if (!scope) return false;
    const mClass = (m.assigned_class || '').trim();
    const mStages = `${m.detailed_stage || ''} ${m.service_stage || ''}`;
    const mExtra = Array.isArray(m.permissions?.extra_services) ? m.permissions.extra_services.join(' ') : '';
    const combinedMemberText = `${mClass} ${mStages} ${mExtra}`;

    const { matchedGroup, groupStages, groupClasses } = getScopeStructure(scope);
    const groupClassNames = groupClasses.map(s => (s.class_name || '').trim()).filter(Boolean);

    const matchesServiceOrClass =
      mClass === scope ||
      mStages.includes(scope) ||
      mExtra.includes(scope) ||
      groupStages.some(st => combinedMemberText.includes(st)) ||
      groupClassNames.some(cName => mClass === cName || combinedMemberText.includes(cName)) ||
      (matchedGroup && combinedMemberText.includes(matchedGroup.group_name));

    if (!matchesServiceOrClass) return false;

    if (yearFilter && !combinedMemberText.includes(yearFilter)) {
      const yrObj = getScopeStructure(scope).years.find(y => y.yearName === yearFilter);
      const yrClassNames = (yrObj?.classes || []).map(c => c.class_name);
      if (!yrClassNames.includes(mClass)) return false;
    }

    if (classFilter && mClass !== classFilter && !combinedMemberText.includes(classFilter)) {
      return false;
    }

    if (genderFilter === 'بنين') {
      return isMaleMember(m) || mClass.includes('بنين');
    }
    if (genderFilter === 'بنات') {
      return isFemaleMember(m) || mClass.includes('بنات');
    }

    const boundGender = servant?.permissions?.service_gender_scope;
    if (!isAdminUser && isPrepOrSecondaryScope(scope) && boundGender && boundGender !== 'الكل') {
      if (boundGender === 'بنين') return isMaleMember(m) || mClass.includes('بنين');
      if (boundGender === 'بنات') return isFemaleMember(m) || mClass.includes('بنات');
    }

    return true;
  };

  const handleAddMainService = () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    if (localGroups.some(g => g.group_name === trimmed)) {
      setSelectedScope(trimmed);
      setNewGroupName('');
      return;
    }
    const created = {
      id: `grp-${Date.now()}`,
      group_name: trimmed,
      icon: '⛪',
      stages: []
    };
    const nextGroups = [...localGroups, created];
    notifyStructureChange(nextGroups, localServices, { type: 'add_group', group: created });
    setSelectedScope(trimmed);
    setSelectedYearFilter('');
    setSelectedClassFilter('');
    setNewGroupName('');
  };

  const handleAddYearToScope = () => {
    const trimmed = newYearName.trim();
    if (!trimmed || !selectedScope) return;

    const existingGroup = localGroups.find(g => g.group_name === selectedScope);
    let nextGroups;

    if (existingGroup) {
      const currentStages = normalizeGroupStages(existingGroup.stages);
      if (currentStages.includes(trimmed)) {
        setSelectedYearFilter(trimmed);
        setNewYearName('');
        return;
      }
      nextGroups = localGroups.map(g =>
        g.group_name === selectedScope
          ? { ...g, stages: [...currentStages, trimmed] }
          : g
      );
    } else {
      nextGroups = [
        ...localGroups,
        {
          id: `grp-${Date.now()}`,
          group_name: selectedScope,
          icon: '📘',
          stages: [trimmed]
        }
      ];
    }

    notifyStructureChange(nextGroups, localServices, {
      type: 'add_year',
      scope: selectedScope,
      yearName: trimmed
    });
    setSelectedYearFilter(trimmed);
    setNewClassStage(trimmed);
    setNewYearName('');
  };

  const handleAddClassToScope = () => {
    const trimmed = newClassName.trim();
    if (!trimmed || !selectedScope) return;
    const targetStage = (newClassStage || selectedYearFilter || selectedScope).trim();

    if (localServices.some(s => s.class_name === trimmed && s.stage_name === targetStage)) {
      setSelectedClassFilter(trimmed);
      setNewClassName('');
      return;
    }

    const createdService = {
      id: `srv-${Date.now()}`,
      class_name: trimmed,
      stage_name: targetStage,
      service_name: selectedScope
    };

    const nextServices = [...localServices, createdService];

    let nextGroups = localGroups;
    const grp = localGroups.find(g => g.group_name === selectedScope);
    if (grp && targetStage && targetStage !== selectedScope) {
      const currentStages = normalizeGroupStages(grp.stages);
      if (!currentStages.includes(targetStage)) {
        nextGroups = localGroups.map(g =>
          g.group_name === selectedScope
            ? { ...g, stages: [...currentStages, targetStage] }
            : g
        );
      }
    }

    notifyStructureChange(nextGroups, nextServices, {
      type: 'add_class',
      scope: selectedScope,
      yearName: targetStage,
      classObj: createdService
    });
    if (targetStage && targetStage !== selectedScope) {
      setSelectedYearFilter(targetStage);
    }
    setSelectedClassFilter(trimmed);
    setNewClassName('');
  };

  const displayedServiceTabs = showAllChurchServices
    ? availableServicesList
    : (servantBoundMainGroups.length > 0 ? servantBoundMainGroups : availableServicesList);

  const allMembers = users.filter(u => u.role === 'member');
  const allServants = users.filter(u => u.role && u.role !== 'member');

  const resolveGuardianInfo = (member) => {
    const linkedParent = users.find(
      u =>
        (member.parent_id && u.id === member.parent_id) ||
        (member.father_id && u.id === member.father_id) ||
        (member.mother_id && u.id === member.mother_id)
    );
    const name =
      linkedParent?.full_name ||
      member.guardian_name ||
      member.father_full_name ||
      member.mother_full_name ||
      'غير مسجل';
    const phone =
      linkedParent?.phone ||
      member.father_phone ||
      member.mother_phone ||
      '';
    const relationLabel = linkedParent
      ? (linkedParent.guardian_type === 'mother' ? 'ولي الأمر (الأم)' : 'ولي الأمر المربوط')
      : member.father_full_name
        ? 'ولي الأمر (الأب)'
        : member.mother_full_name
          ? 'ولي الأمر (الأم)'
          : 'ولي الأمر';
    return { name, phone, relationLabel, isLinkedAccount: Boolean(linkedParent) };
  };

  const currentMonth = new Date().getMonth() + 1;
  const currentToday = new Date().getDate();

  const currentMonthMemberBirthdays = allMembers
    .map(m => {
      const md = getBirthMonthDay(m.dob);
      if (!md || md.month !== currentMonth) return null;
      return { ...m, birthDay: md.day, birthMonth: md.month };
    })
    .filter(Boolean)
    .sort((a, b) => a.birthDay - b.birthDay);

  const currentMonthServantBirthdays = allServants
    .filter(s => s.id !== servant?.id)
    .map(s => {
      const md = getBirthMonthDay(s.dob);
      if (!md || md.month !== currentMonth) return null;
      return { ...s, birthDay: md.day, birthMonth: md.month };
    })
    .filter(Boolean)
    .sort((a, b) => a.birthDay - b.birthDay);

  const scopeMembers = allMembers.filter(m =>
    memberMatchesScope(m, selectedScope, selectedGenderFilter, selectedYearFilter, selectedClassFilter)
  );

  const { generalTripsForServant, myServiceTripsForServant } = (() => {
    const scopeTokens = [
      selectedScope,
      selectedYearFilter,
      selectedClassFilter,
      ...rawBoundTargets,
      ...servantBoundMainGroups
    ]
      .map(normalizeTripText)
      .filter(t => t.length >= 2);

    const gen = [];
    const mine = [];

    for (const tr of servantTrips) {
      if (isGeneralChurchTrip(tr)) {
        gen.push(tr);
        continue;
      }
      const tgt = normalizeTripText(
        tr.target_service || tr.stage_name || tr.service_name || tr.assigned_class || ''
      );
      const matchesMine = scopeTokens.some(
        tok =>
          tgt === tok ||
          (tgt.length >= 3 && tok.includes(tgt)) ||
          (tok.length >= 3 && tgt.includes(tok))
      );
      if (matchesMine) {
        mine.push(tr);
      }
    }

    return { generalTripsForServant: gen, myServiceTripsForServant: mine };
  })();

  const currentScopeStructure = getScopeStructure(selectedScope);
  const currentYearObj = currentScopeStructure.years.find(y => y.yearName === selectedYearFilter) || null;
  const visibleClassesForSelection = currentYearObj
    ? currentYearObj.classes
    : currentScopeStructure.groupClasses;

  const hasClassesInCurrentScope = currentScopeStructure.groupClasses.length > 0;
  const boundClassesForServant = [
    ...new Set([
      ...splitCommaClasses(assignedClass),
      ...extraServices.filter(item =>
        currentScopeStructure.groupClasses.some(c => c.class_name === item)
      )
    ])
  ];

  const scopeMemberIds = new Set(scopeMembers.map(m => m.id));
  const scopeBirthdays = birthdays.filter(b => scopeMemberIds.has(b.id));

  const getMemberPhoto = (m) => localMemberPhotos[m.id] || m.avatar_url || m.photo_url || '';

  const getMemberActiveNotes = (memberId) =>
    memberNotes.filter(
      n => n.member_id === memberId && !hiddenNotes[n.id] && !n.is_read && !n.acknowledged
    );

  const getMemberInsights = (memberId) => {
    const mActs = activities
      .filter(a => a.member_id === memberId)
      .sort((a, b) => new Date(b.activity_date) - new Date(a.activity_date));

    const attendedCount = mActs.filter(a => Boolean(a.attended)).length;
    const isRegularAndRewardEligible = attendedCount >= rewardStreakThreshold;

    const recent30DaysActs = mActs.filter(a => {
      const diffDays = Math.floor((Date.now() - new Date(a.activity_date).getTime()) / 86400000);
      return diffDays <= 30;
    });

    const irregularCount = recent30DaysActs.filter(a => {
      const txt = `${a.status_code || ''} ${a.notes || ''}`.toLowerCase();
      const hasDelay = Number(a.delay_minutes) > 0 || txt.includes('تأخر') || txt.includes('late');
      const hasEarlyLeave = Number(a.early_leave_minutes) > 0 || txt.includes('انصراف مبكر') || txt.includes('early_leave');
      return hasDelay || hasEarlyLeave;
    }).length;

    const hasQuestionMarks = irregularCount >= irregularThreshold;

    const activeNotes = getMemberActiveNotes(memberId);
    const hasFollowUpNote = activeNotes.some(n => {
      const t = String(n.behavior_tag || '');
      return t.includes('افتقاد') || t.includes('متابعة') || t.includes('مشاكل');
    });

    if (mActs.length === 0) {
      return {
        needsFollowUp: hasFollowUpNote || hasQuestionMarks,
        unrecordedYet: true,
        hasQuestionMarks,
        irregularCount,
        attendedCount,
        isRegularAndRewardEligible: false,
        label: 'لم يُسجل حضور بعد',
        badgeColor: 'bg-gray-100 text-gray-700',
        accentBar: hasQuestionMarks ? 'border-r-4 border-r-amber-600' : 'border-r-4 border-r-gray-400',
        avatarTone: 'bg-slate-100 text-slate-700 border-slate-200'
      };
    }

    const lastAct = mActs[0];
    const daysSinceLast = Math.floor((Date.now() - new Date(lastAct.activity_date).getTime()) / 86400000);
    const isAbsentOrOverdue = !lastAct.attended || daysSinceLast > absenceDaysThreshold;
    const needsFollowUp = isAbsentOrOverdue || hasFollowUpNote || hasQuestionMarks;

    if (!lastAct.attended) {
      return {
        needsFollowUp,
        unrecordedYet: false,
        hasQuestionMarks,
        irregularCount,
        attendedCount,
        isRegularAndRewardEligible: false,
        label: `غائب آخر لقاء (${lastAct.activity_date || '—'}) ⚠️`,
        badgeColor: 'bg-red-100 text-red-800',
        accentBar: 'border-r-4 border-r-red-600',
        avatarTone: 'bg-red-50 text-[#7a1c24] border-red-200'
      };
    }

    if (daysSinceLast > absenceDaysThreshold) {
      return {
        needsFollowUp,
        unrecordedYet: false,
        hasQuestionMarks,
        irregularCount,
        attendedCount,
        isRegularAndRewardEligible: false,
        label: `منقطع منذ ${daysSinceLast} يوم ⚠️`,
        badgeColor: 'bg-red-100 text-red-800',
        accentBar: 'border-r-4 border-r-red-600',
        avatarTone: 'bg-red-50 text-[#7a1c24] border-red-200'
      };
    }

    const timeBadge =
      lastAct.check_in_time || lastAct.check_out_time
        ? ` (${lastAct.check_in_time ? `دخول ${lastAct.check_in_time}` : ''}${lastAct.check_in_time && lastAct.check_out_time ? ' • ' : ''}${lastAct.check_out_time ? `انصراف ${lastAct.check_out_time}` : ''})`
        : '';

    return {
      needsFollowUp,
      unrecordedYet: false,
      hasQuestionMarks,
      irregularCount,
      attendedCount,
      isRegularAndRewardEligible,
      label: `حضر آخر لقاء${timeBadge} ✅`,
      badgeColor: 'bg-green-100 text-green-800',
      accentBar: isRegularAndRewardEligible
        ? 'border-r-4 border-r-amber-500'
        : (hasQuestionMarks ? 'border-r-4 border-r-amber-600' : 'border-r-4 border-r-emerald-600'),
      avatarTone: 'bg-emerald-50 text-emerald-800 border-emerald-200'
    };
  };

  const getInitials = (fullName = '') => {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'م';
    if (parts.length === 1) return parts[0].slice(0, 2);
    return `${parts[0][0]}${parts[1][0]}`;
  };

  const followUpMembers = scopeMembers.filter(m => getMemberInsights(m.id).needsFollowUp);
  const caseTrackingMembers = scopeMembers.filter(m => {
    const activeNotes = getMemberActiveNotes(m.id);
    const insights = getMemberInsights(m.id);
    if (selectedCaseTagFilter === 'الكل') {
      return activeNotes.length > 0 || insights.hasQuestionMarks || insights.isRegularAndRewardEligible;
    }
    return activeNotes.some(n => (n.behavior_tag || noteTags[0] || 'عادي') === selectedCaseTagFilter);
  });

  const modulePool =
    activeTab === 'followup'
      ? followUpMembers
      : activeTab === 'cases'
      ? caseTrackingMembers
      : scopeMembers;

  const displayedMembers = searchQuery.trim() === ''
    ? modulePool
    : modulePool.filter(m => {
      const guardian = resolveGuardianInfo(m);
      return (
        (m.full_name || '') + ' ' +
        (m.phone || '') + ' ' +
        guardian.name + ' ' +
        guardian.phone + ' ' +
        (m.father_full_name || '') + ' ' +
        (m.mother_full_name || '') + ' ' +
        (m.address || '') + ' ' +
        (m.assigned_class || '')
      ).toLowerCase().includes(searchQuery.toLowerCase());
    });

  const buildActivityPayload = (formObj, reasonText = '') => {
    const statusObj =
      attendanceStatuses.find(s => s.code === formObj.status_code) ||
      DEFAULT_ATTENDANCE_STATUSES.find(s => s.code === formObj.status_code) ||
      attendanceStatuses[0] || { code: 'present', label: 'حاضر', attended: true };

    const lockedTodayDate = getTodayLocalDate();
    const nowTime = getNowHHMM();
    const effectiveCheckIn = formObj.check_in_time || nowTime;
    const effectiveExpected = formObj.expected_time || officialStartTime || '10:00';
    const effectiveCheckOut = formObj.check_out_time || nowTime;

    const expectedMins = parseTimeToMinutes(effectiveExpected);
    const checkInMins = parseTimeToMinutes(effectiveCheckIn);

    const rawDiff =
      expectedMins !== null && checkInMins !== null && checkInMins > expectedMins
        ? checkInMins - expectedMins
        : 0;

    const countedDelayMinutes =
      formObj.status_code === 'late' || rawDiff > graceMinutes
        ? Math.max(rawDiff, formObj.status_code === 'late' ? Math.max(rawDiff, 1) : 0)
        : 0;

    const earlyLeaveMinutes =
      formObj.status_code === 'early_leave'
        ? 15
        : 0;

    const cleanReason = (reasonText || formObj.notes || '').trim();
    const notesParts = [];

    if (formObj.status_code === 'present') {
      notesParts.push(`حضر الساعة ${effectiveCheckIn}`);
      if (rawDiff > 0 && rawDiff <= graceMinutes) {
        notesParts.push(`ضمن فترة السماح (${graceMinutes} د)`);
      } else if (countedDelayMinutes > 0) {
        notesParts.push(`تأخر ${countedDelayMinutes} دقيقة`);
      }
    } else if (formObj.status_code === 'absent') {
      notesParts.push('غائب');
    } else if (formObj.status_code === 'early_leave') {
      notesParts.push(`انصراف مبكر الساعة ${effectiveCheckOut}`);
    } else if (formObj.status_code === 'late') {
      notesParts.push(`تأخير — وصل الساعة ${effectiveCheckIn}${countedDelayMinutes > 0 ? ` (${countedDelayMinutes} د)` : ''}`);
    } else if (formObj.status_code === 'excused') {
      notesParts.push('معتذر');
    } else {
      notesParts.push(statusObj.label);
    }

    if (cleanReason) {
      notesParts.push(`السبب: ${cleanReason}`);
    }

    return {
      activity_date: lockedTodayDate,
      activity_type: formObj.activity_type || activityTypes[0] || 'مدارس أحد',
      status_code: statusObj.code,
      expected_time: effectiveExpected,
      check_in_time: formObj.status_code === 'absent' || formObj.status_code === 'excused' ? null : effectiveCheckIn,
      check_out_time: formObj.status_code === 'early_leave' ? effectiveCheckOut : null,
      delay_minutes: countedDelayMinutes,
      early_leave_minutes: earlyLeaveMinutes,
      attended: Boolean(statusObj.attended),
      reason: cleanReason || null,
      notes: notesParts.join(' — ')
    };
  };

  const handleQuickMemberAttendance = (member, statusCode) => {
    const todayStr = getTodayLocalDate();
    const nowStr = getNowHHMM();
    const statusObj =
      attendanceStatuses.find(s => s.code === statusCode) ||
      DEFAULT_ATTENDANCE_STATUSES.find(s => s.code === statusCode) ||
      { code: statusCode, label: statusCode, attended: true };

    if (statusCode === 'late' || statusCode === 'early_leave' || statusCode === 'excused') {
      setQuickStatusModal({
        open: true,
        member,
        statusCode,
        statusLabel: statusObj.label,
        activity_date: todayStr,
        activity_type: activityTypes[0] || 'مدارس أحد',
        expected_time: officialStartTime || '10:00',
        check_in_time: nowStr,
        check_out_time: nowStr,
        reason: ''
      });
      return;
    }

    if (typeof onSaveActivity === 'function') {
      const payload = buildActivityPayload({
        activity_date: todayStr,
        activity_type: activityTypes[0] || 'مدارس أحد',
        status_code: statusCode,
        expected_time: officialStartTime || '10:00',
        check_in_time: nowStr,
        check_out_time: '',
        notes: ''
      });
      onSaveActivity(member.id, payload);
    }
  };

  const handleConfirmQuickStatusModal = (e) => {
    e.preventDefault();
    if (!quickStatusModal.member || typeof onSaveActivity !== 'function') return;

    const payload = buildActivityPayload(
      {
        activity_date: getTodayLocalDate(),
        activity_type: quickStatusModal.activity_type,
        status_code: quickStatusModal.statusCode,
        expected_time: quickStatusModal.expected_time,
        check_in_time: quickStatusModal.check_in_time,
        check_out_time: quickStatusModal.check_out_time,
        notes: ''
      },
      quickStatusModal.reason
    );

    onSaveActivity(quickStatusModal.member.id, payload);
    setQuickStatusModal(prev => ({ ...prev, open: false, reason: '' }));
  };

  const handleSaveReward = async (e) => {
    e.preventDefault();
    if (!rewardModal.member) return;

    const rewardSummary = `🌟 ${rewardModal.reward_type}: ${rewardModal.reward_title} (مواظبة ${rewardModal.streakCount} لقاءات)${rewardModal.notes ? ` — ${rewardModal.notes}` : ''}`;

    if (typeof onSaveMemberNote === 'function') {
      onSaveMemberNote({
        member_id: rewardModal.member.id,
        author_id: servant?.id,
        note_text: rewardSummary,
        behavior_tag: 'مجد ومجتهد'
      });
    }

    if (supabase && typeof supabase.from === 'function') {
      try {
        await supabase.from('member_rewards').insert({
          member_id: rewardModal.member.id,
          reward_type: rewardModal.reward_type,
          reward_title: rewardModal.reward_title,
          attendance_streak: rewardModal.streakCount,
          granted_by: servant?.full_name || servant?.username || 'servant',
          granted_date: getTodayLocalDate(),
          notes: rewardModal.notes || null
        });

        await supabase
          .from('church_users')
          .update({
            is_reward_eligible: true,
            regular_attendance_count: rewardModal.streakCount,
            last_reward_note: rewardSummary
          })
          .eq('id', rewardModal.member.id);

        if (typeof onRefresh === 'function') onRefresh();
      } catch {
        // works locally
      }
    }

    setRewardModal(prev => ({ ...prev, open: false, notes: '' }));
  };

  const openAddMemberModal = () => {
    if (!canAdd) return alert('🔒 غير مسموح لك بإضافة مخدومين حسب صلاحياتك الحالية.');
    const matchingClass = localServices.find(
      s =>
        s.class_name === (selectedClassFilter || selectedScope) ||
        s.stage_name === (selectedYearFilter || selectedScope)
    );
    const defaultGenderForModal =
      selectedGenderFilter === 'بنات' ? 'أنثى' :
      selectedGenderFilter === 'بنين' ? 'ذكر' : 'ذكر';

    setNewMember({
      ...emptyMember,
      gender: defaultGenderForModal,
      assigned_class: selectedClassFilter || matchingClass?.class_name || splitCommaClasses(assignedClass)[0] || '',
      detailed_stage: selectedYearFilter || (STAGE_OPTIONS.includes(selectedScope) ? selectedScope : (matchingClass?.stage_name || selectedScope || baseStages[0] || 'أولى ابتدائي')),
      service_stage: selectedYearFilter || (STAGE_OPTIONS.includes(selectedScope) ? selectedScope : (matchingClass?.stage_name || selectedScope || baseStages[0] || 'أولى ابتدائي'))
    });
    setShowAddModal(true);
  };

  const handleCreateMember = (e) => {
    e.preventDefault();
    if (!canAdd) return;
    const full_name = [newMember.first_name, newMember.second_name, newMember.third_name, newMember.fourth_name].map(s => s.trim()).filter(Boolean).join(' ');
    const father_full_name = [newMember.father_first, newMember.father_second, newMember.father_third, newMember.father_fourth].map(s => s.trim()).filter(Boolean).join(' ');
    const mother_full_name = [newMember.mother_first, newMember.mother_second, newMember.mother_third, newMember.mother_fourth].map(s => s.trim()).filter(Boolean).join(' ');

    if (!full_name || !father_full_name || !mother_full_name || !newMember.father_phone || !newMember.mother_phone) {
      alert('يجب إدخال الاسم الرباعي للمخدوم، وأسماء وأرقام تليفونات الأب والأم بشكل إلزامي!');
      return;
    }

    if (typeof onAddMember === 'function') {
      onAddMember({
        ...newMember,
        full_name,
        father_full_name,
        mother_full_name,
        service_stage: newMember.detailed_stage,
        username: newMember.username ? newMember.username.trim().toLowerCase() : ('m_' + Date.now()),
        password: newMember.password || '123',
        dob: newMember.dob || null
      });
    }

    setShowAddModal(false);
    setNewMember(emptyMember);
  };

  const handleNoteSubmit = (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || !noteMember?.id) return;
    if (typeof onSaveMemberNote === 'function') {
      onSaveMemberNote({
        member_id: noteMember.id,
        author_id: servant?.id,
        note_text: newNoteText.trim(),
        behavior_tag: newNoteTag || noteTags[0] || 'عادي'
      });
    }
    setNewNoteText('');
    setNoteModal(false);
  };

  if (canExtractSheet && showMasterSheet) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="bg-white p-4 rounded-2xl border shadow-2xs flex justify-between items-center print:hidden">
          <button
            type="button"
            onClick={() => setShowMasterSheet(false)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black cursor-pointer"
          >
            ← رجوع لشاشة الخدمة
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-[#7a1c24]">📋 شيت التسلسل والافتقاد</span>
          </div>
        </div>
        <MasterCongregationSheet
          users={users}
          currentUser={servant}
          onRefresh={onRefresh}
        />
      </div>
    );
  }

  const activeBirthdayList = birthdayTab === 'members' ? currentMonthMemberBirthdays : currentMonthServantBirthdays;
  const displayedServantTrips = tripSubTab === 'general' ? generalTripsForServant : myServiceTripsForServant;

  const tabsList = [
    { id: 'search', label: '🔍 كشف وبحث المخدومين', badge: scopeMembers.length },
    { id: 'attendance', label: '📋 تسجيل الحضور الفوري', badge: scopeMembers.length },
    { id: 'followup', label: '⚠️ افتقاد وغياب', badge: followUpMembers.length },
    { id: 'cases', label: '🤝 المتابعة وملاحظات الحالة', badge: caseTrackingMembers.length },
    { id: 'my_invites', label: 'دعواتي QR', badge: receivedInvitesCount },
    { id: 'trips', label: '🚌 الرحلات', badge: myServiceTripsForServant.length + generalTripsForServant.length },
    { id: 'analytics', label: '📊 تحليلات ومكافآت الشهر' },
    { id: 'birthdays', label: `🎂 أعياد الميلاد (${activeBirthdayList.length})` },
    ...(canSendInvites ? [{ id: 'invite', label: '💌 دعوة لأبونا لمناسبة' }, { id: 'event_invites', label: '🎟️ دعوات المناسبات (QR)' }] : [])
  ];

  return (
    <div className="space-y-3 text-xs" dir="rtl">
      {liveInviteToast && (
        <div className="bg-emerald-50 border-2 border-emerald-400 p-3 rounded-2xl flex items-center justify-between gap-2 text-emerald-950 font-black">
          <span>{liveInviteToast}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('my_invites')}
              className="px-3 py-1 bg-emerald-700 text-white rounded-xl cursor-pointer"
            >
              عرض الـ QR
            </button>
            <button
              type="button"
              onClick={() => setLiveInviteToast('')}
              className="text-emerald-800 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoFileChange}
        className="hidden"
      />

      <BirthdayBanner birthdays={scopeBirthdays} />

      <div className="app-hero bg-linear-to-l from-[#5c1319] via-[#7a1c24] to-[#91212b] text-white p-4 sm:p-5 rounded-3xl shadow-md flex flex-col lg:flex-row justify-between lg:items-center gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base sm:text-xl font-black text-amber-200">لوحة الخادم — {servant?.full_name}</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-amber-100 text-[11px] font-black">
              {selectedScope}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <span className="app-chip">👥 المخدومين <b>{scopeMembers.length}</b></span>
            <span className="app-chip">📞 يحتاجون افتقاد <b>{Array.isArray(followUpMembers) ? followUpMembers.length : 0}</b></span>
            <span className="app-chip">⏱ فترة السماح <b>{graceMinutes}</b> د</span>
          </div>
          <p className="text-xs text-white/85 mt-1">
            متابعة الحضور، الانصراف المبكر، فترة السماح ({graceMinutes} د)، الملاحظات، والافتقاد • المخدومين: <strong>{scopeMembers.length}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <BellNotificationsPanel
            role="servant"
            currentUser={servant}
            readerId={servant?.id}
            canSend
            followUpItems={followUpMembers}
            noteItems={scopeMembers.flatMap(m =>
              getMemberActiveNotes(m.id).map(n => ({
                id: n.id,
                note_text: n.note_text,
                behavior_tag: n.behavior_tag,
                child_name: m.full_name
              }))
            )}
            onAckNote={(noteId) => {
              const n = memberNotes.find(x => String(x.id) === String(noteId));
              if (n) handleAcknowledgeNote(n);
            }}
            birthdayItems={scopeMembers}
            trips={[...myServiceTripsForServant, ...generalTripsForServant]}
            todayISO={new Date().toLocaleDateString('en-CA')}
            onNavigateCard={(cardId) => setActiveTab(cardId)}
          />
          {canScanInvitations && (
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer shadow"
            >
              <QrCode size={15} /> مسح QR الدعوات
            </button>
          )}
          {canSendInvites && (
            <button
              type="button"
              onClick={() => setActiveTab('invite')}
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-[#4a0e13] rounded-xl font-black flex items-center gap-1.5 cursor-pointer shadow"
            >
              <MailPlus size={15} /> دعوة لأبونا
            </button>
          )}
          {canExtractSheet && (
            <button
              type="button"
              onClick={() => setShowMasterSheet(true)}
              className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer shadow"
            >
              <FileSpreadsheet size={15} /> شيت التسلسل والافتقاد
            </button>
          )}
          {canEditSchedule && (
            <button
              type="button"
              onClick={() => setShowItemsManager(prev => !prev)}
              className={`px-3.5 py-2 rounded-xl font-black flex items-center gap-1.5 cursor-pointer shadow transition ${
                showItemsManager ? 'bg-amber-400 text-[#4a0e13]' : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
            >
              <SlidersHorizontal size={14} /> الإعدادات والمكافآت
            </button>
          )}
        </div>
      </div>

      {canEditSchedule && showItemsManager && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#7a1c24]/30 shadow-sm space-y-4 text-xs">
          <div className="flex items-center justify-between border-b pb-2.5">
            <div>
              <h3 className="text-sm font-black text-[#7a1c24]">⚙️ إعداد المواعيد الرسمية وفترة السماح والرحلات/المكافآت (أدمن / أبونا)</h3>
              <p className="text-[11px] text-gray-500 font-bold mt-0.5">
                حدد الموعد الرسمي ومدة السماح المسموحة للتأخير، وعدد لقاءات المواظبة لاستحقاق رحلة/مكافأة، ومدة الانقطاع.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowItemsManager(false)}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="bg-indigo-50/70 p-3.5 rounded-2xl border border-indigo-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <label className="font-bold text-indigo-950 space-y-1">
              <span className="block text-[11px]">⏰ الموعد الرسمي:</span>
              <input
                type="time"
                className="w-full px-2.5 py-1.5 bg-white border rounded-xl font-black"
                value={officialStartTime}
                onChange={e => {
                  const val = e.target.value || '10:00';
                  setOfficialStartTime(val);
                  persistCustomItems(noteTags, activityTypes, attendanceStatuses, irregularThreshold, absenceDaysThreshold, val, graceMinutes, rewardStreakThreshold);
                }}
              />
            </label>

            <label className="font-bold text-indigo-950 space-y-1">
              <span className="block text-[11px]">⏳ سماح التأخير (دقائق):</span>
              <input
                type="number"
                min="0"
                max="120"
                className="w-full px-2.5 py-1.5 bg-white border rounded-xl font-black"
                value={graceMinutes}
                onChange={e => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setGraceMinutes(val);
                  persistCustomItems(noteTags, activityTypes, attendanceStatuses, irregularThreshold, absenceDaysThreshold, officialStartTime, val, rewardStreakThreshold);
                }}
              />
            </label>

            <label className="font-bold text-emerald-950 space-y-1">
              <span className="block text-[11px]">🌟 مواظبة لرحلة/مكافأة:</span>
              <input
                type="number"
                min="1"
                max="50"
                className="w-full px-2.5 py-1.5 bg-white border rounded-xl font-black"
                value={rewardStreakThreshold}
                onChange={e => {
                  const val = Math.max(1, Number(e.target.value) || 4);
                  setRewardStreakThreshold(val);
                  persistCustomItems(noteTags, activityTypes, attendanceStatuses, irregularThreshold, absenceDaysThreshold, officialStartTime, graceMinutes, val);
                }}
              />
            </label>

            <label className="font-bold text-amber-950 space-y-1">
              <span className="block text-[11px]">❓❓ تكرار تنبيه التأخير:</span>
              <input
                type="number"
                min="1"
                max="15"
                className="w-full px-2.5 py-1.5 bg-white border rounded-xl font-black"
                value={irregularThreshold}
                onChange={e => {
                  const val = Math.max(1, Number(e.target.value) || 2);
                  setIrregularThreshold(val);
                  persistCustomItems(noteTags, activityTypes, attendanceStatuses, val, absenceDaysThreshold, officialStartTime, graceMinutes, rewardStreakThreshold);
                }}
              />
            </label>

            <label className="font-bold text-red-950 space-y-1">
              <span className="block text-[11px]">📅 أيام الانقطاع للافتقاد:</span>
              <input
                type="number"
                min="1"
                max="90"
                className="w-full px-2.5 py-1.5 bg-white border rounded-xl font-black"
                value={absenceDaysThreshold}
                onChange={e => {
                  const val = Math.max(1, Number(e.target.value) || 14);
                  setAbsenceDaysThreshold(val);
                  persistCustomItems(noteTags, activityTypes, attendanceStatuses, irregularThreshold, val, officialStartTime, graceMinutes, rewardStreakThreshold);
                }}
              />
            </label>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-1.5 font-black text-gray-800">
            <Layers size={15} className="text-[#7a1c24]" /> الخدمة والفصل المستهدف:
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
            {(isAdminUser || servantBoundMainGroups.length === 0) && (
            <button
              type="button"
              onClick={() => setShowAllChurchServices(true)}
              className={`px-3 py-1 rounded-xl cursor-pointer transition ${showAllChurchServices ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              كل الخدمات ({availableServicesList.length})
            </button>
            )}
            {isAdminUser && servantBoundMainGroups.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowAllChurchServices(false);
                  if (!servantBoundMainGroups.includes(selectedScope)) {
                    setSelectedScope(servantBoundMainGroups[0]);
                    setSelectedYearFilter('');
                    setSelectedClassFilter('');
                  }
                }}
                className={`px-3 py-1 rounded-xl cursor-pointer transition ${!showAllChurchServices ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                خدماتي فقط ({servantBoundMainGroups.length})
              </button>
            )}
            {canManageStructure && (
              <button
                type="button"
                onClick={() => setEditMode(prev => !prev)}
                className={`px-3 py-1 rounded-xl cursor-pointer transition flex items-center gap-1 ${
                  editMode ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-900 border border-amber-200'
                }`}
              >
                <Pencil size={12} /> {editMode ? 'إنهاء التعديل' : 'تعديل الهيكل'}
              </button>
            )}
          </div>
        </div>

        {editMode && canManageStructure && (
          <div className="bg-amber-50/70 p-3 rounded-2xl border border-amber-200 space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-black text-amber-950">إضافة خدمة رئيسية:</span>
              <input
                type="text"
                placeholder="مثال: خدمة إعدادي / خدمة ثانوي..."
                className="px-3 py-1.5 bg-white border rounded-xl text-xs font-bold flex-1 min-w-[180px]"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddMainService}
                className="px-3.5 py-1.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> إضافة
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200/70">
              <span className="font-black text-amber-950">إضافة سنة/مرحلة داخل ({selectedScope}):</span>
              <input
                type="text"
                placeholder="مثال: أولى إعدادي / ثانية ثانوي..."
                className="px-3 py-1.5 bg-white border rounded-xl text-xs font-bold flex-1 min-w-[160px]"
                value={newYearName}
                onChange={e => setNewYearName(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddYearToScope}
                className="px-3.5 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl font-black flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> إضافة سنة
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200/70">
              <span className="font-black text-blue-950">إضافة فصل داخل ({selectedScope}):</span>
              <select
                className="px-2.5 py-1.5 bg-white border rounded-xl text-xs font-bold"
                value={newClassStage || selectedYearFilter || selectedScope}
                onChange={e => setNewClassStage(e.target.value)}
              >
                <option value={selectedScope}>{selectedScope} (عام)</option>
                {currentScopeStructure.years.map(yr => (
                  <option key={yr.yearName} value={yr.yearName}>{yr.yearName}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="اسم الفصل الجديد..."
                className="px-3 py-1.5 bg-white border rounded-xl text-xs font-bold flex-1 min-w-[160px]"
                value={newClassName}
                onChange={e => setNewClassName(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddClassToScope}
                className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-black flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> إضافة فصل
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {displayedServiceTabs.map((srv, idx) => {
            const count = allMembers.filter(m => memberMatchesScope(m, srv, selectedGenderFilter)).length;
            const isSelected = selectedScope === srv;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSelectedScope(srv);
                  setSelectedYearFilter('');
                  setSelectedClassFilter('');
                  setSearchQuery('');
                  if (srv.includes('بنات')) setSelectedGenderFilter('بنات');
                  else if (srv.includes('بنين')) setSelectedGenderFilter('بنين');
                }}
                className={`shrink-0 px-3.5 py-2 rounded-2xl border text-right transition cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-[#7a1c24] text-white border-[#7a1c24] shadow-xs font-black'
                    : 'bg-[#fbfaf7] text-gray-800 hover:bg-gray-100 border-gray-200 font-bold'
                }`}
              >
                <span>{srv}</span>
                <span className={`px-2 py-0.5 rounded-xl text-[10px] font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-red-50 text-[#7a1c24]'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="bg-[#fbfaf7] p-3 rounded-2xl border border-gray-200/80 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 font-black text-[11px]">
              <span className="text-gray-500 font-normal">المسار:</span>
              <span className="px-2.5 py-1 rounded-xl bg-white border text-gray-900">{selectedScope}</span>
              {selectedYearFilter && (
                <>
                  <span className="text-gray-400">/</span>
                  <span className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-300 text-amber-950">📘 {selectedYearFilter}</span>
                </>
              )}
              {selectedClassFilter && (
                <>
                  <span className="text-gray-400">/</span>
                  <span className="px-2.5 py-1 rounded-xl bg-blue-700 text-white">📖 {selectedClassFilter}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border font-bold">
              {GENDER_SCOPES.map(gScope => (
                <button
                  key={gScope}
                  type="button"
                  onClick={() => setSelectedGenderFilter(gScope)}
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] cursor-pointer transition ${
                    selectedGenderFilter === gScope ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {gScope === 'الكل' ? '👥 الكل' : gScope === 'بنين' ? '♂️ بنين' : '♀️ بنات'}
                </button>
              ))}
            </div>
          </div>

          {currentScopeStructure.years.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-gray-500 self-center ml-1">السنوات:</span>
              <button
                type="button"
                onClick={() => { setSelectedYearFilter(''); setSelectedClassFilter(''); }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer ${
                  !selectedYearFilter ? 'bg-[#7a1c24] text-white' : 'bg-white border text-gray-700'
                }`}
              >
                الكل
              </button>
              {currentScopeStructure.years.map((yr, yIdx) => (
                <button
                  key={yIdx}
                  type="button"
                  onClick={() => { setSelectedYearFilter(selectedYearFilter === yr.yearName ? '' : yr.yearName); setSelectedClassFilter(''); }}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer border ${
                    selectedYearFilter === yr.yearName ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-gray-800 hover:bg-amber-50'
                  }`}
                >
                  {yr.yearName}
                </button>
              ))}
            </div>
          )}

          {visibleClassesForSelection.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-200">
              <span className="text-[11px] font-bold text-gray-500 self-center ml-1">الفصول:</span>
              <button
                type="button"
                onClick={() => setSelectedClassFilter('')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer ${
                  !selectedClassFilter ? 'bg-blue-700 text-white' : 'bg-white border text-gray-700'
                }`}
              >
                كل الفصول
              </button>
              {visibleClassesForSelection.map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setSelectedClassFilter(selectedClassFilter === cls.class_name ? '' : cls.class_name)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer border ${
                    selectedClassFilter === cls.class_name ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-blue-950 hover:bg-blue-50'
                  }`}
                >
                  {cls.class_name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="app-tabs bg-white p-2 rounded-2xl border shadow-2xs flex items-center gap-1.5 overflow-x-auto font-black">
        {tabsList.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-xl shrink-0 cursor-pointer flex items-center gap-1.5 transition ${
              activeTab === tab.id
                ? 'bg-[#7a1c24] text-white shadow-2xs'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-[#f9ecee] text-[#7a1c24]'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {['search', 'attendance', 'followup', 'cases'].includes(activeTab) && (
        <div className="bg-white p-3 rounded-2xl border border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3.5 top-2.5 text-[#7a1c24]" />
            <input
              type="text"
              placeholder="ابحث بالاسم، اسم ولي الأمر، الأب، الأم، التليفون، أو العنوان..."
              className="w-full pr-10 pl-8 py-2 bg-[#fbfaf7] border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#7a1c24] focus:bg-white"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-2 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-gray-100 p-1 rounded-xl font-bold">
              <button
                type="button"
                onClick={() => setCardDensity('compact')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer ${
                  cardDensity === 'compact' ? 'bg-white text-[#7a1c24] shadow-2xs font-black' : 'text-gray-600'
                }`}
              >
                <LayoutGrid size={12} /> مدمج
              </button>
              <button
                type="button"
                onClick={() => setCardDensity('detailed')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer ${
                  cardDensity === 'detailed' ? 'bg-white text-[#7a1c24] shadow-2xs font-black' : 'text-gray-600'
                }`}
              >
                <List size={12} /> تفصيلي
              </button>
            </div>

            {canAdd && (
              <button
                type="button"
                onClick={openAddMemberModal}
                className="px-3.5 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white text-xs font-black rounded-xl flex items-center gap-1 cursor-pointer shadow"
              >
                <UserPlus size={14} /> إضافة مخدوم
              </button>
            )}
          </div>
        </div>
      )}

      <div ref={scrollBoxRef} className="space-y-3">
        {activeTab === 'my_invites' && (
          <ReceivedInvitationsSection
            currentUser={servant}
            onCountChange={setReceivedInvitesCount}
          />
        )}

        {activeTab === 'trips' && (
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5">
                <Bus size={17} /> الرحلات المتاحة (رحلات خدمتي ورحلات عام)
              </h3>
              <div className="flex items-center gap-1.5 bg-[#fbfaf7] p-1 rounded-2xl border">
                <button
                  type="button"
                  onClick={() => setTripSubTab('my_service')}
                  className={`px-3.5 py-1.5 rounded-xl font-black text-xs cursor-pointer transition ${
                    tripSubTab === 'my_service' ? 'bg-[#7a1c24] text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  رحلات خدمتي ({myServiceTripsForServant.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTripSubTab('general')}
                  className={`px-3.5 py-1.5 rounded-xl font-black text-xs cursor-pointer transition ${
                    tripSubTab === 'general' ? 'bg-[#7a1c24] text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  رحلات عام ({generalTripsForServant.length})
                </button>
              </div>
            </div>

            {displayedServantTrips.length === 0 ? (
              <div className="p-4 md:p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
                {tripSubTab === 'general'
                  ? 'لا توجد رحلات عامة معلنة من مكتب الرحلات حالياً.'
                  : 'لا توجد رحلات خاصة بخدمتك أو فصلك حالياً.'}
              </div>
            ) : (
              <div className="grid gap-3">
                {displayedServantTrips.map(tr => {
                  const isOvernight = Number(tr.days_count || 1) > 1 || (Array.isArray(tr.rooms) && tr.rooms.length > 0);
                  return (
                    <div key={tr.id} className="p-4 bg-purple-50/40 border border-purple-200 rounded-2xl space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-950 rounded-lg text-[10px] font-black">
                            {tripSubTab === 'general'
                              ? '🌐 رحلات عام (مكتب الرحلات)'
                              : `🏫 رحلات خدمتي (${tr.target_service || selectedScope || 'خدمتي'})`}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-lg text-[10px] font-bold">
                            {tr.trip_category || 'رحلة'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                            isOvernight ? 'bg-indigo-100 text-indigo-950' : 'bg-amber-100 text-amber-950'
                          }`}>
                            {isOvernight ? `🌙 ${tr.days_count} أيام` : '☀️ يوم واحد'}
                          </span>
                          <strong className="text-sm text-gray-900">{tr.title}</strong>
                        </div>
                        <span className="text-xs font-bold text-gray-600">📅 {tr.trip_date || 'قريباً'}</span>
                      </div>
                      {tr.monasteries && (
                        <p className="text-gray-800">⛪ <strong>الأماكن:</strong> {tr.monasteries}</p>
                      )}
                      {tr.daily_program && (
                        <div className="p-3 bg-white border border-purple-100 rounded-xl text-gray-700 whitespace-pre-line">
                          {tr.daily_program}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <MonthlyAnalyticsAndRewards
            servant={servant}
            allMembers={allMembers}
            scopedMembers={scopeMembers}
            activities={activities}
            availableServices={availableServicesList}
            selectedScope={selectedScope}
            hasClassesInScope={hasClassesInCurrentScope}
            boundClasses={boundClassesForServant}
          />
        )}

        {activeTab === 'birthdays' && (
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-pink-200 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b pb-2.5">
              <strong className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                <Cake size={16} className="text-pink-600" /> كل أعياد ميلاد شهر ({currentMonth})
              </strong>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setBirthdayTab('members')}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${
                    birthdayTab === 'members' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  المخدومين ({currentMonthMemberBirthdays.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBirthdayTab('servants')}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${
                    birthdayTab === 'servants' ? 'bg-amber-800 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  الخدام ({currentMonthServantBirthdays.length})
                </button>
              </div>
            </div>

            {activeBirthdayList.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">لا توجد أعياد ميلاد مسجلة في هذا الشهر.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {activeBirthdayList.map(person => {
                  const isTodayBday = person.birthDay === currentToday;
                  const phoneNum = person.phone || person.father_phone || person.mother_phone;
                  return (
                    <div
                      key={person.id}
                      className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-2 ${
                        isTodayBday ? 'bg-amber-50 border-amber-400' : 'bg-[#fbfaf7]'
                      }`}
                    >
                      <div>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black inline-block mb-1 ${
                          isTodayBday ? 'bg-amber-600 text-white' : 'bg-pink-100 text-pink-900'
                        }`}>
                          {isTodayBday ? `🎉 النهارده (${person.birthDay}/${person.birthMonth})` : `📅 يوم ${person.birthDay}/${person.birthMonth}`}
                        </span>
                        <strong className="block text-sm text-gray-900">{person.full_name}</strong>
                        <span className="text-gray-500">
                          {birthdayTab === 'members' ? (person.assigned_class || person.detailed_stage) : (person.service_stage || 'خادم')}
                        </span>
                      </div>
                      {phoneNum && (
                        <div className="flex gap-1.5 pt-1">
                          <a
                            href={`https://wa.me/2${phoneNum.replace(/\D/g, '')}?text=${encodeURIComponent(`كل سنة وأنت طيب يا ${person.full_name} 🎂🎉`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-1.5 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-1 text-[11px]"
                          >
                            <MessageCircle size={12} /> معايدة واتس
                          </a>
                          <a
                            href={`tel:${phoneNum}`}
                            className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded-xl font-bold"
                          >
                            <Phone size={12} />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'event_invites' && canSendInvites && (
          <PriestInvitationsTab currentUser={servant} users={users} services={services} />
        )}

        {activeTab === 'invite' && canSendInvites && (
          <PriestInvitationModal
            inline={true}
            currentUser={servant}
            defaultRoleLabel="خادم"
          />
        )}

        {['search', 'attendance', 'followup', 'cases'].includes(activeTab) && (
          <>
            {activeTab === 'cases' && (
              <div className="bg-amber-50/70 p-3 rounded-2xl border border-amber-200 flex flex-wrap items-center gap-1.5">
                <span className="font-black text-amber-950 ml-1">تصفية الحالات:</span>
                {['الكل', ...noteTags].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedCaseTagFilter(tag)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer transition ${
                      selectedCaseTagFilter === tag
                        ? 'bg-amber-800 text-white'
                        : 'bg-white text-amber-950 border border-amber-200 hover:bg-amber-100/60'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {displayedMembers.length === 0 ? (
              <div className="bg-white p-8 sm:p-10 rounded-3xl border border-dashed border-gray-300 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#7a1c24] flex items-center justify-center mx-auto">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-800">لا يوجد مخدومون في هذا البند حالياً</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {searchQuery ? 'جرّب البحث بكلمة مختلفة أو امسح خانة البحث.' : 'يمكنك التبديل بين البنود أو إضافة مخدوم جديد للفصل.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className={cardDensity === 'compact' ? 'grid grid-cols-1 xl:grid-cols-2 gap-3' : 'grid gap-3'}>
                {displayedMembers.map((m, index) => {
                  const seqNum = m.serial_no || index + 1;
                  const mActs = activities.filter(a => a.member_id === m.id);
                  const mNotes = getMemberActiveNotes(m.id);
                  const insights = getMemberInsights(m.id);
                  const guardian = resolveGuardianInfo(m);
                  const callPhone = m.phone || guardian.phone || m.father_phone || m.mother_phone;
                  const memberPhoto = getMemberPhoto(m);

                  return (
                    <div
                      key={m.id}
                      className={`p-4 rounded-3xl border text-xs space-y-3 shadow-2xs hover:shadow-sm transition bg-white border-gray-200 ${insights.accentBar}`}
                    >
                      <div className="flex items-start gap-2.5 w-full">
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() => triggerMemberPhotoCapture(m)}
                            title="تصوير / تحديث صورة المخدوم"
                            className={`w-12 h-12 rounded-2xl border overflow-hidden flex items-center justify-center font-black text-xs cursor-pointer transition ${insights.avatarTone}`}
                          >
                            {uploadingPhotoMemberId === m.id ? (
                              <span className="text-[10px]">...</span>
                            ) : memberPhoto ? (
                              <img src={memberPhoto} alt={m.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{getInitials(m.full_name)}</span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerMemberPhotoCapture(m)}
                            title="التقاط صورة للمخدوم"
                            className="w-5 h-5 rounded-full bg-[#7a1c24] text-white flex items-center justify-center absolute -bottom-1 -left-1 shadow cursor-pointer"
                          >
                            <Camera size={11} />
                          </button>
                        </div>

                        <div className="space-y-1.5 w-full min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 bg-[#7a1c24] text-white rounded-lg text-[10px] font-black">#{seqNum}</span>
                            <h3 className="text-sm font-black text-gray-900">{m.full_name}</h3>
                            {m.gender && (
                              <span className="px-2 py-0.5 bg-pink-50 text-pink-900 rounded-lg text-[10px] font-bold">
                                {m.gender === 'أنثى' ? '♀️ بنات' : '♂️ بنين'}
                              </span>
                            )}
                            {m.assigned_class && (
                              <span className="px-2 py-0.5 bg-red-50 text-[#7a1c24] rounded-lg text-[10px] font-bold">
                                ⛪ {m.assigned_class}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${insights.badgeColor}`}>
                              {insights.label}
                            </span>
                            {insights.isRegularAndRewardEligible && (
                              <button
                                type="button"
                                onClick={() =>
                                  setRewardModal({
                                    open: true,
                                    member: m,
                                    streakCount: insights.attendedCount,
                                    reward_type: 'رحلة مجانية',
                                    reward_title: 'رحلة مجانية للمواظبين',
                                    notes: ''
                                  })
                                }
                                className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-lg text-[10px] font-black cursor-pointer inline-flex items-center gap-1"
                              >
                                <Award size={11} /> مواظب ({insights.attendedCount}) — رحلة/مكافأة
                              </button>
                            )}
                            {insights.hasQuestionMarks && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-950 border border-amber-300 rounded-lg text-[10px] font-black">
                                ❓❓ تكرار تأخير/انصراف ({insights.irregularCount}) — متابعة
                              </span>
                            )}
                          </div>

                          <div className="bg-blue-50/70 border border-blue-200 px-2.5 py-1.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <span className="font-black text-blue-950">
                              👤 {guardian.relationLabel}: <strong className="text-[#7a1c24]">{guardian.name}</strong>
                              {guardian.isLinkedAccount && (
                                <span className="mr-1.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-900 rounded text-[9px]">حساب مربوط ✓</span>
                              )}
                            </span>
                            {guardian.phone && <span className="text-blue-900 font-bold">📞 {guardian.phone}</span>}
                          </div>

                          <div className="text-gray-600 space-y-1 text-[11px]">
                            <p className="flex flex-wrap gap-x-3 gap-y-1">
                              <span>👨‍👦 الأب: <strong className="text-gray-800">{m.father_full_name || '—'}</strong> (📞 {m.father_phone || '—'})</span>
                              <span>👩‍👦 الأم: <strong className="text-gray-800">{m.mother_full_name || '—'}</strong> (📞 {m.mother_phone || '—'})</span>
                            </p>
                            <p className="text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="inline-flex items-center gap-1"><Phone size={11} /> {m.phone || 'غير مسجل'}</span>
                              <span className="inline-flex items-center gap-1"><MapPin size={11} /> {m.address || 'بدون عنوان'}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {activeTab === 'attendance' && (
                        <div className="bg-emerald-50/50 p-2.5 rounded-2xl border border-emerald-200/80 flex flex-wrap gap-1.5">
                          {attendanceStatuses.map(st => (
                            <button
                              key={st.code}
                              type="button"
                              onClick={() => handleQuickMemberAttendance(m, st.code)}
                              className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] cursor-pointer text-white ${
                                st.attended
                                  ? 'bg-emerald-700 hover:bg-emerald-800'
                                  : 'bg-red-700 hover:bg-red-800'
                              }`}
                            >
                              {st.label} {st.emoji}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                        {callPhone ? (
                          <>
                            <a
                              href={`https://wa.me/2${callPhone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-1 transition"
                            >
                              <MessageCircle size={13} /> واتس
                            </a>
                            <a
                              href={`tel:${callPhone}`}
                              className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold flex items-center justify-center gap-1 transition"
                            >
                              <Phone size={13} /> اتصال
                            </a>
                          </>
                        ) : (
                          <>
                            <span className="px-2.5 py-2 bg-gray-50 text-gray-400 rounded-xl font-bold flex items-center justify-center gap-1">
                              <MessageCircle size={13} /> واتس
                            </span>
                            <span className="px-2.5 py-2 bg-gray-50 text-gray-400 rounded-xl font-bold flex items-center justify-center gap-1">
                              <Phone size={13} /> اتصال
                            </span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setNoteMember(m);
                            setNewNoteTag(insights.hasQuestionMarks ? (noteTags.find(t => t.includes('متابعة')) || noteTags[0]) : (noteTags[0] || 'عادي'));
                            setNoteModal(true);
                          }}
                          className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <MessageSquareText size={13} /> ملاحظة ({mNotes.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const firstStatus = attendanceStatuses[0] || { code: 'present', attended: true };
                            setSelectedMember(m);
                            setActForm({
                              activity_date: getTodayLocalDate(),
                              activity_type: activityTypes[0] || 'مدارس أحد',
                              status_code: firstStatus.code,
                              expected_time: officialStartTime || '10:00',
                              check_in_time: getNowHHMM(),
                              check_out_time: '',
                              attended: firstStatus.attended,
                              notes: ''
                            });
                            setActModal(true);
                          }}
                          className="px-2.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <Calendar size={13} /> حضور وأوقات
                        </button>
                      </div>

                      {mNotes.length > 0 && (
                        <div className="bg-amber-50/90 p-3 rounded-2xl border border-amber-300 space-y-2 text-[11px]">
                          <span className="font-black text-[#7a1c24] flex items-center gap-1">
                            <CheckCircle2 size={13} /> تنبيهات وملاحظات المتابعة:
                          </span>
                          {mNotes.map(n => (
                            <div key={n.id} className="bg-white p-2.5 rounded-xl border border-amber-200 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                              <div className="space-y-1">
                                <span className="px-1.5 py-0.5 bg-red-100 text-[#7a1c24] rounded text-[9px] font-bold ml-1">{n.behavior_tag || noteTags[0] || 'عادي'}</span>
                                <span className="text-gray-800 font-bold">{n.note_text}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAcknowledgeNote(n)}
                                className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-xl font-bold text-[11px] shrink-0 cursor-pointer self-end sm:self-center transition"
                              >
                                علمت ✅
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#fbfaf7] p-2.5 rounded-2xl border border-gray-100 text-[11px]">
                        <div>
                          <span className="text-gray-400 block text-[10px]">أب الاعتراف:</span>
                          <strong className="text-[#7a1c24]">{m.confession_father || 'غير محدد'}</strong>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">الاعتراف:</span>
                          <span className={`px-2 py-0.5 rounded font-bold inline-block text-[10px] ${m.confession_status === 'منتظم' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>
                            {m.confession_status}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">التناول:</span>
                          <strong className={m.has_communion ? 'text-green-700' : 'text-red-600'}>
                            {m.has_communion ? 'تناول ✅' : 'لم يتناول ❌'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">المواظبة والأنشطة:</span>
                          <strong className="text-blue-700">{insights.attendedCount} حضور / {mActs.length} سجل</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {canScanInvitations && scannerOpen && (
        <InvitationScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          currentUser={servant}
        />
      )}

      {quickStatusModal.open && quickStatusModal.member && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-55">
          <div className="max-h-[92dvh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-4 sm:p-6 space-y-3 text-xs font-bold">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-extrabold text-sm text-[#7a1c24]">
                {quickStatusModal.statusLabel} — {quickStatusModal.member.full_name}
              </h3>
              <button
                type="button"
                onClick={() => setQuickStatusModal(prev => ({ ...prev, open: false }))}
                className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmQuickStatusModal} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-gray-600">تاريخ اليوم (تلقائي)</label>
                  <input
                    type="date"
                    readOnly
                    className="w-full p-2 border rounded-xl bg-gray-100 text-gray-700 cursor-not-allowed"
                    value={getTodayLocalDate()}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-gray-600">النوع</label>
                  <select
                    className="w-full p-2 border rounded-xl bg-white"
                    value={quickStatusModal.activity_type}
                    onChange={e => setQuickStatusModal(prev => ({ ...prev, activity_type: e.target.value }))}
                  >
                    {activityTypes.map((actType, idx) => (
                      <option key={idx} value={actType}>{actType}</option>
                    ))}
                  </select>
                </div>
              </div>

              {quickStatusModal.statusCode === 'late' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-amber-50/60 p-2.5 rounded-2xl border border-amber-200">
                  <div>
                    <label className="block mb-1 text-amber-950">الموعد الرسمي ({graceMinutes} د سماح)</label>
                    <input
                      type="time"
                      className="w-full p-2 border rounded-xl bg-white"
                      value={quickStatusModal.expected_time}
                      onChange={e => setQuickStatusModal(prev => ({ ...prev, expected_time: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-amber-950">وقت الوصول الفعلي</label>
                    <input
                      type="time"
                      className="w-full p-2 border rounded-xl bg-white"
                      value={quickStatusModal.check_in_time}
                      onChange={e => setQuickStatusModal(prev => ({ ...prev, check_in_time: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {quickStatusModal.statusCode === 'early_leave' && (
                <div className="bg-orange-50/60 p-2.5 rounded-2xl border border-orange-200">
                  <label className="block mb-1 text-orange-950">وقت الانصراف المبكر</label>
                  <input
                    type="time"
                    className="w-full p-2 border rounded-xl bg-white"
                    value={quickStatusModal.check_out_time}
                    onChange={e => setQuickStatusModal(prev => ({ ...prev, check_out_time: e.target.value }))}
                  />
                </div>
              )}

              <div>
                <label className="block mb-1 text-gray-700">
                  {quickStatusModal.statusCode === 'early_leave'
                    ? 'هيمشي بدري ليه؟ (السبب)'
                    : quickStatusModal.statusCode === 'late'
                    ? 'اتأخر ليه؟ (السبب)'
                    : 'معتذر ليه؟ (مسافر / ظرف / عذر...)'}
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="اكتب السبب..."
                  className="w-full p-2.5 border rounded-xl bg-white"
                  value={quickStatusModal.reason}
                  onChange={e => setQuickStatusModal(prev => ({ ...prev, reason: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickStatusModal(prev => ({ ...prev, open: false }))}
                  className="px-4 py-2 border rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer"
                >
                  حفظ التسجيل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rewardModal.open && rewardModal.member && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-55">
          <div className="max-h-[92dvh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-4 sm:p-6 space-y-3 text-xs font-bold">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-extrabold text-sm text-amber-900">
                🌟 رحلة / مكافأة مواظبة — {rewardModal.member.full_name}
              </h3>
              <button
                type="button"
                onClick={() => setRewardModal(prev => ({ ...prev, open: false }))}
                className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveReward} className="space-y-3">
              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-amber-950">
                عدد مرات الحضور المواظب: <strong>{rewardModal.streakCount}</strong> لقاءات (الحد المطلوب: {rewardStreakThreshold})
              </div>

              <div>
                <label className="block mb-1 text-gray-700">نوع المكافأة / التقدير</label>
                <select
                  className="w-full p-2.5 border rounded-xl bg-white"
                  value={rewardModal.reward_type}
                  onChange={e => setRewardModal(prev => ({ ...prev, reward_type: e.target.value }))}
                >
                  <option value="رحلة مجانية">🚌 رحلة مجانية</option>
                  <option value="مكافأة">🎁 مكافأة</option>
                  <option value="هدية تشجيعية">🎀 هدية تشجيعية</option>
                  <option value="بطاقة تميز">🏅 بطاقة تميز</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-gray-700">اسم الرحلة أو المكافأة</label>
                <input
                  required
                  type="text"
                  className="w-full p-2.5 border rounded-xl bg-white"
                  value={rewardModal.reward_title}
                  onChange={e => setRewardModal(prev => ({ ...prev, reward_title: e.target.value }))}
                />
              </div>

              <div>
                <label className="block mb-1 text-gray-700">ملاحظات إضافية</label>
                <input
                  type="text"
                  placeholder="مثلاً: مواظب طوال الشهر..."
                  className="w-full p-2.5 border rounded-xl bg-white"
                  value={rewardModal.notes}
                  onChange={e => setRewardModal(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRewardModal(prev => ({ ...prev, open: false }))}
                  className="px-4 py-2 border rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl cursor-pointer"
                >
                  حفظ واعتماد المكافأة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-xl p-4 sm:p-6 space-y-3 text-xs font-bold max-h-[92dvh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-extrabold text-sm text-[#7a1c24]">إضافة مخدوم جديد لفصل: {selectedClassFilter || selectedYearFilter || selectedScope}</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateMember} className="space-y-3">
              <div className="bg-indigo-50/60 p-3 rounded-2xl border border-indigo-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-indigo-950">اسم المستخدم للدخول *</label>
                  <input required placeholder="andrew.1990" className="w-full p-2 border rounded-xl bg-white" value={newMember.username} onChange={e => setNewMember({ ...newMember, username: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-1 text-indigo-950">كلمة المرور *</label>
                  <input required type="text" placeholder="123" className="w-full p-2 border rounded-xl bg-white" value={newMember.password} onChange={e => setNewMember({ ...newMember, password: e.target.value })} />
                </div>
              </div>

              <div className="bg-red-50/50 p-3 rounded-2xl border border-red-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-[#7a1c24]">الفصل المسجل به</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white font-bold"
                    value={newMember.assigned_class}
                    onChange={e => setNewMember({ ...newMember, assigned_class: e.target.value })}
                  >
                    <option value="">-- اختر الفصل --</option>
                    {localServices.map(srv => (
                      <option key={srv.id} value={srv.class_name}>{srv.class_name} ({srv.stage_name})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-[#7a1c24]">النوع *</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white font-bold"
                    value={newMember.gender || 'ذكر'}
                    onChange={e => setNewMember({ ...newMember, gender: e.target.value })}
                  >
                    <option value="ذكر">♂️ ذكر (بنين)</option>
                    <option value="أنثى">♀️ أنثى (بنات)</option>
                  </select>
                </div>
              </div>

              <div className="bg-[#fbfaf7] p-3 rounded-2xl border">
                <label className="block mb-1 text-[#7a1c24]">الاسم الرباعي للمخدوم *</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input required placeholder="الأول *" className="p-2 border rounded-xl bg-white" value={newMember.first_name} onChange={e => setNewMember({ ...newMember, first_name: e.target.value })} />
                  <input required placeholder="الثاني *" className="p-2 border rounded-xl bg-white" value={newMember.second_name} onChange={e => setNewMember({ ...newMember, second_name: e.target.value })} />
                  <input required placeholder="الثالث *" className="p-2 border rounded-xl bg-white" value={newMember.third_name} onChange={e => setNewMember({ ...newMember, third_name: e.target.value })} />
                  <input required placeholder="الرابع *" className="p-2 border rounded-xl bg-white" value={newMember.fourth_name} onChange={e => setNewMember({ ...newMember, fourth_name: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div><label className="block mb-1">تاريخ الميلاد *</label><input required type="date" className="w-full p-2 border rounded-xl bg-white" value={newMember.dob} onChange={e => setNewMember({ ...newMember, dob: e.target.value })} /></div>
                <div><label className="block mb-1">تليفون المخدوم</label><input type="tel" className="w-full p-2 border rounded-xl bg-white" value={newMember.phone} onChange={e => setNewMember({ ...newMember, phone: e.target.value })} /></div>
                <div>
                  <label className="block mb-1">المرحلة *</label>
                  <select className="w-full p-2 border rounded-xl bg-white" value={newMember.detailed_stage} onChange={e => setNewMember({ ...newMember, detailed_stage: e.target.value, service_stage: e.target.value })}>
                    {STAGE_OPTIONS.map((st, i) => <option key={i} value={st}>{st}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-200">
                <label className="block mb-1 text-blue-950">الاسم الرباعي للأب وتليفونه *</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                  <input required placeholder="الأول *" className="p-2 border rounded-xl bg-white" value={newMember.father_first} onChange={e => setNewMember({ ...newMember, father_first: e.target.value })} />
                  <input required placeholder="الثاني *" className="p-2 border rounded-xl bg-white" value={newMember.father_second} onChange={e => setNewMember({ ...newMember, father_second: e.target.value })} />
                  <input required placeholder="الثالث *" className="p-2 border rounded-xl bg-white" value={newMember.father_third} onChange={e => setNewMember({ ...newMember, father_third: e.target.value })} />
                  <input required placeholder="الرابع *" className="p-2 border rounded-xl bg-white" value={newMember.father_fourth} onChange={e => setNewMember({ ...newMember, father_fourth: e.target.value })} />
                </div>
                <input required type="tel" className="w-full p-2 border rounded-xl bg-white" placeholder="رقم تليفون الأب *" value={newMember.father_phone} onChange={e => setNewMember({ ...newMember, father_phone: e.target.value })} />
              </div>

              <div className="bg-pink-50/50 p-3 rounded-2xl border border-pink-200">
                <label className="block mb-1 text-pink-950">الاسم الرباعي للأم وتليفونها *</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                  <input required placeholder="الأول *" className="p-2 border rounded-xl bg-white" value={newMember.mother_first} onChange={e => setNewMember({ ...newMember, mother_first: e.target.value })} />
                  <input required placeholder="الثاني *" className="p-2 border rounded-xl bg-white" value={newMember.mother_second} onChange={e => setNewMember({ ...newMember, mother_second: e.target.value })} />
                  <input required placeholder="الثالث *" className="p-2 border rounded-xl bg-white" value={newMember.mother_third} onChange={e => setNewMember({ ...newMember, mother_third: e.target.value })} />
                  <input required placeholder="الرابع *" className="p-2 border rounded-xl bg-white" value={newMember.mother_fourth} onChange={e => setNewMember({ ...newMember, mother_fourth: e.target.value })} />
                </div>
                <input required type="tel" className="w-full p-2 border rounded-xl bg-white" placeholder="رقم تليفون الأم *" value={newMember.mother_phone} onChange={e => setNewMember({ ...newMember, mother_phone: e.target.value })} />
              </div>

              <div><label className="block mb-1">العنوان السكني *</label><input required className="w-full p-2 border rounded-xl" value={newMember.address} onChange={e => setNewMember({ ...newMember, address: e.target.value })} /></div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-xl cursor-pointer">إلغاء</button>
                <button type="submit" className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer">حفظ المخدوم</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {noteModal && noteMember && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-55">
          <div className="max-h-[92dvh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-4 sm:p-6 space-y-3 text-xs font-bold">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-[#7a1c24]">تسجيل ملاحظة لـ: {noteMember.full_name}</h3>
              <button type="button" onClick={() => setNoteModal(false)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleNoteSubmit} className="space-y-3">
              <select className="w-full p-2.5 border rounded-xl bg-white" value={newNoteTag} onChange={e => setNewNoteTag(e.target.value)}>
                {noteTags.map((tag, idx) => (
                  <option key={idx} value={tag}>{tag}</option>
                ))}
              </select>
              <textarea required className="w-full p-2.5 border rounded-xl" rows="3" placeholder="اكتب الملاحظة أو تفاصيل المتابعة..." value={newNoteText} onChange={e => setNewNoteText(e.target.value)} />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNoteModal(false)} className="px-4 py-2 border rounded-xl cursor-pointer">إلغاء</button>
                <button type="submit" className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {actModal && selectedMember && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-55">
          <div className="max-h-[92dvh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-4 sm:p-6 space-y-3 text-xs font-bold">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-[#7a1c24]">تسجيل حضور وأوقات لـ: {selectedMember.full_name}</h3>
              <button type="button" onClick={() => setActModal(false)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"><X size={16} /></button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (typeof onSaveActivity === 'function') {
                  onSaveActivity(selectedMember.id, buildActivityPayload(actForm));
                }
                setActModal(false);
              }}
              className="space-y-3"
            >
              <select className="w-full p-2.5 border rounded-xl bg-white" value={actForm.activity_type} onChange={e => setActForm({ ...actForm, activity_type: e.target.value })}>
                {activityTypes.map((actType, idx) => (
                  <option key={idx} value={actType}>{actType}</option>
                ))}
              </select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-gray-600">تاريخ اليوم (تلقائي)</label>
                  <input type="date" readOnly className="w-full p-2 border rounded-xl bg-gray-100 text-gray-700 cursor-not-allowed" value={getTodayLocalDate()} />
                </div>
                <div>
                  <label className="block mb-1 text-gray-600">الحالة</label>
                  <select className="w-full p-2 border rounded-xl bg-white" value={actForm.status_code} onChange={e => setActForm({ ...actForm, status_code: e.target.value })}>
                    {attendanceStatuses.map(st => (
                      <option key={st.code} value={st.code}>{st.label} {st.emoji}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block mb-1 text-gray-600">موعد رسمي/متوقع</label>
                  <input type="time" className="w-full p-2 border rounded-xl" value={actForm.expected_time} onChange={e => setActForm({ ...actForm, expected_time: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-1 text-gray-600">وقت الدخول</label>
                  <input type="time" className="w-full p-2 border rounded-xl" value={actForm.check_in_time} onChange={e => setActForm({ ...actForm, check_in_time: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-1 text-gray-600">وقت الانصراف</label>
                  <input type="time" className="w-full p-2 border rounded-xl" value={actForm.check_out_time} onChange={e => setActForm({ ...actForm, check_out_time: e.target.value })} />
                </div>
              </div>
              <input placeholder="ملاحظات أو سبب..." className="w-full p-2.5 border rounded-xl" value={actForm.notes} onChange={e => setActForm({ ...actForm, notes: e.target.value })} />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setActModal(false)} className="px-4 py-2 border rounded-xl cursor-pointer">إلغاء</button>
                <button type="submit" className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer">حفظ الحالة والأوقات</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
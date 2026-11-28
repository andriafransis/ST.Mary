import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './lib/supabase';
import { startUserSession, endUserSession } from './lib/activityLogger';
import { resolveScreens, getScreenAccess, SCREEN_LABELS, SCREEN_ORDER } from './lib/permissions';
import {
  updateAppIconBadge,
  requestMobileNotificationPermission,
  showMobileNotification
} from './lib/mobileNotifications';
import { getUpcomingBirthdays } from './utils/birthdays';
import BirthdayBanner from './components/BirthdayBanner';
import EducationalCenterManager from './components/EducationalCenterManager';
import JosephArimatheaManager from './components/JosephArimatheaManager';
import ChurchGlobalFooter from './components/ChurchGlobalFooter';
import PublicPage from './pages/PublicPage';
import PublicEditor from './pages/PublicEditor';
import ApprovalsPage from './pages/ApprovalsPage';
import PermissionsPage from './pages/PermissionsPage';
import TripsOfficePage from './pages/TripsOfficePage';
import HiddenFamiliesPage from './pages/HiddenFamiliesPage';
import LoginPage from './pages/LoginPage';
import InstallPrompt from './components/InstallPrompt';
import BiometricOffer from './components/BiometricOffer';
import PasswordChangeButton from './components/PasswordChangeButton';
import {
  isBiometricSupported,
  isBiometricDeclined,
  verifyBiometric,
  getBiometricOwnerId
} from './lib/biometricLock';
import AdminDashboard from './pages/AdminDashboard';
import PriestDashboard from './pages/PriestDashboard';
import ServantDashboard from './pages/ServantDashboard';
import MemberDashboard from './pages/MemberDashboard';
import ParentDashboard from './pages/ParentDashboard';
import DeaconSchedule from './pages/DeaconSchedule';
import CertificatesRegistry from './pages/CertificatesRegistry';
import { ensurePushSubscription, removePushSubscription } from './lib/pushSubscribe';
import { LogOut, Bell, BellRing, GraduationCap, HeartHandshake, Menu, X, Check } from 'lucide-react';

const SAVED_USER_KEY = 'church_app_logged_user_id';
const USER_SNAPSHOT_KEY = 'church_app_user_snapshot';

// نسخة من بيانات المستخدم (من غير كلمة المرور) عشان التطبيق يفتح على شاشته على طول زي الواتساب
function readUserSnapshot() {
  try {
    const savedId = localStorage.getItem(SAVED_USER_KEY);
    const raw = localStorage.getItem(USER_SNAPSHOT_KEY);
    if (!savedId || !raw) return null;
    const u = JSON.parse(raw);
    if (!u || String(u.id) !== String(savedId)) return null;
    if (u.status === 'pending' || u.status === 'rejected') return null;
    return u;
  } catch {
    return null;
  }
}
function writeUserSnapshot(user) {
  try {
    // eslint-disable-next-line no-unused-vars
    const { password, ...safe } = user || {};
    localStorage.setItem(USER_SNAPSHOT_KEY, JSON.stringify(safe));
  } catch { /* ignore */ }
}
function clearSavedLogin() {
  try {
    localStorage.removeItem(SAVED_USER_KEY);
    localStorage.removeItem(USER_SNAPSHOT_KEY);
  } catch { /* ignore */ }
}
const PENDING_APPROVAL_KEY = 'church_pending_approval_user';
const DEFAULT_CHURCH_NAME = 'كنيسة السيدة العذراء مريم بالمطرية';
const DEFAULT_TAGLINE = 'مواعيد القداسات، مكتب الرحلات العامة، أخبار الكنيسة، والآباء الكهنة';

const APP_SCREEN_LABELS = {
  ...SCREEN_LABELS,
  hidden_families: '🕊️ خدمة الأسر المستترة'
};

// ترتيب الشاشات بحيث تكون "طلبات الانضمام" ثاني تاب مباشرة بعد "لوحة الإدارة"
const BASE_SCREEN_ORDER = Array.from(new Set([...SCREEN_ORDER, 'hidden_families']));
const APP_SCREEN_ORDER = [
  ...BASE_SCREEN_ORDER.filter(s => s === 'admin_panel'),
  ...(BASE_SCREEN_ORDER.includes('approvals') ? ['approvals'] : []),
  ...BASE_SCREEN_ORDER.filter(s => s !== 'admin_panel' && s !== 'approvals')
];

// تجميع الشاشات في أقسام عشان شريط التنقل يبقى صف واحد منظم
const NAV_GROUPS = [
  { id: 'admin', label: 'الإدارة', screens: ['admin_panel', 'approvals', 'permissions', 'public_editor', 'public_page'] },
  { id: 'panels', label: 'اللوحات', screens: ['priest_panel', 'servant_panel', 'member_panel', 'parent_panel'] },
  { id: 'services', label: 'الخدمات', screens: ['trips_office', 'deacons', 'certs', 'hidden_families'], extras: true }
];

const ROLE_TEXT = {
  admin: '🛡️ سوبر أدمن الكنيسة',
  priest: '✝ أب كاهن',
  head_servant: '⭐ أمين الخدمة',
  vice_head_servant: '🌟 مساعد أمين الخدمة',
  servant: '📖 خادم مرحلة',
  meeting_servant: '🎤 خادم اجتماع',
  mercy_servant: '🤝 خادم إخوة رب',
  member: '👤 مخدوم (شعب)',
  parent: '👨‍👩‍👦 ولي أمر',
  worker: '🛠️ عامل / فراش الكنيسة'
};

const FEMALE_FIRST_NAMES = new Set([
  'ايريني', 'إيريني', 'ريني', 'ماري', 'مارينا', 'مريم', 'فيرينا', 'فيرونيا',
  'دينا', 'سارة', 'ساره', 'نانسي', 'مونيكا', 'ميرا', 'ميرنا', 'بسنت', 'كريستين',
  'كارين', 'كارولين', 'جيهان', 'هالة', 'هبه', 'هبة', 'منى', 'نهى', 'نورهان',
  'ياسمين', 'آية', 'اية', 'إيمان', 'ايمان', 'سمر', 'ندى', 'رانيا', 'أميرة', 'اميرة',
  'داليا', 'شيرين', 'لمياء', 'سلوى', 'وفاء', 'حنان', 'إيناس', 'ايناس', 'تماف', 'دميانة'
]);

function normalizeGenderValue(u) {
  const raw = String(u?.gender || '').trim().toLowerCase();
  if (['أنثى', 'انثي', 'انثى', 'female', 'f', 'woman', 'girl', 'أم', 'ام'].includes(raw)) {
    return 'أنثى';
  }
  if (['ذكر', 'male', 'm', 'man', 'boy', 'أب', 'اب'].includes(raw)) {
    return 'ذكر';
  }
  if (u?.guardian_type === 'mother' || u?.family_role === 'الأم' || u?.family_role === 'أم') {
    return 'أنثى';
  }
  const fullName = String(u?.full_name || '').trim();
  const firstName = fullName.split(/\s+/)[0] || '';
  if (firstName && FEMALE_FIRST_NAMES.has(firstName)) {
    return 'أنثى';
  }
  return 'ذكر';
}

function hasHiddenFamiliesAccess(user, allowedSet) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'priest') return true;
  if (allowedSet?.has('hidden_families')) return true;
  const perms = user.permissions || {};
  if (perms.screen_permissions?.hidden_families?.view) return true;
  if (Array.isArray(perms.allowed_screens) && perms.allowed_screens.includes('hidden_families')) return true;
  if (Array.isArray(perms.policy_keys) && perms.policy_keys.includes('tpl_hidden_families')) return true;
  if (perms.template_key === 'tpl_hidden_families') return true;
  return false;
}

function getEffectiveAllowedSet(user, roleScreens, roleTemplates) {
  const res = resolveScreens(user, roleScreens, roleTemplates);
  const effectiveAllowed = new Set(res.allowed);
  if (hasHiddenFamiliesAccess(user, effectiveAllowed)) {
    effectiveAllowed.add('hidden_families');
  }
  return { ...res, allowed: effectiveAllowed };
}

function getPostLoginScreen(user, roleScreens, roleTemplates = []) {
  const { allowed, defaultScreen } = getEffectiveAllowedSet(user, roleScreens, roleTemplates);
  if (user?.permissions?.default_screen === 'hidden_families' && allowed.has('hidden_families')) {
    return 'hidden_families';
  }
  if (defaultScreen && defaultScreen !== 'public_page' && allowed.has(defaultScreen)) {
    return defaultScreen;
  }
  const nonPublicTab = Array.from(allowed).find(scr => scr !== 'public_page');
  return nonPublicTab || defaultScreen || '';
}

function formatNotifTime(val) {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString('ar-EG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// هل هذا الإشعار يخص اليوزر الحالي (مباشرة أو موجّه لدوره/للجميع)؟
function isNotificationForUser(notif, user) {
  if (!notif || !user) return false;
  if (notif.user_id && String(notif.user_id) === String(user.id)) return true;
  if (!notif.user_id) {
    if (!notif.target_role || notif.target_role === 'all') return true;
    if (String(notif.target_role) === String(user.role)) return true;
  }
  if ((user.role === 'admin' || user.role === 'priest') && ['hidden_family_edit_request', 'priest_invitation'].includes(notif.type)) {
    return true;
  }
  return false;
}

const USERNAME_TAKEN_MSG = 'اسم المستخدم هذا مستخدم من قبل، اختر اسماً آخر.';

// يتأكد إن اسم المستخدم مش موجود عند حد تاني (excludeId = حساب الشخص نفسه عند التعديل)
async function isUsernameTaken(username, excludeId = null) {
  const clean = String(username || '').trim().toLowerCase();
  if (!clean || !supabase || typeof supabase.from !== 'function') return false;
  try {
    let q = supabase.from('church_users').select('id').eq('username', clean).limit(1);
    if (excludeId) q = q.neq('id', excludeId);
    const { data, error } = await q;
    if (error) return false; // لو الفحص فشل، قاعدة البيانات نفسها هتمنع التكرار
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

const isDuplicateUsernameError = (error) =>
  error?.code === '23505' || /duplicate key|unique constraint/i.test(error?.message || '');

function AppInner() {
  const [currentUser, setCurrentUser] = useState(() => readUserSnapshot());
  const [authView, setAuthView] = useState('public');
  const [loginError, setLoginError] = useState('');
  const [registerMessage, setRegisterMessage] = useState('');
  const [activeScreen, setActiveScreen] = useState('');
  const [extraScreen, setExtraScreen] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [churchName, setChurchName] = useState(DEFAULT_CHURCH_NAME);
  const [_churchTagline, setChurchTagline] = useState(DEFAULT_TAGLINE);
  const [churchLogoUrl, setChurchLogoUrl] = useState('');

  const [users, setUsers] = useState([]);
  const [roleScreens, setRoleScreens] = useState([]);
  const [roleTemplates, setRoleTemplates] = useState([]);
  const [families, setFamilies] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [spiritualNotes, setSpiritualNotes] = useState([]);
  const [churchEvents, setChurchEvents] = useState([]);
  const [churchServices, setChurchServices] = useState([]);
  const [serviceGroups, setServiceGroups] = useState([]);
  const [caseCategories, setCaseCategories] = useState([]);
  const [customCards, setCustomCards] = useState([]);
  const [memberActivities, setMemberActivities] = useState([]);
  const [memberNotes, setMemberNotes] = useState([]);
  const [confessionSlots, setConfessionSlots] = useState([]);
  const [priestMasses, setPriestMasses] = useState([]);
  const [priestPublicEvents, setPriestPublicEvents] = useState([]);
  const [childLinkRequests, setChildLinkRequests] = useState([]);

  // حالات الإشعارات الفعلية للموبايل والـ Badge
  const [unreadSystemNotifications, setUnreadSystemNotifications] = useState([]);
  const [pendingInvitesList, setPendingInvitesList] = useState([]);
  const [pendingJosephCount, setPendingJosephCount] = useState(0);
  const [todayPriestBookings, setTodayPriestBookings] = useState([]);
  const [expandedSpecialGroup, setExpandedSpecialGroup] = useState(false);
  const [notifPermission, setNotifPermission] = useState(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [showNotifSummary, setShowNotifSummary] = useState(false);
  const [publicEditorFocus, setPublicEditorFocus] = useState(null);
  const [showBioOffer, setShowBioOffer] = useState(false);

  const todayISO = new Date().toISOString().split('T')[0];

  const fetchData = async () => {
    try {
      const [
        u, rs, tplRes, logoRes, stRes, f, a, n, e, srv, grpRes, cats, cc, act, mNotes, cs, pm, pps,
        allNotifsRes, invRes, jcRes, jmRes, todayBkRes
      ] = await Promise.all([
        supabase.from('church_users').select('*').order('created_at', { ascending: true }),
        supabase.from('role_screens').select('*'),
        supabase.from('church_public_content').select('*').eq('kind', 'role_template').order('created_at', { ascending: true }),
        supabase.from('church_public_content').select('title, body, url').eq('kind', 'logo').limit(1).maybeSingle(),
        supabase.from('church_settings').select('church_name, logo_url').limit(1).maybeSingle(),
        supabase.from('pastoral_families').select('*, children:family_children(*)').order('case_number', { ascending: true }),
        supabase.from('attendance_records').select('*').order('event_date', { ascending: false }),
        supabase.from('spiritual_notes').select('*'),
        supabase.from('church_events').select('*').order('created_at', { ascending: false }),
        supabase.from('church_services').select('*').order('created_at', { ascending: false }),
        supabase.from('service_groups').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
        supabase.from('case_categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('priest_custom_cards').select('*').order('created_at', { ascending: false }),
        supabase.from('member_activities').select('*').order('activity_date', { ascending: false }),
        supabase.from('servant_member_notes').select('*').order('created_at', { ascending: false }),
        supabase.from('priest_confession_slots').select('*').order('slot_date', { ascending: true }),
        supabase.from('priest_masses').select('*').order('mass_date', { ascending: true }),
        supabase.from('priest_personal_schedule').select('*').eq('is_public', true).order('event_date', { ascending: true }),
        supabase.from('church_notifications').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('priest_invitations').select('id, priest_id, status, title, sender_name, event_date').eq('status', 'قيد الانتظار'),
        supabase.from('joseph_arimathea_cases').select('id').eq('status', 'جديد / طارئ'),
        supabase.from('joseph_memorial_requests').select('id').eq('status', 'معلق'),
        supabase.from('confession_bookings').select('id, priest_id').eq('booking_date', todayISO).eq('status', 'محجوز')
      ]);

      const resolvedName = logoRes?.data?.title || stRes?.data?.church_name;
      const resolvedLogo = logoRes?.data?.url || stRes?.data?.logo_url || '';
      if (resolvedName) setChurchName(resolvedName);
      if (logoRes?.data?.body) setChurchTagline(logoRes.data.body);
      if (resolvedLogo) setChurchLogoUrl(resolvedLogo);

      if (Array.isArray(tplRes?.data)) {
        const parsedTpls = tplRes.data
          .map(row => {
            try {
              const obj = JSON.parse(row.body || '{}');
              return {
                dbId: row.id,
                key: row.title,
                ...obj,
                screens: Array.isArray(obj.screens) ? obj.screens : [],
                actions: obj.actions || {},
                screen_permissions: obj.screen_permissions || {}
              };
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        setRoleTemplates(parsedTpls);
      }

      if (u.data) {
        setUsers(u.data);
        const savedId = localStorage.getItem(SAVED_USER_KEY);
        if (savedId) {
          const matched = u.data.find(x => x.id === savedId && x.status !== 'pending' && x.status !== 'rejected');
          if (matched) {
            setCurrentUser(matched);
          } else {
            // الحساب اتحذف أو اتعلّق أو اترفض فعلاً → نطلّعه. (لو النت واقع مش بنوصل هنا فيفضل داخل)
            clearSavedLogin();
            setCurrentUser(null);
          }
        }
      }
      if (rs.data) setRoleScreens(rs.data);
      if (f.data) setFamilies(f.data);
      if (a.data) setAttendance(a.data);
      if (n.data) setSpiritualNotes(n.data);
      if (e.data) setChurchEvents(e.data);
      if (srv.data) setChurchServices(srv.data);
      if (!grpRes?.error && Array.isArray(grpRes?.data)) setServiceGroups(grpRes.data);
      if (cats.data) setCaseCategories(cats.data);
      if (cc.data) setCustomCards(cc.data);
      if (act.data) setMemberActivities(act.data);
      if (mNotes.data) setMemberNotes(mNotes.data);
      if (cs.data) setConfessionSlots(cs.data);
      if (pm.data) setPriestMasses(pm.data);
      if (pps.data) setPriestPublicEvents(pps.data);

      if (!invRes?.error && invRes?.data) setPendingInvitesList(invRes.data);
      const jCasesCnt = !jcRes?.error && jcRes?.data ? jcRes.data.length : 0;
      const jMemCnt = !jmRes?.error && jmRes?.data ? jmRes.data.length : 0;
      setPendingJosephCount(jCasesCnt + jMemCnt);
      if (!todayBkRes?.error && Array.isArray(todayBkRes?.data)) {
        setTodayPriestBookings(todayBkRes.data);
      }

      if (!allNotifsRes?.error && Array.isArray(allNotifsRes?.data)) {
        setUnreadSystemNotifications(allNotifsRes.data.filter(r => !r.is_read));

        const linkReqs = allNotifsRes.data.filter(r => r.type === 'child_link_request');
        const parsed = linkReqs.map(r => {
          let meta = {};
          try {
            meta = r.message ? JSON.parse(r.message) : {};
          } catch {
            meta = {};
          }
          return {
            id: r.id,
            parent_id: r.user_id,
            child_id: meta.child_id || r.reference_id,
            child_name: meta.child_name || '',
            guardian_type: meta.guardian_type || 'father',
            status: meta.status || (r.is_read ? 'handled' : 'pending'),
            created_at: r.created_at
          };
        });
        setChildLinkRequests(parsed);
      }
    } catch (err) {
      console.error('Database fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    const stopSession = startUserSession(currentUser);
    return () => stopSession();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) {
      setActiveScreen('');
      setExtraScreen('');
      updateAppIconBadge(0, churchName);
      return;
    }
    const { allowed } = getEffectiveAllowedSet(currentUser, roleScreens, roleTemplates);
    if (!activeScreen || !allowed.has(activeScreen)) {
      setActiveScreen(getPostLoginScreen(currentUser, roleScreens, roleTemplates));
    }
  }, [currentUser, roleScreens, roleTemplates]);

  const pendingCount = useMemo(() => users.filter(u => u.status === 'pending').length, [users]);

  const myPendingChildRequests = useMemo(
    () =>
      currentUser
        ? childLinkRequests.filter(r => r.parent_id === currentUser.id && r.status === 'pending')
        : [],
    [childLinkRequests, currentUser]
  );

  // إشعارات اليوزر الحالي (أي يوزر يفتح يلاقي إشعاراته هو بس أو الموجهة له/لدوره)
  const mySpecialNotifications = useMemo(() => {
    if (!currentUser) return [];
    return unreadSystemNotifications.filter(
      n => n.type !== 'child_link_request' && isNotificationForUser(n, currentUser)
    );
  }, [currentUser, unreadSystemNotifications]);

  const handleMarkNotificationRead = async (notifId) => {
    if (!notifId) return;
    setUnreadSystemNotifications(prev => prev.filter(n => n.id !== notifId));
    try {
      await supabase
        .from('church_notifications')
        .update({ is_read: true })
        .eq('id', notifId);
    } catch {
      // ignore
    }
  };

  // حساب إجمالي الإشعارات الفعلية لكل يوزر حسب حسابه ودوره
  const notificationStats = useMemo(() => {
    if (!currentUser) return { total: 0, items: [] };

    const items = [];
    const role = currentUser.role;
    const defaultTarget = getPostLoginScreen(currentUser, roleScreens, roleTemplates) || 'member_panel';

    if (role === 'admin') {
      if (pendingCount > 0) {
        items.push({ label: `طلبات انضمام معلقة (${pendingCount})`, count: pendingCount, target: 'approvals' });
      }
      const hiddenReqs = unreadSystemNotifications.filter(n => n.type === 'hidden_family_edit_request').length;
      if (hiddenReqs > 0) {
        items.push({ label: `طلبات الأسر المستترة (${hiddenReqs})`, count: hiddenReqs, target: 'priest_panel' });
      }
      if (pendingInvitesList.length > 0) {
        items.push({ label: `دعوات مناسبات معلقة (${pendingInvitesList.length})`, count: pendingInvitesList.length, target: 'priest_panel' });
      }
      if (pendingJosephCount > 0) {
        items.push({ label: `تنبيهات يوسف الرامي (${pendingJosephCount})`, count: pendingJosephCount, extra: 'joseph_arimathea' });
      }
      if (mySpecialNotifications.length > 0) {
        items.push({
          key: 'special_group',
          label: `تنبيهات خاصة (${mySpecialNotifications.length})`,
          count: mySpecialNotifications.length,
          isSpecialGroup: true,
          target: 'admin_panel'
        });
      }
    } else if (role === 'priest') {
      const myInvites = pendingInvitesList.filter(i => !i.priest_id || i.priest_id === currentUser.id).length;
      if (myInvites > 0) {
        items.push({ label: `دعوات مناسبات واردة (${myInvites})`, count: myInvites, target: 'priest_panel' });
      }
      const myTodayBookings = todayPriestBookings.filter(b => b.priest_id === currentUser.id).length;
      if (myTodayBookings > 0) {
        items.push({ label: `حجوزات اعتراف اليوم (${myTodayBookings})`, count: myTodayBookings, target: 'priest_panel' });
      }
      if (pendingJosephCount > 0) {
        items.push({ label: `طوارئ يوسف الرامي (${pendingJosephCount})`, count: pendingJosephCount, extra: 'joseph_arimathea' });
      }
      const hiddenReqs = unreadSystemNotifications.filter(n => n.type === 'hidden_family_edit_request').length;
      if (hiddenReqs > 0) {
        items.push({ label: `طلبات الأسر المستترة (${hiddenReqs})`, count: hiddenReqs, target: 'priest_panel' });
      }
      if (mySpecialNotifications.length > 0) {
        items.push({
          key: 'special_group',
          label: `تنبيهات خاصة (${mySpecialNotifications.length})`,
          count: mySpecialNotifications.length,
          isSpecialGroup: true,
          target: 'priest_panel'
        });
      }
    } else if (role === 'parent') {
      if (myPendingChildRequests.length > 0) {
        items.push({ label: `طلبات ربط أبناء (${myPendingChildRequests.length})`, count: myPendingChildRequests.length, target: 'parent_panel' });
      }
      if (mySpecialNotifications.length > 0) {
        items.push({
          key: 'special_group',
          label: `تنبيهات خاصة (${mySpecialNotifications.length})`,
          count: mySpecialNotifications.length,
          isSpecialGroup: true,
          target: 'parent_panel'
        });
      }
    } else if (['head_servant', 'vice_head_servant', 'servant', 'meeting_servant', 'mercy_servant'].includes(role)) {
      const myNotes = memberNotes.filter(
        n => !n.is_read && !n.acknowledged && (!n.servant_id || String(n.servant_id) === String(currentUser.id))
      ).length;
      if (myNotes > 0) {
        items.push({ label: `ملاحظات متابعة (${myNotes})`, count: myNotes, target: 'servant_panel' });
      }
      if (mySpecialNotifications.length > 0) {
        items.push({
          key: 'special_group',
          label: `تنبيهات خاصة (${mySpecialNotifications.length})`,
          count: mySpecialNotifications.length,
          isSpecialGroup: true,
          target: 'servant_panel'
        });
      }
    } else {
      if (mySpecialNotifications.length > 0) {
        items.push({
          key: 'special_group',
          label: `تنبيهات خاصة (${mySpecialNotifications.length})`,
          count: mySpecialNotifications.length,
          isSpecialGroup: true,
          target: defaultTarget
        });
      }
    }

    const total = items.reduce((sum, x) => sum + x.count, 0);
    return { total, items };
  }, [
    currentUser,
    roleScreens,
    roleTemplates,
    pendingCount,
    unreadSystemNotifications,
    pendingInvitesList,
    pendingJosephCount,
    todayPriestBookings,
    myPendingChildRequests,
    memberNotes,
    mySpecialNotifications
  ]);

  const badgeCountRef = useRef(0);
  const navRowRef = useRef(null);

  // تحديث الرقم الفعلي على أيقونة التطبيق من بره + عنوان المتصفح باستمرار
  useEffect(() => {
    badgeCountRef.current = notificationStats.total;
    if (currentUser) {
      updateAppIconBadge(notificationStats.total, churchName);
    }
  }, [notificationStats.total, currentUser, churchName]);

  // الاستماع اللحظي لإرسال إشعارات الموبايل الخارجية وتحديث الرقم على الأيقونة
  useEffect(() => {
    if (!currentUser?.id || typeof supabase.channel !== 'function') return;

    const channel = supabase
      .channel(`mobile-alerts-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'church_users' },
        async ({ new: newUser }) => {
          await fetchData();
          if ((currentUser.role === 'admin' || currentUser.role === 'priest') && newUser?.status === 'pending') {
            await showMobileNotification({
              title: '✅ طلب انضمام جديد',
              body: `طلب جديد من: ${newUser.full_name}`,
              badgeCount: badgeCountRef.current + 1,
              icon: churchLogoUrl || `${import.meta.env.BASE_URL}icon-192.png`
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'priest_invitations' },
        async ({ new: inv }) => {
          await fetchData();
          if (
            (currentUser.role === 'priest' && (!inv.priest_id || inv.priest_id === currentUser.id)) ||
            currentUser.role === 'admin'
          ) {
            await showMobileNotification({
              title: `💌 دعوة جديدة: ${inv.event_type}`,
              body: `من ${inv.sender_name}: ${inv.title} (${inv.event_date})`,
              badgeCount: badgeCountRef.current + 1,
              icon: churchLogoUrl || `${import.meta.env.BASE_URL}icon-192.png`
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'joseph_arimathea_cases' },
        async ({ new: row }) => {
          await fetchData();
          if (currentUser.role === 'priest' || currentUser.role === 'admin') {
            await showMobileNotification({
              title: '🕊️ حالة طارئة — خدمة يوسف الرامي',
              body: `المنتقل: ${row.deceased_name}`,
              badgeCount: badgeCountRef.current + 1,
              icon: churchLogoUrl || `${import.meta.env.BASE_URL}icon-192.png`
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'church_notifications' },
        async ({ eventType, new: notif }) => {
          await fetchData();
          if (eventType !== 'INSERT' || !notif) return;
          if (isNotificationForUser(notif, currentUser)) {
            await showMobileNotification({
              title: notif.title || '🔔 إشعار جديد من الكنيسة',
              body: notif.type === 'child_link_request' ? 'لديك طلب ربط ابن بانتظار موافقتك' : (notif.message || ''),
              badgeCount: badgeCountRef.current + 1,
              icon: churchLogoUrl || `${import.meta.env.BASE_URL}icon-192.png`
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, currentUser?.role, churchLogoUrl]);

  const handleEnableMobileNotifications = async () => {
    const res = await requestMobileNotificationPermission();
    setNotifPermission(res);
    if (res === 'granted') {
      await showMobileNotification({
        title: `🔔 تم تفعيل إشعارات ${churchName}`,
        body: notificationStats.total > 0
          ? `لديك الآن (${notificationStats.total}) إشعارات بانتظار المتابعة`
          : 'ستصلك إشعارات الكنيسة فوراً مع الرقم الفعلي على أيقونة التطبيق',
        badgeCount: notificationStats.total,
        icon: churchLogoUrl || `${import.meta.env.BASE_URL}icon-192.png`
      });
    } else if (res === 'denied') {
      alert('تم حظر الإشعارات من المتصفح. يمكنك تفعيلها من إعدادات الموقع في Chrome.');
    }
  };

  const handleLogin = async (username, password) => {
    setLoginError('');
    setRegisterMessage('');
    const { data: user, error } = await supabase
      .from('church_users').select('*')
      .eq('username', username.trim().toLowerCase())
      .eq('password', password).single();

    if (user && !error) {
      if (user.status === 'pending') {
        try {
          localStorage.setItem(PENDING_APPROVAL_KEY, JSON.stringify({
            id: user.id,
            username: user.username,
            password: user.password,
            full_name: user.full_name
          }));
        } catch {
          // ignore
        }
        setLoginError('⏳ حسابك قيد المراجعة وفي انتظار موافقة أدمن الكنيسة لتفعيل دخولك. سيصلك إشعار فور القبول.');
        return;
      }
      if (user.status === 'rejected') {
        setLoginError('❌ تم رفض طلب انضمام هذا الحساب. يرجى مراجعة إدارة الكنيسة.');
        return;
      }
      localStorage.removeItem(PENDING_APPROVAL_KEY);
      localStorage.setItem(SAVED_USER_KEY, user.id);
      setCurrentUser(user);
      setExtraScreen('');
      setMobileMenuOpen(false);
      setActiveScreen(getPostLoginScreen(user, roleScreens, roleTemplates));
      fetchData();
      // اعرض سؤال تفعيل البصمة بعد أول دخول ناجح باليوزر والباسورد
      isBiometricSupported().then(ok => {
        if (ok && getBiometricOwnerId() !== String(user.id) && !isBiometricDeclined()) {
          setShowBioOffer(true);
        }
      });
    } else {
      setLoginError('اسم المستخدم أو كلمة المرور غير صحيحة.');
    }
  };

  // تسجيل الدخول بالبصمة (من صفحة الدخول)
  const handleBiometricLogin = async () => {
    setLoginError('');
    setRegisterMessage('');
    try {
      const ok = await verifyBiometric();
      if (!ok) return;
    } catch {
      setLoginError('لم يتم التحقق بالبصمة. جرّب تاني أو ادخل باليوزر والباسورد.');
      return;
    }
    const ownerId = getBiometricOwnerId();
    if (!ownerId) {
      setLoginError('البصمة غير مفعلة على هذا الجهاز.');
      return;
    }
    const { data: user, error } = await supabase
      .from('church_users').select('*').eq('id', ownerId).single();
    if (error || !user || user.status === 'pending' || user.status === 'rejected') {
      setLoginError('تعذر الدخول بالبصمة. ادخل باليوزر والباسورد.');
      return;
    }
    localStorage.removeItem(PENDING_APPROVAL_KEY);
    localStorage.setItem(SAVED_USER_KEY, user.id);
    setCurrentUser(user);
    setExtraScreen('');
    setMobileMenuOpen(false);
    setActiveScreen(getPostLoginScreen(user, roleScreens, roleTemplates));
    fetchData();
  };

  // شريط التنقل: يوصّل التاب النشط لنص الشاشة
  useEffect(() => {
    const el = navRowRef.current?.querySelector('[data-nav-active="1"]');
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }, [activeScreen, extraScreen, currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id && notifPermission === 'granted') ensurePushSubscription(currentUser);
  }, [currentUser?.id, notifPermission]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentUser?.id) {
      writeUserSnapshot(currentUser);
      // اطلب من المتصفح ما يمسحش بيانات الدخول (مهم للـ PWA على الموبايل)
      try { navigator.storage?.persist?.(); } catch { /* ignore */ }
    }
  }, [currentUser]);

  const handleLogout = async () => {
    await removePushSubscription();
    await endUserSession();
    // عشان صفحة الدخول متطلبش البصمة تلقائي ترجّعه تاني بعد الخروج على طول
    sessionStorage.setItem('church_skip_bio_auto', '1');
    clearSavedLogin();
    updateAppIconBadge(0, churchName);
    setCurrentUser(null);
    setAuthView('public');
    setActiveScreen('');
    setExtraScreen('');
    setMobileMenuOpen(false);
  };

  const buildUserPayload = (u) => {
    const normalizedGuardianType =
      u.guardian_type === 'father' || u.guardian_type === 'الأب' || u.guardian_type === 'أب'
        ? 'father'
        : u.guardian_type === 'mother' || u.guardian_type === 'الأم' || u.guardian_type === 'أم'
          ? 'mother'
          : (u.role === 'parent'
              ? (u.family_role === 'أم' || u.family_role === 'الأم' ? 'mother' : 'father')
              : (u.guardian_type || ''));

    const resolvedFamilyRole =
      u.family_role ||
      (normalizedGuardianType === 'father' ? 'الأب' : normalizedGuardianType === 'mother' ? 'الأم' : 'ابن/ابنة');

    const resolvedFatherId =
      u.father_id || (normalizedGuardianType === 'father' && u.parent_id ? u.parent_id : null);

    const resolvedMotherId =
      u.mother_id || (normalizedGuardianType === 'mother' && u.parent_id ? u.parent_id : null);

    const normalizedGender = normalizeGenderValue({
      ...u,
      guardian_type: normalizedGuardianType,
      family_role: resolvedFamilyRole
    });

    return {
      username: u.username.trim().toLowerCase(),
      password: u.password,
      full_name: u.full_name,
      first_name: u.first_name || '',
      second_name: u.second_name || '',
      third_name: u.third_name || '',
      fourth_name: u.fourth_name || '',
      gender: normalizedGender,
      role: u.role,
      sector: u.sector || '',
      detailed_stage: u.detailed_stage || u.service_stage || 'أولى ابتدائي',
      service_stage: u.detailed_stage || u.service_stage || 'أولى ابتدائي',
      assigned_class: u.assigned_class || u.assigned_service_class || '',
      servant_training_status: u.servant_training_status || 'خادم متكلم (اجتاز إعداد خدام)',
      family_role: resolvedFamilyRole,
      guardian_type: normalizedGuardianType,
      phone: u.phone || '',
      whatsapp_sender_phone: u.whatsapp_sender_phone || '',
      can_manage_wa_templates: u.can_manage_wa_templates !== false,
      is_church_member: u.is_church_member !== false,
      dob: u.dob || null,
      address: u.address || '',
      job_title: u.job_title || '',
      housing_type: u.housing_type || 'تمليك',
      is_studying: Boolean(u.is_studying),
      marital_status: u.marital_status || 'أعزب',
      spouse_name: u.spouse_name || '',
      spouse_phone: u.spouse_phone || '',
      children_names: u.children_names || '',
      parent_id: u.parent_id || resolvedFatherId || resolvedMotherId || null,
      father_id: resolvedFatherId,
      mother_id: resolvedMotherId,
      confession_father_id: u.confession_father_id || null,
      confession_father: u.confession_father || '',
      confession_status: u.confession_status || 'مخدوم جديد',
      has_communion: u.has_communion ?? true,
      father_full_name: u.father_full_name || '',
      mother_full_name: u.mother_full_name || '',
      father_phone: u.father_phone || '',
      mother_phone: u.mother_phone || '',
      is_deacon: Boolean(u.is_deacon),
      deacon_rank: u.deacon_rank || '',
      priest_degree: u.priest_degree || 'قس',
      ordination_date: u.ordination_date || null,
      promotion_date: u.promotion_date || null,
      priest_family_notes: u.priest_family_notes || '',
      priest_wife_full_name: u.priest_wife_full_name || '',
      priest_wife_phone: u.priest_wife_phone || '',
      church_job: u.church_job || '',
      permissions: {
        ...(u.permissions || {}),
        ...(normalizedGuardianType ? { guardian_type: normalizedGuardianType } : {})
      },
      status: u.status || 'approved'
    };
  };

  const handleRegisterFromLogin = async (newUserData) => {
    setLoginError('');
    setRegisterMessage('');
    const payload = buildUserPayload({
      ...newUserData,
      status: newUserData.status || 'pending'
    });
    if (await isUsernameTaken(payload.username)) {
      setLoginError(USERNAME_TAKEN_MSG);
      return false;
    }
    const { data, error } = await supabase.from('church_users').insert([payload]).select().single();
    if (!error && data) {
      setUsers(prev => [...prev, data]);
      try {
        localStorage.setItem(PENDING_APPROVAL_KEY, JSON.stringify({
          id: data.id,
          username: data.username,
          password: data.password,
          full_name: data.full_name
        }));
      } catch {
        // ignore
      }
      const guardianLabel =
        payload.guardian_type === 'father'
          ? ' (ولي الأمر: الأب)'
          : payload.guardian_type === 'mother'
            ? ' (ولي الأمر: الأم)'
            : '';
      setRegisterMessage(`✅ تم إرسال طلب الاشتراك بنجاح${guardianLabel} وهو قيد مراجعة الإدارة. سيصلك إشعار باليوزر والباسورد فور القبول.`);
      return true;
    } else {
      setLoginError(
        isDuplicateUsernameError(error)
          ? USERNAME_TAKEN_MSG
          : 'خطأ في تسجيل الاشتراك: ' + (error?.message || 'حاول مرة أخرى')
      );
      return false;
    }
  };

  const handleAddUser = async (u) => {
    const payload = buildUserPayload(u);
    if (await isUsernameTaken(payload.username)) return alert(USERNAME_TAKEN_MSG);
    const { data, error } = await supabase.from('church_users').insert([payload]).select().single();
    if (!error && data) { setUsers([...users, data]); alert('تم الحفظ بنجاح!'); }
    else alert(isDuplicateUsernameError(error) ? USERNAME_TAKEN_MSG : 'خطأ: ' + (error?.message || 'حاول مرة أخرى'));
  };

  const handleUpdateUser = async (updated) => {
    const updatePayload = buildUserPayload(updated);
    if (await isUsernameTaken(updatePayload.username, updated.id)) return alert(USERNAME_TAKEN_MSG);
    const { data, error } = await supabase.from('church_users').update(updatePayload).eq('id', updated.id).select().single();
    if (!error && data) {
      setUsers(users.map(item => (item.id === updated.id ? data : item)));
      if (currentUser?.id === updated.id) setCurrentUser(data);
      alert('تم التعديل بنجاح!');
    } else alert(isDuplicateUsernameError(error) ? USERNAME_TAKEN_MSG : 'خطأ في التعديل: ' + error?.message);
  };

  const handleDeleteUser = async (id) => {
    if (id === currentUser.id) return alert('لا يمكنك حذف حسابك الحالي!');
    if (!confirm('حذف هذا المستخدم نهائياً؟')) return;
    const { error } = await supabase.from('church_users').delete().eq('id', id);
    if (!error) setUsers(users.filter(u => u.id !== id));
  };

  const handleLinkChild = async (childId, shouldLink = true, guardianRole = null) => {
    const resolvedType =
      guardianRole === 'mother' || guardianRole === 'الأم'
        ? 'mother'
        : guardianRole === 'father' || guardianRole === 'الأب'
          ? 'father'
          : (currentUser.guardian_type === 'mother' || currentUser.family_role === 'الأم' ? 'mother' : 'father');

    const updateFields = shouldLink
      ? {
          parent_id: currentUser.id,
          ...(resolvedType === 'mother' ? { mother_id: currentUser.id } : { father_id: currentUser.id })
        }
      : {
          parent_id: null,
          ...(resolvedType === 'mother' ? { mother_id: null } : { father_id: null })
        };

    const { data, error } = await supabase
      .from('church_users')
      .update(updateFields)
      .eq('id', childId)
      .select()
      .single();

    if (error) {
      alert('تعذر تحديث ربط الابن: ' + error.message);
      return false;
    }
    if (data) {
      setUsers(prev => prev.map(u => (u.id === childId ? data : u)));
      return true;
    }
    return false;
  };

  const handleRequestChildLink = async ({ childId, parentId, guardianType = 'father' }) => {
    if (!childId || !parentId) return false;
    const childObj = users.find(u => u.id === childId);
    const parentObj = users.find(u => u.id === parentId);
    const childName = childObj?.full_name || currentUser?.full_name || 'ابن';
    const roleArabic = guardianType === 'mother' ? 'الأم' : 'الأب';

    const metaPayload = {
      child_id: childId,
      child_name: childName,
      guardian_type: guardianType,
      status: 'pending'
    };

    let insertedRow = null;
    try {
      const { data } = await supabase
        .from('church_notifications')
        .insert([{
          user_id: parentId,
          title: `👨‍👩‍👦 طلب ربط ابن (${roleArabic})`,
          message: JSON.stringify(metaPayload),
          type: 'child_link_request',
          reference_id: childId,
          is_read: false
        }])
        .select()
        .single();
      insertedRow = data;
    } catch {
      // ignore
    }

    try {
      const channel = supabase.channel('church-parent-child-link');
      await channel.subscribe();
      await channel.send({
        type: 'broadcast',
        event: 'child_link_request',
        payload: {
          id: insertedRow?.id || `req_${Date.now()}_${childId}`,
          parent_id: parentId,
          child_id: childId,
          child_name: childName,
          guardian_type: guardianType,
          status: 'pending',
          created_at: new Date().toISOString()
        }
      });
      supabase.removeChannel(channel);
    } catch {
      // ignore
    }

    setChildLinkRequests(prev => [
      {
        id: insertedRow?.id || `req_${Date.now()}_${childId}`,
        parent_id: parentId,
        child_id: childId,
        child_name: childName,
        guardian_type: guardianType,
        status: 'pending',
        created_at: new Date().toISOString()
      },
      ...prev
    ]);

    alert(`✅ تم إرسال طلب الربط إلى (${parentObj?.full_name || roleArabic})، وسيظهر له إشعار للموافقة عليه.`);
    return true;
  };

  const handleApproveChildLinkRequest = async (request) => {
    if (!request?.child_id) return false;
    const ok = await handleLinkChild(request.child_id, true, request.guardian_type || (currentUser?.guardian_type === 'mother' ? 'mother' : 'father'));
    if (!ok) return false;

    setChildLinkRequests(prev =>
      prev.map(r => (r.id === request.id ? { ...r, status: 'approved' } : r))
    );

    if (request.id && !String(request.id).startsWith('req_')) {
      try {
        await supabase
          .from('church_notifications')
          .update({
            is_read: true,
            message: JSON.stringify({
              child_id: request.child_id,
              child_name: request.child_name,
              guardian_type: request.guardian_type,
              status: 'approved'
            })
          })
          .eq('id', request.id);
      } catch {
        // ignore
      }
    }
    return true;
  };

  const handleRejectChildLinkRequest = async (request) => {
    if (!request?.id) return;
    setChildLinkRequests(prev =>
      prev.map(r => (r.id === request.id ? { ...r, status: 'rejected' } : r))
    );
    if (!String(request.id).startsWith('req_')) {
      try {
        await supabase
          .from('church_notifications')
          .update({
            is_read: true,
            message: JSON.stringify({
              child_id: request.child_id,
              child_name: request.child_name,
              guardian_type: request.guardian_type,
              status: 'rejected'
            })
          })
          .eq('id', request.id);
      } catch {
        // ignore
      }
    }
  };

  const handleAddMemberByServant = async (m) => {
    const { siblings, ...userData } = m;
    const memberPayload = buildUserPayload(userData);
    if (await isUsernameTaken(memberPayload.username)) return alert(USERNAME_TAKEN_MSG);
    const { data: memberData, error } = await supabase.from('church_users').insert([memberPayload]).select().single();
    if (!error && memberData) {
      if (siblings?.length > 0) {
        const sibs = siblings.map(s => ({
          member_id: memberData.id,
          sibling_full_name: s.full_name || s.sibling_full_name || [s.s_first, s.s_second, s.s_third, s.s_fourth].map(x => x?.trim()).filter(Boolean).join(' '),
          dob: s.dob || null, stage_or_job: s.stage_or_job || s.stage || '', marital_status: s.marital_status || 'أعزب', phone: s.phone || ''
        }));
        await supabase.from('member_siblings').insert(sibs);
      }
      setUsers([...users, memberData]);
      alert('تم حفظ المخدوم بنجاح!');
    } else alert(isDuplicateUsernameError(error) ? USERNAME_TAKEN_MSG : 'خطأ: ' + error?.message);
  };

  const handleSaveActivity = async (memberId, actForm) => {
    const { data } = await supabase.from('member_activities').insert([{ member_id: memberId, ...actForm }]).select().single();
    if (data) { setMemberActivities([data, ...memberActivities]); alert('تم تسجيل النشاط بنجاح!'); }
  };

  const handleSaveMemberNote = async (note) => {
    const { data } = await supabase.from('servant_member_notes').insert([note]).select().single();
    if (data) { setMemberNotes([data, ...memberNotes]); alert('تم حفظ الملاحظة بنجاح!'); }
  };

  const handleAddEvent = async (ev) => {
    const { data } = await supabase.from('church_events').insert([ev]).select().single();
    if (data) setChurchEvents([data, ...churchEvents]);
  };
  const handleUpdateEvent = async (u) => {
    const { id, created_at, ...clean } = u;
    const { data } = await supabase.from('church_events').update(clean).eq('id', id).select().single();
    if (data) setChurchEvents(churchEvents.map(e => (e.id === id ? data : e)));
  };
  const handleDeleteEvent = async (id) => {
    const { error } = await supabase.from('church_events').delete().eq('id', id);
    if (!error) setChurchEvents(churchEvents.filter(e => e.id !== id));
  };

  const handleAddService = async (srv) => {
    const { data } = await supabase.from('church_services').insert([srv]).select().single();
    if (data) setChurchServices([data, ...churchServices]);
  };
  const handleUpdateService = async (u) => {
    const { id, created_at, ...clean } = u;
    const { data } = await supabase.from('church_services').update(clean).eq('id', id).select().single();
    if (data) setChurchServices(churchServices.map(s => (s.id === id ? data : s)));
  };
  const handleDeleteService = async (id) => {
    const { error } = await supabase.from('church_services').delete().eq('id', id);
    if (!error) setChurchServices(churchServices.filter(s => s.id !== id));
  };

  const handleAddCategory = async (cat) => {
    const { data } = await supabase.from('case_categories').insert([cat]).select().single();
    if (data) setCaseCategories([...caseCategories, data]);
  };
  const handleUpdateCategory = async (id, oldName, newName, icon) => {
    const { data } = await supabase.from('case_categories').update({ name: newName, icon }).eq('id', id).select().single();
    if (data) {
      await supabase.from('pastoral_families').update({ poverty_level: newName }).eq('poverty_level', oldName);
      setCaseCategories(caseCategories.map(c => (c.id === id ? data : c)));
      fetchData();
    }
  };
  const handleDeleteCategory = async (id) => {
    const { error } = await supabase.from('case_categories').delete().eq('id', id);
    if (!error) setCaseCategories(caseCategories.filter(c => c.id !== id));
  };

  const handleAddCustomCard = async (card) => {
    const { data } = await supabase.from('priest_custom_cards').insert([card]).select().single();
    if (data) { setCustomCards([data, ...customCards]); alert('تم إنشاء الكارت للكاهن!'); }
  };
  const handleDeleteCustomCard = async (id) => {
    const { error } = await supabase.from('priest_custom_cards').delete().eq('id', id);
    if (!error) setCustomCards(customCards.filter(c => c.id !== id));
  };

  if (!currentUser) {
    if (authView === 'login') {
      return (
        <LoginPage
          churchName={churchName}
          users={users}
          onLogin={handleLogin}
          onBiometricLogin={handleBiometricLogin}
          onRegister={handleRegisterFromLogin}
          error={loginError}
          successMessage={registerMessage}
          onBackToPublic={() => { setLoginError(''); setRegisterMessage(''); setAuthView('public'); }}
        />
      );
    }

    if (authView === 'edu_public') {
      return (
        <div className="min-h-screen bg-[#f6f4ef] flex flex-col justify-between" dir="rtl">
          <div>
            <div className="bg-[#4b0b11] text-white px-3 sm:px-5 py-3 flex justify-between items-center gap-2 sticky top-0 z-40 shadow-md">
              <button type="button" onClick={() => setAuthView('public')} className="px-3 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-black cursor-pointer shrink-0">→ الرئيسية</button>
              <strong className="text-xs sm:text-sm text-amber-200 truncate">🎓 المركز التعليمي — {churchName}</strong>
              <button type="button" onClick={() => setAuthView('login')} className="px-3 py-2 bg-amber-400 hover:bg-amber-300 text-[#4a0e13] rounded-xl text-xs font-black cursor-pointer shrink-0">🔐 دخول</button>
            </div>
            <div className="max-w-5xl mx-auto p-3 sm:p-6">
              <EducationalCenterManager currentUser={null} todayISO={todayISO} />
            </div>
          </div>
          <ChurchGlobalFooter churchName={churchName} />
        </div>
      );
    }

    if (authView === 'joseph_public') {
      return (
        <div className="min-h-screen bg-[#f6f4ef] flex flex-col justify-between" dir="rtl">
          <div>
            <div className="bg-[#4b0b11] text-white px-3 sm:px-5 py-3 flex justify-between items-center gap-2 sticky top-0 z-40 shadow-md">
              <button type="button" onClick={() => setAuthView('public')} className="px-3 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-black cursor-pointer shrink-0">→ الرئيسية</button>
              <strong className="text-xs sm:text-sm text-amber-200 truncate">🕊️ خدمة يوسف الرامي — {churchName}</strong>
              <button type="button" onClick={() => setAuthView('login')} className="px-3 py-2 bg-amber-400 hover:bg-amber-300 text-[#4a0e13] rounded-xl text-xs font-black cursor-pointer shrink-0">🔐 دخول</button>
            </div>
            <div className="max-w-5xl mx-auto p-3 sm:p-6">
              <JosephArimatheaManager currentUser={null} users={users} todayISO={todayISO} onRequireLogin={() => setAuthView('login')} />
            </div>
          </div>
          <ChurchGlobalFooter churchName={churchName} />
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col justify-between">
        <PublicPage
          isLoggedIn={false}
          canEdit={false}
          churchName={churchName}
          onOpenLogin={() => setAuthView('login')}
          onOpenEdu={() => setAuthView('edu_public')}
          onOpenJoseph={() => setAuthView('joseph_public')}
        />
        <ChurchGlobalFooter churchName={churchName} />
      </div>
    );
  }

  const { allowed } = getEffectiveAllowedSet(currentUser, roleScreens, roleTemplates);
  const fallbackTab = getPostLoginScreen(currentUser, roleScreens, roleTemplates);
  const currentScr = activeScreen && allowed.has(activeScreen) ? activeScreen : fallbackTab;

  const isAdmin = currentUser.role === 'admin';
  const isPriest = currentUser.role === 'priest';

  const publicAccess = getScreenAccess(currentUser, 'public_page', roleScreens, roleTemplates);
  const publicEditorAccess = getScreenAccess(currentUser, 'public_editor', roleScreens, roleTemplates);
  const eduAccess = getScreenAccess(currentUser, 'edu_center', roleScreens, roleTemplates);
  const tripsAccess = getScreenAccess(currentUser, 'trips_office', roleScreens, roleTemplates);
  const deaconsAccess = getScreenAccess(currentUser, 'deacons', roleScreens, roleTemplates);

  const canEditPublic =
    isAdmin ||
    (isPriest && currentUser.permissions?.can_edit_public !== false) ||
    Boolean(currentUser.permissions?.can_edit_public) ||
    publicAccess.edit ||
    publicEditorAccess.edit;

  const canManageEduCenter =
    isAdmin ||
    isPriest ||
    currentUser.role === 'edu_manager' ||
    Boolean(currentUser.permissions?.manage_edu_center) ||
    Boolean(currentUser.permissions?.is_edu_teacher) ||
    eduAccess.edit;

  const canAccessTripsOffice =
    isAdmin ||
    isPriest ||
    allowed.has('trips_office') ||
    tripsAccess.view ||
    Boolean(currentUser.permissions?.manage_trips);

  const canAccessHiddenFamilies = hasHiddenFamiliesAccess(currentUser, allowed);

  const allServants = users.filter(u => ['servant', 'head_servant', 'vice_head_servant', 'meeting_servant', 'mercy_servant'].includes(u.role));
  const myChildrenAsParent = users.filter(
    u =>
      u.parent_id === currentUser.id ||
      u.father_id === currentUser.id ||
      u.mother_id === currentUser.id
  );
  const priestFamilies = families.filter(f => f.priest_id === currentUser.id);
  const upcomingBirthdays = getUpcomingBirthdays(users, isPriest ? priestFamilies : families);

  const combinedAttendance = [
    ...attendance,
    ...memberActivities.map(a => ({ id: a.id, member_id: a.member_id, event_date: a.activity_date, event_type: a.activity_type, present: a.attended }))
  ];

  if (!extraScreen && currentScr === 'public_page') {
    return (
      <div className="min-h-screen flex flex-col justify-between">
        <PublicPage
          isLoggedIn={true}
          canEdit={canEditPublic}
          churchName={churchName}
          onOpenEditor={(focus) => {
            if (!canEditPublic) return alert('التعديل متاح للأدمن أو الكاهن فقط');
            setPublicEditorFocus(focus || null);
            setExtraScreen('');
            setActiveScreen('public_editor');
          }}
          onOpenEdu={() => setExtraScreen('edu_center')}
          onOpenJoseph={() => setExtraScreen('joseph_arimathea')}
          onBackToApp={() => {
            setExtraScreen('');
            setActiveScreen(fallbackTab !== 'public_page' ? fallbackTab : (Array.from(allowed).find(s => s !== 'public_page') || 'public_page'));
          }}
        />
        <ChurchGlobalFooter churchName={churchName} />
      </div>
    );
  }

  const navScreens = APP_SCREEN_ORDER.filter(s => {
    if (s === 'edu_center' || s === 'joseph_arimathea') return false;
    if (s === 'public_editor') return canEditPublic;
    if (s === 'trips_office') return canAccessTripsOffice;
    if (s === 'hidden_families') return canAccessHiddenFamilies;
    return allowed.has(s);
  });

  const navGroupsView = (() => {
    const used = new Set();
    const groups = NAV_GROUPS.map(g => {
      const screens = g.screens.filter(sc => navScreens.includes(sc));
      screens.forEach(sc => used.add(sc));
      return { ...g, screens };
    });
    const leftovers = navScreens.filter(sc => !used.has(sc));
    const last = groups[groups.length - 1];
    last.screens = [...last.screens, ...leftovers];
    return groups.filter(g => g.screens.length > 0 || g.extras);
  })();

  const selectScreen = (scr) => {
    setExtraScreen('');
    setActiveScreen(scr);
    setMobileMenuOpen(false);
    setShowNotifSummary(false);
    setExpandedSpecialGroup(false);
  };

  const selectExtra = (ext) => {
    setExtraScreen(ext);
    setMobileMenuOpen(false);
    setShowNotifSummary(false);
    setExpandedSpecialGroup(false);
  };

  return (
    <div className="min-h-screen bg-[#f6f4ef] flex flex-col justify-between" dir="rtl">
      <div>
        <header className="bg-linear-to-l from-[#5c1319] via-[#7a1c24] to-[#68161d] text-white sticky top-0 z-40 shadow-md print:hidden">
          <div className="max-w-6xl mx-auto px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {churchLogoUrl ? (
                <img
                  src={churchLogoUrl}
                  alt={churchName}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover border-2 border-amber-300/90 bg-white shadow-sm shrink-0"
                />
              ) : (
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-linear-to-br from-amber-300 to-amber-500 text-[#4a0e13] flex items-center justify-center font-black text-xl shadow-sm border border-amber-200 shrink-0">
                  ✝
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="font-black text-xs sm:text-sm text-amber-200 truncate max-w-42.5 sm:max-w-xs">
                    {currentUser.full_name}
                  </h1>
                  {currentUser.is_deacon && (
                    <span className="hidden sm:inline-block px-2 py-0.5 bg-amber-400/20 text-amber-200 rounded-full text-[10px] font-bold">
                      شماس ({currentUser.deacon_rank})
                    </span>
                  )}
                  {(currentUser.guardian_type || currentUser.family_role === 'الأب' || currentUser.family_role === 'الأم') && (
                    <span className="px-2 py-0.5 bg-emerald-400/20 text-emerald-200 rounded-full text-[10px] font-bold">
                      {currentUser.guardian_type === 'mother' || currentUser.family_role === 'الأم' ? 'ولي الأمر: الأم' : 'ولي الأمر: الأب'}
                    </span>
                  )}
                </div>
                <p className="text-[10px] sm:text-[11px] text-white/85 truncate" data-tagline={_churchTagline}>
                  {currentUser.permissions?.custom_role_label || ROLE_TEXT[currentUser.role] || currentUser.role} • {churchName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 relative">
              {notifPermission === 'default' && (
                <button
                  type="button"
                  onClick={handleEnableMobileNotifications}
                  className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] sm:text-[11px] font-black flex items-center gap-1 cursor-pointer shadow-xs"
                  title="تفعيل وصول إشعارات التطبيق على الموبايل وظهور العدد على الأيقونة"
                >
                  <BellRing size={13} />
                  <span className="hidden sm:inline">تفعيل إشعارات الموبايل</span>
                  <span className="sm:hidden">تفعيل الإشعار</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowNotifSummary(prev => {
                    const next = !prev;
                    if (!next) setExpandedSpecialGroup(false);
                    return next;
                  });
                }}
                title="عرض ملخص الإشعارات الفعلية"
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-xs cursor-pointer transition ${
                  notificationStats.total > 0
                    ? 'bg-amber-400 hover:bg-amber-300 text-[#4a0e13]'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
              >
                <Bell size={14} />
                <span>{notificationStats.total}</span>
              </button>

              <PasswordChangeButton user={currentUser} compact />

              {!['member', 'parent', 'worker'].includes(currentUser.role) && upcomingBirthdays.length > 0 && (
                <span
                  title="أعياد ميلاد قادمة"
                  className="hidden md:flex px-2 py-1.5 bg-white/15 text-amber-200 rounded-xl text-[11px] font-black items-center gap-1"
                >
                  🎂 {upcomingBirthdays.length}
                </span>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="px-2.5 sm:px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                title="تسجيل الخروج"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">خروج</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(prev => !prev)}
                className="lg:hidden p-2 bg-amber-400 text-[#4a0e13] rounded-xl font-black cursor-pointer shadow-xs"
                aria-label="فتح قائمة الشاشات"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>

              {showNotifSummary && (
                <div className="absolute left-0 top-12 w-80 sm:w-96 bg-white text-gray-900 rounded-2xl shadow-2xl border border-amber-300 p-3.5 space-y-2 z-50 text-xs max-h-[75dvh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b pb-2">
                    <strong className="text-[#7a1c24] font-black">
                      🔔 الإشعارات الحالية ({notificationStats.total})
                    </strong>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNotifSummary(false);
                        setExpandedSpecialGroup(false);
                      }}
                      className="text-gray-400 hover:text-gray-700 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {notifPermission === 'default' && (
                    <button
                      type="button"
                      onClick={handleEnableMobileNotifications}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] cursor-pointer"
                    >
                      📲 اضغط لتفعيل إشعارات الموبايل + رقم الأيقونة
                    </button>
                  )}

                  {notificationStats.total === 0 ? (
                    <p className="text-center text-gray-500 py-3 font-bold">لا توجد إشعارات معلقة حالياً ✅</p>
                  ) : (
                    <div className="space-y-1.5">
                      {notificationStats.items.map((item, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (item.isSpecialGroup) {
                                setExpandedSpecialGroup(prev => !prev);
                                return;
                              }
                              if (item.extra) selectExtra(item.extra);
                              else if (item.target) selectScreen(item.target);
                            }}
                            className="w-full p-2.5 bg-[#fbfaf7] hover:bg-amber-50 border border-gray-200 rounded-xl flex justify-between items-center font-bold text-right cursor-pointer"
                          >
                            <span>{item.label}</span>
                            <span className="px-2 py-0.5 bg-[#7a1c24] text-white rounded-full text-[10px] font-black">
                              {item.isSpecialGroup ? (expandedSpecialGroup ? '▲ إخفاء' : `${item.count} ▼`) : item.count}
                            </span>
                          </button>

                          {item.isSpecialGroup && expandedSpecialGroup && (
                            <div className="p-2 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
                              {mySpecialNotifications.map((sp) => (
                                <div
                                  key={sp.id}
                                  className="p-2.5 bg-white border border-amber-200/80 rounded-xl space-y-1.5 shadow-2xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <strong className="text-xs text-gray-900 block">
                                      ✨ {sp.title || 'تنبيه خاص'}
                                    </strong>
                                    {sp.created_at && (
                                      <span className="text-[10px] text-gray-500 shrink-0">
                                        {formatNotifTime(sp.created_at)}
                                      </span>
                                    )}
                                  </div>
                                  {sp.message && (
                                    <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-line">
                                      {sp.message}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-end gap-1.5 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleMarkNotificationRead(sp.id)}
                                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer"
                                    >
                                      <Check size={11} /> مقروء
                                    </button>
                                    {item.target && (
                                      <button
                                        type="button"
                                        onClick={() => selectScreen(item.target)}
                                        className="px-2 py-1 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-lg text-[10px] font-black cursor-pointer"
                                      >
                                        فتح الشاشة
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#5a1218]/75 border-t border-white/10 relative">
            <div ref={navRowRef} className="max-w-6xl mx-auto px-3 sm:px-5 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
              {navGroupsView.map((g, gi) => (
                <div key={g.id} className="flex items-center gap-1.5 shrink-0">
                  {gi > 0 && <span aria-hidden className="w-px h-5 bg-white/20 mx-1" />}
                  <span className="hidden sm:inline text-[10px] font-black text-amber-200/70 pl-1">{g.label}</span>
                  {g.screens.map(scr => {
                    const isActive = !extraScreen && currentScr === scr;
                    return (
                      <button
                        key={scr}
                        type="button"
                        data-nav-active={isActive ? '1' : undefined}
                        onClick={() => selectScreen(scr)}
                        className={`px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition ${
                          isActive ? 'bg-amber-400 text-[#4a0e13] shadow-sm font-black' : 'bg-white/10 hover:bg-white/20 text-white/95'
                        }`}
                      >
                        <span>{APP_SCREEN_LABELS[scr] || scr}</span>
                        {scr === 'approvals' && pendingCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-black">{pendingCount}</span>
                        )}
                        {scr === 'parent_panel' && myPendingChildRequests.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-black">{myPendingChildRequests.length}</span>
                        )}
                      </button>
                    );
                  })}
                  {g.extras && (
                    <>
                      <button
                        type="button"
                        data-nav-active={extraScreen === 'edu_center' ? '1' : undefined}
                        onClick={() => selectExtra('edu_center')}
                        className={`px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition ${
                          extraScreen === 'edu_center' ? 'bg-amber-400 text-[#4a0e13] shadow-sm font-black' : 'bg-white/10 hover:bg-white/20 text-white/95'
                        }`}
                      >
                        <GraduationCap size={14} /> {canManageEduCenter ? 'إدارة المركز التعليمي' : 'المركز التعليمي'}
                      </button>
                      <button
                        type="button"
                        data-nav-active={extraScreen === 'joseph_arimathea' ? '1' : undefined}
                        onClick={() => selectExtra('joseph_arimathea')}
                        className={`px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition ${
                          extraScreen === 'joseph_arimathea' ? 'bg-amber-400 text-[#4a0e13] shadow-sm font-black' : 'bg-red-600/80 hover:bg-red-600 text-white'
                        }`}
                      >
                        <HeartHandshake size={14} /> يوسف الرامي
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-linear-to-l from-[#5a1218] to-transparent" />
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-linear-to-r from-[#5a1218] to-transparent" />
          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden bg-[#4a0e13] border-t border-white/15 px-3 py-3 shadow-xl max-h-[70dvh] overflow-y-auto space-y-3">
              {navGroupsView.map(g => (
                <div key={g.id}>
                  <p className="text-[10px] text-amber-200/80 font-black mb-1.5">{g.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {g.screens.map(scr => {
                      const isActive = !extraScreen && currentScr === scr;
                      return (
                        <button
                          key={scr}
                          type="button"
                          onClick={() => selectScreen(scr)}
                          className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-1 cursor-pointer text-right ${
                            isActive ? 'bg-amber-400 text-[#4a0e13] font-black' : 'bg-white/10 text-white'
                          }`}
                        >
                          <span className="truncate">{APP_SCREEN_LABELS[scr] || scr}</span>
                          {scr === 'approvals' && pendingCount > 0 && (
                            <span className="px-1.5 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-black">{pendingCount}</span>
                          )}
                        </button>
                      );
                    })}
                    {g.extras && (
                      <>
                        <button
                          type="button"
                          onClick={() => selectExtra('edu_center')}
                          className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                            extraScreen === 'edu_center' ? 'bg-amber-400 text-[#4a0e13] font-black' : 'bg-white/10 text-white'
                          }`}
                        >
                          <GraduationCap size={14} className="shrink-0" />
                          <span className="truncate">{canManageEduCenter ? 'إدارة المركز التعليمي' : 'المركز التعليمي'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => selectExtra('joseph_arimathea')}
                          className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                            extraScreen === 'joseph_arimathea' ? 'bg-amber-400 text-[#4a0e13] font-black' : 'bg-red-700/80 text-white'
                          }`}
                        >
                          <HeartHandshake size={14} className="shrink-0" />
                          <span className="truncate">يوسف الرامي</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </header>

        <main className="screen-root flex-1 w-full p-3 sm:p-5 md:p-6 max-w-6xl mx-auto">
          {extraScreen === 'edu_center' && (
            <EducationalCenterManager currentUser={currentUser} todayISO={todayISO} />
          )}

          {extraScreen === 'joseph_arimathea' && (
            <JosephArimatheaManager
              currentUser={currentUser}
              users={users}
              todayISO={todayISO}
              onRequireLogin={() => setAuthView('login')}
            />
          )}

          {!extraScreen && currentScr === 'admin_panel' && (
            <div className="space-y-4">
              <BirthdayBanner birthdays={upcomingBirthdays} />
              <AdminDashboard
                users={users} events={churchEvents} services={churchServices} serviceGroups={serviceGroups}
                caseCategories={caseCategories} customCards={customCards}
                roleScreens={roleScreens} roleTemplates={roleTemplates}
                currentUserId={currentUser.id} currentUser={currentUser} isSuperAdmin={isAdmin}
                churchName={churchName}
                onRefresh={fetchData}
                onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser}
                onAddEvent={handleAddEvent} onUpdateEvent={handleUpdateEvent} onDeleteEvent={handleDeleteEvent}
                onAddService={handleAddService} onUpdateService={handleUpdateService} onDeleteService={handleDeleteService}
                onAddCategory={handleAddCategory} onUpdateCategory={handleUpdateCategory} onDeleteCategory={handleDeleteCategory}
                onAddCustomCard={handleAddCustomCard} onDeleteCustomCard={handleDeleteCustomCard}
                onRequestChildLink={handleRequestChildLink}
              />
            </div>
          )}

          {!extraScreen && currentScr === 'priest_panel' && (
            <div className="space-y-4">
              <BirthdayBanner birthdays={upcomingBirthdays} />
              <PriestDashboard
                priest={isPriest ? currentUser : (users.find(u => u.role === 'priest') || currentUser)}
                users={users}
                onRefresh={fetchData}
              />
            </div>
          )}

          {!extraScreen && currentScr === 'hidden_families' && canAccessHiddenFamilies && (
            <HiddenFamiliesPage
              currentUser={currentUser}
              users={users}
              onRefresh={fetchData}
            />
          )}

          {!extraScreen && currentScr === 'trips_office' && canAccessTripsOffice && (
            <TripsOfficePage currentUser={currentUser} users={users} />
          )}

          {!extraScreen && currentScr === 'servant_panel' && (
            <ServantDashboard
              servant={currentUser} users={users} services={churchServices} serviceGroups={serviceGroups}
              activities={memberActivities} memberNotes={memberNotes}
              birthdays={upcomingBirthdays}
              onAddMember={handleAddMemberByServant} onSaveActivity={handleSaveActivity} onSaveMemberNote={handleSaveMemberNote}
              onUpdateMember={handleUpdateUser}
              onRequestChildLink={handleRequestChildLink}
              onRefresh={fetchData}
            />
          )}

          {!extraScreen && currentScr === 'member_panel' && (
            <MemberDashboard
              member={currentUser}
              servants={allServants}
              events={churchEvents}
              services={churchServices}
              serviceGroups={serviceGroups}
              attendance={combinedAttendance}
              confessionSlots={confessionSlots}
              priestPublicEvents={priestPublicEvents}
              priestMasses={priestMasses}
              priests={users.filter(u => u.role === 'priest')}
              allUsers={users}
              onRequestChildLink={handleRequestChildLink}
              onMemberUpdated={(updated) => {
                setCurrentUser(updated);
                setUsers(users.map(u => (u.id === updated.id ? updated : u)));
              }}
            />
          )}

          {!extraScreen && currentScr === 'parent_panel' && (
            <ParentDashboard
              parent={currentUser}
              childrenList={myChildrenAsParent}
              allUsers={users}
              attendance={combinedAttendance}
              spiritualNotes={spiritualNotes}
              events={churchEvents}
              services={churchServices}
              linkRequests={myPendingChildRequests}
              onLinkChild={handleLinkChild}
              onApproveLinkRequest={handleApproveChildLinkRequest}
              onRejectLinkRequest={handleRejectChildLinkRequest}
              onUpdateParent={handleUpdateUser}
            />
          )}

          {!extraScreen && currentScr === 'approvals' && (
            <ApprovalsPage users={users} services={churchServices} onRefresh={fetchData} onUpdateUser={handleUpdateUser} />
          )}

          {!extraScreen && currentScr === 'permissions' && (
            <PermissionsPage users={users} services={churchServices} serviceGroups={serviceGroups} roleScreens={roleScreens} roleTemplates={roleTemplates} currentUser={currentUser} onRefresh={fetchData} />
          )}

          {!extraScreen && currentScr === 'public_editor' && canEditPublic && (
            <PublicEditor
              focus={publicEditorFocus}
              onFocusConsumed={() => setPublicEditorFocus(null)}
              onViewPublic={() => { setExtraScreen(''); setActiveScreen('public_page'); }}
            />
          )}

          {!extraScreen && currentScr === 'deacons' && (
            <DeaconSchedule
              deacons={users.filter(u => u.is_deacon)}
              currentUser={currentUser}
              canEdit={isAdmin || isPriest || deaconsAccess.edit || Boolean(currentUser.permissions?.view_deacons)}
            />
          )}

          {!extraScreen && currentScr === 'certs' && (
            <CertificatesRegistry users={users} currentUser={currentUser} onRefresh={fetchData} />
          )}

          {!extraScreen && !currentScr && (
            <div className="bg-white p-8 rounded-3xl border text-center text-sm font-bold text-gray-600">
              🔒 لا توجد شاشة مفعلة لحسابك حالياً. يرجى مراجعة أدمن الكنيسة لمنحك الصلاحية.
            </div>
          )}
        </main>
      </div>

      {showBioOffer && currentUser && (
        <BiometricOffer user={currentUser} onClose={() => setShowBioOffer(false)} />
      )}

      <ChurchGlobalFooter churchName={churchName} />
    </div>
  );
}

export default function App() {
  return (
    <>
      <AppInner />
      <InstallPrompt />
    </>
  );
}
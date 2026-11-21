import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { startUserSession, endUserSession } from './lib/activityLogger';
import { resolveScreens, getScreenAccess, SCREEN_LABELS, SCREEN_ORDER } from './lib/permissions';
import { getUpcomingBirthdays } from './utils/birthdays';
import BirthdayBanner from './components/BirthdayBanner';
import EducationalCenterManager from './components/EducationalCenterManager';
import JosephArimatheaManager from './components/JosephArimatheaManager';
import PublicPage from './pages/PublicPage';
import PublicEditor from './pages/PublicEditor';
import ApprovalsPage from './pages/ApprovalsPage';
import PermissionsPage from './pages/PermissionsPage';
import TripsOfficePage from './pages/TripsOfficePage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import PriestDashboard from './pages/PriestDashboard';
import ServantDashboard from './pages/ServantDashboard';
import MemberDashboard from './pages/MemberDashboard';
import ParentDashboard from './pages/ParentDashboard';
import DeaconSchedule from './pages/DeaconSchedule';
import CertificatesRegistry from './pages/CertificatesRegistry';
import { LogOut, Bell, GraduationCap, HeartHandshake, Menu, X } from 'lucide-react';

const SAVED_USER_KEY = 'church_app_logged_user_id';
const DEFAULT_CHURCH_NAME = 'كنيسة السيدة العذراء مريم بالمطرية';
const DEFAULT_TAGLINE = 'مواعيد القداسات، مكتب الرحلات العامة، أخبار الكنيسة، والآباء الكهنة';

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

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authView, setAuthView] = useState('public'); // 'public' | 'login' | 'edu_public' | 'joseph_public'
  const [loginError, setLoginError] = useState('');
  const [activeScreen, setActiveScreen] = useState('');
  const [extraScreen, setExtraScreen] = useState(''); // '' | 'edu_center' | 'joseph_arimathea'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [churchName, setChurchName] = useState(DEFAULT_CHURCH_NAME);
  const [churchTagline, setChurchTagline] = useState(DEFAULT_TAGLINE);
  const [churchLogoUrl, setChurchLogoUrl] = useState('');

  const [users, setUsers] = useState([]);
  const [roleScreens, setRoleScreens] = useState([]);
  const [families, setFamilies] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [spiritualNotes, setSpiritualNotes] = useState([]);
  const [churchEvents, setChurchEvents] = useState([]);
  const [churchServices, setChurchServices] = useState([]);
  const [caseCategories, setCaseCategories] = useState([]);
  const [customCards, setCustomCards] = useState([]);
  const [memberActivities, setMemberActivities] = useState([]);
  const [memberNotes, setMemberNotes] = useState([]);
  const [confessionSlots, setConfessionSlots] = useState([]);
  const [priestMasses, setPriestMasses] = useState([]);
  const [priestPublicEvents, setPriestPublicEvents] = useState([]);

  const todayISO = new Date().toISOString().split('T')[0];

  const fetchData = async () => {
    try {
      const [u, rs, logoRes, stRes, f, a, n, e, srv, cats, cc, act, mNotes, cs, pm, pps] = await Promise.all([
        supabase.from('church_users').select('*').order('created_at', { ascending: true }),
        supabase.from('role_screens').select('*'),
        supabase.from('church_public_content').select('title, body, url').eq('kind', 'logo').limit(1).maybeSingle(),
        supabase.from('church_settings').select('church_name, logo_url').limit(1).maybeSingle(),
        supabase.from('pastoral_families').select('*, children:family_children(*)').order('case_number', { ascending: true }),
        supabase.from('attendance_records').select('*').order('event_date', { ascending: false }),
        supabase.from('spiritual_notes').select('*'),
        supabase.from('church_events').select('*').order('created_at', { ascending: false }),
        supabase.from('church_services').select('*').order('created_at', { ascending: false }),
        supabase.from('case_categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('priest_custom_cards').select('*').order('created_at', { ascending: false }),
        supabase.from('member_activities').select('*').order('activity_date', { ascending: false }),
        supabase.from('servant_member_notes').select('*').order('created_at', { ascending: false }),
        supabase.from('priest_confession_slots').select('*').order('slot_date', { ascending: true }),
        supabase.from('priest_masses').select('*').order('mass_date', { ascending: true }),
        supabase.from('priest_personal_schedule').select('*').eq('is_public', true).order('event_date', { ascending: true })
      ]);

      const resolvedName = logoRes?.data?.title || stRes?.data?.church_name;
      const resolvedLogo = logoRes?.data?.url || stRes?.data?.logo_url || '';
      if (resolvedName) setChurchName(resolvedName);
      if (logoRes?.data?.body) setChurchTagline(logoRes.data.body);
      if (resolvedLogo) setChurchLogoUrl(resolvedLogo);

      if (u.data) {
        setUsers(u.data);
        const savedId = localStorage.getItem(SAVED_USER_KEY);
        if (savedId) {
          const matched = u.data.find(x => x.id === savedId && x.status !== 'pending' && x.status !== 'rejected');
          if (matched) setCurrentUser(matched);
        }
      }
      if (rs.data) setRoleScreens(rs.data);
      if (f.data) setFamilies(f.data);
      if (a.data) setAttendance(a.data);
      if (n.data) setSpiritualNotes(n.data);
      if (e.data) setChurchEvents(e.data);
      if (srv.data) setChurchServices(srv.data);
      if (cats.data) setCaseCategories(cats.data);
      if (cc.data) setCustomCards(cc.data);
      if (act.data) setMemberActivities(act.data);
      if (mNotes.data) setMemberNotes(mNotes.data);
      if (cs.data) setConfessionSlots(cs.data);
      if (pm.data) setPriestMasses(pm.data);
      if (pps.data) setPriestPublicEvents(pps.data);
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
      return;
    }
    const { allowed, defaultScreen } = resolveScreens(currentUser, roleScreens);
    if (!activeScreen || !allowed.has(activeScreen)) {
      setActiveScreen(defaultScreen || '');
    }
  }, [currentUser, roleScreens]);

  const handleLogin = async (username, password) => {
    setLoginError('');
    const { data: user, error } = await supabase
      .from('church_users').select('*')
      .eq('username', username.trim().toLowerCase())
      .eq('password', password).single();

    if (user && !error) {
      if (user.status === 'pending') {
        setLoginError('⏳ حسابك قيد المراجعة وفي انتظار موافقة أدمن الكنيسة لتفعيل دخولك.');
        return;
      }
      if (user.status === 'rejected') {
        setLoginError('❌ تم رفض طلب انضمام هذا الحساب. يرجى مراجعة إدارة الكنيسة.');
        return;
      }
      localStorage.setItem(SAVED_USER_KEY, user.id);
      setCurrentUser(user);
      setExtraScreen('');
      setMobileMenuOpen(false);
      const { defaultScreen } = resolveScreens(user, roleScreens);
      setActiveScreen(defaultScreen || '');
      fetchData();
    } else {
      setLoginError('اسم المستخدم أو كلمة المرور غير صحيحة.');
    }
  };

  const handleLogout = async () => {
    await endUserSession();
    localStorage.removeItem(SAVED_USER_KEY);
    setCurrentUser(null);
    setAuthView('public');
    setActiveScreen('');
    setExtraScreen('');
    setMobileMenuOpen(false);
  };

  const buildUserPayload = (u) => ({
    username: u.username.trim().toLowerCase(),
    password: u.password,
    full_name: u.full_name,
    first_name: u.first_name || '', second_name: u.second_name || '',
    third_name: u.third_name || '', fourth_name: u.fourth_name || '',
    role: u.role, sector: u.sector || '',
    detailed_stage: u.detailed_stage || u.service_stage || 'أولى ابتدائي',
    service_stage: u.detailed_stage || u.service_stage || 'أولى ابتدائي',
    assigned_class: u.assigned_class || u.assigned_service_class || '',
    servant_training_status: u.servant_training_status || 'خادم متكلم (اجتاز إعداد خدام)',
    family_role: u.family_role || 'ابن/ابنة',
    phone: u.phone || '',
    whatsapp_sender_phone: u.whatsapp_sender_phone || '',
    can_manage_wa_templates: u.can_manage_wa_templates !== false,
    is_church_member: u.is_church_member !== false,
    dob: u.dob || null, address: u.address || '',
    job_title: u.job_title || '',
    housing_type: u.housing_type || 'تمليك',
    is_studying: Boolean(u.is_studying),
    marital_status: u.marital_status || 'أعزب',
    spouse_name: u.spouse_name || '',
    spouse_phone: u.spouse_phone || '',
    children_names: u.children_names || '',
    parent_id: u.parent_id || null,
    father_id: u.father_id || null,
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
    permissions: u.permissions || {},
    status: u.status || 'approved'
  });

  // ====== CRUD Users ======
  const handleAddUser = async (u) => {
    const { data, error } = await supabase.from('church_users').insert([buildUserPayload(u)]).select().single();
    if (!error && data) { setUsers([...users, data]); alert('تم الحفظ بنجاح!'); }
    else alert('خطأ: ' + (error?.message || 'تأكد من عدم تكرار اسم الدخول'));
  };
  const handleUpdateUser = async (updated) => {
    const { data, error } = await supabase.from('church_users').update(buildUserPayload(updated)).eq('id', updated.id).select().single();
    if (!error && data) { setUsers(users.map(item => (item.id === updated.id ? data : item))); alert('تم التعديل بنجاح!'); }
    else alert('خطأ في التعديل: ' + error?.message);
  };
  const handleDeleteUser = async (id) => {
    if (id === currentUser.id) return alert('لا يمكنك حذف حسابك الحالي!');
    if (!confirm('حذف هذا المستخدم نهائياً؟')) return;
    const { error } = await supabase.from('church_users').delete().eq('id', id);
    if (!error) setUsers(users.filter(u => u.id !== id));
  };

  // ====== ربط / فك ربط الأبناء بولي الأمر (على نفس عمود parent_id في church_users) ======
  const handleLinkChild = async (childId, shouldLink = true) => {
    const newParentId = shouldLink ? currentUser.id : null;
    const { data, error } = await supabase
      .from('church_users')
      .update({ parent_id: newParentId })
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

  // ====== Servant actions ======
  const handleAddMemberByServant = async (m) => {
    const { siblings, ...userData } = m;
    const { data: memberData, error } = await supabase.from('church_users').insert([buildUserPayload(userData)]).select().single();
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
    } else alert('خطأ: ' + error?.message);
  };
  const handleSaveActivity = async (memberId, actForm) => {
    const { data } = await supabase.from('member_activities').insert([{ member_id: memberId, ...actForm }]).select().single();
    if (data) { setMemberActivities([data, ...memberActivities]); alert('تم تسجيل النشاط بنجاح!'); }
  };
  const handleSaveMemberNote = async (note) => {
    const { data } = await supabase.from('servant_member_notes').insert([note]).select().single();
    if (data) { setMemberNotes([data, ...memberNotes]); alert('تم حفظ الملاحظة بنجاح!'); }
  };

  // ====== Events / Services / Categories / Custom Cards ======
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

  // ==============================================================
  // 1) شاشة الزائر
  // ==============================================================
  if (!currentUser) {
    if (authView === 'login') {
      return (
        <LoginPage
          churchName={churchName}
          onLogin={handleLogin}
          error={loginError}
          onBackToPublic={() => { setLoginError(''); setAuthView('public'); }}
        />
      );
    }

    if (authView === 'edu_public') {
      return (
        <div className="min-h-screen bg-[#f6f4ef]" dir="rtl">
          <div className="bg-[#4b0b11] text-white px-3 sm:px-5 py-3 flex justify-between items-center gap-2 sticky top-0 z-40 shadow-md">
            <button
              type="button"
              onClick={() => setAuthView('public')}
              className="px-3 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-black cursor-pointer shrink-0"
            >
              → الرئيسية
            </button>
            <strong className="text-xs sm:text-sm text-amber-200 truncate">🎓 المركز التعليمي — {churchName}</strong>
            <button
              type="button"
              onClick={() => setAuthView('login')}
              className="px-3 py-2 bg-amber-400 hover:bg-amber-300 text-[#4a0e13] rounded-xl text-xs font-black cursor-pointer shrink-0"
            >
              🔐 دخول
            </button>
          </div>

          <div className="max-w-5xl mx-auto p-3 sm:p-6">
            <EducationalCenterManager currentUser={null} todayISO={todayISO} />
          </div>
        </div>
      );
    }

    if (authView === 'joseph_public') {
      return (
        <div className="min-h-screen bg-[#f6f4ef]" dir="rtl">
          <div className="bg-[#4b0b11] text-white px-3 sm:px-5 py-3 flex justify-between items-center gap-2 sticky top-0 z-40 shadow-md">
            <button
              type="button"
              onClick={() => setAuthView('public')}
              className="px-3 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-black cursor-pointer shrink-0"
            >
              → الرئيسية
            </button>
            <strong className="text-xs sm:text-sm text-amber-200 truncate">🕊️ خدمة يوسف الرامي — {churchName}</strong>
            <button
              type="button"
              onClick={() => setAuthView('login')}
              className="px-3 py-2 bg-amber-400 hover:bg-amber-300 text-[#4a0e13] rounded-xl text-xs font-black cursor-pointer shrink-0"
            >
              🔐 دخول
            </button>
          </div>

          <div className="max-w-5xl mx-auto p-3 sm:p-6">
            <JosephArimatheaManager
              currentUser={null}
              users={users}
              todayISO={todayISO}
              onRequireLogin={() => setAuthView('login')}
            />
          </div>
        </div>
      );
    }

    return (
      <PublicPage
        isLoggedIn={false}
        canEdit={false}
        churchName={churchName}
        onOpenLogin={() => setAuthView('login')}
        onOpenEdu={() => setAuthView('edu_public')}
        onOpenJoseph={() => setAuthView('joseph_public')}
      />
    );
  }

  // ==============================================================
  // 2) شاشة المستخدم بعد تسجيل الدخول
  // ==============================================================
  const { allowed, defaultScreen } = resolveScreens(currentUser, roleScreens);
  const currentScr = activeScreen && allowed.has(activeScreen) ? activeScreen : defaultScreen;

  const isAdmin = currentUser.role === 'admin';
  const isPriest = currentUser.role === 'priest';

  const publicAccess = getScreenAccess(currentUser, 'public_page', roleScreens);
  const publicEditorAccess = getScreenAccess(currentUser, 'public_editor', roleScreens);
  const eduAccess = getScreenAccess(currentUser, 'edu_center', roleScreens);
  const tripsAccess = getScreenAccess(currentUser, 'trips_office', roleScreens);
  const deaconsAccess = getScreenAccess(currentUser, 'deacons', roleScreens);

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

  const allServants = users.filter(u => ['servant', 'head_servant', 'vice_head_servant', 'meeting_servant', 'mercy_servant'].includes(u.role));
  const myChildrenAsParent = users.filter(
    u => u.parent_id === currentUser.id || u.father_id === currentUser.id
  );
  const priestFamilies = families.filter(f => f.priest_id === currentUser.id);
  const upcomingBirthdays = getUpcomingBirthdays(users, isPriest ? priestFamilies : families);
  const pendingCount = users.filter(u => u.status === 'pending').length;

  const combinedAttendance = [
    ...attendance,
    ...memberActivities.map(a => ({ id: a.id, member_id: a.member_id, event_date: a.activity_date, event_type: a.activity_type, present: a.attended }))
  ];

  if (!extraScreen && currentScr === 'public_page') {
    return (
      <PublicPage
        isLoggedIn={true}
        canEdit={canEditPublic}
        churchName={churchName}
        onOpenEditor={() => {
          if (!canEditPublic) return alert('التعديل متاح للأدمن أو الكاهن فقط');
          setExtraScreen('');
          setActiveScreen('public_editor');
        }}
        onOpenEdu={() => setExtraScreen('edu_center')}
        onOpenJoseph={() => setExtraScreen('joseph_arimathea')}
        onBackToApp={() => {
          setExtraScreen('');
          setActiveScreen(defaultScreen !== 'public_page' ? defaultScreen : (Array.from(allowed).find(s => s !== 'public_page') || 'public_page'));
        }}
      />
    );
  }

  const navScreens = [...SCREEN_ORDER, ...(canEditPublic ? ['public_editor'] : [])].filter(s => {
    if (s === 'public_editor' && !canEditPublic) return false;
    if (s === 'trips_office') return canAccessTripsOffice;
    return allowed.has(s);
  });

  const selectScreen = (scr) => {
    setExtraScreen('');
    setActiveScreen(scr);
    setMobileMenuOpen(false);
  };

  const selectExtra = (ext) => {
    setExtraScreen(ext);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f6f4ef] flex flex-col" dir="rtl">
      {/* هيدر علوي ثابت ومظبوط لجميع الشاشات (موبايل + ديسكتوب) */}
      <header className="bg-linear-to-l from-[#5c1319] via-[#7a1c24] to-[#68161d] text-white sticky top-0 z-40 shadow-md print:hidden">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2">
          {/* يمين الهيدر: اللوجو الجميل + الاسم */}
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
                <h1 className="font-black text-xs sm:text-sm text-amber-200 truncate max-w-[170px] sm:max-w-xs">
                  {currentUser.full_name}
                </h1>
                {currentUser.is_deacon && (
                  <span className="hidden sm:inline-block px-2 py-0.5 bg-amber-400/20 text-amber-200 rounded-full text-[10px] font-bold">
                    شماس ({currentUser.deacon_rank})
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-white/85 truncate">
                {currentUser.permissions?.custom_role_label || ROLE_TEXT[currentUser.role] || currentUser.role} • {churchName}
              </p>
            </div>
          </div>

          {/* يسار الهيدر: الإشعارات + خروج + زر القائمة للموبايل */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!['member', 'parent', 'worker'].includes(currentUser.role) && upcomingBirthdays.length > 0 && (
              <span
                title="أعياد ميلاد قادمة"
                className="px-2 py-1.5 bg-amber-400 text-amber-950 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-xs"
              >
                <Bell size={13} /> {upcomingBirthdays.length}
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
          </div>
        </div>

        {/* شريط التابات العلوي المدمج */}
        <div className="bg-[#5a1218]/75 border-t border-white/10">
          <div className="max-w-6xl mx-auto px-3 sm:px-5 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar lg:flex-wrap">
            {navScreens.map(scr => {
              const isActive = !extraScreen && currentScr === scr;
              return (
                <button
                  key={scr}
                  type="button"
                  onClick={() => selectScreen(scr)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition ${
                    isActive
                      ? 'bg-amber-400 text-[#4a0e13] shadow-sm font-black'
                      : 'bg-white/10 hover:bg-white/20 text-white/95'
                  }`}
                >
                  <span>{SCREEN_LABELS[scr] || scr}</span>
                  {scr === 'approvals' && pendingCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-black">{pendingCount}</span>
                  )}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => selectExtra('edu_center')}
              className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition ${
                extraScreen === 'edu_center'
                  ? 'bg-amber-400 text-[#4a0e13] shadow-sm font-black'
                  : 'bg-white/10 hover:bg-white/20 text-white/95'
              }`}
            >
              <GraduationCap size={14} /> {canManageEduCenter ? 'إدارة المركز التعليمي' : 'المركز التعليمي'}
            </button>

            <button
              type="button"
              onClick={() => selectExtra('joseph_arimathea')}
              className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition ${
                extraScreen === 'joseph_arimathea'
                  ? 'bg-amber-400 text-[#4a0e13] shadow-sm font-black'
                  : 'bg-red-600/80 hover:bg-red-600 text-white'
              }`}
            >
              <HeartHandshake size={14} /> يوسف الرامي
            </button>
          </div>
        </div>

        {/* قائمة الموبايل المنسدلة */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#4a0e13] border-t border-white/15 px-3 py-3 shadow-xl">
            <p className="text-[10px] text-amber-200/80 font-bold mb-2">كل الشاشات المتاحة لحسابك:</p>
            <div className="grid grid-cols-2 gap-2">
              {navScreens.map(scr => {
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
                    <span className="truncate">{SCREEN_LABELS[scr] || scr}</span>
                    {scr === 'approvals' && pendingCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-black">{pendingCount}</span>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => selectExtra('edu_center')}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  extraScreen === 'edu_center' ? 'bg-amber-400 text-[#4a0e13] font-black' : 'bg-white/10 text-white'
                }`}
              >
                <GraduationCap size={14} className="shrink-0" />
                <span className="truncate">المركز التعليمي</span>
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
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 w-full p-3 sm:p-5 md:p-6 max-w-6xl mx-auto">
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
              users={users} events={churchEvents} services={churchServices}
              caseCategories={caseCategories} customCards={customCards}
              roleScreens={roleScreens}
              currentUserId={currentUser.id} currentUser={currentUser} isSuperAdmin={isAdmin}
              churchName={churchName}
              onRefresh={fetchData}
              onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser}
              onAddEvent={handleAddEvent} onUpdateEvent={handleUpdateEvent} onDeleteEvent={handleDeleteEvent}
              onAddService={handleAddService} onUpdateService={handleUpdateService} onDeleteService={handleDeleteService}
              onAddCategory={handleAddCategory} onUpdateCategory={handleUpdateCategory} onDeleteCategory={handleDeleteCategory}
              onAddCustomCard={handleAddCustomCard} onDeleteCustomCard={handleDeleteCustomCard}
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

        {!extraScreen && currentScr === 'trips_office' && canAccessTripsOffice && (
          <TripsOfficePage currentUser={currentUser} users={users} />
        )}

        {!extraScreen && currentScr === 'servant_panel' && (
          <ServantDashboard
            servant={currentUser} users={users} services={churchServices}
            activities={memberActivities} memberNotes={memberNotes}
            birthdays={upcomingBirthdays}
            onAddMember={handleAddMemberByServant} onSaveActivity={handleSaveActivity} onSaveMemberNote={handleSaveMemberNote}
          />
        )}

        {!extraScreen && currentScr === 'member_panel' && (
          <MemberDashboard
            member={currentUser}
            servants={allServants}
            events={churchEvents}
            services={churchServices}
            attendance={combinedAttendance}
            confessionSlots={confessionSlots}
            priestPublicEvents={priestPublicEvents}
            priestMasses={priestMasses}
            priests={users.filter(u => u.role === 'priest')}
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
            onLinkChild={handleLinkChild}
          />
        )}

        {!extraScreen && currentScr === 'approvals' && (
          <ApprovalsPage users={users} services={churchServices} onRefresh={fetchData} />
        )}

        {!extraScreen && currentScr === 'permissions' && (
          <PermissionsPage users={users} roleScreens={roleScreens} currentUser={currentUser} onRefresh={fetchData} />
        )}

        {!extraScreen && currentScr === 'public_editor' && canEditPublic && (
          <PublicEditor onViewPublic={() => { setExtraScreen(''); setActiveScreen('public_page'); }} />
        )}

        {!extraScreen && currentScr === 'deacons' && (
          <DeaconSchedule
            deacons={users.filter(u => u.is_deacon)}
            currentUser={currentUser}
            canEdit={isAdmin || isPriest || deaconsAccess.edit || Boolean(currentUser.permissions?.view_deacons)}
          />
        )}

        {!extraScreen && currentScr === 'certs' && (
          <CertificatesRegistry users={users} onRefresh={fetchData} />
        )}

        {!extraScreen && !currentScr && (
          <div className="bg-white p-8 rounded-3xl border text-center text-sm font-bold text-gray-600">
            🔒 لا توجد شاشة مفعلة لحسابك حالياً. يرجى مراجعة أدمن الكنيسة لمنحك الصلاحية.
          </div>
        )}
      </main>
    </div>
  );
}
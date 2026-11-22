import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { startUserSession, logActivity } from '../lib/activityLogger';
import WhatsAppComposerModal, { FALLBACK_WA_TEMPLATES, formatWaMessage } from '../components/priest/WhatsAppComposerModal';
import BellNotificationsPanel from '../components/priest/BellNotificationsPanel';
import ConfessorProfileModal from '../components/priest/ConfessorProfileModal';
import EducationalCenterManager from '../components/EducationalCenterManager';
import JosephArimatheaManager from '../components/JosephArimatheaManager';
import MasterCongregationSheet from '../components/MasterCongregationSheet';
import {
  BusVisualizerSection,
  PrintBusModal,
  createNewBus,
  normalizeBuses,
  buildGroupedPeopleSummary,
  syncTripPaymentsTable
} from '../components/priest/BusTripManager';
import {
  ArrowRight, Lock, Globe, Trash2, Edit3, X, Printer,
  Sun, Moon, MessageCircle, UserPlus, Link2, Bus,
  Upload, Paperclip, Eye, ExternalLink, Cake, BellRing, AlertTriangle
} from 'lucide-react';

const MASS_AUDIENCES = [
  'قداس عام للشعب', 'قداس خدمة ابتدائي', 'قداس خدمة إعدادي',
  'قداس خدمة ثانوي', 'قداس خدمة جامعة', 'قداس كشفي', 'قداس أربعين', 'قداس خاص'
];

const WEEK_DAYS = [
  { id: 0, label: 'الأحد' }, { id: 1, label: 'الإثنين' }, { id: 2, label: 'الثلاثاء' },
  { id: 3, label: 'الأربعاء' }, { id: 4, label: 'الخميس' }, { id: 5, label: 'الجمعة' }, { id: 6, label: 'السبت' }
];

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const ATTACHMENT_TYPES = ['صورة بطاقة', 'عقد إيجار', 'تحاليل وأشعة', 'إيصال كهرباء ومرافق', 'أخرى'];

export default function PriestDashboard({ priest, users = [], onRefresh }) {
  const [activeCard, setActiveCard] = useState('hub');
  const [localUsers, setLocalUsers] = useState(users);

  useEffect(() => {
    setLocalUsers(users);
  }, [users]);

  useEffect(() => {
    if (!priest?.id) return;
    const stopSession = startUserSession(priest);
    return () => stopSession();
  }, [priest?.id]);

  const todayISO = new Date().toISOString().split('T')[0];

  const [confessionSlots, setConfessionSlots] = useState([]);
  const [confessionBookings, setConfessionBookings] = useState([]);
  const [sessionsHistory, setSessionsHistory] = useState([]);
  const [spiritualNotes, setSpiritualNotes] = useState([]);
  const [visitations, setVisitations] = useState([]);
  const [services, setServices] = useState([]);
  const [masses, setMasses] = useState([]);
  const [personalItems, setPersonalItems] = useState([]);
  const [families, setFamilies] = useState([]);
  const [familyAttachments, setFamilyAttachments] = useState([]);
  const [caseCategories, setCaseCategories] = useState([]);
  const [siblings, setSiblings] = useState([]);
  const [userChildren, setUserChildren] = useState([]);
  const [customCards, setCustomCards] = useState([]);
  const [customEntries, setCustomEntries] = useState([]);

  const [josephCases, setJosephCases] = useState([]);
  const [josephMemorials, setJosephMemorials] = useState([]);
  const [liveJosephAlert, setLiveJosephAlert] = useState(null);

  const [waTemplates, setWaTemplates] = useState([]);
  const [waModal, setWaModal] = useState(null);
  const canManageTemplates = priest?.can_manage_wa_templates !== false;

  const [bdayScope, setBdayScope] = useState('confessors');
  const [bdayTab, setBdayTab] = useState('week');

  const [confSubView, setConfSubView] = useState('menu');
  const [selectedConfessor, setSelectedConfessor] = useState(null);
  const [showAddConfessor, setShowAddConfessor] = useState(false);
  const [confessorSearchFilter, setConfessorSearchFilter] = useState('');
  const [confessorOriginFilter, setConfessorOriginFilter] = useState('all');
  const [addConfOrigin, setAddConfOrigin] = useState('inside');
  const [insideConfSearch, setInsideConfSearch] = useState('');

  const emptyNewConf = {
    existing_user_id: '', is_church_member: true,
    first_name: '', second_name: '', third_name: '', fourth_name: '',
    dob: '', phone: '', job_title: '', is_studying: false, detailed_stage: '',
    marital_status: 'أعزب', housing_type: 'تمليك', address: '',
    spouse_name: '', spouse_phone: '', has_children: false, children_list: []
  };
  const [newConfessor, setNewConfessor] = useState(emptyNewConf);
  const [tempConfChild, setTempConfChild] = useState({ child_name: '', dob: '', stage: '' });

  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState([]);
  const [durationMode, setDurationMode] = useState('once');
  const [editingSlotId, setEditingSlotId] = useState(null);
  const emptySlot = {
    confession_title: 'جلسة اعترافات', slot_date: todayISO,
    period: 'صباحية', start_time: '07:00', end_time: '12:00',
    location: 'مكتب الاعتراف الرئيسي', max_confessors: 15, notes: ''
  };
  const [slotForm, setSlotForm] = useState(emptySlot);

  const emptyVisit = {
    target_user_id: '', target_name: '', class_name: '', visit_date: todayISO,
    visit_method: 'زيارة منزلية', visit_status: 'تمت الزيارة',
    needs_visit: true, needs_confession: false, notes: ''
  };
  const [visitForm, setVisitForm] = useState(emptyVisit);

  const [selectedStage, setSelectedStage] = useState(null);
  const [serviceSubCard, setServiceSubCard] = useState('menu');
  const [selectedClass, setSelectedClass] = useState(null);
  const [inspectMember, setInspectMember] = useState(null);

  const emptyMass = { mass_name: 'القداس الإلهي', priest_role: 'كاهن خادم', mass_date: '', mass_time: '07:00 ص', church_name: '', target_audience: 'قداس عام للشعب', notes: '' };
  const [massForm, setMassForm] = useState(emptyMass);
  const [editingMassId, setEditingMassId] = useState(null);

  const emptyPers = {
    event_type: 'إكليل (فرح) 👑', activity_kind: 'رحلة', title: '',
    event_date: '', event_time: '', location: '', target_service: '',
    trip_cost: 0, days_count: 1, destinations: '', daily_program: '',
    bus_seats: [createNewBus(1, 'الأتوبيس الأول')], is_public: true, notes: ''
  };
  const [persForm, setPersForm] = useState(emptyPers);
  const [editingPersId, setEditingPersId] = useState(null);
  const [viewBusItem, setViewBusItem] = useState(null);
  const [printBusState, setPrintBusState] = useState(null);

  const [casesSubView, setCasesSubView] = useState('menu');
  const [selectedCategoryName, setSelectedCategoryName] = useState(null);
  const [searchCatFilter, setSearchCatFilter] = useState('all');
  const [caseSearch, setCaseSearch] = useState('');
  const emptyFam = {
    head_first: '', head_second: '', head_third: '', head_fourth: '',
    phone: '', dob: '', head_qualification: '', job: '',
    spouse_first: '', spouse_second: '', spouse_third: '', spouse_fourth: '',
    spouse_phone: '', spouse_dob: '', spouse_qualification: '', spouse_job: '',
    area: '', area_type: 'منطقة شعبية', poverty_level: 'حالة مستترة', housing: 'إيجار جديد',
    monthly_expenses: 0, needs_monthly_aid: false, monthly_aid_amount: 0,
    house_needs: '', case_notes: '', children: [], pendingAttachments: []
  };
  const [famForm, setFamForm] = useState(emptyFam);
  const [tempChild, setTempChild] = useState({ child_name: '', dob: '', stage: '', marital_status: 'أعزب', has_disability: false, disability_details: '' });
  const [editingFamId, setEditingFamId] = useState(null);
  const [uploadingAttach, setUploadingAttach] = useState(false);
  const [selectedUploadType, setSelectedUploadType] = useState('صورة بطاقة');
  const [inspectFamilyAttachments, setInspectFamilyAttachments] = useState(null);
  const [customEntryForm, setCustomEntryForm] = useState({ title: '', entry_date: '', details: '' });

  const loadPriestData = async () => {
    if (!priest?.id) return;
    const [us, sl, cb, sh, sn, vs, sr, ms, ps, fm, fa, cats, sb, uc, cc, ce, wt, jc, jm] = await Promise.all([
      supabase.from('church_users').select('*').order('created_at', { ascending: true }),
      supabase.from('priest_confession_slots').select('*').eq('priest_id', priest.id).order('slot_date', { ascending: true }),
      supabase.from('confession_bookings').select('*').eq('priest_id', priest.id).order('booking_date', { ascending: true }),
      supabase.from('confession_sessions_history').select('*').eq('priest_id', priest.id).order('session_date', { ascending: false }),
      supabase.from('spiritual_notes').select('*'),
      supabase.from('church_visitations').select('*').order('visit_date', { ascending: false }),
      supabase.from('church_services').select('*').order('stage_name', { ascending: true }),
      supabase.from('priest_masses').select('*').eq('priest_id', priest.id).order('mass_date', { ascending: true }),
      supabase.from('priest_personal_schedule').select('*').eq('priest_id', priest.id).order('event_date', { ascending: true }),
      supabase.from('pastoral_families').select('*, children:family_children(*)').order('case_number', { ascending: true }),
      supabase.from('family_attachments').select('*').order('created_at', { ascending: false }),
      supabase.from('case_categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('member_siblings').select('*'),
      supabase.from('user_children').select('*'),
      supabase.from('priest_custom_cards').select('*').or(`priest_id.is.null,priest_id.eq.${priest.id}`),
      supabase.from('priest_custom_entries').select('*').eq('priest_id', priest.id).order('created_at', { ascending: false }),
      supabase.from('whatsapp_templates').select('*').or(`priest_id.is.null,priest_id.eq.${priest.id}`).order('created_at', { ascending: true }),
      supabase.from('joseph_arimathea_cases').select('*').order('created_at', { ascending: false }),
      supabase.from('joseph_memorial_requests').select('*').order('created_at', { ascending: false })
    ]);
    if (us.data) setLocalUsers(us.data);
    if (sl.data) setConfessionSlots(sl.data);
    if (cb.data) setConfessionBookings(cb.data);
    if (sh.data) setSessionsHistory(sh.data);
    if (sn.data) setSpiritualNotes(sn.data);
    if (vs.data) setVisitations(vs.data);
    if (sr.data) setServices(sr.data);
    if (ms.data) setMasses(ms.data);
    if (ps.data) setPersonalItems(ps.data);
    if (fm.data) setFamilies(fm.data);
    if (fa.data) setFamilyAttachments(fa.data);
    if (cats.data) setCaseCategories(cats.data);
    if (sb.data) setSiblings(sb.data);
    if (uc.data) setUserChildren(uc.data);
    if (cc.data) setCustomCards(cc.data);
    if (ce.data) setCustomEntries(ce.data);
    if (jc.data) setJosephCases(jc.data);
    if (jm.data) setJosephMemorials(jm.data);
    if (wt.data && wt.data.length > 0) setWaTemplates(wt.data);
    else setWaTemplates(FALLBACK_WA_TEMPLATES);
  };

  useEffect(() => {
    loadPriestData();
  }, [priest?.id]);

  useEffect(() => {
    if (!priest?.id) return;

    const channel = supabase
      .channel('priest-dashboard-joseph-alerts')
      .on('broadcast', { event: 'new_joseph_alert' }, ({ payload }) => {
        if (payload) {
          setLiveJosephAlert(payload);
          loadPriestData();
          setTimeout(() => setLiveJosephAlert(null), 10000);
        }
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'joseph_arimathea_cases' },
        (payload) => {
          const row = payload.new;
          if (row) {
            setJosephCases(prev => [row, ...prev]);
            setLiveJosephAlert({
              title: row.is_night_death ? '🌙 وفاة ليلية جديدة مسجلة' : '🕊️ بيان حالة وفاة وانتقال جديد',
              message: `المنتقل: ${row.deceased_name} • المُبلّغ: ${row.reported_by_name || 'عضو بالسيستم'}`
            });
            setTimeout(() => setLiveJosephAlert(null), 10000);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'joseph_memorial_requests' },
        (payload) => {
          const row = payload.new;
          if (row) {
            setJosephMemorials(prev => [row, ...prev]);
            setLiveJosephAlert({
              title: '🕯️ طلب ترحيم جديد بالقداس الإلهي',
              message: `المنتقل: ${row.deceased_name} (${row.memorial_type}) • قداس: ${row.mass_date}`
            });
            setTimeout(() => setLiveJosephAlert(null), 10000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [priest?.id]);

  const goBackToHub = () => {
    setActiveCard('hub');
    setConfSubView('menu');
    setSelectedStage(null);
    setServiceSubCard('menu');
    setSelectedClass(null);
    setCasesSubView('menu');
    setSelectedCategoryName(null);
  };

  const myServices = services.filter(s => !s.priest_id || s.priest_id === priest.id);
  const stagesMap = [...new Set(myServices.map(s => s.stage_name))];
  const allServants = localUsers.filter(u => ['head_servant', 'vice_head_servant', 'servant', 'meeting_servant', 'mercy_servant'].includes(u.role));
  const allMembers = localUsers.filter(u => u.role === 'member');
  const myConfessors = localUsers.filter(u => u.confession_father_id === priest.id);

  const pendingCasesCount = josephCases.filter(c => c.status === 'جديد / طارئ').length;
  const pendingMemorialsCount = josephMemorials.filter(m => m.status === 'معلق').length;
  const totalJosephAlerts = pendingCasesCount + pendingMemorialsCount;

  const openWhatsAppComposer = ({ name = '', phone = '', targetId = null, defaultCategory = 'افتقاد', initialMessage = '' }) => {
    const activeTpls = waTemplates.length > 0 ? waTemplates : FALLBACK_WA_TEMPLATES;
    const matchedTpl = activeTpls.find(t => t.category === defaultCategory) || activeTpls[0];
    const message = initialMessage || formatWaMessage(matchedTpl?.message_body || 'سلام ونعمة يا {الاسم} ✝', name, priest?.full_name);
    setWaModal({
      name,
      phone: phone || '',
      targetId,
      message,
      templateBody: matchedTpl?.message_body || '',
      showTemplatesManager: false
    });
  };

  const handleNavigateFromBell = (cardId) => {
    setActiveCard(cardId);
    if (cardId === 'confessions') setConfSubView('confessors');
  };

  const handleUpdateUserFromSheet = async (updatedRow) => {
    const { id, serialNo, statusKey, created_at, ...clean } = updatedRow;
    const { data, error } = await supabase
      .from('church_users')
      .update(clean)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      alert('تعذر تحديث الحالة: ' + error.message);
      return;
    }
    if (data) {
      setLocalUsers(prev => prev.map(u => (u.id === id ? data : u)));
      logActivity({
        user: priest,
        actionType: 'تحديث_حالة_فرد_بالشيت',
        targetTable: 'church_users',
        targetId: id,
        description: `حدّث حالة (${data.full_name}) إلى (${data.member_status})`
      });
    }
    if (onRefresh) await onRefresh();
  };

  const renderBellPanel = () => (
    <div className="flex items-center gap-2">
      <BellNotificationsPanel
        personalItems={personalItems}
        masses={masses}
        confessionBookings={confessionBookings}
        myConfessors={myConfessors}
        allUsers={localUsers}
        todayISO={todayISO}
        josephCases={josephCases}
        josephMemorials={josephMemorials}
        onOpenConfessor={(memberObj) => setSelectedConfessor(memberObj)}
        onOpenWhatsApp={openWhatsAppComposer}
        onNavigateCard={handleNavigateFromBell}
      />

      {totalJosephAlerts > 0 && (
        <button
          type="button"
          onClick={() => setActiveCard('joseph_arimathea')}
          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs flex items-center gap-1.5 shadow-lg animate-pulse cursor-pointer"
          title="حالات وفاة أو كروت ترحيم جديدة بانتظار المتابعة"
        >
          <AlertTriangle size={15} />
          <span>{totalJosephAlerts} طارئ (يوسف الرامي)</span>
        </button>
      )}
    </div>
  );

  const renderTopBar = (title) => (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-4 rounded-2xl border shadow-2xs mb-4 print:hidden">
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={goBackToHub} className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 active:scale-95 rounded-xl text-sm font-bold flex items-center gap-1.5 cursor-pointer transition">
          <ArrowRight size={16} /> رجوع لكروت أبونا
        </button>
        <h2 className="text-base md:text-lg font-black text-[#7a1c24]">{title}</h2>
      </div>
      {renderBellPanel()}
    </div>
  );

  const calcAge = (dob) => {
    if (!dob) return '—';
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)) + ' سنة';
  };

  const daysUntilBirthday = (dobStr) => {
    if (!dobStr) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [, m, d] = dobStr.split('-').map(Number);
    if (!m || !d) return null;
    let next = new Date(today.getFullYear(), m - 1, d);
    if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
    const diff = Math.round((next - today) / 86400000);
    return diff >= 0 && diff <= 7 ? diff : null;
  };

  const getBirthDayInCurrentMonth = (dobStr) => {
    if (!dobStr) return null;
    const [, m, d] = dobStr.split('-').map(Number);
    const currentMonth = new Date().getMonth() + 1;
    return m === currentMonth ? d : null;
  };

  const detectFatherMatch = (sec, third, fourth) => {
    const fatherSig = [sec, third, fourth].map(s => (s || '').trim()).filter(Boolean).join(' ');
    if (fatherSig.length < 4) return null;
    return localUsers.find(u => (u.full_name || '').startsWith(fatherSig));
  };
  const detectedFather = detectFatherMatch(newConfessor.second_name, newConfessor.third_name, newConfessor.fourth_name);

  const confBirthdays = myConfessors.filter(m => daysUntilBirthday(m.dob) !== null);
  const bdayTargetPool = bdayScope === 'confessors' ? myConfessors : localUsers.filter(u => u.role !== 'admin');
  const weekBirthdays = bdayTargetPool
    .map(u => ({ ...u, daysLeft: daysUntilBirthday(u.dob) }))
    .filter(u => u.daysLeft !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const monthBirthdays = bdayTargetPool
    .map(u => ({ ...u, bDayNum: getBirthDayInCurrentMonth(u.dob) }))
    .filter(u => u.bDayNum !== null)
    .sort((a, b) => a.bDayNum - b.bDayNum);

  const currentMonthName = MONTHS_AR[new Date().getMonth()];

  const getMembersForStage = (stageName) => {
    const classNamesInStage = myServices.filter(s => s.stage_name === stageName).map(s => s.class_name);
    return allMembers.filter(m =>
      (m.detailed_stage || '').includes(stageName) ||
      (m.service_stage || '').includes(stageName) ||
      classNamesInStage.includes(m.assigned_class)
    );
  };

  // ====== 1. مواعيد الاعتراف ======
  const selectPeriod = (p) => {
    if (p === 'صباحية') setSlotForm({ ...slotForm, period: 'صباحية', start_time: '07:00', end_time: '12:00' });
    else setSlotForm({ ...slotForm, period: 'مسائية', start_time: '12:00', end_time: '22:00' });
  };

  const handleSaveSlot = async (e) => {
    e.preventDefault();
    if (editingSlotId) {
      const { id, created_at, priest_id, ...clean } = slotForm;
      const { data, error } = await supabase.from('priest_confession_slots').update({ ...clean, max_confessors: Number(clean.max_confessors) }).eq('id', editingSlotId).select().single();
      if (!error && data) {
        setConfessionSlots(confessionSlots.map(s => (s.id === editingSlotId ? data : s)));
        setEditingSlotId(null); setSlotForm(emptySlot);
        logActivity({ user: priest, actionType: 'تعديل_ميعاد_اعتراف', targetTable: 'priest_confession_slots', targetId: data.id, description: `عدل جلسة اعتراف (${data.confession_title}) يوم ${data.slot_date}` });
      } else if (error) alert(error.message);
      return;
    }

    let payloads = [];
    if (durationMode !== 'once') {
      const daysLimit = durationMode === 'week' ? 7 : durationMode === 'month' ? 30 : durationMode === 'two_months' ? 60 : 90;
      const baseDate = new Date(slotForm.slot_date || todayISO);
      const targetWeekDays = selectedDaysOfWeek.length > 0 ? selectedDaysOfWeek : [baseDate.getDay()];
      for (let i = 0; i <= daysLimit; i++) {
        const dt = new Date(baseDate); dt.setDate(baseDate.getDate() + i);
        const iso = dt.toISOString().split('T')[0];
        if (targetWeekDays.includes(dt.getDay()) && iso >= todayISO) {
          payloads.push({ ...slotForm, slot_date: iso, priest_id: priest.id, max_confessors: Number(slotForm.max_confessors) });
        }
      }
    } else {
      payloads.push({ ...slotForm, priest_id: priest.id, max_confessors: Number(slotForm.max_confessors) });
    }

    if (payloads.length === 0) return alert('اختر تاريخاً أو أياماً صالحة');
    const { data, error } = await supabase.from('priest_confession_slots').insert(payloads).select();
    if (!error && data) {
      setConfessionSlots([...confessionSlots, ...data].sort((a, b) => a.slot_date.localeCompare(b.slot_date)));
      setSelectedDaysOfWeek([]); setDurationMode('once'); setSlotForm(emptySlot);
      logActivity({ user: priest, actionType: 'إضافة_مواعيد_اعتراف', targetTable: 'priest_confession_slots', description: `نشر ${data.length} موعد اعتراف (${slotForm.confession_title})` });
      alert(`تم نشر ${data.length} موعد اعتراف بنجاح!`);
    } else if (error) alert(error.message);
  };

  const toggleCancelSlot = async (slot) => {
    let reason = slot.cancel_reason || '';
    if (!slot.is_cancelled) reason = prompt('اكتب سبب الاعتذار ليظهر للشعب:', 'لظرف طارئ') ?? 'معتذر';
    const { data } = await supabase.from('priest_confession_slots').update({ is_cancelled: !slot.is_cancelled, cancel_reason: !slot.is_cancelled ? reason : '' }).eq('id', slot.id).select().single();
    if (data) {
      setConfessionSlots(confessionSlots.map(s => (s.id === slot.id ? data : s)));
      logActivity({ user: priest, actionType: data.is_cancelled ? 'اعتذار_ميعاد_اعتراف' : 'تفعيل_ميعاد_اعتراف', targetTable: 'priest_confession_slots', targetId: slot.id, description: `${data.is_cancelled ? 'اعتذر عن' : 'فعّل'} جلسة اعتراف يوم ${slot.slot_date}` });
    }
  };

  const deleteSlot = async (id) => {
    if (!confirm('حذف موعد الاعتراف؟')) return;
    const { error } = await supabase.from('priest_confession_slots').delete().eq('id', id);
    if (!error) {
      setConfessionSlots(confessionSlots.filter(s => s.id !== id));
      logActivity({ user: priest, actionType: 'حذف_ميعاد_اعتراف', targetTable: 'priest_confession_slots', targetId: id, description: 'حذف موعد اعتراف' });
    }
  };

  // ====== 2. المعترفون ======
  const handleLinkExistingConfessor = async (userObj) => {
    if (!userObj) return;
    const { data, error } = await supabase.from('church_users').update({ confession_father_id: priest.id, is_church_member: true }).eq('id', userObj.id).select().single();
    if (!error && data) {
      setLocalUsers(localUsers.map(u => (u.id === data.id ? data : u)));
      setShowAddConfessor(false); setNewConfessor(emptyNewConf); setInsideConfSearch('');
      logActivity({ user: priest, actionType: 'ربط_معترف_من_الكنيسة', targetTable: 'church_users', targetId: data.id, description: `ربط المعترف (داخل الكنيسة): ${data.full_name}` });
      if (onRefresh) onRefresh();
    } else if (error) alert(error.message);
  };

  const handleAddConfessor = async (e) => {
    e.preventDefault();
    if (newConfessor.existing_user_id) {
      return handleLinkExistingConfessor(localUsers.find(u => u.id === newConfessor.existing_user_id));
    }
    const full_name = [newConfessor.first_name, newConfessor.second_name, newConfessor.third_name, newConfessor.fourth_name].map(s => s.trim()).filter(Boolean).join(' ');
    if (!full_name || !newConfessor.phone || !newConfessor.dob) return alert('الاسم وتاريخ الميلاد ورقم الواتساب مطلوبين!');

    const isInside = addConfOrigin === 'inside';
    const matchedFather = detectFatherMatch(newConfessor.second_name, newConfessor.third_name, newConfessor.fourth_name);

    const { data, error } = await supabase.from('church_users').insert([{
      username: 'conf_' + Date.now(), password: '123', role: 'member', is_church_member: isInside,
      full_name, first_name: newConfessor.first_name.trim(), second_name: newConfessor.second_name.trim(),
      third_name: newConfessor.third_name.trim(), fourth_name: newConfessor.fourth_name.trim(),
      dob: newConfessor.dob, phone: newConfessor.phone.trim(), job_title: newConfessor.job_title || '',
      is_studying: Boolean(newConfessor.is_studying), detailed_stage: newConfessor.detailed_stage || '',
      service_stage: newConfessor.detailed_stage || '', marital_status: newConfessor.marital_status || 'أعزب',
      housing_type: newConfessor.housing_type || 'تمليك', spouse_name: newConfessor.spouse_name || '',
      spouse_phone: newConfessor.spouse_phone || '', address: newConfessor.address || '',
      father_id: matchedFather?.id || null, parent_id: matchedFather?.id || null,
      father_full_name: matchedFather?.full_name || '', confession_father_id: priest.id,
      member_status: 'active'
    }]).select().single();

    if (!error && data) {
      if (newConfessor.has_children && newConfessor.children_list?.length > 0) {
        const kidsPayload = newConfessor.children_list.map(c => ({ parent_user_id: data.id, child_name: c.child_name, dob: c.dob || null, stage: c.stage || '' }));
        const { data: savedKids } = await supabase.from('user_children').insert(kidsPayload).select();
        if (savedKids) setUserChildren([...userChildren, ...savedKids]);
      }
      setLocalUsers([...localUsers, data]);
      setShowAddConfessor(false); setNewConfessor(emptyNewConf); setInsideConfSearch('');
      logActivity({ user: priest, actionType: 'إضافة_معترف', targetTable: 'church_users', targetId: data.id, description: `أضاف معترف جديد (${isInside ? 'داخل الكنيسة' : 'خارج الكنيسة'}): ${data.full_name}` });
      if (onRefresh) onRefresh();
    } else if (error) alert(error.message);
  };

  // ====== 3. الافتقادات ======
  const handleSaveVisitation = async (e, category, stageName = '') => {
    e.preventDefault();
    const { data, error } = await supabase.from('church_visitations').insert([{
      category, service_stage: stageName, class_name: visitForm.class_name || '',
      target_user_id: visitForm.target_user_id || null, target_name: visitForm.target_name,
      visitor_id: priest.id, visit_date: visitForm.visit_date, visit_method: visitForm.visit_method,
      visit_status: visitForm.visit_status, needs_visit: Boolean(visitForm.needs_visit),
      needs_confession: Boolean(visitForm.needs_confession), notes: visitForm.notes
    }]).select().single();
    if (!error && data) {
      setVisitations([data, ...visitations]);
      logActivity({ user: priest, actionType: 'تسجيل_افتقاد', targetTable: 'church_visitations', targetId: data.id, description: `سجل ${category} لـ (${data.target_name}) عبر ${data.visit_method}` });
      setVisitForm(emptyVisit);
    } else if (error) alert(error.message);
  };

  const deleteVisitation = async (id) => {
    const { error } = await supabase.from('church_visitations').delete().eq('id', id);
    if (!error) setVisitations(visitations.filter(v => v.id !== id));
  };

  // ====== 4. القداسات ======
  const handleSaveMass = async (e) => {
    e.preventDefault();
    if (editingMassId) {
      const { id, created_at, priest_id, ...clean } = massForm;
      const { data, error } = await supabase.from('priest_masses').update(clean).eq('id', editingMassId).select().single();
      if (!error && data) { setMasses(masses.map(x => (x.id === editingMassId ? data : x))); setEditingMassId(null); setMassForm(emptyMass); }
    } else {
      const { data, error } = await supabase.from('priest_masses').insert([{ ...massForm, priest_id: priest.id }]).select().single();
      if (!error && data) { setMasses([...masses, data]); setMassForm(emptyMass); }
    }
  };

  const toggleMassAvailability = async (m) => {
    const { data } = await supabase.from('priest_masses').update({ is_available: !m.is_available }).eq('id', m.id).select().single();
    if (data) setMasses(masses.map(x => (x.id === m.id ? data : x)));
  };

  const deleteMass = async (id) => {
    const { error } = await supabase.from('priest_masses').delete().eq('id', id);
    if (!error) setMasses(masses.filter(x => x.id !== id));
  };

  // ====== 5. الجدول الخاص والرحلات ======
  const isTripOrConf = persForm.event_type === 'رحلة كنسية 🚌' || persForm.event_type === 'مؤتمر روحي 🏕️';
  const isConference = persForm.activity_kind === 'مؤتمر' || persForm.event_type === 'مؤتمر روحي 🏕️';

  const persistViewBuses = async (updatedBuses) => {
    if (!viewBusItem) return;
    const { data, error } = await supabase.from('priest_personal_schedule').update({ bus_seats: updatedBuses }).eq('id', viewBusItem.id).select().single();
    if (!error && data) {
      setPersonalItems(personalItems.map(item => (item.id === data.id ? data : item)));
      setViewBusItem(data);
      await syncTripPaymentsTable(data.id, updatedBuses, priest.id, todayISO);
    } else if (error) alert(error.message);
  };

  const generateConferenceProgramTemplate = () => {
    const days = Math.max(1, Number(persForm.days_count || 1));
    const lines = [];
    for (let d = 1; d <= days; d++) {
      lines.push(`--- اليوم ${d} ---`);
      lines.push(d === 1 ? '• التحرك والتسكين:\n• الاجتماع الافتتاحي:' : d === days ? '• القداس الإلهي:\n• التحرك والعودة:' : '• صلاة باكر والقداس:\n• المحاضرة / خلوة:');
      lines.push('');
    }
    setPersForm({ ...persForm, daily_program: (persForm.daily_program ? persForm.daily_program + '\n\n' : '') + lines.join('\n') });
  };

  const handleSavePersonal = async (e) => {
    e.preventDefault();
    const busesClean = normalizeBuses(persForm.bus_seats);
    const payload = { ...persForm, trip_cost: Number(persForm.trip_cost || 0), days_count: Number(persForm.days_count || 1), bus_seats: busesClean };
    if (editingPersId) {
      const { id, created_at, priest_id, ...clean } = payload;
      const { data, error } = await supabase.from('priest_personal_schedule').update(clean).eq('id', editingPersId).select().single();
      if (!error && data) {
        setPersonalItems(personalItems.map(x => (x.id === editingPersId ? data : x)));
        await syncTripPaymentsTable(data.id, busesClean, priest.id, todayISO);
        logActivity({ user: priest, actionType: 'تعديل_الجدول_الخاص', targetTable: 'priest_personal_schedule', targetId: data.id, description: `عدل (${data.event_type}): ${data.title}` });
        setEditingPersId(null); setPersForm({ ...emptyPers, bus_seats: [createNewBus(1, 'الأتوبيس الأول')] });
      } else if (error) alert(error.message);
    } else {
      const { data, error } = await supabase.from('priest_personal_schedule').insert([{ ...payload, priest_id: priest.id }]).select().single();
      if (!error && data) {
        setPersonalItems([...personalItems, data]);
        await syncTripPaymentsTable(data.id, busesClean, priest.id, todayISO);
        logActivity({ user: priest, actionType: 'إضافة_الجدول_الخاص', targetTable: 'priest_personal_schedule', targetId: data.id, description: `أضاف (${data.event_type}): ${data.title}` });
        setPersForm({ ...emptyPers, bus_seats: [createNewBus(1, 'الأتوبيس الأول')] });
      } else if (error) alert(error.message);
    }
  };

  const togglePersonalVisibility = async (p) => {
    const { data } = await supabase.from('priest_personal_schedule').update({ is_public: !p.is_public }).eq('id', p.id).select().single();
    if (data) setPersonalItems(personalItems.map(x => (x.id === p.id ? data : x)));
  };

  const deletePersonal = async (id) => {
    if (!confirm('حذف هذا الموعد / الرحلة نهائياً؟')) return;
    const { error } = await supabase.from('priest_personal_schedule').delete().eq('id', id);
    if (!error) setPersonalItems(personalItems.filter(x => x.id !== id));
  };

  // ====== 6. بحث الحالة والمرفقات ======
  const handleUploadFamilyAttachment = async (file, attachType, targetFamilyId = null) => {
    if (!file) return;
    setUploadingAttach(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const safePath = `${targetFamilyId || 'temp_' + priest.id}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('family-attachments').upload(safePath, file, { upsert: true });
      if (upErr) {
        alert('تعذر رفع الملف (' + upErr.message + ').');
        return;
      }
      const { data: pub } = supabase.storage.from('family-attachments').getPublicUrl(safePath);
      const fileUrl = pub?.publicUrl || '';

      if (targetFamilyId) {
        const { data: savedRow, error: insErr } = await supabase.from('family_attachments')
          .insert([{ family_id: targetFamilyId, attachment_type: attachType, file_name: file.name, file_url: fileUrl, uploaded_by: priest.id }])
          .select().single();
        if (!insErr && savedRow) {
          setFamilyAttachments([savedRow, ...familyAttachments]);
          logActivity({ user: priest, actionType: 'رفع_مرفق_أسرة', targetTable: 'family_attachments', targetId: savedRow.id, description: `رفع مرفق (${attachType}: ${file.name})` });
        }
      } else {
        setFamForm(prev => ({
          ...prev,
          pendingAttachments: [...(prev.pendingAttachments || []), { tempId: `tmp_${Date.now()}`, attachment_type: attachType, file_name: file.name, file_url: fileUrl }]
        }));
      }
    } finally {
      setUploadingAttach(false);
    }
  };

  const handleDeleteAttachment = async (att) => {
    if (!confirm(`حذف المرفق (${att.attachment_type})؟`)) return;
    if (att.tempId) {
      setFamForm(prev => ({ ...prev, pendingAttachments: (prev.pendingAttachments || []).filter(x => x.tempId !== att.tempId) }));
      return;
    }
    const { error } = await supabase.from('family_attachments').delete().eq('id', att.id);
    if (!error) setFamilyAttachments(familyAttachments.filter(x => x.id !== att.id));
  };

  const handleSaveFamily = async (e) => {
    e.preventDefault();
    const head_name = [famForm.head_first, famForm.head_second, famForm.head_third, famForm.head_fourth].map(s => s.trim()).filter(Boolean).join(' ');
    const spouse_full_name = [famForm.spouse_first, famForm.spouse_second, famForm.spouse_third, famForm.spouse_fourth].map(s => s.trim()).filter(Boolean).join(' ');
    if (!head_name) return alert('أدخل الاسم الرباعي لرب الأسرة');

    const { children, pendingAttachments, case_number, id, created_at, ...rest } = famForm;
    const payload = {
      ...rest, priest_id: priest.id, head_name, spouse_full_name,
      dob: famForm.dob || null, spouse_dob: famForm.spouse_dob || null,
      monthly_expenses: Number(famForm.monthly_expenses || 0),
      monthly_aid_amount: Number(famForm.monthly_aid_amount || 0)
    };

    if (editingFamId) {
      const { data: fam, error } = await supabase.from('pastoral_families').update(payload).eq('id', editingFamId).select().single();
      if (!error && fam) {
        await supabase.from('family_children').delete().eq('family_id', editingFamId);
        let savedKids = [];
        if (children?.length > 0) {
          const kidsPayload = children.map(c => ({ family_id: editingFamId, child_name: c.child_name, dob: c.dob || null, stage: c.stage || '', marital_status: c.marital_status || 'أعزب', has_disability: Boolean(c.has_disability), disability_details: c.disability_details || '' }));
          const { data: k } = await supabase.from('family_children').insert(kidsPayload).select();
          if (k) savedKids = k;
        }
        setFamilies(families.map(f => (f.id === editingFamId ? { ...fam, children: savedKids } : f)));
        logActivity({ user: priest, actionType: 'تعديل_أسرة', targetTable: 'pastoral_families', targetId: editingFamId, description: `عدل ملف الأسرة: ${head_name}` });
        setEditingFamId(null); setFamForm(emptyFam); setCasesSubView('search');
      } else if (error) alert(error.message);
    } else {
      const { data: fam, error } = await supabase.from('pastoral_families').insert([payload]).select().single();
      if (!error && fam) {
        let savedKids = [];
        if (children?.length > 0) {
          const kidsPayload = children.map(c => ({ family_id: fam.id, child_name: c.child_name, dob: c.dob || null, stage: c.stage || '', marital_status: c.marital_status || 'أعزب', has_disability: Boolean(c.has_disability), disability_details: c.disability_details || '' }));
          const { data: k } = await supabase.from('family_children').insert(kidsPayload).select();
          if (k) savedKids = k;
        }
        if (pendingAttachments?.length > 0) {
          const attPayload = pendingAttachments.map(a => ({ family_id: fam.id, attachment_type: a.attachment_type, file_name: a.file_name, file_url: a.file_url, uploaded_by: priest.id }));
          const { data: savedAtts } = await supabase.from('family_attachments').insert(attPayload).select();
          if (savedAtts) setFamilyAttachments([...savedAtts, ...familyAttachments]);
        }
        setFamilies([...families, { ...fam, children: savedKids }]);
        logActivity({ user: priest, actionType: 'إضافة_أسرة', targetTable: 'pastoral_families', targetId: fam.id, description: `أضاف ملف أسرة جديد: ${head_name}` });
        setFamForm(emptyFam); setCasesSubView('menu');
      } else if (error) alert(error.message);
    }
  };

  const openEditFamily = (f) => {
    setEditingFamId(f.id);
    const hParts = (f.head_name || '').split(' ');
    const sParts = (f.spouse_full_name || '').split(' ');
    setFamForm({
      ...emptyFam, ...f,
      head_first: f.head_first || hParts[0] || '', head_second: f.head_second || hParts[1] || '', head_third: f.head_third || hParts[2] || '', head_fourth: f.head_fourth || hParts.slice(3).join(' ') || '',
      spouse_first: f.spouse_first || sParts[0] || '', spouse_second: f.spouse_second || sParts[1] || '', spouse_third: f.spouse_third || sParts[2] || '', spouse_fourth: f.spouse_fourth || sParts.slice(3).join(' ') || '',
      dob: f.dob || '', spouse_dob: f.spouse_dob || '', children: f.children || [], pendingAttachments: []
    });
    setCasesSubView('add');
  };

  const deleteFamily = async (id) => {
    if (!confirm('حذف ملف الحالة نهائياً؟')) return;
    const { error } = await supabase.from('pastoral_families').delete().eq('id', id);
    if (!error) setFamilies(families.filter(f => f.id !== id));
  };

  const categoryNames = caseCategories.length > 0 ? caseCategories : [
    { id: '1', name: 'حالة مستترة', icon: '🕊️' }, { id: '2', name: 'إخوة الرب (مفتقرة جداً)', icon: '❤️' },
    { id: '3', name: 'متوسطة الاحتياج', icon: '⚖️' }, { id: '4', name: 'مستقرة', icon: '✅' }
  ];

  const renderGlobalModals = () => (
    <>
      <ConfessorProfileModal
        confessor={selectedConfessor}
        onClose={() => setSelectedConfessor(null)}
        priest={priest}
        spiritualNotes={spiritualNotes}
        setSpiritualNotes={setSpiritualNotes}
        bookings={confessionBookings}
        setBookings={setConfessionBookings}
        sessionsHistory={sessionsHistory}
        setSessionsHistory={setSessionsHistory}
        localUsers={localUsers}
        setLocalUsers={setLocalUsers}
        onRefresh={onRefresh}
        todayISO={todayISO}
        onOpenWhatsApp={openWhatsAppComposer}
      />
      <WhatsAppComposerModal
        waModal={waModal}
        setWaModal={setWaModal}
        priest={priest}
        users={localUsers}
        visitations={visitations}
        waTemplates={waTemplates}
        setWaTemplates={setWaTemplates}
        canManageTemplates={canManageTemplates}
      />
    </>
  );

  // ==============================================================
  // Hub (الشاشة الرئيسية لأبونا)
  // ==============================================================
  if (activeCard === 'hub') {
    const cards = [
      {
        id: 'master_sheet',
        icon: '📋',
        title: 'شيت التسلسل والافتقاد والترحيم',
        desc: 'سحب الكشف الرسمي بالترقيم التسلسلي للخدام والمخدومين والرعايا + حالة الافتقاد وذكرى الترحيم + تصدير وطباعة',
        count: `${localUsers.length} مسجل`,
        color: 'border-teal-300 bg-teal-50/40'
      },
      { id: 'confessions', icon: '🙏', title: 'الاعترافات', desc: 'المواعيد بالمدة، المعترفون (داخل/خارج الكنيسة) والملف الروحي، والافتقاد', count: `${myConfessors.length} معترف • ${confessionSlots.length} موعد`, color: 'border-red-200 bg-white' },
      { id: 'services', icon: '🏫', title: 'جدول الخدمة', desc: 'كروت الخدمات، القيادات، الفصول، الخدام، وافتقاد الخدمة', count: `${stagesMap.length} خدمة`, color: 'border-amber-200 bg-white' },
      { id: 'masses', icon: '⛪', title: 'جدول القداسات', desc: 'اسم القداس، كاهن خادم أو شريك، والفئات', count: `${masses.length} قداس`, color: 'border-blue-200 bg-white' },
      { id: 'personal', icon: '📅', title: 'الجدول الخاص بالكاهن', desc: 'طشت، خطوبة، أكاليل، رحلات ومؤتمرات بالأقساط والأتوبيسات وطباعة الكشوفات', count: `${personalItems.length} موعد`, color: 'border-purple-200 bg-white' },
      { id: 'cases', icon: '🔍', title: 'بحث الحالة / العيلة', desc: 'البحث، التصنيفات، الإضافة، المرفقات (بطاقة/إيجار/تحاليل)، وطباعة PDF', count: `${families.length} أسرة`, color: 'border-emerald-200 bg-white' },
      { id: 'edu_center', icon: '🎓', title: 'المركز التعليمي', desc: 'جدول الدروس، المراحل التعليمية، المواد الدراسية، الأسعار، وتسجيل الحضور', count: 'مركز الدروس', color: 'border-indigo-200 bg-white' },
      {
        id: 'joseph_arimathea',
        icon: '🕊️',
        title: 'خدمة يوسف الرامي',
        desc: 'حالات الوفاة بالليل، الطقوس التلقائية، الصناديق، وخط سير السائق ومكان الدفن',
        count: totalJosephAlerts > 0 ? `🚨 ${totalJosephAlerts} بحاجة للمتابعة` : `${josephCases.length} حالة مسجلة`,
        color: totalJosephAlerts > 0 ? 'border-red-400 bg-red-50/50' : 'border-slate-300 bg-white'
      }
    ];

    const displayedBdays = bdayTab === 'week' ? weekBirthdays : monthBirthdays;

    return (
      <div className="space-y-4 text-sm md:text-base">
        {liveJosephAlert && (
          <div className="bg-linear-to-r from-red-800 to-[#7a1c24] text-white p-4 rounded-3xl shadow-xl border-2 border-amber-300 flex flex-wrap justify-between items-center gap-3 animate-bounce">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-amber-400 text-red-950 rounded-2xl"><AlertTriangle size={20} /></span>
              <div>
                <strong className="block text-amber-200 text-sm md:text-base">{liveJosephAlert.title}</strong>
                <span className="text-xs md:text-sm text-white/90">{liveJosephAlert.message}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setActiveCard('joseph_arimathea'); setLiveJosephAlert(null); }}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-red-950 font-black rounded-xl text-xs shadow cursor-pointer"
              >
                فتح ومتابعة فوراً ↗
              </button>
              <button type="button" onClick={() => setLiveJosephAlert(null)} className="text-white/70 hover:text-white text-xs">✕</button>
            </div>
          </div>
        )}

        <div className="bg-linear-to-r from-[#5c1319] to-[#7a1c24] text-white p-6 rounded-3xl shadow flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-xl font-black text-amber-200">مكتب رعاية: {priest.full_name}</h2>
            <p className="text-sm text-white/85 mt-1">اختر الكارت للدخول إلى التفاصيل الكاملة</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {renderBellPanel()}
            <button
              type="button"
              onClick={() => openWhatsAppComposer({ name: '', phone: '', defaultCategory: 'افتقاد' })}
              className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-xs md:text-sm flex items-center gap-2 cursor-pointer shadow"
            >
              <MessageCircle size={17} /> إرسال رسالة واتساب / بحث بالاسم
            </button>
          </div>
        </div>

        <div className="bg-linear-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-3xl p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-amber-500 text-white rounded-2xl shadow-xs"><BellRing size={18} /></span>
              <div>
                <h3 className="text-sm md:text-base font-black text-amber-950 flex items-center gap-1.5">
                  <Cake size={16} className="text-[#7a1c24]" /> تنبيه أعياد الميلاد (الأسبوع الحالي & شهر {currentMonthName})
                </h3>
                <p className="text-xs text-amber-900">
                  هذا الأسبوع: <strong>{weekBirthdays.length}</strong> • خلال شهر {currentMonthName}: <strong>{monthBirthdays.length}</strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 items-center">
              <button type="button" onClick={() => setBdayTab('week')} className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer ${bdayTab === 'week' ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-amber-950 border-amber-300'}`}>
                🎂 هذا الأسبوع ({weekBirthdays.length})
              </button>
              <button type="button" onClick={() => setBdayTab('month')} className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer ${bdayTab === 'month' ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-amber-950 border-amber-300'}`}>
                📅 كل شهر {currentMonthName} ({monthBirthdays.length})
              </button>
              <select className="p-1.5 border border-amber-300 rounded-xl bg-white text-xs font-bold text-amber-950" value={bdayScope} onChange={e => setBdayScope(e.target.value)}>
                <option value="confessors">معترفي أبونا فقط</option>
                <option value="all">كل شعب الكنيسة</option>
              </select>
            </div>
          </div>

          {displayedBdays.length === 0 ? (
            <div className="bg-white/80 p-3 rounded-2xl border border-amber-200 text-xs text-amber-900 text-center">
              لا توجد أعياد ميلاد مسجلة في هذه الفترة ({bdayTab === 'week' ? 'الأسبوع الحالي' : `شهر ${currentMonthName}`}).
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto">
              {displayedBdays.map(b => {
                const isToday = b.daysLeft === 0;
                return (
                  <div key={b.id} className={`p-3 rounded-2xl border flex justify-between items-center gap-2 ${isToday ? 'bg-red-50 border-red-400' : 'bg-white border-amber-200'}`}>
                    <div className="min-w-0">
                      <strong className="text-xs md:text-sm text-gray-900 block truncate">{b.full_name}</strong>
                      <span className="text-[11px] text-gray-600 block">
                        🎂 {b.dob}
                        {b.daysLeft === 0 && <strong className="mr-1 text-red-700">• اليوم 🎉</strong>}
                        {b.daysLeft > 0 && <strong className="mr-1 text-amber-800">• خلال {b.daysLeft} يوم</strong>}
                      </span>
                    </div>
                    {b.phone ? (
                      <button
                        type="button"
                        onClick={() => openWhatsAppComposer({ name: b.full_name, phone: b.phone, targetId: b.id, defaultCategory: 'معايدة' })}
                        className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <MessageCircle size={13} /> معايدة
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-400 shrink-0">بدون رقم</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(c => (
            <button type="button" key={c.id} onClick={() => setActiveCard(c.id)} className={`${c.color} border-2 p-5 rounded-3xl text-right shadow-sm hover:shadow-md hover:border-[#7a1c24] transition flex flex-col justify-between gap-3 cursor-pointer`}>
              <div className="flex justify-between items-start w-full">
                <span className="text-4xl">{c.icon}</span>
                <span className="px-3 py-1 bg-[#f9ecee] text-[#7a1c24] rounded-full text-xs font-black">{c.count}</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">{c.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{c.desc}</p>
              </div>
            </button>
          ))}
          {customCards.map(cc => (
            <button type="button" key={cc.id} onClick={() => setActiveCard('custom:' + cc.id)} className="bg-amber-50/50 border-2 border-amber-300 p-5 rounded-3xl text-right shadow-sm hover:shadow-md hover:border-[#7a1c24] transition flex flex-col justify-between gap-3 cursor-pointer">
              <div className="flex justify-between items-start w-full">
                <span className="text-4xl">{cc.card_icon || '📌'}</span>
                <span className="px-3 py-1 bg-amber-200 text-amber-950 rounded-full text-xs font-black">كارت مضاف</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">{cc.card_title}</h3>
                <p className="text-sm text-gray-700 mt-1">{cc.description || 'سجل مضاف من الأدمن'}</p>
              </div>
            </button>
          ))}
        </div>

        {renderGlobalModals()}
      </div>
    );
  }

  // شيت التسلسل والافتقاد والترحيم داخل لوحة أبونا الكاهن
  if (activeCard === 'master_sheet') {
    return (
      <div className="space-y-4">
        {renderTopBar('📋 شيت التسلسل والافتقاد والترحيم')}
        <MasterCongregationSheet
          users={localUsers}
          currentUser={priest}
          onUpdateUser={handleUpdateUserFromSheet}
          onRefresh={loadPriestData}
        />
        {renderGlobalModals()}
      </div>
    );
  }

  // باقي الأقسام بنفس كودك الأصلي كاملاً دون نقص
  if (activeCard === 'confessions') {
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const daysInM = new Date(y, m + 1, 0).getDate();
    const startOff = (new Date(y, m, 1).getDay() + 1) % 7;
    const confVisitations = visitations.filter(v => v.category === 'افتقاد معترفين');

    const filteredConfessors = myConfessors.filter(mObj => {
      if (confessorOriginFilter === 'inside' && mObj.is_church_member === false) return false;
      if (confessorOriginFilter === 'outside' && mObj.is_church_member !== false) return false;
      if (!confessorSearchFilter.trim()) return true;
      return ((mObj.full_name || '') + ' ' + (mObj.phone || '') + ' ' + (mObj.address || '')).toLowerCase().includes(confessorSearchFilter.toLowerCase());
    });

    const insideSearchMatches = insideConfSearch.trim().length < 1 ? [] : localUsers.filter(u =>
      u.role !== 'admin' && u.is_church_member !== false && ((u.full_name || '') + ' ' + (u.phone || '')).toLowerCase().includes(insideConfSearch.toLowerCase())
    ).slice(0, 10);

    return (
      <div className="space-y-4 text-sm md:text-base">
        {renderTopBar('🙏 الاعترافات والمتابعة الروحية')}
        {confSubView === 'menu' && (
          <div className="grid sm:grid-cols-3 gap-4">
            <button type="button" onClick={() => setConfSubView('slots')} className="bg-white border-2 border-blue-200 hover:border-[#7a1c24] p-6 rounded-3xl text-right shadow-sm space-y-2 transition cursor-pointer"><span className="text-4xl block">📅</span><h3 className="text-lg font-black text-gray-900">إضافة مواعيد الاعتراف</h3><p className="text-sm text-gray-600">تحديد المدة (أسبوع/شهر/3 شهور)، صباحي/مسائي ({confessionSlots.length})</p></button>
            <button type="button" onClick={() => setConfSubView('confessors')} className="bg-white border-2 border-red-200 hover:border-[#7a1c24] p-6 rounded-3xl text-right shadow-sm space-y-2 transition cursor-pointer"><span className="text-4xl block">🙏</span><h3 className="text-lg font-black text-gray-900">المعترفون ({myConfessors.length})</h3><p className="text-sm text-gray-600">الملف الروحي، الثغرات والإجراءات، والقانون الروحي</p></button>
            <button type="button" onClick={() => setConfSubView('visitations')} className="bg-white border-2 border-amber-200 hover:border-[#7a1c24] p-6 rounded-3xl text-right shadow-sm space-y-2 transition cursor-pointer"><span className="text-4xl block">🕊️</span><h3 className="text-lg font-black text-gray-900">افتقاد المعترفين ({confVisitations.length})</h3><p className="text-sm text-gray-600">افتقاد بزيارة، رسالة واتساب ممنهجة قابلة للتعديل، أو اتصال</p></button>
          </div>
        )}

        {confSubView === 'slots' && (
          <div className="space-y-4">
            <button type="button" onClick={() => setConfSubView('menu')} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm">← رجوع لكروت الاعترافات</button>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-3xl border shadow-sm">
                <div className="flex justify-between items-center mb-3 font-bold">
                  <button type="button" onClick={() => setCalMonth(new Date(y, m - 1, 1))} className="px-3 py-1.5 border rounded-lg">▶</button>
                  <span className="text-base font-black">{MONTHS_AR[m]} {y}</span>
                  <button type="button" onClick={() => setCalMonth(new Date(y, m + 1, 1))} className="px-3 py-1.5 border rounded-lg">◀</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-gray-600 mb-1">{['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'].map(w => <div key={w}>{w}</div>)}</div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: startOff }).map((_, i) => <div key={'e' + i} />)}
                  {Array.from({ length: daysInM }).map((_, idx) => {
                    const day = idx + 1;
                    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const daySlots = confessionSlots.filter(s => s.slot_date === iso);
                    return <button key={day} type="button" onClick={() => setSlotForm({ ...slotForm, slot_date: iso })} className={`p-2.5 rounded-xl border text-center font-bold ${slotForm.slot_date === iso ? 'border-2 border-[#7a1c24] bg-[#f9ecee]' : daySlots.some(s => s.is_cancelled) ? 'bg-red-50 border-red-300 text-red-700' : daySlots.length > 0 ? 'bg-green-50 border-green-300 text-green-800' : 'bg-white'}`}>{day}</button>;
                  })}
                </div>
              </div>

              <form onSubmit={handleSaveSlot} className="bg-white p-5 rounded-3xl border space-y-3 font-bold shadow-sm">
                <h3 className="text-base font-black text-[#7a1c24]">{editingSlotId ? 'تعديل جلسة الاعتراف' : 'إضافة مواعيد اعتراف'}</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => selectPeriod('صباحية')} className={`p-3 rounded-xl border-2 flex items-center justify-center gap-1 cursor-pointer ${slotForm.period === 'صباحية' ? 'bg-amber-50 border-amber-500 text-amber-950' : 'bg-white border-gray-200'}`}><Sun size={16} /> صباحية (7-12)</button>
                  <button type="button" onClick={() => selectPeriod('مسائية')} className={`p-3 rounded-xl border-2 flex items-center justify-center gap-1 cursor-pointer ${slotForm.period === 'مسائية' ? 'bg-indigo-50 border-indigo-500 text-indigo-950' : 'bg-white border-gray-200'}`}><Moon size={16} /> مسائية (12-10)</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input required placeholder="عنوان الجلسة *" className="p-2.5 border rounded-xl" value={slotForm.confession_title} onChange={e => setSlotForm({ ...slotForm, confession_title: e.target.value })} />
                  <input required placeholder="المكان *" className="p-2.5 border rounded-xl" value={slotForm.location} onChange={e => setSlotForm({ ...slotForm, location: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input type="date" className="p-2 border rounded-xl" value={slotForm.slot_date} onChange={e => setSlotForm({ ...slotForm, slot_date: e.target.value })} />
                  <input required type="time" className="p-2 border rounded-xl" value={slotForm.start_time} onChange={e => setSlotForm({ ...slotForm, start_time: e.target.value })} />
                  <input type="time" className="p-2 border rounded-xl" value={slotForm.end_time} onChange={e => setSlotForm({ ...slotForm, end_time: e.target.value })} />
                  <input required type="number" min="1" className="p-2 border rounded-xl" value={slotForm.max_confessors} onChange={e => setSlotForm({ ...slotForm, max_confessors: e.target.value })} />
                </div>
                {!editingSlotId && (
                  <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 space-y-2">
                    <select className="w-full p-2.5 border border-amber-300 rounded-xl bg-white" value={durationMode} onChange={e => setDurationMode(e.target.value)}>
                      <option value="once">يوم واحد فقط</option>
                      <option value="week">لمدة أسبوع (7 أيام)</option>
                      <option value="month">لمدة شهر (30 يوم)</option>
                      <option value="two_months">لمدة شهرين (60 يوم)</option>
                      <option value="three_months">لمدة 3 شهور (90 يوم)</option>
                    </select>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEK_DAYS.map(wd => (
                        <button key={wd.id} type="button" onClick={() => { const next = selectedDaysOfWeek.includes(wd.id) ? selectedDaysOfWeek.filter(x => x !== wd.id) : [...selectedDaysOfWeek, wd.id]; setSelectedDaysOfWeek(next); if (next.length > 0 && durationMode === 'once') setDurationMode('month'); }} className={`px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${selectedDaysOfWeek.includes(wd.id) ? 'bg-[#7a1c24] text-white' : 'bg-white'}`}>{wd.label}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 py-3 bg-[#7a1c24] text-white rounded-xl cursor-pointer">{editingSlotId ? 'حفظ التعديل' : 'نشر الموعد'}</button>
                  {editingSlotId && <button type="button" onClick={() => { setEditingSlotId(null); setSlotForm(emptySlot); }} className="px-4 border rounded-xl">إلغاء</button>}
                </div>
              </form>
            </div>

            <div className="grid gap-2.5">
              {confessionSlots.map(s => (
                <div key={s.id} className={`p-4 rounded-2xl border flex flex-wrap justify-between items-center gap-2 ${s.is_cancelled ? 'bg-red-50 border-red-300' : 'bg-white'}`}>
                  <div>
                    <strong className="text-base">{s.confession_title}</strong>
                    <span className="mr-2 px-2.5 py-0.5 rounded bg-amber-100 text-xs font-bold">{s.period}</span>
                    <span className="mr-2 px-2.5 py-0.5 rounded bg-blue-50 text-xs font-bold">العدد: {s.booked_count || 0}/{s.max_confessors}</span>
                    <p className="text-gray-600 mt-1">📅 {s.slot_date} • ⏰ {s.start_time} - {s.end_time} • 📍 {s.location}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => { setEditingSlotId(s.id); setSlotForm({ ...s }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-3 py-2 bg-gray-100 rounded-xl font-bold flex items-center gap-1 text-xs"><Edit3 size={14} /> تعديل</button>
                    <button type="button" onClick={() => toggleCancelSlot(s)} className={`px-3 py-2 rounded-xl font-bold text-xs ${s.is_cancelled ? 'bg-green-600 text-white' : 'bg-amber-100'}`}>{s.is_cancelled ? 'تفعيل' : 'اعتذار'}</button>
                    <button type="button" onClick={() => deleteSlot(s.id)} className="p-2.5 bg-red-100 text-red-700 rounded-xl"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {confSubView === 'confessors' && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <button type="button" onClick={() => setConfSubView('menu')} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm">← رجوع لكروت الاعترافات</button>
              <button type="button" onClick={() => { setAddConfOrigin('inside'); setInsideConfSearch(''); setNewConfessor(emptyNewConf); setShowAddConfessor(true); }} className="px-4 py-2.5 bg-[#7a1c24] text-white rounded-xl font-bold flex items-center gap-1.5 shadow text-sm cursor-pointer"><UserPlus size={16} /> إضافة معترف</button>
            </div>

            {confBirthdays.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 p-4 rounded-3xl space-y-2">
                <strong className="text-amber-950 block">🎂 أعياد ميلاد المعترفين هذا الأسبوع ({confBirthdays.length}):</strong>
                <div className="flex flex-wrap gap-2">
                  {confBirthdays.map(b => (
                    <div key={b.id} className="bg-white p-3 rounded-2xl border flex items-center gap-3">
                      <div><strong>{b.full_name}</strong><span className="block text-xs text-gray-500">{b.dob}</span></div>
                      {b.phone && <button type="button" onClick={() => openWhatsAppComposer({ name: b.full_name, phone: b.phone, targetId: b.id, defaultCategory: 'معايدة' })} className="px-3 py-1.5 bg-green-600 text-white rounded-xl font-bold text-xs cursor-pointer">تهنئة واتس</button>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white p-3 rounded-2xl border flex flex-wrap gap-2 items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: `الكل (${myConfessors.length})` },
                  { id: 'inside', label: `🏠 داخل الكنيسة (${myConfessors.filter(m => m.is_church_member !== false).length})` },
                  { id: 'outside', label: `🌐 خارج الكنيسة (${myConfessors.filter(m => m.is_church_member === false).length})` }
                ].map(f => (
                  <button key={f.id} type="button" onClick={() => setConfessorOriginFilter(f.id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${confessorOriginFilter === f.id ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-gray-50 text-gray-700'}`}>{f.label}</button>
                ))}
              </div>
              <input placeholder="بحث بالاسم أو التليفون..." className="flex-1 min-w-[200px] p-2 border rounded-xl text-xs" value={confessorSearchFilter} onChange={e => setConfessorSearchFilter(e.target.value)} />
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredConfessors.map(m => {
                const note = spiritualNotes.find(n => n.member_id === m.id);
                const kids = userChildren.filter(k => k.parent_user_id === m.id);
                const linkedFather = m.father_id ? localUsers.find(u => u.id === m.father_id) : null;
                const isOutside = m.is_church_member === false;
                const nextBooking = confessionBookings
                  .filter(b => b.member_id === m.id && b.booking_date >= todayISO && b.status === 'محجوز')
                  .sort((a, b) => (a.booking_date || '').localeCompare(b.booking_date || ''))[0];

                return (
                  <div key={m.id} onClick={() => setSelectedConfessor(m)} className="bg-white p-4 rounded-3xl border-2 border-gray-200 hover:border-[#7a1c24] shadow-sm space-y-2 transition cursor-pointer">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <strong className="text-base text-gray-900 block">{m.full_name}</strong>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-bold ${isOutside ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'}`}>
                          {isOutside ? '🌐 من خارج الكنيسة' : '🏠 من داخل الكنيسة'}
                        </span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${note?.confession_status === 'منتظم' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>{note?.confession_status || 'جديد'}</span>
                    </div>
                    {nextBooking && (
                      <div className="px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-black">
                        📅 حجز قادم: {nextBooking.booking_date === todayISO ? 'اليوم' : nextBooking.booking_date} {nextBooking.booking_time ? `(${nextBooking.booking_time})` : ''}
                      </div>
                    )}
                    <p className="text-sm text-gray-600">🎂 {m.dob || '—'} ({calcAge(m.dob)}) • 💼 {m.job_title || '—'}</p>
                    {linkedFather && <p className="text-blue-800 text-xs font-bold flex items-center gap-1"><Link2 size={13} /> والده: {linkedFather.full_name}</p>}
                    {m.is_studying && <p className="text-blue-700 text-xs">🎓 يدرس: {m.detailed_stage}</p>}
                    {m.marital_status !== 'أعزب' && <p className="text-gray-700 text-xs">💍 {m.spouse_name || m.marital_status} {kids.length > 0 ? `• 👶 ${kids.length} أولاد` : ''}</p>}
                    {note?.spiritual_rule && <p className="text-[#7a1c24] bg-red-50 p-2 rounded-xl text-xs truncate">📜 {note.spiritual_rule}</p>}
                    <div className="flex justify-between items-center pt-1 text-xs">
                      <span className="text-[#7a1c24] font-bold flex items-center gap-1"><Edit3 size={13} /> فتح الملف الروحي</span>
                      {m.phone && (
                        <button type="button" onClick={e => { e.stopPropagation(); openWhatsAppComposer({ name: m.full_name, phone: m.phone, targetId: m.id, defaultCategory: 'متابعة اعتراف' }); }} className="px-3 py-1.5 bg-green-600 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer">
                          <MessageCircle size={13} /> واتس
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {showAddConfessor && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-3xl w-full max-w-xl p-6 space-y-3 font-bold max-h-[92vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b pb-2"><h3 className="text-base font-black text-[#7a1c24]">إضافة معترف جديد</h3><button type="button" onClick={() => setShowAddConfessor(false)} className="p-1.5 bg-gray-100 rounded-lg"><X size={18} /></button></div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => { setAddConfOrigin('inside'); setNewConfessor({ ...emptyNewConf, is_church_member: true }); }} className={`p-3 rounded-2xl border-2 text-xs md:text-sm font-black cursor-pointer ${addConfOrigin === 'inside' ? 'bg-blue-50 border-blue-600 text-blue-950' : 'bg-white border-gray-200 text-gray-700'}`}>🏠 من داخل الكنيسة (بحث بالداتابيز)</button>
                    <button type="button" onClick={() => { setAddConfOrigin('outside'); setNewConfessor({ ...emptyNewConf, is_church_member: false }); }} className={`p-3 rounded-2xl border-2 text-xs md:text-sm font-black cursor-pointer ${addConfOrigin === 'outside' ? 'bg-purple-50 border-purple-600 text-purple-950' : 'bg-white border-gray-200 text-gray-700'}`}>🌐 من خارج الكنيسة (إدخال جديد)</button>
                  </div>

                  {addConfOrigin === 'inside' && (
                    <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200 space-y-2.5 text-sm">
                      <label className="block text-xs text-blue-950 font-black">🔍 ابحث بالاسم أو رقم التليفون لإظهار بياناته من قاعدة بيانات الكنيسة:</label>
                      <input autoFocus type="text" placeholder="اكتب اسم الشخص أو رقم الموبايل..." className="w-full p-2.5 border rounded-xl bg-white" value={insideConfSearch} onChange={e => setInsideConfSearch(e.target.value)} />
                      {insideConfSearch.trim().length > 0 && (
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {insideSearchMatches.length === 0 ? (
                            <p className="text-xs text-gray-600 p-2 bg-white rounded-xl">لا توجد نتائج مطابقة.</p>
                          ) : insideSearchMatches.map(u => {
                            const alreadyMine = u.confession_father_id === priest.id;
                            return (
                              <div key={u.id} className="bg-white p-3 rounded-xl border border-blue-200 flex flex-wrap justify-between items-center gap-2">
                                <div className="text-xs space-y-0.5">
                                  <strong className="text-sm text-gray-900 block">{u.full_name}</strong>
                                  <span className="text-gray-600 block">📞 {u.phone || '—'} • 🎂 {u.dob || '—'} ({calcAge(u.dob)}) • 🎓 {u.detailed_stage || u.service_stage || '—'}</span>
                                  <span className="text-gray-500 block">📍 {u.address || '—'} • 💍 {u.marital_status || '—'}</span>
                                </div>
                                {alreadyMine ? <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-xl text-xs font-black">مضاف عندك ✅</span> : <button type="button" onClick={() => handleLinkExistingConfessor(u)} className="px-3.5 py-2 bg-[#7a1c24] text-white rounded-xl text-xs font-black cursor-pointer">ربط كمعترف +</button>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <form onSubmit={handleAddConfessor} className="space-y-3 text-sm">
                    {addConfOrigin === 'outside' ? (
                      <div className="p-2.5 bg-purple-50 border border-purple-200 text-purple-950 rounded-xl text-xs">🌐 سيتم تسجيل هذا الشخص كمعترف <strong>من خارج الكنيسة</strong> وإضافته للداتابيز مع شارة مميزة.</div>
                    ) : <div className="text-xs text-gray-500 pt-1">أو أضف شخصاً جديداً من داخل الكنيسة:</div>}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <input required placeholder="الأول *" className="p-2.5 border rounded-xl" value={newConfessor.first_name} onChange={e => setNewConfessor({ ...newConfessor, first_name: e.target.value })} />
                      <input required placeholder="الثاني *" className="p-2.5 border rounded-xl" value={newConfessor.second_name} onChange={e => setNewConfessor({ ...newConfessor, second_name: e.target.value })} />
                      <input placeholder="الثالث" className="p-2.5 border rounded-xl" value={newConfessor.third_name} onChange={e => setNewConfessor({ ...newConfessor, third_name: e.target.value })} />
                      <input placeholder="الرابع" className="p-2.5 border rounded-xl" value={newConfessor.fourth_name} onChange={e => setNewConfessor({ ...newConfessor, fourth_name: e.target.value })} />
                    </div>
                    {detectedFather && <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center gap-1.5"><Link2 size={15} /> قرابة مكتشفة: ابن/ابنة (<strong>{detectedFather.full_name}</strong>)</div>}
                    <div className="grid grid-cols-2 gap-2">
                      <input required type="date" className="p-2.5 border rounded-xl" value={newConfessor.dob} onChange={e => setNewConfessor({ ...newConfessor, dob: e.target.value })} />
                      <input required type="tel" placeholder="رقم الواتساب *" className="p-2.5 border rounded-xl" value={newConfessor.phone} onChange={e => setNewConfessor({ ...newConfessor, phone: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="الوظيفة" className="p-2.5 border rounded-xl" value={newConfessor.job_title} onChange={e => setNewConfessor({ ...newConfessor, job_title: e.target.value })} />
                      <div className="flex gap-1">
                        <select className="p-2.5 border rounded-xl bg-white" value={newConfessor.is_studying ? 'yes' : 'no'} onChange={e => setNewConfessor({ ...newConfessor, is_studying: e.target.value === 'yes' })}><option value="no">لا يدرس</option><option value="yes">يدرس</option></select>
                        {newConfessor.is_studying && <input placeholder="بيدرس إيه؟" className="flex-1 p-2.5 border rounded-xl" value={newConfessor.detailed_stage} onChange={e => setNewConfessor({ ...newConfessor, detailed_stage: e.target.value })} />}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <select className="p-2.5 border rounded-xl" value={newConfessor.marital_status} onChange={e => setNewConfessor({ ...newConfessor, marital_status: e.target.value })}><option value="أعزب">أعزب</option><option value="متزوج">متزوج</option><option value="أرمل">أرمل</option></select>
                      <select className="p-2.5 border rounded-xl" value={newConfessor.housing_type} onChange={e => setNewConfessor({ ...newConfessor, housing_type: e.target.value })}><option value="تمليك">تمليك</option><option value="إيجار جديد">إيجار جديد</option><option value="إيجار قديم">إيجار قديم</option></select>
                      <input required placeholder="العنوان *" className="p-2.5 border rounded-xl" value={newConfessor.address} onChange={e => setNewConfessor({ ...newConfessor, address: e.target.value })} />
                    </div>
                    {newConfessor.marital_status !== 'أعزب' && (
                      <div className="bg-pink-50/40 p-3 rounded-2xl border border-pink-200 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input placeholder="اسم الزوج/الزوجة" className="p-2 border rounded-xl bg-white" value={newConfessor.spouse_name} onChange={e => setNewConfessor({ ...newConfessor, spouse_name: e.target.value })} />
                          <input type="tel" placeholder="تليفون الزوج/الزوجة" className="p-2 border rounded-xl bg-white" value={newConfessor.spouse_phone} onChange={e => setNewConfessor({ ...newConfessor, spouse_phone: e.target.value })} />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newConfessor.has_children} onChange={e => setNewConfessor({ ...newConfessor, has_children: e.target.checked })} /> هل عنده أولاد؟</label>
                        {newConfessor.has_children && (
                          <div className="bg-white p-2 rounded-xl border space-y-2">
                            <div className="grid grid-cols-3 gap-1">
                              <input placeholder="اسم الابن" className="p-2 border rounded-lg" value={tempConfChild.child_name} onChange={e => setTempConfChild({ ...tempConfChild, child_name: e.target.value })} />
                              <input type="date" className="p-2 border rounded-lg" value={tempConfChild.dob} onChange={e => setTempConfChild({ ...tempConfChild, dob: e.target.value })} />
                              <input placeholder="بيدرس إيه" className="p-2 border rounded-lg" value={tempConfChild.stage} onChange={e => setTempConfChild({ ...tempConfChild, stage: e.target.value })} />
                            </div>
                            <button type="button" onClick={() => { if (tempConfChild.child_name) { setNewConfessor({ ...newConfessor, children_list: [...newConfessor.children_list, tempConfChild] }); setTempConfChild({ child_name: '', dob: '', stage: '' }); } }} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs">+ إضافة الابن</button>
                            {newConfessor.children_list.map((c, i) => <div key={i} className="text-xs bg-gray-50 px-2 py-1 rounded flex justify-between"><span>• {c.child_name} ({c.stage})</span><button type="button" onClick={() => setNewConfessor({ ...newConfessor, children_list: newConfessor.children_list.filter((_, idx) => idx !== i) })} className="text-red-600">حذف</button></div>)}
                          </div>
                        )}
                      </div>
                    )}
                    <button type="submit" className="w-full py-3 bg-[#7a1c24] text-white rounded-xl cursor-pointer">
                      {addConfOrigin === 'outside' ? 'حفظ كمعترف من خارج الكنيسة' : 'حفظ كمعترف من داخل الكنيسة'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {confSubView === 'visitations' && (
          <div className="space-y-4">
            <button type="button" onClick={() => setConfSubView('menu')} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm">← رجوع لكروت الاعترافات</button>
            <form onSubmit={e => handleSaveVisitation(e, 'افتقاد معترفين')} className="bg-white p-4 rounded-3xl border space-y-3 font-bold">
              <div className="grid md:grid-cols-4 gap-2">
                <select className="p-2.5 border rounded-xl" value={visitForm.target_user_id} onChange={e => { const u = myConfessors.find(x => x.id === e.target.value); setVisitForm({ ...visitForm, target_user_id: e.target.value, target_name: u?.full_name || '' }); }}><option value="">-- اختر --</option>{myConfessors.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select>
                <input required placeholder="الاسم *" className="p-2.5 border rounded-xl" value={visitForm.target_name} onChange={e => setVisitForm({ ...visitForm, target_name: e.target.value })} />
                <select className="p-2.5 border rounded-xl" value={visitForm.visit_method} onChange={e => setVisitForm({ ...visitForm, visit_method: e.target.value })}><option>زيارة منزلية</option><option>رسالة واتساب</option><option>اتصال هاتفي</option></select>
                <input type="date" className="p-2.5 border rounded-xl" value={visitForm.visit_date} onChange={e => setVisitForm({ ...visitForm, visit_date: e.target.value })} />
              </div>
              <input placeholder="تفاصيل / ملاحظات..." className="w-full p-2.5 border rounded-xl" value={visitForm.notes} onChange={e => setVisitForm({ ...visitForm, notes: e.target.value })} />
              <button type="submit" className="px-6 py-2.5 bg-[#7a1c24] text-white rounded-xl cursor-pointer">حفظ</button>
            </form>
            <div className="grid gap-2.5">
              {confVisitations.map(v => {
                const targetObj = myConfessors.find(m => m.id === v.target_user_id);
                return (
                  <div key={v.id} className="bg-white p-4 rounded-2xl border flex flex-wrap justify-between items-center gap-2">
                    <div>
                      <strong className="text-base">{v.target_name}</strong>
                      <span className="mr-2 px-2.5 py-0.5 rounded bg-blue-50 text-blue-800 text-xs font-bold">{v.visit_method || 'زيارة'}</span>
                      <span className="mr-2 px-2.5 py-0.5 rounded bg-green-50 text-green-800 text-xs">{v.visit_status}</span>
                      <p className="text-gray-600 mt-1">📅 {v.visit_date} {targetObj?.dob && `• 🎂 ${targetObj.dob}`} {v.notes && `• ${v.notes}`}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => openWhatsAppComposer({ name: v.target_name, phone: targetObj?.phone || '', targetId: v.target_user_id, defaultCategory: 'افتقاد' })} className="px-3 py-2 bg-green-600 text-white rounded-xl font-bold flex items-center gap-1 text-xs cursor-pointer"><MessageCircle size={14} /> رسالة واتس</button>
                      <button type="button" onClick={() => deleteVisitation(v.id)} className="p-2.5 bg-red-50 text-red-700 rounded-xl"><Trash2 size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {renderGlobalModals()}
      </div>
    );
  }

  if (activeCard === 'services') {
    const stageClasses = selectedStage ? myServices.filter(s => s.stage_name === selectedStage) : [];
    const stageServants = selectedStage ? allServants.filter(u => (u.detailed_stage || u.service_stage || '').includes(selectedStage) || (u.sector || '').includes(selectedStage) || stageClasses.some(c => c.class_name === u.assigned_class)) : [];
    const stageMembers = selectedStage ? getMembersForStage(selectedStage) : [];
    const stageVisitations = visitations.filter(v => v.category === 'افتقاد خدمة' && v.service_stage === selectedStage);

    return (
      <div className="space-y-4 text-sm md:text-base">
        {renderTopBar('🏫 جدول الخدمات والفصول والخدام')}
        {!selectedStage ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {stagesMap.map(st => (
              <button type="button" key={st} onClick={() => { setSelectedStage(st); setServiceSubCard('menu'); }} className="bg-white p-5 rounded-3xl border-2 hover:border-[#7a1c24] text-right shadow-sm space-y-2 cursor-pointer">
                <span className="text-3xl">📖</span><h3 className="text-lg font-black">{st}</h3>
                <p className="text-sm text-gray-600">{myServices.filter(s => s.stage_name === st).length} فصل • {getMembersForStage(st).length} مخدوم</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button type="button" onClick={() => { setSelectedStage(null); setServiceSubCard('menu'); setSelectedClass(null); }} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm">← كل الخدمات</button>
              {serviceSubCard !== 'menu' && <button type="button" onClick={() => setServiceSubCard('menu')} className="px-4 py-2 bg-amber-100 rounded-xl font-bold text-sm">← كروت {selectedStage}</button>}
            </div>

            {serviceSubCard === 'menu' && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <button type="button" onClick={() => setServiceSubCard('leaders')} className="bg-white border-2 p-5 rounded-3xl text-right space-y-2 hover:border-[#7a1c24] cursor-pointer"><span className="text-3xl block">👑</span><strong className="text-base block">القيادات</strong></button>
                <button type="button" onClick={() => setServiceSubCard('classes')} className="bg-white border-2 p-5 rounded-3xl text-right space-y-2 hover:border-[#7a1c24] cursor-pointer"><span className="text-3xl block">🏫</span><strong className="text-base block">الفصول والمخدومين ({stageClasses.length})</strong></button>
                <button type="button" onClick={() => setServiceSubCard('servants')} className="bg-white border-2 p-5 rounded-3xl text-right space-y-2 hover:border-[#7a1c24] cursor-pointer"><span className="text-3xl block">👥</span><strong className="text-base block">الخدام ({stageServants.length})</strong></button>
                <button type="button" onClick={() => setServiceSubCard('visitations')} className="bg-white border-2 p-5 rounded-3xl text-right space-y-2 hover:border-[#7a1c24] cursor-pointer"><span className="text-3xl block">🕊️</span><strong className="text-base block">افتقاد {selectedStage} ({stageVisitations.length})</strong></button>
              </div>
            )}

            {serviceSubCard === 'leaders' && (
              <div className="bg-white p-5 rounded-3xl border grid md:grid-cols-2 gap-3">
                <div className="p-4 bg-[#fbfaf7] rounded-2xl border"><span className="text-gray-500 block">أمين الخدمة:</span><strong className="text-base">{stageClasses[0]?.head_servant_name || 'غير محدد'}</strong></div>
                <div className="p-4 bg-[#fbfaf7] rounded-2xl border"><span className="text-gray-500 block">مساعد الأمين:</span><strong className="text-base">{stageClasses[0]?.vice_head_name || 'غير محدد'}</strong></div>
              </div>
            )}

            {serviceSubCard === 'classes' && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-3">
                  {stageClasses.map(cls => (
                    <button type="button" key={cls.id} onClick={() => setSelectedClass(selectedClass?.id === cls.id ? null : cls)} className={`p-4 rounded-2xl border-2 text-right ${selectedClass?.id === cls.id ? 'bg-[#f9ecee] border-[#7a1c24]' : 'bg-white'}`}>
                      <strong className="text-base block">{cls.class_name}</strong><span className="text-sm text-gray-600">⏰ {cls.meeting_time}</span>
                    </button>
                  ))}
                </div>
                <div className="bg-white p-4 rounded-3xl border grid sm:grid-cols-2 gap-2.5">
                  {(selectedClass ? stageMembers.filter(m => m.assigned_class === selectedClass.class_name || (m.detailed_stage || '').includes(selectedClass.class_name)) : stageMembers).map(m => (
                    <button type="button" key={m.id} onClick={() => setInspectMember(m)} className="p-3.5 bg-[#fbfaf7] rounded-2xl border text-right flex justify-between items-center">
                      <div><strong className="text-base">{m.full_name}</strong><span className="block text-sm text-gray-600">🎂 {calcAge(m.dob)}</span></div>
                      <span className="text-[#7a1c24] font-bold">التفاصيل</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {serviceSubCard === 'servants' && (
              <div className="bg-white p-4 rounded-3xl border space-y-2.5">
                {stageServants.map(sv => (
                  <div key={sv.id} className="p-3.5 bg-[#fbfaf7] rounded-2xl border flex flex-wrap justify-between items-center gap-2">
                    <div>
                      <strong className="text-base">{sv.full_name}</strong>
                      <span className="mr-2 px-2.5 py-0.5 rounded bg-amber-100 text-amber-950 text-xs font-bold">{sv.servant_training_status || 'خادم متكلم (اجتاز إعداد خدام)'}</span>
                      <p className="text-sm text-gray-600 mt-0.5">💼 {sv.job_title || '—'} {sv.assigned_class && `• 🏫 فصل: ${sv.assigned_class}`}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {sv.phone && (
                        <>
                          <button type="button" onClick={() => openWhatsAppComposer({ name: sv.full_name, phone: sv.phone, targetId: sv.id, defaultCategory: 'افتقاد' })} className="px-3 py-2 bg-green-600 text-white rounded-xl font-bold text-xs cursor-pointer"><MessageCircle size={14} /></button>
                          <a href={`tel:${sv.phone}`} className="px-3.5 py-2 bg-white border rounded-xl font-bold text-sm">{sv.phone}</a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {serviceSubCard === 'visitations' && (
              <div className="bg-white p-4 rounded-3xl border space-y-3">
                <h4 className="font-black text-base text-[#7a1c24]">🕊️ متابعة وافتقاد فصول ({selectedStage})</h4>
                <form onSubmit={e => handleSaveVisitation(e, 'افتقاد خدمة', selectedStage)} className="space-y-2 font-bold">
                  <div className="grid md:grid-cols-3 gap-2">
                    <select className="p-2.5 border rounded-xl" value={visitForm.class_name} onChange={e => setVisitForm({ ...visitForm, class_name: e.target.value })}><option value="">-- اختر الفصل --</option>{stageClasses.map(c => <option key={c.id} value={c.class_name}>{c.class_name}</option>)}</select>
                    <select className="p-2.5 border rounded-xl" value={visitForm.target_user_id} onChange={e => { const u = allMembers.find(x => x.id === e.target.value); setVisitForm({ ...visitForm, target_user_id: e.target.value, target_name: u?.full_name || '' }); }}><option value="">-- اختر المخدوم --</option>{(stageMembers.length > 0 ? stageMembers : allMembers).map(m => <option key={m.id} value={m.id}>{m.full_name} ({m.detailed_stage})</option>)}</select>
                    <input required placeholder="الاسم *" className="p-2.5 border rounded-xl" value={visitForm.target_name} onChange={e => setVisitForm({ ...visitForm, target_name: e.target.value })} />
                  </div>
                  <div className="flex flex-wrap gap-3 items-center">
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={visitForm.needs_visit} onChange={e => setVisitForm({ ...visitForm, needs_visit: e.target.checked })} /> يحتاج افتقاد</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={visitForm.needs_confession} onChange={e => setVisitForm({ ...visitForm, needs_confession: e.target.checked })} /> يحتاج اعتراف</label>
                    <button type="submit" className="px-5 py-2.5 bg-[#7a1c24] text-white rounded-xl">حفظ</button>
                  </div>
                </form>
                {stageVisitations.map(v => {
                  const targetObj = allMembers.find(m => m.id === v.target_user_id);
                  return (
                    <div key={v.id} className="p-3.5 bg-[#fbfaf7] rounded-2xl border flex justify-between items-center">
                      <div><strong>{v.target_name}</strong> {v.class_name && `(${v.class_name})`} {v.needs_visit && '• 🕊️ يحتاج افتقاد'} {v.needs_confession && '• 🙏 يحتاج اعتراف'}</div>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => openWhatsAppComposer({ name: v.target_name, phone: targetObj?.phone || '', targetId: v.target_user_id, defaultCategory: 'افتقاد' })} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs cursor-pointer"><MessageCircle size={14} /></button>
                        <button type="button" onClick={() => deleteVisitation(v.id)} className="p-2 bg-red-50 text-red-700 rounded-lg"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {inspectMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-2 text-sm">
              <div className="flex justify-between border-b pb-2"><strong className="text-lg text-[#7a1c24]">{inspectMember.full_name}</strong><button type="button" onClick={() => setInspectMember(null)}><X size={18} /></button></div>
              <p>🎂 {inspectMember.dob} ({calcAge(inspectMember.dob)}) • 🎓 {inspectMember.detailed_stage}</p>
              <p>📍 {inspectMember.address || '—'} • 📞 {inspectMember.phone}</p>
              {inspectMember.phone && <button type="button" onClick={() => openWhatsAppComposer({ name: inspectMember.full_name, phone: inspectMember.phone, targetId: inspectMember.id, defaultCategory: 'افتقاد' })} className="px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"><MessageCircle size={14} /> إرسال واتساب</button>}
              {siblings.filter(s => s.member_id === inspectMember.id).map(sib => <div key={sib.id} className="p-2 bg-amber-50 rounded-xl">• الأخ: {sib.sibling_full_name} ({sib.stage_or_job})</div>)}
            </div>
          </div>
        )}
        {renderGlobalModals()}
      </div>
    );
  }

  if (activeCard === 'masses') {
    return (
      <div className="space-y-4 text-sm md:text-base">
        {renderTopBar('⛪ جدول قداسات أبونا')}
        <form onSubmit={handleSaveMass} className="bg-white p-4 rounded-3xl border space-y-3 font-bold">
          <div className="grid md:grid-cols-4 gap-2">
            <input required placeholder="اسم القداس *" className="p-2.5 border rounded-xl" value={massForm.mass_name} onChange={e => setMassForm({ ...massForm, mass_name: e.target.value })} />
            <select className="p-2.5 border rounded-xl bg-amber-50" value={massForm.priest_role} onChange={e => setMassForm({ ...massForm, priest_role: e.target.value })}><option value="كاهن خادم">✝ كاهن خادم</option><option value="كاهن شريك">🕊️ كاهن شريك</option></select>
            <input required type="date" className="p-2.5 border rounded-xl" value={massForm.mass_date} onChange={e => setMassForm({ ...massForm, mass_date: e.target.value })} />
            <input required placeholder="الوقت *" className="p-2.5 border rounded-xl" value={massForm.mass_time} onChange={e => setMassForm({ ...massForm, mass_time: e.target.value })} />
          </div>
          <div className="grid md:grid-cols-3 gap-2">
            <input required placeholder="الكنيسة *" className="p-2.5 border rounded-xl" value={massForm.church_name} onChange={e => setMassForm({ ...massForm, church_name: e.target.value })} />
            <select className="p-2.5 border rounded-xl" value={massForm.target_audience} onChange={e => setMassForm({ ...massForm, target_audience: e.target.value })}>{MASS_AUDIENCES.map((a, i) => <option key={i} value={a}>{a}</option>)}</select>
            <button type="submit" className="bg-[#7a1c24] text-white rounded-xl p-2.5">{editingMassId ? 'حفظ التعديل' : '+ إضافة قداس'}</button>
          </div>
        </form>
        {masses.map(m => (
          <div key={m.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center gap-2">
            <div><span className="px-2.5 py-0.5 bg-amber-100 rounded text-xs ml-2">{m.priest_role}</span><span className="px-2.5 py-0.5 bg-blue-100 rounded text-xs ml-2">{m.target_audience}</span><strong className="text-base">{m.mass_name} — {m.church_name}</strong><p className="text-sm text-gray-600 mt-1">📅 {m.mass_date} • ⏰ {m.mass_time}</p></div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => { setEditingMassId(m.id); setMassForm({ ...m }); }} className="p-2.5 bg-gray-100 rounded-xl"><Edit3 size={15} /></button>
              <button type="button" onClick={() => toggleMassAvailability(m)} className={`px-3 py-1.5 rounded-xl font-bold text-xs ${m.is_available ? 'bg-green-100' : 'bg-red-100'}`}>{m.is_available ? 'متاح' : 'معتذر'}</button>
              <button type="button" onClick={() => deleteMass(m.id)} className="p-2.5 bg-red-50 text-red-700 rounded-xl"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
        {renderGlobalModals()}
      </div>
    );
  }

  if (activeCard === 'personal') {
    return (
      <div className="space-y-4 text-sm md:text-base">
        <div className={printBusState ? 'print:hidden space-y-4' : 'space-y-4'}>
          {renderTopBar('📅 الجدول الخاص بالكاهن (طشت / خطوبة / إكليل / رحلات ومؤتمرات)')}

          <form onSubmit={handleSavePersonal} className="bg-white p-5 rounded-3xl border space-y-3 font-bold">
            <div className="grid md:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs text-gray-700 mb-1">نوع المناسبة / النشاط *</label>
                <select className="w-full p-2.5 border rounded-xl" value={persForm.event_type} onChange={e => { const val = e.target.value; setPersForm({ ...persForm, event_type: val, activity_kind: val === 'مؤتمر روحي 🏕️' ? 'مؤتمر' : val === 'رحلة كنسية 🚌' ? 'رحلة' : persForm.activity_kind }); }}>
                  <option value="خطوبة 💍">خطوبة 💍</option>
                  <option value="إكليل (فرح) 👑">إكليل (فرح) 👑</option>
                  <option value="صلاة طشت (قبل المعمودية) 💧">صلاة طشت (قبل المعمودية) 💧</option>
                  <option value="معمودية ✝">معمودية ✝</option>
                  <option value="صلاة أربعين 🕯️">صلاة أربعين 🕯️</option>
                  <option value="الذكرى السنوية 🕊️">الذكرى السنوية 🕊️</option>
                  <option value="رحلة كنسية 🚌">رحلة كنسية 🚌</option>
                  <option value="مؤتمر روحي 🏕️">مؤتمر روحي 🏕️</option>
                  <option value="ظرف خاص 📅">ظرف خاص 📅</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">{isConference ? 'اسم المؤتمر *' : 'اسم الرحلة / التفاصيل *'}</label>
                <input required placeholder="التفاصيل..." className="w-full p-2.5 border rounded-xl" value={persForm.title} onChange={e => setPersForm({ ...persForm, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">نقطة التجمع / الكنيسة</label>
                <input placeholder="المكان / الكنيسة" className="w-full p-2.5 border rounded-xl" value={persForm.location} onChange={e => setPersForm({ ...persForm, location: e.target.value })} />
              </div>
            </div>

            {isTripOrConf && (
              <div className="bg-purple-50/60 p-4 rounded-2xl border-2 border-purple-200 space-y-3">
                <h4 className="text-base font-black text-purple-950 flex items-center gap-1.5"><Bus size={18} /> {isConference ? 'تفاصيل المؤتمر والبرنامج والأتوبيسات' : 'تفاصيل الرحلة وحجز الأتوبيسات'}</h4>
                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-xs text-purple-950 mb-1">النوع</label>
                    <select className="w-full p-2.5 border rounded-xl bg-white" value={persForm.activity_kind} onChange={e => { const kind = e.target.value; setPersForm({ ...persForm, activity_kind: kind, event_type: kind === 'مؤتمر' ? 'مؤتمر روحي 🏕️' : 'رحلة كنسية 🚌' }); }}>
                      <option value="رحلة">🚌 رحلة</option>
                      <option value="مؤتمر">🏕️ مؤتمر</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-purple-950 mb-1">الخدمة التابعة لها</label>
                    <select className="w-full p-2.5 border rounded-xl bg-white" value={persForm.target_service} onChange={e => setPersForm({ ...persForm, target_service: e.target.value })}><option value="">-- عام لكل الخدمات --</option>{stagesMap.map(st => <option key={st} value={st}>{st}</option>)}</select>
                  </div>
                  <div>
                    <label className="block text-xs text-purple-950 mb-1">سعر الفرد (ج.م) *</label>
                    <input type="number" min="0" className="w-full p-2.5 border rounded-xl bg-white" value={persForm.trip_cost || ''} onChange={e => setPersForm({ ...persForm, trip_cost: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-purple-950 mb-1">عدد الأيام</label>
                    <input type="number" min="1" className="w-full p-2.5 border rounded-xl bg-white" value={persForm.days_count} onChange={e => setPersForm({ ...persForm, days_count: e.target.value })} />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-2.5">
                  <textarea rows="3" placeholder={isConference ? 'بيت المؤتمر والمنطقة...' : 'الأماكن والمزارات...'} className="w-full p-2.5 border rounded-xl bg-white font-normal" value={persForm.destinations} onChange={e => setPersForm({ ...persForm, destinations: e.target.value })} />
                  <div className="space-y-1">
                    {isConference && <button type="button" onClick={generateConferenceProgramTemplate} className="px-2.5 py-1 bg-purple-700 text-white rounded-lg text-xs cursor-pointer">+ توليد قالب ({persForm.days_count || 1} يوم)</button>}
                    <textarea rows="3" placeholder="البرنامج اليومي..." className="w-full p-2.5 border rounded-xl bg-white font-normal" value={persForm.daily_program} onChange={e => setPersForm({ ...persForm, daily_program: e.target.value })} />
                  </div>
                </div>

                <BusVisualizerSection
                  rawBusesData={persForm.bus_seats}
                  tripCost={persForm.trip_cost}
                  isViewMode={false}
                  localUsers={localUsers}
                  priest={priest}
                  todayISO={todayISO}
                  onSaveBuses={async (updated) => setPersForm(prev => ({ ...prev, bus_seats: updated }))}
                  onLocalRenameBuses={(updated) => setPersForm(prev => ({ ...prev, bus_seats: updated }))}
                  onOpenWhatsApp={openWhatsAppComposer}
                />
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-2.5 items-end">
              <div><label className="block text-xs text-gray-700 mb-1">التاريخ *</label><input required type="date" className="w-full p-2.5 border rounded-xl" value={persForm.event_date} onChange={e => setPersForm({ ...persForm, event_date: e.target.value })} /></div>
              <div><label className="block text-xs text-gray-700 mb-1">ميعاد التحرك / الساعة</label><input placeholder="6:00 ص" className="w-full p-2.5 border rounded-xl" value={persForm.event_time} onChange={e => setPersForm({ ...persForm, event_time: e.target.value })} /></div>
              <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border cursor-pointer text-sm"><input type="checkbox" checked={persForm.is_public} onChange={e => setPersForm({ ...persForm, is_public: e.target.checked })} /> {persForm.is_public ? '📢 يظهر للشعب' : '🔒 سري لأبونا'}</label>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-6 py-3 bg-[#7a1c24] text-white rounded-xl cursor-pointer">{editingPersId ? 'حفظ التعديل' : 'حفظ الموعد'}</button>
              {editingPersId && <button type="button" onClick={() => { setEditingPersId(null); setPersForm({ ...emptyPers, bus_seats: [createNewBus(1, 'الأتوبيس الأول')] }); }} className="px-4 border rounded-xl">إلغاء التعديل</button>}
            </div>
          </form>

          {personalItems.map(p => {
            const isTripItem = p.event_type === 'رحلة كنسية 🚌' || p.event_type === 'مؤتمر روحي 🏕️';
            const busesList = normalizeBuses(p.bus_seats);
            const bookedSeats = busesList.reduce((acc, b) => acc + (b.seats || []).filter(s => !s.isDoor && s.occupant).length, 0);
            const totalSeats = busesList.reduce((acc, b) => acc + (b.seats || []).filter(s => !s.isDoor).length, 0);
            const peopleSum = isTripItem ? buildGroupedPeopleSummary(busesList, Number(p.trip_cost || 0), localUsers) : [];
            const collectedSum = peopleSum.reduce((sum, x) => sum + x.totalPaid, 0);
            const remainingSum = peopleSum.reduce((sum, x) => sum + x.totalRemaining, 0);

            return (
              <div key={p.id} className="bg-white p-5 rounded-2xl border space-y-2.5 shadow-2xs">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-purple-100 text-purple-950 rounded text-xs font-bold">{p.event_type}</span>
                      <strong className="text-base md:text-lg">{p.title}</strong>
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-900 rounded text-xs font-bold">{p.target_service ? `خدمة: ${p.target_service}` : 'عام'}</span>
                      {isTripItem && <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded text-xs font-black">💰 {p.trip_cost || 0} ج.م</span>}
                    </div>
                    <p className="text-sm text-gray-600">📅 {p.event_date} {p.event_time && `• ⏰ ${p.event_time}`} {p.location && `• 📍 ${p.location}`}</p>
                    {isTripItem && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {busesList.map((b, bi) => <span key={b.id || bi} className="px-2.5 py-1 bg-slate-100 border rounded-lg text-xs font-bold">🚌 {b.name}: {(b.seats || []).filter(s => !s.isDoor && s.occupant).length}/{(b.seats || []).filter(s => !s.isDoor).length}</span>)}
                        <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-black text-emerald-800">محصل: {collectedSum} ج.م</span>
                        {remainingSum > 0 && <span className="px-2.5 py-1 bg-red-50 border border-red-200 rounded-lg text-xs font-black text-red-700">متبقي: {remainingSum} ج.م</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {isTripItem && (
                      <>
                        <button type="button" onClick={() => setViewBusItem(p)} className="px-3.5 py-2 bg-amber-500 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-xs"><Bus size={16} /> الأتوبيسات ({busesList.length}) • {bookedSeats}/{totalSeats}</button>
                        <button type="button" onClick={() => setPrintBusState({ trip: p, buses: busesList })} className="px-3.5 py-2 bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-xs"><Printer size={16} /> طباعة الكشوفات</button>
                      </>
                    )}
                    <button type="button" onClick={() => { setEditingPersId(p.id); setPersForm({ ...emptyPers, ...p, bus_seats: normalizeBuses(p.bus_seats) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2.5 bg-gray-100 rounded-xl"><Edit3 size={15} /></button>
                    <button type="button" onClick={() => togglePersonalVisibility(p)} className="p-2.5 bg-blue-50 rounded-xl">{p.is_public ? <Globe size={15} /> : <Lock size={15} />}</button>
                    <button type="button" onClick={() => deletePersonal(p.id)} className="p-2.5 bg-red-50 text-red-700 rounded-xl"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            );
          })}

          {viewBusItem && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl w-full max-w-3xl p-5 space-y-3 max-h-[92vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h3 className="text-lg font-black text-[#7a1c24]">🚌 إدارة الأتوبيسات والمقاعد — {viewBusItem.title}</h3>
                    <p className="text-xs md:text-sm text-gray-600">التاريخ: {viewBusItem.event_date} • السعر للفرد: {viewBusItem.trip_cost} ج.م</p>
                  </div>
                  <button type="button" onClick={() => setViewBusItem(null)} className="p-2 bg-gray-100 rounded-xl"><X size={18} /></button>
                </div>
                <BusVisualizerSection
                  rawBusesData={viewBusItem.bus_seats}
                  tripCost={viewBusItem.trip_cost}
                  isViewMode={true}
                  tripObj={viewBusItem}
                  localUsers={localUsers}
                  priest={priest}
                  todayISO={todayISO}
                  onSaveBuses={persistViewBuses}
                  onLocalRenameBuses={(updated) => setViewBusItem(prev => ({ ...prev, bus_seats: updated }))}
                  onOpenPrint={setPrintBusState}
                  onOpenWhatsApp={openWhatsAppComposer}
                />
              </div>
            </div>
          )}
        </div>

        <PrintBusModal printBusState={printBusState} setPrintBusState={setPrintBusState} priest={priest} todayISO={todayISO} />
        {renderGlobalModals()}
      </div>
    );
  }

  if (activeCard === 'cases') {
    const displayedFamilies = families.filter(f => {
      if (casesSubView === 'categories' && selectedCategoryName) return f.poverty_level === selectedCategoryName;
      if (casesSubView === 'search' && searchCatFilter !== 'all' && f.poverty_level !== searchCatFilter) return false;
      const numMatch = String(f.case_number || '') === caseSearch.trim();
      return numMatch || (f.head_name + ' ' + f.phone + ' ' + f.area + ' ' + f.job + ' ' + (f.spouse_full_name || '')).toLowerCase().includes(caseSearch.toLowerCase());
    });

    const currentFormAttachments = editingFamId ? familyAttachments.filter(a => a.family_id === editingFamId) : (famForm.pendingAttachments || []);

    const FamilyList = ({ list }) => (
      <div className="space-y-3">
        <div className="flex justify-end print:hidden">
          <button type="button" onClick={() => { logActivity({ user: priest, actionType: 'طباعة_شيت_حالات', targetTable: 'pastoral_families', description: `طبع شيت بحث الحالة (${list.length} أسرة)` }); window.print(); }} className="px-4 py-2.5 bg-[#7a1c24] text-white rounded-xl font-bold flex items-center gap-1.5 shadow text-sm cursor-pointer"><Printer size={16} /> طباعة / حفظ شيت PDF رسمي ({list.length})</button>
        </div>

        <div className="hidden print:block space-y-3">
          <div className="text-center border-b-2 border-[#7a1c24] pb-3">
            <h1 className="text-xl font-black text-[#7a1c24]">تقرير وشيت بحث الحالة الرعوي</h1>
            <p className="text-sm text-gray-700">الأب الكاهن: {priest.full_name} • التاريخ: {todayISO} • الإجمالي: {list.length} أسرة</p>
          </div>
          <table className="w-full border-collapse border border-gray-400 text-xs text-right">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 p-1.5">#</th><th className="border border-gray-400 p-1.5">رب الأسرة</th>
                <th className="border border-gray-400 p-1.5">التليفون والعمل</th><th className="border border-gray-400 p-1.5">الزوج/الزوجة</th>
                <th className="border border-gray-400 p-1.5">العنوان والتصنيف</th><th className="border border-gray-400 p-1.5">المصاريف/الدعم</th><th className="border border-gray-400 p-1.5">الأولاد</th>
              </tr>
            </thead>
            <tbody>
              {list.map(f => (
                <tr key={f.id}>
                  <td className="border border-gray-400 p-1.5 font-bold">{f.case_number}</td>
                  <td className="border border-gray-400 p-1.5 font-bold">{f.head_name}</td>
                  <td className="border border-gray-400 p-1.5">{f.phone} • {f.job}</td>
                  <td className="border border-gray-400 p-1.5">{f.spouse_full_name || '—'}</td>
                  <td className="border border-gray-400 p-1.5">{f.area} ({f.poverty_level})</td>
                  <td className="border border-gray-400 p-1.5">{f.monthly_expenses || 0} / {f.monthly_aid_amount || 0} ج.م</td>
                  <td className="border border-gray-400 p-1.5">{(f.children || []).map(c => `${c.child_name} (${c.stage})`).join('، ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 print:hidden">
          {list.map(f => {
            const famAtts = familyAttachments.filter(a => a.family_id === f.id);
            return (
              <div key={f.id} className="bg-white p-4 rounded-2xl border space-y-2.5">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div>
                    <span className="px-2.5 py-0.5 bg-gray-900 text-white rounded text-xs ml-2">#{f.case_number}</span>
                    <strong className="text-base">{f.head_name}</strong>
                    <span className="mr-2 px-2.5 py-0.5 bg-red-100 text-red-800 rounded text-xs">{f.poverty_level}</span>
                    <p className="text-sm text-gray-600 mt-1">📞 {f.phone} • 📍 {f.area} • 💼 {f.job}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setInspectFamilyAttachments(f)} className="px-3 py-2 bg-indigo-50 text-indigo-900 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"><Paperclip size={14} /> المرفقات ({famAtts.length})</button>
                    {f.phone && <button type="button" onClick={() => openWhatsAppComposer({ name: f.head_name, phone: f.phone, defaultCategory: 'افتقاد' })} className="p-2.5 bg-green-600 text-white rounded-xl cursor-pointer"><MessageCircle size={15} /></button>}
                    <button type="button" onClick={() => openEditFamily(f)} className="p-2.5 bg-gray-100 rounded-xl"><Edit3 size={15} /></button>
                    <button type="button" onClick={() => deleteFamily(f.id)} className="p-2.5 bg-red-50 text-red-700 rounded-xl"><Trash2 size={15} /></button>
                  </div>
                </div>
                {famAtts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {famAtts.map(att => (
                      <a key={att.id} href={att.file_url} target="_blank" rel="noreferrer" className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-xs font-bold flex items-center gap-1"><Eye size={12} /> {att.attachment_type}</a>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 bg-[#fbfaf7] p-3 rounded-xl border text-xs md:text-sm">
                  <div><span className="text-gray-500 block">مصاريف البيت الشهرية:</span><strong>{f.monthly_expenses || 0} ج.م</strong></div>
                  <div><span className="text-gray-500 block">الدعم الشهري المطلوب:</span><strong className="text-red-700">{f.monthly_aid_amount || 0} ج.م</strong></div>
                  <div><span className="text-gray-500 block">احتياجات البيت:</span><strong>{f.house_needs || f.case_notes || '—'}</strong></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="space-y-4 text-sm md:text-base">
        {renderTopBar('🔍 بحث الحالة والأسر والمرفقات (PDF منظم)')}
        {casesSubView === 'menu' && (
          <div className="grid sm:grid-cols-3 gap-4">
            <button type="button" onClick={() => setCasesSubView('search')} className="bg-white border-2 p-6 rounded-3xl text-right space-y-2 cursor-pointer"><span className="text-4xl block">🔍</span><h3 className="text-lg font-black">بحث في الأسر</h3></button>
            <button type="button" onClick={() => { setEditingFamId(null); setFamForm(emptyFam); setCasesSubView('add'); }} className="bg-white border-2 p-6 rounded-3xl text-right space-y-2 cursor-pointer"><span className="text-4xl block">➕</span><h3 className="text-lg font-black">إضافة أسرة جديدة</h3></button>
            <button type="button" onClick={() => { setSelectedCategoryName(null); setCasesSubView('categories'); }} className="bg-white border-2 p-6 rounded-3xl text-right space-y-2 cursor-pointer"><span className="text-4xl block">📂</span><h3 className="text-lg font-black">تصنيفات الأسر ({families.length})</h3></button>
          </div>
        )}
        {casesSubView === 'search' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 print:hidden">
              <button type="button" onClick={() => setCasesSubView('menu')} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm">← رجوع</button>
              <button type="button" onClick={() => setSearchCatFilter('all')} className={`px-3.5 py-2 rounded-xl font-bold border text-sm ${searchCatFilter === 'all' ? 'bg-[#7a1c24] text-white' : 'bg-white'}`}>الكل ({families.length})</button>
              {categoryNames.map(cat => <button key={cat.id} type="button" onClick={() => setSearchCatFilter(cat.name)} className={`px-3.5 py-2 rounded-xl font-bold border text-sm ${searchCatFilter === cat.name ? 'bg-[#7a1c24] text-white' : 'bg-white'}`}>{cat.icon} {cat.name} ({families.filter(f => f.poverty_level === cat.name).length})</button>)}
            </div>
            <input autoFocus placeholder="ابحث برقم الحالة أو الاسم أو المنطقة..." className="w-full p-3.5 bg-white border-2 rounded-2xl print:hidden" value={caseSearch} onChange={e => setCaseSearch(e.target.value)} />
            <FamilyList list={displayedFamilies} />
          </div>
        )}
        {casesSubView === 'add' && (
          <div className="space-y-3">
            <button type="button" onClick={() => setCasesSubView('menu')} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm">← رجوع</button>
            <form onSubmit={handleSaveFamily} className="bg-white p-5 rounded-3xl border space-y-3 font-bold">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input required placeholder="الاسم الأول *" className="p-2.5 border rounded-xl" value={famForm.head_first} onChange={e => setFamForm({ ...famForm, head_first: e.target.value })} />
                <input required placeholder="الثاني *" className="p-2.5 border rounded-xl" value={famForm.head_second} onChange={e => setFamForm({ ...famForm, head_second: e.target.value })} />
                <input placeholder="الثالث" className="p-2.5 border rounded-xl" value={famForm.head_third} onChange={e => setFamForm({ ...famForm, head_third: e.target.value })} />
                <input placeholder="الرابع" className="p-2.5 border rounded-xl" value={famForm.head_fourth} onChange={e => setFamForm({ ...famForm, head_fourth: e.target.value })} />
              </div>
              <div className="grid md:grid-cols-4 gap-2">
                <input required placeholder="تليفون الزوج *" className="p-2.5 border rounded-xl" value={famForm.phone} onChange={e => setFamForm({ ...famForm, phone: e.target.value })} />
                <input type="date" className="p-2.5 border rounded-xl" value={famForm.dob} onChange={e => setFamForm({ ...famForm, dob: e.target.value })} />
                <input placeholder="المؤهل" className="p-2.5 border rounded-xl" value={famForm.head_qualification} onChange={e => setFamForm({ ...famForm, head_qualification: e.target.value })} />
                <input placeholder="العمل" className="p-2.5 border rounded-xl" value={famForm.job} onChange={e => setFamForm({ ...famForm, job: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-pink-50/40 p-3 rounded-2xl border border-pink-100">
                <input placeholder="اسم الزوجة الأول" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_first} onChange={e => setFamForm({ ...famForm, spouse_first: e.target.value })} />
                <input placeholder="اسم الزوجة الثاني" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_second} onChange={e => setFamForm({ ...famForm, spouse_second: e.target.value })} />
                <input placeholder="تليفون الزوجة" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_phone} onChange={e => setFamForm({ ...famForm, spouse_phone: e.target.value })} />
                <input placeholder="عمل الزوجة" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_job} onChange={e => setFamForm({ ...famForm, spouse_job: e.target.value })} />
              </div>
              <div className="bg-amber-50 p-3 rounded-2xl border space-y-2">
                <div className="grid md:grid-cols-4 gap-2">
                  <input placeholder="اسم الابن" className="p-2 border rounded-xl bg-white" value={tempChild.child_name} onChange={e => setTempChild({ ...tempChild, child_name: e.target.value })} />
                  <input type="date" className="p-2 border rounded-xl bg-white" value={tempChild.dob} onChange={e => setTempChild({ ...tempChild, dob: e.target.value })} />
                  <input placeholder="المرحلة" className="p-2 border rounded-xl bg-white" value={tempChild.stage} onChange={e => setTempChild({ ...tempChild, stage: e.target.value })} />
                  <select className="p-2 border rounded-xl bg-white" value={tempChild.marital_status} onChange={e => setTempChild({ ...tempChild, marital_status: e.target.value })}><option value="أعزب">أعزب</option><option value="متزوج">متزوج</option></select>
                </div>
                <div className="flex gap-2 items-center">
                  <label className="flex items-center gap-1"><input type="checkbox" checked={tempChild.has_disability} onChange={e => setTempChild({ ...tempChild, has_disability: e.target.checked })} /> إعاقة/مرض؟</label>
                  {tempChild.has_disability && <input placeholder="التفاصيل" className="flex-1 p-2 border rounded-xl bg-white" value={tempChild.disability_details} onChange={e => setTempChild({ ...tempChild, disability_details: e.target.value })} />}
                  <button type="button" onClick={() => { if (tempChild.child_name) { setFamForm({ ...famForm, children: [...famForm.children, tempChild] }); setTempChild({ child_name: '', dob: '', stage: '', marital_status: 'أعزب', has_disability: false, disability_details: '' }); } }} className="px-3.5 py-1.5 bg-amber-600 text-white rounded-xl">+ ابن</button>
                </div>
                {famForm.children.map((c, idx) => <div key={idx} className="text-xs bg-white px-2.5 py-1.5 rounded">• {c.child_name} ({c.stage})</div>)}
              </div>
              <div className="grid md:grid-cols-4 gap-2.5 bg-emerald-50/40 p-3 rounded-2xl border border-emerald-200">
                <input required placeholder="المنطقة / الشارع *" className="p-2.5 border rounded-xl bg-white" value={famForm.area} onChange={e => setFamForm({ ...famForm, area: e.target.value })} />
                <select className="p-2.5 border rounded-xl bg-white" value={famForm.poverty_level} onChange={e => setFamForm({ ...famForm, poverty_level: e.target.value })}>{categoryNames.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}</select>
                <input type="number" min="0" placeholder="المصاريف الشهرية" className="p-2.5 border rounded-xl bg-white" value={famForm.monthly_expenses || ''} onChange={e => setFamForm({ ...famForm, monthly_expenses: e.target.value })} />
                <input type="number" min="0" placeholder="الدعم الشهري المطلوب" className="p-2.5 border rounded-xl bg-white" value={famForm.monthly_aid_amount || ''} onChange={e => setFamForm({ ...famForm, monthly_aid_amount: e.target.value, needs_monthly_aid: Number(e.target.value) > 0 })} />
              </div>

              <div className="bg-indigo-50/50 p-4 rounded-2xl border-2 border-indigo-200 space-y-3">
                <strong className="text-indigo-950 flex items-center gap-1.5 text-sm"><Paperclip size={16} /> مرفقات الأسرة (صورة بطاقة / عقد إيجار / تحاليل وأشعة / إيصال كهرباء ومرافق)</strong>
                <div className="flex flex-wrap gap-2 items-center">
                  <select className="p-2.5 border rounded-xl bg-white text-xs" value={selectedUploadType} onChange={e => setSelectedUploadType(e.target.value)}>
                    {ATTACHMENT_TYPES.map(at => <option key={at} value={at}>{at}</option>)}
                  </select>
                  <label className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${uploadingAttach ? 'bg-gray-300 text-gray-600' : 'bg-indigo-700 hover:bg-indigo-800 text-white'}`}>
                    <Upload size={15} /> {uploadingAttach ? 'جاري الرفع...' : `رفع (${selectedUploadType})`}
                    <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploadingAttach} onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFamilyAttachment(f, selectedUploadType, editingFamId || null); e.target.value = ''; }} />
                  </label>
                </div>
                {currentFormAttachments.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {currentFormAttachments.map((att, idx) => (
                      <div key={att.id || att.tempId || idx} className="bg-white p-2.5 rounded-xl border flex justify-between items-center gap-2 text-xs">
                        <div className="truncate"><span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded ml-1.5">{att.attachment_type}</span><span>{att.file_name || 'مرفق'}</span></div>
                        <div className="flex gap-1 shrink-0">
                          <a href={att.file_url} target="_blank" rel="noreferrer" className="p-1.5 bg-blue-50 text-blue-700 rounded-lg"><ExternalLink size={14} /></a>
                          <button type="button" onClick={() => handleDeleteAttachment(att)} className="p-1.5 bg-red-50 text-red-700 rounded-lg"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <input placeholder="احتياجات البيت / ملاحظات الحالة..." className="w-full p-2.5 border rounded-xl" value={famForm.house_needs} onChange={e => setFamForm({ ...famForm, house_needs: e.target.value })} />
              <button type="submit" className="px-6 py-3 bg-[#7a1c24] text-white rounded-xl cursor-pointer">حفظ بيانات الأسرة والمرفقات</button>
            </form>
          </div>
        )}
        {casesSubView === 'categories' && (
          <div className="space-y-4">
            <button type="button" onClick={() => { setSelectedCategoryName(null); setCasesSubView('menu'); }} className="px-4 py-2 bg-white border rounded-xl font-bold print:hidden text-sm">← رجوع</button>
            {!selectedCategoryName ? (
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                {categoryNames.map(cat => (
                  <button type="button" key={cat.id} onClick={() => setSelectedCategoryName(cat.name)} className="bg-white border-2 p-5 rounded-3xl text-right space-y-2 hover:border-[#7a1c24] cursor-pointer">
                    <span className="text-4xl block">{cat.icon || '📂'}</span><strong className="text-base block">{cat.name}</strong>
                    <span className="px-3 py-1 bg-[#f9ecee] text-[#7a1c24] rounded-full font-black text-xs">{families.filter(f => f.poverty_level === cat.name).length} أسرة</span>
                  </button>
                ))}
              </div>
            ) : <FamilyList list={displayedFamilies} />}
          </div>
        )}

        {inspectFamilyAttachments && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-70">
            <div className="bg-white rounded-3xl w-full max-w-xl p-6 space-y-4 font-bold max-h-[90vh] overflow-y-auto text-sm">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="text-base font-black text-[#7a1c24]">📎 مرفقات أسرة: {inspectFamilyAttachments.head_name}</h3>
                <button type="button" onClick={() => setInspectFamilyAttachments(null)} className="p-1.5 bg-gray-100 rounded-xl"><X size={18} /></button>
              </div>
              <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-200 flex flex-wrap gap-2 items-center">
                <select className="p-2 border rounded-xl bg-white text-xs" value={selectedUploadType} onChange={e => setSelectedUploadType(e.target.value)}>{ATTACHMENT_TYPES.map(at => <option key={at} value={at}>{at}</option>)}</select>
                <label className="px-4 py-2 bg-indigo-700 text-white rounded-xl text-xs cursor-pointer flex items-center gap-1">
                  <Upload size={14} /> {uploadingAttach ? 'جاري الرفع...' : 'إضافة مرفق جديد'}
                  <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploadingAttach} onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFamilyAttachment(f, selectedUploadType, inspectFamilyAttachments.id); e.target.value = ''; }} />
                </label>
              </div>
              <div className="space-y-2">
                {familyAttachments.filter(a => a.family_id === inspectFamilyAttachments.id).length === 0 ? (
                  <p className="text-center text-gray-500 py-4 text-xs">لا توجد مرفقات مرفوعة لهذه الأسرة حتى الآن.</p>
                ) : familyAttachments.filter(a => a.family_id === inspectFamilyAttachments.id).map(att => (
                  <div key={att.id} className="p-3 bg-gray-50 border rounded-2xl flex justify-between items-center gap-2">
                    <div><span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded text-xs ml-2">{att.attachment_type}</span><span className="text-xs text-gray-700">{att.file_name}</span></div>
                    <div className="flex gap-1.5">
                      <a href={att.file_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs flex items-center gap-1"><Eye size={13} /> معاينة</a>
                      <button type="button" onClick={() => handleDeleteAttachment(att)} className="p-1.5 bg-red-50 text-red-700 rounded-xl"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {renderGlobalModals()}
      </div>
    );
  }

  if (activeCard === 'edu_center') {
    return (
      <div className="space-y-4 text-sm md:text-base">
        {renderTopBar('🎓 المركز التعليمي الكنسي')}
        <EducationalCenterManager currentUser={priest} todayISO={todayISO} />
        {renderGlobalModals()}
      </div>
    );
  }

  if (activeCard === 'joseph_arimathea') {
    return (
      <div className="space-y-4 text-sm md:text-base">
        {renderTopBar('🕊️ خدمة يوسف الرامي')}
        <JosephArimatheaManager currentUser={priest} todayISO={todayISO} onOpenWhatsApp={openWhatsAppComposer} />
        {renderGlobalModals()}
      </div>
    );
  }

  if (activeCard.startsWith('custom:')) {
    const cardId = activeCard.split(':')[1], cardObj = customCards.find(c => c.id === cardId), entries = customEntries.filter(e => e.card_id === cardId);
    return (
      <div className="space-y-4 text-sm md:text-base">
        {renderTopBar(`${cardObj?.card_icon || '📌'} ${cardObj?.card_title || 'كارت مخصص'}`)}
        <form onSubmit={async e => { e.preventDefault(); const { data } = await supabase.from('priest_custom_entries').insert([{ ...customEntryForm, card_id: cardId, priest_id: priest.id, entry_date: customEntryForm.entry_date || null }]).select().single(); if (data) { setCustomEntries([data, ...customEntries]); logActivity({ user: priest, actionType: 'إضافة_كارت_مخصص', targetTable: 'priest_custom_entries', targetId: data.id, description: `أضاف في كارت (${cardObj?.card_title}): ${data.title}` }); setCustomEntryForm({ title: '', entry_date: '', details: '' }); } }} className="bg-white p-4 rounded-3xl border space-y-2 font-bold">
          <div className="grid md:grid-cols-2 gap-2"><input required placeholder="العنوان *" className="p-2.5 border rounded-xl" value={customEntryForm.title} onChange={e => setCustomEntryForm({ ...customEntryForm, title: e.target.value })} /><input type="date" className="p-2.5 border rounded-xl" value={customEntryForm.entry_date} onChange={e => setCustomEntryForm({ ...customEntryForm, entry_date: e.target.value })} /></div>
          <textarea placeholder="التفاصيل..." className="w-full p-2.5 border rounded-xl" rows="2" value={customEntryForm.details} onChange={e => setCustomEntryForm({ ...customEntryForm, details: e.target.value })} />
          <button type="submit" className="px-5 py-2.5 bg-[#7a1c24] text-white rounded-xl">+ إضافة</button>
        </form>
        {entries.map(en => (
          <div key={en.id} className="bg-white p-4 rounded-2xl border flex justify-between items-start">
            <div><strong className="text-base">{en.title}</strong> {en.entry_date && <span className="text-gray-500">({en.entry_date})</span>}{en.details && <p className="text-gray-700 mt-1">{en.details}</p>}</div>
            <button type="button" onClick={async () => { await supabase.from('priest_custom_entries').delete().eq('id', en.id); setCustomEntries(customEntries.filter(x => x.id !== en.id)); }} className="p-2 bg-red-50 text-red-700 rounded-lg"><Trash2 size={15} /></button>
          </div>
        ))}
        {renderGlobalModals()}
      </div>
    );
  }

  return null;
}
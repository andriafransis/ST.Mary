import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { startUserSession, logActivity } from '../lib/activityLogger';
import {
  loadAdminCardsConfig,
  isCardAllowedForRole,
  CARDS_UPDATED_EVENT
} from '../components/NestedCardsBuilder';
import WhatsAppComposerModal, { FALLBACK_WA_TEMPLATES, formatWaMessage } from '../components/priest/WhatsAppComposerModal';
import PriestTodayPanel from '../components/priest/PriestTodayPanel';
import PriestQuickSearch from '../components/priest/PriestQuickSearch';
import BellNotificationsPanel from '../components/priest/BellNotificationsPanel';
import ConfessorProfileModal from '../components/priest/ConfessorProfileModal';
import PriestFamilyVisitation from '../components/priest/PriestFamilyVisitation';
import PriestInvitationsTab from '../components/priest/PriestInvitationsTab';
import CertificatesRegistry from '../components/CertificatesRegistry';
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
  Upload, Paperclip, Eye, ExternalLink, Cake, BellRing, AlertTriangle,
  Award, ClipboardCheck, Gift, ClipboardList, School, CheckCircle2, Plus
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

const formatEventTypeDisplay = (val = '') =>
  String(val || '').replace(/\s*\(قبل المعمودية\)/g, '');

const parseDynamicEntry = (row) => {
  try {
    const parsed = JSON.parse(row.details || '{}');
    if (parsed && typeof parsed === 'object' && ('text' in parsed || 'field_label' in parsed)) {
      return {
        text: parsed.text || '',
        field_label: parsed.field_label || '',
        field_value: parsed.field_value || ''
      };
    }
  } catch {
    // نص عادي
  }
  return { text: row.details || '', field_label: '', field_value: '' };
};

export default function PriestDashboard({ priest, users = [], onRefresh }) {
  const scrollBoxRef = useRef(null);
  const [activeCard, setActiveCard] = useState('hub');
  const [activeServiceCard, setActiveServiceCard] = useState(null);
  const [localUsers, setLocalUsers] = useState(users);

  const [cardsConfig, setCardsConfig] = useState({
    rowId: null,
    overrides: {},
    customScreenCards: [],
    cardMeta: {}
  });
  const [nestedCardsRows, setNestedCardsRows] = useState([]);
  const [selectedNestedParentKey, setSelectedNestedParentKey] = useState(null);
  const [activeDynamicCard, setActiveDynamicCard] = useState(null);
  const [dynamicEntryForm, setDynamicEntryForm] = useState({
    id: null,
    title: '',
    entry_date: '',
    details: '',
    field_label: '',
    field_value: ''
  });

  useEffect(() => {
    setLocalUsers(users);
  }, [users]);

  useEffect(() => {
    if (!priest?.id) return;
    const stopSession = startUserSession(priest);
    return () => stopSession();
  }, [priest?.id]);

  const scrollPanelTop = () => {
    if (scrollBoxRef.current) {
      scrollBoxRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const todayISO = new Date().toISOString().split('T')[0];

  const [confessionSlots, setConfessionSlots] = useState([]);
  const [confessionBookings, setConfessionBookings] = useState([]);
  const [sessionsHistory, setSessionsHistory] = useState([]);
  const [spiritualNotes, setSpiritualNotes] = useState([]);
  const [visitations, setVisitations] = useState([]);
  const [services, setServices] = useState([]);
  const [serviceGroups, setServiceGroups] = useState([]);
  const [masses, setMasses] = useState([]);
  const [personalItems, setPersonalItems] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [eventInvitationsCount, setEventInvitationsCount] = useState(0);
  const [confessionIntervalDays, setConfessionIntervalDays] = useState(45);
  const [savingInterval, setSavingInterval] = useState(false);

  const [families, setFamilies] = useState([]);
  const [familyAttachments, setFamilyAttachments] = useState([]);
  const [caseCategories, setCaseCategories] = useState([]);
  const [siblings, setSiblings] = useState([]);
  const [userChildren, setUserChildren] = useState([]);
  const [customCards, setCustomCards] = useState([]);
  const [customEntries, setCustomEntries] = useState([]);
  const [hiddenEditRequests, setHiddenEditRequests] = useState([]);

  const [commitmentStats, setCommitmentStats] = useState([]);
  const [rewardCampaigns, setRewardCampaigns] = useState([]);
  const [memberRewards, setMemberRewards] = useState([]);
  const [memberNotes, setMemberNotes] = useState([]);
  const [commitmentSearch, setCommitmentSearch] = useState('');
  const [commitmentFilter, setCommitmentFilter] = useState('all');
  const [rewardForm, setRewardForm] = useState({
    member_id: '',
    campaign_id: '',
    reward_type: 'خصم رحلة',
    reward_title: '',
    discount_percent: 25,
    notes: ''
  });
  const [noteForm, setNoteForm] = useState({
    member_id: '',
    behavior_tag: 'متابعة روحية',
    note_text: '',
    visible_to_parent: false
  });

  const [josephCases, setJosephCases] = useState([]);
  const [josephMemorials, setJosephMemorials] = useState([]);
  const [liveJosephAlert, setLiveJosephAlert] = useState(null);

  const [waTemplates, setWaTemplates] = useState([]);
  const [waModal, setWaModal] = useState(null);
  const canManageTemplates = priest?.can_manage_wa_templates !== false;

  const [bdayScope, setBdayScope] = useState('confessors');
  const [bdayTab, setBdayTab] = useState('week');
  const [bdayOpen, setBdayOpen] = useState(false);

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
    const [
      us, sl, cb, sh, sn, vs, sr, ms, ps, fm, fa, cats, sb, uc, cc, ce, wt, jc, jm,
      sg, commView, campRes, rewRes, notesRes, hidReqsRes, nCardsRes, cfgData, invRes, intvRes, evInvRes
    ] = await Promise.all([
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
      supabase.from('priest_custom_entries').select('*').order('created_at', { ascending: false }),
      supabase.from('whatsapp_templates').select('*').or(`priest_id.is.null,priest_id.eq.${priest.id}`).order('created_at', { ascending: true }),
      supabase.from('joseph_arimathea_cases').select('*').order('created_at', { ascending: false }),
      supabase.from('joseph_memorial_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('service_groups').select('*'),
      supabase.from('v_parent_member_commitment').select('*'),
      supabase.from('reward_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('member_rewards').select('*').order('created_at', { ascending: false }),
      supabase.from('member_notes').select('*'),
      supabase.from('church_notifications').select('*').eq('type', 'hidden_family_edit_request').order('created_at', { ascending: false }),
      supabase.from('nested_cards').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      loadAdminCardsConfig(),
      supabase.from('priest_invitations').select('*').or(`priest_id.is.null,priest_id.eq.${priest.id}`).order('created_at', { ascending: false }),
      supabase.from('service_settings').select('value').eq('key', 'confession_interval_days').maybeSingle(),
      supabase.from('church_invitations').select('id', { count: 'exact', head: true })
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
    if (sg?.data) setServiceGroups(sg.data);
    if (commView?.data) setCommitmentStats(commView.data);
    if (campRes?.data) setRewardCampaigns(campRes.data);
    if (rewRes?.data) setMemberRewards(rewRes.data);
    if (notesRes?.data) setMemberNotes(notesRes.data);
    if (hidReqsRes?.data) {
      setHiddenEditRequests(
        hidReqsRes.data.map(r => {
          let meta = {};
          try { meta = r.message ? JSON.parse(r.message) : {}; } catch { meta = {}; }
          return { id: r.id, is_read: r.is_read, created_at: r.created_at, ...meta };
        })
      );
    }
    if (!nCardsRes.error && nCardsRes.data) setNestedCardsRows(nCardsRes.data);
    if (cfgData) setCardsConfig(cfgData);
    if (!invRes.error && invRes.data) setInvitations(invRes.data);
    if (!intvRes.error && intvRes.data?.value?.days) {
      setConfessionIntervalDays(Number(intvRes.data.value.days) || 45);
    }
    if (!evInvRes?.error && typeof evInvRes?.count === 'number') {
      setEventInvitationsCount(evInvRes.count);
    }
  };

  useEffect(() => {
    loadPriestData();
  }, [priest?.id]);

  useEffect(() => {
    if (!priest?.id) return;
    const syncCardsNow = () => {
      loadPriestData();
    };
    window.addEventListener(CARDS_UPDATED_EVENT, syncCardsNow);
    window.addEventListener('storage', syncCardsNow);
    return () => {
      window.removeEventListener(CARDS_UPDATED_EVENT, syncCardsNow);
      window.removeEventListener('storage', syncCardsNow);
    };
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
    setSelectedNestedParentKey(null);
    setActiveServiceCard(null);
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
  const pendingHiddenReqsCount = hiddenEditRequests.filter(r => r.status !== 'done').length;
  const pendingInvitesCount = invitations.filter(i => i.status === 'قيد الانتظار').length;

  const handleSaveConfessionInterval = async (daysVal) => {
    const days = Math.max(7, Number(daysVal) || 45);
    setConfessionIntervalDays(days);
    setSavingInterval(true);
    try {
      await supabase
        .from('service_settings')
        .upsert(
          { key: 'confession_interval_days', value: { days }, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
      logActivity({
        user: priest,
        actionType: 'تحديد_مدة_الاعتراف_للشعب',
        targetTable: 'service_settings',
        description: `حدد مدة الاعتراف الدورية للشعب: كل ${days} يوم`
      });
    } finally {
      setSavingInterval(false);
    }
  };

  const handleRespondInvitation = async (inv, nextStatus) => {
    const replyText = prompt(
      nextStatus === 'مقبولة'
        ? `رسالة تأكيد لـ (${inv.sender_name}) اختياري:`
        : `سبب الاعتذار لـ (${inv.sender_name}):`,
      nextStatus === 'مقبولة' ? 'تم القبول وإدراج الموعد بالجدول، الرب يبارككم ✝' : 'نعتذر لارتباط أبونا بموعد آخر'
    );
    if (replyText === null) return;

    const { data, error } = await supabase
      .from('priest_invitations')
      .update({
        status: nextStatus,
        priest_reply: replyText,
        priest_id: inv.priest_id || priest.id
      })
      .eq('id', inv.id)
      .select()
      .single();

    if (error) return alert('تعذر تحديث الدعوة: ' + error.message);
    if (data) {
      setInvitations(prev => prev.map(x => (x.id === inv.id ? data : x)));
      if (nextStatus === 'مقبولة') {
        const { data: schedRow } = await supabase
          .from('priest_personal_schedule')
          .insert([{
            priest_id: priest.id,
            event_type: inv.event_type,
            title: `${inv.title} (دعوة من: ${inv.sender_name})`,
            event_date: inv.event_date,
            event_time: inv.event_time || '',
            location: inv.location || '',
            is_public: false,
            notes: `هاتف: ${inv.sender_phone || '—'} ${inv.notes ? '• ' + inv.notes : ''}`
          }])
          .select()
          .single();
        if (schedRow) {
          setPersonalItems(prev => [...prev, schedRow]);
        }
      }
      logActivity({
        user: priest,
        actionType: nextStatus === 'مقبولة' ? 'قبول_دعوة_مناسبة' : 'اعتذار_دعوة_مناسبة',
        targetTable: 'priest_invitations',
        targetId: inv.id,
        description: `${nextStatus} لدعوة (${inv.title}) من ${inv.sender_name}`
      });
    }
  };

  const applyCardOverride = (baseCard, defaultScreen = 'priest_hub') => {
    const ov = (cardsConfig.overrides || {})[baseCard.id] || {};
    return {
      ...baseCard,
      title: ov.title || baseCard.title,
      desc: ov.desc !== undefined ? ov.desc : baseCard.desc,
      icon: ov.icon || baseCard.icon,
      isActive: ov.is_active !== undefined ? ov.is_active : true,
      placementScreen: ov.placement_screen || defaultScreen,
      parentKey: ov.parent_key || null,
      allowedRoles: Array.isArray(ov.allowed_roles) && ov.allowed_roles.length > 0 ? ov.allowed_roles : ['all']
    };
  };

  const allowedNestedCards = useMemo(() => {
    const metaMap = cardsConfig.cardMeta || {};
    return (nestedCardsRows || [])
      .filter(row => row.is_active !== false)
      .map(row => {
        const meta = metaMap[row.id] || {};
        const parentKey = row.parent_id ? `nested:${row.parent_id}` : (meta.parent_key || null);
        const placementScreen = meta.placement_screen || 'admin_hub';
        const allowedRoles = Array.isArray(meta.allowed_roles) && meta.allowed_roles.length > 0 ? meta.allowed_roles : ['all'];
        const targetAction = meta.target_screen && row.target_action === 'info' && !row.description
          ? 'screen'
          : (meta.target_action || row.target_action || 'children');

        return {
          ...row,
          key: `nested:${row.id}`,
          parent_key: parentKey,
          placement_screen: placementScreen,
          allowed_roles: allowedRoles,
          target_action: targetAction,
          target_screen: meta.target_screen || 'users'
        };
      })
      .filter(nc => isCardAllowedForRole(nc.allowed_roles, priest?.role || 'priest', priest?.role === 'admin'));
  }, [nestedCardsRows, cardsConfig, priest?.role]);

  const navigateByTargetScreen = (targetScreen) => {
    if (!targetScreen) return;
    if (['service_hub', 'confessions', 'family_visitation', 'event_invitations', 'masses', 'personal', 'cases', 'certificates', 'edu_center', 'joseph_arimathea', 'hub'].includes(targetScreen)) {
      setSelectedNestedParentKey(null);
      setActiveCard(targetScreen);
      if (targetScreen === 'service_hub') setActiveServiceCard(null);
      return;
    }
    if (targetScreen === 'categories') {
      setSelectedNestedParentKey(null);
      setActiveCard('cases');
      setCasesSubView('categories');
      return;
    }
    if (targetScreen === 'custom_cards') {
      setSelectedNestedParentKey(null);
      setActiveCard('hub');
    }
  };

  const handleOpenNestedCard = (nc) => {
    if (nc.target_action === 'link' && nc.target_url) {
      window.open(nc.target_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (nc.target_action === 'screen' && nc.target_screen) {
      navigateByTargetScreen(nc.target_screen);
      return;
    }
    if (nc.target_action === 'info') {
      setDynamicEntryForm({ id: null, title: '', entry_date: '', details: '', field_label: '', field_value: '' });
      setActiveDynamicCard(nc);
      return;
    }
    setSelectedNestedParentKey(nc.key);
  };

  const handleSaveDynamicCardEntry = async (e) => {
    e.preventDefault();
    if (!activeDynamicCard || !dynamicEntryForm.title.trim()) return;
    const encodedDetails = JSON.stringify({
      text: (dynamicEntryForm.details || '').trim(),
      field_label: (dynamicEntryForm.field_label || '').trim(),
      field_value: (dynamicEntryForm.field_value || '').trim()
    });

    if (dynamicEntryForm.id) {
      const { data, error } = await supabase
        .from('priest_custom_entries')
        .update({
          title: dynamicEntryForm.title.trim(),
          entry_date: dynamicEntryForm.entry_date || null,
          details: encodedDetails
        })
        .eq('id', dynamicEntryForm.id)
        .select()
        .single();
      if (!error && data) {
        setCustomEntries(prev => prev.map(x => (x.id === data.id ? data : x)));
      }
    } else {
      const { data, error } = await supabase
        .from('priest_custom_entries')
        .insert([{
          card_id: activeDynamicCard.id,
          priest_id: priest.id,
          title: dynamicEntryForm.title.trim(),
          entry_date: dynamicEntryForm.entry_date || null,
          details: encodedDetails
        }])
        .select()
        .single();
      if (!error && data) {
        setCustomEntries(prev => [data, ...prev]);
      }
    }
    setDynamicEntryForm({ id: null, title: '', entry_date: '', details: '', field_label: '', field_value: '' });
  };

  const handleDeleteDynamicCardEntry = async (entryId) => {
    if (!confirm('حذف هذا العنصر؟')) return;
    const { error } = await supabase.from('priest_custom_entries').delete().eq('id', entryId);
    if (!error) {
      setCustomEntries(prev => prev.filter(x => x.id !== entryId));
    }
  };

  const renderNestedCardsSection = (screenKey, parentKey = null) => {
    const matching = allowedNestedCards.filter(nc => {
      if (parentKey) return nc.parent_key === parentKey;
      return !nc.parent_key && nc.placement_screen === screenKey;
    });

    if (matching.length === 0) return null;

    return (
      <div className="bg-white/80 p-4 rounded-3xl border border-amber-200 space-y-2.5">
        <div className="flex items-center justify-between">
          <strong className="text-xs md:text-sm font-black text-[#7a1c24]">
            {parentKey ? '🗂️ كروت فرعية متداخلة داخل هذا الكارت' : '✨ كروت إضافية / متداخلة مخصصة لهذه الشاشة'}
          </strong>
          {parentKey && (
            <button
              type="button"
              onClick={() => setSelectedNestedParentKey(null)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold cursor-pointer"
            >
              ← رجوع
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
          {matching.map(nc => {
            const subCount = allowedNestedCards.filter(x => x.parent_key === nc.key).length;
            const entriesCount = customEntries.filter(en => String(en.card_id) === String(nc.id)).length;
            return (
              <button
                key={nc.key}
                type="button"
                onClick={() => handleOpenNestedCard(nc)}
                className="bg-white border-2 border-amber-200 hover:border-[#7a1c24] p-3 md:p-4 rounded-2xl text-right shadow-2xs hover:shadow-md transition flex flex-col justify-between gap-2 cursor-pointer"
              >
                <div className="flex justify-between items-start w-full">
                  <span className="text-2xl">{nc.icon || '🗂️'}</span>
                  <div className="flex gap-1">
                    {nc.badge_text && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-950 rounded-full text-[10px] font-black">{nc.badge_text}</span>
                    )}
                    {subCount > 0 && (
                      <span className="px-2 py-0.5 bg-[#f9ecee] text-[#7a1c24] rounded-full text-[10px] font-black">{subCount} فرعي</span>
                    )}
                    {nc.target_action === 'info' && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded-full text-[10px] font-black">{entriesCount} عنصر</span>
                    )}
                  </div>
                </div>
                <div>
                  <strong className="text-sm font-black text-gray-900 block">{nc.title}</strong>
                  {nc.subtitle && <span className="text-[11px] font-bold text-[#7a1c24] block mt-0.5">{nc.subtitle}</span>}
                  {nc.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{nc.description}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

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
    if (cardId === 'master_sheet') {
      setActiveCard('service_hub');
      setActiveServiceCard('sequence');
      return;
    }
    if (cardId === 'commitment_rewards') {
      setActiveCard('service_hub');
      setActiveServiceCard('commitment');
      return;
    }
    if (cardId === 'services') {
      setActiveCard('service_hub');
      setActiveServiceCard('schedule');
      return;
    }
    setActiveCard(cardId);
    if (cardId === 'confessions') setConfSubView('confessors');
  };

  const handleUpdateUserFromSheet = async (updatedRow) => {
    const { id, serialNo, statusKey, detectedService, created_at, ...clean } = updatedRow;
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

  const handleGrantReward = async (e) => {
    e.preventDefault();
    if (!rewardForm.member_id || !rewardForm.reward_title.trim()) {
      return alert('اختر المخدوم واكتب اسم المكافأة أو العرض أو الرحلة');
    }
    const targetStat = commitmentStats.find(c => String(c.member_id) === String(rewardForm.member_id));
    const payload = {
      member_id: String(rewardForm.member_id),
      campaign_id: rewardForm.campaign_id || null,
      reward_type: rewardForm.reward_type,
      reward_title: rewardForm.reward_title.trim(),
      attendance_streak: Number(targetStat?.present_count || 0),
      attendance_percentage: Number(targetStat?.attendance_percentage || 0),
      discount_percent: Number(rewardForm.discount_percent || 0),
      target_month: todayISO.slice(0, 7),
      granted_by: priest?.full_name || 'أبونا الكاهن',
      granted_date: todayISO,
      notes: rewardForm.notes.trim()
    };
    const { data, error } = await supabase.from('member_rewards').insert([payload]).select().single();
    if (error) return alert('تعذر حفظ المكافأة: ' + error.message);
    if (data) {
      setMemberRewards([data, ...memberRewards]);
      setRewardForm({ member_id: '', campaign_id: '', reward_type: 'خصم رحلة', reward_title: '', discount_percent: 25, notes: '' });
      alert('تم تسجيل المكافأة / العرض بنجاح!');
    }
  };

  useEffect(() => {
    if (!supabase || typeof supabase.channel !== 'function') return;
    const noteChannel = supabase
      .channel('priest-member-notes-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'member_notes' }, (payload) => {
        const row = payload.new;
        if (!row?.id) return;
        setMemberNotes(prev => prev.map(n => (n.id === row.id ? { ...n, ...row } : n)));
      })
      .subscribe();
    return () => {
      if (typeof supabase.removeChannel === 'function') supabase.removeChannel(noteChannel);
    };
  }, []);

  const handleAddMemberNote = async (e) => {
    e.preventDefault();
    if (!noteForm.member_id || !noteForm.note_text.trim()) {
      return alert('اختر المخدوم واكتب الملاحظة');
    }
    const payload = {
      member_id: noteForm.member_id,
      servant_id: priest.id,
      behavior_tag: noteForm.behavior_tag,
      note_text: noteForm.note_text.trim(),
      visible_to_parent: Boolean(noteForm.visible_to_parent),
      is_read: false,
      acknowledged: false
    };
    const { data, error } = await supabase.from('member_notes').insert([payload]).select().single();
    if (error) return alert('تعذر حفظ الملاحظة: ' + error.message);
    if (data) {
      setMemberNotes([data, ...memberNotes]);
      setNoteForm({ member_id: '', behavior_tag: 'متابعة روحية', note_text: '', visible_to_parent: false });
      alert('تم حفظ الملاحظة بنجاح!');
    }
  };

  const handleMarkHiddenRequestDone = async (req) => {
    const { id, is_read, created_at, ...meta } = req;
    const nextMeta = { ...meta, status: 'done' };
    const { error } = await supabase
      .from('church_notifications')
      .update({ is_read: true, message: JSON.stringify(nextMeta) })
      .eq('id', req.id);
    if (!error) {
      setHiddenEditRequests(prev => prev.map(r => (r.id === req.id ? { ...r, is_read: true, status: 'done' } : r)));
    }
  };

  const renderQuickNavBar = () => {
    const tabs = [
      { id: 'hub', label: '🏠 الرئيسية' },
      { id: 'service_hub', label: '🏫 الخدمة' },
      { id: 'confessions', label: '🙏 الاعترافات' },
      { id: 'family_visitation', label: '👨‍👩‍👧‍👦 افتقاد الأسر' },
      { id: 'event_invitations', label: '💌 دعوات المناسبات' },
      { id: 'certificates', label: '📜 التوثيق وخلو الموانع' },
      { id: 'masses', label: '⛪ القداسات' },
      { id: 'personal', label: '📅 الجدول الخاص', badge: pendingInvitesCount },
      { id: 'cases', label: '🔍 بحث الحالة', badge: pendingHiddenReqsCount },
      { id: 'edu_center', label: '🎓 المركز التعليمي' },
      { id: 'joseph_arimathea', label: '🕊️ يوسف الرامي', badge: totalJosephAlerts }
    ];

    return (
      <div className="app-tabs bg-white px-3 py-2 rounded-2xl border shadow-2xs flex items-center gap-1.5 overflow-x-auto print:hidden mb-3">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setSelectedNestedParentKey(null);
              setActiveCard(t.id);
              if (t.id === 'service_hub') setActiveServiceCard(null);
            }}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black shrink-0 flex items-center gap-1 cursor-pointer transition ${
              activeCard === t.id
                ? 'bg-[#7a1c24] text-white shadow-2xs'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
            }`}
          >
            <span>{t.label}</span>
            {t.badge > 0 && (
              <span className="px-1.5 py-0.5 bg-red-600 text-white rounded-full text-[9px]">{t.badge}</span>
            )}
          </button>
        ))}
      </div>
    );
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
        readerId={priest?.id}
        senderName={priest?.full_name}
        canSend
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

      {activeDynamicCard && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl p-4 md:p-6 space-y-4 text-xs font-bold max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm md:text-base font-black text-[#7a1c24]">
                  {activeDynamicCard.icon || '📄'} {activeDynamicCard.title}
                </h3>
                {activeDynamicCard.subtitle && (
                  <p className="text-[11px] text-gray-500 mt-0.5">{activeDynamicCard.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveDynamicCard(null)}
                className="p-1.5 bg-gray-100 rounded-xl text-gray-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {activeDynamicCard.description && (
              <div className="p-3 bg-[#fbfaf7] border rounded-2xl text-gray-700 whitespace-pre-line">
                {activeDynamicCard.description}
              </div>
            )}

            <form onSubmit={handleSaveDynamicCardEntry} className="bg-amber-50/50 border border-amber-200 p-4 rounded-2xl space-y-2.5">
              <div className="font-black text-[#7a1c24] flex items-center gap-1">
                <Plus size={14} /> {dynamicEntryForm.id ? 'تعديل سجل داخل الشاشة' : 'إضافة سجل / متابعة داخل الشاشة'}
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  required
                  placeholder="العنوان *"
                  className="p-2.5 border rounded-xl bg-white"
                  value={dynamicEntryForm.title}
                  onChange={e => setDynamicEntryForm({ ...dynamicEntryForm, title: e.target.value })}
                />
                <input
                  type="date"
                  className="p-2.5 border rounded-xl bg-white"
                  value={dynamicEntryForm.entry_date}
                  onChange={e => setDynamicEntryForm({ ...dynamicEntryForm, entry_date: e.target.value })}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  placeholder="اسم حقل إضافي"
                  className="p-2.5 border rounded-xl bg-white"
                  value={dynamicEntryForm.field_label}
                  onChange={e => setDynamicEntryForm({ ...dynamicEntryForm, field_label: e.target.value })}
                />
                <input
                  placeholder="القيمة"
                  className="p-2.5 border rounded-xl bg-white"
                  value={dynamicEntryForm.field_value}
                  onChange={e => setDynamicEntryForm({ ...dynamicEntryForm, field_value: e.target.value })}
                />
              </div>
              <textarea
                rows={2}
                placeholder="التفاصيل..."
                className="w-full p-2.5 border rounded-xl bg-white"
                value={dynamicEntryForm.details}
                onChange={e => setDynamicEntryForm({ ...dynamicEntryForm, details: e.target.value })}
              />
              <div className="flex justify-end gap-2">
                {dynamicEntryForm.id && (
                  <button
                    type="button"
                    onClick={() => setDynamicEntryForm({ id: null, title: '', entry_date: '', details: '', field_label: '', field_value: '' })}
                    className="px-3 py-1.5 border rounded-xl bg-white cursor-pointer"
                  >
                    إلغاء
                  </button>
                )}
                <button type="submit" className="px-4 py-1.5 bg-[#7a1c24] text-white rounded-xl cursor-pointer">
                  {dynamicEntryForm.id ? 'حفظ التعديل' : '+ إضافة'}
                </button>
              </div>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {customEntries.filter(en => String(en.card_id) === String(activeDynamicCard.id)).map(en => {
                const parsed = parseDynamicEntry(en);
                return (
                  <div key={en.id} className="p-3 bg-[#fbfaf7] border rounded-2xl flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-gray-900">{en.title}</strong>
                        {en.entry_date && <span className="text-[11px] text-gray-500">({en.entry_date})</span>}
                        {parsed.field_label && parsed.field_value && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded-lg text-[10px]">
                            {parsed.field_label}: {parsed.field_value}
                          </span>
                        )}
                      </div>
                      {parsed.text && <p className="text-gray-700 whitespace-pre-line font-normal">{parsed.text}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDynamicEntryForm({
                          id: en.id,
                          title: en.title || '',
                          entry_date: en.entry_date || '',
                          details: parsed.text || '',
                          field_label: parsed.field_label || '',
                          field_value: parsed.field_value || ''
                        })}
                        className="p-1.5 bg-gray-100 rounded-lg text-gray-800 cursor-pointer"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDynamicCardEntry(en.id)}
                        className="p-1.5 bg-red-50 rounded-lg text-red-700 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderServiceScheduleContent = () => {
    const stageClasses = selectedStage ? myServices.filter(s => s.stage_name === selectedStage) : [];
    const stageServants = selectedStage
      ? allServants.filter(
          u =>
            (u.detailed_stage || u.service_stage || '').includes(selectedStage) ||
            (u.sector || '').includes(selectedStage) ||
            stageClasses.some(c => c.class_name === u.assigned_class)
        )
      : [];
    const stageMembers = selectedStage ? getMembersForStage(selectedStage) : [];
    const stageVisitations = visitations.filter(v => v.category === 'افتقاد خدمة' && v.service_stage === selectedStage);

    return (
      <div className="space-y-4 text-sm md:text-base">
        {!selectedStage ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {stagesMap.map(st => (
              <button
                type="button"
                key={st}
                onClick={() => { setSelectedStage(st); setServiceSubCard('menu'); }}
                className="bg-white p-3.5 md:p-5 rounded-3xl border-2 hover:border-[#7a1c24] text-right shadow-sm space-y-2 cursor-pointer"
              >
                <span className="text-3xl">📖</span>
                <h3 className="text-lg font-black">{st}</h3>
                <p className="text-sm text-gray-600">
                  {myServices.filter(s => s.stage_name === st).length} فصل • {getMembersForStage(st).length} مخدوم
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button type="button" onClick={() => { setSelectedStage(null); setServiceSubCard('menu'); setSelectedClass(null); }} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm">
                ← كل الخدمات
              </button>
              {serviceSubCard !== 'menu' && (
                <button type="button" onClick={() => setServiceSubCard('menu')} className="px-4 py-2 bg-amber-100 rounded-xl font-bold text-sm">
                  ← كروت {selectedStage}
                </button>
              )}
            </div>

            {serviceSubCard === 'menu' && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <button type="button" onClick={() => setServiceSubCard('leaders')} className="bg-white border-2 p-3.5 md:p-5 rounded-3xl text-right space-y-2 hover:border-[#7a1c24] cursor-pointer"><span className="text-3xl block">👑</span><strong className="text-base block">القيادات</strong></button>
                <button type="button" onClick={() => setServiceSubCard('classes')} className="bg-white border-2 p-3.5 md:p-5 rounded-3xl text-right space-y-2 hover:border-[#7a1c24] cursor-pointer"><span className="text-3xl block">🏫</span><strong className="text-base block">الفصول والمخدومين ({stageClasses.length})</strong></button>
                <button type="button" onClick={() => setServiceSubCard('servants')} className="bg-white border-2 p-3.5 md:p-5 rounded-3xl text-right space-y-2 hover:border-[#7a1c24] cursor-pointer"><span className="text-3xl block">👥</span><strong className="text-base block">الخدام ({stageServants.length})</strong></button>
                <button type="button" onClick={() => setServiceSubCard('visitations')} className="bg-white border-2 p-3.5 md:p-5 rounded-3xl text-right space-y-2 hover:border-[#7a1c24] cursor-pointer"><span className="text-3xl block">🕊️</span><strong className="text-base block">افتقاد {selectedStage} ({stageVisitations.length})</strong></button>
              </div>
            )}

            {serviceSubCard === 'leaders' && (
              <div className="bg-white p-3.5 md:p-5 rounded-3xl border grid md:grid-cols-2 gap-3">
                <div className="p-4 bg-[#fbfaf7] rounded-2xl border"><span className="text-gray-500 block">أمين الخدمة:</span><strong className="text-base">{stageClasses[0]?.head_servant_name || 'غير محدد'}</strong></div>
                <div className="p-4 bg-[#fbfaf7] rounded-2xl border"><span className="text-gray-500 block">مساعد الأمين:</span><strong className="text-base">{stageClasses[0]?.vice_head_name || 'غير محدد'}</strong></div>
              </div>
            )}

            {serviceSubCard === 'classes' && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-3">
                  {stageClasses.map(cls => (
                    <button type="button" key={cls.id} onClick={() => setSelectedClass(selectedClass?.id === cls.id ? null : cls)} className={`p-4 rounded-2xl border-2 text-right ${selectedClass?.id === cls.id ? 'bg-[#f9ecee] border-[#7a1c24]' : 'bg-white'}`}>
                      <strong className="text-base block">{cls.class_name}</strong>
                      <span className="text-sm text-gray-600">⏰ {cls.meeting_time}</span>
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
                    <select className="p-2.5 border rounded-xl" value={visitForm.class_name} onChange={e => setVisitForm({ ...visitForm, class_name: e.target.value })}>
                      <option value="">-- اختر الفصل --</option>
                      {stageClasses.map(c => <option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                    </select>
                    <select className="p-2.5 border rounded-xl" value={visitForm.target_user_id} onChange={e => { const u = allMembers.find(x => x.id === e.target.value); setVisitForm({ ...visitForm, target_user_id: e.target.value, target_name: u?.full_name || '' }); }}>
                      <option value="">-- اختر المخدوم --</option>
                      {(stageMembers.length > 0 ? stageMembers : allMembers).map(m => <option key={m.id} value={m.id}>{m.full_name} ({m.detailed_stage})</option>)}
                    </select>
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
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-4 md:p-6 space-y-2 text-sm max-h-[90dvh] overflow-y-auto">
              <div className="flex justify-between border-b pb-2">
                <strong className="text-lg text-[#7a1c24]">{inspectMember.full_name}</strong>
                <button type="button" onClick={() => setInspectMember(null)}><X size={18} /></button>
              </div>
              <p>🎂 {inspectMember.dob} ({calcAge(inspectMember.dob)}) • 🎓 {inspectMember.detailed_stage}</p>
              <p>📍 {inspectMember.address || '—'} • 📞 {inspectMember.phone}</p>
              {inspectMember.phone && (
                <button type="button" onClick={() => openWhatsAppComposer({ name: inspectMember.full_name, phone: inspectMember.phone, targetId: inspectMember.id, defaultCategory: 'افتقاد' })} className="px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                  <MessageCircle size={14} /> إرسال واتساب
                </button>
              )}
              {siblings.filter(s => s.member_id === inspectMember.id).map(sib => (
                <div key={sib.id} className="p-2 bg-amber-50 rounded-xl">• الأخ: {sib.sibling_full_name} ({sib.stage_or_job})</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCommitmentRewardsContent = () => {
    const filteredCommitments = commitmentStats.filter(item => {
      if (commitmentFilter !== 'all' && item.commitment_code !== commitmentFilter) return false;
      if (!commitmentSearch.trim()) return true;
      const q = commitmentSearch.trim().toLowerCase();
      return (
        (item.member_name || '').toLowerCase().includes(q) ||
        (item.assigned_class || '').toLowerCase().includes(q) ||
        (item.service_stage || '').toLowerCase().includes(q)
      );
    });

    return (
      <div className="space-y-4 text-sm md:text-base">
        <div className="grid lg:grid-cols-2 gap-4">
          <form onSubmit={handleGrantReward} className="bg-white p-3.5 md:p-5 rounded-3xl border space-y-3 font-bold shadow-2xs">
            <h3 className="text-base font-black text-[#7a1c24] flex items-center gap-1.5"><Gift size={18} /> منح عرض / خصم رحلة أو مكافأة حضور</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              <select className="p-2.5 border rounded-xl bg-[#fbfaf7]" value={rewardForm.member_id} onChange={e => setRewardForm({ ...rewardForm, member_id: e.target.value })}>
                <option value="">-- اختر المخدوم --</option>
                {allMembers.map(m => <option key={m.id} value={m.id}>{m.full_name} ({m.assigned_class || m.service_stage || 'عام'})</option>)}
              </select>
              <select className="p-2.5 border rounded-xl bg-[#fbfaf7]" value={rewardForm.campaign_id} onChange={e => setRewardForm({ ...rewardForm, campaign_id: e.target.value })}>
                <option value="">-- اختر عرض / رحلة متاحة --</option>
                {rewardCampaigns.map(c => <option key={c.id} value={c.id}>{c.title} ({c.target_scope})</option>)}
              </select>
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <select className="p-2.5 border rounded-xl bg-[#fbfaf7]" value={rewardForm.reward_type} onChange={e => setRewardForm({ ...rewardForm, reward_type: e.target.value })}>
                <option value="خصم رحلة">خصم رحلة</option><option value="مكافأة التزام">مكافأة التزام</option><option value="عرض مؤتمر">عرض مؤتمر</option><option value="مكافأة تميز">مكافأة تميز</option>
              </select>
              <input required placeholder="عنوان المكافأة / العرض *" className="p-2.5 border rounded-xl bg-[#fbfaf7]" value={rewardForm.reward_title} onChange={e => setRewardForm({ ...rewardForm, reward_title: e.target.value })} />
              <input type="number" min="0" max="100" placeholder="نسبة الخصم %" className="p-2.5 border rounded-xl bg-[#fbfaf7]" value={rewardForm.discount_percent} onChange={e => setRewardForm({ ...rewardForm, discount_percent: e.target.value })} />
            </div>
            <input placeholder="ملاحظة إضافية..." className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]" value={rewardForm.notes} onChange={e => setRewardForm({ ...rewardForm, notes: e.target.value })} />
            <button type="submit" className="px-5 py-2.5 bg-[#7a1c24] text-white rounded-xl font-black text-xs cursor-pointer">+ تسجيل المكافأة / العرض</button>
          </form>

          <form onSubmit={handleAddMemberNote} className="bg-white p-3.5 md:p-5 rounded-3xl border space-y-3 font-bold shadow-2xs">
            <h3 className="text-base font-black text-[#7a1c24] flex items-center gap-1.5"><ClipboardCheck size={18} /> تسجيل ملاحظة متابعة (تظهر لولي الأمر أو داخلية)</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              <select className="p-2.5 border rounded-xl bg-[#fbfaf7]" value={noteForm.member_id} onChange={e => setNoteForm({ ...noteForm, member_id: e.target.value })}>
                <option value="">-- اختر المخدوم --</option>
                {allMembers.map(m => <option key={m.id} value={m.id}>{m.full_name} ({m.assigned_class || m.service_stage || 'عام'})</option>)}
              </select>
              <select className="p-2.5 border rounded-xl bg-[#fbfaf7]" value={noteForm.behavior_tag} onChange={e => setNoteForm({ ...noteForm, behavior_tag: e.target.value })}>
                <option value="متابعة روحية">متابعة روحية</option><option value="التزام وكفاءة">التزام وكفاءة</option><option value="محتاج افتقاد">محتاج افتقاد</option><option value="تأخير / غياب">تأخير / غياب</option>
              </select>
            </div>
            <textarea rows="2" placeholder="اكتب ملاحظة المتابعة..." className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]" value={noteForm.note_text} onChange={e => setNoteForm({ ...noteForm, note_text: e.target.value })} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer">
                <input type="checkbox" checked={noteForm.visible_to_parent} onChange={e => setNoteForm({ ...noteForm, visible_to_parent: e.target.checked })} />
                <span>إظهار هذه الملاحظة لولي الأمر في شاشة ولي الأمر</span>
              </label>
              <button type="submit" className="px-5 py-2.5 bg-teal-800 text-white rounded-xl font-black text-xs cursor-pointer">+ حفظ الملاحظة</button>
            </div>
          </form>
        </div>

        <div className="bg-white p-3.5 md:p-5 rounded-3xl border space-y-3 shadow-2xs">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="text-base font-black text-gray-900 flex items-center gap-1.5"><Award size={18} className="text-[#7a1c24]" /> مؤشر الالتزام والكفاءة والغياب والتأخير ({filteredCommitments.length})</h3>
            <div className="flex flex-wrap gap-2">
              <input placeholder="بحث بالاسم أو الفصل..." className="p-2 border rounded-xl text-xs bg-[#fbfaf7]" value={commitmentSearch} onChange={e => setCommitmentSearch(e.target.value)} />
              <select className="p-2 border rounded-xl text-xs font-bold bg-[#fbfaf7]" value={commitmentFilter} onChange={e => setCommitmentFilter(e.target.value)}>
                <option value="all">كل الحالات</option><option value="high_commitment">ممتاز وكفء جداً</option><option value="high_absence">كثير الغياب</option><option value="needs_encouragement">يحتاج تشجيع / متابعة</option><option value="unrecorded">لم يُسجل حضور بعد</option>
              </select>
            </div>
          </div>

          <div className="md:hidden space-y-2">
            {filteredCommitments.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-xs border rounded-2xl">لا توجد سجلات التزام مطابقة حالياً.</div>
            ) : filteredCommitments.map(row => (
              <div key={row.member_id} className="p-3 bg-white border rounded-2xl space-y-1.5 text-xs font-bold">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="text-sm font-black text-gray-900 block truncate">{row.member_name}</strong>
                    <span className="text-gray-600">{row.service_stage || '—'} {row.assigned_class ? `(${row.assigned_class})` : ''}</span>
                  </div>
                  <span className="text-lg font-black text-[#7a1c24] shrink-0">{row.attendance_percentage ?? 0}%</span>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-900">حضور {row.present_count ?? 0}</span>
                  <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-800">غياب {row.absent_count ?? 0}</span>
                  <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700">تأخير {row.late_count ?? 0}</span>
                  <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700">مبكر {row.early_leave_count ?? 0}</span>
                  <span className={`px-2.5 py-0.5 rounded-xl text-[11px] font-black ${row.commitment_code === 'high_commitment' ? 'bg-emerald-100 text-emerald-900' : row.commitment_code === 'high_absence' ? 'bg-rose-100 text-rose-900' : 'bg-amber-100 text-amber-950'}`}>{row.commitment_status}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto border rounded-2xl max-h-96 overflow-y-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead className="sticky top-0">
                <tr className="bg-[#7a1c24] text-white font-black">
                  <th className="p-2.5">الاسم</th><th className="p-2.5">الخدمة / الفصل</th><th className="p-2.5">نسبة الحضور</th>
                  <th className="p-2.5">حضور / غياب</th><th className="p-2.5">تأخير / انصراف مبكر</th><th className="p-2.5">تقييم الكفاءة والالتزام</th>
                </tr>
              </thead>
              <tbody className="divide-y font-bold">
                {filteredCommitments.length === 0 ? (
                  <tr><td colSpan={6} className="p-4 md:p-6 text-center text-gray-400">لا توجد سجلات التزام مطابقة حالياً.</td></tr>
                ) : (
                  filteredCommitments.map(row => (
                    <tr key={row.member_id} className="hover:bg-[#fbfaf7]">
                      <td className="p-2.5 font-black text-gray-900">{row.member_name}</td>
                      <td className="p-2.5 text-gray-700">{row.service_stage || '—'} {row.assigned_class ? `(${row.assigned_class})` : ''}</td>
                      <td className="p-2.5 font-black text-[#7a1c24]">{row.attendance_percentage ?? 0}%</td>
                      <td className="p-2.5">حضور: {row.present_count ?? 0} • غياب: <span className="text-rose-700">{row.absent_count ?? 0}</span></td>
                      <td className="p-2.5">تأخير: {row.late_count ?? 0} • مبكر: {row.early_leave_count ?? 0}</td>
                      <td className="p-2.5">
                        <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black ${
                          row.commitment_code === 'high_commitment' ? 'bg-emerald-100 text-emerald-900' : row.commitment_code === 'high_absence' ? 'bg-rose-100 text-rose-900' : 'bg-amber-100 text-amber-950'
                        }`}>
                          {row.commitment_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {memberNotes.length > 0 && (
          <div className="bg-white p-4 rounded-3xl border space-y-2 text-xs">
            <strong className="text-sm font-black text-gray-900 block">آخر ملاحظات المتابعة ({memberNotes.length})</strong>
            <div className="grid sm:grid-cols-2 gap-2">
              {memberNotes.slice(0, 8).map(n => {
                const mem = localUsers.find(u => String(u.id) === String(n.member_id));
                return (
                  <div key={n.id} className="p-3 bg-[#fbfaf7] rounded-2xl border flex justify-between items-start gap-2">
                    <div>
                      <strong className="text-gray-900 block">{mem?.full_name || n.member_id}</strong>
                      <span className="text-[11px] text-[#7a1c24] font-bold">{n.behavior_tag || 'ملاحظة'}</span>
                      <p className="text-gray-700 mt-0.5">{n.note_text}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-[10px] font-black ${
                        n.acknowledged || n.is_read ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
                      }`}>
                        {n.acknowledged || n.is_read
                          ? `✓ علّم عليها${n.acknowledged_by ? ` — ${n.acknowledged_by}` : ''}`
                          : '⏳ لسه ما اتقراتش'}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${n.visible_to_parent ? 'bg-emerald-100 text-emerald-900' : 'bg-gray-200 text-gray-700'}`}>
                      {n.visible_to_parent ? 'ظاهر لولي الأمر' : 'داخلي فقط'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (activeCard === 'hub') {
    const rawHubCards = [
      { id: 'service_hub', icon: '🏫', title: 'الخدمة ومدارس الأحد', desc: '3 كروت مستقلة: شيت التسلسل والافتقاد والترحيم • الالتزام والكفاءة والعروض والرحلات • جدول الخدمة', count: `${stagesMap.length} خدمة • ${localUsers.length} مسجل`, color: 'border-teal-300 bg-teal-50/40' },
      { id: 'confessions', icon: '🙏', title: 'الاعترافات', desc: `المواعيد والمدة (${confessionIntervalDays} يوم)، المعترفون (داخل/خارج الكنيسة) والملف الروحي، والافتقاد`, count: `${myConfessors.length} معترف • ${confessionSlots.length} موعد`, color: 'border-red-200 bg-white' },
      { id: 'family_visitation', icon: '👨‍👩‍👧‍👦', title: 'افتقاد أسر الكاهن', desc: 'تفاصيل الأسرة: الزوج والزوجة والأبناء والوالد والوالدة، تواريخ الميلاد، الحالة الاجتماعية والدراسية والوظائف، وسجل الزيارات', count: 'سجل الأسر', color: 'border-rose-200 bg-rose-50/30' },
      { id: 'event_invitations', icon: '💌', title: 'دعوات المناسبات والـ QR', desc: 'إرسال دعوات VIP أو عامة للمناسبات الكبرى (تدشين، مهرجان، احتفالية، يوبيل) للنوتيفيكيشن وواتساب ومتابعة السكان', count: `${eventInvitationsCount} دعوة صادرة`, color: 'border-amber-300 bg-amber-50/40' },
      { id: 'certificates', icon: '📜', title: 'التوثيق والشهادات وخلو الموانع', desc: 'شهادات المعمودية والشمامسة، وكارت خلو الموانع (تسلسل رقمي + الرقم القومي كمفتاح أساسي)', count: 'خلو الموانع والتوثيق', color: 'border-amber-300 bg-amber-50/40' },
      { id: 'masses', icon: '⛪', title: 'جدول القداسات', desc: 'اسم القداس، كاهن خادم أو شريك، والفئات', count: `${masses.length} قداس`, color: 'border-blue-200 bg-white' },
      { id: 'personal', icon: '📅', title: 'الجدول الخاص بالكاهن والدعوات', desc: 'استقبال دعوات الشعب، صلاة طشت، خطوبة، أكاليل، رحلات ومؤتمرات بالأقساط والأتوبيسات', count: pendingInvitesCount > 0 ? `💌 ${pendingInvitesCount} دعوة • ${personalItems.length} موعد` : `${personalItems.length} موعد`, color: pendingInvitesCount > 0 ? 'border-purple-400 bg-purple-50/40' : 'border-purple-200 bg-white' },
      { id: 'cases', icon: '🔍', title: 'بحث الحالة / العيلة', desc: 'البحث، التصنيفات، الإضافة، المرفقات (بطاقة/إيجار/تحاليل)، وطلبات الأسر المستترة وطباعة PDF', count: pendingHiddenReqsCount > 0 ? `📩 ${pendingHiddenReqsCount} طلب • ${families.length} أسرة` : `${families.length} أسرة`, color: pendingHiddenReqsCount > 0 ? 'border-amber-400 bg-amber-50/40' : 'border-emerald-200 bg-white' },
      { id: 'edu_center', icon: '🎓', title: 'المركز التعليمي', desc: 'جدول الدروس، المراحل التعليمية، المواد الدراسية، الأسعار، وتسجيل الحضور', count: 'مركز الدروس', color: 'border-indigo-200 bg-white' },
      { id: 'joseph_arimathea', icon: '🕊️', title: 'خدمة يوسف الرامي', desc: 'حالات الوفاة بالليل، الطقوس التلقائية، الصناديق، وخط سير السائق ومكان الدفن', count: totalJosephAlerts > 0 ? `🚨 ${totalJosephAlerts} بحاجة للمتابعة` : `${josephCases.length} حالة مسجلة`, color: totalJosephAlerts > 0 ? 'border-red-400 bg-red-50/50' : 'border-slate-300 bg-white' }
    ];

    const effectiveCards = rawHubCards
      .map(c => applyCardOverride(c, 'priest_hub'))
      .filter(c => {
        if (!c.isActive) return false;
        if (c.parentKey) return false;
        if (c.placementScreen && c.placementScreen !== 'priest_hub') return false;
        return isCardAllowedForRole(c.allowedRoles, priest?.role || 'priest', priest?.role === 'admin');
      });

    const displayedBdays = bdayTab === 'week' ? weekBirthdays : monthBirthdays;

    return (
      <div className="space-y-3 text-sm md:text-base">
        {renderQuickNavBar()}

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
              <button type="button" onClick={() => { setActiveCard('joseph_arimathea'); setLiveJosephAlert(null); }} className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-red-950 font-black rounded-xl text-xs shadow cursor-pointer">
                فتح ومتابعة فوراً ↗
              </button>
              <button type="button" onClick={() => setLiveJosephAlert(null)} className="text-white/70 hover:text-white text-xs">✕</button>
            </div>
          </div>
        )}

        <div className="app-hero bg-linear-to-r from-[#5c1319] to-[#7a1c24] text-white p-4 md:p-5 rounded-3xl shadow flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-black text-amber-200">مكتب رعاية: {priest.full_name}</h2>
            <p className="text-sm text-white/85 mt-1">اختر الكارت للدخول إلى التفاصيل الكاملة</p>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <span className="app-chip">👥 أعضاء الكنيسة <b>{users.length}</b></span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {renderBellPanel()}
            <button type="button" onClick={() => openWhatsAppComposer({ name: '', phone: '', defaultCategory: 'افتقاد' })} className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-xs md:text-sm flex items-center gap-2 cursor-pointer shadow">
              <MessageCircle size={17} /> إرسال رسالة واتساب / بحث بالاسم
            </button>
          </div>
        </div>

        <div ref={scrollBoxRef} className="space-y-4">
          <PriestQuickSearch
            users={localUsers}
            confessorIds={new Set(myConfessors.map(m => m.id))}
            onPick={(m) => setSelectedConfessor(m)}
          />
          <PriestTodayPanel items={[
            { key: 'conf', icon: '🙏', value: confessionSlots.filter(sl => sl.slot_date === todayISO).length, label: 'جلسات اعتراف النهاردة', onClick: () => { setSelectedNestedParentKey(null); setActiveCard('confessions'); setConfSubView('menu'); } },
            { key: 'bday', icon: '🎂', value: weekBirthdays.length, label: 'أعياد ميلاد الأسبوع', onClick: () => { setBdayTab('week'); setBdayOpen(true); } },
            { key: 'inv', icon: '💌', value: pendingInvitesCount, label: 'دعوات بانتظار الرد', alert: pendingInvitesCount > 0, onClick: () => { setSelectedNestedParentKey(null); setActiveCard('personal'); } },
            { key: 'req', icon: '📩', value: pendingHiddenReqsCount, label: 'طلبات الأسر المستترة', alert: pendingHiddenReqsCount > 0, onClick: () => { setSelectedNestedParentKey(null); setActiveCard('cases'); } },
            totalJosephAlerts > 0 ? { key: 'jos', icon: '🕊️', value: totalJosephAlerts, label: 'يوسف الرامي بحاجة للمتابعة', alert: true, onClick: () => { setSelectedNestedParentKey(null); setActiveCard('joseph_arimathea'); } } : null
          ]} />
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

              <button type="button" onClick={() => setBdayOpen(o => !o)} className="px-3 py-1.5 rounded-xl text-xs font-black border bg-white text-amber-950 border-amber-300 cursor-pointer">{(bdayOpen || weekBirthdays.some(b => b.daysLeft === 0)) ? 'إخفاء ▲' : 'عرض التفاصيل ▼'}</button>
              {(bdayOpen || weekBirthdays.some(b => b.daysLeft === 0)) && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <button type="button" onClick={() => setBdayTab('week')} className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer ${bdayTab === 'week' ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-amber-950 border-amber-300'}`}>🎂 هذا الأسبوع ({weekBirthdays.length})</button>
                <button type="button" onClick={() => setBdayTab('month')} className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer ${bdayTab === 'month' ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-amber-950 border-amber-300'}`}>📅 كل شهر {currentMonthName} ({monthBirthdays.length})</button>
                <select className="p-1.5 border border-amber-300 rounded-xl bg-white text-xs font-bold text-amber-950" value={bdayScope} onChange={e => setBdayScope(e.target.value)}>
                  <option value="confessors">معترفي أبونا فقط</option>
                  <option value="all">كل شعب الكنيسة</option>
                </select>
              </div>
              )}
            </div>

            {(bdayOpen || weekBirthdays.some(bb => bb.daysLeft === 0)) && (displayedBdays.length === 0 ? (
              <div className="bg-white/80 p-3 rounded-2xl border border-amber-200 text-xs text-amber-900 text-center">
                لا توجد أعياد ميلاد مسجلة في هذه الفترة ({bdayTab === 'week' ? 'الأسبوع الحالي' : `شهر ${currentMonthName}`}).
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
                        <button type="button" onClick={() => openWhatsAppComposer({ name: b.full_name, phone: b.phone, targetId: b.id, defaultCategory: 'معايدة' })} className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer">
                          <MessageCircle size={13} /> معايدة
                        </button>
                      ) : <span className="text-[10px] text-gray-400 shrink-0">بدون رقم</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-4">
            {effectiveCards.map(c => (
              <button
                type="button"
                key={c.id}
                onClick={() => {
                  setSelectedNestedParentKey(null);
                  setActiveCard(c.id);
                  if (c.id === 'service_hub') setActiveServiceCard(null);
                }}
                className={`${c.color} border-2 p-3 md:p-5 rounded-2xl md:rounded-3xl text-right shadow-sm hover:shadow-md hover:border-[#7a1c24] transition flex flex-col justify-between gap-2 md:gap-3 cursor-pointer`}
              >
                <div className="flex justify-between items-start w-full">
                  <span className="text-2xl md:text-4xl">{c.icon}</span>
                  <span className="px-3 py-1 bg-[#f9ecee] text-[#7a1c24] rounded-full text-xs font-black">{c.count}</span>
                </div>
                <div>
                  <h3 className="text-sm md:text-lg font-black text-gray-900">{c.title}</h3>
                  <p className="hidden md:block text-sm text-gray-600 mt-1">{c.desc}</p>
                </div>
              </button>
            ))}

            {customCards.map(cc => (
              <button type="button" key={cc.id} onClick={() => setActiveCard('custom:' + cc.id)} className="bg-amber-50/50 border-2 border-amber-300 p-3 md:p-5 rounded-2xl md:rounded-3xl text-right shadow-sm hover:shadow-md hover:border-[#7a1c24] transition flex flex-col justify-between gap-2 md:gap-3 cursor-pointer">
                <div className="flex justify-between items-start w-full">
                  <span className="text-2xl md:text-4xl">{cc.card_icon || '📌'}</span>
                  <span className="px-3 py-1 bg-amber-200 text-amber-950 rounded-full text-xs font-black">كارت مضاف</span>
                </div>
                <div>
                  <h3 className="text-sm md:text-lg font-black text-gray-900">{cc.card_title}</h3>
                  <p className="hidden md:block text-sm text-gray-700 mt-1">{cc.description || 'سجل مضاف من الأدمن'}</p>
                </div>
              </button>
            ))}
          </div>

          {renderNestedCardsSection('priest_hub', selectedNestedParentKey)}
        </div>

        {renderGlobalModals()}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm md:text-base">
      {renderQuickNavBar()}

      <div ref={scrollBoxRef} className="space-y-4">
        {renderNestedCardsSection(activeCard, selectedNestedParentKey)}

        {activeCard === 'service_hub' && (() => {
          const threeServiceCards = [
            applyCardOverride({
              id: 'priest_srv_sequence',
              emoji: '📋',
              title: 'شيت التسلسل والافتقاد والترحيم',
              desc: 'عرض كل خدمة على حدة وبند المعاشات + حالة الافتقاد وذكرى الترحيم + تصدير وطباعة',
              badge: `${localUsers.length} مسجل`,
              icon: ClipboardList,
              color: 'border-emerald-200 bg-white'
            }, 'service_hub'),
            applyCardOverride({
              id: 'priest_srv_commitment',
              emoji: '🏅',
              title: 'الالتزام والكفاءة والعروض والرحلات',
              desc: 'متابعة الالتزام والغياب والتأخير، ومنح العروض والخصومات، والملاحظات لولي الأمر',
              badge: `${rewardCampaigns.length} عرض • ${memberRewards.length} مكافأة`,
              icon: Award,
              color: 'border-amber-200 bg-white'
            }, 'service_hub'),
            applyCardOverride({
              id: 'priest_srv_schedule',
              emoji: '🏫',
              title: 'جدول الخدمة',
              desc: 'كروت الخدمات، القيادات، الفصول، الخدام، وافتقاد الخدمة',
              badge: `${stagesMap.length} خدمة`,
              icon: School,
              color: 'border-blue-200 bg-white'
            }, 'service_hub')
          ].filter(c => c.isActive !== false && isCardAllowedForRole(c.allowedRoles, priest?.role || 'priest', priest?.role === 'admin'));

          const serviceTabMap = {
            priest_srv_sequence: 'sequence',
            priest_srv_commitment: 'commitment',
            priest_srv_schedule: 'schedule'
          };

          const currentCardMeta = threeServiceCards.find(c => serviceTabMap[c.id] === activeServiceCard);
          return (
            <div className="space-y-4">
              {renderTopBar(currentCardMeta ? `🏫 ${currentCardMeta.title}` : '🏫 الخدمة ومدارس الأحد')}
              {activeServiceCard && (
                <div>
                  <button type="button" onClick={() => { setActiveServiceCard(null); setSelectedStage(null); setServiceSubCard('menu'); setSelectedClass(null); }} className="px-4 py-2 bg-white border hover:bg-gray-50 rounded-xl font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer">
                    ← رجوع لكروت الخدمة ومدارس الأحد ({threeServiceCards.length} كروت)
                  </button>
                </div>
              )}
              {!activeServiceCard && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {threeServiceCards.map(card => {
                    const Icon = card.icon;
                    const tabKey = serviceTabMap[card.id];
                    return (
                      <button key={card.id} type="button" onClick={() => setActiveServiceCard(tabKey)} className={`${card.color} border-2 p-4 md:p-6 rounded-3xl text-right shadow-sm hover:shadow-md hover:border-[#7a1c24] transition flex flex-col justify-between gap-4 cursor-pointer`}>
                        <div className="flex justify-between items-start w-full">
                          <span className="p-3 bg-[#f9ecee] text-[#7a1c24] rounded-2xl flex items-center gap-1">
                            {card.emoji && <span className="text-lg">{card.emoji}</span>}
                            <Icon size={24} />
                          </span>
                          <span className="px-3 py-1 bg-amber-100 text-amber-950 rounded-full text-xs font-black">{card.badge}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-gray-900">{card.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{card.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {activeServiceCard === 'sequence' && (
                <MasterCongregationSheet users={localUsers} services={services} serviceGroups={serviceGroups} currentUser={priest} onUpdateUser={handleUpdateUserFromSheet} onRefresh={loadPriestData} />
              )}
              {activeServiceCard === 'commitment' && renderCommitmentRewardsContent()}
              {activeServiceCard === 'schedule' && renderServiceScheduleContent()}
            </div>
          );
        })()}

        {activeCard === 'confessions' && (() => {
          const y = calMonth.getFullYear(), m = calMonth.getMonth();
          const daysInM = new Date(y, m + 1, 0).getDate();
          const startOff = (new Date(y, m, 1).getDay() + 1) % 7;
          const confVisitations = visitations.filter(v => v.category === 'افتقاد معترفين');

          const confMenuCards = [
            applyCardOverride({
              id: 'priest_conf_slots',
              view: 'slots',
              icon: '📅',
              title: 'إضافة مواعيد الاعتراف',
              desc: `تحديد المدة (أسبوع/شهر/3 شهور)، صباحي/مسائي (${confessionSlots.length})`,
              color: 'border-blue-200 bg-white'
            }, 'confessions'),
            applyCardOverride({
              id: 'priest_conf_list',
              view: 'confessors',
              icon: '🙏',
              title: `المعترفون (${myConfessors.length})`,
              desc: 'الملف الروحي، الثغرات والإجراءات، والقانون الروحي',
              color: 'border-red-200 bg-white'
            }, 'confessions'),
            applyCardOverride({
              id: 'priest_conf_visitations',
              view: 'visitations',
              icon: '🕊️',
              title: `افتقاد المعترفين (${confVisitations.length})`,
              desc: 'افتقاد بزيارة، رسالة واتساب ممنهجة قابلة للتعديل، أو اتصال',
              color: 'border-amber-200 bg-white'
            }, 'confessions')
          ].filter(c => c.isActive !== false && isCardAllowedForRole(c.allowedRoles, priest?.role || 'priest', priest?.role === 'admin'));

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
            <div className="space-y-4">
              {renderTopBar('🙏 الاعترافات والمتابعة الروحية')}

              <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-3xl flex flex-wrap justify-between items-center gap-3">
                <div>
                  <strong className="text-sm font-black text-amber-950 block">⏱️ تحديد مدة الاعتراف الدورية لكل الشعب</strong>
                  <p className="text-xs text-amber-900">
                    كل معترف يتجاوز هذه المدة يظهر عليه تنبيه «متأخر عن الاعتراف» لمتابعته وافتقاده، وتظهر المدة في صفحة المخدوم.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveConfessionInterval(45)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer border ${
                      confessionIntervalDays === 45 ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-gray-800'
                    }`}
                  >
                    كل شهر ونصف (45 يوم)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveConfessionInterval(60)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer border ${
                      confessionIntervalDays === 60 ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-gray-800'
                    }`}
                  >
                    كل شهرين (60 يوم)
                  </button>
                  <input
                    type="number"
                    min="7"
                    max="180"
                    className="w-20 p-2 border rounded-xl bg-white text-xs font-black text-center"
                    value={confessionIntervalDays}
                    onChange={e => handleSaveConfessionInterval(e.target.value)}
                  />
                  <span className="text-xs font-bold text-gray-700">{savingInterval ? 'جاري الحفظ...' : 'يوم'}</span>
                </div>
              </div>

              {confSubView === 'menu' && (
                <div className="grid sm:grid-cols-3 gap-4">
                  {confMenuCards.map(mc => (
                    <button key={mc.id} type="button" onClick={() => setConfSubView(mc.view)} className={`bg-white border-2 ${mc.color} hover:border-[#7a1c24] p-4 md:p-6 rounded-3xl text-right shadow-sm space-y-2 transition cursor-pointer`}>
                      <span className="text-4xl block">{mc.icon}</span>
                      <h3 className="text-lg font-black text-gray-900">{mc.title}</h3>
                      <p className="text-sm text-gray-600">{mc.desc}</p>
                    </button>
                  ))}
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

                    <form onSubmit={handleSaveSlot} className="bg-white p-3.5 md:p-5 rounded-3xl border space-y-3 font-bold shadow-sm">
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
                        <input required type="time" className="p-2 border rounded-xl" value={slotForm.end_time} onChange={e => setSlotForm({ ...slotForm, end_time: e.target.value })} />
                        <input required type="number" min="1" className="p-2 border rounded-xl" value={slotForm.max_confessors} onChange={e => setSlotForm({ ...slotForm, max_confessors: e.target.value })} />
                      </div>
                      {!editingSlotId && (
                        <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 space-y-2">
                          <select className="w-full p-2.5 border border-amber-300 rounded-xl bg-white" value={durationMode} onChange={e => setDurationMode(e.target.value)}>
                            <option value="once">يوم واحد فقط</option><option value="week">لمدة أسبوع (7 أيام)</option><option value="month">لمدة شهر (30 يوم)</option><option value="two_months">لمدة شهرين (60 يوم)</option><option value="three_months">لمدة 3 شهور (90 يوم)</option>
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
                          <button type="button" onClick={() => { setEditingSlotId(s.id); setSlotForm({ ...s }); scrollPanelTop(); }} className="px-3 py-2 bg-gray-100 rounded-xl font-bold flex items-center gap-1 text-xs"><Edit3 size={14} /> تعديل</button>
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

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                    {filteredConfessors.map(m => {
                      const note = spiritualNotes.find(n => n.member_id === m.id);
                      const kids = userChildren.filter(k => k.parent_user_id === m.id);
                      const linkedFather = m.father_id ? localUsers.find(u => u.id === m.father_id) : null;
                      const isOutside = m.is_church_member === false;
                      const nextBooking = confessionBookings
                        .filter(b => b.member_id === m.id && b.booking_date >= todayISO && b.status === 'محجوز')
                        .sort((a, b) => (a.booking_date || '').localeCompare(b.booking_date || ''))[0];

                      const lastConfStr = note?.last_confession_date;
                      const daysSinceConf = lastConfStr
                        ? Math.floor((Date.now() - new Date(lastConfStr).getTime()) / 86400000)
                        : null;
                      const isOverdueConf = daysSinceConf !== null && daysSinceConf > confessionIntervalDays;

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
                          {isOverdueConf && (
                            <div className="px-2.5 py-1 bg-red-50 border border-red-300 text-red-800 rounded-xl text-xs font-black">
                              ⚠️ متأخر عن الاعتراف منذ {daysSinceConf} يوم (الحد: {confessionIntervalDays} يوم)
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
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
                      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-xl p-4 md:p-6 space-y-3 font-bold max-h-[92dvh] overflow-y-auto">
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
                            <select className="p-2.5 border rounded-xl" value={newConfessor.marital_status} onChange={e => setNewConfessor({ ...newConfessor, marital_status: e.target.value })}><option value="أعزب">أعزب</option><option value="متزوج">متزوج</option><option value="مطلق">مطلق</option><option value="أرمل">أرمل</option></select>
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
            </div>
          );
        })()}

        {activeCard === 'family_visitation' && (
          <div className="space-y-4">
            {renderTopBar('👨‍👩‍👧‍👦 افتقاد أسر ومخدومي الأب الكاهن')}
            <PriestFamilyVisitation
              priest={priest}
              onOpenWhatsApp={openWhatsAppComposer}
            />
          </div>
        )}

        {activeCard === 'event_invitations' && (
          <div className="space-y-4">
            {renderTopBar('💌 دعوات المناسبات الكبرى والـ QR Code')}
            <PriestInvitationsTab
              currentUser={priest}
              users={localUsers}
              services={myServices}
            />
          </div>
        )}

        {activeCard === 'certificates' && (
          <div className="space-y-4">
            {renderTopBar('📜 التوثيق والشهادات وكارت خلو الموانع')}
            <CertificatesRegistry
              users={localUsers}
              onRefresh={loadPriestData}
              initialTab="clearance"
            />
          </div>
        )}

        {activeCard === 'masses' && (
          <div className="space-y-4">
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
                  <button type="button" onClick={() => { setEditingMassId(m.id); setMassForm({ ...m }); scrollPanelTop(); }} className="p-2.5 bg-gray-100 rounded-xl"><Edit3 size={15} /></button>
                  <button type="button" onClick={() => toggleMassAvailability(m)} className={`px-3 py-1.5 rounded-xl font-bold text-xs ${m.is_available ? 'bg-green-100' : 'bg-red-100'}`}>{m.is_available ? 'متاح' : 'معتذر'}</button>
                  <button type="button" onClick={() => deleteMass(m.id)} className="p-2.5 bg-red-50 text-red-700 rounded-xl"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeCard === 'personal' && (
          <div className="space-y-4">
            <div className={printBusState ? 'print:hidden space-y-4' : 'space-y-4'}>
              {renderTopBar('📅 الجدول الخاص بالكاهن والدعوات الواردة')}

              {invitations.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-3xl space-y-2.5">
                  <strong className="text-sm font-black text-[#7a1c24] block">
                    💌 دعوات المناسبات الواردة من الشعب والخدام وأولياء الأمور ({pendingInvitesCount} بانتظار الرد)
                  </strong>
                  <div className="grid md:grid-cols-2 gap-2.5">
                    {invitations.map(inv => (
                      <div key={inv.id} className="bg-white p-3.5 rounded-2xl border space-y-1.5 text-xs">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-950 rounded text-[10px] font-black ml-1.5">{inv.event_type}</span>
                            <strong className="text-sm text-gray-900">{inv.title}</strong>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            inv.status === 'مقبولة' ? 'bg-green-100 text-green-800' : inv.status === 'معتذر' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
                          }`}>{inv.status}</span>
                        </div>
                        <p className="text-gray-700">👤 من ({inv.sender_role}): <strong>{inv.sender_name}</strong> • 📞 {inv.sender_phone || '—'}</p>
                        <p className="text-gray-600">📅 {inv.event_date} {inv.event_time && `• ⏰ ${inv.event_time}`} {inv.location && `• 📍 ${inv.location}`}</p>
                        {inv.notes && <p className="text-gray-600">📝 {inv.notes}</p>}
                        {inv.status === 'قيد الانتظار' && (
                          <div className="flex gap-2 pt-1">
                            <button type="button" onClick={() => handleRespondInvitation(inv, 'مقبولة')} className="flex-1 py-1.5 bg-green-700 text-white rounded-xl font-black cursor-pointer">
                              قبول وإضافة للجدول ✅
                            </button>
                            <button type="button" onClick={() => handleRespondInvitation(inv, 'معتذر')} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-xl font-bold cursor-pointer">
                              اعتذار
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSavePersonal} className="bg-white p-3.5 md:p-5 rounded-3xl border space-y-3 font-bold">
                <div className="grid md:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">نوع المناسبة / النشاط *</label>
                    <select className="w-full p-2.5 border rounded-xl" value={formatEventTypeDisplay(persForm.event_type)} onChange={e => { const val = e.target.value; setPersForm({ ...persForm, event_type: val, activity_kind: val === 'مؤتمر روحي 🏕️' ? 'مؤتمر' : val === 'رحلة كنسية 🚌' ? 'رحلة' : persForm.activity_kind }); }}>
                      <option value="خطوبة 💍">خطوبة 💍</option>
                      <option value="إكليل (فرح) 👑">إكليل (فرح) 👑</option>
                      <option value="صلاة طشت 💧">صلاة طشت 💧</option>
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
                  <div key={p.id} className="bg-white p-3.5 md:p-5 rounded-2xl border space-y-2.5 shadow-2xs">
                    <div className="flex flex-wrap justify-between items-start gap-2">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-purple-100 text-purple-950 rounded text-xs font-bold">{formatEventTypeDisplay(p.event_type)}</span>
                          <strong className="text-base md:text-lg">{p.title}</strong>
                          <span className="px-2.5 py-0.5 bg-blue-50 text-blue-900 rounded text-xs font-bold">{p.target_service ? `خدمة: ${p.target_service}` : 'عام'}</span>
                          {isTripItem && <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded text-xs font-black">💰 {p.trip_cost || 0} ج.م</span>}
                        </div>
                        <p className="text-sm text-gray-600">📅 {p.event_date} {p.event_time && `• ⏰ ${p.event_time}`} {p.location && `• 📍 ${p.location}`}</p>
                        {isTripItem && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {busesList.map((b, bi) => <span key={b.id || bi} className="px-2.5 py-1 bg-slate-100 border rounded-lg text-xs font-bold">🚌 {b.name}: {(b.seats || []).filter(s => !s.isDoor && s.occupant).length}/{(b.seats || []).filter(s => !s.isDoor).length}</span>)}
                            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-black text-emerald-800">محصل: {collectedSum} ج.م • باقي: {remainingSum} ج.م</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {isTripItem && (
                          <>
                            <button type="button" onClick={() => setViewBusItem(p)} className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold flex items-center gap-1 text-xs cursor-pointer"><Bus size={15} /> الأتوبيسات ({bookedSeats}/{totalSeats})</button>
                            <button type="button" onClick={() => setPrintBusState({ item: p, busIndex: 'all', mode: 'all' })} className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center gap-1 text-xs cursor-pointer"><Printer size={14} /> طباعة الكشف</button>
                          </>
                        )}
                        <button type="button" onClick={() => { setEditingPersId(p.id); setPersForm({ ...emptyPers, ...p, bus_seats: normalizeBuses(p.bus_seats) }); scrollPanelTop(); }} className="p-2.5 bg-gray-100 rounded-xl cursor-pointer"><Edit3 size={15} /></button>
                        <button type="button" onClick={() => togglePersonalVisibility(p)} className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 text-xs cursor-pointer ${p.is_public ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>{p.is_public ? <><Globe size={14} /> عام</> : <><Lock size={14} /> سري</>}</button>
                        <button type="button" onClick={() => deletePersonal(p.id)} className="p-2.5 bg-red-50 text-red-700 rounded-xl cursor-pointer"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {viewBusItem && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
                  <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-4xl p-4 md:p-6 space-y-4 font-bold max-h-[92dvh] overflow-y-auto">
                    <div className="flex justify-between items-center border-b pb-3">
                      <div>
                        <h3 className="text-lg font-black text-purple-950">🚌 إدارة الأتوبيسات والأقساط: {viewBusItem.title}</h3>
                        <p className="text-xs text-gray-600 mt-0.5">📅 {viewBusItem.event_date} • 💰 سعر الفرد: <strong>{viewBusItem.trip_cost || 0} ج.م</strong></p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setPrintBusState({ item: viewBusItem, busIndex: 'all', mode: 'all' })} className="px-3.5 py-2 bg-slate-800 text-white rounded-xl text-xs flex items-center gap-1 cursor-pointer"><Printer size={14} /> طباعة الكشف</button>
                        <button type="button" onClick={() => setViewBusItem(null)} className="p-2 bg-gray-100 rounded-xl cursor-pointer"><X size={18} /></button>
                      </div>
                    </div>
                    <BusVisualizerSection
                      rawBusesData={viewBusItem.bus_seats}
                      tripCost={viewBusItem.trip_cost}
                      isViewMode={true}
                      localUsers={localUsers}
                      priest={priest}
                      todayISO={todayISO}
                      onSaveBuses={persistViewBuses}
                      onLocalRenameBuses={(updated) => setViewBusItem(prev => ({ ...prev, bus_seats: updated }))}
                      onOpenWhatsApp={openWhatsAppComposer}
                    />
                  </div>
                </div>
              )}
            </div>

            {printBusState && (
              <PrintBusModal
                printState={printBusState}
                setPrintState={setPrintBusState}
                localUsers={localUsers}
                priest={priest}
              />
            )}
          </div>
        )}

        {activeCard === 'cases' && (() => {
          const casesMenuCards = [
            applyCardOverride({
              id: 'priest_cases_search',
              view: 'search',
              icon: '🔎',
              title: `بحث الحالة / العيلة (${families.length})`,
              desc: 'الاسم الرباعي، الموبايل، العنوان، التقييم، المرفقات، وطباعة شيت رسمي',
              color: 'border-emerald-200 bg-white'
            }, 'cases'),
            applyCardOverride({
              id: 'priest_cases_cats',
              view: 'categories',
              icon: '📂',
              title: `التصنيفات (${categoryNames.length})`,
              desc: 'حالات مستترة، إخوة الرب، متوسطة، مستقرة',
              color: 'border-amber-200 bg-white'
            }, 'cases'),
            applyCardOverride({
              id: 'priest_cases_add',
              view: 'add',
              icon: '➕',
              title: 'إضافة حالة جديدة',
              desc: 'رب الأسرة، الزوجة، الأولاد، الاحتياجات، والمرفقات',
              color: 'border-blue-200 bg-white'
            }, 'cases')
          ].filter(c => c.isActive !== false && isCardAllowedForRole(c.allowedRoles, priest?.role || 'priest', priest?.role === 'admin'));

          return (
            <div className="space-y-4">
              {renderTopBar('🔍 بحث الحالة / العيلة والمرفقات')}

              {pendingHiddenReqsCount > 0 && (
                <div className="bg-amber-50 border-2 border-amber-400 rounded-3xl p-4 space-y-2.5 shadow-sm">
                  <strong className="text-sm font-black text-amber-950 block">📩 طلبات تعديل أو إضافة على الأسر المستترة ({pendingHiddenReqsCount} معلق)</strong>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {hiddenEditRequests.filter(r => r.status !== 'done').map(req => (
                      <div key={req.id} className="bg-white p-3 rounded-2xl border border-amber-200 flex justify-between items-start gap-2 text-xs">
                        <div>
                          <strong className="text-gray-900 block">{req.family_head_name || 'أسرة مستترة'}</strong>
                          <span className="text-amber-900 block">من الخادم: {req.requested_by_name || 'خادم أسرة مستترة'}</span>
                          {req.note && <p className="text-gray-700 mt-0.5">{req.note}</p>}
                        </div>
                        <button type="button" onClick={() => handleMarkHiddenRequestDone(req)} className="px-2.5 py-1.5 bg-emerald-700 text-white rounded-xl text-[11px] font-black flex items-center gap-1 shrink-0 cursor-pointer">
                          <CheckCircle2 size={13} /> تم المراجعة
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {casesSubView === 'menu' && (
                <div className="grid sm:grid-cols-3 gap-4">
                  {casesMenuCards.map(cc => (
                    <button
                      key={cc.id}
                      type="button"
                      onClick={() => {
                        if (cc.view === 'search') {
                          setSearchCatFilter('all');
                          setCaseSearch('');
                          setCasesSubView('search');
                        } else if (cc.view === 'add') {
                          setEditingFamId(null);
                          setFamForm(emptyFam);
                          setCasesSubView('add');
                        } else {
                          setCasesSubView(cc.view);
                        }
                      }}
                      className={`bg-white border-2 ${cc.color} hover:border-[#7a1c24] p-4 md:p-6 rounded-3xl text-right shadow-sm space-y-2 transition cursor-pointer`}
                    >
                      <span className="text-4xl block">{cc.icon}</span>
                      <h3 className="text-lg font-black text-gray-900">{cc.title}</h3>
                      <p className="text-sm text-gray-600">{cc.desc}</p>
                    </button>
                  ))}
                </div>
              )}

              {casesSubView === 'categories' && (
                <div className="space-y-4">
                  <button type="button" onClick={() => { setSelectedCategoryName(null); setCasesSubView('menu'); }} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm">← رجوع لكروت بحث الحالة</button>
                  {!selectedCategoryName ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {categoryNames.map(cat => (
                        <button type="button" key={cat.id} onClick={() => setSelectedCategoryName(cat.name)} className="bg-white p-3.5 md:p-5 rounded-3xl border-2 hover:border-[#7a1c24] text-right shadow-sm space-y-1.5 cursor-pointer">
                          <span className="text-3xl">{cat.icon || '📂'}</span><h3 className="text-lg font-black">{cat.name}</h3>
                          <p className="text-sm text-gray-600">{families.filter(f => f.poverty_level === cat.name).length} أسرة</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button type="button" onClick={() => setSelectedCategoryName(null)} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm">← كل التصنيفات</button>
                      <h3 className="text-lg font-black text-[#7a1c24]">{selectedCategoryName}</h3>
                      {families.filter(f => f.poverty_level === selectedCategoryName).map(f => {
                        const atts = familyAttachments.filter(a => a.family_id === f.id);
                        return (
                          <div key={f.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center gap-2">
                            <div><strong>#{f.case_number} — {f.head_name}</strong><p className="text-sm text-gray-600">📍 {f.area} • 📞 {f.phone} • 📎 {atts.length} مرفق</p></div>
                            <div className="flex gap-1.5">
                              <button type="button" onClick={() => setInspectFamilyAttachments(f)} className="px-3 py-1.5 bg-indigo-50 text-indigo-900 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"><Paperclip size={13} /> المرفقات ({atts.length})</button>
                              <button type="button" onClick={() => openEditFamily(f)} className="px-3 py-1.5 bg-gray-100 rounded-xl font-bold text-xs">تعديل</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {casesSubView === 'search' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <button type="button" onClick={() => setCasesSubView('menu')} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm">← رجوع لكروت بحث الحالة</button>
                    <button type="button" onClick={() => window.print()} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 text-xs"><Printer size={15} /> طباعة شيت رسمي</button>
                  </div>
                  <div className="bg-white p-4 rounded-3xl border space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => setSearchCatFilter('all')} className={`px-3 py-1.5 rounded-xl font-bold text-xs ${searchCatFilter === 'all' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100'}`}>الكل ({families.length})</button>
                      {categoryNames.map(cat => <button type="button" key={cat.id} onClick={() => setSearchCatFilter(cat.name)} className={`px-3 py-1.5 rounded-xl font-bold text-xs ${searchCatFilter === cat.name ? 'bg-[#7a1c24] text-white' : 'bg-gray-100'}`}>{cat.name}</button>)}
                    </div>
                    <input placeholder="ابحث بالاسم الرباعي، رقم التليفون، العنوان، أو الاحتياج..." className="w-full p-2.5 border rounded-xl" value={caseSearch} onChange={e => setCaseSearch(e.target.value)} />
                  </div>

                  {families.filter(f => (searchCatFilter === 'all' || f.poverty_level === searchCatFilter) && (!caseSearch.trim() || JSON.stringify(f).toLowerCase().includes(caseSearch.toLowerCase()))).map(f => {
                    const atts = familyAttachments.filter(a => a.family_id === f.id);
                    return (
                      <div key={f.id} className="bg-white p-3.5 md:p-5 rounded-3xl border space-y-2 shadow-2xs">
                        <div className="flex flex-wrap justify-between items-start gap-2">
                          <div>
                            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-950 rounded-lg text-xs font-black ml-2">#{f.case_number}</span>
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded-lg text-xs font-black ml-2">{f.poverty_level}</span>
                            <strong className="text-lg">{f.head_name}</strong>
                            <p className="text-sm text-gray-700 mt-1">📞 {f.phone || '—'} • 📍 {f.area || '—'} ({f.area_type}) • 🏠 {f.housing}</p>
                            {f.spouse_full_name && <p className="text-sm text-gray-600">💍 الزوج/الزوجة: <strong>{f.spouse_full_name}</strong> • 📞 {f.spouse_phone || '—'}</p>}
                            {f.children?.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{f.children.map((c, idx) => <span key={idx} className="px-2.5 py-1 bg-[#fbfaf7] border rounded-xl text-xs">👶 {c.child_name} • {c.stage} {c.has_disability ? `• ♿ ${c.disability_details}` : ''}</span>)}</div>}
                            {f.house_needs && <p className="text-xs text-amber-900 bg-amber-50 p-2 rounded-xl mt-1.5">🛠️ احتياجات المنزل: {f.house_needs}</p>}
                            {f.case_notes && <p className="text-xs text-blue-900 bg-blue-50 p-2 rounded-xl mt-1">📝 ملاحظات: {f.case_notes}</p>}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <button type="button" onClick={() => setInspectFamilyAttachments(f)} className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 rounded-xl font-bold flex items-center gap-1 text-xs cursor-pointer"><Paperclip size={14} /> المرفقات ({atts.length})</button>
                            <button type="button" onClick={() => openEditFamily(f)} className="p-2.5 bg-gray-100 rounded-xl cursor-pointer"><Edit3 size={15} /></button>
                            <button type="button" onClick={() => deleteFamily(f.id)} className="p-2.5 bg-red-50 text-red-700 rounded-xl cursor-pointer"><Trash2 size={15} /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {casesSubView === 'add' && (
                <div className="space-y-4">
                  <button type="button" onClick={() => { setEditingFamId(null); setFamForm(emptyFam); setCasesSubView('menu'); }} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm">← رجوع لكروت بحث الحالة</button>
                  <form onSubmit={handleSaveFamily} className="bg-white p-3.5 md:p-5 rounded-3xl border space-y-4 font-bold">
                    <h3 className="text-base font-black text-[#7a1c24]">{editingFamId ? 'تعديل ملف الأسرة' : 'إضافة ملف أسرة جديدة'}</h3>

                    <div className="bg-[#fbfaf7] p-3.5 rounded-2xl border space-y-2.5">
                      <div className="text-xs text-[#7a1c24] font-black">① رب الأسرة</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <input required placeholder="الاسم الأول *" className="p-2.5 border rounded-xl bg-white" value={famForm.head_first} onChange={e => setFamForm({ ...famForm, head_first: e.target.value })} />
                        <input required placeholder="الثاني *" className="p-2.5 border rounded-xl bg-white" value={famForm.head_second} onChange={e => setFamForm({ ...famForm, head_second: e.target.value })} />
                        <input placeholder="الثالث" className="p-2.5 border rounded-xl bg-white" value={famForm.head_third} onChange={e => setFamForm({ ...famForm, head_third: e.target.value })} />
                        <input placeholder="الرابع" className="p-2.5 border rounded-xl bg-white" value={famForm.head_fourth} onChange={e => setFamForm({ ...famForm, head_fourth: e.target.value })} />
                      </div>
                      <div className="grid sm:grid-cols-4 gap-2">
                        <input type="tel" placeholder="الموبايل" className="p-2.5 border rounded-xl bg-white" value={famForm.phone} onChange={e => setFamForm({ ...famForm, phone: e.target.value })} />
                        <input type="date" className="p-2.5 border rounded-xl bg-white" value={famForm.dob} onChange={e => setFamForm({ ...famForm, dob: e.target.value })} />
                        <input placeholder="المؤهل" className="p-2.5 border rounded-xl bg-white" value={famForm.head_qualification} onChange={e => setFamForm({ ...famForm, head_qualification: e.target.value })} />
                        <input placeholder="الوظيفة" className="p-2.5 border rounded-xl bg-white" value={famForm.job} onChange={e => setFamForm({ ...famForm, job: e.target.value })} />
                      </div>
                    </div>

                    <div className="bg-[#fbfaf7] p-3.5 rounded-2xl border space-y-2.5">
                      <div className="text-xs text-[#7a1c24] font-black">② الزوج / الزوجة</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <input placeholder="الأول" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_first} onChange={e => setFamForm({ ...famForm, spouse_first: e.target.value })} />
                        <input placeholder="الثاني" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_second} onChange={e => setFamForm({ ...famForm, spouse_second: e.target.value })} />
                        <input placeholder="الثالث" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_third} onChange={e => setFamForm({ ...famForm, spouse_third: e.target.value })} />
                        <input placeholder="الرابع" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_fourth} onChange={e => setFamForm({ ...famForm, spouse_fourth: e.target.value })} />
                      </div>
                      <div className="grid sm:grid-cols-4 gap-2">
                        <input type="tel" placeholder="موبايل الزوج/الزوجة" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_phone} onChange={e => setFamForm({ ...famForm, spouse_phone: e.target.value })} />
                        <input type="date" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_dob} onChange={e => setFamForm({ ...famForm, spouse_dob: e.target.value })} />
                        <input placeholder="المؤهل" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_qualification} onChange={e => setFamForm({ ...famForm, spouse_qualification: e.target.value })} />
                        <input placeholder="الوظيفة" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_job} onChange={e => setFamForm({ ...famForm, spouse_job: e.target.value })} />
                      </div>
                    </div>

                    <div className="bg-[#fbfaf7] p-3.5 rounded-2xl border space-y-2.5">
                      <div className="text-xs text-[#7a1c24] font-black">③ الأولاد</div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <input placeholder="اسم الابن/الابنة" className="p-2 border rounded-xl bg-white" value={tempChild.child_name} onChange={e => setTempChild({ ...tempChild, child_name: e.target.value })} />
                        <input type="date" className="p-2 border rounded-xl bg-white" value={tempChild.dob} onChange={e => setTempChild({ ...tempChild, dob: e.target.value })} />
                        <input placeholder="المرحلة/العمل" className="p-2 border rounded-xl bg-white" value={tempChild.stage} onChange={e => setTempChild({ ...tempChild, stage: e.target.value })} />
                        <select className="p-2 border rounded-xl bg-white" value={tempChild.marital_status} onChange={e => setTempChild({ ...tempChild, marital_status: e.target.value })}><option>أعزب</option><option>متزوج</option><option>مطلق/أرمل</option></select>
                        <button type="button" onClick={() => { if (tempChild.child_name) { setFamForm({ ...famForm, children: [...(famForm.children || []), tempChild] }); setTempChild({ child_name: '', dob: '', stage: '', marital_status: 'أعزب', has_disability: false, disability_details: '' }); } }} className="bg-amber-600 text-white rounded-xl p-2 cursor-pointer">+ إضافة ابن</button>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={tempChild.has_disability} onChange={e => setTempChild({ ...tempChild, has_disability: e.target.checked })} />
                        <span>ذوو همم / حالة صحية خاصة</span>
                        {tempChild.has_disability && <input placeholder="تفاصيل الحالة..." className="p-1.5 border rounded-lg bg-white text-xs" value={tempChild.disability_details} onChange={e => setTempChild({ ...tempChild, disability_details: e.target.value })} />}
                      </label>
                      {(famForm.children || []).map((c, i) => (
                        <div key={i} className="flex justify-between items-center bg-white p-2 rounded-xl border text-xs"><span>• {c.child_name} ({c.stage})</span><button type="button" onClick={() => setFamForm({ ...famForm, children: famForm.children.filter((_, idx) => idx !== i) })} className="text-red-600">حذف</button></div>
                      ))}
                    </div>

                    <div className="bg-[#fbfaf7] p-3.5 rounded-2xl border space-y-2.5">
                      <div className="text-xs text-[#7a1c24] font-black">④ السكن والتقييم والمصروفات</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <input placeholder="المنطقة / الشارع" className="p-2.5 border rounded-xl bg-white" value={famForm.area} onChange={e => setFamForm({ ...famForm, area: e.target.value })} />
                        <select className="p-2.5 border rounded-xl bg-white" value={famForm.area_type} onChange={e => setFamForm({ ...famForm, area_type: e.target.value })}><option>منطقة شعبية</option><option>عشوائية</option><option>متوسطة</option><option>راقية</option></select>
                        <select className="p-2.5 border rounded-xl bg-white" value={famForm.poverty_level} onChange={e => setFamForm({ ...famForm, poverty_level: e.target.value })}>{categoryNames.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                        <select className="p-2.5 border rounded-xl bg-white" value={famForm.housing} onChange={e => setFamForm({ ...famForm, housing: e.target.value })}><option>إيجار جديد</option><option>إيجار قديم</option><option>تمليك</option><option>مشاركة سكن</option></select>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 items-center">
                        <input type="number" placeholder="مصروفات شهرية (ج.م)" className="p-2.5 border rounded-xl bg-white" value={famForm.monthly_expenses || ''} onChange={e => setFamForm({ ...famForm, monthly_expenses: e.target.value })} />
                        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={famForm.needs_monthly_aid} onChange={e => setFamForm({ ...famForm, needs_monthly_aid: e.target.checked })} /> مساعدة شهرية ثابتة</label>
                        {famForm.needs_monthly_aid && <input type="number" placeholder="قيمة المساعدة الشهرية" className="p-2.5 border rounded-xl bg-white" value={famForm.monthly_aid_amount || ''} onChange={e => setFamForm({ ...famForm, monthly_aid_amount: e.target.value })} />}
                      </div>
                      <input placeholder="احتياجات المنزل..." className="w-full p-2.5 border rounded-xl bg-white" value={famForm.house_needs} onChange={e => setFamForm({ ...famForm, house_needs: e.target.value })} />
                      <textarea rows="2" placeholder="ملاحظات الحالة..." className="w-full p-2.5 border rounded-xl bg-white" value={famForm.case_notes} onChange={e => setFamForm({ ...famForm, case_notes: e.target.value })} />
                    </div>

                    <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-200 space-y-2.5">
                      <div className="text-xs text-indigo-950 font-black">⑤ المرفقات والصور (بطاقة، عقد إيجار، تحاليل وأشعة، إيصالات)</div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <select className="p-2.5 border rounded-xl bg-white text-xs" value={selectedUploadType} onChange={e => setSelectedUploadType(e.target.value)}>
                          {ATTACHMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <label className="px-3.5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs flex items-center gap-1.5 cursor-pointer">
                          <Upload size={14} /> {uploadingAttach ? 'جاري الرفع...' : 'اختيار صورة / ملف'}
                          <input type="file" accept="image/*,.pdf" disabled={uploadingAttach} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFamilyAttachment(f, selectedUploadType, editingFamId || null); e.target.value = ''; }} />
                        </label>
                      </div>
                      {!editingFamId && (famForm.pendingAttachments || []).map(a => (
                        <div key={a.tempId} className="flex justify-between items-center bg-white p-2 rounded-xl border text-xs">
                          <span>📎 <strong>{a.attachment_type}</strong>: {a.file_name}</span>
                          <button type="button" onClick={() => handleDeleteAttachment(a)} className="text-red-600">حذف</button>
                        </div>
                      ))}
                      {editingFamId && familyAttachments.filter(a => a.family_id === editingFamId).map(a => (
                        <div key={a.id} className="flex justify-between items-center bg-white p-2 rounded-xl border text-xs">
                          <span>📎 <strong>{a.attachment_type}</strong>: {a.file_name}</span>
                          <div className="flex gap-2">
                            {a.file_url && <a href={a.file_url} target="_blank" rel="noreferrer" className="text-indigo-700 underline flex items-center gap-0.5"><ExternalLink size={12} /> عرض</a>}
                            <button type="button" onClick={() => handleDeleteAttachment(a)} className="text-red-600">حذف</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button type="submit" className="px-6 py-3 bg-[#7a1c24] text-white rounded-xl cursor-pointer">{editingFamId ? 'حفظ تعديلات الأسرة' : 'حفظ الأسرة'}</button>
                  </form>
                </div>
              )}

              {inspectFamilyAttachments && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
                  <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl p-4 md:p-6 space-y-4 font-bold max-h-[90dvh] overflow-y-auto text-sm">
                    <div className="flex justify-between items-center border-b pb-3">
                      <div><h3 className="text-base font-black text-indigo-950">📎 مرفقات أسرة: {inspectFamilyAttachments.head_name}</h3><p className="text-xs text-gray-500">بطاقة • عقد إيجار • تحاليل وأشعة • إيصالات</p></div>
                      <button type="button" onClick={() => setInspectFamilyAttachments(null)} className="p-2 bg-gray-100 rounded-xl cursor-pointer"><X size={18} /></button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center bg-indigo-50/60 p-3 rounded-2xl border border-indigo-200">
                      <select className="p-2 border rounded-xl bg-white text-xs" value={selectedUploadType} onChange={e => setSelectedUploadType(e.target.value)}>{ATTACHMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                      <label className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs flex items-center gap-1.5 cursor-pointer">
                        <Upload size={14} /> {uploadingAttach ? 'جاري الرفع...' : '+ رفع مرفق جديد'}
                        <input type="file" accept="image/*,.pdf" disabled={uploadingAttach} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFamilyAttachment(f, selectedUploadType, inspectFamilyAttachments.id); e.target.value = ''; }} />
                      </label>
                    </div>
                    <div className="space-y-2.5">
                      {familyAttachments.filter(a => a.family_id === inspectFamilyAttachments.id).length === 0 ? (
                        <div className="p-4 md:p-6 text-center text-gray-400 border rounded-2xl text-xs">لا توجد مرفقات محفوظة لهذه الأسرة حتى الآن.</div>
                      ) : familyAttachments.filter(a => a.family_id === inspectFamilyAttachments.id).map(att => (
                        <div key={att.id} className="p-3 bg-[#fbfaf7] rounded-2xl border flex flex-wrap justify-between items-center gap-2 text-xs">
                          <div>
                            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-950 rounded-lg font-black ml-2">{att.attachment_type}</span>
                            <strong>{att.file_name}</strong>
                            {att.created_at && <span className="text-gray-400 block mt-0.5">{String(att.created_at).split('T')[0]}</span>}
                          </div>
                          <div className="flex gap-1.5">
                            {att.file_url && <a href={att.file_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl flex items-center gap-1"><Eye size={13} /> معاينة</a>}
                            <button type="button" onClick={() => handleDeleteAttachment(att)} className="p-2 bg-red-50 text-red-700 rounded-xl"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {activeCard === 'edu_center' && (
          <div className="space-y-4">
            {renderTopBar('🎓 المركز التعليمي')}
            <EducationalCenterManager currentUser={priest} isPriestView={true} />
          </div>
        )}

        {activeCard === 'joseph_arimathea' && (
          <div className="space-y-4">
            {renderTopBar('🕊️ خدمة يوسف الرامي (حالات الوفاة والطقوس والصناديق ومكان الدفن)')}
            <JosephArimatheaManager currentUser={priest} isPriestView={true} onRefreshAll={loadPriestData} />
          </div>
        )}

        {activeCard.startsWith('custom:') && (() => {
          const cid = activeCard.replace('custom:', '');
          const cc = customCards.find(x => x.id === cid);
          const entries = customEntries.filter(x => x.card_id === cid);
          return (
            <div className="space-y-4">
              {renderTopBar(`${cc?.card_icon || '📌'} ${cc?.card_title || 'كارت إضافي'}`)}
              {cc?.description && <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl text-sm">{cc.description}</div>}
              <form onSubmit={async e => { e.preventDefault(); if (!customEntryForm.title) return; const { data, error } = await supabase.from('priest_custom_entries').insert([{ card_id: cid, priest_id: priest.id, title: customEntryForm.title, entry_date: customEntryForm.entry_date || null, details: customEntryForm.details }]).select().single(); if (!error && data) { setCustomEntries([data, ...entries]); setCustomEntryForm({ title: '', entry_date: '', details: '' }); } }} className="bg-white p-4 rounded-3xl border space-y-2.5 font-bold">
                <div className="grid sm:grid-cols-2 gap-2"><input required placeholder="العنوان *" className="p-2.5 border rounded-xl" value={customEntryForm.title} onChange={e => setCustomEntryForm({ ...customEntryForm, title: e.target.value })} /><input type="date" className="p-2.5 border rounded-xl" value={customEntryForm.entry_date} onChange={e => setCustomEntryForm({ ...customEntryForm, entry_date: e.target.value })} /></div>
                <textarea rows="2" placeholder="التفاصيل..." className="w-full p-2.5 border rounded-xl font-normal" value={customEntryForm.details} onChange={e => setCustomEntryForm({ ...customEntryForm, details: e.target.value })} />
                <button type="submit" className="px-5 py-2.5 bg-[#7a1c24] text-white rounded-xl cursor-pointer">+ إضافة سجل</button>
              </form>
              {entries.map(en => {
                const parsed = parseDynamicEntry(en);
                return (
                  <div key={en.id} className="bg-white p-4 rounded-2xl border flex justify-between items-start gap-2">
                    <div>
                      <strong>{en.title}</strong> {en.entry_date && `(${en.entry_date})`}
                      {parsed.field_label && parsed.field_value && (
                        <span className="mr-2 px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded-lg text-xs font-bold">
                          {parsed.field_label}: {parsed.field_value}
                        </span>
                      )}
                      {parsed.text && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{parsed.text}</p>}
                    </div>
                    <button type="button" onClick={async () => { const { error } = await supabase.from('priest_custom_entries').delete().eq('id', en.id); if (!error) setCustomEntries(customEntries.filter(x => x.id !== en.id)); }} className="p-2 bg-red-50 text-red-700 rounded-xl"><Trash2 size={15} /></button>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {renderGlobalModals()}
    </div>
  );
}
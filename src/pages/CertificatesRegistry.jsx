
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toCopticDate } from '../utils/copticDate';
import {
  Search, Printer, Plus, Trash2, Award, Droplets, X,
  SlidersHorizontal, Save, ShieldCheck, Lock, Edit3,
  AlertTriangle, CheckCircle2, Users, RefreshCw
} from 'lucide-react';

const DEACON_RANKS = [
  'أبصالتس (مرتل)',
  'اغنسطس (قارئ)',
  'إبصاديا (مساعد شماس)',
  'دياكون (شماس كامل)',
  'أرشيدياكون (رئيس شمامسة)'
];

const CLEARANCE_MARITAL_OPTIONS = [
  'أعزب / لم يسبق له الزواج',
  'آنسة / لم يسبق لها الزواج',
  'مخطوب / مخطوبة',
  'متزوج / متزوجة',
  'أرمل / أرملة',
  'حاصل على تصريح زواج ثانٍ من المجلس الإكليريكي'
];

const CERT_DESIGN_KEY = 'church_cert_design_prefs_v1';

const DEFAULT_DESIGN = {
  fontSize: 'large',
  fontFamily: 'cairo',
  themeColor: '#7a1c24',
  accentColor: '#b8892b',
  borderStyle: 'double',
  baptismTitle: 'شهادة معمودية مقدسة',
  deaconTitlePrefix: 'شهادة',
  clearanceTitle: 'شهادة خلو موانع للزواج',
  baptismIntro: 'بأنه بنعمة ربنا يسوع المسيح قد تم عماد',
  deaconIntro: 'بوضع اليد الرسولي ونعمة الروح القدس، تشهد الكنيسة بأنه قد تمت',
  clearanceIntro: 'تشهد الكنيسة بعد البحث والتحري في السجلات الكنسية أنه لا يوجد أي مانع كنسي أو شرعي يمنع من إتمام سر الزيجة المقدس لـ',
  baptismSigRight: 'توقيع الأب الكاهن المعمد',
  baptismSigLeft: 'خاتم الكنيسة',
  deaconSigRight: 'توقيع نيافة الأب الأسقف',
  deaconSigLeft: 'خاتم الإيبارشية / الكنيسة',
  clearanceSigRight: 'توقيع الأب الكاهن المختص',
  clearanceSigLeft: 'خاتم الكنيسة والإيبارشية'
};

const FONT_PRESETS = {
  medium: {
    diocese: 'text-base sm:text-lg',
    church: 'text-sm sm:text-base',
    record: 'text-xs sm:text-sm',
    title: 'text-2xl sm:text-3xl',
    intro: 'text-sm sm:text-base',
    mainName: 'text-lg sm:text-xl',
    fields: 'text-sm sm:text-base',
    sig: 'text-xs sm:text-sm'
  },
  large: {
    diocese: 'text-lg sm:text-xl',
    church: 'text-base sm:text-lg',
    record: 'text-xs sm:text-sm',
    title: 'text-3xl sm:text-4xl',
    intro: 'text-base sm:text-lg',
    mainName: 'text-xl sm:text-2xl',
    fields: 'text-base sm:text-lg',
    sig: 'text-sm sm:text-base'
  },
  xlarge: {
    diocese: 'text-xl sm:text-2xl',
    church: 'text-lg sm:text-xl',
    record: 'text-sm sm:text-base',
    title: 'text-3xl sm:text-5xl',
    intro: 'text-lg sm:text-xl',
    mainName: 'text-2xl sm:text-3xl',
    fields: 'text-lg sm:text-xl',
    sig: 'text-base sm:text-lg'
  }
};

const normalizeArabicText = (val = '') =>
  String(val || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');

const normalizeDigits = (val = '') => String(val || '').replace(/\D/g, '');

const calcAgeYears = (dob) => {
  if (!dob) return null;
  const yrs = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return Number.isFinite(yrs) && yrs >= 0 ? yrs : null;
};

const classifyMarriageBucket = (maritalStr = '') => {
  const txt = normalizeArabicText(maritalStr);
  if (!txt) return 'unmarried';
  if (txt.includes('متزوج') || txt.includes('متزوجه')) return 'married';
  if (txt.includes('مخطوب')) return 'engaged';
  if (txt.includes('ارمل') || txt.includes('تصريح') || txt.includes('مطلق')) return 'other';
  return 'unmarried';
};

export default function CertificatesRegistry({ users = [], currentUser = null, onRefresh, initialTab = 'baptism' }) {
  const [tab, setTab] = useState(initialTab || 'baptism');
  const [searchQ, setSearchQ] = useState('');

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const [settings, setSettings] = useState({
    diocese_name: 'الكنيسة القبطية الأرثوذكسية',
    church_name: 'كنيستنا المباركة',
    logo_url: ''
  });
  const [baptisms, setBaptisms] = useState([]);
  const [ordinations, setOrdinations] = useState([]);
  const [clearances, setClearances] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // استعلام فوري بين جميع الآباء الكهنة + قاعدة بيانات الشباب والشابات
  const [verifyQuery, setVerifyQuery] = useState('');
  const [dirSubView, setDirSubView] = useState('directory'); // 'directory' | 'clearances_list'
  const [dirGenderFilter, setDirGenderFilter] = useState('all'); // 'all' | 'male' | 'female'
  const [dirClearanceFilter, setDirClearanceFilter] = useState('all'); // 'all' | 'issued' | 'not_issued'
  const [dirMarriageFilter, setDirMarriageFilter] = useState('all'); // 'all' | 'unmarried' | 'engaged' | 'married' | 'other'
  const [dirPriestFilter, setDirPriestFilter] = useState('all');

  const [printBaptism, setPrintBaptism] = useState(null);
  const [printOrdination, setPrintOrdination] = useState(null);
  const [printClearance, setPrintClearance] = useState(null);
  const [showDesignPanel, setShowDesignPanel] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [design, setDesign] = useState(() => {
    try {
      const saved = localStorage.getItem(CERT_DESIGN_KEY);
      return saved ? { ...DEFAULT_DESIGN, ...JSON.parse(saved) } : DEFAULT_DESIGN;
    } catch {
      return DEFAULT_DESIGN;
    }
  });

  const updateDesign = (patch) => {
    setDesign(prev => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(CERT_DESIGN_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const resetDesign = () => {
    setDesign(DEFAULT_DESIGN);
    try {
      localStorage.removeItem(CERT_DESIGN_KEY);
    } catch {
      // ignore
    }
  };

  const todayISO = new Date().toISOString().split('T')[0];

  const emptyBap = {
    child_full_name: '', baptism_name: '', gender: 'ذكر',
    dob: '', baptism_date: todayISO, father_name: '', mother_name: '',
    godparent_name: '', priest_name: currentUser?.full_name || '', church_name: '', phone: '', notes: ''
  };
  const [bapForm, setBapForm] = useState(emptyBap);

  const emptyOrd = {
    user_id: '', deacon_full_name: '', action_type: 'رسامة جديدة',
    deacon_rank: 'أبصالتس (مرتل)', ordination_date: todayISO,
    bishop_name: 'نيافة الأنبا ...', church_name: '', notes: ''
  };
  const [ordForm, setOrdForm] = useState(emptyOrd);

  const emptyClearance = {
    national_id: '',
    full_name: '',
    gender: 'ذكر',
    dob: '',
    phone: '',
    address: '',
    marital_status: CLEARANCE_MARITAL_OPTIONS[0],
    baptism_church: '',
    confession_father: '',
    fiance_name: '',
    fiance_national_id: '',
    issue_date: todayISO,
    church_name: '',
    priest_id: currentUser?.id || '',
    priest_name: currentUser?.full_name || '',
    purpose: 'إتمام سر الزيجة المقدس',
    notes: ''
  };
  const [clearanceForm, setClearanceForm] = useState(emptyClearance);
  const [editingClearanceNid, setEditingClearanceNid] = useState(null);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [st, logoRes, bp, or, cl] = await Promise.all([
        supabase.from('church_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('church_public_content').select('title, url').eq('kind', 'logo').limit(1).maybeSingle(),
        supabase.from('baptism_records').select('*').order('record_number', { ascending: false }),
        supabase.from('deacon_ordinations').select('*').order('record_number', { ascending: false }),
        supabase.from('impediment_clearances').select('*').order('record_number', { ascending: false })
      ]);
      setSettings(prev => ({
        diocese_name: st?.data?.diocese_name || prev.diocese_name,
        church_name: logoRes?.data?.title || st?.data?.church_name || prev.church_name,
        logo_url: logoRes?.data?.url || st?.data?.logo_url || ''
      }));
      if (bp.data) setBaptisms(bp.data);
      if (or.data) setOrdinations(or.data);
      if (!cl.error && cl.data) setClearances(cl.data);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // مزامنة لحظية بين جميع الآباء الكهنة عند إضافة أو تعديل أي شهادة خلو موانع
  useEffect(() => {
    if (!supabase || typeof supabase.channel !== 'function') return;
    const ch = supabase
      .channel('shared-clearances-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'impediment_clearances' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(ch);
      }
    };
  }, []);

  const priestsList = users.filter(u => u.role === 'priest');

  const findClearanceMatchesForPerson = ({ national_id = '', full_name = '', phone = '' }) => {
    const qNid = normalizeDigits(national_id);
    const qName = normalizeArabicText(full_name);
    const qPhone = normalizeDigits(phone);

    return clearances.filter(c => {
      const cNid = normalizeDigits(c.national_id);
      const cFianceNid = normalizeDigits(c.fiance_national_id);
      const cName = normalizeArabicText(c.full_name);
      const cFianceName = normalizeArabicText(c.fiance_name);
      const cPhone = normalizeDigits(c.phone);

      if (qNid.length >= 6 && (cNid === qNid || cFianceNid === qNid)) return true;
      if (qPhone.length >= 8 && cPhone && cPhone === qPhone) return true;
      if (qName.length >= 4 && (cName === qName || cFianceName === qName)) return true;
      return false;
    });
  };

  // تنبيه فوري أثناء كتابة البيانات في فورم خلو الموانع
  const liveFormMatches = useMemo(() => {
    if (editingClearanceNid) return [];
    const qNid = normalizeDigits(clearanceForm.national_id);
    const qName = normalizeArabicText(clearanceForm.full_name);
    if (qNid.length < 6 && qName.length < 5) return [];
    return findClearanceMatchesForPerson({
      national_id: qNid,
      full_name: qName,
      phone: clearanceForm.phone
    });
  }, [clearanceForm.national_id, clearanceForm.full_name, clearanceForm.phone, clearances, editingClearanceNid]);

  // نتائج الاستعلام الفوري المشترك بين جميع الكهنة
  const activeVerifyInput = verifyQuery.trim() || searchQ.trim();
  const verifyResults = useMemo(() => {
    const raw = activeVerifyInput;
    if (raw.length < 2) return [];
    const qNorm = normalizeArabicText(raw);
    const qDigits = normalizeDigits(raw);

    return clearances.filter(c => {
      if (qDigits.length >= 4) {
        if (
          normalizeDigits(c.national_id).includes(qDigits) ||
          normalizeDigits(c.fiance_national_id).includes(qDigits) ||
          normalizeDigits(c.phone).includes(qDigits) ||
          String(c.record_number).includes(qDigits)
        ) {
          return true;
        }
      }
      return (
        normalizeArabicText(c.full_name).includes(qNorm) ||
        normalizeArabicText(c.fiance_name).includes(qNorm) ||
        normalizeArabicText(c.priest_name).includes(qNorm)
      );
    });
  }, [activeVerifyInput, clearances]);

  // قاعدة بيانات الشباب والشابات وحالة الزواج وخلو الموانع الموحدة
  const youthAndClearanceDirectory = useMemo(() => {
    const rowsMap = new Map();

    // 1) كل مسجلي الكنيسة (باستثناء الآباء الكهنة والأدمن)
    users
      .filter(u => u.role !== 'priest' && u.role !== 'admin')
      .forEach(u => {
        const matchedClearances = findClearanceMatchesForPerson({
          national_id: u.national_id || '',
          full_name: u.full_name || '',
          phone: u.phone || ''
        });
        const primaryClearance = matchedClearances[0] || null;
        const effectiveMarital = primaryClearance?.marital_status || u.marital_status || 'أعزب / لم يسبق له الزواج';
        const age = calcAgeYears(u.dob);

        rowsMap.set(`usr:${u.id}`, {
          rowKey: `usr:${u.id}`,
          userId: u.id,
          national_id: primaryClearance?.national_id || u.national_id || '',
          full_name: u.full_name || '—',
          gender: u.gender || (primaryClearance?.gender || 'ذكر'),
          dob: u.dob || primaryClearance?.dob || '',
          age,
          phone: u.phone || primaryClearance?.phone || '',
          address: u.address || primaryClearance?.address || '',
          stage: u.detailed_stage || u.service_stage || u.assigned_class || '',
          confession_father: u.confession_father || primaryClearance?.confession_father || '',
          marital_status: effectiveMarital,
          marriageBucket: classifyMarriageBucket(effectiveMarital),
          clearance: primaryClearance,
          allClearances: matchedClearances
        });
      });

    // 2) إضافة أي سجل موجود في خلو الموانع وغير مربوط بحساب عضو في church_users
    clearances.forEach(c => {
      const alreadyLinked = Array.from(rowsMap.values()).some(
        r =>
          (r.national_id && normalizeDigits(r.national_id) === normalizeDigits(c.national_id)) ||
          (normalizeArabicText(r.full_name) === normalizeArabicText(c.full_name))
      );
      if (!alreadyLinked) {
        rowsMap.set(`clr:${c.national_id}`, {
          rowKey: `clr:${c.national_id}`,
          userId: null,
          national_id: c.national_id,
          full_name: c.full_name,
          gender: c.gender || 'ذكر',
          dob: c.dob || '',
          age: calcAgeYears(c.dob),
          phone: c.phone || '',
          address: c.address || '',
          stage: 'سجل خلو موانع',
          confession_father: c.confession_father || '',
          marital_status: c.marital_status || 'أعزب / لم يسبق له الزواج',
          marriageBucket: classifyMarriageBucket(c.marital_status),
          clearance: c,
          allClearances: [c]
        });
      }
    });

    return Array.from(rowsMap.values());
  }, [users, clearances]);

  const issuingPriestsNames = useMemo(() => {
    const set = new Set();
    priestsList.forEach(p => { if (p.full_name) set.add(p.full_name); });
    clearances.forEach(c => { if (c.priest_name) set.add(c.priest_name); });
    return Array.from(set);
  }, [priestsList, clearances]);

  const filteredDirectory = useMemo(() => {
    const qNorm = normalizeArabicText(searchQ);
    const qDigits = normalizeDigits(searchQ);

    return youthAndClearanceDirectory.filter(row => {
      if (dirGenderFilter === 'male' && row.gender === 'أنثى') return false;
      if (dirGenderFilter === 'female' && row.gender !== 'أنثى') return false;

      if (dirClearanceFilter === 'issued' && !row.clearance) return false;
      if (dirClearanceFilter === 'not_issued' && row.clearance) return false;

      if (dirMarriageFilter !== 'all' && row.marriageBucket !== dirMarriageFilter) return false;

      if (dirPriestFilter !== 'all') {
        if (!row.clearance) return false;
        if (normalizeArabicText(row.clearance.priest_name) !== normalizeArabicText(dirPriestFilter)) return false;
      }

      if (!searchQ.trim()) return true;
      if (qDigits.length >= 4) {
        if (
          normalizeDigits(row.national_id).includes(qDigits) ||
          normalizeDigits(row.phone).includes(qDigits) ||
          (row.clearance && String(row.clearance.record_number).includes(qDigits))
        ) {
          return true;
        }
      }
      return (
        normalizeArabicText(row.full_name).includes(qNorm) ||
        normalizeArabicText(row.address).includes(qNorm) ||
        normalizeArabicText(row.stage).includes(qNorm) ||
        normalizeArabicText(row.clearance?.priest_name || '').includes(qNorm)
      );
    });
  }, [
    youthAndClearanceDirectory,
    dirGenderFilter,
    dirClearanceFilter,
    dirMarriageFilter,
    dirPriestFilter,
    searchQ
  ]);

  const saveBaptism = async (e) => {
    e.preventDefault();
    const payload = {
      ...bapForm,
      dob: bapForm.dob || null,
      coptic_baptism_date: toCopticDate(bapForm.baptism_date),
      church_name: bapForm.church_name || settings.church_name
    };
    const { data, error } = await supabase.from('baptism_records').insert([payload]).select().single();
    if (!error && data) {
      setBaptisms([data, ...baptisms]);
      setBapForm(emptyBap);
      setPrintBaptism(data);
      setShowDesignPanel(false);
    } else if (error) alert(error.message);
  };

  const handleSaveBaptismEdit = async () => {
    if (!printBaptism?.id) return;
    setSavingEdit(true);
    try {
      const payload = {
        child_full_name: printBaptism.child_full_name,
        baptism_name: printBaptism.baptism_name || '',
        gender: printBaptism.gender || 'ذكر',
        dob: printBaptism.dob || null,
        baptism_date: printBaptism.baptism_date,
        coptic_baptism_date: toCopticDate(printBaptism.baptism_date),
        father_name: printBaptism.father_name,
        mother_name: printBaptism.mother_name,
        godparent_name: printBaptism.godparent_name,
        priest_name: printBaptism.priest_name,
        church_name: printBaptism.church_name || settings.church_name
      };
      const { data, error } = await supabase
        .from('baptism_records')
        .update(payload)
        .eq('id', printBaptism.id)
        .select()
        .single();
      if (error) return alert('تعذر حفظ التعديل: ' + error.message);
      if (data) {
        setPrintBaptism(data);
        setBaptisms(prev => prev.map(b => (b.id === data.id ? data : b)));
        alert('تم تحديث بيانات الشهادة في السجل بنجاح ✅');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteBaptism = async (id) => {
    if (!confirm('حذف سجل المعمودية؟')) return;
    const { error } = await supabase.from('baptism_records').delete().eq('id', id);
    if (!error) setBaptisms(baptisms.filter(b => b.id !== id));
  };

  const saveOrdination = async (e) => {
    e.preventDefault();
    const payload = {
      ...ordForm,
      user_id: ordForm.user_id || null,
      coptic_ordination_date: toCopticDate(ordForm.ordination_date),
      church_name: ordForm.church_name || settings.church_name
    };
    const { data, error } = await supabase.from('deacon_ordinations').insert([payload]).select().single();
    if (!error && data) {
      if (ordForm.user_id) {
        await supabase
          .from('church_users')
          .update({
            is_deacon: true,
            deacon_rank: ordForm.deacon_rank
          })
          .eq('id', ordForm.user_id);
        onRefresh?.();
      }
      setOrdinations([data, ...ordinations]);
      setOrdForm(emptyOrd);
      setPrintOrdination(data);
      setShowDesignPanel(false);
    } else if (error) alert(error.message);
  };

  const handleSaveOrdinationEdit = async () => {
    if (!printOrdination?.id) return;
    setSavingEdit(true);
    try {
      const payload = {
        deacon_full_name: printOrdination.deacon_full_name,
        action_type: printOrdination.action_type,
        deacon_rank: printOrdination.deacon_rank,
        ordination_date: printOrdination.ordination_date,
        coptic_ordination_date: toCopticDate(printOrdination.ordination_date),
        bishop_name: printOrdination.bishop_name,
        church_name: printOrdination.church_name || settings.church_name
      };
      const { data, error } = await supabase
        .from('deacon_ordinations')
        .update(payload)
        .eq('id', printOrdination.id)
        .select()
        .single();
      if (error) return alert('تعذر حفظ التعديل: ' + error.message);
      if (data) {
        setPrintOrdination(data);
        setOrdinations(prev => prev.map(o => (o.id === data.id ? data : o)));
        alert('تم تحديث بيانات شهادة الشماسية بنجاح ✅');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteOrdination = async (id) => {
    if (!confirm('حذف سجل الشماسية؟')) return;
    const { error } = await supabase.from('deacon_ordinations').delete().eq('id', id);
    if (!error) setOrdinations(ordinations.filter(o => o.id !== id));
  };

  // ====== خلو الموانع (المفتاح الأساسي: رقم البطاقة الشخصية + تسلسل رقمي + ربط بين الكهنة) ======
  const saveClearance = async (e) => {
    e.preventDefault();
    const cleanNid = normalizeDigits(clearanceForm.national_id);

    if (editingClearanceNid) {
      const { national_id, record_number, created_at, ...updatable } = clearanceForm;
      const matchedPriest = priestsList.find(p => p.full_name === updatable.priest_name);
      const payload = {
        ...updatable,
        dob: updatable.dob || null,
        coptic_issue_date: toCopticDate(updatable.issue_date),
        church_name: updatable.church_name || settings.church_name,
        priest_id: matchedPriest?.id || updatable.priest_id || currentUser?.id || null,
        priest_name: (updatable.priest_name || currentUser?.full_name || '').trim()
      };
      const { data, error } = await supabase
        .from('impediment_clearances')
        .update(payload)
        .eq('national_id', editingClearanceNid)
        .select()
        .single();
      if (error) return alert('تعذر تعديل سجل خلو الموانع: ' + error.message);
      if (data) {
        setClearances(prev => prev.map(c => (c.national_id === editingClearanceNid ? data : c)));
        setEditingClearanceNid(null);
        setClearanceForm(emptyClearance);
        setPrintClearance(data);
        setShowDesignPanel(false);
      }
      return;
    }

    if (cleanNid.length !== 14) {
      return alert('رقم البطاقة الشخصية (الرقم القومي) يجب أن يتكون من 14 رقماً صحيحاً — وهو مفتاح أساسي لا يمكن تغييره بعد الحفظ.');
    }

    const existingByNid = clearances.find(c => normalizeDigits(c.national_id) === cleanNid);
    if (existingByNid) {
      return alert(
        `⚠️ لا يمكن الإصدار! رقم البطاقة الشخصية هذا مسجل بالفعل.\n` +
        `صدر له خلو موانع من: ${existingByNid.priest_name || 'أب كاهن بالكنيسة'}\n` +
        `بتاريخ: ${existingByNid.issue_date} • تسلسل #${existingByNid.record_number}`
      );
    }

    const existingByName = findClearanceMatchesForPerson({
      full_name: clearanceForm.full_name,
      phone: clearanceForm.phone
    });
    if (existingByName.length > 0) {
      const prevRec = existingByName[0];
      const proceed = confirm(
        `⚠️ تنبيه من السجل المشترك بين الآباء الكهنة:\n` +
        `يوجد سجل سابق مطابق لاسم أو تليفون (${prevRec.full_name})!\n` +
        `• صادر من: ${prevRec.priest_name || 'أب كاهن'}\n` +
        `• بتاريخ: ${prevRec.issue_date} (تسلسل #${prevRec.record_number})\n\n` +
        `هل أنت متأكد أنه شخص آخر مختلف وتريد المتابعة؟`
      );
      if (!proceed) return;
    }

    const matchedPriest = priestsList.find(p => p.full_name === clearanceForm.priest_name);
    const payload = {
      ...clearanceForm,
      national_id: cleanNid,
      dob: clearanceForm.dob || null,
      coptic_issue_date: toCopticDate(clearanceForm.issue_date),
      church_name: clearanceForm.church_name || settings.church_name,
      priest_id: matchedPriest?.id || currentUser?.id || null,
      priest_name: (clearanceForm.priest_name || currentUser?.full_name || '').trim()
    };

    const { data, error } = await supabase
      .from('impediment_clearances')
      .insert([payload])
      .select()
      .single();

    if (error) {
      alert('تعذر حفظ شهادة خلو الموانع: ' + error.message);
      return;
    }

    if (data) {
      setClearances(prev => [data, ...prev]);
      setClearanceForm(emptyClearance);
      setPrintClearance(data);
      setShowDesignPanel(false);
    }
  };

  const handleSaveClearanceEdit = async () => {
    if (!printClearance?.national_id) return;
    setSavingEdit(true);
    try {
      const payload = {
        full_name: printClearance.full_name,
        gender: printClearance.gender || 'ذكر',
        dob: printClearance.dob || null,
        phone: printClearance.phone || '',
        address: printClearance.address || '',
        marital_status: printClearance.marital_status || CLEARANCE_MARITAL_OPTIONS[0],
        baptism_church: printClearance.baptism_church || '',
        confession_father: printClearance.confession_father || '',
        fiance_name: printClearance.fiance_name || '',
        fiance_national_id: printClearance.fiance_national_id || '',
        issue_date: printClearance.issue_date,
        coptic_issue_date: toCopticDate(printClearance.issue_date),
        church_name: printClearance.church_name || settings.church_name,
        priest_name: printClearance.priest_name || '',
        purpose: printClearance.purpose || 'إتمام سر الزيجة المقدس',
        notes: printClearance.notes || ''
      };
      const { data, error } = await supabase
        .from('impediment_clearances')
        .update(payload)
        .eq('national_id', printClearance.national_id)
        .select()
        .single();
      if (error) return alert('تعذر حفظ التعديل: ' + error.message);
      if (data) {
        setPrintClearance(data);
        setClearances(prev => prev.map(c => (c.national_id === data.national_id ? data : c)));
        alert('تم تحديث بيانات شهادة خلو الموانع بنجاح ✅');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteClearance = async (nationalId) => {
    if (!confirm(`حذف سجل خلو الموانع للرقم القومي (${nationalId})؟`)) return;
    const { error } = await supabase
      .from('impediment_clearances')
      .delete()
      .eq('national_id', nationalId);
    if (!error) setClearances(prev => prev.filter(c => c.national_id !== nationalId));
  };

  const handleUpdateUserMaritalQuick = async (userId, nextMaritalStatus) => {
    if (!userId) return;
    const { error } = await supabase
      .from('church_users')
      .update({ marital_status: nextMaritalStatus })
      .eq('id', userId);
    if (error) {
      alert('تعذر تحديث الحالة: ' + error.message);
      return;
    }
    onRefresh?.();
  };

  const prefillClearanceFromRow = (row) => {
    setEditingClearanceNid(null);
    setClearanceForm({
      ...emptyClearance,
      national_id: row.national_id || '',
      full_name: row.full_name || '',
      gender: row.gender || 'ذكر',
      dob: row.dob || '',
      phone: row.phone || '',
      address: row.address || '',
      marital_status: row.marital_status || (row.gender === 'أنثى' ? 'آنسة / لم يسبق لها الزواج' : 'أعزب / لم يسبق له الزواج'),
      confession_father: row.confession_father || '',
      priest_id: currentUser?.id || '',
      priest_name: currentUser?.full_name || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const maleCandidates = users.filter(u => {
    const isMale = u.gender === 'ذكر' || u.gender !== 'أنثى';
    if (!isMale) return false;
    if (u.role === 'priest' || u.role === 'admin') return false;
    if (ordForm.action_type === 'ترقية رتبة') return Boolean(u.is_deacon);
    return true;
  });

  const filteredBaptisms = baptisms.filter(b =>
    (String(b.record_number) + ' ' + b.child_full_name + ' ' + b.father_name + ' ' + b.mother_name + ' ' + b.godparent_name).toLowerCase().includes(searchQ.toLowerCase())
  );

  const filteredOrdinations = ordinations.filter(o =>
    (String(o.record_number) + ' ' + o.deacon_full_name + ' ' + o.deacon_rank + ' ' + o.bishop_name).toLowerCase().includes(searchQ.toLowerCase())
  );

  const filteredClearances = clearances.filter(c =>
    (
      String(c.record_number) + ' ' +
      (c.national_id || '') + ' ' +
      (c.full_name || '') + ' ' +
      (c.fiance_name || '') + ' ' +
      (c.priest_name || '')
    ).toLowerCase().includes(searchQ.toLowerCase())
  );

  const fp = FONT_PRESETS[design.fontSize] || FONT_PRESETS.large;
  const certFontStyle = {
    fontFamily: design.fontFamily === 'amiri' ? "'Amiri', serif" : "'Cairo', system-ui, sans-serif"
  };

  return (
    <div className="space-y-4 text-xs" dir="rtl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');

        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          html, body {
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #fffdf9 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-cert, #printable-cert * {
            visibility: visible !important;
          }
          #printable-cert {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 9mm !important;
            box-sizing: border-box !important;
            background: #fffdf9 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            page-break-after: avoid !important;
            break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* التبويبات */}
      <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3 font-bold print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 sm:inline-flex gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setTab('baptism')}
            className={`px-4 py-2.5 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition ${
              tab === 'baptism' ? 'bg-[#7a1c24] text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Droplets size={16} /> سجل وشهادات المعمودية ({baptisms.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('deacons')}
            className={`px-4 py-2.5 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition ${
              tab === 'deacons' ? 'bg-[#7a1c24] text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Award size={16} /> سجل وشهادات الشمامسة ({ordinations.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('clearance')}
            className={`px-4 py-2.5 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition ${
              tab === 'clearance' ? 'bg-[#7a1c24] text-white shadow-sm' : 'bg-amber-50/40 border border-amber-300 text-amber-950 hover:bg-amber-50'
            }`}
          >
            <ShieldCheck size={16} /> سجل وكارت خلو الموانع ({clearances.length})
          </button>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={refreshing}
          className="px-3.5 py-2 bg-white border hover:bg-gray-50 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> تحديث السجل المشترك
        </button>
      </div>

      {/* شريط البحث العام */}
      <div className="relative print:hidden">
        <Search size={16} className="absolute right-3.5 top-3 text-gray-400" />
        <input
          placeholder="بحث برقم التسلسل / القيد أو الرقم القومي أو الاسم أو اسم الأب الكاهن..."
          className="w-full pr-10 pl-4 py-2.5 bg-white border border-gray-200 rounded-2xl outline-none focus:border-[#7a1c24] shadow-2xs"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
      </div>

      {/* 1. سجل المعمودية */}
      {tab === 'baptism' && (
        <div className="space-y-4 print:hidden">
          <form onSubmit={saveBaptism} className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 space-y-3 font-bold shadow-sm">
            <h3 className="text-sm font-black text-[#7a1c24]">🕊️ قيد معمودية جديدة واستخراج الشهادة</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <input required placeholder="اسم الطفل / الطفلة رباعي *" className="sm:col-span-2 p-2.5 border rounded-xl" value={bapForm.child_full_name} onChange={e => setBapForm({ ...bapForm, child_full_name: e.target.value })} />
              <input placeholder="اسم المعمودية (إن وجد)" className="p-2.5 border rounded-xl" value={bapForm.baptism_name} onChange={e => setBapForm({ ...bapForm, baptism_name: e.target.value })} />
              <select className="p-2.5 border rounded-xl bg-white" value={bapForm.gender} onChange={e => setBapForm({ ...bapForm, gender: e.target.value })}><option value="ذكر">ذكر</option><option value="أنثى">أنثى</option></select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div><label className="block text-[10px] text-gray-500 mb-0.5">تاريخ الميلاد</label><input type="date" className="w-full p-2.5 border rounded-xl" value={bapForm.dob} onChange={e => setBapForm({ ...bapForm, dob: e.target.value })} /></div>
              <div><label className="block text-[10px] text-gray-500 mb-0.5">تاريخ المعمودية *</label><input required type="date" className="w-full p-2.5 border rounded-xl" value={bapForm.baptism_date} onChange={e => setBapForm({ ...bapForm, baptism_date: e.target.value })} /></div>
              <div><label className="block text-[10px] text-gray-500 mb-0.5">اسم الأب رباعي *</label><input required className="w-full p-2.5 border rounded-xl" value={bapForm.father_name} onChange={e => setBapForm({ ...bapForm, father_name: e.target.value })} /></div>
              <div><label className="block text-[10px] text-gray-500 mb-0.5">اسم الأم رباعي *</label><input required className="w-full p-2.5 border rounded-xl" value={bapForm.mother_name} onChange={e => setBapForm({ ...bapForm, mother_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input required placeholder="اسم الإشبين *" className="p-2.5 border rounded-xl" value={bapForm.godparent_name} onChange={e => setBapForm({ ...bapForm, godparent_name: e.target.value })} />
              <div>
                <input required list="priests-datalist" placeholder="اسم الأب الكاهن المعمد *" className="w-full p-2.5 border rounded-xl" value={bapForm.priest_name} onChange={e => setBapForm({ ...bapForm, priest_name: e.target.value })} />
                <datalist id="priests-datalist">{priestsList.map(p => <option key={p.id} value={p.full_name} />)}</datalist>
              </div>
              <input placeholder="رقم الهاتف (للتواصل)" className="p-2.5 border rounded-xl" value={bapForm.phone} onChange={e => setBapForm({ ...bapForm, phone: e.target.value })} />
            </div>
            <button type="submit" className="w-full sm:w-auto px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl flex items-center justify-center gap-1.5 shadow cursor-pointer">
              <Plus size={15} /> حفظ القيد ومعاينة الشهادة
            </button>
          </form>

          <div className="grid gap-2.5">
            {filteredBaptisms.map(b => (
              <div key={b.id} className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 bg-gray-900 text-white rounded font-black text-[10px]">قيد #{b.record_number}</span>
                    <strong className="text-sm text-gray-900">{b.child_full_name}</strong>
                    <span className="text-gray-500">({b.gender})</span>
                  </div>
                  <p className="text-gray-600">
                    👨‍👦 الأب: {b.father_name} • 👩‍👦 الأم: {b.mother_name} • 🕯️ الإشبين: <strong>{b.godparent_name}</strong>
                  </p>
                  <p className="text-gray-400">📅 المعمودية: {b.baptism_date} ({b.coptic_baptism_date}) • ✝ المعمد: {b.priest_name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setPrintBaptism(b); setShowDesignPanel(false); }}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer size={14} /> طباعة وتعديل الشهادة
                  </button>
                  <button type="button" onClick={() => deleteBaptism(b.id)} className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl cursor-pointer">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. سجل رشومات وترقيات الشمامسة (ذكور فقط) */}
      {tab === 'deacons' && (
        <div className="space-y-4 print:hidden">
          <form onSubmit={saveOrdination} className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 space-y-3 font-bold shadow-sm">
            <h3 className="text-sm font-black text-[#7a1c24]">🕯️ قيد رشومات أو ترقية رتبة شماسية</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                className="p-2.5 border rounded-xl bg-blue-50/40"
                value={ordForm.user_id}
                onChange={e => {
                  const u = users.find(x => x.id === e.target.value);
                  setOrdForm({
                    ...ordForm,
                    user_id: e.target.value,
                    deacon_full_name: u?.full_name || ordForm.deacon_full_name
                  });
                }}
              >
                <option value="">-- اختر من المسجلين (ذكور فقط) --</option>
                {maleCandidates.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} {u.is_deacon ? `(${u.deacon_rank || 'شماس'})` : ''}
                  </option>
                ))}
              </select>

              <input
                required
                placeholder="اسم الشماس رباعي *"
                className="p-2.5 border rounded-xl"
                value={ordForm.deacon_full_name}
                onChange={e => setOrdForm({ ...ordForm, deacon_full_name: e.target.value })}
              />

              <select
                className="p-2.5 border rounded-xl bg-white"
                value={ordForm.action_type}
                onChange={e => setOrdForm({ ...ordForm, action_type: e.target.value })}
              >
                <option value="رسامة جديدة">رسامة جديدة</option>
                <option value="ترقية رتبة">ترقية رتبة شماسية</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select className="p-2.5 border rounded-xl bg-purple-50/40" value={ordForm.deacon_rank} onChange={e => setOrdForm({ ...ordForm, deacon_rank: e.target.value })}>
                {DEACON_RANKS.map((r, i) => <option key={i} value={r}>{r}</option>)}
              </select>
              <input required type="date" className="p-2.5 border rounded-xl" value={ordForm.ordination_date} onChange={e => setOrdForm({ ...ordForm, ordination_date: e.target.value })} />
              <input required placeholder="اسم نيافة الأب الأسقف المرشم *" className="p-2.5 border rounded-xl" value={ordForm.bishop_name} onChange={e => setOrdForm({ ...ordForm, bishop_name: e.target.value })} />
            </div>

            <button type="submit" className="w-full sm:w-auto px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl flex items-center justify-center gap-1.5 shadow cursor-pointer">
              <Plus size={15} /> حفظ القيد ومعاينة شهادة الشماسية
            </button>
          </form>

          <div className="grid gap-2.5">
            {filteredOrdinations.map(o => (
              <div key={o.id} className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 bg-gray-900 text-white rounded font-black text-[10px]">قيد #{o.record_number}</span>
                    <strong className="text-sm text-gray-900">{o.deacon_full_name}</strong>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded font-bold text-[10px]">{o.action_type}: {o.deacon_rank}</span>
                  </div>
                  <p className="text-gray-500">📅 {o.ordination_date} ({o.coptic_ordination_date}) • ✝ بيد: <strong>{o.bishop_name}</strong></p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setPrintOrdination(o); setShowDesignPanel(false); }}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer size={14} /> طباعة وتعديل الشهادة
                  </button>
                  <button type="button" onClick={() => deleteOrdination(o.id)} className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl cursor-pointer">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. كارت وسجل خلو الموانع + الاستعلام المشترك بين الكهنة + قاعدة بيانات الشباب والشابات */}
      {tab === 'clearance' && (
        <div className="space-y-4 print:hidden">
          {/* أ. صندوق الاستعلام والتحقق الفوري المشترك بين جميع الآباء الكهنة */}
          <div className="bg-linear-to-r from-amber-50 to-red-50/40 border-2 border-[#7a1c24]/40 p-4 sm:p-5 rounded-3xl space-y-3 shadow-sm">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-black text-[#7a1c24] flex items-center gap-1.5">
                  <Search size={18} /> الاستعلام الفوري المشترك بين جميع الآباء الكهنة
                </h3>
                <p className="text-[11px] text-gray-700 mt-0.5">
                  تحقق فوراً بالاسم أو الرقم القومي أو التليفون: هل استخرج هذا الشخص خلو موانع من قبل؟ ومِن أي أب كاهن؟
                </p>
              </div>
              <span className="px-3 py-1 bg-[#7a1c24] text-white rounded-full text-[11px] font-black">
                مربوط بين {issuingPriestsNames.length} آباء كهنة • {clearances.length} شهادة
              </span>
            </div>

            <div className="relative">
              <Search size={16} className="absolute right-3.5 top-3 text-[#7a1c24]" />
              <input
                placeholder="اكتب الرقم القومي (14 رقم) أو الاسم رباعي أو رقم التليفون للتحقق قبل الإصدار..."
                className="w-full pr-10 pl-9 py-2.5 bg-white border-2 border-amber-300 rounded-2xl font-bold outline-none focus:border-[#7a1c24]"
                value={verifyQuery}
                onChange={e => setVerifyQuery(e.target.value)}
              />
              {verifyQuery && (
                <button
                  type="button"
                  onClick={() => setVerifyQuery('')}
                  className="absolute left-3 top-2.5 text-gray-500 hover:text-gray-800 cursor-pointer"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {activeVerifyInput.length >= 2 && (
              verifyResults.length === 0 ? (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-2xl font-black flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
                  <span>✅ لم يسبق استخراج شهادة خلو موانع مطابقة لـ «{activeVerifyInput}» في سجلات جميع الآباء الكهنة.</span>
                </div>
              ) : (
                <div className="bg-red-50 border-2 border-red-400 p-3.5 rounded-2xl space-y-2">
                  <div className="text-red-900 font-black flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-600 shrink-0" />
                    <span>⚠️ تم العثور على ({verifyResults.length}) شهادة خلو موانع مسجلة مسبقاً:</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {verifyResults.map(c => (
                      <div key={c.national_id} className="bg-white p-3 rounded-xl border border-red-200 space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <strong className="text-sm text-[#7a1c24]">{c.full_name}</strong>
                          <span className="px-2 py-0.5 bg-gray-900 text-white rounded text-[10px] font-black">
                            تسلسل #{c.record_number}
                          </span>
                        </div>
                        <p className="text-gray-800 font-bold">
                          ✝ صدر من: <strong className="text-[#7a1c24]">{c.priest_name || 'أب كاهن بالكنيسة'}</strong>
                        </p>
                        <p className="text-gray-600">
                          🪪 قومي: <strong>{c.national_id}</strong> • 📅 بتاريخ: <strong>{c.issue_date}</strong>
                        </p>
                        <p className="text-gray-600">
                          💍 الحالة: {c.marital_status} {c.fiance_name ? `• الطرف الآخر: ${c.fiance_name}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>

          {/* ب. نموذج إصدار قيد وشهادة خلو موانع */}
          <form onSubmit={saveClearance} className="bg-white p-4 sm:p-5 rounded-3xl border-2 border-amber-300 space-y-3 font-bold shadow-sm">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-2">
              <div>
                <h3 className="text-sm font-black text-[#7a1c24] flex items-center gap-1.5">
                  <ShieldCheck size={17} /> {editingClearanceNid ? '✏️ تعديل شهادة خلو موانع (الرقم القومي مقفل كمفتاح أساسي)' : '📜 إصدار قيد وشهادة خلو موانع (تسلسل رقمي + رقم البطاقة الشخصية كمفتاح أساسي)'}
                </h3>
                <p className="text-[11px] text-gray-500 font-normal mt-0.5">
                  رقم البطاقة الشخصية (14 رقم) يُحفظ كمفتاح أساسي فريد لا يمكن تغييره بعد الحفظ، ويظهر سجل الشهادة لجميع الآباء الكهنة.
                </p>
              </div>
              {editingClearanceNid && (
                <button
                  type="button"
                  onClick={() => { setEditingClearanceNid(null); setClearanceForm(emptyClearance); }}
                  className="px-3 py-1.5 bg-gray-100 rounded-xl text-xs cursor-pointer"
                >
                  إلغاء التعديل
                </button>
              )}
            </div>

            {!editingClearanceNid && users.length > 0 && (
              <div className="bg-blue-50/50 p-2.5 rounded-2xl border border-blue-200">
                <label className="block text-[10px] text-blue-950 mb-1">اختيار سريع من شعب الكنيسة لملء البيانات تلقائياً (اختياري):</label>
                <select
                  className="w-full p-2 border rounded-xl bg-white"
                  defaultValue=""
                  onChange={e => {
                    const u = users.find(x => x.id === e.target.value);
                    if (u) {
                      setClearanceForm(prev => ({
                        ...prev,
                        national_id: u.national_id || prev.national_id,
                        full_name: u.full_name || prev.full_name,
                        gender: u.gender || prev.gender,
                        dob: u.dob || prev.dob,
                        phone: u.phone || prev.phone,
                        address: u.address || prev.address,
                        marital_status: u.marital_status || prev.marital_status,
                        confession_father: u.confession_father || prev.confession_father
                      }));
                    }
                  }}
                >
                  <option value="">-- اختر فرداً من قاعدة البيانات (أو أدخل البيانات يدوياً) --</option>
                  {users.filter(u => u.role !== 'admin' && u.role !== 'priest').map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} {u.phone ? `(${u.phone})` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {/* تنبيه تلقائي أثناء الكتابة إذا كان للشخص خلو موانع سابق لدى أي كاهن */}
            {liveFormMatches.length > 0 && (
              <div className="bg-red-50 border-2 border-red-400 p-3 rounded-2xl text-red-950 space-y-1">
                <strong className="flex items-center gap-1.5 text-xs font-black">
                  <AlertTriangle size={16} className="text-red-600" />
                  تحذير: هذا الشخص استخرج خلو موانع مسبقاً!
                </strong>
                {liveFormMatches.map(m => (
                  <p key={m.national_id} className="text-[11px]">
                    • <strong>{m.full_name}</strong> (قومي: {m.national_id}) — صدر من: <strong>{m.priest_name || 'أب كاهن'}</strong> بتاريخ {m.issue_date} (تسلسل #{m.record_number})
                  </p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[10px] text-[#7a1c24] mb-0.5 flex items-center gap-1">
                  <Lock size={11} /> رقم البطاقة الشخصية (14 رقم — مفتاح أساسي) *
                </label>
                <input
                  required
                  type="text"
                  maxLength={14}
                  disabled={Boolean(editingClearanceNid)}
                  readOnly={Boolean(editingClearanceNid)}
                  placeholder="14 رقم قومي..."
                  className={`w-full p-2.5 border rounded-xl font-black tracking-wider ${
                    editingClearanceNid ? 'bg-gray-100 text-gray-600 cursor-not-allowed border-gray-300' : 'bg-amber-50/40 border-amber-300'
                  }`}
                  value={clearanceForm.national_id}
                  onChange={e => setClearanceForm({ ...clearanceForm, national_id: e.target.value.replace(/\D/g, '').slice(0, 14) })}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] text-gray-500 mb-0.5">الاسم بالكامل رباعي *</label>
                <input
                  required
                  placeholder="الاسم رباعي مطابق للبطاقة *"
                  className="w-full p-2.5 border rounded-xl"
                  value={clearanceForm.full_name}
                  onChange={e => setClearanceForm({ ...clearanceForm, full_name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">النوع</label>
                <select className="w-full p-2.5 border rounded-xl bg-white" value={clearanceForm.gender} onChange={e => setClearanceForm({ ...clearanceForm, gender: e.target.value })}>
                  <option value="ذكر">ذكر</option>
                  <option value="أنثى">أنثى</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">تاريخ الميلاد</label>
                <input type="date" className="w-full p-2.5 border rounded-xl" value={clearanceForm.dob} onChange={e => setClearanceForm({ ...clearanceForm, dob: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">تاريخ التحرير *</label>
                <input required type="date" className="w-full p-2.5 border rounded-xl" value={clearanceForm.issue_date} onChange={e => setClearanceForm({ ...clearanceForm, issue_date: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">الحالة الاجتماعية الكنسية</label>
                <select className="w-full p-2.5 border rounded-xl bg-white" value={clearanceForm.marital_status} onChange={e => setClearanceForm({ ...clearanceForm, marital_status: e.target.value })}>
                  {CLEARANCE_MARITAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">رقم التليفون</label>
                <input type="tel" placeholder="01xxxxxxxxx" className="w-full p-2.5 border rounded-xl" value={clearanceForm.phone} onChange={e => setClearanceForm({ ...clearanceForm, phone: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <input placeholder="العنوان بالكامل" className="p-2.5 border rounded-xl" value={clearanceForm.address} onChange={e => setClearanceForm({ ...clearanceForm, address: e.target.value })} />
              <input placeholder="كنيسة المعمودية" className="p-2.5 border rounded-xl" value={clearanceForm.baptism_church} onChange={e => setClearanceForm({ ...clearanceForm, baptism_church: e.target.value })} />
              <input placeholder="أب الاعتراف" className="p-2.5 border rounded-xl" value={clearanceForm.confession_father} onChange={e => setClearanceForm({ ...clearanceForm, confession_father: e.target.value })} />
              <div>
                <input
                  required
                  list="priests-datalist-cl"
                  placeholder="اسم الأب الكاهن المُصدر للشهادة *"
                  className="w-full p-2.5 border rounded-xl"
                  value={clearanceForm.priest_name}
                  onChange={e => setClearanceForm({ ...clearanceForm, priest_name: e.target.value })}
                />
                <datalist id="priests-datalist-cl">{priestsList.map(p => <option key={p.id} value={p.full_name} />)}</datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input placeholder="اسم الطرف الآخر (الخطيب / الخطيبة)" className="p-2.5 border rounded-xl" value={clearanceForm.fiance_name} onChange={e => setClearanceForm({ ...clearanceForm, fiance_name: e.target.value })} />
              <input placeholder="الرقم القومي للطرف الآخر (اختياري)" maxLength={14} className="p-2.5 border rounded-xl" value={clearanceForm.fiance_national_id} onChange={e => setClearanceForm({ ...clearanceForm, fiance_national_id: e.target.value.replace(/\D/g, '').slice(0, 14) })} />
              <input placeholder="الغرض (مثلاً: إتمام سر الزيجة المقدس)" className="p-2.5 border rounded-xl" value={clearanceForm.purpose} onChange={e => setClearanceForm({ ...clearanceForm, purpose: e.target.value })} />
            </div>

            <button type="submit" className="w-full sm:w-auto px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl flex items-center justify-center gap-1.5 shadow cursor-pointer">
              <Plus size={15} /> {editingClearanceNid ? 'حفظ التعديلات ومعاينة الشهادة' : 'حفظ القيد (بالتسلسل الرقمي) ومعاينة الشهادة'}
            </button>
          </form>

          {/* ج. التبديل بين: قاعدة بيانات الشباب والشابات وحالة الزواج | سجل الشهادات الصادرة */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 space-y-4 shadow-sm">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDirSubView('directory')}
                  className={`px-4 py-2 rounded-xl font-black flex items-center gap-1.5 cursor-pointer ${
                    dirSubView === 'directory' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <Users size={15} /> قاعدة بيانات الشباب والشابات وحالة خلو الموانع ({youthAndClearanceDirectory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDirSubView('clearances_list')}
                  className={`px-4 py-2 rounded-xl font-black flex items-center gap-1.5 cursor-pointer ${
                    dirSubView === 'clearances_list' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <ShieldCheck size={15} /> سجل شهادات خلو الموانع الصادرة ({clearances.length})
                </button>
              </div>
            </div>

            {dirSubView === 'directory' && (
              <div className="space-y-3">
                {/* فلاتر قاعدة بيانات الشباب والشابات */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 bg-[#fbfaf7] p-3 rounded-2xl border font-bold">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">تصفية حسب النوع:</label>
                    <select className="w-full p-2 border rounded-xl bg-white" value={dirGenderFilter} onChange={e => setDirGenderFilter(e.target.value)}>
                      <option value="all">الكل (شباب وشابات)</option>
                      <option value="male">شباب (ذكور)</option>
                      <option value="female">شابات (إناث)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">موقف خلو الموانع:</label>
                    <select className="w-full p-2 border rounded-xl bg-white" value={dirClearanceFilter} onChange={e => setDirClearanceFilter(e.target.value)}>
                      <option value="all">الكل ({youthAndClearanceDirectory.length})</option>
                      <option value="issued">✅ أخذ خلو موانع ({youthAndClearanceDirectory.filter(r => r.clearance).length})</option>
                      <option value="not_issued">⏳ لم يأخذ خلو موانع ({youthAndClearanceDirectory.filter(r => !r.clearance).length})</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">حالة الزواج:</label>
                    <select className="w-full p-2 border rounded-xl bg-white" value={dirMarriageFilter} onChange={e => setDirMarriageFilter(e.target.value)}>
                      <option value="all">كل الحالات</option>
                      <option value="unmarried">لم يتزوج بعد (أعزب / آنسة)</option>
                      <option value="engaged">مخطوب / مخطوبة</option>
                      <option value="married">متزوج / متزوجة</option>
                      <option value="other">أرمل / تصريح زواج ثانٍ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">أخذها من أي أب كاهن؟</label>
                    <select className="w-full p-2 border rounded-xl bg-white" value={dirPriestFilter} onChange={e => setDirPriestFilter(e.target.value)}>
                      <option value="all">كل الآباء الكهنة</option>
                      {issuingPriestsNames.map(pname => (
                        <option key={pname} value={pname}>✝ {pname}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* جدول قاعدة البيانات */}
                <div className="overflow-x-auto border rounded-2xl max-h-[460px] overflow-y-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#7a1c24] text-white font-black">
                        <th className="p-2.5">الاسم والبيانات</th>
                        <th className="p-2.5">النوع / السن</th>
                        <th className="p-2.5">الرقم القومي</th>
                        <th className="p-2.5">حالة الزواج</th>
                        <th className="p-2.5">موقف خلو الموانع (بين جميع الكهنة)</th>
                        <th className="p-2.5 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-bold">
                      {filteredDirectory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-gray-400">
                            لا توجد بيانات مطابقة للتصفية الحالية.
                          </td>
                        </tr>
                      ) : (
                        filteredDirectory.map(row => (
                          <tr key={row.rowKey} className="hover:bg-[#fbfaf7]">
                            <td className="p-2.5">
                              <strong className="text-gray-900 block">{row.full_name}</strong>
                              <span className="text-[11px] text-gray-500">
                                {row.phone ? `📞 ${row.phone}` : 'بدون تليفون'}
                                {row.stage ? ` • ${row.stage}` : ''}
                              </span>
                            </td>
                            <td className="p-2.5 text-gray-700">
                              {row.gender === 'أنثى' ? '♀️ شابة' : '♂️ شاب'}
                              {row.age !== null && <span className="block text-[11px] text-gray-500">{row.age} سنة</span>}
                            </td>
                            <td className="p-2.5 tracking-wider text-gray-800">
                              {row.national_id || <span className="text-gray-400">—</span>}
                            </td>
                            <td className="p-2.5">
                              {row.userId ? (
                                <select
                                  className="p-1.5 border rounded-lg bg-white text-[11px]"
                                  value={row.marital_status}
                                  onChange={e => handleUpdateUserMaritalQuick(row.userId, e.target.value)}
                                >
                                  {CLEARANCE_MARITAL_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="px-2 py-0.5 bg-gray-100 rounded-lg text-[11px]">{row.marital_status}</span>
                              )}
                            </td>
                            <td className="p-2.5">
                              {row.clearance ? (
                                <div className="space-y-0.5">
                                  <span className="px-2 py-0.5 bg-red-100 text-red-900 rounded-lg text-[10px] font-black inline-block">
                                    ✅ أخذ خلو موانع (تسلسل #{row.clearance.record_number})
                                  </span>
                                  <span className="block text-[11px] text-[#7a1c24] font-black">
                                    ✝ من: {row.clearance.priest_name || 'أب كاهن'} ({row.clearance.issue_date})
                                  </span>
                                </div>
                              ) : (
                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-lg text-[10px] font-black inline-block">
                                  لم يأخذ خلو موانع بعد
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {row.clearance ? (
                                <button
                                  type="button"
                                  onClick={() => { setPrintClearance(row.clearance); setShowDesignPanel(false); }}
                                  className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl font-black text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Printer size={12} /> عرض / طباعة
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => prefillClearanceFromRow(row)}
                                  className="px-3 py-1.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black text-[11px] cursor-pointer"
                                >
                                  + إصدار له
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {dirSubView === 'clearances_list' && (
              <div className="grid gap-2.5">
                {filteredClearances.length === 0 ? (
                  <div className="bg-[#fbfaf7] p-6 rounded-2xl border border-dashed text-center text-gray-400">
                    لا توجد شهادات خلو موانع مسجلة حتى الآن.
                  </div>
                ) : (
                  filteredClearances.map(c => (
                    <div key={c.national_id} className="bg-[#fbfaf7] p-4 rounded-2xl border border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-gray-900 text-white rounded font-black text-[10px]">
                            تسلسل #{c.record_number}
                          </span>
                          <span className="px-2.5 py-0.5 bg-amber-100 text-amber-950 rounded font-black text-[10px] inline-flex items-center gap-1">
                            <Lock size={10} /> بطاقة: {c.national_id}
                          </span>
                          <strong className="text-sm text-gray-900">{c.full_name}</strong>
                        </div>
                        <p className="text-gray-600">
                          💍 {c.marital_status} {c.fiance_name ? `• الطرف الآخر: ${c.fiance_name}` : ''} {c.confession_father ? `• أب الاعتراف: ${c.confession_father}` : ''}
                        </p>
                        <p className="text-gray-500 font-bold">
                          📅 التحرير: {c.issue_date} ({c.coptic_issue_date}) • ✝ صدر من: <strong className="text-[#7a1c24]">{c.priest_name || 'أب كاهن'}</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => { setPrintClearance(c); setShowDesignPanel(false); }}
                          className="px-3.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Printer size={14} /> طباعة الشهادة
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClearanceNid(c.national_id);
                            setClearanceForm({ ...emptyClearance, ...c });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="p-2 bg-white border hover:bg-gray-100 rounded-xl cursor-pointer"
                          title="تعديل البيانات (الرقم القومي غير قابل للتغيير)"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button type="button" onClick={() => deleteClearance(c.national_id)} className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl cursor-pointer">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* معاينة وطباعة وتعديل شهادة المعمودية */}
      {printBaptism && (
        <div className="fixed inset-0 bg-black/65 flex items-start justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-4 sm:p-6 space-y-4 my-auto">
            <div className="flex flex-wrap justify-between items-center gap-2 no-print">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => window.print()} className="px-4 sm:px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-bold flex items-center gap-2 shadow cursor-pointer">
                  <Printer size={16} /> طباعة الشهادة (A4 بالعرض) / حفظ PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowDesignPanel(prev => !prev)}
                  className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer border transition ${
                    showDesignPanel ? 'bg-gray-900 text-white border-gray-900' : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300'
                  }`}
                >
                  <SlidersHorizontal size={15} /> {showDesignPanel ? 'إخفاء التعديل' : 'تعديل الشكل والخط والبيانات'}
                </button>
              </div>
              <button type="button" onClick={() => setPrintBaptism(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {showDesignPanel && (
              <div className="bg-[#fbfaf7] border border-amber-300 rounded-2xl p-4 space-y-4 no-print">
                <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-2">
                  <strong className="text-sm text-[#7a1c24]">🎨 تخصيص شكل الشهادة والخطوط</strong>
                  <button type="button" onClick={resetDesign} className="text-[11px] text-gray-500 hover:text-red-700 underline cursor-pointer">
                    إرجاع الشكل الافتراضي
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 font-bold">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">حجم الخط:</label>
                    <select className="w-full p-2 border rounded-xl bg-white" value={design.fontSize} onChange={e => updateDesign({ fontSize: e.target.value })}>
                      <option value="medium">متوسط</option>
                      <option value="large">كبير (موصى به)</option>
                      <option value="xlarge">كبير جداً</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">نوع الخط:</label>
                    <select className="w-full p-2 border rounded-xl bg-white" value={design.fontFamily} onChange={e => updateDesign({ fontFamily: e.target.value })}>
                      <option value="cairo">خط Cairo (واضح وحديث)</option>
                      <option value="amiri">خط Amiri (نسخ كنيسي رسمي)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">لون الإطار والعناوين:</label>
                    <select className="w-full p-2 border rounded-xl bg-white" value={design.themeColor} onChange={e => updateDesign({ themeColor: e.target.value })}>
                      <option value="#7a1c24">عنابي كنيسي (افتراضي)</option>
                      <option value="#9a6b16">ذهبي ملكي</option>
                      <option value="#1e3a5f">أزرق كحلي</option>
                      <option value="#1f4d3a">أخضر زيتي</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">شكل البرواز:</label>
                    <select className="w-full p-2 border rounded-xl bg-white" value={design.borderStyle} onChange={e => updateDesign({ borderStyle: e.target.value })}>
                      <option value="double">مزدوج (Double)</option>
                      <option value="solid">إطار واحد عريض</option>
                      <option value="ridge">بارز (Ridge)</option>
                    </select>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2.5">
                  <strong className="text-sm text-[#7a1c24] block">📝 تعديل بيانات هذا القيد قبل الطباعة:</strong>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 font-bold">
                    <input className="w-full p-2 border rounded-xl bg-white" value={printBaptism.child_full_name} onChange={e => setPrintBaptism({ ...printBaptism, child_full_name: e.target.value })} />
                    <input className="w-full p-2 border rounded-xl bg-white" placeholder="اسم المعمودية" value={printBaptism.baptism_name || ''} onChange={e => setPrintBaptism({ ...printBaptism, baptism_name: e.target.value })} />
                    <input className="w-full p-2 border rounded-xl bg-white" value={printBaptism.church_name || settings.church_name} onChange={e => setPrintBaptism({ ...printBaptism, church_name: e.target.value })} />
                    <input className="w-full p-2 border rounded-xl bg-white" value={printBaptism.father_name} onChange={e => setPrintBaptism({ ...printBaptism, father_name: e.target.value })} />
                    <input className="w-full p-2 border rounded-xl bg-white" value={printBaptism.mother_name} onChange={e => setPrintBaptism({ ...printBaptism, mother_name: e.target.value })} />
                    <input className="w-full p-2 border rounded-xl bg-white" value={printBaptism.godparent_name} onChange={e => setPrintBaptism({ ...printBaptism, godparent_name: e.target.value })} />
                    <input className="w-full p-2 border rounded-xl bg-white" value={printBaptism.priest_name} onChange={e => setPrintBaptism({ ...printBaptism, priest_name: e.target.value })} />
                    <input type="date" className="w-full p-2 border rounded-xl bg-white" value={printBaptism.dob || ''} onChange={e => setPrintBaptism({ ...printBaptism, dob: e.target.value })} />
                    <input type="date" className="w-full p-2 border rounded-xl bg-white" value={printBaptism.baptism_date || ''} onChange={e => setPrintBaptism({ ...printBaptism, baptism_date: e.target.value, coptic_baptism_date: toCopticDate(e.target.value) })} />
                  </div>
                  <div className="flex justify-end">
                    <button type="button" disabled={savingEdit} onClick={handleSaveBaptismEdit} className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer">
                      <Save size={14} /> {savingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات في السجل'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div
              id="printable-cert"
              style={{
                ...certFontStyle,
                borderColor: design.themeColor,
                borderStyle: design.borderStyle,
                borderWidth: '8px'
              }}
              className="p-6 sm:p-9 rounded-2xl bg-[#fffdf9] text-center flex flex-col justify-between gap-4"
            >
              <div className="flex justify-between items-center border-b-2 pb-3" style={{ borderColor: design.accentColor }}>
                <div className="text-right space-y-1">
                  <p className={`font-black ${fp.diocese}`} style={{ color: design.themeColor }}>{settings.diocese_name}</p>
                  <p className={`font-extrabold text-gray-800 ${fp.church}`}>{printBaptism.church_name || settings.church_name}</p>
                  <p className={`text-gray-500 font-bold ${fp.record}`}>رقم القيد بسجل المعمودية: <strong>#{printBaptism.record_number}</strong></p>
                </div>
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="لوجو الكنيسة" className="h-20 w-20 sm:h-24 sm:w-24 object-contain" />
                ) : (
                  <div className="w-20 h-20 rounded-full border-2 flex items-center justify-center text-4xl font-black" style={{ borderColor: design.accentColor, color: design.themeColor }}>✝</div>
                )}
              </div>

              <div className="space-y-4">
                <h1 className={`font-black tracking-wide ${fp.title}`} style={{ color: design.themeColor }}>
                  {design.baptismTitle}
                </h1>
                <p className={`text-gray-700 font-bold ${fp.intro}`}>
                  تشهد {printBaptism.church_name || settings.church_name} {design.baptismIntro} ({printBaptism.gender === 'أنثى' ? 'الابنة' : 'الابن'}):
                </p>

                <div className={`bg-white border-2 border-[#e6dfd3] rounded-2xl p-5 sm:p-6 max-w-4xl mx-auto text-right grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5 ${fp.fields}`}>
                  <p className="sm:col-span-2 text-center border-b border-gray-100 pb-3">
                    <strong className="text-gray-600 ml-2">الاسم بالكامل:</strong>
                    <span className={`font-black ${fp.mainName}`} style={{ color: design.themeColor }}>{printBaptism.child_full_name}</span>
                    {printBaptism.baptism_name && (
                      <span className="text-gray-600 mr-2 font-bold">(باسم معمودية: <strong className="text-gray-900">{printBaptism.baptism_name}</strong>)</span>
                    )}
                  </p>
                  <p><strong className="text-gray-600">اسم الأب:</strong> <span className="font-bold text-gray-900">{printBaptism.father_name}</span></p>
                  <p><strong className="text-gray-600">اسم الأم:</strong> <span className="font-bold text-gray-900">{printBaptism.mother_name}</span></p>
                  <p><strong className="text-gray-600">تاريخ الميلاد:</strong> <span className="font-bold text-gray-900">{printBaptism.dob || '—'}</span></p>
                  <p>
                    <strong className="text-gray-600">تاريخ المعمودية:</strong>{' '}
                    <span className="font-bold text-gray-900">{printBaptism.baptism_date}</span>{' '}
                    <span className="text-gray-500 font-semibold">({printBaptism.coptic_baptism_date})</span>
                  </p>
                  <p><strong className="text-gray-600">اسم الإشبين / الإشبينة:</strong> <span className="font-bold text-gray-900">{printBaptism.godparent_name}</span></p>
                  <p><strong className="text-gray-600">الأب الكاهن المعمد:</strong> <span className="font-bold text-gray-900">{printBaptism.priest_name}</span></p>
                </div>
              </div>

              <div className={`grid grid-cols-2 gap-12 pt-4 max-w-3xl mx-auto w-full font-extrabold text-gray-800 ${fp.sig}`}>
                <div><p className="mb-8">{design.baptismSigRight}</p><p>........................................</p></div>
                <div><p className="mb-8">{design.baptismSigLeft}</p><p>........................................</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* معاينة وطباعة وتعديل شهادة الشماسية */}
      {printOrdination && (
        <div className="fixed inset-0 bg-black/65 flex items-start justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-4 sm:p-6 space-y-4 my-auto">
            <div className="flex flex-wrap justify-between items-center gap-2 no-print">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => window.print()} className="px-4 sm:px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-bold flex items-center gap-2 shadow cursor-pointer">
                  <Printer size={16} /> طباعة الشهادة (A4 بالعرض) / حفظ PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowDesignPanel(prev => !prev)}
                  className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer border transition ${
                    showDesignPanel ? 'bg-gray-900 text-white border-gray-900' : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300'
                  }`}
                >
                  <SlidersHorizontal size={15} /> {showDesignPanel ? 'إخفاء التعديل' : 'تعديل الشكل والخط والبيانات'}
                </button>
              </div>
              <button type="button" onClick={() => setPrintOrdination(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {showDesignPanel && (
              <div className="bg-[#fbfaf7] border border-amber-300 rounded-2xl p-4 space-y-4 no-print">
                <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-2">
                  <strong className="text-sm text-[#7a1c24]">🎨 تخصيص شكل الشهادة والخطوط</strong>
                  <button type="button" onClick={resetDesign} className="text-[11px] text-gray-500 hover:text-red-700 underline cursor-pointer">
                    إرجاع الشكل الافتراضي
                  </button>
                </div>

                <div className="border-t pt-3 space-y-2.5">
                  <strong className="text-sm text-[#7a1c24] block">📝 تعديل بيانات شهادة الشماسية قبل الطباعة:</strong>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 font-bold">
                    <input className="w-full p-2 border rounded-xl bg-white" value={printOrdination.deacon_full_name} onChange={e => setPrintOrdination({ ...printOrdination, deacon_full_name: e.target.value })} />
                    <select className="w-full p-2 border rounded-xl bg-white" value={printOrdination.deacon_rank} onChange={e => setPrintOrdination({ ...printOrdination, deacon_rank: e.target.value })}>
                      {DEACON_RANKS.map((r, i) => <option key={i} value={r}>{r}</option>)}
                    </select>
                    <select className="w-full p-2 border rounded-xl bg-white" value={printOrdination.action_type} onChange={e => setPrintOrdination({ ...printOrdination, action_type: e.target.value })}>
                      <option value="رسامة جديدة">رسامة جديدة</option>
                      <option value="ترقية رتبة">ترقية رتبة</option>
                    </select>
                    <input className="w-full p-2 border rounded-xl bg-white" value={printOrdination.bishop_name} onChange={e => setPrintOrdination({ ...printOrdination, bishop_name: e.target.value })} />
                    <input className="w-full p-2 border rounded-xl bg-white" value={printOrdination.church_name || settings.church_name} onChange={e => setPrintOrdination({ ...printOrdination, church_name: e.target.value })} />
                    <input type="date" className="w-full p-2 border rounded-xl bg-white" value={printOrdination.ordination_date || ''} onChange={e => setPrintOrdination({ ...printOrdination, ordination_date: e.target.value, coptic_ordination_date: toCopticDate(e.target.value) })} />
                  </div>
                  <div className="flex justify-end">
                    <button type="button" disabled={savingEdit} onClick={handleSaveOrdinationEdit} className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer">
                      <Save size={14} /> {savingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات في السجل'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div
              id="printable-cert"
              style={{
                ...certFontStyle,
                borderColor: design.accentColor,
                borderStyle: design.borderStyle,
                borderWidth: '8px'
              }}
              className="p-6 sm:p-9 rounded-2xl bg-[#fffdf9] text-center flex flex-col justify-between gap-4"
            >
              <div className="flex justify-between items-center border-b-2 pb-3" style={{ borderColor: design.themeColor }}>
                <div className="text-right space-y-1">
                  <p className={`font-black ${fp.diocese}`} style={{ color: design.themeColor }}>{settings.diocese_name}</p>
                  <p className={`font-extrabold text-gray-800 ${fp.church}`}>{printOrdination.church_name || settings.church_name}</p>
                  <p className={`text-gray-500 font-bold ${fp.record}`}>رقم القيد بسجل الشمامسة: <strong>#{printOrdination.record_number}</strong></p>
                </div>
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="لوجو الكنيسة" className="h-20 w-20 sm:h-24 sm:w-24 object-contain" />
                ) : (
                  <div className="w-20 h-20 rounded-full border-2 flex items-center justify-center text-4xl font-black" style={{ borderColor: design.themeColor, color: design.accentColor }}>✝</div>
                )}
              </div>

              <div className="space-y-4">
                <h1 className={`font-black ${fp.title}`} style={{ color: design.themeColor }}>
                  {design.deaconTitlePrefix} {printOrdination.action_type === 'ترقية رتبة' ? 'ترقية رتبة شماسية' : 'رسامة شماس'}
                </h1>
                <p className={`text-gray-700 font-bold ${fp.intro}`}>
                  بوضع اليد الرسولي ونعمة الروح القدس، تشهد {printOrdination.church_name || settings.church_name} بأنه قد تمت {printOrdination.action_type} الابن المبارك:
                </p>

                <div className={`bg-white border-2 border-[#e6dfd3] rounded-2xl p-6 max-w-4xl mx-auto space-y-4 ${fp.fields}`}>
                  <p className={`font-black ${fp.mainName}`} style={{ color: design.themeColor }}>{printOrdination.deacon_full_name}</p>
                  <p className="font-bold text-gray-800">
                    إلى رتبة: <span className="px-5 py-1.5 bg-amber-100 text-amber-950 rounded-xl font-black">{printOrdination.deacon_rank}</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100 text-gray-700">
                    <p><strong className="text-gray-600">التاريخ:</strong> <span className="font-bold text-gray-900">{printOrdination.ordination_date}</span> ({printOrdination.coptic_ordination_date})</p>
                    <p><strong className="text-gray-600">بيد صاحب النيافة:</strong> <span className="font-bold text-gray-900">{printOrdination.bishop_name}</span></p>
                  </div>
                </div>
              </div>

              <div className={`grid grid-cols-2 gap-12 pt-4 max-w-3xl mx-auto w-full font-extrabold text-gray-800 ${fp.sig}`}>
                <div><p className="mb-8">{design.deaconSigRight}</p><p>........................................</p></div>
                <div><p className="mb-8">{design.deaconSigLeft}</p><p>........................................</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* معاينة وطباعة وتعديل شهادة خلو الموانع */}
      {printClearance && (
        <div className="fixed inset-0 bg-black/65 flex items-start justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-4 sm:p-6 space-y-4 my-auto">
            <div className="flex flex-wrap justify-between items-center gap-2 no-print">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => window.print()} className="px-4 sm:px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-bold flex items-center gap-2 shadow cursor-pointer">
                  <Printer size={16} /> طباعة شهادة خلو الموانع (A4 بالعرض)
                </button>
                <button
                  type="button"
                  onClick={() => setShowDesignPanel(prev => !prev)}
                  className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer border transition ${
                    showDesignPanel ? 'bg-gray-900 text-white border-gray-900' : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300'
                  }`}
                >
                  <SlidersHorizontal size={15} /> {showDesignPanel ? 'إخفاء التعديل' : 'تعديل البيانات (البطاقة مقفلة)'}
                </button>
              </div>
              <button type="button" onClick={() => setPrintClearance(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {showDesignPanel && (
              <div className="bg-[#fbfaf7] border border-amber-300 rounded-2xl p-4 space-y-3 no-print">
                <strong className="text-sm text-[#7a1c24] block">📝 تعديل بيانات شهادة خلو الموانع (الرقم القومي مفتاح أساسي لا يتغير):</strong>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 font-bold">
                  <div>
                    <label className="text-[10px] text-gray-500 flex items-center gap-1"><Lock size={10} /> الرقم القومي (مفتاح أساسي)</label>
                    <input readOnly disabled className="w-full p-2 border rounded-xl bg-gray-100 text-gray-600 cursor-not-allowed" value={printClearance.national_id} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block">الاسم بالكامل</label>
                    <input className="w-full p-2 border rounded-xl bg-white" value={printClearance.full_name} onChange={e => setPrintClearance({ ...printClearance, full_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block">الحالة الكنسية</label>
                    <select className="w-full p-2 border rounded-xl bg-white" value={printClearance.marital_status} onChange={e => setPrintClearance({ ...printClearance, marital_status: e.target.value })}>
                      {CLEARANCE_MARITAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block">اسم الطرف الآخر</label>
                    <input className="w-full p-2 border rounded-xl bg-white" value={printClearance.fiance_name || ''} onChange={e => setPrintClearance({ ...printClearance, fiance_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block">أب الاعتراف</label>
                    <input className="w-full p-2 border rounded-xl bg-white" value={printClearance.confession_father || ''} onChange={e => setPrintClearance({ ...printClearance, confession_father: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block">الأب الكاهن المُصدر</label>
                    <input className="w-full p-2 border rounded-xl bg-white" value={printClearance.priest_name || ''} onChange={e => setPrintClearance({ ...printClearance, priest_name: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" disabled={savingEdit} onClick={handleSaveClearanceEdit} className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer">
                    <Save size={14} /> {savingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات في السجل'}
                  </button>
                </div>
              </div>
            )}

            <div
              id="printable-cert"
              style={{
                ...certFontStyle,
                borderColor: design.themeColor,
                borderStyle: design.borderStyle,
                borderWidth: '8px'
              }}
              className="p-6 sm:p-9 rounded-2xl bg-[#fffdf9] text-center flex flex-col justify-between gap-4"
            >
              <div className="flex justify-between items-center border-b-2 pb-3" style={{ borderColor: design.accentColor }}>
                <div className="text-right space-y-1">
                  <p className={`font-black ${fp.diocese}`} style={{ color: design.themeColor }}>{settings.diocese_name}</p>
                  <p className={`font-extrabold text-gray-800 ${fp.church}`}>{printClearance.church_name || settings.church_name}</p>
                  <p className={`text-gray-600 font-bold ${fp.record}`}>
                    التسلسل الرقمي بسجل خلو الموانع: <strong>#{printClearance.record_number}</strong> • الرقم القومي: <strong>{printClearance.national_id}</strong>
                  </p>
                </div>
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="لوجو الكنيسة" className="h-20 w-20 sm:h-24 sm:w-24 object-contain" />
                ) : (
                  <div className="w-20 h-20 rounded-full border-2 flex items-center justify-center text-4xl font-black" style={{ borderColor: design.accentColor, color: design.themeColor }}>✝</div>
                )}
              </div>

              <div className="space-y-4">
                <h1 className={`font-black ${fp.title}`} style={{ color: design.themeColor }}>
                  {design.clearanceTitle}
                </h1>
                <p className={`text-gray-700 font-bold ${fp.intro}`}>
                  {design.clearanceIntro}:
                </p>

                <div className={`bg-white border-2 border-[#e6dfd3] rounded-2xl p-5 sm:p-6 max-w-4xl mx-auto text-right grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 ${fp.fields}`}>
                  <p className="sm:col-span-2 text-center border-b border-gray-100 pb-2.5">
                    <strong className="text-gray-600 ml-2">الاسم بالكامل:</strong>
                    <span className={`font-black ${fp.mainName}`} style={{ color: design.themeColor }}>{printClearance.full_name}</span>
                  </p>
                  <p><strong className="text-gray-600">الرقم القومي (المفتاح الأساسي):</strong> <span className="font-black text-gray-900 tracking-wider">{printClearance.national_id}</span></p>
                  <p><strong className="text-gray-600">الحالة الكنسية:</strong> <span className="font-bold text-gray-900">{printClearance.marital_status}</span></p>
                  <p><strong className="text-gray-600">تاريخ الميلاد:</strong> <span className="font-bold text-gray-900">{printClearance.dob || '—'}</span></p>
                  <p><strong className="text-gray-600">العنوان:</strong> <span className="font-bold text-gray-900">{printClearance.address || '—'}</span></p>
                  {printClearance.baptism_church && <p><strong className="text-gray-600">كنيسة المعمودية:</strong> <span className="font-bold text-gray-900">{printClearance.baptism_church}</span></p>}
                  {printClearance.confession_father && <p><strong className="text-gray-600">أب الاعتراف:</strong> <span className="font-bold text-gray-900">{printClearance.confession_father}</span></p>}
                  {printClearance.fiance_name && (
                    <p className="sm:col-span-2">
                      <strong className="text-gray-600">لإتمام الإكليل المبارك مع:</strong>{' '}
                      <span className="font-black text-gray-900">{printClearance.fiance_name}</span>
                      {printClearance.fiance_national_id && <span className="text-gray-600 mr-2">(قومي: {printClearance.fiance_national_id})</span>}
                    </p>
                  )}
                  <p className="sm:col-span-2">
                    <strong className="text-gray-600">تاريخ التحرير:</strong>{' '}
                    <span className="font-bold text-gray-900">{printClearance.issue_date}</span>{' '}
                    <span className="text-gray-500">({printClearance.coptic_issue_date})</span>
                    {printClearance.priest_name && <span className="mr-4"><strong className="text-gray-600">الأب الكاهن:</strong> {printClearance.priest_name}</span>}
                  </p>
                </div>
              </div>

              <div className={`grid grid-cols-2 gap-12 pt-4 max-w-3xl mx-auto w-full font-extrabold text-gray-800 ${fp.sig}`}>
                <div><p className="mb-8">{design.clearanceSigRight}</p><p>........................................</p></div>
                <div><p className="mb-8">{design.clearanceSigLeft}</p><p>........................................</p></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
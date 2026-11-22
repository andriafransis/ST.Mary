import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toCopticDate } from '../utils/copticDate';
import { Search, Printer, Plus, Trash2, Award, Droplets, X, SlidersHorizontal, Save } from 'lucide-react';

const DEACON_RANKS = [
  'أبصالتس (مرتل)',
  'اغنسطس (قارئ)',
  'إبصاديا (مساعد شماس)',
  'دياكون (شماس كامل)',
  'أرشيدياكون (رئيس شمامسة)'
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
  baptismIntro: 'بأنه بنعمة ربنا يسوع المسيح قد تم عماد',
  deaconIntro: 'بوضع اليد الرسولي ونعمة الروح القدس، تشهد الكنيسة بأنه قد تمت',
  baptismSigRight: 'توقيع الأب الكاهن المعمد',
  baptismSigLeft: 'خاتم الكنيسة',
  deaconSigRight: 'توقيع نيافة الأب الأسقف',
  deaconSigLeft: 'خاتم الإيبارشية / الكنيسة'
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

export default function CertificatesRegistry({ users = [], onRefresh }) {
  const [tab, setTab] = useState('baptism');
  const [searchQ, setSearchQ] = useState('');

  const [settings, setSettings] = useState({
    diocese_name: 'الكنيسة القبطية الأرثوذكسية',
    church_name: 'كنيستنا المباركة',
    logo_url: ''
  });
  const [baptisms, setBaptisms] = useState([]);
  const [ordinations, setOrdinations] = useState([]);

  const [printBaptism, setPrintBaptism] = useState(null);
  const [printOrdination, setPrintOrdination] = useState(null);
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
    godparent_name: '', priest_name: '', church_name: '', phone: '', notes: ''
  };
  const [bapForm, setBapForm] = useState(emptyBap);

  const emptyOrd = {
    user_id: '', deacon_full_name: '', action_type: 'رسامة جديدة',
    deacon_rank: 'أبصالتس (مرتل)', ordination_date: todayISO,
    bishop_name: 'نيافة الأنبا ...', church_name: '', notes: ''
  };
  const [ordForm, setOrdForm] = useState(emptyOrd);

  const loadData = async () => {
    const [st, logoRes, bp, or] = await Promise.all([
      supabase.from('church_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('church_public_content').select('title, url').eq('kind', 'logo').limit(1).maybeSingle(),
      supabase.from('baptism_records').select('*').order('record_number', { ascending: false }),
      supabase.from('deacon_ordinations').select('*').order('record_number', { ascending: false })
    ]);
    setSettings(prev => ({
      diocese_name: st?.data?.diocese_name || prev.diocese_name,
      church_name: logoRes?.data?.title || st?.data?.church_name || prev.church_name,
      logo_url: logoRes?.data?.url || st?.data?.logo_url || ''
    }));
    if (bp.data) setBaptisms(bp.data);
    if (or.data) setOrdinations(or.data);
  };

  useEffect(() => { loadData(); }, []);

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

  const priestsList = users.filter(u => u.role === 'priest');

  // استبعاد الإناث تماماً + استبعاد الكهنة والسوبر أدمن
  // واحتواء كل شعب وخدام وأولياء أمور الكنيسة الذكور
  const maleCandidates = users.filter(u => {
    // 1. النوع: ذكر فقط
    const isMale = u.gender === 'ذكر' || u.gender !== 'أنثى';
    if (!isMale) return false;

    // 2. الكهنة والسوبر أدمن ليسوا مرشحين للرتب الشماسية
    if (u.role === 'priest' || u.role === 'admin') return false;

    // 3. لو الإجراء المختار هو "ترقية رتبة":
    // نظهر فقط من هو شماس بالفعل في قاعدة البيانات
    if (ordForm.action_type === 'ترقية رتبة') {
      return Boolean(u.is_deacon);
    }

    // 4. لو رسامة جديدة: كل الذكور في الكنيسة متاحين (أولياء أمور، خدام، مخدومين...)
    return true;
  });

  const filteredBaptisms = baptisms.filter(b =>
    (String(b.record_number) + ' ' + b.child_full_name + ' ' + b.father_name + ' ' + b.mother_name + ' ' + b.godparent_name).toLowerCase().includes(searchQ.toLowerCase())
  );

  const filteredOrdinations = ordinations.filter(o =>
    (String(o.record_number) + ' ' + o.deacon_full_name + ' ' + o.deacon_rank + ' ' + o.bishop_name).toLowerCase().includes(searchQ.toLowerCase())
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
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:inline-flex gap-2 border-b pb-3 font-bold print:hidden w-full sm:w-auto">
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
      </div>

      {/* شريط البحث */}
      <div className="relative print:hidden">
        <Search size={16} className="absolute right-3.5 top-3 text-gray-400" />
        <input
          placeholder="بحث برقم القيد أو اسم الطفل / الشماس / الأب / الإشبين..."
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
              <input required placeholder="اسم الإشبين  *" className="p-2.5 border rounded-xl" value={bapForm.godparent_name} onChange={e => setBapForm({ ...bapForm, godparent_name: e.target.value })} />
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 font-bold">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">عنوان الشهادة:</label>
                    <input className="w-full p-2 border rounded-xl bg-white" value={design.baptismTitle} onChange={e => updateDesign({ baptismTitle: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-gray-600 mb-1">نص المقدمة:</label>
                    <input className="w-full p-2 border rounded-xl bg-white" value={design.baptismIntro} onChange={e => updateDesign({ baptismIntro: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">اسم الإيبارشية:</label>
                    <input className="w-full p-2 border rounded-xl bg-white" value={settings.diocese_name} onChange={e => setSettings({ ...settings, diocese_name: e.target.value })} />
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2.5">
                  <strong className="text-sm text-[#7a1c24] block">📝 تعديل بيانات هذا القيد قبل الطباعة:</strong>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 font-bold">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">اسم الطفل بالكامل</label>
                      <input className="w-full p-2 border rounded-xl bg-white" value={printBaptism.child_full_name} onChange={e => setPrintBaptism({ ...printBaptism, child_full_name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">اسم المعمودية</label>
                      <input className="w-full p-2 border rounded-xl bg-white" value={printBaptism.baptism_name || ''} onChange={e => setPrintBaptism({ ...printBaptism, baptism_name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">اسم الكنيسة بالشهادة</label>
                      <input className="w-full p-2 border rounded-xl bg-white" value={printBaptism.church_name || settings.church_name} onChange={e => setPrintBaptism({ ...printBaptism, church_name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">اسم الأب</label>
                      <input className="w-full p-2 border rounded-xl bg-white" value={printBaptism.father_name} onChange={e => setPrintBaptism({ ...printBaptism, father_name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">اسم الأم</label>
                      <input className="w-full p-2 border rounded-xl bg-white" value={printBaptism.mother_name} onChange={e => setPrintBaptism({ ...printBaptism, mother_name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">الإشبين </label>
                      <input className="w-full p-2 border rounded-xl bg-white" value={printBaptism.godparent_name} onChange={e => setPrintBaptism({ ...printBaptism, godparent_name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">الأب الكاهن المعمد</label>
                      <input className="w-full p-2 border rounded-xl bg-white" value={printBaptism.priest_name} onChange={e => setPrintBaptism({ ...printBaptism, priest_name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">تاريخ الميلاد</label>
                      <input type="date" className="w-full p-2 border rounded-xl bg-white" value={printBaptism.dob || ''} onChange={e => setPrintBaptism({ ...printBaptism, dob: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">تاريخ المعمودية</label>
                      <input type="date" className="w-full p-2 border rounded-xl bg-white" value={printBaptism.baptism_date || ''} onChange={e => setPrintBaptism({ ...printBaptism, baptism_date: e.target.value, coptic_baptism_date: toCopticDate(e.target.value) })} />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={handleSaveBaptismEdit}
                      className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save size={14} /> {savingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات في السجل'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* جسم الشهادة الفعلي */}
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
                  <strong className="text-sm text-[#7a1c24] block">📝 تعديل بيانات شهادة الشماسية قبل الطباعة:</strong>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 font-bold">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">اسم الشماس</label>
                      <input className="w-full p-2 border rounded-xl bg-white" value={printOrdination.deacon_full_name} onChange={e => setPrintOrdination({ ...printOrdination, deacon_full_name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">الرتبة الشماسية</label>
                      <select className="w-full p-2 border rounded-xl bg-white" value={printOrdination.deacon_rank} onChange={e => setPrintOrdination({ ...printOrdination, deacon_rank: e.target.value })}>
                        {DEACON_RANKS.map((r, i) => <option key={i} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">نوع الإجراء</label>
                      <select className="w-full p-2 border rounded-xl bg-white" value={printOrdination.action_type} onChange={e => setPrintOrdination({ ...printOrdination, action_type: e.target.value })}>
                        <option value="رسامة جديدة">رسامة جديدة</option>
                        <option value="ترقية رتبة">ترقية رتبة</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">اسم نيافة الأب الأسقف</label>
                      <input className="w-full p-2 border rounded-xl bg-white" value={printOrdination.bishop_name} onChange={e => setPrintOrdination({ ...printOrdination, bishop_name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">اسم الكنيسة بالشهادة</label>
                      <input className="w-full p-2 border rounded-xl bg-white" value={printOrdination.church_name || settings.church_name} onChange={e => setPrintOrdination({ ...printOrdination, church_name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">تاريخ الرسامة / الترقية</label>
                      <input type="date" className="w-full p-2 border rounded-xl bg-white" value={printOrdination.ordination_date || ''} onChange={e => setPrintOrdination({ ...printOrdination, ordination_date: e.target.value, coptic_ordination_date: toCopticDate(e.target.value) })} />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={handleSaveOrdinationEdit}
                      className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save size={14} /> {savingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات في السجل'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* جسم الشهادة الفعلي */}
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
    </div>
  );
}
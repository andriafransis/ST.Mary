import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLogger';
import {
  Users, Plus, Search, Edit3, Trash2, Printer, MessageCircle,
  Calendar, MapPin, Phone, Briefcase, GraduationCap, Heart, X, UserPlus
} from 'lucide-react';

const MARITAL_STATUS_OPTIONS = ['متزوج', 'متزوجة', 'أعزب', 'آنسة', 'أرمل', 'أرملة', 'مطلق/ة'];
const FAMILY_STATUS_OPTIONS = [
  'مستقرة',
  'تحتاج متابعة روحية',
  'تحتاج افتقاد دوري',
  'أسرة مستترة / تحتاج دعم',
  'ظروف صحية خاصة',
  'خلافات أسرية تحتاج رعاية'
];

const emptyPerson = (defaultMarital = 'متزوج') => ({
  full_name: '',
  dob: '',
  marital_status: defaultMarital,
  study_status: '',
  job_title: '',
  phone: '',
  is_alive: true
});

const emptyFamilyForm = {
  family_title: '',
  address: '',
  housing_type: 'تمليك',
  family_status: 'مستقرة',
  phone: '',
  next_visit_date: '',
  notes: '',
  husband: emptyPerson('متزوج'),
  wife: emptyPerson('متزوجة'),
  father: emptyPerson('متزوج'),
  mother: emptyPerson('متزوجة'),
  children: [],
  visitations_log: []
};

const emptyChildDraft = {
  full_name: '',
  dob: '',
  marital_status: 'أعزب',
  study_status: '',
  job_title: '',
  phone: ''
};

const emptyVisitDraft = (today) => ({
  visit_date: today,
  method: 'زيارة منزلية',
  visitor_name: '',
  summary: '',
  needs: ''
});

const calcAge = (dob) => {
  if (!dob) return '—';
  const yrs = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return Number.isFinite(yrs) && yrs >= 0 ? `${yrs} سنة` : '—';
};

export default function PriestFamilyVisitation({ priest, onOpenWhatsApp }) {
  const todayISO = new Date().toLocaleDateString('en-CA');
  const [records, setRecords] = useState([]);
  const [churchUsers, setChurchUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyFamilyForm);
  const [childDraft, setChildDraft] = useState(emptyChildDraft);
  const [saving, setSaving] = useState(false);

  const [selectedFamily, setSelectedFamily] = useState(null);
  const [visitDraft, setVisitDraft] = useState(emptyVisitDraft(todayISO));
  const [userLookupQ, setUserLookupQ] = useState('');

  const loadData = async () => {
    if (!priest?.id) return;
    setLoading(true);
    try {
      const [famRes, usrRes] = await Promise.all([
        supabase
          .from('priest_family_visitations')
          .select('*')
          .eq('priest_id', priest.id)
          .order('updated_at', { ascending: false }),
        supabase
          .from('church_users')
          .select('id, full_name, phone, dob, address, marital_status, job_title, detailed_stage, service_stage, housing_type')
          .order('full_name', { ascending: true })
      ]);
      if (!famRes.error && famRes.data) setRecords(famRes.data);
      if (!usrRes.error && usrRes.data) setChurchUsers(usrRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [priest?.id]);

  const handleSaveFamily = async (e) => {
    e.preventDefault();
    const derivedTitle =
      form.family_title.trim() ||
      (form.husband?.full_name ? `أسرة ${form.husband.full_name}` : '') ||
      (form.wife?.full_name ? `أسرة ${form.wife.full_name}` : '');

    if (!derivedTitle) return alert('يرجى كتابة اسم الأسرة أو اسم الزوج / الزوجة');

    setSaving(true);
    try {
      const payload = {
        priest_id: priest.id,
        family_title: derivedTitle,
        address: form.address.trim(),
        housing_type: form.housing_type,
        family_status: form.family_status,
        phone: (form.phone || form.husband?.phone || form.wife?.phone || '').trim(),
        next_visit_date: form.next_visit_date || null,
        notes: form.notes.trim(),
        husband: form.husband,
        wife: form.wife,
        father: form.father,
        mother: form.mother,
        children: form.children || [],
        visitations_log: form.visitations_log || [],
        updated_at: new Date().toISOString()
      };

      if (editingId) {
        const { data, error } = await supabase
          .from('priest_family_visitations')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single();
        if (error) return alert('تعذر التعديل: ' + error.message);
        if (data) {
          setRecords(prev => prev.map(r => (r.id === editingId ? data : r)));
          if (selectedFamily?.id === editingId) setSelectedFamily(data);
          logActivity({
            user: priest,
            actionType: 'تعديل_ملف_افتقاد_أسرة',
            targetTable: 'priest_family_visitations',
            targetId: data.id,
            description: `عدل ملف افتقاد أسرة: ${data.family_title}`
          });
        }
      } else {
        const { data, error } = await supabase
          .from('priest_family_visitations')
          .insert([payload])
          .select()
          .single();
        if (error) return alert('تعذر الحفظ: ' + error.message);
        if (data) {
          setRecords(prev => [data, ...prev]);
          logActivity({
            user: priest,
            actionType: 'إضافة_ملف_افتقاد_أسرة',
            targetTable: 'priest_family_visitations',
            targetId: data.id,
            description: `أضاف ملف افتقاد أسرة: ${data.family_title}`
          });
        }
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyFamilyForm);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFamily = async (fam) => {
    if (!confirm(`حذف ملف افتقاد (${fam.family_title})؟`)) return;
    const { error } = await supabase
      .from('priest_family_visitations')
      .delete()
      .eq('id', fam.id);
    if (!error) {
      setRecords(prev => prev.filter(r => r.id !== fam.id));
      if (selectedFamily?.id === fam.id) setSelectedFamily(null);
    }
  };

  const handleAddVisitLog = async (e) => {
    e.preventDefault();
    if (!selectedFamily || !visitDraft.summary.trim()) return;
    const nextLog = [
      {
        id: `vis-${Date.now()}`,
        visit_date: visitDraft.visit_date || todayISO,
        method: visitDraft.method,
        visitor_name: visitDraft.visitor_name.trim() || priest.full_name,
        summary: visitDraft.summary.trim(),
        needs: visitDraft.needs.trim()
      },
      ...(Array.isArray(selectedFamily.visitations_log) ? selectedFamily.visitations_log : [])
    ];

    const { data, error } = await supabase
      .from('priest_family_visitations')
      .update({ visitations_log: nextLog, updated_at: new Date().toISOString() })
      .eq('id', selectedFamily.id)
      .select()
      .single();

    if (!error && data) {
      setRecords(prev => prev.map(r => (r.id === data.id ? data : r)));
      setSelectedFamily(data);
      setVisitDraft(emptyVisitDraft(todayISO));
    } else if (error) {
      alert(error.message);
    }
  };

  const openEditFamily = (fam) => {
    setEditingId(fam.id);
    setForm({
      ...emptyFamilyForm,
      ...fam,
      next_visit_date: fam.next_visit_date || '',
      husband: { ...emptyPerson('متزوج'), ...(fam.husband || {}) },
      wife: { ...emptyPerson('متزوجة'), ...(fam.wife || {}) },
      father: { ...emptyPerson('متزوج'), ...(fam.father || {}) },
      mother: { ...emptyPerson('متزوجة'), ...(fam.mother || {}) },
      children: Array.isArray(fam.children) ? fam.children : [],
      visitations_log: Array.isArray(fam.visitations_log) ? fam.visitations_log : []
    });
    setShowForm(true);
  };

  const importFromChurchUser = (u, roleKey) => {
    const patch = {
      full_name: u.full_name || '',
      dob: u.dob || '',
      marital_status: u.marital_status || (roleKey === 'wife' || roleKey === 'mother' ? 'متزوجة' : 'متزوج'),
      study_status: u.detailed_stage || u.service_stage || '',
      job_title: u.job_title || '',
      phone: u.phone || '',
      is_alive: true
    };
    setForm(prev => ({
      ...prev,
      family_title: prev.family_title || `أسرة ${u.full_name}`,
      address: prev.address || u.address || '',
      housing_type: prev.housing_type || u.housing_type || 'تمليك',
      phone: prev.phone || u.phone || '',
      [roleKey]: { ...prev[roleKey], ...patch }
    }));
    setUserLookupQ('');
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (statusFilter !== 'all' && r.family_status !== statusFilter) return false;
      if (!searchQ.trim()) return true;
      return JSON.stringify(r).toLowerCase().includes(searchQ.toLowerCase());
    });
  }, [records, statusFilter, searchQ]);

  const matchedLookupUsers = useMemo(() => {
    const q = userLookupQ.trim().toLowerCase();
    if (q.length < 2) return [];
    return churchUsers
      .filter(u => ((u.full_name || '') + ' ' + (u.phone || '')).toLowerCase().includes(q))
      .slice(0, 6);
  }, [userLookupQ, churchUsers]);

  const renderPersonSection = (title, roleKey, allowAliveToggle = false) => {
    const p = form[roleKey] || emptyPerson();
    const setP = (patch) => setForm(prev => ({ ...prev, [roleKey]: { ...prev[roleKey], ...patch } }));

    return (
      <div className="bg-[#fbfaf7] p-3.5 rounded-2xl border border-gray-200 space-y-2.5">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <strong className="text-xs font-black text-[#7a1c24]">{title}</strong>
          {allowAliveToggle && (
            <label className="flex items-center gap-1.5 text-[11px] font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={p.is_alive !== false}
                onChange={e => setP({ is_alive: e.target.checked })}
              />
              <span>{p.is_alive !== false ? 'على قيد الحياة' : 'متنيح / منتقلة 🕊️'}</span>
            </label>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <input
            placeholder="الاسم بالكامل"
            className="p-2 border rounded-xl bg-white"
            value={p.full_name || ''}
            onChange={e => setP({ full_name: e.target.value })}
          />
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">تاريخ الميلاد</label>
            <input
              type="date"
              className="w-full p-2 border rounded-xl bg-white"
              value={p.dob || ''}
              onChange={e => setP({ dob: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">الحالة الاجتماعية</label>
            <select
              className="w-full p-2 border rounded-xl bg-white"
              value={p.marital_status || ''}
              onChange={e => setP({ marital_status: e.target.value })}
            >
              {MARITAL_STATUS_OPTIONS.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
          <input
            placeholder="الحالة الدراسية / المؤهل"
            className="p-2 border rounded-xl bg-white"
            value={p.study_status || ''}
            onChange={e => setP({ study_status: e.target.value })}
          />
          <input
            placeholder="الوظيفة / العمل"
            className="p-2 border rounded-xl bg-white"
            value={p.job_title || ''}
            onChange={e => setP({ job_title: e.target.value })}
          />
          <input
            type="tel"
            placeholder="رقم التليفون"
            className="p-2 border rounded-xl bg-white"
            value={p.phone || ''}
            onChange={e => setP({ phone: e.target.value })}
          />
        </div>
      </div>
    );
  };

  const renderPersonCard = (label, person, emoji) => {
    if (!person || !person.full_name) return null;
    return (
      <div className="p-3 bg-[#fbfaf7] border border-gray-200 rounded-2xl space-y-1 text-xs">
        <div className="flex items-center justify-between gap-2">
          <strong className="text-[#7a1c24]">{emoji} {label}: {person.full_name}</strong>
          {person.is_alive === false && (
            <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px] font-black">متنيح 🕊️</span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-700">
          {person.dob && <span>🎂 {person.dob} ({calcAge(person.dob)})</span>}
          {person.marital_status && <span>💍 {person.marital_status}</span>}
          {person.study_status && <span className="inline-flex items-center gap-1"><GraduationCap size={12} /> {person.study_status}</span>}
          {person.job_title && <span className="inline-flex items-center gap-1"><Briefcase size={12} /> {person.job_title}</span>}
          {person.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {person.phone}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 text-xs" dir="rtl">
      <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-2xs flex flex-wrap justify-between items-center gap-3 print:hidden">
        <div>
          <h3 className="text-sm sm:text-base font-black text-[#7a1c24] flex items-center gap-1.5">
            <Users size={18} /> سجل افتقاد أسر ومخدومي الأب الكاهن ({records.length})
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            تفاصيل الأسرة الكاملة (الزوج، الزوجة، الأبناء، الوالد، الوالدة) + تواريخ الميلاد، الحالة الاجتماعية، الدراسية، الوظائف، العنوان، وسجل الزيارات
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-slate-800 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={14} /> طباعة
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm(emptyFamilyForm);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} /> إضافة أسرة للافتقاد
          </button>
        </div>
      </div>

      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 flex flex-col sm:flex-row gap-2.5 print:hidden">
        <div className="relative flex-1">
          <Search size={15} className="absolute right-3 top-2.5 text-gray-400" />
          <input
            placeholder="بحث باسم الأسرة، الزوج، الزوجة، الوالد، الوالدة، الأبناء، الوظيفة، أو العنوان..."
            className="w-full pr-9 pl-3 py-2 bg-[#fbfaf7] border rounded-xl outline-none focus:border-[#7a1c24]"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>
        <select
          className="p-2 border rounded-xl bg-[#fbfaf7] font-bold"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">كل الحالات الأسرية ({records.length})</option>
          {FAMILY_STATUS_OPTIONS.map(st => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="bg-white p-8 rounded-3xl border text-center text-gray-500 font-bold">جاري تحميل ملفات الأسر...</div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-dashed text-center text-gray-400 font-bold">
          لا توجد أسر مسجلة في سجل الافتقاد حتى الآن. اضغط «إضافة أسرة للافتقاد» لإنشاء أول ملف.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {filteredRecords.map(fam => {
            const kids = Array.isArray(fam.children) ? fam.children : [];
            const visits = Array.isArray(fam.visitations_log) ? fam.visitations_log : [];
            const primaryPhone = fam.phone || fam.husband?.phone || fam.wife?.phone || '';

            return (
              <div key={fam.id} className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-2xs space-y-3">
                <div className="flex flex-wrap justify-between items-start gap-2 border-b border-gray-100 pb-2.5">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="px-2.5 py-0.5 bg-amber-100 text-amber-950 rounded-lg text-[10px] font-black">
                        {fam.family_status}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-900 rounded-lg text-[10px] font-bold">
                        🏠 {fam.housing_type || 'تمليك'}
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-900 rounded-lg text-[10px] font-bold">
                        🕊️ {visits.length} زيارة
                      </span>
                    </div>
                    <strong className="text-sm sm:text-base text-[#7a1c24] block">{fam.family_title}</strong>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-600 mt-0.5">
                      {fam.address && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {fam.address}</span>}
                      {primaryPhone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {primaryPhone}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 print:hidden">
                    {primaryPhone && onOpenWhatsApp && (
                      <button
                        type="button"
                        onClick={() => onOpenWhatsApp({ name: fam.family_title, phone: primaryPhone, defaultCategory: 'افتقاد' })}
                        className="p-2 bg-green-600 text-white rounded-xl cursor-pointer"
                        title="إرسال واتساب"
                      >
                        <MessageCircle size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedFamily(fam)}
                      className="px-3 py-1.5 bg-[#f9ecee] text-[#7a1c24] rounded-xl font-black cursor-pointer"
                    >
                      التفاصيل والزيارات
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditFamily(fam)}
                      className="p-2 bg-gray-100 rounded-xl cursor-pointer"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFamily(fam)}
                      className="p-2 bg-red-50 text-red-700 rounded-xl cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid gap-2">
                  {renderPersonCard('الزوج', fam.husband, '👨')}
                  {renderPersonCard('الزوجة', fam.wife, '👩')}
                  {renderPersonCard('الوالد', fam.father, '👴')}
                  {renderPersonCard('الوالدة', fam.mother, '👵')}
                </div>

                {kids.length > 0 && (
                  <div className="bg-blue-50/40 p-3 rounded-2xl border border-blue-200 space-y-1.5">
                    <strong className="text-[11px] text-blue-950 block">👶 الأبناء ({kids.length}):</strong>
                    <div className="grid gap-1.5">
                      {kids.map((k, idx) => (
                        <div key={idx} className="bg-white p-2 rounded-xl border text-[11px] flex flex-wrap gap-x-3 gap-y-0.5">
                          <strong className="text-gray-900">{k.full_name}</strong>
                          {k.dob && <span>🎂 {k.dob} ({calcAge(k.dob)})</span>}
                          {k.marital_status && <span>💍 {k.marital_status}</span>}
                          {k.study_status && <span>🎓 {k.study_status}</span>}
                          {k.job_title && <span>💼 {k.job_title}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {fam.next_visit_date && (
                  <p className="text-[11px] font-bold text-amber-900 bg-amber-50 px-3 py-1.5 rounded-xl inline-flex items-center gap-1">
                    <Calendar size={12} /> ميعاد الافتقاد القادم: {fam.next_visit_date}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-5 sm:p-6 space-y-4 font-bold max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-sm sm:text-base font-black text-[#7a1c24]">
                {editingId ? '✏️ تعديل ملف الأسرة للافتقاد' : '➕ إضافة أسرة جديدة للافتقاد'}
              </h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-200 space-y-2">
              <label className="text-[11px] text-blue-950 font-black block">
                🔍 تعبئة سريعة من مسجلي الكنيسة (اختياري):
              </label>
              <input
                placeholder="ابحث بالاسم أو الموبايل لاستيراد بيانات الزوج / الزوجة / الوالد / الوالدة..."
                className="w-full p-2 border rounded-xl bg-white"
                value={userLookupQ}
                onChange={e => setUserLookupQ(e.target.value)}
              />
              {matchedLookupUsers.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {matchedLookupUsers.map(u => (
                    <div key={u.id} className="bg-white p-2 rounded-xl border flex flex-wrap justify-between items-center gap-2 text-[11px]">
                      <span><strong>{u.full_name}</strong> ({u.phone || '—'})</span>
                      <div className="flex flex-wrap gap-1">
                        <button type="button" onClick={() => importFromChurchUser(u, 'husband')} className="px-2 py-1 bg-blue-100 text-blue-900 rounded-lg cursor-pointer">كزوج</button>
                        <button type="button" onClick={() => importFromChurchUser(u, 'wife')} className="px-2 py-1 bg-pink-100 text-pink-900 rounded-lg cursor-pointer">كزوجة</button>
                        <button type="button" onClick={() => importFromChurchUser(u, 'father')} className="px-2 py-1 bg-amber-100 text-amber-900 rounded-lg cursor-pointer">كوالد</button>
                        <button type="button" onClick={() => importFromChurchUser(u, 'mother')} className="px-2 py-1 bg-purple-100 text-purple-900 rounded-lg cursor-pointer">كوالدة</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveFamily} className="space-y-4">
              <div className="bg-amber-50/40 p-3.5 rounded-2xl border border-amber-200 space-y-2.5">
                <strong className="text-xs font-black text-amber-950 flex items-center gap-1">
                  <Heart size={14} /> البيانات العامة والعنوان والحالة الأسرية
                </strong>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  <input
                    placeholder="عنوان/اسم الأسرة (مثلاً: أسرة أ. مينا جرجس)"
                    className="p-2 border rounded-xl bg-white"
                    value={form.family_title}
                    onChange={e => setForm({ ...form, family_title: e.target.value })}
                  />
                  <select
                    className="p-2 border rounded-xl bg-white"
                    value={form.family_status}
                    onChange={e => setForm({ ...form, family_status: e.target.value })}
                  >
                    {FAMILY_STATUS_OPTIONS.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <select
                    className="p-2 border rounded-xl bg-white"
                    value={form.housing_type}
                    onChange={e => setForm({ ...form, housing_type: e.target.value })}
                  >
                    <option value="تمليك">تمليك</option>
                    <option value="إيجار جديد">إيجار جديد</option>
                    <option value="إيجار قديم">إيجار قديم</option>
                    <option value="سكن عائلي مشترك">سكن عائلي مشترك</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    required
                    placeholder="العنوان السكني بالتفصيل *"
                    className="sm:col-span-2 p-2 border rounded-xl bg-white"
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                  />
                  <input
                    type="date"
                    title="ميعاد الزيارة القادم"
                    className="p-2 border rounded-xl bg-white"
                    value={form.next_visit_date}
                    onChange={e => setForm({ ...form, next_visit_date: e.target.value })}
                  />
                </div>
              </div>

              {renderPersonSection('① بيانات الزوج', 'husband', false)}
              {renderPersonSection('② بيانات الزوجة', 'wife', false)}
              {renderPersonSection('③ بيانات الوالد (الأب)', 'father', true)}
              {renderPersonSection('④ بيانات الوالدة (الأم)', 'mother', true)}

              <div className="bg-[#fbfaf7] p-3.5 rounded-2xl border border-gray-200 space-y-2.5">
                <strong className="text-xs font-black text-[#7a1c24] block">⑤ بيانات الأبناء</strong>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <input
                    placeholder="اسم الابن / الابنة"
                    className="lg:col-span-2 p-2 border rounded-xl bg-white"
                    value={childDraft.full_name}
                    onChange={e => setChildDraft({ ...childDraft, full_name: e.target.value })}
                  />
                  <input
                    type="date"
                    className="p-2 border rounded-xl bg-white"
                    value={childDraft.dob}
                    onChange={e => setChildDraft({ ...childDraft, dob: e.target.value })}
                  />
                  <select
                    className="p-2 border rounded-xl bg-white"
                    value={childDraft.marital_status}
                    onChange={e => setChildDraft({ ...childDraft, marital_status: e.target.value })}
                  >
                    {MARITAL_STATUS_OPTIONS.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <input
                    placeholder="الحالة الدراسية"
                    className="p-2 border rounded-xl bg-white"
                    value={childDraft.study_status}
                    onChange={e => setChildDraft({ ...childDraft, study_status: e.target.value })}
                  />
                  <input
                    placeholder="الوظيفة"
                    className="p-2 border rounded-xl bg-white"
                    value={childDraft.job_title}
                    onChange={e => setChildDraft({ ...childDraft, job_title: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!childDraft.full_name.trim()) return;
                    setForm(prev => ({ ...prev, children: [...(prev.children || []), childDraft] }));
                    setChildDraft(emptyChildDraft);
                  }}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus size={13} /> + إضافة الابن للقائمة
                </button>

                {(form.children || []).length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {form.children.map((c, idx) => (
                      <div key={idx} className="bg-white p-2 rounded-xl border flex justify-between items-center gap-2">
                        <span>
                          • <strong>{c.full_name}</strong> ({c.marital_status})
                          {c.dob && ` • ميلاد: ${c.dob}`}
                          {c.study_status && ` • دراسة: ${c.study_status}`}
                          {c.job_title && ` • وظيفة: ${c.job_title}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, children: prev.children.filter((_, i) => i !== idx) }))}
                          className="text-red-700 cursor-pointer"
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <textarea
                rows={2}
                placeholder="ملاحظات عامة للأب الكاهن عن الأسرة..."
                className="w-full p-2.5 border rounded-xl bg-white font-normal"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-xl cursor-pointer">
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer"
                >
                  {saving ? 'جاري الحفظ...' : editingId ? 'حفظ تعديلات الأسرة' : 'حفظ ملف الأسرة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedFamily && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-3xl p-5 sm:p-6 space-y-4 font-bold max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-black text-[#7a1c24]">{selectedFamily.family_title}</h3>
                <p className="text-[11px] text-gray-500">📍 {selectedFamily.address || '—'} • 🏷️ {selectedFamily.family_status}</p>
              </div>
              <button type="button" onClick={() => setSelectedFamily(null)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              {renderPersonCard('الزوج', selectedFamily.husband, '👨')}
              {renderPersonCard('الزوجة', selectedFamily.wife, '👩')}
              {renderPersonCard('الوالد', selectedFamily.father, '👴')}
              {renderPersonCard('الوالدة', selectedFamily.mother, '👵')}
            </div>

            {(selectedFamily.children || []).length > 0 && (
              <div className="bg-blue-50/40 p-3 rounded-2xl border border-blue-200 space-y-1.5">
                <strong className="text-xs text-blue-950 block">👶 الأبناء ({selectedFamily.children.length}):</strong>
                {selectedFamily.children.map((c, idx) => (
                  <div key={idx} className="bg-white p-2 rounded-xl border text-xs">
                    <strong>{c.full_name}</strong> • 🎂 {c.dob || '—'} ({calcAge(c.dob)}) • 💍 {c.marital_status} • 🎓 {c.study_status || '—'} • 💼 {c.job_title || '—'}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddVisitLog} className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 space-y-2.5">
              <strong className="text-xs font-black text-amber-950 block">🕊️ تسجيل زيارة / افتقاد جديد للأسرة:</strong>
              <div className="grid sm:grid-cols-3 gap-2">
                <input
                  type="date"
                  className="p-2 border rounded-xl bg-white"
                  value={visitDraft.visit_date}
                  onChange={e => setVisitDraft({ ...visitDraft, visit_date: e.target.value })}
                />
                <select
                  className="p-2 border rounded-xl bg-white"
                  value={visitDraft.method}
                  onChange={e => setVisitDraft({ ...visitDraft, method: e.target.value })}
                >
                  <option value="زيارة منزلية">زيارة منزلية</option>
                  <option value="اتصال هاتفي">اتصال هاتفي</option>
                  <option value="رسالة واتساب">رسالة واتساب</option>
                  <option value="لقاء بالكنيسة">لقاء بالكنيسة</option>
                </select>
                <input
                  placeholder="القائم بالافتقاد (افتراضياً أبونا)"
                  className="p-2 border rounded-xl bg-white"
                  value={visitDraft.visitor_name}
                  onChange={e => setVisitDraft({ ...visitDraft, visitor_name: e.target.value })}
                />
              </div>
              <input
                required
                placeholder="ملخص الزيارة والحالة الروحية والأسرية *"
                className="w-full p-2 border rounded-xl bg-white"
                value={visitDraft.summary}
                onChange={e => setVisitDraft({ ...visitDraft, summary: e.target.value })}
              />
              <div className="flex gap-2">
                <input
                  placeholder="احتياجات أو متطلبات المتابعة (اختياري)"
                  className="flex-1 p-2 border rounded-xl bg-white"
                  value={visitDraft.needs}
                  onChange={e => setVisitDraft({ ...visitDraft, needs: e.target.value })}
                />
                <button type="submit" className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer">
                  + حفظ الزيارة
                </button>
              </div>
            </form>

            <div className="space-y-2">
              <strong className="text-xs text-gray-900 block">
                📜 سجل الزيارات السابقة ({(selectedFamily.visitations_log || []).length}):
              </strong>
              {(selectedFamily.visitations_log || []).length === 0 ? (
                <p className="text-gray-400 text-center py-3 bg-[#fbfaf7] rounded-xl">لا توجد زيارات مسجلة بعد.</p>
              ) : (
                selectedFamily.visitations_log.map((v, i) => (
                  <div key={v.id || i} className="p-3 bg-[#fbfaf7] border rounded-2xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[#7a1c24] font-black">📅 {v.visit_date} • {v.method}</span>
                      <span className="text-[11px] text-gray-500">{v.visitor_name}</span>
                    </div>
                    <p className="text-gray-800">{v.summary}</p>
                    {v.needs && <p className="text-amber-900 text-[11px]">⚠️ متطلبات: {v.needs}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
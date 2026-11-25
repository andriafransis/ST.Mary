import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ROLES } from '../lib/permissions';
import { Search, Edit3, Save, X, Users } from 'lucide-react';

const MARITAL_OPTIONS = ['أعزب', 'متزوج', 'مطلق', 'أرمل'];
const EMPLOYMENT_OPTIONS = ['يعمل', 'لا يعمل', 'طالب', 'متقاعد'];

const roleLabel = (key) => ROLES.find(r => r.key === key)?.label || key || '—';

const calcAge = (dob) => {
  if (!dob) return '';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? `${age} سنة` : '';
};

const maritalOf = (u) => (u.marital_status && String(u.marital_status).trim()) || 'أعزب';

export default function SocialStatusPage({ users = [], currentUser, canEdit = false, onRefresh }) {
  const [search, setSearch] = useState('');
  const [fMarital, setFMarital] = useState('');
  const [fEmployment, setFEmployment] = useState('');
  const [fDependents, setFDependents] = useState('');
  const [fRole, setFRole] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const people = useMemo(
    () => users.filter(u => u.status !== 'pending' && u.status !== 'rejected'),
    [users]
  );

  const stats = useMemo(() => {
    const count = (fn) => people.filter(fn).length;
    return {
      total: people.length,
      married: count(u => maritalOf(u) === 'متزوج'),
      single: count(u => maritalOf(u) === 'أعزب'),
      divorced: count(u => maritalOf(u) === 'مطلق'),
      widowed: count(u => maritalOf(u) === 'أرمل'),
      working: count(u => u.employment_status === 'يعمل'),
      notWorking: count(u => u.employment_status === 'لا يعمل'),
      dependents: count(u => u.has_dependents === true)
    };
  }, [people]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter(u => {
      if (q) {
        const hay = `${u.full_name || ''} ${u.phone || ''} ${u.username || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fMarital && maritalOf(u) !== fMarital) return false;
      if (fEmployment && (u.employment_status || '') !== fEmployment) return false;
      if (fDependents === 'yes' && u.has_dependents !== true) return false;
      if (fDependents === 'no' && u.has_dependents === true) return false;
      if (fRole && u.role !== fRole) return false;
      return true;
    });
  }, [people, search, fMarital, fEmployment, fDependents, fRole]);

  const openEdit = (u) => {
    setError('');
    setEditing(u);
    setForm({
      marital_status: maritalOf(u),
      employment_status: u.employment_status || '',
      job_title: u.job_title || '',
      has_dependents: u.has_dependents === true,
      dependents_count: u.dependents_count || 0,
      social_notes: u.social_notes || ''
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEdit || !editing) return;
    setSaving(true);
    setError('');
    const payload = {
      marital_status: form.marital_status,
      employment_status: form.employment_status,
      job_title: (form.job_title || '').trim(),
      has_dependents: Boolean(form.has_dependents),
      dependents_count: form.has_dependents ? Number(form.dependents_count) || 0 : 0,
      social_notes: (form.social_notes || '').trim(),
      social_updated_by: currentUser?.full_name || currentUser?.username || '',
      social_updated_at: new Date().toISOString()
    };
    const { error: err } = await supabase.from('church_users').update(payload).eq('id', editing.id);
    setSaving(false);
    if (err) {
      setError('تعذر الحفظ: ' + (err.message || 'خطأ غير معروف') + ' — تأكد إنك شغّلت ملف SQL.');
      return;
    }
    setEditing(null);
    if (onRefresh) onRefresh();
  };

  const Chip = ({ label, value, active, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-xl border text-[11px] font-black cursor-pointer transition ${active ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-gray-800 hover:bg-gray-50'}`}
    >
      {label} <span className={active ? 'text-amber-200' : 'text-[#7a1c24]'}>{value}</span>
    </button>
  );

  return (
    <div className="space-y-4 text-xs" dir="rtl">
      <div className="bg-linear-to-l from-[#5c1319] to-[#7a1c24] text-white p-4 rounded-3xl shadow-sm">
        <h2 className="text-lg font-black text-amber-200 flex items-center gap-2"><Users size={20} /> 👪 الحالة الاجتماعية والعمل</h2>
        <p className="text-white/85 mt-1">
          {canEdit ? 'عرض وتعديل بيانات الأفراد: الحالة الاجتماعية، العمل، والإعالة.' : 'عرض فقط — ليس لديك صلاحية التعديل.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip label="الكل" value={stats.total} active={!fMarital && !fEmployment && !fDependents} onClick={() => { setFMarital(''); setFEmployment(''); setFDependents(''); }} />
        <Chip label="💍 متزوجين" value={stats.married} active={fMarital === 'متزوج'} onClick={() => setFMarital(fMarital === 'متزوج' ? '' : 'متزوج')} />
        <Chip label="أعزب" value={stats.single} active={fMarital === 'أعزب'} onClick={() => setFMarital(fMarital === 'أعزب' ? '' : 'أعزب')} />
        <Chip label="مطلق" value={stats.divorced} active={fMarital === 'مطلق'} onClick={() => setFMarital(fMarital === 'مطلق' ? '' : 'مطلق')} />
        <Chip label="أرمل" value={stats.widowed} active={fMarital === 'أرمل'} onClick={() => setFMarital(fMarital === 'أرمل' ? '' : 'أرمل')} />
        <Chip label="💼 يعمل" value={stats.working} active={fEmployment === 'يعمل'} onClick={() => setFEmployment(fEmployment === 'يعمل' ? '' : 'يعمل')} />
        <Chip label="لا يعمل" value={stats.notWorking} active={fEmployment === 'لا يعمل'} onClick={() => setFEmployment(fEmployment === 'لا يعمل' ? '' : 'لا يعمل')} />
        <Chip label="👶 يعول" value={stats.dependents} active={fDependents === 'yes'} onClick={() => setFDependents(fDependents === 'yes' ? '' : 'yes')} />
      </div>

      <div className="bg-white p-3 rounded-2xl border grid md:grid-cols-5 gap-2 font-bold">
        <div className="md:col-span-2 relative">
          <Search size={14} className="absolute right-3 top-3 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الموبايل..."
            className="w-full p-2.5 pr-9 border rounded-xl outline-none focus:border-[#7a1c24]"
          />
        </div>
        <select className="p-2.5 border rounded-xl" value={fMarital} onChange={e => setFMarital(e.target.value)}>
          <option value="">كل الحالات الاجتماعية</option>
          {MARITAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className="p-2.5 border rounded-xl" value={fEmployment} onChange={e => setFEmployment(e.target.value)}>
          <option value="">كل حالات العمل</option>
          {EMPLOYMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className="p-2.5 border rounded-xl" value={fRole} onChange={e => setFRole(e.target.value)}>
          <option value="">كل الأدوار</option>
          {ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </div>

      <p className="text-gray-500 font-bold">النتائج: {filtered.length} من {people.length}</p>

      <div className="grid gap-2">
        {filtered.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border text-center text-gray-500">لا توجد نتائج مطابقة.</div>
        ) : filtered.map(u => (
          <div key={u.id} className="bg-white p-3.5 rounded-2xl border flex justify-between items-start gap-2">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <strong className="text-sm text-gray-900">{u.full_name}</strong>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-bold">{roleLabel(u.role)}</span>
                <span className="px-2 py-0.5 bg-rose-50 text-rose-900 rounded text-[10px] font-bold">💍 {maritalOf(u)}</span>
                {u.employment_status && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-900 rounded text-[10px] font-bold">💼 {u.employment_status}</span>
                )}
                {u.has_dependents === true && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-bold">
                    👶 يعول{u.dependents_count ? ` (${u.dependents_count})` : ''}
                  </span>
                )}
              </div>
              <p className="text-gray-500 font-bold">
                {u.phone ? `📞 ${u.phone}` : ''}{u.dob ? ` • 🎂 ${calcAge(u.dob)}` : ''}{u.job_title ? ` • ${u.job_title}` : ''}
              </p>
              {u.social_notes && <p className="text-gray-600 whitespace-pre-line">📝 {u.social_notes}</p>}
            </div>
            {canEdit && (
              <button type="button" onClick={() => openEdit(u)} className="p-2 bg-gray-100 rounded-xl cursor-pointer shrink-0" title="تعديل">
                <Edit3 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {editing && canEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-3xl p-5 w-full max-w-md space-y-3 font-bold max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black text-[#7a1c24]">✏️ {editing.full_name}</h3>
              <button type="button" onClick={() => setEditing(null)} className="p-1 cursor-pointer"><X size={18} /></button>
            </div>

            <div>
              <label className="block mb-1">الحالة الاجتماعية</label>
              <select className="w-full p-2.5 border rounded-xl" value={form.marital_status} onChange={e => setForm({ ...form, marital_status: e.target.value })}>
                {MARITAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1">حالة العمل</label>
                <select className="w-full p-2.5 border rounded-xl" value={form.employment_status} onChange={e => setForm({ ...form, employment_status: e.target.value })}>
                  <option value="">— غير محدد —</option>
                  {EMPLOYMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1">الوظيفة</label>
                <input className="w-full p-2.5 border rounded-xl" value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} placeholder="مثال: محاسب" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 items-end">
              <label className="flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer">
                <input type="checkbox" checked={form.has_dependents} onChange={e => setForm({ ...form, has_dependents: e.target.checked })} className="w-4 h-4 accent-[#7a1c24]" />
                يعول أسرة / أفراد
              </label>
              {form.has_dependents && (
                <div>
                  <label className="block mb-1">عدد من يعولهم</label>
                  <input type="number" min="0" className="w-full p-2.5 border rounded-xl" value={form.dependents_count} onChange={e => setForm({ ...form, dependents_count: e.target.value })} />
                </div>
              )}
            </div>

            <div>
              <label className="block mb-1">ملاحظات</label>
              <textarea rows="3" className="w-full p-2.5 border rounded-xl font-normal" value={form.social_notes} onChange={e => setForm({ ...form, social_notes: e.target.value })} />
            </div>

            {error && <p className="text-red-600 text-[11px]">{error}</p>}

            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[#7a1c24] text-white rounded-xl flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60">
                <Save size={14} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="px-4 border rounded-xl cursor-pointer">إلغاء</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

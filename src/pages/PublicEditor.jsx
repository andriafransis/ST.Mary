import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadChurchMedia } from '../lib/mediaUpload';
import {
  TABLE,
  SYSTEM_KINDS,
  SECTION_DEFS,
  CONTENT_SPECS,
  HEADER_PRESETS,
  PAGE_BG_PRESETS,
  DEFAULT_THEME,
  EMPTY_FORM,
  getSpecForKind,
  readTheme,
  readSections,
  saveSections,
  saveTheme,
  probeSchema,
  buildContentPayload,
  formFromItem,
  getItemSchedule,
  itemStatus,
  looksLikeSystemJson,
  formatDateFull,
  toEmbedUrl,
  isImageUrl,
  isSafeHttpUrl
} from '../lib/publicContent';
import {
  Trash2, Edit3, Plus, Globe, Upload, X, Layers, AlertTriangle, Check, Calendar, Clock,
  Link2, Copy, Eye, EyeOff, Star, ArrowUp, ArrowDown, Search, RefreshCw, Palette,
  ListOrdered, Database, FileText, Link as LinkIcon
} from 'lucide-react';

const SINGLETON_KINDS = ['logo', 'virgin_mary'];

const MIGRATION_SQL = `alter table church_public_content
  add column if not exists is_published boolean not null default true,
  add column if not exists is_featured  boolean not null default false,
  add column if not exists event_date   date,
  add column if not exists expires_on   date;

notify pgrst, 'reload schema';`;

const STATUS_STYLE = {
  live: { label: 'منشور', cls: 'bg-emerald-100 text-emerald-900' },
  featured: { label: '⭐ مميز', cls: 'bg-amber-300 text-[#4a0e13]' },
  draft: { label: 'مسودة', cls: 'bg-gray-800 text-white' },
  expired: { label: 'منتهي', cls: 'bg-red-100 text-red-800' }
};

const TABS = [
  { id: 'content', label: 'المحتوى', icon: <FileText size={15} /> },
  { id: 'sections', label: 'الأقسام والترتيب', icon: <ListOrdered size={15} /> },
  { id: 'theme', label: 'المظهر', icon: <Palette size={15} /> },
  { id: 'linked', label: 'القداسات والفعاليات', icon: <Calendar size={15} /> }
];

function Toggle({ checked, onChange, label, hint, disabled = false }) {
  return (
    <label className={`flex items-start gap-3 p-3 rounded-2xl border bg-white ${disabled ? 'opacity-50' : 'cursor-pointer hover:border-[#7a1c24]/40'} transition`}>
      <input type="checkbox" className="mt-1 w-4 h-4 accent-[#7a1c24]" checked={Boolean(checked)} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="block text-xs font-black text-gray-900">{label}</span>
        {hint && <span className="block text-[11px] font-normal text-gray-500 mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

export default function PublicEditor({ onViewPublic, focus = null, onFocusConsumed }) {
  const [tab, setTab] = useState('content');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [schemaReady, setSchemaReady] = useState(false);
  const [toast, setToast] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [filterKind, setFilterKind] = useState('all');
  const [search, setSearch] = useState('');
  const formRef = useRef(null);

  const [sectionDraft, setSectionDraft] = useState([]);
  const [themeDraft, setThemeDraft] = useState(DEFAULT_THEME);
  const [savingMeta, setSavingMeta] = useState(false);

  const [linkedEvents, setLinkedEvents] = useState([]);
  const [linkedMasses, setLinkedMasses] = useState([]);
  const [linkedEdit, setLinkedEdit] = useState(null); // { table, row }

  const notify = useCallback((text, type = 'ok') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      setSchemaReady(await probeSchema(supabase, true));
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) notify('تعذر تحميل البيانات: ' + error.message, 'err');
      else setItems(data || []);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const loadLinked = useCallback(async () => {
    const [ev, ms] = await Promise.all([
      supabase.from('church_events').select('*').order('created_at', { ascending: false }),
      supabase.from('priest_masses').select('*').order('mass_date', { ascending: true })
    ]);
    if (ev.data) setLinkedEvents(ev.data);
    if (ms.data) setLinkedMasses(ms.data);
  }, []);

  useEffect(() => {
    loadItems();
    loadLinked();
  }, [loadItems, loadLinked]);

  const customCategories = useMemo(() => items.filter(i => i.kind === 'category_def'), [items]);
  const currentSpec = getSpecForKind(form.kind, customCategories);

  const allKinds = useMemo(() => [
    ...CONTENT_SPECS.map(s => ({ value: s.value, label: s.label })),
    ...customCategories.map(c => ({ value: c.title, label: `✨ ${c.body || c.title}` }))
  ], [customCategories]);

  const cleanItems = useMemo(() => items.filter(it => !SYSTEM_KINDS.includes(it.kind) && !looksLikeSystemJson(it)), [items]);
  const pollutedItems = useMemo(() => items.filter(it => !SYSTEM_KINDS.includes(it.kind) && looksLikeSystemJson(it)), [items]);

  const displayedItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cleanItems.filter(it => {
      if (filterKind !== 'all' && it.kind !== filterKind) return false;
      if (!q) return true;
      return [it.title, it.body, it.location, it.time_text].some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [cleanItems, filterKind, search]);

  // مزامنة مسودات الأقسام والمظهر مع آخر بيانات محمّلة
  useEffect(() => {
    setSectionDraft(readSections(items).map(s => ({ ...s })));
    setThemeDraft(readTheme(items).theme);
  }, [items]);

  /* ───── فتح عنصر/نوع محدد قادم من الصفحة (وضع التحرير) ───── */
  useEffect(() => {
    if (!focus || loading) return;
    if (focus.itemId) {
      const it = items.find(i => String(i.id) === String(focus.itemId));
      if (it) startEdit(it);
    } else if (focus.kind) {
      resetForm(focus.kind);
    }
    setTab('content');
    onFocusConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, loading]);

  const resetForm = (kind = form.kind) => {
    setEditingId(null);
    setCreatingCat(false);
    setForm({ ...EMPTY_FORM, kind });
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const startEdit = (it) => {
    setEditingId(it.id);
    setCreatingCat(false);
    setForm(formFromItem(it));
    setTab('content');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  /* ───── أقسام مخصصة ───── */
  const handleCreateCategory = async () => {
    const label = newCatName.trim();
    if (!label) return notify('اكتب اسم القسم الجديد أولاً', 'err');
    const key = 'cat_' + Date.now();
    const { data, error } = await supabase
      .from(TABLE)
      .insert([{ kind: 'category_def', title: key, body: label, location: 'visible', sort_order: customCategories.length + 1 }])
      .select()
      .single();
    if (error) return notify('خطأ أثناء إنشاء القسم: ' + error.message, 'err');
    setItems(prev => [data, ...prev]);
    setForm(prev => ({ ...prev, kind: key }));
    setNewCatName('');
    setCreatingCat(false);
    notify('تم إنشاء القسم ✅');
  };

  const handleRenameCategory = async (cat) => {
    const nextName = prompt('اكتب الاسم الجديد للقسم:', cat.body || cat.title);
    if (!nextName || !nextName.trim()) return;
    const { data, error } = await supabase.from(TABLE).update({ body: nextName.trim() }).eq('id', cat.id).select().single();
    if (error) return notify('تعذر تعديل الاسم: ' + error.message, 'err');
    setItems(prev => prev.map(i => (i.id === cat.id ? data : i)));
  };

  const handleDeleteCategory = async (cat) => {
    const count = items.filter(i => i.kind === cat.title).length;
    if (!confirm(`حذف قسم "${cat.body || cat.title}" و${count} بند بداخله نهائياً؟`)) return;
    const r1 = await supabase.from(TABLE).delete().eq('kind', cat.title);
    if (r1.error) return notify('تعذر حذف البنود: ' + r1.error.message, 'err');
    const r2 = await supabase.from(TABLE).delete().eq('id', cat.id);
    if (r2.error) return notify('تعذر حذف القسم: ' + r2.error.message, 'err');
    setItems(prev => prev.filter(i => i.id !== cat.id && i.kind !== cat.title));
    if (filterKind === cat.title) setFilterKind('all');
    if (form.kind === cat.title) resetForm('news');
  };

  /* ───── رفع الملفات ───── */
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadChurchMedia(file, form.kind || 'public');
      setForm(prev => ({ ...prev, url }));
      notify('تم رفع الملف ✅');
    } catch (err) {
      notify('تعذر رفع الملف: ' + err.message, 'err');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  /* ───── حفظ بند ───── */
  const urlRequired = currentSpec.urlLabel.includes('*');

  const validateForm = () => {
    if (!form.title.trim()) return 'يرجى إدخال العنوان / الاسم';
    const url = form.url.trim();
    if (urlRequired && !url) return 'الرابط أو الملف مطلوب لهذا النوع';
    if (url && !isSafeHttpUrl(url) && !url.startsWith('/')) return 'الرابط لازم يبدأ بـ https:// أو http://';
    if (form.event_date && form.expires_on && form.expires_on < form.event_date) return 'تاريخ الانتهاء قبل تاريخ المناسبة!';
    return '';
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const problem = validateForm();
    if (problem) return notify(problem, 'err');
    setSaving(true);
    try {
      const payload = buildContentPayload(form, schemaReady);

      // الهوية (اللوجو / العذراء) سجل واحد فقط: نعدّل الموجود بدل ما نكرر
      let targetId = editingId;
      if (!targetId && SINGLETON_KINDS.includes(form.kind)) {
        targetId = items.find(i => i.kind === form.kind)?.id || null;
      }

      const res = targetId
        ? await supabase.from(TABLE).update(payload).eq('id', targetId).select().single()
        : await supabase.from(TABLE).insert([payload]).select().single();

      if (res.error) return notify('تعذر الحفظ: ' + res.error.message, 'err');
      setItems(prev => (targetId ? prev.map(i => (i.id === targetId ? res.data : i)) : [res.data, ...prev]));
      notify(targetId ? 'تم حفظ التعديل ✅' : 'تمت الإضافة والنشر ✅');
      resetForm(form.kind);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (it) => {
    const { id, created_at, ...rest } = it;
    const copy = { ...rest, title: `${it.title} (نسخة)` };
    if ('is_published' in copy) copy.is_published = false;
    const { data, error } = await supabase.from(TABLE).insert([copy]).select().single();
    if (error) return notify('تعذر النسخ: ' + error.message, 'err');
    setItems(prev => [data, ...prev]);
    notify('تم عمل نسخة كمسودة ✅');
  };

  const patchItem = async (it, patch, okMsg) => {
    const { data, error } = await supabase.from(TABLE).update(patch).eq('id', it.id).select().single();
    if (error) return notify('تعذر التحديث: ' + error.message, 'err');
    setItems(prev => prev.map(i => (i.id === it.id ? data : i)));
    if (okMsg) notify(okMsg);
  };

  const handleDelete = async (it) => {
    if (!confirm(`حذف "${it.title}" نهائياً من صفحة الكنيسة؟`)) return;
    const { error } = await supabase.from(TABLE).delete().eq('id', it.id);
    if (error) return notify('تعذر الحذف: ' + error.message, 'err');
    setItems(prev => prev.filter(i => i.id !== it.id));
    if (editingId === it.id) resetForm();
  };

  const handleCleanPolluted = async () => {
    if (pollutedItems.length === 0) return;
    if (!confirm(`سيتم حذف ${pollutedItems.length} سجل تالف من جدول المحتوى العام. هل أنت متأكد؟`)) return;
    const ids = pollutedItems.map(i => i.id);
    const { error } = await supabase.from(TABLE).delete().in('id', ids);
    if (error) return notify('تعذر التنظيف: ' + error.message, 'err');
    setItems(prev => prev.filter(i => !ids.includes(i.id)));
  };

  /* ───── الأقسام ───── */
  const moveSection = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= sectionDraft.length) return;
    const next = [...sectionDraft];
    [next[idx], next[j]] = [next[j], next[idx]];
    setSectionDraft(next);
  };
  const patchSection = (key, patch) => setSectionDraft(prev => prev.map(s => (s.key === key ? { ...s, ...patch } : s)));

  const handleSaveSections = async () => {
    setSavingMeta(true);
    try {
      const { error } = await saveSections(supabase, sectionDraft);
      if (error) return notify('تعذر حفظ الأقسام: ' + error.message, 'err');
      await loadItems();
      notify('تم حفظ ترتيب الأقسام ✅');
    } finally {
      setSavingMeta(false);
    }
  };

  const resetSections = () => setSectionDraft(SECTION_DEFS.map(d => ({ ...d, title: d.defaultTitle, hidden: false, order: d.sort_order, cfgRow: null })));

  /* ───── المظهر ───── */
  const handleSaveTheme = async () => {
    setSavingMeta(true);
    try {
      const { error } = await saveTheme(supabase, themeDraft);
      if (error) return notify('تعذر حفظ المظهر: ' + error.message, 'err');
      await loadItems();
      notify('تم حفظ المظهر ✅');
    } finally {
      setSavingMeta(false);
    }
  };

  /* ───── القداسات والفعاليات المرتبطة ───── */
  const saveLinked = async (e) => {
    e.preventDefault();
    if (!linkedEdit) return;
    const { table, row } = linkedEdit;
    const { id, created_at, priest_id, ...clean } = row;
    const { data, error } = await supabase.from(table).update(clean).eq('id', id).select().single();
    if (error) return notify('تعذر الحفظ: ' + error.message, 'err');
    if (table === 'church_events') setLinkedEvents(prev => prev.map(r => (r.id === id ? data : r)));
    else setLinkedMasses(prev => prev.map(r => (r.id === id ? data : r)));
    setLinkedEdit(null);
    notify('تم الحفظ ✅');
  };

  const deleteLinked = async (table, row, label) => {
    if (!confirm(`حذف "${label}" نهائياً؟`)) return;
    const { error } = await supabase.from(table).delete().eq('id', row.id);
    if (error) return notify('تعذر الحذف: ' + error.message, 'err');
    if (table === 'church_events') setLinkedEvents(prev => prev.filter(r => r.id !== row.id));
    else setLinkedMasses(prev => prev.filter(r => r.id !== row.id));
  };

  const ytEmbedUrl = toEmbedUrl(form.url);
  const canUploadFile = Boolean(currentSpec.acceptMedia);
  const publishedCount = cleanItems.filter(i => itemStatus(i) === 'live' || itemStatus(i) === 'featured').length;
  const draftCount = cleanItems.filter(i => itemStatus(i) === 'draft').length;
  const input = 'w-full p-2.5 border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#7a1c24]/30';

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-4 text-xs md:text-sm" dir="rtl">
      {toast && (
        <div role="status" className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-2xl text-xs font-black ${toast.type === 'err' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.text}
        </div>
      )}

      {/* ───── الهيدر ───── */}
      <div className="bg-white p-4 rounded-3xl border shadow-sm flex flex-wrap justify-between items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-black text-[#7a1c24]">✏️ إدارة وتعديل واجهة الكنيسة العامة</h2>
          <p className="text-xs text-gray-500">
            {cleanItems.length} بند • {publishedCount} منشور{draftCount > 0 ? ` • ${draftCount} مسودة` : ''} — كل تعديل يظهر مباشرة في الصفحة العامة
          </p>
        </div>
        {onViewPublic && (
          <button type="button" onClick={onViewPublic} className="px-4 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition">
            <Globe size={15} /> معاينة صفحة الكنيسة
          </button>
        )}
      </div>

      {/* ───── تنبيه ترقية الداتابيز ───── */}
      {!loading && !schemaReady && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2 text-amber-950">
            <Database size={18} className="shrink-0 mt-0.5 text-amber-700" />
            <div>
              <strong className="block text-xs font-black">ميزات النشر والتمييز وتاريخ الانتهاء محتاجة ترقية بسيطة للداتابيز</strong>
              <span className="text-[11px] text-amber-900">الصفحة والمحرر شغالين دلوقتي بشكل عادي. نفّذ الكود ده مرة واحدة في Supabase → SQL Editor عشان تتفعّل (أو استخدم ملف public_content_upgrade.sql).</span>
            </div>
          </div>
          <pre dir="ltr" className="text-[11px] bg-white border rounded-xl p-3 overflow-x-auto text-left whitespace-pre-wrap">{MIGRATION_SQL}</pre>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigator.clipboard?.writeText(MIGRATION_SQL).then(() => notify('تم نسخ الكود ✅'))} className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black cursor-pointer inline-flex items-center gap-1.5"><Copy size={13} /> نسخ الكود</button>
            <button type="button" onClick={loadItems} className="px-3.5 py-2 bg-white border rounded-xl font-black cursor-pointer inline-flex items-center gap-1.5"><RefreshCw size={13} /> تحقق مرة أخرى</button>
          </div>
        </div>
      )}

      {pollutedItems.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-start gap-2 text-red-900">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-600" />
            <div>
              <strong className="block text-xs font-black">تم اكتشاف {pollutedItems.length} سجلات بيانات نظام/صلاحيات (JSON) داخل جدول المحتوى العام</strong>
              <span className="text-[11px] text-red-700">مخفية تلقائياً من الصفحة، ويمكنك حذفها نهائياً الآن.</span>
            </div>
          </div>
          <button type="button" onClick={handleCleanPolluted} className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black cursor-pointer shrink-0">تنظيف وحذف ({pollutedItems.length})</button>
        </div>
      )}

      {/* ───── التابات ───── */}
      <div className="flex flex-wrap gap-1.5 bg-white p-1.5 rounded-2xl border shadow-2xs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition ${tab === t.id ? 'bg-[#7a1c24] text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ═════════════ تاب المحتوى ═════════════ */}
      {tab === 'content' && (
        <>
          <form ref={formRef} onSubmit={handleSave} className="bg-white p-5 rounded-3xl border shadow-sm space-y-4 font-bold scroll-mt-24">
            {editingId && (
              <div className="bg-amber-50 border border-amber-300 px-3 py-2 rounded-xl flex justify-between items-center text-xs text-amber-950">
                <span>✏️ أنت الآن في وضع تعديل البند المحدد</span>
                <button type="button" onClick={() => resetForm()} className="text-red-700 underline cursor-pointer">إلغاء التعديل</button>
              </div>
            )}
            {!editingId && SINGLETON_KINDS.includes(form.kind) && items.some(i => i.kind === form.kind) && (
              <div className="bg-blue-50 border border-blue-200 px-3 py-2 rounded-xl text-[11px] text-blue-900 font-bold">
                هذا النوع له سجل واحد فقط — الحفظ هنا سيحدّث السجل الموجود بدل إنشاء نسخة مكررة.
              </div>
            )}

            <div className="grid md:grid-cols-12 gap-3 items-end bg-[#fbfaf7] p-3.5 rounded-2xl border">
              <div className="md:col-span-7">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-gray-700">نوع المحتوى / القسم *</label>
                  <button type="button" onClick={() => setCreatingCat(v => !v)} className="text-[11px] text-[#7a1c24] underline cursor-pointer">{creatingCat ? 'إلغاء' : '+ إنشاء قسم جديد'}</button>
                </div>
                {creatingCat ? (
                  <div className="flex gap-1.5">
                    <input autoFocus placeholder="اكتب اسم القسم الجديد..." className={`${input} flex-1`} value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                    <button type="button" onClick={handleCreateCategory} className="px-4 bg-[#7a1c24] text-white rounded-xl text-xs cursor-pointer shrink-0">حفظ القسم</button>
                  </div>
                ) : (
                  <select className={input} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
                    {allKinds.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                )}
              </div>
              <div className="md:col-span-3">
                <span className="text-[11px] text-gray-500 block mb-1">تخصص هذا البند</span>
                <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl text-xs truncate">{currentSpec.domain}</div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-700 mb-1" title="الأصغر يظهر أولاً">ترتيب العرض</label>
                <input type="number" className={input} value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-700 mb-1">{currentSpec.titleLabel}</label>
                <input required placeholder={currentSpec.titlePlaceholder} className={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">{currentSpec.locationLabel}</label>
                <input placeholder={currentSpec.locationPlaceholder} className={input} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>

            <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/80 space-y-2">
              <div className="text-xs font-black text-amber-950 flex items-center gap-1.5"><Calendar size={14} /> الميعاد والتوقيت</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-600 mb-1">{currentSpec.dateLabel}</label>
                  <input type="date" className={input} value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-600 mb-1 flex items-center gap-1"><Clock size={12} /> {currentSpec.timeLabel}</label>
                  <input placeholder={currentSpec.timePlaceholder} className={input} value={form.event_time} onChange={e => setForm({ ...form, event_time: e.target.value })} />
                </div>
              </div>
              {form.event_date && <p className="text-[11px] text-amber-900 font-normal">سيظهر في الصفحة: {formatDateFull(getItemSchedule({ event_date: form.event_date }).date)}{form.event_time ? ` • ${form.event_time}` : ''}</p>}
            </div>

            <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200 space-y-2.5">
              <label className="text-xs text-indigo-950 flex items-center gap-1.5"><Link2 size={14} /> {currentSpec.urlLabel}</label>
              <div className="flex flex-wrap gap-2 items-center">
                {canUploadFile && (
                  <label className={`px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 ${uploading ? 'bg-gray-300 text-gray-600' : 'bg-indigo-700 hover:bg-indigo-800 text-white'}`}>
                    <Upload size={14} /> {uploading ? 'جاري الرفع...' : 'رفع من الجهاز'}
                    <input type="file" accept={currentSpec.acceptMedia} className="hidden" disabled={uploading} onChange={handleUpload} />
                  </label>
                )}
                <input placeholder={currentSpec.urlPlaceholder} className={`${input} flex-1 min-w-[200px]`} value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
                {form.url && <button type="button" onClick={() => setForm(prev => ({ ...prev, url: '' }))} className="p-2 bg-white border rounded-xl text-red-600 cursor-pointer" title="مسح الرابط"><X size={15} /></button>}
              </div>
              {form.url && isImageUrl(form.url) && <img src={form.url} alt="معاينة" className="h-24 rounded-xl border object-cover bg-white" />}
              {ytEmbedUrl && <div className="aspect-video max-w-sm rounded-xl overflow-hidden border bg-black"><iframe src={ytEmbedUrl} title="معاينة" className="w-full h-full" allowFullScreen /></div>}
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">{currentSpec.bodyLabel}</label>
              <textarea rows="4" placeholder={currentSpec.bodyPlaceholder} className={`${input} font-normal`} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
            </div>

            {/* النشر والتمييز والانتهاء — تظهر بعد ترقية الداتابيز */}
            <div className="grid md:grid-cols-3 gap-3">
              <Toggle checked={form.is_published} disabled={!schemaReady} onChange={v => setForm({ ...form, is_published: v })} label="منشور للزوار" hint={schemaReady ? 'لو اتشال يبقى مسودة تظهر لك فقط' : 'يحتاج ترقية الداتابيز'} />
              <Toggle checked={form.is_featured} disabled={!schemaReady} onChange={v => setForm({ ...form, is_featured: v })} label="⭐ تمييز البند" hint={schemaReady ? 'يظهر أولاً وبشارة «مميز»' : 'يحتاج ترقية الداتابيز'} />
              <div className={`p-3 rounded-2xl border bg-white ${schemaReady ? '' : 'opacity-50'}`}>
                <label className="block text-xs font-black text-gray-900 mb-1">يختفي تلقائياً بعد</label>
                <input type="date" disabled={!schemaReady} className={input} value={form.expires_on} onChange={e => setForm({ ...form, expires_on: e.target.value })} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={uploading || saving} className="px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] disabled:opacity-60 text-white rounded-xl flex items-center gap-1.5 cursor-pointer transition">
                {editingId ? <><Check size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ التعديل'}</> : <><Plus size={16} /> {saving ? 'جاري الإضافة...' : 'إضافة ونشر'}</>}
              </button>
              {editingId && <button type="button" onClick={() => resetForm()} className="px-4 py-2.5 border rounded-xl cursor-pointer hover:bg-gray-50">إلغاء</button>}
            </div>
          </form>

          {customCategories.length > 0 && (
            <div className="bg-white p-4 rounded-3xl border shadow-sm space-y-2">
              <h3 className="text-xs font-black text-[#7a1c24] flex items-center gap-1.5"><Layers size={15} /> الأقسام المخصصة ({customCategories.length})</h3>
              <div className="flex flex-wrap gap-2">
                {customCategories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold">
                    <span>✨ {cat.body || cat.title}</span>
                    <button type="button" onClick={() => handleRenameCategory(cat)} className="p-1 hover:bg-amber-200 rounded cursor-pointer text-gray-700" title="تعديل الاسم"><Edit3 size={12} /></button>
                    <button type="button" onClick={() => handleDeleteCategory(cat)} className="p-1 hover:bg-red-100 rounded cursor-pointer text-red-700" title="حذف القسم"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border shadow-2xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute right-3 top-3 text-gray-400" />
              <input placeholder="ابحث في العنوان أو النص..." className={`${input} pr-9`} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setFilterKind('all')} className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${filterKind === 'all' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>الكل ({cleanItems.length})</button>
              {allKinds.map(k => {
                const count = cleanItems.filter(it => it.kind === k.value).length;
                if (count === 0) return null;
                return <button key={k.value} type="button" onClick={() => setFilterKind(k.value)} className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${filterKind === k.value ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{k.label} ({count})</button>;
              })}
            </div>
          </div>

          {loading ? (
            <div className="bg-white p-6 rounded-2xl border text-center text-xs text-gray-500">جاري تحميل المحتوى...</div>
          ) : displayedItems.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border text-center text-xs text-gray-500">لا توجد بنود مطابقة.</div>
          ) : (
            <div className="grid gap-2.5">
              {displayedItems.map(it => {
                const spec = getSpecForKind(it.kind, customCategories);
                const st = STATUS_STYLE[itemStatus(it)];
                const sched = getItemSchedule(it);
                const isImg = it.url && isImageUrl(it.url);
                return (
                  <div key={it.id} className={`bg-white p-4 rounded-2xl border flex flex-wrap justify-between items-start gap-3 min-w-0 overflow-hidden shadow-2xs hover:border-[#7a1c24]/40 transition ${editingId === it.id ? 'ring-2 ring-amber-400' : ''}`}>
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {isImg && <img src={it.url} alt="" loading="lazy" className="w-16 h-16 rounded-xl object-cover border shrink-0 bg-gray-50" />}
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-amber-100 text-amber-950 rounded text-[11px] font-bold shrink-0">{spec.label.split('(')[0].trim()}</span>
                          {schemaReady && <span className={`px-2 py-0.5 rounded text-[10px] font-black ${st.cls}`}>{st.label}</span>}
                          <strong className="text-sm text-gray-900 break-words">{it.title}</strong>
                        </div>
                        {it.body && <p className="text-xs text-gray-600 whitespace-pre-line break-words line-clamp-2">{it.body}</p>}
                        <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                          {(sched.date || sched.time) && <span>⏰ {sched.date ? formatDateFull(sched.date) : ''}{sched.date && sched.time ? ' • ' : ''}{sched.time}</span>}
                          {it.location && <span>📍 {it.location}</span>}
                          {it.expires_on && <span>⌛ ينتهي {String(it.expires_on).slice(0, 10)}</span>}
                          {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="text-indigo-700 underline inline-flex items-center gap-1 max-w-xs truncate"><LinkIcon size={11} /> الرابط</a>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {schemaReady && (
                        <>
                          <button type="button" onClick={() => patchItem(it, { is_featured: !it.is_featured }, it.is_featured ? 'تم إلغاء التمييز' : 'تم التمييز ⭐')} className={`p-2 rounded-xl cursor-pointer transition ${it.is_featured ? 'bg-amber-300 text-[#4a0e13]' : 'bg-gray-100 hover:bg-amber-100 text-gray-700'}`} title="تمييز"><Star size={15} /></button>
                          <button type="button" onClick={() => patchItem(it, { is_published: it.is_published === false }, it.is_published === false ? 'تم النشر ✅' : 'تحول لمسودة')} className="p-2 bg-gray-100 hover:bg-emerald-100 text-gray-700 rounded-xl cursor-pointer transition" title={it.is_published === false ? 'نشر' : 'إخفاء كمسودة'}>{it.is_published === false ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                        </>
                      )}
                      <button type="button" onClick={() => handleDuplicate(it)} className="p-2 bg-gray-100 hover:bg-blue-100 text-gray-700 rounded-xl cursor-pointer transition" title="نسخ"><Copy size={15} /></button>
                      <button type="button" onClick={() => startEdit(it)} className="p-2 bg-gray-100 hover:bg-amber-100 text-gray-700 rounded-xl cursor-pointer transition" title="تعديل"><Edit3 size={15} /></button>
                      <button type="button" onClick={() => handleDelete(it)} className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl cursor-pointer transition" title="حذف"><Trash2 size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═════════════ تاب الأقسام ═════════════ */}
      {tab === 'sections' && (
        <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-black text-[#7a1c24]">ترتيب وإخفاء وتسمية أقسام الصفحة</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">رتّب الأقسام بالأسهم — الترتيب هنا هو نفسه ترتيب ظهورها في الصفحة العامة وفي شريط التنقل.</p>
          </div>
          <div className="space-y-2">
            {sectionDraft.map((s, idx) => (
              <div key={s.key} className={`p-3 rounded-2xl border flex flex-wrap items-center gap-3 ${s.hidden ? 'bg-gray-100 opacity-80' : 'bg-[#fbfaf7]'}`}>
                <span className="w-7 h-7 rounded-full bg-[#7a1c24] text-white text-xs font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                <span className="text-lg shrink-0" aria-hidden>{s.icon}</span>
                <div className="flex-1 min-w-[200px]">
                  <input className={input} value={s.title} onChange={e => patchSection(s.key, { title: e.target.value })} aria-label={`اسم قسم ${s.defaultTitle}`} />
                  <span className="text-[10px] text-gray-500 font-normal">{s.hint}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" disabled={idx === 0} onClick={() => moveSection(idx, -1)} className="p-2 bg-white border rounded-xl cursor-pointer disabled:opacity-30" title="لأعلى"><ArrowUp size={14} /></button>
                  <button type="button" disabled={idx === sectionDraft.length - 1} onClick={() => moveSection(idx, 1)} className="p-2 bg-white border rounded-xl cursor-pointer disabled:opacity-30" title="لأسفل"><ArrowDown size={14} /></button>
                  <button type="button" onClick={() => patchSection(s.key, { hidden: !s.hidden })} className={`px-3 py-2 rounded-xl text-[11px] font-black inline-flex items-center gap-1 cursor-pointer ${s.hidden ? 'bg-gray-800 text-white' : 'bg-white border text-gray-700'}`}>
                    {s.hidden ? <><EyeOff size={13} /> مخفي</> : <><Eye size={13} /> ظاهر</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={savingMeta} onClick={handleSaveSections} className="px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"><Check size={15} /> {savingMeta ? 'جاري الحفظ...' : 'حفظ الأقسام'}</button>
            <button type="button" onClick={resetSections} className="px-4 py-2.5 border rounded-xl cursor-pointer hover:bg-gray-50">استرجاع الافتراضي</button>
          </div>
        </div>
      )}

      {/* ═════════════ تاب المظهر ═════════════ */}
      {tab === 'theme' && (
        <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-black text-[#7a1c24]">مظهر الصفحة العامة</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">اختر ألوان الواجهة وما يظهر فيها. المعاينة بالأسفل تتغير فوراً.</p>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-black text-gray-800">لون الواجهة والفوتر</span>
            <div className="flex flex-wrap gap-2">
              {HEADER_PRESETS.map(p => (
                <button key={p.id} type="button" onClick={() => setThemeDraft({ ...themeDraft, headerBg: p.value })} aria-pressed={themeDraft.headerBg === p.value}
                  className={`px-3 py-2 rounded-2xl border-2 text-xs font-black inline-flex items-center gap-2 cursor-pointer transition ${themeDraft.headerBg === p.value ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-gray-400'}`}>
                  <span className="w-5 h-5 rounded-full border" style={{ background: p.swatch }} /> {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-black text-gray-800">لون خلفية الصفحة</span>
            <div className="flex flex-wrap items-center gap-2">
              {PAGE_BG_PRESETS.map(c => (
                <button key={c} type="button" onClick={() => setThemeDraft({ ...themeDraft, pageBg: c })} aria-label={`خلفية ${c}`} aria-pressed={themeDraft.pageBg === c}
                  className={`w-9 h-9 rounded-xl border-2 cursor-pointer ${themeDraft.pageBg === c ? 'border-amber-500 ring-2 ring-amber-300' : 'border-gray-300'}`} style={{ background: c }} />
              ))}
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(themeDraft.pageBg || '') ? themeDraft.pageBg : '#f6f4ef'} onChange={e => setThemeDraft({ ...themeDraft, pageBg: e.target.value })} className="w-9 h-9 rounded-xl border cursor-pointer" aria-label="لون مخصص" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2.5">
            <Toggle checked={themeDraft.show_ticker !== false} onChange={v => setThemeDraft({ ...themeDraft, show_ticker: v })} label="شريط الأخبار المتحرك" hint="أسفل الواجهة الرئيسية" />
            <Toggle checked={themeDraft.show_mary !== false} onChange={v => setThemeDraft({ ...themeDraft, show_mary: v })} label="أيقونة السيدة العذراء" hint="تظهر بجانب الترحيب لو مفيش فيديو" />
            <Toggle checked={themeDraft.show_edu_btn !== false} onChange={v => setThemeDraft({ ...themeDraft, show_edu_btn: v })} label="زر المركز التعليمي" />
            <Toggle checked={themeDraft.show_joseph_btn !== false} onChange={v => setThemeDraft({ ...themeDraft, show_joseph_btn: v })} label="زر خدمة يوسف الرامي" />
            <Toggle checked={themeDraft.sticky_header !== false} onChange={v => setThemeDraft({ ...themeDraft, sticky_header: v })} label="تثبيت الشريط العلوي أثناء التمرير" />
          </div>

          <div className="rounded-2xl overflow-hidden border">
            <div className={`bg-linear-to-br ${themeDraft.headerBg} text-white p-5`}>
              <span className="text-[11px] text-amber-200 font-black">✦ معاينة</span>
              <strong className="block text-lg font-black mt-1">اسم الكنيسة</strong>
              <span className="text-xs text-white/75">هكذا ستظهر الواجهة الرئيسية</span>
            </div>
            <div className="p-4 text-xs text-gray-600" style={{ background: themeDraft.pageBg }}>خلفية الصفحة</div>
          </div>

          <button type="button" disabled={savingMeta} onClick={handleSaveTheme} className="px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"><Check size={15} /> {savingMeta ? 'جاري الحفظ...' : 'حفظ المظهر'}</button>
        </div>
      )}

      {/* ═════════════ تاب البيانات المرتبطة ═════════════ */}
      {tab === 'linked' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-950 font-bold">
            هذه بيانات من جداول أخرى بتظهر في الصفحة العامة (قداسات الآباء المتاحة والفعاليات). تعديلك هنا يغيّر مصدرها مباشرة.
          </div>

          <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-3">
            <h3 className="text-sm font-black text-[#7a1c24]">⛪ قداسات الآباء ({linkedMasses.length})</h3>
            {linkedMasses.length === 0 ? <p className="text-xs text-gray-500">لا توجد قداسات.</p> : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {linkedMasses.map(m => (
                  <div key={m.id} className="p-3 rounded-2xl border bg-[#fbfaf7] flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block text-sm">{m.mass_name}</strong>
                      <span className="text-[11px] text-gray-500">{m.mass_date} • {m.mass_time} • {m.church_name}{m.is_available === false ? ' • غير متاح للعرض' : ''}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => setLinkedEdit({ table: 'priest_masses', row: { ...m } })} className="p-2 bg-white border rounded-xl cursor-pointer"><Edit3 size={14} /></button>
                      <button type="button" onClick={() => deleteLinked('priest_masses', m, m.mass_name)} className="p-2 bg-red-50 text-red-700 rounded-xl cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-3">
            <h3 className="text-sm font-black text-[#7a1c24]">✨ فعاليات الكنيسة ({linkedEvents.length})</h3>
            {linkedEvents.length === 0 ? <p className="text-xs text-gray-500">لا توجد فعاليات.</p> : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {linkedEvents.map(ev => (
                  <div key={ev.id} className="p-3 rounded-2xl border bg-[#fbfaf7] flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block text-sm">{ev.title}</strong>
                      <span className="text-[11px] text-gray-500">{ev.event_type} • {ev.event_time} {ev.place ? `• ${ev.place}` : ''}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => setLinkedEdit({ table: 'church_events', row: { ...ev } })} className="p-2 bg-white border rounded-xl cursor-pointer"><Edit3 size={14} /></button>
                      <button type="button" onClick={() => deleteLinked('church_events', ev, ev.title)} className="p-2 bg-red-50 text-red-700 rounded-xl cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {linkedEdit && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setLinkedEdit(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-black text-[#7a1c24]">{linkedEdit.table === 'priest_masses' ? '✏️ تعديل القداس' : '✏️ تعديل الفعالية'}</h3>
              <button type="button" onClick={() => setLinkedEdit(null)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={saveLinked} className="space-y-3 text-xs font-bold">
              {linkedEdit.table === 'priest_masses' ? (
                <>
                  <input required placeholder="اسم القداس *" className={input} value={linkedEdit.row.mass_name || ''} onChange={e => setLinkedEdit({ ...linkedEdit, row: { ...linkedEdit.row, mass_name: e.target.value } })} />
                  <div className="grid grid-cols-2 gap-2">
                    <input required type="date" className={input} value={linkedEdit.row.mass_date || ''} onChange={e => setLinkedEdit({ ...linkedEdit, row: { ...linkedEdit.row, mass_date: e.target.value } })} />
                    <input required placeholder="الوقت *" className={input} value={linkedEdit.row.mass_time || ''} onChange={e => setLinkedEdit({ ...linkedEdit, row: { ...linkedEdit.row, mass_time: e.target.value } })} />
                  </div>
                  <input required placeholder="الكنيسة *" className={input} value={linkedEdit.row.church_name || ''} onChange={e => setLinkedEdit({ ...linkedEdit, row: { ...linkedEdit.row, church_name: e.target.value } })} />
                </>
              ) : (
                <>
                  <input required placeholder="العنوان *" className={input} value={linkedEdit.row.title || ''} onChange={e => setLinkedEdit({ ...linkedEdit, row: { ...linkedEdit.row, title: e.target.value } })} />
                  <input required placeholder="الوقت *" className={input} value={linkedEdit.row.event_time || ''} onChange={e => setLinkedEdit({ ...linkedEdit, row: { ...linkedEdit.row, event_time: e.target.value } })} />
                  <input required placeholder="المكان *" className={input} value={linkedEdit.row.place || ''} onChange={e => setLinkedEdit({ ...linkedEdit, row: { ...linkedEdit.row, place: e.target.value } })} />
                </>
              )}
              <button type="submit" className="w-full py-2.5 bg-[#7a1c24] text-white rounded-xl font-black cursor-pointer">حفظ التعديل</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

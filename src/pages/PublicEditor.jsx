import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { uploadChurchMedia } from '../lib/mediaUpload';
import { Trash2, Edit3, Plus, Globe, Upload, X, Layers, AlertTriangle, Check } from 'lucide-react';

const CORE_KINDS = [
  { value: 'logo', label: '✝ اسم الكنيسة وشعارها (لوجو متحرك)' },
  { value: 'virgin_mary', label: '🕊️ صورة السيدة العذراء مريم (بجانب الترحيب)' },
  { value: 'video', label: '🎬 فيديو ترحيبي / متحرك' },
  { value: 'image', label: '🖼️ صورة / بانر / إعلان مصور' },
  { value: 'livestream', label: '📺 بث مباشر (YouTube / رابط البث)' },
  { value: 'news', label: '📰 خبر / مناسبة / إعلان' },
  { value: 'mass', label: '⛪ ميعاد قداس' },
  { value: 'trip', label: '🚌 رحلة كنسية / مؤتمر' },
  { value: 'priest_bio', label: '✝ أب كاهن (صورة، اسم، تاريخ الرسامة، وبيانات)' },
  { value: 'history', label: '📜 تاريخ الكنيسة وحياتها' }
];

// أنواع النظام المخفية التي لا يجب عرضها كبنود محتوى عامة
const SYSTEM_KINDS = ['theme_config', 'section_config', 'category_def', 'role_template'];

function isImageUrl(rawUrl = '') {
  return /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(rawUrl.trim());
}

function looksLikeSystemJson(item) {
  const body = (item.body || '').trim();
  const title = (item.title || '').trim();
  if (SYSTEM_KINDS.includes(item.kind)) return true;
  if (title.startsWith('lpi_') || item.kind?.startsWith('lpi_')) return true;
  if (body.startsWith('{') && (body.includes('"can_view"') || body.includes('"preset"') || body.includes('"service_stage"'))) {
    return true;
  }
  return false;
}

export default function PublicEditor({ onViewPublic }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [filterKind, setFilterKind] = useState('all');

  const emptyForm = {
    kind: 'news',
    title: '',
    body: '',
    time_text: '',
    location: '',
    url: '',
    sort_order: 0
  };
  const [form, setForm] = useState(emptyForm);

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('church_public_content')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        alert('تعذر تحميل البيانات: ' + error.message);
      } else if (data) {
        setItems(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const customCategories = items.filter(i => i.kind === 'category_def');

  const allKinds = [
    ...CORE_KINDS,
    ...customCategories.map(c => ({ value: c.title, label: `✨ ${c.body || c.title}` }))
  ];

  // البنود النظيفة فقط (بدون إعدادات الثيم أو الأقسام أو الصلاحيات المسربة)
  const cleanContentItems = items.filter(
    it => !SYSTEM_KINDS.includes(it.kind) && !looksLikeSystemJson(it)
  );

  // سجلات النظام/الـ JSON التالفة إن وجدت في الجدول (لتنظيفها بضغطة زر)
  const pollutedJsonItems = items.filter(
    it => !SYSTEM_KINDS.includes(it.kind) && looksLikeSystemJson(it)
  );

  const displayedItems = filterKind === 'all'
    ? cleanContentItems
    : cleanContentItems.filter(it => it.kind === filterKind);

  const handleCreateCategory = async () => {
    const label = newCatName.trim();
    if (!label) return alert('اكتب اسم القسم الجديد أولاً');
    const key = 'cat_' + Date.now();
    const { data, error } = await supabase
      .from('church_public_content')
      .insert([{
        kind: 'category_def',
        title: key,
        body: label,
        location: 'visible',
        sort_order: customCategories.length + 1
      }])
      .select()
      .single();

    if (error) return alert('خطأ أثناء إنشاء القسم: ' + error.message);
    if (data) {
      setItems(prev => [data, ...prev]);
      setForm(prev => ({ ...prev, kind: key }));
      setNewCatName('');
      setCreatingCat(false);
    }
  };

  const handleRenameCategory = async (cat) => {
    const nextName = prompt('اكتب الاسم الجديد للقسم:', cat.body || cat.title);
    if (!nextName || !nextName.trim()) return;
    const { data, error } = await supabase
      .from('church_public_content')
      .update({ body: nextName.trim() })
      .eq('id', cat.id)
      .select()
      .single();

    if (error) return alert('تعذر تعديل اسم القسم: ' + error.message);
    if (data) {
      setItems(prev => prev.map(i => (i.id === cat.id ? data : i)));
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!confirm(`حذف قسم "${cat.body || cat.title}" وكل البنود اللي جواه من الداتابيز؟`)) return;
    await supabase.from('church_public_content').delete().eq('kind', cat.title);
    const { error } = await supabase.from('church_public_content').delete().eq('id', cat.id);
    if (error) return alert('تعذر حذف القسم: ' + error.message);
    setItems(prev => prev.filter(i => i.id !== cat.id && i.kind !== cat.title));
    if (filterKind === cat.title) setFilterKind('all');
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadChurchMedia(file, form.kind || 'public');
      setForm(prev => ({ ...prev, url }));
    } catch (err) {
      alert('تعذر رفع الملف: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return alert('يرجى إدخال العنوان / الاسم');
    setSaving(true);
    try {
      const payload = {
        kind: form.kind,
        title: form.title.trim(),
        body: form.body || '',
        time_text: form.time_text || '',
        location: form.location || '',
        url: form.url || '',
        sort_order: Number(form.sort_order || 0)
      };

      if (editingId) {
        const { data, error } = await supabase
          .from('church_public_content')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single();

        if (error) return alert('خطأ أثناء التعديل: ' + error.message);
        if (data) {
          setItems(prev => prev.map(i => (i.id === editingId ? data : i)));
          setEditingId(null);
          setForm(emptyForm);
        }
      } else {
        const { data, error } = await supabase
          .from('church_public_content')
          .insert([payload])
          .select()
          .single();

        if (error) return alert('خطأ أثناء الإضافة: ' + error.message);
        if (data) {
          setItems(prev => [data, ...prev]);
          setForm(emptyForm);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (it) => {
    setEditingId(it.id);
    setCreatingCat(false);
    setForm({
      kind: it.kind || 'news',
      title: it.title || '',
      body: it.body || '',
      time_text: it.time_text || '',
      location: it.location || '',
      url: it.url || '',
      sort_order: it.sort_order ?? 0
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!confirm('حذف هذا البند نهائياً من صفحة الكنيسة العامة؟')) return;
    const { error } = await supabase.from('church_public_content').delete().eq('id', id);
    if (error) return alert('تعذر الحذف: ' + error.message);
    setItems(prev => prev.filter(i => i.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm);
    }
  };

  const handleCleanPollutedRecords = async () => {
    if (pollutedJsonItems.length === 0) return;
    if (!confirm(`سيتم حذف ${pollutedJsonItems.length} سجل تالف (بيانات صلاحيات/JSON مسربة) من جدول المحتوى العام. هل أنت متأكد؟`)) return;
    const ids = pollutedJsonItems.map(i => i.id);
    const { error } = await supabase.from('church_public_content').delete().in('id', ids);
    if (error) return alert('تعذر التنظيف: ' + error.message);
    setItems(prev => prev.filter(i => !ids.includes(i.id)));
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-4 text-xs md:text-sm" dir="rtl">
      {/* الهيدر */}
      <div className="bg-white p-4 rounded-3xl border shadow-sm flex flex-wrap justify-between items-center gap-2">
        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-black text-[#7a1c24]">✏️ إدارة وتعديل واجهة الكنيسة العامة</h2>
          <p className="text-xs text-gray-500">تقدر تكتب أقسام وأنواع محتوى جديدة بنفسك وتترفع الصور والفيديوهات من جهازك مباشرة للداتابيز</p>
        </div>
        {onViewPublic && (
          <button
            type="button"
            onClick={onViewPublic}
            className="px-4 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition"
          >
            <Globe size={15} /> معاينة صفحة الكنيسة
          </button>
        )}
      </div>

      {/* تنبيه لتنظيف أي بيانات JSON مسربة داخل الجدول */}
      {pollutedJsonItems.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-start gap-2 text-red-900">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-600" />
            <div>
              <strong className="block text-xs font-black">
                تم اكتشاف {pollutedJsonItems.length} سجلات بيانات نظام/صلاحيات (JSON) مخزنة بالخطأ داخل محتوى الصفحة العامة
              </strong>
              <span className="text-[11px] text-red-700">
                تم إخفاؤها تلقائياً من العرض، ويمكنك حذفها نهائياً من قاعدة البيانات الآن.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCleanPollutedRecords}
            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black cursor-pointer shrink-0"
          >
            تنظيف وحذف السجلات التالفة ({pollutedJsonItems.length})
          </button>
        </div>
      )}

      {/* فورم الإضافة والتعديل */}
      <form onSubmit={handleSave} className="bg-white p-5 rounded-3xl border shadow-sm space-y-3 font-bold">
        {editingId && (
          <div className="bg-amber-50 border border-amber-300 px-3 py-2 rounded-xl flex justify-between items-center text-xs text-amber-950">
            <span>✏️ أنت الآن في وضع تعديل البند المحدد</span>
            <button
              type="button"
              onClick={() => { setEditingId(null); setForm(emptyForm); }}
              className="text-red-700 underline cursor-pointer"
            >
              إلغاء التعديل
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-2.5">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-gray-600">نوع المحتوى / القسم *</label>
              <button
                type="button"
                onClick={() => setCreatingCat(!creatingCat)}
                className="text-[11px] text-[#7a1c24] underline cursor-pointer"
              >
                {creatingCat ? 'إلغاء' : '+ إنشاء قسم جديد'}
              </button>
            </div>
            {creatingCat ? (
              <div className="flex gap-1">
                <input
                  autoFocus
                  placeholder="اسم القسم الجديد..."
                  className="flex-1 p-2 border rounded-xl text-xs bg-white"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  className="px-3 bg-[#7a1c24] text-white rounded-xl text-xs cursor-pointer shrink-0"
                >
                  حفظ
                </button>
              </div>
            ) : (
              <select
                className="w-full p-2.5 border rounded-xl bg-white"
                value={form.kind}
                onChange={e => setForm({ ...form, kind: e.target.value })}
              >
                {allKinds.map(k => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">العنوان / الاسم *</label>
            <input
              required
              placeholder={form.kind === 'logo' ? 'اسم الكنيسة...' : 'العنوان...'}
              className="w-full p-2.5 border rounded-xl"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">الوقت / التاريخ / الدرجة</label>
            <input
              placeholder="مثال: الجمعة 7:00 ص"
              className="w-full p-2.5 border rounded-xl"
              value={form.time_text}
              onChange={e => setForm({ ...form, time_text: e.target.value })}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs text-gray-600 mb-1">المكان / التليفون</label>
            <input
              placeholder="الكنيسة الكبرى / القاعة..."
              className="w-full p-2.5 border rounded-xl"
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">ترتيب العرض</label>
            <input
              type="number"
              className="w-full p-2.5 border rounded-xl"
              value={form.sort_order}
              onChange={e => setForm({ ...form, sort_order: e.target.value })}
            />
          </div>
        </div>

        <div className="bg-indigo-50/60 p-3 rounded-2xl border border-indigo-200 space-y-2">
          <label className="block text-xs text-indigo-950">ملف من جهازك (صورة / فيديو / لوجو) أو رابط البث المباشر</label>
          <div className="flex flex-wrap gap-2 items-center">
            <label
              className={`px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 ${
                uploading ? 'bg-gray-300 text-gray-600' : 'bg-indigo-700 hover:bg-indigo-800 text-white'
              }`}
            >
              <Upload size={14} /> {uploading ? 'جاري الرفع...' : 'اختر ملف من الجهاز'}
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                disabled={uploading}
                onChange={handleUpload}
              />
            </label>
            <input
              placeholder="أو رابط مباشر https://..."
              className="flex-1 min-w-[200px] p-2.5 border rounded-xl bg-white"
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
            />
            {form.url && (
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, url: '' }))}
                className="p-2 bg-white border rounded-xl text-red-600 cursor-pointer"
                title="مسح الرابط"
              >
                <X size={15} />
              </button>
            )}
          </div>
          {form.url && isImageUrl(form.url) && (
            <img src={form.url} alt="معاينة" className="h-24 rounded-xl border object-cover bg-white" />
          )}
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">النص / السيرة / الوصف</label>
          <textarea
            rows="3"
            placeholder="اكتب التفاصيل..."
            className="w-full p-2.5 border rounded-xl font-normal"
            value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={uploading || saving}
            className="px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] disabled:opacity-60 text-white rounded-xl flex items-center gap-1.5 cursor-pointer transition"
          >
            {editingId ? <><Check size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ التعديل'}</> : <><Plus size={16} /> {saving ? 'جاري الإضافة...' : 'إضافة للصفحة الرئيسية'}</>}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setForm(emptyForm); }}
              className="px-4 py-2.5 border rounded-xl cursor-pointer hover:bg-gray-50"
            >
              إلغاء
            </button>
          )}
        </div>
      </form>

      {/* إدارة الأقسام المخصصة إن وجدت */}
      {customCategories.length > 0 && (
        <div className="bg-white p-4 rounded-3xl border shadow-sm space-y-2">
          <h3 className="text-xs font-black text-[#7a1c24] flex items-center gap-1.5">
            <Layers size={15} /> الأقسام المخصصة التي أنشأتها ({customCategories.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {customCategories.map(cat => (
              <div key={cat.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold">
                <span>✨ {cat.body || cat.title}</span>
                <button
                  type="button"
                  onClick={() => handleRenameCategory(cat)}
                  className="p-1 hover:bg-amber-200 rounded cursor-pointer text-gray-700"
                  title="تعديل الاسم"
                >
                  <Edit3 size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat)}
                  className="p-1 hover:bg-red-100 rounded cursor-pointer text-red-700"
                  title="حذف القسم"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* شريط الفلترة حسب النوع */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white p-3 rounded-2xl border shadow-2xs">
        <button
          type="button"
          onClick={() => setFilterKind('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
            filterKind === 'all' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          الكل ({cleanContentItems.length})
        </button>
        {allKinds.map(k => {
          const count = cleanContentItems.filter(it => it.kind === k.value).length;
          if (count === 0) return null;
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => setFilterKind(k.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                filterKind === k.value ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {k.label} ({count})
            </button>
          );
        })}
      </div>

      {/* قائمة البنود النظيفة */}
      {loading ? (
        <div className="bg-white p-6 rounded-2xl border text-center text-xs text-gray-500">جاري تحميل المحتوى...</div>
      ) : displayedItems.length === 0 ? (
        <div className="bg-white p-6 rounded-2xl border text-center text-xs text-gray-500">لا توجد بنود مضافة في هذا القسم حالياً.</div>
      ) : (
        <div className="grid gap-2.5">
          {displayedItems.map(it => {
            const kindLabel = allKinds.find(k => k.value === it.kind)?.label || it.kind;
            const isImg = it.url && isImageUrl(it.url);

            return (
              <div
                key={it.id}
                className="bg-white p-4 rounded-2xl border flex flex-wrap justify-between items-start gap-3 min-w-0 overflow-hidden shadow-2xs hover:border-[#7a1c24]/40 transition"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {isImg && (
                    <img
                      src={it.url}
                      alt={it.title}
                      className="w-16 h-16 rounded-xl object-cover border shrink-0 bg-gray-50"
                    />
                  )}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-amber-100 text-amber-950 rounded text-[11px] font-bold shrink-0">
                        {kindLabel}
                      </span>
                      <strong className="text-sm text-gray-900 break-words">{it.title}</strong>
                      {Number(it.sort_order) > 0 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-bold">
                          ترتيب: {it.sort_order}
                        </span>
                      )}
                    </div>

                    {it.body && (
                      <p className="text-xs text-gray-600 whitespace-pre-line break-words">
                        {it.body}
                      </p>
                    )}

                    <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                      {it.time_text && <span>⏰ {it.time_text}</span>}
                      {it.location && <span>📍 {it.location}</span>}
                      {it.url && (
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-700 underline break-all max-w-full"
                        >
                          🔗 {it.url}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(it)}
                    className="p-2 bg-gray-100 hover:bg-amber-100 text-gray-700 rounded-xl cursor-pointer transition"
                    title="تعديل"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(it.id)}
                    className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl cursor-pointer transition"
                    title="حذف"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
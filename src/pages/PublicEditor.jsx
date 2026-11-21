import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { uploadChurchMedia } from '../lib/mediaUpload';
import { Trash2, Edit3, Plus, Globe, Upload } from 'lucide-react';

const CORE_KINDS = [
  { value: 'logo', label: '✝ اسم الكنيسة وشعارها (لوجو متحرك)' },
  { value: 'video', label: '🎬 فيديو ترحيبي / متحرك' },
  { value: 'image', label: '🖼️ صورة / بانر / إعلان مصور' },
  { value: 'livestream', label: '📺 بث مباشر (YouTube / رابط البث)' },
  { value: 'news', label: '📰 خبر / مناسبة / إعلان' },
  { value: 'mass', label: '⛪ ميعاد قداس' },
  { value: 'trip', label: '🚌 رحلة كنسية / مؤتمر' },
  { value: 'priest_bio', label: '✝ أب كاهن (صورة، اسم، تاريخ الرسامة، وبيانات)' },
  { value: 'history', label: '📜 تاريخ الكنيسة وحياتها' }
];

export default function PublicEditor({ onViewPublic }) {
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

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
    const { data } = await supabase
      .from('church_public_content')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (data) setItems(data);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const customCategories = items.filter(i => i.kind === 'category_def');
  const allKinds = [
    ...CORE_KINDS,
    ...customCategories.map(c => ({ value: c.title, label: `✨ ${c.body || c.title}` }))
  ];

  const handleCreateCategory = async () => {
    const label = newCatName.trim();
    if (!label) return alert('اكتب اسم القسم الجديد');
    const key = 'cat_' + Date.now();
    const { data, error } = await supabase
      .from('church_public_content')
      .insert([{ kind: 'category_def', title: key, body: label, location: 'visible', sort_order: customCategories.length + 1 }])
      .select()
      .single();
    if (error) return alert('خطأ: ' + error.message);
    if (data) {
      setItems([data, ...items]);
      setForm(prev => ({ ...prev, kind: key }));
      setNewCatName('');
      setCreatingCat(false);
    }
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
      if (!error && data) {
        setItems(items.map(i => (i.id === editingId ? data : i)));
        setEditingId(null);
        setForm(emptyForm);
      } else if (error) alert(error.message);
    } else {
      const { data, error } = await supabase
        .from('church_public_content')
        .insert([payload])
        .select()
        .single();
      if (!error && data) {
        setItems([data, ...items]);
        setForm(emptyForm);
      } else if (error) alert(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('حذف هذا البند من صفحة الكنيسة العامة؟')) return;
    const { error } = await supabase.from('church_public_content').delete().eq('id', id);
    if (!error) setItems(items.filter(i => i.id !== id));
  };

  return (
    <div className="space-y-4 text-xs md:text-sm" dir="rtl">
      <div className="bg-white p-4 rounded-3xl border shadow-sm flex flex-wrap justify-between items-center gap-2">
        <div>
          <h2 className="text-base md:text-lg font-black text-[#7a1c24]">✏️ إدارة وتعديل واجهة الكنيسة العامة</h2>
          <p className="text-xs text-gray-500">تقدر تكتب أقسام وأنواع محتوى جديدة بنفسك وتترفع الصور والفيديوهات من جهازك مباشرة للداتابيز</p>
        </div>
        {onViewPublic && (
          <button type="button" onClick={onViewPublic} className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer">
            <Globe size={15} /> معاينة صفحة الكنيسة
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="bg-white p-5 rounded-3xl border shadow-sm space-y-3 font-bold">
        <div className="grid md:grid-cols-3 gap-2.5">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-gray-600">نوع المحتوى / القسم *</label>
              <button type="button" onClick={() => setCreatingCat(!creatingCat)} className="text-[11px] text-[#7a1c24] underline cursor-pointer">
                {creatingCat ? 'إلغاء' : '+ إنشاء قسم جديد'}
              </button>
            </div>
            {creatingCat ? (
              <div className="flex gap-1">
                <input placeholder="اسم القسم الجديد..." className="flex-1 p-2 border rounded-xl text-xs" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                <button type="button" onClick={handleCreateCategory} className="px-3 bg-[#7a1c24] text-white rounded-xl text-xs cursor-pointer">حفظ</button>
              </div>
            ) : (
              <select className="w-full p-2.5 border rounded-xl bg-white" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
                {allKinds.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">العنوان / الاسم *</label>
            <input required placeholder={form.kind === 'logo' ? 'اسم الكنيسة...' : 'العنوان...'} className="w-full p-2.5 border rounded-xl" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">الوقت / التاريخ / الدرجة</label>
            <input placeholder="مثال: الجمعة 7:00 ص" className="w-full p-2.5 border rounded-xl" value={form.time_text} onChange={e => setForm({ ...form, time_text: e.target.value })} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs text-gray-600 mb-1">المكان / التليفون</label>
            <input placeholder="الكنيسة الكبرى / القاعة..." className="w-full p-2.5 border rounded-xl" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">ترتيب العرض</label>
            <input type="number" className="w-full p-2.5 border rounded-xl" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} />
          </div>
        </div>

        <div className="bg-indigo-50/60 p-3 rounded-2xl border border-indigo-200 space-y-2">
          <label className="block text-xs text-indigo-950">ملف من جهازك (صورة / فيديو / لوجو) أو رابط البث المباشر</label>
          <div className="flex flex-wrap gap-2 items-center">
            <label className={`px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 ${uploading ? 'bg-gray-300 text-gray-600' : 'bg-indigo-700 hover:bg-indigo-800 text-white'}`}>
              <Upload size={14} /> {uploading ? 'جاري الرفع...' : 'اختر ملف من الجهاز'}
              <input type="file" accept="image/*,video/*" className="hidden" disabled={uploading} onChange={handleUpload} />
            </label>
            <input placeholder="أو رابط مباشر https://..." className="flex-1 min-w-[200px] p-2.5 border rounded-xl bg-white" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">النص / السيرة / الوصف</label>
          <textarea rows="3" placeholder="اكتب التفاصيل..." className="w-full p-2.5 border rounded-xl font-normal" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={uploading} className="px-5 py-2.5 bg-[#7a1c24] text-white rounded-xl flex items-center gap-1.5 cursor-pointer">
            <Plus size={16} /> {editingId ? 'حفظ التعديل' : 'إضافة للصفحة الرئيسية'}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="px-4 py-2.5 border rounded-xl">
              إلغاء
            </button>
          )}
        </div>
      </form>

      <div className="grid gap-2.5">
        {items.filter(it => it.kind !== 'section_config' && it.kind !== 'category_def').map(it => {
          const kindLabel = allKinds.find(k => k.value === it.kind)?.label || it.kind;
          return (
            <div key={it.id} className="bg-white p-4 rounded-2xl border flex flex-wrap justify-between items-start gap-2">
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-950 rounded text-[11px] font-bold ml-2">{kindLabel}</span>
                <strong className="text-sm text-gray-900">{it.title}</strong>
                {it.body && <p className="text-xs text-gray-600 whitespace-pre-line">{it.body}</p>}
                <p className="text-[11px] text-gray-500">
                  {it.time_text && `⏰ ${it.time_text} `}
                  {it.location && `• 📍 ${it.location} `}
                  {it.url && `• 🔗 ${it.url}`}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => { setEditingId(it.id); setForm({ ...it }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 bg-gray-100 rounded-xl cursor-pointer"><Edit3 size={15} /></button>
                <button type="button" onClick={() => handleDelete(it.id)} className="p-2 bg-red-50 text-red-700 rounded-xl cursor-pointer"><Trash2 size={15} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
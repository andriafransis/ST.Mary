import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { uploadChurchMedia } from '../lib/mediaUpload';
import {
  ArrowUp, ArrowDown, Eye, EyeOff, Palette, Save,
  Plus, Trash2, Edit3, Upload, Layout
} from 'lucide-react';

const DEFAULT_SECTIONS = [
  { key: 'summary', defaultTitle: 'ملخص الأرقام السريع', sort_order: 1 },
  { key: 'media', defaultTitle: 'معرض الصور والفيديوهات', sort_order: 2 },
  { key: 'news', defaultTitle: 'أخبار وأحداث الكنيسة', sort_order: 3 },
  { key: 'masses_trips', defaultTitle: 'مواعيد القداسات ومكتب الرحلات', sort_order: 4 },
  { key: 'priest_bio', defaultTitle: 'آباء الكنيسة', sort_order: 5 },
  { key: 'history', defaultTitle: 'تاريخ الكنيسة', sort_order: 6 }
];

const THEME_PRESETS = [
  { id: 'burgundy', label: 'عنابي كنسي كلاسيك', headerBg: 'from-[#5c1319] via-[#7a1c24] to-[#32060a]', pageBg: '#f6f4ef' },
  { id: 'royal_navy', label: 'كحلي ملكي وذهبي', headerBg: 'from-[#0f172a] via-[#1e3a5f] to-[#0b132b]', pageBg: '#f3f6fa' },
  { id: 'emerald', label: 'أخضر زمردي هادئ', headerBg: 'from-[#064e3b] via-[#065f46] to-[#022c22]', pageBg: '#f3f8f5' },
  { id: 'dark_purple', label: 'بنفسجي طقسي (صوم)', headerBg: 'from-[#3b0764] via-[#581c87] to-[#2e1065]', pageBg: '#f7f5fa' }
];

export default function AdminPageDesigner({ currentUser, onSaved }) {
  const [items, setItems] = useState([]);
  const [sections, setSections] = useState([]);
  const [themeRowId, setThemeRowId] = useState(null);
  const [themeConfig, setThemeConfig] = useState({
    preset: 'burgundy',
    headerBg: 'from-[#5c1319] via-[#7a1c24] to-[#32060a]',
    pageBg: '#f6f4ef',
    show_ticker: true,
    show_mary: true,
    show_edu_btn: true,
    show_joseph_btn: true,
    sticky_header: true
  });

  const [newItemForm, setNewItemForm] = useState({
    id: null, kind: 'news', title: '', body: '', time_text: '', location: '', url: ''
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'priest';

  const loadAll = async () => {
    const { data } = await supabase
      .from('church_public_content')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (!data) return;
    setItems(data);

    const cfgs = data.filter(i => i.kind === 'section_config');
    const merged = DEFAULT_SECTIONS.map(def => {
      const found = cfgs.find(c => c.title === def.key);
      return {
        key: def.key,
        id: found?.id || null,
        title: found?.body || def.defaultTitle,
        hidden: found?.location === 'hidden',
        sort_order: found?.sort_order ?? def.sort_order
      };
    }).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
    setSections(merged);

    const th = data.find(i => i.kind === 'theme_config');
    if (th) {
      setThemeRowId(th.id);
      try {
        const parsed = JSON.parse(th.body || '{}');
        setThemeConfig(prev => ({ ...prev, ...parsed }));
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin]);

  if (!isAdmin) return null;

  const moveSection = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const copy = [...sections];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    setSections(copy.map((s, idx) => ({ ...s, sort_order: idx + 1 })));
  };

  const saveLayoutAndTheme = async () => {
    setSaving(true);
    try {
      // 1. حفظ ترتيب وإظهار/إخفاء الأقسام
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        const payload = {
          kind: 'section_config',
          title: s.key,
          body: s.title.trim(),
          location: s.hidden ? 'hidden' : 'visible',
          sort_order: i + 1
        };
        if (s.id) {
          await supabase.from('church_public_content').update(payload).eq('id', s.id);
        } else {
          await supabase.from('church_public_content').insert([payload]);
        }
      }

      // 2. حفظ الألوان والإعدادات الشكلية
      const themePayload = {
        kind: 'theme_config',
        title: themeConfig.preset,
        body: JSON.stringify(themeConfig),
        sort_order: 0
      };
      if (themeRowId) {
        await supabase.from('church_public_content').update(themePayload).eq('id', themeRowId);
      } else {
        await supabase.from('church_public_content').insert([themePayload]);
      }

      await loadAll();
      if (onSaved) await onSaved();
      alert('تم حفظ تصميم وترتيب الصفحة الرئيسية بنجاح ✅');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadUrl = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadChurchMedia(file, newItemForm.kind || 'public');
      setNewItemForm(prev => ({ ...prev, url }));
    } catch (err) {
      alert('تعذر رفع الملف: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const payload = {
      kind: newItemForm.kind,
      title: newItemForm.title.trim(),
      body: newItemForm.body,
      time_text: newItemForm.time_text,
      location: newItemForm.location,
      url: newItemForm.url
    };
    if (newItemForm.id) {
      await supabase.from('church_public_content').update(payload).eq('id', newItemForm.id);
    } else {
      await supabase.from('church_public_content').insert([payload]);
    }
    setNewItemForm({ id: null, kind: 'news', title: '', body: '', time_text: '', location: '', url: '' });
    await loadAll();
    if (onSaved) await onSaved();
  };

  const contentItems = items.filter(i => !['section_config', 'theme_config', 'category_def'].includes(i.kind));

  return (
    <div className="space-y-5 text-xs md:text-sm" dir="rtl">
      {/* 1. ترتيب الأقسام وإظهارها أو إخفائها */}
      <div className="bg-white p-5 rounded-3xl border space-y-4 shadow-2xs">
        <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3">
          <h3 className="text-base font-black text-[#7a1c24] flex items-center gap-2">
            <Layout size={18} /> ترتيب ونقل أماكن أقسام الصفحة الرئيسية (نقل مكان مكان)
          </h3>
          <button
            type="button"
            disabled={saving}
            onClick={saveLayoutAndTheme}
            className="px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Save size={15} /> {saving ? 'جاري الحفظ...' : 'حفظ الترتيب والشكل'}
          </button>
        </div>

        <div className="space-y-2">
          {sections.map((sec, idx) => (
            <div key={sec.key} className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 ${sec.hidden ? 'bg-red-50/50 border-red-200' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <span className="px-2.5 py-1 bg-[#7a1c24] text-white rounded-lg font-black text-xs">{idx + 1}</span>
                <input
                  className="flex-1 p-2 border rounded-xl bg-white font-bold"
                  value={sec.title}
                  onChange={e => setSections(sections.map((s, i) => (i === idx ? { ...s, title: e.target.value } : s)))}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => moveSection(idx, -1)} disabled={idx === 0} className="p-2 bg-white border rounded-xl disabled:opacity-40 cursor-pointer" title="نقل لأعلى">
                  <ArrowUp size={15} />
                </button>
                <button type="button" onClick={() => moveSection(idx, 1)} disabled={idx === sections.length - 1} className="p-2 bg-white border rounded-xl disabled:opacity-40 cursor-pointer" title="نقل لأسفل">
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setSections(sections.map((s, i) => (i === idx ? { ...s, hidden: !s.hidden } : s)))}
                  className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1 cursor-pointer ${sec.hidden ? 'bg-red-600 text-white' : 'bg-emerald-100 text-emerald-900'}`}
                >
                  {sec.hidden ? <><EyeOff size={14} /> مخفي</> : <><Eye size={14} /> ظاهر</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. ألوان الصفحة وإعدادات الهيدر الثابت */}
      <div className="bg-white p-5 rounded-3xl border space-y-4 shadow-2xs">
        <h3 className="text-base font-black text-[#7a1c24] flex items-center gap-2 border-b pb-2">
          <Palette size={18} /> ألوان الصفحة وعناصر الواجهة الثابتة
        </h3>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {THEME_PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setThemeConfig(prev => ({ ...prev, preset: p.id, headerBg: p.headerBg, pageBg: p.pageBg }))}
              className={`p-3 rounded-2xl border-2 text-right cursor-pointer transition ${themeConfig.preset === p.id ? 'border-[#7a1c24] bg-amber-50' : 'border-gray-200 bg-white'}`}
            >
              <div className={`h-6 w-full rounded-lg bg-linear-to-r ${p.headerBg} mb-2`} />
              <strong className="text-xs block">{p.label}</strong>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-4 pt-2 font-bold text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={themeConfig.sticky_header !== false} onChange={e => setThemeConfig({ ...themeConfig, sticky_header: e.target.checked })} />
            تثبيت الهيدر الرئيسي فوق الصفحة عند السكرول
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={themeConfig.show_ticker !== false} onChange={e => setThemeConfig({ ...themeConfig, show_ticker: e.target.checked })} />
            إظهار شريط الأخبار والقداسات المتحرك
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={themeConfig.show_mary !== false} onChange={e => setThemeConfig({ ...themeConfig, show_mary: e.target.checked })} />
            إظهار أيقونة/صورة السيدة العذراء مريم
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={themeConfig.show_edu_btn !== false} onChange={e => setThemeConfig({ ...themeConfig, show_edu_btn: e.target.checked })} />
            إظهار زرار المركز التعليمي
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={themeConfig.show_joseph_btn !== false} onChange={e => setThemeConfig({ ...themeConfig, show_joseph_btn: e.target.checked })} />
            إظهار زرار يوسف الرامي
          </label>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={saveLayoutAndTheme}
          className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black cursor-pointer"
        >
          حفظ الألوان والإعدادات ✅
        </button>
      </div>

      {/* 3. إضافة / تعديل محتوى الصفحة الرئيسية مباشرة من صفحة الأدمن */}
      <div className="bg-white p-5 rounded-3xl border space-y-4 shadow-2xs">
        <h3 className="text-base font-black text-[#7a1c24] flex items-center gap-2 border-b pb-2">
          <Plus size={18} /> {newItemForm.id ? 'تعديل محتوى الصفحة' : 'إضافة / تعديل محتوى الصفحة الرئيسية (أخبار / قداسات / صورة العذراء / لوجو)'}
        </h3>

        <form onSubmit={handleSaveItem} className="space-y-3 font-bold">
          <div className="grid sm:grid-cols-3 gap-2">
            <select className="p-2.5 border rounded-xl bg-white" value={newItemForm.kind} onChange={e => setNewItemForm({ ...newItemForm, kind: e.target.value })}>
              <option value="news">📰 أخبار وأحداث الكنيسة</option>
              <option value="mass">⛪ ميعاد قداس</option>
              <option value="trip">🚌 إعلان رحلة</option>
              <option value="priest_bio">✝ أب كاهن</option>
              <option value="history">📜 تاريخ الكنيسة</option>
              <option value="virgin_mary">🕊️ صورة السيدة العذراء مريم</option>
              <option value="logo">🏛️ اسم الكنيسة واللوجو</option>
              <option value="image">🖼️ صورة في المعرض</option>
              <option value="video">🎬 فيديو</option>
              <option value="livestream">📺 بث مباشر</option>
            </select>
            <input required placeholder="العنوان / الاسم *" className="p-2.5 border rounded-xl" value={newItemForm.title} onChange={e => setNewItemForm({ ...newItemForm, title: e.target.value })} />
            <input placeholder="الوقت / التاريخ (اختياري)" className="p-2.5 border rounded-xl" value={newItemForm.time_text} onChange={e => setNewItemForm({ ...newItemForm, time_text: e.target.value })} />
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <input placeholder="المكان (اختياري)" className="p-2.5 border rounded-xl" value={newItemForm.location} onChange={e => setNewItemForm({ ...newItemForm, location: e.target.value })} />
            <div className="flex gap-1.5">
              <label className="px-3 py-2.5 bg-indigo-700 text-white rounded-xl text-xs cursor-pointer shrink-0 flex items-center gap-1">
                <Upload size={14} /> {uploading ? '...' : 'رفع صورة/فيديو'}
                <input type="file" accept="image/*,video/*" className="hidden" onChange={handleUploadUrl} />
              </label>
              <input placeholder="أو رابط مباشر..." className="flex-1 p-2.5 border rounded-xl" value={newItemForm.url} onChange={e => setNewItemForm({ ...newItemForm, url: e.target.value })} />
            </div>
          </div>

          <textarea rows="2" placeholder="التفاصيل / النص..." className="w-full p-2.5 border rounded-xl font-normal" value={newItemForm.body} onChange={e => setNewItemForm({ ...newItemForm, body: e.target.value })} />
          <div className="flex gap-2">
            <button type="submit" className="px-5 py-2.5 bg-[#7a1c24] text-white rounded-xl cursor-pointer">{newItemForm.id ? 'حفظ التعديل' : '+ إضافة ونشر'}</button>
            {newItemForm.id && <button type="button" onClick={() => setNewItemForm({ id: null, kind: 'news', title: '', body: '', time_text: '', location: '', url: '' })} className="px-4 py-2 border rounded-xl">إلغاء</button>}
          </div>
        </form>

        <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pt-2">
          {contentItems.map(it => (
            <div key={it.id} className="p-3 bg-gray-50 border rounded-2xl flex justify-between items-center gap-2 text-xs">
              <div className="min-w-0">
                <span className="px-2 py-0.5 bg-amber-100 rounded text-[10px] font-bold ml-1.5">{it.kind}</span>
                <strong className="truncate">{it.title}</strong>
              </div>
              <div className="flex gap-1 shrink-0">
                <button type="button" onClick={() => setNewItemForm({ id: it.id, kind: it.kind, title: it.title || '', body: it.body || '', time_text: it.time_text || '', location: it.location || '', url: it.url || '' })} className="p-1.5 bg-white border rounded-lg cursor-pointer"><Edit3 size={13} /></button>
                <button type="button" onClick={async () => { if (!confirm('حذف؟')) return; await supabase.from('church_public_content').delete().eq('id', it.id); loadAll(); }} className="p-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { uploadChurchMedia } from '../lib/mediaUpload';
import {
  Palette, Plus, Trash2, Edit3, Save, Upload, ArrowUp, ArrowDown,
  Eye, EyeOff, RefreshCw, Youtube, Facebook, Video, Newspaper,
  Calendar, Bus, UserPlus, BookOpen, ScrollText, Radio
} from 'lucide-react';

const THEME_PRESETS = [
  {
    key: 'classic_burgundy',
    label: 'عنابي كنسي كلاسيك',
    primary: '#7a1c24',
    dark: '#5c1319',
    accent: '#f59e0b',
    bg: '#fbfaf7',
    grad: 'from-[#5c1319] via-[#7a1c24] to-[#91212b]'
  },
  {
    key: 'royal_navy',
    label: 'كحلي ملكي وذهبي',
    primary: '#1e3a8a',
    dark: '#0f172a',
    accent: '#eab308',
    bg: '#f8fafc',
    grad: 'from-[#0f172a] via-[#1e3a8a] to-[#1d4ed8]'
  },
  {
    key: 'emerald_calm',
    label: 'أخضر زمردي هادئ',
    primary: '#065f46',
    dark: '#064e3b',
    accent: '#d97706',
    bg: '#f6fbf9',
    grad: 'from-[#064e3b] via-[#065f46] to-[#047857]'
  },
  {
    key: 'liturgical_purple',
    label: 'بنفسجي طقسي (صوم)',
    primary: '#581c87',
    dark: '#3b0764',
    accent: '#fbbf24',
    bg: '#faf7fc',
    grad: 'from-[#3b0764] via-[#581c87] to-[#6b21a8]'
  }
];

const DEFAULT_SECTIONS = [
  { id: 'hero_banner', title: 'بنر الكنيسة والترحيب', visible: true },
  { id: 'urgent_ticker', title: 'شريط الأخبار والقداسات المتحرك', visible: true },
  { id: 'virgin_mary_corner', title: 'ركن وصورة السيدة العذراء مريم', visible: true },
  { id: 'events_masses', title: 'مواعيد القداسات والاجتماعات', visible: true },
  { id: 'news_events', title: 'أخبار وأحداث الكنيسة', visible: true },
  { id: 'trips_section', title: 'إعلانات الرحلات', visible: true },
  { id: 'videos_section', title: 'فيديوهات القداسات والعظات', visible: true },
  { id: 'priests_history', title: 'الآباء الكهنة وتاريخ الكنيسة والتعليمات', visible: true },
  { id: 'edu_center_btn', title: 'أزرار المركز التعليمي', visible: true },
  { id: 'joseph_btn', title: 'أزرار خدمة يوسف الرامي', visible: true },
  { id: 'social_links', title: 'روابط يوتيوب وفيسبوك والبث المباشر', visible: true }
];

const CONTENT_KIND_OPTIONS = [
  { value: 'news', label: '📰 أخبار وأحداث الكنيسة' },
  { value: 'mass_event', label: '⛪ مواعيد قداس / اجتماع' },
  { value: 'trip', label: '🚌 إعلان رحلة' },
  { value: 'video', label: '🎬 فيديو (قداس أبونا / عظة)' },
  { value: 'priest_add', label: '✝ إضافة أب كاهن جديد' },
  { value: 'church_history', label: '📜 تاريخ الكنيسة / ملحوظة أب كاهن' },
  { value: 'instructions', label: '📌 تعليمات وتنبيهات' },
  { value: 'livestream', label: '📺 بث مباشر' }
];

const emptyItemForm = {
  kind: 'news',
  title: '',
  time_date: '',
  place: '',
  url: '',
  body: '',
  priest_degree: 'قس',
  ordination_date: ''
};

export default function AdminPageDesigner({ currentUser = null, onSaved }) {
  const isAdmin = currentUser?.role === 'admin' || Boolean(currentUser?.permissions?.can_edit_public);

  const [designRowId, setDesignRowId] = useState(null);
  const [themeKey, setThemeKey] = useState('classic_burgundy');
  const [stickyHeader, setStickyHeader] = useState(true);
  const [showTicker, setShowTicker] = useState(true);
  const [showVirginMary, setShowVirginMary] = useState(true);
  const [showEduButtons, setShowEduButtons] = useState(true);
  const [showJosephButtons, setShowJosephButtons] = useState(true);
  const [sections, setSections] = useState(DEFAULT_SECTIONS);

  // روابط يوتيوب وفيسبوك والبث المباشر
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [liveStreamUrl, setLiveStreamUrl] = useState('');

  // نموذج إضافة / تعديل محتوى للصفحة الرئيسية والصفحات الداخلية
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [editingItemId, setEditingItemId] = useState(null);
  const [contentItems, setContentItems] = useState([]);
  const [filterKind, setFilterKind] = useState('all');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);
  const [submittingItem, setSubmittingItem] = useState(false);

  const loadDesignerData = async () => {
    const [designRes, contentRes] = await Promise.all([
      supabase.from('church_public_content').select('*').eq('kind', 'page_design').limit(1).maybeSingle(),
      supabase.from('church_public_content').select('*').neq('kind', 'page_design').neq('kind', 'role_template').order('created_at', { ascending: false })
    ]);

    if (designRes.data) {
      setDesignRowId(designRes.data.id);
      try {
        const parsed = JSON.parse(designRes.data.body || '{}');
        if (parsed.themeKey) setThemeKey(parsed.themeKey);
        if (typeof parsed.stickyHeader === 'boolean') setStickyHeader(parsed.stickyHeader);
        if (typeof parsed.showTicker === 'boolean') setShowTicker(parsed.showTicker);
        if (typeof parsed.showVirginMary === 'boolean') setShowVirginMary(parsed.showVirginMary);
        if (typeof parsed.showEduButtons === 'boolean') setShowEduButtons(parsed.showEduButtons);
        if (typeof parsed.showJosephButtons === 'boolean') setShowJosephButtons(parsed.showJosephButtons);
        if (Array.isArray(parsed.sections) && parsed.sections.length > 0) setSections(parsed.sections);
        if (parsed.youtubeUrl) setYoutubeUrl(parsed.youtubeUrl);
        if (parsed.facebookUrl) setFacebookUrl(parsed.facebookUrl);
        if (parsed.liveStreamUrl) setLiveStreamUrl(parsed.liveStreamUrl);
      } catch {
        // ignore
      }
    }

    const savedYt = localStorage.getItem('church_youtube_url') || '';
    const savedFb = localStorage.getItem('church_facebook_url') || '';
    const savedLive = localStorage.getItem('church_livestream_url') || '';
    if (!designRes.data) {
      setYoutubeUrl(savedYt);
      setFacebookUrl(savedFb);
      setLiveStreamUrl(savedLive);
    }

    if (Array.isArray(contentRes.data)) {
      setContentItems(contentRes.data);
    }
  };

  useEffect(() => {
    loadDesignerData();
  }, []);

  const handleSaveThemeAndSocial = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('🔒 غير مسموح بتعديل تصميم الصفحة.');
      return;
    }
    setSavingDesign(true);
    try {
      const payloadBody = JSON.stringify({
        themeKey,
        stickyHeader,
        showTicker,
        showVirginMary,
        showEduButtons,
        showJosephButtons,
        sections,
        youtubeUrl: youtubeUrl.trim(),
        facebookUrl: facebookUrl.trim(),
        liveStreamUrl: liveStreamUrl.trim()
      });

      if (designRowId) {
        await supabase
          .from('church_public_content')
          .update({ title: 'page_design', body: payloadBody, url: youtubeUrl.trim() || liveStreamUrl.trim() })
          .eq('id', designRowId);
      } else {
        const { data } = await supabase
          .from('church_public_content')
          .insert([{ kind: 'page_design', title: 'page_design', body: payloadBody, url: youtubeUrl.trim() || liveStreamUrl.trim(), sort_order: 0 }])
          .select()
          .single();
        if (data) setDesignRowId(data.id);
      }

      localStorage.setItem('church_youtube_url', youtubeUrl.trim());
      localStorage.setItem('church_facebook_url', facebookUrl.trim());
      localStorage.setItem('church_livestream_url', liveStreamUrl.trim());

      if (onSaved) await onSaved();
      alert('تم حفظ ألوان الواجهة، ترتيب الأقسام، وروابط يوتيوب وفيسبوك بنجاح ✅');
    } finally {
      setSavingDesign(false);
    }
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    try {
      const folder = itemForm.kind === 'video' ? 'videos' : 'public_content';
      const url = await uploadChurchMedia(file, folder);
      setItemForm(prev => ({ ...prev, url }));
    } catch (err) {
      alert('تعذر رفع الملف: ' + err.message);
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
  };

  const handlePublishContent = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('🔒 غير مسموح بإضافة أو تعديل المحتوى.');
      return;
    }
    if (!itemForm.title.trim()) {
      alert('يرجى إدخال العنوان أو الاسم.');
      return;
    }

    setSubmittingItem(true);
    try {
      // لو النوع "مواعيد قداس / اجتماع" نضيفه أيضاً في جدول church_events ليظهر في مواعيد القداسات مباشرة
      if (itemForm.kind === 'mass_event') {
        await supabase.from('church_events').insert([{
          event_type: 'قداس إلهي',
          title: itemForm.title.trim(),
          event_time: itemForm.time_date.trim() || 'حسب الجدول',
          place: itemForm.place.trim() || 'الكنيسة الرئيسية',
          priest_name: '',
          target_stage: 'الكل'
        }]);
      }

      // لو النوع "إضافة أب كاهن جديد" ننشئ له حساب/سجل كاهن في church_users إذا لم يكن موجوداً
      if (itemForm.kind === 'priest_add') {
        const cleanParts = itemForm.title.trim().split(/\s+/);
        const autoUsername = `priest_${Date.now().toString().slice(-5)}`;
        await supabase.from('church_users').insert([{
          first_name: cleanParts[0] || itemForm.title.trim(),
          second_name: cleanParts[1] || 'كاهن',
          third_name: cleanParts[2] || 'الكنيسة',
          fourth_name: cleanParts.slice(3).join(' ') || 'المقدسة',
          full_name: itemForm.title.trim(),
          username: autoUsername,
          password: `Priest@${Date.now().toString().slice(-4)}`,
          role: 'priest',
          priest_degree: itemForm.priest_degree || 'قس',
          ordination_date: itemForm.ordination_date || null,
          priest_family_notes: itemForm.body.trim(),
          member_status: 'active'
        }]);
      }

      const structuredBody = JSON.stringify({
        text: itemForm.body.trim(),
        time_date: itemForm.time_date.trim(),
        place: itemForm.place.trim(),
        priest_degree: itemForm.priest_degree,
        ordination_date: itemForm.ordination_date
      });

      const payload = {
        kind: itemForm.kind,
        title: itemForm.title.trim(),
        body: structuredBody,
        url: itemForm.url.trim(),
        sort_order: 1
      };

      if (editingItemId) {
        const { error } = await supabase
          .from('church_public_content')
          .update(payload)
          .eq('id', editingItemId);
        if (error) return alert(error.message);
        setEditingItemId(null);
      } else {
        const { error } = await supabase
          .from('church_public_content')
          .insert([payload]);
        if (error) return alert(error.message);
      }

      setItemForm(emptyItemForm);
      await loadDesignerData();
      if (onSaved) await onSaved();
      alert('تم النشر وتوجيه المحتوى إلى قسمه بنجاح ✅');
    } finally {
      setSubmittingItem(false);
    }
  };

  const handleDeleteContentItem = async (id) => {
    if (!isAdmin) return;
    if (!confirm('هل تريد حذف هذا العنصر؟')) return;
    await supabase.from('church_public_content').delete().eq('id', id);
    await loadDesignerData();
    if (onSaved) await onSaved();
  };

  const moveSection = (idx, dir) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= sections.length) return;
    const copy = [...sections];
    const [moved] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, moved);
    setSections(copy);
  };

  const toggleSectionVisibility = (id) => {
    setSections(prev => prev.map(s => (s.id === id ? { ...s, visible: !s.visible } : s)));
  };

  const visibleItems = contentItems.filter(it => (filterKind === 'all' ? true : it.kind === filterKind));

  return (
    <div className="space-y-5 text-xs" dir="rtl">
      {/* 1) ألوان الصفحة وعناصر الواجهة الثابتة + روابط يوتيوب وفيسبوك */}
      <form onSubmit={handleSaveThemeAndSocial} className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 text-[#7a1c24] font-black text-sm">
            <Palette size={18} /> ألوان الصفحة وعناصر الواجهة الثابتة وروابط يوتيوب وفيسبوك
          </div>
          <button
            type="submit"
            disabled={savingDesign || !isAdmin}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Save size={14} /> {savingDesign ? 'جاري الحفظ...' : 'حفظ الألوان والإعدادات والروابط ✅'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {THEME_PRESETS.map(preset => {
            const active = themeKey === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => setThemeKey(preset.key)}
                className={`p-3 rounded-2xl border-2 text-right transition cursor-pointer space-y-2 ${
                  active ? 'border-[#7a1c24] bg-amber-50/40 shadow-xs' : 'border-gray-200 bg-[#fbfaf7]'
                }`}
              >
                <div className={`h-4 w-full rounded-full bg-linear-to-r ${preset.grad}`} />
                <div className="font-black text-gray-900 text-xs">{preset.label}</div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-4 pt-1 font-bold text-gray-800">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={stickyHeader} onChange={e => setStickyHeader(e.target.checked)} />
            تثبيت الهيدر الرئيسي فوق الصفحة عند السكرول
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showTicker} onChange={e => setShowTicker(e.target.checked)} />
            إظهار شريط الأخبار والقداسات المتحرك
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showVirginMary} onChange={e => setShowVirginMary(e.target.checked)} />
            إظهار أيقونة/صورة السيدة العذراء مريم
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showEduButtons} onChange={e => setShowEduButtons(e.target.checked)} />
            إظهار أزرار المركز التعليمي
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showJosephButtons} onChange={e => setShowJosephButtons(e.target.checked)} />
            إظهار أزرار يوسف الرامي
          </label>
        </div>

        {/* روابط صفحة اليوتيوب وصفحة الفيسبوك والبث المباشر */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
          <div className="bg-red-50/60 border border-red-200 p-3 rounded-2xl space-y-1.5">
            <label className="flex items-center gap-1.5 font-black text-red-900">
              <Youtube size={16} className="text-red-600" /> رابط صفحة / قناة اليوتيوب
            </label>
            <input
              type="url"
              placeholder="https://youtube.com/@..."
              className="w-full p-2 bg-white border border-red-200 rounded-xl outline-none"
              value={youtubeUrl}
              onChange={e => setYoutubeUrl(e.target.value)}
            />
          </div>

          <div className="bg-blue-50/60 border border-blue-200 p-3 rounded-2xl space-y-1.5">
            <label className="flex items-center gap-1.5 font-black text-blue-950">
              <Facebook size={16} className="text-blue-600" /> رابط صفحة الفيسبوك الرسمية
            </label>
            <input
              type="url"
              placeholder="https://facebook.com/..."
              className="w-full p-2 bg-white border border-blue-200 rounded-xl outline-none"
              value={facebookUrl}
              onChange={e => setFacebookUrl(e.target.value)}
            />
          </div>

          <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-2xl space-y-1.5">
            <label className="flex items-center gap-1.5 font-black text-amber-950">
              <Radio size={16} className="text-amber-700" /> رابط البث المباشر (اختياري)
            </label>
            <input
              type="url"
              placeholder="https://..."
              className="w-full p-2 bg-white border border-amber-200 rounded-xl outline-none"
              value={liveStreamUrl}
              onChange={e => setLiveStreamUrl(e.target.value)}
            />
          </div>
        </div>

        {/* ترتيب وإخفاء/إظهار أقسام الصفحة الرئيسية والصفحات الداخلية */}
        <div className="pt-2 border-t border-gray-100 space-y-2">
          <span className="block font-black text-gray-800">ترتيب وإخفاء/إظهار أقسام الصفحة والصفحات الداخلية:</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sections.map((sec, idx) => (
              <div key={sec.id} className="flex items-center justify-between bg-[#fbfaf7] border border-gray-200 px-3 py-2 rounded-xl">
                <span className={`font-bold ${sec.visible ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                  {idx + 1}. {sec.title}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveSection(idx, -1)} className="p-1 bg-white border rounded-lg cursor-pointer" title="لأعلى"><ArrowUp size={13} /></button>
                  <button type="button" onClick={() => moveSection(idx, 1)} className="p-1 bg-white border rounded-lg cursor-pointer" title="لأسفل"><ArrowDown size={13} /></button>
                  <button type="button" onClick={() => toggleSectionVisibility(sec.id)} className="p-1 bg-white border rounded-lg cursor-pointer" title="إظهار/إخفاء">
                    {sec.visible ? <Eye size={13} className="text-emerald-700" /> : <EyeOff size={13} className="text-gray-400" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>

      {/* 2) إضافة / تعديل محتوى للصفحة الرئيسية والصفحات الداخلية وتوجيهه لمكانه */}
      <form onSubmit={handlePublishContent} className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-black text-[#7a1c24] flex items-center gap-1.5">
            <Plus size={17} /> {editingItemId ? 'تعديل عنصر منشور' : 'إضافة / تعديل محتوى وتوجيهه للقسم المختص'}
          </h3>
          {editingItemId && (
            <button
              type="button"
              onClick={() => { setEditingItemId(null); setItemForm(emptyItemForm); }}
              className="px-3 py-1 bg-gray-100 rounded-xl font-bold cursor-pointer"
            >
              إلغاء التعديل
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <select
            className="p-2.5 bg-[#fbfaf7] border border-gray-200 rounded-xl font-bold outline-none focus:border-[#7a1c24]"
            value={itemForm.kind}
            onChange={e => setItemForm({ ...itemForm, kind: e.target.value })}
          >
            {CONTENT_KIND_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <input
            required
            placeholder="العنوان أو الاسم (مثلاً: قداس أبونا / رحلة / خبر) *"
            className="p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#7a1c24]"
            value={itemForm.title}
            onChange={e => setItemForm({ ...itemForm, title: e.target.value })}
          />

          <input
            placeholder="الوقت / التاريخ (اختياري)"
            className="p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#7a1c24]"
            value={itemForm.time_date}
            onChange={e => setItemForm({ ...itemForm, time_date: e.target.value })}
          />
        </div>

        {itemForm.kind === 'priest_add' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-amber-50/70 p-3 rounded-2xl border border-amber-200">
            <select
              className="p-2 bg-white border rounded-xl font-bold"
              value={itemForm.priest_degree}
              onChange={e => setItemForm({ ...itemForm, priest_degree: e.target.value })}
            >
              <option value="قس">قس</option>
              <option value="قمص">قمص</option>
              <option value="أسقف / مطران">أسقف / مطران</option>
            </select>
            <input
              type="date"
              className="p-2 bg-white border rounded-xl"
              value={itemForm.ordination_date}
              onChange={e => setItemForm({ ...itemForm, ordination_date: e.target.value })}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-center">
          <input
            placeholder="المكان / الوجهة (اختياري)"
            className="p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#7a1c24]"
            value={itemForm.place}
            onChange={e => setItemForm({ ...itemForm, place: e.target.value })}
          />

          <div className="flex gap-2 md:col-span-2">
            <label className={`px-3.5 py-2.5 rounded-xl font-black flex items-center gap-1.5 cursor-pointer shrink-0 ${
              uploadingMedia ? 'bg-gray-300 text-gray-600' : 'bg-indigo-700 hover:bg-indigo-800 text-white'
            }`}>
              <Upload size={14} /> {uploadingMedia ? 'جاري الرفع...' : 'رفع صورة أو فيديو'}
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                disabled={uploadingMedia}
                onChange={handleUploadFile}
              />
            </label>
            <input
              placeholder="أو ضع رابط مباشر لصورة / فيديو قداس / يوتيوب / فيسبوك..."
              className="flex-1 p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#7a1c24]"
              value={itemForm.url}
              onChange={e => setItemForm({ ...itemForm, url: e.target.value })}
            />
          </div>
        </div>

        <textarea
          rows={3}
          placeholder="التفاصيل / النص / ملحوظة عن أب كاهن أو تاريخ الكنيسة أو التعليمات..."
          className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#7a1c24]"
          value={itemForm.body}
          onChange={e => setItemForm({ ...itemForm, body: e.target.value })}
        />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submittingItem || uploadingMedia || !isAdmin}
            className="px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer shadow-xs"
          >
            {submittingItem ? 'جاري النشر...' : editingItemId ? 'حفظ التعديل ✅' : '+ إضافة ونشر في قسمه'}
          </button>
        </div>
      </form>

      {/* 3) قائمة العناصر المنشورة لإدارتها وتعديلها */}
      <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h4 className="font-black text-sm text-[#7a1c24]">العناصر المنشورة حسب القسم ({visibleItems.length})</h4>
          <select
            className="p-2 bg-[#fbfaf7] border rounded-xl font-bold"
            value={filterKind}
            onChange={e => setFilterKind(e.target.value)}
          >
            <option value="all">كل الأقسام</option>
            {CONTENT_KIND_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-2.5">
          {visibleItems.length === 0 ? (
            <p className="text-center text-gray-400 py-5">لا توجد عناصر منشورة في هذا القسم حالياً.</p>
          ) : (
            visibleItems.map(item => {
              let parsed = { text: item.body || '', time_date: '', place: '' };
              try {
                const obj = JSON.parse(item.body || '{}');
                if (obj && typeof obj === 'object' && ('text' in obj || 'time_date' in obj)) {
                  parsed = { ...parsed, ...obj };
                }
              } catch {
                // plain text
              }
              const kindLabel = CONTENT_KIND_OPTIONS.find(o => o.value === item.kind)?.label || item.kind;
              return (
                <div key={item.id} className="p-3.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl flex flex-wrap justify-between items-start gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-950 font-black text-[10px]">{kindLabel}</span>
                      <strong className="text-sm text-gray-900">{item.title}</strong>
                      {parsed.time_date && <span className="text-gray-500 text-[11px]">⏰ {parsed.time_date}</span>}
                      {parsed.place && <span className="text-gray-500 text-[11px]">📍 {parsed.place}</span>}
                    </div>
                    {parsed.text && <p className="text-gray-700 leading-relaxed">{parsed.text}</p>}
                    {item.url && (
                      <p className="text-[11px] text-blue-700 break-all">🔗 {item.url}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItemId(item.id);
                          setItemForm({
                            kind: item.kind || 'news',
                            title: item.title || '',
                            time_date: parsed.time_date || '',
                            place: parsed.place || '',
                            url: item.url || '',
                            body: parsed.text || '',
                            priest_degree: parsed.priest_degree || 'قس',
                            ordination_date: parsed.ordination_date || ''
                          });
                        }}
                        className="px-2.5 py-1.5 bg-white border rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 size={13} /> تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContentItem(item.id)}
                        className="px-2.5 py-1.5 bg-red-50 text-red-700 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={13} /> حذف
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
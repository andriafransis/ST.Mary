import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { uploadChurchMedia } from '../lib/mediaUpload';
import {
  Trash2, Edit3, Plus, Globe, Upload, X, Layers,
  AlertTriangle, Check, Calendar, Clock, Link2, Radio,
  Image as ImageIcon, Video, Church, Bus, UserCheck, BookOpen, Sparkles
} from 'lucide-react';

const CONTENT_SPECS = [
  {
    value: 'livestream',
    label: '📺 بث مباشر (ميعاد + رابط يوتيوب / فيسبوك / مباشر)',
    domain: 'بث مباشر • ميعاد ورابط',
    titleLabel: 'عنوان البث المباشر *',
    titlePlaceholder: 'مثال: بث مباشر القداس الإلهي / عشية / عظة',
    dateLabel: 'تاريخ البث',
    timeLabel: 'ميعاد البث (الساعة) *',
    timePlaceholder: 'مثال: 08:00 ص أو 07:30 م',
    locationLabel: 'المنصة / القاعة',
    locationPlaceholder: 'YouTube / Facebook / الكنيسة الكبرى',
    urlLabel: 'رابط البث المباشر (URL) *',
    urlPlaceholder: 'https://www.youtube.com/watch?v=... أو رابط البث',
    bodyLabel: 'تفاصيل / تنويه البث',
    bodyPlaceholder: 'مثال: البث يبدأ قبل القداس بربع ساعة...',
    mediaType: 'link_or_video',
    acceptMedia: 'video/*'
  },
  {
    value: 'facebook_page',
    label: '📘 ربط صفحة فيسبوك الكنيسة (رابط + مواعيد + بيانات)',
    domain: 'سوشيال ميديا • ربط URL ومواعيد',
    titleLabel: 'اسم صفحة فيسبوك *',
    titlePlaceholder: 'مثال: صفحة كنيسة السيدة العذراء بالمطرية الرسمية',
    dateLabel: 'تاريخ التحديث / الإطلاق',
    timeLabel: 'مواعيد النشر أو البث على فيسبوك',
    timePlaceholder: 'مثال: يومياً 7:00 م / أيام الجمع والآحاد',
    locationLabel: 'حالة الربط / القسم',
    locationPlaceholder: 'مرتبط رسمياً • الصفحة الرئيسية',
    urlLabel: 'رابط صفحة فيسبوك (Facebook URL) *',
    urlPlaceholder: 'https://www.facebook.com/...',
    bodyLabel: 'وصف الصفحة وتعليمات المتابعة',
    bodyPlaceholder: 'نبذة عن الصفحة الرسمية وأخبارها...',
    mediaType: 'image_or_url',
    acceptMedia: 'image/*'
  },
  {
    value: 'youtube_channel',
    label: '▶️ ربط قناة يوتيوب الكنيسة (رابط القناة + مواعيد)',
    domain: 'سوشيال ميديا • ربط URL ومواعيد',
    titleLabel: 'اسم قناة يوتيوب *',
    titlePlaceholder: 'مثال: قناة الكنيسة الرسمية على يوتيوب',
    dateLabel: 'تاريخ الربط',
    timeLabel: 'مواعيد العروض / البث على يوتيوب',
    timePlaceholder: 'مثال: الأحد 8:00 ص — بث القداس والعظات',
    locationLabel: 'معرّف القناة / التصنيف',
    locationPlaceholder: '@ChannelHandle أو UC...',
    urlLabel: 'رابط قناة يوتيوب (YouTube URL) *',
    urlPlaceholder: 'https://www.youtube.com/@... أو https://www.youtube.com/channel/...',
    bodyLabel: 'وصف القناة وقوائم التشغيل',
    bodyPlaceholder: 'تفاصيل القناة والقداسات والعظات المسجلة...',
    mediaType: 'image_or_url',
    acceptMedia: 'image/*'
  },
  {
    value: 'mass',
    label: '⛪ ميعاد قداس (التاريخ والوقت بالظبط + المكان)',
    domain: 'مواعيد • تاريخ ووقت ومكان',
    titleLabel: 'اسم القداس *',
    titlePlaceholder: 'مثال: القداس الأول / قداس الشباب / قداس المرضى',
    dateLabel: 'تاريخ القداس *',
    timeLabel: 'وقت القداس (من - إلى) *',
    timePlaceholder: 'مثال: من 6:00 ص إلى 8:30 ص',
    locationLabel: 'مكان القداس (الكنيسة / المذبح) *',
    locationPlaceholder: 'مثال: الكنيسة الكبرى / مذبح مار مرقس',
    urlLabel: 'رابط بث القداس (اختياري)',
    urlPlaceholder: 'https://... (اختياري لو القداس مذاع)',
    bodyLabel: 'ملاحظات القداس (تسبحة / قراءات / تنبيهات)',
    bodyPlaceholder: 'مثال: تسبحة نصف الليل تبدأ 5:00 ص...',
    mediaType: 'none',
    acceptMedia: ''
  },
  {
    value: 'trip',
    label: '🚌 رحلة كنسية / مؤتمر (الميعاد + التحرك + البرنامج)',
    domain: 'رحلات ومؤتمرات • ميعاد وبرنامج',
    titleLabel: 'اسم الرحلة أو المؤتمر *',
    titlePlaceholder: 'مثال: رحلة دير الأنبا بيشوي ووادي النطرون',
    dateLabel: 'تاريخ الرحلة *',
    timeLabel: 'ميعاد التجمع والتحرك *',
    timePlaceholder: 'مثال: التجمع 6:00 ص — التحرك 6:30 ص',
    locationLabel: 'نقطة التجمع / الوجهة *',
    locationPlaceholder: 'مثال: أمام باب الكنيسة الرئيسي — وادي النطرون',
    urlLabel: 'رابط بوستر أو استمارة الرحلة (اختياري)',
    urlPlaceholder: 'https://...',
    bodyLabel: 'برنامج الرحلة والتكلفة والتفاصيل *',
    bodyPlaceholder: 'اكتب برنامج اليوم، المزارات، الاشتراك، ورقم الحجز...',
    mediaType: 'image_or_url',
    acceptMedia: 'image/*'
  },
  {
    value: 'news',
    label: '📰 خبر / مناسبة / إعلان (الميعاد + التفاصيل + صورة)',
    domain: 'أخبار وإعلانات • ميعاد ومحتوى',
    titleLabel: 'عنوان الخبر أو المناسبة *',
    titlePlaceholder: 'مثال: نهضة شفيع الكنيسة / اجتماع الخدام / إعلان هام',
    dateLabel: 'تاريخ المناسبة / النشر',
    timeLabel: 'ميعاد الفعالية أو التوقيت',
    timePlaceholder: 'مثال: الثلاثاء 7:30 مساءً',
    locationLabel: 'المكان / القاعة',
    locationPlaceholder: 'مثال: قاعة الآباء / مسرح الكنيسة',
    urlLabel: 'صورة مرفقة أو رابط خبر (اختياري)',
    urlPlaceholder: 'https://... أو ارفع صورة من جهازك',
    bodyLabel: 'نص الخبر أو الإعلان *',
    bodyPlaceholder: 'اكتب تفاصيل الخبر أو الإعلان بالكامل...',
    mediaType: 'image_or_url',
    acceptMedia: 'image/*'
  },
  {
    value: 'priest_bio',
    label: '✝ أب كاهن (الاسم + تاريخ الرسامة + البيانات + الصورة)',
    domain: 'آباء الكنيسة • بيانات وسيرة',
    titleLabel: 'اسم الأب الكاهن *',
    titlePlaceholder: 'مثال: أبونا القمص / أبونا القس ...',
    dateLabel: 'تاريخ الرسامة الكهنوتية',
    timeLabel: 'الدرجة الكهنوتية / مدة الخدمة',
    timePlaceholder: 'مثال: قمص — رُسم في ...',
    locationLabel: 'رقم التليفون / مسؤولية الخدمة',
    locationPlaceholder: 'مثال: 010... — مسؤول خدمة ...',
    urlLabel: 'صورة الأب الكاهن (من الجهاز أو رابط)',
    urlPlaceholder: 'https://... أو ارفع صورة من جهازك',
    bodyLabel: 'نبذة وسيرة الأب الكاهن',
    bodyPlaceholder: 'اكتب نبذة عن الخدمة، تاريخ الرسامة، أو بيانات التواصل...',
    mediaType: 'image_or_url',
    acceptMedia: 'image/*'
  },
  {
    value: 'image',
    label: '🖼️ صورة / بانر / إعلان مصور (رفع ميديا أو رابط)',
    domain: 'ميديا • صور وبانرات',
    titleLabel: 'عنوان الصورة أو البانر *',
    titlePlaceholder: 'مثال: بانر نهضة / إعلان خدمة',
    dateLabel: 'تاريخ العرض',
    timeLabel: 'مدة أو توقيت العرض',
    timePlaceholder: 'مثال: طوال فترة النهضة',
    locationLabel: 'مكان العرض / التصنيف',
    locationPlaceholder: 'معرض الصور / بانر رئيسي',
    urlLabel: 'ملف الصورة أو رابطها *',
    urlPlaceholder: 'https://... أو ارفع صورة من جهازك',
    bodyLabel: 'شرح الصورة أو التعليق عليها',
    bodyPlaceholder: 'وصف مختصر للصورة...',
    mediaType: 'image_or_url',
    acceptMedia: 'image/*'
  },
  {
    value: 'video',
    label: '🎬 فيديو ترحيبي / متحرك (رفع فيديو أو رابط يوتيوب/مباشر)',
    domain: 'ميديا • فيديو وروابط',
    titleLabel: 'عنوان الفيديو *',
    titlePlaceholder: 'مثال: فيديو ترحيبي بالكنيسة / ترنيمة / كليب',
    dateLabel: 'تاريخ الفيديو',
    timeLabel: 'مدة أو ميعاد العرض',
    timePlaceholder: 'مثال: 03:45 دقيقة أو مع الاحتفال',
    locationLabel: 'المصدر / المكان',
    locationPlaceholder: 'YouTube / ملف مرفوع / الكنيسة',
    urlLabel: 'رابط الفيديو أو ملف من الجهاز *',
    urlPlaceholder: 'https://www.youtube.com/watch?v=... أو رابط مباشر',
    bodyLabel: 'وصف الفيديو',
    bodyPlaceholder: 'تفاصيل الفيديو...',
    mediaType: 'video_or_url',
    acceptMedia: 'video/*'
  },
  {
    value: 'history',
    label: '📜 تاريخ الكنيسة وحياتها (الفترة الزمنية + السرد + صورة)',
    domain: 'تاريخ وتوثيق • فترة زمنية وسرد',
    titleLabel: 'عنوان الفصل التاريخي *',
    titlePlaceholder: 'مثال: تأسيس الكنيسة / تطور المباني / سيرة الشفيع',
    dateLabel: 'سنة التأسيس أو التاريخ',
    timeLabel: 'الحقبة الزمنية',
    timePlaceholder: 'مثال: منذ عام ...',
    locationLabel: 'الموقع الجغرافي / الحي',
    locationPlaceholder: 'مثال: المطرية — القاهرة',
    urlLabel: 'صورة تاريخية أو وثيقة (اختياري)',
    urlPlaceholder: 'https://... أو ارفع صورة من جهازك',
    bodyLabel: 'نص التاريخ والوقائع *',
    bodyPlaceholder: 'اكتب تاريخ الكنيسة وأهم محطاتها...',
    mediaType: 'image_or_url',
    acceptMedia: 'image/*'
  },
  {
    value: 'logo',
    label: '✝ اسم الكنيسة وشعارها (لوجو متحرك)',
    domain: 'هوية الكنيسة • شعار وعنوان',
    titleLabel: 'اسم الكنيسة الرسمي *',
    titlePlaceholder: 'كنيسة السيدة العذراء مريم بالمطرية',
    dateLabel: 'سنة التأسيس (اختياري)',
    timeLabel: 'شعار مختصر / عبارة ترحيب',
    timePlaceholder: 'مثال: بيت الرب • باب السماء',
    locationLabel: 'العنوان المختصر',
    locationPlaceholder: 'المطرية، القاهرة',
    urlLabel: 'شعار الكنيسة (Logo) من الجهاز أو رابط',
    urlPlaceholder: 'https://... أو ارفع شعار من جهازك',
    bodyLabel: 'الوصف الفرعي تحت اسم الكنيسة في الهيدر',
    bodyPlaceholder: 'مواعيد القداسات، مكتب الرحلات العامة، أخبار الكنيسة، والآباء الكهنة',
    mediaType: 'image_or_url',
    acceptMedia: 'image/*'
  },
  {
    value: 'virgin_mary',
    label: '🕊️ صورة السيدة العذراء مريم (بجانب الترحيب)',
    domain: 'هوية الكنيسة • أيقونة وصورة',
    titleLabel: 'عنوان الأيقونة / الصورة *',
    titlePlaceholder: 'السيدة العذراء مريم — أم النور',
    dateLabel: 'تاريخ المناسبة (اختياري)',
    timeLabel: 'تعليق أو بركة قصيرة',
    timePlaceholder: 'مثال: شفاعتها تكون معنا جميعاً',
    locationLabel: 'مكان العرض',
    locationPlaceholder: 'الهيدر الرئيسي بجانب الترحيب',
    urlLabel: 'صورة السيدة العذراء (من الجهاز أو رابط) *',
    urlPlaceholder: 'https://... أو ارفع صورة من جهازك',
    bodyLabel: 'ملاحظة أو طلب شفاعة',
    bodyPlaceholder: 'وصف اختياري للصورة...',
    mediaType: 'image_or_url',
    acceptMedia: 'image/*'
  }
];

const SYSTEM_KINDS = ['theme_config', 'section_config', 'category_def', 'role_template'];

function getSpecForKind(kind, customCategories = []) {
  const found = CONTENT_SPECS.find(s => s.value === kind);
  if (found) return found;

  const customCat = customCategories.find(c => c.title === kind);
  const customLabel = customCat?.body || kind;
  return {
    value: kind,
    label: `✨ ${customLabel}`,
    domain: 'قسم مخصص • بيانات وروابط ومواعيد',
    titleLabel: `عنوان البند في (${customLabel}) *`,
    titlePlaceholder: 'اكتب العنوان...',
    dateLabel: 'التاريخ',
    timeLabel: 'الوقت / الميعاد',
    timePlaceholder: 'مثال: السبت 6:00 م',
    locationLabel: 'المكان / التصنيف',
    locationPlaceholder: 'اكتب المكان أو المعلومة الإضافية...',
    urlLabel: 'ملف أو رابط (اختياري)',
    urlPlaceholder: 'https://... أو ارفع ملف من جهازك',
    bodyLabel: 'التفاصيل / الوصف',
    bodyPlaceholder: 'اكتب التفاصيل...',
    mediaType: 'image_or_url',
    acceptMedia: 'image/*,video/*'
  };
}

function toYouTubeEmbed(rawUrl = '') {
  const u = rawUrl.trim();
  if (!u) return '';
  const m = u.match(/(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (m && m[1]) return `https://www.youtube.com/embed/${m[1]}?rel=0`;
  return '';
}

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

// دمج التاريخ والوقت في حقل time_text المتوافق مع الداتابيز و PublicPage
function composeScheduleText(dateVal, timeVal) {
  const d = (dateVal || '').trim();
  const t = (timeVal || '').trim();
  if (d && t) return `${d} • ${t}`;
  return d || t || '';
}

// فصل time_text المخزن في الداتابيز إلى تاريخ ووقت عند التعديل
function splitScheduleText(raw = '') {
  const s = (raw || '').trim();
  if (!s) return { event_date: '', event_time: '' };
  const parts = s.split('•').map(p => p.trim());
  if (parts.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
    return { event_date: parts[0], event_time: parts.slice(1).join(' • ') };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return { event_date: s, event_time: '' };
  }
  return { event_date: '', event_time: s };
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
    kind: 'livestream',
    title: '',
    event_date: '',
    event_time: '',
    location: '',
    url: '',
    body: '',
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
  const currentSpec = getSpecForKind(form.kind, customCategories);

  const allKinds = [
    ...CONTENT_SPECS.map(s => ({ value: s.value, label: s.label })),
    ...customCategories.map(c => ({ value: c.title, label: `✨ ${c.body || c.title}` }))
  ];

  const cleanContentItems = items.filter(
    it => !SYSTEM_KINDS.includes(it.kind) && !looksLikeSystemJson(it)
  );

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
        time_text: composeScheduleText(form.event_date, form.event_time),
        location: (form.location || '').trim(),
        url: (form.url || '').trim(),
        body: form.body || '',
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
    const parsedTime = splitScheduleText(it.time_text);
    setEditingId(it.id);
    setCreatingCat(false);
    setForm({
      kind: it.kind || 'news',
      title: it.title || '',
      event_date: parsedTime.event_date,
      event_time: parsedTime.event_time,
      location: it.location || '',
      url: it.url || '',
      body: it.body || '',
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
    if (!confirm(`سيتم حذف ${pollutedJsonItems.length} سجل تالف من جدول المحتوى العام. هل أنت متأكد؟`)) return;
    const ids = pollutedJsonItems.map(i => i.id);
    const { error } = await supabase.from('church_public_content').delete().in('id', ids);
    if (error) return alert('تعذر التنظيف: ' + error.message);
    setItems(prev => prev.filter(i => !ids.includes(i.id)));
  };

  const ytEmbedUrl = toYouTubeEmbed(form.url);
  const canUploadFile = Boolean(currentSpec.acceptMedia);

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-4 text-xs md:text-sm" dir="rtl">
      {/* الهيدر */}
      <div className="bg-white p-4 rounded-3xl border shadow-sm flex flex-wrap justify-between items-center gap-2">
        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-black text-[#7a1c24]">✏️ إدارة وتعديل واجهة الكنيسة العامة</h2>
          <p className="text-xs text-gray-500">كل نوع محتوى له تخصصه، مواعيده، وروابطه أو ملفاته المربوطة مباشرة بالداتابيز</p>
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

      {/* تنبيه تنظيف السجلات التالفة */}
      {pollutedJsonItems.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-start gap-2 text-red-900">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-600" />
            <div>
              <strong className="block text-xs font-black">
                تم اكتشاف {pollutedJsonItems.length} سجلات بيانات نظام/صلاحيات (JSON) داخل جدول المحتوى العام
              </strong>
              <span className="text-[11px] text-red-700">
                مخفية تلقائياً من العرض، ويمكنك حذفها نهائياً من قاعدة البيانات الآن.
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

      {/* فورم الإضافة والتعديل المتخصص */}
      <form onSubmit={handleSave} className="bg-white p-5 rounded-3xl border shadow-sm space-y-4 font-bold">
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

        {/* اختيار النوع + إشارة التخصص */}
        <div className="grid md:grid-cols-12 gap-3 items-end bg-[#fbfaf7] p-3.5 rounded-2xl border">
          <div className="md:col-span-7">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-gray-700">نوع المحتوى / القسم *</label>
              <button
                type="button"
                onClick={() => setCreatingCat(!creatingCat)}
                className="text-[11px] text-[#7a1c24] underline cursor-pointer"
              >
                {creatingCat ? 'إلغاء' : '+ إنشاء قسم جديد'}
              </button>
            </div>
            {creatingCat ? (
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  placeholder="اكتب اسم القسم الجديد..."
                  className="flex-1 p-2.5 border rounded-xl text-xs bg-white"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  className="px-4 bg-[#7a1c24] text-white rounded-xl text-xs cursor-pointer shrink-0"
                >
                  حفظ القسم
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

          <div className="md:col-span-3">
            <span className="text-[11px] text-gray-500 block mb-1">تخصص هذا البند</span>
            <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl text-xs truncate">
              {currentSpec.domain}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-gray-700 mb-1">ترتيب العرض</label>
            <input
              type="number"
              className="w-full p-2.5 border rounded-xl bg-white"
              value={form.sort_order}
              onChange={e => setForm({ ...form, sort_order: e.target.value })}
            />
          </div>
        </div>

        {/* العنوان + المكان */}
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-700 mb-1">{currentSpec.titleLabel}</label>
            <input
              required
              placeholder={currentSpec.titlePlaceholder}
              className="w-full p-2.5 border rounded-xl"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-700 mb-1">{currentSpec.locationLabel}</label>
            <input
              placeholder={currentSpec.locationPlaceholder}
              className="w-full p-2.5 border rounded-xl"
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
            />
          </div>
        </div>

        {/* قسم المواعيد والتواريخ المخصص */}
        <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/80 space-y-2">
          <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
            <Calendar size={14} /> الميعاد والتوقيت المخصص
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-gray-600 mb-1">{currentSpec.dateLabel}</label>
              <input
                type="date"
                className="w-full p-2.5 border rounded-xl bg-white"
                value={form.event_date}
                onChange={e => setForm({ ...form, event_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-1 flex items-center gap-1">
                <Clock size={12} /> {currentSpec.timeLabel}
              </label>
              <input
                placeholder={currentSpec.timePlaceholder}
                className="w-full p-2.5 border rounded-xl bg-white"
                value={form.event_time}
                onChange={e => setForm({ ...form, event_time: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* قسم الروابط والوسائط (URL / فيسبوك / يوتيوب / بث مباشر / رفع ملف) */}
        <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200 space-y-2.5">
          <label className="text-xs text-indigo-950 flex items-center gap-1.5">
            <Link2 size={14} /> {currentSpec.urlLabel}
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            {canUploadFile && (
              <label
                className={`px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  uploading ? 'bg-gray-300 text-gray-600' : 'bg-indigo-700 hover:bg-indigo-800 text-white'
                }`}
              >
                <Upload size={14} /> {uploading ? 'جاري الرفع...' : 'رفع من الجهاز'}
                <input
                  type="file"
                  accept={currentSpec.acceptMedia}
                  className="hidden"
                  disabled={uploading}
                  onChange={handleUpload}
                />
              </label>
            )}
            <input
              placeholder={currentSpec.urlPlaceholder}
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

          {ytEmbedUrl && (
            <div className="aspect-video max-w-sm rounded-xl overflow-hidden border bg-black">
              <iframe src={ytEmbedUrl} title="معاينة البث / الفيديو" className="w-full h-full" allowFullScreen />
            </div>
          )}
        </div>

        {/* التفاصيل / الوصف / السيرة */}
        <div>
          <label className="block text-xs text-gray-700 mb-1">{currentSpec.bodyLabel}</label>
          <textarea
            rows="3"
            placeholder={currentSpec.bodyPlaceholder}
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
            {editingId ? (
              <><Check size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ التعديل'}</>
            ) : (
              <><Plus size={16} /> {saving ? 'جاري الإضافة...' : 'إضافة وحفظ في الداتابيز'}</>
            )}
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

      {/* إدارة الأقسام المخصصة */}
      {customCategories.length > 0 && (
        <div className="bg-white p-4 rounded-3xl border shadow-sm space-y-2">
          <h3 className="text-xs font-black text-[#7a1c24] flex items-center gap-1.5">
            <Layers size={15} /> الأقسام المخصصة ({customCategories.length})
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

      {/* شريط الفلترة */}
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

      {/* قائمة البنود */}
      {loading ? (
        <div className="bg-white p-6 rounded-2xl border text-center text-xs text-gray-500">جاري تحميل المحتوى من الداتابيز...</div>
      ) : displayedItems.length === 0 ? (
        <div className="bg-white p-6 rounded-2xl border text-center text-xs text-gray-500">لا توجد بنود مضافة في هذا القسم حالياً.</div>
      ) : (
        <div className="grid gap-2.5">
          {displayedItems.map(it => {
            const spec = getSpecForKind(it.kind, customCategories);
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
                        {spec.label}
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
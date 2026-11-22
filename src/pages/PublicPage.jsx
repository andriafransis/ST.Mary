import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { uploadChurchMedia } from '../lib/mediaUpload';
import {
  Church, Radio, Calendar, MapPin, Bus, Layers,
  LogIn, UserPlus, X, ExternalLink, Newspaper, CheckCircle2,
  ArrowRight, Video, Sparkles, Plus, Trash2, Edit3, Settings, Image as ImageIcon, Upload,
  ArrowUp, ArrowDown, Eye, EyeOff
} from 'lucide-react';

const DEFAULT_CHURCH_NAME = 'كنيسة السيدة العذراء مريم بالمطرية';

const REGISTER_ROLES = [
  { value: 'member', label: '👤 مخدوم (بفصل / مرحلة)' },
  { value: 'parish', label: '🙏 شعب (رعية)' },
  { value: 'parent', label: '👨‍👩‍👦 ولي أمر فقط' },
  { value: 'servant', label: '📖 خادم مرحلة' },
  { value: 'meeting_servant', label: '🎤 خادم اجتماع' },
  { value: 'mercy_servant', label: '🤝 خادم إخوة رب' },
  { value: 'worker', label: '🛠️ عامل / فراش الكنيسة' }
];

const STAGE_OPTIONS = [
  'حضانة', 'أولى ابتدائي', 'ثانية ابتدائي', 'ثالثة ابتدائي', 'رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي',
  'أولى إعدادي', 'ثانية إعدادي', 'ثالثة إعدادي',
  'أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي',
  'جامعة وخريجين', 'خريجين وعاملين', 'اجتماع الشباب', 'اجتماع الأسرة', 'اجتماع عام'
];

const DEFAULT_SECTIONS = [
  { key: 'summary', defaultTitle: 'ملخص الأرقام السريع', sort_order: 1 },
  { key: 'media', defaultTitle: 'معرض الصور والفيديوهات', sort_order: 2 },
  { key: 'news', defaultTitle: 'أخبار وأحداث الكنيسة', sort_order: 3 },
  { key: 'masses_trips', defaultTitle: 'مواعيد القداسات ومكتب الرحلات', sort_order: 4 },
  { key: 'priest_bio', defaultTitle: 'آباء الكنيسة', sort_order: 5 },
  { key: 'history', defaultTitle: 'تاريخ الكنيسة', sort_order: 6 }
];

function toEmbedUrl(rawUrl = '') {
  const u = rawUrl.trim();
  if (!u) return '';
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(u)) return `https://www.youtube.com/embed/live_stream?channel=${u}`;
  const ch = u.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]+)/);
  if (ch && ch[1]) return `https://www.youtube.com/embed/live_stream?channel=${ch[1]}`;
  const m = u.match(/(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (m && m[1]) return `https://www.youtube.com/embed/${m[1]}?rel=0`;
  return '';
}

function isDirectVideo(rawUrl = '') {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(rawUrl.trim());
}

function isImageUrl(rawUrl = '') {
  return /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(rawUrl.trim());
}

export default function PublicPage({
  isLoggedIn = false,
  canEdit = false,
  churchName = DEFAULT_CHURCH_NAME,
  onOpenLogin,
  onOpenEditor,
  onBackToApp,
  onOpenEdu,
  onOpenJoseph
}) {
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [masses, setMasses] = useState([]);
  const [publicTrips, setPublicTrips] = useState([]);
  const [priestPublicTrips, setPriestPublicTrips] = useState([]);
  const [marySettingsUrl, setMarySettingsUrl] = useState('');
  const [loading, setLoading] = useState(true);

  const emptyEdit = {
    kind: 'news',
    title: '',
    body: '',
    time_text: '',
    location: '',
    url: '',
    sort_order: 0
  };

  const [showContentModal, setShowContentModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [contentForm, setContentForm] = useState(emptyEdit);
  const [savingContent, setSavingContent] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [editEventModal, setEditEventModal] = useState(null);
  const [editMassModal, setEditMassModal] = useState(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');

  const [showSectionsModal, setShowSectionsModal] = useState(false);
  const [sectionEdits, setSectionEdits] = useState({});

  const [showRegister, setShowRegister] = useState(false);
  const [regStatus, setRegStatus] = useState({ type: '', msg: '' });
  const [submitting, setSubmitting] = useState(false);

  const emptyReg = {
    first_name: '',
    second_name: '',
    third_name: '',
    fourth_name: '',
    username: '',
    password: '',
    phone: '',
    dob: '',
    gender: 'ذكر',
    address: '',
    requested_role: 'member',
    also_parent: false,
    guardian_type: 'father',
    detailed_stage: 'أولى ثانوي',
    job_title: '',
    is_studying: true,
    is_deacon: false,
    deacon_rank: ''
  };

  const [regForm, setRegForm] = useState(emptyReg);
  const [childrenList, setChildrenList] = useState([]);
  const [tempChild, setTempChild] = useState({
    child_name: '',
    dob: '',
    gender: 'ذكر',
    stage: 'أولى ابتدائي',
    study_details: '',
    phone: ''
  });

  const loadPublic = async () => {
    setLoading(true);
    try {
      const [pc, ev, ms, tr, pps, st] = await Promise.all([
        supabase
          .from('church_public_content')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false }),
        supabase
          .from('church_events')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('priest_masses')
          .select('*')
          .eq('is_available', true)
          .order('mass_date', { ascending: true }),
        supabase
          .from('church_trips')
          .select('*')
          .eq('is_public', true)
          .order('trip_date', { ascending: true }),
        supabase
          .from('priest_personal_schedule')
          .select('*')
          .eq('is_public', true)
          .order('event_date', { ascending: true }),
        supabase
          .from('church_settings')
          .select('virgin_mary_image_url')
          .limit(1)
          .maybeSingle()
      ]);
      if (pc.data) setItems(pc.data);
      if (ev.data) setEvents(ev.data);
      if (ms.data) setMasses(ms.data);
      if (tr.data) setPublicTrips(tr.data);
      if (pps.data) {
        setPriestPublicTrips(
          pps.data.filter(x => x.event_type === 'رحلة كنسية 🚌' || x.event_type === 'مؤتمر روحي 🏕️')
        );
      }
      if (st.data?.virgin_mary_image_url) setMarySettingsUrl(st.data.virgin_mary_image_url);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublic();
  }, []);

  const themeRow = items.find(i => i.kind === 'theme_config');
  let theme = {
    headerBg: 'from-[#5c1319] via-[#7a1c24] to-[#32060a]',
    pageBg: '#f6f4ef',
    show_ticker: true,
    show_mary: true,
    show_edu_btn: true,
    show_joseph_btn: true,
    sticky_header: true
  };
  if (themeRow?.body) {
    try {
      theme = { ...theme, ...JSON.parse(themeRow.body) };
    } catch {
      // ignore parse error
    }
  }

  const customCategories = items.filter(i => i.kind === 'category_def');
  const sectionConfigs = items.filter(i => i.kind === 'section_config');

  const getSectionMeta = (key, fallbackTitle, fallbackOrder = 99) => {
    const cfg = sectionConfigs.find(c => c.title === key);
    return {
      key,
      title: cfg?.body || fallbackTitle,
      hidden: cfg?.location === 'hidden',
      sort_order: Number(cfg?.sort_order ?? fallbackOrder),
      cfgRow: cfg || null
    };
  };

  const summaryMeta = getSectionMeta('summary', 'ملخص الأرقام السريع', 1);
  const mediaMeta = getSectionMeta('media', 'معرض الصور والفيديوهات', 2);
  const newsMeta = getSectionMeta('news', 'أخبار وأحداث الكنيسة', 3);
  const massesTripsMeta = getSectionMeta('masses_trips', 'مواعيد القداسات ومكتب الرحلات', 4);
  const massesMeta = getSectionMeta('masses', 'مواعيد القداسات الإلهية', 4);
  const tripsMeta = getSectionMeta('trips', 'مكتب الرحلات العامة', 4);
  const priestBioMeta = getSectionMeta('priest_bio', 'آباء الكنيسة', 5);
  const historyMeta = getSectionMeta('history', 'تاريخ الكنيسة', 6);

  const orderedSections = [summaryMeta, mediaMeta, newsMeta, massesTripsMeta, priestBioMeta, historyMeta]
    .sort((a, b) => a.sort_order - b.sort_order);

  // تحريك الأقسام لأعلى أو لأسفل من قبل الأدمن مباشرة
  const handleMoveSection = async (secKey, direction) => {
    if (!canEdit) return;
    const currentList = [...orderedSections];
    const index = currentList.findIndex(s => s.key === secKey);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const temp = currentList[index];
    currentList[index] = currentList[targetIndex];
    currentList[targetIndex] = temp;

    try {
      for (let i = 0; i < currentList.length; i++) {
        const item = currentList[i];
        const newOrder = i + 1;
        const payload = {
          kind: 'section_config',
          title: item.key,
          body: item.title,
          location: item.hidden ? 'hidden' : 'visible',
          sort_order: newOrder
        };

        if (item.cfgRow?.id) {
          await supabase.from('church_public_content').update(payload).eq('id', item.cfgRow.id);
        } else {
          await supabase.from('church_public_content').insert([payload]);
        }
      }
      await loadPublic();
    } catch (err) {
      alert('حدث خطأ أثناء نقل القسم: ' + err.message);
    }
  };

  // إخفاء أو إظهار القسم بضغطة زر
  const handleToggleSectionVisibility = async (sec) => {
    if (!canEdit) return;
    const nextHidden = !sec.hidden;
    const payload = {
      kind: 'section_config',
      title: sec.key,
      body: sec.title,
      location: nextHidden ? 'hidden' : 'visible',
      sort_order: sec.sort_order
    };
    if (sec.cfgRow?.id) {
      await supabase.from('church_public_content').update(payload).eq('id', sec.cfgRow.id);
    } else {
      await supabase.from('church_public_content').insert([payload]);
    }
    await loadPublic();
  };

  // تغيير اسم القسم / التابة فوراً
  const handleQuickRenameSection = async (sec) => {
    if (!canEdit) return;
    const newName = prompt('اكتب الاسم الجديد لهذا القسم أو التابة:', sec.title);
    if (!newName || !newName.trim()) return;
    const payload = {
      kind: 'section_config',
      title: sec.key,
      body: newName.trim(),
      location: sec.hidden ? 'hidden' : 'visible',
      sort_order: sec.sort_order
    };
    if (sec.cfgRow?.id) {
      await supabase.from('church_public_content').update(payload).eq('id', sec.cfgRow.id);
    } else {
      await supabase.from('church_public_content').insert([payload]);
    }
    await loadPublic();
  };

  const allKindOptions = [
    { value: 'logo', label: '✝ اسم الكنيسة وشعارها (لوجو متحرك)' },
    { value: 'virgin_mary', label: '🕊️ صورة السيدة العذراء مريم (بجانب الترحيب)' },
    { value: 'video', label: '🎬 فيديو ترحيبي / متحرك' },
    { value: 'image', label: '🖼️ صورة / بانر / إعلان مصور' },
    { value: 'livestream', label: '📺 بث مباشر (YouTube / رابط البث)' },
    { value: 'news', label: `📰 ${newsMeta.title}` },
    { value: 'mass', label: `⛪ ${massesMeta.title}` },
    { value: 'trip', label: `🚌 ${tripsMeta.title}` },
    { value: 'priest_bio', label: `✝ ${priestBioMeta.title}` },
    { value: 'history', label: `📜 ${historyMeta.title}` },
    ...customCategories.map(c => ({ value: c.title, label: `✨ ${c.body || c.title}` }))
  ];

  const openAddContentModal = (defaultKind = 'news') => {
    if (!canEdit) return;
    setEditingItemId(null);
    setCreatingCategory(false);
    setNewCategoryLabel('');
    setContentForm({ ...emptyEdit, kind: defaultKind });
    setShowContentModal(true);
  };

  const openEditContentModal = (item) => {
    if (!canEdit) return;
    setEditingItemId(item.id);
    setCreatingCategory(false);
    setNewCategoryLabel('');
    setContentForm({
      kind: item.kind || 'news',
      title: item.title || '',
      body: item.body || '',
      time_text: item.time_text || '',
      location: item.location || '',
      url: item.url || '',
      sort_order: item.sort_order || 0
    });
    setShowContentModal(true);
  };

  const handleCreateCustomCategory = async () => {
    const label = newCategoryLabel.trim();
    if (!label) return alert('اكتب اسم القسم أو نوع المحتوى الجديد أولاً');
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

    if (error) return alert('تعذر إنشاء القسم: ' + error.message);
    if (data) {
      setItems([data, ...items]);
      setContentForm(prev => ({ ...prev, kind: key }));
      setNewCategoryLabel('');
      setCreatingCategory(false);
    }
  };

  const handleRenameCustomCategory = async (cat) => {
    const nextName = prompt('اكتب الاسم الجديد للقسم:', cat.body || cat.title);
    if (!nextName || !nextName.trim()) return;
    const { data, error } = await supabase
      .from('church_public_content')
      .update({ body: nextName.trim() })
      .eq('id', cat.id)
      .select()
      .single();

    if (!error && data) {
      setItems(items.map(i => (i.id === cat.id ? data : i)));
    }
  };

  const handleDeleteCustomCategory = async (cat) => {
    if (!confirm(`حذف قسم "${cat.body}" وكل البنود اللي جواه؟`)) return;
    await supabase.from('church_public_content').delete().eq('kind', cat.title);
    await supabase.from('church_public_content').delete().eq('id', cat.id);
    setItems(items.filter(i => i.id !== cat.id && i.kind !== cat.title));
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    try {
      const url = await uploadChurchMedia(file, contentForm.kind || 'public');
      setContentForm(prev => ({ ...prev, url }));
    } catch (err) {
      alert('تعذر رفع الملف: ' + err.message);
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
  };

  const handleSaveContent = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSavingContent(true);
    try {
      const payload = {
        kind: contentForm.kind,
        title: contentForm.title.trim(),
        body: contentForm.body || '',
        time_text: contentForm.time_text || '',
        location: contentForm.location || '',
        url: contentForm.url || '',
        sort_order: Number(contentForm.sort_order || 0)
      };

      if (editingItemId) {
        const { data, error } = await supabase
          .from('church_public_content')
          .update(payload)
          .eq('id', editingItemId)
          .select()
          .single();
        if (error) return alert('خطأ: ' + error.message);
        setItems(items.map(i => (i.id === editingItemId ? data : i)));
      } else {
        const { data, error } = await supabase
          .from('church_public_content')
          .insert([payload])
          .select()
          .single();
        if (error) return alert('خطأ: ' + error.message);
        setItems([data, ...items]);
      }

      if (payload.kind === 'virgin_mary' && payload.url) {
        setMarySettingsUrl(payload.url);
      }

      setShowContentModal(false);
      setEditingItemId(null);
    } finally {
      setSavingContent(false);
    }
  };

  const handleDeleteContent = async (id) => {
    if (!canEdit || !confirm('حذف هذا البند من صفحة الكنيسة؟')) return;
    const { error } = await supabase.from('church_public_content').delete().eq('id', id);
    if (!error) setItems(items.filter(i => i.id !== id));
  };

  const handleSaveEditedEvent = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    const { id, created_at, ...clean } = editEventModal;
    const { data, error } = await supabase
      .from('church_events')
      .update(clean)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      setEvents(events.map(ev => (ev.id === id ? data : ev)));
      setEditEventModal(null);
    } else if (error) {
      alert(error.message);
    }
  };

  const handleDeleteEventRow = async (id) => {
    if (!canEdit || !confirm('حذف هذا الحدث من الداتابيز؟')) return;
    const { error } = await supabase.from('church_events').delete().eq('id', id);
    if (!error) setEvents(events.filter(ev => ev.id !== id));
  };

  const handleSaveEditedMass = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    const { id, created_at, priest_id, ...clean } = editMassModal;
    const { data, error } = await supabase
      .from('priest_masses')
      .update(clean)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      setMasses(masses.map(m => (m.id === id ? data : m)));
      setEditMassModal(null);
    } else if (error) {
      alert(error.message);
    }
  };

  const handleDeleteMassRow = async (id) => {
    if (!canEdit || !confirm('حذف هذا القداس من الداتابيز؟')) return;
    const { error } = await supabase.from('priest_masses').delete().eq('id', id);
    if (!error) setMasses(masses.filter(m => m.id !== id));
  };

  const openSectionsCustomizer = () => {
    if (!canEdit) return;
    const init = {};
    DEFAULT_SECTIONS.forEach(s => {
      const meta = getSectionMeta(s.key, s.defaultTitle, s.sort_order);
      init[s.key] = {
        title: meta.title,
        hidden: meta.hidden,
        sort_order: meta.sort_order,
        id: meta.cfgRow?.id || null
      };
    });
    setSectionEdits(init);
    setShowSectionsModal(true);
  };

  const handleSaveSections = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSavingContent(true);
    try {
      for (const s of DEFAULT_SECTIONS) {
        const edit = sectionEdits[s.key];
        const payload = {
          kind: 'section_config',
          title: s.key,
          body: (edit?.title || s.defaultTitle).trim(),
          location: edit?.hidden ? 'hidden' : 'visible',
          sort_order: Number(edit?.sort_order || s.sort_order)
        };
        if (edit?.id) {
          await supabase.from('church_public_content').update(payload).eq('id', edit.id);
        } else {
          await supabase.from('church_public_content').insert([payload]);
        }
      }
      await loadPublic();
      setShowSectionsModal(false);
    } finally {
      setSavingContent(false);
    }
  };

  const logoConfig = items.find(i => i.kind === 'logo');
  const maryConfig = items.find(i => i.kind === 'virgin_mary');
  const activeMaryUrl = maryConfig?.url || marySettingsUrl || '';
  const activeChurchTitle = logoConfig?.title || churchName || DEFAULT_CHURCH_NAME;
  const activeChurchSubtitle = logoConfig?.body || 'مواعيد القداسات، مكتب الرحلات العامة، أخبار الكنيسة، والآباء الكهنة';

  const videos = items.filter(i => i.kind === 'video');
  const images = items.filter(i => i.kind === 'image');
  const livestreams = items.filter(i => i.kind === 'livestream');
  const histories = items.filter(i => i.kind === 'history');
  const priestBios = items.filter(i => i.kind === 'priest_bio');
  const publicMasses = items.filter(i => i.kind === 'mass');
  const tripContents = items.filter(i => i.kind === 'trip');
  const newsList = items.filter(i => i.kind === 'news');

  const featuredVideo = videos[0] || null;
  const featuredLive = livestreams[0] || null;

  const tickerText = [
    ...newsList.map(n => `📰 ${n.title}${n.time_text ? ` (${n.time_text})` : ''}`),
    ...events.map(e => `✨ ${e.title}${e.event_time ? ` — ${e.event_time}` : ''}`)
  ].join('   •   ');

  const handleAddChildRow = () => {
    if (!tempChild.child_name.trim()) return alert('اكتب اسم الابن/الابنة أولاً');
    setChildrenList([...childrenList, { ...tempChild, child_name: tempChild.child_name.trim() }]);
    setTempChild({ child_name: '', dob: '', gender: 'ذكر', stage: 'أولى ابتدائي', study_details: '', phone: '' });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegStatus({ type: '', msg: '' });

    const full_name = [
      regForm.first_name,
      regForm.second_name,
      regForm.third_name,
      regForm.fourth_name
    ].map(s => s.trim()).filter(Boolean).join(' ');

    if (!regForm.first_name.trim() || !regForm.second_name.trim() || !regForm.third_name.trim() || !regForm.fourth_name.trim()) {
      return setRegStatus({ type: 'error', msg: 'يرجى إدخال الاسم الرباعي بالكامل.' });
    }
    const cleanUser = regForm.username.trim().toLowerCase().replace(/\s+/g, '');
    if (cleanUser.length < 3 || cleanUser === 'admin') {
      return setRegStatus({ type: 'error', msg: 'يرجى اختيار اسم مستخدم مناسب (3 أحرف على الأقل).' });
    }
    if (regForm.password.length < 3) {
      return setRegStatus({ type: 'error', msg: 'كلمة المرور يجب أن تكون 3 أحرف على الأقل.' });
    }

    setSubmitting(true);
    try {
      const dbRole = regForm.requested_role === 'parish' ? 'member' : regForm.requested_role;
      const isAlsoParent = regForm.requested_role === 'parent' || Boolean(regForm.also_parent);
      const extraScreens = isAlsoParent && dbRole !== 'parent' ? ['parent_panel'] : [];
      const effectiveChildren = tempChild.child_name.trim()
        ? [...childrenList, { ...tempChild, child_name: tempChild.child_name.trim() }]
        : childrenList;
      const childrenSummary = effectiveChildren.map(c => `${c.child_name} (${c.study_details || c.stage})`).join('، ');
      const userGender = regForm.gender === 'أنثى' ? 'أنثى' : 'ذكر';
      const resolvedGuardianType = isAlsoParent
        ? (regForm.guardian_type === 'mother' || userGender === 'أنثى' ? 'mother' : 'father')
        : '';

      const { data: savedUser, error } = await supabase.from('church_users').insert([{
        username: cleanUser,
        password: regForm.password,
        full_name,
        first_name: regForm.first_name.trim(),
        second_name: regForm.second_name.trim(),
        third_name: regForm.third_name.trim(),
        fourth_name: regForm.fourth_name.trim(),
        gender: userGender,
        guardian_type: resolvedGuardianType,
        family_role: resolvedGuardianType === 'mother' ? 'الأم' : resolvedGuardianType === 'father' ? 'الأب' : 'ابن/ابنة',
        role: dbRole,
        requested_role: dbRole,
        status: 'pending',
        sector: regForm.requested_role === 'parish' ? 'شعب (رعية)' : '',
        phone: regForm.phone.trim(),
        dob: regForm.dob || null,
        address: regForm.address.trim(),
        detailed_stage: regForm.requested_role === 'parish' ? 'شعب عام' : regForm.detailed_stage,
        service_stage: regForm.requested_role === 'parish' ? 'شعب عام' : regForm.detailed_stage,
        job_title: regForm.job_title || '',
        is_studying: Boolean(regForm.is_studying),
        children_names: childrenSummary,
        is_deacon: Boolean(regForm.is_deacon),
        deacon_rank: regForm.deacon_rank || '',
        permissions: {
          extra_screens: extraScreens,
          view_parent_panel: isAlsoParent,
          also_parent: isAlsoParent,
          ...(resolvedGuardianType ? { guardian_type: resolvedGuardianType } : {})
        }
      }]).select().single();

      if (error) {
        return setRegStatus({
          type: 'error',
          msg: error.code === '23505' ? 'اسم المستخدم مستخدم بالفعل، اختر اسماً آخر.' : 'حدث خطأ: ' + error.message
        });
      }

      if (isAlsoParent && savedUser && effectiveChildren.length > 0) {
        const isMother = resolvedGuardianType === 'mother';
        const childPayloads = effectiveChildren.map((c, idx) => ({
          username: `${cleanUser}_c${idx + 1}_${Date.now().toString().slice(-4)}`,
          password: regForm.password,
          full_name: c.child_name.includes(' ') ? c.child_name : `${c.child_name} ${full_name}`,
          first_name: c.child_name.split(' ')[0] || c.child_name,
          gender: c.gender === 'أنثى' ? 'أنثى' : 'ذكر',
          role: 'member',
          requested_role: 'member',
          status: 'pending',
          parent_id: savedUser.id,
          ...(isMother
            ? { mother_id: savedUser.id, mother_full_name: full_name, mother_phone: regForm.phone.trim() }
            : { father_id: savedUser.id, father_full_name: full_name, father_phone: regForm.phone.trim() }),
          dob: c.dob || null,
          detailed_stage: c.study_details || c.stage || 'أولى ابتدائي',
          service_stage: c.stage || 'أولى ابتدائي',
          phone: c.phone || '',
          address: regForm.address.trim(),
          is_studying: true,
          permissions: {}
        }));
        const { error: childrenErr } = await supabase.from('church_users').insert(childPayloads);
        if (childrenErr) {
          return setRegStatus({
            type: 'error',
            msg: 'تم حفظ ولي الأمر ولكن تعذر حفظ الأبناء: ' + childrenErr.message
          });
        }
      }

      setRegStatus({
        type: 'success',
        msg: `تم إرسال طلب تسجيلك بنجاح ✅${effectiveChildren.length > 0 ? ` (مع ${effectiveChildren.length} من الأبناء)` : ''}! سيقوم أدمن الكنيسة بمراجعة بياناتك وقبول انضمامك.`
      });
      setRegForm(emptyReg);
      setChildrenList([]);
      setTempChild({ child_name: '', dob: '', gender: 'ذكر', stage: 'أولى ابتدائي', study_details: '', phone: '' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderCardActions = (item) => {
    if (!canEdit) return null;
    return (
      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={() => openEditContentModal(item)}
          className="p-1.5 bg-gray-100 hover:bg-amber-100 text-gray-700 rounded-lg cursor-pointer"
          title="تعديل"
        >
          <Edit3 size={13} />
        </button>
        <button
          type="button"
          onClick={() => handleDeleteContent(item.id)}
          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg cursor-pointer"
          title="حذف"
        >
          <Trash2 size={13} />
        </button>
      </div>
    );
  };

  const renderSectionHeaderControls = (sec) => {
    if (!canEdit) return null;
    return (
      <div className="flex items-center gap-1.5 bg-amber-50/95 border border-amber-300 px-3 py-1.5 rounded-2xl text-[11px] font-bold text-amber-950 mb-3 flex-wrap shadow-2xs">
        <span className="text-gray-500 font-normal">تحكم بالأدمن:</span>
        <button
          type="button"
          onClick={() => handleMoveSection(sec.key, 'up')}
          className="px-2 py-1 hover:bg-amber-200 rounded-lg cursor-pointer flex items-center gap-0.5"
          title="نقل القسم لأعلى"
        >
          <ArrowUp size={13} /> لأعلى
        </button>
        <button
          type="button"
          onClick={() => handleMoveSection(sec.key, 'down')}
          className="px-2 py-1 hover:bg-amber-200 rounded-lg cursor-pointer flex items-center gap-0.5"
          title="نقل القسم لأسفل"
        >
          <ArrowDown size={13} /> لأسفل
        </button>
        <button
          type="button"
          onClick={() => handleQuickRenameSection(sec)}
          className="px-2 py-1 hover:bg-amber-200 rounded-lg cursor-pointer flex items-center gap-0.5"
          title="تغيير اسم القسم"
        >
          <Edit3 size={13} /> تعديل الاسم
        </button>
        <button
          type="button"
          onClick={() => handleToggleSectionVisibility(sec)}
          className="px-2 py-1 hover:bg-amber-200 rounded-lg cursor-pointer flex items-center gap-0.5 text-red-700"
          title="إخفاء / إظهار"
        >
          {sec.hidden ? <><Eye size={13} /> إظهار القسم</> : <><EyeOff size={13} /> إخفاء القسم</>}
        </button>
      </div>
    );
  };

  const showParentChildrenBox = regForm.requested_role === 'parent' || regForm.also_parent;

  // قائمة أزرار الأقسام والخدمات لتنسيقها في Grid متساوي ومتناسق
  const navButtons = [
    !newsMeta.hidden && {
      key: 'nav_news',
      href: '#sec-news',
      label: `📰 ${newsMeta.title}`,
      className: 'bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold'
    },
    !massesMeta.hidden && {
      key: 'nav_masses',
      href: '#sec-masses',
      label: `⛪ ${massesMeta.title}`,
      className: 'bg-amber-400 hover:bg-amber-300 text-[#4a0e13] font-black shadow'
    },
    !tripsMeta.hidden && {
      key: 'nav_trips',
      href: '#sec-trips',
      label: `🚌 ${tripsMeta.title}`,
      className: 'bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold'
    },
    !priestBioMeta.hidden && {
      key: 'nav_priests',
      href: '#sec-priests',
      label: `✝ ${priestBioMeta.title}`,
      className: 'bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold'
    },
    !historyMeta.hidden && {
      key: 'nav_history',
      href: '#sec-history',
      label: `📜 ${historyMeta.title}`,
      className: 'bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold'
    },
    onOpenEdu && theme.show_edu_btn !== false && {
      key: 'nav_edu',
      onClick: onOpenEdu,
      label: '🎓 المركز التعليمي',
      className: 'bg-indigo-600 hover:bg-indigo-700 border border-indigo-300/40 text-white font-black shadow'
    },
    onOpenJoseph && theme.show_joseph_btn !== false && {
      key: 'nav_joseph',
      onClick: onOpenJoseph,
      label: '🕊️ خدمة يوسف الرامي',
      className: 'bg-slate-900/85 hover:bg-slate-900 border border-white/30 text-white font-black shadow'
    }
  ].filter(Boolean);

  const renderDynamicSection = (sec) => {
    if (sec.hidden && !canEdit) return null;

    if (sec.key === 'summary') {
      return (
        <div key="summary" className="space-y-1">
          {renderSectionHeaderControls(sec)}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {!massesMeta.hidden && (
              <a href="#sec-masses" className="bg-white p-4 rounded-2xl border shadow-2xs hover:border-[#7a1c24] transition">
                <span className="text-xs text-gray-500 block">⛪ {massesMeta.title}</span>
                <strong className="text-lg font-black text-[#7a1c24]">{publicMasses.length + masses.length} قداس</strong>
              </a>
            )}
            {!tripsMeta.hidden && (
              <a href="#sec-trips" className="bg-white p-4 rounded-2xl border shadow-2xs hover:border-[#7a1c24] transition">
                <span className="text-xs text-gray-500 block">🚌 {tripsMeta.title}</span>
                <strong className="text-lg font-black text-[#7a1c24]">{tripContents.length + publicTrips.length + priestPublicTrips.length} رحلة</strong>
              </a>
            )}
            {!newsMeta.hidden && (
              <a href="#sec-news" className="bg-white p-4 rounded-2xl border shadow-2xs hover:border-[#7a1c24] transition">
                <span className="text-xs text-gray-500 block">📰 {newsMeta.title}</span>
                <strong className="text-lg font-black text-[#7a1c24]">{newsList.length + events.length} حدث</strong>
              </a>
            )}
            {!priestBioMeta.hidden && (
              <a href="#sec-priests" className="bg-white p-4 rounded-2xl border shadow-2xs hover:border-[#7a1c24] transition">
                <span className="text-xs text-gray-500 block">✝ {priestBioMeta.title}</span>
                <strong className="text-sm font-black text-[#7a1c24] block mt-1">{loading ? 'جاري التحميل...' : `${priestBios.length} أب كاهن`}</strong>
              </a>
            )}
          </div>
        </div>
      );
    }

    if (sec.key === 'media') {
      if (!canEdit && !(images.length > 0 || videos.length > 1 || livestreams.length > 1 || (featuredLive && featuredVideo))) return null;
      return (
        <section key="media" className="space-y-3">
          {renderSectionHeaderControls(sec)}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-black text-[#7a1c24] flex items-center gap-2"><ImageIcon size={20} /> {sec.title}</h2>
            {canEdit && (
              <button type="button" onClick={() => openAddContentModal('image')} className="px-3 py-1.5 bg-white border rounded-xl text-xs font-bold text-[#7a1c24] cursor-pointer">
                + رفع صورة / فيديو من الجهاز
              </button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map(img => (
              <div key={img.id} className="bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col">
                {img.url && <img src={img.url} alt={img.title} className="w-full h-52 object-cover" />}
                <div className="p-4 flex justify-between items-start gap-2">
                  <div>
                    <strong className="text-sm text-[#7a1c24] block">{img.title}</strong>
                    {img.body && <p className="text-xs text-gray-600 mt-1">{img.body}</p>}
                  </div>
                  {renderCardActions(img)}
                </div>
              </div>
            ))}
            {videos.slice(featuredLive ? 0 : 1).map(v => {
              const embed = toEmbedUrl(v.url);
              const directVid = isDirectVideo(v.url);
              return (
                <div key={v.id} className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                  {embed ? (
                    <div className="aspect-video bg-black">
                      <iframe src={embed} title={v.title} className="w-full h-full" allowFullScreen />
                    </div>
                  ) : directVid ? (
                    <video src={v.url} controls className="w-full aspect-video bg-black object-cover" />
                  ) : null}
                  <div className="p-4 flex justify-between items-start gap-2">
                    <div>
                      <strong className="text-sm text-[#7a1c24] block">{v.title}</strong>
                      {v.body && <p className="text-xs text-gray-600 mt-1">{v.body}</p>}
                    </div>
                    {renderCardActions(v)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    if (sec.key === 'news') {
      return (
        <section key="news" id="sec-news" className="bg-white rounded-3xl p-5 md:p-6 border shadow-sm space-y-4">
          {renderSectionHeaderControls(sec)}
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-base md:text-lg font-black text-[#7a1c24] flex items-center gap-2"><Newspaper size={20} /> {sec.title}</h2>
            {canEdit && (
              <button type="button" onClick={() => openAddContentModal('news')} className="px-3 py-1.5 bg-[#f9ecee] text-[#7a1c24] rounded-xl text-xs font-black cursor-pointer">+ إضافة خبر / إعلان</button>
            )}
          </div>
          {newsList.length === 0 && events.length === 0 ? (
            <p className="text-xs text-gray-500">لا توجد أخبار منشورة حالياً.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {newsList.map(n => (
                <div key={n.id} className="p-4 bg-[#fbfaf7] border rounded-2xl space-y-1.5 hover:border-[#7a1c24]/40 transition">
                  <div className="flex justify-between items-start gap-2">
                    <strong className="text-sm text-[#7a1c24] block">{n.title}</strong>
                    {renderCardActions(n)}
                  </div>
                  {n.url && isImageUrl(n.url) && <img src={n.url} alt={n.title} className="w-full h-36 object-cover rounded-xl border" />}
                  {n.body && <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{n.body}</p>}
                  <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-gray-500">
                    {n.time_text && <span>📅 {n.time_text}</span>}
                    {n.location && <span>📍 {n.location}</span>}
                  </div>
                </div>
              ))}
              {events.map(ev => (
                <div key={ev.id} className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-bold">{ev.event_type || 'فعالية'}</span>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setEditEventModal({ ...ev })} className="p-1 bg-white rounded-lg cursor-pointer"><Edit3 size={12} /></button>
                        <button type="button" onClick={() => handleDeleteEventRow(ev.id)} className="p-1 bg-red-50 text-red-700 rounded-lg cursor-pointer"><Trash2 size={12} /></button>
                      </div>
                    )}
                  </div>
                  <strong className="text-sm text-gray-900 block mt-1">{ev.title}</strong>
                  <p className="text-xs text-gray-600">⏰ {ev.event_time} {ev.place && `• 📍 ${ev.place}`}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      );
    }

    if (sec.key === 'masses_trips') {
      return (
        <div key="masses_trips" className="space-y-2">
          {renderSectionHeaderControls(sec)}
          <div className={`grid gap-5 ${!massesMeta.hidden && !tripsMeta.hidden ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            {!massesMeta.hidden && (
              <section id="sec-masses" className="bg-white rounded-3xl p-5 md:p-6 border shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b pb-2.5">
                  <h2 className="text-base font-black text-[#7a1c24] flex items-center gap-2"><Church size={19} /> {massesMeta.title}</h2>
                  {canEdit && <button type="button" onClick={() => openAddContentModal('mass')} className="px-2.5 py-1 bg-[#f9ecee] text-[#7a1c24] rounded-lg text-[11px] font-black cursor-pointer">+ قداس</button>}
                </div>
                {publicMasses.length === 0 && masses.length === 0 ? (
                  <p className="text-xs text-gray-500">لم تُضف مواعيد قداسات عامة بعد.</p>
                ) : (
                  <div className="space-y-2">
                    {publicMasses.map(m => (
                      <div key={m.id} className="p-3 bg-[#fbfaf7] rounded-2xl border flex justify-between items-center gap-2 text-xs">
                        <div>
                          <strong className="text-sm text-gray-900 block">{m.title}</strong>
                          {m.body && <span className="text-gray-600 block">{m.body}</span>}
                          {m.location && <span className="text-gray-500 flex items-center gap-1 mt-0.5"><MapPin size={12} /> {m.location}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {m.time_text && <span className="px-2.5 py-1 bg-[#f9ecee] text-[#7a1c24] rounded-xl font-black">{m.time_text}</span>}
                          {renderCardActions(m)}
                        </div>
                      </div>
                    ))}
                    {masses.map(m => (
                      <div key={m.id} className="p-3 bg-blue-50/40 rounded-2xl border border-blue-100 flex justify-between items-center gap-2 text-xs">
                        <div>
                          <strong className="text-sm text-gray-900 block">{m.mass_name}</strong>
                          <span className="text-gray-600">📍 {m.church_name} • {m.target_audience}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-900 rounded-xl font-bold">{m.mass_date} ({m.mass_time})</span>
                          {canEdit && (
                            <>
                              <button type="button" onClick={() => setEditMassModal({ ...m })} className="p-1.5 bg-white rounded-lg cursor-pointer"><Edit3 size={13} /></button>
                              <button type="button" onClick={() => handleDeleteMassRow(m.id)} className="p-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer"><Trash2 size={13} /></button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {!tripsMeta.hidden && (
              <section id="sec-trips" className="bg-white rounded-3xl p-5 md:p-6 border shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b pb-2.5">
                  <h2 className="text-base font-black text-[#7a1c24] flex items-center gap-2"><Bus size={19} /> {tripsMeta.title}</h2>
                  {canEdit && <button type="button" onClick={() => openAddContentModal('trip')} className="px-2.5 py-1 bg-[#f9ecee] text-[#7a1c24] rounded-lg text-[11px] font-black cursor-pointer">+ إعلان رحلة</button>}
                </div>
                {tripContents.length === 0 && publicTrips.length === 0 && priestPublicTrips.length === 0 ? (
                  <p className="text-xs text-gray-500">لا توجد رحلات عامة معلنة حالياً.</p>
                ) : (
                  <div className="space-y-2">
                    {publicTrips.map(tr => {
                      const isOvernight = Number(tr.days_count || 1) > 1 || (Array.isArray(tr.rooms) && tr.rooms.length > 0);
                      return (
                        <div key={tr.id} className="p-3.5 bg-purple-50/40 rounded-2xl border border-purple-200 space-y-1.5 text-xs">
                          <div className="flex justify-between items-start gap-2">
                            <div className="space-y-0.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded text-[10px] font-bold">🚌 {tr.trip_category || 'مكتب الرحلات'}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${isOvernight ? 'bg-indigo-100 text-indigo-950' : 'bg-amber-100 text-amber-950'}`}>
                                  {isOvernight ? `🌙 مبيت (${tr.days_count} أيام)` : '☀️ يوم واحد (داي يوز)'}
                                </span>
                                {Number(tr.cost_per_person) > 0 && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded text-[10px] font-black">{tr.cost_per_person} ج.م</span>}
                              </div>
                              <strong className="text-sm text-gray-900 block mt-1">{tr.title}</strong>
                            </div>
                            <span className="px-2.5 py-1 bg-white border rounded-xl font-bold text-[#7a1c24] shrink-0">{tr.trip_date || 'قريباً'}</span>
                          </div>
                          {tr.monasteries && <p className="text-gray-700">⛪ <strong>الزيارات:</strong> {tr.monasteries}</p>}
                          {(tr.gathering_time || tr.departure_time || tr.return_time) && (
                            <p className="text-gray-500">
                              {tr.gathering_time && `⏰ التجمع: ${tr.gathering_time} `}
                              {tr.departure_time && `• التحرك: ${tr.departure_time} `}
                              {tr.return_time && `• العودة: ${tr.return_time}`}
                            </p>
                          )}
                          {tr.daily_program && (
                            <div className="p-2.5 bg-white/80 border border-purple-100 rounded-xl text-gray-700 whitespace-pre-line">
                              <strong className="text-[#7a1c24] block mb-0.5">📋 برنامج الرحلة:</strong>
                              {tr.daily_program}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {priestPublicTrips.map(pt => (
                      <div key={pt.id} className="p-3.5 bg-amber-50/40 rounded-2xl border border-amber-200 space-y-1.5 text-xs">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-950 rounded text-[10px] font-bold">{pt.event_type}</span>
                            {pt.target_service && <span className="mr-1 px-2 py-0.5 bg-blue-100 text-blue-900 rounded text-[10px] font-bold">{pt.target_service}</span>}
                            {Number(pt.trip_cost) > 0 && <span className="mr-1 px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded text-[10px] font-black">{pt.trip_cost} ج.م</span>}
                            <strong className="text-sm text-gray-900 block mt-1">{pt.title}</strong>
                          </div>
                          <span className="px-2.5 py-1 bg-white border rounded-xl font-bold text-[#7a1c24] shrink-0">{pt.event_date || 'قريباً'}</span>
                        </div>
                        {pt.destinations && <p className="text-gray-700">🗺️ {pt.destinations}</p>}
                        {pt.daily_program && <p className="text-gray-600 whitespace-pre-line bg-white/80 p-2 rounded-xl border">{pt.daily_program}</p>}
                      </div>
                    ))}
                    {tripContents.map(tr => (
                      <div key={tr.id} className="p-3 bg-[#fbfaf7] rounded-2xl border flex justify-between items-start gap-2 text-xs">
                        <div className="space-y-0.5">
                          <strong className="text-sm text-[#7a1c24] block">{tr.title}</strong>
                          {tr.body && <p className="text-gray-700 whitespace-pre-line">{tr.body}</p>}
                          {tr.location && <span className="text-gray-500 flex items-center gap-1"><MapPin size={12} /> {tr.location}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {tr.time_text && <span className="px-2.5 py-1 bg-purple-100 text-purple-900 rounded-xl font-black">{tr.time_text}</span>}
                          {renderCardActions(tr)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      );
    }

    if (sec.key === 'priest_bio') {
      return (
        <section key="priest_bio" id="sec-priests" className="bg-white rounded-3xl p-5 md:p-6 border shadow-sm space-y-4">
          {renderSectionHeaderControls(sec)}
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-base md:text-lg font-black text-[#7a1c24]">✝ {sec.title}</h2>
            {canEdit && <button type="button" onClick={() => openAddContentModal('priest_bio')} className="px-3 py-1.5 bg-[#f9ecee] text-[#7a1c24] rounded-xl text-xs font-black cursor-pointer">+ إضافة أب كاهن</button>}
          </div>
          {priestBios.length === 0 ? (
            <p className="text-xs text-gray-500">يمكن للأدمن أو الكاهن إضافة آباء الكنيسة بصورهم وتاريخ سيامتهم وبياناتهم هنا.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {priestBios.map(pb => (
                <div key={pb.id} className="p-4 bg-[#fbfaf7] rounded-3xl border flex flex-col gap-3 shadow-2xs">
                  <div className="flex items-start gap-3">
                    {pb.url ? (
                      <img src={pb.url} alt={pb.title} className="w-20 h-20 rounded-2xl object-cover border-2 border-[#7a1c24]/30 shrink-0 shadow-xs" />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-[#f9ecee] text-[#7a1c24] flex items-center justify-center text-3xl font-black shrink-0 border">✝</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <strong className="text-sm md:text-base text-[#7a1c24] block leading-snug">{pb.title}</strong>
                        {renderCardActions(pb)}
                      </div>
                      {pb.time_text && <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded inline-block mt-1">{pb.time_text}</span>}
                      {pb.location && <span className="text-[11px] text-gray-600 block mt-1">📞 / 📍 {pb.location}</span>}
                    </div>
                  </div>
                  {pb.body && <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line border-t pt-2">{pb.body}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      );
    }

    if (sec.key === 'history') {
      return (
        <section key="history" id="sec-history" className="bg-white rounded-3xl p-5 md:p-6 border shadow-sm space-y-3">
          {renderSectionHeaderControls(sec)}
          <div className="flex justify-between items-center border-b pb-2.5">
            <h2 className="text-base md:text-lg font-black text-[#7a1c24] flex items-center gap-2"><Calendar size={19} /> {sec.title}</h2>
            {canEdit && <button type="button" onClick={() => openAddContentModal('history')} className="px-3 py-1.5 bg-[#f9ecee] text-[#7a1c24] rounded-xl text-xs font-black cursor-pointer">+ إضافة نبذة</button>}
          </div>
          {histories.length === 0 ? (
            <p className="text-xs text-gray-500">يمكن للأب الكاهن أو الأدمن إضافة تاريخ {activeChurchTitle} وسيرة شفيعها وحياة الكنيسة هنا.</p>
          ) : (
            <div className="space-y-3">
              {histories.map(h => (
                <div key={h.id} className="p-4 bg-[#fbfaf7] rounded-2xl border space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <strong className="text-sm md:text-base text-gray-900 block">{h.title}</strong>
                    {renderCardActions(h)}
                  </div>
                  {h.url && <img src={h.url} alt={h.title} className="w-full max-h-72 object-cover rounded-2xl border" />}
                  <p className="text-xs md:text-sm text-gray-700 leading-relaxed whitespace-pre-line">{h.body}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen text-gray-900 flex flex-col" style={{ backgroundColor: theme.pageBg || '#f6f4ef' }} dir="rtl">
      <style>{`
        @keyframes floatLogo {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-4px) scale(1.04); }
        }
        @keyframes marqueeRtl {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-float-logo { animation: floatLogo 3.5s ease-in-out infinite; }
        .animate-ticker { display: inline-block; white-space: nowrap; animation: marqueeRtl 24s linear infinite; }
        .animate-ticker:hover { animation-play-state: paused; }
      `}</style>

      {/* الهيدر الرئيسي الموحد */}
      <header className={`bg-linear-to-br ${theme.headerBg} text-white border-b-4 border-amber-400/70 shadow-xl ${theme.sticky_header !== false ? 'sticky top-0 z-40' : ''}`}>
        <div className="max-w-6xl mx-auto px-4 py-4 md:py-5 space-y-3.5">
          <div className="grid md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-8 space-y-3">
              {/* العنوان + الشعار */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-amber-300/50 flex items-center justify-center overflow-hidden shadow-inner animate-float-logo shrink-0">
                  {logoConfig?.url ? (
                    <img src={logoConfig.url} alt={activeChurchTitle} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-black text-amber-300">✝</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-amber-300/30 text-amber-200 text-[10px] font-bold mb-1">
                    <Sparkles size={11} /> أهلاً بكم في بيت الرب
                  </div>
                  <h1 className="text-lg md:text-2xl font-black text-white leading-tight">{activeChurchTitle}</h1>
                  <p className="text-xs text-white/80">{activeChurchSubtitle}</p>
                </div>
              </div>

              {/* صف أزرار الدخول والتسجيل (شبكة متساوية 2 عمود في الموبايل) */}
              {isLoggedIn ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onBackToApp}
                    className="min-h-11 px-4 py-2 bg-white text-[#7a1c24] hover:bg-amber-50 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow transition"
                  >
                    <ArrowRight size={15} /> العودة لحسابي
                  </button>
                  {canEdit && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openAddContentModal('news')}
                        className="min-h-11 px-2.5 py-2 bg-amber-400 hover:bg-amber-300 text-[#4a0e13] rounded-xl text-xs font-black flex items-center justify-center gap-1 cursor-pointer shadow transition"
                      >
                        <Plus size={14} /> إضافة محتوى
                      </button>
                      <button
                        type="button"
                        onClick={openSectionsCustomizer}
                        className="min-h-11 px-2.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <Settings size={14} /> الأقسام
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setRegStatus({ type: '', msg: '' }); setShowRegister(true); }}
                    className="min-h-11 px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <UserPlus size={15} /> تسجيل حساب جديد
                  </button>
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    className="min-h-11 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-[#4a0e13] rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow transition"
                  >
                    <LogIn size={15} /> تسجيل الدخول
                  </button>
                </div>
              )}

              {isLoggedIn && canEdit && onOpenEditor && (
                <div>
                  <button
                    type="button"
                    onClick={onOpenEditor}
                    className="w-full sm:w-auto px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold cursor-pointer transition"
                  >
                    فتح لوحة التحكم الكاملة
                  </button>
                </div>
              )}

              {/* شبكة متناسقة لأقسام وخدمات الكنيسة (2 عمود في الموبايل و3-4 في الشاشات الأوسع) */}
              {navButtons.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pt-0.5">
                  {navButtons.map((btn, idx) => {
                    const isOddLast = navButtons.length % 2 === 1 && idx === navButtons.length - 1;
                    const spanClass = isOddLast ? 'col-span-2 sm:col-span-1' : '';
                    if (btn.href) {
                      return (
                        <a
                          key={btn.key}
                          href={btn.href}
                          className={`min-h-11 px-3 py-2 rounded-xl text-xs flex items-center justify-center text-center leading-snug transition ${btn.className} ${spanClass}`}
                        >
                          {btn.label}
                        </a>
                      );
                    }
                    return (
                      <button
                        key={btn.key}
                        type="button"
                        onClick={btn.onClick}
                        className={`min-h-11 px-3 py-2 rounded-xl text-xs flex items-center justify-center text-center leading-snug cursor-pointer transition ${btn.className} ${spanClass}`}
                      >
                        {btn.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* أيقونة السيدة العذراء أو البث المباشر */}
            <div className="md:col-span-4 flex justify-center md:justify-end">
              {(featuredLive || featuredVideo) ? (() => {
                const media = featuredLive || featuredVideo;
                const embed = toEmbedUrl(media.url);
                const directVid = isDirectVideo(media.url);
                return (
                  <div className="w-full max-w-xs bg-black/35 border border-white/20 rounded-2xl p-2 space-y-1.5 shadow-xl">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="px-2 py-0.5 bg-red-600 text-white rounded-full font-black flex items-center gap-1">
                        {featuredLive ? <><Radio size={11} className="animate-pulse" /> بث مباشر</> : <><Video size={11} /> فيديو</>}
                      </span>
                      {renderCardActions(media)}
                    </div>
                    {embed ? (
                      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                        <iframe src={embed} title={media.title} className="w-full h-full" allowFullScreen />
                      </div>
                    ) : directVid ? (
                      <video src={media.url} controls autoPlay muted loop playsInline className="w-full aspect-video rounded-xl object-cover bg-black" />
                    ) : null}
                    <div className="flex justify-between items-center gap-1 text-[11px]">
                      <strong className="text-amber-200 truncate">{media.title}</strong>
                      {media.url && <a href={media.url} target="_blank" rel="noreferrer" className="px-2 py-0.5 bg-amber-400 text-[#4a0e13] rounded font-black shrink-0 flex items-center gap-1"><ExternalLink size={10} /> فتح</a>}
                    </div>
                  </div>
                );
              })() : theme.show_mary !== false && (
                <div className="relative w-32 h-36 md:w-36 md:h-40 rounded-3xl overflow-hidden border-2 border-amber-300/80 shadow-xl bg-[#2b0910] flex flex-col items-center justify-center text-center">
                  {activeMaryUrl ? (
                    <img src={activeMaryUrl} alt="السيدة العذراء مريم" className="w-full h-full object-cover" />
                  ) : (
                    <div className="p-2 flex flex-col items-center justify-center h-full text-amber-100">
                      <div className="w-14 h-14 rounded-full border-2 border-amber-300/80 bg-amber-200/15 flex items-center justify-center text-3xl mb-1">🕊️</div>
                      <span className="text-amber-300 font-black text-xs">السيدة العذراء مريم</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 py-0.5 text-[10px] font-black text-amber-200">
                    ✝ أم النور القديسة مريم
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {theme.show_ticker !== false && tickerText && (
          <div className="bg-black/40 border-t border-white/10 py-1.5 overflow-hidden text-xs font-bold text-amber-200">
            <div className="animate-ticker px-4">{tickerText}</div>
          </div>
        )}
      </header>

      {/* الأقسام المرتبة حسب تعديل الأدمن */}
      <main className="max-w-6xl mx-auto w-full px-4 py-6 md:py-8 space-y-7 flex-1">
        {orderedSections.map(sec => renderDynamicSection(sec))}

        {customCategories.map(cat => {
          const catItems = items.filter(i => i.kind === cat.title);
          return (
            <section key={cat.id} className="bg-white rounded-3xl p-5 md:p-6 border shadow-sm space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-2.5">
                <h2 className="text-base md:text-lg font-black text-[#7a1c24] flex items-center gap-2"><Layers size={19} /> {cat.body || cat.title}</h2>
                {canEdit && (
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => openAddContentModal(cat.title)} className="px-3 py-1 bg-[#f9ecee] text-[#7a1c24] rounded-lg text-xs font-black cursor-pointer">+ إضافة</button>
                    <button type="button" onClick={() => handleRenameCustomCategory(cat)} className="p-1.5 bg-gray-100 rounded-lg cursor-pointer"><Edit3 size={13} /></button>
                    <button type="button" onClick={() => handleDeleteCustomCategory(cat)} className="p-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
              {catItems.length === 0 ? (
                <p className="text-xs text-gray-500">لا توجد بنود مضافة داخل هذا القسم حتى الآن.</p>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {catItems.map(it => (
                    <div key={it.id} className="p-4 bg-[#fbfaf7] border rounded-2xl space-y-1.5">
                      <div className="flex justify-between items-start gap-2">
                        <strong className="text-sm text-[#7a1c24] block">{it.title}</strong>
                        {renderCardActions(it)}
                      </div>
                      {it.url && isImageUrl(it.url) && <img src={it.url} alt={it.title} className="w-full h-36 object-cover rounded-xl border" />}
                      {it.body && <p className="text-xs text-gray-700 whitespace-pre-line">{it.body}</p>}
                      <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
                        {it.time_text && <span>⏰ {it.time_text}</span>}
                        {it.location && <span>📍 {it.location}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>

      <footer className="bg-[#36070b] text-white/75 text-center py-4 px-4 text-xs mt-6">
        ✝ {activeChurchTitle} — جميع الحقوق محفوظة
      </footer>

      {/* مودال تعديل أو إضافة محتوى */}
      {showContentModal && canEdit && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-black text-[#7a1c24]">{editingItemId ? '✏️ تعديل البند' : '+ إضافة بند أو قسم جديد'}</h3>
              <button type="button" onClick={() => setShowContentModal(false)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveContent} className="space-y-3 text-xs font-bold text-gray-700">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label>نوع المحتوى / القسم *</label>
                  <button type="button" onClick={() => setCreatingCategory(!creatingCategory)} className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-lg text-[11px] font-black cursor-pointer">
                    {creatingCategory ? 'إلغاء' : '+ إنشاء قسم جديد بإيدي'}
                  </button>
                </div>
                {creatingCategory ? (
                  <div className="bg-amber-50 p-3 rounded-2xl border border-amber-300 flex gap-2">
                    <input autoFocus placeholder="اكتب اسم القسم..." className="flex-1 p-2 border rounded-xl bg-white" value={newCategoryLabel} onChange={e => setNewCategoryLabel(e.target.value)} />
                    <button type="button" onClick={handleCreateCustomCategory} className="px-3.5 py-2 bg-[#7a1c24] text-white rounded-xl font-black cursor-pointer shrink-0">حفظ القسم</button>
                  </div>
                ) : (
                  <select className="w-full p-2.5 border rounded-xl bg-white" value={contentForm.kind} onChange={e => setContentForm({ ...contentForm, kind: e.target.value })}>
                    {allKindOptions.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                )}
              </div>
              <input required placeholder="العنوان / الاسم *" className="w-full p-2.5 border rounded-xl" value={contentForm.title} onChange={e => setContentForm({ ...contentForm, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="الوقت / الدرجة" className="w-full p-2.5 border rounded-xl" value={contentForm.time_text} onChange={e => setContentForm({ ...contentForm, time_text: e.target.value })} />
                <input placeholder="المكان / التليفون" className="w-full p-2.5 border rounded-xl" value={contentForm.location} onChange={e => setContentForm({ ...contentForm, location: e.target.value })} />
              </div>
              <div className="bg-indigo-50/60 p-3 rounded-2xl border border-indigo-200 space-y-2">
                <div className="flex flex-wrap gap-2 items-center">
                  {contentForm.kind !== 'livestream' && (
                    <label className="px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 bg-indigo-700 text-white">
                      <Upload size={14} /> {uploadingMedia ? 'جاري الرفع...' : 'اختر ملف من الجهاز'}
                      <input type="file" accept="image/*,video/*" className="hidden" disabled={uploadingMedia} onChange={handleUploadFile} />
                    </label>
                  )}
                  <input placeholder="أو رابط مباشر https://..." className="flex-1 min-w-45 p-2.5 border rounded-xl bg-white" value={contentForm.url} onChange={e => setContentForm({ ...contentForm, url: e.target.value })} />
                </div>
                {contentForm.url && isImageUrl(contentForm.url) && <img src={contentForm.url} alt="معاينة" className="h-24 rounded-xl border object-cover bg-white" />}
              </div>
              <textarea rows="3" placeholder="التفاصيل / السيرة / النص..." className="w-full p-2.5 border rounded-xl font-normal" value={contentForm.body} onChange={e => setContentForm({ ...contentForm, body: e.target.value })} />
              <button type="submit" disabled={savingContent || uploadingMedia} className="w-full py-3 bg-[#7a1c24] text-white rounded-xl font-black text-sm cursor-pointer">
                {savingContent ? 'جاري الحفظ...' : editingItemId ? 'حفظ التعديل' : 'إضافة ونشر فوراً'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* مودال ترتيب وإخفاء الأقسام من الأدمن */}
      {showSectionsModal && canEdit && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-black text-[#7a1c24]">⚙️ تعديل وترتيب وإخفاء الأقسام</h3>
              <button type="button" onClick={() => setShowSectionsModal(false)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveSections} className="space-y-3 text-xs font-bold">
              {DEFAULT_SECTIONS.map(s => (
                <div key={s.key} className="p-3 bg-gray-50 rounded-2xl border space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">القسم: {s.defaultTitle}</span>
                    <label className="flex items-center gap-1.5 text-red-700 cursor-pointer">
                      <input type="checkbox" checked={Boolean(sectionEdits[s.key]?.hidden)} onChange={e => setSectionEdits({ ...sectionEdits, [s.key]: { ...sectionEdits[s.key], hidden: e.target.checked } })} /> إخفاء
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <input className="flex-1 p-2 border rounded-xl bg-white" placeholder="اسم القسم بالعربي" value={sectionEdits[s.key]?.title || ''} onChange={e => setSectionEdits({ ...sectionEdits, [s.key]: { ...sectionEdits[s.key], title: e.target.value } })} />
                    <input type="number" min="1" className="w-16 p-2 border rounded-xl bg-white text-center" title="رقم الترتيب" value={sectionEdits[s.key]?.sort_order || s.sort_order} onChange={e => setSectionEdits({ ...sectionEdits, [s.key]: { ...sectionEdits[s.key], sort_order: e.target.value } })} />
                  </div>
                </div>
              ))}
              <button type="submit" disabled={savingContent} className="w-full py-3 bg-[#7a1c24] text-white rounded-xl font-black text-sm cursor-pointer">
                {savingContent ? 'جاري الحفظ...' : 'حفظ الترتيب والتغييرات ✅'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* مودال تعديل القداس أو الفعالية */}
      {editEventModal && canEdit && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2"><h3 className="text-base font-black text-[#7a1c24]">✏️ تعديل الحدث</h3><button type="button" onClick={() => setEditEventModal(null)} className="p-1.5 bg-gray-100 rounded-xl"><X size={18} /></button></div>
            <form onSubmit={handleSaveEditedEvent} className="space-y-3 text-xs font-bold">
              <input required placeholder="العنوان *" className="w-full p-2.5 border rounded-xl" value={editEventModal.title || ''} onChange={e => setEditEventModal({ ...editEventModal, title: e.target.value })} />
              <input required placeholder="الوقت *" className="w-full p-2.5 border rounded-xl" value={editEventModal.event_time || ''} onChange={e => setEditEventModal({ ...editEventModal, event_time: e.target.value })} />
              <input required placeholder="المكان *" className="w-full p-2.5 border rounded-xl" value={editEventModal.place || ''} onChange={e => setEditEventModal({ ...editEventModal, place: e.target.value })} />
              <button type="submit" className="w-full py-2.5 bg-[#7a1c24] text-white rounded-xl font-black cursor-pointer">حفظ التعديل</button>
            </form>
          </div>
        </div>
      )}

      {editMassModal && canEdit && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2"><h3 className="text-base font-black text-[#7a1c24]">✏️ تعديل ميعاد القداس</h3><button type="button" onClick={() => setEditMassModal(null)} className="p-1.5 bg-gray-100 rounded-xl"><X size={18} /></button></div>
            <form onSubmit={handleSaveEditedMass} className="space-y-3 text-xs font-bold">
              <input required placeholder="اسم القداس *" className="w-full p-2.5 border rounded-xl" value={editMassModal.mass_name || ''} onChange={e => setEditMassModal({ ...editMassModal, mass_name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input required type="date" className="p-2.5 border rounded-xl" value={editMassModal.mass_date || ''} onChange={e => setEditMassModal({ ...editMassModal, mass_date: e.target.value })} />
                <input required placeholder="الوقت *" className="w-full p-2.5 border rounded-xl" value={editMassModal.mass_time || ''} onChange={e => setEditMassModal({ ...editMassModal, mass_time: e.target.value })} />
              </div>
              <input required placeholder="الكنيسة *" className="w-full p-2.5 border rounded-xl" value={editMassModal.church_name || ''} onChange={e => setEditMassModal({ ...editMassModal, church_name: e.target.value })} />
              <button type="submit" className="w-full py-2.5 bg-[#7a1c24] text-white rounded-xl font-black cursor-pointer">حفظ التعديل</button>
            </form>
          </div>
        </div>
      )}

      {/* مودال تسجيل عضو جديد */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-xl p-6 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <div><h3 className="text-base font-black text-[#7a1c24]">تسجيل عضو جديد — {activeChurchTitle}</h3><p className="text-[11px] text-gray-500">يتم مراجعة الطلب وقبوله من إدارة الكنيسة لتفعيل الحساب</p></div>
              <button type="button" onClick={() => setShowRegister(false)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"><X size={18} /></button>
            </div>
            {regStatus.msg && (
              <div className={`p-3 rounded-2xl text-xs font-bold flex items-start gap-2 border ${regStatus.type === 'success' ? 'bg-green-50 border-green-300 text-green-900' : 'bg-red-50 border-red-300 text-red-800'}`}>
                {regStatus.type === 'success' && <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
                <span>{regStatus.msg}</span>
              </div>
            )}
            <form onSubmit={handleRegister} autoComplete="off" className="space-y-3 text-xs font-bold text-gray-700">
              <div className="bg-[#fbfaf7] p-3 rounded-2xl border space-y-1.5">
                <label className="block text-[#7a1c24]">الاسم الرباعي بالكامل *</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input required placeholder="الأول *" className="p-2.5 border rounded-xl bg-white" value={regForm.first_name} onChange={e => setRegForm({ ...regForm, first_name: e.target.value })} />
                  <input required placeholder="الثاني *" className="p-2.5 border rounded-xl bg-white" value={regForm.second_name} onChange={e => setRegForm({ ...regForm, second_name: e.target.value })} />
                  <input required placeholder="الثالث *" className="p-2.5 border rounded-xl bg-white" value={regForm.third_name} onChange={e => setRegForm({ ...regForm, third_name: e.target.value })} />
                  <input required placeholder="الرابع *" className="p-2.5 border rounded-xl bg-white" value={regForm.fourth_name} onChange={e => setRegForm({ ...regForm, fourth_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input required placeholder="اسم المستخدم للدخول *" className="w-full p-2.5 border rounded-xl" value={regForm.username} onChange={e => setRegForm({ ...regForm, username: e.target.value })} />
                <input required type="password" placeholder="كلمة المرور *" className="w-full p-2.5 border rounded-xl" value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input required type="tel" placeholder="رقم الموبايل / الواتساب *" className="w-full p-2.5 border rounded-xl" value={regForm.phone} onChange={e => setRegForm({ ...regForm, phone: e.target.value })} />
                <input required type="date" className="w-full p-2.5 border rounded-xl" value={regForm.dob} onChange={e => setRegForm({ ...regForm, dob: e.target.value })} />
                <select
                  required
                  className="w-full p-2.5 border rounded-xl bg-white"
                  value={regForm.gender}
                  onChange={e => {
                    const g = e.target.value;
                    setRegForm({
                      ...regForm,
                      gender: g,
                      guardian_type: g === 'أنثى' ? 'mother' : 'father'
                    });
                  }}
                >
                  <option value="ذكر">♂️ النوع: ذكر</option>
                  <option value="أنثى">♀️ النوع: أنثى</option>
                </select>
              </div>
              <input required placeholder="العنوان بالتفصيل *" className="w-full p-2.5 border rounded-xl" value={regForm.address} onChange={e => setRegForm({ ...regForm, address: e.target.value })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select className="w-full p-2.5 border rounded-xl bg-white" value={regForm.requested_role} onChange={e => setRegForm({ ...regForm, requested_role: e.target.value })}>
                  {REGISTER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                {regForm.requested_role !== 'parent' && regForm.requested_role !== 'parish' && (
                  <select className="w-full p-2.5 border rounded-xl bg-white" value={regForm.detailed_stage} onChange={e => setRegForm({ ...regForm, detailed_stage: e.target.value })}>
                    {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              {regForm.requested_role !== 'parent' && (
                <label className="flex items-center gap-2 p-3 bg-blue-50/70 border border-blue-200 rounded-xl cursor-pointer text-blue-950">
                  <input type="checkbox" checked={regForm.also_parent} onChange={e => setRegForm({ ...regForm, also_parent: e.target.checked })} />
                  <span>👨‍👩‍👦 وأيضاً: ولي أمر (لدي أبناء في الكنيسة وأريد متابعتهم)</span>
                </label>
              )}
              {regForm.requested_role !== 'parent' && (
                <div className="grid grid-cols-2 gap-2.5 bg-gray-50 p-2.5 rounded-xl border">
                  <select className="p-2 border rounded-xl bg-white" value={regForm.is_studying ? 'yes' : 'no'} onChange={e => setRegForm({ ...regForm, is_studying: e.target.value === 'yes' })}>
                    <option value="yes">طالب / بيدرس</option><option value="no">خريج / يعمل</option>
                  </select>
                  <input placeholder={regForm.is_studying ? 'السنة الدراسية / الكلية' : 'الوظيفة / المهنة'} className="p-2 border rounded-xl bg-white" value={regForm.job_title} onChange={e => setRegForm({ ...regForm, job_title: e.target.value })} />
                </div>
              )}
              {showParentChildrenBox && (
                <div className="bg-amber-50/70 p-3.5 rounded-2xl border-2 border-amber-200 space-y-2.5">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <strong className="text-[#7a1c24] block">👨‍👩‍👦 بيانات الأبناء ({childrenList.length} مضافين):</strong>
                    <select className="p-1.5 border border-amber-300 rounded-xl bg-white text-[11px]" value={regForm.guardian_type} onChange={e => setRegForm({ ...regForm, guardian_type: e.target.value })}>
                      <option value="father">👨 الصفة: الأب</option>
                      <option value="mother">👩 الصفة: الأم</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <input placeholder="اسم الابن / الابنة" className="p-2 border rounded-xl bg-white" value={tempChild.child_name} onChange={e => setTempChild({ ...tempChild, child_name: e.target.value })} />
                    <input type="date" className="p-2 border rounded-xl bg-white" value={tempChild.dob} onChange={e => setTempChild({ ...tempChild, dob: e.target.value })} />
                    <select className="p-2 border rounded-xl bg-white" value={tempChild.gender} onChange={e => setTempChild({ ...tempChild, gender: e.target.value })}>
                      <option value="ذكر">♂️ ذكر</option>
                      <option value="أنثى">♀️ أنثى</option>
                    </select>
                    <select className="p-2 border rounded-xl bg-white" value={tempChild.stage} onChange={e => setTempChild({ ...tempChild, stage: e.target.value })}>{STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select>
                    <input placeholder="تفاصيل الدراسة" className="sm:col-span-2 p-2 border rounded-xl bg-white" value={tempChild.study_details} onChange={e => setTempChild({ ...tempChild, study_details: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <input type="tel" placeholder="موبايل الابن (اختياري)" className="flex-1 p-2 border rounded-xl bg-white" value={tempChild.phone} onChange={e => setTempChild({ ...tempChild, phone: e.target.value })} />
                    <button type="button" onClick={handleAddChildRow} className="px-3.5 py-2 bg-amber-600 text-white rounded-xl flex items-center gap-1 cursor-pointer"><Plus size={14} /> إضافة ابن/ابنة</button>
                  </div>
                  {childrenList.map((c, idx) => (
                    <div key={idx} className="bg-white p-2 rounded-xl border flex justify-between items-center text-[11px]">
                      <span>• <strong>{c.child_name}</strong> ({c.gender === 'أنثى' ? 'أنثى' : 'ذكر'} • {c.study_details || c.stage})</span>
                      <button type="button" onClick={() => setChildrenList(childrenList.filter((_, i) => i !== idx))} className="text-red-600 p-1"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border">
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={regForm.is_deacon} onChange={e => setRegForm({ ...regForm, is_deacon: e.target.checked })} /> شماس؟</label>
                {regForm.is_deacon && <input placeholder="الرتبة" className="flex-1 p-1.5 border rounded-lg bg-white" value={regForm.deacon_rank} onChange={e => setRegForm({ ...regForm, deacon_rank: e.target.value })} />}
              </div>
              <button type="submit" disabled={submitting} className="w-full py-3 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black text-sm cursor-pointer">
                {submitting ? 'جاري إرسال الطلب...' : 'إرسال طلب التسجيل للموافقة'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
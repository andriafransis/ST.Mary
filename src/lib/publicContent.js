// ─────────────────────────────────────────────────────────────
// publicContent.js — المصدر الواحد المشترك بين PublicPage و PublicEditor
// أي تعديل على أنواع المحتوى أو الأقسام أو المظهر يتم هنا فقط،
// فتفضل الصفحة العامة والمحرر متطابقين دائماً.
// ─────────────────────────────────────────────────────────────

export const TABLE = 'church_public_content';
export const DEFAULT_CHURCH_NAME = 'كنيسة السيدة العذراء مريم بالمطرية';
export const SYSTEM_KINDS = ['theme_config', 'section_config', 'category_def', 'role_template'];

// ───────────── أنواع المحتوى (نفس مواصفات المحرر) ─────────────
export const CONTENT_SPECS = [
  {
    value: 'hanna_word',
    label: '✝ كلمة روحية (كلمة قدس أبونا / تأمل / رسالة)',
    domain: 'كلمة الأب • نص وصورة أو فيديو',
    titleLabel: 'عنوان الكلمة *',
    titlePlaceholder: 'مثال: كلمة قدس أبونا لهذا الأسبوع',
    dateLabel: 'تاريخ الكلمة',
    timeLabel: 'مناسبة أو تعليق قصير',
    timePlaceholder: 'مثال: بمناسبة صوم الميلاد',
    locationLabel: 'المصدر / المكان',
    locationPlaceholder: 'مثال: عظة الأحد',
    urlLabel: 'صورة الأب أو فيديو الكلمة (اختياري)',
    urlPlaceholder: 'https://... رابط يوتيوب أو ارفع صورة',
    bodyLabel: 'نص الكلمة *',
    bodyPlaceholder: 'اكتب الكلمة أو التأمل بالكامل...',
    mediaType: 'image_or_url',
    acceptMedia: 'image/*,video/*'
  },
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

export function getSpecForKind(kind, customCategories = []) {
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

// ───────────── أقسام الصفحة ─────────────
export const SECTION_DEFS = [
  { key: 'summary', defaultTitle: 'ملخص الأرقام السريع', sort_order: 1, anchor: null, icon: '📊', hint: 'شريط الأرقام أسفل الواجهة' },
  { key: 'hanna_word', defaultTitle: 'كلمة قدس أبونا حنا فؤاد', sort_order: 2, anchor: 'sec-hanna', icon: '✝', hint: 'الكلمة الروحية' },
  { key: 'media', defaultTitle: 'صور وفيديوهات الكنيسة', sort_order: 3, anchor: 'sec-media', icon: '📸', hint: 'معرض الصور والفيديو' },
  { key: 'news', defaultTitle: 'أخبار وأحداث الكنيسة', sort_order: 4, anchor: 'sec-news', icon: '📰', hint: 'الأخبار والفعاليات' },
  { key: 'masses_trips', defaultTitle: 'مواعيد القداسات والصلوات ومكتب الرحلات', sort_order: 5, anchor: 'sec-masses', icon: '⛪', hint: 'القداسات والرحلات' },
  { key: 'priest_bio', defaultTitle: 'آباء الكنيسة', sort_order: 6, anchor: 'sec-priests', icon: '✝', hint: 'الآباء الكهنة' },
  { key: 'history', defaultTitle: 'تاريخ الكنيسة', sort_order: 7, anchor: 'sec-history', icon: '📜', hint: 'نبذة تاريخية' }
];

// ───────────── المظهر ─────────────
export const DEFAULT_THEME = {
  headerBg: 'from-[#5c1319] via-[#7a1c24] to-[#32060a]',
  pageBg: '#f6f4ef',
  show_ticker: true,
  show_mary: true,
  show_edu_btn: true,
  show_joseph_btn: true,
  sticky_header: true,
  show_services: true,    // قسم الخدمات الإلكترونية (المركز التعليمي / يوسف الرامي / الدخول)
  primary: '',            // لون أساسي مخصص (فاضي = الألوان الجاهزة)
  accent: '',             // لون التمييز للأزرار (فاضي = الذهبي)
  mary_shape: 'arch',     // arch | circle | rounded
  mary_caption: '✝ أم النور القديسة مريم'
};

export const isHexColor = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));

export const MARY_SHAPES = [
  { id: 'arch', label: 'قوس (عقد)', cls: 'rounded-t-[999px] rounded-b-[2rem]', ring: 'rounded-t-[999px] rounded-b-[2.5rem]' },
  { id: 'circle', label: 'دائرة', cls: 'rounded-full', ring: 'rounded-full' },
  { id: 'rounded', label: 'مستطيل مستدير', cls: 'rounded-3xl', ring: 'rounded-[2rem]' }
];

// تدرّج الواجهة من لون أساسي واحد
export const primaryGradient = (primary) =>
  `linear-gradient(135deg, color-mix(in srgb, ${primary} 55%, black), ${primary} 55%, color-mix(in srgb, ${primary} 30%, black))`;

const escCls = (c) => c.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
const mix = (v, pct) => `color-mix(in srgb, ${v} ${pct}%, transparent)`;

// قواعد تغيير اللون الأساسي ولون التمييز داخل الصفحة العامة فقط
const PRIMARY_RULES = [
  ['bg-[#7a1c24]', 'background-color', 'var(--pp-p)'],
  ['bg-[#7a1c24]/10', 'background-color', mix('var(--pp-p)', 10)],
  ['bg-[#2b0910]', 'background-color', 'var(--pp-pddd)'],
  ['bg-[#f9ecee]', 'background-color', 'var(--pp-tint)'],
  ['border-[#7a1c24]/15', 'border-color', mix('var(--pp-p)', 15)],
  ['border-[#7a1c24]/25', 'border-color', mix('var(--pp-p)', 25)],
  ['border-[#7a1c24]/30', 'border-color', mix('var(--pp-p)', 30)],
  ['hover:bg-[#5c1319]', 'background-color', 'var(--pp-pd)'],
  ['hover:border-[#7a1c24]', 'border-color', 'var(--pp-p)'],
  ['hover:border-[#7a1c24]/40', 'border-color', mix('var(--pp-p)', 40)],
  ['text-[#7a1c24]', 'color', 'var(--pp-p)'],
  ['text-[#5c1319]', 'color', 'var(--pp-pd)'],
  ['text-[#4a0e13]', 'color', 'var(--pp-pdd)'],
  ['from-[#7a1c24]', '--tw-gradient-from', 'var(--pp-p)'],
  ['to-[#32060a]', '--tw-gradient-to', 'var(--pp-pddd)']
];
const ACCENT_RULES = [
  ['bg-amber-400', 'background-color', 'var(--pp-a)'],
  ['hover:bg-amber-300', 'background-color', 'var(--pp-al)'],
  ['bg-amber-300/10', 'background-color', mix('var(--pp-al)', 10)],
  ['bg-amber-200/15', 'background-color', mix('var(--pp-all)', 15)],
  ['border-amber-300', 'border-color', 'var(--pp-al)'],
  ['border-amber-300/30', 'border-color', mix('var(--pp-al)', 30)],
  ['border-amber-300/40', 'border-color', mix('var(--pp-al)', 40)],
  ['border-amber-300/50', 'border-color', mix('var(--pp-al)', 50)],
  ['border-amber-300/80', 'border-color', mix('var(--pp-al)', 80)],
  ['text-amber-200', 'color', 'var(--pp-all)'],
  ['text-amber-300', 'color', 'var(--pp-al)'],
  ['text-amber-300/50', 'color', mix('var(--pp-al)', 50)],
  ['text-amber-400/60', 'color', mix('var(--pp-a)', 60)],
  ['ring-amber-300', '--tw-ring-color', 'var(--pp-al)']
];

const ruleToCss = ([cls, prop, val]) => {
  const isHover = cls.startsWith('hover:');
  return `.pp-root .${escCls(cls)}${isHover ? ':hover' : ''}{${prop}:${val} !important}`;
};

// CSS يتحقن في الصفحة العامة بناءً على الألوان المخصصة (فاضي لو مفيش تخصيص)
export function buildThemeCss(theme = {}) {
  let css = '';
  const vars = [];
  if (isHexColor(theme.primary)) {
    const p = theme.primary;
    vars.push(
      `--pp-p:${p}`,
      `--pp-pd:color-mix(in srgb, ${p} 78%, black)`,
      `--pp-pdd:color-mix(in srgb, ${p} 55%, black)`,
      `--pp-pddd:color-mix(in srgb, ${p} 30%, black)`,
      `--pp-tint:color-mix(in srgb, ${p} 8%, white)`
    );
    css += PRIMARY_RULES.map(ruleToCss).join('\n');
    css += `\n.pp-root .pp-hdr{background-image:${primaryGradient(p)} !important}`;
  }
  if (isHexColor(theme.accent)) {
    const a = theme.accent;
    vars.push(
      `--pp-a:${a}`,
      `--pp-al:color-mix(in srgb, ${a} 70%, white)`,
      `--pp-all:color-mix(in srgb, ${a} 45%, white)`
    );
    css += '\n' + ACCENT_RULES.map(ruleToCss).join('\n');
  }
  return vars.length ? `.pp-root{${vars.join(';')}}\n${css}` : '';
}

export const HEADER_PRESETS = [
  { id: 'burgundy', label: 'عنابي كلاسيكي', value: 'from-[#5c1319] via-[#7a1c24] to-[#32060a]', swatch: '#7a1c24' },
  { id: 'night', label: 'أزرق ليلي', value: 'from-[#0f1f3d] via-[#1e3a6e] to-[#0a1428]', swatch: '#1e3a6e' },
  { id: 'forest', label: 'أخضر زيتوني', value: 'from-[#14301f] via-[#1f5a3a] to-[#0b1d12]', swatch: '#1f5a3a' },
  { id: 'royal', label: 'بنفسجي ملكي', value: 'from-[#2d1457] via-[#4b2a8a] to-[#1a0b36]', swatch: '#4b2a8a' },
  { id: 'bronze', label: 'برونزي دافئ', value: 'from-[#4a2f0b] via-[#8a5a14] to-[#2e1c05]', swatch: '#8a5a14' }
];

export const PAGE_BG_PRESETS = ['#f6f4ef', '#ffffff', '#fbf7f0', '#f3f6fb', '#f4f1f8'];

export function readTheme(items = []) {
  const row = items.find(i => i.kind === 'theme_config');
  let theme = { ...DEFAULT_THEME };
  if (row?.body) {
    try {
      theme = { ...theme, ...JSON.parse(row.body) };
    } catch {
      // نتجاهل أي JSON تالف ونستخدم الافتراضي
    }
  }
  return { theme, row: row || null };
}

export function readSections(items = []) {
  const rows = items.filter(i => i.kind === 'section_config');
  return SECTION_DEFS.map(def => {
    const cfg = rows.find(r => r.title === def.key);
    return {
      ...def,
      title: (cfg?.body || '').trim() || def.defaultTitle,
      hidden: cfg?.location === 'hidden',
      order: cfg ? Number(cfg.sort_order ?? def.sort_order) : def.sort_order,
      cfgRow: cfg || null
    };
  }).sort((a, b) => a.order - b.order);
}

// العناوين المنفصلة للقداسات والرحلات (زي الصفحة القديمة)
export const SUB_SECTION_DEFS = [
  { key: 'masses', defaultTitle: 'مواعيد القداسات والصلوات', navTitle: 'القداسات', icon: '⛪' },
  { key: 'trips', defaultTitle: 'مكتب الرحلات والمؤتمرات', navTitle: 'الرحلات', icon: '🚌' }
];

export function readSubSections(items = []) {
  const rows = items.filter(i => i.kind === 'section_config');
  return SUB_SECTION_DEFS.map(def => {
    const cfg = rows.find(r => r.title === def.key);
    return {
      ...def,
      title: (cfg?.body || '').trim() || def.defaultTitle,
      hidden: cfg?.location === 'hidden',
      cfgRow: cfg || null
    };
  });
}

export async function saveSubSections(supabase, subs) {
  const { data: existing, error: readErr } = await supabase
    .from(TABLE).select('id,title').eq('kind', 'section_config');
  if (readErr) return { error: readErr };
  for (let i = 0; i < subs.length; i += 1) {
    const s = subs[i];
    const payload = {
      kind: 'section_config',
      title: s.key,
      body: (s.title || '').trim() || s.defaultTitle,
      location: s.hidden ? 'hidden' : 'visible',
      sort_order: 100 + i
    };
    const row = (existing || []).find(r => r.title === s.key);
    const res = row
      ? await supabase.from(TABLE).update(payload).eq('id', row.id)
      : await supabase.from(TABLE).insert([payload]);
    if (res.error) return { error: res.error };
  }
  return { error: null };
}

// حفظ الأقسام كلها دفعة واحدة بدون ما نكرر السجلات (بنقرأ الموجود الأول)
export async function saveSections(supabase, sections) {
  const { data: existing, error: readErr } = await supabase
    .from(TABLE)
    .select('id,title')
    .eq('kind', 'section_config');
  if (readErr) return { error: readErr };

  for (let i = 0; i < sections.length; i += 1) {
    const s = sections[i];
    const payload = {
      kind: 'section_config',
      title: s.key,
      body: (s.title || '').trim() || s.defaultTitle,
      location: s.hidden ? 'hidden' : 'visible',
      sort_order: i + 1
    };
    const row = (existing || []).find(r => r.title === s.key);
    const res = row
      ? await supabase.from(TABLE).update(payload).eq('id', row.id)
      : await supabase.from(TABLE).insert([payload]);
    if (res.error) return { error: res.error };
  }
  return { error: null };
}

// حفظ المظهر مع الإبقاء على أي مفاتيح تانية موجودة (مثلاً من صفحة التصميم)
export async function saveTheme(supabase, patch) {
  const { data: rows, error: readErr } = await supabase
    .from(TABLE)
    .select('id,body')
    .eq('kind', 'theme_config')
    .order('created_at', { ascending: true })
    .limit(1);
  if (readErr) return { error: readErr };

  let base = {};
  try {
    base = rows?.[0]?.body ? JSON.parse(rows[0].body) : {};
  } catch {
    base = {};
  }
  const next = { ...base, ...patch };
  const body = JSON.stringify(next);

  const res = rows?.[0]?.id
    ? await supabase.from(TABLE).update({ body }).eq('id', rows[0].id)
    : await supabase.from(TABLE).insert([{ kind: 'theme_config', title: 'theme', body, location: 'visible', sort_order: 0 }]);
  return { error: res.error || null, theme: { ...DEFAULT_THEME, ...next } };
}

// ───────────── فحص جاهزية قاعدة البيانات للأعمدة الجديدة ─────────────
let schemaCache = null;
export async function probeSchema(supabase, force = false) {
  if (schemaCache !== null && !force) return schemaCache;
  try {
    const { error } = await supabase
      .from(TABLE)
      .select('is_published,is_featured,event_date,expires_on')
      .limit(1);
    schemaCache = !error;
  } catch {
    schemaCache = false;
  }
  return schemaCache;
}

// ───────────── التاريخ والوقت ─────────────
const AR_FULL = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const AR_SHORT = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long' });
const AR_MONTH = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { month: 'short' });

export function parseISODate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '').trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function toISODate(d) {
  if (!d) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function composeSchedule(dateVal, timeVal) {
  const d = (dateVal || '').trim();
  const t = (timeVal || '').trim();
  if (d && t) return `${d} • ${t}`;
  return d || t || '';
}

export function splitSchedule(raw = '') {
  const s = (raw || '').trim();
  if (!s) return { event_date: '', event_time: '' };
  const parts = s.split('•').map(p => p.trim());
  if (parts.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
    return { event_date: parts[0], event_time: parts.slice(1).join(' • ') };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { event_date: s, event_time: '' };
  return { event_date: '', event_time: s };
}

// يرجّع تاريخ ووقت البند سواء كان مخزن في العمود الجديد أو مدمج في time_text
export function getItemSchedule(item) {
  const sp = splitSchedule(item?.time_text);
  const date = parseISODate(item?.event_date) || parseISODate(sp.event_date);
  return { date, time: sp.event_time };
}

export const formatDateFull = d => (d ? AR_FULL.format(d) : '');
export const formatDateShort = d => (d ? AR_SHORT.format(d) : '');
export const monthShort = d => (d ? AR_MONTH.format(d) : '');

export function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function relativeDayLabel(d) {
  if (!d) return '';
  const diff = Math.round((d.getTime() - startOfToday().getTime()) / 86400000);
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'غداً';
  if (diff === 2) return 'بعد غد';
  if (diff > 2 && diff <= 10) return `بعد ${diff} أيام`;
  if (diff < 0) return 'انتهى';
  return '';
}

// يفهم: 6:00 ص / 07:30 م / 18:30 / 6 مساءً
export function parseClockMinutes(str = '') {
  const s = String(str)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .toLowerCase();
  const m = /(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*(ص|صباح|م|مساء|am|pm)?/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const mer = m[3] || '';
  if (h > 24 || min > 59) return null;
  const isPm = /^(م|مساء|pm)/.test(mer);
  const isAm = /^(ص|صباح|am)/.test(mer);
  if (isPm && h < 12) h += 12;
  if (isAm && h === 12) h = 0;
  return h * 60 + min;
}

export function combineDateTime(date, timeText) {
  if (!date) return null;
  const mins = parseClockMinutes(timeText);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  if (mins !== null) d.setMinutes(mins);
  else d.setHours(23, 59, 0, 0);
  return d;
}

// ───────────── الروابط والميديا ─────────────
export function toEmbedUrl(rawUrl = '') {
  const u = String(rawUrl || '').trim();
  if (!u) return '';
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(u)) return `https://www.youtube.com/embed/live_stream?channel=${u}`;
  const ch = u.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]+)/);
  if (ch && ch[1]) return `https://www.youtube.com/embed/live_stream?channel=${ch[1]}`;
  const m = u.match(/(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (m && m[1]) return `https://www.youtube.com/embed/${m[1]}?rel=0`;
  return '';
}

export function youtubeThumb(rawUrl = '') {
  const m = String(rawUrl || '').match(/(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m && m[1] ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : '';
}

export const isDirectVideo = (u = '') => /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(String(u).trim());
export const isImageUrl = (u = '') => /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(String(u).trim());
export const isSafeHttpUrl = (u = '') => /^https?:\/\//i.test(String(u).trim());

export function extractPhone(text = '') {
  const m = String(text || '').match(/(\+?\d[\d\s-]{7,}\d)/);
  return m ? m[1].replace(/[\s-]/g, '') : '';
}

// ───────────── المحتوى: ترتيب وظهور وبناء السجلات ─────────────
export function sortContent(list = []) {
  return [...list].sort((a, b) => {
    if (Boolean(b.is_featured) !== Boolean(a.is_featured)) return b.is_featured ? 1 : -1;
    const so = Number(a.sort_order || 0) - Number(b.sort_order || 0);
    if (so !== 0) return so;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

export function isItemLive(item, { isEditor = false } = {}) {
  if (isEditor) return true;
  if (item.is_published === false) return false;
  const exp = parseISODate(item.expires_on);
  if (exp && exp.getTime() < startOfToday().getTime()) return false;
  return true;
}

export function itemStatus(item) {
  if (item.is_published === false) return 'draft';
  const exp = parseISODate(item.expires_on);
  if (exp && exp.getTime() < startOfToday().getTime()) return 'expired';
  if (item.is_featured) return 'featured';
  return 'live';
}

export const EMPTY_FORM = {
  kind: 'news',
  title: '',
  event_date: '',
  event_time: '',
  location: '',
  url: '',
  body: '',
  sort_order: 0,
  is_published: true,
  is_featured: false,
  expires_on: ''
};

export function formFromItem(item) {
  const sp = getItemSchedule(item);
  return {
    kind: item.kind || 'news',
    title: item.title || '',
    event_date: sp.date ? toISODate(sp.date) : '',
    event_time: splitSchedule(item.time_text).event_time,
    location: item.location || '',
    url: item.url || '',
    body: item.body || '',
    sort_order: item.sort_order ?? 0,
    is_published: item.is_published !== false,
    is_featured: Boolean(item.is_featured),
    expires_on: item.expires_on ? String(item.expires_on).slice(0, 10) : ''
  };
}

export function buildContentPayload(form, schemaReady) {
  const base = {
    kind: form.kind,
    title: (form.title || '').trim(),
    location: (form.location || '').trim(),
    url: (form.url || '').trim(),
    body: form.body || '',
    sort_order: Number(form.sort_order || 0)
  };
  if (schemaReady) {
    return {
      ...base,
      time_text: (form.event_time || '').trim(),
      event_date: form.event_date || null,
      is_published: form.is_published !== false,
      is_featured: Boolean(form.is_featured),
      expires_on: form.expires_on || null
    };
  }
  return { ...base, time_text: composeSchedule(form.event_date, form.event_time) };
}

// سجلات النظام/الصلاحيات اللي اتسربت لجدول المحتوى العام
export function looksLikeSystemJson(item) {
  const body = (item.body || '').trim();
  const title = (item.title || '').trim();
  if (SYSTEM_KINDS.includes(item.kind)) return true;
  if (title.startsWith('lpi_') || item.kind?.startsWith('lpi_')) return true;
  return body.startsWith('{') && (body.includes('"can_view"') || body.includes('"preset"') || body.includes('"service_stage"'));
}

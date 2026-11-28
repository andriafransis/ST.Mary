import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';
import AdminChurchSettingsAndBurial from './AdminChurchSettingsAndBurial';
import {
  Moon, Ambulance, MapPin, Package, MessageCircle, Printer,
  Trash2, Edit3, AlertTriangle, Lock, LogIn,
  Search, Volume2, VolumeX, HeartHandshake,
  DollarSign, BellRing, Users, Plus, X, Calculator,
  Home, UserMinus, UploadCloud, Image, ExternalLink,
  Share2, Download, Check
} from 'lucide-react';

const RELATIONSHIP_OPTIONS = [
  'أب', 'أم', 'زوج', 'زوجة', 'ابن', 'ابنة', 'أخ', 'أخت',
  'جد', 'جدة', 'عم / عمة', 'خال / خالة', 'قريب من العائلة', 'حالة رعوية تابعة لي'
];

const HALL_PURPOSES = [
  { id: 'third_day', label: '🕊️ صلاة الثالث' },
  { id: 'evening_condolence', label: '🕯️ عزاء مسائي (تقبل التعازي)' },
  { id: 'forty_mass', label: '✝️ استقبال المعزين بعد قداس الأربعين' },
  { id: 'annual_mass', label: '🌿 استقبال المعزين بعد القداس السنوي' },
  { id: 'funeral_reception', label: '💒 صلاة التجنيز واستقبال الأسرة' }
];

const MASS_ORDER_OPTIONS = [
  'القداس الأول',
  'القداس الثاني',
  'القداس الثالث'
];

const ALTAR_OPTIONS = [
  'المذبح الرئيسي',
  'المذبح البحري',
  'المذبح القبلي',
  'مذبح السيدة العذراء مريم',
  'مذبح الشهيد مار جرجس',
  'مذبح آخر'
];

const VIRGIN_MARY_IMAGE_CANDIDATES = [
  '/virgin-mary.png',
  '/virgin-mary.jpg',
  '/images/virgin-mary.png',
  '/images/virgin-mary.jpg',
  '/st-mary.png',
  '/st-mary.jpg'
];

export function suggestLiturgicalRites(timeStr = '') {
  if (!timeStr) {
    return {
      isNight: false,
      rites: 'صلاة التجنيز بالكنيسة (يُراعى طقس اليوم: سنوي / صوم / خمسين مقدسة).'
    };
  }
  const hour = Number(timeStr.split(':')[0] || 0);
  if (hour >= 18 || hour < 5) {
    return {
      isNight: true,
      rites:
        '🌙 وفاة مسائية/ليلية: يُصلى صلاة نصف الليل والتسبحة وتلاوة المزامير بجوار المنتقل مع تجهيز الجثمان، وتُقام صلاة التجنيز صباح اليوم التالي بعد القداس الإلهي (حسب الطقس السنوي أو الخمسين).'
    };
  }
  if (hour >= 5 && hour < 12) {
    return {
      isNight: false,
      rites:
        '☀️ وفاة صباحية: يُصلى القداس الإلهي وتُقام صلاة التجنيز في نفس اليوم ظهراً/عصراً (حسب الترتيب مع الأسرة والطقس الكنسي).'
    };
  }
  return {
    isNight: false,
    rites:
      '🌤️ وفاة بعد الظهر: تُصلى صلاة عشية والمزامير، وتُقام صلاة التجنيز عصراً في نفس اليوم أو صباح الغد بعد القداس الإلهي.'
  };
}

export function canUserReportDeath(user) {
  if (!user?.id) return false;
  if (
    ['admin', 'priest', 'parent', 'head_servant', 'vice_head_servant', 'servant', 'meeting_servant', 'mercy_servant'].includes(user.role) ||
    Boolean(user.permissions?.manage_joseph)
  ) {
    return true;
  }

  if (user.dob) {
    const birth = new Date(user.dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 15;
  }

  const stage = `${user.detailed_stage || ''} ${user.service_stage || ''}`;
  if (/(حضانة|ابتدائي|إعدادي)/.test(stage)) return false;

  return true;
}

function buildObituaryShareText(c) {
  const lines = [
    '✝ «أَنَا هُوَ الْقِيَامَةُ وَالْحَيَاةُ. مَنْ آمَنَ بِي وَلَوْ مَاتَ فَسَيَحْيَا» (يو 11: 25)',
    '',
    'انتقل إلى الأمجاد السماوية:',
    `🕊️ *${c.deceased_name || ''}*`,
    ''
  ];

  if (c.funeral_date || c.funeral_time) {
    lines.push(`⛪ *صلاة التجنيز:* ${c.funeral_date || ''} ${c.funeral_time ? `الساعة ${c.funeral_time}` : ''}`.trim());
  }

  if (c.death_place_type || c.death_place_details) {
    lines.push(`🚐 *الخرجة / التحرك:* ${c.death_place_type || ''} ${c.death_place_details ? `— ${c.death_place_details}` : ''}`.trim());
  }

  if (c.burial_location_name) {
    lines.push(`📍 *الدفن:* ${c.burial_location_name}`);
  }

  if (c.needs_hall && c.hall_name) {
    const hallInfo = [
      c.hall_purpose || '',
      c.hall_date || '',
      c.hall_slot || ''
    ].filter(Boolean).join(' • ');
    lines.push(`🕯️ *العزاء / القاعة:* ${c.hall_name}${hallInfo ? ` (${hallInfo})` : ''}`);
  }

  lines.push('', 'المسيح يعزي الأسرة وجميع محبيهم.');
  return lines.join('\n');
}

function buildMemorialShareText(m) {
  const lines = [
    '✝ «طُوبَى لِلَّذِينَ يَمُوتُونَ فِي الرَّبِّ مُنْذُ الآنَ» (رؤ 14: 13)',
    '',
    `🕯️ *${m.memorial_type || 'ذكرى الأربعين'}*`,
    `🕊️ *${m.deceased_name || ''}*`,
    ''
  ];

  if (m.church_name) {
    lines.push(`⛪ *الكنيسة:* ${m.church_name}`);
  }
  if (m.mass_order || m.altar_name) {
    const subMass = [m.mass_order, m.altar_name ? `على ${m.altar_name}` : ''].filter(Boolean).join(' — ');
    lines.push(`✝ *القداس:* ${subMass}`);
  }
  if (m.mass_date || m.mass_time) {
    lines.push(`🕒 *الميعاد:* ${m.mass_date || ''} ${m.mass_time ? `الساعة ${m.mass_time}` : ''}`.trim());
  }
  if (m.needs_hall && m.hall_name) {
    lines.push(`🏛️ *الاستقبال / القاعة:* ${m.hall_name} ${m.hall_slot ? `(${m.hall_slot})` : ''}`.trim());
  }

  lines.push('', 'اذكرونا في صلواتكم • المسيح يعزي الأسرة وجميع محبيهم.');
  return lines.join('\n');
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = String(text || '').split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = testLine;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawVirginMaryIllustrationOnCanvas(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#fff8ea';
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 20);
  ctx.fill();
  ctx.stroke();

  const cx = x + w / 2;
  const topY = y + 22;

  // هالة ذهبية
  ctx.strokeStyle = '#e0b13b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, topY + 42, 34, 0, Math.PI * 2);
  ctx.stroke();

  // رداء السيدة العذراء (أزرق سماوي وذهبي)
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.moveTo(cx - 56, y + h - 42);
  ctx.quadraticCurveTo(cx - 46, topY + 66, cx, topY + 66);
  ctx.quadraticCurveTo(cx + 46, topY + 66, cx + 56, y + h - 42);
  ctx.closePath();
  ctx.fill();

  // وشاح ذهبي علوي
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(cx, topY + 42, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(cx, topY + 42, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#4a0e13';
  ctx.font = 'bold 21px sans-serif';
  ctx.fillText('السيدة العذراء مريم', cx, y + h - 22);
  ctx.restore();
}

function loadOptionalImage(url) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function downloadObituaryCardImage(c) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#2b090d');
  grad.addColorStop(0.35, '#4a0e13');
  grad.addColorStop(0.35, '#fbf7f0');
  grad.addColorStop(1, '#f4ede0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 6;
  ctx.strokeRect(32, 32, canvas.width - 64, canvas.height - 64);

  ctx.fillStyle = '#f3d27a';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText('✝', canvas.width / 2, 105);

  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('انتقل إلى الأمجاد السماوية', canvas.width / 2, 165);

  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('«أَنَا هُوَ الْقِيَامَةُ وَالْحَيَاةُ. مَنْ آمَنَ بِي وَلَوْ مَاتَ فَسَيَحْيَا» (يو 11: 25)', canvas.width / 2, 225);

  ctx.fillStyle = '#4a0e13';
  ctx.font = 'bold 52px sans-serif';
  const nameLines = wrapCanvasText(ctx, c.deceased_name || '', 900);
  let y = 445;
  nameLines.forEach(line => {
    ctx.fillText(line, canvas.width / 2, y);
    y += 64;
  });

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(220, y + 6);
  ctx.lineTo(canvas.width - 220, y + 6);
  ctx.stroke();

  y += 58;

  const details = [];
  if (c.funeral_date || c.funeral_time) {
    details.push(`صلاة التجنيز: ${c.funeral_date || ''} ${c.funeral_time ? `— الساعة ${c.funeral_time}` : ''}`.trim());
  }
  if (c.death_place_type || c.death_place_details) {
    details.push(`الخرجة / التحرك: ${c.death_place_type || ''} ${c.death_place_details ? `(${c.death_place_details})` : ''}`.trim());
  }
  if (c.burial_location_name) {
    details.push(`الدفن: ${c.burial_location_name}`);
  }
  if (c.needs_hall && c.hall_name) {
    const hallExtra = [c.hall_purpose, c.hall_date, c.hall_slot].filter(Boolean).join(' • ');
    details.push(`العزاء / القاعة: ${c.hall_name}${hallExtra ? ` — ${hallExtra}` : ''}`);
  }

  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 28px sans-serif';
  details.forEach(item => {
    const wrapped = wrapCanvasText(ctx, `• ${item}`, 880);
    wrapped.forEach(line => {
      ctx.fillText(line, canvas.width / 2, y);
      y += 42;
    });
    y += 10;
  });

  ctx.fillStyle = '#7a1c24';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('المسيح يعزي الأسرة وجميع محبيهم • خدمة يوسف الرامي', canvas.width / 2, canvas.height - 72);

  const link = document.createElement('a');
  const safeName = (c.deceased_name || 'obituary').replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g, '_');
  link.download = `نعي_${safeName}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

async function downloadMemorialCardImage(m) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#3b0b11');
  grad.addColorStop(0.24, '#5c121a');
  grad.addColorStop(0.24, '#fcf8f2');
  grad.addColorStop(1, '#f3eadb');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('✝', canvas.width / 2, 74);

  ctx.fillStyle = '#fffbeb';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(m.memorial_type || 'ذكرى الأربعين', canvas.width / 2, 122);

  ctx.fillStyle = '#f3d27a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('«طُوبَى لِلَّذِينَ يَمُوتُونَ فِي الرَّبِّ مُنْذُ الآنَ» (رؤ 14: 13)', canvas.width / 2, 165);

  // الجنب الشمال: صورة السيدة العذراء مريم
  let maryImg = null;
  for (const candidate of VIRGIN_MARY_IMAGE_CANDIDATES) {
    // eslint-disable-next-line no-await-in-loop
    maryImg = await loadOptionalImage(candidate);
    if (maryImg) break;
  }

  if (maryImg) {
    ctx.save();
    ctx.fillStyle = '#fff8ea';
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(75, 295, 230, 290, 20);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(83, 303, 214, 240, 14);
    ctx.clip();
    ctx.drawImage(maryImg, 83, 303, 214, 240);
    ctx.restore();

    ctx.fillStyle = '#4a0e13';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('السيدة العذراء مريم', 190, 570);
  } else {
    drawVirginMaryIllustrationOnCanvas(ctx, 75, 295, 230, 290);
  }

  // المنتصف: ذكرى الأربعين واسم المنتقل
  ctx.fillStyle = '#7a1c24';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(m.memorial_type || 'ذكرى الأربعين', canvas.width / 2, 345);

  ctx.fillStyle = '#4a0e13';
  ctx.font = 'bold 48px sans-serif';
  const nameLines = wrapCanvasText(ctx, m.deceased_name || '', 440);
  let y = 420;
  nameLines.forEach(line => {
    ctx.fillText(line, canvas.width / 2, y);
    y += 58;
  });

  // الجنب اليمين: الصليب والترحيم
  ctx.fillStyle = '#fff9eb';
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(775, 295, 230, 290, 20);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#7a1c24';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText('✝', 890, 415);
  ctx.fillStyle = '#4a0e13';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('صلاة وترحيم', 890, 475);
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('على المذبح المقدس', 890, 512);

  // تفاصيل القداس الإلهي والكنيسة والقداس والمذبح والساعة
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 27px sans-serif';
  let infoY = 665;

  if (m.church_name) {
    ctx.fillText(`الكنيسة: ${m.church_name}`, canvas.width / 2, infoY);
    infoY += 46;
  }

  const massDetails = [
    m.mass_order || 'القداس الأول',
    m.altar_name ? `على ${m.altar_name}` : ''
  ].filter(Boolean).join(' — ');
  ctx.fillText(`القداس الإلهي: ${massDetails}`, canvas.width / 2, infoY);
  infoY += 46;

  if (m.mass_date || m.mass_time) {
    ctx.fillText(
      `التاريخ والساعة: ${m.mass_date || ''} ${m.mass_time ? `— الساعة ${m.mass_time}` : ''}`.trim(),
      canvas.width / 2,
      infoY
    );
    infoY += 46;
  }

  if (m.needs_hall && m.hall_name) {
    ctx.fillText(
      `الاستقبال / القاعة: ${m.hall_name} ${m.hall_slot ? `(${m.hall_slot})` : ''}`.trim(),
      canvas.width / 2,
      infoY
    );
  }

  ctx.fillStyle = '#7a1c24';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('اذكرونا في صلواتكم • المسيح يعزي الأسرة وجميع محبيهم', canvas.width / 2, canvas.height - 68);

  const link = document.createElement('a');
  const safeName = (m.deceased_name || 'memorial').replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g, '_');
  link.download = `ترحيم_${safeName}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function VirginMaryCardBox({ compact = false }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [fallbackMode, setFallbackMode] = useState(false);

  const currentSrc = !fallbackMode ? VIRGIN_MARY_IMAGE_CANDIDATES[imgIndex] : null;

  return (
    <div className="bg-[#fff8ea] border-2 border-amber-400 rounded-2xl p-3 flex flex-col items-center justify-center text-center shadow-sm">
      {currentSrc ? (
        <img
          src={currentSrc}
          alt="السيدة العذراء مريم"
          onError={() => {
            if (imgIndex + 1 < VIRGIN_MARY_IMAGE_CANDIDATES.length) {
              setImgIndex(imgIndex + 1);
            } else {
              setFallbackMode(true);
            }
          }}
          className={`${compact ? 'w-20 h-24' : 'w-28 h-32'} object-cover rounded-xl border border-amber-300 mb-1.5`}
        />
      ) : (
        <div className={`${compact ? 'w-20 h-24' : 'w-28 h-32'} rounded-xl bg-gradient-to-b from-amber-100 to-blue-100 border border-amber-300 flex flex-col items-center justify-center mb-1.5 relative`}>
          <span className="text-lg">✨👑✨</span>
          <span className="text-2xl font-black text-blue-900">✝</span>
          <span className="text-[10px] font-bold text-amber-950 mt-0.5">أيقونة العذراء</span>
        </div>
      )}
      <div className="font-black text-xs md:text-sm text-[#4a0e13]">السيدة العذراء مريم</div>
      <div className="text-[11px] font-bold text-amber-900">والدة الإله</div>
    </div>
  );
}

export default function JosephArimatheaManager({
  currentUser,
  users = [],
  todayISO,
  onOpenWhatsApp,
  onRequireLogin,
  onNavigateToDonations
}) {
  const isLoggedIn = Boolean(currentUser?.id);
  const isAdminUser = currentUser?.role === 'admin';
  const isPriest = currentUser?.role === 'priest';

  const isFinanceAuthorized = Boolean(
    isAdminUser ||
    isPriest ||
    currentUser?.permissions?.view_financials === true ||
    currentUser?.permissions?.is_church_board ||
    currentUser?.permissions?.church_committee
  );

  const isChurchCouncil = Boolean(
    isAdminUser ||
    isPriest ||
    currentUser?.permissions?.is_church_board ||
    currentUser?.permissions?.church_committee ||
    currentUser?.role === 'mercy_servant'
  );

  const isStaff = Boolean(
    currentUser &&
    (['admin', 'priest', 'mercy_servant'].includes(currentUser.role) || Boolean(currentUser.permissions?.manage_joseph) || isChurchCouncil)
  );

  const canEditCases = Boolean(
    currentUser &&
    (isAdminUser ||
      isPriest ||
      currentUser.permissions?.joseph_can_edit === true ||
      isChurchCouncil ||
      (currentUser.permissions?.joseph_can_edit === undefined &&
        (currentUser.role === 'mercy_servant' || Boolean(currentUser.permissions?.can_edit_members))))
  );

  const canReport = canUserReportDeath(currentUser);

  const [systemUsers, setSystemUsers] = useState(users);
  useEffect(() => {
    if (users && users.length > 0) setSystemUsers(users);
  }, [users]);

  const [activeMainTab, setActiveMainTab] = useState('cases');
  const [adminSubTab, setAdminSubTab] = useState('cases');

  const [cases, setCases] = useState([]);
  const [memorialRequests, setMemorialRequests] = useState([]);
  const [burialLocations, setBurialLocations] = useState([]);
  const [caskets, setCaskets] = useState([]);
  const [churchHalls, setChurchHalls] = useState([]);
  const [audioTracks, setAudioTracks] = useState([]);
  const [activeTrack, setActiveTrack] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const [instapayAccount, setInstapayAccount] = useState('church.donation@instapay');
  const [instapayPhone, setInstapayPhone] = useState('01200000000');
  const [isSavingInstapay, setIsSavingInstapay] = useState(false);

  const [newHallName, setNewHallName] = useState('');
  const [newHallCapacity, setNewHallCapacity] = useState('');
  const [newHallFee, setNewHallFee] = useState('');

  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);

  const [obituaryCardCase, setObituaryCardCase] = useState(null);
  const [memorialCardItem, setMemorialCardItem] = useState(null);
  const [printMemorialCard, setPrintMemorialCard] = useState(null);
  const [copiedObituary, setCopiedObituary] = useState(false);
  const [copiedMemorial, setCopiedMemorial] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [liveToast, setLiveToast] = useState(null);

  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('joseph_global_volume');
    return saved ? Number(saved) : 25;
  });

  const audioRef = useRef(null);

  const [showDeathForm, setShowDeathForm] = useState(isLoggedIn && !isStaff && canReport);
  const [showMemorialForm, setShowMemorialForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingMemorialId, setEditingMemorialId] = useState(null);
  const [printCase, setPrintCase] = useState(null);
  const [printMemorialReceipt, setPrintMemorialReceipt] = useState(null);
  const [filterMassDate, setFilterMassDate] = useState(todayISO);
  const [sentNoticeSuccess, setSentNoticeSuccess] = useState(false);

  const [statsWorkerName, setStatsWorkerName] = useState('');
  const [statsStartDate, setStatsStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [statsEndDate, setStatsEndDate] = useState(todayISO);
  const [feePerTrip, setFeePerTrip] = useState(150);

  const nowTime = new Date().toTimeString().slice(0, 5);
  const defaultRiteInfo = suggestLiturgicalRites(nowTime);

  const emptyDeathCase = {
    deceased_user_id: '',
    deceased_name: '',
    deceased_age: '',
    relationship_degree: 'أب',
    is_confirmed: false,
    death_date: todayISO,
    death_time: nowTime,
    is_night_death: defaultRiteInfo.isNight,
    death_place_type: 'البيت',
    death_place_details: '',
    family_contact_name: currentUser?.full_name || '',
    family_contact_phone: currentUser?.phone || '',
    liturgical_rites: defaultRiteInfo.rites,
    funeral_date: todayISO,
    funeral_time: '12:00',
    casket_id: '',
    casket_name: '',
    burial_location_id: '',
    burial_location_name: '',
    transport_fee: 0,
    driver_name: '',
    driver_phone: '',
    assistants: [{ id: '', name: '', phone: '' }],
    assistant_worker_name: '',
    assistant_worker_phone: '',
    needs_hall: false,
    hall_id: '',
    hall_name: '',
    hall_fee: 0,
    hall_purpose: 'عزاء مسائي (تقبل التعازي)',
    hall_date: todayISO,
    hall_slot: 'مسائي (6:00 م إلى 10:00 م)',
    service_condolence: true,
    service_visitation: true,
    service_aid: false,
    family_services_notes: '',
    status: 'جديد / طارئ'
  };

  const emptyMemorial = {
    deceased_name: '',
    memorial_type: 'ذكرى الأربعين',
    church_name: 'كنيسة السيدة العذراء مريم',
    mass_order: 'القداس الأول',
    altar_name: 'المذبح الرئيسي',
    mass_date: todayISO,
    mass_time: '08:00',
    requester_name: currentUser?.full_name || '',
    requester_phone: currentUser?.phone || '',
    relationship: 'أب',
    is_mercy_case: false,
    notes: '',
    donation_amount: 0,
    payment_method: 'InstaPay',
    instapay_ref: '',
    receipt_image_url: '',
    receipt_serial: '',
    needs_hall: false,
    hall_id: '',
    hall_name: '',
    hall_fee: 0,
    hall_purpose: 'استقبال المعزين بعد قداس الأربعين',
    hall_slot: 'صباحي بعد القداس الإلهي مباشرة',
    status: 'معلق'
  };

  const [deathForm, setDeathForm] = useState(emptyDeathCase);
  const [memForm, setMemForm] = useState(emptyMemorial);

  const loadData = async () => {
    const [bl, fk, au, hl, st] = await Promise.all([
      supabase.from('burial_locations').select('*').eq('is_active', true).order('location_name', { ascending: true }),
      supabase.from('funeral_caskets').select('*').order('casket_name', { ascending: true }),
      supabase.from('joseph_audio_tracks').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('church_hall_settings').select('*').order('rental_fee', { ascending: false }),
      supabase.from('church_general_settings').select('*')
    ]);

    if (bl.data) setBurialLocations(bl.data);
    if (fk.data) setCaskets(fk.data);
    if (hl.data) setChurchHalls(hl.data);
    if (st.data) {
      const acc = st.data.find(x => x.key === 'instapay_account_id');
      const ph = st.data.find(x => x.key === 'instapay_phone_number');
      if (acc) setInstapayAccount(acc.value);
      if (ph) setInstapayPhone(ph.value);
    }
    if (au.data && au.data.length > 0) {
      setAudioTracks(au.data);
      const chosen = au.data.find(x => x.is_default && x.audio_url) || au.data.find(x => x.audio_url) || au.data[0];
      setActiveTrack(chosen);

      const trackVol = localStorage.getItem(`joseph_vol_${chosen?.id}`) || chosen?.default_volume;
      if (trackVol) setVolume(Number(trackVol));
    }

    if ((!users || users.length === 0) && currentUser?.id) {
      const uRes = await supabase.from('church_users').select('*').order('full_name', { ascending: true });
      if (uRes.data) setSystemUsers(uRes.data);
    }

    if (currentUser?.id) {
      let csQuery = supabase.from('joseph_arimathea_cases').select('*').order('created_at', { ascending: false });
      if (!isStaff) csQuery = csQuery.eq('reported_by_user_id', currentUser.id);
      const cs = await csQuery;
      if (cs.data) setCases(cs.data);

      let memQuery = supabase.from('joseph_memorial_requests').select('*').order('mass_date', { ascending: true });
      if (!isStaff && !isChurchCouncil) {
        memQuery = memQuery.eq('created_by', currentUser.id);
      }
      const ms = await memQuery;
      if (ms.data) setMemorialRequests(ms.data);
    }
  };

  useEffect(() => {
    loadData();
    if (currentUser?.id) {
      setShowDeathForm(!isStaff && canUserReportDeath(currentUser));
      setActiveMainTab('cases');
      setAdminSubTab('cases');
      setDeathForm(prev => ({
        ...prev,
        family_contact_name: prev.family_contact_name || currentUser.full_name || '',
        family_contact_phone: prev.family_contact_phone || currentUser.phone || ''
      }));
      setMemForm(prev => ({
        ...prev,
        requester_name: prev.requester_name || currentUser.full_name || '',
        requester_phone: prev.requester_phone || currentUser.phone || ''
      }));
    }
  }, [currentUser?.id, isStaff]);

  const notifyPriestsAndCouncil = async ({ title, message, type, targetId }) => {
    const alertPayload = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      title,
      message,
      type,
      targetId,
      senderId: currentUser?.id,
      senderName: currentUser?.full_name || currentUser?.username || 'مستخدم',
      created_at: new Date().toISOString()
    };

    try {
      const channel = supabase.channel('joseph-realtime-notifications');
      await channel.subscribe();
      await channel.send({
        type: 'broadcast',
        event: 'new_joseph_alert',
        payload: alertPayload
      });
      supabase.removeChannel(channel);
    } catch (e) {
      console.warn('Realtime broadcast error:', e);
    }

    const priests = systemUsers.filter(u => u.role === 'priest');
    if (priests.length > 0) {
      try {
        const rows = priests.map(p => ({
          user_id: p.id,
          title,
          message,
          type,
          reference_id: targetId || null,
          is_read: false
        }));
        await supabase.from('church_notifications').insert(rows);
      } catch (err) {
        console.warn('Notification insert skipped:', err?.message);
      }
    }
  };

  useEffect(() => {
    if (!currentUser?.id || (!isPriest && !isStaff && !isChurchCouncil)) return;

    const fetchStoredNotifications = async () => {
      try {
        const { data } = await supabase
          .from('church_notifications')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(20);
        if (data && data.length > 0) setNotifications(data);
      } catch (_) {}
    };
    fetchStoredNotifications();

    const handleIncomingAlert = (alertObj) => {
      if (alertObj.senderId && alertObj.senderId === currentUser.id) return;

      setNotifications(prev => {
        if (prev.some(n => n.id === alertObj.id)) return prev;
        return [{ ...alertObj, is_read: false }, ...prev];
      });

      setLiveToast(alertObj);
      setTimeout(() => setLiveToast(null), 9000);

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(alertObj.title, { body: alertObj.message });
      }

      loadData();
    };

    const channel = supabase
      .channel('joseph-realtime-notifications')
      .on('broadcast', { event: 'new_joseph_alert' }, ({ payload }) => {
        if (payload) handleIncomingAlert(payload);
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'joseph_arimathea_cases' },
        (payload) => {
          const row = payload.new;
          if (!row || row.created_by === currentUser.id) return;
          handleIncomingAlert({
            id: `case_${row.id}`,
            title: row.is_night_death ? '🌙 وفاة ليلية جديدة' : '🕊️ بلاغ حالة وفاة جديد',
            message: `المنتقل: ${row.deceased_name} • المُبلّغ: ${row.reported_by_name || 'عضو بالسيستم'}`,
            type: 'cases',
            senderId: row.created_by,
            created_at: row.created_at
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'joseph_memorial_requests' },
        (payload) => {
          const row = payload.new;
          if (!row || row.created_by === currentUser.id) return;
          handleIncomingAlert({
            id: `mem_${row.id}`,
            title: '🕯️ كارت ترحيم جديد بالمذبح',
            message: `المنتقل: ${row.deceased_name} (${row.memorial_type}) • قداس: ${row.mass_date}`,
            type: 'memorials',
            senderId: row.created_by,
            created_at: row.created_at
          });
        }
      )
      .subscribe();

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, isPriest, isStaff, isChurchCouncil]);

  useEffect(() => {
    if (activeTrack?.audio_url && audioRef.current) {
      audioRef.current.load();
      audioRef.current.volume = volume / 100;
      audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => setIsPlayingAudio(false));
    }
  }, [activeTrack?.id, activeTrack?.audio_url]);

  const handleVolumeChange = (newVol) => {
    setVolume(newVol);
    if (audioRef.current) audioRef.current.volume = newVol / 100;
    localStorage.setItem('joseph_global_volume', String(newVol));
    if (activeTrack?.id) localStorage.setItem(`joseph_vol_${activeTrack.id}`, String(newVol));
  };

  const renderBackgroundAudio = () => (
    activeTrack?.audio_url ? (
      <audio
        ref={audioRef}
        src={activeTrack.audio_url}
        autoPlay
        loop
        onPlay={() => {
          if (audioRef.current) audioRef.current.volume = volume / 100;
          setIsPlayingAudio(true);
        }}
        onPause={() => setIsPlayingAudio(false)}
        className="hidden"
      />
    ) : null
  );

  const renderAudioControlIcon = () => {
    if (!activeTrack?.audio_url) return null;
    return (
      <div className="flex items-center gap-2 bg-white/10 px-2.5 py-1.5 rounded-2xl border border-white/20">
        {audioTracks.filter(t => t.audio_url).length > 1 && (
          <select
            className="px-2 py-1 rounded-xl bg-black/40 border border-white/20 text-[11px] font-bold text-amber-100 cursor-pointer"
            value={activeTrack?.id || ''}
            onChange={e => {
              const tr = audioTracks.find(x => x.id === e.target.value);
              if (tr) {
                setActiveTrack(tr);
                const trVol = localStorage.getItem(`joseph_vol_${tr.id}`) || tr.default_volume;
                if (trVol) handleVolumeChange(Number(trVol));
              }
            }}
          >
            {audioTracks.filter(t => t.audio_url).map(tr => (
              <option key={tr.id} value={tr.id} className="text-gray-900">{tr.title}</option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={() => {
            if (!audioRef.current) return;
            if (isPlayingAudio) {
              audioRef.current.pause();
              setIsPlayingAudio(false);
            } else {
              audioRef.current.volume = volume / 100;
              audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => {});
            }
          }}
          className="p-1.5 hover:bg-white/20 text-amber-200 rounded-xl cursor-pointer"
          title={isPlayingAudio ? 'كتم الصوت' : 'تشغيل الصوت'}
        >
          {isPlayingAudio ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        <div className="flex items-center gap-1.5">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={volume}
            onChange={e => handleVolumeChange(Number(e.target.value))}
            className="w-16 sm:w-20 accent-amber-400 cursor-pointer"
            title={`توطية / تعلية الصوت: ${volume}%`}
          />
          <span className="text-[10px] text-amber-200 font-black w-6 text-center">{volume}%</span>
        </div>
      </div>
    );
  };

  const handleUploadReceiptImage = async (file) => {
    if (!file) return;
    try {
      setUploadingReceipt(true);
      const ext = file.name.split('.').pop();
      const fileName = `instapay_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

      const { error } = await supabase.storage.from('receipts').upload(fileName, file);
      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
      setMemForm(prev => ({ ...prev, receipt_image_url: publicUrlData.publicUrl }));
      alert('✅ تم رفع صورة الإيصال بنجاح!');
    } catch (err) {
      alert('خطأ أثناء رفع الصورة: ' + err.message);
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSaveInstapaySettings = async (e) => {
    e.preventDefault();
    if (!isAdminUser) return;
    setIsSavingInstapay(true);
    try {
      await Promise.all([
        supabase.from('church_general_settings').upsert({ key: 'instapay_account_id', value: instapayAccount.trim() }),
        supabase.from('church_general_settings').upsert({ key: 'instapay_phone_number', value: instapayPhone.trim() })
      ]);
      alert('✅ تم تحديث بيانات حساب إنستاباي المعتمد بنجاح!');
    } catch (err) {
      alert('خطأ أثناء حفظ إعدادات إنستاباي: ' + err.message);
    } finally {
      setIsSavingInstapay(false);
    }
  };

  const handleShareObituaryText = async (c) => {
    const text = buildObituaryShareText(c);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `انتقل إلى الأمجاد السماوية — ${c.deceased_name}`,
          text
        });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedObituary(true);
      setTimeout(() => setCopiedObituary(false), 3000);
    } catch (_) {
      alert(text);
    }
  };

  const handleSendObituaryWhatsApp = (c) => {
    const text = buildObituaryShareText(c);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareMemorialText = async (m) => {
    const text = buildMemorialShareText(m);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${m.memorial_type || 'ذكرى الأربعين'} — ${m.deceased_name}`,
          text
        });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMemorial(true);
      setTimeout(() => setCopiedMemorial(false), 3000);
    } catch (_) {
      alert(text);
    }
  };

  const handleSendMemorialWhatsApp = (m) => {
    const text = buildMemorialShareText(m);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (!isLoggedIn) {
    const openCaskets = caskets.filter(c => c.status === 'متاح');
    return (
      <div className="space-y-4 text-sm md:text-base" dir="rtl">
        {renderBackgroundAudio()}

        <div className="bg-gradient-to-r from-slate-900 to-[#4a0e13] text-white p-6 rounded-3xl shadow flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-lg md:text-xl font-black text-amber-200">🕊️ خدمة يوسف الرامي — الخدمات المتاحة</h3>
            <p className="text-xs md:text-sm text-white/85 mt-1">تجهيز المنتقلين، ترتيب الصلوات، حجز قاعات العزاء، الصناديق، والانتقال للمدافن</p>
          </div>
          <div className="flex items-center gap-2">
            {renderAudioControlIcon()}
            {onRequireLogin && (
              <button
                type="button"
                onClick={onRequireLogin}
                className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#4a0e13] rounded-2xl font-black text-xs md:text-sm flex items-center gap-1.5 cursor-pointer shadow"
              >
                <LogIn size={16} /> تسجيل الدخول لتقديم بيان وفاة أو حجز قاعة
              </button>
            )}
          </div>
        </div>

        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-4 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-amber-950 text-xs md:text-sm font-bold">
            <Lock size={18} className="text-[#7a1c24] shrink-0" />
            <span>لتقديم بيان وفاة، أو حجز قاعة العزاء، أو تقديم كارت ترحيم للمذبح، يجب تسجيل الدخول بحساب ولي الأمر أو البالغين (15 سنة فأكثر).</span>
          </div>
          {onRequireLogin && (
            <button type="button" onClick={onRequireLogin} className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl text-xs font-black cursor-pointer">
              تسجيل الدخول الآن
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-3xl border space-y-3">
            <h4 className="font-black text-[#7a1c24] flex items-center gap-1.5"><MapPin size={18} /> أماكن الدفن المتاحة ورسوم الانتقال ({burialLocations.length})</h4>
            {burialLocations.length === 0 ? (
              <p className="text-xs text-gray-500">لا توجد أماكن دفن مسجلة حالياً.</p>
            ) : (
              <div className="space-y-2">
                {burialLocations.map((b, idx) => (
                  <div key={b.id} className="p-3 bg-gray-50 border rounded-2xl flex justify-between items-center text-xs md:text-sm">
                    <div>
                      <strong className="text-gray-900 block">{idx + 1}) {b.location_name}</strong>
                      {b.area_address && <span className="text-gray-500 text-xs">{b.area_address}</span>}
                    </div>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-900 rounded-xl font-black">{b.transport_fee} ج.م</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-3xl border space-y-3">
            <h4 className="font-black text-[#7a1c24] flex items-center gap-1.5"><Package size={18} /> الصناديق المتاحة حالياً ({openCaskets.length})</h4>
            {openCaskets.length === 0 ? (
              <p className="text-xs text-gray-500">يرجى التواصل مع لجنة الكنيسة بعد تسجيل الدخول.</p>
            ) : (
              <div className="space-y-2">
                {openCaskets.map(ck => (
                  <div key={ck.id} className="p-3 bg-gray-50 border rounded-2xl flex justify-between items-center text-xs md:text-sm">
                    <div>
                      <strong className="text-gray-900 block">{ck.casket_name}</strong>
                      <span className="text-gray-500 text-xs">المقاس: {ck.casket_size}</span>
                    </div>
                    <span className="px-3 py-1 bg-amber-100 text-amber-950 rounded-xl font-black">
                      {Number(ck.price || 0) === 0 ? 'مجاني / دعم' : `${ck.price} ج.م`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const josephTeamDrivers = systemUsers.filter(u => u.permissions?.joseph_role === 'driver');
  const josephTeamWorkers = systemUsers.filter(u => u.permissions?.joseph_role === 'worker');

  const handleAddAssistant = () => {
    if (deathForm.assistants.length >= 6) return alert('الحد الأقصى 6 فراشين في الخرجة.');
    setDeathForm({
      ...deathForm,
      assistants: [...deathForm.assistants, { id: '', name: '', phone: '' }]
    });
  };

  const handleRemoveAssistant = (index) => {
    if (deathForm.assistants.length <= 1) return;
    const updated = deathForm.assistants.filter((_, idx) => idx !== index);
    setDeathForm({ ...deathForm, assistants: updated });
  };

  const handleAssistantSelect = (index, userId) => {
    const user = systemUsers.find(u => u.id === userId);
    const updated = [...deathForm.assistants];
    if (user) {
      updated[index] = { id: user.id, name: user.full_name, phone: user.phone || '' };
    } else {
      updated[index] = { id: '', name: '', phone: '' };
    }
    setDeathForm({ ...deathForm, assistants: updated });
  };

  const handleAssistantCustomChange = (index, field, value) => {
    const updated = [...deathForm.assistants];
    updated[index][field] = value;
    setDeathForm({ ...deathForm, assistants: updated });
  };

  const handleStartEditCase = (c) => {
    const parsedAssistants = Array.isArray(c.assistants) && c.assistants.length > 0
      ? c.assistants
      : c.assistant_worker_name
        ? [{ id: '', name: c.assistant_worker_name, phone: c.assistant_worker_phone || '' }]
        : [{ id: '', name: '', phone: '' }];

    setEditingId(c.id);
    setDeathForm({
      ...emptyDeathCase,
      ...c,
      deceased_user_id: c.deceased_user_id || '',
      casket_id: c.casket_id || '',
      burial_location_id: c.burial_location_id || '',
      hall_id: c.hall_id || '',
      assistants: parsedAssistants,
      is_confirmed: true
    });
    setActiveMainTab('cases');
    setShowMemorialForm(false);
    setShowDeathForm(true);
  };

  const handleSaveCase = async (e) => {
    e.preventDefault();
    if (!canReport) return alert('تقديم بيان حالة الوفاة متاح للبالغين وأولياء الأمور فقط.');
    if (!deathForm.is_confirmed) return alert('يرجى التأكيد والإقرار بصحة البيانات أولاً.');
    if (!deathForm.deceased_name.trim()) return alert('اختر الشخص المنتقل أو اكتب اسمه بالكامل.');

    const validAssistants = (deathForm.assistants || []).filter(a => a.name && a.name.trim() !== '');
    const oldCase = editingId ? cases.find(c => c.id === editingId) : null;

    const payload = {
      ...deathForm,
      reported_by_user_id: oldCase?.reported_by_user_id || currentUser.id,
      reported_by_name: oldCase?.reported_by_name || currentUser.full_name || currentUser.username,
      deceased_user_id: deathForm.deceased_user_id || null,
      casket_id: deathForm.casket_id || null,
      burial_location_id: deathForm.burial_location_id || null,
      transport_fee: Number(deathForm.transport_fee || 0),
      funeral_date: deathForm.funeral_date || null,
      assistants: validAssistants,
      assistant_worker_name: validAssistants.length > 0 ? validAssistants.map(a => a.name).join('، ') : deathForm.assistant_worker_name || '',
      assistant_worker_phone: validAssistants.length > 0 ? validAssistants[0].phone : deathForm.assistant_worker_phone || '',
      needs_hall: Boolean(deathForm.needs_hall),
      hall_id: (deathForm.needs_hall && deathForm.hall_id) ? deathForm.hall_id : null,
      hall_name: (deathForm.needs_hall && deathForm.hall_name) ? deathForm.hall_name : null,
      hall_fee: deathForm.needs_hall ? Number(deathForm.hall_fee || 0) : 0,
      hall_purpose: deathForm.needs_hall ? deathForm.hall_purpose : null,
      hall_date: deathForm.needs_hall ? deathForm.hall_date : null,
      hall_slot: deathForm.needs_hall ? deathForm.hall_slot : null,
      priest_id: oldCase?.priest_id ?? (currentUser.role === 'priest' ? currentUser.id : null),
      created_by: oldCase?.created_by || currentUser.id
    };

    let saved;
    if (editingId && isStaff && canEditCases) {
      const { id, created_at, ...clean } = payload;
      const { data, error } = await supabase.from('joseph_arimathea_cases').update(clean).eq('id', editingId).select().single();
      if (error) return alert('خطأ: ' + error.message);
      saved = data;
      setCases(cases.map(c => (c.id === editingId ? data : c)));
    } else {
      const { data, error } = await supabase.from('joseph_arimathea_cases').insert([payload]).select().single();
      if (error) return alert('خطأ: ' + error.message);
      saved = data;
      setCases([data, ...cases]);
    }

    if (oldCase?.casket_id && oldCase.casket_id !== payload.casket_id) {
      await supabase.from('funeral_caskets').update({ status: 'متاح' }).eq('id', oldCase.casket_id);
    }
    if (payload.casket_id) {
      const nextCasketStatus = payload.status === 'تم الدفن والمتابعة' ? 'تم التسليم' : 'محجوز';
      await supabase.from('funeral_caskets').update({ status: nextCasketStatus }).eq('id', payload.casket_id);
    }

    logActivity({
      user: currentUser,
      actionType: editingId ? 'تعديل_بيان_يوسف_الرامي' : 'إرسال_بيان_وفاة_يوسف_الرامي',
      targetTable: 'joseph_arimathea_cases',
      targetId: saved?.id,
      description: `${deathForm.is_night_death ? '🌙 وفاة بالليل' : 'بيان انتقال'}: ${deathForm.deceased_name} • حجز القاعة: (${deathForm.needs_hall ? deathForm.hall_name : 'بدون'})`
    });

    if (!editingId) {
      await notifyPriestsAndCouncil({
        title: deathForm.is_night_death ? '🌙 وفاة ليلية جديدة مسجلة' : '🕊️ بيان حالة انتقال جديدة',
        message: `المنتقل: ${deathForm.deceased_name} • سجّلها: ${currentUser.full_name || currentUser.username} • ميعاد الصلاة: ${deathForm.funeral_date} (${deathForm.funeral_time})`,
        type: 'cases',
        targetId: saved?.id
      });
    }

    await loadData();
    setSentNoticeSuccess(true);
    setObituaryCardCase(saved || payload);
    if (isStaff) setShowDeathForm(false);
    setEditingId(null);
    setDeathForm(emptyDeathCase);
  };

  const handleDeleteCase = async (c) => {
    if (!isStaff || !canEditCases || !confirm(`حذف بيان المنتقل "${c.deceased_name}"؟`)) return;
    if (c.casket_id) {
      await supabase.from('funeral_caskets').update({ status: 'متاح' }).eq('id', c.casket_id);
    }
    const { error } = await supabase.from('joseph_arimathea_cases').delete().eq('id', c.id);
    if (error) return alert('خطأ أثناء الحذف: ' + error.message);
    if (editingId === c.id) {
      setEditingId(null);
      setDeathForm(emptyDeathCase);
    }
    if (obituaryCardCase?.id === c.id) {
      setObituaryCardCase(null);
    }
    loadData();
  };

  const sendDriverWhatsApp = (c) => {
    const assistantsStr = Array.isArray(c.assistants) && c.assistants.length > 0
      ? c.assistants.map((a, i) => `${i + 1}) ${a.name} (${a.phone || '—'})`).join(' • ')
      : `${c.assistant_worker_name || '—'} (${c.assistant_worker_phone || '—'})`;

    const msg =
      `✝ خدمة يوسف الرامي - بيان خط سير السائق ولجنة الجنازة:\n` +
      `• المنتقل: ${c.deceased_name}\n` +
      `• المُبلّغ: ${c.reported_by_name || c.family_contact_name} (${c.relationship_degree || 'قريب'})\n` +
      `• مكان التحرك (${c.death_place_type}): ${c.death_place_details || '—'}\n` +
      `• صلاة التجنيز بالكنيسة: ${c.funeral_date || c.death_date} الساعة ${c.funeral_time || '—'}\n` +
      `• مكان الدفن: ${c.burial_location_name || '—'}\n` +
      (c.needs_hall ? `• حجز القاعة: ${c.hall_name} (${c.hall_purpose} - ${c.hall_slot})\n` : '') +
      `• رسوم الانتقال: ${c.transport_fee || 0} ج.م\n` +
      `• السائق: ${c.driver_name || '—'} (${c.driver_phone || '—'})\n` +
      `• طاقم الفراشين المرافقين: ${assistantsStr}\n` +
      `• تواصل الأسرة: ${c.family_contact_name} (${c.family_contact_phone})`;

    if (onOpenWhatsApp) {
      onOpenWhatsApp({ name: c.driver_name || 'سائق السيارة', phone: c.driver_phone || '', initialMessage: msg });
    } else if (c.driver_phone) {
      const intl = c.driver_phone.startsWith('0') ? `2${c.driver_phone}` : c.driver_phone;
      window.open(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      alert(msg);
    }
  };

  const generateReceiptSerial = () => {
    const d = new Date();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `REC-${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}-${rand}`;
  };

  const handleStartEditMemorial = (item) => {
    setEditingMemorialId(item.id);
    setMemForm({
      ...emptyMemorial,
      ...item,
      church_name: item.church_name || 'كنيسة السيدة العذراء مريم',
      mass_order: item.mass_order || 'القداس الأول',
      altar_name: item.altar_name || 'المذبح الرئيسي',
      mass_time: item.mass_time || '08:00',
      hall_id: item.hall_id || '',
      hall_name: item.hall_name || '',
      instapay_ref: item.instapay_ref || '',
      receipt_image_url: item.receipt_image_url || ''
    });
    setActiveMainTab('memorials');
    setShowDeathForm(false);
    setShowMemorialForm(true);
  };

  const handleDeleteMemorial = async (item) => {
    if (!isStaff && !isChurchCouncil && !isPriest && item.created_by !== currentUser?.id) {
      return alert('لا تملك صلاحية حذف هذا الكارت.');
    }
    if (!confirm(`حذف كارت الترحيم الخاص بالمنتقل "${item.deceased_name}"؟`)) return;
    const { error } = await supabase.from('joseph_memorial_requests').delete().eq('id', item.id);
    if (error) return alert('خطأ أثناء الحذف: ' + error.message);
    setMemorialRequests(prev => prev.filter(m => m.id !== item.id));
    if (editingMemorialId === item.id) {
      setEditingMemorialId(null);
      setMemForm(emptyMemorial);
      setShowMemorialForm(false);
    }
    if (memorialCardItem?.id === item.id) {
      setMemorialCardItem(null);
    }
  };

  const handleSaveMemorial = async (e) => {
    e.preventDefault();
    if (!memForm.deceased_name.trim()) return alert('اكتب اسم المنتقل للترحيم.');
    if (!memForm.mass_date) return alert('حدد موعد القداس الإلهي لذكر الاسم.');

    const existingMemorial = editingMemorialId ? memorialRequests.find(m => m.id === editingMemorialId) : null;
    const serial = existingMemorial?.receipt_serial || memForm.receipt_serial || generateReceiptSerial();

    const payload = {
      deceased_name: memForm.deceased_name.trim(),
      memorial_type: memForm.memorial_type,
      church_name: memForm.church_name?.trim() || 'كنيسة السيدة العذراء مريم',
      mass_order: memForm.mass_order || 'القداس الأول',
      altar_name: memForm.altar_name?.trim() || 'المذبح الرئيسي',
      mass_date: memForm.mass_date,
      mass_time: memForm.mass_time || '08:00',
      requester_name: memForm.requester_name || '',
      requester_phone: memForm.requester_phone || '',
      relationship: memForm.relationship || '',
      is_mercy_case: Boolean(memForm.is_mercy_case),
      donation_amount: Number(memForm.donation_amount || 0),
      payment_method: memForm.payment_method || 'InstaPay',
      instapay_ref: memForm.instapay_ref?.trim() ? memForm.instapay_ref.trim() : null,
      receipt_image_url: memForm.receipt_image_url || null,
      receipt_serial: serial,
      created_by: existingMemorial?.created_by || currentUser?.id || null,
      status: existingMemorial ? (memForm.status || existingMemorial.status) : ((isPriest || isChurchCouncil) ? 'مقبول (معتمد للمذبح)' : 'معلق'),
      needs_hall: Boolean(memForm.needs_hall),
      hall_id: (memForm.needs_hall && memForm.hall_id) ? memForm.hall_id : null,
      hall_name: (memForm.needs_hall && memForm.hall_name) ? memForm.hall_name : null,
      hall_fee: memForm.needs_hall ? Number(memForm.hall_fee || 0) : 0,
      hall_purpose: memForm.needs_hall ? (memForm.hall_purpose || 'استقبال المعزين بعد قداس الأربعين') : null,
      hall_slot: memForm.needs_hall ? (memForm.hall_slot || null) : null
    };

    if (editingMemorialId) {
      const { id, created_at, ...clean } = payload;
      let { data, error } = await supabase.from('joseph_memorial_requests').update(clean).eq('id', editingMemorialId).select().single();
      if (error && /foreign key|created_by/i.test(error.message)) {
        const retry = await supabase.from('joseph_memorial_requests').update({ ...clean, created_by: null }).eq('id', editingMemorialId).select().single();
        data = retry.data;
        error = retry.error;
      }
      if (error) {
        console.error(error);
        return alert('خطأ في تعديل طلب الترحيم: ' + error.message);
      }

      logActivity({
        user: currentUser,
        actionType: 'تعديل_طلب_ترحيم',
        targetTable: 'joseph_memorial_requests',
        targetId: data?.id || editingMemorialId,
        description: `تعديل ترحيم: ${payload.deceased_name} (${payload.memorial_type}) • الإيصال: ${serial}`
      });

      const updatedItem = { ...(data || payload), id: editingMemorialId };
      setMemorialRequests(prev => prev.map(m => (m.id === editingMemorialId ? updatedItem : m)));
      setMemorialCardItem(updatedItem);
      setEditingMemorialId(null);
      setShowMemorialForm(false);
      setMemForm(emptyMemorial);
      alert('✅ تم تعديل طلب الترحيم وتجهيز كارت الترحيم بنجاح!');
      return;
    }

    let { data, error } = await supabase.from('joseph_memorial_requests').insert([payload]).select().single();
    if (error && /foreign key|created_by/i.test(error.message)) {
      const retry = await supabase.from('joseph_memorial_requests').insert([{ ...payload, created_by: null }]).select().single();
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      console.error(error);
      return alert('خطأ في حفظ طلب الترحيم: ' + error.message);
    }

    logActivity({
      user: currentUser,
      actionType: 'تسجيل_طلب_ترحيم',
      targetTable: 'joseph_memorial_requests',
      targetId: data?.id,
      description: `طلب ترحيم: ${payload.deceased_name} (${payload.memorial_type}) • الإيصال: ${serial}`
    });

    await notifyPriestsAndCouncil({
      title: '🕯️ طلب ترحيم جديد بالقداس الإلهي',
      message: `المنتقل: ${payload.deceased_name} (${payload.memorial_type}) • قداس: ${payload.mass_date} • سجله: ${currentUser.full_name || currentUser.username}`,
      type: 'memorials',
      targetId: data?.id
    });

    const createdItem = {
      ...(data || payload),
      id: data?.id || `mem_${Date.now()}`
    };
    setMemorialRequests(prev => [createdItem, ...prev]);
    setMemorialCardItem(createdItem);
    setPrintMemorialReceipt(createdItem);
    setShowMemorialForm(false);
    setMemForm(emptyMemorial);

    if (payload.status === 'معلق') {
      alert(`✅ تم إرسال طلب الترحيم وتجهيز كارت الترحيم (${createdItem.memorial_type}) للطباعة والمشاركة!`);
    } else {
      alert(`✅ تم اعتماد الترحيم وتثبيته في كشف المذبح وتجهيز كارت الترحيم!\nرقم الإيصال: ${serial}`);
    }
  };

  const handleApproveMemorial = async (item, asMercy = false) => {
    const approverRole = isPriest ? 'أبونا الكاهن' : 'لجنة الكنيسة';
    const updateData = {
      status: 'مقبول (معتمد للمذبح)',
      approved_by_name: currentUser.full_name,
      approved_by_role: approverRole,
      approved_at: new Date().toISOString(),
      is_mercy_case: asMercy ? true : item.is_mercy_case
    };

    const { error } = await supabase.from('joseph_memorial_requests').update(updateData).eq('id', item.id);
    if (error) return alert('خطأ أثناء الاعتماد: ' + error.message);

    setMemorialRequests(memorialRequests.map(m => (m.id === item.id ? { ...m, ...updateData } : m)));
    alert(`✅ تم اعتماد اسم [${item.deceased_name}] ${asMercy ? '(كحالة إخوة رب معفاة)' : ''} ونزل في جدول صلاة الترحيم بالمذبح.`);
  };

  const handleUpdateHallField = async (hallId, field, value) => {
    if (!isAdminUser) return;
    const { error } = await supabase.from('church_hall_settings').update({ [field]: value }).eq('id', hallId);
    if (error) return alert('خطأ أثناء تحديث بيانات القاعة: ' + error.message);
    setChurchHalls(churchHalls.map(h => (h.id === hallId ? { ...h, [field]: value } : h)));
  };

  const handleAddNewHall = async (e) => {
    e.preventDefault();
    if (!isAdminUser) return;
    if (!newHallName.trim()) return alert('ادخل اسم القاعة.');

    const payload = {
      hall_name: newHallName.trim(),
      hall_capacity: newHallCapacity.trim() || 'سعة مفتوحة',
      rental_fee: Number(newHallFee) || 0,
      is_active: true
    };

    const { data, error } = await supabase.from('church_hall_settings').insert([payload]).select().single();
    if (error) return alert('خطأ أثناء إضافة القاعة: ' + error.message);

    setChurchHalls([...churchHalls, data]);
    setNewHallName('');
    setNewHallCapacity('');
    setNewHallFee('');
    alert('تمت إضافة القاعة الجديدة بنجاح.');
  };

  const handleDeleteHall = async (hallId) => {
    if (!isAdminUser || !confirm('هل أنت متأكد من حذف هذه القاعة؟')) return;
    const { error } = await supabase.from('church_hall_settings').delete().eq('id', hallId);
    if (error) return alert('خطأ أثناء الحذف: ' + error.message);
    setChurchHalls(churchHalls.filter(h => h.id !== hallId));
  };

  const handleAssignRole = async (targetUserId, roleType) => {
    if (!isAdminUser) return;
    const user = systemUsers.find(u => u.id === targetUserId);
    if (!user) return;

    const currentPerms = user.permissions || {};
    const updatedPerms = { ...currentPerms, manage_joseph: true, joseph_role: roleType };

    const { error } = await supabase.from('church_users').update({ permissions: updatedPerms }).eq('id', targetUserId);
    if (error) return alert('خطأ أثناء منح الصلاحية: ' + error.message);

    setSystemUsers(systemUsers.map(u => (u.id === targetUserId ? { ...u, permissions: updatedPerms } : u)));
    alert(`تم تعيين [${user.full_name}] كـ [${roleType === 'driver' ? 'سائق الجنازة' : 'فراش / مرافق'}] بنجاح.`);
  };

  const handleRevokeRole = async (targetUserId) => {
    if (!isAdminUser) return;
    const user = systemUsers.find(u => u.id === targetUserId);
    if (!user || !confirm(`هل تريد إلغاء صلاحية [${user.full_name}] وسحبه من طاقم يوسف الرامي؟`)) return;

    const currentPerms = { ...(user.permissions || {}) };
    delete currentPerms.joseph_role;

    const { error } = await supabase.from('church_users').update({ permissions: currentPerms }).eq('id', targetUserId);
    if (error) return alert('خطأ أثناء سحب الصلاحية: ' + error.message);

    setSystemUsers(systemUsers.map(u => (u.id === targetUserId ? { ...u, permissions: currentPerms } : u)));
    alert(`تم سحب الصلاحية من [${user.full_name}] وإزالته من الطاقم بنجاح.`);
  };

  const searchedUsersForStaff = staffSearchQuery.trim()
    ? systemUsers
        .filter(
          u =>
            (u.full_name || '').toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
            (u.phone || '').includes(staffSearchQuery)
        )
        .slice(0, 8)
    : [];

  const workerTrips = cases.filter(c => {
    const inDateRange = (!statsStartDate || c.death_date >= statsStartDate) && (!statsEndDate || c.death_date <= statsEndDate);
    if (!inDateRange) return false;
    if (!statsWorkerName) return true;
    const inAssistants = Array.isArray(c.assistants) && c.assistants.some(a => a.name?.trim() === statsWorkerName.trim());
    const inOldField = (c.assistant_worker_name || '').includes(statsWorkerName);
    return inAssistants || inOldField;
  });

  const totalWorkerFee = workerTrips.length * Number(feePerTrip || 0);

  const approvedMassMemorials = memorialRequests.filter(
    m => m.status === 'مقبول (معتمد للمذبح)' && (!filterMassDate || m.mass_date === filterMassDate)
  );

  return (
    <div className="space-y-4 text-sm md:text-base font-sans" dir="rtl">
      {renderBackgroundAudio()}

      {liveToast && (
        <div style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }} className="fixed left-6 z-50 bg-[#4a0e13] text-white border-2 border-amber-400 p-4 rounded-2xl shadow-2xl max-w-sm space-y-2 animate-bounce print:hidden">
          <div className="flex justify-between items-start gap-2">
            <strong className="text-amber-300 text-xs font-black flex items-center gap-1.5">
              <BellRing size={15} className="animate-spin text-amber-400" /> {liveToast.title}
            </strong>
            <button
              type="button"
              onClick={() => setLiveToast(null)}
              className="text-white/60 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-white/90 leading-relaxed">{liveToast.message}</p>
          <button
            type="button"
            onClick={() => {
              setActiveMainTab(liveToast.type === 'memorials' ? 'memorials' : 'cases');
              setLiveToast(null);
            }}
            className="w-full py-1.5 bg-amber-400 hover:bg-amber-300 text-[#4a0e13] rounded-xl text-xs font-black cursor-pointer shadow text-center"
          >
            عرض التفاصيل الآن 👁️
          </button>
        </div>
      )}

      {/* الرأس التفاعلي */}
      <div className="bg-gradient-to-r from-slate-900 to-[#4a0e13] text-white p-5 rounded-3xl shadow flex flex-wrap justify-between items-center gap-3 print:hidden">
        <div>
          <h3 className="text-lg font-black text-amber-200 flex items-center gap-2">
            🕊️ خدمة يوسف الرامي (بيان المنتقل، قاعات العزاء، الصناديق، والمرافقين)
          </h3>
          <p className="text-xs text-white/85 mt-1">
            المسجل حالياً: <strong className="text-amber-300">{currentUser?.full_name}</strong> • الصناديق المتاحة: <strong>{caskets.filter(x => x.status === 'متاح').length}</strong> • أماكن الدفن: <strong>{burialLocations.length}</strong>
            {isChurchCouncil && <span className="mr-2 px-2 py-0.5 bg-amber-400 text-[#4a0e13] rounded-full text-[10px] font-black">🏛️ عضو لجنة الكنيسة</span>}
            {isPriest && <span className="mr-2 px-2 py-0.5 bg-purple-300 text-purple-950 rounded-full text-[10px] font-black">✝ أبونا الكاهن</span>}
            {isStaff && !canEditCases && <span className="mr-2 px-2 py-0.5 bg-amber-400 text-[#4a0e13] rounded-full text-[10px] font-black">👀 وضع مشاهدة خط السير فقط</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {renderAudioControlIcon()}

          {(isPriest || isStaff || isChurchCouncil) && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
                className="relative p-2 bg-white/15 hover:bg-white/25 text-amber-200 rounded-xl cursor-pointer border border-white/20"
                title="تنبيهات وبلاغات الخدمة الفورية"
              >
                <BellRing size={17} />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-black rounded-full shadow animate-pulse">
                    {notifications.filter(n => !n.is_read).length}
                  </span>
                )}
              </button>

              {showNotificationsMenu && (
                <div className="absolute left-0 mt-2 w-80 bg-white text-gray-900 rounded-2xl shadow-2xl border border-gray-200 z-50 p-3 space-y-2">
                  <div className="flex justify-between items-center border-b pb-2">
                    <strong className="text-xs text-[#7a1c24] flex items-center gap-1">
                      <BellRing size={14} /> تنبيهات يوسف الرامي اللحظية
                    </strong>
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          setNotifications([]);
                          setShowNotificationsMenu(false);
                          try {
                            await supabase.from('church_notifications').update({ is_read: true }).eq('user_id', currentUser.id);
                          } catch (_) {}
                        }}
                        className="text-[10px] text-blue-700 hover:underline font-bold cursor-pointer"
                      >
                        مسح التنبيهات
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">لا توجد بلاغات أو إشعارات جديدة حالياً.</p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto divide-y">
                      {notifications.map(n => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            setActiveMainTab(n.type === 'memorials' ? 'memorials' : 'cases');
                            setShowNotificationsMenu(false);
                          }}
                          className="w-full text-right p-2 hover:bg-amber-50 rounded-xl transition cursor-pointer"
                        >
                          <strong className="block text-xs text-gray-900">{n.title}</strong>
                          <span className="block text-[11px] text-gray-600 mt-0.5">{n.message}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setEditingMemorialId(null);
              setMemForm(emptyMemorial);
              setActiveMainTab('memorials');
              setShowMemorialForm(true);
              setShowDeathForm(false);
            }}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow cursor-pointer"
          >
            <HeartHandshake size={15} /> تقديم كارت ترحيم
          </button>

          {canReport && (!isStaff || canEditCases) && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                const t = new Date().toTimeString().slice(0, 5);
                const r = suggestLiturgicalRites(t);
                setDeathForm({ ...emptyDeathCase, death_time: t, is_night_death: r.isNight, liturgical_rites: r.rites });
                setShowDeathForm(!showDeathForm);
                setShowMemorialForm(false);
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs flex items-center gap-1.5 cursor-pointer shadow"
            >
              <AlertTriangle size={16} /> {showDeathForm ? 'إخفاء النموذج' : 'تقديم بيان حالة وفاة'}
            </button>
          )}
        </div>
      </div>

      {/* أزرار التبويبات */}
      <div className="bg-white p-2.5 rounded-2xl border flex flex-wrap gap-2 text-xs font-black print:hidden">
        {isAdminUser && (
          <button
            type="button"
            onClick={() => { setActiveMainTab('setup'); setAdminSubTab('setup'); }}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${activeMainTab === 'setup' ? 'bg-[#7a1c24] text-white shadow' : 'bg-gray-100 text-gray-700'}`}
          >
            ⚙️ أماكن الدفن، الصناديق، والألحان
          </button>
        )}
        <button
          type="button"
          onClick={() => { setActiveMainTab('cases'); setAdminSubTab('cases'); }}
          className={`px-4 py-2 rounded-xl transition cursor-pointer ${activeMainTab === 'cases' ? 'bg-[#7a1c24] text-white shadow' : 'bg-gray-100 text-gray-700'}`}
        >
          📋 حالات الوفاة والمرسلة ({cases.length})
        </button>
        <button
          type="button"
          onClick={() => { setActiveMainTab('memorials'); setAdminSubTab('cases'); }}
          className={`px-4 py-2 rounded-xl transition cursor-pointer ${activeMainTab === 'memorials' ? 'bg-[#7a1c24] text-white shadow' : 'bg-gray-100 text-gray-700'}`}
        >
          🕯️ كروت الترحيم والمراجعة ({memorialRequests.length})
          {memorialRequests.filter(x => x.status === 'معلق').length > 0 && (
            <span className="mr-1 px-2 py-0.5 bg-red-500 text-white rounded-full text-[10px]">
              {memorialRequests.filter(x => x.status === 'معلق').length} معلق
            </span>
          )}
        </button>

        {(isStaff || isPriest || isChurchCouncil) && (
          <button
            type="button"
            onClick={() => { setActiveMainTab('priest_sheet'); setAdminSubTab('cases'); }}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${activeMainTab === 'priest_sheet' ? 'bg-amber-600 text-white shadow' : 'bg-gray-100 text-gray-700'}`}
          >
            📜 كشف الترحيم بالمذبح (لأبونا)
          </button>
        )}

        {isFinanceAuthorized && (
          <button
            type="button"
            onClick={() => { setActiveMainTab('halls_settings'); setAdminSubTab('cases'); }}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${activeMainTab === 'halls_settings' ? 'bg-emerald-800 text-white shadow' : 'bg-gray-100 text-gray-700'}`}
          >
            🏛️ إدارة وتسعير القاعات ({churchHalls.length})
          </button>
        )}

        {isAdminUser && (
          <button
            type="button"
            onClick={() => { setActiveMainTab('instapay_settings'); setAdminSubTab('cases'); }}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${activeMainTab === 'instapay_settings' ? 'bg-amber-700 text-white shadow' : 'bg-gray-100 text-gray-700'}`}
          >
            📱 حساب InstaPay المعتمد
          </button>
        )}

        {isFinanceAuthorized && (
          <button
            type="button"
            onClick={() => { setActiveMainTab('workers_stats'); setAdminSubTab('cases'); }}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${activeMainTab === 'workers_stats' ? 'bg-indigo-900 text-white shadow' : 'bg-gray-100 text-gray-700'}`}
          >
            📊 مصاريف وخرجات الفراشين (العشور)
          </button>
        )}

        {isAdminUser && (
          <button
            type="button"
            onClick={() => { setActiveMainTab('staff_manage'); setAdminSubTab('cases'); }}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${activeMainTab === 'staff_manage' ? 'bg-blue-900 text-white shadow' : 'bg-gray-100 text-gray-700'}`}
          >
            🚐 تعيين وإلغاء صلاحيات الطاقم
          </button>
        )}
      </div>

      {/* لو الأدمن اختار تبويب الإعدادات صراحة فقط */}
      {isAdminUser && activeMainTab === 'setup' ? (
        <AdminChurchSettingsAndBurial currentUser={currentUser} />
      ) : (
        <>
          {!canReport && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 text-center space-y-2">
              <Lock size={28} className="mx-auto text-[#7a1c24]" />
              <h4 className="font-black text-[#7a1c24] text-base">خدمة يوسف الرامي — متاحة للبالغين وأولياء الأمور فقط</h4>
              <p className="text-xs md:text-sm text-amber-950 font-bold leading-relaxed">
                عذراً، تقديم طلب أو بيان حالة وفاة متاح فقط لمن سنهم <strong>15 سنة فأكثر</strong>.
              </p>
            </div>
          )}

          {sentNoticeSuccess && (
            <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-950 p-4 rounded-2xl font-bold text-sm flex flex-wrap justify-between items-center gap-2 print:hidden">
              <span>✅ تم توثيق وإرسال بيان حالة الوفاة باسم ({currentUser?.full_name}) للجنة الكنيسة والآباء الكهنة والسائق والفراشين! المسيح يعزيكم.</span>
              {obituaryCardCase && (
                <button
                  type="button"
                  onClick={() => setObituaryCardCase(obituaryCardCase)}
                  className="px-3 py-1 bg-[#7a1c24] text-white rounded-xl text-xs font-black cursor-pointer"
                >
                  عرض كارت النعي والمشاركة
                </button>
              )}
            </div>
          )}

          {/* كارت النعي الجاهز للمشاركة والطباعة وتنزيل الصورة */}
          {obituaryCardCase && (
            <div className="bg-amber-50/80 border-2 border-amber-400 p-5 rounded-3xl space-y-4 shadow-md print:hidden">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-amber-300 pb-3">
                <div>
                  <h4 className="font-black text-[#4a0e13] text-base flex items-center gap-2">
                    <Share2 size={18} className="text-[#7a1c24]" /> كارت النعي الجاهز للمشاركة (واتساب / فيسبوك / صورة)
                  </h4>
                  <p className="text-xs text-gray-600">يمكنك تنزيل الكارت كصورة مباشرة، أو مشاركة النص، أو طباعته.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setObituaryCardCase(null)}
                  className="px-3 py-1 bg-white border rounded-xl text-xs font-bold text-gray-700 cursor-pointer"
                >
                  ✕ إغلاق الكارت
                </button>
              </div>

              <div className="max-w-xl mx-auto bg-gradient-to-b from-[#4a0e13] via-[#fbf7f0] to-[#f4ede0] border-2 border-amber-500 rounded-3xl overflow-hidden shadow">
                <div className="bg-[#2b090d] text-amber-200 p-4 text-center space-y-1">
                  <div className="text-2xl text-amber-300">✝</div>
                  <div className="font-black text-base">انتقل إلى الأمجاد السماوية</div>
                  <p className="text-xs text-amber-100/90">
                    «أَنَا هُوَ الْقِيَامَةُ وَالْحَيَاةُ. مَنْ آمَنَ بِي وَلَوْ مَاتَ فَسَيَحْيَا» (يو 11: 25)
                  </p>
                </div>

                <div className="p-5 text-center space-y-3 text-gray-900">
                  <h3 className="text-xl md:text-2xl font-black text-[#4a0e13] border-b border-amber-300 pb-2">
                    {obituaryCardCase.deceased_name}
                  </h3>

                  <div className="space-y-1.5 text-xs md:text-sm font-bold text-right">
                    {(obituaryCardCase.funeral_date || obituaryCardCase.funeral_time) && (
                      <p>
                        ⛪ <strong>صلاة التجنيز:</strong> {obituaryCardCase.funeral_date || ''}{' '}
                        {obituaryCardCase.funeral_time ? `— الساعة ${obituaryCardCase.funeral_time}` : ''}
                      </p>
                    )}
                    {(obituaryCardCase.death_place_type || obituaryCardCase.death_place_details) && (
                      <p>
                        🚐 <strong>الخرجة / التحرك:</strong> {obituaryCardCase.death_place_type || ''}{' '}
                        {obituaryCardCase.death_place_details ? `(${obituaryCardCase.death_place_details})` : ''}
                      </p>
                    )}
                    {obituaryCardCase.burial_location_name && (
                      <p>
                        📍 <strong>الدفن:</strong> {obituaryCardCase.burial_location_name}
                      </p>
                    )}
                    {obituaryCardCase.needs_hall && obituaryCardCase.hall_name && (
                      <p>
                        🕯️ <strong>العزاء / القاعة:</strong> {obituaryCardCase.hall_name}{' '}
                        {[obituaryCardCase.hall_purpose, obituaryCardCase.hall_date, obituaryCardCase.hall_slot].filter(Boolean).length > 0 && (
                          <span className="text-gray-700">
                            ({[obituaryCardCase.hall_purpose, obituaryCardCase.hall_date, obituaryCardCase.hall_slot].filter(Boolean).join(' • ')})
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <p className="text-xs font-black text-[#7a1c24] pt-2 border-t border-amber-300">
                    المسيح يعزي الأسرة وجميع محبيهم • خدمة يوسف الرامي
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => downloadObituaryCardImage(obituaryCardCase)}
                  className="px-4 py-2 bg-[#7a1c24] hover:bg-[#5b141a] text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Download size={15} /> تنزيل الكارت كصورة (PNG)
                </button>
                <button
                  type="button"
                  onClick={() => handleSendObituaryWhatsApp(obituaryCardCase)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <MessageCircle size={15} /> شير على واتساب
                </button>
                <button
                  type="button"
                  onClick={() => handleShareObituaryText(obituaryCardCase)}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow"
                >
                  {copiedObituary ? <Check size={15} /> : <Share2 size={15} />}
                  {copiedObituary ? 'تم نسخ نص النعي للفيسبوك!' : 'شير / نسخ لفيسبوك'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPrintCase(obituaryCardCase); setTimeout(() => window.print(), 100); }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Printer size={15} /> طباعة الكارت
                </button>
              </div>
            </div>
          )}

          {/* كارت الترحيم (ذكرى الأربعين / ذكرى سنوية) مع صورة العذراء على الشمال، والاسم، والكنيسة، والقداس الأول/الثاني، والمذبح، والساعة */}
          {memorialCardItem && (
            <div className="bg-amber-50/80 border-2 border-amber-400 p-5 rounded-3xl space-y-4 shadow-md print:hidden">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-amber-300 pb-3">
                <div>
                  <h4 className="font-black text-[#4a0e13] text-base flex items-center gap-2">
                    <HeartHandshake size={18} className="text-[#7a1c24]" /> كارت الترحيم ({memorialCardItem.memorial_type || 'ذكرى الأربعين'}) — جاهز للطباعة والشير
                  </h4>
                  <p className="text-xs text-gray-600">يمكنك طباعة الكارت مباشرة، أو تنزيله كصورة PNG، أو مشاركته على واتساب وفيسبوك.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMemorialCardItem(null)}
                  className="px-3 py-1 bg-white border rounded-xl text-xs font-bold text-gray-700 cursor-pointer"
                >
                  ✕ إغلاق الكارت
                </button>
              </div>

              <div className="max-w-2xl mx-auto bg-gradient-to-b from-[#4a0e13] via-[#fcf8f2] to-[#f3eadb] border-2 border-amber-500 rounded-3xl overflow-hidden shadow">
                <div className="bg-[#2b090d] text-amber-200 p-4 text-center space-y-1">
                  <div className="text-2xl text-amber-300">✝</div>
                  <div className="font-black text-base md:text-lg text-white">
                    {memorialCardItem.memorial_type || 'ذكرى الأربعين'}
                  </div>
                  <p className="text-xs text-amber-100/90">
                    «طُوبَى لِلَّذِينَ يَمُوتُونَ فِي الرَّبِّ مُنْذُ الآنَ» (رؤ 14: 13)
                  </p>
                </div>

                <div className="p-5 grid grid-cols-1 sm:grid-cols-3 items-center gap-3 text-center">
                  {/* الشمال: صورة السيدة العذراء مريم */}
                  <VirginMaryCardBox />

                  {/* المنتصف: ذكرى الأربعين واسم المنتقل */}
                  <div className="space-y-2 py-2">
                    <div className="text-sm font-black text-[#7a1c24]">
                      {memorialCardItem.memorial_type || 'ذكرى الأربعين'}
                    </div>
                    <h3 className="text-lg md:text-xl font-black text-[#4a0e13] border-y border-amber-300 py-2">
                      {memorialCardItem.deceased_name}
                    </h3>
                  </div>

                  {/* اليمين: الصليب والترحيم على المذبح */}
                  <div className="bg-[#fff9eb] border-2 border-amber-400 rounded-2xl p-3 space-y-1 shadow-sm">
                    <div className="text-3xl text-[#7a1c24] font-black">✝</div>
                    <div className="font-black text-xs md:text-sm text-[#4a0e13]">صلاة وترحيم</div>
                    <div className="text-[11px] font-bold text-amber-900">
                      {memorialCardItem.altar_name || 'على المذبح المقدس'}
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-5 text-center space-y-1.5 text-xs md:text-sm font-bold text-gray-800">
                  {memorialCardItem.church_name && (
                    <p>
                      ⛪ <strong>الكنيسة:</strong> {memorialCardItem.church_name}
                    </p>
                  )}
                  <p>
                    ✝ <strong>القداس:</strong> {memorialCardItem.mass_order || 'القداس الأول'}
                    {memorialCardItem.altar_name ? ` — على ${memorialCardItem.altar_name}` : ''}
                  </p>
                  {(memorialCardItem.mass_date || memorialCardItem.mass_time) && (
                    <p>
                      🕒 <strong>الميعاد:</strong> {memorialCardItem.mass_date || ''}{' '}
                      {memorialCardItem.mass_time ? `— الساعة ${memorialCardItem.mass_time}` : ''}
                    </p>
                  )}
                  {memorialCardItem.needs_hall && memorialCardItem.hall_name && (
                    <p>
                      🏛️ <strong>الاستقبال / القاعة:</strong> {memorialCardItem.hall_name}{' '}
                      {memorialCardItem.hall_slot ? `(${memorialCardItem.hall_slot})` : ''}
                    </p>
                  )}
                  <p className="text-xs font-black text-[#7a1c24] pt-2 border-t border-amber-300">
                    اذكرونا في صلواتكم • المسيح يعزي الأسرة وجميع محبيهم
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setPrintMemorialCard(memorialCardItem); setTimeout(() => window.print(), 100); }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Printer size={15} /> طباعة كارت الترحيم
                </button>
                <button
                  type="button"
                  onClick={() => downloadMemorialCardImage(memorialCardItem)}
                  className="px-4 py-2 bg-[#7a1c24] hover:bg-[#5b141a] text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Download size={15} /> تنزيل الكارت كصورة (PNG)
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMemorialWhatsApp(memorialCardItem)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <MessageCircle size={15} /> شير على واتساب
                </button>
                <button
                  type="button"
                  onClick={() => handleShareMemorialText(memorialCardItem)}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow"
                >
                  {copiedMemorial ? <Check size={15} /> : <Share2 size={15} />}
                  {copiedMemorial ? 'تم نسخ نص الترحيم للفيسبوك!' : 'شير / نسخ لفيسبوك'}
                </button>
              </div>
            </div>
          )}

          {/* تبويب تعديل حساب InstaPay للأدمن */}
          {isAdminUser && activeMainTab === 'instapay_settings' && (
            <div className="bg-white p-6 rounded-3xl border space-y-4 print:hidden max-w-xl">
              <div className="border-b pb-3">
                <h4 className="font-black text-gray-900 text-base flex items-center gap-2">
                  <DollarSign size={18} className="text-amber-600" /> تعديل بيانات حساب وتليفون InstaPay للكنيسة
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  البيانات التي ستكتبها هنا هي التي ستظهر للمستخدمين عند اختيار الدفع والتبرع بـ InstaPay.
                </p>
              </div>

              <form onSubmit={handleSaveInstapaySettings} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">اسم/معرّف حساب InstaPay للكنيسة:</label>
                  <input
                    required
                    placeholder="مثال: church.donation@instapay"
                    className="w-full p-2.5 border rounded-xl bg-gray-50 text-xs font-mono font-bold"
                    value={instapayAccount}
                    onChange={e => setInstapayAccount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">رقم تليفون InstaPay أو المحفظة الإلكترونية:</label>
                  <input
                    required
                    placeholder="مثال: 01223456789"
                    className="w-full p-2.5 border rounded-xl bg-gray-50 text-xs font-mono font-bold"
                    value={instapayPhone}
                    onChange={e => setInstapayPhone(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingInstapay}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black cursor-pointer shadow"
                >
                  {isSavingInstapay ? 'جاري الحفظ...' : 'حفظ بيانات الحساب المعتمد ✅'}
                </button>
              </form>
            </div>
          )}

          {/* تبويب إدارة القاعات وسعتها وأسعارها بدقة */}
          {isFinanceAuthorized && activeMainTab === 'halls_settings' && (
            <div className="bg-white p-5 rounded-3xl border space-y-5 print:hidden">
              <div className="border-b pb-3 flex justify-between items-center">
                <div>
                  <h4 className="font-black text-gray-900 text-base flex items-center gap-2">
                    <Home size={18} className="text-emerald-800" /> إدارة قاعات العزاء، سعتها (أكثر أو أقل)، ورسوم الحجز
                  </h4>
                  <p className="text-xs text-gray-500">
                    يمكنك تعديل اسم القاعة، سعة الأفراد، السعر، أو إضافة قاعة جديدة بالكامل وحذف أي قاعة.
                  </p>
                </div>
              </div>

              {isAdminUser && (
                <form onSubmit={handleAddNewHall} className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 grid sm:grid-cols-4 gap-2.5 items-end">
                  <div>
                    <label className="block text-xs font-bold text-emerald-950 mb-1">اسم القاعة الجديدة *</label>
                    <input
                      required
                      placeholder="مثال: القاعة الكبيرة، القاعة الصغيرة..."
                      className="w-full p-2 border rounded-xl bg-white text-xs font-bold"
                      value={newHallName}
                      onChange={e => setNewHallName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-emerald-950 mb-1">سعة القاعة (عدد الأفراد) *</label>
                    <input
                      required
                      placeholder="مثال: تسع 350 فرد أو أكثر..."
                      className="w-full p-2 border rounded-xl bg-white text-xs"
                      value={newHallCapacity}
                      onChange={e => setNewHallCapacity(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-emerald-950 mb-1">سعر الحجز (ج.م) *</label>
                    <input
                      required
                      type="number"
                      min="0"
                      placeholder="1500"
                      className="w-full p-2 border rounded-xl bg-white text-xs font-bold text-emerald-800"
                      value={newHallFee}
                      onChange={e => setNewHallFee(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus size={15} /> إضافة القاعة
                  </button>
                </form>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {churchHalls.map(hall => (
                  <div key={hall.id} className="p-4 bg-gray-50 border-2 border-emerald-200 rounded-2xl space-y-3 relative">
                    {isAdminUser && (
                      <button
                        type="button"
                        onClick={() => handleDeleteHall(hall.id)}
                        className="absolute top-3 left-3 p-1.5 text-red-600 hover:bg-red-50 rounded-xl cursor-pointer"
                        title="حذف هذه القاعة"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-1">اسم القاعة:</label>
                      <input
                        defaultValue={hall.hall_name}
                        readOnly={!isAdminUser}
                        onBlur={e => handleUpdateHallField(hall.id, 'hall_name', e.target.value)}
                        className="p-1.5 border rounded-xl bg-white font-black text-gray-900 text-sm w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 mb-1">سعة الأفراد (أكثر أو أقل):</label>
                        <input
                          defaultValue={hall.hall_capacity}
                          readOnly={!isAdminUser}
                          onBlur={e => handleUpdateHallField(hall.id, 'hall_capacity', e.target.value)}
                          className="p-1.5 border rounded-xl bg-white text-xs w-full font-bold"
                          placeholder="مثال: تسع 300 فرد"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 mb-1">سعر الحجز (ج.م):</label>
                        <input
                          type="number"
                          min="0"
                          defaultValue={hall.rental_fee}
                          readOnly={!isAdminUser}
                          onBlur={e => handleUpdateHallField(hall.id, 'rental_fee', Number(e.target.value))}
                          className="p-1.5 border rounded-xl bg-white font-black text-emerald-800 text-xs w-full"
                        />
                      </div>
                    </div>
                    {isAdminUser && (
                      <p className="text-[10px] text-gray-400">💡 اضغط خارج أي خانة بعد كتابة القيمة ليتم الحفظ التلقائي في السيستم.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* تبويب تعيين وإلغاء صلاحيات السائقين والفراشين */}
          {isAdminUser && activeMainTab === 'staff_manage' && (
            <div className="bg-white p-5 rounded-3xl border space-y-5 print:hidden">
              <div className="border-b pb-3">
                <h4 className="font-black text-gray-900 text-base flex items-center gap-2">
                  <Users size={18} className="text-blue-900" /> إدارة طاقم العمل (تعيين وإلغاء صلاحيات السائقين والفراشين)
                </h4>
                <p className="text-xs text-gray-500">
                  ابحث عن أي عضو في الكنيسة واضغط على زر تعيينه كسائق أو كفراش، ويمكنك سحب الصلاحية منه وإزالته من الطاقم في أي وقت.
                </p>
              </div>

              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-200 space-y-3">
                <label className="block text-xs font-black text-blue-950">🔍 ابحث بالاسم أو التليفون لمنح صلاحية سائق أو فراش:</label>
                <div className="relative">
                  <Search size={16} className="absolute right-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="اكتب اسم الخادم أو رقم هاتفه..."
                    className="w-full pr-9 pl-3 py-2 border rounded-xl bg-white text-xs font-bold"
                    value={staffSearchQuery}
                    onChange={e => setStaffSearchQuery(e.target.value)}
                  />
                </div>

                {searchedUsersForStaff.length > 0 && (
                  <div className="divide-y bg-white rounded-xl border border-blue-100 max-h-48 overflow-y-auto">
                    {searchedUsersForStaff.map(u => (
                      <div key={u.id} className="p-2.5 flex flex-wrap justify-between items-center gap-2 text-xs">
                        <div>
                          <strong className="text-gray-900">{u.full_name}</strong>
                          <span className="text-gray-500 mr-2 font-mono">({u.phone || 'بدون تليفون'})</span>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => { handleAssignRole(u.id, 'driver'); setStaffSearchQuery(''); }}
                            className="px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Ambulance size={12} /> تعيين كسائق
                          </button>
                          <button
                            type="button"
                            onClick={() => { handleAssignRole(u.id, 'worker'); setStaffSearchQuery(''); }}
                            className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Users size={12} /> تعيين كفراش
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <strong className="text-blue-950 text-xs font-black flex items-center gap-1.5">
                      🚐 السائقون المعتمدون حالياً ({josephTeamDrivers.length})
                    </strong>
                  </div>
                  {josephTeamDrivers.length === 0 ? (
                    <p className="text-xs text-gray-400">لا يوجد سائقون مسجلون حالياً.</p>
                  ) : (
                    <div className="space-y-2">
                      {josephTeamDrivers.map(d => (
                        <div key={d.id} className="p-2.5 bg-white rounded-xl border border-blue-200 flex justify-between items-center text-xs">
                          <div>
                            <strong className="text-gray-900 block">{d.full_name}</strong>
                            <span className="text-gray-500 text-[11px] font-mono">{d.phone || '—'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRevokeRole(d.id)}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                            title="إلغاء صفة سائق"
                          >
                            <UserMinus size={13} /> سحب الصلاحية
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <strong className="text-indigo-950 text-xs font-black flex items-center gap-1.5">
                      👤 الفراشون المعتمدون حالياً ({josephTeamWorkers.length})
                    </strong>
                  </div>
                  {josephTeamWorkers.length === 0 ? (
                    <p className="text-xs text-gray-400">لا يوجد فراشون مسجلون حالياً.</p>
                  ) : (
                    <div className="space-y-2">
                      {josephTeamWorkers.map(w => (
                        <div key={w.id} className="p-2.5 bg-white rounded-xl border border-indigo-200 flex justify-between items-center text-xs">
                          <div>
                            <strong className="text-gray-900 block">{w.full_name}</strong>
                            <span className="text-gray-500 text-[11px] font-mono">{w.phone || '—'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRevokeRole(w.id)}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                            title="إلغاء صفة فراش"
                          >
                            <UserMinus size={13} /> سحب الصلاحية
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* نموذج تقديم كارت ترحيم (أربعين / سنوية / ترحيم وتذكار عام) */}
          {showMemorialForm && (
            <form onSubmit={handleSaveMemorial} className="bg-amber-50/60 p-5 rounded-3xl border-2 border-amber-300 space-y-4 print:hidden">
              <div className="flex justify-between items-center border-b border-amber-200 pb-2">
                <h4 className="font-black text-amber-950 text-base flex items-center gap-2">
                  <HeartHandshake size={18} className="text-[#7a1c24]" /> {editingMemorialId ? 'تعديل كارت الترحيم' : 'تسجيل كارت ترحيم جديد (ذكرى الأربعين / ذكرى سنوية)'}
                </h4>
                <button type="button" onClick={() => { setShowMemorialForm(false); setEditingMemorialId(null); setMemForm(emptyMemorial); }} className="text-gray-500 hover:text-black text-xs font-bold">✕ إغلاق</button>
              </div>

              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-700 font-bold mb-1">اسم المنتقل المراد ترحيمه *</label>
                  <input
                    required
                    placeholder="الاسم بالكامل..."
                    className="w-full p-2.5 border rounded-xl bg-white text-xs font-bold"
                    value={memForm.deceased_name}
                    onChange={e => setMemForm({ ...memForm, deceased_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 font-bold mb-1">المناسبة *</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white text-xs font-bold"
                    value={memForm.memorial_type}
                    onChange={e => setMemForm({ ...memForm, memorial_type: e.target.value })}
                  >
                    <option value="ذكرى الأربعين">ذكرى الأربعين</option>
                    <option value="ذكرى سنوية">ذكرى سنوية</option>
                    <option value="ترحيم وتذكار عام">ترحيم وتذكار عام</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-700 font-bold mb-1">تاريخ القداس الإلهي *</label>
                  <input
                    type="date"
                    required
                    className="w-full p-2.5 border rounded-xl bg-white text-xs font-bold"
                    value={memForm.mass_date}
                    onChange={e => setMemForm({ ...memForm, mass_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 font-bold mb-1">ساعة القداس الإلهي</label>
                  <input
                    type="time"
                    className="w-full p-2.5 border rounded-xl bg-white text-xs font-bold"
                    value={memForm.mass_time}
                    onChange={e => setMemForm({ ...memForm, mass_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-700 font-bold mb-1">اسم الكنيسة *</label>
                  <input
                    required
                    placeholder="مثال: كنيسة السيدة العذراء مريم..."
                    className="w-full p-2.5 border rounded-xl bg-white text-xs font-bold"
                    value={memForm.church_name}
                    onChange={e => setMemForm({ ...memForm, church_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 font-bold mb-1">القداس (الأول / الثاني / الثالث) *</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white text-xs font-bold"
                    value={memForm.mass_order}
                    onChange={e => setMemForm({ ...memForm, mass_order: e.target.value })}
                  >
                    {MASS_ORDER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-700 font-bold mb-1">على مذبح إيه؟ *</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white text-xs font-bold"
                    value={ALTAR_OPTIONS.includes(memForm.altar_name) ? memForm.altar_name : 'مذبح آخر'}
                    onChange={e => {
                      const val = e.target.value;
                      setMemForm({ ...memForm, altar_name: val === 'مذبح آخر' ? '' : val });
                    }}
                  >
                    {ALTAR_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  {!ALTAR_OPTIONS.slice(0, -1).includes(memForm.altar_name) && (
                    <input
                      placeholder="اكتب اسم المذبح..."
                      className="w-full p-2 border rounded-xl bg-white text-xs font-bold mt-1.5"
                      value={memForm.altar_name}
                      onChange={e => setMemForm({ ...memForm, altar_name: e.target.value })}
                    />
                  )}
                </div>
              </div>

              <div className="bg-purple-50/70 p-3.5 rounded-2xl border border-purple-200 space-y-2">
                <label className="flex items-center gap-2 text-xs font-black text-purple-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memForm.needs_hall}
                    onChange={e => setMemForm({ ...memForm, needs_hall: e.target.checked, hall_id: '', hall_name: '', hall_fee: 0 })}
                  />
                  <Home size={15} /> هل ترغب في حجز قاعة الكنيسة للجلوس مع المعزين بعد القداس؟
                </label>

                {memForm.needs_hall && (
                  <div className="grid sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] text-gray-700 mb-1">اختر القاعة:</label>
                      <select
                        required
                        className="w-full p-2 border rounded-xl bg-white text-xs font-bold"
                        value={memForm.hall_id}
                        onChange={e => {
                          const hl = churchHalls.find(h => h.id === e.target.value);
                          setMemForm({ ...memForm, hall_id: hl?.id || '', hall_name: hl?.hall_name || '', hall_fee: hl?.rental_fee || 0 });
                        }}
                      >
                        <option value="">-- اختر القاعة --</option>
                        {churchHalls.map(h => (
                          <option key={h.id} value={h.id}>{h.hall_name} ({h.rental_fee} ج.م) - {h.hall_capacity}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-700 mb-1">الموعد والفترة:</label>
                      <input
                        className="w-full p-2 border rounded-xl bg-white text-xs"
                        value={memForm.hall_slot}
                        onChange={e => setMemForm({ ...memForm, hall_slot: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-700 font-bold mb-1">اسم مقدم الطلب</label>
                  <input
                    required
                    className="w-full p-2.5 border rounded-xl bg-white text-xs font-bold"
                    value={memForm.requester_name}
                    onChange={e => setMemForm({ ...memForm, requester_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 font-bold mb-1">تليفون التواصل</label>
                  <input
                    type="tel"
                    required
                    className="w-full p-2.5 border rounded-xl bg-white text-xs font-bold"
                    value={memForm.requester_phone}
                    onChange={e => setMemForm({ ...memForm, requester_phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 font-bold mb-1">صلة القرابة</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white text-xs font-bold"
                    value={memForm.relationship}
                    onChange={e => setMemForm({ ...memForm, relationship: e.target.value })}
                  >
                    {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <span className="text-emerald-950 font-black text-xs flex items-center gap-1.5">
                    <DollarSign size={16} /> تبرع الترحيم ودعم الكنيسة والفقراء (InstaPay / كاش):
                  </span>
                  <label className="flex items-center gap-1.5 text-xs font-black text-purple-900 bg-purple-100 px-3 py-1 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={memForm.is_mercy_case}
                      onChange={e => {
                        const checked = e.target.checked;
                        setMemForm({
                          ...memForm,
                          is_mercy_case: checked,
                          donation_amount: checked ? 0 : memForm.donation_amount,
                          payment_method: checked ? 'بدون تبرع' : 'InstaPay'
                        });
                      }}
                    />
                    🕊️ الحالة تابعة لإخوة الرب (إعفاء من رسوم التبرع)
                  </label>
                </div>

                {!memForm.is_mercy_case && (
                  <>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-gray-700 mb-1">مبلغ التبرع (ج.م):</label>
                        <input
                          type="number"
                          min="0"
                          className="w-full p-2 border rounded-xl bg-white font-black text-emerald-800 text-xs"
                          value={memForm.donation_amount}
                          onChange={e => setMemForm({ ...memForm, donation_amount: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-700 mb-1">طريقة الدفع:</label>
                        <select
                          className="w-full p-2 border rounded-xl bg-white text-xs font-bold"
                          value={memForm.payment_method}
                          onChange={e => setMemForm({ ...memForm, payment_method: e.target.value })}
                        >
                          <option value="InstaPay">📱 InstaPay (إنستاباي)</option>
                          <option value="كاش بالكنيسة">💵 كاش بمقر الكنيسة</option>
                          <option value="بدون تبرع">🕊️ بدون تبرع (طلب صلاة فقط)</option>
                        </select>
                      </div>
                      {memForm.payment_method === 'InstaPay' && (
                        <div>
                          <label className="block text-[11px] text-gray-700 mb-1">رقم المعاملة المرجعي بـ InstaPay:</label>
                          <input
                            placeholder="Ref #10394827"
                            className="w-full p-2 border rounded-xl bg-white text-xs"
                            value={memForm.instapay_ref}
                            onChange={e => setMemForm({ ...memForm, instapay_ref: e.target.value })}
                          />
                        </div>
                      )}
                    </div>

                    {memForm.payment_method === 'InstaPay' && (
                      <div className="space-y-2 bg-white/90 p-3 rounded-2xl border border-emerald-300">
                        <div className="flex flex-wrap justify-between items-center text-xs">
                          <span className="text-emerald-950 font-bold">
                            💳 حساب إنستاباي: <strong className="font-mono text-emerald-800 text-sm">{instapayAccount}</strong>
                          </span>
                          <span className="text-emerald-950 font-bold">
                            📞 رقم التحويل/المحفظة: <strong className="font-mono text-emerald-800 text-sm">{instapayPhone}</strong>
                          </span>
                        </div>

                        <div className="pt-2 border-t border-emerald-200 flex flex-wrap items-center gap-3">
                          <label className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                            <UploadCloud size={15} />
                            <span>{uploadingReceipt ? 'جاري الرفع...' : 'إرفاق صورة إيصال التحويل (Screenshot)'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => handleUploadReceiptImage(e.target.files[0])}
                            />
                          </label>

                          {memForm.receipt_image_url && (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold">
                              <span>✔ تم إرفاق الصورة</span>
                              <button
                                type="button"
                                onClick={() => setViewingImage(memForm.receipt_image_url)}
                                className="text-blue-700 underline flex items-center gap-0.5"
                              >
                                [معاينة الصورة]
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#7a1c24] hover:bg-[#5b141a] text-white rounded-2xl font-black text-xs md:text-sm cursor-pointer shadow transition"
              >
                {editingMemorialId ? 'حفظ التعديلات وإخراج كارت الترحيم ✅' : 'حفظ وإخراج كارت الترحيم للطباعة والشير 🕊️'}
              </button>
            </form>
          )}

          {/* تبويب طلبات الوفاة والحجز */}
          {activeMainTab === 'cases' && (
            <div className="space-y-4">
              {showDeathForm && canReport && (!isStaff || canEditCases) && (
                <form onSubmit={handleSaveCase} className="bg-white p-5 rounded-3xl border-2 border-[#7a1c24]/30 space-y-4 font-bold shadow-sm print:hidden">
                  <div className="flex flex-wrap justify-between items-center border-b pb-2 gap-2">
                    <h4 className="text-base font-black text-[#7a1c24]">📋 {editingId ? 'تعديل بيان حالة الوفاة' : 'اختيار المنتقل، خط السير، وحجز قاعة العزاء'}</h4>
                    <div className="flex items-center gap-2">
                      {editingId && (
                        <button
                          type="button"
                          onClick={() => { setEditingId(null); setDeathForm(emptyDeathCase); setShowDeathForm(false); }}
                          className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-xl text-xs cursor-pointer"
                        >
                          إلغاء التعديل
                        </button>
                      )}
                      <label className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-950 cursor-pointer">
                        <input type="checkbox" checked={deathForm.is_night_death} onChange={e => setDeathForm({ ...deathForm, is_night_death: e.target.checked })} />
                        <Moon size={14} /> حالة وفاة بالليل
                      </label>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">اسم المنتقل بالكامل *</label>
                      <input
                        required
                        placeholder="الاسم الرباعي..."
                        className="w-full p-2.5 border rounded-xl bg-white text-xs"
                        value={deathForm.deceased_name}
                        onChange={e => setDeathForm({ ...deathForm, deceased_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">درجة القرابة بك (المُبلّغ) *</label>
                      <select
                        required
                        className="w-full p-2.5 border rounded-xl bg-white text-xs"
                        value={deathForm.relationship_degree}
                        onChange={e => setDeathForm({ ...deathForm, relationship_degree: e.target.value })}
                      >
                        {RELATIONSHIP_OPTIONS.map(rel => <option key={rel} value={rel}>{rel}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">مكان الدفن *</label>
                      <select
                        required
                        className="w-full p-2.5 border rounded-xl bg-white text-xs"
                        value={deathForm.burial_location_id}
                        onChange={e => {
                          const loc = burialLocations.find(b => b.id === e.target.value);
                          setDeathForm({
                            ...deathForm,
                            burial_location_id: loc?.id || '',
                            burial_location_name: loc?.location_name || '',
                            transport_fee: loc?.transport_fee || 0
                          });
                        }}
                      >
                        <option value="">-- اختر مكان الدفن --</option>
                        {burialLocations.map((b, idx) => <option key={b.id} value={b.id}>{idx + 1}) {b.location_name} ({b.transport_fee} ج.م)</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">تاريخ صلاة التجنيز</label>
                      <input
                        type="date"
                        className="w-full p-2.5 border rounded-xl bg-white text-xs"
                        value={deathForm.funeral_date}
                        onChange={e => setDeathForm({ ...deathForm, funeral_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">ساعة صلاة التجنيز</label>
                      <input
                        type="time"
                        className="w-full p-2.5 border rounded-xl bg-white text-xs"
                        value={deathForm.funeral_time}
                        onChange={e => setDeathForm({ ...deathForm, funeral_time: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">مكان التحرك / الخرجة</label>
                      <input
                        placeholder="البيت / المستشفى / العنوان..."
                        className="w-full p-2.5 border rounded-xl bg-white text-xs"
                        value={deathForm.death_place_details}
                        onChange={e => setDeathForm({ ...deathForm, death_place_details: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="bg-amber-50/90 p-4 rounded-2xl border-2 border-amber-300 space-y-3">
                    <label className="flex items-center gap-2 text-sm font-black text-amber-950 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deathForm.needs_hall}
                        onChange={e => setDeathForm({
                          ...deathForm,
                          needs_hall: e.target.checked,
                          hall_id: '',
                          hall_name: '',
                          hall_fee: 0
                        })}
                      />
                      <Home size={17} className="text-[#7a1c24]" /> هل ترغب في حجز إحدى قاعات الكنيسة؟ (لصلاة الثالث، أو العزاء، أو الاستقبال)
                    </label>

                    {deathForm.needs_hall && (
                      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                        <div>
                          <label className="block text-[11px] text-gray-700 mb-1">اختر القاعة *</label>
                          <select
                            required
                            className="w-full p-2 border rounded-xl bg-white text-xs font-bold"
                            value={deathForm.hall_id}
                            onChange={e => {
                              const hl = churchHalls.find(h => h.id === e.target.value);
                              setDeathForm({
                                ...deathForm,
                                hall_id: hl?.id || '',
                                hall_name: hl?.hall_name || '',
                                hall_fee: hl?.rental_fee || 0
                              });
                            }}
                          >
                            <option value="">-- اختر قاعة العزاء --</option>
                            {churchHalls.map(h => (
                              <option key={h.id} value={h.id}>
                                {h.hall_name} ({h.hall_capacity}) - {h.rental_fee} ج.م
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] text-gray-700 mb-1">الغرض من حجز القاعة *</label>
                          <select
                            className="w-full p-2 border rounded-xl bg-white text-xs font-bold"
                            value={deathForm.hall_purpose}
                            onChange={e => setDeathForm({ ...deathForm, hall_purpose: e.target.value })}
                          >
                            {HALL_PURPOSES.map(p => (
                              <option key={p.id} value={p.label}>{p.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] text-gray-700 mb-1">تاريخ الحجز المطلوب *</label>
                          <input
                            type="date"
                            required
                            className="w-full p-2 border rounded-xl bg-white text-xs font-bold"
                            value={deathForm.hall_date}
                            onChange={e => setDeathForm({ ...deathForm, hall_date: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-gray-700 mb-1">الفترة الزمنية:</label>
                          <select
                            className="w-full p-2 border rounded-xl bg-white text-xs font-bold"
                            value={deathForm.hall_slot}
                            onChange={e => setDeathForm({ ...deathForm, hall_slot: e.target.value })}
                          >
                            <option value="مسائي (6:00 م إلى 10:00 م)">مسائي (6:00 م إلى 10:00 م)</option>
                            <option value="صباحي بعد القداس (11:00 ص إلى 2:00 م)">صباحي (11:00 ص إلى 2:00 م)</option>
                            <option value="يوم كامل">يوم كامل</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {isStaff && (
                    <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-200 space-y-3">
                      <div className="flex flex-wrap justify-between items-center">
                        <span className="text-indigo-950 font-black text-xs flex items-center gap-1.5">
                          <Users size={16} /> طاقم السيارة المرافق (السائق والفراشين):
                        </span>
                        <button
                          type="button"
                          onClick={handleAddAssistant}
                          className="px-3 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={14} /> إضافة فراش آخر (2 أو 3 أو 4)
                        </button>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-blue-200 grid sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-gray-700 mb-1">🚐 السائق المسؤول (من السيستم):</label>
                          <select
                            className="w-full p-2 border rounded-xl bg-blue-50/40 text-xs"
                            value=""
                            onChange={e => {
                              const drv = systemUsers.find(u => u.id === e.target.value);
                              if (drv) setDeathForm({ ...deathForm, driver_name: drv.full_name, driver_phone: drv.phone || '' });
                            }}
                          >
                            <option value="">-- اختر السائق من المسجلين --</option>
                            {josephTeamDrivers.map(d => <option key={d.id} value={d.id}>{d.full_name} ({d.phone})</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 pt-4">
                          <input placeholder="اسم السائق" className="p-2 border rounded-xl text-xs bg-gray-50" value={deathForm.driver_name} onChange={e => setDeathForm({ ...deathForm, driver_name: e.target.value })} />
                          <input placeholder="تليفون السائق" className="p-2 border rounded-xl text-xs bg-gray-50" value={deathForm.driver_phone} onChange={e => setDeathForm({ ...deathForm, driver_phone: e.target.value })} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        {deathForm.assistants.map((assistant, index) => (
                          <div key={index} className="bg-white p-2.5 rounded-xl border border-gray-200 flex flex-wrap items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-900 font-bold text-xs flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>
                            <select
                              className="p-2 border rounded-xl bg-gray-50 text-xs grow sm:grow-0 sm:w-48"
                              value={assistant.id}
                              onChange={e => handleAssistantSelect(index, e.target.value)}
                            >
                              <option value="">-- اختر من الفراشين المسجلين --</option>
                              {josephTeamWorkers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                            </select>

                            <input
                              placeholder={`اسم الفراش رقم ${index + 1}`}
                              className="p-2 border rounded-xl text-xs bg-white grow"
                              value={assistant.name}
                              onChange={e => handleAssistantCustomChange(index, 'name', e.target.value)}
                            />
                            <input
                              placeholder="رقم التليفون"
                              className="p-2 border rounded-xl text-xs bg-white w-32"
                              value={assistant.phone}
                              onChange={e => handleAssistantCustomChange(index, 'phone', e.target.value)}
                            />

                            {deathForm.assistants.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveAssistant(index)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-xl cursor-pointer"
                                title="حذف هذا الفراش"
                              >
                                <X size={15} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <label className="flex items-start gap-2.5 p-3.5 bg-red-50 border-2 border-red-200 rounded-2xl text-xs text-red-950 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={deathForm.is_confirmed}
                      onChange={e => setDeathForm({ ...deathForm, is_confirmed: e.target.checked })}
                      className="mt-0.5"
                    />
                    <span>
                      أقرّ أنا <strong>{currentUser.full_name}</strong> بصحة البيانات المذكورة أعلاه لتوجيه الآباء الكهنة وحجز القاعة والسيارة.
                    </span>
                  </label>

                  <button type="submit" className="w-full py-3 bg-[#7a1c24] text-white rounded-xl font-black text-xs cursor-pointer shadow">
                    {editingId ? 'حفظ التعديلات ✅' : 'تأكيد وإرسال البيان وإخراج كارت النعي 🚨'}
                  </button>
                </form>
              )}

              {/* بطاقات الحالات الحالية */}
              <div className="grid gap-3">
                {cases.map(c => {
                  const assistantsList = Array.isArray(c.assistants) && c.assistants.length > 0
                    ? c.assistants
                    : c.assistant_worker_name ? [{ name: c.assistant_worker_name, phone: c.assistant_worker_phone }] : [];

                  return (
                    <div key={c.id} className="bg-white p-4 rounded-3xl border-2 space-y-3">
                      <div className="flex flex-wrap justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-950 rounded-lg text-xs font-black">{c.status}</span>
                            <strong className="text-base text-gray-900">{c.deceased_name}</strong>
                            {c.needs_hall && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded-lg text-xs font-bold flex items-center gap-1">
                                <Home size={12} /> قاعة: {c.hall_name} ({c.hall_purpose})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">تاريخ الوفاة: {c.death_date} • مكان الدفن: {c.burial_location_name}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setObituaryCardCase(c)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
                          >
                            <Share2 size={13} /> كارت النعي / شير
                          </button>

                          {isStaff && (
                            <>
                              {canEditCases && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditCase(c)}
                                    className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Edit3 size={13} /> تعديل
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCase(c)}
                                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Trash2 size={13} /> حذف
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => sendDriverWhatsApp(c)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <MessageCircle size={13} /> واتساب السائق
                              </button>
                              <button
                                type="button"
                                onClick={() => { setPrintCase(c); setTimeout(() => window.print(), 100); }}
                                className="px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Printer size={13} /> طباعة أمر الدفن والقاعة
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {isStaff && (
                        <div className="grid sm:grid-cols-2 gap-2 text-xs">
                          <div className="bg-blue-50 p-3 rounded-2xl border border-blue-200">
                            <strong className="text-blue-950 block mb-1">🚐 السائق:</strong>
                            <p>{c.driver_name || 'قيد التحديد'} {c.driver_phone && `(${c.driver_phone})`}</p>
                          </div>

                          <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-200">
                            <strong className="text-indigo-950 block mb-1">
                              👤 الفراشون المشاركون ({assistantsList.length} فراش):
                            </strong>
                            {assistantsList.length === 0 ? (
                              <p className="text-gray-400">لم يُحدد فراشون</p>
                            ) : (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {assistantsList.map((a, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-white border border-indigo-200 rounded-lg text-indigo-950 font-bold">
                                    {i + 1}) {a.name} {a.phone && `(${a.phone})`}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* تبويب كروت الترحيم مع عرض الكارت وطباعته وشيره */}
          {activeMainTab === 'memorials' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-3xl border flex flex-wrap justify-between items-center gap-3">
                <div>
                  <h4 className="font-black text-gray-900 text-base">🕯️ طلبات الترحيم (أربعين / سنوية) ومراجعة الدفع</h4>
                  <p className="text-xs text-gray-500">يمكنك إخراج كارت الترحيم وطباعته أو مشاركته مباشرة، والطلبات المعلقة تعتمد من اللجنة أو أبونا لورقة المذبح.</p>
                </div>
                <button
                  onClick={() => { setEditingMemorialId(null); setMemForm(emptyMemorial); setShowMemorialForm(true); }}
                  className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl text-xs font-black cursor-pointer shadow"
                >
                  + إضافة كارت ترحيم (أربعين / سنوية)
                </button>
              </div>

              <div className="grid gap-3">
                {memorialRequests.map(m => (
                  <div key={m.id} className="p-4 rounded-3xl border bg-white flex flex-wrap justify-between items-center gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-amber-100 text-amber-950">{m.status}</span>
                        <strong className="text-base text-gray-900">{m.deceased_name}</strong>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-950 rounded-lg text-xs font-black">{m.memorial_type}</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        قداس: <strong>{m.mass_date}</strong> {m.mass_time ? `الساعة ${m.mass_time}` : ''} • {m.mass_order || 'القداس الأول'} • {m.altar_name || 'المذبح الرئيسي'} • مقدم الطلب: {m.requester_name}
                      </p>

                      {m.receipt_image_url && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setViewingImage(m.receipt_image_url)}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Image size={13} /> فتح صورة إيصال التحويل (Screenshot) ↗
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMemorialCardItem(m)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
                      >
                        <Share2 size={13} /> كارت الترحيم / طباعة وشير
                      </button>

                      {(isChurchCouncil || isPriest) && m.status === 'معلق' && (
                        <>
                          <button
                            onClick={() => handleApproveMemorial(m, false)}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                          >
                            اعتماد وتأكيد الدفع
                          </button>
                          <button
                            onClick={() => handleApproveMemorial(m, true)}
                            className="px-3 py-1.5 bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                          >
                            قبول كإخوة رب (مجاني)
                          </button>
                        </>
                      )}

                      {(isChurchCouncil || isPriest || isStaff || m.created_by === currentUser?.id) && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEditMemorial(m)}
                            className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 size={13} /> تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMemorial(m)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={13} /> حذف
                          </button>
                        </>
                      )}

                      {m.status === 'مقبول (معتمد للمذبح)' && (
                        <button
                          type="button"
                          onClick={() => { setPrintMemorialReceipt(m); setTimeout(() => window.print(), 100); }}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Printer size={13} /> إيصال
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* تبويب 3: كشف الترحيم المعتمد بالمذبح لأبونا */}
          {activeMainTab === 'priest_sheet' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-3xl flex flex-wrap justify-between items-center gap-3 print:hidden">
                <div>
                  <h4 className="font-black text-amber-950 text-base">📜 كشف صلاة الترحيم على المذبح (المعتمد فقط)</h4>
                  <p className="text-xs text-amber-900">يحتوي فقط على الأسماء التي تم قبولها واعتمادها من لجنة الكنيسة أو الآباء الكهنة.</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-700">تاريخ القداس:</label>
                  <input
                    type="date"
                    value={filterMassDate}
                    onChange={e => setFilterMassDate(e.target.value)}
                    className="p-2 border rounded-xl bg-white text-xs font-bold"
                  />
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <Printer size={15} /> طباعة الكشف للمذبح
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border shadow-sm">
                <div className="border-b-2 border-gray-900 pb-3 mb-4 text-center">
                  <h3 className="text-xl font-black text-gray-900">✝ كشف أسماء المنتقلين في صلاة الترحيم (القداس الإلهي)</h3>
                  <p className="text-xs text-gray-600 mt-1">كنيسة السيدة العذراء مريم • قداس يوم: <strong>{filterMassDate}</strong></p>
                </div>

                {approvedMassMemorials.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-xs font-bold">لا توجد أسماء معتمدة للمذبح لقداس هذا اليوم ({filterMassDate}).</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs md:text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-100 border-b text-gray-800">
                          <th className="p-3">#</th>
                          <th className="p-3">اسم المنتقل</th>
                          <th className="p-3">نوع التذكار</th>
                          <th className="p-3">القداس والمذبح</th>
                          <th className="p-3">مقدم الطلب</th>
                          <th className="p-3">الحالة / الاعتماد</th>
                          <th className="p-3 text-center">ملاحظات الكاهن على المذبح</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {approvedMassMemorials.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-amber-50/50">
                            <td className="p-3 font-bold">{idx + 1}</td>
                            <td className="p-3 font-black text-base text-gray-900">{item.deceased_name}</td>
                            <td className="p-3"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-bold">{item.memorial_type}</span></td>
                            <td className="p-3 text-xs font-bold">{item.mass_order || 'القداس الأول'} • {item.altar_name || 'المذبح الرئيسي'}</td>
                            <td className="p-3 text-gray-600">{item.requester_name} ({item.relationship})</td>
                            <td className="p-3">
                              {item.is_mercy_case ? (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded font-bold text-[11px]">إخوة الرب</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-bold text-[11px]">معتمد ({item.receipt_serial})</span>
                              )}
                            </td>
                            <td className="p-3 text-center text-gray-400">..............................</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* تبويب 4: كشف حساب وخرجات الفراشين والعشور */}
          {isFinanceAuthorized && activeMainTab === 'workers_stats' && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-3xl border space-y-4 print:hidden">
                <div className="border-b pb-3">
                  <h4 className="font-black text-gray-900 text-base flex items-center gap-2">
                    <Calculator size={18} className="text-indigo-900" /> كشف حساب وخرجات الفراشين (لحساب العشور أو الإكراميات)
                  </h4>
                  <p className="text-xs text-gray-500">
                    حدد الفراش والفترة الزمنية (شهر / موسم / سنة) لمعرفة إجمالي الخرجات والميتات التي قام بها وحساب مستحقاته.
                  </p>
                </div>

                <div className="grid sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">الفراش المطلوب:</label>
                    <select
                      className="w-full p-2 border rounded-xl bg-gray-50 text-xs font-bold"
                      value={statsWorkerName}
                      onChange={e => setStatsWorkerName(e.target.value)}
                    >
                      <option value="">-- عرض كل الفراشين --</option>
                      {josephTeamWorkers.map(w => (
                        <option key={w.id} value={w.full_name}>{w.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">من تاريخ:</label>
                    <input
                      type="date"
                      className="w-full p-2 border rounded-xl bg-gray-50 text-xs"
                      value={statsStartDate}
                      onChange={e => setStatsStartDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">إلى تاريخ:</label>
                    <input
                      type="date"
                      className="w-full p-2 border rounded-xl bg-gray-50 text-xs"
                      value={statsEndDate}
                      onChange={e => setStatsEndDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">إكرامية الخرجة الواحدة (ج.م):</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full p-2 border rounded-xl bg-gray-50 text-xs font-black text-emerald-800"
                      value={feePerTrip}
                      onChange={e => setFeePerTrip(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap justify-between items-center bg-indigo-50 p-4 rounded-2xl border border-indigo-200">
                  <div className="space-y-1">
                    <span className="text-xs text-indigo-900 block font-bold">إجمالي الخرجات في هذه الفترة:</span>
                    <strong className="text-xl text-indigo-950 font-black">{workerTrips.length} خرجة</strong>
                  </div>
                  <div className="space-y-1 text-left">
                    <span className="text-xs text-emerald-900 block font-bold">إجمالي المستحق / البركة المقترحة:</span>
                    <strong className="text-xl text-emerald-800 font-black">{totalWorkerFee} ج.م</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <Printer size={15} /> طباعة كشف الحساب للصرف
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border shadow-sm">
                <div className="border-b-2 border-gray-900 pb-3 mb-4 text-center">
                  <h3 className="text-xl font-black text-gray-900">✝ كشف بيان خرجات طاقم الفراشين (خدمة يوسف الرامي)</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    الفراش: <strong>{statsWorkerName || 'جميع الفراشين'}</strong> • الفترة من: <strong>{statsStartDate}</strong> إلى: <strong>{statsEndDate}</strong>
                  </p>
                </div>

                <table className="w-full text-right text-xs md:text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-800">
                      <th className="p-3">#</th>
                      <th className="p-3">تاريخ الخرجة</th>
                      <th className="p-3">اسم المنتقل</th>
                      <th className="p-3">مكان الدفن</th>
                      <th className="p-3">السائق المرافق</th>
                      <th className="p-3">طاقم الفراشين المشاركين بالخرجة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {workerTrips.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="p-3 font-bold">{idx + 1}</td>
                        <td className="p-3">{c.death_date}</td>
                        <td className="p-3 font-black text-gray-900">{c.deceased_name}</td>
                        <td className="p-3">{c.burial_location_name}</td>
                        <td className="p-3">{c.driver_name || '—'}</td>
                        <td className="p-3">
                          {Array.isArray(c.assistants) && c.assistants.length > 0
                            ? c.assistants.map(a => a.name).join('، ')
                            : c.assistant_worker_name || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t-2 border-gray-900 mt-6 pt-4 flex justify-between items-center text-xs md:text-sm font-bold">
                  <span>إجمالي عدد الخرجات: <strong>{workerTrips.length}</strong></span>
                  <span>المبلغ الإجمالي المستحق للصرف: <strong className="text-base text-emerald-800">{totalWorkerFee} ج.م</strong></span>
                  <span>توقيع أمين الصندوق / الكاهن: ........................</span>
                </div>
              </div>
            </div>
          )}

          {/* طباعة كارت الترحيم (ذكرى الأربعين / ذكرى سنوية) */}
          {printMemorialCard && (
            <div className="hidden print:block p-8 border-2 border-gray-900 rounded-3xl max-w-2xl mx-auto space-y-4">
              <div className="text-center border-b-2 border-gray-900 pb-3">
                <div className="text-2xl font-black">✝</div>
                <h2 className="text-xl font-black">{printMemorialCard.memorial_type || 'ذكرى الأربعين'}</h2>
                <p className="text-xs text-gray-700">«طُوبَى لِلَّذِينَ يَمُوتُونَ فِي الرَّبِّ مُنْذُ الآنَ» (رؤ 14: 13)</p>
              </div>
              <div className="grid grid-cols-3 items-center text-center gap-3 py-2">
                <VirginMaryCardBox compact />
                <div>
                  <div className="text-sm font-bold text-gray-700">{printMemorialCard.memorial_type || 'ذكرى الأربعين'}</div>
                  <div className="text-xl font-black mt-1">{printMemorialCard.deceased_name}</div>
                </div>
                <div className="border p-2 rounded-xl text-xs font-bold">✝ صلاة وترحيم على {printMemorialCard.altar_name || 'المذبح المقدس'}</div>
              </div>
              <div className="space-y-1.5 text-sm text-center">
                {printMemorialCard.church_name && <p><strong>الكنيسة:</strong> {printMemorialCard.church_name}</p>}
                <p><strong>القداس:</strong> {printMemorialCard.mass_order || 'القداس الأول'} {printMemorialCard.altar_name ? `— على ${printMemorialCard.altar_name}` : ''}</p>
                {(printMemorialCard.mass_date || printMemorialCard.mass_time) && (
                  <p><strong>التاريخ والساعة:</strong> {printMemorialCard.mass_date || ''} {printMemorialCard.mass_time ? `— الساعة ${printMemorialCard.mass_time}` : ''}</p>
                )}
                {printMemorialCard.needs_hall && printMemorialCard.hall_name && (
                  <p><strong>الاستقبال / القاعة:</strong> {printMemorialCard.hall_name} {printMemorialCard.hall_slot ? `(${printMemorialCard.hall_slot})` : ''}</p>
                )}
              </div>
              <div className="text-center text-xs font-bold border-t pt-2">
                اذكرونا في صلواتكم • المسيح يعزي الأسرة وجميع محبيهم
              </div>
            </div>
          )}

          {/* أمر الطباعة الكامل لحالة الوفاة وخط السير والقاعة */}
          {printCase && (
            <div className="hidden print:block p-8 border-2 border-gray-900 rounded-2xl space-y-4">
              <div className="flex justify-between items-center border-b-2 border-[#7a1c24] pb-3">
                <h2 className="text-xl font-black text-[#7a1c24]">✝ بيان خدمة يوسف الرامي وخط سير السائق والقاعة</h2>
                <span className="text-xs">تاريخ الطباعة: {todayISO}</span>
              </div>
              <div className="space-y-2 text-sm">
                <p><strong>اسم المنتقل:</strong> {printCase.deceased_name} ({printCase.deceased_age})</p>
                <p><strong>المُبلّغ ودرجة القرابة:</strong> {printCase.reported_by_name} ({printCase.relationship_degree})</p>
                <p><strong>تاريخ وساعة الانتقال:</strong> {printCase.death_date} — {printCase.death_time}</p>
                <p><strong>مكان التحرك ({printCase.death_place_type}):</strong> {printCase.death_place_details}</p>
                <p><strong>ميعاد التجنيز بالكنيسة:</strong> {printCase.funeral_date} الساعة {printCase.funeral_time}</p>
                <p><strong>مكان الدفن:</strong> {printCase.burial_location_name} — <strong>رسوم الانتقال:</strong> {printCase.transport_fee} ج.م</p>
                {printCase.needs_hall && (
                  <p><strong>قاعة الكنيسة المحجوزة:</strong> {printCase.hall_name} ({printCase.hall_purpose} - {printCase.hall_date} - {printCase.hall_slot})</p>
                )}
                <p><strong>الصندوق المختار:</strong> {printCase.casket_name}</p>
                <p><strong>السائق:</strong> {printCase.driver_name} ({printCase.driver_phone})</p>
                <p>
                  <strong>طاقم الفراشين المرافقين:</strong>{' '}
                  {Array.isArray(printCase.assistants) && printCase.assistants.length > 0
                    ? printCase.assistants.map(a => `${a.name} (${a.phone || '—'})`).join(' • ')
                    : printCase.assistant_worker_name || '—'}
                </p>
                <p><strong>المتواصل من الأسرة:</strong> {printCase.family_contact_name} ({printCase.family_contact_phone})</p>
              </div>
            </div>
          )}

          {/* طباعة إيصال الترحيم الرسمي للمستخدم */}
          {printMemorialReceipt && (
            <div className="hidden print:block p-8 border-2 border-gray-900 rounded-3xl max-w-lg mx-auto space-y-4">
              <div className="text-center border-b-2 border-gray-900 pb-3">
                <h2 className="text-lg font-black">✝ إيصال ترحيم رسمي وتبرع</h2>
                <p className="text-xs text-gray-600">{printMemorialReceipt.church_name || 'كنيسة السيدة العذراء مريم'} — خدمة يوسف الرامي</p>
              </div>
              <div className="space-y-2 text-sm">
                <p className="flex justify-between"><span>رقم الإيصال:</span> <strong className="font-mono">{printMemorialReceipt.receipt_serial}</strong></p>
                <p className="flex justify-between"><span>اسم المنتقل:</span> <strong className="font-bold text-base">{printMemorialReceipt.deceased_name}</strong></p>
                <p className="flex justify-between"><span>المناسبة:</span> <span>{printMemorialReceipt.memorial_type}</span></p>
                <p className="flex justify-between"><span>الكنيسة:</span> <span>{printMemorialReceipt.church_name || 'كنيسة السيدة العذراء مريم'}</span></p>
                <p className="flex justify-between"><span>القداس والمذبح:</span> <span>{printMemorialReceipt.mass_order || 'القداس الأول'} — {printMemorialReceipt.altar_name || 'المذبح الرئيسي'}</span></p>
                <p className="flex justify-between"><span>تاريخ القداس الإلهي:</span> <strong>{printMemorialReceipt.mass_date} {printMemorialReceipt.mass_time ? `(${printMemorialReceipt.mass_time})` : ''}</strong></p>
                {printMemorialReceipt.needs_hall && (
                  <p className="flex justify-between"><span>قاعة الكنيسة:</span> <span>{printMemorialReceipt.hall_name} ({printMemorialReceipt.hall_slot})</span></p>
                )}
                <p className="flex justify-between"><span>مقدم الطلب:</span> <span>{printMemorialReceipt.requester_name} ({printMemorialReceipt.relationship})</span></p>
                <p className="flex justify-between"><span>حالة الاعتماد:</span> <strong className="text-emerald-800">{printMemorialReceipt.status}</strong></p>
                {Number(printMemorialReceipt.donation_amount || 0) > 0 && (
                  <p className="flex justify-between border-t pt-2">
                    <span>مبلغ التبرع:</span> <strong>{printMemorialReceipt.donation_amount} ج.م ({printMemorialReceipt.payment_method})</strong>
                  </p>
                )}
                {printMemorialReceipt.instapay_ref && (
                  <p className="flex justify-between text-xs text-gray-500"><span>رقم معاملة InstaPay:</span> <span>{printMemorialReceipt.instapay_ref}</span></p>
                )}
              </div>
              <div className="text-center text-[10px] text-gray-400 border-t pt-2">
                اذكرنا في صلواتك • المسيح يعزيكم
              </div>
            </div>
          )}

          {/* نافذة معاينة صورة الإيصال المنبثقة */}
          {viewingImage && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-white p-4 rounded-3xl max-w-lg w-full space-y-3 text-center">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-bold text-xs text-gray-700">صورة إيصال التحويل المرفقة</span>
                  <button onClick={() => setViewingImage(null)} className="text-gray-500 font-bold text-sm">✕ إغلاق</button>
                </div>
                <img src={viewingImage} alt="Receipt" className="max-h-[70dvh] mx-auto rounded-2xl object-contain border" />
                <a
                  href={viewingImage}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-700 font-bold underline"
                >
                  فتح الصورة في نافذة منفصلة <ExternalLink size={13} />
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import UserFormModal from '../components/admin/UserFormModal';
import {
  DEFAULT_CHURCH_NAME,
  SYSTEM_KINDS,
  readTheme,
  readSections,
  readSubSections,
  probeSchema,
  buildThemeCss,
  MARY_SHAPES,
  sortContent,
  isItemLive,
  looksLikeSystemJson,
  getItemSchedule,
  parseISODate,
  startOfToday,
  combineDateTime,
  formatDateFull,
  formatDateShort,
  monthShort,
  relativeDayLabel,
  toEmbedUrl,
  youtubeThumb,
  isDirectVideo,
  isImageUrl,
  isSafeHttpUrl,
  extractPhone
} from '../lib/publicContent';
import {
  Church, Radio, Calendar, MapPin, Bus, Layers, LogIn, UserPlus, X, ExternalLink,
  Newspaper, ArrowRight, Video, Sparkles, Plus, Edit3, Settings, Image as ImageIcon,
  ChevronDown, ChevronLeft, ChevronRight, Phone, Play, Clock, ArrowUp, RefreshCw,
  Moon, Sun, AlertTriangle
} from 'lucide-react';

const emptyVisitorForm = {
  first_name: '', second_name: '', third_name: '', fourth_name: '',
  username: '', password: '', role: 'member', gender: 'ذكر', marital_status: 'single',
  is_parent_guardian: false, is_parish: false, is_site_observer: false,
  service_membership_status: 'in_service', guardian_type: '', family_role: 'مخدوم',
  dob: '', member_status: 'active', is_deacon: false, deacon_rank: '', church_job: '',
  detailed_stage: '', assigned_class: '', confession_father_id: '', parent_id: '',
  father_id: '', mother_id: '', phone: '', job_title: '', sector: '', address: '', permissions: {}
};

const NAV_FALLBACK = {
  'sec-hanna': 'كلمة أبونا',
  'sec-media': 'الصور والفيديو',
  'sec-news': 'الأخبار',
  'sec-masses': 'القداسات',
  'sec-trips': 'الرحلات',
  'sec-priests': 'الآباء',
  'sec-history': 'التاريخ'
};

const CROSS_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'%3E%3Cpath d='M36 22v28M26 32h20' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' fill='none'/%3E%3C/svg%3E")`;

/* ───────────────────────── مكونات مساعدة ───────────────────────── */

function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.06, rootMargin: '0px 0px -30px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`pp-reveal ${shown ? 'pp-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function CountUp({ value = 0 }) {
  const ref = useRef(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let raf = 0;
    let started = false;
    const run = () => {
      if (started) return;
      started = true;
      const t0 = performance.now();
      const dur = 900;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setN(value);
      return undefined;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        run();
        io.disconnect();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);
  return <span ref={ref}>{n}</span>;
}

function ExpandableText({ text = '', limit = 360, className = '' }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > limit;
  return (
    <div>
      <p className={`whitespace-pre-line ${className}`}>{open || !long ? text : `${text.slice(0, limit).trim()}…`}</p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="mt-1.5 text-xs font-black text-[#7a1c24] hover:underline cursor-pointer inline-flex items-center gap-1"
        >
          {open ? 'عرض أقل' : 'قراءة المزيد'}
          <ChevronDown size={13} className={open ? 'rotate-180 transition' : 'transition'} />
        </button>
      )}
    </div>
  );
}

function SectionHeader({ icon, title, count, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-amber-600 text-xs font-black tracking-wide mb-1">
          <span className="h-px w-8 bg-amber-400" />
          <span>{icon}</span>
        </div>
        <h2 className="text-xl md:text-3xl font-black text-[#5c1319] leading-tight">
          {title}
          {typeof count === 'number' && count > 0 && (
            <span className="mr-2 align-middle text-xs font-black px-2 py-0.5 rounded-full bg-[#7a1c24]/10 text-[#7a1c24]">{count}</span>
          )}
        </h2>
      </div>
      {children}
    </div>
  );
}

function Pill({ children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black ${className}`}>{children}</span>;
}

function DateTile({ date, className = '' }) {
  if (!date) return null;
  return (
    <div className={`w-14 shrink-0 rounded-2xl overflow-hidden text-center shadow-sm border border-[#7a1c24]/15 bg-white ${className}`}>
      <div className="bg-[#7a1c24] text-amber-100 text-[10px] font-black py-0.5">{monthShort(date)}</div>
      <div className="text-xl font-black text-[#5c1319] leading-none py-1.5">{date.getDate()}</div>
    </div>
  );
}

function Lightbox({ list, index, onClose, onIndex }) {
  const item = list[index];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onIndex((index + 1) % list.length);
      if (e.key === 'ArrowRight') onIndex((index - 1 + list.length) % list.length);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [index, list.length, onClose, onIndex]);
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center p-3 md:p-8" onClick={onClose} role="dialog" aria-modal="true">
      <button type="button" onClick={onClose} aria-label="إغلاق" className="absolute top-4 left-4 p-2.5 rounded-full bg-white/15 hover:bg-white/30 text-white cursor-pointer">
        <X size={20} />
      </button>
      {list.length > 1 && (
        <>
          <button type="button" aria-label="السابق" onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + list.length) % list.length); }} className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/15 hover:bg-white/30 text-white cursor-pointer">
            <ChevronRight size={22} />
          </button>
          <button type="button" aria-label="التالي" onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % list.length); }} className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/15 hover:bg-white/30 text-white cursor-pointer">
            <ChevronLeft size={22} />
          </button>
        </>
      )}
      <figure className="max-w-5xl w-full max-h-full flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <img src={item.url} alt={item.title} className="max-h-[78dvh] max-w-full rounded-2xl object-contain shadow-2xl" />
        <figcaption className="text-center text-white space-y-0.5">
          <strong className="block text-base">{item.title}</strong>
          {item.body && <span className="block text-sm text-white/75">{item.body}</span>}
          <span className="block text-[11px] text-white/50">{index + 1} / {list.length}</span>
        </figcaption>
      </figure>
    </div>
  );
}

function VideoModal({ item, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  if (!item) return null;
  const embed = toEmbedUrl(item.url);
  const direct = isDirectVideo(item.url);
  return (
    <div className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center p-3 md:p-8" onClick={onClose} role="dialog" aria-modal="true">
      <button type="button" onClick={onClose} aria-label="إغلاق" className="absolute top-4 left-4 p-2.5 rounded-full bg-white/15 hover:bg-white/30 text-white cursor-pointer">
        <X size={20} />
      </button>
      <div className="w-full max-w-4xl space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl">
          {embed ? (
            <iframe src={`${embed}${embed.includes('?') ? '&' : '?'}autoplay=1`} title={item.title} className="w-full h-full" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
          ) : direct ? (
            <video src={item.url} controls autoPlay playsInline className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <a href={item.url} target="_blank" rel="noreferrer" className="px-5 py-3 bg-amber-400 text-[#4a0e13] rounded-xl font-black inline-flex items-center gap-2">
                <ExternalLink size={16} /> فتح الفيديو
              </a>
            </div>
          )}
        </div>
        <div className="text-white text-center">
          <strong className="block text-base">{item.title}</strong>
          {item.body && <span className="block text-sm text-white/70 mt-0.5">{item.body}</span>}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── الصفحة ───────────────────────── */

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
  const [loadError, setLoadError] = useState('');

  const [editMode, setEditMode] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [videoItem, setVideoItem] = useState(null);
  const [mediaFilter, setMediaFilter] = useState('all');
  const [mediaLimit, setMediaLimit] = useState(6);
  const [newsLimit, setNewsLimit] = useState(5);
  const [openTrip, setOpenTrip] = useState(null);
  const [activeAnchor, setActiveAnchor] = useState('');
  const [showTop, setShowTop] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const [showRegister, setShowRegister] = useState(false);
  const [visitorForm, setVisitorForm] = useState(emptyVisitorForm);
  const [regLists, setRegLists] = useState({ groups: [], services: [], ranks: [] });

  const loadPublic = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      await probeSchema(supabase);
      const [pc, ev, ms, tr, pps, st] = await Promise.all([
        supabase.from('church_public_content').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
        supabase.from('church_events').select('*').order('created_at', { ascending: false }),
        supabase.from('priest_masses').select('*').eq('is_available', true).order('mass_date', { ascending: true }),
        supabase.from('church_trips').select('*').eq('is_public', true).order('trip_date', { ascending: true }),
        supabase.from('priest_personal_schedule').select('*').eq('is_public', true).order('event_date', { ascending: true }),
        supabase.from('church_settings').select('virgin_mary_image_url').limit(1).maybeSingle()
      ]);
      if (pc.error) throw pc.error;
      setItems(pc.data || []);
      if (ev.data) setEvents(ev.data);
      if (ms.data) setMasses(ms.data);
      if (tr.data) setPublicTrips(tr.data);
      if (pps.data) setPriestPublicTrips(pps.data.filter(x => x.event_type === 'رحلة كنسية 🚌' || x.event_type === 'مؤتمر روحي 🏕️'));
      if (st.data?.virgin_mary_image_url) setMarySettingsUrl(st.data.virgin_mary_image_url);
    } catch (err) {
      setLoadError(err?.message || 'تعذر تحميل صفحة الكنيسة');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPublic();
  }, [loadPublic]);

  // تحديث تلقائي هادئ: لما المستخدم يرجع للصفحة أو التطبيق يرجع للواجهة، وكل دقيقتين
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - last < 20000) return;
      last = Date.now();
      loadPublic(true);
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    const t = setInterval(refresh, 120000);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      clearInterval(t);
    };
  }, [loadPublic]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // بيانات نموذج التسجيل بتتحمل عند الفتح بس (مش مع كل زيارة)
  const openRegister = async () => {
    setVisitorForm(emptyVisitorForm);
    setShowRegister(true);
    try {
      const [g, s, r] = await Promise.all([
        supabase.from('service_groups').select('*'),
        supabase.from('church_services').select('*'),
        supabase.from('deacon_ranks').select('*')
      ]);
      setRegLists({
        groups: !g.error && Array.isArray(g.data) ? g.data : [],
        services: !s.error && Array.isArray(s.data) ? s.data : [],
        ranks: !r.error && Array.isArray(r.data) ? r.data : []
      });
    } catch {
      // النموذج يشتغل بقوائم فاضية
    }
  };

  const availableServantServices = useMemo(
    () => [...new Set([
      ...regLists.services.map(s => s.service_name || s.stage_name).filter(Boolean),
      ...regLists.groups.map(g => g.group_name).filter(Boolean)
    ])],
    [regLists]
  );

  /* ───── تجهيز البيانات ───── */
  const { theme } = useMemo(() => readTheme(items), [items]);
  const sections = useMemo(() => readSections(items), [items]);
  const subSections = useMemo(() => readSubSections(items), [items]);
  const massesMeta = subSections[0];
  const tripsMeta = subSections[1];
  const adminOn = canEdit && editMode;

  const customCategories = useMemo(() => items.filter(i => i.kind === 'category_def'), [items]);

  const visibleItems = useMemo(
    () => items.filter(i => !SYSTEM_KINDS.includes(i.kind) && !looksLikeSystemJson(i) && isItemLive(i, { isEditor: adminOn })),
    [items, adminOn]
  );
  const ofKind = useCallback((k) => sortContent(visibleItems.filter(i => i.kind === k)), [visibleItems]);

  const logoConfig = items.find(i => i.kind === 'logo');
  const maryConfig = items.find(i => i.kind === 'virgin_mary');
  const activeMaryUrl = maryConfig?.url || marySettingsUrl || '';
  const churchTitle = logoConfig?.title || churchName || DEFAULT_CHURCH_NAME;
  const churchSubtitle = logoConfig?.body || 'مواعيد القداسات، مكتب الرحلات العامة، أخبار الكنيسة، والآباء الكهنة';
  const churchTagline = logoConfig?.time_text || 'أهلاً بكم في بيت الرب';

  const hannaWords = ofKind('hanna_word');
  const images = ofKind('image');
  const videos = ofKind('video');
  const livestreams = ofKind('livestream');
  const histories = ofKind('history');
  const priestBios = ofKind('priest_bio');
  const newsItems = ofKind('news');
  const socialLinks = [...ofKind('facebook_page'), ...ofKind('youtube_channel')];
  const featuredLive = livestreams[0] || null;
  const featuredVideo = videos[0] || null;

  // القداسات (مواعيد ثابتة + قادمة بتاريخ)
  const massRows = useMemo(() => {
    const rows = [];
    ofKind('mass').forEach(m => {
      const s = getItemSchedule(m);
      rows.push({ id: `c${m.id}`, raw: m, src: 'content', title: m.title, date: s.date, time: s.time, place: m.location, note: m.body, url: m.url });
    });
    masses.forEach(m => {
      rows.push({
        id: `p${m.id}`, raw: m, src: 'priest', title: m.mass_name, date: parseISODate(m.mass_date), time: m.mass_time,
        place: [m.church_name, m.target_audience].filter(Boolean).join(' • '), note: '', url: ''
      });
    });
    return rows;
  }, [ofKind, masses]);

  const recurringMasses = massRows.filter(r => !r.date);
  const upcomingMasses = useMemo(
    () => massRows
      .filter(r => r.date && r.date.getTime() >= startOfToday().getTime())
      .sort((a, b) => combineDateTime(a.date, a.time) - combineDateTime(b.date, b.time)),
    [massRows]
  );
  const massGroups = useMemo(() => {
    const map = new Map();
    upcomingMasses.forEach(r => {
      const k = r.date.getTime();
      if (!map.has(k)) map.set(k, { date: r.date, rows: [] });
      map.get(k).rows.push(r);
    });
    return [...map.values()];
  }, [upcomingMasses]);

  const pastMassGroups = useMemo(() => {
    const map = new Map();
    massRows
      .filter(r => r.date && r.date.getTime() < startOfToday().getTime())
      .sort((a, b) => combineDateTime(b.date, b.time) - combineDateTime(a.date, a.time))
      .forEach(r => {
        const k = r.date.getTime();
        if (!map.has(k)) map.set(k, { date: r.date, rows: [] });
        map.get(k).rows.push(r);
      });
    return [...map.values()];
  }, [massRows]);
  const pastMassCount = pastMassGroups.reduce((n, g) => n + g.rows.length, 0);

  const nextMass = useMemo(
    () => upcomingMasses.find(r => combineDateTime(r.date, r.time) >= now) || null,
    [upcomingMasses, now]
  );

  const allTripRows = useMemo(() => {
    const rows = [];
    publicTrips.forEach(tr => {
      const date = parseISODate(tr.trip_date);
      rows.push({
        id: `t${tr.id}`, title: tr.title, date, dateText: tr.trip_date || 'قريباً', cost: Number(tr.cost_per_person) || 0,
        overnight: Number(tr.days_count || 1) > 1 || (Array.isArray(tr.rooms) && tr.rooms.length > 0), days: tr.days_count,
        tag: tr.trip_category || 'مكتب الرحلات', places: tr.monasteries,
        times: [tr.gathering_time && `التجمع ${tr.gathering_time}`, tr.departure_time && `التحرك ${tr.departure_time}`, tr.return_time && `العودة ${tr.return_time}`].filter(Boolean).join(' • '),
        program: tr.daily_program
      });
    });
    priestPublicTrips.forEach(pt => {
      rows.push({
        id: `s${pt.id}`, title: pt.title, date: parseISODate(pt.event_date), dateText: pt.event_date || 'قريباً', cost: Number(pt.trip_cost) || 0,
        overnight: false, tag: pt.event_type, audience: pt.target_service, places: pt.destinations, times: '', program: pt.daily_program
      });
    });
    ofKind('trip').forEach(tr => {
      const s = getItemSchedule(tr);
      rows.push({
        id: `c${tr.id}`, raw: tr, title: tr.title, date: s.date, dateText: s.date ? formatDateShort(s.date) : s.time || 'قريباً',
        cost: 0, overnight: false, tag: 'إعلان رحلة', places: tr.location, times: s.date ? s.time : '', program: tr.body, url: tr.url
      });
    });
    return rows.sort((a, b) => (a.date ? a.date.getTime() : Infinity) - (b.date ? b.date.getTime() : Infinity));
  }, [publicTrips, priestPublicTrips, ofKind]);
  const tripRows = useMemo(() => allTripRows.filter(r => !r.date || r.date.getTime() >= startOfToday().getTime()), [allTripRows]);
  const pastTripRows = useMemo(() => allTripRows.filter(r => r.date && r.date.getTime() < startOfToday().getTime()).reverse(), [allTripRows]);
  const [showPastTrips, setShowPastTrips] = useState(false);
  const [showPastMasses, setShowPastMasses] = useState(false);

  const newsCards = useMemo(() => {
    const cards = newsItems.map(n => ({ type: 'news', id: `n${n.id}`, raw: n, ...getItemSchedule(n) }));
    events.forEach(ev => cards.push({ type: 'event', id: `e${ev.id}`, raw: ev, date: null, time: ev.event_time || '' }));
    return cards;
  }, [newsItems, events]);

  const mediaList = useMemo(() => {
    const imgs = images.map(i => ({ ...i, _t: 'image' }));
    const vids = videos.map(v => ({ ...v, _t: 'video' }));
    return mediaFilter === 'image' ? imgs : mediaFilter === 'video' ? vids : [...imgs, ...vids];
  }, [images, videos, mediaFilter]);

  const tickerItems = [
    ...hannaWords.map(hw => `✝ ${hw.title}`),
    ...newsItems.map(n => `📰 ${n.title}`),
    ...events.map(e => `✨ ${e.title}${e.event_time ? ` — ${e.event_time}` : ''}`)
  ];

  const sectionVisible = (key) => {
    const s = sections.find(x => x.key === key);
    return adminOn || !s?.hidden;
  };
  const sectionTitle = (key) => sections.find(x => x.key === key)?.title || '';

  /* ───── التنقل ───── */
  const navItems = useMemo(() => {
    const list = [];
    sections.forEach(s => {
      if (s.key === 'summary' || !sectionVisible(s.key)) return;
      if (s.key === 'masses_trips') {
        if (!massesMeta.hidden || adminOn) list.push({ anchor: 'sec-masses', full: massesMeta.title, label: massesMeta.title.length <= 22 ? massesMeta.title : NAV_FALLBACK['sec-masses'], icon: '⛪', tone: 'gold' });
        if (!tripsMeta.hidden || adminOn) list.push({ anchor: 'sec-trips', full: tripsMeta.title, label: tripsMeta.title.length <= 22 ? tripsMeta.title : NAV_FALLBACK['sec-trips'], icon: '🚌' });
        return;
      }
      const label = s.title.length <= 22 ? s.title : NAV_FALLBACK[s.anchor];
      list.push({ anchor: s.anchor, full: s.title, label, icon: s.icon, tone: s.key === 'hanna_word' ? 'gold' : '' });
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, massesMeta, tripsMeta, hannaWords.length, images.length, videos.length, newsCards.length, priestBios.length, histories.length, massRows.length, tripRows.length, adminOn]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const els = navItems.map(n => document.getElementById(n.anchor)).filter(Boolean);
    if (els.length === 0) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (vis) setActiveAnchor(vis.target.id);
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.2, 0.5] }
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [navItems]);

  const goTo = (anchor) => {
    const el = document.getElementById(anchor);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ───── أدوات الأدمن ───── */
  const openEditorFor = (focus) => {
    if (onOpenEditor) onOpenEditor(focus);
  };
  const EditChip = ({ item }) => (adminOn ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); openEditorFor({ itemId: item.id }); }}
      className="p-1.5 bg-white/95 hover:bg-amber-100 text-gray-800 rounded-lg shadow cursor-pointer inline-flex items-center gap-1 text-[11px] font-black"
      title="تعديل في المحرر"
    >
      <Edit3 size={12} /> تعديل
    </button>
  ) : null);
  const DraftBadge = ({ item }) => (adminOn && item.is_published === false ? <Pill className="bg-gray-800 text-white">مسودة</Pill> : null);
  const AddChip = ({ kind, label = 'إضافة' }) => (adminOn ? (
    <button
      type="button"
      onClick={() => openEditorFor({ kind })}
      className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 rounded-xl text-xs font-black cursor-pointer inline-flex items-center gap-1"
    >
      <Plus size={13} /> {label}
    </button>
  ) : null);
  const HiddenBanner = ({ k }) => {
    const s = sections.find(x => x.key === k);
    return adminOn && s?.hidden ? (
      <div className="mb-3 px-3 py-2 rounded-xl bg-gray-900 text-amber-200 text-xs font-bold flex items-center gap-2">
        <AlertTriangle size={14} /> هذا القسم مخفي عن الزوار حالياً — يظهر لك فقط في وضع التحرير.
      </div>
    ) : null;
  };

  /* ───── العدّاد للقداس القادم ───── */
  const countdown = useMemo(() => {
    if (!nextMass) return null;
    const target = combineDateTime(nextMass.date, nextMass.time);
    const mins = Math.max(0, Math.round((target - now) / 60000));
    const days = Math.floor(mins / 1440);
    const hours = Math.floor((mins % 1440) / 60);
    const m = mins % 60;
    if (days >= 1) return `بعد ${days} ${days === 1 ? 'يوم' : 'أيام'}${hours ? ` و${hours} ساعة` : ''}`;
    if (hours >= 1) return `بعد ${hours} ساعة${m ? ` و${m} دقيقة` : ''}`;
    return mins <= 1 ? 'يبدأ الآن' : `بعد ${m} دقيقة`;
  }, [nextMass, now]);

  const stats = [
    { key: 'masses', label: 'مواعيد القداسات', value: massRows.length, icon: <Church size={20} />, anchor: 'sec-masses', show: massRows.length > 0 },
    { key: 'trips', label: 'رحلات ومؤتمرات', value: tripRows.length, icon: <Bus size={20} />, anchor: 'sec-trips', show: tripRows.length > 0 },
    { key: 'news', label: 'أخبار وفعاليات', value: newsCards.length, icon: <Newspaper size={20} />, anchor: 'sec-news', show: newsCards.length > 0 },
    { key: 'media', label: 'صور وفيديوهات', value: images.length + videos.length, icon: <ImageIcon size={20} />, anchor: 'sec-media', show: images.length + videos.length > 0 }
  ].filter(s => s.show);

  /* ───────────────────────── العرض ───────────────────────── */

  const renderNewsCard = (card, idx) => {
    if (card.type === 'event') {
      const ev = card.raw;
      return (
        <article key={card.id} className="group relative p-5 rounded-3xl bg-linear-to-br from-amber-50 to-white border border-amber-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition">
          <Pill className="bg-amber-200/70 text-amber-950">✨ {ev.event_type || 'فعالية'}</Pill>
          <h3 className="mt-3 text-base font-black text-gray-900 leading-snug">{ev.title}</h3>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 font-bold">
            {ev.event_time && <span className="inline-flex items-center gap-1"><Clock size={13} /> {ev.event_time}</span>}
            {ev.place && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {ev.place}</span>}
          </div>
        </article>
      );
    }
    const n = card.raw;
    const featured = idx === 0 && newsItems.length > 1;
    const hasImg = n.url && isImageUrl(n.url);
    const isLink = n.url && !hasImg && isSafeHttpUrl(n.url);
    return (
      <article
        key={card.id}
        className={`group relative overflow-hidden rounded-3xl bg-white border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition flex flex-col ${featured ? 'md:col-span-2 md:flex-row' : ''}`}
      >
        {hasImg && (
          <button
            type="button"
            onClick={() => setLightbox({ list: [{ url: n.url, title: n.title, body: n.body }], index: 0 })}
            className={`relative overflow-hidden shrink-0 cursor-zoom-in ${featured ? 'md:w-1/2 h-56 md:h-auto' : 'h-44'}`}
            aria-label={`تكبير صورة ${n.title}`}
          >
            <img src={n.url} alt={n.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-700" />
          </button>
        )}
        <div className="p-5 flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex items-start gap-3">
            <DateTile date={card.date} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {n.is_featured && <Pill className="bg-amber-400 text-[#4a0e13]">⭐ مميز</Pill>}
                {card.date && relativeDayLabel(card.date) && relativeDayLabel(card.date) !== 'انتهى' && (
                  <Pill className="bg-emerald-100 text-emerald-900">{relativeDayLabel(card.date)}</Pill>
                )}
                <DraftBadge item={n} />
              </div>
              <h3 className={`font-black text-[#5c1319] leading-snug ${featured ? 'text-lg md:text-2xl' : 'text-base'}`}>{n.title}</h3>
            </div>
            <EditChip item={n} />
          </div>
          {n.body && (
            featured
              ? <ExpandableText text={n.body} limit={280} className="text-sm text-gray-700 leading-7" />
              : <p className="text-sm text-gray-700 leading-7 line-clamp-3 whitespace-pre-line">{n.body}</p>
          )}
          <div className="mt-auto pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 font-bold">
            {card.date && <span className="inline-flex items-center gap-1"><Calendar size={13} /> {formatDateFull(card.date)}</span>}
            {card.time && <span className="inline-flex items-center gap-1"><Clock size={13} /> {card.time}</span>}
            {n.location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {n.location}</span>}
            {isLink && (
              <a href={n.url} target="_blank" rel="noreferrer" className="mr-auto inline-flex items-center gap-1 text-[#7a1c24] hover:underline">
                المزيد <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </article>
    );
  };

  const renderMassRow = (r) => (
    <div key={r.id} className="p-3.5 rounded-2xl bg-[#fbfaf7] border border-gray-200 flex items-start justify-between gap-3 relative">
      <div className="min-w-0 space-y-0.5">
        <strong className="block text-sm text-gray-900">{r.title}</strong>
        {r.note && <span className="block text-xs text-gray-600 whitespace-pre-line">{r.note}</span>}
        {r.place && <span className="text-xs text-gray-500 inline-flex items-center gap-1"><MapPin size={12} /> {r.place}</span>}
        {r.url && isSafeHttpUrl(r.url) && (
          <a href={r.url} target="_blank" rel="noreferrer" className="block text-xs font-black text-red-700 hover:underline">
            <Radio size={12} className="inline ml-1" /> متابعة البث
          </a>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {r.time && <span className="px-3 py-1 rounded-xl bg-[#7a1c24] text-amber-50 text-xs font-black">{r.time}</span>}
        {r.src === 'content' && <EditChip item={r.raw} />}
        {r.src === 'content' && <DraftBadge item={r.raw} />}
      </div>
    </div>
  );

  const renderSection = (s) => {
    if (!sectionVisible(s.key)) return null;

    if (s.key === 'hanna_word') {
      
      const [first, ...rest] = hannaWords;
      const embed = first ? toEmbedUrl(first.url) : '';
      const direct = first ? isDirectVideo(first.url) : false;
      const portrait = first && first.url && !embed && !direct ? first.url : '';
      return (
        <section key={s.key} id="sec-hanna" className="scroll-mt-32">
          <HiddenBanner k={s.key} />
          <Reveal>
            <SectionHeader icon="✝" title={s.title}>
              <AddChip kind="hanna_word" label="إضافة / تحديث كلمة" />
            </SectionHeader>
            {first ? (
              <div className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-amber-50 via-white to-orange-50 border border-amber-200 shadow-md p-6 md:p-10">
                <span aria-hidden className="absolute -top-4 right-5 text-[8rem] leading-none font-serif text-amber-300/50 select-none">“</span>
                <div className="relative grid md:grid-cols-[auto_1fr] gap-6 items-start">
                  {portrait ? (
                    <img src={portrait} alt={first.title} loading="lazy" className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover ring-4 ring-amber-300 shadow-lg mx-auto" />
                  ) : (
                    <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-[#7a1c24] text-amber-200 flex items-center justify-center text-5xl font-black ring-4 ring-amber-300 shadow-lg mx-auto">✝</div>
                  )}
                  <div className="space-y-3 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg md:text-2xl font-black text-[#7a1c24]">{first.title}</h3>
                        {first.time_text && <Pill className="mt-1.5 bg-amber-200/70 text-amber-950"><Calendar size={12} /> {getItemSchedule(first).date ? formatDateFull(getItemSchedule(first).date) : first.time_text}</Pill>}
                      </div>
                      <div className="flex items-center gap-1.5"><DraftBadge item={first} /><EditChip item={first} /></div>
                    </div>
                    <ExpandableText text={first.body} limit={420} className="text-sm md:text-base text-gray-800 leading-8" />
                  </div>
                </div>
                {embed && (
                  <div className="relative mt-6 aspect-video max-w-2xl mx-auto rounded-2xl overflow-hidden bg-black shadow-lg">
                    <iframe src={embed} title={first.title} className="w-full h-full" allowFullScreen />
                  </div>
                )}
                {direct && <video src={first.url} controls className="relative mt-6 w-full max-w-2xl mx-auto aspect-video rounded-2xl bg-black shadow-lg" />}
              </div>
            ) : (
              <div className="p-6 rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 text-sm text-amber-900">لم تُضف كلمة بعد — ستظهر هنا الكلمة الروحية لأبونا حنا فؤاد فور نشرها.</div>
            )}
            {rest.length > 0 && (
              <details className="mt-3 group rounded-2xl bg-white border border-amber-200">
                <summary className="px-4 py-3 cursor-pointer text-sm font-black text-[#7a1c24] flex items-center justify-between">
                  كلمات وتأملات سابقة ({rest.length}) <ChevronDown size={16} className="group-open:rotate-180 transition" />
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  {rest.map(hw => (
                    <div key={hw.id} className="p-3 rounded-xl bg-[#fbfaf7] border">
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-sm text-[#7a1c24]">{hw.title}</strong>
                        <div className="flex items-center gap-1"><DraftBadge item={hw} /><EditChip item={hw} /></div>
                      </div>
                      {hw.time_text && <span className="text-[11px] text-gray-500 font-bold">{hw.time_text}</span>}
                      <ExpandableText text={hw.body} limit={220} className="mt-1 text-sm text-gray-700 leading-7" />
                    </div>
                  ))}
                </div>
              </details>
            )}
          </Reveal>
        </section>
      );
    }

    if (s.key === 'media') {
      
      const shown = mediaList.slice(0, mediaLimit);
      const imgOnly = mediaList.filter(m => m._t === 'image');
      return (
        <section key={s.key} id="sec-media" className="scroll-mt-32">
          <HiddenBanner k={s.key} />
          <Reveal>
            <SectionHeader icon="📸" title={s.title} count={images.length + videos.length}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex p-1 rounded-2xl bg-white border shadow-2xs text-xs font-black" role="tablist">
                  {[['all', 'الكل'], ['image', `صور (${images.length})`], ['video', `فيديو (${videos.length})`]].map(([k, l]) => (
                    <button key={k} type="button" role="tab" aria-selected={mediaFilter === k} onClick={() => { setMediaFilter(k); setMediaLimit(6); }}
                      className={`px-3.5 py-1.5 rounded-xl cursor-pointer transition ${mediaFilter === k ? 'bg-[#7a1c24] text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <AddChip kind="image" label="صورة" />
                <AddChip kind="video" label="فيديو" />
              </div>
            </SectionHeader>
            {mediaList.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed text-sm text-gray-500 text-center">{images.length + videos.length === 0 ? 'لم تُضف صور أو فيديوهات للكنيسة حتى الآن.' : 'لا توجد عناصر في هذا التصنيف.'}</div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {shown.map((m, i) => {
                  const isVid = m._t === 'video';
                  const thumb = isVid ? youtubeThumb(m.url) : m.url;
                  return (
                    <div key={m.id} className={`group relative overflow-hidden rounded-3xl bg-slate-900 shadow-sm hover:shadow-xl transition ${i === 0 && mediaList.length > 2 && mediaFilter === 'all' ? 'col-span-2 lg:col-span-2 row-span-1' : ''}`}>
                      <button
                        type="button"
                        className="block w-full aspect-[4/3] cursor-pointer"
                        aria-label={isVid ? `تشغيل ${m.title}` : `تكبير ${m.title}`}
                        onClick={() => {
                          if (isVid) setVideoItem(m);
                          else {
                            const idx = imgOnly.findIndex(x => x.id === m.id);
                            setLightbox({ list: imgOnly, index: Math.max(0, idx) });
                          }
                        }}
                      >
                        {thumb ? (
                          <img src={thumb} alt={m.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-700" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        ) : (
                          <div className="w-full h-full bg-linear-to-br from-slate-800 to-slate-950" />
                        )}
                        {isVid && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="w-14 h-14 rounded-full bg-white/90 text-[#7a1c24] flex items-center justify-center shadow-xl group-hover:scale-110 transition"><Play size={24} className="mr-[-3px]" /></span>
                          </span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 p-3 pt-10 bg-linear-to-t from-black/80 to-transparent text-right">
                          <span className="block text-sm font-black text-white leading-snug">{m.title}</span>
                          {m.body && <span className="block text-[11px] text-white/75 line-clamp-1">{m.body}</span>}
                        </span>
                      </button>
                      <div className="absolute top-2 right-2 flex gap-1.5">
                        <Pill className={isVid ? 'bg-indigo-600 text-white' : 'bg-white/90 text-gray-800'}>{isVid ? '🎬 فيديو' : '🖼️ صورة'}</Pill>
                        <DraftBadge item={m} />
                      </div>
                      <div className="absolute top-2 left-2"><EditChip item={m} /></div>
                    </div>
                  );
                })}
              </div>
            )}
            {mediaList.length > mediaLimit && (
              <div className="mt-4 text-center">
                <button type="button" onClick={() => setMediaLimit(l => l + 6)} className="px-6 py-2.5 rounded-2xl bg-white border-2 border-[#7a1c24]/25 hover:border-[#7a1c24] text-[#7a1c24] text-sm font-black cursor-pointer transition">
                  عرض المزيد ({mediaList.length - mediaLimit})
                </button>
              </div>
            )}
          </Reveal>
        </section>
      );
    }

    if (s.key === 'news') {
      
      return (
        <section key={s.key} id="sec-news" className="scroll-mt-32">
          <HiddenBanner k={s.key} />
          <Reveal>
            <SectionHeader icon="📰" title={s.title} count={newsCards.length}>
              <AddChip kind="news" label="خبر / إعلان" />
            </SectionHeader>
            {newsCards.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed text-sm text-gray-500">لا توجد أخبار منشورة حالياً.</div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {newsCards.slice(0, newsLimit).map((c, i) => renderNewsCard(c, i))}
              </div>
            )}
            {newsCards.length > newsLimit && (
              <div className="mt-5 text-center">
                <button type="button" onClick={() => setNewsLimit(l => l + 6)} className="px-6 py-2.5 rounded-2xl bg-white border-2 border-[#7a1c24]/25 hover:border-[#7a1c24] text-[#7a1c24] text-sm font-black cursor-pointer transition">
                  عرض المزيد من الأخبار ({newsCards.length - newsLimit})
                </button>
              </div>
            )}
          </Reveal>
        </section>
      );
    }

    if (s.key === 'masses_trips') {
      const showMasses = !massesMeta.hidden || adminOn;
      const showTrips = !tripsMeta.hidden || adminOn;
      if (!showMasses && !showTrips) return null;
      return (
        <div key={s.key} className="space-y-3">
          <HiddenBanner k={s.key} />
          <div className={`grid gap-6 ${showMasses && showTrips ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
            {showMasses && (
              <section id="sec-masses" className="scroll-mt-32">
                <Reveal>
                  <div className="rounded-[2rem] bg-white border border-gray-200 shadow-sm p-5 md:p-7 h-full">
                    <SectionHeader icon="⛪" title={massesMeta.title} count={massRows.length}>
                      <AddChip kind="mass" label="قداس / صلاة" />
                    </SectionHeader>
                    {massRows.length === 0 ? (
                      <p className="text-sm text-gray-500">لم تُضف مواعيد قداسات أو صلوات عامة بعد.</p>
                    ) : (
                      <div className="space-y-5 max-h-[34rem] overflow-y-auto pr-1">
                        {recurringMasses.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-xs font-black text-amber-700 flex items-center gap-1.5"><Sun size={14} /> المواعيد الثابتة</h3>
                            {recurringMasses.map(renderMassRow)}
                          </div>
                        )}
                        {massGroups.map(g => (
                          <div key={g.date.getTime()} className="space-y-2">
                            <h3 className="text-xs font-black text-[#7a1c24] flex flex-wrap items-center gap-1.5">
                              <Moon size={14} /> {formatDateFull(g.date)}
                              {relativeDayLabel(g.date) && <Pill className="bg-emerald-100 text-emerald-900">{relativeDayLabel(g.date)}</Pill>}
                            </h3>
                            {g.rows.map(renderMassRow)}
                          </div>
                        ))}
                        {pastMassCount > 0 && (
                          <div className="space-y-3 pt-1">
                            <button type="button" onClick={() => setShowPastMasses(v => !v)} aria-expanded={showPastMasses} className="w-full px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-black cursor-pointer inline-flex items-center justify-center gap-2 transition">
                              <ChevronDown size={15} className={`transition ${showPastMasses ? 'rotate-180' : ''}`} />
                              {showPastMasses ? 'إخفاء المواعيد السابقة' : `عرض المواعيد السابقة (${pastMassCount})`}
                            </button>
                            {showPastMasses && pastMassGroups.map(g => (
                              <div key={`past-${g.date.getTime()}`} className="space-y-2 opacity-80">
                                <h3 className="text-xs font-black text-gray-600 flex items-center gap-1.5"><Moon size={14} /> {formatDateFull(g.date)} <Pill className="bg-gray-200 text-gray-700">انتهى</Pill></h3>
                                {g.rows.map(renderMassRow)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Reveal>
              </section>
            )}
            {showTrips && (
              <section id="sec-trips" className="scroll-mt-32">
                <Reveal delay={80}>
                  <div className="rounded-[2rem] bg-white border border-gray-200 shadow-sm p-5 md:p-7 h-full">
                    <SectionHeader icon="🚌" title={tripsMeta.title} count={tripRows.length}>
                      <AddChip kind="trip" label="إعلان رحلة" />
                    </SectionHeader>
                    {tripRows.length === 0 && pastTripRows.length === 0 ? (
                      <p className="text-sm text-gray-500">لا توجد رحلات معلنة حالياً.</p>
                    ) : (
                      <div className="space-y-3 max-h-[34rem] overflow-y-auto pr-1">
                        {tripRows.length === 0 && <p className="text-sm text-gray-500">لا توجد رحلات قادمة حالياً.</p>}
                        {(showPastTrips ? [...tripRows, ...pastTripRows] : tripRows).map(t => {
                          const open = openTrip === t.id;
                          const hasMore = Boolean(t.program || t.places || t.times);
                          return (
                            <div key={t.id} className="rounded-2xl border border-purple-200 bg-linear-to-br from-purple-50/70 to-white overflow-hidden">
                              <div
                                role="button"
                                tabIndex={hasMore ? 0 : -1}
                                aria-expanded={open}
                                onClick={() => hasMore && setOpenTrip(open ? null : t.id)}
                                onKeyDown={(e) => { if (hasMore && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpenTrip(open ? null : t.id); } }}
                                className={`w-full text-right p-4 flex items-start gap-3 ${hasMore ? 'cursor-pointer' : 'cursor-default'}`}
                              >
                                <DateTile date={t.date} />
                                <div className="min-w-0 flex-1 space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Pill className="bg-purple-100 text-purple-900">🚌 {t.tag}</Pill>
                                    {t.audience && <Pill className="bg-blue-100 text-blue-900">{t.audience}</Pill>}
                                    <Pill className={t.overnight ? 'bg-indigo-100 text-indigo-950' : 'bg-amber-100 text-amber-950'}>
                                      {t.overnight ? `🌙 مبيت${t.days ? ` (${t.days} أيام)` : ''}` : '☀️ يوم واحد'}
                                    </Pill>
                                    {t.cost > 0 && <Pill className="bg-emerald-100 text-emerald-900">{t.cost} ج.م</Pill>}
                                    {t.raw && <DraftBadge item={t.raw} />}
                                  </div>
                                  <strong className="block text-sm md:text-base text-gray-900 leading-snug">{t.title}</strong>
                                  <span className="text-xs text-gray-500 font-bold">{t.date ? formatDateFull(t.date) : t.dateText}</span>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  {t.raw && <EditChip item={t.raw} />}
                                  {hasMore && <ChevronDown size={18} className={`text-purple-700 transition ${open ? 'rotate-180' : ''}`} />}
                                </div>
                              </div>
                              {open && (
                                <div className="px-4 pb-4 space-y-2 text-xs text-gray-700">
                                  {t.places && <p>⛪ <strong>الوجهة / الزيارات:</strong> {t.places}</p>}
                                  {t.times && <p className="text-gray-600">⏰ {t.times}</p>}
                                  {t.program && (
                                    <div className="p-3 bg-white border border-purple-100 rounded-xl whitespace-pre-line leading-6">
                                      <strong className="text-[#7a1c24] block mb-0.5">📋 برنامج الرحلة</strong>
                                      {t.program}
                                    </div>
                                  )}
                                  {t.url && isSafeHttpUrl(t.url) && (
                                    <a href={t.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#7a1c24] font-black hover:underline">
                                      بوستر / استمارة الرحلة <ExternalLink size={12} />
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {pastTripRows.length > 0 && (
                          <button type="button" onClick={() => setShowPastTrips(v => !v)} aria-expanded={showPastTrips} className="w-full px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-black cursor-pointer inline-flex items-center justify-center gap-2 transition">
                            <ChevronDown size={15} className={`transition ${showPastTrips ? 'rotate-180' : ''}`} />
                            {showPastTrips ? 'إخفاء الرحلات السابقة' : `عرض الرحلات السابقة (${pastTripRows.length})`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </Reveal>
              </section>
            )}
          </div>
        </div>
      );
    }

    if (s.key === 'priest_bio') {
      
      return (
        <section key={s.key} id="sec-priests" className="scroll-mt-32">
          <HiddenBanner k={s.key} />
          <Reveal>
            <SectionHeader icon="✝" title={s.title} count={priestBios.length}>
              <AddChip kind="priest_bio" label="أب كاهن" />
            </SectionHeader>
            {priestBios.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed text-sm text-gray-500">سيتم عرض آباء الكنيسة بصورهم وتاريخ سيامتهم وبياناتهم هنا.</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {priestBios.map((pb, i) => {
                  const phone = extractPhone(pb.location);
                  return (
                    <Reveal key={pb.id} delay={i * 60}>
                      <article className="relative h-full rounded-3xl bg-white border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition overflow-hidden flex flex-col">
                        <div className="h-20 bg-linear-to-l from-[#7a1c24] to-[#32060a] relative" style={{ backgroundImage: CROSS_PATTERN, backgroundSize: '56px' }}>
                          <div className="absolute top-2 left-2 flex gap-1"><DraftBadge item={pb} /><EditChip item={pb} /></div>
                        </div>
                        <div className="px-5 pb-5 -mt-12 flex flex-col items-center text-center gap-2 flex-1">
                          {pb.url ? (
                            <img src={pb.url} alt={pb.title} loading="lazy" className="w-24 h-24 rounded-full object-cover ring-4 ring-white shadow-lg bg-white" />
                          ) : (
                            <div className="w-24 h-24 rounded-full bg-[#f9ecee] text-[#7a1c24] ring-4 ring-white shadow-lg flex items-center justify-center text-4xl font-black">✝</div>
                          )}
                          <h3 className="text-base font-black text-[#5c1319] leading-snug">{pb.title}</h3>
                          {pb.time_text && <Pill className="bg-amber-100 text-amber-950">{pb.time_text}</Pill>}
                          {pb.body && <ExpandableText text={pb.body} limit={150} className="text-xs text-gray-600 leading-6" />}
                          {pb.location && !phone && <span className="text-xs text-gray-500 inline-flex items-center gap-1"><MapPin size={12} /> {pb.location}</span>}
                          {phone && (
                            <a href={`tel:${phone}`} className="mt-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7a1c24] hover:bg-[#5c1319] text-white text-xs font-black transition">
                              <Phone size={13} /> اتصال
                            </a>
                          )}
                        </div>
                      </article>
                    </Reveal>
                  );
                })}
              </div>
            )}
          </Reveal>
        </section>
      );
    }

    if (s.key === 'history') {
      
      return (
        <section key={s.key} id="sec-history" className="scroll-mt-32">
          <HiddenBanner k={s.key} />
          <Reveal>
            <SectionHeader icon="📜" title={s.title}>
              <AddChip kind="history" label="نبذة" />
            </SectionHeader>
            {histories.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed text-sm text-gray-500">سيتم عرض تاريخ الكنيسة وسيرة شفيعها وحياة الكنيسة هنا.</div>
            ) : (
              <ol className="relative pr-6 md:pr-8 space-y-6 before:absolute before:right-[7px] md:before:right-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-linear-to-b before:from-amber-400 before:to-[#7a1c24]/30">
                {histories.map(h => (
                  <li key={h.id} className="relative">
                    <span className="absolute -right-6 md:-right-8 top-5 w-4 h-4 md:w-6 md:h-6 rounded-full bg-amber-400 ring-4 ring-[#f6f4ef] shadow" aria-hidden />
                    <article className="rounded-3xl bg-white border border-gray-200 shadow-sm p-5 md:p-6 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          {h.time_text && <Pill className="bg-[#7a1c24] text-amber-100 mb-1.5">{h.time_text}</Pill>}
                          <h3 className="text-base md:text-xl font-black text-[#5c1319]">{h.title}</h3>
                        </div>
                        <div className="flex gap-1"><DraftBadge item={h} /><EditChip item={h} /></div>
                      </div>
                      {h.url && isImageUrl(h.url) && (
                        <button type="button" className="block w-full cursor-zoom-in" onClick={() => setLightbox({ list: [{ url: h.url, title: h.title, body: '' }], index: 0 })}>
                          <img src={h.url} alt={h.title} loading="lazy" className="w-full max-h-80 object-cover rounded-2xl border" />
                        </button>
                      )}
                      <ExpandableText text={h.body} limit={520} className="text-sm md:text-base text-gray-700 leading-8" />
                    </article>
                  </li>
                ))}
              </ol>
            )}
          </Reveal>
        </section>
      );
    }
    return null;
  };

  /* ───── الهيكل العام ───── */
  const heroMedia = featuredLive || featuredVideo;
  const heroEmbed = heroMedia ? toEmbedUrl(heroMedia.url) : '';
  const heroDirect = heroMedia ? isDirectVideo(heroMedia.url) : false;
  const maryShape = MARY_SHAPES.find(x => x.id === theme.mary_shape) || MARY_SHAPES[0];

  return (
    <div className="pp-root min-h-screen text-gray-900 flex flex-col" style={{ backgroundColor: theme.pageBg || '#f6f4ef' }} dir="rtl">
      <style>{buildThemeCss(theme)}</style>
      <style>{`
        html { scroll-behavior: smooth; }
        .pp-reveal { opacity: 0; transform: translateY(22px); transition: opacity .7s ease, transform .7s ease; }
        .pp-reveal.pp-in { opacity: 1; transform: none; }
        @keyframes ppMarquee { from { transform: translateX(0); } to { transform: translateX(50%); } }
        @keyframes ppFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes ppShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .pp-marquee { display: flex; width: max-content; animation: ppMarquee 55s linear infinite; }
        .pp-marquee:hover { animation-play-state: paused; }
        .pp-float { animation: ppFloat 5s ease-in-out infinite; }
        .pp-skel { background: linear-gradient(90deg,#ece8df 25%,#f6f3ec 37%,#ece8df 63%); background-size: 400% 100%; animation: ppShimmer 1.6s ease infinite; }
        .pp-noscroll::-webkit-scrollbar { display: none; }
        .pp-noscroll { scrollbar-width: none; }
        @media print { .pp-reveal { opacity: 1 !important; transform: none !important; } }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .pp-reveal { opacity: 1; transform: none; transition: none; }
          .pp-marquee, .pp-float { animation: none; }
        }
      `}</style>

      {/* ───── الشريط العلوي الثابت ───── */}
      <div className={`${theme.sticky_header !== false ? 'sticky top-0' : ''} z-40 pp-hdr bg-linear-to-l ${theme.headerBg} text-white shadow-lg border-b border-amber-300/30`}>
        <div className="max-w-6xl mx-auto px-3 md:px-5 min-h-14 py-1.5 grid grid-cols-[5.25rem_1fr_5.25rem] items-center gap-2 md:flex md:justify-between md:gap-3 md:py-0 md:h-14">
          <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="contents md:flex md:items-center md:gap-2.5 md:min-w-0">
            <span className="w-9 h-9 rounded-xl bg-white/10 border border-amber-300/50 flex items-center justify-center overflow-hidden shrink-0 justify-self-start col-start-1 row-start-1">
              {logoConfig?.url ? <img src={logoConfig.url} alt="" className="w-full h-full object-cover" /> : <span className="text-lg font-black text-amber-300">✝</span>}
            </span>
            <span className="col-start-2 row-start-1 text-center md:text-right font-black text-[13px] leading-tight md:leading-normal md:text-base line-clamp-2 md:truncate text-amber-100">{churchTitle}</span>
          </a>
          <div className="col-start-3 row-start-1 justify-self-end flex items-center gap-1.5 md:gap-2 shrink-0">
            {isLoggedIn ? (
              <>
                {canEdit && onOpenEditor && (
                  <button type="button" onClick={() => openEditorFor()} className="hidden sm:inline-flex px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-black items-center gap-1.5 cursor-pointer transition">
                    <Settings size={14} /> المحرر
                  </button>
                )}
                <button type="button" onClick={onBackToApp} className="px-3.5 py-2 bg-white text-[#7a1c24] hover:bg-amber-50 rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow transition">
                  <ArrowRight size={14} /> <span className="hidden sm:inline">العودة لحسابي</span><span className="sm:hidden">حسابي</span>
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={openRegister} className="hidden sm:inline-flex px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/30 rounded-xl text-xs font-bold items-center gap-1.5 cursor-pointer transition">
                  <UserPlus size={14} /> تسجيل حساب جديد
                </button>
                <button type="button" onClick={onOpenLogin} className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-[#4a0e13] rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow transition">
                  <LogIn size={14} /> <span className="hidden sm:inline">تسجيل الدخول</span><span className="sm:hidden">دخول</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {navItems.length > 0 && (
        <div className={`hidden md:block ${theme.sticky_header !== false ? 'md:sticky md:top-14' : ''} z-30 pp-hdr bg-linear-to-l ${theme.headerBg} text-white border-b border-white/10 shadow-md`}>
          <nav aria-label="أقسام الصفحة" className="bg-black/25 backdrop-blur">
            <div className="max-w-6xl mx-auto px-2 md:px-5 py-2 flex flex-wrap md:flex-nowrap items-center justify-center md:justify-start gap-1.5 md:overflow-x-auto pp-noscroll">
              {navItems.map(n => (
                <button
                  key={n.anchor}
                  type="button"
                  onClick={() => goTo(n.anchor)}
                  aria-current={activeAnchor === n.anchor ? 'true' : undefined}
                  className={`px-3 md:px-3.5 py-1.5 rounded-full text-[11.5px] md:text-xs font-black whitespace-nowrap cursor-pointer transition ${activeAnchor === n.anchor ? 'bg-amber-400 text-[#4a0e13] shadow' : 'text-white/85 hover:bg-white/15'}`}
                >
                  {n.label}
                </button>
              ))}
              {onOpenEdu && theme.show_edu_btn !== false && (
                <button type="button" onClick={onOpenEdu} className="px-3 md:px-3.5 py-1.5 rounded-full text-[11.5px] md:text-xs font-black whitespace-nowrap cursor-pointer bg-indigo-600/90 hover:bg-indigo-600 text-white transition">🎓 المركز التعليمي</button>
              )}
              {onOpenJoseph && theme.show_joseph_btn !== false && (
                <button type="button" onClick={onOpenJoseph} className="px-3 md:px-3.5 py-1.5 rounded-full text-[11.5px] md:text-xs font-black whitespace-nowrap cursor-pointer bg-slate-900/80 hover:bg-slate-900 text-white border border-white/20 transition">🕊️ خدمة يوسف الرامي</button>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* ───── الواجهة الرئيسية (Hero) ───── */}
      <header id="top" className={`relative overflow-hidden pp-hdr bg-linear-to-br ${theme.headerBg} text-white`}>
        <div aria-hidden className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: CROSS_PATTERN, backgroundSize: '72px' }} />
        <div aria-hidden className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-amber-300/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 right-10 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        {theme.show_ticker !== false && tickerItems.length > 0 && (
          <div className="relative bg-black/40 border-b border-white/10 py-2 overflow-hidden text-xs md:text-sm font-bold text-amber-200" aria-label="شريط الأخبار">
            <div className="pp-marquee">
              {[0, 1].map(copy => (
                <div key={copy} className="flex items-center shrink-0" aria-hidden={copy === 1}>
                  {tickerItems.map((t, i) => (
                    <span key={`${copy}-${i}`} className="px-6 whitespace-nowrap">{t}<span className="mr-6 text-amber-400/60">◆</span></span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="relative max-w-3xl mx-auto px-4 md:px-5 pt-8 md:pt-12 pb-24 md:pb-32 flex flex-col items-center">
          {theme.show_mary !== false && (
            <div className="relative pp-float mb-7 md:mb-9">
              <div aria-hidden className={`absolute -inset-3 ${maryShape.ring} border border-amber-300/40`} />
              <div className={`relative ${maryShape.id === 'circle' ? 'w-60 h-60 md:w-72 md:h-72' : 'w-56 h-72 md:w-64 md:h-80'} ${maryShape.cls} overflow-hidden border-2 border-amber-300/80 shadow-2xl bg-[#2b0910] flex items-center justify-center`}>
                {activeMaryUrl ? (
                  <img src={activeMaryUrl} alt="السيدة العذراء مريم" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-amber-100 p-4">
                    <div className="w-20 h-20 mx-auto rounded-full border-2 border-amber-300/80 bg-amber-200/15 flex items-center justify-center text-5xl mb-2">🕊️</div>
                    <span className="text-amber-300 font-black text-sm">السيدة العذراء مريم</span>
                  </div>
                )}
                {(theme.mary_caption ?? '').trim() && <span className="absolute bottom-0 inset-x-0 bg-black/55 py-1 text-center text-[11px] font-black text-amber-200">{theme.mary_caption}</span>}
              </div>
            </div>
          )}
          <div className="space-y-5 text-center w-full">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-amber-300/30 text-amber-200 text-xs font-black">
              <Sparkles size={13} /> {churchTagline}
            </div>
            {loading && !items.length ? (
              <div className="space-y-3"><div className="pp-skel h-10 w-3/4 rounded-xl opacity-30" /><div className="pp-skel h-5 w-1/2 rounded-lg opacity-30" /></div>
            ) : (
              <>
                <h1 className="text-3xl md:text-5xl font-black leading-[1.25] text-white drop-shadow">{churchTitle}</h1>
                <p className="text-sm md:text-lg text-white/85 leading-8 max-w-2xl mx-auto">{churchSubtitle}</p>
              </>
            )}

            <div className="flex flex-wrap justify-center gap-2.5 pt-1">
              {featuredLive ? (
                <button type="button" onClick={() => setVideoItem(featuredLive)} className="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-sm inline-flex items-center gap-2 shadow-lg cursor-pointer transition">
                  <Radio size={17} className="animate-pulse" /> شاهد البث المباشر
                </button>
              ) : massRows.length > 0 ? (
                <button type="button" onClick={() => goTo('sec-masses')} className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-[#4a0e13] font-black text-sm inline-flex items-center gap-2 shadow-lg cursor-pointer transition">
                  <Church size={17} /> مواعيد القداسات
                </button>
              ) : null}
              {!isLoggedIn && (
                <button type="button" onClick={openRegister} className="sm:hidden px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/30 text-white font-black text-sm inline-flex items-center gap-2 cursor-pointer">
                  <UserPlus size={16} /> تسجيل حساب
                </button>
              )}
              {tripRows.length > 0 && (
                <button type="button" onClick={() => goTo('sec-trips')} className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/30 text-white font-black text-sm inline-flex items-center gap-2 cursor-pointer transition">
                  <Bus size={16} /> الرحلات القادمة
                </button>
              )}
            </div>

            {(navItems.length > 0 || (onOpenEdu && theme.show_edu_btn !== false) || (onOpenJoseph && theme.show_joseph_btn !== false)) && (
              <div className="md:hidden grid grid-cols-2 gap-2 w-full max-w-md mx-auto pt-0.5" aria-label="أقسام الصفحة">
                {[
                  ...navItems.map(n => ({ key: n.anchor, label: `${n.icon ? n.icon + ' ' : ''}${n.full || n.label}`, onClick: () => goTo(n.anchor), cls: n.tone === 'gold' ? 'bg-amber-300 hover:bg-amber-200 text-[#4a0e13] font-black shadow' : 'bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold' })),
                  ...(onOpenEdu && theme.show_edu_btn !== false ? [{ key: 'edu', label: '🎓 المركز التعليمي', onClick: onOpenEdu, cls: 'bg-indigo-600 hover:bg-indigo-700 border border-indigo-300/40 text-white font-black shadow' }] : []),
                  ...(onOpenJoseph && theme.show_joseph_btn !== false ? [{ key: 'joseph', label: '🕊️ خدمة يوسف الرامي', onClick: onOpenJoseph, cls: 'bg-slate-900/85 hover:bg-slate-900 border border-white/30 text-white font-black shadow' }] : [])
                ].map((b, i, arr) => (
                  <button key={b.key} type="button" onClick={b.onClick} className={`min-h-11 px-3 py-2 rounded-xl text-xs flex items-center justify-center text-center leading-snug cursor-pointer transition ${b.cls} ${arr.length % 2 === 1 && i === arr.length - 1 ? 'col-span-2' : ''}`}>{b.label}</button>
                ))}
              </div>
            )}

            {nextMass && (
              <div className="inline-flex items-center gap-3 rounded-2xl bg-black/25 border border-white/15 backdrop-blur px-4 py-3 max-w-full">
                <span className="w-10 h-10 rounded-xl bg-amber-400 text-[#4a0e13] flex items-center justify-center shrink-0"><Clock size={20} /></span>
                <div className="min-w-0 text-right">
                  <span className="block text-[11px] text-amber-200 font-black">الصلاة القادمة • {countdown}</span>
                  <strong className="block text-sm md:text-base truncate">{nextMass.title}</strong>
                  <span className="block text-[11px] text-white/70 truncate">{formatDateFull(nextMass.date)}{nextMass.time ? ` • ${nextMass.time}` : ''}</span>
                </div>
              </div>
            )}

            {heroMedia && (heroEmbed || heroDirect) && (
              <div className="w-full max-w-md mx-auto rounded-3xl bg-black/30 border border-white/20 p-2.5 shadow-2xl space-y-2 text-right">
                <div className="flex items-center justify-between px-1">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black inline-flex items-center gap-1 ${featuredLive ? 'bg-red-600' : 'bg-indigo-600'}`}>
                    {featuredLive ? <><Radio size={11} className="animate-pulse" /> بث مباشر</> : <><Video size={11} /> فيديو الكنيسة</>}
                  </span>
                  <EditChip item={heroMedia} />
                </div>
                <div className="aspect-video rounded-2xl overflow-hidden bg-black">
                  {heroEmbed ? <iframe src={heroEmbed} title={heroMedia.title} className="w-full h-full" allowFullScreen /> : <video src={heroMedia.url} controls muted loop playsInline className="w-full h-full object-cover" />}
                </div>
                <strong className="block px-1 text-sm text-amber-200 truncate">{heroMedia.title}</strong>
              </div>
            )}

            {socialLinks.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {socialLinks.map(sl => (
                  isSafeHttpUrl(sl.url) && (
                    <a key={sl.id} href={sl.url} target="_blank" rel="noreferrer" className="px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/25 text-xs font-black inline-flex items-center gap-1.5 transition">
                      {sl.kind === 'facebook_page' ? '📘' : '▶️'} {sl.title} <ExternalLink size={11} />
                    </a>
                  )
                ))}
              </div>
            )}
          </div>

        </div>

      </header>

      {/* ───── شريط الأرقام ───── */}
      {sectionVisible('summary') && stats.length > 0 && (
        <div className="relative z-10 max-w-6xl mx-auto w-full px-4 md:px-5 -mt-12 md:-mt-14">
          <div className={`grid gap-3 md:gap-4 ${stats.length >= 4 ? 'grid-cols-2 md:grid-cols-4' : stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {stats.map((st, i) => (
              <Reveal key={st.key} delay={i * 70}>
                <button type="button" onClick={() => goTo(st.anchor)} className="w-full text-right p-4 md:p-5 rounded-3xl bg-white border border-gray-200 shadow-lg hover:shadow-xl hover:-translate-y-1 hover:border-[#7a1c24]/40 transition cursor-pointer flex items-center gap-3">
                  <span className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-[#f9ecee] text-[#7a1c24] flex items-center justify-center shrink-0">{st.icon}</span>
                  <span className="min-w-0">
                    <strong className="block text-2xl md:text-3xl font-black text-[#5c1319] leading-none"><CountUp value={st.value} /></strong>
                    <span className="block text-[11px] md:text-xs text-gray-500 font-bold mt-1 truncate">{st.label}</span>
                  </span>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      )}

      {/* ───── المحتوى ───── */}
      <main className="max-w-6xl mx-auto w-full px-4 md:px-5 py-10 md:py-14 space-y-12 md:space-y-16 flex-1">
        {loadError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-bold">تعذر تحميل بيانات الصفحة: {loadError}</span>
            <button type="button" onClick={loadPublic} className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"><RefreshCw size={13} /> إعادة المحاولة</button>
          </div>
        )}

        {loading && items.length === 0 && !loadError && (
          <div className="grid md:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => <div key={i} className="pp-skel h-52 rounded-3xl" />)}
          </div>
        )}

        {(() => {
          const services = [
            onOpenEdu && theme.show_edu_btn !== false && { key: 'edu', icon: '🎓', title: 'المركز التعليمي', hint: 'الدروس والمراحل والمواد والتسجيل', onClick: onOpenEdu, cls: 'from-indigo-600 to-indigo-800' },
            onOpenJoseph && theme.show_joseph_btn !== false && { key: 'joseph', icon: '🕊️', title: 'خدمة يوسف الرامي', hint: 'خدمة الراقدين والجنازات', onClick: onOpenJoseph, cls: 'from-slate-700 to-slate-900' },
            !isLoggedIn && { key: 'login', icon: '👤', title: 'دخول المنظومة', hint: 'للخدام والمخدومين وأولياء الأمور', onClick: onOpenLogin, cls: 'from-[#7a1c24] to-[#5c1319]' },
            isLoggedIn && onBackToApp && { key: 'app', icon: '🏠', title: 'العودة لحسابي', hint: 'لوحتك الشخصية والخدمات', onClick: onBackToApp, cls: 'from-[#7a1c24] to-[#5c1319]' }
          ].filter(Boolean);
          if (theme.show_services === false || services.length === 0) return null;
          return (
            <section id="sec-services" aria-label="الخدمات الإلكترونية" className="scroll-mt-32">
              <Reveal>
                <SectionHeader icon="🧭" title="الخدمات الإلكترونية" count={services.length} />
                <div className={`grid gap-3 md:gap-4 ${services.length >= 3 ? 'sm:grid-cols-3' : services.length === 2 ? 'sm:grid-cols-2' : ''}`}>
                  {services.map(sv => (
                    <button key={sv.key} type="button" onClick={sv.onClick} className={`group text-right p-5 rounded-3xl text-white bg-linear-to-br ${sv.cls} shadow-lg hover:shadow-xl hover:-translate-y-1 transition cursor-pointer flex items-center gap-4`}>
                      <span className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition">{sv.icon}</span>
                      <span className="min-w-0">
                        <strong className="block text-base font-black">{sv.title}</strong>
                        <span className="block text-xs text-white/80 mt-0.5 leading-5">{sv.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </Reveal>
            </section>
          );
        })()}

        {sections.filter(s => s.key !== 'summary').map(renderSection)}

        {customCategories.map(cat => {
          const catItems = sortContent(visibleItems.filter(i => i.kind === cat.title));
          
          return (
            <section key={cat.id} className="scroll-mt-32">
              <Reveal>
                <SectionHeader icon="✨" title={cat.body || cat.title} count={catItems.length}>
                  <AddChip kind={cat.title} />
                </SectionHeader>
                {catItems.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-dashed text-sm text-gray-500">لا توجد بنود في هذا القسم بعد.</div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {catItems.map(it => (
                      <article key={it.id} className="rounded-3xl bg-white border border-gray-200 shadow-sm hover:shadow-lg transition overflow-hidden flex flex-col">
                        {it.url && isImageUrl(it.url) && (
                          <button type="button" className="cursor-zoom-in" onClick={() => setLightbox({ list: [{ url: it.url, title: it.title, body: it.body }], index: 0 })}>
                            <img src={it.url} alt={it.title} loading="lazy" className="w-full h-44 object-cover" />
                          </button>
                        )}
                        <div className="p-5 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-base font-black text-[#5c1319]">{it.title}</h3>
                            <div className="flex gap-1"><DraftBadge item={it} /><EditChip item={it} /></div>
                          </div>
                          {it.body && <p className="text-sm text-gray-700 leading-7 whitespace-pre-line">{it.body}</p>}
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 font-bold">
                            {it.time_text && <span className="inline-flex items-center gap-1"><Clock size={12} /> {it.time_text}</span>}
                            {it.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {it.location}</span>}
                          </div>
                          {it.url && !isImageUrl(it.url) && isSafeHttpUrl(it.url) && (
                            <a href={it.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-black text-[#7a1c24] hover:underline">فتح الرابط <ExternalLink size={12} /></a>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </Reveal>
            </section>
          );
        })}

        {!loading && !loadError && items.length === 0 && masses.length === 0 && publicTrips.length === 0 && events.length === 0 && (
          <div className="py-16 text-center space-y-3">
            <div className="text-6xl">✝</div>
            <h2 className="text-xl font-black text-[#5c1319]">أهلاً بكم في {churchTitle}</h2>
            <p className="text-sm text-gray-500">المحتوى قيد الإعداد وسيظهر هنا قريباً.</p>
          </div>
        )}
      </main>

      {/* ───── الفوتر ───── */}
      <footer className={`relative overflow-hidden pp-hdr bg-linear-to-br ${theme.headerBg} text-white mt-6`}>
        <div aria-hidden className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: CROSS_PATTERN, backgroundSize: '72px' }} />
        <div className="relative max-w-6xl mx-auto px-4 md:px-5 py-8 grid md:grid-cols-3 gap-6 items-center text-center md:text-right">
          <div className="space-y-1.5">
            <div className="text-3xl">✝</div>
            <strong className="block text-base font-black text-amber-200">{churchTitle}</strong>
            <p className="text-xs text-white/70 leading-6">{churchSubtitle}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {navItems.slice(0, 6).map(n => (
              <button key={n.anchor} type="button" onClick={() => goTo(n.anchor)} className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer transition">{n.label}</button>
            ))}
          </div>
          <div className="flex md:justify-end justify-center gap-2">
            {!isLoggedIn && (
              <button type="button" onClick={onOpenLogin} className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#4a0e13] text-xs font-black cursor-pointer inline-flex items-center gap-1.5"><LogIn size={14} /> <span className="hidden sm:inline">تسجيل الدخول</span><span className="sm:hidden">دخول</span></button>
            )}
          </div>
        </div>
        <div className="relative border-t border-white/10 py-3 text-center text-[11px] text-white/60">✝ {churchTitle} — جميع الحقوق محفوظة</div>
      </footer>

      {/* ───── أدوات عائمة ───── */}
      {canEdit && (
        <div style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }} className="fixed left-4 z-40 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditMode(v => !v)}
            className={`px-4 py-3 rounded-full shadow-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition border-2 ${editMode ? 'bg-amber-400 text-[#4a0e13] border-amber-600' : 'bg-white text-[#7a1c24] border-[#7a1c24]/30 hover:border-[#7a1c24]'}`}
          >
            <Edit3 size={14} /> {editMode ? 'إنهاء وضع التحرير' : 'وضع التحرير'}
          </button>
          {editMode && onOpenEditor && (
            <button type="button" onClick={() => openEditorFor()} className="px-4 py-3 rounded-full shadow-xl bg-[#7a1c24] hover:bg-[#5c1319] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition">
              <Settings size={14} /> فتح المحرر
            </button>
          )}
        </div>
      )}
      {showTop && (
        <button type="button" aria-label="للأعلى" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-4 right-4 z-40 w-11 h-11 rounded-full bg-[#7a1c24] hover:bg-[#5c1319] text-white shadow-xl flex items-center justify-center cursor-pointer transition">
          <ArrowUp size={18} />
        </button>
      )}

      {lightbox && <Lightbox list={lightbox.list} index={lightbox.index} onClose={() => setLightbox(null)} onIndex={(i) => setLightbox(l => ({ ...l, index: i }))} />}
      {videoItem && <VideoModal item={videoItem} onClose={() => setVideoItem(null)} />}

      {showRegister && (
        <UserFormModal
          isEditing={false}
          isVisitorMode={true}
          formData={visitorForm}
          setFormData={setVisitorForm}
          priestsList={[]}
          parentsWorkersList={[]}
          availableServantServices={availableServantServices}
          effectiveGroups={regLists.groups}
          services={regLists.services}
          deaconRanksTable={regLists.ranks}
          onClose={() => {
            setShowRegister(false);
            setVisitorForm(emptyVisitorForm);
          }}
        />
      )}
    </div>
  );
}

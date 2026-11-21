import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BookOpen, Sparkles, Search, Calendar } from 'lucide-react';

const COPTIC_MONTHS = [
  'توت', 'بابه', 'هاتور', 'كيهك', 'طوبة', 'أمشير',
  'برمهات', 'برمودة', 'بشنس', 'بؤونة', 'أبيب', 'مسرى', 'نسيء'
];

const FALLBACK_SYNAXARIUM = [
  { title: 'تذكار السيدة العذراء مريم والدة الإله', summary: 'تُعيد الكنيسة القبطية في الحادي والعشرين من كل شهر قبطي بتذكار والدة الإله القديسة مريم، شفيعة جنس البشر.', readings: 'إنجيل لوقا 1: 39 - 56' },
  { title: 'تذكار رئيس الملائكة الجليل ميخائيل', summary: 'تُعيد الكنيسة في الثاني عشر من كل شهر قبطي بتذكار رئيس الملائكة ميخائيل شفيع الكنيسة والساهر على صلوات القديسين.', readings: 'إنجيل متى 13: 44 - 52' },
  { title: 'سيرة قديسي الكنيسة والشهداء الأبرار', summary: 'نذكر اليوم أمام الله سيرة الآباء الرسل والشهداء والقديسين الذين أكملوا جهادهم الحسن وحفظوا الإيمان الأرثوذكسي المستقيم.', readings: 'عبرانيين 11: 32 - 40 • متى 10: 26 - 33' }
];

export function getTodayCopticDate() {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-u-ca-coptic', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    }).formatToParts(now);

    const day = Number(parts.find(p => p.type === 'day')?.value || 1);
    const monthNum = Number(parts.find(p => p.type === 'month')?.value || 1);
    const year = Number(parts.find(p => p.type === 'year')?.value || 1741);
    const monthName = COPTIC_MONTHS[monthNum - 1] || 'توت';
    return { day, monthNum, monthName, year, label: `${day} ${monthName} ${year} ش` };
  } catch {
    return { day: 1, monthNum: 1, monthName: 'توت', year: 1741, label: 'التقويم القبطي المبارك' };
  }
}

export default function HomeHeroAndSynaxarium() {
  const [settings, setSettings] = useState({ virgin_mary_image_url: '' });
  const [entries, setEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);

  const coptic = getTodayCopticDate();
  const displayDay = Math.max(1, ((coptic.day - 1 + selectedDayOffset + 30) % 30) + 1);

  useEffect(() => {
    const load = async () => {
      const [st, sx] = await Promise.all([
        supabase.from('church_settings').select('virgin_mary_image_url').limit(1).maybeSingle(),
        supabase.from('synaxarium_entries').select('*').order('coptic_day', { ascending: true })
      ]);
      if (st.data) setSettings(st.data);
      if (sx.data) setEntries(sx.data);
    };
    load();
  }, []);

  const matchedToday = entries.filter(
    e => Number(e.coptic_day) === displayDay && e.coptic_month === coptic.monthName
  );

  const filteredEntries = searchTerm.trim()
    ? entries.filter(e =>
        ((e.title || '') + ' ' + (e.summary || '') + ' ' + (e.coptic_month || '')).toLowerCase().includes(searchTerm.toLowerCase())
      )
    : matchedToday;

  const fallbackIdx = displayDay % FALLBACK_SYNAXARIUM.length;
  const activeSynaxarium = filteredEntries.length > 0 ? filteredEntries : [FALLBACK_SYNAXARIUM[fallbackIdx]];

  return (
    <div className="grid md:grid-cols-12 gap-4 items-stretch" dir="rtl">
      {/* إطار صورة السيدة العذراء مريم */}
      <div className="md:col-span-4 bg-linear-to-b from-[#4a0e13] via-[#7a1c24] to-[#3a0a0f] rounded-3xl p-4 border-2 border-amber-300/60 shadow flex flex-col items-center justify-center text-center text-white">
        <div className="relative w-40 h-48 md:w-44 md:h-52 rounded-3xl overflow-hidden border-4 border-amber-300 shadow-xl bg-[#2b0910] flex flex-col items-center justify-center">
          {settings.virgin_mary_image_url ? (
            <img
              src={settings.virgin_mary_image_url}
              alt="السيدة العذراء مريم"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="p-4 flex flex-col items-center justify-center h-full text-amber-100">
              <div className="w-20 h-20 rounded-full border-4 border-amber-300/80 bg-amber-200/15 flex items-center justify-center text-4xl shadow-inner mb-2">
                🕊️
              </div>
              <span className="text-amber-300 font-black text-sm">السيدة العذراء مريم</span>
              <span className="text-[11px] text-amber-100/80 mt-0.5">أم النور وشفيعة الكنيسة ✝</span>
            </div>
          )}
          <div className="absolute bottom-0 inset-x-0 bg-black/55 py-1 text-[11px] font-black text-amber-200">
            ✝ أم النور القديسة مريم
          </div>
        </div>
        <p className="text-xs text-amber-200 font-bold mt-3 flex items-center gap-1">
          <Sparkles size={14} /> «تُعظِّم نفسي الرب» (لوقا 1: 46)
        </p>
        <span className="mt-2 px-3 py-1 bg-amber-400 text-[#4a0e13] rounded-xl text-xs font-black flex items-center gap-1">
          <Calendar size={13} /> {displayDay} {coptic.monthName} {coptic.year} ش
        </span>
      </div>

      {/* قسم السنكسار اليومي */}
      <div className="md:col-span-8 bg-white border-2 border-amber-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-amber-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-100 text-[#7a1c24] rounded-xl"><BookOpen size={20} /></span>
            <div>
              <h3 className="text-base md:text-lg font-black text-[#7a1c24]">
                📖 السنكسار اليومي — ({displayDay} {coptic.monthName})
              </h3>
              <p className="text-xs text-gray-500">سير الآباء القديسين والشهداء وتذكار اليوم</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-xl p-1 text-xs font-bold">
              <button type="button" onClick={() => setSelectedDayOffset(d => d - 1)} className="px-2.5 py-1 hover:bg-white rounded-lg cursor-pointer">◀ الأمس</button>
              <button type="button" onClick={() => setSelectedDayOffset(0)} className="px-2.5 py-1 bg-[#7a1c24] text-white rounded-lg cursor-pointer">اليوم</button>
              <button type="button" onClick={() => setSelectedDayOffset(d => d + 1)} className="px-2.5 py-1 hover:bg-white rounded-lg cursor-pointer">غداً ▶</button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute right-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="بحث في السنكسار..."
                className="pr-8 pl-3 py-1.5 border rounded-xl text-xs w-40 bg-gray-50 focus:bg-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 flex-1">
          {activeSynaxarium.map((item, idx) => (
            <div key={item.id || idx} className="bg-amber-50/40 border border-amber-200 rounded-2xl p-4 space-y-1.5">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <strong className="text-sm md:text-base text-[#7a1c24]">✝ {item.title}</strong>
                {item.coptic_day && (
                  <span className="px-2.5 py-0.5 bg-amber-200 text-amber-950 rounded-lg text-[11px] font-black">
                    {item.coptic_day} {item.coptic_month}
                  </span>
                )}
              </div>
              <p className="text-xs md:text-sm text-gray-800 leading-relaxed">{item.summary}</p>
              {item.readings && (
                <p className="text-xs text-emerald-900 font-bold pt-1">📜 قراءات اليوم: {item.readings}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
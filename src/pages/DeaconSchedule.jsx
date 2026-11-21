import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';
import { toCopticDate, getCopticMonthAndDay, COPTIC_MONTHS } from '../utils/copticDate';
import AgpeyaPanel from '../components/AgpeyaPanel';
import { Calendar, Plus, Trash2, Edit3, BookOpen, HeartHandshake, Save, ArrowRight, Church, ScrollText, Upload } from 'lucide-react';

const PRAYER_HOURS = [
  'صلاة عشية', 'صلاة باكر', 'الساعة الثالثة', 'الساعة السادسة', 'القداس الإلهي',
  'بصخة نهارية (أسبوع الآلام)', 'بصخة مسائية (أسبوع الآلام)', 'الجمعة العظيمة', 'ليلة أبوغالمسيس'
];

const LITURGICAL_ROLES = [
  'خادم مذبح ⛪', 'قراءة قطع ومزامير باكر 📖', 'قراءة إنجيل باكر ✝',
  'قراءة إنجيل الساعة الثالثة ✝', 'قراءة البولس 📜', 'قراءة الكاثوليكون 📜',
  'قراءة الإبركسيس 📜', 'قراءة السنكسار 📖', 'قراءة إنجيل القداس ✝',
  'قراءة نبوات / أناجيل البصخة (أسبوع الآلام) 🕯️', 'مساعدة المعلم (ألحان ومردات) 🎶'
];

const DEFAULT_LITURGY_BOOKS = [
  { key: 'mass_basil', title: '⛪ القداس الباسيلي', category: 'القداس الإلهي' },
  { key: 'mass_gregory', title: '⛪ القداس الغريغوري', category: 'القداس الإلهي' },
  { key: 'mass_cyril', title: '⛪ القداس الكيرلسي', category: 'القداس الإلهي' },
  { key: 'ritual_funeral', title: '🕯️ الطقس الحزايني (التجنيز)', category: 'الطقوس الكنسية' },
  { key: 'ritual_third_day', title: '🕊️ طقس صلاة الثالث', category: 'الطقوس الكنسية' },
  { key: 'ritual_laqqan', title: '💧 طقس صلوات اللقان', category: 'الطقوس الكنسية' },
  { key: 'ritual_baptism', title: '✝ طقس سر المعمودية والميرون', category: 'الطقوس الكنسية' }
];

export default function DeaconSchedule({ deacons = [], currentUser, canEdit = false }) {
  // 'hub' | 'schedule' | 'katameros' | 'agpeya' | 'liturgy' | 'rituals' | 'visitations'
  const [activeCard, setActiveCard] = useState('hub');
  const [schedules, setSchedules] = useState([]);
  const [visitations, setVisitations] = useState([]);
  const [liturgyBooks, setLiturgyBooks] = useState([]);

  const [selectedBookKey, setSelectedBookKey] = useState('mass_basil');
  const [bookText, setBookText] = useState('');
  const [savingBook, setSavingBook] = useState(false);

  const todayISO = new Date().toISOString().split('T')[0];
  const todayCoptic = getCopticMonthAndDay(todayISO);

  const [selectedCopticMonth, setSelectedCopticMonth] = useState(todayCoptic.month);
  const [selectedCopticDay, setSelectedCopticDay] = useState(todayCoptic.day);
  const [katamerosAll, setKatamerosAll] = useState([]);
  const [katForm, setKatForm] = useState({
    day_title: '', vespers_gospel: '', matins_gospel: '', pauline: '',
    catholic: '', praxis: '', synaxarium: '', liturgy_psalm_gospel: ''
  });
  const [savingKat, setSavingKat] = useState(false);

  const emptyForm = {
    deacon_id: '', event_title: '', service_date: todayISO, coptic_date: toCopticDate(todayISO),
    service_time: '07:00 ص', prayer_hour: 'القداس الإلهي', service_role: 'خادم مذبح ⛪',
    reading_reference: '', reading_text: '', notes: ''
  };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [visitForm, setVisitForm] = useState({
    target_user_id: '', target_name: '', visit_date: todayISO,
    visit_method: 'زيارة منزلية', visit_status: 'تمت الزيارة', notes: ''
  });

  const loadDeaconData = async () => {
    const [ds, vs, kt, lb] = await Promise.all([
      supabase.from('deacon_schedules').select('*').order('service_date', { ascending: true }),
      supabase.from('church_visitations').select('*').eq('category', 'افتقاد شمامسة').order('visit_date', { ascending: false }),
      supabase.from('katameros_readings').select('*'),
      supabase.from('liturgy_books').select('*')
    ]);
    if (ds.data) setSchedules(ds.data);
    if (vs.data) setVisitations(vs.data);
    if (kt.data) setKatamerosAll(kt.data);
    if (lb.data) setLiturgyBooks(lb.data);
  };

  useEffect(() => {
    loadDeaconData();
  }, []);

  const openCard = (cardId, label) => {
    setActiveCard(cardId);
    if (cardId === 'liturgy') setSelectedBookKey('mass_basil');
    if (cardId === 'rituals') setSelectedBookKey('ritual_funeral');
    if (currentUser) {
      logActivity({
        user: currentUser,
        actionType: 'تصفح_شاشة_الشمامسة',
        targetTable: 'deacon_schedules',
        description: `فتح ${currentUser.full_name} قسم (${label})`
      });
    }
  };

  useEffect(() => {
    const found = katamerosAll.find(
      k => k.coptic_month === selectedCopticMonth && Number(k.coptic_day) === Number(selectedCopticDay)
    );
    if (found) {
      setKatForm({
        day_title: found.day_title || '', vespers_gospel: found.vespers_gospel || '',
        matins_gospel: found.matins_gospel || '', pauline: found.pauline || '',
        catholic: found.catholic || '', praxis: found.praxis || '',
        synaxarium: found.synaxarium || '', liturgy_psalm_gospel: found.liturgy_psalm_gospel || ''
      });
    } else {
      setKatForm({
        day_title: '', vespers_gospel: '', matins_gospel: '', pauline: '',
        catholic: '', praxis: '', synaxarium: '', liturgy_psalm_gospel: ''
      });
    }
  }, [selectedCopticMonth, selectedCopticDay, katamerosAll]);

  useEffect(() => {
    const found = liturgyBooks.find(b => b.book_key === selectedBookKey);
    setBookText(found?.sections_text || '');
  }, [selectedBookKey, liturgyBooks]);

  const handleSaveBook = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSavingBook(true);
    try {
      const meta = DEFAULT_LITURGY_BOOKS.find(b => b.key === selectedBookKey);
      const payload = {
        book_key: selectedBookKey,
        book_title: meta?.title || selectedBookKey,
        category: meta?.category || 'طقوس',
        sections_text: bookText,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('liturgy_books')
        .upsert(payload, { onConflict: 'book_key' })
        .select().single();
      if (error) return alert('خطأ: ' + error.message);
      setLiturgyBooks(prev => [...prev.filter(b => b.book_key !== selectedBookKey), data]);
      logActivity({
        user: currentUser,
        actionType: 'تحديث_كتاب_طقسي',
        targetTable: 'liturgy_books',
        description: `حدّث نصوص (${meta?.title})`
      });
      alert('تم الحفظ في الداتابيز بنجاح ✅');
    } finally {
      setSavingBook(false);
    }
  };

  const handleSaveKatameros = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSavingKat(true);
    try {
      const payload = {
        coptic_month: selectedCopticMonth,
        coptic_day: Number(selectedCopticDay),
        ...katForm,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('katameros_readings')
        .upsert(payload, { onConflict: 'coptic_month,coptic_day' })
        .select().single();
      if (error) return alert('خطأ: ' + error.message);
      setKatamerosAll(prev => [...prev.filter(x => !(x.coptic_month === selectedCopticMonth && Number(x.coptic_day) === Number(selectedCopticDay))), data]);
      logActivity({
        user: currentUser,
        actionType: 'تحديث_قطمارس',
        targetTable: 'katameros_readings',
        description: `حدّث قراءات القطمارس ليوم (${selectedCopticDay} ${selectedCopticMonth})`
      });
      alert(`تم حفظ قراءات (${selectedCopticDay} ${selectedCopticMonth}) بنجاح ✅`);
    } finally {
      setSavingKat(false);
    }
  };

  const handleDateChange = (iso) => {
    setForm({ ...form, service_date: iso, coptic_date: toCopticDate(iso) });
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    const payload = { ...form, coptic_date: form.coptic_date || toCopticDate(form.service_date) };
    if (editingId) {
      const { id, created_at, ...clean } = payload;
      const { data, error } = await supabase.from('deacon_schedules').update(clean).eq('id', editingId).select().single();
      if (!error && data) {
        setSchedules(schedules.map(s => (s.id === editingId ? data : s)));
        logActivity({ user: currentUser, actionType: 'تعديل_توزيع_شماس', targetTable: 'deacon_schedules', targetId: data.id, description: `عدل توزيع شماس ليوم ${data.service_date}` });
        setEditingId(null); setForm(emptyForm);
      }
    } else {
      const { data, error } = await supabase.from('deacon_schedules').insert([payload]).select().single();
      if (!error && data) {
        setSchedules([...schedules, data]);
        logActivity({ user: currentUser, actionType: 'إضافة_توزيع_شماس', targetTable: 'deacon_schedules', targetId: data.id, description: `أضاف توزيع شماس (${data.event_title}) ليوم ${data.service_date}` });
        setForm(emptyForm);
      }
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!canEdit) return;
    const { error } = await supabase.from('deacon_schedules').delete().eq('id', id);
    if (!error) {
      setSchedules(schedules.filter(s => s.id !== id));
      logActivity({ user: currentUser, actionType: 'حذف_توزيع_شماس', targetTable: 'deacon_schedules', targetId: id, description: 'حذف توزيع شماس' });
    }
  };

  const handleAddVisitation = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    const { data, error } = await supabase
      .from('church_visitations')
      .insert([{ category: 'افتقاد شمامسة', ...visitForm, visitor_id: currentUser?.id }])
      .select().single();
    if (!error && data) {
      setVisitations([data, ...visitations]);
      setVisitForm({ target_user_id: '', target_name: '', visit_date: todayISO, visit_method: 'زيارة منزلية', visit_status: 'تمت الزيارة', notes: '' });
    }
  };

  const handleDeleteVisitation = async (id) => {
    if (!canEdit) return;
    const { error } = await supabase.from('church_visitations').delete().eq('id', id);
    if (!error) setVisitations(visitations.filter(v => v.id !== id));
  };

  // الشماس يشوف جدوله وتوزيعاته للقراءة فقط (View Only)
  const displayedSchedules = canEdit ? schedules : schedules.filter(s => s.deacon_id === currentUser?.id);
  const maxDaysInMonth = selectedCopticMonth === 'نسيء' ? 6 : 30;
  const savedDaysInSelectedMonth = new Set(
    katamerosAll.filter(k => k.coptic_month === selectedCopticMonth).map(k => Number(k.coptic_day))
  );

  const renderTopBar = (title) => (
    <div className="bg-white p-4 rounded-2xl border shadow-2xs flex flex-wrap justify-between items-center gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => setActiveCard('hub')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer">
          <ArrowRight size={15} /> رجوع لكروت الشماس
        </button>
        <h2 className="text-base md:text-lg font-black text-[#7a1c24]">{title}</h2>
      </div>
      {!canEdit && (
        <span className="px-3 py-1 bg-blue-50 text-blue-900 rounded-full text-[11px] font-bold">
          👁️ عرض وقراءة فقط
        </span>
      )}
    </div>
  );

  // ==============================================================
  // HUB: الكروت الكبيرة لشاشة الشماس
  // ==============================================================
  if (activeCard === 'hub') {
    const cards = [
      { id: 'schedule', icon: '📅', title: 'جدول التوزيع والخدمات', desc: canEdit ? 'توزيع الشمامسة على المذبح والقراءات' : 'عرض مواعيد خدمتك وتوزيعك (قراءة فقط)', count: `${displayedSchedules.length} ميعاد`, color: 'border-red-200 bg-white' },
      { id: 'agpeya', icon: '🙏', title: 'الأجبية المقدسة', desc: 'صلوات السواعي السبع وصلاة الستار والمقدمة', count: 'قراءة', color: 'border-blue-200 bg-white' },
      { id: 'katameros', icon: '📖', title: 'القطمارس السنوي', desc: 'قراءات الـ 13 شهر قبطي والسنكسار والإنجيل', count: `${toCopticDate(todayISO)}`, color: 'border-amber-300 bg-white' },
      { id: 'liturgy', icon: '⛪', title: 'القداس الإلهي', desc: 'محتوى القداس الباسيلي والغريغوري والكيرلسي والقراءات', count: 'القداس', color: 'border-emerald-200 bg-white' },
      { id: 'rituals', icon: '🕯️', title: 'الطقوس الكنسية الخاصة', desc: 'الطقس الحزايني، طقس صلوات اللقان، صلاة الثالث، والمعمودية', count: 'الطقوس', color: 'border-purple-200 bg-white' }
    ];
    if (canEdit) {
      cards.push({ id: 'visitations', icon: '🕊️', title: 'افتقاد الشمامسة', desc: 'متابعة وافتقاد الشمامسة', count: `${visitations.length}`, color: 'border-amber-200 bg-white' });
    }

    return (
      <div className="space-y-4 text-xs md:text-sm" dir="rtl">
        <div className="bg-linear-to-r from-[#5c1319] to-[#7a1c24] text-white p-6 rounded-3xl shadow flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-xl font-black text-amber-200">🕯️ خورس الشمامسة والكتب الطقسية</h2>
            <p className="text-xs md:text-sm text-white/85 mt-1">
              اليوم القبطي: <strong>{toCopticDate(todayISO)}</strong> {!canEdit && '• وضع القراءة والمتابعة فقط'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => openCard(c.id, c.title)}
              className={`${c.color} border-2 p-5 rounded-3xl text-right shadow-sm hover:shadow-md hover:border-[#7a1c24] transition flex flex-col justify-between gap-3 cursor-pointer`}
            >
              <div className="flex justify-between items-start w-full">
                <span className="text-4xl">{c.icon}</span>
                <span className="px-3 py-1 bg-[#f9ecee] text-[#7a1c24] rounded-full text-xs font-black">{c.count}</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">{c.title}</h3>
                <p className="text-xs text-gray-600 mt-1">{c.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ==============================================================
  // كارت الأجبية (View Only للشماس العادي)
  // ==============================================================
  if (activeCard === 'agpeya') {
    return (
      <div className="space-y-4 text-xs" dir="rtl">
        {renderTopBar('🙏 الأجبية المقدسة')}
        <AgpeyaPanel canEdit={canEdit} />
      </div>
    );
  }

  // ==============================================================
  // كارت القداس الإلهي أو الطقوس الكنسية (الحزايني، اللقان، الثالث، المعمودية)
  // ==============================================================
  if (activeCard === 'liturgy' || activeCard === 'rituals') {
    const filteredBooks = DEFAULT_LITURGY_BOOKS.filter(b =>
      activeCard === 'liturgy' ? b.category === 'القداس الإلهي' : b.category === 'الطقوس الكنسية'
    );
    const activeBookMeta = DEFAULT_LITURGY_BOOKS.find(b => b.key === selectedBookKey) || filteredBooks[0];

    return (
      <div className="space-y-4 text-xs md:text-sm" dir="rtl">
        {renderTopBar(activeCard === 'liturgy' ? '⛪ القداس الإلهي بمحتواه وقراءاته' : '🕯️ الطقوس الكنسية (الحزايني، اللقان، الثالث، المعمودية)')}

        <div className="bg-white p-4 rounded-3xl border shadow-sm space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex flex-wrap gap-2">
              {filteredBooks.map(b => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setSelectedBookKey(b.key)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer ${selectedBookKey === b.key ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-gray-50 hover:bg-gray-100 text-gray-800'}`}
                >
                  {b.title}
                </button>
              ))}
            </div>

            {canEdit && (
              <label className="px-3 py-2 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                <Upload size={14} /> استيراد JSON كتب
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const list = JSON.parse(await file.text());
                      if (!Array.isArray(list) || list.length === 0) return alert('ملف غير صالح');
                      const { error } = await supabase.from('liturgy_books').upsert(list, { onConflict: 'book_key' });
                      if (error) return alert('خطأ: ' + error.message);
                      await loadDeaconData();
                      alert(`تم استيراد ${list.length} كتاب طقسي بنجاح ✅`);
                    } catch {
                      alert('تأكد من صيغة JSON');
                    } finally {
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            )}
          </div>
        </div>

        {canEdit ? (
          <form onSubmit={handleSaveBook} className="bg-white p-5 rounded-3xl border shadow-sm space-y-3 font-bold">
            <div className="flex justify-between items-center border-b pb-2">
              <strong className="text-base text-[#7a1c24] flex items-center gap-1.5">
                {activeCard === 'liturgy' ? <Church size={18} /> : <ScrollText size={18} />} {activeBookMeta?.title}
              </strong>
              <button type="submit" disabled={savingBook} className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl flex items-center gap-1.5 cursor-pointer">
                <Save size={15} /> {savingBook ? 'جاري الحفظ...' : 'حفظ في الداتابيز'}
              </button>
            </div>
            <textarea
              rows="14"
              placeholder="اكتب أو الصق نص الكتاب / الصلوات / المردات / القراءات هنا..."
              className="w-full p-3 border rounded-2xl font-normal text-sm leading-loose"
              value={bookText}
              onChange={e => setBookText(e.target.value)}
            />
          </form>
        ) : (
          <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-3">
            <h3 className="text-lg font-black text-[#7a1c24] border-b pb-2">{activeBookMeta?.title}</h3>
            {bookText ? (
              <div className="text-sm leading-loose whitespace-pre-line text-gray-800">{bookText}</div>
            ) : (
              <p className="text-gray-500 text-center py-6">لم يُضف محتوى ({activeBookMeta?.title}) من قِبل الإدارة بعد.</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ==============================================================
  // كارت القطمارس السنوي (13 شهر قبطي)
  // ==============================================================
  if (activeCard === 'katameros') {
    return (
      <div className="space-y-4 text-xs" dir="rtl">
        {renderTopBar('📖 القطمارس السنوي (الـ 13 شهر قبطي)')}

        <div className="bg-white p-4 rounded-3xl border shadow-sm space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <strong className="text-sm text-[#7a1c24]">اختر الشهر القبطي واليوم لفتح القراءات:</strong>
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <label className="px-3 py-1.5 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-xl font-bold cursor-pointer">
                  📥 استيراد JSON القطمارس
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const list = JSON.parse(await file.text());
                        if (!Array.isArray(list) || list.length === 0) return alert('ملف غير صالح');
                        const { error } = await supabase.from('katameros_readings').upsert(list, { onConflict: 'coptic_month,coptic_day' });
                        if (error) return alert('خطأ: ' + error.message);
                        await loadDeaconData();
                        alert(`تم استيراد ${list.length} يوم قطمارس بنجاح ✅`);
                      } catch {
                        alert('تأكد من صيغة ملف JSON');
                      } finally {
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              )}
              <button
                type="button"
                onClick={() => { setSelectedCopticMonth(todayCoptic.month); setSelectedCopticDay(todayCoptic.day); }}
                className="px-3 py-1.5 bg-amber-100 text-amber-950 rounded-xl font-black cursor-pointer"
              >
                فتح قراءات اليوم ({todayCoptic.day} {todayCoptic.month})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {COPTIC_MONTHS.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setSelectedCopticMonth(m); if (m === 'نسيء' && selectedCopticDay > 6) setSelectedCopticDay(1); }}
                className={`px-3 py-1.5 rounded-xl border font-bold cursor-pointer ${selectedCopticMonth === m ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-gray-50 hover:bg-gray-100 text-gray-800'}`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">
            {Array.from({ length: maxDaysInMonth }).map((_, idx) => {
              const d = idx + 1;
              const hasSaved = savedDaysInSelectedMonth.has(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedCopticDay(d)}
                  className={`w-9 h-9 rounded-xl border font-black cursor-pointer transition ${
                    selectedCopticDay === d
                      ? 'bg-[#7a1c24] text-white border-[#7a1c24]'
                      : hasSaved
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                        : 'bg-white hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSaveKatameros} className="bg-white p-5 rounded-3xl border shadow-sm space-y-3 font-bold">
          <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-2">
            <h3 className="text-base font-black text-[#7a1c24]">
              ✝ قراءات يوم ({selectedCopticDay} {selectedCopticMonth})
            </h3>
            {canEdit && (
              <button type="submit" disabled={savingKat} className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl flex items-center gap-1.5 cursor-pointer">
                <Save size={14} /> {savingKat ? 'جاري الحفظ...' : 'حفظ قراءات هذا اليوم'}
              </button>
            )}
          </div>

          <div>
            <label className="block mb-1 text-gray-600">مناسبة اليوم / العيد / التذكار</label>
            <input disabled={!canEdit} className="w-full p-2.5 border rounded-xl bg-amber-50/40" value={katForm.day_title} onChange={e => setKatForm({ ...katForm, day_title: e.target.value })} />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div><label className="block mb-1 text-[#7a1c24]">🕯️ إنجيل عشية</label><textarea disabled={!canEdit} rows="3" className="w-full p-2.5 border rounded-xl font-normal" value={katForm.vespers_gospel} onChange={e => setKatForm({ ...katForm, vespers_gospel: e.target.value })} /></div>
            <div><label className="block mb-1 text-[#7a1c24]">🌅 إنجيل باكر</label><textarea disabled={!canEdit} rows="3" className="w-full p-2.5 border rounded-xl font-normal" value={katForm.matins_gospel} onChange={e => setKatForm({ ...katForm, matins_gospel: e.target.value })} /></div>
            <div><label className="block mb-1 text-[#7a1c24]">📜 البولس</label><textarea disabled={!canEdit} rows="3" className="w-full p-2.5 border rounded-xl font-normal" value={katForm.pauline} onChange={e => setKatForm({ ...katForm, pauline: e.target.value })} /></div>
            <div><label className="block mb-1 text-[#7a1c24]">📜 الكاثوليكون</label><textarea disabled={!canEdit} rows="3" className="w-full p-2.5 border rounded-xl font-normal" value={katForm.catholic} onChange={e => setKatForm({ ...katForm, catholic: e.target.value })} /></div>
            <div><label className="block mb-1 text-[#7a1c24]">📜 الإبركسيس</label><textarea disabled={!canEdit} rows="3" className="w-full p-2.5 border rounded-xl font-normal" value={katForm.praxis} onChange={e => setKatForm({ ...katForm, praxis: e.target.value })} /></div>
            <div><label className="block mb-1 text-[#7a1c24]">📖 السنكسار</label><textarea disabled={!canEdit} rows="3" className="w-full p-2.5 border rounded-xl font-normal" value={katForm.synaxarium} onChange={e => setKatForm({ ...katForm, synaxarium: e.target.value })} /></div>
          </div>

          <div><label className="block mb-1 text-[#7a1c24]">✝ المزمور وإنجيل القداس</label><textarea disabled={!canEdit} rows="4" className="w-full p-2.5 border rounded-xl font-normal" value={katForm.liturgy_psalm_gospel} onChange={e => setKatForm({ ...katForm, liturgy_psalm_gospel: e.target.value })} /></div>
        </form>
      </div>
    );
  }

  // ==============================================================
  // كارت جدول التوزيع (View Only للشماس العادي)
  // ==============================================================
  if (activeCard === 'schedule') {
    return (
      <div className="space-y-4 text-xs" dir="rtl">
        {renderTopBar('📅 جدول التوزيع والمواعيد')}

        {canEdit && (
          <form onSubmit={handleSaveSchedule} className="bg-white p-4 rounded-3xl border space-y-3 font-bold shadow-sm">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h3 className="text-sm font-black text-[#7a1c24]">{editingId ? '✏️ تعديل توزيع الشماس' : 'توزيع الشمامسة والصلوات والقطمارس'}</h3>
              <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-950 rounded-full text-[11px]">
                التقويم القبطي لليوم المختار: <strong>{form.coptic_date || toCopticDate(form.service_date)}</strong>
              </span>
            </div>

            <div className="grid md:grid-cols-4 gap-2">
              <select required className="p-2.5 border rounded-xl" value={form.deacon_id} onChange={e => setForm({ ...form, deacon_id: e.target.value })}>
                <option value="">-- اختر الشماس * --</option>
                {deacons.map(d => <option key={d.id} value={d.id}>{d.full_name} ({d.deacon_rank || 'شماس'})</option>)}
              </select>
              <select className="p-2.5 border rounded-xl bg-blue-50/40" value={form.prayer_hour} onChange={e => setForm({ ...form, prayer_hour: e.target.value })}>
                {PRAYER_HOURS.map((h, i) => <option key={i} value={h}>{h}</option>)}
              </select>
              <select className="p-2.5 border rounded-xl bg-amber-50/40" value={form.service_role} onChange={e => setForm({ ...form, service_role: e.target.value })}>
                {LITURGICAL_ROLES.map((r, i) => <option key={i} value={r}>{r}</option>)}
              </select>
              <input required placeholder="المناسبة (قداس الأربعاء / أسبوع الآلام...)*" className="p-2.5 border rounded-xl" value={form.event_title} onChange={e => setForm({ ...form, event_title: e.target.value })} />
            </div>

            <div className="grid md:grid-cols-3 gap-2">
              <input required type="date" className="p-2.5 border rounded-xl" value={form.service_date} onChange={e => handleDateChange(e.target.value)} />
              <input required placeholder="الساعة (07:00 ص)*" className="p-2.5 border rounded-xl" value={form.service_time} onChange={e => setForm({ ...form, service_time: e.target.value })} />
              <input placeholder="شاهد القراءة (مثال: يو 3: 1-16 أو 1كو 12)" className="p-2.5 border rounded-xl" value={form.reading_reference} onChange={e => setForm({ ...form, reading_reference: e.target.value })} />
            </div>

            <textarea placeholder="نص القراءة / القطع المطلوب تحضيرها..." className="w-full p-2.5 border rounded-xl font-normal" rows="3" value={form.reading_text} onChange={e => setForm({ ...form, reading_text: e.target.value })} />

            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl flex items-center gap-1 cursor-pointer"><Plus size={14} /> {editingId ? '💾 حفظ التعديل' : 'إضافة للجدول'}</button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="px-3 border rounded-xl">إلغاء</button>}
            </div>
          </form>
        )}

        <div className="grid gap-3">
          {displayedSchedules.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border text-center text-gray-500">لا توجد مواعيد مسجلة لك حتى الآن.</div>
          ) : displayedSchedules.map(s => {
            const deacon = deacons.find(d => d.id === s.deacon_id);
            return (
              <div key={s.id} className="bg-white p-4 rounded-2xl border shadow-2xs space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <strong className="text-sm text-gray-900">{deacon?.full_name || 'شماس'}</strong>
                    <span className="mr-2 px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-bold text-[10px]">{s.prayer_hour || 'القداس'}</span>
                    <span className="mr-2 px-2 py-0.5 bg-purple-100 text-purple-900 rounded font-bold text-[10px]">{s.service_role}</span>
                    <p className="text-gray-500 mt-1">
                      ⛪ {s.event_title} • 📅 {s.service_date} (<strong className="text-amber-800">{s.coptic_date || toCopticDate(s.service_date)}</strong>) • ⏰ {s.service_time}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => { setEditingId(s.id); setForm({ ...emptyForm, ...s }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 bg-gray-100 rounded-xl cursor-pointer"><Edit3 size={14} /></button>
                      <button type="button" onClick={() => handleDeleteSchedule(s.id)} className="p-2 bg-red-50 text-red-700 rounded-xl cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
                {(s.reading_reference || s.reading_text) && (
                  <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1">
                    <div className="font-bold text-amber-950 flex items-center gap-1"><BookOpen size={13} /> قراءة القطمارس: {s.reading_reference}</div>
                    {s.reading_text && <p className="text-gray-700 whitespace-pre-line">{s.reading_text}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==============================================================
  // كارت افتقاد الشمامسة (للمشرف فقط)
  // ==============================================================
  if (activeCard === 'visitations' && canEdit) {
    return (
      <div className="space-y-4 text-xs" dir="rtl">
        {renderTopBar('🕊️ افتقاد الشمامسة')}
        <form onSubmit={handleAddVisitation} className="bg-white p-4 rounded-3xl border space-y-3 font-bold">
          <div className="grid md:grid-cols-4 gap-2">
            <select className="p-2 border rounded-xl" value={visitForm.target_user_id} onChange={e => { const d = deacons.find(x => x.id === e.target.value); setVisitForm({ ...visitForm, target_user_id: e.target.value, target_name: d?.full_name || '' }); }}>
              <option value="">-- اختر الشماس --</option>
              {deacons.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
            <input required placeholder="الاسم *" className="p-2 border rounded-xl" value={visitForm.target_name} onChange={e => setVisitForm({ ...visitForm, target_name: e.target.value })} />
            <select className="p-2 border rounded-xl" value={visitForm.visit_method} onChange={e => setVisitForm({ ...visitForm, visit_method: e.target.value })}>
              <option value="زيارة منزلية">زيارة منزلية 🏠</option>
              <option value="رسالة واتساب">رسالة واتساب 💬</option>
              <option value="اتصال هاتفي">اتصال هاتفي 📞</option>
            </select>
            <input type="date" className="p-2 border rounded-xl" value={visitForm.visit_date} onChange={e => setVisitForm({ ...visitForm, visit_date: e.target.value })} />
          </div>
          <input placeholder="ملاحظات الافتقاد..." className="w-full p-2 border rounded-xl" value={visitForm.notes} onChange={e => setVisitForm({ ...visitForm, notes: e.target.value })} />
          <button type="submit" className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer">+ حفظ افتقاد الشماس</button>
        </form>

        <div className="grid gap-2">
          {visitations.map(v => (
            <div key={v.id} className="bg-white p-3.5 rounded-2xl border flex justify-between items-center">
              <div><strong>{v.target_name}</strong> <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded text-[10px] font-bold">{v.visit_method || 'زيارة'}</span> <span className="text-gray-500">• 📅 {v.visit_date} {v.notes && `• ${v.notes}`}</span></div>
              <button type="button" onClick={() => handleDeleteVisitation(v.id)} className="p-2 bg-red-50 text-red-700 rounded-xl cursor-pointer"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
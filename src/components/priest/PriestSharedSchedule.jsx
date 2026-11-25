import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const DAYS_OF_WEEK = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الإثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' },
];

const SERVICE_TYPES = [
  { value: 'liturgy', label: 'القداس الإلهي', icon: '⛪', badge: 'bg-red-100 text-red-900 border-red-200' },
  { value: 'baptism', label: 'معمودية', icon: '💧', badge: 'bg-sky-100 text-sky-900 border-sky-200' },
  { value: 'wedding', label: 'إكليل', icon: '💍', badge: 'bg-purple-100 text-purple-900 border-purple-200' },
  { value: 'melak', label: 'صلاة ملاك', icon: '🕯️', badge: 'bg-amber-100 text-amber-900 border-amber-200' },
  { value: 'vespers', label: 'عشية / تسبحة', icon: '📿', badge: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
  { value: 'other', label: 'خدمة أخرى', icon: '✝️', badge: 'bg-gray-100 text-gray-800 border-gray-200' },
];

const getPriestName = (p) => p?.full_name || p?.name || p?.priest_name || 'كاهن';

const formatTime12 = (timeStr) => {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? 'م' : 'ص';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, '0')}:${mStr} ${period}`;
};

export default function PriestSharedSchedule({ priests = [], selectedPriest = null, churchId = null }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // التبديل بين عرض الكل أو عرض الكاهن المحدد فقط
  const [viewMode, setViewMode] = useState(selectedPriest ? 'priest' : 'shared');
  const [filterService, setFilterService] = useState('all');
  const [filterPriestId, setFilterPriestId] = useState('');
  const [filterDay, setFilterDay] = useState('all');

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    service_type: 'liturgy',
    title: 'القداس الإلهي',
    location: '',
    audience_type: 'قداس عام للشعب',
    schedule_mode: 'weekly',
    day_of_week: new Date().getDay(),
    specific_date: new Date().toISOString().split('T')[0],
    start_time: '07:00',
    end_time: '09:30',
    servant_priest_id: selectedPriest?.id ? String(selectedPriest.id) : '',
    partner_priest_id: '',
    notes: '',
  });

  useEffect(() => {
    if (selectedPriest?.id) {
      setForm((prev) => ({ ...prev, servant_priest_id: String(selectedPriest.id) }));
      setViewMode('priest');
    } else {
      setViewMode('shared');
    }
  }, [selectedPriest]);

  const fetchSchedules = async () => {
    setLoading(true);
    let query = supabase
      .from('church_priest_schedules')
      .select('*')
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })
      .order('specific_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (churchId) {
      query = query.eq('church_id', String(churchId));
    }

    const { data, error } = await query;
    if (!error && data) {
      setSchedules(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSchedules();
  }, [churchId]);

  const handleServiceTypeChange = (type) => {
    const found = SERVICE_TYPES.find((s) => s.value === type);
    setForm((prev) => ({
      ...prev,
      service_type: type,
      title: found ? found.label : prev.title,
      // المعمودية والقداس غالباً جدول أسبوعي، والإكليل والملاك غالباً بتاريخ محدد
      schedule_mode: type === 'wedding' || type === 'melak' ? 'date' : prev.schedule_mode,
      // تفريغ الشريك لو الخدمة معمودية مثلاً (مع بقاء إمكانية اختياره لو حابب)
      partner_priest_id: type === 'baptism' ? '' : prev.partner_priest_id,
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      service_type: 'liturgy',
      title: 'القداس الإلهي',
      location: '',
      audience_type: 'قداس عام للشعب',
      schedule_mode: 'weekly',
      day_of_week: new Date().getDay(),
      specific_date: new Date().toISOString().split('T')[0],
      start_time: '07:00',
      end_time: '09:30',
      servant_priest_id: selectedPriest?.id ? String(selectedPriest.id) : '',
      partner_priest_id: '',
      notes: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.servant_priest_id || !form.location.trim()) {
      alert('من فضلك اختر الأب الكاهن الخادم واكتب اسم الكنيسة / المذبح');
      return;
    }
    if (form.partner_priest_id && form.partner_priest_id === form.servant_priest_id) {
      alert('لا يمكن أن يكون نفس الأب الكاهن خادماً وشريكاً في نفس الخدمة');
      return;
    }

    setSaving(true);
    const servantObj = priests.find((p) => String(p.id) === String(form.servant_priest_id));
    const partnerObj = priests.find((p) => String(p.id) === String(form.partner_priest_id));

    const payload = {
      church_id: churchId ? String(churchId) : null,
      service_type: form.service_type,
      title: form.title.trim() || 'خدمة كنسية',
      location: form.location.trim(),
      audience_type: form.audience_type,
      schedule_mode: form.schedule_mode,
      day_of_week: form.schedule_mode === 'weekly' ? Number(form.day_of_week) : null,
      specific_date: form.schedule_mode === 'date' ? form.specific_date : null,
      start_time: form.start_time,
      end_time: form.end_time,
      servant_priest_id: String(form.servant_priest_id),
      servant_priest_name: getPriestName(servantObj),
      partner_priest_id: form.partner_priest_id ? String(form.partner_priest_id) : null,
      partner_priest_name: partnerObj ? getPriestName(partnerObj) : null,
      notes: form.notes.trim() || null,
    };

    let error;
    if (editingId) {
      const res = await supabase.from('church_priest_schedules').update(payload).eq('id', editingId);
      error = res.error;
    } else {
      const res = await supabase.from('church_priest_schedules').insert([payload]);
      error = res.error;
    }

    setSaving(false);
    if (error) {
      alert('حدث خطأ أثناء الحفظ: ' + error.message);
      return;
    }

    resetForm();
    fetchSchedules();
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      service_type: item.service_type,
      title: item.title,
      location: item.location,
      audience_type: item.audience_type || 'قداس عام للشعب',
      schedule_mode: item.schedule_mode,
      day_of_week: item.day_of_week ?? new Date().getDay(),
      specific_date: item.specific_date || new Date().toISOString().split('T')[0],
      start_time: item.start_time?.slice(0, 5) || '07:00',
      end_time: item.end_time?.slice(0, 5) || '09:30',
      servant_priest_id: item.servant_priest_id || '',
      partner_priest_id: item.partner_priest_id || '',
      notes: item.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الموعد من الجدول؟')) return;
    const { error } = await supabase.from('church_priest_schedules').delete().eq('id', id);
    if (!error) fetchSchedules();
  };

  // حساب مناوبات النهاردة تلقائياً (القداس + المعمودية + الأكاليل والملاك)
  const todayInfo = useMemo(() => {
    const now = new Date();
    const todayDow = now.getDay();
    const todayDate = now.toISOString().split('T')[0];

    const todayItems = schedules.filter(
      (s) =>
        (s.schedule_mode === 'weekly' && Number(s.day_of_week) === todayDow) ||
        (s.schedule_mode === 'date' && s.specific_date === todayDate)
    );

    return {
      dayName: DAYS_OF_WEEK.find((d) => d.value === todayDow)?.label,
      dateStr: todayDate,
      liturgies: todayItems.filter((s) => s.service_type === 'liturgy'),
      baptisms: todayItems.filter((s) => s.service_type === 'baptism'),
      events: todayItems.filter((s) => s.service_type === 'wedding' || s.service_type === 'melak'),
    };
  }, [schedules]);

  // فلترة الجدول حسب العرض المختار والفلاتر
  const filteredSchedules = useMemo(() => {
    return schedules.filter((item) => {
      // لو في وضع عرض الكاهن المحدد
      if (viewMode === 'priest' && selectedPriest?.id) {
        const pid = String(selectedPriest.id);
        if (String(item.servant_priest_id) !== pid && String(item.partner_priest_id) !== pid) {
          return false;
        }
      }
      // فلتر كاهن يدوي في الجدول المشترك
      if (viewMode === 'shared' && filterPriestId) {
        if (String(item.servant_priest_id) !== filterPriestId && String(item.partner_priest_id) !== filterPriestId) {
          return false;
        }
      }
      // فلتر نوع الخدمة
      if (filterService !== 'all' && item.service_type !== filterService) {
        return false;
      }
      // فلتر اليوم
      if (filterDay !== 'all') {
        if (item.schedule_mode === 'weekly' && String(item.day_of_week) !== filterDay) return false;
        if (item.schedule_mode === 'date' && item.specific_date) {
          const d = new Date(item.specific_date).getDay();
          if (String(d) !== filterDay) return false;
        }
      }
      return true;
    });
  }, [schedules, viewMode, selectedPriest, filterPriestId, filterService, filterDay]);

  return (
    <div className="space-y-5" dir="rtl">
      {/* 1. ملخص خدمة النهاردة السريع (مين معاه القداس ومين معاه المعمودية ومين معاه إكليل/ملاك) */}
      <div className="bg-gradient-to-l from-[#7c1d1d] to-[#5a1212] text-white rounded-2xl p-4 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-white/15 pb-2">
          <h3 className="font-bold text-base flex items-center gap-2">
            <span>📅</span>
            <span>مناوبات اليوم ({todayInfo.dayName} - {todayInfo.dateStr})</span>
          </h3>
          <span className="text-xs bg-amber-400 text-black font-bold px-3 py-1 rounded-full">
            دليل الخدمة الفوري
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* قداس اليوم */}
          <div className="bg-white/10 rounded-xl p-3 border border-white/10">
            <div className="text-xs text-amber-300 font-bold mb-1.5">⛪ قداسات اليوم</div>
            {todayInfo.liturgies.length === 0 ? (
              <p className="text-xs text-white/70">لا توجد قداسات مسجلة اليوم</p>
            ) : (
              <div className="space-y-1.5">
                {todayInfo.liturgies.map((l) => (
                  <div key={l.id} className="text-xs bg-black/20 rounded-lg p-2">
                    <div className="font-bold text-white">
                      خادم: {l.servant_priest_name}
                      {l.partner_priest_name && (
                        <span className="text-amber-300"> | شريك: {l.partner_priest_name}</span>
                      )}
                    </div>
                    <div className="text-white/80 mt-0.5">
                      {formatTime12(l.start_time)} - {formatTime12(l.end_time)} ({l.location})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* معمودية اليوم */}
          <div className="bg-white/10 rounded-xl p-3 border border-white/10">
            <div className="text-xs text-sky-300 font-bold mb-1.5">💧 مسؤول المعمودية اليوم</div>
            {todayInfo.baptisms.length === 0 ? (
              <p className="text-xs text-white/70">غير محدد كاهن للمعمودية اليوم</p>
            ) : (
              <div className="space-y-1.5">
                {todayInfo.baptisms.map((b) => (
                  <div key={b.id} className="text-xs bg-black/20 rounded-lg p-2">
                    <div className="font-bold text-white">أبونا: {b.servant_priest_name}</div>
                    <div className="text-white/80 mt-0.5">
                      {formatTime12(b.start_time)} - {formatTime12(b.end_time)} ({b.location})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* أكاليل وملاك اليوم */}
          <div className="bg-white/10 rounded-xl p-3 border border-white/10">
            <div className="text-xs text-purple-200 font-bold mb-1.5">💍 أكاليل وملاك اليوم</div>
            {todayInfo.events.length === 0 ? (
              <p className="text-xs text-white/70">لا توجد أكاليل أو صلاة ملاك اليوم</p>
            ) : (
              <div className="space-y-1.5">
                {todayInfo.events.map((ev) => (
                  <div key={ev.id} className="text-xs bg-black/20 rounded-lg p-2">
                    <div className="font-bold text-white">
                      {ev.service_type === 'wedding' ? '💍 إكليل' : '🕯️ ملاك'} - أبونا {ev.servant_priest_name}
                    </div>
                    <div className="text-white/80 mt-0.5">
                      {formatTime12(ev.start_time)} - {formatTime12(ev.end_time)} {ev.notes ? `(${ev.notes})` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. فورم إضافة / تعديل موعد في الجدول */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-gray-300 p-4 shadow-sm space-y-3"
      >
        <div className="flex items-center justify-between border-b pb-2">
          <h4 className="font-bold text-[#7c1d1d] text-sm">
            {editingId ? '✏️ تعديل موعد في الجدول' : '➕ إضافة خدمة / مناوبة للجدول'}
          </h4>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-gray-500 hover:text-red-600 underline"
            >
              إلغاء التعديل
            </button>
          )}
        </div>

        {/* الصف الأول: نوع الخدمة - اسم الخدمة - الكاهن الخادم - الكاهن الشريك */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1 font-semibold">نوع الخدمة *</label>
            <select
              value={form.service_type}
              onChange={(e) => handleServiceTypeChange(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-[#7c1d1d]"
            >
              {SERVICE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.icon} {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1 font-semibold">المسمى / الوصف</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="مثال: القداس الأول / معمودية"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#7c1d1d]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1 font-semibold">
              {form.service_type === 'liturgy' ? 'الكاهن الخادم *' : 'الأب الكاهن المسؤول *'}
            </label>
            <select
              required
              value={form.servant_priest_id}
              onChange={(e) => setForm({ ...form, servant_priest_id: e.target.value })}
              className="w-full rounded-xl border border-amber-300 bg-amber-50/60 px-3 py-2 text-sm font-semibold focus:outline-none focus:border-[#7c1d1d]"
            >
              <option value="">-- اختر الأب الكاهن --</option>
              {priests.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {getPriestName(p)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1 font-semibold">
              الكاهن الشريك (اختياري)
            </label>
            <select
              value={form.partner_priest_id}
              onChange={(e) => setForm({ ...form, partner_priest_id: e.target.value })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#7c1d1d]"
            >
              <option value="">-- بدون شريك --</option>
              {priests
                .filter((p) => String(p.id) !== String(form.servant_priest_id))
                .map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {getPriestName(p)}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* الصف الثاني: نوع التكرار - اليوم أو التاريخ - من الساعة - إلى الساعة - الكنيسة */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1 font-semibold">نظام الجدول</label>
            <select
              value={form.schedule_mode}
              onChange={(e) => setForm({ ...form, schedule_mode: e.target.value })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#7c1d1d]"
            >
              <option value="weekly">🔁 ثابت أسبوعياً</option>
              <option value="date">📆 بتاريخ محدد</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1 font-semibold">
              {form.schedule_mode === 'weekly' ? 'اليوم الأسبوعي *' : 'التاريخ *'}
            </label>
            {form.schedule_mode === 'weekly' ? (
              <select
                value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#7c1d1d]"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d.value} value={d.value}>
                    كل يوم {d.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="date"
                required
                value={form.specific_date}
                onChange={(e) => setForm({ ...form, specific_date: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#7c1d1d]"
              />
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1 font-semibold">من الساعة *</label>
            <input
              type="time"
              required
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#7c1d1d]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1 font-semibold">إلى الساعة *</label>
            <input
              type="time"
              required
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#7c1d1d]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1 font-semibold">الكنيسة / المذبح *</label>
            <input
              type="text"
              required
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="مثال: المذبح الرئيسي / المعمودية"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#7c1d1d]"
            />
          </div>
        </div>

        {/* الصف الثالث: التصنيف + ملاحظات + زر الإضافة */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1 font-semibold">نوع الحضور</label>
            <select
              value={form.audience_type}
              onChange={(e) => setForm({ ...form, audience_type: e.target.value })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#7c1d1d]"
            >
              <option value="قداس عام للشعب">قداس عام للشعب</option>
              <option value="قداس خاص / خدمة">قداس خاص / خدمة</option>
              <option value="معمودية عامة">معمودية عامة</option>
              <option value="موعد خاص بالحجز">موعد خاص بالحجز</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1 font-semibold">ملاحظات (اختياري)</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="اسم العرسان / تفاصيل المعمودية..."
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#7c1d1d]"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#7c1d1d] hover:bg-[#5f1515] text-white font-bold py-2.5 px-4 rounded-xl text-sm transition disabled:opacity-50"
          >
            {saving ? 'جاري الحفظ...' : editingId ? '💾 حفظ التعديلات' : '+ إضافة للجدول'}
          </button>
        </div>
      </form>

      {/* 3. شريط التبديل والفلاتر */}
      <div className="bg-white rounded-2xl border border-gray-300 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          {/* أزرار التبديل بين جدول أبونا لوحده والجدول المشترك */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
            {selectedPriest && (
              <button
                type="button"
                onClick={() => setViewMode('priest')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'priest'
                    ? 'bg-[#7c1d1d] text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                👤 جدول {getPriestName(selectedPriest)} فقط
              </button>
            )}
            <button
              type="button"
              onClick={() => setViewMode('shared')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'shared'
                  ? 'bg-[#7c1d1d] text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 الجدول المشترك لجميع الكهنة
            </button>
          </div>

          {/* الفلاتر */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs bg-gray-50"
            >
              <option value="all">كل الخدمات</option>
              {SERVICE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.icon} {s.label}
                </option>
              ))}
            </select>

            <select
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs bg-gray-50"
            >
              <option value="all">كل الأيام</option>
              {DAYS_OF_WEEK.map((d) => (
                <option key={d.value} value={String(d.value)}>
                  {d.label}
                </option>
              ))}
            </select>

            {viewMode === 'shared' && (
              <select
                value={filterPriestId}
                onChange={(e) => setFilterPriestId(e.target.value)}
                className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs bg-gray-50"
              >
                <option value="">كل الآباء الكهنة</option>
                {priests.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {getPriestName(p)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 4. جدول العرض */}
        {loading ? (
          <div className="text-center py-8 text-sm text-gray-500">جاري تحميل الجدول...</div>
        ) : filteredSchedules.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            لا توجد مواعيد مسجلة مطابقة للبحث.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-xs border-b">
                  <th className="p-3 rounded-tr-xl">اليوم / التاريخ</th>
                  <th className="p-3">الوقت (من - إلى)</th>
                  <th className="p-3">الخدمة</th>
                  <th className="p-3">الكنيسة / المكان</th>
                  {viewMode === 'priest' && selectedPriest ? (
                    <th className="p-3">دور أبونا</th>
                  ) : null}
                  <th className="p-3">الكاهن الخادم (المسؤول)</th>
                  <th className="p-3">الكاهن الشريك</th>
                  <th className="p-3">ملاحظات</th>
                  <th className="p-3 rounded-tl-xl text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSchedules.map((item) => {
                  const sInfo = SERVICE_TYPES.find((s) => s.value === item.service_type) || SERVICE_TYPES[5];
                  const dayLabel =
                    item.schedule_mode === 'weekly'
                      ? `كل ${DAYS_OF_WEEK.find((d) => d.value === Number(item.day_of_week))?.label || ''}`
                      : `${item.specific_date} (${
                          DAYS_OF_WEEK.find((d) => d.value === new Date(item.specific_date).getDay())?.label || ''
                        })`;

                  // تحديد هل أبونا المفتوح هو الخادم أم الشريك
                  const isSelectedServant =
                    selectedPriest?.id && String(item.servant_priest_id) === String(selectedPriest.id);
                  const isSelectedPartner =
                    selectedPriest?.id && String(item.partner_priest_id) === String(selectedPriest.id);

                  return (
                    <tr key={item.id} className="hover:bg-amber-50/40 transition">
                      <td className="p-3 font-semibold text-gray-800 whitespace-nowrap">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ml-1.5 ${
                            item.schedule_mode === 'weekly' ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}
                          title={item.schedule_mode === 'weekly' ? 'جدول أسبوعي ثابت' : 'بتاريخ محدد'}
                        />
                        {dayLabel}
                      </td>
                      <td className="p-3 whitespace-nowrap font-medium text-gray-700">
                        {formatTime12(item.start_time)} - {formatTime12(item.end_time)}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${sInfo.badge}`}>
                          <span>{sInfo.icon}</span>
                          <span>{item.title}</span>
                        </span>
                      </td>
                      <td className="p-3 text-gray-700">{item.location}</td>

                      {/* عمود الدور لما تكون جوه بروفايل كاهن محدد */}
                      {viewMode === 'priest' && selectedPriest && (
                        <td className="p-3 whitespace-nowrap">
                          {isSelectedServant && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {item.service_type === 'liturgy' ? '⭐ كاهن خادم' : '⭐ مسؤول الخدمة'}
                            </span>
                          )}
                          {isSelectedPartner && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              🤝 كاهن شريك
                            </span>
                          )}
                        </td>
                      )}

                      <td className="p-3 font-bold text-[#7c1d1d] whitespace-nowrap">
                        {item.servant_priest_name}
                      </td>
                      <td className="p-3 text-gray-700 whitespace-nowrap">
                        {item.partner_priest_name ? (
                          <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-lg text-xs font-semibold">
                            {item.partner_priest_name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-gray-600 max-w-[180px]">
                        <div>{item.audience_type}</div>
                        {item.notes && <div className="text-gray-500 mt-0.5">{item.notes}</div>}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="text-xs text-blue-600 hover:underline ml-2 font-semibold"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="text-xs text-red-600 hover:underline font-semibold"
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
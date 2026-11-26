import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';
import {
  Bus, Plus, Trash2, Users, CheckSquare, Square, Calendar,
  MapPin, Edit3, X, Printer, BedDouble, Sparkles, Clock
} from 'lucide-react';

const TRIP_CATEGORIES = [
  'رحلة دير',
  'رحلة سياحية',
  'رحلة عائلية',
  'رحلة ترفيهية',
  'رحلة خلوية / مؤتمر'
];

const INITIAL_FORM = {
  title: '',
  trip_category: 'رحلة دير',
  duration_type: 'one_day', // 'one_day' | 'overnight'
  days_count: 1,
  trip_date: '',
  gathering_time: '',
  departure_time: '',
  return_time: '',
  cost_per_person: '',
  monasteries: '',
  daily_program: '',
  rooms: [],
  target_service: 'مكتب الرحلات العام',
  trip_scope: 'general',
  is_general_trip: true,
  is_public: true
};

const EMPTY_ROOM = {
  room_type: 'غرفة مزدوجة',
  count: 1,
  capacity_per_room: 2,
  notes: ''
};

export default function TripsOfficePage({ currentUser, members = [] }) {
  const [trips, setTrips] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTripId, setEditingTripId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [newRoom, setNewRoom] = useState(EMPTY_ROOM);

  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [seatsCount, setSeatsCount] = useState(1);
  const [regNotes, setRegNotes] = useState('');
  const [regBusy, setRegBusy] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [trRes, regRes] = await Promise.all([
        supabase.from('church_trips').select('*').order('created_at', { ascending: false }),
        supabase.from('trip_registrations').select('*').order('created_at', { ascending: false })
      ]);
      if (!trRes.error && trRes.data) {
        setTrips(trRes.data);
        if (!selectedTripId && trRes.data.length > 0) {
          setSelectedTripId(trRes.data[0].id);
        }
      }
      if (!regRes.error && regRes.data) {
        setRegistrations(regRes.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const categoryCounts = useMemo(() => {
    const map = { all: trips.length };
    for (const cat of TRIP_CATEGORIES) {
      map[cat] = trips.filter(t => (t.trip_category || 'رحلة دير') === cat).length;
    }
    return map;
  }, [trips]);

  const filteredTrips = useMemo(() => {
    if (selectedCategory === 'all') return trips;
    return trips.filter(t => (t.trip_category || 'رحلة دير') === selectedCategory);
  }, [trips, selectedCategory]);

  const activeTrip = useMemo(
    () => trips.find(t => t.id === selectedTripId) || filteredTrips[0] || null,
    [trips, filteredTrips, selectedTripId]
  );

  const tripRegs = useMemo(
    () => (activeTrip ? registrations.filter(r => r.trip_id === activeTrip.id) : []),
    [registrations, activeTrip]
  );

  const totalBookedSeats = useMemo(
    () => tripRegs.reduce((sum, r) => sum + Number(r.seats_count || 1), 0),
    [tripRegs]
  );

  const totalPaidSeats = useMemo(
    () => tripRegs.filter(r => r.paid).reduce((sum, r) => sum + Number(r.seats_count || 1), 0),
    [tripRegs]
  );

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members.slice(0, 40);
    return members
      .filter(m =>
        String(m.full_name || '').toLowerCase().includes(q) ||
        String(m.phone || '').includes(q) ||
        String(m.assigned_class || '').toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [members, memberSearch]);

  const openNewTrip = () => {
    setEditingTripId(null);
    setForm({
      ...INITIAL_FORM,
      trip_category: selectedCategory === 'all' ? 'رحلة دير' : selectedCategory
    });
    setNewRoom(EMPTY_ROOM);
    setShowForm(true);
  };

  const openEditTrip = (trip) => {
    const days = Number(trip.days_count || 1);
    const hasRooms = Array.isArray(trip.rooms) && trip.rooms.length > 0;
    setEditingTripId(trip.id);
    setForm({
      title: trip.title || '',
      trip_category: trip.trip_category || 'رحلة دير',
      duration_type: days > 1 || hasRooms ? 'overnight' : 'one_day',
      days_count: days > 1 ? days : (hasRooms ? 2 : 1),
      trip_date: trip.trip_date || '',
      gathering_time: trip.gathering_time || '',
      departure_time: trip.departure_time || '',
      return_time: trip.return_time || '',
      cost_per_person: trip.cost_per_person ?? '',
      monasteries: trip.monasteries || '',
      daily_program: trip.daily_program || '',
      rooms: Array.isArray(trip.rooms) ? trip.rooms : [],
      target_service: trip.target_service || 'مكتب الرحلات العام',
      trip_scope: trip.trip_scope || 'general',
      is_general_trip: trip.is_general_trip !== false,
      is_public: trip.is_public !== false
    });
    setNewRoom(EMPTY_ROOM);
    setShowForm(true);
  };

  const handleAddRoom = () => {
    const count = Math.max(1, Number(newRoom.count) || 1);
    const cap = Math.max(1, Number(newRoom.capacity_per_room) || 1);
    setForm(prev => ({
      ...prev,
      rooms: [
        ...prev.rooms,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          room_type: newRoom.room_type,
          count,
          capacity_per_room: cap,
          notes: newRoom.notes.trim()
        }
      ]
    }));
    setNewRoom(EMPTY_ROOM);
  };

  const handleRemoveRoom = (roomId) => {
    setForm(prev => ({
      ...prev,
      rooms: prev.rooms.filter(r => r.id !== roomId)
    }));
  };

  const totalRoomsCount = useMemo(
    () => form.rooms.reduce((s, r) => s + Number(r.count || 0), 0),
    [form.rooms]
  );

  const totalRoomsCapacity = useMemo(
    () => form.rooms.reduce((s, r) => s + (Number(r.count || 0) * Number(r.capacity_per_room || 0)), 0),
    [form.rooms]
  );

  const handleSaveTrip = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return alert('اكتب اسم الرحلة أولاً');

    const finalDays = form.duration_type === 'overnight'
      ? Math.max(2, Number(form.days_count) || 2)
      : 1;

    const payload = {
      title: form.title.trim(),
      trip_category: form.trip_category,
      days_count: finalDays,
      trip_date: form.trip_date.trim(),
      gathering_time: form.gathering_time.trim(),
      departure_time: form.departure_time.trim(),
      return_time: form.return_time.trim(),
      cost_per_person: Number(form.cost_per_person) || 0,
      monasteries: form.monasteries.trim(),
      daily_program: form.daily_program.trim(),
      rooms: form.duration_type === 'overnight' ? form.rooms : [],
      target_service: 'مكتب الرحلات العام',
      trip_scope: 'general',
      is_general_trip: true,
      is_public: Boolean(form.is_public)
    };

    setSaving(true);
    try {
      if (editingTripId) {
        const { data, error } = await supabase
          .from('church_trips')
          .update(payload)
          .eq('id', editingTripId)
          .select()
          .single();
        if (error) return alert('تعذر تعديل الرحلة: ' + error.message);
        setTrips(prev => prev.map(t => (t.id === editingTripId ? data : t)));
        setSelectedTripId(data.id);
        logActivity({
          user: currentUser,
          actionType: 'تعديل_رحلة_عامة',
          targetTable: 'church_trips',
          targetId: data.id,
          description: `عدّل رحلة عامة (${data.title}) — فئة: ${data.trip_category}`
        });
      } else {
        const { data, error } = await supabase
          .from('church_trips')
          .insert([{ ...payload, created_by: currentUser?.id || null }])
          .select()
          .single();
        if (error) return alert('تعذر إضافة الرحلة: ' + error.message);
        setTrips(prev => [data, ...prev]);
        setSelectedTripId(data.id);
        logActivity({
          user: currentUser,
          actionType: 'إضافة_رحلة_عامة',
          targetTable: 'church_trips',
          targetId: data.id,
          description: `أضاف رحلة عامة جديدة (${data.title}) — فئة: ${data.trip_category}`
        });
      }
      setShowForm(false);
      setEditingTripId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTrip = async (trip) => {
    if (!confirm(`حذف الرحلة (${trip.title}) وجميع اشتراكاتها؟`)) return;
    const { error } = await supabase.from('church_trips').delete().eq('id', trip.id);
    if (error) return alert('تعذر الحذف: ' + error.message);
    setTrips(prev => prev.filter(t => t.id !== trip.id));
    setRegistrations(prev => prev.filter(r => r.trip_id !== trip.id));
    if (selectedTripId === trip.id) setSelectedTripId(null);
    logActivity({
      user: currentUser,
      actionType: 'حذف_رحلة',
      targetTable: 'church_trips',
      targetId: trip.id,
      description: `حذف رحلة (${trip.title})`
    });
  };

  const handleAddRegistration = async (e) => {
    e.preventDefault();
    if (!activeTrip) return alert('اختر رحلة أولاً');
    const chosenMember = members.find(m => m.id === selectedMemberId);
    const nameVal = chosenMember ? chosenMember.full_name : memberSearch.trim();
    if (!nameVal) return alert('اختر مخدوماً أو اكتب اسماً');

    setRegBusy(true);
    try {
      const { data, error } = await supabase
        .from('trip_registrations')
        .insert([{
          trip_id: activeTrip.id,
          user_id: chosenMember?.id || null,
          user_name: nameVal,
          user_phone: chosenMember?.phone || '',
          seats_count: Math.max(1, Number(seatsCount) || 1),
          notes: regNotes.trim(),
          paid: false,
          attended: false,
          status: 'مؤكد'
        }])
        .select()
        .single();
      if (error) return alert('تعذر تسجيل المشترك: ' + error.message);
      setRegistrations(prev => [data, ...prev]);
      setSelectedMemberId('');
      setMemberSearch('');
      setSeatsCount(1);
      setRegNotes('');
      logActivity({
        user: currentUser,
        actionType: 'تسجيل_مشترك_رحلة',
        targetTable: 'trip_registrations',
        targetId: data.id,
        description: `سجّل (${nameVal}) في رحلة (${activeTrip.title})`
      });
    } finally {
      setRegBusy(false);
    }
  };

  const toggleRegFlag = async (reg, field) => {
    const nextVal = !reg[field];
    const { data, error } = await supabase
      .from('trip_registrations')
      .update({ [field]: nextVal })
      .eq('id', reg.id)
      .select()
      .single();
    if (error) return alert('تعذر التحديث: ' + error.message);
    setRegistrations(prev => prev.map(r => (r.id === reg.id ? data : r)));
  };

  const handleDeleteReg = async (reg) => {
    if (!confirm(`حذف اشتراك (${reg.user_name})؟`)) return;
    const { error } = await supabase.from('trip_registrations').delete().eq('id', reg.id);
    if (error) return alert('تعذر الحذف: ' + error.message);
    setRegistrations(prev => prev.filter(r => r.id !== reg.id));
  };

  const handlePrintTrip = () => {
    if (!activeTrip) return;
    const isOvernight = Number(activeTrip.days_count || 1) > 1 || (Array.isArray(activeTrip.rooms) && activeTrip.rooms.length > 0);
    const roomsHtml = isOvernight && Array.isArray(activeTrip.rooms) && activeTrip.rooms.length > 0
      ? `<h3>تسكين الغرف والمبيت (${activeTrip.days_count || 2} أيام)</h3>
         <table><thead><tr><th>نوع الغرفة</th><th>العدد</th><th>سعة الغرفة</th><th>إجمالي الأفراد</th><th>ملاحظات</th></tr></thead><tbody>
         ${activeTrip.rooms.map(rm => `<tr><td>${rm.room_type}</td><td>${rm.count}</td><td>${rm.capacity_per_room}</td><td>${Number(rm.count || 0) * Number(rm.capacity_per_room || 0)}</td><td>${rm.notes || '-'}</td></tr>`).join('')}
         </tbody></table>`
      : '';

    const w = window.open('', '_blank');
    w.document.write(`
      <html dir="rtl"><head><title>${activeTrip.title}</title>
      <style>
        body { font-family: Tahoma, Arial, sans-serif; padding: 24px; color: #111; }
        h1 { color: #7a1c24; margin-bottom: 6px; }
        .meta { color: #444; font-size: 13px; margin-bottom: 14px; }
        .box { background: #faf8f5; border: 1px solid #e5dec9; padding: 12px 14px; border-radius: 10px; margin-bottom: 14px; white-space: pre-line; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 18px; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 7px 9px; text-align: right; }
        th { background: #7a1c24; color: #fff; }
      </style></head><body>
      <h1>${activeTrip.title}</h1>
      <div class="meta">
        تصنيف: <strong>رحلات عام (مكتب الرحلات) — ${activeTrip.trip_category || 'رحلة دير'}</strong> |
        المدة: <strong>${isOvernight ? `${activeTrip.days_count || 2} أيام (مبيت)` : 'يوم واحد (داي يوز)'}</strong> |
        التاريخ: <strong>${activeTrip.trip_date || '-'}</strong> |
        التكلفة: <strong>${activeTrip.cost_per_person || 0} ج.م</strong>
      </div>
      <div class="meta">
        تجمع: <strong>${activeTrip.gathering_time || '-'}</strong> |
        تحرك: <strong>${activeTrip.departure_time || '-'}</strong> |
        عودة: <strong>${activeTrip.return_time || '-'}</strong>
      </div>
      ${activeTrip.monasteries ? `<div class="box"><strong>الأماكن / الأديرة / المزارات:</strong>\n${activeTrip.monasteries}</div>` : ''}
      ${activeTrip.daily_program ? `<div class="box"><strong>البرنامج التفصيلي للرحلة:</strong>\n${activeTrip.daily_program}</div>` : ''}
      ${roomsHtml}
      <h3>كشف المشتركين (إجمالي الأفراد: ${totalBookedSeats} | المدفوع: ${totalPaidSeats})</h3>
      <table><thead><tr><th>#</th><th>الاسم</th><th>الموبايل</th><th>عدد الأفراد</th><th>سداد</th><th>حضور</th><th>ملاحظات</th></tr></thead><tbody>
      ${tripRegs.map((r, i) => `<tr><td>${i + 1}</td><td>${r.user_name}</td><td>${r.user_phone || '-'}</td><td>${r.seats_count || 1}</td><td>${r.paid ? 'نعم' : 'لا'}</td><td>${r.attended ? 'حضر' : '-'}</td><td>${r.notes || '-'}</td></tr>`).join('')}
      </tbody></table>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const activeIsOvernight = activeTrip
    ? (Number(activeTrip.days_count || 1) > 1 || (Array.isArray(activeTrip.rooms) && activeTrip.rooms.length > 0))
    : false;

  return (
    <div className="space-y-4 text-xs" dir="rtl">
      <div className="bg-linear-to-l from-[#5c1319] via-[#7a1c24] to-[#91212b] text-white p-4 sm:p-5 rounded-3xl shadow-md flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-white/15 text-amber-200 rounded-xl text-[11px] font-black">
              🌐 رحلات عام — مكتب الرحلات الرئيسي
            </span>
          </div>
          <h2 className="text-base sm:text-xl font-black text-amber-300 flex items-center gap-2">
            <Bus size={22} /> مكتب الرحلات العامة للكنيسة
          </h2>
          <p className="text-xs text-white/85 mt-0.5">
            إدارة الرحلات العامة (يوم واحد أو مبيت مع تسكين الغرف)، البرامج اليومية، وكشوف المشتركين
          </p>
        </div>
        <button
          type="button"
          onClick={openNewTrip}
          className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#4a0e13] rounded-2xl font-black flex items-center gap-1.5 cursor-pointer shrink-0 shadow"
        >
          <Plus size={16} /> إضافة رحلة عامة جديدة
        </button>
      </div>

      <div className="bg-white p-2.5 rounded-2xl border shadow-2xs flex items-center gap-1.5 overflow-x-auto font-black">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3.5 py-2 rounded-xl shrink-0 cursor-pointer flex items-center gap-1.5 transition ${
            selectedCategory === 'all' ? 'bg-[#7a1c24] text-white' : 'bg-[#fbfaf7] hover:bg-gray-100 text-gray-700'
          }`}
        >
          <Sparkles size={13} /> كل الرحلات العامة ({categoryCounts.all || 0})
        </button>
        {TRIP_CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-2 rounded-xl shrink-0 cursor-pointer transition ${
              selectedCategory === cat ? 'bg-[#7a1c24] text-white' : 'bg-[#fbfaf7] hover:bg-gray-100 text-gray-700'
            }`}
          >
            {cat} ({categoryCounts[cat] || 0})
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSaveTrip} className="bg-white p-4 sm:p-5 rounded-3xl border-2 border-amber-300 shadow-md space-y-4">
          <div className="flex justify-between items-center border-b pb-2.5">
            <strong className="text-sm text-[#7a1c24]">
              {editingTripId ? 'تعديل بيانات رحلة عامة' : 'إضافة رحلة عامة جديدة (مكتب الرحلات)'}
            </strong>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingTripId(null); }}
              className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold mb-1 text-gray-700">اسم الرحلة *</label>
              <input
                required
                className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
                placeholder="مثال: رحلة دير الأنبا بولا والأنبا أنطونيوس"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-gray-700">تصنيف الرحلة</label>
              <select
                className="w-full p-2.5 border rounded-xl bg-[#fbfaf7] font-bold"
                value={form.trip_category}
                onChange={e => setForm({ ...form, trip_category: e.target.value })}
              >
                {TRIP_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1 text-gray-700">تاريخ الرحلة</label>
              <input
                className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
                placeholder="مثال: الجمعة 12 ديسمبر أو 2026-12-12"
                value={form.trip_date}
                onChange={e => setForm({ ...form, trip_date: e.target.value })}
              />
            </div>
          </div>

          <div className="p-3.5 bg-[#fbfaf7] border border-amber-200/80 rounded-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-black text-[#7a1c24]">مدة الرحلة ونظام الإقامة:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, duration_type: 'one_day', days_count: 1 })}
                  className={`px-3.5 py-1.5 rounded-xl font-black cursor-pointer transition ${
                    form.duration_type === 'one_day'
                      ? 'bg-[#7a1c24] text-white'
                      : 'bg-white border text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  ☀️ رحلة يوم واحد (داي يوز)
                </button>
                <button
                  type="button"
                  onClick={() => setForm({
                    ...form,
                    duration_type: 'overnight',
                    days_count: Math.max(2, Number(form.days_count) || 2)
                  })}
                  className={`px-3.5 py-1.5 rounded-xl font-black cursor-pointer transition ${
                    form.duration_type === 'overnight'
                      ? 'bg-[#7a1c24] text-white'
                      : 'bg-white border text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🌙 رحلة مبيت (أكثر من يوم)
                </button>
              </div>
            </div>

            {form.duration_type === 'overnight' && (
              <div className="space-y-3 pt-2 border-t border-amber-200/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1 text-gray-700">عدد الأيام</label>
                    <input
                      type="number"
                      min={2}
                      className="w-full p-2.5 border rounded-xl bg-white font-bold"
                      value={form.days_count}
                      onChange={e => setForm({ ...form, days_count: Math.max(2, Number(e.target.value) || 2) })}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="w-full p-2.5 bg-amber-50 border border-amber-200 rounded-xl font-bold text-amber-950">
                      إجمالي الغرف: <strong>{totalRoomsCount}</strong> • إجمالي السعة: <strong>{totalRoomsCapacity}</strong> فرد
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white border rounded-2xl space-y-2.5">
                  <strong className="text-xs text-[#7a1c24] flex items-center gap-1.5">
                    <BedDouble size={15} /> إضافة غرفة / فئة تسكين
                  </strong>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <select
                      className="p-2 border rounded-xl bg-[#fbfaf7] font-bold"
                      value={newRoom.room_type}
                      onChange={e => setNewRoom({ ...newRoom, room_type: e.target.value })}
                    >
                      <option value="غرفة مفردة">غرفة مفردة</option>
                      <option value="غرفة مزدوجة">غرفة مزدوجة</option>
                      <option value="غرفة ثلاثية">غرفة ثلاثية</option>
                      <option value="غرفة رباعية">غرفة رباعية</option>
                      <option value="جناح / شاليه">جناح / شاليه</option>
                      <option value="عنبر / بيت خلوة">عنبر / بيت خلوة</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      placeholder="عدد الغرف"
                      className="p-2 border rounded-xl bg-[#fbfaf7]"
                      value={newRoom.count}
                      onChange={e => setNewRoom({ ...newRoom, count: e.target.value })}
                    />
                    <input
                      type="number"
                      min={1}
                      placeholder="سعة الغرفة"
                      className="p-2 border rounded-xl bg-[#fbfaf7]"
                      value={newRoom.capacity_per_room}
                      onChange={e => setNewRoom({ ...newRoom, capacity_per_room: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={handleAddRoom}
                      className="px-3 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer"
                    >
                      + إضافة غرفة
                    </button>
                  </div>
                  <input
                    className="w-full p-2 border rounded-xl bg-[#fbfaf7]"
                    placeholder="ملاحظات الغرفة (اختياري: مثل مطلة / تكييف / دور أرضي...)"
                    value={newRoom.notes}
                    onChange={e => setNewRoom({ ...newRoom, notes: e.target.value })}
                  />

                  {form.rooms.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {form.rooms.map(rm => (
                        <div key={rm.id} className="p-2 bg-[#fbfaf7] border rounded-xl flex justify-between items-center gap-2">
                          <span className="font-bold text-gray-800">
                            🛏️ {rm.room_type} — عدد: <strong>{rm.count}</strong> × سعة: <strong>{rm.capacity_per_room}</strong> ({Number(rm.count) * Number(rm.capacity_per_room)} فرد)
                            {rm.notes && <span className="text-gray-500 font-normal"> • {rm.notes}</span>}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRoom(rm.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold mb-1 text-gray-700">ميعاد التجمع</label>
              <input
                className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
                placeholder="مثال: 06:00 ص"
                value={form.gathering_time}
                onChange={e => setForm({ ...form, gathering_time: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-bold mb-1 text-gray-700">ميعاد التحرك</label>
              <input
                className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
                placeholder="مثال: 06:30 ص"
                value={form.departure_time}
                onChange={e => setForm({ ...form, departure_time: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-bold mb-1 text-gray-700">ميعاد العودة</label>
              <input
                className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
                placeholder="مثال: 09:00 م"
                value={form.return_time}
                onChange={e => setForm({ ...form, return_time: e.target.value })}
              />
            </div>
            <div>
              <label className="block font-bold mb-1 text-gray-700">تكلفة الفرد (ج.م)</label>
              <input
                type="number"
                className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
                placeholder="0"
                value={form.cost_per_person}
                onChange={e => setForm({ ...form, cost_per_person: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1 text-gray-700">الأماكن / الأديرة / المزارات</label>
            <input
              className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
              placeholder="مثال: دير الأنبا بولا - دير الأنبا أنطونيوس - البحر الأحمر"
              value={form.monasteries}
              onChange={e => setForm({ ...form, monasteries: e.target.value })}
            />
          </div>

          <div>
            <label className="block font-bold mb-1 text-gray-700">البرنامج التفصيلي للرحلة</label>
            <textarea
              rows={4}
              className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
              placeholder={form.duration_type === 'overnight'
                ? 'اكتب برنامج اليوم الأول والثاني والأنشطة والصلوات...'
                : 'اكتب برنامج الرحلة بالتفصيل من التحرك حتى العودة...'}
              value={form.daily_program}
              onChange={e => setForm({ ...form, daily_program: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap justify-between items-center gap-3 pt-2 border-t">
            <label className="flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={e => setForm({ ...form, is_public: e.target.checked })}
              />
              ظاهرة في «رحلات عام» للخدام والمخدومين
            </label>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer"
            >
              {saving ? 'جاري الحفظ...' : (editingTripId ? 'حفظ التعديلات' : 'نشر الرحلة العامة')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-400 bg-white rounded-3xl border">جاري تحميل الرحلات...</div>
      ) : filteredTrips.length === 0 ? (
        <div className="p-8 text-center text-gray-400 bg-white rounded-3xl border">
          لا توجد رحلات في هذا التصنيف حالياً. اضغط على «إضافة رحلة عامة جديدة» للبدء.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-4 space-y-2.5 max-h-[75vh] overflow-y-auto pr-0.5">
            {filteredTrips.map(tr => {
              const isSelected = activeTrip?.id === tr.id;
              const regsCount = registrations
                .filter(r => r.trip_id === tr.id)
                .reduce((s, r) => s + Number(r.seats_count || 1), 0);
              const isOvernight = Number(tr.days_count || 1) > 1 || (Array.isArray(tr.rooms) && tr.rooms.length > 0);
              return (
                <div
                  key={tr.id}
                  onClick={() => setSelectedTripId(tr.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition space-y-1.5 ${
                    isSelected
                      ? 'bg-amber-50/80 border-[#7a1c24] shadow-sm'
                      : 'bg-white border-gray-200 hover:bg-[#fbfaf7]'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <strong className="text-sm text-gray-900">{tr.title}</strong>
                    <span className="px-2 py-0.5 bg-[#7a1c24]/10 text-[#7a1c24] rounded-lg font-black text-[10px] shrink-0">
                      {regsCount} فرد
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-950 rounded-md font-black">
                      🌐 رحلات عام
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md font-bold">
                      {tr.trip_category || 'رحلة دير'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md font-black ${
                      isOvernight ? 'bg-indigo-100 text-indigo-950' : 'bg-amber-100 text-amber-950'
                    }`}>
                      {isOvernight ? `🌙 ${tr.days_count || 2} أيام` : '☀️ يوم واحد'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-gray-500 pt-0.5">
                    <span>📅 {tr.trip_date || 'بدون تاريخ'}</span>
                    <span>💰 {Number(tr.cost_per_person) > 0 ? `${tr.cost_per_person} ج.م` : 'مجاني / لم يحدد'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {activeTrip && (
            <div className="lg:col-span-8 bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex flex-wrap justify-between items-start gap-3 border-b pb-3.5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2.5 py-0.5 bg-purple-100 text-purple-950 rounded-xl font-black text-[11px]">
                      🌐 رحلات عام (مكتب الرحلات)
                    </span>
                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-950 rounded-xl font-black text-[11px]">
                      {activeTrip.trip_category || 'رحلة دير'}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-xl font-black text-[11px] ${
                      activeIsOvernight ? 'bg-indigo-100 text-indigo-950' : 'bg-emerald-100 text-emerald-950'
                    }`}>
                      {activeIsOvernight ? `🌙 مبيت (${activeTrip.days_count || 2} أيام)` : '☀️ يوم واحد (داي يوز)'}
                    </span>
                    {Number(activeTrip.cost_per_person) > 0 && (
                      <span className="px-2.5 py-0.5 bg-green-100 text-green-900 rounded-xl font-black text-[11px]">
                        💰 {activeTrip.cost_per_person} ج.م للفرد
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-[#7a1c24]">{activeTrip.title}</h3>
                  <div className="flex flex-wrap gap-3 text-gray-600">
                    <span className="flex items-center gap-1"><Calendar size={13} /> {activeTrip.trip_date || '-'}</span>
                    {activeTrip.gathering_time && (
                      <span className="flex items-center gap-1"><Clock size={13} /> تجمع: {activeTrip.gathering_time}</span>
                    )}
                    {activeTrip.departure_time && <span>تحرك: {activeTrip.departure_time}</span>}
                    {activeTrip.return_time && <span>عودة: {activeTrip.return_time}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrintTrip}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Printer size={14} /> طباعة
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditTrip(activeTrip)}
                    className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 size={14} /> تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTrip(activeTrip)}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={14} /> حذف
                  </button>
                </div>
              </div>

              {activeTrip.monasteries && (
                <div className="p-3 bg-[#fbfaf7] border rounded-2xl text-gray-800">
                  <strong className="text-[#7a1c24] flex items-center gap-1 mb-1">
                    <MapPin size={14} /> الأماكن / الأديرة / المزارات:
                  </strong>
                  {activeTrip.monasteries}
                </div>
              )}

              {activeTrip.daily_program && (
                <div className="p-3.5 bg-[#fbfaf7] border rounded-2xl text-gray-800 whitespace-pre-line">
                  <strong className="text-[#7a1c24] block mb-1">📋 البرنامج التفصيلي:</strong>
                  {activeTrip.daily_program}
                </div>
              )}

              {activeIsOvernight && Array.isArray(activeTrip.rooms) && activeTrip.rooms.length > 0 && (
                <div className="p-3.5 bg-indigo-50/50 border border-indigo-200 rounded-2xl space-y-2">
                  <strong className="text-indigo-950 flex items-center gap-1.5">
                    <BedDouble size={15} /> تسكين الغرف والمبيت ({activeTrip.rooms.length} بنود)
                  </strong>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeTrip.rooms.map((rm, idx) => (
                      <div key={rm.id || idx} className="p-2.5 bg-white border border-indigo-100 rounded-xl flex justify-between items-center">
                        <div>
                          <strong className="text-gray-900">{rm.room_type}</strong>
                          <p className="text-[11px] text-gray-500">
                            عدد الغرف: <strong>{rm.count}</strong> • سعة الغرفة: <strong>{rm.capacity_per_room}</strong>
                            {rm.notes && ` • ${rm.notes}`}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 bg-indigo-100 text-indigo-950 rounded-lg font-black text-[11px]">
                          {Number(rm.count || 0) * Number(rm.capacity_per_room || 0)} فرد
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleAddRegistration} className="p-3.5 bg-[#fbfaf7] border rounded-2xl space-y-2.5">
                <strong className="text-[#7a1c24] flex items-center gap-1.5">
                  <Users size={15} /> تسجيل مشترك في الرحلة
                </strong>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    className="sm:col-span-4 p-2 border rounded-xl bg-white"
                    placeholder="ابحث بالاسم أو اكتب اسم مشترك..."
                    value={memberSearch}
                    onChange={e => { setMemberSearch(e.target.value); setSelectedMemberId(''); }}
                  />
                  <select
                    className="sm:col-span-4 p-2 border rounded-xl bg-white font-bold"
                    value={selectedMemberId}
                    onChange={e => {
                      setSelectedMemberId(e.target.value);
                      const m = members.find(x => x.id === e.target.value);
                      if (m) setMemberSearch(m.full_name);
                    }}
                  >
                    <option value="">-- أو اختر من المخدومين --</option>
                    {filteredMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} {m.assigned_class ? `(${m.assigned_class})` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className="sm:col-span-1 p-2 border rounded-xl bg-white text-center font-bold"
                    title="عدد الأفراد"
                    value={seatsCount}
                    onChange={e => setSeatsCount(e.target.value)}
                  />
                  <input
                    className="sm:col-span-2 p-2 border rounded-xl bg-white"
                    placeholder="ملاحظات..."
                    value={regNotes}
                    onChange={e => setRegNotes(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={regBusy}
                    className="sm:col-span-1 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer"
                  >
                    إضافة
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <strong className="text-gray-800">
                    قائمة المشتركين ({tripRegs.length} حجز — إجمالي {totalBookedSeats} فرد)
                  </strong>
                  <span className="px-2.5 py-1 bg-green-50 text-green-800 rounded-xl font-bold">
                    تم السداد لـ {totalPaidSeats} فرد
                  </span>
                </div>

                {tripRegs.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 border border-dashed rounded-2xl">
                    لا يوجد مشتركين مسجلين في هذه الرحلة بعد.
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-2xl">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-[#fbfaf7] border-b text-gray-700">
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">الاسم</th>
                          <th className="p-2.5">الموبايل</th>
                          <th className="p-2.5">الأفراد</th>
                          <th className="p-2.5">ملاحظات</th>
                          <th className="p-2.5 text-center">سداد</th>
                          <th className="p-2.5 text-center">حضور</th>
                          <th className="p-2.5 text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tripRegs.map((r, idx) => (
                          <tr key={r.id} className="border-b last:border-b-0 hover:bg-[#fbfaf7]/60">
                            <td className="p-2.5 text-gray-500">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-gray-900">{r.user_name}</td>
                            <td className="p-2.5 text-gray-600">{r.user_phone || '-'}</td>
                            <td className="p-2.5 font-black text-[#7a1c24]">{r.seats_count || 1}</td>
                            <td className="p-2.5 text-gray-600">{r.notes || '-'}</td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => toggleRegFlag(r, 'paid')}
                                className={`px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer ${
                                  r.paid ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {r.paid ? <CheckSquare size={13} /> : <Square size={13} />}
                                {r.paid ? 'مدفوع' : 'غير مدفوع'}
                              </button>
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => toggleRegFlag(r, 'attended')}
                                className={`px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer ${
                                  r.attended ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {r.attended ? <CheckSquare size={13} /> : <Square size={13} />}
                                {r.attended ? 'حضر' : 'لم يحضر'}
                              </button>
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteReg(r)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
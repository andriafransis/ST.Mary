import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';
import {
  BusVisualizerSection,
  PrintBusModal,
  createNewBus,
  normalizeBuses,
  buildGroupedPeopleSummary
} from '../components/priest/BusTripManager';
import {
  Bus, Plus, Trash2, Edit3, Printer, Globe, Lock, X,
  ArrowRight, BedDouble, Wind, Sun, Moon, Users, Phone, MessageCircle, ShieldAlert
} from 'lucide-react';

const TRIP_CATEGORIES = [
  { id: 'منتظمة', icon: '📅', title: 'الرحلات المنتظمة', desc: 'الرحلات الدورية الشهرية والأسبوعية (يوم واحد غالباً)' },
  { id: 'موسمية', icon: '🗓️', title: 'الرحلات الموسمية', desc: 'رحلات الأعياد والنهضات والصيامات' },
  { id: 'مصيفية', icon: '🏖️', title: 'الرحلات المصيفية', desc: 'مصايف داي يوز (يوم واحد) أو مصايف مبيت بحجز الأوض' },
  { id: 'مبيت', icon: '🏕️', title: 'رحلات المبيت والمؤتمرات', desc: 'بيوت الخلوة والمؤتمرات مع تسكين الغرف والأفراد' }
];

export default function TripsOfficePage({ currentUser, users = [] }) {
  const todayISO = new Date().toLocaleDateString('en-CA');
  const [activeCard, setActiveCard] = useState('hub');
  const [trips, setTrips] = useState([]);
  const [registrations, setRegistrations] = useState([]);

  // التحقق الدقيق من الصلاحيات المركزية للشخص (من جدول الصلاحيات)
  const isAdmin = currentUser?.role === 'admin';
  const isPriest = currentUser?.role === 'priest';

  const userPerms = currentUser?.permissions || {};
  const screenPerms = userPerms.screen_permissions?.trips_office || {};

  // هل يملك صلاحية إضافة رحلة جديدة؟
  const canAddTrips =
    isAdmin ||
    Boolean(screenPerms.add) ||
    Boolean(userPerms.manage_trips && screenPerms.add !== false);

  // هل يملك صلاحية تعديل الرحلات وتسكينها؟
  const canEditTrips =
    isAdmin ||
    Boolean(screenPerms.edit) ||
    Boolean(userPerms.manage_trips && screenPerms.edit !== false);

  // هل يملك صلاحية حذف الرحلات؟
  const canDeleteTrips =
    isAdmin ||
    Boolean(screenPerms.delete);

  const [editingId, setEditingId] = useState(null);
  const [viewBusTrip, setViewBusTrip] = useState(null);
  const [viewRoomsTrip, setViewRoomsTrip] = useState(null);
  const [viewRegsTrip, setViewRegsTrip] = useState(null);
  const [printBusState, setPrintBusState] = useState(null);

  const [stayMode, setStayMode] = useState('day_use'); // 'day_use' | 'overnight'

  const [newRoomForm, setNewRoomForm] = useState({
    room_number: '',
    ac_type: 'مكيفة ❄️',
    capacity: 4,
    floor_notes: '',
    occupants_text: ''
  });

  const emptyForm = {
    title: '',
    trip_category: 'منتظمة',
    trip_date: '',
    days_count: 1,
    cost_per_person: 0,
    gathering_time: '',
    departure_time: '',
    return_time: '',
    monasteries: '',
    supervisors: '',
    daily_program: '',
    notes: '',
    is_public: true,
    bus_seats: [createNewBus(1, 'الأتوبيس الأول')],
    rooms: []
  };
  const [form, setForm] = useState(emptyForm);

  const loadTrips = async () => {
    const [tr, reg] = await Promise.all([
      supabase.from('church_trips').select('*').order('trip_date', { ascending: true }),
      supabase.from('trip_registrations').select('*').order('created_at', { ascending: false })
    ]);
    if (tr.data) setTrips(tr.data);
    if (reg.data) setRegistrations(reg.data);
  };

  useEffect(() => {
    loadTrips();
  }, []);

  const toManagerTrip = (t) => ({
    ...t,
    event_date: t.trip_date,
    event_time: t.departure_time,
    trip_cost: Number(t.cost_per_person || 0),
    activity_kind: `رحلة ${t.trip_category || 'عامة'}`
  });

  const handleOpenWhatsApp = ({ name = '', phone = '' }) => {
    const clean = String(phone || '').replace(/\D/g, '');
    if (!clean) return alert('لا يوجد رقم تليفون مسجل لهذا الشخص');
    const intl = clean.startsWith('2') ? clean : `2${clean}`;
    const msg = encodeURIComponent(`سلام ونعمة يا ${name || 'أخي'} ✝ — مكتب رحلات الكنيسة`);
    window.open(`https://wa.me/${intl}?text=${msg}`, '_blank');
  };

  const generateProgramTemplate = () => {
    if (stayMode === 'day_use') {
      const tpl = form.trip_category === 'مصيفية'
        ? [
          '• التجمع أمام الكنيسة: 5:30 ص',
          '• التحرك بالأتوبيسات: 6:00 ص',
          '• الوصول للشاطئ / القرية المصيفية واستلام الشماسي والكراسي:',
          '• فقرة ترفيهية / ألعاب ومسابقات:',
          '• الغداء الجماعي:',
          '• التحرك للعودة للكنيسة: 6:00 م'
        ].join('\n')
        : [
          '• التجمع أمام الكنيسة: 6:00 ص',
          '• التحرك بالأتوبيسات: 6:30 ص',
          '• الزيارة الأولى (الدير / الكنيسة):',
          '• صلاة القداس / أخذ البركة والمزارات:',
          '• وقت الغداء والراحة:',
          '• الزيارة الثانية / النشاط الروحي:',
          '• التحرك والعودة للكنيسة: 7:00 م'
        ].join('\n');
      setForm(prev => ({ ...prev, daily_program: tpl }));
    } else {
      const days = Math.max(2, Number(form.days_count || 2));
      const lines = [];
      for (let d = 1; d <= days; d++) {
        lines.push(`--- اليوم ${d} ---`);
        lines.push(
          d === 1
            ? '• التجمع والتحرك:\n• الوصول وتسكين الأوض:\n• الزيارات وبرنامج المساء:'
            : d === days
              ? '• القداس الإلهي:\n• تسليم الأوض:\n• الزيارات والتحرك والعودة للكنيسة:'
              : '• صلاة باكر والقداس:\n• الزيارات / الأنشطة:\n• السهرة الروحية:'
        );
        lines.push('');
      }
      setForm(prev => ({ ...prev, daily_program: lines.join('\n') }));
    }
  };

  const handleSelectStayMode = (mode) => {
    setStayMode(mode);
    if (mode === 'day_use') {
      setForm(prev => ({ ...prev, days_count: 1, rooms: [] }));
    } else {
      setForm(prev => ({ ...prev, days_count: Math.max(2, Number(prev.days_count || 2)) }));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (editingId && !canEditTrips) {
      return alert('🔒 غير مصرح لك بتعديل الرحلات.');
    }
    if (!editingId && !canAddTrips) {
      return alert('🔒 غير مصرح لك بإضافة رحلات جديدة. حسابك للمشاهدة فقط.');
    }

    const busesClean = normalizeBuses(form.bus_seats);
    const isDayUse = stayMode === 'day_use';
    const payload = {
      title: form.title.trim(),
      trip_category: form.trip_category || 'منتظمة',
      target_service: 'مكتب الرحلات العام',
      trip_date: form.trip_date || null,
      days_count: isDayUse ? 1 : Math.max(2, Number(form.days_count || 2)),
      cost_per_person: Number(form.cost_per_person || 0),
      gathering_time: form.gathering_time || '',
      departure_time: form.departure_time || '',
      return_time: form.return_time || '',
      monasteries: form.monasteries || '',
      supervisors: form.supervisors || '',
      daily_program: form.daily_program || '',
      notes: form.notes || '',
      is_public: Boolean(form.is_public),
      bus_seats: busesClean,
      rooms: isDayUse ? [] : (Array.isArray(form.rooms) ? form.rooms : []),
      manager_id: currentUser?.id || null
    };

    if (editingId) {
      const { data, error } = await supabase
        .from('church_trips')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single();
      if (error) return alert('خطأ: ' + error.message);
      setTrips(trips.map(t => (t.id === editingId ? data : t)));
      logActivity({
        user: currentUser,
        actionType: 'تعديل_رحلة_مكتب_الرحلات',
        targetTable: 'church_trips',
        targetId: data.id,
        description: `عدل رحلة (${data.trip_category}): ${data.title}`
      });
      setEditingId(null);
      setActiveCard(data.trip_category || 'منتظمة');
      setForm({ ...emptyForm, bus_seats: [createNewBus(1, 'الأتوبيس الأول')] });
    } else {
      const { data, error } = await supabase
        .from('church_trips')
        .insert([payload])
        .select()
        .single();
      if (error) return alert('خطأ: ' + error.message);
      setTrips([...trips, data]);
      logActivity({
        user: currentUser,
        actionType: 'إضافة_رحلة_مكتب_الرحلات',
        targetTable: 'church_trips',
        targetId: data.id,
        description: `أضاف رحلة (${data.trip_category}): ${data.title}`
      });
      setActiveCard(data.trip_category || 'منتظمة');
      setForm({ ...emptyForm, bus_seats: [createNewBus(1, 'الأتوبيس الأول')] });
    }
  };

  const persistTripBuses = async (updatedBuses) => {
    if (!viewBusTrip) return;
    if (!canEditTrips) {
      return alert('🔒 غير مصرح لك بتعديل المقاعد أو الحجوزات.');
    }
    const { data, error } = await supabase
      .from('church_trips')
      .update({ bus_seats: updatedBuses })
      .eq('id', viewBusTrip.id)
      .select()
      .single();
    if (error) return alert('خطأ في حفظ المقاعد: ' + error.message);
    if (data) {
      setTrips(trips.map(t => (t.id === data.id ? data : t)));
      setViewBusTrip(data);
      logActivity({
        user: currentUser,
        actionType: 'تحديث_أتوبيسات_رحلة',
        targetTable: 'church_trips',
        targetId: data.id,
        description: `حدّث مقاعد أو أقساط رحلة: ${data.title}`
      });
    }
  };

  const persistTripRooms = async (tripId, updatedRooms) => {
    if (!canEditTrips) {
      return alert('🔒 غير مصرح لك بتعديل الغرف.');
    }
    const { data, error } = await supabase
      .from('church_trips')
      .update({ rooms: updatedRooms })
      .eq('id', tripId)
      .select()
      .single();
    if (error) return alert('خطأ في حفظ الغرف: ' + error.message);
    if (data) {
      setTrips(trips.map(t => (t.id === data.id ? data : t)));
      setViewRoomsTrip(data);
      logActivity({
        user: currentUser,
        actionType: 'تحديث_غرف_رحلة',
        targetTable: 'church_trips',
        targetId: data.id,
        description: `حدّث حجوزات أوض رحلة: ${data.title}`
      });
    }
  };

  const handleAddRoom = async () => {
    if (!canEditTrips) return alert('🔒 غير مصرح لك بإضافة أوض.');
    if (!newRoomForm.room_number.trim()) return alert('اكتب رقم أو اسم الأوضة أولاً');
    const roomObj = {
      id: `rm_${Date.now()}`,
      room_number: newRoomForm.room_number.trim(),
      ac_type: newRoomForm.ac_type,
      capacity: Number(newRoomForm.capacity || 2),
      floor_notes: newRoomForm.floor_notes || '',
      occupants_text: newRoomForm.occupants_text || ''
    };
    if (viewRoomsTrip) {
      const updated = [...(Array.isArray(viewRoomsTrip.rooms) ? viewRoomsTrip.rooms : []), roomObj];
      await persistTripRooms(viewRoomsTrip.id, updated);
    } else {
      setForm(prev => ({ ...prev, rooms: [...(prev.rooms || []), roomObj] }));
    }
    setNewRoomForm({ room_number: '', ac_type: 'مكيفة ❄️', capacity: 4, floor_notes: '', occupants_text: '' });
  };

  const handleUpdateRoomOccupants = async (roomId, occupantsText) => {
    if (!viewRoomsTrip) return;
    if (!canEditTrips) return alert('🔒 غير مصرح لك بالتعديل.');
    const updated = (viewRoomsTrip.rooms || []).map(r => (r.id === roomId ? { ...r, occupants_text: occupantsText } : r));
    await persistTripRooms(viewRoomsTrip.id, updated);
  };

  const handleDeleteRoom = async (roomId) => {
    if (!canEditTrips) return alert('🔒 غير مصرح لك بالحذف.');
    if (viewRoomsTrip) {
      const updated = (viewRoomsTrip.rooms || []).filter(r => r.id !== roomId);
      await persistTripRooms(viewRoomsTrip.id, updated);
    } else {
      setForm(prev => ({ ...prev, rooms: (prev.rooms || []).filter(r => r.id !== roomId) }));
    }
  };

  const togglePublic = async (t) => {
    if (!canEditTrips) return alert('🔒 غير مصرح لك بتغيير حالة النشر.');
    const { data } = await supabase
      .from('church_trips')
      .update({ is_public: !t.is_public })
      .eq('id', t.id)
      .select()
      .single();
    if (data) {
      setTrips(trips.map(x => (x.id === t.id ? data : x)));
      logActivity({
        user: currentUser,
        actionType: 'تغيير_ظهور_رحلة',
        targetTable: 'church_trips',
        targetId: t.id,
        description: `${data.is_public ? 'أظهر' : 'أخفى'} رحلة (${t.title}) في الصفحة الرئيسية`
      });
    }
  };

  const deleteTrip = async (t) => {
    if (!canDeleteTrips) return alert('🔒 غير مصرح لك بحذف الرحلات.');
    if (!confirm(`حذف رحلة "${t.title}" من مكتب الرحلات نهائياً؟`)) return;
    const { error } = await supabase.from('church_trips').delete().eq('id', t.id);
    if (!error) {
      setTrips(trips.filter(x => x.id !== t.id));
      logActivity({
        user: currentUser,
        actionType: 'حذف_رحلة_مكتب_الرحلات',
        targetTable: 'church_trips',
        targetId: t.id,
        description: `حذف رحلة: ${t.title}`
      });
    }
  };

  const deleteRegistration = async (regId) => {
    if (!canEditTrips && !canDeleteTrips) return alert('🔒 غير مصرح لك بإدارة الاشتراكات.');
    if (!confirm('حذف طلب الاشتراك؟')) return;
    const { error } = await supabase.from('trip_registrations').delete().eq('id', regId);
    if (!error) setRegistrations(registrations.filter(r => r.id !== regId));
  };

  const openAddScreen = (defaultCategory = 'منتظمة') => {
    if (!canAddTrips) {
      alert('🔒 غير مصرح لك بإضافة رحلات جديدة. صلاحيتك هي المشاهدة فقط.');
      return;
    }
    setEditingId(null);
    const defaultMode = defaultCategory === 'مبيت' ? 'overnight' : 'day_use';
    setStayMode(defaultMode);
    setForm({
      ...emptyForm,
      trip_category: defaultCategory,
      days_count: defaultMode === 'overnight' ? 2 : 1,
      bus_seats: [createNewBus(1, 'الأتوبيس الأول')]
    });
    setActiveCard('add');
  };

  const openEditTrip = (t) => {
    if (!canEditTrips) {
      alert('🔒 غير مصرح لك بتعديل بيانات الرحلات.');
      return;
    }
    setEditingId(t.id);
    const isOvernight = Number(t.days_count || 1) > 1 || (Array.isArray(t.rooms) && t.rooms.length > 0);
    setStayMode(isOvernight ? 'overnight' : 'day_use');
    setForm({
      ...emptyForm,
      ...t,
      bus_seats: normalizeBuses(t.bus_seats),
      rooms: Array.isArray(t.rooms) ? t.rooms : []
    });
    setActiveCard('add');
  };

  const renderTopBack = (title) => (
    <div className="bg-white p-4 rounded-2xl border shadow-2xs flex flex-wrap justify-between items-center gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => setActiveCard('hub')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer">
          <ArrowRight size={15} /> رجوع لكروت مكتب الرحلات
        </button>
        <h2 className="text-base md:text-lg font-black text-[#7a1c24]">{title}</h2>
      </div>
      {canAddTrips && (
        <button
          type="button"
          onClick={() => openAddScreen(activeCard === 'add' ? 'منتظمة' : activeCard)}
          className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl text-xs font-black cursor-pointer flex items-center gap-1"
        >
          <Plus size={14} /> إضافة رحلة جديدة
        </button>
      )}
    </div>
  );

  // ==============================================================
  // HUB: الكروت الكبيرة لمكتب الرحلات
  // ==============================================================
  if (activeCard === 'hub') {
    return (
      <div className="space-y-4 text-xs md:text-sm" dir="rtl">
        <div className="bg-linear-to-r from-[#5c1319] to-[#7a1c24] text-white p-6 rounded-3xl shadow flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-xl font-black text-amber-200 flex items-center gap-2">
              <Bus size={24} /> مكتب الرحلات العامة للكنيسة
            </h2>
            <p className="text-xs md:text-sm text-white/85 mt-1">
              رحلات اليوم الواحد (داي يوز) ببرنامجها الكامل، ورحلات المبيت بحجز الأوض والأتوبيسات والمشتركين
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {!canAddTrips && (
              <span className="px-3 py-1.5 bg-black/30 border border-amber-300/40 rounded-xl text-xs font-bold text-amber-200 flex items-center gap-1.5">
                <ShieldAlert size={14} /> وضع الاستعراض (مشاهدة فقط)
              </span>
            )}
            <span className="px-4 py-2 bg-white/15 rounded-2xl text-xs font-black">الرحلات: {trips.length}</span>
            <span className="px-4 py-2 bg-amber-400 text-[#4a0e13] rounded-2xl text-xs font-black">طلبات الاشتراك: {registrations.length}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* كارت إضافة رحلة جديدة: يظهر فقط إذا كان المستخدم يملك صلاحية الإضافة */}
          {canAddTrips && (
            <button
              type="button"
              onClick={() => openAddScreen('منتظمة')}
              className="bg-amber-50 border-2 border-amber-300 p-6 rounded-3xl text-right shadow-sm hover:shadow-md hover:border-[#7a1c24] transition flex flex-col justify-between gap-3 cursor-pointer"
            >
              <div className="flex justify-between items-start w-full">
                <span className="text-4xl">➕</span>
                <span className="px-3 py-1 bg-[#7a1c24] text-white rounded-full text-xs font-black">جديد</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-[#7a1c24]">إضافة رحلة جديدة</h3>
                <p className="text-xs text-gray-700 mt-1">رحلة يوم واحد (داي يوز) أو رحلة مبيت، مع البرنامج والزيارات والأتوبيسات</p>
              </div>
            </button>
          )}

          {TRIP_CATEGORIES.map(cat => {
            const count = trips.filter(t => (t.trip_category || 'منتظمة') === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCard(cat.id)}
                className="bg-white border-2 border-gray-200 p-6 rounded-3xl text-right shadow-sm hover:shadow-md hover:border-[#7a1c24] transition flex flex-col justify-between gap-3 cursor-pointer"
              >
                <div className="flex justify-between items-start w-full">
                  <span className="text-4xl">{cat.icon}</span>
                  <span className="px-3 py-1 bg-[#f9ecee] text-[#7a1c24] rounded-full text-xs font-black">{count} رحلة</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">{cat.title}</h3>
                  <p className="text-xs text-gray-600 mt-1">{cat.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ==============================================================
  // شاشة إضافة / تعديل رحلة
  // ==============================================================
  if (activeCard === 'add') {
    const isOvernight = stayMode === 'overnight';
    return (
      <div className="space-y-4 text-xs md:text-sm" dir="rtl">
        {renderTopBack(editingId ? '✏️ تعديل الرحلة' : '➕ إضافة رحلة جديدة بمكتب الرحلات')}

        <form onSubmit={handleSave} className="bg-white p-5 rounded-3xl border shadow-sm space-y-4 font-bold">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleSelectStayMode('day_use')}
              className={`p-3.5 rounded-2xl border-2 text-right flex items-center gap-3 cursor-pointer transition ${stayMode === 'day_use' ? 'bg-amber-50 border-amber-500 text-amber-950' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
            >
              <Sun size={22} className="text-amber-600 shrink-0" />
              <div>
                <strong className="block text-sm">رحلة يوم واحد / داي يوز (بدون مبيت)</strong>
                <span className="text-[11px] font-normal">ذهاب وعودة في نفس اليوم مع برنامج الزيارات والأنشطة</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleSelectStayMode('overnight')}
              className={`p-3.5 rounded-2xl border-2 text-right flex items-center gap-3 cursor-pointer transition ${stayMode === 'overnight' ? 'bg-indigo-50 border-indigo-600 text-indigo-950' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
            >
              <Moon size={22} className="text-indigo-700 shrink-0" />
              <div>
                <strong className="block text-sm">رحلة بمبيت (أكثر من يوم + حجز أوض)</strong>
                <span className="text-[11px] font-normal">مصايف مبيت أو مؤتمرات مع تحديد عدد الأيام والأوض</span>
              </div>
            </button>
          </div>

          <div className="grid md:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-xs text-gray-600 mb-1">تصنيف الرحلة *</label>
              <select
                className="w-full p-2.5 border rounded-xl bg-amber-50"
                value={form.trip_category}
                onChange={e => {
                  const val = e.target.value;
                  setForm({ ...form, trip_category: val });
                  if (val === 'مبيت') handleSelectStayMode('overnight');
                }}
              >
                {TRIP_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.title}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">اسم الرحلة / الوجهة *</label>
              <input required placeholder="مثال: رحلة وادي النطرون (يوم واحد) أو مصيف بلطيم..." className="w-full p-2.5 border rounded-xl" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">تاريخ الرحلة *</label>
              <input required type="date" className="w-full p-2.5 border rounded-xl" value={form.trip_date || ''} onChange={e => setForm({ ...form, trip_date: e.target.value })} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-2.5">
            <div>
              <label className="block text-xs text-gray-600 mb-1">{isOvernight ? 'عدد الأيام' : 'المدة'}</label>
              {isOvernight ? (
                <input type="number" min="2" className="w-full p-2.5 border rounded-xl" value={form.days_count} onChange={e => setForm({ ...form, days_count: e.target.value })} />
              ) : (
                <div className="p-2.5 border rounded-xl bg-amber-50 text-amber-950 text-xs font-black text-center">☀️ يوم واحد (داي يوز)</div>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">التكلفة للفرد (ج.م)</label>
              <input type="number" min="0" className="w-full p-2.5 border rounded-xl" value={form.cost_per_person || ''} onChange={e => setForm({ ...form, cost_per_person: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">ميعاد التجمع</label>
              <input placeholder="5:30 ص أمام الكنيسة" className="w-full p-2.5 border rounded-xl" value={form.gathering_time} onChange={e => setForm({ ...form, gathering_time: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">ميعاد التحرك</label>
              <input placeholder="6:00 ص" className="w-full p-2.5 border rounded-xl" value={form.departure_time} onChange={e => setForm({ ...form, departure_time: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">ميعاد العودة المتوقع</label>
              <input placeholder="8:00 م" className="w-full p-2.5 border rounded-xl" value={form.return_time} onChange={e => setForm({ ...form, return_time: e.target.value })} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs text-gray-700">⛪ هنزور إيه؟ (الأديرة / الأماكن / الشاطئ):</label>
              <textarea rows="4" placeholder="اكتب كل الأماكن اللي هنزورها في الرحلة..." className="w-full p-2.5 border rounded-xl font-normal" value={form.monasteries} onChange={e => setForm({ ...form, monasteries: e.target.value })} />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-[#7a1c24]">📋 برنامج الرحلة (اليوم الأول، الثاني، الثالث...):</label>
                <button type="button" onClick={generateProgramTemplate} className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-lg text-[11px] font-black cursor-pointer">
                  ✨ توليد قالب برنامج {isOvernight ? `(${form.days_count} يوم)` : 'اليوم الواحد'}
                </button>
              </div>
              <textarea rows="4" placeholder="اكتب جدول الرحلة بالتفصيل..." className="w-full p-2.5 border rounded-xl font-normal" value={form.daily_program} onChange={e => setForm({ ...form, daily_program: e.target.value })} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-2.5">
            <input placeholder="أسماء المشرفين على الرحلة" className="p-2.5 border rounded-xl" value={form.supervisors} onChange={e => setForm({ ...form, supervisors: e.target.value })} />
            <input placeholder="ملاحظات إضافية (ما يشمله الاشتراك / وجبات / شروط)..." className="p-2.5 border rounded-xl font-normal" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

          {isOvernight && (
            <div className="p-4 rounded-2xl border-2 bg-blue-50/50 border-blue-200 space-y-3">
              <strong className="text-sm text-[#7a1c24] flex items-center gap-1.5">
                <BedDouble size={18} /> حجوزات الأوض / الغرف ({form.rooms?.length || 0} أوضة)
              </strong>
              <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-2">
                <input placeholder="رقم/اسم الأوضة (مثال: غرفة 101)" className="p-2 border rounded-xl bg-white" value={newRoomForm.room_number} onChange={e => setNewRoomForm({ ...newRoomForm, room_number: e.target.value })} />
                <select className="p-2 border rounded-xl bg-white" value={newRoomForm.ac_type} onChange={e => setNewRoomForm({ ...newRoomForm, ac_type: e.target.value })}>
                  <option value="مكيفة ❄️">مكيفة ❄️</option>
                  <option value="مروحة 🌀">مروحة 🌀</option>
                  <option value="عادي بدون تكييف">عادي بدون تكييف</option>
                </select>
                <input type="number" min="1" placeholder="عدد الأفراد" className="p-2 border rounded-xl bg-white" value={newRoomForm.capacity} onChange={e => setNewRoomForm({ ...newRoomForm, capacity: e.target.value })} />
                <input placeholder="الدور / المواصفات" className="p-2 border rounded-xl bg-white" value={newRoomForm.floor_notes} onChange={e => setNewRoomForm({ ...newRoomForm, floor_notes: e.target.value })} />
                <button type="button" onClick={handleAddRoom} className="px-3 py-2 bg-blue-700 text-white rounded-xl font-black cursor-pointer">+ إضافة أوضة</button>
              </div>
              {(form.rooms || []).length > 0 && (
                <div className="grid sm:grid-cols-2 gap-2">
                  {form.rooms.map(rm => (
                    <div key={rm.id} className="bg-white p-2.5 rounded-xl border flex justify-between items-center text-xs">
                      <div>
                        <strong>🚪 {rm.room_number}</strong> • <span className="text-blue-800">{rm.ac_type}</span> • <span>سعة {rm.capacity} أفراد</span>
                        {rm.floor_notes && <span className="block text-gray-500">{rm.floor_notes}</span>}
                      </div>
                      <button type="button" onClick={() => handleDeleteRoom(rm.id)} className="p-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <BusVisualizerSection
            rawBusesData={form.bus_seats}
            tripCost={form.cost_per_person}
            isViewMode={false}
            localUsers={users}
            priest={currentUser}
            todayISO={todayISO}
            onSaveBuses={async (updated) => setForm(prev => ({ ...prev, bus_seats: updated }))}
            onLocalRenameBuses={(updated) => setForm(prev => ({ ...prev, bus_seats: updated }))}
            onOpenWhatsApp={handleOpenWhatsApp}
          />

          <div className="flex flex-wrap justify-between items-center gap-3 pt-1">
            <label className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border cursor-pointer">
              <input type="checkbox" checked={form.is_public} onChange={e => setForm({ ...form, is_public: e.target.checked })} />
              <span>{form.is_public ? '📢 ظاهرة في صفحة الكنيسة وشاشة المخدوم' : '🔒 مخفية عن العامة'}</span>
            </label>
            <button type="submit" className="px-6 py-3 bg-[#7a1c24] text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer">
              <Plus size={16} /> {editingId ? 'حفظ تعديل الرحلة' : 'نشر وحفظ الرحلة'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ==============================================================
  // شاشة عرض رحلات الفئة المختارة
  // ==============================================================
  const catMeta = TRIP_CATEGORIES.find(c => c.id === activeCard);
  const catTrips = trips.filter(t => (t.trip_category || 'منتظمة') === activeCard);

  return (
    <div className="space-y-4 text-xs md:text-sm" dir="rtl">
      <div className={printBusState ? 'print:hidden space-y-4' : 'space-y-4'}>
        {renderTopBack(`${catMeta?.icon || '🚌'} ${catMeta?.title || activeCard} (${catTrips.length})`)}

        {catTrips.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl border text-center text-gray-500">
            لا توجد رحلات مضافة في قسم "{catMeta?.title}" حتى الآن.
          </div>
        ) : (
          <div className="grid gap-3">
            {catTrips.map(t => {
              const busesList = normalizeBuses(t.bus_seats);
              const bookedSeats = busesList.reduce((acc, b) => acc + (b.seats || []).filter(s => !s.isDoor && s.occupant).length, 0);
              const totalSeats = busesList.reduce((acc, b) => acc + (b.seats || []).filter(s => !s.isDoor).length, 0);
              const roomsList = Array.isArray(t.rooms) ? t.rooms : [];
              const tripRegs = registrations.filter(r => r.trip_id === t.id);
              const isOvernight = Number(t.days_count || 1) > 1 || roomsList.length > 0;
              const peopleSum = buildGroupedPeopleSummary(busesList, Number(t.cost_per_person || 0), users);
              const collectedSum = peopleSum.reduce((sum, x) => sum + x.totalPaid, 0);
              const remainingSum = peopleSum.reduce((sum, x) => sum + x.totalRemaining, 0);

              return (
                <div key={t.id} className="bg-white p-5 rounded-3xl border space-y-2.5 shadow-2xs">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div className="space-y-1 flex-1 min-w-[260px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-purple-100 text-purple-950 rounded text-xs font-black">{catMeta?.icon} {t.trip_category}</span>
                        <span className={`px-2.5 py-0.5 rounded text-xs font-black ${isOvernight ? 'bg-indigo-100 text-indigo-950' : 'bg-amber-100 text-amber-950'}`}>
                          {isOvernight ? `🌙 مبيت (${t.days_count} أيام)` : '☀️ يوم واحد (داي يوز)'}
                        </span>
                        <strong className="text-base md:text-lg text-gray-900">{t.title}</strong>
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded text-xs font-black">💰 {t.cost_per_person || 0} ج.م</span>
                      </div>

                      <p className="text-xs text-gray-600">
                        📅 {t.trip_date || '—'}
                        {t.gathering_time && ` • تجمع: ${t.gathering_time}`}
                        {t.departure_time && ` • تحرك: ${t.departure_time}`}
                        {t.return_time && ` • عودة: ${t.return_time}`}
                        {t.supervisors && ` • مشرفون: ${t.supervisors}`}
                      </p>

                      {t.monasteries && <p className="text-xs text-gray-800">⛪ <strong>الأماكن والمزارات:</strong> {t.monasteries}</p>}

                      {t.daily_program && (
                        <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-2xl text-xs text-gray-800 whitespace-pre-line">
                          <strong className="block text-[#7a1c24] mb-1">📋 برنامج الرحلة:</strong>
                          {t.daily_program}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-black text-emerald-800">محصل: {collectedSum} ج.م</span>
                        {remainingSum > 0 && <span className="px-2.5 py-1 bg-red-50 border border-red-200 rounded-lg text-xs font-black text-red-700">متبقي: {remainingSum} ج.م</span>}
                        {isOvernight && <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs font-black text-blue-900">🚪 الأوض: {roomsList.length}</span>}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => setViewRegsTrip(t)} className="px-3.5 py-2 bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-xs">
                        <Users size={16} /> المشتركين ({tripRegs.length})
                      </button>
                      {isOvernight && (
                        <button type="button" onClick={() => setViewRoomsTrip(t)} className="px-3.5 py-2 bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-xs">
                          <BedDouble size={16} /> الأوض والغرف ({roomsList.length})
                        </button>
                      )}
                      <button type="button" onClick={() => setViewBusTrip(t)} className="px-3.5 py-2 bg-amber-500 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-xs">
                        <Bus size={16} /> الأتوبيسات ({bookedSeats}/{totalSeats})
                      </button>
                      <button type="button" onClick={() => setPrintBusState({ trip: toManagerTrip(t), buses: busesList })} className="px-3.5 py-2 bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-xs">
                        <Printer size={16} /> طباعة
                      </button>

                      {/* أزرار التعديل والحذف تظهر فقط لمن يملك الصلاحية */}
                      {canEditTrips && (
                        <>
                          <button type="button" onClick={() => openEditTrip(t)} className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer" title="تعديل">
                            <Edit3 size={15} />
                          </button>
                          <button type="button" onClick={() => togglePublic(t)} className="p-2.5 bg-blue-50 rounded-xl cursor-pointer" title={t.is_public ? 'ظاهرة للعامة' : 'مخفية'}>
                            {t.is_public ? <Globe size={15} /> : <Lock size={15} />}
                          </button>
                        </>
                      )}
                      {canDeleteTrips && (
                        <button type="button" onClick={() => deleteTrip(t)} className="p-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl cursor-pointer" title="حذف">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* مودال المشتركين من الموبايل / شاشة المخدوم */}
        {viewRegsTrip && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl w-full max-w-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="text-base font-black text-[#7a1c24]">✋ المشتركين من التطبيق — {viewRegsTrip.title}</h3>
                  <p className="text-xs text-gray-500">الأعضاء الذين ضغطوا "اشتراك في الرحلة" من حساباتهم</p>
                </div>
                <button type="button" onClick={() => setViewRegsTrip(null)} className="p-2 bg-gray-100 rounded-xl cursor-pointer"><X size={18} /></button>
              </div>
              {registrations.filter(r => r.trip_id === viewRegsTrip.id).length === 0 ? (
                <p className="text-center text-gray-500 py-6">لا توجد اشتراكات أونلاين لهذه الرحلة بعد.</p>
              ) : (
                <div className="space-y-2">
                  {registrations.filter(r => r.trip_id === viewRegsTrip.id).map(r => (
                    <div key={r.id} className="p-3 bg-[#fbfaf7] border rounded-2xl flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <strong className="text-sm text-gray-900 block">{r.user_name}</strong>
                        <span className="text-xs text-gray-600">
                          💺 عدد الأفراد: <strong>{r.seats_count}</strong>
                          {r.user_phone && ` • 📞 ${r.user_phone}`}
                          {r.notes && ` • 📝 ${r.notes}`}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        {r.user_phone && (
                          <>
                            <button type="button" onClick={() => handleOpenWhatsApp({ name: r.user_name, phone: r.user_phone })} className="p-2 bg-green-600 text-white rounded-xl cursor-pointer"><MessageCircle size={14} /></button>
                            <a href={`tel:${r.user_phone}`} className="p-2 bg-gray-100 text-gray-800 rounded-xl"><Phone size={14} /></a>
                          </>
                        )}
                        {canDeleteTrips && (
                          <button type="button" onClick={() => deleteRegistration(r.id)} className="p-2 bg-red-50 text-red-700 rounded-xl cursor-pointer"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* مودال إدارة الأتوبيسات */}
        {viewBusTrip && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl w-full max-w-3xl p-5 space-y-3 max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="text-lg font-black text-[#7a1c24]">🚌 الأتوبيسات والمقاعد — {viewBusTrip.title}</h3>
                  <p className="text-xs text-gray-600">التاريخ: {viewBusTrip.trip_date} • التكلفة: {viewBusTrip.cost_per_person || 0} ج.م</p>
                </div>
                <button type="button" onClick={() => setViewBusTrip(null)} className="p-2 bg-gray-100 rounded-xl cursor-pointer"><X size={18} /></button>
              </div>
              <BusVisualizerSection
                rawBusesData={viewBusTrip.bus_seats}
                tripCost={viewBusTrip.cost_per_person}
                isViewMode={true}
                tripObj={toManagerTrip(viewBusTrip)}
                localUsers={users}
                priest={currentUser}
                todayISO={todayISO}
                onSaveBuses={persistTripBuses}
                onLocalRenameBuses={(updated) => setViewBusTrip(prev => ({ ...prev, bus_seats: updated }))}
                onOpenPrint={setPrintBusState}
                onOpenWhatsApp={handleOpenWhatsApp}
              />
            </div>
          </div>
        )}

        {/* مودال إدارة الأوض والغرف */}
        {viewRoomsTrip && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl w-full max-w-3xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="text-lg font-black text-[#7a1c24] flex items-center gap-2"><BedDouble size={20} /> حجز الأوض والغرف — {viewRoomsTrip.title}</h3>
                  <p className="text-xs text-gray-600">حدد عدد الأوض، التكييف، السعة، وأسماء النزلاء في كل أوضة</p>
                </div>
                <button type="button" onClick={() => setViewRoomsTrip(null)} className="p-2 bg-gray-100 rounded-xl cursor-pointer"><X size={18} /></button>
              </div>

              {canEditTrips && (
                <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200 space-y-2.5 font-bold">
                  <span className="text-xs text-blue-950 block">+ إضافة أوضة / شاليه جديد:</span>
                  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2">
                    <input placeholder="رقم/اسم الأوضة *" className="p-2 border rounded-xl bg-white" value={newRoomForm.room_number} onChange={e => setNewRoomForm({ ...newRoomForm, room_number: e.target.value })} />
                    <select className="p-2 border rounded-xl bg-white" value={newRoomForm.ac_type} onChange={e => setNewRoomForm({ ...newRoomForm, ac_type: e.target.value })}>
                      <option value="مكيفة ❄️">مكيفة ❄️</option>
                      <option value="مروحة 🌀">مروحة 🌀</option>
                      <option value="عادي بدون تكييف">عادي بدون تكييف</option>
                    </select>
                    <input type="number" min="1" placeholder="عدد الأفراد (السعة)" className="p-2 border rounded-xl bg-white" value={newRoomForm.capacity} onChange={e => setNewRoomForm({ ...newRoomForm, capacity: e.target.value })} />
                    <input placeholder="الدور / المواصفات" className="p-2 border rounded-xl bg-white" value={newRoomForm.floor_notes} onChange={e => setNewRoomForm({ ...newRoomForm, floor_notes: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <input placeholder="أسماء الأفراد المسكنين في الأوضة..." className="flex-1 p-2 border rounded-xl bg-white font-normal" value={newRoomForm.occupants_text} onChange={e => setNewRoomForm({ ...newRoomForm, occupants_text: e.target.value })} />
                    <button type="button" onClick={handleAddRoom} className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer">+ إضافة</button>
                  </div>
                </div>
              )}

              {(viewRoomsTrip.rooms || []).length === 0 ? (
                <div className="p-6 bg-gray-50 rounded-2xl border text-center text-gray-500">لم تُضف أوض لهذه الرحلة بعد.</div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {viewRoomsTrip.rooms.map(rm => (
                    <div key={rm.id} className="p-3.5 bg-[#fbfaf7] border-2 border-gray-200 rounded-2xl space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <strong className="text-sm text-[#7a1c24]">🚪 {rm.room_number}</strong>
                          <div className="flex flex-wrap gap-1.5 mt-1 text-[11px]">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-bold flex items-center gap-1"><Wind size={11} /> {rm.ac_type}</span>
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-950 rounded font-bold">👥 {rm.capacity} أفراد</span>
                          </div>
                          {rm.floor_notes && <span className="text-[11px] text-gray-500 block mt-1">{rm.floor_notes}</span>}
                        </div>
                        {canEditTrips && (
                          <button type="button" onClick={() => handleDeleteRoom(rm.id)} className="p-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer"><Trash2 size={13} /></button>
                        )}
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-600 block mb-1 font-bold">أسماء النزلاء في الأوضة:</label>
                        <textarea
                          rows="2"
                          placeholder="اكتب أسماء الأفراد..."
                          className="w-full p-2 border rounded-xl bg-white text-xs disabled:bg-gray-100"
                          disabled={!canEditTrips}
                          defaultValue={rm.occupants_text || ''}
                          onBlur={e => handleUpdateRoomOccupants(rm.id, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <PrintBusModal printBusState={printBusState} setPrintBusState={setPrintBusState} priest={currentUser} todayISO={todayISO} />
    </div>
  );
}
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';
import BusTripPrintSheet from './BusTripPrintSheet';
import {
  Bus, Plus, Trash2, Edit3, Printer, Globe, Lock, X,
  ArrowRight, BedDouble, Wind, Sun, Moon, Users, Phone,
  MessageCircle, ShieldAlert, UserCheck, Wallet, Building2, Sparkles
} from 'lucide-react';

const TRIP_CATEGORIES = [
  { id: 'منتظمة', icon: '📅', title: 'الرحلات المنتظمة', desc: 'الرحلات الدورية الشهرية والأسبوعية (يوم واحد غالباً)' },
  { id: 'موسمية', icon: '🗓️', title: 'الرحلات الموسمية', desc: 'رحلات الأعياد والنهضات والصيامات' },
  { id: 'مصيفية', icon: '🏖️', title: 'الرحلات المصيفية', desc: 'مصايف داي يوز (يوم واحد) أو مصايف مبيت بحجز الأوض' },
  { id: 'مبيت', icon: '🏕️', title: 'رحلات المبيت والمؤتمرات', desc: 'بيوت الخلوة والمؤتمرات مع تسكين الغرف والأفراد' }
];

const SOURCE_MODES = [
  { id: 'general_office', label: 'مكتب الرحلات العام', badge: '🏢 مكتب الرحلات العام' },
  { id: 'service', label: 'خدمة معينة بالكنيسة', badge: '⛪ خدمة:' }
];

const PAYMENT_STATUS_OPTIONS = [
  { id: 'paid_all', label: 'دفع كل حاجة ✅', tone: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  { id: 'has_due', label: 'عليه فلوس / متبقي ⚠️', tone: 'bg-rose-100 text-rose-900 border-rose-300' },
  { id: 'no_due_exempt', label: 'معاهوش / معفى 🕊️', tone: 'bg-sky-100 text-sky-900 border-sky-300' }
];

const DEFAULT_SEAT_ROWS = 10;

export function createNewBus(busNumber = 1, customName = '') {
  const seats = [];
  for (let r = 1; r <= DEFAULT_SEAT_ROWS; r++) {
    ['A', 'B', 'C', 'D'].forEach((col, idx) => {
      const seatCode = `${r}${col}`;
      seats.push({
        id: `bus${busNumber}-${seatCode}`,
        code: seatCode,
        row: r,
        side: idx < 2 ? 'left' : 'right',
        occupant: null
      });
    });
  }
  return {
    id: `bus-${Date.now()}-${busNumber}`,
    name: customName || `الأتوبيس رقم ${busNumber}`,
    supervisor_name: '',
    supervisor_phone: '',
    seats
  };
}

export function normalizeBuses(rawBuses) {
  if (!Array.isArray(rawBuses) || rawBuses.length === 0) {
    return [createNewBus(1, 'الأتوبيس الأول')];
  }
  return rawBuses.map((b, idx) => {
    const fallback = createNewBus(idx + 1, b?.name || `الأتوبيس رقم ${idx + 1}`);
    const existingSeats = Array.isArray(b?.seats) ? b.seats : [];
    const mergedSeats = fallback.seats.map(defSeat => {
      const found = existingSeats.find(es => es.id === defSeat.id || es.code === defSeat.code);
      return found ? { ...defSeat, ...found } : defSeat;
    });
    return {
      ...fallback,
      ...b,
      name: b?.name || fallback.name,
      supervisor_name: b?.supervisor_name || '',
      supervisor_phone: b?.supervisor_phone || '',
      seats: mergedSeats
    };
  });
}

export function getSeatFinancialInfo(seat, tripCost = 0) {
  const baseCost = Math.max(0, Number(tripCost || 0));
  const occ = seat?.occupant;
  if (!occ) {
    return { status: 'empty', paid: 0, remaining: 0, label: 'متاح' };
  }
  const explicitStatus = occ.payment_status;
  const paid = Math.max(0, Number(occ.paid_amount ?? (explicitStatus === 'paid_all' ? baseCost : 0)));

  if (explicitStatus === 'no_due_exempt') {
    return { status: 'no_due_exempt', paid, remaining: 0, label: 'معاهوش / معفى' };
  }
  if (explicitStatus === 'paid_all') {
    return { status: 'paid_all', paid: Math.max(paid, baseCost), remaining: 0, label: 'دفع كل حاجة' };
  }
  const remaining = Math.max(0, baseCost - paid);
  if (remaining === 0 && baseCost > 0) {
    return { status: 'paid_all', paid, remaining: 0, label: 'دفع كل حاجة' };
  }
  return { status: 'has_due', paid, remaining, label: remaining > 0 ? `عليه ${remaining} ج.م` : 'عليه فلوس' };
}

export function buildBusFinancialSummary(buses, tripCost = 0) {
  const list = normalizeBuses(buses);
  let bookedCount = 0;
  let paidAllCount = 0;
  let hasDueCount = 0;
  let exemptCount = 0;
  let totalPaid = 0;
  let totalRemaining = 0;

  list.forEach(b => {
    (b.seats || []).forEach(s => {
      if (!s.occupant) return;
      bookedCount += 1;
      const fin = getSeatFinancialInfo(s, tripCost);
      totalPaid += fin.paid;
      totalRemaining += fin.remaining;
      if (fin.status === 'paid_all') paidAllCount += 1;
      else if (fin.status === 'has_due') hasDueCount += 1;
      else if (fin.status === 'no_due_exempt') exemptCount += 1;
    });
  });

  return { bookedCount, paidAllCount, hasDueCount, exemptCount, totalPaid, totalRemaining };
}

export default function BusBookingAndTripsManager({ currentUser, users = [] }) {
  const todayISO = new Date().toLocaleDateString('en-CA');
  const [activeCard, setActiveCard] = useState('hub');
  const [trips, setTrips] = useState([]);
  const [registrations, setRegistrations] = useState([]);

  const isAdmin = currentUser?.role === 'admin';
  const userPerms = currentUser?.permissions || {};
  const screenPerms = userPerms.screen_permissions?.trips_office || {};

  const canAddTrips =
    isAdmin ||
    Boolean(screenPerms.add) ||
    Boolean(userPerms.manage_trips && screenPerms.add !== false);

  const canEditTrips =
    isAdmin ||
    Boolean(screenPerms.edit) ||
    Boolean(userPerms.manage_trips && screenPerms.edit !== false);

  const canDeleteTrips = isAdmin || Boolean(screenPerms.delete);

  const [editingId, setEditingId] = useState(null);
  const [viewBusTrip, setViewBusTrip] = useState(null);
  const [viewRoomsTrip, setViewRoomsTrip] = useState(null);
  const [viewRegsTrip, setViewRegsTrip] = useState(null);
  const [printPayload, setPrintPayload] = useState(null);

  const [activeBusIdx, setActiveBusIdx] = useState(0);
  const [selectedSeatId, setSelectedSeatId] = useState(null);
  const [seatDraft, setSeatDraft] = useState({
    user_id: '',
    passenger_name: '',
    passenger_phone: '',
    payment_status: 'has_due',
    paid_amount: 0,
    notes: ''
  });

  const [stayMode, setStayMode] = useState('day_use');
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
    origin_mode: 'general_office', // 'general_office' | 'service'
    target_service: 'مكتب الرحلات العام',
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

  const getTripOriginBadge = (t) => {
    const isGeneral =
      t?.origin_mode === 'general_office' ||
      (!t?.target_service || t.target_service === 'مكتب الرحلات العام');
    if (isGeneral) {
      return {
        isGeneral: true,
        label: 'مكتب الرحلات العام',
        className: 'bg-amber-100 text-amber-950 border-amber-300'
      };
    }
    return {
      isGeneral: false,
      label: `خدمة: ${t.target_service}`,
      className: 'bg-indigo-100 text-indigo-950 border-indigo-300'
    };
  };

  const handleOpenWhatsApp = ({ name = '', phone = '' }) => {
    const clean = String(phone || '').replace(/\D/g, '');
    if (!clean) return alert('لا يوجد رقم تليفون مسجل لهذا الشخص');
    const intl = clean.startsWith('2') ? clean : `2${clean}`;
    const msg = encodeURIComponent(`سلام ونعمة يا ${name || 'أخي'} ✝ — رحلات الكنيسة`);
    window.open(`https://wa.me/${intl}?text=${msg}`, '_blank');
  };

  const generateProgramTemplate = () => {
    if (stayMode === 'day_use') {
      const tpl = [
        '• التجمع أمام الكنيسة: 6:00 ص',
        '• التحرك بالأتوبيسات: 6:30 ص',
        '• الزيارة الأولى والقداس / الأنشطة:',
        '• الغداء والراحة:',
        '• الزيارة الثانية والعودة للكنيسة: 7:00 م'
      ].join('\n');
      setForm(prev => ({ ...prev, daily_program: tpl }));
    } else {
      const days = Math.max(2, Number(form.days_count || 2));
      const lines = [];
      for (let d = 1; d <= days; d++) {
        lines.push(`--- اليوم ${d} ---`);
        lines.push(
          d === 1
            ? '• التجمع والتحرك:\n• الوصول وتسكين الأوض:\n• برنامج المساء:'
            : d === days
              ? '• القداس الإلهي:\n• تسليم الأوض:\n• التحرك والعودة للكنيسة:'
              : '• صلاة باكر والقداس:\n• الزيارات والأنشطة:\n• السهرة الروحية:'
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
    if (editingId && !canEditTrips) return alert('🔒 غير مصرح لك بتعديل الرحلات.');
    if (!editingId && !canAddTrips) return alert('🔒 غير مصرح لك بإضافة رحلات جديدة.');

    const isGeneralOffice = form.origin_mode === 'general_office';
    const serviceNameClean = isGeneralOffice
      ? 'مكتب الرحلات العام'
      : (form.target_service || '').trim() || 'خدمة غير محددة';

    const busesClean = normalizeBuses(form.bus_seats);
    const isDayUse = stayMode === 'day_use';

    const payload = {
      title: form.title.trim(),
      trip_category: form.trip_category || 'منتظمة',
      origin_mode: isGeneralOffice ? 'general_office' : 'service',
      target_service: serviceNameClean,
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
        actionType: 'تعديل_رحلة',
        targetTable: 'church_trips',
        targetId: data.id,
        description: `عدل رحلة (${data.title}) — المصدر: ${serviceNameClean}`
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
        actionType: 'إضافة_رحلة',
        targetTable: 'church_trips',
        targetId: data.id,
        description: `أضاف رحلة (${data.title}) — المصدر: ${serviceNameClean}`
      });
      setActiveCard(data.trip_category || 'منتظمة');
      setForm({ ...emptyForm, bus_seats: [createNewBus(1, 'الأتوبيس الأول')] });
    }
  };

  const persistTripBuses = async (updatedBuses) => {
    const clean = normalizeBuses(updatedBuses);
    if (viewBusTrip) {
      if (!canEditTrips) return alert('🔒 غير مصرح لك بتعديل المقاعد أو الحسابات.');
      const { data, error } = await supabase
        .from('church_trips')
        .update({ bus_seats: clean })
        .eq('id', viewBusTrip.id)
        .select()
        .single();
      if (error) return alert('خطأ في حفظ المقاعد: ' + error.message);
      if (data) {
        setTrips(trips.map(t => (t.id === data.id ? data : t)));
        setViewBusTrip(data);
        logActivity({
          user: currentUser,
          actionType: 'تحديث_مقاعد_أتوبيس',
          targetTable: 'church_trips',
          targetId: data.id,
          description: `حدّث أتوبيسات وحسابات رحلة: ${data.title}`
        });
      }
    } else {
      setForm(prev => ({ ...prev, bus_seats: clean }));
    }
  };

  const currentEditableBuses = useMemo(() => {
    return normalizeBuses(viewBusTrip ? viewBusTrip.bus_seats : form.bus_seats);
  }, [viewBusTrip, form.bus_seats]);

  const currentTripCost = Number(viewBusTrip ? viewBusTrip.cost_per_person : form.cost_per_person) || 0;
  const activeBus = currentEditableBuses[activeBusIdx] || currentEditableBuses[0];

  const handleSelectSeat = (seat) => {
    setSelectedSeatId(seat.id);
    const occ = seat.occupant;
    const fin = getSeatFinancialInfo(seat, currentTripCost);
    setSeatDraft({
      user_id: occ?.user_id || '',
      passenger_name: occ?.passenger_name || '',
      passenger_phone: occ?.passenger_phone || '',
      payment_status: occ ? fin.status : 'has_due',
      paid_amount: occ ? fin.paid : 0,
      notes: occ?.notes || ''
    });
  };

  const handlePickUserForSeat = (userId) => {
    const found = users.find(u => String(u.id) === String(userId));
    if (!found) {
      setSeatDraft(prev => ({ ...prev, user_id: '' }));
      return;
    }
    setSeatDraft(prev => ({
      ...prev,
      user_id: found.id,
      passenger_name: found.full_name || prev.passenger_name,
      passenger_phone: found.phone || prev.passenger_phone
    }));
  };

  const handleSaveSeatBooking = async () => {
    if (!canEditTrips) return alert('🔒 غير مصرح لك بحجز أو تعديل المقاعد.');
    if (!activeBus || !selectedSeatId) return;
    if (!seatDraft.passenger_name.trim()) return alert('اكتب اسم الراكب أولاً');

    let paidNum = Math.max(0, Number(seatDraft.paid_amount || 0));
    if (seatDraft.payment_status === 'paid_all') {
      paidNum = Math.max(paidNum, currentTripCost);
    } else if (seatDraft.payment_status === 'no_due_exempt') {
      paidNum = 0;
    }

    const updatedBuses = currentEditableBuses.map((bus, bIdx) => {
      if (bIdx !== activeBusIdx) return bus;
      return {
        ...bus,
        seats: bus.seats.map(s =>
          s.id === selectedSeatId
            ? {
                ...s,
                occupant: {
                  user_id: seatDraft.user_id || null,
                  passenger_name: seatDraft.passenger_name.trim(),
                  passenger_phone: seatDraft.passenger_phone.trim(),
                  payment_status: seatDraft.payment_status,
                  paid_amount: paidNum,
                  notes: seatDraft.notes.trim(),
                  updated_at: todayISO
                }
              }
            : s
        )
      };
    });

    await persistTripBuses(updatedBuses);
    setSelectedSeatId(null);
  };

  const handleClearSeat = async (seatId) => {
    if (!canEditTrips) return alert('🔒 غير مصرح لك بتفريغ المقعد.');
    if (!activeBus) return;
    const updatedBuses = currentEditableBuses.map((bus, bIdx) => {
      if (bIdx !== activeBusIdx) return bus;
      return {
        ...bus,
        seats: bus.seats.map(s => (s.id === seatId ? { ...s, occupant: null } : s))
      };
    });
    await persistTripBuses(updatedBuses);
    if (selectedSeatId === seatId) setSelectedSeatId(null);
  };

  const handleAddBusToTrip = async () => {
    if (!canEditTrips) return alert('🔒 غير مصرح لك بإضافة أتوبيس.');
    const nextNum = currentEditableBuses.length + 1;
    const updated = [...currentEditableBuses, createNewBus(nextNum, `الأتوبيس رقم ${nextNum}`)];
    await persistTripBuses(updated);
    setActiveBusIdx(updated.length - 1);
    setSelectedSeatId(null);
  };

  const handleUpdateBusMeta = async (field, value) => {
    if (!canEditTrips) return;
    const updated = currentEditableBuses.map((b, idx) =>
      idx === activeBusIdx ? { ...b, [field]: value } : b
    );
    await persistTripBuses(updated);
  };

  const persistTripRooms = async (tripId, updatedRooms) => {
    if (!canEditTrips) return alert('🔒 غير مصرح لك بتعديل الغرف.');
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
    if (!viewRoomsTrip || !canEditTrips) return;
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
    if (data) setTrips(trips.map(x => (x.id === t.id ? data : x)));
  };

  const deleteTrip = async (t) => {
    if (!canDeleteTrips) return alert('🔒 غير مصرح لك بحذف الرحلات.');
    if (!confirm(`حذف رحلة "${t.title}" نهائياً؟`)) return;
    const { error } = await supabase.from('church_trips').delete().eq('id', t.id);
    if (!error) setTrips(trips.filter(x => x.id !== t.id));
  };

  const deleteRegistration = async (regId) => {
    if (!canEditTrips && !canDeleteTrips) return alert('🔒 غير مصرح لك بإدارة الاشتراكات.');
    if (!confirm('حذف طلب الاشتراك؟')) return;
    const { error } = await supabase.from('trip_registrations').delete().eq('id', regId);
    if (!error) setRegistrations(registrations.filter(r => r.id !== regId));
  };

  const openAddScreen = (defaultCategory = 'منتظمة') => {
    if (!canAddTrips) return alert('🔒 غير مصرح لك بإضافة رحلات جديدة.');
    setEditingId(null);
    const defaultMode = defaultCategory === 'مبيت' ? 'overnight' : 'day_use';
    setStayMode(defaultMode);
    setForm({
      ...emptyForm,
      trip_category: defaultCategory,
      origin_mode: 'general_office',
      target_service: 'مكتب الرحلات العام',
      days_count: defaultMode === 'overnight' ? 2 : 1,
      bus_seats: [createNewBus(1, 'الأتوبيس الأول')]
    });
    setActiveCard('add');
  };

  const openEditTrip = (t) => {
    if (!canEditTrips) return alert('🔒 غير مصرح لك بتعديل بيانات الرحلات.');
    setEditingId(t.id);
    const isOvernight = Number(t.days_count || 1) > 1 || (Array.isArray(t.rooms) && t.rooms.length > 0);
    setStayMode(isOvernight ? 'overnight' : 'day_use');
    const isGeneral =
      t.origin_mode === 'general_office' ||
      (!t.target_service || t.target_service === 'مكتب الرحلات العام');
    setForm({
      ...emptyForm,
      ...t,
      origin_mode: isGeneral ? 'general_office' : 'service',
      target_service: isGeneral ? 'مكتب الرحلات العام' : (t.target_service || ''),
      bus_seats: normalizeBuses(t.bus_seats),
      rooms: Array.isArray(t.rooms) ? t.rooms : []
    });
    setActiveCard('add');
  };

  const renderBusDiagramPanel = () => {
    const buses = currentEditableBuses;
    const finSummary = buildBusFinancialSummary(buses, currentTripCost);
    const leftSeats = (activeBus?.seats || []).filter(s => s.side === 'left');
    const rightSeats = (activeBus?.seats || []).filter(s => s.side === 'right');
    const rows = Array.from({ length: DEFAULT_SEAT_ROWS }, (_, i) => i + 1);

    const getSeatStyle = (seat) => {
      const isSelected = seat.id === selectedSeatId;
      if (!seat.occupant) {
        return isSelected
          ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300'
          : 'bg-white hover:bg-emerald-50 text-gray-800 border-gray-300';
      }
      const info = getSeatFinancialInfo(seat, currentTripCost);
      if (info.status === 'paid_all') {
        return `bg-emerald-600 text-white border-emerald-700 ${isSelected ? 'ring-2 ring-amber-300' : ''}`;
      }
      if (info.status === 'no_due_exempt') {
        return `bg-sky-600 text-white border-sky-700 ${isSelected ? 'ring-2 ring-amber-300' : ''}`;
      }
      return `bg-rose-600 text-white border-rose-700 ${isSelected ? 'ring-2 ring-amber-300' : ''}`;
    };

    return (
      <div className="bg-[#fbfaf7] p-4 rounded-3xl border-2 border-gray-200 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {buses.map((b, idx) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setActiveBusIdx(idx);
                  setSelectedSeatId(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer transition ${
                  idx === activeBusIdx
                    ? 'bg-[#7a1c24] text-white shadow-xs'
                    : 'bg-white border text-gray-800 hover:bg-gray-100'
                }`}
              >
                🚌 {b.name}
              </button>
            ))}
            {canEditTrips && (
              <button
                type="button"
                onClick={handleAddBusToTrip}
                className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl text-xs font-black cursor-pointer"
              >
                + إضافة أتوبيس
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px] font-black">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900">دفع كل حاجة: {finSummary.paidAllCount}</span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900">عليه فلوس: {finSummary.hasDueCount}</span>
            <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-900">معاهوش / معفى: {finSummary.exemptCount}</span>
            <span className="px-2.5 py-1 rounded-lg bg-gray-900 text-white">محصل: {finSummary.totalPaid} ج.م</span>
            {finSummary.totalRemaining > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-700 text-white">متبقي: {finSummary.totalRemaining} ج.م</span>
            )}
          </div>
        </div>

        {/* بيانات الأتوبيس والمشرف */}
        <div className="grid sm:grid-cols-3 gap-2.5 bg-white p-3 rounded-2xl border">
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">اسم الأتوبيس</label>
            <input
              disabled={!canEditTrips}
              className="w-full p-2 border rounded-xl bg-[#fbfaf7] font-bold disabled:bg-gray-100"
              value={activeBus?.name || ''}
              onChange={e => handleUpdateBusMeta('name', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">اسم المشرف على الأتوبيس</label>
            <input
              disabled={!canEditTrips}
              placeholder="مثال: أ / مينا جورج"
              className="w-full p-2 border rounded-xl bg-[#fbfaf7] font-bold disabled:bg-gray-100"
              value={activeBus?.supervisor_name || ''}
              onChange={e => handleUpdateBusMeta('supervisor_name', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">موبايل المشرف</label>
            <input
              disabled={!canEditTrips}
              placeholder="01xxxxxxxxx"
              className="w-full p-2 border rounded-xl bg-[#fbfaf7] font-bold disabled:bg-gray-100"
              value={activeBus?.supervisor_phone || ''}
              onChange={e => handleUpdateBusMeta('supervisor_phone', e.target.value)}
            />
          </div>
        </div>

        {/* رسمة الأتوبيس + لوحة حجز المقعد والحالة المالية */}
        <div className="grid lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-7 bg-white p-4 rounded-3xl border-2 border-slate-300 space-y-3">
            <div className="flex justify-between items-center bg-slate-900 text-white px-4 py-2 rounded-2xl text-xs font-black">
              <span>🧑‍✈️ السائق / مقدمة الأتوبيس</span>
              <span>باب الأتوبيس 🚪</span>
            </div>

            <div className="flex flex-wrap gap-2 text-[10px] font-black justify-center">
              <span className="px-2 py-0.5 rounded border bg-white text-gray-800">متاح</span>
              <span className="px-2 py-0.5 rounded bg-emerald-600 text-white">دفع كل حاجة</span>
              <span className="px-2 py-0.5 rounded bg-rose-600 text-white">عليه فلوس</span>
              <span className="px-2 py-0.5 rounded bg-sky-600 text-white">معاهوش / معفى</span>
            </div>

            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {rows.map(rowNum => {
                const rowLeft = leftSeats.filter(s => s.row === rowNum);
                const rowRight = rightSeats.filter(s => s.row === rowNum);
                return (
                  <div key={rowNum} className="grid grid-cols-9 gap-1.5 items-center">
                    <div className="col-span-4 grid grid-cols-2 gap-1.5">
                      {rowLeft.map(seat => {
                        const info = getSeatFinancialInfo(seat, currentTripCost);
                        return (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => handleSelectSeat(seat)}
                            className={`p-1.5 rounded-xl border text-right transition cursor-pointer ${getSeatStyle(seat)}`}
                          >
                            <div className="flex justify-between items-center text-[10px] font-black">
                              <span>{seat.code}</span>
                              {seat.occupant && <span>{info.status === 'paid_all' ? '✓' : info.status === 'no_due_exempt' ? '🕊️' : '£'}</span>}
                            </div>
                            <div className="text-[10px] truncate font-bold mt-0.5">
                              {seat.occupant ? seat.occupant.passenger_name : 'فارغ'}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="col-span-1 text-center text-[10px] font-black text-gray-400">
                      {rowNum}
                    </div>

                    <div className="col-span-4 grid grid-cols-2 gap-1.5">
                      {rowRight.map(seat => {
                        const info = getSeatFinancialInfo(seat, currentTripCost);
                        return (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => handleSelectSeat(seat)}
                            className={`p-1.5 rounded-xl border text-right transition cursor-pointer ${getSeatStyle(seat)}`}
                          >
                            <div className="flex justify-between items-center text-[10px] font-black">
                              <span>{seat.code}</span>
                              {seat.occupant && <span>{info.status === 'paid_all' ? '✓' : info.status === 'no_due_exempt' ? '🕊️' : '£'}</span>}
                            </div>
                            <div className="text-[10px] truncate font-bold mt-0.5">
                              {seat.occupant ? seat.occupant.passenger_name : 'فارغ'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* لوحة تفاصيل المقعد والحالة المالية */}
          <div className="lg:col-span-5 bg-white p-4 rounded-3xl border space-y-3">
            <strong className="text-xs font-black text-[#7a1c24] flex items-center gap-1.5">
              <Wallet size={15} /> حجز المقعد والحالة المالية
            </strong>

            {!selectedSeatId ? (
              <p className="text-xs text-gray-500 py-8 text-center bg-[#fbfaf7] rounded-2xl border border-dashed">
                اختر أي مقعد من رسمة الأتوبيس لتسجيل الراكب وتحديد حالته المالية.
              </p>
            ) : (
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 font-black">
                  <span>المقعد: {activeBus?.seats.find(s => s.id === selectedSeatId)?.code}</span>
                  <span>تكلفة الفرد: {currentTripCost} ج.م</span>
                </div>

                {users.length > 0 && (
                  <select
                    disabled={!canEditTrips}
                    className="w-full p-2 border rounded-xl bg-[#fbfaf7] font-bold"
                    value={seatDraft.user_id}
                    onChange={e => handlePickUserForSeat(e.target.value)}
                  >
                    <option value="">-- اختيار من أعضاء الكنيسة (اختياري) --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} {u.phone ? `(${u.phone})` : ''}
                      </option>
                    ))}
                  </select>
                )}

                <input
                  disabled={!canEditTrips}
                  placeholder="اسم الراكب *"
                  className="w-full p-2 border rounded-xl font-bold"
                  value={seatDraft.passenger_name}
                  onChange={e => setSeatDraft({ ...seatDraft, passenger_name: e.target.value })}
                />

                <input
                  disabled={!canEditTrips}
                  placeholder="رقم الموبايل"
                  className="w-full p-2 border rounded-xl font-bold"
                  value={seatDraft.passenger_phone}
                  onChange={e => setSeatDraft({ ...seatDraft, passenger_phone: e.target.value })}
                />

                <div className="space-y-1">
                  <label className="block text-[11px] text-gray-600 font-bold">الحالة المالية للراكب:</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {PAYMENT_STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!canEditTrips}
                        onClick={() =>
                          setSeatDraft(prev => ({
                            ...prev,
                            payment_status: opt.id,
                            paid_amount: opt.id === 'paid_all' ? currentTripCost : opt.id === 'no_due_exempt' ? 0 : prev.paid_amount
                          }))
                        }
                        className={`p-2 rounded-xl border text-right font-black cursor-pointer transition ${
                          seatDraft.payment_status === opt.id ? opt.tone + ' ring-2 ring-offset-1' : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {seatDraft.payment_status === 'has_due' && (
                  <div>
                    <label className="block text-[11px] text-gray-600 font-bold mb-1">المدفوع حتى الآن (ج.م)</label>
                    <input
                      type="number"
                      min="0"
                      disabled={!canEditTrips}
                      className="w-full p-2 border rounded-xl font-bold"
                      value={seatDraft.paid_amount}
                      onChange={e => setSeatDraft({ ...seatDraft, paid_amount: e.target.value })}
                    />
                    <p className="text-[11px] text-rose-700 font-black mt-1">
                      المتبقي عليه: {Math.max(0, currentTripCost - Number(seatDraft.paid_amount || 0))} ج.م
                    </p>
                  </div>
                )}

                <input
                  disabled={!canEditTrips}
                  placeholder="ملاحظات على الراكب أو الدفع..."
                  className="w-full p-2 border rounded-xl"
                  value={seatDraft.notes}
                  onChange={e => setSeatDraft({ ...seatDraft, notes: e.target.value })}
                />

                {canEditTrips && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveSeatBooking}
                      className="flex-1 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer"
                    >
                      حفظ المقعد
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClearSeat(selectedSeatId)}
                      className="px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-black cursor-pointer"
                    >
                      تفريغ
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTopBack = (title) => (
    <div className="bg-white p-4 rounded-2xl border shadow-2xs flex flex-wrap justify-between items-center gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveCard('hub')}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowRight size={15} /> رجوع لكروت الرحلات
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
  // HUB: الكروت الرئيسية للرحلات
  // ==============================================================
  if (activeCard === 'hub') {
    const generalCount = trips.filter(t => getTripOriginBadge(t).isGeneral).length;
    const serviceCount = trips.length - generalCount;

    return (
      <div className="space-y-4 text-xs md:text-sm" dir="rtl">
        <div className="bg-linear-to-r from-[#5c1319] to-[#7a1c24] text-white p-6 rounded-3xl shadow flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-xl font-black text-amber-200 flex items-center gap-2">
              <Bus size={24} /> نظام الرحلات والأتوبيسات والحسابات
            </h2>
            <p className="text-xs md:text-sm text-white/85 mt-1">
              رحلات طالعة من مكتب الرحلات العام أو من خدمات الكنيسة — مع رسمة الباص، المشرف، والحالة المالية
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {!canAddTrips && (
              <span className="px-3 py-1.5 bg-black/30 border border-amber-300/40 rounded-xl text-xs font-bold text-amber-200 flex items-center gap-1.5">
                <ShieldAlert size={14} /> وضع الاستعراض (مشاهدة فقط)
              </span>
            )}
            <span className="px-3.5 py-2 bg-amber-300 text-[#4a0e13] rounded-2xl text-xs font-black">
              🏢 مكتب عام: {generalCount}
            </span>
            <span className="px-3.5 py-2 bg-indigo-200 text-indigo-950 rounded-2xl text-xs font-black">
              ⛪ خدمات: {serviceCount}
            </span>
            <span className="px-3.5 py-2 bg-white/15 rounded-2xl text-xs font-black">
              الرحلات: {trips.length}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <p className="text-xs text-gray-700 mt-1">حدد المصدر (مكتب الرحلات العام أو خدمة معينة) والأتوبيسات والمقاعد والحسابات</p>
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
        {renderTopBack(editingId ? '✏️ تعديل الرحلة' : '➕ إضافة رحلة جديدة')}

        <form onSubmit={handleSave} className="bg-white p-5 rounded-3xl border shadow-sm space-y-4 font-bold">
          {/* مصدر الرحلة: مكتب الرحلات العام ولا خدمة معينة */}
          <div className="bg-[#fbfaf7] p-4 rounded-2xl border-2 border-amber-200 space-y-3">
            <strong className="text-xs font-black text-[#7a1c24] flex items-center gap-1.5">
              <Building2 size={15} /> مصدر الرحلة (الرحلة طالعة من فين؟)
            </strong>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SOURCE_MODES.map(sm => {
                const active = form.origin_mode === sm.id;
                return (
                  <button
                    key={sm.id}
                    type="button"
                    onClick={() =>
                      setForm(prev => ({
                        ...prev,
                        origin_mode: sm.id,
                        target_service: sm.id === 'general_office' ? 'مكتب الرحلات العام' : (prev.target_service === 'مكتب الرحلات العام' ? '' : prev.target_service)
                      }))
                    }
                    className={`p-3 rounded-2xl border-2 text-right font-black cursor-pointer transition ${
                      active ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-gray-800 border-gray-200'
                    }`}
                  >
                    {sm.label}
                  </button>
                );
              })}
            </div>

            {form.origin_mode === 'service' && (
              <div>
                <label className="block text-xs text-gray-700 mb-1">اسم الخدمة التابعة لها الرحلة *</label>
                <input
                  required
                  placeholder="مثال: خدمة الشباب / خدمة الأسرة / خدمة ابتدائي / خدمة إعدادي..."
                  className="w-full p-2.5 border rounded-xl bg-white"
                  value={form.target_service}
                  onChange={e => setForm({ ...form, target_service: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* نوع المدة */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleSelectStayMode('day_use')}
              className={`p-3.5 rounded-2xl border-2 text-right flex items-center gap-3 cursor-pointer transition ${
                stayMode === 'day_use' ? 'bg-amber-50 border-amber-500 text-amber-950' : 'bg-gray-50 border-gray-200 text-gray-700'
              }`}
            >
              <Sun size={22} className="text-amber-600 shrink-0" />
              <div>
                <strong className="block text-sm">رحلة يوم واحد / داي يوز</strong>
                <span className="text-[11px] font-normal">ذهاب وعودة في نفس اليوم</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleSelectStayMode('overnight')}
              className={`p-3.5 rounded-2xl border-2 text-right flex items-center gap-3 cursor-pointer transition ${
                stayMode === 'overnight' ? 'bg-indigo-50 border-indigo-600 text-indigo-950' : 'bg-gray-50 border-gray-200 text-gray-700'
              }`}
            >
              <Moon size={22} className="text-indigo-700 shrink-0" />
              <div>
                <strong className="block text-sm">رحلة بمبيت + حجز أوض</strong>
                <span className="text-[11px] font-normal">أكثر من يوم مع تسكين الغرف</span>
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
              <input
                required
                placeholder="مثال: رحلة دير الأنبا بيشوي / مصيف..."
                className="w-full p-2.5 border rounded-xl"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">تاريخ الرحلة *</label>
              <input
                required
                type="date"
                className="w-full p-2.5 border rounded-xl"
                value={form.trip_date || ''}
                onChange={e => setForm({ ...form, trip_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-2.5">
            <div>
              <label className="block text-xs text-gray-600 mb-1">{isOvernight ? 'عدد الأيام' : 'المدة'}</label>
              {isOvernight ? (
                <input
                  type="number"
                  min="2"
                  className="w-full p-2.5 border rounded-xl"
                  value={form.days_count}
                  onChange={e => setForm({ ...form, days_count: e.target.value })}
                />
              ) : (
                <div className="p-2.5 border rounded-xl bg-amber-50 text-amber-950 text-xs font-black text-center">
                  ☀️ يوم واحد
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">التكلفة للفرد (ج.م)</label>
              <input
                type="number"
                min="0"
                className="w-full p-2.5 border rounded-xl"
                value={form.cost_per_person || ''}
                onChange={e => setForm({ ...form, cost_per_person: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">ميعاد التجمع</label>
              <input
                placeholder="5:30 ص"
                className="w-full p-2.5 border rounded-xl"
                value={form.gathering_time}
                onChange={e => setForm({ ...form, gathering_time: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">ميعاد التحرك</label>
              <input
                placeholder="6:00 ص"
                className="w-full p-2.5 border rounded-xl"
                value={form.departure_time}
                onChange={e => setForm({ ...form, departure_time: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">ميعاد العودة</label>
              <input
                placeholder="8:00 م"
                className="w-full p-2.5 border rounded-xl"
                value={form.return_time}
                onChange={e => setForm({ ...form, return_time: e.target.value })}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs text-gray-700">⛪ الأماكن / الأديرة / المزارات:</label>
              <textarea
                rows="3"
                className="w-full p-2.5 border rounded-xl font-normal"
                value={form.monasteries}
                onChange={e => setForm({ ...form, monasteries: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-[#7a1c24]">📋 برنامج الرحلة:</label>
                <button
                  type="button"
                  onClick={generateProgramTemplate}
                  className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-lg text-[11px] font-black cursor-pointer inline-flex items-center gap-1"
                >
                  <Sparkles size={12} /> توليد قالب البرنامج
                </button>
              </div>
              <textarea
                rows="3"
                className="w-full p-2.5 border rounded-xl font-normal"
                value={form.daily_program}
                onChange={e => setForm({ ...form, daily_program: e.target.value })}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-2.5">
            <input
              placeholder="أسماء المشرفين العامين على الرحلة"
              className="p-2.5 border rounded-xl"
              value={form.supervisors}
              onChange={e => setForm({ ...form, supervisors: e.target.value })}
            />
            <input
              placeholder="ملاحظات إضافية..."
              className="p-2.5 border rounded-xl font-normal"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {isOvernight && (
            <div className="p-4 rounded-2xl border-2 bg-blue-50/50 border-blue-200 space-y-3">
              <strong className="text-sm text-[#7a1c24] flex items-center gap-1.5">
                <BedDouble size={18} /> حجوزات الأوض / الغرف ({form.rooms?.length || 0} أوضة)
              </strong>
              <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-2">
                <input
                  placeholder="رقم/اسم الأوضة"
                  className="p-2 border rounded-xl bg-white"
                  value={newRoomForm.room_number}
                  onChange={e => setNewRoomForm({ ...newRoomForm, room_number: e.target.value })}
                />
                <select
                  className="p-2 border rounded-xl bg-white"
                  value={newRoomForm.ac_type}
                  onChange={e => setNewRoomForm({ ...newRoomForm, ac_type: e.target.value })}
                >
                  <option value="مكيفة ❄️">مكيفة ❄️</option>
                  <option value="مروحة 🌀">مروحة 🌀</option>
                  <option value="عادي بدون تكييف">عادي بدون تكييف</option>
                </select>
                <input
                  type="number"
                  min="1"
                  placeholder="السعة"
                  className="p-2 border rounded-xl bg-white"
                  value={newRoomForm.capacity}
                  onChange={e => setNewRoomForm({ ...newRoomForm, capacity: e.target.value })}
                />
                <input
                  placeholder="الدور / ملاحظات"
                  className="p-2 border rounded-xl bg-white"
                  value={newRoomForm.floor_notes}
                  onChange={e => setNewRoomForm({ ...newRoomForm, floor_notes: e.target.value })}
                />
                <button
                  type="button"
                  onClick={handleAddRoom}
                  className="px-3 py-2 bg-blue-700 text-white rounded-xl font-black cursor-pointer"
                >
                  + إضافة أوضة
                </button>
              </div>
              {(form.rooms || []).length > 0 && (
                <div className="grid sm:grid-cols-2 gap-2">
                  {form.rooms.map(rm => (
                    <div key={rm.id} className="bg-white p-2.5 rounded-xl border flex justify-between items-center text-xs">
                      <div>
                        <strong>🚪 {rm.room_number}</strong> • <span className="text-blue-800">{rm.ac_type}</span> • <span>سعة {rm.capacity} أفراد</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteRoom(rm.id)}
                        className="p-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {renderBusDiagramPanel()}

          <div className="flex flex-wrap justify-between items-center gap-3 pt-1">
            <label className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={e => setForm({ ...form, is_public: e.target.checked })}
              />
              <span>{form.is_public ? '📢 ظاهرة في صفحة الكنيسة' : '🔒 مخفية عن العامة'}</span>
            </label>
            <button
              type="submit"
              className="px-6 py-3 bg-[#7a1c24] text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
            >
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
      <div className={printPayload ? 'print:hidden space-y-4' : 'space-y-4'}>
        {renderTopBack(`${catMeta?.icon || '🚌'} ${catMeta?.title || activeCard} (${catTrips.length})`)}

        {catTrips.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl border text-center text-gray-500">
            لا توجد رحلات مضافة في قسم "{catMeta?.title}" حتى الآن.
          </div>
        ) : (
          <div className="grid gap-3">
            {catTrips.map(t => {
              const busesList = normalizeBuses(t.bus_seats);
              const totalSeats = busesList.reduce((acc, b) => acc + (b.seats || []).length, 0);
              const fin = buildBusFinancialSummary(busesList, t.cost_per_person);
              const originBadge = getTripOriginBadge(t);
              const roomsList = Array.isArray(t.rooms) ? t.rooms : [];
              const tripRegs = registrations.filter(r => r.trip_id === t.id);
              const isOvernight = Number(t.days_count || 1) > 1 || roomsList.length > 0;

              return (
                <div key={t.id} className="bg-white p-5 rounded-3xl border space-y-2.5 shadow-2xs">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div className="space-y-1.5 flex-1 min-w-[260px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded border text-xs font-black ${originBadge.className}`}>
                          {originBadge.label}
                        </span>
                        <span className="px-2.5 py-0.5 bg-purple-100 text-purple-950 rounded text-xs font-black">
                          {catMeta?.icon} {t.trip_category}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded text-xs font-black ${isOvernight ? 'bg-indigo-100 text-indigo-950' : 'bg-amber-100 text-amber-950'}`}>
                          {isOvernight ? `🌙 مبيت (${t.days_count} أيام)` : '☀️ يوم واحد'}
                        </span>
                        <strong className="text-base md:text-lg text-gray-900">{t.title}</strong>
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded text-xs font-black">
                          💰 {t.cost_per_person || 0} ج.م
                        </span>
                      </div>

                      <p className="text-xs text-gray-600">
                        📅 {t.trip_date || '—'}
                        {t.gathering_time && ` • تجمع: ${t.gathering_time}`}
                        {t.departure_time && ` • تحرك: ${t.departure_time}`}
                        {t.return_time && ` • عودة: ${t.return_time}`}
                        {t.supervisors && ` • مشرفون: ${t.supervisors}`}
                      </p>

                      {t.monasteries && (
                        <p className="text-xs text-gray-800">
                          ⛪ <strong>الأماكن والمزارات:</strong> {t.monasteries}
                        </p>
                      )}

                      {t.daily_program && (
                        <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-2xl text-xs text-gray-800 whitespace-pre-line">
                          <strong className="block text-[#7a1c24] mb-1">📋 برنامج الرحلة:</strong>
                          {t.daily_program}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1 text-xs font-black">
                        <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800">
                          دفع كل حاجة: {fin.paidAllCount} • محصل: {fin.totalPaid} ج.م
                        </span>
                        <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
                          عليه فلوس: {fin.hasDueCount} • متبقي: {fin.totalRemaining} ج.م
                        </span>
                        <span className="px-2.5 py-1 bg-sky-50 border border-sky-200 rounded-lg text-sky-800">
                          معاهوش / معفى: {fin.exemptCount}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewRegsTrip(t)}
                        className="px-3.5 py-2 bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-xs"
                      >
                        <Users size={16} /> المشتركين ({tripRegs.length})
                      </button>
                      {isOvernight && (
                        <button
                          type="button"
                          onClick={() => setViewRoomsTrip(t)}
                          className="px-3.5 py-2 bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-xs"
                        >
                          <BedDouble size={16} /> الأوض ({roomsList.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setViewBusTrip(t);
                          setActiveBusIdx(0);
                          setSelectedSeatId(null);
                        }}
                        className="px-3.5 py-2 bg-amber-500 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-xs"
                      >
                        <Bus size={16} /> الأتوبيسات ({fin.bookedCount}/{totalSeats})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintPayload({ trip: t, buses: busesList })}
                        className="px-3.5 py-2 bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer text-xs"
                      >
                        <Printer size={16} /> طباعة
                      </button>

                      {canEditTrips && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditTrip(t)}
                            className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePublic(t)}
                            className="p-2.5 bg-blue-50 rounded-xl cursor-pointer"
                            title={t.is_public ? 'ظاهرة للعامة' : 'مخفية'}
                          >
                            {t.is_public ? <Globe size={15} /> : <Lock size={15} />}
                          </button>
                        </>
                      )}
                      {canDeleteTrips && (
                        <button
                          type="button"
                          onClick={() => deleteTrip(t)}
                          className="p-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl cursor-pointer"
                          title="حذف"
                        >
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

        {/* مودال المشتركين */}
        {viewRegsTrip && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl w-full max-w-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="text-base font-black text-[#7a1c24]">✋ المشتركين — {viewRegsTrip.title}</h3>
                  <p className="text-xs text-gray-500">المصدر: {getTripOriginBadge(viewRegsTrip).label}</p>
                </div>
                <button type="button" onClick={() => setViewRegsTrip(null)} className="p-2 bg-gray-100 rounded-xl cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              {registrations.filter(r => r.trip_id === viewRegsTrip.id).length === 0 ? (
                <p className="text-center text-gray-500 py-6">لا توجد اشتراكات لهذه الرحلة بعد.</p>
              ) : (
                <div className="space-y-2">
                  {registrations.filter(r => r.trip_id === viewRegsTrip.id).map(r => (
                    <div key={r.id} className="p-3 bg-[#fbfaf7] border rounded-2xl flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <strong className="text-sm text-gray-900 block">{r.user_name}</strong>
                        <span className="text-xs text-gray-600">
                          💺 الأفراد: <strong>{r.seats_count}</strong>
                          {r.user_phone && ` • 📞 ${r.user_phone}`}
                          {r.notes && ` • 📝 ${r.notes}`}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        {r.user_phone && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenWhatsApp({ name: r.user_name, phone: r.user_phone })}
                              className="p-2 bg-green-600 text-white rounded-xl cursor-pointer"
                            >
                              <MessageCircle size={14} />
                            </button>
                            <a href={`tel:${r.user_phone}`} className="p-2 bg-gray-100 text-gray-800 rounded-xl">
                              <Phone size={14} />
                            </a>
                          </>
                        )}
                        {canDeleteTrips && (
                          <button
                            type="button"
                            onClick={() => deleteRegistration(r.id)}
                            className="p-2 bg-red-50 text-red-700 rounded-xl cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* مودال الأتوبيسات والمقاعد والحالة المالية */}
        {viewBusTrip && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white rounded-3xl w-full max-w-4xl p-5 space-y-3 max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="text-lg font-black text-[#7a1c24]">🚌 الأتوبيسات والمقاعد — {viewBusTrip.title}</h3>
                  <p className="text-xs text-gray-600">
                    المصدر: <strong>{getTripOriginBadge(viewBusTrip).label}</strong> • التاريخ: {viewBusTrip.trip_date || '—'} • التكلفة: {viewBusTrip.cost_per_person || 0} ج.م
                  </p>
                </div>
                <button type="button" onClick={() => setViewBusTrip(null)} className="p-2 bg-gray-100 rounded-xl cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              {renderBusDiagramPanel()}
            </div>
          </div>
        )}

        {/* مودال إدارة الأوض */}
        {viewRoomsTrip && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl w-full max-w-3xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="text-lg font-black text-[#7a1c24] flex items-center gap-2">
                    <BedDouble size={20} /> حجز الأوض والغرف — {viewRoomsTrip.title}
                  </h3>
                  <p className="text-xs text-gray-600">المصدر: {getTripOriginBadge(viewRoomsTrip).label}</p>
                </div>
                <button type="button" onClick={() => setViewRoomsTrip(null)} className="p-2 bg-gray-100 rounded-xl cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {canEditTrips && (
                <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200 space-y-2.5 font-bold">
                  <span className="text-xs text-blue-950 block">+ إضافة أوضة جديدة:</span>
                  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2">
                    <input
                      placeholder="رقم/اسم الأوضة *"
                      className="p-2 border rounded-xl bg-white"
                      value={newRoomForm.room_number}
                      onChange={e => setNewRoomForm({ ...newRoomForm, room_number: e.target.value })}
                    />
                    <select
                      className="p-2 border rounded-xl bg-white"
                      value={newRoomForm.ac_type}
                      onChange={e => setNewRoomForm({ ...newRoomForm, ac_type: e.target.value })}
                    >
                      <option value="مكيفة ❄️">مكيفة ❄️</option>
                      <option value="مروحة 🌀">مروحة 🌀</option>
                      <option value="عادي بدون تكييف">عادي بدون تكييف</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      placeholder="السعة"
                      className="p-2 border rounded-xl bg-white"
                      value={newRoomForm.capacity}
                      onChange={e => setNewRoomForm({ ...newRoomForm, capacity: e.target.value })}
                    />
                    <input
                      placeholder="الدور / ملاحظات"
                      className="p-2 border rounded-xl bg-white"
                      value={newRoomForm.floor_notes}
                      onChange={e => setNewRoomForm({ ...newRoomForm, floor_notes: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      placeholder="أسماء النزلاء..."
                      className="flex-1 p-2 border rounded-xl bg-white font-normal"
                      value={newRoomForm.occupants_text}
                      onChange={e => setNewRoomForm({ ...newRoomForm, occupants_text: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={handleAddRoom}
                      className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer"
                    >
                      + إضافة
                    </button>
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
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-bold flex items-center gap-1">
                              <Wind size={11} /> {rm.ac_type}
                            </span>
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-950 rounded font-bold">
                              👥 {rm.capacity} أفراد
                            </span>
                          </div>
                        </div>
                        {canEditTrips && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRoom(rm.id)}
                            className="p-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <textarea
                        rows="2"
                        placeholder="أسماء النزلاء..."
                        className="w-full p-2 border rounded-xl bg-white text-xs disabled:bg-gray-100"
                        disabled={!canEditTrips}
                        defaultValue={rm.occupants_text || ''}
                        onBlur={e => handleUpdateRoomOccupants(rm.id, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* الكود الثاني: شاشة ومعاينة طباعة الأتوبيس والحالة المالية والمصدر */}
      <BusTripPrintSheet
        printPayload={printPayload}
        setPrintPayload={setPrintPayload}
        currentUser={currentUser}
        todayISO={todayISO}
      />
    </div>
  );
}
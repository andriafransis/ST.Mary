import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLogger';
import { Bus, Plus, Printer, Trash2, Phone, MessageCircle, X, Building2 } from 'lucide-react';

export const PAYMENT_METHODS = ['كاش', 'محفظة إلكترونية', 'إنستاباي', 'تحويل بنكي'];

export const TRIP_SOURCE_TYPES = [
  { id: 'general_office', label: 'مكتب الرحلات العام', badge: '🏢 مكتب الرحلات العام' },
  { id: 'church_service', label: 'خدمة من خدمات الكنيسة', badge: '⛪ خدمة:' }
];

export const getTripSourceInfo = (tripObj = {}) => {
  const rawService = (tripObj?.target_service || '').trim();
  const isGeneral =
    tripObj?.source_type === 'general_office' ||
    !rawService ||
    rawService === 'مكتب الرحلات العام';

  if (isGeneral) {
    return {
      isGeneral: true,
      sourceType: 'general_office',
      serviceName: 'مكتب الرحلات العام',
      label: '🏢 مكتب الرحلات العام',
      shortLabel: 'مكتب الرحلات العام'
    };
  }

  return {
    isGeneral: false,
    sourceType: 'church_service',
    serviceName: rawService,
    label: `⛪ خدمة: ${rawService}`,
    shortLabel: rawService
  };
};

export const generateDefaultBusSeats = () => {
  const seats = [];
  let seatNum = 1;
  for (let row = 1; row <= 11; row++) {
    seats.push({ id: `S${seatNum}`, number: seatNum++, row, side: 'left', pos: 'window', occupant: '' });
    seats.push({ id: `S${seatNum}`, number: seatNum++, row, side: 'left', pos: 'aisle', occupant: '' });
    if (row === 6) {
      seats.push({ id: `DOOR_BACK`, number: null, row, side: 'right', isDoor: true, label: 'باب خلفي 🚪' });
    } else {
      seats.push({ id: `S${seatNum}`, number: seatNum++, row, side: 'right', pos: 'aisle', occupant: '' });
      seats.push({ id: `S${seatNum}`, number: seatNum++, row, side: 'right', pos: 'window', occupant: '' });
    }
  }
  for (let b = 1; b <= 5; b++) {
    seats.push({ id: `S${seatNum}`, number: seatNum++, row: 12, side: 'back', pos: `back-${b}`, occupant: '' });
  }
  return seats;
};

export const createNewBus = (index = 1, customName = '') => ({
  id: `bus_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  name: customName || (index === 1 ? 'الأتوبيس الأول' : `أتوبيس ${index}`),
  supervisor_name: '',
  seats: generateDefaultBusSeats()
});

export const normalizeBuses = (rawBusSeats) => {
  if (Array.isArray(rawBusSeats) && rawBusSeats.length > 0) {
    if (rawBusSeats[0] && Array.isArray(rawBusSeats[0].seats)) return rawBusSeats;
    return [{ id: 'bus_1', name: 'الأتوبيس الأول', supervisor_name: '', seats: rawBusSeats }];
  }
  return [createNewBus(1, 'الأتوبيس الأول')];
};

export const getSeatPositionLabel = (seat) => {
  if (seat.row === 12) return 'الكنبة الخلفية';
  const sideLabel = seat.side === 'right' ? 'يمين' : 'يسار';
  const posLabel = seat.pos === 'window' ? 'شباك' : 'ممر';
  return `صف ${seat.row} - ${sideLabel} (${posLabel})`;
};

export const getSeatFinancials = (seat, defaultCost = 0) => {
  const totalDue = seat.total_due !== undefined && seat.total_due !== null && seat.total_due !== ''
    ? Number(seat.total_due)
    : Number(defaultCost || 0);
  const payments = Array.isArray(seat.payments) ? seat.payments : [];
  const paidFromList = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const paid = payments.length > 0 ? paidFromList : Number(seat.paid_amount || 0);
  const remaining = Math.max(0, totalDue - paid);
  return { totalDue, paid, remaining, payments };
};

export const buildGroupedPeopleSummary = (buses, defaultCost, localUsers = []) => {
  const map = new Map();
  buses.forEach(bus => {
    (bus.seats || []).forEach(s => {
      if (s.isDoor || !s.occupant) return;
      const cleanPhone = (s.phone || '').replace(/\s+/g, '');
      const key = s.user_id || (cleanPhone.length >= 6 ? cleanPhone : s.occupant.trim());
      const fin = getSeatFinancials(s, defaultCost);

      const linkedUser = s.user_id
        ? localUsers.find(u => u.id === s.user_id)
        : localUsers.find(u => (cleanPhone && (u.phone || '').replace(/\s+/g, '') === cleanPhone) || u.full_name === s.occupant.trim());

      const isInside = s.is_member_in_meeting !== undefined ? s.is_member_in_meeting : Boolean(linkedUser);
      const meetingLabel = s.meeting_label || linkedUser?.detailed_stage || linkedUser?.service_stage || '';

      if (!map.has(key)) {
        map.set(key, {
          key, name: s.occupant, phone: s.phone || linkedUser?.phone || '',
          isInside, meetingLabel, seats: [],
          totalDue: 0, totalPaid: 0, totalRemaining: 0, cashPaid: 0, walletPaid: 0
        });
      }
      const entry = map.get(key);
      entry.seats.push({ busName: bus.name, seatNumber: s.number });
      entry.totalDue += fin.totalDue;
      entry.totalPaid += fin.paid;
      entry.totalRemaining += fin.remaining;
      fin.payments.forEach(p => {
        const amt = Number(p.amount || 0);
        if (p.method === 'كاش') entry.cashPaid += amt;
        else entry.walletPaid += amt;
      });
    });
  });
  return Array.from(map.values());
};

export const syncTripPaymentsTable = async (scheduleId, busesList, priestId, todayISO) => {
  if (!scheduleId) return;
  try {
    await supabase.from('trip_payments').delete().eq('schedule_id', scheduleId);
    const rows = [];
    busesList.forEach(bus => {
      (bus.seats || []).forEach(s => {
        if (s.isDoor || !s.occupant) return;
        (Array.isArray(s.payments) ? s.payments : []).forEach(p => {
          rows.push({
            schedule_id: scheduleId,
            priest_id: priestId,
            bus_id: bus.id,
            bus_name: bus.name,
            seat_number: s.number,
            passenger_name: s.occupant,
            passenger_phone: s.phone || '',
            user_id: s.user_id || null,
            amount: Number(p.amount || 0),
            payment_method: p.method || 'كاش',
            payment_date: p.date || todayISO,
            notes: p.note || ''
          });
        });
      });
    });
    if (rows.length > 0) await supabase.from('trip_payments').insert(rows);
  } catch (e) {
    console.warn('trip_payments sync skipped:', e);
  }
};

export function TripSourceSelector({ tripObj = {}, onChangeSource }) {
  const info = getTripSourceInfo(tripObj);

  const handleSelectMode = (mode) => {
    if (!onChangeSource) return;
    if (mode === 'general_office') {
      onChangeSource({
        source_type: 'general_office',
        target_service: 'مكتب الرحلات العام'
      });
    } else {
      onChangeSource({
        source_type: 'church_service',
        target_service: info.isGeneral ? '' : info.serviceName
      });
    }
  };

  const handleServiceInput = (val) => {
    if (!onChangeSource) return;
    onChangeSource({
      source_type: 'church_service',
      target_service: val
    });
  };

  return (
    <div className="bg-amber-50/70 border-2 border-amber-300 rounded-2xl p-3.5 space-y-2.5">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <strong className="text-xs md:text-sm font-black text-[#7a1c24] flex items-center gap-1.5">
          <Building2 size={16} /> مصدر الرحلة: طالعة من فين؟
        </strong>
        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${info.isGeneral ? 'bg-amber-200 text-amber-950' : 'bg-indigo-100 text-indigo-950'}`}>
          {info.label}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {TRIP_SOURCE_TYPES.map(st => {
          const active = (st.id === 'general_office') === info.isGeneral;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => handleSelectMode(st.id)}
              className={`p-2.5 rounded-xl border-2 text-right text-xs font-black cursor-pointer transition ${
                active
                  ? 'bg-[#7a1c24] text-white border-[#5c1319]'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-[#7a1c24]'
              }`}
            >
              {st.label}
            </button>
          );
        })}
      </div>

      {!info.isGeneral && (
        <div>
          <label className="block text-xs text-slate-700 font-bold mb-1">اسم الخدمة التابعة لها الرحلة:</label>
          <input
            type="text"
            placeholder="مثال: خدمة الشباب / خدمة الأسرة / خدمة إعدادي / خدمة ابتدائي..."
            className="w-full p-2 border rounded-xl bg-white text-xs md:text-sm font-bold"
            value={info.serviceName}
            onChange={e => handleServiceInput(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export function BusVisualizerSection({
  rawBusesData,
  tripCost = 0,
  isViewMode = false,
  tripObj = null,
  onChangeTripSource = null,
  localUsers = [],
  priest,
  todayISO,
  onSaveBuses,
  onLocalRenameBuses,
  onOpenPrint,
  onOpenWhatsApp
}) {
  const [busIdx, setBusIdx] = useState(0);
  const [busViewTab, setBusViewTab] = useState('map');
  const [summaryFilter, setSummaryFilter] = useState('all');
  const [selectedSeatModal, setSelectedSeatModal] = useState(null);
  const [seatForm, setSeatForm] = useState({
    occupant: '', phone: '', user_id: '', is_member_in_meeting: true,
    meeting_label: '', total_due: 0, payments: [], notes: ''
  });
  const [newPayment, setNewPayment] = useState({ amount: '', method: 'كاش', date: todayISO, note: '' });
  const [memberPickSearch, setMemberPickSearch] = useState('');

  const buses = normalizeBuses(rawBusesData);
  const activeIdx = Math.min(busIdx, buses.length - 1);
  const activeBus = buses[activeIdx] || buses[0];
  const seats = activeBus.seats || generateDefaultBusSeats();
  const sourceInfo = getTripSourceInfo(tripObj || {});

  const bookedCount = seats.filter(s => !s.isDoor && s.occupant).length;
  const totalSeats = seats.filter(s => !s.isDoor).length;
  const allBookedCount = buses.reduce((acc, b) => acc + (b.seats || []).filter(s => !s.isDoor && s.occupant).length, 0);
  const allTotalSeats = buses.reduce((acc, b) => acc + (b.seats || []).filter(s => !s.isDoor).length, 0);

  const peopleSummary = buildGroupedPeopleSummary(buses, Number(tripCost || 0), localUsers);
  const totalCollectedAll = peopleSummary.reduce((sum, p) => sum + p.totalPaid, 0);
  const totalRemainingAll = peopleSummary.reduce((sum, p) => sum + p.totalRemaining, 0);
  const totalCashAll = peopleSummary.reduce((sum, p) => sum + p.cashPaid, 0);
  const totalWalletAll = peopleSummary.reduce((sum, p) => sum + p.walletPaid, 0);

  const filteredPeopleSummary = peopleSummary.filter(p => {
    if (summaryFilter === 'owing') return p.totalRemaining > 0;
    if (summaryFilter === 'paid') return p.totalRemaining === 0;
    if (summaryFilter === 'inside') return p.isInside;
    if (summaryFilter === 'outside') return !p.isInside;
    return true;
  });

  const getPersonMultiBusSummary = () => {
    const tName = (seatForm.occupant || '').trim();
    const tPhone = (seatForm.phone || '').replace(/\s+/g, '');
    const tUserId = seatForm.user_id || '';
    if (!tName && !tUserId && !tPhone) return null;

    const matchedSeats = [];
    buses.forEach(bus => {
      (bus.seats || []).forEach(s => {
        if (s.isDoor || !s.occupant) return;
        const sPhone = (s.phone || '').replace(/\s+/g, '');
        if ((tUserId && s.user_id === tUserId) || (tPhone.length >= 6 && sPhone === tPhone) || (tName && s.occupant.trim() === tName)) {
          matchedSeats.push({ busName: bus.name, seatNumber: s.number, ...getSeatFinancials(s, tripCost) });
        }
      });
    });

    return {
      count: matchedSeats.length,
      seats: matchedSeats,
      totalDueAll: matchedSeats.reduce((sum, x) => sum + x.totalDue, 0),
      totalPaidAll: matchedSeats.reduce((sum, x) => sum + x.paid, 0),
      totalRemainingAll: matchedSeats.reduce((sum, x) => sum + x.remaining, 0)
    };
  };

  const handleSeatClick = (seat) => {
    if (seat.isDoor) return;
    const fin = getSeatFinancials(seat, tripCost);
    setSelectedSeatModal({ isSupervisor: false, seat });
    setSeatForm({
      occupant: seat.occupant || '',
      phone: seat.phone || '',
      user_id: seat.user_id || '',
      is_member_in_meeting: seat.is_member_in_meeting !== undefined ? seat.is_member_in_meeting : true,
      meeting_label: seat.meeting_label || '',
      total_due: fin.totalDue,
      payments: fin.payments,
      notes: seat.notes || ''
    });
    setNewPayment({ amount: '', method: 'كاش', date: todayISO, note: '' });
    setMemberPickSearch('');
  };

  const handleAddBus = async () => {
    const updated = [...buses, createNewBus(buses.length + 1)];
    setBusIdx(updated.length - 1);
    await onSaveBuses(updated);
    if (isViewMode && tripObj) {
      logActivity({ user: priest, actionType: 'إضافة_أتوبيس', targetTable: 'church_trips', targetId: tripObj.id, description: `أضاف أتوبيس جديد لـ: ${tripObj.title} (${sourceInfo.label})` });
    }
  };

  const handleDeleteBus = async () => {
    if (buses.length <= 1) return alert('لا يمكن حذف آخر أتوبيس.');
    const hasPassengers = activeBus.supervisor_name || activeBus.seats.some(s => !s.isDoor && s.occupant);
    if (hasPassengers && !confirm(`الأتوبيس "${activeBus.name}" به أسماء مسجلة، هل أنت متأكد من حذفه؟`)) return;
    const updated = buses.filter((_, i) => i !== activeIdx);
    setBusIdx(Math.max(0, activeIdx - 1));
    await onSaveBuses(updated);
  };

  const saveSeatAssignment = async (clearSeat = false) => {
    if (!selectedSeatModal) return;
    const { isSupervisor, seat } = selectedSeatModal;
    const updatedBuses = buses.map((b, idx) => {
      if (idx !== activeIdx) return b;
      if (isSupervisor) return { ...b, supervisor_name: clearSeat ? '' : seatForm.occupant.trim() };
      return {
        ...b,
        seats: b.seats.map(s => {
          if (s.id !== seat.id) return s;
          if (clearSeat) {
            return { id: s.id, number: s.number, row: s.row, side: s.side, pos: s.pos, occupant: '', phone: '', user_id: '', is_member_in_meeting: true, meeting_label: '', total_due: null, paid_amount: 0, payments: [], notes: '' };
          }
          const totalPaid = (seatForm.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
          return {
            ...s,
            occupant: seatForm.occupant.trim(),
            phone: seatForm.phone.trim(),
            user_id: seatForm.user_id || '',
            is_member_in_meeting: Boolean(seatForm.is_member_in_meeting),
            meeting_label: seatForm.meeting_label || '',
            total_due: Number(seatForm.total_due || 0),
            paid_amount: totalPaid,
            payments: seatForm.payments || [],
            notes: seatForm.notes || ''
          };
        })
      };
    });

    await onSaveBuses(updatedBuses);
    if (isViewMode && tripObj) {
      logActivity({
        user: priest,
        actionType: clearSeat ? 'إخلاء_مقعد_رحلة' : 'حجز_أو_دفع_مقعد',
        targetTable: 'church_trips',
        targetId: tripObj.id,
        description: isSupervisor
          ? `${clearSeat ? 'أخلى' : 'عيّن'} مشرف الأتوبيس (${seatForm.occupant}) في ${tripObj.title} (${sourceInfo.label})`
          : `${clearSeat ? 'أخلى' : 'حدّث حجز/دفع'} مقعد #${seat.number} (${seatForm.occupant}) في ${tripObj.title} (${sourceInfo.label})`
      });
    }
    setSelectedSeatModal(null);
  };

  const rows = [];
  for (let r = 1; r <= 11; r++) {
    rows.push({ rowNum: r, left: seats.filter(s => s.row === r && s.side === 'left'), right: seats.filter(s => s.row === r && s.side === 'right') });
  }
  const backBench = seats.filter(s => s.row === 12);

  const renderSeatButton = (seat) => {
    const fin = getSeatFinancials(seat, tripCost);
    let btnClass = 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-300';
    let statusBadge = 'متاح';
    if (seat.occupant) {
      if (fin.totalDue > 0 && fin.paid === 0) {
        btnClass = 'bg-red-700 hover:bg-red-800 text-white border-red-900 shadow-xs';
        statusBadge = `لم يدفع (${fin.remaining}ج)`;
      } else if (fin.remaining > 0) {
        btnClass = 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-700 shadow-xs';
        statusBadge = `باقي ${fin.remaining}ج`;
      } else {
        btnClass = 'bg-[#7a1c24] hover:bg-[#5c1319] text-white border-[#4a0e13] shadow-xs';
        statusBadge = 'خالص ✅';
      }
    }
    return (
      <button key={seat.id} type="button" onClick={() => handleSeatClick(seat)} className={`p-1.5 rounded-xl border-2 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[58px] ${btnClass}`}>
        <span className="text-xs font-black leading-none">{seat.number}</span>
        <span className="text-[11px] font-bold truncate w-full px-0.5 mt-0.5">{seat.occupant || 'متاح'}</span>
        {seat.occupant && <span className="text-[10px] font-black opacity-95 truncate w-full">{statusBadge}</span>}
      </button>
    );
  };

  const currentSeatPaid = (seatForm.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const currentSeatRemaining = Math.max(0, Number(seatForm.total_due || 0) - currentSeatPaid);
  const personMultiBus = selectedSeatModal && !selectedSeatModal.isSupervisor ? getPersonMultiBusSummary() : null;
  const filteredUsersPick = localUsers.filter(u => u.role !== 'admin' && ((u.full_name || '') + ' ' + (u.phone || '') + ' ' + (u.detailed_stage || '')).toLowerCase().includes(memberPickSearch.toLowerCase()));

  return (
    <div className="bg-slate-50 border-2 border-slate-300 rounded-3xl p-4 space-y-4">
      {onChangeTripSource && (
        <TripSourceSelector tripObj={tripObj || {}} onChangeSource={onChangeTripSource} />
      )}

      <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <Bus className="text-[#7a1c24]" size={22} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-base text-slate-900">إدارة الأتوبيسات والمقاعد والتحصيل ({buses.length} أتوبيس)</strong>
              <span className={`px-2 py-0.5 rounded text-xs font-black ${sourceInfo.isGeneral ? 'bg-amber-100 text-amber-950' : 'bg-indigo-100 text-indigo-950'}`}>
                {sourceInfo.label}
              </span>
            </div>
            <span className="text-xs md:text-sm text-slate-600">
              المحجوز: <strong>{allBookedCount}/{allTotalSeats}</strong> • المحصل: <strong className="text-emerald-700">{totalCollectedAll} ج.م</strong> • المتبقي: <strong className="text-red-700">{totalRemainingAll} ج.م</strong>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setBusViewTab(busViewTab === 'map' ? 'summary' : 'map')} className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-black cursor-pointer border-2 ${busViewTab === 'summary' ? 'bg-indigo-700 text-white border-indigo-900' : 'bg-white text-indigo-900 border-indigo-300'}`}>
            {busViewTab === 'map' ? `📊 كشف الحساب المجمع (${peopleSummary.length})` : '💺 العودة لخريطة الكراسي'}
          </button>
          <button type="button" onClick={handleAddBus} className="px-3.5 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl text-xs md:text-sm font-bold flex items-center gap-1 cursor-pointer">
            <Plus size={16} /> إضافة أتوبيس
          </button>
          {isViewMode && tripObj && onOpenPrint && (
            <>
              <button type="button" onClick={() => onOpenPrint({ trip: tripObj, buses: [activeBus] })} className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs md:text-sm font-bold flex items-center gap-1 cursor-pointer">
                <Printer size={16} /> طباعة كشف: {activeBus.name}
              </button>
              {buses.length > 1 && (
                <button type="button" onClick={() => onOpenPrint({ trip: tripObj, buses })} className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs md:text-sm font-bold flex items-center gap-1 cursor-pointer">
                  <Printer size={16} /> طباعة الكل ({buses.length})
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {busViewTab === 'summary' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-sm">
            <div className="bg-white p-3 rounded-2xl border"><span className="text-gray-500 text-xs block">إجمالي المحصل</span><strong className="text-lg text-emerald-700">{totalCollectedAll} ج.م</strong></div>
            <div className="bg-white p-3 rounded-2xl border"><span className="text-gray-500 text-xs block">💵 محصل كاش</span><strong className="text-lg text-slate-900">{totalCashAll} ج.م</strong></div>
            <div className="bg-white p-3 rounded-2xl border"><span className="text-gray-500 text-xs block">📱 محفظة / تحويل</span><strong className="text-lg text-blue-800">{totalWalletAll} ج.م</strong></div>
            <div className="bg-red-50 p-3 rounded-2xl border border-red-200"><span className="text-red-800 text-xs block font-bold">⚠️ إجمالي المتبقي</span><strong className="text-lg text-red-700">{totalRemainingAll} ج.م</strong></div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: `الكل (${peopleSummary.length})` },
              { id: 'owing', label: `⚠️ عليه باقي (${peopleSummary.filter(p => p.totalRemaining > 0).length})` },
              { id: 'paid', label: `✅ خالص (${peopleSummary.filter(p => p.totalRemaining === 0).length})` },
              { id: 'inside', label: `داخل الاجتماع (${peopleSummary.filter(p => p.isInside).length})` },
              { id: 'outside', label: `خارج الاجتماع (${peopleSummary.filter(p => !p.isInside).length})` }
            ].map(f => (
              <button key={f.id} type="button" onClick={() => setSummaryFilter(f.id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${summaryFilter === f.id ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-gray-800'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {filteredPeopleSummary.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border text-center text-sm text-gray-500">لا توجد بيانات مطابقة.</div>
          ) : (
            <div className="grid gap-2.5">
              {filteredPeopleSummary.map(p => (
                <div key={p.key} className="bg-white p-4 rounded-2xl border-2 border-gray-200 flex flex-wrap justify-between items-center gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-base text-gray-900">{p.name}</strong>
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${p.isInside ? 'bg-blue-100 text-blue-900' : 'bg-purple-100 text-purple-900'}`}>
                        {p.isInside ? `✅ داخل الاجتماع ${p.meetingLabel ? `(${p.meetingLabel})` : ''}` : '🌐 خارج الاجتماع'}
                      </span>
                      <span className="px-2.5 py-0.5 bg-amber-100 text-amber-950 rounded-lg text-xs font-black">💺 {p.seats.length} كرسي</span>
                    </div>
                    <p className="text-sm text-gray-600">📞 {p.phone || 'بدون رقم'} • الكراسي: {p.seats.map(s => `${s.busName} (#${s.seatNumber})`).join('، ')}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <div className="text-center px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-200"><span className="text-xs text-emerald-800 block">دفع</span><strong className="text-emerald-900">{p.totalPaid} ج.م</strong></div>
                    <div className={`text-center px-3 py-1.5 rounded-xl border ${p.totalRemaining > 0 ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
                      <span className={`text-xs block ${p.totalRemaining > 0 ? 'text-red-800 font-bold' : 'text-gray-500'}`}>المتبقي</span>
                      <strong className={p.totalRemaining > 0 ? 'text-red-700' : 'text-green-700'}>{p.totalRemaining > 0 ? `${p.totalRemaining} ج.م` : 'خالص ✅'}</strong>
                    </div>
                    {p.phone && onOpenWhatsApp && (
                      <>
                        <button type="button" onClick={() => onOpenWhatsApp({ name: p.name, phone: p.phone, defaultCategory: 'افتقاد' })} className="p-2.5 bg-green-600 text-white rounded-xl cursor-pointer"><MessageCircle size={16} /></button>
                        <a href={`tel:${p.phone}`} className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-800"><Phone size={16} /></a>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {buses.map((b, idx) => {
              const bBooked = (b.seats || []).filter(s => !s.isDoor && s.occupant).length;
              const bTotal = (b.seats || []).filter(s => !s.isDoor).length;
              return (
                <button key={b.id || idx} type="button" onClick={() => setBusIdx(idx)} className={`px-3.5 py-2 rounded-xl border-2 text-xs md:text-sm font-black transition cursor-pointer flex items-center gap-2 ${activeIdx === idx ? 'bg-[#7a1c24] text-white border-[#5c1319] shadow-xs' : 'bg-white text-slate-800 border-slate-200 hover:border-[#7a1c24]'}`}>
                  <span>🚌 {b.name}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${activeIdx === idx ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>{bBooked}/{bTotal}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-950 border border-emerald-300">🟢 متاح</span>
            <span className="px-2.5 py-1 rounded-lg bg-[#7a1c24] text-white">✅ محجوز وخالص</span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950">⚠️ دفع جزء وعليه باقي</span>
            <span className="px-2.5 py-1 rounded-lg bg-red-700 text-white">❌ محجوز ولم يدفع بعد</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <label className="text-sm font-black text-slate-800 whitespace-nowrap">اسم الأتوبيس:</label>
              <input
                type="text"
                className="flex-1 p-2 px-3 border rounded-xl text-sm font-bold bg-slate-50 focus:bg-white"
                value={activeBus.name}
                onChange={e => {
                  const updated = buses.map((b, i) => (i === activeIdx ? { ...b, name: e.target.value } : b));
                  onLocalRenameBuses(updated);
                }}
                onBlur={() => { if (isViewMode) onSaveBuses(buses); }}
              />
            </div>
            <div className="flex items-center gap-2 text-xs md:text-sm">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-900 rounded-lg font-bold">متاح: {totalSeats - bookedCount}</span>
              <span className="px-3 py-1 bg-red-100 text-red-900 rounded-lg font-bold">محجوز: {bookedCount} / {totalSeats}</span>
              {buses.length > 1 && (
                <button type="button" onClick={handleDeleteBus} className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg cursor-pointer"><Trash2 size={16} /></button>
              )}
            </div>
          </div>

          <div className="max-w-lg mx-auto bg-white border-4 border-slate-700 rounded-t-[44px] rounded-b-2xl p-3.5 shadow-inner space-y-2.5">
            <div className="bg-slate-100 p-3 rounded-t-3xl border-b-2 border-dashed border-slate-300 space-y-2">
              <div className="flex justify-between items-center gap-2">
                <div className="px-3 py-1.5 bg-amber-100 border border-amber-400 rounded-xl text-xs font-black text-amber-950">🚪 الباب الأمامي</div>
                <div className="px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-black">🛞 كرسي السائق</div>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedSeatModal({ isSupervisor: true }); setSeatForm({ ...seatForm, occupant: activeBus.supervisor_name || '' }); }}
                className={`w-full py-2.5 px-3 rounded-xl border-2 text-center transition cursor-pointer flex items-center justify-between gap-2 ${activeBus.supervisor_name ? 'bg-amber-500 text-white border-amber-700 shadow-xs' : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-dashed border-amber-400'}`}
              >
                <span className="text-xs md:text-sm font-black">🎖️ كرسي المشرف:</span>
                <span className="text-sm font-black truncate">{activeBus.supervisor_name || 'اضغط لتسجيل اسم مشرف الرحلة'}</span>
              </button>
            </div>

            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.rowNum} className="grid grid-cols-5 gap-1.5 items-center">
                  <div className="col-span-2 grid grid-cols-2 gap-1.5">
                    {r.right.map(seat => seat.isDoor ? (
                      <div key={seat.id} className="col-span-2 py-3 bg-amber-50 border border-dashed border-amber-400 rounded-xl text-center text-xs font-bold text-amber-800">{seat.label}</div>
                    ) : renderSeatButton(seat))}
                  </div>
                  <div className="col-span-1 text-center text-xs text-slate-400 font-bold select-none">ممر</div>
                  <div className="col-span-2 grid grid-cols-2 gap-1.5">{r.left.map(seat => renderSeatButton(seat))}</div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t-2 border-dashed border-slate-300">
              <span className="block text-center text-xs text-slate-600 font-bold mb-1.5">الكنبة الخلفية (5 مقاعد)</span>
              <div className="grid grid-cols-5 gap-1.5">{backBench.map(seat => renderSeatButton(seat))}</div>
            </div>
          </div>
        </>
      )}

      {selectedSeatModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-3xl w-full max-w-lg p-5 space-y-3.5 font-bold max-h-[92vh] overflow-y-auto text-sm">
            <div className="flex justify-between items-center border-b pb-2.5">
              <h4 className="text-base font-black text-[#7a1c24]">
                {selectedSeatModal.isSupervisor ? '🎖️ تسكين مشرف الأتوبيس' : `💺 مقعد رقم (${selectedSeatModal.seat.number})`}
              </h4>
              <button type="button" onClick={() => setSelectedSeatModal(null)} className="p-1.5 bg-gray-100 rounded-lg"><X size={16} /></button>
            </div>

            {selectedSeatModal.isSupervisor ? (
              <>
                <input autoFocus placeholder="اكتب اسم المشرف..." className="w-full p-2.5 border rounded-xl" value={seatForm.occupant} onChange={e => setSeatForm({ ...seatForm, occupant: e.target.value })} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => saveSeatAssignment(false)} className="flex-1 py-2.5 bg-[#7a1c24] text-white rounded-xl cursor-pointer">حفظ المشرف</button>
                  {seatForm.occupant && <button type="button" onClick={() => saveSeatAssignment(true)} className="px-4 py-2.5 bg-red-50 text-red-700 rounded-xl cursor-pointer">إخلاء</button>}
                </div>
              </>
            ) : (
              <>
                <div className="bg-blue-50/70 p-3 rounded-2xl border border-blue-200 space-y-2">
                  <label className="block text-xs text-blue-950 font-black">🔍 اختيار سريع من أعضاء الكنيسة / الاجتماع:</label>
                  <input type="text" placeholder="ابحث بالاسم أو التليفون..." className="w-full p-2 border rounded-xl bg-white text-xs" value={memberPickSearch} onChange={e => setMemberPickSearch(e.target.value)} />
                  <select
                    className="w-full p-2 border rounded-xl bg-white text-xs"
                    value={seatForm.user_id}
                    onChange={e => {
                      const u = localUsers.find(x => x.id === e.target.value);
                      if (!u) return setSeatForm({ ...seatForm, user_id: '' });
                      setSeatForm({ ...seatForm, user_id: u.id, occupant: u.full_name || '', phone: u.phone || '', is_member_in_meeting: u.is_church_member !== false, meeting_label: u.detailed_stage || u.service_stage || '' });
                    }}
                  >
                    <option value="">-- ضيف من خارج الكنيسة / إدخال يدوي --</option>
                    {filteredUsersPick.map(u => <option key={u.id} value={u.id}>{u.full_name} {u.detailed_stage ? `(${u.detailed_stage})` : ''} {u.phone ? `- ${u.phone}` : ''}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">اسم الحاجز / الراكب *</label>
                    <input required placeholder="الاسم..." className="w-full p-2.5 border rounded-xl" value={seatForm.occupant} onChange={e => setSeatForm({ ...seatForm, occupant: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">رقم التليفون</label>
                    <div className="flex gap-1">
                      <input type="tel" placeholder="01xxxxxxxxx" className="flex-1 p-2.5 border rounded-xl" value={seatForm.phone} onChange={e => setSeatForm({ ...seatForm, phone: e.target.value })} />
                      {seatForm.phone && onOpenWhatsApp && (
                        <button type="button" onClick={() => onOpenWhatsApp({ name: seatForm.occupant, phone: seatForm.phone, targetId: seatForm.user_id, defaultCategory: 'افتقاد' })} className="px-2.5 bg-green-600 text-white rounded-xl cursor-pointer">
                          <MessageCircle size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">الانتماء:</label>
                    <select className="w-full p-2 border rounded-xl bg-white text-xs" value={seatForm.is_member_in_meeting ? 'inside' : 'outside'} onChange={e => setSeatForm({ ...seatForm, is_member_in_meeting: e.target.value === 'inside' })}>
                      <option value="inside">✅ داخل الاجتماع / الخدمة</option>
                      <option value="outside">🌐 من خارج الاجتماع</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">اسم الاجتماع / المرحلة</label>
                    <input placeholder="مثال: أولى ثانوي" className="w-full p-2 border rounded-xl bg-white text-xs" value={seatForm.meeting_label} onChange={e => setSeatForm({ ...seatForm, meeting_label: e.target.value })} />
                  </div>
                </div>

                {personMultiBus && personMultiBus.count > 0 && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 space-y-1 text-xs">
                    <strong className="text-amber-950 block">📌 كراسي هذا الشخص في الرحلة ({personMultiBus.count} كرسي):</strong>
                    <p className="text-amber-900">{personMultiBus.seats.map(s => `${s.busName} (كرسي ${s.seatNumber})`).join(' • ')}</p>
                    <p className="font-black text-amber-950">الإجمالي: المطلوب {personMultiBus.totalDueAll}ج • المدفوع {personMultiBus.totalPaidAll}ج • المتبقي {personMultiBus.totalRemainingAll}ج</p>
                  </div>
                )}

                <div className="bg-emerald-50/50 border-2 border-emerald-200 rounded-2xl p-3.5 space-y-3">
                  <div className="flex flex-wrap justify-between items-center gap-2 border-b border-emerald-200 pb-2">
                    <strong className="text-sm text-emerald-950">💰 حساب الكرسي والأقساط</strong>
                    <div className="flex items-center gap-2 text-xs">
                      <label>المطلوب (ج.م):</label>
                      <input type="number" min="0" className="w-24 p-1.5 border rounded-lg bg-white text-center font-black" value={seatForm.total_due} onChange={e => setSeatForm({ ...seatForm, total_due: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white p-2 rounded-xl border"><span className="text-gray-500 block">المطلوب</span><strong className="text-sm">{seatForm.total_due || 0} ج.م</strong></div>
                    <div className="bg-white p-2 rounded-xl border"><span className="text-emerald-700 block">المدفوع</span><strong className="text-sm text-emerald-800">{currentSeatPaid} ج.م</strong></div>
                    <div className={`p-2 rounded-xl border ${currentSeatRemaining > 0 ? 'bg-red-50 border-red-300' : 'bg-emerald-100 border-emerald-300'}`}>
                      <span className={currentSeatRemaining > 0 ? 'text-red-700 block' : 'text-emerald-800 block'}>المتبقي</span>
                      <strong className={`text-sm ${currentSeatRemaining > 0 ? 'text-red-700' : 'text-emerald-900'}`}>{currentSeatRemaining > 0 ? `${currentSeatRemaining} ج.م` : 'خالص ✅'}</strong>
                    </div>
                  </div>

                  {(seatForm.payments || []).length > 0 && (
                    <div className="space-y-1.5">
                      {seatForm.payments.map(pay => (
                        <div key={pay.id} className="bg-white p-2 rounded-xl border flex justify-between items-center text-xs">
                          <div>
                            <strong className="text-emerald-800">{pay.amount} ج.م</strong>
                            <span className="mx-1.5 px-2 py-0.5 rounded bg-slate-100">{pay.method}</span>
                            <span className="text-gray-500">({pay.date})</span>
                            {pay.note && <span className="text-gray-600 mr-1">• {pay.note}</span>}
                          </div>
                          <button type="button" onClick={() => setSeatForm({ ...seatForm, payments: seatForm.payments.filter(p => p.id !== pay.id) })} className="text-red-600 p-1"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-white p-2.5 rounded-xl border space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-[#7a1c24]">+ تسجيل دفعة / قسط:</span>
                      {currentSeatRemaining > 0 && (
                        <div className="flex gap-1">
                          <button type="button" onClick={() => setNewPayment({ ...newPayment, amount: String(currentSeatRemaining) })} className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded text-[11px] cursor-pointer">باقي المبلغ ({currentSeatRemaining}ج)</button>
                          <button type="button" onClick={() => setNewPayment({ ...newPayment, amount: String(Math.ceil(currentSeatRemaining / 2)) })} className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded text-[11px] cursor-pointer">النصف</button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <input type="number" min="1" placeholder="المبلغ" className="p-2 border rounded-lg text-xs" value={newPayment.amount} onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })} />
                      <select className="p-2 border rounded-lg text-xs bg-white" value={newPayment.method} onChange={e => setNewPayment({ ...newPayment, method: e.target.value })}>
                        {PAYMENT_METHODS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                      </select>
                      <input type="date" className="p-2 border rounded-lg text-xs" value={newPayment.date} onChange={e => setNewPayment({ ...newPayment, date: e.target.value })} />
                    </div>
                    <div className="flex gap-1.5">
                      <input placeholder="ملاحظة (مقدم / يوم الرحلة)" className="flex-1 p-2 border rounded-lg text-xs font-normal" value={newPayment.note} onChange={e => setNewPayment({ ...newPayment, note: e.target.value })} />
                      <button
                        type="button"
                        onClick={() => {
                          const amt = Number(newPayment.amount);
                          if (!amt || amt <= 0) return alert('اكتب مبلغ الدفعة بشكل صحيح');
                          setSeatForm({ ...seatForm, payments: [...(seatForm.payments || []), { id: `pay_${Date.now()}`, amount: amt, method: newPayment.method || 'كاش', date: newPayment.date || todayISO, note: newPayment.note || '' }] });
                          setNewPayment({ amount: '', method: newPayment.method, date: todayISO, note: '' });
                        }}
                        className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs cursor-pointer"
                      >
                        + إضافة الدفعة
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => { if (!seatForm.occupant.trim()) return alert('اكتب اسم الراكب'); saveSeatAssignment(false); }} className="flex-1 py-3 bg-[#7a1c24] text-white rounded-xl cursor-pointer">حفظ بيانات الكرسي والدفع</button>
                  {selectedSeatModal.seat.occupant && <button type="button" onClick={() => { if (confirm('إخلاء الكرسي؟')) saveSeatAssignment(true); }} className="px-4 py-3 bg-red-50 text-red-700 rounded-xl cursor-pointer">إخلاء الكرسي</button>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}export { PrintBusModal } from './PrintBusModal';

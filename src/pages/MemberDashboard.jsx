
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';
import { Phone, AlertCircle, CheckCircle2, Calendar, BookOpen, Clock, UserCheck, MessageCircle, Bus, MapPin } from 'lucide-react';

export default function MemberDashboard({
  member, servants = [], events = [], services = [],
  attendance = [], confessionSlots = [], priestMasses = [], priests = [],
  onMemberUpdated
}) {
  const [selectedPriestId, setSelectedPriestId] = useState(member.confession_father_id || '');
  const [savingFather, setSavingFather] = useState(false);
  const [filterPriestId, setFilterPriestId] = useState(member.confession_father_id || 'all');
  const [myBookings, setMyBookings] = useState([]);
  const [bookingBusy, setBookingBusy] = useState(null);

  const [publicTrips, setPublicTrips] = useState([]);
  const [myTripRegs, setMyTripRegs] = useState([]);
  const [tripBusy, setTripBusy] = useState(null);

  const todayISO = new Date().toLocaleDateString('en-CA');
  const myAtt = attendance.filter(a => a.member_id === member.id);
  const presentCount = myAtt.filter(a => a.present).length;
  const myConfFather = priests.find(p => p.id === member.confession_father_id);

  useEffect(() => {
    setSelectedPriestId(member.confession_father_id || '');
    setFilterPriestId(member.confession_father_id || 'all');
  }, [member.confession_father_id]);

  useEffect(() => {
    if (!member?.id) return;
    Promise.all([
      supabase.from('confession_bookings').select('*').eq('member_id', member.id).order('booking_date', { ascending: true }),
      supabase.from('church_trips').select('*').eq('is_public', true).order('trip_date', { ascending: true }),
      supabase.from('trip_registrations').select('*').eq('user_id', member.id)
    ]).then(([cb, tr, reg]) => {
      if (cb.data) setMyBookings(cb.data);
      if (tr.data) setPublicTrips(tr.data);
      if (reg.data) setMyTripRegs(reg.data);
    });
  }, [member?.id]);

  const memberClass = (member.assigned_class || '').trim();
  const memberStage = (member.detailed_stage || member.service_stage || '').trim();
  const extraServices = Array.isArray(member.permissions?.extra_services) ? member.permissions.extra_services : [];

  const myServices = services.filter(srv => {
    if (extraServices.includes(srv.class_name) || extraServices.includes(srv.stage_name)) return true;
    if (memberClass) return srv.class_name === memberClass;
    if (memberStage && memberStage !== 'شعب عام') {
      return (srv.stage_name || '').includes(memberStage) || (srv.class_name || '').includes(memberStage);
    }
    return false;
  });

  const myClassServants = servants.filter(s => {
    const sClass = (s.assigned_class || '').trim();
    const sStages = `${s.detailed_stage || ''} ${s.service_stage || ''} ${s.sector || ''}`;
    if (extraServices.some(ex => sClass === ex || sStages.includes(ex))) return true;
    if (memberClass) return sClass === memberClass;
    if (memberStage && memberStage !== 'شعب عام') return sStages.includes(memberStage);
    return false;
  });

  const onlyMassEvents = events.filter(ev => (ev.event_type || '').includes('قداس'));

  const handleChooseConfessionFather = async (e) => {
    e.preventDefault();
    if (!selectedPriestId) return alert('اختر الأب الكاهن أولاً');
    const priestObj = priests.find(p => p.id === selectedPriestId);
    setSavingFather(true);
    try {
      const { data, error } = await supabase
        .from('church_users')
        .update({
          confession_father_id: selectedPriestId,
          confession_father: priestObj?.full_name || ''
        })
        .eq('id', member.id)
        .select().single();

      if (error) alert('تعذر الحفظ: ' + error.message);
      else if (data) {
        if (onMemberUpdated) onMemberUpdated(data);
        logActivity({
          user: member,
          actionType: 'تحديد_أب_الاعتراف',
          targetTable: 'church_users',
          targetId: member.id,
          description: `اختار ${member.full_name} أب الاعتراف: ${priestObj?.full_name}`
        });
        alert(`تم تسجيل أب الاعتراف (${priestObj?.full_name}) بنجاح ✅`);
      }
    } finally {
      setSavingFather(false);
    }
  };

  const handleBookSlot = async (slot) => {
    const already = myBookings.some(b => b.slot_id === slot.id && b.status === 'محجوز');
    if (already) return alert('أنت حاجز هذا الميعاد بالفعل ✅');
    setBookingBusy(slot.id);
    try {
      const { data, error } = await supabase
        .from('confession_bookings')
        .insert([{
          slot_id: slot.id,
          priest_id: slot.priest_id,
          member_id: member.id,
          member_name: member.full_name,
          member_phone: member.phone || '',
          booking_date: slot.slot_date,
          booking_time: slot.start_time || '',
          status: 'محجوز'
        }])
        .select().single();

      if (error) alert('تعذر الحجز: ' + error.message);
      else if (data) {
        setMyBookings([...myBookings, data]);
        logActivity({
          user: member,
          actionType: 'حجز_ميعاد_اعتراف',
          targetTable: 'confession_bookings',
          targetId: data.id,
          description: `حجز ${member.full_name} ميعاد اعتراف يوم ${slot.slot_date}`
        });
        alert(`تم حجز ميعاد الاعتراف يوم ${slot.slot_date} بنجاح 🙏`);
      }
    } finally {
      setBookingBusy(null);
    }
  };

  const handleJoinTrip = async (trip) => {
    const countInput = prompt(`اشتراك في رحلة (${trip.title}):\nاكتب عدد الأفراد المطلوب حجزهم:`, '1');
    if (!countInput) return;
    const seatsCount = Math.max(1, Number(countInput) || 1);
    const notesInput = prompt('أي ملاحظات لمكتب الرحلات (اختياري):', '') || '';

    setTripBusy(trip.id);
    try {
      const { data, error } = await supabase
        .from('trip_registrations')
        .insert([{
          trip_id: trip.id,
          user_id: member.id,
          user_name: member.full_name,
          user_phone: member.phone || '',
          seats_count: seatsCount,
          notes: notesInput,
          status: 'طلب اشتراك'
        }])
        .select().single();

      if (error) return alert('تعذر إرسال الاشتراك: ' + error.message);
      if (data) {
        setMyTripRegs([...myTripRegs, data]);
        logActivity({
          user: member,
          actionType: 'اشتراك_رحلة',
          targetTable: 'trip_registrations',
          targetId: data.id,
          description: `اشترك ${member.full_name} في رحلة (${trip.title}) — عدد الأفراد: ${seatsCount}`
        });
        alert(`تم تسجيل اشتراكك في (${trip.title}) بنجاح ✅`);
      }
    } finally {
      setTripBusy(null);
    }
  };

  const displayedSlots = confessionSlots.filter(s =>
    s.slot_date >= todayISO &&
    (filterPriestId === 'all' || s.priest_id === filterPriestId)
  );

  return (
    <div className="space-y-4 text-xs" dir="rtl">
      {/* كارت الترحيب */}
      <div className="bg-linear-to-l from-[#5c1319] via-[#7a1c24] to-[#91212b] text-white p-4 sm:p-5 rounded-3xl shadow-md flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div className="space-y-1.5">
          <h2 className="text-base sm:text-xl font-black text-amber-300">أهلاً بك، {member.full_name}</h2>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="px-2.5 py-1 bg-white/15 rounded-xl font-bold">
              {myConfFather ? `✝ أب الاعتراف: ${myConfFather.full_name}` : 'لم يتم تحديد أب الاعتراف بعد'}
            </span>
            {(memberClass || memberStage) && (
              <span className="px-2.5 py-1 bg-amber-400/20 text-amber-200 rounded-xl font-bold">
                {memberClass ? `🏫 فصلك: ${memberClass}` : `📖 مرحلتك: ${memberStage}`}
              </span>
            )}
          </div>
        </div>
        <div className="bg-white/15 border border-white/15 px-4 py-2.5 rounded-2xl flex sm:flex-col items-center justify-between sm:justify-center gap-2 shrink-0">
          <span className="text-[11px] opacity-85 font-bold">نسبة حضورك</span>
          <strong className="text-base sm:text-lg text-amber-200 font-black">
            {myAtt.length > 0 ? `${Math.round((presentCount / myAtt.length) * 100)}%` : 'جديد'}
          </strong>
        </div>
      </div>

      {/* اختيار أب الاعتراف لأول مرة */}
      {!member.confession_father_id && (
        <form onSubmit={handleChooseConfessionFather} className="bg-amber-50 border-2 border-amber-300 p-4 rounded-3xl space-y-3 shadow-sm">
          <strong className="text-sm text-amber-950 flex items-center gap-1.5">
            <UserCheck size={17} className="text-[#7a1c24]" /> تحديد أب الاعتراف لأول مرة:
          </strong>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <select
              required
              className="w-full sm:max-w-md p-2.5 border border-amber-300 rounded-xl bg-white font-bold outline-none focus:border-[#7a1c24]"
              value={selectedPriestId}
              onChange={e => setSelectedPriestId(e.target.value)}
            >
              <option value="">-- اختر الأب الكاهن --</option>
              {priests.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            <button type="submit" disabled={savingFather} className="w-full sm:w-auto px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer transition">
              {savingFather ? 'جاري الحفظ...' : 'تأكيد أب الاعتراف'}
            </button>
          </div>
        </form>
      )}

      {/* مواعيد الاعتراف */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2.5 border-b border-gray-100 pb-3">
          <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5">
            <Clock size={17} /> مواعيد الاعتراف للآباء الكهنة
          </h3>
          <select
            className="w-full sm:w-64 p-2.5 border border-gray-200 rounded-xl bg-[#fbfaf7] font-bold text-xs outline-none focus:border-[#7a1c24]"
            value={filterPriestId}
            onChange={e => setFilterPriestId(e.target.value)}
          >
            <option value="all">كل آباء الكنيسة</option>
            {priests.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>

        {displayedSlots.length === 0 ? (
          <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
            لا توجد مواعيد اعتراف قادمة منشورة حالياً.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayedSlots.map(s => {
              const slotPriest = priests.find(p => p.id === s.priest_id);
              const isBookedByMe = myBookings.some(b => b.slot_id === s.id && b.status === 'محجوز');
              return (
                <div
                  key={s.id}
                  className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                    s.is_cancelled ? 'bg-red-50/70 border-red-200' : 'bg-[#fbfaf7] border-gray-200'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <strong className="text-sm text-gray-900">{s.confession_title} ({s.period})</strong>
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] flex items-center gap-1 shrink-0 ${
                        s.is_cancelled ? 'bg-red-600 text-white' : 'bg-green-100 text-green-800'
                      }`}>
                        {s.is_cancelled ? <><AlertCircle size={12} /> معتذر</> : <><CheckCircle2 size={12} /> متاح</>}
                      </span>
                    </div>

                    {slotPriest && <span className="text-[#7a1c24] font-black block">✝ {slotPriest.full_name}</span>}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-600">
                      <span>📅 {s.slot_date}</span>
                      <span>⏰ {s.start_time} - {s.end_time}</span>
                    </div>
                    {s.location && (
                      <span className="text-gray-500 flex items-center gap-1">
                        <MapPin size={12} className="text-[#7a1c24]" /> {s.location}
                      </span>
                    )}
                    {s.is_cancelled && <p className="text-red-700 font-bold pt-1">⚠️ اعتذر أبونا: {s.cancel_reason}</p>}
                  </div>

                  {!s.is_cancelled && (
                    <div className="pt-2 border-t border-gray-200/70">
                      {isBookedByMe ? (
                        <div className="w-full py-2 bg-blue-100 text-blue-900 rounded-xl font-black text-center">
                          محجوز ✅
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={bookingBusy === s.id}
                          onClick={() => handleBookSlot(s)}
                          className="w-full py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer transition"
                        >
                          {bookingBusy === s.id ? 'جاري الحجز...' : 'حجز ميعاد'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* مواعيد القداسات فقط */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
        <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5 border-b border-gray-100 pb-3">
          <Calendar size={17} /> مواعيد القداسات الإلهية
        </h3>
        {priestMasses.filter(m => m.is_available).length === 0 && onlyMassEvents.length === 0 ? (
          <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
            لا توجد مواعيد قداسات منشورة حالياً.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {priestMasses.filter(m => m.is_available).map(m => (
              <div key={m.id} className="p-3.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-900 font-bold text-[10px]">{m.target_audience}</span>
                    <strong className="text-sm text-gray-900">{m.mass_name}</strong>
                  </div>
                  <p className="text-gray-500 flex items-center gap-1"><MapPin size={12} className="text-[#7a1c24]" /> {m.church_name}</p>
                </div>
                <span className="self-start sm:self-center px-3 py-1 bg-red-50 text-[#7a1c24] rounded-xl font-black text-[11px] shrink-0">
                  {m.mass_date} ({m.mass_time})
                </span>
              </div>
            ))}
            {onlyMassEvents.map(ev => (
              <div key={ev.id} className="p-3.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-bold text-[10px]">{ev.event_type}</span>
                    <strong className="text-sm text-gray-900">{ev.title}</strong>
                  </div>
                  <p className="text-gray-500 flex items-center gap-1"><MapPin size={12} className="text-[#7a1c24]" /> {ev.place}</p>
                </div>
                <span className="self-start sm:self-center px-3 py-1 bg-red-50 text-[#7a1c24] rounded-xl font-black text-[11px] shrink-0">
                  {ev.event_time}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* رحلات مكتب الرحلات العامة */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
        <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5 border-b border-gray-100 pb-3">
          <Bus size={17} /> رحلات الكنيسة المتاحة (للعرض والاشتراك)
        </h3>
        {publicTrips.length === 0 ? (
          <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
            لا توجد رحلات عامة معلنة حالياً.
          </div>
        ) : (
          <div className="grid gap-3">
            {publicTrips.map(tr => {
              const myReg = myTripRegs.find(r => r.trip_id === tr.id);
              const isOvernight = Number(tr.days_count || 1) > 1 || (Array.isArray(tr.rooms) && tr.rooms.length > 0);
              return (
                <div key={tr.id} className="p-4 bg-purple-50/40 border border-purple-200 rounded-2xl space-y-2.5">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-950 rounded-lg text-[10px] font-black">{tr.trip_category || 'رحلة عامة'}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${isOvernight ? 'bg-indigo-100 text-indigo-950' : 'bg-amber-100 text-amber-950'}`}>
                          {isOvernight ? `🌙 ${tr.days_count} أيام` : '☀️ يوم واحد (داي يوز)'}
                        </span>
                        {Number(tr.cost_per_person) > 0 && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-lg text-[10px] font-black">💰 {tr.cost_per_person} ج.م</span>}
                      </div>
                      <strong className="text-sm sm:text-base text-gray-900 block">{tr.title}</strong>
                      <p className="text-gray-600">
                        📅 {tr.trip_date || 'قريباً'}
                        {tr.gathering_time && ` • تجمع: ${tr.gathering_time}`}
                        {tr.departure_time && ` • تحرك: ${tr.departure_time}`}
                        {tr.return_time && ` • عودة: ${tr.return_time}`}
                      </p>
                    </div>

                    {myReg ? (
                      <span className="w-full sm:w-auto text-center px-3.5 py-2 bg-green-100 text-green-900 rounded-xl font-black text-xs shrink-0">
                        ✅ تم تسجيل اشتراكك ({myReg.seats_count} فرد)
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={tripBusy === tr.id}
                        onClick={() => handleJoinTrip(tr)}
                        className="w-full sm:w-auto px-4 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black text-xs cursor-pointer shrink-0 transition"
                      >
                        {tripBusy === tr.id ? 'جاري التسجيل...' : '✋ اشتراك في الرحلة'}
                      </button>
                    )}
                  </div>

                  {tr.monasteries && <p className="text-gray-800">⛪ <strong>الأماكن والزيارات:</strong> {tr.monasteries}</p>}
                  {tr.daily_program && (
                    <div className="p-3 bg-white border border-purple-100 rounded-xl text-gray-700 whitespace-pre-line">
                      <strong className="text-[#7a1c24] block mb-1">📋 برنامج الرحلة التفصيلي:</strong>
                      {tr.daily_program}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* فصله فقط وخدام فصله فقط */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
        <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5 border-b border-gray-100 pb-3">
          <BookOpen size={17} /> فصلك / خدمتك وخدامك للتواصل
        </h3>

        {myServices.length === 0 && myClassServants.length === 0 ? (
          <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
            لم يتم تسكينك في فصل محدد بعد. راجع خادمك أو أدمن الكنيسة.
          </div>
        ) : (
          <div className="space-y-3">
            {myServices.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {myServices.map(srv => (
                  <div key={srv.id} className="p-3.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl">
                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 font-bold text-[10px]">{srv.stage_name}</span>
                    <strong className="block text-sm text-gray-900 mt-1">{srv.class_name}</strong>
                    <p className="text-gray-500 mt-0.5">⏰ {srv.meeting_time} {srv.room_name && `• 📍 ${srv.room_name}`}</p>
                  </div>
                ))}
              </div>
            )}

            {myClassServants.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {myClassServants.map(s => (
                  <div key={s.id} className="p-3.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-2.5">
                    <div>
                      <strong className="block text-gray-900 text-sm">{s.full_name}</strong>
                      <span className="text-gray-500">
                        {s.assigned_class || s.detailed_stage || s.sector}
                        {s.phone ? ` • 📞 ${s.phone}` : ''}
                      </span>
                    </div>
                    {s.phone && (
                      <div className="grid grid-cols-2 sm:flex gap-1.5 shrink-0">
                        <a href={`https://wa.me/2${s.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-1">
                          <MessageCircle size={13} /> واتس
                        </a>
                        <a href={`tel:${s.phone}`} className="px-3 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-bold flex items-center justify-center gap-1">
                          <Phone size={13} /> اتصال
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLogger';
import { X, Search, CalendarDays, BookOpen, ShieldAlert, CheckCircle2, MessageCircle, Plus, User } from 'lucide-react';

export default function ConfessorProfileModal({
  confessor,
  onClose,
  priest,
  spiritualNotes = [],
  setSpiritualNotes,
  bookings = [],
  setBookings,
  sessionsHistory = [],
  setSessionsHistory,
  localUsers = [],
  setLocalUsers,
  onRefresh,
  todayISO,
  onOpenWhatsApp
}) {
  const [tab, setTab] = useState('spiritual_file');
  const [historySearch, setHistorySearch] = useState('');

  const memberBookings = bookings
    .filter(b => b.member_id === confessor?.id && b.status !== 'ملغي')
    .sort((a, b) => (b.booking_date || '').localeCompare(a.booking_date || ''));

  // أقرب حجز قادم زمنياً
  const upcomingBooking = bookings
    .filter(b => b.member_id === confessor?.id && b.booking_date >= todayISO && b.status === 'محجوز')
    .sort((a, b) => (a.booking_date || '').localeCompare(b.booking_date || ''))[0];

  const memberHistory = sessionsHistory
    .filter(h => h.member_id === confessor?.id)
    .sort((a, b) => (b.session_date || '').localeCompare(a.session_date || '') || (b.created_at || '').localeCompare(a.created_at || ''));

  const existingNote = spiritualNotes.find(n => n.member_id === confessor?.id);

  const [sessionForm, setSessionForm] = useState({
    session_date: todayISO,
    previous_rule_followed: 'التزم بالكامل',
    challenges_and_gaps: '',
    procedures_taken: '',
    spiritual_rule_given: '',
    priest_private_note: '',
    confession_status: existingNote?.confession_status || 'منتظم',
    has_communion: existingNote?.has_communion ?? true,
    mark_booking_done: true
  });

  const [infoForm, setInfoForm] = useState({
    first_name: '', second_name: '', third_name: '', fourth_name: '',
    phone: '', dob: '', job_title: '', is_studying: false, detailed_stage: '',
    marital_status: 'أعزب', housing_type: 'تمليك', spouse_name: '', spouse_phone: '', address: '',
    is_church_member: true,
    confession_status: 'منتظم', last_confession_date: todayISO, has_communion: true, spiritual_rule: '', priest_note: ''
  });

  useEffect(() => {
    if (!confessor) return;
    setTab('spiritual_file');
    setHistorySearch('');
    const parts = (confessor.full_name || '').split(' ');
    const note = spiritualNotes.find(n => n.member_id === confessor.id);
    setInfoForm({
      first_name: confessor.first_name || parts[0] || '',
      second_name: confessor.second_name || parts[1] || '',
      third_name: confessor.third_name || parts[2] || '',
      fourth_name: confessor.fourth_name || parts.slice(3).join(' ') || '',
      phone: confessor.phone || '',
      dob: confessor.dob || '',
      job_title: confessor.job_title || '',
      is_studying: Boolean(confessor.is_studying),
      detailed_stage: confessor.detailed_stage || confessor.service_stage || '',
      marital_status: confessor.marital_status || 'أعزب',
      housing_type: confessor.housing_type || 'تمليك',
      spouse_name: confessor.spouse_name || '',
      spouse_phone: confessor.spouse_phone || '',
      address: confessor.address || '',
      is_church_member: confessor.is_church_member !== false,
      confession_status: note?.confession_status || 'منتظم',
      last_confession_date: note?.last_confession_date || todayISO,
      has_communion: note?.has_communion ?? true,
      spiritual_rule: note?.spiritual_rule || '',
      priest_note: note?.priest_note || ''
    });
    setSessionForm({
      session_date: todayISO,
      previous_rule_followed: 'التزم بالكامل',
      challenges_and_gaps: '',
      procedures_taken: '',
      spiritual_rule_given: '',
      priest_private_note: '',
      confession_status: note?.confession_status || 'منتظم',
      has_communion: note?.has_communion ?? true,
      mark_booking_done: true
    });
  }, [confessor?.id]);

  if (!confessor) return null;

  const updateBookingStatus = async (bookingId, newStatus) => {
    const { data, error } = await supabase
      .from('confession_bookings')
      .update({ status: newStatus })
      .eq('id', bookingId)
      .select().single();
    if (!error && data) {
      setBookings(bookings.map(b => (b.id === bookingId ? data : b)));
      logActivity({
        user: priest,
        actionType: 'تحديث_حجز_اعتراف',
        targetTable: 'confession_bookings',
        targetId: bookingId,
        description: `حدّث حالة حجز (${confessor.full_name}) إلى: ${newStatus}`
      });
    } else if (error) {
      alert(error.message);
    }
  };

  const handleSaveNewSession = async (e) => {
    e.preventDefault();
    if (!sessionForm.challenges_and_gaps.trim() && !sessionForm.procedures_taken.trim() && !sessionForm.spiritual_rule_given.trim()) {
      return alert('اكتب على الأقل الثغرات/المشاكل أو الإجراءات أو القانون الروحي.');
    }

    const { data: savedHist, error: hErr } = await supabase
      .from('confession_sessions_history')
      .insert([{
        member_id: confessor.id,
        priest_id: priest.id,
        booking_id: upcomingBooking?.id || null,
        session_date: sessionForm.session_date || todayISO,
        previous_rule_followed: sessionForm.previous_rule_followed,
        challenges_and_gaps: sessionForm.challenges_and_gaps.trim(),
        procedures_taken: sessionForm.procedures_taken.trim(),
        spiritual_rule_given: sessionForm.spiritual_rule_given.trim(),
        priest_private_note: sessionForm.priest_private_note.trim()
      }])
      .select().single();

    if (hErr) return alert('خطأ في حفظ جلسة الاعتراف: ' + hErr.message);

    if (savedHist) setSessionsHistory([savedHist, ...sessionsHistory]);

    const { data: noteData } = await supabase
      .from('spiritual_notes')
      .upsert([{
        member_id: confessor.id,
        priest_id: priest.id,
        confession_status: sessionForm.confession_status,
        last_confession_date: sessionForm.session_date || todayISO,
        has_communion: sessionForm.has_communion,
        spiritual_rule: sessionForm.spiritual_rule_given.trim() || existingNote?.spiritual_rule || '',
        priest_note: sessionForm.priest_private_note.trim() || existingNote?.priest_note || '',
        updated_at: new Date().toISOString()
      }], { onConflict: 'member_id' })
      .select().single();

    if (noteData) {
      setSpiritualNotes([noteData, ...spiritualNotes.filter(n => n.member_id !== noteData.member_id)]);
    }

    if (upcomingBooking && sessionForm.mark_booking_done) {
      await updateBookingStatus(upcomingBooking.id, 'حضر وتم الاعتراف');
    }

    logActivity({
      user: priest,
      actionType: 'تسجيل_جلسة_اعتراف',
      targetTable: 'confession_sessions_history',
      targetId: savedHist?.id,
      description: `سجل جلسة اعتراف وقانون روحي وإجراءات للمعترف: ${confessor.full_name}`
    });

    setSessionForm({
      session_date: todayISO,
      previous_rule_followed: 'التزم بالكامل',
      challenges_and_gaps: '',
      procedures_taken: '',
      spiritual_rule_given: '',
      priest_private_note: '',
      confession_status: sessionForm.confession_status,
      has_communion: sessionForm.has_communion,
      mark_booking_done: true
    });
  };

  const savePersonalInfo = async (e) => {
    e.preventDefault();
    const full_name = [infoForm.first_name, infoForm.second_name, infoForm.third_name, infoForm.fourth_name].map(s => s.trim()).filter(Boolean).join(' ');
    const { data: updatedUser, error: uErr } = await supabase
      .from('church_users')
      .update({
        full_name: full_name || confessor.full_name,
        first_name: infoForm.first_name, second_name: infoForm.second_name,
        third_name: infoForm.third_name, fourth_name: infoForm.fourth_name,
        phone: infoForm.phone, dob: infoForm.dob || null, job_title: infoForm.job_title,
        is_studying: Boolean(infoForm.is_studying),
        detailed_stage: infoForm.detailed_stage, service_stage: infoForm.detailed_stage,
        marital_status: infoForm.marital_status, housing_type: infoForm.housing_type,
        spouse_name: infoForm.spouse_name, spouse_phone: infoForm.spouse_phone, address: infoForm.address,
        is_church_member: Boolean(infoForm.is_church_member)
      })
      .eq('id', confessor.id).select().single();

    if (uErr) return alert('خطأ في تحديث البيانات: ' + uErr.message);

    const { data: noteData } = await supabase
      .from('spiritual_notes')
      .upsert([{
        member_id: confessor.id, priest_id: priest.id,
        confession_status: infoForm.confession_status,
        last_confession_date: infoForm.last_confession_date || null,
        has_communion: infoForm.has_communion,
        spiritual_rule: infoForm.spiritual_rule,
        priest_note: infoForm.priest_note,
        updated_at: new Date().toISOString()
      }], { onConflict: 'member_id' }).select().single();

    if (updatedUser) setLocalUsers(localUsers.map(u => (u.id === updatedUser.id ? updatedUser : u)));
    if (noteData) setSpiritualNotes([noteData, ...spiritualNotes.filter(n => n.member_id !== noteData.member_id)]);
    logActivity({ user: priest, actionType: 'تعديل_بيانات_معترف', targetTable: 'church_users', targetId: confessor.id, description: `عدل بيانات المعترف: ${full_name}` });
    if (onRefresh) onRefresh();
    alert('تم حفظ التعديلات بنجاح ✅');
  };

  const unlinkConfessor = async () => {
    if (!confirm('إزالة هذا الشخص من قائمة المعترفين عندك؟')) return;
    const { data, error } = await supabase.from('church_users').update({ confession_father_id: null }).eq('id', confessor.id).select().single();
    if (!error && data) {
      setLocalUsers(localUsers.map(u => (u.id === confessor.id ? data : u)));
      logActivity({ user: priest, actionType: 'إزالة_معترف', targetTable: 'church_users', targetId: confessor.id, description: `أزال المعترف من قائمته: ${data.full_name}` });
      onClose();
      if (onRefresh) onRefresh();
    }
  };

  const filteredHistory = memberHistory.filter(h =>
    !historySearch.trim() ||
    ((h.challenges_and_gaps || '') + ' ' + (h.procedures_taken || '') + ' ' + (h.spiritual_rule_given || '') + ' ' + (h.priest_private_note || '') + ' ' + (h.session_date || '')).toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 z-55">
      <div className="bg-white rounded-3xl w-full max-w-3xl p-5 md:p-6 space-y-4 font-bold max-h-[93vh] overflow-y-auto text-sm">
        <div className="flex flex-wrap justify-between items-start gap-2 border-b pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-[#7a1c24]">{confessor.full_name}</h3>
              <span className={`px-2.5 py-0.5 rounded-lg text-xs ${confessor.is_church_member === false ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'}`}>
                {confessor.is_church_member === false ? '🌐 خارج الكنيسة' : '🏠 داخل الكنيسة'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-lg text-xs ${existingNote?.confession_status === 'منتظم' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>
                {existingNote?.confession_status || 'جديد'}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              📞 {confessor.phone || '—'} • 🎂 {confessor.dob || '—'} • 💼 {confessor.job_title || '—'} • آخر اعتراف: {existingNote?.last_confession_date || '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {confessor.phone && (
              <button
                type="button"
                onClick={() => onOpenWhatsApp({ name: confessor.full_name, phone: confessor.phone, targetId: confessor.id, defaultCategory: 'متابعة اعتراف' })}
                className="px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs flex items-center gap-1 cursor-pointer"
              >
                <MessageCircle size={14} /> واتساب
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"><X size={18} /></button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('spiritual_file')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black cursor-pointer flex items-center gap-1.5 ${tab === 'spiritual_file' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-800'}`}
          >
            <BookOpen size={15} /> الملف الروحي الشامل والثغرات والإجراءات ({memberHistory.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('personal_info')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black cursor-pointer flex items-center gap-1.5 ${tab === 'personal_info' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-800'}`}
          >
            <User size={15} /> البيانات الشخصية والاجتماعية
          </button>
        </div>

        {tab === 'spiritual_file' ? (
          <div className="space-y-4">
            {upcomingBooking && (
              <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-3.5 flex flex-wrap justify-between items-center gap-2">
                <div>
                  <strong className="text-emerald-950 flex items-center gap-1.5 text-sm">
                    <CalendarDays size={16} /> 📅 لديه حجز اعتراف قادم: {upcomingBooking.booking_date === todayISO ? 'اليوم!' : upcomingBooking.booking_date} {upcomingBooking.booking_time && `• ⏰ ${upcomingBooking.booking_time}`}
                  </strong>
                  {upcomingBooking.notes && <p className="text-xs text-emerald-800 mt-0.5">ملاحظة الحجز: {upcomingBooking.notes}</p>}
                </div>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => updateBookingStatus(upcomingBooking.id, 'حضر وتم الاعتراف')} className="px-3 py-1.5 bg-emerald-700 text-white rounded-xl text-xs cursor-pointer">✅ حضر وتم الاعتراف</button>
                  <button type="button" onClick={() => updateBookingStatus(upcomingBooking.id, 'لم يحضر')} className="px-3 py-1.5 bg-red-100 text-red-800 rounded-xl text-xs cursor-pointer">❌ لم يحضر</button>
                </div>
              </div>
            )}

            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 space-y-1">
              <strong className="text-amber-950 text-xs block">📜 القانون الروحي السابق / الحالي المُلزم به:</strong>
              <p className="text-sm text-gray-900 font-normal">
                {existingNote?.spiritual_rule ? existingNote.spiritual_rule : 'لم يتم تسجيل قانون روحي سابق بعد.'}
              </p>
              {existingNote?.priest_note && (
                <p className="text-xs text-[#7a1c24] pt-1 border-t border-amber-200">🔒 ملاحظة أبونا: {existingNote.priest_note}</p>
              )}
            </div>

            <form onSubmit={handleSaveNewSession} className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 space-y-3">
              <strong className="text-[#7a1c24] flex items-center gap-1.5 text-sm">
                <Plus size={16} /> تسجيل جلسة اعتراف جديدة (الثغرات، الإجراءات، والقانون الروحي الجديد)
              </strong>

              <div className="grid sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <label className="block text-gray-700 mb-1">تاريخ الجلسة:</label>
                  <input type="date" className="w-full p-2 border rounded-xl bg-white" value={sessionForm.session_date} onChange={e => setSessionForm({ ...sessionForm, session_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">تنفيذ القانون السابق:</label>
                  <select className="w-full p-2 border rounded-xl bg-white" value={sessionForm.previous_rule_followed} onChange={e => setSessionForm({ ...sessionForm, previous_rule_followed: e.target.value })}>
                    <option value="التزم بالكامل">✅ التزم بالكامل</option>
                    <option value="التزم جزئياً">⚠️ التزم جزئياً</option>
                    <option value="لم يلتزم">❌ لم يلتزم</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">حالة الاعتراف:</label>
                  <select className="w-full p-2 border rounded-xl bg-white" value={sessionForm.confession_status} onChange={e => setSessionForm({ ...sessionForm, confession_status: e.target.value })}>
                    <option value="منتظم">منتظم</option>
                    <option value="يحتاج تشجيع">يحتاج تشجيع</option>
                    <option value="منقطع">منقطع</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">التناول:</label>
                  <select className="w-full p-2 border rounded-xl bg-white" value={sessionForm.has_communion ? 'yes' : 'no'} onChange={e => setSessionForm({ ...sessionForm, has_communion: e.target.value === 'yes' })}>
                    <option value="yes">يتناول ✅</option>
                    <option value="no">مؤجل / لا يتناول ❌</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-red-900 mb-1 flex items-center gap-1"><ShieldAlert size={13} /> المشاكل / الثغرات التي وقع فيها وتحتاج علاجاً:</label>
                  <textarea rows="2" placeholder="مثال: عصبية في البيت، تقصير في صلاة باكر..." className="w-full p-2.5 border rounded-xl bg-white font-normal text-xs" value={sessionForm.challenges_and_gaps} onChange={e => setSessionForm({ ...sessionForm, challenges_and_gaps: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-blue-900 mb-1 flex items-center gap-1"><CheckCircle2 size={13} /> الإجراءات والحلول التي تم اتخاذها:</label>
                  <textarea rows="2" placeholder="مثال: متابعة بعد أسبوعين، قراءة إنجيل يوحنا..." className="w-full p-2.5 border rounded-xl bg-white font-normal text-xs" value={sessionForm.procedures_taken} onChange={e => setSessionForm({ ...sessionForm, procedures_taken: e.target.value })} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-[#7a1c24] mb-1">📜 القانون الروحي الجديد:</label>
                  <textarea rows="2" placeholder="اكتب القانون الروحي الجديد..." className="w-full p-2.5 border border-amber-300 rounded-xl bg-amber-50/40 font-normal text-xs" value={sessionForm.spiritual_rule_given} onChange={e => setSessionForm({ ...sessionForm, spiritual_rule_given: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">🔒 ملاحظات سرية خاصة بأبونا:</label>
                  <textarea rows="2" placeholder="ملاحظات للمتابعة المرة القادمة..." className="w-full p-2.5 border rounded-xl bg-white font-normal text-xs" value={sessionForm.priest_private_note} onChange={e => setSessionForm({ ...sessionForm, priest_private_note: e.target.value })} />
                </div>
              </div>

              <div className="flex flex-wrap justify-between items-center gap-2">
                {upcomingBooking ? (
                  <label className="flex items-center gap-1.5 text-xs text-emerald-900 cursor-pointer">
                    <input type="checkbox" checked={sessionForm.mark_booking_done} onChange={e => setSessionForm({ ...sessionForm, mark_booking_done: e.target.checked })} />
                    تسجيل الحجز القادم كـ "حضر وتم الاعتراف" تلقائياً
                  </label>
                ) : <span />}
                <button type="submit" className="px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl text-xs font-black cursor-pointer">
                  حفظ الجلسة في الملف الروحي ✅
                </button>
              </div>
            </form>

            <div className="space-y-2.5">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <strong className="text-sm text-gray-900">🗂️ السجل الكامل للجلسات السابقة ({memberHistory.length})</strong>
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={14} className="absolute right-3 top-2.5 text-gray-400" />
                  <input
                    placeholder="ابحث داخل ملفه (ثغرة / مشكلة / إجراء / قانون / تاريخ)..."
                    className="w-full pr-8 pl-3 py-2 border rounded-xl text-xs bg-white"
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                  />
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="p-5 bg-gray-50 border rounded-2xl text-center text-xs text-gray-500">
                  لا توجد جلسات مسجلة مطابقة للبحث في ملف هذا المعترف.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto">
                  {filteredHistory.map(h => (
                    <div key={h.id} className="bg-white p-3.5 rounded-2xl border-2 border-gray-100 space-y-1.5 text-xs">
                      <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-1.5">
                        <span className="font-black text-[#7a1c24]">📅 جلسة: {h.session_date}</span>
                        <span className={`px-2 py-0.5 rounded font-bold ${h.previous_rule_followed === 'التزم بالكامل' ? 'bg-green-100 text-green-800' : h.previous_rule_followed === 'التزم جزئياً' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800'}`}>
                          القانون السابق: {h.previous_rule_followed}
                        </span>
                      </div>
                      {h.challenges_and_gaps && <p className="text-red-900 font-normal"><strong className="font-bold">⚠️ الثغرات والمشاكل:</strong> {h.challenges_and_gaps}</p>}
                      {h.procedures_taken && <p className="text-blue-900 font-normal"><strong className="font-bold">🛠️ الإجراءات:</strong> {h.procedures_taken}</p>}
                      {h.spiritual_rule_given && <p className="text-amber-950 bg-amber-50 p-2 rounded-xl font-normal"><strong className="font-bold">📜 القانون المعطى:</strong> {h.spiritual_rule_given}</p>}
                      {h.priest_private_note && <p className="text-gray-600 font-normal">🔒 {h.priest_private_note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={savePersonalInfo} className="space-y-2.5">
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border">
              <span className="text-xs text-gray-700">الانتماء الكنسي:</span>
              <select className="p-1.5 border rounded-lg bg-white text-xs" value={infoForm.is_church_member ? 'inside' : 'outside'} onChange={e => setInfoForm({ ...infoForm, is_church_member: e.target.value === 'inside' })}>
                <option value="inside">🏠 من داخل الكنيسة</option>
                <option value="outside">🌐 من خارج الكنيسة</option>
              </select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              <input required className="p-2 border rounded-xl" value={infoForm.first_name} onChange={e => setInfoForm({ ...infoForm, first_name: e.target.value })} />
              <input required className="p-2 border rounded-xl" value={infoForm.second_name} onChange={e => setInfoForm({ ...infoForm, second_name: e.target.value })} />
              <input className="p-2 border rounded-xl" value={infoForm.third_name} onChange={e => setInfoForm({ ...infoForm, third_name: e.target.value })} />
              <input className="p-2 border rounded-xl" value={infoForm.fourth_name} onChange={e => setInfoForm({ ...infoForm, fourth_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="p-2 border rounded-xl" value={infoForm.dob} onChange={e => setInfoForm({ ...infoForm, dob: e.target.value })} />
              <input type="tel" placeholder="الواتساب" className="p-2 border rounded-xl" value={infoForm.phone} onChange={e => setInfoForm({ ...infoForm, phone: e.target.value })} />
              <input placeholder="الوظيفة" className="p-2 border rounded-xl" value={infoForm.job_title} onChange={e => setInfoForm({ ...infoForm, job_title: e.target.value })} />
              <input placeholder="الدراسة" className="p-2 border rounded-xl" value={infoForm.detailed_stage} onChange={e => setInfoForm({ ...infoForm, detailed_stage: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select className="p-2 border rounded-xl" value={infoForm.marital_status} onChange={e => setInfoForm({ ...infoForm, marital_status: e.target.value })}><option value="أعزب">أعزب</option><option value="متزوج">متزوج</option><option value="أرمل">أرمل</option></select>
              <select className="p-2 border rounded-xl" value={infoForm.housing_type} onChange={e => setInfoForm({ ...infoForm, housing_type: e.target.value })}><option value="تمليك">تمليك</option><option value="إيجار جديد">إيجار جديد</option><option value="إيجار قديم">إيجار قديم</option></select>
              <input placeholder="العنوان" className="p-2 border rounded-xl" value={infoForm.address} onChange={e => setInfoForm({ ...infoForm, address: e.target.value })} />
            </div>
            {infoForm.marital_status !== 'أعزب' && (
              <div className="grid grid-cols-2 gap-2 bg-pink-50/40 p-2 rounded-xl">
                <input placeholder="الزوج/الزوجة" className="p-2 border rounded-xl bg-white" value={infoForm.spouse_name} onChange={e => setInfoForm({ ...infoForm, spouse_name: e.target.value })} />
                <input placeholder="تليفون الزوج/الزوجة" className="p-2 border rounded-xl bg-white" value={infoForm.spouse_phone} onChange={e => setInfoForm({ ...infoForm, spouse_phone: e.target.value })} />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 py-3 bg-[#7a1c24] text-white rounded-xl cursor-pointer">حفظ التعديلات</button>
              <button type="button" onClick={unlinkConfessor} className="px-4 py-2 bg-red-50 text-red-700 rounded-xl cursor-pointer">إزالة من قائمتي</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
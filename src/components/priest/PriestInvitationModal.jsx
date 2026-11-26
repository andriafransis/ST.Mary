import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLogger';
import { canSendChurchInvitations } from '../../lib/permissions';
import {
  MailPlus, Calendar, MapPin, Clock, Trash2,
  CheckCircle2, XCircle, Hourglass, X, Lock
} from 'lucide-react';

const INVITATION_EVENT_TYPES = [
  'معمودية ✝',
  'صلاة طشت 💧',
  'إكليل (فرح) 👑',
  'خطوبة 💍',
  'صلاة تبريك منزل 🏠',
  'افتقاد / مناولة منزلية 🕊️',
  'صلاة أربعين / ذكرى سنوية 🕯️',
  'مناسبة خاصة أخرى 📅'
];

export default function PriestInvitationModal({
  currentUser,
  priests = [],
  policies = [],
  defaultRoleLabel = 'مخدوم',
  isOpen = true,
  onClose = null,
  inline = false
}) {
  const todayISO = new Date().toLocaleDateString('en-CA');
  const [priestsPool, setPriestsPool] = useState(priests);
  const [myInvitations, setMyInvitations] = useState([]);
  const [busy, setBusy] = useState(false);

  const canSend = useMemo(
    () => canSendChurchInvitations(currentUser, policies),
    [currentUser, policies]
  );

  const [form, setForm] = useState({
    priest_id: currentUser?.confession_father_id || '',
    event_type: INVITATION_EVENT_TYPES[0],
    title: '',
    event_date: todayISO,
    event_time: '',
    location: currentUser?.address || '',
    sender_phone: currentUser?.phone || '',
    notes: ''
  });

  useEffect(() => {
    if (Array.isArray(priests) && priests.length > 0) {
      setPriestsPool(priests);
      return;
    }
    supabase
      .from('church_users')
      .select('id, full_name, phone, serial_no')
      .eq('role', 'priest')
      .then(({ data }) => {
        if (data) setPriestsPool(data);
      });
  }, [priests]);

  const loadMyInvitations = async () => {
    if (!currentUser?.id) return;
    const { data, error } = await supabase
      .from('priest_invitations')
      .select('*')
      .eq('sender_id', currentUser.id)
      .order('created_at', { ascending: true });
    if (!error && data) setMyInvitations(data);
  };

  useEffect(() => {
    if (inline || isOpen) {
      loadMyInvitations();
    }
  }, [currentUser?.id, inline, isOpen]);

  const roleBadge = useMemo(() => {
    if (currentUser?.role === 'admin') return 'سوبر أدمن';
    if (currentUser?.role === 'priest') return 'أب كاهن';
    if (currentUser?.role === 'head_servant') return 'أمين خدمة';
    if (currentUser?.role === 'parent') return 'ولي أمر';
    if (currentUser?.role && currentUser.role !== 'member') return 'خادم';
    return defaultRoleLabel;
  }, [currentUser?.role, defaultRoleLabel]);

  if (!inline && !isOpen) return null;

  const handleSendInvitation = async (e) => {
    e.preventDefault();
    if (!canSend) {
      return alert('🔒 غير مسموح لك بإرسال الدعوات؛ هذه الصلاحية متاحة للأدمن أو الكاهن أو من تم منحه صلاحية الإرسال.');
    }
    if (!form.title.trim() || !form.event_date) {
      return alert('يرجى كتابة عنوان/تفاصيل المناسبة وتحديد التاريخ');
    }

    const chosenPriest = priestsPool.find(p => String(p.id) === String(form.priest_id));
    setBusy(true);
    try {
      const payload = {
        priest_id: form.priest_id || null,
        priest_name: chosenPriest?.full_name || 'أبونا الكاهن (أي أب كاهن متاح)',
        sender_id: currentUser?.id || null,
        sender_name: currentUser?.full_name || 'عضو بالكنيسة',
        sender_role: roleBadge,
        sender_phone: (form.sender_phone || currentUser?.phone || '').trim(),
        event_type: form.event_type,
        title: form.title.trim(),
        event_date: form.event_date,
        event_time: form.event_time.trim(),
        location: form.location.trim(),
        notes: form.notes.trim(),
        status: 'قيد الانتظار'
      };

      const { data, error } = await supabase
        .from('priest_invitations')
        .insert([payload])
        .select()
        .single();

      if (error) {
        alert('تعذر إرسال الدعوة: ' + error.message);
        return;
      }

      if (data) {
        setMyInvitations(prev => [...prev, data]);

        try {
          await supabase.from('church_notifications').insert([{
            type: 'priest_invitation',
            title: `💌 دعوة جديدة لـ (${data.event_type})`,
            message: `من ${roleBadge}: ${data.sender_name} • ${data.title} • يوم ${data.event_date}`,
            is_read: false
          }]);
        } catch {
          // optional notification
        }

        logActivity({
          user: currentUser,
          actionType: 'إرسال_دعوة_للكاهن',
          targetTable: 'priest_invitations',
          targetId: data.id,
          description: `أرسل ${data.sender_name} دعوة (${data.event_type}: ${data.title}) يوم ${data.event_date}`
        });

        setForm(prev => ({
          ...prev,
          title: '',
          event_time: '',
          notes: ''
        }));
        alert('تم إرسال الدعوة للأب الكاهن بنجاح ✅');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCancelInvitation = async (inv) => {
    if (!confirm(`هل تريد إلغاء وحذف دعوة (${inv.title})؟`)) return;
    const { error } = await supabase
      .from('priest_invitations')
      .delete()
      .eq('id', inv.id);
    if (!error) {
      setMyInvitations(prev => prev.filter(x => x.id !== inv.id));
    }
  };

  const content = (
    <div className="space-y-4 text-xs" dir="rtl">
      {!canSend ? (
        <div className="bg-amber-50/80 p-4 sm:p-5 rounded-3xl border border-amber-300 shadow-sm space-y-2 font-bold text-amber-950">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-black text-[#7a1c24] flex items-center gap-1.5">
              <Lock size={16} /> إرسال الدعوات مقصور على أصحاب الصلاحية
            </h3>
            {!inline && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 bg-white hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <p className="text-[11px] text-amber-900 font-normal">
            حسابك الحالي (<strong>{currentUser?.full_name || roleBadge}</strong>) ليس مفعّلاً له صلاحية إرسال الدعوات. يمكن للأدمن أو الكاهن أو أمين الخدمة أو من يُمنح صلاحية الإرسال إرسال الدعوات.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSendInvitation} className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3 font-bold">
          <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
            <div>
              <h3 className="text-sm font-black text-[#7a1c24] flex items-center gap-1.5">
                <MailPlus size={17} /> إرسال دعوة لأبونا الكاهن (معمودية / صلاة طشت / فرح / مناسبة)
              </h3>
              <p className="text-[11px] text-gray-500 font-normal mt-0.5">
                تصل الدعوة فوراً للأب الكاهن في جدوله الخاص لقبولها وإدراجها بالمواعيد أو الرد عليك.
              </p>
            </div>
            {!inline && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] text-gray-600 mb-1">الأب الكاهن المدعو:</label>
              <select
                className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
                value={form.priest_id}
                onChange={e => setForm({ ...form, priest_id: e.target.value })}
              >
                <option value="">-- أي أب كاهن متاح بالكنيسة --</option>
                {priestsPool.map((p, idx) => (
                  <option key={p.id} value={p.id}>
                    {p.serial_no || idx + 1}. {p.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-gray-600 mb-1">نوع المناسبة *</label>
              <select
                className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
                value={form.event_type}
                onChange={e => setForm({ ...form, event_type: e.target.value })}
              >
                {INVITATION_EVENT_TYPES.map((t, idx) => (
                  <option key={t} value={t}>
                    {idx + 1}. {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-gray-600 mb-1">عنوان المناسبة / اسم صاحب الدعوة *</label>
              <input
                required
                placeholder="مثلاً: معمودية الطفل كاراس / صلاة طشت..."
                className="w-full p-2.5 border rounded-xl bg-white"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[11px] text-gray-600 mb-1">التاريخ المطلوب *</label>
              <input
                required
                type="date"
                min={todayISO}
                className="w-full p-2.5 border rounded-xl bg-white"
                value={form.event_date}
                onChange={e => setForm({ ...form, event_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-600 mb-1">الوقت المقترح</label>
              <input
                placeholder="مثلاً: 5:00 مساءً"
                className="w-full p-2.5 border rounded-xl bg-white"
                value={form.event_time}
                onChange={e => setForm({ ...form, event_time: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-600 mb-1">المكان / القاعة / العنوان</label>
              <input
                placeholder="الكنيسة أو عنوان المنزل..."
                className="w-full p-2.5 border rounded-xl bg-white"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-600 mb-1">رقم التليفون للتواصل *</label>
              <input
                required
                type="tel"
                placeholder="01xxxxxxxxx"
                className="w-full p-2.5 border rounded-xl bg-white"
                value={form.sender_phone}
                onChange={e => setForm({ ...form, sender_phone: e.target.value })}
              />
            </div>
          </div>

          <textarea
            rows={2}
            placeholder="أي تفاصيل أو ملاحظات إضافية لأبونا..."
            className="w-full p-2.5 border rounded-xl bg-white font-normal"
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2">
            {!inline && onClose && (
              <button type="button" onClick={onClose} className="px-4 py-2 border rounded-xl cursor-pointer">
                إغلاق
              </button>
            )}
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer transition"
            >
              {busy ? 'جاري إرسال الدعوة...' : '💌 إرسال الدعوة لأبونا'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
        <h4 className="font-black text-sm text-gray-900">📋 دعواتي المرسلة للأب الكاهن ({myInvitations.length})</h4>
        {myInvitations.length === 0 ? (
          <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
            لم تقم بإرسال أي دعوات حتى الآن.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myInvitations.map((inv, idx) => {
              const seqNum = inv.serial_no || idx + 1;
              return (
                <div key={inv.id} className="p-3.5 bg-[#fbfaf7] border border-gray-200 rounded-2xl space-y-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="px-2 py-0.5 bg-[#7a1c24] text-white rounded-lg text-[10px] font-black ml-1">
                        #{seqNum}
                      </span>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-950 rounded-lg text-[10px] font-black ml-1.5">
                        {inv.event_type}
                      </span>
                      <strong className="text-sm text-gray-900">{seqNum}. {inv.title}</strong>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 shrink-0 ${
                      inv.status === 'مقبولة'
                        ? 'bg-green-100 text-green-800'
                        : inv.status === 'معتذر'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-900'
                    }`}>
                      {inv.status === 'مقبولة' && <CheckCircle2 size={11} />}
                      {inv.status === 'معتذر' && <XCircle size={11} />}
                      {inv.status === 'قيد الانتظار' && <Hourglass size={11} />}
                      {inv.status}
                    </span>
                  </div>

                  <p className="text-gray-600">✝ {inv.priest_name || 'أبونا الكاهن'}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-600">
                    <span className="inline-flex items-center gap-1"><Calendar size={12} /> {inv.event_date}</span>
                    {inv.event_time && <span className="inline-flex items-center gap-1"><Clock size={12} /> {inv.event_time}</span>}
                    {inv.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {inv.location}</span>}
                  </div>
                  {inv.priest_reply && (
                    <p className="p-2 bg-white border rounded-xl text-[#7a1c24] font-bold">
                      💬 رد أبونا: {inv.priest_reply}
                    </p>
                  )}
                  {inv.status === 'قيد الانتظار' && (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleCancelInvitation(inv)}
                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={12} /> إلغاء الدعوة
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (inline) return content;

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
      <div className="bg-[#fbfaf7] rounded-3xl w-full max-w-3xl p-4 sm:p-6 max-h-[92vh] overflow-y-auto shadow-2xl">
        {content}
      </div>
    </div>
  );
}
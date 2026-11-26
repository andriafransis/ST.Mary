import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';
import {
  Send,
  Crown,
  Users,
  Sparkles,
  MessageCircle,
  Phone,
  CheckCircle2,
  ScanLine,
  Copy,
  Check
} from 'lucide-react';

const EVENT_TYPES = [
  'تدشين الكنيسة',
  'تدشين',
  'مهرجان',
  'احتفالية',
  'يوبيل',
  'مناسبة خاصة'
];

const generateUniqueToken = () => {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timePart = Date.now().toString(36).slice(-4).toUpperCase();
  return `INV-${timePart}-${randomPart}`;
};

const normalizePhoneWa = (phone = '') => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('20') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 11) return '2' + digits;
  if (digits.length === 10 && digits.startsWith('1')) return '20' + digits;
  return digits;
};

export default function EventInvitationSender({
  currentUser,
  users = [],
  services = [],
  onOpenScanner,
  onCreated
}) {
  const canCreateInvites = ['admin', 'priest'].includes(currentUser?.role);

  const [eventType, setEventType] = useState('تدشين الكنيسة');
  const [eventTitle, setEventTitle] = useState('');
  const [inviteTier, setInviteTier] = useState('general'); // 'vip' | 'general'
  const [seatOrZone, setSeatOrZone] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  // 'all_parish' | 'service' | 'selected_users'
  const [audienceMode, setAudienceMode] = useState('all_parish');
  const [selectedServiceToken, setSelectedServiceToken] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  const [sending, setSending] = useState(false);
  const [sentBatch, setSentBatch] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  const serviceOptions = useMemo(() => {
    const set = new Set();
    services.forEach((s) => {
      if (s.class_name) set.add(s.class_name.trim());
      if (s.stage_name) set.add(s.stage_name.trim());
    });
    users.forEach((u) => {
      if (u.assigned_class) set.add(u.assigned_class.trim());
      if (u.detailed_stage) set.add(u.detailed_stage.trim());
      if (u.service_stage) set.add(u.service_stage.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [services, users]);

  const targetRecipients = useMemo(() => {
    const basePool = users.filter((u) => u.id !== currentUser?.id);

    if (audienceMode === 'all_parish') {
      return basePool;
    }

    if (audienceMode === 'service') {
      if (!selectedServiceToken) return [];
      const q = selectedServiceToken.trim().toLowerCase();
      return basePool.filter((u) =>
        [u.assigned_class, u.detailed_stage, u.service_stage, u.general_service_name]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(q))
      );
    }

    return basePool.filter((u) => selectedUserIds.includes(u.id));
  }, [users, currentUser?.id, audienceMode, selectedServiceToken, selectedUserIds]);

  const filteredSearchUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users
      .filter((u) => u.id !== currentUser?.id)
      .filter((u) => {
        if (!q) return true;
        return (
          (u.full_name || '').toLowerCase().includes(q) ||
          (u.phone || '').toLowerCase().includes(q) ||
          (u.assigned_class || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 60);
  }, [users, currentUser?.id, userSearch]);

  const toggleSelectUser = (uid) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const buildInviteMessage = (inv) => {
    const tierLabel = inv.invite_tier === 'vip' ? '👑 دعوة VIP خاصة' : '👥 دعوة عامة';
    return [
      `✝ ${inv.event_type || 'دعوة كنسية'}: *${inv.event_title}*`,
      `${tierLabel}`,
      `أهلاً بك يا *${inv.recipient_name}*، يسعدنا حضورك ومشاركتنا.`,
      inv.event_date ? `📅 التاريخ: ${inv.event_date}` : '',
      inv.event_time ? `⏰ الموعد: ${inv.event_time}` : '',
      inv.location ? `📍 المكان: ${inv.location}` : '',
      inv.seat_or_zone ? `🪑 التسكين / المكان: ${inv.seat_or_zone}` : '',
      `🎫 كود الدعوة (QR): *${inv.qr_token}*`,
      inv.notes ? `📌 ملاحظات: ${inv.notes}` : ''
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleSendInvitations = async (e) => {
    e.preventDefault();

    if (!canCreateInvites) {
      alert('🔒 إنشاء وإرسال الدعوات متاح للأب الكاهن والسوبر أدمن فقط.');
      return;
    }

    if (!eventTitle.trim()) {
      alert('اكتب اسم المناسبة أولاً');
      return;
    }

    if (targetRecipients.length === 0) {
      alert('اختر مدعوين أولاً (الشعب بالكامل أو خدمة أو أشخاص محددين)');
      return;
    }

    setSending(true);
    try {
      const payloadRows = targetRecipients.map((person) => ({
        event_type: eventType,
        event_title: eventTitle.trim(),
        invite_tier: inviteTier,
        seat_or_zone: seatOrZone.trim() || (inviteTier === 'vip' ? 'منطقة VIP' : 'صحن الكنيسة / القاعة'),
        event_date: eventDate.trim(),
        event_time: eventTime.trim(),
        location: location.trim(),
        notes: notes.trim(),
        recipient_user_id: person.id,
        recipient_name: person.full_name || 'مدعو',
        recipient_phone: person.phone || '',
        qr_token: generateUniqueToken(),
        status: 'sent',
        created_by: currentUser?.full_name || 'الأب الكاهن'
      }));

      const { data, error } = await supabase
        .from('church_invitations')
        .insert(payloadRows)
        .select();

      if (error) {
        alert('تعذر إرسال الدعوات: ' + error.message);
        return;
      }

      const createdList = Array.isArray(data) && data.length > 0 ? data : payloadRows;
      setSentBatch(createdList);

      logActivity({
        user: currentUser,
        actionType: 'إرسال_دعوات_مناسبة',
        targetTable: 'church_invitations',
        description: `أرسل ${createdList.length} دعوة (${inviteTier === 'vip' ? 'VIP' : 'عامة'}) لمناسبة: ${eventTitle.trim()}`
      });

      if (onCreated) onCreated(createdList);
      alert(`تم إرسال (${createdList.length}) دعوة إلى نوتيفيكيشن المدعوين بنجاح ✅`);
    } finally {
      setSending(false);
    }
  };

  const handleCopyText = async (inv) => {
    try {
      await navigator.clipboard.writeText(buildInviteMessage(inv));
      setCopiedId(inv.id || inv.qr_token);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4 text-xs" dir="rtl">
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-[#7a1c24] flex items-center gap-2">
            <Sparkles size={19} /> دعوات المناسبات (تدشين، مهرجان، احتفالية، يوبيل)
          </h2>
          <p className="text-gray-500 mt-0.5">
            إرسال دعوات VIP أو عامة للشعب أو لفئة محددة مباشرة إلى النوتيفيكيشن مع QR Code وواتساب/موبايل
          </p>
        </div>

        {onOpenScanner && (
          <button
            type="button"
            onClick={onOpenScanner}
            className="px-4 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-2xl font-black flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <ScanLine size={16} /> سكان QR للدعوات
          </button>
        )}
      </div>

      {!canCreateInvites ? (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 p-4 rounded-3xl font-bold flex items-center justify-between gap-3">
          <span>
            بند «دعوة» يظهر للكهنة والخدام، وإنشاء وإرسال الدعوات الرسمية/VIP مخصص للأب الكاهن؛ يمكنك استخدام سكان الـ QR لتنظيم الدخول.
          </span>
          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="px-3.5 py-2 bg-[#7a1c24] text-white rounded-xl font-black shrink-0 cursor-pointer"
            >
              فتح السكان
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSendInvitations} className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">نوع المناسبة</label>
              <select
                className="w-full p-2.5 border rounded-xl bg-[#fbfaf7] font-bold outline-none focus:border-[#7a1c24]"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">اسم المناسبة</label>
              <input
                required
                placeholder="مثال: تدشين الكنيسة الجديدة أو اليوبيل الذهبي"
                className="w-full p-2.5 border rounded-xl bg-[#fbfaf7] font-bold outline-none focus:border-[#7a1c24]"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">فئة الدعوة</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInviteTier('general')}
                  className={`p-2.5 rounded-xl border font-black flex items-center justify-center gap-1.5 cursor-pointer ${
                    inviteTier === 'general'
                      ? 'bg-[#7a1c24] text-white border-[#7a1c24]'
                      : 'bg-[#fbfaf7] text-gray-700'
                  }`}
                >
                  <Users size={14} /> دعوة عامة
                </button>
                <button
                  type="button"
                  onClick={() => setInviteTier('vip')}
                  className={`p-2.5 rounded-xl border font-black flex items-center justify-center gap-1.5 cursor-pointer ${
                    inviteTier === 'vip'
                      ? 'bg-amber-400 text-[#4a0e13] border-amber-500'
                      : 'bg-[#fbfaf7] text-gray-700'
                  }`}
                >
                  <Crown size={14} /> دعوة VIP
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">التاريخ</label>
              <input
                type="date"
                className="w-full p-2.5 border rounded-xl bg-[#fbfaf7] font-bold outline-none focus:border-[#7a1c24]"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">الموعد / الساعة</label>
              <input
                placeholder="مثال: 6:00 مساءً"
                className="w-full p-2.5 border rounded-xl bg-[#fbfaf7] font-bold outline-none focus:border-[#7a1c24]"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">المكان / التسكين المخصص</label>
              <input
                placeholder={inviteTier === 'vip' ? 'مثال: الصف الأول VIP / قاعة الضيوف' : 'مثال: صحن الكنيسة الرئيسي'}
                className="w-full p-2.5 border rounded-xl bg-[#fbfaf7] font-bold outline-none focus:border-[#7a1c24]"
                value={seatOrZone}
                onChange={(e) => setSeatOrZone(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block font-bold text-gray-700 mb-1">موقع الاحتفال والكلمة / التعليمات</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  placeholder="عنوان أو مكان المناسبة"
                  className="w-full p-2.5 border rounded-xl bg-[#fbfaf7] font-bold outline-none focus:border-[#7a1c24]"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <input
                  placeholder="نص الدعوة أو تعليمات الدخول للكشاف"
                  className="w-full p-2.5 border rounded-xl bg-[#fbfaf7] font-bold outline-none focus:border-[#7a1c24]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* اختيار المدعوين دفعة واحدة */}
          <div className="bg-[#fbfaf7] border border-gray-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-gray-900">تحديد المدعوين ({targetRecipients.length} مدعو):</strong>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setAudienceMode('all_parish')}
                  className={`px-3 py-1.5 rounded-xl font-black cursor-pointer ${
                    audienceMode === 'all_parish' ? 'bg-[#7a1c24] text-white' : 'bg-white border text-gray-700'
                  }`}
                >
                  شعب الكنيسة بالكامل
                </button>
                <button
                  type="button"
                  onClick={() => setAudienceMode('service')}
                  className={`px-3 py-1.5 rounded-xl font-black cursor-pointer ${
                    audienceMode === 'service' ? 'bg-[#7a1c24] text-white' : 'bg-white border text-gray-700'
                  }`}
                >
                  خدمة / فئة معينة
                </button>
                <button
                  type="button"
                  onClick={() => setAudienceMode('selected_users')}
                  className={`px-3 py-1.5 rounded-xl font-black cursor-pointer ${
                    audienceMode === 'selected_users' ? 'bg-[#7a1c24] text-white' : 'bg-white border text-gray-700'
                  }`}
                >
                  أشخاص محددون
                </button>
              </div>
            </div>

            {audienceMode === 'service' && (
              <select
                className="w-full sm:w-80 p-2.5 border rounded-xl bg-white font-bold"
                value={selectedServiceToken}
                onChange={(e) => setSelectedServiceToken(e.target.value)}
              >
                <option value="">-- اختر الخدمة أو المرحلة --</option>
                {serviceOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {audienceMode === 'selected_users' && (
              <div className="space-y-2">
                <input
                  placeholder="ابحث بالاسم أو رقم الموبايل..."
                  className="w-full sm:w-80 p-2 border rounded-xl bg-white font-bold"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pt-1">
                  {filteredSearchUsers.map((u) => {
                    const checked = selectedUserIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer ${
                          checked ? 'bg-[#f9ecee] border-[#7a1c24] font-black' : 'bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectUser(u.id)}
                        />
                        <span className="truncate">{u.full_name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={sending}
            className="px-6 py-3 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-2xl font-black flex items-center gap-2 cursor-pointer shadow"
          >
            <Send size={16} />
            {sending ? 'جاري الإرسال...' : `إرسال الدعوات للنوتيفيكيشن (${targetRecipients.length})`}
          </button>
        </form>
      )}

      {/* قائمة الدعوات المرسلة مع أزرار واتساب والموبايل */}
      {sentBatch.length > 0 && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-emerald-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-emerald-900 font-black text-sm">
            <CheckCircle2 size={18} className="text-emerald-700" />
            <span>الدعوات المرسلة حالياً ({sentBatch.length}) — جاهزة للإرسال على واتساب أو الموبايل:</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto">
            {sentBatch.map((inv) => {
              const waNumber = normalizePhoneWa(inv.recipient_phone);
              const waUrl = waNumber
                ? `https://wa.me/${waNumber}?text=${encodeURIComponent(buildInviteMessage(inv))}`
                : '';
              const isCopied = copiedId === (inv.id || inv.qr_token);

              return (
                <div
                  key={inv.qr_token}
                  className="p-3 bg-[#fbfaf7] border rounded-2xl flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <strong className="text-gray-900 block truncate">{inv.recipient_name}</strong>
                    <span className="text-[11px] text-gray-500 font-mono">
                      {inv.invite_tier === 'vip' ? '👑 VIP' : 'عام'} • {inv.qr_token}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center gap-1"
                      >
                        <MessageCircle size={13} /> واتساب
                      </a>
                    )}
                    {inv.recipient_phone && (
                      <a
                        href={`sms:${inv.recipient_phone}?body=${encodeURIComponent(buildInviteMessage(inv))}`}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1"
                      >
                        <Phone size={13} /> موبايل
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopyText(inv)}
                      className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {isCopied ? <Check size={13} className="text-emerald-700" /> : <Copy size={13} />}
                      {isCopied ? 'تم' : 'نسخ'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
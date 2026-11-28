import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLogger';
import EventInvitationSender from './EventInvitationSender';
import { canSendChurchInvitations } from '../../lib/permissions';
import InvitationScannerModal from './InvitationScannerModal';
import SeatMapPicker from './SeatMapPicker';
import {
  MailPlus,
  ScanLine,
  Crown,
  Users,
  CheckCircle2,
  Clock,
  RefreshCw,
  MessageCircle,
  Search,
  Pencil,
  Trash2,
  X,
  Armchair
} from 'lucide-react';

const normalizePhoneWa = (phone = '') => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('20') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 11) return '2' + digits;
  if (digits.length === 10 && digits.startsWith('1')) return '20' + digits;
  return digits;
};

export default function PriestInvitationsTab({
  currentUser,
  users = [],
  services = []
}) {
  const isPriestOrAdmin = ['admin', 'priest'].includes(currentUser?.role);
  const canSendInvites = canSendChurchInvitations(currentUser);
  const canScanQr = [
    'admin',
    'priest',
    'servant',
    'head_servant',
    'vice_head_servant',
    'meeting_servant',
    'mercy_servant',
    'worker'
  ].includes(currentUser?.role);

  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [tierFilter, setTierFilter] = useState('all'); // 'all' | 'vip' | 'general'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'sent' | 'checked_in'
  const [searchTerm, setSearchTerm] = useState('');

  const [editingInvite, setEditingInvite] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadInvitations = async () => {
    if (!supabase || typeof supabase.from !== 'function') return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('church_invitations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!error && Array.isArray(data)) {
        setInvitations(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, []);

  const stats = useMemo(() => {
    const total = invitations.length;
    const vipCount = invitations.filter((i) => i.invite_tier === 'vip').length;
    const generalCount = invitations.filter((i) => i.invite_tier !== 'vip').length;
    const attendedCount = invitations.filter((i) => i.status === 'checked_in').length;
    return { total, vipCount, generalCount, attendedCount };
  }, [invitations]);

  const filteredInvitations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return invitations.filter((inv) => {
      if (tierFilter !== 'all' && (inv.invite_tier || 'general') !== tierFilter) return false;
      if (statusFilter !== 'all' && (inv.status || 'sent') !== statusFilter) return false;
      if (!q) return true;
      return (
        (inv.recipient_name || '').toLowerCase().includes(q) ||
        (inv.event_title || '').toLowerCase().includes(q) ||
        (inv.qr_token || '').toLowerCase().includes(q) ||
        (inv.seat_or_zone || '').toLowerCase().includes(q)
      );
    });
  }, [invitations, tierFilter, statusFilter, searchTerm]);

  const buildQuickWaUrl = (inv) => {
    const waNumber = normalizePhoneWa(inv.recipient_phone);
    if (!waNumber) return '';
    const msg = [
      `✝ ${inv.event_type || 'دعوة كنسية'}: *${inv.event_title}*`,
      inv.invite_tier === 'vip' ? '👑 دعوة VIP خاصة' : '👥 دعوة عامة',
      `أهلاً بك يا *${inv.recipient_name}*، يسعدنا حضورك.`,
      inv.seat_or_zone ? `🪑 المكان / الكرسي: ${inv.seat_or_zone}` : '',
      `🎫 كود الدعوة (QR): *${inv.qr_token}*`
    ]
      .filter(Boolean)
      .join('\n');
    return `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingInvite?.id) return;
    setSavingEdit(true);
    try {
      const updatePayload = {
        event_title: (editingInvite.event_title || '').trim(),
        invite_tier: editingInvite.invite_tier || 'general',
        seat_or_zone: (editingInvite.seat_or_zone || '').trim(),
        event_date: (editingInvite.event_date || '').trim(),
        event_time: (editingInvite.event_time || '').trim(),
        location: (editingInvite.location || '').trim(),
        notes: (editingInvite.notes || '').trim(),
        status: editingInvite.status || 'sent'
      };

      const { error } = await supabase
        .from('church_invitations')
        .update(updatePayload)
        .eq('id', editingInvite.id);

      if (error) {
        alert('تعذر تعديل الدعوة: ' + error.message);
        return;
      }

      setInvitations((prev) =>
        prev.map((row) => (row.id === editingInvite.id ? { ...row, ...updatePayload } : row))
      );

      logActivity({
        user: currentUser,
        actionType: 'تعديل_دعوة_مناسبة',
        targetTable: 'church_invitations',
        targetId: editingInvite.id,
        description: `عدّل دعوة (${editingInvite.recipient_name}) لمناسبة: ${updatePayload.event_title}`
      });

      setEditingInvite(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteInvite = async (inv) => {
    const rowKey = inv.id || inv.qr_token;
    if (!confirm(`هل تريد حذف دعوة (${inv.recipient_name}) لكود (${inv.qr_token}) نهائياً؟`)) return;
    setDeletingId(rowKey);
    try {
      let query = supabase.from('church_invitations').delete();
      if (inv.id) {
        query = query.eq('id', inv.id);
      } else {
        query = query.eq('qr_token', inv.qr_token);
      }

      const { error } = await query;
      if (error) {
        alert('تعذر حذف الدعوة: ' + error.message);
        return;
      }

      setInvitations((prev) => prev.filter((item) => (item.id || item.qr_token) !== rowKey));

      logActivity({
        user: currentUser,
        actionType: 'حذف_دعوة_مناسبة',
        targetTable: 'church_invitations',
        targetId: inv.id || null,
        description: `حذف دعوة (${inv.recipient_name}) بكود: ${inv.qr_token}`
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 text-xs" dir="rtl">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3.5 rounded-2xl border shadow-2xs">
          <span className="text-gray-500 block font-bold">إجمالي الدعوات</span>
          <strong className="text-lg font-black text-[#7a1c24]">{stats.total}</strong>
        </div>
        <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
          <span className="text-amber-900 block font-bold flex items-center gap-1">
            <Crown size={13} /> دعوات VIP
          </span>
          <strong className="text-lg font-black text-amber-950">{stats.vipCount}</strong>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border shadow-2xs">
          <span className="text-gray-500 block font-bold flex items-center gap-1">
            <Users size={13} /> دعوات عامة
          </span>
          <strong className="text-lg font-black text-gray-800">{stats.generalCount}</strong>
        </div>
        <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
          <span className="text-emerald-900 block font-bold flex items-center gap-1">
            <CheckCircle2 size={13} /> تم المسح / الحضور
          </span>
          <strong className="text-lg font-black text-emerald-800">{stats.attendedCount}</strong>
        </div>
      </div>

      {canSendInvites ? (
        <EventInvitationSender
          currentUser={currentUser}
          users={users}
          services={services}
          onCreated={() => loadInvitations()}
        />
      ) : (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 p-4 rounded-3xl font-bold flex flex-wrap items-center justify-between gap-3">
          <span>
            إرسال الدعوات خاص بالأب الكاهن وأمين الخدمة ومساعده، ودورك هو مسح الـ QR Code وتنظيم دخول المدعوين.
          </span>
          {canScanQr && (
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="px-4 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
            >
              <ScanLine size={15} /> سكان QR للدعوات
            </button>
          )}
        </div>
      )}

      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[#7a1c24]">
            <MailPlus size={18} />
            <h3 className="text-sm font-black">سجل الدعوات ومتابعة الدخول ({filteredInvitations.length})</h3>
          </div>

          <div className="flex items-center gap-2">
            {canScanQr && !isPriestOrAdmin && (
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="px-3 py-1.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center gap-1 cursor-pointer"
              >
                <ScanLine size={14} /> سكان QR
              </button>
            )}
            <button
              type="button"
              onClick={loadInvitations}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative">
            <Search size={14} className="absolute right-3 top-2.5 text-gray-400" />
            <input
              placeholder="بحث بالاسم أو المناسبة أو كود QR أو الكرسي..."
              className="w-full pr-8 pl-3 py-2 border rounded-xl bg-[#fbfaf7] font-bold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="p-2 border rounded-xl bg-[#fbfaf7] font-bold"
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
          >
            <option value="all">كل الفئات (VIP وعامة)</option>
            <option value="vip">👑 دعوات VIP فقط</option>
            <option value="general">👥 دعوات عامة فقط</option>
          </select>

          <select
            className="p-2 border rounded-xl bg-[#fbfaf7] font-bold"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">كل الحالات</option>
            <option value="sent">بانتظار الدخول</option>
            <option value="checked_in">تم الدخول (Checked-in)</option>
          </select>
        </div>

        {filteredInvitations.length === 0 ? (
          <div className="p-6 text-center text-gray-400 bg-[#fbfaf7] rounded-2xl border border-dashed">
            لا توجد دعوات مطابقة للفلتر الحالي.
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-2xl">
            <table className="w-full text-right">
              <thead className="bg-gray-100 text-gray-800">
                <tr>
                  <th className="p-2.5">المدعو</th>
                  <th className="p-2.5">المناسبة</th>
                  <th className="p-2.5">الفئة</th>
                  <th className="p-2.5">المكان / الكرسي</th>
                  <th className="p-2.5">كود QR</th>
                  <th className="p-2.5">الحالة</th>
                  <th className="p-2.5">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {filteredInvitations.map((inv) => {
                  const rowKey = inv.id || inv.qr_token;
                  const isVip = inv.invite_tier === 'vip';
                  const isChecked = inv.status === 'checked_in';
                  const waUrl = buildQuickWaUrl(inv);

                  return (
                    <tr key={rowKey} className="hover:bg-[#fbfaf7]">
                      <td className="p-2.5 font-bold text-gray-900">{inv.recipient_name}</td>
                      <td className="p-2.5">{inv.event_title}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                            isVip ? 'bg-amber-400 text-[#4a0e13]' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {isVip ? '👑 VIP' : 'عام'}
                        </span>
                      </td>
                      <td className="p-2.5 text-[#7a1c24] font-bold">
                        {inv.seat_or_zone ? (
                          <span className="inline-flex items-center gap-1">
                            <Armchair size={12} /> {inv.seat_or_zone}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-[11px] font-bold">{inv.qr_token}</td>
                      <td className="p-2.5">
                        {isChecked ? (
                          <span className="text-emerald-700 font-black flex items-center gap-1">
                            <CheckCircle2 size={13} /> دخل
                          </span>
                        ) : (
                          <span className="text-amber-700 font-bold flex items-center gap-1">
                            <Clock size={13} /> مرسلة
                          </span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold"
                            >
                              <MessageCircle size={12} /> واتساب
                            </a>
                          )}
                          {canSendInvites && (
                            <button
                              type="button"
                              onClick={() => setEditingInvite({ ...inv })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg font-bold cursor-pointer"
                            >
                              <Pencil size={12} /> تعديل
                            </button>
                          )}
                          {isPriestOrAdmin && (
                            <button
                              type="button"
                              disabled={deletingId === rowKey}
                              onClick={() => handleDeleteInvite(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-bold cursor-pointer"
                            >
                              <Trash2 size={12} /> {deletingId === rowKey ? '...' : 'حذف'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingInvite && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92dvh] overflow-y-auto p-5 space-y-3 text-xs font-bold">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-black text-sm text-[#7a1c24]">
                تعديل دعوة: {editingInvite.recipient_name} ({editingInvite.qr_token})
              </h3>
              <button
                type="button"
                onClick={() => setEditingInvite(null)}
                className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block mb-1 text-gray-700">اسم المناسبة</label>
                <input
                  required
                  className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
                  value={editingInvite.event_title || ''}
                  onChange={(e) => setEditingInvite({ ...editingInvite, event_title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-gray-700">الفئة</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
                    value={editingInvite.invite_tier || 'general'}
                    onChange={(e) => setEditingInvite({ ...editingInvite, invite_tier: e.target.value })}
                  >
                    <option value="general">دعوة عامة</option>
                    <option value="vip">دعوة VIP</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-gray-700">حالة الدعوة</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
                    value={editingInvite.status || 'sent'}
                    onChange={(e) => setEditingInvite({ ...editingInvite, status: e.target.value })}
                  >
                    <option value="sent">مرسلة / بانتظار الدخول</option>
                    <option value="checked_in">تم الدخول</option>
                  </select>
                </div>
              </div>

              <SeatMapPicker
                value={editingInvite.seat_or_zone || ''}
                onChange={(seat) => setEditingInvite({ ...editingInvite, seat_or_zone: seat })}
                eventTitle={editingInvite.event_title}
                eventDate={editingInvite.event_date}
                excludeId={editingInvite.id}
                canEditLayout={isPriestOrAdmin}
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-gray-700">التاريخ</label>
                  <input
                    type="date"
                    className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
                    value={editingInvite.event_date || ''}
                    onChange={(e) => setEditingInvite({ ...editingInvite, event_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-gray-700">الموعد</label>
                  <input
                    className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
                    value={editingInvite.event_time || ''}
                    onChange={(e) => setEditingInvite({ ...editingInvite, event_time: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-gray-700">ملاحظات</label>
                <input
                  className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
                  value={editingInvite.notes || ''}
                  onChange={(e) => setEditingInvite({ ...editingInvite, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingInvite(null)}
                  className="px-4 py-2 border rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer"
                >
                  {savingEdit ? 'جاري الحفظ...' : 'حفظ التعديل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scannerOpen && canScanQr && (
        <InvitationScannerModal
          currentUser={currentUser}
          onClose={() => {
            setScannerOpen(false);
            loadInvitations();
          }}
        />
      )}
    </div>
  );
}
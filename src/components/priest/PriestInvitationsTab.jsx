import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import EventInvitationSender from './EventInvitationSender';
import InvitationScannerModal from './InvitationScannerModal';
import {
  MailPlus,
  ScanLine,
  Crown,
  Users,
  CheckCircle2,
  Clock,
  RefreshCw,
  MessageCircle,
  Search
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
  const canScanQr = ['admin', 'priest', 'servant', 'head_servant', 'vice_head_servant', 'meeting_servant', 'mercy_servant', 'worker'].includes(currentUser?.role);

  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [tierFilter, setTierFilter] = useState('all'); // 'all' | 'vip' | 'general'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'sent' | 'checked_in'
  const [searchTerm, setSearchTerm] = useState('');

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
      inv.seat_or_zone ? `🪑 المكان: ${inv.seat_or_zone}` : '',
      `🎫 كود الدعوة (QR): *${inv.qr_token}*`
    ]
      .filter(Boolean)
      .join('\n');
    return `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-4 text-xs" dir="rtl">
      {/* إحصائيات الدعوات ومتابعة الحضور */}
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

      {/* إرسال الدعوات للأب الكاهن فقط */}
      {isPriestOrAdmin ? (
        <EventInvitationSender
          currentUser={currentUser}
          users={users}
          services={services}
          onCreated={() => loadInvitations()}
        />
      ) : (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 p-4 rounded-3xl font-bold flex flex-wrap items-center justify-between gap-3">
          <span>
            إرسال الدعوات خاص بالأب الكاهن، ودور الكشافة والخدام هو مسح الـ QR Code وتنظيم دخول المدعوين.
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

      {/* سجل متابعة الدعوات وحالة الدخول */}
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
              placeholder="بحث بالاسم أو المناسبة أو كود QR..."
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
                  <th className="p-2.5">المكان</th>
                  <th className="p-2.5">كود QR</th>
                  <th className="p-2.5">الحالة</th>
                  <th className="p-2.5">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {filteredInvitations.map((inv) => {
                  const isVip = inv.invite_tier === 'vip';
                  const isChecked = inv.status === 'checked_in';
                  const waUrl = buildQuickWaUrl(inv);

                  return (
                    <tr key={inv.id || inv.qr_token} className="hover:bg-[#fbfaf7]">
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
                      <td className="p-2.5 text-gray-600">{inv.seat_or_zone || '—'}</td>
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
                        {waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold"
                          >
                            <MessageCircle size={12} /> واتساب
                          </a>
                        ) : (
                          <span className="text-gray-400 text-[11px]">لا يوجد رقم</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* نافذة السكان للكشافة والخدام */}
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
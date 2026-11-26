import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Bell, RefreshCw, Clock, UserCheck, Ticket, Eye, X } from 'lucide-react';

function formatDateTimeAr(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return String(isoStr);
  return d.toLocaleString('ar-EG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function NotificationsDataPanel({ currentUser, onOpenItem }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const loadNotificationsData = useCallback(async () => {
    if (!currentUser?.id || !supabase || typeof supabase.from !== 'function') return;
    setLoading(true);
    try {
      const merged = [];

      // 1) جلب آخر الدعوات المرتبطة بالمستخدم أو الحديثة للخدام/الأدمن
      const { data: invites } = await supabase
        .from('church_invitations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

      if (Array.isArray(invites)) {
        invites.forEach((inv) => {
          merged.push({
            id: `inv-${inv.id}`,
            kind: 'invitation',
            title: inv.event_title || 'دعوة مناسبة',
            summary: `المدعو: ${inv.recipient_name || '—'} • الحالة: ${
              inv.status === 'checked_in' ? 'حضر (Scan)' : 'بانتظار الدخول'
            }`,
            actor: inv.checked_in_by || 'النظام',
            timestamp: inv.checked_in_at || inv.created_at,
            raw: inv
          });
        });
      }

      // 2) جلب آخر سجلات الحضور والانصراف إن وجد الجدول
      const { data: logs, error: logsErr } = await supabase
        .from('church_attendance_logs')
        .select('*')
        .order('checked_in_at', { ascending: false })
        .limit(15);

      if (!logsErr && Array.isArray(logs)) {
        logs.forEach((log) => {
          const isOut = Boolean(log.checked_out_at);
          merged.push({
            id: `att-${log.id}`,
            kind: 'attendance',
            title: `${log.full_name} — ${isOut ? 'انصراف' : 'حضور'}`,
            summary: isOut
              ? `حضور: ${formatDateTimeAr(log.checked_in_at)} | انصراف: ${formatDateTimeAr(log.checked_out_at)}`
              : `حضور: ${formatDateTimeAr(log.checked_in_at)}`,
            actor: isOut ? log.checked_out_by || 'مسؤول' : log.checked_in_by || 'مسؤول',
            timestamp: log.checked_out_at || log.checked_in_at,
            raw: log
          });
        });
      }

      merged.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      setItems(merged.slice(0, 20));
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadNotificationsData();
  }, [loadNotificationsData]);

  if (!currentUser) return null;

  return (
    <div
      className="bg-white border-2 border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3 text-xs"
      dir="rtl"
    >
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2 text-[#7a1c24]">
          <Bell size={18} />
          <div>
            <h3 className="text-sm font-black">
              تفاصيل الإشعارات والبيانات ({items.length})
            </h3>
            <p className="text-[11px] text-gray-500">
              عرض البيانات التفصيلية لكل إشعار بدلاً من الاكتفاء بالأرقام فقط.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadNotificationsData}
          className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center text-gray-400 bg-slate-50 rounded-2xl border border-dashed">
          {loading ? 'جاري تحميل البيانات...' : 'لا توجد بيانات إشعارات متاحة حالياً.'}
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-2xl border bg-[#fbfaf7] hover:bg-white transition flex flex-wrap items-center justify-between gap-2"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-black text-gray-900">
                  {item.kind === 'invitation' ? (
                    <Ticket size={14} className="text-[#7a1c24] shrink-0" />
                  ) : (
                    <UserCheck size={14} className="text-emerald-700 shrink-0" />
                  )}
                  <span className="truncate">{item.title}</span>
                </div>
                <p className="text-[11px] text-gray-700 font-bold">{item.summary}</p>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} /> {formatDateTimeAr(item.timestamp)}
                  </span>
                  <span>بواسطة: {item.actor}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedItem(item);
                  if (typeof onOpenItem === 'function') onOpenItem(item);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#7a1c24] hover:bg-[#5c1319] text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Eye size={12} /> عرض الداتا
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedItem && (
        <div className="p-3.5 rounded-2xl bg-slate-900 text-slate-100 space-y-2 border border-slate-700">
          <div className="flex items-center justify-between">
            <strong className="text-xs font-black text-emerald-400">
              تفاصيل السجل: {selectedItem.title}
            </strong>
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <pre className="text-[11px] overflow-x-auto bg-slate-950 p-2.5 rounded-xl font-mono text-slate-200">
            {JSON.stringify(selectedItem.raw, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
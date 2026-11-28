import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Database, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

// كل الجداول اللي التطبيق بيقرا منها (مستخرجة من الكود)
export const APP_TABLES = [
  'church_users', 'church_public_content', 'church_notifications', 'church_notification_reads', 'church_invitations',
  'church_trips', 'trip_registrations', 'trip_payments', 'church_events', 'church_services', 'church_settings',
  'church_general_settings', 'church_hall_settings', 'church_visitations', 'church_attendance_logs', 'church_priest_schedules',
  'service_settings', 'service_groups', 'service_group_posts', 'services', 'role_screens', 'nested_cards', 'visitation_streets',
  'priest_custom_entries', 'priest_custom_cards', 'priest_personal_schedule', 'priest_family_visitations', 'priest_masses',
  'priest_invitations', 'priest_confession_slots', 'confession_bookings', 'confession_sessions_history',
  'pastoral_families', 'family_attachments', 'family_children', 'user_children', 'member_siblings', 'member_notes',
  'servant_member_notes', 'spiritual_notes', 'member_activities', 'member_rewards', 'reward_campaigns', 'case_categories',
  'impediment_clearances', 'baptism_records', 'deacon_ordinations', 'deacon_schedules', 'deacon_ranks',
  'joseph_arimathea_cases', 'joseph_memorial_requests', 'joseph_audio_tracks', 'funeral_caskets', 'burial_locations',
  'edu_teachers', 'edu_teacher_attendance', 'edu_teacher_payouts', 'edu_subjects', 'edu_student_attendance', 'edu_lessons', 'edu_bookings',
  'whatsapp_templates', 'liturgy_books', 'katameros_readings', 'agpeya_prayers', 'synaxarium_entries',
  'user_sessions', 'activity_logs', 'push_subscriptions', 'site_visitor_stats', 'receipts', 'attendance_records',
  'v_parent_member_commitment'
];

export default function AdminDbHealth() {
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const out = [];
    for (let i = 0; i < APP_TABLES.length; i += 8) {
      const chunk = APP_TABLES.slice(i, i + 8);
      const res = await Promise.all(chunk.map(async (t) => {
        const started = Date.now();
        try {
          const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
          return { table: t, ok: !error, count, error: error?.message || '', ms: Date.now() - started };
        } catch (e) {
          return { table: t, ok: false, count: null, error: String(e?.message || e), ms: Date.now() - started };
        }
      }));
      out.push(...res);
      setResults([...out]);
    }
    setRunning(false);
  };

  const okCount = results ? results.filter(r => r.ok).length : 0;
  const bad = results ? results.filter(r => !r.ok) : [];

  return (
    <div className="space-y-3 text-xs">
      <div className="bg-white p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5"><Database size={16} /> فحص ربط الداتابيز</h3>
          <p className="text-gray-600 mt-0.5">بيجرّب القراءة من كل جدول التطبيق بيستخدمه، ويقولك مين شغال ومين ناقص أو ممنوع. قراءة فقط، من غير أي تعديل.</p>
        </div>
        <button type="button" onClick={run} disabled={running} className="px-4 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] disabled:opacity-60 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer">
          <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> {running ? 'جاري الفحص...' : 'ابدأ الفحص'}
        </button>
      </div>

      {results && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border rounded-2xl p-3 text-center"><b className="block text-xl text-gray-900">{results.length}</b>تم فحصه</div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center"><b className="block text-xl text-emerald-800">{okCount}</b>سليم</div>
            <div className={`rounded-2xl p-3 text-center border ${bad.length ? 'bg-red-50 border-red-300' : 'bg-white'}`}><b className={`block text-xl ${bad.length ? 'text-red-700' : 'text-gray-900'}`}>{bad.length}</b>مشكلة</div>
          </div>

          {bad.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 space-y-1.5">
              <strong className="text-red-900">⚠️ جداول فيها مشكلة (ناقصة أو ممنوعة بسياسة RLS):</strong>
              {bad.map(r => (
                <div key={r.table} className="bg-white rounded-xl border p-2">
                  <b dir="ltr" className="text-red-800">{r.table}</b>
                  <div className="text-[11px] text-gray-600 break-words">{r.error}</div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border rounded-2xl divide-y max-h-[60dvh] overflow-y-auto">
            {results.map(r => (
              <div key={r.table} className="px-3 py-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  {r.ok ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> : <XCircle size={14} className="text-red-600 shrink-0" />}
                  <b dir="ltr" className="truncate">{r.table}</b>
                </span>
                <span className="text-gray-500 shrink-0">{r.ok ? `${r.count ?? 0} صف • ${r.ms}ms` : 'فشل'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

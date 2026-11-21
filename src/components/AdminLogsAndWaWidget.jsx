
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDuration } from '../lib/activityLogger';
import { Shield, MessageCircle, Trash2, Lock, Unlock, UserCheck, UserX } from 'lucide-react';

export default function AdminLogsAndWaWidget({ currentUser, priests = [], allUsers = [], onRefreshUsers }) {
  const [tab, setTab] = useState('who_logged'); // 'who_logged' | 'sessions' | 'actions' | 'wa_perms'
  const [sessions, setSessions] = useState([]);
  const [actions, setActions] = useState([]);
  const [globalTpls, setGlobalTpls] = useState([]);
  const [search, setSearch] = useState('');
  const [tplForm, setTplForm] = useState({ category: 'افتقاد', title: '', message_body: '' });

  const isAdmin = currentUser?.role === 'admin';

  const loadData = async () => {
    if (!isAdmin) return;
    const [ss, al, wt] = await Promise.all([
      supabase.from('user_sessions').select('*').order('opened_at', { ascending: false }).limit(200),
      supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('whatsapp_templates').select('*').is('priest_id', null).order('created_at', { ascending: true })
    ]);
    if (ss.data) setSessions(ss.data);
    if (al.data) setActions(al.data);
    if (wt.data) setGlobalTpls(wt.data);
  };

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  // حماية صارمة: لا يظهر اللوج ولا صلاحيات الأدمن لأي يوزر غير الأدمن
  if (!isAdmin) return null;

  const formatDateTime = (dt) => {
    if (!dt) return '—';
    try {
      return new Date(dt).toLocaleString('ar-EG');
    } catch {
      return dt;
    }
  };

  const togglePriestWaPerm = async (priest) => {
    const nextVal = priest.can_manage_wa_templates === false ? true : false;
    const { error } = await supabase
      .from('church_users')
      .update({ can_manage_wa_templates: nextVal })
      .eq('id', priest.id);
    if (error) return alert('خطأ في تحديث الصلاحية: ' + error.message);
    if (onRefreshUsers) onRefreshUsers();
  };

  const addGlobalTemplate = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .insert([{ ...tplForm, priest_id: null, created_by: currentUser.id }])
      .select().single();
    if (error) return alert('خطأ في حفظ القالب: ' + error.message);
    if (data) {
      setGlobalTpls([...globalTpls, data]);
      setTplForm({ category: 'افتقاد', title: '', message_body: '' });
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const usersPool = allUsers.length > 0 ? allUsers : priests;
  const searchLower = search.toLowerCase();

  const userLoginStats = usersPool
    .filter(u => ((u.full_name || '') + ' ' + (u.role || '')).toLowerCase().includes(searchLower))
    .map(u => {
      const uSessions = sessions.filter(s => s.user_id === u.id);
      const lastSession = uSessions[0] || null;
      const enteredToday = uSessions.some(s => (s.opened_at || '').startsWith(todayStr));
      return { user: u, uSessions, lastSession, enteredToday };
    });

  return (
    <div className="bg-white p-5 rounded-3xl border space-y-4 text-xs md:text-sm" dir="rtl">
      <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3">
        <strong className="text-base font-black text-[#7a1c24] flex items-center gap-2">
          <Shield size={18} /> ملف السجلات الكامل ومراقبة الدخول وصلاحيات الواتساب (خاص بالأدمن فقط)
        </strong>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setTab('who_logged')} className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${tab === 'who_logged' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100'}`}>👥 مين دخل ومين مدخلش</button>
          <button type="button" onClick={() => setTab('sessions')} className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${tab === 'sessions' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100'}`}>⏱️ الجلسات والأجهزة ({sessions.length})</button>
          <button type="button" onClick={() => setTab('actions')} className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${tab === 'actions' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100'}`}>⚡ الإجراءات ({actions.length})</button>
          <button type="button" onClick={() => setTab('wa_perms')} className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${tab === 'wa_perms' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100'}`}>💬 صلاحيات وقوالب الواتساب</button>
          <button type="button" onClick={loadData} className="px-3 py-1.5 bg-slate-800 text-white rounded-xl font-bold cursor-pointer">تحديث</button>
        </div>
      </div>

      {tab !== 'wa_perms' && (
        <input
          placeholder="ابحث بالاسم أو نوع الجهاز أو الإجراء..."
          className="w-full p-2.5 border rounded-xl text-xs"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      )}

      {tab === 'who_logged' && (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-2">الاسم</th>
                <th className="p-2">الصلاحية</th>
                <th className="p-2">الحالة اليوم</th>
                <th className="p-2">آخر دخول وجهاز</th>
                <th className="p-2">عدد الجلسات</th>
              </tr>
            </thead>
            <tbody>
              {userLoginStats.map(({ user, uSessions, lastSession, enteredToday }) => (
                <tr key={user.id} className="border-b">
                  <td className="p-2 font-bold">{user.full_name}</td>
                  <td className="p-2 text-gray-600">{user.role}</td>
                  <td className="p-2">
                    {enteredToday ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-900 rounded font-bold inline-flex items-center gap-1"><UserCheck size={12} /> دخل اليوم</span>
                    ) : lastSession ? (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold">لم يدخل اليوم</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-red-100 text-red-900 rounded font-bold inline-flex items-center gap-1"><UserX size={12} /> لم يفتح الموقع مطلقاً</span>
                    )}
                  </td>
                  <td className="p-2">
                    {lastSession ? `${formatDateTime(lastSession.opened_at)} (${lastSession.device_type})` : '—'}
                  </td>
                  <td className="p-2 font-black">{uSessions.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'sessions' && (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-2">المستخدم</th>
                <th className="p-2">الجهاز</th>
                <th className="p-2">الفتح</th>
                <th className="p-2">القفل / آخر نشاط</th>
                <th className="p-2">المدة</th>
              </tr>
            </thead>
            <tbody>
              {sessions
                .filter(s => ((s.user_name || '') + ' ' + (s.device_type || '') + ' ' + (s.os_browser || '')).toLowerCase().includes(searchLower))
                .map(s => (
                  <tr key={s.id} className="border-b">
                    <td className="p-2 font-bold">{s.user_name} ({s.user_role})</td>
                    <td className="p-2">{s.device_type} • {s.os_browser}</td>
                    <td className="p-2">{formatDateTime(s.opened_at)}</td>
                    <td className="p-2">{s.closed_at ? formatDateTime(s.closed_at) : 'نشط الآن'}</td>
                    <td className="p-2 font-black text-emerald-700">{formatDuration(s.duration_seconds)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'actions' && (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-2">الوقت</th>
                <th className="p-2">المستخدم</th>
                <th className="p-2">الجهاز</th>
                <th className="p-2">الإجراء</th>
                <th className="p-2">الوصف</th>
              </tr>
            </thead>
            <tbody>
              {actions
                .filter(a => ((a.user_name || '') + ' ' + (a.action_type || '') + ' ' + (a.description || '') + ' ' + (a.device_type || '')).toLowerCase().includes(searchLower))
                .map(a => (
                  <tr key={a.id} className="border-b">
                    <td className="p-2">{formatDateTime(a.created_at)}</td>
                    <td className="p-2 font-bold">{a.user_name}</td>
                    <td className="p-2">{a.device_type}</td>
                    <td className="p-2 font-bold text-[#7a1c24]">{a.action_type}</td>
                    <td className="p-2">{a.description}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'wa_perms' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <strong className="block text-gray-800">صلاحية تعديل وإضافة قوالب الواتساب للآباء الكهنة:</strong>
            {priests.map(p => {
              const allowed = p.can_manage_wa_templates !== false;
              return (
                <div key={p.id} className="p-3 bg-gray-50 rounded-2xl border flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <strong className="text-sm">{p.full_name}</strong>
                    <span className="block text-xs text-gray-500">رقم الواتساب: {p.whatsapp_sender_phone || p.phone || 'غير مسجل'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePriestWaPerm(p)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer ${allowed ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}
                  >
                    {allowed ? <><Unlock size={14} /> مسموح لأبونا بإضافة/تعديل القوالب</> : <><Lock size={14} /> مغلق (يختار من القوالب فقط)</>}
                  </button>
                </div>
              );
            })}
          </div>

          <form onSubmit={addGlobalTemplate} className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 space-y-2">
            <strong className="text-amber-950 block"><MessageCircle size={15} className="inline ml-1" /> إضافة قالب واتساب عام (يظهر لكل الآباء الكهنة):</strong>
            <div className="grid sm:grid-cols-2 gap-2">
              <select className="p-2 border rounded-xl bg-white" value={tplForm.category} onChange={e => setTplForm({ ...tplForm, category: e.target.value })}>
                <option value="افتقاد">افتقاد</option>
                <option value="معايدة">معايدة</option>
                <option value="أعياد ومناسبات">أعياد ومناسبات</option>
                <option value="تعزية">تعزية</option>
                <option value="متابعة اعتراف">متابعة اعتراف</option>
                <option value="أخرى">أخرى</option>
              </select>
              <input required placeholder="عنوان الرسالة..." className="p-2 border rounded-xl bg-white" value={tplForm.title} onChange={e => setTplForm({ ...tplForm, title: e.target.value })} />
            </div>
            <textarea required rows="2" placeholder="نص الرسالة... استخدم {الاسم} و {الأب}" className="w-full p-2 border rounded-xl bg-white" value={tplForm.message_body} onChange={e => setTplForm({ ...tplForm, message_body: e.target.value })} />
            <button type="submit" className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl font-bold cursor-pointer">+ حفظ القالب العام</button>
          </form>

          <div className="space-y-1.5">
            {globalTpls.map(t => (
              <div key={t.id} className="p-2.5 bg-white border rounded-xl flex justify-between items-center gap-2 text-xs">
                <div><span className="px-2 py-0.5 bg-green-100 rounded ml-1">{t.category}</span> <strong>{t.title}:</strong> {t.message_body}</div>
                <button type="button" onClick={async () => { await supabase.from('whatsapp_templates').delete().eq('id', t.id); setGlobalTpls(globalTpls.filter(x => x.id !== t.id)); }} className="p-1.5 bg-red-50 text-red-700 rounded-lg"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
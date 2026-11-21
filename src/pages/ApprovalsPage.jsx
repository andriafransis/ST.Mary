import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ROLES } from '../lib/permissions';
import { CheckCircle2, XCircle, Clock, UserCheck } from 'lucide-react';

const STAGE_OPTIONS = [
  'حضانة', 'أولى ابتدائي', 'ثانية ابتدائي', 'ثالثة ابتدائي', 'رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي',
  'أولى إعدادي', 'ثانية إعدادي', 'ثالثة إعدادي',
  'أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي',
  'جامعة وخريجين', 'اجتماع الشباب', 'اجتماع الأسرة', 'شعب عام', 'عام'
];

export default function ApprovalsPage({ users = [], services = [], onRefresh }) {
  const [roleOverrides, setRoleOverrides] = useState({});
  const [stageOverrides, setStageOverrides] = useState({});
  const [classOverrides, setClassOverrides] = useState({});
  const [busyId, setBusyId] = useState(null);

  const pendingUsers = users.filter(u => u.status === 'pending');
  const recentUsers = users.filter(u => u.status === 'rejected').slice(0, 10);

  const handleDecision = async (user, decision) => {
    setBusyId(user.id);
    try {
      const assignedRole = roleOverrides[user.id] || user.requested_role || user.role || 'member';
      const assignedStage = stageOverrides[user.id] ?? (user.detailed_stage || user.service_stage || '');
      const assignedClass = classOverrides[user.id] ?? (user.assigned_class || '');

      const { error } = await supabase
        .from('church_users')
        .update({
          status: decision,
          role: decision === 'approved' ? assignedRole : user.role,
          detailed_stage: assignedStage,
          service_stage: assignedStage,
          assigned_class: assignedClass
        })
        .eq('id', user.id);

      if (error) {
        alert('خطأ: ' + error.message);
      } else {
        if (onRefresh) await onRefresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4 text-xs md:text-sm" dir="rtl">
      <div className="bg-white p-4 rounded-3xl border shadow-sm flex flex-wrap justify-between items-center gap-2">
        <div>
          <h2 className="text-base md:text-lg font-black text-[#7a1c24] flex items-center gap-2">
            <UserCheck size={20} /> طلبات الانضمام وتحديد الرتب والفصول ({pendingUsers.length})
          </h2>
          <p className="text-xs text-gray-500">راجع البيانات وحدد رتبة الشخص (خادم / أمين خدمة / مساعد أمين خدمة...) وفصله ثم اضغط قبول</p>
        </div>
      </div>

      {pendingUsers.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border text-center text-gray-500 text-xs">
          لا توجد طلبات انضمام معلقة حالياً ✅
        </div>
      ) : (
        <div className="grid gap-3">
          {pendingUsers.map(u => {
            const selectedRole = roleOverrides[u.id] || u.requested_role || u.role || 'member';
            const selectedStage = stageOverrides[u.id] ?? (u.detailed_stage || u.service_stage || '');
            const selectedClass = classOverrides[u.id] ?? (u.assigned_class || '');
            const isAlsoParent = Boolean(u.permissions?.also_parent);

            return (
              <div key={u.id} className="bg-white p-4 rounded-3xl border-2 border-amber-200 shadow-sm space-y-3">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-950 rounded text-[11px] font-bold flex items-center gap-1">
                        <Clock size={12} /> قيد الانتظار
                      </span>
                      <strong className="text-base text-gray-900">{u.full_name}</strong>
                      <span className="text-xs text-gray-500">(@{u.username})</span>
                      {isAlsoParent && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded text-[11px] font-bold">
                          👨‍👩‍👦 + ولي أمر أيضاً
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">
                      📞 {u.phone || '—'} • 🎂 {u.dob || '—'} • 📍 {u.address || '—'}
                      {u.is_deacon ? ` • 🕯️ شماس (${u.deacon_rank || 'شماس'})` : ''}
                      {u.children_names ? ` • 👶 الأبناء: ${u.children_names}` : ''}
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-4 gap-2 pt-2 border-t items-center">
                  <select
                    className="p-2 border rounded-xl bg-gray-50 text-xs font-bold"
                    value={selectedRole}
                    onChange={e => setRoleOverrides({ ...roleOverrides, [u.id]: e.target.value })}
                  >
                    {ROLES.filter(r => r.key !== 'admin').map(r => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>

                  <select
                    className="p-2 border rounded-xl bg-gray-50 text-xs font-bold"
                    value={selectedStage}
                    onChange={e => setStageOverrides({ ...stageOverrides, [u.id]: e.target.value })}
                  >
                    <option value="">-- المرحلة / الخدمة --</option>
                    {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>

                  <select
                    className="p-2 border rounded-xl bg-gray-50 text-xs font-bold"
                    value={selectedClass}
                    onChange={e => setClassOverrides({ ...classOverrides, [u.id]: e.target.value })}
                  >
                    <option value="">-- اختر الفصل --</option>
                    {services.map(srv => (
                      <option key={srv.id} value={srv.class_name}>{srv.class_name} ({srv.stage_name})</option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => handleDecision(u, 'approved')}
                      className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 size={15} /> قبول
                    </button>
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => handleDecision(u, 'rejected')}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle size={15} /> رفض
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {recentUsers.length > 0 && (
        <div className="bg-white p-4 rounded-3xl border space-y-2">
          <strong className="text-xs text-gray-600 block">الطلبات المرفوضة مؤخراً:</strong>
          {recentUsers.map(u => (
            <div key={u.id} className="p-2.5 bg-gray-50 rounded-xl border flex justify-between items-center text-xs">
              <span>{u.full_name} (@{u.username})</span>
              <button
                type="button"
                onClick={() => handleDecision(u, 'approved')}
                className="px-3 py-1 bg-green-600 text-white rounded-lg font-bold cursor-pointer"
              >
                إعادة قبول
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
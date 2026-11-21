import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ROLES } from '../lib/permissions';
import {
  DEFAULT_ROLE_TEMPLATES,
  buildScreenPermissionsMap,
  extractAllowedScreensFromMap
} from './PermissionsPage';
import { CheckCircle2, XCircle, Clock, UserCheck, Shield } from 'lucide-react';

const STAGE_OPTIONS = [
  'حضانة', 'أولى ابتدائي', 'ثانية ابتدائي', 'ثالثة ابتدائي', 'رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي',
  'أولى إعدادي', 'ثانية إعدادي', 'ثالثة إعدادي',
  'أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي',
  'جامعة وخريجين', 'اجتماع الشباب', 'اجتماع الأسرة', 'شعب عام', 'عام'
];

export default function ApprovalsPage({ users = [], services = [], onRefresh }) {
  const [roleOverrides, setRoleOverrides] = useState({});
  const [parentTypeOverrides, setParentTypeOverrides] = useState({});
  const [templateOverrides, setTemplateOverrides] = useState({});
  const [stageOverrides, setStageOverrides] = useState({});
  const [classOverrides, setClassOverrides] = useState({});
  const [templates, setTemplates] = useState(() =>
    DEFAULT_ROLE_TEMPLATES.map(t => ({
      ...t,
      screen_permissions: buildScreenPermissionsMap(t.screens, t.actions)
    }))
  );
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('church_public_content')
        .select('*')
        .eq('kind', 'role_template')
        .order('created_at', { ascending: true });

      if (!active) return;
      const map = new Map();
      DEFAULT_ROLE_TEMPLATES.forEach(t => {
        map.set(t.key, {
          ...t,
          screen_permissions: buildScreenPermissionsMap(t.screens, t.actions)
        });
      });
      if (data?.length) {
        data.forEach(row => {
          try {
            const obj = JSON.parse(row.body || '{}');
            const screens = Array.isArray(obj.screens) ? obj.screens : [];
            const actions = obj.actions || {};
            map.set(row.title, {
              key: row.title,
              ...obj,
              screens,
              actions,
              screen_permissions: buildScreenPermissionsMap(screens, actions, obj.screen_permissions)
            });
          } catch {
            // ignore malformed template row
          }
        });
      }
      setTemplates(Array.from(map.values()));
    })();
    return () => { active = false; };
  }, []);

  const pendingUsers = users.filter(u => u.status === 'pending');
  const recentUsers = users.filter(u => u.status === 'rejected').slice(0, 10);

  const resolveParentType = (u) => {
    if (parentTypeOverrides[u.id] !== undefined) return parentTypeOverrides[u.id];
    if (u.parent_type === 'father' || u.parent_type === 'mother') return u.parent_type;
    if (u.permissions?.parent_type === 'father' || u.permissions?.parent_type === 'mother') {
      return u.permissions.parent_type;
    }
    if (u.family_role === 'أب' || u.family_role === 'والد') return 'father';
    if (u.family_role === 'أم' || u.family_role === 'والدة') return 'mother';
    return '';
  };

  const handleDecision = async (user, decision) => {
    setBusyId(user.id);
    try {
      const assignedRole = roleOverrides[user.id] || user.requested_role || user.role || 'member';
      const assignedStage = stageOverrides[user.id] ?? (user.detailed_stage || user.service_stage || '');
      const assignedClass = classOverrides[user.id] ?? (user.assigned_class || '');
      const resolvedParentType = resolveParentType(user);
      const isParent = assignedRole === 'parent' || Boolean(user.permissions?.also_parent) || Boolean(resolvedParentType);

      const chosenTplKey =
        templateOverrides[user.id] ??
        user.permissions?.template_key ??
        (assignedRole === 'parent' ? 'parent' : '');

      const matchedTpl = templates.find(t => t.key === chosenTplKey);
      const basePerms = { ...(user.permissions || {}) };

      if (resolvedParentType) {
        basePerms.parent_type = resolvedParentType;
      }
      if (isParent) {
        basePerms.also_parent = Boolean(user.permissions?.also_parent) || assignedRole !== 'parent';
        basePerms.view_parent_panel = true;
        const extra = Array.isArray(basePerms.extra_screens) ? [...basePerms.extra_screens] : [];
        if (!extra.includes('parent_panel')) extra.push('parent_panel');
        basePerms.extra_screens = extra;
      }

      if (matchedTpl) {
        const scrMap = buildScreenPermissionsMap(
          matchedTpl.screens || [],
          matchedTpl.actions || {},
          matchedTpl.screen_permissions
        );
        const allowed = extractAllowedScreensFromMap(scrMap);
        basePerms.template_key = matchedTpl.key;
        basePerms.custom_role_label = matchedTpl.label;
        basePerms.screen_permissions = scrMap;
        basePerms.allowed_screens = allowed;
        basePerms.extra_screens = allowed;
        Object.assign(basePerms, matchedTpl.actions || {});
      }

      const updatePayload = {
        status: decision,
        role: decision === 'approved' ? assignedRole : user.role,
        detailed_stage: assignedStage,
        service_stage: assignedStage,
        assigned_class: assignedClass,
        permissions: basePerms
      };

      if (resolvedParentType) {
        updatePayload.parent_type = resolvedParentType;
        updatePayload.family_role = resolvedParentType === 'mother' ? 'أم' : 'أب';
      }

      const { error } = await supabase
        .from('church_users')
        .update(updatePayload)
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
            <UserCheck size={20} /> طلبات الانضمام وتحديد الرتب وولي الأمر (أب/أم) وGroup Policy ({pendingUsers.length})
          </h2>
          <p className="text-xs text-gray-500">
            حدد الرتبة، وهل ولي الأمر «أب» أم «أم»، وقالب الصلاحيات (Group Policy) ثم اضغط قبول
          </p>
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
            const selectedParentType = resolveParentType(u);
            const selectedTplKey =
              templateOverrides[u.id] ??
              u.permissions?.template_key ??
              (selectedRole === 'parent' ? 'parent' : '');
            const isAlsoParent = Boolean(u.permissions?.also_parent);
            const showParentSelector = selectedRole === 'parent' || isAlsoParent || Boolean(u.children_names);
            const alreadyLinkedChildren = users.filter(ch => ch.parent_id === u.id || ch.father_id === u.id);

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
                      {selectedParentType && (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-black ${
                          selectedParentType === 'mother' ? 'bg-pink-100 text-pink-900' : 'bg-sky-100 text-sky-900'
                        }`}>
                          {selectedParentType === 'mother' ? '👩 ولي أمر: الأم' : '👨 ولي أمر: الأب'}
                        </span>
                      )}
                      {isAlsoParent && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded text-[11px] font-bold">
                          👨‍👩‍👦 + ولي أمر أيضاً
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">
                      📞 {u.phone || '—'} • 🎂 {u.dob || '—'} • 📍 {u.address || '—'}
                      {u.is_deacon ? ` • 🕯️ شماس (${u.deacon_rank || 'شماس'})` : ''}
                    </p>
                    {(u.children_names || alreadyLinkedChildren.length > 0) && (
                      <p className="text-xs text-amber-950 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-200 inline-block">
                        👶 <strong>الأبناء:</strong>{' '}
                        {alreadyLinkedChildren.length > 0
                          ? alreadyLinkedChildren.map(c => c.full_name).join('، ')
                          : u.children_names}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-2 border-t items-center">
                  <select
                    className="p-2 border rounded-xl bg-gray-50 text-xs font-bold"
                    value={selectedRole}
                    onChange={e => setRoleOverrides({ ...roleOverrides, [u.id]: e.target.value })}
                  >
                    {ROLES.filter(r => r.key !== 'admin').map(r => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>

                  {showParentSelector ? (
                    <select
                      className="p-2 border rounded-xl bg-blue-50/70 border-blue-200 text-xs font-bold text-blue-950"
                      value={selectedParentType}
                      onChange={e => setParentTypeOverrides({ ...parentTypeOverrides, [u.id]: e.target.value })}
                    >
                      <option value="">-- حدد: الأب أو الأم --</option>
                      <option value="father">👨 الأب (والد)</option>
                      <option value="mother">👩 الأم (والدة)</option>
                    </select>
                  ) : (
                    <div className="p-2 border rounded-xl bg-gray-50/60 text-[11px] text-gray-400 text-center">
                      ليس ولي أمر
                    </div>
                  )}

                  <div className="relative">
                    <select
                      className="w-full p-2 border rounded-xl bg-emerald-50/60 border-emerald-200 text-xs font-bold text-emerald-950"
                      value={selectedTplKey}
                      onChange={e => setTemplateOverrides({ ...templateOverrides, [u.id]: e.target.value })}
                      title="تطبيق Group Policy / قالب صلاحيات"
                    >
                      <option value="">-- Group Policy (قالب الصلاحيات) --</option>
                      {templates.map(t => (
                        <option key={t.key} value={t.key}>
                          <Shield size={12} /> {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

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
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => handleDecision(u, 'approved')}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 size={15} /> قبول وتطبيق الصلاحيات
                  </button>
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => handleDecision(u, 'rejected')}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <XCircle size={15} /> رفض
                  </button>
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
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ROLES } from '../lib/permissions';
import {
  DEFAULT_ROLE_TEMPLATES,
  buildScreenPermissionsMap,
  extractAllowedScreensFromMap
} from './PermissionsPage';
import { CheckCircle2, XCircle, Clock, UserCheck, MessageCircle, X, ShieldCheck, Baby } from 'lucide-react';

const STAGE_OPTIONS = [
  'حضانة', 'أولى ابتدائي', 'ثانية ابتدائي', 'ثالثة ابتدائي', 'رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي',
  'أولى إعدادي', 'ثانية إعدادي', 'ثالثة إعدادي',
  'أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي',
  'جامعة وخريجين', 'اجتماع الشباب', 'اجتماع الأسرة', 'اجتماع الصالة', 'شعب عام', 'عام'
];

export default function ApprovalsPage({ users = [], services = [], onRefresh }) {
  const [roleOverrides, setRoleOverrides] = useState({});
  const [parentTypeOverrides, setParentTypeOverrides] = useState({});
  const [templateOverrides, setTemplateOverrides] = useState({});
  const [stageOverrides, setStageOverrides] = useState({});
  const [classOverrides, setClassOverrides] = useState({});
  const [serviceStatusOverrides, setServiceStatusOverrides] = useState({});
  const [serviceConfirmedOverrides, setServiceConfirmedOverrides] = useState({});
  const [childLinkOverrides, setChildLinkOverrides] = useState({});
  const [templates, setTemplates] = useState(() =>
    DEFAULT_ROLE_TEMPLATES.map(t => ({
      ...t,
      screen_permissions: buildScreenPermissionsMap(t.screens, t.actions)
    }))
  );
  const [busyId, setBusyId] = useState(null);
  const [approvedWelcomeBanner, setApprovedWelcomeBanner] = useState(null);

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

  const candidateChildren = users.filter(
    u => u.id && u.status !== 'pending' && u.status !== 'rejected'
  );

  const resolveParentType = (u) => {
    if (parentTypeOverrides[u.id] !== undefined) return parentTypeOverrides[u.id];
    if (u.parent_type === 'father' || u.parent_type === 'mother') return u.parent_type;
    if (u.permissions?.parent_type === 'father' || u.permissions?.parent_type === 'mother') {
      return u.permissions.parent_type;
    }
    if (u.family_role === 'أب' || u.family_role === 'والد' || u.guardian_type === 'father') return 'father';
    if (u.family_role === 'أم' || u.family_role === 'والدة' || u.guardian_type === 'mother') return 'mother';
    return '';
  };

  const resolveServiceStatus = (u) => {
    if (serviceStatusOverrides[u.id] !== undefined) return serviceStatusOverrides[u.id];
    if (u.service_membership_status === 'not_in_service' || u.is_site_observer || u.permissions?.engagement_mode === 'not_in_service') {
      return 'not_in_service';
    }
    if (u.permissions?.engagement_mode === 'hall_meeting' || (u.detailed_stage || '').includes('اجتماع الصالة')) {
      return 'hall_meeting';
    }
    if (u.permissions?.engagement_mode === 'parish_only' || u.role === 'parish' || u.is_parish) {
      return 'parish_only';
    }
    return 'in_service';
  };

  const isServiceConfirmedForUser = (u) => {
    if (serviceConfirmedOverrides[u.id] !== undefined) return Boolean(serviceConfirmedOverrides[u.id]);
    return Boolean(u.permissions?.service_confirmed);
  };

  const getChildStageBadge = (child) => {
    const stg = child.detailed_stage || child.service_stage || '';
    const cls = child.assigned_class || '';
    if (stg && cls) return `${stg} — ${cls}`;
    return stg || cls || 'غير محدد المرحلة';
  };

  const sendApprovalWelcomeNotification = async (user) => {
    const welcomeText =
      `سلام ونعمة يا ${user.full_name} ✝\n` +
      `أنت مرحب بك في الكنيسة! تم قبول طلب انضمامك بنجاح 🎉\n` +
      `بيانات الدخول الخاصة بك:\n` +
      `• اسم المستخدم: ${user.username}\n` +
      `• كلمة المرور: ${user.password || '123'}\n` +
      `يمكنك تسجيل الدخول الآن والتمتع بخدمات الكنيسة 🙏`;

    try {
      await supabase.from('church_notifications').insert([{
        user_id: user.id,
        type: 'account_approved',
        title: '🎉 تم قبولك! أنت مرحب بك في الكنيسة',
        message: JSON.stringify({
          user_id: user.id,
          username: user.username,
          password: user.password || '123',
          full_name: user.full_name,
          text: welcomeText
        }),
        reference_id: user.id,
        is_read: false
      }]);
    } catch {
      // ignore if notifications table differs
    }

    try {
      const ch = supabase.channel('church-approval-alerts');
      await ch.subscribe();
      await ch.send({
        type: 'broadcast',
        event: 'account_approved',
        payload: {
          userId: user.id,
          username: user.username,
          password: user.password || '123',
          full_name: user.full_name,
          text: welcomeText
        }
      });
      supabase.removeChannel(ch);
    } catch {
      // ignore broadcast errors
    }

    setApprovedWelcomeBanner({
      user,
      text: welcomeText
    });
  };

  const handleDecision = async (user, decision) => {
    setBusyId(user.id);
    try {
      const assignedRole = roleOverrides[user.id] || user.requested_role || user.role || 'member';
      const serviceStatus = resolveServiceStatus(user);
      const isOutOfService = serviceStatus === 'not_in_service';
      const serviceConfirmed = decision === 'approved'
        ? (serviceConfirmedOverrides[user.id] !== undefined ? Boolean(serviceConfirmedOverrides[user.id]) : true)
        : false;

      const assignedStage = isOutOfService
        ? 'خارج الخدمة / زائر موقع'
        : (serviceStatus === 'hall_meeting'
            ? (stageOverrides[user.id] ?? (user.detailed_stage || 'اجتماع الصالة'))
            : (serviceStatus === 'parish_only'
                ? (stageOverrides[user.id] ?? (user.detailed_stage || 'خدمة شعب'))
                : (stageOverrides[user.id] ?? (user.detailed_stage || user.service_stage || ''))));

      const assignedClass = isOutOfService ? '' : (classOverrides[user.id] ?? (user.assigned_class || ''));
      const resolvedParentType = resolveParentType(user);
      const selectedChildId = childLinkOverrides[user.id] || '';
      const isParent =
        assignedRole === 'parent' ||
        Boolean(user.permissions?.also_parent) ||
        Boolean(resolvedParentType) ||
        Boolean(selectedChildId);

      const chosenTplKey =
        templateOverrides[user.id] ??
        user.permissions?.template_key ??
        (assignedRole === 'parent' ? 'parent' : '');

      const matchedTpl = templates.find(t => t.key === chosenTplKey);
      const basePerms = { ...(user.permissions || {}) };

      basePerms.engagement_mode = serviceStatus;
      basePerms.service_membership_status = isOutOfService ? 'not_in_service' : 'in_service';
      basePerms.service_confirmed = serviceConfirmed;
      basePerms.is_site_observer = isOutOfService;

      if (resolvedParentType) {
        basePerms.parent_type = resolvedParentType;
        basePerms.guardian_type = resolvedParentType;
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
        service_membership_status: isOutOfService ? 'not_in_service' : 'in_service',
        is_site_observer: isOutOfService,
        is_parent_guardian: isParent,
        permissions: basePerms
      };

      if (resolvedParentType) {
        updatePayload.parent_type = resolvedParentType;
        updatePayload.guardian_type = resolvedParentType;
        updatePayload.family_role = resolvedParentType === 'mother' ? 'أم' : 'أب';
      }

      const { error } = await supabase
        .from('church_users')
        .update(updatePayload)
        .eq('id', user.id);

      if (error) {
        alert('خطأ: ' + error.message);
      } else {
        // ربط الطفل / الابن المختار بولي الأمر من الداخل عند القبول
        if (decision === 'approved' && selectedChildId) {
          const childObj = candidateChildren.find(c => String(c.id) === String(selectedChildId));
          if (childObj) {
            const childUpdate = {
              parent_id: user.id
            };
            if (resolvedParentType === 'mother') {
              childUpdate.mother_id = user.id;
            } else {
              childUpdate.father_id = user.id;
            }
            await supabase
              .from('church_users')
              .update(childUpdate)
              .eq('id', childObj.id);
          }
        }

        if (decision === 'approved') {
          await sendApprovalWelcomeNotification(user);
        }
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
            أكد هل الشخص معانا في الخدمة وفي خدمة إيه، واربط ولي الأمر بالطفل/الابن (مع مرحلته)، وحدد الرتبة وGroup Policy ثم اضغط قبول
          </p>
        </div>
      </div>

      {approvedWelcomeBanner && (
        <div className="bg-emerald-50 border-2 border-emerald-400 p-4 rounded-3xl shadow-sm space-y-2.5">
          <div className="flex justify-between items-start gap-2">
            <div>
              <strong className="text-sm text-emerald-950 block">
                ✅ تم قبول ({approvedWelcomeBanner.user.full_name}) وإرسال إشعار الترحيب ببيانات الدخول!
              </strong>
              <p className="text-xs text-emerald-900 mt-1 whitespace-pre-line font-bold bg-white/80 p-3 rounded-2xl border border-emerald-200">
                {approvedWelcomeBanner.text}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setApprovedWelcomeBanner(null)}
              className="p-1.5 bg-white rounded-xl text-gray-600 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {approvedWelcomeBanner.user.phone && (
            <div className="flex justify-end">
              <a
                href={`https://wa.me/2${String(approvedWelcomeBanner.user.phone).replace(/\D/g, '')}?text=${encodeURIComponent(approvedWelcomeBanner.text)}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-xs inline-flex items-center gap-1.5 shadow"
              >
                <MessageCircle size={15} /> إرسال رسالة الترحيب باليوزر والباسورد على واتساب ({approvedWelcomeBanner.user.phone})
              </a>
            </div>
          )}
        </div>
      )}

      {pendingUsers.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border text-center text-gray-500 text-xs">
          لا توجد طلبات انضمام معلقة حالياً ✅
        </div>
      ) : (
        <div className="grid gap-3">
          {pendingUsers.map(u => {
            const selectedRole = roleOverrides[u.id] || u.requested_role || u.role || 'member';
            const serviceStatus = resolveServiceStatus(u);
            const isOutOfService = serviceStatus === 'not_in_service';
            const confirmedInService = isServiceConfirmedForUser(u);
            const selectedStage = stageOverrides[u.id] ?? (u.detailed_stage || u.service_stage || '');
            const selectedClass = classOverrides[u.id] ?? (u.assigned_class || '');
            const selectedParentType = resolveParentType(u);
            const selectedTplKey =
              templateOverrides[u.id] ??
              u.permissions?.template_key ??
              (selectedRole === 'parent' ? 'parent' : '');
            const isAlsoParent = Boolean(u.permissions?.also_parent);
            const showParentSelector =
              selectedRole === 'parent' ||
              isAlsoParent ||
              Boolean(selectedParentType) ||
              Boolean(u.children_names);

            const alreadyLinkedChildren = users.filter(
              ch => ch.parent_id === u.id || ch.father_id === u.id || ch.mother_id === u.id
            );
            const selectedChildId = childLinkOverrides[u.id] || '';
            const chosenChildObj = candidateChildren.find(c => String(c.id) === String(selectedChildId));

            return (
              <div key={u.id} className="bg-white p-4 rounded-3xl border-2 border-amber-200 shadow-sm space-y-3">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-950 rounded text-[11px] font-bold flex items-center gap-1">
                        <Clock size={12} /> قيد الانتظار
                      </span>
                      <strong className="text-base text-gray-900">{u.full_name}</strong>
                      <span className="text-xs text-gray-500">(@{u.username})</span>

                      {/* حالة التواجد في الخدمة */}
                      <span className={`px-2 py-0.5 rounded text-[11px] font-black ${
                        isOutOfService
                          ? 'bg-slate-200 text-slate-900'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}>
                        {isOutOfService
                          ? '🚪 غير تابع للخدمة / زائر موقع'
                          : `✅ معانا في الخدمة${selectedStage ? `: ${selectedStage}` : ''}`}
                      </span>

                      {confirmedInService && !isOutOfService && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-black bg-teal-100 text-teal-900 inline-flex items-center gap-1">
                          <ShieldCheck size={12} /> مؤكد في الخدمة (Confirmed)
                        </span>
                      )}

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
                      {selectedClass && !isOutOfService ? ` • 🏫 فصل: ${selectedClass}` : ''}
                    </p>

                    {(u.children_names || alreadyLinkedChildren.length > 0 || chosenChildObj) && (
                      <p className="text-xs text-amber-950 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-200 inline-block">
                        👶 <strong>الأبناء والمرحلة:</strong>{' '}
                        {[
                          ...alreadyLinkedChildren.map(c => `${c.full_name} (${getChildStageBadge(c)})`),
                          ...(chosenChildObj ? [`${chosenChildObj.full_name} (${getChildStageBadge(chosenChildObj)})`] : []),
                          ...(u.children_names ? [u.children_names] : [])
                        ].filter((v, i, arr) => arr.indexOf(v) === i).join(' ، ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* سطر تأكيد الخدمة ونوع الارتباط */}
                <div className="bg-cyan-50/60 border border-cyan-200 rounded-2xl p-3 grid sm:grid-cols-3 gap-2 items-center">
                  <div>
                    <label className="block text-[11px] font-black text-cyan-950 mb-1">
                      هل معانا في الخدمة ولا لأ؟
                    </label>
                    <select
                      className="w-full p-2 border border-cyan-300 rounded-xl bg-white text-xs font-bold"
                      value={serviceStatus}
                      onChange={e => setServiceStatusOverrides({ ...serviceStatusOverrides, [u.id]: e.target.value })}
                    >
                      <option value="in_service">✅ معانا في خدمة محددة</option>
                      <option value="parish_only">⛪ معانا في خدمة شعب فقط</option>
                      <option value="hall_meeting">🏛️ معانا في اجتماع الصلاة</option>
                      <option value="not_in_service">🚪 مش معانا في الخدمة / زائر موقع (Click Out)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-cyan-950 mb-1">
                      خدمة إيه؟ (المرحلة / الخدمة)
                    </label>
                    <select
                      disabled={isOutOfService}
                      className="w-full p-2 border rounded-xl bg-white text-xs font-bold disabled:bg-gray-100"
                      value={isOutOfService ? '' : selectedStage}
                      onChange={e => setStageOverrides({ ...stageOverrides, [u.id]: e.target.value })}
                    >
                      <option value="">{isOutOfService ? 'خارج الخدمة' : '-- اختر الخدمة / المرحلة --'}</option>
                      {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-xl border border-cyan-200 text-xs font-black text-teal-950">
                      <input
                        type="checkbox"
                        disabled={isOutOfService}
                        checked={isOutOfService ? false : confirmedInService}
                        onChange={e => setServiceConfirmedOverrides({
                          ...serviceConfirmedOverrides,
                          [u.id]: e.target.checked
                        })}
                      />
                      <span>تأكيد (Confirm) إنه في الخدمة</span>
                    </label>
                  </div>
                </div>

                {/* ربط ولي الأمر بالطفل / الابن من الداخل */}
                {showParentSelector && (
                  <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-3 grid sm:grid-cols-2 gap-2 items-center">
                    <div>
                      <label className="block text-[11px] font-black text-blue-950 mb-1 flex items-center gap-1">
                        <Baby size={14} /> ربط ولي الأمر بالطفل / الابن (تظهر مرحلته مثل ابتدائي/إعدادي):
                      </label>
                      <select
                        className="w-full p-2 border border-blue-300 rounded-xl bg-white text-xs font-bold"
                        value={selectedChildId}
                        onChange={e => setChildLinkOverrides({ ...childLinkOverrides, [u.id]: e.target.value })}
                      >
                        <option value="">-- اختر الطفل أو الابن لربطه به --</option>
                        {candidateChildren.map(ch => (
                          <option key={ch.id} value={ch.id}>
                            {ch.full_name} — ({getChildStageBadge(ch)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="text-xs font-bold text-blue-950 bg-white/80 p-2.5 rounded-xl border border-blue-100">
                      {chosenChildObj ? (
                        <div>
                          الطفل المختار: <strong>{chosenChildObj.full_name}</strong>
                          <span className="block text-[11px] text-gray-600 mt-0.5">
                            المرحلة / الفصل: {getChildStageBadge(chosenChildObj)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-[11px]">
                          اختر الطفل أو الابن من القائمة لربطه بولي الأمر عند القبول.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t items-center">
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
                          🛡️ {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <select
                    disabled={isOutOfService}
                    className="p-2 border rounded-xl bg-gray-50 text-xs font-bold disabled:bg-gray-100"
                    value={isOutOfService ? '' : selectedClass}
                    onChange={e => setClassOverrides({ ...classOverrides, [u.id]: e.target.value })}
                  >
                    <option value="">{isOutOfService ? 'بدون فصل' : '-- اختر الفصل --'}</option>
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
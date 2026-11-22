import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Layers, Plus, Trash2, Users, Clock } from 'lucide-react';

export const DEFAULT_SERVICE_GROUPS = [
  { group_name: 'خدمة حضانة وطفولة', icon: '🧸', gender_target: 'عام', service_day: 'الجمعة', start_time: '09:00', end_time: '11:30', stages: ['حضانة'], sort_order: 1 },
  { group_name: 'خدمة ابتدائي', icon: '🎒', gender_target: 'عام', service_day: 'الجمعة', start_time: '09:00', end_time: '12:00', stages: ['أولى ابتدائي', 'ثانية ابتدائي', 'ثالثة ابتدائي', 'رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي'], sort_order: 2 },
  { group_name: 'خدمة إعدادي بنين', icon: '📘', gender_target: 'بنين', service_day: 'الجمعة', start_time: '16:00', end_time: '18:00', stages: ['أولى إعدادي', 'ثانية إعدادي', 'ثالثة إعدادي'], sort_order: 3 },
  { group_name: 'خدمة إعدادي بنات', icon: '📗', gender_target: 'بنات', service_day: 'الجمعة', start_time: '16:00', end_time: '18:00', stages: ['أولى إعدادي', 'ثانية إعدادي', 'ثالثة إعدادي'], sort_order: 4 },
  { group_name: 'خدمة ثانوي بنين', icon: '🎓', gender_target: 'بنين', service_day: 'الجمعة', start_time: '18:00', end_time: '20:00', stages: ['أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي'], sort_order: 5 },
  { group_name: 'خدمة ثانوي بنات', icon: '🎓', gender_target: 'بنات', service_day: 'الجمعة', start_time: '18:00', end_time: '20:00', stages: ['أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي'], sort_order: 6 },
  { group_name: 'خدمة جامعة', icon: '🏛️', gender_target: 'عام', service_day: 'الخميس', start_time: '19:00', end_time: '21:00', stages: ['جامعة'], sort_order: 7 },
  { group_name: 'خدمة خريجين', icon: '💼', gender_target: 'عام', service_day: 'الخميس', start_time: '19:30', end_time: '21:30', stages: ['خريجين'], sort_order: 8 }
];

export const normalizeGroupStages = (raw) => {
  if (Array.isArray(raw)) return raw.map(s => String(s).trim()).filter(Boolean);
  if (typeof raw === 'string') return raw.split(/[,،]/).map(s => s.trim()).filter(Boolean);
  return [];
};

export const formatGroupSchedule = (grp) => {
  if (!grp) return '';
  const parts = [];
  if (grp.service_day) parts.push(grp.service_day);
  if (grp.start_time && grp.end_time) parts.push(`من ${grp.start_time} إلى ${grp.end_time}`);
  else if (grp.start_time) parts.push(`الساعة ${grp.start_time}`);
  return parts.join(' • ');
};

export function resolveUserServiceGroups(user, services = [], groupsList = DEFAULT_SERVICE_GROUPS) {
  if (!user) return [];
  const activeGroups = (groupsList && groupsList.length > 0) ? groupsList : DEFAULT_SERVICE_GROUPS;
  const activeGroupNames = activeGroups.map(g => g.group_name || g.groupName).filter(Boolean);

  // إضافة أي خدمة موجودة في جدول الفصول وليست مطابقة لأي جروب بالاسم
  const extraStageNames = [...new Set(services.map(s => s.stage_name).filter(Boolean))]
    .filter(st => !activeGroupNames.some(gn => gn === st || gn.includes(st) || st.includes(gn)));

  const allGroupNames = [...new Set([...activeGroupNames, ...extraStageNames])];

  if (user.role === 'admin' || user.role === 'priest') {
    return allGroupNames;
  }

  const userTokens = [
    ...String(user.detailed_stage || '').split(','),
    ...String(user.service_stage || '').split(','),
    ...String(user.assigned_class || '').split(','),
    ...(Array.isArray(user.permissions?.extra_services) ? user.permissions.extra_services : [])
  ]
    .map(s => s.trim())
    .filter(Boolean);

  const matched = new Set();

  userTokens.forEach(tok => {
    allGroupNames.forEach(gName => {
      if (tok === gName) matched.add(gName);
    });

    activeGroups.forEach(grp => {
      const gName = grp.group_name || grp.groupName;
      const stages = normalizeGroupStages(grp.stages);
      // لو المستخدم محددله جروب معين (مثل إعدادي بنين) أو مرحلة فرعية داخل الجروب
      if (tok === gName) {
        matched.add(gName);
      } else if (stages.some(st => tok === st)) {
        // مراعاة بنين / بنات إن وُجدت
        if (grp.gender_target === 'بنين' && user.gender === 'أنثى') return;
        if (grp.gender_target === 'بنات' && user.gender === 'ذكر') return;
        matched.add(gName);
      }
    });

    services.forEach(srv => {
      if (srv.class_name === tok && srv.stage_name) {
        const linkedGrp = activeGroupNames.find(gn => gn === srv.stage_name || gn.includes(srv.stage_name));
        matched.add(linkedGrp || srv.stage_name);
      }
    });
  });

  return Array.from(matched);
}

export default function ServiceGroupFeed({ currentUser, services = [], groups = null, canPost = false }) {
  const [dbGroups, setDbGroups] = useState([]);
  const [posts, setPosts] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [form, setForm] = useState({ title: '', post_type: 'إعلان للخدمة', body: '', event_date: '' });

  useEffect(() => {
    if (Array.isArray(groups)) {
      setDbGroups(groups);
      return;
    }
    supabase
      .from('service_groups')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) setDbGroups(data);
        else setDbGroups(DEFAULT_SERVICE_GROUPS);
      });
  }, [groups]);

  const effectiveGroups = dbGroups.length > 0 ? dbGroups : DEFAULT_SERVICE_GROUPS;
  const myGroups = resolveUserServiceGroups(currentUser, services, effectiveGroups);

  useEffect(() => {
    if (myGroups.length > 0 && (!selectedGroup || !myGroups.includes(selectedGroup))) {
      setSelectedGroup(myGroups[0]);
    }
  }, [myGroups.join('|')]);

  const loadPosts = async () => {
    if (myGroups.length === 0) return;
    const { data } = await supabase
      .from('service_group_posts')
      .select('*')
      .in('group_name', myGroups)
      .order('created_at', { ascending: false });
    if (data) setPosts(data);
  };

  useEffect(() => {
    loadPosts();
  }, [myGroups.join('|')]);

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!selectedGroup || !form.title.trim()) return;
    const { data, error } = await supabase
      .from('service_group_posts')
      .insert([{
        group_name: selectedGroup,
        post_type: form.post_type,
        title: form.title.trim(),
        body: form.body.trim(),
        event_date: form.event_date || null,
        created_by: currentUser?.id || null,
        created_by_name: currentUser?.full_name || 'الإدارة'
      }])
      .select()
      .single();

    if (!error && data) {
      setPosts([data, ...posts]);
      setForm({ title: '', post_type: 'إعلان للخدمة', body: '', event_date: '' });
    } else if (error) {
      alert(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('حذف هذا المنشور من كارت الخدمة؟')) return;
    const { error } = await supabase.from('service_group_posts').delete().eq('id', id);
    if (!error) setPosts(posts.filter(p => p.id !== id));
  };

  if (myGroups.length === 0) return null;

  const activePosts = posts.filter(p => p.group_name === selectedGroup);
  const activeGrpObj = effectiveGroups.find(g => (g.group_name || g.groupName) === selectedGroup);

  return (
    <div className="bg-white rounded-3xl border-2 border-amber-200 p-4 md:p-5 space-y-4 shadow-sm" dir="rtl">
      <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3">
        <div>
          <h3 className="text-sm md:text-base font-black text-[#7a1c24] flex items-center gap-2">
            <Layers size={18} /> كروت الخدمات العامة (كل خدمة تظهر لأفرادها بمواعيدها ومنشوراتها)
          </h3>
          <p className="text-[11px] text-gray-500">كل كارت هنا خاص بأبناء وخدام الخدمة المسجلين فيها فقط</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {myGroups.map(gName => {
          const grpObj = effectiveGroups.find(g => (g.group_name || g.groupName) === gName);
          const count = posts.filter(p => p.group_name === gName).length;
          const isSelected = selectedGroup === gName;
          const sched = formatGroupSchedule(grpObj);
          return (
            <button
              key={gName}
              type="button"
              onClick={() => setSelectedGroup(gName)}
              className={`p-3 rounded-2xl border-2 text-right transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                isSelected
                  ? 'bg-[#7a1c24] text-white border-[#5c1319] shadow'
                  : 'bg-[#fbfaf7] hover:border-[#7a1c24] text-gray-900 border-gray-200'
              }`}
            >
              <div className="flex justify-between items-center w-full">
                <span className="text-xl">{grpObj?.icon || '📌'}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-red-50 text-[#7a1c24]'}`}>
                  {count} منشور
                </span>
              </div>
              <div>
                <strong className="text-xs font-black block">{gName}</strong>
                {sched && (
                  <span className={`text-[10px] block mt-0.5 ${isSelected ? 'text-amber-200' : 'text-gray-500'}`}>
                    ⏰ {sched}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedGroup && (
        <div className="bg-[#fbfaf7] border rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm text-[#7a1c24] flex items-center gap-1.5">
              <Users size={16} /> كارت: {selectedGroup}
            </strong>
            {formatGroupSchedule(activeGrpObj) && (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-950 rounded-xl text-[11px] font-bold flex items-center gap-1">
                <Clock size={12} /> {formatGroupSchedule(activeGrpObj)}
              </span>
            )}
          </div>

          {canPost && (
            <form onSubmit={handlePublish} className="bg-white p-3 rounded-2xl border space-y-2 text-xs font-bold">
              <span className="text-[#7a1c24] block">+ نشر إعلان أو تنبيه داخل كارت ({selectedGroup}):</span>
              <div className="grid sm:grid-cols-3 gap-2">
                <select className="p-2 border rounded-xl bg-white" value={form.post_type} onChange={e => setForm({ ...form, post_type: e.target.value })}>
                  <option value="إعلان للخدمة">📢 إعلان للخدمة</option>
                  <option value="ميعاد اجتماع / قداس">⛪ ميعاد اجتماع / قداس</option>
                  <option value="تنبيه هام">⚠️ تنبيه هام</option>
                  <option value="نشاط / رحلة">🚌 نشاط / رحلة</option>
                </select>
                <input required placeholder="العنوان *" className="p-2 border rounded-xl" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                <input type="date" className="p-2 border rounded-xl" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <input placeholder="التفاصيل..." className="flex-1 p-2 border rounded-xl font-normal" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
                <button type="submit" className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl flex items-center gap-1 cursor-pointer shrink-0">
                  <Plus size={14} /> نشر
                </button>
              </div>
            </form>
          )}

          {activePosts.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">لا توجد منشورات مضافة داخل هذا الجروب حتى الآن.</p>
          ) : (
            <div className="space-y-2">
              {activePosts.map(p => (
                <div key={p.id} className="bg-white p-3.5 rounded-2xl border flex justify-between items-start gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-950 rounded text-[10px] font-bold">{p.post_type}</span>
                      <strong className="text-sm text-gray-900">{p.title}</strong>
                      {p.event_date && <span className="text-gray-500">({p.event_date})</span>}
                    </div>
                    {p.body && <p className="text-gray-700 leading-relaxed">{p.body}</p>}
                    <span className="text-[10px] text-gray-400 block">بواسطة: {p.created_by_name}</span>
                  </div>
                  {canPost && (p.created_by === currentUser?.id || currentUser?.role === 'admin' || currentUser?.role === 'priest') && (
                    <button type="button" onClick={() => handleDelete(p.id)} className="p-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Layers, Plus, Trash2, Users, MessageSquare } from 'lucide-react';

export const SERVICE_GROUPS = [
  {
    groupName: 'خدمة حضانة وطفولة',
    icon: '🧸',
    stages: ['حضانة']
  },
  {
    groupName: 'خدمة ابتدائي',
    icon: '🎒',
    stages: ['أولى ابتدائي', 'ثانية ابتدائي', 'ثالثة ابتدائي', 'رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي']
  },
  {
    groupName: 'خدمة إعدادي',
    icon: '📘',
    stages: ['أولى إعدادي', 'ثانية إعدادي', 'ثالثة إعدادي']
  },
  {
    groupName: 'خدمة ثانوي',
    icon: '🎓',
    stages: ['أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي']
  },
  {
    groupName: 'خدمة جامعة وخريجين',
    icon: '🏛️',
    stages: ['جامعة وخريجين']
  },
  {
    groupName: 'خدمات واجتماعات خاصة',
    icon: '🤝',
    stages: ['حرفيين ومهنيين', 'أصحاب معاشات', 'اجتماع الأرامل', 'إخوة الرب', 'اجتماع الصدى', 'شمامسة وألحان']
  }
];

export function resolveUserServiceGroups(user, services = []) {
  if (!user) return [];
  const dynamicGroupNames = [...new Set(services.map(s => s.stage_name).filter(Boolean))];
  const allGroupNames = [...new Set([...SERVICE_GROUPS.map(g => g.groupName), ...dynamicGroupNames])];

  // الأدمن وأبونا يشوفوا كل الكروت والجروبات
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
    // مطابقة مباشرة مع اسم الجروب
    allGroupNames.forEach(gName => {
      if (tok === gName || gName.includes(tok) || tok.includes(gName)) {
        matched.add(gName);
      }
    });

    // مطابقة مع مراحل الجروبات الثابتة
    SERVICE_GROUPS.forEach(grp => {
      if (grp.stages.some(st => tok.includes(st) || st.includes(tok))) {
        matched.add(grp.groupName);
      }
    });

    // مطابقة مع الفصول المسجلة في جدول church_services
    services.forEach(srv => {
      if (srv.class_name === tok && srv.stage_name) {
        matched.add(srv.stage_name);
        SERVICE_GROUPS.forEach(grp => {
          if (grp.groupName.includes(srv.stage_name) || srv.stage_name.includes(grp.groupName.replace('خدمة ', ''))) {
            matched.add(grp.groupName);
          }
        });
      }
    });
  });

  return Array.from(matched);
}

export default function ServiceGroupFeed({ currentUser, services = [], canPost = false }) {
  const [posts, setPosts] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [form, setForm] = useState({ title: '', post_type: 'إعلان للخدمة', body: '', event_date: '' });

  const myGroups = resolveUserServiceGroups(currentUser, services);

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

  return (
    <div className="bg-white rounded-3xl border-2 border-amber-200 p-4 md:p-5 space-y-4 shadow-sm" dir="rtl">
      <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3">
        <div>
          <h3 className="text-sm md:text-base font-black text-[#7a1c24] flex items-center gap-2">
            <Layers size={18} /> كروت جروبات الخدمة الخاصة بك (يظهر لأبناء وخدام كل خدمة فقط)
          </h3>
          <p className="text-[11px] text-gray-500">كل كارت هنا خاص بأفراد الخدمة المسجلين فيها فقط</p>
        </div>
      </div>

      {/* كروت الجروبات */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {myGroups.map(gName => {
          const grpObj = SERVICE_GROUPS.find(g => g.groupName === gName);
          const count = posts.filter(p => p.group_name === gName).length;
          const isSelected = selectedGroup === gName;
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
              <strong className="text-xs font-black block">{gName}</strong>
            </button>
          );
        })}
      </div>

      {/* محتوى الكارت المختار */}
      {selectedGroup && (
        <div className="bg-[#fbfaf7] border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <strong className="text-sm text-[#7a1c24] flex items-center gap-1.5">
              <Users size={16} /> كارت: {selectedGroup}
            </strong>
          </div>

          {canPost && (
            <form onSubmit={handlePublish} className="bg-white p-3 rounded-2xl border space-y-2 text-xs font-bold">
              <span className="text-[#7a1c24] block">+ نشر إعلان أو موعد داخل كارت ({selectedGroup}):</span>
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
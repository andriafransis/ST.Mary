
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLogger';
import { MessageCircle, Settings, X, Lock, Edit3, Trash2, Send, Search, UserCheck } from 'lucide-react';

export const WA_CATEGORIES = ['افتقاد', 'معايدة', 'أعياد ومناسبات', 'تعزية', 'متابعة اعتراف', 'أخرى'];

export const FALLBACK_WA_TEMPLATES = [
  { id: 'def_1', category: 'افتقاد', title: 'رسالة افتقاد عام', message_body: 'سلام ونعمة يا {الاسم} ✝ وحشتنا جداً في الكنيسة ونتمنى تكون بخير وبصحة. بنطمن عليك وعلى الأسرة — {الأب}' },
  { id: 'def_2', category: 'معايدة', title: 'تهنئة عيد ميلاد', message_body: 'كل سنة وأنت طيب يا {الاسم} 🎂🎉 سنة جديدة سعيدة ومباركة بنعمة ربنا يسوع المسيح — {الأب}' },
  { id: 'def_3', category: 'أعياد ومناسبات', title: 'عيد الميلاد المجيد', message_body: 'كل سنة وحضرتك والأسرة بخير بمناسبة عيد الميلاد المجيد 🎄✝ المسيح وُلد.. هللويا! — {الأب}' },
  { id: 'def_4', category: 'أعياد ومناسبات', title: 'عيد القيامة المجيد', message_body: 'اخرستوس آنيستي.. أليثوس آنيستي ✝ كل سنة وحضرتك والأسرة بخير بمناسبة عيد القيامة المجيد — {الأب}' },
  { id: 'def_5', category: 'تعزية', title: 'المسيح يعزيكم', message_body: 'المسيح يعزيكم يا {الاسم} ويهبكم سلاماً وعزاءً سمائياً 🕊️✝ نصلي لأجلكم وللأسرة الكريمة — {الأب}' },
  { id: 'def_6', category: 'متابعة اعتراف', title: 'تذكير بالاعتراف والتناول', message_body: 'سلام ونعمة يا {الاسم} ✝ بنفكرك بميعاد الاعتراف والتناول، منتظرينك في الكنيسة لننال البركة معاً — {الأب}' }
];

export const formatWaMessage = (templateBody, recipientName, priestName) => {
  return (templateBody || '')
    .replace(/\{الاسم\}/g, recipientName || 'أخي/أختي المبارك(ة)')
    .replace(/\{الأب\}/g, priestName || 'الأب الكاهن');
};

export default function WhatsAppComposerModal({
  waModal,
  setWaModal,
  priest,
  users = [],
  visitations = [],
  waTemplates = [],
  setWaTemplates,
  canManageTemplates = true
}) {
  const [waCatFilter, setWaCatFilter] = useState('الكل');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [activeTplBody, setActiveTplBody] = useState('');
  const [newTplForm, setNewTplForm] = useState({ id: null, category: 'افتقاد', title: '', message_body: '' });

  useEffect(() => {
    if (waModal) {
      setRecipientSearch('');
      setActiveTplBody(waModal.templateBody || '');
    }
  }, [Boolean(waModal), waModal?.targetId, waModal?.phone]);

  if (!waModal) return null;

  const activeTpls = waTemplates.length > 0 ? waTemplates : FALLBACK_WA_TEMPLATES;
  const filteredTpls = waCatFilter === 'الكل' ? activeTpls : activeTpls.filter(t => t.category === waCatFilter);

  // بناء قائمة موحدة من الداتابيز (المعترفين عند أبونا + كل الشعب/الخدام + أسماء الافتقاد)
  const searchClean = recipientSearch.trim().toLowerCase();
  const buildSearchPool = () => {
    const map = new Map();
    // 1. المستخدمون من قاعدة البيانات (المعترفون أولاً)
    const sortedUsers = [...users]
      .filter(u => u.role !== 'admin')
      .sort((a, b) => {
        const aMine = a.confession_father_id === priest?.id ? 0 : 1;
        const bMine = b.confession_father_id === priest?.id ? 0 : 1;
        return aMine - bMine;
      });

    sortedUsers.forEach(u => {
      const key = u.id;
      map.set(key, {
        id: u.id,
        name: u.full_name || '',
        phone: u.phone || '',
        tag: u.confession_father_id === priest?.id ? '🙏 معترف' : (u.is_church_member === false ? '🌐 خارج الكنيسة' : '🏠 من الكنيسة'),
        extra: u.detailed_stage || u.service_stage || ''
      });
    });

    // 2. أسماء مسجلة في الافتقاد إن لم تكن مربوطة بحساب
    visitations.forEach(v => {
      if (v.target_name && !v.target_user_id) {
        const key = 'vis_' + v.target_name.trim();
        if (!map.has(key)) {
          map.set(key, {
            id: null,
            name: v.target_name,
            phone: '',
            tag: '🕊️ افتقاد',
            extra: v.visit_method || ''
          });
        }
      }
    });

    return Array.from(map.values());
  };

  const searchResults = !searchClean
    ? []
    : buildSearchPool()
        .filter(item => ((item.name || '') + ' ' + (item.phone || '') + ' ' + (item.extra || '')).toLowerCase().includes(searchClean))
        .slice(0, 12);

  const handlePickRecipient = (person) => {
    const newMsg = activeTplBody
      ? formatWaMessage(activeTplBody, person.name, priest?.full_name)
      : (waModal.name
          ? waModal.message.replaceAll(waModal.name, person.name)
          : formatWaMessage(activeTpls[0]?.message_body || 'سلام ونعمة يا {الاسم} ✝', person.name, priest?.full_name));

    setWaModal({
      ...waModal,
      name: person.name,
      phone: person.phone || waModal.phone,
      targetId: person.id,
      message: newMsg
    });
    setRecipientSearch('');
  };

  const sendWhatsAppFromModal = async () => {
    const clean = (waModal.phone || '').replace(/\s+/g, '');
    if (!clean) return alert('برجاء إدخال رقم الواتساب أولاً');
    const intl = clean.startsWith('0') ? `2${clean}` : clean;
    const url = `https://wa.me/${intl}?text=${encodeURIComponent(waModal.message)}`;

    await logActivity({
      user: priest,
      actionType: 'إرسال_واتساب',
      targetTable: 'church_users',
      targetId: waModal.targetId,
      description: `فتح إرسال رسالة واتساب إلى (${waModal.name || clean}): "${waModal.message.slice(0, 70)}..."`
    });

    window.open(url, '_blank', 'noopener,noreferrer');
    setWaModal(null);
  };

  const handleSaveWaTemplate = async (e) => {
    e.preventDefault();
    if (!canManageTemplates) return alert('صلاحية تعديل القوالب مغلقة من الأدمن.');
    if (!newTplForm.title.trim() || !newTplForm.message_body.trim()) return;

    if (newTplForm.id && !String(newTplForm.id).startsWith('def_')) {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .update({
          category: newTplForm.category,
          title: newTplForm.title.trim(),
          message_body: newTplForm.message_body.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', newTplForm.id)
        .select().single();
      if (!error && data) {
        setWaTemplates(waTemplates.map(t => (t.id === data.id ? data : t)));
        setNewTplForm({ id: null, category: 'افتقاد', title: '', message_body: '' });
        logActivity({ user: priest, actionType: 'تعديل_قالب_واتساب', targetTable: 'whatsapp_templates', targetId: data.id, description: `عدل قالب واتساب: ${data.title}` });
      } else if (error) alert(error.message);
    } else {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .insert([{
          priest_id: priest.id,
          created_by: priest.id,
          category: newTplForm.category,
          title: newTplForm.title.trim(),
          message_body: newTplForm.message_body.trim()
        }])
        .select().single();
      if (!error && data) {
        const cleaned = waTemplates.filter(t => !String(t.id).startsWith('def_'));
        setWaTemplates([...cleaned, data]);
        setNewTplForm({ id: null, category: 'افتقاد', title: '', message_body: '' });
        logActivity({ user: priest, actionType: 'إضافة_قالب_واتساب', targetTable: 'whatsapp_templates', targetId: data.id, description: `أضاف قالب واتساب جديد: ${data.title}` });
      } else if (error) alert(error.message);
    }
  };

  const handleDeleteWaTemplate = async (tpl) => {
    if (!canManageTemplates) return;
    if (!tpl.priest_id) return alert('هذا القالب عام من الأدمن ولا يمكن حذفه من هنا.');
    if (!confirm(`حذف القالب "${tpl.title}"؟`)) return;
    const { error } = await supabase.from('whatsapp_templates').delete().eq('id', tpl.id);
    if (!error) {
      setWaTemplates(waTemplates.filter(t => t.id !== tpl.id));
      logActivity({ user: priest, actionType: 'حذف_قالب_واتساب', targetTable: 'whatsapp_templates', targetId: tpl.id, description: `حذف قالب واتساب: ${tpl.title}` });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-80">
      <div className="bg-white rounded-3xl w-full max-w-2xl p-6 space-y-4 font-bold max-h-[92vh] overflow-y-auto text-sm">
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <h3 className="text-lg font-black text-green-800 flex items-center gap-2">
              <MessageCircle size={20} /> إرسال رسالة واتساب {waModal.name ? `إلى: ${waModal.name}` : ''}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              الإرسال من رقم أبونا: <strong>{priest.whatsapp_sender_phone || priest.phone || 'رقم الواتساب المفتوح على جهازك'}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWaModal({ ...waModal, showTemplatesManager: !waModal.showTemplatesManager })}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer flex items-center gap-1 ${
                waModal.showTemplatesManager ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-amber-50 text-amber-950 border-amber-300'
              }`}
            >
              <Settings size={14} /> {waModal.showTemplatesManager ? 'العودة للإرسال' : 'إدارة القوالب الممنهجة'}
            </button>
            <button type="button" onClick={() => setWaModal(null)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"><X size={18} /></button>
          </div>
        </div>

        {waModal.showTemplatesManager ? (
          <div className="space-y-4">
            {!canManageTemplates ? (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl text-xs flex items-center gap-2">
                <Lock size={18} /> صلاحية إضافة وتعديل قوالب الواتساب مغلقة حالياً من قِبل الأدمن. يمكنك اختيار القوالب الجاهزة وتعديل نص الرسالة قبل الإرسال فقط.
              </div>
            ) : (
              <form onSubmit={handleSaveWaTemplate} className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-2.5">
                <strong className="text-amber-950 block">{newTplForm.id ? '✏️ تعديل قالب رسالة' : '➕ إضافة قالب رسالة جديد (معايدة / افتقاد / تعزية / طلب)'}</strong>
                <div className="grid sm:grid-cols-2 gap-2">
                  <select className="p-2.5 border rounded-xl bg-white" value={newTplForm.category} onChange={e => setNewTplForm({ ...newTplForm, category: e.target.value })}>
                    {WA_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input required placeholder="عنوان القالب (مثال: تهنئة عيد الغطاس)" className="p-2.5 border rounded-xl bg-white" value={newTplForm.title} onChange={e => setNewTplForm({ ...newTplForm, title: e.target.value })} />
                </div>
                <div className="text-[11px] text-gray-600 flex flex-wrap gap-1.5 items-center">
                  <span>متغيرات ذكية:</span>
                  <button type="button" onClick={() => setNewTplForm({ ...newTplForm, message_body: newTplForm.message_body + ' {الاسم} ' })} className="px-2 py-0.5 bg-white border rounded-lg cursor-pointer">+ {'{الاسم}'}</button>
                  <button type="button" onClick={() => setNewTplForm({ ...newTplForm, message_body: newTplForm.message_body + ' {الأب} ' })} className="px-2 py-0.5 bg-white border rounded-lg cursor-pointer">+ {'{الأب}'}</button>
                </div>
                <textarea required rows="3" placeholder="اكتب نص الرسالة الممنهج هنا..." className="w-full p-2.5 border rounded-xl bg-white font-normal" value={newTplForm.message_body} onChange={e => setNewTplForm({ ...newTplForm, message_body: e.target.value })} />
                <div className="flex gap-2">
                  <button type="submit" className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer">{newTplForm.id ? 'حفظ التعديل' : 'إضافة القالب'}</button>
                  {newTplForm.id && <button type="button" onClick={() => setNewTplForm({ id: null, category: 'افتقاد', title: '', message_body: '' })} className="px-4 py-2 border rounded-xl bg-white">إلغاء</button>}
                </div>
              </form>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {activeTpls.map(t => (
                <div key={t.id} className="p-3 bg-gray-50 border rounded-2xl flex justify-between items-start gap-2">
                  <div>
                    <span className="px-2 py-0.5 bg-green-100 text-green-900 rounded text-[11px] ml-1.5">{t.category}</span>
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-800 rounded text-[10px] ml-1.5">{t.priest_id ? 'خاص بأبونا' : 'قالب عام'}</span>
                    <strong className="text-sm">{t.title}</strong>
                    <p className="text-xs text-gray-600 font-normal mt-1">{t.message_body}</p>
                  </div>
                  {canManageTemplates && t.priest_id && (
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => setNewTplForm({ id: t.id, category: t.category, title: t.title, message_body: t.message_body })} className="p-1.5 bg-white border rounded-lg"><Edit3 size={14} /></button>
                      <button type="button" onClick={() => handleDeleteWaTemplate(t)} className="p-1.5 bg-red-50 text-red-700 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* بحث فوري في قاعدة بيانات المعترفين والافتقاد */}
            <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200 space-y-2">
              <label className="text-xs text-blue-950 font-black flex items-center gap-1.5">
                <Search size={14} /> ابحث بالاسم أو رقم التليفون من المعترفين / الافتقاد (يظهر فوراً):
              </label>
              <input
                type="text"
                placeholder="اكتب جزء من الاسم أو رقم الموبايل (مثال: مينا أو 012...)..."
                className="w-full p-2.5 border rounded-xl bg-white text-xs"
                value={recipientSearch}
                onChange={e => setRecipientSearch(e.target.value)}
              />
              {searchClean && (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pt-1">
                  {searchResults.length === 0 ? (
                    <p className="text-xs text-gray-600 bg-white p-2 rounded-xl">لا توجد أسماء مطابقة في الداتابيز. يمكنك إدخال الرقم يدوياً بالأسفل.</p>
                  ) : (
                    searchResults.map((person, idx) => (
                      <button
                        key={person.id || idx}
                        type="button"
                        onClick={() => handlePickRecipient(person)}
                        className="w-full text-right bg-white hover:bg-green-50 border border-blue-200 hover:border-green-500 p-2.5 rounded-xl flex justify-between items-center gap-2 cursor-pointer transition"
                      >
                        <div className="text-xs">
                          <strong className="text-sm text-gray-900">{person.name}</strong>
                          <span className="mr-2 px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-[10px]">{person.tag}</span>
                          {person.extra && <span className="mr-1 text-gray-500">({person.extra})</span>}
                          <span className="block text-gray-600 mt-0.5">📞 {person.phone || 'بدون رقم مسجل'}</span>
                        </div>
                        <span className="px-2.5 py-1 bg-green-600 text-white rounded-lg text-[11px] flex items-center gap-1 shrink-0">
                          <UserCheck size={13} /> اختيار
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-700 mb-1">اسم المستلم:</label>
                <input
                  className="w-full p-2.5 border rounded-xl bg-gray-50"
                  value={waModal.name}
                  onChange={e => setWaModal({ ...waModal, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">رقم الواتساب المستلم *</label>
                <input
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  className="w-full p-2.5 border rounded-xl"
                  value={waModal.phone}
                  onChange={e => setWaModal({ ...waModal, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border space-y-2">
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-gray-700 ml-1">اختر رسالة ممنهجة:</span>
                {['الكل', ...WA_CATEGORIES].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setWaCatFilter(c)}
                    className={`px-2.5 py-1 rounded-lg text-xs border cursor-pointer ${waCatFilter === c ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-gray-700'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
                {filteredTpls.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveTplBody(t.message_body);
                      setWaModal({ ...waModal, message: formatWaMessage(t.message_body, waModal.name, priest?.full_name) });
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-green-50 border border-green-300 text-green-950 rounded-xl text-xs cursor-pointer transition"
                  >
                    📝 {t.title}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">نص الرسالة (يمكنك التعديل عليه بحرية قبل الإرسال):</label>
              <textarea
                rows="4"
                className="w-full p-3 border-2 border-green-300 rounded-2xl font-normal focus:outline-none focus:border-green-600"
                value={waModal.message}
                onChange={e => setWaModal({ ...waModal, message: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={sendWhatsAppFromModal}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send size={16} /> إرسال الآن عبر واتساب 💬
              </button>
              <button type="button" onClick={() => setWaModal(null)} className="px-5 py-3 border rounded-xl cursor-pointer">إلغاء</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BookOpen, Save, Upload, Edit3, Eye } from 'lucide-react';

const AGPEYA_HOURS = [
  { key: 'intro', title: '✝ الصلوات الافتتاحية المشتركة', time: 'تُتلى في بداية كل ساعة' },
  { key: 'baker', title: '🌅 صلاة باكر', time: '6:00 ص' },
  { key: 'third', title: '🕒 صلاة الساعة الثالثة', time: '9:00 ص' },
  { key: 'sixth', title: '☀️ صلاة الساعة السادسة', time: '12:00 ظ' },
  { key: 'ninth', title: '🌤️ صلاة الساعة التاسعة', time: '3:00 م' },
  { key: 'vespers', title: '🌇 صلاة الغروب', time: '5:00 م' },
  { key: 'compline', title: '🌙 صلاة النوم', time: '9:00 م' },
  { key: 'midnight', title: '🕯️ صلاة نصف الليل (3 خدمات)', time: '12:00 ص' },
  { key: 'veil', title: '🕊️ صلاة الستار', time: 'صلاة خاصة' }
];

const COMMON_OPENING_TEXT = `باسم الآب والابن والروح القدس الإله الواحد آمين.
يا رب ارحم. يا رب ارحم. يا رب بارك. آمين.
المجد للآب والابن والروح القدس الآن وكل أوان وإلى دهر الدهور آمين.

• الصلاة الربانية:
أبانا الذي في السماوات، ليتقدس اسمك، ليأت ملكوتك، لتكن مشيئتك، كما في السماء كذلك على الأرض. خبزنا الذي للغد أعطنا اليوم، واغفر لنا ذنوبنا كما نغفر نحن أيضاً للمذنبين إلينا، ولا تدخلنا في تجربة، لكن نجنا من الشرير، بالمسيح يسوع ربنا، لأن لك الملك والقوة والمجد إلى الأبد آمين.

• صلاة الشكر:
فلنشكر صانع الخيرات الرحوم الله، أبا ربنا وإلهنا ومخلصنا يسوع المسيح، لأنه سترنا وأعاننا وحفظنا وقبلنا إليه وأشفق علينا وعضدنا وأتى بنا إلى هذه الساعة...

• قدوس الله، قدوس القوي، قدوس الحي الذي لا يموت... (ثلاثاً)

• قانون الإيمان الأرثوذكسي:
بالحقيقة نؤمن بإله واحد الله الآب ضابط الكل خالق السماء والأرض ما يُرى وما لا يُرى...`;

export default function AgpeyaPanel({ canEdit = false }) {
  const [selectedKey, setSelectedKey] = useState('baker');
  const [rows, setRows] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    intro_notes: '',
    psalms_text: '',
    gospel_text: '',
    litanies_text: '',
    absolution_text: ''
  });

  const loadAgpeya = async () => {
    const { data } = await supabase.from('agpeya_prayers').select('*');
    if (data) setRows(data);
  };

  useEffect(() => {
    loadAgpeya();
  }, []);

  const currentHourMeta = AGPEYA_HOURS.find(h => h.key === selectedKey) || AGPEYA_HOURS[1];

  useEffect(() => {
    const found = rows.find(r => r.hour_key === selectedKey);
    if (found) {
      setForm({
        intro_notes: found.intro_notes || '',
        psalms_text: found.psalms_text || '',
        gospel_text: found.gospel_text || '',
        litanies_text: found.litanies_text || '',
        absolution_text: found.absolution_text || ''
      });
    } else {
      setForm({
        intro_notes: selectedKey === 'intro' ? COMMON_OPENING_TEXT : '',
        psalms_text: '',
        gospel_text: '',
        litanies_text: '',
        absolution_text: ''
      });
    }
  }, [selectedKey, rows]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        hour_key: selectedKey,
        hour_title: currentHourMeta.title,
        hour_time: currentHourMeta.time,
        ...form,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('agpeya_prayers')
        .upsert(payload, { onConflict: 'hour_key' })
        .select()
        .single();
      if (error) return alert('خطأ: ' + error.message);
      setRows(prev => [...prev.filter(x => x.hour_key !== selectedKey), data]);
      setEditMode(false);
      alert(`تم حفظ (${currentHourMeta.title}) في الداتابيز بنجاح ✅`);
    } finally {
      setSaving(false);
    }
  };

  // استيراد ملف JSON للأجبية بالكامل مرة واحدة
  const handleImportJson = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : [];
      if (list.length === 0) return alert('ملف JSON فارغ أو غير صالح.');
      const { error } = await supabase.from('agpeya_prayers').upsert(list, { onConflict: 'hour_key' });
      if (error) return alert('خطأ في الاستيراد: ' + error.message);
      await loadAgpeya();
      alert(`تم استيراد ${list.length} ساعة من الأجبية إلى الداتابيز بنجاح ✅`);
    } catch {
      alert('تأكد أن الملف بصيغة JSON صحيحة.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-4 text-xs md:text-sm" dir="rtl">
      <div className="bg-white p-4 rounded-3xl border shadow-sm space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div>
            <h3 className="text-base font-black text-[#7a1c24] flex items-center gap-1.5">
              <BookOpen size={18} /> الأجبية المقدسة (صلوات السواعي)
            </h3>
            <p className="text-xs text-gray-500">اختر الساعة للقراءة أو تعديل نصوصها وحفظها في الداتابيز</p>
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <label className="px-3 py-2 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                <Upload size={14} /> استيراد JSON
                <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportJson} />
              </label>
              <button
                type="button"
                onClick={() => setEditMode(!editMode)}
                className="px-3.5 py-2 bg-amber-100 text-amber-950 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                {editMode ? <><Eye size={14} /> وضع القراءة</> : <><Edit3 size={14} /> تعديل نصوص الساعة</>}
              </button>
            </div>
          )}
        </div>

        {/* أزرار ساعات الأجبية */}
        <div className="flex flex-wrap gap-1.5">
          {AGPEYA_HOURS.map(h => {
            const hasSaved = rows.some(r => r.hour_key === h.key && (r.psalms_text || r.gospel_text || r.intro_notes));
            return (
              <button
                key={h.key}
                type="button"
                onClick={() => setSelectedKey(h.key)}
                className={`px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition ${
                  selectedKey === h.key
                    ? 'bg-[#7a1c24] text-white border-[#7a1c24]'
                    : hasSaved
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-800'
                }`}
              >
                {h.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* عرض أو تعديل الساعة المختارة */}
      {editMode && canEdit ? (
        <form onSubmit={handleSave} className="bg-white p-5 rounded-3xl border shadow-sm space-y-3 font-bold">
          <div className="flex justify-between items-center border-b pb-2">
            <strong className="text-base text-[#7a1c24]">{currentHourMeta.title} ({currentHourMeta.time})</strong>
            <button type="submit" disabled={saving} className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl flex items-center gap-1.5 cursor-pointer">
              <Save size={15} /> {saving ? 'جاري الحفظ...' : 'حفظ في الداتابيز'}
            </button>
          </div>

          {selectedKey === 'intro' ? (
            <div>
              <label className="block mb-1">نص الصلوات الافتتاحية المشتركة</label>
              <textarea rows="12" className="w-full p-3 border rounded-2xl font-normal leading-relaxed" value={form.intro_notes} onChange={e => setForm({ ...form, intro_notes: e.target.value })} />
            </div>
          ) : (
            <>
              <div>
                <label className="block mb-1 text-[#7a1c24]">مقدمة الساعة / المزمور الخمسين</label>
                <textarea rows="3" placeholder="مقدمة الساعة..." className="w-full p-2.5 border rounded-xl font-normal" value={form.intro_notes} onChange={e => setForm({ ...form, intro_notes: e.target.value })} />
              </div>
              <div>
                <label className="block mb-1 text-[#7a1c24]">📖 المزامير</label>
                <textarea rows="6" placeholder="نصوص المزامير لهذه الساعة..." className="w-full p-2.5 border rounded-xl font-normal" value={form.psalms_text} onChange={e => setForm({ ...form, psalms_text: e.target.value })} />
              </div>
              <div>
                <label className="block mb-1 text-[#7a1c24]">✝ الإنجيل المقدس</label>
                <textarea rows="4" placeholder="فصل الإنجيل..." className="w-full p-2.5 border rounded-xl font-normal" value={form.gospel_text} onChange={e => setForm({ ...form, gospel_text: e.target.value })} />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-[#7a1c24]">🕯️ القطع</label>
                  <textarea rows="4" placeholder="القطع..." className="w-full p-2.5 border rounded-xl font-normal" value={form.litanies_text} onChange={e => setForm({ ...form, litanies_text: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-1 text-[#7a1c24]">🙏 التحليل والختام</label>
                  <textarea rows="4" placeholder="التحليل..." className="w-full p-2.5 border rounded-xl font-normal" value={form.absolution_text} onChange={e => setForm({ ...form, absolution_text: e.target.value })} />
                </div>
              </div>
            </>
          )}
        </form>
      ) : (
        <div className="bg-white p-5 md:p-6 rounded-3xl border shadow-sm space-y-4">
          <div className="border-b pb-3 flex justify-between items-center">
            <div>
              <h4 className="text-lg font-black text-[#7a1c24]">{currentHourMeta.title}</h4>
              <span className="text-xs text-gray-500">{currentHourMeta.time}</span>
            </div>
          </div>

          {selectedKey === 'intro' ? (
            <div className="p-4 bg-[#fbfaf7] rounded-2xl border text-sm leading-loose whitespace-pre-line text-gray-800">
              {form.intro_notes || COMMON_OPENING_TEXT}
            </div>
          ) : !form.intro_notes && !form.psalms_text && !form.gospel_text && !form.litanies_text && !form.absolution_text ? (
            <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 text-center space-y-2">
              <p className="text-sm font-bold text-amber-950">لم تُضاف نصوص ({currentHourMeta.title}) في الداتابيز بعد.</p>
              {canEdit && (
                <button type="button" onClick={() => setEditMode(true)} className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl text-xs font-black cursor-pointer">
                  + إضافة نصوص الساعة الآن
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4 text-sm leading-loose">
              {form.intro_notes && (
                <div className="p-4 bg-[#fbfaf7] rounded-2xl border">
                  <strong className="text-[#7a1c24] block mb-1">مقدمة الساعة:</strong>
                  <p className="whitespace-pre-line text-gray-800">{form.intro_notes}</p>
                </div>
              )}
              {form.psalms_text && (
                <div className="p-4 bg-[#fbfaf7] rounded-2xl border">
                  <strong className="text-[#7a1c24] block mb-1">📖 المزامير:</strong>
                  <p className="whitespace-pre-line text-gray-800">{form.psalms_text}</p>
                </div>
              )}
              {form.gospel_text && (
                <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200">
                  <strong className="text-[#7a1c24] block mb-1">✝ الإنجيل المقدس:</strong>
                  <p className="whitespace-pre-line text-gray-900">{form.gospel_text}</p>
                </div>
              )}
              {form.litanies_text && (
                <div className="p-4 bg-[#fbfaf7] rounded-2xl border">
                  <strong className="text-[#7a1c24] block mb-1">🕯️ القطع:</strong>
                  <p className="whitespace-pre-line text-gray-800">{form.litanies_text}</p>
                </div>
              )}
              {form.absolution_text && (
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200">
                  <strong className="text-[#7a1c24] block mb-1">🙏 التحليل:</strong>
                  <p className="whitespace-pre-line text-gray-800">{form.absolution_text}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
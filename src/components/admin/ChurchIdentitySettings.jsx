import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { uploadChurchMedia } from '../../lib/mediaUpload';
import { Settings, Upload, Save } from 'lucide-react';

export default function ChurchIdentitySettings({
  churchName = 'كنيسة السيدة العذراء مريم بالمطرية',
  requireAdminGuard,
  onRefresh
}) {
  const [logoRowId, setLogoRowId] = useState(null);
  const [settingsRowId, setSettingsRowId] = useState(null);
  const [churchSettingsForm, setChurchSettingsForm] = useState({
    title: churchName,
    body: 'مواعيد القداسات، الرحلات، أخبار الكنيسة، والآباء الكهنة',
    url: '',
    virgin_mary_image_url: '',
    church_phone: '',
    emergency_notice: ''
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingMary, setUploadingMary] = useState(false);

  const loadChurchIdentity = async () => {
    const [pubLogo, stRow] = await Promise.all([
      supabase.from('church_public_content').select('*').eq('kind', 'logo').limit(1).maybeSingle(),
      supabase.from('church_settings').select('*').limit(1).maybeSingle()
    ]);

    if (pubLogo.data) setLogoRowId(pubLogo.data.id);
    if (stRow.data) setSettingsRowId(stRow.data.id);

    const savedNotice = localStorage.getItem('church_emergency_notice') || '';
    const savedPhone = localStorage.getItem('church_emergency_phone') || '';

    setChurchSettingsForm({
      title: pubLogo.data?.title || stRow.data?.church_name || churchName,
      body: pubLogo.data?.body || 'مواعيد القداسات، الرحلات، أخبار الكنيسة، والآباء الكهنة',
      url: pubLogo.data?.url || stRow.data?.logo_url || '',
      virgin_mary_image_url: stRow.data?.virgin_mary_image_url || '',
      church_phone: stRow.data?.church_phone || savedPhone,
      emergency_notice: stRow.data?.emergency_notice || savedNotice
    });
  };

  useEffect(() => {
    loadChurchIdentity();
  }, []);

  const handleUploadLogo = async (e) => {
    if (requireAdminGuard && !requireAdminGuard()) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadChurchMedia(file, 'logo');
      setChurchSettingsForm(prev => ({ ...prev, url }));
    } catch (err) {
      alert('تعذر رفع اللوجو: ' + err.message);
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleUploadMaryImage = async (e) => {
    if (requireAdminGuard && !requireAdminGuard()) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMary(true);
    try {
      const url = await uploadChurchMedia(file, 'virgin_mary');
      setChurchSettingsForm(prev => ({ ...prev, virgin_mary_image_url: url }));
    } catch (err) {
      alert('تعذر رفع صورة السيدة العذراء: ' + err.message);
    } finally {
      setUploadingMary(false);
      e.target.value = '';
    }
  };

  const handleSaveChurchIdentity = async (e) => {
    e.preventDefault();
    if (requireAdminGuard && !requireAdminGuard()) return;
    setSavingSettings(true);
    try {
      const finalName = churchSettingsForm.title.trim() || 'كنيسة السيدة العذراء مريم بالمطرية';
      const payload = {
        kind: 'logo',
        title: finalName,
        body: churchSettingsForm.body.trim(),
        url: churchSettingsForm.url.trim(),
        sort_order: 0
      };
      if (logoRowId) {
        await supabase.from('church_public_content').update(payload).eq('id', logoRowId);
      } else {
        const { data } = await supabase.from('church_public_content').insert([payload]).select().single();
        if (data) setLogoRowId(data.id);
      }

      await supabase.from('church_settings').upsert([{
        id: settingsRowId || 1,
        church_name: finalName,
        logo_url: churchSettingsForm.url.trim(),
        virgin_mary_image_url: churchSettingsForm.virgin_mary_image_url.trim(),
        updated_at: new Date().toISOString()
      }]);

      localStorage.setItem('church_emergency_phone', churchSettingsForm.church_phone?.trim() || '');
      localStorage.setItem('church_emergency_notice', churchSettingsForm.emergency_notice?.trim() || '');

      if (onRefresh) await onRefresh();
      alert('تم حفظ اسم وهوية الكنيسة وتليفون الطوارئ واللوجو وصورة العذراء بنجاح ✅');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <form onSubmit={handleSaveChurchIdentity} className="bg-white p-5 rounded-3xl border shadow-sm space-y-3 max-w-2xl font-bold text-xs">
      <div className="flex items-center gap-2 text-[#7a1c24] text-sm font-black border-b pb-2">
        <Settings size={17} /> تخصيص اسم الكنيسة، لوجو الكنيسة، صورة السيدة العذراء، وأرقام التواصل
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block mb-1">اسم الكنيسة الرسمي *</label>
          <input required placeholder="كنيسة السيدة العذراء مريم..." className="w-full p-2 border rounded-xl text-sm bg-white" value={churchSettingsForm.title} onChange={e => setChurchSettingsForm({ ...churchSettingsForm, title: e.target.value })} />
        </div>
        <div>
          <label className="block mb-1">📞 تليفون الكنيسة / الخط الساخن للطوارئ</label>
          <input placeholder="01xxxxxxxxx / 02xxxxxxx" className="w-full p-2 border rounded-xl bg-white" value={churchSettingsForm.church_phone || ''} onChange={e => setChurchSettingsForm({ ...churchSettingsForm, church_phone: e.target.value })} />
        </div>
      </div>

      <div>
        <label className="block mb-1">الشعار / الوصف المختصر أسفل الاسم</label>
        <input className="w-full p-2 border rounded-xl bg-white" value={churchSettingsForm.body} onChange={e => setChurchSettingsForm({ ...churchSettingsForm, body: e.target.value })} />
      </div>

      <div>
        <label className="block mb-1 text-red-700 font-black">🚨 شريط تنبيه / خبر عاجل (يظهر للجميع في الصفحة الرئيسية):</label>
        <input placeholder="اكتب أي إشعار أو تنبيه طارئ يظهر للكل في الصفحة الرئيسية..." className="w-full p-2 border border-red-300 rounded-xl bg-red-50/50" value={churchSettingsForm.emergency_notice || ''} onChange={e => setChurchSettingsForm({ ...churchSettingsForm, emergency_notice: e.target.value })} />
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5">
        <div className="bg-indigo-50/60 p-3 rounded-2xl border border-indigo-200 space-y-2">
          <label className="block text-indigo-950 font-black">لوجو الكنيسة (رفع ملف مباشر من جهازك JPG / PNG / WEBP):</label>
          <div className="flex flex-wrap gap-2 items-center">
            <label className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${uploadingLogo ? 'bg-gray-300 text-gray-600' : 'bg-indigo-700 hover:bg-indigo-800 text-white shadow'}`}>
              <Upload size={13} /> {uploadingLogo ? 'جاري الرفع...' : 'اختر لوجو الكنيسة من جهازك'}
              <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={handleUploadLogo} />
            </label>
            {churchSettingsForm.url && (
              <button type="button" onClick={() => setChurchSettingsForm(prev => ({ ...prev, url: '' }))} className="px-2.5 py-1.5 bg-red-100 text-red-700 rounded-xl font-bold cursor-pointer">حذف اللوجو الحالي</button>
            )}
          </div>
          {churchSettingsForm.url && <img src={churchSettingsForm.url} alt="لوجو الكنيسة" className="h-16 rounded-xl border object-cover bg-white p-1" />}
        </div>

        <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200 space-y-2">
          <label className="block text-amber-950 font-black">صورة السيدة العذراء مريم (رفع ملف مباشر من جهازك JPG / PNG / WEBP):</label>
          <div className="flex flex-wrap gap-2 items-center">
            <label className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${uploadingMary ? 'bg-gray-300 text-gray-600' : 'bg-amber-700 hover:bg-amber-800 text-white shadow'}`}>
              <Upload size={13} /> {uploadingMary ? 'جاري الرفع...' : 'اختر صورة السيدة العذراء من جهازك'}
              <input type="file" accept="image/*" className="hidden" disabled={uploadingMary} onChange={handleUploadMaryImage} />
            </label>
            {churchSettingsForm.virgin_mary_image_url && (
              <button type="button" onClick={() => setChurchSettingsForm(prev => ({ ...prev, virgin_mary_image_url: '' }))} className="px-2.5 py-1.5 bg-red-100 text-red-700 rounded-xl font-bold cursor-pointer">حذف صورة العذراء</button>
            )}
          </div>
          {churchSettingsForm.virgin_mary_image_url && <img src={churchSettingsForm.virgin_mary_image_url} alt="السيدة العذراء" className="h-16 rounded-xl border object-cover bg-white p-1" />}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" disabled={savingSettings || uploadingLogo || uploadingMary} className="px-5 py-2.5 bg-[#7a1c24] text-white rounded-xl font-black text-xs flex items-center gap-2 cursor-pointer shadow">
          <Save size={15} /> {savingSettings ? 'جاري الحفظ...' : 'حفظ هوية الكنيسة والتليفون والصور ✅'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirm('مسح الحقول وتفريغ الصور؟')) return;
            setChurchSettingsForm({ title: '', body: '', url: '', virgin_mary_image_url: '', church_phone: '', emergency_notice: '' });
          }}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold cursor-pointer"
        >
          مسح الحقول
        </button>
      </div>
    </form>
  );
}
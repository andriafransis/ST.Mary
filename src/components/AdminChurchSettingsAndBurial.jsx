import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { uploadChurchMedia } from '../lib/mediaUpload';
import { MapPin, Package, Trash2, Edit3, Music, Upload, Star, Volume2 } from 'lucide-react';

export default function AdminChurchSettingsAndBurial({ currentUser }) {
  const [tab, setTab] = useState('burial'); // 'burial' | 'caskets' | 'audio'
  const [burials, setBurials] = useState([]);
  const [caskets, setCaskets] = useState([]);
  const [audioTracks, setAudioTracks] = useState([]);

  const [burialForm, setBurialForm] = useState({ id: null, location_name: '', area_address: '', transport_fee: 0, notes: '' });
  const [casketForm, setCasketForm] = useState({ id: null, casket_name: '', casket_size: 'كبير', price: 0, status: 'متاح', notes: '' });
  const [audioForm, setAudioForm] = useState({ id: null, title: '', audio_url: '', is_default: false, sort_order: 1, default_volume: 25 });
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  const loadAll = async () => {
    if (!isAdmin) return;
    const [bl, fk, au] = await Promise.all([
      supabase.from('burial_locations').select('*').order('location_name', { ascending: true }),
      supabase.from('funeral_caskets').select('*').order('created_at', { ascending: false }),
      supabase.from('joseph_audio_tracks').select('*').order('sort_order', { ascending: true })
    ]);

    if (bl.data) setBurials(bl.data);
    if (fk.data) setCaskets(fk.data);
    if (au.data) {
      const tracksWithVol = au.data.map(t => {
        const savedVol = localStorage.getItem(`joseph_vol_${t.id}`);
        return {
          ...t,
          default_volume: t.default_volume ? Number(t.default_volume) : (savedVol ? Number(savedVol) : 25)
        };
      });
      setAudioTracks(tracksWithVol);
    }
  };

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin]);

  if (!isAdmin) return null;

  const saveBurial = async (e) => {
    e.preventDefault();
    const payload = {
      location_name: burialForm.location_name,
      area_address: burialForm.area_address,
      transport_fee: Number(burialForm.transport_fee || 0),
      notes: burialForm.notes,
      is_active: true
    };
    if (burialForm.id) {
      const { data, error } = await supabase.from('burial_locations').update(payload).eq('id', burialForm.id).select().single();
      if (error) return alert(error.message);
      setBurials(burials.map(b => (b.id === burialForm.id ? data : b)));
    } else {
      const { data, error } = await supabase.from('burial_locations').insert([payload]).select().single();
      if (error) return alert(error.message);
      setBurials([...burials, data]);
    }
    setBurialForm({ id: null, location_name: '', area_address: '', transport_fee: 0, notes: '' });
  };

  const saveCasket = async (e) => {
    e.preventDefault();
    const payload = {
      casket_name: casketForm.casket_name,
      casket_size: casketForm.casket_size,
      price: Number(casketForm.price || 0),
      status: casketForm.status,
      notes: casketForm.notes
    };
    if (casketForm.id) {
      const { data, error } = await supabase.from('funeral_caskets').update(payload).eq('id', casketForm.id).select().single();
      if (error) return alert(error.message);
      setCaskets(caskets.map(c => (c.id === casketForm.id ? data : c)));
    } else {
      const { data, error } = await supabase.from('funeral_caskets').insert([payload]).select().single();
      if (error) return alert(error.message);
      setCaskets([data, ...caskets]);
    }
    setCasketForm({ id: null, casket_name: '', casket_size: 'كبير', price: 0, status: 'متاح', notes: '' });
  };

  const handleUploadAudioFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAudio(true);
    try {
      const url = await uploadChurchMedia(file, 'joseph_audio');
      setAudioForm(prev => ({
        ...prev,
        audio_url: url,
        title: prev.title || file.name.replace(/\.[^/.]+$/, '')
      }));
    } catch (err) {
      alert('تعذر رفع الملف الصوتي: ' + err.message);
    } finally {
      setUploadingAudio(false);
      e.target.value = '';
    }
  };

  const saveAudioTrack = async (e) => {
    e.preventDefault();
    if (!audioForm.title.trim()) return;
    if (audioForm.is_default) {
      await supabase.from('joseph_audio_tracks').update({ is_default: false }).neq('id', audioForm.id || '00000000-0000-0000-0000-000000000000');
    }
    const volNum = Number(audioForm.default_volume || 25);
    const payload = {
      title: audioForm.title.trim(),
      audio_url: audioForm.audio_url.trim(),
      is_default: Boolean(audioForm.is_default),
      is_active: true,
      sort_order: Number(audioForm.sort_order || 1)
    };

    if (audioForm.id) {
      const { data, error } = await supabase.from('joseph_audio_tracks').update(payload).eq('id', audioForm.id).select().single();
      if (error) return alert(error.message);
      localStorage.setItem(`joseph_vol_${audioForm.id}`, String(volNum));
      localStorage.setItem('joseph_global_volume', String(volNum));
      if (data) await loadAll();
    } else {
      const { data, error } = await supabase.from('joseph_audio_tracks').insert([payload]).select().single();
      if (error) return alert(error.message);
      if (data) {
        localStorage.setItem(`joseph_vol_${data.id}`, String(volNum));
        localStorage.setItem('joseph_global_volume', String(volNum));
        await loadAll();
      }
    }
    setAudioForm({ id: null, title: '', audio_url: '', is_default: false, sort_order: audioTracks.length + 1, default_volume: 25 });
  };

  const handleQuickVolumeChange = (trackId, newVol) => {
    localStorage.setItem(`joseph_vol_${trackId}`, String(newVol));
    localStorage.setItem('joseph_global_volume', String(newVol));
    setAudioTracks(prev => prev.map(t => (t.id === trackId ? { ...t, default_volume: newVol } : t)));
    supabase.from('joseph_audio_tracks').update({ default_volume: newVol }).eq('id', trackId).then(() => {});
  };

  const setDefaultAudio = async (trackId) => {
    await supabase.from('joseph_audio_tracks').update({ is_default: false }).neq('id', trackId);
    await supabase.from('joseph_audio_tracks').update({ is_default: true }).eq('id', trackId);
    await loadAll();
  };

  return (
    <div className="bg-white p-5 rounded-3xl border space-y-4 text-xs md:text-sm" dir="rtl">
      <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3">
        <strong className="text-base font-black text-[#7a1c24]">⚙️ إعدادات الأدمن: أماكن الدفن، الصناديق، وألحان يوسف الرامي</strong>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setTab('burial')} className={`px-4 py-2 rounded-xl font-bold cursor-pointer ${tab === 'burial' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100'}`}><MapPin size={14} className="inline ml-1" /> أماكن الدفن والأسعار</button>
          <button type="button" onClick={() => setTab('caskets')} className={`px-4 py-2 rounded-xl font-bold cursor-pointer ${tab === 'caskets' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100'}`}><Package size={14} className="inline ml-1" /> مخزون الصناديق</button>
          <button type="button" onClick={() => setTab('audio')} className={`px-4 py-2 rounded-xl font-bold cursor-pointer ${tab === 'audio' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100'}`}><Music size={14} className="inline ml-1" /> ألحان وترانيم يوسف الرامي ({audioTracks.length})</button>
        </div>
      </div>

      {/* 1) أماكن الدفن والأسعار مع الترقيم التسلسلي (م / 1، 2، 3...) */}
      {tab === 'burial' && (
        <div className="space-y-3">
          <form onSubmit={saveBurial} className="grid sm:grid-cols-4 gap-2 bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200 font-bold">
            <input required placeholder="اسم مكان الدفن *" className="p-2 border rounded-xl bg-white" value={burialForm.location_name} onChange={e => setBurialForm({ ...burialForm, location_name: e.target.value })} />
            <input placeholder="العنوان / خط السير" className="p-2 border rounded-xl bg-white" value={burialForm.area_address} onChange={e => setBurialForm({ ...burialForm, area_address: e.target.value })} />
            <input type="number" min="0" required placeholder="سعر رسوم الانتقال (ج.م) *" className="p-2 border rounded-xl bg-white" value={burialForm.transport_fee} onChange={e => setBurialForm({ ...burialForm, transport_fee: e.target.value })} />
            <button type="submit" className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer">{burialForm.id ? 'حفظ التعديل' : '+ إضافة مكان دفن'}</button>
          </form>

          <table className="w-full text-right border-collapse border rounded-xl text-xs">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-2.5 text-center w-12">م</th>
                <th className="p-2.5">مكان الدفن</th>
                <th className="p-2.5">العنوان / خط السير</th>
                <th className="p-2.5">رسوم الانتقال</th>
                <th className="p-2.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {burials.map((b, idx) => (
                <tr key={b.id} className="border-b hover:bg-gray-50">
                  <td className="p-2.5 text-center font-bold text-gray-500">{idx + 1}</td>
                  <td className="p-2.5 font-bold text-gray-900">{b.location_name}</td>
                  <td className="p-2.5 text-gray-600">{b.area_address || '—'}</td>
                  <td className="p-2.5 font-black text-emerald-700">{b.transport_fee} ج.م</td>
                  <td className="p-2.5 flex justify-center gap-1.5">
                    <button type="button" onClick={() => setBurialForm(b)} className="p-1.5 bg-gray-100 hover:bg-amber-100 rounded-lg cursor-pointer" title="تعديل"><Edit3 size={14} /></button>
                    <button type="button" onClick={async () => { if (!confirm('حذف مكان الدفن؟')) return; await supabase.from('burial_locations').delete().eq('id', b.id); setBurials(burials.filter(x => x.id !== b.id)); }} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg cursor-pointer" title="حذف"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 2) مخزون الصناديق */}
      {tab === 'caskets' && (
        <div className="space-y-3">
          <form onSubmit={saveCasket} className="grid sm:grid-cols-5 gap-2 bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 font-bold">
            <input required placeholder="اسم / نوع الصندوق *" className="p-2 border rounded-xl bg-white" value={casketForm.casket_name} onChange={e => setCasketForm({ ...casketForm, casket_name: e.target.value })} />
            <input placeholder="المقاس (كبير/وسط)" className="p-2 border rounded-xl bg-white" value={casketForm.casket_size} onChange={e => setCasketForm({ ...casketForm, casket_size: e.target.value })} />
            <input type="number" min="0" placeholder="السعر" className="p-2 border rounded-xl bg-white" value={casketForm.price} onChange={e => setCasketForm({ ...casketForm, price: e.target.value })} />
            <select className="p-2 border rounded-xl bg-white" value={casketForm.status} onChange={e => setCasketForm({ ...casketForm, status: e.target.value })}>
              <option value="متاح">متاح</option>
              <option value="محجوز">محجوز</option>
              <option value="تم التسليم">تم التسليم</option>
            </select>
            <button type="submit" className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer">{casketForm.id ? 'تعديل' : '+ إضافة صندوق'}</button>
          </form>
          <div className="grid sm:grid-cols-3 gap-2">
            {caskets.map(c => (
              <div key={c.id} className="p-3 border rounded-2xl flex justify-between items-center bg-gray-50">
                <div>
                  <strong>{c.casket_name}</strong>
                  <span className="block text-xs text-gray-500">مقاس: {c.casket_size} • {c.price} ج.م • <strong>{c.status}</strong></span>
                </div>
                <button type="button" onClick={() => setCasketForm(c)} className="p-1.5 bg-white border rounded-lg cursor-pointer"><Edit3 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3) ألحان وترانيم يوسف الرامي مع سلايدر الصوت المحفوظ */}
      {tab === 'audio' && (
        <div className="space-y-4">
          <form onSubmit={saveAudioTrack} className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200 space-y-3 font-bold">
            <strong className="text-purple-950 block">🎵 {audioForm.id ? 'تعديل الترنيمة ومستوى الصوت' : 'إضافة ترنيمة حزيني أو لحن لصفحة يوسف الرامي'}</strong>
            <div className="grid sm:grid-cols-2 gap-2">
              <input required placeholder="اسم الترنيمة أو اللحن (مثال: ترنيمة يوسف الرامي تعالى) *" className="p-2.5 border rounded-xl bg-white" value={audioForm.title} onChange={e => setAudioForm({ ...audioForm, title: e.target.value })} />
              <div className="flex gap-1.5 items-center">
                <label className={`px-3 py-2.5 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer shrink-0 ${uploadingAudio ? 'bg-gray-300 text-gray-600' : 'bg-purple-700 hover:bg-purple-800 text-white'}`}>
                  <Upload size={14} /> {uploadingAudio ? 'جاري الرفع...' : 'رفع MP3 من جهازك'}
                  <input type="file" accept="audio/*" className="hidden" disabled={uploadingAudio} onChange={handleUploadAudioFile} />
                </label>
                <input placeholder="أو رابط مباشر للملف الصوتي https://..." className="flex-1 p-2.5 border rounded-xl bg-white text-xs" value={audioForm.audio_url} onChange={e => setAudioForm({ ...audioForm, audio_url: e.target.value })} />
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Volume2 size={16} className="text-purple-700" />
                <span className="text-xs text-gray-800">مستوى الصوت الافتراضي (للهدوء والوقار):</span>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={audioForm.default_volume || 25}
                  onChange={e => setAudioForm({ ...audioForm, default_volume: Number(e.target.value) })}
                  className="w-32 accent-[#7a1c24] cursor-pointer"
                />
                <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded font-black text-xs">
                  {audioForm.default_volume || 25}%
                </span>
              </div>
              <span className="text-[11px] text-gray-500 font-normal">ينصح بـ 20% - 30% ليكون الصوت خافتاً ومريحاً</span>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-purple-950 cursor-pointer">
                <input type="checkbox" checked={audioForm.is_default} onChange={e => setAudioForm({ ...audioForm, is_default: e.target.checked })} />
                ⭐ اجعله المقطع الافتراضي الذي يظهر أولاً عند فتح صفحة يوسف الرامي
              </label>
              <div className="flex gap-2">
                {audioForm.id && <button type="button" onClick={() => setAudioForm({ id: null, title: '', audio_url: '', is_default: false, sort_order: audioTracks.length + 1, default_volume: 25 })} className="px-4 py-2 border rounded-xl bg-white cursor-pointer">إلغاء</button>}
                <button type="submit" disabled={uploadingAudio} className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer">
                  {audioForm.id ? 'حفظ التعديل ✅' : '+ حفظ اللحن / الترنيمة'}
                </button>
              </div>
            </div>
          </form>

          <div className="space-y-2">
            {audioTracks.map(tr => {
              const currentVol = tr.default_volume || 25;
              return (
                <div key={tr.id} className={`p-3.5 rounded-2xl border flex flex-wrap justify-between items-center gap-3 ${tr.is_default ? 'bg-amber-50 border-amber-400' : 'bg-gray-50'}`}>
                  <div className="space-y-1.5 flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm text-gray-900">🎵 {tr.title}</strong>
                      {tr.is_default && <span className="px-2 py-0.5 bg-amber-300 text-amber-950 rounded text-[10px] font-black">⭐ الافتراضي</span>}
                    </div>

                    {tr.audio_url ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <audio
                          controls
                          src={tr.audio_url}
                          className="h-8 w-full max-w-sm"
                          ref={el => {
                            if (el) el.volume = currentVol / 100;
                          }}
                          onPlay={e => {
                            e.currentTarget.volume = currentVol / 100;
                          }}
                        />

                        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border shadow-2xs">
                          <Volume2 size={14} className="text-purple-700 shrink-0" />
                          <span className="text-[11px] text-gray-600">الصوت:</span>
                          <input
                            type="range"
                            min="5"
                            max="100"
                            step="5"
                            value={currentVol}
                            onChange={e => handleQuickVolumeChange(tr.id, Number(e.target.value))}
                            className="w-20 accent-[#7a1c24] cursor-pointer"
                            title="اسحب لتوطية أو تعلية الصوت"
                          />
                          <span className="text-[11px] font-black text-[#7a1c24] w-8 text-center">{currentVol}%</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-red-700 block">⚠️ لم يتم رفع ملف صوت بعد.</span>
                    )}
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    {!tr.is_default && (
                      <button type="button" onClick={() => setDefaultAudio(tr.id)} className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                        <Star size={13} /> تعيين كافتراضي
                      </button>
                    )}
                    <button type="button" onClick={() => setAudioForm({ id: tr.id, title: tr.title, audio_url: tr.audio_url || '', is_default: Boolean(tr.is_default), sort_order: tr.sort_order || 1, default_volume: currentVol })} className="p-2 bg-white border rounded-xl cursor-pointer" title="تعديل"><Edit3 size={14} /></button>
                    <button type="button" onClick={async () => { if (!confirm('حذف المقطع الصوتي؟')) return; await supabase.from('joseph_audio_tracks').delete().eq('id', tr.id); setAudioTracks(audioTracks.filter(x => x.id !== tr.id)); }} className="p-2 bg-red-50 text-red-700 rounded-xl cursor-pointer" title="حذف"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
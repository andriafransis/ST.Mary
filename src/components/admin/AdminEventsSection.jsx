import { useState } from 'react';
import { CalendarPlus, Edit3, Trash2 } from 'lucide-react';
import { emptyEvent } from '../../utils/churchHierarchy';

export default function AdminEventsSection({
  events = [],
  isAdmin,
  requireAdminGuard,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent
}) {
  const [evForm, setEvForm] = useState(emptyEvent);
  const [editingEvId, setEditingEvId] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (requireAdminGuard && !requireAdminGuard()) return;
    if (editingEvId) {
      onUpdateEvent({ ...evForm, id: editingEvId });
      setEditingEvId(null);
    } else {
      onAddEvent(evForm);
    }
    setEvForm(emptyEvent);
  };

  return (
    <div className="space-y-3 text-xs">
      {isAdmin && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-2xl border space-y-2.5 font-bold shadow-2xs">
          <h3 className="text-sm font-extrabold flex items-center gap-1 text-[#7a1c24]">
            <CalendarPlus size={15} /> {editingEvId ? 'تعديل الموعد' : 'إضافة ميعاد قداس أو عشية أو اجتماع عام'}
          </h3>
          <div className="grid md:grid-cols-3 gap-2">
            <select className="p-2 border rounded-xl" value={evForm.event_type} onChange={e => setEvForm({ ...evForm, event_type: e.target.value })}>
              <option value="قداس إلهي">قداس إلهي</option>
              <option value="عشية وتسبحة">عشية وتسبحة</option>
              <option value="اجتماع عام">اجتماع عام</option>
              <option value="نهضة / مناسبة">نهضة / مناسبة</option>
            </select>
            <input required placeholder="الاسم *" className="p-2 border rounded-xl" value={evForm.title} onChange={e => setEvForm({ ...evForm, title: e.target.value })} />
            <input required placeholder="الموعد *" className="p-2 border rounded-xl" value={evForm.event_time} onChange={e => setEvForm({ ...evForm, event_time: e.target.value })} />
          </div>
          <div className="grid md:grid-cols-3 gap-2">
            <input required placeholder="المكان *" className="p-2 border rounded-xl" value={evForm.place} onChange={e => setEvForm({ ...evForm, place: e.target.value })} />
            <input placeholder="الأب الكاهن المصلي" className="p-2 border rounded-xl" value={evForm.priest_name} onChange={e => setEvForm({ ...evForm, priest_name: e.target.value })} />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-[#7a1c24] text-white rounded-xl p-2 shadow cursor-pointer">
                {editingEvId ? 'حفظ التعديل' : 'حفظ الموعد'}
              </button>
              {editingEvId && (
                <button type="button" onClick={() => { setEditingEvId(null); setEvForm(emptyEvent); }} className="px-3 border rounded-xl">
                  إلغاء
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      <div className="max-h-[45vh] overflow-y-auto pr-1 grid gap-2">
        {events.map(ev => (
          <div key={ev.id} className="bg-white p-3 rounded-2xl border flex justify-between items-center shadow-2xs gap-2">
            <div>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] ml-2">{ev.event_type}</span>
              <strong className="text-sm text-gray-900">{ev.title}</strong>
              <span className="text-gray-500 block mt-0.5">⏰ {ev.event_time} • 📍 {ev.place}</span>
            </div>
            {isAdmin && (
              <div className="flex gap-1.5">
                <button onClick={() => { setEditingEvId(ev.id); setEvForm({ ...emptyEvent, ...ev }); }} className="px-2.5 py-1.5 bg-gray-100 rounded-xl font-bold flex items-center gap-1 cursor-pointer">
                  <Edit3 size={12} /> تعديل
                </button>
                <button onClick={() => onDeleteEvent(ev.id)} className="px-2.5 py-1.5 bg-red-50 text-red-700 rounded-xl font-bold flex items-center gap-1 cursor-pointer">
                  <Trash2 size={12} /> حذف
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
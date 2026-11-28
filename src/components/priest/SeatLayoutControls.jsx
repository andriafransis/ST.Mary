import { useState } from 'react';
import { Settings2, X, Check } from 'lucide-react';

// تعديل شكل الكراسي (للأب الكاهن والأدمن فقط)
export default function SeatLayoutControls({ layout, onSave, canEdit = false }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(layout);
  const [saving, setSaving] = useState(false);

  const total = layout.rows * (layout.seatsRight + layout.seatsLeft);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await onSave(draft);
      if (error) {
        alert('تعذر حفظ شكل الكراسي: ' + error.message);
        return;
      }
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-gray-700">
        <span>
          {layout.rows} صف • {layout.seatsRight} يمين + {layout.seatsLeft} شمال في الصف • الإجمالي {total} كرسي
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setDraft(layout);
              setOpen((v) => !v);
            }}
            className="px-2 py-1 bg-white border rounded-lg inline-flex items-center gap-1 cursor-pointer hover:bg-gray-100"
          >
            {open ? <X size={11} /> : <Settings2 size={11} />}
            {open ? 'إغلاق' : 'شكل الكراسي'}
          </button>
        )}
      </div>

      {open && canEdit && (
        <div className="bg-white border border-amber-300 rounded-xl p-2.5 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['rows', 'عدد الصفوف', 1, 30],
              ['seatsRight', 'كراسي اليمين', 0, 20],
              ['seatsLeft', 'كراسي الشمال', 0, 20]
            ].map(([key, label, min, max]) => (
              <div key={key}>
                <span className="block text-[10px] text-gray-600 mb-0.5">{label}</span>
                <input
                  type="number"
                  min={min}
                  max={max}
                  inputMode="numeric"
                  className="w-full p-1.5 border rounded-lg"
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-amber-900 font-normal">
            تغيير الشكل يغيّر ترقيم الكراسي، فيفضل ضبطه قبل توزيع الكراسي على المدعوين.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-3 py-1.5 bg-[#7a1c24] text-white rounded-lg font-black inline-flex items-center gap-1 cursor-pointer"
            >
              <Check size={12} /> {saving ? 'جاري الحفظ...' : 'حفظ الشكل'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

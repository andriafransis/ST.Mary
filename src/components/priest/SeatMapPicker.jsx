import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Armchair, Settings2, X, Check } from 'lucide-react';
import {
  DEFAULT_LAYOUT,
  LAYOUT_KEY,
  buildSeats,
  normalizeLayout,
  parseSeatNumber,
  seatLabel
} from '../../lib/seatLayout';

// ─────────────────────────────────────────────────────────────
// خريطة كراسي الكنيسة: تحديد كرسي لكل مدعو
// القيمة الناتجة نص عادي يُحفظ في العمود الحالي seat_or_zone
// مثال: "كرسي 7 • يمين • صف 1"
// ─────────────────────────────────────────────────────────────

export { parseSeatNumber };

export default function SeatMapPicker({
  value = '',
  onChange,
  eventTitle = '',
  eventDate = '',
  excludeId = null,
  canEditLayout = false
}) {
  const [layout, setLayout] = useState({ ...DEFAULT_LAYOUT });
  const [draft, setDraft] = useState({ ...DEFAULT_LAYOUT });
  const [editingLayout, setEditingLayout] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [takenMap, setTakenMap] = useState({}); // { [seatNumber]: recipientName }

  // تحميل شكل الكراسي المحفوظ
  useEffect(() => {
    if (!supabase || typeof supabase.from !== 'function') return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('service_settings')
          .select('value')
          .eq('key', LAYOUT_KEY)
          .maybeSingle();
        if (!error && data?.value && !cancelled) {
          const next = normalizeLayout(data.value);
          setLayout(next);
          setDraft(next);
        }
      } catch {
        // نستخدم الشكل الافتراضي
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // تحميل الكراسي المحجوزة لنفس المناسبة
  useEffect(() => {
    const title = (eventTitle || '').trim();
    if (!title || !supabase || typeof supabase.from !== 'function') {
      setTakenMap({});
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        let q = supabase
          .from('church_invitations')
          .select('id, recipient_name, seat_or_zone')
          .eq('event_title', title)
          .not('seat_or_zone', 'is', null);
        if (eventDate) q = q.eq('event_date', eventDate);
        const { data, error } = await q;
        if (error || !Array.isArray(data) || cancelled) return;
        const map = {};
        data.forEach((row) => {
          if (excludeId && row.id === excludeId) return;
          const num = parseSeatNumber(row.seat_or_zone);
          if (num) map[num] = row.recipient_name || 'مدعو';
        });
        setTakenMap(map);
      } catch {
        // لو فشل التحميل نكمل بدون عرض المحجوز
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventTitle, eventDate, excludeId]);

  const rows = useMemo(() => buildSeats(layout), [layout]);
  const selectedNumber = parseSeatNumber(value);
  const totalSeats = layout.rows * (layout.seatsRight + layout.seatsLeft);
  const takenCount = Object.keys(takenMap).length;

  const handleSaveLayout = async () => {
    const next = normalizeLayout(draft);
    setSavingLayout(true);
    try {
      const payload = JSON.stringify(next);
      const { data: existing } = await supabase
        .from('service_settings')
        .select('key')
        .eq('key', LAYOUT_KEY)
        .maybeSingle();

      const res = existing
        ? await supabase.from('service_settings').update({ value: payload }).eq('key', LAYOUT_KEY)
        : await supabase.from('service_settings').insert([{ key: LAYOUT_KEY, value: payload }]);

      if (res.error) {
        alert('تعذر حفظ شكل الكراسي: ' + res.error.message);
        return;
      }
      setLayout(next);
      setEditingLayout(false);
    } finally {
      setSavingLayout(false);
    }
  };

  const renderSeat = (seat) => {
    const takenBy = takenMap[seat.number];
    const isSelected = selectedNumber === seat.number;
    const isTaken = Boolean(takenBy) && !isSelected;

    return (
      <button
        key={seat.number}
        type="button"
        disabled={isTaken}
        title={isTaken ? `محجوز: ${takenBy}` : seatLabel(seat)}
        onClick={() => onChange?.(isSelected ? '' : seatLabel(seat))}
        className={`w-9 h-9 rounded-lg border text-[11px] font-black flex items-center justify-center transition ${
          isSelected
            ? 'bg-[#7a1c24] text-white border-[#7a1c24] shadow cursor-pointer'
            : isTaken
              ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed line-through'
              : 'bg-white text-gray-800 border-gray-300 hover:bg-amber-50 hover:border-amber-400 cursor-pointer'
        }`}
      >
        {seat.number}
      </button>
    );
  };

  return (
    <div className="bg-[#fbfaf7] border rounded-2xl p-3 space-y-2.5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-[11px] text-gray-700 font-black flex items-center gap-1">
          <Armchair size={13} /> اختر كرسي المدعو من الخريطة
        </label>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500 font-bold">
            {takenCount} محجوز من {totalSeats}
          </span>
          {canEditLayout && (
            <button
              type="button"
              onClick={() => {
                setDraft(layout);
                setEditingLayout((v) => !v);
              }}
              className="px-2 py-1 bg-white border rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer hover:bg-gray-100"
            >
              {editingLayout ? <X size={11} /> : <Settings2 size={11} />}
              {editingLayout ? 'إغلاق' : 'شكل الكراسي'}
            </button>
          )}
        </div>
      </div>

      {editingLayout && canEditLayout && (
        <div className="bg-white border border-amber-300 rounded-xl p-2.5 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="block text-[10px] text-gray-600 mb-0.5">عدد الصفوف</span>
              <input
                type="number"
                min={1}
                max={30}
                className="w-full p-1.5 border rounded-lg"
                value={draft.rows}
                onChange={(e) => setDraft({ ...draft, rows: e.target.value })}
              />
            </div>
            <div>
              <span className="block text-[10px] text-gray-600 mb-0.5">كراسي اليمين في الصف</span>
              <input
                type="number"
                min={0}
                max={20}
                className="w-full p-1.5 border rounded-lg"
                value={draft.seatsRight}
                onChange={(e) => setDraft({ ...draft, seatsRight: e.target.value })}
              />
            </div>
            <div>
              <span className="block text-[10px] text-gray-600 mb-0.5">كراسي الشمال في الصف</span>
              <input
                type="number"
                min={0}
                max={20}
                className="w-full p-1.5 border rounded-lg"
                value={draft.seatsLeft}
                onChange={(e) => setDraft({ ...draft, seatsLeft: e.target.value })}
              />
            </div>
          </div>
          <p className="text-[10px] text-amber-900 font-normal">
            تغيير الشكل يغيّر ترقيم الكراسي، فيفضل ضبطه قبل توزيع الكراسي على المدعوين.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={savingLayout}
              onClick={handleSaveLayout}
              className="px-3 py-1.5 bg-[#7a1c24] text-white rounded-lg font-black inline-flex items-center gap-1 cursor-pointer"
            >
              <Check size={12} /> {savingLayout ? 'جاري الحفظ...' : 'حفظ الشكل'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-max mx-auto space-y-1.5">
          <div className="text-center text-[11px] font-black bg-[#7a1c24] text-amber-100 rounded-lg py-1">
            ✝ الهيكل / المذبح
          </div>

          {rows.map((r) => (
            <div key={r.row} className="flex items-center justify-center gap-4">
              <span className="w-10 text-[10px] text-gray-500 font-bold text-center">صف {r.row}</span>
              <div className="flex gap-1">{r.right.map(renderSeat)}</div>
              <div className="w-6 text-center text-[9px] text-gray-400">ممر</div>
              <div className="flex gap-1">{r.left.map(renderSeat)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-600 font-bold">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-white border border-gray-300" /> متاح
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-[#7a1c24]" /> المختار
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-200 border border-gray-300" /> محجوز
        </span>
        {!eventTitle?.trim() && (
          <span className="text-amber-800">اكتب اسم المناسبة أولاً ليظهر المحجوز.</span>
        )}
      </div>

      <div>
        <span className="block text-[10px] text-gray-500 mb-0.5">
          المكان المختار (يمكنك أيضاً كتابة مكان آخر يدوياً، مثل: الدور العلوي):
        </span>
        <input
          placeholder="لم يتم اختيار كرسي بعد"
          className="w-full p-2 border rounded-xl bg-white font-bold text-[#7a1c24]"
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    </div>
  );
}

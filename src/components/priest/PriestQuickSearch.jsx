import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

// بحث سريع بالاسم/الموبايل في كل الأعضاء. عرض فقط – الاختيار بيستدعي onPick(member).
export default function PriestQuickSearch({ users = [], confessorIds = null, onPick }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return users
      .filter(u => `${u.full_name || ''} ${u.phone || ''}`.toLowerCase().includes(t))
      .slice(0, 8);
  }, [q, users]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-white border rounded-2xl px-3 py-2 shadow-2xs focus-within:border-[#7a1c24]">
        <Search size={16} className="text-gray-400 shrink-0" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الموبايل لفتح الملف مباشرة..."
          className="flex-1 bg-transparent outline-none text-sm font-bold min-w-0"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="مسح" className="text-gray-400 hover:text-gray-700 cursor-pointer"><X size={16} /></button>
        )}
      </div>
      {q.trim().length >= 2 && (
        <div className="absolute z-30 inset-x-0 mt-1.5 bg-white border rounded-2xl shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <div className="p-3 text-xs text-gray-500 text-center">لا توجد نتائج مطابقة.</div>
          ) : results.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => { onPick?.(u); setQ(''); }}
              className="w-full text-right px-3 py-2.5 hover:bg-[#f9ecee] border-b last:border-b-0 flex items-center justify-between gap-2 cursor-pointer"
            >
              <span className="text-sm font-black text-gray-900 truncate">{u.full_name}</span>
              <span className="flex items-center gap-1.5 shrink-0">
                {confessorIds?.has(u.id) && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-black">معترف</span>}
                {u.phone && <span className="text-[11px] text-gray-500" dir="ltr">{u.phone}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

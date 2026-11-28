// لوحة "النهاردة" – أرقام سريعة بضغطة توصل للتفاصيل. عرض فقط، بدون أي كتابة على الداتابيز.
export default function PriestTodayPanel({ items = [] }) {
  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <section aria-label="النهاردة" className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
      {visible.map(it => (
        <button
          key={it.key}
          type="button"
          onClick={it.onClick}
          className={`relative text-right rounded-2xl border bg-white p-3 md:p-4 shadow-2xs hover:shadow-md hover:border-[#7a1c24] transition cursor-pointer flex flex-col gap-1 ${it.alert ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xl md:text-2xl">{it.icon}</span>
            <span className={`text-2xl md:text-3xl font-black leading-none ${it.alert ? 'text-red-700' : 'text-[#7a1c24]'}`}>{it.value}</span>
          </div>
          <strong className="text-[11px] md:text-xs font-black text-gray-800 leading-snug">{it.label}</strong>
          {it.hint && <span className="text-[10px] text-gray-500 hidden md:block">{it.hint}</span>}
        </button>
      ))}
    </section>
  );
}

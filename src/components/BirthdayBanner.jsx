
import { Gift, Phone, MessageCircle } from 'lucide-react';

export default function BirthdayBanner({ birthdays = [], onOpenWhatsApp }) {
  if (birthdays.length === 0) return null;

  return (
    <div className="bg-linear-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-3xl p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-amber-950">
        <div className="w-8 h-8 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center">
          <Gift size={18} />
        </div>
        <div>
          <h3 className="font-extrabold text-sm">🎉 أعياد ميلاد خلال هذا الأسبوع ({birthdays.length})</h3>
          <p className="text-[11px] text-amber-800">تواصل معهم وقدم لهم التهنئة القلبية!</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-2">
        {birthdays.map(b => {
          const displayName = b.name || b.full_name || '';
          const msg = `كل سنة وحضرتك طيب يا ${displayName} 🎂🎉 عيد ميلاد سعيد وربنا يبارك حياتك ✝`;
          const waPhone = b.phone?.startsWith('0') ? `2${b.phone}` : b.phone;
          return (
            <div key={b.id} className="bg-white p-3 rounded-2xl border border-amber-200 flex justify-between items-center gap-2 text-xs">
              <div>
                <strong className="text-gray-900 block">{displayName}</strong>
                <span className="text-[11px] text-gray-500">
                  {b.daysLeft === 0 ? '🎂 عيد ميلاده النهارده!' : `⏰ بعد ${b.daysLeft} أيام`} {b.label ? `• ${b.label}` : b.dob ? `• ${b.dob}` : ''}
                </span>
              </div>
              <div className="flex gap-1.5">
                {b.phone && (
                  <>
                    {onOpenWhatsApp ? (
                      <button
                        type="button"
                        onClick={() => onOpenWhatsApp({ name: displayName, phone: b.phone, targetId: b.id, defaultCategory: 'معايدة' })}
                        className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center gap-1 text-[11px] cursor-pointer"
                      >
                        <MessageCircle size={12} /> تهنئة
                      </button>
                    ) : (
                      <a
                        href={`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center gap-1 text-[11px]"
                      >
                        <MessageCircle size={12} /> تهنئة
                      </a>
                    )}
                    <a href={`tel:${b.phone}`} className="p-1.5 bg-gray-100 text-gray-700 rounded-xl">
                      <Phone size={13} />
                    </a>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
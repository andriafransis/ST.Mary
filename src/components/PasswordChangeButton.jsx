import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, X } from 'lucide-react';
import ChangePasswordBox from './ChangePasswordBox';

// زرار 🔑 صغير: بالضغط عليه تفتح نافذة تغيير كلمة المرور للمستخدم الحالي
// variant="hero"  → للأشرطة الداكنة (خلفية شفافة)
// variant="plain" → للأشرطة الفاتحة (خلفية بيضاء)
export default function PasswordChangeButton({ user, variant = 'plain', label = 'كلمة المرور', compact = false }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!user) return null;

  const buttonStyle =
    variant === 'hero'
      ? 'bg-white/15 hover:bg-white/25 text-amber-100 border border-white/20'
      : 'bg-white hover:bg-gray-50 text-[#7a1c24] border border-gray-200';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="تغيير كلمة المرور"
        aria-label="تغيير كلمة المرور"
        className={
          compact
            ? 'px-2.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center cursor-pointer transition'
            : `px-3.5 py-2 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition ${buttonStyle}`
        }
      >
        <KeyRound size={compact ? 14 : 15} /> {!compact && label}
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[100]"
            onClick={() => setOpen(false)}
          >
            <div
              className="bg-white rounded-3xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-5 space-y-3 text-xs font-bold shadow-xl"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center border-b pb-2.5">
                <h3 className="font-extrabold text-sm text-[#7a1c24] flex items-center gap-1.5">
                  <KeyRound size={16} /> تعديل كلمة المرور — {user.full_name}
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <ChangePasswordBox user={user} onSuccess={() => setTimeout(() => setOpen(false), 1500)} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

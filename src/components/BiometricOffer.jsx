import { useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { enableBiometric, declineBiometric } from '../lib/biometricLock';

// بيظهر بعد أول دخول ناجح باليوزر والباسورد: تفعيل الدخول بالبصمة؟
export default function BiometricOffer({ user, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleYes = async () => {
    setBusy(true);
    setError('');
    try {
      await enableBiometric(user);
      onClose();
    } catch {
      setError('لم يتم تفعيل البصمة. تأكد إن الموبايل عليه بصمة أو قفل شاشة وجرّب تاني.');
    } finally {
      setBusy(false);
    }
  };

  const handleNo = () => {
    declineBiometric();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-4">
        <div className="w-16 h-16 mx-auto bg-[#f9ecee] text-[#7a1c24] border border-[#ead0d3] rounded-full flex items-center justify-center">
          <Fingerprint size={36} />
        </div>
        <h2 className="text-base font-black text-[#7a1c24]">تدخل بالبصمة المرة الجاية؟</h2>
        <p className="text-xs font-bold text-gray-500">
          بدل ما تكتب اليوزر والباسورد كل مرة، هتدخل ببصمتك على الجهاز ده بس.
        </p>
        {error && <p className="text-xs font-bold text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleYes}
            disabled={busy}
            className="flex-1 py-3 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black text-sm cursor-pointer disabled:opacity-60"
          >
            {busy ? 'جاري التفعيل...' : 'نعم، فعّلها'}
          </button>
          <button
            type="button"
            onClick={handleNo}
            disabled={busy}
            className="px-5 py-3 border rounded-xl text-sm font-bold text-gray-600 cursor-pointer"
          >
            لا
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { Fingerprint, LogOut } from 'lucide-react';
import { verifyBiometric, disableBiometric } from '../lib/biometricLock';

// بيحوط التطبيق: لو البصمة مفعلة بيطلبها قبل عرض أي حاجة
export default function BiometricGate({ enabled, onLogout, children }) {
  const [unlocked, setUnlocked] = useState(!enabled);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const unlock = useCallback(async () => {
    setBusy(true);
    setMsg('');
    try {
      const ok = await verifyBiometric();
      if (ok) setUnlocked(true);
    } catch (e) {
      if (e?.message === 'no-credential') {
        disableBiometric();
        setUnlocked(true);
      } else {
        setMsg('لم يتم التحقق. جرّب مرة تانية.');
      }
    } finally {
      setBusy(false);
    }
  }, []);

  // اقفل تاني لما التطبيق يرجع من الخلفية بعد أكتر من دقيقة
  useEffect(() => {
    if (!enabled) { setUnlocked(true); return; }
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > 60000) {
        setUnlocked(false);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [enabled]);

  // اطلب البصمة تلقائي أول ما القفل يظهر
  useEffect(() => {
    if (enabled && !unlocked) unlock();
  }, [enabled, unlocked, unlock]);

  if (!enabled || unlocked) return children;

  return (
    <div className="min-h-screen bg-linear-to-br from-[#41090d] via-[#6f151c] to-[#1c0406] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl space-y-4">
        <div className="w-20 h-20 mx-auto bg-[#f9ecee] text-[#7a1c24] border border-[#ead0d3] rounded-full flex items-center justify-center">
          <Fingerprint size={44} />
        </div>
        <h2 className="text-lg font-black text-[#7a1c24]">التطبيق مقفول</h2>
        <p className="text-xs text-gray-500 font-bold">استخدم بصمتك أو قفل الجهاز للدخول</p>
        {msg && <p className="text-xs text-red-600 font-bold">{msg}</p>}
        <button
          type="button"
          onClick={unlock}
          disabled={busy}
          className="w-full py-3 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-bold text-sm cursor-pointer disabled:opacity-60"
        >
          {busy ? 'جاري التحقق...' : '🔓 افتح بالبصمة'}
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="text-xs font-bold text-gray-500 hover:text-red-700 flex items-center gap-1 mx-auto cursor-pointer"
        >
          <LogOut size={13} /> تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

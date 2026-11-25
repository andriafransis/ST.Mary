import { useEffect, useState } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

const isStandalone = () =>
  (typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(display-mode: standalone)').matches) ||
  window.navigator.standalone === true;

const isIOS = () => {
  const ua = window.navigator.userAgent || '';
  const iPadOS = ua.includes('Mac') && 'ontouchend' in document;
  return /iphone|ipad|ipod/i.test(ua) || iPadOS;
};

const isMobile = () =>
  /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent || '') || isIOS();

// شريط تحميل التطبيق: بيظهر من تحت أول ما الصفحة تفتح على الموبايل
export default function InstallPrompt({ appName = 'تطبيق الكنيسة' }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const ios = typeof window !== 'undefined' && isIOS();

  useEffect(() => {
    if (isStandalone() || !isMobile()) return;

    // آيفون: مفيش prompt تلقائي، فبنعرض الشريط على طول مع الخطوات
    if (isIOS()) {
      setVisible(true);
      return;
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // الإغلاق للجلسة دي بس: الشريط بيرجع يظهر كل ما الصفحة تتفتح من جديد لحد ما التطبيق يتثبت
  const dismiss = () => setVisible(false);

  const install = async () => {
    if (ios) {
      setShowIosSteps(v => !v);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {
      // ignore
    }
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] p-3 print:hidden"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      dir="rtl"
    >
      <div className="max-w-md mx-auto bg-white border-2 border-[#7a1c24] rounded-2xl shadow-2xl p-3.5 space-y-2.5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-[#f9ecee] text-[#7a1c24] border border-[#ead0d3] flex items-center justify-center text-2xl font-black">
            ✝
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-[#7a1c24]">حمّل {appName} على موبايلك</p>
            <p className="text-[11px] font-bold text-gray-500 mt-0.5">
              افتحه من الشاشة الرئيسية بسرعة، واستقبل الإشعارات والتنبيهات.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="إغلاق"
            className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {ios && showIosSteps && (
          <ol className="text-[11px] font-bold text-gray-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 space-y-1.5 list-decimal list-inside">
            <li className="flex items-center gap-1">
              اضغط زرار المشاركة <Share size={13} className="inline text-blue-600" /> في أسفل Safari
            </li>
            <li className="flex items-center gap-1">
              اختار "إضافة إلى الشاشة الرئيسية" <PlusSquare size={13} className="inline" />
            </li>
            <li>اضغط "إضافة"</li>
          </ol>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={install}
            className="flex-1 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download size={15} /> {ios ? 'إزاي أحمّله؟' : 'تحميل التطبيق'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="px-4 py-2.5 border rounded-xl text-xs font-bold text-gray-600 cursor-pointer"
          >
            لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
}

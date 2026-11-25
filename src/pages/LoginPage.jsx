import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  requestMobileNotificationPermission,
  showMobileNotification
} from '../lib/mobileNotifications';
import { ArrowRight, BellRing, CheckCircle2, Fingerprint } from 'lucide-react';
import { getBiometricOwnerId, disableBiometric } from '../lib/biometricLock';

export const PENDING_APPROVAL_KEY = 'church_pending_approval_user';

export default function LoginPage({
  onLogin,
  users = [],
  error,
  successMessage,
  onBackToPublic,
  onBiometricLogin,
  churchName = 'كنيسة السيدة العذراء مريم بالمطرية'
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [bioReady, setBioReady] = useState(() => !!getBiometricOwnerId());
  const autoTried = useRef(false);

  // أول ما الصفحة تفتح: اطلب البصمة تلقائي (إلا لو لسه خارج من التطبيق)
  useEffect(() => {
    if (!bioReady || !onBiometricLogin || autoTried.current) return;
    autoTried.current = true;
    let skip = false;
    try {
      skip = sessionStorage.getItem('church_skip_bio_auto') === '1';
      sessionStorage.removeItem('church_skip_bio_auto');
    } catch {
      // ignore
    }
    if (!skip) onBiometricLogin();
  }, [bioReady, onBiometricLogin]);

  const [pendingInfo, setPendingInfo] = useState(() => {
    try {
      const raw = localStorage.getItem(PENDING_APPROVAL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [approvedNotice, setApprovedNotice] = useState(null);
  const [notifPermission, setNotifPermission] = useState(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  const triggerApprovalWelcome = async (info) => {
    setApprovedNotice(info);
    setUsername(info.username || '');
    setPassword(info.password || '');

    await showMobileNotification({
      title: `🎉 مرحباً بك في ${churchName}! تم قبولك`,
      body: `بيانات دخولك — اسم المستخدم: ${info.username} • كلمة المرور: ${info.password}`,
      badgeCount: 1,
      tag: `approved-${info.id || info.username}`
    });
  };

  // التحقق عند الفتح أو تحديث قائمة المستخدمين: هل تمت الموافقة على الطلب المعلق؟
  useEffect(() => {
    if (!pendingInfo) return;
    const matched = users.find(
      u =>
        (pendingInfo.id && u.id === pendingInfo.id) ||
        (pendingInfo.username && u.username === String(pendingInfo.username).toLowerCase())
    );
    if (matched && matched.status === 'approved') {
      triggerApprovalWelcome({
        id: matched.id,
        full_name: matched.full_name,
        username: matched.username,
        password: matched.password || pendingInfo.password || '123'
      });
    }
  }, [users, pendingInfo]);

  // استماع لحظي فوري لحظة ضغط الأدمن أو الكاهن على "قبول"
  useEffect(() => {
    if (!pendingInfo || typeof supabase.channel !== 'function') return;

    const ch = supabase
      .channel(`pending-user-watch-${pendingInfo.id || pendingInfo.username}`)
      .on(
        'broadcast',
        { event: 'account_approved' },
        ({ payload }) => {
          if (!payload) return;
          const sameUser =
            (pendingInfo.id && payload.userId === pendingInfo.id) ||
            (pendingInfo.username && payload.username === String(pendingInfo.username).toLowerCase());
          if (sameUser) {
            triggerApprovalWelcome({
              id: payload.userId,
              full_name: payload.full_name,
              username: payload.username,
              password: payload.password || pendingInfo.password || '123'
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'church_users' },
        ({ new: updated }) => {
          if (!updated || updated.status !== 'approved') return;
          const sameUser =
            (pendingInfo.id && updated.id === pendingInfo.id) ||
            (pendingInfo.username && updated.username === String(pendingInfo.username).toLowerCase());
          if (sameUser) {
            triggerApprovalWelcome({
              id: updated.id,
              full_name: updated.full_name,
              username: updated.username,
              password: updated.password || pendingInfo.password || '123'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [pendingInfo]);

  const handleEnableNotifs = async () => {
    const res = await requestMobileNotificationPermission();
    setNotifPermission(res);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-[#41090d] via-[#6f151c] to-[#1c0406] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl">
        {onBackToPublic && (
          <button
            type="button"
            onClick={onBackToPublic}
            className="mb-3 text-xs font-bold text-[#7a1c24] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <ArrowRight size={14} /> العودة لصفحة الكنيسة الرئيسية
          </button>
        )}

        <div className="w-16 h-16 bg-[#f9ecee] text-[#7a1c24] border border-[#ead0d3] rounded-2xl flex items-center justify-center text-3xl font-black mx-auto mb-3 shadow-inner">
          ✝
        </div>
        <h1 className="text-xl font-black text-center text-[#7a1c24]">{churchName}</h1>
        <p className="text-xs text-gray-500 text-center mt-1 mb-6">تسجيل الدخول الموحد للآباء الكهنة، الخدام، والرعية</p>

        {/* كارت إشعار القبول الصريح باليوزر والباسورد */}
        {approvedNotice && (
          <div className="mb-4 p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl space-y-2 text-xs">
            <strong className="text-sm text-emerald-950 flex items-center gap-1.5 font-black">
              <CheckCircle2 size={17} className="text-emerald-700" /> مرحباً بك في الكنيسة! تم قبول حسابك 🎉
            </strong>
            <div className="bg-white p-3 rounded-xl border border-emerald-200 space-y-1 font-bold text-gray-800">
              <p>👤 الاسم: <strong>{approvedNotice.full_name}</strong></p>
              <p>🔑 اسم المستخدم: <strong className="text-[#7a1c24]">{approvedNotice.username}</strong></p>
              <p>🔒 كلمة المرور: <strong className="text-[#7a1c24]">{approvedNotice.password}</strong></p>
            </div>
            <button
              type="button"
              onClick={() => onLogin(approvedNotice.username, approvedNotice.password)}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black cursor-pointer"
            >
              🚀 دخول مباشر الآن باليوزر والباسورد
            </button>
          </div>
        )}

        {/* تنبيه انتظار الموافقة + زر تفعيل إشعار القبول على الموبايل */}
        {pendingInfo && !approvedNotice && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs space-y-2 font-bold text-amber-950">
            <p>⏳ حسابك (<strong>@{pendingInfo.username}</strong>) بانتظار موافقة الأب الكاهن أو أدمن الكنيسة.</p>
            {notifPermission === 'default' && (
              <button
                type="button"
                onClick={handleEnableNotifs}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <BellRing size={14} /> اضغط ليصلك إشعار على الموبايل فور قبولك باليوزر والباسورد
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold">
            {successMessage}
          </div>
        )}

        {bioReady && onBiometricLogin && (
          <div className="mb-4 space-y-1.5">
            <button
              type="button"
              onClick={onBiometricLogin}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Fingerprint size={20} /> الدخول بالبصمة
            </button>
            <button
              type="button"
              onClick={() => { disableBiometric(); setBioReady(false); }}
              className="block mx-auto text-[11px] font-bold text-gray-400 hover:text-red-700 cursor-pointer"
            >
              إلغاء الدخول بالبصمة على هذا الجهاز
            </button>
            <p className="text-center text-[11px] text-gray-400 font-bold">أو ادخل باليوزر والباسورد</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold text-gray-700">
          <div>
            <label className="block mb-1">اسم المستخدم / Username</label>
            <input
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="اسم المستخدم"
              className="w-full p-3 border rounded-xl outline-none focus:border-[#7a1c24]"
            />
          </div>
          <div>
            <label className="block mb-1">كلمة المرور / Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-3 border rounded-xl outline-none focus:border-[#7a1c24]"
            />
          </div>
          <button type="submit" className="w-full py-3 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-bold text-sm shadow transition cursor-pointer">
            تسجيل الدخول
          </button>
        </form>
      </div>
    </div>
  );
}
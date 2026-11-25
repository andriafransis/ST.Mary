import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  requestMobileNotificationPermission,
  showMobileNotification
} from '../lib/mobileNotifications';
import { ArrowRight, BellRing, CheckCircle2, UserPlus, LogIn } from 'lucide-react';

export const PENDING_APPROVAL_KEY = 'church_pending_approval_user';

export default function LoginPage({
  onLogin,
  onRegister,
  users = [],
  error,
  successMessage,
  onBackToPublic,
  churchName = 'كنيسة السيدة العذراء مريم بالمطرية'
}) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [regForm, setRegForm] = useState({
    full_name: '',
    username: '',
    password: '',
    phone: '',
    gender: 'ذكر',
    dob: '',
    role: 'member',
    guardian_type: 'father',
    detailed_stage: 'شعب عام'
  });
  const [regBusy, setRegBusy] = useState(false);

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

  const handleSubmitLogin = (e) => {
    e.preventDefault();
    onLogin(username, password);
  };

  const handleSubmitRegister = async (e) => {
    e.preventDefault();
    if (!onRegister) return;
    setRegBusy(true);
    try {
      const ok = await onRegister({
        ...regForm,
        username: regForm.username.trim().toLowerCase(),
        status: 'pending'
      });
      if (ok) {
        const info = {
          username: regForm.username.trim().toLowerCase(),
          password: regForm.password,
          full_name: regForm.full_name
        };
        setPendingInfo(info);
        try {
          localStorage.setItem(PENDING_APPROVAL_KEY, JSON.stringify(info));
        } catch {
          // ignore
        }
        setMode('login');
      }
    } finally {
      setRegBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-[#41090d] via-[#6f151c] to-[#1c0406] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4">
        {onBackToPublic && (
          <button
            type="button"
            onClick={onBackToPublic}
            className="text-xs font-bold text-[#7a1c24] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <ArrowRight size={14} /> العودة لصفحة الكنيسة الرئيسية
          </button>
        )}

        <div className="text-center">
          <div className="w-16 h-16 bg-[#f9ecee] text-[#7a1c24] border border-[#ead0d3] rounded-2xl flex items-center justify-center text-3xl font-black mx-auto mb-3 shadow-inner">
            ✝
          </div>
          <h1 className="text-xl font-black text-[#7a1c24]">{churchName}</h1>
          <p className="text-xs text-gray-500 mt-1">تسجيل الدخول الموحد للآباء الكهنة، الخدام، والرعية</p>
        </div>

        {/* كارت إشعار القبول الصريح باليوزر والباسورد */}
        {approvedNotice && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl space-y-2 text-xs">
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
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs space-y-2 font-bold text-amber-950">
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

        {onRegister && (
          <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-2xl text-xs font-black">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`py-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer ${
                mode === 'login' ? 'bg-[#7a1c24] text-white' : 'text-gray-700'
              }`}
            >
              <LogIn size={14} /> تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`py-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer ${
                mode === 'register' ? 'bg-[#7a1c24] text-white' : 'text-gray-700'
              }`}
            >
              <UserPlus size={14} /> طلب انضمام جديد
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold">
            {successMessage}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleSubmitLogin} className="space-y-4 text-xs font-bold text-gray-700">
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
        ) : (
          <form onSubmit={handleSubmitRegister} className="space-y-3 text-xs font-bold text-gray-700">
            <input
              required
              placeholder="الاسم الرباعي بالكامل *"
              className="w-full p-2.5 border rounded-xl"
              value={regForm.full_name}
              onChange={e => setRegForm({ ...regForm, full_name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                placeholder="اسم المستخدم للدخول *"
                className="p-2.5 border rounded-xl"
                value={regForm.username}
                onChange={e => setRegForm({ ...regForm, username: e.target.value })}
              />
              <input
                required
                type="text"
                placeholder="كلمة المرور *"
                className="p-2.5 border rounded-xl"
                value={regForm.password}
                onChange={e => setRegForm({ ...regForm, password: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                type="tel"
                placeholder="رقم التليفون / الواتساب *"
                className="p-2.5 border rounded-xl"
                value={regForm.phone}
                onChange={e => setRegForm({ ...regForm, phone: e.target.value })}
              />
              <input
                type="date"
                className="p-2.5 border rounded-xl"
                value={regForm.dob}
                onChange={e => setRegForm({ ...regForm, dob: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="p-2.5 border rounded-xl bg-white"
                value={regForm.gender}
                onChange={e => setRegForm({ ...regForm, gender: e.target.value })}
              >
                <option value="ذكر">ذكر</option>
                <option value="أنثى">أنثى</option>
              </select>
              <select
                className="p-2.5 border rounded-xl bg-white"
                value={regForm.role}
                onChange={e => setRegForm({ ...regForm, role: e.target.value })}
              >
                <option value="member">مخدوم (شعب)</option>
                <option value="parent">ولي أمر</option>
                <option value="servant">خادم</option>
              </select>
            </div>
            {regForm.role === 'parent' && (
              <select
                className="w-full p-2.5 border rounded-xl bg-blue-50/50"
                value={regForm.guardian_type}
                onChange={e => setRegForm({ ...regForm, guardian_type: e.target.value })}
              >
                <option value="father">ولي الأمر: الأب</option>
                <option value="mother">ولي الأمر: الأم</option>
              </select>
            )}
            <button
              type="submit"
              disabled={regBusy}
              className="w-full py-3 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black text-sm shadow cursor-pointer"
            >
              {regBusy ? 'جاري إرسال الطلب...' : 'إرسال طلب الانضمام'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
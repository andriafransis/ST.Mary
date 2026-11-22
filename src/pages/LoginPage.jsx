import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export default function LoginPage({ onLogin, error, onBackToPublic, churchName = 'كنيسة السيدة العذراء مريم بالمطرية' }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

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

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold">
            {error}
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
import { useState } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ChangePasswordBox({ user, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  if (!user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!newPassword || newPassword.length < 3) {
      setStatusMsg({ type: 'error', text: 'كلمة المرور الجديدة يجب أن تكون 3 أحرف على الأقل.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: 'كلمة المرور الجديدة وتأكيدها غير متطابقين.' });
      return;
    }

    if (user.password) {
      if (!currentPassword) {
        setStatusMsg({ type: 'error', text: 'اكتب كلمة المرور الحالية أولاً.' });
        return;
      }
      if (currentPassword !== user.password) {
        setStatusMsg({ type: 'error', text: 'كلمة المرور الحالية غير صحيحة.' });
        return;
      }
    }

    setSaving(true);
    try {
      if (supabase && typeof supabase.from === 'function') {
        const { error } = await supabase
          .from('church_users')
          .update({ password: newPassword })
          .eq('id', user.id);

        if (error) {
          setStatusMsg({ type: 'error', text: error.message || 'تعذر تحديث كلمة المرور في قاعدة البيانات.' });
          setSaving(false);
          return;
        }
      }

      user.password = newPassword;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setStatusMsg({ type: 'success', text: 'تم تحديث كلمة المرور بنجاح.' });
      if (onSuccess) onSuccess();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err?.message || 'حدث خطأ أثناء تغيير كلمة المرور.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs font-bold" dir="rtl">
      {statusMsg && (
        <div
          className={`p-2.5 rounded-2xl border flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          {statusMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div>
        <label className="block mb-1 text-gray-700">كلمة المرور الحالية</label>
        <input
          type={showPasswords ? 'text' : 'password'}
          required={Boolean(user.password)}
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="أدخل كلمة المرور الحالية"
          className="w-full p-2.5 border rounded-xl bg-[#fbfaf7] outline-none focus:border-[#7a1c24]"
        />
      </div>

      <div>
        <label className="block mb-1 text-gray-700">كلمة المرور الجديدة *</label>
        <input
          type={showPasswords ? 'text' : 'password'}
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="أدخل كلمة المرور الجديدة"
          className="w-full p-2.5 border rounded-xl bg-[#fbfaf7] outline-none focus:border-[#7a1c24]"
        />
      </div>

      <div>
        <label className="block mb-1 text-gray-700">تأكيد كلمة المرور الجديدة *</label>
        <input
          type={showPasswords ? 'text' : 'password'}
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="أعد إدخال كلمة المرور الجديدة"
          className="w-full p-2.5 border rounded-xl bg-[#fbfaf7] outline-none focus:border-[#7a1c24]"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setShowPasswords((prev) => !prev)}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-1 cursor-pointer"
        >
          {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{showPasswords ? 'إخفاء كلمات المرور' : 'إظهار كلمات المرور'}</span>
        </button>

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-[#7a1c24] hover:bg-[#5c1319] disabled:opacity-60 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
        >
          <KeyRound size={14} />
          <span>{saving ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}</span>
        </button>
      </div>
    </form>
  );
}
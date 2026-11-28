import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronDown, ChevronUp, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function ChangePasswordBox({ user }) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', text: string }

  if (!user?.id) return null;

  const handleSavePassword = async (e) => {
    e.preventDefault();
    setStatus(null);

    if (user.password && currentPassword !== user.password) {
      setStatus({ type: 'error', text: 'كلمة المرور الحالية غير صحيحة.' });
      return;
    }

    if (String(newPassword).trim().length < 4) {
      setStatus({ type: 'error', text: 'كلمة المرور الجديدة يجب أن تكون 4 أحرف أو رموز على الأقل.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', text: 'تأكيد كلمة المرور غير متطابق مع كلمة المرور الجديدة.' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('church_users')
        .update({ password: newPassword })
        .eq('id', user.id);

      if (error) {
        setStatus({ type: 'error', text: `تعذر تحديث كلمة المرور: ${error.message}` });
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setStatus({ type: 'success', text: 'تم تحديث كلمة المرور بنجاح.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 text-xs" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between font-black text-slate-800 cursor-pointer"
      >
        <span className="inline-flex items-center gap-1.5 text-[#7a1c24]">
          <KeyRound size={15} />
          تعديل كلمة المرور
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <form onSubmit={handleSavePassword} className="mt-3 pt-3 border-t space-y-2.5">
          <div>
            <label className="block mb-1 text-[11px] font-bold text-slate-700">
              كلمة المرور الحالية
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full p-2 border rounded-xl bg-[#fbfaf7] font-bold"
              required={Boolean(user.password)}
            />
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-bold text-slate-700">
              كلمة المرور الجديدة
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2 border rounded-xl bg-[#fbfaf7] font-bold"
              required
            />
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-bold text-slate-700">
              تأكيد كلمة المرور الجديدة
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-2 border rounded-xl bg-[#fbfaf7] font-bold"
              required
            />
          </div>

          {status && (
            <div
              className={`p-2.5 rounded-xl border font-bold flex items-center gap-1.5 ${
                status.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border-red-300 text-red-800'
              }`}
            >
              {status.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              <span>{status.text}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-[#7a1c24] hover:bg-[#5c1319] text-white font-black cursor-pointer disabled:opacity-60"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
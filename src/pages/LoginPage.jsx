import { useState } from 'react';
import { ArrowRight, UserPlus, X } from 'lucide-react';

const STAGE_OPTIONS = [
  'حضانة',
  'أولى ابتدائي', 'ثانية ابتدائي', 'ثالثة ابتدائي', 'رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي',
  'أولى إعدادي', 'ثانية إعدادي', 'ثالثة إعدادي',
  'أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي',
  'جامعة وخريجين',
  'حرفيين ومهنيين',
  'أصحاب معاشات'
];

export default function LoginPage({
  onLogin,
  onRegister,
  error,
  successMessage,
  onBackToPublic,
  churchName = 'كنيسة السيدة العذراء مريم بالمطرية'
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [showRegister, setShowRegister] = useState(false);
  const [submittingReg, setSubmittingReg] = useState(false);

  const emptyReg = {
    first_name: '',
    second_name: '',
    third_name: '',
    fourth_name: '',
    username: '',
    password: '',
    phone: '',
    dob: '',
    gender: 'ذكر',
    address: '',
    role: 'member',
    detailed_stage: 'أولى ثانوي',
    also_parent: false,
    guardian_type: 'father',
    is_studying: true,
    study_or_job: '',
    is_deacon: false,
    deacon_rank: 'اغنسطس'
  };
  const [regForm, setRegForm] = useState(emptyReg);

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password);
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!onRegister) return;
    if (!regForm.first_name || !regForm.second_name || !regForm.third_name || !regForm.fourth_name) {
      alert('يجب إدخال الاسم الرباعي بالكامل');
      return;
    }
    setSubmittingReg(true);
    try {
      const full_name = [regForm.first_name, regForm.second_name, regForm.third_name, regForm.fourth_name]
        .map(s => s.trim())
        .filter(Boolean)
        .join(' ');

      const resolvedGuardianType = regForm.role === 'parent' || regForm.also_parent
        ? (regForm.gender === 'أنثى' ? 'mother' : regForm.guardian_type || 'father')
        : '';

      const ok = await onRegister({
        ...regForm,
        full_name,
        service_stage: regForm.detailed_stage,
        job_title: regForm.is_studying ? '' : regForm.study_or_job,
        guardian_type: resolvedGuardianType,
        family_role: resolvedGuardianType === 'mother' ? 'الأم' : resolvedGuardianType === 'father' ? 'الأب' : 'ابن/ابنة',
        permissions: {
          view_parent_panel: Boolean(regForm.also_parent)
        },
        status: 'pending'
      });

      if (ok) {
        setShowRegister(false);
        setRegForm(emptyReg);
      }
    } finally {
      setSubmittingReg(false);
    }
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

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold">
            {successMessage}
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

        {onRegister && (
          <div className="mt-4 pt-4 border-t text-center">
            <button
              type="button"
              onClick={() => setShowRegister(true)}
              className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-[#7a1c24] rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <UserPlus size={15} /> تسجيل عضو جديد (طلب انضمام للكنيسة)
            </button>
          </div>
        )}
      </div>

      {/* مودال تسجيل عضو جديد */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-xl p-6 space-y-4 font-bold max-h-[92vh] overflow-y-auto text-xs text-gray-800">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h2 className="text-base md:text-lg font-black text-[#7a1c24]">تسجيل عضو جديد — {churchName}</h2>
                <p className="text-[11px] text-gray-500 font-normal mt-0.5">يتم مراجعة الطلب وقبوله من إدارة الكنيسة لتفعيل الحساب</p>
              </div>
              <button type="button" onClick={() => setShowRegister(false)} className="p-1.5 bg-gray-100 rounded-full cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div className="border rounded-2xl p-3 space-y-2">
                <label className="block text-[#7a1c24] font-black">الاسم الرباعي بالكامل *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input required placeholder="الأول *" className="p-2.5 border rounded-xl" value={regForm.first_name} onChange={e => setRegForm({ ...regForm, first_name: e.target.value })} />
                  <input required placeholder="الثاني *" className="p-2.5 border rounded-xl" value={regForm.second_name} onChange={e => setRegForm({ ...regForm, second_name: e.target.value })} />
                  <input required placeholder="الثالث *" className="p-2.5 border rounded-xl" value={regForm.third_name} onChange={e => setRegForm({ ...regForm, third_name: e.target.value })} />
                  <input required placeholder="الرابع *" className="p-2.5 border rounded-xl" value={regForm.fourth_name} onChange={e => setRegForm({ ...regForm, fourth_name: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input required placeholder="اسم المستخدم *" className="p-2.5 border rounded-xl" value={regForm.username} onChange={e => setRegForm({ ...regForm, username: e.target.value })} />
                <input required type="password" placeholder="كلمة المرور *" className="p-2.5 border rounded-xl" value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input required type="tel" placeholder="رقم الموبايل / الواتساب *" className="p-2.5 border rounded-xl" value={regForm.phone} onChange={e => setRegForm({ ...regForm, phone: e.target.value })} />
                <input type="date" className="p-2.5 border rounded-xl" value={regForm.dob} onChange={e => setRegForm({ ...regForm, dob: e.target.value })} />
                <select
                  required
                  className="p-2.5 border rounded-xl bg-white"
                  value={regForm.gender}
                  onChange={e => setRegForm({
                    ...regForm,
                    gender: e.target.value,
                    guardian_type: e.target.value === 'أنثى' ? 'mother' : 'father'
                  })}
                >
                  <option value="ذكر">النوع: ذكر</option>
                  <option value="أنثى">النوع: أنثى</option>
                </select>
              </div>

              <input required placeholder="العنوان بالتفصيل *" className="w-full p-2.5 border rounded-xl" value={regForm.address} onChange={e => setRegForm({ ...regForm, address: e.target.value })} />

              <div className="grid grid-cols-2 gap-2">
                <select className="p-2.5 border rounded-xl bg-white" value={regForm.role} onChange={e => setRegForm({ ...regForm, role: e.target.value })}>
                  <option value="member">👤 مخدوم (بفصل / مرحلة)</option>
                  <option value="parent">👨‍👩‍👦 ولي أمر</option>
                  <option value="servant">📖 خادم</option>
                  <option value="priest">✝ أب كاهن</option>
                  <option value="worker">🛠️ عامل بالكنيسة</option>
                </select>
                <select className="p-2.5 border rounded-xl bg-white" value={regForm.detailed_stage} onChange={e => setRegForm({ ...regForm, detailed_stage: e.target.value })}>
                  {STAGE_OPTIONS.map((st, idx) => <option key={idx} value={st}>{st}</option>)}
                </select>
              </div>

              <label className="flex items-center gap-2 p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 cursor-pointer">
                <input type="checkbox" checked={regForm.also_parent} onChange={e => setRegForm({ ...regForm, also_parent: e.target.checked })} />
                👨‍👩‍👦 وأيضاً: ولي أمر (لدي أبناء في الكنيسة وأريد متابعتهم)
              </label>

              <div className="grid grid-cols-2 gap-2 border rounded-2xl p-2.5">
                <select className="p-2 border rounded-xl bg-white" value={regForm.is_studying ? 'yes' : 'no'} onChange={e => setRegForm({ ...regForm, is_studying: e.target.value === 'yes' })}>
                  <option value="yes">طالب / بيدرس</option>
                  <option value="no">يعمل / خريج</option>
                </select>
                <input
                  placeholder={regForm.is_studying ? 'السنة الدراسية / الكلية' : 'الوظيفة / العمل'}
                  className="p-2 border rounded-xl"
                  value={regForm.study_or_job}
                  onChange={e => setRegForm({ ...regForm, study_or_job: e.target.value })}
                />
              </div>

              <div className="border rounded-2xl p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={regForm.is_deacon} onChange={e => setRegForm({ ...regForm, is_deacon: e.target.checked })} />
                  شماس؟
                </label>
                {regForm.is_deacon && (
                  <select className="w-full p-2 border rounded-xl bg-white" value={regForm.deacon_rank} onChange={e => setRegForm({ ...regForm, deacon_rank: e.target.value })}>
                    <option value="أبصالتس">أبصالتس (مرتل)</option>
                    <option value="اغنسطس">اغنسطس (قارئ)</option>
                    <option value="إبصاديا">إبصاديا (مبدأ شماس)</option>
                    <option value="شماس كامل">شماس كامل (دياكون)</option>
                  </select>
                )}
              </div>

              <button
                type="submit"
                disabled={submittingReg}
                className="w-full py-3 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-2xl font-black text-sm shadow cursor-pointer"
              >
                {submittingReg ? 'جاري الإرسال...' : 'إرسال طلب التسجيل للموافقة'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
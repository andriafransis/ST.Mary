import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ROLES, ALL_SCREENS, SCREEN_LABELS } from '../lib/permissions';
import ParentFamilyLinkSection from './ParentFamilyLinkSection';
import { UserPlus, CheckSquare, Square, Save } from 'lucide-react';

const FEMALE_FIRST_NAMES = new Set([
  'ايريني', 'إيريني', 'ريني', 'ماري', 'مارينا', 'مريم', 'فيرينا', 'فيرونيا',
  'دينا', 'سارة', 'ساره', 'نانسي', 'مونيكا', 'ميرا', 'ميرنا', 'بسنت', 'كريستين',
  'كارين', 'كارولين', 'جيهان', 'هالة', 'هبه', 'هبة', 'منى', 'نهى', 'نورهان',
  'ياسمين', 'آية', 'اية', 'إيمان', 'ايمان', 'سمر', 'ندى', 'رانيا', 'أميرة', 'اميرة',
  'داليا', 'شيرين', 'لمياء', 'سلوى', 'وفاء', 'حنان', 'إيناس', 'ايناس', 'تماف', 'دميانة'
]);

function guessGenderFromName(fullName = '') {
  const first = fullName.trim().split(/\s+/)[0] || '';
  if (!first) return '';
  return FEMALE_FIRST_NAMES.has(first) ? 'أنثى' : 'ذكر';
}

export default function UserRegistrationForm({
  mode = 'admin', // 'public' (من صفحة الويب سايت) | 'admin' (من صفحة الأدمن)
  users = [],
  roleTemplates: externalTemplates = null,
  initialUser = null,
  defaultPublicRole = 'member',
  onSaved,
  onClose
}) {
  const isAdminMode = mode === 'admin';

  const [fullName, setFullName] = useState(initialUser?.full_name || '');
  const [username, setUsername] = useState(initialUser?.username || '');
  const [phone, setPhone] = useState(initialUser?.phone || '');
  const [jobTitle, setJobTitle] = useState(initialUser?.job_title || '');
  const [area, setArea] = useState(initialUser?.area || '');
  const [role, setRole] = useState(
    isAdminMode ? (initialUser?.role || 'member') : (initialUser?.role || defaultPublicRole)
  );
  const [gender, setGender] = useState(initialUser?.gender || '');
  const [genderTouchedManually, setGenderTouchedManually] = useState(Boolean(initialUser?.gender));

  const [dbTemplates, setDbTemplates] = useState([]);
  const [dbAreas, setDbAreas] = useState([]);

  const [selectedPolicies, setSelectedPolicies] = useState(
    Array.isArray(initialUser?.permissions?.policy_keys)
      ? initialUser.permissions.policy_keys
      : (initialUser?.permissions?.template_key ? [initialUser.permissions.template_key] : [])
  );

  const [defaultScreen, setDefaultScreen] = useState(
    initialUser?.permissions?.default_screen || ''
  );

  const [savedUser, setSavedUser] = useState(initialUser || null);
  const [saving, setSaving] = useState(false);

  // تحميل القوالب والمناطق/البيانات المرجعية من الداتابيز
  useEffect(() => {
    let active = true;
    async function loadDbOptions() {
      const [{ data: tplRows }, { data: userAreas }] = await Promise.all([
        supabase
          .from('church_public_content')
          .select('*')
          .eq('kind', 'role_template')
          .order('created_at', { ascending: true }),
        supabase
          .from('church_users')
          .select('area')
          .not('area', 'is', null)
      ]);

      if (!active) return;

      if (Array.isArray(tplRows) && tplRows.length > 0) {
        const parsed = tplRows
          .map((row) => {
            try {
              const obj = JSON.parse(row.body || '{}');
              return {
                key: row.title,
                label: obj.label || row.title,
                base_role: obj.base_role || 'member',
                screens: Array.isArray(obj.screens) ? obj.screens : []
              };
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        setDbTemplates(parsed);
      }

      if (Array.isArray(userAreas)) {
        const uniqueAreas = Array.from(
          new Set(userAreas.map((r) => (r.area || '').trim()).filter(Boolean))
        );
        setDbAreas(uniqueAreas);
      }
    }

    loadDbOptions();
    return () => {
      active = false;
    };
  }, []);

  const availableTemplates =
    Array.isArray(externalTemplates) && externalTemplates.length > 0
      ? externalTemplates
      : dbTemplates;

  useEffect(() => {
    if (!genderTouchedManually && !initialUser?.id) {
      const guessed = guessGenderFromName(fullName);
      if (guessed) setGender(guessed);
    }
  }, [fullName, genderTouchedManually, initialUser?.id]);

  const handleCheckGender = (value) => {
    setGenderTouchedManually(true);
    setGender((prev) => (prev === value ? '' : value));
  };

  const togglePolicy = (key) => {
    if (!isAdminMode) return;
    setSelectedPolicies((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!fullName.trim()) {
      alert('من فضلك اكتب الاسم الكامل.');
      return;
    }
    if (!username.trim()) {
      alert('من فضلك اكتب اسم المستخدم (Username).');
      return;
    }
    if (gender !== 'ذكر' && gender !== 'أنثى') {
      alert('من فضلك حدد النوع بعلامة الصح: ذكر أو أنثى.');
      return;
    }

    setSaving(true);
    try {
      const existingPerms = savedUser?.permissions || {};
      const safeRole = isAdminMode
        ? (role === 'admin' ? 'member' : role)
        : (defaultPublicRole === 'admin' ? 'member' : defaultPublicRole);

      const matchedTpls = isAdminMode
        ? availableTemplates.filter((t) => selectedPolicies.includes(t.key))
        : [];

      const mergedScreensSet = new Set(existingPerms.allowed_screens || []);
      matchedTpls.forEach((tpl) => {
        (tpl.screens || []).forEach((s) => mergedScreensSet.add(s));
      });

      const customLabel = isAdminMode
        ? (matchedTpls.length > 0
            ? matchedTpls.map((t) => t.label).join(' + ')
            : existingPerms.custom_role_label || '')
        : (existingPerms.custom_role_label || '');

      const payload = {
        full_name: fullName.trim(),
        username: username.trim(),
        phone: phone.trim(),
        job_title: jobTitle.trim(),
        area: area.trim(),
        role: safeRole,
        gender,
        permissions: {
          ...existingPerms,
          registration_source: isAdminMode ? 'admin_panel' : 'public_website',
          policy_keys: isAdminMode ? selectedPolicies : (existingPerms.policy_keys || []),
          template_key: isAdminMode ? (selectedPolicies[0] || '') : (existingPerms.template_key || ''),
          custom_role_label: customLabel,
          default_screen: isAdminMode ? defaultScreen : (existingPerms.default_screen || ''),
          allowed_screens: Array.from(mergedScreensSet)
        }
      };

      let resultRow = null;

      if (savedUser?.id && isAdminMode) {
        const { data, error } = await supabase
          .from('church_users')
          .update(payload)
          .eq('id', savedUser.id)
          .select('*')
          .single();

        if (error) {
          alert('خطأ أثناء تحديث البيانات في الداتابيز: ' + error.message);
          return;
        }
        resultRow = data;
      } else {
        const { data, error } = await supabase
          .from('church_users')
          .insert([payload])
          .select('*')
          .single();

        if (error) {
          alert('خطأ أثناء تسجيل الحساب الجديد في الداتابيز: ' + error.message);
          return;
        }
        resultRow = data;
      }

      setSavedUser(resultRow);
      if (onSaved) await onSaved(resultRow);
      alert(`تم حفظ تسجيل (${resultRow.full_name}) بنجاح ✅`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 text-xs md:text-sm" dir="rtl">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-5 rounded-3xl border shadow-sm space-y-4 font-bold"
      >
        <div className="flex flex-wrap justify-between items-center border-b pb-3 gap-2">
          <div>
            <h3 className="text-base font-black text-[#7a1c24] flex items-center gap-2">
              <UserPlus size={18} />
              {savedUser?.id && isAdminMode
                ? `تعديل بيانات: ${savedUser.full_name}`
                : 'تسجيل حساب / عضو جديد'}
            </h3>
            <span className="text-[11px] text-gray-500">
              {isAdminMode ? 'وضع الإدارة (حفظ مباشر + صلاحيات وروابط)' : 'تسجيل جديد من الموقع'}
            </span>
          </div>

          <div className="flex gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-xl text-xs text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                إغلاق
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={15} /> {saving ? 'جاري الحفظ...' : 'تأكيد التسجيل وحفظه ✅'}
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-700 mb-1">الاسم الكامل *</label>
            <input
              type="text"
              required
              placeholder="اكتب الاسم الكامل..."
              className="w-full p-2.5 border rounded-xl bg-gray-50 focus:bg-white"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-700 mb-1">اسم المستخدم (Username) *</label>
            <input
              type="text"
              required
              placeholder="مثال: andrew.member"
              className="w-full p-2.5 border rounded-xl bg-gray-50 focus:bg-white"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* اختيار النوع بـ Check Mark صريح */}
          <div className="bg-amber-50/70 p-2.5 rounded-2xl border border-amber-200 flex flex-col justify-center">
            <span className="block text-[11px] text-amber-950 mb-1.5">
              تحديد النوع (Check Mark) *
            </span>
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-900">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-[#7a1c24] cursor-pointer"
                  checked={gender === 'ذكر'}
                  onChange={() => handleCheckGender('ذكر')}
                />
                <span>👨 ذكر</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-900">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-[#7a1c24] cursor-pointer"
                  checked={gender === 'أنثى'}
                  onChange={() => handleCheckGender('أنثى')}
                />
                <span>👩 أنثى</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-700 mb-1">رقم الهاتف</label>
            <input
              type="text"
              placeholder="01xxxxxxxxx"
              className="w-full p-2.5 border rounded-xl bg-gray-50 focus:bg-white"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-700 mb-1">العمل / الوظيفة</label>
            <input
              type="text"
              placeholder="مهندس / طالب / موظف..."
              className="w-full p-2.5 border rounded-xl bg-gray-50 focus:bg-white"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-700 mb-1">القطاع / المنطقة</label>
            <input
              list="db-areas-datalist"
              type="text"
              placeholder="اكتب أو اختر من المناطق المسجلة..."
              className="w-full p-2.5 border rounded-xl bg-gray-50 focus:bg-white"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
            <datalist id="db-areas-datalist">
              {dbAreas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>

          {isAdminMode && (
            <>
              <div>
                <label className="block text-xs text-gray-700 mb-1">الدور الأساسي</label>
                <select
                  className="w-full p-2.5 border rounded-xl bg-white"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {ROLES.filter((r) => r.key !== 'admin').map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-700 mb-1">الشاشة الافتراضية</label>
                <select
                  className="w-full p-2.5 border rounded-xl bg-white"
                  value={defaultScreen}
                  onChange={(e) => setDefaultScreen(e.target.value)}
                >
                  <option value="">(حسب افتراضي الدور / الجروب)</option>
                  {ALL_SCREENS.map((scrKey) => (
                    <option key={scrKey} value={scrKey}>{SCREEN_LABELS[scrKey] || scrKey}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {isAdminMode && availableTemplates.length > 0 && (
          <div className="bg-gray-50 p-3.5 rounded-2xl border space-y-2">
            <span className="block text-xs text-gray-800">
              جروبات الصلاحيات (Group Policy) المرتبطة بالمستخدم:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {availableTemplates.map((tpl) => {
                const active = selectedPolicies.includes(tpl.key);
                return (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => togglePolicy(tpl.key)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer flex items-center gap-1 ${
                      active ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-gray-800'
                    }`}
                  >
                    {active ? <CheckSquare size={13} /> : <Square size={13} />}
                    {tpl.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </form>

      {isAdminMode && savedUser?.id && (
        <ParentFamilyLinkSection
          users={users}
          targetUser={savedUser}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
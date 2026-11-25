import {
  DEACON_RANKS,
  STAGE_OPTIONS,
  SERVANT_ROLES,
  detectGuardianType,
  splitList,
  buildServiceHierarchy,
  getClassesForServiceHelper,
  normalizeDeaconRank
} from '../../utils/churchHierarchy';

export default function UserFormModal({
  isEditing,
  formData,
  setFormData,
  priestsList = [],
  parentsWorkersList = [],
  availableServantServices = [],
  effectiveGroups = [],
  services = [],
  onClose,
  onSubmit
}) {
  const isServantRoleSelected = SERVANT_ROLES.includes(formData.role);
  const selectedServantStages = splitList(formData.detailed_stage);
  const selectedServantClasses = splitList(formData.assigned_class);

  const allGroupStagesFlat = [...new Set([
    ...STAGE_OPTIONS,
    ...effectiveGroups.map(g => g.group_name).filter(Boolean),
    ...effectiveGroups.flatMap(g => {
      const st = g?.stages;
      if (Array.isArray(st)) return st;
      return String(st || '').split(/[,،]/).map(s => s.trim()).filter(Boolean);
    }),
    ...services.map(s => s.stage_name).filter(Boolean)
  ])];

  const toggleMultiFieldValue = (fieldName, value) => {
    const current = splitList(formData[fieldName]);
    const next = current.includes(value)
      ? current.filter(x => x !== value)
      : [...current, value];
    setFormData({ ...formData, [fieldName]: next.join(', ') });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-3 text-xs font-bold max-h-[92vh] overflow-y-auto">
        <h3 className="font-extrabold text-sm text-gray-900">
          {isEditing ? 'تعديل بيانات الفرد' : 'إضافة فرد جديد بالاسم الرباعي'}
        </h3>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block mb-1 text-[#7a1c24]">الاسم الرباعي (إلزامي) *</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input required placeholder="الأول *" className="p-2.5 border rounded-xl" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
              <input required placeholder="الثاني *" className="p-2.5 border rounded-xl" value={formData.second_name} onChange={e => setFormData({ ...formData, second_name: e.target.value })} />
              <input required placeholder="الثالث *" className="p-2.5 border rounded-xl" value={formData.third_name} onChange={e => setFormData({ ...formData, third_name: e.target.value })} />
              <input required placeholder="الرابع *" className="p-2.5 border rounded-xl" value={formData.fourth_name} onChange={e => setFormData({ ...formData, fourth_name: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div><label className="block mb-1">اسم الدخول (Username) *</label><input required className="w-full p-2.5 border rounded-xl" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} /></div>
            <div><label className="block mb-1">كلمة المرور *</label><input required className="w-full p-2.5 border rounded-xl" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block mb-1">الدور والصلاحية *</label>
              <select
                className="w-full p-2.5 border rounded-xl"
                value={formData.role}
                onChange={e => {
                  const nextRole = e.target.value;
                  const nextGuardianType = nextRole === 'parent' ? (formData.guardian_type === 'mother' ? 'mother' : 'father') : '';
                  setFormData({
                    ...formData,
                    role: nextRole,
                    guardian_type: nextGuardianType,
                    family_role: nextRole === 'parent' ? (nextGuardianType === 'mother' ? 'الأم' : 'الأب') : formData.family_role
                  });
                }}
              >
                <option value="priest">أب كاهن</option>
                <option value="head_servant">خادم (أمين خدمة)</option>
                <option value="vice_head_servant">خادم (مساعد أمين خدمة)</option>
                <option value="servant">خادم مرحلة</option>
                <option value="meeting_servant">خادم اجتماع</option>
                <option value="mercy_servant">خادم إخوة رب</option>
                <option value="member">مخدوم</option>
                <option value="parent">ولي أمر</option>
                <option value="worker">عامل / فراش كنيسة</option>
                <option value="admin">سوبر أدمن</option>
              </select>
            </div>
            <div>
              <label className="block mb-1">النوع *</label>
              <select
                className="w-full p-2.5 border rounded-xl bg-white"
                value={formData.gender || 'ذكر'}
                onChange={e => setFormData({ ...formData, gender: e.target.value })}
              >
                <option value="ذكر">♂️ ذكر</option>
                <option value="أنثى">♀️ أنثى</option>
              </select>
            </div>
            <div><label className="block mb-1">تاريخ الميلاد</label><input type="date" className="w-full p-2.5 border rounded-xl" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} /></div>
          </div>

          {formData.role === 'parent' && (
            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 space-y-1.5">
              <label className="block text-[#7a1c24] font-extrabold">نوع ولي الأمر (الأب / الأم) *</label>
              <select
                className="w-full p-2.5 border border-amber-300 rounded-xl bg-white"
                value={formData.guardian_type || 'father'}
                onChange={e => {
                  const nextG = e.target.value === 'mother' ? 'mother' : 'father';
                  setFormData({
                    ...formData,
                    guardian_type: nextG,
                    gender: nextG === 'mother' ? 'أنثى' : 'ذكر',
                    family_role: nextG === 'mother' ? 'الأم' : 'الأب'
                  });
                }}
              >
                <option value="father">👨 الأب</option>
                <option value="mother">👩 الأم</option>
              </select>
            </div>
          )}

          <div>
            <label className="block mb-1">حالة الفرد (افتقاد / متابعة / ترحيم)</label>
            <select
              className="w-full p-2.5 border rounded-xl bg-[#fbfaf7]"
              value={formData.member_status || 'active'}
              onChange={e => setFormData({ ...formData, member_status: e.target.value })}
            >
              <option value="active">نشط / موجود</option>
              <option value="needs_visitation">محتاج افتقاد</option>
              <option value="inactive">منقطع / غياب</option>
              <option value="transferred">منتقل خارج الكنيسة</option>
              <option value="departed">منتقل للسماء (ذكرى ترحيم)</option>
            </select>
          </div>

          {formData.role === 'priest' && (
            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 space-y-2">
              <span className="block text-[11px] text-amber-950 font-extrabold">✝ بيانات الكهنوت والسيامة والعائلة والواتساب:</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block mb-1 text-[10px]">الدرجة</label>
                  <select className="w-full p-2 border rounded-xl bg-white" value={formData.priest_degree} onChange={e => setFormData({ ...formData, priest_degree: e.target.value })}>
                    <option value="قس">قس</option><option value="قمص">قمص</option><option value="أسقف / مطران">أسقف / مطران</option>
                  </select>
                </div>
                <div><label className="block mb-1 text-[10px]">تاريخ السيامة</label><input type="date" className="w-full p-2 border rounded-xl bg-white" value={formData.ordination_date} onChange={e => setFormData({ ...formData, ordination_date: e.target.value })} /></div>
                <div><label className="block mb-1 text-[10px]">تاريخ الترقية</label><input type="date" className="w-full p-2 border rounded-xl bg-white" value={formData.promotion_date} onChange={e => setFormData({ ...formData, promotion_date: e.target.value })} /></div>
              </div>
              {formData.priest_degree !== 'أسقف / مطران' && (
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="الاسم الرباعي لزوجة الأب الكاهن" className="p-2 border rounded-xl bg-white" value={formData.priest_wife_full_name} onChange={e => setFormData({ ...formData, priest_wife_full_name: e.target.value })} />
                  <input type="tel" placeholder="تليفون الزوجة" className="p-2 border rounded-xl bg-white" value={formData.priest_wife_phone} onChange={e => setFormData({ ...formData, priest_wife_phone: e.target.value })} />
                </div>
              )}
              <input placeholder="تفاصيل الأبناء / ملاحظات اليوبيل..." className="w-full p-2 border rounded-xl bg-white" value={formData.priest_family_notes} onChange={e => setFormData({ ...formData, priest_family_notes: e.target.value })} />
              <div className="grid sm:grid-cols-2 gap-2 pt-1 border-t border-amber-200">
                <input placeholder="رقم الواتساب الخاص بأبونا للإرسال" className="p-2 border rounded-xl bg-white" value={formData.whatsapp_sender_phone || ''} onChange={e => setFormData({ ...formData, whatsapp_sender_phone: e.target.value })} />
                <label className="flex items-center gap-2 text-[11px] text-amber-950 cursor-pointer">
                  <input type="checkbox" checked={formData.can_manage_wa_templates !== false} onChange={e => setFormData({ ...formData, can_manage_wa_templates: e.target.checked })} />
                  السماح بتعديل وإضافة قوالب الواتساب
                </label>
              </div>
            </div>
          )}

          <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-950">
              <input type="checkbox" checked={formData.is_deacon} onChange={e => setFormData({ ...formData, is_deacon: e.target.checked })} />
              هل هذا الشخص شماس بخدمة الكنيسة؟
            </label>
            {formData.is_deacon && (
              <div>
                <label className="block mb-1 text-purple-900 text-[11px]">رتبة الشماس الحالية *</label>
                <select
                  className="w-full p-2 border rounded-xl bg-white"
                  value={normalizeDeaconRank(formData.deacon_rank)}
                  onChange={e => setFormData({ ...formData, deacon_rank: e.target.value })}
                >
                  {DEACON_RANKS.map(rk => (
                    <option key={rk.value} value={rk.value}>{rk.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {formData.role === 'worker' && (
            <div><label className="block mb-1">وظيفة العامل / الفراش</label><input className="w-full p-2.5 border rounded-xl" placeholder="فراش الكنيسة / أمن..." value={formData.church_job} onChange={e => setFormData({ ...formData, church_job: e.target.value })} /></div>
          )}

          {formData.role === 'member' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1">① المرحلة / الخدمة</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-amber-50/40"
                    value={formData.detailed_stage}
                    onChange={e => {
                      const nextStage = e.target.value;
                      const nextStageClasses = getClassesForServiceHelper(nextStage, effectiveGroups, services);
                      const keepCurrentClass = nextStageClasses.some(c => c.value === formData.assigned_class);
                      setFormData({
                        ...formData,
                        detailed_stage: nextStage,
                        assigned_class: keepCurrentClass ? formData.assigned_class : ''
                      });
                    }}
                  >
                    {allGroupStagesFlat.map((st, i) => <option key={i} value={st}>{st}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1">② السنة الدراسية / الفصل التابع للمرحلة</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white"
                    value={formData.assigned_class || ''}
                    onChange={e => setFormData({ ...formData, assigned_class: e.target.value })}
                  >
                    <option value="">-- اختر السنة أو الفصل --</option>
                    {getClassesForServiceHelper(formData.detailed_stage, effectiveGroups, services).map((srv) => (
                      <option key={srv.id || srv.value} value={srv.value}>
                        {srv.yearName ? `${srv.yearName} ← ${srv.label}` : srv.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block mb-1">أب الاعتراف</label>
                <select className="w-full p-2.5 border rounded-xl bg-white" value={formData.confession_father_id || ''} onChange={e => setFormData({ ...formData, confession_father_id: e.target.value })}>
                  <option value="">-- اختر --</option>
                  {priestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
            </>
          )}

          {isServantRoleSelected && (
            <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-200 space-y-3">
              <div>
                <label className="block mb-1 text-cyan-950 font-extrabold">
                  ⚖️ تخصيص النوع للخادم (مهم في إعدادي وثانوي والخدمات المقسمة):
                </label>
                <select
                  className="w-full p-2.5 border border-cyan-300 rounded-xl bg-white"
                  value={formData.permissions?.service_gender_scope || 'الكل'}
                  onChange={e => setFormData({
                    ...formData,
                    permissions: { ...(formData.permissions || {}), service_gender_scope: e.target.value }
                  })}
                >
                  <option value="الكل">👥 الكل (بنين وبنات / عام)</option>
                  <option value="بنين">♂️ بنين فقط (ذكور)</option>
                  <option value="بنات">♀️ بنات فقط (إناث)</option>
                </select>
              </div>

              <div>
                <label className="block mb-1.5 text-[#7a1c24] font-extrabold">
                  ① اختر الخدمة التابعة للخادم (يمكن اختيار أكثر من خدمة):
                </label>
                <div className="flex flex-wrap gap-1.5 bg-white p-2.5 rounded-xl border max-h-36 overflow-y-auto">
                  {availableServantServices.map((srvName, idx) => {
                    const isSelected = selectedServantStages.includes(srvName);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleMultiFieldValue('detailed_stage', srvName)}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer transition ${
                          isSelected
                            ? 'bg-[#7a1c24] text-white border-[#7a1c24]'
                            : 'bg-gray-50 text-gray-800 hover:bg-amber-50'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}{srvName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedServantStages.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-blue-950 font-extrabold">
                    ② اختر السنوات أو الفصول التابعة لكل خدمة للخادم:
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedServantStages.map((srvName, sIdx) => {
                      const hierarchy = buildServiceHierarchy(srvName, effectiveGroups, services);
                      return (
                        <div key={sIdx} className="bg-white p-2.5 rounded-xl border space-y-2">
                          <div className="text-[11px] font-black text-[#7a1c24] flex items-center justify-between">
                            <span>📌 خدمة: {srvName}</span>
                            <span className="text-[10px] text-gray-400">{hierarchy.allClasses.length} خيار</span>
                          </div>

                          {hierarchy.years.length > 0 ? (
                            <div className="space-y-1.5">
                              {hierarchy.years.map((yr, yIdx) => (
                                <div key={yIdx} className="p-2 rounded-lg bg-[#fbfaf7] border space-y-1">
                                  <div className="text-[10px] font-black text-gray-800">
                                    {yr.yearName}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {yr.selectableOptions.map((optItem) => {
                                      const checked = selectedServantClasses.includes(optItem.value);
                                      return (
                                        <label
                                          key={optItem.id || optItem.value}
                                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer text-[11px] ${
                                            checked ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-800'
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={checked}
                                            onChange={() => toggleMultiFieldValue('assigned_class', optItem.value)}
                                          />
                                          {checked ? '✓ ' : ''}{optItem.label}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}

                              {hierarchy.ungroupedClasses.length > 0 && (
                                <div className="p-2 rounded-lg bg-[#fbfaf7] border flex flex-wrap gap-1.5">
                                  {hierarchy.ungroupedClasses.map((clsItem) => {
                                    const checked = selectedServantClasses.includes(clsItem.class_name);
                                    return (
                                      <label
                                        key={clsItem.id}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer text-[11px] ${
                                          checked ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-800'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          className="hidden"
                                          checked={checked}
                                          onChange={() => toggleMultiFieldValue('assigned_class', clsItem.class_name)}
                                        />
                                        {checked ? '✓ ' : ''}{clsItem.class_name}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ) : hierarchy.ungroupedClasses.length === 0 ? (
                            <p className="text-[11px] text-gray-500">
                              خدمة عامة / بدون فصول فرعية (تُعتمد الخدمة نفسها).
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {hierarchy.ungroupedClasses.map((clsItem) => {
                                const checked = selectedServantClasses.includes(clsItem.class_name);
                                return (
                                  <label
                                    key={clsItem.id}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer text-[11px] ${
                                      checked ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-800'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="hidden"
                                      checked={checked}
                                      onChange={() => toggleMultiFieldValue('assigned_class', clsItem.class_name)}
                                    />
                                    {checked ? '✓ ' : ''}{clsItem.class_name}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block mb-1">أب الاعتراف</label>
                <select className="w-full p-2.5 border rounded-xl bg-white" value={formData.confession_father_id || ''} onChange={e => setFormData({ ...formData, confession_father_id: e.target.value })}>
                  <option value="">-- اختر --</option>
                  {priestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
            </div>
          )}

          {formData.role === 'member' && (
            <div className="bg-blue-50/40 p-3 rounded-2xl border border-blue-200 space-y-2.5">
              <span className="block text-[#7a1c24] font-extrabold">
                👨‍👩‍👦 ربط بحساب ولي الأمر (تحديد الأب والأم بشكل منفصل):
              </span>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-[11px] text-sky-950">👨 ولي الأمر (الأب):</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white"
                    value={formData.parent_id || ''}
                    onChange={e => setFormData({
                      ...formData,
                      parent_id: e.target.value,
                      father_id: e.target.value
                    })}
                  >
                    <option value="">-- اختر الأب (اختياري) --</option>
                    {parentsWorkersList
                      .filter(p => p.role === 'parent' && detectGuardianType(p) !== 'mother')
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} {p.phone ? `(${p.phone})` : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-[11px] text-pink-950">👩 ولي الأمر (الأم):</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white"
                    value={formData.mother_id || ''}
                    onChange={e => setFormData({
                      ...formData,
                      mother_id: e.target.value
                    })}
                  >
                    <option value="">-- اختر الأم (اختياري) --</option>
                    {parentsWorkersList
                      .filter(p => p.role === 'parent' && (detectGuardianType(p) === 'mother' || p.guardian_type === 'mother' || ['الأم', 'أم', 'والدة'].includes(String(p.family_role || '').trim())))
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} {p.phone ? `(${p.phone})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div><label className="block mb-1">رقم الهاتف *</label><input required type="tel" className="w-full p-2.5 border rounded-xl" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
            <div><label className="block mb-1">العمل / الوظيفة</label><input className="w-full p-2.5 border rounded-xl" placeholder="مهندس / طالب..." value={formData.job_title} onChange={e => setFormData({ ...formData, job_title: e.target.value })} /></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div><label className="block mb-1">القطاع / المنطقة</label><input className="w-full p-2.5 border rounded-xl" value={formData.sector} onChange={e => setFormData({ ...formData, sector: e.target.value })} /></div>
            <div><label className="block mb-1">العنوان بالتفصيل</label><input className="w-full p-2.5 border rounded-xl" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} /></div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-xl">إلغاء</button>
            <button type="submit" className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl shadow cursor-pointer">
              {isEditing ? 'حفظ التعديلات' : 'إنشاء'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
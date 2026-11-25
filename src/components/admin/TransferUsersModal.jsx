import { useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import {
  SERVANT_ROLES,
  splitList,
  buildServiceHierarchy,
  getClassesForServiceHelper
} from '../../utils/churchHierarchy';

export default function TransferUsersModal({
  transferModal,
  setTransferModal,
  users = [],
  servantsList = [],
  membersList = [],
  availableServantServices = [],
  effectiveGroups = [],
  services = [],
  persistUserUpdate,
  requireAdminGuard
}) {
  const [savingTransfer, setSavingTransfer] = useState(false);

  if (!transferModal?.open) return null;

  const bulkPoolUsers = (transferModal.targetKind === 'servant' ? servantsList : membersList).filter(u => {
    if (transferModal.filterSourceService) {
      const stages = splitList(`${u.detailed_stage || ''} ${u.service_stage || ''}`);
      const extra = Array.isArray(u.permissions?.extra_services) ? u.permissions.extra_services : [];
      if (![...stages, ...extra].includes(transferModal.filterSourceService)) return false;
    }
    if (transferModal.filterSourceClass) {
      const classes = splitList(u.assigned_class);
      if (!classes.includes(transferModal.filterSourceClass)) return false;
    }
    return true;
  });

  const applyTransferToSingleUser = (u, cfg) => {
    const isServant = SERVANT_ROLES.includes(u.role);
    const prevStages = splitList(u.detailed_stage || u.service_stage);
    const prevClasses = splitList(u.assigned_class);
    const prevExtra = Array.isArray(u.permissions?.extra_services) ? u.permissions.extra_services : [];

    let nextStages = [...prevStages];
    let nextClasses = [...prevClasses];
    let nextExtra = [...prevExtra];

    if (isServant) {
      const chosenClasses = Array.isArray(cfg.targetClasses) ? cfg.targetClasses : [];
      if (cfg.transferAction === 'add') {
        if (cfg.targetService && !nextStages.includes(cfg.targetService)) nextStages.push(cfg.targetService);
        chosenClasses.forEach(c => {
          if (!nextClasses.includes(c)) nextClasses.push(c);
        });
      } else {
        const classesOfOldService = cfg.filterSourceService
          ? getClassesForServiceHelper(cfg.filterSourceService, effectiveGroups, services).map(c => c.value)
          : [];
        if (cfg.filterSourceService) {
          nextStages = nextStages.filter(st => st !== cfg.filterSourceService);
          nextExtra = nextExtra.filter(st => st !== cfg.filterSourceService);
          nextClasses = nextClasses.filter(c => !classesOfOldService.includes(c));
        } else {
          nextStages = [];
          nextClasses = [];
        }
        if (cfg.targetService && !nextStages.includes(cfg.targetService)) nextStages.push(cfg.targetService);
        chosenClasses.forEach(c => {
          if (!nextClasses.includes(c)) nextClasses.push(c);
        });
      }

      if (cfg.targetService && !nextExtra.includes(cfg.targetService)) {
        nextExtra.push(cfg.targetService);
      }

      const finalStageStr = nextStages.join(', ');
      return {
        ...u,
        detailed_stage: finalStageStr,
        service_stage: finalStageStr,
        assigned_class: nextClasses.join(', '),
        permissions: {
          ...(u.permissions || {}),
          extra_services: nextExtra,
          ...(cfg.targetGenderScope ? { service_gender_scope: cfg.targetGenderScope } : {})
        }
      };
    } else {
      const newStage = cfg.targetService || u.detailed_stage || '';
      const newClass = cfg.targetSingleClass || '';
      return {
        ...u,
        detailed_stage: newStage,
        service_stage: newStage,
        assigned_class: newClass,
        permissions: {
          ...(u.permissions || {}),
          extra_services: newStage ? [newStage] : []
        }
      };
    }
  };

  const handleConfirmTransfer = async (e) => {
    e.preventDefault();
    if (requireAdminGuard && !requireAdminGuard()) return;
    if (!transferModal.targetService) {
      alert('اختر الخدمة أو المرحلة الهدف أولاً');
      return;
    }

    const targets = transferModal.mode === 'single'
      ? (transferModal.singleUser ? [transferModal.singleUser] : [])
      : users.filter(u => transferModal.selectedUserIds.includes(u.id));

    if (targets.length === 0) {
      alert('اختر فرداً واحداً على الأقل للنقل');
      return;
    }

    setSavingTransfer(true);
    try {
      for (const person of targets) {
        const updated = applyTransferToSingleUser(person, transferModal);
        await persistUserUpdate(updated);
      }
      setTransferModal(prev => ({ ...prev, open: false }));
      alert(`تم نقل ${targets.length} ${targets.length === 1 ? 'فرد' : 'أفراد'} بنجاح ✅`);
    } catch (err) {
      alert('حدث خطأ أثناء النقل: ' + err.message);
    } finally {
      setSavingTransfer(false);
    }
  };

  const targetHierarchy = buildServiceHierarchy(transferModal.targetService, effectiveGroups, services);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-3 text-xs font-bold max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="font-black text-sm text-[#7a1c24] flex items-center gap-1.5">
            <ArrowLeftRight size={16} />
            {transferModal.mode === 'single'
              ? `نقل فردي: ${transferModal.singleUser?.full_name || ''}`
              : transferModal.targetKind === 'servant'
                ? 'نقل جماعي للخدام'
                : 'نقل جماعي للمخدومين'}
          </h3>
          <button type="button" onClick={() => setTransferModal(prev => ({ ...prev, open: false }))} className="p-1 text-gray-500 hover:text-gray-800 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleConfirmTransfer} className="space-y-3">
          {transferModal.mode === 'bulk' && (
            <div className="bg-gray-50 p-3 rounded-2xl border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-800">اختر الفئة للنقل الجماعي:</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setTransferModal(prev => ({
                      ...prev,
                      targetKind: 'servant',
                      selectedUserIds: [],
                      filterSourceService: '',
                      filterSourceClass: '',
                      targetClasses: [],
                      targetSingleClass: ''
                    }))}
                    className={`px-2.5 py-1 rounded-lg text-[11px] cursor-pointer ${transferModal.targetKind === 'servant' ? 'bg-[#7a1c24] text-white' : 'bg-white border'}`}
                  >
                    الخدام ({servantsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferModal(prev => ({
                      ...prev,
                      targetKind: 'member',
                      selectedUserIds: [],
                      filterSourceService: '',
                      filterSourceClass: '',
                      targetClasses: [],
                      targetSingleClass: ''
                    }))}
                    className={`px-2.5 py-1 rounded-lg text-[11px] cursor-pointer ${transferModal.targetKind === 'member' ? 'bg-[#7a1c24] text-white' : 'bg-white border'}`}
                  >
                    المخدومين ({membersList.length})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-[10px] text-gray-600">تصفية بالخدمة/المرحلة الحالية:</label>
                  <select
                    className="w-full p-2 border rounded-xl bg-white text-[11px]"
                    value={transferModal.filterSourceService}
                    onChange={e => setTransferModal(prev => ({ ...prev, filterSourceService: e.target.value, filterSourceClass: '' }))}
                  >
                    <option value="">-- الكل --</option>
                    {availableServantServices.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-[10px] text-gray-600">تصفية بالفصل الحالي:</label>
                  <select
                    className="w-full p-2 border rounded-xl bg-white text-[11px]"
                    value={transferModal.filterSourceClass}
                    onChange={e => setTransferModal(prev => ({ ...prev, filterSourceClass: e.target.value }))}
                  >
                    <option value="">-- الكل --</option>
                    {getClassesForServiceHelper(transferModal.filterSourceService || availableServantServices[0], effectiveGroups, services).map((c, idx) => (
                      <option key={c.id || idx} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-gray-700">المحدد: {transferModal.selectedUserIds.length} من {bulkPoolUsers.length}</span>
                <button
                  type="button"
                  onClick={() => {
                    const allIds = bulkPoolUsers.map(u => u.id);
                    const allChecked = allIds.length > 0 && allIds.every(id => transferModal.selectedUserIds.includes(id));
                    setTransferModal(prev => ({ ...prev, selectedUserIds: allChecked ? [] : allIds }));
                  }}
                  className="text-[11px] text-[#7a1c24] hover:underline cursor-pointer"
                >
                  تحديد / إلغاء الكل
                </button>
              </div>

              <div className="max-h-36 overflow-y-auto bg-white p-2 rounded-xl border space-y-1">
                {bulkPoolUsers.length === 0 ? (
                  <p className="text-[11px] text-gray-400 text-center py-2">لا يوجد أفراد مطابقون للتصفية</p>
                ) : (
                  bulkPoolUsers.map(person => {
                    const checked = transferModal.selectedUserIds.includes(person.id);
                    return (
                      <label key={person.id} className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-[11px]">
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setTransferModal(prev => ({
                                ...prev,
                                selectedUserIds: checked
                                  ? prev.selectedUserIds.filter(id => id !== person.id)
                                  : [...prev.selectedUserIds, person.id]
                              }));
                            }}
                          />
                          <span>{person.full_name}</span>
                        </span>
                        <span className="text-[10px] text-gray-500">{person.detailed_stage || '-'} {person.assigned_class ? `(${person.assigned_class})` : ''}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {transferModal.targetKind === 'servant' && (
            <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200 space-y-2">
              <label className="block text-amber-950">نوع النقل للخادم:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTransferModal(prev => ({ ...prev, transferAction: 'move' }))}
                  className={`p-2 rounded-xl border text-[11px] cursor-pointer ${transferModal.transferAction === 'move' ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-white text-gray-800'}`}
                >
                  🔄 نقل للخدمة / الفصول الجديدة
                </button>
                <button
                  type="button"
                  onClick={() => setTransferModal(prev => ({ ...prev, transferAction: 'add' }))}
                  className={`p-2 rounded-xl border text-[11px] cursor-pointer ${transferModal.transferAction === 'add' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-gray-800'}`}
                >
                  ➕ إضافة خدمة / فصل بجانب الحالي
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block mb-1 text-[#7a1c24]">① اختر الخدمة / المرحلة الهدف *</label>
            <select
              required
              className="w-full p-2.5 border rounded-xl bg-amber-50/40"
              value={transferModal.targetService}
              onChange={e => setTransferModal(prev => ({
                ...prev,
                targetService: e.target.value,
                targetClasses: [],
                targetSingleClass: ''
              }))}
            >
              <option value="">-- اختر الخدمة أو المرحلة --</option>
              {availableServantServices.map((srvName, idx) => (
                <option key={idx} value={srvName}>{srvName}</option>
              ))}
            </select>
          </div>

          {transferModal.targetKind === 'servant' ? (
            <div className="bg-blue-50/40 p-3 rounded-2xl border border-blue-200 space-y-2">
              <label className="block text-blue-950">② اختر السنوات أو الفصول التابعة لـ ({transferModal.targetService || 'الخدمة'}):</label>
              {targetHierarchy.years.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {targetHierarchy.years.map((yr, yIdx) => (
                    <div key={yIdx} className="bg-white p-2 rounded-xl border space-y-1">
                      <div className="text-[10px] font-black text-[#7a1c24]">{yr.yearName}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {yr.selectableOptions.map((optItem) => {
                          const checked = transferModal.targetClasses.includes(optItem.value);
                          return (
                            <button
                              key={optItem.id || optItem.value}
                              type="button"
                              onClick={() => setTransferModal(prev => ({
                                ...prev,
                                targetClasses: checked
                                  ? prev.targetClasses.filter(c => c !== optItem.value)
                                  : [...prev.targetClasses, optItem.value]
                              }))}
                              className={`px-2.5 py-1 rounded-xl border text-[11px] cursor-pointer ${
                                checked ? 'bg-blue-700 text-white border-blue-700' : 'bg-gray-50 text-gray-800'
                              }`}
                            >
                              {checked ? '✓ ' : '+ '}{optItem.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {targetHierarchy.ungroupedClasses.length > 0 && (
                    <div className="bg-white p-2 rounded-xl border flex flex-wrap gap-1.5">
                      {targetHierarchy.ungroupedClasses.map((clsItem) => {
                        const checked = transferModal.targetClasses.includes(clsItem.class_name);
                        return (
                          <button
                            key={clsItem.id}
                            type="button"
                            onClick={() => setTransferModal(prev => ({
                              ...prev,
                              targetClasses: checked
                                ? prev.targetClasses.filter(c => c !== clsItem.class_name)
                                : [...prev.targetClasses, clsItem.class_name]
                            }))}
                            className={`px-2.5 py-1 rounded-xl border text-[11px] cursor-pointer ${
                              checked ? 'bg-blue-700 text-white border-blue-700' : 'bg-gray-50 text-gray-800'
                            }`}
                          >
                            {checked ? '✓ ' : '+ '}{clsItem.class_name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : targetHierarchy.ungroupedClasses.length === 0 ? (
                <p className="text-[11px] text-gray-500">خدمة عامة / بدون فصول فرعية (تُعتمد الخدمة نفسها).</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {targetHierarchy.ungroupedClasses.map((clsItem) => {
                    const checked = transferModal.targetClasses.includes(clsItem.class_name);
                    return (
                      <button
                        key={clsItem.id}
                        type="button"
                        onClick={() => setTransferModal(prev => ({
                          ...prev,
                          targetClasses: checked
                            ? prev.targetClasses.filter(c => c !== clsItem.class_name)
                            : [...prev.targetClasses, clsItem.class_name]
                        }))}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] cursor-pointer ${
                          checked ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-800'
                        }`}
                      >
                        {checked ? '✓ ' : '+ '}{clsItem.class_name}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="pt-1">
                <label className="block mb-1 text-[11px] text-cyan-950">نطاق النوع للخادم (اختياري):</label>
                <select
                  className="w-full p-2 border rounded-xl bg-white text-[11px]"
                  value={transferModal.targetGenderScope}
                  onChange={e => setTransferModal(prev => ({ ...prev, targetGenderScope: e.target.value }))}
                >
                  <option value="">-- الإبقاء على النطاق الحالي --</option>
                  <option value="الكل">👥 الكل (بنين وبنات / عام)</option>
                  <option value="بنين">♂️ بنين فقط (ذكور)</option>
                  <option value="بنات">♀️ بنات فقط (إناث)</option>
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block mb-1 text-blue-950">② السنة الدراسية / الفصل التابع للمرحلة الهدف</label>
              <select
                className="w-full p-2.5 border rounded-xl bg-white"
                value={transferModal.targetSingleClass}
                onChange={e => setTransferModal(prev => ({ ...prev, targetSingleClass: e.target.value }))}
              >
                <option value="">-- اختر السنة أو الفصل --</option>
                {targetHierarchy.allClasses.map((clsItem) => (
                  <option key={clsItem.id || clsItem.value} value={clsItem.value}>
                    {clsItem.yearName ? `${clsItem.yearName} ← ${clsItem.label}` : clsItem.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setTransferModal(prev => ({ ...prev, open: false }))} className="px-4 py-2 border rounded-xl cursor-pointer">
              إلغاء
            </button>
            <button type="submit" disabled={savingTransfer} className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl shadow cursor-pointer">
              {savingTransfer ? 'جاري التنفيذ...' : 'تأكيد النقل ✅'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
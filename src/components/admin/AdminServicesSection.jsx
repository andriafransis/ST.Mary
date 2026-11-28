import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import ServiceGroupFeed, { normalizeGroupStages } from '../ServiceGroupFeed';
import ServiceDrillDownCards from '../ServiceDrillDownCards';
import {
  emptyService,
  emptyGroup,
  ROLE_LABELS,
  splitList,
  buildServiceHierarchy
} from '../../utils/churchHierarchy';
import { ArrowLeftRight, Layers, BookOpen, Edit3, Trash2, UserCheck, X } from 'lucide-react';

export default function AdminServicesSection({
  effectiveGroups = [],
  dbServiceGroups = [],
  setDbServiceGroups,
  services = [],
  users = [],
  priestsList = [],
  servantsList = [],
  assignableUsersList = [],
  availableServantServices = [],
  effectiveUser,
  isAdmin,
  requireAdminGuard,
  persistUserUpdate,
  persistServiceUpdate,
  getPriestCoverage,
  servicesSubTab,
  setServicesSubTab,
  priestTransferForm,
  setPriestTransferForm,
  onOpenSingleTransfer,
  onGoToPermissions,
  onAddService,
  onDeleteService,
  onRefresh
}) {
  const [srvForm, setSrvForm] = useState(emptyService);
  const [editingSrvId, setEditingSrvId] = useState(null);
  const [grpForm, setGrpForm] = useState(emptyGroup);
  const [editingGrpId, setEditingGrpId] = useState(null);
  const [quickAssignByGroup, setQuickAssignByGroup] = useState({});
  const [assigningGroupKey, setAssigningGroupKey] = useState('');
  const [savingPriestTransfer, setSavingPriestTransfer] = useState(false);

  const handleQuickAddYearFromCard = async (grp, rawYearName) => {
    if (requireAdminGuard && !requireAdminGuard()) return false;
    const cleanYear = String(rawYearName || '').trim();
    if (!cleanYear) {
      alert('اكتب اسم السنة أو المرحلة الدراسية أولاً (مثال: أولى ابتدائي)');
      return false;
    }
    if (!grp?.id) {
      alert('قم بتشغيل SQL جدول service_groups أولاً حتى يتم حفظ السنوات في الداتابيز.');
      return false;
    }

    const existingStages = normalizeGroupStages(grp.stages);
    if (existingStages.includes(cleanYear)) {
      alert('هذه السنة الدراسية مضافة بالفعل داخل هذه الخدمة.');
      return false;
    }

    const nextStages = [...existingStages, cleanYear];
    const { data, error } = await supabase
      .from('service_groups')
      .update({ stages: nextStages, has_classes: true })
      .eq('id', grp.id)
      .select()
      .single();

    if (error) {
      alert('تعذر إضافة السنة الدراسية: ' + error.message);
      return false;
    }
    if (data) {
      setDbServiceGroups(dbServiceGroups.map(g => (g.id === grp.id ? data : g)));
      if (onRefresh) await onRefresh();
      return true;
    }
    return false;
  };

  const handleSaveServiceGroup = async (e) => {
    e.preventDefault();
    if (requireAdminGuard && !requireAdminGuard()) return;
    const stagesArr = normalizeGroupStages(grpForm.stagesText);
    const payload = {
      group_name: grpForm.group_name.trim(),
      icon: grpForm.icon.trim() || (grpForm.has_classes ? '🏫' : '🕊️'),
      gender_target: grpForm.gender_target || 'عام (الكل: ذكور وإناث)',
      has_classes: Boolean(grpForm.has_classes),
      head_servant_name: grpForm.head_servant_name.trim(),
      servants_names: grpForm.servants_names.trim(),
      service_day: grpForm.service_day.trim(),
      start_time: grpForm.start_time || '',
      end_time: grpForm.end_time || '',
      stages: stagesArr,
      sort_order: Number(grpForm.sort_order || dbServiceGroups.length + 1)
    };
    if (!payload.group_name) return alert('اكتب اسم الخدمة أو الاجتماع');

    if (editingGrpId) {
      const { data, error } = await supabase.from('service_groups').update(payload).eq('id', editingGrpId).select().single();
      if (error) return alert('خطأ في التعديل: ' + error.message);
      if (data) {
        setDbServiceGroups(dbServiceGroups.map(g => (g.id === editingGrpId ? data : g)).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
        setEditingGrpId(null);
        setGrpForm({ ...emptyGroup, sort_order: dbServiceGroups.length + 1 });
        if (onRefresh) await onRefresh();
      }
    } else {
      const { data, error } = await supabase.from('service_groups').insert([payload]).select().single();
      if (error) return alert('خطأ في الإضافة (تأكد من تشغيل SQL جدول service_groups): ' + error.message);
      if (data) {
        const cleanExisting = dbServiceGroups.filter(g => g.id);
        setDbServiceGroups([...cleanExisting, data].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
        if (data.has_classes !== false) {
          setSrvForm(prev => ({
            ...prev,
            stage_name: data.group_name,
            academic_year: stagesArr[0] || ''
          }));
        }
        setGrpForm({ ...emptyGroup, sort_order: cleanExisting.length + 2 });
        if (onRefresh) await onRefresh();
      }
    }
  };

  const handleDeleteServiceGroup = async (grp) => {
    if (requireAdminGuard && !requireAdminGuard()) return;
    if (!grp.id) return alert('قم بتشغيل كود SQL جدول service_groups أولاً حتى يتم الحفظ والحذف في الداتابيز.');
    if (!confirm(`حذف "${grp.group_name}"؟`)) return;
    const { error } = await supabase.from('service_groups').delete().eq('id', grp.id);
    if (!error) {
      setDbServiceGroups(dbServiceGroups.filter(g => g.id !== grp.id));
      if (onRefresh) await onRefresh();
    }
  };

  const handleToggleUserServiceAssignment = async (targetUserId, serviceName, shouldAssign = true, groupKey = '') => {
    if (requireAdminGuard && !requireAdminGuard()) return;
    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser || !serviceName) return;

    const currentStages = splitList(targetUser.detailed_stage || targetUser.service_stage);
    const nextStages = shouldAssign
      ? [...new Set([...currentStages, serviceName])]
      : currentStages.filter(st => st !== serviceName);

    const nextStageString = nextStages.join(', ');
    const currentExtraServices = Array.isArray(targetUser.permissions?.extra_services)
      ? targetUser.permissions.extra_services
      : [];
    const nextExtraServices = shouldAssign
      ? [...new Set([...currentExtraServices, serviceName])]
      : currentExtraServices.filter(st => st !== serviceName);

    const updatedPayload = {
      ...targetUser,
      detailed_stage: nextStageString,
      service_stage: nextStageString || targetUser.service_stage || '',
      permissions: {
        ...(targetUser.permissions || {}),
        extra_services: nextExtraServices
      }
    };

    setAssigningGroupKey(groupKey);
    try {
      await persistUserUpdate(updatedPayload);
    } finally {
      setAssigningGroupKey('');
    }
  };

  const handlePriestServiceTransfer = async (e) => {
    e.preventDefault();
    if (requireAdminGuard && !requireAdminGuard()) return;
    if (!priestTransferForm.toPriestId) {
      alert('اختر الأب الكاهن الجديد المسؤول');
      return;
    }

    setSavingPriestTransfer(true);
    try {
      let affectedClasses = [];

      if (priestTransferForm.mode === 'by_class') {
        if (!priestTransferForm.classId) {
          alert('اختر الفصل المطلوب تعديل كاهنه');
          return;
        }
        affectedClasses = services.filter(s => s.id === priestTransferForm.classId);
      } else if (priestTransferForm.mode === 'replace_priest') {
        if (!priestTransferForm.fromPriestId) {
          alert('اختر الأب الكاهن الحالي المراد نقله/استبداله');
          return;
        }
        affectedClasses = services.filter(s => s.priest_id === priestTransferForm.fromPriestId);
      } else {
        if (!priestTransferForm.serviceName) {
          alert('اختر الخدمة المطلوب نقل أو تعديل الكاهن المسؤول عنها');
          return;
        }
        const hierarchy = buildServiceHierarchy(priestTransferForm.serviceName, effectiveGroups, services);
        let matchedDb = hierarchy.allClasses.filter(c => !c.isVirtual && c.rawClass).map(c => c.rawClass);
        if (priestTransferForm.yearFilter) {
          const yrObj = hierarchy.years.find(y => y.yearName === priestTransferForm.yearFilter);
          const yrIds = new Set((yrObj?.dbClasses || []).map(c => c.id));
          matchedDb = matchedDb.filter(
            c => yrIds.has(c.id) || String(`${c.class_name || ''} ${c.stage_name || ''}`).includes(priestTransferForm.yearFilter)
          );
        }
        affectedClasses = priestTransferForm.fromPriestId
          ? matchedDb.filter(c => c.priest_id === priestTransferForm.fromPriestId)
          : matchedDb;
      }

      for (const cls of affectedClasses) {
        await persistServiceUpdate({
          ...cls,
          priest_id: priestTransferForm.toPriestId
        });
      }

      if (priestTransferForm.syncPriestSupervisedServices) {
        const toPriest = users.find(u => u.id === priestTransferForm.toPriestId);
        if (toPriest) {
          const prevSup = Array.isArray(toPriest.permissions?.supervised_services)
            ? toPriest.permissions.supervised_services
            : [];
          const nextSup = priestTransferForm.serviceName
            ? [...new Set([...prevSup, priestTransferForm.serviceName])]
            : prevSup;

          await persistUserUpdate({
            ...toPriest,
            permissions: {
              ...(toPriest.permissions || {}),
              supervised_services: nextSup
            }
          });
        }

        if (priestTransferForm.fromPriestId && priestTransferForm.fromPriestId !== priestTransferForm.toPriestId && priestTransferForm.serviceName) {
          const fromPriest = users.find(u => u.id === priestTransferForm.fromPriestId);
          if (fromPriest) {
            const remainingForFrom = services.filter(
              s => s.priest_id === fromPriest.id &&
                !affectedClasses.some(ac => ac.id === s.id) &&
                s.stage_name === priestTransferForm.serviceName
            );
            if (remainingForFrom.length === 0) {
              const prevFromSup = Array.isArray(fromPriest.permissions?.supervised_services)
                ? fromPriest.permissions.supervised_services
                : [];
              await persistUserUpdate({
                ...fromPriest,
                permissions: {
                  ...(fromPriest.permissions || {}),
                  supervised_services: prevFromSup.filter(srv => srv !== priestTransferForm.serviceName)
                }
              });
            }
          }
        }
      }

      if (onRefresh) await onRefresh();
      alert(`تم تحديث مسؤولية الكاهن بنجاح على ${affectedClasses.length} ${affectedClasses.length === 1 ? 'فصل' : 'فصول'} ✅`);
    } catch (err) {
      alert('تعذر تحديث الكاهن: ' + err.message);
    } finally {
      setSavingPriestTransfer(false);
    }
  };

  const groupsWithClasses = effectiveGroups.filter(g => g.has_classes !== false);
  const chosenClassServiceName = srvForm.stage_name || groupsWithClasses[0]?.group_name || '';
  const selectedClassServiceObj = groupsWithClasses.find(g => g.group_name === chosenClassServiceName);
  const selectedServiceHierarchy = buildServiceHierarchy(chosenClassServiceName, effectiveGroups, services);
  const selectedServantTagsInForm = splitList(grpForm.servants_names);
  const priestTransferHierarchy = buildServiceHierarchy(priestTransferForm.serviceName, effectiveGroups, services);

  return (
    <div className="space-y-3 text-xs">
      <div className="bg-white p-2 rounded-2xl border flex items-center gap-1.5 overflow-x-auto font-black shadow-2xs">
        {[
          { id: 'browse', label: '🗂️ تصفح الكروت (الخدمة ← السنة ← الفصل)' },
          ...(isAdmin ? [
            { id: 'add', label: '➕ إضافة خدمة أو فصل' },
            { id: 'priest_transfer', label: '✝ نقل وتعديل الكاهن' }
          ] : []),
          { id: 'assign_groups', label: '👥 ربط الخدام والمجموعات والسنوات' }
        ].map(st => (
          <button
            key={st.id}
            type="button"
            onClick={() => setServicesSubTab(st.id)}
            className={`px-3.5 py-2 rounded-xl shrink-0 cursor-pointer ${
              servicesSubTab === st.id
                ? 'bg-[#7a1c24] text-white shadow-2xs'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {servicesSubTab === 'browse' && (
        <ServiceDrillDownCards
          groups={effectiveGroups}
          services={services}
          users={users}
          isAdmin={isAdmin}
          onSelectService={(grp) => {
            if (!isAdmin) return;
            setSrvForm(prev => ({ ...prev, stage_name: grp.group_name, academic_year: '' }));
          }}
          onSelectYear={(grp, yr) => {
            if (!isAdmin) return;
            setSrvForm(prev => ({ ...prev, stage_name: grp.group_name, academic_year: yr.yearName || '' }));
          }}
          onQuickAddYear={handleQuickAddYearFromCard}
          onQuickAddClassForYear={(grp, yr) => {
            setEditingSrvId(null);
            setSrvForm({
              ...emptyService,
              stage_name: grp.group_name,
              academic_year: yr.yearName || '',
              head_servant_name: grp.head_servant_name || ''
            });
            setServicesSubTab('add');
          }}
          onEditGroup={(grp, idx) => {
            if (!grp.id) return alert('قم بتشغيل SQL جدول service_groups أولاً.');
            setEditingGrpId(grp.id);
            setGrpForm({
              group_name: grp.group_name,
              icon: grp.icon || '🏫',
              gender_target: grp.gender_target || 'عام (الكل: ذكور وإناث)',
              has_classes: grp.has_classes !== false,
              head_servant_name: grp.head_servant_name || '',
              servants_names: grp.servants_names || '',
              service_day: grp.service_day || '',
              start_time: grp.start_time || '',
              end_time: grp.end_time || '',
              stagesText: normalizeGroupStages(grp.stages).join(', '),
              sort_order: grp.sort_order || idx + 1
            });
            setServicesSubTab('add');
          }}
          onDeleteGroup={handleDeleteServiceGroup}
          onTransferGroupPriest={(grp) => {
            setPriestTransferForm(prev => ({
              ...prev,
              mode: 'by_service',
              serviceName: grp.group_name,
              yearFilter: ''
            }));
            setServicesSubTab('priest_transfer');
          }}
          onEditClass={(cls, grp, yr) => {
            setEditingSrvId(cls.id);
            setSrvForm({
              ...emptyService,
              ...cls,
              stage_name: grp?.group_name || cls.stage_name || '',
              academic_year: yr?.yearName || '',
              class_gender: 'عام'
            });
            setServicesSubTab('add');
          }}
          onDeleteClass={onDeleteService}
          onTransferClassPriest={(cls) => {
            setPriestTransferForm(prev => ({
              ...prev,
              mode: 'by_class',
              classId: cls.id,
              fromPriestId: cls.priest_id || ''
            }));
            setServicesSubTab('priest_transfer');
          }}
        />
      )}

      {servicesSubTab === 'priest_transfer' && isAdmin && (
        <div className="bg-purple-50/50 p-4 rounded-3xl border-2 border-purple-200 space-y-3 font-bold shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black flex items-center gap-1.5 text-purple-950">
              <ArrowLeftRight size={16} /> ✝ نقل وتعديل الكاهن المسؤول عن خدمة أو سنة دراسية أو فصل
            </h3>
            <div className="flex gap-1 text-[11px]">
              <button type="button" onClick={() => setPriestTransferForm(prev => ({ ...prev, mode: 'by_service' }))} className={`px-2.5 py-1 rounded-lg cursor-pointer ${priestTransferForm.mode === 'by_service' ? 'bg-purple-800 text-white' : 'bg-white border text-gray-700'}`}>حسب الخدمة / السنة</button>
              <button type="button" onClick={() => setPriestTransferForm(prev => ({ ...prev, mode: 'by_class' }))} className={`px-2.5 py-1 rounded-lg cursor-pointer ${priestTransferForm.mode === 'by_class' ? 'bg-purple-800 text-white' : 'bg-white border text-gray-700'}`}>حسب فصل محدد</button>
              <button type="button" onClick={() => setPriestTransferForm(prev => ({ ...prev, mode: 'replace_priest' }))} className={`px-2.5 py-1 rounded-lg cursor-pointer ${priestTransferForm.mode === 'replace_priest' ? 'bg-purple-800 text-white' : 'bg-white border text-gray-700'}`}>نقل كل فصول كاهن لكاهن</button>
            </div>
          </div>

          <form onSubmit={handlePriestServiceTransfer} className="space-y-2.5">
            <div className="grid md:grid-cols-4 gap-2">
              {priestTransferForm.mode === 'by_service' && (
                <>
                  <div>
                    <label className="block text-[10px] text-gray-600 mb-0.5">① الخدمة المستهدفة *</label>
                    <select className="w-full p-2.5 border rounded-xl bg-white" value={priestTransferForm.serviceName} onChange={e => setPriestTransferForm(prev => ({ ...prev, serviceName: e.target.value, yearFilter: '' }))}>
                      <option value="">-- اختر الخدمة --</option>
                      {availableServantServices.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-600 mb-0.5">السنة الدراسية (اختياري)</label>
                    <select className="w-full p-2.5 border rounded-xl bg-white" value={priestTransferForm.yearFilter} onChange={e => setPriestTransferForm(prev => ({ ...prev, yearFilter: e.target.value }))}>
                      <option value="">-- كل سنوات الخدمة --</option>
                      {priestTransferHierarchy.years.map((yr, idx) => <option key={idx} value={yr.yearName}>{yr.yearName}</option>)}
                    </select>
                  </div>
                </>
              )}

              {priestTransferForm.mode === 'by_class' && (
                <div className="md:col-span-2">
                  <label className="block text-[10px] text-gray-600 mb-0.5">① الفصل المحدد *</label>
                  <select className="w-full p-2.5 border rounded-xl bg-white" value={priestTransferForm.classId} onChange={e => setPriestTransferForm(prev => ({ ...prev, classId: e.target.value }))}>
                    <option value="">-- اختر الفصل --</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.class_name} ({s.stage_name})</option>)}
                  </select>
                </div>
              )}

              {priestTransferForm.mode === 'replace_priest' && (
                <div>
                  <label className="block text-[10px] text-gray-600 mb-0.5">① الكاهن الحالي المراد نقله *</label>
                  <select className="w-full p-2.5 border rounded-xl bg-white" value={priestTransferForm.fromPriestId} onChange={e => setPriestTransferForm(prev => ({ ...prev, fromPriestId: e.target.value }))}>
                    <option value="">-- اختر الكاهن الحالي --</option>
                    {priestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">② الأب الكاهن الجديد المسؤول *</label>
                <select required className="w-full p-2.5 border rounded-xl bg-white" value={priestTransferForm.toPriestId} onChange={e => setPriestTransferForm(prev => ({ ...prev, toPriestId: e.target.value }))}>
                  <option value="">-- اختر الأب الكاهن --</option>
                  {priestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>

              <div className="flex items-end">
                <button type="submit" disabled={savingPriestTransfer} className="w-full p-2.5 bg-purple-800 hover:bg-purple-900 text-white rounded-xl cursor-pointer shadow">
                  {savingPriestTransfer ? 'جاري التحديث...' : 'تطبيق نقل / تعديل الكاهن'}
                </button>
              </div>
            </div>

            {priestTransferForm.mode !== 'replace_priest' && (
              <div className="max-w-xs">
                <label className="block text-[10px] text-gray-600 mb-0.5">تصفية بكاهن سابق محدد (اختياري)</label>
                <select
                  className="w-full p-2 border rounded-xl bg-white text-[11px]"
                  value={priestTransferForm.fromPriestId}
                  onChange={e => setPriestTransferForm(prev => ({ ...prev, fromPriestId: e.target.value }))}
                >
                  <option value="">-- الكل --</option>
                  {priestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
            )}

            <label className="flex items-center gap-2 text-[11px] text-purple-950 cursor-pointer">
              <input type="checkbox" checked={priestTransferForm.syncPriestSupervisedServices} onChange={e => setPriestTransferForm(prev => ({ ...prev, syncPriestSupervisedServices: e.target.checked }))} />
              تحديث قائمة الخدمات المسندة للكاهن تلقائياً (اللي ماسكها واللي مش ماسكها)
            </label>

            {priestsList.length > 0 && (
              <div className="max-h-48 overflow-y-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                {priestsList.map(pr => {
                  const cov = getPriestCoverage ? getPriestCoverage(pr.id) : { assignedServices: [], unassignedServices: [] };
                  return (
                    <div key={pr.id} className="bg-white p-2.5 rounded-2xl border space-y-1 text-[11px]">
                      <div className="font-black text-gray-900">✝ {pr.full_name}</div>
                      <div className="text-emerald-900"><strong>ماسك:</strong> {cov.assignedServices.length > 0 ? cov.assignedServices.join('، ') : 'لا يوجد'}</div>
                      <div className="text-gray-500"><strong>مش ماسك:</strong> {cov.unassignedServices.length > 0 ? cov.unassignedServices.join('، ') : 'ماسك الكل'}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </form>
        </div>
      )}

      {servicesSubTab === 'add' && isAdmin && (
        <div className="grid lg:grid-cols-2 gap-3">
          <div className="bg-amber-50/50 p-4 rounded-3xl border-2 border-amber-300 space-y-3 font-bold shadow-2xs">
            <h3 className="text-sm font-extrabold flex items-center gap-1.5 text-[#7a1c24]">
              <Layers size={15} /> {editingGrpId ? '✏️ تعديل الخدمة / الاجتماع' : '① أولاً: إضافة خدمة أو اجتماع والسنوات الدراسية التابعة لها'}
            </h3>
            <form onSubmit={handleSaveServiceGroup} className="space-y-2.5">
              <input required placeholder="اسم الخدمة (مثال: خدمة ابتدائي / حضانة / شعب عام) *" className="w-full p-2.5 border rounded-xl bg-white" value={grpForm.group_name} onChange={e => setGrpForm({ ...grpForm, group_name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="p-2.5 border rounded-xl bg-white"
                  value={grpForm.has_classes ? 'yes' : 'no'}
                  onChange={e => {
                    const hasCls = e.target.value === 'yes';
                    setGrpForm({
                      ...grpForm,
                      has_classes: hasCls,
                      icon: hasCls ? '🏫' : '🕊️',
                      gender_target: !hasCls ? 'عام (الكل: ذكور وإناث)' : grpForm.gender_target
                    });
                  }}
                >
                  <option value="yes">📚 خدمة لها سنوات / فصول بداخلها</option>
                  <option value="no">🕊️ اجتماع عام / خدمة بدون فصول</option>
                </select>
                <select className="p-2.5 border rounded-xl bg-white" value={grpForm.gender_target || 'عام (الكل: ذكور وإناث)'} onChange={e => setGrpForm({ ...grpForm, gender_target: e.target.value })}>
                  <option value="عام (الكل: ذكور وإناث)">👥 عام (الكل: ذكور وإناث)</option>
                  <option value="ذكور / بنين فقط">♂️ ذكور / بنين فقط</option>
                  <option value="إناث / بنات فقط">♀️ إناث / بنات فقط</option>
                  <option value="أطفال (بنين وبنات)">🧸 أطفال (بنين وبنات)</option>
                  <option value="مقسمة (بنين / بنات)">⚖️ مقسمة (بنين / بنات)</option>
                </select>
              </div>

              <div className="bg-white p-2.5 rounded-2xl border space-y-2">
                <div>
                  <label className="block text-[10px] text-gray-600 mb-1">⭐ أمين الخدمة / المسؤول (اختيار أو كتابة):</label>
                  <div className="flex gap-1.5">
                    <select
                      className="p-2 border rounded-xl bg-gray-50 text-[11px] max-w-36"
                      value=""
                      onChange={e => { if (e.target.value) setGrpForm({ ...grpForm, head_servant_name: e.target.value }); }}
                    >
                      <option value="">-- اختر أمين --</option>
                      {servantsList.map(sv => <option key={sv.id} value={sv.full_name}>{sv.full_name}</option>)}
                    </select>
                    <input placeholder="اسم أمين الخدمة..." className="flex-1 p-2 border rounded-xl bg-white" value={grpForm.head_servant_name || ''} onChange={e => setGrpForm({ ...grpForm, head_servant_name: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] text-gray-600">👥 الخدام بالخدمة (اختيار متعدد أو كتابة):</label>
                  <div className="flex gap-1.5">
                    <select
                      className="p-2 border rounded-xl bg-gray-50 text-[11px] max-w-36"
                      value=""
                      onChange={e => {
                        const v = e.target.value;
                        if (!v) return;
                        const cur = splitList(grpForm.servants_names);
                        if (!cur.includes(v)) setGrpForm({ ...grpForm, servants_names: [...cur, v].join(', ') });
                      }}
                    >
                      <option value="">+ إضافة خادم --</option>
                      {servantsList.map(sv => <option key={sv.id} value={sv.full_name}>{sv.full_name}</option>)}
                    </select>
                    <input placeholder="أسماء الخدام (مفصولة بفاصلة)..." className="flex-1 p-2 border rounded-xl bg-white" value={grpForm.servants_names || ''} onChange={e => setGrpForm({ ...grpForm, servants_names: e.target.value })} />
                  </div>
                  {selectedServantTagsInForm.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {selectedServantTagsInForm.map((name, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-950 rounded-lg text-[10px]">
                          {name}
                          <button type="button" onClick={() => setGrpForm({ ...grpForm, servants_names: selectedServantTagsInForm.filter((_, idx) => idx !== i).join(', ') })} className="text-red-700 hover:text-red-900 cursor-pointer"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-600 mb-0.5">يوم الخدمة</label>
                  <input placeholder="الجمعة" className="w-full p-2 border rounded-xl bg-white" value={grpForm.service_day || ''} onChange={e => setGrpForm({ ...grpForm, service_day: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-600 mb-0.5">من الساعة</label>
                  <input type="time" className="w-full p-2 border rounded-xl bg-white" value={grpForm.start_time || ''} onChange={e => setGrpForm({ ...grpForm, start_time: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-600 mb-0.5">إلى الساعة</label>
                  <input type="time" className="w-full p-2 border rounded-xl bg-white" value={grpForm.end_time || ''} onChange={e => setGrpForm({ ...grpForm, end_time: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-600 mb-0.5">الأيقونة</label>
                  <input placeholder="🏫" className="w-full p-2 border rounded-xl bg-white text-center" value={grpForm.icon} onChange={e => setGrpForm({ ...grpForm, icon: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-600 mb-0.5">الترتيب</label>
                  <input type="number" min="1" className="w-full p-2 border rounded-xl bg-white text-center" value={grpForm.sort_order} onChange={e => setGrpForm({ ...grpForm, sort_order: e.target.value })} />
                </div>
              </div>
              <input placeholder="السنوات الدراسية أو المراحل الفرعية (مثال: أولى ابتدائي, ثانية ابتدائي أو KG 1, KG 2)" className="w-full p-2.5 border rounded-xl bg-white font-normal" value={grpForm.stagesText} onChange={e => setGrpForm({ ...grpForm, stagesText: e.target.value })} />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-2.5 bg-[#7a1c24] text-white rounded-xl cursor-pointer shadow">{editingGrpId ? 'حفظ التعديل' : '+ حفظ الخدمة / الاجتماع'}</button>
                {editingGrpId && <button type="button" onClick={() => { setEditingGrpId(null); setGrpForm({ ...emptyGroup, sort_order: effectiveGroups.length + 1 }); }} className="px-4 py-2 border rounded-xl bg-white">إلغاء</button>}
              </div>
            </form>
          </div>

          <form
            id="add-class-form"
            onSubmit={e => {
              e.preventDefault();
              if (requireAdminGuard && !requireAdminGuard()) return;
              const chosenServiceName = srvForm.stage_name || groupsWithClasses[0]?.group_name || '';
              if (!chosenServiceName) return alert('أضف أولاً خدمة لها فصول ثم اخترها هنا');

              const yearTag = String(srvForm.academic_year || '').trim();
              const baseClassName = String(srvForm.class_name || '').trim();
              const fullClassTitle = yearTag && !baseClassName.includes(yearTag) ? `${yearTag} - ${baseClassName}` : baseClassName;
              const finalClassName = srvForm.class_gender && srvForm.class_gender !== 'عام' && !fullClassTitle.includes(srvForm.class_gender)
                ? `${fullClassTitle} (${srvForm.class_gender})` : fullClassTitle;

              const { class_gender, academic_year, ...cleanSrv } = srvForm;
              const payload = { ...cleanSrv, class_name: finalClassName, stage_name: yearTag || chosenServiceName, priest_id: srvForm.priest_id || null };
              if (editingSrvId) { persistServiceUpdate({ ...payload, id: editingSrvId }); setEditingSrvId(null); }
              else { onAddService(payload); }
              setSrvForm({ ...emptyService, stage_name: chosenServiceName, academic_year: yearTag });
            }}
            className="bg-white p-4 rounded-3xl border space-y-2.5 font-bold shadow-2xs"
          >
            <h3 className="text-sm font-extrabold flex items-center gap-1 text-[#7a1c24]">
              <BookOpen size={15} /> {editingSrvId ? '✏️ تعديل الفصل' : '② ثانياً: إضافة فصل (باسم قديس مثلاً) وربطه بالخدمة والسنة الدراسية'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">① الخدمة *</label>
                <select required className="w-full p-2.5 border rounded-xl bg-amber-50/50" value={chosenClassServiceName} onChange={e => setSrvForm({ ...srvForm, stage_name: e.target.value, academic_year: '' })}>
                  <option value="">-- اختر الخدمة * --</option>
                  {groupsWithClasses.map((g, i) => <option key={g.id || i} value={g.group_name}>{g.icon || '🏫'} {g.group_name} ({g.gender_target || 'عام'})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">② العام الدراسي / المرحلة الفرعية</label>
                <select className="w-full p-2.5 border rounded-xl bg-white" value={srvForm.academic_year || ''} onChange={e => setSrvForm({ ...srvForm, academic_year: e.target.value })}>
                  <option value="">-- عام / بدون سنة محددة --</option>
                  {selectedServiceHierarchy.years.map((yr, yIdx) => <option key={yIdx} value={yr.yearName}>{yr.yearName}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">③ اسم الفصل *</label>
                <input required placeholder="مثال: فصل مارمينا / مارجرجس *" className="w-full p-2.5 border rounded-xl" value={srvForm.class_name} onChange={e => setSrvForm({ ...srvForm, class_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">الأب الكاهن</label>
                <select className="w-full p-2.5 border rounded-xl bg-amber-50/40" value={srvForm.priest_id || ''} onChange={e => setSrvForm({ ...srvForm, priest_id: e.target.value })}>
                  <option value="">-- الكاهن --</option>
                  {priestsList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
            </div>
            {selectedClassServiceObj?.gender_target?.includes('متقسمة') && (
              <p className="text-[11px] text-amber-900 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">💡 الخدمة المختارة ({selectedClassServiceObj.group_name}) مقسّمة — حدد النوع (بنين / بنات)</p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <select className="p-2.5 border rounded-xl bg-white" value={srvForm.class_gender || 'عام'} onChange={e => setSrvForm({ ...srvForm, class_gender: e.target.value })}>
                <option value="عام">👥 عام</option><option value="بنين">♂️ بنين</option><option value="بنات">♀️ بنات</option>
              </select>
              <input placeholder="أمين الفصل / الخدمة" className="p-2.5 border rounded-xl" value={srvForm.head_servant_name} onChange={e => setSrvForm({ ...srvForm, head_servant_name: e.target.value })} />
              <input placeholder="مساعد / خدام الفصل" className="p-2.5 border rounded-xl" value={srvForm.vice_head_name} onChange={e => setSrvForm({ ...srvForm, vice_head_name: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <input placeholder="ميعاد وقاعة الفصل" className="flex-1 p-2.5 border rounded-xl" value={srvForm.meeting_time} onChange={e => setSrvForm({ ...srvForm, meeting_time: e.target.value })} />
              <button type="submit" className="px-4 py-2.5 bg-[#7a1c24] text-white rounded-xl shadow cursor-pointer">{editingSrvId ? 'حفظ التعديل' : 'حفظ الفصل للخدمة'}</button>
              {editingSrvId && <button type="button" onClick={() => { setEditingSrvId(null); setSrvForm(emptyService); }} className="px-3 border rounded-xl">إلغاء</button>}
            </div>
          </form>
        </div>
      )}

      {servicesSubTab === 'assign_groups' && (
        <div className="space-y-3">
          <div className="max-h-[54dvh] overflow-y-auto pr-1 grid md:grid-cols-2 gap-3">
            {effectiveGroups.map((grp, idx) => {
              const groupKey = String(grp.id || grp.group_name || idx);
              const hierarchy = buildServiceHierarchy(grp.group_name, effectiveGroups, services);
              const stagesArr = hierarchy.years.map(y => y.yearName);
              const subScopeOptions = [...new Set([grp.group_name, ...stagesArr, ...hierarchy.allClasses.map(c => c.value)].filter(Boolean))];
              const selectedQuickScope = quickAssignByGroup[groupKey]?.scope || grp.group_name;
              const selectedQuickUserId = quickAssignByGroup[groupKey]?.userId || '';

              const linkedUsersForGroup = assignableUsersList.filter(u => {
                const uStages = splitList(`${u.detailed_stage || ''} ${u.service_stage || ''}`);
                const uExtra = Array.isArray(u.permissions?.extra_services) ? u.permissions.extra_services : [];
                const combined = [...uStages, ...uExtra];
                return subScopeOptions.some(opt => combined.includes(opt) || combined.some(item => item.includes(opt)));
              });

              const classesInThisService = hierarchy.allClasses.filter(c => !c.isVirtual && c.rawClass).map(c => c.rawClass);
              const priestsInThisService = [...new Set(
                classesInThisService.map(c => c.priest_id).filter(Boolean)
              )].map(pid => priestsList.find(p => p.id === pid)).filter(Boolean);

              return (
                <div key={groupKey} className="bg-white p-4 rounded-3xl border-2 border-gray-200 space-y-3 shadow-2xs">
                  <div className="flex flex-wrap justify-between items-start gap-2 border-b pb-2.5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xl">{grp.icon || (grp.has_classes !== false ? '🏫' : '🕊️')}</span>
                        <strong className="text-sm text-[#7a1c24]">{grp.group_name}</strong>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-900">
                          {grp.gender_target || 'عام (الكل: ذكور وإناث)'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${grp.has_classes !== false ? 'bg-emerald-50 text-emerald-900' : 'bg-purple-50 text-purple-900'}`}>
                          {grp.has_classes !== false ? '📚 لها سنوات / فصول' : '🕊️ اجتماع عام بدون فصول'}
                        </span>
                      </div>
                      {(grp.service_day || grp.start_time) && (
                        <p className="text-[11px] text-amber-900 font-bold">
                          ⏰ {grp.service_day} {grp.start_time && `من ${grp.start_time}`} {grp.end_time && `إلى ${grp.end_time}`}
                        </p>
                      )}
                      {priestsInThisService.length > 0 && (
                        <p className="text-[11px] text-purple-900">
                          ✝ <strong>الكاهن المسؤول:</strong> {priestsInThisService.map(p => p.full_name).join('، ')}
                        </p>
                      )}
                      {grp.head_servant_name && (
                        <p className="text-[11px] text-gray-800">⭐ <strong>الأمين:</strong> {grp.head_servant_name}</p>
                      )}
                      {grp.servants_names && (
                        <p className="text-[11px] text-gray-600">👥 <strong>الخدام:</strong> {grp.servants_names}</p>
                      )}
                      {stagesArr.length > 0 && (
                        <p className="text-[11px] text-gray-500">السنوات / المراحل: {stagesArr.join(' • ')}</p>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPriestTransferForm(prev => ({
                              ...prev,
                              mode: 'by_service',
                              serviceName: grp.group_name,
                              yearFilter: ''
                            }));
                            setServicesSubTab('priest_transfer');
                          }}
                          className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-950 rounded-lg font-bold cursor-pointer"
                        >
                          ✝ نقل كاهن الخدمة
                        </button>
                        {grp.has_classes !== false && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSrvId(null);
                              setSrvForm({
                                ...emptyService,
                                stage_name: grp.group_name,
                                academic_year: stagesArr[0] || '',
                                head_servant_name: grp.head_servant_name || ''
                              });
                              setServicesSubTab('add');
                            }}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-lg font-bold cursor-pointer"
                          >
                            + إضافة فصل
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (!grp.id) return alert('قم بتشغيل SQL جدول service_groups أولاً.');
                            setEditingGrpId(grp.id);
                            setGrpForm({
                              group_name: grp.group_name,
                              icon: grp.icon || '🏫',
                              gender_target: grp.gender_target || 'عام (الكل: ذكور وإناث)',
                              has_classes: grp.has_classes !== false,
                              head_servant_name: grp.head_servant_name || '',
                              servants_names: grp.servants_names || '',
                              service_day: grp.service_day || '',
                              start_time: grp.start_time || '',
                              end_time: grp.end_time || '',
                              stagesText: normalizeGroupStages(grp.stages).join(', '),
                              sort_order: grp.sort_order || idx + 1
                            });
                            setServicesSubTab('add');
                          }}
                          className="p-1.5 bg-gray-100 hover:bg-amber-100 rounded-lg cursor-pointer"
                          title="تعديل"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteServiceGroup(grp)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="bg-emerald-50/50 p-2.5 rounded-2xl border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-emerald-950 flex items-center gap-1">
                          <UserCheck size={13} /> ربط خدام أو مخدومين بـ ({grp.group_name}):
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800">
                          {linkedUsersForGroup.length} مرتبط
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {subScopeOptions.length > 1 && (
                          <select
                            className="p-1.5 border rounded-xl bg-white text-[11px] font-bold"
                            value={selectedQuickScope}
                            onChange={e => setQuickAssignByGroup(prev => ({
                              ...prev,
                              [groupKey]: { ...(prev[groupKey] || {}), scope: e.target.value }
                            }))}
                          >
                            {subScopeOptions.map((opt, oIdx) => (
                              <option key={oIdx} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}

                        <select
                          className="flex-1 min-w-36 p-1.5 border rounded-xl bg-white text-[11px] font-bold"
                          value={selectedQuickUserId}
                          onChange={e => setQuickAssignByGroup(prev => ({
                            ...prev,
                            [groupKey]: {
                              scope: prev[groupKey]?.scope || grp.group_name,
                              userId: e.target.value
                            }
                          }))}
                        >
                          <option value="">-- اختر خادم أو مخدوم لربطه --</option>
                          {assignableUsersList.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.full_name} ({ROLE_LABELS[u.role] || u.role})
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          disabled={!selectedQuickUserId || assigningGroupKey === groupKey}
                          onClick={async () => {
                            if (!selectedQuickUserId) return;
                            await handleToggleUserServiceAssignment(selectedQuickUserId, selectedQuickScope, true, groupKey);
                            setQuickAssignByGroup(prev => ({
                              ...prev,
                              [groupKey]: { ...(prev[groupKey] || {}), userId: '' }
                            }));
                          }}
                          className="px-3 py-1.5 bg-[#7a1c24] disabled:bg-gray-300 text-white rounded-xl text-[11px] font-black cursor-pointer"
                        >
                          {assigningGroupKey === groupKey ? 'جاري الربط...' : '+ ربط بالخدمة'}
                        </button>
                      </div>

                      {linkedUsersForGroup.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 max-h-28 overflow-y-auto">
                          {linkedUsersForGroup.map(u => {
                            const matchingScopes = subScopeOptions.filter(opt => {
                              const uStages = splitList(`${u.detailed_stage || ''} ${u.service_stage || ''}`);
                              const uExtra = Array.isArray(u.permissions?.extra_services) ? u.permissions.extra_services : [];
                              const combined = [...uStages, ...uExtra];
                              return combined.includes(opt) || combined.some(item => item.includes(opt));
                            });
                            const scopeToRemove = matchingScopes[0] || grp.group_name;

                            return (
                              <span
                                key={u.id}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-emerald-300 text-emerald-950 rounded-xl text-[10px] font-bold shadow-2xs"
                              >
                                <span>{u.full_name}</span>
                                <span className="text-gray-400">({matchingScopes.join('، ') || grp.group_name})</span>
                                <button
                                  type="button"
                                  onClick={() => onOpenSingleTransfer(u)}
                                  className="text-amber-800 hover:underline mr-0.5 cursor-pointer"
                                  title="نقل هذا المستخدم لخدمة أو فصل آخر"
                                >
                                  نقل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onGoToPermissions(u.id)}
                                  className="text-indigo-700 hover:underline mr-0.5 cursor-pointer"
                                  title="تعديل صلاحيات هذا المستخدم"
                                >
                                  صلاحيات
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleUserServiceAssignment(u.id, scopeToRemove, false, groupKey)}
                                  className="text-red-700 hover:text-red-900 cursor-pointer"
                                  title="إلغاء ربط هذه الخدمة"
                                >
                                  <X size={11} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {grp.has_classes !== false ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                      {hierarchy.years.map((yr, yIdx) => (
                        <div key={yIdx} className="p-2.5 bg-[#fbfaf7] rounded-2xl border space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-xs text-[#7a1c24]">📘 {yr.yearName}</strong>
                            <span className="text-[10px] text-gray-500">
                              {yr.dbClasses.length > 0 ? `${yr.dbClasses.length} فصل` : 'شعبة عامة (بدون فصول مضافة)'}
                            </span>
                          </div>
                          {yr.dbClasses.length > 0 && (
                            <div className="space-y-1">
                              {yr.dbClasses.map(srv => {
                                const pObj = priestsList.find(p => p.id === srv.priest_id);
                                return (
                                  <div key={srv.id} className="p-2 bg-white rounded-xl border flex justify-between items-center gap-2">
                                    <div>
                                      <strong className="text-xs text-gray-900 block">{srv.class_name}</strong>
                                      <span className="text-[11px] text-gray-500">
                                        {pObj && `✝ ${pObj.full_name} • `}
                                        {srv.head_servant_name && `⭐ الأمين: ${srv.head_servant_name} `}
                                        {srv.vice_head_name && `• الخدام: ${srv.vice_head_name} `}
                                        {srv.meeting_time && `• ⏰ ${srv.meeting_time}`}
                                      </span>
                                    </div>
                                    {isAdmin && (
                                      <div className="flex gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPriestTransferForm(prev => ({
                                              ...prev,
                                              mode: 'by_class',
                                              classId: srv.id,
                                              fromPriestId: srv.priest_id || ''
                                            }));
                                            setServicesSubTab('priest_transfer');
                                          }}
                                          className="px-2 py-1 bg-purple-50 text-purple-900 rounded-lg text-[10px] font-bold cursor-pointer"
                                          title="نقل / تعديل كاهن الفصل"
                                        >
                                          ✝ كاهن
                                        </button>
                                        <button onClick={() => { setEditingSrvId(srv.id); setSrvForm({ ...emptyService, ...srv, stage_name: grp.group_name, academic_year: yr.yearName, class_gender: 'عام' }); setServicesSubTab('add'); }} className="p-1.5 bg-white border rounded-lg cursor-pointer"><Edit3 size={12} /></button>
                                        <button onClick={() => onDeleteService(srv.id)} className="p-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer"><Trash2 size={12} /></button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}

                      {hierarchy.ungroupedClasses.length > 0 && (
                        <div className="space-y-1.5">
                          {hierarchy.ungroupedClasses.map(srv => {
                            const pObj = priestsList.find(p => p.id === srv.priest_id);
                            return (
                              <div key={srv.id} className="p-2.5 bg-[#fbfaf7] rounded-2xl border flex justify-between items-center gap-2">
                                <div>
                                  <strong className="text-xs text-gray-900 block">{srv.class_name}</strong>
                                  <span className="text-[11px] text-gray-500">
                                    {pObj && `✝ ${pObj.full_name} • `}
                                    {srv.head_servant_name && `⭐ الأمين: ${srv.head_servant_name} `}
                                    {srv.vice_head_name && `• الخدام: ${srv.vice_head_name} `}
                                    {srv.meeting_time && `• ⏰ ${srv.meeting_time}`}
                                  </span>
                                </div>
                                {isAdmin && (
                                  <div className="flex gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPriestTransferForm(prev => ({
                                          ...prev,
                                          mode: 'by_class',
                                          classId: srv.id,
                                          fromPriestId: srv.priest_id || ''
                                        }));
                                        setServicesSubTab('priest_transfer');
                                      }}
                                      className="px-2 py-1 bg-purple-50 text-purple-900 rounded-lg text-[10px] font-bold cursor-pointer"
                                      title="نقل / تعديل كاهن الفصل"
                                    >
                                      ✝ كاهن
                                    </button>
                                    <button onClick={() => { setEditingSrvId(srv.id); setSrvForm({ ...emptyService, ...srv, stage_name: grp.group_name, academic_year: '', class_gender: 'عام' }); setServicesSubTab('add'); }} className="p-1.5 bg-white border rounded-lg cursor-pointer"><Edit3 size={12} /></button>
                                    <button onClick={() => onDeleteService(srv.id)} className="p-1.5 bg-red-50 text-red-700 rounded-lg cursor-pointer"><Trash2 size={12} /></button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {hierarchy.years.length === 0 && hierarchy.ungroupedClasses.length === 0 && (
                        <p className="text-[11px] text-gray-500 bg-[#fbfaf7] p-2.5 rounded-xl border">
                          عامة / بدون فصول فرعية مسجلة حالياً (تظهر كاختيار مباشر باسم الخدمة).
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-purple-900 bg-purple-50/50 p-2 rounded-xl border border-purple-100">
                      🕊️ اجتماع عام / خدمة مفتوحة بدون فصول فرعية (تظهر ككارت لأعضائها وخدامها).
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <ServiceGroupFeed currentUser={effectiveUser} services={services} groups={effectiveGroups} canPost={isAdmin} />
        </div>
      )}
    </div>
  );
}
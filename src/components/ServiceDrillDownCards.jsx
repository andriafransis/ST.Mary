import { useState, useMemo } from 'react';
import { ArrowRight, Layers, Users, FolderOpen, Plus, Edit3, Trash2, ArrowLeftRight } from 'lucide-react';

const splitList = (val) =>
  String(val || '')
    .split(/[,،]/)
    .map(s => s.trim())
    .filter(Boolean);

export default function ServiceDrillDownCards({
  groups = [],
  services = [],
  users = [],
  isAdmin = false,
  selectedServiceId = null,
  onSelectService,
  onSelectYear,
  onSelectClass,
  onQuickAddYear,
  onQuickAddClassForYear,
  onEditGroup,
  onDeleteGroup,
  onTransferGroupPriest,
  onEditClass,
  onDeleteClass,
  onTransferClassPriest
}) {
  const [activeGroupKey, setActiveGroupKey] = useState(null);
  const [activeYearName, setActiveYearName] = useState(null);
  const [activeClassId, setActiveClassId] = useState(null);
  const [newYearName, setNewYearName] = useState('');

  const countMembersMatching = (namesList = []) => {
    const targets = namesList.filter(Boolean);
    if (targets.length === 0) return 0;
    return users.filter(u => {
      if (u.role !== 'member') return false;
      const userScopes = [
        ...splitList(u.detailed_stage),
        ...splitList(u.service_stage),
        ...splitList(u.assigned_class)
      ];
      return targets.some(t => userScopes.includes(t));
    }).length;
  };

  const enrichedGroups = useMemo(() => {
    return (groups || []).map((grp, idx) => {
      const key = String(grp.id || grp.group_name || idx);
      const stagesArr = Array.isArray(grp.stages)
        ? grp.stages.map(s => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean)
        : splitList(grp.stages);

      const groupClasses = (services || []).filter(
        s =>
          s.stage_name === grp.group_name ||
          stagesArr.includes(s.stage_name) ||
          (grp.group_name && String(grp.group_name).includes(s.stage_name))
      );

      const years = stagesArr.map(yrName => {
        const yrClasses = groupClasses.filter(
          c => c.stage_name === yrName || String(c.class_name || '').includes(yrName)
        );
        const memberCount = countMembersMatching([
          yrName,
          ...yrClasses.map(c => c.class_name)
        ]);
        return {
          yearName: yrName,
          classes: yrClasses,
          hasClasses: yrClasses.length > 0,
          memberCount
        };
      });

      const assignedIds = new Set(years.flatMap(y => y.classes.map(c => c.id)));
      const directClasses = groupClasses.filter(c => !assignedIds.has(c.id));

      const totalMembers = countMembersMatching([
        grp.group_name,
        ...stagesArr,
        ...groupClasses.map(c => c.class_name)
      ]);

      return {
        ...grp,
        _key: key,
        _index: idx,
        years,
        directClasses,
        hasYears: years.length > 0,
        totalMembers
      };
    });
  }, [groups, services, users]);

  const currentGroup = useMemo(
    () => enrichedGroups.find(g => g._key === activeGroupKey) || null,
    [enrichedGroups, activeGroupKey]
  );

  const currentYear = useMemo(() => {
    if (!currentGroup || !activeYearName) return null;
    return currentGroup.years.find(y => y.yearName === activeYearName) || null;
  }, [currentGroup, activeYearName]);

  const goBackToServices = () => {
    setActiveGroupKey(null);
    setActiveYearName(null);
    setActiveClassId(null);
    setNewYearName('');
  };

  const goBackToYears = () => {
    setActiveYearName(null);
    setActiveClassId(null);
  };

  return (
    <div className="bg-white p-4 rounded-3xl border shadow-2xs space-y-4 text-right" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-black">
          <button
            type="button"
            onClick={goBackToServices}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition ${
              !currentGroup ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
            }`}
          >
            الخدمات ({enrichedGroups.length})
          </button>

          {currentGroup && (
            <>
              <span className="text-gray-400">/</span>
              <button
                type="button"
                onClick={goBackToYears}
                className={`px-3 py-1.5 rounded-xl cursor-pointer transition ${
                  !currentYear ? 'bg-[#7a1c24] text-white' : 'bg-amber-50 hover:bg-amber-100 text-[#7a1c24]'
                }`}
              >
                {currentGroup.icon || '🏫'} {currentGroup.group_name}
              </button>
            </>
          )}

          {currentYear && (
            <>
              <span className="text-gray-400">/</span>
              <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-900">
                📘 {currentYear.yearName}
              </span>
            </>
          )}
        </div>

        {(currentGroup || currentYear) && (
          <button
            type="button"
            onClick={currentYear ? goBackToYears : goBackToServices}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
          >
            <ArrowRight size={14} /> رجوع
          </button>
        )}
      </div>

      {/* المستوى 1: كروت الخدمات الرئيسية */}
      {!currentGroup && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {enrichedGroups.map(grp => {
            const isSelected = selectedServiceId === grp.id;
            return (
              <div
                key={grp._key}
                className={`p-4 rounded-2xl border-2 transition flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#7a1c24] text-white border-[#7a1c24] shadow'
                    : 'bg-white hover:border-[#7a1c24] border-gray-200 text-gray-900 shadow-2xs'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveGroupKey(grp._key);
                    setActiveYearName(null);
                    setActiveClassId(null);
                    if (onSelectService) onSelectService(grp);
                  }}
                  className="text-right flex items-start justify-between gap-2 w-full cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{grp.icon || (grp.has_classes !== false ? '🏫' : '🕊️')}</span>
                      <strong className="text-sm font-black">{grp.group_name}</strong>
                    </div>
                    <p className={`text-[11px] font-bold ${isSelected ? 'text-amber-100' : 'text-gray-500'}`}>
                      {grp.has_classes === false
                        ? 'اجتماع عام بدون فصول'
                        : grp.hasYears
                          ? `${grp.years.length} سنوات / مراحل (اضغط للفتح)`
                          : grp.directClasses.length > 0
                            ? `${grp.directClasses.length} فصول (اضغط للفتح)`
                            : 'بدون فصول فرعية (اضغط للفتح)'}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-black shrink-0 ${
                      isSelected ? 'bg-white/15 text-white' : 'bg-[#f9ecee] text-[#7a1c24]'
                    }`}
                  >
                    {grp.totalMembers} مخدوم
                  </span>
                </button>

                {isAdmin && (
                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-gray-100 text-[11px] font-bold">
                    {onTransferGroupPriest && (
                      <button
                        type="button"
                        onClick={() => onTransferGroupPriest(grp)}
                        className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-950 flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowLeftRight size={11} /> كاهن
                      </button>
                    )}
                    {onEditGroup && (
                      <button
                        type="button"
                        onClick={() => onEditGroup(grp, grp._index)}
                        className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-amber-100 text-gray-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 size={11} /> تعديل
                      </button>
                    )}
                    {onDeleteGroup && (
                      <button
                        type="button"
                        onClick={() => onDeleteGroup(grp)}
                        className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={11} /> حذف
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* المستوى 2: كروت السنوات الدراسية جوه الخدمة */}
      {currentGroup && !currentYear && (
        <div className="space-y-3">
          {isAdmin && currentGroup.has_classes !== false && onQuickAddYear && (
            <div className="flex flex-wrap gap-2 bg-amber-50/60 p-2.5 rounded-2xl border border-amber-200">
              <input
                placeholder={`إضافة سنة أو مرحلة جديدة داخل (${currentGroup.group_name})...`}
                className="flex-1 min-w-48 p-2 border rounded-xl bg-white text-xs"
                value={newYearName}
                onChange={e => setNewYearName(e.target.value)}
              />
              <button
                type="button"
                onClick={async () => {
                  const ok = await onQuickAddYear(currentGroup, newYearName);
                  if (ok) setNewYearName('');
                }}
                className="px-3.5 py-2 bg-[#7a1c24] text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> إضافة سنة جوه الخدمة
              </button>
            </div>
          )}

          {currentGroup.hasYears ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentGroup.years.map((yr, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border-2 border-gray-200 hover:border-[#7a1c24] bg-white transition flex flex-col justify-between gap-3 shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveYearName(yr.yearName);
                      setActiveClassId(null);
                      if (onSelectYear) onSelectYear(currentGroup, yr);
                    }}
                    className="text-right flex items-start justify-between gap-2 w-full cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Layers size={16} className="text-[#7a1c24]" />
                        <strong className="text-sm font-black text-gray-900">{yr.yearName}</strong>
                      </div>
                      <p className="text-[11px] font-bold text-gray-500">
                        {yr.hasClasses
                          ? `جواها ${yr.classes.length} فصول (اضغط لفتح الفصول)`
                          : 'ملهاش فصول (سنة مباشرة)'}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-950 shrink-0">
                      {yr.memberCount} مخدوم
                    </span>
                  </button>

                  {isAdmin && onQuickAddClassForYear && (
                    <div className="flex justify-end pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => onQuickAddClassForYear(currentGroup, yr)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-950 text-[11px] font-black flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} /> + إضافة فصل للسنة
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-[#fbfaf7] border text-center space-y-2">
              <FolderOpen size={28} className="mx-auto text-[#7a1c24]" />
              <div className="text-sm font-black text-gray-900">
                {currentGroup.group_name} — {currentGroup.has_classes === false ? 'اجتماع عام بدون فصول' : 'لا توجد سنوات دراسية مضافة بعد'}
              </div>
              <p className="text-xs text-gray-500">
                {currentGroup.has_classes === false
                  ? 'هذا الكارت مخصص لاجتماع أو خدمة بدون تقسيم سنين أو فصول.'
                  : 'يمكنك إضافة سنة دراسية من الخانة بالأعلى أو إضافة فصل مباشرة للخدمة.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* المستوى 3: كروت الفصول جوه السنة الدراسية */}
      {currentGroup && currentYear && (
        <div className="space-y-3">
          {isAdmin && onQuickAddClassForYear && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onQuickAddClassForYear(currentGroup, currentYear)}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-200 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> إضافة فصل داخل ({currentYear.yearName})
              </button>
            </div>
          )}

          {currentYear.hasClasses ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentYear.classes.map(cls => {
                const isClsActive = activeClassId === cls.id;
                const clsMembers = countMembersMatching([cls.class_name]);
                return (
                  <div
                    key={cls.id}
                    className={`p-4 rounded-2xl border-2 transition flex flex-col justify-between gap-3 ${
                      isClsActive
                        ? 'bg-[#7a1c24] text-white border-[#7a1c24] shadow'
                        : 'bg-white hover:border-blue-700 border-gray-200 text-gray-900 shadow-2xs'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveClassId(cls.id);
                        if (onSelectClass) onSelectClass(currentGroup, currentYear, cls);
                      }}
                      className="text-right flex items-start justify-between gap-2 w-full cursor-pointer"
                    >
                      <div className="space-y-1">
                        <strong className="text-sm font-black block">{cls.class_name}</strong>
                        <span className={`text-[11px] font-bold block ${isClsActive ? 'text-amber-100' : 'text-gray-500'}`}>
                          {cls.head_servant_name ? `⭐ ${cls.head_servant_name}` : 'فصل دراسي'}
                          {cls.meeting_time ? ` • ⏰ ${cls.meeting_time}` : ''}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-black shrink-0 ${
                          isClsActive ? 'bg-white/15 text-white' : 'bg-blue-50 text-blue-900'
                        }`}
                      >
                        {clsMembers} مخدوم
                      </span>
                    </button>

                    {isAdmin && (
                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-gray-100 text-[11px] font-bold">
                        {onTransferClassPriest && (
                          <button
                            type="button"
                            onClick={() => onTransferClassPriest(cls)}
                            className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-950 flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowLeftRight size={11} /> كاهن
                          </button>
                        )}
                        {onEditClass && (
                          <button
                            type="button"
                            onClick={() => onEditClass(cls, currentGroup, currentYear)}
                            className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-amber-100 text-gray-800 flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 size={11} /> تعديل
                          </button>
                        )}
                        {onDeleteClass && (
                          <button
                            type="button"
                            onClick={() => onDeleteClass(cls.id)}
                            className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={11} /> حذف
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200 text-center space-y-1.5">
              <Users size={26} className="mx-auto text-[#7a1c24]" />
              <div className="text-sm font-black text-gray-900">
                «{currentYear.yearName}» ملهاش فصول فرعية
              </div>
              <p className="text-xs text-gray-600">
                مربوط بها حالياً <strong>{currentYear.memberCount}</strong> مخدوم مباشرة على مستوى السنة.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
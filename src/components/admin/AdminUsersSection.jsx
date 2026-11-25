import { Search, ArrowLeftRight, UserPlus, Users, ShieldCheck, Edit3, Trash2 } from 'lucide-react';
import {
  ROLE_LABELS,
  SERVANT_ROLES,
  getDeaconRankLabel,
  detectGuardianType
} from '../../utils/churchHierarchy';

export default function AdminUsersSection({
  users = [],
  priestsList = [],
  servantsList = [],
  deaconsList = [],
  membersList = [],
  parentsWorkersList = [],
  parentIdsFromMembers = [],
  userSubTab,
  setUserSubTab,
  searchQ,
  setSearchQ,
  isAdmin,
  currentUserId,
  getPriestCoverage,
  onOpenAdd,
  onOpenEdit,
  onOpenSingleTransfer,
  onOpenBulkTransfer,
  onGoToPriestTransfer,
  onGoToPermissions,
  onDeleteUser
}) {
  const getUsersBySubTab = () => {
    if (userSubTab === 'priests') return priestsList;
    if (userSubTab === 'servants') return servantsList;
    if (userSubTab === 'deacons') return deaconsList;
    if (userSubTab === 'members') return membersList;
    if (userSubTab === 'parents') return parentsWorkersList;
    if (userSubTab === 'all') return users;
    return searchQ.trim() ? users : [];
  };

  const shouldShowUsersList = Boolean(userSubTab) || searchQ.trim().length > 0;
  const filteredUsers = getUsersBySubTab().filter(u =>
    ((u.full_name || '') + ' ' + (u.username || '') + ' ' + (u.phone || '') + ' ' + (u.sector || '') + ' ' + (u.assigned_class || '') + ' ' + (u.detailed_stage || '')).toLowerCase().includes(searchQ.toLowerCase())
  );

  const addButtonLabel =
    userSubTab === 'priests' ? 'إضافة كاهن' :
    userSubTab === 'servants' ? 'إضافة خادم / أمين خدمة' :
    userSubTab === 'deacons' ? 'إضافة شماس' :
    userSubTab === 'members' ? 'إضافة مخدوم' :
    userSubTab === 'parents' ? 'إضافة ولي أمر / عامل' : 'إضافة شخص جديد';

  return (
    <div className="space-y-3">
      <div className="bg-white p-2.5 rounded-2xl border flex items-center gap-1.5 overflow-x-auto text-xs font-bold shadow-2xs">
        <button onClick={() => setUserSubTab('priests')} className={`px-3 py-1.5 rounded-xl shrink-0 cursor-pointer ${userSubTab === 'priests' ? 'bg-[#7a1c24] text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>✝ الكهنة ({priestsList.length})</button>
        <button onClick={() => setUserSubTab('servants')} className={`px-3 py-1.5 rounded-xl shrink-0 cursor-pointer ${userSubTab === 'servants' ? 'bg-[#7a1c24] text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>📖 الخدام وأمناء الخدمة ({servantsList.length})</button>
        <button onClick={() => setUserSubTab('deacons')} className={`px-3 py-1.5 rounded-xl shrink-0 cursor-pointer ${userSubTab === 'deacons' ? 'bg-purple-800 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>🕯️ الشمامسة ({deaconsList.length})</button>
        <button onClick={() => setUserSubTab('members')} className={`px-3 py-1.5 rounded-xl shrink-0 cursor-pointer ${userSubTab === 'members' ? 'bg-[#7a1c24] text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>🎓 المخدومون ({membersList.length})</button>
        <button onClick={() => setUserSubTab('parents')} className={`px-3 py-1.5 rounded-xl shrink-0 cursor-pointer ${userSubTab === 'parents' ? 'bg-[#7a1c24] text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>👨‍👩‍👦 أولياء الأمور والشعب ({parentsWorkersList.length})</button>
        <button onClick={() => setUserSubTab('all')} className={`px-3 py-1.5 rounded-xl shrink-0 cursor-pointer ${userSubTab === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>📋 عرض الكل ({users.length})</button>
      </div>

      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="relative flex-1 min-w-55 text-xs">
          <Search size={15} className="absolute right-3 top-2.5 text-gray-400" />
          <input type="text" placeholder="بحث بالاسم، اليوزر، التليفون، الفصل، أو القطاع..." className="w-full pr-9 pl-3 py-2 bg-white border rounded-xl outline-none focus:border-[#7a1c24]" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onOpenBulkTransfer('servant')}
              className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-black rounded-xl flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <ArrowLeftRight size={14} /> نقل جماعي للخدام
            </button>
            <button
              type="button"
              onClick={() => onOpenBulkTransfer('member')}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-950 border border-blue-300 text-xs font-black rounded-xl flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <ArrowLeftRight size={14} /> نقل جماعي للمخدومين
            </button>
            <button onClick={onOpenAdd} className="px-3.5 py-2 bg-[#7a1c24] text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow cursor-pointer">
              <UserPlus size={15} /> {addButtonLabel}
            </button>
          </div>
        )}
      </div>

      {!shouldShowUsersList ? (
        <div className="bg-white p-10 rounded-3xl border text-center space-y-2">
          <Users size={34} className="mx-auto text-[#7a1c24]/70" />
          <strong className="block text-sm text-gray-800">اختر الفئة المطلوبة من الأزرار بالأعلى أو اكتب في شريط البحث</strong>
          <p className="text-xs text-gray-500">لا يتم عرض كل الحسابات دفعة واحدة للحفاظ على سرعة وخصوصية لوحة الإدارة.</p>
        </div>
      ) : (
        <div className="max-h-[54vh] overflow-y-auto pr-1 grid gap-2.5">
          {filteredUsers.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border text-center text-xs text-gray-400">لا توجد نتائج مطابقة</div>
          ) : (
            filteredUsers.map(u => {
              const isParentOfChild = parentIdsFromMembers.includes(u.id);
              const guardianKind = detectGuardianType(u);
              const canTransferUser = SERVANT_ROLES.includes(u.role) || u.role === 'member';
              const priestCoverage = u.role === 'priest' && getPriestCoverage ? getPriestCoverage(u.id) : null;
              return (
                <div key={u.id} className="bg-white p-3.5 rounded-2xl border text-xs flex flex-wrap justify-between items-center gap-2.5 shadow-2xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong className="text-sm text-gray-950">{u.full_name}</strong>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-[#7a1c24]">{u.permissions?.custom_role_label || ROLE_LABELS[u.role] || u.role}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-50 text-pink-900">
                        {u.gender === 'أنثى' ? '♀️ أنثى' : '♂️ ذكر'}
                      </span>
                      {u.role === 'parent' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-950">
                          {guardianKind === 'mother' ? '👩 الأم' : '👨 الأب'}
                        </span>
                      )}
                      {isParentOfChild && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-950">👨‍👦 ولي أمر مسجل</span>}
                      {u.role === 'priest' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">{u.priest_degree} {u.ordination_date ? `(سيامة: ${u.ordination_date})` : ''}</span>}

                      {u.is_deacon && (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-200">
                          🕯️ شماس: {getDeaconRankLabel(u.deacon_rank)}
                        </span>
                      )}

                      {u.detailed_stage && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-900">{SERVANT_ROLES.includes(u.role) ? 'خادم' : 'مرحلة'}: {u.detailed_stage}</span>}
                      {u.permissions?.service_gender_scope && SERVANT_ROLES.includes(u.role) && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-900">نطاق: {u.permissions.service_gender_scope}</span>}
                      {u.assigned_class && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800">فصل: {u.assigned_class}</span>}
                      {u.permissions?.manage_edu_center && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-900">🎓 مدير مركز تعليمي</span>}
                      {u.permissions?.manage_trips && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900">🚌 صلاحية رحلات</span>}
                      {u.permissions?.manage_joseph && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-900">🕊️ لجنة يوسف الرامي</span>}
                      {u.permissions?.can_edit_members && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900">✏️ يقدر يعدل</span>}
                    </div>

                    {priestCoverage && (
                      <div className="text-[11px] bg-amber-50/70 border border-amber-200 px-2.5 py-1.5 rounded-xl text-amber-950 space-y-0.5">
                        <div>
                          <strong>✝ خدمات ماسكها ({priestCoverage.assignedServices.length}):</strong>{' '}
                          {priestCoverage.assignedServices.length > 0 ? priestCoverage.assignedServices.join('، ') : 'غير محدد بعد'}
                        </div>
                        <div>
                          <strong>⏳ خدمات غير ماسكها ({priestCoverage.unassignedServices.length}):</strong>{' '}
                          {priestCoverage.unassignedServices.length > 0 ? priestCoverage.unassignedServices.join('، ') : 'ماسك كل الخدمات'}
                        </div>
                      </div>
                    )}

                    <p className="text-gray-500">
                      يوزر: <code className="text-red-700 font-bold bg-red-50 px-1 rounded">{u.username}</code>
                      {u.phone && ` • 📞 ${u.phone}`}
                      {u.sector && ` • 📍 ${u.sector}`}
                      {u.church_job && ` • 🛠️ ${u.church_job}`}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {u.role === 'priest' && (
                        <button
                          type="button"
                          onClick={() => onGoToPriestTransfer(u.id)}
                          className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeftRight size={12} /> نقل / تعديل الكاهن
                        </button>
                      )}
                      {canTransferUser && (
                        <button
                          type="button"
                          onClick={() => onOpenSingleTransfer(u)}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeftRight size={12} /> نقل
                        </button>
                      )}
                      <button
                        onClick={() => onGoToPermissions(u.id)}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <ShieldCheck size={12} /> الصلاحيات
                      </button>
                      <button onClick={() => onOpenEdit(u)} className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold flex items-center gap-1 cursor-pointer"><Edit3 size={12} /> تعديل</button>
                      {u.id !== currentUserId && (
                        <button onClick={() => onDeleteUser(u.id)} className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold flex items-center gap-1 cursor-pointer"><Trash2 size={12} /> حذف</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
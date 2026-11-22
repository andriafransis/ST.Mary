import { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  FileSpreadsheet, Printer, Download, Search, Users,
  UserCheck, AlertCircle, UserMinus, HeartHandshake, Sparkles
} from 'lucide-react';

const ROLE_LABELS = {
  admin: 'سوبر أدمن',
  priest: 'أب كاهن',
  head_servant: 'أمين الخدمة',
  vice_head_servant: 'مساعد أمين الخدمة',
  servant: 'خادم مرحلة',
  meeting_servant: 'خادم اجتماع',
  mercy_servant: 'خادم إخوة رب',
  member: 'مخدوم (رعية)',
  parent: 'ولي أمر',
  worker: 'عامل / فراش كنيسة'
};

const STATUS_META = {
  active: {
    label: 'نشط / موجود',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    selectClass: 'bg-emerald-50 text-emerald-950 border-emerald-300'
  },
  needs_visitation: {
    label: 'محتاج افتقاد',
    badgeClass: 'bg-amber-100 text-amber-950 border-amber-300',
    selectClass: 'bg-amber-50 text-amber-950 border-amber-300'
  },
  inactive: {
    label: 'منقطع / غياب متكرر',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
    selectClass: 'bg-rose-50 text-rose-950 border-rose-300'
  },
  transferred: {
    label: 'منتقل خارج الكنيسة',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-300',
    selectClass: 'bg-sky-50 text-sky-950 border-sky-300'
  },
  departed: {
    label: 'منتقل للسماء (ذكرى ترحيم)',
    badgeClass: 'bg-slate-800 text-amber-200 border-slate-700',
    selectClass: 'bg-slate-800 text-amber-200 border-slate-700'
  }
};

const ALLOWED_SHEET_ROLES = new Set(['admin', 'priest', 'head_servant']);

export function canExtractMasterSheet(user) {
  if (!user) return false;
  if (user.permissions?.screens?.master_sheet?.view === false) return false;
  if (user.permissions?.can_extract_master_sheet === true) return true;
  return ALLOWED_SHEET_ROLES.has(user.role);
}

export default function MasterCongregationSheet({
  users = [],
  currentUser = null,
  churchName = 'كنيسة السيدة العذراء مريم بالمطرية',
  onUpdateUser,
  onRefresh
}) {
  const canAccess = canExtractMasterSheet(currentUser);
  const canEditStatus = ['admin', 'priest', 'head_servant'].includes(currentUser?.role) ||
    Boolean(currentUser?.permissions?.can_edit_members);

  const [roleFilter, setRoleFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [savingRowId, setSavingRowId] = useState(null);
  const [sheetTitleNote, setSheetTitleNote] = useState('كشف افتقاد ومتابعة الرعية والخدام');

  const todayISO = new Date().toISOString().split('T')[0];

  const sequencedUsers = useMemo(() => {
    const sorted = [...users].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });

    return sorted.map((u, idx) => ({
      ...u,
      serialNo: idx + 1,
      statusKey: STATUS_META[u.member_status] ? u.member_status : 'active'
    }));
  }, [users]);

  const stageOptions = useMemo(() => {
    const set = new Set();
    sequencedUsers.forEach(u => {
      const val = (u.detailed_stage || u.service_stage || '').trim();
      if (val) set.add(val);
    });
    return Array.from(set);
  }, [sequencedUsers]);

  const sectorOptions = useMemo(() => {
    const set = new Set();
    sequencedUsers.forEach(u => {
      const val = (u.sector || '').trim();
      if (val) set.add(val);
    });
    return Array.from(set);
  }, [sequencedUsers]);

  const stats = useMemo(() => {
    const total = sequencedUsers.length;
    const servants = sequencedUsers.filter(u =>
      ['head_servant', 'vice_head_servant', 'servant', 'meeting_servant', 'mercy_servant'].includes(u.role)
    ).length;
    const members = sequencedUsers.filter(u => u.role === 'member').length;
    const needsVisitation = sequencedUsers.filter(u => u.statusKey === 'needs_visitation').length;
    const inactive = sequencedUsers.filter(u => u.statusKey === 'inactive').length;
    const departed = sequencedUsers.filter(u => u.statusKey === 'departed').length;
    return { total, servants, members, needsVisitation, inactive, departed };
  }, [sequencedUsers]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sequencedUsers.filter(row => {
      if (roleFilter !== 'all') {
        if (roleFilter === 'servants') {
          if (!['head_servant', 'vice_head_servant', 'servant', 'meeting_servant', 'mercy_servant'].includes(row.role)) {
            return false;
          }
        } else if (roleFilter === 'deacons') {
          if (!row.is_deacon) return false;
        } else if (row.role !== roleFilter) {
          return false;
        }
      }

      if (stageFilter !== 'all') {
        const st = (row.detailed_stage || row.service_stage || '').trim();
        if (st !== stageFilter) return false;
      }

      if (sectorFilter !== 'all') {
        const sec = (row.sector || '').trim();
        if (sec !== sectorFilter) return false;
      }

      if (statusFilter !== 'all' && row.statusKey !== statusFilter) {
        return false;
      }

      if (q) {
        const hay = [
          row.serialNo,
          row.full_name || '',
          row.phone || '',
          row.address || '',
          row.sector || '',
          row.detailed_stage || row.service_stage || '',
          row.assigned_class || '',
          ROLE_LABELS[row.role] || row.role || ''
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [sequencedUsers, roleFilter, stageFilter, sectorFilter, statusFilter, searchQuery]);

  if (!canAccess) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-900 p-6 rounded-3xl text-xs font-bold text-center">
        🔒 هذا الشيت متاح فقط للسوبر أدمن، الأب الكاهن، وأمين الخدمة.
      </div>
    );
  }

  const handleStatusChange = async (row, nextStatus) => {
    if (!canEditStatus) return;
    setSavingRowId(row.id);
    try {
      if (onUpdateUser) {
        await onUpdateUser({ ...row, member_status: nextStatus });
      } else {
        const { error } = await supabase
          .from('church_users')
          .update({ member_status: nextStatus })
          .eq('id', row.id);
        if (error) {
          alert('تعذر تحديث الحالة: ' + error.message);
          return;
        }
        if (onRefresh) await onRefresh();
      }
    } finally {
      setSavingRowId(null);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'مسلسل ثابت',
      'الاسم الرباعي',
      'الدور / الصفة',
      'المرحلة / الرعية',
      'الفصل',
      'القطاع',
      'رقم الهاتف',
      'العنوان',
      'حالة الفرد (افتقاد / ترحيم)',
      'تاريخ الإضافة'
    ];

    const lines = filteredRows.map(r => [
      r.serialNo,
      r.full_name || '',
      r.permissions?.custom_role_label || ROLE_LABELS[r.role] || r.role || '',
      r.detailed_stage || r.service_stage || '',
      r.assigned_class || '',
      r.sector || '',
      r.phone || '',
      r.address || '',
      STATUS_META[r.statusKey]?.label || r.statusKey,
      r.created_at ? new Date(r.created_at).toLocaleDateString('ar-EG') : ''
    ]);

    const csv = '\uFEFF' + [headers, ...lines]
      .map(cols => cols.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `master-congregation-sheet-${todayISO}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 text-xs" dir="rtl">
      {/* ترويسة احترافية للشيت */}
      <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-wrap justify-between items-start gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#7a1c24] text-amber-200 flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-[#7a1c24]">
                  شيت التسلسل الشامل والافتقاد والترحيم — {churchName}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 text-[10px] font-black">
                  أدمن • أب كاهن • أمين خدمة
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                ترقيم تسلسلي ثابت من لحظة إضافة الفرد للنظام وحتى متابعة الافتقاد أو تسجيل ذكرى الترحيم • تاريخ اليوم: <strong>{todayISO}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black flex items-center gap-1.5 shadow-xs cursor-pointer transition"
            >
              <Download size={15} /> تصدير شيت Excel / CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center gap-1.5 shadow-xs cursor-pointer transition"
            >
              <Printer size={15} /> طباعة الكشف الرسمي
            </button>
          </div>
        </div>

        {/* بطاقات إحصائية سريعة */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="bg-[#fbfaf7] border border-gray-200 rounded-2xl p-3">
            <div className="flex items-center justify-between text-gray-500 font-bold">
              <span>إجمالي المسلسل</span>
              <Users size={15} className="text-[#7a1c24]" />
            </div>
            <strong className="text-lg font-black text-gray-950 block mt-1">{stats.total}</strong>
          </div>

          <div className="bg-[#fbfaf7] border border-gray-200 rounded-2xl p-3">
            <div className="flex items-center justify-between text-gray-500 font-bold">
              <span>الخدام والأمناء</span>
              <UserCheck size={15} className="text-blue-700" />
            </div>
            <strong className="text-lg font-black text-blue-900 block mt-1">{stats.servants}</strong>
          </div>

          <div className="bg-[#fbfaf7] border border-gray-200 rounded-2xl p-3">
            <div className="flex items-center justify-between text-gray-500 font-bold">
              <span>المخدومون / الرعية</span>
              <HeartHandshake size={15} className="text-emerald-700" />
            </div>
            <strong className="text-lg font-black text-emerald-900 block mt-1">{stats.members}</strong>
          </div>

          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3">
            <div className="flex items-center justify-between text-amber-900 font-bold">
              <span>محتاج افتقاد</span>
              <AlertCircle size={15} className="text-amber-700" />
            </div>
            <strong className="text-lg font-black text-amber-950 block mt-1">{stats.needsVisitation}</strong>
          </div>

          <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3">
            <div className="flex items-center justify-between text-rose-900 font-bold">
              <span>منقطع / غياب</span>
              <UserMinus size={15} className="text-rose-700" />
            </div>
            <strong className="text-lg font-black text-rose-950 block mt-1">{stats.inactive}</strong>
          </div>

          <div className="bg-slate-100 border border-slate-300 rounded-2xl p-3">
            <div className="flex items-center justify-between text-slate-800 font-bold">
              <span>ذكرى ترحيم</span>
              <Sparkles size={15} className="text-slate-700" />
            </div>
            <strong className="text-lg font-black text-slate-950 block mt-1">{stats.departed}</strong>
          </div>
        </div>

        {/* عنوان الكشف المطبوع + الفلاتر */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2.5 print:hidden">
          <div className="relative lg:col-span-2">
            <Search size={15} className="absolute right-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="بحث بالرقم التسلسلي (#)، الاسم الرباعي، التليفون، العنوان..."
              className="w-full pr-9 pl-3 py-2 bg-[#fbfaf7] border border-gray-200 rounded-xl outline-none focus:border-[#7a1c24]"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="p-2 bg-[#fbfaf7] border border-gray-200 rounded-xl font-bold outline-none focus:border-[#7a1c24]"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
          >
            <option value="all">كل الفئات والأدوار</option>
            <option value="servants">الخدام وأمناء الخدمة</option>
            <option value="member">المخدومون (رعية)</option>
            <option value="parent">أولياء الأمور</option>
            <option value="priest">الآباء الكهنة</option>
            <option value="deacons">الشمامسة</option>
            <option value="worker">عامل / فراش كنيسة</option>
          </select>

          <select
            className="p-2 bg-[#fbfaf7] border border-gray-200 rounded-xl font-bold outline-none focus:border-[#7a1c24]"
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
          >
            <option value="all">كل المراحل / الخدمات</option>
            {stageOptions.map(st => <option key={st} value={st}>{st}</option>)}
          </select>

          <select
            className="p-2 bg-[#fbfaf7] border border-gray-200 rounded-xl font-bold outline-none focus:border-[#7a1c24]"
            value={sectorFilter}
            onChange={e => setSectorFilter(e.target.value)}
          >
            <option value="all">كل القطاعات / المناطق</option>
            {sectorOptions.map(sec => <option key={sec} value={sec}>{sec}</option>)}
          </select>

          <select
            className="p-2 bg-[#fbfaf7] border border-gray-200 rounded-xl font-bold outline-none focus:border-[#7a1c24]"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">كل الحالات (افتقاد / ترحيم)</option>
            <option value="active">نشط / موجود</option>
            <option value="needs_visitation">محتاج افتقاد</option>
            <option value="inactive">منقطع / غياب متكرر</option>
            <option value="transferred">منتقل خارج الكنيسة</option>
            <option value="departed">منتقل للسماء (ذكرى ترحيم)</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600 pt-1">
          <div>
            عنوان الكشف عند الطباعة:
            <input
              type="text"
              value={sheetTitleNote}
              onChange={e => setSheetTitleNote(e.target.value)}
              className="mr-2 px-2.5 py-1 bg-[#fbfaf7] border border-gray-200 rounded-lg font-bold text-gray-900 print:border-none print:bg-transparent"
            />
          </div>
          <div>
            عدد الصفوف الظاهرة: <strong className="text-[#7a1c24]">{filteredRows.length}</strong> من أصل <strong>{sequencedUsers.length}</strong>
          </div>
        </div>
      </div>

      {/* جدول التسلسل الاحترافي */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="hidden print:block p-4 border-b text-center">
          <h3 className="text-base font-black text-[#7a1c24]">{sheetTitleNote} — {churchName}</h3>
          <p className="text-[11px] text-gray-600">تاريخ الإصدار: {todayISO} • إجمالي الصفوف: {filteredRows.length}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-[#7a1c24] text-white font-black">
                <th className="p-3 w-20">مسلسل #</th>
                <th className="p-3">الاسم الرباعي</th>
                <th className="p-3">الصفة / الدور</th>
                <th className="p-3">المرحلة / الفصل</th>
                <th className="p-3">القطاع والتليفون</th>
                <th className="p-3">الحالة (افتقاد / ترحيم)</th>
                <th className="p-3">تاريخ الإضافة</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400 font-bold">
                    لا توجد بيانات مطابقة لمعايير البحث والفلترة الحالية.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => {
                  const stMeta = STATUS_META[row.statusKey] || STATUS_META.active;
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-gray-100 last:border-b-0 ${
                        index % 2 === 1 ? 'bg-[#fbfaf7]/60' : 'bg-white'
                      } hover:bg-amber-50/40 transition`}
                    >
                      <td className="p-3 font-black text-[#7a1c24] whitespace-nowrap">
                        #{row.serialNo}
                      </td>
                      <td className="p-3 font-black text-gray-950">
                        {row.full_name}
                      </td>
                      <td className="p-3 font-bold text-gray-700 whitespace-nowrap">
                        {row.permissions?.custom_role_label || ROLE_LABELS[row.role] || row.role}
                        {row.is_deacon && (
                          <span className="mr-1.5 px-2 py-0.5 rounded-lg bg-purple-100 text-purple-900 text-[10px] font-black">
                            شماس
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-gray-700">
                        <span className="font-bold">{row.detailed_stage || row.service_stage || '—'}</span>
                        {row.assigned_class && (
                          <span className="block text-[11px] text-gray-500">فصل: {row.assigned_class}</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-700">
                        <span>{row.sector || '—'}</span>
                        {row.phone && (
                          <span className="block text-[11px] text-gray-500 font-mono" dir="ltr">
                            {row.phone}
                          </span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {canEditStatus ? (
                          <select
                            disabled={savingRowId === row.id}
                            value={row.statusKey}
                            onChange={e => handleStatusChange(row, e.target.value)}
                            className={`px-2.5 py-1.5 rounded-xl border font-black text-[11px] outline-none cursor-pointer ${stMeta.selectClass}`}
                          >
                            <option value="active">نشط / موجود</option>
                            <option value="needs_visitation">محتاج افتقاد</option>
                            <option value="inactive">منقطع / غياب متكرر</option>
                            <option value="transferred">منتقل خارج الكنيسة</option>
                            <option value="departed">منتقل للسماء (ذكرى ترحيم)</option>
                          </select>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-xl border font-black text-[11px] ${stMeta.badgeClass}`}>
                            {stMeta.label}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-gray-500 whitespace-nowrap">
                        {row.created_at ? new Date(row.created_at).toLocaleDateString('ar-EG') : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
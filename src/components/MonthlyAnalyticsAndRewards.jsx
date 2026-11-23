import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, Trophy, AlertTriangle, Clock, Award, Plus, Trash2,
  Download, Calendar, Sparkles, CheckCircle2, Eye, EyeOff, Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const getCurrentYearMonth = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const DEFAULT_TIERS = [
  { min_percent: 90, discount_percent: 50, label: 'خصم 50% على الرحلة (نصف الثمن)' },
  { min_percent: 75, discount_percent: 25, label: 'خصم 25% على الرحلة' },
  { min_percent: 50, discount_percent: 10, label: 'خصم 10% تشجيعي' }
];

const isElevatedUser = (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const combined = `${user.role || ''} ${user.job_title || ''} ${user.service_role || ''}`.toLowerCase();
  return (
    combined.includes('priest') ||
    combined.includes('father') ||
    combined.includes('أبونا') ||
    combined.includes('ابونا') ||
    combined.includes('كاهن')
  );
};

const isGroupLeaderUser = (user) => {
  if (!user) return false;
  if (isElevatedUser(user)) return true;
  const combined = `${user.role || ''} ${user.job_title || ''} ${user.service_role || ''}`.toLowerCase();
  return (
    combined.includes('head') ||
    combined.includes('leader') ||
    combined.includes('أمين') ||
    combined.includes('امين') ||
    combined.includes('مسؤول خدمة') ||
    user.permissions?.can_view_group === true ||
    user.permissions?.can_extract_master_sheet === true
  );
};

export default function MonthlyAnalyticsAndRewards({
  servant,
  allMembers = [],
  scopedMembers = [],
  activities = [],
  availableServices = [],
  selectedScope = '',
  hasClassesInScope = false,
  boundClasses = []
}) {
  const elevated = isElevatedUser(servant);
  const groupLeader = isGroupLeaderUser(servant);

  // تحديد النطاق المسموح للخادم فعلياً:
  // - أدمن / أبونا / أمين خدمة: يرى الخدمة المختارة بالكامل
  // - خادم في خدمة لها فصول: يرى فصوله/مخدوميه فقط
  // - خادم في خدمة بدون فصول: يرى المجموعة/الخدمة كلها
  const allowedServicesList = useMemo(() => {
    if (elevated || groupLeader) return availableServices;
    const extra = Array.isArray(servant?.permissions?.extra_services) ? servant.permissions.extra_services : [];
    const stageStr = `${servant?.service_stage || ''} ${servant?.detailed_stage || ''} ${servant?.assigned_class || ''}`;
    const matched = availableServices.filter(
      srv => stageStr.includes(srv) || extra.includes(srv) || srv === selectedScope
    );
    return matched.length > 0 ? matched : (selectedScope ? [selectedScope] : availableServices);
  }, [elevated, groupLeader, availableServices, servant, selectedScope]);

  const [reportService, setReportService] = useState(
    selectedScope || allowedServicesList[0] || availableServices[0] || ''
  );

  useEffect(() => {
    if (selectedScope && allowedServicesList.includes(selectedScope)) {
      setReportService(selectedScope);
    } else if (allowedServicesList.length > 0 && !allowedServicesList.includes(reportService)) {
      setReportService(allowedServicesList[0]);
    }
  }, [selectedScope, allowedServicesList]);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());
  const [sortMode, setSortMode] = useState('most_attended'); // 'most_attended' | 'most_absent' | 'most_late'
  const [subView, setSubView] = useState('sheet'); // 'sheet' | 'campaigns'

  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignDesc, setCampaignDesc] = useState('');
  const [campaignEndDate, setCampaignEndDate] = useState('');
  const [tiers, setTiers] = useState(DEFAULT_TIERS);

  const fetchCampaigns = async () => {
    if (!supabase || typeof supabase.from !== 'function') return;
    setLoadingCampaigns(true);
    try {
      const { data, error } = await supabase
        .from('reward_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        setCampaigns(data);
      }
    } catch {
      // تجاهل في حال عدم اتصال القاعدة
    } finally {
      setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // المخدومون المسموح للخادم الحالي رؤيتهم داخل التقرير
  const authorizedMembersPool = useMemo(() => {
    // 1. لو الخادم على خدمة مفتوحة محددة ومطابقة للخدمة المختارة للتقرير
    const basePool =
      reportService === selectedScope && scopedMembers.length > 0
        ? scopedMembers
        : allMembers.filter(m => {
            const txt = `${m.assigned_class || ''} ${m.detailed_stage || ''} ${m.service_stage || ''}`;
            return !reportService || txt.includes(reportService);
          });

    // 2. أدمن أو أبونا أو أمين خدمة: يشوف كل مخدومي الخدمة المحددة
    if (elevated || groupLeader) {
      return basePool;
    }

    // 3. لو الخدمة لها فصول داخلية: خادم الفصل يرى مخدومي فصله/فصوله المربوطة فقط
    if (hasClassesInScope && Array.isArray(boundClasses) && boundClasses.length > 0) {
      const myClassMembers = basePool.filter(m => {
        const mCls = (m.assigned_class || '').trim();
        return boundClasses.some(c => mCls === c || `${m.detailed_stage || ''} ${m.service_stage || ''}`.includes(c));
      });
      return myClassMembers;
    }

    // 4. لو الخدمة ليس لها فصول داخلية: الخادم يرى المجموعة/الخدمة كلها
    return basePool;
  }, [reportService, selectedScope, scopedMembers, allMembers, elevated, groupLeader, hasClassesInScope, boundClasses]);

  const accessScopeDescription = useMemo(() => {
    if (elevated) return 'صلاحية كاملة (أدمن / أبونا) — كل مخدومي الخدمة';
    if (groupLeader) return 'أمين خدمة — جميع فصول ومخدومي الخدمة';
    if (hasClassesInScope) {
      return boundClasses.length > 0
        ? `خادم فصل (${boundClasses.join('، ')}) — مخدومو فصلك فقط`
        : 'خادم فصل — مخدومو فصلك فقط';
    }
    return 'خدمة بدون فصول — جميع مخدومي المجموعة/الخدمة';
  }, [elevated, groupLeader, hasClassesInScope, boundClasses]);

  const activeCampaign = useMemo(
    () =>
      campaigns.find(
        c => c.is_active && (c.target_scope === reportService || c.target_scope === 'الكل')
      ) || null,
    [campaigns, reportService]
  );

  const monthlyStats = useMemo(() => {
    const monthActs = activities.filter(a => String(a.activity_date || '').startsWith(selectedMonth));

    const poolIds = new Set(authorizedMembersPool.map(m => m.id));
    const uniqueDatesInPool = new Set(
      monthActs.filter(a => poolIds.has(a.member_id)).map(a => a.activity_date)
    );
    const totalMeetingsInMonth = Math.max(uniqueDatesInPool.size, 1);

    const rows = authorizedMembersPool.map(m => {
      const mActs = monthActs.filter(a => a.member_id === m.id);
      const presentCount = mActs.filter(a => Boolean(a.attended)).length;
      const absentCount = mActs.filter(a => !a.attended && a.status_code !== 'excused').length;
      const excusedCount = mActs.filter(a => a.status_code === 'excused').length;
      const lateCount = mActs.filter(
        a => a.status_code === 'late' || Number(a.delay_minutes) > 0
      ).length;
      const earlyLeaveCount = mActs.filter(
        a => a.status_code === 'early_leave' || Number(a.early_leave_minutes) > 0
      ).length;

      const denominator = Math.max(totalMeetingsInMonth, mActs.length, 1);
      const attendancePercent = Math.min(100, Math.round((presentCount / denominator) * 100));

      let matchedTier = null;
      if (activeCampaign && Array.isArray(activeCampaign.tiers)) {
        const sortedTiers = [...activeCampaign.tiers].sort(
          (a, b) => Number(b.min_percent) - Number(a.min_percent)
        );
        matchedTier = sortedTiers.find(t => attendancePercent >= Number(t.min_percent)) || null;
      }

      return {
        member: m,
        presentCount,
        absentCount,
        excusedCount,
        lateCount,
        earlyLeaveCount,
        totalRecorded: mActs.length,
        attendancePercent,
        matchedTier
      };
    });

    if (sortMode === 'most_attended') {
      return rows.sort((a, b) => b.attendancePercent - a.attendancePercent || b.presentCount - a.presentCount);
    }
    if (sortMode === 'most_absent') {
      return rows.sort((a, b) => b.absentCount - a.absentCount || a.attendancePercent - b.attendancePercent);
    }
    return rows.sort((a, b) => (b.lateCount + b.earlyLeaveCount) - (a.lateCount + a.earlyLeaveCount));
  }, [authorizedMembersPool, activities, selectedMonth, sortMode, activeCampaign]);

  const topAttendee = monthlyStats.length > 0
    ? [...monthlyStats].sort((a, b) => b.attendancePercent - a.attendancePercent || b.presentCount - a.presentCount)[0]
    : null;

  const topAbsentee = monthlyStats.length > 0
    ? [...monthlyStats].sort((a, b) => b.absentCount - a.absentCount)[0]
    : null;

  const topLate = monthlyStats.length > 0
    ? [...monthlyStats].sort((a, b) => (b.lateCount + b.earlyLeaveCount) - (a.lateCount + a.earlyLeaveCount))[0]
    : null;

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!campaignTitle.trim() || !campaignEndDate || !reportService) return;

    const cleanTiers = tiers
      .filter(t => Number(t.min_percent) > 0 && Number(t.discount_percent) > 0)
      .sort((a, b) => Number(b.min_percent) - Number(a.min_percent));

    if (supabase && typeof supabase.from === 'function') {
      const { error } = await supabase.from('reward_campaigns').insert({
        title: campaignTitle.trim(),
        description: campaignDesc.trim() || null,
        target_scope: reportService,
        end_date: campaignEndDate,
        tiers: cleanTiers,
        is_active: true,
        created_by: servant?.full_name || servant?.username || 'servant'
      });

      if (error) {
        alert('تعذر حفظ العرض، تأكد من تشغيل سكربت الداتابيز أولاً: ' + error.message);
        return;
      }
      await fetchCampaigns();
    }

    setCampaignTitle('');
    setCampaignDesc('');
    setCampaignEndDate('');
    setShowNewCampaign(false);
  };

  const handleToggleCampaignStatus = async (camp) => {
    if (!supabase || typeof supabase.from !== 'function') return;
    await supabase
      .from('reward_campaigns')
      .update({ is_active: !camp.is_active })
      .eq('id', camp.id);
    fetchCampaigns();
  };

  const handleDeleteCampaign = async (id) => {
    if (!window.confirm('هل تريد حذف هذا العرض؟')) return;
    if (!supabase || typeof supabase.from !== 'function') return;
    await supabase.from('reward_campaigns').delete().eq('id', id);
    fetchCampaigns();
  };

  const handleGrantMonthlyDiscount = async (row) => {
    if (!row?.matchedTier) return;
    if (!supabase || typeof supabase.from !== 'function') return;

    const { error } = await supabase.from('member_rewards').insert({
      member_id: row.member.id,
      campaign_id: activeCampaign?.id || null,
      reward_type: 'خصم رحلة / مواظبة',
      reward_title: `${activeCampaign?.title || 'مكافأة الخدمة'} — ${row.matchedTier.label}`,
      attendance_streak: row.presentCount,
      attendance_percentage: row.attendancePercent,
      discount_percent: Number(row.matchedTier.discount_percent),
      target_month: selectedMonth,
      granted_by: servant?.full_name || servant?.username || 'servant',
      notes: `نسبة حضور ${row.attendancePercent}% في (${reportService}) لشهر ${selectedMonth}`
    });

    if (error) {
      alert('حدث خطأ أثناء اعتماد الخصم: ' + error.message);
    } else {
      alert(`✅ تم اعتماد (${row.matchedTier.label}) للمخدوم ${row.member.full_name} بنجاح!`);
    }
  };

  const exportCsvSheet = () => {
    const headers = ['الترتيب', 'الاسم', 'الفصل', 'نسبة الحضور %', 'حضور', 'غياب', 'معتذر', 'تأخير', 'انصراف مبكر', 'الخصم/المكافأة المستحقة'];
    const lines = monthlyStats.map((r, i) => [
      i + 1,
      `"${r.member.full_name || ''}"`,
      `"${r.member.assigned_class || r.member.detailed_stage || ''}"`,
      `${r.attendancePercent}%`,
      r.presentCount,
      r.absentCount,
      r.excusedCount,
      r.lateCount,
      r.earlyLeaveCount,
      `"${r.matchedTier ? r.matchedTier.label : 'لا يوجد بعد'}"`
    ].join(','));

    const csvContent = '\uFEFF' + [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_${reportService}_${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const serviceCampaigns = campaigns.filter(c => c.target_scope === reportService || c.target_scope === 'الكل');

  return (
    <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm space-y-4 text-xs" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div>
          <h3 className="text-base font-black text-gray-900 flex items-center gap-1.5">
            <BarChart3 size={18} className="text-[#7a1c24]" /> تقرير الخدمة الخاص: ({reportService})
          </h3>
          <p className="text-[11px] text-gray-500 font-bold mt-0.5 flex items-center gap-1">
            <Lock size={12} className="text-[#7a1c24]" /> {accessScopeDescription}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl font-black">
            <button
              type="button"
              onClick={() => setSubView('sheet')}
              className={`px-3.5 py-1.5 rounded-xl cursor-pointer transition ${
                subView === 'sheet' ? 'bg-[#7a1c24] text-white' : 'text-gray-700 hover:bg-white'
              }`}
            >
              📊 تقرير الخدمة الشهري
            </button>
            <button
              type="button"
              onClick={() => setSubView('campaigns')}
              className={`px-3.5 py-1.5 rounded-xl cursor-pointer transition flex items-center gap-1 ${
                subView === 'campaigns' ? 'bg-amber-700 text-white' : 'text-gray-700 hover:bg-white'
              }`}
            >
              <Sparkles size={13} /> عروض وخصومات الخدمة ({serviceCampaigns.filter(c => c.is_active).length})
            </button>
          </div>
        </div>
      </div>

      {subView === 'sheet' ? (
        <div className="space-y-4">
          <div className="bg-[#fbfaf7] p-3 rounded-2xl border border-gray-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {allowedServicesList.length > 1 && (
                <select
                  value={reportService}
                  onChange={e => setReportService(e.target.value)}
                  className="px-3 py-1.5 bg-white border rounded-xl font-black text-xs text-[#7a1c24] cursor-pointer"
                >
                  {allowedServicesList.map((srv, idx) => (
                    <option key={idx} value={srv}>{srv}</option>
                  ))}
                </select>
              )}

              <label className="flex items-center gap-1.5 font-black text-gray-800">
                <Calendar size={14} className="text-[#7a1c24]" /> الشهر:
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border rounded-xl font-black text-xs"
                />
              </label>

              <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border font-bold">
                <button
                  type="button"
                  onClick={() => setSortMode('most_attended')}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                    sortMode === 'most_attended' ? 'bg-emerald-700 text-white' : 'text-gray-700'
                  }`}
                >
                  🏆 الأكثر مواظبة
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode('most_absent')}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                    sortMode === 'most_absent' ? 'bg-red-700 text-white' : 'text-gray-700'
                  }`}
                >
                  ⚠️ الأكثر غياباً
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode('most_late')}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                    sortMode === 'most_late' ? 'bg-amber-700 text-white' : 'text-gray-700'
                  }`}
                >
                  ⏱️ الأكثر تأخيراً/انصرافاً
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={exportCsvSheet}
              className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} /> تصدير شيت الخدمة (CSV)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                <Trophy size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-800 block">الأكثر مواظبة في ({reportService})</span>
                <strong className="text-sm font-black text-gray-900 block">
                  {topAttendee && topAttendee.presentCount > 0 ? topAttendee.member.full_name : 'لا يوجد بيانات بعد'}
                </strong>
                {topAttendee && topAttendee.presentCount > 0 && (
                  <span className="text-[11px] font-bold text-emerald-700">
                    نسبة {topAttendee.attendancePercent}% ({topAttendee.presentCount} حضور)
                  </span>
                )}
              </div>
            </div>

            <div className="bg-red-50/80 border border-red-200 p-3.5 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-700 text-white flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-red-800 block">الأكثر غياباً في ({reportService})</span>
                <strong className="text-sm font-black text-gray-900 block">
                  {topAbsentee && topAbsentee.absentCount > 0 ? topAbsentee.member.full_name : 'لا يوجد غياب مسجل'}
                </strong>
                {topAbsentee && topAbsentee.absentCount > 0 && (
                  <span className="text-[11px] font-bold text-red-700">
                    غاب {topAbsentee.absentCount} مرات
                  </span>
                )}
              </div>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-700 text-white flex items-center justify-center shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-900 block">الأكثر تأخيراً/انصرافاً مبكراً</span>
                <strong className="text-sm font-black text-gray-900 block">
                  {topLate && (topLate.lateCount + topLate.earlyLeaveCount) > 0 ? topLate.member.full_name : 'منتظمون في المواعيد'}
                </strong>
                {topLate && (topLate.lateCount + topLate.earlyLeaveCount) > 0 && (
                  <span className="text-[11px] font-bold text-amber-800">
                    {topLate.lateCount} تأخير • {topLate.earlyLeaveCount} انصراف مبكر
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-2xl">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-800 border-b text-[11px] font-black">
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">الاسم</th>
                  <th className="p-2.5">الفصل</th>
                  <th className="p-2.5">نسبة الالتزام</th>
                  <th className="p-2.5">حضور</th>
                  <th className="p-2.5">غياب</th>
                  <th className="p-2.5">تأخير / مبكر</th>
                  <th className="p-2.5">الخصم / المكافأة</th>
                  <th className="p-2.5">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-bold">
                {monthlyStats.map((row, idx) => (
                  <tr key={row.member.id} className="hover:bg-[#fbfaf7]">
                    <td className="p-2.5 font-black text-gray-500">{idx + 1}</td>
                    <td className="p-2.5">
                      <strong className="text-gray-900 block">{row.member.full_name}</strong>
                    </td>
                    <td className="p-2.5 text-[11px] text-gray-600">
                      {row.member.assigned_class || row.member.detailed_stage || '—'}
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              row.attendancePercent >= 75
                                ? 'bg-emerald-600'
                                : row.attendancePercent >= 50
                                ? 'bg-amber-500'
                                : 'bg-red-600'
                            }`}
                            style={{ width: `${row.attendancePercent}%` }}
                          />
                        </div>
                        <span className="font-black text-gray-900">{row.attendancePercent}%</span>
                      </div>
                    </td>
                    <td className="p-2.5 text-emerald-700 font-black">{row.presentCount}</td>
                    <td className="p-2.5 text-red-700 font-black">{row.absentCount}</td>
                    <td className="p-2.5 text-amber-800">
                      {row.lateCount} تأخير / {row.earlyLeaveCount} مبكر
                    </td>
                    <td className="p-2.5">
                      {row.matchedTier ? (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-950 border border-amber-300 rounded-xl text-[10px] font-black inline-flex items-center gap-1">
                          <Award size={12} /> {row.matchedTier.label}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[10px]">لم يصل لنسبة العرض بعد</span>
                      )}
                    </td>
                    <td className="p-2.5">
                      {row.matchedTier && (
                        <button
                          type="button"
                          onClick={() => handleGrantMonthlyDiscount(row)}
                          className="px-2.5 py-1 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl text-[10px] font-black cursor-pointer"
                        >
                          اعتماد الخصم
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200">
            <div className="text-amber-950 font-bold">
              🎁 العروض هنا خاصة بـ ({reportService}) وتظهر للمخدومين التابعين لها حسب نسبة حضورهم.
            </div>
            {(elevated || groupLeader) && (
              <button
                type="button"
                onClick={() => setShowNewCampaign(prev => !prev)}
                className="px-4 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} /> إضافة عرض لـ ({reportService})
              </button>
            )}
          </div>

          {showNewCampaign && (elevated || groupLeader) && (
            <form onSubmit={handleCreateCampaign} className="bg-[#fbfaf7] p-4 rounded-2xl border border-amber-300 space-y-3">
              <h4 className="font-black text-sm text-[#7a1c24]">إعداد عرض تحفيزي لخدمة ({reportService})</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-bold">عنوان الرحلة أو العرض *</label>
                  <input
                    required
                    placeholder="مثال: رحلة مواظبة الخدمة - خصم للملتزمين"
                    className="w-full p-2.5 bg-white border rounded-xl font-bold"
                    value={campaignTitle}
                    onChange={e => setCampaignTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block mb-1 font-bold">تاريخ انتهاء التحدي *</label>
                  <input
                    required
                    type="date"
                    className="w-full p-2.5 bg-white border rounded-xl font-bold"
                    value={campaignEndDate}
                    onChange={e => setCampaignEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 font-bold">وصف تشجيعي يظهر للمخدوم</label>
                <input
                  placeholder="مثال: التزم في حضورك واكسب خصم يصل لـ 50% على الرحلة!"
                  className="w-full p-2.5 bg-white border rounded-xl font-bold"
                  value={campaignDesc}
                  onChange={e => setCampaignDesc(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-gray-800">شرائح نسب الحضور والخصومات:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setTiers(prev => [...prev, { min_percent: 60, discount_percent: 15, label: 'خصم 15%' }])
                    }
                    className="px-2.5 py-1 bg-amber-100 text-amber-950 rounded-lg font-black cursor-pointer"
                  >
                    + إضافة شريحة
                  </button>
                </div>

                {tiers.map((tier, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border">
                    <div className="col-span-3">
                      <label className="text-[10px] text-gray-500 block">نسبة الحضور %</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="w-full p-1.5 border rounded-lg font-black"
                        value={tier.min_percent}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setTiers(prev => prev.map((t, i) => (i === idx ? { ...t, min_percent: val } : t)));
                        }}
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] text-gray-500 block">نسبة الخصم %</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="w-full p-1.5 border rounded-lg font-black"
                        value={tier.discount_percent}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setTiers(prev => prev.map((t, i) => (i === idx ? { ...t, discount_percent: val } : t)));
                        }}
                      />
                    </div>
                    <div className="col-span-5">
                      <label className="text-[10px] text-gray-500 block">وصف الجائزة</label>
                      <input
                        type="text"
                        className="w-full p-1.5 border rounded-lg font-bold"
                        value={tier.label}
                        onChange={e => {
                          const val = e.target.value;
                          setTiers(prev => prev.map((t, i) => (i === idx ? { ...t, label: val } : t)));
                        }}
                      />
                    </div>
                    <div className="col-span-1 flex justify-center pt-3">
                      <button
                        type="button"
                        onClick={() => setTiers(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-600 hover:text-red-800 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCampaign(false)}
                  className="px-4 py-2 border rounded-xl cursor-pointer font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer font-black"
                >
                  نشر العرض للخدمة 🚀
                </button>
              </div>
            </form>
          )}

          {loadingCampaigns ? (
            <p className="text-center text-gray-500 py-4 font-bold">جاري تحميل العروض...</p>
          ) : serviceCampaigns.length === 0 ? (
            <p className="text-center text-gray-500 py-6 font-bold bg-[#fbfaf7] rounded-2xl border border-dashed">
              لا توجد عروض رحلات أو مكافآت منشورة لهذه الخدمة حالياً.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {serviceCampaigns.map(camp => (
                <div
                  key={camp.id}
                  className={`p-4 rounded-2xl border space-y-2.5 ${
                    camp.is_active ? 'bg-white border-amber-300 shadow-2xs' : 'bg-gray-50 border-gray-200 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black inline-flex items-center gap-1 ${
                          camp.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {camp.is_active ? <><CheckCircle2 size={11} /> ظاهر للمخدومين</> : 'موقوف مؤقتاً'}
                      </span>
                      <h4 className="text-sm font-black text-gray-900 mt-1">{camp.title}</h4>
                      {camp.description && <p className="text-[11px] text-gray-600 font-bold">{camp.description}</p>}
                      <span className="text-[10px] text-gray-400 font-bold block mt-0.5">
                        الخدمة: {camp.target_scope} • ينتهي في: {camp.end_date}
                      </span>
                    </div>

                    {(elevated || groupLeader) && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleCampaignStatus(camp)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
                          title={camp.is_active ? 'إخفاء عن المخدومين' : 'تفعيل وإظهار للمخدومين'}
                        >
                          {camp.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(camp.id)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl cursor-pointer"
                          title="حذف العرض"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                    {Array.isArray(camp.tiers) &&
                      camp.tiers.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl text-[11px] font-black"
                        >
                          حضور {t.min_percent}% ← خصم {t.discount_percent}% ({t.label})
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
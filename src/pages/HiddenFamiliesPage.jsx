import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';
import {
  ShieldAlert, UserPlus, Search, Lock, Paperclip, Upload,
  Eye, ExternalLink, Edit3, Trash2, Send, CheckCircle2, X, Layers
} from 'lucide-react';

const ATTACHMENT_TYPES = ['صورة بطاقة', 'عقد إيجار', 'تحاليل وأشعة', 'إيصال كهرباء ومرافق', 'أخرى'];

const makeEmptyFamily = () => ({
  priest_id: '',
  head_first: '', head_second: '', head_third: '', head_fourth: '',
  phone: '', dob: '', head_qualification: '', job: '',
  spouse_first: '', spouse_second: '', spouse_third: '', spouse_fourth: '',
  spouse_phone: '', spouse_dob: '', spouse_qualification: '', spouse_job: '',
  area: '', area_type: 'منطقة شعبية', poverty_level: 'حالة مستترة', housing: 'إيجار جديد',
  monthly_expenses: 0, needs_monthly_aid: false, monthly_aid_amount: 0,
  house_needs: '', case_notes: '', children: [], pendingAttachments: []
});

export default function HiddenFamiliesPage({ currentUser, users = [], onRefresh }) {
  const isAdmin = currentUser?.role === 'admin';
  const isPriest = currentUser?.role === 'priest';
  const canEditOrDelete = isAdmin || isPriest;

  const priestsList = useMemo(() => users.filter(u => u.role === 'priest'), [users]);

  const [tab, setTab] = useState('list'); // 'list' | 'add' | 'requests'
  const [families, setFamilies] = useState([]);
  const [familyAttachments, setFamilyAttachments] = useState([]);
  const [caseCategories, setCaseCategories] = useState([]);
  const [editRequests, setEditRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQ, setSearchQ] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const [famForm, setFamForm] = useState(() => makeEmptyFamily());
  const [editingFamId, setEditingFamId] = useState(null);
  const [tempChild, setTempChild] = useState({
    child_name: '', dob: '', stage: '', marital_status: 'أعزب', has_disability: false, disability_details: ''
  });
  const [selectedUploadType, setSelectedUploadType] = useState('صورة بطاقة');
  const [uploadingAttach, setUploadingAttach] = useState(false);
  const [saving, setSaving] = useState(false);

  const [inspectFamily, setInspectFamily] = useState(null);
  const [requestModalFamily, setRequestModalFamily] = useState(null);
  const [requestType, setRequestType] = useState('edit');
  const [requestDetails, setRequestDetails] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fmRes, attRes, catRes, reqRes] = await Promise.all([
        supabase
          .from('pastoral_families')
          .select('*, children:family_children(*)')
          .order('case_number', { ascending: true }),
        supabase
          .from('family_attachments')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('case_categories')
          .select('*')
          .order('sort_order', { ascending: true }),
        supabase
          .from('church_notifications')
          .select('*')
          .eq('type', 'hidden_family_edit_request')
          .order('created_at', { ascending: false })
      ]);

      if (fmRes.data) setFamilies(fmRes.data);
      if (attRes.data) setFamilyAttachments(attRes.data);
      if (catRes.data) setCaseCategories(catRes.data);
      if (reqRes.data) {
        const parsedReqs = reqRes.data.map(r => {
          let meta = {};
          try { meta = r.message ? JSON.parse(r.message) : {}; } catch { meta = {}; }
          return {
            id: r.id,
            is_read: r.is_read,
            created_at: r.created_at,
            ...meta
          };
        });
        setEditRequests(parsedReqs);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.id]);

  const categoryNames = caseCategories.length > 0
    ? caseCategories
    : [
        { id: '1', name: 'حالة مستترة', icon: '🕊️' },
        { id: '2', name: 'إخوة الرب (مفتقرة جداً)', icon: '❤️' },
        { id: '3', name: 'متوسطة الاحتياج', icon: '⚖️' },
        { id: '4', name: 'مستقرة', icon: '✅' }
      ];

  const handleUploadAttachment = async (file, attachType, targetFamilyId = null) => {
    if (!file) return;
    setUploadingAttach(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const safePath = `${targetFamilyId || 'hidden_' + currentUser.id}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('family-attachments').upload(safePath, file, { upsert: true });
      if (upErr) {
        alert('تعذر رفع الملف (' + upErr.message + ').');
        return;
      }
      const { data: pub } = supabase.storage.from('family-attachments').getPublicUrl(safePath);
      const fileUrl = pub?.publicUrl || '';

      if (targetFamilyId && canEditOrDelete) {
        const { data: savedRow, error: insErr } = await supabase
          .from('family_attachments')
          .insert([{
            family_id: targetFamilyId,
            attachment_type: attachType,
            file_name: file.name,
            file_url: fileUrl,
            uploaded_by: currentUser.id
          }])
          .select()
          .single();
        if (!insErr && savedRow) {
          setFamilyAttachments(prev => [savedRow, ...prev]);
        }
      } else {
        setFamForm(prev => ({
          ...prev,
          pendingAttachments: [
            ...(prev.pendingAttachments || []),
            { tempId: `tmp_${Date.now()}`, attachment_type: attachType, file_name: file.name, file_url: fileUrl }
          ]
        }));
      }
    } finally {
      setUploadingAttach(false);
    }
  };

  const handleSaveFamily = async (e) => {
    e.preventDefault();
    if (editingFamId && !canEditOrDelete) {
      alert('🔒 غير مسموح بتعديل بيانات الأسرة بعد الحفظ إلا بالرجوع للأب الكاهن أو السوبر أدمن.');
      return;
    }

    const head_name = [famForm.head_first, famForm.head_second, famForm.head_third, famForm.head_fourth]
      .map(s => s.trim())
      .filter(Boolean)
      .join(' ');
    const spouse_full_name = [famForm.spouse_first, famForm.spouse_second, famForm.spouse_third, famForm.spouse_fourth]
      .map(s => s.trim())
      .filter(Boolean)
      .join(' ');

    if (!head_name) return alert('أدخل الاسم الرباعي لرب الأسرة');

    const chosenPriestId =
      famForm.priest_id ||
      (isPriest ? currentUser.id : '') ||
      currentUser?.confession_father_id ||
      priestsList[0]?.id ||
      null;

    setSaving(true);
    try {
      const { children, pendingAttachments, case_number, id, created_at, ...rest } = famForm;
      const servantSignature = !editingFamId
        ? `[أُضيفت بواسطة: ${currentUser?.full_name || 'خادم الأسر المستترة'}]`
        : '';

      const combinedNotes = [
        rest.case_notes || '',
        servantSignature && !(rest.case_notes || '').includes(servantSignature) ? servantSignature : ''
      ].filter(Boolean).join(' • ');

      const payload = {
        ...rest,
        priest_id: chosenPriestId,
        head_name,
        spouse_full_name,
        case_notes: combinedNotes,
        dob: famForm.dob || null,
        spouse_dob: famForm.spouse_dob || null,
        monthly_expenses: Number(famForm.monthly_expenses || 0),
        monthly_aid_amount: Number(famForm.monthly_aid_amount || 0)
      };

      if (editingFamId) {
        const { data: fam, error } = await supabase
          .from('pastoral_families')
          .update(payload)
          .eq('id', editingFamId)
          .select()
          .single();
        if (error) throw new Error(error.message);

        await supabase.from('family_children').delete().eq('family_id', editingFamId);
        let savedKids = [];
        if (children?.length > 0) {
          const kidsPayload = children.map(c => ({
            family_id: editingFamId,
            child_name: c.child_name,
            dob: c.dob || null,
            stage: c.stage || '',
            marital_status: c.marital_status || 'أعزب',
            has_disability: Boolean(c.has_disability),
            disability_details: c.disability_details || ''
          }));
          const { data: k } = await supabase.from('family_children').insert(kidsPayload).select();
          if (k) savedKids = k;
        }
        setFamilies(prev => prev.map(f => (f.id === editingFamId ? { ...fam, children: savedKids } : f)));
        logActivity({
          user: currentUser,
          actionType: 'تعديل_أسرة_مستترة',
          targetTable: 'pastoral_families',
          targetId: editingFamId,
          description: `عدّل بيانات الأسرة المستترة: ${head_name}`
        });
        setEditingFamId(null);
        setFamForm(makeEmptyFamily());
        setTab('list');
        alert('تم تعديل بيانات الأسرة بنجاح ✅');
      } else {
        const { data: fam, error } = await supabase
          .from('pastoral_families')
          .insert([payload])
          .select()
          .single();
        if (error) throw new Error(error.message);

        let savedKids = [];
        if (children?.length > 0) {
          const kidsPayload = children.map(c => ({
            family_id: fam.id,
            child_name: c.child_name,
            dob: c.dob || null,
            stage: c.stage || '',
            marital_status: c.marital_status || 'أعزب',
            has_disability: Boolean(c.has_disability),
            disability_details: c.disability_details || ''
          }));
          const { data: k } = await supabase.from('family_children').insert(kidsPayload).select();
          if (k) savedKids = k;
        }

        if (pendingAttachments?.length > 0) {
          const attPayload = pendingAttachments.map(a => ({
            family_id: fam.id,
            attachment_type: a.attachment_type,
            file_name: a.file_name,
            file_url: a.file_url,
            uploaded_by: currentUser.id
          }));
          const { data: savedAtts } = await supabase.from('family_attachments').insert(attPayload).select();
          if (savedAtts) setFamilyAttachments(prev => [...savedAtts, ...prev]);
        }

        setFamilies(prev => [...prev, { ...fam, children: savedKids }]);
        logActivity({
          user: currentUser,
          actionType: 'إضافة_أسرة_مستترة',
          targetTable: 'pastoral_families',
          targetId: fam.id,
          description: `أضاف أسرة في خدمة الأسر المستترة: ${head_name}`
        });
        setFamForm(makeEmptyFamily());
        setTab('list');
        alert('تم حفظ الأسرة وبحث الحالة بنجاح ✅ (لا يمكن التعديل أو المسح بعد الآن إلا بالرجوع للأب الكاهن أو الأدمن)');
      }

      if (onRefresh) await onRefresh();
    } catch (err) {
      alert('تعذر حفظ البيانات: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEditForAuthorized = (f) => {
    if (!canEditOrDelete) {
      alert('🔒 التعديل متاح للأب الكاهن أو السوبر أدمن فقط.');
      return;
    }
    setEditingFamId(f.id);
    const hParts = (f.head_name || '').split(' ');
    const sParts = (f.spouse_full_name || '').split(' ');
    setFamForm({
      ...makeEmptyFamily(),
      ...f,
      head_first: f.head_first || hParts[0] || '',
      head_second: f.head_second || hParts[1] || '',
      head_third: f.head_third || hParts[2] || '',
      head_fourth: f.head_fourth || hParts.slice(3).join(' ') || '',
      spouse_first: f.spouse_first || sParts[0] || '',
      spouse_second: f.spouse_second || sParts[1] || '',
      spouse_third: f.spouse_third || sParts[2] || '',
      spouse_fourth: f.spouse_fourth || sParts.slice(3).join(' ') || '',
      dob: f.dob || '',
      spouse_dob: f.spouse_dob || '',
      children: f.children || [],
      pendingAttachments: []
    });
    setTab('add');
  };

  const handleDeleteForAuthorized = async (f) => {
    if (!canEditOrDelete) {
      alert('🔒 الحذف متاح للأب الكاهن أو السوبر أدمن فقط.');
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف ملف الأسرة (${f.head_name}) نهائياً؟`)) return;
    const { error } = await supabase.from('pastoral_families').delete().eq('id', f.id);
    if (error) return alert('تعذر الحذف: ' + error.message);
    setFamilies(prev => prev.filter(x => x.id !== f.id));
    logActivity({
      user: currentUser,
      actionType: 'حذف_أسرة_مستترة',
      targetTable: 'pastoral_families',
      targetId: f.id,
      description: `حذف ملف الأسرة: ${f.head_name}`
    });
    if (onRefresh) await onRefresh();
  };

  const handleSubmitEditOrDeleteRequest = async (e) => {
    e.preventDefault();
    if (!requestModalFamily || !requestDetails.trim()) return;
    setSendingRequest(true);
    try {
      const targetPriestId = requestModalFamily.priest_id || priestsList[0]?.id || currentUser.id;
      const meta = {
        family_id: requestModalFamily.id,
        case_number: requestModalFamily.case_number,
        family_name: requestModalFamily.head_name,
        request_type: requestType,
        details: requestDetails.trim(),
        requested_by_id: currentUser.id,
        requested_by_name: currentUser.full_name,
        status: 'pending'
      };
      const { data, error } = await supabase
        .from('church_notifications')
        .insert([{
          user_id: targetPriestId,
          title: requestType === 'delete'
            ? `🗑️ طلب حذف أسرة مستترة: ${requestModalFamily.head_name}`
            : `✏️ طلب تعديل أسرة مستترة: ${requestModalFamily.head_name}`,
          message: JSON.stringify(meta),
          type: 'hidden_family_edit_request',
          reference_id: requestModalFamily.id,
          is_read: false
        }])
        .select()
        .single();

      if (error) throw new Error(error.message);
      if (data) {
        setEditRequests(prev => [{ id: data.id, is_read: false, created_at: data.created_at, ...meta }, ...prev]);
      }
      setRequestModalFamily(null);
      setRequestDetails('');
      alert('تم إرسال طلبك للأب الكاهن وإدارة الكنيسة بنجاح ✅');
    } catch (err) {
      alert('تعذر إرسال الطلب: ' + err.message);
    } finally {
      setSendingRequest(false);
    }
  };

  const handleMarkRequestHandled = async (req, newStatus = 'done') => {
    if (!canEditOrDelete) return;
    const { id, is_read, created_at, ...meta } = req;
    const nextMeta = { ...meta, status: newStatus };
    const { error } = await supabase
      .from('church_notifications')
      .update({ is_read: true, message: JSON.stringify(nextMeta) })
      .eq('id', req.id);
    if (!error) {
      setEditRequests(prev => prev.map(r => (r.id === req.id ? { ...r, is_read: true, status: newStatus } : r)));
    }
  };

  const filteredFamilies = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return families.filter(f => {
      if (catFilter !== 'all' && f.poverty_level !== catFilter) return false;
      if (!q) return true;
      return (
        String(f.case_number || '') === searchQ.trim() ||
        `${f.head_name || ''} ${f.phone || ''} ${f.area || ''} ${f.job || ''} ${f.spouse_full_name || ''}`
          .toLowerCase()
          .includes(q)
      );
    });
  }, [families, catFilter, searchQ]);

  const pendingRequestsCount = editRequests.filter(r => r.status !== 'done').length;

  return (
    <div className="space-y-3 text-xs md:text-sm" dir="rtl">
      {/* هيدر وتنبيه الصلاحية */}
      <div className="bg-linear-to-r from-[#5c1319] to-[#7a1c24] text-white p-4 sm:p-5 rounded-3xl shadow flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-lg font-black text-amber-200 flex items-center gap-2">
            🕊️ خدمة الأسر المستترة — بحث الحالة والرعاية
          </h2>
          <p className="text-xs text-white/85 mt-1">
            {canEditOrDelete
              ? 'صلاحية كاملة (الأب الكاهن / السوبر أدمن): إضافة وتعديل وحذف ومراجعة طلبات الخدام'
              : 'صلاحية خادم الأسر المستترة: إضافة وبحث الحالة فقط — التعديل والحذف يتم بالرجوع للأب الكاهن أو الأدمن'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!canEditOrDelete && (
            <span className="px-3 py-1.5 bg-amber-400/20 border border-amber-300/40 text-amber-200 rounded-xl text-xs font-black flex items-center gap-1">
              <Lock size={13} /> الإضافة مفتوحة • التعديل والحذف مقفول
            </span>
          )}
        </div>
      </div>

      {/* شريط التابات */}
      <div className="bg-white p-2 rounded-2xl border shadow-2xs flex items-center gap-1.5 overflow-x-auto font-black text-xs">
        <button
          type="button"
          onClick={() => setTab('list')}
          className={`px-4 py-2 rounded-xl shrink-0 cursor-pointer flex items-center gap-1.5 ${
            tab === 'list' ? 'bg-[#7a1c24] text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
          }`}
        >
          <Layers size={14} /> سجل الأسر ({families.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setEditingFamId(null);
            setFamForm(makeEmptyFamily());
            setTab('add');
          }}
          className={`px-4 py-2 rounded-xl shrink-0 cursor-pointer flex items-center gap-1.5 ${
            tab === 'add' ? 'bg-[#7a1c24] text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
          }`}
        >
          <UserPlus size={14} /> {editingFamId ? 'تعديل أسرة' : '+ إضافة أسرة وبحث حالة'}
        </button>

        <button
          type="button"
          onClick={() => setTab('requests')}
          className={`px-4 py-2 rounded-xl shrink-0 cursor-pointer flex items-center gap-1.5 ${
            tab === 'requests' ? 'bg-[#7a1c24] text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
          }`}
        >
          <ShieldAlert size={14} /> طلبات التعديل والحذف
          {pendingRequestsCount > 0 && (
            <span className="px-1.5 py-0.5 bg-red-600 text-white rounded-full text-[10px]">{pendingRequestsCount}</span>
          )}
        </button>
      </div>

      {/* محتوى الشاشة داخل Scroll منظم */}
      <div className="max-h-[calc(100dvh-255px)] overflow-y-auto pr-1 space-y-3">
        {tab === 'list' && (
          <div className="space-y-3">
            <div className="bg-white p-3 rounded-2xl border flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-52">
                <Search size={14} className="absolute right-3 top-3 text-gray-400" />
                <input
                  placeholder="ابحث برقم الحالة أو الاسم أو التليفون أو المنطقة..."
                  className="w-full pr-8 pl-3 py-2 bg-[#fbfaf7] border rounded-xl text-xs outline-none focus:border-[#7a1c24]"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCatFilter('all')}
                  className={`px-3 py-1.5 rounded-xl border shrink-0 cursor-pointer ${
                    catFilter === 'all' ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-gray-50'
                  }`}
                >
                  الكل ({families.length})
                </button>
                {categoryNames.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCatFilter(cat.name)}
                    className={`px-3 py-1.5 rounded-xl border shrink-0 cursor-pointer ${
                      catFilter === cat.name ? 'bg-[#7a1c24] text-white border-[#7a1c24]' : 'bg-gray-50'
                    }`}
                  >
                    {cat.icon} {cat.name} ({families.filter(f => f.poverty_level === cat.name).length})
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="bg-white p-8 rounded-3xl border text-center text-gray-500 font-bold">جاري التحميل...</div>
            ) : filteredFamilies.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border text-center text-gray-400 font-bold">
                لا توجد أسر مطابقة للبحث الحالي
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredFamilies.map(f => {
                  const famAtts = familyAttachments.filter(a => a.family_id === f.id);
                  const assignedPriest = priestsList.find(p => p.id === f.priest_id);
                  return (
                    <div key={f.id} className="bg-white p-4 rounded-2xl border space-y-2.5 shadow-2xs">
                      <div className="flex flex-wrap justify-between items-start gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2.5 py-0.5 bg-gray-900 text-white rounded text-xs font-black">#{f.case_number}</span>
                            <strong className="text-base text-gray-900">{f.head_name}</strong>
                            <span className="px-2.5 py-0.5 bg-red-100 text-red-800 rounded text-xs font-bold">{f.poverty_level}</span>
                            {assignedPriest && (
                              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-950 rounded text-[11px] font-bold">
                                ✝ {assignedPriest.full_name}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">
                            📞 {f.phone} • 📍 {f.area} • 💼 {f.job || '—'}
                            {f.spouse_full_name && ` • 💍 الزوج/الزوجة: ${f.spouse_full_name}`}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5 items-center">
                          <button
                            type="button"
                            onClick={() => setInspectFamily(f)}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-900 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Paperclip size={13} /> التفاصيل والمرفقات ({famAtts.length})
                          </button>

                          {canEditOrDelete ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditForAuthorized(f)}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-amber-100 text-gray-800 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 size={13} /> تعديل
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteForAuthorized(f)}
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 size={13} /> حذف
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setRequestModalFamily(f);
                                setRequestType('edit');
                                setRequestDetails('');
                              }}
                              className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl font-black text-xs flex items-center gap-1 cursor-pointer"
                              title="لا يمكن للخادم التعديل أو المسح مباشرة؛ أرسل طلباً للأب الكاهن أو الأدمن"
                            >
                              <Lock size={12} /> طلب تعديل / حذف
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-[#fbfaf7] p-2.5 rounded-xl border text-xs">
                        <div><span className="text-gray-500 block">مصاريف البيت:</span><strong>{f.monthly_expenses || 0} ج.م</strong></div>
                        <div><span className="text-gray-500 block">الدعم المطلوب:</span><strong className="text-red-700">{f.monthly_aid_amount || 0} ج.م</strong></div>
                        <div><span className="text-gray-500 block">احتياجات البيت:</span><strong>{f.house_needs || f.case_notes || '—'}</strong></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'add' && (
          <form onSubmit={handleSaveFamily} className="bg-white p-5 rounded-3xl border space-y-3 font-bold text-xs">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-2.5">
              <h3 className="text-sm md:text-base font-black text-[#7a1c24]">
                {editingFamId ? '✏️ تعديل ملف الأسرة (صلاحية الكاهن/الأدمن)' : '+ إضافة أسرة وبحث حالة (خدمة الأسر المستترة)'}
              </h3>
              {!canEditOrDelete && (
                <span className="px-3 py-1 bg-amber-50 border border-amber-300 text-amber-950 rounded-xl text-[11px]">
                  ⚠️ راجع البيانات جيداً قبل الحفظ — بعد الحفظ يُقفل التعديل والحذف إلا بالرجوع للكاهن أو الأدمن
                </span>
              )}
            </div>

            {priestsList.length > 0 && (
              <div>
                <label className="block mb-1 text-gray-700">الأب الكاهن المسؤول عن الأسرة:</label>
                <select
                  className="w-full sm:max-w-sm p-2.5 border rounded-xl bg-[#fbfaf7]"
                  value={famForm.priest_id || (isPriest ? currentUser.id : priestsList[0]?.id || '')}
                  onChange={e => setFamForm({ ...famForm, priest_id: e.target.value })}
                >
                  {priestsList.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block mb-1 text-[#7a1c24]">الاسم الرباعي لرب الأسرة *</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input required placeholder="الاسم الأول *" className="p-2.5 border rounded-xl" value={famForm.head_first} onChange={e => setFamForm({ ...famForm, head_first: e.target.value })} />
                <input required placeholder="الثاني *" className="p-2.5 border rounded-xl" value={famForm.head_second} onChange={e => setFamForm({ ...famForm, head_second: e.target.value })} />
                <input placeholder="الثالث" className="p-2.5 border rounded-xl" value={famForm.head_third} onChange={e => setFamForm({ ...famForm, head_third: e.target.value })} />
                <input placeholder="الرابع" className="p-2.5 border rounded-xl" value={famForm.head_fourth} onChange={e => setFamForm({ ...famForm, head_fourth: e.target.value })} />
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-2">
              <input required placeholder="تليفون رب الأسرة *" className="p-2.5 border rounded-xl" value={famForm.phone} onChange={e => setFamForm({ ...famForm, phone: e.target.value })} />
              <input type="date" className="p-2.5 border rounded-xl" value={famForm.dob} onChange={e => setFamForm({ ...famForm, dob: e.target.value })} />
              <input placeholder="المؤهل" className="p-2.5 border rounded-xl" value={famForm.head_qualification} onChange={e => setFamForm({ ...famForm, head_qualification: e.target.value })} />
              <input placeholder="العمل" className="p-2.5 border rounded-xl" value={famForm.job} onChange={e => setFamForm({ ...famForm, job: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-pink-50/40 p-3 rounded-2xl border border-pink-100">
              <input placeholder="اسم الزوج/الزوجة الأول" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_first} onChange={e => setFamForm({ ...famForm, spouse_first: e.target.value })} />
              <input placeholder="الاسم الثاني" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_second} onChange={e => setFamForm({ ...famForm, spouse_second: e.target.value })} />
              <input placeholder="تليفون الزوج/الزوجة" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_phone} onChange={e => setFamForm({ ...famForm, spouse_phone: e.target.value })} />
              <input placeholder="عمل الزوج/الزوجة" className="p-2.5 border rounded-xl bg-white" value={famForm.spouse_job} onChange={e => setFamForm({ ...famForm, spouse_job: e.target.value })} />
            </div>

            <div className="bg-amber-50 p-3 rounded-2xl border space-y-2">
              <span className="block text-amber-950">بيانات الأبناء ({famForm.children.length}):</span>
              <div className="grid md:grid-cols-4 gap-2">
                <input placeholder="اسم الابن" className="p-2 border rounded-xl bg-white" value={tempChild.child_name} onChange={e => setTempChild({ ...tempChild, child_name: e.target.value })} />
                <input type="date" className="p-2 border rounded-xl bg-white" value={tempChild.dob} onChange={e => setTempChild({ ...tempChild, dob: e.target.value })} />
                <input placeholder="المرحلة / الدراسة" className="p-2 border rounded-xl bg-white" value={tempChild.stage} onChange={e => setTempChild({ ...tempChild, stage: e.target.value })} />
                <select className="p-2 border rounded-xl bg-white" value={tempChild.marital_status} onChange={e => setTempChild({ ...tempChild, marital_status: e.target.value })}>
                  <option value="أعزب">أعزب</option>
                  <option value="متزوج">متزوج</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={tempChild.has_disability} onChange={e => setTempChild({ ...tempChild, has_disability: e.target.checked })} />
                  إعاقة / مرض؟
                </label>
                {tempChild.has_disability && (
                  <input placeholder="التفاصيل" className="flex-1 p-2 border rounded-xl bg-white" value={tempChild.disability_details} onChange={e => setTempChild({ ...tempChild, disability_details: e.target.value })} />
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (tempChild.child_name.trim()) {
                      setFamForm(prev => ({ ...prev, children: [...prev.children, tempChild] }));
                      setTempChild({ child_name: '', dob: '', stage: '', marital_status: 'أعزب', has_disability: false, disability_details: '' });
                    }
                  }}
                  className="px-3.5 py-1.5 bg-amber-600 text-white rounded-xl cursor-pointer"
                >
                  + إضافة ابن
                </button>
              </div>
              {famForm.children.map((c, idx) => (
                <div key={idx} className="text-xs bg-white px-2.5 py-1.5 rounded flex justify-between items-center">
                  <span>• {c.child_name} ({c.stage})</span>
                  <button
                    type="button"
                    onClick={() => setFamForm(prev => ({ ...prev, children: prev.children.filter((_, i) => i !== idx) }))}
                    className="text-red-600 cursor-pointer"
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-4 gap-2.5 bg-emerald-50/40 p-3 rounded-2xl border border-emerald-200">
              <input required placeholder="المنطقة / الشارع *" className="p-2.5 border rounded-xl bg-white" value={famForm.area} onChange={e => setFamForm({ ...famForm, area: e.target.value })} />
              <select className="p-2.5 border rounded-xl bg-white" value={famForm.poverty_level} onChange={e => setFamForm({ ...famForm, poverty_level: e.target.value })}>
                {categoryNames.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
              </select>
              <input type="number" min="0" placeholder="المصاريف الشهرية" className="p-2.5 border rounded-xl bg-white" value={famForm.monthly_expenses || ''} onChange={e => setFamForm({ ...famForm, monthly_expenses: e.target.value })} />
              <input type="number" min="0" placeholder="الدعم الشهري المطلوب" className="p-2.5 border rounded-xl bg-white" value={famForm.monthly_aid_amount || ''} onChange={e => setFamForm({ ...famForm, monthly_aid_amount: e.target.value, needs_monthly_aid: Number(e.target.value) > 0 })} />
            </div>

            <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-200 space-y-2.5">
              <strong className="text-indigo-950 flex items-center gap-1.5">
                <Paperclip size={15} /> مرفقات بحث الحالة (صورة بطاقة / عقد إيجار / تحاليل / إيصالات)
              </strong>
              <div className="flex flex-wrap gap-2 items-center">
                <select className="p-2 border rounded-xl bg-white" value={selectedUploadType} onChange={e => setSelectedUploadType(e.target.value)}>
                  {ATTACHMENT_TYPES.map(at => <option key={at} value={at}>{at}</option>)}
                </select>
                <label className={`px-4 py-2 rounded-xl font-black flex items-center gap-1.5 cursor-pointer ${uploadingAttach ? 'bg-gray-300 text-gray-600' : 'bg-indigo-700 hover:bg-indigo-800 text-white'}`}>
                  <Upload size={14} /> {uploadingAttach ? 'جاري الرفع...' : `رفع (${selectedUploadType})`}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    disabled={uploadingAttach}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadAttachment(f, selectedUploadType, editingFamId || null);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              {(editingFamId ? familyAttachments.filter(a => a.family_id === editingFamId) : famForm.pendingAttachments).map((att, idx) => (
                <div key={att.id || att.tempId || idx} className="bg-white p-2 rounded-xl border flex justify-between items-center gap-2">
                  <span>{att.attachment_type}: {att.file_name}</span>
                  <a href={att.file_url} target="_blank" rel="noreferrer" className="text-blue-700 flex items-center gap-1"><ExternalLink size={13} /> فتح</a>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-2">
              <input placeholder="احتياجات البيت..." className="w-full p-2.5 border rounded-xl" value={famForm.house_needs} onChange={e => setFamForm({ ...famForm, house_needs: e.target.value })} />
              <input placeholder="ملخص بحث الحالة والملاحظات..." className="w-full p-2.5 border rounded-xl" value={famForm.case_notes} onChange={e => setFamForm({ ...famForm, case_notes: e.target.value })} />
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving || uploadingAttach} className="px-6 py-3 bg-[#7a1c24] text-white rounded-xl font-black cursor-pointer shadow">
                {saving ? 'جاري الحفظ...' : editingFamId ? 'حفظ التعديلات' : 'حفظ بيانات الأسرة وبحث الحالة ✅'}
              </button>
              {editingFamId && (
                <button
                  type="button"
                  onClick={() => { setEditingFamId(null); setFamForm(makeEmptyFamily()); setTab('list'); }}
                  className="px-4 py-2 border rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
              )}
            </div>
          </form>
        )}

        {tab === 'requests' && (
          <div className="space-y-2.5">
            {editRequests.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border text-center text-gray-400 font-bold">
                لا توجد طلبات تعديل أو حذف مرسلة حالياً
              </div>
            ) : (
              editRequests.map(req => {
                const targetFam = families.find(f => f.id === req.family_id);
                const isDone = req.status === 'done';
                return (
                  <div key={req.id} className={`p-4 rounded-2xl border flex flex-wrap justify-between items-start gap-3 ${isDone ? 'bg-gray-50 opacity-75' : 'bg-white border-amber-300'}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                          req.request_type === 'delete' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-950'
                        }`}>
                          {req.request_type === 'delete' ? '🗑️ طلب حذف' : '✏️ طلب تعديل'}
                        </span>
                        <strong className="text-sm text-gray-900">
                          {req.family_name} {req.case_number ? `(#${req.case_number})` : ''}
                        </strong>
                        {isDone && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-full text-[10px] font-black">
                            ✓ تم التنفيذ
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-700">{req.details}</p>
                      <span className="text-[11px] text-gray-500 block">مُرسل من: {req.requested_by_name}</span>
                    </div>

                    {canEditOrDelete && !isDone && (
                      <div className="flex flex-wrap gap-1.5">
                        {targetFam && req.request_type === 'edit' && (
                          <button
                            type="button"
                            onClick={() => openEditForAuthorized(targetFam)}
                            className="px-3 py-1.5 bg-[#7a1c24] text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 size={12} /> فتح وتعديل الأسرة
                          </button>
                        )}
                        {targetFam && req.request_type === 'delete' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteForAuthorized(targetFam)}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={12} /> حذف الأسرة
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleMarkRequestHandled(req, 'done')}
                          className="px-3 py-1.5 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 size={12} /> تم المراجعة
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* مودال عرض التفاصيل والمرفقات */}
      {inspectFamily && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-xl p-6 space-y-3 text-xs font-bold max-h-[90dvh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-black text-[#7a1c24]">
                ملف الأسرة: {inspectFamily.head_name} (#{inspectFamily.case_number})
              </h3>
              <button type="button" onClick={() => setInspectFamily(null)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 bg-[#fbfaf7] p-3 rounded-2xl border">
              <div>📞 التليفون: {inspectFamily.phone}</div>
              <div>📍 المنطقة: {inspectFamily.area}</div>
              <div>💼 العمل: {inspectFamily.job || '—'}</div>
              <div>🏠 السكن: {inspectFamily.housing || '—'}</div>
              <div>💍 الزوج/الزوجة: {inspectFamily.spouse_full_name || '—'}</div>
              <div>💰 المصاريف / الدعم: {inspectFamily.monthly_expenses || 0} / {inspectFamily.monthly_aid_amount || 0} ج.م</div>
            </div>
            {(inspectFamily.children || []).length > 0 && (
              <div className="space-y-1">
                <strong className="text-gray-800 block">الأبناء ({inspectFamily.children.length}):</strong>
                {inspectFamily.children.map((c, idx) => (
                  <div key={idx} className="p-2 bg-amber-50 rounded-xl border border-amber-200">
                    • {c.child_name} {c.stage ? `(${c.stage})` : ''} {c.has_disability ? `• ⚠️ ${c.disability_details}` : ''}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <strong className="text-gray-800 block">المرفقات:</strong>
              {familyAttachments.filter(a => a.family_id === inspectFamily.id).length === 0 ? (
                <p className="text-gray-400">لا توجد مرفقات</p>
              ) : (
                familyAttachments.filter(a => a.family_id === inspectFamily.id).map(att => (
                  <div key={att.id} className="p-2.5 bg-gray-50 border rounded-xl flex justify-between items-center">
                    <span>{att.attachment_type}: {att.file_name}</span>
                    <a href={att.file_url} target="_blank" rel="noreferrer" className="px-3 py-1 bg-blue-600 text-white rounded-lg flex items-center gap-1">
                      <Eye size={12} /> فتح
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* مودال طلب تعديل أو حذف للكاهن/الأدمن */}
      {requestModalFamily && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-3 text-xs font-bold">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-sm font-black text-[#7a1c24]">📩 طلب تعديل / حذف من الكاهن أو الأدمن</h3>
              <button type="button" onClick={() => setRequestModalFamily(null)} className="p-1 text-gray-500 cursor-pointer"><X size={16} /></button>
            </div>
            <p className="text-gray-600">
              الأسرة: <strong>{requestModalFamily.head_name}</strong> (#{requestModalFamily.case_number})
            </p>
            <form onSubmit={handleSubmitEditOrDeleteRequest} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRequestType('edit')}
                  className={`p-2 rounded-xl border cursor-pointer ${requestType === 'edit' ? 'bg-[#7a1c24] text-white' : 'bg-white'}`}
                >
                  ✏️ طلب تعديل بيانات
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType('delete')}
                  className={`p-2 rounded-xl border cursor-pointer ${requestType === 'delete' ? 'bg-red-700 text-white' : 'bg-white'}`}
                >
                  🗑️ طلب حذف الملف
                </button>
              </div>
              <textarea
                required
                rows={3}
                placeholder="اكتب بالتفصيل التعديل المطلوب أو سبب الحذف ليراجعه الأب الكاهن أو الأدمن..."
                className="w-full p-2.5 border rounded-xl"
                value={requestDetails}
                onChange={e => setRequestDetails(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setRequestModalFamily(null)} className="px-4 py-2 border rounded-xl cursor-pointer">إلغاء</button>
                <button type="submit" disabled={sendingRequest} className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl flex items-center gap-1 cursor-pointer">
                  <Send size={13} /> {sendingRequest ? 'جاري الإرسال...' : 'إرسال الطلب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
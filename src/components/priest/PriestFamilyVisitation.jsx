import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLogger';
import {
  Users, Plus, Search, Edit3, Trash2, Printer, MessageCircle,
  Calendar, MapPin, Phone, Briefcase, GraduationCap, Heart, X,
  UserPlus, Link2, RefreshCw, ChevronDown, ChevronUp,
  FileSpreadsheet, RotateCcw, UserCheck, ShieldCheck, AlertCircle
} from 'lucide-react';

const MARITAL_STATUS_OPTIONS = ['متزوج', 'متزوجة', 'أعزب', 'آنسة', 'أرمل', 'أرملة', 'مطلق/ة'];
const FAMILY_STATUS_OPTIONS = [
  'مستقرة',
  'تحتاج متابعة روحية',
  'تحتاج افتقاد دوري',
  'أسرة مستترة / تحتاج دعم',
  'ظروف صحية خاصة',
  'خلافات أسرية تحتاج رعاية'
];

const KINSHIP_ROLE_OPTIONS = [
  'الأب',
  'الأم',
  'الابن',
  'الابنة',
  'الحفيد',
  'الحفيدة',
  'الجد',
  'الجدة',
  'الزوج',
  'الزوجة',
  'الأخ',
  'الأخت',
  'العم',
  'الخال',
  'الخالة',
  'زوج الأخت'
];

const REVERSE_KINSHIP_MAP = {
  'الأب': 'الابن / الابنة',
  'الأم': 'الابن / الابنة',
  'الابن': 'الأب / الأم',
  'الابنة': 'الأب / الأم',
  'الجد': 'الحفيد / الحفيدة',
  'الجدة': 'الحفيد / الحفيدة',
  'الحفيد': 'الجد / الجدة',
  'الحفيدة': 'الجد / الجدة',
  'الزوج': 'الزوجة',
  'الزوجة': 'الزوج',
  'الأخ': 'الأخ / الأخت',
  'الأخت': 'الأخ / الأخت',
  'العم': 'ابن / ابنة الأخ',
  'الخال': 'ابن / ابنة الأخت',
  'الخالة': 'ابن / ابنة الأخت',
  'زوج الأخت': 'نسيب / صهر'
};

const normalizeArabic = (str = '') =>
  String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\bعبد\s+/g, 'عبد')
    .replace(/\s+/g, ' ');

const getDisplayQuadName = (u) => {
  if (!u) return '';
  if ((u.full_name || '').trim()) return u.full_name.trim();
  return [u.first_name, u.second_name, u.third_name, u.fourth_name]
    .map(s => (s || '').trim())
    .filter(Boolean)
    .join(' ');
};

const extractUserAddress = (u) => {
  if (!u) return '';
  const parts = [
    u.address,
    u.street,
    u.area,
    u.region,
    u.district,
    u.governorate
  ]
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);

  const uniqueParts = [];
  for (const p of parts) {
    const pNorm = normalizeArabic(p);
    if (!uniqueParts.some(existing => normalizeArabic(existing).includes(pNorm) || pNorm.includes(normalizeArabic(existing)))) {
      uniqueParts.push(p);
    }
  }
  return uniqueParts.join(' - ');
};

const emptyPerson = (defaultMarital = 'متزوج') => ({
  user_id: null,
  full_name: '',
  dob: '',
  marital_status: defaultMarital,
  study_status: '',
  job_title: '',
  phone: '',
  address: '',
  is_alive: true
});

const emptyFamilyForm = {
  family_title: '',
  address: '',
  housing_type: 'تمليك',
  family_status: 'مستقرة',
  phone: '',
  next_visit_date: '',
  notes: '',
  husband: emptyPerson('متزوج'),
  wife: emptyPerson('متزوجة'),
  father: emptyPerson('متزوج'),
  mother: emptyPerson('متزوجة'),
  children: [],
  relatives: [],
  visitations_log: []
};

const emptyVisitDraft = (today) => ({
  visit_date: today,
  method: 'زيارة منزلية',
  visitor_name: '',
  summary: '',
  needs: ''
});

const calcAge = (dob) => {
  if (!dob) return '—';
  const yrs = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return Number.isFinite(yrs) && yrs >= 0 ? `${yrs} سنة` : '—';
};

const toPersonObjectFromUser = (u, defaultMarital = 'متزوج') => ({
  user_id: u.id,
  full_name: getDisplayQuadName(u),
  dob: u.dob || '',
  marital_status: u.marital_status || defaultMarital,
  study_status: u.is_studying
    ? (u.detailed_stage || u.service_stage || 'يدرس')
    : (u.detailed_stage || u.service_stage || ''),
  job_title: u.job_title || '',
  phone: u.phone || '',
  address: extractUserAddress(u),
  is_alive: true
});

async function safeUpdateChurchUser(userId, patch) {
  if (!userId || !patch || Object.keys(patch).length === 0) return { ok: true };
  const { error } = await supabase.from('church_users').update(patch).eq('id', userId);
  if (!error) return { ok: true };

  const fallbackPatch = { ...patch };
  delete fallbackPatch.permissions;
  delete fallbackPatch.housing_type;
  delete fallbackPatch.father_phone;
  delete fallbackPatch.mother_phone;
  const retry = await supabase.from('church_users').update(fallbackPatch).eq('id', userId);
  if (!retry.error) return { ok: true };
  return { ok: false, error: retry.error.message || error.message };
}

export default function PriestFamilyVisitation({ priest, users: passedUsers = null, onOpenWhatsApp }) {
  const todayISO = new Date().toLocaleDateString('en-CA');
  const [savedRecords, setSavedRecords] = useState([]);
  const [churchUsers, setChurchUsers] = useState(Array.isArray(passedUsers) ? passedUsers : []);
  const [loading, setLoading] = useState(true);
  const [clearingAll, setClearingAll] = useState(false);

  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedRoleByCandidate, setSelectedRoleByCandidate] = useState({});
  const [editingRelationKey, setEditingRelationKey] = useState(null);
  const [editingRelationRole, setEditingRelationRole] = useState('الابن');

  const [expandedCards, setExpandedCards] = useState({});

  const [showForm, setShowForm] = useState(false);
  const [editingSavedId, setEditingSavedId] = useState(null);
  const [form, setForm] = useState(emptyFamilyForm);
  const [memberFilterQ, setMemberFilterQ] = useState('');
  const [selectedMemberDbUserId, setSelectedMemberDbUserId] = useState('');
  const [memberRoleChoice, setMemberRoleChoice] = useState('الابن');
  const [saving, setSaving] = useState(false);

  const [selectedFamily, setSelectedFamily] = useState(null);
  const [visitDraft, setVisitDraft] = useState(emptyVisitDraft(todayISO));
  const [userLookupQ, setUserLookupQ] = useState('');

  const [linkModalFam, setLinkModalFam] = useState(null);
  const [linkSearchQ, setLinkSearchQ] = useState('');
  const [linkRoleChoice, setLinkRoleChoice] = useState('الابن');
  const [linkBusy, setLinkBusy] = useState(false);

  const toggleCardExpand = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (Array.isArray(passedUsers) && passedUsers.length > 0) {
      setChurchUsers(passedUsers);
    }
  }, [passedUsers]);

  const loadData = async () => {
    setLoading(true);
    try {
      const famQuery = priest?.id
        ? supabase
            .from('priest_family_visitations')
            .select('*')
            .eq('priest_id', priest.id)
            .order('updated_at', { ascending: false })
        : supabase
            .from('priest_family_visitations')
            .select('*')
            .order('updated_at', { ascending: false });

      const [famRes, usrRes] = await Promise.all([
        famQuery,
        supabase
          .from('church_users')
          .select('*')
          .order('full_name', { ascending: true })
      ]);
      if (!famRes.error && famRes.data) setSavedRecords(famRes.data);
      if (!usrRes.error && usrRes.data && usrRes.data.length > 0) {
        setChurchUsers(usrRes.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [priest?.id]);

  const familiesList = useMemo(() => {
    return (savedRecords || []).map(sr => {
      const husbandRelatives = Array.isArray(sr.husband?.relatives) ? sr.husband.relatives : [];
      const topRelatives = Array.isArray(sr.relatives) ? sr.relatives : [];
      const combinedRelatives = [...topRelatives];
      husbandRelatives.forEach(hr => {
        if (!combinedRelatives.some(cr => cr.user_id && cr.user_id === hr.user_id)) {
          combinedRelatives.push(hr);
        }
      });

      const linkedUserIds = [
        sr.husband?.user_id,
        sr.wife?.user_id,
        sr.father?.user_id,
        sr.mother?.user_id,
        ...(Array.isArray(sr.children) ? sr.children.map(c => c.user_id) : []),
        ...combinedRelatives.map(r => r.user_id)
      ].filter(Boolean);

      return {
        ...sr,
        savedId: sr.id,
        family_title: sr.family_title || sr.family_name || 'أسرة بدون عنوان',
        family_status: sr.family_status || 'مستقرة',
        housing_type: sr.housing_type || 'تمليك',
        husband: { ...emptyPerson('متزوج'), ...(sr.husband || {}) },
        wife: { ...emptyPerson('متزوجة'), ...(sr.wife || {}) },
        father: { ...emptyPerson('متزوج'), ...(sr.father || {}) },
        mother: { ...emptyPerson('متزوجة'), ...(sr.mother || {}) },
        children: Array.isArray(sr.children) ? sr.children : [],
        relatives: combinedRelatives,
        linkedUserIds,
        visitations_log: Array.isArray(sr.visitations_log) ? sr.visitations_log : []
      };
    });
  }, [savedRecords]);

  const handleClearAllFamilies = async () => {
    const ok1 = confirm(
      '⚠️ سيتم مسح كل الأسر المعروضة حالياً من افتقاد الأسر لتبدأ أنت بإضافتها وربط صلاتها بنفسك (الأب، الابن، الزوج، إلخ). هل تريد المتابعة؟'
    );
    if (!ok1) return;

    const ok2 = confirm('تأكيد نهائي: مسح كل الأسر الحالية الآن وبدء صفحة فارغة تماماً؟');
    if (!ok2) return;

    setClearingAll(true);
    try {
      if (priest?.id) {
        await supabase
          .from('priest_family_visitations')
          .delete()
          .eq('priest_id', priest.id);
      } else {
        await supabase
          .from('priest_family_visitations')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
      }

      logActivity({
        user: priest,
        actionType: 'مسح_أسر_الافتقاد_للبدء_اليدوي',
        targetTable: 'priest_family_visitations',
        targetId: priest?.id || null,
        description: 'تم مسح الأسر الحالية ليقوم المستخدم بإضافتها وربط صلاتها يدوياً'
      });

      setSavedRecords([]);
      setSelectedFamily(null);
      setExpandedCards({});
      alert('تم مسح الأسر بنجاح ✅ يمكنك الآن الضغط على (+ إضافة أسرة) وإضافة من تريد وربط صلته.');
    } finally {
      setClearingAll(false);
    }
  };

  const upsertFamilyVisitationRecord = async (fam, extraPatch = {}) => {
    if (!fam) return null;
    const husbandPayload = {
      ...(fam.husband || emptyPerson('متزوج')),
      relatives: fam.relatives || []
    };
    const basePayload = {
      ...(priest?.id ? { priest_id: priest.id } : {}),
      family_title: fam.family_title || 'أسرة بدون عنوان',
      family_name: fam.family_title || 'أسرة بدون عنوان',
      address: fam.address || '',
      housing_type: fam.housing_type || 'تمليك',
      family_status: fam.family_status || 'مستقرة',
      phone: fam.phone || fam.husband?.phone || fam.wife?.phone || '',
      next_visit_date: fam.next_visit_date || null,
      notes: fam.notes || '',
      husband: husbandPayload,
      wife: fam.wife || emptyPerson('متزوجة'),
      father: fam.father || emptyPerson('متزوج'),
      mother: fam.mother || emptyPerson('متزوجة'),
      children: fam.children || [],
      visitations_log: fam.visitations_log || [],
      updated_at: new Date().toISOString(),
      ...extraPatch
    };

    if (fam.savedId) {
      const { data } = await supabase
        .from('priest_family_visitations')
        .update(basePayload)
        .eq('id', fam.savedId)
        .select()
        .single();
      return data || null;
    }

    const { data } = await supabase
      .from('priest_family_visitations')
      .insert([basePayload])
      .select()
      .single();
    return data || null;
  };

  const handleLinkPersonToFamily = async (fam, targetUser, kinshipLabel = 'الابن') => {
    if (!fam || !targetUser) return;
    setLinkBusy(true);
    try {
      const targetName = getDisplayQuadName(targetUser);
      const primaryUserId = fam.husband?.user_id || fam.wife?.user_id || fam.father?.user_id || fam.mother?.user_id;
      const primaryUser = churchUsers.find(u => u.id === primaryUserId);

      const nextChildren = [...(fam.children || [])];
      const nextRelatives = [...(fam.relatives || [])];

      if (['الابن', 'الابنة', 'الحفيد', 'الحفيدة'].includes(kinshipLabel)) {
        if (!nextChildren.some(c => c.user_id && c.user_id === targetUser.id)) {
          nextChildren.push({
            ...toPersonObjectFromUser(targetUser, 'أعزب'),
            kinship_role: kinshipLabel
          });
        }
      } else {
        const filteredRel = nextRelatives.filter(r => r.user_id !== targetUser.id);
        filteredRel.push({
          user_id: targetUser.id,
          full_name: targetName,
          kinship_role: kinshipLabel,
          phone: targetUser.phone || ''
        });
        nextRelatives.splice(0, nextRelatives.length, ...filteredRel);
      }

      if (primaryUser) {
        const primaryName = getDisplayQuadName(primaryUser);
        const pList = Array.isArray(primaryUser.permissions?.extended_relatives)
          ? primaryUser.permissions.extended_relatives
          : [];
        await safeUpdateChurchUser(primaryUser.id, {
          permissions: {
            ...(primaryUser.permissions || {}),
            extended_relatives: [
              ...pList.filter(r => r.user_id !== targetUser.id),
              {
                user_id: targetUser.id,
                full_name: targetName,
                kinship_role: kinshipLabel,
                phone: targetUser.phone || ''
              }
            ]
          }
        });

        const tList = Array.isArray(targetUser.permissions?.extended_relatives)
          ? targetUser.permissions.extended_relatives
          : [];
        const revRole = REVERSE_KINSHIP_MAP[kinshipLabel] || `قريب (${primaryName})`;
        await safeUpdateChurchUser(targetUser.id, {
          permissions: {
            ...(targetUser.permissions || {}),
            extended_relatives: [
              ...tList.filter(r => r.user_id !== primaryUser.id),
              {
                user_id: primaryUser.id,
                full_name: primaryName,
                kinship_role: revRole,
                phone: primaryUser.phone || ''
              }
            ]
          }
        });
      }

      const updatedFamObj = {
        ...fam,
        children: nextChildren,
        relatives: nextRelatives
      };

      const saved = await upsertFamilyVisitationRecord(updatedFamObj);
      await loadData();
      if (saved && selectedFamily?.savedId === fam.savedId) {
        setSelectedFamily({ ...updatedFamObj, ...saved, savedId: saved.id });
      }
      setLinkModalFam(null);
      setLinkSearchQ('');
      alert(`تم ربط (${targetName}) بصفة (${kinshipLabel}) مع (${fam.family_title}) وحفظه ✅`);
    } finally {
      setLinkBusy(false);
    }
  };

  const handleUpdateRelationRole = async (fam, relItem, nextRole) => {
    if (!fam || !relItem) return;
    const nextRelatives = (fam.relatives || []).map(r =>
      r.user_id === relItem.user_id && r.full_name === relItem.full_name
        ? { ...r, kinship_role: nextRole }
        : r
    );
    const updatedFam = { ...fam, relatives: nextRelatives };
    await upsertFamilyVisitationRecord(updatedFam);
    await loadData();
    setEditingRelationKey(null);
  };

  const handleRemoveRelationItem = async (fam, relItem) => {
    if (!fam || !relItem) return;
    if (!confirm(`إزالة (${relItem.full_name}) من صلات هذه الأسرة؟`)) return;
    const nextRelatives = (fam.relatives || []).filter(
      r => !(r.user_id && relItem.user_id ? r.user_id === relItem.user_id : r.full_name === relItem.full_name)
    );
    const updatedFam = { ...fam, relatives: nextRelatives };
    await upsertFamilyVisitationRecord(updatedFam);
    await loadData();
    setEditingRelationKey(null);
  };

  const handleRemoveChildFromForm = (idx) => {
    setForm(prev => ({
      ...prev,
      children: (prev.children || []).filter((_, i) => i !== idx)
    }));
  };

  const handleRemoveRelativeFromForm = (idx) => {
    setForm(prev => ({
      ...prev,
      relatives: (prev.relatives || []).filter((_, i) => i !== idx)
    }));
  };

  const handleAddMemberWithRole = () => {
    if (!selectedMemberDbUserId) return;
    const dbUser = (Array.isArray(churchUsers) ? churchUsers : []).find(
      u => String(u.id) === String(selectedMemberDbUserId)
    );
    if (!dbUser) return;

    const displayName = getDisplayQuadName(dbUser) || dbUser.full_name || 'بدون اسم';
    const isDirectChildRole = ['الابن', 'الابنة', 'الحفيد', 'الحفيدة'].includes(memberRoleChoice);

    if (isDirectChildRole) {
      const childObj = {
        ...toPersonObjectFromUser(dbUser, 'أعزب'),
        full_name: displayName,
        kinship_role: memberRoleChoice
      };
      setForm(prev => ({
        ...prev,
        children: [...(prev.children || []), childObj]
      }));
    } else {
      const relObj = {
        user_id: dbUser.id,
        full_name: displayName,
        kinship_role: memberRoleChoice,
        phone: dbUser.phone || ''
      };
      setForm(prev => ({
        ...prev,
        relatives: [...(prev.relatives || []), relObj]
      }));
    }

    setSelectedMemberDbUserId('');
  };

  const handleSaveFamily = async (e) => {
    e.preventDefault();
    const derivedTitle =
      form.family_title.trim() ||
      (form.husband?.full_name ? `أسرة ${form.husband.full_name}` : '') ||
      (form.wife?.full_name ? `أسرة ${form.wife.full_name}` : '') ||
      (form.father?.full_name ? `أسرة ${form.father.full_name}` : '');

    if (!derivedTitle) {
      return alert('يرجى اختيار فرد من الداتابيز أو كتابة اسم الأسرة أولاً.');
    }

    setSaving(true);
    try {
      const husbandPayload = {
        ...(form.husband || emptyPerson('متزوج')),
        relatives: form.relatives || []
      };

      const payload = {
        ...(priest?.id ? { priest_id: priest.id } : {}),
        family_title: derivedTitle,
        family_name: derivedTitle,
        address: (form.address || '').trim(),
        housing_type: form.housing_type || 'تمليك',
        family_status: form.family_status || 'مستقرة',
        phone: (form.phone || form.husband?.phone || form.wife?.phone || '').trim(),
        next_visit_date: form.next_visit_date || null,
        notes: (form.notes || '').trim(),
        husband: husbandPayload,
        wife: form.wife,
        father: form.father,
        mother: form.mother,
        children: form.children || [],
        visitations_log: form.visitations_log || [],
        updated_at: new Date().toISOString()
      };

      if (editingSavedId) {
        const { data, error } = await supabase
          .from('priest_family_visitations')
          .update(payload)
          .eq('id', editingSavedId)
          .select()
          .single();
        if (error) return alert('تعذر التعديل: ' + error.message);
        if (data) {
          logActivity({
            user: priest,
            actionType: 'تعديل_ملف_افتقاد_أسرة',
            targetTable: 'priest_family_visitations',
            targetId: data.id,
            description: `عدل ملف الأسرة: ${data.family_title}`
          });
        }
      } else {
        const { data, error } = await supabase
          .from('priest_family_visitations')
          .insert([payload])
          .select()
          .single();
        if (error) return alert('تعذر الحفظ: ' + error.message);
        if (data) {
          logActivity({
            user: priest,
            actionType: 'إضافة_ملف_افتقاد_أسرة',
            targetTable: 'priest_family_visitations',
            targetId: data.id,
            description: `أضاف ملف الأسرة: ${data.family_title}`
          });
        }
      }

      await loadData();
      setShowForm(false);
      setEditingSavedId(null);
      setForm(emptyFamilyForm);
      alert('تم حفظ الأسرة وروابطها بنجاح ✅');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSingleFamily = async (fam) => {
    if (!fam.savedId) return;
    if (!confirm(`حذف أسرة (${fam.family_title}) من افتقاد الأسر؟`)) return;
    const { error } = await supabase
      .from('priest_family_visitations')
      .delete()
      .eq('id', fam.savedId);
    if (!error) {
      setSavedRecords(prev => prev.filter(r => r.id !== fam.savedId));
      if (selectedFamily?.savedId === fam.savedId) setSelectedFamily(null);
    }
  };

  const handleAddVisitLog = async (e) => {
    e.preventDefault();
    if (!selectedFamily || !visitDraft.summary.trim()) return;
    const nextLog = [
      {
        id: `vis-${Date.now()}`,
        visit_date: visitDraft.visit_date || todayISO,
        method: visitDraft.method,
        visitor_name: visitDraft.visitor_name.trim() || priest?.full_name || 'الأب الكاهن',
        summary: visitDraft.summary.trim(),
        needs: visitDraft.needs.trim()
      },
      ...(Array.isArray(selectedFamily.visitations_log) ? selectedFamily.visitations_log : [])
    ];

    const data = await upsertFamilyVisitationRecord(selectedFamily, { visitations_log: nextLog });
    if (data) {
      await loadData();
      setSelectedFamily({ ...selectedFamily, ...data, savedId: data.id });
      setVisitDraft(emptyVisitDraft(todayISO));
    }
  };

  const openEditFamily = (fam) => {
    setEditingSavedId(fam.savedId || null);
    setForm({
      ...emptyFamilyForm,
      family_title: fam.family_title || '',
      address: fam.address || '',
      housing_type: fam.housing_type || 'تمليك',
      family_status: fam.family_status || 'مستقرة',
      phone: fam.phone || '',
      next_visit_date: fam.next_visit_date || '',
      notes: fam.notes || '',
      husband: { ...emptyPerson('متزوج'), ...(fam.husband || {}) },
      wife: { ...emptyPerson('متزوجة'), ...(fam.wife || {}) },
      father: { ...emptyPerson('متزوج'), ...(fam.father || {}) },
      mother: { ...emptyPerson('متزوجة'), ...(fam.mother || {}) },
      children: Array.isArray(fam.children) ? fam.children : [],
      relatives: Array.isArray(fam.relatives) ? fam.relatives : [],
      visitations_log: Array.isArray(fam.visitations_log) ? fam.visitations_log : []
    });
    setShowForm(true);
  };

  const importFromChurchUser = (u, roleKey) => {
    const uAddr = extractUserAddress(u);
    const patch = {
      user_id: u.id,
      full_name: getDisplayQuadName(u),
      dob: u.dob || '',
      marital_status: u.marital_status || (roleKey === 'wife' || roleKey === 'mother' ? 'متزوجة' : 'متزوج'),
      study_status: u.detailed_stage || u.service_stage || '',
      job_title: u.job_title || '',
      phone: u.phone || '',
      address: uAddr,
      is_alive: true
    };
    setForm(prev => ({
      ...prev,
      family_title: prev.family_title || `أسرة ${getDisplayQuadName(u)}`,
      address: prev.address || uAddr || '',
      housing_type: prev.housing_type || u.housing_type || 'تمليك',
      phone: prev.phone || u.phone || '',
      [roleKey]: { ...prev[roleKey], ...patch }
    }));
    setUserLookupQ('');
  };

  const handleExportExcelSheet = () => {
    const headers = [
      'م',
      'اسم الأسرة',
      'بيانات الزوج',
      'الزوجة',
      'الوالد / الوالدة',
      'الأبناء والصلات',
      'العنوان والمنطقة',
      'السكن',
      'الحالة الأسرية',
      'عدد الزيارات',
      'ملاحظات / آخر زيارة'
    ];

    const escapeCsv = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

    const rows = filteredRecords.map((fam, index) => {
      const hInfo = fam.husband?.full_name
        ? `${fam.husband.full_name} (${calcAge(fam.husband.dob)} - ${fam.husband.job_title || '—'} - ${fam.husband.phone || '—'})`
        : '—';
      const wInfo = fam.wife?.full_name
        ? `${fam.wife.full_name} (${calcAge(fam.wife.dob)} - ${fam.wife.phone || '—'})`
        : '—';
      const parentsInfo = [
        fam.father?.full_name ? `الوالد: ${fam.father.full_name}` : '',
        fam.mother?.full_name ? `الوالدة: ${fam.mother.full_name}` : ''
      ].filter(Boolean).join(' | ') || '—';

      const kidsPart = Array.isArray(fam.children) && fam.children.length > 0
        ? fam.children.map(k => `${k.kinship_role || 'ابن'}: ${k.full_name} (${calcAge(k.dob)})`).join(' ، ')
        : '';
      const relPart = Array.isArray(fam.relatives) && fam.relatives.length > 0
        ? fam.relatives.map(r => `${r.kinship_role}: ${r.full_name}`).join(' ، ')
        : '';
      const kidsAndRelInfo = [kidsPart, relPart].filter(Boolean).join(' | ') || '—';

      const addr = fam.address || fam.husband?.address || fam.wife?.address || 'غير مسجل';
      const visits = Array.isArray(fam.visitations_log) ? fam.visitations_log : [];
      const lastVisit = visits[0] ? `${visits[0].visit_date}: ${visits[0].summary}` : fam.notes || '—';

      return [
        index + 1,
        fam.family_title,
        hInfo,
        wInfo,
        parentsInfo,
        kidsAndRelInfo,
        addr,
        fam.housing_type || 'تمليك',
        fam.family_status || 'مستقرة',
        visits.length,
        lastVisit
      ].map(escapeCsv).join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `كشف_افتقاد_الأسر_${todayISO}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredRecords = useMemo(() => {
    return familiesList.filter(r => {
      if (statusFilter !== 'all' && r.family_status !== statusFilter) return false;
      if (!searchQ.trim()) return true;
      return normalizeArabic(JSON.stringify(r)).includes(normalizeArabic(searchQ));
    });
  }, [familiesList, statusFilter, searchQ]);

  const allUsersList = useMemo(
    () => (Array.isArray(churchUsers) ? churchUsers : []),
    [churchUsers]
  );

  const dbMembersPool = useMemo(() => {
    const q = normalizeArabic(memberFilterQ);
    if (!q) return allUsersList;
    return allUsersList.filter(u => {
      const searchable = [
        getDisplayQuadName(u),
        u.full_name,
        u.first_name,
        u.second_name,
        u.third_name,
        u.fourth_name,
        u.phone
      ]
        .filter(Boolean)
        .join(' ');
      return normalizeArabic(searchable).includes(q);
    });
  }, [allUsersList, memberFilterQ]);

  const matchedLookupUsers = useMemo(() => {
    const q = normalizeArabic(userLookupQ);
    if (q.length < 2) return [];
    return allUsersList
      .filter(u => normalizeArabic((getDisplayQuadName(u) || '') + ' ' + (u.phone || '')).includes(q))
      .slice(0, 10);
  }, [userLookupQ, allUsersList]);

  const linkModalCandidates = useMemo(() => {
    if (!linkModalFam) return [];
    const excludeIds = new Set(linkModalFam.linkedUserIds || []);
    const q = normalizeArabic(linkSearchQ);
    return allUsersList
      .filter(u => {
        if (excludeIds.has(u.id)) return false;
        if (!q) return true;
        return normalizeArabic((getDisplayQuadName(u) || '') + ' ' + (u.phone || '')).includes(q);
      })
      .slice(0, 15);
  }, [linkModalFam, linkSearchQ, allUsersList]);

  const renderPersonSection = (title, roleKey, allowAliveToggle = false) => {
    const p = form[roleKey] || emptyPerson();
    const setP = (patch) => setForm(prev => ({ ...prev, [roleKey]: { ...prev[roleKey], ...patch } }));
    const isLinkedToDb = Boolean(p.user_id);

    return (
      <div className="bg-[#fbfaf7] p-3.5 rounded-2xl border border-gray-200 space-y-2.5">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <strong className="text-xs font-black text-[#7a1c24]">{title}</strong>
            {isLinkedToDb ? (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-950 rounded text-[10px] font-black inline-flex items-center gap-1">
                <ShieldCheck size={11} /> مربوط بالداتابيز
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-950 rounded text-[10px] font-black inline-flex items-center gap-1">
                <AlertCircle size={11} /> يمكنك الاختيار من الداتابيز أو التعديل بحرية
              </span>
            )}
          </div>
          {allowAliveToggle && (
            <label className="flex items-center gap-1.5 text-[11px] font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={p.is_alive !== false}
                onChange={e => setP({ is_alive: e.target.checked })}
              />
              <span>{p.is_alive !== false ? 'على قيد الحياة' : 'متنيح / منتقلة 🕊️'}</span>
            </label>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <input
            placeholder="الاسم الرباعي بالكامل"
            className="p-2 border rounded-xl bg-white text-gray-900 font-bold"
            value={p.full_name || ''}
            onChange={e => setP({ full_name: e.target.value })}
          />
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">تاريخ الميلاد</label>
            <input
              type="date"
              className="w-full p-2 border rounded-xl bg-white"
              value={p.dob || ''}
              onChange={e => setP({ dob: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">الحالة الاجتماعية</label>
            <select
              className="w-full p-2 border rounded-xl bg-white"
              value={p.marital_status || ''}
              onChange={e => setP({ marital_status: e.target.value })}
            >
              {MARITAL_STATUS_OPTIONS.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
          <input
            placeholder="الحالة الدراسية / المؤهل"
            className="p-2 border rounded-xl bg-white"
            value={p.study_status || ''}
            onChange={e => setP({ study_status: e.target.value })}
          />
          <input
            placeholder="الوظيفة / العمل"
            className="p-2 border rounded-xl bg-white"
            value={p.job_title || ''}
            onChange={e => setP({ job_title: e.target.value })}
          />
          <input
            type="tel"
            placeholder="رقم التليفون"
            className="p-2 border rounded-xl bg-white"
            value={p.phone || ''}
            onChange={e => setP({ phone: e.target.value })}
          />
        </div>
      </div>
    );
  };

  const renderPersonCard = (label, person, emoji) => {
    if (!person || !person.full_name) return null;

    return (
      <div className="p-3 bg-[#fbfaf7] border border-gray-200 rounded-2xl space-y-1 text-xs">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <strong className="text-[#7a1c24]">{emoji} {label}: {person.full_name}</strong>
          <div className="flex items-center gap-1">
            {person.user_id && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded text-[9px] font-black">حساب كنيسة ✓</span>
            )}
            {person.is_alive === false && (
              <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px] font-black">متنيح 🕊️</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-700">
          {person.dob && <span>🎂 {person.dob} ({calcAge(person.dob)})</span>}
          {person.marital_status && <span>💍 {person.marital_status}</span>}
          {person.study_status && <span className="inline-flex items-center gap-1"><GraduationCap size={12} /> {person.study_status}</span>}
          {person.job_title && <span className="inline-flex items-center gap-1"><Briefcase size={12} /> {person.job_title}</span>}
          {person.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {person.phone}</span>}
          {person.address && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {person.address}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 text-xs" dir="rtl">
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }
          body {
            background: white !important;
          }
        }
      `}</style>

      <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-2xs flex flex-wrap justify-between items-center gap-3 print:hidden">
        <div>
          <h3 className="text-sm sm:text-base font-black text-[#7a1c24] flex items-center gap-1.5">
            <Users size={18} /> سجل افتقاد الأسر ({filteredRecords.length} أسرة)
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            أضف الأسرة واربط كل شخص وحدّد صلته (الأب، الابن، الزوج، الأخ...) بنفسك بحرية كاملة دون أي فرض تلقائي.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={clearingAll}
            onClick={handleClearAllFamilies}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 rounded-xl font-black flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={14} /> {clearingAll ? 'جاري المسح...' : 'مسح الأسر والبدء من جديد'}
          </button>
          <button
            type="button"
            onClick={loadData}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-black flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={14} /> تحديث
          </button>
          <button
            type="button"
            onClick={handleExportExcelSheet}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet size={14} /> تصدير شيت إكسيل
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={14} /> طباعة شيت الافتقاد بالعرض
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingSavedId(null);
              setForm(emptyFamilyForm);
              setMemberFilterQ('');
              setSelectedMemberDbUserId('');
              setShowForm(true);
            }}
            className="px-4 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} /> إضافة أسرة
          </button>
        </div>
      </div>

      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 flex flex-col sm:flex-row gap-2.5 print:hidden">
        <div className="relative flex-1">
          <Search size={15} className="absolute right-3 top-2.5 text-gray-400" />
          <input
            placeholder="بحث بالاسم، الصلة، الأبناء، أو العنوان..."
            className="w-full pr-9 pl-3 py-2 bg-[#fbfaf7] border rounded-xl outline-none focus:border-[#7a1c24]"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>
        {searchQ && (
          <button
            type="button"
            onClick={() => setSearchQ('')}
            className="px-3 py-2 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl font-black cursor-pointer"
          >
            مسح الفلتر ✕
          </button>
        )}
        <select
          className="p-2 border rounded-xl bg-[#fbfaf7] font-bold"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">كل الحالات الأسرية ({familiesList.length})</option>
          {FAMILY_STATUS_OPTIONS.map(st => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </div>

      <div className="print:hidden">
        {loading ? (
          <div className="bg-white p-8 rounded-3xl border text-center text-gray-500 font-bold">جاري تحميل السجل...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-dashed text-center space-y-2">
            <p className="text-gray-600 font-black">لا توجد أسر مضافة حالياً في سجل الافتقاد.</p>
            <p className="text-gray-400 text-[11px]">اضغط على زر «+ إضافة أسرة» لإضافة أسرة وتحديد صلة كل فرد فيها بنفسك.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredRecords.map(fam => {
              const isExpanded = Boolean(expandedCards[fam.id]);
              const kids = Array.isArray(fam.children) ? fam.children : [];
              const rels = Array.isArray(fam.relatives) ? fam.relatives : [];
              const visits = Array.isArray(fam.visitations_log) ? fam.visitations_log : [];
              const primaryPhone = fam.phone || fam.husband?.phone || fam.wife?.phone || '';
              const displayAddress = fam.address || fam.husband?.address || fam.wife?.address || 'غير مسجل';

              return (
                <div
                  key={fam.id}
                  className={`bg-white rounded-2xl border transition-all ${
                    isExpanded
                      ? 'md:col-span-2 lg:col-span-3 border-[#7a1c24] shadow-md p-4 space-y-3'
                      : 'border-gray-200 hover:border-[#7a1c24]/50 shadow-2xs p-3 space-y-2'
                  }`}
                >
                  <div
                    onClick={() => toggleCardExpand(fam.id)}
                    className="flex items-center justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1 mb-1">
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-950 rounded text-[9px] font-black">
                          {fam.family_status}
                        </span>
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-900 rounded text-[9px] font-bold">
                          🕊️ {visits.length}
                        </span>
                        {(kids.length + rels.length) > 0 && (
                          <span className="px-1.5 py-0.5 bg-sky-100 text-sky-950 rounded text-[9px] font-black">
                            <UserCheck size={10} className="inline ml-0.5" /> {kids.length + rels.length} صلة
                          </span>
                        )}
                      </div>

                      <strong className="text-xs sm:text-sm text-[#7a1c24] block truncate">
                        {fam.family_title}
                      </strong>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-gray-600 mt-0.5">
                        <span className="inline-flex items-center gap-1 truncate max-w-full">
                          <MapPin size={11} className="text-[#7a1c24] shrink-0" /> {displayAddress}
                        </span>
                        {primaryPhone && (
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <Phone size={11} /> {primaryPhone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="p-1.5 bg-gray-100 rounded-xl text-gray-700">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pt-3 border-t border-gray-100 space-y-3">
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded-lg text-[10px] font-bold">
                          🏠 {fam.housing_type || 'تمليك'}
                        </span>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {primaryPhone && onOpenWhatsApp && (
                            <button
                              type="button"
                              onClick={() => onOpenWhatsApp({ name: fam.family_title, phone: primaryPhone, defaultCategory: 'افتقاد' })}
                              className="p-2 bg-green-600 text-white rounded-xl cursor-pointer"
                              title="إرسال واتساب"
                            >
                              <MessageCircle size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setLinkModalFam(fam);
                              setLinkSearchQ('');
                              setLinkRoleChoice('الابن');
                            }}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 rounded-xl font-black inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Link2 size={13} /> ربط شخص وتحديد صلته
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedFamily(fam)}
                            className="px-3 py-1.5 bg-[#f9ecee] hover:bg-[#f2dce0] text-[#7a1c24] rounded-xl font-black cursor-pointer"
                          >
                            سجل الزيارات ({visits.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditFamily(fam)}
                            className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl font-black inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 size={13} /> تعديل
                          </button>
                          {fam.savedId && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSingleFamily(fam)}
                              className="p-2 bg-red-50 text-red-700 rounded-xl cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {rels.length > 0 && (
                        <div className="bg-emerald-50/70 p-2.5 rounded-2xl border border-emerald-200 space-y-1.5">
                          <strong className="text-[10px] text-emerald-950 block">
                            ✅ الصلات المرتبطة ({rels.length}):
                          </strong>
                          <div className="flex flex-wrap gap-1.5">
                            {rels.map((rel, idx) => {
                              const relKey = `${fam.id}:${rel.user_id || idx}`;
                              const isEditingThis = editingRelationKey === relKey;

                              return (
                                <div
                                  key={relKey}
                                  className="px-2.5 py-1 bg-white text-emerald-950 border border-emerald-200 rounded-xl text-[10px] font-black flex flex-wrap items-center gap-1.5"
                                >
                                  {isEditingThis ? (
                                    <>
                                      <span>{rel.full_name}:</span>
                                      <select
                                        className="p-0.5 border rounded bg-[#fbfaf7] text-[10px] font-black"
                                        value={editingRelationRole}
                                        onChange={e => setEditingRelationRole(e.target.value)}
                                      >
                                        {KINSHIP_ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateRelationRole(fam, rel, editingRelationRole)}
                                        className="px-1.5 py-0.5 bg-emerald-700 text-white rounded cursor-pointer"
                                      >
                                        حفظ
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingRelationKey(null)}
                                        className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded cursor-pointer"
                                      >
                                        إلغاء
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <span>
                                        {rel.kinship_role}: {rel.full_name} {rel.phone ? `• 📞 ${rel.phone}` : ''}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingRelationKey(relKey);
                                          setEditingRelationRole(rel.kinship_role || 'الابن');
                                        }}
                                        className="px-1.5 py-0.5 bg-amber-100 text-amber-950 rounded text-[9px] cursor-pointer"
                                      >
                                        تعديل الصلة
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveRelationItem(fam, rel)}
                                        className="px-1.5 py-0.5 bg-rose-100 text-rose-900 rounded text-[9px] cursor-pointer"
                                      >
                                        حذف
                                      </button>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="grid sm:grid-cols-2 gap-2">
                        {renderPersonCard('الزوج', fam.husband, '👨')}
                        {renderPersonCard('الزوجة', fam.wife, '👩')}
                        {renderPersonCard('الوالد', fam.father, '👴')}
                        {renderPersonCard('الوالدة', fam.mother, '👵')}
                      </div>

                      {kids.length > 0 && (
                        <div className="bg-blue-50/40 p-3 rounded-2xl border border-blue-200 space-y-1.5">
                          <strong className="text-[11px] text-blue-950 block">👶 الأبناء / الأفراد المرتبطون ({kids.length}):</strong>
                          <div className="grid sm:grid-cols-2 gap-1.5">
                            {kids.map((k, idx) => (
                              <div key={idx} className="bg-white p-2 rounded-xl border text-[11px] flex flex-wrap gap-x-3 gap-y-0.5 items-center">
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-950 rounded text-[9px] font-black">
                                  {k.kinship_role || 'الابن'}
                                </span>
                                <strong className="text-gray-900">{k.full_name}</strong>
                                {k.user_id && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-900 rounded text-[9px] font-black">حساب كنيسة ✓</span>}
                                {k.dob && <span>🎂 {k.dob} ({calcAge(k.dob)})</span>}
                                {k.study_status && <span>🎓 {k.study_status}</span>}
                                {k.job_title && <span>💼 {k.job_title}</span>}
                                {k.phone && <span>📞 {k.phone}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {fam.notes && (
                        <p className="text-[11px] text-gray-700 bg-[#fbfaf7] p-2.5 rounded-xl border">
                          📝 {fam.notes}
                        </p>
                      )}

                      {fam.next_visit_date && (
                        <p className="text-[11px] font-bold text-amber-900 bg-amber-50 px-3 py-1.5 rounded-xl inline-flex items-center gap-1">
                          <Calendar size={12} /> ميعاد الافتقاد القادم: {fam.next_visit_date}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="hidden print:block w-full text-black" dir="rtl">
        <div className="text-center border-b-2 border-black pb-2 mb-3">
          <h2 className="text-base font-black">كشف افتقاد الأسر — {priest?.full_name || 'الأب الكاهن'}</h2>
          <p className="text-[11px]">
            تاريخ الطباعة: {todayISO} • إجمالي الأسر بالكشف: {filteredRecords.length} أسرة
          </p>
        </div>

        <table className="w-full border-collapse border border-black text-[10px]">
          <thead>
            <tr className="bg-gray-200 font-black">
              <th className="border border-black p-1.5 text-center w-8">م</th>
              <th className="border border-black p-1.5 text-right">الأسرة / الزوج</th>
              <th className="border border-black p-1.5 text-right">الزوجة</th>
              <th className="border border-black p-1.5 text-right">الوالد / الوالدة</th>
              <th className="border border-black p-1.5 text-right">الأبناء والصلات</th>
              <th className="border border-black p-1.5 text-right">العنوان والمنطقة والسكن</th>
              <th className="border border-black p-1.5 text-center">التليفون</th>
              <th className="border border-black p-1.5 text-center">الحالة</th>
              <th className="border border-black p-1.5 text-right">ملاحظات / آخر زيارة</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((fam, idx) => {
              const kids = Array.isArray(fam.children) ? fam.children : [];
              const rels = Array.isArray(fam.relatives) ? fam.relatives : [];
              const visits = Array.isArray(fam.visitations_log) ? fam.visitations_log : [];
              const addr = fam.address || fam.husband?.address || fam.wife?.address || '—';
              const primaryPhone = fam.phone || fam.husband?.phone || fam.wife?.phone || '—';

              return (
                <tr key={fam.id} className="break-inside-avoid">
                  <td className="border border-black p-1.5 text-center font-bold">{idx + 1}</td>
                  <td className="border border-black p-1.5 align-top">
                    <div className="font-black">{fam.family_title}</div>
                    {fam.husband?.full_name && <div>الزوج: {fam.husband.full_name}</div>}
                    {fam.husband?.job_title && <div>العمل: {fam.husband.job_title}</div>}
                  </td>
                  <td className="border border-black p-1.5 align-top">
                    {fam.wife?.full_name ? (
                      <>
                        <div className="font-bold">{fam.wife.full_name}</div>
                        {fam.wife.phone && <div>ت: {fam.wife.phone}</div>}
                      </>
                    ) : '—'}
                  </td>
                  <td className="border border-black p-1.5 align-top">
                    {fam.father?.full_name && <div>الوالد: {fam.father.full_name}</div>}
                    {fam.mother?.full_name && <div>الوالدة: {fam.mother.full_name}</div>}
                    {!fam.father?.full_name && !fam.mother?.full_name && '—'}
                  </td>
                  <td className="border border-black p-1.5 align-top">
                    {kids.map((k, kIdx) => (
                      <div key={`k-${kIdx}`}>• {k.kinship_role || 'الابن'}: {k.full_name}</div>
                    ))}
                    {rels.map((r, rIdx) => (
                      <div key={`r-${rIdx}`}>• {r.kinship_role}: {r.full_name}</div>
                    ))}
                    {kids.length === 0 && rels.length === 0 && '—'}
                  </td>
                  <td className="border border-black p-1.5 align-top">
                    <div className="font-bold">{addr}</div>
                    <div>({fam.housing_type || 'تمليك'})</div>
                  </td>
                  <td className="border border-black p-1.5 text-center align-top font-bold">{primaryPhone}</td>
                  <td className="border border-black p-1.5 text-center align-top">{fam.family_status || 'مستقرة'}</td>
                  <td className="border border-black p-1.5 align-top">
                    {visits[0] ? `${visits[0].visit_date}: ${visits[0].summary}` : fam.notes || ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {linkModalFam && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-55 print:hidden">
          <div className="bg-white rounded-3xl w-full max-w-xl p-5 sm:p-6 space-y-3 font-bold max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2.5">
              <div>
                <h3 className="text-sm sm:text-base font-black text-[#7a1c24]">
                  🔗 ربط شخص وتحديد صلته مع: {linkModalFam.family_title}
                </h3>
                <p className="text-[11px] text-gray-500 font-normal mt-0.5">
                  اختر الشخص من قاعدة البيانات وحدد صلته (الأب، الابن، الزوج، الأخ...) وسيتم حفظ الربط فوراً.
                </p>
              </div>
              <button type="button" onClick={() => setLinkModalFam(null)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 relative">
                <Search size={15} className="absolute right-3 top-2.5 text-gray-400" />
                <input
                  autoFocus
                  placeholder="ابحث في الداتابيز بالاسم أو الموبايل..."
                  className="w-full pr-9 pl-3 py-2 border rounded-xl bg-[#fbfaf7]"
                  value={linkSearchQ}
                  onChange={e => setLinkSearchQ(e.target.value)}
                />
              </div>
              <select
                className="p-2 border rounded-xl bg-amber-50 text-amber-950 font-black"
                value={linkRoleChoice}
                onChange={e => setLinkRoleChoice(e.target.value)}
              >
                {KINSHIP_ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {linkModalCandidates.length === 0 ? (
                <p className="text-center text-gray-400 py-4">لا توجد نتائج مطابقة في قاعدة البيانات.</p>
              ) : (
                linkModalCandidates.map(u => {
                  const rk = `modal:${u.id}`;
                  const chosenRole = selectedRoleByCandidate[rk] || linkRoleChoice;

                  return (
                    <div key={u.id} className="p-3 bg-[#fbfaf7] border rounded-2xl flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <strong className="text-gray-900">{getDisplayQuadName(u)}</strong>
                        <span className="text-[11px] text-gray-500 block mt-0.5">
                          {u.gender === 'أنثى' ? '♀️ أنثى' : '♂️ ذكر'} • 📞 {u.phone || '—'} {u.dob ? `• 🎂 ${u.dob}` : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <select
                          className="p-1.5 border rounded-xl bg-white text-[11px] font-black"
                          value={chosenRole}
                          onChange={e => setSelectedRoleByCandidate(prev => ({ ...prev, [rk]: e.target.value }))}
                        >
                          {KINSHIP_ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button
                          type="button"
                          disabled={linkBusy}
                          onClick={() => handleLinkPersonToFamily(linkModalFam, u, chosenRole)}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-[11px] font-black cursor-pointer"
                        >
                          ✅ تأكيد ({chosenRole})
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 print:hidden">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-5 sm:p-6 space-y-4 font-bold max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-sm sm:text-base font-black text-[#7a1c24]">
                {editingSavedId ? '✏️ تعديل ملف الأسرة' : '➕ إضافة أسرة جديدة وتحديد صلاتها'}
              </h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-200 space-y-2">
              <label className="text-[11px] text-blue-950 font-black block">
                🔍 استيراد سريع من قاعدة بيانات الكنيسة (اختياري):
              </label>
              <input
                placeholder="ابحث بالاسم أو الموبايل لاستيراد بياناته..."
                className="w-full p-2 border rounded-xl bg-white"
                value={userLookupQ}
                onChange={e => setUserLookupQ(e.target.value)}
              />
              {matchedLookupUsers.length > 0 && (
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {matchedLookupUsers.map(u => (
                    <div key={u.id} className="bg-white p-2 rounded-xl border flex flex-wrap justify-between items-center gap-2 text-[11px]">
                      <div>
                        <strong>{getDisplayQuadName(u)}</strong> ({u.phone || '—'})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <button type="button" onClick={() => importFromChurchUser(u, 'husband')} className="px-2 py-1 bg-blue-100 text-blue-900 rounded-lg cursor-pointer">كزوج</button>
                        <button type="button" onClick={() => importFromChurchUser(u, 'wife')} className="px-2 py-1 bg-pink-100 text-pink-900 rounded-lg cursor-pointer">كزوجة</button>
                        <button type="button" onClick={() => importFromChurchUser(u, 'father')} className="px-2 py-1 bg-amber-100 text-amber-900 rounded-lg cursor-pointer">كوالد</button>
                        <button type="button" onClick={() => importFromChurchUser(u, 'mother')} className="px-2 py-1 bg-purple-100 text-purple-900 rounded-lg cursor-pointer">كوالدة</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveFamily} className="space-y-4">
              <div className="bg-amber-50/40 p-3.5 rounded-2xl border border-amber-200 space-y-2.5">
                <strong className="text-xs font-black text-amber-950 flex items-center gap-1">
                  <Heart size={14} /> البيانات العامة والعنوان والحالة الأسرية
                </strong>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  <input
                    placeholder="اسم الأسرة (مثال: أسرة فلان)"
                    className="p-2 border rounded-xl bg-white text-gray-900 font-black"
                    value={form.family_title}
                    onChange={e => setForm({ ...form, family_title: e.target.value })}
                  />
                  <select
                    className="p-2 border rounded-xl bg-white"
                    value={form.family_status}
                    onChange={e => setForm({ ...form, family_status: e.target.value })}
                  >
                    {FAMILY_STATUS_OPTIONS.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <select
                    className="p-2 border rounded-xl bg-white"
                    value={form.housing_type}
                    onChange={e => setForm({ ...form, housing_type: e.target.value })}
                  >
                    <option value="تمليك">تمليك</option>
                    <option value="إيجار جديد">إيجار جديد</option>
                    <option value="إيجار قديم">إيجار قديم</option>
                    <option value="سكن عائلي مشترك">سكن عائلي مشترك</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    placeholder="العنوان السكني والمنطقة بالتفصيل"
                    className="sm:col-span-2 p-2 border rounded-xl bg-white"
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                  />
                  <input
                    type="date"
                    title="ميعاد الزيارة القادم"
                    className="p-2 border rounded-xl bg-white"
                    value={form.next_visit_date}
                    onChange={e => setForm({ ...form, next_visit_date: e.target.value })}
                  />
                </div>
              </div>

              {renderPersonSection('① بيانات الزوج', 'husband', false)}
              {renderPersonSection('② بيانات الزوجة', 'wife', false)}
              {renderPersonSection('③ بيانات الوالد (الأب)', 'father', true)}
              {renderPersonSection('④ بيانات الوالدة (الأم)', 'mother', true)}

              <div className="bg-[#fbfaf7] p-3.5 rounded-2xl border border-gray-200 space-y-2.5">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <strong className="text-xs font-black text-[#7a1c24]">
                    ⑤ إضافة فرد من الداتابيز وتحديد صلته (الابن، الأب، الأخ، الزوج...)
                  </strong>
                  <span className="text-[11px] text-gray-500 font-bold">
                    المتاح في الداتابيز: {dbMembersPool.length}
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="ابحث بالاسم أو رقم الموبايل..."
                    className="w-full p-2 pr-3 pl-8 border rounded-xl bg-white text-xs font-bold outline-none focus:border-[#7a1c24]"
                    value={memberFilterQ}
                    onChange={e => {
                      setMemberFilterQ(e.target.value);
                      setSelectedMemberDbUserId('');
                    }}
                  />
                  {memberFilterQ && (
                    <button
                      type="button"
                      onClick={() => {
                        setMemberFilterQ('');
                        setSelectedMemberDbUserId('');
                      }}
                      className="absolute left-2.5 top-2 text-gray-400 hover:text-gray-700 font-black cursor-pointer"
                      title="مسح البحث"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    className="sm:col-span-2 p-2 border rounded-xl bg-white font-bold text-xs outline-none focus:border-[#7a1c24]"
                    value={selectedMemberDbUserId}
                    onChange={e => setSelectedMemberDbUserId(e.target.value)}
                  >
                    <option value="">
                      {dbMembersPool.length > 0
                        ? '-- اختر شخصاً من قاعدة البيانات --'
                        : '-- لا توجد نتائج مطابقة --'}
                    </option>
                    {dbMembersPool.map(u => {
                      const name = getDisplayQuadName(u) || u.full_name || 'بدون اسم';
                      return (
                        <option key={u.id} value={u.id}>
                          {name} {u.phone ? `(${u.phone})` : ''}
                        </option>
                      );
                    })}
                  </select>

                  <select
                    className="p-2 border rounded-xl bg-amber-50 text-amber-950 font-black text-xs outline-none focus:border-amber-500"
                    value={memberRoleChoice}
                    onChange={e => setMemberRoleChoice(e.target.value)}
                  >
                    {KINSHIP_ROLE_OPTIONS.map(role => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  disabled={!selectedMemberDbUserId}
                  onClick={handleAddMemberWithRole}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition"
                >
                  <UserPlus size={13} /> + إضافة بالصلة ({memberRoleChoice})
                </button>

                {(form.children || []).length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {form.children.map((child, idx) => (
                      <div
                        key={`child-${child.user_id || idx}`}
                        className="bg-white p-2 rounded-xl border flex justify-between items-center gap-2 text-xs"
                      >
                        <div>
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-950 rounded text-[10px] font-black ml-1.5">
                            {child.kinship_role || 'الابن'}
                          </span>
                          <strong className="text-gray-900">{child.full_name}</strong>
                          {child.phone && <span className="text-gray-500 mr-2">📞 {child.phone}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveChildFromForm(idx)}
                          className="text-rose-700 hover:text-rose-900 font-black cursor-pointer"
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {(form.relatives || []).length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {form.relatives.map((rel, idx) => (
                      <div
                        key={`rel-${rel.user_id || idx}`}
                        className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-200 flex justify-between items-center gap-2 text-xs"
                      >
                        <div>
                          <span className="px-1.5 py-0.5 bg-emerald-700 text-white rounded text-[10px] font-black ml-1.5">
                            {rel.kinship_role}
                          </span>
                          <strong className="text-gray-900">{rel.full_name}</strong>
                          {rel.phone && <span className="text-gray-500 mr-2">📞 {rel.phone}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveRelativeFromForm(idx)}
                          className="text-rose-700 hover:text-rose-900 font-black cursor-pointer"
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <textarea
                rows={2}
                placeholder="ملاحظات عامة للأب الكاهن عن الأسرة..."
                className="w-full p-2.5 border rounded-xl bg-white font-normal"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-xl cursor-pointer">
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black cursor-pointer"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ الأسرة ✅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedFamily && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 print:hidden">
          <div className="bg-white rounded-3xl w-full max-w-3xl p-5 sm:p-6 space-y-4 font-bold max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-black text-[#7a1c24]">{selectedFamily.family_title}</h3>
                <p className="text-[11px] text-gray-500">
                  📍 العنوان: {selectedFamily.address || selectedFamily.husband?.address || selectedFamily.wife?.address || 'غير مسجل'} • 🏷️ {selectedFamily.family_status}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedFamily(null)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              {renderPersonCard('الزوج', selectedFamily.husband, '👨')}
              {renderPersonCard('الزوجة', selectedFamily.wife, '👩')}
              {renderPersonCard('الوالد', selectedFamily.father, '👴')}
              {renderPersonCard('الوالدة', selectedFamily.mother, '👵')}
            </div>

            {(selectedFamily.children || []).length > 0 && (
              <div className="bg-blue-50/40 p-3 rounded-2xl border border-blue-200 space-y-1.5">
                <strong className="text-xs text-blue-950 block">👶 الأبناء ({selectedFamily.children.length}):</strong>
                {selectedFamily.children.map((c, idx) => (
                  <div key={idx} className="bg-white p-2 rounded-xl border text-xs">
                    <strong>{c.kinship_role || 'الابن'}: {c.full_name}</strong> {c.dob ? `• 🎂 ${c.dob} (${calcAge(c.dob)})` : ''} {c.phone ? `• 📞 ${c.phone}` : ''}
                  </div>
                ))}
              </div>
            )}

            {(selectedFamily.relatives || []).length > 0 && (
              <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-200 space-y-1.5">
                <strong className="text-xs text-emerald-950 block">🔗 الصلات المرتبطة ({selectedFamily.relatives.length}):</strong>
                {selectedFamily.relatives.map((r, idx) => (
                  <div key={idx} className="bg-white p-2 rounded-xl border text-xs">
                    <strong>{r.kinship_role}: {r.full_name}</strong> {r.phone ? `• 📞 ${r.phone}` : ''}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddVisitLog} className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 space-y-2.5">
              <strong className="text-xs font-black text-amber-950 block">🕊️ تسجيل زيارة / افتقاد جديد للأسرة:</strong>
              <div className="grid sm:grid-cols-3 gap-2">
                <input
                  type="date"
                  className="p-2 border rounded-xl bg-white"
                  value={visitDraft.visit_date}
                  onChange={e => setVisitDraft({ ...visitDraft, visit_date: e.target.value })}
                />
                <select
                  className="p-2 border rounded-xl bg-white"
                  value={visitDraft.method}
                  onChange={e => setVisitDraft({ ...visitDraft, method: e.target.value })}
                >
                  <option value="زيارة منزلية">زيارة منزلية</option>
                  <option value="اتصال هاتفي">اتصال هاتفي</option>
                  <option value="رسالة واتساب">رسالة واتساب</option>
                  <option value="لقاء بالكنيسة">لقاء بالكنيسة</option>
                </select>
                <input
                  placeholder="القائم بالافتقاد (افتراضياً أبونا)"
                  className="p-2 border rounded-xl bg-white"
                  value={visitDraft.visitor_name}
                  onChange={e => setVisitDraft({ ...visitDraft, visitor_name: e.target.value })}
                />
              </div>
              <input
                required
                placeholder="ملخص الزيارة والحالة الروحية والأسرية *"
                className="w-full p-2 border rounded-xl bg-white"
                value={visitDraft.summary}
                onChange={e => setVisitDraft({ ...visitDraft, summary: e.target.value })}
              />
              <div className="flex gap-2">
                <input
                  placeholder="احتياجات أو متطلبات المتابعة (اختياري)"
                  className="flex-1 p-2 border rounded-xl bg-white"
                  value={visitDraft.needs}
                  onChange={e => setVisitDraft({ ...visitDraft, needs: e.target.value })}
                />
                <button type="submit" className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl cursor-pointer">
                  + حفظ الزيارة
                </button>
              </div>
            </form>

            <div className="space-y-2">
              <strong className="text-xs text-gray-900 block">
                📜 سجل الزيارات السابقة ({(selectedFamily.visitations_log || []).length}):
              </strong>
              {(selectedFamily.visitations_log || []).length === 0 ? (
                <p className="text-gray-400 text-center py-3 bg-[#fbfaf7] rounded-xl">لا توجد زيارات مسجلة بعد.</p>
              ) : (
                selectedFamily.visitations_log.map((v, i) => (
                  <div key={v.id || i} className="p-3 bg-[#fbfaf7] border rounded-2xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[#7a1c24] font-black">📅 {v.visit_date} • {v.method}</span>
                      <span className="text-[11px] text-gray-500">{v.visitor_name}</span>
                    </div>
                    <p className="text-gray-800">{v.summary}</p>
                    {v.needs && <p className="text-amber-900 text-[11px]">⚠️ متطلبات: {v.needs}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
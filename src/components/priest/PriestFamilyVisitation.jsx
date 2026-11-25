import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLogger';
import {
  Users, Plus, Search, Edit3, Trash2, Printer, MessageCircle,
  Calendar, MapPin, Phone, Briefcase, GraduationCap, Heart, X, UserPlus, Link2, RefreshCw
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

const normalizePhone = (phone = '') => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('20') && digits.length === 12) return '0' + digits.slice(2);
  if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
  return digits;
};

const getNameTokens = (u) => {
  if (!u) return [];
  const splitCombined = [u.first_name, u.second_name, u.third_name, u.fourth_name]
    .map(s => (s || '').trim())
    .filter(Boolean)
    .join(' ');
  const src = (u.full_name || '').trim() || splitCombined;
  return normalizeArabic(src).split(' ').filter(Boolean);
};

const getDisplayQuadName = (u) => {
  if (!u) return '';
  if ((u.full_name || '').trim()) return u.full_name.trim();
  return [u.first_name, u.second_name, u.third_name, u.fourth_name]
    .map(s => (s || '').trim())
    .filter(Boolean)
    .join(' ');
};

const emptyPerson = (defaultMarital = 'متزوج') => ({
  user_id: null,
  full_name: '',
  dob: '',
  marital_status: defaultMarital,
  study_status: '',
  job_title: '',
  phone: '',
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
  visitations_log: []
};

const emptyChildDraft = {
  user_id: null,
  full_name: '',
  dob: '',
  marital_status: 'أعزب',
  study_status: '',
  job_title: '',
  phone: ''
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

const toPersonObjectFromUser = (u, fallbackMarital = 'متزوج') => ({
  user_id: u.id,
  full_name: getDisplayQuadName(u),
  dob: u.dob || '',
  marital_status: u.marital_status || fallbackMarital,
  study_status: u.is_studying
    ? (u.detailed_stage || u.service_stage || 'يدرس')
    : (u.detailed_stage || u.service_stage || ''),
  job_title: u.job_title || '',
  phone: u.phone || '',
  is_alive: true
});

/**
 * خوارزمية تجميع وربط كل حسابات الكنيسة تلقائياً في أسر متصلة:
 * - الاسم الرباعي ونسب الأب (الثاني + الثالث + الرابع)
 * - روابط parent_id / father_id / mother_id
 * - تطابق أسماء وأرقام تليفونات الأب والأم والزوج/الزوجة
 * - جداول user_children و member_siblings
 */
function buildAutoFamiliesFromDatabase({
  churchUsers = [],
  userChildren = [],
  memberSiblings = [],
  priestId = null,
  priestName = ''
}) {
  const people = churchUsers.filter(u => u.role !== 'admin' && u.role !== 'priest');
  const byId = new Map(people.map(u => [u.id, u]));

  const findUserByNameOrPhone = (nameStr = '', phoneStr = '', expectedGender = null) => {
    const qPhone = normalizePhone(phoneStr);
    const qName = normalizeArabic(nameStr);
    if (qPhone.length >= 8) {
      const mPhone = people.find(
        u =>
          normalizePhone(u.phone) === qPhone &&
          (!expectedGender || !u.gender || u.gender === expectedGender)
      );
      if (mPhone) return mPhone;
    }
    if (qName.length >= 4) {
      const mExact = people.find(
        u =>
          normalizeArabic(getDisplayQuadName(u)) === qName &&
          (!expectedGender || !u.gender || u.gender === expectedGender)
      );
      if (mExact) return mExact;

      const qToks = qName.split(' ').filter(Boolean);
      if (qToks.length >= 2) {
        const prefix = qToks.slice(0, 2).join(' ');
        return people.find(u => {
          if (expectedGender && u.gender && u.gender !== expectedGender) return false;
          const uName = normalizeArabic(getDisplayQuadName(u));
          return uName.startsWith(prefix) || prefix.startsWith(uName);
        }) || null;
      }
    }
    return null;
  };

  // تجميع كل شخص تحت مفتاح الأسرة الأساسي
  const buckets = new Map();

  const ensureBucket = (key) => {
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        husbandUser: null,
        wifeUser: null,
        fatherNameHint: '',
        fatherPhoneHint: '',
        motherNameHint: '',
        motherPhoneHint: '',
        childUsers: new Map(),
        extraChildren: [],
        addressHint: '',
        housingHint: 'تمليك',
        belongsToPriest: false
      });
    }
    return buckets.get(key);
  };

  const markPriestLink = (b, u) => {
    if (!u) return;
    if (
      (priestId && u.confession_father_id === priestId) ||
      (priestName && normalizeArabic(u.confession_father) === normalizeArabic(priestName))
    ) {
      b.belongsToPriest = true;
    }
  };

  // 1) أولاً: إنشاء عائلات للآباء والأمهات والأفراد المتزوجين (حسابات أولياء الأمور والمتزوجين)
  const parentOrMarriedUsers = people.filter(
    u =>
      u.role === 'parent' ||
      (u.marital_status && ['متزوج', 'متزوجة', 'أرمل', 'أرملة'].includes(u.marital_status)) ||
      Boolean(u.spouse_name) ||
      Boolean(u.spouse_phone) ||
      people.some(c => c.parent_id === u.id || c.father_id === u.id || c.mother_id === u.id) ||
      userChildren.some(uc => uc.parent_user_id === u.id)
  );

  // ربط كل حساب أب/أم/متزوج في باكت مشترك بين الزوج والزوجة
  const userToBucketKey = new Map();

  parentOrMarriedUsers.forEach(u => {
    if (userToBucketKey.has(u.id)) return;

    const isFemale =
      u.gender === 'أنثى' ||
      u.guardian_type === 'mother' ||
      u.family_role === 'الأم' ||
      u.family_role === 'أم' ||
      u.marital_status === 'متزوجة' ||
      u.marital_status === 'أرملة';

    const spouseMatch = findUserByNameOrPhone(
      u.spouse_name,
      u.spouse_phone,
      isFemale ? 'ذكر' : 'أنثى'
    );

    const existingSpouseKey = spouseMatch ? userToBucketKey.get(spouseMatch.id) : null;
    const key = existingSpouseKey || `fam_parent_${u.id}`;
    const bucket = ensureBucket(key);

    if (isFemale) {
      if (!bucket.wifeUser) bucket.wifeUser = u;
      if (spouseMatch && !bucket.husbandUser) bucket.husbandUser = spouseMatch;
      if (!bucket.husbandUser && u.spouse_name) bucket.fatherNameHint = u.spouse_name;
      if (!bucket.fatherPhoneHint && u.spouse_phone) bucket.fatherPhoneHint = u.spouse_phone;
    } else {
      if (!bucket.husbandUser) bucket.husbandUser = u;
      if (spouseMatch && !bucket.wifeUser) bucket.wifeUser = spouseMatch;
      if (!bucket.wifeUser && u.spouse_name) bucket.motherNameHint = u.spouse_name;
      if (!bucket.motherPhoneHint && u.spouse_phone) bucket.motherPhoneHint = u.spouse_phone;
    }

    if (!bucket.addressHint && u.address) bucket.addressHint = u.address;
    if (u.housing_type) bucket.housingHint = u.housing_type;
    markPriestLink(bucket, u);
    if (spouseMatch) markPriestLink(bucket, spouseMatch);

    userToBucketKey.set(u.id, key);
    if (spouseMatch) userToBucketKey.set(spouseMatch.id, key);
  });

  // 2) ثانياً: ربط كل الأبناء والأفراد غير المتزوجين بعائلاتهم عبر (IDs / الاسم الرباعي / التليفون)
  people.forEach(u => {
    // إذا كان الشخص أصلاً رأس أسرة (زوج/زوجة)، نضيف فقط أبناءه لاحقاً ولا نضعه كابن إلا إذا كان غير متزوج أو لديه parent_id واضح
    const isAlreadyHead = userToBucketKey.has(u.id);
    if (isAlreadyHead && !u.parent_id && !u.father_id && !u.mother_id) return;

    const tokens = getNameTokens(u);
    const derivedFatherFromQuad = tokens.length >= 3 ? tokens.slice(1).join(' ') : '';
    const fatherNameStr = (u.father_full_name || '').trim() || derivedFatherFromQuad;
    const motherNameStr = (u.mother_full_name || '').trim();
    const fPhone = normalizePhone(u.father_phone);
    const mPhone = normalizePhone(u.mother_phone);

    let targetBucketKey = null;

    // أ) مطابقة بالـ ID المباشر
    const linkedParentId = u.father_id || u.mother_id || u.parent_id;
    if (linkedParentId && userToBucketKey.has(linkedParentId)) {
      targetBucketKey = userToBucketKey.get(linkedParentId);
    }

    // ب) مطابقة بحساب الأب أو الأم في الداتابيز عبر الاسم أو التليفون
    if (!targetBucketKey) {
      const matchedFatherUser = findUserByNameOrPhone(fatherNameStr, fPhone, 'ذكر');
      if (matchedFatherUser && userToBucketKey.has(matchedFatherUser.id)) {
        targetBucketKey = userToBucketKey.get(matchedFatherUser.id);
      }
    }
    if (!targetBucketKey) {
      const matchedMotherUser = findUserByNameOrPhone(motherNameStr, mPhone, 'أنثى');
      if (matchedMotherUser && userToBucketKey.has(matchedMotherUser.id)) {
        targetBucketKey = userToBucketKey.get(matchedMotherUser.id);
      }
    }

    // ج) مطابقة مع باكت موجود مسبقاً يشترك في نفس رقم تليفون الأب/الأم أو نفس نسب الاسم الرباعي
    if (!targetBucketKey) {
      const normFather = normalizeArabic(fatherNameStr);
      const normMother = normalizeArabic(motherNameStr);
      for (const [bKey, bObj] of buckets.entries()) {
        const bFatherNorm = normalizeArabic(bObj.husbandUser ? getDisplayQuadName(bObj.husbandUser) : bObj.fatherNameHint);
        const bMotherNorm = normalizeArabic(bObj.wifeUser ? getDisplayQuadName(bObj.wifeUser) : bObj.motherNameHint);
        const bFatherPhone = normalizePhone(bObj.husbandUser?.phone || bObj.fatherPhoneHint);
        const bMotherPhone = normalizePhone(bObj.wifeUser?.phone || bObj.motherPhoneHint);

        const sameFPhone = fPhone.length >= 8 && bFatherPhone && fPhone === bFatherPhone;
        const sameMPhone = mPhone.length >= 8 && bMotherPhone && mPhone === bMotherPhone;
        const sameFatherName = normFather.length >= 5 && bFatherNorm && (normFather === bFatherNorm || bFatherNorm.startsWith(normFather) || normFather.startsWith(bFatherNorm));
        const sameMotherName = normMother.length >= 5 && bMotherNorm && (normMother === bMotherNorm || bMotherNorm.startsWith(normMother) || normMother.startsWith(bMotherNorm));

        if (sameFPhone || sameMPhone || sameFatherName || sameMotherName) {
          targetBucketKey = bKey;
          break;
        }
      }
    }

    // د) إنشاء باكت أسرة جديدة انطلاقاً من نسب الاسم الرباعي للأب أو تليفون الأب/الأم
    if (!targetBucketKey) {
      const normFather = normalizeArabic(fatherNameStr);
      if (fPhone.length >= 8) targetBucketKey = `fam_fphone_${fPhone}`;
      else if (normFather.length >= 4) targetBucketKey = `fam_fname_${normFather}`;
      else if (mPhone.length >= 8) targetBucketKey = `fam_mphone_${mPhone}`;
      else targetBucketKey = `fam_solo_${u.id}`;
    }

    const bucket = ensureBucket(targetBucketKey);
    if (!bucket.fatherNameHint && fatherNameStr) bucket.fatherNameHint = fatherNameStr;
    if (!bucket.fatherPhoneHint && u.father_phone) bucket.fatherPhoneHint = u.father_phone;
    if (!bucket.motherNameHint && motherNameStr) bucket.motherNameHint = motherNameStr;
    if (!bucket.motherPhoneHint && u.mother_phone) bucket.motherPhoneHint = u.mother_phone;
    if (!bucket.addressHint && u.address) bucket.addressHint = u.address;
    if (u.housing_type) bucket.housingHint = u.housing_type;

    if (!bucket.husbandUser && (u.father_id || fatherNameStr || fPhone)) {
      const fu = (u.father_id && byId.get(u.father_id)) || findUserByNameOrPhone(fatherNameStr, fPhone, 'ذكر');
      if (fu && fu.id !== u.id) bucket.husbandUser = fu;
    }
    if (!bucket.wifeUser && (u.mother_id || motherNameStr || mPhone)) {
      const mu = (u.mother_id && byId.get(u.mother_id)) || findUserByNameOrPhone(motherNameStr, mPhone, 'أنثى');
      if (mu && mu.id !== u.id) bucket.wifeUser = mu;
    }

    // لو الباكت عبارة عن فرد وحيد بالغ بدون بيانات أب/أم، نضعه كأب/زوج أو أم/زوجة لو لا يوجد غيره
    if (!isAlreadyHead) {
      bucket.childUsers.set(u.id, u);
    }
    markPriestLink(bucket, u);
    if (bucket.husbandUser) markPriestLink(bucket, bucket.husbandUser);
    if (bucket.wifeUser) markPriestLink(bucket, bucket.wifeUser);
  });

  // 3) دمج user_children و member_siblings غير الموجودين كحسابات
  userChildren.forEach(uc => {
    const bKey = userToBucketKey.get(uc.parent_user_id);
    if (!bKey || !buckets.has(bKey)) return;
    const bucket = buckets.get(bKey);
    const ucNorm = normalizeArabic(uc.child_name);
    const existsAsUser = Array.from(bucket.childUsers.values()).some(cu => normalizeArabic(getDisplayQuadName(cu)).startsWith(ucNorm));
    const existsExtra = bucket.extraChildren.some(ec => normalizeArabic(ec.full_name) === ucNorm);
    if (!existsAsUser && !existsExtra && uc.child_name) {
      bucket.extraChildren.push({
        user_id: null,
        full_name: uc.child_name,
        dob: uc.dob || '',
        marital_status: 'أعزب',
        study_status: uc.stage || '',
        job_title: '',
        phone: ''
      });
    }
  });

  memberSiblings.forEach(sib => {
    for (const bucket of buckets.values()) {
      if (!bucket.childUsers.has(sib.member_id)) continue;
      const sibNorm = normalizeArabic(sib.sibling_full_name);
      const existsAsUser = Array.from(bucket.childUsers.values()).some(cu => normalizeArabic(getDisplayQuadName(cu)) === sibNorm);
      const existsExtra = bucket.extraChildren.some(ec => normalizeArabic(ec.full_name) === sibNorm);
      if (!existsAsUser && !existsExtra && sib.sibling_full_name) {
        bucket.extraChildren.push({
          user_id: null,
          full_name: sib.sibling_full_name,
          dob: sib.dob || '',
          marital_status: sib.marital_status || 'أعزب',
          study_status: sib.stage_or_job || '',
          job_title: sib.stage_or_job || '',
          phone: sib.phone || ''
        });
      }
    }
  });

  // 4) تحويل كل باكت إلى ملف أسرة متكامل (شاملاً الوالد والوالدة للأب/الأم إن وجدوا في الداتابيز)
  const familiesList = [];
  for (const bucket of buckets.values()) {
    const hUser = bucket.husbandUser;
    const wUser = bucket.wifeUser;

    const husband = hUser
      ? toPersonObjectFromUser(hUser, 'متزوج')
      : {
          ...emptyPerson('متزوج'),
          full_name: bucket.fatherNameHint || '',
          phone: bucket.fatherPhoneHint || ''
        };

    const wife = wUser
      ? toPersonObjectFromUser(wUser, 'متزوجة')
      : {
          ...emptyPerson('متزوجة'),
          full_name: bucket.motherNameHint || '',
          phone: bucket.motherPhoneHint || ''
        };

    // البحث عن الوالد والوالدة (الأجداد) لرب الأسرة من الداتابيز عبر الاسم الرباعي أو الـ ID
    const rootRef = hUser || wUser;
    let fatherObj = emptyPerson('متزوج');
    let motherObj = emptyPerson('متزوجة');
    if (rootRef) {
      const rootTokens = getNameTokens(rootRef);
      const grandFatherName = (rootRef.father_full_name || '').trim() || (rootTokens.length >= 3 ? rootTokens.slice(1).join(' ') : '');
      const grandFatherUser = (rootRef.father_id && byId.get(rootRef.father_id)) || findUserByNameOrPhone(grandFatherName, rootRef.father_phone, 'ذكر');
      const grandMotherUser = (rootRef.mother_id && byId.get(rootRef.mother_id)) || findUserByNameOrPhone(rootRef.mother_full_name, rootRef.mother_phone, 'أنثى');

      if (grandFatherUser && grandFatherUser.id !== rootRef.id) {
        fatherObj = toPersonObjectFromUser(grandFatherUser, 'متزوج');
      } else if (grandFatherName) {
        fatherObj = { ...emptyPerson('متزوج'), full_name: grandFatherName, phone: rootRef.father_phone || '' };
      }

      if (grandMotherUser && grandMotherUser.id !== rootRef.id) {
        motherObj = toPersonObjectFromUser(grandMotherUser, 'متزوجة');
      } else if (rootRef.mother_full_name) {
        motherObj = { ...emptyPerson('متزوجة'), full_name: rootRef.mother_full_name, phone: rootRef.mother_phone || '' };
      }
    }

    const childUserObjs = Array.from(bucket.childUsers.values()).map(cu =>
      toPersonObjectFromUser(cu, cu.gender === 'أنثى' ? 'آنسة' : 'أعزب')
    );

    // إضافة الأبناء المذكورين نصياً في children_names إن لم يكونوا مضافين
    const extraFromNamesText = [];
    [hUser, wUser].filter(Boolean).forEach(p => {
      String(p.children_names || '')
        .split(/[,،\n]/)
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(cName => {
          const cNorm = normalizeArabic(cName);
          const already =
            childUserObjs.some(cu => normalizeArabic(cu.full_name).startsWith(cNorm)) ||
            bucket.extraChildren.some(ec => normalizeArabic(ec.full_name) === cNorm) ||
            extraFromNamesText.some(ex => normalizeArabic(ex.full_name) === cNorm);
          if (!already) {
            extraFromNamesText.push({
              user_id: null,
              full_name: cName,
              dob: '',
              marital_status: 'أعزب',
              study_status: '',
              job_title: '',
              phone: ''
            });
          }
        });
    });

    const allChildren = [...childUserObjs, ...bucket.extraChildren, ...extraFromNamesText];

    const titleCandidate =
      (husband.full_name && `أسرة ${husband.full_name}`) ||
      (wife.full_name && `أسرة ${wife.full_name}`) ||
      (allChildren[0]?.full_name && `أسرة ${allChildren[0].full_name}`) ||
      'أسرة بدون عنوان';

    const linkedIds = [
      husband.user_id,
      wife.user_id,
      fatherObj.user_id,
      motherObj.user_id,
      ...allChildren.map(c => c.user_id)
    ].filter(Boolean);

    familiesList.push({
      id: `auto:${bucket.key}`,
      autoKey: bucket.key,
      isAutoConnected: true,
      belongsToPriest: bucket.belongsToPriest,
      linkedUserIds: linkedIds,
      family_title: titleCandidate,
      address: bucket.addressHint || hUser?.address || wUser?.address || '',
      housing_type: bucket.housingHint || 'تمليك',
      family_status: 'مستقرة',
      phone: husband.phone || wife.phone || allChildren[0]?.phone || '',
      next_visit_date: '',
      notes: '',
      husband,
      wife,
      father: fatherObj,
      mother: motherObj,
      children: allChildren,
      visitations_log: []
    });
  }

  return familiesList;
}

export default function PriestFamilyVisitation({ priest, users: passedUsers = null, onOpenWhatsApp }) {
  const todayISO = new Date().toLocaleDateString('en-CA');
  const [savedRecords, setSavedRecords] = useState([]);
  const [churchUsers, setChurchUsers] = useState(Array.isArray(passedUsers) ? passedUsers : []);
  const [userChildren, setUserChildren] = useState([]);
  const [memberSiblings, setMemberSiblings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [scopeTab, setScopeTab] = useState('all'); // 'all' | 'priest_only' | 'saved_only'
  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [editingSavedId, setEditingSavedId] = useState(null);
  const [form, setForm] = useState(emptyFamilyForm);
  const [childDraft, setChildDraft] = useState(emptyChildDraft);
  const [saving, setSaving] = useState(false);

  const [selectedFamily, setSelectedFamily] = useState(null);
  const [visitDraft, setVisitDraft] = useState(emptyVisitDraft(todayISO));
  const [userLookupQ, setUserLookupQ] = useState('');

  useEffect(() => {
    if (Array.isArray(passedUsers) && passedUsers.length > 0) {
      setChurchUsers(passedUsers);
    }
  }, [passedUsers]);

  const loadData = async () => {
    if (!priest?.id) return;
    setLoading(true);
    try {
      const [famRes, usrRes, ucRes, sibRes] = await Promise.all([
        supabase
          .from('priest_family_visitations')
          .select('*')
          .eq('priest_id', priest.id)
          .order('updated_at', { ascending: false }),
        supabase
          .from('church_users')
          .select('*')
          .order('full_name', { ascending: true }),
        supabase.from('user_children').select('*'),
        supabase.from('member_siblings').select('*')
      ]);
      if (!famRes.error && famRes.data) setSavedRecords(famRes.data);
      if (!usrRes.error && usrRes.data) setChurchUsers(usrRes.data);
      if (!ucRes.error && ucRes.data) setUserChildren(ucRes.data);
      if (!sibRes.error && sibRes.data) setMemberSiblings(sibRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [priest?.id]);

  // بناء قائمة الأسر المتصلة تلقائياً ودمجها مع السجلات المحفوظة في priest_family_visitations
  const unifiedFamilies = useMemo(() => {
    const autoList = buildAutoFamiliesFromDatabase({
      churchUsers,
      userChildren,
      memberSiblings,
      priestId: priest?.id,
      priestName: priest?.full_name || ''
    });

    const consumedSavedIds = new Set();

    const findMatchingSavedRecord = (autoFam) => {
      const autoLinkedSet = new Set(autoFam.linkedUserIds || []);
      const autoTitleNorm = normalizeArabic(autoFam.family_title);
      const autoHName = normalizeArabic(autoFam.husband?.full_name);
      const autoWName = normalizeArabic(autoFam.wife?.full_name);

      return savedRecords.find(sr => {
        if (consumedSavedIds.has(sr.id)) return false;

        const srIds = [
          sr.husband?.user_id,
          sr.wife?.user_id,
          sr.father?.user_id,
          sr.mother?.user_id,
          ...(Array.isArray(sr.children) ? sr.children.map(c => c.user_id) : [])
        ].filter(Boolean);

        if (srIds.some(id => autoLinkedSet.has(id))) return true;
        if (autoHName && normalizeArabic(sr.husband?.full_name) === autoHName) return true;
        if (autoWName && normalizeArabic(sr.wife?.full_name) === autoWName) return true;
        if (autoTitleNorm && normalizeArabic(sr.family_title) === autoTitleNorm) return true;
        return false;
      });
    };

    const merged = autoList.map(autoFam => {
      const savedMatch = findMatchingSavedRecord(autoFam);
      if (!savedMatch) return autoFam;

      consumedSavedIds.add(savedMatch.id);
      return {
        ...autoFam,
        id: savedMatch.id,
        savedId: savedMatch.id,
        isAutoConnected: true,
        hasSavedRecord: true,
        family_title: savedMatch.family_title || autoFam.family_title,
        address: savedMatch.address || autoFam.address,
        housing_type: savedMatch.housing_type || autoFam.housing_type,
        family_status: savedMatch.family_status || autoFam.family_status,
        phone: savedMatch.phone || autoFam.phone,
        next_visit_date: savedMatch.next_visit_date || '',
        notes: savedMatch.notes || '',
        husband: { ...autoFam.husband, ...(savedMatch.husband || {}), full_name: savedMatch.husband?.full_name || autoFam.husband?.full_name },
        wife: { ...autoFam.wife, ...(savedMatch.wife || {}), full_name: savedMatch.wife?.full_name || autoFam.wife?.full_name },
        father: { ...autoFam.father, ...(savedMatch.father || {}), full_name: savedMatch.father?.full_name || autoFam.father?.full_name },
        mother: { ...autoFam.mother, ...(savedMatch.mother || {}), full_name: savedMatch.mother?.full_name || autoFam.mother?.full_name },
        children: Array.isArray(savedMatch.children) && savedMatch.children.length > 0 ? savedMatch.children : autoFam.children,
        visitations_log: Array.isArray(savedMatch.visitations_log) ? savedMatch.visitations_log : []
      };
    });

    // إضافة الأسر المضافة يدوياً وليست مطابقة لأي أسرة تلقائية
    savedRecords.forEach(sr => {
      if (consumedSavedIds.has(sr.id)) return;
      merged.unshift({
        ...sr,
        savedId: sr.id,
        isAutoConnected: false,
        hasSavedRecord: true,
        belongsToPriest: true
      });
    });

    // ترتيب: أسر معترفي أبونا أولاً، ثم الأسر التي لها زيارات، ثم الباقي
    return merged.sort((a, b) => {
      if (a.belongsToPriest !== b.belongsToPriest) return a.belongsToPriest ? -1 : 1;
      const aVis = (a.visitations_log || []).length;
      const bVis = (b.visitations_log || []).length;
      if (aVis !== bVis) return bVis - aVis;
      return (a.family_title || '').localeCompare(b.family_title || '', 'ar');
    });
  }, [churchUsers, userChildren, memberSiblings, savedRecords, priest?.id, priest?.full_name]);

  const handleSaveFamily = async (e) => {
    e.preventDefault();
    const derivedTitle =
      form.family_title.trim() ||
      (form.husband?.full_name ? `أسرة ${form.husband.full_name}` : '') ||
      (form.wife?.full_name ? `أسرة ${form.wife.full_name}` : '');

    if (!derivedTitle) return alert('يرجى كتابة اسم الأسرة أو اسم الزوج / الزوجة');

    setSaving(true);
    try {
      const payload = {
        priest_id: priest.id,
        family_title: derivedTitle,
        address: (form.address || '').trim(),
        housing_type: form.housing_type || 'تمليك',
        family_status: form.family_status || 'مستقرة',
        phone: (form.phone || form.husband?.phone || form.wife?.phone || '').trim(),
        next_visit_date: form.next_visit_date || null,
        notes: (form.notes || '').trim(),
        husband: form.husband,
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
          setSavedRecords(prev => prev.map(r => (r.id === editingSavedId ? data : r)));
          if (selectedFamily?.savedId === editingSavedId) {
            setSelectedFamily({ ...selectedFamily, ...data, savedId: data.id, hasSavedRecord: true });
          }
          logActivity({
            user: priest,
            actionType: 'تعديل_ملف_افتقاد_أسرة',
            targetTable: 'priest_family_visitations',
            targetId: data.id,
            description: `عدل ملف افتقاد أسرة: ${data.family_title}`
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
          setSavedRecords(prev => [data, ...prev]);
          logActivity({
            user: priest,
            actionType: 'إضافة_ملف_افتقاد_أسرة',
            targetTable: 'priest_family_visitations',
            targetId: data.id,
            description: `أضاف ملف افتقاد أسرة: ${data.family_title}`
          });
        }
      }

      setShowForm(false);
      setEditingSavedId(null);
      setForm(emptyFamilyForm);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFamily = async (fam) => {
    if (!fam.savedId) return;
    if (!confirm(`حذف سجل الزيارات المحفوظ لأسرة (${fam.family_title})؟ (تبقى حسابات الأفراد في الداتابيز كما هي)`)) return;
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
        visitor_name: visitDraft.visitor_name.trim() || priest.full_name,
        summary: visitDraft.summary.trim(),
        needs: visitDraft.needs.trim()
      },
      ...(Array.isArray(selectedFamily.visitations_log) ? selectedFamily.visitations_log : [])
    ];

    if (selectedFamily.savedId) {
      const { data, error } = await supabase
        .from('priest_family_visitations')
        .update({ visitations_log: nextLog, updated_at: new Date().toISOString() })
        .eq('id', selectedFamily.savedId)
        .select()
        .single();

      if (!error && data) {
        setSavedRecords(prev => prev.map(r => (r.id === data.id ? data : r)));
        setSelectedFamily({ ...selectedFamily, ...data, savedId: data.id, hasSavedRecord: true });
        setVisitDraft(emptyVisitDraft(todayISO));
      } else if (error) {
        alert(error.message);
      }
    } else {
      // إنشاء سجل الأسرة تلقائياً في priest_family_visitations عند تسجيل أول زيارة لأسرة مربوطة من الداتابيز
      const payload = {
        priest_id: priest.id,
        family_title: selectedFamily.family_title,
        address: selectedFamily.address || '',
        housing_type: selectedFamily.housing_type || 'تمليك',
        family_status: selectedFamily.family_status || 'مستقرة',
        phone: selectedFamily.phone || '',
        next_visit_date: selectedFamily.next_visit_date || null,
        notes: selectedFamily.notes || '',
        husband: selectedFamily.husband || emptyPerson('متزوج'),
        wife: selectedFamily.wife || emptyPerson('متزوجة'),
        father: selectedFamily.father || emptyPerson('متزوج'),
        mother: selectedFamily.mother || emptyPerson('متزوجة'),
        children: selectedFamily.children || [],
        visitations_log: nextLog,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('priest_family_visitations')
        .insert([payload])
        .select()
        .single();

      if (!error && data) {
        setSavedRecords(prev => [data, ...prev]);
        setSelectedFamily({ ...selectedFamily, ...data, savedId: data.id, hasSavedRecord: true });
        setVisitDraft(emptyVisitDraft(todayISO));
        logActivity({
          user: priest,
          actionType: 'تسجيل_افتقاد_أسرة',
          targetTable: 'priest_family_visitations',
          targetId: data.id,
          description: `سجل زيارة افتقاد لأسرة (${data.family_title})`
        });
      } else if (error) {
        alert(error.message);
      }
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
      visitations_log: Array.isArray(fam.visitations_log) ? fam.visitations_log : []
    });
    setShowForm(true);
  };

  const importFromChurchUser = (u, roleKey) => {
    const patch = {
      user_id: u.id,
      full_name: getDisplayQuadName(u),
      dob: u.dob || '',
      marital_status: u.marital_status || (roleKey === 'wife' || roleKey === 'mother' ? 'متزوجة' : 'متزوج'),
      study_status: u.detailed_stage || u.service_stage || '',
      job_title: u.job_title || '',
      phone: u.phone || '',
      is_alive: true
    };
    setForm(prev => ({
      ...prev,
      family_title: prev.family_title || `أسرة ${getDisplayQuadName(u)}`,
      address: prev.address || u.address || '',
      housing_type: prev.housing_type || u.housing_type || 'تمليك',
      phone: prev.phone || u.phone || '',
      [roleKey]: { ...prev[roleKey], ...patch }
    }));
    setUserLookupQ('');
  };

  const priestOnlyCount = useMemo(
    () => unifiedFamilies.filter(f => f.belongsToPriest).length,
    [unifiedFamilies]
  );

  const savedOnlyCount = useMemo(
    () => unifiedFamilies.filter(f => f.hasSavedRecord).length,
    [unifiedFamilies]
  );

  const filteredRecords = useMemo(() => {
    return unifiedFamilies.filter(r => {
      if (scopeTab === 'priest_only' && !r.belongsToPriest) return false;
      if (scopeTab === 'saved_only' && !r.hasSavedRecord) return false;
      if (statusFilter !== 'all' && r.family_status !== statusFilter) return false;
      if (!searchQ.trim()) return true;
      return normalizeArabic(JSON.stringify(r)).includes(normalizeArabic(searchQ));
    });
  }, [unifiedFamilies, scopeTab, statusFilter, searchQ]);

  const matchedLookupUsers = useMemo(() => {
    const q = normalizeArabic(userLookupQ);
    if (q.length < 2) return [];
    return churchUsers
      .filter(u => normalizeArabic((getDisplayQuadName(u) || '') + ' ' + (u.phone || '')).includes(q))
      .slice(0, 6);
  }, [userLookupQ, churchUsers]);

  const renderPersonSection = (title, roleKey, allowAliveToggle = false) => {
    const p = form[roleKey] || emptyPerson();
    const setP = (patch) => setForm(prev => ({ ...prev, [roleKey]: { ...prev[roleKey], ...patch } }));

    return (
      <div className="bg-[#fbfaf7] p-3.5 rounded-2xl border border-gray-200 space-y-2.5">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <strong className="text-xs font-black text-[#7a1c24]">{title}</strong>
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
            className="p-2 border rounded-xl bg-white"
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
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 text-xs" dir="rtl">
      <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-2xs flex flex-wrap justify-between items-center gap-3 print:hidden">
        <div>
          <h3 className="text-sm sm:text-base font-black text-[#7a1c24] flex items-center gap-1.5">
            <Users size={18} /> سجل افتقاد أسر ومخدومي الأب الكاهن ({unifiedFamilies.length} أسرة متصلة)
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            ربط تلقائي ذكي من قاعدة بيانات الأفراد (الاسم الرباعي، الأب، الأم، الأبناء، الوالد، الوالدة) + تسجيل زيارات الافتقاد
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadData}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-black flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={14} /> تحديث الربط
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-slate-800 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={14} /> طباعة
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingSavedId(null);
              setForm(emptyFamilyForm);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} /> إضافة أسرة يدوياً
          </button>
        </div>
      </div>

      {/* أزرار التصفية والبحث */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 space-y-2.5 print:hidden">
        <div className="flex flex-wrap gap-1.5 font-black">
          <button
            type="button"
            onClick={() => setScopeTab('all')}
            className={`px-3.5 py-1.5 rounded-xl cursor-pointer transition ${
              scopeTab === 'all' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-800'
            }`}
          >
            🔗 كل الأسر المترابطة من الداتابيز ({unifiedFamilies.length})
          </button>
          <button
            type="button"
            onClick={() => setScopeTab('priest_only')}
            className={`px-3.5 py-1.5 rounded-xl cursor-pointer transition ${
              scopeTab === 'priest_only' ? 'bg-[#7a1c24] text-white' : 'bg-amber-50 text-amber-950 border border-amber-200'
            }`}
          >
            ✝ أسر معترفي / مخدومي أبونا ({priestOnlyCount})
          </button>
          <button
            type="button"
            onClick={() => setScopeTab('saved_only')}
            className={`px-3.5 py-1.5 rounded-xl cursor-pointer transition ${
              scopeTab === 'saved_only' ? 'bg-[#7a1c24] text-white' : 'bg-emerald-50 text-emerald-950 border border-emerald-200'
            }`}
          >
            🕊️ أسر لها سجل افتقاد ({savedOnlyCount})
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute right-3 top-2.5 text-gray-400" />
            <input
              placeholder="بحث بالاسم الرباعي، الزوج، الزوجة، الوالد، الوالدة، الأبناء، الوظيفة، التليفون، أو العنوان..."
              className="w-full pr-9 pl-3 py-2 bg-[#fbfaf7] border rounded-xl outline-none focus:border-[#7a1c24]"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
          </div>
          <select
            className="p-2 border rounded-xl bg-[#fbfaf7] font-bold"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">كل الحالات الأسرية ({unifiedFamilies.length})</option>
            {FAMILY_STATUS_OPTIONS.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-8 rounded-3xl border text-center text-gray-500 font-bold">جاري ربط وتجميع بيانات الأسر من الداتابيز...</div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-dashed text-center text-gray-400 font-bold">
          لا توجد أسر مطابقة لخيار البحث الحالي.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {filteredRecords.map(fam => {
            const kids = Array.isArray(fam.children) ? fam.children : [];
            const visits = Array.isArray(fam.visitations_log) ? fam.visitations_log : [];
            const primaryPhone = fam.phone || fam.husband?.phone || fam.wife?.phone || '';

            return (
              <div key={fam.id} className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-2xs space-y-3">
                <div className="flex flex-wrap justify-between items-start gap-2 border-b border-gray-100 pb-2.5">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      {fam.isAutoConnected && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded-lg text-[10px] font-black inline-flex items-center gap-1">
                          <Link2 size={10} /> متصلة بالداتابيز
                        </span>
                      )}
                      {fam.belongsToPriest && (
                        <span className="px-2 py-0.5 bg-red-100 text-[#7a1c24] rounded-lg text-[10px] font-black">
                          ✝ معترفو أبونا
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 bg-amber-100 text-amber-950 rounded-lg text-[10px] font-black">
                        {fam.family_status}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded-lg text-[10px] font-bold">
                        🏠 {fam.housing_type || 'تمليك'}
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-900 rounded-lg text-[10px] font-bold">
                        🕊️ {visits.length} زيارة
                      </span>
                    </div>
                    <strong className="text-sm sm:text-base text-[#7a1c24] block">{fam.family_title}</strong>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-600 mt-0.5">
                      {fam.address && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {fam.address}</span>}
                      {primaryPhone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {primaryPhone}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 print:hidden">
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
                      onClick={() => setSelectedFamily(fam)}
                      className="px-3 py-1.5 bg-[#f9ecee] hover:bg-[#f2dce0] text-[#7a1c24] rounded-xl font-black cursor-pointer"
                    >
                      التفاصيل والزيارات
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditFamily(fam)}
                      className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
                      title="تعديل وتكميل بيانات الأسرة"
                    >
                      <Edit3 size={14} />
                    </button>
                    {fam.savedId && (
                      <button
                        type="button"
                        onClick={() => handleDeleteFamily(fam)}
                        className="p-2 bg-red-50 text-red-700 rounded-xl cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-2">
                  {renderPersonCard('الزوج', fam.husband, '👨')}
                  {renderPersonCard('الزوجة', fam.wife, '👩')}
                  {renderPersonCard('الوالد', fam.father, '👴')}
                  {renderPersonCard('الوالدة', fam.mother, '👵')}
                </div>

                {kids.length > 0 && (
                  <div className="bg-blue-50/40 p-3 rounded-2xl border border-blue-200 space-y-1.5">
                    <strong className="text-[11px] text-blue-950 block">👶 الأبناء ({kids.length}):</strong>
                    <div className="grid gap-1.5">
                      {kids.map((k, idx) => (
                        <div key={idx} className="bg-white p-2 rounded-xl border text-[11px] flex flex-wrap gap-x-3 gap-y-0.5 items-center">
                          <strong className="text-gray-900">{k.full_name}</strong>
                          {k.user_id && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-900 rounded text-[9px] font-black">حساب كنيسة ✓</span>}
                          {k.dob && <span>🎂 {k.dob} ({calcAge(k.dob)})</span>}
                          {k.marital_status && <span>💍 {k.marital_status}</span>}
                          {k.study_status && <span>🎓 {k.study_status}</span>}
                          {k.job_title && <span>💼 {k.job_title}</span>}
                          {k.phone && <span>📞 {k.phone}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {fam.next_visit_date && (
                  <p className="text-[11px] font-bold text-amber-900 bg-amber-50 px-3 py-1.5 rounded-xl inline-flex items-center gap-1">
                    <Calendar size={12} /> ميعاد الافتقاد القادم: {fam.next_visit_date}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-5 sm:p-6 space-y-4 font-bold max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-sm sm:text-base font-black text-[#7a1c24]">
                {editingSavedId ? '✏️ تعديل ملف الأسرة للافتقاد' : '➕ حفظ / تعديل بيانات الأسرة بسجل الافتقاد'}
              </h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-200 space-y-2">
              <label className="text-[11px] text-blue-950 font-black block">
                🔍 ربط فرد إضافي من قاعدة بيانات الكنيسة بهذه الأسرة:
              </label>
              <input
                placeholder="ابحث بالاسم أو الموبايل لربط الزوج / الزوجة / الوالد / الوالدة..."
                className="w-full p-2 border rounded-xl bg-white"
                value={userLookupQ}
                onChange={e => setUserLookupQ(e.target.value)}
              />
              {matchedLookupUsers.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {matchedLookupUsers.map(u => (
                    <div key={u.id} className="bg-white p-2 rounded-xl border flex flex-wrap justify-between items-center gap-2 text-[11px]">
                      <span><strong>{getDisplayQuadName(u)}</strong> ({u.phone || '—'})</span>
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
                    placeholder="عنوان/اسم الأسرة"
                    className="p-2 border rounded-xl bg-white"
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
                    placeholder="العنوان السكني بالتفصيل"
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
                <strong className="text-xs font-black text-[#7a1c24] block">⑤ بيانات الأبناء</strong>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <input
                    placeholder="اسم الابن / الابنة"
                    className="lg:col-span-2 p-2 border rounded-xl bg-white"
                    value={childDraft.full_name}
                    onChange={e => setChildDraft({ ...childDraft, full_name: e.target.value })}
                  />
                  <input
                    type="date"
                    className="p-2 border rounded-xl bg-white"
                    value={childDraft.dob}
                    onChange={e => setChildDraft({ ...childDraft, dob: e.target.value })}
                  />
                  <select
                    className="p-2 border rounded-xl bg-white"
                    value={childDraft.marital_status}
                    onChange={e => setChildDraft({ ...childDraft, marital_status: e.target.value })}
                  >
                    {MARITAL_STATUS_OPTIONS.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <input
                    placeholder="الحالة الدراسية"
                    className="p-2 border rounded-xl bg-white"
                    value={childDraft.study_status}
                    onChange={e => setChildDraft({ ...childDraft, study_status: e.target.value })}
                  />
                  <input
                    placeholder="الوظيفة"
                    className="p-2 border rounded-xl bg-white"
                    value={childDraft.job_title}
                    onChange={e => setChildDraft({ ...childDraft, job_title: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!childDraft.full_name.trim()) return;
                    setForm(prev => ({ ...prev, children: [...(prev.children || []), childDraft] }));
                    setChildDraft(emptyChildDraft);
                  }}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus size={13} /> + إضافة الابن للقائمة
                </button>

                {(form.children || []).length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {form.children.map((c, idx) => (
                      <div key={idx} className="bg-white p-2 rounded-xl border flex justify-between items-center gap-2">
                        <span>
                          • <strong>{c.full_name}</strong> ({c.marital_status})
                          {c.dob && ` • ميلاد: ${c.dob}`}
                          {c.study_status && ` • دراسة: ${c.study_status}`}
                          {c.job_title && ` • وظيفة: ${c.job_title}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, children: prev.children.filter((_, i) => i !== idx) }))}
                          className="text-red-700 cursor-pointer"
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
                  {saving ? 'جاري الحفظ...' : 'حفظ ملف الأسرة بسجل الافتقاد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedFamily && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-3xl p-5 sm:p-6 space-y-4 font-bold max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-black text-[#7a1c24]">{selectedFamily.family_title}</h3>
                <p className="text-[11px] text-gray-500">📍 {selectedFamily.address || '—'} • 🏷️ {selectedFamily.family_status}</p>
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
                    <strong>{c.full_name}</strong> • 🎂 {c.dob || '—'} ({calcAge(c.dob)}) • 💍 {c.marital_status} • 🎓 {c.study_status || '—'} • 💼 {c.job_title || '—'}
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
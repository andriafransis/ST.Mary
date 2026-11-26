import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLogger';
import {
  Users, Plus, Search, Edit3, Trash2, Printer, MessageCircle,
  Calendar, MapPin, Phone, Briefcase, GraduationCap, Heart, X,
  UserPlus, Link2, RefreshCw, GitBranch, Network, ChevronDown, ChevronUp,
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

const normalizePhone = (phone = '') => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('20') && digits.length === 12) return '0' + digits.slice(2);
  if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
  return digits;
};

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

const resolveMaritalStatusForRole = (rawStatus, roleType, hasChildrenOrSpouse = false) => {
  const cleaned = String(rawStatus || '').trim();
  const isParentOrSpouseRole = ['husband', 'wife', 'father', 'mother'].includes(roleType);
  const isFemaleRole = ['wife', 'mother'].includes(roleType);

  if (isParentOrSpouseRole) {
    if (!cleaned || ['أعزب', 'عزباء', 'آنسة', 'عازب'].includes(cleaned) || hasChildrenOrSpouse) {
      if (['أرمل', 'أرملة', 'مطلق/ة', 'مطلق', 'مطلقة'].includes(cleaned)) {
        return cleaned;
      }
      return isFemaleRole ? 'متزوجة' : 'متزوج';
    }
  }

  return cleaned || (isFemaleRole ? 'متزوجة' : 'متزوج');
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
  extended_relatives: [],
  excluded_children_keys: [],
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

const toPersonObjectFromUser = (u, roleType = 'husband', hasChildrenOrSpouse = false) => ({
  user_id: u.id,
  full_name: getDisplayQuadName(u),
  dob: u.dob || '',
  marital_status: resolveMaritalStatusForRole(u.marital_status, roleType, hasChildrenOrSpouse),
  study_status: u.is_studying
    ? (u.detailed_stage || u.service_stage || 'يدرس')
    : (u.detailed_stage || u.service_stage || ''),
  job_title: u.job_title || '',
  phone: u.phone || '',
  address: extractUserAddress(u),
  is_alive: true
});

const isUserMarriedOrParent = (u, allPeople, userChildren) => {
  if (!u) return false;
  if (u.permissions?.linked_spouse_id) return true;
  if (u.spouse_name || u.spouse_phone) return true;
  if (['متزوج', 'متزوجة', 'أرمل', 'أرملة'].includes(u.marital_status)) return true;
  if (allPeople.some(c => c.parent_id === u.id || c.father_id === u.id || c.mother_id === u.id)) return true;
  if (userChildren.some(uc => uc.parent_user_id === u.id)) return true;
  return false;
};

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

function buildExplicitFamiliesFromDatabase({
  churchUsers = [],
  userChildren = [],
  memberSiblings = [],
  priestId = null,
  priestName = ''
}) {
  const people = churchUsers.filter(u => u.role !== 'admin' && u.role !== 'priest');
  const byId = new Map(people.map(u => [u.id, u]));

  const findUserByExplicitIdOrPhone = (idVal, phoneStr = '', expectedGender = null) => {
    if (idVal && byId.has(idVal)) return byId.get(idVal);
    const qPhone = normalizePhone(phoneStr);
    if (qPhone.length >= 8) {
      return (
        people.find(
          u =>
            normalizePhone(u.phone) === qPhone &&
            (!expectedGender || !u.gender || u.gender === expectedGender)
        ) || null
      );
    }
    return null;
  };

  const buckets = new Map();
  const userToHeadBucketKey = new Map();

  const ensureBucket = (key) => {
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        husbandUser: null,
        wifeUser: null,
        fatherUser: null,
        motherUser: null,
        fatherNameHint: '',
        fatherPhoneHint: '',
        motherNameHint: '',
        motherPhoneHint: '',
        childUsers: new Map(),
        extraChildren: [],
        confirmedExtended: [],
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

  const mergeBuckets = (targetKey, sourceKey) => {
    if (!targetKey || !sourceKey || targetKey === sourceKey) return targetKey;
    const t = buckets.get(targetKey);
    const s = buckets.get(sourceKey);
    if (!t || !s) return targetKey;

    if (!t.husbandUser && s.husbandUser) t.husbandUser = s.husbandUser;
    if (!t.wifeUser && s.wifeUser) t.wifeUser = s.wifeUser;
    if (!t.fatherUser && s.fatherUser) t.fatherUser = s.fatherUser;
    if (!t.motherUser && s.motherUser) t.motherUser = s.motherUser;
    if (!t.fatherNameHint && s.fatherNameHint) t.fatherNameHint = s.fatherNameHint;
    if (!t.fatherPhoneHint && s.fatherPhoneHint) t.fatherPhoneHint = s.fatherPhoneHint;
    if (!t.motherNameHint && s.motherNameHint) t.motherNameHint = s.motherNameHint;
    if (!t.motherPhoneHint && s.motherPhoneHint) t.motherPhoneHint = s.motherPhoneHint;
    if (!t.addressHint && s.addressHint) t.addressHint = s.addressHint;
    if (s.belongsToPriest) t.belongsToPriest = true;
    s.childUsers.forEach((cu, cid) => t.childUsers.set(cid, cu));
    s.extraChildren.forEach(ec => t.extraChildren.push(ec));
    s.confirmedExtended.forEach(ex => t.confirmedExtended.push(ex));

    for (const [uid, bKey] of userToHeadBucketKey.entries()) {
      if (bKey === sourceKey) userToHeadBucketKey.set(uid, targetKey);
    }
    buckets.delete(sourceKey);
    return targetKey;
  };

  const headsPool = people.filter(u => isUserMarriedOrParent(u, people, userChildren));

  headsPool.forEach(u => {
    if (userToHeadBucketKey.has(u.id)) return;

    const isFemale =
      u.gender === 'أنثى' ||
      u.guardian_type === 'mother' ||
      u.family_role === 'الأم' ||
      u.family_role === 'أم' ||
      u.marital_status === 'متزوجة' ||
      u.marital_status === 'أرملة';

    const linkedSpouseById = u.permissions?.linked_spouse_id
      ? byId.get(u.permissions.linked_spouse_id)
      : null;

    const reverseLinkedSpouse = people.find(x => x.permissions?.linked_spouse_id === u.id);

    const spouseMatch =
      linkedSpouseById ||
      reverseLinkedSpouse ||
      findUserByExplicitIdOrPhone(null, u.spouse_phone, isFemale ? 'ذكر' : 'أنثى');

    const existingSpouseKey = spouseMatch ? userToHeadBucketKey.get(spouseMatch.id) : null;
    const key = existingSpouseKey || `fam_head_${u.id}`;
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

    const uAddr = extractUserAddress(u);
    const spAddr = extractUserAddress(spouseMatch);
    if (!bucket.addressHint && (uAddr || spAddr)) bucket.addressHint = uAddr || spAddr;
    if (u.housing_type) bucket.housingHint = u.housing_type;
    markPriestLink(bucket, u);
    if (spouseMatch) markPriestLink(bucket, spouseMatch);

    userToHeadBucketKey.set(u.id, key);
    if (spouseMatch) userToHeadBucketKey.set(spouseMatch.id, key);
  });

  people.forEach(child => {
    const fUser =
      (child.father_id && byId.get(child.father_id)) ||
      (child.parent_id && byId.get(child.parent_id)?.gender !== 'أنثى' ? byId.get(child.parent_id) : null);

    const mUser =
      (child.mother_id && byId.get(child.mother_id)) ||
      (child.parent_id && byId.get(child.parent_id)?.gender === 'أنثى' ? byId.get(child.parent_id) : null);

    if (fUser && mUser && fUser.id !== mUser.id) {
      const fKey = userToHeadBucketKey.get(fUser.id);
      const mKey = userToHeadBucketKey.get(mUser.id);
      if (fKey && mKey && fKey !== mKey) {
        mergeBuckets(fKey, mKey);
      }
    }
  });

  const resolveExplicitParentBucketKey = (u) => {
    if (!u) return null;
    const directIds = [u.father_id, u.mother_id, u.parent_id].filter(id => id && id !== u.id);
    for (const pid of directIds) {
      if (userToHeadBucketKey.has(pid)) return userToHeadBucketKey.get(pid);
    }
    return null;
  };

  people.forEach(u => {
    const isHeadItself = userToHeadBucketKey.has(u.id);
    const hasExplicitParent = Boolean(u.father_id || u.mother_id || u.parent_id);
    if (isHeadItself && !hasExplicitParent) return;

    let targetParentBucketKey = resolveExplicitParentBucketKey(u);
    if (!targetParentBucketKey && !isHeadItself) {
      targetParentBucketKey = `fam_solo_${u.id}`;
    }
    if (!targetParentBucketKey) return;

    const parentBucket = ensureBucket(targetParentBucketKey);
    if (parentBucket.husbandUser?.id === u.id || parentBucket.wifeUser?.id === u.id) return;

    const uAddr = extractUserAddress(u);
    if (!parentBucket.addressHint && uAddr) parentBucket.addressHint = uAddr;

    parentBucket.childUsers.set(u.id, u);
    markPriestLink(parentBucket, u);
  });

  people.forEach(u => {
    const extList = Array.isArray(u.permissions?.extended_relatives) ? u.permissions.extended_relatives : [];
    if (extList.length === 0) return;
    const bKey = userToHeadBucketKey.get(u.id);
    if (!bKey || !buckets.has(bKey)) return;
    const bucket = buckets.get(bKey);
    extList.forEach(rel => {
      const relUser = rel.user_id ? byId.get(rel.user_id) : null;
      if (bucket.confirmedExtended.some(item => item.user_id && item.user_id === rel.user_id)) return;
      bucket.confirmedExtended.push({
        anchor_user_id: u.id,
        user_id: rel.user_id || null,
        full_name: rel.full_name || getDisplayQuadName(relUser) || '',
        kinship_role: rel.kinship_role || 'قريب عائلة',
        phone: rel.phone || relUser?.phone || ''
      });
    });
  });

  userChildren.forEach(uc => {
    const bKey = userToHeadBucketKey.get(uc.parent_user_id);
    if (!bKey || !buckets.has(bKey)) return;
    const bucket = buckets.get(bKey);
    const ucNorm = normalizeArabic(uc.child_name);
    const existsAsUser = Array.from(bucket.childUsers.values()).some(cu =>
      normalizeArabic(getDisplayQuadName(cu)).startsWith(ucNorm)
    );
    const existsExtra = bucket.extraChildren.some(ec => normalizeArabic(ec.full_name) === ucNorm);
    if (!existsAsUser && !existsExtra && uc.child_name) {
      bucket.extraChildren.push({
        id: uc.id || null,
        sourceTable: 'user_children',
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
      const existsAsUser = Array.from(bucket.childUsers.values()).some(
        cu => normalizeArabic(getDisplayQuadName(cu)) === sibNorm
      );
      const existsExtra = bucket.extraChildren.some(ec => normalizeArabic(ec.full_name) === sibNorm);
      if (!existsAsUser && !existsExtra && sib.sibling_full_name) {
        bucket.extraChildren.push({
          id: sib.id || null,
          sourceTable: 'member_siblings',
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

  const bucketTitleMap = new Map();
  for (const [bKey, bucket] of buckets.entries()) {
    const hName = bucket.husbandUser ? getDisplayQuadName(bucket.husbandUser) : bucket.fatherNameHint;
    const wName = bucket.wifeUser ? getDisplayQuadName(bucket.wifeUser) : bucket.motherNameHint;
    const firstChild = Array.from(bucket.childUsers.values())[0];
    const cName = firstChild ? getDisplayQuadName(firstChild) : bucket.extraChildren[0]?.full_name;
    const title =
      (hName && `أسرة ${hName}`) ||
      (wName && `أسرة ${wName}`) ||
      (cName && `أسرة ${cName}`) ||
      'أسرة بدون عنوان';
    bucketTitleMap.set(bKey, title);
  }

  const relationsGraph = new Map();
  const addFamilyRelation = (fromKey, toKey, relationLabel, searchTerm) => {
    if (!fromKey || !toKey || fromKey === toKey || !bucketTitleMap.has(toKey)) return;
    if (!relationsGraph.has(fromKey)) relationsGraph.set(fromKey, new Map());
    const mapForFrom = relationsGraph.get(fromKey);
    if (!mapForFrom.has(toKey)) {
      mapForFrom.set(toKey, {
        key: toKey,
        title: bucketTitleMap.get(toKey),
        relationLabel,
        searchTerm: searchTerm || bucketTitleMap.get(toKey).replace(/^أسرة\s+/, '')
      });
    }
  };

  for (const [bKey, bucket] of buckets.entries()) {
    const hUser = bucket.husbandUser;
    const wUser = bucket.wifeUser;

    if (hUser) {
      const hParentKey = resolveExplicitParentBucketKey(hUser);
      if (hParentKey && hParentKey !== bKey) {
        addFamilyRelation(
          bKey,
          hParentKey,
          'أسرة الوالد',
          bucketTitleMap.get(hParentKey).replace(/^أسرة\s+/, '')
        );
        addFamilyRelation(
          hParentKey,
          bKey,
          `الابن المتزوج (${getDisplayQuadName(hUser)})`,
          getDisplayQuadName(hUser)
        );
      }
    }

    if (wUser) {
      const wParentKey = resolveExplicitParentBucketKey(wUser);
      if (wParentKey && wParentKey !== bKey) {
        addFamilyRelation(
          bKey,
          wParentKey,
          'أسرة والد الزوجة',
          bucketTitleMap.get(wParentKey).replace(/^أسرة\s+/, '')
        );
        addFamilyRelation(
          wParentKey,
          bKey,
          `زواج الابنة (${getDisplayQuadName(wUser)})`,
          getDisplayQuadName(wUser)
        );
      }
    }

    bucket.childUsers.forEach(cu => {
      const childOwnKey = userToHeadBucketKey.get(cu.id);
      if (childOwnKey && childOwnKey !== bKey) {
        addFamilyRelation(
          bKey,
          childOwnKey,
          `أسرة الابن/الابنة (${getDisplayQuadName(cu)})`,
          getDisplayQuadName(cu)
        );
        addFamilyRelation(
          childOwnKey,
          bKey,
          `الوالدين (${bucketTitleMap.get(bKey).replace(/^أسرة\s+/, '')})`,
          bucketTitleMap.get(bKey).replace(/^أسرة\s+/, '')
        );
      }
    });

    bucket.confirmedExtended.forEach(ext => {
      if (!ext.user_id) return;
      const extOwnKey = userToHeadBucketKey.get(ext.user_id);
      if (extOwnKey && extOwnKey !== bKey) {
        addFamilyRelation(
          bKey,
          extOwnKey,
          `${ext.kinship_role} (${ext.full_name})`,
          ext.full_name
        );
      }
    });
  }

  const familiesList = [];
  for (const bucket of buckets.values()) {
    const hUser = bucket.husbandUser;
    const wUser = bucket.wifeUser;
    const hasKidsOrSpouse =
      Boolean(hUser && wUser) ||
      bucket.childUsers.size > 0 ||
      bucket.extraChildren.length > 0 ||
      Boolean(hUser?.children_names) ||
      Boolean(wUser?.children_names);

    const husband = hUser
      ? toPersonObjectFromUser(hUser, 'husband', hasKidsOrSpouse)
      : {
          ...emptyPerson('متزوج'),
          full_name: bucket.fatherNameHint || '',
          phone: bucket.fatherPhoneHint || '',
          marital_status: resolveMaritalStatusForRole('', 'husband', true)
        };

    const wife = wUser
      ? toPersonObjectFromUser(wUser, 'wife', hasKidsOrSpouse)
      : {
          ...emptyPerson('متزوجة'),
          full_name: bucket.motherNameHint || '',
          phone: bucket.motherPhoneHint || '',
          marital_status: resolveMaritalStatusForRole('', 'wife', true)
        };

    const rootRef = hUser || wUser;
    let fatherObj = emptyPerson('متزوج');
    let motherObj = emptyPerson('متزوجة');
    if (rootRef) {
      const explicitFather = rootRef.father_id ? byId.get(rootRef.father_id) : null;
      const explicitMother = rootRef.mother_id ? byId.get(rootRef.mother_id) : null;

      if (explicitFather && explicitFather.id !== rootRef.id) {
        fatherObj = toPersonObjectFromUser(explicitFather, 'father', true);
      }
      if (explicitMother && explicitMother.id !== rootRef.id) {
        motherObj = toPersonObjectFromUser(explicitMother, 'mother', true);
      }
    }

    const childUserObjs = Array.from(bucket.childUsers.values())
      .filter(cu => cu.id !== husband.user_id && cu.id !== wife.user_id && cu.id !== fatherObj.user_id)
      .map(cu => ({
        ...toPersonObjectFromUser(cu, cu.gender === 'أنثى' ? 'daughter' : 'son', false),
        hasOwnFamily: userToHeadBucketKey.has(cu.id),
        ownFamilyKey: userToHeadBucketKey.get(cu.id) || null
      }));

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
              sourceTable: 'church_users.children_names',
              parentUserId: p.id,
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

    if (!husband.full_name && !wife.full_name && allChildren.length === 0) continue;

    const titleCandidate = bucketTitleMap.get(bucket.key) || 'أسرة بدون عنوان';

    const linkedIds = [
      husband.user_id,
      wife.user_id,
      fatherObj.user_id,
      motherObj.user_id,
      ...allChildren.map(c => c.user_id),
      ...bucket.confirmedExtended.map(ex => ex.user_id)
    ].filter(Boolean);

    const connectedFamilies = relationsGraph.has(bucket.key)
      ? Array.from(relationsGraph.get(bucket.key).values())
      : [];

    const resolvedAddress =
      bucket.addressHint ||
      extractUserAddress(hUser) ||
      extractUserAddress(wUser) ||
      fatherObj.address ||
      motherObj.address ||
      '';

    familiesList.push({
      id: `auto:${bucket.key}`,
      autoKey: bucket.key,
      isAutoConnected: true,
      belongsToPriest: bucket.belongsToPriest,
      linkedUserIds: linkedIds,
      lineageParentName: fatherObj.full_name || '',
      connectedFamilies,
      confirmedExtended: bucket.confirmedExtended,
      family_title: titleCandidate,
      address: resolvedAddress,
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
      excluded_children_keys: [],
      visitations_log: []
    });
  }

  return familiesList;
}

const getChildMatchKey = (child) => {
  if (!child) return '';
  if (child.user_id) return `uid:${child.user_id}`;
  return `name:${normalizeArabic(child.full_name || '')}`;
};

export default function PriestFamilyVisitation({ priest, users: passedUsers = null, onOpenWhatsApp }) {
  const todayISO = new Date().toLocaleDateString('en-CA');
  const [savedRecords, setSavedRecords] = useState([]);
  const [churchUsers, setChurchUsers] = useState(Array.isArray(passedUsers) ? passedUsers : []);
  const [userChildren, setUserChildren] = useState([]);
  const [memberSiblings, setMemberSiblings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resettingDb, setResettingDb] = useState(false);

  const [scopeTab, setScopeTab] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedRoleByCandidate, setSelectedRoleByCandidate] = useState({});
  const [editingRelationKey, setEditingRelationKey] = useState(null);
  const [editingRelationRole, setEditingRelationRole] = useState('الأخ');

  const [expandedCards, setExpandedCards] = useState({});

  const [showForm, setShowForm] = useState(false);
  const [editingSavedId, setEditingSavedId] = useState(null);
  const [form, setForm] = useState(emptyFamilyForm);
  const [selectedChildDbUserId, setSelectedChildDbUserId] = useState('');
  const [childRoleChoice, setChildRoleChoice] = useState('الابن');
  const [saving, setSaving] = useState(false);

  const [selectedFamily, setSelectedFamily] = useState(null);
  const [visitDraft, setVisitDraft] = useState(emptyVisitDraft(todayISO));
  const [userLookupQ, setUserLookupQ] = useState('');

  const [linkModalFam, setLinkModalFam] = useState(null);
  const [linkSearchQ, setLinkSearchQ] = useState('');
  const [linkRoleChoice, setLinkRoleChoice] = useState('الأخ');
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

  // تحديد الأعضاء التابعين لخط أندريا فرانسيس في الداتابيز للتحقق السريع
  const andriaRelatedUserIds = useMemo(() => {
    const ids = new Set();
    const andriaUsers = churchUsers.filter(u =>
      normalizeArabic(getDisplayQuadName(u)).includes('اندريا فرانسيس')
    );

    andriaUsers.forEach(au => {
      ids.add(au.id);
      if (au.father_id) ids.add(au.father_id);
      if (au.mother_id) ids.add(au.mother_id);
      if (au.parent_id) ids.add(au.parent_id);
      if (au.permissions?.linked_spouse_id) ids.add(au.permissions.linked_spouse_id);
      if (Array.isArray(au.permissions?.extended_relatives)) {
        au.permissions.extended_relatives.forEach(r => {
          if (r.user_id) ids.add(r.user_id);
        });
      }
    });

    churchUsers.forEach(u => {
      if (ids.has(u.father_id) || ids.has(u.mother_id) || ids.has(u.parent_id)) {
        ids.add(u.id);
      }
      if (Array.isArray(u.permissions?.extended_relatives)) {
        if (u.permissions.extended_relatives.some(r => ids.has(r.user_id))) {
          ids.add(u.id);
        }
      }
    });

    return ids;
  }, [churchUsers]);

  const handleResetAllRelationsInDatabase = async () => {
    const firstConfirm = confirm(
      '⚠️ تنبيه هام: سيتم تصفير كل روابط القرابات والارتباطات العائلية المحفوظة في الداتابيز (القرابات الممتدة، الزوج/الزوجة المربوطين، الأب/الأم/الوالد المربوطين) لتبدأ بإضافتها وتحديد صلة كل شخص من الداتابيز بدقة. هل أنت متأكد؟'
    );
    if (!firstConfirm) return;

    const secondConfirm = confirm(
      'تأكيد أخير: هل تريد مسح الروابط القديمة الآن والبدء من صفحة نظيفة؟ (لن يتم حذف حسابات الأعضاء أنفسهم).'
    );
    if (!secondConfirm) return;

    setResettingDb(true);
    try {
      const targetUsers = churchUsers.filter(u => u.role !== 'admin' && u.role !== 'priest');
      for (const u of targetUsers) {
        const cleanedPermissions = { ...(u.permissions || {}) };
        delete cleanedPermissions.extended_relatives;
        delete cleanedPermissions.linked_spouse_id;

        await safeUpdateChurchUser(u.id, {
          father_id: null,
          mother_id: null,
          parent_id: null,
          spouse_name: null,
          spouse_phone: null,
          permissions: cleanedPermissions
        });
      }

      if (priest?.id) {
        await supabase
          .from('priest_family_visitations')
          .delete()
          .eq('priest_id', priest.id);
      }

      logActivity({
        user: priest,
        actionType: 'تصفير_روابط_القرابات_والأسر',
        targetTable: 'church_users',
        targetId: priest?.id,
        description: 'تم تصفير روابط القرابات والأسر القديمة لإعادة تسجيلها وتحديد صلاتها بدقة'
      });

      await loadData();
      setExpandedCards({});
      alert('تم تصفير الروابط القديمة بنجاح ✅ ابدأ الآن بربط كل شخص من الداتابيز وتحديد صلته.');
    } finally {
      setResettingDb(false);
    }
  };

  const upsertFamilyVisitationRecord = async (fam, extraPatch = {}) => {
    if (!priest?.id || !fam) return null;
    const basePayload = {
      priest_id: priest.id,
      family_title: fam.family_title || 'أسرة بدون عنوان',
      family_name: fam.family_title || 'أسرة بدون عنوان',
      address: fam.address || '',
      housing_type: fam.housing_type || 'تمليك',
      family_status: fam.family_status || 'مستقرة',
      phone: fam.phone || fam.husband?.phone || fam.wife?.phone || '',
      next_visit_date: fam.next_visit_date || null,
      notes: fam.notes || '',
      husband: fam.husband || emptyPerson('متزوج'),
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

  const unifiedFamilies = useMemo(() => {
    const autoList = buildExplicitFamiliesFromDatabase({
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
      const mergedHusband = autoFam.husband?.full_name
        ? { ...autoFam.husband, marital_status: resolveMaritalStatusForRole(autoFam.husband.marital_status, 'husband', true) }
        : { ...autoFam.husband, ...(savedMatch.husband || {}), marital_status: resolveMaritalStatusForRole(savedMatch.husband?.marital_status, 'husband', true) };

      const mergedWife = autoFam.wife?.full_name
        ? { ...autoFam.wife, marital_status: resolveMaritalStatusForRole(autoFam.wife.marital_status, 'wife', true) }
        : { ...autoFam.wife, ...(savedMatch.wife || {}), marital_status: resolveMaritalStatusForRole(savedMatch.wife?.marital_status, 'wife', true) };

      const mergedFather = autoFam.father?.full_name
        ? { ...autoFam.father, marital_status: resolveMaritalStatusForRole(autoFam.father.marital_status, 'father', true) }
        : { ...autoFam.father, ...(savedMatch.father || {}), marital_status: resolveMaritalStatusForRole(savedMatch.father?.marital_status, 'father', true) };

      const mergedMother = autoFam.mother?.full_name
        ? { ...autoFam.mother, marital_status: resolveMaritalStatusForRole(autoFam.mother.marital_status, 'mother', true) }
        : { ...autoFam.mother, ...(savedMatch.mother || {}), marital_status: resolveMaritalStatusForRole(savedMatch.mother?.marital_status, 'mother', true) };

      const savedExcluded = Array.isArray(savedMatch.husband?.excluded_children_keys)
        ? savedMatch.husband.excluded_children_keys
        : Array.isArray(savedMatch.excluded_children_keys)
        ? savedMatch.excluded_children_keys
        : [];
      const excludedSet = new Set(savedExcluded);

      const combinedChildren = [];
      const seenKeys = new Set();
      const pushChildIfValid = (ch) => {
        if (!ch || !ch.full_name) return;
        const k = getChildMatchKey(ch);
        const nameKey = `name:${normalizeArabic(ch.full_name)}`;
        if (excludedSet.has(k) || excludedSet.has(nameKey)) return;
        if (ch.user_id && (ch.user_id === mergedHusband.user_id || ch.user_id === mergedWife.user_id || ch.user_id === mergedFather.user_id)) return;
        if (seenKeys.has(k) || seenKeys.has(nameKey)) return;
        seenKeys.add(k);
        seenKeys.add(nameKey);
        combinedChildren.push(ch);
      };

      if (Array.isArray(savedMatch.children)) {
        savedMatch.children.forEach(pushChildIfValid);
      }
      if (Array.isArray(autoFam.children)) {
        autoFam.children.forEach(pushChildIfValid);
      }

      return {
        ...autoFam,
        id: savedMatch.id,
        savedId: savedMatch.id,
        isAutoConnected: true,
        hasSavedRecord: true,
        family_title: savedMatch.family_title || savedMatch.family_name || autoFam.family_title,
        address: savedMatch.address || autoFam.address,
        housing_type: savedMatch.housing_type || autoFam.housing_type,
        family_status: savedMatch.family_status || autoFam.family_status,
        phone: savedMatch.phone || autoFam.phone,
        next_visit_date: savedMatch.next_visit_date || '',
        notes: savedMatch.notes || '',
        husband: mergedHusband,
        wife: mergedWife,
        father: mergedFather,
        mother: mergedMother,
        children: combinedChildren,
        excluded_children_keys: savedExcluded,
        visitations_log: Array.isArray(savedMatch.visitations_log) ? savedMatch.visitations_log : []
      };
    });

    savedRecords.forEach(sr => {
      if (consumedSavedIds.has(sr.id)) return;
      merged.unshift({
        ...sr,
        family_title: sr.family_title || sr.family_name || 'أسرة بدون عنوان',
        savedId: sr.id,
        isAutoConnected: false,
        hasSavedRecord: true,
        belongsToPriest: true,
        connectedFamilies: [],
        husband: sr.husband?.full_name ? { ...sr.husband, marital_status: resolveMaritalStatusForRole(sr.husband.marital_status, 'husband', true) } : sr.husband,
        wife: sr.wife?.full_name ? { ...sr.wife, marital_status: resolveMaritalStatusForRole(sr.wife.marital_status, 'wife', true) } : sr.wife,
        father: sr.father?.full_name ? { ...sr.father, marital_status: resolveMaritalStatusForRole(sr.father.marital_status, 'father', true) } : sr.father,
        mother: sr.mother?.full_name ? { ...sr.mother, marital_status: resolveMaritalStatusForRole(sr.mother.marital_status, 'mother', true) } : sr.mother
      });
    });

    return merged.sort((a, b) => {
      if (a.belongsToPriest !== b.belongsToPriest) return a.belongsToPriest ? -1 : 1;
      const aVis = (a.visitations_log || []).length;
      const bVis = (b.visitations_log || []).length;
      if (aVis !== bVis) return bVis - aVis;
      return (a.family_title || '').localeCompare(b.family_title || '', 'ar');
    });
  }, [churchUsers, userChildren, memberSiblings, savedRecords, priest?.id, priest?.full_name]);

  const userFamilyTitleLookup = useMemo(() => {
    const map = new Map();
    unifiedFamilies.forEach(f => {
      if (f.husband?.user_id) map.set(f.husband.user_id, f.family_title);
      if (f.wife?.user_id) map.set(f.wife.user_id, f.family_title);
    });
    return map;
  }, [unifiedFamilies]);

  const handleLinkPersonInDatabase = async (fam, targetUser, kinshipLabel = 'الأخ') => {
    if (!fam || !targetUser) return;
    setLinkBusy(true);
    try {
      const primaryUserId = fam.husband?.user_id || fam.wife?.user_id || fam.children?.[0]?.user_id;
      const primaryUser = churchUsers.find(u => u.id === primaryUserId);
      if (!primaryUser) {
        alert('اختر أسرة تحتوي على حساب عضو مربوط من الداتابيز أولاً.');
        return;
      }

      const primaryName = getDisplayQuadName(primaryUser);
      const targetName = getDisplayQuadName(targetUser);

      let relationType = 'extended';
      if (kinshipLabel === 'الأب' || kinshipLabel === 'الجد') relationType = 'father';
      else if (kinshipLabel === 'الأم' || kinshipLabel === 'الجدة') relationType = 'mother';
      else if (kinshipLabel === 'الابن' || kinshipLabel === 'الابنة' || kinshipLabel === 'الحفيد' || kinshipLabel === 'الحفيدة') relationType = 'child';
      else if (kinshipLabel === 'الزوج' || kinshipLabel === 'الزوجة') relationType = 'spouse';

      if (relationType === 'spouse') {
        const primaryIsFemale = primaryUser.gender === 'أنثى';
        const targetIsFemale = targetUser.gender === 'أنثى';
        const primaryNextMarital = primaryIsFemale ? 'متزوجة' : 'متزوج';
        const targetNextMarital = targetIsFemale ? 'متزوجة' : 'متزوج';

        await Promise.all([
          safeUpdateChurchUser(primaryUser.id, {
            marital_status: primaryNextMarital,
            spouse_name: targetName,
            spouse_phone: targetUser.phone || '',
            permissions: {
              ...(primaryUser.permissions || {}),
              linked_spouse_id: targetUser.id
            }
          }),
          safeUpdateChurchUser(targetUser.id, {
            marital_status: targetNextMarital,
            spouse_name: primaryName,
            spouse_phone: primaryUser.phone || '',
            permissions: {
              ...(targetUser.permissions || {}),
              linked_spouse_id: primaryUser.id
            }
          })
        ]);
      } else if (relationType === 'father') {
        await Promise.all([
          safeUpdateChurchUser(primaryUser.id, {
            father_id: targetUser.id,
            father_full_name: targetName,
            father_phone: targetUser.phone || ''
          }),
          safeUpdateChurchUser(targetUser.id, {
            marital_status: 'متزوج'
          })
        ]);
      } else if (relationType === 'mother') {
        await Promise.all([
          safeUpdateChurchUser(primaryUser.id, {
            mother_id: targetUser.id,
            mother_full_name: targetName,
            mother_phone: targetUser.phone || ''
          }),
          safeUpdateChurchUser(targetUser.id, {
            marital_status: 'متزوجة'
          })
        ]);
      } else if (relationType === 'child') {
        const isPrimaryFemale = primaryUser.gender === 'أنثى';
        const patch = {
          parent_id: primaryUser.id
        };
        if (fam.husband?.user_id) {
          patch.father_id = fam.husband.user_id;
          patch.father_full_name = fam.husband.full_name || '';
          patch.father_phone = fam.husband.phone || '';
        } else if (!isPrimaryFemale) {
          patch.father_id = primaryUser.id;
          patch.father_full_name = primaryName;
          patch.father_phone = primaryUser.phone || '';
        }
        if (fam.wife?.user_id) {
          patch.mother_id = fam.wife.user_id;
          patch.mother_full_name = fam.wife.full_name || '';
          patch.mother_phone = fam.wife.phone || '';
        } else if (isPrimaryFemale) {
          patch.mother_id = primaryUser.id;
          patch.mother_full_name = primaryName;
          patch.mother_phone = primaryUser.phone || '';
        }

        await safeUpdateChurchUser(targetUser.id, patch);
      }

      const primaryRelatives = Array.isArray(primaryUser.permissions?.extended_relatives)
        ? primaryUser.permissions.extended_relatives
        : [];
      const nextPrimaryRelatives = [
        ...primaryRelatives.filter(r => r.user_id !== targetUser.id),
        {
          user_id: targetUser.id,
          full_name: targetName,
          kinship_role: kinshipLabel,
          phone: targetUser.phone || ''
        }
      ];

      const targetRelatives = Array.isArray(targetUser.permissions?.extended_relatives)
        ? targetUser.permissions.extended_relatives
        : [];
      const reverseRole = REVERSE_KINSHIP_MAP[kinshipLabel] || `قريب (${primaryName})`;
      const nextTargetRelatives = [
        ...targetRelatives.filter(r => r.user_id !== primaryUser.id),
        {
          user_id: primaryUser.id,
          full_name: primaryName,
          kinship_role: reverseRole,
          phone: primaryUser.phone || ''
        }
      ];

      await Promise.all([
        safeUpdateChurchUser(primaryUser.id, {
          permissions: {
            ...(primaryUser.permissions || {}),
            extended_relatives: nextPrimaryRelatives
          }
        }),
        safeUpdateChurchUser(targetUser.id, {
          permissions: {
            ...(targetUser.permissions || {}),
            extended_relatives: nextTargetRelatives
          }
        })
      ]);

      await upsertFamilyVisitationRecord(fam);

      logActivity({
        user: priest,
        actionType: 'تحديد_وتحديث_صلة_قرابة',
        targetTable: 'church_users',
        targetId: primaryUser.id,
        description: `تحديث الداتابيز: ربط (${targetName}) بصفة (${kinshipLabel}) مع أسرة (${fam.family_title})`
      });

      await loadData();
      setLinkModalFam(null);
      setLinkSearchQ('');
      alert(`تم حفظ صلة (${kinshipLabel}) لـ (${targetName}) في الداتابيز بنجاح ✅`);
    } finally {
      setLinkBusy(false);
    }
  };

  const handleUpdateConfirmedRelation = async (fam, extItem, nextRole) => {
    if (!fam || !extItem?.user_id) return;
    const primaryUserId = extItem.anchor_user_id || fam.husband?.user_id || fam.wife?.user_id;
    const primaryUser = churchUsers.find(u => u.id === primaryUserId);
    const targetUser = churchUsers.find(u => u.id === extItem.user_id);

    if (primaryUser) {
      const list = Array.isArray(primaryUser.permissions?.extended_relatives)
        ? primaryUser.permissions.extended_relatives
        : [];
      const updatedList = list.map(r =>
        r.user_id === extItem.user_id ? { ...r, kinship_role: nextRole } : r
      );
      await safeUpdateChurchUser(primaryUser.id, {
        permissions: { ...(primaryUser.permissions || {}), extended_relatives: updatedList }
      });
    }

    if (targetUser && primaryUser) {
      const tList = Array.isArray(targetUser.permissions?.extended_relatives)
        ? targetUser.permissions.extended_relatives
        : [];
      const reverseRole = REVERSE_KINSHIP_MAP[nextRole] || `قريب (${getDisplayQuadName(primaryUser)})`;
      const updatedTList = tList.map(r =>
        r.user_id === primaryUser.id ? { ...r, kinship_role: reverseRole } : r
      );
      await safeUpdateChurchUser(targetUser.id, {
        permissions: { ...(targetUser.permissions || {}), extended_relatives: updatedTList }
      });
    }

    await upsertFamilyVisitationRecord(fam);
    await loadData();
    setEditingRelationKey(null);
  };

  const handleRemoveConfirmedRelation = async (fam, extItem) => {
    if (!fam || !extItem?.user_id) return;
    if (!confirm(`إزالة صلة القرابة (${extItem.full_name}) من الداتابيز؟`)) return;

    const primaryUserId = extItem.anchor_user_id || fam.husband?.user_id || fam.wife?.user_id;
    const primaryUser = churchUsers.find(u => u.id === primaryUserId);
    const targetUser = churchUsers.find(u => u.id === extItem.user_id);

    if (primaryUser) {
      const list = Array.isArray(primaryUser.permissions?.extended_relatives)
        ? primaryUser.permissions.extended_relatives
        : [];
      await safeUpdateChurchUser(primaryUser.id, {
        permissions: {
          ...(primaryUser.permissions || {}),
          extended_relatives: list.filter(r => r.user_id !== extItem.user_id)
        }
      });
    }

    if (targetUser && primaryUser) {
      const tList = Array.isArray(targetUser.permissions?.extended_relatives)
        ? targetUser.permissions.extended_relatives
        : [];
      await safeUpdateChurchUser(targetUser.id, {
        permissions: {
          ...(targetUser.permissions || {}),
          extended_relatives: tList.filter(r => r.user_id !== primaryUser.id)
        }
      });
    }

    await loadData();
    setEditingRelationKey(null);
  };

  const handleRemoveChildItem = async (idx) => {
    const targetChild = (form.children || [])[idx];
    if (!targetChild) return;

    const removedKey = getChildMatchKey(targetChild);
    const removedNameKey = `name:${normalizeArabic(targetChild.full_name || '')}`;

    if (targetChild.user_id) {
      await safeUpdateChurchUser(targetChild.user_id, {
        parent_id: null,
        father_id: null,
        mother_id: null
      });
    }

    if (targetChild.sourceTable === 'user_children' && targetChild.id) {
      await supabase
        .from('user_children')
        .delete()
        .eq('id', targetChild.id);
    }

    if (targetChild.sourceTable === 'church_users.children_names' && targetChild.parentUserId) {
      const parentObj = churchUsers.find(u => u.id === targetChild.parentUserId);
      if (parentObj?.children_names) {
        const cleanedNames = String(parentObj.children_names)
          .split(/[,،\n]/)
          .map(s => s.trim())
          .filter(n => n && normalizeArabic(n) !== normalizeArabic(targetChild.full_name))
          .join(' ، ');
        await safeUpdateChurchUser(parentObj.id, { children_names: cleanedNames });
      }
    }

    setForm(prev => {
      const nextExcluded = Array.from(
        new Set([...(prev.excluded_children_keys || []), removedKey, removedNameKey].filter(Boolean))
      );
      return {
        ...prev,
        children: (prev.children || []).filter((_, i) => i !== idx),
        excluded_children_keys: nextExcluded
      };
    });
  };

  const syncEditedPeopleBackToChurchUsers = async (familyData) => {
    const updates = [];
    const sharedAddress = (familyData.address || '').trim();
    const sharedHousing = familyData.housing_type || 'تمليك';

    const syncOne = (personObj, roleType) => {
      if (!personObj?.user_id) return;
      const patch = {
        marital_status: resolveMaritalStatusForRole(personObj.marital_status, roleType, true)
      };
      if (personObj.full_name?.trim()) patch.full_name = personObj.full_name.trim();
      if (personObj.dob) patch.dob = personObj.dob;
      if (personObj.job_title?.trim()) patch.job_title = personObj.job_title.trim();
      if (personObj.phone?.trim()) patch.phone = personObj.phone.trim();
      if (sharedAddress) patch.address = sharedAddress;
      if (roleType === 'husband' || roleType === 'wife') {
        patch.housing_type = sharedHousing;
      }

      updates.push(safeUpdateChurchUser(personObj.user_id, patch));
    };

    syncOne(familyData.husband, 'husband');
    syncOne(familyData.wife, 'wife');
    syncOne(familyData.father, 'father');
    syncOne(familyData.mother, 'mother');

    if (Array.isArray(familyData.children)) {
      familyData.children.forEach(c => {
        if (!c?.user_id) return;
        const cPatch = {};
        if (c.full_name?.trim()) cPatch.full_name = c.full_name.trim();
        if (c.dob) cPatch.dob = c.dob;
        if (c.marital_status) cPatch.marital_status = c.marital_status;
        if (c.job_title?.trim()) cPatch.job_title = c.job_title.trim();
        if (c.phone?.trim()) cPatch.phone = c.phone.trim();
        if (sharedAddress) cPatch.address = sharedAddress;
        updates.push(safeUpdateChurchUser(c.user_id, cPatch));
      });
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  };

  const handleSaveFamily = async (e) => {
    e.preventDefault();
    const derivedTitle =
      form.family_title.trim() ||
      (form.husband?.full_name ? `أسرة ${form.husband.full_name}` : '') ||
      (form.wife?.full_name ? `أسرة ${form.wife.full_name}` : '');

    if (!derivedTitle) return alert('يرجى اختيار فرد من قاعدة بيانات الكنيسة أولاً لتحديد اسم الأسرة');

    setSaving(true);
    try {
      const husbandWithExcluded = {
        ...(form.husband || emptyPerson('متزوج')),
        excluded_children_keys: form.excluded_children_keys || []
      };

      const payload = {
        priest_id: priest.id,
        family_title: derivedTitle,
        family_name: derivedTitle,
        address: (form.address || '').trim(),
        housing_type: form.housing_type || 'تمليك',
        family_status: form.family_status || 'مستقرة',
        phone: (form.phone || form.husband?.phone || form.wife?.phone || '').trim(),
        next_visit_date: form.next_visit_date || null,
        notes: (form.notes || '').trim(),
        husband: husbandWithExcluded,
        wife: form.wife,
        father: form.father,
        mother: form.mother,
        children: form.children || [],
        visitations_log: form.visitations_log || [],
        updated_at: new Date().toISOString()
      };

      await syncEditedPeopleBackToChurchUsers(payload);

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
            description: `عدل ملف افتقاد أسرة وحدث الداتابيز: ${data.family_title}`
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
            description: `أضاف ملف افتقاد أسرة وحدث الداتابيز: ${data.family_title}`
          });
        }
      }

      await loadData();
      setShowForm(false);
      setEditingSavedId(null);
      setForm(emptyFamilyForm);
      alert('تم الحفظ وتحديث الداتابيز بنجاح ✅');
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

    const data = await upsertFamilyVisitationRecord(selectedFamily, { visitations_log: nextLog });
    if (data) {
      await loadData();
      setSelectedFamily({ ...selectedFamily, ...data, savedId: data.id, hasSavedRecord: true });
      setVisitDraft(emptyVisitDraft(todayISO));
    }
  };

  const openEditFamily = (fam) => {
    setEditingSavedId(fam.savedId || null);
    const exKeys = Array.isArray(fam.husband?.excluded_children_keys)
      ? fam.husband.excluded_children_keys
      : Array.isArray(fam.excluded_children_keys)
      ? fam.excluded_children_keys
      : [];

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
      excluded_children_keys: exKeys,
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
      marital_status: resolveMaritalStatusForRole(u.marital_status, roleKey, true),
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
      'اسم الأسرة / رب الأسرة',
      'بيانات الزوج (السن / الوظيفة / الموبايل)',
      'الزوجة (البيانات والموبايل)',
      'الوالد / الوالدة',
      'الأبناء',
      'العنوان والمنطقة',
      'السكن',
      'الحالة الأسرية',
      'عدد الزيارات',
      'آخر زيارة وملاحظات'
    ];

    const escapeCsv = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

    const rows = filteredRecords.map((fam, index) => {
      const hInfo = fam.husband?.full_name
        ? `${fam.husband.full_name} (${calcAge(fam.husband.dob)} - ${fam.husband.job_title || '—'} - ${fam.husband.phone || '—'})`
        : '—';
      const wInfo = fam.wife?.full_name
        ? `${fam.wife.full_name} (${calcAge(fam.wife.dob)} - ${fam.wife.job_title || '—'} - ${fam.wife.phone || '—'})`
        : '—';
      const parentsInfo = [
        fam.father?.full_name ? `الوالد: ${fam.father.full_name}` : '',
        fam.mother?.full_name ? `الوالدة: ${fam.mother.full_name}` : ''
      ]
        .filter(Boolean)
        .join(' | ') || '—';

      const kidsInfo =
        Array.isArray(fam.children) && fam.children.length > 0
          ? fam.children.map(k => `${k.full_name} (${calcAge(k.dob)})`).join(' ، ')
          : '—';

      const addr = fam.address || fam.husband?.address || fam.wife?.address || 'غير مسجل';
      const visits = Array.isArray(fam.visitations_log) ? fam.visitations_log : [];
      const lastVisit = visits[0] ? `${visits[0].visit_date}: ${visits[0].summary}` : fam.notes || '—';

      return [
        index + 1,
        fam.family_title,
        hInfo,
        wInfo,
        parentsInfo,
        kidsInfo,
        addr,
        fam.housing_type || 'تمليك',
        fam.family_status || 'مستقرة',
        visits.length,
        lastVisit
      ]
        .map(escapeCsv)
        .join(',');
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

  const dbMembersPool = useMemo(
    () => churchUsers.filter(u => u.role !== 'admin' && u.role !== 'priest'),
    [churchUsers]
  );

  const matchedLookupUsers = useMemo(() => {
    const q = normalizeArabic(userLookupQ);
    if (q.length < 2) return [];
    return dbMembersPool
      .filter(u => normalizeArabic((getDisplayQuadName(u) || '') + ' ' + (u.phone || '')).includes(q))
      .slice(0, 8);
  }, [userLookupQ, dbMembersPool]);

  const linkModalCandidates = useMemo(() => {
    if (!linkModalFam) return [];
    const excludeIds = new Set(linkModalFam.linkedUserIds || []);
    const q = normalizeArabic(linkSearchQ);
    return dbMembersPool
      .filter(u => {
        if (excludeIds.has(u.id)) return false;
        if (!q) return true;
        return normalizeArabic((getDisplayQuadName(u) || '') + ' ' + (u.phone || '')).includes(q);
      })
      .slice(0, 15);
  }, [linkModalFam, linkSearchQ, dbMembersPool]);

  const renderPersonSection = (title, roleKey, allowAliveToggle = false) => {
    const p = form[roleKey] || emptyPerson();
    const setP = (patch) => setForm(prev => ({ ...prev, [roleKey]: { ...prev[roleKey], ...patch } }));
    const isLinkedToDb = Boolean(p.user_id);
    const isUnderAndria = p.user_id ? andriaRelatedUserIds.has(p.user_id) : false;

    return (
      <div className="bg-[#fbfaf7] p-3.5 rounded-2xl border border-gray-200 space-y-2.5">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <strong className="text-xs font-black text-[#7a1c24]">{title}</strong>
            {isLinkedToDb ? (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-950 rounded text-[10px] font-black inline-flex items-center gap-1">
                <ShieldCheck size={11} /> مسجل في الداتابيز
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-950 rounded text-[10px] font-black inline-flex items-center gap-1">
                <AlertCircle size={11} /> اختر من البحث أعلاه لربطه بالداتابيز
              </span>
            )}
            {isLinkedToDb && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black ${
                  isUnderAndria
                    ? 'bg-emerald-100 text-emerald-950'
                    : 'bg-slate-200 text-slate-800'
                }`}
              >
                {isUnderAndria ? '✓ تابع لخط أندريا فرانسيس' : 'مسجل خارج خط أندريا فرانسيس'}
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
            readOnly
            placeholder="اختر الاسم من البحث في الداتابيز أعلاه"
            className="p-2 border rounded-xl bg-gray-100 text-gray-900 font-black cursor-default"
            value={p.full_name || ''}
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

  const renderPersonCard = (label, person, emoji, roleType = 'husband', hasKidsOrSpouse = true) => {
    if (!person || !person.full_name) return null;
    const displayMarital = resolveMaritalStatusForRole(person.marital_status, roleType, hasKidsOrSpouse);

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
          {displayMarital && <span>💍 {displayMarital}</span>}
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
            <Users size={18} /> سجل افتقاد أسر ومخدومي الأب الكاهن ({unifiedFamilies.length} أسرة)
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            تحقق مباشر من الداتابيز لبيان تبعية الفرد لخط أندريا فرانسيس وصلته الدقيقة (أب، أم، جد، أخ، خال، عم، زوج...)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={resettingDb}
            onClick={handleResetAllRelationsInDatabase}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 rounded-xl font-black flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={14} /> {resettingDb ? 'جاري التصفير...' : 'تصفير الروابط والبدء من جديد'}
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
              setSelectedChildDbUserId('');
              setShowForm(true);
            }}
            className="px-4 py-2 bg-[#7a1c24] hover:bg-[#5c1319] text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} /> إضافة أسرة
          </button>
        </div>
      </div>

      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 space-y-2.5 print:hidden">
        <div className="flex flex-wrap gap-1.5 font-black">
          <button
            type="button"
            onClick={() => setScopeTab('all')}
            className={`px-3.5 py-1.5 rounded-xl cursor-pointer transition ${
              scopeTab === 'all' ? 'bg-[#7a1c24] text-white' : 'bg-gray-100 text-gray-800'
            }`}
          >
            🔗 كل الأسر ({unifiedFamilies.length})
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
              placeholder="بحث بالاسم، الزوج، الزوجة، الوالد، الوالدة، الأبناء، أو العنوان..."
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
            <option value="all">كل الحالات الأسرية ({unifiedFamilies.length})</option>
            {FAMILY_STATUS_OPTIONS.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="print:hidden">
        {loading ? (
          <div className="bg-white p-8 rounded-3xl border text-center text-gray-500 font-bold">جاري تحميل بيانات الأسر من الداتابيز...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-dashed text-center text-gray-400 font-bold">
            لا توجد أسر مطابقة لخيار البحث الحالي.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredRecords.map(fam => {
              const isExpanded = Boolean(expandedCards[fam.id]);
              const kids = Array.isArray(fam.children) ? fam.children : [];
              const visits = Array.isArray(fam.visitations_log) ? fam.visitations_log : [];
              const connected = Array.isArray(fam.connectedFamilies) ? fam.connectedFamilies : [];
              const confirmedExt = Array.isArray(fam.confirmedExtended) ? fam.confirmedExtended : [];
              const primaryPhone = fam.phone || fam.husband?.phone || fam.wife?.phone || '';
              const displayAddress = fam.address || fam.husband?.address || fam.wife?.address || 'غير مسجل';
              const famBelongsToAndria = (fam.linkedUserIds || []).some(id => andriaRelatedUserIds.has(id));

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
                        {famBelongsToAndria && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-950 rounded text-[9px] font-black">
                            ✓ خط أندريا فرانسيس
                          </span>
                        )}
                        {fam.belongsToPriest && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-[#7a1c24] rounded text-[9px] font-black">
                            ✝ معترفو أبونا
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-950 rounded text-[9px] font-black">
                          {fam.family_status}
                        </span>
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-900 rounded text-[9px] font-bold">
                          🕊️ {visits.length}
                        </span>
                        {confirmedExt.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-sky-100 text-sky-950 rounded text-[9px] font-black">
                            <UserCheck size={10} className="inline ml-0.5" /> {confirmedExt.length} صلة محددة
                          </span>
                        )}
                        {connected.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-950 rounded text-[9px] font-black">
                            🔗 {connected.length} ارتباط
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded-lg text-[10px] font-bold">
                            🏠 {fam.housing_type || 'تمليك'}
                          </span>
                          {fam.lineageParentName && (
                            <button
                              type="button"
                              onClick={() => setSearchQ(fam.lineageParentName)}
                              className="px-2.5 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-950 border border-purple-200 rounded-lg text-[10px] font-black inline-flex items-center gap-1 cursor-pointer"
                            >
                              <GitBranch size={11} /> تسلسل العائلة: أسرة الوالد ({fam.lineageParentName}) ↗
                            </button>
                          )}
                        </div>

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
                              setLinkRoleChoice('الأخ');
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
                            <Edit3 size={13} /> تعديل وحفظ بالداتابيز
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

                      {confirmedExt.length > 0 && (
                        <div className="bg-emerald-50/70 p-2.5 rounded-2xl border border-emerald-200 space-y-1.5">
                          <strong className="text-[10px] text-emerald-950 block">
                            ✅ القرابات والصلات المحددة في الداتابيز ({confirmedExt.length}):
                          </strong>
                          <div className="flex flex-wrap gap-1.5">
                            {confirmedExt.map((ext, idx) => {
                              const relKey = `${fam.id}:${ext.user_id || idx}`;
                              const isEditingThis = editingRelationKey === relKey;

                              return (
                                <div
                                  key={relKey}
                                  className="px-2.5 py-1 bg-white text-emerald-950 border border-emerald-200 rounded-xl text-[10px] font-black flex flex-wrap items-center gap-1.5"
                                >
                                  {isEditingThis ? (
                                    <>
                                      <span>{ext.full_name}:</span>
                                      <select
                                        className="p-0.5 border rounded bg-[#fbfaf7] text-[10px] font-black"
                                        value={editingRelationRole}
                                        onChange={e => setEditingRelationRole(e.target.value)}
                                      >
                                        {KINSHIP_ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateConfirmedRelation(fam, ext, editingRelationRole)}
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
                                        {ext.kinship_role}: {ext.full_name} {ext.phone ? `• 📞 ${ext.phone}` : ''}
                                      </span>
                                      {ext.user_id && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingRelationKey(relKey);
                                              setEditingRelationRole(ext.kinship_role || 'الأخ');
                                            }}
                                            className="px-1.5 py-0.5 bg-amber-100 text-amber-950 rounded text-[9px] cursor-pointer"
                                          >
                                            تعديل الصلة
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveConfirmedRelation(fam, ext)}
                                            className="px-1.5 py-0.5 bg-rose-100 text-rose-900 rounded text-[9px] cursor-pointer"
                                          >
                                            حذف
                                          </button>
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {connected.length > 0 && (
                        <div className="bg-purple-50/60 p-2.5 rounded-2xl border border-purple-200 space-y-1.5">
                          <strong className="text-[10px] text-purple-950 flex items-center gap-1">
                            <Network size={12} /> أسر مرتبطة صراحة ({connected.length}):
                          </strong>
                          <div className="flex flex-wrap gap-1.5">
                            {connected.map(rel => (
                              <button
                                key={rel.key}
                                type="button"
                                onClick={() => setSearchQ(rel.searchTerm)}
                                className="px-2.5 py-1 bg-white hover:bg-purple-100 text-purple-950 border border-purple-200 rounded-xl text-[10px] font-black inline-flex items-center gap-1 cursor-pointer text-right"
                              >
                                <span>🔗 {rel.title}</span>
                                <span className="text-purple-700 font-bold">({rel.relationLabel}) ↗</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid sm:grid-cols-2 gap-2">
                        {renderPersonCard('الزوج', fam.husband, '👨', 'husband', true)}
                        {renderPersonCard('الزوجة', fam.wife, '👩', 'wife', true)}
                        {renderPersonCard('الوالد', fam.father, '👴', 'father', true)}
                        {renderPersonCard('الوالدة', fam.mother, '👵', 'mother', true)}
                      </div>

                      {kids.length > 0 && (
                        <div className="bg-blue-50/40 p-3 rounded-2xl border border-blue-200 space-y-1.5">
                          <strong className="text-[11px] text-blue-950 block">👶 الأبناء ({kids.length}):</strong>
                          <div className="grid sm:grid-cols-2 gap-1.5">
                            {kids.map((k, idx) => (
                              <div key={idx} className="bg-white p-2 rounded-xl border text-[11px] flex flex-wrap gap-x-3 gap-y-0.5 items-center">
                                <strong className="text-gray-900">{k.full_name}</strong>
                                {k.user_id && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-900 rounded text-[9px] font-black">حساب كنيسة ✓</span>}
                                {k.hasOwnFamily && (
                                  <button
                                    type="button"
                                    onClick={() => setSearchQ(k.full_name)}
                                    className="px-2 py-0.5 bg-purple-100 text-purple-950 rounded text-[9px] font-black cursor-pointer"
                                  >
                                    🏠 له أسرة مستقلة ↗
                                  </button>
                                )}
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* شيت الطباعة الأفقي */}
      <div className="hidden print:block w-full text-black" dir="rtl">
        <div className="text-center border-b-2 border-black pb-2 mb-3">
          <h2 className="text-base font-black">كشف افتقاد الأسر والمخدومين — {priest?.full_name || 'الأب الكاهن'}</h2>
          <p className="text-[11px]">
            تاريخ الطباعة: {todayISO} • إجمالي الأسر بالكشف: {filteredRecords.length} أسرة
          </p>
        </div>

        <table className="w-full border-collapse border border-black text-[10px]">
          <thead>
            <tr className="bg-gray-200 font-black">
              <th className="border border-black p-1.5 text-center w-8">م</th>
              <th className="border border-black p-1.5 text-right">اسم رب الأسرة والبيانات</th>
              <th className="border border-black p-1.5 text-right">الزوجة وبياناتها</th>
              <th className="border border-black p-1.5 text-right">الوالد / الوالدة</th>
              <th className="border border-black p-1.5 text-right">الأبناء</th>
              <th className="border border-black p-1.5 text-right">العنوان والمنطقة والسكن</th>
              <th className="border border-black p-1.5 text-center">التليفون</th>
              <th className="border border-black p-1.5 text-center">الحالة</th>
              <th className="border border-black p-1.5 text-right">ملاحظات / آخر زيارة</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((fam, idx) => {
              const kids = Array.isArray(fam.children) ? fam.children : [];
              const visits = Array.isArray(fam.visitations_log) ? fam.visitations_log : [];
              const addr = fam.address || fam.husband?.address || fam.wife?.address || '—';
              const primaryPhone = fam.phone || fam.husband?.phone || fam.wife?.phone || '—';

              return (
                <tr key={fam.id} className="break-inside-avoid">
                  <td className="border border-black p-1.5 text-center font-bold">{idx + 1}</td>
                  <td className="border border-black p-1.5 align-top">
                    <div className="font-black">{fam.husband?.full_name || fam.family_title}</div>
                    {fam.husband?.dob && <div>ميلاد: {fam.husband.dob} ({calcAge(fam.husband.dob)})</div>}
                    {fam.husband?.job_title && <div>العمل: {fam.husband.job_title}</div>}
                    {fam.husband?.phone && <div>ت: {fam.husband.phone}</div>}
                  </td>
                  <td className="border border-black p-1.5 align-top">
                    {fam.wife?.full_name ? (
                      <>
                        <div className="font-bold">{fam.wife.full_name}</div>
                        {fam.wife.dob && <div>ميلاد: {fam.wife.dob} ({calcAge(fam.wife.dob)})</div>}
                        {fam.wife.job_title && <div>العمل: {fam.wife.job_title}</div>}
                        {fam.wife.phone && <div>ت: {fam.wife.phone}</div>}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="border border-black p-1.5 align-top">
                    {fam.father?.full_name && <div>الوالد: {fam.father.full_name}</div>}
                    {fam.mother?.full_name && <div>الوالدة: {fam.mother.full_name}</div>}
                    {!fam.father?.full_name && !fam.mother?.full_name && '—'}
                  </td>
                  <td className="border border-black p-1.5 align-top">
                    {kids.length > 0 ? (
                      kids.map((k, kIdx) => (
                        <div key={kIdx}>
                          • {k.full_name} ({calcAge(k.dob)}{k.study_status ? ` - ${k.study_status}` : ''})
                        </div>
                      ))
                    ) : (
                      '—'
                    )}
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
                  🔗 تحقق من الداتابيز واربط شخصاً مع أسرة: {linkModalFam.family_title}
                </h3>
                <p className="text-[11px] text-gray-500 font-normal mt-0.5">
                  النتائج من قاعدة البيانات مباشرةً مع بيان هل هو ضمن خط أندريا فرانسيس أم لا، واختيار صلته من قائمة محددة.
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
                <p className="text-center text-rose-800 bg-rose-50 border border-rose-200 rounded-2xl py-4">
                  غير موجود في قاعدة البيانات ضمن النتائج المطابقة.
                </p>
              ) : (
                linkModalCandidates.map(u => {
                  const existingFamTitle = userFamilyTitleLookup.get(u.id);
                  const isUnderAndria = andriaRelatedUserIds.has(u.id);
                  const rk = `modal:${u.id}`;
                  const chosenRole = selectedRoleByCandidate[rk] || linkRoleChoice;

                  return (
                    <div key={u.id} className="p-3 bg-[#fbfaf7] border rounded-2xl flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <strong className="text-gray-900">{getDisplayQuadName(u)}</strong>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              isUnderAndria
                                ? 'bg-emerald-100 text-emerald-950'
                                : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {isUnderAndria ? '✓ تبع أندريا فرانسيس' : 'مش تبع أندريا فرانسيس'}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-500 block mt-0.5">
                          {u.gender === 'أنثى' ? '♀️ أنثى' : '♂️ ذكر'} • 📞 {u.phone || '—'} {u.dob ? `• 🎂 ${u.dob}` : ''}
                        </span>
                        {existingFamTitle && (
                          <span className="mt-1 inline-block px-2 py-0.5 bg-purple-100 text-purple-950 rounded text-[10px] font-black">
                            🏠 أسرته في الداتابيز: {existingFamTitle}
                          </span>
                        )}
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
                          onClick={() => handleLinkPersonInDatabase(linkModalFam, u, chosenRole)}
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
                {editingSavedId ? '✏️ تعديل ملف الأسرة وتحديث قاعدة البيانات' : '➕ إضافة / تعديل بيانات الأسرة من قاعدة البيانات'}
              </h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-200 space-y-2">
              <label className="text-[11px] text-blue-950 font-black block">
                🔍 تحقق واختر فرداً من قاعدة بيانات الكنيسة (بيان تبعيته لأندريا فرانسيس تلقائياً):
              </label>
              <input
                placeholder="ابحث في الداتابيز بالاسم أو الموبايل..."
                className="w-full p-2 border rounded-xl bg-white"
                value={userLookupQ}
                onChange={e => setUserLookupQ(e.target.value)}
              />
              {userLookupQ.trim().length >= 2 && matchedLookupUsers.length === 0 && (
                <div className="p-2.5 bg-rose-50 text-rose-900 border border-rose-200 rounded-xl text-[11px]">
                  غير موجود في قاعدة بيانات الكنيسة (ليس مسجلاً ضمن الداتابيز).
                </div>
              )}
              {matchedLookupUsers.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {matchedLookupUsers.map(u => {
                    const isUnderAndria = andriaRelatedUserIds.has(u.id);
                    const famTitle = userFamilyTitleLookup.get(u.id);

                    return (
                      <div key={u.id} className="bg-white p-2 rounded-xl border flex flex-wrap justify-between items-center gap-2 text-[11px]">
                        <div>
                          <strong>{getDisplayQuadName(u)}</strong> ({u.phone || '—'})
                          <span
                            className={`mr-1.5 px-2 py-0.5 rounded text-[10px] font-black ${
                              isUnderAndria
                                ? 'bg-emerald-100 text-emerald-950'
                                : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {isUnderAndria ? '✓ تبع أندريا فرانسيس' : 'مش تبع أندريا فرانسيس'}
                          </span>
                          {famTitle && (
                            <span className="mr-1.5 px-2 py-0.5 bg-purple-100 text-purple-950 rounded text-[10px] font-black">
                              {famTitle}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => importFromChurchUser(u, 'husband')} className="px-2 py-1 bg-blue-100 text-blue-900 rounded-lg cursor-pointer">كزوج</button>
                          <button type="button" onClick={() => importFromChurchUser(u, 'wife')} className="px-2 py-1 bg-pink-100 text-pink-900 rounded-lg cursor-pointer">كزوجة</button>
                          <button type="button" onClick={() => importFromChurchUser(u, 'father')} className="px-2 py-1 bg-amber-100 text-amber-900 rounded-lg cursor-pointer">كوالد</button>
                          <button type="button" onClick={() => importFromChurchUser(u, 'mother')} className="px-2 py-1 bg-purple-100 text-purple-900 rounded-lg cursor-pointer">كوالدة</button>
                        </div>
                      </div>
                    );
                  })}
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
                    readOnly
                    placeholder="يُحدد تلقائياً عند اختيار فرد من الداتابيز"
                    className="p-2 border rounded-xl bg-gray-100 text-gray-900 font-black cursor-default"
                    value={form.family_title}
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
                <strong className="text-xs font-black text-[#7a1c24] block">⑤ إضافة فرد أو ابن من قاعدة بيانات الكنيسة وتحديد صلته</strong>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    className="sm:col-span-2 p-2 border rounded-xl bg-white font-bold"
                    value={selectedChildDbUserId}
                    onChange={e => setSelectedChildDbUserId(e.target.value)}
                  >
                    <option value="">-- اختر شخصاً مسجلاً في الداتابيز --</option>
                    {dbMembersPool.map(u => {
                      const underAndria = andriaRelatedUserIds.has(u.id);
                      return (
                        <option key={u.id} value={u.id}>
                          {getDisplayQuadName(u)} {u.phone ? `(${u.phone})` : ''} {underAndria ? '— [تبع أندريا فرانسيس]' : '— [خارج خط أندريا]'}
                        </option>
                      );
                    })}
                  </select>

                  <select
                    className="p-2 border rounded-xl bg-amber-50 text-amber-950 font-black"
                    value={childRoleChoice}
                    onChange={e => setChildRoleChoice(e.target.value)}
                  >
                    {KINSHIP_ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!selectedChildDbUserId) return;
                    const dbUser = dbMembersPool.find(u => u.id === selectedChildDbUserId);
                    if (!dbUser) return;
                    const childObj = {
                      ...toPersonObjectFromUser(dbUser, dbUser.gender === 'أنثى' ? 'daughter' : 'son', false),
                      kinship_role: childRoleChoice
                    };
                    setForm(prev => ({ ...prev, children: [...(prev.children || []), childObj] }));
                    setSelectedChildDbUserId('');
                  }}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus size={13} /> + إضافة من الداتابيز بالصلة المحددة ({childRoleChoice})
                </button>

                {(form.children || []).length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {form.children.map((c, idx) => (
                      <div key={idx} className="bg-white p-2 rounded-xl border flex justify-between items-center gap-2">
                        <span>
                          • <strong>{c.full_name}</strong> ({c.kinship_role || c.marital_status})
                          {c.user_id && (
                            <span className="mr-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-950 rounded text-[9px] font-black">
                              {andriaRelatedUserIds.has(c.user_id) ? 'تبع أندريا فرانسيس ✓' : 'حساب كنيسة ✓'}
                            </span>
                          )}
                          {c.dob && ` • ميلاد: ${c.dob}`}
                          {c.study_status && ` • دراسة: ${c.study_status}`}
                          {c.job_title && ` • وظيفة: ${c.job_title}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveChildItem(idx)}
                          className="text-red-700 font-black cursor-pointer"
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
                  {saving ? 'جاري الحفظ والمزامنة مع الداتابيز...' : 'حفظ وتحديث الداتابيز كاملة ✅'}
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
                  📍 العنوان والمنطقة: {selectedFamily.address || selectedFamily.husband?.address || selectedFamily.wife?.address || 'غير مسجل'} • 🏷️ {selectedFamily.family_status}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedFamily(null)} className="p-1.5 bg-gray-100 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {Array.isArray(selectedFamily.connectedFamilies) && selectedFamily.connectedFamilies.length > 0 && (
              <div className="bg-purple-50/60 p-3 rounded-2xl border border-purple-200 space-y-1.5">
                <strong className="text-xs text-purple-950 block">🔗 الأسر المرتبطة صراحة:</strong>
                <div className="flex flex-wrap gap-1.5">
                  {selectedFamily.connectedFamilies.map(rel => (
                    <span
                      key={rel.key}
                      className="px-2.5 py-1 bg-white text-purple-950 border border-purple-200 rounded-xl text-[11px] font-black"
                    >
                      {rel.title} ({rel.relationLabel})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-2">
              {renderPersonCard('الزوج', selectedFamily.husband, '👨', 'husband', true)}
              {renderPersonCard('الزوجة', selectedFamily.wife, '👩', 'wife', true)}
              {renderPersonCard('الوالد', selectedFamily.father, '👴', 'father', true)}
              {renderPersonCard('الوالدة', selectedFamily.mother, '👵', 'mother', true)}
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
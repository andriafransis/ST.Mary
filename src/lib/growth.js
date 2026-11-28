// أدوات مشتركة للنمو الروحي (قانون روحي / مسابقات / آية اليوم)
export const splitCsv = (v) => String(v || '').split(/[,،]/).map(x => x.trim()).filter(Boolean);

export const TASK_KINDS = [
  { key: 'gospel', label: 'قراءة الإنجيل', icon: '📖' },
  { key: 'psalms', label: 'مزامير', icon: '🎵' },
  { key: 'prayer', label: 'صلاة', icon: '🙏' },
  { key: 'other', label: 'مهمة روحية', icon: '✨' }
];
export const kindMeta = (k) => TASK_KINDS.find(x => x.key === k) || TASK_KINDS[3];

export function memberStages(m) {
  const extra = Array.isArray(m?.permissions?.extra_services) ? m.permissions.extra_services : [];
  return [...new Set([...splitCsv(m?.detailed_stage), ...splitCsv(m?.service_stage), ...extra])];
}

// هل العنصر موجّه للمخدوم ده؟ (فاضي = الكل)
export function audienceMatches(item, member) {
  const stages = splitCsv(item?.target_stage);
  const classes = splitCsv(item?.target_class);
  if (stages.length > 0) {
    const mine = memberStages(member);
    if (!stages.some(s => mine.includes(s))) return false;
  }
  if (classes.length > 0) {
    const myClasses = splitCsv(member?.assigned_class);
    if (!classes.some(c => myClasses.includes(c))) return false;
  }
  return true;
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const isExpired = (item) => Boolean(item?.due_date) && item.due_date < todayISO();

export const SQL_MISSING_HINT = 'جداول النمو الروحي لسه مش متعملة. شغّل ملف spiritual_growth.sql مرة واحدة في Supabase.';
export const isMissingTable = (err) => {
  const msg = String(err?.message || '') + String(err?.code || '');
  return /does not exist|42P01|PGRST205|schema cache/i.test(msg);
};

export const COPTIC_MONTHS = [
  'توت',
  'بابه',
  'هاتور',
  'كيهك',
  'طوبة',
  'أمشير',
  'برمهات',
  'برمودة',
  'بشنس',
  'بؤونة',
  'أبيب',
  'مسرى',
  'النسيء'
];

const COPTIC_MONTHS_AR = COPTIC_MONTHS;

export function toCopticDate(inputDate) {
  if (!inputDate) return null;
  const date = inputDate instanceof Date ? inputDate : new Date(inputDate);
  if (Number.isNaN(date.getTime())) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-u-ca-coptic', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const parts = formatter.formatToParts(date);
    const year = Number(parts.find(p => p.type === 'year')?.value || 0);
    const month = Number(parts.find(p => p.type === 'month')?.value || 1);
    const day = Number(parts.find(p => p.type === 'day')?.value || 1);
    const monthName = COPTIC_MONTHS_AR[month - 1] || '';

    return {
      day,
      month,
      monthName,
      year,
      formatted: `${day} ${monthName} ${year} ش`
    };
  } catch {
    return null;
  }
}

export function getCopticMonthAndDay(inputDate) {
  const coptic = toCopticDate(inputDate);
  if (!coptic) {
    return { month: 1, day: 1, monthName: COPTIC_MONTHS[0] };
  }
  return {
    month: coptic.month,
    day: coptic.day,
    monthName: coptic.monthName
  };
}

export function formatCopticDate(inputDate, fallback = '') {
  const res = toCopticDate(inputDate);
  return res ? res.formatted : fallback;
}

export default toCopticDate;
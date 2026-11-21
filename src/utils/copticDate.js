export const COPTIC_MONTHS = [
  'توت', 'بابه', 'هاتور', 'كيهك', 'طوبة', 'أمشير',
  'برمهات', 'برمودة', 'بشنس', 'بؤونة', 'أبيب', 'مسرى', 'نسيء'
];

export function getCopticMonthAndDay(isoDateStr) {
  if (!isoDateStr) return { month: 'توت', day: 1, year: 1742 };
  const [Y, M, D] = isoDateStr.split('-').map(Number);
  if (!Y || !M || !D) return { month: 'توت', day: 1, year: 1742 };

  const a = Math.floor((14 - M) / 12);
  const y = Y + 4800 - a;
  const m = M + 12 * a - 3;
  const jdn =
    D +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;

  const r = jdn - 1825030;
  const cYear = Math.floor((4 * r + 1463) / 1461);
  const yearStart = 365 * (cYear - 1) + Math.floor(cYear / 4);
  const dayOfYear = r - yearStart;
  const cMonthIdx = Math.floor(dayOfYear / 30);
  const cDay = (dayOfYear % 30) + 1;

  return {
    month: COPTIC_MONTHS[cMonthIdx] || 'توت',
    day: cDay,
    year: cYear
  };
}

export function toCopticDate(isoDateStr) {
  if (!isoDateStr) return '';
  const { month, day, year } = getCopticMonthAndDay(isoDateStr);
  return `${day} ${month} ${year} ش`;
}
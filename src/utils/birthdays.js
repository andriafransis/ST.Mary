export function getUpcomingBirthdays(users = [], families = []) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkDaysLeft = (dobStr) => {
    if (!dobStr) return null;
    const [, m, d] = dobStr.split('-').map(Number);
    if (!m || !d) return null;
    let next = new Date(today.getFullYear(), m - 1, d);
    if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
    const diffDays = Math.round((next - today) / 86400000);
    return diffDays >= 0 && diffDays <= 7 ? diffDays : null;
  };

  const results = [];
  const seen = new Set();

  users.forEach(u => {
    const daysLeft = checkDaysLeft(u.dob);
    if (daysLeft !== null && !seen.has(`${u.full_name}-${u.dob}`)) {
      seen.add(`${u.full_name}-${u.dob}`);
      results.push({
        id: 'u_' + u.id,
        name: u.full_name,
        phone: u.phone || '',
        dob: u.dob,
        daysLeft,
        label: u.role === 'member' ? 'مخدوم' : u.role === 'servant' ? `خادم ${u.service_stage}` : u.sector || 'عضو'
      });
    }
  });

  families.forEach(f => {
    const famDays = checkDaysLeft(f.dob);
    if (famDays !== null && !seen.has(`${f.head_name}-${f.dob}`)) {
      seen.add(`${f.head_name}-${f.dob}`);
      results.push({
        id: 'f_' + f.id,
        name: f.head_name,
        phone: f.phone || '',
        dob: f.dob,
        daysLeft: famDays,
        label: 'رب أسرة'
      });
    }
  });

  return results.sort((a, b) => a.daysLeft - b.daysLeft);
}
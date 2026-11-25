export function getUpcomingBirthdays(users = [], families = [], daysAhead = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const candidates = [];

  if (Array.isArray(users)) {
    for (const u of users) {
      if (u?.dob) {
        candidates.push({
          id: u.id,
          name: u.full_name || u.username || 'مخدوم',
          dob: u.dob,
          phone: u.phone || '',
          stage: u.detailed_stage || u.service_stage || ''
        });
      }
    }
  }

  if (Array.isArray(families)) {
    for (const fam of families) {
      if (Array.isArray(fam?.children)) {
        for (const ch of fam.children) {
          if (ch?.dob) {
            candidates.push({
              id: ch.id,
              name: ch.full_name || ch.name || 'ابن/ابنة',
              dob: ch.dob,
              phone: ch.phone || fam.phone || '',
              stage: ch.stage || ''
            });
          }
        }
      }
    }
  }

  const upcoming = [];

  for (const item of candidates) {
    const birthDate = new Date(item.dob);
    if (Number.isNaN(birthDate.getTime())) continue;

    const month = birthDate.getMonth();
    const day = birthDate.getDate();

    let nextBirthday = new Date(today.getFullYear(), month, day);
    nextBirthday.setHours(0, 0, 0, 0);

    if (nextBirthday < today) {
      nextBirthday = new Date(today.getFullYear() + 1, month, day);
      nextBirthday.setHours(0, 0, 0, 0);
    }

    const diffDays = Math.round((nextBirthday - today) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= daysAhead) {
      const age = nextBirthday.getFullYear() - birthDate.getFullYear();
      upcoming.push({
        ...item,
        daysRemaining: diffDays,
        isToday: diffDays === 0,
        upcomingAge: age,
        nextBirthdayISO: nextBirthday.toISOString().split('T')[0]
      });
    }
  }

  return upcoming.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export default getUpcomingBirthdays;
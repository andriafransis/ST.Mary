const SCOUT_KEYWORDS = ['كشاف', 'كشافة', 'الكشافة', 'scout', 'scouts'];

export const hasScoutText = (val) => {
  if (!val) return false;
  const normalized = String(val).trim().toLowerCase();
  if (!normalized) return false;
  return SCOUT_KEYWORDS.some((kw) => normalized.includes(kw.toLowerCase()));
};

/**
 * يتحقق هل الخادم مرتبط بالكشافة أو متاح له بند / صلاحية الكشافة
 * @param {object} user - سجل المستخدم من church_users
 * @param {Array} services - مصفوفة church_services (اختياري)
 * @param {Array} serviceGroups - مصفوفة service_groups (اختياري)
 */
export const isScoutServant = (user, services = [], serviceGroups = []) => {
  if (!user) return false;

  // صلاحية صريحة إن وُجدت
  if (user.can_scan_invitations === true || user.is_scout === true) {
    return true;
  }
  if (user.can_scan_invitations === false) {
    return false;
  }

  // فحص حقول الخادم المباشرة
  const directFields = [
    user.service_stage,
    user.detailed_stage,
    user.assigned_class,
    user.sector,
    user.servant_role,
    user.sub_role,
    user.department
  ];
  if (directFields.some(hasScoutText)) {
    return true;
  }

  // فحص صلاحيات JSON/مصفوفة إن وُجدت
  if (Array.isArray(user.permissions) && user.permissions.some(hasScoutText)) {
    return true;
  }

  // فحص ارتباط الخادم بخدمات/فصول الكشافة في church_services
  const scoutServiceIds = new Set();
  const scoutClassNames = new Set();
  const scoutStageNames = new Set();

  (services || []).forEach((srv) => {
    const matchesScout =
      hasScoutText(srv.stage_name) ||
      hasScoutText(srv.class_name) ||
      hasScoutText(srv.service_name) ||
      hasScoutText(srv.name);

    if (matchesScout) {
      if (srv.id !== undefined && srv.id !== null) scoutServiceIds.add(String(srv.id));
      if (srv.class_name) scoutClassNames.add(String(srv.class_name).trim());
      if (srv.stage_name) scoutStageNames.add(String(srv.stage_name).trim());

      const userIdStr = String(user.id || '');
      const userNameStr = String(user.full_name || '').trim();

      const isAssignedLeader =
        (userIdStr && (
          String(srv.head_servant_id || '') === userIdStr ||
          String(srv.vice_head_id || '') === userIdStr ||
          String(srv.servant_id || '') === userIdStr ||
          String(srv.leader_id || '') === userIdStr
        )) ||
        (userNameStr && (
          String(srv.head_servant_name || '').trim() === userNameStr ||
          String(srv.vice_head_name || '').trim() === userNameStr
        ));

      if (isAssignedLeader) {
        scoutServiceIds.add('__MATCHED_USER__');
      }
    }
  });

  if (scoutServiceIds.has('__MATCHED_USER__')) {
    return true;
  }

  if (
    user.assigned_class &&
    scoutClassNames.has(String(user.assigned_class).trim())
  ) {
    return true;
  }

  if (
    user.service_stage &&
    scoutStageNames.has(String(user.service_stage).trim())
  ) {
    return true;
  }

  if (
    user.detailed_stage &&
    [...scoutStageNames, ...scoutClassNames].some((label) =>
      String(user.detailed_stage).includes(label)
    )
  ) {
    return true;
  }

  // فحص مجموعات الخدمة service_groups إن وُجدت
  const userIdStr = String(user.id || '');
  const matchedGroup = (serviceGroups || []).find((grp) => {
    const isScoutGrp =
      hasScoutText(grp.group_name) ||
      hasScoutText(grp.name) ||
      hasScoutText(grp.stage_name) ||
      hasScoutText(grp.category);
    if (!isScoutGrp) return false;

    const memberIds = Array.isArray(grp.member_ids)
      ? grp.member_ids.map(String)
      : [];
    const servantIds = Array.isArray(grp.servant_ids)
      ? grp.servant_ids.map(String)
      : [];

    return (
      (userIdStr && (
        memberIds.includes(userIdStr) ||
        servantIds.includes(userIdStr) ||
        String(grp.leader_id || '') === userIdStr ||
        String(grp.head_servant_id || '') === userIdStr
      ))
    );
  });

  return Boolean(matchedGroup);
};
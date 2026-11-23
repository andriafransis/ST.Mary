import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';

const DEFAULT_ICONS = [
  '⛪', '✝️', '🕊️', '📖', '🙏', '🏫', '👶', '👦', '👧', '🧑',
  '👴', '👵', '🎵', '🎶', '🎨', '⚽', '🏕️', '❤️', '🌟', '📢',
  '📋', '🗓️', '👥', '🏠', '🛡️', '🎓', '🎁', '🔥', '💡', '📌'
];

const DEFAULT_COLORS = [
  { name: 'أزرق ملكي', value: '#2563eb' },
  { name: 'بنفسجي', value: '#7c3aed' },
  { name: 'زمردي', value: '#059669' },
  { name: 'عنابي', value: '#be123c' },
  { name: 'برتقالي دافئ', value: '#ea580c' },
  { name: 'سماوي', value: '#0284c7' },
  { name: 'ذهبي داكن', value: '#b45309' },
  { name: 'رمادي أردوازي', value: '#334155' }
];

export default function NestedCardsBuilder({
  mode = 'builder',
  rootParentId = null,
  initialPath = [],
  onSelectCard,
  onExit,
  externalHierarchy = null,
  onRefresh = null
}) {
  const [allCards, setAllCards] = useState([]);
  const [currentParentId, setCurrentParentId] = useState(rootParentId);
  const [breadcrumbs, setBreadcrumbs] = useState(initialPath || []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // تبويب الإدارة في وضع builder: 'nested' | 'screen_cards'
  const [activeTab, setActiveTab] = useState('nested');

  // بيانات الكروت القادمة من الشاشات الأخرى (الخدمات والاجتماعات والفصول، الخدام، الكهنة، الإعلانات)
  const [hierarchyData, setHierarchyData] = useState(
    externalHierarchy || {
      groups: [],
      allClasses: [],
      users: [],
      priests: [],
      announcements: []
    }
  );
  const [screenFilter, setScreenFilter] = useState('all'); // 'all' | 'service_group' | 'service_class' | 'servant' | 'priest' | 'announcement'
  const [searchQuery, setSearchQuery] = useState('');

  // مودال إضافة / تعديل كارت متداخل
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    description: '',
    icon: '⛪',
    color: '#2563eb',
    card_type: 'category',
    action_type: 'drill_down',
    action_target: '',
    badge_text: '',
    sort_order: 1,
    is_active: true
  });

  // مودال تعديل / إضافة كارت تابع لشاشة أخرى
  const [editingLiveCard, setEditingLiveCard] = useState(null);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [liveForm, setLiveForm] = useState({
    sourceType: '',
    id: '',
    title: '',
    subtitle: '',
    description: '',
    icon: '📌',
    badge: '',
    extra1: '',
    extra2: '',
    extra3: '',
    sortOrder: 1
  });

  useEffect(() => {
    setCurrentParentId(rootParentId);
  }, [rootParentId]);

  useEffect(() => {
    if (Array.isArray(initialPath) && initialPath.length > 0) {
      setBreadcrumbs(initialPath);
    }
  }, [initialPath]);

  useEffect(() => {
    if (externalHierarchy) {
      setHierarchyData({
        groups: externalHierarchy.groups || [],
        allClasses: externalHierarchy.allClasses || [],
        users: externalHierarchy.users || [],
        priests: externalHierarchy.priests || [],
        announcements: externalHierarchy.announcements || []
      });
    }
  }, [externalHierarchy]);

  const notifyStatus = (type, msg) => {
    if (type === 'error') {
      setErrorMsg(msg);
      setSuccessMsg('');
    } else {
      setSuccessMsg(msg);
      setErrorMsg('');
    }
    setTimeout(() => {
      setErrorMsg('');
      setSuccessMsg('');
    }, 4000);
  };

  const fetchCards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('nested_cards')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAllCards(data || []);
    } catch (err) {
      console.error('Error loading nested_cards:', err);
      notifyStatus('error', 'تعذر تحميل الكروت من قاعدة البيانات: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveSourcesIfNeeded = async () => {
    if (externalHierarchy) return;
    try {
      const [groupsRes, classesRes, usersRes, annRes] = await Promise.all([
        supabase.from('service_groups').select('*').order('sort_order', { ascending: true }),
        supabase.from('services').select('*').order('id', { ascending: true }),
        supabase.from('church_users').select('*').order('id', { ascending: true }),
        supabase.from('church_announcements').select('*').order('id', { ascending: false })
      ]);

      const usersList = usersRes.data || [];
      const priestsList = usersList.filter(
        (u) =>
          String(u.role || '').toLowerCase().includes('priest') ||
          String(u.role_ar || '').includes('كاهن') ||
          String(u.job_title || '').includes('كاهن')
      );

      setHierarchyData({
        groups: groupsRes.data || [],
        allClasses: classesRes.data || [],
        users: usersList,
        priests: priestsList,
        announcements: annRes.data || []
      });
    } catch (err) {
      console.error('Error loading live sources:', err);
    }
  };

  useEffect(() => {
    fetchCards();
    fetchLiveSourcesIfNeeded();
  }, []);

  const visibleCards = useMemo(() => {
    return allCards.filter((card) => {
      const parentMatches =
        currentParentId === null || currentParentId === undefined
          ? card.parent_id === null || card.parent_id === undefined
          : String(card.parent_id) === String(currentParentId);

      if (!parentMatches) return false;
      if (mode === 'viewer') {
        return card.is_active !== false;
      }
      return true;
    });
  }, [allCards, currentParentId, mode]);

  const getChildrenCount = (cardId) => {
    return allCards.filter((c) => String(c.parent_id) === String(cardId)).length;
  };

  const currentParentCard = useMemo(() => {
    if (!currentParentId) return null;
    return allCards.find((c) => String(c.id) === String(currentParentId)) || null;
  }, [allCards, currentParentId]);

  const handleOpenCard = (card) => {
    const childrenCount = getChildrenCount(card.id);

    if (mode === 'viewer') {
      if (card.action_type === 'link' && card.action_target) {
        if (card.action_target.startsWith('http')) {
          window.open(card.action_target, '_blank', 'noopener,noreferrer');
        } else if (onSelectCard) {
          onSelectCard(card);
        }
        return;
      }

      if (card.action_type === 'select' && onSelectCard) {
        onSelectCard(card);
        return;
      }

      if (childrenCount > 0 || card.action_type === 'drill_down') {
        setBreadcrumbs((prev) => [...prev, { id: card.id, title: card.title }]);
        setCurrentParentId(card.id);
        return;
      }

      if (onSelectCard) {
        onSelectCard(card);
      }
      return;
    }

    setBreadcrumbs((prev) => [...prev, { id: card.id, title: card.title }]);
    setCurrentParentId(card.id);
  };

  const handleBreadcrumbClick = (index) => {
    if (index < 0) {
      setBreadcrumbs([]);
      setCurrentParentId(rootParentId);
      return;
    }
    const target = breadcrumbs[index];
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    setCurrentParentId(target.id);
  };

  const goBackOneLevel = () => {
    if (breadcrumbs.length > 0) {
      const newCrumbs = breadcrumbs.slice(0, -1);
      setBreadcrumbs(newCrumbs);
      const prevCrumb = newCrumbs[newCrumbs.length - 1];
      setCurrentParentId(prevCrumb ? prevCrumb.id : rootParentId);
    } else if (currentParentId !== rootParentId) {
      setCurrentParentId(rootParentId);
    } else if (onExit) {
      onExit();
    }
  };

  const openAddModal = () => {
    setEditingCard(null);
    const nextOrder = visibleCards.length + 1;
    setFormData({
      title: '',
      subtitle: '',
      description: '',
      icon: '⛪',
      color: '#2563eb',
      card_type: 'category',
      action_type: 'drill_down',
      action_target: '',
      badge_text: '',
      sort_order: nextOrder,
      is_active: true
    });
    setShowModal(true);
  };

  const openEditModal = (e, card) => {
    e.stopPropagation();
    setEditingCard(card);
    setFormData({
      title: card.title || '',
      subtitle: card.subtitle || '',
      description: card.description || '',
      icon: card.icon || '⛪',
      color: card.color || '#2563eb',
      card_type: card.card_type || 'category',
      action_type: card.action_type || 'drill_down',
      action_target: card.action_target || '',
      badge_text: card.badge_text || '',
      sort_order: card.sort_order ?? 1,
      is_active: card.is_active !== false
    });
    setShowModal(true);
  };

  const handleSaveCard = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      notifyStatus('error', 'يرجى إدخال عنوان الكارت.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        parent_id: currentParentId || null,
        title: formData.title.trim(),
        subtitle: formData.subtitle.trim() || null,
        description: formData.description.trim() || null,
        icon: formData.icon || '⛪',
        color: formData.color || '#2563eb',
        card_type: formData.card_type || 'category',
        action_type: formData.action_type || 'drill_down',
        action_target: formData.action_target.trim() || null,
        badge_text: formData.badge_text.trim() || null,
        sort_order: Number(formData.sort_order) || 1,
        is_active: Boolean(formData.is_active)
      };

      if (editingCard) {
        const { error } = await supabase
          .from('nested_cards')
          .update(payload)
          .eq('id', editingCard.id);
        if (error) throw error;
        notifyStatus('success', 'تم تحديث الكارت بنجاح.');
      } else {
        const { error } = await supabase
          .from('nested_cards')
          .insert([payload]);
        if (error) throw error;
        notifyStatus('success', 'تم إضافة الكارت الجديد بنجاح.');
      }

      setShowModal(false);
      setEditingCard(null);
      await fetchCards();
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error('Error saving card:', err);
      notifyStatus('error', 'حدث خطأ أثناء حفظ الكارت: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCard = async (e, card) => {
    e.stopPropagation();
    const childrenCount = getChildrenCount(card.id);
    const confirmMsg =
      childrenCount > 0
        ? `سيتم حذف الكارت "${card.title}" وجميع الكروت الفرعية التابعة له (${childrenCount} كارت). هل أنت متأكد؟`
        : `هل أنت متأكد من حذف الكارت "${card.title}"؟`;

    if (!window.confirm(confirmMsg)) return;

    setSaving(true);
    try {
      const deleteRecursive = async (targetId) => {
        const directChildren = allCards.filter((c) => String(c.parent_id) === String(targetId));
        for (const child of directChildren) {
          await deleteRecursive(child.id);
        }
        const { error } = await supabase.from('nested_cards').delete().eq('id', targetId);
        if (error) throw error;
      };

      await deleteRecursive(card.id);
      notifyStatus('success', 'تم حذف الكارت بنجاح.');
      await fetchCards();
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error('Error deleting card:', err);
      notifyStatus('error', 'تعذر حذف الكارت: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const toggleCardActive = async (e, card) => {
    e.stopPropagation();
    try {
      const nextVal = card.is_active === false ? true : false;
      const { error } = await supabase
        .from('nested_cards')
        .update({ is_active: nextVal })
        .eq('id', card.id);
      if (error) throw error;
      setAllCards((prev) =>
        prev.map((item) => (item.id === card.id ? { ...item, is_active: nextVal } : item))
      );
      notifyStatus('success', nextVal ? 'تم تفعيل الكارت.' : 'تم إخفاء الكارت.');
    } catch (err) {
      notifyStatus('error', 'تعذر تغيير حالة الكارت: ' + (err.message || ''));
    }
  };

  // تجميع الكروت الفعالة من الشاشات الأخرى
  const allScreenCards = useMemo(() => {
    const items = [];

    (hierarchyData.groups || []).forEach((g, idx) => {
      items.push({
        uid: `grp-${g.id || idx}`,
        sourceType: 'service_group',
        sourceLabel: 'الخدمات والاجتماعات',
        icon: g.icon || '🏫',
        title: g.group_name || 'مجموعة خدمة',
        subtitle: g.head_servant_name ? `أمين الخدمة: ${g.head_servant_name}` : g.service_day || '',
        description: g.servants_names || '',
        badge: g.has_classes === false ? 'بدون فصول' : 'له فصول',
        sortOrder: g.sort_order ?? idx + 1,
        raw: g
      });
    });

    (hierarchyData.allClasses || []).forEach((c, idx) => {
      items.push({
        uid: `cls-${c.id || idx}`,
        sourceType: 'service_class',
        sourceLabel: 'فصل خدمة',
        icon: '📘',
        title: c.class_name || 'فصل',
        subtitle: `${c.group_name || ''} ${c.stage_name ? '— ' + c.stage_name : ''}`.trim(),
        description: c.servant_name ? `خادم الفصل: ${c.servant_name}` : '',
        badge: c.meeting_day || '',
        sortOrder: c.sort_order ?? idx + 1,
        raw: c
      });
    });

    (hierarchyData.priests || []).forEach((p, idx) => {
      items.push({
        uid: `pr-${p.id || idx}`,
        sourceType: 'priest',
        sourceLabel: 'الآباء الكهنة',
        icon: '✝️',
        title: p.full_name || p.name || 'أب كاهن',
        subtitle: p.service_stage || p.job_title || 'كاهن الخدمة',
        description: p.phone || '',
        badge: 'كاهن',
        sortOrder: idx + 1,
        raw: p
      });
    });

    const nonPriestUsers = (hierarchyData.users || []).filter(
      (u) =>
        !(
          String(u.role || '').toLowerCase().includes('priest') ||
          String(u.role_ar || '').includes('كاهن') ||
          String(u.job_title || '').includes('كاهن')
        )
    );
    nonPriestUsers.forEach((u, idx) => {
      items.push({
        uid: `usr-${u.id || idx}`,
        sourceType: 'servant',
        sourceLabel: 'الخدام والمخدومين',
        icon: u.gender === 'female' || u.gender === 'أنثى' ? '👩' : '👨',
        title: u.full_name || u.name || 'مستخدم',
        subtitle: u.assigned_class || u.service_stage || u.role_ar || u.role || '',
        description: u.phone || '',
        badge: u.role_ar || u.role || 'عضو',
        sortOrder: idx + 1,
        raw: u
      });
    });

    (hierarchyData.announcements || []).forEach((a, idx) => {
      items.push({
        uid: `ann-${a.id || idx}`,
        sourceType: 'announcement',
        sourceLabel: 'الإعلانات والتنبيهات',
        icon: '📢',
        title: a.title || 'إعلان',
        subtitle: a.created_at ? String(a.created_at).slice(0, 10) : '',
        description: a.body || a.content || '',
        badge: a.is_pinned ? 'مثبت' : 'إعلان',
        sortOrder: idx + 1,
        raw: a
      });
    });

    return items.filter((item) => {
      if (screenFilter !== 'all' && item.sourceType !== screenFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        String(item.title).toLowerCase().includes(q) ||
        String(item.subtitle).toLowerCase().includes(q) ||
        String(item.description).toLowerCase().includes(q) ||
        String(item.sourceLabel).toLowerCase().includes(q)
      );
    });
  }, [hierarchyData, screenFilter, searchQuery]);

  const openEditLiveCard = (item) => {
    const raw = item.raw || {};
    setEditingLiveCard(item);

    if (item.sourceType === 'service_group') {
      setLiveForm({
        sourceType: 'service_group',
        id: raw.id || '',
        title: raw.group_name || '',
        subtitle: raw.head_servant_name || '',
        description: raw.servants_names || '',
        icon: raw.icon || '🏫',
        badge: raw.has_classes === false ? 'no' : 'yes',
        extra1: raw.gender_target || 'عام (الكل: ذكور وإناث)',
        extra2: raw.service_day || '',
        extra3: Array.isArray(raw.stages) ? raw.stages.join('، ') : raw.stages || '',
        sortOrder: raw.sort_order ?? 1
      });
    } else if (item.sourceType === 'service_class') {
      setLiveForm({
        sourceType: 'service_class',
        id: raw.id || '',
        title: raw.class_name || '',
        subtitle: raw.stage_name || '',
        description: raw.servant_name || raw.vice_head_name || '',
        icon: '📘',
        badge: raw.meeting_day || '',
        extra1: raw.group_name || '',
        extra2: raw.meeting_time || '',
        extra3: '',
        sortOrder: raw.sort_order ?? 1
      });
    } else if (item.sourceType === 'announcement') {
      setLiveForm({
        sourceType: 'announcement',
        id: raw.id || '',
        title: raw.title || '',
        subtitle: '',
        description: raw.body || raw.content || '',
        icon: '📢',
        badge: raw.is_pinned ? 'pinned' : 'normal',
        extra1: '',
        extra2: '',
        extra3: '',
        sortOrder: 1
      });
    } else {
      setLiveForm({
        sourceType: item.sourceType,
        id: raw.id || '',
        title: raw.full_name || raw.name || '',
        subtitle: raw.service_stage || '',
        description: raw.assigned_class || '',
        icon: item.icon || '👤',
        badge: raw.role_ar || raw.role || '',
        extra1: raw.phone || '',
        extra2: '',
        extra3: '',
        sortOrder: 1
      });
    }

    setShowLiveModal(true);
  };

  const openAddLiveGroupModal = () => {
    setEditingLiveCard(null);
    setLiveForm({
      sourceType: 'service_group',
      id: '',
      title: '',
      subtitle: '',
      description: '',
      icon: '🏫',
      badge: 'yes',
      extra1: 'عام (الكل: ذكور وإناث)',
      extra2: '',
      extra3: '',
      sortOrder: (hierarchyData.groups?.length || 0) + 1
    });
    setShowLiveModal(true);
  };

  const handleSaveLiveCard = async (e) => {
    e.preventDefault();
    if (!liveForm.title.trim()) {
      notifyStatus('error', 'يرجى إدخال العنوان / الاسم.');
      return;
    }

    setSaving(true);
    try {
      const targetRecordId = editingLiveCard?.raw?.id || liveForm.id;

      if (liveForm.sourceType === 'service_group') {
        const stagesArr = String(liveForm.extra3 || '')
          .split(/[,،]/)
          .map((s) => s.trim())
          .filter(Boolean);

        const payload = {
          group_name: liveForm.title.trim(),
          icon: (liveForm.icon || '🏫').trim(),
          has_classes: liveForm.badge !== 'no',
          gender_target: liveForm.extra1 || 'عام (الكل: ذكور وإناث)',
          head_servant_name: (liveForm.subtitle || '').trim(),
          servants_names: (liveForm.description || '').trim(),
          service_day: (liveForm.extra2 || '').trim(),
          stages: stagesArr,
          sort_order: Number(liveForm.sortOrder || 1)
        };

        if (targetRecordId) {
          const { error } = await supabase
            .from('service_groups')
            .update(payload)
            .eq('id', targetRecordId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('service_groups')
            .insert([payload]);
          if (error) throw error;
        }
      } else if (liveForm.sourceType === 'service_class') {
        if (!targetRecordId) throw new Error('معرّف الفصل غير موجود');
        const payload = {
          class_name: liveForm.title.trim(),
          stage_name: (liveForm.subtitle || '').trim(),
          servant_name: (liveForm.description || '').trim(),
          meeting_day: (liveForm.badge || '').trim(),
          group_name: (liveForm.extra1 || '').trim(),
          meeting_time: (liveForm.extra2 || '').trim(),
          sort_order: Number(liveForm.sortOrder || 1)
        };
        const { error } = await supabase
          .from('services')
          .update(payload)
          .eq('id', targetRecordId);
        if (error) throw error;
      } else if (liveForm.sourceType === 'announcement') {
        const payload = {
          title: liveForm.title.trim(),
          body: (liveForm.description || '').trim(),
          is_pinned: liveForm.badge === 'pinned'
        };
        if (targetRecordId) {
          const { error } = await supabase
            .from('church_announcements')
            .update(payload)
            .eq('id', targetRecordId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('church_announcements')
            .insert([payload]);
          if (error) throw error;
        }
      } else {
        if (!targetRecordId) throw new Error('معرّف المستخدم غير موجود');
        const payload = {
          full_name: liveForm.title.trim(),
          service_stage: (liveForm.subtitle || '').trim(),
          assigned_class: (liveForm.description || '').trim(),
          phone: (liveForm.extra1 || '').trim()
        };
        const { error } = await supabase
          .from('church_users')
          .update(payload)
          .eq('id', targetRecordId);
        if (error) throw error;
      }

      notifyStatus('success', 'تم حفظ التعديلات بنجاح.');
      setShowLiveModal(false);
      setEditingLiveCard(null);
      await fetchLiveSourcesIfNeeded();
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error('Error saving live card:', err);
      notifyStatus('error', 'حدث خطأ أثناء الحفظ: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLiveCard = async (item) => {
    const rawId = item?.raw?.id;
    if (!rawId) return;
    if (!window.confirm(`هل أنت متأكد من حذف "${item.title}"؟`)) return;

    setSaving(true);
    try {
      let tableName = '';
      if (item.sourceType === 'service_group') tableName = 'service_groups';
      else if (item.sourceType === 'service_class') tableName = 'services';
      else if (item.sourceType === 'announcement') tableName = 'church_announcements';
      else tableName = 'church_users';

      const { error } = await supabase.from(tableName).delete().eq('id', rawId);
      if (error) throw error;

      notifyStatus('success', 'تم الحذف بنجاح.');
      await fetchLiveSourcesIfNeeded();
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error('Error deleting live card:', err);
      notifyStatus('error', 'تعذر الحذف: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir="rtl" style={styles.container}>
      {/* شريط العنوان والتنقل العلوي */}
      <div style={styles.headerBar}>
        <div style={styles.headerRight}>
          {(breadcrumbs.length > 0 || currentParentId !== rootParentId || onExit) && (
            <button type="button" onClick={goBackOneLevel} style={styles.backBtn}>
              ← رجوع
            </button>
          )}
          <div>
            <h2 style={styles.title}>
              {mode === 'viewer'
                ? currentParentCard?.title || 'الدليل والكروت التفاعلية'
                : 'منشئ الكروت المتداخلة وإدارة الكروت'}
            </h2>
            {currentParentCard?.subtitle && (
              <p style={styles.subtitle}>{currentParentCard.subtitle}</p>
            )}
          </div>
        </div>

        {mode === 'builder' && (
          <div style={styles.headerActions}>
            <div style={styles.tabSwitch}>
              <button
                type="button"
                onClick={() => setActiveTab('nested')}
                style={{
                  ...styles.tabBtn,
                  ...(activeTab === 'nested' ? styles.tabBtnActive : {})
                }}
              >
                🗂️ الكروت المتداخلة ({allCards.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('screen_cards')}
                style={{
                  ...styles.tabBtn,
                  ...(activeTab === 'screen_cards' ? styles.tabBtnActive : {})
                }}
              >
                🧩 كروت الشاشات ({allScreenCards.length})
              </button>
            </div>

            {activeTab === 'nested' ? (
              <button type="button" onClick={openAddModal} style={styles.primaryBtn}>
                + إضافة كارت هنا
              </button>
            ) : (
              <button type="button" onClick={openAddLiveGroupModal} style={styles.primaryBtn}>
                + إضافة مجموعة خدمة
              </button>
            )}
          </div>
        )}
      </div>

      {/* رسائل التنبيه */}
      {errorMsg && <div style={styles.errorAlert}>⚠️ {errorMsg}</div>}
      {successMsg && <div style={styles.successAlert}>✅ {successMsg}</div>}

      {/* مسار التنقل Breadcrumbs */}
      <div style={styles.breadcrumbBar}>
        <button
          type="button"
          onClick={() => handleBreadcrumbClick(-1)}
          style={{
            ...styles.crumbBtn,
            ...(breadcrumbs.length === 0 ? styles.crumbActive : {})
          }}
        >
          🏠 المستوى الرئيسي
        </button>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.id || idx}>
            <span style={styles.crumbSep}>/</span>
            <button
              type="button"
              onClick={() => handleBreadcrumbClick(idx)}
              style={{
                ...styles.crumbBtn,
                ...(idx === breadcrumbs.length - 1 ? styles.crumbActive : {})
              }}
            >
              {crumb.title}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* محتوى تبويب الكروت المتداخلة */}
      {activeTab === 'nested' ? (
        loading ? (
          <div style={styles.centerBox}>جاري تحميل الكروت...</div>
        ) : visibleCards.length === 0 ? (
          <div style={styles.emptyBox}>
            <p style={styles.emptyText}>لا توجد كروت في هذا المستوى حتى الآن.</p>
            {mode === 'builder' && (
              <button type="button" onClick={openAddModal} style={styles.primaryBtn}>
                + أضف أول كارت في هذا المستوى
              </button>
            )}
          </div>
        ) : (
          <div style={styles.cardsGrid}>
            {visibleCards.map((card) => {
              const childCount = getChildrenCount(card.id);
              const accent = card.color || '#2563eb';
              const isHidden = card.is_active === false;

              return (
                <div
                  key={card.id}
                  onClick={() => handleOpenCard(card)}
                  style={{
                    ...styles.card,
                    borderTop: `4px solid ${accent}`,
                    opacity: isHidden ? 0.6 : 1
                  }}
                >
                  <div style={styles.cardTopRow}>
                    <div style={{ ...styles.iconBadge, backgroundColor: `${accent}18`, color: accent }}>
                      {card.icon || '⛪'}
                    </div>
                    <div style={styles.badgesGroup}>
                      {card.badge_text && (
                        <span style={{ ...styles.badge, backgroundColor: `${accent}20`, color: accent }}>
                          {card.badge_text}
                        </span>
                      )}
                      {childCount > 0 && (
                        <span style={styles.childrenBadge}>{childCount} كارت بالداخل</span>
                      )}
                      {isHidden && <span style={styles.hiddenBadge}>مخفي</span>}
                    </div>
                  </div>

                  <h3 style={styles.cardTitle}>{card.title}</h3>
                  {card.subtitle && <p style={styles.cardSubtitle}>{card.subtitle}</p>}
                  {card.description && <p style={styles.cardDesc}>{card.description}</p>}

                  <div style={styles.cardFooter}>
                    <span style={{ ...styles.openHint, color: accent }}>
                      {childCount > 0 || card.action_type === 'drill_down'
                        ? 'فتح المستوى الداخلي ←'
                        : 'عرض التفاصيل ←'}
                    </span>

                    {mode === 'builder' && (
                      <div style={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title={isHidden ? 'تفعيل الكارت' : 'إخفاء الكارت'}
                          onClick={(e) => toggleCardActive(e, card)}
                          style={styles.iconActionBtn}
                        >
                          {isHidden ? '👁️' : '🙈'}
                        </button>
                        <button
                          type="button"
                          title="تعديل الكارت"
                          onClick={(e) => openEditModal(e, card)}
                          style={styles.iconActionBtn}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          title="حذف الكارت"
                          onClick={(e) => handleDeleteCard(e, card)}
                          style={{ ...styles.iconActionBtn, color: '#dc2626' }}
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* محتوى تبويب كروت الشاشات */
        <div>
          <div style={styles.filterToolbar}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في كروت الشاشات بالاسم أو الخدمة أو الوصف..."
              style={styles.searchInput}
            />
            <select
              value={screenFilter}
              onChange={(e) => setScreenFilter(e.target.value)}
              style={styles.selectInput}
            >
              <option value="all">كل الشاشات</option>
              <option value="service_group">الخدمات والاجتماعات</option>
              <option value="service_class">فصول الخدمة</option>
              <option value="priest">الآباء الكهنة</option>
              <option value="servant">الخدام والمخدومين</option>
              <option value="announcement">الإعلانات</option>
            </select>
          </div>

          {allScreenCards.length === 0 ? (
            <div style={styles.emptyBox}>
              <p style={styles.emptyText}>لا توجد كروت مطابقة للبحث أو الفلتر الحالي.</p>
            </div>
          ) : (
            <div style={styles.cardsGrid}>
              {allScreenCards.map((item) => (
                <div key={item.uid} style={styles.card}>
                  <div style={styles.cardTopRow}>
                    <div style={styles.iconBadge}>{item.icon}</div>
                    <div style={styles.badgesGroup}>
                      <span style={styles.sourceBadge}>{item.sourceLabel}</span>
                      {item.badge && <span style={styles.childrenBadge}>{item.badge}</span>}
                    </div>
                  </div>
                  <h3 style={styles.cardTitle}>{item.title}</h3>
                  {item.subtitle && <p style={styles.cardSubtitle}>{item.subtitle}</p>}
                  {item.description && <p style={styles.cardDesc}>{item.description}</p>}

                  <div style={styles.cardFooter}>
                    <span style={styles.mutedMeta}>ترتيب: {item.sortOrder}</span>
                    <div style={styles.cardActions}>
                      <button
                        type="button"
                        onClick={() => openEditLiveCard(item)}
                        style={styles.secondarySmallBtn}
                      >
                        ✏️ تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLiveCard(item)}
                        style={styles.dangerSmallBtn}
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* مودال إضافة / تعديل كارت متداخل */}
      {showModal && (
        <div style={styles.modalBackdrop} onClick={() => setShowModal(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {editingCard ? 'تعديل الكارت المتداخل' : 'إضافة كارت متداخل جديد'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} style={styles.closeBtn}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCard} style={styles.formGrid}>
              <label style={styles.label}>
                عنوان الكارت *
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={styles.input}
                  placeholder="مثال: مدارس الأحد / خدمة الشباب"
                />
              </label>

              <label style={styles.label}>
                عنوان فرعي
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  style={styles.input}
                  placeholder="مثال: يوم الجمعة الساعة 10 صباحاً"
                />
              </label>

              <label style={{ ...styles.label, gridColumn: '1 / -1' }}>
                الوصف أو التفاصيل
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={styles.textarea}
                  placeholder="اكتب نبذة مختصرة أو ملاحظات تظهر داخل الكارت..."
                />
              </label>

              <label style={styles.label}>
                الأيقونة
                <div style={styles.pickerRow}>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    style={{ ...styles.input, width: 70, textAlign: 'center' }}
                  />
                  <div style={styles.chipsWrap}>
                    {DEFAULT_ICONS.slice(0, 10).map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: ic })}
                        style={styles.miniChip}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
              </label>

              <label style={styles.label}>
                لون الكارت
                <div style={styles.pickerRow}>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    style={styles.colorInput}
                  />
                  <div style={styles.chipsWrap}>
                    {DEFAULT_COLORS.map((col) => (
                      <button
                        key={col.value}
                        type="button"
                        title={col.name}
                        onClick={() => setFormData({ ...formData, color: col.value })}
                        style={{
                          ...styles.colorDot,
                          backgroundColor: col.value,
                          outline:
                            formData.color === col.value ? '2px solid #0f172a' : 'none'
                        }}
                      />
                    ))}
                  </div>
                </div>
              </label>

              <label style={styles.label}>
                نوع الإجراء عند الضغط
                <select
                  value={formData.action_type}
                  onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
                  style={styles.input}
                >
                  <option value="drill_down">الدخول إلى كروت فرعية</option>
                  <option value="select">اختيار الكارت / إرسال الحدث</option>
                  <option value="link">فتح رابط خارجي أو داخلي</option>
                </select>
              </label>

              <label style={styles.label}>
                الهدف / الرابط (اختياري)
                <input
                  type="text"
                  value={formData.action_target}
                  onChange={(e) => setFormData({ ...formData, action_target: e.target.value })}
                  style={styles.input}
                  placeholder="https://... أو اسم شاشة"
                />
              </label>

              <label style={styles.label}>
                شارة صغيرة (Badge)
                <input
                  type="text"
                  value={formData.badge_text}
                  onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                  style={styles.input}
                  placeholder="مثال: جديد / مهم"
                />
              </label>

              <label style={styles.label}>
                ترتيب العرض
                <input
                  type="number"
                  min={1}
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                  style={styles.input}
                />
              </label>

              <label style={{ ...styles.checkboxLabel, gridColumn: '1 / -1' }}>
                <input
                  type="checkbox"
                  checked={Boolean(formData.is_active)}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                الكارت نشط وظاهر للمستخدمين
              </label>

              <div style={{ ...styles.modalFooter, gridColumn: '1 / -1' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={styles.cancelBtn}
                >
                  إلغاء
                </button>
                <button type="submit" disabled={saving} style={styles.primaryBtn}>
                  {saving ? 'جاري الحفظ...' : 'حفظ الكارت'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال تعديل / إضافة كارت تابع لشاشة أخرى */}
      {showLiveModal && (
        <div style={styles.modalBackdrop} onClick={() => setShowLiveModal(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {editingLiveCard ? 'تعديل بيانات الكارت' : 'إضافة مجموعة خدمة جديدة'}
              </h3>
              <button type="button" onClick={() => setShowLiveModal(false)} style={styles.closeBtn}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLiveCard} style={styles.formGrid}>
              <label style={styles.label}>
                الاسم / العنوان *
                <input
                  type="text"
                  required
                  value={liveForm.title}
                  onChange={(e) => setLiveForm({ ...liveForm, title: e.target.value })}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                {liveForm.sourceType === 'service_group'
                  ? 'أمين الخدمة'
                  : liveForm.sourceType === 'service_class'
                  ? 'المرحلة الدراسية / العمرية'
                  : 'التفاصيل الفرعية / المرحلة'}
                <input
                  type="text"
                  value={liveForm.subtitle}
                  onChange={(e) => setLiveForm({ ...liveForm, subtitle: e.target.value })}
                  style={styles.input}
                />
              </label>

              <label style={{ ...styles.label, gridColumn: '1 / -1' }}>
                {liveForm.sourceType === 'service_group'
                  ? 'أسماء الخدام'
                  : liveForm.sourceType === 'service_class'
                  ? 'خادم الفصل'
                  : 'الوصف / المحتوى'}
                <textarea
                  rows={3}
                  value={liveForm.description}
                  onChange={(e) => setLiveForm({ ...liveForm, description: e.target.value })}
                  style={styles.textarea}
                />
              </label>

              {liveForm.sourceType === 'service_group' && (
                <>
                  <label style={styles.label}>
                    الأيقونة
                    <input
                      type="text"
                      value={liveForm.icon}
                      onChange={(e) => setLiveForm({ ...liveForm, icon: e.target.value })}
                      style={styles.input}
                    />
                  </label>
                  <label style={styles.label}>
                    نظام الفصول
                    <select
                      value={liveForm.badge}
                      onChange={(e) => setLiveForm({ ...liveForm, badge: e.target.value })}
                      style={styles.input}
                    >
                      <option value="yes">له فصول</option>
                      <option value="no">بدون فصول</option>
                    </select>
                  </label>
                  <label style={styles.label}>
                    الفئة المستهدفة
                    <input
                      type="text"
                      value={liveForm.extra1}
                      onChange={(e) => setLiveForm({ ...liveForm, extra1: e.target.value })}
                      style={styles.input}
                    />
                  </label>
                  <label style={styles.label}>
                    يوم الخدمة
                    <input
                      type="text"
                      value={liveForm.extra2}
                      onChange={(e) => setLiveForm({ ...liveForm, extra2: e.target.value })}
                      style={styles.input}
                    />
                  </label>
                  <label style={{ ...styles.label, gridColumn: '1 / -1' }}>
                    المراحل (مفصولة بفاصلة ،)
                    <input
                      type="text"
                      value={liveForm.extra3}
                      onChange={(e) => setLiveForm({ ...liveForm, extra3: e.target.value })}
                      style={styles.input}
                    />
                  </label>
                </>
              )}

              {liveForm.sourceType === 'service_class' && (
                <>
                  <label style={styles.label}>
                    اسم الخدمة / المجموعة
                    <input
                      type="text"
                      value={liveForm.extra1}
                      onChange={(e) => setLiveForm({ ...liveForm, extra1: e.target.value })}
                      style={styles.input}
                    />
                  </label>
                  <label style={styles.label}>
                    يوم الاجتماع
                    <input
                      type="text"
                      value={liveForm.badge}
                      onChange={(e) => setLiveForm({ ...liveForm, badge: e.target.value })}
                      style={styles.input}
                    />
                  </label>
                </>
              )}

              {liveForm.sourceType === 'announcement' && (
                <label style={styles.label}>
                  حالة الإعلان
                  <select
                    value={liveForm.badge}
                    onChange={(e) => setLiveForm({ ...liveForm, badge: e.target.value })}
                    style={styles.input}
                  >
                    <option value="normal">عادي</option>
                    <option value="pinned">مثبت</option>
                  </select>
                </label>
              )}

              <div style={{ ...styles.modalFooter, gridColumn: '1 / -1' }}>
                <button
                  type="button"
                  onClick={() => setShowLiveModal(false)}
                  style={styles.cancelBtn}
                >
                  إلغاء
                </button>
                <button type="submit" disabled={saving} style={styles.primaryBtn}>
                  {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: 16,
    fontFamily: 'inherit',
    color: '#0f172a'
  },
  headerBar: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10
  },
  headerActions: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#475569'
  },
  backBtn: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    cursor: 'pointer',
    fontWeight: 600
  },
  tabSwitch: {
    display: 'flex',
    background: '#f1f5f9',
    padding: 4,
    borderRadius: 10,
    gap: 4
  },
  tabBtn: {
    padding: '7px 12px',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontWeight: 600,
    color: '#475569'
  },
  tabBtnActive: {
    background: '#ffffff',
    color: '#0f172a',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
  },
  primaryBtn: {
    padding: '9px 16px',
    borderRadius: 9,
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer'
  },
  cancelBtn: {
    padding: '9px 16px',
    borderRadius: 9,
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    fontWeight: 600,
    cursor: 'pointer'
  },
  secondarySmallBtn: {
    padding: '5px 10px',
    borderRadius: 7,
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600
  },
  dangerSmallBtn: {
    padding: '5px 10px',
    borderRadius: 7,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600
  },
  errorAlert: {
    padding: '10px 14px',
    borderRadius: 8,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    marginBottom: 12,
    fontWeight: 600
  },
  successAlert: {
    padding: '10px 14px',
    borderRadius: 8,
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#15803d',
    marginBottom: 12,
    fontWeight: 600
  },
  breadcrumbBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    background: '#f8fafc',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    marginBottom: 16
  },
  crumbBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 13,
    color: '#475569',
    padding: '4px 6px',
    borderRadius: 6
  },
  crumbActive: {
    fontWeight: 700,
    color: '#2563eb',
    background: '#eff6ff'
  },
  crumbSep: {
    color: '#94a3b8'
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 14
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    padding: 16,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
  },
  cardTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 10,
    background: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22
  },
  badgesGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'flex-end'
  },
  badge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 999
  },
  sourceBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 999,
    background: '#eff6ff',
    color: '#1d4ed8'
  },
  childrenBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 999,
    background: '#f1f5f9',
    color: '#334155'
  },
  hiddenBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 999,
    background: '#fef3c7',
    color: '#92400e'
  },
  cardTitle: {
    margin: '0 0 4px',
    fontSize: 16,
    fontWeight: 700
  },
  cardSubtitle: {
    margin: '0 0 6px',
    fontSize: 13,
    color: '#475569',
    fontWeight: 500
  },
  cardDesc: {
    margin: '0 0 12px',
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.5
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTop: '1px solid #f1f5f9',
    marginTop: 'auto'
  },
  openHint: {
    fontSize: 12,
    fontWeight: 700
  },
  mutedMeta: {
    fontSize: 12,
    color: '#64748b'
  },
  cardActions: {
    display: 'flex',
    gap: 4
  },
  iconActionBtn: {
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    borderRadius: 7,
    padding: '4px 7px',
    cursor: 'pointer',
    fontSize: 13
  },
  filterToolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14
  },
  searchInput: {
    flex: 1,
    minWidth: 220,
    padding: '9px 12px',
    borderRadius: 9,
    border: '1px solid #cbd5e1',
    fontSize: 14
  },
  selectInput: {
    padding: '9px 12px',
    borderRadius: 9,
    border: '1px solid #cbd5e1',
    background: '#fff',
    fontSize: 14
  },
  centerBox: {
    padding: 40,
    textAlign: 'center',
    color: '#64748b'
  },
  emptyBox: {
    padding: 36,
    textAlign: 'center',
    background: '#f8fafc',
    border: '1px dashed #cbd5e1',
    borderRadius: 14
  },
  emptyText: {
    margin: '0 0 12px',
    color: '#475569'
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 1000
  },
  modalBox: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '90vh',
    overflowY: 'auto',
    background: '#fff',
    borderRadius: 16,
    padding: 20,
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: '1px solid #e2e8f0'
  },
  modalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700
  },
  closeBtn: {
    border: 'none',
    background: '#f1f5f9',
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: 'pointer',
    fontWeight: 700
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: '#334155'
  },
  input: {
    padding: '8px 11px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 14
  },
  textarea: {
    padding: '8px 11px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 14,
    resize: 'vertical'
  },
  pickerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  chipsWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4
  },
  miniChip: {
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    borderRadius: 6,
    padding: '3px 6px',
    cursor: 'pointer',
    fontSize: 14
  },
  colorInput: {
    width: 42,
    height: 36,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer'
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: '1px solid rgba(0,0,0,0.15)',
    cursor: 'pointer'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
    paddingTop: 12,
    borderTop: '1px solid #e2e8f0'
  }
};
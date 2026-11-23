import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  FolderPlus, Edit3, Trash2, ArrowRight, FolderOpen,
  Save, X, Layers, ExternalLink, FileText, ChevronLeft, Search, LayoutGrid
} from 'lucide-react';

const COLOR_THEMES = {
  red: {
    card: 'border-red-200 bg-white hover:border-[#7a1c24]',
    badge: 'bg-red-50 text-[#7a1c24]',
    btn: 'bg-[#7a1c24] hover:bg-[#5f141a] text-white'
  },
  amber: {
    card: 'border-amber-200 bg-amber-50/40 hover:border-amber-500',
    badge: 'bg-amber-100 text-amber-950',
    btn: 'bg-amber-700 hover:bg-amber-800 text-white'
  },
  blue: {
    card: 'border-blue-200 bg-blue-50/30 hover:border-blue-500',
    badge: 'bg-blue-100 text-blue-950',
    btn: 'bg-blue-700 hover:bg-blue-800 text-white'
  },
  emerald: {
    card: 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-500',
    badge: 'bg-emerald-100 text-emerald-950',
    btn: 'bg-emerald-700 hover:bg-emerald-800 text-white'
  },
  purple: {
    card: 'border-purple-200 bg-purple-50/30 hover:border-purple-500',
    badge: 'bg-purple-100 text-purple-950',
    btn: 'bg-purple-800 hover:bg-purple-900 text-white'
  },
  slate: {
    card: 'border-slate-300 bg-slate-50/50 hover:border-slate-600',
    badge: 'bg-slate-200 text-slate-900',
    btn: 'bg-slate-800 hover:bg-slate-900 text-white'
  }
};

const makeEmptyCardForm = (parentId = null, nextOrder = 1) => ({
  id: null,
  parent_id: parentId || '',
  title: '',
  subtitle: '',
  description: '',
  icon: '🗂️',
  badge_text: '',
  accent_color: 'red',
  target_action: 'children',
  target_url: '',
  sort_order: nextOrder,
  is_active: true
});

export default function NestedCardsBuilder({
  currentUser = null,
  isAdmin = false,
  rootParentId = null,
  title = 'إضافة وتعديل كروت',
  onExit,
  hubCards = [],
  setupCards = [],
  serviceGroups = [],
  services = [],
  caseCategories = [],
  customCards = [],
  onRefresh
}) {
  const [viewMode, setViewMode] = useState('live');
  const [screenFilter, setScreenFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [allCards, setAllCards] = useState([]);
  const [currentParentId, setCurrentParentId] = useState(rootParentId);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [cardForm, setCardForm] = useState(() => makeEmptyCardForm(rootParentId, 1));
  const [selectedInfoCard, setSelectedInfoCard] = useState(null);

  // حالة تعديل وإضافة الكروت الفعلية في الشاشات
  const [liveModalOpen, setLiveModalOpen] = useState(false);
  const [editingLiveCard, setEditingLiveCard] = useState(null);
  const [liveForm, setLiveForm] = useState({
    sourceType: 'case_category',
    id: null,
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
  const [savingLive, setSavingLive] = useState(false);

  const fetchCards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('nested_cards')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.error(error);
      } else {
        setAllCards(data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  useEffect(() => {
    setCurrentParentId(rootParentId);
  }, [rootParentId]);

  const cardsByParent = useMemo(() => {
    const map = {};
    for (const c of allCards) {
      const key = c.parent_id || '__ROOT__';
      if (!map[key]) map[key] = [];
      map[key].push(c);
    }
    return map;
  }, [allCards]);

  const cardById = useMemo(() => {
    const map = {};
    for (const c of allCards) {
      map[c.id] = c;
    }
    return map;
  }, [allCards]);

  const breadcrumbs = useMemo(() => {
    const trail = [];
    let cursor = currentParentId ? cardById[currentParentId] : null;
    const guard = new Set();

    while (cursor && !guard.has(cursor.id)) {
      guard.add(cursor.id);
      trail.unshift(cursor);
      cursor = cursor.parent_id ? cardById[cursor.parent_id] : null;
    }
    return trail;
  }, [currentParentId, cardById]);

  const currentLevelCards = useMemo(() => {
    const key = currentParentId || '__ROOT__';
    return cardsByParent[key] || [];
  }, [currentParentId, cardsByParent]);

  const currentParentCard = currentParentId ? cardById[currentParentId] : null;

  // تجميع الكروت الفعلية من كافة الشاشات
  const allScreenCards = useMemo(() => {
    const list = [];

    (hubCards || []).forEach((hc, idx) => {
      list.push({
        uid: `hub-${hc.id || idx}`,
        screenKey: 'admin_hub',
        screenLabel: 'لوحة الإدارة الرئيسية',
        sourceType: 'hub_virtual',
        raw: hc,
        icon: hc.icon || '🗂️',
        title: hc.title || '',
        subtitle: 'كارت شاشة في لوحة الإدارة',
        description: hc.desc || '',
        badge: hc.count || '',
        accent: 'red',
        editable: false,
        deletable: false
      });
    });

    (setupCards || []).forEach((sc, idx) => {
      list.push({
        uid: `setup-${sc.id || idx}`,
        screenKey: 'setup_hub',
        screenLabel: 'الإعدادات SETUP',
        sourceType: 'setup_virtual',
        raw: sc,
        icon: sc.icon || '🛠️',
        title: sc.title || '',
        subtitle: 'كارت داخل الإعدادات SETUP',
        description: sc.desc || '',
        badge: sc.count || '',
        accent: 'amber',
        editable: false,
        deletable: false
      });
    });

    (serviceGroups || []).forEach((grp, idx) => {
      list.push({
        uid: `grp-${grp.id || idx}`,
        screenKey: 'services',
        screenLabel: 'الخدمات والاجتماعات والفصول',
        sourceType: 'service_group',
        raw: grp,
        icon: grp.icon || (grp.has_classes !== false ? '🏫' : '🕊️'),
        title: grp.group_name || '',
        subtitle: [
          grp.gender_target,
          grp.head_servant_name ? `الأمين: ${grp.head_servant_name}` : '',
          grp.service_day ? `${grp.service_day} ${grp.start_time || ''}` : ''
        ].filter(Boolean).join(' • '),
        description: grp.servants_names ? `الخدام: ${grp.servants_names}` : '',
        badge: grp.has_classes !== false ? 'خدمة بفصول' : 'اجتماع/خدمة',
        accent: 'blue',
        editable: Boolean(grp.id),
        deletable: Boolean(grp.id)
      });
    });

    (services || []).forEach((srv, idx) => {
      list.push({
        uid: `srv-${srv.id || idx}`,
        screenKey: 'services',
        screenLabel: 'الخدمات والاجتماعات والفصول',
        sourceType: 'service_class',
        raw: srv,
        icon: '📘',
        title: srv.class_name || '',
        subtitle: [
          srv.stage_name ? `المرحلة/الخدمة: ${srv.stage_name}` : '',
          srv.head_servant_name ? `الأمين: ${srv.head_servant_name}` : ''
        ].filter(Boolean).join(' • '),
        description: [
          srv.vice_head_name ? `الخدام: ${srv.vice_head_name}` : '',
          srv.meeting_time ? `الموعد: ${srv.meeting_time}` : '',
          srv.room_name ? `القاعة: ${srv.room_name}` : ''
        ].filter(Boolean).join(' • '),
        badge: 'فصل دراسي',
        accent: 'emerald',
        editable: Boolean(srv.id),
        deletable: Boolean(srv.id)
      });
    });

    (caseCategories || []).forEach((cat, idx) => {
      list.push({
        uid: `cat-${cat.id || idx}`,
        screenKey: 'categories',
        screenLabel: 'كروت بحث الحالة',
        sourceType: 'case_category',
        raw: cat,
        icon: cat.icon || '📂',
        title: cat.name || '',
        subtitle: 'تصنيف بحث الحالة في مكتب الكاهن',
        description: '',
        badge: 'تصنيف حالة',
        accent: 'emerald',
        editable: Boolean(cat.id),
        deletable: Boolean(cat.id)
      });
    });

    (customCards || []).forEach((cc, idx) => {
      list.push({
        uid: `cc-${cc.id || idx}`,
        screenKey: 'custom_cards',
        screenLabel: 'كروت إضافية للكاهن',
        sourceType: 'custom_card',
        raw: cc,
        icon: cc.card_icon || '📌',
        title: cc.card_title || '',
        subtitle: 'كارت مخصص في صفحة الأب الكاهن',
        description: cc.description || '',
        badge: 'كارت كاهن',
        accent: 'purple',
        editable: Boolean(cc.id),
        deletable: Boolean(cc.id)
      });
    });

    return list;
  }, [hubCards, setupCards, serviceGroups, services, caseCategories, customCards]);

  const filteredScreenCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allScreenCards.filter((item) => {
      if (screenFilter !== 'all' && item.screenKey !== screenFilter) return false;
      if (!q) return true;
      return `${item.title} ${item.subtitle} ${item.description} ${item.screenLabel}`
        .toLowerCase()
        .includes(q);
    });
  }, [allScreenCards, screenFilter, searchQuery]);

  const openCreateModal = (targetParentId = currentParentId) => {
    if (!isAdmin) {
      alert('🔒 إضافة وتعديل الكروت متاح للسوبر أدمن فقط.');
      return;
    }
    const siblings = cardsByParent[targetParentId || '__ROOT__'] || [];
    setEditingId(null);
    setCardForm(makeEmptyCardForm(targetParentId, siblings.length + 1));
    setModalOpen(true);
  };

  const openEditModal = (card, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin) {
      alert('🔒 تعديل الكروت متاح للسوبر أدمن فقط.');
      return;
    }
    setEditingId(card.id);
    setCardForm({
      id: card.id,
      parent_id: card.parent_id || '',
      title: card.title || '',
      subtitle: card.subtitle || '',
      description: card.description || '',
      icon: card.icon || '🗂️',
      badge_text: card.badge_text || '',
      accent_color: card.accent_color || 'red',
      target_action: card.target_action || 'children',
      target_url: card.target_url || '',
      sort_order: card.sort_order ?? 1,
      is_active: card.is_active !== false
    });
    setModalOpen(true);
  };

  const openCreateLiveCard = () => {
    if (!isAdmin) {
      alert('🔒 إضافة الكروت متاح للسوبر أدمن فقط.');
      return;
    }
    const defaultType =
      screenFilter === 'services' ? 'service_group' :
      screenFilter === 'custom_cards' ? 'custom_card' : 'case_category';

    setEditingLiveCard(null);
    setLiveForm({
      sourceType: defaultType,
      id: null,
      title: '',
      subtitle: '',
      description: '',
      icon: defaultType === 'service_group' ? '🏫' : defaultType === 'custom_card' ? '📌' : '📂',
      badge: '',
      extra1: defaultType === 'service_group' ? 'عام (الكل: ذكور وإناث)' : '',
      extra2: '',
      extra3: '',
      sortOrder: 1
    });
    setLiveModalOpen(true);
  };

  const openEditLiveCard = (item) => {
    if (!isAdmin) {
      alert('🔒 تعديل الكروت متاح للسوبر أدمن فقط.');
      return;
    }
    if (!item.editable) {
      alert('هذا الكارت ثابت في بنية الكود ويمكن تعديل تسميته أو إظهاره من «التصميم وتعديل الصفحات».');
      return;
    }

    const raw = item.raw || {};
    setEditingLiveCard(item);

    if (item.sourceType === 'service_group') {
      setLiveForm({
        sourceType: 'service_group',
        id: raw.id,
        title: raw.group_name || '',
        subtitle: raw.head_servant_name || '',
        description: raw.servants_names || '',
        icon: raw.icon || '🏫',
        badge: raw.has_classes !== false ? 'yes' : 'no',
        extra1: raw.gender_target || 'عام (الكل: ذكور وإناث)',
        extra2: raw.service_day || '',
        extra3: Array.isArray(raw.stages) ? raw.stages.join(', ') : (raw.stages || ''),
        sortOrder: raw.sort_order || 1
      });
    } else if (item.sourceType === 'service_class') {
      setLiveForm({
        sourceType: 'service_class',
        id: raw.id,
        title: raw.class_name || '',
        subtitle: raw.stage_name || '',
        description: raw.vice_head_name || '',
        icon: '📘',
        badge: raw.room_name || '',
        extra1: raw.head_servant_name || '',
        extra2: raw.meeting_time || '',
        extra3: '',
        sortOrder: 1
      });
    } else if (item.sourceType === 'case_category') {
      setLiveForm({
        sourceType: 'case_category',
        id: raw.id,
        title: raw.name || '',
        subtitle: '',
        description: '',
        icon: raw.icon || '📂',
        badge: '',
        extra1: '',
        extra2: '',
        extra3: '',
        sortOrder: 1
      });
    } else if (item.sourceType === 'custom_card') {
      setLiveForm({
        sourceType: 'custom_card',
        id: raw.id,
        title: raw.card_title || '',
        subtitle: '',
        description: raw.description || '',
        icon: raw.card_icon || '📌',
        badge: '',
        extra1: raw.priest_id || '',
        extra2: '',
        extra3: '',
        sortOrder: 1
      });
    }

    setLiveModalOpen(true);
  };

  const handleSaveLiveCard = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!liveForm.title.trim()) {
      alert('اكتب عنوان الكارت أولاً');
      return;
    }

    setSavingLive(true);
    try {
      if (liveForm.sourceType === 'service_group') {
        const stagesArr = String(liveForm.extra3 || '')
          .split(/[,،]/)
          .map(s => s.trim())
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

        if (editingLiveCard?.id) {
          const { error } = await supabase.from('service_groups').update(payload).eq('id', editingLiveCard.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from('service_groups').insert([payload]);
          if (error) throw new Error(error.message);
        }
      } else if (liveForm.sourceType === 'service_class') {
        const payload = {
          class_name: liveForm.title.trim(),
          stage_name: (liveForm.subtitle || '').trim(),
          head_servant_name: (liveForm.extra1 || '').trim(),
          vice_head_name: (liveForm.description || '').trim(),
          meeting_time: (liveForm.extra2 || '').trim(),
          room_name: (liveForm.badge || '').trim()
        };

        if (editingLiveCard?.id) {
          const { error } = await supabase.from('services').update(payload).eq('id', editingLiveCard.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from('services').insert([payload]);
          if (error) throw new Error(error.message);
        }
      } else if (liveForm.sourceType === 'case_category') {
        const payload = {
          name: liveForm.title.trim(),
          icon: (liveForm.icon || '📂').trim()
        };

        if (editingLiveCard?.id) {
          const { error } = await supabase.from('case_categories').update(payload).eq('id', editingLiveCard.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from('case_categories').insert([payload]);
          if (error) throw new Error(error.message);
        }
      } else if (liveForm.sourceType === 'custom_card') {
        const payload = {
          card_title: liveForm.title.trim(),
          card_icon: (liveForm.icon || '📌').trim(),
          description: (liveForm.description || '').trim(),
          priest_id: liveForm.extra1 || null
        };

        if (editingLiveCard?.id) {
          const { error } = await supabase.from('priest_custom_cards').update(payload).eq('id', editingLiveCard.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from('priest_custom_cards').insert([payload]);
          if (error) throw new Error(error.message);
        }
      }

      setLiveModalOpen(false);
      if (onRefresh) await onRefresh();
    } catch (err) {
      alert('تعذر حفظ بيانات الكارت: ' + err.message);
    } finally {
      setSavingLive(false);
    }
  };

  const handleDeleteLiveCard = async (item) => {
    if (!isAdmin) return;
    if (!item.deletable || !item.raw?.id) {
      alert('هذا الكارت ثابت في الشاشة ولا يُحذف من هنا.');
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف الكارت "${item.title}"؟`)) return;

    const tableMap = {
      service_group: 'service_groups',
      service_class: 'services',
      case_category: 'case_categories',
      custom_card: 'priest_custom_cards'
    };

    const tableName = tableMap[item.sourceType];
    if (!tableName) return;

    const { error } = await supabase.from(tableName).delete().eq('id', item.raw.id);
    if (error) {
      alert('تعذر حذف الكارت: ' + error.message);
      return;
    }
    if (onRefresh) await onRefresh();
  };

  const handleSaveCard = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!cardForm.title.trim()) {
      alert('اكتب عنوان الكارت أولاً');
      return;
    }

    const normalizedParentId = cardForm.parent_id || null;
    if (editingId && normalizedParentId === editingId) {
      alert('لا يمكن جعل الكارت أباً لنفسه');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        parent_id: normalizedParentId,
        title: cardForm.title.trim(),
        subtitle: (cardForm.subtitle || '').trim(),
        description: (cardForm.description || '').trim(),
        icon: (cardForm.icon || '🗂️').trim(),
        badge_text: (cardForm.badge_text || '').trim(),
        accent_color: cardForm.accent_color || 'red',
        target_action: cardForm.target_action || 'children',
        target_url: (cardForm.target_url || '').trim(),
        sort_order: Number(cardForm.sort_order || 1),
        is_active: true,
        updated_at: new Date().toISOString()
      };

      if (editingId) {
        const { data, error } = await supabase
          .from('nested_cards')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single();

        if (error) throw new Error(error.message);
        if (data) {
          setAllCards(prev => prev.map(item => (item.id === editingId ? data : item)));
        }
      } else {
        const { data, error } = await supabase
          .from('nested_cards')
          .insert([{ ...payload, created_by: currentUser?.id || null }])
          .select()
          .single();

        if (error) throw new Error(error.message);
        if (data) {
          setAllCards(prev => [...prev, data]);
        }
      }

      setModalOpen(false);
    } catch (err) {
      alert('تعذر حفظ الكارت: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCard = async (card, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;

    const childrenCount = (cardsByParent[card.id] || []).length;
    const msg = childrenCount > 0
      ? `حذف الكارت "${card.title}" سيحذف أيضاً ${childrenCount} كارت فرعي بداخله. هل أنت متأكد؟`
      : `هل أنت متأكد من حذف الكارت "${card.title}"؟`;

    if (!confirm(msg)) return;

    const { error } = await supabase.from('nested_cards').delete().eq('id', card.id);
    if (error) {
      alert('تعذر الحذف: ' + error.message);
      return;
    }

    setAllCards(prev => prev.filter(item => item.id !== card.id && item.parent_id !== card.id));
    if (currentParentId === card.id) {
      setCurrentParentId(card.parent_id || rootParentId || null);
    }
    await fetchCards();
  };

  const handleCardClick = (card) => {
    if (card.target_action === 'link' && card.target_url) {
      window.open(card.target_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (card.target_action === 'info') {
      setSelectedInfoCard(card);
      return;
    }
    setCurrentParentId(card.id);
  };

  const goBackOneLevel = () => {
    if (viewMode === 'nested' && currentParentCard) {
      const parentOfCurrent = currentParentCard.parent_id || null;
      if (rootParentId && currentParentId === rootParentId) {
        if (onExit) onExit();
        return;
      }
      setCurrentParentId(parentOfCurrent);
      return;
    }
    if (onExit) onExit();
  };

  const availableParentOptions = useMemo(() => {
    return allCards.filter(c => c.id !== editingId);
  }, [allCards, editingId]);

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white p-4 rounded-2xl border shadow-2xs flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {(currentParentId || onExit) && (
            <button
              type="button"
              onClick={goBackOneLevel}
              className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-black flex items-center gap-1 cursor-pointer"
            >
              <ArrowRight size={14} /> رجوع
            </button>
          )}
          <h3 className="text-sm md:text-base font-black text-[#7a1c24] flex items-center gap-1.5">
            <Layers size={17} /> {title}
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 font-bold">
            <button
              type="button"
              onClick={() => setViewMode('live')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer ${
                viewMode === 'live' ? 'bg-[#7a1c24] text-white shadow-2xs' : 'text-gray-700 hover:bg-white/60'
              }`}
            >
              <LayoutGrid size={13} /> كروت الشاشات ({allScreenCards.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('nested')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer ${
                viewMode === 'nested' ? 'bg-[#7a1c24] text-white shadow-2xs' : 'text-gray-700 hover:bg-white/60'
              }`}
            >
              <Layers size={13} /> كروت داخل كروت ({allCards.length})
            </button>
          </div>

          {isAdmin && viewMode === 'live' && (
            <button
              type="button"
              onClick={openCreateLiveCard}
              className="px-4 py-2 bg-[#7a1c24] hover:bg-[#5f141a] text-white rounded-xl font-black flex items-center gap-1.5 shadow cursor-pointer"
            >
              <FolderPlus size={15} /> إضافة كارت جديد
            </button>
          )}

          {isAdmin && viewMode === 'nested' && (
            <button
              type="button"
              onClick={() => openCreateModal(currentParentId)}
              className="px-4 py-2 bg-[#7a1c24] hover:bg-[#5f141a] text-white rounded-xl font-black flex items-center gap-1.5 shadow cursor-pointer"
            >
              <FolderPlus size={15} />
              {currentParentCard ? `إضافة كارت داخل "${currentParentCard.title}"` : 'إضافة كارت رئيسي جديد'}
            </button>
          )}
        </div>
      </div>

      {viewMode === 'live' ? (
        <div className="space-y-4">
          <div className="bg-[#fbfaf7] p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap font-bold">
              {[
                { key: 'all', label: 'كل الشاشات' },
                { key: 'admin_hub', label: 'لوحة الإدارة' },
                { key: 'setup_hub', label: 'الإعدادات SETUP' },
                { key: 'services', label: 'الخدمات والفصول' },
                { key: 'categories', label: 'كروت بحث الحالة' },
                { key: 'custom_cards', label: 'كروت الكاهن' }
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setScreenFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-xl cursor-pointer ${
                    screenFilter === tab.key
                      ? 'bg-[#7a1c24] text-white font-black'
                      : 'bg-white border text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-52">
              <Search size={14} className="absolute right-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="ابحث في الكروت..."
                className="w-full pr-8 pl-3 py-1.5 bg-white border rounded-xl outline-none focus:border-[#7a1c24]"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {filteredScreenCards.length === 0 ? (
            <div className="bg-white p-10 rounded-3xl border text-center space-y-2">
              <FolderOpen size={34} className="mx-auto text-gray-400" />
              <div className="font-black text-sm text-gray-800">لا توجد كروت مطابقة للبحث أو الفلتر الحالي</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredScreenCards.map((item) => {
                const theme = COLOR_THEMES[item.accent] || COLOR_THEMES.red;
                return (
                  <div
                    key={item.uid}
                    className={`${theme.card} border-2 p-5 rounded-3xl shadow-2xs flex flex-col justify-between gap-4`}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-3xl">{item.icon}</span>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-800">
                            {item.screenLabel}
                          </span>
                          {item.badge && (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${theme.badge}`}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-base font-black text-gray-900">{item.title}</h4>
                        {item.subtitle && (
                          <div className="text-[11px] font-bold text-[#7a1c24] mt-0.5">{item.subtitle}</div>
                        )}
                        {item.description && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.description}</p>
                        )}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="pt-2.5 border-t flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditLiveCard(item)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 size={12} /> تعديل البيانات
                        </button>
                        {item.deletable && (
                          <button
                            type="button"
                            onClick={() => handleDeleteLiveCard(item)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={12} /> حذف
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="bg-[#fbfaf7] px-4 py-2.5 rounded-2xl border flex items-center gap-1.5 flex-wrap font-bold text-gray-700">
            <button
              type="button"
              onClick={() => setCurrentParentId(rootParentId)}
              className={`px-2.5 py-1 rounded-lg cursor-pointer ${!currentParentId ? 'bg-[#7a1c24] text-white' : 'hover:bg-gray-200'}`}
            >
              🏠 المستوى الرئيسي
            </button>

            {breadcrumbs.map((crumb) => (
              <div key={crumb.id} className="flex items-center gap-1.5">
                <ChevronLeft size={14} className="text-gray-400" />
                <button
                  type="button"
                  onClick={() => setCurrentParentId(crumb.id)}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer ${currentParentId === crumb.id ? 'bg-[#7a1c24] text-white' : 'bg-white border hover:bg-gray-100'}`}
                >
                  {crumb.icon} {crumb.title}
                </button>
              </div>
            ))}
          </div>

          {currentParentCard && (currentParentCard.subtitle || currentParentCard.description) && (
            <div className="bg-white p-4 rounded-2xl border space-y-1 shadow-2xs">
              <div className="font-black text-sm text-gray-900">
                {currentParentCard.icon} {currentParentCard.title}
              </div>
              {currentParentCard.subtitle && (
                <div className="text-xs font-bold text-[#7a1c24]">{currentParentCard.subtitle}</div>
              )}
              {currentParentCard.description && (
                <p className="text-xs text-gray-600 whitespace-pre-line">{currentParentCard.description}</p>
              )}
            </div>
          )}

          {loading ? (
            <div className="bg-white p-8 rounded-3xl border text-center text-gray-500 font-bold">
              جاري تحميل الكروت...
            </div>
          ) : currentLevelCards.length === 0 ? (
            <div className="bg-white p-10 rounded-3xl border text-center space-y-3">
              <FolderOpen size={36} className="mx-auto text-gray-400" />
              <div className="font-black text-sm text-gray-800">
                {currentParentCard
                  ? `لا توجد كروت داخل "${currentParentCard.title}" حتى الآن`
                  : 'لا توجد كروت مضافة في هذا المستوى بعد'}
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => openCreateModal(currentParentId)}
                  className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl font-black cursor-pointer"
                >
                  + أضف أول كارت هنا
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentLevelCards.map((card) => {
                const theme = COLOR_THEMES[card.accent_color] || COLOR_THEMES.red;
                const childCount = (cardsByParent[card.id] || []).length;

                return (
                  <div
                    key={card.id}
                    onClick={() => handleCardClick(card)}
                    className={`${theme.card} border-2 p-5 rounded-3xl shadow-2xs hover:shadow-md transition flex flex-col justify-between gap-4 cursor-pointer`}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-3xl">{card.icon || '🗂️'}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {card.badge_text && (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${theme.badge}`}>
                              {card.badge_text}
                            </span>
                          )}
                          {card.target_action === 'children' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-800">
                              {childCount} كارت بالداخل
                            </span>
                          )}
                          {card.target_action === 'link' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-900 flex items-center gap-0.5">
                              <ExternalLink size={10} /> رابط
                            </span>
                          )}
                          {card.target_action === 'info' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900 flex items-center gap-0.5">
                              <FileText size={10} /> محتوى
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-base font-black text-gray-900">{card.title}</h4>
                        {card.subtitle && (
                          <div className="text-[11px] font-bold text-[#7a1c24] mt-0.5">{card.subtitle}</div>
                        )}
                        {card.description && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{card.description}</p>
                        )}
                      </div>
                    </div>

                    {isAdmin && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="pt-2.5 border-t flex items-center justify-between gap-1.5 flex-wrap"
                      >
                        <button
                          type="button"
                          onClick={() => openCreateModal(card.id)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer ${theme.btn}`}
                        >
                          <FolderPlus size={12} /> + كارت جواه
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => openEditModal(card, e)}
                            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 size={12} /> تعديل
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCard(card, e)}
                            className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={12} /> حذف
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* نافذة إضافة / تعديل كارت فعلي في الشاشات */}
      {liveModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-3 text-xs font-bold max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-black text-[#7a1c24]">
                {editingLiveCard ? '✏️ تعديل بيانات الكارت الفعلي' : '➕ إضافة كارت فعلي لشاشة'}
              </h3>
              <button
                type="button"
                onClick={() => setLiveModalOpen(false)}
                className="p-1 text-gray-500 hover:text-gray-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLiveCard} className="space-y-3">
              {!editingLiveCard && (
                <div>
                  <label className="block mb-1">الشاشة / النوع:</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-gray-50"
                    value={liveForm.sourceType}
                    onChange={e => setLiveForm({ ...liveForm, sourceType: e.target.value })}
                  >
                    <option value="case_category">كروت بحث الحالة</option>
                    <option value="service_group">الخدمات والاجتماعات</option>
                    <option value="service_class">فصل دراسي</option>
                    <option value="custom_card">كارت إضافي للكاهن</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block mb-1">الأيقونة</label>
                  <input
                    className="w-full p-2.5 border rounded-xl text-center text-base"
                    value={liveForm.icon}
                    onChange={e => setLiveForm({ ...liveForm, icon: e.target.value })}
                  />
                </div>
                <div className="col-span-3">
                  <label className="block mb-1">العنوان / الاسم *</label>
                  <input
                    required
                    className="w-full p-2.5 border rounded-xl"
                    value={liveForm.title}
                    onChange={e => setLiveForm({ ...liveForm, title: e.target.value })}
                  />
                </div>
              </div>

              {liveForm.sourceType === 'service_group' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block mb-1">أمين الخدمة</label>
                      <input
                        className="w-full p-2.5 border rounded-xl"
                        value={liveForm.subtitle}
                        onChange={e => setLiveForm({ ...liveForm, subtitle: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block mb-1">يوم الخدمة</label>
                      <input
                        className="w-full p-2.5 border rounded-xl"
                        value={liveForm.extra2}
                        onChange={e => setLiveForm({ ...liveForm, extra2: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1">الخدام (مفصولين بفاصلة)</label>
                    <input
                      className="w-full p-2.5 border rounded-xl"
                      value={liveForm.description}
                      onChange={e => setLiveForm({ ...liveForm, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block mb-1">السنوات الدراسية (مفصولة بفاصلة)</label>
                    <input
                      className="w-full p-2.5 border rounded-xl"
                      value={liveForm.extra3}
                      onChange={e => setLiveForm({ ...liveForm, extra3: e.target.value })}
                    />
                  </div>
                </>
              )}

              {liveForm.sourceType === 'service_class' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block mb-1">المرحلة / الخدمة</label>
                      <input
                        className="w-full p-2.5 border rounded-xl"
                        value={liveForm.subtitle}
                        onChange={e => setLiveForm({ ...liveForm, subtitle: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block mb-1">أمين الفصل</label>
                      <input
                        className="w-full p-2.5 border rounded-xl"
                        value={liveForm.extra1}
                        onChange={e => setLiveForm({ ...liveForm, extra1: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block mb-1">الميعاد</label>
                      <input
                        className="w-full p-2.5 border rounded-xl"
                        value={liveForm.extra2}
                        onChange={e => setLiveForm({ ...liveForm, extra2: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block mb-1">القاعة</label>
                      <input
                        className="w-full p-2.5 border rounded-xl"
                        value={liveForm.badge}
                        onChange={e => setLiveForm({ ...liveForm, badge: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {liveForm.sourceType === 'custom_card' && (
                <div>
                  <label className="block mb-1">الوصف</label>
                  <textarea
                    rows={3}
                    className="w-full p-2.5 border rounded-xl"
                    value={liveForm.description}
                    onChange={e => setLiveForm({ ...liveForm, description: e.target.value })}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLiveModalOpen(false)}
                  className="px-4 py-2 border rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingLive}
                  className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Save size={14} /> {savingLive ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة إضافة / تعديل كارت متداخل */}
      {modalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-3 text-xs font-bold max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-black text-[#7a1c24]">
                {editingId ? '✏️ تعديل الكارت' : '➕ إنشاء كارت جديد'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-gray-500 hover:text-gray-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-3">
              <div>
                <label className="block mb-1 text-gray-700">الكارت الأب (مكان ظهور الكارت):</label>
                <select
                  className="w-full p-2.5 border rounded-xl bg-gray-50"
                  value={cardForm.parent_id || ''}
                  onChange={(e) => setCardForm({ ...cardForm, parent_id: e.target.value })}
                >
                  <option value="">🏠 المستوى الرئيسي (بدون كارت أب)</option>
                  {availableParentOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.icon} {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block mb-1">الأيقونة</label>
                  <input
                    className="w-full p-2.5 border rounded-xl text-center text-base"
                    value={cardForm.icon}
                    onChange={(e) => setCardForm({ ...cardForm, icon: e.target.value })}
                  />
                </div>
                <div className="col-span-3">
                  <label className="block mb-1">عنوان الكارت *</label>
                  <input
                    required
                    placeholder="مثال: خدمة إعدادي / ملفات الاجتماع..."
                    className="w-full p-2.5 border rounded-xl"
                    value={cardForm.title}
                    onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1">عنوان فرعي / مسؤول</label>
                  <input
                    placeholder="مثال: بنين وبنات • الجمعة"
                    className="w-full p-2.5 border rounded-xl"
                    value={cardForm.subtitle}
                    onChange={(e) => setCardForm({ ...cardForm, subtitle: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1">شارة صغيرة (Badge)</label>
                  <input
                    placeholder="مثال: جديد / هام / 12"
                    className="w-full p-2.5 border rounded-xl"
                    value={cardForm.badge_text}
                    onChange={(e) => setCardForm({ ...cardForm, badge_text: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block mb-1">لون الكارت</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white"
                    value={cardForm.accent_color}
                    onChange={(e) => setCardForm({ ...cardForm, accent_color: e.target.value })}
                  >
                    <option value="red">عنابي</option>
                    <option value="amber">ذهبي</option>
                    <option value="blue">أزرق</option>
                    <option value="emerald">أخضر</option>
                    <option value="purple">بنفسجي</option>
                    <option value="slate">رمادي</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1">عند الضغط يفتح</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white"
                    value={cardForm.target_action}
                    onChange={(e) => setCardForm({ ...cardForm, target_action: e.target.value })}
                  >
                    <option value="children">🗂️ كروت فرعية بداخله</option>
                    <option value="info">📄 شاشة محتوى / ملاحظات</option>
                    <option value="link">🔗 رابط خارجي</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1">الترتيب</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full p-2.5 border rounded-xl text-center"
                    value={cardForm.sort_order}
                    onChange={(e) => setCardForm({ ...cardForm, sort_order: e.target.value })}
                  />
                </div>
              </div>

              {cardForm.target_action === 'link' && (
                <div>
                  <label className="block mb-1">الرابط (URL)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    className="w-full p-2.5 border rounded-xl"
                    value={cardForm.target_url}
                    onChange={(e) => setCardForm({ ...cardForm, target_url: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="block mb-1">وصف أو محتوى تفصيلي</label>
                <textarea
                  rows={3}
                  placeholder="اكتب أي تفاصيل أو تعليمات خاصة بهذا الكارت..."
                  className="w-full p-2.5 border rounded-xl"
                  value={cardForm.description}
                  onChange={(e) => setCardForm({ ...cardForm, description: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Save size={14} /> {saving ? 'جاري الحفظ...' : 'حفظ الكارت'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedInfoCard && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-base font-black text-gray-900">
                {selectedInfoCard.icon} {selectedInfoCard.title}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedInfoCard(null)}
                className="p-1 text-gray-500 hover:text-gray-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            {selectedInfoCard.subtitle && (
              <div className="font-bold text-[#7a1c24]">{selectedInfoCard.subtitle}</div>
            )}
            <p className="text-gray-700 whitespace-pre-line leading-relaxed">
              {selectedInfoCard.description || 'لا يوجد وصف إضافي.'}
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedInfoCard(null)}
                className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
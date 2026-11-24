import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  FolderPlus, Edit3, Trash2, ArrowRight, FolderOpen,
  Save, X, Layers, ExternalLink, FileText, ChevronLeft,
  Search, Power, Play, RotateCcw, ShieldCheck, Plus, LayoutGrid
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

export const ADMIN_CARDS_CONFIG_KIND = 'admin_cards_config';
export const ADMIN_CARDS_LOCAL_KEY = 'church_admin_cards_config_v1';

export const SCREEN_TARGETS = [
  { key: 'admin_hub', label: '🛡️ لوحة الإدارة الرئيسية' },
  { key: 'setup_hub', label: '🛠️ الإعدادات SETUP' },
  { key: 'priest_hub', label: '✝ شاشة الأب الكاهن' },
  { key: 'service_hub', label: '🏫 الخدمة ومدارس الأحد' },
  { key: 'confessions', label: '🙏 الاعترافات' },
  { key: 'masses', label: '⛪ جدول القداسات' },
  { key: 'personal', label: '📅 الجدول الخاص بالكاهن' },
  { key: 'cases', label: '🔍 بحث الحالة والأسر' },
  { key: 'edu_center', label: '🎓 المركز التعليمي' },
  { key: 'joseph_arimathea', label: '🕊️ خدمة يوسف الرامي' },
  { key: 'servant_hub', label: '📖 شاشة الخادم' },
  { key: 'member_hub', label: '🎓 شاشة المخدوم' },
  { key: 'parent_hub', label: '👨‍👩‍👦 شاشة ولي الأمر' }
];

export const CARD_ROLE_OPTIONS = [
  { key: 'all', label: '👥 الكل' },
  { key: 'admin', label: '🛡️ سوبر أدمن' },
  { key: 'priest', label: '✝ أب كاهن' },
  { key: 'head_servant', label: '⭐ أمين خدمة' },
  { key: 'servant', label: '📖 خادم' },
  { key: 'member', label: '🎓 مخدوم' },
  { key: 'parent', label: '👨‍👩‍👦 ولي أمر' }
];

export const INTERNAL_SCREENS = [
  { key: 'users', label: 'حسابات الكنيسة' },
  { key: 'services', label: 'الخدمات والاجتماعات والفصول' },
  { key: 'service_hub', label: 'الخدمة ومدارس الأحد (الكاهن)' },
  { key: 'confessions', label: 'الاعترافات والمتابعة الروحية' },
  { key: 'masses', label: 'جدول القداسات' },
  { key: 'personal', label: 'الجدول الخاص والرحلات' },
  { key: 'cases', label: 'بحث الحالة والأسر' },
  { key: 'events', label: 'مواعيد القداسات والاجتماعات' },
  { key: 'roles_permissions', label: 'الصلاحيات والأدوار' },
  { key: 'edu_center', label: 'المركز التعليمي' },
  { key: 'joseph_arimathea', label: 'خدمة يوسف الرامي' },
  { key: 'burial_and_caskets', label: 'أماكن الدفن والصناديق' },
  { key: 'categories', label: 'كروت بحث الحالة' },
  { key: 'custom_cards', label: 'كروت إضافية للكاهن' },
  { key: 'page_designer', label: 'التصميم وتعديل الصفحات' },
  { key: 'settings', label: 'الإعدادات وهوية الكنيسة' }
];

export const isCardAllowedForRole = (allowedRoles = ['all'], userRole = null, isAdmin = false) => {
  if (isAdmin || userRole === 'admin') return true;
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0 || allowedRoles.includes('all')) {
    return true;
  }
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
};

export const loadAdminCardsConfig = async () => {
  let localCfg = { overrides: {}, customScreenCards: [], cardMeta: {} };
  try {
    const raw = localStorage.getItem(ADMIN_CARDS_LOCAL_KEY);
    if (raw) {
      localCfg = { overrides: {}, customScreenCards: [], cardMeta: {}, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }

  try {
    const { data, error } = await supabase
      .from('church_public_content')
      .select('id, body')
      .eq('kind', ADMIN_CARDS_CONFIG_KIND)
      .limit(1)
      .maybeSingle();

    if (!error && data?.body) {
      const parsed = JSON.parse(data.body);
      const merged = {
        rowId: data.id,
        overrides: parsed.overrides || {},
        customScreenCards: Array.isArray(parsed.customScreenCards) ? parsed.customScreenCards : [],
        cardMeta: parsed.cardMeta || {}
      };
      localStorage.setItem(ADMIN_CARDS_LOCAL_KEY, JSON.stringify({
        overrides: merged.overrides,
        customScreenCards: merged.customScreenCards,
        cardMeta: merged.cardMeta
      }));
      return merged;
    }
    return { rowId: data?.id || null, ...localCfg };
  } catch {
    return { rowId: null, ...localCfg };
  }
};

export const saveAdminCardsConfig = async (config) => {
  const cleanPayload = {
    overrides: config.overrides || {},
    customScreenCards: Array.isArray(config.customScreenCards) ? config.customScreenCards : [],
    cardMeta: config.cardMeta || {}
  };
  localStorage.setItem(ADMIN_CARDS_LOCAL_KEY, JSON.stringify(cleanPayload));

  const dbPayload = {
    kind: ADMIN_CARDS_CONFIG_KIND,
    title: 'إعدادات كروت لوحة الإدارة',
    body: JSON.stringify(cleanPayload),
    sort_order: 999
  };

  if (config.rowId) {
    const { error } = await supabase
      .from('church_public_content')
      .update(dbPayload)
      .eq('id', config.rowId);
    if (error) throw new Error(error.message);
    return { ...cleanPayload, rowId: config.rowId };
  } else {
    const { data: existing } = await supabase
      .from('church_public_content')
      .select('id')
      .eq('kind', ADMIN_CARDS_CONFIG_KIND)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from('church_public_content')
        .update(dbPayload)
        .eq('id', existing.id);
      if (error) throw new Error(error.message);
      return { ...cleanPayload, rowId: existing.id };
    }

    const { data, error } = await supabase
      .from('church_public_content')
      .insert([dbPayload])
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return { ...cleanPayload, rowId: data?.id || null };
  }
};

const getScreenLabel = (screenKey) =>
  SCREEN_TARGETS.find(s => s.key === screenKey)?.label || 'لوحة الإدارة';

export default function NestedCardsBuilder({
  currentUser = null,
  isAdmin = false,
  rootParentId = null,
  title = 'إدارة الكروت المتداخلة وصلاحيات الظهور',
  onExit,
  onNavigateScreen,
  hubCards = [],
  setupCards = [],
  serviceGroups = [],
  services = [],
  caseCategories = [],
  customCards = [],
  priests = [],
  onRefresh
}) {
  const [currentParentKey, setCurrentParentKey] = useState(
    rootParentId ? `nested:${rootParentId}` : null
  );
  const [screenFilter, setScreenFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [cardsConfig, setCardsConfig] = useState({
    rowId: null,
    overrides: {},
    customScreenCards: [],
    cardMeta: {}
  });
  const [nestedRows, setNestedRows] = useState([]);
  const [dynamicEntries, setDynamicEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // نافذة إضافة / تعديل كارت متداخل + صلاحيات مكانه والأدوار
  const [nestedModalOpen, setNestedModalOpen] = useState(false);
  const [editingNestedId, setEditingNestedId] = useState(null);
  const [nestedForm, setNestedForm] = useState({
    placement_mode: 'screen',
    placement_screen: 'admin_hub',
    parent_key: '',
    allowed_roles: ['all'],
    title: '',
    subtitle: '',
    description: '',
    icon: '🗂️',
    badge_text: '',
    accent_color: 'red',
    target_action: 'children',
    target_screen: 'users',
    target_url: '',
    sort_order: 1,
    is_active: true
  });

  // نافذة تعديل كارت نظام أساسي أو كارت خدمة/فصل/بحث حالة
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
    placement_mode: 'screen',
    placement_screen: 'admin_hub',
    parent_key: '',
    allowed_roles: ['all'],
    isActive: true,
    sortOrder: 1
  });
  const [savingLive, setSavingLive] = useState(false);

  // نافذة الشاشة/المحتوى الديناميكي المدمج داخل الكارت
  const [activeBuilderCard, setActiveBuilderCard] = useState(null);
  const [entryForm, setEntryForm] = useState({
    id: null,
    title: '',
    entry_date: '',
    details: '',
    field_label: '',
    field_value: ''
  });
  const [savingEntry, setSavingEntry] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('nested_cards')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (!isAdmin) {
        query = query.eq('is_active', true);
      }

      const [cardsRes, cfg, entriesRes] = await Promise.all([
        query,
        loadAdminCardsConfig(),
        supabase.from('priest_custom_entries').select('*').order('created_at', { ascending: false })
      ]);

      if (cardsRes.error) {
        console.error(cardsRes.error);
      } else {
        setNestedRows(cardsRes.data || []);
      }

      if (!entriesRes.error && entriesRes.data) {
        setDynamicEntries(entriesRes.data);
      }

      setCardsConfig(cfg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [isAdmin]);

  useEffect(() => {
    setCurrentParentKey(rootParentId ? `nested:${rootParentId}` : null);
  }, [rootParentId]);

  const unifiedCards = useMemo(() => {
    const overrides = cardsConfig.overrides || {};
    const cardMeta = cardsConfig.cardMeta || {};
    const items = [];
    const seenBuiltin = new Set();

    const addBuiltin = (raw, defaultScreen) => {
      if (!raw?.id || raw.isCustom || raw.isNestedRoot) return;
      if (seenBuiltin.has(raw.id)) return;
      seenBuiltin.add(raw.id);

      const ov = overrides[raw.id] || {};
      const key = `builtin:${raw.id}`;
      const placementMode = ov.parent_key ? 'card' : 'screen';
      const placementScreen = ov.placement_screen || defaultScreen;

      items.push({
        key,
        kind: 'builtin',
        sourceType: defaultScreen === 'setup_hub' ? 'setup_virtual' : 'hub_virtual',
        id: raw.id,
        raw,
        title: ov.title || raw.title || '',
        subtitle: defaultScreen === 'setup_hub' ? 'كارت الإعدادات SETUP' : 'كارت لوحة الإدارة',
        description: ov.desc !== undefined ? ov.desc : (raw.desc || ''),
        icon: ov.icon || raw.icon || '🗂️',
        badge: raw.count || '',
        accent: defaultScreen === 'setup_hub' ? 'amber' : 'red',
        isActive: ov.is_active !== undefined ? ov.is_active : raw.is_active !== false,
        hasOverride: Boolean(overrides[raw.id]),
        placement_mode: placementMode,
        placement_screen: placementScreen,
        parent_key: ov.parent_key || null,
        allowed_roles: Array.isArray(ov.allowed_roles) && ov.allowed_roles.length > 0 ? ov.allowed_roles : ['all'],
        target_action: 'screen',
        target_screen: raw.id,
        editable: true,
        deletable: false,
        canNestInside: true
      });
    };

    (hubCards || []).forEach(c => addBuiltin(c, 'admin_hub'));
    (setupCards || []).forEach(c => addBuiltin(c, 'setup_hub'));

    (nestedRows || []).forEach(row => {
      const meta = cardMeta[row.id] || {};
      const parentKey = row.parent_id
        ? `nested:${row.parent_id}`
        : (meta.parent_key || null);
      const placementMode = parentKey ? 'card' : 'screen';
      const placementScreen = meta.placement_screen || 'admin_hub';

      items.push({
        key: `nested:${row.id}`,
        kind: 'nested',
        sourceType: 'nested_card',
        id: row.id,
        raw: row,
        title: row.title || '',
        subtitle: row.subtitle || '',
        description: row.description || '',
        icon: row.icon || '🗂️',
        badge: row.badge_text || '',
        accent: row.accent_color || 'red',
        isActive: row.is_active !== false,
        placement_mode: placementMode,
        placement_screen: placementScreen,
        parent_key: parentKey,
        allowed_roles: Array.isArray(meta.allowed_roles) && meta.allowed_roles.length > 0 ? meta.allowed_roles : ['all'],
        target_action: meta.target_screen && row.target_action === 'info' && !row.description
          ? 'screen'
          : (meta.target_action || row.target_action || 'children'),
        target_screen: meta.target_screen || 'users',
        target_url: row.target_url || '',
        sort_order: row.sort_order ?? 1,
        editable: true,
        deletable: true,
        canNestInside: true
      });
    });

    (serviceGroups || []).forEach((grp, idx) => {
      items.push({
        key: `srvgrp:${grp.id || idx}`,
        kind: 'db_item',
        sourceType: 'service_group',
        id: grp.id,
        raw: grp,
        title: grp.group_name || '',
        subtitle: [grp.gender_target, grp.head_servant_name ? `الأمين: ${grp.head_servant_name}` : ''].filter(Boolean).join(' • '),
        description: grp.servants_names ? `الخدام: ${grp.servants_names}` : '',
        icon: grp.icon || (grp.has_classes !== false ? '🏫' : '🕊️'),
        badge: grp.has_classes !== false ? 'خدمة بفصول' : 'اجتماع عام',
        accent: 'blue',
        isActive: true,
        placement_mode: 'screen',
        placement_screen: 'services',
        parent_key: null,
        allowed_roles: ['all'],
        target_action: 'screen',
        target_screen: 'services',
        editable: true,
        deletable: Boolean(grp.id),
        canNestInside: false
      });
    });

    (services || []).forEach((srv, idx) => {
      items.push({
        key: `srvcls:${srv.id || idx}`,
        kind: 'db_item',
        sourceType: 'service_class',
        id: srv.id,
        raw: srv,
        title: srv.class_name || '',
        subtitle: [srv.stage_name, srv.head_servant_name ? `الأمين: ${srv.head_servant_name}` : ''].filter(Boolean).join(' • '),
        description: [srv.vice_head_name, srv.meeting_time, srv.room_name].filter(Boolean).join(' • '),
        icon: '📘',
        badge: 'فصل دراسي',
        accent: 'emerald',
        isActive: true,
        placement_mode: 'screen',
        placement_screen: 'services',
        parent_key: null,
        allowed_roles: ['all'],
        target_action: 'screen',
        target_screen: 'services',
        editable: Boolean(srv.id),
        deletable: Boolean(srv.id),
        canNestInside: false
      });
    });

    (caseCategories || []).forEach((cat, idx) => {
      items.push({
        key: `cat:${cat.id || idx}`,
        kind: 'db_item',
        sourceType: 'case_category',
        id: cat.id,
        raw: cat,
        title: cat.name || '',
        subtitle: 'تصنيف بحث الحالة في مكتب الكاهن',
        description: '',
        icon: cat.icon || '📂',
        badge: 'تصنيف حالة',
        accent: 'emerald',
        isActive: true,
        placement_mode: 'screen',
        placement_screen: 'categories',
        parent_key: null,
        allowed_roles: ['admin', 'priest'],
        target_action: 'screen',
        target_screen: 'categories',
        editable: Boolean(cat.id),
        deletable: Boolean(cat.id),
        canNestInside: false
      });
    });

    (customCards || []).forEach((cc, idx) => {
      items.push({
        key: `priestcc:${cc.id || idx}`,
        kind: 'db_item',
        sourceType: 'custom_card',
        id: cc.id,
        raw: cc,
        title: cc.card_title || '',
        subtitle: 'كارت مخصص في صفحة الأب الكاهن',
        description: cc.description || '',
        icon: cc.card_icon || '📌',
        badge: 'كارت كاهن',
        accent: 'purple',
        isActive: true,
        placement_mode: 'screen',
        placement_screen: 'custom_cards',
        parent_key: null,
        allowed_roles: ['admin', 'priest'],
        target_action: 'screen',
        target_screen: 'custom_cards',
        editable: Boolean(cc.id),
        deletable: Boolean(cc.id),
        canNestInside: false
      });
    });

    return items;
  }, [hubCards, setupCards, nestedRows, cardsConfig, serviceGroups, services, caseCategories, customCards]);

  const itemByKey = useMemo(() => {
    const map = {};
    unifiedCards.forEach(it => { map[it.key] = it; });
    return map;
  }, [unifiedCards]);

  const childrenByParentKey = useMemo(() => {
    const map = {};
    unifiedCards.forEach(it => {
      const pk = it.parent_key || '__ROOT__';
      if (!map[pk]) map[pk] = [];
      map[pk].push(it);
    });
    return map;
  }, [unifiedCards]);

  const breadcrumbs = useMemo(() => {
    const trail = [];
    let cursor = currentParentKey ? itemByKey[currentParentKey] : null;
    const guard = new Set();
    while (cursor && !guard.has(cursor.key)) {
      guard.add(cursor.key);
      trail.unshift(cursor);
      cursor = cursor.parent_key ? itemByKey[cursor.parent_key] : null;
    }
    return trail;
  }, [currentParentKey, itemByKey]);

  const currentParentItem = currentParentKey ? itemByKey[currentParentKey] : null;

  const visibleCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    if (currentParentKey) {
      const children = childrenByParentKey[currentParentKey] || [];
      if (!q) return children;
      return children.filter(c => `${c.title} ${c.subtitle} ${c.description}`.toLowerCase().includes(q));
    }

    const rootList = childrenByParentKey['__ROOT__'] || [];
    return rootList.filter(item => {
      if (screenFilter === 'nested_only' && item.kind !== 'nested') return false;
      else if (screenFilter !== 'all' && screenFilter !== 'nested_only') {
        if (item.placement_screen !== screenFilter) return false;
      }
      if (!q) return true;
      return `${item.title} ${item.subtitle} ${item.description}`.toLowerCase().includes(q);
    });
  }, [currentParentKey, childrenByParentKey, screenFilter, searchQuery]);

  const collectDescendantKeys = (startKey) => {
    const collected = new Set([startKey]);
    const queue = [startKey];
    while (queue.length > 0) {
      const curr = queue.shift();
      const children = childrenByParentKey[curr] || [];
      for (const ch of children) {
        if (!collected.has(ch.key)) {
          collected.add(ch.key);
          queue.push(ch.key);
        }
      }
    }
    return [...collected];
  };

  const parentCardOptions = useMemo(() => {
    const blocked = editingNestedId ? new Set(collectDescendantKeys(`nested:${editingNestedId}`)) : new Set();
    return unifiedCards.filter(c => c.canNestInside && !blocked.has(c.key));
  }, [unifiedCards, editingNestedId, childrenByParentKey]);

  const openCreateNestedModal = (presetParentKey = currentParentKey) => {
    if (!isAdmin) return alert('🔒 إضافة الكروت متاحة للسوبر أدمن فقط.');

    const defaultScreen =
      !presetParentKey && SCREEN_TARGETS.some(s => s.key === screenFilter)
        ? screenFilter
        : 'admin_hub';

    const siblingsCount = (childrenByParentKey[presetParentKey || '__ROOT__'] || []).length;

    setEditingNestedId(null);
    setNestedForm({
      placement_mode: presetParentKey ? 'card' : 'screen',
      placement_screen: defaultScreen,
      parent_key: presetParentKey || '',
      allowed_roles: ['all'],
      title: '',
      subtitle: '',
      description: '',
      icon: '🗂️',
      badge_text: '',
      accent_color: 'red',
      target_action: 'children',
      target_screen: 'users',
      target_url: '',
      sort_order: siblingsCount + 1,
      is_active: true
    });
    setNestedModalOpen(true);
  };

  const openEditCard = (item, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return alert('🔒 تعديل الكروت متاح للسوبر أدمن فقط.');

    if (item.kind === 'nested') {
      setEditingNestedId(item.id);
      setNestedForm({
        placement_mode: item.parent_key ? 'card' : 'screen',
        placement_screen: item.placement_screen || 'admin_hub',
        parent_key: item.parent_key || '',
        allowed_roles: item.allowed_roles || ['all'],
        title: item.title || '',
        subtitle: item.subtitle || '',
        description: item.description || '',
        icon: item.icon || '🗂️',
        badge_text: item.badge || '',
        accent_color: item.accent || 'red',
        target_action: item.target_action || 'children',
        target_screen: item.target_screen || 'users',
        target_url: item.target_url || '',
        sort_order: item.sort_order ?? 1,
        is_active: item.isActive !== false
      });
      setNestedModalOpen(true);
      return;
    }

    const raw = item.raw || {};
    setEditingLiveCard(item);
    setLiveForm({
      sourceType: item.sourceType,
      id: item.id,
      title: item.title || '',
      subtitle: item.sourceType === 'service_group' ? (raw.head_servant_name || '') : (item.sourceType === 'service_class' ? (raw.stage_name || '') : ''),
      description: item.sourceType === 'service_group'
        ? (raw.servants_names || '')
        : item.sourceType === 'service_class'
          ? (raw.vice_head_name || '')
          : (item.description || ''),
      icon: item.icon || '📌',
      badge: item.sourceType === 'service_group'
        ? (raw.has_classes !== false ? 'yes' : 'no')
        : (item.sourceType === 'service_class' ? (raw.room_name || '') : ''),
      extra1: item.sourceType === 'service_group'
        ? (raw.gender_target || 'عام (الكل: ذكور وإناث)')
        : item.sourceType === 'service_class'
          ? (raw.head_servant_name || '')
          : (raw.priest_id || ''),
      extra2: item.sourceType === 'service_group'
        ? (raw.service_day || '')
        : (raw.meeting_time || ''),
      extra3: item.sourceType === 'service_group'
        ? (Array.isArray(raw.stages) ? raw.stages.join(', ') : (raw.stages || ''))
        : '',
      placement_mode: item.parent_key ? 'card' : 'screen',
      placement_screen: item.placement_screen || 'admin_hub',
      parent_key: item.parent_key || '',
      allowed_roles: item.allowed_roles || ['all'],
      isActive: item.isActive !== false,
      sortOrder: raw.sort_order || 1
    });
    setLiveModalOpen(true);
  };

  const toggleRoleInList = (rolesArr, roleKey) => {
    if (roleKey === 'all') return ['all'];
    const withoutAll = (rolesArr || []).filter(r => r !== 'all');
    const next = withoutAll.includes(roleKey)
      ? withoutAll.filter(r => r !== roleKey)
      : [...withoutAll, roleKey];
    return next.length === 0 ? ['all'] : next;
  };

  const handleSaveNestedCard = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!nestedForm.title.trim()) return alert('اكتب عنوان الكارت أولاً');

    if (nestedForm.placement_mode === 'card' && !nestedForm.parent_key) {
      return alert('اختر الكارت الأب الذي سيظهر بداخله هذا الكارت');
    }

    const chosenParentKey = nestedForm.placement_mode === 'card' ? nestedForm.parent_key : null;
    const dbParentId = chosenParentKey && chosenParentKey.startsWith('nested:')
      ? chosenParentKey.replace('nested:', '')
      : null;

    if (editingNestedId && dbParentId === editingNestedId) {
      return alert('لا يمكن جعل الكارت أباً لنفسه');
    }

    setSaving(true);
    try {
      const dbTargetAction = nestedForm.target_action === 'screen' ? 'info' : nestedForm.target_action;
      const payload = {
        parent_id: dbParentId,
        title: nestedForm.title.trim(),
        subtitle: (nestedForm.subtitle || '').trim(),
        description: (nestedForm.description || '').trim(),
        icon: (nestedForm.icon || '🗂️').trim(),
        badge_text: (nestedForm.badge_text || '').trim(),
        accent_color: nestedForm.accent_color || 'red',
        target_action: dbTargetAction,
        target_url: (nestedForm.target_url || '').trim(),
        sort_order: Number(nestedForm.sort_order || 1),
        is_active: nestedForm.is_active !== false,
        updated_at: new Date().toISOString()
      };

      let savedRow = null;
      if (editingNestedId) {
        const { data, error } = await supabase
          .from('nested_cards')
          .update(payload)
          .eq('id', editingNestedId)
          .select()
          .single();
        if (error) throw new Error(error.message);
        savedRow = data;
      } else {
        const { data, error } = await supabase
          .from('nested_cards')
          .insert([{ ...payload, created_by: currentUser?.id || null }])
          .select()
          .single();
        if (error) throw new Error(error.message);
        savedRow = data;
      }

      if (savedRow?.id) {
        const nextMeta = {
          ...(cardsConfig.cardMeta || {}),
          [savedRow.id]: {
            placement_mode: nestedForm.placement_mode,
            placement_screen: nestedForm.placement_screen || 'admin_hub',
            parent_key: chosenParentKey,
            allowed_roles: nestedForm.allowed_roles || ['all'],
            target_action: nestedForm.target_action,
            target_screen: nestedForm.target_screen || 'users'
          }
        };
        const savedCfg = await saveAdminCardsConfig({ ...cardsConfig, cardMeta: nextMeta });
        setCardsConfig(savedCfg);
      }

      setNestedModalOpen(false);
      await fetchAll();
      if (onRefresh) await onRefresh();
    } catch (err) {
      alert('تعذر حفظ الكارت: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLiveCard = async (e) => {
    e.preventDefault();
    if (!isAdmin || !editingLiveCard) return;
    if (!liveForm.title.trim()) return alert('اكتب عنوان الكارت أولاً');

    setSavingLive(true);
    try {
      const targetId = liveForm.id || editingLiveCard.id;

      if (liveForm.sourceType === 'hub_virtual' || liveForm.sourceType === 'setup_virtual') {
        const chosenParentKey = liveForm.placement_mode === 'card' ? liveForm.parent_key : null;
        if (chosenParentKey === `builtin:${targetId}`) {
          alert('لا يمكن وضع الكارت داخل نفسه');
          setSavingLive(false);
          return;
        }
        const nextCfg = {
          ...cardsConfig,
          overrides: {
            ...(cardsConfig.overrides || {}),
            [targetId]: {
              title: liveForm.title.trim(),
              desc: (liveForm.description || '').trim(),
              icon: (liveForm.icon || '🗂️').trim(),
              is_active: Boolean(liveForm.isActive),
              placement_screen: liveForm.placement_screen || 'admin_hub',
              parent_key: chosenParentKey,
              allowed_roles: liveForm.allowed_roles || ['all']
            }
          }
        };
        const saved = await saveAdminCardsConfig(nextCfg);
        setCardsConfig(saved);
      } else if (liveForm.sourceType === 'service_group') {
        const stagesArr = String(liveForm.extra3 || '').split(/[,،]/).map(s => s.trim()).filter(Boolean);
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
        if (targetId) {
          const { error } = await supabase.from('service_groups').update(payload).eq('id', targetId);
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
        const { error } = await supabase.from('services').update(payload).eq('id', targetId);
        if (error) throw new Error(error.message);
      } else if (liveForm.sourceType === 'case_category') {
        const { error } = await supabase
          .from('case_categories')
          .update({ name: liveForm.title.trim(), icon: (liveForm.icon || '📂').trim() })
          .eq('id', targetId);
        if (error) throw new Error(error.message);
      } else if (liveForm.sourceType === 'custom_card') {
        const { error } = await supabase
          .from('priest_custom_cards')
          .update({
            card_title: liveForm.title.trim(),
            card_icon: (liveForm.icon || '📌').trim(),
            description: (liveForm.description || '').trim(),
            priest_id: liveForm.extra1 || null
          })
          .eq('id', targetId);
        if (error) throw new Error(error.message);
      }

      setLiveModalOpen(false);
      await fetchAll();
      if (onRefresh) await onRefresh();
    } catch (err) {
      alert('تعذر الحفظ: ' + err.message);
    } finally {
      setSavingLive(false);
    }
  };

  const handleToggleActive = async (item, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    try {
      if (item.kind === 'nested') {
        const { error } = await supabase
          .from('nested_cards')
          .update({ is_active: !(item.isActive !== false), updated_at: new Date().toISOString() })
          .eq('id', item.id);
        if (error) throw new Error(error.message);
      } else if (item.kind === 'builtin') {
        const prevOv = cardsConfig.overrides?.[item.id] || {};
        const nextCfg = {
          ...cardsConfig,
          overrides: {
            ...(cardsConfig.overrides || {}),
            [item.id]: {
              ...prevOv,
              title: prevOv.title || item.title,
              desc: prevOv.desc !== undefined ? prevOv.desc : item.description,
              icon: prevOv.icon || item.icon,
              placement_screen: prevOv.placement_screen || item.placement_screen,
              parent_key: prevOv.parent_key || item.parent_key || null,
              allowed_roles: prevOv.allowed_roles || item.allowed_roles || ['all'],
              is_active: !(item.isActive !== false)
            }
          }
        };
        const saved = await saveAdminCardsConfig(nextCfg);
        setCardsConfig(saved);
      }
      await fetchAll();
      if (onRefresh) await onRefresh();
    } catch (err) {
      alert('تعذر تغيير الحالة: ' + err.message);
    }
  };

  const handleResetBuiltinOverride = async (item, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin || item.kind !== 'builtin') return;
    const nextOv = { ...(cardsConfig.overrides || {}) };
    delete nextOv[item.id];
    const saved = await saveAdminCardsConfig({ ...cardsConfig, overrides: nextOv });
    setCardsConfig(saved);
    await fetchAll();
    if (onRefresh) await onRefresh();
  };

  const handleDeleteCard = async (item, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;

    if (item.kind === 'nested') {
      const keysToDelete = collectDescendantKeys(item.key);
      const nestedIds = keysToDelete
        .filter(k => k.startsWith('nested:'))
        .map(k => k.replace('nested:', ''));
      const childrenCount = nestedIds.length - 1;
      const msg = childrenCount > 0
        ? `حذف الكارت "${item.title}" سيحذف أيضاً ${childrenCount} كارت فرعي بداخله. هل أنت متأكد؟`
        : `هل أنت متأكد من حذف الكارت "${item.title}"؟`;

      if (!confirm(msg)) return;

      const { error } = await supabase.from('nested_cards').delete().in('id', nestedIds);
      if (error) return alert('تعذر الحذف: ' + error.message);

      const nextMeta = { ...(cardsConfig.cardMeta || {}) };
      nestedIds.forEach(id => delete nextMeta[id]);
      const saved = await saveAdminCardsConfig({ ...cardsConfig, cardMeta: nextMeta });
      setCardsConfig(saved);

      if (keysToDelete.includes(currentParentKey)) {
        setCurrentParentKey(item.parent_key || (rootParentId ? `nested:${rootParentId}` : null));
      }
      await fetchAll();
      if (onRefresh) await onRefresh();
      return;
    }

    if (item.kind === 'db_item' && item.id) {
      if (!confirm(`هل أنت متأكد من حذف "${item.title}"؟`)) return;
      const tableMap = {
        service_group: 'service_groups',
        service_class: 'services',
        case_category: 'case_categories',
        custom_card: 'priest_custom_cards'
      };
      const tbl = tableMap[item.sourceType];
      if (!tbl) return;
      const { error } = await supabase.from(tbl).delete().eq('id', item.id);
      if (error) return alert('تعذر الحذف: ' + error.message);
      await fetchAll();
      if (onRefresh) await onRefresh();
    }
  };

  const parseEntryPayload = (row) => {
    try {
      const parsed = JSON.parse(row.details || '{}');
      if (parsed && typeof parsed === 'object' && ('text' in parsed || 'field_label' in parsed)) {
        return {
          text: parsed.text || '',
          field_label: parsed.field_label || '',
          field_value: parsed.field_value || ''
        };
      }
    } catch {
      // نص عادي
    }
    return { text: row.details || '', field_label: '', field_value: '' };
  };

  const handleSaveDynamicEntry = async (e) => {
    e.preventDefault();
    if (!activeBuilderCard || !entryForm.title.trim()) return;
    setSavingEntry(true);
    try {
      const encodedDetails = JSON.stringify({
        text: (entryForm.details || '').trim(),
        field_label: (entryForm.field_label || '').trim(),
        field_value: (entryForm.field_value || '').trim()
      });

      if (entryForm.id) {
        const { data, error } = await supabase
          .from('priest_custom_entries')
          .update({
            title: entryForm.title.trim(),
            entry_date: entryForm.entry_date || null,
            details: encodedDetails
          })
          .eq('id', entryForm.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        if (data) {
          setDynamicEntries(prev => prev.map(x => (x.id === data.id ? data : x)));
        }
      } else {
        const defaultPriestId = currentUser?.id || priests?.[0]?.id || null;
        const { data, error } = await supabase
          .from('priest_custom_entries')
          .insert([{
            card_id: activeBuilderCard.id,
            priest_id: defaultPriestId,
            title: entryForm.title.trim(),
            entry_date: entryForm.entry_date || null,
            details: encodedDetails
          }])
          .select()
          .single();
        if (error) throw new Error(error.message);
        if (data) {
          setDynamicEntries(prev => [data, ...prev]);
        }
      }

      setEntryForm({ id: null, title: '', entry_date: '', details: '', field_label: '', field_value: '' });
    } catch (err) {
      alert('تعذر حفظ العنصر: ' + err.message);
    } finally {
      setSavingEntry(false);
    }
  };

  const handleDeleteDynamicEntry = async (entryId) => {
    if (!confirm('حذف هذا العنصر من محتوى الكارت؟')) return;
    const { error } = await supabase.from('priest_custom_entries').delete().eq('id', entryId);
    if (!error) {
      setDynamicEntries(prev => prev.filter(x => x.id !== entryId));
    }
  };

  const handleOpenOrRunCard = (item) => {
    if (item.kind === 'nested') {
      if (item.target_action === 'link' && item.target_url) {
        window.open(item.target_url, '_blank', 'noopener,noreferrer');
        return;
      }
      if (item.target_action === 'screen' && item.target_screen && onNavigateScreen) {
        onNavigateScreen(item.target_screen);
        return;
      }
      if (item.target_action === 'info') {
        setEntryForm({ id: null, title: '', entry_date: '', details: '', field_label: '', field_value: '' });
        setActiveBuilderCard(item);
        return;
      }
      setCurrentParentKey(item.key);
      return;
    }

    if (item.canNestInside) {
      setCurrentParentKey(item.key);
      return;
    }

    if (onNavigateScreen && item.target_screen) {
      onNavigateScreen(item.target_screen);
    }
  };

  const goBackOneLevel = () => {
    if (currentParentItem) {
      if (rootParentId && currentParentKey === `nested:${rootParentId}`) {
        if (onExit) onExit();
        return;
      }
      setCurrentParentKey(currentParentItem.parent_key || null);
      return;
    }
    if (onExit) onExit();
  };

  const builderEntries = activeBuilderCard
    ? dynamicEntries.filter(en => String(en.card_id) === String(activeBuilderCard.id))
    : [];

  return (
    <div className="space-y-3 text-xs">
      {/* شريط العنوان والإضافة */}
      <div className="bg-white p-3.5 rounded-2xl border shadow-2xs flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {(currentParentKey || onExit) && (
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

        {isAdmin && (
          <button
            type="button"
            onClick={() => openCreateNestedModal(currentParentKey)}
            className="px-4 py-2 bg-[#7a1c24] hover:bg-[#5f141a] text-white rounded-xl font-black flex items-center gap-1.5 shadow cursor-pointer"
          >
            <FolderPlus size={15} />
            {currentParentItem ? `إضافة كارت جوا "${currentParentItem.title}"` : 'إضافة كارت جديد'}
          </button>
        )}
      </div>

      {/* مسار الكروت المتداخلة */}
      <div className="bg-[#fbfaf7] px-3.5 py-2 rounded-2xl border flex items-center gap-1.5 flex-wrap font-bold text-gray-700">
        <button
          type="button"
          onClick={() => setCurrentParentKey(rootParentId ? `nested:${rootParentId}` : null)}
          className={`px-2.5 py-1 rounded-lg cursor-pointer ${!currentParentKey ? 'bg-[#7a1c24] text-white' : 'hover:bg-gray-200'}`}
        >
          🏠 المستوى الرئيسي (الشاشات والكروت)
        </button>

        {breadcrumbs.map((crumb) => (
          <div key={crumb.key} className="flex items-center gap-1.5">
            <ChevronLeft size={14} className="text-gray-400" />
            <button
              type="button"
              onClick={() => setCurrentParentKey(crumb.key)}
              className={`px-2.5 py-1 rounded-lg cursor-pointer ${currentParentKey === crumb.key ? 'bg-[#7a1c24] text-white' : 'bg-white border hover:bg-gray-100'}`}
            >
              {crumb.icon} {crumb.title}
            </button>
          </div>
        ))}
      </div>

      {/* شريط الفلتر والبحث */}
      <div className="bg-white p-2.5 rounded-2xl border flex flex-wrap items-center justify-between gap-2">
        {!currentParentKey ? (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 font-bold">
            {[
              { key: 'all', label: 'كل الكروت' },
              { key: 'admin_hub', label: 'لوحة الإدارة' },
              { key: 'setup_hub', label: 'الإعدادات SETUP' },
              { key: 'priest_hub', label: 'شاشة الكاهن' },
              { key: 'service_hub', label: 'الخدمة (الكاهن)' },
              { key: 'confessions', label: 'الاعترافات' },
              { key: 'cases', label: 'بحث الحالة' },
              { key: 'services', label: 'الخدمات والفصول' },
              { key: 'categories', label: 'تصنيفات الحالة' },
              { key: 'custom_cards', label: 'كروت الكاهن' },
              { key: 'nested_only', label: 'الكروت المضافة' }
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setScreenFilter(tab.key)}
                className={`px-2.5 py-1.5 rounded-xl shrink-0 cursor-pointer ${
                  screenFilter === tab.key
                    ? 'bg-[#7a1c24] text-white font-black'
                    : 'bg-gray-50 border text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-[#7a1c24]">
              {currentParentItem?.icon} أنت الآن داخل كارت: {currentParentItem?.title}
            </span>
            {currentParentItem?.kind === 'builtin' && onNavigateScreen && (
              <button
                type="button"
                onClick={() => onNavigateScreen(currentParentItem.id)}
                className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl font-black flex items-center gap-1 cursor-pointer"
              >
                <Play size={11} /> فتح شاشة "{currentParentItem.title}"
              </button>
            )}
          </div>
        )}

        <div className="relative min-w-52 mr-auto">
          <Search size={14} className="absolute right-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="ابحث في الكروت..."
            className="w-full pr-8 pl-3 py-1.5 bg-[#fbfaf7] border rounded-xl outline-none focus:border-[#7a1c24]"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* شبكة الكروت */}
      {loading ? (
        <div className="bg-white p-8 rounded-3xl border text-center text-gray-500 font-bold">
          جاري تحميل الكروت...
        </div>
      ) : visibleCards.length === 0 ? (
        <div className="bg-white p-10 rounded-3xl border text-center space-y-3">
          <FolderOpen size={36} className="mx-auto text-gray-400" />
          <div className="font-black text-sm text-gray-800">
            {currentParentItem
              ? `لا توجد كروت داخل "${currentParentItem.title}" حتى الآن`
              : 'لا توجد كروت مطابقة للفلتر الحالي'}
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => openCreateNestedModal(currentParentKey)}
              className="px-4 py-2 bg-[#7a1c24] text-white rounded-xl font-black cursor-pointer"
            >
              + أضف أول كارت هنا
            </button>
          )}
        </div>
      ) : (
        <div className="max-h-[56vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleCards.map((item) => {
              const theme = COLOR_THEMES[item.accent] || COLOR_THEMES.red;
              const innerCount = (childrenByParentKey[item.key] || []).length;
              const entriesCount = dynamicEntries.filter(en => String(en.card_id) === String(item.id)).length;
              const rolesLabel = item.allowed_roles.includes('all')
                ? 'للجميع'
                : item.allowed_roles.map(r => CARD_ROLE_OPTIONS.find(o => o.key === r)?.label || r).join('، ');

              return (
                <div
                  key={item.key}
                  onClick={() => handleOpenOrRunCard(item)}
                  className={`${theme.card} ${item.isActive === false ? 'opacity-60 border-dashed' : ''} border-2 p-4 rounded-2xl shadow-2xs hover:shadow-md transition flex flex-col justify-between gap-3 cursor-pointer`}
                >
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-2xl">{item.icon}</span>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {item.isActive === false && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800">
                            متوقف
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-800">
                          {item.parent_key
                            ? `جوا: ${itemByKey[item.parent_key]?.title || 'كارت'}`
                            : getScreenLabel(item.placement_screen)}
                        </span>
                        {item.canNestInside && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${theme.badge}`}>
                            {innerCount} جواه
                          </span>
                        )}
                        {item.target_action === 'link' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-900 flex items-center gap-0.5">
                            <ExternalLink size={10} /> رابط
                          </span>
                        )}
                        {item.target_action === 'info' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900 flex items-center gap-0.5">
                            <FileText size={10} /> محتوى ({entriesCount})
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-black text-gray-900">{item.title}</h4>
                      {item.subtitle && (
                        <div className="text-[11px] font-bold text-[#7a1c24] mt-0.5">{item.subtitle}</div>
                      )}
                      {item.description && (
                        <p className="text-[11px] text-gray-600 mt-1 line-clamp-2">{item.description}</p>
                      )}
                      <div className="text-[10px] text-emerald-900 font-bold mt-1 flex items-center gap-1">
                        <ShieldCheck size={11} /> الصلاحية: {rolesLabel}
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="pt-2 border-t flex items-center justify-between gap-1.5 flex-wrap"
                  >
                    <div className="flex items-center gap-1 flex-wrap">
                      {isAdmin && item.canNestInside && (
                        <button
                          type="button"
                          onClick={() => openCreateNestedModal(item.key)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer ${theme.btn}`}
                        >
                          <FolderPlus size={12} /> + كارت جواه
                        </button>
                      )}
                      {item.kind === 'nested' && item.target_action === 'info' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEntryForm({ id: null, title: '', entry_date: '', details: '', field_label: '', field_value: '' });
                            setActiveBuilderCard(item);
                          }}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer"
                        >
                          <LayoutGrid size={12} /> عناصر الشاشة ({entriesCount})
                        </button>
                      )}
                      {item.kind === 'builtin' && onNavigateScreen && (
                        <button
                          type="button"
                          onClick={() => onNavigateScreen(item.id)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer"
                          title="فتح شاشة هذا الكارت"
                        >
                          <Play size={11} /> فتح
                        </button>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1 flex-wrap mr-auto">
                        {(item.kind === 'nested' || item.kind === 'builtin') && (
                          <button
                            type="button"
                            onClick={(e) => handleToggleActive(item, e)}
                            className={`px-2 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                              item.isActive !== false
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900'
                                : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900'
                            }`}
                          >
                            <Power size={11} /> {item.isActive !== false ? 'إيقاف' : 'تشغيل'}
                          </button>
                        )}
                        {item.editable && (
                          <button
                            type="button"
                            onClick={(e) => openEditCard(item, e)}
                            className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 size={11} /> تعديل
                          </button>
                        )}
                        {item.hasOverride && (
                          <button
                            type="button"
                            onClick={(e) => handleResetBuiltinOverride(item, e)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
                            title="استعادة الوضع الافتراضي"
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                        {item.deletable && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCard(item, e)}
                            className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={11} /> حذف
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* نافذة إضافة / تعديل كارت متداخل */}
      {nestedModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-3 text-xs font-bold max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-black text-[#7a1c24]">
                {editingNestedId ? '✏️ تعديل الكارت وصلاحيات ظهوره' : '➕ إضافة كارت جديد'}
              </h3>
              <button
                type="button"
                onClick={() => setNestedModalOpen(false)}
                className="p-1 text-gray-500 hover:text-gray-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveNestedCard} className="space-y-3">
              <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200 space-y-2">
                <label className="block text-[#7a1c24] font-black">① أين يظهر هذا الكارت؟ (مكان الظهور):</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNestedForm(prev => ({ ...prev, placement_mode: 'screen', parent_key: '' }))}
                    className={`p-2 rounded-xl border text-[11px] cursor-pointer ${
                      nestedForm.placement_mode === 'screen'
                        ? 'bg-[#7a1c24] text-white border-[#7a1c24]'
                        : 'bg-white text-gray-800'
                    }`}
                  >
                    🖥️ يظهر مباشرة في شاشة
                  </button>
                  <button
                    type="button"
                    onClick={() => setNestedForm(prev => ({
                      ...prev,
                      placement_mode: 'card',
                      parent_key: prev.parent_key || parentCardOptions[0]?.key || ''
                    }))}
                    className={`p-2 rounded-xl border text-[11px] cursor-pointer ${
                      nestedForm.placement_mode === 'card'
                        ? 'bg-[#7a1c24] text-white border-[#7a1c24]'
                        : 'bg-white text-gray-800'
                    }`}
                  >
                    🗂️ يظهر جوا كارت آخر
                  </button>
                </div>

                {nestedForm.placement_mode === 'screen' ? (
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white"
                    value={nestedForm.placement_screen}
                    onChange={e => setNestedForm({ ...nestedForm, placement_screen: e.target.value })}
                  >
                    {SCREEN_TARGETS.map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    required
                    className="w-full p-2.5 border rounded-xl bg-white"
                    value={nestedForm.parent_key || ''}
                    onChange={e => setNestedForm({ ...nestedForm, parent_key: e.target.value })}
                  >
                    <option value="">-- اختر الكارت الأب --</option>
                    <optgroup label="كروت الشاشات الأساسية">
                      {parentCardOptions.filter(p => p.kind === 'builtin').map(p => (
                        <option key={p.key} value={p.key}>{p.icon} {p.title}</option>
                      ))}
                    </optgroup>
                    <optgroup label="الكروت المضافة المتداخلة">
                      {parentCardOptions.filter(p => p.kind === 'nested').map(p => (
                        <option key={p.key} value={p.key}>{p.icon} {p.title}</option>
                      ))}
                    </optgroup>
                  </select>
                )}
              </div>

              <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-200 space-y-2">
                <label className="block text-emerald-950 font-black">② صلاحية الرؤية (مين يشوف الكارت ده؟):</label>
                <div className="flex flex-wrap gap-1.5">
                  {CARD_ROLE_OPTIONS.map(rk => {
                    const checked = nestedForm.allowed_roles.includes(rk.key);
                    return (
                      <button
                        key={rk.key}
                        type="button"
                        onClick={() => setNestedForm(prev => ({
                          ...prev,
                          allowed_roles: toggleRoleInList(prev.allowed_roles, rk.key)
                        }))}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] cursor-pointer ${
                          checked
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white text-gray-800'
                        }`}
                      >
                        {checked ? '✓ ' : ''}{rk.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block mb-1">الأيقونة</label>
                  <input
                    className="w-full p-2.5 border rounded-xl text-center text-base"
                    value={nestedForm.icon}
                    onChange={(e) => setNestedForm({ ...nestedForm, icon: e.target.value })}
                  />
                </div>
                <div className="col-span-3">
                  <label className="block mb-1">عنوان الكارت *</label>
                  <input
                    required
                    placeholder="مثال: كشف الافتقاد / ملفات الاجتماع..."
                    className="w-full p-2.5 border rounded-xl"
                    value={nestedForm.title}
                    onChange={(e) => setNestedForm({ ...nestedForm, title: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1">عنوان فرعي</label>
                  <input
                    className="w-full p-2.5 border rounded-xl"
                    value={nestedForm.subtitle}
                    onChange={(e) => setNestedForm({ ...nestedForm, subtitle: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1">شارة صغيرة (Badge)</label>
                  <input
                    className="w-full p-2.5 border rounded-xl"
                    value={nestedForm.badge_text}
                    onChange={(e) => setNestedForm({ ...nestedForm, badge_text: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block mb-1">لون الكارت</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white"
                    value={nestedForm.accent_color}
                    onChange={(e) => setNestedForm({ ...nestedForm, accent_color: e.target.value })}
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
                    value={nestedForm.target_action}
                    onChange={(e) => setNestedForm({ ...nestedForm, target_action: e.target.value })}
                  >
                    <option value="children">🗂️ كروت فرعية بداخله</option>
                    <option value="screen">🖥️ شاشة من النظام</option>
                    <option value="info">📄 شاشة محتوى / عناصر ديناميكية</option>
                    <option value="link">🔗 رابط خارجي</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1">الترتيب</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full p-2.5 border rounded-xl text-center"
                    value={nestedForm.sort_order}
                    onChange={(e) => setNestedForm({ ...nestedForm, sort_order: e.target.value })}
                  />
                </div>
              </div>

              {nestedForm.target_action === 'screen' && (
                <div>
                  <label className="block mb-1">اختر الشاشة التي يفتحها:</label>
                  <select
                    className="w-full p-2.5 border rounded-xl bg-white"
                    value={nestedForm.target_screen}
                    onChange={(e) => setNestedForm({ ...nestedForm, target_screen: e.target.value })}
                  >
                    {INTERNAL_SCREENS.map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {nestedForm.target_action === 'link' && (
                <div>
                  <label className="block mb-1">الرابط (URL)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    className="w-full p-2.5 border rounded-xl"
                    value={nestedForm.target_url}
                    onChange={(e) => setNestedForm({ ...nestedForm, target_url: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="block mb-1">الوصف / المحتوى</label>
                <textarea
                  rows={2}
                  className="w-full p-2.5 border rounded-xl"
                  value={nestedForm.description}
                  onChange={(e) => setNestedForm({ ...nestedForm, description: e.target.value })}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-emerald-900">
                <input
                  type="checkbox"
                  checked={nestedForm.is_active !== false}
                  onChange={(e) => setNestedForm({ ...nestedForm, is_active: e.target.checked })}
                />
                تفعيل وتشغيل الكارت
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNestedModalOpen(false)}
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

      {/* نافذة تعديل كارت أساسي أو كارت خدمة/فصل/تصنيف */}
      {liveModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-3 text-xs font-bold max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-black text-[#7a1c24]">✏️ تعديل الكارت وصلاحياته</h3>
              <button
                type="button"
                onClick={() => setLiveModalOpen(false)}
                className="p-1 text-gray-500 hover:text-gray-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLiveCard} className="space-y-3">
              {(liveForm.sourceType === 'hub_virtual' || liveForm.sourceType === 'setup_virtual') && (
                <>
                  <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200 space-y-2">
                    <label className="block text-[#7a1c24] font-black">مكان ظهور الكارت:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setLiveForm(prev => ({ ...prev, placement_mode: 'screen', parent_key: '' }))}
                        className={`p-2 rounded-xl border text-[11px] cursor-pointer ${
                          liveForm.placement_mode === 'screen' ? 'bg-[#7a1c24] text-white' : 'bg-white'
                        }`}
                      >
                        🖥️ في شاشة مباشرة
                      </button>
                      <button
                        type="button"
                        onClick={() => setLiveForm(prev => ({ ...prev, placement_mode: 'card' }))}
                        className={`p-2 rounded-xl border text-[11px] cursor-pointer ${
                          liveForm.placement_mode === 'card' ? 'bg-[#7a1c24] text-white' : 'bg-white'
                        }`}
                      >
                        🗂️ جوا كارت آخر
                      </button>
                    </div>

                    {liveForm.placement_mode === 'screen' ? (
                      <select
                        className="w-full p-2.5 border rounded-xl bg-white"
                        value={liveForm.placement_screen}
                        onChange={e => setLiveForm({ ...liveForm, placement_screen: e.target.value })}
                      >
                        <option value="admin_hub">🛡️ لوحة الإدارة الرئيسية</option>
                        <option value="setup_hub">🛠️ الإعدادات SETUP</option>
                      </select>
                    ) : (
                      <select
                        className="w-full p-2.5 border rounded-xl bg-white"
                        value={liveForm.parent_key || ''}
                        onChange={e => setLiveForm({ ...liveForm, parent_key: e.target.value })}
                      >
                        <option value="">-- اختر الكارت الأب --</option>
                        {parentCardOptions
                          .filter(p => p.key !== `builtin:${liveForm.id}`)
                          .map(p => (
                            <option key={p.key} value={p.key}>{p.icon} {p.title}</option>
                          ))}
                      </select>
                    )}
                  </div>

                  <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-200 space-y-1.5">
                    <label className="block text-emerald-950 font-black">صلاحية الرؤية:</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CARD_ROLE_OPTIONS.map(rk => {
                        const checked = liveForm.allowed_roles.includes(rk.key);
                        return (
                          <button
                            key={rk.key}
                            type="button"
                            onClick={() => setLiveForm(prev => ({
                              ...prev,
                              allowed_roles: toggleRoleInList(prev.allowed_roles, rk.key)
                            }))}
                            className={`px-2.5 py-1 rounded-xl border text-[11px] cursor-pointer ${
                              checked ? 'bg-emerald-700 text-white' : 'bg-white'
                            }`}
                          >
                            {checked ? '✓ ' : ''}{rk.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
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

              {(liveForm.sourceType === 'hub_virtual' || liveForm.sourceType === 'setup_virtual' || liveForm.sourceType === 'custom_card') && (
                <div>
                  <label className="block mb-1">الوصف</label>
                  <textarea
                    rows={2}
                    className="w-full p-2.5 border rounded-xl"
                    value={liveForm.description}
                    onChange={e => setLiveForm({ ...liveForm, description: e.target.value })}
                  />
                </div>
              )}

              {liveForm.sourceType === 'service_group' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <select className="p-2.5 border rounded-xl bg-white" value={liveForm.badge || 'yes'} onChange={e => setLiveForm({ ...liveForm, badge: e.target.value })}>
                      <option value="yes">خدمة بفصول</option>
                      <option value="no">اجتماع عام بدون فصول</option>
                    </select>
                    <input placeholder="يوم الخدمة" className="p-2.5 border rounded-xl" value={liveForm.extra2} onChange={e => setLiveForm({ ...liveForm, extra2: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="أمين الخدمة" className="p-2.5 border rounded-xl" value={liveForm.subtitle} onChange={e => setLiveForm({ ...liveForm, subtitle: e.target.value })} />
                    <input placeholder="الخدام (بفاصلة)" className="p-2.5 border rounded-xl" value={liveForm.description} onChange={e => setLiveForm({ ...liveForm, description: e.target.value })} />
                  </div>
                  <input placeholder="السنوات الدراسية (بفاصلة)" className="w-full p-2.5 border rounded-xl" value={liveForm.extra3} onChange={e => setLiveForm({ ...liveForm, extra3: e.target.value })} />
                </>
              )}

              {liveForm.sourceType === 'service_class' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="المرحلة / الخدمة" className="p-2.5 border rounded-xl" value={liveForm.subtitle} onChange={e => setLiveForm({ ...liveForm, subtitle: e.target.value })} />
                    <input placeholder="أمين الفصل" className="p-2.5 border rounded-xl" value={liveForm.extra1} onChange={e => setLiveForm({ ...liveForm, extra1: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="الميعاد" className="p-2.5 border rounded-xl" value={liveForm.extra2} onChange={e => setLiveForm({ ...liveForm, extra2: e.target.value })} />
                    <input placeholder="القاعة" className="p-2.5 border rounded-xl" value={liveForm.badge} onChange={e => setLiveForm({ ...liveForm, badge: e.target.value })} />
                  </div>
                </>
              )}

              {(liveForm.sourceType === 'hub_virtual' || liveForm.sourceType === 'setup_virtual') && (
                <label className="flex items-center gap-2 cursor-pointer text-emerald-900">
                  <input
                    type="checkbox"
                    checked={liveForm.isActive}
                    onChange={e => setLiveForm({ ...liveForm, isActive: e.target.checked })}
                  />
                  تفعيل وإظهار الكارت
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setLiveModalOpen(false)} className="px-4 py-2 border rounded-xl cursor-pointer">
                  إلغاء
                </button>
                <button type="submit" disabled={savingLive} className="px-5 py-2 bg-[#7a1c24] text-white rounded-xl flex items-center gap-1.5 shadow cursor-pointer">
                  <Save size={14} /> {savingLive ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة بناء وإدارة محتوى/عناصر الشاشة داخل الكارت */}
      {activeBuilderCard && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 space-y-4 text-xs font-bold max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm md:text-base font-black text-[#7a1c24]">
                  {activeBuilderCard.icon} شاشة ومحتوى: {activeBuilderCard.title}
                </h3>
                {activeBuilderCard.subtitle && (
                  <p className="text-[11px] text-gray-500 mt-0.5">{activeBuilderCard.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveBuilderCard(null)}
                className="p-1.5 bg-gray-100 rounded-xl text-gray-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {activeBuilderCard.description && (
              <div className="p-3 bg-[#fbfaf7] border rounded-2xl text-gray-700 whitespace-pre-line">
                {activeBuilderCard.description}
              </div>
            )}

            {isAdmin && (
              <form onSubmit={handleSaveDynamicEntry} className="bg-amber-50/50 border border-amber-200 p-4 rounded-2xl space-y-2.5">
                <div className="font-black text-[#7a1c24] flex items-center gap-1">
                  <Plus size={14} /> {entryForm.id ? 'تعديل عنصر / سجل داخل الكارت' : 'إضافة عنصر / حقل بيانات جديد داخل الكارت'}
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    required
                    placeholder="عنوان البند أو السجل *"
                    className="p-2.5 border rounded-xl bg-white"
                    value={entryForm.title}
                    onChange={e => setEntryForm({ ...entryForm, title: e.target.value })}
                  />
                  <input
                    type="date"
                    className="p-2.5 border rounded-xl bg-white"
                    value={entryForm.entry_date}
                    onChange={e => setEntryForm({ ...entryForm, entry_date: e.target.value })}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    placeholder="اسم حقل إضافي (مثال: المسؤول / المبلغ / الحالة)"
                    className="p-2.5 border rounded-xl bg-white"
                    value={entryForm.field_label}
                    onChange={e => setEntryForm({ ...entryForm, field_label: e.target.value })}
                  />
                  <input
                    placeholder="قيمة الحقل الإضافي"
                    className="p-2.5 border rounded-xl bg-white"
                    value={entryForm.field_value}
                    onChange={e => setEntryForm({ ...entryForm, field_value: e.target.value })}
                  />
                </div>
                <textarea
                  rows={2}
                  placeholder="تفاصيل أو ملاحظات البند..."
                  className="w-full p-2.5 border rounded-xl bg-white"
                  value={entryForm.details}
                  onChange={e => setEntryForm({ ...entryForm, details: e.target.value })}
                />
                <div className="flex justify-end gap-2">
                  {entryForm.id && (
                    <button
                      type="button"
                      onClick={() => setEntryForm({ id: null, title: '', entry_date: '', details: '', field_label: '', field_value: '' })}
                      className="px-3 py-1.5 border rounded-xl bg-white cursor-pointer"
                    >
                      إلغاء التعديل
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingEntry}
                    className="px-4 py-1.5 bg-[#7a1c24] text-white rounded-xl cursor-pointer"
                  >
                    {savingEntry ? 'جاري الحفظ...' : (entryForm.id ? 'حفظ تعديل العنصر' : '+ إضافة عنصر')}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {builderEntries.length === 0 ? (
                <div className="text-center py-6 text-gray-400 border rounded-2xl">
                  لا توجد عناصر مضافة داخل هذا الكارت حتى الآن.
                </div>
              ) : (
                builderEntries.map(en => {
                  const parsed = parseEntryPayload(en);
                  return (
                    <div key={en.id} className="p-3 bg-[#fbfaf7] border rounded-2xl flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-gray-900">{en.title}</strong>
                          {en.entry_date && <span className="text-[11px] text-gray-500">({en.entry_date})</span>}
                          {parsed.field_label && parsed.field_value && (
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded-lg text-[10px]">
                              {parsed.field_label}: {parsed.field_value}
                            </span>
                          )}
                        </div>
                        {parsed.text && <p className="text-gray-700 whitespace-pre-line font-normal">{parsed.text}</p>}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setEntryForm({
                              id: en.id,
                              title: en.title || '',
                              entry_date: en.entry_date || '',
                              details: parsed.text || '',
                              field_label: parsed.field_label || '',
                              field_value: parsed.field_value || ''
                            })}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-800 cursor-pointer"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDynamicEntry(en.id)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-red-700 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveBuilderCard(null)}
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
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────
// شكل كراسي الكنيسة (صفوف × كراسي يمين × كراسي شمال)
// محفوظ في service_settings بالمفتاح church_seat_layout
// ومستخدم في: إرسال الدعوات، تعديل الدعوة، ومسح الـ QR
// ─────────────────────────────────────────────────────────────

export const LAYOUT_KEY = 'church_seat_layout';
export const DEFAULT_LAYOUT = { rows: 2, seatsRight: 5, seatsLeft: 5 };

const clampInt = (v, min, max, fallback) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

export const normalizeLayout = (raw) => {
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = null;
    }
  }
  if (!obj || typeof obj !== 'object') return { ...DEFAULT_LAYOUT };
  return {
    rows: clampInt(obj.rows, 1, 30, DEFAULT_LAYOUT.rows),
    seatsRight: clampInt(obj.seatsRight, 0, 20, DEFAULT_LAYOUT.seatsRight),
    seatsLeft: clampInt(obj.seatsLeft, 0, 20, DEFAULT_LAYOUT.seatsLeft)
  };
};

// يستخرج رقم الكرسي من النص المحفوظ (يرجع null لو النص مكتوب يدوياً)
export const parseSeatNumber = (label = '') => {
  const m = String(label || '').match(/كرسي\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
};

export const seatLabel = (seat) => `كرسي ${seat.number} • ${seat.side} • صف ${seat.row}`;

// [{ row, right: [seat], left: [seat] }]
export const buildSeats = (layout) => {
  const seats = [];
  let n = 1;
  for (let row = 1; row <= layout.rows; row += 1) {
    const right = [];
    const left = [];
    for (let i = 0; i < layout.seatsRight; i += 1) {
      right.push({ number: n, row, side: 'يمين' });
      n += 1;
    }
    for (let i = 0; i < layout.seatsLeft; i += 1) {
      left.push({ number: n, row, side: 'شمال' });
      n += 1;
    }
    seats.push({ row, right, left });
  }
  return seats;
};

// صفوف مسطّحة (يمين ثم شمال) بصيغة جاهزة للعرض في الشبكات
export const buildFlatRows = (layout) =>
  buildSeats(layout).map((r) => ({
    rowIndex: r.row - 1,
    rowLabel: `صف ${r.row}`,
    seats: [...r.right, ...r.left].map((s) => ({
      rowIndex: r.row - 1,
      rowLabel: `صف ${r.row}`,
      seatNumber: s.number,
      side: s.side,
      label: seatLabel(s)
    }))
  }));

export async function loadSeatLayout() {
  if (!supabase || typeof supabase.from !== 'function') return { ...DEFAULT_LAYOUT };
  try {
    const { data, error } = await supabase
      .from('service_settings')
      .select('value')
      .eq('key', LAYOUT_KEY)
      .maybeSingle();
    if (!error && data?.value) return normalizeLayout(data.value);
  } catch {
    // نستخدم الشكل الافتراضي
  }
  return { ...DEFAULT_LAYOUT };
}

export async function saveSeatLayout(layout) {
  const next = normalizeLayout(layout);
  const payload = JSON.stringify(next);
  const { data: existing } = await supabase
    .from('service_settings')
    .select('key')
    .eq('key', LAYOUT_KEY)
    .maybeSingle();
  const res = existing
    ? await supabase.from('service_settings').update({ value: payload }).eq('key', LAYOUT_KEY)
    : await supabase.from('service_settings').insert([{ key: LAYOUT_KEY, value: payload }]);
  return { layout: next, error: res.error || null };
}

export function useSeatLayout() {
  const [layout, setLayout] = useState({ ...DEFAULT_LAYOUT });

  useEffect(() => {
    let cancelled = false;
    loadSeatLayout().then((l) => {
      if (!cancelled) setLayout(l);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (draft) => {
    const { layout: next, error } = await saveSeatLayout(draft);
    if (!error) setLayout(next);
    return { layout: next, error };
  }, []);

  return [layout, save];
}

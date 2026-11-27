import { supabase } from './lib/supabase';

const normalizePhone = (phone = '') => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('20') && digits.length === 12) return digits.slice(2);
  if (digits.startsWith('0020') && digits.length === 14) return digits.slice(4);
  return digits;
};

const normalizeName = (name = '') =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');

/**
 * اشتراك مستقل لنوتيفيكيشن الدعوات الواردة لأي مستخدم (عضو / ولي أمر / خادم)
 */
export function subscribeInvitationNotifications(user, onAlert) {
  if (!user?.id || !supabase || typeof supabase.channel !== 'function') {
    return () => {};
  }

  const userPhones = [user.phone, user.father_phone, user.mother_phone]
    .map(normalizePhone)
    .filter(Boolean);
  const normFullName = normalizeName(user.full_name || user.name || '');

  const channel = supabase
    .channel(`standalone-invites-notif-${user.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'church_invitations'
      },
      (payload) => {
        const row = payload.new || payload.old;
        if (!row) return;

        const rowRecipientId = String(row.recipient_user_id || '').trim();
        const matchesRecipient = rowRecipientId
          ? rowRecipientId === String(user.id)
          : (normalizePhone(row.recipient_phone) &&
              userPhones.includes(normalizePhone(row.recipient_phone))) ||
            (normFullName && normalizeName(row.recipient_name) === normFullName);

        if (!matchesRecipient) return;

        if (payload.eventType === 'INSERT' && payload.new) {
          const tier = payload.new.invite_tier === 'vip' ? 'VIP' : 'عامة';
          onAlert?.({
            id: payload.new.id,
            category: 'invitation',
            title: `دعوة ${tier}: ${payload.new.event_title}`,
            message: `${payload.new.seat_or_zone ? `المكان/المقعد: ${payload.new.seat_or_zone} • ` : ''}كود الدعوة: ${payload.new.qr_token || '—'}`,
            raw: payload.new
          });
        } else if (payload.eventType === 'UPDATE' && payload.new?.status === 'checked_in') {
          onAlert?.({
            id: `${payload.new.id}-checkin`,
            category: 'invitation_checkin',
            title: 'تم تسجيل الدخول بالـ QR',
            message: `تم مسح كود الدعوة (${payload.new.event_title}) وتسجيل حضورك.`,
            raw: payload.new
          });
        }
      }
    )
    .subscribe();

  return () => {
    if (typeof supabase.removeChannel === 'function') {
      supabase.removeChannel(channel);
    }
  };
}

/**
 * اشتراك مستقل لنوتيفيكيشن حالات الوفاة والترحيم (يوسف الرامي)
 */
export function subscribeJosephNotifications(onAlert) {
  if (!supabase || typeof supabase.channel !== 'function') {
    return () => {};
  }

  const channel = supabase
    .channel('standalone-joseph-notif')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'joseph_arimathea_cases'
      },
      (payload) => {
        const row = payload.new;
        if (!row) return;
        onAlert?.({
          id: row.id,
          category: 'joseph_case',
          title: row.is_night_death ? '🌙 حالة وفاة ليلية جديدة' : '🕊️ بيان حالة وفاة وانتقال جديد',
          message: `المنتقل: ${row.deceased_name} • المُبلّغ: ${row.reported_by_name || 'مستخدم'}`,
          raw: row
        });
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'joseph_memorial_requests'
      },
      (payload) => {
        const row = payload.new;
        if (!row) return;
        onAlert?.({
          id: row.id,
          category: 'joseph_memorial',
          title: '🕯️ طلب ترحيم جديد بالقداس الإلهي',
          message: `المنتقل: ${row.deceased_name} (${row.memorial_type || 'ترحيم'}) • التاريخ: ${row.mass_date || '—'}`,
          raw: row
        });
      }
    )
    .subscribe();

  return () => {
    if (typeof supabase.removeChannel === 'function') {
      supabase.removeChannel(channel);
    }
  };
}

/**
 * تعليم إشعار في جدول church_notifications كـ "مقروء" بشكل مستقل
 */
export async function markChurchNotificationRead(notificationId) {
  if (!notificationId || !supabase?.from) return { error: null };
  return supabase
    .from('church_notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
}
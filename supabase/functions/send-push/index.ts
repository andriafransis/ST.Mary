// Supabase Edge Function: بتبعت إشعار للموبايل أول ما يتضاف صف في church_notifications
// الإعداد: راجع PUSH_SETUP.md
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

const PRIEST_ADMIN_TYPES = ['hidden_family_edit_request', 'priest_invitation'];

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const n = payload?.record;
    if (!n) return new Response('no record', { status: 200 });

    // تحديد المستلمين (نفس منطق isNotificationForUser في التطبيق)
    let userIds: string[] = [];
    if (n.user_id) {
      userIds = [String(n.user_id)];
    } else {
      let q = supabase.from('church_users').select('id, role').neq('status', 'rejected').neq('status', 'pending');
      if (n.target_role && n.target_role !== 'all') q = q.eq('role', n.target_role);
      const { data } = await q;
      userIds = (data || []).map((u: any) => String(u.id));
    }
    if (PRIEST_ADMIN_TYPES.includes(n.type)) {
      const { data } = await supabase.from('church_users').select('id').in('role', ['admin', 'priest']);
      userIds = [...new Set([...userIds, ...(data || []).map((u: any) => String(u.id))])];
    }
    if (userIds.length === 0) return new Response('no recipients', { status: 200 });

    const { data: subs } = await supabase.from('push_subscriptions').select('*').in('user_id', userIds);

    // ما نبعتش محتوى حساس (زي كلمة المرور) — الرسالة الجاهزة بس لو نص عادي
    let body = '';
    if (n.type !== 'account_approved' && typeof n.message === 'string' && !n.message.trim().startsWith('{')) {
      body = n.message.slice(0, 140);
    }
    const msg = JSON.stringify({
      title: n.title || 'إشعار جديد',
      body,
      tag: `n-${n.id}`,
      url: '/ST.Mary/'
    });

    let sent = 0;
    await Promise.all((subs || []).map(async (s: any) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, msg);
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', s.id);
        }
      }
    }));
    return new Response(JSON.stringify({ sent }), { status: 200 });
  } catch (e) {
    return new Response(String(e), { status: 200 });
  }
});

# تشغيل إشعارات الموبايل الخارجية (مرة واحدة)

التطبيق بيستقبل الإشعار حتى لو مقفول. محتاج 4 خطوات على Supabase:

1. **SQL:** شغّل `push_setup.sql` في SQL Editor.
2. **مفاتيح VAPID:** على جهازك شغّل `npx web-push generate-vapid-keys` (هيطلع Public وPrivate).
3. **الـ Function:**
   ```
   supabase functions deploy send-push --no-verify-jwt
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
   ```
4. **Webhook:** Supabase Dashboard → Database → Webhooks → Create: جدول `church_notifications`، حدث `Insert`، النوع `Supabase Edge Functions` واختار `send-push`.

وفي ملف `.env` بتاع المشروع ضيف: `VITE_VAPID_PUBLIC_KEY=` (نفس الـ Public) وبعدها `npm run build`.

ملاحظات: على الآيفون لازم التطبيق يتضاف للشاشة الرئيسية (iOS 16.4+). المستخدم لازم يضغط «سماح» للإشعارات مرة واحدة.

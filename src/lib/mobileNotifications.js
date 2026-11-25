// src/lib/mobileNotifications.js

/**
 * تحديث الرقم الفعلي للإشعارات على أيقونة التطبيق من الخارج (Android PWA / Desktop)
 */
export async function updateAppIconBadge(count, baseTitle = 'كنيسة السيدة العذراء مريم') {
  const safeCount = Math.max(0, Number(count) || 0);

  // 1) تحديث عنوان التبويب كبديل في المتصفحات
  if (typeof document !== 'undefined') {
    document.title = safeCount > 0 ? `(${safeCount}) ${baseTitle}` : baseTitle;
  }

  // 2) تحديث شارة الرقم على أيقونة التطبيق (PWA Badging API)
  try {
    if (typeof navigator !== 'undefined') {
      if (safeCount > 0 && typeof navigator.setAppBadge === 'function') {
        await navigator.setAppBadge(safeCount);
      } else if (safeCount === 0 && typeof navigator.clearAppBadge === 'function') {
        await navigator.clearAppBadge();
      }
    }
  } catch {
    // المتصفح أو النظام لا يدعم App Badging API
  }

  // 3) مزامنة الرقم مع الـ Service Worker إن وجد
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.setAppBadge === 'function') {
        if (safeCount > 0) await reg.setAppBadge(safeCount);
        else if (typeof reg.clearAppBadge === 'function') await reg.clearAppBadge();
      }
    }
  } catch {
    // ignore
  }

  return safeCount;
}

/**
 * طلب إذن الإشعارات من المستخدم (يجب استدعاؤه بضغطة زر على الأندرويد)
 */
export async function requestMobileNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return Notification.permission || 'denied';
  }
}

/**
 * إرسال إشعار خارجي يظهر في شريط إشعارات الأندرويد + تحديث الرقم على الأيقونة
 */
export async function showMobileNotification({
  title,
  body = '',
  badgeCount = null,
  tag = 'church-alert',
  icon = '/pwa-192x192.png',
  url = '/'
}) {
  if (badgeCount !== null) {
    await updateAppIconBadge(badgeCount);
  }

  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const options = {
    body,
    icon,
    badge: icon,
    tag,
    renotify: true,
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    data: { url }
  };

  // أندرويد Chrome يتطلب إظهار الإشعار عبر ServiceWorkerRegistration
  try {
    if ('serviceWorker' in navigator) {
      const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.ready);
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return true;
      }
    }
  } catch {
    // fallback below
  }

  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
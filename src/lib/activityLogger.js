import { supabase } from './supabase';

const SESSION_KEY = 'church_active_session_id';
const SESSION_START_KEY = 'church_active_session_start';

export function detectDeviceInfo() {
  if (typeof navigator === 'undefined') {
    return { deviceType: 'كمبيوتر', osBrowser: 'Unknown', userAgent: '' };
  }
  const ua = navigator.userAgent || '';
  const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const isMobile = !isTablet && /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const deviceType = isTablet ? 'تابلت' : isMobile ? 'موبايل' : 'كمبيوتر';

  let os = 'نظام غير معروف';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Mac OS/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';

  return { deviceType, osBrowser: `${os} / ${browser}`, userAgent: ua };
}

export function formatDuration(seconds = 0) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) return `${hrs} س ${mins} د ${secs} ث`;
  if (mins > 0) return `${mins} د ${secs} ث`;
  return `${secs} ثانية`;
}

export async function logActivity({
  user,
  actionType,
  targetTable = '',
  targetId = '',
  description,
  metadata = {}
}) {
  if (!user?.id) return;
  try {
    const { deviceType } = detectDeviceInfo();
    const sessionId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null;

    await supabase.from('activity_logs').insert([{
      session_id: sessionId || null,
      user_id: user.id,
      user_name: user.full_name || user.username || 'مستخدم',
      user_role: user.role || 'unknown',
      device_type: deviceType,
      action_type: actionType,
      target_table: targetTable,
      target_id: targetId ? String(targetId) : null,
      description,
      metadata
    }]);
  } catch (err) {
    console.warn('Activity log error:', err);
  }
}

export async function endUserSession() {
  if (typeof window === 'undefined') return;
  const sid = sessionStorage.getItem(SESSION_KEY);
  const startTimeMs = Number(sessionStorage.getItem(SESSION_START_KEY) || Date.now());
  if (!sid) return;
  const nowISO = new Date().toISOString();
  const duration = Math.max(1, Math.round((Date.now() - startTimeMs) / 1000));
  try {
    await supabase.from('user_sessions').update({
      last_active_at: nowISO,
      closed_at: nowISO,
      duration_seconds: duration
    }).eq('id', sid);
  } catch {
    // ignore
  } finally {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_START_KEY);
  }
}

export function startUserSession(user) {
  if (!user?.id || typeof window === 'undefined') return () => {};

  let cancelled = false;
  let heartbeatTimer = null;
  let currentSessionId = sessionStorage.getItem(SESSION_KEY);
  let startTimeMs = Number(sessionStorage.getItem(SESSION_START_KEY) || Date.now());
  const { deviceType, osBrowser, userAgent } = detectDeviceInfo();

  const calcSeconds = () => Math.max(1, Math.round((Date.now() - startTimeMs) / 1000));

  const initSession = async () => {
    try {
      if (!currentSessionId) {
        startTimeMs = Date.now();
        sessionStorage.setItem(SESSION_START_KEY, String(startTimeMs));

        const { data, error } = await supabase
          .from('user_sessions')
          .insert([{
            user_id: user.id,
            user_name: user.full_name || user.username || 'مستخدم',
            user_role: user.role || '',
            device_type: deviceType,
            os_browser: osBrowser,
            user_agent: userAgent,
            opened_at: new Date(startTimeMs).toISOString(),
            last_active_at: new Date().toISOString(),
            duration_seconds: 0
          }])
          .select('id')
          .single();

        if (!error && data && !cancelled) {
          currentSessionId = data.id;
          sessionStorage.setItem(SESSION_KEY, data.id);
          await logActivity({
            user,
            actionType: 'دخول_الموقع',
            targetTable: 'user_sessions',
            targetId: data.id,
            description: `قام ${user.full_name} بفتح الموقع من (${deviceType} - ${osBrowser})`
          });
        }
      }
    } catch (e) {
      console.warn('Session init error:', e);
    }
  };

  const updateHeartbeat = async (isClosing = false) => {
    const sid = currentSessionId || sessionStorage.getItem(SESSION_KEY);
    if (!sid) return;
    const nowISO = new Date().toISOString();
    const duration = calcSeconds();
    const payload = {
      last_active_at: nowISO,
      duration_seconds: duration,
      ...(isClosing ? { closed_at: nowISO } : {})
    };

    try {
      if (isClosing && supabase.supabaseUrl && supabase.supabaseKey) {
        fetch(`${supabase.supabaseUrl}/rest/v1/user_sessions?id=eq.${sid}`, {
          method: 'PATCH',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            apikey: supabase.supabaseKey,
            Authorization: `Bearer ${supabase.supabaseKey}`,
            Prefer: 'return=minimal'
          },
          body: JSON.stringify(payload)
        }).catch(() => {});
      } else {
        await supabase.from('user_sessions').update(payload).eq('id', sid);
      }
    } catch {
      // ignore
    }
  };

  initSession();
  heartbeatTimer = setInterval(() => updateHeartbeat(false), 30000);

  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') updateHeartbeat(true);
    else updateHeartbeat(false);
  };

  const handleUnload = () => {
    updateHeartbeat(true);
  };

  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('pagehide', handleUnload);
  window.addEventListener('beforeunload', handleUnload);

  return () => {
    cancelled = true;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('pagehide', handleUnload);
    window.removeEventListener('beforeunload', handleUnload);
    updateHeartbeat(true);
  };
}
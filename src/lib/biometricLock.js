// قفل البصمة المحلي (WebAuthn) - البصمة بتفضل على الموبايل ومبتتبعتش لأي سيرفر
const CRED_KEY = 'church_biometric_cred_id';
const ENABLED_KEY = 'church_biometric_enabled';
const OWNER_KEY = 'church_biometric_user_id';

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (str) => Uint8Array.from(atob(str), c => c.charCodeAt(0)).buffer;

export async function isBiometricSupported() {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
    if (!window.isSecureContext) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isBiometricEnabledFor(userId) {
  return (
    localStorage.getItem(ENABLED_KEY) === '1' &&
    !!localStorage.getItem(CRED_KEY) &&
    localStorage.getItem(OWNER_KEY) === String(userId)
  );
}

// يرجّع id المستخدم اللي مفعّل البصمة على الجهاز ده (أو null)
export function getBiometricOwnerId() {
  if (localStorage.getItem(ENABLED_KEY) !== '1' || !localStorage.getItem(CRED_KEY)) return null;
  return localStorage.getItem(OWNER_KEY) || null;
}

export function disableBiometric() {
  localStorage.removeItem(ENABLED_KEY);
  localStorage.removeItem(CRED_KEY);
  localStorage.removeItem(OWNER_KEY);
}

// تفعيل: بتسجل بصمة الجهاز مرة واحدة
export async function enableBiometric(user) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Church App' },
      user: {
        id: new TextEncoder().encode(String(user.id)),
        name: user.username || String(user.id),
        displayName: user.full_name || user.username || 'user'
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 }
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged'
      },
      timeout: 60000
    }
  });
  if (!cred) throw new Error('cancelled');
  localStorage.setItem(CRED_KEY, toB64(cred.rawId));
  localStorage.setItem(OWNER_KEY, String(user.id));
  localStorage.setItem(ENABLED_KEY, '1');
  return true;
}

// فتح القفل: بيطلب البصمة
export async function verifyBiometric() {
  const credId = localStorage.getItem(CRED_KEY);
  if (!credId) throw new Error('no-credential');
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: fromB64(credId), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000
    }
  });
  return !!assertion;
}

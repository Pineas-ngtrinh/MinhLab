const STORAGE_KEY = 'minhlab_pending_checkout';

/** Retain only a fingerprint and random key, so a network retry survives reload. */
export async function checkoutRequestKey(payload: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object' && 'fingerprint' in saved && saved.fingerprint === fingerprint
      && 'key' in saved && typeof saved.key === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(saved.key)) return saved.key;
  } catch { /* Storage can be unavailable in private browsing. */ }
  const key = crypto.randomUUID();
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ fingerprint, key })); } catch { /* In-memory retries still work. */ }
  return key;
}

export function completeCheckoutRequest(key: string): void {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object' && 'key' in saved && saved.key === key) sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* Storage is optional. */ }
}

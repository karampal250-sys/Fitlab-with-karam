// Encrypted offline-first storage using Web Crypto AES-GCM for FitPlate health data

const KEY_STORAGE = 'fitplate_device_secret_v1';
const STATE_STORAGE = 'fitplate_encrypted_state_v1';
const PLAIN_FALLBACK_KEY = 'fitplate_local_state_v1';

async function getOrCreateAesKey(): Promise<CryptoKey | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;
  try {
    let rawHex = localStorage.getItem(KEY_STORAGE);
    if (!rawHex) {
      const bytes = window.crypto.getRandomValues(new Uint8Array(32));
      rawHex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      localStorage.setItem(KEY_STORAGE, rawHex);
    }
    const keyBytes = new Uint8Array(rawHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
    return await window.crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  } catch {
    return null;
  }
}

export async function saveEncryptedState<T>(data: T): Promise<void> {
  const json = JSON.stringify(data);
  const key = await getOrCreateAesKey();
  if (!key) {
    localStorage.setItem(PLAIN_FALLBACK_KEY, json);
    return;
  }
  try {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(json);
    const cipherBuf = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const payload = {
      v: 1,
      iv: Array.from(iv),
      ct: Array.from(new Uint8Array(cipherBuf)),
    };
    localStorage.setItem(STATE_STORAGE, JSON.stringify(payload));
  } catch {
    localStorage.setItem(PLAIN_FALLBACK_KEY, json);
  }
}

export async function loadEncryptedState<T>(): Promise<T | null> {
  try {
    const encRaw = localStorage.getItem(STATE_STORAGE);
    const key = await getOrCreateAesKey();
    if (encRaw && key) {
      const parsed = JSON.parse(encRaw) as { iv: number[]; ct: number[] };
      const iv = new Uint8Array(parsed.iv);
      const ct = new Uint8Array(parsed.ct);
      const plainBuf = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      const plainStr = new TextDecoder().decode(plainBuf);
      return JSON.parse(plainStr) as T;
    }
    const plain = localStorage.getItem(PLAIN_FALLBACK_KEY);
    return plain ? (JSON.parse(plain) as T) : null;
  } catch {
    const plain = localStorage.getItem(PLAIN_FALLBACK_KEY);
    if (!plain) return null;
    try {
      return JSON.parse(plain) as T;
    } catch {
      return null;
    }
  }
}

export function wipeAllLocalHealthData(): void {
  localStorage.removeItem(STATE_STORAGE);
  localStorage.removeItem(PLAIN_FALLBACK_KEY);
  localStorage.removeItem(KEY_STORAGE);
}

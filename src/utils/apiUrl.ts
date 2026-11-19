const FALLBACK_CLOUD_API_ORIGIN = 'https://ais-pre-pu4l2xb37nxpbnxydahsda-617993063901.asia-northeast1.run.app';

export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
  if (base) return `${base}${path}`;

  if (typeof window !== 'undefined') {
    const isCapacitorNative =
      Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) ||
      window.location.protocol === 'capacitor:' ||
      (window.location.hostname === 'localhost' && !window.location.port);
    if (isCapacitorNative) {
      return `${FALLBACK_CLOUD_API_ORIGIN}${path}`;
    }
  }
  return path;
}

export async function safeFetchJson<T>(
  input: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; errorText?: string }> {
  const res = await fetch(input, init);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    let textSnippet = '';
    try {
      textSnippet = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
    } catch {
      // ignore
    }
    return { ok: false, status: res.status, data: null, errorText: textSnippet || `HTTP ${res.status}` };
  }
  try {
    const data = (await res.json()) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: res.status, data: null, errorText: `Invalid JSON (HTTP ${res.status})` };
  }
}

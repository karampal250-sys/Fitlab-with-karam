const DEFAULT_API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function isCapacitorNativeRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && !window.location.port)
  );
}

export function apiUrl(path: string): string {
  if (DEFAULT_API_ORIGIN) return `${DEFAULT_API_ORIGIN}${path}`;
  return path;
}

export async function safeFetchJson<T>(
  input: string,
  init?: RequestInit
): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
  errorText?: string;
  failureReason?: 'auth_redirect' | 'not_deployed_or_native' | 'server_html' | 'invalid_json';
}> {
  const res = await fetch(input, { credentials: 'same-origin', ...init });
  const contentType = res.headers.get('content-type') || '';

  if (res.redirected && res.url.includes('__cookie_check')) {
    return {
      ok: false,
      status: 401,
      data: null,
      failureReason: 'auth_redirect',
      errorText: 'Session cookie required (open in AI Studio Preview or deployed URL).',
    };
  }

  if (!contentType.includes('application/json')) {
    let rawText = '';
    try {
      rawText = await res.text();
    } catch {
      // ignore
    }
    const lower = rawText.toLowerCase();
    if (lower.includes('__cookie_check') || lower.includes('accounts.google.com')) {
      return {
        ok: false,
        status: 401,
        data: null,
        failureReason: 'auth_redirect',
        errorText: 'AI Studio authentication required for /api.',
      };
    }
    if (isCapacitorNativeRuntime() || res.status === 404 || lower.includes('<div id="root">')) {
      return {
        ok: false,
        status: res.status || 404,
        data: null,
        failureReason: 'not_deployed_or_native',
        errorText: isCapacitorNativeRuntime()
          ? 'APK build needs VITE_API_BASE_URL pointing to your deployed Cloud Run server.'
          : `API endpoint not found (HTTP ${res.status}).`,
      };
    }
    const snippet = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
    return {
      ok: false,
      status: res.status,
      data: null,
      failureReason: 'server_html',
      errorText: snippet || `HTTP ${res.status}`,
    };
  }

  try {
    const data = (await res.json()) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return {
      ok: false,
      status: res.status,
      data: null,
      failureReason: 'invalid_json',
      errorText: `Invalid JSON (HTTP ${res.status})`,
    };
  }
}

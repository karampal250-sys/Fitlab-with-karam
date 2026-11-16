export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}

export async function safeFetchJson<T>(
  input: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(input, init);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { ok: false, status: res.status, data: null };
  }
  try {
    const data = (await res.json()) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: res.status, data: null };
  }
}

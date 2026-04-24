export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

function authHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('alucurv_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleAuthError(res: Response) {
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('alucurv_token');
    localStorage.removeItem('alucurv_user');
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }
}

export const fetcher = async (path: string) => {
  const r = await fetch(`${API_BASE}${path}`, { headers: { ...authHeaders() } });
  if (!r.ok) {
    handleAuthError(r);
    throw new Error(await r.text());
  }
  return r.json();
};

export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    handleAuthError(res);
    throw new Error(await res.text());
  }
  return res.json();
}

export async function patchJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    handleAuthError(res);
    throw new Error(await res.text());
  }
  return res.json();
}

export async function deleteRequest(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    handleAuthError(res);
    throw new Error(await res.text());
  }
}

export const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

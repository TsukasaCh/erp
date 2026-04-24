'use client';
import { API_BASE } from './api';

const TOKEN_KEY = 'alucurv_token';
const USER_KEY = 'alucurv_user';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string | null;
  isSuperAdmin: boolean;
  role: { id: string; name: string; permissions: string[] } | null;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthUser; } catch { return null; }
}

export function setAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function hasPermission(perm: string): boolean {
  const u = getUser();
  if (!u) return false;
  if (u.isSuperAdmin) return true;
  return u.role?.permissions.includes(perm) ?? false;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'login_failed' }));
    throw new Error(err.error ?? 'login_failed');
  }
  const { token, user } = await res.json();
  setAuth(token, user);
  return user;
}

export async function refreshMe(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 401) clearAuth();
    return null;
  }
  const user = (await res.json()) as AuthUser;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

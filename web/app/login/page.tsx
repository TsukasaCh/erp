'use client';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { login, getToken } from '@/lib/auth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) {
      window.location.href = '/';
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      // Full page reload so that AuthGuard, Sidebar, etc. mount fresh
      // with the new token — avoids client-side hydration/state mismatch.
      window.location.href = '/';
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg === 'invalid_credentials' ? 'Username atau password salah.' : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="flex flex-col items-center mb-6">
          <Image src="/logo.svg" alt="Alucurv" width={64} height={64} priority />
          <div className="mt-3 text-xl font-bold tracking-tight">Alucurv ERP</div>
          <div className="text-xs text-slate-500">Masuk ke akun Anda</div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="block text-xs uppercase tracking-wide text-slate-600 mb-1">Username</span>
            <input
              type="text"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </label>

          <label className="block">
            <span className="block text-xs uppercase tracking-wide text-slate-600 mb-1">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </label>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white rounded py-2 text-sm font-semibold hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? 'Masuk…' : 'Masuk'}
          </button>
        </form>

        <div className="mt-6 text-[11px] text-center text-slate-400 italic">
          Kreasi alumunium, inovasi tanpa batas
        </div>
      </div>
    </div>
  );
}

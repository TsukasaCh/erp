'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getToken, refreshMe } from '@/lib/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (pathname === '/login') {
      setChecking(false);
      return;
    }
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    // validate token server-side; will clearAuth + redirect if expired
    refreshMe().then((user) => {
      if (!user) {
        router.replace('/login');
      } else {
        setChecking(false);
      }
    });
  }, [pathname, router]);

  if (pathname === '/login') return <>{children}</>;
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        Memuat…
      </div>
    );
  }
  return <>{children}</>;
}

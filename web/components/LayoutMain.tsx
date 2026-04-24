'use client';
import { usePathname } from 'next/navigation';

export function LayoutMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login';
  if (isLogin) {
    return <main className="min-h-screen">{children}</main>;
  }
  return <main className="ml-60 min-h-screen px-8 py-8">{children}</main>;
}

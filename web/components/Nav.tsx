'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearAuth, getUser, hasPermission, type AuthUser } from '@/lib/auth';

interface NavLink {
  href: string;
  label: string;
  icon: (p: { className?: string }) => React.ReactElement;
  permission?: string;
  superAdminOnly?: boolean;
}

const ALL_LINKS: NavLink[] = [
  { href: '/', label: 'Dashboard', icon: IconDashboard, permission: 'dashboard:view' },
  { href: '/orders', label: 'Orders', icon: IconOrders, permission: 'orders:view' },
  { href: '/products', label: 'Inventory', icon: IconProducts, permission: 'products:view' },
  { href: '/users', label: 'Users & Roles', icon: IconUsers, permission: 'users:manage' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, [pathname]);

  if (pathname === '/login') return null;

  const visibleLinks = ALL_LINKS.filter((l) => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    if (l.superAdminOnly) return false;
    if (!l.permission) return true;
    return hasPermission(l.permission);
  });

  const roleLabel = user?.isSuperAdmin ? 'Super Admin' : user?.role?.name ?? 'No role';
  const displayName = user?.fullName || user?.username || '—';
  const initial = (user?.fullName || user?.username || '?').slice(0, 1).toUpperCase();

  const logout = () => {
    clearAuth();
    router.replace('/login');
  };

  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-200 flex items-center gap-3">
        <Image src="/logo.svg" alt="Alucurv" width={40} height={40} priority />
        <div>
          <div className="font-bold text-lg leading-tight tracking-tight">Alucurv</div>
          <div className="text-[11px] text-slate-500 leading-tight">ERP Manual Input</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleLinks.map((l) => {
          const active = pathname === l.href;
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{l.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-slate-200 space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className="w-8 h-8 rounded-full bg-teal-600 text-white text-sm font-semibold flex items-center justify-center shrink-0">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-800 truncate">{displayName}</div>
            <div className="text-[11px] text-slate-500 truncate">{roleLabel}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded py-1.5 transition-colors"
        >
          <IconLogout className="w-3.5 h-3.5" />
          Logout
        </button>
        <div className="text-[10px] text-center text-slate-300 italic pt-1">
          Kreasi alumunium, inovasi tanpa batas
        </div>
      </div>
    </aside>
  );
}

function IconDashboard({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}

function IconOrders({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function IconProducts({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
      <path d="M16 3H8v4h8Z" />
      <line x1="2" y1="13" x2="22" y2="13" />
    </svg>
  );
}

function IconUsers({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconLogout({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { clearAuth, getUser, hasPermission, type AuthUser } from '@/lib/auth';

type IconFn = (p: { className?: string }) => React.ReactElement;

interface LeafLink {
  kind: 'link';
  href: string;
  label: string;
  icon?: IconFn;
  permission?: string;
  superAdminOnly?: boolean;
}

interface GroupLink {
  kind: 'group';
  id: string;
  label: string;
  icon: IconFn;
  children: LeafLink[];
  // any permission among children's permissions grants visibility
}

type NavItem = LeafLink | GroupLink;

const NAV: NavItem[] = [
  { kind: 'link', href: '/', label: 'Dashboard', icon: IconDashboard, permission: 'dashboard:view' },
  {
    kind: 'group',
    id: 'orders',
    label: 'Orders',
    icon: IconOrders,
    children: [
      { kind: 'link', href: '/orders', label: 'Penjualan', permission: 'orders:view' },
      { kind: 'link', href: '/purchase-orders', label: 'Pembelian PO', permission: 'purchases:view' },
    ],
  },
  { kind: 'link', href: '/production', label: 'Kalender Produksi', icon: IconCalendar, permission: 'production:view' },
  { kind: 'link', href: '/hpp', label: 'Kalkulator HPP', icon: IconCalc, permission: 'hpp:view' },
  {
    kind: 'group',
    id: 'bahan',
    label: 'Bahan Baku',
    icon: IconBox,
    children: [
      { kind: 'link', href: '/materials', label: 'Master Data Bahan', permission: 'materials:view' },
      { kind: 'link', href: '/suppliers', label: 'Supplier', permission: 'suppliers:view' },
    ],
  },
  {
    kind: 'group',
    id: 'inventory',
    label: 'Inventory',
    icon: IconProducts,
    children: [
      { kind: 'link', href: '/products', label: 'Inventory Product', permission: 'products:view' },
      { kind: 'link', href: '/material-usage', label: 'Inventory Bahan', permission: 'materials:view' },
      { kind: 'link', href: '/categories', label: 'Kategori', permission: 'materials:view' },
    ],
  },
  {
    kind: 'group',
    id: 'hrd',
    label: 'HRD & Payroll',
    icon: IconHRD,
    children: [
      { kind: 'link', href: '/hrd/karyawan', label: 'Data Karyawan', permission: 'hrd:view' },
      { kind: 'link', href: '/hrd/absensi', label: 'Absensi & Lembur', permission: 'hrd:view' },
      { kind: 'link', href: '/hrd/penggajian', label: 'Penggajian', permission: 'hrd:view' },
    ],
  },
  { kind: 'link', href: '/audit-logs', label: 'Audit Log', icon: IconDot, superAdminOnly: true },
  { kind: 'link', href: '/users', label: 'Users & Roles', icon: IconUsers, permission: 'users:manage' },
];

function visibleFor(user: AuthUser | null, perm?: string, superAdminOnly?: boolean): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  if (superAdminOnly) return false;
  if (!perm) return true;
  return hasPermission(perm);
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setUser(getUser());
  }, [pathname]);

  // Auto-open a group whose child matches the current route
  useEffect(() => {
    const next: Record<string, boolean> = { ...openGroups };
    let changed = false;
    for (const item of NAV) {
      if (item.kind === 'group') {
        const active = item.children.some((c) => pathname === c.href);
        if (active && !next[item.id]) { next[item.id] = true; changed = true; }
      }
    }
    if (changed) setOpenGroups(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (pathname === '/login') return null;

  const items = useMemo(() => {
    return NAV.map((item) => {
      if (item.kind === 'link') {
        return visibleFor(user, item.permission, item.superAdminOnly) ? item : null;
      }
      const visibleChildren = item.children.filter((c) =>
        visibleFor(user, c.permission, c.superAdminOnly),
      );
      if (visibleChildren.length === 0) return null;
      return { ...item, children: visibleChildren };
    }).filter(Boolean) as NavItem[];
  }, [user]);

  const roleLabel = user?.isSuperAdmin ? 'Super Admin' : user?.role?.name ?? 'No role';
  const displayName = user?.fullName || user?.username || '—';
  const initial = (user?.fullName || user?.username || '?').slice(0, 1).toUpperCase();

  const logout = () => {
    clearAuth();
    window.location.href = '/login';
  };

  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-200 flex items-center gap-3">
        <Image src="/logo.svg" alt="Alucurv" width={40} height={40} priority />
        <div>
          <div className="font-bold text-lg leading-tight tracking-tight">Alucurv</div>
          <div className="text-[11px] text-slate-500 leading-tight">ERP Order Management</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          if (item.kind === 'link') {
            const active = pathname === item.href;
            const Icon = item.icon ?? IconDot;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          }

          const Icon = item.icon;
          const childActive = item.children.some((c) => pathname === c.href);
          const isOpen = openGroups[item.id] ?? childActive;

          return (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => setOpenGroups({ ...openGroups, [item.id]: !isOpen })}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  childActive
                    ? 'text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                <IconChevron
                  className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="mt-1 ml-3 pl-3 border-l border-slate-200 space-y-1">
                  {item.children.map((c) => {
                    const active = pathname === c.href;
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                          active
                            ? 'bg-slate-900 text-white font-medium'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="w-1 h-1 rounded-full bg-current opacity-60 shrink-0" />
                        <span>{c.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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

function IconCalendar({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconCalc({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8" y2="10" />
      <line x1="12" y1="10" x2="12" y2="10" />
      <line x1="16" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="8" y2="14" />
      <line x1="12" y1="14" x2="12" y2="14" />
      <line x1="16" y1="14" x2="16" y2="14" />
      <line x1="8" y1="18" x2="16" y2="18" />
    </svg>
  );
}

function IconBox({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <line x1="12" y1="13" x2="12" y2="21" />
    </svg>
  );
}

function IconHRD({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconDot({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconChevron({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
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

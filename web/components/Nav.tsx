'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard', icon: IconDashboard },
  { href: '/orders', label: 'Orders', icon: IconOrders },
  { href: '/products', label: 'Inventory', icon: IconProducts },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-200 flex items-center gap-3">
        <Image src="/logo.svg" alt="Alucurv" width={40} height={40} priority />
        <div>
          <div className="font-bold text-lg leading-tight tracking-tight">Alucurv</div>
          <div className="text-[11px] text-slate-500 leading-tight">Marketplace ERP</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((l) => {
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

      <div className="px-4 py-3 border-t border-slate-200 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Connected
        </div>
        <div className="mt-1">Shopee · TikTok</div>
        <div className="mt-2 text-[10px] text-slate-300 italic">Kreasi alumunium, inovasi tanpa batas</div>
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

// Central palette for consistent platform / status colors across the app.

export const PLATFORM_COLORS: Record<string, string> = {
  Shopee: '#ee4d2d',
  TikTok: '#111827',
  Tokopedia: '#42b549',
  WhatsApp: '#25d366',
  Instagram: '#e4405f',
  Offline: '#64748b',
  Lainnya: '#a855f7',
  '(none)': '#cbd5e1',
};

// fallback color cycle for unknown platforms
const FALLBACK = ['#06b6d4', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function platformColor(name: string): string {
  if (PLATFORM_COLORS[name]) return PLATFORM_COLORS[name];
  // deterministic pick based on name
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK[hash % FALLBACK.length];
}

export const STATUS_COLORS: Record<string, string> = {
  to_ship: '#f59e0b',
  shipped: '#3b82f6',
  completed: '#10b981',
  cancelled: '#ef4444',
};

export const PLATFORM_BADGE_CLASS: Record<string, string> = {
  Shopee: 'bg-orange-100 text-orange-700 border border-orange-200',
  TikTok: 'bg-slate-900 text-white',
  Tokopedia: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  WhatsApp: 'bg-green-100 text-green-700 border border-green-200',
  Instagram: 'bg-pink-100 text-pink-700 border border-pink-200',
  Offline: 'bg-slate-100 text-slate-700 border border-slate-200',
  Lainnya: 'bg-purple-100 text-purple-700 border border-purple-200',
};

export function platformBadgeClass(name: string): string {
  return PLATFORM_BADGE_CLASS[name] ?? 'bg-slate-100 text-slate-700 border border-slate-200';
}

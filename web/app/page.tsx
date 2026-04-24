'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { fetcher, formatRupiah } from '@/lib/api';
import { platformColor, STATUS_COLORS } from '@/lib/colors';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

interface DailyBucket {
  day: string;
  orders: number;
  revenue: number;
  byPlatform: Record<string, number>;
}

interface DashboardData {
  range_days: number;
  total_orders: number;
  gross_revenue: number;
  total_quantity: number;
  total_products: number;
  low_stock_count: number;
  low_stock: Array<{ id: string; sku: string; name: string; stock: number }>;
  by_status: Array<{ status: string; orders: number }>;
  by_platform: Array<{ platform: string; orders: number; revenue: number }>;
  daily: DailyBucket[];
  platforms: string[];
}

export default function DashboardPage() {
  const [range, setRange] = useState(7);
  const { data, error, isLoading } = useSWR<DashboardData>(`/api/dashboard?range=${range}`, fetcher, {
    refreshInterval: 30000,
  });

  if (error) return <div className="text-red-600">Failed to load: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  const toShip = data.by_status.find((s) => s.status === 'to_ship')?.orders ?? 0;

  // Stacked daily chart, one series per platform
  const platforms = data.platforms.length > 0 ? data.platforms : ['(none)'];
  const chartData = data.daily.map((d) => {
    const row: Record<string, string | number> = {
      day: new Date(d.day).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
    };
    for (const p of platforms) row[p] = d.byPlatform[p] ?? 0;
    return row;
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <select
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
          className="border rounded px-3 py-1.5 bg-white text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card label="Total Orders" value={String(data.total_orders)} tint="teal" />
        <Card label="Gross Revenue" value={formatRupiah(data.gross_revenue)} tint="emerald" />
        <Card label="Perlu Dikirim" value={String(toShip)} tint="amber" />
        <Card label="Produk / Low Stock" value={`${data.total_products} · ${data.low_stock_count}`} tint="rose" small />
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Orders per Hari · Stacked by Platform</h2>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => (
              <div key={p} className="flex items-center gap-1.5 text-xs">
                <span className="w-3 h-3 rounded" style={{ background: platformColor(p) }} />
                <span className="text-slate-600">{p}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              {platforms.map((p) => (
                <Bar key={p} dataKey={p} stackId="a" fill={platformColor(p)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold mb-4">Distribusi Platform</h2>
          {data.by_platform.length === 0 ? (
            <div className="text-slate-400 text-sm">Belum ada data.</div>
          ) : (
            <div className="flex items-center gap-4">
              <div style={{ width: 180, height: 180 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={data.by_platform}
                      dataKey="orders"
                      nameKey="platform"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {data.by_platform.map((p) => (
                        <Cell key={p.platform} fill={platformColor(p.platform)} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {data.by_platform.map((p) => (
                  <div key={p.platform} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded shrink-0" style={{ background: platformColor(p.platform) }} />
                      <span className="truncate">{p.platform}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{p.orders}</div>
                      <div className="text-xs text-slate-500">{formatRupiah(p.revenue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold mb-4">Status Order</h2>
          <div className="grid grid-cols-2 gap-3">
            {data.by_status.length === 0 && <div className="text-slate-400 col-span-2 text-sm">Belum ada data.</div>}
            {data.by_status.map((s) => (
              <div
                key={s.status}
                className="p-3 rounded border"
                style={{
                  background: `${STATUS_COLORS[s.status] ?? '#94a3b8'}15`,
                  borderColor: `${STATUS_COLORS[s.status] ?? '#94a3b8'}40`,
                }}
              >
                <div className="text-xs uppercase tracking-wide text-slate-600">
                  {s.status.replace('_', ' ')}
                </div>
                <div className="text-2xl font-bold" style={{ color: STATUS_COLORS[s.status] ?? '#334155' }}>
                  {s.orders}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="font-semibold mb-4">Stok Menipis (≤10)</h2>
        {data.low_stock.length === 0 ? (
          <div className="text-slate-400 text-sm">Semua stok aman ✓</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.low_stock.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded">
                <div>
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{p.sku}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {p.stock}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Card({ label, value, tint, small }: { label: string; value: string; tint?: 'teal' | 'emerald' | 'amber' | 'rose'; small?: boolean }) {
  const tintMap = {
    teal: 'border-teal-200 bg-teal-50/50',
    emerald: 'border-emerald-200 bg-emerald-50/50',
    amber: 'border-amber-200 bg-amber-50/50',
    rose: 'border-rose-200 bg-rose-50/50',
  };
  const textMap = {
    teal: 'text-teal-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
  };
  return (
    <div className={`rounded-lg border p-5 ${tint ? tintMap[tint] : 'bg-white border-slate-200'}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      <div className={`font-bold ${small ? 'text-base' : 'text-2xl'} ${tint ? textMap[tint] : ''}`}>
        {value}
      </div>
    </div>
  );
}

'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { fetcher, formatRupiah } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';

interface DashboardData {
  range_days: number;
  total_orders: number;
  gross_revenue: number;
  by_platform: Array<{ platform: string; orders: number; revenue: number }>;
  by_status: Array<{ status: string; orders: number }>;
  daily: Array<{ day: string; platform: string; orders: number; revenue: number }>;
}

export default function DashboardPage() {
  const [range, setRange] = useState(7);
  const { data, error, isLoading } = useSWR<DashboardData>(`/api/dashboard?range=${range}`, fetcher, {
    refreshInterval: 30000,
  });

  if (error) return <div className="text-red-600">Failed to load: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  const chartData = pivotDaily(data.daily);
  const shopeeRev = data.by_platform.find((p) => p.platform === 'shopee')?.revenue ?? 0;
  const tiktokRev = data.by_platform.find((p) => p.platform === 'tiktok')?.revenue ?? 0;
  const toShip = data.by_status.find((s) => s.status === 'to_ship')?.orders ?? 0;

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
        <Card label="Total Orders" value={String(data.total_orders)} />
        <Card label="Gross Revenue" value={formatRupiah(data.gross_revenue)} />
        <Card label="Perlu Dikirim" value={String(toShip)} accent="orange" />
        <Card label="Shopee / TikTok" value={`${formatRupiah(shopeeRev)} / ${formatRupiah(tiktokRev)}`} small />
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="font-semibold mb-4">Orders per Day by Platform</h2>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="shopee" stackId="a" fill="#ee4d2d" />
              <Bar dataKey="tiktok" stackId="a" fill="#000000" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="font-semibold mb-4">Status Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.by_status.map((s) => (
            <div key={s.status} className="p-4 bg-slate-50 rounded">
              <div className="text-xs uppercase text-slate-500">{s.status.replace('_', ' ')}</div>
              <div className="text-2xl font-bold">{s.orders}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({ label, value, accent, small }: { label: string; value: string; accent?: 'orange'; small?: boolean }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      <div className={`font-bold ${small ? 'text-base' : 'text-2xl'} ${accent === 'orange' ? 'text-orange-600' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function pivotDaily(rows: DashboardData['daily']) {
  const map = new Map<string, { day: string; shopee: number; tiktok: number }>();
  for (const r of rows) {
    const day = new Date(r.day).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    if (!map.has(day)) map.set(day, { day, shopee: 0, tiktok: 0 });
    const row = map.get(day)!;
    if (r.platform === 'shopee') row.shopee = r.orders;
    if (r.platform === 'tiktok') row.tiktok = r.orders;
  }
  return Array.from(map.values());
}

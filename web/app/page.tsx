'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { fetcher, formatRupiah } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

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
  daily: Array<{ day: string; orders: number; revenue: number }>;
}

export default function DashboardPage() {
  const [range, setRange] = useState(7);
  const { data, error, isLoading } = useSWR<DashboardData>(`/api/dashboard?range=${range}`, fetcher, {
    refreshInterval: 30000,
  });

  if (error) return <div className="text-red-600">Failed to load: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  const toShip = data.by_status.find((s) => s.status === 'to_ship')?.orders ?? 0;
  const chartData = data.daily.map((d) => ({
    day: new Date(d.day).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
    orders: d.orders,
  }));

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
        <Card label="Total Produk" value={`${data.total_products} · ${data.low_stock_count} low`} small />
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="font-semibold mb-4">Orders per Hari</h2>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="orders" fill="#26D9CB" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold mb-4">Status Order</h2>
          <div className="grid grid-cols-2 gap-3">
            {data.by_status.length === 0 && <div className="text-slate-400 col-span-2 text-sm">Belum ada data.</div>}
            {data.by_status.map((s) => (
              <div key={s.status} className="p-3 bg-slate-50 rounded">
                <div className="text-xs uppercase text-slate-500">{s.status.replace('_', ' ')}</div>
                <div className="text-2xl font-bold">{s.orders}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold mb-4">Stok Menipis (≤10)</h2>
          {data.low_stock.length === 0 ? (
            <div className="text-slate-400 text-sm">Semua stok aman ✓</div>
          ) : (
            <div className="space-y-2">
              {data.low_stock.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
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

      {data.by_platform.length > 0 && (
        <section className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold mb-4">Per Platform</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.by_platform.map((p) => (
              <div key={p.platform} className="p-3 bg-slate-50 rounded">
                <div className="text-xs uppercase text-slate-500">{p.platform}</div>
                <div className="text-lg font-bold">{p.orders} orders</div>
                <div className="text-xs text-slate-600">{formatRupiah(p.revenue)}</div>
              </div>
            ))}
          </div>
        </section>
      )}
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

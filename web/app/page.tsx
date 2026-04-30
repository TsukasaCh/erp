'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { fetcher, formatRupiah } from '@/lib/api';
import { platformColor, STATUS_COLORS } from '@/lib/colors';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';

interface DailyBucket {
  day: string;
  orders: number;
  revenue: number;
  byPlatform: Record<string, number>;
}

interface ProductionScheduleItem {
  id: string;
  scheduledAt: string;
  productName: string;
  quantity: number;
  status: string;
  assignedTo?: string | null;
}

interface DashboardData {
  range_days: number;
  all_time: boolean;

  total_orders: number;
  gross_revenue: number;
  total_quantity: number;
  by_status: Array<{ status: string; orders: number }>;
  by_platform: Array<{ platform: string; orders: number; revenue: number }>;
  daily: DailyBucket[];
  platforms: string[];

  total_products: number;
  low_stock_count: number;
  low_stock: Array<{ id: string; sku: string; name: string; stock: number }>;

  total_materials: number;
  low_stock_materials_count: number;
  low_stock_materials: Array<{ id: string; code: string; name: string; stock: number; unit: string }>;
  total_suppliers: number;

  po_total_count: number;
  po_total_value: number;
  po_by_status: Array<{ status: string; orders: number; value: number }>;
  po_by_supplier: Array<{ supplier: string; orders: number; value: number }>;

  production_today: number;
  production_week: ProductionScheduleItem[];
  production_by_status: Array<{ status: string; count: number }>;
}

const PO_STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu',
  received: 'Diterima',
  cancelled: 'Batal',
};
const PO_STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b',
  received: '#10b981',
  cancelled: '#94a3b8',
};

const PROD_STATUS_LABEL: Record<string, string> = {
  planned: 'Rencana',
  'in-progress': 'Proses',
  in_progress: 'Proses',
  done: 'Selesai',
  cancelled: 'Batal',
};

export default function DashboardPage() {
  const [range, setRange] = useState(30);
  const { data, error, isLoading } = useSWR<DashboardData>(`/api/dashboard?range=${range}`, fetcher, {
    refreshInterval: 30000,
  });

  if (error) return <div className="text-red-600">Failed to load: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  const toShip = data.by_status.find((s) => s.status === 'to_ship')?.orders ?? 0;
  const poPending = data.po_by_status.find((s) => s.status === 'pending');
  const poPendingCount = poPending?.orders ?? 0;
  const poPendingValue = poPending?.value ?? 0;

  // Stacked daily chart, one series per platform
  const platforms = data.platforms.length > 0 ? data.platforms : ['(none)'];
  const chartData = data.daily.map((d) => {
    const row: Record<string, string | number> = {
      day: new Date(d.day).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
    };
    for (const p of platforms) row[p] = d.byPlatform[p] ?? 0;
    return row;
  });

  const rangeLabel = data.all_time ? 'semua waktu' : `${data.range_days} hari terakhir`;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Periode: {rangeLabel}</p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
          className="border rounded px-3 py-1.5 bg-white text-sm"
        >
          <option value={7}>7 hari terakhir</option>
          <option value={30}>30 hari terakhir</option>
          <option value={90}>90 hari terakhir</option>
          <option value={0}>Semua waktu</option>
        </select>
      </header>

      {/* === SECTION: PENJUALAN === */}
      <section>
        <h2 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Penjualan</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card label="Total Order" value={String(data.total_orders)} tint="teal" />
          <Card label="Gross Revenue" value={formatRupiah(data.gross_revenue)} tint="emerald" />
          <Card label="Perlu Dikirim" value={String(toShip)} tint="amber" />
          <Card label={`Qty Terjual`} value={String(data.total_quantity)} tint="slate" small />
        </div>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Order per Hari · Stacked by Platform</h2>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => (
              <div key={p} className="flex items-center gap-1.5 text-xs">
                <span className="w-3 h-3 rounded" style={{ background: platformColor(p) }} />
                <span className="text-slate-600">{p}</span>
              </div>
            ))}
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="text-slate-400 text-sm py-12 text-center">
            Belum ada order pada periode ini.
          </div>
        ) : (
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
        )}
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

      {/* === SECTION: PEMBELIAN PO === */}
      <section>
        <h2 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Pembelian PO</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card label="Total PO" value={String(data.po_total_count)} tint="indigo" />
          <Card label="Nilai PO" value={formatRupiah(data.po_total_value)} tint="indigo" />
          <Card label="PO Menunggu" value={String(poPendingCount)} tint="amber" />
          <Card label="Nilai Menunggu" value={formatRupiah(poPendingValue)} tint="amber" small />
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold mb-4">Status Pembelian PO</h2>
          {data.po_by_status.length === 0 ? (
            <div className="text-slate-400 text-sm">Belum ada PO pada periode ini.</div>
          ) : (
            <div className="space-y-2">
              {data.po_by_status.map((p) => (
                <div key={p.status} className="flex items-center justify-between p-3 rounded border"
                  style={{
                    background: `${PO_STATUS_COLOR[p.status] ?? '#94a3b8'}15`,
                    borderColor: `${PO_STATUS_COLOR[p.status] ?? '#94a3b8'}40`,
                  }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: PO_STATUS_COLOR[p.status] ?? '#94a3b8' }} />
                    <span className="text-sm font-medium">{PO_STATUS_LABEL[p.status] ?? p.status}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm">{p.orders} PO</div>
                    <div className="text-xs text-slate-500">{formatRupiah(p.value)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold mb-4">Top Supplier</h2>
          {data.po_by_supplier.length === 0 ? (
            <div className="text-slate-400 text-sm">Belum ada supplier.</div>
          ) : (
            <div className="space-y-2">
              {data.po_by_supplier.map((s, idx) => (
                <div key={s.supplier} className="flex items-center justify-between text-sm py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs flex items-center justify-center font-semibold shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate font-medium">{s.supplier}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{s.orders} PO</div>
                    <div className="text-xs text-slate-500">{formatRupiah(s.value)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* === SECTION: BAHAN BAKU + PRODUKSI === */}
      <section>
        <h2 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Bahan Baku & Produksi</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card label="Total Bahan" value={String(data.total_materials)} tint="cyan" />
          <Card label="Bahan Stok Menipis" value={String(data.low_stock_materials_count)} tint="rose" />
          <Card label="Total Supplier" value={String(data.total_suppliers)} tint="cyan" small />
          <Card label="Produksi Hari Ini" value={String(data.production_today)} tint="violet" />
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold mb-4">Stok Bahan Baku Menipis (≤10)</h2>
          {data.low_stock_materials.length === 0 ? (
            <div className="text-slate-400 text-sm">Semua stok bahan aman ✓</div>
          ) : (
            <div className="space-y-2">
              {data.low_stock_materials.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{m.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{m.code}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold shrink-0 ml-2 ${m.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {m.stock} {m.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold mb-4">Jadwal Produksi (7 hari ke depan)</h2>
          {data.production_week.length === 0 ? (
            <div className="text-slate-400 text-sm">Tidak ada jadwal produksi.</div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-auto">
              {data.production_week.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-1.5 px-2 hover:bg-slate-50 rounded">
                  <div className="text-xs text-slate-500 font-mono w-16 shrink-0">
                    {new Date(p.scheduledAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {p.quantity}× {p.productName}
                    </div>
                    {p.assignedTo && (
                      <div className="text-xs text-slate-500 truncate">→ {p.assignedTo}</div>
                    )}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                    {PROD_STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="font-semibold mb-4">Inventory: Stok Produk Menipis (≤10)</h2>
        {data.low_stock.length === 0 ? (
          <div className="text-slate-400 text-sm">Semua stok produk aman ✓</div>
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

type Tint = 'teal' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'cyan' | 'violet' | 'slate';

function Card({ label, value, tint, small }: { label: string; value: string; tint?: Tint; small?: boolean }) {
  const tintMap: Record<Tint, string> = {
    teal:    'border-teal-200 bg-teal-50/50',
    emerald: 'border-emerald-200 bg-emerald-50/50',
    amber:   'border-amber-200 bg-amber-50/50',
    rose:    'border-rose-200 bg-rose-50/50',
    indigo:  'border-indigo-200 bg-indigo-50/50',
    cyan:    'border-cyan-200 bg-cyan-50/50',
    violet:  'border-violet-200 bg-violet-50/50',
    slate:   'border-slate-200 bg-slate-50/50',
  };
  const textMap: Record<Tint, string> = {
    teal:    'text-teal-700',
    emerald: 'text-emerald-700',
    amber:   'text-amber-700',
    rose:    'text-rose-700',
    indigo:  'text-indigo-700',
    cyan:    'text-cyan-700',
    violet:  'text-violet-700',
    slate:   'text-slate-700',
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

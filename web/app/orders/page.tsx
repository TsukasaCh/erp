'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { fetcher, formatRupiah } from '@/lib/api';

type Status = 'to_ship' | 'shipped' | 'completed' | 'cancelled' | 'all';
type Platform = 'all' | 'shopee' | 'tiktok';

interface OrderItem {
  id: string;
  sku: string;
  quantity: number;
  price: string;
}

interface Order {
  id: string;
  platform: string;
  externalOrderId: string;
  status: string;
  buyerName: string | null;
  totalAmount: string;
  shippingStatus: string | null;
  orderedAt: string;
  items: OrderItem[];
}

interface ListResponse { page: number; pageSize: number; total: number; items: Order[] }

const TABS: { key: Status; label: string }[] = [
  { key: 'to_ship', label: 'Perlu Dikirim' },
  { key: 'shipped', label: 'Dikirim' },
  { key: 'completed', label: 'Selesai' },
  { key: 'cancelled', label: 'Cancel' },
  { key: 'all', label: 'Semua' },
];

export default function OrdersPage() {
  const [status, setStatus] = useState<Status>('to_ship');
  const [platform, setPlatform] = useState<Platform>('all');
  const [page, setPage] = useState(1);

  const { data, error, isLoading } = useSWR<ListResponse>(
    `/api/orders?status=${status}&platform=${platform}&page=${page}&pageSize=25`,
    fetcher,
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
        <select
          value={platform}
          onChange={(e) => { setPlatform(e.target.value as Platform); setPage(1); }}
          className="border rounded px-3 py-1.5 bg-white text-sm"
        >
          <option value="all">All Platforms</option>
          <option value="shopee">Shopee</option>
          <option value="tiktok">TikTok</option>
        </select>
      </header>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setStatus(t.key); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              status === t.key
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="text-red-600">Error: {String(error)}</div>}
      {isLoading && <div className="text-slate-500">Loading…</div>}

      {data && (
        <>
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">Platform</th>
                  <th className="px-4 py-3 font-medium">Buyer</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Tidak ada order.</td></tr>
                )}
                {data.items.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{o.externalOrderId}</td>
                    <td className="px-4 py-3">
                      <PlatformBadge platform={o.platform} />
                    </td>
                    <td className="px-4 py-3">{o.buyerName ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {o.items.length} item · {o.items.reduce((s, i) => s + i.quantity, 0)} qty
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatRupiah(Number(o.totalAmount))}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{new Date(o.orderedAt).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Total: {data.total} orders</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Prev
              </button>
              <span className="px-3 py-1">Page {data.page}</span>
              <button
                disabled={data.page * data.pageSize >= data.total}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const styles = platform === 'shopee'
    ? 'bg-orange-100 text-orange-700'
    : 'bg-slate-900 text-white';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles}`}>{platform}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    to_ship: 'bg-amber-100 text-amber-800',
    shipped: 'bg-blue-100 text-blue-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-slate-100'}`}>{status}</span>;
}

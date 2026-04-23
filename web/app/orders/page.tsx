'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { fetcher, formatRupiah, postJSON } from '@/lib/api';
import { SpreadsheetEditor, type ColumnDef } from '@/components/SpreadsheetEditor';

interface Order {
  id?: string;
  orderNo?: string | null;
  orderedAt?: string;
  platform?: string | null;
  buyer?: string | null;
  sku?: string | null;
  productName?: string | null;
  quantity: number;
  price: number;
  total: number;
  status: string;
  note?: string | null;
  _localId?: string;
  _dirty?: boolean;
  _new?: boolean;
  _deleted?: boolean;
  [k: string]: unknown;
}

interface ListResponse { page: number; pageSize: number; total: number; items: Order[] }

const PLATFORMS = ['Shopee', 'TikTok', 'Tokopedia', 'Offline', 'WhatsApp', 'Instagram', 'Lainnya'];
const STATUSES = ['to_ship', 'shipped', 'completed', 'cancelled'];

const TABS: { key: string; label: string }[] = [
  { key: 'to_ship', label: 'Perlu Dikirim' },
  { key: 'shipped', label: 'Dikirim' },
  { key: 'completed', label: 'Selesai' },
  { key: 'cancelled', label: 'Cancel' },
  { key: 'all', label: 'Semua' },
];

const columns: ColumnDef<Order>[] = [
  { key: 'orderNo', label: 'No. Order', type: 'text', width: 130 },
  { key: 'orderedAt', label: 'Tanggal', type: 'datetime', width: 170 },
  { key: 'platform', label: 'Platform', type: 'select', options: PLATFORMS, width: 120 },
  { key: 'buyer', label: 'Pembeli', type: 'text', width: 160 },
  { key: 'sku', label: 'SKU', type: 'text', width: 140 },
  { key: 'productName', label: 'Produk', type: 'text', width: 220 },
  { key: 'quantity', label: 'Qty', type: 'number', width: 70, align: 'right' },
  { key: 'price', label: 'Harga', type: 'number', width: 120, align: 'right',
    format: (v) => v == null ? '' : `Rp ${Number(v).toLocaleString('id-ID')}` },
  { key: 'total', label: 'Total', type: 'readonly', width: 140, align: 'right',
    format: (_v, row) => {
      const t = Number(row.quantity ?? 0) * Number(row.price ?? 0);
      return `Rp ${t.toLocaleString('id-ID')}`;
    },
    computed: (row) => Number(row.quantity ?? 0) * Number(row.price ?? 0),
  },
  { key: 'status', label: 'Status', type: 'select', options: STATUSES, width: 120 },
  { key: 'note', label: 'Catatan', type: 'text', width: 200 },
];

type Mode =
  | { kind: 'view' }
  | { kind: 'edit'; focusId?: string; addNew?: boolean };

export default function OrdersPage() {
  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [status, setStatus] = useState<string>('to_ship');
  const [platform, setPlatform] = useState<string>('all');

  const { data, error, isLoading, mutate } = useSWR<ListResponse>(
    `/api/orders?status=${status}&platform=${platform}&pageSize=500`,
    fetcher,
  );

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  if (mode.kind === 'edit') {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {mode.addNew ? 'Tambah Order' : 'Edit Orders'}
            </h1>
            <p className="text-sm text-slate-500">
              Double-click sel untuk edit. Ctrl+S simpan · Ctrl+Z undo · Del hapus baris.
            </p>
          </div>
        </header>

        <div className="flex-1 min-h-0">
          <SpreadsheetEditor<Order>
            columns={columns}
            initialRows={data.items}
            autoAddRow={mode.addNew}
            focusRowId={mode.focusId}
            onClose={() => setMode({ kind: 'view' })}
            onRowTemplate={() => ({
              orderNo: '',
              orderedAt: new Date().toISOString(),
              platform: null,
              buyer: '',
              sku: '',
              productName: '',
              quantity: 1,
              price: 0,
              total: 0,
              status: 'to_ship',
              note: null,
            })}
            onSave={async ({ upserts, deletes }) => {
              await postJSON('/api/orders/batch', { upserts, deletes });
              await mutate();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex items-center gap-2">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="border rounded px-3 py-1.5 bg-white text-sm"
          >
            <option value="all">All Platforms</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button
            onClick={() => setMode({ kind: 'edit' })}
            className="px-3 py-1.5 border border-slate-300 rounded text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5"
          >
            <EditIcon className="w-4 h-4" /> Edit
          </button>
          <button
            onClick={() => setMode({ kind: 'edit', addNew: true })}
            className="px-4 py-1.5 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-700"
          >
            + Tambah Order
          </button>
        </div>
      </header>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              status === t.key
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Order ID</th>
              <th className="px-4 py-3 font-medium">Platform</th>
              <th className="px-4 py-3 font-medium">Pembeli</th>
              <th className="px-4 py-3 font-medium">Produk</th>
              <th className="px-4 py-3 font-medium text-right">Qty</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Tanggal</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">Tidak ada order.</td></tr>
            )}
            {data.items.map((o) => (
              <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50 group">
                <td className="px-4 py-3 font-mono text-xs">{o.orderNo ?? '-'}</td>
                <td className="px-4 py-3">
                  {o.platform ? <PlatformBadge platform={o.platform} /> : <span className="text-slate-400">-</span>}
                </td>
                <td className="px-4 py-3">{o.buyer ?? '-'}</td>
                <td className="px-4 py-3">
                  <div className="text-slate-900">{o.productName ?? '-'}</div>
                  {o.sku && <div className="text-xs text-slate-500 font-mono">{o.sku}</div>}
                </td>
                <td className="px-4 py-3 text-right">{o.quantity}</td>
                <td className="px-4 py-3 text-right font-medium">{formatRupiah(Number(o.total))}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {o.orderedAt ? new Date(o.orderedAt).toLocaleString('id-ID') : '-'}
                </td>
                <td className="px-2 py-3">
                  <button
                    onClick={() => setMode({ kind: 'edit', focusId: o.id })}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-200 rounded transition-opacity"
                    title="Edit"
                  >
                    <EditIcon className="w-4 h-4 text-slate-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500">
        Total: {data.items.length} order
      </div>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const map: Record<string, string> = {
    Shopee: 'bg-orange-100 text-orange-700',
    TikTok: 'bg-slate-900 text-white',
    Tokopedia: 'bg-emerald-100 text-emerald-700',
    Offline: 'bg-slate-100 text-slate-700',
    WhatsApp: 'bg-green-100 text-green-700',
    Instagram: 'bg-pink-100 text-pink-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[platform] ?? 'bg-slate-100 text-slate-700'}`}>
      {platform}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    to_ship: 'bg-amber-100 text-amber-800',
    shipped: 'bg-blue-100 text-blue-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  const label: Record<string, string> = {
    to_ship: 'perlu dikirim',
    shipped: 'dikirim',
    completed: 'selesai',
    cancelled: 'cancel',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-slate-100'}`}>
      {label[status] ?? status}
    </span>
  );
}

function EditIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

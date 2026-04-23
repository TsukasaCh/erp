'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { fetcher, postJSON } from '@/lib/api';
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

const columns: ColumnDef<Order>[] = [
  { key: 'orderNo', label: 'No. Order', type: 'text', width: 130 },
  { key: 'orderedAt', label: 'Tanggal', type: 'datetime', width: 170 },
  { key: 'platform', label: 'Platform', type: 'select', options: PLATFORMS, width: 120 },
  { key: 'buyer', label: 'Pembeli', type: 'text', width: 160 },
  { key: 'sku', label: 'SKU', type: 'text', width: 140 },
  { key: 'productName', label: 'Produk', type: 'text', width: 220 },
  { key: 'quantity', label: 'Qty', type: 'number', width: 70, align: 'right',
    computed: (row) => {
      // keep total in sync with qty*price
      return row.quantity;
    },
  },
  { key: 'price', label: 'Harga', type: 'number', width: 120, align: 'right',
    format: (v) => v == null ? '' : `Rp ${Number(v).toLocaleString('id-ID')}` },
  { key: 'total', label: 'Total', type: 'number', width: 140, align: 'right',
    format: (v, row) => {
      const t = Number(row.quantity ?? 0) * Number(row.price ?? 0);
      return `Rp ${t.toLocaleString('id-ID')}`;
    },
    computed: (row) => Number(row.quantity ?? 0) * Number(row.price ?? 0),
  },
  { key: 'status', label: 'Status', type: 'select', options: STATUSES, width: 120 },
  { key: 'note', label: 'Catatan', type: 'text', width: 200 },
];

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data, error, isLoading, mutate } = useSWR<ListResponse>(
    `/api/orders?status=${statusFilter}&pageSize=500`,
    fetcher,
  );

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-slate-500">
            Edit langsung seperti Excel. Double-click untuk edit. Total dihitung otomatis dari Qty × Harga.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-1.5 bg-white text-sm"
        >
          <option value="all">Semua Status</option>
          <option value="to_ship">Perlu Dikirim</option>
          <option value="shipped">Dikirim</option>
          <option value="completed">Selesai</option>
          <option value="cancelled">Cancel</option>
        </select>
      </header>

      <div className="flex-1 min-h-0">
        <SpreadsheetEditor<Order>
          columns={columns}
          initialRows={data.items}
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

'use client';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { fetcher, formatRupiah, postJSON } from '@/lib/api';
import { platformColor, platformBadgeClass } from '@/lib/colors';
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

const editorColumns: ColumnDef<Order>[] = [
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

type SortKey = 'orderNo' | 'orderedAt' | 'platform' | 'buyer' | 'productName' | 'quantity' | 'total' | 'status';
type SortDir = 'asc' | 'desc';

export default function OrdersPage() {
  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [status, setStatus] = useState<string>('to_ship');
  const [platform, setPlatform] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'orderedAt', dir: 'desc' });

  const { data, error, isLoading, mutate } = useSWR<ListResponse>(
    `/api/orders?status=${status}&pageSize=500`,
    fetcher,
  );

  // Platform counts (computed from current status filter)
  const platformCounts = useMemo(() => {
    if (!data) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const o of data.items) {
      const p = o.platform ?? '(none)';
      m.set(p, (m.get(p) ?? 0) + 1);
    }
    return m;
  }, [data]);

  const filteredSorted = useMemo(() => {
    if (!data) return [];
    let rows = data.items;
    if (platform !== 'all') rows = rows.filter((o) => (o.platform ?? '(none)') === platform);
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((o) =>
        (o.orderNo ?? '').toLowerCase().includes(s) ||
        (o.buyer ?? '').toLowerCase().includes(s) ||
        (o.sku ?? '').toLowerCase().includes(s) ||
        (o.productName ?? '').toLowerCase().includes(s),
      );
    }
    const sorted = [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      // null/undefined go to the end
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), 'id-ID', { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [data, platform, search, sort]);

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  if (mode.kind === 'edit') {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">
            {mode.addNew ? 'Tambah Order' : 'Edit Orders'}
          </h1>
          <p className="text-sm text-slate-500">
            Double-click sel untuk edit. Ctrl+S simpan · Ctrl+Z undo · Del hapus baris.
          </p>
        </header>

        <div className="flex-1 min-h-0">
          <SpreadsheetEditor<Order>
            columns={editorColumns}
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

  const toggleSort = (key: SortKey) => {
    setSort((prev) => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' },
    );
  };

  const totalFiltered = filteredSorted.length;
  const totalRevenue = filteredSorted.reduce((s, o) => s + Number(o.total ?? 0), 0);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex items-center gap-2">
          <input
            placeholder="Cari order / pembeli / SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-1.5 bg-white text-sm w-60"
          />
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

      {/* Status tabs */}
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

      {/* Platform filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-wide text-slate-500 mr-1">Filter Platform:</span>
        <PlatformChip
          label="Semua"
          active={platform === 'all'}
          onClick={() => setPlatform('all')}
          count={data.items.length}
        />
        {PLATFORMS.map((p) => {
          const count = platformCounts.get(p) ?? 0;
          if (count === 0) return null;
          return (
            <PlatformChip
              key={p}
              label={p}
              active={platform === p}
              onClick={() => setPlatform(p)}
              count={count}
              color={platformColor(p)}
            />
          );
        })}
      </div>

      {/* Summary strip */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-600">
          <span className="font-semibold text-slate-900">{totalFiltered}</span> order
        </span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-600">
          Total: <span className="font-semibold text-slate-900">{formatRupiah(totalRevenue)}</span>
        </span>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <SortHeader label="Order ID" sortKey="orderNo" sort={sort} onSort={toggleSort} />
              <SortHeader label="Platform" sortKey="platform" sort={sort} onSort={toggleSort} />
              <SortHeader label="Pembeli" sortKey="buyer" sort={sort} onSort={toggleSort} />
              <SortHeader label="Produk" sortKey="productName" sort={sort} onSort={toggleSort} />
              <SortHeader label="Qty" sortKey="quantity" sort={sort} onSort={toggleSort} align="right" />
              <SortHeader label="Total" sortKey="total" sort={sort} onSort={toggleSort} align="right" />
              <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              <SortHeader label="Tanggal" sortKey="orderedAt" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {filteredSorted.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">Tidak ada order yang cocok.</td></tr>
            )}
            {filteredSorted.map((o) => (
              <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50 group">
                <td className="px-4 py-3 font-mono text-xs">{o.orderNo ?? '-'}</td>
                <td className="px-4 py-3">
                  {o.platform ? (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${platformBadgeClass(o.platform)}`}>
                      {o.platform}
                    </span>
                  ) : <span className="text-slate-400">-</span>}
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
    </div>
  );
}

function SortHeader({ label, sortKey, sort, onSort, align }: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (k: SortKey) => void;
  align?: 'right';
}) {
  const isActive = sort.key === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-4 py-3 font-medium cursor-pointer select-none hover:bg-slate-100 ${align === 'right' ? 'text-right' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-xs text-teal-600">
            {sort.dir === 'asc' ? '▲' : '▼'}
          </span>
        )}
        {!isActive && <span className="text-xs text-slate-300">↕</span>}
      </span>
    </th>
  );
}

function PlatformChip({ label, active, onClick, count, color }: {
  label: string; active: boolean; onClick: () => void; count: number; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
      }`}
    >
      {color && (
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      )}
      <span>{label}</span>
      <span className={active ? 'text-slate-300' : 'text-slate-400'}>·</span>
      <span>{count}</span>
    </button>
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

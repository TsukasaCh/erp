'use client';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { fetcher, formatRupiah, postJSON } from '@/lib/api';
import { platformColor, platformBadgeClass } from '@/lib/colors';
import { SpreadsheetEditor, type ColumnDef, type SpreadsheetRow } from '@/components/SpreadsheetEditor';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { matchText, inDateRange } from '@/lib/search';

interface Product {
  id: string;
  sku: string;
  name: string;
  stock: number;
  price: number;
  category?: { id: string; name: string } | null;
}

interface Order extends SpreadsheetRow {
  id?: string;
  orderNo?: string | null;
  orderedAt?: string;
  platform?: string | null;
  buyer?: string | null;
  productId?: string | null;
  sku?: string | null;
  productName?: string | null;
  quantity: number;
  price: number;
  total: number;
  status: string;
  note?: string | null;
  product?: Product | null;
}

interface ListResponse { page: number; pageSize: number; total: number; items: Order[] }

const PLATFORMS = ['Shopee', 'TikTok', 'Tokopedia', 'Offline', 'WhatsApp', 'Instagram', 'Lainnya'];
const STATUSES = [
  { label: 'Pre-Order', value: 'pre_order' },
  { label: 'Perlu Dikirim', value: 'to_ship' },
  { label: 'Dikirim', value: 'shipped' },
  { label: 'Selesai', value: 'completed' },
  { label: 'Cancel', value: 'cancelled' },
];

const TABS: { key: string; label: string }[] = [
  { key: 'pre_order', label: 'Pre-Order' },
  { key: 'to_ship', label: 'Perlu Dikirim' },
  { key: 'shipped', label: 'Dikirim' },
  { key: 'completed', label: 'Selesai' },
  { key: 'cancelled', label: 'Cancel' },
  { key: 'all', label: 'Semua' },
];

type SortKey = 'orderNo' | 'orderedAt' | 'platform' | 'buyer' | 'productName' | 'quantity' | 'total' | 'status';
type SortDir = 'asc' | 'desc';

type Mode =
  | { kind: 'view' }
  | { kind: 'edit'; focusId?: string; addNew?: boolean };

export default function OrdersPage() {
  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [status, setStatus] = useState<string>('to_ship');
  const [platform, setPlatform] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'orderedAt', dir: 'desc' });

  const { data, error, isLoading, mutate } = useSWR<ListResponse>(
    `/api/orders?status=${status}&pageSize=500`,
    fetcher,
  );

  // SUMBER PRODUK = /api/products (barang jadi yang dijual). Sebelumnya keliru
  // pakai /api/materials sehingga dropdown SKU & Produk berasal dari bahan baku
  // dan tidak pernah ter-link.
  const { data: products } = useSWR<Product[]>('/api/products', fetcher);

  // Index untuk lookup cepat saat onChange / format
  const productBySku = useMemo(() => {
    const m = new Map<string, Product>();
    products?.forEach((p) => m.set(p.sku, p));
    return m;
  }, [products]);
  const productByName = useMemo(() => {
    const m = new Map<string, Product>();
    products?.forEach((p) => m.set(p.name, p));
    return m;
  }, [products]);

  const columns: ColumnDef<Order>[] = useMemo(() => [
    { key: 'orderNo', label: 'No. Order', type: 'text', width: 140 },
    { key: 'orderedAt', label: 'Tanggal', type: 'datetime', width: 170 },
    {
      key: 'platform', label: 'Platform', type: 'select', width: 120,
      options: PLATFORMS,
    },
    { key: 'buyer', label: 'Pembeli', type: 'text', width: 160 },
    {
      // Pilih dari SKU — auto-sync productId, productName, price
      key: 'sku',
      label: 'SKU',
      type: 'select',
      width: 200,
      options: products?.map((p) => ({ value: p.sku, label: `${p.sku} — ${p.name}` })) ?? [],
      // Display saat tidak edit: cukup SKU saja (tanpa nama, supaya kolom ringkas)
      format: (v) => (v == null || v === '' ? '' : String(v)),
      onChange: (newSku, row) => {
        const p = productBySku.get(String(newSku ?? ''));
        if (!p) return;
        // Pilih produk BARU (berbeda dari sebelumnya) → reset price ke harga katalog.
        // Pilih produk SAMA (re-pick) → pertahankan harga manual yg mungkin sudah diedit.
        const isNewProduct = row.productId !== p.id;
        return {
          productId: p.id,
          productName: p.name,
          price: isNewProduct ? p.price : row.price,
        } as Partial<Order>;
      },
    },
    {
      // Pilih dari Nama Produk — auto-sync productId, sku, price
      key: 'productName',
      label: 'Produk',
      type: 'select',
      width: 280,
      options: products?.map((p) => ({ value: p.name, label: p.name })) ?? [],
      onChange: (newName, row) => {
        const p = productByName.get(String(newName ?? ''));
        if (!p) return;
        const isNewProduct = row.productId !== p.id;
        return {
          productId: p.id,
          sku: p.sku,
          price: isNewProduct ? p.price : row.price,
        } as Partial<Order>;
      },
    },
    { key: 'quantity', label: 'Qty', type: 'number', width: 70, align: 'right' },
    {
      key: 'price', label: 'Harga', type: 'number', width: 130, align: 'right',
      format: (v) => formatRupiah(Number(v ?? 0)),
    },
    {
      key: 'total', label: 'Total', type: 'readonly', width: 140, align: 'right',
      format: (_v, row) => {
        const t = Number(row.quantity ?? 0) * Number(row.price ?? 0);
        return formatRupiah(t);
      },
      computed: (row) => Number(row.quantity ?? 0) * Number(row.price ?? 0),
    },
    { key: 'status', label: 'Status', type: 'select', options: STATUSES, width: 130 },
    { key: 'note', label: 'Catatan', type: 'text', width: 200 },
  ], [products, productBySku, productByName]);

  // Platform counts
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
    // Date range filter (orderedAt)
    rows = inDateRange(rows, 'orderedAt', dateFrom, dateTo);
    // Multi-keyword text search across many fields including formatted date & total
    if (search) {
      rows = rows.filter((o) =>
        matchText(o, search, [
          'orderNo', 'buyer', 'sku', 'productName',
          'platform', 'status', 'note', 'orderedAt', 'total', 'price', 'quantity',
        ]),
      );
    }
    const sorted = [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), 'id-ID', { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [data, platform, search, dateFrom, dateTo, sort]);

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  const toggleSort = (key: SortKey) => {
    setSort((prev) => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' },
    );
  };

  const totalFiltered = filteredSorted.length;
  const totalRevenue = filteredSorted.reduce((s, o) => s + Number(o.total ?? 0), 0);

  // --- SPREADSHEET EDIT MODE ---
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
              productId: null,
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

  // --- LIST VIEW MODE ---
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            placeholder="Cari: invoice / pembeli / produk / SKU / tanggal / status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-1.5 bg-white text-sm w-80"
          />
          <DateRangeFilter from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
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
    pre_order: 'bg-purple-100 text-purple-800',
    to_ship: 'bg-amber-100 text-amber-800',
    shipped: 'bg-blue-100 text-blue-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  const label: Record<string, string> = {
    pre_order: 'pre-order',
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

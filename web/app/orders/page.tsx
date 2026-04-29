'use client';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { fetcher, formatRupiah, postJSON } from '@/lib/api';
import { platformColor, platformBadgeClass } from '@/lib/colors';
import { SearchSelect, type SearchSelectOption } from '@/components/SearchSelect';

interface Product {
  id: string;
  sku: string;
  name: string;
  stock: number;
  price: number;
  category?: { id: string; name: string } | null;
}

interface Order {
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

type SortKey = 'orderNo' | 'orderedAt' | 'platform' | 'buyer' | 'productName' | 'quantity' | 'total' | 'status';
type SortDir = 'asc' | 'desc';

export default function OrdersPage() {
  const [status, setStatus] = useState<string>('to_ship');
  const [platform, setPlatform] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'orderedAt', dir: 'desc' });
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const { data, error, isLoading, mutate } = useSWR<ListResponse>(
    `/api/orders?status=${status}&pageSize=500`,
    fetcher,
  );

  const { data: products } = useSWR<Product[]>('/api/products', fetcher);

  const productOptions: SearchSelectOption[] = useMemo(() => {
    if (!products) return [];
    return products.map((p) => ({
      value: p.id,
      label: `${p.sku} - ${p.name} (Stok: ${p.stock})`,
      data: p as unknown as Record<string, unknown>,
    }));
  }, [products]);

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

  const toggleSort = (key: SortKey) => {
    setSort((prev) => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' },
    );
  };

  const totalFiltered = filteredSorted.length;
  const totalRevenue = filteredSorted.reduce((s, o) => s + Number(o.total ?? 0), 0);

  const handleEdit = (order: Order) => {
    setEditingOrder({ ...order });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingOrder({
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
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!editingOrder) return;
    const payload = {
      upserts: [{
        id: editingOrder.id,
        orderNo: editingOrder.orderNo,
        orderedAt: editingOrder.orderedAt,
        platform: editingOrder.platform,
        buyer: editingOrder.buyer,
        productId: editingOrder.productId,
        sku: editingOrder.sku,
        productName: editingOrder.productName,
        quantity: Number(editingOrder.quantity ?? 1),
        price: Number(editingOrder.price ?? 0),
        total: Number(editingOrder.quantity ?? 1) * Number(editingOrder.price ?? 0),
        status: editingOrder.status ?? 'to_ship',
        note: editingOrder.note,
      }],
      deletes: [] as string[],
    };
    await postJSON('/api/orders/batch', payload);
    await mutate();
    setShowForm(false);
    setEditingOrder(null);
  };

  const handleDelete = async () => {
    if (!editingOrder?.id) return;
    if (!confirm('Hapus order ini?')) return;
    await postJSON('/api/orders/batch', { upserts: [], deletes: [editingOrder.id] });
    await mutate();
    setShowForm(false);
    setEditingOrder(null);
  };

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
            onClick={handleNew}
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
                    onClick={() => handleEdit(o)}
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

      {/* Order Form Modal */}
      {showForm && editingOrder && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowForm(false); setEditingOrder(null); }}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold">{editingOrder.id ? 'Edit Order' : 'Tambah Order Baru'}</h3>
              <button onClick={() => { setShowForm(false); setEditingOrder(null); }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <Field label="No. Order">
                  <input
                    value={editingOrder.orderNo ?? ''}
                    onChange={(e) => setEditingOrder((p) => ({ ...p!, orderNo: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Tanggal">
                  <input
                    type="datetime-local"
                    value={editingOrder.orderedAt ? toLocalInput(editingOrder.orderedAt) : ''}
                    onChange={(e) => setEditingOrder((p) => ({ ...p!, orderedAt: new Date(e.target.value).toISOString() }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label="Produk (dari Inventory)">
                <SearchSelect
                  options={productOptions}
                  value={editingOrder.productId}
                  onChange={(val, opt) => {
                    if (opt && opt.data) {
                      const prod = opt.data as unknown as Product;
                      setEditingOrder((p) => ({
                        ...p!,
                        productId: val,
                        sku: prod.sku,
                        productName: prod.name,
                        price: prod.price,
                        total: (p?.quantity ?? 1) * prod.price,
                      }));
                    } else {
                      setEditingOrder((p) => ({
                        ...p!,
                        productId: null,
                        sku: '',
                        productName: '',
                        price: 0,
                        total: 0,
                      }));
                    }
                  }}
                  placeholder="Pilih produk dari inventory..."
                />
                {editingOrder.productId && products && (() => {
                  const prod = products.find((p) => p.id === editingOrder.productId);
                  if (prod && editingOrder.quantity > prod.stock) {
                    return (
                      <div className="mt-1 text-xs text-red-600 font-medium">
                        ⚠ Stok tidak cukup! Sisa: {prod.stock} pcs
                      </div>
                    );
                  }
                  if (prod) {
                    return (
                      <div className="mt-1 text-xs text-slate-500">
                        Stok tersedia: {prod.stock} pcs
                      </div>
                    );
                  }
                  return null;
                })()}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Platform">
                  <select
                    value={editingOrder.platform ?? ''}
                    onChange={(e) => setEditingOrder((p) => ({ ...p!, platform: e.target.value || null }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white"
                  >
                    <option value="">-- Pilih --</option>
                    {PLATFORMS.map((pl) => <option key={pl} value={pl}>{pl}</option>)}
                  </select>
                </Field>
                <Field label="Pembeli">
                  <input
                    value={editingOrder.buyer ?? ''}
                    onChange={(e) => setEditingOrder((p) => ({ ...p!, buyer: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Qty">
                  <input
                    type="number"
                    min={1}
                    value={editingOrder.quantity ?? 1}
                    onChange={(e) => {
                      const qty = Number(e.target.value) || 1;
                      setEditingOrder((p) => ({
                        ...p!,
                        quantity: qty,
                        total: qty * Number(p?.price ?? 0),
                      }));
                    }}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Harga">
                  <input
                    type="number"
                    min={0}
                    value={editingOrder.price ?? 0}
                    onChange={(e) => {
                      const price = Number(e.target.value) || 0;
                      setEditingOrder((p) => ({
                        ...p!,
                        price,
                        total: Number(p?.quantity ?? 1) * price,
                      }));
                    }}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Total">
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-medium text-slate-700">
                    {formatRupiah(Number(editingOrder.quantity ?? 1) * Number(editingOrder.price ?? 0))}
                  </div>
                </Field>
              </div>

              <Field label="Status">
                <select
                  value={editingOrder.status ?? 'to_ship'}
                  onChange={(e) => setEditingOrder((p) => ({ ...p!, status: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                  ))}
                </select>
              </Field>

              <Field label="Catatan">
                <textarea
                  rows={2}
                  value={editingOrder.note ?? ''}
                  onChange={(e) => setEditingOrder((p) => ({ ...p!, note: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                {editingOrder.id && (
                  <button
                    onClick={handleDelete}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    Hapus
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowForm(false); setEditingOrder(null); }}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-white"
                >
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-1.5 text-sm bg-slate-900 text-white rounded font-semibold hover:bg-slate-700"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  to_ship: 'Perlu Dikirim',
  shipped: 'Dikirim',
  completed: 'Selesai',
  cancelled: 'Cancel',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
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

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

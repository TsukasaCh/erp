'use client';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { fetcher, formatRupiah, postJSON } from '@/lib/api';
import { SearchSelect, type SearchSelectOption } from '@/components/SearchSelect';

interface Material {
  id: string;
  code: string;
  name: string;
  unit: string;
  stock: number;
  price: number;
  supplier?: string | null;
}

interface PurchaseOrder {
  id?: string;
  poNo?: string | null;
  orderedAt?: string;
  supplier?: string | null;
  materialId?: string | null;
  materialCode?: string | null;
  materialName?: string | null;
  quantity: number;
  unit?: string | null;
  price: number;
  total: number;
  status: string;
  expectedAt?: string | null;
  note?: string | null;
  material?: Material | null;
  [k: string]: unknown;
}

interface ListResponse { page: number; pageSize: number; total: number; items: PurchaseOrder[] }

const STATUSES = ['pending', 'received', 'cancelled'];
const UNITS = ['pcs', 'batang', 'kg', 'm', 'm²', 'lembar', 'roll', 'box', 'set'];

const TABS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Menunggu' },
  { key: 'received', label: 'Diterima' },
  { key: 'cancelled', label: 'Batal' },
  { key: 'all', label: 'Semua' },
];

export default function PurchaseOrdersPage() {
  const [status, setStatus] = useState<string>('pending');
  const [supplier, setSupplier] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);

  const { data, error, isLoading, mutate } = useSWR<ListResponse>(
    `/api/purchase-orders?status=${status}&pageSize=500`,
    fetcher,
  );

  const { data: materials } = useSWR<Material[]>('/api/materials', fetcher);

  const materialOptions: SearchSelectOption[] = useMemo(() => {
    if (!materials) return [];
    return materials.map((m) => ({
      value: m.id,
      label: `${m.code} - ${m.name} (Stok: ${m.stock} ${m.unit})`,
      data: m as unknown as Record<string, unknown>,
    }));
  }, [materials]);

  const supplierCounts = useMemo(() => {
    if (!data) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const p of data.items) {
      const key = p.supplier ?? '(lainnya)';
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.items;
    if (supplier !== 'all') rows = rows.filter((p) => (p.supplier ?? '(lainnya)') === supplier);
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((p) =>
        (p.poNo ?? '').toLowerCase().includes(s) ||
        (p.supplier ?? '').toLowerCase().includes(s) ||
        (p.materialCode ?? '').toLowerCase().includes(s) ||
        (p.materialName ?? '').toLowerCase().includes(s),
      );
    }
    return rows;
  }, [data, supplier, search]);

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  const totalValue = filtered.reduce((s, p) => s + Number(p.total ?? 0), 0);

  const handleNew = () => {
    setEditingPO({
      poNo: '',
      orderedAt: new Date().toISOString(),
      supplier: '',
      materialId: null,
      materialCode: '',
      materialName: '',
      quantity: 1,
      unit: 'pcs',
      price: 0,
      total: 0,
      status: 'pending',
      expectedAt: null,
      note: null,
    });
    setShowForm(true);
  };

  const handleEdit = (po: PurchaseOrder) => {
    setEditingPO({ ...po });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!editingPO) return;
    const payload = {
      upserts: [{
        id: editingPO.id,
        poNo: editingPO.poNo,
        orderedAt: editingPO.orderedAt,
        supplier: editingPO.supplier,
        materialId: editingPO.materialId,
        materialCode: editingPO.materialCode,
        materialName: editingPO.materialName,
        quantity: Number(editingPO.quantity ?? 1),
        unit: editingPO.unit,
        price: Number(editingPO.price ?? 0),
        total: Number(editingPO.quantity ?? 1) * Number(editingPO.price ?? 0),
        status: editingPO.status ?? 'pending',
        expectedAt: editingPO.expectedAt,
        note: editingPO.note,
      }],
      deletes: [] as string[],
    };
    await postJSON('/api/purchase-orders/batch', payload);
    await mutate();
    setShowForm(false);
    setEditingPO(null);
  };

  const handleDelete = async () => {
    if (!editingPO?.id) return;
    if (!confirm('Hapus PO ini?')) return;
    await postJSON('/api/purchase-orders/batch', { upserts: [], deletes: [editingPO.id] });
    await mutate();
    setShowForm(false);
    setEditingPO(null);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pembelian PO</h1>
          <p className="text-sm text-slate-500 mt-1">Tracking pembelian bahan baku ke supplier.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="Cari PO / supplier / bahan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-1.5 bg-white text-sm w-64"
          />
          <button
            onClick={handleNew}
            className="px-4 py-1.5 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-700"
          >
            + Tambah PO
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

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-wide text-slate-500 mr-1">Filter Supplier:</span>
        <Chip label="Semua" active={supplier === 'all'} onClick={() => setSupplier('all')} count={data.items.length} />
        {Array.from(supplierCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([s, count]) => (
            <Chip key={s} label={s} active={supplier === s} onClick={() => setSupplier(s)} count={count} />
          ))}
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-600">
          <span className="font-semibold text-slate-900">{filtered.length}</span> PO
        </span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-600">
          Total nilai: <span className="font-semibold text-slate-900">{formatRupiah(totalValue)}</span>
        </span>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">No. PO</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Bahan</th>
              <th className="px-4 py-3 font-medium text-right">Qty</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Tanggal</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                Belum ada PO pada tab ini.
              </td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50 group">
                <td className="px-4 py-3 font-mono text-xs">{p.poNo ?? '-'}</td>
                <td className="px-4 py-3">{p.supplier ?? '-'}</td>
                <td className="px-4 py-3">
                  <div className="text-slate-900">{p.materialName ?? '-'}</div>
                  {p.materialCode && <div className="text-xs text-slate-500 font-mono">{p.materialCode}</div>}
                </td>
                <td className="px-4 py-3 text-right">
                  {p.quantity} {p.unit && <span className="text-xs text-slate-400">{p.unit}</span>}
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatRupiah(Number(p.total))}</td>
                <td className="px-4 py-3"><PoStatusBadge status={p.status} /></td>
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {p.orderedAt ? new Date(p.orderedAt).toLocaleDateString('id-ID') : '-'}
                </td>
                <td className="px-2 py-3">
                  <button
                    onClick={() => handleEdit(p)}
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

      {/* PO Form Modal */}
      {showForm && editingPO && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowForm(false); setEditingPO(null); }}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold">{editingPO.id ? 'Edit Pembelian PO' : 'Tambah Pembelian PO'}</h3>
              <button onClick={() => { setShowForm(false); setEditingPO(null); }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <Field label="No. PO">
                  <input
                    value={editingPO.poNo ?? ''}
                    onChange={(e) => setEditingPO((p) => ({ ...p!, poNo: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Tanggal Order">
                  <input
                    type="datetime-local"
                    value={editingPO.orderedAt ? toLocalInput(editingPO.orderedAt) : ''}
                    onChange={(e) => setEditingPO((p) => ({ ...p!, orderedAt: new Date(e.target.value).toISOString() }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label="Bahan (dari Master Data Bahan)">
                <SearchSelect
                  options={materialOptions}
                  value={editingPO.materialId}
                  onChange={(val, opt) => {
                    if (opt && opt.data) {
                      const mat = opt.data as unknown as Material;
                      setEditingPO((p) => ({
                        ...p!,
                        materialId: val,
                        materialCode: mat.code,
                        materialName: mat.name,
                        unit: mat.unit,
                        supplier: mat.supplier ?? p?.supplier ?? '',
                        price: mat.price,
                        total: (p?.quantity ?? 1) * mat.price,
                      }));
                    } else {
                      setEditingPO((p) => ({
                        ...p!,
                        materialId: null,
                        materialCode: '',
                        materialName: '',
                      }));
                    }
                  }}
                  placeholder="Pilih bahan dari master data..."
                />
              </Field>

              <Field label="Supplier">
                <input
                  value={editingPO.supplier ?? ''}
                  onChange={(e) => setEditingPO((p) => ({ ...p!, supplier: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Qty">
                  <input
                    type="number"
                    min={1}
                    value={editingPO.quantity ?? 1}
                    onChange={(e) => {
                      const qty = Number(e.target.value) || 1;
                      setEditingPO((p) => ({
                        ...p!,
                        quantity: qty,
                        total: qty * Number(p?.price ?? 0),
                      }));
                    }}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Satuan">
                  <select
                    value={editingPO.unit ?? 'pcs'}
                    onChange={(e) => setEditingPO((p) => ({ ...p!, unit: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white"
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Field>
                <Field label="Harga per Unit">
                  <input
                    type="number"
                    min={0}
                    value={editingPO.price ?? 0}
                    onChange={(e) => {
                      const price = Number(e.target.value) || 0;
                      setEditingPO((p) => ({
                        ...p!,
                        price,
                        total: Number(p?.quantity ?? 1) * price,
                      }));
                    }}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label="Total">
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-medium text-slate-700">
                  {formatRupiah(Number(editingPO.quantity ?? 1) * Number(editingPO.price ?? 0))}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <select
                    value={editingPO.status ?? 'pending'}
                    onChange={(e) => setEditingPO((p) => ({ ...p!, status: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white"
                  >
                    <option value="pending">Menunggu</option>
                    <option value="received">Diterima</option>
                    <option value="cancelled">Batal</option>
                  </select>
                  {editingPO.status === 'received' && (
                    <div className="mt-1 text-xs text-emerald-600 font-medium">
                      ✓ Stok bahan akan otomatis bertambah
                    </div>
                  )}
                </Field>
                <Field label="Target Terima">
                  <input
                    type="date"
                    value={editingPO.expectedAt ? String(editingPO.expectedAt).slice(0, 10) : ''}
                    onChange={(e) => setEditingPO((p) => ({ ...p!, expectedAt: e.target.value || null }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label="Catatan">
                <textarea
                  rows={2}
                  value={editingPO.note ?? ''}
                  onChange={(e) => setEditingPO((p) => ({ ...p!, note: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                {editingPO.id && (
                  <button onClick={handleDelete} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded">
                    Hapus
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowForm(false); setEditingPO(null); }}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

function Chip({ label, active, onClick, count }: {
  label: string; active: boolean; onClick: () => void; count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
      }`}
    >
      {label}
      <span className={`${active ? 'text-slate-300' : 'text-slate-400'}`}>({count})</span>
    </button>
  );
}

function PoStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   'bg-amber-100 text-amber-700',
    received:  'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-slate-200 text-slate-600',
  };
  const label: Record<string, string> = {
    pending: 'Menunggu', received: 'Diterima', cancelled: 'Batal',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-slate-100 text-slate-700'}`}>{label[status] ?? status}</span>;
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

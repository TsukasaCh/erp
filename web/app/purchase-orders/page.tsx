'use client';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { fetcher, formatRupiah, postJSON } from '@/lib/api';
import { SpreadsheetEditor, type ColumnDef } from '@/components/SpreadsheetEditor';

interface PurchaseOrder {
  id?: string;
  poNo?: string | null;
  orderedAt?: string;
  supplier?: string | null;
  materialCode?: string | null;
  materialName?: string | null;
  quantity: number;
  unit?: string | null;
  price: number;
  total: number;
  status: string;
  expectedAt?: string | null;
  note?: string | null;
  _localId?: string;
  _dirty?: boolean;
  _new?: boolean;
  _deleted?: boolean;
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

const editorColumns: ColumnDef<PurchaseOrder>[] = [
  { key: 'poNo', label: 'No. PO', type: 'text', width: 130 },
  { key: 'orderedAt', label: 'Tanggal Order', type: 'datetime', width: 170 },
  { key: 'supplier', label: 'Supplier', type: 'text', width: 180 },
  { key: 'materialCode', label: 'Kode Bahan', type: 'text', width: 130 },
  { key: 'materialName', label: 'Nama Bahan', type: 'text', width: 220 },
  { key: 'quantity', label: 'Qty', type: 'number', width: 80, align: 'right' },
  { key: 'unit', label: 'Satuan', type: 'select', options: UNITS, width: 90 },
  { key: 'price', label: 'Harga', type: 'number', width: 130, align: 'right',
    format: (v) => v == null ? '' : `Rp ${Number(v).toLocaleString('id-ID')}` },
  { key: 'total', label: 'Total', type: 'readonly', width: 140, align: 'right',
    format: (_v, row) => {
      const t = Number(row.quantity ?? 0) * Number(row.price ?? 0);
      return `Rp ${t.toLocaleString('id-ID')}`;
    },
    computed: (row) => Number(row.quantity ?? 0) * Number(row.price ?? 0),
  },
  { key: 'expectedAt', label: 'Target Terima', type: 'date', width: 150 },
  { key: 'status', label: 'Status', type: 'select', options: STATUSES, width: 120 },
  { key: 'note', label: 'Catatan', type: 'text', width: 200 },
];

type Mode =
  | { kind: 'view' }
  | { kind: 'edit'; focusId?: string; addNew?: boolean };

export default function PurchaseOrdersPage() {
  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [status, setStatus] = useState<string>('pending');
  const [supplier, setSupplier] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data, error, isLoading, mutate } = useSWR<ListResponse>(
    `/api/purchase-orders?status=${status}&pageSize=500`,
    fetcher,
  );

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

  if (mode.kind === 'edit') {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">
            {mode.addNew ? 'Tambah Pembelian PO' : 'Edit Pembelian PO'}
          </h1>
          <p className="text-sm text-slate-500">
            Double-click sel untuk edit. Ctrl+S simpan · Ctrl+Z undo · Del hapus baris.
          </p>
        </header>
        <div className="flex-1 min-h-0">
          <SpreadsheetEditor<PurchaseOrder>
            columns={editorColumns}
            initialRows={data.items}
            autoAddRow={mode.addNew}
            focusRowId={mode.focusId}
            onClose={() => setMode({ kind: 'view' })}
            onRowTemplate={() => ({
              poNo: '',
              orderedAt: new Date().toISOString(),
              supplier: '',
              materialCode: '',
              materialName: '',
              quantity: 1,
              unit: 'pcs',
              price: 0,
              total: 0,
              status: 'pending',
              expectedAt: null,
              note: null,
            })}
            onSave={async ({ upserts, deletes }) => {
              await postJSON('/api/purchase-orders/batch', { upserts, deletes });
              await mutate();
            }}
          />
        </div>
      </div>
    );
  }

  const totalValue = filtered.reduce((s, p) => s + Number(p.total ?? 0), 0);

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
            onClick={() => setMode({ kind: 'edit' })}
            className="px-3 py-1.5 border border-slate-300 rounded text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5"
          >
            <EditIcon className="w-4 h-4" /> Edit
          </button>
          <button
            onClick={() => setMode({ kind: 'edit', addNew: true })}
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
                    onClick={() => setMode({ kind: 'edit', focusId: p.id })}
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

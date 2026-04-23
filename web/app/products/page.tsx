'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { fetcher, formatRupiah, postJSON } from '@/lib/api';
import { SpreadsheetEditor, type ColumnDef } from '@/components/SpreadsheetEditor';

interface Product {
  id?: string;
  sku: string;
  name: string;
  category?: string | null;
  stock: number;
  price: number;
  note?: string | null;
  updatedAt?: string;
  _localId?: string;
  _dirty?: boolean;
  _new?: boolean;
  _deleted?: boolean;
  [k: string]: unknown;
}

const CATEGORIES = ['Pintu', 'Jendela', 'Kusen', 'Aksesoris', 'Material', 'Jasa'];

const columns: ColumnDef<Product>[] = [
  { key: 'sku', label: 'SKU', type: 'text', width: 160 },
  { key: 'name', label: 'Nama Produk', type: 'text', width: 260 },
  { key: 'category', label: 'Kategori', type: 'select', options: CATEGORIES, width: 130 },
  { key: 'stock', label: 'Stok', type: 'number', width: 90, align: 'right' },
  { key: 'price', label: 'Harga', type: 'number', width: 130, align: 'right',
    format: (v) => v == null ? '' : `Rp ${Number(v).toLocaleString('id-ID')}` },
  { key: 'note', label: 'Catatan', type: 'text', width: 240 },
  { key: 'updatedAt', label: 'Update Terakhir', type: 'readonly', width: 150,
    format: (v) => v ? new Date(String(v)).toLocaleString('id-ID') : '' },
];

type Mode =
  | { kind: 'view' }
  | { kind: 'edit'; focusId?: string; addNew?: boolean };

export default function ProductsPage() {
  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const { data, error, isLoading, mutate } = useSWR<Product[]>('/api/products', fetcher);

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  if (mode.kind === 'edit') {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">
            {mode.addNew ? 'Tambah Produk' : 'Edit Inventory'}
          </h1>
          <p className="text-sm text-slate-500">
            Double-click sel untuk edit. Ctrl+S simpan · Ctrl+Z undo · Del hapus baris.
          </p>
        </header>

        <div className="flex-1 min-h-0">
          <SpreadsheetEditor<Product>
            columns={columns}
            initialRows={data}
            autoAddRow={mode.addNew}
            focusRowId={mode.focusId}
            onClose={() => setMode({ kind: 'view' })}
            onRowTemplate={() => ({
              sku: '',
              name: '',
              category: null,
              stock: 0,
              price: 0,
              note: null,
            })}
            onSave={async ({ upserts, deletes }) => {
              await postJSON('/api/products/batch', { upserts, deletes });
              await mutate();
            }}
          />
        </div>
      </div>
    );
  }

  const filtered = data.filter((p) => {
    if (category !== 'all' && p.category !== category) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!p.name.toLowerCase().includes(s) && !p.sku.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <div className="flex items-center gap-2">
          <input
            placeholder="Cari SKU / nama…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-1.5 bg-white text-sm w-56"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border rounded px-3 py-1.5 bg-white text-sm"
          >
            <option value="all">Semua Kategori</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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
            + Tambah Produk
          </button>
        </div>
      </header>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Nama Produk</th>
              <th className="px-4 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3 font-medium text-right">Stok</th>
              <th className="px-4 py-3 font-medium text-right">Harga</th>
              <th className="px-4 py-3 font-medium">Catatan</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                {data.length === 0 ? 'Belum ada produk.' : 'Tidak ada hasil untuk filter saat ini.'}
              </td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50 group">
                <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3">
                  {p.category ? (
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">{p.category}</span>
                  ) : <span className="text-slate-400">-</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <StockBadge stock={p.stock} />
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatRupiah(Number(p.price))}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{p.note ?? '-'}</td>
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

      <div className="text-xs text-slate-500">
        Menampilkan {filtered.length} dari {data.length} produk
      </div>
    </div>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold">Habis</span>;
  if (stock <= 10) return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold">{stock}</span>;
  return <span className="font-medium">{stock}</span>;
}

function EditIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

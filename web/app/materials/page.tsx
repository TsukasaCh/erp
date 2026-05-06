'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { fetcher, formatRupiah, postJSON } from '@/lib/api';
import { SpreadsheetEditor, type ColumnDef } from '@/components/SpreadsheetEditor';
import { matchText } from '@/lib/search';

interface Material {
  id?: string;
  code: string;
  name: string;
  category?: string | null;
  unit: string;
  stock: number;
  price: number;
  supplier?: string | null;
  note?: string | null;
  updatedAt?: string;
  _localId?: string;
  _dirty?: boolean;
  _new?: boolean;
  _deleted?: boolean;
  [k: string]: unknown;
}

interface Supplier {
  id: string;
  storeName: string;
}

interface MaterialCategory {
  id: string;
  name: string;
}

const UNITS = ['pcs', 'batang', 'kg', 'm', 'm²', 'lembar', 'roll', 'box', 'set'];

type Mode =
  | { kind: 'view' }
  | { kind: 'edit'; focusId?: string; addNew?: boolean };

export default function MaterialsPage() {
  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const { data, error, isLoading, mutate } = useSWR<Material[]>('/api/materials', fetcher);
  const { data: suppliers } = useSWR<Supplier[]>('/api/suppliers', fetcher);
  const { data: categoriesData } = useSWR<MaterialCategory[]>('/api/material-categories', fetcher);
  const CATEGORIES = (categoriesData ?? []).map((c) => c.name);

  // Editor columns: NO stock here — stock dikelola di Inventory.
  // Master Data Bahan = template/katalog bahan baku (kode, nama, satuan, harga, supplier).
  const columns: ColumnDef<Material>[] = [
    { key: 'code', label: 'Kode', type: 'text', width: 140 },
    { key: 'name', label: 'Nama Bahan', type: 'text', width: 260 },
    { key: 'category', label: 'Kategori', type: 'select', options: CATEGORIES, width: 140 },
    { key: 'unit', label: 'Satuan', type: 'select', options: UNITS, width: 100 },
    {
      key: 'price', label: 'Harga Beli', type: 'number', width: 140, align: 'right',
      format: (v) => v == null ? '' : `Rp ${Number(v).toLocaleString('id-ID')}`,
    },
    {
      key: 'supplier',
      label: 'Supplier Default',
      type: 'select',
      width: 200,
      options: suppliers?.map((s) => s.storeName) ?? [],
    },
    { key: 'note', label: 'Catatan', type: 'text', width: 240 },
  ];

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  if (mode.kind === 'edit') {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">
            {mode.addNew ? 'Tambah Bahan Baku' : 'Edit Master Bahan'}
          </h1>
          <p className="text-sm text-slate-500">
            Master Data Bahan = template/katalog. Stok dikelola di halaman <span className="font-medium">Inventory</span>.
          </p>
        </header>

        <div className="flex-1 min-h-0">
          <SpreadsheetEditor<Material>
            columns={columns}
            initialRows={data}
            autoAddRow={mode.addNew}
            focusRowId={mode.focusId}
            onClose={() => setMode({ kind: 'view' })}
            onRowTemplate={() => ({
              code: '',
              name: '',
              category: null,
              unit: 'pcs',
              stock: 0, // tetap dikirim sebagai 0; tidak diedit user
              price: 0,
              supplier: null,
              note: null,
            })}
            onSave={async ({ upserts, deletes }) => {
              await postJSON('/api/materials/batch', { upserts, deletes });
              await mutate();
            }}
          />
        </div>
      </div>
    );
  }

  const filtered = data.filter((m) => {
    if (category !== 'all' && m.category !== category) return false;
    if (search) {
      return matchText(m, search, ['code', 'name', 'category', 'unit', 'supplier', 'note', 'price']);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Master Data Bahan</h1>
          <p className="text-sm text-slate-500 mt-1">
            Katalog/template bahan baku. Stok aktual dilacak di halaman{' '}
            <a href="/material-usage" className="text-teal-600 hover:underline font-medium">Inventory</a>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="Cari: kode / nama / kategori / supplier / harga…"
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
            + Tambah Bahan
          </button>
        </div>
      </header>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Kode</th>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3 font-medium">Satuan</th>
              <th className="px-4 py-3 font-medium text-right">Harga Beli</th>
              <th className="px-4 py-3 font-medium">Supplier Default</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                {data.length === 0 ? 'Belum ada bahan. Klik "+ Tambah Bahan" untuk mulai.' : 'Tidak ada hasil.'}
              </td></tr>
            )}
            {filtered.map((m) => (
              <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50 group">
                <td className="px-4 py-3 font-mono text-xs">{m.code}</td>
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3">
                  {m.category ? (
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">{m.category}</span>
                  ) : <span className="text-slate-400">-</span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{m.unit}</td>
                <td className="px-4 py-3 text-right">{formatRupiah(Number(m.price))}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{m.supplier ?? '-'}</td>
                <td className="px-2 py-3">
                  <button
                    onClick={() => setMode({ kind: 'edit', focusId: m.id })}
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

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Menampilkan {filtered.length} dari {data.length} bahan</span>
        <a href="/material-usage" className="text-teal-600 hover:underline font-medium">
          Lihat stok aktual di Inventory →
        </a>
      </div>
    </div>
  );
}

function EditIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

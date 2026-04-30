'use client';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { fetcher, postJSON } from '@/lib/api';
import { SpreadsheetEditor, type ColumnDef, type SpreadsheetRow } from '@/components/SpreadsheetEditor';

interface Supplier extends SpreadsheetRow {
  id?: string;
  storeName: string;
  picName?: string | null;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
  updatedAt?: string;
}

const columns: ColumnDef<Supplier>[] = [
  { key: 'storeName', label: 'Nama Toko', type: 'text', width: 220 },
  { key: 'picName', label: 'Nama PIC', type: 'text', width: 180 },
  { key: 'phone', label: 'No. Telepon', type: 'text', width: 160 },
  { key: 'address', label: 'Alamat', type: 'text', width: 280 },
  { key: 'note', label: 'Catatan', type: 'text', width: 220 },
];

type Mode =
  | { kind: 'view' }
  | { kind: 'edit'; focusId?: string; addNew?: boolean };

export default function SuppliersPage() {
  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [search, setSearch] = useState('');
  const { data, error, isLoading, mutate } = useSWR<Supplier[]>('/api/suppliers', fetcher);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search) return data;
    const s = search.toLowerCase();
    return data.filter((x) =>
      x.storeName.toLowerCase().includes(s) ||
      (x.picName ?? '').toLowerCase().includes(s) ||
      (x.phone ?? '').toLowerCase().includes(s),
    );
  }, [data, search]);

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  if (mode.kind === 'edit') {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">
            {mode.addNew ? 'Tambah Supplier' : 'Edit Master Supplier'}
          </h1>
          <p className="text-sm text-slate-500">
            Double-click sel untuk edit. Ctrl+S simpan · Ctrl+Z undo · Del hapus baris.
          </p>
        </header>

        <div className="flex-1 min-h-0">
          <SpreadsheetEditor<Supplier>
            columns={columns}
            initialRows={data}
            autoAddRow={mode.addNew}
            focusRowId={mode.focusId}
            onClose={() => setMode({ kind: 'view' })}
            onRowTemplate={() => ({
              storeName: '',
              picName: null,
              phone: null,
              address: null,
              note: null,
            })}
            onSave={async ({ upserts, deletes }) => {
              await postJSON('/api/suppliers/batch', { upserts, deletes });
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
        <div>
          <h1 className="text-2xl font-bold">Master Supplier</h1>
          <p className="text-sm text-slate-500 mt-1">
            Daftar toko / supplier bahan baku. Dipakai sebagai pilihan di PO Pembelian.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="Cari toko / PIC / nomor…"
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
            + Tambah Supplier
          </button>
        </div>
      </header>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nama Toko</th>
              <th className="px-4 py-3 font-medium">PIC</th>
              <th className="px-4 py-3 font-medium">Telepon</th>
              <th className="px-4 py-3 font-medium">Alamat</th>
              <th className="px-4 py-3 font-medium">Catatan</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  {data.length === 0
                    ? 'Belum ada supplier. Klik "+ Tambah Supplier" untuk mulai.'
                    : 'Tidak ada hasil.'}
                </td>
              </tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50 group">
                <td className="px-4 py-3 font-medium">{s.storeName}</td>
                <td className="px-4 py-3">{s.picName ?? <span className="text-slate-400">-</span>}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {s.phone ? (
                    <a
                      href={`tel:${s.phone}`}
                      className="text-teal-600 hover:underline"
                    >
                      {s.phone}
                    </a>
                  ) : <span className="text-slate-400 font-sans">-</span>}
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs max-w-xs truncate" title={s.address ?? ''}>
                  {s.address ?? '-'}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate" title={s.note ?? ''}>
                  {s.note ?? '-'}
                </td>
                <td className="px-2 py-3">
                  <button
                    onClick={() => setMode({ kind: 'edit', focusId: s.id })}
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
        Menampilkan {filtered.length} dari {data.length} supplier
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

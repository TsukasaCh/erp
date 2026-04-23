'use client';
import useSWR from 'swr';
import { fetcher, postJSON } from '@/lib/api';
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

export default function ProductsPage() {
  const { data, error, isLoading, mutate } = useSWR<Product[]>('/api/products', fetcher);

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="text-sm text-slate-500">
          Edit langsung seperti Excel. Double-click untuk edit. Ctrl+S untuk simpan, Ctrl+Z untuk undo, Del untuk hapus baris terpilih.
        </p>
      </header>

      <div className="flex-1 min-h-0">
        <SpreadsheetEditor<Product>
          columns={columns}
          initialRows={data}
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

'use client';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { fetcher, formatRupiah, postJSON } from '@/lib/api';
import { SearchSelect, type SearchSelectOption } from '@/components/SearchSelect';

interface ProductCategory {
  id: string;
  name: string;
  description?: string | null;
  _count?: { products: number };
}

interface Product {
  id?: string;
  sku: string;
  name: string;
  categoryId?: string | null;
  category?: ProductCategory | null;
  stock: number;
  price: number;
  note?: string | null;
  updatedAt?: string;
  [k: string]: unknown;
}

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const { data, error, isLoading, mutate } = useSWR<Product[]>('/api/products', fetcher);
  const { data: categories, mutate: mutateCategories } = useSWR<ProductCategory[]>('/api/product-categories', fetcher);

  const categoryOptions: SearchSelectOption[] = useMemo(() => {
    if (!categories) return [];
    return categories.map((c) => ({
      value: c.id,
      label: c.name,
    }));
  }, [categories]);

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  const filtered = data.filter((p) => {
    if (categoryFilter !== 'all') {
      if (!p.category || p.category.id !== categoryFilter) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      if (!p.name.toLowerCase().includes(s) && !p.sku.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const handleNew = () => {
    setEditingProduct({
      sku: '',
      name: '',
      categoryId: null,
      stock: 0,
      price: 0,
      note: null,
    });
    setShowForm(true);
  };

  const handleEdit = (p: Product) => {
    setEditingProduct({ ...p, categoryId: p.category?.id ?? p.categoryId ?? null });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!editingProduct || !editingProduct.sku || !editingProduct.name) return;
    const payload = {
      upserts: [{
        id: editingProduct.id,
        sku: editingProduct.sku,
        name: editingProduct.name,
        categoryId: editingProduct.categoryId || null,
        stock: Number(editingProduct.stock ?? 0),
        price: Number(editingProduct.price ?? 0),
        note: editingProduct.note,
      }],
      deletes: [] as string[],
    };
    await postJSON('/api/products/batch', payload);
    await mutate();
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleDelete = async () => {
    if (!editingProduct?.id) return;
    if (!confirm('Hapus produk ini?')) return;
    await postJSON('/api/products/batch', { upserts: [], deletes: [editingProduct.id] });
    await mutate();
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await postJSON('/api/product-categories/batch', {
      upserts: [{ name: newCategoryName.trim() }],
      deletes: [],
    });
    await mutateCategories();
    setNewCategoryName('');
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Hapus kategori ini? Produk dengan kategori ini akan kehilangan kategorinya.')) return;
    await postJSON('/api/product-categories/batch', {
      upserts: [],
      deletes: [id],
    });
    await mutateCategories();
  };

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
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border rounded px-3 py-1.5 bg-white text-sm"
          >
            <option value="all">Semua Kategori</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={() => setShowCategoryManager(true)}
            className="px-3 py-1.5 border border-slate-300 rounded text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5"
            title="Kelola Kategori"
          >
            <TagIcon className="w-4 h-4" /> Kategori
          </button>
          <button
            onClick={handleNew}
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
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">{p.category.name}</span>
                  ) : <span className="text-slate-400">-</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <StockBadge stock={p.stock} />
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatRupiah(Number(p.price))}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{p.note ?? '-'}</td>
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

      <div className="text-xs text-slate-500">
        Menampilkan {filtered.length} dari {data.length} produk
      </div>

      {/* Product Form Modal */}
      {showForm && editingProduct && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowForm(false); setEditingProduct(null); }}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold">{editingProduct.id ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
              <button onClick={() => { setShowForm(false); setEditingProduct(null); }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="SKU">
                <input
                  value={editingProduct.sku}
                  onChange={(e) => setEditingProduct((p) => ({ ...p!, sku: e.target.value }))}
                  placeholder="mis. ALU-SLIDE-3M"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Nama Produk">
                <input
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct((p) => ({ ...p!, name: e.target.value }))}
                  placeholder="mis. Aluminium Sliding Door 3m"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Kategori">
                <SearchSelect
                  options={categoryOptions}
                  value={editingProduct.categoryId}
                  onChange={(val) => setEditingProduct((p) => ({ ...p!, categoryId: val || null }))}
                  placeholder="Pilih kategori..."
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Stok">
                  <input
                    type="number"
                    min={0}
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct((p) => ({ ...p!, stock: Number(e.target.value) || 0 }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Harga">
                  <input
                    type="number"
                    min={0}
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct((p) => ({ ...p!, price: Number(e.target.value) || 0 }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
              </div>
              <Field label="Catatan">
                <textarea
                  rows={2}
                  value={editingProduct.note ?? ''}
                  onChange={(e) => setEditingProduct((p) => ({ ...p!, note: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                {editingProduct.id && (
                  <button onClick={handleDelete} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded">
                    Hapus
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowForm(false); setEditingProduct(null); }} className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-white">Batal</button>
                <button
                  onClick={handleSave}
                  disabled={!editingProduct.sku || !editingProduct.name}
                  className="px-4 py-1.5 text-sm bg-slate-900 text-white rounded font-semibold hover:bg-slate-700 disabled:opacity-40"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCategoryManager(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold">Master Kategori Produk</h3>
              <button onClick={() => setShowCategoryManager(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nama kategori baru…"
                  className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
                />
                <button
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                  className="px-3 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-700 disabled:opacity-40"
                >
                  Tambah
                </button>
              </div>
              <div className="divide-y divide-slate-100 max-h-60 overflow-auto">
                {(!categories || categories.length === 0) && (
                  <div className="py-4 text-center text-slate-400 text-sm">Belum ada kategori</div>
                )}
                {categories?.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 px-1 group">
                    <div>
                      <span className="text-sm font-medium text-slate-800">{c.name}</span>
                      {c._count && (
                        <span className="ml-2 text-xs text-slate-400">({c._count.products} produk)</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 p-1 rounded text-xs transition-opacity"
                      title="Hapus"
                    >
                      ✕
                    </button>
                  </div>
                ))}
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

function TagIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <path d="M7 7h.01" />
    </svg>
  );
}

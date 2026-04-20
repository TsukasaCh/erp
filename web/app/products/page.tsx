'use client';
import useSWR, { mutate } from 'swr';
import { useState } from 'react';
import { fetcher, formatRupiah, patchJSON, postJSON } from '@/lib/api';

interface PlatformSku {
  id: string;
  platform: string;
  externalSku: string;
  externalItemId: string | null;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  stock: number;
  price: string;
  platformSkus: PlatformSku[];
}

export default function ProductsPage() {
  const { data, error, isLoading } = useSWR<Product[]>('/api/products', fetcher);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-4 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-700"
        >
          {showForm ? 'Tutup' : '+ Produk Baru'}
        </button>
      </header>

      {showForm && <NewProductForm onDone={() => { setShowForm(false); mutate('/api/products'); }} />}

      {error && <div className="text-red-600">Error: {String(error)}</div>}
      {isLoading && <div className="text-slate-500">Loading…</div>}

      {data && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Mapping</th>
                <th className="px-4 py-3 font-medium text-right">Harga</th>
                <th className="px-4 py-3 font-medium text-right">Stok</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Belum ada produk.</td></tr>
              )}
              {data.map((p) => (
                <ProductRow key={p.id} product={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProductRow({ product }: { product: Product }) {
  const [stock, setStock] = useState(product.stock);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await patchJSON(`/api/products/${product.id}/stock`, { stock });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      mutate('/api/products');
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3 font-mono text-xs">{product.sku}</td>
      <td className="px-4 py-3">{product.name}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {product.platformSkus.length === 0 && <span className="text-slate-400 text-xs">no mapping</span>}
          {product.platformSkus.map((m) => (
            <span
              key={m.id}
              className={`px-2 py-0.5 rounded text-xs ${
                m.platform === 'shopee' ? 'bg-orange-100 text-orange-700' : 'bg-slate-900 text-white'
              }`}
            >
              {m.platform}: {m.externalSku}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-right">{formatRupiah(Number(product.price))}</td>
      <td className="px-4 py-3 text-right">
        <input
          type="number"
          value={stock}
          onChange={(e) => setStock(Number(e.target.value))}
          className="w-20 border rounded px-2 py-1 text-right"
        />
      </td>
      <td className="px-4 py-3">
        <button
          onClick={save}
          disabled={saving || stock === product.stock}
          className="px-3 py-1 bg-orange-500 text-white rounded text-xs disabled:opacity-40"
        >
          {saving ? '...' : saved ? '✓' : 'Sync'}
        </button>
      </td>
    </tr>
  );
}

function NewProductForm({ onDone }: { onDone: () => void }) {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [stock, setStock] = useState(0);
  const [price, setPrice] = useState(0);
  const [shopeeSku, setShopeeSku] = useState('');
  const [shopeeItemId, setShopeeItemId] = useState('');
  const [tiktokSku, setTiktokSku] = useState('');
  const [tiktokItemId, setTiktokItemId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const platformSkus = [];
      if (shopeeSku) platformSkus.push({ platform: 'shopee', externalSku: shopeeSku, externalItemId: shopeeItemId || undefined });
      if (tiktokSku) platformSkus.push({ platform: 'tiktok', externalSku: tiktokSku, externalItemId: tiktokItemId || undefined });
      await postJSON('/api/products', { sku, name, stock, price, platformSkus });
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  const input = 'border border-slate-300 rounded px-3 py-1.5 w-full text-sm';
  return (
    <form onSubmit={submit} className="bg-white rounded-lg border border-slate-200 p-6 grid grid-cols-2 gap-4">
      <Field label="Master SKU"><input required value={sku} onChange={(e) => setSku(e.target.value)} className={input} /></Field>
      <Field label="Nama Produk"><input required value={name} onChange={(e) => setName(e.target.value)} className={input} /></Field>
      <Field label="Stok"><input required type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} className={input} /></Field>
      <Field label="Harga"><input required type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className={input} /></Field>
      <Field label="Shopee SKU"><input value={shopeeSku} onChange={(e) => setShopeeSku(e.target.value)} className={input} /></Field>
      <Field label="Shopee Item ID"><input value={shopeeItemId} onChange={(e) => setShopeeItemId(e.target.value)} className={input} /></Field>
      <Field label="TikTok SKU"><input value={tiktokSku} onChange={(e) => setTiktokSku(e.target.value)} className={input} /></Field>
      <Field label="TikTok Product ID"><input value={tiktokItemId} onChange={(e) => setTiktokItemId(e.target.value)} className={input} /></Field>
      <div className="col-span-2 flex justify-end">
        <button type="submit" disabled={submitting} className="px-5 py-2 bg-slate-900 text-white rounded text-sm font-medium disabled:opacity-40">
          {submitting ? 'Saving…' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

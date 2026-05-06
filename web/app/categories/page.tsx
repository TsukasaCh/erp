'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { fetcher, postJSON, deleteRequest } from '@/lib/api';
import { hasPermission } from '@/lib/auth';

interface Category {
  id: string;
  name: string;
  description?: string | null;
  _count?: { products?: number; materials?: number };
}

type Tab = 'product' | 'material';

export default function CategoriesPage() {
  const [tab, setTab] = useState<Tab>('product');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Kategori</h1>
        <p className="text-sm text-slate-500 mt-1">
          Kelola kategori untuk Inventory Product dan Inventory Bahan. Tambah/edit/hapus
          kategori — perubahan langsung tampil sebagai pilihan di halaman terkait.
        </p>
      </header>

      <div className="flex gap-1 border-b border-slate-200">
        <TabButton active={tab === 'product'} onClick={() => setTab('product')}>
          Kategori Produk
        </TabButton>
        <TabButton active={tab === 'material'} onClick={() => setTab('material')}>
          Kategori Bahan
        </TabButton>
      </div>

      {tab === 'product' ? (
        <CategoryManager
          title="Kategori Produk Jadi"
          subtitle="Dipakai di halaman Inventory Product (Jendela, Pintu, Kusen, dll)."
          listEndpoint="/api/product-categories"
          batchEndpoint="/api/product-categories/batch"
          countKey="products"
          countLabel="produk"
          writePermission="products:write"
        />
      ) : (
        <CategoryManager
          title="Kategori Bahan Baku"
          subtitle="Dipakai di halaman Master Data Bahan / Inventory Bahan (Aluminium, Kaca, Handle, dll)."
          listEndpoint="/api/material-categories"
          batchEndpoint="/api/material-categories/batch"
          countKey="materials"
          countLabel="bahan"
          writePermission="materials:write"
        />
      )}
    </div>
  );
}

function CategoryManager({
  title, subtitle, listEndpoint, batchEndpoint, countKey, countLabel, writePermission,
}: {
  title: string;
  subtitle: string;
  listEndpoint: string;
  batchEndpoint: string;
  countKey: 'products' | 'materials';
  countLabel: string;
  writePermission: string;
}) {
  const { data, error, isLoading, mutate } = useSWR<Category[]>(listEndpoint, fetcher);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canWrite = hasPermission(writePermission);

  const filtered = (data ?? []).filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) || (c.description ?? '').toLowerCase().includes(s);
  });

  const openNew = () => { setEditing({ name: '', description: '' }); setErrorMsg(null); };
  const openEdit = (c: Category) => { setEditing({ ...c }); setErrorMsg(null); };

  const save = async () => {
    if (!editing?.name?.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await postJSON(batchEndpoint, {
        upserts: [{
          id: editing.id,
          name: editing.name.trim(),
          description: editing.description?.trim() || null,
        }],
        deletes: [] as string[],
      });
      await mutate();
      setEditing(null);
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Category) => {
    const used = c._count?.[countKey] ?? 0;
    if (used > 0) {
      alert(`Tidak bisa hapus: masih ada ${used} ${countLabel} yang pakai kategori "${c.name}". Pindahkan dulu ke kategori lain.`);
      return;
    }
    if (!confirm(`Hapus kategori "${c.name}"?`)) return;
    try {
      await deleteRequest(`${listEndpoint}/${c.id}`);
      await mutate();
    } catch (e) {
      alert(`Gagal hapus: ${(e as Error).message}`);
    }
  };

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <input
          placeholder="Cari nama kategori…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-slate-300 rounded px-3 py-1.5 bg-white text-sm w-72"
        />
        {canWrite && (
          <button
            onClick={openNew}
            className="px-4 py-1.5 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-700"
          >
            + Tambah Kategori
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nama Kategori</th>
              <th className="px-4 py-3 font-medium">Deskripsi</th>
              <th className="px-4 py-3 font-medium text-right">Dipakai Oleh</th>
              <th className="px-4 py-3 w-32" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                {data.length === 0 ? 'Belum ada kategori. Klik "+ Tambah Kategori" untuk mulai.' : 'Tidak ada hasil.'}
              </td></tr>
            )}
            {filtered.map((c) => {
              const used = c._count?.[countKey] ?? 0;
              return (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 group">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{c.description || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    {used > 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-teal-100 text-teal-700 font-medium">
                        {used} {countLabel}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">belum dipakai</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right">
                    {canWrite && (
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 justify-end transition-opacity">
                        <button
                          onClick={() => openEdit(c)}
                          className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-white"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => remove(c)}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                        >
                          Hapus
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        {filtered.length} dari {data.length} kategori
      </p>

      {/* Edit/Add modal */}
      {editing && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold">{editing.id ? 'Edit Kategori' : 'Tambah Kategori'}</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              {errorMsg && (
                <div className="p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">
                  {errorMsg}
                </div>
              )}
              <Field label="Nama Kategori">
                <input
                  value={editing.name ?? ''}
                  onChange={(e) => setEditing((p) => ({ ...p!, name: e.target.value }))}
                  placeholder="mis. Aluminium"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  autoFocus
                />
              </Field>
              <Field label="Deskripsi (opsional)">
                <textarea
                  rows={2}
                  value={editing.description ?? ''}
                  onChange={(e) => setEditing((p) => ({ ...p!, description: e.target.value }))}
                  placeholder="Catatan singkat"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-white"
              >
                Batal
              </button>
              <button
                onClick={save}
                disabled={saving || !editing.name?.trim()}
                className="px-4 py-1.5 text-sm bg-slate-900 text-white rounded font-semibold hover:bg-slate-700 disabled:opacity-40"
              >
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
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

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        active
          ? 'border-teal-500 text-teal-600'
          : 'border-transparent text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

'use client';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { fetcher, formatRupiah, postJSON, deleteRequest } from '@/lib/api';
import { SearchSelect, type SearchSelectOption } from '@/components/SearchSelect';

interface Material {
  id: string;
  code: string;
  name: string;
  unit: string;
  stock: number;
  price: number;
}

interface MaterialUsage {
  id: string;
  materialId: string;
  quantity: number;
  usageDate: string;
  purpose?: string | null;
  note?: string | null;
  material: Material;
  createdAt: string;
}

interface ListResponse {
  page: number;
  pageSize: number;
  total: number;
  items: MaterialUsage[];
}

export default function MaterialUsagePage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    materialId: '',
    quantity: 1,
    usageDate: new Date().toISOString().slice(0, 10),
    purpose: '',
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR<ListResponse>(
    '/api/material-usage?pageSize=200',
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

  const selectedMaterial = useMemo(() => {
    if (!materials || !form.materialId) return null;
    return materials.find((m) => m.id === form.materialId) ?? null;
  }, [materials, form.materialId]);

  const handleSave = async () => {
    if (!form.materialId || form.quantity <= 0) return;
    setSaving(true);
    setError(null);
    try {
      await postJSON('/api/material-usage', {
        materialId: form.materialId,
        quantity: form.quantity,
        usageDate: new Date(form.usageDate).toISOString(),
        purpose: form.purpose || null,
        note: form.note || null,
      });
      await mutate();
      setShowForm(false);
      setForm({
        materialId: '',
        quantity: 1,
        usageDate: new Date().toISOString().slice(0, 10),
        purpose: '',
        note: '',
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus catatan ini? Stok bahan akan dikembalikan.')) return;
    await deleteRequest(`/api/material-usage/${id}`);
    await mutate();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Penggunaan Bahan</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pencatatan pengeluaran/penggunaan bahan baku. Stok otomatis berkurang saat dicatat.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-1.5 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-700"
        >
          + Catat Pengeluaran
        </button>
      </header>

      {/* Summary cards */}
      {materials && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Total Jenis Bahan</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{materials.length}</div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Bahan Stok Habis</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {materials.filter((m) => m.stock <= 0).length}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Total Pengeluaran</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{data?.total ?? 0} catatan</div>
          </div>
        </div>
      )}

      {/* Usage table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Tanggal</th>
              <th className="px-4 py-3 font-medium">Bahan</th>
              <th className="px-4 py-3 font-medium text-right">Qty Keluar</th>
              <th className="px-4 py-3 font-medium">Keperluan</th>
              <th className="px-4 py-3 font-medium">Catatan</th>
              <th className="px-4 py-3 font-medium text-right">Sisa Stok</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Loading…</td></tr>
            )}
            {!isLoading && (!data || data.items.length === 0) && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                Belum ada catatan pengeluaran bahan. Klik &ldquo;+ Catat Pengeluaran&rdquo; untuk mulai.
              </td></tr>
            )}
            {data?.items.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50 group">
                <td className="px-4 py-3 text-xs text-slate-600">
                  {new Date(u.usageDate).toLocaleDateString('id-ID')}
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-900 font-medium">{u.material.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{u.material.code}</div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-red-600 font-semibold">-{u.quantity}</span>
                  <span className="text-xs text-slate-400 ml-1">{u.material.unit}</span>
                </td>
                <td className="px-4 py-3 text-slate-700">{u.purpose ?? '-'}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{u.note ?? '-'}</td>
                <td className="px-4 py-3 text-right">
                  <StockBadge stock={u.material.stock} />
                </td>
                <td className="px-2 py-3">
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 rounded transition-opacity text-red-500"
                    title="Hapus & kembalikan stok"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Usage Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowForm(false); setError(null); }}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold">Catat Pengeluaran Bahan</h3>
              <button onClick={() => { setShowForm(false); setError(null); }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              {error && (
                <div className="p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Field label="Pilih Bahan">
                <SearchSelect
                  options={materialOptions}
                  value={form.materialId}
                  onChange={(val) => setForm((f) => ({ ...f, materialId: val }))}
                  placeholder="Pilih bahan dari master data..."
                />
                {selectedMaterial && (
                  <div className="mt-1 text-xs text-slate-500">
                    Stok saat ini: <span className="font-semibold">{selectedMaterial.stock} {selectedMaterial.unit}</span>
                  </div>
                )}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Qty Keluar">
                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) || 0 }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                  {selectedMaterial && form.quantity > selectedMaterial.stock && (
                    <div className="mt-1 text-xs text-red-600 font-medium">
                      ⚠ Melebihi stok!
                    </div>
                  )}
                </Field>
                <Field label="Tanggal">
                  <input
                    type="date"
                    value={form.usageDate}
                    onChange={(e) => setForm((f) => ({ ...f, usageDate: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label="Keperluan / Tujuan">
                <input
                  value={form.purpose}
                  onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                  placeholder="mis. Produksi Jendela Casement, Proyek X"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Catatan">
                <textarea
                  rows={2}
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => { setShowForm(false); setError(null); }}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-white"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.materialId || form.quantity <= 0}
                className="px-4 py-1.5 text-sm bg-slate-900 text-white rounded font-semibold hover:bg-slate-700 disabled:opacity-40"
              >
                {saving ? 'Menyimpan…' : 'Simpan & Kurangi Stok'}
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

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold">Habis</span>;
  if (stock <= 10) return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold">{stock}</span>;
  return <span className="font-medium">{stock}</span>;
}

function TrashIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

'use client';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { fetcher, formatRupiah, postJSON, deleteRequest, patchJSON } from '@/lib/api';
import { SearchSelect, type SearchSelectOption } from '@/components/SearchSelect';

interface Material {
  id: string;
  code: string;
  name: string;
  category?: string | null;
  unit: string;
  stock: number;
  price: number;
  supplier?: string | null;
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

type Tab = 'stock' | 'usage';

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>('stock');
  const [stockSearch, setStockSearch] = useState('');

  const [showUsageForm, setShowUsageForm] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState<Material | null>(null);

  const [usageForm, setUsageForm] = useState({
    materialId: '',
    quantity: 1,
    usageDate: new Date().toISOString().slice(0, 10),
    purpose: '',
    note: '',
  });
  const [adjustForm, setAdjustForm] = useState({ stock: 0, reason: '' });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: usages, isLoading: loadingUsages, mutate: mutateUsages } = useSWR<ListResponse>(
    '/api/material-usage?pageSize=200',
    fetcher,
  );
  const { data: materials, mutate: mutateMaterials } = useSWR<Material[]>('/api/materials', fetcher);

  const materialOptions: SearchSelectOption[] = useMemo(() => {
    if (!materials) return [];
    return materials.map((m) => ({
      value: m.id,
      label: `${m.code} - ${m.name} (Stok: ${m.stock} ${m.unit})`,
      data: m as unknown as Record<string, unknown>,
    }));
  }, [materials]);

  const selectedUsageMaterial = useMemo(() => {
    if (!materials || !usageForm.materialId) return null;
    return materials.find((m) => m.id === usageForm.materialId) ?? null;
  }, [materials, usageForm.materialId]);

  const filteredMaterials = useMemo(() => {
    if (!materials) return [];
    if (!stockSearch) return materials;
    const s = stockSearch.toLowerCase();
    return materials.filter((m) =>
      m.code.toLowerCase().includes(s) ||
      m.name.toLowerCase().includes(s) ||
      (m.category ?? '').toLowerCase().includes(s),
    );
  }, [materials, stockSearch]);

  // Aggregate stats
  const totalValue = useMemo(() => {
    if (!materials) return 0;
    return materials.reduce((sum, m) => sum + Number(m.stock) * Number(m.price), 0);
  }, [materials]);
  const lowStock = materials?.filter((m) => m.stock > 0 && m.stock <= 10).length ?? 0;
  const outOfStock = materials?.filter((m) => m.stock <= 0).length ?? 0;

  const saveUsage = async () => {
    if (!usageForm.materialId || usageForm.quantity <= 0) return;
    setSaving(true);
    setError(null);
    try {
      await postJSON('/api/material-usage', {
        materialId: usageForm.materialId,
        quantity: usageForm.quantity,
        usageDate: new Date(usageForm.usageDate).toISOString(),
        purpose: usageForm.purpose || null,
        note: usageForm.note || null,
      });
      await Promise.all([mutateUsages(), mutateMaterials()]);
      setShowUsageForm(false);
      setUsageForm({
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

  const deleteUsage = async (id: string) => {
    if (!confirm('Hapus catatan ini? Stok bahan akan dikembalikan.')) return;
    await deleteRequest(`/api/material-usage/${id}`);
    await Promise.all([mutateUsages(), mutateMaterials()]);
  };

  const openAdjust = (m: Material) => {
    setAdjustForm({ stock: m.stock, reason: '' });
    setShowAdjustForm(m);
    setError(null);
  };

  const saveAdjust = async () => {
    if (!showAdjustForm) return;
    setSaving(true);
    setError(null);
    try {
      await patchJSON(`/api/materials/${showAdjustForm.id}/stock`, {
        stock: adjustForm.stock,
        reason: adjustForm.reason || undefined,
      });
      await mutateMaterials();
      setShowAdjustForm(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Stok bahan baku aktual. Bertambah otomatis dari PO Pembelian (status &quot;Diterima&quot;), berkurang
            otomatis dari Pengeluaran.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setError(null); setShowUsageForm(true); }}
            className="px-4 py-1.5 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-700"
          >
            + Catat Pengeluaran
          </button>
        </div>
      </header>

      {/* Summary cards */}
      {materials && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <SummaryCard label="Total Jenis Bahan" value={String(materials.length)} />
          <SummaryCard label="Bahan Stok Habis" value={String(outOfStock)} tint="red" />
          <SummaryCard label="Bahan Stok Menipis" value={String(lowStock)} tint="amber" />
          <SummaryCard label="Total Nilai Stok" value={formatRupiah(totalValue)} tint="emerald" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <TabButton active={tab === 'stock'} onClick={() => setTab('stock')}>
          Stok Saat Ini
        </TabButton>
        <TabButton active={tab === 'usage'} onClick={() => setTab('usage')}>
          Riwayat Pengeluaran
        </TabButton>
      </div>

      {/* === TAB: STOK SAAT INI === */}
      {tab === 'stock' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              placeholder="Cari kode / nama / kategori…"
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
              className="border rounded px-3 py-1.5 bg-white text-sm w-72"
            />
            <span className="text-xs text-slate-500">
              {filteredMaterials.length} dari {materials?.length ?? 0} bahan
            </span>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Kode</th>
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium text-right">Stok</th>
                  <th className="px-4 py-3 font-medium">Satuan</th>
                  <th className="px-4 py-3 font-medium text-right">Harga Beli</th>
                  <th className="px-4 py-3 font-medium text-right">Nilai Stok</th>
                  <th className="px-4 py-3 w-32" />
                </tr>
              </thead>
              <tbody>
                {!materials && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Loading…</td></tr>
                )}
                {materials && filteredMaterials.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    {materials.length === 0
                      ? <>Belum ada bahan. Tambahkan dulu di <a href="/materials" className="text-teal-600 hover:underline">Master Data Bahan</a>.</>
                      : 'Tidak ada hasil.'}
                  </td></tr>
                )}
                {filteredMaterials.map((m) => {
                  const value = Number(m.stock) * Number(m.price);
                  return (
                    <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50 group">
                      <td className="px-4 py-3 font-mono text-xs">{m.code}</td>
                      <td className="px-4 py-3 font-medium">{m.name}</td>
                      <td className="px-4 py-3">
                        {m.category ? (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">{m.category}</span>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <StockBadge stock={Number(m.stock)} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.unit}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatRupiah(Number(m.price))}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatRupiah(value)}</td>
                      <td className="px-2 py-3 text-right">
                        <button
                          onClick={() => openAdjust(m)}
                          className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs border border-slate-300 rounded hover:bg-white transition-opacity"
                          title="Sesuaikan stok manual"
                        >
                          Sesuaikan
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">
            Stok bertambah otomatis saat PO Pembelian ditandai &quot;Diterima&quot;. Berkurang saat Pengeluaran dicatat.
            Tombol <span className="font-medium">Sesuaikan</span> dipakai untuk stok awal / koreksi manual.
          </p>
        </div>
      )}

      {/* === TAB: RIWAYAT PENGELUARAN === */}
      {tab === 'usage' && (
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
              {loadingUsages && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Loading…</td></tr>
              )}
              {!loadingUsages && (!usages || usages.items.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  Belum ada catatan pengeluaran bahan.
                </td></tr>
              )}
              {usages?.items.map((u) => (
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
                      onClick={() => deleteUsage(u.id)}
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
      )}

      {/* === MODAL: CATAT PENGELUARAN === */}
      {showUsageForm && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowUsageForm(false); setError(null); }}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold">Catat Pengeluaran Bahan</h3>
              <button onClick={() => { setShowUsageForm(false); setError(null); }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
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
                  value={usageForm.materialId}
                  onChange={(val) => setUsageForm((f) => ({ ...f, materialId: val }))}
                  placeholder="Pilih bahan dari master data..."
                />
                {selectedUsageMaterial && (
                  <div className="mt-1 text-xs text-slate-500">
                    Stok saat ini: <span className="font-semibold">{selectedUsageMaterial.stock} {selectedUsageMaterial.unit}</span>
                  </div>
                )}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Qty Keluar">
                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    value={usageForm.quantity}
                    onChange={(e) => setUsageForm((f) => ({ ...f, quantity: Number(e.target.value) || 0 }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                  {selectedUsageMaterial && usageForm.quantity > selectedUsageMaterial.stock && (
                    <div className="mt-1 text-xs text-red-600 font-medium">
                      ⚠ Melebihi stok!
                    </div>
                  )}
                </Field>
                <Field label="Tanggal">
                  <input
                    type="date"
                    value={usageForm.usageDate}
                    onChange={(e) => setUsageForm((f) => ({ ...f, usageDate: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label="Keperluan / Tujuan">
                <input
                  value={usageForm.purpose}
                  onChange={(e) => setUsageForm((f) => ({ ...f, purpose: e.target.value }))}
                  placeholder="mis. Produksi Jendela Casement, Proyek X"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Catatan">
                <textarea
                  rows={2}
                  value={usageForm.note}
                  onChange={(e) => setUsageForm((f) => ({ ...f, note: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => { setShowUsageForm(false); setError(null); }}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-white"
              >
                Batal
              </button>
              <button
                onClick={saveUsage}
                disabled={saving || !usageForm.materialId || usageForm.quantity <= 0}
                className="px-4 py-1.5 text-sm bg-slate-900 text-white rounded font-semibold hover:bg-slate-700 disabled:opacity-40"
              >
                {saving ? 'Menyimpan…' : 'Simpan & Kurangi Stok'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: SESUAIKAN STOK === */}
      {showAdjustForm && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowAdjustForm(null); setError(null); }}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold">Penyesuaian Stok</h3>
              <button onClick={() => { setShowAdjustForm(null); setError(null); }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              {error && (
                <div className="p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="bg-slate-50 rounded p-3">
                <div className="text-xs text-slate-500 uppercase tracking-wide">Bahan</div>
                <div className="font-medium">{showAdjustForm.name}</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">{showAdjustForm.code}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Stok saat ini: <span className="font-semibold">{showAdjustForm.stock} {showAdjustForm.unit}</span>
                </div>
              </div>

              <Field label={`Stok baru (${showAdjustForm.unit})`}>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={adjustForm.stock}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, stock: Number(e.target.value) || 0 }))}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-medium"
                  autoFocus
                />
                <div className="mt-1 text-xs text-slate-500">
                  Selisih:{' '}
                  <span className={`font-semibold ${
                    adjustForm.stock - showAdjustForm.stock > 0 ? 'text-emerald-600' :
                    adjustForm.stock - showAdjustForm.stock < 0 ? 'text-red-600' : 'text-slate-500'
                  }`}>
                    {adjustForm.stock - showAdjustForm.stock > 0 ? '+' : ''}
                    {(adjustForm.stock - showAdjustForm.stock).toLocaleString('id-ID')} {showAdjustForm.unit}
                  </span>
                </div>
              </Field>

              <Field label="Alasan / Keterangan (wajib)">
                <textarea
                  rows={2}
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="mis. Stok awal, koreksi setelah stok opname, kerusakan"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>

              <p className="text-xs text-slate-400">
                Penyesuaian dicatat di Audit Log.
              </p>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => { setShowAdjustForm(null); setError(null); }}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-white"
              >
                Batal
              </button>
              <button
                onClick={saveAdjust}
                disabled={saving || !adjustForm.reason.trim() || adjustForm.stock < 0}
                className="px-4 py-1.5 text-sm bg-slate-900 text-white rounded font-semibold hover:bg-slate-700 disabled:opacity-40"
              >
                {saving ? 'Menyimpan…' : 'Simpan Penyesuaian'}
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

function SummaryCard({ label, value, tint }: { label: string; value: string; tint?: 'red' | 'amber' | 'emerald' }) {
  const tintMap = {
    red: 'text-red-600',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
  };
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tint ? tintMap[tint] : 'text-slate-900'}`}>{value}</div>
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

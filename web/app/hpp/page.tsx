'use client';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { fetcher, formatRupiah } from '@/lib/api';

interface Material {
  id: string;
  code: string;
  name: string;
  unit: string;
  price: number;
  stock: number;
}

interface BomLine {
  id: string;
  materialId: string | null;
  materialCode: string;
  materialName: string;
  unit: string;
  qty: number;
  price: number; // per unit; auto-fill on pick but editable
}

interface OverheadLine {
  id: string;
  label: string;
  amount: number;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function HppPage() {
  const { data: materials, isLoading } = useSWR<Material[]>('/api/materials', fetcher);

  const [productName, setProductName] = useState('');
  const [qtyProduced, setQtyProduced] = useState(1);
  const [markup, setMarkup] = useState(30);

  const [bom, setBom] = useState<BomLine[]>([
    { id: uid(), materialId: null, materialCode: '', materialName: '', unit: 'pcs', qty: 1, price: 0 },
  ]);
  const [overhead, setOverhead] = useState<OverheadLine[]>([
    { id: uid(), label: 'Tenaga Kerja', amount: 0 },
    { id: uid(), label: 'Listrik & Utilitas', amount: 0 },
  ]);

  const addBom = () => setBom((b) => [...b, { id: uid(), materialId: null, materialCode: '', materialName: '', unit: 'pcs', qty: 1, price: 0 }]);
  const updateBom = (id: string, patch: Partial<BomLine>) =>
    setBom((b) => b.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeBom = (id: string) => setBom((b) => b.filter((l) => l.id !== id));

  const pickMaterial = (id: string, matId: string) => {
    const m = materials?.find((x) => x.id === matId);
    if (!m) return;
    updateBom(id, {
      materialId: m.id,
      materialCode: m.code,
      materialName: m.name,
      unit: m.unit,
      price: Number(m.price),
    });
  };

  const addOverhead = () => setOverhead((o) => [...o, { id: uid(), label: '', amount: 0 }]);
  const updateOverhead = (id: string, patch: Partial<OverheadLine>) =>
    setOverhead((o) => o.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeOverhead = (id: string) => setOverhead((o) => o.filter((l) => l.id !== id));

  const materialTotal = useMemo(() => bom.reduce((s, l) => s + Number(l.qty || 0) * Number(l.price || 0), 0), [bom]);
  const overheadTotal = useMemo(() => overhead.reduce((s, l) => s + Number(l.amount || 0), 0), [overhead]);
  const hppTotal = materialTotal + overheadTotal;
  const hppPerUnit = qtyProduced > 0 ? hppTotal / qtyProduced : 0;
  const suggestedPrice = hppPerUnit * (1 + markup / 100);

  return (
    <div className="space-y-6 pb-10">
      <header>
        <h1 className="text-2xl font-bold">Kalkulator HPP</h1>
        <p className="text-sm text-slate-500 mt-1">
          Hitung Harga Pokok Produksi dari bahan baku dan biaya overhead.
        </p>
      </header>

      {/* Product header card */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Nama Produk</label>
          <input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="mis. Jendela Casement 120x80"
            className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Jumlah Produksi</label>
          <input
            type="number"
            min={1}
            value={qtyProduced}
            onChange={(e) => setQtyProduced(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Markup Jual (%)</label>
          <input
            type="number"
            min={0}
            value={markup}
            onChange={(e) => setMarkup(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* BOM section */}
      <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="font-semibold text-slate-900">Bahan Baku (Bill of Materials)</h2>
            <p className="text-xs text-slate-500">Pilih bahan dari Master Data Bahan, masukkan qty terpakai.</p>
          </div>
          <button
            onClick={addBom}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-white"
          >
            + Tambah Baris
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-white text-left border-b border-slate-200">
            <tr>
              <th className="px-4 py-2 font-medium text-xs text-slate-500 uppercase tracking-wide w-72">Bahan</th>
              <th className="px-4 py-2 font-medium text-xs text-slate-500 uppercase tracking-wide text-right w-24">Qty</th>
              <th className="px-4 py-2 font-medium text-xs text-slate-500 uppercase tracking-wide w-20">Satuan</th>
              <th className="px-4 py-2 font-medium text-xs text-slate-500 uppercase tracking-wide text-right w-40">Harga/Unit</th>
              <th className="px-4 py-2 font-medium text-xs text-slate-500 uppercase tracking-wide text-right w-40">Subtotal</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {bom.map((line) => {
              const subtotal = Number(line.qty || 0) * Number(line.price || 0);
              return (
                <tr key={line.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <select
                      value={line.materialId ?? ''}
                      onChange={(e) => {
                        if (e.target.value === '') {
                          updateBom(line.id, { materialId: null, materialCode: '', materialName: '' });
                        } else {
                          pickMaterial(line.id, e.target.value);
                        }
                      }}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
                      disabled={isLoading}
                    >
                      <option value="">— Pilih bahan —</option>
                      {materials?.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.code} · {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      step="any"
                      value={line.qty}
                      onChange={(e) => updateBom(line.id, { qty: Number(e.target.value) || 0 })}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-right"
                    />
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{line.unit}</td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      step="any"
                      value={line.price}
                      onChange={(e) => updateBom(line.id, { price: Number(e.target.value) || 0 })}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-right"
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-medium">{formatRupiah(subtotal)}</td>
                  <td className="px-2 py-2">
                    <button
                      onClick={() => removeBom(line.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                      title="Hapus baris"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
            {bom.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-sm">
                  Belum ada bahan. Klik &quot;+ Tambah Baris&quot;.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-slate-50 border-t border-slate-200">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                Total Biaya Bahan
              </td>
              <td className="px-4 py-3 text-right font-semibold">{formatRupiah(materialTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Overhead section */}
      <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="font-semibold text-slate-900">Biaya Overhead</h2>
            <p className="text-xs text-slate-500">Tenaga kerja, listrik, sewa, biaya lain-lain untuk batch produksi ini.</p>
          </div>
          <button
            onClick={addOverhead}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-white"
          >
            + Tambah Biaya
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-white text-left border-b border-slate-200">
            <tr>
              <th className="px-4 py-2 font-medium text-xs text-slate-500 uppercase tracking-wide">Keterangan</th>
              <th className="px-4 py-2 font-medium text-xs text-slate-500 uppercase tracking-wide text-right w-48">Jumlah</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {overhead.map((line) => (
              <tr key={line.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <input
                    value={line.label}
                    onChange={(e) => updateOverhead(line.id, { label: e.target.value })}
                    placeholder="mis. Tenaga Kerja"
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    step="any"
                    value={line.amount}
                    onChange={(e) => updateOverhead(line.id, { amount: Number(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-right"
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    onClick={() => removeOverhead(line.id)}
                    className="text-slate-400 hover:text-red-600 p-1"
                    title="Hapus"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {overhead.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400 text-sm">
                  Belum ada overhead.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-slate-50 border-t border-slate-200">
            <tr>
              <td className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                Total Overhead
              </td>
              <td className="px-4 py-3 text-right font-semibold">{formatRupiah(overheadTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Summary card */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-lg p-6">
        <h2 className="font-semibold text-slate-200 uppercase tracking-wide text-xs mb-4">
          Ringkasan HPP {productName && `— ${productName}`}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryItem label="Biaya Bahan" value={formatRupiah(materialTotal)} />
          <SummaryItem label="Biaya Overhead" value={formatRupiah(overheadTotal)} />
          <SummaryItem label="Total HPP" value={formatRupiah(hppTotal)} big />
          <SummaryItem
            label={`HPP / Unit (${qtyProduced}×)`}
            value={formatRupiah(hppPerUnit)}
            big
            highlight
          />
        </div>
        <div className="mt-5 pt-4 border-t border-slate-700 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Saran Harga Jual (markup {markup}%)</div>
            <div className="text-2xl font-bold text-emerald-300 mt-1">{formatRupiah(suggestedPrice)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400 uppercase tracking-wide">Laba / Unit</div>
            <div className="text-lg font-semibold text-emerald-300 mt-1">
              {formatRupiah(suggestedPrice - hppPerUnit)}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryItem({ label, value, big, highlight }: {
  label: string; value: string; big?: boolean; highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      <div className={`mt-1 font-bold ${big ? 'text-xl' : 'text-base'} ${highlight ? 'text-teal-300' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}

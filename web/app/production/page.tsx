'use client';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { fetcher, postJSON } from '@/lib/api';

interface ProductionSchedule {
  id: string;
  scheduledAt: string;
  productSku?: string | null;
  productName: string;
  quantity: number;
  status: string;
  assignedTo?: string | null;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ListResponse { items: ProductionSchedule[] }

const STATUS_META: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  planned:     { label: 'Rencana',   dot: 'bg-slate-400',   bg: 'bg-slate-100',   text: 'text-slate-700' },
  'in-progress': { label: 'Proses',  dot: 'bg-amber-500',   bg: 'bg-amber-100',   text: 'text-amber-800' },
  done:        { label: 'Selesai',   dot: 'bg-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  cancelled:   { label: 'Batal',     dot: 'bg-slate-300',   bg: 'bg-slate-200',   text: 'text-slate-500' },
};
const STATUSES = Object.keys(STATUS_META);

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

/** Monday-start calendar: returns 42 dates covering the month view */
function monthGrid(cursor: Date): Date[] {
  const first = startOfMonth(cursor);
  // 0 = Sun, 1 = Mon, ... shift so Monday is column 0
  const dow = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - dow);
  const out: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d);
  }
  return out;
}

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function ProductionPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [editing, setEditing] = useState<Partial<ProductionSchedule> | null>(null);

  const from = ymd(startOfMonth(cursor));
  const to = ymd(endOfMonth(cursor));
  const { data, isLoading, mutate } = useSWR<ListResponse>(
    `/api/production?from=${from}&to=${to}`,
    fetcher,
  );

  const byDate = useMemo(() => {
    const map = new Map<string, ProductionSchedule[]>();
    if (!data) return map;
    for (const s of data.items) {
      const key = ymd(new Date(s.scheduledAt));
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [data]);

  const cells = monthGrid(cursor);
  const monthName = `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const todayStr = ymd(new Date());
  const currentMonth = cursor.getMonth();

  const openNew = (date: Date) => {
    const iso = new Date(date);
    iso.setHours(8, 0, 0, 0);
    setEditing({
      scheduledAt: iso.toISOString(),
      productName: '',
      quantity: 1,
      status: 'planned',
    });
  };

  const openEdit = (s: ProductionSchedule) => setEditing({ ...s });

  const save = async () => {
    if (!editing || !editing.productName) return;
    const payload = {
      upserts: [{
        id: editing.id,
        scheduledAt: editing.scheduledAt,
        productSku: editing.productSku ?? null,
        productName: editing.productName,
        quantity: Number(editing.quantity ?? 1),
        status: editing.status ?? 'planned',
        assignedTo: editing.assignedTo ?? null,
        note: editing.note ?? null,
      }],
      deletes: [] as string[],
    };
    await postJSON('/api/production/batch', payload);
    await mutate();
    setEditing(null);
  };

  const remove = async () => {
    if (!editing?.id) return;
    if (!confirm('Hapus jadwal produksi ini?')) return;
    await postJSON('/api/production/batch', { upserts: [], deletes: [editing.id] });
    await mutate();
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kalender Produksi</h1>
          <p className="text-sm text-slate-500 mt-1">
            Jadwal produksi harian. Klik tanggal untuk tambah, klik item untuk edit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 text-sm"
          >
            ‹
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 text-sm"
          >
            Hari ini
          </button>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 text-sm"
          >
            ›
          </button>
          <div className="ml-2 text-lg font-semibold text-slate-800 min-w-[180px]">{monthName}</div>
        </div>
      </header>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        {STATUSES.map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${STATUS_META[s].dot}`}></span>
            {STATUS_META[s].label}
          </div>
        ))}
        {isLoading && <span className="ml-auto text-slate-400">Loading…</span>}
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 text-xs font-medium text-slate-600 uppercase tracking-wide border-b border-slate-200">
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => (
            <div key={d} className="px-3 py-2 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, idx) => {
            const key = ymd(date);
            const items = byDate.get(key) ?? [];
            const isCurrent = date.getMonth() === currentMonth;
            const isToday = key === todayStr;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <div
                key={idx}
                className={`min-h-[112px] border-r border-b border-slate-200 p-1.5 flex flex-col gap-1 ${
                  !isCurrent ? 'bg-slate-50/70' : isWeekend ? 'bg-slate-50/40' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => openNew(date)}
                    className={`text-xs font-semibold rounded px-1.5 py-0.5 ${
                      isToday ? 'bg-teal-600 text-white' : isCurrent ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-400'
                    }`}
                    title="Tambah jadwal"
                  >
                    {date.getDate()}
                  </button>
                  {items.length > 0 && (
                    <span className="text-[10px] text-slate-400">{items.length}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1 overflow-hidden">
                  {items.slice(0, 3).map((s) => {
                    const meta = STATUS_META[s.status] ?? STATUS_META.planned;
                    return (
                      <button
                        key={s.id}
                        onClick={() => openEdit(s)}
                        className={`text-left text-xs rounded px-1.5 py-0.5 ${meta.bg} ${meta.text} truncate hover:ring-1 hover:ring-slate-300`}
                        title={`${s.productName} · ${s.quantity} pcs · ${meta.label}`}
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle ${meta.dot}`}></span>
                        {s.quantity}× {s.productName}
                      </button>
                    );
                  })}
                  {items.length > 3 && (
                    <span className="text-[10px] text-slate-400 px-1">+{items.length - 3} lainnya</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor modal */}
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
              <h3 className="font-semibold">{editing.id ? 'Edit Jadwal' : 'Tambah Jadwal'}</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="Tanggal & Jam">
                <input
                  type="datetime-local"
                  value={editing.scheduledAt ? toLocalInput(editing.scheduledAt) : ''}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p!, scheduledAt: new Date(e.target.value).toISOString() }))
                  }
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Nama Produk">
                <input
                  value={editing.productName ?? ''}
                  onChange={(e) => setEditing((p) => ({ ...p!, productName: e.target.value }))}
                  placeholder="mis. Jendela Casement 120x80"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SKU (opsional)">
                  <input
                    value={editing.productSku ?? ''}
                    onChange={(e) => setEditing((p) => ({ ...p!, productSku: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Jumlah">
                  <input
                    type="number"
                    min={1}
                    value={editing.quantity ?? 1}
                    onChange={(e) => setEditing((p) => ({ ...p!, quantity: Number(e.target.value) || 1 }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </Field>
              </div>
              <Field label="Status">
                <select
                  value={editing.status ?? 'planned'}
                  onChange={(e) => setEditing((p) => ({ ...p!, status: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_META[s].label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Ditugaskan ke">
                <input
                  value={editing.assignedTo ?? ''}
                  onChange={(e) => setEditing((p) => ({ ...p!, assignedTo: e.target.value }))}
                  placeholder="Nama operator / tim"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Catatan">
                <textarea
                  rows={2}
                  value={editing.note ?? ''}
                  onChange={(e) => setEditing((p) => ({ ...p!, note: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                {editing.id && (
                  <button
                    onClick={remove}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    Hapus
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-white"
                >
                  Batal
                </button>
                <button
                  onClick={save}
                  disabled={!editing.productName}
                  className="px-4 py-1.5 text-sm bg-slate-900 text-white rounded font-semibold hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Simpan
                </button>
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

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

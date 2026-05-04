'use client';
import useSWR, { mutate as swrMutate } from 'swr';
import { useMemo, useState } from 'react';
import { fetcher, postJSON, patchJSON, deleteRequest, formatRupiah } from '@/lib/api';
import { hasPermission } from '@/lib/auth';
import { matchText } from '@/lib/search';

interface Employee {
  id: string;
  nik: string;
  fullName: string;
  department: string | null;
}

interface Payroll {
  id: string;
  employeeId: string;
  period: string;
  baseSalary: number;
  allowance: number;
  overtimePay: number;
  deduction: number;
  netSalary: number;
  status: string;
  paidAt: string | null;
  note: string | null;
  employee: Employee;
}

interface Stats {
  period: string;
  totalNet: number;
  paidCount: number;
  pendingCount: number;
}

const monthLabel = (period: string) => {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

const currentPeriod = () => new Date().toISOString().slice(0, 7);

export default function PenggajianPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const { data: list, error, isLoading, mutate } = useSWR<Payroll[]>(
    `/api/payroll?period=${period}`,
    fetcher,
  );
  const { data: stats } = useSWR<Stats>(`/api/payroll/stats?period=${period}`, fetcher);

  const [editing, setEditing] = useState<Payroll | null>(null);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const canWrite = hasPermission('hrd:write');

  const filtered = useMemo(() => {
    if (!list) return [];
    let rows = list;
    if (statusFilter !== 'all') rows = rows.filter((p) => p.status === statusFilter);
    if (search) {
      rows = rows.filter((p) =>
        matchText<Record<string, unknown>>(p as unknown as Record<string, unknown>, search, [
          (r) => (r as unknown as Payroll).employee?.fullName,
          (r) => (r as unknown as Payroll).employee?.nik,
          (r) => (r as unknown as Payroll).employee?.department,
          'status', 'note',
          'baseSalary', 'allowance', 'overtimePay', 'deduction', 'netSalary',
        ]),
      );
    }
    return rows;
  }, [list, search, statusFilter]);

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;

  const refreshAll = async () => {
    await Promise.all([mutate(), swrMutate(`/api/payroll/stats?period=${period}`)]);
  };

  const onGenerate = async () => {
    if (!confirm(`Proses gaji untuk periode ${monthLabel(period)}? Akan menarik data gaji pokok, tunjangan, dan lembur dari karyawan aktif.`)) return;
    setGenerating(true);
    try {
      await postJSON('/api/payroll/generate', { period });
      await refreshAll();
    } catch (e) {
      alert('Gagal proses gaji: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGenerating(false);
    }
  };

  const onPay = async (p: Payroll) => {
    if (!confirm(`Tandai gaji ${p.employee.fullName} (${formatRupiah(p.netSalary)}) sebagai PAID?`)) return;
    try {
      await postJSON(`/api/payroll/${p.id}/pay`, {});
      await refreshAll();
    } catch (e) {
      alert('Gagal: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const onDelete = async (p: Payroll) => {
    if (!confirm(`Hapus payroll ${p.employee.fullName} periode ${monthLabel(p.period)}?`)) return;
    try {
      await deleteRequest(`/api/payroll/${p.id}`);
      await refreshAll();
    } catch (e) {
      alert('Gagal hapus: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const onSaveEdit = async (p: Payroll) => {
    try {
      await patchJSON(`/api/payroll/${p.id}`, {
        baseSalary: p.baseSalary,
        allowance: p.allowance,
        overtimePay: p.overtimePay,
        deduction: p.deduction,
        note: p.note ?? '',
      });
      await refreshAll();
      setEditing(null);
    } catch (e) {
      alert('Gagal simpan: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const onExportSlip = () => {
    if (!list || list.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }
    const header = ['Periode', 'NIK', 'Nama', 'Gaji Pokok', 'Tunjangan', 'Lembur', 'Potongan', 'Gaji Bersih', 'Status', 'Dibayar Pada'];
    const rows = list.map((p) => [
      monthLabel(p.period),
      p.employee.nik,
      p.employee.fullName,
      p.baseSalary,
      p.allowance,
      p.overtimePay,
      p.deduction,
      p.netSalary,
      p.status,
      p.paidAt ? new Date(p.paidAt).toLocaleDateString('id-ID') : '',
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slip_gaji_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Penggajian</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola penggajian dan slip gaji karyawan</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onExportSlip}
            className="px-3 py-1.5 border border-slate-300 rounded text-sm font-medium hover:bg-slate-50">
            Export Slip Gaji
          </button>
          {canWrite && (
            <button onClick={onGenerate} disabled={generating}
              className="px-4 py-1.5 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-700 disabled:opacity-50">
              {generating ? 'Memproses…' : '+ Proses Gaji'}
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label={`Total Gaji ${monthLabel(period)}`}
          value={formatRupiah(stats?.totalNet ?? 0)} color="text-slate-900" />
        <StatCard label="Karyawan Terbayar" value={stats?.paidCount ?? 0} color="text-emerald-600" />
        <StatCard label="Belum Diproses" value={stats?.pendingCount ?? 0} color="text-amber-600" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">Periode:</span>
        <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
          className="border rounded px-2 py-1 text-sm bg-white" />
        <input
          placeholder="Cari: nama / NIK / dept / status…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 bg-white text-sm w-72 ml-2"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm bg-white"
        >
          <option value="all">Semua status</option>
          <option value="draft">Draft</option>
          <option value="paid">Paid</option>
        </select>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} dari {list?.length ?? 0} record</span>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nama Karyawan</th>
              <th className="px-4 py-3 font-medium text-right">Gaji Pokok</th>
              <th className="px-4 py-3 font-medium text-right">Tunjangan</th>
              <th className="px-4 py-3 font-medium text-right">Lembur</th>
              <th className="px-4 py-3 font-medium text-right">Potongan</th>
              <th className="px-4 py-3 font-medium text-right">Gaji Bersih</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 w-32" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  {list && list.length > 0
                    ? 'Tidak ada hasil yang cocok.'
                    : 'Belum ada penggajian untuk periode ini. Klik "+ Proses Gaji" untuk generate dari karyawan aktif.'}
                </td>
              </tr>
            ) : filtered.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50 group">
                <td className="px-4 py-3">
                  <div className="font-medium">{p.employee.fullName}</div>
                  <div className="text-[11px] text-slate-500">{p.employee.nik}</div>
                </td>
                <td className="px-4 py-3 text-right">{formatRupiah(p.baseSalary)}</td>
                <td className="px-4 py-3 text-right">{formatRupiah(p.allowance)}</td>
                <td className="px-4 py-3 text-right">{formatRupiah(p.overtimePay)}</td>
                <td className="px-4 py-3 text-right text-red-600">{p.deduction > 0 ? `-${formatRupiah(p.deduction)}` : formatRupiah(0)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatRupiah(p.netSalary)}</td>
                <td className="px-4 py-3"><PayrollBadge s={p.status} /></td>
                <td className="px-2 py-3">
                  {canWrite && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {p.status !== 'paid' && (
                        <button onClick={() => onPay(p)}
                          className="px-2 py-0.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          title="Tandai Paid">
                          Bayar
                        </button>
                      )}
                      <button onClick={() => setEditing(p)}
                        className="p-1.5 hover:bg-slate-200 rounded" title="Edit">
                        <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button onClick={() => onDelete(p)}
                        className="p-1.5 hover:bg-red-100 rounded" title="Hapus">
                        <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <PayrollModal payroll={editing} onChange={setEditing} onClose={() => setEditing(null)} onSave={onSaveEdit} />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function PayrollBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-700',
    paid: 'bg-emerald-100 text-emerald-700',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[s] ?? 'bg-slate-100 text-slate-600'}`}>{s}</span>;
}

interface ModalProps {
  payroll: Payroll;
  onChange: (p: Payroll) => void;
  onClose: () => void;
  onSave: (p: Payroll) => void;
}

function PayrollModal({ payroll, onChange, onClose, onSave }: ModalProps) {
  const upd = <K extends keyof Payroll>(k: K, v: Payroll[K]) => {
    const next = { ...payroll, [k]: v };
    next.netSalary = next.baseSalary + next.allowance + next.overtimePay - next.deduction;
    onChange(next);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Edit Slip Gaji</h2>
            <div className="text-xs text-slate-500">{payroll.employee.fullName} · {monthLabel(payroll.period)}</div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <form onSubmit={(e) => { e.preventDefault(); onSave(payroll); }} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <NumField label="Gaji Pokok (Rp)" value={payroll.baseSalary} onChange={(v) => upd('baseSalary', v)} />
            <NumField label="Tunjangan (Rp)" value={payroll.allowance} onChange={(v) => upd('allowance', v)} />
            <NumField label="Lembur (Rp)" value={payroll.overtimePay} onChange={(v) => upd('overtimePay', v)} />
            <NumField label="Potongan (Rp)" value={payroll.deduction} onChange={(v) => upd('deduction', v)} />
          </div>

          <div className="bg-slate-50 rounded p-3 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-600">Gaji Bersih</span>
            <span className="text-lg font-bold text-slate-900">{formatRupiah(payroll.netSalary)}</span>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">Catatan</span>
            <textarea rows={2} value={payroll.note ?? ''} onChange={(e) => onChange({ ...payroll, note: e.target.value })}
              className="w-full border rounded px-3 py-1.5 text-sm" />
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button type="button" onClick={onClose}
              className="px-4 py-1.5 border border-slate-300 rounded text-sm font-medium hover:bg-slate-50">
              Batal
            </button>
            <button type="submit"
              className="px-4 py-1.5 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-700">
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1 block">{label}</span>
      <input type="number" min="0" value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border rounded px-3 py-1.5 text-sm text-right" />
    </label>
  );
}

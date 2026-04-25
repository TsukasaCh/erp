'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { fetcher, postJSON, deleteRequest } from '@/lib/api';
import { hasPermission } from '@/lib/auth';

interface Employee {
  id: string;
  nik: string;
  fullName: string;
  department: string | null;
}

interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  overtimeHours: number;
  note: string | null;
  employee: Employee;
}

interface Stats {
  presentToday: number;
  leaveToday: number;
  overtimeMonth: number;
}

const STATUSES = ['hadir', 'izin', 'sakit', 'alpha', 'cuti'];

interface AttendanceForm {
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
  overtimeHours: number;
  note: string;
}

const emptyForm = (): AttendanceForm => ({
  employeeId: '',
  date: new Date().toISOString().slice(0, 10),
  checkIn: '08:00',
  checkOut: '17:00',
  status: 'hadir',
  overtimeHours: 0,
  note: '',
});

export default function AbsensiLemburPage() {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = today.toISOString().slice(0, 10);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const { data: list, error, isLoading, mutate } = useSWR<Attendance[]>(
    `/api/attendance?from=${from}&to=${to}`,
    fetcher,
  );
  const { data: stats } = useSWR<Stats>('/api/attendance/stats', fetcher);
  const { data: employees } = useSWR<Employee[]>('/api/employees', fetcher);

  const [editing, setEditing] = useState<AttendanceForm | null>(null);
  const [saving, setSaving] = useState(false);
  const canWrite = hasPermission('hrd:write');

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;

  const onSave = async (form: AttendanceForm) => {
    if (!form.employeeId) {
      alert('Pilih karyawan dulu.');
      return;
    }
    setSaving(true);
    try {
      await postJSON('/api/attendance', {
        ...form,
        date: new Date(form.date).toISOString(),
        checkIn: form.checkIn || null,
        checkOut: form.checkOut || null,
        note: form.note || null,
      });
      await Promise.all([mutate(), import('swr').then(({ mutate: m }) => m('/api/attendance/stats'))]);
      setEditing(null);
    } catch (e) {
      alert('Gagal simpan: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (a: Attendance) => {
    if (!confirm(`Hapus absensi ${a.employee.fullName} tanggal ${new Date(a.date).toLocaleDateString('id-ID')}?`)) return;
    try {
      await deleteRequest(`/api/attendance/${a.id}`);
      await mutate();
    } catch (e) {
      alert('Gagal hapus: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const onExport = () => {
    if (!list || list.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }
    const header = ['Tanggal', 'NIK', 'Nama', 'Jam Masuk', 'Jam Keluar', 'Status', 'Lembur (jam)', 'Catatan'];
    const rows = list.map((a) => [
      new Date(a.date).toLocaleDateString('id-ID'),
      a.employee.nik,
      a.employee.fullName,
      a.checkIn ?? '',
      a.checkOut ?? '',
      a.status,
      a.overtimeHours,
      (a.note ?? '').replace(/[\n,]/g, ' '),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `absensi_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Absensi &amp; Lembur</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola data absensi dan lembur karyawan</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onExport}
            className="px-3 py-1.5 border border-slate-300 rounded text-sm font-medium hover:bg-slate-50">
            Export CSV
          </button>
          {canWrite && (
            <button onClick={() => setEditing(emptyForm())}
              className="px-4 py-1.5 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-700">
              + Input Absensi
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Hadir Hari Ini" value={stats?.presentToday ?? 0} color="text-emerald-600" />
        <StatCard label="Izin / Sakit / Cuti" value={stats?.leaveToday ?? 0} color="text-amber-600" />
        <StatCard label="Lembur Bulan Ini" value={`${stats?.overtimeMonth ?? 0} jam`} color="text-blue-600" />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Periode:</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="border rounded px-2 py-1 text-sm bg-white" />
        <span className="text-slate-400">—</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="border rounded px-2 py-1 text-sm bg-white" />
        <span className="text-xs text-slate-500 ml-auto">{list?.length ?? 0} record</span>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Tanggal</th>
              <th className="px-4 py-3 font-medium">Nama Karyawan</th>
              <th className="px-4 py-3 font-medium">Jam Masuk</th>
              <th className="px-4 py-3 font-medium">Jam Keluar</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Lembur (jam)</th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Loading…</td></tr>
            ) : !list || list.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Belum ada data absensi.</td></tr>
            ) : list.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50 group">
                <td className="px-4 py-3 text-xs text-slate-600">
                  {new Date(a.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{a.employee.fullName}</div>
                  <div className="text-[11px] text-slate-500">{a.employee.nik}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{a.checkIn ?? '-'}</td>
                <td className="px-4 py-3 font-mono text-xs">{a.checkOut ?? '-'}</td>
                <td className="px-4 py-3"><AttendanceBadge s={a.status} /></td>
                <td className="px-4 py-3 text-right">{a.overtimeHours > 0 ? a.overtimeHours : '-'}</td>
                <td className="px-2 py-3">
                  {canWrite && (
                    <button onClick={() => onDelete(a)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 rounded transition-opacity"
                      title="Hapus">
                      <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <AttendanceModal
          form={editing}
          employees={employees ?? []}
          saving={saving}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={onSave}
        />
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

function AttendanceBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    hadir: 'bg-emerald-100 text-emerald-700',
    izin: 'bg-amber-100 text-amber-700',
    sakit: 'bg-amber-100 text-amber-700',
    alpha: 'bg-red-100 text-red-700',
    cuti: 'bg-slate-100 text-slate-600',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[s] ?? 'bg-slate-100 text-slate-600'}`}>{s}</span>;
}

interface ModalProps {
  form: AttendanceForm;
  employees: Employee[];
  saving: boolean;
  onChange: (f: AttendanceForm) => void;
  onClose: () => void;
  onSave: (f: AttendanceForm) => void;
}

function AttendanceModal({ form, employees, saving, onChange, onClose, onSave }: ModalProps) {
  const upd = <K extends keyof AttendanceForm>(k: K, v: AttendanceForm[K]) =>
    onChange({ ...form, [k]: v });

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold">Input Absensi</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">Karyawan *</span>
            <select required value={form.employeeId} onChange={(e) => upd('employeeId', e.target.value)}
              className="w-full border rounded px-3 py-1.5 text-sm bg-white">
              <option value="">— Pilih karyawan —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.nik} — {e.fullName}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Tanggal *</span>
              <input required type="date" value={form.date} onChange={(e) => upd('date', e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Status</span>
              <select value={form.status} onChange={(e) => upd('status', e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Jam Masuk</span>
              <input type="time" value={form.checkIn} onChange={(e) => upd('checkIn', e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Jam Keluar</span>
              <input type="time" value={form.checkOut} onChange={(e) => upd('checkOut', e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm" />
            </label>
            <label className="block col-span-2">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Lembur (jam)</span>
              <input type="number" min="0" step="0.5" value={form.overtimeHours}
                onChange={(e) => upd('overtimeHours', Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm text-right" />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">Catatan</span>
            <textarea rows={2} value={form.note} onChange={(e) => upd('note', e.target.value)}
              className="w-full border rounded px-3 py-1.5 text-sm" />
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button type="button" onClick={onClose}
              className="px-4 py-1.5 border border-slate-300 rounded text-sm font-medium hover:bg-slate-50">
              Batal
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-1.5 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-700 disabled:opacity-50">
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

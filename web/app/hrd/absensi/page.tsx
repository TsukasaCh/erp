'use client';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { fetcher, postJSON } from '@/lib/api';
import { hasPermission } from '@/lib/auth';
import { SpreadsheetEditor, type ColumnDef } from '@/components/SpreadsheetEditor';

interface Employee {
  id: string;
  nik: string;
  fullName: string;
  department: string | null;
}

interface Attendance {
  id?: string;
  employeeId: string;
  date?: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status: string;
  overtimeHours: number;
  note?: string | null;
  employee?: Employee;
  _localId?: string;
  _dirty?: boolean;
  _new?: boolean;
  _deleted?: boolean;
  [k: string]: unknown;
}

interface Stats {
  presentToday: number;
  leaveToday: number;
  overtimeMonth: number;
}

const STATUSES = ['hadir', 'izin', 'sakit', 'alpha', 'cuti'];

type Mode =
  | { kind: 'view' }
  | { kind: 'edit'; focusId?: string; addNew?: boolean };

type SortKey = 'date' | 'fullName' | 'status' | 'overtimeHours';
type SortDir = 'asc' | 'desc';

export default function AbsensiLemburPage() {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = today.toISOString().slice(0, 10);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'date', dir: 'desc' });

  const { data: list, error, isLoading, mutate } = useSWR<Attendance[]>(
    `/api/attendance?from=${from}&to=${to}`,
    fetcher,
  );
  const { data: stats, mutate: mutateStats } = useSWR<Stats>('/api/attendance/stats', fetcher);
  const { data: employees } = useSWR<Employee[]>('/api/employees', fetcher);

  const canWrite = hasPermission('hrd:write');

  const employeeOptions = useMemo(
    () => (employees ?? []).map((e) => ({ value: e.id, label: `${e.nik} — ${e.fullName}` })),
    [employees],
  );
  const employeeMap = useMemo(() => {
    const m = new Map<string, Employee>();
    for (const e of employees ?? []) m.set(e.id, e);
    return m;
  }, [employees]);

  const editorColumns: ColumnDef<Attendance>[] = useMemo(() => [
    { key: 'date', label: 'Tanggal', type: 'date', width: 140 },
    {
      key: 'employeeId', label: 'Karyawan', type: 'select', options: employeeOptions, width: 240,
      format: (v) => {
        const id = String(v ?? '');
        const e = employeeMap.get(id);
        return e ? `${e.nik} — ${e.fullName}` : '';
      },
    },
    { key: 'checkIn', label: 'Jam Masuk', type: 'time', width: 110 },
    { key: 'checkOut', label: 'Jam Keluar', type: 'time', width: 110 },
    { key: 'status', label: 'Status', type: 'select', options: STATUSES, width: 110 },
    { key: 'overtimeHours', label: 'Lembur (jam)', type: 'number', width: 120, align: 'right' },
    { key: 'note', label: 'Catatan', type: 'text', width: 200 },
  ], [employeeOptions, employeeMap]);

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;

  if (mode.kind === 'edit') {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">
            {mode.addNew ? 'Input Absensi' : 'Edit Absensi & Lembur'}
          </h1>
          <p className="text-sm text-slate-500">
            Double-click sel untuk edit. Ctrl+S simpan · Ctrl+Z undo · Del hapus baris.
          </p>
        </header>

        <div className="flex-1 min-h-0">
          <SpreadsheetEditor<Attendance>
            columns={editorColumns}
            initialRows={list ?? []}
            autoAddRow={mode.addNew}
            focusRowId={mode.focusId}
            onClose={() => setMode({ kind: 'view' })}
            onRowTemplate={() => ({
              employeeId: '',
              date: new Date().toISOString().slice(0, 10),
              checkIn: '08:00',
              checkOut: '17:00',
              status: 'hadir',
              overtimeHours: 0,
              note: null,
            })}
            onSave={async ({ upserts, deletes }) => {
              const cleaned = upserts
                .filter((u) => u.employeeId && u.date)
                .map((u) => {
                  const { employee: _e, ...rest } = u;
                  return {
                    ...rest,
                    date: new Date(u.date as string).toISOString(),
                  };
                });
              if (cleaned.length === 0 && deletes.length === 0) return;
              await postJSON('/api/attendance/batch', { upserts: cleaned, deletes });
              await Promise.all([mutate(), mutateStats()]);
            }}
          />
        </div>
      </div>
    );
  }

  const onExport = () => {
    if (!list || list.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }
    const header = ['Tanggal', 'NIK', 'Nama', 'Jam Masuk', 'Jam Keluar', 'Status', 'Lembur (jam)', 'Catatan'];
    const rows = list.map((a) => [
      a.date ? new Date(a.date).toLocaleDateString('id-ID') : '',
      a.employee?.nik ?? '',
      a.employee?.fullName ?? '',
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

  const filteredSorted = (() => {
    if (!list) return [];
    let rows = list;
    if (filterStatus !== 'all') rows = rows.filter((a) => a.status === filterStatus);
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((a) =>
        (a.employee?.nik ?? '').toLowerCase().includes(s) ||
        (a.employee?.fullName ?? '').toLowerCase().includes(s),
      );
    }
    return [...rows].sort((a, b) => {
      let av: unknown, bv: unknown;
      if (sort.key === 'fullName') { av = a.employee?.fullName ?? ''; bv = b.employee?.fullName ?? ''; }
      else if (sort.key === 'date') { av = a.date ?? ''; bv = b.date ?? ''; }
      else { av = a[sort.key]; bv = b[sort.key]; }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), 'id-ID', { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  })();

  const toggleSort = (key: SortKey) => {
    setSort((prev) => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' });
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Absensi &amp; Lembur</h1>
        <div className="flex items-center gap-2">
          <button onClick={onExport}
            className="px-3 py-1.5 border border-slate-300 rounded text-sm font-medium hover:bg-slate-50">
            Export CSV
          </button>
          {canWrite && (
            <>
              <button
                onClick={() => setMode({ kind: 'edit' })}
                className="px-3 py-1.5 border border-slate-300 rounded text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5"
              >
                <EditIcon className="w-4 h-4" /> Edit
              </button>
              <button
                onClick={() => setMode({ kind: 'edit', addNew: true })}
                className="px-4 py-1.5 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-700"
              >
                + Input Absensi
              </button>
            </>
          )}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Hadir Hari Ini" value={stats?.presentToday ?? 0} color="text-emerald-600" />
        <StatCard label="Izin / Sakit / Cuti" value={stats?.leaveToday ?? 0} color="text-amber-600" />
        <StatCard label="Lembur Bulan Ini" value={`${stats?.overtimeMonth ?? 0} jam`} color="text-blue-600" />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[{ k: 'all', label: 'Semua' }, ...STATUSES.map((s) => ({ k: s, label: s }))].map((t) => (
          <button
            key={t.k}
            onClick={() => setFilterStatus(t.k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              filterStatus === t.k
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Periode:</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="border rounded px-2 py-1 text-sm bg-white" />
        <span className="text-slate-400">—</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="border rounded px-2 py-1 text-sm bg-white" />
        <input
          placeholder="Cari NIK / nama…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 bg-white text-sm w-56 ml-2"
        />
        <span className="text-xs text-slate-500 ml-auto">{filteredSorted.length} record</span>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <SortHeader label="Tanggal" sortKey="date" sort={sort} onSort={toggleSort} />
              <SortHeader label="Karyawan" sortKey="fullName" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-3 font-medium">Jam Masuk</th>
              <th className="px-4 py-3 font-medium">Jam Keluar</th>
              <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              <SortHeader label="Lembur (jam)" sortKey="overtimeHours" sort={sort} onSort={toggleSort} align="right" />
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Loading…</td></tr>
            ) : filteredSorted.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                {(list?.length ?? 0) === 0 ? 'Belum ada absensi pada periode ini. Klik "+ Input Absensi" untuk mulai.' : 'Tidak ada hasil.'}
              </td></tr>
            ) : filteredSorted.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50 group">
                <td className="px-4 py-3 text-xs text-slate-600">
                  {a.date ? new Date(a.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{a.employee?.fullName ?? '-'}</div>
                  <div className="text-[11px] text-slate-500">{a.employee?.nik ?? '-'}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{a.checkIn ?? '-'}</td>
                <td className="px-4 py-3 font-mono text-xs">{a.checkOut ?? '-'}</td>
                <td className="px-4 py-3"><AttendanceBadge s={a.status} /></td>
                <td className="px-4 py-3 text-right">{a.overtimeHours > 0 ? a.overtimeHours : '-'}</td>
                <td className="px-2 py-3">
                  {canWrite && (
                    <button
                      onClick={() => setMode({ kind: 'edit', focusId: a.id })}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-200 rounded transition-opacity"
                      title="Edit"
                    >
                      <EditIcon className="w-4 h-4 text-slate-500" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortHeader({ label, sortKey, sort, onSort, align }: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (k: SortKey) => void;
  align?: 'right';
}) {
  const isActive = sort.key === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-4 py-3 font-medium cursor-pointer select-none hover:bg-slate-100 ${align === 'right' ? 'text-right' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && <span className="text-xs text-teal-600">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
        {!isActive && <span className="text-xs text-slate-300">↕</span>}
      </span>
    </th>
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

function EditIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

'use client';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { fetcher, formatRupiah, postJSON } from '@/lib/api';
import { hasPermission } from '@/lib/auth';
import { SpreadsheetEditor, type ColumnDef } from '@/components/SpreadsheetEditor';
import { matchText } from '@/lib/search';

interface Employee {
  id?: string;
  nik: string;
  fullName: string;
  position?: string | null;
  department?: string | null;
  status: string;
  joinedAt?: string;
  phone?: string | null;
  email?: string | null;
  baseSalary: number;
  allowance: number;
  overtimeRate: number;
  note?: string | null;
  _localId?: string;
  _dirty?: boolean;
  _new?: boolean;
  _deleted?: boolean;
  [k: string]: unknown;
}

const STATUSES = ['aktif', 'kontrak', 'tetap', 'cuti', 'resign'];
const DEPARTMENTS = ['Produksi', 'Gudang', 'Penjualan', 'Admin', 'Keuangan', 'HRD', 'Lainnya'];

const editorColumns: ColumnDef<Employee>[] = [
  { key: 'nik', label: 'NIK', type: 'text', width: 120 },
  { key: 'fullName', label: 'Nama Lengkap', type: 'text', width: 220 },
  { key: 'position', label: 'Jabatan', type: 'text', width: 160 },
  { key: 'department', label: 'Departemen', type: 'select', options: DEPARTMENTS, width: 140 },
  { key: 'status', label: 'Status', type: 'select', options: STATUSES, width: 110 },
  { key: 'joinedAt', label: 'Tgl Masuk', type: 'date', width: 130 },
  { key: 'phone', label: 'No. HP', type: 'text', width: 130 },
  { key: 'email', label: 'Email', type: 'text', width: 180 },
  { key: 'baseSalary', label: 'Gaji Pokok', type: 'number', width: 130, align: 'right',
    format: (v) => v == null ? '' : `Rp ${Number(v).toLocaleString('id-ID')}` },
  { key: 'allowance', label: 'Tunjangan', type: 'number', width: 130, align: 'right',
    format: (v) => v == null ? '' : `Rp ${Number(v).toLocaleString('id-ID')}` },
  { key: 'overtimeRate', label: 'Tarif Lembur/jam', type: 'number', width: 140, align: 'right',
    format: (v) => v == null ? '' : `Rp ${Number(v).toLocaleString('id-ID')}` },
  { key: 'note', label: 'Catatan', type: 'text', width: 200 },
];

type Mode =
  | { kind: 'view' }
  | { kind: 'edit'; focusId?: string; addNew?: boolean };

type SortKey = 'nik' | 'fullName' | 'position' | 'department' | 'status' | 'baseSalary' | 'joinedAt';
type SortDir = 'asc' | 'desc';

export default function DataKaryawanPage() {
  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'fullName', dir: 'asc' });

  const { data, error, isLoading, mutate } = useSWR<Employee[]>('/api/employees', fetcher);
  const canWrite = hasPermission('hrd:write');

  const deptCounts = useMemo(() => {
    if (!data) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const e of data) {
      const d = e.department ?? '(none)';
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [data]);

  const filteredSorted = useMemo(() => {
    if (!data) return [];
    let rows = data;
    if (filterDept !== 'all') rows = rows.filter((e) => (e.department ?? '(none)') === filterDept);
    if (filterStatus !== 'all') rows = rows.filter((e) => e.status === filterStatus);
    if (search) {
      rows = rows.filter((e) =>
        matchText(e, search, [
          'nik', 'fullName', 'position', 'department', 'status',
          'phone', 'email', 'note', 'joinedAt', 'baseSalary', 'allowance',
        ]),
      );
    }
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), 'id-ID', { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [data, filterDept, filterStatus, search, sort]);

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  if (mode.kind === 'edit') {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">
            {mode.addNew ? 'Tambah Karyawan' : 'Edit Data Karyawan'}
          </h1>
          <p className="text-sm text-slate-500">
            Double-click sel untuk edit. Ctrl+S simpan · Ctrl+Z undo · Del hapus baris.
          </p>
        </header>

        <div className="flex-1 min-h-0">
          <SpreadsheetEditor<Employee>
            columns={editorColumns}
            initialRows={data}
            autoAddRow={mode.addNew}
            focusRowId={mode.focusId}
            onClose={() => setMode({ kind: 'view' })}
            onRowTemplate={() => ({
              nik: '',
              fullName: '',
              position: null,
              department: null,
              status: 'aktif',
              joinedAt: new Date().toISOString().slice(0, 10),
              phone: null,
              email: null,
              baseSalary: 0,
              allowance: 0,
              overtimeRate: 0,
              note: null,
            })}
            onSave={async ({ upserts, deletes }) => {
              const payload = upserts.map((u) => ({
                ...u,
                joinedAt: u.joinedAt ? new Date(u.joinedAt).toISOString() : undefined,
              }));
              await postJSON('/api/employees/batch', { upserts: payload, deletes });
              await mutate();
            }}
          />
        </div>
      </div>
    );
  }

  const toggleSort = (key: SortKey) => {
    setSort((prev) => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' });
  };

  const totalSalary = filteredSorted.reduce((s, e) => s + Number(e.baseSalary ?? 0), 0);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Data Karyawan</h1>
        <div className="flex items-center gap-2">
          <input
            placeholder="Cari: NIK / nama / jabatan / dept / HP / email / gaji…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-1.5 bg-white text-sm w-60"
          />
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
                + Tambah Karyawan
              </button>
            </>
          )}
        </div>
      </header>

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

      {/* Department chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-wide text-slate-500 mr-1">Filter Dept:</span>
        <DeptChip label="Semua" active={filterDept === 'all'} onClick={() => setFilterDept('all')} count={data.length} />
        {DEPARTMENTS.map((d) => {
          const count = deptCounts.get(d) ?? 0;
          if (count === 0) return null;
          return <DeptChip key={d} label={d} active={filterDept === d} onClick={() => setFilterDept(d)} count={count} />;
        })}
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-600">
          <span className="font-semibold text-slate-900">{filteredSorted.length}</span> karyawan
        </span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-600">
          Total gaji pokok: <span className="font-semibold text-slate-900">{formatRupiah(totalSalary)}</span>
        </span>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <SortHeader label="NIK" sortKey="nik" sort={sort} onSort={toggleSort} />
              <SortHeader label="Nama Lengkap" sortKey="fullName" sort={sort} onSort={toggleSort} />
              <SortHeader label="Jabatan" sortKey="position" sort={sort} onSort={toggleSort} />
              <SortHeader label="Departemen" sortKey="department" sort={sort} onSort={toggleSort} />
              <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              <SortHeader label="Gaji Pokok" sortKey="baseSalary" sort={sort} onSort={toggleSort} align="right" />
              <SortHeader label="Tgl Masuk" sortKey="joinedAt" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {filteredSorted.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                {data.length === 0 ? 'Belum ada karyawan. Klik "+ Tambah Karyawan" untuk mulai.' : 'Tidak ada hasil.'}
              </td></tr>
            )}
            {filteredSorted.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50 group">
                <td className="px-4 py-3 font-mono text-xs">{e.nik}</td>
                <td className="px-4 py-3 font-medium">{e.fullName}</td>
                <td className="px-4 py-3 text-slate-600">{e.position ?? '-'}</td>
                <td className="px-4 py-3">
                  {e.department ? (
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">{e.department}</span>
                  ) : <span className="text-slate-400">-</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge s={e.status} /></td>
                <td className="px-4 py-3 text-right font-medium">{formatRupiah(Number(e.baseSalary))}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {e.joinedAt ? new Date(e.joinedAt).toLocaleDateString('id-ID') : '-'}
                </td>
                <td className="px-2 py-3">
                  {canWrite && (
                    <button
                      onClick={() => setMode({ kind: 'edit', focusId: e.id })}
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

function DeptChip({ label, active, onClick, count }: {
  label: string; active: boolean; onClick: () => void; count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
      }`}
    >
      <span>{label}</span>
      <span className={active ? 'text-slate-300' : 'text-slate-400'}>·</span>
      <span>{count}</span>
    </button>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    aktif: 'bg-emerald-100 text-emerald-700',
    tetap: 'bg-blue-100 text-blue-700',
    kontrak: 'bg-amber-100 text-amber-700',
    cuti: 'bg-slate-100 text-slate-600',
    resign: 'bg-red-100 text-red-700',
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

'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { fetcher, postJSON, patchJSON, deleteRequest, formatRupiah } from '@/lib/api';
import { hasPermission } from '@/lib/auth';

interface Employee {
  id: string;
  nik: string;
  fullName: string;
  position: string | null;
  department: string | null;
  status: string;
  joinedAt: string;
  phone: string | null;
  email: string | null;
  baseSalary: number;
  allowance: number;
  overtimeRate: number;
  note: string | null;
}

const STATUSES = ['aktif', 'kontrak', 'tetap', 'cuti', 'resign'];
const DEPARTMENTS = ['Produksi', 'Gudang', 'Penjualan', 'Admin', 'Keuangan', 'HRD', 'Lainnya'];

type EmployeeForm = Omit<Employee, 'id' | 'joinedAt'> & { id?: string; joinedAt: string };

const emptyForm = (): EmployeeForm => ({
  nik: '',
  fullName: '',
  position: '',
  department: '',
  status: 'aktif',
  joinedAt: new Date().toISOString().slice(0, 10),
  phone: '',
  email: '',
  baseSalary: 0,
  allowance: 0,
  overtimeRate: 0,
  note: '',
});

export default function DataKaryawanPage() {
  const { data, error, isLoading, mutate } = useSWR<Employee[]>('/api/employees', fetcher);
  const [editing, setEditing] = useState<EmployeeForm | null>(null);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [saving, setSaving] = useState(false);

  const canWrite = hasPermission('hrd:write');

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  const filtered = data.filter((e) => {
    if (filterDept !== 'all' && e.department !== filterDept) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !e.fullName.toLowerCase().includes(s) &&
        !e.nik.toLowerCase().includes(s) &&
        !(e.position?.toLowerCase().includes(s) ?? false)
      ) return false;
    }
    return true;
  });

  const startAdd = () => setEditing(emptyForm());
  const startEdit = (emp: Employee) => setEditing({
    ...emp,
    position: emp.position ?? '',
    department: emp.department ?? '',
    phone: emp.phone ?? '',
    email: emp.email ?? '',
    note: emp.note ?? '',
    joinedAt: emp.joinedAt.slice(0, 10),
  });

  const onSave = async (form: EmployeeForm) => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        position: form.position || null,
        department: form.department || null,
        phone: form.phone || null,
        email: form.email || null,
        note: form.note || null,
        joinedAt: new Date(form.joinedAt).toISOString(),
      };
      if (form.id) {
        await patchJSON(`/api/employees/${form.id}`, payload);
      } else {
        const { id: _id, ...create } = payload;
        await postJSON('/api/employees', create);
      }
      await mutate();
      setEditing(null);
    } catch (e) {
      alert('Gagal simpan: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (emp: Employee) => {
    if (!confirm(`Hapus karyawan "${emp.fullName}"? Data absensi & penggajian terkait juga ikut terhapus.`)) return;
    try {
      await deleteRequest(`/api/employees/${emp.id}`);
      await mutate();
    } catch (e) {
      alert('Gagal hapus: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Karyawan</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola data karyawan perusahaan</p>
        </div>
        {canWrite && (
          <button
            onClick={startAdd}
            className="px-4 py-1.5 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-700"
          >
            + Tambah Karyawan
          </button>
        )}
      </header>

      <div className="flex items-center gap-2">
        <input
          placeholder="Cari NIK / nama / jabatan…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 bg-white text-sm w-64"
        />
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="border rounded px-3 py-1.5 bg-white text-sm"
        >
          <option value="all">Semua Departemen</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="text-xs text-slate-500 ml-auto">
          {filtered.length} dari {data.length} karyawan
        </span>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">NIK</th>
              <th className="px-4 py-3 font-medium">Nama Lengkap</th>
              <th className="px-4 py-3 font-medium">Jabatan</th>
              <th className="px-4 py-3 font-medium">Departemen</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Gaji Pokok</th>
              <th className="px-4 py-3 font-medium">Tanggal Masuk</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  {data.length === 0
                    ? 'Belum ada data karyawan. Klik "+ Tambah Karyawan" untuk menambahkan.'
                    : 'Tidak ada hasil.'}
                </td>
              </tr>
            ) : filtered.map((e) => (
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
                <td className="px-4 py-3 text-right">{formatRupiah(e.baseSalary)}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {new Date(e.joinedAt).toLocaleDateString('id-ID')}
                </td>
                <td className="px-2 py-3">
                  {canWrite && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(e)}
                        className="p-1.5 hover:bg-slate-200 rounded"
                        title="Edit"
                      >
                        <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(e)}
                        className="p-1.5 hover:bg-red-100 rounded"
                        title="Hapus"
                      >
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
        <EmployeeModal
          form={editing}
          saving={saving}
          onClose={() => setEditing(null)}
          onChange={setEditing}
          onSave={onSave}
        />
      )}
    </div>
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
  const cls = map[s] ?? 'bg-slate-100 text-slate-600';
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{s}</span>;
}

interface ModalProps {
  form: EmployeeForm;
  saving: boolean;
  onChange: (f: EmployeeForm) => void;
  onClose: () => void;
  onSave: (f: EmployeeForm) => void;
}

function EmployeeModal({ form, saving, onChange, onClose, onSave }: ModalProps) {
  const upd = <K extends keyof EmployeeForm>(k: K, v: EmployeeForm[K]) =>
    onChange({ ...form, [k]: v });

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {form.id ? 'Edit Karyawan' : 'Tambah Karyawan'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <form
          onSubmit={(e) => { e.preventDefault(); onSave(form); }}
          className="p-5 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="NIK *">
              <input required value={form.nik} onChange={(e) => upd('nik', e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm" />
            </Field>
            <Field label="Nama Lengkap *">
              <input required value={form.fullName} onChange={(e) => upd('fullName', e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm" />
            </Field>
            <Field label="Jabatan">
              <input value={form.position ?? ''} onChange={(e) => upd('position', e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm" />
            </Field>
            <Field label="Departemen">
              <select value={form.department ?? ''} onChange={(e) => upd('department', e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white">
                <option value="">— Pilih —</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => upd('status', e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Tanggal Masuk">
              <input type="date" value={form.joinedAt} onChange={(e) => upd('joinedAt', e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm" />
            </Field>
            <Field label="No. HP">
              <input value={form.phone ?? ''} onChange={(e) => upd('phone', e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm" />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email ?? ''} onChange={(e) => upd('email', e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm" />
            </Field>
            <Field label="Gaji Pokok (Rp)">
              <input type="number" min="0" value={form.baseSalary}
                onChange={(e) => upd('baseSalary', Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm text-right" />
            </Field>
            <Field label="Tunjangan Tetap (Rp)">
              <input type="number" min="0" value={form.allowance}
                onChange={(e) => upd('allowance', Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm text-right" />
            </Field>
            <Field label="Tarif Lembur / jam (Rp)">
              <input type="number" min="0" value={form.overtimeRate}
                onChange={(e) => upd('overtimeRate', Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm text-right" />
            </Field>
          </div>

          <Field label="Catatan">
            <textarea rows={2} value={form.note ?? ''} onChange={(e) => upd('note', e.target.value)}
              className="w-full border rounded px-3 py-1.5 text-sm" />
          </Field>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

'use client';

export default function DataKaryawanPage() {
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Karyawan</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola data karyawan perusahaan</p>
        </div>
        <button className="px-4 py-1.5 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-700">
          + Tambah Karyawan
        </button>
      </header>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">NIK</th>
              <th className="px-4 py-3 font-medium">Nama Lengkap</th>
              <th className="px-4 py-3 font-medium">Jabatan</th>
              <th className="px-4 py-3 font-medium">Departemen</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Tanggal Masuk</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                Belum ada data karyawan. Klik &quot;+ Tambah Karyawan&quot; untuk menambahkan.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

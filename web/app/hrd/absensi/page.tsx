'use client';

export default function AbsensiLemburPage() {
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Absensi &amp; Lembur</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola data absensi dan lembur karyawan</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 border border-slate-300 rounded text-sm font-medium hover:bg-slate-50">
            Export
          </button>
          <button className="px-4 py-1.5 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-700">
            + Input Absensi
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Hadir Hari Ini</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">0</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Izin / Sakit</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">0</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Lembur Bulan Ini</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">0 jam</div>
        </div>
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
              <th className="px-4 py-3 font-medium">Lembur (jam)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                Belum ada data absensi.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

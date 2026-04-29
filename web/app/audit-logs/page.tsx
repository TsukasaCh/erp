'use client';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

interface AuditLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  resource: string;
  details: string | null;
  createdAt: string;
}

interface ListResponse {
  page: number;
  pageSize: number;
  total: number;
  items: AuditLog[];
}

export default function AuditLogsPage() {
  const { data, error, isLoading } = useSWR<ListResponse>('/api/audit-logs?pageSize=100', fetcher);

  if (error) return <div className="text-red-600">Error: {String(error)}</div>;
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-slate-500 mt-1">
          Catatan aktivitas sistem. Waktu ditampilkan dalam Waktu Indonesia Barat (WIB).
        </p>
      </header>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-medium">Waktu (WIB)</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Aksi</th>
              <th className="px-4 py-3 font-medium">Modul / URL</th>
              <th className="px-4 py-3 font-medium">Detail Perubahan</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  Belum ada catatan aktivitas.
                </td>
              </tr>
            )}
            {data.items.map((log) => {
              const d = new Date(log.createdAt);
              const timeWIB = d.toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              let actionStyle = 'bg-slate-100 text-slate-700';
              if (log.action === 'POST') actionStyle = 'bg-emerald-100 text-emerald-700';
              if (log.action === 'PUT' || log.action === 'PATCH') actionStyle = 'bg-blue-100 text-blue-700';
              if (log.action === 'DELETE') actionStyle = 'bg-red-100 text-red-700';

              return (
                <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-mono text-xs">
                    {timeWIB}
                  </td>
                  <td className="px-4 py-3 font-medium">{log.username}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${actionStyle}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]" title={log.resource}>
                    {log.resource}
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-md overflow-x-auto text-xs font-mono text-slate-500 bg-slate-50 p-1.5 rounded">
                      {log.details ? log.details : '-'}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

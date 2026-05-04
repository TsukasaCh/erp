'use client';
import { useState } from 'react';

interface Props {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
  /** Quick preset buttons (Hari ini, 7 hari, 30 hari, dst) */
  presets?: boolean;
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function DateRangeFilter({ from, to, onChange, presets = true }: Props) {
  const [open, setOpen] = useState(false);

  const apply = (preset: 'today' | '7d' | '30d' | '90d' | 'thisMonth' | 'all') => {
    const today = new Date();
    if (preset === 'all') return onChange(null, null);
    if (preset === 'today') return onChange(ymd(today), ymd(today));
    if (preset === 'thisMonth') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return onChange(ymd(start), ymd(today));
    }
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    onChange(ymd(start), ymd(today));
  };

  const label = (() => {
    if (!from && !to) return 'Semua tanggal';
    if (from && to && from === to) return new Date(from).toLocaleDateString('id-ID');
    const f = from ? new Date(from).toLocaleDateString('id-ID') : '...';
    const t = to ? new Date(to).toLocaleDateString('id-ID') : '...';
    return `${f} – ${t}`;
  })();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 border rounded px-3 py-1.5 text-sm hover:bg-slate-50 ${
          from || to ? 'border-teal-400 text-teal-700 bg-teal-50' : 'border-slate-300 bg-white'
        }`}
      >
        <CalendarIcon className="w-4 h-4" />
        {label}
        <ChevronIcon className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* backdrop to close on outside click */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-72">
            {presets && (
              <div className="grid grid-cols-3 gap-1 mb-3">
                <PresetBtn onClick={() => apply('today')}>Hari ini</PresetBtn>
                <PresetBtn onClick={() => apply('7d')}>7 hari</PresetBtn>
                <PresetBtn onClick={() => apply('30d')}>30 hari</PresetBtn>
                <PresetBtn onClick={() => apply('thisMonth')}>Bulan ini</PresetBtn>
                <PresetBtn onClick={() => apply('90d')}>90 hari</PresetBtn>
                <PresetBtn onClick={() => apply('all')}>Semua</PresetBtn>
              </div>
            )}
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Dari</label>
                <input
                  type="date"
                  value={from ?? ''}
                  onChange={(e) => onChange(e.target.value || null, to)}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Sampai</label>
                <input
                  type="date"
                  value={to ?? ''}
                  onChange={(e) => onChange(from, e.target.value || null)}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-between gap-2">
              <button
                onClick={() => { onChange(null, null); setOpen(false); }}
                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
              >
                Reset
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PresetBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 hover:border-slate-300"
    >
      {children}
    </button>
  );
}

function CalendarIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChevronIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

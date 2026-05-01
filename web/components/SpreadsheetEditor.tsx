'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type ColumnType = 'text' | 'number' | 'date' | 'datetime' | 'time' | 'select' | 'readonly';

export type SelectOption = string | { label: string; value: string };

export interface ColumnDef<Row> {
  key: keyof Row & string;
  label: string;
  type?: ColumnType;
  width?: number;
  align?: 'left' | 'right' | 'center';
  options?: SelectOption[];
  format?: (value: unknown, row: Row) => string;
  computed?: (row: Row) => unknown; // auto-fill value on edit
  /**
   * Cascading update hook — dipanggil setelah cell di kolom ini berubah
   * (sebelum computed columns dijalankan). Return partial row untuk merge
   * ke row state. Contoh: pilih SKU → auto-fill productName + price + productId.
   * Kembalikan undefined / void untuk no-op.
   */
  onChange?: (newValue: unknown, row: Row) => Partial<Row> | void;
}

function normalizeOption(o: SelectOption): { label: string; value: string } {
  return typeof o === 'string' ? { label: o, value: o } : o;
}

export interface SpreadsheetRow {
  id?: string;
  _localId?: string;
  _dirty?: boolean;
  _new?: boolean;
  _deleted?: boolean;
  [k: string]: unknown;
}

interface Props<Row extends SpreadsheetRow> {
  columns: ColumnDef<Row>[];
  initialRows: Row[];
  onSave: (payload: { upserts: Row[]; deletes: string[] }) => Promise<void>;
  onRowTemplate: () => Row;
  /** max history stack size */
  maxUndo?: number;
  /** if provided, render a "Selesai" button that calls this */
  onClose?: () => void;
  /** prepend one blank row on mount (for "+ Tambah" entry flow) */
  autoAddRow?: boolean;
  /** focus a specific row on mount (by id) */
  focusRowId?: string;
}

type Snapshot<Row> = { rows: Row[]; selected: Set<string> };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function SpreadsheetEditor<Row extends SpreadsheetRow>({
  columns,
  initialRows,
  onSave,
  onRowTemplate,
  maxUndo = 50,
  onClose,
  autoAddRow,
  focusRowId,
}: Props<Row>) {
  const normalize = useCallback(
    (rows: Row[]): Row[] =>
      rows.map((r) => ({ ...r, _localId: r._localId ?? r.id ?? uid() } as Row)),
    [],
  );

  const [rows, setRows] = useState<Row[]>(() => normalize(initialRows));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ rowId: string; col: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const historyRef = useRef<Snapshot<Row>[]>([]);
  const redoRef = useRef<Snapshot<Row>[]>([]);

  // reset when initialRows changes (e.g. after reload)
  useEffect(() => {
    setRows(normalize(initialRows));
    setSelected(new Set());
    historyRef.current = [];
    redoRef.current = [];
  }, [initialRows, normalize]);

  // optionally prepend a blank row on mount
  const didAutoAddRef = useRef(false);
  useEffect(() => {
    if (autoAddRow && !didAutoAddRef.current) {
      didAutoAddRef.current = true;
      const base = onRowTemplate();
      const newRow = { ...base, _localId: uid(), _new: true, _dirty: true } as Row;
      setRows((r) => [newRow, ...r]);
    }
  }, [autoAddRow, onRowTemplate]);

  // focus a specific row on mount (highlight it)
  useEffect(() => {
    if (focusRowId) {
      setTimeout(() => {
        const el = document.querySelector(`[data-row-id="${focusRowId}"]`);
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 100);
    }
  }, [focusRowId]);

  const pushHistory = useCallback(() => {
    historyRef.current.push({
      rows: rows.map((r) => ({ ...r })),
      selected: new Set(selected),
    });
    if (historyRef.current.length > maxUndo) historyRef.current.shift();
    redoRef.current = [];
  }, [rows, selected, maxUndo]);

  const undo = useCallback(() => {
    const snap = historyRef.current.pop();
    if (!snap) return;
    redoRef.current.push({
      rows: rows.map((r) => ({ ...r })),
      selected: new Set(selected),
    });
    setRows(snap.rows);
    setSelected(snap.selected);
  }, [rows, selected]);

  const redo = useCallback(() => {
    const snap = redoRef.current.pop();
    if (!snap) return;
    historyRef.current.push({
      rows: rows.map((r) => ({ ...r })),
      selected: new Set(selected),
    });
    setRows(snap.rows);
    setSelected(snap.selected);
  }, [rows, selected]);

  const addRow = useCallback(() => {
    pushHistory();
    const base = onRowTemplate();
    const newRow = { ...base, _localId: uid(), _new: true, _dirty: true } as Row;
    setRows((r) => [newRow, ...r]);
  }, [pushHistory, onRowTemplate]);

  const deleteSelected = useCallback(() => {
    if (selected.size === 0) return;
    pushHistory();
    setRows((prev) =>
      prev
        .map((r) => {
          if (!selected.has(r._localId as string)) return r;
          if (r._new) return null; // drop unsaved
          return { ...r, _deleted: true, _dirty: true } as Row;
        })
        .filter((r): r is Row => r !== null),
    );
    setSelected(new Set());
  }, [selected, pushHistory]);

  const toggleSelect = (id: string, shift = false) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const visible = rows.filter((r) => !r._deleted);
    if (selected.size === visible.length) setSelected(new Set());
    else setSelected(new Set(visible.map((r) => r._localId as string)));
  };

  const updateCell = useCallback(
    (localId: string, colKey: string, value: unknown) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r._localId !== localId) return r;
          let updated = { ...r, [colKey]: value, _dirty: true } as Row;

          // Cascading update: jalankan onChange dari kolom yang baru saja diedit.
          // Patch yang dikembalikan di-merge ke row, memungkinkan satu pilihan
          // mengisi beberapa field sekaligus (mis. pilih SKU → isi productName + price).
          const editedCol = columns.find((c) => c.key === colKey);
          if (editedCol?.onChange) {
            const patch = editedCol.onChange(value, updated);
            if (patch && typeof patch === 'object') {
              updated = { ...updated, ...patch } as Row;
            }
          }

          // run computed columns
          for (const c of columns) {
            if (c.computed) {
              const cv = c.computed(updated);
              (updated as Record<string, unknown>)[c.key] = cv;
            }
          }
          return updated;
        }),
      );
    },
    [columns],
  );

  const save = useCallback(async () => {
    const dirty = rows.filter((r) => r._dirty && !r._deleted);
    const deletes = rows.filter((r) => r._deleted && r.id).map((r) => r.id as string);
    if (dirty.length === 0 && deletes.length === 0) {
      setLastMessage('Tidak ada perubahan.');
      setTimeout(() => setLastMessage(null), 2000);
      return;
    }
    setSaving(true);
    try {
      const upserts = dirty.map((r) => {
        const out = { ...r } as Record<string, unknown>;
        delete out._localId;
        delete out._dirty;
        delete out._new;
        delete out._deleted;
        if (!out.id) delete out.id;
        return out as Row;
      });
      await onSave({ upserts, deletes });
      setLastMessage(`Tersimpan (${upserts.length} diubah, ${deletes.length} dihapus).`);
      setTimeout(() => setLastMessage(null), 3000);
      historyRef.current = [];
      redoRef.current = [];
    } catch (e) {
      setLastMessage(`Gagal menyimpan: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [rows, onSave]);

  // keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 's') { e.preventDefault(); save(); }
      else if (ctrl && e.key === 'z') { e.preventDefault(); undo(); }
      else if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); }
      else if (e.key === 'Delete' && selected.size > 0 && !editing) { e.preventDefault(); deleteSelected(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [save, undo, redo, deleteSelected, selected, editing]);

  const visibleRows = useMemo(() => rows.filter((r) => !r._deleted), [rows]);
  const dirtyCount = useMemo(() => rows.filter((r) => r._dirty).length, [rows]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-t-lg px-3 py-2">
        <button
          onClick={() => { pushHistory(); addRow(); }}
          className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700"
        >
          + Baris Baru
        </button>
        <button
          onClick={deleteSelected}
          disabled={selected.size === 0}
          className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-40"
        >
          Hapus ({selected.size})
        </button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button
          onClick={undo}
          disabled={historyRef.current.length === 0}
          className="px-3 py-1.5 border border-slate-300 rounded text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
          title="Ctrl+Z"
        >
          ↶ Undo
        </button>
        <button
          onClick={redo}
          disabled={redoRef.current.length === 0}
          className="px-3 py-1.5 border border-slate-300 rounded text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
          title="Ctrl+Y"
        >
          ↷ Redo
        </button>
        <div className="flex-1" />
        {lastMessage && <span className="text-xs text-slate-600">{lastMessage}</span>}
        {dirtyCount > 0 && (
          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">
            {dirtyCount} perubahan belum disimpan
          </span>
        )}
        <button
          onClick={save}
          disabled={saving || dirtyCount === 0}
          className="px-4 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-700 disabled:opacity-40"
          title="Ctrl+S"
        >
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-slate-300 rounded text-xs font-medium hover:bg-slate-50"
          >
            ✕ Selesai
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto border-x border-b border-slate-200 rounded-b-lg bg-white">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-slate-50 z-10">
            <tr>
              <th className="w-10 px-2 py-2 border-b border-slate-200 text-left">
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === visibleRows.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="w-10 px-2 py-2 border-b border-slate-200 text-left text-xs text-slate-400">#</th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="px-3 py-2 border-b border-slate-200 text-left text-xs font-semibold text-slate-700 whitespace-nowrap"
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-12 text-center text-slate-400">
                  Belum ada data. Klik <span className="font-semibold">+ Baris Baru</span> untuk mulai.
                </td>
              </tr>
            )}
            {visibleRows.map((row, idx) => {
              const localId = row._localId as string;
              const isSelected = selected.has(localId);
              return (
                <tr
                  key={localId}
                  data-row-id={row.id ?? localId}
                  className={
                    'group ' +
                    (isSelected
                      ? 'bg-blue-50'
                      : row._new
                      ? 'bg-emerald-50/40'
                      : row._dirty
                      ? 'bg-amber-50/50'
                      : focusRowId && row.id === focusRowId
                      ? 'bg-yellow-100'
                      : 'hover:bg-slate-50')
                  }
                >
                  <td className="px-2 py-1.5 border-b border-slate-100">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleSelect(localId, (e.nativeEvent as MouseEvent).shiftKey)}
                    />
                  </td>
                  <td className="px-2 py-1.5 border-b border-slate-100 text-xs text-slate-400">{idx + 1}</td>
                  {columns.map((c) => (
                    <Cell
                      key={c.key}
                      row={row}
                      column={c}
                      editing={editing?.rowId === localId && editing.col === c.key}
                      onStartEdit={() => {
                        if (c.type === 'readonly') return;
                        pushHistory();
                        setEditing({ rowId: localId, col: c.key });
                      }}
                      onCommit={(v) => {
                        updateCell(localId, c.key, v);
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell<Row extends SpreadsheetRow>({
  row,
  column,
  editing,
  onStartEdit,
  onCommit,
  onCancel,
}: {
  row: Row;
  column: ColumnDef<Row>;
  editing: boolean;
  onStartEdit: () => void;
  onCommit: (v: unknown) => void;
  onCancel: () => void;
}) {
  const raw = (row as Record<string, unknown>)[column.key];
  let display: string;
  if (column.format) {
    display = column.format(raw, row);
  } else if (column.type === 'select' && column.options && raw != null && raw !== '') {
    // Map stored value -> option label so UUID-like values render as their label
    const match = column.options
      .map(normalizeOption)
      .find((o) => o.value === String(raw));
    display = match ? match.label : formatDefault(raw, column.type);
  } else {
    display = formatDefault(raw, column.type);
  }
  const align = column.align ?? (column.type === 'number' ? 'right' : 'left');

  if (!editing) {
    return (
      <td
        onDoubleClick={onStartEdit}
        onClick={(e) => { if (e.detail === 2) return; }}
        className={
          'px-3 py-1.5 border-b border-slate-100 cursor-cell whitespace-nowrap ' +
          (align === 'right' ? 'text-right ' : align === 'center' ? 'text-center ' : '') +
          (column.type === 'readonly' ? 'text-slate-500 bg-slate-50/50' : '')
        }
      >
        {display || <span className="text-slate-300">·</span>}
      </td>
    );
  }

  return (
    <td className="px-1 py-0.5 border-b border-slate-100">
      <EditInput raw={raw} column={column} onCommit={onCommit} onCancel={onCancel} />
    </td>
  );
}

function EditInput<Row extends SpreadsheetRow>({
  raw,
  column,
  onCommit,
  onCancel,
}: {
  raw: unknown;
  column: ColumnDef<Row>;
  onCommit: (v: unknown) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState<string>(() => {
    if (raw == null) return '';
    if (column.type === 'datetime' && raw instanceof Date) return toLocalDatetime(raw);
    if (column.type === 'datetime' && typeof raw === 'string') return toLocalDatetime(new Date(raw));
    if (column.type === 'date' && typeof raw === 'string') return raw.slice(0, 10);
    return String(raw);
  });
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (inputRef.current instanceof HTMLInputElement) inputRef.current.select();
  }, []);

  const commit = () => {
    if (column.type === 'number') {
      const n = val === '' ? 0 : Number(val);
      onCommit(Number.isFinite(n) ? n : 0);
    } else if (column.type === 'datetime') {
      onCommit(val ? new Date(val).toISOString() : null);
    } else if (column.type === 'date') {
      onCommit(val || null);
    } else if (column.type === 'time') {
      onCommit(val || null);
    } else {
      onCommit(val === '' ? null : val);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  if (column.type === 'select') {
    return (
      <select
        ref={(el) => { inputRef.current = el; }}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        className="w-full px-2 py-1 border border-blue-400 rounded text-sm"
      >
        <option value="" />
        {column.options?.map((o) => {
          const opt = normalizeOption(o);
          return <option key={opt.value} value={opt.value}>{opt.label}</option>;
        })}
      </select>
    );
  }

  return (
    <input
      ref={(el) => { inputRef.current = el; }}
      type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : column.type === 'datetime' ? 'datetime-local' : column.type === 'time' ? 'time' : 'text'}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={onKey}
      step={column.type === 'number' ? 'any' : undefined}
      className="w-full px-2 py-1 border border-blue-400 rounded text-sm outline-none"
    />
  );
}

function formatDefault(raw: unknown, type?: ColumnType): string {
  if (raw == null || raw === '') return '';
  if (type === 'datetime') {
    const d = raw instanceof Date ? raw : new Date(String(raw));
    return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleString('id-ID');
  }
  if (type === 'date') {
    const s = String(raw).slice(0, 10);
    return s;
  }
  if (type === 'number') return Number(raw).toLocaleString('id-ID');
  return String(raw);
}

function toLocalDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

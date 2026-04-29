'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Additional data attached to this option (e.g. full product/material object) */
  data?: Record<string, unknown>;
}

interface Props {
  options: SearchSelectOption[];
  value: string | null | undefined;
  onChange: (value: string, option: SearchSelectOption | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Searchable dropdown select with CONCAT display.
 * Used for picking products (SKU - Name) and materials (Code - Name).
 */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  className = '',
  disabled = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!search) return options;
    const s = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, search]);

  const handleSelect = useCallback(
    (opt: SearchSelectOption) => {
      onChange(opt.value, opt);
      setSearch('');
      setIsOpen(false);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange('', null);
    setSearch('');
  }, [onChange]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        className={`w-full flex items-center justify-between gap-1 px-3 py-2 border rounded text-sm text-left transition-colors ${
          isOpen
            ? 'border-blue-400 ring-1 ring-blue-200'
            : 'border-slate-300 hover:border-slate-400'
        } ${disabled ? 'bg-slate-100 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="text-slate-400 hover:text-red-500 text-xs leading-none px-0.5"
              title="Hapus pilihan"
            >
              ✕
            </span>
          )}
          <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-64 flex flex-col">
          {/* Search input */}
          <div className="p-2 border-b border-slate-100">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ketik untuk cari..."
              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded bg-slate-50 outline-none focus:border-blue-400 focus:bg-white"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsOpen(false);
                  setSearch('');
                } else if (e.key === 'Enter' && filtered.length === 1) {
                  handleSelect(filtered[0]);
                }
              }}
            />
          </div>
          {/* Options list */}
          <div className="flex-1 overflow-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-slate-400">
                Tidak ditemukan
              </div>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 ${
                  opt.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                }`}
              >
                {opt.value === value && (
                  <span className="text-blue-600 text-xs">✓</span>
                )}
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

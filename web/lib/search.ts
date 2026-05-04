/**
 * Case-insensitive multi-field text search dengan beberapa enhancement:
 * - Mendukung multi-keyword: "shopee jendela" matches rows yang punya BOTH
 *   "shopee" dan "jendela" di field manapun
 * - Auto-format Date / number ke string supaya bisa ditemukan dengan ketik
 *   tanggal ("29/4", "april", "2026") atau angka ("11000000", "11.000.000")
 * - Ignore null/undefined
 */
export function matchText<T>(
  row: T,
  query: string,
  fields: (keyof T | ((row: T) => unknown) | string)[],
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  // Build searchable text from all listed fields
  const parts: string[] = [];
  const r = row as unknown as Record<string, unknown>;
  for (const f of fields) {
    let v: unknown;
    if (typeof f === 'function') {
      try { v = f(row); } catch { v = null; }
    } else {
      v = r[f as string];
    }
    parts.push(serialize(v));
  }
  const haystack = parts.join(' ').toLowerCase();

  // Split query by whitespace; ALL keywords must match (AND semantics)
  const keywords = q.split(/\s+/).filter(Boolean);
  return keywords.every((kw) => haystack.includes(kw));
}

function serialize(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) {
    return formatDate(v);
  }
  if (typeof v === 'string') {
    // Coba detect ISO date string → expand jadi human-readable
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return formatDate(d) + ' ' + v;
    }
    return v;
  }
  if (typeof v === 'number') {
    // Sertakan format mentah dan format id-ID supaya "11000000" maupun
    // "11.000.000" sama-sama match
    return `${v} ${v.toLocaleString('id-ID')}`;
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

const MONTHS_ID = [
  'januari', 'februari', 'maret', 'april', 'mei', 'juni',
  'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
];

function formatDate(d: Date): string {
  const day = d.getDate();
  const monthIdx = d.getMonth();
  const year = d.getFullYear();
  // Sertakan banyak format supaya berbagai ketikan match:
  // "29/4/2026", "29-4-2026", "29 april", "april 2026", "2026-04-29"
  return [
    `${day}/${monthIdx + 1}/${year}`,
    `${day}-${monthIdx + 1}-${year}`,
    `${day} ${MONTHS_ID[monthIdx]} ${year}`,
    `${MONTHS_ID[monthIdx]} ${year}`,
    `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    d.toLocaleString('id-ID'),
  ].join(' ');
}

/** Filter array by date range. Returns rows where row[field] ∈ [from, to]. */
export function inDateRange<T>(
  rows: T[],
  field: keyof T | string,
  from: string | null,
  to: string | null,
): T[] {
  if (!from && !to) return rows;
  const fromMs = from ? new Date(from + 'T00:00:00').getTime() : -Infinity;
  // 'to' inclusive — sampai akhir hari
  const toMs = to ? new Date(to + 'T23:59:59.999').getTime() : Infinity;
  return rows.filter((r) => {
    const v = (r as unknown as Record<string, unknown>)[field as string];
    if (!v) return false;
    const t = v instanceof Date ? v.getTime() : new Date(String(v)).getTime();
    if (Number.isNaN(t)) return false;
    return t >= fromMs && t <= toMs;
  });
}

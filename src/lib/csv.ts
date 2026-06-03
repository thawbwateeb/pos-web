export type CsvValue = string | number | boolean | Date | null | undefined;

function serialize(v: CsvValue): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv<Row extends Record<string, CsvValue>>(
  rows: Row[],
  columns: { key: keyof Row; header: string }[],
): string {
  const header = columns.map((c) => serialize(c.header)).join(',');
  const body = rows
    .map((r) => columns.map((c) => serialize(r[c.key])).join(','))
    .join('\n');
  // Prepend BOM so Excel opens UTF-8 correctly.
  return `﻿${header}\n${body}\n`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const AED = (n: number | string): string => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return 'AED ' + (Math.round(v * 100) / 100).toFixed(2);
};

export const AED0 = (n: number | string): string => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return 'AED ' + Math.round(v).toLocaleString('en-US');
};

export function initials(name: string): string {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
}

export function shortTime(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

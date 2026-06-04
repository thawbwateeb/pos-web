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
  // Non-padded hour to match the prototype's clock() ("6:05 PM") while staying
  // locale-aware (Arabic renders its own format).
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Human-relative due/timestamp label as the design uses it on order cards.
 * Returns "<i18nTodayWord> 14:30" / "<i18nTomorrowWord> 09:00" / "Sat 16:45"
 * for dates within a week, else "12 Jun". Caller passes the translated
 * Today/Tomorrow/Yesterday words so the strings respect locale.
 */
export function dueLabel(
  iso: string | Date | null | undefined,
  labels: { today: string; tomorrow: string; yesterday: string },
): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (dayDiff === 0) return `${labels.today} ${time}`;
  if (dayDiff === 1) return `${labels.tomorrow} ${time}`;
  if (dayDiff === -1) return `${labels.yesterday} ${time}`;
  if (dayDiff > 1 && dayDiff < 7) {
    return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
  }
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

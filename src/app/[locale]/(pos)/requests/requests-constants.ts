// Ported from POS/requests.js — the `BAG_HEX`, `PIC`, `TYPE`, `STATUS`
// constants. The API returns UPPERCASE type/status enums
// (ITEMIZED|QUICK|BAGS|WEIGHT|PHOTO, NEW|QUOTED|ACCEPTED|DECLINED); the design
// keys are lowercase. We keep the design's lowercase keys here and normalize at
// the call site with `.toLowerCase()`.

export type ReqTypeKey = 'itemized' | 'quick' | 'bags' | 'weight' | 'photo';
export type ReqStatusKey = 'new' | 'quoted' | 'accepted' | 'declined';

// requests.js:12
export const BAG_HEX: Record<string, string> = {
  white: '#F3F4F6',
  blue: '#3B7DD8',
  green: '#2E9E6B',
  red: '#D14B45',
  black: '#2B313A',
  gold: '#C4A572',
  purple: '#7C5CD0',
  orange: '#E08A3C',
};

// The mobile intake writes meta.bags as { serviceId, qty }[] (serviceId =
// catalogue externalKey) and never a colour/name. Mirror the mobile design's
// service→colour mapping so swatches/names render meaningfully.
// serviceId (catalogue externalKey) → display name + swatch colour
export const SERVICE_BAG: Record<string, { name: string; hex: string }> = {
  dry: { name: 'Dry Clean', hex: '#3B7DD8' },
  wash: { name: 'Wash & Fold', hex: '#F3F4F6' },
  steam: { name: 'Press Only', hex: '#2B313A' },
  press: { name: 'Press Only', hex: '#2B313A' },
  home: { name: 'Bedding & Linens', hex: '#2E9E6B' },
};
const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export const bagDisplay = (b: {
  serviceId?: string;
  qty?: number;
  name?: string;
  color?: string;
}) => {
  const sid = b.serviceId ?? '';
  const m = SERVICE_BAG[sid];
  return {
    name: b.name ?? m?.name ?? titleCase(sid) ?? 'Bag',
    hex: b.color ?? m?.hex ?? '#2A4858',
    qty: b.qty ?? 1,
  };
};

// requests.js:13-19 — SVG inner paths per type icon. Rendered through <ReqIcon>.
export const PIC: Record<ReqTypeKey, string> = {
  itemized:
    '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="3.7" cy="6" r="1.1" fill="currentColor" stroke="none"/><circle cx="3.7" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="3.7" cy="18" r="1.1" fill="currentColor" stroke="none"/>',
  quick: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  bags: '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  weight:
    '<path d="M12 4.5a1.5 1.5 0 1 0 0-.001M9 6h6M7 6 4 13a3 3 0 0 0 6 0L7 6zM17 6l-3 7a3 3 0 0 0 6 0l-3-7zM9 20h6"/>',
  photo:
    '<rect x="3" y="7" width="18" height="13" rx="2.2"/><circle cx="12" cy="13.5" r="3.3"/><path d="M8.5 7 10 4.5h4L15.5 7"/>',
};

// requests.js:20-26
export const TYPE: Record<ReqTypeKey, { label: string; needsQuote: boolean }> = {
  itemized: { label: 'Itemized', needsQuote: false },
  quick: { label: 'Quick pickup', needsQuote: false },
  bags: { label: 'Colour bags', needsQuote: false },
  weight: { label: 'By weight', needsQuote: false },
  photo: { label: 'Photo & quote', needsQuote: true },
};

// requests.js:53
export const STATUS: Record<ReqStatusKey, { cls: string; txt: string }> = {
  new: { cls: 'new', txt: 'New' },
  quoted: { cls: 'quoted', txt: 'Quote sent' },
  accepted: { cls: 'ok', txt: 'Accepted' },
  declined: { cls: 'mut', txt: 'Declined' },
};

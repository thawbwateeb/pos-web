/* Mobile Ordering constants — ported 1:1 from the design prototype
   `thawb-wa-teeb-laundry/project/POS/ordering.js` (SERVICES, BAG_COLORS, ICONS,
   MODES and the cfg shape). Copy text and ids are kept verbatim. */

export type MethodId = 'itemized' | 'quick' | 'bags' | 'weight' | 'photo';

export interface BagType {
  color: string;
  name: string;
  service: string;
  price: number;
  unit: 'bag' | 'item';
}

export interface OrderingConfig {
  selection: 'single' | 'choice';
  default: MethodId;
  enabled: Record<MethodId, boolean>;
  itemized: {
    showPrices: boolean;
    perItemService: boolean;
    photos: boolean;
    notes: boolean;
    minOrder: number;
  };
  quick: { askCount: boolean; pickService: boolean; hold: number; note: string };
  bags: {
    billing: 'per_bag' | 'per_item' | 'by_weight';
    note: string;
    list: BagType[];
  };
  weight: { pricePerKg: number; minKg: number; services: string[]; note: string };
  photo: { sla: string; requireApproval: boolean; multi: boolean };
}

export const SERVICES = [
  'Wash & Fold',
  'Wash & Iron',
  'Dry Clean',
  'Press Only',
  'Bedding & Linens',
  'Shoes & Bags',
];

export interface BagColor {
  id: string;
  hex: string;
  ring?: string;
  label: string;
}

export const BAG_COLORS: BagColor[] = [
  { id: 'white', hex: '#F3F4F6', ring: '#CDD2D9', label: 'White' },
  { id: 'blue', hex: '#3B7DD8', label: 'Blue' },
  { id: 'green', hex: '#2E9E6B', label: 'Green' },
  { id: 'red', hex: '#D14B45', label: 'Red' },
  { id: 'black', hex: '#2B313A', label: 'Black' },
  { id: 'gold', hex: '#C4A572', label: 'Gold' },
  { id: 'purple', hex: '#7C5CD0', label: 'Purple' },
  { id: 'orange', hex: '#E08A3C', label: 'Orange' },
];

// SVG inner-path markup for each method icon (rendered inside a shared <svg>).
export const ICONS: Record<MethodId, string> = {
  itemized:
    '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="3.7" cy="6" r="1.1" fill="currentColor" stroke="none"/><circle cx="3.7" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="3.7" cy="18" r="1.1" fill="currentColor" stroke="none"/>',
  quick: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  bags: '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  weight:
    '<path d="M12 4.5a1.5 1.5 0 1 0 0-.001M9 6h6M7 6 4 13a3 3 0 0 0 6 0L7 6zM17 6l-3 7a3 3 0 0 0 6 0l-3-7zM9 20h6"/>',
  photo:
    '<rect x="3" y="7" width="18" height="13" rx="2.2"/><circle cx="12" cy="13.5" r="3.3"/><path d="M8.5 7 10 4.5h4L15.5 7"/>',
};

export interface Mode {
  id: MethodId;
  icon: string;
  title: string;
  best: string;
  tagline: string;
}

export const MODES: Mode[] = [
  {
    id: 'itemized',
    icon: ICONS.itemized,
    title: 'Itemized catalogue',
    best: 'Most transparent',
    tagline:
      'Customers pick exact items & quantities and see live prices before checkout.',
  },
  {
    id: 'quick',
    icon: ICONS.quick,
    title: 'Quick pickup',
    best: 'Fastest checkout',
    tagline:
      'Customers just request a pickup — staff count & price the items at the facility.',
  },
  {
    id: 'bags',
    icon: ICONS.bags,
    title: 'Colour-coded bags',
    best: 'Great for subscriptions',
    tagline: 'Each bag colour maps to a service; the order is billed after sorting.',
  },
  {
    id: 'weight',
    icon: ICONS.weight,
    title: 'By weight',
    best: 'Best for wash & fold',
    tagline:
      'Billed per kilo and weighed on arrival — no item counting for the customer.',
  },
  {
    id: 'photo',
    icon: ICONS.photo,
    title: 'Photo & quote',
    best: 'Best for bespoke items',
    tagline:
      'Customers snap a photo of the pile and you send a quote to approve.',
  },
];

// Money formatter ported from ordering.js `AED(n)`.
export function AED(n: number): string {
  return (
    'AED ' +
    (Math.round(n * 100) / 100).toLocaleString('en-US', {
      minimumFractionDigits: n % 1 ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

const isHex = (c: string): boolean => typeof c === 'string' && c[0] === '#';

function relLum(hex: string): number {
  const m = hex.replace('#', '').match(/.{2}/g) || ['cc', 'cc', 'cc'];
  const [r, g, b] = m.map((h) => parseInt(h, 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export const colorOf = (id: string): string =>
  isHex(id) ? id : (BAG_COLORS.find((c) => c.id === id) || ({} as BagColor)).hex || '#ccc';

export const ringOf = (id: string): string | null | undefined =>
  isHex(id)
    ? relLum(id) > 0.8
      ? '#CDD2D9'
      : null
    : BAG_COLORS.find((c) => c.id === id)?.ring;

export const labelOf = (id: string): string =>
  isHex(id)
    ? id.toUpperCase()
    : (BAG_COLORS.find((c) => c.id === id) || ({} as BagColor)).label || id;

export { isHex };

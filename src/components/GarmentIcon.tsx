/**
 * Garment-specific SVG paths and a name-based mapper, ported verbatim from
 * the design's PI map + iconFor() in POS/app.js. Used in the New Order item
 * cards so each item gets the right silhouette (shirt outline for Shirts,
 * trousers for Jeans, abaya outline for abayas, etc.) instead of one
 * blanket hanger icon.
 */

const PI: Record<string, string> = {
  shirt:     'M8.5 3.5 5 5.5 3.5 9l2.5 1.2L7 9.2V20h10V9.2l1 1.3L20.5 9 19 5.5 15.5 3.5 12 6z',
  tshirt:    'M8 4 3.5 6.5 5.5 10 8 8.6V20h8V8.6l2.5 1.4 2-3.5L16 4l-4 2.6z',
  sweater:   'M7.5 5 4 8l2 2.2L7.5 9V20h9V9l1.5 1.2L20 8l-3.5-3-1 1c-1 1-2 1.5-3.5 1.5S9.5 7 8.5 6z',
  pajama:    'M8 4h8v6H8z M8 13h3.2v7H8z M12.8 13H16v7h-3.2z',
  tracksuit: 'M8 4 6 6.2V11h2v9h3v-9h2v9h3V6.2L17 4z M9 4h6',
  trousers:  'M7 3h10l.4 5L18 21h-4.2l-1.3-11h-1L10.2 21H6l.6-13z',
  shorts:    'M6 4h12l.6 5-.8 6h-3.3l-1-7h-1l-1 7H7.2L6.4 9z',
  skirt:     'M9 4h6l4 9-2.6 1L15 21H9l-1.4-7L5 13z',
  abaya:     'M8.5 3 12 5.2 15.5 3l1.6 5-2.1.8V21H7V8.8L5 8z',
  robe:      'M9 3 7 5.2V8L5.5 8.6V21h13V8.6L17 8V5.2L15 3l-2.5 1.8c-.3.2-.7.2-1 0z',
  headcloth: 'M5 5c4.5 2.5 9.5 2.5 14 0l-2.2 13-2.8-2-2 2.6-2-2.6-2.8 2z',
  saree:     'M6 4c4 3.5 8 3.5 12 0 0 6-1 12-2 17h-2l-1-8-1 8H9C8 16 7 10 6 4z',
  dress:     'M9 3.5 12 5.5l3-2 1.8 4-2 1.4L16 21H8l1.2-12.1-2-1.4z',
  gown:      'M10 3.2a2 2 0 0 0 4 0l1.6 4.3-1.6 1.1L17.5 21h-11l3.5-12.4-1.6-1.1z',
  suit:      'M8 3.5l4 3 4-3 3 4.2V21h-5.2l-1.8-7-1.8 7H5V7.7z M12 6.5V11',
  coat:      'M8 3.5l4 2 4-2 2.2 3.3V21H5.8V6.8z M12 7v13 M9.2 12h5.6',
  tie:       'M10 3h4l-.7 4 1.7 9.5L12 21l-3-4.5L10.7 7z',
  sheet:     'M4 7.5h16v3.2H4z M5.5 10.7v6.8h13v-6.8 M9.5 10.7v6.8',
  pillow:    'M3 9c0-1.6 1.2-2.6 3-2.6h12c1.8 0 3 1 3 2.6s-1.2 3.4-3 3.4H6c-1.8 0-3-1.8-3-3.4z M6 9.5h12',
  quilt:     'M3.5 7h17v10h-17z M3.5 11h17 M9 7v10 M14.5 7v10',
  towel:     'M6.5 3.5h11v13.5l-2.75-1.8-2.75 1.8-2.75-1.8L6.5 17z M6.5 7.5h11',
  tablecloth:'M3.5 8.5h17l-1.2 3.5H4.7z M7 12v7.5 M17 12v7.5',
  curtain:   'M4 3.5h16v2H4z M6.5 5.5c0 6-1 10-2.2 13h3.3c.6-4 .6-9 .4-13M12 5.5v16M17.5 5.5c.2 4 .2 9 .9 13h3.3c-1.1-3-2.1-7-2.1-13',
  rug:       'M4.5 6h15v12h-15z M7.5 6v12 M16.5 6v12 M10 9.5h4v5h-4z M4.5 6 3 4.5 M19.5 6 21 4.5 M4.5 18 3 19.5 M19.5 18 21 19.5',
  sofa:      'M4 11.5V9.5A2.5 2.5 0 0 1 6.5 7h11A2.5 2.5 0 0 1 20 9.5v2 M3 11.5h18v6H3z M6.5 17.5v2 M17.5 17.5v2',
  shoe:      'M3 11l1.6-1 2.6 2.6L9 11l1.1 2.1 8.9 1.5c1.6.3 2 1.3 2 2.6v1H3z',
  boot:      'M7 3.5h4.2v8.5l4.8 1.9c1.5.6 2 1.5 2 3v2.6H7z M7 12h4.2',
  bag:       'M6.5 8.5h11l-1 11.5h-9z M9.5 8.5V6.5a2.5 2.5 0 0 1 5 0v2',
};

// Same precedence order as the design's iconFor() — checked top-down,
// first match wins. So "Silk Shirt" hits /shirt/ (not /silk/), "T-shirt /
// Polo" hits /t-shirt|polo/ before any generic shirt match, etc.
const PATTERNS: { test: RegExp; key: keyof typeof PI }[] = [
  { test: /wedding/i,                                          key: 'gown' },
  { test: /abaya/i,                                            key: 'abaya' },
  { test: /saree/i,                                            key: 'saree' },
  { test: /ghatra|sheila|scarf/i,                              key: 'headcloth' },
  { test: /kandura|dishdasha|galabiya|kurta|shalwar/i,         key: 'robe' },
  { test: /dress|gown/i,                                       key: 'dress' },
  { test: /leather jacket|overcoat|coat/i,                     key: 'coat' },
  { test: /suit|jacket|vest/i,                                 key: 'suit' },
  { test: /tie/i,                                              key: 'tie' },
  { test: /t-shirt|polo/i,                                     key: 'tshirt' },
  { test: /pullover|sweater/i,                                 key: 'sweater' },
  { test: /pajama/i,                                           key: 'pajama' },
  { test: /sports/i,                                           key: 'tracksuit' },
  { test: /blouse|shirt/i,                                     key: 'shirt' },
  { test: /trouser|jeans/i,                                    key: 'trousers' },
  { test: /shorts/i,                                           key: 'shorts' },
  { test: /skirt/i,                                            key: 'skirt' },
  { test: /bed sheet|sheet/i,                                  key: 'sheet' },
  { test: /pillow/i,                                           key: 'pillow' },
  { test: /duvet|comforter|blanket/i,                          key: 'quilt' },
  { test: /towel/i,                                            key: 'towel' },
  { test: /table/i,                                            key: 'tablecloth' },
  { test: /curtain/i,                                          key: 'curtain' },
  { test: /carpet|rug|mat/i,                                   key: 'rug' },
  { test: /sofa/i,                                             key: 'sofa' },
  { test: /boot/i,                                             key: 'boot' },
  { test: /shoe/i,                                             key: 'shoe' },
  { test: /bag/i,                                              key: 'bag' },
];

function pathFor(name: string): string {
  for (const p of PATTERNS) if (p.test.test(name)) return PI[p.key];
  return PI.shirt; // default
}

/** Stable list of garment-icon keys, for the catalogue icon picker. */
export const GARMENT_ICON_KEYS = Object.keys(PI);

export default function GarmentIcon({
  name,
  iconKey,
  size = 26,
  className,
}: {
  name?: string;
  /** Explicit icon key (from `iconKey` on a catalogue item); wins over name. */
  iconKey?: string | null;
  size?: number;
  className?: string;
}) {
  const d = iconKey && PI[iconKey] ? PI[iconKey] : pathFor(name ?? '');
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

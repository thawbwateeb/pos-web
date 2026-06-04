/**
 * HTML document builders for the three QZ Tray print jobs: customer receipt,
 * garment/barcode label, and end-of-day Z-report. Output is self-contained
 * HTML (inline CSS) sized for an 80 mm thermal roll, printed via `printHtml`.
 */

import { code128Svg } from './barcode';

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const money = (currency: string, n: number | string): string => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return `${currency} ${(Math.round((v || 0) * 100) / 100).toFixed(2)}`;
};

function shell(widthMm: number, body: string): string {
  const px = Math.round(widthMm * 3.78); // ~96dpi mm→px
  return (
    `<!doctype html><html><head><meta charset="utf-8"/><style>` +
    `*{margin:0;padding:0;box-sizing:border-box}` +
    `body{width:${px}px;font-family:'JetBrains Mono','Courier New',monospace;color:#000;font-size:12px;line-height:1.45;padding:8px 10px}` +
    `.c{text-align:center}.r{text-align:right}.b{font-weight:700}` +
    `.bn{font-size:16px;font-weight:700;letter-spacing:.04em}` +
    `.mut{color:#444;font-size:11px}` +
    `.hr{border-top:1px dashed #000;margin:7px 0}` +
    `.row{display:flex;justify-content:space-between;gap:8px}` +
    `.row.t{font-weight:700;font-size:13px}` +
    `table{width:100%;border-collapse:collapse}td{vertical-align:top;padding:1px 0}` +
    `.qty{width:30px}.amt{text-align:right;white-space:nowrap}` +
    `</style></head><body>${body}</body></html>`
  );
}

export interface ReceiptBranding {
  brandName: string;
  receiptFooter?: string | null;
  currency?: string | null;
}
export interface ReceiptStore {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  trn?: string | null;
}
export interface ReceiptTax {
  enabled: boolean;
  label: string;
  trn?: string | null;
  onReceipt: boolean;
}
export interface ReceiptOrder {
  number: number;
  createdAt: string;
  subtotal: string | number;
  total: string | number;
  expressAmount?: string | number;
  discountAmount?: string | number;
  discountCode?: string | null;
  deliveryFee?: string | number;
  taxAmount?: string | number;
  primaryMethod?: string | null;
  paid?: boolean;
  customer?: { fullName?: string | null; phone?: string | null } | null;
  items?: Array<{ nameSnapshot: string; tierSnapshot: string; qty: number; lineTotal: string | number }>;
}

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash', CARD: 'Card', APPLE_PAY: 'Apple Pay',
  ACCOUNT: 'Account', ON_DELIVERY: 'Pay later', GIFT_CARD: 'Gift Card',
};

export function renderReceipt(
  order: ReceiptOrder,
  branding: ReceiptBranding,
  store: ReceiptStore = {},
  tax?: ReceiptTax | null,
  widthMm = 80,
): string {
  const cur = branding.currency || 'AED';
  const d = new Date(order.createdAt);
  const when = d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const lines = (order.items ?? [])
    .map(
      (it) =>
        `<tr><td class="qty">${it.qty}×</td><td>${esc(it.nameSnapshot)}<div class="mut">${esc(it.tierSnapshot)}</div></td>` +
        `<td class="amt">${money(cur, it.lineTotal)}</td></tr>`,
    )
    .join('');

  const totalsRows: string[] = [
    `<div class="row"><span>Subtotal</span><span>${money(cur, order.subtotal)}</span></div>`,
  ];
  if (Number(order.expressAmount) > 0)
    totalsRows.push(`<div class="row"><span>Express</span><span>${money(cur, order.expressAmount!)}</span></div>`);
  if (Number(order.discountAmount) > 0)
    totalsRows.push(
      `<div class="row"><span>Discount${order.discountCode ? ` (${esc(order.discountCode)})` : ''}</span><span>−${money(cur, order.discountAmount!)}</span></div>`,
    );
  if (Number(order.deliveryFee) > 0)
    totalsRows.push(`<div class="row"><span>Delivery</span><span>${money(cur, order.deliveryFee!)}</span></div>`);
  if (tax?.enabled && tax.onReceipt && Number(order.taxAmount) > 0)
    totalsRows.push(`<div class="row"><span>${esc(tax.label)}</span><span>${money(cur, order.taxAmount!)}</span></div>`);

  const body =
    `<div class="c"><div class="bn">${esc(branding.brandName)}</div>` +
    (store.name ? `<div class="mut">${esc(store.name)}</div>` : '') +
    (store.address ? `<div class="mut">${esc(store.address)}</div>` : '') +
    (store.phone ? `<div class="mut">${esc(store.phone)}</div>` : '') +
    (tax?.trn || store.trn ? `<div class="mut">TRN ${esc(tax?.trn || store.trn)}</div>` : '') +
    `</div>` +
    `<div class="hr"></div>` +
    `<div class="row"><span class="b">Order #${order.number}</span><span class="mut">${esc(when)}</span></div>` +
    (order.customer?.fullName
      ? `<div class="row"><span>${esc(order.customer.fullName)}</span><span class="mut">${esc(order.customer.phone ?? '')}</span></div>`
      : `<div class="mut">Walk-in</div>`) +
    `<div class="hr"></div>` +
    `<table>${lines}</table>` +
    `<div class="hr"></div>` +
    totalsRows.join('') +
    `<div class="row t"><span>TOTAL</span><span>${money(cur, order.total)}</span></div>` +
    `<div class="row mut"><span>${order.paid ? 'Paid' : 'Unpaid'}${order.primaryMethod ? ` · ${METHOD_LABEL[order.primaryMethod] ?? order.primaryMethod}` : ''}</span></div>` +
    `<div class="hr"></div>` +
    `<div class="c mut">${esc(branding.receiptFooter || 'Thank you — see you soon')}</div>`;

  return shell(widthMm, body);
}

export interface LabelTag {
  id: string;
  code?: string | null;
  name?: string | null;
  orderNumber?: number | string | null;
  customerName?: string | null;
  index?: number | null;
  total?: number | null;
}

export function renderLabel(tag: LabelTag, brandName = '', widthMm = 80): string {
  const code = tag.code || tag.id;
  const seq = tag.index != null && tag.total != null ? `${tag.index}/${tag.total}` : '';
  const body =
    `<div class="c">` +
    (brandName ? `<div class="b" style="font-size:11px">${esc(brandName)}</div>` : '') +
    `<div class="row" style="justify-content:center;gap:10px;font-size:13px;font-weight:700">` +
    (tag.orderNumber != null ? `<span>#${esc(tag.orderNumber)}</span>` : '') +
    (seq ? `<span class="mut">${esc(seq)}</span>` : '') +
    `</div>` +
    (tag.name ? `<div style="font-size:13px;margin:2px 0">${esc(tag.name)}</div>` : '') +
    (tag.customerName ? `<div class="mut">${esc(tag.customerName)}</div>` : '') +
    `<div style="margin:6px 0 2px">${code128Svg(code, Math.round(widthMm * 3.4), 54)}</div>` +
    `<div class="b" style="letter-spacing:.12em;font-size:13px">${esc(code)}</div>` +
    `</div>`;
  return shell(widthMm, body);
}

export interface ZReportData {
  storeName?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  cashier?: string | null;
  currency?: string | null;
  expectedDrawer: number | string;
  countedDrawer?: number | string | null;
  rangeLabel?: string | null;
  methods: Array<{ label: string; amount: number | string }>;
  grossSales: number | string;
  orders: number;
  refunds?: number | string;
}

export function renderZReport(z: ZReportData, brandName = '', widthMm = 80): string {
  const cur = z.currency || 'AED';
  const counted = z.countedDrawer != null ? Number(z.countedDrawer) : null;
  const variance = counted != null ? counted - Number(z.expectedDrawer) : null;
  const methodRows = z.methods
    .map((m) => `<div class="row"><span>${esc(m.label)}</span><span>${money(cur, m.amount)}</span></div>`)
    .join('');
  const body =
    `<div class="c"><div class="bn">${esc(brandName || 'Z-Report')}</div>` +
    `<div class="mut">End-of-day · ${esc(z.rangeLabel || 'Today')}</div>` +
    (z.storeName ? `<div class="mut">${esc(z.storeName)}</div>` : '') +
    `</div><div class="hr"></div>` +
    (z.cashier ? `<div class="row mut"><span>Cashier</span><span>${esc(z.cashier)}</span></div>` : '') +
    (z.openedAt ? `<div class="row mut"><span>Opened</span><span>${esc(new Date(z.openedAt).toLocaleString('en-GB'))}</span></div>` : '') +
    (z.closedAt ? `<div class="row mut"><span>Closed</span><span>${esc(new Date(z.closedAt).toLocaleString('en-GB'))}</span></div>` : '') +
    `<div class="hr"></div>` +
    `<div class="b">Payments</div>${methodRows}` +
    `<div class="hr"></div>` +
    `<div class="row"><span>Gross sales</span><span>${money(cur, z.grossSales)}</span></div>` +
    `<div class="row"><span>Orders</span><span>${z.orders}</span></div>` +
    (z.refunds != null && Number(z.refunds) > 0 ? `<div class="row"><span>Refunds</span><span>−${money(cur, z.refunds)}</span></div>` : '') +
    `<div class="hr"></div>` +
    `<div class="row"><span>Expected drawer</span><span>${money(cur, z.expectedDrawer)}</span></div>` +
    (counted != null ? `<div class="row"><span>Counted</span><span>${money(cur, counted)}</span></div>` : '') +
    (variance != null
      ? `<div class="row t"><span>${variance === 0 ? 'Balanced' : variance > 0 ? 'Over' : 'Short'}</span><span>${variance >= 0 ? '' : '−'}${money(cur, Math.abs(variance))}</span></div>`
      : '') +
    `<div class="hr"></div>` +
    `<div class="c mut">${esc(new Date().toLocaleString('en-GB'))}</div>`;
  return shell(widthMm, body);
}

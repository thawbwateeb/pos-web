import { api } from './api-client';
import {
  connectQz,
  printHtml,
  kickDrawer,
  defaultPrinter,
  getQzStatus,
} from './qz';
import {
  renderReceipt,
  renderLabel,
  renderZReport,
  type ReceiptOrder,
  type ReceiptBranding,
  type ReceiptStore,
  type ReceiptTax,
  type LabelTag,
  type ZReportData,
} from './print-render';

/* ───────────────────────────── job types (server fallback) ───────────── */

export type PrintJobType = 'RECEIPT' | 'LABEL' | 'SHIFT_REPORT';

export interface PrintJobBase { storeId?: string }
export interface ReceiptPrintJob extends PrintJobBase { type: 'RECEIPT'; orderId: string }
export interface ShiftReportPrintJob extends PrintJobBase { type: 'SHIFT_REPORT'; shiftId?: string; payload?: { range?: string; from?: string; to?: string } }
export interface LabelPrintJob extends PrintJobBase { type: 'LABEL'; garmentTagId: string }
export type PrintJob = ReceiptPrintJob | ShiftReportPrintJob | LabelPrintJob;
export interface PrintJobResult { id: string; status: 'QUEUED' | 'SENT' | 'FAILED' }

/** Server-side enqueue — kept as an audit trail + fallback when QZ is absent. */
export async function enqueueServerPrintJob(job: PrintJob): Promise<PrintJobResult> {
  return api<PrintJobResult>('/print-jobs', { method: 'POST', body: job, storeId: job.storeId });
}

/* ───────────────────────────── printer config (per terminal) ─────────── */

/**
 * Which OS printer each logical device maps to is a property of the physical
 * terminal, not the business — so it lives in localStorage, keyed by store
 * (one terminal can be signed into multiple stores).
 */
export interface QzPrinterConfig {
  receiptPrinter: string | null;
  labelPrinter: string | null;
  widthMm: number;
  copies: number;
  drawerKick: boolean;
}

const DEFAULT_CFG: QzPrinterConfig = {
  receiptPrinter: null, labelPrinter: null, widthMm: 80, copies: 1, drawerKick: true,
};

const cfgKey = (storeId?: string) => `twt.qz.printers.${storeId ?? 'default'}`;

export function getQzPrinterConfig(storeId?: string): QzPrinterConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_CFG };
  try {
    const raw = localStorage.getItem(cfgKey(storeId));
    return raw ? { ...DEFAULT_CFG, ...JSON.parse(raw) } : { ...DEFAULT_CFG };
  } catch {
    return { ...DEFAULT_CFG };
  }
}

export function setQzPrinterConfig(storeId: string | undefined, cfg: Partial<QzPrinterConfig>): QzPrinterConfig {
  const next = { ...getQzPrinterConfig(storeId), ...cfg };
  try { localStorage.setItem(cfgKey(storeId), JSON.stringify(next)); } catch { /* private mode */ }
  return next;
}

/* ───────────────────────────── receipt context cache ─────────────────── */

interface PrintContext { branding: ReceiptBranding; store: ReceiptStore; tax: ReceiptTax | null }
let ctx: PrintContext | null = null;

/** AppShell calls this from bootstrap so any screen can print without prop-drilling. */
export function setPrintContext(value: PrintContext): void { ctx = value; }
function brandName(): string { return ctx?.branding.brandName || 'Thawb Wa Teeb'; }

/* ───────────────────────────── browser fallback ──────────────────────── */

/** Last-resort print when QZ Tray isn't installed: render in a hidden iframe. */
function printViaBrowser(html: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve();
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    frame.srcdoc = html;
    frame.onload = () => {
      try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { /* noop */ }
      setTimeout(() => { frame.remove(); resolve(); }, 1000);
    };
    document.body.appendChild(frame);
  });
}

async function sendHtml(printer: string | null, html: string, widthMm: number, copies: number): Promise<void> {
  // QZ Tray when reachable; browser print dialog otherwise.
  try {
    await connectQz();
    const target = printer || (await defaultPrinter());
    if (!target) throw new Error('no printer');
    await printHtml(target, html, { widthMm, copies });
  } catch {
    await printViaBrowser(html);
  }
}

/* ───────────────────────────── high-level jobs ───────────────────────── */

export async function printReceipt(order: ReceiptOrder & { id?: string }, storeId?: string): Promise<void> {
  const cfg = getQzPrinterConfig(storeId);
  const html = renderReceipt(order, ctx?.branding ?? { brandName: brandName() }, ctx?.store ?? {}, ctx?.tax, cfg.widthMm);
  await sendHtml(cfg.receiptPrinter, html, cfg.widthMm, cfg.copies);
  // Kick the drawer on cash payments if the terminal is configured for it.
  if (cfg.drawerKick && order.primaryMethod === 'CASH' && getQzStatus() === 'connected') {
    try { await kickDrawer(cfg.receiptPrinter || (await defaultPrinter()) || ''); } catch { /* drawer optional */ }
  }
  // Best-effort server record (non-blocking, ignored if it fails).
  if (order.id) enqueueServerPrintJob({ type: 'RECEIPT', orderId: order.id, storeId }).catch(() => {});
}

export async function printLabels(tags: LabelTag[], storeId?: string): Promise<void> {
  const cfg = getQzPrinterConfig(storeId);
  for (const tag of tags) {
    const html = renderLabel(tag, brandName(), cfg.widthMm);
    await sendHtml(cfg.labelPrinter || cfg.receiptPrinter, html, cfg.widthMm, 1);
  }
}

export async function printZReport(data: ZReportData, storeId?: string): Promise<void> {
  const cfg = getQzPrinterConfig(storeId);
  const html = renderZReport({ ...data, currency: data.currency ?? ctx?.branding.currency ?? 'AED' }, brandName(), cfg.widthMm);
  await sendHtml(cfg.receiptPrinter, html, cfg.widthMm, cfg.copies);
}

/** Configure-modal "Test" action: print a tiny diagnostic to the chosen device. */
export async function testPrint(device: 'receipt' | 'label', storeId?: string): Promise<void> {
  const cfg = getQzPrinterConfig(storeId);
  if (device === 'label') {
    await printLabels([{ id: 'TEST-0001', name: 'Test label', orderNumber: '0000' }], storeId);
    return;
  }
  const html = renderReceipt(
    {
      number: 0, createdAt: new Date().toISOString(), subtotal: 0, total: 0,
      items: [{ nameSnapshot: 'Test print', tierSnapshot: 'Diagnostic', qty: 1, lineTotal: 0 }],
      paid: true, primaryMethod: 'CASH',
    },
    ctx?.branding ?? { brandName: brandName() }, ctx?.store ?? {}, ctx?.tax, cfg.widthMm,
  );
  await sendHtml(cfg.receiptPrinter, html, cfg.widthMm, 1);
}

/* ───────────────────────────── compat shim ───────────────────────────── */

/**
 * Backward-compatible entry point. Resolves the data a QZ render needs, prints
 * locally, and falls back to the server queue when that isn't possible.
 */
export async function enqueuePrintJob(job: PrintJob): Promise<PrintJobResult> {
  try {
    if (job.type === 'RECEIPT') {
      const order = await api<ReceiptOrder & { id: string }>(`/orders/${job.orderId}`, { storeId: job.storeId });
      await printReceipt(order, job.storeId);
      return { id: job.orderId, status: 'SENT' };
    }
  } catch {
    /* fall through to server enqueue */
  }
  return enqueueServerPrintJob(job);
}

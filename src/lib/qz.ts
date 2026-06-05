'use client';

/**
 * QZ Tray client wrapper.
 *
 * QZ Tray (https://qz.io) is a small app the cashier installs on the
 * terminal; it bridges the browser to locally-attached USB/network
 * printers and the cash drawer over a localhost WebSocket (wss://localhost:8181).
 *
 * This module is the single place that talks to it. It is browser-only —
 * `qz-tray` touches `window`/`WebSocket`, so we dynamic-import it and guard
 * every entry point with a `typeof window` check so SSR never loads it.
 *
 * Signing: production QZ deployments sign each request with a private key so
 * the tray app trusts them silently. We run in DEV/unsigned mode (per product
 * decision — no paid signing cert yet): the certificate + signature promises
 * resolve empty, and QZ Tray shows its native "Allow / Remember" prompt the
 * first time. "Remember this site" suppresses it thereafter.
 */

type QZ = any;

let qzPromise: Promise<QZ> | null = null;

/** Lazily import + configure the qz-tray singleton (browser only). */
async function loadQz(): Promise<QZ> {
  if (typeof window === 'undefined') throw new Error('QZ Tray is browser-only');
  if (qzPromise) return qzPromise;
  qzPromise = (async () => {
    const mod = await import('qz-tray');
    const qz: QZ = (mod as any).default ?? mod;

    // qz-tray needs a Promise factory + a sha256 impl for the signing
    // handshake. Native Promise is fine; sha256 is only exercised when a
    // real cert is configured, but we wire a Web Crypto shim defensively.
    if (qz.api?.setPromiseType) {
      qz.api.setPromiseType((resolver: any) => new Promise(resolver));
    }
    if (qz.api?.setSha256Type) {
      // Must return the hash (or a Promise of it) DIRECTLY — not a function.
      // Paired with setPromiseType above, qz-tray awaits this Promise during
      // the signing handshake. The previous `() => async () => …` form handed
      // qz a function where a digest was expected and would break real signing.
      qz.api.setSha256Type((data: string) =>
        crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)).then((buf) =>
          Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(''),
        ),
      );
    }

    // Unsigned / dev-mode security: empty cert + empty signature.
    qz.security?.setCertificatePromise((resolve: any) => resolve());
    qz.security?.setSignatureAlgorithm?.('SHA512');
    qz.security?.setSignaturePromise(() => (resolve: any) => resolve());

    return qz;
  })();
  return qzPromise;
}

export type QzStatus = 'disconnected' | 'connecting' | 'connected' | 'unavailable';

let status: QzStatus = 'disconnected';
const listeners = new Set<(s: QzStatus) => void>();

function setStatus(s: QzStatus) {
  status = s;
  listeners.forEach((fn) => fn(s));
}

export function getQzStatus(): QzStatus {
  return status;
}

/** Subscribe to connection-status changes. Returns an unsubscribe fn. */
export function onQzStatus(fn: (s: QzStatus) => void): () => void {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

function qzHost(): string {
  return process.env.NEXT_PUBLIC_QZ_HOST || 'localhost';
}

/**
 * Ensure a live connection to QZ Tray. Idempotent — returns the same active
 * connection if one is already open. Tries secure wss first, then insecure ws
 * (some installs only expose the unsecured port). Throws if the tray app
 * isn't running / reachable.
 */
export async function connectQz(): Promise<void> {
  if (typeof window === 'undefined') return;
  const qz = await loadQz();
  if (qz.websocket.isActive()) {
    setStatus('connected');
    return;
  }
  setStatus('connecting');
  try {
    await qz.websocket.connect({ host: qzHost(), usingSecure: true, retries: 1, delay: 1 });
  } catch {
    // Fall back to the unsecured port.
    await qz.websocket.connect({ host: qzHost(), usingSecure: false, retries: 1, delay: 1 });
  }
  // Reflect tray-initiated closes (app quit, sleep) back into our status.
  qz.websocket.setClosedCallbacks?.(() => setStatus('disconnected'));
  setStatus('connected');
}

/** Best-effort auto-connect used on app load. Never throws. */
export async function autoConnectQz(): Promise<boolean> {
  try {
    await connectQz();
    return true;
  } catch {
    setStatus('unavailable');
    return false;
  }
}

export async function disconnectQz(): Promise<void> {
  if (typeof window === 'undefined') return;
  const qz = await loadQz();
  if (qz.websocket.isActive()) await qz.websocket.disconnect();
  setStatus('disconnected');
}

/** List installed printer names. */
export async function listPrinters(): Promise<string[]> {
  await connectQz();
  const qz = await loadQz();
  const found = await qz.printers.find();
  return Array.isArray(found) ? found : [found];
}

export async function defaultPrinter(): Promise<string | null> {
  await connectQz();
  const qz = await loadQz();
  try {
    return await qz.printers.getDefault();
  } catch {
    return null;
  }
}

export interface HtmlPrintOptions {
  /** Physical paper width in mm (thermal rolls are 58 or 80). */
  widthMm?: number;
  copies?: number;
}

/**
 * Print an HTML document to `printer`. HTML rendering works across thermal
 * and laser printers alike, so receipts and labels both use this path.
 */
export async function printHtml(
  printer: string,
  html: string,
  opts: HtmlPrintOptions = {},
): Promise<void> {
  await connectQz();
  const qz = await loadQz();
  const widthMm = opts.widthMm ?? 80;
  const config = qz.configs.create(printer, {
    copies: opts.copies ?? 1,
    margins: 0,
    // Thermal rolls are continuous: fix the width, let height auto-flow.
    size: { width: widthMm, height: null },
    units: 'mm',
    rasterize: false,
  });
  await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
}

/**
 * Send raw bytes (ESC/POS) to `printer`. `flavor` defaults to 'hex' because
 * the drawer-kick pulse contains non-ASCII bytes (0x19, 0xFA) that get
 * corrupted when sent as a 'plain' UTF-8 string.
 */
export async function printRaw(
  printer: string,
  data: string,
  flavor: 'plain' | 'hex' = 'hex',
): Promise<void> {
  await connectQz();
  const qz = await loadQz();
  const config = qz.configs.create(printer);
  await qz.print(config, [{ type: 'raw', format: 'command', flavor, data }]);
}

/**
 * Open the cash drawer wired to the receipt printer via the standard
 * ESC/POS kick pulse (ESC p 0 25 250 = 1B 70 00 19 FA). Sent as hex so the
 * non-ASCII bytes survive transport intact.
 */
export async function kickDrawer(printer: string): Promise<void> {
  await printRaw(printer, '1B700019FA', 'hex');
}

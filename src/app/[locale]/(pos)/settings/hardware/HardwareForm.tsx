'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import StoreSyncControls from '@/components/StoreSyncControls';
import { useActiveStoreId } from '@/components/BootstrapContext';
import {
  connectQz, disconnectQz, listPrinters, onQzStatus, type QzStatus,
} from '@/lib/qz';
import { getQzPrinterConfig, setQzPrinterConfig, testPrint, printErrorKey, type QzPrinterConfig } from '@/lib/print';

/* ───────────────────────── device + option model ─────────────────────────
 * Mirrors the design source of truth: app.js HW array (1466), hwConfig state
 * (171–177) and hwConfigBody() option lists (2110–2131). Brand/model lists are
 * proper nouns — kept verbatim, not translated. */
type HwKey = 'printer' | 'terminal' | 'drawer' | 'labels';

const PRINTER_BRANDS = ['Epson TM-m30', 'Star mC-Print3', 'Bixolon SRP-330', 'Citizen CT-S310', 'Generic ESC/POS'];
const PRINTER_WIDTHS = ['80 mm', '58 mm'];
const PRINTER_COPIES = [1, 2, 3];
const PRINTER_MODES = ['Auto after payment', 'Manual button', 'Prompt each time'];
const TERMINAL_BRANDS = ['Stripe BBPOS WisePad 3', 'Stripe Reader S700', 'Verifone P400', 'Ingenico Move/5000', 'Network International N5'];
const TERMINAL_CONNS = ['Bluetooth', 'USB', 'LAN / Ethernet', 'Wi-Fi'];
const DRAWER_BRANDS = ['APG Vasario 1616', 'Star CD3-1616', 'Posiflex CR-4000', 'Generic RJ11'];
const DRAWER_TRIGGERS = ['After cash payment', 'Manual button only', 'After every sale'];
const DRAWER_KICKS = ['Standard (RJ11 pin 2)', 'Alternate (RJ11 pin 5)'];
const LABEL_BRANDS = ['Brother QL-820NWB', 'Zebra ZD410', 'Godex DT4x', 'Generic'];
const LABEL_SIZES = ['29 × 90 mm', '38 × 90 mm', '62 × 100 mm'];
const LABEL_FIELDS = ['name', 'orderNo', 'item', 'tier', 'date', 'barcode'] as const;
const RECEIPT_KEYS = ['logo', 'orderNo', 'customer', 'custId', 'items', 'tier', 'vat', 'qr', 'footer'] as const;

interface PrinterCfg { connected: boolean; brand: string; width: string; copies: number; mode: string; drawerKick: boolean; receipt: { k: string; on: boolean }[] }
interface TerminalCfg { connected: boolean; brand: string; conn: string; tipping: boolean; contactless: boolean }
interface DrawerCfg { connected: boolean; brand: string; trigger: string; kick: string }
interface LabelsCfg { connected: boolean; brand: string; size: string; content: Record<string, boolean> }
interface HwShape { printer: PrinterCfg; terminal: TerminalCfg; drawer: DrawerCfg; labels: LabelsCfg }

const DEFAULT_HW: HwShape = {
  printer: {
    connected: true, brand: 'Epson TM-m30', width: '80 mm', copies: 1, mode: 'Auto after payment', drawerKick: true,
    receipt: RECEIPT_KEYS.map((k) => ({ k, on: true })),
  },
  terminal: { connected: true, brand: 'Stripe BBPOS WisePad 3', conn: 'Bluetooth', tipping: false, contactless: true },
  drawer: { connected: true, brand: 'APG Vasario 1616', trigger: 'After cash payment', kick: 'Standard (RJ11 pin 2)' },
  labels: { connected: false, brand: 'Brother QL-820NWB', size: '29 × 90 mm', content: Object.fromEntries(LABEL_FIELDS.map((k) => [k, true])) },
};

const DEVICE_ORDER: HwKey[] = ['printer', 'terminal', 'drawer', 'labels'];
const DEVICE_NAME: Record<HwKey, string> = { printer: 'Receipt Printer', terminal: 'Card Terminal', drawer: 'Cash Drawer', labels: 'Label Printer' };

function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

/** Normalize a server row into the full shape, backfilling any missing field. */
function fromApi(json: any): HwShape {
  const out: HwShape = clone(DEFAULT_HW);
  if (!json || typeof json !== 'object') return out;
  for (const key of DEVICE_ORDER) {
    const j = json[key];
    if (j && typeof j === 'object') {
      out[key] = { ...(out[key] as any), ...j };
      if (key === 'printer') {
        const r = Array.isArray((j as any).receipt) ? (j as any).receipt : out.printer.receipt;
        out.printer.receipt = RECEIPT_KEYS.map((k) => {
          const found = r.find((x: any) => x?.k === k);
          return { k, on: found ? found.on !== false : true };
        });
      }
      if (key === 'labels') out.labels.content = { ...DEFAULT_HW.labels.content, ...((j as any).content ?? {}) };
    }
  }
  return out;
}

export default function HardwareForm() {
  const storeId = useActiveStoreId();
  const t = useTranslations('Settings.hardware');
  const tc = useTranslations('Common');
  const tPrint = useTranslations('Print');
  const [hw, setHw] = useState<HwShape>(DEFAULT_HW);
  const [loaded, setLoaded] = useState(false);
  const [configKey, setConfigKey] = useState<HwKey | null>(null);
  const [draft, setDraft] = useState<HwShape[HwKey] | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // QZ Tray connection + per-terminal printer assignment.
  const [qz, setQz] = useState<QzStatus>('disconnected');
  const [printers, setPrinters] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [cfg, setCfg] = useState<QzPrinterConfig>(() => getQzPrinterConfig(storeId));

  useEffect(() => onQzStatus(setQz), []);
  useEffect(() => { setCfg(getQzPrinterConfig(storeId)); }, [storeId]);

  function loadPrinters() {
    setRefreshing(true);
    listPrinters().then((p) => setPrinters(p)).catch(() => {}).finally(() => setRefreshing(false));
  }
  // Load printer names once connected.
  useEffect(() => {
    if (qz !== 'connected') { setPrinters([]); return; }
    let alive = true;
    setRefreshing(true);
    listPrinters().then((p) => { if (alive) setPrinters(p); }).catch(() => {}).finally(() => { if (alive) setRefreshing(false); });
    return () => { alive = false; };
  }, [qz]);

  useEffect(() => {
    if (!storeId) { setLoaded(true); return; }
    setLoaded(false);
    api<any>(`/hardware/${storeId}`).then((d) => { setHw(fromApi(d)); setLoaded(true); })
      .catch(() => { setHw(clone(DEFAULT_HW)); setLoaded(true); });
  }, [storeId]);

  /** Persist the full hardware shape, optimistically. */
  async function persist(next: HwShape) {
    setHw(next);
    if (storeId) await api(`/hardware/${storeId}`, { method: 'PUT', body: next });
  }

  function toggle(key: HwKey) {
    const next: HwShape = { ...hw, [key]: { ...hw[key], connected: !hw[key].connected } };
    persist(next).catch(() => toast.show(t('saveFailed'), 'error'));
  }

  function patchCfg(p: Partial<QzPrinterConfig>) { setCfg(setQzPrinterConfig(storeId, p)); }

  function openConfig(key: HwKey) { setConfigKey(key); setDraft(clone(hw[key])); }
  function closeConfig() { setConfigKey(null); setDraft(null); setDragIdx(null); }

  async function saveConfig() {
    if (!configKey || !draft) return;
    setSaving(true);
    const next: HwShape = { ...hw, [configKey]: draft } as HwShape;
    try {
      await persist(next);
      // Mirror physical print params into the per-terminal QZ config so the
      // print path (lib/print) picks them up immediately.
      if (configKey === 'printer') {
        const p = draft as PrinterCfg;
        patchCfg({ widthMm: parseInt(p.width, 10) || 80, copies: p.copies, drawerKick: p.drawerKick });
      }
      closeConfig();
      toast.show(t('configSaved'));
    } catch {
      toast.show(t('saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function runTest(device: 'receipt' | 'label') {
    try { await testPrint(device, storeId); toast.show(t('testSent')); }
    catch (e: any) { toast.show(tPrint(printErrorKey(e)), 'error'); }
  }

  const statusLabel =
    qz === 'connected' ? t('qzConnected')
      : qz === 'connecting' ? t('qzConnecting')
        : qz === 'unavailable' ? t('qzUnavailable')
          : t('qzDisconnected');

  return (
    <div className="set-sec">
      <h2>{t('title')}</h2>
      <div className="ssub">{t('sub')}</div>

      {/* QZ Tray printer bridge — physical OS-printer mapping for this terminal */}
      <div className="set-card" style={{ marginBottom: 14 }}>
        <div className="set-row" style={{ border: 'none', padding: 0 }}>
          <div className="l"><b>{t('qzBridge')}</b><span>{t('qzSub')}</span></div>
          <div className="r" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`hw-stat ${qz === 'connected' ? 'ok' : 'off'}`}>{statusLabel}</span>
            {qz === 'connected' ? (
              <button className="t-btn ghost" onClick={() => disconnectQz()}>{t('disconnect')}</button>
            ) : (
              <button className="t-btn" onClick={() => connectQz().catch(() => toast.show(t('qzUnavailable'), 'error'))}>
                {t('connect')}
              </button>
            )}
          </div>
        </div>

        {qz === 'connected' ? (
          <>
            <div className="set-row">
              <div className="l"><b><label htmlFor="qz-receipt">{t('receiptPrinter')}</label></b></div>
              <div className="setr-field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select id="qz-receipt" className="inp sm" value={cfg.receiptPrinter ?? ''} onChange={(e) => patchCfg({ receiptPrinter: e.target.value || null })}>
                  <option value="">{t('systemDefault')}</option>
                  {printers.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button className="t-btn ghost" onClick={() => runTest('receipt')}>{t('test')}</button>
              </div>
            </div>
            <div className="set-row">
              <div className="l"><b><label htmlFor="qz-label">{t('labelPrinter')}</label></b></div>
              <div className="setr-field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select id="qz-label" className="inp sm" value={cfg.labelPrinter ?? ''} onChange={(e) => patchCfg({ labelPrinter: e.target.value || null })}>
                  <option value="">{t('systemDefault')}</option>
                  {printers.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button className="t-btn ghost" onClick={() => runTest('label')}>{t('test')}</button>
              </div>
            </div>
            <div className="set-row">
              <div className="l"><b>{t('detectedPrinters')}</b><span>{printers.length ? printers.join(' · ') : t('noPrinters')}</span></div>
              <div className="r">
                <button className="t-btn ghost" onClick={loadPrinters} disabled={refreshing}>
                  {refreshing ? t('qzConnecting') : t('refreshPrinters')}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="set-row" style={{ borderTop: '1px solid var(--border-2)' }}>
            <span className="muted" style={{ fontSize: 13 }}>{t('qzHint')}</span>
          </div>
        )}
      </div>

      <div className="set-card" style={{ marginBottom: 14 }}>
        <StoreSyncControls syncEndpoint={`/hardware/${storeId}/sync`} syncLabel={t('copyToStores')} />
      </div>

      {!loaded ? (
        <div className="muted" style={{ padding: 20, fontSize: 13 }}>{tc('loading')}</div>
      ) : (
        DEVICE_ORDER.map((key) => {
          const dev = hw[key];
          const connected = dev.connected;
          const testDevice: 'receipt' | 'label' | null = key === 'labels' ? 'label' : key === 'printer' ? 'receipt' : null;
          return (
            <div className="set-card" key={key}>
              <div className="set-row hw-row" style={{ border: 'none', padding: 0 }}>
                <div className="l"><b id={`hw-lbl-${key}`}>{DEVICE_NAME[key]}</b><span>{dev.brand}</span></div>
                <div className="r" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span className={`hw-stat ${connected ? 'ok' : 'off'}`}>{connected ? t('connected') : t('offline')}</span>
                  <button className="t-btn ghost" data-hwcfg={key} onClick={() => openConfig(key)}>{t('configure')}</button>
                  <button
                    className="t-btn ghost" data-test={DEVICE_NAME[key]}
                    onClick={() => (testDevice ? runTest(testDevice) : toast.show(`${DEVICE_NAME[key]} ✓`))}
                  >
                    {t('test')}
                  </button>
                  <button
                    className={`switch ${connected ? 'on' : ''}`}
                    data-tog={`hardware.${key}`} type="button" role="switch"
                    aria-checked={connected} aria-labelledby={`hw-lbl-${key}`}
                    onClick={() => toggle(key)}
                  />
                </div>
              </div>
            </div>
          );
        })
      )}

      {configKey && draft && (
        <Modal open onClose={closeConfig} className="wide" title={t('configureDevice', { name: DEVICE_NAME[configKey] })}>
          <div className="modal-body" id="hw-body">
            {configKey === 'printer' && renderPrinter(draft as PrinterCfg)}
            {configKey === 'terminal' && renderTerminal(draft as TerminalCfg)}
            {configKey === 'drawer' && renderDrawer(draft as DrawerCfg)}
            {configKey === 'labels' && renderLabels(draft as LabelsCfg)}
          </div>
          <div className="modal-foot">
            <button className="btn btn-ghost" type="button" style={{ flex: 1 }} onClick={closeConfig}>{tc('cancel')}</button>
            <button className={`btn btn-pri${saving ? ' btn-loading' : ''}`} type="button" style={{ flex: 2 }} disabled={saving} onClick={saveConfig}>
              {t('saveConfig')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );

  /* ───────────────────────── per-device dialog bodies ───────────────────── */
  function field(label: string, ctrl: React.ReactNode, id?: string) {
    return <div className="field"><label htmlFor={id}>{label}</label>{ctrl}</div>;
  }
  function selectCtrl(id: string, value: string | number, opts: (string | number)[], onChange: (v: string) => void) {
    return (
      <select id={id} className="input" value={String(value)} onChange={(e) => onChange(e.target.value)}>
        {opts.map((o) => <option key={String(o)} value={String(o)}>{o}</option>)}
      </select>
    );
  }
  function rowSwitch(label: string, on: boolean, onClick: () => void, id: string) {
    return (
      <div className="set-row">
        <div className="l"><b id={id}>{label}</b></div>
        <div className="r">
          <button type="button" className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-labelledby={id} onClick={onClick} />
        </div>
      </div>
    );
  }
  function updateDraft<T extends HwShape[HwKey]>(p: Partial<T>) { setDraft((d) => ({ ...(d as any), ...p })); }

  function renderPrinter(c: PrinterCfg) {
    return (
      <>
        {field(t('config.printerBrand'), selectCtrl('cf-brand', c.brand, PRINTER_BRANDS, (v) => updateDraft<PrinterCfg>({ brand: v })), 'cf-brand')}
        <div className="field-2">
          {field(t('paperWidth'), selectCtrl('cf-width', c.width, PRINTER_WIDTHS, (v) => updateDraft<PrinterCfg>({ width: v })), 'cf-width')}
          {field(t('copies'), selectCtrl('cf-copies', c.copies, PRINTER_COPIES, (v) => updateDraft<PrinterCfg>({ copies: Number(v) })), 'cf-copies')}
        </div>
        {field(t('config.printMode'), selectCtrl('cf-mode', c.mode, PRINTER_MODES, (v) => updateDraft<PrinterCfg>({ mode: v })), 'cf-mode')}
        <div className="set-card" style={{ margin: '4px 0 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>{t('config.receiptContent')}</div>
          {c.receipt.map((r, ri) => (
            <div
              key={r.k} className="rcpt-row" draggable data-rcpt={ri}
              style={{ opacity: dragIdx === ri ? 0.4 : 1 }}
              onDragStart={() => setDragIdx(ri)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); reorderReceipt(ri); }}
              onDragEnd={() => setDragIdx(null)}
            >
              <span className="draghandle" aria-hidden>⠋⠋</span>
              <b style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: r.on ? 'var(--text)' : 'var(--faint)' }}>{t(`receipt.${r.k}` as any)}</b>
              <button
                type="button" className={`switch ${r.on ? 'on' : ''}`} role="switch" aria-checked={r.on}
                aria-label={t(`receipt.${r.k}` as any)} onClick={() => toggleReceipt(ri)}
              />
            </div>
          ))}
        </div>
        {rowSwitch(t('config.drawerKickAfter'), c.drawerKick, () => updateDraft<PrinterCfg>({ drawerKick: !c.drawerKick }), 'cf-drawerkick')}
      </>
    );
  }
  function toggleReceipt(idx: number) {
    setDraft((d) => {
      const p = clone(d as PrinterCfg);
      p.receipt[idx].on = !p.receipt[idx].on;
      return p;
    });
  }
  function reorderReceipt(target: number) {
    if (dragIdx === null || dragIdx === target) return;
    setDraft((d) => {
      const p = clone(d as PrinterCfg);
      const [m] = p.receipt.splice(dragIdx, 1);
      p.receipt.splice(target, 0, m);
      return p;
    });
    setDragIdx(null);
  }

  function renderTerminal(c: TerminalCfg) {
    return (
      <>
        {field(t('config.terminalBrand'), selectCtrl('cf-tbrand', c.brand, TERMINAL_BRANDS, (v) => updateDraft<TerminalCfg>({ brand: v })), 'cf-tbrand')}
        {field(t('config.connection'), selectCtrl('cf-conn', c.conn, TERMINAL_CONNS, (v) => updateDraft<TerminalCfg>({ conn: v })), 'cf-conn')}
        {rowSwitch(t('config.askTip'), c.tipping, () => updateDraft<TerminalCfg>({ tipping: !c.tipping }), 'cf-tip')}
        {rowSwitch(t('config.contactless'), c.contactless, () => updateDraft<TerminalCfg>({ contactless: !c.contactless }), 'cf-contactless')}
      </>
    );
  }

  function renderDrawer(c: DrawerCfg) {
    return (
      <>
        {field(t('config.drawerModel'), selectCtrl('cf-dbrand', c.brand, DRAWER_BRANDS, (v) => updateDraft<DrawerCfg>({ brand: v })), 'cf-dbrand')}
        {field(t('config.openTrigger'), selectCtrl('cf-trigger', c.trigger, DRAWER_TRIGGERS, (v) => updateDraft<DrawerCfg>({ trigger: v })), 'cf-trigger')}
        {field(t('config.kickCode'), selectCtrl('cf-kick', c.kick, DRAWER_KICKS, (v) => updateDraft<DrawerCfg>({ kick: v })), 'cf-kick')}
      </>
    );
  }

  function renderLabels(c: LabelsCfg) {
    return (
      <>
        {field(t('config.labelBrand'), selectCtrl('cf-lbrand', c.brand, LABEL_BRANDS, (v) => updateDraft<LabelsCfg>({ brand: v })), 'cf-lbrand')}
        {field(t('config.labelSize'), selectCtrl('cf-lsize', c.size, LABEL_SIZES, (v) => updateDraft<LabelsCfg>({ size: v })), 'cf-lsize')}
        <div className="set-card" style={{ margin: '4px 0 0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>{t('config.labelContent')}</div>
          {LABEL_FIELDS.map((k) => rowSwitch(
            t(`labelFields.${k}` as any),
            !!c.content[k],
            () => setDraft((d) => { const n = clone(d as LabelsCfg); n.content[k] = !n.content[k]; return n; }),
            `cf-lc-${k}`,
          ))}
        </div>
      </>
    );
  }
}

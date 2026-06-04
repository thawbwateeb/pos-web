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
import { getQzPrinterConfig, setQzPrinterConfig, testPrint, type QzPrinterConfig } from '@/lib/print';

interface HwDevice { key: 'printer' | 'terminal' | 'drawer' | 'labels'; name: string; defaultBrand: string }
const DEVICES: HwDevice[] = [
  { key: 'printer',  name: 'Receipt Printer', defaultBrand: 'Epson TM-m30' },
  { key: 'terminal', name: 'Card Terminal',   defaultBrand: 'Stripe BBPOS WisePad 3' },
  { key: 'drawer',   name: 'Cash Drawer',     defaultBrand: 'APG Vasario 1616' },
  { key: 'labels',   name: 'Label Printer',   defaultBrand: 'Brother QL-820NWB' },
];

interface DeviceState { brand: string; connected: boolean }
type HwShape = Record<HwDevice['key'], DeviceState>;

const DEFAULT_HW: HwShape = {
  printer:  { brand: 'Epson TM-m30',           connected: true  },
  terminal: { brand: 'Stripe BBPOS WisePad 3', connected: true  },
  drawer:   { brand: 'APG Vasario 1616',       connected: true  },
  labels:   { brand: 'Brother QL-820NWB',      connected: false },
};

function fromApi(json: any): HwShape {
  const out: HwShape = JSON.parse(JSON.stringify(DEFAULT_HW));
  if (!json) return out;
  for (const d of DEVICES) {
    const j = json[d.key];
    if (j && typeof j === 'object') {
      out[d.key] = { brand: typeof j.brand === 'string' ? j.brand : d.defaultBrand, connected: !!j.connected };
    }
  }
  return out;
}

export default function HardwareForm() {
  const storeId = useActiveStoreId();
  const t = useTranslations('Settings.hardware');
  const tc = useTranslations('Common');
  const [hw, setHw] = useState<HwShape>(DEFAULT_HW);
  const [loaded, setLoaded] = useState(false);
  const [config, setConfig] = useState<string | null>(null);
  const toast = useToast();

  // QZ Tray connection + per-terminal printer assignment.
  const [qz, setQz] = useState<QzStatus>('disconnected');
  const [printers, setPrinters] = useState<string[]>([]);
  const [cfg, setCfg] = useState<QzPrinterConfig>(() => getQzPrinterConfig(storeId));

  useEffect(() => onQzStatus(setQz), []);
  useEffect(() => { setCfg(getQzPrinterConfig(storeId)); }, [storeId]);

  // Load printer names once connected.
  useEffect(() => {
    if (qz !== 'connected') return;
    let alive = true;
    listPrinters().then((p) => { if (alive) setPrinters(p); }).catch(() => {});
    return () => { alive = false; };
  }, [qz]);

  useEffect(() => {
    if (!storeId) { setLoaded(true); return; }
    setLoaded(false);
    api<any>(`/hardware/${storeId}`).then((d) => { setHw(fromApi(d)); setLoaded(true); })
      .catch(() => { setHw(DEFAULT_HW); setLoaded(true); });
  }, [storeId]);

  function toggle(key: HwDevice['key']) {
    setHw((prev) => {
      const next: HwShape = { ...prev, [key]: { ...prev[key], connected: !prev[key].connected } };
      if (storeId) api(`/hardware/${storeId}`, { method: 'PUT', body: next }).catch(() => toast.show(t('saveFailed'), 'error'));
      return next;
    });
  }

  function patchCfg(p: Partial<QzPrinterConfig>) {
    setCfg(setQzPrinterConfig(storeId, p));
  }

  const statusLabel =
    qz === 'connected' ? t('qzConnected')
      : qz === 'connecting' ? t('qzConnecting')
        : qz === 'unavailable' ? t('qzUnavailable')
          : t('qzDisconnected');

  async function runTest(device: 'receipt' | 'label') {
    try { await testPrint(device, storeId); toast.show(t('testSent')); }
    catch (e: any) { toast.show(e?.message ?? t('saveFailed'), 'error'); }
  }

  return (
    <div className="set-sec">
      <h2>{t('title')}</h2>
      <div className="ssub">{t('sub')}</div>

      {/* QZ Tray printer bridge */}
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
              <div className="l"><b>{t('receiptPrinter')}</b></div>
              <div className="setr-field" style={{ display: 'flex', gap: 8 }}>
                <select className="inp sm" value={cfg.receiptPrinter ?? ''} onChange={(e) => patchCfg({ receiptPrinter: e.target.value || null })}>
                  <option value="">{t('systemDefault')}</option>
                  {printers.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button className="t-btn ghost" onClick={() => runTest('receipt')}>{t('test')}</button>
              </div>
            </div>
            <div className="set-row">
              <div className="l"><b>{t('labelPrinter')}</b></div>
              <div className="setr-field" style={{ display: 'flex', gap: 8 }}>
                <select className="inp sm" value={cfg.labelPrinter ?? ''} onChange={(e) => patchCfg({ labelPrinter: e.target.value || null })}>
                  <option value="">{t('systemDefault')}</option>
                  {printers.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button className="t-btn ghost" onClick={() => runTest('label')}>{t('test')}</button>
              </div>
            </div>
            <div className="set-row">
              <div className="l"><b>{t('paperWidth')}</b></div>
              <div className="setr-field">
                <select className="inp sm" value={cfg.widthMm} onChange={(e) => patchCfg({ widthMm: Number(e.target.value) })}>
                  <option value={58}>58 mm</option>
                  <option value={80}>80 mm</option>
                </select>
              </div>
            </div>
            <div className="set-row">
              <div className="l"><b>{t('copies')}</b></div>
              <div className="setr-field">
                <input className="inp sm" type="number" min={1} max={5} value={cfg.copies}
                  onChange={(e) => patchCfg({ copies: Math.max(1, Number(e.target.value) || 1) })} />
              </div>
            </div>
            <div className="set-row">
              <div className="l"><b>{t('drawerKick')}</b></div>
              <button
                className={`switch ${cfg.drawerKick ? 'on' : ''}`}
                type="button" role="switch" aria-checked={cfg.drawerKick}
                onClick={() => patchCfg({ drawerKick: !cfg.drawerKick })}
              />
            </div>
          </>
        ) : (
          <div className="set-row" style={{ borderTop: '1px solid var(--border-2)' }}>
            <span className="muted" style={{ fontSize: 13 }}>{t('qzHint')}</span>
          </div>
        )}
      </div>

      <div className="set-card" style={{ marginBottom: 14 }}>
        <StoreSyncControls syncEndpoint={`/hardware/${storeId}/sync`} syncLabel="Copy these settings to all other stores" />
      </div>

      {!loaded ? (
        <div className="muted" style={{ padding: 20, fontSize: 13 }}>{tc('loading')}</div>
      ) : (
        DEVICES.map((d) => {
          const dev = hw[d.key];
          const connected = dev.connected;
          const testDevice: 'receipt' | 'label' | null =
            d.key === 'labels' ? 'label' : d.key === 'printer' ? 'receipt' : null;
          return (
            <div className="set-card" key={d.key}>
              <div className="set-row" style={{ border: 'none', padding: 0 }}>
                <div className="l"><b id={`hw-lbl-${d.key}`}>{d.name}</b><span>{dev.brand}</span></div>
                <div className="r" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`hw-stat ${connected ? 'ok' : 'off'}`}>{connected ? t('connected') : t('offline')}</span>
                  <button className="t-btn ghost" data-hwcfg={d.key} onClick={() => setConfig(d.key)}>{t('configure')}</button>
                  <button
                    className="t-btn ghost" data-test={d.name}
                    onClick={() => (testDevice ? runTest(testDevice) : toast.show(`${d.name} ✓`))}
                  >
                    {t('test')}
                  </button>
                  <button
                    className={`switch ${connected ? 'on' : ''}`}
                    data-tog={`hardware.${d.key}`} type="button" role="switch"
                    aria-checked={connected} aria-labelledby={`hw-lbl-${d.key}`}
                    onClick={() => toggle(d.key)}
                  />
                </div>
              </div>
            </div>
          );
        })
      )}

      {config && (
        <Modal open onClose={() => setConfig(null)} title={t('configureDevice', { name: DEVICES.find((x) => x.key === config)!.name })}>
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              const key = config as HwDevice['key'];
              const f = new FormData(e.currentTarget);
              const next: HwShape = { ...hw, [key]: { ...hw[key], brand: String(f.get('brand')) } };
              try {
                if (storeId) await api(`/hardware/${storeId}`, { method: 'PUT', body: next });
                setHw(next); setConfig(null); toast.show(tc('saved'));
              } catch (err: any) {
                toast.show(err?.detail?.message ?? t('saveFailed'), 'error');
              }
            }}
          >
            <label>{t('brand')}<input name="brand" defaultValue={hw[config as HwDevice['key']].brand ?? ''} /></label>
            <div className="modal-foot"><button className="btn btn-pri" type="submit">{tc('save')}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

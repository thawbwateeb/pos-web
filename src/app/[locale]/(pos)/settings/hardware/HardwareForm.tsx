'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import StoreSyncControls, { type StoreOption } from '@/components/StoreSyncControls';

/* Design app.js:1347 (HW[]) + 1411-1417 (hardware body):
   - .set-sec h2 'Hardware' + .ssub 'Connected devices · choose brand,
     configure receipt & printing'
   - For each of 4 devices: .set-card with one .set-row border:none
     padding:0:
     - .l <b>name</b><span>cfg.brand</span>
     - .r <span class='hw-stat ok|off'>Connected|Offline</span>
       + .t-btn.ghost 'Configure' (data-hwcfg=\${k})
       + .t-btn.ghost 'Test' (data-test=\${name})
       + switch (data-tog='hardware.\${k}')

   Extension: storage is per-store via the existing /hardware/:storeId
   API. A StoreSyncControls bar at the top lets the user pick the active
   store and POST /hardware/:storeId/sync to copy the current config to
   every other store in the business. */

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
  printer:  { brand: 'Epson TM-m30',             connected: true  },
  terminal: { brand: 'Stripe BBPOS WisePad 3',   connected: true  },
  drawer:   { brand: 'APG Vasario 1616',         connected: true  },
  labels:   { brand: 'Brother QL-820NWB',        connected: false },
};

function fromApi(json: any): HwShape {
  const out: HwShape = JSON.parse(JSON.stringify(DEFAULT_HW));
  if (!json) return out;
  for (const d of DEVICES) {
    const j = json[d.key];
    if (j && typeof j === 'object') {
      out[d.key] = {
        brand: typeof j.brand === 'string' ? j.brand : d.defaultBrand,
        connected: !!j.connected,
      };
    }
  }
  return out;
}

export default function HardwareForm({ stores }: { stores: StoreOption[] }) {
  const [storeId, setStoreId] = useState<string>(stores[0]?.id ?? '');
  const [hw, setHw] = useState<HwShape>(DEFAULT_HW);
  const [loaded, setLoaded] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!storeId) { setLoaded(true); return; }
    setLoaded(false);
    api<any>(`/hardware/${storeId}`).then((d) => {
      setHw(fromApi(d));
      setLoaded(true);
    }).catch(() => {
      setHw(DEFAULT_HW);
      setLoaded(true);
    });
  }, [storeId]);

  function toggle(key: HwDevice['key']) {
    setHw((prev) => {
      const next: HwShape = { ...prev, [key]: { ...prev[key], connected: !prev[key].connected } };
      // Fire-and-forget save so toggling is immediate.
      if (storeId) {
        api(`/hardware/${storeId}`, { method: 'PUT', body: next }).catch(() => toast.show('Failed to save'));
      }
      return next;
    });
  }

  return (
    <div className="set-sec">
      <h2>Hardware</h2>
      <div className="ssub">Connected devices · choose brand, configure receipt &amp; printing</div>

      {stores.length > 0 && (
        <div className="set-card" style={{ marginBottom: 14 }}>
          <StoreSyncControls
            stores={stores}
            storeId={storeId}
            onStoreChange={setStoreId}
            syncEndpoint={`/hardware/${storeId}/sync`}
            syncLabel="Copy these settings to all other stores"
          />
        </div>
      )}

      {!loaded ? (
        <div className="muted" style={{ padding: 20, fontSize: 13 }}>Loading…</div>
      ) : (
        DEVICES.map((d) => {
          const dev = hw[d.key];
          const connected = dev.connected;
          return (
            <div className="set-card" key={d.key}>
              <div className="set-row" style={{ border: 'none', padding: 0 }}>
                <div className="l"><b>{d.name}</b><span>{dev.brand}</span></div>
                <div className="r" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`hw-stat ${connected ? 'ok' : 'off'}`}>
                    {connected ? 'Connected' : 'Offline'}
                  </span>
                  <button
                    className="t-btn ghost"
                    data-hwcfg={d.key}
                    onClick={() => toast.show(`${d.name} configuration (coming soon)`)}
                  >
                    Configure
                  </button>
                  <button
                    className="t-btn ghost"
                    data-test={d.name}
                    onClick={() => toast.show(`${d.name} test message sent`)}
                  >
                    Test
                  </button>
                  <button
                    className={`switch ${connected ? 'on' : ''}`}
                    data-tog={`hardware.${d.key}`}
                    type="button"
                    onClick={() => toggle(d.key)}
                  />
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';

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
   The HW catalogue is static; status and config edit through modals. */

interface HwDevice { key: string; name: string; brand: string }
const DEVICES: HwDevice[] = [
  { key: 'printer',  name: 'Receipt Printer', brand: 'Epson TM-m30' },
  { key: 'terminal', name: 'Card Terminal',   brand: 'Stripe BBPOS WisePad 3' },
  { key: 'drawer',   name: 'Cash Drawer',     brand: 'APG Vasario 1616' },
  { key: 'labels',   name: 'Label Printer',   brand: 'Brother QL-820NWB' },
];

/* Static default connection state — matches design's seeded hardware:
   printer/terminal/drawer connected, labels offline. */
const DEFAULT_HW: Record<string, boolean> = {
  printer: true,
  terminal: true,
  drawer: true,
  labels: false,
};

export default function HardwareForm() {
  const [hw, setHw] = useState<Record<string, boolean>>(DEFAULT_HW);
  const toast = useToast();

  return (
    <div className="set-sec">
      <h2>Hardware</h2>
      <div className="ssub">Connected devices · choose brand, configure receipt &amp; printing</div>
      {DEVICES.map((d) => {
        const connected = !!hw[d.key];
        return (
          <div className="set-card" key={d.key}>
            <div className="set-row" style={{ border: 'none', padding: 0 }}>
              <div className="l"><b>{d.name}</b><span>{d.brand}</span></div>
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
                  onClick={() => setHw({ ...hw, [d.key]: !connected })}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

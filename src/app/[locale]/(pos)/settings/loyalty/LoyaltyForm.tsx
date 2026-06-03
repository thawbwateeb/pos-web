'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

/* Design app.js:1494-1503 — Loyalty Program section.
   - .set-sec > h2 'Loyalty Program' + .ssub 'Reward repeat customers with points'
   - .set-card with 5 .set-row entries:
     - Enable loyalty points (with sub) + switch data-tog='loyalty.enabled'
     - Points earned per AED spent + input id='loy-per'
     - Points needed to redeem AED 1 + input id='loy-redeem'
     - Sign-up welcome bonus (points) + input id='loy-welcome'
     - Last row border:none: Points expiry + select id='loy-exp' with
       Never / 6 months / 12 months / 24 months
   - Save button 'Save Loyalty Settings' (data-save) */

interface LoyaltySettings {
  enabled?: boolean;
  perAed?: number;
  redeemThreshold?: number;
  welcomeBonus?: number;
  expiryMonths?: number;
  expiry?: string; // design-style label
}

const EXPIRY_OPTIONS = ['Never', '6 months', '12 months', '24 months'] as const;

function monthsToLabel(m?: number): string {
  if (m == null || m === 0) return 'Never';
  if (m === 6) return '6 months';
  if (m === 24) return '24 months';
  return '12 months';
}
function labelToMonths(label: string): number {
  if (label === 'Never') return 0;
  if (label === '6 months') return 6;
  if (label === '24 months') return 24;
  return 12;
}

export default function LoyaltyForm({ initial }: { initial: Record<string, unknown> }) {
  const src = initial as LoyaltySettings;
  const [f, setF] = useState({
    enabled: src.enabled ?? true,
    perAed: src.perAed ?? 1,
    redeem: src.redeemThreshold ?? 100,
    welcome: src.welcomeBonus ?? 50,
    expiry: src.expiry ?? monthsToLabel(src.expiryMonths),
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    setBusy(true);
    try {
      await api('/loyalty/settings', {
        method: 'PATCH',
        body: {
          enabled: f.enabled,
          perAed: f.perAed,
          redeemThreshold: f.redeem,
          welcomeBonus: f.welcome,
          expiryMonths: labelToMonths(f.expiry),
        },
      });
      toast.show('Saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="set-sec">
      <h2>Loyalty Program</h2>
      <div className="ssub">Reward repeat customers with points</div>
      <div className="set-card">
        <div className="set-row">
          <div className="l">
            <b id="loyalty-enabled-label">Enable loyalty points</b>
            <span>Customers earn points on every paid order</span>
          </div>
          <div className="r">
            <button
              type="button"
              role="switch"
              aria-checked={f.enabled}
              aria-labelledby="loyalty-enabled-label"
              className={`switch${f.enabled ? ' on' : ''}`}
              data-tog="loyalty.enabled"
              onClick={() => setF({ ...f, enabled: !f.enabled })}
            />
          </div>
        </div>
        <div className="set-row">
          <div className="l"><b>Points earned per AED spent</b></div>
          <div className="r">
            <input
              className="input sm"
              id="loy-per"
              type="number"
              value={f.perAed}
              onChange={(e) => setF({ ...f, perAed: +e.target.value })}
            />
          </div>
        </div>
        <div className="set-row">
          <div className="l"><b>Points needed to redeem AED 1</b></div>
          <div className="r">
            <input
              className="input sm"
              id="loy-redeem"
              type="number"
              value={f.redeem}
              onChange={(e) => setF({ ...f, redeem: +e.target.value })}
            />
          </div>
        </div>
        <div className="set-row">
          <div className="l"><b>Sign-up welcome bonus (points)</b></div>
          <div className="r">
            <input
              className="input sm"
              id="loy-welcome"
              type="number"
              value={f.welcome}
              onChange={(e) => setF({ ...f, welcome: +e.target.value })}
            />
          </div>
        </div>
        <div className="set-row" style={{ border: 'none' }}>
          <div className="l"><b>Points expiry</b></div>
          <div className="r">
            <select
              className="input"
              id="loy-exp"
              value={f.expiry}
              onChange={(e) => setF({ ...f, expiry: e.target.value })}
            >
              {EXPIRY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
          data-save
          onClick={save}
          disabled={busy}
        >
          Save Loyalty Settings
        </button>
      </div>
    </div>
  );
}

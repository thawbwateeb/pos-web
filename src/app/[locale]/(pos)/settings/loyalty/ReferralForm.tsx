'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

/* Design app.js:1504-1512 — Referral Program section.
   - .set-sec margin-top:22 > h2 'Referral Program' + .ssub 'Reward customers
     who invite friends'
   - .set-card with 5 .set-row entries:
     - Enable referrals (with sub) + switch data-tog='referral.enabled'
     - Referrer reward (AED) + sub 'Credit the existing customer earns' +
       input id='ref-rr'
     - Friend reward (AED) + sub 'Discount the new customer gets' +
       input id='ref-fr'
     - Minimum order to qualify (AED) + input id='ref-min'
     - Last row border:none: Pay referrer + sub 'When the reward is credited'
       + select id='ref-payout' with 3 payout values
   - Save button 'Save Referral Settings' (id='ref-save') */

type ReferralPayout = 'on_completion' | 'on_signup' | 'on_payment';

interface ReferralSettings {
  enabled?: boolean;
  referrerReward?: number | string;
  friendReward?: number | string;
  minOrder?: number | string;
  payout?: ReferralPayout | string;
}

interface FormState {
  enabled: boolean;
  referrerReward: number;
  friendReward: number;
  minOrder: number;
  payout: ReferralPayout;
}

const PAYOUT_OPTIONS: { value: ReferralPayout; label: string }[] = [
  { value: 'on_completion', label: "On friend's first completed order" },
  { value: 'on_signup',     label: 'On friend sign-up' },
  { value: 'on_payment',    label: "On friend's first payment" },
];

function toNumber(v: number | string | undefined, fallback: number): number {
  if (v === undefined || v === null) return fallback;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function ReferralForm({ initial }: { initial: Record<string, unknown> }) {
  const src = initial as ReferralSettings;
  const [f, setF] = useState<FormState>({
    enabled: src.enabled ?? false,
    referrerReward: toNumber(src.referrerReward, 0),
    friendReward: toNumber(src.friendReward, 0),
    minOrder: toNumber(src.minOrder, 0),
    payout: (PAYOUT_OPTIONS.some((p) => p.value === src.payout) ? src.payout : 'on_completion') as ReferralPayout,
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    setBusy(true);
    try {
      await api('/referrals/settings', {
        method: 'PATCH',
        body: {
          enabled: f.enabled,
          referrerReward: f.referrerReward,
          friendReward: f.friendReward,
          minOrder: f.minOrder,
          payout: f.payout,
        },
      });
      toast.show('Referral settings saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="set-sec" style={{ marginTop: 22 }}>
      <h2>Referral Program</h2>
      <div className="ssub">Reward customers who invite friends</div>
      <div className="set-card">
        <div className="set-row">
          <div className="l">
            <b id="referral-enabled-label">Enable referrals</b>
            <span>Customers get a shareable invite code</span>
          </div>
          <div className="r">
            <button
              type="button"
              role="switch"
              aria-checked={f.enabled}
              aria-labelledby="referral-enabled-label"
              className={`switch${f.enabled ? ' on' : ''}`}
              data-tog="referral.enabled"
              onClick={() => setF({ ...f, enabled: !f.enabled })}
            />
          </div>
        </div>
        <div className="set-row">
          <div className="l">
            <b>Referrer reward (AED)</b>
            <span>Credit the existing customer earns</span>
          </div>
          <div className="r">
            <input
              className="input sm"
              id="ref-rr"
              type="number"
              value={f.referrerReward}
              onChange={(e) => setF({ ...f, referrerReward: +e.target.value })}
            />
          </div>
        </div>
        <div className="set-row">
          <div className="l">
            <b>Friend reward (AED)</b>
            <span>Discount the new customer gets</span>
          </div>
          <div className="r">
            <input
              className="input sm"
              id="ref-fr"
              type="number"
              value={f.friendReward}
              onChange={(e) => setF({ ...f, friendReward: +e.target.value })}
            />
          </div>
        </div>
        <div className="set-row">
          <div className="l"><b>Minimum order to qualify (AED)</b></div>
          <div className="r">
            <input
              className="input sm"
              id="ref-min"
              type="number"
              value={f.minOrder}
              onChange={(e) => setF({ ...f, minOrder: +e.target.value })}
            />
          </div>
        </div>
        <div className="set-row" style={{ border: 'none' }}>
          <div className="l">
            <b>Pay referrer</b>
            <span>When the reward is credited</span>
          </div>
          <div className="r">
            <select
              className="input"
              id="ref-payout"
              value={f.payout}
              onChange={(e) => setF({ ...f, payout: e.target.value as ReferralPayout })}
            >
              {PAYOUT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
          id="ref-save"
          onClick={save}
          disabled={busy}
        >
          Save Referral Settings
        </button>
      </div>
    </div>
  );
}

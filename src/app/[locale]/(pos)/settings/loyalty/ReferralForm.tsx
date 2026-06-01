'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

type ReferralPayout = 'ON_SIGNUP' | 'ON_FIRST_ORDER' | 'ON_COMPLETION';
type ReferralRewardType = 'CREDIT' | 'POINTS';

interface ReferralSettings {
  enabled?: boolean;
  referrerReward?: number | string;
  friendReward?: number | string;
  rewardType?: ReferralRewardType;
  minOrder?: number | string;
  payout?: ReferralPayout;
  messageTemplate?: string | null;
}

interface FormState {
  enabled: boolean;
  referrerReward: number;
  friendReward: number;
  minOrder: number;
  messageTemplate: string;
}

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
    messageTemplate: src.messageTemplate ?? '',
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
          messageTemplate: f.messageTemplate || null,
        },
      });
      toast.show('Referral settings saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="set-sec" style={{ marginTop: 22 }}>
      <h2>Referral program</h2>
      <p className="ssub">Reward customers who invite friends to your store.</p>
      <div className="set-card">
        <div className="set-row">
          <div className="l"><b>Enable referrals</b><span>Customers get a shareable invite code</span></div>
          <div className="r"><span className={`switch${f.enabled ? ' on' : ''}`} onClick={() => setF({ ...f, enabled: !f.enabled })} /></div>
        </div>
        <div className="set-row">
          <div className="l"><b>Reward for referrer (points)</b></div>
          <div className="r"><input className="input sm" type="number" value={f.referrerReward} onChange={(e) => setF({ ...f, referrerReward: +e.target.value })} /></div>
        </div>
        <div className="set-row">
          <div className="l"><b>Reward for new customer (points)</b></div>
          <div className="r"><input className="input sm" type="number" value={f.friendReward} onChange={(e) => setF({ ...f, friendReward: +e.target.value })} /></div>
        </div>
        <div className="set-row">
          <div className="l"><b>Minimum first order (AED)</b></div>
          <div className="r"><input className="input sm" type="number" value={f.minOrder} onChange={(e) => setF({ ...f, minOrder: +e.target.value })} /></div>
        </div>
        <div className="set-row" style={{ border: 'none', alignItems: 'flex-start' }}>
          <div className="l"><b>Referral message template</b><span>Use {'{name}'} and {'{code}'} as placeholders</span></div>
          <div className="r" style={{ width: '100%' }}>
            <textarea
              className="input"
              rows={3}
              style={{ width: '100%' }}
              value={f.messageTemplate}
              onChange={(e) => setF({ ...f, messageTemplate: e.target.value })}
              placeholder="Hey {name}, here's my referral code {code} — try it out!"
            />
          </div>
        </div>
      </div>
      <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} onClick={save}>Save</button>
    </div>
  );
}

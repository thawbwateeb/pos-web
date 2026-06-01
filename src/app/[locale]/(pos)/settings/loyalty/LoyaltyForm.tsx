'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

export default function LoyaltyForm({ initial }: { initial: any }) {
  const [f, setF] = useState({
    enabled: initial.enabled ?? true,
    perAed: initial.perAed ?? 1,
    redeemThreshold: initial.redeemThreshold ?? 100,
    welcomeBonus: initial.welcomeBonus ?? 50,
    expiryMonths: initial.expiryMonths ?? 12,
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function save() {
    setBusy(true);
    try { await api('/loyalty/settings', { method: 'PATCH', body: f }); toast.show('Saved'); } finally { setBusy(false); }
  }
  return (
    <div className="set-sec">
      <h2>Loyalty</h2>
      <p className="ssub">Reward customers with points they can redeem on future orders.</p>
      <div className="set-card">
        <div className="set-row"><div className="l"><b>Enable loyalty programme</b></div><div className="r"><span className={`switch${f.enabled ? ' on' : ''}`} onClick={() => setF({ ...f, enabled: !f.enabled })} /></div></div>
        <div className="set-row"><div className="l"><b>Points per AED</b></div><div className="r"><input className="input sm" type="number" value={f.perAed} onChange={(e) => setF({ ...f, perAed: +e.target.value })} /></div></div>
        <div className="set-row"><div className="l"><b>Redeem threshold</b><span>Minimum points needed to redeem</span></div><div className="r"><input className="input sm" type="number" value={f.redeemThreshold} onChange={(e) => setF({ ...f, redeemThreshold: +e.target.value })} /></div></div>
        <div className="set-row"><div className="l"><b>Welcome bonus</b></div><div className="r"><input className="input sm" type="number" value={f.welcomeBonus} onChange={(e) => setF({ ...f, welcomeBonus: +e.target.value })} /></div></div>
        <div className="set-row"><div className="l"><b>Expiry (months)</b></div><div className="r"><input className="input sm" type="number" value={f.expiryMonths} onChange={(e) => setF({ ...f, expiryMonths: +e.target.value })} /></div></div>
      </div>
      <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} onClick={save}>Save</button>
    </div>
  );
}

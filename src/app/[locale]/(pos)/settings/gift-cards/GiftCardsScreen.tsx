'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { AED } from '@/lib/format';
import { useToast } from '@/components/Toast';

export default function GiftCardsScreen({ settings, initialCards }: { settings: any; initialCards: any[] }) {
  const [s, setS] = useState(settings ?? {});
  const [cards, setCards] = useState(initialCards);
  const toast = useToast();

  async function saveSettings() {
    await api('/gift-cards/settings', { method: 'PATCH', body: s });
    toast.show('Saved');
  }
  async function reload() { setCards(await api<any[]>('/gift-cards')); }
  async function issue() {
    const amount = Number(prompt('Amount (AED)') ?? 0);
    if (!amount) return;
    const recipientName = prompt('Recipient name (optional)') ?? '';
    await api('/gift-cards', { method: 'POST', body: { amount, recipientName } });
    reload();
  }

  return (
    <div className="set-sec">
      <h2>Gift cards</h2>
      <p className="ssub">Sell prepaid cards customers can redeem at checkout.</p>
      <div className="set-card">
        <div className="set-row"><div className="l"><b>Enable gift cards</b></div><div className="r"><span className={`switch${s.enabled ? ' on' : ''}`} onClick={() => setS({ ...s, enabled: !s.enabled })} /></div></div>
        <div className="set-row"><div className="l"><b>Denominations</b><span>Comma-separated AED amounts</span></div><div className="r"><input className="input" value={s.denoms ?? ''} onChange={(e) => setS({ ...s, denoms: e.target.value })} /></div></div>
        <div className="set-row"><div className="l"><b>Allow custom amount</b></div><div className="r"><span className={`switch${s.customAllowed ? ' on' : ''}`} onClick={() => setS({ ...s, customAllowed: !s.customAllowed })} /></div></div>
        <div className="set-row"><div className="l"><b>Expiry (months)</b></div><div className="r"><input className="input sm" type="number" value={s.expiryMonths ?? 24} onChange={(e) => setS({ ...s, expiryMonths: +e.target.value })} /></div></div>
        <button className="btn btn-pri" style={{ marginTop: 10 }} onClick={saveSettings}>Save settings</button>
      </div>
      <div className="set-card">
        <div className="ch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Issued cards</h3>
          <button className="btn btn-pri btn-sm" onClick={issue}>+ Issue card</button>
        </div>
        <table className="tbl">
          <thead><tr><th>Code</th><th>Recipient</th><th className="num">Initial</th><th className="num">Balance</th><th>Active</th></tr></thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id}>
                <td className="t-id">{c.code}</td>
                <td>{c.recipientName ?? '—'}</td>
                <td className="num">{AED(c.initialAmount)}</td>
                <td className="num">{AED(c.balance)}</td>
                <td><span className={`switch${c.active ? ' on' : ''}`} /></td>
              </tr>
            ))}
            {cards.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>No cards issued yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

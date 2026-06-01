'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

export default function TaxForm({ initial }: { initial: any }) {
  const [f, setF] = useState({
    enabled: initial?.enabled ?? true,
    rate: parseFloat(initial?.rate ?? '5'),
    mode: initial?.mode ?? 'EXCLUSIVE',
    label: initial?.label ?? 'VAT',
    trn: initial?.trn ?? '',
    onReceipt: initial?.onReceipt ?? true,
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    setBusy(true);
    try { await api('/tax', { method: 'PATCH', body: f }); toast.show('Tax saved'); } finally { setBusy(false); }
  }
  return (
    <div className="set-sec">
      <h2>Tax / VAT</h2>
      <p className="ssub">Configure how tax is calculated and shown on receipts.</p>
      <div className="set-card">
        <div className="set-row"><div className="l"><b>Enable tax</b><span>Apply {f.label} to every order</span></div><div className="r"><span className={`switch${f.enabled ? ' on' : ''}`} onClick={() => setF({ ...f, enabled: !f.enabled })} /></div></div>
        <div className="set-row"><div className="l"><b>Label</b></div><div className="r"><input className="input sm" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></div></div>
        <div className="set-row"><div className="l"><b>Rate (%)</b></div><div className="r"><input className="input sm" type="number" value={f.rate} onChange={(e) => setF({ ...f, rate: Number(e.target.value) })} /></div></div>
        <div className="set-row"><div className="l"><b>Mode</b><span>Exclusive adds tax on top, inclusive includes it in the price</span></div><div className="r">
          <select className="input sm" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option>EXCLUSIVE</option><option>INCLUSIVE</option></select>
        </div></div>
        <div className="set-row"><div className="l"><b>TRN</b></div><div className="r"><input className="input" value={f.trn} onChange={(e) => setF({ ...f, trn: e.target.value })} /></div></div>
        <div className="set-row"><div className="l"><b>Show on receipt</b></div><div className="r"><span className={`switch${f.onReceipt ? ' on' : ''}`} onClick={() => setF({ ...f, onReceipt: !f.onReceipt })} /></div></div>
      </div>
      <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} onClick={save}>Save</button>
    </div>
  );
}

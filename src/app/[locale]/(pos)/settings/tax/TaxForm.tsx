'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

/* Design app.js:1536-1546 — Tax & VAT settings:
   - .set-sec h2 'Tax & VAT' + .ssub 'Configure how tax is calculated,
     labelled and printed'
   - .set-card with six .set-row entries (the middle four are disabled when
     the master switch is off):
     - 'Charge VAT' + 'Apply tax to every order' + switch data-tog='tax.enabled'
     - 'Tax rate (%)' + 'Standard UAE VAT is 5%' + input.sm id='tax-rate'
     - 'Tax label' + 'Name shown on receipts' + input id='tax-label' width 140
     - 'Tax mode' + 'How tax relates to listed prices' + select id='tax-mode'
       with options 'Added on top (exclusive)' / 'Included in price (inclusive)'
     - 'Tax Registration No. (TRN)' + 'Printed on tax invoices' + input
       id='tax-trn' width 185
     - 'Print tax breakdown on receipt' + 'Show the \${label} line on printed
       receipts' + switch data-tog='tax.onReceipt'
   - Save button 'Save Tax Settings' (data-save) */

type Mode = 'exclusive' | 'inclusive';

function modeFromApi(v: string | undefined): Mode {
  return (v ?? '').toLowerCase() === 'inclusive' ? 'inclusive' : 'exclusive';
}

export default function TaxForm({ initial }: { initial: any }) {
  const [f, setF] = useState({
    enabled: initial?.enabled ?? true,
    rate: parseFloat(initial?.rate ?? '5'),
    mode: modeFromApi(initial?.mode),
    label: initial?.label ?? 'VAT',
    trn: initial?.trn ?? '',
    onReceipt: initial?.onReceipt ?? true,
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const disabled = !f.enabled;

  async function save() {
    setBusy(true);
    try {
      await api('/tax', {
        method: 'PATCH',
        body: { ...f, mode: f.mode.toUpperCase() },
      });
      toast.show('Tax settings saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="set-sec">
      <h2>Tax &amp; VAT</h2>
      <div className="ssub">Configure how tax is calculated, labelled and printed</div>
      <div className="set-card">
        <div className="set-row">
          <div className="l"><b>Charge VAT</b><span>Apply tax to every order</span></div>
          <div className="r">
            <button
              className={`switch ${f.enabled ? 'on' : ''}`}
              data-tog="tax.enabled"
              type="button"
              onClick={() => setF({ ...f, enabled: !f.enabled })}
            />
          </div>
        </div>
        <div className="set-row">
          <div className="l"><b>Tax rate (%)</b><span>Standard UAE VAT is 5%</span></div>
          <div className="r">
            <input
              className="input sm"
              id="tax-rate"
              type="number"
              value={f.rate}
              disabled={disabled}
              onChange={(e) => setF({ ...f, rate: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="set-row">
          <div className="l"><b>Tax label</b><span>Name shown on receipts</span></div>
          <div className="r">
            <input
              className="input"
              id="tax-label"
              style={{ width: 140 }}
              value={f.label}
              disabled={disabled}
              onChange={(e) => setF({ ...f, label: e.target.value })}
            />
          </div>
        </div>
        <div className="set-row">
          <div className="l"><b>Tax mode</b><span>How tax relates to listed prices</span></div>
          <div className="r">
            <select
              className="input"
              id="tax-mode"
              value={f.mode}
              disabled={disabled}
              onChange={(e) => setF({ ...f, mode: e.target.value as Mode })}
            >
              <option value="exclusive">Added on top (exclusive)</option>
              <option value="inclusive">Included in price (inclusive)</option>
            </select>
          </div>
        </div>
        <div className="set-row">
          <div className="l"><b>Tax Registration No. (TRN)</b><span>Printed on tax invoices</span></div>
          <div className="r">
            <input
              className="input"
              id="tax-trn"
              style={{ width: 185 }}
              value={f.trn}
              disabled={disabled}
              onChange={(e) => setF({ ...f, trn: e.target.value })}
            />
          </div>
        </div>
        <div className="set-row">
          <div className="l">
            <b>Print tax breakdown on receipt</b>
            <span>Show the {f.label} line on printed receipts</span>
          </div>
          <div className="r">
            <button
              className={`switch ${f.onReceipt ? 'on' : ''}`}
              data-tog="tax.onReceipt"
              type="button"
              onClick={() => setF({ ...f, onReceipt: !f.onReceipt })}
            />
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
          Save Tax Settings
        </button>
      </div>
    </div>
  );
}

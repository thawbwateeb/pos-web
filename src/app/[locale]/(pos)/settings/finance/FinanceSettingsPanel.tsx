'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';

/* Design finance.js:256-274 — Finance settings panel rendered inside
   Settings → Finance.
   - .fin > .card max-width:780:
     - .note margin-bottom:16 'Classify each expense line as fixed/variable
       and tune the Stripe and capacity rates used on the Unit economics
       page.'
     - .grid.g3 gap:14 margin-bottom:18 with 3 fields:
       - 'Stripe % (e.g. 0.029)' input id='s-pct' type=number step=0.001
       - 'Stripe fixed fee (AED)' input id='s-flat' type=number
       - 'Hire-flag threshold (e.g. 0.85)' input id='s-hire' type=number
         step=0.01
     - .card.flush margin-bottom:16 table.tbl with thead:
       Expense line / Variable fraction (0–1) (num) / Amortize over 12 mo. (num)
       Rows: .ln line / num input.inp.r width:90 step:0.1 min:0 max:1
         data-vf=\${line} / num checkbox 18×18 accent var(--accent) data-am=\${line}
     - .btn.btn-pri id='s-save' 'Save' */

const LINES = [
  'Rent', 'Internet', 'Phones', 'DEWA', 'Supplies',
  'Manager Salary', 'Driver Salary', 'Washer', 'Presser', 'Accommodation',
  'Bonus', 'Car Maintenance', 'Car Gas', 'Clean Cloud', 'Marketing',
  'Ads', 'Pest control', 'Bank Account',
];

const VAR_FRAC_DEFAULTS: Record<string, number> = Object.fromEntries(LINES.map((l) => [l, 0]));
VAR_FRAC_DEFAULTS['DEWA'] = 0.6;
VAR_FRAC_DEFAULTS['Supplies'] = 1;
VAR_FRAC_DEFAULTS['Bonus'] = 1;
VAR_FRAC_DEFAULTS['Car Gas'] = 1;

const AMORTIZE_DEFAULTS: Record<string, boolean> = Object.fromEntries(LINES.map((l) => [l, false]));

export default function FinanceSettingsPanel() {
  const [stripePct, setStripePct] = useState<number>(0.029);
  const [stripeFlat, setStripeFlat] = useState<number>(1);
  const [hireThreshold, setHireThreshold] = useState<number>(0.85);
  const [varFrac, setVarFrac] = useState<Record<string, number>>(VAR_FRAC_DEFAULTS);
  const [amortize, setAmortize] = useState<Record<string, boolean>>(AMORTIZE_DEFAULTS);
  const toast = useToast();

  function setVF(line: string, val: number) {
    const clamped = Math.max(0, Math.min(1, val || 0));
    setVarFrac((prev) => ({ ...prev, [line]: clamped }));
  }
  function setAM(line: string, val: boolean) {
    setAmortize((prev) => ({ ...prev, [line]: val }));
  }

  return (
    <div className="fin">
      <div className="card" style={{ maxWidth: 780 }}>
        <div className="note" style={{ marginBottom: 16 }}>
          Classify each expense line as fixed/variable and tune the Stripe and capacity rates used on the Unit economics page.
        </div>
        <div className="grid g3" style={{ gap: 14, marginBottom: 18 }}>
          <div className="field">
            <label>Stripe % (e.g. 0.029)</label>
            <input
              className="inp"
              id="s-pct"
              type="number"
              step={0.001}
              value={stripePct}
              onChange={(e) => setStripePct(+e.target.value || 0)}
            />
          </div>
          <div className="field">
            <label>Stripe fixed fee (AED)</label>
            <input
              className="inp"
              id="s-flat"
              type="number"
              value={stripeFlat}
              onChange={(e) => setStripeFlat(+e.target.value || 0)}
            />
          </div>
          <div className="field">
            <label>Hire-flag threshold (e.g. 0.85)</label>
            <input
              className="inp"
              id="s-hire"
              type="number"
              step={0.01}
              value={hireThreshold}
              onChange={(e) => setHireThreshold(+e.target.value || 0)}
            />
          </div>
        </div>

        <div className="card flush" style={{ marginBottom: 16 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Expense line</th>
                <th className="num">Variable fraction (0–1)</th>
                <th className="num">Amortize over 12 mo.</th>
              </tr>
            </thead>
            <tbody>
              {LINES.map((l) => (
                <tr key={l}>
                  <td className="ln">{l}</td>
                  <td className="num">
                    <input
                      className="inp r"
                      style={{ width: 90, marginLeft: 'auto' }}
                      type="number"
                      step={0.1}
                      min={0}
                      max={1}
                      data-vf={l}
                      value={varFrac[l] ?? 0}
                      onChange={(e) => setVF(l, +e.target.value || 0)}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="checkbox"
                      data-am={l}
                      checked={amortize[l] ?? false}
                      onChange={(e) => setAM(l, e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button className="btn btn-pri" id="s-save" onClick={() => toast.show('Finance settings saved')}>
          Save
        </button>
      </div>
    </div>
  );
}

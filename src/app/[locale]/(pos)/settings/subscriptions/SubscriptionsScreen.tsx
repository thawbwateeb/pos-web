'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { AED } from '@/lib/format';
import { useToast } from '@/components/Toast';

/* Design app.js:1513-1519 — Subscription Packages.
   - .set-sec max-width:none > .page-head h2 'Subscription Packages' + sub
     '${active} active · recurring plans customers can join' +
     .actions '+ New Package' (data-addsub)
   - .card > table.tbl with 5 cols: Package / Price / Includes / Status / (action)
   - Row: .t-name name / .t-amt AED(price) + ' / ${period}' (11px muted) /
     12.5px font 'includes' description / .pill.paid|muted Active|Paused /
     .r flex/gap:10/justify-end: Edit btn (data-editsub) + switch (data-sub) */

type Period = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';

interface Plan {
  id: string;
  name: string;
  price: number | string;
  period: Period;
  itemsDesc?: string | null;
  active: boolean;
}

const PERIOD_LABEL: Record<Period, string> = {
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
};

export default function SubscriptionsScreen({ initial }: { initial: Plan[] }) {
  const [rows, setRows] = useState<Plan[]>(initial);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  // Re-sync from the server prop on store switch / router.refresh.
  useEffect(() => { setRows(initial); }, [initial]);

  async function reload() {
    setRows(await api<Plan[]>('/subscriptions/plans'));
  }

  async function toggleActive(p: Plan) {
    await api(`/subscriptions/plans/${p.id}`, { method: 'PATCH', body: { active: !p.active } });
    reload();
  }

  const active = rows.filter((p) => p.active).length;

  return (
    <div className="set-sec" style={{ maxWidth: 'none' }}>
      <div className="page-head">
        <div className="ph-l">
          <h2>Subscription Packages</h2>
          <span className="sub">{active} active · recurring plans customers can join</span>
        </div>
        <div className="actions">
          <button className="btn btn-pri" data-addsub onClick={() => setAdding(true)}>+ New Package</button>
        </div>
      </div>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Package</th>
              <th>Price</th>
              <th>Includes</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.id}>
                <td className="t-name">{p.name}</td>
                <td className="t-amt">
                  {AED(Number(p.price))}
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}> / {PERIOD_LABEL[p.period]}</span>
                </td>
                <td style={{ fontSize: 12.5 }}>{p.itemsDesc || ''}</td>
                <td>
                  <span className={`pill ${p.active ? 'paid' : 'muted'}`}>
                    {p.active ? 'Active' : 'Paused'}
                  </span>
                </td>
                <td>
                  <div className="r" style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
                    <button className="t-btn ghost" data-editsub={i} onClick={() => setEditing(p)}>Edit</button>
                    <span
                      className={`switch${p.active ? ' on' : ''}`}
                      data-sub={i}
                      onClick={() => toggleActive(p)}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                  No subscription packages yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(adding || editing) && (
        <PlanForm
          initial={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); reload(); toast.show('Saved'); }}
        />
      )}
    </div>
  );
}

function PlanForm({ initial, onClose, onSaved }: { initial: Plan | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('Settings.subscriptions');
  const [f, setF] = useState({
    name: initial?.name ?? '',
    price: Number(initial?.price ?? 0),
    period: (initial?.period ?? 'MONTH') as Period,
    itemsDesc: initial?.itemsDesc ?? '',
    active: initial?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    if (!f.name) return toast.show('Name required');
    setBusy(true);
    try {
      if (initial) await api(`/subscriptions/plans/${initial.id}`, { method: 'PATCH', body: f });
      else await api('/subscriptions/plans', { method: 'POST', body: f });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{initial ? 'Edit package' : 'New package'}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="field"><label>Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field-2">
            <div className="field"><label>Price (AED)</label><input className="input" type="number" value={f.price} onChange={(e) => setF({ ...f, price: +e.target.value })} /></div>
            <div className="field"><label>Period</label>
              <select className="input" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value as Period })}>
                <option value="WEEK">Week</option>
                <option value="MONTH">Month</option>
                <option value="QUARTER">Quarter</option>
                <option value="YEAR">Year</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Includes</label><input className="input" value={f.itemsDesc ?? ''} onChange={(e) => setF({ ...f, itemsDesc: e.target.value })} placeholder={t('includesPlaceholder')} /></div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={save}>{initial ? 'Save changes' : 'Create package'}</button>
        </div>
      </div>
    </div>
  );
}

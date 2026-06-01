'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { AED } from '@/lib/format';
import { useToast } from '@/components/Toast';

export default function PromosScreen({ initial }: { initial: any[] }) {
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  async function reload() { setRows(await api<any[]>('/promos')); }

  return (
    <div className="set-sec" style={{ maxWidth: 980 }}>
      <h2>Promotions</h2>
      <p className="ssub">Codes customers can apply to orders. Auto-apply or POS-only options below.</p>
      <div className="set-card">
        <div className="ch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>All promotions</h3>
          <button className="btn btn-pri btn-sm" onClick={() => setAdding(true)}>+ New promo</button>
        </div>
        <table className="tbl">
          <thead><tr><th>Code</th><th>Description</th><th>Value</th><th>Channel</th><th>Uses</th><th>Active</th><th className="num"></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="t-id">{r.code}</td>
                <td>{r.description ?? '—'}</td>
                <td>{r.kind === 'PERCENT' ? `${r.value}%` : AED(r.value)}</td>
                <td>{r.channel}</td>
                <td>{r.uses}{r.maxUses ? ` / ${r.maxUses}` : ''}</td>
                <td><span className={`switch${r.active ? ' on' : ''}`} onClick={async () => { await api(`/promos/${r.id}`, { method: 'PATCH', body: { active: !r.active } }); reload(); }} /></td>
                <td className="num">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(r)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={async () => { if (confirm('Delete?')) { await api(`/promos/${r.id}`, { method: 'DELETE' }); reload(); } }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(adding || editing) && (
        <PromoForm initial={editing} onClose={() => { setAdding(false); setEditing(null); }} onSaved={() => { setAdding(false); setEditing(null); reload(); toast.show('Saved'); }} />
      )}
    </div>
  );
}

function PromoForm({ initial, onClose, onSaved }: { initial: any | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    code: initial?.code ?? '',
    description: initial?.description ?? '',
    kind: initial?.kind ?? 'PERCENT',
    value: parseFloat(initial?.value ?? '10'),
    channel: initial?.channel ?? 'ALL',
    auto: initial?.auto ?? false,
    maxUses: initial?.maxUses ?? 0,
    maxPerCust: initial?.maxPerCust ?? 0,
  });
  const isEdit = !!initial;
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    if (!f.code) return toast.show('Code required');
    setBusy(true);
    try {
      if (isEdit) await api(`/promos/${initial.id}`, { method: 'PATCH', body: f });
      else await api('/promos', { method: 'POST', body: f });
      onSaved();
    } finally { setBusy(false); }
  }
  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{isEdit ? 'Edit promo' : 'New promo'}</h3><button className="x" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="field"><label>Code</label><input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></div>
          <div className="field"><label>Description</label><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="field-2">
            <div className="field"><label>Kind</label>
              <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as any })}>
                <option value="PERCENT">% Percent</option>
                <option value="AMOUNT">AED off</option>
              </select>
            </div>
            <div className="field"><label>Value</label><input className="input" type="number" value={f.value} onChange={(e) => setF({ ...f, value: +e.target.value })} /></div>
          </div>
          <div className="field-2">
            <div className="field"><label>Channel</label>
              <select className="input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value as any })}>
                <option>ALL</option><option>POS</option><option>ONLINE</option>
              </select>
            </div>
            <div className="field"><label>Auto-apply</label>
              <span className={`switch${f.auto ? ' on' : ''}`} onClick={() => setF({ ...f, auto: !f.auto })} />
            </div>
          </div>
          <div className="field-2">
            <div className="field"><label>Max uses (0 = unlimited)</label><input className="input" type="number" value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: +e.target.value })} /></div>
            <div className="field"><label>Max per customer</label><input className="input" type="number" value={f.maxPerCust} onChange={(e) => setF({ ...f, maxPerCust: +e.target.value })} /></div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={save}>{isEdit ? 'Save changes' : 'Create promo'}</button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { AED } from '@/lib/format';
import { useToast } from '@/components/Toast';

type PromoAudience = 'ALL' | 'SPECIFIC';
type PromoKind = 'PERCENT' | 'AMOUNT';
type PromoChannel = 'ALL' | 'POS' | 'ONLINE';

interface AudienceCustomerRow {
  customerId: string;
}

interface Promo {
  id: string;
  code: string;
  description: string | null;
  kind: PromoKind;
  value: number | string;
  channel: PromoChannel;
  active: boolean;
  auto: boolean;
  audience: PromoAudience;
  maxUses: number;
  maxPerCust: number;
  uses: number;
  audienceCustomers?: AudienceCustomerRow[];
}

interface CustomerLite {
  id: string;
  fullName: string;
  phone: string;
}

export default function PromosScreen({ initial }: { initial: Promo[] }) {
  const [rows, setRows] = useState<Promo[]>(initial);
  const [editing, setEditing] = useState<Promo | null>(null);
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  async function reload() { setRows(await api<Promo[]>('/promos')); }

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
                <td>{r.kind === 'PERCENT' ? `${r.value}%` : AED(Number(r.value))}</td>
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

interface PromoFormState {
  code: string;
  description: string;
  kind: PromoKind;
  value: number;
  channel: PromoChannel;
  auto: boolean;
  maxUses: number;
  maxPerCust: number;
  audience: PromoAudience;
  audienceCustomerIds: string[];
}

function PromoForm({ initial, onClose, onSaved }: { initial: Promo | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<PromoFormState>({
    code: initial?.code ?? '',
    description: initial?.description ?? '',
    kind: initial?.kind ?? 'PERCENT',
    value: typeof initial?.value === 'number' ? initial.value : parseFloat(String(initial?.value ?? '10')),
    channel: initial?.channel ?? 'ALL',
    auto: initial?.auto ?? false,
    maxUses: initial?.maxUses ?? 0,
    maxPerCust: initial?.maxPerCust ?? 0,
    audience: initial?.audience ?? 'ALL',
    audienceCustomerIds: initial?.audienceCustomers?.map((a) => a.customerId) ?? [],
  });
  const [pickedCustomers, setPickedCustomers] = useState<Record<string, CustomerLite>>({});
  const isEdit = !!initial;
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Hydrate display info for already-selected customer IDs on first render.
  useEffect(() => {
    const ids = f.audienceCustomerIds;
    if (ids.length === 0) return;
    const missing = ids.filter((id) => !pickedCustomers[id]);
    if (missing.length === 0) return;
    (async () => {
      const fetched = await Promise.all(
        missing.map((id) => api<CustomerLite | null>(`/customers/${id}`).catch(() => null)),
      );
      setPickedCustomers((prev) => {
        const next = { ...prev };
        fetched.forEach((c) => { if (c) next[c.id] = { id: c.id, fullName: c.fullName, phone: c.phone }; });
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!f.code) return toast.show('Code required');
    setBusy(true);
    try {
      const body = {
        code: f.code,
        description: f.description,
        kind: f.kind,
        value: f.value,
        channel: f.channel,
        auto: f.auto,
        maxUses: f.maxUses,
        maxPerCust: f.maxPerCust,
        audience: f.audience,
        audienceCustomerIds: f.audience === 'SPECIFIC' ? f.audienceCustomerIds : [],
      };
      if (isEdit && initial) await api(`/promos/${initial.id}`, { method: 'PATCH', body });
      else await api('/promos', { method: 'POST', body });
      onSaved();
    } finally { setBusy(false); }
  }

  function addCustomer(c: CustomerLite) {
    if (f.audienceCustomerIds.includes(c.id)) return;
    setF({ ...f, audienceCustomerIds: [...f.audienceCustomerIds, c.id] });
    setPickedCustomers((prev) => ({ ...prev, [c.id]: c }));
  }
  function removeCustomer(id: string) {
    setF({ ...f, audienceCustomerIds: f.audienceCustomerIds.filter((x) => x !== id) });
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
              <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as PromoKind })}>
                <option value="PERCENT">% Percent</option>
                <option value="AMOUNT">AED off</option>
              </select>
            </div>
            <div className="field"><label>Value</label><input className="input" type="number" value={f.value} onChange={(e) => setF({ ...f, value: +e.target.value })} /></div>
          </div>
          <div className="field-2">
            <div className="field"><label>Channel</label>
              <select className="input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value as PromoChannel })}>
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
          <div className="field">
            <label>Target customers</label>
            <select className="input" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value as PromoAudience })}>
              <option value="ALL">All customers</option>
              <option value="SPECIFIC">Specific customers</option>
            </select>
          </div>
          {f.audience === 'SPECIFIC' && (
            <div className="field">
              <label>Pick customers</label>
              <CustomerSearch
                excludeIds={f.audienceCustomerIds}
                onPick={addCustomer}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                {f.audienceCustomerIds.length === 1
                  ? '1 customer selected'
                  : `${f.audienceCustomerIds.length} customers selected`}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {f.audienceCustomerIds.map((id) => {
                  const c = pickedCustomers[id];
                  return (
                    <span key={id} className="chip">
                      {c ? c.fullName : id.slice(0, 8)}
                      <button type="button" onClick={() => removeCustomer(id)} style={{ marginInlineStart: 6, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={save}>{isEdit ? 'Save changes' : 'Create promo'}</button>
        </div>
      </div>
    </div>
  );
}

function CustomerSearch({ excludeIds, onPick }: { excludeIds: string[]; onPick: (c: CustomerLite) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CustomerLite[]>([]);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    const text = q.trim();
    if (!text) { setResults([]); return; }
    const myReq = ++reqRef.current;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const r = await api<CustomerLite[]>(`/customers?q=${encodeURIComponent(text)}&take=20`);
        if (myReq === reqRef.current) setResults(r);
      } finally {
        if (myReq === reqRef.current) setLoading(false);
      }
    }, 180);
    return () => clearTimeout(handle);
  }, [q]);

  const filtered = results.filter((c) => !excludeIds.includes(c.id));

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', padding: 8 }}>
      <input
        className="input"
        placeholder="Search by name or phone"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {q.trim() && (
        <div style={{ maxHeight: 150, overflowY: 'auto', marginTop: 8 }}>
          {loading && <div style={{ fontSize: 12, color: 'var(--muted)', padding: 8 }}>…</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--muted)', padding: 8 }}>No matches</div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              className="pickrow"
              onClick={() => { onPick(c); setQ(''); setResults([]); }}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8 }}
            >
              <b style={{ fontWeight: 600 }}>{c.fullName}</b>
              <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 'auto' }}>{c.phone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

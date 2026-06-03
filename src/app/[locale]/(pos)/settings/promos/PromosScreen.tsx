'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
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

  // Re-sync from the server prop on store switch / router.refresh.
  useEffect(() => { setRows(initial); }, [initial]);

  async function reload() { setRows(await api<Promo[]>('/promos')); }

  /* Design app.js:1396-1410 — Promo Codes table:
     - .set-sec max-width:none > .page-head h2 'Promo Codes' + sub
       '\${active} active · \${total} total' + .actions '+ New Promo' (data-addpromo)
     - .card > table.tbl with 8 cols: Code / Discount / Limits / Channel /
       Auto / Uses / Status / (action)
     - Code: .t-id + 11px muted desc below
     - Discount: .t-amt (% or AED)
     - Limits: '\${n} / customer' or '∞ / customer', plus ' · \${maxUses} total'
     - Channel: All channels | App / Web | POS only
     - Auto: .pill.paid 'Auto' or .pill.muted 'Manual'
     - Status: .pill.paid 'Active' or .pill.muted 'Paused'
     - Action: .r flex/gap:10 with Edit btn + switch (data-promo) */
  const active = rows.filter((p) => p.active).length;
  const channelLabel = (c: PromoChannel) =>
    c === 'POS' ? 'POS only' : c === 'ONLINE' ? 'App / Web' : 'All channels';

  return (
    <div className="set-sec" style={{ maxWidth: 'none' }}>
      <div className="page-head">
        <div className="ph-l">
          <h2>Promo Codes</h2>
          <span className="sub">{active} active · {rows.length} total</span>
        </div>
        <div className="actions">
          <button className="btn btn-pri" data-addpromo onClick={() => setAdding(true)}>+ New Promo</button>
        </div>
      </div>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Limits</th>
              <th>Channel</th>
              <th>Auto</th>
              <th>Uses</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const limits = `${r.maxPerCust ? r.maxPerCust : '∞'} / customer${r.maxUses ? ` · ${r.maxUses} total` : ''}`;
              const specificCount = r.audienceCustomers?.length ?? 0;
              return (
                <tr key={r.id}>
                  <td className="t-id">
                    {r.code}
                    {r.description && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400, marginTop: 2 }}>
                        {r.description}
                      </div>
                    )}
                  </td>
                  <td className="t-amt">{r.kind === 'PERCENT' ? `${r.value}%` : AED(Number(r.value))}</td>
                  <td style={{ fontSize: 12 }}>
                    {limits}
                    {r.audience === 'SPECIFIC' && (
                      <>
                        <br />
                        <span style={{ color: 'var(--warn)', fontWeight: 600 }}>
                          {specificCount ? `${specificCount} customers` : 'Selected customers'}
                        </span>
                      </>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>{channelLabel(r.channel)}</td>
                  <td>
                    <span className={`pill ${r.auto ? 'paid' : 'muted'}`}>
                      {r.auto ? 'Auto' : 'Manual'}
                    </span>
                  </td>
                  <td>{r.uses}</td>
                  <td>
                    <span className={`pill ${r.active ? 'paid' : 'muted'}`}>
                      {r.active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td>
                    <div className="r" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                      <button className="t-btn ghost" data-editpromo={i} onClick={() => setEditing(r)}>Edit</button>
                      <span
                        className={`switch${r.active ? ' on' : ''}`}
                        data-promo={i}
                        onClick={async () => { await api(`/promos/${r.id}`, { method: 'PATCH', body: { active: !r.active } }); reload(); }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                  No promo codes yet. Create one to get started.
                </td>
              </tr>
            )}
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
  const t = useTranslations('Settings.promos');
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
        placeholder={t('customerSearchPlaceholder')}
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

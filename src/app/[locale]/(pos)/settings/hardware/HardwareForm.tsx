'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

export default function HardwareForm({ stores }: { stores: any[] }) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '');
  const [hw, setHw] = useState<any>(null);
  const toast = useToast();

  useEffect(() => {
    if (!storeId) return;
    api<any>(`/hardware/${storeId}`).then((d) => setHw(d ?? {})).catch(() => setHw({}));
  }, [storeId]);

  async function save() {
    await api(`/hardware/${storeId}`, { method: 'PUT', body: hw });
    toast.show('Hardware saved');
  }

  if (!hw) return <div className="muted">Loading…</div>;

  return (
    <div className="set-sec">
      <h2>Hardware</h2>
      <p className="ssub">Receipt printer, payment terminal, cash drawer, and label printer for each store.</p>
      <div className="set-card">
        <div className="field"><label>Store</label>
          <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <Section title="Printer" obj={hw.printer} onChange={(v) => setHw({ ...hw, printer: v })} fields={['brand', 'width', 'copies', 'mode']} />
      <Section title="Terminal" obj={hw.terminal} onChange={(v) => setHw({ ...hw, terminal: v })} fields={['brand', 'conn']} />
      <Section title="Cash drawer" obj={hw.drawer} onChange={(v) => setHw({ ...hw, drawer: v })} fields={['brand', 'trigger']} />
      <Section title="Labels" obj={hw.labels} onChange={(v) => setHw({ ...hw, labels: v })} fields={['brand', 'size']} />
      <button className="btn btn-pri" onClick={save}>Save hardware</button>
    </div>
  );
}

function Section({ title, obj, onChange, fields }: { title: string; obj: any; onChange: (v: any) => void; fields: string[] }) {
  const v = obj ?? {};
  return (
    <div className="set-card">
      <h3>{title}</h3>
      <div className="field-2">
        {fields.map((f) => (
          <div className="field" key={f}><label>{f}</label><input className="input" value={v[f] ?? ''} onChange={(e) => onChange({ ...v, [f]: e.target.value })} /></div>
        ))}
      </div>
    </div>
  );
}

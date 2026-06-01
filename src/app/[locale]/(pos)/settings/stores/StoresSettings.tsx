'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

export default function StoresSettings({ initial }: { initial: any[] }) {
  const [stores, setStores] = useState(initial);
  const [editing, setEditing] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  async function reload() {
    setStores(await api<any[]>('/stores'));
  }

  return (
    <div className="set-sec">
      <h2>Stores</h2>
      <p className="ssub">Branches your business operates. Staff sign into one or more of these.</p>
      <div className="set-card">
        <div className="ch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>All stores</h3>
          <button className="btn btn-pri btn-sm" onClick={() => setAdding(true)}>+ Add store</button>
        </div>
        <table className="tbl">
          <thead><tr><th>Name</th><th>Area</th><th>Phone</th><th>TRN</th><th>Status</th><th className="num">Actions</th></tr></thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.area ?? '—'}</td><td>{s.phone ?? '—'}</td><td>{s.trn ?? '—'}</td>
                <td><span className={`switch${s.active ? ' on' : ''}`} onClick={async () => { await api(`/stores/${s.id}`, { method: 'PATCH', body: { active: !s.active } }); reload(); }} /></td>
                <td className="num">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={async () => { if (confirm(`Delete ${s.name}?`)) { await api(`/stores/${s.id}`, { method: 'DELETE' }); reload(); toast.show('Store removed'); } }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(adding || editing) && <StoreForm initial={editing} onClose={() => { setAdding(false); setEditing(null); }} onSaved={() => { reload(); setAdding(false); setEditing(null); }} />}
    </div>
  );
}

function StoreForm({ initial, onClose, onSaved }: { initial: any | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: initial?.name ?? '', area: initial?.area ?? '', address: initial?.address ?? '', phone: initial?.phone ?? '', trn: initial?.trn ?? '', hours: initial?.hours ?? '' });
  const isEdit = !!initial;
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    if (!f.name) return toast.show('Name required');
    setBusy(true);
    try {
      if (isEdit) await api(`/stores/${initial.id}`, { method: 'PATCH', body: f });
      else await api('/stores', { method: 'POST', body: f });
      onSaved();
      toast.show('Saved');
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{isEdit ? 'Edit store' : 'Add store'}</h3><button className="x" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="field"><label>Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field-2">
            <div className="field"><label>Area</label><input className="input" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></div>
            <div className="field"><label>Phone</label><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          </div>
          <div className="field"><label>Address</label><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <div className="field-2">
            <div className="field"><label>TRN</label><input className="input" value={f.trn} onChange={(e) => setF({ ...f, trn: e.target.value })} /></div>
            <div className="field"><label>Hours</label><input className="input" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={save}>{isEdit ? 'Save changes' : 'Add store'}</button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

export default function StoresSettings({ initial, activeStoreId }: { initial: any[]; activeStoreId: string }) {
  const [stores, setStores] = useState(initial);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const toast = useToast();

  async function reload() {
    setStores(await api<any[]>('/stores'));
  }

  async function doDelete(store: any) {
    await api(`/stores/${store.id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    reload();
    toast.show('Store removed');
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
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{s.name}</span>
                    {s.id === activeStoreId && (
                      <span className="pill paid" style={{ fontSize: 10 }}>Active</span>
                    )}
                  </div>
                </td>
                <td>{s.area ?? '—'}</td>
                <td>{s.phone ?? '—'}</td>
                <td>{s.trn ?? '—'}</td>
                <td>
                  <span
                    className={`switch${s.active ? ' on' : ''}`}
                    onClick={async () => { await api(`/stores/${s.id}`, { method: 'PATCH', body: { active: !s.active } }); reload(); }}
                  />
                </td>
                <td className="num">
                  <button className="btn btn-ghost btn-sm" onClick={() => setViewing(s)}>View</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}>Edit</button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => setConfirmDelete(s)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(adding || editing) && (
        <StoreForm
          initial={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { reload(); setAdding(false); setEditing(null); }}
        />
      )}
      {viewing && <StoreViewModal store={viewing} isActive={viewing.id === activeStoreId} onClose={() => setViewing(null)} />}
      {confirmDelete && (
        <div className="modal-scrim show" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Remove store?</h3>
              <button className="x" onClick={() => setConfirmDelete(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ padding: '8px 12px', color: 'var(--muted)' }}>
                Delete <b>{confirmDelete.name}</b>? Orders attached to this store will remain but won't have a current location.
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-pri" style={{ flex: 1 }} onClick={() => doDelete(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StoreViewModal({ store, isActive, onClose }: { store: any; isActive: boolean; onClose: () => void }) {
  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            {store.name}
            {isActive && <span className="pill paid" style={{ marginLeft: 8, fontSize: 10 }}>Active</span>}
          </h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="odl-meta" style={{ flexWrap: 'wrap' }}>
            <span><b>Area:</b> {store.area ?? '—'}</span>
            <span>·</span>
            <span><b>Phone:</b> {store.phone ?? '—'}</span>
            <span>·</span>
            <span><b>TRN:</b> {store.trn ?? '—'}</span>
          </div>
          <div style={{ padding: '12px 16px', display: 'grid', gap: 6, fontSize: 13 }}>
            <div><span style={{ color: 'var(--muted)' }}>Address: </span>{store.address ?? '—'}</div>
            <div><span style={{ color: 'var(--muted)' }}>Hours: </span>{store.hours ?? '—'}</div>
            <div><span style={{ color: 'var(--muted)' }}>Status: </span>{store.active ? 'Active (accepting orders)' : 'Inactive (not accepting orders)'}</div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Close</button>
        </div>
      </div>
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

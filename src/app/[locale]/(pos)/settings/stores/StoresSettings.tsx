'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

/* Design app.js:1599-1612 — Stores:
   - .set-sec h2 'Stores' + ssub 'Manage every branch — switch the active
     store from the top bar' (set-sec closes here).
   - .set-card padding:0 overflow:hidden:
     - Custom header: flex space-between padding:14-16 with bottom border —
       <b 14px>${n} stores</b> + .btn.btn-pri '+ Add Store' (id='store-add')
       padding:9-14.
     - table.tbl thead 6 cols: Store / Area / Phone / Hours / Status / (action).
     - Row: .t-name name + optional .pill.paid 'Active' (margin-left:4) /
       area / .mono 12px phone / hours / .pill.paid|muted Open|Closed /
       text-align:right white-space:nowrap with .t-btn 'Edit' (data-storeedit) +
       .t-btn 'View' (data-storeview) + .t-btn 'Delete' (data-storedel, danger). */

interface Store {
  id: string;
  name: string;
  area?: string | null;
  address?: string | null;
  phone?: string | null;
  trn?: string | null;
  hours?: string | null;
  active: boolean;
}

export default function StoresSettings({ initial, activeStoreId }: { initial: Store[]; activeStoreId: string }) {
  const [stores, setStores] = useState<Store[]>(initial);
  const [editing, setEditing] = useState<Store | null>(null);
  const [viewing, setViewing] = useState<Store | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Store | null>(null);
  const toast = useToast();

  async function reload() {
    setStores(await api<Store[]>('/stores'));
  }

  async function doDelete(store: Store) {
    await api(`/stores/${store.id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    reload();
    toast.show('Store removed');
  }

  return (
    <>
      <div className="set-sec">
        <h2>Stores</h2>
        <div className="ssub">Manage every branch — switch the active store from the top bar</div>
      </div>

      <div className="set-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <b style={{ fontSize: 14 }}>{stores.length} stores</b>
          <button
            className="btn btn-pri"
            id="store-add"
            style={{ padding: '9px 14px' }}
            onClick={() => setAdding(true)}
          >
            + Add Store
          </button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Store</th>
              <th>Area</th>
              <th>Phone</th>
              <th>Hours</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s, i) => (
              <tr key={s.id}>
                <td className="t-name">
                  {s.name}
                  {s.id === activeStoreId && (
                    <span className="pill paid" style={{ marginLeft: 4 }}>Active</span>
                  )}
                </td>
                <td>{s.area ?? '—'}</td>
                <td className="mono" style={{ fontSize: 12 }}>{s.phone ?? '—'}</td>
                <td>{s.hours ?? '—'}</td>
                <td>
                  <span className={`pill ${s.active ? 'paid' : 'muted'}`}>
                    {s.active ? 'Open' : 'Closed'}
                  </span>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="t-btn" data-storeedit={i} onClick={() => setEditing(s)}>Edit</button>{' '}
                  <button className="t-btn" data-storeview={i} onClick={() => setViewing(s)}>View</button>{' '}
                  <button
                    className="t-btn"
                    data-storedel={i}
                    style={{ color: 'var(--danger)' }}
                    onClick={() => setConfirmDelete(s)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {stores.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--muted)', fontSize: 13, padding: 16 }}>
                  No stores yet — add one.
                </td>
              </tr>
            )}
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
    </>
  );
}

function StoreViewModal({ store, isActive, onClose }: { store: Store; isActive: boolean; onClose: () => void }) {
  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            {store.name}
            {isActive && <span className="pill paid" style={{ marginLeft: 8 }}>Active</span>}
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
            <div><span style={{ color: 'var(--muted)' }}>Status: </span>{store.active ? 'Open' : 'Closed'}</div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function StoreForm({ initial, onClose, onSaved }: { initial: Store | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? '',
    area: initial?.area ?? '',
    address: initial?.address ?? '',
    phone: initial?.phone ?? '',
    trn: initial?.trn ?? '',
    hours: initial?.hours ?? '',
  });
  const isEdit = !!initial;
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    if (!f.name) return toast.show('Name required');
    setBusy(true);
    try {
      if (isEdit && initial) await api(`/stores/${initial.id}`, { method: 'PATCH', body: f });
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
            <div className="field"><label>Hours</label><input className="input" placeholder="e.g. 8:00 AM – 10:00 PM" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></div>
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

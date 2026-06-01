'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

export interface RackRow {
  id: string;
  storeId: string;
  storeName: string | null;
  code: string;
  active: boolean;
  occupancy: number;
}

export interface StoreOption {
  id: string;
  name: string;
}

interface DraftRack {
  id?: string;
  storeId: string;
  code: string;
  active: boolean;
}

export default function RacksScreen({ initial, stores }: { initial: RackRow[]; stores: StoreOption[] }) {
  const [racks, setRacks] = useState<RackRow[]>(initial);
  const [editing, setEditing] = useState<RackRow | null>(null);
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  async function reload() {
    setRacks(await api<RackRow[]>('/racks'));
  }

  // Group racks by store for display.
  const grouped = useMemo(() => {
    const map = new Map<string, { storeId: string; storeName: string; rows: RackRow[] }>();
    for (const r of racks) {
      const key = r.storeId;
      const existing = map.get(key);
      if (existing) existing.rows.push(r);
      else map.set(key, { storeId: r.storeId, storeName: r.storeName ?? 'Unassigned', rows: [r] });
    }
    return Array.from(map.values()).sort((a, b) => a.storeName.localeCompare(b.storeName));
  }, [racks]);

  async function toggle(rack: RackRow) {
    await api(`/racks/${rack.id}`, { method: 'PATCH', body: { active: !rack.active } });
    await reload();
  }

  async function remove(rack: RackRow) {
    if (!confirm(`Remove rack ${rack.code}?`)) return;
    await api(`/racks/${rack.id}`, { method: 'DELETE' });
    await reload();
    toast.show('Rack removed');
  }

  return (
    <div className="set-sec">
      <h2>Racks</h2>
      <p className="ssub">Physical labels for picked-up orders awaiting collection.</p>

      <div className="set-card">
        <div className="ch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>All racks</h3>
          <button className="btn btn-pri btn-sm" disabled={stores.length === 0} onClick={() => setAdding(true)}>+ Add rack</button>
        </div>

        {racks.length === 0 && (
          <div className="muted" style={{ padding: '12px 0', fontSize: 13 }}>No racks defined.</div>
        )}

        {grouped.map((group) => (
          <div key={group.storeId} style={{ marginTop: 16 }}>
            <div className="csub" style={{ marginBottom: 8, fontSize: 12, fontWeight: 600 }}>{group.storeName}</div>
            <div className="rk-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {group.rows.map((r) => (
                <button
                  key={r.id}
                  className="rk-chip"
                  onClick={() => setEditing(r)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: r.active ? 'var(--card)' : 'transparent',
                    opacity: r.active ? 1 : 0.55,
                    cursor: 'pointer',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 13,
                  }}
                  title={`In use: ${r.occupancy}`}
                >
                  <span>{r.code}</span>
                  <span className="pill muted" style={{ fontSize: 10 }}>In use {r.occupancy}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(adding || editing) && (
        <RackForm
          stores={stores}
          initial={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); void reload(); }}
          onDeleted={() => { setAdding(false); setEditing(null); void reload(); }}
          onRemove={editing ? () => remove(editing) : undefined}
          onToggle={editing ? () => toggle(editing) : undefined}
        />
      )}
    </div>
  );
}

function RackForm({
  stores,
  initial,
  onClose,
  onSaved,
  onRemove,
  onToggle,
}: {
  stores: StoreOption[];
  initial: RackRow | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  onRemove?: () => void;
  onToggle?: () => void;
}) {
  const [f, setF] = useState<DraftRack>({
    id: initial?.id,
    storeId: initial?.storeId ?? stores[0]?.id ?? '',
    code: initial?.code ?? '',
    active: initial?.active ?? true,
  });
  const isEdit = !!initial;
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    if (!f.code.trim()) return toast.show('Rack code required');
    if (!f.storeId) return toast.show('Store required');
    setBusy(true);
    try {
      if (isEdit && f.id) {
        await api(`/racks/${f.id}`, { method: 'PATCH', body: { code: f.code.trim(), storeId: f.storeId, active: f.active } });
      } else {
        await api('/racks', { method: 'POST', body: { code: f.code.trim(), storeId: f.storeId, active: f.active } });
      }
      onSaved();
      toast.show('Rack saved');
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isEdit ? 'Edit rack' : 'Add rack'}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Rack code</label>
            <input
              className="input"
              value={f.code}
              placeholder="e.g. A-05"
              onChange={(e) => setF({ ...f, code: e.target.value })}
              autoFocus
            />
          </div>
          <div className="field">
            <label>Store</label>
            <select
              className="input"
              value={f.storeId}
              onChange={(e) => setF({ ...f, storeId: e.target.value })}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {isEdit && onToggle && (
            <div className="set-row" style={{ borderTop: 'none', padding: '8px 0 0' }}>
              <div className="l"><b>Active</b><span>Inactive racks are hidden from the order assignment list</span></div>
              <div className="r">
                <span
                  className={`switch${f.active ? ' on' : ''}`}
                  onClick={() => { setF({ ...f, active: !f.active }); onToggle(); }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="modal-foot" style={{ gap: 8 }}>
          {isEdit && onRemove && (
            <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={onRemove}>Remove</button>
          )}
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={save}>
            {isEdit ? 'Save changes' : 'Add rack'}
          </button>
        </div>
      </div>
    </div>
  );
}

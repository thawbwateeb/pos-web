'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import StoreSyncControls, { type StoreOption } from '@/components/StoreSyncControls';

/* Design app.js:1488-1493 — Racks & Locations:
   - .set-sec h2 'Racks & Locations' + ssub 'Physical shelf/rack locations
     orders are assigned to' (set-sec closes here).
   - .set-card:
     - .rk-add: input id='rk-new' placeholder='Add rack label… e.g. A-05'
       autocomplete='off' + .btn.btn-pri id='rk-add-btn' 'Add rack'.
     - .rk-grid: flat list of .rk-chip <span><span class='rk-d'/>{code}
       <button class='rk-del' data-rkdel='\${i}' title='Remove'>×</button>
       </span>, or muted '\${size:13px} No racks defined yet.' fallback.

   Extension: a store picker at the top with "Copy to all other stores"
   button — only the racks for the currently-selected store are shown
   and edited. The sync endpoint POST /racks/sync inserts any
   missing rack codes from this store into every other store. */

export interface RackRow {
  id: string;
  storeId: string;
  storeName: string | null;
  code: string;
  active: boolean;
  occupancy: number;
}

export default function RacksScreen({ initial, stores }: { initial: RackRow[]; stores: StoreOption[] }) {
  const [storeId, setStoreId] = useState<string>(stores[0]?.id ?? '');
  const [racks, setRacks] = useState<RackRow[]>(initial);
  const [code, setCode] = useState<string>('');
  const toast = useToast();

  const filtered = useMemo(() => racks.filter((r) => r.storeId === storeId), [racks, storeId]);

  async function reload() {
    setRacks(await api<RackRow[]>('/racks'));
  }

  async function addRack() {
    const value = code.trim();
    if (!value) return;
    if (!storeId) { toast.show('Pick a store first'); return; }
    if (filtered.some((r) => r.code.toLowerCase() === value.toLowerCase())) {
      setCode('');
      return;
    }
    await api('/racks', { method: 'POST', body: { code: value, storeId, active: true } });
    setCode('');
    reload();
  }

  async function removeRack(rack: RackRow) {
    await api(`/racks/${rack.id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <>
      <div className="set-sec">
        <h2>Racks &amp; Locations</h2>
        <div className="ssub">Physical shelf/rack locations orders are assigned to</div>
      </div>

      {stores.length > 0 && (
        <div className="set-card" style={{ marginBottom: 14 }}>
          <StoreSyncControls
            stores={stores}
            storeId={storeId}
            onStoreChange={setStoreId}
            syncEndpoint={'/racks/sync'}
            syncBody={{ fromStoreId: storeId }}
            syncLabel="Copy racks to all other stores"
            successKey="copiedTo"
          />
        </div>
      )}

      <div className="set-card">
        <div className="rk-add">
          <input
            className="inp"
            id="rk-new"
            placeholder="Add rack label… e.g. A-05"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addRack(); }}
          />
          <button className="btn btn-pri" id="rk-add-btn" onClick={addRack}>Add rack</button>
        </div>
        <div className="rk-grid">
          {filtered.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>No racks defined yet.</div>
          ) : (
            filtered.map((r, i) => (
              <span key={r.id} className="rk-chip">
                <span className="rk-d" />
                {r.code}
                <button className="rk-del" data-rkdel={i} title="Remove" onClick={() => removeRack(r)}>×</button>
              </span>
            ))
          )}
        </div>
      </div>
    </>
  );
}

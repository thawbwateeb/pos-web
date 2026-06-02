'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import StoreSyncControls from '@/components/StoreSyncControls';
import { useActiveStoreId } from '@/components/BootstrapContext';

/* Design app.js:1488-1493 — Racks & Locations:
   - .set-sec h2 'Racks & Locations' + ssub 'Physical shelf/rack locations
     orders are assigned to' (set-sec closes here).
   - .set-card:
     - .rk-add: input id='rk-new' placeholder='Add rack label… e.g. A-05'
       autocomplete='off' + .btn.btn-pri id='rk-add-btn' 'Add rack'.
     - .rk-grid: flat list of .rk-chip <span><span class='rk-d'/>{code}
       <button class='rk-del' data-rkdel='\${i}' title='Remove'>×</button>
       </span>, or muted '\${size:13px} No racks defined yet.' fallback.

   The active store comes from the global topbar picker (BootstrapContext);
   we filter the rack list to that store and add new racks under it. A
   single "Copy racks to all other stores" button at the top syncs the
   current store's rack list to every other store. */

export interface RackRow {
  id: string;
  storeId: string;
  storeName: string | null;
  code: string;
  active: boolean;
  occupancy: number;
}

export default function RacksScreen({ initial }: { initial: RackRow[] }) {
  const activeStoreId = useActiveStoreId();
  const [racks, setRacks] = useState<RackRow[]>(initial);
  const [code, setCode] = useState<string>('');
  const toast = useToast();

  const filtered = useMemo(() => racks.filter((r) => r.storeId === activeStoreId), [racks, activeStoreId]);

  async function reload() {
    setRacks(await api<RackRow[]>('/racks'));
  }

  async function addRack() {
    const value = code.trim();
    if (!value) return;
    if (!activeStoreId) { toast.show('Pick a store from the topbar first'); return; }
    if (filtered.some((r) => r.code.toLowerCase() === value.toLowerCase())) {
      setCode('');
      return;
    }
    await api('/racks', { method: 'POST', body: { code: value, storeId: activeStoreId, active: true } });
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

      <div className="set-card" style={{ marginBottom: 14 }}>
        <StoreSyncControls
          syncEndpoint={'/racks/sync'}
          syncBody={{ fromStoreId: activeStoreId }}
          syncLabel="Copy racks to all other stores"
          successKey="copiedTo"
        />
      </div>

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

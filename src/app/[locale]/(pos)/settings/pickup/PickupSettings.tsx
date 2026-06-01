'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

const KIND_LABEL: Record<string, string> = { BOTH: 'Pickup & Delivery', PICKUP: 'Pickup only', DELIVERY: 'Delivery only' };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export default function PickupSettings({ initialSettings, initialSlots }: { initialSettings: any; initialSlots: any[] }) {
  const [s, setS] = useState(initialSettings ?? {});
  const [slots, setSlots] = useState(initialSlots);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function saveSettings() {
    setBusy(true);
    try {
      await api('/pickup/settings', { method: 'PATCH', body: s });
      toast.show('Saved');
    } finally { setBusy(false); }
  }

  async function reloadSlots() { setSlots(await api<any[]>('/pickup/slots')); }

  async function addSlot() {
    const label = prompt('Slot label (e.g. 16:00 – 18:00)');
    if (!label) return;
    await api('/pickup/slots', { method: 'POST', body: { label, capacity: s.defaultCap ?? 8, kind: 'BOTH' } });
    reloadSlots();
  }

  return (
    <div className="set-sec">
      <h2>Pickup & Delivery</h2>
      <p className="ssub">Slots, cutoffs, and delivery fees.</p>

      <div className="set-card">
        <h3>Settings</h3>
        <div className="set-row"><div className="l"><b>Default slot capacity</b></div><div className="r"><input className="input sm" type="number" value={s.defaultCap ?? 8} onChange={(e) => setS({ ...s, defaultCap: +e.target.value })} /></div></div>
        <div className="set-row"><div className="l"><b>Lead time (hours)</b></div><div className="r"><input className="input sm" type="number" value={s.leadHours ?? 2} onChange={(e) => setS({ ...s, leadHours: +e.target.value })} /></div></div>
        <div className="set-row"><div className="l"><b>Same-day cutoff</b></div><div className="r"><input className="input time" type="time" value={s.sameDayCutoff ?? '14:00'} onChange={(e) => setS({ ...s, sameDayCutoff: e.target.value })} /></div></div>
        <div className="set-row"><div className="l"><b>Delivery fee (AED)</b></div><div className="r"><input className="input sm" type="number" value={s.deliveryFee ?? 15} onChange={(e) => setS({ ...s, deliveryFee: +e.target.value })} /></div></div>
        <div className="set-row"><div className="l"><b>Free over (AED)</b></div><div className="r"><input className="input sm" type="number" value={s.freeOver ?? 50} onChange={(e) => setS({ ...s, freeOver: +e.target.value })} /></div></div>
        <div className="set-row"><div className="l"><b>Express surcharge (%)</b></div><div className="r"><input className="input sm" type="number" value={s.expressSurcharge ?? 30} onChange={(e) => setS({ ...s, expressSurcharge: +e.target.value })} /></div></div>
        <div className="set-row"><div className="l"><b>Auto-assign driver</b></div><div className="r"><span className={`switch${s.autoAssignDriver ? ' on' : ''}`} onClick={() => setS({ ...s, autoAssignDriver: !s.autoAssignDriver })} /></div></div>
        <div className="set-row"><div className="l"><b>Days enabled</b></div><div className="r" style={{ flexWrap: 'wrap' }}>
          {DAYS.map((d) => {
            const on = !!s.daysEnabled?.[d];
            return <button key={d} className={`pk-day${on ? ' on' : ''}`} onClick={() => setS({ ...s, daysEnabled: { ...(s.daysEnabled ?? {}), [d]: !on } })}>{d}</button>;
          })}
        </div></div>
        <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} onClick={saveSettings} style={{ marginTop: 10 }}>Save settings</button>
      </div>

      <div className="set-card">
        <div className="pk-h"><b>Slots</b><button className="btn btn-pri btn-sm" onClick={addSlot}>+ Add slot</button></div>
        <table className="tbl">
          <thead><tr><th>Label</th><th className="num">Capacity</th><th>Kind</th><th>Active</th><th className="num"></th></tr></thead>
          <tbody>
            {slots.map((sl) => (
              <tr key={sl.id}>
                <td><b>{sl.label}</b></td>
                <td className="num">{sl.capacity}</td>
                <td><span className={`pk-kind ${sl.kind.toLowerCase()}`}>{KIND_LABEL[sl.kind]}</span></td>
                <td><span className={`switch${sl.active ? ' on' : ''}`} onClick={async () => { await api(`/pickup/slots/${sl.id}`, { method: 'PATCH', body: { active: !sl.active } }); reloadSlots(); }} /></td>
                <td className="num"><button className="btn btn-ghost btn-sm" onClick={async () => { if (confirm('Delete slot?')) { await api(`/pickup/slots/${sl.id}`, { method: 'DELETE' }); reloadSlots(); } }}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

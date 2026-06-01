'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const LABEL: Record<string, string> = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' };

interface H { id?: string; day: typeof DAYS[number]; open: boolean; slots: [string, string][] }

export default function HoursForm({ initial }: { initial: H[] }) {
  const byDay: Record<string, H> = Object.fromEntries(initial.map((h) => [h.day, h]));
  const [rows, setRows] = useState<H[]>(DAYS.map((d) => byDay[d] ?? { day: d, open: true, slots: [['08:00', '22:00']] }));
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  function update(idx: number, patch: Partial<H>) {
    setRows((cur) => cur.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function updateSlot(idx: number, slotIdx: number, val: [string, string]) {
    setRows((cur) => cur.map((r, i) => (i === idx ? { ...r, slots: r.slots.map((s, si) => si === slotIdx ? val : s) } : r)));
  }

  async function save() {
    setBusy(true);
    try { await api('/business-hours', { method: 'PUT', body: rows }); toast.show('Hours saved'); } finally { setBusy(false); }
  }

  return (
    <div className="set-sec">
      <h2>Business hours</h2>
      <p className="ssub">When your stores accept new orders.</p>
      <div className="set-card">
        {rows.map((r, i) => (
          <div className="set-row" key={r.day}>
            <div className="l"><b>{LABEL[r.day]}</b></div>
            <div className="r" style={{ flexWrap: 'wrap' }}>
              <span className={`switch${r.open ? ' on' : ''}`} onClick={() => update(i, { open: !r.open })} />
              {r.open && r.slots.map((s, si) => (
                <div className="setr-field" key={si}>
                  <input className="input time" type="time" value={s[0]} onChange={(e) => updateSlot(i, si, [e.target.value, s[1]])} />
                  <span className="unit">to</span>
                  <input className="input time" type="time" value={s[1]} onChange={(e) => updateSlot(i, si, [s[0], e.target.value])} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} onClick={save}>Save</button>
    </div>
  );
}

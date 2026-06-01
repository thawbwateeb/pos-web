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
  function addSlot(idx: number) {
    setRows((cur) => cur.map((r, i) => {
      if (i !== idx) return r;
      // Default the new slot to start where the previous one ended.
      const last = r.slots[r.slots.length - 1];
      const fallback: [string, string] = last ? [last[1], last[1]] : ['09:00', '13:00'];
      return { ...r, slots: [...r.slots, fallback] };
    }));
  }
  function removeSlot(idx: number, slotIdx: number) {
    setRows((cur) => cur.map((r, i) => {
      if (i !== idx) return r;
      const next = r.slots.filter((_, si) => si !== slotIdx);
      // Always keep at least one slot if the day is open.
      return { ...r, slots: next.length ? next : r.slots };
    }));
  }

  async function save() {
    setBusy(true);
    try { await api('/business-hours', { method: 'PUT', body: rows }); toast.show('Hours saved'); } finally { setBusy(false); }
  }

  return (
    <div className="set-sec">
      <h2>Business hours</h2>
      <p className="ssub">When your stores accept new orders. Add a second slot for a midday break.</p>
      <div className="set-card">
        {rows.map((r, i) => (
          <div className="set-row" key={r.day}>
            <div className="l"><b>{LABEL[r.day]}</b></div>
            <div className="r" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
              <span className={`switch${r.open ? ' on' : ''}`} onClick={() => update(i, { open: !r.open })} />
              {r.open && r.slots.map((s, si) => (
                <div className="setr-field" key={si} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <input className="input time" type="time" value={s[0]} onChange={(e) => updateSlot(i, si, [e.target.value, s[1]])} />
                  <span className="unit">to</span>
                  <input className="input time" type="time" value={s[1]} onChange={(e) => updateSlot(i, si, [s[0], e.target.value])} />
                  {r.slots.length > 1 && (
                    <button
                      type="button"
                      className="t-btn ghost"
                      title="Remove slot"
                      onClick={() => removeSlot(i, si)}
                      style={{ width: 22, height: 22, padding: 0, borderRadius: '50%', fontSize: 14 }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {r.open && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => addSlot(i)}
                  title="Add a second time slot"
                >
                  + Slot
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} onClick={save}>Save</button>
    </div>
  );
}

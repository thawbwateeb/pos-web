'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

/* Design app.js:1421-1442 — Business Hours:
   - .set-sec > h2 'Business Hours' + .ssub 'Pickup & delivery scheduling
     respects these hours'
   - .set-card padding:4px 20px:
     For each day: flex/align-start/gap:18 padding:15-0 border-bottom:
       - Left 118px column: <b 14px>Day</b> + .hr-pill.on?off button
         'Open'/'Closed' with data-dayopen
       - Right flex:1 column: per-slot row with two .input.time inputs
         (data-time='\${i}.\${si}.0|1'), '–' muted separator, optional .hr-x
         × (data-rmslot='\${i}.\${si}') and '+ Add hours' .hr-add
         (data-addslot=\${i}) after the last slot.
       - If closed: muted 'Closed all day' 13px padding-top 7.
   - Buttons flex/gap:10/margin-top:14: .btn.btn-pri 'Save Hours' (data-save)
     + .btn.btn-ghost 'Copy Monday to all days' (data-copyhours).
   - .set-card margin-top:14 with a single .set-row border:none padding:0:
     'Same-day express cutoff' + sub 'Orders after this deliver next day' +
     time input value='11:00'. */

const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
type DayKey = (typeof DAY_KEYS)[number];
// Design app.js:1423 renders the full day name (Monday…Sunday).
const SHORT: Record<DayKey, string> = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};

interface H { id?: string; day: DayKey; open: boolean; slots: [string, string][] }

export default function HoursForm({ initial, initialCutoff }: { initial: H[]; initialCutoff?: string }) {
  const byDay: Record<string, H> = Object.fromEntries(initial.map((h) => [h.day, h]));
  const [rows, setRows] = useState<H[]>(
    DAY_KEYS.map((d) => byDay[d] ?? { day: d, open: true, slots: [['08:00', '22:00']] }),
  );
  const [cutoff, setCutoff] = useState<string>(initialCutoff ?? '11:00');
  const tCommon = useTranslations('Common');
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
      return { ...r, slots: [...r.slots, ['09:00', '18:00']] };
    }));
  }
  function removeSlot(idx: number, slotIdx: number) {
    setRows((cur) => cur.map((r, i) => {
      if (i !== idx) return r;
      const next = r.slots.filter((_, si) => si !== slotIdx);
      return { ...r, slots: next.length ? next : r.slots };
    }));
  }
  function toggleDay(idx: number) {
    setRows((cur) => cur.map((r, i) => {
      if (i !== idx) return r;
      const open = !r.open;
      return { ...r, open, slots: open && r.slots.length === 0 ? [['08:00', '22:00']] : r.slots };
    }));
  }
  function copyMondayToAll() {
    const monday = rows[0];
    setRows((cur) => cur.map((r) => ({
      ...r,
      open: monday.open,
      slots: monday.slots.map((s) => [...s] as [string, string]),
    })));
    toast.show('Monday hours copied to all days');
  }

  async function save() {
    setBusy(true);
    try {
      await api('/business-hours', { method: 'PUT', body: rows });
      await api('/business', { method: 'PATCH', body: { expressCutoff: cutoff } });
      toast.show('Hours saved');
    } catch (e: any) {
      toast.show(e?.detail?.message ?? tCommon('saveFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="set-sec">
        <h2>Business Hours</h2>
        <div className="ssub">Pickup &amp; delivery scheduling respects these hours</div>
        <div className="set-card" style={{ padding: '4px 20px' }}>
          {rows.map((h, i) => (
            <div
              key={h.day}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 18,
                padding: '15px 0',
                borderBottom: '1px solid var(--border-2)',
              }}
            >
              <div style={{ width: 118, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 5 }}>
                <b style={{ fontSize: 14, color: 'var(--text)' }}>{SHORT[h.day]}</b>
                <button
                  className={`hr-pill ${h.open ? 'on' : ''}`}
                  data-dayopen={i}
                  onClick={() => toggleDay(i)}
                  type="button"
                >
                  {h.open ? 'Open' : 'Closed'}
                </button>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {h.open ? (
                  h.slots.map((s, si) => (
                    <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        type="time"
                        className="input time"
                        value={s[0]}
                        data-time={`${i}.${si}.0`}
                        onChange={(e) => updateSlot(i, si, [e.target.value, s[1]])}
                      />
                      <span className="muted">–</span>
                      <input
                        type="time"
                        className="input time"
                        value={s[1]}
                        data-time={`${i}.${si}.1`}
                        onChange={(e) => updateSlot(i, si, [s[0], e.target.value])}
                      />
                      {h.slots.length > 1 && (
                        <button
                          type="button"
                          className="hr-x"
                          data-rmslot={`${i}.${si}`}
                          onClick={() => removeSlot(i, si)}
                          title="Remove slot"
                        >
                          ×
                        </button>
                      )}
                      {si === h.slots.length - 1 && (
                        <button
                          type="button"
                          className="hr-add"
                          data-addslot={i}
                          onClick={() => addSlot(i)}
                        >
                          + Add hours
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <span className="muted" style={{ fontSize: 13, paddingTop: 7 }}>Closed all day</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} data-save onClick={save} disabled={busy}>
            Save Hours
          </button>
          <button className="btn btn-ghost" data-copyhours onClick={copyMondayToAll}>
            Copy Monday to all days
          </button>
        </div>
        <div className="set-card" style={{ marginTop: 14 }}>
          <div className="set-row" style={{ border: 'none', padding: 0 }}>
            <div className="l">
              <b>Same-day express cutoff</b>
              <span>Orders after this deliver next day</span>
            </div>
            <div className="r">
              <input type="time" className="input time" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

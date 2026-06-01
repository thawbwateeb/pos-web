'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { AED, shortTime } from '@/lib/format';
import { useToast } from '@/components/Toast';

export default function ShiftsScreen({ current, history }: { current: any; history: any[] }) {
  const [open, setOpen] = useState(current);
  const [list, setList] = useState(history);
  const toast = useToast();

  async function startShift() {
    const float = Number(prompt('Opening cash float (AED)') ?? 0);
    if (!float && float !== 0) return;
    await api('/shifts/open', { method: 'POST', body: { openingFloat: float } });
    setOpen(await api<any>('/shifts/current'));
    setList(await api<any[]>('/shifts'));
    toast.show('Shift opened');
  }
  async function closeShift() {
    const counted = Number(prompt('Counted cash in drawer (AED)') ?? 0);
    if (!counted && counted !== 0) return;
    await api(`/shifts/${open.id}/close`, { method: 'POST', body: { countedDrawer: counted } });
    setOpen(null);
    setList(await api<any[]>('/shifts'));
    toast.show('Shift closed · Z-report generated');
  }
  async function addMovement(type: 'PAID_IN' | 'PAID_OUT' | 'PETTY_CASH') {
    const reason = prompt('Reason');
    const amount = Number(prompt('Amount (AED)') ?? 0);
    if (!reason || !amount) return;
    await api(`/shifts/${open.id}/movements`, { method: 'POST', body: { type, reason, amount } });
    setOpen(await api<any>('/shifts/current'));
  }

  return (
    <div className="set-sec">
      <h2>Cash & Shift</h2>
      <p className="ssub">Open a shift to start tracking cash, then close it at end-of-day for a Z-report.</p>

      {open ? (
        <div className="set-card">
          <h3>Current shift</h3>
          <div className="set-row"><div className="l"><b>Opening float</b></div><div className="r">{AED(open.openingFloat)}</div></div>
          <div className="set-row"><div className="l"><b>Opened at</b></div><div className="r">{shortTime(open.openedAt)}</div></div>
          <h3 style={{ marginTop: 14 }}>Movements</h3>
          {open.movements?.map((m: any, i: number) => (
            <div key={i} className="set-row"><div className="l"><b>{m.type}</b><span>{m.reason}</span></div><div className="r"><b>{AED(m.amount)}</b></div></div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => addMovement('PAID_IN')}>+ Paid in</button>
            <button className="btn btn-ghost btn-sm" onClick={() => addMovement('PAID_OUT')}>− Paid out</button>
            <button className="btn btn-ghost btn-sm" onClick={() => addMovement('PETTY_CASH')}>− Petty cash</button>
            <button className="btn btn-pri" style={{ marginLeft: 'auto' }} onClick={closeShift}>End shift · Z-report</button>
          </div>
        </div>
      ) : (
        <div className="set-card">
          <p className="muted">No active shift. Open a new one to start.</p>
          <button className="btn btn-pri" onClick={startShift}>Open shift</button>
        </div>
      )}

      <div className="set-card">
        <h3>History</h3>
        <table className="tbl">
          <thead><tr><th>Opened</th><th>Closed</th><th className="num">Float</th><th className="num">Counted</th><th className="num">Variance</th><th>By</th></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.openedAt).toLocaleString()}</td>
                <td>{s.closedAt ? new Date(s.closedAt).toLocaleString() : '—'}</td>
                <td className="num">{AED(s.openingFloat)}</td>
                <td className="num">{s.countedDrawer != null ? AED(s.countedDrawer) : '—'}</td>
                <td className={`num ${s.variance != null && +s.variance < 0 ? 'neg' : ''}`}>{s.variance != null ? AED(s.variance) : '—'}</td>
                <td>{s.openedBy?.fullName ?? '—'}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>No shifts yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

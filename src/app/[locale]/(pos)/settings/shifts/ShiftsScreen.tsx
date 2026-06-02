'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { AED, AED0, shortTime } from '@/lib/format';
import { useToast } from '@/components/Toast';

/* Design ops.js:23-93 (renderCashShift + openMoveModal):
   Outer: <div class="fin">.
   KPI row: .grid.g4 of 4 .card.kpi:
     - Shift gross sales / AED0(gross) / '\${orders} orders since \${open}'
     - Cash collected / AED0(cash) / 'Card AED0(card) · Account AED0(account)'
     - Expected in drawer / AED0(expected) / 'Float AED0(float) + cash + movements'
     - Refunds / AED0(refunds) / 'This shift'
   Cash movements: .card.flush > .ch h3 'Cash movements' + .btn.btn-pri.btn-sm '+ Add movement' id='cm-add'
     table.tbl thead: Time / Type / Reason / By / Amount(num) / (action)
     Row: .tnum time / .pill.ok|mut Paid in|Paid out|Petty cash / reason /
       .muted by / .num.tnum.pos|neg signed AED / Delete btn data-cmdel
     tfoot: 'Net cash movements' colspan=4 + AED(inn-out)
   Cards grid .grid.g2 align-items:start:
     ZReport card: h3 'End-of-day Z-report' + .csub 'Close the day and reconcile the drawer'
       .odl-sum: Opening float / Cash sales / Paid in (+) / Paid out / petty (−) / Expected drawer (.tot)
       'Counted cash in drawer' input id='z-counted'
       .note id='z-var' (live variance)
       .btn.btn-pri id='z-close' 'Generate Z-report & close day'
     Shift summary: h3 'Shift summary' + .csub '\${cashier} · since \${open}'
       table.tbl: Cash / Card / Digital / Account / Credit / Refunds (.neg)
       tfoot: 'Net takings' AED(gross-refunds)
       .btn.btn-ghost id='shift-print' 'Print shift report'
*/

export type MovementType = 'PAID_IN' | 'PAID_OUT' | 'PETTY_CASH';

export interface Movement {
  id: string;
  type: MovementType;
  reason: string;
  amount: string | number;
  byUserId?: string | null;
  by?: { fullName: string } | null;
  createdAt: string;
}

export interface PaymentBreakdownRow {
  method: 'CASH' | 'CARD' | 'APPLE_PAY' | 'ACCOUNT' | 'ON_DELIVERY' | 'GIFT_CARD';
  total: number;
  count: number;
}

export interface ShiftSummary {
  shift: {
    id: string;
    storeId: string;
    openedAt: string;
    openingFloat: string | number;
    openedBy?: { fullName: string } | null;
  };
  movements: Movement[];
  kpis: {
    grossSales: number;
    cashCollected: number;
    expectedDrawer: number;
    refunds: number;
    orders: number;
    netTakings: number;
  };
  breakdown: PaymentBreakdownRow[];
  totals: {
    openingFloat: number;
    cashSales: number;
    paidIn: number;
    paidOut: number;
  };
}

export interface ShiftHistoryRow {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingFloat: string | number;
  countedDrawer: string | number | null;
  variance: string | number | null;
  openedBy?: { fullName: string } | null;
}

const TYPE_LABEL: Record<MovementType, string> = {
  PAID_IN: 'Paid in',
  PAID_OUT: 'Paid out',
  PETTY_CASH: 'Petty cash',
};

interface Props {
  initialSummary: ShiftSummary | null;
  initialHistory: ShiftHistoryRow[];
}

export default function ShiftsScreen({ initialSummary, initialHistory }: Props) {
  const toast = useToast();
  const [summary, setSummary] = useState<ShiftSummary | null>(initialSummary);
  const [history, setHistory] = useState<ShiftHistoryRow[]>(initialHistory);
  const [openModal, setOpenModal] = useState<null | 'open' | 'move'>(null);

  async function refresh() {
    const [s, h] = await Promise.all([
      api<ShiftSummary | null>('/shifts/current/summary').catch(() => null),
      api<ShiftHistoryRow[]>('/shifts').catch(() => [] as ShiftHistoryRow[]),
    ]);
    setSummary(s);
    setHistory(h);
  }

  async function openShift(openingFloat: number) {
    try {
      await api('/shifts/current/open', { method: 'POST', body: { openingFloat } });
      await refresh();
      toast.show('Shift opened');
      setOpenModal(null);
    } catch {
      toast.show('Failed');
    }
  }

  async function addMovement(type: MovementType, reason: string, amount: number) {
    try {
      await api('/shifts/current/movements', { method: 'POST', body: { type, reason, amount } });
      await refresh();
      toast.show('Movement added');
      setOpenModal(null);
    } catch {
      toast.show('Failed');
    }
  }

  async function deleteMovement(id: string) {
    try {
      await api(`/shifts/current/movements/${id}`, { method: 'DELETE' });
      await refresh();
      toast.show('Movement removed');
    } catch {
      toast.show('Failed');
    }
  }

  async function closeShift(countedDrawer: number) {
    if (!summary) return;
    try {
      await api('/shifts/current/close', { method: 'POST', body: { countedDrawer } });
      await refresh();
      toast.show('Z-report generated · day closed');
    } catch {
      toast.show('Failed');
    }
  }

  if (!summary) {
    return (
      <div className="fin">
        <div className="set-card" style={{ marginTop: 16 }}>
          <p className="muted">No shift open right now.</p>
          <button className="btn btn-pri" onClick={() => setOpenModal('open')}>Open shift</button>
        </div>
        <HistoryCard rows={history} />
        {openModal === 'open' && (
          <OpenShiftModal onClose={() => setOpenModal(null)} onSubmit={openShift} />
        )}
      </div>
    );
  }

  return (
    <div className="fin">
      <ActiveShift
        summary={summary}
        onDeleteMovement={deleteMovement}
        onAddMovement={() => setOpenModal('move')}
        onCloseShift={closeShift}
      />
      <HistoryCard rows={history} />
      {openModal === 'move' && (
        <MoveCashModal onClose={() => setOpenModal(null)} onSubmit={addMovement} />
      )}
    </div>
  );
}

function ActiveShift({
  summary,
  onDeleteMovement,
  onAddMovement,
  onCloseShift,
}: {
  summary: ShiftSummary;
  onDeleteMovement: (id: string) => void;
  onAddMovement: () => void;
  onCloseShift: (counted: number) => void | Promise<void>;
}) {
  const { kpis, movements, breakdown, totals, shift } = summary;
  const openedAt = shortTime(shift.openedAt);
  const cashierName = shift.openedBy?.fullName ?? '—';
  const cardTotal =
    breakdown.find((b) => b.method === 'CARD')?.total ?? 0;
  const accountTotal =
    breakdown.find((b) => b.method === 'ACCOUNT')?.total ?? 0;

  return (
    <>
      {/* KPI row (design uses .card.kpi inside .grid.g4) */}
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <div className="k">Shift gross sales</div>
          <div className="v">{AED0(kpis.grossSales)}</div>
          <div className="d">{kpis.orders} orders since {openedAt}</div>
        </div>
        <div className="card kpi">
          <div className="k">Cash collected</div>
          <div className="v">{AED0(kpis.cashCollected)}</div>
          <div className="d">Card {AED0(cardTotal)} · Account {AED0(accountTotal)}</div>
        </div>
        <div className="card kpi">
          <div className="k">Expected in drawer</div>
          <div className="v">{AED0(kpis.expectedDrawer)}</div>
          <div className="d">Float {AED0(totals.openingFloat)} + cash + movements</div>
        </div>
        <div className="card kpi">
          <div className="k">Refunds</div>
          <div className="v">{AED0(kpis.refunds)}</div>
          <div className="d">This shift</div>
        </div>
      </div>

      {/* Cash movements (.card.flush) */}
      <div className="card flush" style={{ marginBottom: 16 }}>
        <div className="ch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Cash movements</h3>
          <button className="btn btn-pri btn-sm" id="cm-add" onClick={onAddMovement}>+ Add movement</button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Reason</th>
              <th>By</th>
              <th className="num">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18 }}>No movements yet</td></tr>
            )}
            {movements.map((m, i) => {
              const positive = m.type === 'PAID_IN';
              const amt = Number(m.amount);
              return (
                <tr key={m.id}>
                  <td className="tnum">{shortTime(m.createdAt)}</td>
                  <td><span className={`pill ${positive ? 'ok' : 'mut'}`}>{TYPE_LABEL[m.type]}</span></td>
                  <td>{m.reason}</td>
                  <td className="muted">{m.by?.fullName ?? '—'}</td>
                  <td className={`num tnum ${positive ? 'pos' : 'neg'}`}>
                    {positive ? '+' : '−'} {AED(amt)}
                  </td>
                  <td className="num">
                    <button className="btn btn-ghost btn-sm" data-cmdel={i} onClick={() => onDeleteMovement(m.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Net cash movements</td>
              <td className="num tnum">{AED(totals.paidIn - totals.paidOut)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Z-report + Shift summary (g2 align-items start) */}
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <ZReportCard summary={summary} onClose={onCloseShift} />
        <ShiftSummaryCard summary={summary} breakdown={breakdown} cashierName={cashierName} openedAt={openedAt} />
      </div>
    </>
  );
}

function ZReportCard({ summary, onClose }: { summary: ShiftSummary; onClose: (counted: number) => void | Promise<void> }) {
  const { totals, kpis } = summary;
  const [counted, setCounted] = useState<string>('');

  const variance = useMemo(() => {
    if (!counted) return null;
    const v = Number(counted);
    if (!Number.isFinite(v)) return null;
    return v - kpis.expectedDrawer;
  }, [counted, kpis.expectedDrawer]);

  return (
    <div className="card">
      <h3>End-of-day Z-report</h3>
      <div className="csub">Close the day and reconcile the drawer</div>
      <div className="odl-sum" style={{ marginBottom: 14 }}>
        <div className="r"><span>Opening float</span><span>{AED(totals.openingFloat)}</span></div>
        <div className="r"><span>Cash sales</span><span>{AED(totals.cashSales)}</span></div>
        <div className="r"><span>Paid in</span><span>+ {AED(totals.paidIn)}</span></div>
        <div className="r"><span>Paid out / petty</span><span>− {AED(totals.paidOut)}</span></div>
        <div className="r tot"><span>Expected drawer</span><span>{AED(kpis.expectedDrawer)}</span></div>
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label>Counted cash in drawer</label>
        <input
          className="inp"
          id="z-counted"
          type="number"
          placeholder="0.00"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
        />
      </div>
      <div id="z-var" className="note" style={{ marginBottom: 12 }}>
        {variance == null ? null : variance === 0 ? (
          <b style={{ color: 'var(--ok)' }}>Balanced — no variance</b>
        ) : (
          <>Variance:{' '}
            <b style={{ color: variance < 0 ? 'var(--danger)' : 'var(--warn)' }}>
              {variance > 0 ? '+' : ''}{AED(variance)}
            </b>
          </>
        )}
      </div>
      <button
        className="btn btn-pri"
        id="z-close"
        onClick={() => {
          const v = Number(counted);
          if (!Number.isFinite(v)) return;
          onClose(v);
        }}
        disabled={!counted}
      >
        Generate Z-report &amp; close day
      </button>
    </div>
  );
}

function ShiftSummaryCard({
  summary,
  breakdown,
  cashierName,
  openedAt,
}: {
  summary: ShiftSummary;
  breakdown: PaymentBreakdownRow[];
  cashierName: string;
  openedAt: string;
}) {
  const toast = useToast();
  const cash = breakdown.find((b) => b.method === 'CASH')?.total ?? 0;
  const card =
    (breakdown.find((b) => b.method === 'CARD')?.total ?? 0) +
    (breakdown.find((b) => b.method === 'APPLE_PAY')?.total ?? 0);
  const account =
    (breakdown.find((b) => b.method === 'ACCOUNT')?.total ?? 0) +
    (breakdown.find((b) => b.method === 'ON_DELIVERY')?.total ?? 0);

  return (
    <div className="card">
      <h3>Shift summary</h3>
      <div className="csub">{cashierName} · since {openedAt}</div>
      <table className="tbl">
        <tbody>
          <tr><td>Cash</td><td className="num tnum">{AED(cash)}</td></tr>
          <tr><td>Card / Digital</td><td className="num tnum">{AED(card)}</td></tr>
          <tr><td>Account / Credit</td><td className="num tnum">{AED(account)}</td></tr>
          <tr><td>Refunds</td><td className="num tnum neg">− {AED(summary.kpis.refunds)}</td></tr>
        </tbody>
        <tfoot>
          <tr><td>Net takings</td><td className="num tnum">{AED(summary.kpis.netTakings)}</td></tr>
        </tfoot>
      </table>
      <button className="btn btn-ghost" id="shift-print" style={{ marginTop: 14 }} onClick={() => toast.show('Shift report sent to printer')}>
        Print shift report
      </button>
    </div>
  );
}

function HistoryCard({ rows }: { rows: ShiftHistoryRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="set-card" style={{ marginTop: 16 }}>
      <h3>History</h3>
      <table className="tbl">
        <thead>
          <tr>
            <th>Opened</th>
            <th>Closed</th>
            <th className="num">Float</th>
            <th className="num">Counted</th>
            <th className="num">Variance</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const variance = s.variance != null ? Number(s.variance) : null;
            return (
              <tr key={s.id}>
                <td>{new Date(s.openedAt).toLocaleString()}</td>
                <td>{s.closedAt ? new Date(s.closedAt).toLocaleString() : '—'}</td>
                <td className="num tnum">{AED(Number(s.openingFloat))}</td>
                <td className="num tnum">{s.countedDrawer != null ? AED(Number(s.countedDrawer)) : '—'}</td>
                <td className={`num tnum ${variance != null && variance < 0 ? 'neg' : ''}`}>
                  {variance != null ? AED(variance) : '—'}
                </td>
                <td>{s.openedBy?.fullName ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ModalShell({ title, onClose, children, foot }: { title: string; onClose: () => void; children: React.ReactNode; foot: React.ReactNode }) {
  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body fin">{children}</div>
        <div className="modal-foot">{foot}</div>
      </div>
    </div>
  );
}

function OpenShiftModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (float: number) => void | Promise<void> }) {
  const [amount, setAmount] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const v = Number(amount);
    if (!Number.isFinite(v) || v < 0) return;
    setBusy(true);
    try { await onSubmit(v); } finally { setBusy(false); }
  }

  return (
    <ModalShell
      title="Open shift"
      onClose={onClose}
      foot={<>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={submit} disabled={busy}>Open shift</button>
      </>}
    >
      <div className="field">
        <label>Opening float</label>
        <input className="inp" type="number" step="0.01" min="0" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </div>
    </ModalShell>
  );
}

/* Design openMoveModal (ops.js:77-93) — Add cash movement modal.
   Fields: Type select (Paid in/out/Petty cash) id='mv-type' / Reason
   id='mv-reason' / Amount (AED) id='mv-amt'. Save id='mv-save' 'Add movement'. */
function MoveCashModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (type: MovementType, reason: string, amount: number) => void | Promise<void>;
}) {
  const [type, setType] = useState<MovementType>('PAID_IN');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit() {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) { toast.show('Enter an amount'); return; }
    setBusy(true);
    try { await onSubmit(type, reason.trim() || '—', v); } finally { setBusy(false); }
  }

  return (
    <ModalShell
      title="Add cash movement"
      onClose={onClose}
      foot={<>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} id="mv-save" style={{ flex: 2 }} onClick={submit} disabled={busy}>Add movement</button>
      </>}
    >
      <div className="field" style={{ marginBottom: 12 }}>
        <label>Type</label>
        <select className="inp" id="mv-type" value={type} onChange={(e) => setType(e.target.value as MovementType)}>
          <option value="PAID_IN">Paid in</option>
          <option value="PAID_OUT">Paid out</option>
          <option value="PETTY_CASH">Petty cash</option>
        </select>
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label>Reason</label>
        <input className="inp" id="mv-reason" placeholder="e.g. Delivery fuel" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="field">
        <label>Amount (AED)</label>
        <input className="inp" id="mv-amt" type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
    </ModalShell>
  );
}

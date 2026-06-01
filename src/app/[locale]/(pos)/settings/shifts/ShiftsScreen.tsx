'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { AED, AED0, shortTime } from '@/lib/format';
import { useToast } from '@/components/Toast';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────

interface Props {
  initialSummary: ShiftSummary | null;
  initialHistory: ShiftHistoryRow[];
}

export default function ShiftsScreen({ initialSummary, initialHistory }: Props) {
  const t = useTranslations('Shifts');
  const toast = useToast();

  const [summary, setSummary] = useState<ShiftSummary | null>(initialSummary);
  const [history, setHistory] = useState<ShiftHistoryRow[]>(initialHistory);
  const [openModal, setOpenModal] = useState<null | 'open' | 'move' | 'close'>(null);

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
      toast.show(t('opened'));
      setOpenModal(null);
    } catch {
      toast.show(t('failed'));
    }
  }

  async function addMovement(type: MovementType, reason: string, amount: number) {
    try {
      await api('/shifts/current/movements', { method: 'POST', body: { type, reason, amount } });
      await refresh();
      toast.show(t('movedToast', { type: typeLabel(t, type), amount: AED(amount) }));
      setOpenModal(null);
    } catch {
      toast.show(t('failed'));
    }
  }

  async function deleteMovement(id: string) {
    try {
      await api(`/shifts/current/movements/${id}`, { method: 'DELETE' });
      await refresh();
    } catch {
      toast.show(t('failed'));
    }
  }

  async function closeShift(countedDrawer: number) {
    if (!summary) return;
    const variance = countedDrawer - summary.kpis.expectedDrawer;
    try {
      await api('/shifts/current/close', { method: 'POST', body: { countedDrawer } });
      await refresh();
      toast.show(t('closeToast', { amount: AED(variance) }));
      setOpenModal(null);
    } catch {
      toast.show(t('failed'));
    }
  }

  return (
    <div className="set-sec fin" style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2>{t('title')}</h2>
          <p className="ssub">{t('sub')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {summary ? (
            <>
              <button className="btn btn-ghost" onClick={() => setOpenModal('move')}>{t('moveCash')}</button>
              <button className="btn btn-pri" onClick={() => setOpenModal('close')}>{t('closeShift')}</button>
            </>
          ) : (
            <button className="btn btn-pri" onClick={() => setOpenModal('open')}>{t('openShift')}</button>
          )}
        </div>
      </div>

      {summary ? (
        <ActiveShift
          summary={summary}
          onDeleteMovement={deleteMovement}
          onAddMovement={() => setOpenModal('move')}
          onCloseShift={() => setOpenModal('close')}
        />
      ) : (
        <div className="set-card" style={{ marginTop: 16 }}>
          <p className="muted">{t('noShiftOpen')}</p>
        </div>
      )}

      <HistoryCard rows={history} />

      {openModal === 'open' && (
        <OpenShiftModal onClose={() => setOpenModal(null)} onSubmit={openShift} />
      )}
      {openModal === 'move' && summary && (
        <MoveCashModal onClose={() => setOpenModal(null)} onSubmit={addMovement} />
      )}
      {openModal === 'close' && summary && (
        <CloseShiftModal
          summary={summary}
          onClose={() => setOpenModal(null)}
          onSubmit={closeShift}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Active shift content (KPIs + movements + Z-report + summary)
// ─────────────────────────────────────────────────────────────────────────

function ActiveShift({
  summary,
  onDeleteMovement,
  onAddMovement,
  onCloseShift,
}: {
  summary: ShiftSummary;
  onDeleteMovement: (id: string) => void;
  onAddMovement: () => void;
  onCloseShift: () => void;
}) {
  const t = useTranslations('Shifts');
  const { kpis, movements, breakdown, totals, shift } = summary;
  const openedAt = shortTime(shift.openedAt);
  const cashierName = shift.openedBy?.fullName ?? '—';

  return (
    <>
      {/* KPI row */}
      <div className="grid g4" style={{ marginTop: 16, marginBottom: 16 }}>
        <Kpi label={t('kpiGrossSales')} value={AED0(kpis.grossSales)} sub={`${kpis.orders} · ${openedAt}`} />
        <Kpi label={t('kpiCashCollected')} value={AED0(kpis.cashCollected)} sub={cashierName} />
        <Kpi
          label={t('kpiExpectedDrawer')}
          value={AED0(kpis.expectedDrawer)}
          sub={`${t('openingFloat')} ${AED0(totals.openingFloat)}`}
        />
        <Kpi label={t('kpiRefunds')} value={AED0(kpis.refunds)} />
      </div>

      {/* Cash movements table */}
      <div className="set-card fin" style={{ marginBottom: 16 }}>
        <div className="ch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>{t('movements')}</h3>
          <button className="btn btn-pri btn-sm" onClick={onAddMovement}>+ {t('moveCash')}</button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('colTime')}</th>
              <th>{t('colType')}</th>
              <th>{t('colReason')}</th>
              <th>{t('colBy')}</th>
              <th className="num">{t('colAmount')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 18, color: 'var(--muted)' }}>—</td></tr>
            )}
            {movements.map((m) => {
              const positive = m.type === 'PAID_IN';
              const amt = Number(m.amount);
              return (
                <tr key={m.id}>
                  <td className="tnum">{shortTime(m.createdAt)}</td>
                  <td><TypeChip type={m.type} /></td>
                  <td>{m.reason}</td>
                  <td className="muted">{m.by?.fullName ?? '—'}</td>
                  <td className={`num tnum ${positive ? 'pos' : 'neg'}`}>
                    {positive ? '+ ' : '− '}{AED(amt)}
                  </td>
                  <td className="num">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onDeleteMovement(m.id)}
                      style={{ color: 'var(--danger)' }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {movements.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4}>—</td>
                <td className="num tnum">{AED(totals.paidIn - totals.paidOut)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Z-report card + Shift summary card */}
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <ZReportCard summary={summary} onClose={onCloseShift} />
        <ShiftSummaryCard summary={summary} breakdown={breakdown} />
      </div>
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card kpi">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {sub && <div className="d">{sub}</div>}
    </div>
  );
}

function TypeChip({ type }: { type: MovementType }) {
  const t = useTranslations('Shifts');
  const key = type === 'PAID_IN' ? 'IN' : type === 'PAID_OUT' ? 'OUT' : 'DROP';
  const cls = type === 'PAID_IN' ? 'ok' : 'mut';
  return <span className={`pill ${cls}`}>{t(`type.${key}`)}</span>;
}

function typeLabel(t: ReturnType<typeof useTranslations>, type: MovementType): string {
  const key = type === 'PAID_IN' ? 'IN' : type === 'PAID_OUT' ? 'OUT' : 'DROP';
  return t(`type.${key}`);
}

// ─────────────────────────────────────────────────────────────────────────
// Z-Report card (read-only display; closing happens via modal)
// ─────────────────────────────────────────────────────────────────────────

function ZReportCard({ summary, onClose }: { summary: ShiftSummary; onClose: () => void }) {
  const t = useTranslations('Shifts');
  const { totals, kpis } = summary;
  return (
    <div className="card">
      <h3>{t('zReport')}</h3>
      <div className="odl-sum" style={{ margin: '14px 0' }}>
        <div className="r"><span>{t('openingDrawer')}</span><span>{AED(totals.openingFloat)}</span></div>
        <div className="r"><span>{t('kpiCashCollected')}</span><span>{AED(totals.cashSales)}</span></div>
        <div className="r"><span>{t('type.IN')}</span><span>+ {AED(totals.paidIn)}</span></div>
        <div className="r"><span>{t('type.OUT')} / {t('type.DROP')}</span><span>− {AED(totals.paidOut)}</span></div>
        <div className="r tot"><span>{t('expected')}</span><span>{AED(kpis.expectedDrawer)}</span></div>
      </div>
      <button className="btn btn-pri" onClick={onClose}>{t('closeShift')}</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Shift summary card (payment-method breakdown)
// ─────────────────────────────────────────────────────────────────────────

function ShiftSummaryCard({
  summary,
  breakdown,
}: {
  summary: ShiftSummary;
  breakdown: PaymentBreakdownRow[];
}) {
  const t = useTranslations('Shifts');
  const cashier = summary.shift.openedBy?.fullName ?? '—';
  const openedAt = shortTime(summary.shift.openedAt);
  const methodLabels: Record<PaymentBreakdownRow['method'], string> = {
    CASH: 'Cash',
    CARD: 'Card',
    APPLE_PAY: 'Apple Pay',
    ACCOUNT: 'Account',
    ON_DELIVERY: 'On delivery',
    GIFT_CARD: 'Gift card',
  };

  return (
    <div className="card">
      <h3>{t('summary')}</h3>
      <div className="csub">{cashier} · {openedAt}</div>
      <table className="tbl" style={{ marginTop: 8 }}>
        <tbody>
          {breakdown.length === 0 && (
            <tr><td colSpan={2} className="muted" style={{ textAlign: 'center', padding: 14 }}>—</td></tr>
          )}
          {breakdown.map((row) => (
            <tr key={row.method}>
              <td>{methodLabels[row.method]} <span className="muted" style={{ fontSize: 11 }}>· {row.count}</span></td>
              <td className="num tnum">{AED(row.total)}</td>
            </tr>
          ))}
          {summary.kpis.refunds > 0 && (
            <tr>
              <td>{t('kpiRefunds')}</td>
              <td className="num tnum neg">− {AED(summary.kpis.refunds)}</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr><td>{t('summary')}</td><td className="num tnum">{AED(summary.kpis.netTakings)}</td></tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// History table
// ─────────────────────────────────────────────────────────────────────────

function HistoryCard({ rows }: { rows: ShiftHistoryRow[] }) {
  const t = useTranslations('Shifts');
  return (
    <div className="set-card" style={{ marginTop: 16 }}>
      <h3>History</h3>
      <table className="tbl">
        <thead>
          <tr>
            <th>{t('colTime')}</th>
            <th>{t('colTime')} ({t('closeShift')})</th>
            <th className="num">{t('openingFloat')}</th>
            <th className="num">{t('counted')}</th>
            <th className="num">{t('variance')}</th>
            <th>{t('colBy')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>—</td></tr>
          )}
          {rows.map((s) => {
            const variance = s.variance != null ? Number(s.variance) : null;
            return (
              <tr key={s.id}>
                <td>{new Date(s.openedAt).toLocaleString()}</td>
                <td>{s.closedAt ? new Date(s.closedAt).toLocaleString() : '—'}</td>
                <td className="num tnum">{AED(s.openingFloat)}</td>
                <td className="num tnum">{s.countedDrawer != null ? AED(s.countedDrawer) : '—'}</td>
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

// ─────────────────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────────────────

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
  const t = useTranslations('Shifts');
  const tCommon = useTranslations('Common');
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
      title={t('openShift')}
      onClose={onClose}
      foot={
        <>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{tCommon('cancel')}</button>
          <button
            className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
            style={{ flex: 2 }}
            onClick={submit}
            disabled={busy}
          >
            {t('openShift')}
          </button>
        </>
      }
    >
      <div className="field">
        <label>{t('openingFloat')}</label>
        <input
          className="inp input"
          type="number"
          step="0.01"
          min="0"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>
    </ModalShell>
  );
}

function MoveCashModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (type: MovementType, reason: string, amount: number) => void | Promise<void>;
}) {
  const t = useTranslations('Shifts');
  const tCommon = useTranslations('Common');
  const [type, setType] = useState<MovementType>('PAID_IN');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) return;
    setBusy(true);
    try { await onSubmit(type, reason.trim() || '—', v); } finally { setBusy(false); }
  }

  return (
    <ModalShell
      title={t('moveCash')}
      onClose={onClose}
      foot={
        <>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{tCommon('cancel')}</button>
          <button
            className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
            style={{ flex: 2 }}
            onClick={submit}
            disabled={busy || !Number(amount)}
          >
            {tCommon('save')}
          </button>
        </>
      }
    >
      <div className="field" style={{ marginBottom: 12 }}>
        <label>{t('moveType')}</label>
        <select
          className="inp input"
          value={type}
          onChange={(e) => setType(e.target.value as MovementType)}
        >
          <option value="PAID_IN">{t('type.IN')}</option>
          <option value="PAID_OUT">{t('type.OUT')}</option>
          <option value="PETTY_CASH">{t('type.DROP')}</option>
        </select>
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label>{t('colReason')}</label>
        <input
          className="inp input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('reasonHint')}
        />
      </div>
      <div className="field">
        <label>{t('colAmount')}</label>
        <input
          className="inp input"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>
    </ModalShell>
  );
}

function CloseShiftModal({
  summary,
  onClose,
  onSubmit,
}: {
  summary: ShiftSummary;
  onClose: () => void;
  onSubmit: (counted: number) => void | Promise<void>;
}) {
  const t = useTranslations('Shifts');
  const tCommon = useTranslations('Common');
  const expected = summary.kpis.expectedDrawer;
  const [counted, setCounted] = useState<string>(expected.toFixed(2));
  const [busy, setBusy] = useState(false);

  const variance = useMemo(() => {
    const v = Number(counted);
    return Number.isFinite(v) ? v - expected : 0;
  }, [counted, expected]);

  async function submit() {
    const v = Number(counted);
    if (!Number.isFinite(v)) return;
    setBusy(true);
    try { await onSubmit(v); } finally { setBusy(false); }
  }

  const varianceColor = variance === 0 ? 'var(--ok)' : variance < 0 ? 'var(--danger)' : 'var(--warn)';

  return (
    <ModalShell
      title={t('zReport')}
      onClose={onClose}
      foot={
        <>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{tCommon('cancel')}</button>
          <button
            className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
            style={{ flex: 2 }}
            onClick={submit}
            disabled={busy}
          >
            {t('closeShift')}
          </button>
        </>
      }
    >
      <div className="odl-sum" style={{ marginBottom: 14 }}>
        <div className="r"><span>{t('openingDrawer')}</span><span>{AED(summary.totals.openingFloat)}</span></div>
        <div className="r"><span>{t('kpiCashCollected')}</span><span>{AED(summary.totals.cashSales)}</span></div>
        <div className="r"><span>{t('type.IN')}</span><span>+ {AED(summary.totals.paidIn)}</span></div>
        <div className="r"><span>{t('type.OUT')} / {t('type.DROP')}</span><span>− {AED(summary.totals.paidOut)}</span></div>
        <div className="r tot"><span>{t('expected')}</span><span>{AED(expected)}</span></div>
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label>{t('counted')}</label>
        <input
          className="inp input"
          type="number"
          step="0.01"
          min="0"
          autoFocus
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          placeholder="0.00"
        />
      </div>
      <div className="note" style={{ color: varianceColor }}>
        <b>{t('variance')}: {variance >= 0 ? '+' : ''}{AED(variance)}</b>
      </div>
    </ModalShell>
  );
}

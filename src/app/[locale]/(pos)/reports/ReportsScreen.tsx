'use client';

import { useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AED } from '@/lib/format';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api-client';
import type { MetaResponse } from '@/lib/meta-context';
import type { ReportsOverview, ReportsHourly } from './page';

type Range = 'Today' | 'Yesterday' | 'Week' | 'Month' | 'Custom';

interface Props {
  overview: ReportsOverview;
  hourly: ReportsHourly;
  range: Range;
  from: string;
  to: string;
  meta: MetaResponse;
}

export default function ReportsScreen({ overview, hourly, range, from, to, meta }: Props) {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? 'en';
  const t = useTranslations('Reports');
  const tStatus = useTranslations('OrderStatus');
  const tMethod = useTranslations('PaymentMethod');
  const toast = useToast();

  const [showCashUp, setShowCashUp] = useState(false);
  const [customFrom, setCustomFrom] = useState<string>(from || '');
  const [customTo, setCustomTo] = useState<string>(to || '');

  const RANGES: { key: Range; label: string }[] = [
    { key: 'Today', label: t('ranges.Today') },
    { key: 'Yesterday', label: t('ranges.Yesterday') },
    { key: 'Week', label: t('ranges.Week') },
    { key: 'Month', label: t('ranges.Month') },
    { key: 'Custom', label: t('ranges.Custom') },
  ];

  // ──── Derived ────
  const total = overview.revenue ?? 0;
  const collected = overview.collected ?? 0;
  const outstanding = Math.max(0, total - collected);
  const ordersCount = overview.orders ?? 0;
  const refundsAmt = overview.refunds ?? 0;
  const refundCount = overview.refundCount ?? 0;
  const avg = ordersCount ? Math.round(total / ordersCount) : 0;

  const paymentMix = useMemo(
    () =>
      (overview.byMethod ?? []).map((m) => ({
        key: m.method,
        label: tMethod(m.method as any),
        value: Number(m._sum?.amount ?? 0),
        count: m._count,
      })),
    [overview.byMethod, tMethod],
  );
  const paymentTotal = paymentMix.reduce((s, m) => s + m.value, 0);
  const cashTotal = paymentMix.find((m) => m.key === 'CASH')?.value ?? 0;
  const cardTotal =
    (paymentMix.find((m) => m.key === 'CARD')?.value ?? 0) +
    (paymentMix.find((m) => m.key === 'APPLE_PAY')?.value ?? 0);
  const accountTotal =
    (paymentMix.find((m) => m.key === 'ACCOUNT')?.value ?? 0) +
    (paymentMix.find((m) => m.key === 'ON_DELIVERY')?.value ?? 0);

  const statusMix = (overview.byStatus ?? []).map((s) => ({
    key: s.status,
    label: tStatus(s.status as any),
    count: s._count,
  }));
  const statusMax = Math.max(1, ...statusMix.map((s) => s.count));
  const top = overview.topItems ?? [];

  // ──── Navigation: range change ────
  function pushRange(next: Range, nextFrom?: string, nextTo?: string) {
    const qs = new URLSearchParams();
    qs.set('range', next);
    if (next === 'Custom') {
      if (nextFrom) qs.set('from', nextFrom);
      if (nextTo) qs.set('to', nextTo);
    }
    router.push(`/${locale}/reports?${qs.toString()}`);
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    pushRange('Custom', customFrom, customTo);
  }

  // ──── Cash Up handler ────
  async function submitCashUp(counted: number) {
    try {
      await api('/shifts/current/close', { method: 'POST', body: { countedDrawer: counted } });
      toast.show(t('cashUp.closedToast'));
      setShowCashUp(false);
      router.refresh();
    } catch (err: any) {
      const msg =
        err?.status === 400 || err?.status === 404
          ? t('cashUp.noShift')
          : t('cashUp.failed');
      toast.show(msg);
    }
  }

  // ──── Subtitle ────
  const subtitle = (() => {
    const f = overview.range?.from ? new Date(overview.range.from) : null;
    const tt = overview.range?.to ? new Date(overview.range.to) : null;
    const fmt = (d: Date) => d.toLocaleDateString();
    if (f && tt) return `${fmt(f)} — ${fmt(tt)}`;
    return '';
  })();

  return (
    <div className="page">
      <div className="page-head">
        <div className="ph-l">
          <h2>{t('title')}</h2>
          <span className="sub">{subtitle}</span>
        </div>
        <div className="actions">
          <select
            className="input"
            style={{ width: 'auto' }}
            value={range}
            onChange={(e) => pushRange(e.target.value as Range)}
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          {range === 'Custom' && (
            <>
              <input
                type="date"
                className="input"
                style={{ width: 150 }}
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <input
                type="date"
                className="input"
                style={{ width: 150 }}
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
              <button
                className="btn btn-ghost"
                onClick={applyCustom}
                disabled={!customFrom || !customTo}
              >
                {t('customRange.apply')}
              </button>
            </>
          )}
          <button className="btn btn-ghost" onClick={() => toast.show(t('exported'))}>
            {t('exportCsv')}
          </button>
          <button className="btn btn-ghost" onClick={() => toast.show(t('printed'))}>
            <Icon.print size={14} /> {t('printZ')}
          </button>
          <button className="btn btn-pri" onClick={() => setShowCashUp(true)}>
            {t('cashUp.button')}
          </button>
        </div>
      </div>

      {/* ─────── Overview KPIs ─────── */}
      <div className="rep-sec">{t('sections.overview')}</div>
      <div className="stat-row">
        <div className="stat">
          <div className="sk">{t('kpis.gross')}</div>
          <div className="sv">
            <span className="cur">AED</span> {Math.round(total).toLocaleString()}
          </div>
          <div className="sd">{t('kpis.grossSub', { range })}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.orders')}</div>
          <div className="sv">{ordersCount}</div>
          <div className="sd">{t('kpis.ordersSub', { count: ordersCount })}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.avg')}</div>
          <div className="sv">
            <span className="cur">AED</span> {avg.toLocaleString()}
          </div>
          <div className="sd">{t('kpis.avgSub')}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.refunds')}</div>
          <div className="sv">
            <span className="cur">AED</span> {Math.round(refundsAmt).toLocaleString()}
          </div>
          <div className="sd">{t('kpis.refundsSub', { count: refundCount })}</div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="sk">{t('kpis.collected')}</div>
          <div className="sv">
            <span className="cur">AED</span> {Math.round(collected).toLocaleString()}
          </div>
          <div className="sd">{t('kpis.collectedSub')}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.outstanding')}</div>
          <div className="sv">
            <span className="cur">AED</span> {Math.round(outstanding).toLocaleString()}
          </div>
          <div className="sd">{t('kpis.outstandingSub')}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.cardShare')}</div>
          <div className="sv">
            {paymentTotal ? Math.round((cardTotal / paymentTotal) * 100) : 0}
            <span className="cur">%</span>
          </div>
          <div className="sd">{t('kpis.cardShareSub')}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.cashShare')}</div>
          <div className="sv">
            {paymentTotal ? Math.round((cashTotal / paymentTotal) * 100) : 0}
            <span className="cur">%</span>
          </div>
          <div className="sd">{t('kpis.cashShareSub')}</div>
        </div>
      </div>

      {/* ─────── Sales by Hour ─────── */}
      <div className="rep-sec">{t('sections.sales')}</div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <h3>{t('hourly.title')}</h3>
        <div className="psub">{t('hourly.sub')}</div>
        <HourlyChart hours={hourly.hours} />
      </div>

      {/* ─────── Payment Mix + Workflow ─────── */}
      <div className="cols-2b" style={{ marginBottom: 14 }}>
        <div className="panel">
          <h3>{t('paymentMix.title')}</h3>
          <div className="psub">{t('paymentMix.sub')}</div>
          {paymentMix.length === 0 ? (
            <div className="muted" style={{ fontSize: 12 }}>—</div>
          ) : (
            paymentMix.map((m) => (
              <BarLine
                key={m.key}
                label={m.label}
                amount={m.value}
                of={paymentTotal}
                color={
                  m.key === 'CASH'
                    ? '#16A34A'
                    : m.key === 'CARD' || m.key === 'APPLE_PAY'
                    ? '#2A4858'
                    : '#64748B'
                }
                rightLabel={AED(m.value)}
              />
            ))
          )}
        </div>
        <div className="panel">
          <h3>{t('statusMix.title')}</h3>
          <div className="psub">{t('statusMix.sub')}</div>
          {statusMix.length === 0 ? (
            <div className="muted" style={{ fontSize: 12 }}>—</div>
          ) : (
            statusMix.map((s) => {
              const color = meta.orderStatuses.find((os) => os.key === s.key)?.color ?? '#2A4858';
              return (
                <BarLine
                  key={s.key}
                  label={s.label}
                  amount={s.count}
                  of={statusMax}
                  color={color}
                  rightLabel={String(s.count)}
                />
              );
            })
          )}
        </div>
      </div>

      {/* ─────── Top Items ─────── */}
      <div className="rep-sec">{t('sections.products')}</div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <h3>{t('topItems.title')}</h3>
        <div className="psub">{t('topItems.sub')}</div>
        <table className="tbl" style={{ marginTop: 4 }}>
          <thead>
            <tr>
              <th>{t('topItems.item')}</th>
              <th className="num">{t('topItems.qty')}</th>
              <th className="num">{t('topItems.revenue')}</th>
            </tr>
          </thead>
          <tbody>
            {top.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                  {t('topItems.empty')}
                </td>
              </tr>
            )}
            {top.map((it, i) => (
              <tr key={i}>
                <td className="t-name">{it.name}</td>
                <td className="num">{it.qty ?? 0}</td>
                <td className="num t-amt">{AED(it.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─────── Financials ─────── */}
      <div className="rep-sec">{t('sections.financials')}</div>
      <div className="cols-2" style={{ marginBottom: 14 }}>
        <div className="panel">
          <h3>{t('financialSummary.title')}</h3>
          <div className="psub">{t('financialSummary.sub')}</div>
          <table className="tbl" style={{ marginTop: 4 }}>
            <tbody>
              <tr>
                <td>{t('financialSummary.gross')}</td>
                <td className="num t-amt">{AED(total)}</td>
              </tr>
              <tr>
                <td>{t('financialSummary.collected')}</td>
                <td className="num t-amt">{AED(collected)}</td>
              </tr>
              <tr>
                <td>{t('financialSummary.refunds')}</td>
                <td className="num t-amt" style={{ color: 'var(--danger)' }}>
                  −{AED(refundsAmt)}
                </td>
              </tr>
              <tr>
                <td>{t('financialSummary.outstanding')}</td>
                <td className="num t-amt" style={{ color: 'var(--warn)' }}>
                  {AED(outstanding)}
                </td>
              </tr>
              <tr>
                <td>
                  <b>{t('financialSummary.net')}</b>
                </td>
                <td className="num t-amt">
                  <b>{AED(collected - refundsAmt)}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>{t('profitMargin.title')}</h3>
          <div className="psub">{t('profitMargin.sub')}</div>
          <ProfitMargin total={total} />
        </div>
      </div>

      {/* ─────── Cash Drawer Reconciliation ─────── */}
      <div className="rep-sec">{t('sections.cashDrawer')}</div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <h3>{t('cashDrawer.title')}</h3>
        <div className="psub">{t('cashDrawer.sub')}</div>
        <table className="tbl" style={{ marginTop: 4 }}>
          <tbody>
            <tr>
              <td>{t('cashDrawer.cashSales')}</td>
              <td className="num t-amt">{AED(cashTotal)}</td>
            </tr>
            <tr>
              <td>{t('cashDrawer.cardDigital')}</td>
              <td className="num t-amt">{AED(cardTotal)}</td>
            </tr>
            <tr>
              <td>{t('cashDrawer.account')}</td>
              <td className="num t-amt">{AED(accountTotal)}</td>
            </tr>
            <tr>
              <td>
                <b>{t('cashDrawer.expected')}</b>
              </td>
              <td className="num t-amt">
                <b>{AED(cashTotal)}</b>
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
          {t('cashDrawer.hint')}
        </div>
      </div>

      {showCashUp && (
        <CashUpModal
          expected={cashTotal}
          onClose={() => setShowCashUp(false)}
          onSubmit={submitCashUp}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Hourly bar chart — 24 bars, one per hour. Mirrors design app.js:810–815.
// ─────────────────────────────────────────────────────────────────────────

function HourlyChart({ hours }: { hours: { hour: number; total: number }[] }) {
  const max = Math.max(1, ...hours.map((h) => h.total));
  const labelFor = (h: number) => {
    const ampm = h < 12 ? 'a' : 'p';
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}${ampm}`;
  };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 4,
        height: 170,
        paddingTop: 8,
      }}
    >
      {hours.map((h) => {
        const pct = Math.round((h.total / max) * 100);
        return (
          <div
            key={h.hour}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              height: '100%',
              justifyContent: 'flex-end',
            }}
          >
            <div
              title={`${labelFor(h.hour)} · AED ${Math.round(h.total)}`}
              style={{
                width: '100%',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent)',
                borderBottom: 'none',
                borderRadius: '5px 5px 0 0',
                height: `${pct}%`,
                minHeight: h.total > 0 ? 2 : 0,
              }}
            />
            <span style={{ fontSize: 9, color: 'var(--muted)' }}>{labelFor(h.hour)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Reusable bar line (label + value + bar)
// ─────────────────────────────────────────────────────────────────────────

function BarLine({
  label,
  amount,
  of,
  color,
  rightLabel,
}: {
  label: string;
  amount: number;
  of: number;
  color: string;
  rightLabel: string;
}) {
  const pct = of > 0 ? Math.round((amount / of) * 100) : 0;
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span>{label}</span>
        <b style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{rightLabel}</b>
      </div>
      <div
        style={{
          height: 8,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .3s' }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Profit & Margin panel (kept from previous implementation)
// ─────────────────────────────────────────────────────────────────────────

function ProfitMargin({ total }: { total: number }) {
  const cost = Math.round(total * 0.38);
  const profit = total - cost;
  const margin = total ? Math.round((profit / total) * 100) : 0;
  const t = useTranslations('Reports');

  return (
    <>
      <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--faint)',
              fontWeight: 600,
            }}
          >
            {t('profitMargin.profit')}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em' }}>
            {AED(profit)}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--faint)',
              fontWeight: 600,
            }}
          >
            {t('profitMargin.margin')}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ok)', letterSpacing: '-.02em' }}>
            {margin}%
          </div>
        </div>
      </div>
      <div
        style={{
          height: 8,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${margin}%`, height: '100%', background: 'var(--ok)' }} />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'var(--muted)',
          marginTop: 8,
        }}
      >
        <span>
          {t('profitMargin.cost')} {AED(cost)}
        </span>
        <span>
          {t('profitMargin.revenue')} {AED(total)}
        </span>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cash-Up modal — counts the drawer and closes the current shift.
// Calls POST /shifts/current/close (same endpoint as the Shifts screen).
// ─────────────────────────────────────────────────────────────────────────

function CashUpModal({
  expected,
  onClose,
  onSubmit,
}: {
  expected: number;
  onClose: () => void;
  onSubmit: (counted: number) => void | Promise<void>;
}) {
  const t = useTranslations('Reports');
  const tCommon = useTranslations('Common');
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
    try {
      await onSubmit(v);
    } finally {
      setBusy(false);
    }
  }

  const varianceColor = variance === 0 ? 'var(--ok)' : variance < 0 ? 'var(--danger)' : 'var(--warn)';

  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('cashUp.title')}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body fin">
          <div className="field" style={{ marginBottom: 12 }}>
            <label>{t('cashUp.expected')}</label>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{AED(expected)}</div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>{t('cashUp.counted')}</label>
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
          <div className="field">
            <label>{t('cashUp.variance')}</label>
            <div style={{ fontSize: 16, fontWeight: 600, color: varianceColor }}>
              {variance >= 0 ? '+' : ''}
              {AED(variance)}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
            {tCommon('cancel')}
          </button>
          <button
            className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
            style={{ flex: 2 }}
            onClick={submit}
            disabled={busy}
          >
            {t('cashUp.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

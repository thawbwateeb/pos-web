'use client';

import { useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AED } from '@/lib/format';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { useBootstrap } from '@/components/BootstrapContext';
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

/* Design app.js:780 — 12 hardcoded hour labels for the Sales by Hour chart.
   Real revenue is summed into these buckets from the API hourly response. */
const HOUR_LABELS: { key: string; hour: number }[] = [
  { key: '9a', hour: 9 },
  { key: '10a', hour: 10 },
  { key: '11a', hour: 11 },
  { key: '12p', hour: 12 },
  { key: '1p', hour: 13 },
  { key: '2p', hour: 14 },
  { key: '3p', hour: 15 },
  { key: '4p', hour: 16 },
  { key: '5p', hour: 17 },
  { key: '6p', hour: 18 },
  { key: '7p', hour: 19 },
  { key: '8p', hour: 20 },
];

export default function ReportsScreen({ overview, hourly, range, from, to, meta: _meta }: Props) {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? 'en';
  const t = useTranslations('Reports');
  const tCommon = useTranslations('Common');
  const toast = useToast();
  const bootstrap = useBootstrap();
  const activeStoreName =
    bootstrap.stores.find((s) => s.id === bootstrap.activeStoreId)?.name ?? '—';

  const [showCashUp, setShowCashUp] = useState(false);
  const [customFrom, setCustomFrom] = useState<string>(from || '');
  const [customTo, setCustomTo] = useState<string>(to || '');

  const RANGES: Range[] = ['Today', 'Yesterday', 'Week', 'Month', 'Custom'];

  // ──── Derived from overview ────
  const total = overview.revenue ?? 0;
  const collected = overview.collected ?? 0;
  const outstanding = Math.max(0, total - collected);
  const ordersCount = overview.orders ?? 0;
  const refundsAmt = overview.refunds ?? 0;
  const avg = ordersCount ? Math.round(total / ordersCount) : 0;

  /* Cash / card / account from byMethod (real API data, mapped to design's
     three buckets). */
  const byMethod = overview.byMethod ?? [];
  const sumOf = (k: string | string[]) => {
    const arr = Array.isArray(k) ? k : [k];
    return byMethod
      .filter((m) => arr.includes(m.method))
      .reduce((s, m) => s + Number(m._sum?.amount ?? 0), 0);
  };
  const cashTotal = sumOf('CASH');
  const cardTotal = sumOf(['CARD', 'APPLE_PAY']);
  const acctTotal = sumOf(['ACCOUNT', 'ON_DELIVERY']);

  /* Sales by hour — keep only the 12 hours the design renders. */
  const hoursMap = new Map<number, number>();
  (hourly.hours ?? []).forEach((h) => hoursMap.set(h.hour, h.total));
  const hourBars = HOUR_LABELS.map((h) => ({ label: h.key, value: hoursMap.get(h.hour) ?? 0 }));
  const hourMax = Math.max(1, ...hourBars.map((b) => b.value));

  /* Top items from real API */
  const top = (overview.topItems ?? []).slice(0, 6);

  // Every metric below now comes from /reports/overview aggregating real
  // DB rows. Fields that the system genuinely doesn't have a source for
  // (cost-of-goods, hence profit/margin) come back as null and the
  // corresponding UI cards are omitted rather than filled with a guess.
  const refundsLabelValue = refundsAmt;
  const discounts = overview.discounts ?? 0;
  const vatRate = overview.vatRate ?? 0;
  const vatColl = overview.vatCollected ?? 0;
  const cost = overview.cost;
  const profit = overview.profit;
  const margin = overview.margin;

  const walk = overview.byType?.walkIn ?? 0;
  const deliv = overview.byType?.pickupDelivery ?? 0;
  const items = overview.itemsCount ?? 0;
  const expressCount = overview.expressCount ?? 0;
  const unpaidCount = overview.unpaidCount ?? 0;
  const turnaround = overview.turnaroundHours;
  const newCust = overview.newCustomers ?? 0;
  const gcSold = overview.giftCardsSold ?? 0;
  const gcRedeemed = overview.giftCardsRedeemed ?? 0;
  const loyaltyIssued = overview.loyaltyIssued ?? 0;
  const loyaltyRedeemed = overview.loyaltyRedeemed ?? 0;
  const subsActive = overview.subscriptionsActive ?? 0;
  const mrr = overview.mrr ?? 0;
  const openingFloat = overview.openingFloat;

  // Stable colour cycle so the same tier/area always gets the same swatch.
  const PALETTE = ['#2A4858', '#16A34A', '#D97706', '#7C3AED', '#0891B2', '#DB2777'];
  const serviceMix = (overview.serviceMix ?? []).map((s, i) => ({
    label: s.label,
    value: s.value,
    color: PALETTE[i % PALETTE.length],
    display: `${s.value} ${t('orderType.ordersUnit')}`,
  }));
  const topAreas = (overview.topAreas ?? []).map((a, i) => ({
    label: a.label,
    value: a.value,
    color: PALETTE[i % PALETTE.length],
    display: String(a.value),
  }));

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

  // ──── Cash Up handler ────
  async function submitCashUp(counted: number) {
    try {
      const result = await api<{ countedDrawer?: number | string }>(
        '/shifts/current/close',
        { method: 'POST', body: { countedDrawer: counted } },
      );
      // Prisma Decimal serializes as string; coerce defensively.
      const closed = Number(result?.countedDrawer ?? counted);
      toast.show(t('cashUp.closedToast', { amount: AED(closed) }));
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

  /* Design app.js:791 — subtitle is `${range} · {store} branch`.
     Custom range maps to the literal "Custom range" string. */
  const subtitle = `${range === 'Custom' ? t('customRangeLabel') : t(`ranges.${range}`)} · ${t('branch', { store: activeStoreName })}`;

  return (
    <div className="page">
      {/* Design app.js:791-795 — page-head with h2 + sub + actions block:
          range select, optional date inputs (Custom only), Export CSV,
          Print Z-Report (icon+label), Cash Up. */}
      <div className="page-head">
        <div className="ph-l">
          <h2>{t('title')}</h2>
          <span className="sub">{subtitle}</span>
        </div>
        <div className="actions">
          <select
            className="input"
            id="rep-range"
            style={{ width: 'auto' }}
            value={range}
            onChange={(e) => pushRange(e.target.value as Range)}
          >
            {RANGES.map((r) => (
              <option key={r} value={r}>
                {t(`ranges.${r}`)}
              </option>
            ))}
          </select>
          {range === 'Custom' && (
            <>
              <input
                type="date"
                className="input"
                style={{ width: 150 }}
                value={customFrom || '2026-05-01'}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <input
                type="date"
                className="input"
                style={{ width: 150 }}
                value={customTo || '2026-05-30'}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </>
          )}
          <button className="btn btn-ghost" data-rexport onClick={() => toast.show(t('exported'))}>
            {t('exportCsv')}
          </button>
          <button className="btn btn-ghost" onClick={() => toast.show(t('printed'))}>
            <Icon.print size={16} /> {t('printZ')}
          </button>
          <button className="btn btn-pri" data-cashup onClick={() => setShowCashUp(true)}>
            {t('cashUp.button')}
          </button>
        </div>
      </div>

      {/* ─────── Overview (Row 1) ─────── */}
      <div className="rep-sec">{t('sections.overview')}</div>
      <div className="stat-row">
        <div className="stat">
          <div className="sk">{t('kpis.gross')}</div>
          <div className="sv">
            <span className="cur">AED</span> {Math.round(total).toLocaleString()}
          </div>
          {/* Design app.js:798 — only the trend percentage is in <b class="up">;
              the " vs avg Friday" tail is plain text. */}
          <div className="sd"><b className="up">{t('kpis.grossTrendPct')}</b> {t('kpis.grossTrendSub')}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.orders')}</div>
          <div className="sv">{ordersCount}</div>
          <div className="sd">{t('kpis.ordersSub', { walk, deliv })}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.items')}</div>
          <div className="sv">{items}</div>
          <div className="sd">{t('kpis.itemsSub', { avg: ordersCount ? Math.round(items / ordersCount) : 0 })}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.avg')}</div>
          <div className="sv">
            <span className="cur">AED</span> {avg.toLocaleString()}
          </div>
          <div className="sd">{t('kpis.avgSub', { count: ordersCount })}</div>
        </div>
      </div>

      {/* ─────── Overview (Row 2) ─────── */}
      <div className="stat-row">
        <div className="stat">
          <div className="sk">{t('kpis.express')}</div>
          <div className="sv">{expressCount}</div>
          <div className="sd">{t('kpis.expressSub')}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.outstanding')}</div>
          <div className="sv">
            <span className="cur">AED</span> {Math.round(outstanding).toLocaleString()}
          </div>
          <div className="sd">{t('kpis.outstandingSub', { count: unpaidCount })}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.newCustomers')}</div>
          <div className="sv">{newCust}</div>
          {/* Design app.js:806 — only the "▲ 3" trend is in <b class="up">;
              the " vs yesterday" tail is plain text. */}
          <div className="sd"><b className="up">{t('kpis.newCustomersTrendPct')}</b> {t('kpis.newCustomersTrendSub')}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.turnaround')}</div>
          <div className="sv">{turnaround != null ? <>{turnaround}<span className="cur">h</span></> : '—'}</div>
          <div className="sd">{t('kpis.turnaroundSub')}</div>
        </div>
      </div>

      {/* ─────── Sales by Hour ─────── */}
      <div className="rep-sec">{t('sections.sales')}</div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <h3>{t('hourly.title')}</h3>
        <div className="psub">{t('hourly.sub')}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 170, paddingTop: 8 }}>
          {hourBars.map((b) => (
            <div
              key={b.label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 7,
                height: '100%',
                justifyContent: 'flex-end',
              }}
            >
              <div
                title={`AED ${Math.round(b.value)}`}
                style={{
                  width: '100%',
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent)',
                  borderBottom: 'none',
                  borderRadius: '5px 5px 0 0',
                  height: `${Math.round((b.value / hourMax) * 100)}%`,
                }}
              />
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─────── Payment Mix + Service Mix (cols-2b) ─────── */}
      <div className="cols-2b" style={{ marginBottom: 14 }}>
        <div className="panel">
          <h3>{t('paymentMix.title')}</h3>
          <div className="psub">{t('paymentMix.sub')}</div>
          <BarLine label={t('paymentMix.cash')} value={cashTotal} max={Math.max(1, cashTotal, cardTotal, acctTotal)} color="#16A34A" display={AED(cashTotal)} />
          <BarLine label={t('paymentMix.cardDigital')} value={cardTotal} max={Math.max(1, cashTotal, cardTotal, acctTotal)} color="#2A4858" display={AED(cardTotal)} />
          <BarLine label={t('paymentMix.account')} value={acctTotal} max={Math.max(1, cashTotal, cardTotal, acctTotal)} color="#64748B" display={AED(acctTotal)} />
        </div>
        <div className="panel">
          <h3>{t('serviceMix.title')}</h3>
          <div className="psub">{t('serviceMix.sub')}</div>
          {(() => {
            const sm = Math.max(...serviceMix.map((s) => s.value), 1);
            return serviceMix.map((s) => (
              <BarLine key={s.label} label={s.label} value={s.value} max={sm} color={s.color} display={s.display} />
            ));
          })()}
        </div>
      </div>

      {/* ─────── Products & Channels (cols-2) ─────── */}
      <div className="rep-sec">{t('sections.products')}</div>
      <div className="cols-2" style={{ marginBottom: 14 }}>
        <div className="panel">
          <h3>{t('topItems.title')}</h3>
          <div className="psub">{t('topItems.sub')}</div>
          <table className="tbl" style={{ marginTop: 4 }}>
            <thead>
              <tr>
                <th>{t('topItems.item')}</th>
                <th>{t('topItems.qty')}</th>
                <th style={{ textAlign: 'right' }}>{t('topItems.revenue')}</th>
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
                  <td className="t-name" style={{ fontSize: 14 }}>{it.name}</td>
                  <td>{it.qty ?? 0}</td>
                  <td className="t-amt" style={{ textAlign: 'right' }}>{AED(it.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>{t('orderType.title')}</h3>
          <div className="psub">{t('orderType.sub')}</div>
          {(() => {
            const m = Math.max(1, walk, deliv);
            return (
              <>
                <BarLine label={t('orderType.walkIn')} value={walk} max={m} color="#2A4858" display={`${walk} ${t('orderType.ordersUnit')}`} />
                <BarLine label={t('orderType.delivery')} value={deliv} max={m} color="#16A34A" display={`${deliv} ${t('orderType.ordersUnit')}`} />
              </>
            );
          })()}
          <h3 style={{ marginTop: 18 }}>{t('topAreas.title')}</h3>
          <div className="psub">{t('topAreas.sub')}</div>
          {(() => {
            const m = Math.max(...topAreas.map((a) => a.value), 1);
            return topAreas.map((a) => (
              <BarLine key={a.label} label={a.label} value={a.value} max={m} color={a.color} display={a.display} />
            ));
          })()}
        </div>
      </div>

      {/* ─────── Financials (cols-2) ─────── */}
      <div className="rep-sec">{t('sections.financials')}</div>
      <div className="cols-2" style={{ marginBottom: 14 }}>
        <div className="panel">
          <h3>{t('financialSummary.title')}</h3>
          <div className="psub">{t('financialSummary.sub')}</div>
          <table className="tbl" style={{ marginTop: 4 }}>
            <tbody>
              <tr>
                <td>{t('financialSummary.gross')}</td>
                <td className="t-amt" style={{ textAlign: 'right' }}>{AED(total)}</td>
              </tr>
              <tr>
                <td>{t('financialSummary.discounts')}</td>
                <td className="t-amt" style={{ textAlign: 'right', color: 'var(--danger)' }}>−{AED(discounts)}</td>
              </tr>
              <tr>
                <td>{t('financialSummary.refunds')}</td>
                <td className="t-amt" style={{ textAlign: 'right', color: 'var(--danger)' }}>−{AED(refundsLabelValue)}</td>
              </tr>
              <tr>
                <td>{t('financialSummary.vat')}</td>
                <td className="t-amt" style={{ textAlign: 'right' }}>{AED(vatColl)}</td>
              </tr>
              <tr>
                <td><b>{t('financialSummary.net')}</b></td>
                <td className="t-amt" style={{ textAlign: 'right' }}><b>{AED(total - discounts - refundsLabelValue)}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
        {cost != null && profit != null && margin != null ? (
          <div className="panel">
            <h3>{t('profitMargin.title')}</h3>
            <div className="psub">{t('profitMargin.sub')}</div>
            <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600 }}>{t('profitMargin.profit')}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em' }}>{AED(profit)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600 }}>{t('profitMargin.margin')}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ok)', letterSpacing: '-.02em' }}>{margin}%</div>
              </div>
            </div>
            <div style={{ height: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${margin}%`, height: '100%', background: 'var(--ok)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              <span>{t('profitMargin.cost')} {AED(cost)}</span>
              <span>{t('profitMargin.revenue')} {AED(total)}</span>
            </div>
          </div>
        ) : (
          // Cost-of-goods isn't tracked yet, so we deliberately omit the
          // panel rather than show a guessed margin. Add a CatalogueItem
          // cost field + ProductCost endpoint to bring this back.
          <div className="panel">
            <h3>{t('profitMargin.title')}</h3>
            <div className="psub" style={{ marginTop: 4 }}>{t('profitMargin.noCostData')}</div>
          </div>
        )}
      </div>

      {/* ─────── Programs & Cash (cols-2b) ─────── */}
      <div className="rep-sec">{t('sections.programs')}</div>
      <div className="cols-2b" style={{ marginBottom: 14 }}>
        <div className="panel">
          <h3>{t('programs.title')}</h3>
          <div className="psub">{t('programs.sub')}</div>
          <table className="tbl" style={{ marginTop: 4 }}>
            <tbody>
              <tr><td>{t('programs.gcSold')}</td><td className="t-amt" style={{ textAlign: 'right' }}>{AED(gcSold)}</td></tr>
              <tr><td>{t('programs.gcRedeemed')}</td><td className="t-amt" style={{ textAlign: 'right' }}>{AED(gcRedeemed)}</td></tr>
              <tr><td>{t('programs.loyaltyIssued')}</td><td className="t-amt" style={{ textAlign: 'right' }}>{loyaltyIssued.toLocaleString()}</td></tr>
              <tr><td>{t('programs.loyaltyRedeemed')}</td><td className="t-amt" style={{ textAlign: 'right' }}>{loyaltyRedeemed.toLocaleString()}</td></tr>
              <tr><td>{t('programs.subscribers')}</td><td className="t-amt" style={{ textAlign: 'right' }}>{subsActive}</td></tr>
              <tr><td><b>{t('programs.mrr')}</b></td><td className="t-amt" style={{ textAlign: 'right' }}><b>{AED(mrr)}</b></td></tr>
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>{t('cashDrawer.title')}</h3>
          <div className="psub">{t('cashDrawer.sub')}</div>
          <table className="tbl" style={{ marginTop: 4 }}>
            <tbody>
              <tr><td>{t('cashDrawer.openingFloat')}</td><td className="t-amt" style={{ textAlign: 'right' }}>{openingFloat != null ? AED(openingFloat) : '—'}</td></tr>
              <tr><td>{t('cashDrawer.cashSales')}</td><td className="t-amt" style={{ textAlign: 'right' }}>{AED(cashTotal)}</td></tr>
              <tr><td>{t('cashDrawer.cardDigital')}</td><td className="t-amt" style={{ textAlign: 'right' }}>{AED(cardTotal)}</td></tr>
              <tr><td>{t('cashDrawer.account')}</td><td className="t-amt" style={{ textAlign: 'right' }}>{AED(acctTotal)}</td></tr>
              <tr><td><b>{t('cashDrawer.expected')}</b></td><td className="t-amt" style={{ textAlign: 'right' }}>{openingFloat != null ? AED(openingFloat + cashTotal) : '—'}</td></tr>
            </tbody>
          </table>
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
// Reusable bar line (label + value + bar) — design app.js:779
// ─────────────────────────────────────────────────────────────────────────

function BarLine({
  label,
  value,
  max,
  color,
  display,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  display: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span>{label}</span>
        <b style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{display}</b>
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
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cash-Up modal — unchanged from prior implementation.
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

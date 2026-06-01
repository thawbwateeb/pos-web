'use client';

import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AED } from '@/lib/format';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import type { MetaResponse } from '@/lib/meta-context';

type Range = 'Today' | 'Yesterday' | 'Week' | 'Month';

export default function ReportsScreen({
  overview,
  range,
  meta,
}: {
  overview: any;
  range: string;
  meta: MetaResponse;
}) {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? 'en';
  const t = useTranslations('Reports');
  const tStatus = useTranslations('OrderStatus');
  const tMethod = useTranslations('PaymentMethod');
  const toast = useToast();

  const RANGES: { key: Range; label: string }[] = [
    { key: 'Today', label: t('ranges.Today') },
    { key: 'Yesterday', label: t('ranges.Yesterday') },
    { key: 'Week', label: t('ranges.Week') },
    { key: 'Month', label: t('ranges.Month') },
  ];

  const total = overview.revenue ?? 0;
  const collected = overview.collected ?? 0;
  const outstanding = Math.max(0, total - collected);
  const ordersCount = overview.orders ?? 0;
  const avg = ordersCount ? Math.round(total / ordersCount) : 0;

  const paymentMix = (overview.byMethod ?? []).map((m: any) => ({
    key: m.method as string,
    label: tMethod(m.method as any),
    value: Number(m._sum?.amount ?? 0),
    count: m._count,
  }));
  const paymentTotal = paymentMix.reduce((s: number, m: any) => s + m.value, 0);

  const statusMix = (overview.byStatus ?? []).map((s: any) => ({
    key: s.status as string,
    label: tStatus(s.status as any),
    count: s._count,
  }));
  const statusMax = Math.max(1, ...statusMix.map((s: any) => s.count));
  const top = overview.topItems ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <div className="ph-l">
          <h2>{t('title')}</h2>
          <span className="sub">
            {new Date(overview.range.from).toLocaleDateString()} — {new Date(overview.range.to).toLocaleDateString()}
          </span>
        </div>
        <div className="actions">
          <div className="seg">
            {RANGES.map((r) => (
              <button key={r.key} className={r.key === range ? 'on' : ''} onClick={() => router.push(`/${locale}/reports?range=${r.key}`)}>
                {r.label}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost" onClick={() => toast.show(t('exported'))}>{t('exportCsv')}</button>
          <button className="btn btn-ghost" onClick={() => toast.show(t('printed'))}>
            <Icon.print size={14} /> {t('printZ')}
          </button>
        </div>
      </div>

      <div className="rep-sec">{t('sections.overview')}</div>
      <div className="stat-row">
        <div className="stat">
          <div className="sk">{t('kpis.gross')}</div>
          <div className="sv"><span className="cur">AED</span> {Math.round(total).toLocaleString()}</div>
          <div className="sd">{t('kpis.grossSub', { range })}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.orders')}</div>
          <div className="sv">{ordersCount}</div>
          <div className="sd">{t('kpis.ordersSub', { count: ordersCount })}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.collected')}</div>
          <div className="sv"><span className="cur">AED</span> {Math.round(collected).toLocaleString()}</div>
          <div className="sd">{t('kpis.collectedSub')}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.avg')}</div>
          <div className="sv"><span className="cur">AED</span> {avg.toLocaleString()}</div>
          <div className="sd">{t('kpis.avgSub')}</div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="sk">{t('kpis.outstanding')}</div>
          <div className="sv"><span className="cur">AED</span> {Math.round(outstanding).toLocaleString()}</div>
          <div className="sd">{t('kpis.outstandingSub')}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.cardShare')}</div>
          <div className="sv">
            {paymentTotal
              ? Math.round(
                  ((paymentMix.find((m: any) => m.key === 'CARD')?.value ?? 0) +
                    (paymentMix.find((m: any) => m.key === 'APPLE_PAY')?.value ?? 0)) /
                    paymentTotal * 100,
                )
              : 0}
            <span className="cur">%</span>
          </div>
          <div className="sd">{t('kpis.cardShareSub')}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.cashShare')}</div>
          <div className="sv">
            {paymentTotal
              ? Math.round((paymentMix.find((m: any) => m.key === 'CASH')?.value ?? 0) / paymentTotal * 100)
              : 0}
            <span className="cur">%</span>
          </div>
          <div className="sd">{t('kpis.cashShareSub')}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.refundRate')}</div>
          <div className="sv">0<span className="cur">%</span></div>
          <div className="sd">{t('kpis.refundRateSub')}</div>
        </div>
      </div>

      <div className="rep-sec">{t('sections.sales')}</div>
      <div className="cols-2b" style={{ marginBottom: 14 }}>
        <div className="panel">
          <h3>{t('paymentMix.title')}</h3>
          <div className="psub">{t('paymentMix.sub')}</div>
          {paymentMix.length === 0 ? (
            <div className="muted" style={{ fontSize: 12 }}>—</div>
          ) : (
            paymentMix.map((m: any) => (
              <BarLine
                key={m.key}
                label={m.label}
                amount={m.value}
                of={paymentTotal}
                color={m.key === 'CASH' ? '#16A34A' : m.key === 'CARD' || m.key === 'APPLE_PAY' ? '#2A4858' : '#64748B'}
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
            statusMix.map((s: any) => {
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
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>{t('topItems.empty')}</td></tr>
            )}
            {top.map((it: any, i: number) => (
              <tr key={i}>
                <td className="t-name">{it.name}</td>
                <td className="num">{it.qty}</td>
                <td className="num t-amt">{AED(it.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rep-sec">{t('sections.financials')}</div>
      <div className="cols-2" style={{ marginBottom: 14 }}>
        <div className="panel">
          <h3>{t('financialSummary.title')}</h3>
          <div className="psub">{t('financialSummary.sub')}</div>
          <table className="tbl" style={{ marginTop: 4 }}>
            <tbody>
              <tr><td>{t('financialSummary.gross')}</td><td className="num t-amt">{AED(total)}</td></tr>
              <tr><td>{t('financialSummary.collected')}</td><td className="num t-amt">{AED(collected)}</td></tr>
              <tr><td>{t('financialSummary.outstanding')}</td><td className="num t-amt" style={{ color: 'var(--warn)' }}>{AED(outstanding)}</td></tr>
              <tr><td><b>{t('financialSummary.net')}</b></td><td className="num t-amt"><b>{AED(collected)}</b></td></tr>
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>{t('profitMargin.title')}</h3>
          <div className="psub">{t('profitMargin.sub')}</div>
          <ProfitMargin total={total} />
        </div>
      </div>
    </div>
  );
}

function BarLine({ label, amount, of, color, rightLabel }: { label: string; amount: number; of: number; color: string; rightLabel: string }) {
  const pct = of > 0 ? Math.round((amount / of) * 100) : 0;
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span>{label}</span>
        <b style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{rightLabel}</b>
      </div>
      <div style={{ height: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .3s' }} />
      </div>
    </div>
  );
}

function ProfitMargin({ total }: { total: number }) {
  const cost = Math.round(total * 0.38);
  const profit = total - cost;
  const margin = total ? Math.round((profit / total) * 100) : 0;
  const t = useTranslations('Reports');

  return (
    <>
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
    </>
  );
}

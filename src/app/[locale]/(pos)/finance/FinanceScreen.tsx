'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AED, AED0 } from '@/lib/format';

type Tab = 'dashboard' | 'actuals' | 'unit' | 'vision' | 'owners';
type Scenario = 'worst' | 'average' | 'dream';

export default function FinanceScreen({ data }: { data: any }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [scenario, setScenario] = useState<Scenario>('average');
  const t = useTranslations('Finance');

  const months: string[] = data.months;
  const lines = Object.keys(data.plan);
  const planTotal = (m: number) => lines.reduce((s, l) => s + data.plan[l][m], 0);
  const yrPlan = months.reduce((s, _, m) => s + planTotal(m), 0);
  const sc = data.scenarios[scenario];
  const yrIncome = sc.income.reduce((a: number, b: number) => a + b, 0);
  const yrOrders = sc.orders.reduce((a: number, b: number) => a + b, 0);
  const yrCustomers = sc.customers.reduce((a: number, b: number) => a + b, 0);
  const profit = (m: number) => sc.income[m] - planTotal(m);
  const yrProfit = months.reduce((s, _, m) => s + profit(m), 0);

  // ─── Owners — capital allocation by owner ────────────────────────────
  const owners: string[] = data.owners;
  const investedBy = (o: string) =>
    data.contributions.filter((c: any) => c.owner === o).reduce((s: number, c: any) => s + c.amount, 0);
  const totalInvested = data.contributions.reduce((s: number, c: any) => s + c.amount, 0);
  const ownership = owners.map((o) => ({
    owner: o,
    invested: investedBy(o),
    pct: totalInvested ? (investedBy(o) / totalInvested) * 100 : 0,
  }));

  return (
    <div className="page fin">
      <div className="page-head">
        <div className="ph-l">
          <h2>{t('title')}</h2>
          <span className="sub">{t('subtitle', { company: data.settings.company, currency: data.settings.currency })}</span>
        </div>
        <div className="seg">
          {(['worst', 'average', 'dream'] as Scenario[]).map((s) => (
            <button key={s} className={s === scenario ? `on ${s}` : ''} onClick={() => setScenario(s)}>
              {t(`scenarios.${s}` as any)}
            </button>
          ))}
        </div>
      </div>

      <div className="mtabs" style={{ marginBottom: 14 }}>
        {(['dashboard', 'actuals', 'unit', 'vision', 'owners'] as Tab[]).map((tt) => (
          <button key={tt} className={tt === tab ? 'on' : ''} onClick={() => setTab(tt)}>
            {t(`tabs.${tt}` as any)}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <>
          <div className="grid g4" style={{ marginBottom: 16 }}>
            <div className="card kpi">
              <div className="k">{t('kpis.annualPlanCost')}</div>
              <div className="v">{AED0(yrPlan)}</div>
              <div className="d">{t('kpis.yearTotal')}</div>
            </div>
            <div className="card kpi">
              <div className="k">{t('kpis.annualIncome', { scenario: t(`scenarios.${scenario}` as any) })}</div>
              <div className="v">{AED0(yrIncome)}</div>
              <div className="d">{t('kpis.scenarioAssumption')}</div>
            </div>
            <div className="card kpi">
              <div className="k">{t('kpis.annualProfit', { scenario: t(`scenarios.${scenario}` as any) })}</div>
              <div className={`v ${yrProfit >= 0 ? 'pos' : 'neg'}`}>{AED0(yrProfit)}</div>
              <div className="d">{t('kpis.incomeMinusCost')}</div>
            </div>
            <div className="card kpi">
              <div className="k">{t('kpis.stripeFees')}</div>
              <div className="v">{(data.settings.stripePct * 100).toFixed(1)}% + {AED(data.settings.stripeFlat)}</div>
              <div className="d">{t('kpis.perTx')}</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3>{t('dashboard.incomeVsExpense')}</h3>
            <div className="csub">{t('dashboard.incomeVsExpenseSub', { scenario: t(`scenarios.${scenario}` as any) })}</div>
            <BarPairChart
              labels={months}
              a={{ name: t('dashboard.income'), color: '#2A4858', data: sc.income }}
              b={{ name: t('dashboard.expenses'), color: '#DC2626', data: months.map((_, m) => planTotal(m)) }}
            />
          </div>

          <div className="grid g2">
            <div className="card">
              <h3>{t('dashboard.ordersCustomers')}</h3>
              <div className="csub">{t('dashboard.ordersCustomersSub', { scenario: t(`scenarios.${scenario}` as any) })}</div>
              <BarPairChart
                labels={months}
                a={{ name: t('dashboard.orders'), color: '#2A4858', data: sc.orders }}
                b={{ name: t('dashboard.customers'), color: '#16A34A', data: sc.customers }}
              />
            </div>
            <div className="card">
              <h3>{t('dashboard.cumulativeProfit')}</h3>
              <div className="csub">{t('dashboard.cumulativeProfitSub')}</div>
              <LineChart
                labels={months}
                series={[
                  {
                    name: t('dashboard.cumulative'),
                    color: '#16A34A',
                    data: months.reduce<number[]>((acc, _, m) => {
                      acc.push((acc[m - 1] ?? 0) + profit(m));
                      return acc;
                    }, []),
                  },
                ]}
              />
            </div>
          </div>
        </>
      )}

      {tab === 'unit' && (
        <UnitEconomics scenario={scenario} months={months} sc={sc} planTotal={planTotal} stripe={data.settings} />
      )}

      {(tab === 'actuals' || tab === 'vision') && (
        <div className="card flush" style={{ overflow: 'hidden' }}>
          <div className="ch"><h3>{t('monthlyPlan')}</h3></div>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('line')}</th>
                  {months.map((m) => <th className="num" key={m}>{m}</th>)}
                  <th className="num">{t('total')}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line}>
                    <td className="ln">{line}</td>
                    {data.plan[line].map((v: number, i: number) => (
                      <td className="num tnum" key={i}>{v ? AED0(v) : '—'}</td>
                    ))}
                    <td className="num tnum"><b>{AED0(data.plan[line].reduce((a: number, b: number) => a + b, 0))}</b></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{t('planTotal')}</td>
                  {months.map((_, m) => <td key={m} className="num tnum">{AED0(planTotal(m))}</td>)}
                  <td className="num tnum">{AED0(yrPlan)}</td>
                </tr>
                {tab === 'actuals' && (
                  <>
                    <tr>
                      <td>{t('incomeRow', { scenario: t(`scenarios.${scenario}` as any) })}</td>
                      {sc.income.map((v: number, i: number) => <td key={i} className="num tnum">{v ? AED0(v) : '—'}</td>)}
                      <td className="num tnum">{AED0(yrIncome)}</td>
                    </tr>
                    <tr>
                      <td>{t('profit')}</td>
                      {months.map((_, m) => {
                        const p = profit(m);
                        return <td key={m} className={`num tnum ${p >= 0 ? 'pos' : 'neg'}`}>{AED0(p)}</td>;
                      })}
                      <td className={`num tnum ${yrProfit >= 0 ? 'pos' : 'neg'}`}>{AED0(yrProfit)}</td>
                    </tr>
                  </>
                )}
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {tab === 'owners' && (
        <>
          <div className="grid g3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div className="card kpi">
              <div className="k">{t('owners.totalRaised')}</div>
              <div className="v">{AED(totalInvested)}</div>
              <div className="d">{t('owners.acrossOwners', { count: owners.length })}</div>
            </div>
            <div className="card kpi">
              <div className="k">{t('owners.largestStake')}</div>
              <div className="v">{[...ownership].sort((a, b) => b.invested - a.invested)[0]?.owner ?? '—'}</div>
              <div className="d">{Math.round([...ownership].sort((a, b) => b.invested - a.invested)[0]?.pct ?? 0)}%</div>
            </div>
            <div className="card kpi">
              <div className="k">{t('owners.contributions')}</div>
              <div className="v">{data.contributions.length}</div>
              <div className="d">{t('owners.earliestLatest')}</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <h3>{t('owners.breakdown')}</h3>
            <div className="csub">{t('owners.breakdownSub')}</div>
            {ownership.sort((a, b) => b.invested - a.invested).map((o) => (
              <div key={o.owner} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span><b>{o.owner}</b> · {AED(o.invested)}</span>
                  <b>{Math.round(o.pct)}%</b>
                </div>
                <div style={{ height: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${o.pct}%`, height: '100%', background: 'var(--accent)' }} />
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>{t('owners.contributionsList')}</h3>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('owners.date')}</th>
                  <th>{t('owners.owner')}</th>
                  <th>{t('owners.note')}</th>
                  <th className="num">{t('owners.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {data.contributions.map((c: any, i: number) => (
                  <tr key={i}>
                    <td>{c.date}</td>
                    <td>{c.owner}</td>
                    <td>{c.note}</td>
                    <td className="num tnum">{AED(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>{t('owners.totalRaised')}</td>
                  <td className="num tnum"><b>{AED(totalInvested)}</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Charts ─────────────────────────────────────────────────────────────

function LineChart({ labels, series }: { labels: string[]; series: { name: string; color: string; data: number[] }[] }) {
  const W = 760, H = 230, pad = { l: 54, r: 12, t: 14, b: 26 };
  const all = series.flatMap((s) => s.data);
  const mn = Math.min(0, ...all);
  const mx = Math.max(...all, 1);
  const rng = mx - mn || 1;
  const x = (i: number) => pad.l + ((W - pad.l - pad.r) * i) / Math.max(1, labels.length - 1);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - mn) / rng);

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const v = mn + rng * p;
          return (
            <g key={i}>
              <line x1={pad.l} y1={y(v)} x2={W - pad.r} y2={y(v)} stroke="var(--border-2)" />
              <text x={pad.l - 8} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--faint)">
                {Math.round(v / 1000)}k
              </text>
            </g>
          );
        })}
        {labels.map((m, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--faint)">{m}</text>
        ))}
        {series.map((s, si) => {
          const d = s.data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
          return (
            <g key={si}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {s.data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.6" fill={s.color} />)}
            </g>
          );
        })}
      </svg>
      <div className="legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </div>
    </>
  );
}

function BarPairChart({ labels, a, b }: { labels: string[]; a: { name: string; color: string; data: number[] }; b: { name: string; color: string; data: number[] } }) {
  const W = 760, H = 230, pad = { l: 48, r: 12, t: 14, b: 26 };
  const mx = Math.max(...a.data, ...b.data, 1);
  const x = (i: number) => pad.l + ((W - pad.l - pad.r) * i) / labels.length;
  const bw = (W - pad.l - pad.r) / labels.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / mx);
  const h = (v: number) => (H - pad.t - pad.b) * (v / mx);

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        {[0, 0.5, 1].map((p, i) => (
          <g key={i}>
            <line x1={pad.l} y1={y(mx * p)} x2={W - pad.r} y2={y(mx * p)} stroke="var(--border-2)" />
            <text x={pad.l - 8} y={y(mx * p) + 3} textAnchor="end" fontSize="9" fill="var(--faint)">{Math.round((mx * p) / 1000)}k</text>
          </g>
        ))}
        {labels.map((m, i) => {
          const cx = x(i) + bw * 0.18;
          const w = bw * 0.28;
          return (
            <g key={i}>
              <rect x={cx} y={y(a.data[i])} width={w} height={h(a.data[i])} rx="2" fill={a.color} />
              <rect x={cx + w + 2} y={y(b.data[i])} width={w} height={h(b.data[i])} rx="2" fill={b.color} />
              <text x={x(i) + bw / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--faint)">{m}</text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i style={{ background: a.color }} /> {a.name}</span>
        <span><i style={{ background: b.color }} /> {b.name}</span>
      </div>
    </>
  );
}

function UnitEconomics({ scenario, months, sc, planTotal, stripe }: { scenario: Scenario; months: string[]; sc: any; planTotal: (m: number) => number; stripe: any }) {
  const t = useTranslations('Finance');
  // Aggregate over the year for the "average" baseline numbers.
  const yrIncome = sc.income.reduce((a: number, b: number) => a + b, 0);
  const yrOrders = sc.orders.reduce((a: number, b: number) => a + b, 0);
  const yrCustomers = sc.customers.reduce((a: number, b: number) => a + b, 0);
  const yrExpense = months.reduce((s, _, m) => s + planTotal(m), 0);
  const basket = yrOrders ? yrIncome / yrOrders : 0;
  const cac = yrCustomers ? yrExpense / yrCustomers : 0;
  // Assume gross-margin ~ contribution per order = basket × 0.55 (after variable costs).
  const grossPerOrder = basket * 0.55;
  const ordersPerCust = yrCustomers ? yrOrders / yrCustomers : 0;
  const ltv = grossPerOrder * ordersPerCust;
  const payback = grossPerOrder > 0 ? cac / grossPerOrder : 0;

  return (
    <>
      <div className="grid g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
        <div className="card kpi">
          <div className="k">{t('unit.basket')}</div>
          <div className="v">{AED0(basket)}</div>
          <div className="d">{t('unit.basketSub')}</div>
        </div>
        <div className="card kpi">
          <div className="k">{t('unit.grossPerOrder')}</div>
          <div className="v">{AED0(grossPerOrder)}</div>
          <div className="d">{t('unit.grossPerOrderSub')}</div>
        </div>
        <div className="card kpi">
          <div className="k">{t('unit.cac')}</div>
          <div className="v">{AED0(cac)}</div>
          <div className="d">{t('unit.cacSub')}</div>
        </div>
        <div className="card kpi">
          <div className="k">{t('unit.ltv')}</div>
          <div className="v">{AED0(ltv)}</div>
          <div className="d">{t('unit.ltvSub')}</div>
        </div>
        <div className="card kpi">
          <div className="k">{t('unit.ltvCac')}</div>
          <div className="v">{cac > 0 ? `${(ltv / cac).toFixed(1)}×` : '—'}</div>
          <div className="d">{t('unit.ltvCacSub')}</div>
        </div>
        <div className="card kpi">
          <div className="k">{t('unit.payback')}</div>
          <div className="v">{payback > 0 ? `${payback.toFixed(1)}` : '—'}<span className="cur"> orders</span></div>
          <div className="d">{t('unit.paybackSub')}</div>
        </div>
      </div>

      <div className="card">
        <h3>{t('unit.assumptions')}</h3>
        <table className="tbl" style={{ marginTop: 4 }}>
          <tbody>
            <tr><td>{t('unit.scenarioRow')}</td><td className="num"><b>{scenario}</b></td></tr>
            <tr><td>{t('unit.annualIncome')}</td><td className="num tnum">{AED0(yrIncome)}</td></tr>
            <tr><td>{t('unit.annualOrders')}</td><td className="num tnum">{yrOrders.toLocaleString()}</td></tr>
            <tr><td>{t('unit.annualCustomers')}</td><td className="num tnum">{yrCustomers.toLocaleString()}</td></tr>
            <tr><td>{t('unit.ordersPerCust')}</td><td className="num tnum">{ordersPerCust.toFixed(2)}</td></tr>
            <tr><td>{t('unit.stripeFee')}</td><td className="num tnum">{(stripe.stripePct * 100).toFixed(1)}% + {AED(stripe.stripeFlat)}</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

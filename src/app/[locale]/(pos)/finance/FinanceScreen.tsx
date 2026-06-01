'use client';

import { useState } from 'react';
import { AED, AED0 } from '@/lib/format';

const TABS = ['Dashboard', 'Monthly Actuals', 'Unit Economics', 'Vision / Plan', 'Owners & Capital'] as const;

export default function FinanceScreen({ data }: { data: any }) {
  const [tab, setTab] = useState<typeof TABS[number]>('Dashboard');
  const [scenario, setScenario] = useState<'worst' | 'average' | 'dream'>('average');

  const planTotal = (m: number) => Object.values<number[]>(data.plan).reduce((s, arr) => s + arr[m], 0);
  const yrPlan = data.months.map((_: string, m: number) => planTotal(m)).reduce((s: number, v: number) => s + v, 0);
  const sc = data.scenarios[scenario];
  const profit = (m: number) => sc.income[m] - planTotal(m);
  const yrProfit = data.months.map((_: string, m: number) => profit(m)).reduce((s: number, v: number) => s + v, 0);

  return (
    <div className="page fin">
      <div className="page-head">
        <div className="ph-l">
          <h2>Financial Vision</h2>
          <span className="sub">Static planning data — {data.settings.company}, {data.settings.currency}</span>
        </div>
        <div className="seg">
          {(['worst', 'average', 'dream'] as const).map((s) => (
            <button key={s} className={`${s === scenario ? `on ${s}` : ''}`} onClick={() => setScenario(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="mtabs" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Dashboard' && (
        <div className="grid g4" style={{ marginBottom: 16 }}>
          <div className="card kpi"><div className="k">Annual plan cost</div><div className="v">{AED0(yrPlan)}</div><div className="d">12 months total</div></div>
          <div className="card kpi"><div className="k">Annual income · {scenario}</div><div className="v">{AED0(sc.income.reduce((a: number, b: number) => a + b, 0))}</div><div className="d">scenario assumption</div></div>
          <div className="card kpi"><div className="k">Annual profit · {scenario}</div><div className={`v ${yrProfit >= 0 ? 'pos' : 'neg'}`}>{AED0(yrProfit)}</div><div className="d">income − cost</div></div>
          <div className="card kpi"><div className="k">Stripe fees</div><div className="v">{(data.settings.stripePct * 100).toFixed(1)}% + {AED(data.settings.stripeFlat)}</div><div className="d">per transaction</div></div>
        </div>
      )}

      {(tab === 'Dashboard' || tab === 'Monthly Actuals' || tab === 'Vision / Plan') && (
        <div className="card flush" style={{ overflow: 'hidden' }}>
          <div className="ch"><h3>Monthly plan</h3></div>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr><th>Line</th>{data.months.map((m: string) => <th className="num" key={m}>{m}</th>)}<th className="num">Total</th></tr>
              </thead>
              <tbody>
                {Object.entries<number[]>(data.plan).map(([line, arr]) => (
                  <tr key={line}>
                    <td className="ln">{line}</td>
                    {arr.map((v, i) => <td className="num tnum" key={i}>{v ? AED0(v) : '—'}</td>)}
                    <td className="num tnum"><b>{AED0(arr.reduce((a, b) => a + b, 0))}</b></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Plan total</td>
                  {data.months.map((_: string, m: number) => <td key={m} className="num tnum">{AED0(planTotal(m))}</td>)}
                  <td className="num tnum">{AED0(yrPlan)}</td>
                </tr>
                {tab !== 'Vision / Plan' && (
                  <>
                    <tr>
                      <td>Income · {scenario}</td>
                      {sc.income.map((v: number, i: number) => <td key={i} className="num tnum">{v ? AED0(v) : '—'}</td>)}
                      <td className="num tnum">{AED0(sc.income.reduce((a: number, b: number) => a + b, 0))}</td>
                    </tr>
                    <tr>
                      <td>Profit</td>
                      {data.months.map((_: string, m: number) => {
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

      {tab === 'Owners & Capital' && (
        <div className="card">
          <h3>Capital contributions</h3>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Owner</th><th>Note</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {data.contributions.map((c: any, i: number) => (
                <tr key={i}><td>{c.date}</td><td>{c.owner}</td><td>{c.note}</td><td className="num tnum">{AED(c.amount)}</td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={3}>Total raised</td><td className="num tnum"><b>{AED(data.contributions.reduce((s: number, c: any) => s + c.amount, 0))}</b></td></tr>
            </tfoot>
          </table>
        </div>
      )}

      {tab === 'Unit Economics' && (
        <div className="card"><div className="muted">Unit economics view — coming soon. Use the plan + scenario tabs above to project profitability.</div></div>
      )}
    </div>
  );
}

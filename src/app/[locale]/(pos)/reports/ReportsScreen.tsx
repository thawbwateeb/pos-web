'use client';

import { useRouter } from 'next/navigation';
import { AED } from '@/lib/format';

const RANGES = ['Today', 'Yesterday', 'Week', 'Month'] as const;

export default function ReportsScreen({ overview, range }: { overview: any; range: string }) {
  const router = useRouter();
  return (
    <div className="page">
      <div className="page-head">
        <div className="ph-l">
          <h2>Report</h2>
          <span className="sub">{new Date(overview.range.from).toLocaleDateString()} — {new Date(overview.range.to).toLocaleDateString()}</span>
        </div>
        <div className="seg">
          {RANGES.map((r) => (
            <button key={r} className={r === range ? 'on' : ''} onClick={() => router.push(`/reports?range=${r}`)}>{r}</button>
          ))}
        </div>
      </div>

      <div className="stat-row">
        <div className="stat"><div className="sk">Orders</div><div className="sv">{overview.orders}</div><div className="sd">{range.toLowerCase()}</div></div>
        <div className="stat"><div className="sk">Revenue</div><div className="sv">{AED(overview.revenue)}</div><div className="sd">all sources</div></div>
        <div className="stat"><div className="sk">Collected</div><div className="sv">{AED(overview.collected)}</div><div className="sd">received cash + card</div></div>
        <div className="stat"><div className="sk">Avg ticket</div><div className="sv">{AED(overview.orders ? overview.revenue / overview.orders : 0)}</div><div className="sd">per order</div></div>
      </div>

      <div className="cols-2">
        <div className="panel">
          <h3>By status</h3>
          <div className="psub">Workflow distribution</div>
          <table className="tbl">
            <tbody>
              {overview.byStatus.map((s: any) => (
                <tr key={s.status}><td>{s.status}</td><td className="num"><b>{s._count}</b></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>By payment method</h3>
          <div className="psub">Where money lands</div>
          <table className="tbl">
            <tbody>
              {overview.byMethod.map((m: any) => (
                <tr key={m.method}>
                  <td>{m.method}</td>
                  <td className="num">{m._count}</td>
                  <td className="num"><b>{AED(m._sum.amount ?? 0)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Top items</h3>
        <div className="psub">By volume, this range</div>
        <table className="tbl">
          <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Revenue</th></tr></thead>
          <tbody>
            {overview.topItems.map((t: any, i: number) => (
              <tr key={i}><td>{t.name}</td><td className="num">{t.qty}</td><td className="num">{AED(t.revenue)}</td></tr>
            ))}
            {overview.topItems.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>No orders in this range yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

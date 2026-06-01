import { apiServer } from '@/lib/api-server';
import type { Payment } from '@/lib/types';
import { AED, shortTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash', CARD: 'Card', APPLE_PAY: 'Apple Pay', ACCOUNT: 'On Account', ON_DELIVERY: 'On Delivery', GIFT_CARD: 'Gift Card',
};

export default async function PaymentsPage() {
  const payments = await apiServer<Payment[]>('/payments?take=100');
  const total = payments.reduce((s, p) => s + (p.status === 'SUCCEEDED' ? +p.amount : 0), 0);

  return (
    <div className="page">
      <div className="page-head">
        <div className="ph-l">
          <h2>Payments</h2>
          <span className="sub">{payments.length} transactions · {AED(total)} collected</span>
        </div>
      </div>
      <div className="stat-row">
        <Stat k="Today's takings" v={AED(total)} d={`${payments.length} transactions`} />
        <Stat k="Refunds" v={AED(payments.reduce((s, p) => s + +p.refundedAmount, 0))} d="across all payments" />
        <Stat k="Cards" v={String(payments.filter((p) => p.method === 'CARD' || p.method === 'APPLE_PAY').length)} d="card/contactless" />
        <Stat k="Cash" v={String(payments.filter((p) => p.method === 'CASH').length)} d="cash payments" />
      </div>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Order</th><th>Customer</th><th>Method</th><th>Status</th>
              <th>When</th><th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="t-id">#{p.order?.number}</td>
                <td>{p.order?.customer?.fullName ?? 'Walk-in'}</td>
                <td>{METHOD_LABEL[p.method] ?? p.method}</td>
                <td><span className={`pill ${p.status === 'SUCCEEDED' ? 'paid' : 'muted'}`}>{p.status.toLowerCase()}</span></td>
                <td>{shortTime(p.processedAt ?? p.createdAt)}</td>
                <td className="num t-amt">{AED(p.amount)}</td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>No payments yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ k, v, d }: { k: string; v: string; d: string }) {
  return <div className="stat"><div className="sk">{k}</div><div className="sv">{v}</div><div className="sd">{d}</div></div>;
}

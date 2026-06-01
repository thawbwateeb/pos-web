'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { Icon } from '@/components/Icons';
import { AED, shortTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import type { Order, Payment, PaymentMethod } from '@/lib/types';

type Filter = 'all' | 'paid' | 'unpaid';

export default function PaymentsScreen({
  initialPayments,
  initialOrders,
}: {
  initialPayments: Payment[];
  initialOrders: Order[];
}) {
  const [payments, setPayments] = useState(initialPayments);
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<Filter>('all');
  const [refundFor, setRefundFor] = useState<Payment | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const t = useTranslations('Payments');
  const tCommon = useTranslations('Common');
  const tMethod = useTranslations('PaymentMethod');
  const toast = useToast();

  // ─── KPIs: collected today, outstanding, card share, avg ticket ──────
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const collectedToday = payments
    .filter((p) => p.status === 'SUCCEEDED' && new Date(p.processedAt ?? p.createdAt).getTime() >= todayMs)
    .reduce((s, p) => s + Number(p.amount) - Number(p.refundedAmount), 0);
  const outstanding = orders.filter((o) => !o.paid).reduce((s, o) => s + Number(o.total), 0);
  const unpaidCount = orders.filter((o) => !o.paid).length;
  const cardPayments = payments.filter((p) => p.method === 'CARD' || p.method === 'APPLE_PAY').length;
  const cardPct = payments.length ? Math.round((cardPayments / payments.length) * 100) : 0;
  const completed = orders.filter((o) => o.status !== 'CANCELLED').length;
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const avgTicket = completed ? Math.round(totalRevenue / completed) : 0;
  const refundTotal = payments.reduce((s, p) => s + Number(p.refundedAmount), 0);

  // ─── Filtered rows: payments + unpaid orders interleaved by date ────
  const rows = useMemo(() => {
    type Row =
      | { kind: 'payment'; payment: Payment; when: Date }
      | { kind: 'order'; order: Order; when: Date };

    const out: Row[] = [];
    if (filter !== 'unpaid') {
      payments.forEach((p) => out.push({ kind: 'payment', payment: p, when: new Date(p.processedAt ?? p.createdAt) }));
    }
    if (filter !== 'paid') {
      orders.filter((o) => !o.paid).forEach((o) => out.push({ kind: 'order', order: o, when: new Date(o.createdAt) }));
    }
    return out.sort((a, b) => b.when.getTime() - a.when.getTime());
  }, [filter, payments, orders]);

  async function refresh() {
    const [p, o] = await Promise.all([
      api<Payment[]>('/payments?take=200'),
      api<Order[]>('/orders?take=200'),
    ]);
    setPayments(p);
    setOrders(o);
  }

  async function takePayment(orderId: string, method: PaymentMethod = 'CASH') {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    try {
      await api('/payments', { method: 'POST', body: { orderId, method, amount: Number(order.total) } });
      toast.show(t('paymentTaken', { number: order.number }));
      refresh();
    } catch (e: any) {
      toast.show(e?.detail?.message || tCommon('failed'));
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="ph-l">
          <h2>{t('title')}</h2>
          <span className="sub">{t('subtitle')}</span>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="sico"><Icon.cash size={34} /></div>
          <div className="sk">{t('kpis.collectedToday')}</div>
          <div className="sv"><span className="cur">AED</span> {Math.round(collectedToday)}</div>
          <div className="sd">{t('kpis.transactions', { count: payments.length })}</div>
        </div>
        <div className="stat">
          <div className="sico"><Icon.clock size={34} /></div>
          <div className="sk">{t('kpis.outstanding')}</div>
          <div className="sv"><span className="cur">AED</span> {Math.round(outstanding)}</div>
          <div className="sd">{t('kpis.unpaid', { count: unpaidCount })}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.cardDigital')}</div>
          <div className="sv">{cardPct}<span className="cur">%</span></div>
          <div className="sd">{t('kpis.cardDigitalSub')}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.avgOrder')}</div>
          <div className="sv"><span className="cur">AED</span> {avgTicket}</div>
          <div className="sd">{t('kpis.avgOrderSub', { count: completed })}</div>
        </div>
      </div>

      <div className="page-head" style={{ marginBottom: 14 }}>
        <div className="seg">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>{tCommon('all')}</button>
          <button className={filter === 'unpaid' ? 'on' : ''} onClick={() => setFilter('unpaid')}>{t('unpaid')}</button>
          <button className={filter === 'paid' ? 'on' : ''} onClick={() => setFilter('paid')}>{t('paid')}</button>
        </div>
        {refundTotal > 0 && (
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>
            {t('refunded', { amount: AED(refundTotal) })}
          </span>
        )}
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            {/* Design app.js:636 — six columns: Order / Customer / Items /
                Method / Amount / Status + an unlabeled action col. The
                "When" column was an addition; removed for pixel parity. */}
            <tr>
              <th>{t('table.order')}</th>
              <th>{t('table.customer')}</th>
              <th>{t('table.items')}</th>
              <th>{t('table.method')}</th>
              <th className="num">{t('table.amount')}</th>
              <th>{t('table.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (row.kind === 'payment') {
                const p = row.payment;
                const refunded = Number(p.refundedAmount) > 0;
                return (
                  <tr key={`p-${p.id}`}>
                    <td className="t-id">#{p.order?.number ?? '—'}</td>
                    <td className="t-name">{p.order?.customer?.fullName ?? t('walkIn')}</td>
                    <td className="muted">—</td>
                    <td>{tMethod(p.method as any)}</td>
                    <td className="num t-amt">{AED(p.amount)}{refunded && <div style={{ fontSize: 11, color: 'var(--warn)' }}>− {AED(p.refundedAmount)}</div>}</td>
                    <td>
                      <span className={`pill ${p.status === 'SUCCEEDED' && !refunded ? 'paid' : refunded ? 'muted' : 'unpaid'}`}>
                        <span className="d" style={{ background: 'currentColor' }} />
                        {refunded ? t('refundedShort') : p.status === 'SUCCEEDED' ? t('paid') : p.status.toLowerCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        {!refunded && p.status === 'SUCCEEDED' && (
                          <button className="t-btn ghost" onClick={() => setRefundFor(p)}>{t('refund')}</button>
                        )}
                        <button className="t-btn ghost" title={t('printReceipt')} onClick={() => toast.show(t('receiptPrinted', { number: p.order?.number ?? '' }))}>
                          <Icon.print size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }
              const o = row.order;
              return (
                <tr key={`o-${o.id}`}>
                  <td className="t-id">#{o.number}</td>
                  <td className="t-name">{o.customer?.fullName ?? t('walkIn')}</td>
                  <td>{o._count?.items ?? 0}</td>
                  <td><span className="muted">—</span></td>
                  <td className="num t-amt">{AED(o.total)}</td>
                  <td><span className="pill unpaid"><span className="d" style={{ background: 'currentColor' }} />{t('unpaid')}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button className="t-btn" onClick={() => takePayment(o.id)}>{t('takePayment')}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>{t('noResults')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {refundFor && (
        <RefundModal
          payment={refundFor}
          onClose={() => setRefundFor(null)}
          onDone={() => { setRefundFor(null); refresh(); }}
        />
      )}
    </div>
  );
}

function RefundModal({ payment, onClose, onDone }: { payment: Payment; onClose: () => void; onDone: () => void }) {
  const t = useTranslations('Payments');
  const tCommon = useTranslations('Common');
  const max = Number(payment.amount) - Number(payment.refundedAmount);
  const [amount, setAmount] = useState<string>(String(max));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit() {
    const n = Number(amount);
    if (!n || n <= 0 || n > max) return toast.show(t('invalidRefund'));
    setBusy(true);
    try {
      await api(`/payments/${payment.id}/refund`, { method: 'POST', body: { amount: n, reason } });
      toast.show(t('refundIssued', { amount: AED(n) }));
      onDone();
    } catch (e: any) {
      toast.show(e?.detail?.message || tCommon('failed'));
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('refundTitle', { number: payment.order?.number ?? '' })}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
            {t('refundOriginal', { amount: AED(payment.amount) })}
            {Number(payment.refundedAmount) > 0 && ` · ${t('alreadyRefunded', { amount: AED(payment.refundedAmount) })}`}
          </div>
          <div className="field">
            <label>{t('refundAmount')}</label>
            <input className="input" type="number" inputMode="decimal" step="0.01" max={max} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('refundReason')}</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('refundReasonPlaceholder')} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{tCommon('cancel')}</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={submit}>{t('issueRefund')}</button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { Icon } from '@/components/Icons';
import { AED } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { useActiveStoreId } from '@/components/BootstrapContext';
import { printReceipt } from '@/lib/print';
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

  // Re-sync from the server props on store switch / router.refresh —
  // without this, useState(initial) keeps the first snapshot and the
  // Payments screen never reflects the new active store.
  useEffect(() => { setPayments(initialPayments); }, [initialPayments]);
  useEffect(() => { setOrders(initialOrders); }, [initialOrders]);
  const t = useTranslations('Payments');
  const tCommon = useTranslations('Common');
  const tMethod = useTranslations('PaymentMethod');
  const toast = useToast();
  const storeId = useActiveStoreId();

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

  /* Design app.js:619 — filter orders by paid state; design renders only
     orders, not interleaved payment events. */
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filter === 'all') return true;
      if (filter === 'paid') return o.paid;
      return !o.paid;
    });
  }, [orders, filter]);

  async function refresh() {
    const [p, o] = await Promise.all([
      api<Payment[]>('/payments?take=200'),
      api<Order[]>('/orders?take=200'),
    ]);
    setPayments(p);
    setOrders(o);
  }

  async function printOrderReceipt(orderId: string, number: number) {
    try {
      // Fetch the full order so the receipt has item snapshots + totals.
      const order = await api<any>(`/orders/${orderId}`, { storeId });
      await printReceipt(order, storeId);
      toast.show(t('receiptPrinted', { number }));
    } catch (e: any) {
      toast.show(e?.detail?.message || tCommon('failed'));
    }
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
      {/* Design app.js:624 — single page-head with h2 + .sub, no actions. */}
      <div className="page-head">
        <div className="ph-l">
          <h2>{t('title')}</h2>
          <span className="sub">{t('subtitle')}</span>
        </div>
      </div>

      {/* Design app.js:625-630 — KPI row .stat-row with 4 .stat cards:
          - Collected Today (.sico cash@34) + AED total + .sd '<b class="up">▲ 12%</b> vs yesterday' literal
          - Outstanding (.sico clock@34) + AED outstanding + '${n} unpaid orders'
          - Card / Digital (no .sico) + N% + 'of today's volume'
          - Avg. Order (no .sico) + AED avg + 'across N orders' */}
      <div className="stat-row">
        <div className="stat">
          <div className="sico"><Icon.cash size={34} /></div>
          <div className="sk">{t('kpis.collectedToday')}</div>
          <div className="sv"><span className="cur">AED</span> {Math.round(collectedToday)}</div>
          <div className="sd">{t('kpis.collectedTodaySub')}</div>
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

      {/* Design app.js:631-633 — second page-head wraps a 3-button .seg
          with data-pf="all|unpaid|paid" matching design's text. */}
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div className="seg">
          <button className={filter === 'all' ? 'on' : ''} data-pf="all" onClick={() => setFilter('all')}>{tCommon('all')}</button>
          <button className={filter === 'unpaid' ? 'on' : ''} data-pf="unpaid" onClick={() => setFilter('unpaid')}>{t('unpaid')}</button>
          <button className={filter === 'paid' ? 'on' : ''} data-pf="paid" onClick={() => setFilter('paid')}>{t('paid')}</button>
        </div>
      </div>

      <div className="card">
        <table className="tbl">
          {/* Design app.js:636 — 6 columns: Order / Customer / Items /
              Method / Amount / Status + unlabeled action col. */}
          <thead>
            <tr>
              <th scope="col">{t('table.order')}</th>
              <th scope="col">{t('table.customer')}</th>
              <th scope="col">{t('table.items')}</th>
              <th scope="col">{t('table.method')}</th>
              <th scope="col">{t('table.amount')}</th>
              <th scope="col">{t('table.status')}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {/* Design app.js:638-647 — iterate ORDERS only. Method col shows
                method when paid, dash when unpaid. Action col uses
                justify-content:space-between with print + (Take Payment if
                unpaid OR empty span if paid). */}
            {filteredOrders.map((o) => {
              const lastPay = payments.find((p) => p.orderId === o.id);
              const methodLabel = o.paid && lastPay ? tMethod(lastPay.method as any) : null;
              return (
                <tr key={o.id}>
                  <td className="t-id">#{o.number}</td>
                  {/* Design app.js:641 — `${c?c.name:'Guest'}` (NOT 'Walk-in'). */}
                  <td className="t-name">{o.customer?.fullName ?? t('guest')}</td>
                  <td>{o._count?.items ?? 0}</td>
                  <td>{methodLabel ?? <span className="muted">—</span>}</td>
                  <td className="t-amt">{AED(o.total)}</td>
                  <td>
                    <span className={`pill ${o.paid ? 'paid' : 'unpaid'}`}>
                      <span className="d" style={{ background: 'currentColor' }} />
                      {o.paid ? t('paid') : t('unpaid')}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        className="t-btn ghost"
                        data-printr={o.id}
                        title={t('printReceipt')}
                        onClick={() => printOrderReceipt(o.id, o.number)}
                      >
                        <Icon.print size={14} />
                      </button>
                      {o.paid
                        ? <span />
                        : <button className="t-btn" data-take={o.id} onClick={() => takePayment(o.id)}>{t('takePayment')}</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredOrders.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>{t('noResults')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* RefundModal removed — design app.js:618-655 renderPay has no
   refund affordance on the Payments screen. Refunds are issued via
   the Order detail modal (Orders Board screen). */

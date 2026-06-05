'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { Icon } from '@/components/Icons';
import Modal from '@/components/Modal';
import { AED } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { useActiveStoreId } from '@/components/BootstrapContext';
import { printReceipt, printErrorKey } from '@/lib/print';
import type { Order, Payment, PaymentMethod } from '@/lib/types';

type Filter = 'all' | 'paid' | 'unpaid';

// Design openPayModal (app.js) tiles, in order: Cash / Card / Apple Pay /
// Account / Pay later. Each maps to a real PaymentMethod enum + an icon.
const PAY_TILES: { key: PaymentMethod; Icon: (p: { size?: number }) => any }[] = [
  { key: 'CASH', Icon: Icon.cash },
  { key: 'CARD', Icon: Icon.card },
  { key: 'APPLE_PAY', Icon: Icon.apple },
  { key: 'ACCOUNT', Icon: Icon.wallet },
  { key: 'ON_DELIVERY', Icon: Icon.clock },
];

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
  const [refreshing, setRefreshing] = useState(false);
  // Order being charged via the Take Payment modal + the currently-selected
  // method tile (null until the operator picks one — gates Confirm).
  const [payTarget, setPayTarget] = useState<Order | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null);
  const [paying, setPaying] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);

  // Re-sync from the server props on store switch / router.refresh —
  // without this, useState(initial) keeps the first snapshot and the
  // Payments screen never reflects the new active store.
  useEffect(() => { setPayments(initialPayments); }, [initialPayments]);
  useEffect(() => { setOrders(initialOrders); }, [initialOrders]);
  const t = useTranslations('Payments');
  const tCommon = useTranslations('Common');
  const tMethod = useTranslations('PaymentMethod');
  const tMethodSub = useTranslations('PaymentMethodSub');
  const tPrint = useTranslations('Print');
  const toast = useToast();
  const storeId = useActiveStoreId();

  // ─── KPIs: collected today, outstanding, card share, avg ticket ──────
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const yesterdayMs = todayMs - 86_400_000;
  const succeeded = payments.filter((p) => p.status === 'SUCCEEDED');
  const collectedToday = succeeded
    .filter((p) => new Date(p.processedAt ?? p.createdAt).getTime() >= todayMs)
    .reduce((s, p) => s + Number(p.amount) - Number(p.refundedAmount), 0);
  const collectedYesterday = succeeded
    .filter((p) => {
      const ms = new Date(p.processedAt ?? p.createdAt).getTime();
      return ms >= yesterdayMs && ms < todayMs;
    })
    .reduce((s, p) => s + Number(p.amount) - Number(p.refundedAmount), 0);
  // Real day-over-day delta — replaces the design's hardcoded "▲ 12%".
  const deltaPct = collectedYesterday > 0
    ? Math.round(((collectedToday - collectedYesterday) / collectedYesterday) * 100)
    : null;
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
    setRefreshing(true);
    try {
      const [p, o] = await Promise.all([
        api<Payment[]>('/payments?take=200'),
        api<Order[]>('/orders?take=200'),
      ]);
      setPayments(p);
      setOrders(o);
    } finally {
      setRefreshing(false);
    }
  }

  async function printOrderReceipt(orderId: string, number: number) {
    if (printingId) return; // guard against double-print on rapid clicks
    setPrintingId(orderId);
    try {
      // Fetch the full order so the receipt has item snapshots + totals.
      const order = await api<any>(`/orders/${orderId}`, { storeId });
      await printReceipt(order, storeId);
      toast.show(t('receiptPrinted', { number }));
    } catch (e: any) {
      toast.show(tPrint(printErrorKey(e)), 'error');
    } finally {
      setPrintingId(null);
    }
  }

  function openPay(order: Order) {
    setPayTarget(order);
    setPayMethod(null);
  }

  async function confirmPay() {
    if (!payTarget || !payMethod) return;
    setPaying(true);
    try {
      if (payMethod === 'ON_DELIVERY') {
        // "Pay later" — stamp the method without recording a payment.
        await api(`/orders/${payTarget.id}/pay-later`, { method: 'PATCH' });
        toast.show(t('payLaterRecorded', { number: payTarget.number }));
      } else {
        await api('/payments', {
          method: 'POST',
          body: { orderId: payTarget.id, method: payMethod, amount: Number(payTarget.total) },
        });
        toast.show(t('paymentTaken', { number: payTarget.number }));
      }
      setPayTarget(null);
      setPayMethod(null);
      refresh();
    } catch (e: any) {
      toast.show(e?.detail?.message || tCommon('failed'), 'error');
    } finally {
      setPaying(false);
    }
  }

  // Send the customer a WhatsApp payment-link deeplink. The order list rows
  // don't carry the phone, so fetch the full order first (real data, not a
  // toast-only stub).
  async function sendWaLink() {
    if (!payTarget) return;
    setWaBusy(true);
    try {
      const full = await api<any>(`/orders/${payTarget.id}`, { storeId });
      const phone: string | undefined = full?.customer?.phone;
      const name: string | undefined = full?.customer?.fullName;
      if (!phone) {
        toast.show(t('waNoCustomer'), 'error');
        return;
      }
      const text = encodeURIComponent(
        `${name ? name.split(' ')[0] + ', ' : ''}your order #${payTarget.number} is ready for payment: ${AED(payTarget.total)}.`,
      );
      window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${text}`, '_blank', 'noopener');
      toast.show(t('waLinkSent', { name: name ?? '' }));
      setPayTarget(null);
      setPayMethod(null);
    } catch (e: any) {
      toast.show(e?.detail?.message || tCommon('failed'), 'error');
    } finally {
      setWaBusy(false);
    }
  }

  return (
    <div className="page">
      {/* Design app.js:624 — page-head with h2 + .sub + .actions refresh. */}
      <div className="page-head">
        <div className="ph-l">
          <h2>{t('title')}</h2>
          <span className="sub">{t('subtitle')}</span>
        </div>
        <div className="actions">
          <button
            className={`btn btn-ghost btn-icon${refreshing ? ' btn-loading' : ''}`}
            title={t('refresh')}
            aria-label={t('refresh')}
            onClick={refresh}
          >
            <Icon.refresh size={16} />
          </button>
        </div>
      </div>

      {/* Design app.js:625-630 — KPI row .stat-row with 4 .stat cards. */}
      <div className="stat-row">
        <div className="stat">
          <div className="sico"><Icon.cash size={34} /></div>
          <div className="sk">{t('kpis.collectedToday')}</div>
          <div className="sv"><span className="cur">AED</span> {Math.round(collectedToday)}</div>
          <div className="sd">
            {deltaPct != null && (
              <b className={deltaPct >= 0 ? 'up' : 'dn'}>{deltaPct >= 0 ? '▲' : '▼'} {Math.abs(deltaPct)}%</b>
            )}{deltaPct != null ? ' ' : ''}{t('deltaVsYesterday')}
          </div>
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

      {/* Design app.js:631-633 — second page-head wraps a 3-button .seg. */}
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div className="seg">
          <button className={filter === 'all' ? 'on' : ''} data-pf="all" onClick={() => setFilter('all')}>{tCommon('all')}</button>
          <button className={filter === 'unpaid' ? 'on' : ''} data-pf="unpaid" onClick={() => setFilter('unpaid')}>{t('unpaid')}</button>
          <button className={filter === 'paid' ? 'on' : ''} data-pf="paid" onClick={() => setFilter('paid')}>{t('paid')}</button>
        </div>
      </div>

      <div className="card">
        <table className="tbl">
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
            {filteredOrders.map((o) => {
              const lastPay = payments.find((p) => p.orderId === o.id);
              const methodLabel = o.paid && lastPay ? tMethod(lastPay.method as any) : null;
              return (
                <tr key={o.id}>
                  <td className="t-id">#{o.number}</td>
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
                        className={`t-btn ghost${printingId === o.id ? ' btn-loading' : ''}`}
                        data-printr={o.id}
                        title={t('printReceipt')}
                        aria-label={t('printReceipt')}
                        disabled={printingId === o.id}
                        onClick={() => printOrderReceipt(o.id, o.number)}
                      >
                        <Icon.print size={14} />
                      </button>
                      {o.paid
                        ? <span />
                        : <button className="t-btn" data-take={o.id} onClick={() => openPay(o)}>{t('takePayment')}</button>}
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

      {/* Take Payment modal — design app.js openPayModal. */}
      {payTarget && (
        <Modal open onClose={() => setPayTarget(null)} title={t('takePayment')} className="wide">
          <div className="modal-body">
            <div className="pay-amount">
              <div className="pl">{t('amountDue', { number: payTarget.number })}</div>
              <div className="pv"><span className="cur">AED</span> {Number(payTarget.total).toFixed(2)}</div>
            </div>
            <div className="pay-methods">
              {PAY_TILES.map(({ key, Icon: TileIcon }) => (
                <button
                  key={key}
                  className={`pay-m${payMethod === key ? ' sel' : ''}`}
                  aria-pressed={payMethod === key}
                  onClick={() => setPayMethod(key)}
                >
                  <TileIcon size={24} />
                  <div><b>{tMethod(key as any)}</b><span>{tMethodSub(key as any)}</span></div>
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`btn${waBusy ? ' btn-loading' : ''}`}
              onClick={sendWaLink}
              style={{ width: '100%', justifyContent: 'center', gap: 10, background: '#25D366', color: '#fff', padding: 14, marginTop: 4 }}
            >
              <Icon.whatsapp size={20} />
              {t('sendWaLink')}
            </button>
            <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>{t('waHint')}</div>
          </div>
          <div className="modal-foot">
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPayTarget(null)}>{tCommon('cancel')}</button>
            <button
              className={`btn btn-pri${paying ? ' btn-loading' : ''}`}
              style={{ flex: 2 }}
              disabled={!payMethod || paying}
              onClick={confirmPay}
            >
              {t('confirmPayment')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* RefundModal removed — design app.js:618-655 renderPay has no
   refund affordance on the Payments screen. Refunds are issued via
   the Order detail modal (Orders Board screen). */

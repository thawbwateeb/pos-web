'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api, eventStream } from '@/lib/api-client';
import { AED, dueLabel } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { Icon } from '@/components/Icons';
import FocusTrap from '@/components/FocusTrap';
import type { MetaResponse } from '@/lib/meta-context';
import type { OrdersBoard, OrderStatus, OrderType, Order, PaymentMethod } from '@/lib/types';

type Filter = 'all' | OrderType;

export default function OrdersBoardScreen({
  initial,
  meta,
}: {
  initial: OrdersBoard;
  meta: MetaResponse;
}) {
  const [board, setBoard] = useState<OrdersBoard>(initial);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [tagId, setTagId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<OrderStatus | null>(null);
  const [reloading, setReloading] = useState(false);
  // Pending pay-now request awaiting a payment method choice. The picker
  // modal is rendered when this is non-null; its onPick PATCHes /payments.
  const [payNow, setPayNow] = useState<{ order: Order } | null>(null);
  // The ⋯ menu on order cards: opens a sheet with View detail / Take
  // payment / Refund / Cancel / Delete actions. Each action goes through
  // a real endpoint (no toast-only stubs).
  const [manageId, setManageId] = useState<string | null>(null);
  const router = useRouter();
  const boardParams = useParams<{ locale: string }>();
  const boardLocale = boardParams.locale ?? 'en';

  // Sync server-fetched `initial` into local state whenever the parent
  // server component re-runs (store switch via router.refresh, locale
  // change, etc.). Without this, `useState(initial)` keeps the very
  // first snapshot and the board never reflects the new store.
  useEffect(() => { setBoard(initial); }, [initial]);
  const t = useTranslations('OrdersBoard');
  const tStatus = useTranslations('OrderStatus');
  const tType = useTranslations('Order');
  const tCommon = useTranslations('Common');
  const toast = useToast();

  // CANCELLED has no column on the board.
  const COLUMNS = useMemo(
    () => meta.orderStatuses.filter((s) => s.key !== 'CANCELLED').sort((a, b) => a.sort - b.sort),
    [meta.orderStatuses],
  );

  async function refresh() {
    setReloading(true);
    try {
      const b = await api<OrdersBoard>('/orders/board');
      setBoard(b);
      // Also bust Next's RSC payload cache for this route, otherwise
      // navigating to another tab and back replays the stale server
      // snapshot — and the [initial]→setBoard sync effect would then
      // overwrite the just-applied change. router.refresh() forces the
      // next /orders visit to re-run the server component.
      router.refresh();
    } finally {
      setReloading(false);
    }
  }

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = eventStream();
      const onChange = () => { refresh().catch(() => {}); };
      es.addEventListener('order.created', onChange);
      es.addEventListener('order.status', onChange);
      es.addEventListener('order.updated', onChange);
      es.addEventListener('payment.recorded', onChange);
    } catch {}
    return () => es?.close();
  }, []);

  const allActive = Object.values(board).flat().filter((o) => o.status !== 'COMPLETED').length;

  function matchesFilter(o: Order) {
    if (filter === 'all') return true;
    return o.type === filter;
  }

  // Ranked positions per overall board (just for the position chip on cards).
  const rankOf = useMemo(() => {
    const all = Object.values(board).flat().filter(matchesFilter);
    const sorted = [...all].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const m: Record<string, number> = {};
    sorted.forEach((o, i) => (m[o.id] = i + 1));
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, filter]);

  function next(s: OrderStatus): OrderStatus | undefined {
    const i = COLUMNS.findIndex((c) => c.key === s);
    return i >= 0 && i < COLUMNS.length - 1 ? (COLUMNS[i + 1].key as OrderStatus) : undefined;
  }
  function prev(s: OrderStatus): OrderStatus | undefined {
    const i = COLUMNS.findIndex((c) => c.key === s);
    return i > 0 ? (COLUMNS[i - 1].key as OrderStatus) : undefined;
  }

  // Apply the move optimistically: shift the card to its new column
  // immediately, then PATCH the API. On failure, revert and toast. This
  // makes drag-and-drop and the advance/back buttons feel instant.
  async function doMove(o: Order, to: OrderStatus) {
    const snapshot = board;
    const fromCol = (board[o.status] ?? []).filter((x) => x.id !== o.id);
    const moved: Order = { ...o, status: to };
    const toCol = [...(board[to] ?? []), moved];
    setBoard({ ...board, [o.status]: fromCol, [to]: toCol });
    try {
      await api(`/orders/${o.id}/status`, { method: 'PATCH', body: { status: to } });
      toast.show(t('movedTo', { number: o.number, status: tStatus(to as any) }));
      refresh();
    } catch (e: any) {
      setBoard(snapshot);
      toast.show(e?.detail?.message || t('failedToUpdate'));
    }
  }

  // Move forward through the pipeline. Instead of blocking when an order
  // isn't ready, redirect the user to the screen that lets them satisfy
  // the precondition:
  //   - to TAGGING with 0 items → open the order editor to pick items
  //   - to CLEANING from RECEIVED/TAGGING → open the Tagging modal
  // Once the user finishes that flow the status transition will run.
  async function moveTo(o: Order, to: OrderStatus | undefined) {
    if (!to || to === o.status) return;

    const itemCount = o._count?.items ?? 0;
    if (to === 'TAGGING' && itemCount === 0) {
      toast.show(t('cantTagWithoutItems'));
      router.push(`/${boardLocale}/order?edit=${o.id}`);
      return;
    }
    if (to === 'CLEANING' && (o.status === 'RECEIVED' || o.status === 'TAGGING')) {
      toast.show(t('mustTagAllItems'));
      // If the order is still RECEIVED, advance it to TAGGING first so the
      // tagging modal can render against the correct status, then open
      // the modal. (TaggingModal is the only legitimate path into CLEANING.)
      if (o.status === 'RECEIVED') {
        await doMove(o, 'TAGGING');
      }
      setTagId(o.id);
      return;
    }

    await doMove(o, to);
  }

  // Open the picker so the staff confirms how the customer paid. The
  // actual POST happens in onPaymentMethodPicked when they choose.
  function togglePaid(o: Order) {
    if (o.paid) { toast.show(t('alreadyPaid')); return; }
    setPayNow({ order: o });
  }

  async function onPaymentMethodPicked(method: PaymentMethod) {
    if (!payNow) return;
    const o = payNow.order;
    setPayNow(null);
    try {
      await api('/payments', {
        method: 'POST',
        body: { orderId: o.id, method, amount: Number(o.total) },
      });
      toast.show(t('markedPaid', { number: o.number }));
      refresh();
    } catch (e: any) {
      toast.show(e?.detail?.message || t('failedToUpdate'));
    }
  }

  // ── Drag and drop ──────────────────────────────────────────────────
  // The design's board allows drag-to-advance (app.js:543-563). We mark
  // the card draggable, stash the order id + current status in
  // dataTransfer, highlight the hovered column, and call moveTo on drop.
  function onDragStart(e: React.DragEvent, o: Order) {
    e.dataTransfer.setData('application/x-order-id', o.id);
    e.dataTransfer.setData('application/x-order-status', o.status);
    e.dataTransfer.effectAllowed = 'move';
  }
  function onColDragOver(e: React.DragEvent, status: OrderStatus) {
    if (Array.from(e.dataTransfer.types).includes('application/x-order-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dropTarget !== status) setDropTarget(status);
    }
  }
  function onColDragLeave(status: OrderStatus) {
    if (dropTarget === status) setDropTarget(null);
  }
  async function onColDrop(e: React.DragEvent, status: OrderStatus) {
    e.preventDefault();
    setDropTarget(null);
    const id = e.dataTransfer.getData('application/x-order-id');
    const from = e.dataTransfer.getData('application/x-order-status') as OrderStatus;
    if (!id || from === status) return;
    const o = Object.values(board).flat().find((x) => x.id === id);
    if (!o) return;
    await moveTo(o, status);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="ph-l">
          <h2>{tStatus('boardTitle')}</h2>
          <span className="sub">
            {t('activeShortDrag', { count: allActive })}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => refresh()}
            disabled={reloading}
            title={tCommon('refresh')}
            aria-label={tCommon('refresh')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon.refresh size={16} />
            {reloading ? tCommon('loading') : tCommon('refresh')}
          </button>
          <div className="seg">
            <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
              {tCommon('all')}
            </button>
            <button className={filter === 'WALK_IN' ? 'on' : ''} onClick={() => setFilter('WALK_IN')}>
              {tType('walkIn')}
            </button>
            <button className={filter === 'PICKUP_DELIVERY' ? 'on' : ''} onClick={() => setFilter('PICKUP_DELIVERY')}>
              {tType('pickupDelivery')}
            </button>
          </div>
        </div>
      </div>

      <div className="board">
        {COLUMNS.map((col) => {
          const statusKey = col.key as OrderStatus;
          const orders = (board[statusKey] ?? [])
            .filter(matchesFilter)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          const isDropTarget = dropTarget === statusKey;
          return (
            // Design app.js:525 — <div class="col" data-col="${st.id}">
            <div
              className={`col${isDropTarget ? ' drop-target' : ''}`}
              key={col.key}
              data-col={col.key}
              onDragOver={(e) => onColDragOver(e, statusKey)}
              onDragLeave={() => onColDragLeave(statusKey)}
              onDrop={(e) => onColDrop(e, statusKey)}
            >
              <div className="col-head">
                <span className="dot" style={{ background: col.color }} />
                <span className="cl">{tStatus(col.key as any)}</span>
                <span className="cc">{orders.length}</span>
              </div>
              <div className="col-body">
                {orders.length === 0 ? (
                  /* Design app.js:527 — bare <div style="..."> with no .muted class. */
                  <div style={{ fontSize: 12, padding: 14, color: 'var(--muted)', textAlign: 'center' }}>
                    —
                  </div>
                ) : (
                  orders.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      position={rankOf[o.id] ?? 0}
                      onOpen={() => setOpenId(o.id)}
                      onOpenManage={() => setManageId(o.id)}
                      onOpenTagging={() => setTagId(o.id)}
                      onAdvance={() => moveTo(o, next(o.status))}
                      onRetreat={() => moveTo(o, prev(o.status))}
                      onTogglePaid={() => togglePaid(o)}
                      onDragStart={(e) => onDragStart(e, o)}
                      canAdvance={!!next(o.status)}
                      canRetreat={!!prev(o.status)}
                      nextLabel={next(o.status) ? tStatus(next(o.status) as any) : undefined}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openId && (
        <OrderDetailModal
          orderId={openId}
          meta={meta}
          onClose={() => setOpenId(null)}
          onChanged={() => refresh()}
        />
      )}
      {payNow && (
        <PaymentMethodPicker
          methods={meta.paymentMethods}
          total={Number(payNow.order.total)}
          orderNumber={payNow.order.number}
          onPick={onPaymentMethodPicked}
          onClose={() => setPayNow(null)}
        />
      )}
      {manageId && (() => {
        const o = Object.values(board).flat().find((x) => x.id === manageId);
        if (!o) return null;
        return (
          <OrderActionsMenu
            order={o}
            onClose={() => setManageId(null)}
            onViewDetail={() => { setManageId(null); setOpenId(o.id); }}
            onTakePayment={() => { setManageId(null); setPayNow({ order: o }); }}
            onCancel={async () => {
              if (!confirm(t('cancelOrderConfirm', { number: o.number }))) return;
              try {
                await api(`/orders/${o.id}/cancel`, { method: 'PATCH', body: {} });
                toast.show(t('cancelledToast', { number: o.number }));
                setManageId(null);
                refresh();
              } catch (e: any) {
                toast.show(e?.detail?.message || t('failedToUpdate'));
              }
            }}
            onRefundAll={async () => {
              try {
                // Load fresh order to know the payment row to refund.
                const full = await api<any>(`/orders/${o.id}`);
                const pay = full.payments?.find((p: any) => p.status !== 'REFUNDED');
                if (!pay) { toast.show(t('failedToUpdate')); return; }
                const remaining = Number(pay.amount) - Number(pay.refundedAmount);
                if (!confirm(t('refundAllConfirm', { amount: AED(remaining), number: o.number }))) return;
                await api(`/payments/${pay.id}/refund`, { method: 'POST', body: { amount: remaining, reason: 'Refund full order' } });
                toast.show(t('refunded', { amount: AED(remaining) }));
                setManageId(null);
                refresh();
              } catch (e: any) {
                toast.show(e?.detail?.message || t('failedToUpdate'));
              }
            }}
          />
        );
      })()}
      {tagId && (
        <TaggingModal
          orderId={tagId}
          onClose={() => setTagId(null)}
          onAdvance={async () => {
            const o = Object.values(board).flat().find((x) => x.id === tagId);
            // doMove() skips the "must tag all items" guard — completing
            // the modal IS the proof the order is tagged.
            if (o) {
              const to = next(o.status);
              if (to) await doMove(o, to);
            }
            setTagId(null);
          }}
          onOpenDetail={() => { const id = tagId; setTagId(null); setOpenId(id); }}
        />
      )}
    </div>
  );
}

function OrderCard({
  order: o,
  position,
  onOpen,
  onOpenManage,
  onOpenTagging,
  onAdvance,
  onRetreat,
  onTogglePaid,
  onDragStart,
  canAdvance,
  canRetreat,
  nextLabel,
}: {
  order: Order;
  position: number;
  onOpen: () => void;
  onOpenManage: () => void;
  onOpenTagging: () => void;
  onAdvance: () => void;
  onRetreat: () => void;
  onTogglePaid: () => void;
  onDragStart: (e: React.DragEvent) => void;
  canAdvance: boolean;
  canRetreat: boolean;
  nextLabel?: string;
}) {
  const t = useTranslations('OrdersBoard');
  const tType = useTranslations('Order');
  const tCommon = useTranslations('Common');

  const isExpress = o.expressOn;
  const itemCount = o._count?.items ?? 0;
  const due = dueLabel(o.dueAt, { today: t('today'), tomorrow: t('tomorrow'), yesterday: t('yesterday') });

  /* Design app.js:578-593 — every interactive element carries a data-*
     hook used by the JS event delegation. We keep the equivalents so
     the DOM mirrors the design. */
  return (
    <div
      className="ocard"
      draggable
      data-oid={o.id}
      onDragStart={onDragStart}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        /* Design app.js:548 — clicking a TAGGING card's background opens
           the Tagging modal; every other status opens the Order Detail. */
        if (o.status === 'TAGGING') onOpenTagging();
        else onOpen();
      }}
    >
      <div className="oc-top">
        <button className="oc-id" data-detail={o.id} onClick={onOpen}>
          <span className="oc-pos">{position}</span>#{o.number}
        </button>
        <span className={`oc-type${isExpress ? ' express' : ''}`}>
          {isExpress ? t('express') : (o.type === 'WALK_IN' ? tType('walkIn') : tType('pickupDelivery'))}
        </span>
        <button className="oc-manage" data-manage={o.id} onClick={(e) => { e.stopPropagation(); onOpenManage(); }}>⋯</button>
      </div>

      <div className="oc-cust">{o.customer?.fullName ?? t('guest')}</div>

      {/* Design app.js:581 — `${o.items+' items'}` literal (no plural rule). */}
      <div className="oc-meta">
        <span>{itemCount > 0 ? `${itemCount} ${tCommon('items').toLowerCase()}` : t('awaiting')}</span>
        <span>·</span>
        {/* dueLabel reads new Date() + uses system locale — SSR and client
            disagree on today/tomorrow + AM/PM. Wrap so React doesn't abort
            hydration; the client value wins. */}
        <span suppressHydrationWarning>{due}</span>
      </div>

      {(o.rackCode || o.status === 'TAGGING') && (
        <div className="oc-track">
          {o.rackCode && <span className="oc-rack">▦ {o.rackCode}</span>}
          {o.status === 'TAGGING' && (
            <span className="oc-scan pending">⛿ {t('tagging')}</span>
          )}
        </div>
      )}

      <div className="oc-foot">
        <span className="oc-total">{AED(o.total)}</span>
        <button
          className={`oc-pay ${o.paid ? 'paid' : 'unpaid'}`}
          data-pay={o.id}
          onClick={onTogglePaid}
        >
          {o.paid ? t('paid') : t('unpaid')}
        </button>
      </div>

      {o.status === 'RECEIVED' && (
        <button className="oc-edit" data-edit={o.id} onClick={onOpen}>
          {t('detailEdit')}
        </button>
      )}
      {o.status === 'TAGGING' && (
        <button className="oc-edit tag-cta" data-tagopen={o.id} onClick={onOpenTagging}>
          {t('openTagging')} →
        </button>
      )}

      {/* Design app.js:589-592 — full status label (e.g. "Move to Out
          for Delivery →"); the previous code truncated at first space. */}
      <div className="oc-move">
        {canRetreat && (
          <button className="back" data-bak={o.id} onClick={onRetreat}>←</button>
        )}
        {canAdvance ? (
          <button data-adv={o.id} onClick={onAdvance}>
            {t('moveTo', { status: nextLabel ?? '' })} →
          </button>
        ) : (
          <button data-adv={o.id} disabled style={{ opacity: 0.5 }}>{t('done')}</button>
        )}
      </div>
    </div>
  );
}

function OrderDetailModal({
  orderId,
  meta,
  onClose,
  onChanged,
}: {
  orderId: string;
  meta: MetaResponse;
  onClose: () => void;
  onChanged: () => void;
}) {
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? 'en';
  const [order, setOrder] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState<null | { kind: 'all' } | { kind: 'line'; line: any }>(null);
  const [showPayPicker, setShowPayPicker] = useState(false);
  const t = useTranslations('OrdersBoard');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('OrderStatus');
  const tMethod = useTranslations('PaymentMethod');
  const toast = useToast();

  useEffect(() => {
    api<any>(`/orders/${orderId}`).then(setOrder);
  }, [orderId]);

  async function reload() {
    const o = await api<any>(`/orders/${orderId}`);
    setOrder(o);
  }

  // Open the picker; the actual POST runs once the staff confirms how
  // the customer paid (cash / card / Apple Pay / gift card / account).
  function markPaid() {
    if (!order || order.paid) return;
    setShowPayPicker(true);
  }
  async function payWith(method: PaymentMethod) {
    if (!order) return;
    setShowPayPicker(false);
    setBusy(true);
    try {
      await api('/payments', {
        method: 'POST',
        body: { orderId: order.id, method, amount: Number(order.total) },
      });
      toast.show(t('markedPaid', { number: order.number }));
      onChanged();
      await reload();
    } catch (e: any) {
      toast.show(e?.detail?.message || t('failedToUpdate'));
    } finally {
      setBusy(false);
    }
  }

  async function refundAll() {
    if (!order) return;
    setBusy(true);
    try {
      const pay = order.payments?.find((p: any) => p.status !== 'REFUNDED');
      if (!pay) {
        toast.show(t('failedToUpdate'));
        return;
      }
      const remaining = Number(pay.amount) - Number(pay.refundedAmount);
      await api(`/payments/${pay.id}/refund`, {
        method: 'POST',
        body: { amount: remaining, reason: 'refund all' },
      });
      toast.show(t('refunded', { amount: AED(remaining) }));
      onChanged();
      await reload();
    } catch (e: any) {
      toast.show(e?.detail?.message || t('failedToUpdate'));
    } finally {
      setBusy(false);
      setConfirmRefund(null);
    }
  }

  async function refundLine(line: any) {
    if (!order) return;
    setBusy(true);
    try {
      const pay = order.payments?.find((p: any) => p.status !== 'REFUNDED');
      if (!pay) {
        toast.show(t('failedToUpdate'));
        return;
      }
      const amount = Number(line.lineTotal);
      const remaining = Number(pay.amount) - Number(pay.refundedAmount);
      const refundAmount = Math.min(amount, remaining);
      if (refundAmount <= 0) {
        toast.show(t('failedToUpdate'));
        return;
      }
      await api(`/payments/${pay.id}/refund`, {
        method: 'POST',
        body: { amount: refundAmount, reason: `Void line ${line.nameSnapshot}` },
      });
      toast.show(t('lineRefunded'));
      onChanged();
      await reload();
    } catch (e: any) {
      toast.show(e?.detail?.message || t('failedToUpdate'));
    } finally {
      setBusy(false);
      setConfirmRefund(null);
    }
  }

  async function reprint() {
    if (!order) return;
    try {
      await api('/print-jobs', {
        method: 'POST',
        body: {
          type: 'RECEIPT',
          orderId: order.id,
          targetHwKey: 'printer',
        },
      });
      toast.show(t('reprintToast'));
    } catch (e: any) {
      toast.show(e?.detail?.message || t('failedToUpdate'));
    }
  }

  if (!order) {
    return (
      <div className="modal-scrim show" onClick={onClose}>
        <FocusTrap active onEscape={onClose}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body muted">{tCommon('loading')}</div>
        </div>
        </FocusTrap>
      </div>
    );
  }

  const canEdit = order.status === 'RECEIVED' && !order.paid;
  const canPay = !order.paid && order.status !== 'CANCELLED';
  const canRefund = order.paid && order.status !== 'CANCELLED';

  return (
    <div className="modal-scrim show" onClick={onClose}>
      <FocusTrap active onEscape={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>#{order.number}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="odl-head">
            <div className="odl-cust">
              <div className="odl-av">
                {(order.customer?.fullName ?? 'G').split(' ').map((s: string) => s[0]).slice(0, 2).join('')}
              </div>
              <div>
                <b>{order.customer?.fullName ?? t('guest')}</b>
                <span>{order.customer?.phone ?? '—'}</span>
              </div>
            </div>
            {order.rackCode && (
              <div className="odl-rack">
                <span className="rack-btn">▦ {order.rackCode}</span>
              </div>
            )}
          </div>
          <div className="odl-meta">
            <span>{tStatus(order.status)}</span>
            <span>·</span>
            <span>{order.type === 'WALK_IN' ? 'Walk-in' : 'Pickup & Delivery'}</span>
            <span>·</span>
            <span suppressHydrationWarning>{new Date(order.createdAt).toLocaleString()}</span>
            {order.primaryMethod && (<><span>·</span><span>{tMethod(order.primaryMethod as any)}</span></>)}
          </div>

          <table className="odl-tbl">
            <thead>
              <tr>
                <th>{tCommon('item')}</th>
                <th>{tCommon('qty')}</th>
                <th className="num">{tCommon('price')}</th>
                <th className="num">{tCommon('total')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(order.items ?? []).map((l: any) => (
                <tr key={l.id}>
                  <td>
                    <b>{l.nameSnapshot}</b>
                    <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>
                      {l.tierSnapshot}
                    </span>
                  </td>
                  <td>{l.qty}</td>
                  <td className="num">{AED(l.unitPrice)}</td>
                  <td className="num">{AED(l.lineTotal)}</td>
                  <td className="num">
                    {canRefund && (
                      <button
                        className="odl-act"
                        title={t('voidLine')}
                        onClick={() => setConfirmRefund({ kind: 'line', line: l })}
                      >
                        {t('voidLine')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(order.items ?? []).length === 0 && (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 14 }}>—</td></tr>
              )}
            </tbody>
          </table>

          <div className="odl-sum">
            <div className="r"><span>{tCommon('subtotal')}</span><span>{AED(order.subtotal)}</span></div>
            {Number(order.expressAmount) > 0 && (
              <div className="r"><span>{t('expressFee')}</span><span>{AED(order.expressAmount)}</span></div>
            )}
            {Number(order.discountAmount) > 0 && (
              <div className="r"><span>{tCommon('discount')}{order.discountCode ? ` · ${order.discountCode}` : ''}</span><span>− {AED(order.discountAmount)}</span></div>
            )}
            {Number(order.taxAmount) > 0 && (
              <div className="r"><span>{tCommon('vat')} {order.taxRate}%</span><span>{AED(order.taxAmount)}</span></div>
            )}
            {Number(order.deliveryFee) > 0 && (
              <div className="r"><span>{t('deliveryFee')}</span><span>{AED(order.deliveryFee)}</span></div>
            )}
            <div className="r tot"><span>{tCommon('total')}</span><span>{AED(order.total)}</span></div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={reprint} title={t('reprint')}>
            <Icon.print size={16} /> {t('reprint')}
          </button>
          {canEdit && (
            <Link
              href={`/${locale}/order?edit=${order.id}`}
              className="btn btn-ghost"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
              onClick={onClose}
            >
              {t('editItems')}
            </Link>
          )}
          {canPay && (
            <button
              className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
              style={{ flex: 1 }}
              onClick={markPaid}
              disabled={busy}
            >
              {t('payNow')} {AED(order.total)}
            </button>
          )}
          {canRefund && (
            <button
              className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
              style={{ flex: 1 }}
              onClick={() => setConfirmRefund({ kind: 'all' })}
              disabled={busy}
            >
              {t('refundAll')}
            </button>
          )}
        </div>

        {confirmRefund && (
          <div className="modal-scrim show" onClick={() => setConfirmRefund(null)} style={{ zIndex: 220 }}>
            <FocusTrap active onEscape={() => setConfirmRefund(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h3>{confirmRefund.kind === 'all' ? t('refundAll') : t('voidLine')}</h3>
                <button className="x" onClick={() => setConfirmRefund(null)}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ padding: '8px 12px', fontSize: 14, color: 'var(--muted)' }}>
                  {confirmRefund.kind === 'all'
                    ? t('refundAllConfirm', { amount: AED(order.total), number: order.number })
                    : t('voidLineConfirm', { amount: AED(confirmRefund.line.lineTotal), name: confirmRefund.line.nameSnapshot })}
                </p>
              </div>
              <div className="modal-foot">
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmRefund(null)}>
                  {tCommon('cancel')}
                </button>
                <button
                  className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => confirmRefund.kind === 'all' ? refundAll() : refundLine(confirmRefund.line)}
                  disabled={busy}
                >
                  {confirmRefund.kind === 'all' ? t('refundAll') : t('voidLine')}
                </button>
              </div>
            </div>
            </FocusTrap>
          </div>
        )}
        {showPayPicker && order && (
          <PaymentMethodPicker
            methods={meta.paymentMethods}
            total={Number(order.total)}
            orderNumber={order.number}
            onPick={payWith}
            onClose={() => setShowPayPicker(false)}
          />
        )}
      </div>
      </FocusTrap>
    </div>
  );
}

/* Tagging modal — backed by the real GarmentTag API.
   Slots = one row per (orderItem × qty unit). Each slot is either:
   - tagged: GarmentTag row exists. Show "Linked · {tagCode}" + Unlink.
   - untagged: no row yet. Show "Print & attach" button. Scanning a code
     in the top scanbar binds it to the next untagged slot.
   We deliberately don't try to predict whether a garment is fresh or
   already has a tag — the staff knows, and they either click Print or
   scan. The server records what actually happened (PRINTED / SCANNED). */
interface Slot {
  orderItemId: string;
  qtyIndex: number;
  name: string;
}
interface ApiGarmentTag {
  id: string;
  orderId: string;
  orderItemId: string;
  qtyIndex: number;
  tagCode: string;
  source: 'PRINTED' | 'SCANNED';
}

function TaggingModal({
  orderId,
  onClose,
  onAdvance,
  onOpenDetail,
}: {
  orderId: string;
  onClose: () => void;
  onAdvance: () => void | Promise<void>;
  onOpenDetail: () => void;
}) {
  const [order, setOrder] = useState<any | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [tagsByKey, setTagsByKey] = useState<Record<string, ApiGarmentTag>>({});
  const [scan, setScan] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const t = useTranslations('OrdersBoard');
  const tCommon = useTranslations('Common');
  const toast = useToast();

  const slotKey = (s: { orderItemId: string; qtyIndex: number }) => `${s.orderItemId}__${s.qtyIndex}`;

  // Load order + existing tag rows in parallel. Slots come from order.items
  // (1 per qty unit); the tag map keys off (orderItemId, qtyIndex).
  useEffect(() => {
    let alive = true;
    Promise.all([
      api<any>(`/orders/${orderId}`),
      api<ApiGarmentTag[]>(`/orders/${orderId}/tags`),
    ]).then(([o, tagRows]) => {
      if (!alive) return;
      setOrder(o);
      const flat: Slot[] = [];
      // Sort items by id so the slot ordering matches the server's PRINTED
      // tag-code minting (which sorts the same way).
      const sortedItems = [...(o.items ?? [])].sort((a: any, b: any) => (a.id < b.id ? -1 : 1));
      for (const l of sortedItems) {
        const qty = Math.max(1, Number(l.qty) || 1);
        for (let i = 0; i < qty; i++) {
          flat.push({
            orderItemId: l.id,
            qtyIndex: i,
            name: l.nameSnapshot ?? l.name ?? 'Garment',
          });
        }
      }
      setSlots(flat);
      const map: Record<string, ApiGarmentTag> = {};
      for (const tg of tagRows) map[slotKey(tg)] = tg;
      setTagsByKey(map);
    }).catch(() => { if (alive) toast.show(t('failedToUpdate')); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const linkedCount = Object.keys(tagsByKey).length;
  const total = slots.length;
  const allDone = total > 0 && linkedCount === total;

  async function printAndAttach(slot: Slot) {
    const key = slotKey(slot);
    setBusyKey(key);
    try {
      const row = await api<ApiGarmentTag>(`/orders/${orderId}/tags`, {
        method: 'POST',
        body: { orderItemId: slot.orderItemId, qtyIndex: slot.qtyIndex, source: 'PRINTED' },
      });
      setTagsByKey((m) => ({ ...m, [key]: row }));
      // Real label-print job: a driver subscribed to (storeId, 'labels')
      // will pick this up and actually print. Without a driver attached
      // the row sits in QUEUED — UI label below reads "queued for print"
      // which is honest about that state.
      await api('/print-jobs', {
        method: 'POST',
        body: { type: 'LABEL', garmentTagId: row.id, targetHwKey: 'labels' },
      }).catch(() => {/* tag was created — print failure is non-fatal */});
      toast.show(t('tagPrinted'));
    } catch (e: any) {
      toast.show(e?.detail?.message || t('failedToUpdate'));
    } finally {
      setBusyKey(null);
    }
  }

  async function unlink(row: ApiGarmentTag) {
    const key = slotKey(row);
    setBusyKey(key);
    try {
      await api(`/orders/${orderId}/tags/${row.id}`, { method: 'DELETE' });
      setTagsByKey((m) => {
        const { [key]: _drop, ...rest } = m;
        return rest;
      });
    } catch (e: any) {
      toast.show(e?.detail?.message || t('failedToUpdate'));
    } finally {
      setBusyKey(null);
    }
  }

  // Scan → bind the supplied code to the first untagged slot (top-to-bottom).
  async function onScanEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const code = scan.trim().toUpperCase();
    setScan('');
    if (!code) return;
    const next = slots.find((s) => !tagsByKey[slotKey(s)]);
    if (!next) { toast.show(t('tagAllLinkedAlready')); return; }
    const key = slotKey(next);
    setBusyKey(key);
    try {
      const row = await api<ApiGarmentTag>(`/orders/${orderId}/tags`, {
        method: 'POST',
        body: { orderItemId: next.orderItemId, qtyIndex: next.qtyIndex, source: 'SCANNED', tagCode: code },
      });
      setTagsByKey((m) => ({ ...m, [key]: row }));
    } catch (err: any) {
      toast.show(err?.detail?.message || t('failedToUpdate'));
    } finally {
      setBusyKey(null);
    }
  }

  if (!order) {
    return (
      <div className="modal-scrim show" onClick={onClose}>
        <FocusTrap active onEscape={onClose}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body muted">{tCommon('loading')}</div>
        </div>
        </FocusTrap>
      </div>
    );
  }

  return (
    <div className="modal-scrim show" onClick={onClose}>
      <FocusTrap active onEscape={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('tagGarments', { number: order.number })}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="tg-top">
            <div className="tg-cust">
              <div className="odl-av">
                {(order.customer?.fullName ?? 'G').split(' ').map((s: string) => s[0]).slice(0, 2).join('')}
              </div>
              <div>
                <b>{order.customer?.fullName ?? t('guest')}</b>
                <span>{total} {tCommon('items').toLowerCase()} · {order.type === 'WALK_IN' ? 'Walk-in' : 'Pickup & Delivery'}</span>
              </div>
            </div>
            <div className={`tg-prog ${allDone ? 'done' : ''}`}>
              <b>{linkedCount}/{total}</b>
              <span>{t('tagged')}</span>
            </div>
          </div>

          <div className="tg-scanbar">
            <span className="tg-scan-ic"><Icon.search size={16} /></span>
            <input
              id="tg-scan-in"
              placeholder={t('scanPlaceholder', { sample: `${order.number}-01` })}
              autoComplete="off"
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={onScanEnter}
              autoFocus
            />
            <span className="tg-hint">{t('scannerReady')}</span>
          </div>

          <div className="tg-list">
            {slots.map((s) => {
              const key = slotKey(s);
              const tag = tagsByKey[key];
              const busy = busyKey === key;
              return (
                <div className={`tgr ${tag ? 'done' : 'new'}`} key={key}>
                  <div className="tgr-ic">
                    {tag ? '✓' : <Icon.print size={16} />}
                  </div>
                  <div className="tgr-main">
                    <div className="tgr-name">{s.name}</div>
                    <div className="tgr-sub">
                      {tag ? t('tagLinked', { id: tag.tagCode }) : t('tagAwaiting')}
                    </div>
                  </div>
                  {tag ? (
                    <button className="tgr-act undo" onClick={() => unlink(tag)} disabled={busy}>
                      {t('tagUndo')}
                    </button>
                  ) : (
                    <button
                      className={`tgr-act print${busy ? ' btn-loading' : ''}`}
                      onClick={() => printAndAttach(s)}
                      disabled={busy}
                    >
                      {t('tagPrintAttach')}
                    </button>
                  )}
                </div>
              );
            })}
            {slots.length === 0 && (
              <div className="muted" style={{ padding: '14px 0', fontSize: 13, textAlign: 'center' }}>
                {t('tagNoGarments')}
              </div>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button
            className="btn btn-ghost"
            data-od-detail
            style={{ flex: 1 }}
            onClick={onOpenDetail}
          >
            {t('orderDetails')}
          </button>
          <button
            className={`btn ${allDone ? 'btn-pri' : 'btn-disabled'}`}
            id="tg-done"
            disabled={!allDone}
            style={{ flex: 2 }}
            onClick={() => { if (allDone) onAdvance(); }}
          >
            {allDone ? t('tagDoneAdvance') : t('tagAllRemaining', { count: total - linkedCount })}
          </button>
        </div>
      </div>
      </FocusTrap>
    </div>
  );
}

/* Modal: pick how the customer paid (cash / card / Apple Pay / account /
   gift card). ON_DELIVERY is intentionally excluded here — "Take payment"
   means money is in hand now; orders intended for cash-on-delivery are
   created without a Payment row at order time and a Payment is recorded
   from Delivery → Mark delivered with one of these methods. */
function PaymentMethodPicker({
  methods,
  total,
  orderNumber,
  onPick,
  onClose,
}: {
  methods: { key: string; icon?: string }[];
  total: number;
  orderNumber: number;
  onPick: (m: PaymentMethod) => void;
  onClose: () => void;
}) {
  const tMethod = useTranslations('PaymentMethod');
  const tCommon = useTranslations('Common');
  const t = useTranslations('OrdersBoard');
  // ON_DELIVERY is the explicit not-yet-paid status; offering it on a
  // "take payment" picker would create a falsely-paid record.
  const choices = methods.filter((m) => m.key !== 'ON_DELIVERY');
  return (
    <div className="modal-scrim show" onClick={onClose} style={{ zIndex: 220 }}>
      <FocusTrap active onEscape={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('takePayment', { number: orderNumber, amount: AED(total) })}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="pay-methods" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {choices.map((m) => (
              <button
                key={m.key}
                className="pay-m"
                style={{ padding: '14px 12px', textAlign: 'left' }}
                onClick={() => onPick(m.key as PaymentMethod)}
              >
                <b style={{ display: 'block', fontSize: 14 }}>{tMethod(m.key as any)}</b>
              </button>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{tCommon('cancel')}</button>
        </div>
      </div>
      </FocusTrap>
    </div>
  );
}

/* Modal: ⋯ menu on an order card. Maps each menu row to a real API
   action (or to the dedicated picker modal for payment). Print Receipt
   is intentionally absent until the PrintJob queue ships — design's
   stub was toast-only, which violates the no-fakes rule. */
function OrderActionsMenu({
  order: o,
  onClose,
  onViewDetail,
  onTakePayment,
  onCancel,
  onRefundAll,
}: {
  order: Order;
  onClose: () => void;
  onViewDetail: () => void;
  onTakePayment: () => void;
  onCancel: () => void;
  onRefundAll: () => void;
}) {
  const t = useTranslations('OrdersBoard');
  const tCommon = useTranslations('Common');
  return (
    <div className="modal-scrim show" onClick={onClose} style={{ zIndex: 230 }}>
      <FocusTrap active onEscape={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>#{o.number}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--muted)' }}>
            {o.customer?.fullName ?? t('guest')} · {AED(o.total)} ·{' '}
            <span className={`pill ${o.paid ? 'paid' : 'unpaid'}`}>{o.paid ? t('paid') : t('unpaid')}</span>
          </div>

          <button className="role-opt" onClick={onViewDetail}>
            <span className="rav" style={{ background: 'var(--accent)' }}>
              <Icon.search size={18} />
            </span>
            <div className="ri">
              <b>{t('menu.viewDetail')}</b>
              <span>{t('menu.viewDetailSub')}</span>
            </div>
          </button>

          {!o.paid && o.status !== 'CANCELLED' && (
            <button className="role-opt" onClick={onTakePayment}>
              <span className="rav" style={{ background: 'var(--ok)' }}>
                <Icon.cash size={18} />
              </span>
              <div className="ri">
                <b>{t('menu.takePayment')}</b>
                <span>{t('menu.takePaymentSub')}</span>
              </div>
            </button>
          )}

          {o.paid && o.status !== 'CANCELLED' && (
            <button className="role-opt" onClick={onRefundAll}>
              <span className="rav" style={{ background: 'var(--warn)' }}>
                <Icon.refresh size={18} />
              </span>
              <div className="ri">
                <b>{t('menu.refund')}</b>
                <span>{t('menu.refundSub', { amount: AED(o.total) })}</span>
              </div>
            </button>
          )}

          {o.status !== 'CANCELLED' && o.status !== 'COMPLETED' && (
            <button className="role-opt" onClick={onCancel}>
              <span className="rav" style={{ background: 'var(--muted)' }}>
                <Icon.print size={18} />
              </span>
              <div className="ri">
                <b>{t('menu.cancel')}</b>
                <span>{t('menu.cancelSub')}</span>
              </div>
            </button>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
            {tCommon('close')}
          </button>
        </div>
      </div>
      </FocusTrap>
    </div>
  );
}

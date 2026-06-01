'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, eventStream } from '@/lib/api-client';
import { AED, shortTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import type { MetaResponse } from '@/lib/meta-context';
import type { OrdersBoard, OrderStatus, OrderType, Order } from '@/lib/types';

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
    const b = await api<OrdersBoard>('/orders/board');
    setBoard(b);
  }

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = eventStream();
      const onChange = () => { refresh().catch(() => {}); };
      es.addEventListener('order.created', onChange);
      es.addEventListener('order.status', onChange);
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

  async function advance(o: Order, to: OrderStatus | undefined) {
    if (!to) return;
    try {
      await api(`/orders/${o.id}/status`, { method: 'PATCH', body: { status: to } });
      toast.show(t('movedTo', { number: o.number, status: tStatus(to as any) }));
      refresh();
    } catch (e: any) {
      toast.show(e?.detail?.message || t('failedToUpdate'));
    }
  }

  async function togglePaid(o: Order) {
    try {
      if (o.paid) {
        // No "unmark paid" endpoint; record a zero-value adjustment if needed.
        toast.show(t('alreadyPaid'));
        return;
      }
      await api('/payments', {
        method: 'POST',
        body: { orderId: o.id, method: 'CASH', amount: Number(o.total) },
      });
      toast.show(t('markedPaid', { number: o.number }));
      refresh();
    } catch (e: any) {
      toast.show(e?.detail?.message || t('failedToUpdate'));
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="ph-l">
          <h2>{tStatus('boardTitle')}</h2>
          <span className="sub">
            {t('activeShort', { count: allActive })}
          </span>
        </div>
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

      <div className="board">
        {COLUMNS.map((col) => {
          const orders = (board[col.key as OrderStatus] ?? [])
            .filter(matchesFilter)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          return (
            <div className="col" key={col.key}>
              <div className="col-head">
                <span className="dot" style={{ background: col.color }} />
                <span className="cl">{tStatus(col.key as any)}</span>
                <span className="cc">{orders.length}</span>
              </div>
              <div className="col-body">
                {orders.length === 0 ? (
                  <div className="muted" style={{ fontSize: 12, padding: 14, textAlign: 'center' }}>
                    —
                  </div>
                ) : (
                  orders.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      position={rankOf[o.id] ?? 0}
                      onOpen={() => setOpenId(o.id)}
                      onAdvance={() => advance(o, next(o.status))}
                      onRetreat={() => advance(o, prev(o.status))}
                      onTogglePaid={() => togglePaid(o)}
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
          onClose={() => setOpenId(null)}
          onChanged={() => refresh()}
        />
      )}
    </div>
  );
}

function OrderCard({
  order: o,
  position,
  onOpen,
  onAdvance,
  onRetreat,
  onTogglePaid,
  canAdvance,
  canRetreat,
  nextLabel,
}: {
  order: Order;
  position: number;
  onOpen: () => void;
  onAdvance: () => void;
  onRetreat: () => void;
  onTogglePaid: () => void;
  canAdvance: boolean;
  canRetreat: boolean;
  nextLabel?: string;
}) {
  const t = useTranslations('OrdersBoard');
  const tType = useTranslations('Order');

  const isExpress = o.expressOn;
  const itemCount = o._count?.items ?? 0;
  const dueWhen = o.dueAt ? new Date(o.dueAt) : null;
  const dueLabel = dueWhen
    ? dueWhen.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : t('noDue');

  return (
    <div
      className="ocard"
      onClick={(e) => {
        // Ignore clicks that originate from a button inside the card.
        if ((e.target as HTMLElement).closest('button')) return;
        onOpen();
      }}
    >
      <div className="oc-top">
        <button className="oc-id" onClick={onOpen}>
          <span className="oc-pos">{position}</span>#{o.number}
        </button>
        <span className={`oc-type${isExpress ? ' express' : ''}`}>
          {isExpress ? t('express') : (o.type === 'WALK_IN' ? tType('walkIn') : tType('pickupDelivery'))}
        </span>
        <button className="oc-manage" title="Manage" onClick={onOpen}>⋯</button>
      </div>

      <div className="oc-cust">{o.customer?.fullName ?? t('guest')}</div>

      <div className="oc-meta">
        <span>{itemCount > 0 ? t('items', { count: itemCount }) : t('awaiting')}</span>
        <span>·</span>
        <span>{dueLabel}</span>
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
          onClick={onTogglePaid}
        >
          {o.paid ? t('paid') : t('unpaid')}
        </button>
      </div>

      {o.status === 'RECEIVED' && (
        <button className="oc-edit" onClick={onOpen}>
          {t('detailEdit')}
        </button>
      )}
      {o.status === 'TAGGING' && (
        <button className="oc-edit tag-cta" onClick={onOpen}>
          {t('openTagging')} →
        </button>
      )}

      <div className="oc-move">
        {canRetreat && (
          <button className="back" onClick={onRetreat}>←</button>
        )}
        {canAdvance ? (
          <button onClick={onAdvance}>
            {t('moveTo', { status: nextLabel?.split(' ')[0] ?? '' })} →
          </button>
        ) : (
          <button disabled style={{ opacity: 0.5 }}>{t('done')}</button>
        )}
      </div>
    </div>
  );
}

function OrderDetailModal({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [order, setOrder] = useState<any | null>(null);
  const t = useTranslations('OrdersBoard');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('OrderStatus');
  const tMethod = useTranslations('PaymentMethod');

  useEffect(() => {
    api<any>(`/orders/${orderId}`).then(setOrder);
  }, [orderId]);

  if (!order) {
    return (
      <div className="modal-scrim show" onClick={onClose}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body muted">{tCommon('loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-scrim show" onClick={onClose}>
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
            <span>{new Date(order.createdAt).toLocaleString()}</span>
            {order.primaryMethod && (<><span>·</span><span>{tMethod(order.primaryMethod as any)}</span></>)}
          </div>

          <table className="odl-tbl">
            <thead>
              <tr>
                <th>{tCommon('item')}</th>
                <th>{tCommon('qty')}</th>
                <th className="num">{tCommon('price')}</th>
                <th className="num">{tCommon('total')}</th>
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
                </tr>
              ))}
              {(order.items ?? []).length === 0 && (
                <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 14 }}>—</td></tr>
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
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{tCommon('cancel')}</button>
          <button
            className="btn btn-pri"
            style={{ flex: 2 }}
            onClick={async () => {
              if (!confirm(t('cancelOrderConfirm', { number: order.number }))) return;
              await api(`/orders/${order.id}/cancel`, { method: 'PATCH', body: { reason: 'cancelled by staff' } });
              onChanged();
              onClose();
            }}
            disabled={order.status === 'CANCELLED' || order.status === 'COMPLETED'}
          >
            {t('cancelOrder')}
          </button>
        </div>
      </div>
    </div>
  );
}

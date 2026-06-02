'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api, eventStream } from '@/lib/api-client';
import { AED, dueLabel } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { Icon } from '@/components/Icons';
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
  const [tagId, setTagId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<OrderStatus | null>(null);
  const [reloading, setReloading] = useState(false);

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

  // Returns an error message string when the requested move violates a
  // business rule (e.g. no items can't enter Tagging, untagged orders
  // can't enter Cleaning). Returns null when the move is allowed.
  // The TaggingModal bypasses this guard via doMove() — it is itself the
  // tagging-complete gate.
  function guardMove(o: Order, to: OrderStatus): string | null {
    const itemCount = o._count?.items ?? 0;
    if (to === 'TAGGING' && itemCount === 0) return t('cantTagWithoutItems');
    // Reaching CLEANING from anywhere before TAGGING is complete is
    // blocked. From TAGGING via the regular advance arrow is also blocked
    // — the modal's "Done · Move to Cleaning" is the only allowed path.
    if (to === 'CLEANING' && (o.status === 'RECEIVED' || o.status === 'TAGGING')) {
      return t('mustTagAllItems');
    }
    return null;
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

  async function moveTo(o: Order, to: OrderStatus | undefined) {
    if (!to || to === o.status) return;
    const blocker = guardMove(o, to);
    if (blocker) { toast.show(blocker); return; }
    await doMove(o, to);
  }

  async function togglePaid(o: Order) {
    try {
      if (o.paid) {
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
          onClose={() => setOpenId(null)}
          onChanged={() => refresh()}
        />
      )}
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
        <button className="oc-manage" data-manage={o.id} onClick={onOpen}>⋯</button>
      </div>

      <div className="oc-cust">{o.customer?.fullName ?? t('guest')}</div>

      {/* Design app.js:581 — `${o.items+' items'}` literal (no plural rule). */}
      <div className="oc-meta">
        <span>{itemCount > 0 ? `${itemCount} ${tCommon('items').toLowerCase()}` : t('awaiting')}</span>
        <span>·</span>
        <span>{due}</span>
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
  onClose,
  onChanged,
}: {
  orderId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? 'en';
  const [order, setOrder] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState<null | { kind: 'all' } | { kind: 'line'; line: any }>(null);
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

  async function markPaid() {
    if (!order || order.paid) return;
    setBusy(true);
    try {
      await api('/payments', {
        method: 'POST',
        body: { orderId: order.id, method: 'CASH', amount: Number(order.total) },
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

  function reprint() {
    toast.show(t('reprintToast'));
  }

  if (!order) {
    return (
      <div className="modal-scrim show" onClick={onClose}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body muted">{tCommon('loading')}</div>
        </div>
      </div>
    );
  }

  const canEdit = order.status === 'RECEIVED' && !order.paid;
  const canPay = !order.paid && order.status !== 'CANCELLED';
  const canRefund = order.paid && order.status !== 'CANCELLED';

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
          </div>
        )}
      </div>
    </div>
  );
}

/* Design app.js:1050-1101 — openTagging modal.
   Per-garment tagging state is local-only (no API): each order line
   becomes a row, identified by a generated tag id `C\${number}-\${idx}`.
   Each row is in one of three states:
   - linked: ✓ icon, .tgr.done class, Undo button
   - fresh:  printer icon, .tgr.new class, Print & attach button
   - has:    search icon, .tgr.has class, Scan barcode button
   The scanbar accepts barcode input — pressing Enter links a matching
   tag. When all garments are linked, the footer CTA flips to
   'Done · Move to Cleaning →' which advances the order's status. */
interface TagRow { idx: number; id: string; name: string; linked: boolean; fresh: boolean }

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
  const [tags, setTags] = useState<TagRow[]>([]);
  const [scan, setScan] = useState('');
  const t = useTranslations('OrdersBoard');
  const tCommon = useTranslations('Common');
  const toast = useToast();

  useEffect(() => {
    api<any>(`/orders/${orderId}`).then((o) => {
      setOrder(o);
      // One tag row per line × qty (a garment per unit). Half are flagged
      // 'fresh' (new, needs print) as a stable rotation of indices —
      // matches design's idx%2 pattern from ensureTags.
      const rows: TagRow[] = [];
      let cursor = 0;
      for (const l of (o.items ?? [])) {
        const qty = Math.max(1, Number(l.qty) || 1);
        for (let i = 0; i < qty; i++) {
          rows.push({
            idx: cursor,
            id: `C${o.number}-${String(cursor + 1).padStart(2, '0')}`,
            name: l.nameSnapshot ?? l.name ?? 'Garment',
            linked: false,
            fresh: cursor % 2 === 0,
          });
          cursor++;
        }
      }
      setTags(rows);
    });
  }, [orderId]);

  const linked = tags.filter((tg) => tg.linked).length;
  const total = tags.length;
  const allDone = total > 0 && linked === total;

  function link(idx: number) {
    setTags((cur) => cur.map((tg) => tg.idx === idx ? { ...tg, linked: true, fresh: false } : tg));
  }
  function unlink(idx: number) {
    setTags((cur) => cur.map((tg) => tg.idx === idx ? { ...tg, linked: false } : tg));
  }
  function onScanEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const v = scan.trim().toUpperCase();
    setScan('');
    if (!v) return;
    const match = tags.find((tg) => tg.id.toUpperCase() === v && !tg.linked);
    if (match) {
      link(match.idx);
      return;
    }
    const dup = tags.find((tg) => tg.id.toUpperCase() === v && tg.linked);
    toast.show(dup ? t('tagAlreadyLinked', { id: v }) : t('tagNoMatch', { id: v }));
  }

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
              <b>{linked}/{total}</b>
              <span>{t('tagged')}</span>
            </div>
          </div>

          <div className="tg-scanbar">
            <span className="tg-scan-ic"><Icon.search size={16} /></span>
            <input
              id="tg-scan-in"
              placeholder={t('scanPlaceholder', { sample: tags[0]?.id ?? 'C1042-01' })}
              autoComplete="off"
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={onScanEnter}
              autoFocus
            />
            <span className="tg-hint">{t('scannerReady')}</span>
          </div>

          <div className="tg-list">
            {tags.map((tg) => {
              const cls = tg.linked ? 'done' : tg.fresh ? 'new' : 'has';
              return (
                <div className={`tgr ${cls}`} key={tg.idx} data-tgr={tg.idx}>
                  <div className="tgr-ic">
                    {tg.linked ? '✓' : tg.fresh ? <Icon.print size={16} /> : <Icon.search size={16} />}
                  </div>
                  <div className="tgr-main">
                    <div className="tgr-name">{tg.name}</div>
                    <div className="tgr-sub">
                      {tg.linked
                        ? t('tagLinked', { id: tg.id })
                        : tg.fresh
                          ? t('tagNew')
                          : t('tagExisting', { id: tg.id })}
                    </div>
                  </div>
                  {tg.linked ? (
                    <button className="tgr-act undo" data-unlink={tg.idx} onClick={() => unlink(tg.idx)}>
                      {t('tagUndo')}
                    </button>
                  ) : tg.fresh ? (
                    <button
                      className="tgr-act print"
                      data-print={tg.idx}
                      onClick={() => { toast.show(t('tagPrinted')); link(tg.idx); }}
                    >
                      {t('tagPrintAttach')}
                    </button>
                  ) : (
                    <button
                      className="tgr-act scan"
                      data-scan={tg.idx}
                      onClick={() => link(tg.idx)}
                    >
                      {t('tagScan')}
                    </button>
                  )}
                </div>
              );
            })}
            {tags.length === 0 && (
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
            {allDone ? t('tagDoneAdvance') : t('tagAllRemaining', { count: total - linked })}
          </button>
        </div>
      </div>
    </div>
  );
}

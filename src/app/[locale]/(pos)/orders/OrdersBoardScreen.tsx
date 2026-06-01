'use client';

import { useEffect, useState } from 'react';
import { api, eventStream } from '@/lib/api-client';
import { AED, shortTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import type { OrdersBoard, OrderStatus, Order } from '@/lib/types';

const COLUMNS: { id: OrderStatus; label: string; color: string }[] = [
  { id: 'RECEIVED',  label: 'Received',         color: '#6E7C82' },
  { id: 'TAGGING',   label: 'Tagging',          color: '#7C5CBF' },
  { id: 'CLEANING',  label: 'Cleaning',         color: '#C4A572' },
  { id: 'READY',     label: 'Ready',            color: '#8FA88B' },
  { id: 'DELIVERY',  label: 'Out for Delivery', color: '#2A6FDB' },
  { id: 'COMPLETED', label: 'Completed',        color: '#1F8A5B' },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  RECEIVED: 'TAGGING', TAGGING: 'CLEANING', CLEANING: 'READY', READY: 'DELIVERY', DELIVERY: 'COMPLETED',
};
const PREV_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  TAGGING: 'RECEIVED', CLEANING: 'TAGGING', READY: 'CLEANING', DELIVERY: 'READY', COMPLETED: 'DELIVERY',
};

export default function OrdersBoardScreen({ initial }: { initial: OrdersBoard }) {
  const [board, setBoard] = useState<OrdersBoard>(initial);
  const toast = useToast();

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
    } catch {}
    return () => es?.close();
  }, []);

  async function move(o: Order, to: OrderStatus) {
    try {
      await api(`/orders/${o.id}/status`, { method: 'PATCH', body: { status: to } });
      toast.show(`#${o.number} → ${to.toLowerCase()}`);
      refresh();
    } catch (e: any) {
      toast.show(e?.detail?.message || 'Failed to update status');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="ph-l">
          <h2>Orders</h2>
          <span className="sub">
            {Object.values(board).flat().length} active
          </span>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={() => refresh()}>Refresh</button>
        </div>
      </div>

      <div className="board">
        {COLUMNS.map((col) => {
          const orders = board[col.id] ?? [];
          return (
            <div className="col" key={col.id}>
              <div className="col-head">
                <span className="dot" style={{ background: col.color }} />
                <span className="cl">{col.label}</span>
                <span className="cc">{orders.length}</span>
              </div>
              <div className="col-body">
                {orders.length === 0 ? (
                  <div className="muted" style={{ fontSize: 12, padding: 10, textAlign: 'center' }}>—</div>
                ) : orders.map((o) => (
                  <div className="ocard" key={o.id}>
                    <div className="oc-top">
                      <span className="oc-id">#{o.number}</span>
                      <span className={`oc-type${o.type === 'PICKUP_DELIVERY' ? '' : ''}`}>{o.type === 'WALK_IN' ? 'Walk-in' : 'Pickup'}</span>
                    </div>
                    <div className="oc-cust">{o.customer?.fullName ?? 'Walk-in customer'}</div>
                    <div className="oc-meta">
                      <span>{o._count?.items ?? 0} items</span>
                      <span>{shortTime(o.createdAt)}</span>
                    </div>
                    <div className="oc-foot">
                      <span className="oc-total">{AED(o.total)}</span>
                      <span className={`oc-pay ${o.paid ? 'paid' : 'unpaid'}`}>{o.paid ? 'paid' : 'unpaid'}</span>
                    </div>
                    <div className="oc-move">
                      {PREV_STATUS[col.id] && (
                        <button className="back" onClick={() => move(o, PREV_STATUS[col.id]!)}>←</button>
                      )}
                      {NEXT_STATUS[col.id] && (
                        <button onClick={() => move(o, NEXT_STATUS[col.id]!)}>
                          → {COLUMNS.find((c) => c.id === NEXT_STATUS[col.id])?.label.split(' ')[0]}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

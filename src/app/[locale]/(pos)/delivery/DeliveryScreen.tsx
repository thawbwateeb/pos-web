'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, eventStream } from '@/lib/api-client';
import { AED } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { Icon } from '@/components/Icons';
import FocusTrap from '@/components/FocusTrap';
import type { Order, Driver } from '@/lib/types';

// `deliveryAddress` is present on the API row but isn't on the FE `Order`
// surface yet — pull it off via a narrow extension type so we don't widen
// the public type just for this screen.
type OrderWithAddress = Order & { deliveryAddress?: string | null; pickupAddress?: string | null };

type Column = 'READY' | 'OUT' | 'DONE';

export default function DeliveryScreen({
  initialReady,
  initialOut,
  initialCompleted,
  drivers,
}: {
  initialReady: Order[];
  initialOut: Order[];
  initialCompleted: Order[];
  drivers: Driver[];
}) {
  const [ready, setReady] = useState<Order[]>(initialReady);
  const [out, setOut] = useState<Order[]>(initialOut);
  const [completed, setCompleted] = useState<Order[]>(initialCompleted);
  const [drvList, setDrvList] = useState<Driver[]>(drivers);
  const [pickerFor, setPickerFor] = useState<Order | null>(null);
  const t = useTranslations('Delivery');
  const tCommon = useTranslations('Common');
  const toast = useToast();

  async function refresh() {
    try {
      const [r, o, c, d] = await Promise.all([
        api<Order[]>('/orders?status=READY&take=100'),
        api<Order[]>('/orders?status=DELIVERY&take=100'),
        api<Order[]>('/orders?status=COMPLETED&take=50'),
        api<Driver[]>('/drivers'),
      ]);
      setReady(r);
      setOut(o);
      setCompleted(c);
      setDrvList(d);
    } catch {
      /* leave existing state */
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
    } catch { /* SSE optional */ }
    return () => es?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bucket filters: only PICKUP_DELIVERY orders belong on this screen, and
  // the "Delivered today" column is scoped to today's completions.
  const readyDelivery = useMemo(
    () => ready.filter((o) => o.type === 'PICKUP_DELIVERY'),
    [ready],
  );
  const outForDelivery = useMemo(() => out, [out]);
  const deliveredToday = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startMs = startOfDay.getTime();
    return completed.filter((o) => {
      if (o.type !== 'PICKUP_DELIVERY') return false;
      const finishedAt = new Date(o.updatedAt).getTime();
      return finishedAt >= startMs;
    });
  }, [completed]);

  const activeDrivers = useMemo(() => drvList.filter((d) => d.active), [drvList]);

  async function assignDriver(order: Order, driverId: string) {
    try {
      await api(`/orders/${order.id}/driver`, { method: 'PATCH', body: { driverId } });
      // Advance to DELIVERY once a driver is on the job. If the order is
      // already DELIVERY (reassign case) the status PATCH is a no-op for
      // status but the driver change is still applied.
      if (order.status !== 'DELIVERY') {
        await api(`/orders/${order.id}/status`, { method: 'PATCH', body: { status: 'DELIVERY' } });
      }
      const drvName = drvList.find((d) => d.id === driverId)?.name ?? '';
      toast.show(t('assignedToast', { number: order.number, driver: drvName }));
      setPickerFor(null);
      refresh();
    } catch (e) {
      const detail = (e as { detail?: { message?: string } })?.detail;
      toast.show(detail?.message || t('failed'));
    }
  }

  async function markDelivered(order: Order) {
    try {
      await api(`/orders/${order.id}/status`, { method: 'PATCH', body: { status: 'COMPLETED' } });
      toast.show(t('deliveredToast', { number: order.number }));
      refresh();
    } catch (e) {
      const detail = (e as { detail?: { message?: string } })?.detail;
      toast.show(detail?.message || t('failed'));
    }
  }

  async function returnToReady(order: Order) {
    try {
      // Clear the driver first, then back the status off to READY so the
      // card lands in the right column with no stale driver chip.
      await api(`/orders/${order.id}/driver`, { method: 'PATCH', body: { driverId: null } });
      await api(`/orders/${order.id}/status`, { method: 'PATCH', body: { status: 'READY' } });
      refresh();
    } catch (e) {
      const detail = (e as { detail?: { message?: string } })?.detail;
      toast.show(detail?.message || t('failed'));
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

      <div className="board">
        <DeliveryColumn
          column="READY"
          title={t('colReady')}
          color="#f59e0b"
          orders={readyDelivery}
          drivers={drvList}
          emptyLabel={t('empty')}
          addressLabel={t('address')}
          driverChipLabel={t('driverChip')}
          driverNoneLabel={t('driverChipNone')}
          assignLabel={t('assignDriver')}
          assignedLabel={(name) => t('assignedTo', { name })}
          markDeliveredLabel={t('markDelivered')}
          returnToReadyLabel={t('returnToReady')}
          deliveredLabel={t('delivered')}
          itemsLabel={tCommon('items')}
          onAssign={(o) => setPickerFor(o)}
          onMarkDelivered={markDelivered}
          onReturn={returnToReady}
        />
        <DeliveryColumn
          column="OUT"
          title={t('colOut')}
          color="#3b82f6"
          orders={outForDelivery}
          drivers={drvList}
          emptyLabel={t('empty')}
          addressLabel={t('address')}
          driverChipLabel={t('driverChip')}
          driverNoneLabel={t('driverChipNone')}
          assignLabel={t('assignDriver')}
          assignedLabel={(name) => t('assignedTo', { name })}
          markDeliveredLabel={t('markDelivered')}
          returnToReadyLabel={t('returnToReady')}
          deliveredLabel={t('delivered')}
          itemsLabel={tCommon('items')}
          onAssign={(o) => setPickerFor(o)}
          onMarkDelivered={markDelivered}
          onReturn={returnToReady}
        />
        <DeliveryColumn
          column="DONE"
          title={t('colDone')}
          color="#10b981"
          orders={deliveredToday}
          drivers={drvList}
          emptyLabel={t('empty')}
          addressLabel={t('address')}
          driverChipLabel={t('driverChip')}
          driverNoneLabel={t('driverChipNone')}
          assignLabel={t('assignDriver')}
          assignedLabel={(name) => t('assignedTo', { name })}
          markDeliveredLabel={t('markDelivered')}
          returnToReadyLabel={t('returnToReady')}
          deliveredLabel={t('delivered')}
          itemsLabel={tCommon('items')}
          onAssign={() => {}}
          onMarkDelivered={() => {}}
          onReturn={() => {}}
        />
      </div>

      {pickerFor && (
        <DriverPicker
          drivers={activeDrivers}
          currentDriverId={pickerFor.driverId}
          pickLabel={t('pickDriver')}
          onClose={() => setPickerFor(null)}
          onPick={(driverId) => assignDriver(pickerFor, driverId)}
        />
      )}
    </div>
  );
}

function DeliveryColumn({
  column,
  title,
  color,
  orders,
  drivers,
  emptyLabel,
  addressLabel,
  driverChipLabel,
  driverNoneLabel,
  assignLabel,
  assignedLabel,
  markDeliveredLabel,
  returnToReadyLabel,
  deliveredLabel,
  itemsLabel,
  onAssign,
  onMarkDelivered,
  onReturn,
}: {
  column: Column;
  title: string;
  color: string;
  orders: Order[];
  drivers: Driver[];
  emptyLabel: string;
  addressLabel: string;
  driverChipLabel: string;
  driverNoneLabel: string;
  assignLabel: string;
  assignedLabel: (name: string) => string;
  markDeliveredLabel: string;
  returnToReadyLabel: string;
  deliveredLabel: string;
  itemsLabel: string;
  onAssign: (order: Order) => void;
  onMarkDelivered: (order: Order) => void;
  onReturn: (order: Order) => void;
}) {
  return (
    <div className="col">
      <div className="col-head">
        <span className="dot" style={{ background: color }} />
        <span className="cl">{title}</span>
        <span className="cc">{orders.length}</span>
      </div>
      <div className="col-body">
        {orders.length === 0 ? (
          <div className="muted" style={{ fontSize: 12, padding: 14, textAlign: 'center' }}>
            {emptyLabel}
          </div>
        ) : (
          orders.map((o) => (
            <DeliveryCard
              key={o.id}
              order={o}
              column={column}
              drivers={drivers}
              addressLabel={addressLabel}
              driverChipLabel={driverChipLabel}
              driverNoneLabel={driverNoneLabel}
              assignLabel={assignLabel}
              assignedLabel={assignedLabel}
              markDeliveredLabel={markDeliveredLabel}
              returnToReadyLabel={returnToReadyLabel}
              deliveredLabel={deliveredLabel}
              itemsLabel={itemsLabel}
              onAssign={onAssign}
              onMarkDelivered={onMarkDelivered}
              onReturn={onReturn}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DeliveryCard({
  order,
  column,
  drivers,
  addressLabel,
  driverChipLabel,
  driverNoneLabel,
  assignLabel,
  assignedLabel,
  markDeliveredLabel,
  returnToReadyLabel,
  deliveredLabel,
  itemsLabel,
  onAssign,
  onMarkDelivered,
  onReturn,
}: {
  order: Order;
  column: Column;
  drivers: Driver[];
  addressLabel: string;
  driverChipLabel: string;
  driverNoneLabel: string;
  assignLabel: string;
  assignedLabel: (name: string) => string;
  markDeliveredLabel: string;
  returnToReadyLabel: string;
  deliveredLabel: string;
  itemsLabel: string;
  onAssign: (order: Order) => void;
  onMarkDelivered: (order: Order) => void;
  onReturn: (order: Order) => void;
}) {
  const withAddr = order as OrderWithAddress;
  const address = withAddr.deliveryAddress || withAddr.pickupAddress || '—';
  const items = order._count?.items ?? order.items?.length ?? 0;
  // driver may come from the `driver` join (list endpoint) — fall back to
  // looking up the id in the drivers prop so we never show a bare uuid.
  const driverName =
    order.driver?.name ??
    drivers.find((d) => d.id === order.driverId)?.name ??
    null;

  return (
    <div className="ocard">
      <div className="oc-top">
        <span className="oc-id">#{order.number}</span>
        <span className="oc-type">{itemsLabel}: {items}</span>
      </div>

      <div className="oc-cust">{order.customer?.fullName ?? '—'}</div>
      <div className="oc-meta">
        <span>{order.customer?.phone ?? '—'}</span>
      </div>
      <div className="oc-meta" style={{ marginBottom: 10 }}>
        <span style={{ fontWeight: 500 }}>{addressLabel}:</span>
        <span>{address}</span>
      </div>

      <div className="oc-track">
        {driverName ? (
          <button
            className="oc-rack"
            onClick={() => column !== 'DONE' && onAssign(order)}
            title={assignedLabel(driverName)}
            style={{ cursor: column === 'DONE' ? 'default' : 'pointer', border: 'none' }}
          >
            <Icon.truck size={11} /> {driverChipLabel}: {driverName}
          </button>
        ) : (
          <span className="oc-scan">
            <Icon.truck size={11} /> {driverNoneLabel}
          </span>
        )}
      </div>

      <div className="oc-foot">
        <span className="oc-total">{AED(order.total)}</span>
        {column === 'DONE' && (
          <span className="oc-pay paid">{deliveredLabel}</span>
        )}
      </div>

      {column === 'READY' && (
        <div className="oc-move">
          <button onClick={() => onAssign(order)}>{assignLabel} →</button>
        </div>
      )}
      {column === 'OUT' && (
        <div className="oc-move">
          <button className="back" onClick={() => onReturn(order)} title={returnToReadyLabel}>
            ←
          </button>
          <button onClick={() => onMarkDelivered(order)}>{markDeliveredLabel} ✓</button>
        </div>
      )}
    </div>
  );
}

function DriverPicker({
  drivers,
  currentDriverId,
  pickLabel,
  onClose,
  onPick,
}: {
  drivers: Driver[];
  currentDriverId: string | null;
  pickLabel: string;
  onClose: () => void;
  onPick: (driverId: string) => void;
}) {
  return (
    <div className="modal-scrim show" onClick={onClose}>
      <FocusTrap active onEscape={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{pickLabel}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {drivers.length === 0 ? (
            <div className="muted" style={{ padding: 14, textAlign: 'center' }}>—</div>
          ) : (
            drivers.map((d) => (
              <button
                key={d.id}
                className={`role-opt${d.id === currentDriverId ? ' sel' : ''}`}
                onClick={() => onPick(d.id)}
              >
                <div className="rav">
                  <Icon.truck size={18} />
                </div>
                <div className="ri">
                  <b>{d.name}</b>
                  <span>{d.zone ?? '—'}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      </FocusTrap>
    </div>
  );
}

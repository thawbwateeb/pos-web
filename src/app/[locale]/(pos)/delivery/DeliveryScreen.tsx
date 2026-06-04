'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, eventStream } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import type { Order, Driver } from '@/lib/types';

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
  // `initialCompleted` is fetched by the page and kept in state so SSE
  // refreshes stay in sync, but completed orders don't appear on the routes
  // list (the prototype only lists active jobs).
  const [, setCompleted] = useState<Order[]>(initialCompleted);
  const [drvList, setDrvList] = useState<Driver[]>(drivers);
  const t = useTranslations('Delivery');
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

  // Routes = active delivery jobs: orders ready for delivery (PICKUP_DELIVERY)
  // plus orders already out for delivery. Completed orders are excluded.
  const jobs = useMemo(() => {
    const readyDelivery = ready.filter((o) => o.type === 'PICKUP_DELIVERY');
    return [...readyDelivery, ...out];
  }, [ready, out]);

  const unassigned = useMemo(() => jobs.filter((o) => !o.driverId), [jobs]);

  async function assignDriver(order: Order, driverId: string) {
    try {
      if (driverId) {
        await api(`/orders/${order.id}/driver`, { method: 'PATCH', body: { driverId } });
        if (order.status !== 'DELIVERY') {
          await api(`/orders/${order.id}/status`, { method: 'PATCH', body: { status: 'DELIVERY' } });
        }
        const drvName = drvList.find((d) => d.id === driverId)?.name ?? '';
        toast.show(t('assignedToast', { number: order.number, driver: drvName }));
      } else {
        await api(`/orders/${order.id}/driver`, { method: 'PATCH', body: { driverId: null } });
        toast.show(t('driverRemovedToast', { number: order.number }));
      }
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
          <span className="sub">
            {t('headerCount', { jobs: jobs.length, unassigned: unassigned.length })}
          </span>
        </div>
      </div>

      <div className="cols-2">
        <div className="panel">
          <h3>{t('routesTitle')}</h3>
          <div className="psub">{t('routesSub')}</div>
          {jobs.map((o) => {
            const typeLabel = o.status === 'DELIVERY' ? t('statusOut') : t('statusReady');
            const due = o.dueAt
              ? new Date(o.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';
            const meta = [o.customer?.phone, due].filter(Boolean).join(' · ');
            return (
              <div className="driver" key={o.id}>
                <span className="dstat on">{typeLabel}</span>
                <div className="dinfo" style={{ marginLeft: 4 }}>
                  <b>#{o.number} · {o.customer?.fullName ?? t('guest')}</b>
                  <span>{meta}</span>
                </div>
                <select
                  className="t-btn ghost"
                  value={o.driverId ?? ''}
                  onChange={(e) => assignDriver(o, e.target.value)}
                  style={{ border: '1px solid var(--border)', padding: '8px 10px' }}
                >
                  <option value="">{t('unassigned')}</option>
                  {drvList.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <div className="panel">
          <h3>{t('driversTitle')}</h3>
          <div className="psub">{t('driversSub')}</div>
          {drvList.map((d) => {
            const load = jobs.filter((o) => o.driverId === d.id).length;
            return (
              <div className="driver" key={d.id}>
                <span className="dav">{d.name.charAt(0)}</span>
                <div className="dinfo">
                  <b>{d.name}</b>
                  <span>{d.zone ?? ''}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={`dstat ${d.active ? 'on' : 'off'}`}>
                    {d.active ? t('onShift') : t('off')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
                    {t('jobCount', { count: load })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

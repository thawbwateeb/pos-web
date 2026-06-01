'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, eventStream } from '@/lib/api-client';
import { AED, shortTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { Icon } from '@/components/Icons';
import type { Order } from '@/lib/types';

interface ItemSnapshot {
  id: string;
  skuSnapshot: string;
  nameSnapshot: string;
  tierSnapshot: string;
  qty: number;
  unitPrice: string;
  lineTotal: string;
}

interface OrderWithItems extends Order {
  items?: ItemSnapshot[];
}

export default function InspectionScreen({
  pending,
  passed,
}: {
  pending: Order[];
  passed: Order[];
}) {
  const [pendingList, setPendingList] = useState<Order[]>(pending);
  const [passedList, setPassedList] = useState<Order[]>(passed);
  const [openId, setOpenId] = useState<string | null>(null);
  const t = useTranslations('Inspection');
  const toast = useToast();

  async function refresh() {
    try {
      const [p, r] = await Promise.all([
        api<Order[]>('/orders?status=CLEANING&take=100'),
        api<Order[]>('/orders?status=READY&take=100'),
      ]);
      setPendingList(p);
      setPassedList(r);
    } catch {
      /* ignore — SSE will retry */
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
    } catch {/* SSE optional */}
    return () => es?.close();
  }, []);

  // "Passed today" = READY orders whose updatedAt is today (the design says
  // today's QA throughput, not the full Ready queue).
  const passedToday = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const ms = startOfDay.getTime();
    return passedList
      .filter((o) => new Date(o.updatedAt).getTime() >= ms)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [passedList]);

  const sortedPending = useMemo(
    () => [...pendingList].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ),
    [pendingList],
  );

  return (
    <div className="page">
      <div className="page-head">
        <div className="ph-l">
          <h2>{t('title')}</h2>
          <span className="sub">{t('subtitle')}</span>
        </div>
      </div>

      <div className="board">
        <Column
          title={t('colPending')}
          count={sortedPending.length}
          color="var(--warn, #f59e0b)"
        >
          {sortedPending.length === 0 ? (
            <Empty label={t('empty')} />
          ) : (
            sortedPending.map((o) => (
              <PendingCard
                key={o.id}
                order={o}
                onOpen={() => setOpenId(o.id)}
                openLabel={t('openQA')}
                itemsLabel={(count: number) => t('itemsCount', { count })}
              />
            ))
          )}
        </Column>

        <Column
          title={t('colPassed')}
          count={passedToday.length}
          color="var(--ok, #16a34a)"
        >
          {passedToday.length === 0 ? (
            <Empty label={t('empty')} />
          ) : (
            passedToday.map((o) => (
              <PassedCard
                key={o.id}
                order={o}
                passedLabel={t('passedBy', { time: shortTime(o.updatedAt) })}
                itemsLabel={(count: number) => t('itemsCount', { count })}
              />
            ))
          )}
        </Column>
      </div>

      {openId && (
        <InspectionModal
          orderId={openId}
          onClose={() => setOpenId(null)}
          onSaved={(number) => {
            toast.show(t('saved', { number }));
            setOpenId(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Column({
  title,
  count,
  color,
  children,
}: {
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="col">
      <div className="col-head">
        <span className="dot" style={{ background: color }} />
        <span className="cl">{title}</span>
        <span className="cc">{count}</span>
      </div>
      <div className="col-body">{children}</div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="muted" style={{ fontSize: 12, padding: 14, textAlign: 'center' }}>
      {label}
    </div>
  );
}

function PendingCard({
  order: o,
  onOpen,
  openLabel,
  itemsLabel,
}: {
  order: Order;
  onOpen: () => void;
  openLabel: string;
  itemsLabel: (count: number) => string;
}) {
  const t = useTranslations('OrdersBoard');
  const itemCount = o._count?.items ?? 0;
  return (
    <div className="ocard" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <div className="oc-top">
        <button className="oc-id" onClick={onOpen}>#{o.number}</button>
      </div>
      <div className="oc-cust">{o.customer?.fullName ?? t('guest')}</div>
      <div className="oc-meta">
        <Icon.bag size={12} />
        <span>{itemsLabel(itemCount)}</span>
      </div>
      <div className="oc-foot">
        <span className="oc-total">{AED(o.total)}</span>
        <button className="btn btn-pri" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          {openLabel}
        </button>
      </div>
    </div>
  );
}

function PassedCard({
  order: o,
  passedLabel,
  itemsLabel,
}: {
  order: Order;
  passedLabel: string;
  itemsLabel: (count: number) => string;
}) {
  const t = useTranslations('OrdersBoard');
  const itemCount = o._count?.items ?? 0;
  return (
    <div className="ocard">
      <div className="oc-top">
        <button className="oc-id">#{o.number}</button>
        <span className="pill paid" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon.check size={12} />
        </span>
      </div>
      <div className="oc-cust">{o.customer?.fullName ?? t('guest')}</div>
      <div className="oc-meta">
        <Icon.bag size={12} />
        <span>{itemsLabel(itemCount)}</span>
      </div>
      <div className="oc-meta" style={{ color: 'var(--ok, #16a34a)' }}>
        <Icon.check size={12} />
        <span>{passedLabel}</span>
      </div>
      <div className="oc-foot">
        <span className="oc-total">{AED(o.total)}</span>
      </div>
    </div>
  );
}

interface ItemDecision {
  status: 'pass' | 'fail';
  note: string;
}

function InspectionModal({
  orderId,
  onClose,
  onSaved,
}: {
  orderId: string;
  onClose: () => void;
  onSaved: (number: number) => void;
}) {
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [decisions, setDecisions] = useState<Record<string, ItemDecision>>({});
  const [busy, setBusy] = useState(false);
  const t = useTranslations('Inspection');
  const tCommon = useTranslations('Common');
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    api<OrderWithItems>(`/orders/${orderId}`)
      .then((o) => {
        if (!alive) return;
        setOrder(o);
        const init: Record<string, ItemDecision> = {};
        (o.items ?? []).forEach((it) => { init[it.id] = { status: 'pass', note: '' }; });
        setDecisions(init);
      })
      .catch((e: any) => {
        toast.show(e?.detail?.message || e?.message || 'Failed to load');
        onClose();
      });
    return () => { alive = false; };
  }, [orderId, onClose, toast]);

  function setStatus(id: string, status: 'pass' | 'fail') {
    setDecisions((d) => ({ ...d, [id]: { status, note: d[id]?.note ?? '' } }));
  }
  function setNote(id: string, note: string) {
    setDecisions((d) => ({ ...d, [id]: { status: d[id]?.status ?? 'pass', note } }));
  }

  const items = order?.items ?? [];
  const failed = items.filter((i) => decisions[i.id]?.status === 'fail');
  const failCount = failed.length;

  async function submit() {
    if (!order) return;
    setBusy(true);
    try {
      const passedCount = items.length - failCount;
      const failDetails = failed
        .map((i) => `${i.nameSnapshot}${decisions[i.id]?.note ? ` (${decisions[i.id].note})` : ''}`)
        .join('; ');
      const note =
        failCount === 0
          ? `QA: ${items.length} item(s) inspected, all passed`
          : `QA: ${items.length} item(s) inspected, ${passedCount} passed, ${failCount} failed: ${failDetails}`;
      await api(`/orders/${order.id}/status`, {
        method: 'PATCH',
        body: { status: 'READY', note },
      });
      onSaved(order.number);
    } catch (e: any) {
      toast.show(e?.detail?.message || e?.message || 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (!order) {
    return (
      <div className="modal-scrim show" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body muted">{tCommon('loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>#{order.number} · {order.customer?.fullName ?? '—'}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {items.length === 0 ? (
            <div className="muted" style={{ padding: 14, textAlign: 'center' }}>—</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it) => {
                const d = decisions[it.id] ?? { status: 'pass' as const, note: '' };
                return (
                  <div
                    key={it.id}
                    className="role-opt"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Icon.bag size={16} />
                      <div className="ri" style={{ flex: 1 }}>
                        <b>{it.nameSnapshot}</b>
                        <span>{it.tierSnapshot} · ×{it.qty}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className={`pill${d.status === 'pass' ? ' paid' : ''}`}
                          onClick={() => setStatus(it.id, 'pass')}
                        >
                          {t('pass')}
                        </button>
                        <button
                          type="button"
                          className={`pill${d.status === 'fail' ? ' unpaid' : ''}`}
                          onClick={() => setStatus(it.id, 'fail')}
                        >
                          {t('fail')}
                        </button>
                      </div>
                    </div>
                    {d.status === 'fail' && (
                      <input
                        type="text"
                        placeholder={t('noteHint')}
                        value={d.note}
                        onChange={(e) => setNote(it.id, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          background: 'var(--surface)',
                          color: 'var(--text)',
                          fontSize: 13,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>
            {tCommon('cancel')}
          </button>
          <button
            className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
            style={{ flex: 1 }}
            onClick={submit}
            disabled={busy || items.length === 0}
          >
            {failCount === 0 ? t('allPass') : t('someFail', { count: failCount })}
          </button>
        </div>
      </div>
    </div>
  );
}

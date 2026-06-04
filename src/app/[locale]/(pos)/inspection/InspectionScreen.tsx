'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, eventStream } from '@/lib/api-client';
import { printLabels } from '@/lib/print';
import type { LabelTag } from '@/lib/print-render';
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

type Flag = 'Stain' | 'Damage' | 'Delicate';
const FLAGS: Flag[] = ['Stain', 'Damage', 'Delicate'];

interface ItemState {
  done: boolean;
  flag: Flag | null;
}

export default function InspectionScreen({
  pending,
}: {
  pending: Order[];
  passed: Order[];
}) {
  const [queue, setQueue] = useState<Order[]>(pending);
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [itemState, setItemState] = useState<Record<string, ItemState>>({});
  const [busy, setBusy] = useState(false);
  const t = useTranslations('Inspection');
  const toast = useToast();

  // The active inspection is the oldest order still in the QA/cleaning stage —
  // the prototype inspects a single order at a time.
  const activeId = useMemo(() => {
    const sorted = [...queue].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return sorted[0]?.id ?? null;
  }, [queue]);

  async function refreshQueue() {
    try {
      const p = await api<Order[]>('/orders?status=CLEANING&take=100');
      setQueue(p);
    } catch {
      /* ignore — SSE will retry */
    }
  }

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = eventStream();
      const onChange = () => { refreshQueue().catch(() => {}); };
      es.addEventListener('order.created', onChange);
      es.addEventListener('order.status', onChange);
      es.addEventListener('order.updated', onChange);
    } catch {/* SSE optional */}
    return () => es?.close();
  }, []);

  // Load the full order (with items) for the active inspection.
  useEffect(() => {
    if (!activeId) {
      setOrder(null);
      setItemState({});
      return;
    }
    let alive = true;
    api<OrderWithItems>(`/orders/${activeId}`)
      .then((o) => {
        if (!alive) return;
        setOrder(o);
        const init: Record<string, ItemState> = {};
        (o.items ?? []).forEach((it) => { init[it.id] = { done: false, flag: null }; });
        setItemState(init);
      })
      .catch(() => { if (alive) setOrder(null); });
    return () => { alive = false; };
  }, [activeId]);

  const items = order?.items ?? [];
  const doneCount = items.filter((it) => itemState[it.id]?.done).length;
  const flagged = items.filter((it) => itemState[it.id]?.flag);

  function toggleDone(id: string) {
    setItemState((s) => ({ ...s, [id]: { done: !s[id]?.done, flag: s[id]?.flag ?? null } }));
  }
  function toggleFlag(id: string, flag: Flag) {
    setItemState((s) => ({
      ...s,
      [id]: { done: s[id]?.done ?? false, flag: s[id]?.flag === flag ? null : flag },
    }));
  }

  async function printTags() {
    if (!order || items.length === 0) return;
    // One label per physical garment: expand each line by its quantity.
    const tags: LabelTag[] = [];
    items.forEach((it) => {
      for (let q = 0; q < it.qty; q += 1) {
        tags.push({ id: it.id, code: it.skuSnapshot, name: it.nameSnapshot });
      }
    });
    const total = tags.length;
    const built: LabelTag[] = tags.map((tag, i) => ({
      ...tag,
      orderNumber: order.number,
      customerName: order.customer?.fullName ?? null,
      index: i + 1,
      total,
    }));
    try {
      await printLabels(built, order.storeId);
      toast.show(t('tagsPrinted'));
    } catch {
      toast.show(t('printFailed'));
    }
  }

  async function complete() {
    if (!order) return;
    setBusy(true);
    try {
      const flaggedNotes = flagged
        .map((it) => `${it.nameSnapshot}: ${itemState[it.id]?.flag} flagged`)
        .join('; ');
      const note = flaggedNotes
        ? `Inspection complete · ${items.length} item(s) · ${flaggedNotes}`
        : `Inspection complete · ${items.length} item(s) · no issues`;
      await api(`/orders/${order.id}/status`, {
        method: 'PATCH',
        body: { status: 'READY', note },
      });
      toast.show(t('completed', { number: order.number }));
      refreshQueue();
    } catch (e: any) {
      toast.show(e?.detail?.message || e?.message || t('completeFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (!order || items.length === 0) {
    return (
      <div className="page">
        <div className="page-head">
          <div className="ph-l">
            <h2>{t('title')}</h2>
            <span className="sub">{t('emptySub')}</span>
          </div>
        </div>
        <div className="muted" style={{ fontSize: 13, padding: 14, textAlign: 'center' }}>
          {t('empty')}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="ph-l">
          <h2>{t('title')}</h2>
          <span className="sub">
            {t('subtitle', {
              number: order.number,
              customer: order.customer?.fullName ?? t('guest'),
              done: doneCount,
              total: items.length,
            })}
          </span>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={printTags}>
            <Icon.print size={16} /> {t('printTags')}
          </button>
          <button
            className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
            onClick={complete}
            disabled={busy}
          >
            {t('complete')}
          </button>
        </div>
      </div>

      <div className="cols-2b">
        <div>
          {items.map((it) => {
            const st = itemState[it.id] ?? { done: false, flag: null };
            return (
              <div key={it.id} className={`insp-item ${st.done ? 'done' : ''}`}>
                <button className="chk" onClick={() => toggleDone(it.id)}>
                  <Icon.check size={16} />
                </button>
                <div className="ii">
                  <b>{it.nameSnapshot}{it.qty > 1 ? ` ×${it.qty}` : ''}</b>
                  <span>{it.tierSnapshot}</span>
                </div>
                <div className="flags">
                  {FLAGS.map((f) => (
                    <button
                      key={f}
                      className={`flagbtn ${st.flag === f ? 'on' : ''}`}
                      onClick={() => toggleFlag(it.id, f)}
                    >
                      {t(`flag.${f}`)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="panel">
          <h3>{t('notesTitle')}</h3>
          <div className="psub">{t('notesSub')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {flagged.length === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>{t('notesEmpty')}</div>
            ) : (
              flagged.map((it) => (
                <div
                  key={it.id}
                  style={{
                    padding: '12px 14px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    fontSize: 13,
                  }}
                >
                  <b style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>
                    {it.nameSnapshot}
                  </b>
                  <br />
                  <span
                    style={{
                      color: 'var(--warn)',
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '.04em',
                    }}
                  >
                    {t('flaggedTag', { flag: t(`flag.${itemState[it.id]!.flag!}`) })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

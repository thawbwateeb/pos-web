'use client';

// Order Requests inbox — ports POS/requests.js. Two-pane master/detail: a left
// list (Open / Handled groups) and a right detail with a method-specific body
// (itemized table, quick/weight facts, colour bags, photo tiles + quote card),
// a conversation thread, a quote form (photo only), a reply composer, and the
// Decline / Accept actions. Wired to the pos-api `/requests` staff endpoints.
//
// The API returns UPPERCASE type/status enums and a `meta` JSON blob; the design
// prototype uses lowercase keys and flat fields. We normalize at read time
// (`.toLowerCase()`) and read body data from `meta`/`photos`/`messages`.

import { useEffect, useState } from 'react';
import { api, eventStream } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { initials, shortTime } from '@/lib/format';
import {
  BAG_HEX,
  PIC,
  STATUS,
  TYPE,
  type ReqStatusKey,
  type ReqTypeKey,
} from './requests-constants';

// requests.js:7 — AED 'AED '+rounded, no decimals unless fractional.
const AED = (n: number): string =>
  'AED ' +
  (Math.round(n * 100) / 100).toLocaleString('en-US', {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });

interface ReqBag {
  // Design (requests.js) shape is { color, name }. The mobile app currently
  // writes { serviceId, qty } into meta.bags, so both may be absent; we read
  // the design fields defensively.
  color?: string;
  name?: string;
}
interface ReqItemLine {
  name: string;
  qty: number;
  price: number;
  service: string;
}
interface ReqMeta {
  bags?: ReqBag[];
  shoeCare?: boolean;
  items?: ReqItemLine[];
  estCount?: number;
  quickService?: string;
  estKg?: number;
  photoNote?: string;
  service?: string;
}
interface ReqMessage {
  from: 'CUSTOMER' | 'STAFF';
  text: string;
  createdAt: string;
}
interface ReqPhoto {
  id: string;
  fileKey: string;
}
interface ReqCustomer {
  id: string;
  fullName: string;
  phone: string;
}

export interface RequestItem {
  id: string;
  number: number;
  type: string; // UPPERCASE enum from API
  status: string; // UPPERCASE enum from API
  delivery: boolean;
  speed?: string | null;
  notes?: string | null;
  meta?: ReqMeta | null;
  quoteTotal?: number | string | null;
  quoteEta?: string | null;
  quoteMessage?: string | null;
  customer: ReqCustomer;
  photos?: ReqPhoto[] | null;
  messages?: ReqMessage[] | null;
  orderId?: string | null;
  createdAt: string;
}

// ─── Normalized accessors (bridge API shape → design shape) ──────────────
const typeKey = (r: RequestItem): ReqTypeKey => r.type.toLowerCase() as ReqTypeKey;
const statusKey = (r: RequestItem): ReqStatusKey =>
  r.status.toLowerCase() as ReqStatusKey;
const isLive = (r: RequestItem): boolean => {
  const s = statusKey(r);
  return s === 'new' || s === 'quoted';
};
const meta = (r: RequestItem): ReqMeta => r.meta ?? {};
const photoCount = (r: RequestItem): number => r.photos?.length ?? 0;
const quotePrice = (r: RequestItem): number | null =>
  r.quoteTotal != null && r.quoteTotal !== ''
    ? typeof r.quoteTotal === 'string'
      ? parseFloat(r.quoteTotal)
      : r.quoteTotal
    : null;
const hasQuote = (r: RequestItem): boolean => quotePrice(r) != null;
// Design reads quick/weight service from a single `service`; the API names it
// `quickService` for quick and `service` for weight. Fall back across both.
const svc = (r: RequestItem): string => meta(r).quickService ?? meta(r).service ?? '';

// requests.js:55-56
function itemCount(r: RequestItem): number {
  const t = typeKey(r);
  if (t === 'itemized') return (meta(r).items ?? []).reduce((s, i) => s + i.qty, 0);
  if (t === 'quick') return meta(r).estCount ?? 0;
  if (t === 'bags') return (meta(r).bags ?? []).length;
  return 0;
}
function knownTotal(r: RequestItem): number | null {
  const q = quotePrice(r);
  if (q != null) return q;
  if (typeKey(r) === 'itemized')
    return (meta(r).items ?? []).reduce((s, i) => s + i.qty * i.price, 0);
  return null;
}

// requests.js:58-65
function summaryLine(r: RequestItem): string {
  const t = typeKey(r);
  if (t === 'itemized') return `${itemCount(r)} items · ${AED(knownTotal(r) ?? 0)}`;
  if (t === 'quick') return `~${meta(r).estCount} items · ${svc(r)}`;
  if (t === 'bags') {
    const bags = meta(r).bags ?? [];
    return `${bags.length} bags · ${bags.map((b) => b.name).join(', ')}`;
  }
  if (t === 'weight') return `~${meta(r).estKg} kg · ${svc(r)}`;
  if (t === 'photo')
    return hasQuote(r)
      ? `Quoted ${AED(quotePrice(r) ?? 0)}`
      : `${photoCount(r)} photos · awaiting quote`;
  return '';
}

// ─── Inline SVG helpers (requests.js:9 `ic`) ─────────────────────────────
function ReqIcon({ paths, size = 18 }: { paths: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: paths }}
    />
  );
}
// requests.js:92 — photo-tile placeholder icon.
const PHOTO_TILE_ICON =
  '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 16l-5-5L5 21"/>';
const NOTE_ICON = '<path d="M3 5h18v11H8l-4 4z"/>';
const SEND_ICON = '<path d="M4 12l16-7-7 16-2-7z"/>';
const ACCEPT_ICON = '<path d="M4 12l5 5L20 6"/>';
const DECLINE_X_ICON = '<path d="M6 6l12 12M18 6 6 18"/>';

const custName = (r: RequestItem): string => r.customer?.fullName || 'App guest';
const custMeta = (r: RequestItem): string =>
  r.customer?.phone || 'New app customer';
const firstName = (r: RequestItem): string => custName(r).split(' ')[0];

// requests.js:92
function PhotoTiles({ n }: { n: number }) {
  return (
    <div className="req-photos">
      {Array.from({ length: n }).map((_, i) => (
        <div className="req-photo" key={i}>
          <ReqIcon paths={PHOTO_TILE_ICON} size={22} />
        </div>
      ))}
    </div>
  );
}

// requests.js:94-103
function BodyFor({ r }: { r: RequestItem }) {
  const t = typeKey(r);
  if (t === 'itemized') {
    const items = meta(r).items ?? [];
    return (
      <table className="req-tbl">
        <thead>
          <tr>
            <th>Item</th>
            <th>Service</th>
            <th className="num">Qty</th>
            <th className="num">Price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i, idx) => (
            <tr key={idx}>
              <td className="t-name">{i.name}</td>
              <td>{i.service}</td>
              <td className="num">{i.qty}</td>
              <td className="num">{AED(i.qty * i.price)}</td>
            </tr>
          ))}
          <tr className="req-tot">
            <td colSpan={3}>Estimated total</td>
            <td className="num">{AED(knownTotal(r) ?? 0)}</td>
          </tr>
        </tbody>
      </table>
    );
  }
  if (t === 'quick') {
    return (
      <div className="req-facts">
        <div>
          <span>Estimated items</span>
          <b>~{meta(r).estCount}</b>
        </div>
        <div>
          <span>Service</span>
          <b>{svc(r)}</b>
        </div>
        <div>
          <span>Pricing</span>
          <b>Counted at facility</b>
        </div>
      </div>
    );
  }
  if (t === 'bags') {
    const bags = meta(r).bags ?? [];
    return (
      <>
        <div className="req-bags">
          {bags.map((b, idx) => {
            const color = b.color ?? '';
            return (
              <div className="req-bag" key={idx}>
                <span
                  className="req-bag-sw"
                  style={{
                    background: BAG_HEX[color] || color,
                    ...(color === 'white'
                      ? { boxShadow: 'inset 0 0 0 1px #CDD2D9' }
                      : {}),
                  }}
                />
                <div>
                  <b>{b.name}</b>
                  <span>{color ? color[0].toUpperCase() + color.slice(1) + ' bag' : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="req-note-sm">Billed after sorting at the facility.</div>
      </>
    );
  }
  if (t === 'weight') {
    return (
      <div className="req-facts">
        <div>
          <span>Estimated weight</span>
          <b>~{meta(r).estKg} kg</b>
        </div>
        <div>
          <span>Service</span>
          <b>{svc(r)}</b>
        </div>
        <div>
          <span>Pricing</span>
          <b>Weighed on arrival</b>
        </div>
      </div>
    );
  }
  if (t === 'photo') {
    const price = quotePrice(r);
    return (
      <>
        <PhotoTiles n={photoCount(r)} />
        {price != null && (
          <div className="req-quote-card">
            <div className="rq-h">Your quote</div>
            <div className="rq-row">
              <span>Price</span>
              <b>{AED(price)}</b>
            </div>
            <div className="rq-row">
              <span>Ready in</span>
              <b>{r.quoteEta}</b>
            </div>
            {r.quoteMessage && <div className="rq-msg">{r.quoteMessage}</div>}
          </div>
        )}
      </>
    );
  }
  return null;
}

// ─── Screen ──────────────────────────────────────────────────────────────
export default function RequestsScreen({ initial }: { initial: RequestItem[] }) {
  const [list, setList] = useState<RequestItem[]>(initial);
  const [selId, setSelId] = useState<string | null>(initial[0]?.id ?? null);
  const [detail, setDetail] = useState<RequestItem | null>(null);
  // Controlled inputs for the quote form + reply composer.
  const [rqPrice, setRqPrice] = useState('');
  const [rqEta, setRqEta] = useState('');
  const [rqMsg, setRqMsg] = useState('');
  const [reply, setReply] = useState('');
  const toast = useToast();

  // Load the selected request's full detail.
  useEffect(() => {
    if (!selId) {
      setDetail(null);
      return;
    }
    api<RequestItem>(`/requests/${selId}`)
      .then(setDetail)
      .catch(() => {});
  }, [selId]);

  // Sync the quote form fields when the detail changes.
  useEffect(() => {
    if (!detail) return;
    const p = quotePrice(detail);
    setRqPrice(p != null ? String(p) : '');
    setRqEta(detail.quoteEta ?? '');
    setRqMsg(detail.quoteMessage ?? '');
    setReply('');
  }, [detail]);

  async function refreshList() {
    try {
      const next = await api<RequestItem[]>('/requests?status=open');
      setList(next);
    } catch {
      /* ignore — SSE will retry */
    }
  }
  async function refreshDetail() {
    if (!selId) return;
    try {
      setDetail(await api<RequestItem>(`/requests/${selId}`));
    } catch {
      /* ignore */
    }
  }
  async function refreshAll() {
    await Promise.all([refreshList(), refreshDetail()]);
  }

  // SSE — refresh on any request change.
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = eventStream();
      const onChange = () => {
        refreshList().catch(() => {});
        refreshDetail().catch(() => {});
      };
      es.addEventListener('request.created', onChange);
      es.addEventListener('request.updated', onChange);
    } catch {
      /* SSE optional */
    }
    return () => es?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);

  async function sendReply() {
    if (!detail) return;
    const v = reply.trim();
    if (!v) return;
    try {
      await api(`/requests/${detail.id}/messages`, { method: 'POST', body: { text: v } });
      setReply('');
      await refreshAll();
    } catch {
      /* ignore */
    }
  }

  async function sendQuote() {
    if (!detail) return;
    const price = +rqPrice || 0;
    if (!price) {
      toast.show('Enter a quote price');
      return;
    }
    const eta = rqEta.trim() || 'TBC';
    const message = rqMsg.trim();
    try {
      await api(`/requests/${detail.id}/quote`, {
        method: 'POST',
        body: { price, eta, ...(message ? { message } : {}) },
      });
      await refreshAll();
      toast.show('Quote sent to customer');
    } catch {
      /* ignore */
    }
  }

  async function accept() {
    if (!detail) return;
    try {
      const res = await api<{ ok: boolean; orderId: string; number: number }>(
        `/requests/${detail.id}/accept`,
        { method: 'POST' },
      );
      await refreshAll();
      toast.show(`Accepted · order #${res.number} created`);
    } catch {
      /* ignore */
    }
  }

  async function decline() {
    if (!detail) return;
    try {
      await api(`/requests/${detail.id}/decline`, { method: 'POST' });
      await refreshAll();
      toast.show('Request declined');
    } catch {
      /* ignore */
    }
  }

  // requests.js:71-72 — Open = new/quoted, Handled = accepted/declined.
  const open = list.filter((r) => isLive(r));
  const done = list.filter((r) => {
    const s = statusKey(r);
    return s === 'accepted' || s === 'declined';
  });

  // requests.js:74-80 — list row.
  const listItem = (r: RequestItem) => {
    const st = STATUS[statusKey(r)];
    const t = typeKey(r);
    return (
      <button
        key={r.id}
        className={`req-item ${r.id === selId ? 'sel' : ''}`}
        data-req={r.id}
        onClick={() => setSelId(r.id)}
      >
        <span className={`req-ico ty-${t}`}>
          <ReqIcon paths={PIC[t]} size={18} />
        </span>
        <span className="req-it">
          <span className="req-it-top">
            <b>{custName(r)}</b>
            <span className="req-time">{shortTime(r.createdAt)}</span>
          </span>
          <span className="req-it-sub">{summaryLine(r)}</span>
          <span className="req-tags">
            <span className="req-type">{TYPE[t].label}</span>
            <span className={`req-badge ${st.cls}`}>{st.txt}</span>
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="req-wrap">
      <div className="req-list">
        <div className="req-list-h">
          Open <span>{open.length}</span>
        </div>
        {open.length ? (
          open.map(listItem)
        ) : (
          <div className="req-empty">No open requests 🎉</div>
        )}
        {done.length > 0 && (
          <>
            <div className="req-list-h" style={{ marginTop: 6 }}>
              Handled <span>{done.length}</span>
            </div>
            {done.map(listItem)}
          </>
        )}
      </div>
      <div className="req-detail">
        {detail ? (
          <Detail
            r={detail}
            rqPrice={rqPrice}
            rqEta={rqEta}
            rqMsg={rqMsg}
            reply={reply}
            setRqPrice={setRqPrice}
            setRqEta={setRqEta}
            setRqMsg={setRqMsg}
            setReply={setReply}
            onSendQuote={sendQuote}
            onSendReply={sendReply}
            onAccept={accept}
            onDecline={decline}
          />
        ) : (
          <div className="req-empty-detail">Select a request to review</div>
        )}
      </div>
    </div>
  );
}

// requests.js:105-141 — detail pane.
function Detail({
  r,
  rqPrice,
  rqEta,
  rqMsg,
  reply,
  setRqPrice,
  setRqEta,
  setRqMsg,
  setReply,
  onSendQuote,
  onSendReply,
  onAccept,
  onDecline,
}: {
  r: RequestItem;
  rqPrice: string;
  rqEta: string;
  rqMsg: string;
  reply: string;
  setRqPrice: (v: string) => void;
  setRqEta: (v: string) => void;
  setRqMsg: (v: string) => void;
  setReply: (v: string) => void;
  onSendQuote: () => void;
  onSendReply: () => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const t = typeKey(r);
  const st = STATUS[statusKey(r)];
  const live = isLive(r);
  const total = knownTotal(r);
  const showQuote = live && TYPE[t].needsQuote;
  const canAccept = live && (!TYPE[t].needsQuote || hasQuote(r));
  const quoted = hasQuote(r);
  const messages = r.messages ?? [];

  return (
    <>
      <div className="req-d-head">
        <span className="odl-av req-d-av">{initials(custName(r))}</span>
        <div className="req-d-id">
          <h3>{custName(r)}</h3>
          <span>{custMeta(r)}</span>
        </div>
        <span className={`req-badge ${st.cls}`}>{st.txt}</span>
      </div>
      <div className="req-d-meta">
        <span className={`req-type ty-${t}-b`}>
          <ReqIcon paths={PIC[t]} size={14} /> {TYPE[t].label}
        </span>
        <span>#{r.number}</span>
        <span>{r.delivery ? 'Pickup & delivery' : 'Drop-off'}</span>
        <span>Submitted {shortTime(r.createdAt)}</span>
      </div>
      {r.notes && (
        <div className="req-custnote">
          <ReqIcon paths={NOTE_ICON} size={15} /> <span>{r.notes}</span>
        </div>
      )}
      <div className="req-d-body">
        <BodyFor r={r} />
      </div>

      <div className="req-thread-h">Conversation</div>
      <div className="req-thread">
        {messages.length ? (
          messages.map((m, idx) => {
            const from = m.from === 'STAFF' ? 'staff' : 'cust';
            return (
              <div className={`req-msg ${from}`} key={idx}>
                <span className="rm-b">{m.text}</span>
                <span className="rm-t">
                  {m.from === 'STAFF' ? 'You' : firstName(r)} · {shortTime(m.createdAt)}
                </span>
              </div>
            );
          })
        ) : (
          <div className="req-note-sm">No messages yet.</div>
        )}
      </div>

      {live ? (
        <>
          {showQuote && (
            <div className="req-quote-form">
              <div className="rqf-h">{quoted ? 'Update quote' : 'Send a quote'}</div>
              <div className="rqf-row">
                <div className="field">
                  <label>Price</label>
                  <div className="setr-field">
                    <input
                      className="input"
                      id="rq-price"
                      type="number"
                      min="0"
                      value={rqPrice}
                      onChange={(e) => setRqPrice(e.target.value)}
                      placeholder="0"
                    />
                    <span className="unit">AED</span>
                  </div>
                </div>
                <div className="field">
                  <label>Ready in</label>
                  <input
                    className="input"
                    id="rq-eta"
                    value={rqEta}
                    onChange={(e) => setRqEta(e.target.value)}
                    placeholder="e.g. 2 days"
                  />
                </div>
              </div>
              <div className="field">
                <label>Message to customer</label>
                <input
                  className="input"
                  id="rq-msg"
                  value={rqMsg}
                  onChange={(e) => setRqMsg(e.target.value)}
                  placeholder="Add a note about the quote…"
                />
              </div>
              <button className="btn btn-pri btn-sm" data-sendquote onClick={onSendQuote}>
                <ReqIcon paths={SEND_ICON} size={15} /> {quoted ? 'Resend quote' : 'Send quote'}
              </button>
            </div>
          )}
          <div className="req-reply">
            <input
              className="input"
              id="req-reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSendReply()}
              placeholder={`Reply to ${firstName(r)}…`}
            />
            <button className="btn btn-ghost btn-sm" data-reply onClick={onSendReply}>
              Send
            </button>
          </div>
          <div className="req-actions">
            <button className="btn btn-ghost req-decline" data-decline onClick={onDecline}>
              Decline
            </button>
            <button
              className="btn btn-pri"
              data-accept
              disabled={!canAccept}
              onClick={onAccept}
            >
              <ReqIcon paths={ACCEPT_ICON} size={16} /> Accept
              {total !== null ? ` · ${AED(total)}` : ''} → create order
            </button>
          </div>
          {!canAccept && (
            <div className="req-hint">Send a quote before accepting this request.</div>
          )}
        </>
      ) : (
        <>
          <div className="req-resolved">
            {statusKey(r) === 'accepted' ? (
              <>
                <ReqIcon paths={ACCEPT_ICON} size={16} /> Accepted — order{' '}
                <b>#{r.orderId}</b> created on the board
              </>
            ) : (
              <>
                <ReqIcon paths={DECLINE_X_ICON} size={16} /> Request declined
              </>
            )}
          </div>
          <div className="req-reply">
            <input
              className="input"
              id="req-reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSendReply()}
              placeholder="Message the customer…"
            />
            <button className="btn btn-ghost btn-sm" data-reply onClick={onSendReply}>
              Send
            </button>
          </div>
        </>
      )}
    </>
  );
}

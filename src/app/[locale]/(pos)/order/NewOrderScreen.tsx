'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/Icons';
import GarmentIcon from '@/components/GarmentIcon';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api-client';
import { AED, initials } from '@/lib/format';
import type { MetaResponse } from '@/lib/meta-context';
import type { Bootstrap, CatalogueResponse, Customer, Order, OrderType, PaymentMethod, Promo } from '@/lib/types';
import { enqueuePrintJob } from '@/lib/print';

interface CartLine {
  key: string;
  itemId: string;
  tierId: string;
  sku: string;
  name: string;
  tierName: string;
  qty: number;
  unitPrice: number;
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  cash: Icon.cash, card: Icon.card, apple: Icon.apple, wallet: Icon.wallet, truck: Icon.truck, gift: Icon.gift,
};

export default function NewOrderScreen({
  catalogue,
  meta,
  bootstrap,
  promos,
  editing,
}: {
  catalogue: CatalogueResponse;
  meta: MetaResponse;
  bootstrap: Bootstrap;
  promos: Promo[];
  editing?: Order | null;
}) {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? 'en';
  const toast = useToast();
  const storeId = bootstrap.activeStoreId;
  const t = useTranslations('Order');
  const tCommon = useTranslations('Common');
  const tMethod = useTranslations('PaymentMethod');
  const tMethodSub = useTranslations('PaymentMethodSub');

  const tiers = catalogue.tiers;
  const isEditing = !!editing;

  const allItems = useMemo(
    () =>
      catalogue.categories.flatMap((c) =>
        c.items.map((it) => ({ ...it, categoryId: c.id, categoryKey: c.externalKey, categoryTitle: c.title })),
      ),
    [catalogue],
  );

  // Seed initial state from `editing` order so the user lands directly in
  // the populated cart. Tier defaults to the first tier present on the
  // first line; if mixed tiers, the lines retain their own.
  const initialCart: CartLine[] = useMemo(() => {
    if (!editing?.items) return [];
    return editing.items.map((it) => {
      const item = allItems.find((a) => a.sku === it.skuSnapshot);
      const tier = tiers.find((tt) => tt.name === it.tierSnapshot);
      const tierId = tier?.id ?? (item ? Object.keys(item.prices)[0] : '');
      const itemId = item?.id ?? '';
      return {
        key: `${itemId || it.skuSnapshot}__${tierId}`,
        itemId,
        tierId,
        sku: it.skuSnapshot,
        name: it.nameSnapshot,
        tierName: it.tierSnapshot,
        qty: it.qty,
        unitPrice: Number(it.unitPrice),
      };
    });
  }, [editing, allItems, tiers]);

  const [tierKey, setTierKey] = useState<string>(tiers[0]?.externalKey ?? '');
  const [cat, setCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [orderType, setOrderType] = useState<OrderType>(editing?.type ?? 'WALK_IN');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [custPicker, setCustPicker] = useState(false);
  const [cart, setCart] = useState<CartLine[]>(initialCart);
  const [expressOn, setExpressOn] = useState<boolean>(editing?.expressOn ?? false);
  const [appliedPromo, setAppliedPromo] = useState<Promo | null>(null);
  const [promoPicker, setPromoPicker] = useState(false);
  const [pay, setPay] = useState<{ method: PaymentMethod | null; cashGiven?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [waBusy, setWaBusy] = useState(false);

  // When editing, hydrate the existing customer + applied promo by fetching.
  useEffect(() => {
    if (!editing) return;
    if (editing.customerId) {
      api<Customer>(`/customers/${editing.customerId}`).then(setCustomer).catch(() => {});
    }
    if (editing.discountCode) {
      const p = promos.find((pp) => pp.code === editing.discountCode);
      if (p) setAppliedPromo(p);
    }
  }, [editing, promos]);

  const tier = tiers.find((tt) => tt.externalKey === tierKey);
  const visibleItems = allItems.filter((it) => {
    if (cat !== 'all' && it.categoryKey !== cat) return false;
    if (search && !it.name.toLowerCase().includes(search.toLowerCase()) && !it.sku.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ─── Totals: subtotal → +express → −discount → +tax = grand ──────────
  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const expressPct = 30; // express surcharge % — move to business settings later
  const expressAmount = expressOn ? +(subtotal * (expressPct / 100)).toFixed(2) : 0;
  const discountAmount = appliedPromo
    ? appliedPromo.kind === 'PERCENT'
      ? +(subtotal * (Number(appliedPromo.value) / 100)).toFixed(2)
      : Number(appliedPromo.value)
    : 0;
  const taxRate = Number(bootstrap.business.tax?.rate ?? 0);
  const taxEnabled = bootstrap.business.tax?.enabled ?? false;
  const taxableBase = subtotal + expressAmount - discountAmount;
  const tax = taxEnabled ? +(taxableBase * (taxRate / 100)).toFixed(2) : 0;
  const total = +(taxableBase + tax).toFixed(2);
  const currency = bootstrap.business.branding?.currency ?? 'AED';

  function addToCart(item: typeof allItems[number]) {
    const price = tier ? item.prices[tier.externalKey] : undefined;
    if (price == null || !tier) return;
    const key = `${item.id}__${tier.id}`;
    setCart((cur) => {
      const ex = cur.find((l) => l.key === key);
      if (ex) return cur.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [...cur, { key, itemId: item.id, tierId: tier.id, sku: item.sku, name: item.name, tierName: tier.name, qty: 1, unitPrice: price }];
    });
  }

  function setQty(key: string, qty: number) {
    setCart((cur) => cur.flatMap((l) => (l.key !== key ? [l] : qty <= 0 ? [] : [{ ...l, qty }])));
  }

  function resetCart() {
    setCart([]);
    setCustomer(null);
    setExpressOn(false);
    setAppliedPromo(null);
    setOrderType('WALK_IN');
  }

  function requestCancel() {
    if (!cart.length) return;
    setCancelConfirmOpen(true);
  }

  function confirmCancel() {
    setCancelConfirmOpen(false);
    resetCart();
    if (isEditing) {
      router.push(`/${locale}/order`);
    }
    toast.show(t('cancelled'));
  }

  async function printReceipt() {
    // Can only print after an order exists. When creating a new order, the
    // receipt is printed by the backend's payment → printer pipeline at
    // charge time. So this button only acts on existing (editing) orders.
    if (!editing) {
      toast.show(t('printAfterCharge'));
      return;
    }
    try {
      await enqueuePrintJob({ type: 'RECEIPT', orderId: editing.id, storeId });
      toast.show(t('receiptQueued', { number: editing.number }));
    } catch (err: any) {
      toast.show(err?.detail?.message || t('receiptFailed'));
    }
  }

  async function save() {
    if (!editing) return;
    if (!customer) { toast.show(t('customerRequired')); setCustPicker(true); return; }
    setBusy(true);
    try {
      const r = await api<any>(`/orders/${editing.id}`, {
        method: 'PATCH',
        storeId,
        body: {
          type: orderType,
          customerId: customer?.id ?? null,
          expressOn,
          expressPct,
          promoCode: appliedPromo?.code ?? null,
          items: cart.map((l) => ({ itemId: l.itemId, tierId: l.tierId, qty: l.qty })),
        },
      });
      toast.show(t('orderUpdated', { number: r.number }));
      router.push(`/${locale}/orders`);
    } catch (e: any) {
      toast.show(e?.detail?.message || t('couldNotUpdate'));
    } finally {
      setBusy(false);
    }
  }

  async function charge() {
    if (!customer) { toast.show(t('customerRequired')); setCustPicker(true); return; }
    if (!pay?.method) return toast.show(t('pickPaymentMethod'));
    setBusy(true);
    try {
      const order = await api<any>('/orders', {
        method: 'POST',
        storeId,
        body: {
          storeId,
          type: orderType,
          customerId: customer?.id,
          expressOn,
          expressPct,
          promoCode: appliedPromo?.code,
          items: cart.map((l) => ({ itemId: l.itemId, tierId: l.tierId, qty: l.qty })),
        },
      });
      // ON_DELIVERY = cash-on-delivery (or postpaid). The order is queued
      // unpaid and the driver collects payment when the order is handed
      // over — at which point a Payment row is created from the Delivery
      // screen. Recording a Payment here would falsely mark the order
      // paid before the customer has actually paid.
      if (pay.method === 'ON_DELIVERY') {
        toast.show(t('orderQueuedCOD', { number: order.number, amount: AED(order.total) }));
      } else {
        await api('/payments', { method: 'POST', body: { orderId: order.id, method: pay.method, amount: Number(order.total) } });
        toast.show(t('orderCharged', { number: order.number, amount: AED(order.total) }));
      }
      resetCart();
      setPay(null);
      router.push(`/${locale}/orders`);
    } catch (e: any) {
      toast.show(e?.detail?.message || t('couldNotCreate'));
    } finally { setBusy(false); }
  }

  // Send the customer a WhatsApp payment link. We don't have a payment-link
  // service yet; for parity with the design's behavior (which just toasts),
  // we create the order in PENDING state, build a wa.me deeplink, open it,
  // and toast. The shop staff finishes the conversation in WhatsApp.
  async function sendWhatsappLink() {
    if (!customer || !customer.phone) {
      toast.show(t('waNoCustomer'));
      return;
    }
    setWaBusy(true);
    try {
      const order = await api<any>('/orders', {
        method: 'POST',
        storeId,
        body: {
          storeId,
          type: orderType,
          customerId: customer.id,
          expressOn,
          expressPct,
          promoCode: appliedPromo?.code,
          items: cart.map((l) => ({ itemId: l.itemId, tierId: l.tierId, qty: l.qty })),
        },
      });
      const text = encodeURIComponent(
        `Hi ${customer.fullName.split(' ')[0]}, your order #${order.number} from ${bootstrap.business.name} is ready for payment: ${currency} ${Number(order.total).toFixed(2)}.`,
      );
      const phone = customer.phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener');
      toast.show(t('waLinkSent', { name: customer.fullName }));
      resetCart();
      setPay(null);
      router.push(`/${locale}/orders`);
    } catch (e: any) {
      toast.show(e?.detail?.message || t('couldNotCreate'));
    } finally {
      setWaBusy(false);
    }
  }

  return (
    <div className="order-grid">
      {/* PICKER — design app.js:338-345. */}
      <div className="picker">
        <div className="tier-tabs">
          {tiers.map((tt) => (
            <button
              key={tt.id}
              className={`tier-tab${tierKey === tt.externalKey ? ' active' : ''}`}
              data-tier={tt.id}
              onClick={() => setTierKey(tt.externalKey)}
            >
              <span className="tt">{tt.name}</span>
            </button>
          ))}
        </div>

        <div className="cat-bar">
          {/* Design app.js:333 — "All" is active only when cat='all' AND no search. */}
          <button
            className={`cat${cat === 'all' && !search ? ' active' : ''}`}
            data-cat="all"
            onClick={() => { setCat('all'); setSearch(''); }}
          >
            {tCommon('all')}
          </button>
          {catalogue.categories.map((c) => (
            <button
              key={c.id}
              className={`cat${cat === c.externalKey && !search ? ' active' : ''}`}
              data-cat={c.id}
              onClick={() => { setCat(c.externalKey); setSearch(''); }}
            >
              {c.title}
            </button>
          ))}
          <div className="pk-search">
            <Icon.search size={15} />
            {/* Design app.js:343 — placeholder is "Search item…" + id="pk-search". */}
            <input
              id="pk-search"
              placeholder={t('searchItem')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Design app.js:345 — id="item-grid". Empty state copied verbatim
            from renderItems line 369: <div class="empty-state"
            style="grid-column:1/-1"><span class="serif">No items</span>
            Try another search.</div> — note the second line is plain
            text, not a <p>. */}
        <div className="item-grid" id="item-grid">
          {visibleItems.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <span className="serif">{t('noItems')}</span>
              {t('tryAnotherSearch')}
            </div>
          )}
          {visibleItems.map((item) => {
            const price = tier ? item.prices[tier.externalKey] : undefined;
            const unavail = price == null;
            const qtyInCart = cart.filter((l) => l.itemId === item.id && (tier ? l.tierId === tier.id : true)).reduce((s, l) => s + l.qty, 0);
            if (unavail) {
              return (
                <div key={item.id} className="item-card unavail">
                  <div className="ic-ico"><GarmentIcon name={item.name} size={28} /></div>
                  <div className="ic-name">{item.name}</div>
                  <div className="ic-price"><span>{t('notInTier')}</span></div>
                </div>
              );
            }
            return (
              <button key={item.id} className="item-card" data-sku={item.sku} onClick={() => addToCart(item)}>
                {qtyInCart > 0
                  ? <span className="ic-qty">{qtyInCart}</span>
                  : <span className="ic-add"><Icon.plus size={15} /></span>}
                <div className="ic-ico"><GarmentIcon name={item.name} size={28} /></div>
                <div className="ic-name">{item.name}</div>
                <div className="ic-price"><b>{Number(price).toFixed(2)}</b><span>{currency}</span></div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CART — design app.js:347 + 427. */}
      <aside className="cart" id="cart">
        <div className="cart-head">
          <div className="row1">
            <div>
              <div className="onum">
                {isEditing ? `#${editing!.number}` : `#${(bootstrap.business as any).nextOrderNumber ?? ''}`}
              </div>
              <span className="otype">
                {/* Design app.js:430 — uses t.count which sums qty across
                    lines (count: state.cart.reduce((s,l)=>s+l.qty,0)),
                    NOT cart.length (distinct line count). */}
                {isEditing
                  ? t('detailingOrder')
                  : (() => {
                      const totalQty = cart.reduce((s, l) => s + l.qty, 0);
                      return totalQty === 1
                        ? `1 ${tCommon('item').toLowerCase()}`
                        : `${totalQty} ${tCommon('items').toLowerCase()}`;
                    })()}
              </span>
            </div>
            <div className="otype-toggle">
              <button className={orderType === 'WALK_IN' ? 'on' : ''} data-otype="Walk-in" onClick={() => setOrderType('WALK_IN')}>{t('walkIn')}</button>
              <button className={orderType === 'PICKUP_DELIVERY' ? 'on' : ''} data-otype="Pickup & Delivery" onClick={() => setOrderType('PICKUP_DELIVERY')}>{t('pickupDelivery')}</button>
            </div>
          </div>

          <button className={`exp-toggle${expressOn ? ' on' : ''}`} id="exp-toggle" onClick={() => setExpressOn((v) => !v)}>
            <span>{t('expressLabel', { pct: expressPct })}</span>
            <span className={`switch${expressOn ? ' on' : ''}`} />
          </button>

          {/* Design app.js:436-440 — .cust-attach spans + RIGHT chevron
              (path "M9 6l6 6-6 6"), NOT Icon.chevd's down chevron. */}
          <button
            className={`cust-attach${customer ? '' : ' required'}`}
            id="cust-attach"
            onClick={() => setCustPicker(true)}
            title={customer ? customer.fullName : t('customerRequired')}
          >
            <span className="av">{customer ? customer.fullName[0] : <Icon.users size={18} />}</span>
            <span className="ct">
              <b>{customer ? customer.fullName : t('attachCustomer')}</b>
              <span>{customer ? customer.phone : t('customerRequiredHint')}</span>
            </span>
            <span className="chev">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </button>
        </div>

        <div className="cart-lines">
          {cart.length === 0 ? (
            <div className="cart-empty">
              <Icon.bag size={46} />
              {/* Design app.js:425 — text "Empty order" + p with the
                  "Pick a service tier, then tap items to add them." line. */}
              <span className="serif">{t('emptyCart')}</span>
              <p>{t('emptyCartHint')}</p>
            </div>
          ) : (
            cart.map((l, i) => {
              /* Design app.js:421-422 — .tr shows "{tier.short} · {unit} ea";
                 .qty buttons carry data-dec="${i}" / data-inc="${i}". */
              const tierShort = tiers.find((tt) => tt.id === l.tierId)?.short ?? l.tierName;
              return (
                <div key={l.key} className="cline">
                  <div className="ci">
                    <div className="nm">{l.name}</div>
                    <div className="tr">{tierShort} · {l.unitPrice.toFixed(2)} ea</div>
                  </div>
                  <div className="qty">
                    <button data-dec={i} onClick={() => setQty(l.key, l.qty - 1)}>−</button>
                    <span className="n">{l.qty}</span>
                    <button data-inc={i} onClick={() => setQty(l.key, l.qty + 1)}>+</button>
                  </div>
                  <div className="lp">{(l.unitPrice * l.qty).toFixed(2)}</div>
                </div>
              );
            })
          )}
        </div>

        <div className="cart-foot">
          <div style={{ marginBottom: 12 }}>
            {appliedPromo ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', background: 'var(--ok-soft)', border: '1px solid rgba(22,163,74,.25)', borderRadius: 'var(--r-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Icon.ticket size={16} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ok)' }}>{appliedPromo.code}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{t('applied')}</span>
                </div>
                <button id="rm-promo" onClick={() => setAppliedPromo(null)} style={{ width: 24, height: 24, borderRadius: '50%', background: '#fff', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>×</button>
              </div>
            ) : (
              <button id="add-promo" onClick={() => setPromoPicker(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, border: '1px dashed var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--accent)', fontSize: 12.5, fontWeight: 600, background: 'var(--surface-2)' }}>
                <Icon.ticket size={16} /> {t('addPromo')}
              </button>
            )}
          </div>

          {/* Design app.js:452-458 — .tr is plain text + <b>, no <span>
              wrapper around the label. .grand has .gl + .gv (cur + amount). */}
          <div className="totals">
            <div className="tr">{tCommon('subtotal')} <b>{AED(subtotal)}</b></div>
            {discountAmount > 0 && (
              <div className="tr">{tCommon('discount')} ({appliedPromo?.code}) <b style={{ color: 'var(--ok)' }}>−{AED(discountAmount)}</b></div>
            )}
            {expressAmount > 0 && (
              <div className="tr">{t('expressShort', { pct: expressPct })} <b>{AED(expressAmount)}</b></div>
            )}
            {taxEnabled && (
              <div className="tr">{bootstrap.business.tax?.label ?? tCommon('vat')} ({taxRate}%) <b>{AED(tax)}</b></div>
            )}
            <div className="grand">
              <span className="gl">{tCommon('total')}</span>
              {/* Design app.js:457 — <span class="cur">AED</span> SPACE outside, then total. */}
              <span className="gv"><span className="cur">{currency}</span> {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Design app.js:459-463 — ids print-btn, hold-btn, charge-btn. */}
          <div className="cart-actions">
            <button className="btn btn-hold" id="print-btn" title={t('printReceipt')} onClick={printReceipt}>
              <Icon.print size={16} />
            </button>
            <button className="btn btn-hold" id="hold-btn" onClick={requestCancel}>{tCommon('cancel')}</button>
            {isEditing ? (
              <button className={`btn btn-charge${busy ? ' btn-loading' : ''}`} id="charge-btn" disabled={cart.length === 0 || busy} onClick={save}>
                {t('saveOrder')}
              </button>
            ) : (
              <button className="btn btn-charge" id="charge-btn" disabled={cart.length === 0} onClick={() => setPay({ method: null })}>
                {t('charge')} {AED(total)}
              </button>
            )}
          </div>
        </div>
      </aside>

      {pay && (
        <PayModal
          total={total}
          currency={currency}
          methods={meta.paymentMethods}
          method={pay.method}
          cashGiven={pay.cashGiven}
          busy={busy}
          waBusy={waBusy}
          hasCustomer={!!customer}
          onSetMethod={(method) => setPay({ method, cashGiven: pay.cashGiven })}
          onSetCash={(cashGiven) => setPay({ method: pay.method, cashGiven })}
          tCharge={t('chargeLabel')}
          tTitle={t('takePayment')}
          tCancel={tCommon('cancel')}
          tConfirm={t('chargeReceipt')}
          tCashGiven={t('cashGiven')}
          tChange={t('change')}
          tSendWa={t('sendWaLink')}
          methodLabel={(k) => tMethod(k as any)}
          methodSub={(k) => tMethodSub(k as any)}
          onClose={() => setPay(null)}
          onCharge={charge}
          onSendWa={sendWhatsappLink}
        />
      )}

      {custPicker && (
        <CustomerPicker
          onClose={() => setCustPicker(false)}
          onPick={(c) => { setCustomer(c); setCustPicker(false); }}
        />
      )}

      {promoPicker && (
        <PromoPicker
          promos={promos}
          onClose={() => setPromoPicker(false)}
          onApply={(p) => { setAppliedPromo(p); setPromoPicker(false); toast.show(t('promoApplied', { code: p.code })); }}
        />
      )}

      {cancelConfirmOpen && (
        <div className="modal-scrim show" onClick={() => setCancelConfirmOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t('cancelTitle')}</h3>
              <button className="x" onClick={() => setCancelConfirmOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ padding: '8px 12px', fontSize: 14, color: 'var(--muted)' }}>{t('cancelBody')}</p>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setCancelConfirmOpen(false)}>{t('keepEditing')}</button>
              <button className="btn btn-pri" style={{ flex: 1 }} onClick={confirmCancel}>{t('discardOrder')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function PayModal({
  total, currency, methods, method, cashGiven, busy, waBusy, hasCustomer,
  tCharge, tTitle, tCancel, tConfirm, tCashGiven, tChange, tSendWa,
  methodLabel, methodSub,
  onSetMethod, onSetCash, onClose, onCharge, onSendWa,
}: {
  total: number; currency: string;
  methods: { key: string; icon: string }[];
  method: PaymentMethod | null; cashGiven?: number; busy: boolean; waBusy: boolean;
  hasCustomer: boolean;
  tCharge: string; tTitle: string; tCancel: string; tConfirm: string;
  tCashGiven: string; tChange: string; tSendWa: string;
  methodLabel: (k: string) => string; methodSub: (k: string) => string;
  onSetMethod: (m: PaymentMethod) => void;
  onSetCash: (n: number | undefined) => void;
  onClose: () => void; onCharge: () => void; onSendWa: () => void;
}) {
  const change = method === 'CASH' && cashGiven != null ? Math.max(0, cashGiven - total) : 0;

  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{tTitle}</h3><button className="x" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="pay-amount">
            <div className="pl">{tCharge}</div>
            <div className="pv"><span className="cur">{currency} </span>{total.toFixed(2)}</div>
          </div>
          <div className="pay-methods">
            {methods.map((m) => {
              const Ic = ICON_MAP[m.icon] ?? Icon.card;
              return (
                <button key={m.key} className={`pay-m${method === m.key ? ' sel' : ''}`} onClick={() => onSetMethod(m.key as PaymentMethod)}>
                  <Ic />
                  <div><b>{methodLabel(m.key)}</b><span>{methodSub(m.key)}</span></div>
                </button>
              );
            })}
          </div>

          {method === 'CASH' && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div className="field" style={{ marginBottom: 8 }}>
                <label>{tCashGiven}</label>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  autoFocus
                  placeholder="0.00"
                  value={cashGiven ?? ''}
                  onChange={(e) => onSetCash(e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
              {cashGiven != null && cashGiven >= total && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--muted)' }}>{tChange}</span>
                  <b style={{ color: 'var(--ok)' }}>{currency} {change.toFixed(2)}</b>
                </div>
              )}
            </div>
          )}

          {/* WhatsApp payment link — matches design app.js:931. Disabled
              without a customer attached. */}
          <button
            type="button"
            className={`btn btn-ghost${waBusy ? ' btn-loading' : ''}`}
            disabled={!hasCustomer || waBusy}
            onClick={onSendWa}
            style={{ marginTop: 14, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            title={!hasCustomer ? 'Attach a customer first' : tSendWa}
          >
            <Icon.whatsapp size={16} />
            {tSendWa}
          </button>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{tCancel}</button>
          <button
            className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
            style={{ flex: 2 }}
            onClick={onCharge}
            disabled={busy || !method || (method === 'CASH' && (cashGiven ?? 0) < total)}
          >
            {tConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerPicker({ onClose, onPick }: { onClose: () => void; onPick: (c: Customer) => void }) {
  const t = useTranslations('Order');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  async function search(text: string) {
    setQ(text);
    if (!text.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const r = await api<Customer[]>(`/customers?q=${encodeURIComponent(text)}&take=20`);
      setResults(r);
    } finally { setLoading(false); }
  }

  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{t('findCustomer')}</h3><button className="x" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="field"><input className="input" placeholder={t('searchByNameOrPhone')} autoFocus value={q} onChange={(e) => search(e.target.value)} /></div>
          <div>
            {loading && <div className="muted" style={{ padding: 8, fontSize: 12 }}>{t('searching')}</div>}
            {results.map((c) => (
              <button key={c.id} className="pickrow" onClick={() => onPick(c)}>
                <b style={{ fontWeight: 600 }}>{c.fullName}</b>
                <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 'auto' }}>{c.phone}</span>
              </button>
            ))}
            {!loading && q && results.length === 0 && <div className="muted" style={{ fontSize: 12, padding: 8 }}>—</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PromoPicker({ promos, onClose, onApply }: { promos: Promo[]; onClose: () => void; onApply: (p: Promo) => void }) {
  const t = useTranslations('Order');
  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{t('applyPromo')}</h3><button className="x" onClick={onClose}>×</button></div>
        <div className="modal-body">
          {promos.length === 0 ? (
            <div className="muted" style={{ fontSize: 13, padding: 8 }}>{t('noPromos')}</div>
          ) : (
            promos.map((p) => (
              <button key={p.id} className="role-opt" onClick={() => onApply(p)}>
                <span className="rav">{p.kind === 'PERCENT' ? `${p.value}%` : p.value}</span>
                <div className="ri">
                  <b>{p.code}</b>
                  <span>{p.description ?? '—'}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

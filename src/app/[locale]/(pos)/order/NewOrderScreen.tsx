'use client';

import { useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api-client';
import { AED, initials } from '@/lib/format';
import type { MetaResponse } from '@/lib/meta-context';
import type { Bootstrap, CatalogueResponse, Customer, OrderType, PaymentMethod } from '@/lib/types';

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
}: {
  catalogue: CatalogueResponse;
  meta: MetaResponse;
  bootstrap: Bootstrap;
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
  const [tierKey, setTierKey] = useState<string>(tiers[0]?.externalKey ?? '');
  const [cat, setCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('WALK_IN');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [custPicker, setCustPicker] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pay, setPay] = useState<{ method: PaymentMethod | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const allItems = useMemo(
    () =>
      catalogue.categories.flatMap((c) =>
        c.items.map((it) => ({ ...it, categoryId: c.id, categoryKey: c.externalKey, categoryTitle: c.title })),
      ),
    [catalogue],
  );

  const tier = tiers.find((tt) => tt.externalKey === tierKey);
  const visibleItems = allItems.filter((it) => {
    if (cat !== 'all' && it.categoryKey !== cat) return false;
    if (search && !it.name.toLowerCase().includes(search.toLowerCase()) && !it.sku.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const taxRate = Number(bootstrap.business.tax?.rate ?? 0);
  const taxEnabled = bootstrap.business.tax?.enabled ?? false;
  const tax = taxEnabled ? +(subtotal * (taxRate / 100)).toFixed(2) : 0;
  const total = subtotal + tax;

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

  async function charge() {
    if (!pay?.method) return toast.show(t('pickPaymentMethod'));
    setBusy(true);
    try {
      const order = await api<any>('/orders', {
        method: 'POST',
        storeId,
        body: { storeId, type: orderType, customerId: customer?.id, items: cart.map((l) => ({ itemId: l.itemId, tierId: l.tierId, qty: l.qty })) },
      });
      await api('/payments', { method: 'POST', body: { orderId: order.id, method: pay.method, amount: Number(order.total) } });
      toast.show(t('orderCharged', { number: order.number, amount: AED(order.total) }));
      setCart([]); setCustomer(null); setPay(null);
      router.push(`/${locale}/orders`);
    } catch (e: any) {
      toast.show(e?.detail?.message || t('couldNotCreate'));
    } finally { setBusy(false); }
  }

  return (
    <div className="order-grid">
      <div className="picker">
        <div className="tier-tabs">
          {tiers.map((tt) => (
            <button key={tt.id} className={`tier-tab${tierKey === tt.externalKey ? ' active' : ''}`} onClick={() => setTierKey(tt.externalKey)}>
              <div>
                <div className="tt">{tt.name}</div>
                <div className="ts">{tt.short}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="cat-bar">
          <button className={`cat${cat === 'all' ? ' active' : ''}`} onClick={() => setCat('all')}>{tCommon('all')}</button>
          {catalogue.categories.map((c) => (
            <button key={c.id} className={`cat${cat === c.externalKey ? ' active' : ''}`} onClick={() => setCat(c.externalKey)}>
              {c.title}
            </button>
          ))}
          <div className="pk-search">
            <Icon.search size={14} />
            <input placeholder={t('findItem')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="item-grid">
          {visibleItems.map((item) => {
            const price = tier ? item.prices[tier.externalKey] : undefined;
            const unavail = price == null;
            const qtyInCart = cart.filter((l) => l.itemId === item.id && (tier ? l.tierId === tier.id : true)).reduce((s, l) => s + l.qty, 0);
            return (
              <button key={item.id} className={`item-card${unavail ? ' unavail' : ''}`} disabled={unavail} onClick={() => addToCart(item)}>
                <Icon.hanger size={28} className="ic-ico" />
                <div className="ic-name">{item.name}</div>
                <div className="ic-price">
                  {unavail ? <b style={{ fontSize: 11, color: 'var(--faint)' }}>—</b> : (
                    <>
                      <b>{Number(price).toFixed(price! % 1 ? 2 : 0)}</b>
                      <span>{bootstrap.business.branding?.currency ?? 'AED'}</span>
                    </>
                  )}
                </div>
                {qtyInCart > 0 ? <span className="ic-qty">{qtyInCart}</span> : <span className="ic-add"><Icon.plus size={14} /></span>}
              </button>
            );
          })}
        </div>
      </div>

      <aside className="cart">
        <div className="cart-head">
          <div className="row1">
            <div>
              <div className="onum">{t('newOrder')}</div>
              <div className="otype">{cart.length === 1 ? `1 ${tCommon('item').toLowerCase()}` : `${cart.length} ${tCommon('items').toLowerCase()}`}</div>
            </div>
            <div className="otype-toggle">
              <button className={orderType === 'WALK_IN' ? 'on' : ''} onClick={() => setOrderType('WALK_IN')}>{t('walkIn')}</button>
              <button className={orderType === 'PICKUP_DELIVERY' ? 'on' : ''} onClick={() => setOrderType('PICKUP_DELIVERY')}>{t('pickupDelivery')}</button>
            </div>
          </div>
          <button className="cust-attach" onClick={() => setCustPicker(true)}>
            <div className="av">{customer ? initials(customer.fullName) : '+'}</div>
            <div className="ct">
              <b>{customer ? customer.fullName : t('addCustomer')}</b>
              <span>{customer ? customer.phone : t('checkoutAsGuest')}</span>
            </div>
            <Icon.chevd size={14} className="chev" />
          </button>
        </div>

        <div className="cart-lines">
          {cart.length === 0 ? (
            <div className="cart-empty">
              <Icon.bag size={42} />
              <div className="serif">{t('emptyCart')}</div>
              <p>{t('emptyCartHint')}</p>
            </div>
          ) : (
            cart.map((l) => (
              <div key={l.key} className="cline">
                <div className="ci">
                  <div className="nm">{l.name}</div>
                  <div className="tr">{l.tierName} · {AED(l.unitPrice)}</div>
                </div>
                <div className="qty">
                  <button onClick={() => setQty(l.key, l.qty - 1)}>−</button>
                  <div className="n">{l.qty}</div>
                  <button onClick={() => setQty(l.key, l.qty + 1)}>+</button>
                </div>
                <div className="lp">{AED(l.unitPrice * l.qty)}</div>
              </div>
            ))
          )}
        </div>

        <div className="cart-foot">
          <div className="totals">
            <div className="tr"><span>{tCommon('subtotal')}</span><b>{AED(subtotal)}</b></div>
            {taxEnabled && <div className="tr"><span>{bootstrap.business.tax?.label ?? tCommon('vat')} {taxRate}%</span><b>{AED(tax)}</b></div>}
            <div className="grand">
              <span className="gl">{tCommon('total')}</span>
              <span className="gv"><span className="cur">{bootstrap.business.branding?.currency ?? 'AED'} </span>{total.toFixed(2)}</span>
            </div>
          </div>
          <div className="cart-actions">
            <button className="btn btn-hold">{t('hold')}</button>
            <button className="btn btn-charge" disabled={cart.length === 0} onClick={() => setPay({ method: null })}>
              {t('charge')} {AED(total)}
            </button>
          </div>
        </div>
      </aside>

      {pay && (
        <PayModal
          total={total}
          currency={bootstrap.business.branding?.currency ?? 'AED'}
          methods={meta.paymentMethods}
          method={pay.method}
          busy={busy}
          tCharge={t('chargeLabel')}
          tTitle={t('takePayment')}
          tCancel={tCommon('cancel')}
          tConfirm={t('chargeReceipt')}
          methodLabel={(k) => tMethod(k as any)}
          methodSub={(k) => tMethodSub(k as any)}
          onClose={() => setPay(null)}
          onConfirm={(method) => setPay({ method })}
          onCharge={charge}
        />
      )}

      {custPicker && (
        <CustomerPicker
          onClose={() => setCustPicker(false)}
          onPick={(c) => { setCustomer(c); setCustPicker(false); }}
        />
      )}
    </div>
  );
}

function PayModal({
  total, currency, methods, method, busy, tCharge, tTitle, tCancel, tConfirm, methodLabel, methodSub,
  onClose, onConfirm, onCharge,
}: {
  total: number; currency: string;
  methods: { key: string; icon: string }[];
  method: PaymentMethod | null; busy: boolean;
  tCharge: string; tTitle: string; tCancel: string; tConfirm: string;
  methodLabel: (k: string) => string; methodSub: (k: string) => string;
  onClose: () => void; onConfirm: (m: PaymentMethod) => void; onCharge: () => void;
}) {
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
                <button key={m.key} className={`pay-m${method === m.key ? ' sel' : ''}`} onClick={() => onConfirm(m.key as PaymentMethod)}>
                  <Ic />
                  <div><b>{methodLabel(m.key)}</b><span>{methodSub(m.key)}</span></div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{tCancel}</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={onCharge} disabled={busy || !method}>
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
            {!loading && q && results.length === 0 && (
              <div className="muted" style={{ fontSize: 12, padding: 8 }}>—</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

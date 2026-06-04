'use client';

/* Mobile Ordering settings — ports the design prototype
   `thawb-wa-teeb-laundry/project/POS/ordering.js` (draw / wire / configBlock /
   modeCard / defaultRow) into React. Class names and copy text are kept
   verbatim from the prototype. */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import BagTypeModal from './BagTypeModal';
import {
  MODES,
  AED,
  colorOf,
  ringOf,
  labelOf,
  type BagType,
  type MethodId,
  type Mode,
  type OrderingConfig,
} from './constants';

/* ---- small shared bits ---- */

function Icon({ paths, size = 18 }: { paths: string; size?: number }) {
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

function Swatch({ color, lg }: { color: string; lg?: boolean }) {
  const ring = ringOf(color);
  return (
    <span
      className={`bag-sw${lg ? ' lg' : ''}`}
      style={{
        background: colorOf(color),
        ...(ring ? { boxShadow: `inset 0 0 0 1px ${ring}` } : {}),
      }}
    />
  );
}

/* ---- component ---- */

export default function MobileOrderingSettings({ initial }: { initial: OrderingConfig }) {
  const [cfg, setCfg] = useState<OrderingConfig>(initial);
  const [busy, setBusy] = useState(false);
  // -1 = closed, -2 = adding a new bag, >=0 = editing that index.
  const [bagModal, setBagModal] = useState(-1);
  const toast = useToast();
  const tCommon = useTranslations('Common');

  const single = cfg.selection === 'single';
  const enabledCount = Object.values(cfg.enabled).filter(Boolean).length;

  /* ---- mutators (mirror wire() in ordering.js) ---- */

  const setSelection = (sel: OrderingConfig['selection']) =>
    setCfg({ ...cfg, selection: sel });

  const pickDefault = (id: MethodId) => setCfg({ ...cfg, default: id });

  function toggleEnabled(id: MethodId) {
    const enabled = { ...cfg.enabled, [id]: !cfg.enabled[id] };
    let def = cfg.default;
    // If the default got disabled, repoint it to the first enabled method.
    if (!enabled[def]) {
      const first = MODES.find((m) => enabled[m.id]);
      if (first) def = first.id;
    }
    // Keep at least one method enabled.
    if (!Object.values(enabled).some(Boolean)) enabled[id] = true;
    setCfg({ ...cfg, enabled, default: def });
  }

  function setToggle<K extends MethodId>(method: K, key: keyof OrderingConfig[K], val: boolean) {
    setCfg({ ...cfg, [method]: { ...cfg[method], [key]: val } });
  }
  function setNum<K extends MethodId>(method: K, key: keyof OrderingConfig[K], val: number) {
    setCfg({ ...cfg, [method]: { ...cfg[method], [key]: val } });
  }
  function setText<K extends MethodId>(method: K, key: keyof OrderingConfig[K], val: string) {
    setCfg({ ...cfg, [method]: { ...cfg[method], [key]: val } });
  }

  const setBagBilling = (billing: OrderingConfig['bags']['billing']) =>
    setCfg({ ...cfg, bags: { ...cfg.bags, billing } });

  function toggleWeightService(s: string) {
    const services = cfg.weight.services.includes(s)
      ? cfg.weight.services.filter((x) => x !== s)
      : [...cfg.weight.services, s];
    setCfg({ ...cfg, weight: { ...cfg.weight, services } });
  }

  function saveBag(bag: BagType) {
    const list = [...cfg.bags.list];
    if (bagModal === -2) list.push(bag);
    else list[bagModal] = bag;
    setCfg({ ...cfg, bags: { ...cfg.bags, list } });
    toast.show(bagModal === -2 ? 'Bag added' : 'Bag updated');
    setBagModal(-1);
  }

  function deleteBag(i: number) {
    const list = cfg.bags.list.filter((_, idx) => idx !== i);
    setCfg({ ...cfg, bags: { ...cfg.bags, list } });
  }

  async function save() {
    setBusy(true);
    try {
      const next = await api<OrderingConfig>('/mobile-ordering', { method: 'PUT', body: cfg });
      setCfg(next);
      toast.show('Mobile ordering settings saved');
    } catch (e: any) {
      toast.show(e?.detail?.message ?? tCommon('saveFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  /* ---- shared row renderers (mirror rowToggle / rowNum / rowText) ---- */

  function rowToggle<K extends MethodId>(
    method: K,
    key: keyof OrderingConfig[K],
    title: string,
    sub: string,
  ) {
    const val = cfg[method][key] as unknown as boolean;
    return (
      <div className="set-row">
        <div className="l">
          <b>{title}</b>
          <span>{sub}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={val}
          className={`switch ${val ? 'on' : ''}`}
          onClick={() => setToggle(method, key, !val)}
        />
      </div>
    );
  }

  function rowNum<K extends MethodId>(
    method: K,
    key: keyof OrderingConfig[K],
    title: string,
    unit: string,
  ) {
    const val = cfg[method][key] as unknown as number;
    return (
      <div className="set-row">
        <div className="l">
          <b>{title}</b>
        </div>
        <div className="setr-field">
          <input
            className="inp sm"
            type="number"
            min={0}
            value={val}
            onChange={(e) => setNum(method, key, +e.target.value || 0)}
          />
          <span className="unit">{unit}</span>
        </div>
      </div>
    );
  }

  function rowText<K extends MethodId>(
    method: K,
    key: keyof OrderingConfig[K],
    title: string,
    placeholder = '',
  ) {
    const val = cfg[method][key] as unknown as string;
    return (
      <div className="ord-textrow">
        <label>{title}</label>
        <input
          className="input"
          value={val}
          placeholder={placeholder}
          onChange={(e) => setText(method, key, e.target.value)}
        />
      </div>
    );
  }

  /* ---- configBlock(id) ---- */

  function configBlock(id: MethodId) {
    if (id === 'itemized')
      return (
        <>
          {rowToggle('itemized', 'showPrices', 'Show live prices', 'Customers see each item price as they build the order')}
          {rowToggle('itemized', 'perItemService', 'Choose service per item', 'Wash & Fold, Dry Clean or Press — picked per garment')}
          {rowToggle('itemized', 'photos', 'Allow item photos', 'Customers can attach a photo to flag a stain or damage')}
          {rowToggle('itemized', 'notes', 'Allow notes per item', 'Special handling instructions per garment')}
          {rowNum('itemized', 'minOrder', 'Minimum order', 'AED')}
        </>
      );
    if (id === 'quick')
      return (
        <>
          {rowToggle('quick', 'askCount', 'Ask for an estimated count', 'Customer enters an approximate number of bags or items')}
          {rowToggle('quick', 'pickService', 'Let customer pick a service', 'Otherwise staff decide per garment at the facility')}
          {rowNum('quick', 'hold', 'Pre-authorisation hold', 'AED')}
          {rowText('quick', 'note', 'Message shown to customer', 'e.g. price confirmed after counting')}
        </>
      );
    if (id === 'bags')
      return (
        <>
          <div className="set-row">
            <div className="l">
              <b>Billing</b>
              <span>How colour-coded bags are charged</span>
            </div>
            <div className="ord-seg sm">
              <button type="button" className={cfg.bags.billing === 'per_bag' ? 'on' : ''} onClick={() => setBagBilling('per_bag')}>
                Flat / bag
              </button>
              <button type="button" className={cfg.bags.billing === 'per_item' ? 'on' : ''} onClick={() => setBagBilling('per_item')}>
                Per item
              </button>
              <button type="button" className={cfg.bags.billing === 'by_weight' ? 'on' : ''} onClick={() => setBagBilling('by_weight')}>
                By weight
              </button>
            </div>
          </div>
          <div className="ord-bags">
            <div className="ord-bags-h">
              <b>Bag types</b>
              <button type="button" className="btn btn-pri btn-sm" onClick={() => setBagModal(-2)}>
                + Add bag
              </button>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Colour</th>
                  <th>Name</th>
                  <th>Service</th>
                  <th className="num">Price</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cfg.bags.list.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted" style={{ padding: 14 }}>
                      No bag types yet — add one.
                    </td>
                  </tr>
                ) : (
                  cfg.bags.list.map((b, i) => (
                    <tr key={i}>
                      <td>
                        <span className="bag-cell">
                          <Swatch color={b.color} />
                          {labelOf(b.color)}
                        </span>
                      </td>
                      <td className="t-name">{b.name}</td>
                      <td>{b.service}</td>
                      <td className="num">
                        {b.price ? (
                          AED(b.price) + (b.unit === 'bag' ? ' / bag' : ' / item')
                        ) : (
                          <span className="muted">After sort</span>
                        )}
                      </td>
                      <td className="num">
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button" className="t-btn ghost" onClick={() => setBagModal(i)}>
                            Edit
                          </button>
                          <button type="button" className="t-btn ghost" onClick={() => deleteBag(i)}>
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {rowText('bags', 'note', 'Instructions shown to customer', '')}
        </>
      );
    if (id === 'weight')
      return (
        <>
          {rowNum('weight', 'pricePerKg', 'Price per kilo', 'AED')}
          {rowNum('weight', 'minKg', 'Minimum weight', 'kg')}
          <div className="set-row">
            <div className="l">
              <b>Services included</b>
              <span>Offered under weight-based pricing</span>
            </div>
            <div className="ord-chips">
              {['Wash & Fold', 'Wash & Iron', 'Bedding & Linens'].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`ord-chip ${cfg.weight.services.includes(s) ? 'on' : ''}`}
                  onClick={() => toggleWeightService(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {rowText('weight', 'note', 'Message shown to customer', '')}
        </>
      );
    if (id === 'photo')
      return (
        <>
          <div className="set-row">
            <div className="l">
              <b>Quote response time</b>
              <span>Shown to the customer as your SLA</span>
            </div>
            <select
              className="inp"
              style={{ width: 140 }}
              value={cfg.photo.sla}
              onChange={(e) => setCfg({ ...cfg, photo: { ...cfg.photo, sla: e.target.value } })}
            >
              {['15 min', '30 min', '1 hour', '2 hours', 'Same day'].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          {rowToggle('photo', 'requireApproval', 'Require quote approval', 'Customer must accept the quote before a pickup is booked')}
          {rowToggle('photo', 'multi', 'Allow multiple photos', 'Up to several photos per request')}
        </>
      );
    return null;
  }

  /* ---- defaultRow(id) ---- */

  function defaultRow(id: MethodId) {
    return (
      <div className="set-row om-defrow">
        <div className="l">
          <b>Default method</b>
          <span>Opens first when the app launches</span>
        </div>
        <button
          type="button"
          className={`ord-radio ${cfg.default === id ? 'on' : ''}`}
          onClick={() => pickDefault(id)}
        />
      </div>
    );
  }

  /* ---- modeCard(m, single) ---- */

  function ModeCard({ m }: { m: Mode }) {
    const active = single ? cfg.default === m.id : !!cfg.enabled[m.id];
    const isDef = cfg.default === m.id;
    const control = single ? (
      <button
        type="button"
        className={`ord-radio ${active ? 'on' : ''}`}
        onClick={() => pickDefault(m.id)}
      />
    ) : (
      <button
        type="button"
        className={`switch ${active ? 'on' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          toggleEnabled(m.id);
        }}
      />
    );
    return (
      <div className={`ord-mode ${active ? 'active' : ''}`}>
        <div className="om-head" onClick={single ? () => pickDefault(m.id) : undefined}>
          <span className="om-ic">
            <Icon paths={m.icon} size={22} />
          </span>
          <div className="om-h">
            <div className="om-t">
              <b>{m.title}</b>
              {active && isDef ? <span className="om-def">Default</span> : null}
              <span className="om-best">{m.best}</span>
            </div>
            <span className="om-sub">{m.tagline}</span>
          </div>
          {control}
        </div>
        {active ? (
          <div className="om-body">
            {configBlock(m.id)}
            {!single && enabledCount > 1 ? defaultRow(m.id) : null}
          </div>
        ) : null}
      </div>
    );
  }

  /* ---- draw() ---- */

  return (
    <div className="set-sec ord" style={{ maxWidth: 'none' }}>
      <h2>Mobile Ordering</h2>
      <div className="ssub">
        Define how customers place an order in the mobile app — choose the intake method that
        matches your operation
      </div>

      <div className="set-card">
        <div className="set-row" style={{ border: 'none', padding: '2px 0' }}>
          <div className="l">
            <b>Ordering experience</b>
            <span>
              {single
                ? 'Every customer uses the one method you select below'
                : 'Customers choose their preferred method at checkout'}
            </span>
          </div>
          <div className="ord-seg">
            <button type="button" className={single ? 'on' : ''} onClick={() => setSelection('single')}>
              One method
            </button>
            <button type="button" className={!single ? 'on' : ''} onClick={() => setSelection('choice')}>
              Let customers choose
            </button>
          </div>
        </div>
      </div>

      <div className="ord-modes">
        {MODES.map((m) => (
          <ModeCard key={m.id} m={m} />
        ))}
      </div>

      <div className="ord-foot">
        <button
          type="button"
          className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
          onClick={save}
          disabled={busy}
        >
          Save ordering settings
        </button>
        <span className="ord-hint">Applies to the customer mobile app</span>
      </div>

      {bagModal !== -1 ? (
        <BagTypeModal
          initial={bagModal >= 0 ? cfg.bags.list[bagModal] : undefined}
          onClose={() => setBagModal(-1)}
          onSave={saveBag}
        />
      ) : null}
    </div>
  );
}

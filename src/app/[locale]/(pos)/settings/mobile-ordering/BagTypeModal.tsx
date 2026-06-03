'use client';

/* Ports `bagModal(idx)` from the design prototype ordering.js. Add / edit a
   colour-coded bag type. Copy text and class names are kept verbatim. */

import { useState } from 'react';
import FocusTrap from '@/components/FocusTrap';
import { useToast } from '@/components/Toast';
import {
  BAG_COLORS,
  SERVICES,
  colorOf,
  ringOf,
  isHex,
  type BagType,
} from './constants';

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

interface BagTypeModalProps {
  initial?: BagType;
  onClose: () => void;
  onSave: (bag: BagType) => void;
}

export default function BagTypeModal({ initial, onClose, onSave }: BagTypeModalProps) {
  const isNew = !initial;
  const base: BagType = initial ?? {
    color: 'white',
    name: '',
    service: SERVICES[0],
    price: 35,
    unit: 'bag',
  };
  const [color, setColor] = useState(base.color);
  const [name, setName] = useState(base.name);
  const [service, setService] = useState(base.service);
  const [price, setPrice] = useState(base.price);
  const [unit, setUnit] = useState<'bag' | 'item'>(base.unit);
  const toast = useToast();

  const custom = isHex(color);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.show('Enter a bag name');
      return;
    }
    onSave({ color, name: trimmed, service, price: +price || 0, unit });
  }

  return (
    <div className="mini-scrim" onClick={onClose}>
      <FocusTrap active onEscape={onClose}>
        <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>{isNew ? 'Add bag type' : 'Edit bag type'}</h3>
            <button className="x" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="modal-body">
            <div className="field">
              <label>Bag colour</label>
              <div className="bag-pick">
                {BAG_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`bag-opt ${color === c.id ? 'sel' : ''}`}
                    title={c.label}
                    onClick={() => setColor(c.id)}
                  >
                    <Swatch color={c.id} lg />
                  </button>
                ))}
                <label
                  className={`bag-opt bag-custom ${custom ? 'sel' : ''}`}
                  title="Custom colour"
                >
                  <span
                    className="bag-sw lg"
                    style={{
                      background: custom
                        ? color
                        : 'conic-gradient(from 0deg,#f87171,#fbbf24,#34d399,#60a5fa,#a78bfa,#f87171)',
                    }}
                  />
                  <span className="bag-custom-plus">{custom ? '' : '+'}</span>
                  <input
                    type="color"
                    value={custom ? color : '#3B7DD8'}
                    onInput={(e) => setColor((e.target as HTMLInputElement).value)}
                  />
                </label>
              </div>
            </div>
            <div className="field">
              <label>Name shown to customer</label>
              <input
                className="input"
                value={name}
                placeholder="e.g. Wash & Fold"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field-2">
              <div className="field">
                <label>Service</label>
                <select
                  className="input"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                >
                  {SERVICES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Price (0 = priced after sort)</label>
                <div className="setr-field">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(+e.target.value || 0)}
                  />
                  <span className="unit">AED</span>
                </div>
              </div>
            </div>
            <div className="field">
              <label>Charged</label>
              <div className="ord-seg sm">
                <button
                  type="button"
                  className={unit === 'bag' ? 'on' : ''}
                  onClick={() => setUnit('bag')}
                >
                  Per bag
                </button>
                <button
                  type="button"
                  className={unit === 'item' ? 'on' : ''}
                  onClick={() => setUnit('item')}
                >
                  Per item
                </button>
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-pri" style={{ flex: 2 }} onClick={save}>
              {isNew ? 'Add bag' : 'Save'}
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}

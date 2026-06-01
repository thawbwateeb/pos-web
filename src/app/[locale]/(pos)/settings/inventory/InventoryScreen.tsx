'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { AED } from '@/lib/format';
import { useToast } from '@/components/Toast';

interface Item {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: string;
  reorder: string;
  cost: string;
}

export default function InventoryScreen({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Item | null>(null);
  const [adding, setAdding] = useState(false);
  const t = useTranslations('Settings.inventory');
  const tCommon = useTranslations('Common');
  const toast = useToast();

  async function reload() {
    setItems(await api<Item[]>('/inventory'));
  }

  async function adjust(item: Item, type: 'PURCHASE' | 'USAGE', qty: number) {
    await api(`/inventory/${item.id}/movements`, {
      method: 'POST',
      body: { type, qty, note: type === 'PURCHASE' ? 'Manual restock' : 'Manual usage' },
    });
    reload();
    toast.show(t(type === 'PURCHASE' ? 'addedStock' : 'removedStock', { qty, unit: item.unit }));
  }

  const lowStock = useMemo(() => items.filter((i) => Number(i.stock) <= Number(i.reorder)).length, [items]);
  const totalValue = items.reduce((s, i) => s + Number(i.stock) * Number(i.cost), 0);
  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category))).sort(),
    [items],
  );

  return (
    <div className="set-sec fin" style={{ maxWidth: 1100 }}>
      <h2>{t('title')}</h2>
      <p className="ssub">{t('sub')}</p>

      <div className="stat-row">
        <div className="stat">
          <div className="sk">{t('kpis.skus')}</div>
          <div className="sv">{items.length}</div>
          <div className="sd">{t('kpis.skusSub', { categories: categories.length })}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.lowStock')}</div>
          <div className="sv" style={{ color: lowStock > 0 ? 'var(--warn)' : undefined }}>{lowStock}</div>
          <div className="sd">{t('kpis.lowStockSub')}</div>
        </div>
        <div className="stat">
          <div className="sk">{t('kpis.value')}</div>
          <div className="sv"><span className="cur">AED</span> {Math.round(totalValue).toLocaleString()}</div>
          <div className="sd">{t('kpis.valueSub')}</div>
        </div>
      </div>

      <div className="set-card fin">
        <div className="ch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>{t('tableTitle')}</h3>
          <button className="btn btn-pri btn-sm" onClick={() => setAdding(true)}>+ {tCommon('add')}</button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('table.item')}</th>
              <th>{t('table.category')}</th>
              <th className="num">{t('table.stock')}</th>
              <th className="num">{t('table.adjust')}</th>
              <th className="num">{t('table.reorder')}</th>
              <th className="num">{t('table.cost')}</th>
              <th className="num">{t('table.value')}</th>
              <th>{t('table.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const stock = Number(it.stock);
              const reorder = Number(it.reorder);
              const cost = Number(it.cost);
              const value = stock * cost;
              const low = stock <= reorder;
              return (
                <tr key={it.id}>
                  <td>
                    <b>{it.name}</b>
                  </td>
                  <td>{it.category}</td>
                  <td className="num tnum">{stock.toLocaleString()} <span className="muted" style={{ fontSize: 11 }}>{it.unit}</span></td>
                  <td className="num">
                    <div className="inv-adj">
                      <button onClick={() => adjust(it, 'USAGE', 10)} disabled={stock <= 0}>−10</button>
                      <button onClick={() => adjust(it, 'USAGE', 1)} disabled={stock <= 0}>−1</button>
                      <button onClick={() => adjust(it, 'PURCHASE', 1)}>+1</button>
                      <button onClick={() => adjust(it, 'PURCHASE', 10)}>+10</button>
                    </div>
                  </td>
                  <td className="num tnum">{reorder.toLocaleString()}</td>
                  <td className="num tnum">{AED(cost)}</td>
                  <td className="num tnum">{AED(value)}</td>
                  <td>
                    {low ? (
                      <span className="pill unpaid">{t('lowStock')}</span>
                    ) : (
                      <span className="pill paid">{t('inStock')}</span>
                    )}
                  </td>
                  <td className="num">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(it)}>{tCommon('edit')}</button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)' }}
                      onClick={async () => {
                        if (!confirm(t('deleteConfirm', { name: it.name }))) return;
                        await api(`/inventory/${it.id}`, { method: 'DELETE' });
                        reload();
                      }}
                    >
                      {tCommon('delete')}
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>{t('empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(adding || editing) && (
        <ItemForm
          initial={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); reload(); toast.show(tCommon('saved')); }}
        />
      )}
    </div>
  );
}

function ItemForm({ initial, onClose, onSaved }: { initial: Item | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('Settings.inventory');
  const tCommon = useTranslations('Common');
  const CATEGORIES = ['Chemicals', 'Packaging', 'Equipment', 'Other'] as const;
  const [f, setF] = useState({
    name: initial?.name ?? '',
    category: initial?.category ?? 'Chemicals',
    unit: initial?.unit ?? 'pcs',
    stock: Number(initial?.stock ?? 0),
    reorder: Number(initial?.reorder ?? 0),
    cost: Number(initial?.cost ?? 0),
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!f.name) return;
    setBusy(true);
    try {
      if (initial) await api(`/inventory/${initial.id}`, { method: 'PATCH', body: f });
      else await api('/inventory', { method: 'POST', body: f });
      onSaved();
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{initial ? t('editTitle') : t('addTitle')}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="field"><label>{t('fields.name')}</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field-2">
            <div className="field">
              <label>{t('fields.category')}</label>
              <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>{t('fields.unit')}</label><input className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></div>
          </div>
          <div className="field-2">
            <div className="field"><label>{t('fields.stock')}</label><input className="input" type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: Number(e.target.value) })} /></div>
            <div className="field"><label>{t('fields.reorder')}</label><input className="input" type="number" value={f.reorder} onChange={(e) => setF({ ...f, reorder: Number(e.target.value) })} /></div>
          </div>
          <div className="field"><label>{t('fields.cost')}</label><input className="input" type="number" step="0.01" value={f.cost} onChange={(e) => setF({ ...f, cost: Number(e.target.value) })} /></div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{tCommon('cancel')}</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={save}>{tCommon('save')}</button>
        </div>
      </div>
    </div>
  );
}

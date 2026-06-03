'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { AED, AED0 } from '@/lib/format';
import { useToast } from '@/components/Toast';

/* Design ops.js:106-134 — renderInventory:
   - <div class="fin">
   - .grid.g3 3 KPI cards (.card.kpi > .k + .v + .d):
     - 'Stock items' / count / '${cats} categories'
     - 'Low / re-order' / count (.neg if low>0, else .pos) / first-2-names…
     - 'Stock value' / AED0(value) / 'At cost'
   - .card.flush:
     - .ch flex space-between: h3 'Consumables & supplies' + btn.btn-pri.btn-sm
       '+ Add item' id='inv-add'
     - table.tbl thead 7 cols: Item / Category / In stock (num) /
       Re-order at (num) / Unit cost (num) / Status / Adjust (num)
     - Row: <b>name</b> / muted category /
       input.inp.r.inv-qty[data-invset=i] / num tnum muted reorder /
       num tnum AED(cost) / .pill.bad 'Re-order' or .pill.ok 'OK' /
       .inv-adj buttons (data-inv data-d=-10|-1|+1|+10) */

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

  // Re-sync from the server prop on store switch / router.refresh.
  useEffect(() => { setItems(initial); }, [initial]);

  async function reload() {
    setItems(await api<Item[]>('/inventory'));
  }

  async function adjust(item: Item, delta: number) {
    if (delta === 0) return;
    const type: 'PURCHASE' | 'USAGE' = delta > 0 ? 'PURCHASE' : 'USAGE';
    await api(`/inventory/${item.id}/movements`, {
      method: 'POST',
      body: {
        type,
        qty: Math.abs(delta),
        note: delta > 0 ? 'Manual restock' : 'Manual usage',
      },
    });
    reload();
  }

  async function setStock(item: Item, newStock: number) {
    const cur = Number(item.stock);
    const delta = Math.max(0, Math.round(newStock || 0)) - cur;
    if (delta === 0) return;
    adjust(item, delta);
  }

  const low = useMemo(() => items.filter((i) => Number(i.stock) <= Number(i.reorder)), [items]);
  const totalValue = items.reduce((s, i) => s + Number(i.stock) * Number(i.cost), 0);
  const categoriesCount = useMemo(
    () => new Set(items.map((i) => i.category)).size,
    [items],
  );

  const lowSub = low.length
    ? low.map((i) => i.name).slice(0, 2).join(', ') + (low.length > 2 ? '…' : '')
    : 'All stocked';

  return (
    <div className="fin">
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <div className="k">Stock items</div>
          <div className="v">{items.length}</div>
          <div className="d">{categoriesCount} categories</div>
        </div>
        <div className="card kpi">
          <div className="k">Low / re-order</div>
          <div className={`v ${low.length ? 'neg' : 'pos'}`}>{low.length}</div>
          <div className="d">{lowSub}</div>
        </div>
        <div className="card kpi">
          <div className="k">Stock value</div>
          <div className="v">{AED0(totalValue)}</div>
          <div className="d">At cost</div>
        </div>
      </div>

      <div className="card flush">
        <div className="ch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Consumables &amp; supplies</h3>
          <button className="btn btn-pri btn-sm" id="inv-add" onClick={() => setAdding(true)}>+ Add item</button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th className="num">In stock</th>
              <th className="num">Re-order at</th>
              <th className="num">Unit cost</th>
              <th>Status</th>
              <th className="num">Adjust</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const stock = Number(it.stock);
              const reorder = Number(it.reorder);
              const cost = Number(it.cost);
              const lowFlag = stock <= reorder;
              return (
                <tr key={it.id}>
                  <td><b>{it.name}</b></td>
                  <td className="muted">{it.category}</td>
                  <td className="num">
                    <input
                      className="inp r inv-qty"
                      type="number"
                      min={0}
                      data-invset={i}
                      defaultValue={stock}
                      onBlur={(e) => setStock(it, +(e.target as HTMLInputElement).value || 0)}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      style={{ width: 84 }}
                    />
                  </td>
                  <td className="num tnum muted">{reorder}</td>
                  <td className="num tnum">{AED(cost)}</td>
                  <td>
                    <span className={`pill ${lowFlag ? 'bad' : 'ok'}`}>
                      {lowFlag ? 'Re-order' : 'OK'}
                    </span>
                  </td>
                  <td className="num">
                    <span className="inv-adj">
                      <button data-inv={i} data-d={-10} onClick={() => adjust(it, -10)}>−10</button>
                      <button data-inv={i} data-d={-1} onClick={() => adjust(it, -1)}>−</button>
                      <button data-inv={i} data-d={1} onClick={() => adjust(it, 1)}>+</button>
                      <button data-inv={i} data-d={10} onClick={() => adjust(it, 10)}>+10</button>
                    </span>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>No items yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(adding || editing) && (
        <ItemForm
          initial={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={(name) => { setAdding(false); setEditing(null); reload(); toast.show(`${name} added to inventory`); }}
        />
      )}
    </div>
  );
}

/* Design openInvModal (ops.js:135-153) — Add stock item modal with the
   exact field layout: Item name / Category+Unit (g2) / Stock+Reorder+Cost (g3).
   Categories restricted to Chemicals / Packaging / Equipment / Other. */
function ItemForm({ initial, onClose, onSaved }: { initial: Item | null; onClose: () => void; onSaved: (name: string) => void }) {
  const t = useTranslations('Settings.inventory');
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
  const toast = useToast();

  async function save() {
    if (!f.name.trim()) { toast.show('Enter a name'); return; }
    setBusy(true);
    try {
      if (initial) await api(`/inventory/${initial.id}`, { method: 'PATCH', body: f });
      else await api('/inventory', { method: 'POST', body: f });
      onSaved(f.name);
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{initial ? 'Edit stock item' : 'Add stock item'}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body fin">
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Item name</label>
            <input className="inp" id="iv-name" placeholder={t('namePlaceholder')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="grid g2" style={{ gap: 12, marginBottom: 12 }}>
            <div className="field">
              <label>Category</label>
              <select className="inp" id="iv-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Unit</label>
              <input className="inp" id="iv-unit" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
            </div>
          </div>
          <div className="grid g3" style={{ gap: 12 }}>
            <div className="field"><label>In stock</label><input className="inp" id="iv-stock" type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: +e.target.value })} /></div>
            <div className="field"><label>Re-order at</label><input className="inp" id="iv-reorder" type="number" value={f.reorder} onChange={(e) => setF({ ...f, reorder: +e.target.value })} /></div>
            <div className="field"><label>Unit cost</label><input className="inp" id="iv-cost" type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: +e.target.value })} /></div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} id="iv-save" style={{ flex: 2 }} onClick={save} disabled={busy}>
            {initial ? 'Save' : 'Add item'}
          </button>
        </div>
      </div>
    </div>
  );
}

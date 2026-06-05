'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { AED } from '@/lib/format';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import GarmentIcon, { GARMENT_ICON_KEYS } from '@/components/GarmentIcon';
import { toCsv, downloadCsv, type CsvValue } from '@/lib/csv';

/* Design app.js:1624-1640 (settingsBody — products branch):
   - <div class="set-sec" max-width:none>
   - .page-head with h2 'Products' + sub 'Drag rows to reorder…' + .actions
     (Download Template / Import CSV / + Category / + Add Product)
   - hidden <input id="prod-csv" type=file accept=".csv">
   - .card > table.tbl with 9 cols: drag / Item / Category / Dry Clean / Wash /
     Press / Cost / Turnaround / (edit). Rows draggable, data-ci, data-ii.
   - Each row: drag handle ⠋⠋ / .t-name name / .pill.muted category title /
     3 tier prices (AED or muted —) / cost or — / turnaround or — / Edit btn. */

const TIER_KEYS = ['dry_clean', 'wash', 'press'] as const;

interface Tier {
  id: string;
  externalKey: string;
  name: string;
  short: string;
}

interface CatalogueItem {
  id: string;
  sku: string;
  name: string;
  iconKey?: string | null;
  active?: boolean;
  sortOrder?: number;
  prices?: Record<string, number>;
  cost?: number | null;
  turnaround?: string | null;
}

interface Category {
  id: string;
  title: string;
  externalKey: string;
  items: CatalogueItem[];
}

export default function CatalogueEditor({ data }: { data: any }) {
  const [cats, setCats] = useState<Category[]>(data.categories);
  const tiers = data.tiers as Tier[];
  const toast = useToast();
  const t = useTranslations('Settings.catalogue');
  const tc = useTranslations('Common');

  // `editing` holds the product modal target: a CatalogueItem when editing an
  // existing product, or 'new' to open the modal in add mode.
  const [editing, setEditing] = useState<CatalogueItem | 'new' | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);

  // Flatten to one row list while preserving category/index for drag handles.
  const rows = useMemo(() => {
    const out: { ci: number; ii: number; cat: Category; it: CatalogueItem }[] = [];
    cats.forEach((c, ci) => c.items.forEach((it, ii) => out.push({ ci, ii, cat: c, it })));
    return out;
  }, [cats]);

  // Lookup tier by externalKey (the API exposes externalKey on each tier).
  const tierByKey = (key: string) => tiers.find((t) => t.externalKey === key);

  async function reload() {
    const r = await api<any>('/catalogue');
    setCats(r.categories);
  }

  async function createCategory(title: string) {
    await api('/catalogue/categories', { method: 'POST', body: { title, externalKey: title.toLowerCase().replace(/\s+/g, '_') } });
    await reload();
    toast.show(tc('saved'));
  }

  function addItem() {
    if (cats.length === 0) {
      toast.show(t('addCategoryFirst'));
      return;
    }
    setEditing('new');
  }

  // ─── A) Download a real CSV template (client-side, no backend) ────────
  function downloadTemplate() {
    type Col = { key: string; header: string };
    const columns: Col[] = [
      { key: 'sku', header: 'sku' },
      { key: 'name', header: 'name' },
      { key: 'category', header: 'category' },
      ...tiers.map((tier) => ({ key: tier.externalKey, header: tier.name })),
      { key: 'cost', header: 'cost' },
      { key: 'turnaround', header: 'turnaround' },
    ];
    const sample: Record<string, CsvValue> = {
      sku: 'SHIRT-01',
      name: 'Shirt',
      category: cats[0]?.title ?? 'Garments',
      cost: 2,
      turnaround: '24h',
    };
    tiers.forEach((tier, i) => { sample[tier.externalKey] = (i + 1) * 5; });
    const csv = toCsv([sample], columns);
    downloadCsv('products-template.csv', csv);
  }

  // ─── C) Import a CSV: one item per data row + tier prices ─────────────
  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let text = await file.text();
      // Strip UTF-8 BOM that Excel prepends.
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
      if (lines.length < 2) {
        toast.show(t('importEmpty'), 'error');
        return;
      }
      const split = (line: string) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const header = split(lines[0]).map((h) => h.toLowerCase());
      const idx = (name: string) => header.indexOf(name.toLowerCase());
      const skuI = idx('sku');
      const nameI = idx('name');
      const catI = idx('category');
      const costI = idx('cost');
      const turnaroundI = idx('turnaround');
      // Map each tier to a column: prefer externalKey, fall back to tier name.
      const tierCol: { tierId: string; col: number }[] = [];
      for (const tier of tiers) {
        let ci = idx(tier.externalKey);
        if (ci < 0) ci = idx(tier.name);
        if (ci >= 0) tierCol.push({ tierId: tier.id, col: ci });
      }

      let n = 0;
      for (let li = 1; li < lines.length; li++) {
        const cells = split(lines[li]);
        const name = nameI >= 0 ? cells[nameI] : '';
        if (!name) continue;
        const sku = skuI >= 0 ? cells[skuI] : '';
        const catName = catI >= 0 ? cells[catI] : '';
        const category = cats.find((c) => c.title.toLowerCase() === catName.toLowerCase()) ?? cats[0];
        if (!category) {
          toast.show(t('addCategoryFirst'), 'error');
          return;
        }
        const costRaw = costI >= 0 ? cells[costI] : '';
        const costNum = costRaw != null && costRaw !== '' ? Number(costRaw) : null;
        const turnaroundRaw = turnaroundI >= 0 ? cells[turnaroundI] : '';
        const created = await api<{ id: string }>('/catalogue/items', {
          method: 'POST',
          body: {
            categoryId: category.id,
            name,
            sku,
            cost: costNum != null && Number.isFinite(costNum) ? costNum : undefined,
            turnaround: turnaroundRaw && turnaroundRaw !== '' ? turnaroundRaw : undefined,
          },
        });
        for (const { tierId, col } of tierCol) {
          const raw = cells[col];
          if (raw == null || raw === '') continue;
          const price = Number(raw);
          if (!Number.isFinite(price)) continue;
          await api(`/catalogue/items/${created.id}/prices`, {
            method: 'POST',
            body: { tierId, price },
          });
        }
        n++;
      }
      await reload();
      toast.show(t('imported', { n }));
    } catch (err: any) {
      toast.show(err?.detail?.message ?? t('importFailed'), 'error');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div className="set-sec" style={{ maxWidth: 'none' }}>
      <div className="page-head">
        <div className="ph-l">
          <h2>Products</h2>
          <span className="sub">Drag rows to reorder — this is the order items appear in the POS</span>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" data-tmpl onClick={downloadTemplate}>Download Template</button>
          <button className="btn btn-ghost" data-import onClick={() => document.getElementById('prod-csv')?.click()}>Import CSV</button>
          <button className="btn btn-ghost" data-addcat onClick={() => setAddingCategory(true)}>+ Category</button>
          <button className="btn btn-pri" data-addprod onClick={addItem}>+ Add Product</button>
        </div>
      </div>
      <input
        type="file"
        id="prod-csv"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={importCsv}
      />
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th></th>
              <th>Item</th>
              <th>Category</th>
              <th>Dry Clean</th>
              <th>Wash</th>
              <th>Press</th>
              <th>Cost</th>
              <th>Turnaround</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ ci, ii, cat, it }) => (
              <tr key={it.id} draggable data-ci={ci} data-ii={ii}>
                <td><span className="draghandle" title="Drag to reorder">⠋⠋</span></td>
                {/* Design app.js:1631 — product row Item cell is name-only,
                    no leading icon (the icon picker lives in the edit modal). */}
                <td className="t-name">{it.name}</td>
                <td><span className="pill muted">{cat.title}</span></td>
                {TIER_KEYS.map((tk) => {
                  const tier = tierByKey(tk);
                  const price = tier ? it.prices?.[tier.externalKey] : null;
                  return (
                    <td key={tk}>
                      {price != null ? AED(price) : <span className="muted">—</span>}
                    </td>
                  );
                })}
                <td>{it.cost != null ? AED(it.cost) : <span className="muted">—</span>}</td>
                <td>{it.turnaround || <span className="muted">—</span>}</td>
                <td><button className="t-btn ghost" data-editprod={it.sku} onClick={() => setEditing(it)}>Edit</button></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                  No products yet — add a category, then a product.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductModal
          item={editing === 'new' ? null : editing}
          itemCategoryId={editing === 'new' ? cats[0]?.id : cats.find((c) => c.items.some((i) => i.id === (editing as CatalogueItem).id))?.id}
          categories={cats}
          tiers={tiers}
          onClose={() => setEditing(null)}
          onSaved={async () => { await reload(); setEditing(null); }}
        />
      )}

      {addingCategory && (
        <AddCategoryModal
          onClose={() => setAddingCategory(false)}
          onSubmit={async (title) => { await createCategory(title); setAddingCategory(false); }}
        />
      )}
    </div>
  );
}

// ─── Add-category modal (replaces the native prompt) ────────────────────
function AddCategoryModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (title: string) => Promise<void> }) {
  const t = useTranslations('Settings.catalogue');
  const tc = useTranslations('Common');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try { await onSubmit(title.trim()); } finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={t('addCategory')}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="field">
            <label>{t('categoryTitlePrompt')}</label>
            <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{tc('cancel')}</button>
          <button type="submit" className="btn btn-pri" style={{ flex: 2 }} disabled={saving || !title.trim()}>{tc('add')}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── B) Add / edit product modal — design app.js:2024-2047 ───────────────
function ProductModal({
  item,
  itemCategoryId,
  categories,
  tiers,
  onClose,
  onSaved,
}: {
  item: CatalogueItem | null;
  itemCategoryId?: string;
  categories: Category[];
  tiers: Tier[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations('Settings.catalogue');
  const tc = useTranslations('Common');
  const toast = useToast();
  const isNew = item == null;

  const [name, setName] = useState(item?.name ?? '');
  const [sku, setSku] = useState(item?.sku ?? '');
  const [categoryId, setCategoryId] = useState(itemCategoryId ?? categories[0]?.id ?? '');
  const [iconKey, setIconKey] = useState<string | null>(item?.iconKey ?? null);
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const tier of tiers) {
      const p = item?.prices?.[tier.externalKey];
      out[tier.id] = p != null ? String(p) : '';
    }
    return out;
  });
  const [cost, setCost] = useState(item?.cost != null ? String(item.cost) : '');
  const [turnaround, setTurnaround] = useState(item?.turnaround ?? '');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const costStr = cost.trim();
      const costNum = costStr === '' ? null : Number(costStr);
      const costVal = costNum != null && Number.isFinite(costNum) ? costNum : null;
      const turnVal = turnaround.trim() === '' ? null : turnaround.trim();

      // Create or update the base item, then sync tier prices.
      const itemId = isNew
        ? (await api<{ id: string }>('/catalogue/items', {
            method: 'POST',
            body: {
              categoryId,
              name,
              sku: sku.trim() || undefined,
              iconKey: iconKey ?? undefined,
              cost: costVal ?? undefined,
              turnaround: turnVal ?? undefined,
            },
          })).id
        : item!.id;

      if (!isNew) {
        await api(`/catalogue/items/${itemId}`, {
          method: 'PATCH',
          body: { name, categoryId, iconKey, cost: costVal, turnaround: turnVal },
        });
      }

      for (const tier of tiers) {
        const raw = prices[tier.id];
        const original = item?.prices?.[tier.externalKey];
        const originalStr = original != null ? String(original) : '';
        if (!isNew && raw === originalStr) continue; // unchanged
        if (raw == null || raw === '') continue; // skip clearing (no delete here)
        const price = Number(raw);
        if (!Number.isFinite(price)) continue;
        await api(`/catalogue/items/${itemId}/prices`, {
          method: 'POST',
          body: { tierId: tier.id, price },
        });
      }

      await onSaved();
      toast.show(tc('saved'));
    } catch (err: any) {
      toast.show(err?.detail?.message ?? t('saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? t('addProductTitle') : t('editProduct')} className="wide">
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="field">
            <label>{t('itemNamePrompt')}</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('itemNamePlaceholder')} required />
          </div>
          <div className="field">
            <label>{t('category')}</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          {/* Design app.js:2031 — 3-col price row, one column per tier. */}
          <div className="field-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            {tiers.map((tier) => (
              <div className="field" key={tier.id}>
                <label>{tier.name}</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="—"
                  value={prices[tier.id]}
                  onChange={(e) => setPrices((p) => ({ ...p, [tier.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="field">
            <label>{t('costPerItem')}</label>
            <input className="input" type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder={t('costPlaceholder')} />
          </div>
          <div className="field">
            <label>{t('turnaround')}</label>
            <input className="input" value={turnaround} onChange={(e) => setTurnaround(e.target.value)} placeholder={t('turnaroundPlaceholder')} />
          </div>
          {/* SKU lives here so it can be set on create (and viewed on edit). */}
          <div className="field">
            <label>{t('skuPrompt')}</label>
            <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} placeholder={t('skuPlaceholder')} />
          </div>
          {/* Design app.js:2038-2044 — 8-column icon-picker grid. */}
          <div className="field">
            <label>{t('icon')}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 6, maxHeight: 140, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
              {GARMENT_ICON_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`iconpick${iconKey === k ? ' sel' : ''}`}
                  title={k}
                  onClick={() => setIconKey(k)}
                >
                  <GarmentIcon iconKey={k} size={20} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{tc('cancel')}</button>
          <button type="submit" className="btn btn-pri" style={{ flex: 2 }} disabled={saving}>{isNew ? t('addProductBtn') : t('saveChanges')}</button>
        </div>
      </form>
    </Modal>
  );
}

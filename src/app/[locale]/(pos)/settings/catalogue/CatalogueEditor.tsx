'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { AED } from '@/lib/format';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
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
  turnover?: string | null;
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

  const [editing, setEditing] = useState<CatalogueItem | null>(null);

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

  async function addCategory() {
    const title = prompt(t('categoryTitlePrompt'));
    if (!title) return;
    await api('/catalogue/categories', { method: 'POST', body: { title, externalKey: title.toLowerCase().replace(/\s+/g, '_') } });
    reload();
    toast.show(tc('saved'));
  }

  async function addItem() {
    if (cats.length === 0) {
      toast.show(t('addCategoryFirst'));
      return;
    }
    const name = prompt(t('itemNamePrompt'));
    if (!name) return;
    const sku = prompt(t('skuPrompt')) ?? '';
    await api('/catalogue/items', { method: 'POST', body: { categoryId: cats[0].id, name, sku } });
    reload();
    toast.show(tc('saved'));
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
        const created = await api<{ id: string }>('/catalogue/items', {
          method: 'POST',
          body: { categoryId: category.id, name, sku },
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
          <button className="btn btn-ghost" data-addcat onClick={addCategory}>+ Category</button>
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
                <td>{it.turnover || <span className="muted">—</span>}</td>
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
        <EditProductModal
          item={editing}
          tiers={tiers}
          onClose={() => setEditing(null)}
          onSaved={async () => { await reload(); setEditing(null); }}
        />
      )}
    </div>
  );
}

// ─── B) Edit product modal ──────────────────────────────────────────────
function EditProductModal({
  item,
  tiers,
  onClose,
  onSaved,
}: {
  item: CatalogueItem;
  tiers: Tier[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations('Settings.catalogue');
  const tc = useTranslations('Common');
  const toast = useToast();

  const [name, setName] = useState(item.name);
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const tier of tiers) {
      const p = item.prices?.[tier.externalKey];
      out[tier.id] = p != null ? String(p) : '';
    }
    return out;
  });
  const [cost, setCost] = useState(item.cost != null ? String(item.cost) : '');
  const [turnaround, setTurnaround] = useState(item.turnover ?? '');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // ItemDto / CatalogueItem model only persists name (+ sku/icon/sort/active).
      // cost & turnaround have no backing columns, so they are not sent.
      await api(`/catalogue/items/${item.id}`, { method: 'PATCH', body: { name } });

      for (const tier of tiers) {
        const raw = prices[tier.id];
        const original = item.prices?.[tier.externalKey];
        const originalStr = original != null ? String(original) : '';
        if (raw === originalStr) continue; // unchanged
        if (raw == null || raw === '') continue; // skip clearing (no delete here)
        const price = Number(raw);
        if (!Number.isFinite(price)) continue;
        await api(`/catalogue/items/${item.id}/prices`, {
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
    <Modal open onClose={onClose} title={t('editProduct')}>
      <form onSubmit={submit} className="modal-body" style={{ display: 'grid', gap: 12, padding: 16 }}>
        <label className="field">
          <span>{tc('name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        {tiers.map((tier) => (
          <label className="field" key={tier.id}>
            <span>{tier.name}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={prices[tier.id]}
              onChange={(e) => setPrices((p) => ({ ...p, [tier.id]: e.target.value }))}
            />
          </label>
        ))}
        <label className="field">
          <span>{tc('cost')}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t('turnaround')}</span>
          <input value={turnaround} onChange={(e) => setTurnaround(e.target.value)} />
        </label>
        <div className="modal-foot" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{tc('cancel')}</button>
          <button type="submit" className="btn btn-pri" disabled={saving}>{tc('save')}</button>
        </div>
      </form>
    </Modal>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { AED } from '@/lib/format';
import { useToast } from '@/components/Toast';

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

export default function CatalogueEditor({ data }: { data: any }) {
  const [cats, setCats] = useState(data.categories);
  const tiers = data.tiers as { id: string; externalKey: string; name: string; short: string }[];
  const toast = useToast();

  // Flatten to one row list while preserving category/index for drag handles.
  const rows = useMemo(() => {
    const out: { ci: number; ii: number; cat: any; it: any }[] = [];
    cats.forEach((c: any, ci: number) => c.items.forEach((it: any, ii: number) => out.push({ ci, ii, cat: c, it })));
    return out;
  }, [cats]);

  // Lookup tier by externalKey (the API exposes externalKey on each tier).
  const tierByKey = (key: string) => tiers.find((t) => t.externalKey === key);

  async function reload() {
    const r = await api<any>('/catalogue');
    setCats(r.categories);
  }

  async function addCategory() {
    const title = prompt('Category title');
    if (!title) return;
    await api('/catalogue/categories', { method: 'POST', body: { title, externalKey: title.toLowerCase().replace(/\s+/g, '_') } });
    reload();
    toast.show('Category added');
  }

  async function addItem() {
    if (cats.length === 0) {
      toast.show('Add a category first');
      return;
    }
    const name = prompt('Item name');
    if (!name) return;
    const sku = prompt('SKU') ?? '';
    await api('/catalogue/items', { method: 'POST', body: { categoryId: cats[0].id, name, sku } });
    reload();
    toast.show('Product added');
  }

  return (
    <div className="set-sec" style={{ maxWidth: 'none' }}>
      <div className="page-head">
        <div className="ph-l">
          <h2>Products</h2>
          <span className="sub">Drag rows to reorder — this is the order items appear in the POS</span>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" data-tmpl onClick={() => toast.show('Template downloaded')}>Download Template</button>
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
        onChange={() => toast.show('CSV import coming soon')}
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
                <td><button className="t-btn ghost" data-editprod={it.sku} onClick={() => toast.show('Edit product (coming soon)')}>Edit</button></td>
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
    </div>
  );
}

'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

export default function CatalogueEditor({ data }: { data: any }) {
  const [cats, setCats] = useState(data.categories);
  const tiers = data.tiers;
  const toast = useToast();

  async function reload() {
    const r = await api<any>('/catalogue');
    setCats(r.categories);
  }

  async function setPrice(itemId: string, tierId: string, value: number) {
    await api(`/catalogue/items/${itemId}/prices`, { method: 'POST', body: { tierId, price: value } });
    reload();
  }
  async function removePrice(itemId: string, tierId: string) {
    await api(`/catalogue/items/${itemId}/prices/${tierId}`, { method: 'DELETE' });
    reload();
  }

  async function addCategory() {
    const title = prompt('Category title');
    if (!title) return;
    await api('/catalogue/categories', { method: 'POST', body: { title, externalKey: title.toLowerCase().replace(/\s+/g, '_') } });
    reload();
  }

  async function addItem(categoryId: string) {
    const name = prompt('Item name');
    if (!name) return;
    const sku = prompt('SKU') ?? '';
    await api('/catalogue/items', { method: 'POST', body: { categoryId, name, sku } });
    reload();
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete item?')) return;
    await api(`/catalogue/items/${id}`, { method: 'DELETE' });
    reload();
    toast.show('Deleted');
  }

  return (
    <div className="set-sec" style={{ maxWidth: 1100 }}>
      <h2>Products & Pricing</h2>
      <p className="ssub">Catalogue items with one price per service tier. Empty = tier not offered.</p>

      {cats.map((c: any) => (
        <div className="set-card" key={c.id}>
          <div className="ch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>{c.title}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => addItem(c.id)}>+ Item</button>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>SKU</th><th>Name</th>
                {tiers.map((t: any) => <th key={t.id} className="num">{t.short}</th>)}
                <th className="num"></th>
              </tr>
            </thead>
            <tbody>
              {c.items.map((it: any) => (
                <tr key={it.id}>
                  <td className="t-id">{it.sku}</td>
                  <td>{it.name}</td>
                  {tiers.map((t: any) => {
                    const v = it.prices[t.externalKey];
                    return (
                      <td className="num" key={t.id}>
                        <PriceCell value={v} onChange={(nv) => nv == null ? removePrice(it.id, t.id) : setPrice(it.id, t.id, nv)} />
                      </td>
                    );
                  })}
                  <td className="num">
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteItem(it.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <button className="btn btn-pri" onClick={addCategory}>+ Add category</button>
    </div>
  );
}

function PriceCell({ value, onChange }: { value?: number; onChange: (v: number | null) => void }) {
  const [v, setV] = useState(value != null ? String(value) : '');
  function commit() {
    if (v === '') { if (value != null) onChange(null); return; }
    const n = Number(v);
    if (!isNaN(n) && n !== value) onChange(n);
  }
  return (
    <input
      style={{ width: 64, textAlign: 'right', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'JetBrains Mono', fontSize: 12 }}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      placeholder="—"
    />
  );
}

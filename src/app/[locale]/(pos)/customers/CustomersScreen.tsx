'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { AED, initials } from '@/lib/format';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import type { Customer } from '@/lib/types';

export default function CustomersScreen({ initial, initialQ }: { initial: Customer[]; initialQ: string }) {
  const [q, setQ] = useState(initialQ);
  const [list, setList] = useState(initial);
  const [open, setOpen] = useState<Customer | null>(null);
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await api<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      setList(r);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="page">
      <div className="page-head">
        <div className="ph-l">
          <h2>Customers</h2>
          <span className="sub">{list.length} shown</span>
        </div>
        <div className="actions">
          <div className="search" style={{ background: 'var(--surface)' }}>
            <Icon.search size={14} />
            <input placeholder="Search name, phone, email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn btn-pri" onClick={() => setAdding(true)}>+ Add customer</button>
        </div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Customer</th><th>Phone</th><th>Area</th>
              <th className="num">Orders</th><th className="num">Spend</th>
              <th>Tags</th><th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="av" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12 }}>{initials(c.fullName)}</div>
                    <div>
                      <div className="t-name">{c.fullName}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{c.externalCode}</div>
                    </div>
                  </div>
                </td>
                <td>{c.phone}</td>
                <td>{c.area ?? '—'}</td>
                <td className="num">{c.totalOrders}</td>
                <td className="num">{AED(c.totalSpend)}</td>
                <td>
                  {c.isSubscriber && <span className="pill muted">Subscriber</span>}
                </td>
                <td className="num">
                  <button className="t-btn ghost" onClick={() => setOpen(c)}>View</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>No customers match “{q}”.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && <CustomerDrawer id={open.id} onClose={() => setOpen(null)} />}
      {adding && (
        <CustomerForm
          onClose={() => setAdding(false)}
          onSaved={async () => {
            const r = await api<Customer[]>(`/customers`);
            setList(r);
            setAdding(false);
            toast.show('Customer added');
          }}
        />
      )}
    </div>
  );
}

function CustomerDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api<any>(`/customers/${id}`).then(setData);
  }, [id]);
  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{data?.fullName ?? '…'}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {!data && <div className="muted">Loading…</div>}
          {data && (
            <>
              <div className="odl-head">
                <div className="odl-cust">
                  <div className="odl-av">{initials(data.fullName)}</div>
                  <div>
                    <b>{data.fullName}</b>
                    <span>{data.phone} · {data.email ?? '—'}</span>
                  </div>
                </div>
              </div>
              <div className="odl-meta">
                <span>Area: {data.area ?? '—'}</span>
                <span>Address: {data.address ?? '—'}</span>
                <span>Loyalty: {data.loyaltyBalance?.balance ?? 0} pts</span>
              </div>
              <h3 style={{ fontSize: 13, marginBottom: 10 }}>Recent orders</h3>
              <table className="odl-tbl">
                <thead><tr><th>#</th><th>Date</th><th>Status</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {data.orders?.map((o: any) => (
                    <tr key={o.id}>
                      <td>#{o.number}</td>
                      <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td>{o.status}</td>
                      <td className="num">{AED(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomerForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', area: '', address: '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function save() {
    if (!form.fullName || !form.phone) return toast.show('Name and phone required');
    setBusy(true);
    try {
      await api('/customers', { method: 'POST', body: form });
      onSaved();
    } catch (e: any) {
      toast.show(e?.detail?.message || 'Failed');
    } finally { setBusy(false); }
  }
  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>Add customer</h3><button className="x" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="field"><label>Name</label><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
          <div className="field"><label>Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="field"><label>Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="field-2">
            <div className="field"><label>Area</label><input className="input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
            <div className="field"><label>Address</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={save}>Add customer</button>
        </div>
      </div>
    </div>
  );
}

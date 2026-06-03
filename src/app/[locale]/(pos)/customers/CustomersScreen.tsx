'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { AED, initials, shortTime } from '@/lib/format';
import { Icon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import type { Customer } from '@/lib/types';

export default function CustomersScreen({ initial, initialQ }: { initial: Customer[]; initialQ: string }) {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? 'en';
  const q = initialQ;
  const [list, setList] = useState(initial);
  const [open, setOpen] = useState<Customer | null>(null);
  const [adding, setAdding] = useState(false);

  // Re-sync from the server prop on store switch / router.refresh.
  useEffect(() => { setList(initial); }, [initial]);
  const t = useTranslations('Customers');
  const tCommon = useTranslations('Common');
  const toast = useToast();

  return (
    <div className="page">
      <div className="page-head">
        <div className="ph-l">
          <h2>{t('directoryTitle')}</h2>
          <span className="sub">{t('directorySub', { count: list.length })}</span>
        </div>
        {/* Design app.js:664 — .actions wrapper + data-newcust attribute. */}
        <div className="actions">
          <button className="btn btn-pri" data-newcust onClick={() => setAdding(true)}>
            <Icon.plus size={16} /> {t('newCustomer')}
          </button>
        </div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('table.customer')}</th>
              <th>{t('table.phone')}</th>
              <th>{t('table.area')}</th>
              <th>{t('table.orders')}</th>
              <th>{t('table.lifetime')}</th>
              <th>{t('table.tags')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                {/* Design app.js:671 — class lives on the <td>, not on an inner <b>. */}
                <td className="t-name">{c.fullName}</td>
                <td className="mono" style={{ fontSize: 12 }}>{c.phone}</td>
                <td>{c.area ?? <span className="muted">—</span>}</td>
                <td>{c.totalOrders}</td>
                <td className="t-amt">{AED(c.totalSpend)}</td>
                <td>
                  {(c.tags && c.tags.length > 0)
                    ? c.tags.map((tg) => (
                        <span
                          key={tg.tag.id}
                          className={`pill ${tg.tag.name.toLowerCase() === 'vip' ? 'paid' : 'muted'}`}
                          style={{ marginRight: 4 }}
                        >
                          {tg.tag.name}
                        </span>
                      ))
                    : <span className="muted">—</span>}
                </td>
                <td>
                  {/* Design app.js:677 — wrapper .r, both buttons .t-btn.ghost,
                      data-editcust on Edit, data-newfor on New Order. */}
                  <div className="r" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="t-btn ghost" data-editcust={c.id} onClick={() => setOpen(c)}>{tCommon('edit')}</button>
                    <button
                      className="t-btn ghost"
                      data-newfor={c.id}
                      onClick={() => {
                        document.cookie = `attach_customer=${c.id}; Path=/; SameSite=Lax`;
                        router.push(`/${locale}/order`);
                        toast.show(t('attached', { name: c.fullName }));
                      }}
                    >
                      {t('newOrderFor')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>{t('noResults', { q })}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && <CustomerDrawer id={open.id} onClose={() => setOpen(null)} />}
      {adding && (
        <CustomerForm
          onClose={() => setAdding(false)}
          onSaved={async () => {
            const r = await api<Customer[]>('/customers');
            setList(r);
            setAdding(false);
            toast.show(t('customerAdded'));
          }}
        />
      )}
    </div>
  );
}

function CustomerDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', area: '', address: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const t = useTranslations('Customers');
  const tCommon = useTranslations('Common');
  const toast = useToast();

  useEffect(() => {
    api<any>(`/customers/${id}`).then((d) => {
      setData(d);
      setForm({
        fullName: d.fullName ?? '',
        phone: d.phone ?? '',
        email: d.email ?? '',
        area: d.area ?? '',
        address: d.address ?? '',
        notes: d.notes ?? '',
      });
    });
    api<any>(`/loyalty/customers/${id}`).then((l) => setData((d: any) => ({ ...(d ?? {}), loyalty: l })));
  }, [id]);

  async function saveEdit() {
    if (!form.fullName || !form.phone) return toast.show(t('nameAndPhoneRequired'));
    setBusy(true);
    try {
      const r = await api<any>(`/customers/${id}`, { method: 'PATCH', body: form });
      setData({ ...data, ...r });
      setEditing(false);
      toast.show(t('saved'));
    } catch (e: any) {
      toast.show(e?.detail?.message || tCommon('failed'));
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{data?.fullName ?? tCommon('loading')}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {data && !editing && (
              <button className="t-btn" onClick={() => setEditing(true)}>
                {tCommon('edit')}
              </button>
            )}
            <button className="x" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="modal-body">
          {!data && <div className="muted">{tCommon('loading')}</div>}
          {data && editing && (
            <>
              <div className="field"><label>{tCommon('name')}</label><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
              <div className="field"><label>{tCommon('phone')}</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="field"><label>{tCommon('email')}</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="field-2">
                <div className="field"><label>{tCommon('area')}</label><input className="input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
                <div className="field"><label>{tCommon('address')}</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              </div>
              <div className="field"><label>{t('drawer.notes')}</label><textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>{tCommon('cancel')}</button>
                <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} onClick={saveEdit} disabled={busy}>{tCommon('save')}</button>
              </div>
            </>
          )}
          {data && !editing && (
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
                <span>{t('drawer.area')}: {data.area ?? '—'}</span>
                <span>·</span>
                <span>{t('drawer.address')}: {data.address ?? '—'}</span>
                <span>·</span>
                <span>{t('drawer.code')}: {data.externalCode}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="stat">
                  <div className="sk">{t('drawer.lifetime')}</div>
                  <div className="sv"><span className="cur">AED</span> {Math.round(Number(data.totalSpend ?? 0))}</div>
                  <div className="sd">{t('drawer.acrossOrders', { count: data.totalOrders })}</div>
                </div>
                <div className="stat">
                  <div className="sk">{t('drawer.loyaltyBalance')}</div>
                  <div className="sv">{data.loyalty?.balance?.balance ?? data.loyaltyBalance?.balance ?? 0}<span className="cur"> pts</span></div>
                  <div className="sd">{t('drawer.earned', { n: data.loyalty?.balance?.lifetimeEarned ?? 0 })}</div>
                </div>
                <div className="stat">
                  <div className="sk">{t('drawer.subscriptions')}</div>
                  <div className="sv">{(data.subscriptions ?? []).filter((s: any) => s.status === 'ACTIVE').length}</div>
                  <div className="sd">{data.isSubscriber ? t('drawer.subscriber') : t('drawer.notSubscriber')}</div>
                </div>
              </div>

              <h3 style={{ fontSize: 13, marginBottom: 10 }}>{t('drawer.recentOrders')}</h3>
              <table className="odl-tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('drawer.date')}</th>
                    <th>{t('drawer.status')}</th>
                    <th className="num">{t('drawer.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.orders ?? []).map((o: any) => (
                    <tr key={o.id}>
                      <td>#{o.number}</td>
                      <td suppressHydrationWarning>{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td>{o.status}</td>
                      <td className="num">{AED(o.total)}</td>
                    </tr>
                  ))}
                  {(data.orders ?? []).length === 0 && (
                    <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 12 }}>—</td></tr>
                  )}
                </tbody>
              </table>

              {data.loyalty?.transactions && data.loyalty.transactions.length > 0 && (
                <>
                  <h3 style={{ fontSize: 13, margin: '14px 0 10px' }}>{t('drawer.loyaltyHistory')}</h3>
                  <table className="odl-tbl">
                    <thead><tr><th>{t('drawer.when')}</th><th>{t('drawer.type')}</th><th className="num">{t('drawer.points')}</th></tr></thead>
                    <tbody>
                      {data.loyalty.transactions.slice(0, 10).map((tx: any) => (
                        <tr key={tx.id}>
                          <td>{shortTime(tx.createdAt)}</td>
                          <td>{tx.type}</td>
                          <td className="num">{tx.points > 0 ? `+${tx.points}` : tx.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
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
  const t = useTranslations('Customers');
  const tCommon = useTranslations('Common');
  const toast = useToast();

  async function save() {
    if (!form.fullName || !form.phone) return toast.show(t('nameAndPhoneRequired'));
    setBusy(true);
    try {
      await api('/customers', { method: 'POST', body: form });
      onSaved();
    } catch (e: any) {
      toast.show(e?.detail?.message || tCommon('failed'));
    } finally { setBusy(false); }
  }
  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{t('addModal.title')}</h3><button className="x" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="field"><label>{tCommon('name')}</label><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
          <div className="field"><label>{tCommon('phone')}</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="field"><label>{tCommon('email')}</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="field-2">
            <div className="field"><label>{tCommon('area')}</label><input className="input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
            <div className="field"><label>{tCommon('address')}</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{tCommon('cancel')}</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={save}>{t('addModal.save')}</button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LOGO_ICON, Icon } from './Icons';
import { api, eventStream } from '@/lib/api-client';
import type { Bootstrap, PermissionAction } from '@/lib/types';
import { initials } from '@/lib/format';
import { BootstrapProvider } from './BootstrapContext';
import { ToastHost } from './Toast';

const NAV = [
  { id: 'order', label: 'New Order', Icon: Icon.receipt, href: '/order' },
  { id: 'orders', label: 'Orders', Icon: Icon.board, href: '/orders' },
  { id: 'payments', label: 'Payments', Icon: Icon.card, href: '/payments' },
  { id: 'customers', label: 'Customers', Icon: Icon.users, href: '/customers' },
  { id: 'whatsapp', label: 'WhatsApp', Icon: Icon.whatsapp, href: '/whatsapp' },
  { id: 'reports', label: 'Report', Icon: Icon.chart, href: '/reports' },
  { id: 'finance', label: 'Finance', Icon: Icon.trend, href: '/finance' },
  { id: 'settings', label: 'Settings', Icon: Icon.gear, href: '/settings' },
] as const;

const CRUMBS: Record<string, { k: string; t: string }> = {
  order: { k: 'POS', t: 'New Order' },
  orders: { k: 'OPERATIONS', t: 'Orders Board' },
  payments: { k: 'OPERATIONS', t: 'Payments' },
  customers: { k: 'CRM', t: 'Customers' },
  whatsapp: { k: 'CRM', t: 'WhatsApp' },
  reports: { k: 'ANALYTICS', t: 'Report' },
  finance: { k: 'ANALYTICS', t: 'Finance' },
  settings: { k: 'CONFIG', t: 'Settings' },
};

interface AppShellProps {
  bootstrap: Bootstrap;
  children: ReactNode;
}

export default function AppShell({ bootstrap: initial, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [bootstrap, setBootstrap] = useState(initial);
  const [now, setNow] = useState(() => new Date());
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [badges, setBadges] = useState<{ orders?: number; payments?: number; whatsapp?: number }>({});

  // live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // SSE for live order/payment counters
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = eventStream();
      es.addEventListener('order.created', () => setBadges((b) => ({ ...b, orders: (b.orders ?? 0) + 1 })));
      es.addEventListener('order.status', () => setBadges((b) => ({ ...b })));
    } catch {/* SSE optional */}
    return () => es?.close();
  }, []);

  const active = pathname.split('/')[1] || 'order';
  const crumb = CRUMBS[active] ?? { k: '', t: '' };
  const u = bootstrap.user;
  const activeStore = bootstrap.stores.find((s) => s.id === bootstrap.activeStoreId);

  function switchStore(id: string) {
    setBootstrap((b) => ({ ...b, activeStoreId: id }));
    document.cookie = `active_store_id=${id}; Path=/; SameSite=Lax`;
    setStorePickerOpen(false);
    router.refresh();
  }

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    router.replace('/login');
    router.refresh();
  }

  return (
    <BootstrapProvider value={bootstrap}>
    <ToastHost>
    <div className="app">
      <aside className="rail">
        <div className="logo" title="Thawb Wa Teeb">{LOGO_ICON}</div>
        <nav className="nav">
          {NAV.map(({ id, label, Icon: NavIcon, href }) => {
            const isOn = active === id;
            const badge = (badges as any)[id];
            return (
              <button key={id} onClick={() => router.push(href)} className={isOn ? 'active' : ''} title={label}>
                <NavIcon />
                <span className="nlbl">{label}</span>
                {badge ? <span className="badge">{badge}</span> : null}
              </button>
            );
          })}
        </nav>
        <button className="role" title={u.role.name} onClick={logout}>
          {initials(u.fullName)}
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumb">
            <span className="k">{crumb.k}</span>
            <span className="t">{crumb.t}</span>
          </div>
          <div className="search">
            <Icon.search size={16} />
            <input placeholder="Search orders, customers, items…" />
          </div>
          <div className="spacer" />
          <button className="storechip" onClick={() => setStorePickerOpen((v) => !v)}>
            <Icon.shop size={15} />
            <span className="snm">{activeStore?.name ?? 'Pick a store'}</span>
            <Icon.chevd size={14} />
          </button>
          <div className="clock">
            <span className="t">{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="d">{now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </div>
          <button className="rolechip" onClick={logout} title="Sign out">
            <div className="nm">
              <b>{u.fullName}</b>
              <span>{u.role.name}</span>
            </div>
            <div className="av">{initials(u.fullName)}</div>
          </button>
        </header>
        <div className="screen">{children}</div>

        {storePickerOpen && (
          <div className="modal-scrim show" onClick={() => setStorePickerOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h3>Switch store</h3>
                <button className="x" onClick={() => setStorePickerOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                {bootstrap.stores.map((s) => (
                  <button
                    key={s.id}
                    className={`role-opt${s.id === bootstrap.activeStoreId ? ' sel' : ''}`}
                    onClick={() => switchStore(s.id)}
                  >
                    <div className="rav">{initials(s.name)}</div>
                    <div className="ri">
                      <b>{s.name}</b>
                      <span>{s.area ?? s.address ?? '—'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </ToastHost>
    </BootstrapProvider>
  );
}

export function hasPermission(b: Bootstrap, action: PermissionAction): boolean {
  return b.user.role.isSystemManager || !!b.user.role.permissions[action];
}

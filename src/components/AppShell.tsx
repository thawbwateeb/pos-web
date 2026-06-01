'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LOGO_ICON, Icon } from './Icons';
import { api, eventStream } from '@/lib/api-client';
import type { Bootstrap, PermissionAction } from '@/lib/types';
import { initials } from '@/lib/format';
import { BootstrapProvider } from './BootstrapContext';
import { ToastHost } from './Toast';

// Each rail entry carries the i18n key for its short label, the icon, AND
// the topbar crumb namespace + page-title key for that route. This way the
// topbar text always matches what the user clicked.
const NAV = [
  { id: 'order',    tKey: 'newOrder',   Icon: Icon.receipt, crumb: 'pointOfSale',   titleKey: 'newOrder' },
  { id: 'orders',   tKey: 'orders',     Icon: Icon.board,   crumb: 'operations',    titleKey: 'ordersBoard' },
  { id: 'payments', tKey: 'payments',   Icon: Icon.card,    crumb: 'operations',    titleKey: 'payments' },
  { id: 'customers',tKey: 'customers',  Icon: Icon.users,   crumb: 'crm',           titleKey: 'customers' },
  { id: 'whatsapp', tKey: 'whatsapp',   Icon: Icon.whatsapp,crumb: 'messaging',     titleKey: 'whatsappBusiness' },
  { id: 'reports',  tKey: 'report',     Icon: Icon.chart,   crumb: 'finance',       titleKey: 'dailySummary' },
  { id: 'finance',  tKey: 'finance',    Icon: Icon.trend,   crumb: 'finance',       titleKey: 'financialVision' },
  { id: 'settings', tKey: 'settings',   Icon: Icon.gear,    crumb: 'configuration', titleKey: 'settings' },
] as const;

interface AppShellProps {
  bootstrap: Bootstrap;
  children: ReactNode;
}

export default function AppShell({ bootstrap: initial, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? 'en';
  const t = useTranslations('Nav');
  const tc = useTranslations('Crumbs');

  const [bootstrap, setBootstrap] = useState(initial);
  const [now, setNow] = useState(() => new Date());
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [shifted, setShifted] = useState(false); // local "checked in" hint
  const [badges, setBadges] = useState<{ orders?: number; payments?: number; whatsapp?: number }>({});

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Fetch live badge counts so the rail reflects what's actually pending —
  // active orders, unpaid orders (≈ Payments queue), and unread WhatsApp
  // conversations. Re-fetches on SSE order/payment/wa events.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [orders, payments, convos] = await Promise.all([
          api<any[]>('/orders?take=200').catch(() => []),
          api<any[]>('/payments?take=200').catch(() => []),
          api<any[]>('/whatsapp/conversations').catch(() => []),
        ]);
        if (cancelled) return;
        setBadges({
          orders: orders.filter((o: any) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length,
          payments: orders.filter((o: any) => !o.paid && o.status !== 'CANCELLED').length,
          whatsapp: convos.reduce((s: number, c: any) => s + (c.unread ?? 0), 0),
        });
      } catch {/* badges are decorative */}
    }
    load();
    let es: EventSource | null = null;
    try {
      es = eventStream();
      ['order.created', 'order.status', 'payment.recorded', 'wa.received'].forEach((ev) =>
        es!.addEventListener(ev, load),
      );
    } catch {}
    return () => { cancelled = true; es?.close(); };
  }, []);

  const segments = pathname.split('/').filter(Boolean);
  const active = segments[1] || 'order';
  const navMeta = NAV.find((n) => n.id === active);
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
    router.replace(`/${locale}/login`);
    router.refresh();
  }

  return (
    <BootstrapProvider value={bootstrap}>
      <ToastHost>
        <div className="app">
          <aside className="rail">
            <div className="logo" title={u.fullName}>{LOGO_ICON}</div>
            <nav className="nav">
              {NAV.map(({ id, tKey, Icon: NavIcon }) => {
                const isOn = active === id;
                const badge = (badges as any)[id];
                return (
                  <Link
                    key={id}
                    href={`/${locale}/${id}`}
                    prefetch
                    className={isOn ? 'active' : ''}
                    title={t(tKey)}
                    style={{ textDecoration: 'none' }}
                  >
                    <NavIcon />
                    <span className="nlbl">{t(tKey)}</span>
                    {badge ? <span className="badge">{badge}</span> : null}
                  </Link>
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
                <span className="k">{tc(navMeta?.crumb ?? 'pointOfSale')}</span>
                <span className="t">{tc(navMeta?.titleKey ?? 'newOrder')}</span>
              </div>
              <div className="search">
                <Icon.search size={16} />
                <input placeholder={t('globalSearch')} />
              </div>
              <div className="spacer" />
              <button
                className={`checkbtn${shifted ? ' on' : ''}`}
                onClick={() => setShifted((v) => !v)}
                title={shifted ? t('checkedIn') : t('checkIn')}
              >
                {shifted ? t('checkedIn') : t('checkIn')}
              </button>
              <button className="storechip" onClick={() => setStorePickerOpen((v) => !v)}>
                <Icon.shop size={15} />
                <span className="snm">{activeStore?.name ?? t('pickStore')}</span>
                <Icon.chevd size={14} />
              </button>
              <div className="clock">
                <span className="t">{now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="d">{now.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </div>
              <button className="rolechip" onClick={logout} title={t('signOut')}>
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
                    <h3>{t('switchStore')}</h3>
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

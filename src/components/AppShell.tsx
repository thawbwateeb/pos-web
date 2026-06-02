'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LOGO_ICON, Icon } from './Icons';
import { api, eventStream } from '@/lib/api-client';
import type { Bootstrap, PermissionAction } from '@/lib/types';
import { initials } from '@/lib/format';
import { BootstrapProvider } from './BootstrapContext';
import { ToastHost, useToast } from './Toast';

// Each rail entry carries the i18n key for its short label, the icon, AND
// the topbar crumb namespace + page-title key for that route. This way the
// topbar text always matches what the user clicked.
// `perm` is the permission gate — design hides Finance + Settings unless
// the user has access (app.js:261 `state.role==='Manager'`); we map that
// to the equivalent PermissionAction.
const NAV: Array<{
  id: string;
  tKey: string;
  Icon: (props: { size?: number; className?: string }) => any;
  crumb: string;
  titleKey: string;
  perm?: PermissionAction;
}> = [
  // Design app.js:261 hides only Finance + Settings unless Manager.
  // WhatsApp + Reports are visible to all roles.
  { id: 'order',    tKey: 'newOrder',   Icon: Icon.receipt, crumb: 'pointOfSale',     titleKey: 'newOrder' },
  { id: 'orders',   tKey: 'orders',     Icon: Icon.board,   crumb: 'operations',      titleKey: 'ordersBoard' },
  { id: 'payments', tKey: 'payments',   Icon: Icon.card,    crumb: 'finance',         titleKey: 'payments' },
  { id: 'customers',tKey: 'customers',  Icon: Icon.users,   crumb: 'crm',             titleKey: 'customers' },
  { id: 'whatsapp', tKey: 'whatsapp',   Icon: Icon.whatsapp,crumb: 'messaging',       titleKey: 'whatsappBusiness' },
  { id: 'reports',  tKey: 'report',     Icon: Icon.chart,   crumb: 'finance',         titleKey: 'dailySummary' },
  // Design TITLES.finance = ['Financial Vision', 'Planning'] (app.js:279).
  { id: 'finance',  tKey: 'finance',    Icon: Icon.trend,   crumb: 'financialVision', titleKey: 'planning',         perm: 'VIEW_FINANCE' },
  { id: 'settings', tKey: 'settings',   Icon: Icon.gear,    crumb: 'configuration',   titleKey: 'settings',         perm: 'SETTINGS' },
];

interface AppShellProps {
  bootstrap: Bootstrap;
  children: ReactNode;
}

interface SearchResults { orders: any[]; customers: any[] }

function AppShellInner({ bootstrap: initial, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? 'en';
  const t = useTranslations('Nav');
  const tc = useTranslations('Crumbs');
  const toast = useToast();

  const [bootstrap, setBootstrap] = useState(initial);
  const [now, setNow] = useState(() => new Date());
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [shiftStart, setShiftStart] = useState<number | null>(null);
  const [endShiftConfirm, setEndShiftConfirm] = useState<{ h: number; m: number } | null>(null);
  const [badges, setBadges] = useState<{ orders?: number; payments?: number; whatsapp?: number }>({});
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimerRef = useRef<any>();
  const searchWrapRef = useRef<HTMLDivElement>(null);

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
        const [orders, , convos] = await Promise.all([
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

  // Close search results when clicking outside.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const segments = pathname.split('/').filter(Boolean);
  const active = segments[1] || 'order';
  const navMeta = NAV.find((n) => n.id === active);
  const u = bootstrap.user;
  const activeStore = bootstrap.stores.find((s) => s.id === bootstrap.activeStoreId);
  const canManageStores = u.role.isSystemManager || !!u.role.permissions.SETTINGS;
  const shifted = shiftStart !== null;

  function switchStore(id: string) {
    setBootstrap((b) => ({ ...b, activeStoreId: id }));
    document.cookie = `active_store_id=${id}; Path=/; SameSite=Lax`;
    setStorePickerOpen(false);
    router.refresh();
  }

  function toggleShift() {
    if (!shifted) {
      setShiftStart(Date.now());
      return;
    }
    // Compute duration and show confirm
    const mins = Math.floor((Date.now() - (shiftStart ?? Date.now())) / 60_000);
    setEndShiftConfirm({ h: Math.floor(mins / 60), m: mins % 60 });
  }

  function confirmEndShift() {
    if (!endShiftConfirm) return;
    toast.show(t('shiftEnded', { h: endShiftConfirm.h, m: endShiftConfirm.m }));
    setShiftStart(null);
    setEndShiftConfirm(null);
  }

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    router.replace(`/${locale}/login`);
    router.refresh();
  }

  function onSearchChange(v: string) {
    setSearch(v);
    setSearchOpen(true);
    clearTimeout(searchTimerRef.current);
    if (!v.trim()) {
      setSearchResults(null);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const [orders, customers] = await Promise.all([
          api<any[]>(`/orders?q=${encodeURIComponent(v)}&take=6`).catch(() => []),
          api<any[]>(`/customers?q=${encodeURIComponent(v)}&take=6`).catch(() => []),
        ]);
        setSearchResults({ orders, customers });
      } catch {
        setSearchResults({ orders: [], customers: [] });
      }
    }, 180);
  }

  function gotoSearchHit(href: string) {
    setSearch('');
    setSearchOpen(false);
    setSearchResults(null);
    router.push(href);
  }

  return (
    <div className="app">
      {/* Design POS.html:16 + app.js renderRail. */}
      <aside className="rail">
        <div className="logo">{LOGO_ICON}</div>
        <nav className="nav" id="rail-nav">
          {NAV.filter((n) => !n.perm || u.role.isSystemManager || !!u.role.permissions[n.perm]).map(({ id, tKey, Icon: NavIcon }) => {
            const isOn = active === id;
            const badge = (badges as any)[id];
            return (
              <Link
                key={id}
                href={`/${locale}/${id}`}
                prefetch
                className={isOn ? 'active' : ''}
                style={{ textDecoration: 'none' }}
              >
                <NavIcon />
                <span className="nlbl">{t(tKey)}</span>
                {badge ? <span className="badge">{badge}</span> : null}
              </Link>
            );
          })}
        </nav>
        <button className="role" id="role-fab" title={t('switchRole')} onClick={() => setUserMenuOpen(true)}>
          {/* Design app.js:268 — role's first-letter init (M/C/D). */}
          {(u.role.name?.[0] ?? '?').toUpperCase()}
        </button>
      </aside>

      <div className="main">
        <header className="topbar" id="topbar">
          <div className="crumb">
            <span className="k">{tc(navMeta?.crumb ?? 'pointOfSale')}</span>
            <span className="t">{tc(navMeta?.titleKey ?? 'newOrder')}</span>
          </div>
          <div className="search" ref={searchWrapRef} style={{ position: 'relative' }}>
            <Icon.search size={16} />
            <input
              id="global-search"
              autoComplete="off"
              placeholder={t('globalSearch')}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => search && setSearchOpen(true)}
            />
            {searchOpen && searchResults && (
              <div className="gsearch show">
                {searchResults.orders.length === 0 && searchResults.customers.length === 0 ? (
                  <div className="gs-row muted" style={{ justifyContent: 'center' }}>{t('searchEmpty')}</div>
                ) : (
                  <>
                    {searchResults.orders.length > 0 && (
                      <>
                        <div className="gs-sec">{t('searchOrders')}</div>
                        {searchResults.orders.slice(0, 6).map((o: any) => (
                          <div
                            key={o.id}
                            className="gs-row"
                            onClick={() => gotoSearchHit(`/${locale}/orders?id=${o.id}`)}
                          >
                            <Icon.receipt size={14} />
                            <b>#{o.number}</b>
                            <span>{o.customer?.fullName ?? '—'}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{o.status}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {searchResults.customers.length > 0 && (
                      <>
                        <div className="gs-sec">{t('searchCustomers')}</div>
                        {searchResults.customers.slice(0, 6).map((c: any) => (
                          <div
                            key={c.id}
                            className="gs-row"
                            onClick={() => gotoSearchHit(`/${locale}/customers?id=${c.id}`)}
                          >
                            <Icon.users size={14} />
                            <b>{c.fullName}</b>
                            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{c.phone}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="spacer" />
          <button
            className={`checkbtn${shifted ? ' on' : ''}`}
            id="checkbtn"
            onClick={toggleShift}
          >
            {/* Design app.js:290 — "● On shift · Check Out" / "Check In". */}
            {shifted ? `● ${t('onShift')} · ${t('checkOut')}` : t('checkIn')}
          </button>
          {/* Design app.js:291 — storechip uses 16px icons and has title. */}
          <button className="storechip" id="storechip" title={t('switchStore')} onClick={() => setStorePickerOpen((v) => !v)}>
            <Icon.shop size={16} />
            <span className="snm">{activeStore?.name ?? t('pickStore')}</span>
            <Icon.chevd size={14} />
          </button>
          <div className="clock">
            <span className="t">{now.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}</span>
            <span className="d">{now.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
          {/* Design app.js:293-296 — .nm and .av are <span>; no title. */}
          <button className="rolechip" id="rolechip" onClick={() => setUserMenuOpen(true)}>
            <span className="nm">
              <b>{u.role.name}</b>
              <span>{activeStore?.name ?? '—'}</span>
            </span>
            <span className="av">{initials(u.fullName)}</span>
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
                    {s.id === bootstrap.activeStoreId && (
                      <span className="pill paid" style={{ marginLeft: 'auto' }}>Active</span>
                    )}
                  </button>
                ))}
                {canManageStores && (
                  <Link
                    href={`/${locale}/settings/stores`}
                    onClick={() => setStorePickerOpen(false)}
                    className="role-opt"
                    style={{ marginTop: 8 }}
                  >
                    <div className="rav"><Icon.gear size={18} /></div>
                    <div className="ri"><b>{t('manageStores')}</b></div>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {userMenuOpen && (
          <div className="modal-scrim show" onClick={() => setUserMenuOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h3>{t('userMenu')}</h3>
                <button className="x" onClick={() => setUserMenuOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="role-opt sel" style={{ pointerEvents: 'none' }}>
                  <div className="rav">{initials(u.fullName)}</div>
                  <div className="ri">
                    <b>{u.fullName}</b>
                    <span>{u.email}</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 4, fontSize: 13, padding: '8px 12px' }}>
                  <div><span style={{ color: 'var(--muted)' }}>{t('yourRole')}: </span><b>{u.role.name}</b></div>
                  <div><span style={{ color: 'var(--muted)' }}>{t('activeStore')}: </span><b>{activeStore?.name ?? '—'}</b></div>
                </div>
                <button
                  className="role-opt"
                  onClick={() => { setUserMenuOpen(false); logout(); }}
                  style={{ marginTop: 8 }}
                >
                  <div className="rav"><Icon.plug size={18} /></div>
                  <div className="ri"><b>{t('signOut')}</b></div>
                </button>
              </div>
            </div>
          </div>
        )}

        {endShiftConfirm && (
          <div className="modal-scrim show" onClick={() => setEndShiftConfirm(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h3>{t('endShift')}</h3>
                <button className="x" onClick={() => setEndShiftConfirm(null)}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ padding: '8px 12px', fontSize: 14 }}>
                  {t('endShiftConfirm', { h: endShiftConfirm.h, m: endShiftConfirm.m })}
                </p>
                <div style={{ display: 'flex', gap: 8, padding: '8px 12px', justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => setEndShiftConfirm(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={confirmEndShift}>{t('endShift')}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppShell({ bootstrap, children }: AppShellProps) {
  return (
    <BootstrapProvider value={bootstrap}>
      <ToastHost>
        <AppShellInner bootstrap={bootstrap}>{children}</AppShellInner>
      </ToastHost>
    </BootstrapProvider>
  );
}

export function hasPermission(b: Bootstrap, action: PermissionAction): boolean {
  return b.user.role.isSystemManager || !!b.user.role.permissions[action];
}

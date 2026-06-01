'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Icon } from '@/components/Icons';

// Mirrors POS/app.js:1644-1650 — same five groups in the same order, same
// items in the same order. React routes use plural/kebab paths but the
// label, icon, and grouping match the design.
const GROUPS = [
  {
    label: 'Catalogue',
    items: [
      { href: '/settings/catalogue',    label: 'Products',     Ico: Icon.box },
      { href: '/settings/promos',       label: 'Promo Codes',  Ico: Icon.ticket },
      { href: '/settings/loyalty',      label: 'Loyalty',      Ico: Icon.loyal },
      { href: '/settings/subscriptions',label: 'Subscriptions',Ico: Icon.users },
      { href: '/settings/gift-cards',   label: 'Gift Cards',   Ico: Icon.gift },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/settings/inventory',    label: 'Inventory',           Ico: Icon.box },
      { href: '/settings/shifts',       label: 'Cash & Shift',        Ico: Icon.card },
      { href: '/settings/pickup',       label: 'Pickup & Delivery',   Ico: Icon.truck },
      { href: '/settings/racks',        label: 'Racks',               Ico: Icon.box },
      { href: '/settings/zones',        label: 'Service Zones',       Ico: Icon.zone },
      { href: '/settings/hours',        label: 'Business Hours',      Ico: Icon.clock },
    ],
  },
  {
    label: 'Messaging',
    items: [
      { href: '/settings/notifications',label: 'Notifications', Ico: Icon.bell },
      { href: '/settings/chatbot',      label: 'WhatsApp Bot',  Ico: Icon.whatsapp },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/settings/tax',          label: 'Tax & VAT',     Ico: Icon.percent },
      { href: '/finance',               label: 'Finance',       Ico: Icon.trend },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/settings/users',        label: 'Users & Roles',     Ico: Icon.users },
      { href: '/settings/hardware',     label: 'Hardware',          Ico: Icon.plug },
      { href: '/settings/branding',     label: 'Branding & Theme',  Ico: Icon.palette },
      { href: '/settings/stores',       label: 'Stores',            Ico: Icon.shop },
      { href: '/settings/general',      label: 'General',           Ico: Icon.gear },
    ],
  },
];

export default function SettingsNav() {
  const pathname = usePathname();
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? 'en';

  return (
    <>
      {GROUPS.map((g) => (
        <div key={g.label}>
          <div className="set-group">{g.label}</div>
          <div className="set-nav">
            {g.items.map((it) => {
              const href = `/${locale}${it.href}`;
              const active = pathname === href;
              return (
                <Link
                  key={it.href}
                  href={href}
                  className={active ? 'on' : ''}
                  style={{ textDecoration: 'none' }}
                >
                  <button className={active ? 'on' : ''} type="button">
                    <it.Ico size={18} /> {it.label}
                  </button>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

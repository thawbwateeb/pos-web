'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Icon } from '@/components/Icons';

/* Design app.js:1644-1654 — a SINGLE <div class="set-nav"> wraps every
   .set-group title and its sibling buttons. Each button has data-st="${id}".
   No nested wrappers per group. */
const GROUPS: { label: string; items: { id: string; href: string; label: string; Ico: React.ComponentType<{ size?: number }> }[] }[] = [
  {
    label: 'Catalogue',
    items: [
      { id: 'products',    href: '/settings/catalogue',    label: 'Products',     Ico: Icon.box },
      { id: 'promos',      href: '/settings/promos',       label: 'Promo Codes',  Ico: Icon.ticket },
      { id: 'loyalty',     href: '/settings/loyalty',      label: 'Loyalty',      Ico: Icon.loyal },
      { id: 'subs',        href: '/settings/subscriptions',label: 'Subscriptions',Ico: Icon.users },
      { id: 'giftcards',   href: '/settings/gift-cards',   label: 'Gift Cards',   Ico: Icon.gift },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'inventory',   href: '/settings/inventory',    label: 'Inventory',           Ico: Icon.box },
      { id: 'cashshift',   href: '/settings/shifts',       label: 'Cash & Shift',        Ico: Icon.card },
      { id: 'pickup',      href: '/settings/pickup',       label: 'Pickup & Delivery',   Ico: Icon.truck },
      { id: 'racks',       href: '/settings/racks',        label: 'Racks',               Ico: Icon.box },
      { id: 'zones',       href: '/settings/zones',        label: 'Service Zones',       Ico: Icon.zone },
      { id: 'hours',       href: '/settings/hours',        label: 'Business Hours',      Ico: Icon.clock },
    ],
  },
  {
    label: 'Messaging',
    items: [
      { id: 'notify',      href: '/settings/notifications',label: 'Notifications', Ico: Icon.bell },
      { id: 'chatbot',     href: '/settings/chatbot',      label: 'WhatsApp Bot',  Ico: Icon.whatsapp },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'tax',         href: '/settings/tax',          label: 'Tax & VAT',     Ico: Icon.percent },
      { id: 'finance',     href: '/finance',               label: 'Finance',       Ico: Icon.trend },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'roles',       href: '/settings/users',        label: 'Users & Roles',     Ico: Icon.users },
      { id: 'hardware',    href: '/settings/hardware',     label: 'Hardware',          Ico: Icon.plug },
      { id: 'branding',    href: '/settings/branding',     label: 'Branding & Theme',  Ico: Icon.palette },
      { id: 'stores',      href: '/settings/stores',       label: 'Stores',            Ico: Icon.shop },
      { id: 'general',     href: '/settings/general',      label: 'General',           Ico: Icon.gear },
    ],
  },
];

export default function SettingsNav() {
  const pathname = usePathname();
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? 'en';

  return (
    <div className="set-nav">
      {GROUPS.flatMap((g) => [
        <div key={`grp-${g.label}`} className="set-group">{g.label}</div>,
        ...g.items.map((it) => {
          const href = `/${locale}${it.href}`;
          const active = pathname === href;
          return (
            <Link
              key={it.id}
              href={href}
              className={active ? 'on' : ''}
              data-st={it.id}
            >
              <it.Ico size={18} /> {it.label}
            </Link>
          );
        }),
      ])}
    </div>
  );
}

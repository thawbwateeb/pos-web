'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icons';

const GROUPS = [
  {
    label: 'Catalogue',
    items: [
      { href: '/settings/branding', label: 'Branding', Ico: Icon.palette },
      { href: '/settings/catalogue', label: 'Products & Pricing', Ico: Icon.tag },
      { href: '/settings/promos', label: 'Promotions', Ico: Icon.percent },
      { href: '/settings/loyalty', label: 'Loyalty', Ico: Icon.loyal },
      { href: '/settings/gift-cards', label: 'Gift Cards', Ico: Icon.gift },
      { href: '/settings/subscriptions', label: 'Subscriptions', Ico: Icon.users },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/settings/stores', label: 'Stores', Ico: Icon.shop },
      { href: '/settings/pickup', label: 'Pickup & Delivery', Ico: Icon.truck },
      { href: '/settings/areas', label: 'Areas', Ico: Icon.zone },
      { href: '/settings/drivers', label: 'Drivers', Ico: Icon.truck },
      { href: '/settings/inventory', label: 'Inventory', Ico: Icon.box },
      { href: '/settings/shifts', label: 'Cash & Shift', Ico: Icon.cash },
    ],
  },
  {
    label: 'Tax & Compliance',
    items: [
      { href: '/settings/tax', label: 'Tax / VAT', Ico: Icon.percent },
      { href: '/settings/hours', label: 'Hours', Ico: Icon.clock },
      { href: '/settings/notifications', label: 'Notifications', Ico: Icon.bell },
      { href: '/settings/hardware', label: 'Hardware', Ico: Icon.plug },
    ],
  },
  {
    label: 'Access',
    items: [
      { href: '/settings/users', label: 'Users & Roles', Ico: Icon.users },
    ],
  },
];

export default function SettingsNav() {
  const pathname = usePathname();
  return (
    <>
      {GROUPS.map((g) => (
        <div key={g.label}>
          <div className="set-group">{g.label}</div>
          <div className="set-nav">
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} className={pathname === it.href ? 'on' : ''} style={{ textDecoration: 'none' }}>
                <button className={pathname === it.href ? 'on' : ''}>
                  <it.Ico size={18} /> {it.label}
                </button>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

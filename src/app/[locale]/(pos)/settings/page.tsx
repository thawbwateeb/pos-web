import { redirect } from 'next/navigation';
// Products (catalogue) is the most-used settings tab — staff edit prices
// and SKUs daily. Branding is a one-time setup.
export default function Page() { redirect('/settings/catalogue'); }

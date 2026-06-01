import { apiServer } from '@/lib/api-server';
import PickupSettings from './PickupSettings';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [settings, slots] = await Promise.all([
    apiServer<any>('/pickup/settings'),
    apiServer<any[]>('/pickup/slots'),
  ]);
  return <PickupSettings initialSettings={settings} initialSlots={slots} />;
}

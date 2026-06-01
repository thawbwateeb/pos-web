import { apiServer } from '@/lib/api-server';
import ZonesScreen, { type Zone } from './ZonesScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const zones = await apiServer<Zone[]>('/delivery-zones');
  return <ZonesScreen initial={zones} />;
}

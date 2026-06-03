import { apiServer } from '@/lib/api-server';
import MobileOrderingSettings from './MobileOrderingSettings';
import type { OrderingConfig } from './constants';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const config = await apiServer<OrderingConfig>('/mobile-ordering');
  return <MobileOrderingSettings initial={config} />;
}

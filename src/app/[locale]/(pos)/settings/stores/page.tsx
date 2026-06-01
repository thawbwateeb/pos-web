import { apiServer } from '@/lib/api-server';
import type { Bootstrap } from '@/lib/types';
import StoresSettings from './StoresSettings';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [stores, bootstrap] = await Promise.all([
    apiServer<any[]>('/stores'),
    apiServer<Bootstrap>('/session/bootstrap'),
  ]);
  return <StoresSettings initial={stores} activeStoreId={bootstrap.activeStoreId} />;
}

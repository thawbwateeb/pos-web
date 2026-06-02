import { apiServer } from '@/lib/api-server';
import RacksScreen, { type RackRow } from './RacksScreen';
import type { StoreOption } from '@/components/StoreSyncControls';

export const dynamic = 'force-dynamic';

interface StoreRecord {
  id: string;
  name: string;
}

export default async function Page() {
  const [racks, stores] = await Promise.all([
    apiServer<RackRow[]>('/racks'),
    apiServer<StoreRecord[]>('/stores'),
  ]);
  const storeOptions: StoreOption[] = stores.map((s) => ({ id: s.id, name: s.name }));
  return <RacksScreen initial={racks} stores={storeOptions} />;
}

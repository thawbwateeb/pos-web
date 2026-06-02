import { apiServer } from '@/lib/api-server';
import HardwareForm from './HardwareForm';

interface StoreRecord { id: string; name: string }

export const dynamic = 'force-dynamic';

export default async function Page() {
  const stores = await apiServer<StoreRecord[]>('/stores').catch(() => [] as StoreRecord[]);
  return <HardwareForm stores={stores.map((s) => ({ id: s.id, name: s.name }))} />;
}

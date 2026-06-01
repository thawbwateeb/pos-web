import { apiServer } from '@/lib/api-server';
import InventoryScreen from './InventoryScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const items = await apiServer<any[]>('/inventory');
  return <InventoryScreen initial={items} />;
}

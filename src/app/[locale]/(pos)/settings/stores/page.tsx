import { apiServer } from '@/lib/api-server';
import StoresSettings from './StoresSettings';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const stores = await apiServer<any[]>('/stores');
  return <StoresSettings initial={stores} />;
}

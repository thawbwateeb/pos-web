import { apiServer } from '@/lib/api-server';
import HardwareForm from './HardwareForm';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const stores = await apiServer<any[]>('/stores');
  return <HardwareForm stores={stores} />;
}

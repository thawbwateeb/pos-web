import { apiServer } from '@/lib/api-server';
import type { Order } from '@/lib/types';
import InspectionScreen from './InspectionScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [pending, passed] = await Promise.all([
    apiServer<Order[]>('/orders?status=CLEANING&take=100'),
    apiServer<Order[]>('/orders?status=READY&take=100'),
  ]);
  return <InspectionScreen pending={pending} passed={passed} />;
}

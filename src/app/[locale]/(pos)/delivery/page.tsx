import { apiServer } from '@/lib/api-server';
import type { Order, Driver } from '@/lib/types';
import DeliveryScreen from './DeliveryScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  // The delivery screen needs three buckets: orders Ready-for-delivery
  // (status=READY, type=PICKUP_DELIVERY), orders Out-for-delivery
  // (status=DELIVERY), and orders Delivered today (status=COMPLETED,
  // type=PICKUP_DELIVERY, completedAt today). The API's list endpoint
  // returns `driver` on each order which the board endpoint does not,
  // so we use three list calls instead of /orders/board.
  const [ready, out, completed, drivers] = await Promise.all([
    apiServer<Order[]>('/orders?status=READY&take=100'),
    apiServer<Order[]>('/orders?status=DELIVERY&take=100'),
    apiServer<Order[]>('/orders?status=COMPLETED&take=50'),
    apiServer<Driver[]>('/drivers'),
  ]);

  return (
    <DeliveryScreen
      initialReady={ready}
      initialOut={out}
      initialCompleted={completed}
      drivers={drivers}
    />
  );
}

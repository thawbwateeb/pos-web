import { apiServer } from '@/lib/api-server';
import type { Payment, Order } from '@/lib/types';
import PaymentsScreen from './PaymentsScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [payments, orders] = await Promise.all([
    apiServer<Payment[]>('/payments?take=200'),
    apiServer<Order[]>('/orders?take=200'),
  ]);
  return <PaymentsScreen initialPayments={payments} initialOrders={orders} />;
}

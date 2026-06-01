import { apiServer } from '@/lib/api-server';
import type { OrdersBoard } from '@/lib/types';
import OrdersBoardScreen from './OrdersBoardScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const board = await apiServer<OrdersBoard>('/orders/board');
  return <OrdersBoardScreen initial={board} />;
}

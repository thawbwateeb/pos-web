import { apiServer } from '@/lib/api-server';
import type { OrdersBoard } from '@/lib/types';
import type { MetaResponse } from '@/lib/meta-context';
import OrdersBoardScreen from './OrdersBoardScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [board, meta] = await Promise.all([
    apiServer<OrdersBoard>('/orders/board'),
    apiServer<MetaResponse>('/meta'),
  ]);
  return <OrdersBoardScreen initial={board} meta={meta} />;
}

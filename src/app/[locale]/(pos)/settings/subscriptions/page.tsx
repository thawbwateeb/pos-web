import { apiServer } from '@/lib/api-server';
import SubscriptionsScreen from './SubscriptionsScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const plans = await apiServer<any[]>('/subscriptions/plans');
  return <SubscriptionsScreen initial={plans} />;
}

import { apiServer } from '@/lib/api-server';
import LoyaltyForm from './LoyaltyForm';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const s = await apiServer<any>('/loyalty/settings');
  return <LoyaltyForm initial={s ?? {}} />;
}

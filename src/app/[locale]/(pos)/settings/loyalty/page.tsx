import { apiServer } from '@/lib/api-server';
import LoyaltyForm from './LoyaltyForm';
import ReferralForm from './ReferralForm';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const [loyalty, referral] = await Promise.all([
    apiServer<unknown>('/loyalty/settings').catch(() => null),
    apiServer<unknown>('/referrals/settings').catch(() => null),
  ]);
  return (
    <>
      <LoyaltyForm initial={(loyalty as Record<string, unknown> | null) ?? {}} />
      <ReferralForm initial={(referral as Record<string, unknown> | null) ?? {}} />
    </>
  );
}

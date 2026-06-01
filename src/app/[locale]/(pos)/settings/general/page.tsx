import { apiServer } from '@/lib/api-server';
import GeneralScreen, { type BusinessRecord, type BrandingRecord } from './GeneralScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [business, branding] = await Promise.all([
    apiServer<BusinessRecord>('/business'),
    apiServer<BrandingRecord | null>('/branding'),
  ]);
  return <GeneralScreen business={business} branding={branding ?? null} />;
}

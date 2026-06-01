import { apiServer } from '@/lib/api-server';
import BrandingForm from './BrandingForm';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const branding = await apiServer<any>('/branding');
  return <BrandingForm initial={branding} />;
}

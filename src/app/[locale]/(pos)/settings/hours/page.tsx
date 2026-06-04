import { apiServer } from '@/lib/api-server';
import HoursForm from './HoursForm';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [hours, business] = await Promise.all([
    apiServer<any[]>('/business-hours'),
    apiServer<{ expressCutoff?: string | null }>('/business'),
  ]);
  return <HoursForm initial={hours} initialCutoff={business?.expressCutoff ?? undefined} />;
}

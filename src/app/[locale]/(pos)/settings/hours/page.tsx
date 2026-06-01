import { apiServer } from '@/lib/api-server';
import HoursForm from './HoursForm';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const hours = await apiServer<any[]>('/business-hours');
  return <HoursForm initial={hours} />;
}

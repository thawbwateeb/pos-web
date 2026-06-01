import { apiServer } from '@/lib/api-server';
import ShiftsScreen from './ShiftsScreen';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const [current, shifts] = await Promise.all([
    apiServer<any>('/shifts/current').catch(() => null),
    apiServer<any[]>('/shifts'),
  ]);
  return <ShiftsScreen current={current} history={shifts} />;
}

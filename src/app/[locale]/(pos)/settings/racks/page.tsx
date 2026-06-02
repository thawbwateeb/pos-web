import { apiServer } from '@/lib/api-server';
import RacksScreen, { type RackRow } from './RacksScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const racks = await apiServer<RackRow[]>('/racks');
  return <RacksScreen initial={racks} />;
}

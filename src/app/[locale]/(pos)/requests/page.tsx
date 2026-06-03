import { apiServer } from '@/lib/api-server';
import RequestsScreen, { type RequestItem } from './RequestsScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const initial = await apiServer<RequestItem[]>('/requests?status=open');
  return <RequestsScreen initial={initial} />;
}

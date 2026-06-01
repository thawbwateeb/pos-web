import { apiServer } from '@/lib/api-server';
import NotificationsForm from './NotificationsForm';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const data = await apiServer<any>('/notifications');
  return <NotificationsForm initial={data} />;
}

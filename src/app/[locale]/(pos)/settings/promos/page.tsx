import { apiServer } from '@/lib/api-server';
import PromosScreen from './PromosScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const promos = await apiServer<any[]>('/promos');
  return <PromosScreen initial={promos} />;
}

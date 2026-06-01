import { apiServer } from '@/lib/api-server';
import FinanceScreen from './FinanceScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const data = await apiServer<any>('/finance');
  return <FinanceScreen data={data} />;
}

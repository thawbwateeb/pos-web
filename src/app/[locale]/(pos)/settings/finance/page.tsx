import { apiServer } from '@/lib/api-server';
import type { FinanceConfig } from '../../finance/FinanceScreen';
import FinanceSettingsPanel from './FinanceSettingsPanel';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const config = await apiServer<{ data: FinanceConfig; updatedAt: string | null }>('/finance/config');
  return <FinanceSettingsPanel config={config.data} />;
}

import { apiServer } from '@/lib/api-server';
import FinanceScreen, {
  type FinanceConfig,
  type FinanceActualRow,
  type FinanceContribution,
} from './FinanceScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const now = new Date();
  const year = now.getFullYear();
  const [config, actuals, contributions] = await Promise.all([
    apiServer<{ data: FinanceConfig; updatedAt: string | null }>('/finance/config'),
    apiServer<{ year: number; rows: FinanceActualRow[] }>(`/finance/actuals?year=${year}`),
    apiServer<FinanceContribution[]>('/finance/contributions'),
  ]);
  return (
    <FinanceScreen
      config={config.data}
      year={year}
      initialActuals={actuals.rows}
      initialContributions={contributions}
    />
  );
}

import { apiServer } from '@/lib/api-server';
import { AED } from '@/lib/format';
import ReportsScreen from './ReportsScreen';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: { range?: string } }) {
  const range = searchParams.range ?? 'Today';
  const overview = await apiServer<any>(`/reports/overview?range=${range}`);
  return <ReportsScreen overview={overview} range={range} />;
}

import { apiServer } from '@/lib/api-server';
import type { MetaResponse } from '@/lib/meta-context';
import ReportsScreen from './ReportsScreen';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range = 'Today' } = await searchParams;
  const [overview, meta] = await Promise.all([
    apiServer<any>(`/reports/overview?range=${range}`),
    apiServer<MetaResponse>('/meta'),
  ]);
  return <ReportsScreen overview={overview} range={range} meta={meta} />;
}

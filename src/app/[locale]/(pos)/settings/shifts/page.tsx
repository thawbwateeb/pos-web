import { apiServer } from '@/lib/api-server';
import ShiftsScreen, { ShiftHistoryRow, ShiftSummary } from './ShiftsScreen';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const [summary, history] = await Promise.all([
    apiServer<ShiftSummary | null>('/shifts/current/summary').catch(() => null),
    apiServer<ShiftHistoryRow[]>('/shifts').catch(() => [] as ShiftHistoryRow[]),
  ]);
  return <ShiftsScreen initialSummary={summary} initialHistory={history} />;
}

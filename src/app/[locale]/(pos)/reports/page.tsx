import { apiServer } from '@/lib/api-server';
import type { MetaResponse } from '@/lib/meta-context';
import ReportsScreen from './ReportsScreen';

export const dynamic = 'force-dynamic';

type ReportRange = 'Today' | 'Yesterday' | 'Week' | 'Month' | 'Custom';

interface SearchParams {
  range?: string;
  from?: string;
  to?: string;
}

export interface ReportsOverview {
  range: { from: string; to: string };
  orders: number;
  revenue: number;
  collected: number;
  refunds: number;
  refundCount: number;
  discounts: number;
  vatCollected: number;
  vatRate: number;
  /** null when the business doesn't track cost-of-goods. UI omits the card. */
  cost: number | null;
  profit: number | null;
  margin: number | null;
  byStatus: { status: string; _count: number }[];
  byMethod: { method: string; _count: number; _sum: { amount: number | string | null } }[];
  byType: { walkIn: number; pickupDelivery: number };
  itemsCount: number;
  expressCount: number;
  unpaidCount: number;
  turnaroundHours: number | null;
  newCustomers: number;
  loyaltyIssued: number;
  loyaltyRedeemed: number;
  giftCardsSold: number;
  giftCardsRedeemed: number;
  subscriptionsActive: number;
  mrr: number;
  openingFloat: number | null;
  serviceMix: { label: string; value: number }[];
  topAreas: { label: string; value: number }[];
  topItems: { name: string; qty: number | null; revenue: number }[];
}

export interface ReportsHourly {
  range: { from: string; to: string };
  hours: { hour: number; total: number }[];
}

function normalizeRange(r: string | undefined): ReportRange {
  switch (r) {
    case 'Yesterday':
    case 'Week':
    case 'Month':
    case 'Custom':
      return r;
    default:
      return 'Today';
  }
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`).join('&');
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const range = normalizeRange(sp.range);
  const params: Record<string, string | undefined> =
    range === 'Custom'
      ? { range, from: sp.from, to: sp.to }
      : { range };
  const query = qs(params);
  const [overview, hourly, meta] = await Promise.all([
    apiServer<ReportsOverview>(`/reports/overview${query}`),
    apiServer<ReportsHourly>(`/reports/hourly${query}`).catch(() => ({
      range: { from: '', to: '' },
      hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0 })),
    })),
    apiServer<MetaResponse>('/meta'),
  ]);
  return (
    <ReportsScreen
      overview={overview}
      hourly={hourly}
      range={range}
      from={sp.from ?? ''}
      to={sp.to ?? ''}
      meta={meta}
    />
  );
}

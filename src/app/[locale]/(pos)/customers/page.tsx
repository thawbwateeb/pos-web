import { apiServer } from '@/lib/api-server';
import type { Customer } from '@/lib/types';
import CustomersScreen from './CustomersScreen';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const customers = await apiServer<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  return <CustomersScreen initial={customers} initialQ={q ?? ''} />;
}

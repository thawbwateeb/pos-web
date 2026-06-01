import { apiServer } from '@/lib/api-server';
import type { Customer } from '@/lib/types';
import CustomersScreen from './CustomersScreen';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: { q?: string } }) {
  const customers = await apiServer<Customer[]>(`/customers${searchParams.q ? `?q=${encodeURIComponent(searchParams.q)}` : ''}`);
  return <CustomersScreen initial={customers} initialQ={searchParams.q ?? ''} />;
}

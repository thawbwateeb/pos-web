import { apiServer } from '@/lib/api-server';
import TaxForm from './TaxForm';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const tax = await apiServer<any>('/tax');
  return <TaxForm initial={tax} />;
}

import { apiServer } from '@/lib/api-server';
import type { CatalogueResponse, Customer } from '@/lib/types';
import NewOrderScreen from './NewOrderScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const catalogue = await apiServer<CatalogueResponse>('/catalogue');
  return <NewOrderScreen catalogue={catalogue} />;
}

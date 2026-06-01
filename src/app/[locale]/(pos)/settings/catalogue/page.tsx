import { apiServer } from '@/lib/api-server';
import CatalogueEditor from './CatalogueEditor';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const cat = await apiServer<any>('/catalogue');
  return <CatalogueEditor data={cat} />;
}

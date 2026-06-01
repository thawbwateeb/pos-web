import { apiServer } from '@/lib/api-server';
import type { Bootstrap, CatalogueResponse } from '@/lib/types';
import type { MetaResponse } from '@/lib/meta-context';
import NewOrderScreen from './NewOrderScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  // Fetch in parallel and pass directly as props — useMeta()/useBootstrap()
  // contexts from AppShell don't reliably propagate into nested page SSR
  // when the page is a server component, so we hand them down explicitly.
  const [catalogue, meta, bootstrap] = await Promise.all([
    apiServer<CatalogueResponse>('/catalogue'),
    apiServer<MetaResponse>('/meta'),
    apiServer<Bootstrap>('/session/bootstrap'),
  ]);
  return <NewOrderScreen catalogue={catalogue} meta={meta} bootstrap={bootstrap} />;
}

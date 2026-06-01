import { apiServer } from '@/lib/api-server';
import type { Bootstrap, CatalogueResponse, Promo } from '@/lib/types';
import type { MetaResponse } from '@/lib/meta-context';
import NewOrderScreen from './NewOrderScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  // Fetch everything the screen needs in parallel — catalogue items,
  // metadata (statuses, methods), bootstrap (tax + currency + active store),
  // and the active promo codes for the promo picker.
  const [catalogue, meta, bootstrap, promos] = await Promise.all([
    apiServer<CatalogueResponse>('/catalogue'),
    apiServer<MetaResponse>('/meta'),
    apiServer<Bootstrap>('/session/bootstrap'),
    apiServer<Promo[]>('/promos').catch(() => [] as Promo[]),
  ]);
  return (
    <NewOrderScreen
      catalogue={catalogue}
      meta={meta}
      bootstrap={bootstrap}
      promos={promos.filter((p) => p.active)}
    />
  );
}

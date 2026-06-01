import { apiServer } from '@/lib/api-server';
import type { Bootstrap, CatalogueResponse, Order, Promo } from '@/lib/types';
import type { MetaResponse } from '@/lib/meta-context';
import NewOrderScreen from './NewOrderScreen';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const sp = await searchParams;
  const editOrderId = sp?.edit ?? null;

  // Fetch everything the screen needs in parallel — catalogue items,
  // metadata (statuses, methods), bootstrap (tax + currency + active store),
  // and the active promo codes for the promo picker.
  const [catalogue, meta, bootstrap, promos, editing] = await Promise.all([
    apiServer<CatalogueResponse>('/catalogue'),
    apiServer<MetaResponse>('/meta'),
    apiServer<Bootstrap>('/session/bootstrap'),
    apiServer<Promo[]>('/promos').catch(() => [] as Promo[]),
    editOrderId
      ? apiServer<Order>(`/orders/${editOrderId}`).catch(() => null)
      : Promise.resolve(null),
  ]);
  return (
    <NewOrderScreen
      catalogue={catalogue}
      meta={meta}
      bootstrap={bootstrap}
      promos={promos.filter((p) => p.active)}
      editing={editing}
    />
  );
}

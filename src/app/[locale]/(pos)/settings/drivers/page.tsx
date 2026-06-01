import { apiServer } from '@/lib/api-server';
import GenericCRUDList from '@/components/GenericCRUDList';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const drivers = await apiServer<any[]>('/drivers');
  return (
    <div className="set-sec">
      <h2>Drivers</h2>
      <p className="ssub">People who pick up and deliver orders.</p>
      <GenericCRUDList
        endpoint="/drivers"
        initial={drivers}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'zone', label: 'Zone' },
          { key: 'active', label: 'Active', render: (r) => r.active ? '✓' : '—' },
        ]}
        fields={[
          { key: 'name', label: 'Name', required: true },
          { key: 'zone', label: 'Zone' },
        ]}
        title="Drivers"
        labelSingular="driver"
      />
    </div>
  );
}

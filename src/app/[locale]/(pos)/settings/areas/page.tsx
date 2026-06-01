import { apiServer } from '@/lib/api-server';
import GenericCRUDList from '@/components/GenericCRUDList';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const areas = await apiServer<any[]>('/areas');
  return (
    <div className="set-sec">
      <h2>Areas</h2>
      <p className="ssub">Service areas customers can pick when booking pickup &amp; delivery.</p>
      <GenericCRUDList
        endpoint="/areas"
        initial={areas}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'sortOrder', label: 'Sort', align: 'right' },
        ]}
        fields={[
          { key: 'name', label: 'Name', required: true },
          { key: 'sortOrder', label: 'Sort order', type: 'number' },
        ]}
        title="Areas"
        labelSingular="area"
      />
    </div>
  );
}

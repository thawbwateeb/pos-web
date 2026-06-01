import { apiServer } from '@/lib/api-server';
import GenericCRUDList from '@/components/GenericCRUDList';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const items = await apiServer<any[]>('/inventory');
  return (
    <div className="set-sec">
      <h2>Inventory</h2>
      <p className="ssub">Chemicals, packaging, and supplies your store consumes.</p>
      <GenericCRUDList
        endpoint="/inventory"
        initial={items}
        columns={[
          { key: 'name', label: 'Item' },
          { key: 'category', label: 'Category' },
          { key: 'stock', label: 'Stock', align: 'right' },
          { key: 'unit', label: 'Unit' },
          { key: 'reorder', label: 'Reorder at', align: 'right' },
        ]}
        fields={[
          { key: 'name', label: 'Name', required: true },
          { key: 'category', label: 'Category' },
          { key: 'unit', label: 'Unit (e.g. L, pcs)' },
          { key: 'stock', label: 'Current stock', type: 'number' },
          { key: 'reorder', label: 'Reorder threshold', type: 'number' },
          { key: 'cost', label: 'Cost per unit (AED)', type: 'number' },
        ]}
        title="Inventory items"
        labelSingular="item"
      />
    </div>
  );
}

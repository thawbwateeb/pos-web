import { apiServer } from '@/lib/api-server';
import GenericCRUDList from '@/components/GenericCRUDList';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const plans = await apiServer<any[]>('/subscriptions/plans');
  return (
    <div className="set-sec">
      <h2>Subscriptions</h2>
      <p className="ssub">Recurring plans customers can subscribe to.</p>
      <GenericCRUDList
        endpoint="/subscriptions/plans"
        initial={plans}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'price', label: 'Price', align: 'right' },
          { key: 'period', label: 'Period' },
          { key: 'itemsDesc', label: 'Includes' },
        ]}
        fields={[
          { key: 'name', label: 'Name', required: true },
          { key: 'price', label: 'Price (AED)', type: 'number', required: true },
          { key: 'period', label: 'Period', type: 'select', options: ['WEEK', 'MONTH', 'QUARTER', 'YEAR'] },
          { key: 'itemsDesc', label: 'Items description' },
        ]}
        title="Plans"
        labelSingular="plan"
      />
    </div>
  );
}

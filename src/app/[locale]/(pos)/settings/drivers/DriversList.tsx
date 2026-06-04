'use client';

import GenericCRUDList from '@/components/GenericCRUDList';

/**
 * Client wrapper for the drivers CRUD list. The "Active" column uses a
 * `render` function, which cannot be passed from a Server Component to a
 * Client Component (GenericCRUDList) — so the column/field schema lives here,
 * in client code, and the server page only forwards the fetched rows.
 */
export default function DriversList({ initial }: { initial: any[] }) {
  return (
    <GenericCRUDList
      endpoint="/drivers"
      initial={initial}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'zone', label: 'Zone' },
        { key: 'active', label: 'Active', render: (r) => (r.active ? '✓' : '—') },
      ]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'zone', label: 'Zone' },
      ]}
      title="Drivers"
      labelSingular="driver"
    />
  );
}

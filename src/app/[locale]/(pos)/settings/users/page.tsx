import { apiServer } from '@/lib/api-server';
import type { Role, UserRow, Store } from '@/lib/types';
import UsersAndRoles from './UsersAndRoles';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [users, roles, stores] = await Promise.all([
    apiServer<UserRow[]>('/users'),
    apiServer<Role[]>('/roles'),
    apiServer<Store[]>('/stores'),
  ]);
  return <UsersAndRoles initialUsers={users} initialRoles={roles} stores={stores} />;
}

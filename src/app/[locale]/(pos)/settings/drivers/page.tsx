import { apiServer } from '@/lib/api-server';
import DriversList from './DriversList';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const drivers = await apiServer<any[]>('/drivers');
  return (
    <div className="set-sec">
      <h2>Drivers</h2>
      <p className="ssub">People who pick up and deliver orders.</p>
      <DriversList initial={drivers} />
    </div>
  );
}

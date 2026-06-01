import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api-server';
import AppShell from '@/components/AppShell';
import type { Bootstrap } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  let bootstrap: Bootstrap;
  try {
    bootstrap = await apiServer<Bootstrap>('/session/bootstrap');
  } catch (e: any) {
    if (e?.status === 401) redirect('/login');
    throw e;
  }
  return <AppShell bootstrap={bootstrap}>{children}</AppShell>;
}

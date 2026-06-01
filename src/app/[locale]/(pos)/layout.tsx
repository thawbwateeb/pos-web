import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api-server';
import AppShell from '@/components/AppShell';
import type { Bootstrap } from '@/lib/types';

// Layouts persist across navigation between sibling pages — this fetch runs
// once per session, not on every nav.
export const dynamic = 'force-dynamic';

export default async function PosLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  let bootstrap: Bootstrap;
  try {
    bootstrap = await apiServer<Bootstrap>('/session/bootstrap');
  } catch (e: any) {
    if (e?.status === 401) redirect(`/${locale}/login`);
    throw e;
  }
  return <AppShell bootstrap={bootstrap}>{children}</AppShell>;
}

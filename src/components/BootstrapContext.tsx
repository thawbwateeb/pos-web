'use client';

import { createContext, useContext } from 'react';
import type { Bootstrap, PermissionAction } from '@/lib/types';

const Ctx = createContext<Bootstrap | null>(null);

export function BootstrapProvider({ value, children }: { value: Bootstrap; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBootstrap(): Bootstrap {
  const v = useContext(Ctx);
  if (!v) throw new Error('useBootstrap must be inside <BootstrapProvider>');
  return v;
}

export function useActiveStoreId(): string {
  return useBootstrap().activeStoreId;
}

export function useHasPermission(): (a: PermissionAction) => boolean {
  const b = useBootstrap();
  return (a) => b.user.role.isSystemManager || !!b.user.role.permissions[a];
}

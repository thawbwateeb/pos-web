'use client';

import { createContext, useContext, ReactNode } from 'react';

export interface MetaResponse {
  orderStatuses: { key: string; color: string; sort: number }[];
  paymentMethods: { key: string; icon: string }[];
  orderTypes: { key: string }[];
  orderSources: { key: string }[];
  slotKinds: { key: string }[];
  daysOfWeek: { key: string; sort: number }[];
  promoKinds: { key: string }[];
  promoChannels: { key: string }[];
  promoAudiences: { key: string }[];
  taxModes: { key: string }[];
  subscriptionPeriods: { key: string }[];
  cashMovementTypes: { key: string }[];
  inventoryMovementTypes: { key: string }[];
  permissionActions: string[];
  reportRanges: { key: string }[];
}

const Ctx = createContext<MetaResponse | null>(null);

export function MetaProvider({ value, children }: { value: MetaResponse; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMeta(): MetaResponse {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMeta must be inside <MetaProvider>');
  return v;
}

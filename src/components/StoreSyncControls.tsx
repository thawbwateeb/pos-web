'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { useBootstrap } from '@/components/BootstrapContext';

/* Reusable "Copy these settings to all other stores" button for any
   Settings page whose data is keyed by storeId.

   The active store is taken from the global topbar picker (via
   BootstrapContext / active_store_id cookie). The button is hidden when
   the business only has one store. `syncEndpoint` is a POST endpoint
   that copies the active store's settings to every other store, and
   optional `syncBody` is sent as the request body. */
export default function StoreSyncControls({
  syncEndpoint,
  syncBody,
  syncLabel = 'Copy to all other stores',
  busyLabel = 'Copying…',
  successKey = 'copiedTo',
  className,
}: {
  syncEndpoint: string;
  syncBody?: Record<string, unknown>;
  syncLabel?: string;
  busyLabel?: string;
  /* Field on the API response that contains how many stores were touched. */
  successKey?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const t = useTranslations('StoreSync');
  const { stores, activeStoreId } = useBootstrap();
  const activeStore = stores.find((s) => s.id === activeStoreId);
  const others = stores.length - 1;

  if (stores.length <= 1) return null;

  async function copyToAll() {
    if (!(await confirm({ title: t('copyTitle'), message: t('copyConfirm', { count: others }), danger: true }))) return;
    setBusy(true);
    try {
      const r = await api<Record<string, unknown>>(syncEndpoint, {
        method: 'POST',
        body: syncBody ?? {},
      });
      const n = Number(r?.[successKey] ?? 0) || others;
      toast.show(`Copied to ${n} store${n === 1 ? '' : 's'}`);
    } catch {
      toast.show('Failed to copy settings');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className ?? 'store-sync'} style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
        Showing settings for <b style={{ color: 'var(--text)' }}>{activeStore?.name ?? '—'}</b> — switch stores from the topbar.
      </div>
      <button
        type="button"
        className={`btn btn-ghost${busy ? ' btn-loading' : ''}`}
        onClick={copyToAll}
        disabled={busy}
        title={`Copies the active store's settings to all ${others} other store${others === 1 ? '' : 's'}`}
      >
        {busy ? busyLabel : syncLabel}
      </button>
    </div>
  );
}

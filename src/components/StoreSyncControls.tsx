'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

export interface StoreOption {
  id: string;
  name: string;
}

/* Reusable "store picker + Copy to all other stores" control for any
   Settings page whose data is keyed by storeId.

   - `stores` should include only stores in the active business.
   - `storeId` is the currently-selected store (controlled by the parent).
   - `syncEndpoint` is a POST endpoint that copies the active store's
     settings to every other store in the business. The button is hidden
     when only one store exists. Optional `syncBody` is sent as the
     request body (e.g. `{ fromStoreId: storeId }` for /racks/sync). */
export default function StoreSyncControls({
  stores,
  storeId,
  onStoreChange,
  syncEndpoint,
  syncBody,
  syncLabel = 'Copy to all other stores',
  busyLabel = 'Copying…',
  successKey = 'copiedTo',
}: {
  stores: StoreOption[];
  storeId: string;
  onStoreChange: (id: string) => void;
  syncEndpoint: string;
  syncBody?: Record<string, unknown>;
  syncLabel?: string;
  busyLabel?: string;
  /* Field on the API response that contains how many stores were touched. */
  successKey?: string;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function copyToAll() {
    if (stores.length <= 1) return;
    if (!confirm(`Copy these settings to every other store? This overwrites any existing settings on the other ${stores.length - 1} store${stores.length - 1 === 1 ? '' : 's'}.`)) return;
    setBusy(true);
    try {
      const r = await api<Record<string, unknown>>(syncEndpoint, {
        method: 'POST',
        body: syncBody ?? {},
      });
      const n = Number(r?.[successKey] ?? 0) || stores.length - 1;
      toast.show(`Copied to ${n} store${n === 1 ? '' : 's'}`);
    } catch {
      toast.show('Failed to copy settings');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="store-sync" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div className="field" style={{ flex: '1 1 220px', margin: 0 }}>
        <label style={{ fontSize: 11, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, display: 'block', marginBottom: 4 }}>
          Store
        </label>
        <select
          className="input"
          value={storeId}
          onChange={(e) => onStoreChange(e.target.value)}
          style={{ width: '100%' }}
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      {stores.length > 1 && (
        <button
          type="button"
          className={`btn btn-ghost${busy ? ' btn-loading' : ''}`}
          onClick={copyToAll}
          disabled={busy || !storeId}
          title={`Copies the settings shown above to all ${stores.length - 1} other store${stores.length - 1 === 1 ? '' : 's'}`}
        >
          {busy ? busyLabel : syncLabel}
        </button>
      )}
    </div>
  );
}

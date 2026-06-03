'use client';

import { apiBase } from './api-base';

export interface ClientApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  storeId?: string;
  signal?: AbortSignal;
}

/**
 * If multiple in-flight requests race a 401, we don't want each one to
 * POST /auth/refresh in parallel — they'd burn refresh-token rotations
 * against each other. This promise is set by the first 401 handler and
 * awaited by all subsequent ones until refresh resolves.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const r = await fetch(apiBase() + '/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      return r.ok;
    } catch {
      return false;
    } finally {
      // Clear in next tick so concurrent callers still get this run's result.
      setTimeout(() => { refreshInFlight = null; }, 0);
    }
  })();
  return refreshInFlight;
}

/**
 * Browser-side API client. Sends auth cookies automatically via
 * `credentials:'include'`. If a request comes back 401, attempts a single
 * /auth/refresh call (de-duplicated across concurrent callers) and retries
 * the original request once. Throws on non-2xx with the parsed body in
 * `err.detail`.
 *
 * Refresh path: the API sets `refresh_token` at path '/' (was '/auth' —
 * caused a bug where the Next.js middleware never saw the cookie and
 * bounced users to /login every 15 minutes when the access token expired).
 */
export async function api<T>(path: string, opts: ClientApiOptions = {}): Promise<T> {
  const cookieStoreId = typeof document !== 'undefined'
    ? document.cookie.split('; ').find((c) => c.startsWith('active_store_id='))?.split('=')[1]
    : undefined;
  const storeId = opts.storeId ?? cookieStoreId;
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(storeId ? { 'x-store-id': storeId } : {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  };
  let res = await fetch(apiBase() + path, init);

  // Try a transparent refresh + retry on 401 so a stale access token
  // doesn't surface as a logout to the user. Skip the retry for the
  // /auth/* endpoints themselves to avoid infinite loops.
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const ok = await tryRefresh();
    if (ok) {
      res = await fetch(apiBase() + path, init);
    }
  }

  if (!res.ok) {
    let detail: any;
    try { detail = await res.json(); } catch { detail = await res.text(); }
    const err: any = new Error(typeof detail === 'string' ? detail : detail?.message || res.statusText);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  // Notify the app that something changed server-side. AppShell listens
  // and calls router.refresh() so the cached RSC payload for whatever
  // page the user is on (or returns to) reflects the mutation. Without
  // this, navigating away and back to a list view replays the stale
  // snapshot and the user's just-saved change appears to revert.
  const method = init.method ?? 'GET';
  if (method !== 'GET' && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:api-mutate', { detail: { path, method } }));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Server-Sent Events helper. Returns an EventSource bound to /events/stream
 * — cookies attach automatically same-origin or via credentials.
 */
export function eventStream(): EventSource {
  return new EventSource(apiBase() + '/events/stream', { withCredentials: true });
}

/**
 * Build a fully-qualified URL for endpoints we hit outside the JSON
 * `api()` helper — file uploads (multipart) and direct file fetches
 * for <img src="…">.
 */
export function apiUploadUrl(path: string): string {
  return apiBase() + path;
}

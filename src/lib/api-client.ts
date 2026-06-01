'use client';

import { apiBase } from './api-base';

export interface ClientApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  storeId?: string;
  signal?: AbortSignal;
}

/**
 * Browser-side API client. Sends the access_token cookie automatically
 * via credentials:'include'. Throws on non-2xx with the parsed body in
 * `err.detail` so callers can surface validation messages.
 */
export async function api<T>(path: string, opts: ClientApiOptions = {}): Promise<T> {
  const cookieStoreId = typeof document !== 'undefined'
    ? document.cookie.split('; ').find((c) => c.startsWith('active_store_id='))?.split('=')[1]
    : undefined;
  const storeId = opts.storeId ?? cookieStoreId;
  const res = await fetch(apiBase() + path, {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(storeId ? { 'x-store-id': storeId } : {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  if (!res.ok) {
    let detail: any;
    try { detail = await res.json(); } catch { detail = await res.text(); }
    const err: any = new Error(typeof detail === 'string' ? detail : detail?.message || res.statusText);
    err.status = res.status;
    err.detail = detail;
    throw err;
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

import 'server-only';
import { cookies, headers } from 'next/headers';
import { apiBase } from './api-base';

/**
 * Server-side API client. Forwards the incoming Cookie header to the
 * internal API URL so the same access_token authorises the call.
 */
export interface ServerApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  storeId?: string;
  cache?: RequestCache;
  next?: { revalidate?: number; tags?: string[] };
}

export async function apiServer<T>(path: string, opts: ServerApiOptions = {}): Promise<T> {
  const cookieHeader = cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const url = apiBase() + path;
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      cookie: cookieHeader,
      ...(opts.storeId
        ? { 'x-store-id': opts.storeId }
        : cookies().get('active_store_id')?.value
          ? { 'x-store-id': cookies().get('active_store_id')!.value }
          : {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    cache: opts.cache ?? 'no-store',
    next: opts.next,
  });
  if (!res.ok) {
    let detail: any;
    try { detail = await res.json(); } catch { detail = await res.text(); }
    const err: any = new Error(typeof detail === 'string' ? detail : detail.message || res.statusText);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Picks the API base URL for the calling context.
 * - Server (RSC, route handlers, server actions) → API_URL_INTERNAL
 *   (Railway private network, falls back to NEXT_PUBLIC_API_URL in dev).
 * - Browser → NEXT_PUBLIC_API_URL.
 */
export function apiBase(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  return process.env.NEXT_PUBLIC_API_URL || '';
}

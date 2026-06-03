import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intl = createIntlMiddleware(routing);

function apiBase(): string {
  return (
    process.env.API_URL_INTERNAL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001'
  );
}

/**
 * Calls /auth/refresh server-side with the incoming cookie header.
 * Returns the Set-Cookie strings the upstream API responded with on
 * success, or null on failure. We pass these straight through to the
 * browser via NextResponse so the next request carries fresh tokens.
 */
async function tryRefresh(req: NextRequest): Promise<string[] | null> {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  try {
    const r = await fetch(apiBase() + '/auth/refresh', {
      method: 'POST',
      headers: { cookie: cookieHeader },
      // Edge runtime fetch is happy with default cache; the response is
      // never reused regardless.
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const h = r.headers as unknown as { getSetCookie?: () => string[] };
    if (typeof h.getSetCookie === 'function') return h.getSetCookie();
    const single = r.headers.get('set-cookie');
    return single ? [single] : null;
  } catch {
    return null;
  }
}

/**
 * Chains next-intl's locale detection with our auth gate. Routes look like
 *   /en/order, /ar/login, /en/settings/branding, …
 * The first path segment is always the locale; auth is checked on
 * everything except /<locale>/login.
 *
 * Auth flow:
 * - access_token present → authed, fall through to next-intl.
 * - access_token missing, refresh_token present → call /auth/refresh
 *   from middleware itself, forward the new Set-Cookie headers, and
 *   bounce to the SAME url so the browser retries with fresh cookies.
 *   This preserves silent session refresh on full page navigations.
 * - both missing (or refresh failed) → redirect to /login, also expire
 *   the stale refresh cookie so the user lands cleanly.
 *
 * Why the same-url bounce: middleware cannot retroactively rewrite the
 * cookies that downstream server components see on THIS request, but
 * setting Set-Cookie on the response makes the FOLLOWING request carry
 * the fresh access_token, which then hits the hasAccess path.
 *
 * The pre-bounce hasAccess check on /login is required: without it, a
 * user with only refresh_token would refresh, land on /order, layout
 * 401s (because the same-request issue above), redirect to /login,
 * middleware sees the new cookies, bounces to /order — loop.
 */
export default async function middleware(req: NextRequest) {
  const url = new URL(req.nextUrl);
  const segments = url.pathname.split('/').filter(Boolean);
  const maybeLocale = segments[0];
  const isLocale = (routing.locales as readonly string[]).includes(maybeLocale);
  const locale = isLocale ? maybeLocale : routing.defaultLocale;
  const rest = isLocale ? '/' + segments.slice(1).join('/') : url.pathname;

  const hasAccess = !!req.cookies.get('access_token');
  const hasRefresh = !!req.cookies.get('refresh_token');

  const isLogin = rest === '/login' || rest === '/login/';
  if (isLogin && hasAccess) {
    return NextResponse.redirect(new URL(`/${locale}/order`, req.url));
  }

  if (!isLogin && !hasAccess) {
    if (hasRefresh) {
      const setCookies = await tryRefresh(req);
      if (setCookies && setCookies.length) {
        // Bounce to the same URL with new tokens forwarded. Browser
        // stores them and the retry hits the hasAccess path.
        const res = NextResponse.redirect(req.url);
        for (const c of setCookies) res.headers.append('set-cookie', c);
        return res;
      }
    }
    // Either no refresh token or the refresh failed → user must sign in.
    const dest = new URL(`/${locale}/login`, req.url);
    if (rest && rest !== '/' && rest !== '/login') dest.searchParams.set('next', `/${locale}${rest}`);
    const res = NextResponse.redirect(dest);
    if (hasRefresh) {
      // Clear the broken refresh cookie so the next visit lands clean.
      res.cookies.set('refresh_token', '', { path: '/', maxAge: 0 });
      res.cookies.set('refresh_token', '', { path: '/auth', maxAge: 0 });
    }
    return res;
  }

  return intl(req);
}

export const config = {
  matcher: ['/((?!_next|api|favicon|fonts|.*\\..*).*)'],
};

import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intl = createIntlMiddleware(routing);

/**
 * Chains next-intl's locale detection with our auth gate. Routes look like
 *   /en/order, /ar/login, /en/settings/branding, …
 * The first path segment is always the locale; auth is checked on
 * everything except /<locale>/login.
 *
 * Auth rule — ONLY `access_token` counts as "authed". A lone refresh
 * token isn't enough.
 *
 * Why: this previously treated `access_token || refresh_token` as authed
 * so users could navigate silently while the access cookie expired
 * (15 min). That created a redirect loop in production: middleware sees
 * the stale refresh cookie → lets the request through → (pos)/layout
 * fetches /session/bootstrap server-side, gets 401 → redirects to
 * /login → middleware sees the cookies still present → bounces back to
 * /order → 401 again → ERR_TOO_MANY_REDIRECTS.
 *
 * Bouncing only on `access_token` means an expired session takes the
 * user to /login (slightly worse than silent refresh, but functional).
 * The api-client still does transparent /auth/refresh + retry for
 * in-page actions, so the only UX impact is full navigations after the
 * access cookie has expired. Silent server-side refresh in middleware
 * is a follow-up.
 */
export default function middleware(req: NextRequest) {
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
    const dest = new URL(`/${locale}/login`, req.url);
    if (rest && rest !== '/' && rest !== '/login') dest.searchParams.set('next', `/${locale}${rest}`);
    const res = NextResponse.redirect(dest);
    // Clear any stale refresh cookie so the next request doesn't carry
    // an unusable token that confuses upstream logic (and so the user
    // sees a clean login page).
    if (hasRefresh) {
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

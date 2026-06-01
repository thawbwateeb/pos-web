import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intl = createIntlMiddleware(routing);

/**
 * Chains next-intl's locale detection with our auth gate. Routes look like
 *   /en/order, /ar/login, /en/settings/branding, …
 * The first path segment is always the locale; auth is checked on
 * everything except /<locale>/login.
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
  const authed = hasAccess || hasRefresh;

  const isLogin = rest === '/login' || rest === '/login/';
  if (isLogin && authed) {
    return NextResponse.redirect(new URL(`/${locale}/order`, req.url));
  }
  if (!isLogin && !authed) {
    const dest = new URL(`/${locale}/login`, req.url);
    if (rest && rest !== '/' && rest !== '/login') dest.searchParams.set('next', `/${locale}${rest}`);
    return NextResponse.redirect(dest);
  }
  return intl(req);
}

export const config = {
  matcher: ['/((?!_next|api|favicon|fonts|.*\\..*).*)'],
};

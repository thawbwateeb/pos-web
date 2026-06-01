import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  // Always prefix the locale in the URL so RTL/LTR is unambiguous from the path.
  localePrefix: 'always',
});

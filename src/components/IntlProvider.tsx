'use client';

import { NextIntlClientProvider, IntlErrorCode } from 'next-intl';
import type { ReactNode } from 'react';

/**
 * Client-side next-intl provider with non-throwing error handling. Without
 * this, a single missing message key in a client component throws during SSR
 * and surfaces as a full-page "server-side exception". Here a missing key
 * renders its key path as a visible fallback; genuine formatting errors are
 * logged. Messages/locale are passed explicitly from the server layout (a
 * wrapped provider doesn't inherit them automatically).
 */
export default function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: Record<string, unknown>;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={(error) => {
        if (error.code === IntlErrorCode.MISSING_MESSAGE) return;
        // eslint-disable-next-line no-console
        console.error(error);
      }}
      getMessageFallback={({ namespace, key }) => [namespace, key].filter(Boolean).join('.')}
    >
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Root layout — the real <html/> lives in src/app/[locale]/layout.tsx
 * where next-intl can set dir/lang per request.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}

import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ESLint runs as a separate `pnpm lint` — don't gate the production build
  // on stylistic warnings (`any` in API response types, etc.).
  eslint: { ignoreDuringBuilds: true },
};

export default withNextIntl(nextConfig);

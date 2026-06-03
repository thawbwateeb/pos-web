import createNextIntlPlugin from 'next-intl/plugin';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ESLint runs as a separate `pnpm lint` — don't gate the production build
  // on stylistic warnings (`any` in API response types, etc.).
  eslint: { ignoreDuringBuilds: true },
  env: {
    NEXT_PUBLIC_VERSION: `v${pkg.version}`,
  },
};

export default withNextIntl(nextConfig);

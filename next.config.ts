import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/:orgSlug/accounting/periods/:path*',
        destination: '/:orgSlug/settings/periods/:path*',
        permanent: true,
      },
      {
        source: '/:orgSlug/accounting/voucher-types/:path*',
        destination: '/:orgSlug/settings/voucher-types/:path*',
        permanent: true,
      },
      {
        source: '/:orgSlug/settings/monthly-close/:path*',
        destination: '/:orgSlug/accounting/monthly-close/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

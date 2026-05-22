import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server Actions: Next compara el origin del request contra el host para
  // prevenir CSRF. Detrás del túnel (avicontai.mattbits.com) el origin difiere
  // del host interno → sin esto, los Server Actions se rechazan EN SILENCIO.
  experimental: {
    serverActions: {
      allowedOrigins: ['avicontai.mattbits.com'],
    },
  },
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
      {
        // CORS para clientes externos (app móvil Expo) que consumen la API.
        // Origin `*` es seguro acá: la auth es por Bearer (header Authorization),
        // NO por cookies, así que no se necesita Allow-Credentials. El fetch
        // nativo de Android ignora CORS; esto habilita además pruebas en Expo web.
        // Nota: el preflight OPTIONS en browser requeriría un handler propio —
        // fuera de alcance mientras el cliente sea nativo.
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PATCH, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Authorization, Content-Type',
          },
          { key: 'Access-Control-Max-Age', value: '86400' },
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

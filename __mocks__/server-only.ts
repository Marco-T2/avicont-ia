// Stub for `server-only` in Vitest.
// The real package throws when imported outside a Next.js Server Component context.
// In test environments we want server-side modules (permissions.server, permissions.cache)
// to load freely, so this stub is aliased via vitest.config.ts.
export {};

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Guard: Client Components must NEVER import server barrels.
// ESLint 9 flat config cannot detect the "use client" directive at parse time,
// so we scope by path instead: components/** are always client; *-client.{ts,tsx}
// files in app/ are explicitly marked. Server Components, Route Handlers, and
// Services that legitimately import @/features/*/server are excluded by path.
// Incident pattern: a single mis-routed import silently pulls Prisma into the
// client bundle, causing an opaque dns/node-builtin build error instead of a
// clear "server-only" violation.
const serverBarrelPatterns = [
  "@/features/*/server",
  "@/features/*/iva-books/server",
  "@/features/*/financial-statements/server",
];

const banServerBarrels = {
  patterns: serverBarrelPatterns.map((group) => ({
    group: [group],
    message:
      "Client Components cannot import from server barrels. Use @/features/<name> for types/validation, or move the logic to a Server Component.",
  })),
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Enforce server-barrel boundary in definitively-client file paths.
  // Applies to: shared UI components (always client) + *-client files in app/.
  // Does NOT apply to: pages, layouts, route handlers, services, repositories
  // (which legitimately import from @/features/*/server).
  {
    files: [
      "components/**/*.{ts,tsx}",
      "app/**/*-client.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": ["error", banServerBarrels],
    },
  },
]);

export default eslintConfig;

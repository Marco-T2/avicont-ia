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

// ── Hexagonal Architecture boundary enforcement (modules/**) ──
// Source of truth: docs/architecture.md (R1, R2, R4, R5).
// These rules apply ONLY to files under modules/** so that legacy code in
// features/** is unaffected and migration can proceed incrementally.

const banPrismaInDomain = [
  {
    group: ["@prisma/client", "@/generated/prisma/*", "@/lib/prisma"],
    message:
      "R5 violated: domain/application/presentation must NOT import Prisma. Define a port in domain/ and implement it in infrastructure/. See docs/architecture.md.",
  },
];

// R5 carve-out for presentation/ — type-only Prisma imports allowed for
// read-side DTO hydration (Omit/extends). Runtime value imports remain banned.
const banPrismaInPresentation = banPrismaInDomain.map((p) => ({
  ...p,
  allowTypeImports: true,
}));

const banDomainCrossLayer = [
  {
    group: [
      "**/infrastructure/*",
      "**/infrastructure",
      "**/application/*",
      "**/application",
      "**/presentation/*",
      "**/presentation",
    ],
    message:
      "R1 violated: domain/ must NOT depend on application/, infrastructure/, or presentation/. The dependency arrows point INWARD toward domain.",
  },
];

const banAppCrossLayer = [
  {
    group: [
      "**/infrastructure/*",
      "**/infrastructure",
      "**/presentation/*",
      "**/presentation",
    ],
    message:
      "R2 violated: application/ must only depend on domain/. infrastructure and presentation are off-limits.",
  },
];

const banPresInfra = [
  {
    group: ["**/infrastructure/*", "**/infrastructure"],
    message:
      "R4 violated: presentation/ must talk to application/, not infrastructure/. composition-root.ts is the ONE legitimate exception.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Underscore-prefixed bindings are intentionally unused (positional params,
  // exhaustiveness checks, destructuring placeholders). Ignore them globally.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
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
  // Test files: `any` is acceptable for mocks and fixture shortcuts.
  // Prevents stylistic noise from drowning out real issues.
  {
    files: [
      "**/__tests__/**/*.{ts,tsx}",
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // ── Hexagonal R1, R5 — domain/ layer ──
  {
    files: ["modules/*/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [...banPrismaInDomain, ...banDomainCrossLayer] },
      ],
    },
  },
  // ── Hexagonal R2, R5 — application/ layer ──
  {
    files: ["modules/*/application/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [...banPrismaInDomain, ...banAppCrossLayer] },
      ],
    },
  },
  // ── Hexagonal R4, R5 — presentation/ layer ──
  // composition-root.ts is the single legitimate exception: it MUST wire
  // concrete infrastructure adapters into the application service.
  {
    files: ["modules/*/presentation/**/*.{ts,tsx}"],
    ignores: ["modules/*/presentation/composition-root.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [...banPrismaInPresentation, ...banPresInfra] },
      ],
    },
  },
]);

export default eslintConfig;

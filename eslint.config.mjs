import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ── Hexagonal Architecture boundary enforcement (modules/**) ──
// Source of truth: docs/architecture.md (R1, R2, R4, R5).
// modules/** is now the ONLY source layer; the legacy features/ layer is
// retired (see __tests__/feature-boundaries.test.ts). The former
// "client must not import @/features/*/server" guard was deleted with it —
// every pattern it carried named a path that can no longer exist, and the
// client/server boundary inside modules/** is enforced by R1/R2/R4/R5 below.

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
    files: ["modules/**/domain/**/*.{ts,tsx}"],
    ignores: ["modules/**/{domain,application,presentation}/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [...banPrismaInDomain, ...banDomainCrossLayer] },
      ],
    },
  },
  // ── Hexagonal R2, R5 — application/ layer ──
  {
    files: ["modules/**/application/**/*.{ts,tsx}"],
    ignores: ["modules/**/{domain,application,presentation}/__tests__/**"],
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
    files: ["modules/**/presentation/**/*.{ts,tsx}"],
    ignores: [
      "modules/**/presentation/composition-root.ts",
      "modules/**/{domain,application,presentation}/__tests__/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [...banPrismaInPresentation, ...banPresInfra] },
      ],
    },
  },
]);

export default eslintConfig;

# Design: Client/Server Barrel Split

## Technical Approach

Each `features/<name>/` with server code gets two entry points: `index.ts` (client-safe: types, validation, constants) and `server.ts` (Repository + Service re-exports). Every `*.repository.ts`, `*.service.ts`, and new `server.ts` stamps `import "server-only"` as its first statement so Turbopack fails fast if the module is pulled into a client bundle. Server consumers migrate from `@/features/X` to `@/features/X/server`. Client consumers continue to import from `@/features/X` — which becomes guaranteed safe. A machine-checked test (`__tests__/feature-boundaries.test.ts`) and a final ESLint `no-restricted-imports` rule lock the invariant in.

## Architecture Decisions

### ADR-1: Two-entry-point pattern (`index.ts` + `server.ts`)
**Choice**: Flat `server.ts` beside `index.ts` at the feature root. **Alternatives**: `server/index.ts` folder, `index.server.ts` (Next convention for Pages Router, not App Router). **Rationale**: Matches Next 16 App Router convention, short, zero folder churn, aliases cleanly to `@/features/X/server`.

### ADR-2: `server-only` as runtime guardrail
**Choice**: Use the `server-only` npm package (already in `node_modules/server-only/`, version 0.0.1). **Alternatives**: Custom lint rule only; no guardrail. **Rationale**: Next 16 handles `server-only` **internally** and emits the error — install is optional but recommended to satisfy `noUncheckedSideEffectImports`. It is already installed. Confirmed in `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` (lines 551-591).

### ADR-3: Migration ordering by blast radius (smallest first)
**Choice**: 26 ordered per-feature commits (actual measured consumer counts below). **Alternatives**: Big-bang, domain-grouped. **Rationale**: Granular rollback via `git revert`, each commit leaves repo green, TDD-compatible per batch.

### ADR-4: Machine-checked boundary test
**Choice**: Add `__tests__/feature-boundaries.test.ts` that parses every `features/*/index.ts` and asserts (a) no export whose name ends in `Service` or `Repository`, (b) no transitive import resolves to a file beginning with `import "server-only"`. **Alternatives**: Discipline + code review; build-only assertion. **Rationale**: RED-first TDD needs a deterministic failing test — build errors work but only catch real Client-side offenders, not dormant exports. This test fails today for 26 barrels and passes batch-by-batch.

### ADR-5: ESLint `no-restricted-imports` rule
**Choice**: Add `no-restricted-imports` with pattern `@/features/*/server` disallowed from files containing `"use client"` directive. Applied as the FINAL commit. **Alternatives**: Separate plugin, file-path globs (`components/**`). **Rationale**: `"use client"` directive is the real discriminator — pattern-based. Shape sketched in §5.

### ADR-6: `features/shared/` as a single unit
**Choice**: One `features/shared/server.ts` re-exporting `base.repository`, `users.repository`, `users.service`, `permissions.server`, plus anything else that imports Prisma. **Alternatives**: `server/repositories.ts` + `server/services.ts`. **Rationale**: YAGNI. Split further only if `server.ts` exceeds ~40 lines of re-exports.

## File Layout (canonical: `features/org-profile/`)

```
features/org-profile/
  index.ts          ← types + validation + constants ONLY
  server.ts         ← import "server-only"; re-exports Service + Repository
  org-profile.repository.ts   ← first line: import "server-only";
  org-profile.service.ts      ← first line: import "server-only";
  org-profile.types.ts
  org-profile.validation.ts
```

`index.ts` (client-safe):
```ts
export type { OrgProfile, UpdateOrgProfileInput } from "./org-profile.types";
export { updateOrgProfileSchema, logoUploadConstraints } from "./org-profile.validation";
```

`server.ts` (server-only):
```ts
import "server-only";
export { OrgProfileService } from "./org-profile.service";
export { OrgProfileRepository } from "./org-profile.repository";
```

Features with NO server code (`reports/`) get NO `server.ts` — convention is "`server.ts` exists iff server code exists" (user decision #7).

## Migration Batches — Measured Blast Radius

Consumer counts measured via `grep -r 'from "@/features/<name>"'` across `app/`, `features/`, `lib/` on 2026-04-19.

| # | Feature | Consumers | server.ts new | repo/svc files stamped | Commit |
|---|---------|-----------|---------------|------------------------|--------|
| 1 | `org-profile` | 3 | 1 | 2 | `refactor(org-profile): split barrel into client-safe index + server-only server.ts` |
| 2 | `document-signature-config` | 4 | 1 | 2 | same shape |
| 3 | `shared` | 5 | 1 | 3 (base, users repo, users svc, permissions.server) | same shape |
| 4 | `auth` | 1 | 1 | varies | same |
| 5 | `documents` | 1 | 1 | varies | same |
| 6 | `expenses` | 1 | 1 | varies | same |
| 7 | `pricing` | 1 | 1 | varies | same |
| 8 | `ai-agent` | 2 | 1 | varies | same |
| 9 | `monthly-close` | 2 | 1 | varies | same |
| 10 | `mortality` | 2 | 1 | varies | same |
| 11 | `rag` | 2 | 1 | varies | same |
| 12 | `farms` | 5 | 1 | varies | same |
| 13 | `lots` | 5 | 1 | varies | same |
| 14 | `operational-doc-types` | 5 | 1 | varies | same |
| 15 | `dispatch` | 6 | 1 | varies | same |
| 16 | `purchase` | 6 | 1 | varies | same |
| 17 | `sale` | 6 | 1 | varies | same |
| 18 | `payables` | 7 | 1 | varies | same |
| 19 | `product-types` | 7 | 1 | varies | same |
| 20 | `receivables` | 7 | 1 | varies | same |
| 21 | `payment` | 8 | 1 | varies | same |
| 22 | `voucher-types` | 10 | 1 | varies | same |
| 23 | `organizations` | 11 | 1 | 4 (orgs, members, roles repo+svc) | same |
| 24 | `account-balances` | 13 | 1 | varies | same |
| 25 | `org-settings` | 15 | 1 | varies | same |
| 26 | `accounting` | 19 | 1 | 5 (accounts, journal, ledger + sub-barrels) | LAST — own PR, own verification |
| 27 | (final) | — | — | — | `chore(eslint): ban @/features/*/server from client components` |

`reports` is skipped (no server code — user decision #7).
Sub-barrels `accounting/iva-books/` and `accounting/financial-statements/` also have `index.ts` that re-export server code — treat these as part of batch 26.

## Test Strategy (per batch, TDD)

**RED (once, at start of batch 1)**: Add `__tests__/feature-boundaries.test.ts` that iterates `features/*/index.ts`, statically parses exports, and asserts no identifier ending in `Service`/`Repository`. Test fails for all 26 barrels — this is the RED state.

**GREEN (per batch)**: Split the current feature's `index.ts`, add `server.ts`, stamp `server-only` on its `*.repository.ts` / `*.service.ts`, rewrite server consumers, run the boundary test — it now passes for that feature. Run full `pnpm test` + `pnpm build` — both green. Commit.

**REFACTOR (per batch)**: Clean up dead re-exports, collapse redundant paths. No behavioral change.

Boundary test also performs a transitive check: resolve each export from `index.ts` to its source file and assert that file does NOT begin with `import "server-only"`. This catches `export * from "./x"` fan-outs in `shared/index.ts`.

## ESLint Rule Shape (batch 27)

Add to `eslint.config.mjs`:
```js
{
  files: ["**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [{
        group: ["@/features/*/server"],
        message: "Server-only imports are forbidden in Client Components. Import from @/features/X (client-safe barrel) instead.",
      }],
    }],
  },
},
```
Applied only to files with `"use client"` directive via a custom override (ESLint 9 flat config supports `files` + a processor). If per-directive matching is not trivially supported, fallback: apply the rule globally but exempt files under `app/**/route.ts`, `app/**/page.tsx` server entries, and any file without `"use client"`. Investigate during batch 27.

## Rollback Strategy

Per-batch `git revert <sha>` restores the previous feature barrel. Each batch is self-contained — no cross-batch imports. If all 27 must revert: do so in reverse order (27 → 1).

## Risks (refinements beyond proposal)

1. **Re-export cycles**: `features/shared/server.ts` re-exports `base.repository` which is imported by every other feature's `*.repository.ts`. The `server-only` stamp on `base.repository` is authoritative — no cycle because re-exports are hoisted. Verify during batch 3.
2. **`import type` leaks**: TS erases `import type { OrgProfileService } from "@/features/org-profile/server"` to nothing at runtime — compiles, but is semantically wrong and confusing. The ESLint rule (batch 27) must flag it regardless of the `type` modifier.
3. **Cross-feature server-to-server imports**: e.g. `features/payment/payment.service.ts` importing from `features/sale`. Those MUST switch to `@/features/sale/server`. The grep sweep per batch catches them.
4. **Vitest mocks**: `vi.mock("@/features/X", ...)` stubs change to `vi.mock("@/features/X/server", ...)`. Test files per batch updated in the same commit.
5. **Sub-barrels in `accounting/`**: `iva-books/index.ts` and `financial-statements/index.ts` have their own Repository/Service exports. Batch 26 handles them identically — two additional `server.ts` files.

## Open Questions

All 7 original open questions are closed by user decisions. Design-phase questions resolved above. None blocking.

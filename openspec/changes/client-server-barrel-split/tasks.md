# Tasks: Client/Server Barrel Split

> Strict TDD: every code-writing task is RED → GREEN → REFACTOR.
> Each batch ends with a passing test suite AND a commit — violating this breaks the rollback guarantee.
> Total batches: 28 (T0 foundation + T1–T26 features + T27 ESLint).

---

## T0: Foundation — boundary test (RED anchor)

**Files affected**: `__tests__/feature-boundaries.test.ts` (new)

- [x] T0.1 RED: Create `__tests__/feature-boundaries.test.ts`
  - Iterate `features/*/index.ts` using `fs` + `path`
  - Assert no exported identifier ends in `Service` or `Repository`
  - Assert no wildcard `export * from "*.repository.ts"` or `"*.service.ts"` in index.ts
  - Run `pnpm vitest run __tests__/feature-boundaries.test.ts` — test fails for all 27 barrels (26 named + shared wildcard)
- [x] T0.2 REFACTOR: Verified vitest picks up `__tests__/` root directory
  - vitest.config.ts `include: ["**/__tests__/**/*.test.ts"]` in node project already covers root `__tests__/`
  - commit: `test(boundary): add feature-module-boundaries invariant test`

---

## T1: `org-profile` barrel split

**Blast radius**: 3 server consumers | 0 client consumers
**Files affected**: `features/org-profile/index.ts`, `features/org-profile/server.ts` (new), `features/org-profile/org-profile.repository.ts`, `features/org-profile/org-profile.service.ts`, 3 consumer files in `app/`

- [x] T1.1 RED: Confirmed boundary test flags `features/org-profile/index.ts` (failing from T0)
- [x] T1.2 GREEN: Created `features/org-profile/server.ts` with `import "server-only"` + re-exports
- [x] T1.3 GREEN: Stripped server exports from `features/org-profile/index.ts`
- [x] T1.4 GREEN: Added `import "server-only"` to `org-profile.repository.ts` and `org-profile.service.ts`
- [x] T1.5 GREEN: Rewrote 3 server consumer imports to `@/features/org-profile/server`
- [x] T1.6 GREEN: Updated vi.mock paths in 3 test files to `@/features/org-profile/server`
- [x] T1.7 REFACTOR: pnpm tsc --noEmit clean, pnpm vitest 1841/1867 passing, boundary test GREEN for org-profile; committed

---

## T2: `document-signature-config` barrel split

**Blast radius**: 4 server consumers | 0 client consumers
**Files affected**: `features/document-signature-config/index.ts`, `features/document-signature-config/server.ts` (new), `*.repository.ts`, `*.service.ts`, 4 consumer files

- [x] T2.1 RED: Confirmed boundary test flags `document-signature-config`
- [x] T2.2 GREEN: Created `features/document-signature-config/server.ts` with `import "server-only"` + re-exports
- [x] T2.3 GREEN: Stripped server exports from `features/document-signature-config/index.ts`
- [x] T2.4 GREEN: Added `import "server-only"` to repo and service files
- [x] T2.5 GREEN: Rewrote 3 server consumer imports to `/server` (note: 4th consumer is a test that imports ALL_DOCUMENT_PRINT_TYPES only — not a Service consumer)
- [x] T2.6 GREEN: Updated vi.mock paths in 3 test files
- [x] T2.7 REFACTOR: pnpm tsc clean, 1842/1867 passing; committed

---

## T3: `shared` barrel split

**Blast radius**: 5 server consumers | many (permissions/types are cross-cutting)
**Files affected**: `features/shared/index.ts`, `features/shared/server.ts` (new), `base.repository.ts`, `users.repository.ts`, `users.service.ts`, `permissions.server.ts`, `document-lifecycle.service.ts`, `auto-entry-generator.ts`, `accounting-helpers.ts`

- [x] T3.1 RED: Confirmed boundary test flags `features/shared/index.ts` (via wildcard check for base.repository + users.repository + users.service)
- [x] T3.2 GREEN: Created `features/shared/server.ts` with `import "server-only"` + re-exports of base.repository, users.repository, users.service
- [x] T3.3 GREEN: Stripped server wildcard exports from `features/shared/index.ts`; kept errors, middleware, validation, permissions, accounting-helpers
- [x] T3.4 GREEN: Added `import "server-only"` to base.repository.ts, users.repository.ts, users.service.ts (permissions.server.ts already had it)
- [x] T3.5 GREEN: 0 consumer migrations needed — all 5 barrel consumers import only middleware symbols (requireAuth/requireOrgAccess/handleError) which remain in index.ts
- [x] T3.6 GREEN: 0 test mock updates needed — existing tests already mock @/features/shared/permissions.server and @/features/shared/middleware leaf paths
- [x] T3.7 REFACTOR: No re-export cycles. pnpm tsc clean, 1843/1867 passing; committed

---

## T4: `auth` barrel split

**Blast radius**: 1 server consumer
**Files affected**: `features/auth/index.ts`, `features/auth/server.ts` (new), `auth.repository.ts`, `auth.service.ts` (if present), 1 consumer

- [x] T4.1 RED: Confirm boundary test flags `features/auth/index.ts`
- [x] T4.2 GREEN: Create `features/auth/server.ts`; strip server exports from `index.ts`; stamp `server-only` on repo/service files
- [x] T4.3 GREEN: Rewrite 1 server consumer import to `@/features/auth/server`; update mocks
- [x] T4.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T5: `documents` barrel split

**Blast radius**: 1 server consumer
**Files affected**: `features/documents/index.ts`, `features/documents/server.ts` (new), repo/service files, 1 consumer

- [x] T5.1 RED: Confirm boundary test flags `features/documents/index.ts`
- [x] T5.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only` on repo/service
- [x] T5.3 GREEN: Rewrite 1 server consumer; update mocks
- [x] T5.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T6: `expenses` barrel split

**Blast radius**: 1 server consumer
**Files affected**: `features/expenses/index.ts`, `features/expenses/server.ts` (new), repo/service files, 1 consumer

- [x] T6.1 RED: Confirm boundary test flags `features/expenses/index.ts`
- [x] T6.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T6.3 GREEN: Rewrite 1 server consumer; update mocks
- [x] T6.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T7: `pricing` barrel split

**Blast radius**: 1 server consumer
**Files affected**: `features/pricing/index.ts`, `features/pricing/server.ts` (new), repo/service files, 1 consumer

- [x] T7.1 RED: Confirm boundary test flags `features/pricing/index.ts`
- [x] T7.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T7.3 GREEN: Rewrite 1 server consumer; update mocks
- [x] T7.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T8: `ai-agent` barrel split

**Blast radius**: 2 server consumers
**Files affected**: `features/ai-agent/index.ts`, `features/ai-agent/server.ts` (new), repo/service files, 2 consumers

- [x] T8.1 RED: Confirm boundary test flags `features/ai-agent/index.ts`
- [x] T8.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T8.3 GREEN: Rewrite 2 server consumers; update mocks
- [x] T8.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T9: `monthly-close` barrel split

**Blast radius**: 2 server consumers
**Files affected**: `features/monthly-close/index.ts`, `features/monthly-close/server.ts` (new), repo/service files, 2 consumers

- [x] T9.1 RED: Confirm boundary test flags `features/monthly-close/index.ts`
- [x] T9.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T9.3 GREEN: Rewrite 2 server consumers; update mocks
- [x] T9.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T10: `mortality` barrel split

**Blast radius**: 2 server consumers
**Files affected**: `features/mortality/index.ts`, `features/mortality/server.ts` (new), repo/service files, 2 consumers

- [x] T10.1 RED: Confirm boundary test flags `features/mortality/index.ts`
- [x] T10.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T10.3 GREEN: Rewrite 2 server consumers; update mocks
- [x] T10.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T11: `rag` barrel split

**Blast radius**: 2 server consumers
**Files affected**: `features/rag/index.ts`, `features/rag/server.ts` (new), repo/service files, 2 consumers

- [x] T11.1 RED: Confirm boundary test flags `features/rag/index.ts`
- [x] T11.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T11.3 GREEN: Rewrite 2 server consumers; update mocks
- [x] T11.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T12: `farms` barrel split

**Blast radius**: 5 server consumers
**Files affected**: `features/farms/index.ts`, `features/farms/server.ts` (new), repo/service files, 5 consumers

- [x] T12.1 RED: Confirm boundary test flags `features/farms/index.ts`
- [x] T12.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T12.3 GREEN: Rewrite 5 server consumers; update mocks
- [x] T12.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T13: `lots` barrel split

**Blast radius**: 5 server consumers
**Files affected**: `features/lots/index.ts`, `features/lots/server.ts` (new), repo/service files, 5 consumers

- [x] T13.1 RED: Confirm boundary test flags `features/lots/index.ts`
- [x] T13.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T13.3 GREEN: Rewrite 5 server consumers; update mocks
- [x] T13.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T14: `operational-doc-types` barrel split

**Blast radius**: 5 server consumers
**Files affected**: `features/operational-doc-types/index.ts`, `features/operational-doc-types/server.ts` (new), repo/service files, 5 consumers

- [x] T14.1 RED: Confirm boundary test flags `features/operational-doc-types/index.ts`
- [x] T14.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T14.3 GREEN: Rewrite 5 server consumers; update mocks
- [x] T14.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T15: `dispatch` barrel split

**Blast radius**: 6 server consumers
**Files affected**: `features/dispatch/index.ts`, `features/dispatch/server.ts` (new), repo/service files, 6 consumers

- [x] T15.1 RED: Confirm boundary test flags `features/dispatch/index.ts`
- [x] T15.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T15.3 GREEN: Rewrite 6 server consumers; update mocks
- [x] T15.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T16: `purchase` barrel split

**Blast radius**: 6 server consumers
**Files affected**: `features/purchase/index.ts`, `features/purchase/server.ts` (new), repo/service files, 6 consumers

- [x] T16.1 RED: Confirm boundary test flags `features/purchase/index.ts`
- [x] T16.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T16.3 GREEN: Rewrite 6 server consumers; update mocks
- [x] T16.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T17: `sale` barrel split

**Blast radius**: 6 server consumers
**Files affected**: `features/sale/index.ts`, `features/sale/server.ts` (new), repo/service files, 6 consumers

- [x] T17.1 RED: Confirm boundary test flags `features/sale/index.ts`
- [x] T17.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T17.3 GREEN: Rewrite 6 server consumers; update mocks
- [x] T17.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T18: `payables` barrel split

**Blast radius**: 7 server consumers
**Files affected**: `features/payables/index.ts`, `features/payables/server.ts` (new), repo/service files, 7 consumers

- [x] T18.1 RED: Confirm boundary test flags `features/payables/index.ts`
- [x] T18.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T18.3 GREEN: Rewrite 7 server consumers; update mocks
- [x] T18.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T19: `product-types` barrel split

**Blast radius**: 7 server consumers
**Files affected**: `features/product-types/index.ts`, `features/product-types/server.ts` (new), repo/service files, 7 consumers

- [x] T19.1 RED: Confirm boundary test flags `features/product-types/index.ts`
- [x] T19.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T19.3 GREEN: Rewrite 7 server consumers; update mocks
- [x] T19.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T20: `receivables` barrel split

**Blast radius**: 7 server consumers
**Files affected**: `features/receivables/index.ts`, `features/receivables/server.ts` (new), repo/service files, 7 consumers

- [x] T20.1 RED: Confirm boundary test flags `features/receivables/index.ts`
- [x] T20.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T20.3 GREEN: Rewrite 7 server consumers; update mocks
- [x] T20.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T21: `payment` barrel split

**Blast radius**: 8 server consumers
**Files affected**: `features/payment/index.ts`, `features/payment/server.ts` (new), repo/service files, 8 consumers

- [x] T21.1 RED: Confirm boundary test flags `features/payment/index.ts`
- [x] T21.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T21.3 GREEN: Rewrite 8 server consumers (note: cross-feature server-to-server imports from `sale` must use `@/features/sale/server`); update mocks
- [x] T21.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T22: `voucher-types` barrel split

**Blast radius**: 10 server consumers
**Files affected**: `features/voucher-types/index.ts`, `features/voucher-types/server.ts` (new), repo/service files, 10 consumers

- [x] T22.1 RED: Confirm boundary test flags `features/voucher-types/index.ts`
- [x] T22.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T22.3 GREEN: Rewrite 10 server consumers; update mocks
- [x] T22.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; committed

---

## T23: `organizations` barrel split

**Blast radius**: 11 server consumers
**Files affected**: `features/organizations/index.ts`, `features/organizations/server.ts` (new), `organizations.repository.ts`, `organizations.service.ts`, `members.service.ts`, `roles.repository.ts`, `roles.service.ts`, 11 consumers

- [x] T23.1 RED: Confirm boundary test flags `features/organizations/index.ts`
- [x] T23.2 GREEN: Create `features/organizations/server.ts` with `import "server-only"` + re-exports of `OrganizationsRepository`, `OrganizationsService`, `MembersService`, `RolesRepository`, `RolesService`
- [x] T23.3 GREEN: Strip server exports from `features/organizations/index.ts`; keep types, validation exports
- [x] T23.4 GREEN: Add `import "server-only"` to all 5 repo/service files + `roles.service.singleton.ts` (6 total — singleton confirmed server-only via Prisma transitive import)
- [x] T23.5 GREEN: Rewrite 11 server consumers (5 pages + 6 API routes); update 5 test vi.mock paths
- [x] T23.6 REFACTOR: vitest 1864/1867 pass; committed

---

## T24: `account-balances` barrel split

**Blast radius**: 13 server consumers
**Files affected**: `features/account-balances/index.ts`, `features/account-balances/server.ts` (new), repo/service files, 13 consumers

- [x] T24.1 RED: Confirm boundary test flags `features/account-balances/index.ts`
- [x] T24.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only` on repo/service files
- [x] T24.3 GREEN: Rewrite 13 server consumers (pages, API routes, cross-feature services/tests); update vi.mock in balances page test
- [x] T24.4 REFACTOR: vitest 1866/1867 pass; committed (combined with T25)

---

## T25: `org-settings` barrel split

**Blast radius**: 15 server consumers
**Files affected**: `features/org-settings/index.ts`, `features/org-settings/server.ts` (new), repo/service files, 15 consumers

- [x] T25.1 RED: Confirm boundary test flags `features/org-settings/index.ts`
- [x] T25.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [x] T25.3 GREEN: Rewrite 16 consumers (15+1 extra: settings/route.ts splits OrgSettingsService→/server, updateOrgSettingsSchema→/index); update 4 test vi.mock paths
- [x] T25.4 REFACTOR: vitest 1866/1867 pass (1 remaining = accounting/T26); committed

---

## T26: `accounting` barrel split (LARGEST — own PR)

**Blast radius**: 19 server consumers (parent) + sub-barrel consumers
**Files affected**: `features/accounting/index.ts`, `features/accounting/server.ts` (new), `features/accounting/iva-books/index.ts`, `features/accounting/iva-books/server.ts` (new), `features/accounting/financial-statements/index.ts`, `features/accounting/financial-statements/server.ts` (new), all repo/service files, 19+ consumers

> Per ADR (flat `server.ts` layout): sub-features get their OWN `server.ts` at their own directory root.

- [x] T26.1 RED: Confirmed boundary test flagged parent `features/accounting/index.ts` (iva-books/financial-statements not yet scanned — boundary test extended in T26.11 to cover sub-barrels)
- [x] T26.2 GREEN: Created `features/accounting/server.ts` with `import "server-only"` + re-exports of `AccountsRepository`, `AccountsService`, `JournalRepository`, `JournalService`, `LedgerService`
- [x] T26.3 GREEN: Created `features/accounting/iva-books/server.ts` with `import "server-only"` + re-exports of `IvaBooksRepository`, `IvaBooksService`
- [x] T26.4 GREEN: Created `features/accounting/financial-statements/server.ts` with `import "server-only"` + re-exports of `FinancialStatementsRepository`, `FinancialStatementsService`, `GenerateBalanceSheetInput`, `GenerateIncomeStatementInput`, `buildComparativeColumns`
- [x] T26.5 GREEN: Stripped server exports from `features/accounting/index.ts`; kept types + validation + `formatCorrelativeNumber`
- [x] T26.6 GREEN: Stripped server exports from `features/accounting/iva-books/index.ts`; kept types + validation + iva-calc utils + exporters
- [x] T26.7 GREEN: Stripped server exports from `features/accounting/financial-statements/index.ts`; kept builders, calculators, pure utils, types
- [x] T26.8 GREEN: Added `import "server-only"` to all 9 repo/service leaf files
- [x] T26.9 GREEN: Migrated 19 parent-barrel consumers to `/server`; 2 financial-statements API routes to `/financial-statements/server` for Service only (serializeStatement stays on barrel); iva-books consumers already used leaf paths — no migration needed
- [x] T26.10 GREEN: Updated 12 `vi.mock("@/features/accounting")` test mocks to `@/features/accounting/server`
- [x] T26.11 REFACTOR: Extended boundary test to recurse into sub-barrels (28→31 tests); full vitest 1869/1869 pass; no new TS errors; committed `a8902f8`

> RISK FLAG: Design lists 19 consumers for `accounting` but does not break down how many import from `iva-books/` vs `financial-statements/` vs the parent barrel. The grep sweep in T26.9 must count these separately and reconcile against the design's total. If the count differs, flag as a discrepancy before committing.

---

## T27: ESLint `no-restricted-imports` rule

**Files affected**: `eslint.config.mjs` (modified), optional test fixture

- [x] T27.1 RED: Added fixture `components/_bad-client-import-test.tsx` with `"use client"` + imports from `@/features/accounting/server` and `@/features/accounting/iva-books/server` — confirmed 0 errors before rule existed; deleted after
- [x] T27.2 GREEN: Added rule to `eslint.config.mjs` scoped to `components/**` and `app/**/*-client.{ts,tsx}` — ESLint 9 flat config cannot detect the `"use client"` directive in file content so path-glob scoping used per design ADR-5 fallback; all 3 patterns covered (`/server`, `/iva-books/server`, `/financial-statements/server`)
- [x] T27.3 GREEN: `pnpm lint` → 233 problems (121 errors, 112 warnings) — identical to baseline; zero new errors from rule; all violations are pre-existing `@typescript-eslint/no-explicit-any`
- [x] T27.4 REFACTOR: `import type` blocking confirmed (ESLint caught line 4 in fixture); `pnpm tsc --noEmit` pre-existing errors unchanged; `pnpm vitest run` → 1869/1869 pass; committed `e0a441c`

---

## Risks flagged during task breakdown

1. **`fiscal-periods` and `contacts` confirmed to need splits** — Both export Repository+Service from index.ts and have .repository.ts/.service.ts files. Verified in T0 pre-flight. The boundary test correctly catches them (27 failing, not 26). Need to add T4a (fiscal-periods) and T4b (contacts) batches — 0 measured consumers each so only index.ts + server.ts + server-only stamps required. Will be added to tasks.md before T4 apply.
2. **`accounting` sub-barrel consumer count not decomposed** — design shows 19 total consumers for `accounting` but does not split between parent, iva-books, financial-statements barrels. The grep in T26.9 must produce a per-sub-barrel count and reconcile.
3. **`organizations/roles.service.singleton.ts`** — not a standard `*.service.ts` naming pattern; confirm whether it imports Prisma and needs `server-only` stamp before T23.
4. **`features/shared/` transitive fan-out** — `shared/index.ts` uses `export *` style; the boundary test's transitive check is especially important here to catch indirect server-module leaks through `permissions.ts` → any Prisma import.

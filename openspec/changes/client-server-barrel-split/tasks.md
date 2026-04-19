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

- [ ] T4.1 RED: Confirm boundary test flags `features/auth/index.ts`
- [ ] T4.2 GREEN: Create `features/auth/server.ts`; strip server exports from `index.ts`; stamp `server-only` on repo/service files
- [ ] T4.3 GREEN: Rewrite 1 server consumer import to `@/features/auth/server`; update mocks
- [ ] T4.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(auth): split barrel into client-safe index + server-only server.ts`

---

## T5: `documents` barrel split

**Blast radius**: 1 server consumer
**Files affected**: `features/documents/index.ts`, `features/documents/server.ts` (new), repo/service files, 1 consumer

- [ ] T5.1 RED: Confirm boundary test flags `features/documents/index.ts`
- [ ] T5.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only` on repo/service
- [ ] T5.3 GREEN: Rewrite 1 server consumer; update mocks
- [ ] T5.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(documents): split barrel into client-safe index + server-only server.ts`

---

## T6: `expenses` barrel split

**Blast radius**: 1 server consumer
**Files affected**: `features/expenses/index.ts`, `features/expenses/server.ts` (new), repo/service files, 1 consumer

- [ ] T6.1 RED: Confirm boundary test flags `features/expenses/index.ts`
- [ ] T6.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T6.3 GREEN: Rewrite 1 server consumer; update mocks
- [ ] T6.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(expenses): split barrel into client-safe index + server-only server.ts`

---

## T7: `pricing` barrel split

**Blast radius**: 1 server consumer
**Files affected**: `features/pricing/index.ts`, `features/pricing/server.ts` (new), repo/service files, 1 consumer

- [ ] T7.1 RED: Confirm boundary test flags `features/pricing/index.ts`
- [ ] T7.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T7.3 GREEN: Rewrite 1 server consumer; update mocks
- [ ] T7.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(pricing): split barrel into client-safe index + server-only server.ts`

---

## T8: `ai-agent` barrel split

**Blast radius**: 2 server consumers
**Files affected**: `features/ai-agent/index.ts`, `features/ai-agent/server.ts` (new), repo/service files, 2 consumers

- [ ] T8.1 RED: Confirm boundary test flags `features/ai-agent/index.ts`
- [ ] T8.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T8.3 GREEN: Rewrite 2 server consumers; update mocks
- [ ] T8.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(ai-agent): split barrel into client-safe index + server-only server.ts`

---

## T9: `monthly-close` barrel split

**Blast radius**: 2 server consumers
**Files affected**: `features/monthly-close/index.ts`, `features/monthly-close/server.ts` (new), repo/service files, 2 consumers

- [ ] T9.1 RED: Confirm boundary test flags `features/monthly-close/index.ts`
- [ ] T9.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T9.3 GREEN: Rewrite 2 server consumers; update mocks
- [ ] T9.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(monthly-close): split barrel into client-safe index + server-only server.ts`

---

## T10: `mortality` barrel split

**Blast radius**: 2 server consumers
**Files affected**: `features/mortality/index.ts`, `features/mortality/server.ts` (new), repo/service files, 2 consumers

- [ ] T10.1 RED: Confirm boundary test flags `features/mortality/index.ts`
- [ ] T10.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T10.3 GREEN: Rewrite 2 server consumers; update mocks
- [ ] T10.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(mortality): split barrel into client-safe index + server-only server.ts`

---

## T11: `rag` barrel split

**Blast radius**: 2 server consumers
**Files affected**: `features/rag/index.ts`, `features/rag/server.ts` (new), repo/service files, 2 consumers

- [ ] T11.1 RED: Confirm boundary test flags `features/rag/index.ts`
- [ ] T11.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T11.3 GREEN: Rewrite 2 server consumers; update mocks
- [ ] T11.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(rag): split barrel into client-safe index + server-only server.ts`

---

## T12: `farms` barrel split

**Blast radius**: 5 server consumers
**Files affected**: `features/farms/index.ts`, `features/farms/server.ts` (new), repo/service files, 5 consumers

- [ ] T12.1 RED: Confirm boundary test flags `features/farms/index.ts`
- [ ] T12.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T12.3 GREEN: Rewrite 5 server consumers; update mocks
- [ ] T12.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(farms): split barrel into client-safe index + server-only server.ts`

---

## T13: `lots` barrel split

**Blast radius**: 5 server consumers
**Files affected**: `features/lots/index.ts`, `features/lots/server.ts` (new), repo/service files, 5 consumers

- [ ] T13.1 RED: Confirm boundary test flags `features/lots/index.ts`
- [ ] T13.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T13.3 GREEN: Rewrite 5 server consumers; update mocks
- [ ] T13.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(lots): split barrel into client-safe index + server-only server.ts`

---

## T14: `operational-doc-types` barrel split

**Blast radius**: 5 server consumers
**Files affected**: `features/operational-doc-types/index.ts`, `features/operational-doc-types/server.ts` (new), repo/service files, 5 consumers

- [ ] T14.1 RED: Confirm boundary test flags `features/operational-doc-types/index.ts`
- [ ] T14.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T14.3 GREEN: Rewrite 5 server consumers; update mocks
- [ ] T14.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(operational-doc-types): split barrel into client-safe index + server-only server.ts`

---

## T15: `dispatch` barrel split

**Blast radius**: 6 server consumers
**Files affected**: `features/dispatch/index.ts`, `features/dispatch/server.ts` (new), repo/service files, 6 consumers

- [ ] T15.1 RED: Confirm boundary test flags `features/dispatch/index.ts`
- [ ] T15.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T15.3 GREEN: Rewrite 6 server consumers; update mocks
- [ ] T15.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(dispatch): split barrel into client-safe index + server-only server.ts`

---

## T16: `purchase` barrel split

**Blast radius**: 6 server consumers
**Files affected**: `features/purchase/index.ts`, `features/purchase/server.ts` (new), repo/service files, 6 consumers

- [ ] T16.1 RED: Confirm boundary test flags `features/purchase/index.ts`
- [ ] T16.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T16.3 GREEN: Rewrite 6 server consumers; update mocks
- [ ] T16.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(purchase): split barrel into client-safe index + server-only server.ts`

---

## T17: `sale` barrel split

**Blast radius**: 6 server consumers
**Files affected**: `features/sale/index.ts`, `features/sale/server.ts` (new), repo/service files, 6 consumers

- [ ] T17.1 RED: Confirm boundary test flags `features/sale/index.ts`
- [ ] T17.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T17.3 GREEN: Rewrite 6 server consumers; update mocks
- [ ] T17.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(sale): split barrel into client-safe index + server-only server.ts`

---

## T18: `payables` barrel split

**Blast radius**: 7 server consumers
**Files affected**: `features/payables/index.ts`, `features/payables/server.ts` (new), repo/service files, 7 consumers

- [ ] T18.1 RED: Confirm boundary test flags `features/payables/index.ts`
- [ ] T18.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T18.3 GREEN: Rewrite 7 server consumers; update mocks
- [ ] T18.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(payables): split barrel into client-safe index + server-only server.ts`

---

## T19: `product-types` barrel split

**Blast radius**: 7 server consumers
**Files affected**: `features/product-types/index.ts`, `features/product-types/server.ts` (new), repo/service files, 7 consumers

- [ ] T19.1 RED: Confirm boundary test flags `features/product-types/index.ts`
- [ ] T19.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T19.3 GREEN: Rewrite 7 server consumers; update mocks
- [ ] T19.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(product-types): split barrel into client-safe index + server-only server.ts`

---

## T20: `receivables` barrel split

**Blast radius**: 7 server consumers
**Files affected**: `features/receivables/index.ts`, `features/receivables/server.ts` (new), repo/service files, 7 consumers

- [ ] T20.1 RED: Confirm boundary test flags `features/receivables/index.ts`
- [ ] T20.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T20.3 GREEN: Rewrite 7 server consumers; update mocks
- [ ] T20.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(receivables): split barrel into client-safe index + server-only server.ts`

---

## T21: `payment` barrel split

**Blast radius**: 8 server consumers
**Files affected**: `features/payment/index.ts`, `features/payment/server.ts` (new), repo/service files, 8 consumers

- [ ] T21.1 RED: Confirm boundary test flags `features/payment/index.ts`
- [ ] T21.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T21.3 GREEN: Rewrite 8 server consumers (note: cross-feature server-to-server imports from `sale` must use `@/features/sale/server`); update mocks
- [ ] T21.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(payment): split barrel into client-safe index + server-only server.ts`

---

## T22: `voucher-types` barrel split

**Blast radius**: 10 server consumers
**Files affected**: `features/voucher-types/index.ts`, `features/voucher-types/server.ts` (new), repo/service files, 10 consumers

- [ ] T22.1 RED: Confirm boundary test flags `features/voucher-types/index.ts`
- [ ] T22.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T22.3 GREEN: Rewrite 10 server consumers; update mocks
- [ ] T22.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(voucher-types): split barrel into client-safe index + server-only server.ts`

---

## T23: `organizations` barrel split

**Blast radius**: 11 server consumers
**Files affected**: `features/organizations/index.ts`, `features/organizations/server.ts` (new), `organizations.repository.ts`, `organizations.service.ts`, `members.service.ts`, `roles.repository.ts`, `roles.service.ts`, 11 consumers

- [ ] T23.1 RED: Confirm boundary test flags `features/organizations/index.ts`
- [ ] T23.2 GREEN: Create `features/organizations/server.ts` with `import "server-only"` + re-exports of `OrganizationsRepository`, `OrganizationsService`, `MembersService`, `RolesRepository`, `RolesService`
- [ ] T23.3 GREEN: Strip server exports from `features/organizations/index.ts`; keep types, validation exports
- [ ] T23.4 GREEN: Add `import "server-only"` to `organizations.repository.ts`, `organizations.service.ts`, `members.service.ts`, `roles.repository.ts`, `roles.service.ts`
- [ ] T23.5 GREEN: Rewrite 11 server consumers; update mocks (note: `roles.service.singleton.ts` — confirm if it is a server file and needs stamp)
- [ ] T23.6 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(organizations): split barrel into client-safe index + server-only server.ts`

---

## T24: `account-balances` barrel split

**Blast radius**: 13 server consumers
**Files affected**: `features/account-balances/index.ts`, `features/account-balances/server.ts` (new), repo/service files, 13 consumers

- [ ] T24.1 RED: Confirm boundary test flags `features/account-balances/index.ts`
- [ ] T24.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only` on repo/service files
- [ ] T24.3 GREEN: Rewrite 13 server consumers; update mocks
- [ ] T24.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(account-balances): split barrel into client-safe index + server-only server.ts`

---

## T25: `org-settings` barrel split

**Blast radius**: 15 server consumers
**Files affected**: `features/org-settings/index.ts`, `features/org-settings/server.ts` (new), repo/service files, 15 consumers

- [ ] T25.1 RED: Confirm boundary test flags `features/org-settings/index.ts`
- [ ] T25.2 GREEN: Create `server.ts`; strip from `index.ts`; stamp `server-only`
- [ ] T25.3 GREEN: Rewrite 15 server consumers; update mocks
- [ ] T25.4 REFACTOR: `pnpm tsc --noEmit` + `pnpm vitest run` + boundary test; commit: `refactor(org-settings): split barrel into client-safe index + server-only server.ts`

---

## T26: `accounting` barrel split (LARGEST — own PR)

**Blast radius**: 19 server consumers (parent) + sub-barrel consumers
**Files affected**: `features/accounting/index.ts`, `features/accounting/server.ts` (new), `features/accounting/iva-books/index.ts`, `features/accounting/iva-books/server.ts` (new), `features/accounting/financial-statements/index.ts`, `features/accounting/financial-statements/server.ts` (new), all repo/service files, 19+ consumers

> Per ADR (flat `server.ts` layout): sub-features get their OWN `server.ts` at their own directory root.

- [ ] T26.1 RED: Confirm boundary test flags parent `features/accounting/index.ts` AND `iva-books/index.ts` AND `financial-statements/index.ts`
- [ ] T26.2 GREEN: Create `features/accounting/server.ts` with `import "server-only"` + re-exports of `AccountsRepository`, `AccountsService`, `JournalRepository`, `JournalService`, `LedgerService` (and correlative/account-code utils if server-only)
- [ ] T26.3 GREEN: Create `features/accounting/iva-books/server.ts` with `import "server-only"` + re-exports of `IvaBooksRepository`, `IvaBooksService`
- [ ] T26.4 GREEN: Create `features/accounting/financial-statements/server.ts` with `import "server-only"` + re-exports of `FinancialStatementsRepository`, `FinancialStatementsService`
- [ ] T26.5 GREEN: Strip server exports from `features/accounting/index.ts`; keep `accounting.validation.ts`, `*.types.ts`, `account-code.utils.ts`, `account-subtype.utils.ts`, `account-subtype.resolve.ts` exports
- [ ] T26.6 GREEN: Strip server exports from `features/accounting/iva-books/index.ts`; keep types + validation + utils
- [ ] T26.7 GREEN: Strip server exports from `features/accounting/financial-statements/index.ts`; keep types + validation + utils + exporters (non-server)
- [ ] T26.8 GREEN: Add `import "server-only"` to: `accounts.repository.ts`, `accounts.service.ts`, `journal.repository.ts`, `journal.service.ts`, `ledger.service.ts`, `iva-books/iva-books.repository.ts`, `iva-books/iva-books.service.ts`, `financial-statements/financial-statements.repository.ts`, `financial-statements/financial-statements.service.ts`
- [ ] T26.9 GREEN: Rewrite 19+ server consumers in `app/**` and `features/**`; distinguish parent vs sub-barrel import targets (`/server` vs `/iva-books/server` vs `/financial-statements/server`)
- [ ] T26.10 GREEN: Update all `vi.mock("@/features/accounting...")` test mocks to correct split paths
- [ ] T26.11 REFACTOR: Full `pnpm tsc --noEmit` + `pnpm vitest run` (full suite, including accounting sub-tests) + boundary test — ALL 26 features must now pass; commit: `refactor(accounting): split barrel into client-safe index + server-only server.ts`

> RISK FLAG: Design lists 19 consumers for `accounting` but does not break down how many import from `iva-books/` vs `financial-statements/` vs the parent barrel. The grep sweep in T26.9 must count these separately and reconcile against the design's total. If the count differs, flag as a discrepancy before committing.

---

## T27: ESLint `no-restricted-imports` rule

**Files affected**: `eslint.config.mjs` (modified), optional test fixture

- [ ] T27.1 RED: Add a deliberate violation fixture file (e.g., `__tests__/fixtures/bad-client-import.tsx`) with `"use client"` + `import { AccountsService } from "@/features/accounting/server"` — confirm ESLint reports it before the rule exists
- [ ] T27.2 GREEN: Add rule to `eslint.config.mjs`:
  ```js
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/features/*/server", "@/features/*/iva-books/server", "@/features/*/financial-statements/server"],
          message: "Server-only imports forbidden in Client Components. Use @/features/X instead.",
        }],
      }],
    },
  }
  ```
  Scope to files with `"use client"` via ESLint 9 flat config processor or global pattern — investigate and document the approach in the commit body.
- [ ] T27.3 GREEN: Run `pnpm lint` — fix any stragglers the grep sweeps missed in T1–T26; remove the fixture file after lint passes
- [ ] T27.4 REFACTOR: Confirm `import type` from `@/features/*/server` is also blocked (the rule must apply regardless of the `type` modifier); run `pnpm tsc --noEmit` + `pnpm vitest run`; commit: `chore(eslint): ban @/features/*/server imports from Client Components`

---

## Risks flagged during task breakdown

1. **`fiscal-periods` and `contacts` confirmed to need splits** — Both export Repository+Service from index.ts and have .repository.ts/.service.ts files. Verified in T0 pre-flight. The boundary test correctly catches them (27 failing, not 26). Need to add T4a (fiscal-periods) and T4b (contacts) batches — 0 measured consumers each so only index.ts + server.ts + server-only stamps required. Will be added to tasks.md before T4 apply.
2. **`accounting` sub-barrel consumer count not decomposed** — design shows 19 total consumers for `accounting` but does not split between parent, iva-books, financial-statements barrels. The grep in T26.9 must produce a per-sub-barrel count and reconcile.
3. **`organizations/roles.service.singleton.ts`** — not a standard `*.service.ts` naming pattern; confirm whether it imports Prisma and needs `server-only` stamp before T23.
4. **`features/shared/` transitive fan-out** — `shared/index.ts` uses `export *` style; the boundary test's transitive check is especially important here to catch indirect server-module leaks through `permissions.ts` → any Prisma import.

# Tasks: Balance Inicial

## Phase 1 — Types + Repository (foundation)

<!-- RED -->
- [x] T01 Write failing type-shape test — touches `features/accounting/initial-balance/__tests__/initial-balance.types.test.ts`. Acceptance: test file imports the five types (`InitialBalanceRow`, `InitialBalanceGroup`, `InitialBalanceSection`, `InitialBalanceStatement`, `BuildInitialBalanceInput`) from `../initial-balance.types` and uses vitest's `expectTypeOf` to assert each has the expected field shape (e.g., `expectTypeOf<InitialBalanceRow['amount']>().toEqualTypeOf<Prisma.Decimal>()`); fails with `Cannot find module` because the types file does not exist yet.

<!-- GREEN -->
- [x] T02 Create domain types — touches `features/accounting/initial-balance/initial-balance.types.ts`. Acceptance: makes T01 pass; exports all five types with `Prisma.Decimal` for amounts and `AccountSubtype` from Prisma; strict TypeScript, no `any`.

<!-- RED -->
- [x] T03 Write failing integration test for repository — touches `features/accounting/initial-balance/__tests__/initial-balance.repository.test.ts`. Acceptance: seeds two orgs each with a CA voucher via test-db fixture; asserts `getInitialBalanceFromCA(orgA)` returns only orgA lines with correct signed-net (debit−credit for DEUDORA, credit−debit for ACREEDORA) and excludes orgB rows — fails because file does not exist yet.

<!-- RED -->
- [x] T03b Write failing test for `countCAVouchers` — touches `features/accounting/initial-balance/__tests__/initial-balance.repository.test.ts`. Acceptance: seeded org with 0 CAs returns `0`; seeded org with 2 CAs returns `2`; orgB CAs are not counted into orgA's result — fails because method does not exist yet.

<!-- RED -->
- [x] T03c Write failing test for `getOrgMetadata` — touches same `initial-balance.repository.test.ts`. Acceptance: returns `{ razonSocial, nit, representanteLegal, direccion }` for a seeded org; asserts orgId isolation — fails because method does not exist yet.

<!-- GREEN -->
- [x] T04 Create repository — touches `features/accounting/initial-balance/initial-balance.repository.ts`. Acceptance: makes T03, T03b, T03c pass; `getInitialBalanceFromCA(orgId)` uses `$queryRaw`, JOINs journal-entry lines to voucher type `CA`, applies `je."organizationId" = ${orgId}`, casts results to `Prisma.Decimal`, returns `InitialBalanceRow[]`; also exports `countCAVouchers(orgId)` and `getOrgMetadata(orgId)`.

<!-- VERIFY -->
- [x] T05 Run Phase 1 suite — `pnpm vitest run features/accounting/initial-balance`. Acceptance: T01–T04 (incl. T03b, T03c) all green; multi-org isolation confirmed by T03's two-org fixture.

## Phase 2 — Builder (invariant + grouping)

<!-- RED -->
- [ ] T06 Write failing builder test — balanced CA — touches `features/accounting/initial-balance/__tests__/initial-balance.builder.test.ts`. Acceptance: pure fixture with matching ACTIVO = PASIVO+PATRIMONIO totals; asserts two sections, correct per-subtype subtotals, `imbalanced: false`, `imbalanceDelta: 0` — fails because builder does not exist yet.

<!-- RED -->
- [ ] T07 Add failing builder test — imbalanced CA — touches same `initial-balance.builder.test.ts`. Acceptance: forged fixture where ACTIVO ≠ PASIVO+PATRIMONIO; asserts `imbalanced: true` and `imbalanceDelta` equals the Bs. difference — fails because builder does not exist yet.

<!-- RED -->
- [ ] T08 Add failing builder test — multiple CAs — touches same `initial-balance.builder.test.ts`. Acceptance: `caCount: 2` input → `multipleCA: true`, `caCount: 2` on the returned statement — fails because builder does not exist yet.

<!-- GREEN -->
- [ ] T09 Create builder — touches `features/accounting/initial-balance/initial-balance.builder.ts`. Acceptance: pure function, no I/O; groups `InitialBalanceRow[]` by `AccountSubtype` into ACTIVO and PASIVO_PATRIMONIO sections; computes subtotals per group and section totals with `Prisma.Decimal`; sets `imbalanced`, `imbalanceDelta`, `multipleCA`, `caCount`; makes T06–T08 pass.

## Phase 3 — Service (orchestration + errors)

**Phase 3 prerequisite**: verify `NotFoundError` exists in `@/features/shared/errors` (it is used elsewhere in the codebase — `grep -r "NotFoundError" features/ app/` should find imports). If missing, add a minimal `export class NotFoundError extends Error {}` to that module BEFORE writing T10.

<!-- RED -->
- [ ] T10 Write failing service test — no CA → `NotFoundError` — touches `features/accounting/initial-balance/__tests__/initial-balance.service.test.ts`. Acceptance: mocked repo returns empty for `countCAVouchers`; asserts service throws `NotFoundError` — fails because service does not exist yet.

<!-- RED -->
- [ ] T11 Add failing service test — valid CA → full statement — touches same `initial-balance.service.test.ts`. Acceptance: mocked repo returns rows; asserts service returns `InitialBalanceStatement` with orgId, dateAt, sections, builder called with correct `BuildInitialBalanceInput` — fails because service does not exist yet.

<!-- GREEN -->
- [ ] T12 Create service — touches `features/accounting/initial-balance/initial-balance.service.ts`. Acceptance: uses `Promise.all` to fetch CA balances, org metadata, chart-of-accounts with subtypes, and CA count; calls builder; raises `NotFoundError` if no CA exists; makes T10–T11 pass.

## Phase 4 — Exporters

<!-- RED -->
- [ ] T13 Write failing PDF exporter smoke test — touches `features/accounting/initial-balance/exporters/__tests__/initial-balance-pdf.exporter.test.ts`. Acceptance: asserts returned `Buffer` starts with `%PDF`, page size is A4 portrait (`595` pt wide), and stringified pdfmake definition contains org header strings and section labels `ACTIVO` / `PASIVO Y PATRIMONIO` — fails because file does not exist yet.

<!-- GREEN -->
- [ ] T14 Create PDF exporter — touches `features/accounting/initial-balance/exporters/initial-balance-pdf.exporter.ts`. Acceptance: pdfmake A4 portrait; includes org header (razón social, NIT, representante legal, dirección), title `BALANCE INICIAL — Al {fecha CA}`, subtitle `(Expresado en Bolivianos)`, both sections with subtotals, signature footer; makes T13 pass.

<!-- RED -->
- [ ] T15 Write failing XLSX exporter smoke test — touches `features/accounting/initial-balance/exporters/__tests__/initial-balance-xlsx.exporter.test.ts`. Acceptance: asserts sheet name is `"Balance Inicial"`, numeric cells use `numFmt` with 2 decimal places, page setup is A4 portrait — fails because file does not exist yet.

<!-- GREEN -->
- [ ] T16 Create XLSX exporter — touches `features/accounting/initial-balance/exporters/initial-balance-xlsx.exporter.ts`. Acceptance: ExcelJS workbook, single sheet `"Balance Inicial"`, A4 portrait page setup, `numFmt` applied to amount cells, mirrors PDF data (sections, subtotals, totals); makes T15 pass.

## Phase 5 — API Route + RBAC

<!-- RED -->
- [ ] T17 Write failing RBAC page test — touches `app/(dashboard)/[orgSlug]/accounting/initial-balance/__tests__/page-rbac.test.ts`. Acceptance: mocked `requirePermission` throws for unauthorized role; asserts page redirects or rethrows — fails because page does not exist yet.

<!-- RED -->
- [ ] T18 Write failing route handler test — touches `app/api/organizations/[orgSlug]/initial-balance/__tests__/route.test.ts`. Acceptance: mocked service returns statement; `?format=json` → `application/json` with serialized statement; `?format=pdf` → `application/pdf` buffer; `?format=xlsx` → `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`; 404 when service throws `NotFoundError`; 403 on wrong role; also asserts invalid `format` param (e.g., `?format=csv`) returns 400 with a zod validation error — this exercises `initial-balance.validation.ts` — fails because route does not exist yet.

<!-- GREEN -->
- [ ] T19 Create page + route handler + RBAC wiring — touches `app/(dashboard)/[orgSlug]/accounting/initial-balance/page.tsx`, `app/api/organizations/[orgSlug]/initial-balance/route.ts`, `features/accounting/initial-balance/initial-balance.validation.ts`. Acceptance: server page calls `requirePermission`; route handler dispatches `format` param to service + exporters; `runtime = "nodejs"` on route; makes T17–T18 pass.

## Phase 6 — UI

<!-- RED -->
- [ ] T20 Write failing view component test — touches `components/accounting/__tests__/initial-balance-view.test.tsx`. Acceptance: renders two sections with subtotals; shows imbalance alert banner when `imbalanced: true`; shows `multipleCA` warning when flag is set; also asserts amount formatting (es-BO locale): positive `1234.56` → `1.234,56`, negative `-1234.56` → `(1.234,56)` (parentheses, not minus sign), zero in detail cell → empty string, zero in total cell → `0,00` — fails because component does not exist yet.

<!-- RED -->
- [ ] T20b Write failing client orchestrator test — touches `components/accounting/__tests__/initial-balance-page-client.test.tsx`. Acceptance: mocks `fetch` for `/api/organizations/{orgSlug}/initial-balance?format=json` returning a fixture statement; asserts view renders with fetched data; asserts clicking "Export PDF" button fires a fetch to `?format=pdf` and triggers a blob download; asserts clicking "Export XLSX" button fires `?format=xlsx` — fails because client does not exist yet.

<!-- GREEN -->
- [ ] T21 Create view + client orchestrator — touches `components/accounting/initial-balance-view.tsx`, `components/accounting/initial-balance-page-client.tsx`. Acceptance: `InitialBalanceView` renders sections and all banners; `InitialBalancePageClient` fetches `?format=json` and wires Export PDF / Export XLSX buttons; makes T20 and T20b pass.

## Phase 7 — Catalog + Barrels

<!-- RED -->
- [ ] T22 Write failing catalog test — touches `features/reports/__tests__/catalog.test.ts`. Acceptance: (a) bumps `expect(available.length).toBeGreaterThanOrEqual(6)` assertion up to `>= 7`; (b) adds `{ id: "initial-balance", route: "/accounting/initial-balance" }` entry to the `expected` array in "las entradas available conocidas existen con routes correctos" test; (c) adds `it("initial-balance pertenece a la categoría 'estados-financieros'")` assertion; (d) updates the test title string from "las 6 entradas available conocidas..." back to "las 7 entradas available conocidas..." to match the new count; all three new assertions fail because catalog still has `status: "planned"`, `route: null`.

<!-- GREEN -->
- [ ] T23 Flip catalog entry + add barrels — touches `features/reports/catalog.ts`, `features/accounting/initial-balance/server.ts`, `features/accounting/initial-balance/index.ts`. Acceptance: entry reads `status: "available"`, `route: "/accounting/initial-balance"`; barrels export all public surface; makes T22 pass.

## Phase 8 — Full-suite regression

<!-- VERIFY -->
- [ ] T24 Run full test suite — `pnpm vitest run`. Acceptance: all tests green; no regressions in equity-statement, balance-sheet, or catalog suites.

<!-- VERIFY -->
- [ ] T25 Type-check — `pnpm exec tsc --noEmit`. Acceptance: zero new type errors introduced by this change.

## Open Questions

- None.

# Tasks: voucher-types

**TDD Mode**: ON — RED (failing test) → GREEN (implementation) → REFACTOR.

---

## PR1 — Schema migration + seed (foundation)

- [x] 1.1 RED (REQ-C.1/C.3) — write `prisma/seeds/__tests__/voucher-types.seed.test.ts` (D.1-S1..S4): fresh org→8 rows, idempotent re-run, all prefixes populated, no `VoucherTypeCode` import.
- [x] 1.2 GREEN — edit `prisma/schema.prisma`: delete `VoucherTypeCode` enum, change `VoucherTypeCfg.code` to `String`, add `prefix: String`. Run `prisma generate`.
- [x] 1.3 GREEN — create `prisma/migrations/20260418001541_voucher_type_string_prefix/migration.sql` with the 5-step D.2 sequence (ADD prefix → backfill → NOT NULL → `ALTER TYPE TEXT USING code::text` → DROP TYPE).
- [x] 1.4 GREEN — rewrite `prisma/seeds/voucher-types.ts`: upsert on `{organizationId_code}`, 8 string literals + prefixes (D.3).
- [x] 1.5 GREEN — cleanup TS refs: drop `VoucherTypeCode` imports in `features/voucher-types/voucher-types.{service,repository,types}.ts` + `features/shared/auto-entry-generator.ts`; remove `as never` cast at `voucher-types.repository.ts:27`.
- [x] 1.6 VERIFY — seed test 8/8 green + full suite 960/960 + `tsc --noEmit` clean.

## PR2 — correlative.utils signature change

- [x] 2.1 RED (REQ-B.3) — extend `features/accounting/correlative.utils.test.ts`: B.3-S1 `"D"+2026-04-15+15→"D2604-000015"`, B.3-S2 `"N"+2026-04-01+1→"N2604-000001"`, B.3-S3 null/""/undefined→null.
- [x] 2.2 GREEN — `features/accounting/correlative.utils.ts`: delete `TYPE_PREFIX_MAP`, change signature to `(prefix, date, number)`.
- [x] 2.3 GREEN — update 6 callsites per D.8 table: `components/accounting/journal-entry-form.tsx` (2), `journal-entry-list.tsx` (1, build `voucherTypePrefixMap`), `app/api/.../journal/route.ts` (1), `app/api/.../journal/[entryId]/route.ts` (2).
- [x] 2.4 VERIFY — `pnpm vitest run` + `tsc` clean.

## PR3 — Concurrency retry in JournalRepository

- [x] 3.1 RED (REQ-B.1) — `features/accounting/__tests__/get-next-number.test.ts`: S1..S4 (first→1, third→3, independent by type, resets across periods).
- [x] 3.2 RED (REQ-B.2) — `get-next-number-concurrency.test.ts`: S1a no-contention, S1b 2× P2002 then success, S1c 5× concurrent→{1..5}, S2 5× P2002→throws `VOUCHER_NUMBER_CONTENTION`, S2b non-P2002 surfaces.
- [x] 3.3 GREEN — new `features/shared/prisma-errors.ts` with `isPrismaUniqueViolation(err, targetIndex?)`.
- [x] 3.4 GREEN — add `VOUCHER_NUMBER_CONTENTION` to `features/shared/errors.ts`.
- [x] 3.5 GREEN — `features/accounting/journal.repository.ts`: add `createWithRetryTx(tx,…)` with 5-attempt loop; rewrite `create` to delegate.
- [x] 3.6 GREEN — wire `journal.service.createEntry`, `journal.service.createAndPost`, and `features/shared/auto-entry-generator.ts:114-150` onto `createWithRetryTx`.
- [x] 3.7 VERIFY — run journal + sale/purchase/dispatch integration suites.

## PR4 — CRUD API + service + validation

- [x] 4.1 RED (REQ-A.2) — `features/voucher-types/__tests__/voucher-type-create.test.ts`: S1..S4.
- [x] 4.2 RED (REQ-A.3) — `voucher-type-edit.test.ts`: S1..S3 (name ok, prefix ok, `code`→strict reject).
- [x] 4.3 RED (REQ-A.4) — `voucher-type-deactivate.test.ts`: S1..S3.
- [x] 4.4 GREEN — add `VOUCHER_TYPE_CODE_DUPLICATE`, `VOUCHER_TYPE_CODE_IMMUTABLE` to `errors.ts`.
- [x] 4.5 GREEN — `features/voucher-types/voucher-types.validation.ts`: add `createVoucherTypeSchema`, extend `updateVoucherTypeSchema.strict()` + `prefix`.
- [x] 4.6 GREEN — service: `create(orgId,input)` with duplicate guard, `list({isActive?,includeCounts?})`.
- [x] 4.7 GREEN — repository: `create(input)`, `_count` include, `isActive` filter.
- [x] 4.8 GREEN — `app/api/.../voucher-types/route.ts` add POST + `?active=true` filter; `[typeId]/route.ts` strict schema (inherited).

## PR5 — UI manager + dropdown + inactive badge

- [x] 5.1 RED (REQ-A.1) — `components/settings/__tests__/voucher-types-manager.test.tsx`: S1..S3 (order, row metadata, empty state).
- [x] 5.2 GREEN — new `components/settings/voucher-types-manager.tsx` mirroring `operational-doc-types-manager.tsx`.
- [x] 5.3 GREEN — replace placeholder at `app/(dashboard)/[orgSlug]/accounting/voucher-types/page.tsx`.
- [x] 5.4 GREEN — `components/accounting/journal-entry-form.tsx`: filter `isActive || id===editEntry?.voucherTypeId`; render `(inactivo)` hint.
- [x] 5.5 GREEN — `journal-entry-detail.tsx`: accept `voucherTypeActive`, render "Inactivo" badge; `[entryId]/page.tsx` passes `voucherType?.isActive`.

## PR6 — Verify + cleanup

- [ ] 6.1 E2E — manual walk: create type `CX`/prefix `X`, create JE, see `X2604-000001`, deactivate, confirm dropdown filters + historical badge.
- [ ] 6.2 FULL SUITE — `pnpm vitest run` + `tsc --noEmit` clean.
- [ ] 6.3 DOCS — commit `openspec/changes/voucher-types/*` artifacts.

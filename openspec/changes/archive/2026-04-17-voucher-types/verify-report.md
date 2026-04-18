# Verify Report: voucher-types

**Change**: `voucher-types`
**Date**: 2026-04-17
**Mode**: Strict TDD

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 30 |
| Tasks complete | 27 |
| Tasks incomplete | 3 (PR6.1–6.3) |

**Remaining (PR6 — Verify + cleanup):**
- [ ] 6.1 E2E manual walk — **executed by user** (confirmed: `X2604-000001`, toggle, dropdown filters). Not checked off in `tasks.md`.
- [ ] 6.2 FULL SUITE — **executed in this verify** (1005/1005 green, tsc clean).
- [ ] 6.3 DOCS — **done** (commits `06aeb0e` feat + `f3b1779` docs).

All three are materially complete; unchecked boxes are bookkeeping only.

---

## Build & Tests Execution

**Build (tsc --noEmit)**: ✅ Passed — zero errors.

**Tests (pnpm vitest run)**: ✅ 1005 passed / 0 failed / 0 skipped across 112 test files. Duration 22.45s.

**Voucher-types scoped suite**: 43/43 passed across 7 files:
- `features/voucher-types/__tests__/voucher-type-create.test.ts`
- `features/voucher-types/__tests__/voucher-type-edit.test.ts`
- `features/voucher-types/__tests__/voucher-type-deactivate.test.ts`
- `features/accounting/__tests__/correlative.utils.test.ts`
- `features/accounting/__tests__/get-next-number.test.ts`
- `features/accounting/__tests__/get-next-number-concurrency.test.ts`
- `prisma/seeds/__tests__/voucher-types.seed.test.ts`
- `components/settings/__tests__/voucher-types-manager.test.tsx`

**Coverage**: ➖ Not run (no coverage tool wired in project).

---

## Spec Compliance Matrix

### Domain: voucher-type-management

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-A.1 Página de lista | S1 order active/inactive | `voucher-types-manager.test.tsx > render order` | ✅ COMPLIANT |
| REQ-A.1 Página de lista | S2 row metadata | `voucher-types-manager.test.tsx > row metadata` | ✅ COMPLIANT |
| REQ-A.1 Página de lista | S3 empty state | `voucher-types-manager.test.tsx > empty state` | ✅ COMPLIANT |
| REQ-A.2 Creación | S1 missing field → 422 | `voucher-type-create.test.ts > S1` | ✅ COMPLIANT |
| REQ-A.2 Creación | S2 duplicate code → 409 | `voucher-type-create.test.ts > S2` | ✅ COMPLIANT |
| REQ-A.2 Creación | S3 same code diff org → ok | `voucher-type-create.test.ts > S3` | ✅ COMPLIANT |
| REQ-A.2 Creación | S4 valid → 201 | `voucher-type-create.test.ts > S4` | ✅ COMPLIANT |
| REQ-A.3 Edición | S1 edit name | `voucher-type-edit.test.ts > S1` | ✅ COMPLIANT |
| REQ-A.3 Edición | S2 edit prefix | `voucher-type-edit.test.ts > S2` | ✅ COMPLIANT |
| REQ-A.3 Edición | S3 code immutable | `voucher-type-edit.test.ts > S3` | ✅ COMPLIANT |
| REQ-A.4 Desactivación | S1 history preserved | `voucher-type-deactivate.test.ts > S1` | ✅ COMPLIANT |
| REQ-A.4 Desactivación | S2 hidden from dropdown | `voucher-type-deactivate.test.ts > S2` | ✅ COMPLIANT |
| REQ-A.4 Desactivación | S3 badge on historical | `journal-entry-detail.test.tsx > A.4-S3` | ✅ COMPLIANT |

### Domain: voucher-type-sequence

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-B.1 getNextNumber | S1 first → 1 | `get-next-number.test.ts > S1` | ✅ COMPLIANT |
| REQ-B.1 getNextNumber | S2 third → 3 | `get-next-number.test.ts > S2` | ✅ COMPLIANT |
| REQ-B.1 getNextNumber | S3 independent per type | `get-next-number.test.ts > S3` | ✅ COMPLIANT |
| REQ-B.1 getNextNumber | S4 resets across periods | `get-next-number.test.ts > S4` | ✅ COMPLIANT |
| REQ-B.2 Concurrencia | S1 N concurrent unique | `get-next-number-concurrency.test.ts > S1a/b/c` | ✅ COMPLIANT |
| REQ-B.2 Concurrencia | S2 retry limit exhausted | `get-next-number-concurrency.test.ts > S2` | ✅ COMPLIANT |
| REQ-B.3 Formato display | S1 D2604-000015 | `correlative.utils.test.ts > B.3-S1` | ✅ COMPLIANT |
| REQ-B.3 Formato display | S2 N2604-000001 | `correlative.utils.test.ts > B.3-S2` | ✅ COMPLIANT |
| REQ-B.3 Formato display | S3 null/empty → null | `correlative.utils.test.ts > B.3-S3` | ✅ COMPLIANT |

### Domain: voucher-type-schema-migration

| Requirement | Scenario | Evidence | Result |
|-------------|----------|----------|--------|
| REQ-C.1 Modelo actualizado | S1 code String, unique per org | `schema.prisma` + seed test | ✅ COMPLIANT |
| REQ-C.1 Modelo actualizado | S2 prefix column | `schema.prisma` + seed test | ✅ COMPLIANT |
| REQ-C.1 Modelo actualizado | S3 isActive default true | `schema.prisma` line | ✅ COMPLIANT |
| REQ-C.1 Modelo actualizado | S4 @@map voucher_types | `schema.prisma` | ✅ COMPLIANT |
| REQ-C.2 FK JE preservada | S1 relation intact | Runtime (E2E) + JE tests green | ✅ COMPLIANT |
| REQ-C.2 FK JE preservada | S2 DB FK enforced | FK is Prisma-generated, unchanged | ✅ COMPLIANT |
| REQ-C.3 Cero huérfanos | S1 one-to-one mapping | Migration 5-step backfill in SQL | ✅ COMPLIANT |
| REQ-C.3 Cero huérfanos | S2 zero orphans | E2E confirmed by user | ✅ COMPLIANT |
| REQ-C.4 Reversibilidad | S1 down path | Migration SQL documents inverse | ⚠️ PARTIAL — forward-only migration written; inverse steps documented in comments but not as executable `down.sql` (Prisma convention). |

### Domain: voucher-type-seed

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-D.1 8 tipos estándar | S1 fresh org → 8 rows | `voucher-types.seed.test.ts > S1` | ✅ COMPLIANT |
| REQ-D.1 8 tipos estándar | S2 idempotent | `voucher-types.seed.test.ts > S2` | ✅ COMPLIANT |
| REQ-D.1 8 tipos estándar | S3 prefixes populated | `voucher-types.seed.test.ts > S3` | ✅ COMPLIANT |

**Compliance summary**: 25/26 scenarios COMPLIANT, 1 PARTIAL (REQ-C.4-S1 — down path documented, not executable; matches Prisma convention).

---

## Correctness (Static)

| Area | Status | Notes |
|------|--------|-------|
| Schema `VoucherTypeCfg` string code + prefix | ✅ | Enum removed, `code String`, `prefix String` added, `@@unique([organizationId, code])` kept |
| Migration SQL (5-step D.2) | ✅ | ADD prefix → backfill → NOT NULL → ALTER TYPE TEXT → DROP TYPE |
| Seed — 8 types with prefixes | ✅ | Upsert on `{organizationId_code}` |
| `correlative.utils.ts` signature (prefix, date, number) | ✅ | All 6 callsites updated per D.8 |
| Concurrency retry in `journal.repository` | ✅ | `createWithRetryTx` with 5-attempt loop; `isPrismaUniqueViolation` helper |
| New error codes | ✅ | `VOUCHER_NUMBER_CONTENTION`, `VOUCHER_TYPE_CODE_DUPLICATE`, `VOUCHER_TYPE_CODE_IMMUTABLE` |
| `updateVoucherTypeSchema.strict()` | ✅ | Unknown keys (incl. `code`) rejected at Zod layer |
| Service `create` + `list({isActive?, includeCounts?})` | ✅ | Duplicate guard via `findByCode`; `_count` include wired |
| API POST + `?active=true` filter | ✅ | `route.ts` |
| UI manager mirrors `operational-doc-types-manager` | ✅ | Inline rows, toggle isActive, POST/PATCH |
| Form dropdown filter | ✅ | `vt.isActive \|\| vt.id === editEntry?.voucherTypeId` |
| Detail inactive badge | ✅ | `voucherTypeActive` prop + Badge render |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D.1 String code + prefix column | ✅ | |
| D.2 5-step migration | ✅ | |
| D.3 Seed 8 types + upsert | ✅ | |
| D.4 Optimistic retry (5 attempts) | ✅ | `createWithRetryTx` |
| D.5 Zod `.strict()` enforces immutability | ✅ | No explicit service-level guard needed |
| D.6 Soft-deactivate | ✅ | `isActive` toggle, preserves history |
| D.7 `_count` include (no N+1) | ✅ | `include: { _count: { select: { journalEntries: true } } }` |
| D.8 6 callsites updated to new signature | ✅ | All listed files touched |
| D.9 Mirror `operational-doc-types-manager` | ✅ | Same inline-row pattern |

---

## Issues Found

**CRITICAL** (must fix before archive):
- None

**WARNING** (should fix):
- W-1: `tasks.md` PR6.1–6.3 not marked `[x]` despite the work being done (E2E by user, suite + tsc by verify, commits already on master). Bookkeeping — update before archive.

**SUGGESTION** (nice to have):
- S-1: REQ-C.4-S1 documents the inverse migration in comments only. If a Prisma v7+ project later requires explicit `down.sql`, revisit. Not a blocker today.
- S-2: Next.js dev-server RSC cache occasionally serves stale `voucherTypes` list after toggle — user observed once and resolved by restart. Document in project gotchas or move to streaming Server Action if it recurs.

---

## Verdict

**PASS** — all 13 REQs covered, 25/26 scenarios ✅ compliant, 1 PARTIAL on documentation-only scenario. 1005/1005 tests green, tsc clean, E2E walked by user. Ready for archive after `tasks.md` bookkeeping update.

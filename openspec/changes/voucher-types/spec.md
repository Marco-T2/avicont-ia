# Spec: voucher-types

## Change: `voucher-types`

## Overview

Migrate `VoucherTypeCfg.code` from a Prisma enum (`VoucherTypeCode`) to a plain `String`, enabling dynamic code management without schema migrations or deploys. Introduce a `prefix` column on `VoucherTypeCfg` so the display format `{prefix}{YYMM}-{NNNNNN}` is driven by the database row rather than a hardcoded TS map. Deliver full per-org CRUD (list, create, edit, soft-deactivate) with an admin UI. Expand the standard seed from 5 to 8 Bolivian voucher types (adding CN Nómina, CM Depreciación, CB Bancario). Harden `getNextNumber()` against race conditions via optimistic retry on unique-constraint violation.

**4 domains — 13 REQs — 26 scenarios**

---

## Domain: voucher-type-management

> CRUD admin for `VoucherTypeCfg` rows scoped to a single organization.

### REQ-A.1 — Página de lista

**List page** at `/organizations/[orgSlug]/settings/voucher-types` renders all voucher types for the organization ordered by code.

| Scenario | Description | Expected outcome |
|----------|-------------|-----------------|
| S1 | Page renders with mixed active/inactive types | Active types appear first; inactive types appear below (or in a separate "Inactivos" section) with a visual badge |
| S2 | Each row renders metadata | Every row shows: code, name, prefix, active status badge, and the count of journal entries that reference it |
| S3 | Empty state | An organization with zero voucher types shows an empty-state prompt to create the first type |

**Test file**: `features/accounting/voucher-type/__tests__/voucher-type-list.test.ts`

---

### REQ-A.2 — Formulario de creación

**POST** `/api/organizations/[orgSlug]/voucher-types` with input validation.

| Scenario | Description | Expected outcome |
|----------|-------------|-----------------|
| S1 | Missing required field | Submitting without `code`, `name`, or `prefix` → validation error 422 naming the missing field |
| S2 | Duplicate code within same org | Creating with a code already used in the same org → 409 with error code `VOUCHER_TYPE_CODE_DUPLICATE` |
| S3 | Duplicate code in different org | Same code used in another org → creation succeeds (per-org uniqueness only) |
| S4 | Valid creation | All required fields provided → 201 with the created `VoucherTypeCfg` payload; row appears in the list |

**Test file**: `features/accounting/voucher-type/__tests__/voucher-type-create.test.ts`

---

### REQ-A.3 — Formulario de edición

**PATCH** `/api/organizations/[orgSlug]/voucher-types/[id]` — `name`, `prefix`, and `isActive` are editable; `code` is IMMUTABLE after creation.

| Scenario | Description | Expected outcome |
|----------|-------------|-----------------|
| S1 | Edit name succeeds | PATCH `{ name: "Nuevo nombre" }` → 200, name updated, code unchanged |
| S2 | Edit prefix succeeds | PATCH `{ prefix: "X" }` → 200, prefix updated; subsequent `formatCorrelativeNumber` uses the new prefix |
| S3 | Attempt to change code | PATCH `{ code: "CX" }` → 400 with error code `VOUCHER_TYPE_CODE_IMMUTABLE` |

**Rationale**: `code` is immutable because `JournalEntry.voucherTypeId` is a FK to the row ID; the code is a human-readable stable key and changing it post-creation breaks auditing.

**Test file**: `features/accounting/voucher-type/__tests__/voucher-type-edit.test.ts`

---

### REQ-A.4 — Desactivación suave

**PATCH** `.../[id]` with `{ isActive: false }` — soft-deactivate a voucher type.

| Scenario | Description | Expected outcome |
|----------|-------------|-----------------|
| S1 | Deactivating preserves history | After deactivation, all existing `JournalEntry` rows with that `voucherTypeId` are unchanged (number, date, formatted display all intact) |
| S2 | Inactive type hidden from creation dropdowns | A `GET /api/.../voucher-types?active=true` (or the service's default list for create-JE dropdowns) does NOT include the deactivated type |
| S3 | Inactive type visible in existing-entry detail | A `JournalEntry` detail view that references the inactive type still renders code, name, and formatted correlative without error; an "inactivo" badge is shown |

**Test file**: `features/accounting/voucher-type/__tests__/voucher-type-deactivate.test.ts`

---

## Domain: voucher-type-sequence

> Independent correlative numbering per `(organizationId, voucherTypeId, periodId)`.

### REQ-B.1 — Siguiente número correlativo

`getNextNumber(organizationId, voucherTypeId, periodId)` returns `prevMax + 1` for the (org, type, period) triple.

| Scenario | Description | Expected outcome |
|----------|-------------|-----------------|
| S1 | First entry in period | No prior entries for `(org, type, period)` → returns `1` |
| S2 | Third entry in period | Two entries already exist → returns `3` |
| S3 | Independent per voucher type | Type A has 5 entries in period P; type B has 0 entries in period P → `getNextNumber(org, typeB, P)` returns `1` |
| S4 | Resets across periods | Type A has 10 entries in period P1; period P2 has no entries for type A → `getNextNumber(org, typeA, P2)` returns `1` |

**Test file**: `features/accounting/journal/__tests__/get-next-number.test.ts`

---

### REQ-B.2 — Resiliencia ante concurrencia

`getNextNumber` must not produce duplicate numbers when called concurrently for the same `(org, voucherType, period)`.

| Scenario | Description | Expected outcome |
|----------|-------------|-----------------|
| S1 | N concurrent calls — all unique | Fire N simultaneous `getNextNumber` calls for the same triple → each receives a distinct value; the resulting set equals `{1, 2, …, N}` with no duplicates and no gaps |
| S2 | Retry limit exhausted | After the configured maximum retry attempts (5) all fail due to contention → the function throws `VOUCHER_NUMBER_CONTENTION` error |

**Implementation note (non-normative)**: the MECHANISM (optimistic retry on `@@unique` constraint violation) is in the design doc — this spec only asserts the observable outcome.

**Test file**: `features/accounting/journal/__tests__/get-next-number-concurrency.test.ts`

---

### REQ-B.3 — Formato de display

`formatCorrelativeNumber` emits `{prefix}{YYMM}-{NNNNNN}`, where `prefix` is read from the `VoucherTypeCfg.prefix` column, not a hardcoded map.

| Scenario | Description | Expected outcome |
|----------|-------------|-----------------|
| S1 | Known type with DB prefix | `voucherType.prefix = "D"`, period ends 2026-04-*, `number = 15` → `"D2604-000015"` |
| S2 | New type with custom prefix | `voucherType.prefix = "N"` (CN Nómina), first entry in 2026-04 → `"N2604-000001"` |
| S3 | Unknown / null prefix | `voucherType.prefix` is `null` or empty string → function returns `null` (same behaviour as today for unknown codes) |

**Test file**: `features/accounting/correlative.utils.test.ts` (extend existing)

---

## Domain: voucher-type-schema-migration

> Prisma schema changes to replace the enum with a String column and add `prefix`.

### REQ-C.1 — Modelo VoucherTypeCfg actualizado

`VoucherTypeCfg` in `schema.prisma` satisfies:

| Scenario | Description | Expected outcome |
|----------|-------------|-----------------|
| S1 | `code` is String, unique per org | `code: String` with `@@unique([organizationId, code])`; the `VoucherTypeCode` enum is removed from the schema |
| S2 | `prefix` column exists | `prefix: String` present on the model; single character (enforced at service layer, not DB) |
| S3 | `isActive` default | `isActive: Boolean @default(true)` present |
| S4 | Model maps to `voucher_types` table | `@@map("voucher_types")` unchanged |

---

### REQ-C.2 — FK de JournalEntry preservada

`JournalEntry.voucherTypeId` remains a valid FK to `VoucherTypeCfg.id`.

| Scenario | Description | Expected outcome |
|----------|-------------|-----------------|
| S1 | FK relation intact after migration | A `JournalEntry` row created before migration still resolves its `voucherType` include without error |
| S2 | DB-level constraint enforced | Attempting to insert a `JournalEntry` with a non-existent `voucherTypeId` raises a foreign-key constraint error (not a Prisma validation error) |

---

### REQ-C.3 — Data migration — cero huérfanos

The migration script must map every existing `JournalEntry` to a valid `VoucherTypeCfg` row.

| Scenario | Description | Expected outcome |
|----------|-------------|-----------------|
| S1 | One-to-one mapping | For each distinct enum value present in `journal_entries.voucherTypeId` (pre-migration), a `VoucherTypeCfg` row with the matching `code` string exists post-migration |
| S2 | Zero orphans | After running `prisma migrate deploy` on a DB seeded with entries of all 5 original types, a query `SELECT COUNT(*) FROM journal_entries je LEFT JOIN voucher_types vt ON je.voucher_type_id = vt.id WHERE vt.id IS NULL` returns 0 |

---

### REQ-C.4 — Migración reversible

The migration has an explicit down path.

| Scenario | Description | Expected outcome |
|----------|-------------|-----------------|
| S1 | Down migration compiles | The generated SQL `down` migration drops the `prefix` column, casts `code` back to the enum type, and drops the `VoucherTypeCode` enum (data loss for codes outside the original 5 is acceptable and documented) |

---

## Domain: voucher-type-seed

> Expanded standard seed for Bolivian accounting.

### REQ-D.1 — 8 tipos estándar por organización

`seedVoucherTypes(organizationId)` creates all 8 standard types.

| Code | Name | Prefix |
|------|------|--------|
| CI | Comprobante de Ingreso | I |
| CE | Comprobante de Egreso | E |
| CD | Comprobante de Diario | D |
| CT | Comprobante de Traspaso | T |
| CA | Comprobante de Apertura | A |
| CN | Comprobante de Nómina | N |
| CM | Comprobante de Depreciación | M |
| CB | Comprobante Bancario | B |

| Scenario | Description | Expected outcome |
|----------|-------------|-----------------|
| S1 | Fresh org gets all 8 | `seedVoucherTypes` on an org with zero voucher types → 8 rows created |
| S2 | Idempotent on re-run | Running `seedVoucherTypes` a second time on the same org → 0 additional rows; existing rows unchanged (upsert on `organizationId + code`) |
| S3 | Prefixes populated | Every seeded row has a non-empty `prefix` matching the table above |

**Test file**: `prisma/seeds/__tests__/voucher-types.seed.test.ts`

---

## Files Modified (estimated)

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Remove `VoucherTypeCode` enum; add `prefix: String` to `VoucherTypeCfg`; change `code` to `String` |
| `prisma/migrations/YYYYMMDD_voucher_type_string_prefix/migration.sql` | New migration |
| `prisma/seeds/voucher-types.ts` | Add CN, CM, CB with prefixes; switch to `upsert`; remove `VoucherTypeCode` import |
| `features/accounting/correlative.utils.ts` | Remove `TYPE_PREFIX_MAP`; accept `prefix: string` param instead of `voucherTypeCode` |
| `features/accounting/voucher-type/voucher-type.repository.ts` | New — CRUD queries |
| `features/accounting/voucher-type/voucher-type.service.ts` | New — business rules (immutability guard, duplicate check, active filter) |
| `features/accounting/voucher-type/voucher-type.types.ts` | New — TS types / DTOs |
| `features/accounting/journal.repository.ts` | Update `getNextNumber` for optimistic retry; update callers of `formatCorrelativeNumber` to pass `prefix` |
| `app/organizations/[orgSlug]/settings/voucher-types/page.tsx` | Replace "Próximamente" placeholder with list component |
| `app/organizations/[orgSlug]/settings/voucher-types/new/page.tsx` | New — create form page |
| `app/organizations/[orgSlug]/settings/voucher-types/[id]/edit/page.tsx` | New — edit form page |
| `app/api/organizations/[orgSlug]/voucher-types/route.ts` | Add POST handler |
| `app/api/organizations/[orgSlug]/voucher-types/[id]/route.ts` | New — PATCH handler |
| `components/accounting/voucher-type-list.tsx` | New |
| `components/accounting/voucher-type-form.tsx` | New |
| `components/accounting/journal-entry-form.tsx` | Filter dropdown to `isActive=true` types only |
| `components/accounting/journal-entry-list.tsx` | Render formatted correlative from `voucherType.prefix` |
| `components/accounting/journal-entry-detail.tsx` | Show inactive badge when `voucherType.isActive=false` |

---

## Success Criteria

- Zero regressions in existing journal entry tests
- Each REQ has at least one RED→GREEN test cycle
- Migration runs cleanly against a database seeded with journal entries of all 5 original types: zero orphan entries post-migration
- Concurrent creation of 50 journal entries for the same (voucherType, period) produces exactly the set {1…50} — no duplicates, no gaps
- A Contador can create a "Nómina" voucher type from the UI, create a journal entry with it, and see `N2604-000001` in the entry list
- Inactive types are absent from the create-entry dropdown but visible (with badge) in historical entry detail

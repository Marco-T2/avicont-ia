# Spec: voucher-type-schema-migration

**Change**: `voucher-types`
**Domain**: `voucher-type-schema-migration`

## Overview

Prisma schema migration from `VoucherTypeCode` enum to `String` on `VoucherTypeCfg.code`, plus addition of `prefix: String` column. This is a breaking schema change: the `VoucherTypeCode` enum is removed entirely. All existing journal entries must continue to resolve their `voucherType` relation without error post-migration.

---

## REQ-C.1 — Modelo VoucherTypeCfg actualizado

`VoucherTypeCfg` in `prisma/schema.prisma` satisfies all structural requirements.

| Scenario | ID | Description | Expected outcome |
|----------|----|-------------|-----------------|
| S1 | C.1-S1 | `code` is String with per-org uniqueness | `code: String` with `@@unique([organizationId, code])`; the `VoucherTypeCode` enum block is absent from the schema file |
| S2 | C.1-S2 | `prefix` column present | `prefix: String` present on the model |
| S3 | C.1-S3 | `isActive` default retained | `isActive: Boolean @default(true)` unchanged |
| S4 | C.1-S4 | Table mapping unchanged | `@@map("voucher_types")` present and unchanged |

**Verification**: `npx prisma validate` passes with no warnings or errors after the change.

---

## REQ-C.2 — FK de JournalEntry preservada

`JournalEntry.voucherTypeId` must remain a valid foreign key to `VoucherTypeCfg.id`.

| Scenario | ID | Description | Expected outcome |
|----------|----|-------------|-----------------|
| S1 | C.2-S1 | Existing entries resolve relation | A `JournalEntry` row seeded before migration, queried post-migration with `include: { voucherType: true }`, returns a non-null `voucherType` object |
| S2 | C.2-S2 | DB-level FK enforced | Inserting a `JournalEntry` with a `voucherTypeId` that references no `VoucherTypeCfg` row raises a PostgreSQL foreign-key constraint error |

---

## REQ-C.3 — Data migration — cero huérfanos

The migration maps every existing entry to a valid `VoucherTypeCfg` row via its old enum code value.

| Scenario | ID | Description | Expected outcome |
|----------|----|-------------|-----------------|
| S1 | C.3-S1 | One-to-one code mapping | For each distinct enum value previously in `journal_entries` (CI, CE, CD, CT, CA), a `VoucherTypeCfg` row with matching `code` string exists post-migration |
| S2 | C.3-S2 | Zero orphan entries | After `prisma migrate deploy` on a DB with entries for all 5 original types: `SELECT COUNT(*) FROM journal_entries je LEFT JOIN voucher_types vt ON je.voucher_type_id = vt.id WHERE vt.id IS NULL` returns 0 |

**Migration strategy (non-normative)**: the SQL migration must: (1) add `prefix` column with a temporary default; (2) alter `code` column type from enum to text; (3) backfill `prefix` for existing rows from the known 5-type map; (4) drop the `VoucherTypeCode` type.

---

## REQ-C.4 — Migración reversible

A down migration path exists at the schema level.

| Scenario | ID | Description | Expected outcome |
|----------|----|-------------|-----------------|
| S1 | C.4-S1 | Down migration compiles | The SQL down migration: drops `prefix` column, casts `code` back to the `VoucherTypeCode` enum type (rows with codes outside the original 5 are dropped or raise an error — acceptable per proposal), re-creates the `VoucherTypeCode` enum |

**Documented limitation**: rows with dynamically-created codes (outside CI, CE, CD, CT, CA) cannot be rolled back to the enum. This data loss is acceptable and must be noted in the migration file header.

---

## Constraints

- The `VoucherTypeCode` enum MUST NOT be referenced anywhere in the codebase after this migration (seed files, service files, generated client imports all updated)
- `prisma generate` must succeed without the enum
- `prefix` has no DB-level length constraint; service layer enforces single character
- Migration file naming: `YYYYMMDDHHMMSS_voucher_type_string_prefix`

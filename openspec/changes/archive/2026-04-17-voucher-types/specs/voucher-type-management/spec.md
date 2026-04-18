# Spec: voucher-type-management

**Change**: `voucher-types`
**Domain**: `voucher-type-management`

## Overview

CRUD admin for `VoucherTypeCfg` rows scoped to a single organization. Covers: list page, create form (POST), edit form (PATCH), and soft-deactivation. The `code` field is immutable after creation; `name`, `prefix`, and `isActive` are editable.

---

## REQ-A.1 — Página de lista

**List page** at `/organizations/[orgSlug]/settings/voucher-types` renders all voucher types for the organization ordered by code.

| Scenario | ID | Description | Expected outcome |
|----------|----|-------------|-----------------|
| S1 | A.1-S1 | Active/inactive sort | Active types appear first; inactive types appear below (or in a separate "Inactivos" section) with a visual badge |
| S2 | A.1-S2 | Row metadata | Every row shows: code, name, prefix, active status badge, and the count of journal entries that reference it |
| S3 | A.1-S3 | Empty state | An organization with zero voucher types shows an empty-state prompt to create the first type |

**Test file**: `features/accounting/voucher-type/__tests__/voucher-type-list.test.ts`

---

## REQ-A.2 — Formulario de creación

**POST** `/api/organizations/[orgSlug]/voucher-types` with input validation.

| Scenario | ID | Description | Expected outcome |
|----------|----|-------------|-----------------|
| S1 | A.2-S1 | Missing required field | Submitting without `code`, `name`, or `prefix` → 422 naming the missing field |
| S2 | A.2-S2 | Duplicate code in same org | Code already used in same org → 409 with error code `VOUCHER_TYPE_CODE_DUPLICATE` |
| S3 | A.2-S3 | Duplicate code in different org | Same code in another org → creation succeeds (per-org uniqueness only) |
| S4 | A.2-S4 | Valid creation | All required fields provided → 201 with created `VoucherTypeCfg` payload; row appears in list |

**Test file**: `features/accounting/voucher-type/__tests__/voucher-type-create.test.ts`

---

## REQ-A.3 — Formulario de edición

**PATCH** `/api/organizations/[orgSlug]/voucher-types/[id]` — `name`, `prefix`, `isActive` editable; `code` is IMMUTABLE.

| Scenario | ID | Description | Expected outcome |
|----------|----|-------------|-----------------|
| S1 | A.3-S1 | Edit name | PATCH `{ name: "Nuevo nombre" }` → 200, name updated, code unchanged |
| S2 | A.3-S2 | Edit prefix | PATCH `{ prefix: "X" }` → 200, prefix updated; subsequent correlative display uses new prefix |
| S3 | A.3-S3 | Attempt code change | PATCH `{ code: "CX" }` → 400 with error code `VOUCHER_TYPE_CODE_IMMUTABLE` |

**Rationale**: `code` is immutable because it is the human-readable stable audit key. Changing it post-creation would silently alter the meaning of every historical journal entry that references this type.

**Test file**: `features/accounting/voucher-type/__tests__/voucher-type-edit.test.ts`

---

## REQ-A.4 — Desactivación suave

**PATCH** `.../[id]` with `{ isActive: false }`.

| Scenario | ID | Description | Expected outcome |
|----------|----|-------------|-----------------|
| S1 | A.4-S1 | History preserved | After deactivation, all existing `JournalEntry` rows with that `voucherTypeId` are unchanged (number, date, formatted display intact) |
| S2 | A.4-S2 | Hidden from creation | `GET .../voucher-types?active=true` (or service default for create-JE dropdowns) does NOT include the deactivated type |
| S3 | A.4-S3 | Visible in entry detail | A `JournalEntry` detail view referencing the inactive type renders code, name, and formatted correlative without error; shows "inactivo" badge |

**Test file**: `features/accounting/voucher-type/__tests__/voucher-type-deactivate.test.ts`

---

## Constraints

- All queries scoped to `organizationId` — cross-org access must be impossible
- `code` length: 2–6 characters, alphanumeric uppercase (enforced at service layer)
- `prefix` length: exactly 1 character (enforced at service layer)
- Soft-delete only — no hard DELETE exposed to the UI

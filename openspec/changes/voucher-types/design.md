# Design: voucher-types

> **Change**: `voucher-types`
> **Phase**: `sdd-design`
> **Date**: 2026-04-17
> **Dependencies**: `proposal.md`, `spec.md`, `specs/*/spec.md`

---

## Technical Approach

We **keep** the existing Prisma model name `VoucherTypeCfg` (D.1) to avoid a physically breaking rename across four external relations (`Organization.voucherTypes`, `JournalEntry.voucherType`, `JournalRepository`, generated client), and instead use `VoucherType` as the **domain label** in documentation and service-level types. At the database level, the `VoucherTypeCode` Prisma enum is removed (D.2) via an in-place `ALTER COLUMN ... TYPE TEXT USING code::text` — the underlying PostgreSQL representation of a Prisma enum column is already text-compatible, so there is no JE remapping to do: every existing `journal_entries.voucher_type_id` still points to its `voucher_types.id`, and the `code` column simply changes storage type without losing values. This means **zero orphan JEs by construction** (D.9), fully satisfying REQ-C.3.

A new `prefix: String` column is added to `voucher_types` (D.3) and backfilled for the existing 5 rows from the current hardcoded `TYPE_PREFIX_MAP` in `features/accounting/correlative.utils.ts:1-7`. The `formatCorrelativeNumber` helper is simplified to take a plain `prefix: string` (D.8), deleting the hardcoded map. All four call sites — `components/accounting/journal-entry-form.tsx` (2 calls), `components/accounting/journal-entry-list.tsx` (1 call), `app/api/organizations/[orgSlug]/journal/route.ts` (1 call), `app/api/organizations/[orgSlug]/journal/[entryId]/route.ts` (2 calls) — are updated to read the prefix from the `VoucherTypeCfg` row they already have in scope.

Concurrency is solved with **optimistic retry on the existing `@@unique([organizationId, voucherTypeId, periodId, number])` constraint** (D.4). `getNextNumber` is folded into the create path: the new `createEntryWithNumber` method on `JournalRepository` reads the current max and attempts an INSERT inside a transaction; on `P2002` (unique constraint violation on `number`), it retries up to 5 times before throwing `VOUCHER_NUMBER_CONTENTION`. This is the ONLY approach that works without SELECT-FOR-UPDATE (which Prisma cannot express cleanly) and without a separate counter table (overkill). The standalone `getNextNumber(...)` preview endpoint (`/api/.../journal/last-reference`) stays unchanged — it is used only for UI display and does not need to be race-safe.

CRUD surface (D.5) extends the existing partial implementation: POST is added to `app/api/organizations/[orgSlug]/voucher-types/route.ts`, the single-resource route moves from plain PATCH (existing) to PATCH with code-immutability + duplicate guards. The UI lives at `app/(dashboard)/[orgSlug]/accounting/voucher-types/page.tsx` (replacing the "Próximamente" placeholder) using the **single-component manager pattern** established by `OperationalDocTypesManager` (D.6) — one inline list + inline create/edit rows, zero route-level nesting. The create-JE dropdown (D.7) filters to `isActive=true` for new entries but still renders the assigned inactive type when editing an existing JE, with an "Inactivo" badge in detail view.

---

## Decisions

### D.1 — Model naming

**Decision:** **(b) Keep `VoucherTypeCfg` in Prisma. Use `VoucherType` as the domain label in docs and DTO/service type names.**

**Rationale:**

- Renaming the model is a physically breaking change across 4 generated-client references (`prisma.voucherTypeCfg.*` appears in 7 files), 1 relation on `Organization`, 1 relation on `JournalEntry`, and every `include: { voucherType: true }` still works as-is because the RELATION name is already `voucherType`, not `voucherTypeCfg`.
- The semantic confusion is cosmetic: users already call it "voucher type" in the UI. `Cfg` was always a lazy suffix — the model has the same shape as every other catalog table (`ContactType`, `ProductType`, `OperationalDocType`, none of which carry `Cfg`).
- The real cost of the rename (4 generated-client call sites + 8 `include` hits + 20+ test expectations on `voucherTypeCfg.findMany`) buys nothing functional.
- Going forward, new DTOs/types use the clean name: `CreateVoucherTypeInput`, `UpdateVoucherTypeInput`, `VoucherTypeService`, `VoucherTypeRepository` — these already exist and read cleanly.

**Alias?** No — TS aliasing across generated client + relations creates two names for the same thing. We accept the legacy model name in Prisma only.

---

### D.2 — Enum removal sequence

The Prisma `VoucherTypeCode` enum is stored in PostgreSQL as a named enum type. Removing it requires converting the column to TEXT before dropping the enum type.

**Migration sequence (SQL-level, single migration file):**

```
-- Step 1: add prefix column (nullable initially so we can backfill)
ALTER TABLE "voucher_types" ADD COLUMN "prefix" TEXT;

-- Step 2: backfill prefix for existing 5 codes from the hardcoded map
UPDATE "voucher_types" SET "prefix" = 'I' WHERE "code"::text = 'CI';
UPDATE "voucher_types" SET "prefix" = 'E' WHERE "code"::text = 'CE';
UPDATE "voucher_types" SET "prefix" = 'D' WHERE "code"::text = 'CD';
UPDATE "voucher_types" SET "prefix" = 'T' WHERE "code"::text = 'CT';
UPDATE "voucher_types" SET "prefix" = 'A' WHERE "code"::text = 'CA';

-- Step 3: enforce NOT NULL on prefix
ALTER TABLE "voucher_types" ALTER COLUMN "prefix" SET NOT NULL;

-- Step 4: convert code column from enum to TEXT (values preserved verbatim)
ALTER TABLE "voucher_types" ALTER COLUMN "code" TYPE TEXT USING "code"::text;

-- Step 5: drop the enum type (no more column references it)
DROP TYPE "VoucherTypeCode";
```

**Why this is FK-safe:** `journal_entries.voucher_type_id` is a FK to `voucher_types.id` (a `cuid` TEXT). It never references the `code` enum. Converting `code` from enum→TEXT does not touch any FK. REQ-C.3 is satisfied **by construction**: no JE row is updated, no row is deleted, every JE's `voucherTypeId` still resolves to a `VoucherTypeCfg` row — the same row it pointed to before the migration.

**TS reference cleanup (same PR):**
- `prisma/seeds/voucher-types.ts:3,5,11-16,31` — remove `VoucherTypeCode` import, use string literals
- `features/voucher-types/voucher-types.service.ts:3,7,61` — change `code: VoucherTypeCode` → `code: string`
- `features/voucher-types/voucher-types.types.ts:1,6,19` — remove `VoucherTypeCode` re-export and input type
- `features/voucher-types/voucher-types.repository.ts:23-28` — remove the `as never` cast on line 27

**Rollback:** reverse migration drops `prefix`, recreates the enum, and casts `code::text` back to the enum — rows with codes outside `{CI,CE,CD,CT,CA}` FAIL the cast. This data loss is documented in the migration header (per REQ-C.4). Acceptable by design.

---

### D.3 — `prefix` column + backfill values

**Current hardcoded map** (from `features/accounting/correlative.utils.ts:1-7`):

```
CI → "I"
CE → "E"
CD → "D"
CT → "T"
CA → "A"
```

**New types (seed-only, no migration backfill — rows created by seed upsert):**

```
CN → "N"   (Nómina)
CM → "M"   (Depreciación/Amortización)
CB → "B"   (Bancario)
```

**Collision check:** the 8 prefixes `{I, E, D, T, A, N, M, B}` are all distinct single uppercase letters — no collision.

**Column definition:** `prefix: String` (Prisma), `TEXT NOT NULL` (Postgres). No DB-level length check — service layer enforces **exactly 1 character, uppercase alphanumeric** (per REQ-A.2/A.3 constraints).

**Uniqueness:** `prefix` is NOT unique — two orgs can both use prefix `N`, and even within one org an admin could theoretically collide if they really wanted. We document that ambiguity risk and leave it to the UI to warn but not block. No `@@unique` on prefix.

---

### D.4 — Optimistic retry for concurrency

**Placement:** rewrite `JournalRepository.create` to atomically read-and-insert with retry. The standalone `getNextNumber(...)` method stays for UI preview only.

**New repository signature:**

```ts
async create(
  organizationId: string,
  data: Omit<CreateJournalEntryInput, "lines">,
  lines: JournalLineInput[],
  // number parameter REMOVED — repo computes it atomically
): Promise<JournalEntryWithLines>
```

**Pseudocode** (inside the existing `this.db.$transaction`):

```ts
const MAX_ATTEMPTS = 5;
const scope = this.requireOrg(organizationId);

return this.db.$transaction(async (tx) => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const last = await tx.journalEntry.findFirst({
      where: { ...scope, voucherTypeId: data.voucherTypeId, periodId: data.periodId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const candidate = (last?.number ?? 0) + 1;

    try {
      const entry = await tx.journalEntry.create({
        data: { number: candidate, /* ...rest */ },
        include: journalIncludeLines,
      });
      return entry as JournalEntryWithLines;
    } catch (err) {
      if (isPrismaUniqueViolation(err, "organizationId_voucherTypeId_periodId_number")) {
        continue; // another tx inserted candidate first — retry
      }
      throw err;
    }
  }
  throw new ValidationError(
    "No se pudo asignar un número correlativo tras varios intentos",
    VOUCHER_NUMBER_CONTENTION,
  );
});
```

**`isPrismaUniqueViolation` helper** (`features/shared/prisma-errors.ts`, NEW file — thin wrapper):

```ts
import { Prisma } from "@/generated/prisma/client";
export function isPrismaUniqueViolation(err: unknown, targetIndex?: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== "P2002") return false;
  if (!targetIndex) return true;
  const target = (err.meta?.target ?? "") as string | string[];
  return Array.isArray(target)
    ? target.join("_") === targetIndex || target.includes(targetIndex)
    : target === targetIndex;
}
```

**Why not SELECT FOR UPDATE:** Prisma has no first-class support; the raw-query escape hatch is fragile against schema changes. The `@@unique` constraint is the natural serialization point PostgreSQL gives us for free — let the DB be the referee.

**Why 5 retries:** each retry is one round-trip plus one failed insert. 5 attempts = worst-case ~50ms of added latency (very generous). Under 50 concurrent writers, the birthday-paradox collision probability drops exponentially per attempt; 5 is well above the 99.99th percentile for realistic load. If all 5 fail, we have a real system-level issue worth surfacing as an error.

**Service-layer call site update:**

- `features/accounting/journal.service.ts:161-181` — `createEntry`: REMOVE the separate `getNextNumber` call, pass entry data straight to `repo.create` which now handles numbering.
- `features/accounting/journal.service.ts:263-321` — `createAndPost`: same change — repo.create allocates the number inside its retry loop; then status transitions to POSTED inside the same transaction (we need to refactor `createAndPost` to call the new repo.create and then apply the POSTED transition + balances in the same `$transaction`). The current code inlines `tx.journalEntry.create` — replace with a repo method `createWithRetryTx(tx, ...)` that takes the outer transaction.
- `features/shared/auto-entry-generator.ts:114-124` — auto-entry flow: also adopt `createWithRetryTx`. This is critical because auto-entries from sales/purchases/dispatches happen in bulk and will race each other.

**New repo method shape:**

```ts
async createWithRetryTx(
  tx: Prisma.TransactionClient,
  organizationId: string,
  data: Omit<CreateJournalEntryInput, "lines">,
  lines: JournalLineInput[],
  status: JournalEntryStatus = "DRAFT",
): Promise<JournalEntryWithLines>
```

Callers: `journal.service.createEntry`, `journal.service.createAndPost`, `auto-entry-generator.generate`.

---

### D.5 — CRUD API surface

All routes scoped by `orgSlug` → `orgId` via `requireOrgAccess`. Roles per route documented below.

| Method | Path | Purpose | Roles | New/existing |
|--------|------|---------|-------|--------------|
| `GET` | `/api/organizations/[orgSlug]/voucher-types` | List all types for org | owner, admin, contador | **existing — add `?active=true` query param** |
| `POST` | `/api/organizations/[orgSlug]/voucher-types` | Create new type | owner, admin | **NEW** |
| `PATCH` | `/api/organizations/[orgSlug]/voucher-types/[typeId]` | Edit `name`/`prefix`/`isActive` | owner, admin | **existing — extend schema** |

No DELETE. Soft-deactivation is PATCH `{ isActive: false }` only (per REQ-A.4).

**Zod schemas** (`features/voucher-types/voucher-types.validation.ts`):

```ts
// NEW
export const createVoucherTypeSchema = z.object({
  code: z
    .string()
    .min(2, "El código debe tener entre 2 y 6 caracteres")
    .max(6, "El código debe tener entre 2 y 6 caracteres")
    .regex(/^[A-Z0-9]+$/, "El código debe ser alfanumérico en mayúsculas"),
  name: z.string().min(1).max(100),
  prefix: z
    .string()
    .length(1, "El prefijo debe ser exactamente 1 carácter")
    .regex(/^[A-Z0-9]$/, "El prefijo debe ser alfanumérico en mayúsculas"),
  description: z.string().max(500).optional(),
});

// EXTENDED
export const updateVoucherTypeSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    prefix: z.string().length(1).regex(/^[A-Z0-9]$/).optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
  })
  .strict(); // rejects unknown keys (e.g. `code`) → 400 VOUCHER_TYPE_CODE_IMMUTABLE
```

**Code-immutability guard** (service layer, even if Zod `.strict()` catches most cases): the `update` method explicitly rejects any attempt to pass `code` in the input and throws `ValidationError("El código de tipo de comprobante es inmutable", VOUCHER_TYPE_CODE_IMMUTABLE)`.

**Duplicate-code guard** (service layer): before create, check `repo.findByCode(orgId, code)` — if present, throw `ConflictError` with code `VOUCHER_TYPE_CODE_DUPLICATE`. Belt-and-suspenders with the `@@unique([organizationId, code])` DB constraint (which throws P2002 — caught and remapped to the same error code).

**New error codes** (`features/shared/errors.ts`):

```ts
export const VOUCHER_TYPE_CODE_DUPLICATE = "VOUCHER_TYPE_CODE_DUPLICATE";
export const VOUCHER_TYPE_CODE_IMMUTABLE = "VOUCHER_TYPE_CODE_IMMUTABLE";
export const VOUCHER_NUMBER_CONTENTION = "VOUCHER_NUMBER_CONTENTION";
```

---

### D.6 — UI routes + component shape

**Location:** stays at `app/(dashboard)/[orgSlug]/accounting/voucher-types/page.tsx`.

The spec's suggested `/settings/voucher-types` path does NOT match the rest of the accounting tree (periods, accounts, contacts all live under `/accounting/`). Voucher types are a core accounting catalog, not an org-level setting like monthly-close or operational-doc-types — so `/accounting/voucher-types` is the right place. The page already exists with a placeholder; we simply replace its body. The CRUD page in the accounting tree also matches the existing left-nav entry and the test expectations.

**Pattern chosen:** single-page inline-list-with-inline-rows, mirroring `components/settings/operational-doc-types-manager.tsx`. NOT a nested route tree — less navigation overhead for a small catalog.

**New file:** `components/accounting/voucher-types-manager.tsx`

Responsibilities:
- List rows (active first, then inactive with badge)
- Inline "+ Nuevo" row for creation (code, name, prefix, description inputs + save/cancel)
- Inline edit mode per row (name, prefix, isActive toggle; code field is read-only)
- Delete button is REPLACED by a "Desactivar" / "Activar" toggle
- Journal-entry count per row fetched via `GET /api/.../voucher-types?includeCounts=true` (extend service list to include `_count: { journalEntries: true }` when requested)

**Page.tsx shape** (analogous to `settings/operational-doc-types/page.tsx`):

```tsx
export default async function VoucherTypesPage({ params }) {
  const { orgSlug } = await params;
  // auth + org access
  const service = new VoucherTypesService();
  const types = await service.list(orgId, { includeCounts: true });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Tipos de Comprobante</h1>
      <VoucherTypesManager
        orgSlug={orgSlug}
        initialTypes={JSON.parse(JSON.stringify(types))}
      />
    </div>
  );
}
```

**No nested `/new` or `/[id]/edit` routes** — inline manager handles both.

---

### D.7 — Journal-entry form dropdown filtering

**Source file:** `components/accounting/journal-entry-form.tsx:362-367`

Current code renders ALL `voucherTypes` in the select. Change:

```tsx
<SelectContent>
  {voucherTypes
    .filter((vt) => vt.isActive || vt.id === editEntry?.voucherTypeId)
    .map((vt) => (
      <SelectItem key={vt.id} value={vt.id}>
        {vt.name}
        {!vt.isActive && <span className="ml-2 text-xs text-gray-400">(inactivo)</span>}
      </SelectItem>
    ))}
</SelectContent>
```

**Rule:** active types always shown. Inactive types hidden — UNLESS this is an edit form AND the inactive type is the one currently assigned to the entry (then show it with an `(inactivo)` visual hint so the user knows why it is still selectable).

**Detail view** (`components/accounting/journal-entry-detail.tsx`): the `voucherTypeName` prop passed from `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/page.tsx:57` currently drops `isActive`. Change the page to pass the full `voucherType` object (or at least `{name, isActive}`) and render a small "Inactivo" badge next to the name in detail.

---

### D.8 — `formatCorrelativeNumber` signature change

**Old:**

```ts
export function formatCorrelativeNumber(
  voucherTypeCode: string,   // "CI", "CD", etc.
  entryDate: Date | string,
  number: number,
): string | null
```

**New:**

```ts
export function formatCorrelativeNumber(
  prefix: string | null | undefined,
  entryDate: Date | string,
  number: number,
): string | null
```

- Hardcoded `TYPE_PREFIX_MAP` deleted
- Returns `null` if prefix is `null`, `undefined`, or empty string (REQ-B.3-S3)
- Returns `null` if prefix is any non-1-char value (defensive — matches old null-for-unknown behavior)

**Call-site enumeration** (exhaustive — grep verified):

| # | File | Line | Current call | New call |
|---|------|------|--------------|----------|
| 1 | `components/accounting/journal-entry-form.tsx` | 287-291 | `formatCorrelativeNumber(selectedVoucherType.code, new Date(editEntry.date), editEntry.number)` | `formatCorrelativeNumber(selectedVoucherType.prefix, new Date(editEntry.date), editEntry.number)` |
| 2 | `components/accounting/journal-entry-form.tsx` | 294 | `formatCorrelativeNumber(selectedVoucherType.code, new Date(date), nextNumber)` | `formatCorrelativeNumber(selectedVoucherType.prefix, new Date(date), nextNumber)` |
| 3 | `components/accounting/journal-entry-list.tsx` | 280 | `formatCorrelativeNumber(code, entry.date, entry.number)` (where `code` comes from `voucherTypeCodeMap`) | `formatCorrelativeNumber(prefix, entry.date, entry.number)` — build a new `voucherTypePrefixMap` at line 84 |
| 4 | `app/api/organizations/[orgSlug]/journal/route.ts` | 65-69 | `formatCorrelativeNumber(entry.voucherType.code, entry.date, entry.number)` | `formatCorrelativeNumber(entry.voucherType.prefix, entry.date, entry.number)` |
| 5 | `app/api/organizations/[orgSlug]/journal/[entryId]/route.ts` | 27-31 | same | `formatCorrelativeNumber(entry.voucherType.prefix, ...)` |
| 6 | `app/api/organizations/[orgSlug]/journal/[entryId]/route.ts` | 60-64 | same | `formatCorrelativeNumber(entry.voucherType.prefix, ...)` |

**Total callers: 6.** All have a `VoucherTypeCfg` row (or its `prefix` field) already in scope — no extra fetching needed.

**Re-exports:** `features/accounting/index.ts:13` re-exports the function. Signature change propagates automatically via TS.

---

### D.9 — Historical JE treatment

**Decision:** **(a) Preserve existing `number` values verbatim. Backfill `prefix` on `VoucherTypeCfg` rows. Display string is regenerated at render time from the new prefix.**

**What happens per historical JE:**

1. Its `voucherTypeId` FK is UNTOUCHED by the migration (zero SQL `UPDATE journal_entries` statements).
2. Its `number` is UNTOUCHED.
3. Its `date` is UNTOUCHED.
4. The `VoucherTypeCfg` row it points to gets a new `prefix` column populated by the migration (for pre-existing 5 types) or by the seed (for the 3 new types, which no historical JE can reference).
5. Next time the JE is rendered, `formatCorrelativeNumber(voucherType.prefix, date, number)` produces the **identical** string it would have produced before — because the backfill preserves the exact same prefix→code mapping the old hardcoded TS map used.

**Audit trail guarantee:**
- Formatted display `D2604-000015` before migration → `D2604-000015` after migration (bit-for-bit identical for the 5 existing codes)
- No JE row is modified during migration
- REQ-C.3-S2 (`SELECT COUNT(*) … WHERE vt.id IS NULL` returns 0) passes trivially because no JE's FK ever changes

**What REQ-C.3 actually requires:** zero ORPHANS, not stable NUMBERS. Numbers are already stable because we never renumber. This is the single most important invariant and it is preserved by **not touching JE rows at all**.

---

## Files Modified (final list)

### Database / Prisma

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Remove `VoucherTypeCode` enum block (lines 274-281); change `VoucherTypeCfg.code` from `VoucherTypeCode` to `String` (line 409); add `prefix: String` column (line 410a); keep `@@unique([organizationId, code])` |
| `prisma/migrations/20260417HHMMSS_voucher_type_string_prefix/migration.sql` | NEW — 5-step migration per D.2 |

### Backend — features/

| File | Change |
|------|--------|
| `features/accounting/correlative.utils.ts` | Delete `TYPE_PREFIX_MAP`; change signature to `formatCorrelativeNumber(prefix, date, number)` |
| `features/accounting/journal.repository.ts` | Replace `create` with retry-wrapped implementation (D.4); add `createWithRetryTx` |
| `features/accounting/journal.service.ts` | Update `createEntry` and `createAndPost` to use the new repo method; remove the separate `getNextNumber` call in the create path; preserve the standalone `getNextNumber` for the preview endpoint |
| `features/shared/auto-entry-generator.ts` | Replace manual `findFirst + create` block (lines 114-150) with `journalRepo.createWithRetryTx(tx, ...)` |
| `features/shared/errors.ts` | Add `VOUCHER_TYPE_CODE_DUPLICATE`, `VOUCHER_TYPE_CODE_IMMUTABLE`, `VOUCHER_NUMBER_CONTENTION` |
| `features/shared/prisma-errors.ts` | NEW — `isPrismaUniqueViolation(err, targetIndex?)` helper |
| `features/voucher-types/voucher-types.types.ts` | Add `prefix` to DTOs; remove `VoucherTypeCode` re-export; `CreateVoucherTypeInput` adopts `code: string` |
| `features/voucher-types/voucher-types.validation.ts` | Add `createVoucherTypeSchema`; extend `updateVoucherTypeSchema` with `.strict()` and `prefix` |
| `features/voucher-types/voucher-types.repository.ts` | Add `create(input)`; remove `code as never` cast; add `_count` include option for `findAll`; add `isActive` filter option |
| `features/voucher-types/voucher-types.service.ts` | Add `create(orgId, input)` with duplicate guard; update `update` with code-immutability guard; remove hardcoded `DEFAULT_VOUCHER_TYPES` or move it to the seed file; add `list(orgId, { isActive?, includeCounts? })` |

### Seed

| File | Change |
|------|--------|
| `prisma/seeds/voucher-types.ts` | Remove `VoucherTypeCode` import; switch to string literals; add CN/CM/CB; add `prefix` to all 8; use `upsert` on `{organizationId_code}` to guarantee idempotency (REQ-D.1-S2) |

### API

| File | Change |
|------|--------|
| `app/api/organizations/[orgSlug]/voucher-types/route.ts` | Add POST handler; extend GET with `?active=true` filter |
| `app/api/organizations/[orgSlug]/voucher-types/[typeId]/route.ts` | Use extended `updateVoucherTypeSchema` |
| `app/api/organizations/[orgSlug]/journal/route.ts` | Update `formatCorrelativeNumber` call to pass `prefix` |
| `app/api/organizations/[orgSlug]/journal/[entryId]/route.ts` | Update 2 `formatCorrelativeNumber` calls |

### UI — app/

| File | Change |
|------|--------|
| `app/(dashboard)/[orgSlug]/accounting/voucher-types/page.tsx` | Replace placeholder with list + manager |
| `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/page.tsx` | Pass full `voucherType` object (or at least `{name, isActive}`) to detail component |

### UI — components/

| File | Change |
|------|--------|
| `components/accounting/voucher-types-manager.tsx` | NEW — inline CRUD manager |
| `components/accounting/journal-entry-form.tsx` | Filter dropdown to `isActive=true` (keep current voucherType for edit mode); update 2 `formatCorrelativeNumber` calls |
| `components/accounting/journal-entry-list.tsx` | Build `voucherTypePrefixMap`; update `formatCorrelativeNumber` call |
| `components/accounting/journal-entry-detail.tsx` | Accept optional `voucherTypeActive` prop and render "Inactivo" badge when false |

### Tests

| File | Change |
|------|--------|
| `features/accounting/correlative.utils.test.ts` | Extend — new prefix-based scenarios B.3-S1..S3 |
| `features/accounting/journal/__tests__/get-next-number.test.ts` | NEW — B.1-S1..S4 |
| `features/accounting/journal/__tests__/get-next-number-concurrency.test.ts` | NEW — B.2-S1..S2 using `Promise.all` on 50 concurrent creates |
| `features/accounting/voucher-type/__tests__/voucher-type-create.test.ts` | NEW — A.2-S1..S4 |
| `features/accounting/voucher-type/__tests__/voucher-type-edit.test.ts` | NEW — A.3-S1..S3 |
| `features/accounting/voucher-type/__tests__/voucher-type-deactivate.test.ts` | NEW — A.4-S1..S3 |
| `features/accounting/voucher-type/__tests__/voucher-type-list.test.ts` | NEW — A.1-S1..S3 |
| `prisma/seeds/__tests__/voucher-types.seed.test.ts` | NEW — D.1-S1..S4 |

---

## API / Contract Signatures (final)

### `formatCorrelativeNumber`

```ts
function formatCorrelativeNumber(
  prefix: string | null | undefined,
  entryDate: Date | string,
  number: number,
): string | null
```

### `JournalRepository`

```ts
async create(
  organizationId: string,
  data: Omit<CreateJournalEntryInput, "lines">,
  lines: JournalLineInput[],
): Promise<JournalEntryWithLines>

async createWithRetryTx(
  tx: Prisma.TransactionClient,
  organizationId: string,
  data: Omit<CreateJournalEntryInput, "lines">,
  lines: JournalLineInput[],
  status?: JournalEntryStatus,
): Promise<JournalEntryWithLines>

// getNextNumber stays (preview-only endpoint)
async getNextNumber(
  organizationId: string,
  voucherTypeId: string,
  periodId: string,
): Promise<number>
```

### `VoucherTypesService`

```ts
async list(
  organizationId: string,
  options?: { isActive?: boolean; includeCounts?: boolean },
): Promise<VoucherTypeCfg[]>

async create(
  organizationId: string,
  input: CreateVoucherTypeInput,
): Promise<VoucherTypeCfg>  // NEW

async update(
  organizationId: string,
  id: string,
  input: UpdateVoucherTypeInput,  // excludes `code`; strict-validated
): Promise<VoucherTypeCfg>

async getById(organizationId: string, id: string): Promise<VoucherTypeCfg>
async getByCode(organizationId: string, code: string): Promise<VoucherTypeCfg>
async seedForOrg(organizationId: string): Promise<VoucherTypeCfg[]>
```

### DTOs

```ts
export interface CreateVoucherTypeInput {
  code: string;        // 2–6 chars, A-Z0-9
  name: string;        // 1–100 chars
  prefix: string;      // exactly 1 char, A-Z0-9
  description?: string;
}

export interface UpdateVoucherTypeInput {
  name?: string;
  prefix?: string;     // exactly 1 char, A-Z0-9
  description?: string;
  isActive?: boolean;
  // NOTE: `code` is intentionally absent — strict validation rejects it
}
```

---

## Test Strategy

**TDD Mode is ON** — write failing tests first, then implementation.

### Unit (Vitest, pure functions)

- `correlative.utils.test.ts`
  - B.3-S1 prefix `"D"` + date 2026-04-15 + number 15 → `"D2604-000015"`
  - B.3-S2 prefix `"N"` + 2026-04-01 + 1 → `"N2604-000001"`
  - B.3-S3 prefix `null`/`""`/undefined → `null`
  - Regression: prefix `"D"` + 2026-12-31 + 999999 → `"D2612-999999"`

### Integration (Vitest + Postgres testcontainer / test DB)

- `get-next-number.test.ts`
  - B.1-S1..S4 — basic correctness of `findFirst + 1`
- `get-next-number-concurrency.test.ts`
  - B.2-S1 — `Promise.all(Array.from({length: 50}, () => createEntry(...)))` → assert set of numbers is exactly `{1..50}`
  - B.2-S2 — simulate contention via mock that forces P2002 5 times → assert `VOUCHER_NUMBER_CONTENTION` thrown
- `voucher-type-create.test.ts` — A.2-S1..S4 through the HTTP route handler
- `voucher-type-edit.test.ts` — A.3-S1..S3
- `voucher-type-deactivate.test.ts` — A.4-S1..S3
- `voucher-type-list.test.ts` — A.1-S1..S3

### Migration

- Seed a DB with one JE per original type (CI/CE/CD/CT/CA).
- Run `prisma migrate deploy`.
- Assert: every JE's `voucherType` relation resolves (C.2-S1); `SELECT COUNT(*) … WHERE vt.id IS NULL` returns 0 (C.3-S2); every `VoucherTypeCfg` row now has a non-null `prefix` matching the expected map (C.1-S2).

### Seed

- `voucher-types.seed.test.ts`
  - D.1-S1 fresh org → 8 rows
  - D.1-S2 re-run → still 8 rows, no duplicates, no field mutations
  - D.1-S3 every row has a non-empty `prefix`
  - D.1-S4 file does not import `VoucherTypeCode` (static check via reading the file text)

### E2E / Page (smoke via Playwright or server-render assertions)

- Navigate to `/accounting/voucher-types` — list renders with all 8 types
- Click "Nuevo" → fill code `CX`, name `Test`, prefix `X` → save → row appears
- Create a journal entry with the new type → see `X2604-000001` in the list
- Deactivate `CX` → dropdown in new-JE form no longer shows `CX`
- Open an existing JE that used `CX` → detail shows "Inactivo" badge

---

## Open Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `auto-entry-generator` refactor to use `createWithRetryTx` breaks sale/purchase/dispatch flows | Med | Exhaustive integration tests for each auto-entry source — sale-creation test, purchase-creation test, dispatch-creation test all already exist; run full suite pre-merge |
| A user in mid-session has a cached dropdown showing a type that was just deactivated | Low | Server-rendered pages; `router.refresh()` on manager mutations — stale UI risk is ~seconds, not hours |
| Prefix collision (two types with same prefix → ambiguous display) | Low | UI warns on create/edit if prefix already in use; no DB constraint so not hard-blocked |
| Down migration loses non-original codes | Accepted | Documented in migration header; rolling back after creating CN/CM/CB is a deliberate destructive op |
| `updateVoucherTypeSchema.strict()` breaks existing frontend that sends extra fields | Low | Only client of this PATCH is internal code — grep confirms no callers pass unexpected keys today |

---

## Rollback Plan

1. Revert the Prisma migration: down-SQL drops `prefix`, re-casts `code` to the enum, drops the string support. Rows with non-original codes fail the cast — deliberate data loss, documented.
2. Revert TS changes in one commit — generated client regenerates the enum; all `voucherTypeCfg.*` queries still work because the relation is unchanged.
3. Revert the UI replacement — `VoucherTypesPage` reverts to the "Próximamente" placeholder.
4. Seed file reverts to the 5-type enum-based version.

Nothing in journal_entries is touched by the rollback — audit trail preserved either direction.

---

## Decision Traceability

| Spec REQ | Design decisions |
|----------|------------------|
| REQ-A.1 list page | D.6 |
| REQ-A.2 create form | D.5, D.6 |
| REQ-A.3 edit form | D.5 (immutability guard), D.6 |
| REQ-A.4 soft-deactivate | D.7 (dropdown filter), D.6 (manager UI) |
| REQ-B.1 next number | D.4 (unchanged preview behavior) |
| REQ-B.2 concurrency | D.4 (retry loop) |
| REQ-B.3 display format | D.8 (prefix param), D.3 (column) |
| REQ-C.1 schema shape | D.2 (migration), D.3 (prefix) |
| REQ-C.2 FK preserved | D.2 (no JE updates), D.9 (audit) |
| REQ-C.3 zero orphans | D.2, D.9 (by construction) |
| REQ-C.4 reversible | D.2 (down path documented) |
| REQ-D.1 8 types seeded | D.3, D.6 (seed file) |

---

## Success Criteria (final)

- [ ] `prisma migrate deploy` succeeds on a DB with all 5 original types seeded — zero orphan JEs
- [ ] All 4 new Vitest test files RED→GREEN
- [ ] 50 concurrent create calls produce exactly `{1..50}` numbers, no gaps
- [ ] `formatCorrelativeNumber` callers (6 total) updated and typecheck clean
- [ ] Contador can create a voucher type from UI, use it in a new JE, see `{prefix}{YYMM}-{NNNNNN}` correctly
- [ ] Deactivated type vanishes from new-JE dropdown, still renders with "Inactivo" badge in historical JE detail
- [ ] `prisma generate` succeeds; no `VoucherTypeCode` references anywhere

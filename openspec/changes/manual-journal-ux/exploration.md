# Exploration: Manual journal entries (Traspaso diario, ajustes, otros)

**Date**: 2026-04-17
**Topic**: `sdd/explore/manual-journal-entries`
**Status**: Complete

---

## Current State

### Auto-generated entry pathway (fully working)

All four source domains create journal entries atomically via `AutoEntryGenerator` inside their respective service POST handlers:

| Source | sourceType value | Trigger | VoucherType used |
|--------|-----------------|---------|-----------------|
| Sale | `"sale"` | On POST (sale.service.ts ~L327) | CI (Comprobante Ingreso) |
| Purchase | `"purchase"` | On POST (purchase.service.ts ~L455) | CE (Comprobante Egreso) |
| Dispatch | `"dispatch"` | On POST (dispatch.service.ts ~L358) | CD or CI depending on type |
| Payment | `"payment"` | On POST/PATCH (payment.service.ts ~L202) | CI/CE depending on direction |

Key observations:
- Auto-entries are created directly as `status: "POSTED"` — they skip DRAFT.
- `sourceType` + `sourceId` are populated on `JournalEntry` (both `String?`).
- The FK relationship is `@unique` on the source side (e.g., `Sale.journalEntryId`), meaning 1:1.
- On edit: `JournalService.updateEntry()` checks `entry.sourceType` for POSTED entries — if set, throws `ENTRY_SYSTEM_GENERATED_IMMUTABLE`. Edit must go through the source document.
- On void: `transitionStatus()` reverses balances via `AccountBalancesService.applyVoid()`. No special guard for auto vs manual on void — both can be voided through the journal.
- On reactivate: not implemented — VOIDED is terminal.

### Manual entry pathway (also working — the answer is YES)

The manual pathway is **fully implemented and production-ready for most use cases**:

**Schema support:**
- `JournalEntry.sourceType` and `JournalEntry.sourceId` are both `String?` (nullable). Manual entries simply leave them `null`.
- No enum discriminator for source type — it's a free string (`"sale"`, `"purchase"`, `"dispatch"`, `"payment"`, or `null` for manual).
- `VoucherTypeCode` enum already includes `CT` (Comprobante de Traspaso) and `CA` (Comprobante de Apertura) in addition to `CI`, `CE`, `CD`. This is exactly what's needed for Traspaso and Apertura entries.

**API:**
- `POST /api/organizations/[orgSlug]/journal` accepts any `CreateJournalEntryInput` — no `sourceType` is required. A `postImmediately: true` flag creates and posts atomically.
- `PATCH /api/organizations/[orgSlug]/journal/[entryId]` updates DRAFT or POSTED manual entries. POSTED manual entries (sourceType null) go through `updatePostedManualEntryTx` which reverses + reapplies balances atomically.
- `PATCH /api/organizations/[orgSlug]/journal/[entryId]/status` transitions DRAFT→POSTED→VOIDED for any entry.

**UI:**
- `/accounting/journal/new` → `JournalEntryForm` — full form with date, period, voucherType, referenceNumber, description, dynamic lines (debit/credit/account/contact). Has both "Guardar Borrador" and "Contabilizar" buttons.
- `/accounting/journal/[entryId]` → `JournalEntryDetail` — shows edit button for DRAFT, "Contabilizar" for DRAFT, "Anular" for POSTED.
- `/accounting/journal` → `JournalEntryList` — filters by period, voucherType, status. "Nuevo Asiento" button.
- The form allows selecting **any** configured VoucherType including CT (Traspaso) and CA (Apertura) — there is no restriction to manual-only types.

**Service validations for manual entries:**
- `createEntry`: period must be OPEN, voucherType must belong to org, ≥2 lines, no debit+credit on same line, all accounts active+isDetail, requiresContact check.
- `createAndPost`: same + balance check (total debit == total credit).
- `transitionStatus` DRAFT→POSTED: period OPEN + balance check.
- `updateEntry` on POSTED manual (sourceType null): period OPEN + balance check + atomic balance recalculation via `updatePostedManualEntryTx`.

---

## Affected Areas

- `prisma/schema.prisma` — `JournalEntry` model: `sourceType String?`, `sourceId String?`, `VoucherTypeCode` enum has CT+CA already
- `features/accounting/journal.service.ts` — Manual entry creation, update, transition; `updatePostedManualEntryTx` for POSTED manual edits
- `features/accounting/journal.repository.ts` — `create`, `update`, `updateTx`, `updateStatus`, `updateStatusTx`
- `features/accounting/journal.types.ts` — `CreateJournalEntryInput`, `UpdateJournalEntryInput`
- `features/shared/auto-entry-generator.ts` — Auto entries always set sourceType+sourceId; manual entries never do
- `features/shared/errors.ts` — `ENTRY_SYSTEM_GENERATED_IMMUTABLE` distinguishes auto vs manual on PATCH
- `app/(dashboard)/[orgSlug]/accounting/journal/new/page.tsx` — New entry page (Server Component)
- `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/page.tsx` — Entry detail page
- `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx` — Entry edit page (DRAFT only)
- `app/api/organizations/[orgSlug]/journal/route.ts` — POST (create / createAndPost)
- `app/api/organizations/[orgSlug]/journal/[entryId]/route.ts` — PATCH (update)
- `app/api/organizations/[orgSlug]/journal/[entryId]/status/route.ts` — PATCH (transition)
- `components/accounting/journal-entry-form.tsx` — Full manual entry form
- `components/accounting/journal-entry-list.tsx` — List view (no sourceType column)
- `components/accounting/journal-entry-detail.tsx` — Detail view (no sourceType badge)

---

## Gaps vs User's Question

The core functionality EXISTS. What is MISSING or INCOMPLETE:

### Gap 1 — No visual distinction in list/detail between auto and manual entries
- `journal-entry-list.tsx` has no "Origen" column — all entries look the same regardless of sourceType.
- A manual Traspaso diario (CT) looks identical in the list to an auto-generated Cobro entry.
- **Impact**: Confusing for the accountant reviewing the journal. They can't tell at a glance which entries they created manually.

### Gap 2 — Edit on POSTED manual works, but edit/page is locked to DRAFT only
- `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx` — Need to verify if it guards to DRAFT only.
- `journal-entry-form.tsx` is used for edit mode. The form itself doesn't check status — it just sends PATCH.
- The service handles POSTED manual correctly, but the edit page might reject non-DRAFT entries before reaching the form.

### Gap 3 — No templates or quick-entry patterns for common manual entry types
- Traspaso diario: accountant must enter all accounts manually every time (caja general → banco, etc.)
- Ajuste de cierre, apertura: same — full manual entry from scratch each time.
- No "copy last entry of this type" or template functionality.
- **Impact**: Slow and error-prone for repetitive entries like daily cash transfers.

### Gap 4 — No source-type filter in the list view
- Can filter by period, voucherType, status — but NOT by manual vs auto.
- An accountant who wants to see only their manual entries has to remember which voucherTypes they use manually (e.g., CT = Traspasos).
- Partial workaround: filter by voucherType=CT to see traspasos specifically.

### Gap 5 — Traspaso/Apertura/Cierre specific workflows not codified
- Bolivia accounting convention: apertura entry happens once per period, cierre reverses all income/expense to Resultados.
- Nothing in the system guides or enforces these conventions.
- No period-open/close hooks that auto-suggest an apertura or cierre entry.

---

## Approaches

### 1. Accept current state + add source-type badge + edit unlock for POSTED manual
Keep the single `JournalEntry` model as-is. The only changes needed:
- Add `sourceType` to the `JournalEntryDetail` and `JournalEntryList` interfaces and render a badge ("Manual" vs "Generado por Venta" etc.).
- Unlock the edit page for POSTED manual entries (sourceType null) — the service already handles this correctly.
- Add a "Manual/Automático" filter chip in the list.

- **Pros**: Zero schema migration, zero service changes, all existing logic reused. Small surface area.
- **Cons**: No templates, no guided workflows for traspaso/apertura/cierre.
- **Effort**: Low (1-2 days)

### 2. Add entry templates (plantillas) for common manual entry types
Build on Approach 1. Add a `JournalEntryTemplate` feature or a simpler "duplicate entry" button on the detail view. The CT voucherType acts as the canonical template selector.

- **Pros**: Reduces repetitive work for daily traspasos. Reuses existing form — just pre-fills it.
- **Cons**: Slightly more UI work. Templates need to be maintained (account codes may change).
- **Effort**: Medium (3-5 days)

### 3. Separate ManualJournalEntry model
Create a distinct model for manual entries with its own service/repo, disconnected from the auto-entry pathway.

- **Pros**: Clean conceptual separation. Manual entries could have different fields (e.g., narration, attachment).
- **Cons**: Duplication of all accounting logic (balance validation, period checks, status transitions, account balance updates). Two tables to query for the Libro Diario. Schema migration required. No benefit worth the cost — the current model already handles manual entries correctly.
- **Effort**: High (1-2 weeks). NOT recommended.

---

## Recommendation

**Approach 1 first, then Approach 2 as a second change.**

Reason: The model and service layer are already complete and correct for manual entries. The only real gaps are UX:
1. The accountant can't distinguish manual from auto entries in the list — trivial fix (add sourceType badge).
2. The edit page may block POSTED manual entries — small fix.
3. Templates would save time but are not blocking.

The `VoucherTypeCode` enum already has `CT` (Traspaso) and `CA` (Apertura) — these are the correct voucher types for the accountant to select when creating traspasos and apertura entries manually. No schema changes needed.

**Suggested change name**: `manual-journal-ux` (Approach 1) → then `journal-entry-templates` (Approach 2).

---

## Risks

- **Balance integrity on edit of POSTED manual**: `updatePostedManualEntryTx` runs applyVoid then applyPost in one transaction. If the transaction fails mid-way, the old balance is already reversed. Prisma's `$transaction` guarantees rollback — low risk, but should have an integration test.
- **No guard preventing an auto-entry from being voided directly**: A user could void a Sale's journal entry directly without voiding the Sale, leaving the Sale in POSTED with no journal. The `sourceType` field is there but the void path in `transitionStatus` does NOT check it. This is a pre-existing risk not introduced by manual entries.
- **Period CLOSED guard on manual edits**: If a period gets closed after a manual entry is created, the accountant can't edit it even though they own it. This is by design (period integrity) but may surprise users.

---

## Ready for Proposal

**Yes** — suggested change-name: `manual-journal-ux`

Scope:
1. Add `sourceType` badge to list and detail view components (manual vs auto origin label).
2. Unlock edit page for POSTED manual entries (sourceType null) — verify edit/page guard and update if needed.
3. Add "Manual/Automático" filter to the list.
4. (Optional in same change) Add a "Duplicar asiento" button on detail view to pre-fill the form with the same lines — covers the template use case simply.

No schema migration required. No service changes required.

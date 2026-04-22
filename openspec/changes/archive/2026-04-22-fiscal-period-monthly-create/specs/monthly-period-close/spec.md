# Spec delta — monthly-period-close (REQ-4 correction)

**Change**: fiscal-period-monthly-create
**Artifact type**: Spec B — Correction delta for `monthly-period-close`
**Canonical spec**: `openspec/specs/monthly-period-close/spec.md`
**Date**: 2026-04-21
**Status**: Approved

---

## Historical note

REQ-4 as shipped on 2026-04-21 (via the `cierre-periodo` change) listed only three entity types in
the draft-block check: `Dispatch`, `Payment`, and `JournalEntry`. The same `cierre-periodo` change
added `Sale` and `Purchase` to the lock cascade in REQ-5, and T29 extended `lockSales`/`lockPurchases`
to cover both entities as first-class locked documents.

Despite this, REQ-4's entity list was never updated to match REQ-5's scope. The omission meant that:
- `MonthlyCloseRepository.countDraftDocuments` counted only 3 entities.
- `MonthlyCloseService.close()` checked only 3 entities for DRAFT status.
- A period with DRAFT `Sale` or `Purchase` records would pass the draft check and proceed to close,
  leaving those DRAFTs inside a CLOSED period — unlocked, unaudited, invisible.

This delta corrects that omission. The correction was detected by the residual debt audit
(`openspec/changes/monthly-close-ui-reconciliation/residual-debt-audit.md`, finding F-03).

The defect and its correction are governed together by the `fiscal-period-monthly-create` change.
Test coverage for the corrected REQ-4 is specified in full in
`openspec/changes/fiscal-period-monthly-create/specs/fiscal-period-monthly-create/spec.md` (REQ-4,
Scenarios 4.1 through 4.7, and REQ-8).

---

## Correction scope

This delta affects only REQ-4 of the canonical `monthly-period-close` spec. All other REQs
(REQ-1 through REQ-3, REQ-5 through REQ-11) are unchanged.

---

## REQ-4 (corrected) — Draft documents block close

The presence of any document in `DRAFT` status — across `Dispatch`, `Payment`, `JournalEntry`,
`Sale`, or `Purchase` within the period — MUST block the close. All five entity types are checked
without exception. If any drafts exist across any of these five types, the system rejects with error
code `PERIOD_HAS_DRAFT_ENTRIES`, and the response MUST include the counts per entity type to guide
the user.

> **Correction note**: The shipped REQ-4 (2026-04-21) listed only three entity types (`Dispatch`,
> `Payment`, `JournalEntry`). The correction adds `Sale` and `Purchase` to bring REQ-4 into
> alignment with REQ-5, which already requires that all five entity types be locked at close. The
> omission from REQ-4 was an authoring bug that accompanied an implementation bug in
> `countDraftDocuments`. Both are corrected together by the `fiscal-period-monthly-create` change.

> **Decision**: Drafts block close. Rationale: a draft document represents unfinished intent.
> Allowing close over drafts would silently leave un-reviewed financial data in a sealed period,
> making the audit trail misleading. The counts-per-type in the error message give the user a
> concrete remediation path. This decision is unchanged from the original REQ-4.

> **Note on `PERIOD_HAS_DRAFT_ENTRIES` constant**: the error constant in `features/shared/errors.ts`
> is `PERIOD_HAS_DRAFT_ENTRIES`. This spec aligns with that name. No new constant is introduced.

> **Note on user-facing message**: the error CODE is generic (`PERIOD_HAS_DRAFT_ENTRIES`), but the
> user-facing MESSAGE MUST discriminate by entity type — e.g., "Existen borradores pendientes:
> 3 despachos, 2 ventas, 1 compra." Each entity type with a non-zero count MUST be named explicitly
> so the user knows what to act on. The Spanish terms are: despacho(s), pago(s), asiento(s) de
> diario, venta(s), compra(s).

### countDraftDocuments return type (corrected)

The return type of `MonthlyCloseRepository.countDraftDocuments` MUST be:
```ts
{ dispatches: number; payments: number; journalEntries: number; sales: number; purchases: number }
```

The shipped return type `{ dispatches: number; payments: number; journalEntries: number }` is
superseded by this correction. All 5 keys are required. Missing keys are a contract violation.

### PERIOD_HAS_DRAFT_ENTRIES.details payload (corrected)

The `details` field of `ValidationError(PERIOD_HAS_DRAFT_ENTRIES)` MUST carry all 5 counts in every
error response:
```ts
{ dispatches: number; payments: number; journalEntries: number; sales: number; purchases: number }
```

The shipped payload shape `{ dispatches, payments, journalEntries }` is superseded. All 5 keys MUST
be present, including keys with value 0.

**Breaking change notice**: adding `sales` and `purchases` to the payload is a breaking change for
consumers that iterate `Object.keys(details)` or assert `Object.keys(details).length === 3`. The
project is internal with no production data at risk; the breaking change is accepted. Design phase
MUST inventory all consumers of this payload before the apply phase begins.

---

## REQ-4 — Scenarios (corrected)

The following scenarios replace the shipped REQ-4 scenarios verbatim. The first two shipped scenarios
are preserved and extended; the third shipped scenario is extended; three new scenarios are added for
Sale and Purchase.

For full test coverage specifications, cross-reference
`openspec/changes/fiscal-period-monthly-create/specs/fiscal-period-monthly-create/spec.md`
REQ-4 Scenarios 4.1 through 4.7 and REQ-8.

---

**Scenario REQ-4.1 — Any DRAFT across all 5 entities blocks close**

```
GIVEN a period with one or more of Dispatch, Payment, JournalEntry, Sale, or Purchase
      in DRAFT status
WHEN close() is called for that period
THEN close is rejected with PERIOD_HAS_DRAFT_ENTRIES
AND the error details payload contains:
    { dispatches: <n>, payments: <n>, journalEntries: <n>, sales: <n>, purchases: <n> }
    where all 5 keys are present and non-present-entity counts are 0
AND the user-facing message names each entity type with a non-zero count in Spanish
```

**Scenario REQ-4.2 — All documents POSTED or LOCKED — draft check passes**

```
GIVEN all Dispatch, Payment, JournalEntry, Sale, and Purchase records in the period
      are in POSTED or LOCKED status (no DRAFTs)
WHEN close() is called
THEN the draft check passes
AND close proceeds to the balance check step
```

**Scenario REQ-4.3 — Only JournalEntry drafts exist**

```
GIVEN a period with one JournalEntry in DRAFT status
AND all Dispatch, Payment, Sale, Purchase records are POSTED or absent
WHEN close() is called
THEN close is rejected with PERIOD_HAS_DRAFT_ENTRIES
AND error.details.journalEntries >= 1
AND error.details.dispatches = 0, error.details.payments = 0,
    error.details.sales = 0, error.details.purchases = 0
```

**Scenario REQ-4.4 — Only Sale drafts exist (new — corrected from shipped)**

```
GIVEN a period with one Sale in DRAFT status
AND all Dispatch, Payment, JournalEntry, Purchase records are POSTED or absent
WHEN close() is called
THEN close is rejected with PERIOD_HAS_DRAFT_ENTRIES
AND error.details.sales = 1
AND error.details.dispatches = 0, error.details.payments = 0,
    error.details.journalEntries = 0, error.details.purchases = 0
AND the user-facing message contains "venta(s)"
```

**Scenario REQ-4.5 — Only Purchase drafts exist (new — corrected from shipped)**

```
GIVEN a period with one Purchase in DRAFT status
AND all Dispatch, Payment, JournalEntry, Sale records are POSTED or absent
WHEN close() is called
THEN close is rejected with PERIOD_HAS_DRAFT_ENTRIES
AND error.details.purchases = 1
AND error.details.dispatches = 0, error.details.payments = 0,
    error.details.journalEntries = 0, error.details.sales = 0
AND the user-facing message contains "compra(s)"
```

**Scenario REQ-4.6 — Draft check and summary report the same counts (coherence)**

```
GIVEN a period with DRAFT Sale and DRAFT Purchase records
WHEN getSummary() is called AND close() is called independently on the same state
THEN getSummary().drafts.sales = error.details.sales from close()
AND getSummary().drafts.purchases = error.details.purchases from close()
```

---

## Invariant: REQ-4 and REQ-5 entity lists must remain synchronized

REQ-4 (draft check) and REQ-5 (lock cascade) MUST always enumerate the same set of entity types.
A future change that adds a new entity type to REQ-5's lock cascade MUST also update REQ-4's draft
check in the same spec revision. Updating one without the other is the authoring error that produced
the original F-03 bug.

This invariant is encoded here as an explicit constraint to prevent the same class of drift in
future changes.

---

## Diff summary (shipped REQ-4 → corrected REQ-4)

| Attribute | Shipped (2026-04-21) | Corrected |
|---|---|---|
| Entity types checked | Dispatch, Payment, JournalEntry | Dispatch, Payment, JournalEntry, Sale, Purchase |
| `countDraftDocuments` return type | `{ dispatches, payments, journalEntries }` | `{ dispatches, payments, journalEntries, sales, purchases }` |
| `PERIOD_HAS_DRAFT_ENTRIES.details` shape | `{ dispatches, payments, journalEntries }` | `{ dispatches, payments, journalEntries, sales, purchases }` |
| User-facing message entities | despacho(s), pago(s), asiento(s) | despacho(s), pago(s), asiento(s), venta(s), compra(s) |
| Scenarios | 3 | 6 (3 preserved + 3 new) |

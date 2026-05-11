# POC operational-doc-type-hex (HEX cementado)

> **Cementación**: POC operational-doc-type hex closure definitivo 2026-05-11.
> **Cross-ref**: [../07-poc-history.md](../07-poc-history.md) bookmark consolidated.

## Detail cumulative cross-POC matures heredado

- 12 commits cumulative POC + 1 commit D1 doc-only = 13 commits push final origin master batch único.
- Cycles 6/6 atomic + D1: C0 Domain + C1 Application + C2 Infrastructure + C3 Presentation + C4 Cross-feature cutover + C5 Wholesale delete legacy features/operational-doc-types/.
- 51α RED→PASS cumulative (7+14+13+8+8+8): C0 7α domain shape + C1 14α service 5 methods (list+getById+create+update+deactivate) + C2 13α mapper+Prisma repo (upsert+P2002+countActivePayments) + C3 8α presentation barrel + C4 8α cross-feature cutover (3 RSC pages + 2 API routes) + C5 8α wholesale delete.
- Paired sister expense hex precedent EXACT mirror cumulative cross-POC matures heredado — workflow-lock-NEW paired-sister-default-no-surface.
- Variances honest surfaced:
  - α5 EXPANDED 3 errors (NotFound + DuplicateCode + InUse) vs expense 2 errors — business invariants legacy derived (P2002 unique constraint catch + countActivePayments > 0 deactivate guard).
  - Entity mutations pattern NEW for stateful aggregates (rename + changeDirection + deactivate) — expense paired sister immutable, operational-doc-type requires mutable methods + save() upsert at repo (not create-only).
  - Singular naming variance: legacy `OperationalDocTypesService` → hex `OperationalDocTypeService` paired sister `ExpenseService` precedent.
  - Error boundary cutover: legacy `ConflictError` from `@/features/shared/errors` → hex `OperationalDocTypeInUseError` domain error.
- Cross-feature cutover 5 consumers atomic single batch: 3 RSC pages (payments/new + payments/[paymentId] + settings/operational-doc-types) + 2 API routes (operational-doc-types + operational-doc-types/[docTypeId]).
- R5 absoluta domain ZERO Prisma imports — OPERATIONAL_DOC_DIRECTIONS const array + OperationalDocDirection type local domain value-object.
- Drift detection pre-POC: inventory #1939 claim "features/{rag, pricing} 0 consumers huérfanos" SUPERSEDED by filesystem recon — 4 real consumers (2 rag + 2 pricing in ai-agent+documents). Saved from breaking 4 production import sites.

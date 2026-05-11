# POC document-signature-config-hex (HEX cementado)

> **Cementación**: POC document-signature-config hex closure definitivo 2026-05-11.
> **Cross-ref**: [../07-poc-history.md](../07-poc-history.md) bookmark consolidated.

## Detail cumulative cross-POC matures heredado

- 12 commits cumulative POC + 1 commit D1 doc-only = 13 commits total.
- Cycles 6/6 atomic + D1: C0 Domain + C1 Application + C2 Infrastructure + C3 Presentation + C4 Cross-feature cutover + C5 Wholesale delete legacy features/document-signature-config/.
- 54α RED→PASS cumulative (8+8+11+8+10+9): C0 8α domain shape ADAPTED config-entity upsert pattern (R5 absoluta local enum const arrays DocumentPrintType 8 + SignatureLabel 7, ZERO Prisma imports) + C1 8α service 3 methods (listAll/getOrDefault/upsert) + C2 11α mapper+Prisma repo composite-unique upsert + C3 8α presentation barrel + C4 10α cross-feature cutover (3 source routes/pages + 2 cross-feature accounting + 5 test mock paths) + C5 9α wholesale delete.
- Paired sister product-type hex precedent ADAPTED — variances:
  - Config-entity upsert pattern (NOT CRUD): upsert semantics by composite key (orgId+documentType), no create/update/delete/deactivate
  - R5 absoluta domain local const arrays (DocumentPrintType 8 values + SignatureLabel 7 values) — ZERO Prisma imports
  - 0 domain errors (config upsert always succeeds, no NotFound/Duplicate guards)
  - Service returns DocumentSignatureConfigView DTO for listAll/getOrDefault, DocumentSignatureConfigSnapshot for upsert
  - Entity mutations: updateConfig(labels+showReceiverRow) only
- Cross-feature cutover 10 consumer files atomic single batch: 1 RSC page (settings/company) + 2 API routes (signature-configs + signature-configs/[documentType]) + 2 cross-feature accounting (journal.service.ts + voucher-pdf.composer.ts) + 5 test mock path updates.
- R5 absoluta domain ZERO Prisma imports.

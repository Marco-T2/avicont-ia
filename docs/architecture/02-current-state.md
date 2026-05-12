# 02. Current State — Inventory Snapshot 2026-05-12 (updated POC #3a)

> **Cementación**: POC docs-refactor recon inventory cumulative cross-POC matures.
> **Source**: Filesystem scan `modules/` + `features/` + grep consumers.
> **Total LOC pending migration**: ~12,673 LOC across 2 features legacy (post POC organizations hex closure).

## Módulos hex cementados (25/25)

| Module | Estado | Tests | Consumers | Híbrido/Notas |
|---|---|---|---|---|
| `modules/accounting` | HEX ✅ | 58 | 45 | POC #2a types + POC #2b utils + POC #2c account-subtype + POC #2d ui-helpers → hex; **POC #3a** NEW domain port `accounts-crud.port.ts` (+133 LOC, 15 methods, interface-only); **POC #3b** NEW infra adapter `prisma-accounts.repo.ts` (+302 LOC, 15 methods, hybrid constructor Option A, 2 NEW integration+unit test files); public barrel (server.ts) 2-block structure; domain/ports/ now has 9 ports |
| `modules/audit` | HEX ✅ | 54 | 8 | POC audit hex closed — READ-only + raw SQL CTE preserved + UserNameResolver port |
| `modules/contact-balances` | HEX ✅ | 4 | 8 | - |
| `modules/dispatch` | HEX ✅ | 89 | 15 | POC dispatch hex closed — Sale architectural mirror + state machine + legacy accounting adapter ports |
| `modules/contacts` | HEX ✅ | 15 | 12 | - |
| `modules/expense` | HEX ✅ | 45 | 11 | POC expense hex closed |
| `modules/farm` | HEX ✅ | 11 | 18 | POC farms+lots |
| `modules/fiscal-periods` | HEX ✅ | 9 | 7 | ⚠️ usa `features/shared` |
| `modules/iva-books` | HEX ✅ | 16 | 22 | POC #11 closed; public barrel (server.ts) POC poc-hex-public-barrels |
| `modules/lot` | HEX ✅ | 13 | 14 | POC farms+lots |
| `modules/monthly-close` | HEX ✅ | 12 | 5 | - |
| `modules/mortality` | HEX ✅ | 4 | 6 | ⚠️ usa `features/shared` — primer POC histórico |
| `modules/operational-doc-type` | HEX ✅ | 51 | 7 | POC operational-doc-type hex closed — oleada 1 quick win |
| `modules/org-settings` | HEX ✅ | 9 | 3 | - |
| `modules/document-signature-config` | HEX ✅ | 54 | 5 | POC document-signature-config hex closed — oleada 1 quick win |
| `modules/product-type` | HEX ✅ | 57 | 9 | POC product-type hex closed — oleada 1 quick win |
| `modules/payables` | HEX ✅ | 10 | 8 | ⚠️ usa `features/shared` |
| `modules/payment` | HEX ✅ | 17 | 11 | POC #8 closed |
| `modules/purchase` | HEX ✅ | 26 | 19 | ⚠️ usa accounting + permissions |
| `modules/receivables` | HEX ✅ | 11 | 7 | POC #6 closed |
| `modules/sale` | HEX ✅ | 30 | 16 | ⚠️ usa accounting + permissions |
| `modules/shared` | HEX ✅ | 6 | 2 | - |
| `modules/org-profile` | HEX ✅ | 54 | 10 | POC org-profile hex closed — config-entity + BlobStoragePort NEW |
| `modules/voucher-types` | HEX ✅ | 11 | 4 | - |
| `modules/organizations` | HEX ✅ | 139 | 50+ | POC organizations hex closed — 3 aggregates + DB-first Clerk saga + 7 adapter ports |

## Features legacy — hex migration candidates (1)

| Feature | LOC | Tests | Consumers | Oleada target | Notes |
|---|---|---|---|---|---|
| `features/accounting` | ~12,252 | 65 | 128 | 5 — residual POST-POC #2d shim | 3 type files → SHIM (POC #2a); 4 utils files → SHIM (POC #2b: account-code, correlative, accounting-helpers, journal.dates); 2 account-subtype files → SHIM (POC #2c: utils + resolve); 1 ui-helper file → SHIM (POC #2d: journal.ui, −41 net LOC); canonical homes `/modules/accounting/presentation/dto/` + `/modules/accounting/domain/` |
| `features/account-balances` | 150 | 0 | 2 | defer — shim+redirect, circular dep accounting | |

## Features — cross-cutting infrastructure (NOT hex target) (9)

> Reclasificación 2026-05-11 post recon profundo ai-agent. Estas features son infraestructura transversal, orquestación, o integración — sin domain aggregates. Hex 4-layer no aporta valor.

| Feature | LOC | Tests | Consumers | Razón NO hex |
|---|---|---|---|---|
| `features/permissions` | 561 | 6 | **183** | Transversal cross-cutting — guards/middleware |
| `features/shared` | 418 | 6 | **230** | Base classes + errors compartidos |
| `features/ai-agent` | 3,912 | 20 | 14 | Orquestación LLM — zero domain aggregates, ya consume hex via ports |
| `features/documents` | 422 | 1 | 5 | Integración file mgmt + rag |
| `features/rag` | 193 | 0 | 2 | Infraestructura pgvector + embeddings |
| `features/pricing` | 70 | 0 | 2 | Cálculo puro — satellite ai-agent |
| `features/reports` | 330 | 2 | 4 | Static catalog — readonly const arrays, zero service/DB/domain |
| `features/users` | 82 | 0 | 19 | Identity resolution — 19/22 consumers use resolveByClerkId auth plumbing |
| `features/auth` | 57 | 1 | 1 | Auth wrapper thin |

## Métricas clave

- **Total hex cementados**: 25/25 módulos completos (4 capas: domain + application + infrastructure + presentation)
- **Hex candidates pending**: 1 feature ≈ **12,673 LOC** (accounting residual + account-balances deferred shim)
- **Cross-cutting infrastructure (NOT hex)**: 9 features ≈ **6,045 LOC** (reclasificación 2026-05-11)
- **Top cross-consumers**: `features/shared` (230), `features/permissions` (183), `features/accounting` (128)

## Híbridos detectados (8 módulos hex importan legacy)

8 módulos hex (fiscal-periods, mortality, payables, payment, purchase, receivables, sale + 1 más) importan de `features/{shared, accounting, permissions}`. Migración parcelada esperada cumulative cross-POC matures heredado.

> `modules/operational-doc-type` NO híbrido — zero imports from features/ (standalone hex completo).

## Public barrels POC cementación (25/25 COMPLETE as of 2026-05-12)

✅ **modules/accounting/presentation/server.ts** — JournalsService + types + 7 domain exports in 2 blocks: `// ── Domain utils ──` (6 exports: 4 utils-pure + 2 account-subtype) + `// ── Domain UI helpers ──` (1 export: journal.ui) (POC #2a dto/ + POC #2b + POC #2c + POC #2d)  
✅ **modules/accounting/domain/ports/accounts-crud.port.ts** (~133 LOC) — AccountsCrudPort interface, 15 methods verbatim 1:1 legacy AccountsRepository. First port-creation POC (#3a). No impl — adapter in #3b. tx?: unknown opaque on create/update/seedChartOfAccounts. countJournalLines TODO comment for AccountUsagePort future split. Port count in domain/ports/: 9 total (RED 45568edf · GREEN 01656b96)  
✅ **modules/iva-books/presentation/server.ts** — IvaBookService + factories  
⚠️ **NOTE**: Non-hex outliers `features/{purchase, sale, shared}` ALSO lack server.ts (surface honest — outside POC poc-hex-public-barrels scope, defer to future consolidation).

## Anomalías honest surface

1. **`features/accounting` ~12,252 LOC + 128 consumers DESPITE POC #2d closed**: shim residual cumulative cross-POC #2a+#2b+#2c+#2d (~41 LOC net migrated POC #2d). utils-types sweep COMPLETE (4-way subdivision done). Remaining LOC = core accounting logic deferred to oleada 5.
2. **`features/ai-agent` reclasificado**: 3,912 LOC recon profundo 2026-05-11 — NO hex candidate (orchestration/integration, zero domain aggregates, ya consume hex via ports). Reclasificado cross-cutting infrastructure.

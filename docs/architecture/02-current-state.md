# 02. Current State — Inventory Snapshot 2026-05-12 (updated poc-quick-cleanup PRICING C2)

> **Cementación**: POC docs-refactor recon inventory cumulative cross-POC matures. Updated POC #3f 2026-05-12.
> **Source**: Filesystem scan `modules/` + `features/` + grep consumers.
> **Total LOC pending migration**: ~12,406 LOC across 2 features legacy (post POC #3f accounts.repository.ts deleted −267 net).

## Módulos hex cementados (25/25)

| Module | Estado | Tests | Consumers | Híbrido/Notas |
|---|---|---|---|---|
| `modules/accounting` | HEX ✅ | 115 | 45 | POC #2a types + POC #2b utils + POC #2c account-subtype + POC #2d ui-helpers → hex; **POC #3a** NEW domain port `accounts-crud.port.ts` (+133 LOC, 15 methods, interface-only, RED 45568edf · GREEN 01656b96 · D1 863b6665); **POC #3b** NEW infra adapter `prisma-accounts.repo.ts` (+302 LOC, 15 methods, hybrid constructor Option A, 2 NEW integration+unit test files, RED 02284e0d · GREEN 10df7d1e · D1 f739b609); **POC #3c** NEW app service `accounts.service.ts` (+298 LOC, 7 methods, deps-object pattern, atomic $transaction for parent.isDetail flip, 2 NEW unit+shape test files, RED 62d4728a · GREEN d58dd1a2); composition-root extended with `makeAccountsService()`; server.ts barrel extended (AccountsService + AccountsServiceDeps + makeAccountsService); domain/ports/ now has 9 ports; **POC #3d** routes+pages cutover (+95 / -93 LOC, RED 2e993d35 · GREEN 3062ba16 · D1 1b41fcfe) — 7 consumers hex (2 routes `accounts/route.ts` + `accounts/[accountId]/route.ts` + 5 pages: `accounting/accounts`, `accounting/journal/new`, `accounting/journal/[entryId]/edit` SPLIT-import, `accounting/ledger`, `sales/new`); NEW `presentation/validation.ts` (createAccountSchema + updateAccountSchema verbatim, payment precedent — no server-only, no JSDoc); SHIM `features/accounting/accounting.validation.ts` re-export (journal schemas untouched, removal scheduled POC #3e); 6 page-test vi.mock atomic (mock hygiene); W-sweep applied (#3b F-01 adapter L7 JSDoc + #3c W-02 service L208-209 `as unknown` removal); shape sentinel 38α cumulative; **POC #3e** cross-module retire (+68 / -524 LOC net, RED 37b57951 · GREEN c6af8468 · D1 0d3423c2) — 12 cross-module consumers cutover (2 service via `makeAccountsService()`: sales/[saleId]/page.tsx + legacy-account-seed.adapter.ts; 10 repo via `new PrismaAccountsRepo()`: sale+purchase comp-roots, dispatch SPLIT-import, org-settings, payment SPLIT-import + JSDoc 1-token rename, accounting legacy-accounts-read.adapter, ai-agent find-accounts+parse-operation, payments/new+[paymentId] pages) + barrel shrink (server.ts L3+L4 removed: AccountsRepository + AccountsService exports) + accounts.service.ts (225 LOC) + its test DELETED; 6 mock units (7 files) atomic (sales rbac class→factory, payments rbac×2 class rename, sale+purchase UoW integration type swap, ai-agent tests type swap); **Discovered during GREEN: AutoEntryGenerator ctor structural widening (Marco-locked Option 3 invariant-collision-elevation) — accountsRepo type AccountsRepository → AccountsCrudPort (hex port, Liskov substitution; method audit: only findByCode used) + 2 hidden importers fixed (W-#3e-01 retirement-reinventory-gate miss: legacy-account-lookup.adapter.test.ts + prisma-journal-entry-factory.adapter.integration.test.ts)**; 51α shape sentinel; tsc 27 EQUAL; suite 51 FAIL baseline EXACT preserved (zero cascade-NEW); **POC #3f** legacy retirement (−267 net LOC, RED 3fdb737c · GREEN 20dce277 · D1 fb7dc642) — 2 sibling PORT-widens: `ledger.service.ts` + `journal.service.ts` → AccountsCrudPort + PrismaAccountsRepo (Option 3 mirror #3e AutoEntryGenerator); `features/accounting/accounts.repository.ts` DELETED (zero remaining consumers post-migration); SHIM `accounting.validation.ts` L4–L9 re-export block removed (account schemas gone; journal schemas L11+ KEPT); **R-01 CLOSED**: legacy inline `AccountListFilters` dies with file deletion (no dedup needed, canonical lives in hex domain); **W-01**: cross-cycle α34+α35 in `poc-accounting-routes-pages-cutover-shape.test.ts` revoked atomically in GREEN (transitional #3d SHIM-EXISTS assertions flipped to SHIM-ABSENT; [[invariant_collision_elevation]] escalated + resolved same commit); 12α NEW sentinel (2 PASS + 10 FAIL pre-GREEN → 12/12 PASS post-GREEN); tsc 27 EQUAL; suite 51 FAIL baseline EXACT |
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
| `features/pricing` | 70 | 0 | 0 | **DELETED** → relocated to `features/ai-agent/pricing/` (poc-quick-cleanup C2 65f66e0c); consumers=0 post-cutover |
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

✅ **modules/accounting/presentation/server.ts** — JournalsService + types + 7 domain exports in 2 blocks: `// ── Domain utils ──` (6 exports: 4 utils-pure + 2 account-subtype) + `// ── Domain UI helpers ──` (1 export: journal.ui) (POC #2a dto/ + POC #2b + POC #2c + POC #2d). **POC #3c** added: `AccountsService` class export + `AccountsServiceDeps` type export + `makeAccountsService` factory export in `// ── Accounts hex service (POC #3c) ──` block.  
✅ **modules/accounting/presentation/validation.ts** (POC #3d) — Zod schemas hex layer: `createAccountSchema` (superRefined root-account type) + `updateAccountSchema` + inferred DTOs (CreateAccountInputDto, UpdateAccountInputDto). Paired-sister payment precedent: NO `server-only`, NO JSDoc header. Legacy `features/accounting/accounting.validation.ts` SHIM account re-export block REMOVED in POC #3f (L4–L9 deleted); journal schemas L11+ KEPT (createJournalEntrySchema + updateJournalEntrySchema + derived exports) until journal-service hex migration POC.  
✅ **modules/accounting/domain/ports/accounts-crud.port.ts** (~133 LOC) — AccountsCrudPort interface, 15 methods verbatim 1:1 legacy AccountsRepository. First port-creation POC (#3a). No impl — adapter in #3b. tx?: unknown opaque on create/update/seedChartOfAccounts. countJournalLines TODO comment for AccountUsagePort future split. Port count in domain/ports/: 9 total (RED 45568edf · GREEN 01656b96 · D1 863b6665)  
✅ **modules/iva-books/presentation/server.ts** — IvaBookService + factories  
⚠️ **NOTE**: Non-hex outliers `features/{purchase, sale, shared}` ALSO lack server.ts (surface honest — outside POC poc-hex-public-barrels scope, defer to future consolidation).

## Anomalías honest surface

1. **`features/accounting` ~12,210 LOC + 128 consumers DESPITE POC #2d/#3a/#3b/#3c/#3d closed**: shim residual cumulative cross-POC #2a+#2b+#2c+#2d (~41 LOC net) + #3d Zod schemas (~40 LOC) migrated. Hex chain #3a→#3d COMPLETE for accounts CRUD (port + adapter + service + 7 consumers + Zod schemas). Remaining LOC = core accounting logic (journal/legacy services/legacy accounts service) deferred to oleada 5.
2. **`features/ai-agent` reclasificado**: 3,912 LOC recon profundo 2026-05-11 — NO hex candidate (orchestration/integration, zero domain aggregates, ya consume hex via ports). Reclasificado cross-cutting infrastructure.

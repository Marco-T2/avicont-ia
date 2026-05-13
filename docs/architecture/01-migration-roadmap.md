# 01. Migration Roadmap — 5 Oleadas

> **Cementación**: POC docs-refactor (sesión 2026-05-11).
> **Source**: Inventory cumulative cross-POC matures heredado [02-current-state.md](02-current-state.md).
> **Estimación cumulative migration completa**: ~60-80 sesiones cortas.

## 10-POC Framework — Cementación 2026-05-12 POC poc-accounting-routes-pages-cutover (POC #3d COMPLETE)

| POC | Objetivo | Estado | LOC | Consumers |
|---|---|---|---|---|
| **POC #1** | Public barrels (accounting + iva-books server.ts) | ✅ ARCHIVED | +11 | unblock #2+ |
| **POC #2a** | types-to-hex (3 DTO files moved to hex, SHIM barrel reconciled) | ✅ ARCHIVED | +193 | 6/6 REQs PASS |
| **POC #2b** | utils-pure-to-hex (account-code, correlative, accounting-helpers, journal.dates) | ✅ ARCHIVED | +150 | 6/6 REQs PASS |
| **POC #2c** | account-subtype-to-hex (utils + resolve) | ✅ ARCHIVED | +80 | 6/6 REQs PASS |
| **POC #2d** | ui-helpers-to-hex (journal.ui) | ✅ ARCHIVED | +43 | RED 57603898 · GREEN deb6872e |
| **POC #3a** | accounts-crud-port (domain port interface, 15 methods verbatim legacy) | ✅ DONE | +133 | RED 45568edf · GREEN 01656b96 · D1 863b6665 |
| **POC #3b** | PrismaAccountsRepo adapter (hex infra — implements AccountsCrudPort) | ✅ DONE | +302 | RED 02284e0d · GREEN 10df7d1e · D1 f739b609 |
| **POC #3c** | AccountsService app layer + composition root | ✅ DONE | +298 | RED 62d4728a · GREEN d58dd1a2 · D1 da8165d5 |
| **POC #3d** | routes + pages cutover + Zod schemas | ✅ DONE | +95 / -93 | RED 2e993d35 · GREEN 3062ba16 · D1 1b41fcfe |
| **POC #3e** | cross-module cutover (sale/purchase/dispatch/org-settings/ai-agent/payments) + AutoEntryGenerator ctor structural widening (Marco-locked Option 3) + 2 hidden importers fixed (W-#3e-01 inventory miss) | ✅ DONE | +68 / -524 | RED 37b57951 · GREEN c6af8468 · D1 0d3423c2 |
| **POC #3f** | legacy retirement — 2 sibling PORT-widens (ledger.service + journal.service → AccountsCrudPort + PrismaAccountsRepo) + accounts.repository.ts DELETE + SHIM trim (accounting.validation.ts L4–L9 removed); R-01 auto-closed; W-01 cross-cycle α34+α35 revoked atomic | ✅ DONE | -267 net | RED 3fdb737c · GREEN 20dce277 · D1 fb7dc642 |
| **POC #4** | accounts hex (replaces original broad #3 scope — now handled by #3a–#3f) | ✅ SUBDIVIDED | → #3a–#3f | accounts CRUD migration sub-divided |
| **POC #5** | auto-entry + lifecycle + validation | pending | ~600 | journal-driver |
| **POC #6** | reports paired-sister 4-batch (trial/equity/worksheet/initial) | pending | ~800 | journal-consumer |
| **POC #7** | financial-statements XL POC | pending | ~1500 | reporting-stack |
| **POC #8** | journal completion + parallel-impl reconciliation (JournalService→JournalsService) | pending | ~700 | core-rename |
| **POC #9** | account-balances + ledger paired (resuelve circular) | pending | ~400 | final-cycle |
| **POC #10** | server.ts barrel delete final | pending | -11+ | total cleanup |

### Principios cumulative cross-POC matures heredados

- **Paired sister reuse aggressive** per POC nuevo — EXACT mirror precedent matures cumulative
- **Bundling sesiones POC pequeño** (1 sesión = 1 huérfano delete viable)
- **Skip Step 0 expand verbose** en POCs simples (huérfanos sin tests + 0 consumers)
- **Single-axis atomic discipline** — POC #2 original (utils-types sweep B-batch) sub-dividido 4-way (types→hex, pure-utils→hex, account-subtype→hex, ui-helpers→hex) por pairing & reusability
- **Defer accounting big bang** scope dedicado ÚLTIMO (12.5k LOC + 128 consumers residual POC #10 shim cleanup)
- **Cycle-start cold próxima sesión**: read SOLO docs relevantes scope (NO architecture.md complete cumulative)

## OLEADA 1 — Quick wins (3 POCs ~1-2 sesiones cada uno)

| POC | Source | LOC | Tests | Consumers | Paired sister |
|---|---|---|---|---|---|
| `poc-quick-cleanup` | inline + delete `features/{rag, pricing}` CONSUMERS-LIGHT | 263 | 0 | **4** (rag→ai-agent+documents; pricing→ai-agent×2) | NOT TRUE-ORPHAN — mechanical inline cutover precedent #3e — ✅ **COMPLETE** (pricing: RED 11a00455 · GREEN 65f66e0c · D1 995e2ea9; rag: RED 0c1a52f7 · GREEN 285337ab · D1 ea47485c; W-01 706d3b84); 36α PASS (18 pricing + 18 rag); features/pricing + features/rag DELETED |
| `poc-expense-hex` ✅ CLOSED | `features/expenses` → `modules/expense` | 281 | 0 | 11 | farms+lots paired sister — 17 commits 6 ciclos 64α |
| `poc-operational-doc-types` ✅ DONE | `features/operational-doc-types` → `modules/operational-doc-type` | +428 hex / -256 legacy | 0 | 7 | farms+lots paired sister — 13 commits 6 ciclos 57α; C0 RED 4049a0af · GREEN dedf612c; C1 RED 3bee72b2 · GREEN 21cce2f2; C2 RED b2407b44 · GREEN 066b0146; C3 RED 528157da · GREEN 32223887; C4 RED b8ad5bf8 · GREEN 7be0bfed; C5 RED 62a505f3 · GREEN f2657943; D1 3218b520 |

## OLEADA 2 — Accounting utils sweep 4-way sub-divided + transversales (6 POCs)

| POC | Source | LOC | Tests | Consumers | Notas |
|---|---|---|---|---|---|
| `poc-accounting-types-to-hex` ✅ CLOSED | `features/accounting/journal/accounts/ledger.types.ts` → `modules/accounting/presentation/dto/` | +193 | 15α | 6/6 REQs PASS | POC #2a — types canonical home hex |
| `poc-utils-pure-to-hex` ✅ CLOSED | `features/accounting/{account-code, correlative, accounting-helpers, journal.dates}` → `modules/accounting/domain/` | +150 | 21α | 6/6 REQs PASS | POC #2b — paired sister #2a |
| `poc-account-subtype-to-hex` ✅ CLOSED | `features/accounting/{utils + resolve}` account-subtype | +80 | 23α | 6/6 REQs PASS | POC #2c — paired sister #2b |
| `poc-ui-helpers-to-hex` ✅ CLOSED | `features/accounting/journal.ui` | +43 | 13α | 6/6 REQs PASS | POC #2d — paired sister #2c; NEW barrel block Domain UI helpers |
| `poc-shared-canonical` ✅ CLOSED | `features/shared` → `modules/shared` expand | 418 | 6 | **230** | **4 sub-POCs ARCHIVED** (errors: dffaeb15 · middleware-auth: c56a1360 · audit: 69178f3f · base-repo: c242f858); 12 commits total; Option A/B SHIM strategic divergence; spy-consumer-namespace NEW invariant; 0 prod consumer edits (all via SHIMs, final deletion deferred POC #10) |
| `poc-permissions-hex` ✅ CLOSED | `features/permissions` → `modules/permissions` | 561 | 6 | **183** | **3 sub-POCs ARCHIVED** (domain: d537e015 · infra: dede98f7 · app: 0eead335); 9 commits total; Option B SHIM dominant (5 of 7 SHIMs — isolatedModules + spy gate); cross-module-boundary spy invariant NEW LOCKED (DIFFERS from poc-shared-audit closed-over-sibling); cross-module-boundary mock-target-rewrite invariant NEW LOCKED (B1 test mock target updated atomically with B3 cutover per [[mock_hygiene_commit_scope]] + [[diagnostic_stash_gate_pattern]]); 0 prod consumer edits; 84 vi.mock + 1 vi.spyOn preserved; final SHIM deletion deferred POC #10. **OLEADA 2 COMPLETE 6/6** |

## OLEADA 3 — Features small-medium sin POC histórico (6 POCs)

| POC | Source | LOC | Tests | Consumers | Notas |
|---|---|---|---|---|---|
| `poc-product-types-hex` ✅ CLOSED | `features/product-types` → `modules/product-type` (hex full: domain/application/infrastructure/presentation) | 219 | 0 | 9 | D1 cementación `108a0086` (pre-OLEADA-3-sweep migration); 6 hex sub-files + 4 layered __tests__ dirs; SHIM features/ already deleted (C5 wholesale-delete closed) |
| `poc-document-signature-config-hex` ✅ CLOSED | `features/document-signature-config` → `modules/document-signature-config` (hex full) | 222 | 3 | 5 | D1 cementación `8dd3a846` (joint D1 with org-profile `2959e3c6`); 6 hex sub-files + paired sister of product-type-hex EXACT mirror; SHIM features/ already deleted |
| `poc-org-profile-hex` ✅ CLOSED | `features/org-profile` → `modules/org-profile` (hex full + BlobStoragePort) | 174 | 3 | 10 | D1 cementación `2959e3c6` (joint with doc-sig-config) + C5 wholesale-delete `f1765571`; paired sister of doc-sig-config-hex EXACT mirror + BlobStoragePort NEW port + VercelBlobStorageAdapter; SHIM features/ already deleted |
| `poc-account-balances-hex` ✅ CLOSED | `features/account-balances` → `modules/account-balances` (application + infrastructure) | 150 | 0 | **7** | RED `2565077d` · GREEN `96aec947` · D1 (this row); 14α (13 FAIL + 1 PASS-lock α4 server-only); paired sister poc-users-hex EXACT mirror axis-distinct on (a) 5-file C1 atomic (+1 types file vs sister 3-file), (b) +1 REQ-004 bypass (JournalEntryWithLines DIRECT from `@/modules/accounting/presentation/dto/journal.types` — breaks type-level circular dep), (c) 7 consumers (5 runtime + 2 type-only test fixtures, vs sister 21), (d) roadmap closure line 65 OLEADA 3 6/6 CLOSED; Option A SHIM preserves `@/features/account-balances/server` mock-target path → 1 vi.mock decl (page-rbac.test.ts) + 7 consumers transit zero touch; REQ-004 canonical-import-bypass applied (2 bypasses: JournalEntryWithLines + BaseRepository direct from `@/modules/*`); SHIM deletion deferred retirement bundle (OLEADA 3 trio poc-auth-hex + poc-users-hex + poc-account-balances-hex ALL CLOSED — C5 wholesale-delete ready for retirement phase). **OLEADA 3: 6/6 CLOSED** (FINAL — wave complete) |
| `poc-users-hex` ✅ CLOSED | `features/users` → `modules/users` (application + infrastructure) | 82 | 0 | **21** | RED `6b41ce09` · GREEN `274ecd2e` · D1 (this row); 14α (13 FAIL + 1 PASS-lock α4 server-only); paired sister poc-shared-base-repo EXACT mirror axis-distinct on 2-layer split + single SHIM barrel named re-export; Option A SHIM preserves `@/features/users/server` mock-target path → 8 vi.mock decls + 21 runtime consumers transit zero touch; REQ-004 canonical-import-bypass applied (NotFoundError + BaseRepository direct from `@/modules/shared/*`); SHIM deletion deferred retirement bundle (poc-auth-hex + poc-users-hex + poc-account-balances-hex per OLEADA 3 pattern — poc-auth-hex NOW CLOSED, features/auth/sync-user.service.ts no longer imports through SHIM). Consumer count corrected 19 → 21 (recon discovered 17 app routes + 1 features/auth + 1 modules/organizations adapter + 2 misc; prior count stale) |
| `poc-auth-hex` ✅ CLOSED | `features/auth` → `modules/auth/application` (application-only flat) | 205 | 1 | **1** | RED `ac497dda` · GREEN `693a51c4` · D1 (this row); 14α (13 FAIL + 1 PASS-lock α4 server-only); paired sister poc-users-hex EXACT mirror axis-distinct on application-only flat (no infrastructure/) + 4-file atomic (+1 test relocation vs sister 3-file); Option A SHIM preserves `import "server-only"` + named re-export; REQ-004 canonical-import-bypass applied (UsersService + NotFoundError/AppError direct from `@/modules/*`); dual-mock wiring: `@/features/users/server` vi.mock PRESERVED + `@/modules/users/application/users.service` canonical mock ADDED alongside; SHIM deletion deferred retirement bundle (poc-auth-hex + poc-users-hex + poc-account-balances-hex per OLEADA 3 pattern). LOC retrofix: stale 57 → actual 205 (56 src + 146 test + 3 SHIM). **OLEADA 3: 6/6 CLOSED** (FINAL — poc-account-balances-hex CLOSED as last sub-POC) |

## OLEADA 4 — Features medianos sin POC histórico (4 POCs) — **2/4 CLOSED**

| POC | Source | LOC | Tests | Consumers |
|---|---|---|---|---|
| ✅ `poc-reports-hex` | `features/reports` | 330 | 2 | 4 | C0 `db46f0c0` · C1 `c5c2caa0` · C2 D1 (this commit)
| ✅ `poc-documents-hex` CLOSED (C5 deferred) | `features/documents` → `modules/documents` hex (C0–C4) | 422 | 1 | 5 | C0 RED `30390d43` · GREEN `2bcaee3e`; C1 RED `c81b3366` · GREEN `8127ec3e`; C2 RED `e003db19` · GREEN `c7e03d2d`; C3 RED `b7a7924b` · GREEN `168e9a33`; C4 RED `495ff6d2` · GREEN `e237c493`; D1 (this commit). 45α PASS (8 C0 + 10 C1 + 10 C2 + 9 C3 + 8 C4). BlobStoragePort upload+del FRESH documents-specific (DIFFERS from org-profile del-only sister). rag/ carved out (REQ-004 cross-module bypass — deferred to poc-rag-hex). features/documents/server.ts SHIM intact (rag/ blocks wholesale delete; C5 deferred). REQ-005 NEGATIVE sentinel enforced (domain + application server-only-free). REQ-007 pdfjs-dist processing library exception with comment lock.
| `poc-audit-hex` | `features/audit` | 833 | 7 | 15 |
| `poc-organizations-hex` | `features/organizations` | 1,643 | 13 | 49 |

## OLEADA 5 — Big bang dedicated MAJOR scope (3 POCs)

| POC | Source | LOC | Tests | Consumers | Notas |
|---|---|---|---|---|---|
| `poc-dispatch-hex` | `features/dispatch` | 2,199 | 5 | 15 | dedicated session |
| `poc-ai-agent-hex` | `features/ai-agent` | 3,912 | 20 | 14 | deuda heredada cleanup pending |
| `poc-accounting-cleanup` | `features/accounting` residual POST-POC #10 | 12,523 | 65 | 128 | ABSOLUTE ÚLTIMO — shim cleanup |

## Token optimization tactics

| Tactic | Aplicación |
|---|---|
| Paired sister reuse aggressive | Cada POC nuevo cita precedent EXACT mirror cumulative cross-POC matures heredado |
| Bundling sesiones | 1 sesión = 1 huérfano delete (POCs ≤ 100 LOC + 0 consumers) |
| Skip Step 0 expand | POCs simples sin tests heredados + 0 consumers cross-feature |
| Read selective cycle-start cold | Solo docs scope-relevant (NO architecture.md complete) |
| Engram cementación canonical homes | §13.X engram NEW por POC sin retroactive doc bloat |
| Atomic single batch single-axis discipline | Paired sister precedent EXACT mirror cumulative cross-POC matures |

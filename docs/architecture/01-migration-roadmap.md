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
| **POC #3e** | cross-module cutover (sale/purchase/dispatch/org-settings/ai-agent/payments) + AutoEntryGenerator ctor structural widening (Marco-locked Option 3) + 2 hidden importers fixed (W-#3e-01 inventory miss) | ✅ DONE | +68 / -524 | RED 37b57951 · GREEN c6af8468 · D1 _pending_ |
| **POC #4** | accounts hex (replaces original broad #3 scope — now handled by #3a–#3e) | ✅ SUBDIVIDED | → #3a–#3e | accounts CRUD migration sub-divided |
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
| `poc-quick-cleanup` | delete `features/{rag, pricing}` huérfanos | 263 | 0 | 0 | N/A — delete directo |
| `poc-expense-hex` ✅ CLOSED | `features/expenses` → `modules/expense` | 281 | 0 | 11 | farms+lots paired sister — 17 commits 6 ciclos 64α |
| `poc-operational-doc-types` | `features/operational-doc-types` → `modules/` | 256 | 0 | 7 | farms+lots paired sister |

## OLEADA 2 — Accounting utils sweep 4-way sub-divided + transversales (6 POCs)

| POC | Source | LOC | Tests | Consumers | Notas |
|---|---|---|---|---|---|
| `poc-accounting-types-to-hex` ✅ CLOSED | `features/accounting/journal/accounts/ledger.types.ts` → `modules/accounting/presentation/dto/` | +193 | 15α | 6/6 REQs PASS | POC #2a — types canonical home hex |
| `poc-utils-pure-to-hex` ✅ CLOSED | `features/accounting/{account-code, correlative, accounting-helpers, journal.dates}` → `modules/accounting/domain/` | +150 | 21α | 6/6 REQs PASS | POC #2b — paired sister #2a |
| `poc-account-subtype-to-hex` ✅ CLOSED | `features/accounting/{utils + resolve}` account-subtype | +80 | 23α | 6/6 REQs PASS | POC #2c — paired sister #2b |
| `poc-ui-helpers-to-hex` ✅ CLOSED | `features/accounting/journal.ui` | +43 | 13α | 6/6 REQs PASS | POC #2d — paired sister #2c; NEW barrel block Domain UI helpers |
| `poc-shared-canonical` | `features/shared` → `modules/shared` expand | 418 | 6 | **230** | ALTO IMPACT cross-codebase |
| `poc-permissions-hex` | `features/permissions` → `modules/permissions` | 561 | 6 | **183** | RBAC transversal |

## OLEADA 3 — Features small-medium sin POC histórico (6 POCs)

| POC | Source | LOC | Tests | Consumers |
|---|---|---|---|---|
| `poc-product-types-hex` | `features/product-types` | 219 | 0 | 9 |
| `poc-document-signature-config-hex` | `features/document-signature-config` | 222 | 3 | 5 |
| `poc-org-profile-hex` | `features/org-profile` | 174 | 3 | 10 |
| `poc-account-balances-hex` | `features/account-balances` | 150 | 0 | 2 |
| `poc-users-hex` | `features/users` | 82 | 0 | 19 |
| `poc-auth-hex` | `features/auth` | 57 | 1 | 1 |

## OLEADA 4 — Features medianos sin POC histórico (4 POCs)

| POC | Source | LOC | Tests | Consumers |
|---|---|---|---|---|
| `poc-reports-hex` | `features/reports` | 330 | 2 | 4 |
| `poc-documents-hex` | `features/documents` | 422 | 1 | 5 |
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

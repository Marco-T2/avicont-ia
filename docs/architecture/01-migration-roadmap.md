# 01. Migration Roadmap — 5 Oleadas

> **Cementación**: POC docs-refactor (sesión 2026-05-11).
> **Source**: Inventory cumulative cross-POC matures heredado [02-current-state.md](02-current-state.md).
> **Estimación cumulative migration completa**: ~60-80 sesiones cortas.

## Principios cumulative cross-POC matures heredados

- **Paired sister reuse aggressive** per POC nuevo — EXACT mirror precedent matures cumulative
- **Bundling sesiones POC pequeño** (1 sesión = 1 huérfano delete viable)
- **Skip Step 0 expand verbose** en POCs simples (huérfanos sin tests + 0 consumers)
- **Defer accounting big bang** scope dedicado ÚLTIMO (12.5k LOC + 128 consumers residual POC #10 shim cleanup)
- **Cycle-start cold próxima sesión**: read SOLO docs relevantes scope (NO architecture.md complete cumulative)

## OLEADA 1 — Quick wins (3 POCs ~1-2 sesiones cada uno)

| POC | Source | LOC | Tests | Consumers | Paired sister |
|---|---|---|---|---|---|
| `poc-quick-cleanup` | delete `features/{rag, pricing}` huérfanos | 263 | 0 | 0 | N/A — delete directo |
| `poc-expense-hex` | `features/expenses` → `modules/expense` | 281 | 0 | 10 | farms+lots paired sister |
| `poc-operational-doc-types` | `features/operational-doc-types` → `modules/` | 256 | 0 | 7 | farms+lots paired sister |

## OLEADA 2 — Transversales desbloquean otros (2 POCs scope mayor)

| POC | Source | LOC | Tests | Consumers | Notas |
|---|---|---|---|---|---|
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

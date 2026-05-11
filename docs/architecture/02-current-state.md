# 02. Current State — Inventory Snapshot 2026-05-11

> **Cementación**: POC docs-refactor recon inventory cumulative cross-POC matures.
> **Source**: Filesystem scan `modules/` + `features/` + grep consumers.
> **Total LOC pending migration**: ~24,264 LOC across 18 features legacy (post POC expense hex closure).

## Módulos hex cementados (18/18)

| Module | Estado | Tests | Consumers | Híbrido/Notas |
|---|---|---|---|---|
| `modules/accounting` | HEX ✅ | 15 | 45 | POC #10 closed |
| `modules/contact-balances` | HEX ✅ | 4 | 8 | - |
| `modules/contacts` | HEX ✅ | 15 | 12 | - |
| `modules/expense` | HEX ✅ | 45 | 11 | POC expense hex closed |
| `modules/farm` | HEX ✅ | 11 | 18 | POC farms+lots |
| `modules/fiscal-periods` | HEX ✅ | 9 | 7 | ⚠️ usa `features/shared` |
| `modules/iva-books` | HEX ✅ | 16 | 22 | POC #11 closed |
| `modules/lot` | HEX ✅ | 13 | 14 | POC farms+lots |
| `modules/monthly-close` | HEX ✅ | 12 | 5 | - |
| `modules/mortality` | HEX ✅ | 4 | 6 | ⚠️ usa `features/shared` — primer POC histórico |
| `modules/org-settings` | HEX ✅ | 9 | 3 | - |
| `modules/payables` | HEX ✅ | 10 | 8 | ⚠️ usa `features/shared` |
| `modules/payment` | HEX ✅ | 17 | 11 | POC #8 closed |
| `modules/purchase` | HEX ✅ | 26 | 19 | ⚠️ usa accounting + permissions |
| `modules/receivables` | HEX ✅ | 11 | 7 | POC #6 closed |
| `modules/sale` | HEX ✅ | 30 | 16 | ⚠️ usa accounting + permissions |
| `modules/shared` | HEX ✅ | 6 | 2 | - |
| `modules/voucher-types` | HEX ✅ | 11 | 4 | - |

## Features legacy pending migration (18)

| Feature | LOC | Tests | Consumers | Oleada target |
|---|---|---|---|---|
| `features/accounting` | 12,523 | 65 | 128 | 5 — residual POST-POC #10 shim |
| `features/ai-agent` | 3,912 | 20 | 14 | 5 — deuda heredada |
| `features/dispatch` | 2,199 | 5 | 15 | 5 |
| `features/organizations` | 1,643 | 13 | 49 | 4 |
| `features/audit` | 833 | 7 | 15 | 4 |
| `features/permissions` | 561 | 6 | **183** | 2 — transversal |
| `features/shared` | 418 | 6 | **230** | 2 — transversal |
| `features/documents` | 422 | 1 | 5 | 4 |
| `features/reports` | 330 | 2 | 4 | 4 |
| `features/operational-doc-types` | 256 | 0 | 7 | 1 — quick win |
| `features/document-signature-config` | 222 | 3 | 5 | 3 |
| `features/product-types` | 219 | 0 | 9 | 3 |
| `features/rag` | 193 | 0 | 0 | 1 — delete directo huérfano |
| `features/org-profile` | 174 | 3 | 10 | 3 |
| `features/account-balances` | 150 | 0 | 2 | 3 |
| `features/users` | 82 | 0 | 19 | 3 |
| `features/pricing` | 70 | 0 | 0 | 1 — delete directo huérfano |
| `features/auth` | 57 | 1 | 1 | 3 |

## Métricas clave

- **Total hex cementados**: 18/18 módulos completos (4 capas: domain + application + infrastructure + presentation)
- **Total legacy pending**: 18 features ≈ **24,264 LOC** + ~1,500 tests cementados legacy
- **Top cross-consumers**: `features/shared` (230), `features/permissions` (183), `features/accounting` (128)
- **Huérfanos**: `features/{rag, pricing}` — 263 LOC, 0 consumers, 0 tests → delete directo

## Híbridos detectados (8 módulos hex importan legacy)

8 módulos hex (fiscal-periods, mortality, payables, payment, purchase, receivables, sale + 1 más) importan de `features/{shared, accounting, permissions}`. Migración parcelada esperada cumulative cross-POC matures heredado.

## Anomalías honest surface

1. **`features/accounting` 12,523 LOC + 128 consumers DESPITE POC #10 closed**: ratio sospechoso shim residual cumulative cross-POC matures. Recon profundo needed clasificar HYBRID vs CLEANUP-PENDING-POST-POC pre-oleada 5.
2. **`features/ai-agent` deuda heredada**: 3,912 LOC sin POC histórico asociado — NO planificado en POCs históricos previos.

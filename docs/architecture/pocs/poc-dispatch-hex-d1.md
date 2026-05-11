# POC dispatch-hex (HEX cementado)

> **Cementación**: POC dispatch hex closure definitivo 2026-05-11.
> **Cross-ref**: [../07-poc-history.md](../07-poc-history.md) bookmark consolidated.

## Detail cumulative cross-POC matures heredado

- 12 commits cumulative POC (C0-C3 sub-agent + C4-C5+D1 orchestrator).
- Cycles 6/6 atomic + D1: C0 Domain + C1 Application + C2 Infrastructure + C3 Presentation + C4 Cross-feature cutover + C5 Wholesale delete.
- 89α RED→PASS cumulative (33+13+8+11+13+11).
- Paired sister Sale architectural mirror — identical state machine (DRAFT→POSTED→LOCKED→VOIDED), accounting cascade (journal+receivable+balances), POSTED-edit reverse-modify-reapply.
- Variances from Sale:
  - Two dispatch types: NOTA_DESPACHO (simple) vs BOLETA_CERRADA (shrinkage+shortage+realNetWeight) — discriminated computation
  - Uses receivables (CxC) instead of payables (CxP)
  - HubService co-located (aggregates Sale hex + Dispatch hex into unified HubItem[])
  - 6 legacy accounting adapter ports (AutoEntryGenerator, JournalRepository, AccountsRepository, AccountBalancesService, etc.)
  - Deprecated recreate() method preserved for backwards compat
- Cross-feature cutover 13 consumer files: 3 pages + 4 API routes + 1 component + 3 vi.mock tests + 2 type-only tests.
- Largest hex module by domain complexity — 1102 LOC service, 660 LOC repository, full state machine with accounting cascade.

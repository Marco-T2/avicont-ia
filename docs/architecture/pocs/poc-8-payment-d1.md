# POC #8 payment (HEX cementado)

> **Cementación**: POC docs-refactor sesión 2026-05-11.
> **Cross-ref**: [../07-poc-history.md](../07-poc-history.md) bookmark consolidated.

## Detail cumulative cross-POC matures heredado

- Aggregate root + child entity, 11 use cases tx-aware, 7 cross-feature ports, shim backward-compat. R9 cementado v0.4: entities con métodos transición estado INMUTABLES — método retorna nueva instancia, invariantes enforzadas dentro del método (Receivable.applyAllocation/revertAllocation espejo Payable).
- tests: 17 modules/payment
- consumers: 11

# Delta Spec: equity-statement-typed-movements
# Change: apertura-patrimony-baseline

**Base spec**: `openspec/specs/equity-statement-typed-movements/spec.md`
**Type**: MODIFIED capability + ADDED requirement

---

## MODIFIED Requirements

### REQ-3 — Invariante intra-statement con filas tipadas y apertura

El builder MUST recalcular `imbalanced` usando:
`SALDO_FINAL[col] == (SALDO_INICIAL[col] + aperturaBaseline[col]) + Σ(filas tipadas)[col] + RESULTADO_EJERCICIO[col]`

Cuando `aperturaBaseline` está presente, MUST fusionarse aditivamente en `initialByColumn` ANTES del chequeo de invariante. La banda `imbalanced` solo aparece si la identidad falla tras incluir tanto las filas tipadas como la apertura.

(Previously: el invariante usaba `SALDO_INICIAL[col]` directamente sin absorber el delta de apertura CA, disparando falso `imbalanced` en empresas de primer período.)

#### Scenario: Aporte clasificado no dispara imbalance

- GIVEN aporte CP de Bs. 200k a 3.1.x, sin otros movimientos patrimoniales, `preliminary=true`
- WHEN se construye el EquityStatement
- THEN `imbalanced === false` y `imbalanceDelta === 0`

#### Scenario: Aporte sin voucher tipado dispara imbalance (legacy)

- GIVEN entry POSTED con voucherType genérico (ej. `CD`) que mueve Bs. 200k directo a 3.1.x
- WHEN se construye el EquityStatement
- THEN `imbalanced === true`, `imbalanceDelta === 200000`, banner muestra el texto v1 ("Diferencia patrimonial sin clasificar…")

#### Scenario: CA en primer período no dispara imbalance

- GIVEN empresa nueva, `aperturaBaseline = { CAPITAL_SOCIAL: 200000 }`, sin prior-state, sin filas tipadas CP/CL/CV
- WHEN se construye el EquityStatement
- THEN `imbalanced === false`, `imbalanceDelta === 0`, `SALDO_INICIAL[CAPITAL_SOCIAL] = 200000`

#### Scenario: CA sin aperturaBaseline (campo omitido) mantiene comportamiento previo

- GIVEN builder invocado sin `aperturaBaseline`, entry CA en el período
- WHEN se construye el EquityStatement
- THEN CA no es absorbido, `imbalanced === true` (comportamiento legacy — solo para retrocompatibilidad de tests)

---

## ADDED Requirements

### REQ-APERTURA-MERGE — Merge del delta CA en SALDO_INICIAL

El sistema MUST agregar los movimientos de tipo CA (Apertura) POSTED sobre cuentas de tipo PATRIMONIO cuya fecha caiga dentro de `[dateFrom, dateTo]` en un mapa `aperturaBaseline`. Este mapa MUST fusionarse aditivamente en `SALDO_INICIAL` BEFORE que el builder ejecute el invariant check. Los movimientos CA MUST NOT emitir una fila tipada ni aparecer en `rows`.

#### Scenario: CA en primer período se absorbe en SALDO_INICIAL

- GIVEN empresa nueva, CA POSTED el 20/04/2026 con débito a cuenta PATRIMONIO `3.1.1` Bs. 200.000, período `[01/04/2026, 30/04/2026]`
- WHEN se genera `aperturaBaseline`
- THEN `aperturaBaseline.get("CAPITAL_SOCIAL") === 200000`; el statement resultante tiene `SALDO_INICIAL[CAPITAL_SOCIAL] = 200000` y `imbalanced === false`

#### Scenario: CA de período N no contamina período N+1

- GIVEN CA POSTED el 20/04/2026, período consultado `[01/05/2026, 31/05/2026]`
- WHEN se genera `aperturaBaseline` para mayo
- THEN `aperturaBaseline` está vacío (CA fuera del rango); el prior-state de mayo ya absorbió el CA vía `getPatrimonioBalancesAt`

#### Scenario: Múltiples CA en el mismo período se suman

- GIVEN dos CA POSTED en abril 2026: CA-1 Bs. 150.000 a `3.1.1`, CA-2 Bs. 50.000 a `3.1.1`
- WHEN se genera `aperturaBaseline`
- THEN `aperturaBaseline.get("CAPITAL_SOCIAL") === 200000`

#### Scenario: CA toca cuenta no-PATRIMONIO — ignorado

- GIVEN CA POSTED con línea a cuenta tipo `ACTIVO` (ej. `1.1.1`)
- WHEN se genera `aperturaBaseline`
- THEN esa línea NO aparece en `aperturaBaseline`; el mapa solo contiene columnas PATRIMONIO

#### Scenario: CA en estado DRAFT excluido

- GIVEN CA con status `DRAFT` dentro del período
- WHEN se genera `aperturaBaseline`
- THEN `aperturaBaseline` está vacío (solo se agregan entries POSTED)

#### Scenario: CA fechado fuera del rango retorna mapa vacío

- GIVEN CA POSTED el 15/03/2026, período `[01/04/2026, 30/04/2026]`
- WHEN se genera `aperturaBaseline`
- THEN `aperturaBaseline` está vacío

---

## REMOVED Requirements

Ninguno. El cambio es aditivo.

---

## Traceability

| REQ | Delivery | Notes |
|-----|----------|-------|
| REQ-3 (modified) | apertura-patrimony-baseline | Invariant now absorbs aperturaBaseline before check |
| REQ-APERTURA-MERGE | apertura-patrimony-baseline | New: CA delta aggregation and merge into SALDO_INICIAL |

# Spec: equity-statement-typed-movements

**Change**: `aportes-capital-fila-tipada`
**Domain**: `equity-statement-typed-movements` (new)

## Purpose

El EEPN v2 debe exponer los movimientos directos al patrimonio (aportes de capital, constitución de reservas, distribuciones) como filas tipadas en vez de ocultarlos dentro de `SALDO_FINAL` y surfacearlos solo como imbalance. La clasificación se deriva del `VoucherTypeCfg.code` asociado al `JournalEntry`.

## Requirements

### REQ-1 — Emisión de fila tipada por voucher-type

El builder MUST emitir una `EquityRow` por cada `VoucherTypeCfg.code` clasificado como "patrimonio" (`CP`, `CL`, `CV`) que tenga al menos una `JournalLine` POSTED en el período con una cuenta de patrimonio. Filas con movimiento neto cero en todas las columnas MUST ser omitidas.

#### Scenario: Aporte de capital genera fila

- GIVEN un JournalEntry POSTED con voucherType.code=`CP` dentro del rango, línea debe a cuenta `3.1.1` por Bs. 200.000
- WHEN se construye el EquityStatement
- THEN hay una fila con `key="APORTE_CAPITAL"`, `label="Aportes de capital del período"`, Bs. 200.000 en columna `CAPITAL_SOCIAL`, ceros en el resto

#### Scenario: Fila sin movimiento no se emite

- GIVEN un período sin ningún entry con voucherType CP/CL/CV
- WHEN se construye el EquityStatement
- THEN las filas `APORTE_CAPITAL`, `CONSTITUCION_RESERVA`, `DISTRIBUCION_DIVIDENDO` NO aparecen en `rows`

### REQ-2 — Orden canónico de filas

El array `rows` MUST respetar el orden: `SALDO_INICIAL` → `APORTE_CAPITAL` → `CONSTITUCION_RESERVA` → `DISTRIBUCION_DIVIDENDO` → `RESULTADO_EJERCICIO` → `SALDO_FINAL`. Filas ausentes (sin movimiento) se omiten sin alterar el orden relativo de las presentes.

#### Scenario: Todas las filas presentes

- GIVEN entries POSTED con voucherType CP, CL, CV en el período + un resultado del ejercicio positivo
- WHEN se construye el EquityStatement
- THEN `rows.map(r => r.key)` es `["SALDO_INICIAL","APORTE_CAPITAL","CONSTITUCION_RESERVA","DISTRIBUCION_DIVIDENDO","RESULTADO_EJERCICIO","SALDO_FINAL"]`

#### Scenario: Solo aportes

- GIVEN un período con entry CP únicamente
- WHEN se construye el EquityStatement
- THEN `rows.map(r => r.key)` es `["SALDO_INICIAL","APORTE_CAPITAL","RESULTADO_EJERCICIO","SALDO_FINAL"]`

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

### REQ-4 — Signo de los movimientos

Aportes y reservas MUST sumar en la columna correspondiente (signo positivo = credit − debit para cuentas ACREEDORA). Distribuciones MUST restar (signo negativo). El valor guardado en `row.cells[col].amount` preserva el signo semántico.

#### Scenario: Distribución resta de Resultados Acumulados

- GIVEN entry CV con débito a 3.4.x por Bs. 50.000 (retiro de utilidades)
- WHEN se construye el EquityStatement
- THEN fila `DISTRIBUCION_DIVIDENDO` tiene Bs. −50.000 en `RESULTADOS_ACUMULADOS`, el total de la fila es Bs. −50.000

### REQ-5 — Proyección preliminar condicional

Cuando hay al menos una fila tipada que toca `RESULTADOS_ACUMULADOS`, el builder MUST omitir la proyección automática de `periodResult` en `SALDO_FINAL[RA]`. El resultado del ejercicio queda exclusivamente en la fila `RESULTADO_EJERCICIO`.

#### Scenario: CV presente cancela la proyección

- GIVEN `preliminary=true`, entry CV toca 3.4.x, `periodResult=Bs. 80.000`
- WHEN se construye el EquityStatement
- THEN `SALDO_FINAL[RA]` refleja el ledger crudo (sin proyectar periodResult); la identidad intra-state cierra porque el cierre manual ya quedó registrado por la CV

### REQ-6 — Render multi-fila en exporters y UI

PDF, XLSX y UI MUST iterar `statement.rows` sin asumir cardinalidad (no `idx === 2`). La detección de fila "final" para estilos bold/borde MUST usar `row.key === "SALDO_FINAL"`.

#### Scenario: XLSX con 5 filas renderiza todas

- GIVEN un EquityStatement con 5 filas
- WHEN se exporta XLSX
- THEN la hoja contiene 5 filas de datos tras el header; solo la de `SALDO_FINAL` tiene borde superior + bold

---

## Traceability

| REQ | Delivery | Notes |
|-----|----------|-------|
| REQ-1, REQ-2, REQ-4, REQ-5, REQ-6 | equity-statement-typed-movements | All behavioral requirements for typed patrimony row emission, ordering, sign handling, conditional projection, and multi-row rendering |
| REQ-3 (modified) | apertura-patrimony-baseline | Invariant now absorbs aperturaBaseline before check |
| REQ-APERTURA-MERGE | apertura-patrimony-baseline | New: CA delta aggregation and merge into SALDO_INICIAL |

---

## Related specs

- `voucher-type-seed` — provides the `CP`, `CL`, `CV` codes that drive row emission and classification

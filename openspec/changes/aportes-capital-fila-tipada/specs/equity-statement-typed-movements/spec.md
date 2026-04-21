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

### REQ-3 — Invariante intra-statement con filas tipadas

El builder MUST recalcular `imbalanced` usando: `SALDO_FINAL[col] == SALDO_INICIAL[col] + Σ(filas tipadas)[col] + RESULTADO_EJERCICIO[col]`. La banda `imbalanced` solo aparece si la identidad falla tras incluir todas las filas tipadas.

#### Scenario: Aporte clasificado no dispara imbalance

- GIVEN aporte CP de Bs. 200k a 3.1.x, sin otros movimientos patrimoniales, `preliminary=true`
- WHEN se construye el EquityStatement
- THEN `imbalanced === false` y `imbalanceDelta === 0`

#### Scenario: Aporte sin voucher tipado dispara imbalance (legacy)

- GIVEN entry POSTED con voucherType genérico (ej. `CD`) que mueve Bs. 200k directo a 3.1.x
- WHEN se construye el EquityStatement
- THEN `imbalanced === true`, `imbalanceDelta === 200000`, banner muestra el texto v1 ("Diferencia patrimonial sin clasificar…")

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

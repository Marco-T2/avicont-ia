# Documentación Contable — Avicont IA

## Diagrama de Entidades

```
Dispatch (ND/BC)
    │
    ├──► JournalEntry (CD)
    │       ├── Line: DEBE CxC (1.1.4.1)
    │       └── Line: HABER Ingreso (4.1.1 ó 4.1.2)
    │
    └──► AccountsReceivable (CxC)
              │  amount, paid, balance, status
              │
              └──► PaymentAllocation ◄── Payment (Cobro)
                       amount                 │
                                              ├──► JournalEntry (CI)
                                              │       ├── Line: DEBE Caja/Banco
                                              │       └── Line: HABER CxC
                                              │
                                              └──► CreditConsumption
                                                      consumerPaymentId
                                                      sourcePaymentId
                                                      amount
```

**No hay FK directa entre Dispatch y Payment.** El puente siempre es la CxC (AccountsReceivable).

---

## Tablas y su Función

### Documentos Operativos (lo que el usuario crea)

| Tabla | Qué es | Rol |
|-------|--------|-----|
| **Dispatch** | Nota de Despacho (ND) o Boleta Cerrada (BC) | Documento comercial — registra la entrega de mercadería al cliente |
| **DispatchDetail** | Líneas de detalle del despacho | Cada caja/lote: peso bruto, tare, peso neto, precio unitario, monto línea |
| **Payment** | Cobro (CI) o Pago (CE) | Registra el dinero que entra o sale — cuánto, cómo (efectivo/banco), de quién |
| **PaymentAllocation** | Tabla puente: Payment ↔ CxC/CxP | Dice "de este cobro, Bs X se aplican a esta factura". Un pago puede cubrir varias facturas |
| **CreditConsumption** | Tabla puente: Payment ↔ Payment | Rastrea crédito FIFO: "este pago consumió Bs X del excedente de aquel otro pago" |

### Cuentas por Cobrar / Pagar (generadas automáticamente)

| Tabla | Qué es | Rol |
|-------|--------|-----|
| **AccountsReceivable** | Cuenta por Cobrar (CxC) | Se crea al contabilizar un despacho. Dice "el cliente debe Bs X". Tiene `amount` (original), `paid` (acumulado), `balance` (pendiente) |
| **AccountsPayable** | Cuenta por Pagar (CxP) | Igual pero del lado proveedor — "le debemos Bs X al proveedor" |

### Contabilidad (generada automáticamente por el sistema)

| Tabla | Qué es | Rol |
|-------|--------|-----|
| **JournalEntry** | Cabecera del comprobante contable | Datos generales: tipo de comprobante (CD/CI/CE), número correlativo, fecha, período fiscal, contacto, descripción. El `sourceType` dice quién lo generó ("dispatch" o "payment") |
| **JournalEntryLine** | Líneas del asiento contable | El detalle de la partida doble: qué cuenta, cuánto al DEBE, cuánto al HABER, contacto auxiliar. Siempre DEBE = HABER |
| **AccountBalance** | Saldo acumulado por cuenta y período | Totaliza débitos y créditos por cuenta+período. Se actualiza con cada POST/VOID. Es lo que alimenta el Balance General |

### Catálogo y Configuración

| Tabla | Qué es | Rol |
|-------|--------|-----|
| **Account** | Plan de cuentas | Cada cuenta contable: código (1.1.4.1), nombre, tipo (ACTIVO/PASIVO/INGRESO/GASTO), naturaleza (DEUDORA/ACREEDORA), si es detalle (`isDetail`) |
| **VoucherTypeCfg** | Tipos de comprobante | CD (Diario), CI (Ingreso), CE (Egreso), CT (Traspaso), CA (Ajuste). Define el prefijo de numeración |
| **FiscalPeriod** | Período fiscal | Mes contable: fecha inicio, fecha fin, status (OPEN/CLOSED). El cierre mensual lo pone en CLOSED |
| **OrgSettings** | Configuración de la organización | Códigos de cuenta por defecto (caja, banco, CxC, CxP), umbral de redondeo |
| **Contact** | Clientes, proveedores, socios | Tipo (CLIENTE/PROVEEDOR/SOCIO/TRANSPORTISTA), plazo de pago, límite de crédito |

### Auditoría

| Tabla | Qué es | Rol |
|-------|--------|-----|
| **AuditLog** | Registro de cambios | Trigger de PostgreSQL que captura INSERT/UPDATE/DELETE en dispatches, payments, journal_entries. Guarda: quién, cuándo, valores antes/después |

---

## Cómo se Conectan (flujo visual)

```
Contact (cliente)
    │
    ├── Dispatch ──────────── DispatchDetail[] (líneas)
    │     │
    │     ├── JournalEntry (CD) ── JournalEntryLine[] (DEBE CxC / HABER Ingreso)
    │     │                              │
    │     │                        AccountBalance (se actualiza por línea)
    │     │
    │     └── AccountsReceivable (CxC: amount, paid, balance)
    │               │
    │               └── PaymentAllocation (monto aplicado)
    │                         │
    │                    Payment (cobro)
    │                         │
    │                         ├── JournalEntry (CI) ── JournalEntryLine[] (DEBE Caja / HABER CxC)
    │                         │                              │
    │                         │                        AccountBalance (se actualiza)
    │                         │
    │                         └── CreditConsumption (si usó crédito de otro pago)
    │
    └── OrgSettings (códigos de cuenta por defecto)
```

### En resumen simple

- **Dispatch + DispatchDetail** = "qué se entregó"
- **AccountsReceivable** = "cuánto debe el cliente"
- **Payment + PaymentAllocation** = "cuánto pagó y a qué facturas"
- **CreditConsumption** = "de dónde salió el crédito"
- **JournalEntry + JournalEntryLine** = "el registro contable formal"
- **AccountBalance** = "el resumen de saldos para reportes"
- **Account + VoucherTypeCfg** = "el catálogo contable"
- **FiscalPeriod** = "el período que controla cuándo se puede editar"

---

## Flujos Operativos

### Despacho POST (transacción atómica)

```
1. Asignar sequenceNumber (MAX+1 por tipo)
2. Dispatch.status → POSTED, calcular totalAmount
3. AutoEntryGenerator → JournalEntry (CD) status=POSTED
     DEBE  CxC (1.1.4.1)      totalAmount  [contactId]
     HABER Ingreso (4.1.x)     totalAmount
4. AccountBalances.applyPost() → incrementa saldos por línea
5. INSERT AccountsReceivable (amount=total, paid=0, balance=total, PENDING)
6. Vincular: dispatch.journalEntryId + dispatch.receivableId
```

### Cobro POST (transacción atómica)

```
1. Resolver dirección: COBRO (CI) ó PAGO (CE)
2. Validar cada allocation contra balance fresco de CxC
3. Payment.status → POSTED
4. AutoEntryGenerator → JournalEntry (CI) status=POSTED
     Efectivo:       DEBE Caja (1.1.1.1)    amount  /  HABER CxC (1.1.4.1)  amount
     Transferencia:  DEBE Banco (1.1.2.1)   amount  /  HABER CxC (1.1.4.1)  amount
                     (4 líneas con caja de tránsito, efecto neto: Banco↑ CxC↓)
5. AccountBalances.applyPost() → incrementa saldos
6. Vincular payment.journalEntryId
7. Por cada allocation: CxC.paid += amount, balance -= amount, status → PARTIAL o PAID
8. Si creditApplied > 0: allocateCredit() distribución FIFO
```

### Anular Despacho (transacción atómica)

```
0. GUARD: Si CxC tiene allocations activas → BLOQUEA (pendiente: cambiar a desvinculación)
1. Dispatch.status → VOIDED
2. JournalEntry.status → VOIDED
3. AccountBalances.applyVoid() → revierte saldos (deltas negados)
4. CxC.status → VOIDED, balance = 0
```

### Anular Cobro (transacción atómica)

```
0. GUARD: Si crédito fue consumido por otros pagos activos → BLOQUEA
1. Payment.status → VOIDED
2. JournalEntry.status → VOIDED + applyVoid()
3. Por cada allocation: CxC.paid -= amount, recalcula balance/status
4. DELETE CreditConsumption WHERE consumerPaymentId = id
```

### Reasignar Allocations (pago POSTED, sin tocar asiento)

```
1. Revertir allocations viejas (CxC.paid -= amount por cada una)
2. DELETE PaymentAllocation WHERE paymentId = id
3. Validar nuevas allocations contra balances frescos
4. INSERT nuevas PaymentAllocation
5. Aplicar nuevas allocations (CxC.paid += amount)
6. JournalEntry (CI) → NO SE TOCA
```

---

## Asientos Contables por Operación

| Operación | DEBE | HABER |
|-----------|------|-------|
| Despacho POST | CxC (1.1.4.1) +N | Ingreso (4.1.1 ó 4.1.2) +N |
| Despacho VOID | CxC -N | Ingreso -N |
| Cobro POST (efectivo) | Caja (1.1.1.1) +N | CxC (1.1.4.1) +N |
| Cobro POST (banco) | Banco (1.1.2.1) +N | CxC (1.1.4.1) +N |
| Pago POST (efectivo) | CxP (2.1.1.1) +N | Caja (1.1.1.1) +N |
| Pago POST (banco) | CxP (2.1.1.1) +N | Banco (1.1.2.1) +N |
| Cobro/Pago VOID | Revierte todas las líneas anteriores | |
| Crédito puro (amount=0) | Sin asiento contable | Solo mueve CxC |
| Reasignar allocations | Sin cambio en asiento | Solo mueve CxC |

---

## Cuentas Configurables (OrgSettings)

| Cuenta | Código default | Uso |
|--------|---------------|-----|
| Caja General | 1.1.1.1 | Efectivo/cheque |
| Banco | 1.1.2.1 | Transferencias/depósitos |
| CxC | 1.1.4.1 | Despachos → Cobros |
| CxP | 2.1.1.1 | Compras → Pagos |
| Ingreso ND | 4.1.2 | Ventas por Nota de Despacho |
| Ingreso BC | 4.1.1 | Ventas por Boleta Cerrada |

---

## Lifecycle de Documentos

```
DRAFT ──► POSTED ──► LOCKED ──► VOIDED
                └──────────────► VOIDED

DRAFT:   Editable libremente, eliminable
POSTED:  Actualmente solo void/recreate (pendiente: editable directamente)
LOCKED:  Período cerrado. Solo admin + justificación puede modificar
VOIDED:  Estado terminal — no se puede revertir
```

### Transiciones válidas

| Desde | Hacia | Condición |
|-------|-------|-----------|
| DRAFT | POSTED | Período fiscal OPEN |
| POSTED | LOCKED | Cierre mensual automático |
| POSTED | VOIDED | Guard de pagos activos |
| LOCKED | VOIDED | Admin + justificación |

---

## Cálculo de Saldos

### AccountBalance (por cuenta + período)

```
UPSERT account_balances WHERE (accountId, periodId):
  debitTotal  += delta_debit
  creditTotal += delta_credit

Luego recalcular:
  Si cuenta DEUDORA:   balance = debitTotal - creditTotal
  Si cuenta ACREEDORA: balance = creditTotal - debitTotal
```

### Crédito del Cliente (saldo a favor)

```
Por cada pago no anulado del contacto:
  disponible = payment.amount
             - SUM(allocations.amount)
             - SUM(creditSources.amount)

  Si disponible > 0 → es crédito sin aplicar
```

### Balance Neto del Cliente

```
totalFacturado  = SUM(CxC.amount) WHERE status ≠ VOIDED
totalCobrado    = SUM(payment.amount) WHERE status ≠ VOIDED
saldoNeto       = totalFacturado - totalCobrado
créditoDisponible = MAX(0, totalCobrado - totalAsignado - totalConsumido)
```

---

## Cálculo de Montos en Despacho

### Nota de Despacho (ND)

```
Por cada línea:
  tare = cajas × 2 kg
  pesoNeto = pesoBruto - tare
  montoLínea = ROUND(pesoNeto × precioUnitario, 2)

totalExacto = SUM(montoLínea)
totalAmount = redondear(totalExacto, umbralRedondeo)
  Si fracción < umbral → piso
  Si fracción >= umbral → techo
```

### Boleta Cerrada (BC)

```
Por cada línea:
  tare = cajas × 2 kg
  pesoNeto = pesoBruto - tare
  merma = pesoNeto × (porcentajeMerma / 100)
  faltante = input manual por línea
  pesoNetoReal = pesoNeto - merma - faltante
  montoLínea = ROUND(pesoNetoReal × precioUnitario, 2)

totalExacto = SUM(montoLínea)
totalAmount = redondear(totalExacto, umbralRedondeo)
```

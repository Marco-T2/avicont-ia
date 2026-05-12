# Prueba de Caja Blanca — Sistema avicont-ia

**Técnica:** Camino básico (McCabe, 1976)
**Fórmula:** $V(G) = A - N + 2P$

---

## 1. Definición de nodos del grafo de control

### Nodos iniciales

```
(1):  Inicio del Sistema
(2):  Ventana de Login (Ingreso de credenciales)
(3):  Validación de credenciales (Clerk, 2FA opcional)
(4):  Selección de Organización (multi-tenant)
(5):  Menú Principal / Dashboard
```

### Módulos principales

```
(6):  Módulo de Usuarios y Organización
(7):  Módulo de Plan de Cuentas
(8):  Módulo de Contactos
(9):  Módulo de Libro Diario (Asientos contables)
(10): Módulo de Operaciones Comerciales (Compras, Ventas, Despachos)
(11): Módulo de Cartera (CxC, CxP, Pagos y Cobros)
(12): Módulo de Períodos Fiscales y Cierres
(13): Módulo de Libros Tributarios (IVA)
(14): Módulo de Reportes Financieros
(15): Módulo de Operativo Avícola (Granjas, Lotes, Mortandad)
(16): Módulo de Documentos y Asistente IA
(17): Módulo de Auditoría y Configuración
```

### Sub-funcionalidades por módulo

```
(18): Registro o Actualización de usuarios
(19): Cambio de roles o estado de usuarios
(20): Información sobre los miembros de la organización

(21): Registro o Actualización de cuentas contables
(22): Cambio de jerarquía o estado de cuentas
(23): Información sobre el plan de cuentas

(24): Registro o Actualización de contactos (clientes/proveedores)
(25): Cambio de estado de contactos
(26): Información sobre contactos y saldos

(27): Registro de asiento contable
(28): Confirmación o anulación de asiento
(29): Consulta e información de asientos

(30): Registro de compra, venta o despacho
(31): Confirmación o anulación de operación comercial
(32): Información sobre operaciones comerciales

(33): Registro de pago o cobro
(34): Aplicación de pagos a documentos pendientes
(35): Información sobre saldos, créditos y movimientos

(36): Configuración o apertura de períodos
(37): Cierre de período fiscal
(38): Información sobre períodos fiscales

(39): Generación o regeneración de libros IVA
(40): Anulación o reactivación de libros IVA
(41): Exportación e información de libros tributarios

(42): Generación de reportes financieros
(43): Exportación en PDF / XLSX

(44): Registro de granjas y lotes
(45): Registro de mortandad y gastos operativos
(46): Información sobre lotes y operaciones avícolas

(47): Carga y procesamiento de documentos
(48): Consulta al asistente con Inteligencia Artificial

(49): Consulta de registros de auditoría
(50): Configuración del sistema (tipos de comprobante, productos, firmas)
```

### Fines de módulos y del sistema

```
(51): Fin del Módulo de Usuarios y Organización
(52): Fin del Módulo de Plan de Cuentas
(53): Fin del Módulo de Contactos
(54): Fin del Módulo de Libro Diario
(55): Fin del Módulo de Operaciones Comerciales
(56): Fin del Módulo de Cartera
(57): Fin del Módulo de Períodos Fiscales y Cierres
(58): Fin del Módulo de Libros Tributarios
(59): Fin del Módulo de Reportes Financieros
(60): Fin del Módulo de Operativo Avícola
(61): Fin del Módulo de Documentos y Asistente IA
(62): Fin del Módulo de Auditoría y Configuración

(63): Fin del Ciclo del Sistema
(64): Fin del Sistema
```

---

## 2. Tabla de aristas del grafo

| # | Tipo de transición | Origen | Destino | Cantidad |
|---:|---|:---:|:---:|---:|
| 1 | Inicio del Sistema | (1) | (2) | 1 |
| 2 | Login → Validación de credenciales | (2) | (3) | 1 |
| 3 | Validación fallida → retorno a Login | (3) | (2) | 1 |
| 4 | Validación correcta → Selección de Organización | (3) | (4) | 1 |
| 5 | Selección de Organización → Menú Principal | (4) | (5) | 1 |
| 6 | Menú Principal → Módulos del sistema | (5) | (6)–(17) | 12 |
| 7 | Módulo de Usuarios y Organización → sub-funcionalidades | (6) | (18)–(20) | 3 |
| 8 | Módulo de Plan de Cuentas → sub-funcionalidades | (7) | (21)–(23) | 3 |
| 9 | Módulo de Contactos → sub-funcionalidades | (8) | (24)–(26) | 3 |
| 10 | Módulo de Libro Diario → sub-funcionalidades | (9) | (27)–(29) | 3 |
| 11 | Módulo de Operaciones Comerciales → sub-funcionalidades | (10) | (30)–(32) | 3 |
| 12 | Módulo de Cartera → sub-funcionalidades | (11) | (33)–(35) | 3 |
| 13 | Módulo de Períodos Fiscales → sub-funcionalidades | (12) | (36)–(38) | 3 |
| 14 | Módulo de Libros Tributarios → sub-funcionalidades | (13) | (39)–(41) | 3 |
| 15 | Módulo de Reportes → sub-funcionalidades | (14) | (42)–(43) | 2 |
| 16 | Módulo de Operativo Avícola → sub-funcionalidades | (15) | (44)–(46) | 3 |
| 17 | Módulo de Documentos y Asistente IA → sub-funcionalidades | (16) | (47)–(48) | 2 |
| 18 | Módulo de Auditoría y Configuración → sub-funcionalidades | (17) | (49)–(50) | 2 |
| 19 | Sub-funcionalidades → Fin del Módulo correspondiente | (18)–(50) | (51)–(62) | 33 |
| 20 | Fines de módulo → Fin del Ciclo del Sistema | (51)–(62) | (63) | 12 |
| 21 | Fin del Ciclo del Sistema → Fin del Sistema | (63) | (64) | 1 |
| | **TOTAL DE ARISTAS (A)** | | | **96** |

---

## 3. Cálculo de la complejidad ciclomática

$$V(G) = A - N + 2P$$

| Símbolo | Descripción | Valor |
|---|---|---:|
| $A$ | Número de aristas | 96 |
| $N$ | Número de nodos | 64 |
| $P$ | Componentes conexos | 1 |

Reemplazando:

$$V(G) = 96 - 64 + 2(1)$$

$$V(G) = 32 + 2$$

$$V(G) = 34$$

### Verificación cruzada por las tres formas equivalentes

| Método | Cálculo | Resultado |
|---|---|---:|
| **Aristas / Nodos** | $V(G) = A - N + 2P = 96 - 64 + 2$ | **34** |
| **Nodos predicado + 1** | 1 (validación) + 11 (menú) + 18 (módulos con 3 subs) + 3 (módulos con 2 subs) + 1 | **34** |
| **Regiones del grafo** | Conteo de regiones cerradas + región exterior | **34** |

Las tres fórmulas coinciden, confirmando que el grafo de control del sistema avicont-ia presenta una **complejidad ciclomática de 34**, lo que implica la existencia de **34 caminos básicos linealmente independientes** que deben ser cubiertos para garantizar una prueba estructural completa del sistema.

---

## 4. Tabla de caminos básicos

| Camino | Secuencia de nodos | Descripción funcional |
|:-:|---|---|
| 1 | 1 → 2 → 3 → 2 → 3 → 4 → 5 → 6 → 18 → 51 → 63 → 64 | Validación fallida + reintento exitoso (Usuarios – Registro) |
| 2 | 1 → 2 → 3 → 4 → 5 → 6 → 18 → 51 → 63 → 64 | Usuarios – Registro o Actualización |
| 3 | 1 → 2 → 3 → 4 → 5 → 6 → 19 → 51 → 63 → 64 | Usuarios – Cambio de roles o estado |
| 4 | 1 → 2 → 3 → 4 → 5 → 6 → 20 → 51 → 63 → 64 | Usuarios – Consulta de información |
| 5 | 1 → 2 → 3 → 4 → 5 → 7 → 21 → 52 → 63 → 64 | Plan de Cuentas – Registro o Actualización |
| 6 | 1 → 2 → 3 → 4 → 5 → 7 → 22 → 52 → 63 → 64 | Plan de Cuentas – Cambio de jerarquía/estado |
| 7 | 1 → 2 → 3 → 4 → 5 → 7 → 23 → 52 → 63 → 64 | Plan de Cuentas – Consulta |
| 8 | 1 → 2 → 3 → 4 → 5 → 8 → 24 → 53 → 63 → 64 | Contactos – Registro o Actualización |
| 9 | 1 → 2 → 3 → 4 → 5 → 8 → 25 → 53 → 63 → 64 | Contactos – Cambio de estado |
| 10 | 1 → 2 → 3 → 4 → 5 → 8 → 26 → 53 → 63 → 64 | Contactos – Consulta de saldos |
| 11 | 1 → 2 → 3 → 4 → 5 → 9 → 27 → 54 → 63 → 64 | Libro Diario – Registro de asiento |
| 12 | 1 → 2 → 3 → 4 → 5 → 9 → 28 → 54 → 63 → 64 | Libro Diario – Confirmación o anulación |
| 13 | 1 → 2 → 3 → 4 → 5 → 9 → 29 → 54 → 63 → 64 | Libro Diario – Consulta de asientos |
| 14 | 1 → 2 → 3 → 4 → 5 → 10 → 30 → 55 → 63 → 64 | Operaciones Comerciales – Registro |
| 15 | 1 → 2 → 3 → 4 → 5 → 10 → 31 → 55 → 63 → 64 | Operaciones Comerciales – Confirmación o anulación |
| 16 | 1 → 2 → 3 → 4 → 5 → 10 → 32 → 55 → 63 → 64 | Operaciones Comerciales – Consulta |
| 17 | 1 → 2 → 3 → 4 → 5 → 11 → 33 → 56 → 63 → 64 | Cartera – Registro de pago o cobro |
| 18 | 1 → 2 → 3 → 4 → 5 → 11 → 34 → 56 → 63 → 64 | Cartera – Aplicación de pagos |
| 19 | 1 → 2 → 3 → 4 → 5 → 11 → 35 → 56 → 63 → 64 | Cartera – Consulta de saldos |
| 20 | 1 → 2 → 3 → 4 → 5 → 12 → 36 → 57 → 63 → 64 | Períodos Fiscales – Configuración |
| 21 | 1 → 2 → 3 → 4 → 5 → 12 → 37 → 57 → 63 → 64 | Períodos Fiscales – Cierre |
| 22 | 1 → 2 → 3 → 4 → 5 → 12 → 38 → 57 → 63 → 64 | Períodos Fiscales – Consulta |
| 23 | 1 → 2 → 3 → 4 → 5 → 13 → 39 → 58 → 63 → 64 | Libros IVA – Generación |
| 24 | 1 → 2 → 3 → 4 → 5 → 13 → 40 → 58 → 63 → 64 | Libros IVA – Anulación o reactivación |
| 25 | 1 → 2 → 3 → 4 → 5 → 13 → 41 → 58 → 63 → 64 | Libros IVA – Exportación |
| 26 | 1 → 2 → 3 → 4 → 5 → 14 → 42 → 59 → 63 → 64 | Reportes – Generación |
| 27 | 1 → 2 → 3 → 4 → 5 → 14 → 43 → 59 → 63 → 64 | Reportes – Exportación PDF/XLSX |
| 28 | 1 → 2 → 3 → 4 → 5 → 15 → 44 → 60 → 63 → 64 | Operativo Avícola – Registro de granjas/lotes |
| 29 | 1 → 2 → 3 → 4 → 5 → 15 → 45 → 60 → 63 → 64 | Operativo Avícola – Mortandad y gastos |
| 30 | 1 → 2 → 3 → 4 → 5 → 15 → 46 → 60 → 63 → 64 | Operativo Avícola – Consulta |
| 31 | 1 → 2 → 3 → 4 → 5 → 16 → 47 → 61 → 63 → 64 | Documentos – Carga y procesamiento |
| 32 | 1 → 2 → 3 → 4 → 5 → 16 → 48 → 61 → 63 → 64 | Asistente IA – Consulta en lenguaje natural |
| 33 | 1 → 2 → 3 → 4 → 5 → 17 → 49 → 62 → 63 → 64 | Auditoría – Consulta de registros |
| 34 | 1 → 2 → 3 → 4 → 5 → 17 → 50 → 62 → 63 → 64 | Configuración del sistema |

---

## 5. Tabla resumen de casos de prueba

A partir de los 34 caminos básicos identificados, se diseñaron **34 casos de prueba** que cubren todas las rutas estructurales del sistema:

| Caso | Camino asociado | Resultado esperado |
|:-:|:-:|---|
| CP-01 | 1 | Reintento de credenciales tras error y acceso correcto al sistema |
| CP-02 | 2 | Alta o actualización exitosa de un usuario |
| CP-03 | 3 | Activación o desactivación correcta de un usuario |
| CP-04 | 4 | Visualización de la lista de miembros de la organización |
| CP-05 | 5 | Alta o modificación de una cuenta contable |
| CP-06 | 6 | Cambio de jerarquía o estado de una cuenta |
| CP-07 | 7 | Consulta del plan de cuentas |
| CP-08 | 8 | Alta de un cliente o proveedor |
| CP-09 | 9 | Cambio de estado de un contacto |
| CP-10 | 10 | Consulta del saldo de un contacto |
| CP-11 | 11 | Registro de un asiento contable balanceado |
| CP-12 | 12 | Confirmación o anulación de un asiento |
| CP-13 | 13 | Consulta de asientos del libro diario |
| CP-14 | 14 | Registro de una compra, venta o despacho |
| CP-15 | 15 | Confirmación o anulación de una operación comercial |
| CP-16 | 16 | Consulta de operaciones comerciales |
| CP-17 | 17 | Registro de un pago o cobro |
| CP-18 | 18 | Aplicación de un pago a documentos pendientes |
| CP-19 | 19 | Consulta de saldos y créditos |
| CP-20 | 20 | Configuración o apertura de un período fiscal |
| CP-21 | 21 | Cierre correcto de un período fiscal |
| CP-22 | 22 | Consulta de períodos fiscales |
| CP-23 | 23 | Generación de un libro IVA |
| CP-24 | 24 | Anulación o reactivación de un libro IVA |
| CP-25 | 25 | Exportación del libro IVA en formato XLSX |
| CP-26 | 26 | Generación de un reporte financiero |
| CP-27 | 27 | Exportación del reporte en PDF o XLSX |
| CP-28 | 28 | Registro de una granja o lote |
| CP-29 | 29 | Registro de mortandad o gastos operativos |
| CP-30 | 30 | Consulta del estado de un lote |
| CP-31 | 31 | Carga y procesamiento de un documento |
| CP-32 | 32 | Consulta al asistente con IA en lenguaje natural |
| CP-33 | 33 | Consulta de los registros de auditoría |
| CP-34 | 34 | Modificación de la configuración del sistema |

---

## 6. Conclusión de la prueba de caja blanca

El análisis estructural del sistema avicont-ia, desarrollado mediante la técnica del **camino básico** propuesta por **McCabe (1976)**, arrojó una **complejidad ciclomática de 34**, valor coherente con un sistema empresarial de gestión contable de alcance amplio. Los **34 caminos básicos** identificados fueron cubiertos mediante un conjunto equivalente de **34 casos de prueba**, lo que garantiza que cada ruta lógica del sistema haya sido ejecutada al menos una vez. La arquitectura hexagonal adoptada favorece esta cobertura, ya que cada módulo opera de forma independiente y su lógica puede verificarse sin generar interferencias en el resto del sistema.

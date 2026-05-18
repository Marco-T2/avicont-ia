---
title: "Manual de Usuario"
subtitle: "Sistema de Información Contable — Asociación Mixta de Productores Agro-Avícola Conda Arriba"
author: "Equipo de desarrollo"
date: "2026"
lang: es
toc: true
toc-depth: 3
numbersections: true
geometry: margin=2.5cm
fontsize: 11pt
documentclass: report
---

\newpage

# Prólogo

## Sobre este manual

Este documento describe el uso operativo del **Sistema de Información Contable** desarrollado para la **Asociación Mixta de Productores Agro-Avícola Conda Arriba**. El sistema es una plataforma contable que integra la operación contable estándar (libro diario, mayor, balance, libros IVA, cuentas por cobrar y por pagar, cierres) con un módulo específico para producción avícola (lotes, mortalidad, despachos de aves).

El manual está pensado para tres perfiles de lector:

- **Usuario operativo** (ej. encargado administrativo): registra ventas, compras, cobros y pagos en el día a día.
- **Contador o responsable contable**: crea asientos manuales, revisa el libro mayor, genera estados financieros, cierra períodos.
- **Administrador de la organización**: configura plan de cuentas, períodos fiscales, tipos de comprobante, usuarios y roles.

No es necesario tener todos los perfiles para usar el sistema; cada sección del manual indica qué rol la necesita.

## Cómo está organizado

El manual sigue el orden natural de uso del sistema:

1. **Capítulos 1 a 2** — qué es el sistema y vocabulario contable mínimo.
2. **Capítulo 3** — primer ingreso y reconocimiento de la interfaz.
3. **Capítulo 4** — configuración inicial (hacer una sola vez al implementar).
4. **Capítulos 5 a 11** — operación cotidiana y especializada.
5. **Capítulo 12** — cierres mensuales.
6. **Capítulos 13 a 14** — reportes y auditoría.
7. **Anexos** — glosario, errores comunes, soporte.

Cada sección operativa sigue la misma estructura: **propósito**, **cómo llegar**, **pasos**, **validaciones**, **errores comunes**.

## Convenciones del manual

| Notación | Significa |
|---|---|
| `Menú → Submenú` | Ruta de navegación en el sistema. |
| **Negrita** | Nombre de botón, campo o sección en pantalla. |
| `Código` | Texto que se escribe textualmente (códigos de cuenta, identificadores). |
| ⚠️ | Advertencia: acción irreversible o con impacto contable. |
| 💡 | Consejo o buena práctica. |
| `[CAPTURA X.Y — descripción]` | Espacio reservado para una imagen del sistema. |

## Antes de empezar

El sistema asume que usted tiene:

- Una **cuenta de usuario** creada por el administrador de su organización.
- Una **invitación aceptada** a al menos una organización.
- Un **navegador web actualizado** (Chrome, Firefox, Edge o Safari en versión vigente).
- Conexión a internet estable.

Si alguno de estos requisitos no se cumple, consulte con el administrador de su organización o con el equipo de soporte (Anexo E).

\newpage

# Introducción

## ¿Qué es el Sistema de Información Contable?

El Sistema de Información Contable es una plataforma web desarrollada a medida para la **Asociación Mixta de Productores Agro-Avícola Conda Arriba**, orientada a cubrir tanto la operación contable estándar como las necesidades específicas del giro avícola. Centraliza en una única plataforma:

- **Contabilidad de partida doble** completa (plan de cuentas, libro diario, mayor, estados financieros).
- **Documentos operativos**: ventas, compras, despachos, cobros y pagos.
- **Cuentas por cobrar (CxC) y por pagar (CxP)** con seguimiento por contacto.
- **Cierres mensuales** con bloqueo de períodos.
- **Módulo avícola**: lotes de producción, mortalidad, márgenes por lote.
- **Auditoría** completa de cambios sobre cada documento.
- **Asistencia con inteligencia artificial** para la creación de asientos manuales.

Arquitectónicamente el sistema es **multi-organización**, lo que permite a un mismo usuario alternar entre distintas entidades sin cerrar sesión. Esto facilita, por ejemplo, que un mismo contador atienda en paralelo cuentas separadas de la asociación y de unidades productivas asociadas.

## Acerca de la Asociación

### Naturaleza jurídica y legal

La **Asociación Mixta de Productores Agro-Avícola Conda Arriba** es una entidad privada de carácter asociativo, reconocida legalmente como persona jurídica y orientada a la organización de productores vinculados al sector agro-avícola.

| Dato | Valor |
|---|---|
| Razón social | Asociación Mixta de Productores Agro-Avícola Conda Arriba |
| Tipo de entidad | Organización sin fines de lucro |
| NIT | 317370026 |
| Acta de constitución | 23 de abril de 2015 |
| Reconocimiento jurídico | Testimonio N.° 111/2016 — 17 de junio de 2016 |
| Autoridad otorgante | Gobierno Autónomo Departamental de Cochabamba |
| Domicilio | Comunidad de Conda Arriba, municipio de Pocona, departamento de Cochabamba |
| Duración | Indefinida |

### Marco institucional

Como entidad sin fines de lucro, la asociación orienta su funcionamiento al **beneficio colectivo de sus asociados**. Su estatuto, aprobado en la sesión de constitución del 23 de abril de 2015, establece la posibilidad de abrir sucursales o filiales dentro del departamento, así como la continuidad indefinida de la institución mientras no concurra causal de disolución prevista en el estatuto, el reglamento o la normativa aplicable.

El reconocimiento formal como persona jurídica (Testimonio N.° 111/2016) y la inscripción tributaria (NIT 317370026) facultan a la asociación para ejecutar operaciones administrativas, tributarias y contables dentro del marco normativo vigente — es precisamente este conjunto de operaciones el que el presente sistema busca instrumentar.

## Módulos del sistema

Los módulos visibles dependen de los **permisos asignados** al rol del usuario. La siguiente tabla resume los módulos disponibles:

| Módulo | Para qué sirve | Rol típico |
|---|---|---|
| **Configuración** | Datos de la empresa, períodos, catálogos, usuarios. | Administrador |
| **Contactos** | Clientes, proveedores, socios. | Administrativo |
| **Ventas / Despachos** | Registro de ventas y notas de despacho. | Administrativo |
| **Compras** | Registro de compras a proveedores. | Administrativo |
| **Cobros / Pagos** | Cobranzas y pagos con asignación a CxC/CxP. | Administrativo |
| **Contabilidad** | Libro diario, mayor, asientos manuales. | Contador |
| **Estados financieros** | Balance general, estado de resultados, patrimonio. | Contador |
| **CxC / CxP** | Saldos por cliente y proveedor, antigüedad de deuda. | Administrativo / Contador |
| **Granjas** | Lotes, mortalidad, márgenes por lote. | Operador de producción |
| **Cierres** | Cierre mensual de períodos. | Contador |
| **Reportes** | Informes financieros y operativos. | Administrativo / Contador |
| **Auditoría** | Historial de cambios sobre cualquier documento. | Administrador / Contador |

## Requisitos técnicos

| Componente | Requisito mínimo | Recomendado |
|---|---|---|
| Navegador | Chrome 110+, Firefox 110+, Edge 110+, Safari 16+ | Chrome o Edge última versión |
| Conexión | 5 Mbps | 20 Mbps |
| Resolución de pantalla | 1280×720 | 1920×1080 |
| JavaScript | Habilitado | Habilitado |
| Cookies | Habilitadas para el dominio del sistema | Habilitadas |

> 💡 No es necesario instalar nada en su computadora. El sistema funciona íntegramente desde el navegador.

## Soporte

Ante cualquier duda, problema o solicitud de cambio, contacte al equipo de soporte (datos en Anexo E).

\newpage

# Glosario contable básico

Esta sección define los términos contables y operativos que aparecen a lo largo del manual y del sistema. Un usuario con formación contable puede saltarla; un usuario administrativo sin formación contable debería leerla antes del Capítulo 5.

## Conceptos fundamentales

**Asiento contable** (o asiento de diario)
: Registro contable que documenta una operación económica. Todo asiento tiene al menos dos líneas: una al DEBE y una al HABER, por el mismo monto total.

**Partida doble**
: Principio contable que exige que en cada asiento la suma de los importes al DEBE sea igual a la suma de los importes al HABER. El sistema rechaza cualquier asiento que no cumpla esta regla.

**DEBE** y **HABER**
: Las dos columnas de un asiento. Su significado depende del tipo de cuenta (ver Tipos de cuentas, abajo). Como regla mnemotécnica: el DEBE es el lado izquierdo, el HABER el derecho.

**Saldo**
: Diferencia acumulada entre el DEBE y el HABER de una cuenta. Puede ser deudor (mayor el DEBE) o acreedor (mayor el HABER).

**Comprobante contable**
: Documento que respalda un asiento. Cada comprobante tiene un tipo (CD, CI, CE, CT, CA — ver Anexo B) y un número correlativo.

## Tipos de cuentas

El plan de cuentas se organiza en cinco tipos. La **naturaleza** de cada tipo define qué lado (DEBE o HABER) representa un aumento:

| Tipo | Naturaleza | DEBE = | HABER = | Ejemplo |
|---|---|---|---|---|
| **Activo** | Deudora | Aumento | Disminución | Caja, Banco, CxC, Inventario |
| **Pasivo** | Acreedora | Disminución | Aumento | CxP, Préstamos, Impuestos por pagar |
| **Patrimonio** | Acreedora | Disminución | Aumento | Capital, Resultados acumulados |
| **Ingreso** | Acreedora | Disminución | Aumento | Ventas, Otros ingresos |
| **Gasto** | Deudora | Aumento | Disminución | Sueldos, Alquiler, Servicios |

## Documentos operativos

**Venta**
: Operación comercial en la que la empresa entrega bienes o servicios a un cliente. Genera una factura y, al postear, un asiento de venta y una cuenta por cobrar.

**Despacho** (Nota de Despacho o Boleta Cerrada)
: Documento que respalda la entrega física de mercadería al cliente, característico del giro avícola. Hay dos variantes:
- **Nota de Despacho (ND)**: documento abierto, valorización pendiente.
- **Boleta Cerrada (BC)**: documento cerrado, valorización definitiva.

**Compra**
: Operación en la que la empresa adquiere bienes o servicios de un proveedor. El sistema reconoce cuatro tipos: `FLETE`, `POLLO_FAENADO`, `COMPRA_GENERAL`, `SERVICIO`.

**Cobro**
: Ingreso de dinero proveniente de un cliente, normalmente para cancelar una CxC. Se aplica a una o varias facturas mediante **asignaciones** (allocations).

**Pago**
: Egreso de dinero hacia un proveedor, normalmente para cancelar una CxP.

## Cuentas por cobrar (CxC) y por pagar (CxP)

**CxC (Accounts Receivable)**
: Importe que un cliente adeuda a la empresa por una venta o despacho posteado. Tiene tres campos clave: monto original, monto pagado acumulado, saldo pendiente.

**CxP (Accounts Payable)**
: Importe que la empresa adeuda a un proveedor por una compra posteada. Mismos campos que CxC.

**Asignación (PaymentAllocation)**
: Vínculo entre un cobro/pago y una CxC/CxP específica. Indica qué porción del cobro cancela qué factura. Un cobro puede asignarse a varias facturas.

**Consumo de crédito (CreditConsumption)**
: Cuando un cobro excede el monto de las facturas asignadas, el excedente queda como crédito a favor del cliente. Ese crédito se puede consumir en cobros futuros, siguiendo orden FIFO.

## IVA

**Base imponible**
: Monto sobre el cual se calcula el impuesto. En una venta de Bs 113 con IVA 13%, la base imponible es Bs 100.

**Débito fiscal**
: IVA cobrado al cliente en una venta. Se registra como pasivo (impuesto por pagar al fisco).

**Crédito fiscal**
: IVA pagado al proveedor en una compra. Se registra como activo (descontable del débito fiscal).

## Estados de documento

Cada documento (venta, compra, despacho, cobro, pago, asiento) pasa por estados que controlan qué se puede hacer con él:

| Estado | Significado | Acciones permitidas |
|---|---|---|
| **DRAFT** (borrador) | Documento creado pero no contabilizado. | Editar, postear, eliminar. |
| **POSTED** (posteado) | Documento contabilizado, impacta en la contabilidad. | Anular (con asiento inverso). NO se puede editar. |
| **VOIDED** (anulado) | Documento anulado. Se genera un asiento inverso. | Solo consulta. |
| **LOCKED** (bloqueado) | Pertenece a un período cerrado. | Solo consulta. |

> ⚠️ **Importante**: una vez posteado, un documento NO se edita. Si tiene un error, se anula y se crea uno nuevo. Esto preserva la integridad de la auditoría contable.

\newpage

# Primer ingreso al sistema

## Acceso al sistema

1. Abra su navegador y diríjase a la dirección web proporcionada por la asociación.
2. Será redirigido a la pantalla de inicio de sesión.

> 📷 **[CAPTURA 3.1 — Pantalla de login]**: pantalla de inicio de sesión con los campos de correo y contraseña.

3. Ingrese su **correo electrónico** y **contraseña** (proporcionados al ser invitado a la organización).
4. Pulse el botón para iniciar sesión.

El sistema utiliza la plataforma de autenticación **Clerk**, lo que significa que la pantalla de login es estándar y reconocible: además del acceso por correo y contraseña, según la configuración de la organización pueden estar habilitados otros métodos (enlace mágico al correo, autenticación de dos factores). Si su organización habilitó alguno de estos métodos adicionales, la pantalla le ofrecerá las opciones correspondientes.

### Recuperación de contraseña

Si olvidó su contraseña:

1. En la pantalla de login, pulse la opción para recuperar la contraseña.
2. Ingrese su correo electrónico.
3. Revise su bandeja de entrada — recibirá un correo de Clerk con un enlace para crear una contraseña nueva.
4. Siga el enlace y defina una contraseña nueva.

### Primera vez que ingresa

Si es la primera vez que ingresa, complete el proceso de bienvenida que ofrece Clerk: confirmación del correo, definición de contraseña personal y, opcionalmente, activación de autenticación de dos factores.

## Selección de organización

Una vez autenticado, será dirigido a la pantalla de selección de organización.

> 📷 **[CAPTURA 3.2 — Selección de organización]**: pantalla de bienvenida con el saludo "¡Bienvenido, [nombre]!" y la lista de organizaciones a las que pertenece el usuario.

La pantalla muestra:

- Un saludo personalizado: **"¡Bienvenido, [su nombre]!"**.
- La **lista de organizaciones** a las que pertenece, cada una con su nombre y su rol en esa organización (Administrador, Propietario o Miembro).
- Si su rol lo permite, un botón para **crear una nueva organización**.

### Pasos

1. Pulse sobre la organización con la que desea trabajar.
2. El sistema lo lleva al área de trabajo de esa organización.

### Si no pertenece a ninguna organización

Si no figura ninguna organización, la pantalla muestra el mensaje **"Aún no pertenecés a ninguna organización"** junto con un botón **"Verificar si ya fui asignado"**.

- Pulse el botón si su administrador ya envió la invitación; el sistema reconsulta el estado.
- Si el problema persiste, contacte al administrador de la organización para confirmar la invitación.

## Pantalla principal

Al ingresar a una organización, ve la pantalla principal del módulo activo (por defecto, el módulo de Contabilidad).

> 📷 **[CAPTURA 3.3 — Pantalla principal]**: vista general con el menú lateral izquierdo (sidebar), el selector de módulo activo en la parte superior del sidebar, y el área de trabajo a la derecha.

## Estructura del menú lateral

El menú lateral (sidebar) tiene una organización en tres zonas:

### Zona 1 — Selector de módulo

En la parte superior del sidebar hay un **selector** que alterna entre dos módulos principales:

| Módulo | Para qué |
|---|---|
| **Contabilidad** | Operación contable y comercial (ventas, compras, cobros, libros, informes). |
| **Granjas** | Operación productiva avícola (lotes). |

Al seleccionar un módulo, los ítems debajo cambian para mostrar las opciones de ese módulo.

### Zona 2 — Ítems del módulo activo

Las opciones disponibles dependen del módulo seleccionado.

**Módulo Contabilidad** (lista plana, sin agrupación):

| Ítem | Para qué |
|---|---|
| **Inicio** | Página de bienvenida del módulo. |
| **Ventas** | Listado y registro de ventas (incluye notas de despacho y boletas cerradas). |
| **Compras** | Listado y registro de compras a proveedores. |
| **Cobros y Pagos** | Registro y seguimiento de cobros y pagos. |
| **Libro Diario** | Asientos contables del período. |
| **Libro Mayor** | Movimientos detallados por cuenta. |
| **Contactos** | Clientes, proveedores y otros contactos comerciales. |
| **Informes** | Catálogo de reportes (estados financieros, libros IVA, CxC/CxP, etc.). |

**Módulo Granjas** (lista plana):

| Ítem | Para qué |
|---|---|
| **Mis Lotes** | Seguimiento de lotes productivos avícolas. |

### Zona 3 — Accesos transversales (cross-module)

Estos ítems son visibles desde cualquier módulo:

| Ítem | Para qué |
|---|---|
| **Agente IA** | Asistente conversacional para consultas operativas. Abre un panel lateral. |
| **Documentos** | Repositorio de documentos cargados (políticas, manuales, contratos). |

### Zona 4 — Pie del sidebar

| Ítem | Para qué |
|---|---|
| **Configuración** | Hub central de configuración de la organización (ver Capítulo 4). |

### Colapsar y expandir el sidebar

El sidebar puede colapsarse para liberar espacio en pantalla:

- Pulse el botón **colapsar** (ícono de panel) en la cabecera del sidebar.
- En modo colapsado, solo se ven los íconos. Al pasar el cursor sobre cualquiera, aparece un tooltip con el nombre.
- Pulse nuevamente para expandirlo.

> 💡 Los módulos e ítems que no aparezcan en su menú son los que su rol no tiene habilitados. Si un módulo entero no figura, es porque ninguno de sus ítems está permitido para su rol. Consulte con el administrador si necesita acceso adicional.

> ⚠️ **Importante**: varias pantallas que un usuario contable necesita habitualmente — Balance de Comprobación, Hoja de Trabajo, Balance Inicial, Estados Financieros, Cierre Mensual, Dashboards de CxC y CxP — **no aparecen como ítems directos del menú lateral**. Se acceden desde **Informes** (catálogo de reportes).

\newpage

# Configuración inicial

> ⚠️ Este capítulo describe pasos que se realizan **una sola vez**, al momento de implementar el sistema en su organización. Si su organización ya está operando, puede saltar al Capítulo 5.

## Cómo se accede a la configuración

A diferencia de los módulos operativos, **Configuración no aparece como un menú con submenús** en el sidebar. Se accede pulsando el ítem **Configuración** ubicado en el pie del sidebar. Al hacerlo, se abre un **hub** con tarjetas agrupadas en cuatro secciones:

> 📷 **[CAPTURA 4.0 — Hub de Configuración]**: pantalla de configuración con tarjetas agrupadas en cuatro secciones.

| Sección del hub | Tarjetas |
|---|---|
| **Empresa y equipo** | Perfil de Empresa, Miembros, Roles y Permisos |
| **Contabilidad** | Plan de Cuentas, Períodos Fiscales, Configuración General |
| **Catálogos** | Tipos de Comprobante, Tipos de Producto, Tipos de Documento |
| **Sistema** | Auditoría |

Para llegar a cualquier opción de configuración, primero ingrese al hub y luego pulse la tarjeta correspondiente.

## Orden recomendado de configuración

1. Perfil de la empresa.
2. Configuración general.
3. Períodos fiscales.
4. Catálogos (tipos de comprobante, documentos operativos, productos).
5. Plan de cuentas.
6. Balance inicial (Capítulo 7).
7. Roles y permisos.
8. Miembros (invitar usuarios).

## Perfil de la empresa

**Cómo llegar**: `Configuración` (pie del sidebar) → tarjeta **Perfil de Empresa** (sección Empresa y equipo).

**Quién**: Administrador.

**Propósito**: registrar los datos fiscales y de contacto de la organización. Estos datos aparecen en todos los documentos impresos (facturas, comprobantes, reportes).

> 📷 **[CAPTURA 4.1 — Perfil de la empresa]**: formulario con campos de razón social, NIT, dirección, ciudad, teléfono, email, logo.

### Campos

| Campo | Descripción | Obligatorio |
|---|---|---|
| Razón social | Nombre legal de la empresa. | Sí |
| NIT | Número de Identificación Tributaria. | Sí |
| Dirección | Domicilio fiscal. | Sí |
| Ciudad | Ciudad sede. | Sí |
| Teléfono | Teléfono de contacto. | No |
| Email | Correo de contacto institucional. | No |
| Logo | Imagen que aparecerá en reportes (PNG o JPG, máx. 1 MB). | No |

### Pasos

1. Complete los campos obligatorios.
2. Pulse **Guardar**.
3. Verifique que el mensaje "Cambios guardados" aparezca en la parte superior.

### Validaciones

- El **NIT** debe tener formato numérico válido.
- El **email**, si se completa, debe ser una dirección válida.
- El **logo**, si se sube, no debe superar 1 MB.

## Configuración general

**Cómo llegar**: `Configuración` → tarjeta **Configuración General** (sección Contabilidad).

**Quién**: Administrador.

**Propósito**: definir parámetros operativos transversales como códigos de cuenta por defecto (caja, banco, CxC, CxP) y umbrales de redondeo.

> 📷 **[CAPTURA 4.2 — Configuración general]**: formulario con sección de cuentas por defecto y sección de parámetros numéricos.

### Campos clave

| Campo | Descripción |
|---|---|
| Cuenta Caja por defecto | Código de cuenta para movimientos de efectivo. |
| Cuenta Banco por defecto | Código de cuenta para movimientos bancarios. |
| Cuenta CxC por defecto | Código de cuenta para clientes. |
| Cuenta CxP por defecto | Código de cuenta para proveedores. |
| Umbral de redondeo | Diferencia máxima tolerada en centavos al cuadrar asientos. |

> ⚠️ Estas cuentas deben existir previamente en el plan de cuentas. Configure primero el plan de cuentas (sección 4.7), luego vuelva aquí.

## Períodos fiscales

**Cómo llegar**: `Configuración` → tarjeta **Períodos Fiscales** (sección Contabilidad).

**Quién**: Administrador o Contador.

**Propósito**: definir los meses contables. Toda operación se registra en un período y solo se puede modificar mientras el período esté abierto.

> 📷 **[CAPTURA 4.3.1 — Lista de períodos fiscales]**: tabla con columnas Año, Período (mes), Fecha inicio, Fecha fin, Estado (OPEN/CLOSED), botones de acción.

### Crear un período

1. Pulse **Nuevo período**.
2. Seleccione el **año** y el **mes**.
3. El sistema completa automáticamente las fechas de inicio y fin.
4. Pulse **Guardar**.

> 📷 **[CAPTURA 4.3.2 — Formulario nuevo período]**: diálogo emergente con selectores de año y mes.

### Abrir o cerrar un período

- **Abrir un período cerrado**: pulse el botón **Abrir** en la fila correspondiente. ⚠️ Requiere confirmación: abrir un período cerrado deshabilita los asientos de cierre y permite modificaciones.
- **Cerrar un período**: se hace desde el módulo de Cierre Mensual (ver Capítulo 12), no desde acá.

### Validaciones

- No se permite tener dos períodos del mismo año y mes.
- No se permite cerrar un período con asientos en estado DRAFT.
- No se permite abrir un período si hay un período posterior ya cerrado (debería abrir primero el posterior).

## Tipos de comprobante

**Cómo llegar**: `Configuración` → tarjeta **Tipos de Comprobante** (sección Catálogos).

**Quién**: Administrador.

**Propósito**: definir los tipos de comprobante contable que su organización utiliza. Cada tipo tiene una secuencia numérica independiente.

> 📷 **[CAPTURA 4.4 — Lista de tipos de comprobante]**: tabla con código, nombre, secuencia actual, tipo (operacional/contable).

### Tipos estándar

El sistema viene precargado con los tipos estándar:

| Código | Nombre | Uso |
|---|---|---|
| `CD` | Comprobante de Diario | Asientos manuales generales. |
| `CI` | Comprobante de Ingreso | Cobros. |
| `CE` | Comprobante de Egreso | Pagos. |
| `CT` | Comprobante de Traspaso | Movimientos entre cuentas internas. |
| `CA` | Comprobante de Ajuste | Ajustes contables y reclasificaciones. |

### Crear o editar

1. Pulse **Nuevo tipo** (o el ícono de edición en una fila existente).
2. Complete **código** (2-3 letras), **nombre** y **tipo** (operacional o contable).
3. Pulse **Guardar**.

> ⚠️ NO se recomienda eliminar tipos de comprobante que ya tengan asientos asociados. Si un tipo deja de usarse, marcar como inactivo.

## Tipos de documento operacional

**Cómo llegar**: `Configuración` → tarjeta **Tipos de Documento** (sección Catálogos).

**Quién**: Administrador.

**Propósito**: catalogar los documentos operativos (facturas, notas de despacho, recibos) con sus prefijos de numeración.

> 📷 **[CAPTURA 4.5 — Tipos de documento operacional]**: tabla con código, nombre, descripción.

Los pasos de creación y edición son análogos a los de tipos de comprobante.

## Tipos de productos

**Cómo llegar**: `Configuración` → tarjeta **Tipos de Producto** (sección Catálogos).

**Quién**: Administrador.

**Propósito**: catalogar los productos o servicios que la empresa vende o compra, con su categoría y precio base de referencia.

> 📷 **[CAPTURA 4.6 — Tipos de productos]**: tabla con categoría, nombre del producto, precio base.

### Crear un producto

1. Pulse **Nuevo producto**.
2. Seleccione **categoría** (ej. POLLO_PARRILLERO, FLETE, SERVICIO).
3. Ingrese **nombre** y **precio base** (opcional, sirve como sugerencia al crear ventas).
4. Pulse **Guardar**.

## Plan de cuentas

**Cómo llegar**: `Configuración` → tarjeta **Plan de Cuentas** (sección Contabilidad).

**Quién**: Administrador o Contador.

**Propósito**: definir la estructura de cuentas contables de la organización. Es el catálogo más importante; sin él, no se pueden registrar operaciones.

> 📷 **[CAPTURA 4.7.1 — Plan de cuentas]**: vista en árbol o tabla con columnas Código, Nombre, Tipo, Naturaleza, Es detalle (sí/no), Activa.

### Estructura de códigos

El sistema sigue la convención jerárquica boliviana:

- `1` — Activo
- `1.1` — Activo Corriente
- `1.1.1` — Caja
- `1.1.1.01` — Caja en moneda nacional (cuenta detalle)

Solo las **cuentas detalle** (`isDetail = true`) pueden recibir movimientos. Las cuentas resumen agrupan saldos.

### Crear una cuenta

1. Pulse **Nueva cuenta**.
2. Complete:
   - **Código**: respetando la jerarquía (ej. `1.1.1.02`).
   - **Nombre**: descriptivo (ej. "Caja en moneda extranjera").
   - **Tipo**: Activo / Pasivo / Patrimonio / Ingreso / Gasto.
   - **Naturaleza**: el sistema la sugiere según el tipo (puede modificarla solo en casos especiales — cuentas de regularización).
   - **Es detalle**: marque si recibirá movimientos directos.
3. Pulse **Guardar**.

> 📷 **[CAPTURA 4.7.2 — Formulario nueva cuenta]**: formulario con todos los campos descritos.

### Editar o desactivar

- **Editar**: cambie el nombre o la naturaleza (con precaución). No se permite cambiar el código si la cuenta tiene movimientos.
- **Desactivar**: marca la cuenta como inactiva; deja de aparecer en los selectores pero conserva su histórico.

### Validaciones

- El código debe ser único.
- La naturaleza debe ser coherente con el tipo (Activo y Gasto = deudora; Pasivo, Patrimonio e Ingreso = acreedora). Cambios contrarios requieren confirmación explícita.
- Una cuenta resumen (con hijos) no puede convertirse en detalle si tiene cuentas hijas detalle.

## Balance inicial

**Cómo llegar**: módulo **Contabilidad** del sidebar → ítem **Informes** → buscar **Balance Inicial** en el catálogo.

> ⚠️ La carga del balance inicial es una operación contable única que se realiza al inicio del primer ejercicio. No es accesible desde el menú lateral de Contabilidad como ítem propio.

**Quién**: Contador.

**Propósito**: cargar los saldos iniciales del plan de cuentas al momento de empezar a usar el sistema. Es el punto de partida desde el cual se acumularán los movimientos.

> 📷 **[CAPTURA 4.8 — Balance inicial]**: formulario con lista de cuentas detalle y columna de saldo inicial editable.

### Pasos

1. Asegúrese de tener el plan de cuentas completo y el período fiscal inicial creado.
2. Pulse **Cargar balance inicial**.
3. Para cada cuenta detalle, ingrese el saldo al inicio del primer período.
4. El sistema valida que la suma de saldos deudores sea igual a la suma de saldos acreedores.
5. Pulse **Guardar**.
6. El sistema genera un asiento de apertura por usted.

> ⚠️ El balance inicial se carga UNA sola vez. Si necesita ajustarlo después, hágalo mediante asientos de ajuste, no editando esta pantalla.

## Roles y permisos

**Cómo llegar**: `Configuración` → tarjeta **Roles y Permisos** (sección Empresa y equipo).

**Quién**: Administrador.

**Propósito**: definir qué pueden hacer los distintos perfiles de usuario en el sistema.

> 📷 **[CAPTURA 4.9.1 — Lista de roles]**: tabla con nombre del rol, cantidad de usuarios asignados, botón de edición.

### Roles preconfigurados

| Rol | Descripción |
|---|---|
| **Administrador** | Acceso completo a todo el sistema. |
| **Contador** | Acceso a contabilidad, libros, estados financieros, cierres. |
| **Administrativo** | Acceso a operaciones diarias (ventas, compras, cobros, pagos). |
| **Auditor** | Acceso de solo lectura a todos los módulos. |

### Crear un rol personalizado

1. Pulse **Nuevo rol**.
2. Ingrese el **nombre** del rol.
3. Marque para cada recurso (Ventas, Compras, Asientos, etc.) los permisos: **Lectura** y/o **Escritura**.
4. Pulse **Guardar**.

> 📷 **[CAPTURA 4.9.2 — Edición de permisos por rol]**: matriz con filas = recursos, columnas = acciones (lectura/escritura), checkboxes.

### Editar un rol existente

1. Pulse el ícono de edición en la fila del rol.
2. Modifique los permisos.
3. Pulse **Guardar**. Los cambios afectan inmediatamente a todos los usuarios con ese rol.

> ⚠️ NO elimine un rol asignado a usuarios. Primero reasigne esos usuarios a otro rol.

## Miembros (invitar usuarios)

**Cómo llegar**: `Configuración` → tarjeta **Miembros** (sección Empresa y equipo).

**Quién**: Administrador.

**Propósito**: dar acceso al sistema a nuevas personas dentro de la organización.

> 📷 **[CAPTURA 4.10.1 — Lista de miembros]**: tabla con email, nombre, rol, estado (activo/inactivo), última conexión.

### Invitar un nuevo miembro

1. Pulse **Invitar miembro**.
2. Ingrese el **email** de la persona.
3. Seleccione el **rol** que tendrá en la organización.
4. Pulse **Enviar invitación**.
5. La persona recibirá un correo con un enlace para crear su cuenta.

> 📷 **[CAPTURA 4.10.2 — Diálogo invitar miembro]**: formulario con email y selector de rol.

### Cambiar el rol de un miembro

1. Pulse el ícono de edición en la fila del miembro.
2. Seleccione el nuevo rol.
3. Pulse **Guardar**.

### Desactivar un miembro

- Pulse **Desactivar** en la fila del miembro. Pierde acceso inmediatamente, pero su histórico de operaciones se conserva.

> 💡 Para un usuario que se va de la empresa, prefiera **desactivar** antes que **eliminar** — preserva la trazabilidad en la auditoría.

\newpage

# Contactos

**Cómo llegar**: módulo **Contabilidad** → ítem **Contactos** del sidebar.

**Quién**: Administrativo.

**Propósito**: registrar y mantener actualizada la información de clientes, proveedores, socios y transportistas.

## Lista de contactos

> 📷 **[CAPTURA 5.1 — Lista de contactos]**: tabla con columnas Tipo, NIT, Nombre, Plazo de pago, Estado, acciones (ver, editar).

### Filtros disponibles

- **Tipo**: CLIENTE, PROVEEDOR, SOCIO, TRANSPORTISTA.
- **Estado**: Activo / Inactivo.
- **Búsqueda libre**: por nombre, NIT o email.

## Alta de un contacto

1. Pulse **Nuevo contacto**.
2. Complete:

| Campo | Descripción | Obligatorio |
|---|---|---|
| Tipo | CLIENTE, PROVEEDOR, SOCIO o TRANSPORTISTA. | Sí |
| Razón social / Nombre | Nombre legal o comercial. | Sí |
| NIT | Identificación tributaria. | Sí para clientes y proveedores |
| Email | Correo de contacto. | No |
| Teléfono | Contacto telefónico. | No |
| Dirección | Domicilio. | No |
| Plazo de pago | Días de crédito (0 = contado). | Solo para clientes y proveedores |
| Límite de crédito | Monto máximo de deuda admitido. | No |

> 📷 **[CAPTURA 5.2 — Formulario nuevo contacto]**: formulario con todos los campos.

3. Pulse **Guardar**.

### Validaciones

- NIT único por tipo de contacto.
- Email con formato válido si se completa.
- Plazo de pago no negativo.

## Edición y desactivación

- **Editar**: pulse el ícono de edición. Puede modificar todos los campos excepto el tipo (si tiene movimientos asociados).
- **Desactivar**: el contacto deja de aparecer en los selectores de ventas, compras y pagos, pero su histórico se conserva.

## Saldos por contacto

Para ver el saldo CxC o CxP de un contacto, vea el Capítulo 9 (CxC / CxP).

\newpage

# Operaciones comerciales

## Ventas

**Cómo llegar**: módulo **Contabilidad** → ítem **Ventas** del sidebar.

**Quién**: Administrativo.

**Propósito**: registrar las ventas de bienes o servicios a clientes. Esta misma pantalla unifica tres variantes de venta, que se diferencian por el tipo de documento de respaldo:

| Variante | Para qué |
|---|---|
| **Venta general** | Operación contable estándar (factura). |
| **Nota de Despacho (ND)** | Documento abierto con valorización pendiente, típico del giro avícola. |
| **Boleta Cerrada (BC)** | Documento con valorización definitiva. |

> 💡 Antes existía un módulo "Despachos" separado para ND y BC. En la versión actual los despachos están **unificados dentro de Ventas** — se distinguen por el tipo seleccionado al crear el documento.

### Lista de ventas

> 📷 **[CAPTURA 6.1.1 — Lista de ventas]**: tabla con columnas Tipo (Venta / Nota Despacho / Boleta Cerrada), Secuencia, Referencia, Fecha, Cliente, Monto, Estado.

#### Filtros disponibles

- **Estado**: DRAFT, POSTED, VOIDED.
- **Tipo**: Venta General, Nota de Despacho, Boleta Cerrada.
- **Período fiscal**: mes específico.
- **Cliente**: filtro por contacto.

### Crear una venta

1. Pulse **Nueva venta**.
2. Complete:

| Campo | Descripción |
|---|---|
| Cliente | Seleccione de la lista de contactos tipo CLIENTE. |
| Período | Período fiscal al que pertenece la venta (debe estar OPEN). |
| Fecha | Fecha de la venta. Debe pertenecer al período seleccionado. |
| Descripción | Descripción libre. |
| Líneas | Una o más líneas con cuenta de ingreso, cantidad, precio unitario. |

3. Para cada línea:
   - Seleccione la **cuenta de ingreso** (ej. 4.1.1 Ventas de mercadería).
   - Ingrese **cantidad** y **precio unitario**. El sistema calcula el monto de línea.
4. Verifique el **monto total** en la parte inferior.

> 📷 **[CAPTURA 6.1.2 — Formulario nueva venta]**: formulario con cabecera (cliente, período, fecha, descripción) y tabla de líneas editable.

5. Pulse **Guardar** (queda en DRAFT) o **Guardar y postear** (queda POSTED).

### Crear una Nota de Despacho o Boleta Cerrada

El flujo es prácticamente idéntico al de una venta general, con dos diferencias:

1. Al pulsar **Nueva venta**, **seleccione el tipo** Nota de Despacho o Boleta Cerrada.
2. En las **líneas de detalle**, además de cuenta, cantidad y precio, ingrese los datos físicos del despacho (por ejemplo peso bruto, tare y peso neto) cuando el sistema los solicite.

> 📷 **[CAPTURA 6.1.3 — Formulario despacho]**: variante del formulario de venta con tipo Nota de Despacho o Boleta Cerrada seleccionado.

El resto del flujo (postear, anular) es el mismo que para una venta general.

### Postear (contabilizar) una venta

Una venta en estado DRAFT se postea para que impacte en la contabilidad:

1. Abra el detalle de la venta.
2. Pulse **Postear**.
3. Confirme la operación.

Al postear, el sistema:

- Genera un **asiento de venta** (DEBE: CxC del cliente; HABER: cuentas de ingreso y, si aplica, débito fiscal IVA).
- Genera una **cuenta por cobrar (CxC)** por el monto total.
- Marca la venta como POSTED. Ya no puede editarse.

> ⚠️ Posteado un comprobante, NO se edita. Si encuentra un error, **anule** y cree uno nuevo.

### Anular una venta

1. Abra el detalle de la venta en estado POSTED.
2. Pulse **Anular**.
3. Indique el **motivo** de la anulación.
4. Confirme.

El sistema:

- Genera un **asiento inverso** (HABER: CxC; DEBE: ingresos e IVA).
- Cancela la CxC asociada.
- Marca la venta como VOIDED.

> ⚠️ Si la venta tiene cobros aplicados, el sistema le pedirá desvincular o reversar esos cobros primero.

### Validaciones

- Cliente activo y tipo CLIENTE.
- Período en estado OPEN.
- Fecha dentro del rango del período.
- Cada línea con cuenta de ingreso válida y monto > 0.
- Monto total > 0.

### Errores comunes

| Mensaje | Causa | Solución |
|---|---|---|
| "Período cerrado" | El período seleccionado está CLOSED. | Seleccione un período abierto o abra el período. |
| "Cuenta no es de detalle" | Eligió una cuenta resumen. | Seleccione una cuenta detalle (hoja del árbol). |
| "Cliente inactivo" | El contacto fue desactivado. | Active el contacto o use otro. |

## Compras

**Cómo llegar**: módulo **Contabilidad** → ítem **Compras** del sidebar.

**Quién**: Administrativo.

**Propósito**: registrar las compras a proveedores.

### Lista de compras

> 📷 **[CAPTURA 6.3.1 — Lista de compras]**: tabla con Tipo (FLETE, POLLO_FAENADO, COMPRA_GENERAL, SERVICIO), Secuencia, Referencia, Fecha, Proveedor, Monto, Estado.

### Tipos de compra

| Tipo | Cuándo usarlo |
|---|---|
| `FLETE` | Servicios de transporte. |
| `POLLO_FAENADO` | Compra de pollo procesado. |
| `COMPRA_GENERAL` | Cualquier otro bien (insumos, materiales). |
| `SERVICIO` | Servicios profesionales y otros. |

### Crear una compra

1. Pulse **Nueva compra**.
2. Seleccione el **tipo de compra**.
3. Complete:

| Campo | Descripción |
|---|---|
| Proveedor | Contacto tipo PROVEEDOR. |
| Período | Período fiscal OPEN. |
| Fecha | Fecha de la factura del proveedor. |
| Número de factura | Número del documento del proveedor. |
| Descripción | Descripción libre. |
| Líneas | Cuenta de gasto, cantidad, precio unitario. |

> 📷 **[CAPTURA 6.3.2 — Formulario nueva compra]**: formulario con cabecera y tabla de líneas.

4. Pulse **Guardar** o **Guardar y postear**.

### Postear una compra

Al postear:

- Genera asiento de compra (DEBE: gastos y crédito fiscal IVA; HABER: CxP del proveedor).
- Genera la CxP por el monto total.
- Marca la compra como POSTED.

### Validaciones

Análogas a las de venta, sustituyendo cliente por proveedor y cuentas de ingreso por cuentas de gasto.

## Cobros y pagos

**Cómo llegar**: módulo **Contabilidad** → ítem **Cobros y Pagos** del sidebar.

**Quién**: Administrativo.

**Propósito**: registrar el flujo de efectivo entrante (cobros) y saliente (pagos), aplicándolo a las cuentas por cobrar y por pagar correspondientes.

### Lista de cobros y pagos

> 📷 **[CAPTURA 6.4.1 — Lista de pagos]**: tabla con Tipo (COBRO / PAGO), Contacto, Fecha, Método de pago, Monto, Estado.

#### Filtros disponibles

- **Tipo**: COBRO / PAGO.
- **Estado**: DRAFT, POSTED, VOIDED.
- **Contacto**.
- **Método de pago**.

### Crear un cobro

1. Pulse **Nuevo cobro**.
2. Complete:

| Campo | Descripción |
|---|---|
| Tipo | COBRO. |
| Cliente | Cliente que paga. |
| Fecha | Fecha del cobro. |
| Método de pago | EFECTIVO, TRANSFERENCIA, CHEQUE. |
| Cuenta de caja/banco | Cuenta donde ingresa el dinero. |
| Monto | Monto recibido. |
| Descripción | Texto libre. |

> 📷 **[CAPTURA 6.4.2 — Formulario nuevo cobro]**: formulario con cabecera y, debajo, sección de asignación a facturas pendientes.

3. **Asignar a facturas**: el sistema muestra las CxC pendientes del cliente. Para cada CxC, ingrese cuánto del cobro le aplica. La suma de asignaciones debe ser ≤ monto del cobro.

> 💡 Si el monto cobrado excede las CxC pendientes, el excedente queda como **crédito a favor** del cliente y se aplica automáticamente en cobros futuros (FIFO).

4. Pulse **Guardar** o **Guardar y postear**.

### Postear un cobro

Al postear:

- Genera asiento de ingreso (DEBE: Caja/Banco; HABER: CxC).
- Actualiza el saldo de cada CxC asignada.
- Marca el cobro como POSTED.

### Crear un pago

El procedimiento es simétrico al cobro:

1. Pulse **Nuevo pago**.
2. Tipo = PAGO, seleccione **proveedor**.
3. Complete método, cuenta y monto.
4. Asigne el pago a las CxP pendientes del proveedor.
5. **Guardar y postear**.

Al postear:

- Genera asiento de egreso (DEBE: CxP; HABER: Caja/Banco).
- Actualiza el saldo de cada CxP asignada.

### Anular un cobro o pago

1. Abra el detalle.
2. Pulse **Anular**.
3. Confirme.

El sistema genera el asiento inverso y revierte las asignaciones.

### Errores comunes

| Mensaje | Causa | Solución |
|---|---|---|
| "Suma de asignaciones excede el monto" | Asignó más que el monto del cobro. | Revise las asignaciones; ajuste hasta cuadrar. |
| "Factura ya está pagada" | La CxC seleccionada tiene saldo 0. | Quite esa asignación. |
| "Cuenta de caja no es detalle" | Eligió una cuenta resumen. | Seleccione una cuenta caja/banco detalle. |

\newpage

# Contabilidad

> 💡 **Cómo se accede a este módulo**: en el sidebar, asegúrese de tener seleccionado el módulo **Contabilidad** (selector superior). Las opciones de este capítulo se acceden desde los ítems del sidebar, o desde el catálogo de **Informes** cuando se indique.

## Inicio del módulo

**Cómo llegar**: módulo **Contabilidad** → ítem **Inicio** del sidebar.

**Quién**: Contador.

**Propósito**: pantalla de entrada al módulo de Contabilidad, con accesos directos a las funciones más usadas.

> 📷 **[CAPTURA 7.1 — Dashboard contable]**: panel con tarjetas de resumen (asientos del mes, asientos pendientes de postear, último cierre) y links a módulos contables.

## Libro Diario (asientos manuales)

**Cómo llegar**: módulo **Contabilidad** → ítem **Libro Diario** del sidebar.

**Propósito**: visualizar todos los asientos contables (automáticos y manuales) y crear asientos manuales.

> 📷 **[CAPTURA 7.2.1 — Libro Diario]**: tabla con Fecha, Secuencia, Tipo, Período, Detalle (cuentas y montos), Estado, Origen (manual / automático).

### Filtros

- Período, año, tipo de comprobante, estado, búsqueda libre.

### Crear un asiento manual

1. Pulse **Nuevo asiento**.
2. Complete:

| Campo | Descripción |
|---|---|
| Período | Período OPEN. |
| Fecha | Dentro del período. |
| Tipo de comprobante | CD, CA o el que corresponda. |
| Descripción | Detalle del asiento. |

3. Agregue **líneas**. Para cada línea:
   - **Cuenta** (detalle).
   - **Tipo**: DEBE o HABER.
   - **Monto**.
   - **Contacto auxiliar** (opcional).
4. Verifique que la suma del DEBE = suma del HABER. El sistema muestra el descuadre en rojo si no cuadra.

> 📷 **[CAPTURA 7.2.2 — Formulario nuevo asiento]**: formulario con cabecera y tabla de líneas con totales al pie.

5. **Guardar** o **Guardar y postear**.

### Crear un asiento con asistencia IA

> 💡 Función experimental.

1. En el formulario de asiento, pulse **Crear con IA**.
2. Describa la operación en lenguaje natural (ej. "Pago de alquiler de oficina de 5000 bolivianos por transferencia desde banco BISA").
3. El sistema genera una propuesta de asiento.
4. Revise la propuesta cuidadosamente: cuentas, montos, sentido (DEBE/HABER).
5. Edite lo que sea necesario y pulse **Guardar**.

> ⚠️ La propuesta de IA es una **sugerencia**. La responsabilidad contable del asiento es del usuario que lo postea. Siempre revise antes de postear.

### Postear y anular un asiento

- **Postear**: cambia el estado a POSTED. El asiento impacta saldos y reportes.
- **Anular**: genera un asiento inverso. Marca el original como VOIDED.

### Validaciones

- Suma DEBE = Suma HABER.
- Al menos dos líneas.
- Todas las cuentas deben ser de detalle.
- El período debe estar OPEN.

## Plan de cuentas (gestión avanzada)

Ya cubierto en sección 4.7. Para la gestión cotidiana (alta, edición, desactivación), el flujo es idéntico.

## Libro Mayor

**Cómo llegar**: módulo **Contabilidad** → ítem **Libro Mayor** del sidebar.

**Propósito**: visualizar el detalle de movimientos de una cuenta específica en un período, con saldo inicial, movimientos y saldo final.

> 📷 **[CAPTURA 7.4 — Libro Mayor]**: vista con selector de cuenta, selector de período, tabla con Fecha, Referencia, Descripción, DEBE, HABER, Saldo acumulado.

### Pasos

1. Seleccione la **cuenta** del plan de cuentas.
2. Seleccione el **período** (o rango).
3. El sistema muestra el saldo inicial, todos los movimientos del período y el saldo final.
4. Para exportar, pulse **Exportar PDF** o **Exportar Excel**.

## Balance de Comprobación

**Cómo llegar**: módulo **Contabilidad** → ítem **Informes** → buscar **Balance de Comprobación** en el catálogo.

**Propósito**: comprobar la igualdad de débitos y créditos en todo el plan de cuentas para un período.

> 📷 **[CAPTURA 7.5 — Balance de Comprobación]**: tabla con Código, Nombre, Saldo Inicial, Débitos, Créditos, Saldo Final.

### Pasos

1. Seleccione el período.
2. El sistema lista todas las cuentas con movimiento.
3. Al pie, los totales de Débitos y Créditos deben coincidir.

> ⚠️ Si los totales NO coinciden, hay un descuadre. Revise los asientos del período con el filtro "descuadrados" en el Libro Diario.

## Hoja de Trabajo

**Cómo llegar**: módulo **Contabilidad** → ítem **Informes** → buscar **Hoja de Trabajo** en el catálogo.

**Propósito**: preparar los ajustes de cierre y proyectar el resultado del período antes del cierre formal.

> 📷 **[CAPTURA 7.6 — Hoja de Trabajo]**: tabla con columnas Cuenta, Saldo Prueba, Ajustes Débito, Ajustes Crédito, Saldo Ajustado, Estado de Resultados, Balance.

### Pasos

1. Seleccione el período.
2. Revise los saldos.
3. Ingrese ajustes en la columna correspondiente (los ajustes generan asientos de ajuste tipo CA).
4. Verifique las columnas de Estado de Resultados y Balance.
5. **Exportar** para entregar al revisor.

\newpage

# Estados financieros

**Cómo llegar**: módulo **Contabilidad** → ítem **Informes** → grupo **Financieros** del catálogo.

**Quién**: Contador.

**Propósito**: generar los tres estados contables principales con corte a un período.

> 📷 **[CAPTURA 8.0 — Catálogo de estados financieros]**: vista del catálogo de Informes con la sección de reportes financieros (Balance General, Estado de Resultados, Estado de Patrimonio).

## Balance General

**Cómo llegar**: **Informes** → reporte **Balance General**.

> 📷 **[CAPTURA 8.1 — Balance General]**: reporte con tres bloques: Activo (Corriente + No Corriente), Pasivo (Corriente + No Corriente), Patrimonio. Totales al pie.

### Pasos

1. Seleccione el **período de corte**.
2. El sistema agrupa las cuentas por tipo y subtipo y calcula los saldos al cierre del período.
3. Verifique la igualdad Activo = Pasivo + Patrimonio.
4. **Exportar PDF** o **Exportar Excel**.

## Estado de Resultados

**Cómo llegar**: **Informes** → reporte **Estado de Resultados**.

> 📷 **[CAPTURA 8.2 — Estado de Resultados]**: reporte con Ingresos, Costos, Gastos operativos, Gastos financieros, Utilidad/Pérdida del período.

### Pasos

1. Seleccione el **rango de períodos** (típicamente desde el inicio del ejercicio hasta el período de corte).
2. El sistema calcula el resultado neto.
3. **Exportar**.

## Estado de Patrimonio

**Cómo llegar**: **Informes** → reporte **Estado de Patrimonio**.

> 📷 **[CAPTURA 8.3 — Estado de Patrimonio]**: reporte con Capital, Reservas, Resultados acumulados, Resultado del ejercicio, Distribuciones.

### Pasos

1. Seleccione el período.
2. El sistema reconcilia las cuentas patrimoniales.
3. **Exportar**.

## Exportación

Todos los estados financieros se pueden exportar en dos formatos:

- **PDF**: para presentación e impresión, con el logo de la empresa.
- **Excel**: para manipulación adicional, copia a otros documentos.

> 💡 El PDF generado conserva el formato fiel del reporte; el Excel separa cada línea en celdas para que pueda copiar o calcular.

\newpage

# Cuentas por cobrar y por pagar

> 💡 Los dashboards de CxC y CxP **no aparecen como ítems propios del sidebar**. Se acceden desde el catálogo de **Informes** del módulo Contabilidad.

## Dashboard CxC

**Cómo llegar**: módulo **Contabilidad** → ítem **Informes** → reporte **Cuentas por Cobrar**.

**Propósito**: vista panorámica de los saldos pendientes de cobro, agrupados por cliente.

> 📷 **[CAPTURA 9.1 — Dashboard CxC]**: tabla con Cliente, Saldo total, Vencido, Vigente, % cobranza, gráfico de antigüedad.

### Indicadores clave

| Indicador | Significado |
|---|---|
| **Saldo total** | Suma de todas las CxC pendientes del cliente. |
| **Vencido** | Saldo de CxC con fecha de vencimiento pasada. |
| **Vigente** | Saldo de CxC dentro del plazo. |
| **% cobranza** | Pagado / Facturado, indicador histórico. |

### Filtros

- Por cliente, por rango de antigüedad, por monto mínimo.

## Ledger por cliente

**Cómo llegar**: pulse el nombre de un cliente en el Dashboard CxC.

**Propósito**: ver el detalle de cada movimiento (venta, despacho, cobro) que afectó la cuenta del cliente.

> 📷 **[CAPTURA 9.2 — Ledger por cliente]**: tabla con Fecha, Documento (Venta #/Cobro #), Descripción, Cargo, Abono, Saldo acumulado.

### Pasos

1. Filtre por rango de fechas (opcional).
2. Revise cada línea: ventas suman al saldo, cobros lo reducen.
3. **Exportar PDF** para imprimir el estado de cuenta del cliente.

## Dashboard CxP

**Cómo llegar**: módulo **Contabilidad** → ítem **Informes** → reporte **Cuentas por Pagar**.

**Propósito**: vista panorámica de los saldos pendientes de pago, agrupados por proveedor.

> 📷 **[CAPTURA 9.3 — Dashboard CxP]**: análogo al dashboard CxC, con Proveedor, Saldo total, Vencido, Vigente, % pago.

## Ledger por proveedor

**Cómo llegar**: pulse el nombre de un proveedor en el Dashboard CxP.

> 📷 **[CAPTURA 9.4 — Ledger por proveedor]**: análogo al ledger por cliente, con compras y pagos.

## Contactos con saldos

**Cómo llegar**: módulo **Contabilidad** → ítem **Contactos** del sidebar (esta es la lista general de contactos; los saldos se ven al abrir el detalle de cada contacto).

**Propósito**: lista combinada de todos los contactos con saldo CxC o CxP, útil para gestión integral.

> 📷 **[CAPTURA 9.5 — Contactos con saldos]**: tabla con Nombre, NIT, Tipo, Saldo CxC, Saldo CxP, Estado.

\newpage

# Granjas (módulo avícola)

**Quién**: Operador de producción y/o Administrativo.

**Propósito**: gestionar el ciclo productivo de lotes avícolas, desde la entrada de aves hasta la salida (venta o muerte), con seguimiento económico.

> 💡 Este módulo se accede cambiando el **selector de módulo** en la parte superior del sidebar de **Contabilidad** a **Granjas**. Una vez cambiado, los ítems del sidebar se reemplazan por los del módulo Granjas.

## Mis Lotes

**Cómo llegar**: módulo **Granjas** (selector del sidebar) → ítem **Mis Lotes**.

### Lista de lotes

> 📷 **[CAPTURA 11.1.1 — Lista de lotes]**: tabla con ID lote, Período de producción, Especie, Cantidad inicial, Cantidad actual, Estado.

#### Filtros

- Estado (Activo / Cerrado), período, especie.

### Crear un lote

1. Pulse **Nuevo lote**.
2. Complete:

| Campo | Descripción |
|---|---|
| Código | Identificador del lote (ej. L2026-04). |
| Especie | POLLO_PARRILLERO, PONEDORA, etc. |
| Fecha de inicio | Fecha de ingreso de las aves. |
| Cantidad inicial | Número de aves al ingreso. |
| Costo unitario inicial | Costo por ave (opcional, para márgenes). |
| Observaciones | Texto libre. |

> 📷 **[CAPTURA 11.1.2 — Formulario nuevo lote]**: formulario con todos los campos.

3. Pulse **Guardar**.

### Detalle de un lote

> 📷 **[CAPTURA 11.1.3 — Detalle lote]**: pantalla con datos del lote arriba; resumen de cantidades (inicial, vendida, muerta, balance); resumen económico (ingresos, gastos, margen); botones para registrar mortalidad, gasto, despacho.

Desde el detalle del lote puede:

- **Registrar mortalidad** (sección siguiente).
- **Crear un gasto** asociado al lote (alimento, sanidad, etc.).
- **Crear un despacho** que salga del lote (descuenta cantidad).

## Mortalidad

**Cómo llegar**: dentro del detalle del lote, pulse **Registrar mortalidad**.

**Propósito**: descontar aves muertas del balance del lote y registrar el evento para análisis.

> 📷 **[CAPTURA 11.2 — Registro de mortalidad]**: diálogo con Fecha, Cantidad de aves, Causa (opcional), Observaciones.

### Pasos

1. Ingrese **fecha** del evento.
2. Ingrese **cantidad de aves muertas**.
3. Seleccione la **causa** (lista predefinida) o deje en blanco.
4. Pulse **Guardar**.

El sistema actualiza el balance del lote inmediatamente. Si está configurado, también genera un asiento de gasto por la pérdida.

### Validaciones

- Cantidad > 0 y ≤ cantidad actual del lote.
- Fecha no posterior a hoy.

## Resumen económico por lote

El detalle del lote muestra siempre:

- **Ingresos**: suma de despachos asociados al lote.
- **Gastos**: suma de compras y gastos asociados al lote.
- **Margen**: ingresos − gastos.
- **Margen por ave inicial**: margen / cantidad inicial.

> 💡 Use el margen por ave como KPI principal para comparar lotes entre sí.

\newpage

# Cierres

## Cierre mensual

**Cómo llegar**: módulo **Contabilidad** → ítem **Informes** → reporte **Cierre Mensual**.

**Quién**: Contador.

**Propósito**: cerrar un período fiscal para impedir modificaciones posteriores y consolidar los saldos. El cierre es prerrequisito para la presentación tributaria y los estados financieros oficiales.

> 📷 **[CAPTURA 12.1.1 — Cierre Mensual]**: pantalla con lista de períodos OPEN, botón **Iniciar cierre** por período.

### Pre-requisitos

Antes de cerrar un período, verifique:

1. ✅ Todos los asientos del período están en estado POSTED (no quedan DRAFT).
2. ✅ Balance de Comprobación cuadra (Débitos = Créditos).
3. ✅ Ajustes contables hechos (en Hoja de Trabajo).

### Pasos para cerrar

1. Pulse **Iniciar cierre** en el período correspondiente.
2. El sistema lanza una **revisión automática** de los pre-requisitos.
3. Si hay incumplimientos, los muestra como lista de errores. Resuélvalos antes de continuar.
4. Si la revisión pasa, el sistema muestra un resumen del cierre con los asientos que generará.
5. Pulse **Confirmar cierre**.
6. El sistema:
   - Genera los asientos de cierre (cierre de cuentas de resultado, transferencia al patrimonio).
   - Marca el período como CLOSED.
   - Bloquea todos los documentos del período (pasan a LOCKED).

> 📷 **[CAPTURA 12.1.2 — Confirmación de cierre]**: diálogo con resumen y botón **Confirmar cierre**.

> ⚠️ El cierre es una acción **importante**. Una vez confirmado, ningún documento del período puede ser modificado.

## Revertir cierre

**Propósito**: en casos excepcionales (error detectado después del cierre), reabrir un período cerrado.

### Pasos

1. En la lista de períodos, ubique el período CLOSED.
2. Pulse **Revertir cierre**.
3. Indique el **motivo** de la reversión.
4. Confirme.

El sistema:

- Reversa los asientos de cierre.
- Marca el período como OPEN.
- Desbloquea los documentos (vuelven a POSTED).

> ⚠️ La reversión queda registrada en la auditoría. Use solo en casos justificados.

## Cierre anual

El cierre anual sigue el mismo principio del cierre mensual, pero adicionalmente:

- Cierra todas las cuentas de resultado del ejercicio.
- Transfiere el resultado al patrimonio.
- Establece el saldo de apertura del ejercicio siguiente.

El procedimiento exacto depende de la configuración de su organización. Consulte con su contador titular antes de ejecutarlo.

\newpage

# Reportes (Informes)

**Cómo llegar**: módulo **Contabilidad** → ítem **Informes** del sidebar.

**Propósito**: catálogo unificado de informes operativos y financieros. Es el **punto de acceso principal** para pantallas como Balance General, Cuentas por Cobrar y por Pagar, Cierre Mensual y otras que no aparecen como ítems directos del sidebar.

> 📷 **[CAPTURA 13.1 — Catálogo de reportes]**: pantalla con tarjetas agrupadas por categoría (Financieros, Tributarios, Operativos, Avícola, Auditoría).

## Categorías de reportes

| Categoría | Reportes |
|---|---|
| **Financieros** | Balance General, Estado de Resultados, Estado de Patrimonio, Libro Mayor, Balance de Comprobación. |
| **Operativos** | Listado de Ventas, Listado de Compras, Movimiento de Caja, Movimiento de Banco. |
| **Avícola** | Producción por Lote, Mortalidad por Lote, Márgenes por Lote. |
| **Auditoría** | Historial de cambios. |

## Generar un reporte

1. Pulse sobre la tarjeta del reporte deseado.
2. Complete los filtros (período, contacto, cuenta, según aplique).
3. Pulse **Generar**.
4. Una vez generado, pulse **Exportar PDF** o **Exportar Excel**.

## Formatos de exportación

- **PDF**: pensado para impresión y archivo. Mantiene formato fiel.
- **Excel**: pensado para análisis posterior. Cada celda es editable.

> 💡 Para reportes recurrentes (ej. cierre mensual), recomendamos guardar el PDF en una carpeta organizada por año/mes.

\newpage

# Auditoría

**Cómo llegar**: `Configuración` (pie del sidebar) → tarjeta **Auditoría** (sección Sistema).

**Quién**: Administrador, Contador, Auditor.

**Propósito**: trazar todos los cambios realizados sobre los documentos del sistema. Es el registro forense que respalda la integridad contable.

> 💡 La auditoría no aparece como un módulo del sidebar lateral — se accede desde el hub de Configuración, en la sección Sistema. Solo los roles con permiso de auditoría ven esta tarjeta.

## Historial general

> 📷 **[CAPTURA 14.1 — Historial de auditoría]**: tabla con Fecha/hora, Usuario, Acción (CREATE / UPDATE / POST / VOID), Entidad (VENTA / COMPRA / ASIENTO / etc.), ID, Detalle de cambios.

### Filtros

- **Rango de fechas**.
- **Usuario** (quién hizo el cambio).
- **Acción** (CREATE, UPDATE, POST, VOID).
- **Tipo de entidad** (VENTA, COMPRA, PAGO, ASIENTO, etc.).

### Detalle de un cambio

Pulse cualquier fila para ver el detalle "antes / después" del cambio.

> 📷 **[CAPTURA 14.1.2 — Detalle de auditoría]**: diálogo con dos columnas: valores antes del cambio (izquierda) y después (derecha), con diferencias resaltadas.

## Trazabilidad por documento

Para ver el historial de cambios de un documento específico (ej. una venta puntual):

1. Abra el detalle del documento.
2. Pulse **Ver historial** (ícono de reloj o botón en la barra superior).
3. El sistema muestra todos los cambios que sufrió ese documento desde su creación.

> 📷 **[CAPTURA 14.2 — Historial por documento]**: tabla acotada al documento, en orden cronológico.

> 💡 La auditoría es **inmutable**. Ni siquiera el administrador puede borrar entradas del historial. Esta es una garantía del sistema.

\newpage

# Anexo A — Glosario completo

| Término | Definición |
|---|---|
| **Activo** | Bienes y derechos de la empresa. |
| **Anular** | Marcar un documento posteado como sin efecto, mediante un asiento inverso. |
| **Asiento** | Registro contable de partida doble. |
| **Auditoría** | Registro inmutable de cambios sobre documentos. |
| **Base imponible** | Monto sobre el cual se calcula un impuesto. |
| **Boleta Cerrada (BC)** | Despacho con valorización definitiva. |
| **CA** | Comprobante de Ajuste. |
| **CD** | Comprobante de Diario. |
| **CE** | Comprobante de Egreso (pago). |
| **CI** | Comprobante de Ingreso (cobro). |
| **CT** | Comprobante de Traspaso. |
| **Cierre mensual** | Bloqueo de un período fiscal. |
| **Cobro** | Ingreso de dinero, normalmente cancela una CxC. |
| **Crédito fiscal** | IVA pagado en compras, descontable. |
| **CxC** | Cuentas por Cobrar. |
| **CxP** | Cuentas por Pagar. |
| **DEBE** | Lado izquierdo de un asiento contable. |
| **Débito fiscal** | IVA cobrado en ventas. |
| **Despacho** | Documento que respalda entrega de mercadería. |
| **DRAFT** | Estado borrador, editable. |
| **Estado de Resultados** | Reporte de ingresos, gastos y resultado del período. |
| **Estado de Patrimonio** | Reporte de evolución del patrimonio. |
| **Factura** | Documento comercial que respalda una venta o compra. |
| **HABER** | Lado derecho de un asiento contable. |
| **IVA** | Impuesto al Valor Agregado. |
| **JournalEntry** | Asiento contable (técnico). |
| **Ledger** | Libro auxiliar de movimientos por contacto. |
| **LOCKED** | Estado de documento perteneciente a período cerrado. |
| **Lote** | Conjunto de aves que se gestiona como unidad productiva. |
| **Mayor** | Libro auxiliar de movimientos por cuenta. |
| **Mortalidad** | Aves muertas en un lote. |
| **NIT** | Número de Identificación Tributaria. |
| **Nota de Despacho (ND)** | Despacho con valorización pendiente. |
| **Pago** | Egreso de dinero, normalmente cancela una CxP. |
| **Partida doble** | Principio: DEBE = HABER en cada asiento. |
| **Pasivo** | Obligaciones de la empresa. |
| **Patrimonio** | Aporte de los socios y resultados acumulados. |
| **Período fiscal** | Mes contable. |
| **Plan de cuentas** | Catálogo jerárquico de cuentas contables. |
| **Postear** | Contabilizar un documento. |
| **POSTED** | Estado contabilizado. |
| **Saldo deudor** | Saldo con DEBE > HABER. |
| **Saldo acreedor** | Saldo con HABER > DEBE. |
| **SIN** | Servicio de Impuestos Nacionales. |
| **VOIDED** | Estado anulado. |

\newpage

# Anexo B — Estados de documento (tabla de transiciones)

| Desde | A | Acción que dispara | Reversible | Permisos requeridos |
|---|---|---|---|---|
| (nuevo) | DRAFT | Crear documento | Sí (eliminar) | Escritura del módulo |
| DRAFT | DRAFT | Editar | — | Escritura del módulo |
| DRAFT | POSTED | Postear | Sí (anular) | Escritura del módulo |
| DRAFT | (eliminado) | Eliminar | No | Escritura del módulo |
| POSTED | VOIDED | Anular | No | Escritura del módulo |
| POSTED | LOCKED | Cierre del período | Sí (revertir cierre) | Solo Contador |
| LOCKED | POSTED | Revertir cierre del período | — | Solo Administrador |

\newpage

# Anexo C — Errores comunes y soluciones

> 💡 La tabla describe **situaciones** que el sistema impide o advierte; los mensajes exactos pueden variar entre versiones. Use la columna "Situación" como pista para reconocer el problema.

| Situación | Módulo | Causa probable | Solución |
|---|---|---|---|
| El sistema no permite registrar la operación en el período elegido. | Cualquiera | El período seleccionado está cerrado. | Elegir un período abierto o solicitar la reapertura del período (requiere permisos). |
| El sistema no acepta la cuenta seleccionada. | Asientos, Ventas, Compras, Cobros, Pagos | La cuenta es de resumen, no de detalle. | Elegir una cuenta hoja del plan de cuentas. |
| El sistema indica que el asiento está descuadrado. | Asientos manuales | Suma DEBE ≠ Suma HABER. | Revisar las líneas y ajustar hasta que ambos lados sean iguales. |
| El contacto no aparece o está marcado como inactivo. | Ventas, Compras, Cobros, Pagos | El contacto fue desactivado. | Reactivarlo desde Contactos o elegir otro contacto. |
| El sistema indica que la factura ya está pagada. | Cobros, Pagos | La CxC/CxP tiene saldo cero. | Quitar la asignación o elegir otra factura. |
| La suma de asignaciones excede el monto del cobro o pago. | Cobros, Pagos | Se asignó más que el monto recibido o pagado. | Reducir las asignaciones hasta cuadrar con el monto del cobro/pago. |
| El sistema no permite editar o anular el documento. | Cualquiera | El documento pertenece a un período cerrado. | Solicitar la reapertura del período (requiere permisos de administrador). |
| El formulario no se envía y muestra campos en rojo. | Cualquier formulario | Faltan campos obligatorios. | Completar los campos marcados antes de guardar. |
| El sistema indica que el NIT ya existe. | Contactos | Otro contacto del mismo tipo tiene ese NIT. | Buscar el contacto existente y editarlo, en lugar de crear uno duplicado. |
| El sistema indica que no tiene permisos para la acción. | Cualquiera | El rol asignado no incluye esa acción. | Solicitar al administrador que ajuste los permisos del rol. |
| El sistema le pide volver a iniciar sesión. | Cualquiera | La sesión expiró por inactividad. | Iniciar sesión nuevamente. Los datos del formulario en curso pueden perderse. |

\newpage

# Anexo D — Atajos y consejos

## Atajos generales del navegador

El sistema utiliza los atajos estándar de formularios HTML:

| Atajo | Acción |
|---|---|
| `Tab` | Saltar al siguiente campo del formulario. |
| `Shift + Tab` | Saltar al campo anterior. |
| `Enter` | Confirmar el formulario (cuando el foco está en un campo de texto). |
| `Esc` | Cerrar ventanas emergentes (diálogos modales) cuando el diseño lo permite. |

> 💡 Atajos específicos del sistema (combinaciones propias para búsqueda, guardado, etc.) pueden existir o no según la versión. Consulte con el equipo de soporte si necesita conocer combinaciones específicas habilitadas en su instalación.

## Consejos de uso

1. **Trabaje en el período correcto**: verifique siempre arriba a la izquierda el período activo antes de crear documentos.
2. **Postee con frecuencia**: no acumule documentos en DRAFT — el balance de comprobación solo incluye POSTED.
3. **Revise los libros IVA semanalmente**: detectar diferencias temprano evita correcciones masivas al cierre.
4. **Use descripciones claras**: la descripción del asiento es lo primero que verá el auditor.
5. **No comparta su contraseña**: la auditoría atribuye los cambios al usuario logueado.
6. **Cierre sesión al terminar**: especialmente en computadoras compartidas.
7. **Exporte y archive**: al cierre de cada mes, guarde una copia del Balance General y de los libros IVA en su archivo digital.

\newpage

# Anexo E — Soporte y contacto

## Canal principal de soporte

Para reportar problemas, solicitar funcionalidades o consultar dudas:

- **Correo**: [completar]
- **Teléfono**: [completar]
- **Horario de atención**: [completar]

## Información a incluir en cada reporte

Para que el equipo de soporte resuelva su consulta más rápido, incluya:

1. **Organización** afectada (nombre y NIT).
2. **Usuario** que reporta (correo).
3. **Módulo y pantalla** donde ocurre el problema.
4. **Descripción** del problema, paso a paso.
5. **Captura de pantalla** del error.
6. **Navegador y versión** que usa.

## Reportes urgentes

Para incidentes que bloquean el cierre mensual o impiden la operación:

- Marque el correo con asunto **"URGENTE — [Organización]"**.
- Llame al teléfono de soporte además de enviar el correo.

## Mantenimientos programados

Los mantenimientos programados se notifican con al menos **48 horas de anticipación** vía correo a los administradores de cada organización. Programe sus cierres considerando estos avisos.

\newpage

# Cierre del manual

Este manual cubre el uso operativo completo del **Sistema de Información Contable** al momento de su redacción. Las funcionalidades del sistema pueden evolucionar; consulte siempre la última versión publicada de este documento.

Para sugerencias sobre el manual mismo (claridad, errores, omisiones), escriba al canal de soporte.

---

*Fin del Manual de Usuario — Sistema de Información Contable.*
*Asociación Mixta de Productores Agro-Avícola Conda Arriba.*

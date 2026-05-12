# Pruebas de Caja Negra — Sistema avicont-ia

**Técnica:** Validación funcional por entradas / salidas (partición de equivalencia)
**Total de tablas:** 13
**Total de escenarios evaluados:** 40

---

## Tabla 1
### Casos de Prueba para el Acceso al Sistema

| ENTRADAS | SALIDA | RESULTADOS OBTENIDOS |
|---|---|---|
| Datos introducidos en el inicio de sesión:<br>Usuario: marco@avicont.com<br>Contraseña: " " | "La contraseña es obligatoria, por favor complete el campo." | Cuando el campo de contraseña se encuentra vacío, el sistema rechaza el envío del formulario y notifica al usuario el error, manteniéndose en la vista del inicio de sesión. |
| Datos introducidos en el inicio de sesión:<br>Usuario: " "<br>Contraseña: 123456 | "El nombre de usuario es obligatorio, por favor ingrese un correo válido." | Cuando el campo de usuario se encuentra vacío, el sistema rechaza el envío del formulario y notifica al usuario el error correspondiente. |
| Datos introducidos en el inicio de sesión:<br>Usuario: marco@avicont.com<br>Contraseña: 12345incorrecto | "Credenciales incorrectas, por favor intente nuevamente." | Cuando el nombre de usuario es correcto pero la contraseña no lo es, el sistema alerta sobre el error y mantiene la vista del inicio de sesión sin permitir el acceso. |
| Datos introducidos en el inicio de sesión:<br>Usuario: marco@avicont.com<br>Contraseña: 123456Correcto | "Credenciales correctas, bienvenido al sistema." | Cuando las credenciales son correctas, el sistema permite el acceso y redirige al usuario a la pantalla de selección de organización. |

**COMENTARIO DE LA PRUEBA REALIZADA**

Las pruebas se llevaron a cabo con total normalidad y los resultados obtenidos cumplen con los requisitos necesarios para proteger el sistema contra accesos no autorizados, validando tanto credenciales válidas como combinaciones incorrectas o incompletas.

---

## Tabla 2
### Casos de Prueba para el Módulo de Usuarios y Organización

| ENTRADAS | SALIDA | RESULTADOS OBTENIDOS |
|---|---|---|
| Llenado y confirmación del envío del formulario de registro o actualización de usuario con todos los campos completos: nombre, correo electrónico, rol asignado y permisos. | "Usuario registrado o actualizado correctamente." | Al enviar un formulario completo para el registro o actualización de un usuario, el sistema confirma la acción y la tabla principal se actualiza casi a la par con los datos del nuevo registro. |
| Llenado e intento de envío del formulario con dos campos obligatorios incompletos (correo electrónico y rol). | "El formulario no puede ser enviado, por favor complete los campos vacíos." | Al intentar enviar un formulario incompleto, el sistema rechaza el cambio y notifica al usuario el error, manteniéndose en la vista del formulario. |
| Confirmación del cambio de estado de un usuario (de Activo a Inactivo o viceversa). | "El usuario fue actualizado correctamente." | Al confirmar el cambio de estado, el sistema notifica al usuario la acción realizada y la tabla de datos se actualiza, mostrando el nuevo estado del registro. |

**COMENTARIO DE LA PRUEBA REALIZADA**

Las pruebas se llevaron a cabo con total normalidad y los resultados obtenidos cumplen con los criterios de validación establecidos para el proceso de registro, edición y cambio de estado en el módulo de usuarios.

---

## Tabla 3
### Casos de Prueba para el Módulo de Plan de Cuentas

| ENTRADAS | SALIDA | RESULTADOS OBTENIDOS |
|---|---|---|
| Registro de una cuenta contable con código único y datos completos:<br>Código: 1.01.01<br>Nombre: Caja en Moneda Nacional<br>Tipo: Activo Corriente | "Cuenta contable registrada correctamente." | Cuando los datos del formulario son válidos y el código no se encuentra duplicado, el sistema persiste la cuenta dentro del plan de cuentas y la jerarquía se actualiza automáticamente. |
| Intento de registro de cuenta con código duplicado:<br>Código: 1.01.01 (existente)<br>Nombre: Caja Auxiliar | "El código de cuenta ya existe en el plan, por favor utilice un código único." | Al detectar la duplicación del código de cuenta, el sistema rechaza el registro y notifica al usuario el error, sin alterar el plan existente. |
| Cambio de jerarquía o estado de una cuenta existente (de Activa a Inactiva). | "Cuenta contable actualizada correctamente." | El sistema valida la ausencia de movimientos contables asociados que impidan el cambio, aplica la modificación y refleja el cambio en la vista jerárquica del plan de cuentas. |

**COMENTARIO DE LA PRUEBA REALIZADA**

Las pruebas se llevaron a cabo con total normalidad y los resultados obtenidos cumplen con los criterios de validación establecidos para garantizar la unicidad de los códigos contables y la consistencia jerárquica del plan de cuentas.

---

## Tabla 4
### Casos de Prueba para el Módulo de Contactos

| ENTRADAS | SALIDA | RESULTADOS OBTENIDOS |
|---|---|---|
| Registro de contacto con datos completos:<br>Nombre: Juan Pérez<br>Identificación tributaria: 20-12345678-9<br>Tipo: Cliente | "Contacto registrado correctamente." | Cuando los datos del formulario son válidos y la identificación tributaria no se encuentra duplicada, el sistema persiste el contacto y actualiza la tabla principal del módulo. |
| Intento de registro de contacto con identificación tributaria duplicada. | "Ya existe un contacto registrado con esa identificación tributaria." | El sistema valida la unicidad de la identificación tributaria y rechaza el registro, notificando al usuario el error correspondiente. |
| Confirmación del cambio de estado de un contacto (de Activo a Inactivo). | "El contacto fue actualizado correctamente." | El cambio de estado no elimina el contacto de la base de datos, solo restringe su uso en nuevas operaciones comerciales. La tabla principal refleja el cambio inmediatamente. |

**COMENTARIO DE LA PRUEBA REALIZADA**

Las pruebas se llevaron a cabo con total normalidad y los resultados obtenidos cumplen con los criterios de validación establecidos para evitar duplicidades en los datos maestros y mantener la trazabilidad histórica de los contactos.

---

## Tabla 5
### Casos de Prueba para el Módulo de Libro Diario

| ENTRADAS | SALIDA | RESULTADOS OBTENIDOS |
|---|---|---|
| Registro de asiento contable balanceado:<br>Fecha: 15/03/2026<br>Debe: Caja $1.000<br>Haber: Ventas $1.000<br>Período: Abierto | "Asiento contable registrado correctamente con número 1247." | El sistema valida la partida doble (suma de débitos igual a suma de créditos) y el estado abierto del período fiscal, asigna número correlativo y persiste el asiento en estado Borrador. |
| Intento de registro de asiento desbalanceado:<br>Debe: Caja $1.000<br>Haber: Ventas $900 | "El asiento no se encuentra balanceado. La suma del Debe debe ser igual a la suma del Haber." | El sistema rechaza el asiento al detectar el desbalance y notifica al usuario el error, manteniéndose en la vista del formulario sin persistir cambios. |
| Intento de registro de asiento con período fiscal cerrado:<br>Fecha: 15/12/2025<br>Período: Cerrado | "No es posible registrar asientos en un período fiscal cerrado." | El sistema valida el estado del período correspondiente a la fecha del asiento y rechaza el registro al encontrar el período cerrado, notificando al usuario el motivo. |
| Confirmación o anulación de un asiento existente. | "Asiento confirmado correctamente." / "Asiento anulado correctamente, se generó el asiento inverso N° 1248." | La confirmación cambia el estado del asiento de Borrador a Confirmado. La anulación genera automáticamente un asiento inverso con referencia al original, preservando la trazabilidad. Ambas acciones quedan registradas en el log de auditoría. |

**COMENTARIO DE LA PRUEBA REALIZADA**

Las pruebas se llevaron a cabo con total normalidad y los resultados obtenidos cumplen con los principios contables fundamentales de partida doble, integridad del período fiscal y trazabilidad de las modificaciones realizadas sobre los asientos.

---

## Tabla 6
### Casos de Prueba para el Módulo de Operaciones Comerciales

| ENTRADAS | SALIDA | RESULTADOS OBTENIDOS |
|---|---|---|
| Registro de venta con contacto y datos válidos:<br>Contacto: Juan Pérez (Cliente activo)<br>Fecha: 15/03/2026<br>Ítems: 2 productos<br>Total: $5.000 | "Operación comercial registrada correctamente." | El sistema valida la existencia y estado activo del contacto, calcula automáticamente los totales e impuestos aplicables y persiste la operación en estado Borrador. |
| Intento de registro de operación con período fiscal cerrado. | "La fecha de la operación corresponde a un período fiscal cerrado." | El sistema valida el estado del período correspondiente y rechaza el registro, notificando al usuario el error y manteniéndose en la vista del formulario. |
| Confirmación de una operación comercial. | "Operación confirmada correctamente, se generó el asiento N° 1250." | La confirmación genera automáticamente el asiento contable correspondiente, actualiza el saldo del contacto y registra la operación en los libros tributarios pertinentes. |

**COMENTARIO DE LA PRUEBA REALIZADA**

Las pruebas se llevaron a cabo con total normalidad y los resultados obtenidos cumplen con los criterios de integración entre el módulo comercial, el libro diario y los registros tributarios del sistema.

---

## Tabla 7
### Casos de Prueba para el Módulo de Cartera

| ENTRADAS | SALIDA | RESULTADOS OBTENIDOS |
|---|---|---|
| Registro de cobro con contacto y datos válidos:<br>Contacto: Juan Pérez<br>Medio: Transferencia bancaria<br>Monto: $5.000 | "Cobro registrado correctamente." | El sistema valida los datos del contacto, registra el movimiento en la cartera y actualiza el saldo del contacto. |
| Aplicación de cobro a documentos pendientes:<br>Cobro: $5.000<br>Documentos pendientes: Factura A-001 ($3.000) y Factura A-002 ($2.000) | "Cobro aplicado correctamente a 2 documentos." | El sistema asigna el monto a los documentos pendientes en el orden seleccionado, valida que el monto aplicado no exceda el saldo de cada documento y actualiza los saldos correspondientes. |
| Aplicación de cobro con monto excedente:<br>Cobro: $6.000<br>Documentos pendientes: $5.000 | "Cobro aplicado. Se generó un crédito a favor del contacto por $1.000." | El sistema aplica el monto disponible y registra el excedente como crédito a favor del contacto, disponible para futuras aplicaciones. |

**COMENTARIO DE LA PRUEBA REALIZADA**

Las pruebas se llevaron a cabo con total normalidad y los resultados obtenidos cumplen con los criterios de gestión de cartera, validando la correcta aplicación de pagos y cobros sobre los documentos pendientes y el manejo de excedentes como créditos a favor.

---

## Tabla 8
### Casos de Prueba para el Módulo de Períodos Fiscales y Cierres

| ENTRADAS | SALIDA | RESULTADOS OBTENIDOS |
|---|---|---|
| Apertura de un nuevo período fiscal:<br>Fecha inicio: 01/01/2026<br>Fecha cierre: 31/12/2026 | "Período fiscal creado correctamente en estado Abierto." | El sistema valida que las fechas no se solapen con períodos existentes, crea el período en estado Abierto y lo habilita para el registro de asientos contables. |
| Intento de cierre de período con asientos en estado Borrador. | "No es posible cerrar el período. Existen asientos pendientes de confirmación." | El sistema valida que todos los asientos del período estén confirmados y rechaza el cierre cuando detecta asientos en Borrador, notificando al usuario el motivo. |
| Cierre exitoso de período con todos los asientos confirmados. | "Período cerrado correctamente. Se generaron los asientos de cierre N° 1300 a N° 1305." | El sistema genera automáticamente los asientos de cierre, bloquea el período contra modificaciones futuras y registra la operación en el log de auditoría. |

**COMENTARIO DE LA PRUEBA REALIZADA**

Las pruebas se llevaron a cabo con total normalidad y los resultados obtenidos cumplen con los principios de cierre contable, garantizando la integridad de los períodos fiscales y la generación automática de los asientos de cierre correspondientes.

---

## Tabla 9
### Casos de Prueba para el Módulo de Libros Tributarios (IVA)

| ENTRADAS | SALIDA | RESULTADOS OBTENIDOS |
|---|---|---|
| Generación de Libro IVA Ventas para el período:<br>Mes: Marzo 2026 | "Libro IVA Ventas generado correctamente." | El sistema recopila los comprobantes del período, valida la integridad de los datos y presenta el libro en el formato exigido por la autoridad tributaria. |
| Anulación de un Libro IVA con justificación textual. | "Libro IVA anulado correctamente." | El sistema marca el libro como invalidado conservando el registro original con fines de trazabilidad, registra la justificación en el log de auditoría y permite su reactivación posterior. |
| Exportación del Libro IVA a formato XLSX. | "Archivo generado correctamente. Descargando libro_iva_ventas_marzo_2026.xlsx" | El sistema genera el archivo en el formato exigido por la autoridad tributaria, incluyendo encabezados, totales por categoría y validación de cuadre, listo para presentación. |

**COMENTARIO DE LA PRUEBA REALIZADA**

Las pruebas se llevaron a cabo con total normalidad y los resultados obtenidos cumplen con los formatos exigidos por la autoridad tributaria, garantizando la trazabilidad de las anulaciones y la integridad de los datos exportados.

---

## Tabla 10
### Casos de Prueba para el Módulo de Reportes Financieros

| ENTRADAS | SALIDA | RESULTADOS OBTENIDOS |
|---|---|---|
| Generación del Balance General:<br>Período: 01/01/2026 a 31/03/2026 | "Reporte generado correctamente." | El sistema consolida los saldos de las cuentas patrimoniales del período, presenta el reporte con la jerarquía contable correspondiente y muestra los totales y subtotales en pantalla. |
| Generación de reporte para un período sin movimientos. | "El período seleccionado no presenta movimientos contables. Se muestra un reporte vacío." | El sistema notifica al usuario la ausencia de movimientos y genera el reporte con valores en cero, manteniendo la estructura jerárquica de las cuentas. |
| Exportación del Balance General a formato PDF. | "Archivo generado correctamente. Descargando balance_general_2026Q1.pdf" | El sistema preserva el formato visual, los totales y la estructura jerárquica del reporte, permitiendo aplicar firma digital si se encuentra configurada. |

**COMENTARIO DE LA PRUEBA REALIZADA**

Las pruebas se llevaron a cabo con total normalidad y los resultados obtenidos cumplen con los criterios de presentación contable estándar, manteniendo la integridad estructural del reporte tanto en su visualización en pantalla como en la exportación a formatos externos.

---

## Tabla 11
### Casos de Prueba para el Módulo de Operativo Avícola

| ENTRADAS | SALIDA | RESULTADOS OBTENIDOS |
|---|---|---|
| Registro de granja y lote:<br>Granja: Granja Norte<br>Lote: L-2026-001<br>Cantidad inicial: 5.000 aves<br>Fecha ingreso: 01/03/2026 | "Granja y lote registrados correctamente." | El sistema valida la unicidad del identificador del lote, persiste los registros y los relaciona automáticamente con la granja correspondiente. |
| Intento de registro de mortandad con cantidad mayor a la población actual:<br>Lote: L-2026-001 (4.950 aves vivas)<br>Cantidad mortandad: 5.500 | "La cantidad de mortandad no puede superar la población actual del lote." | El sistema valida la coherencia del dato, rechaza el registro y notifica al usuario el error, evitando inconsistencias en la población del lote. |
| Registro de mortandad válida:<br>Lote: L-2026-001<br>Cantidad: 50 aves<br>Fecha: 15/03/2026 | "Mortandad registrada correctamente. Población actual: 4.900 aves." | El sistema persiste el registro, recalcula automáticamente la población actual del lote y actualiza la vista del módulo. |

**COMENTARIO DE LA PRUEBA REALIZADA**

Las pruebas se llevaron a cabo con total normalidad y los resultados obtenidos cumplen con los criterios de coherencia operativa, validando la integridad de la población de cada lote y la trazabilidad de los registros de mortandad.

---

## Tabla 12
### Casos de Prueba para el Módulo de Documentos y Asistente con IA

| ENTRADAS | SALIDA | RESULTADOS OBTENIDOS |
|---|---|---|
| Carga de documento PDF válido:<br>Tamaño: 1,2 MB<br>Formato: PDF | "Documento procesado e indexado correctamente." | El sistema acepta el archivo, lo procesa mediante el motor de embeddings, lo almacena con su metadata y lo indexa para consultas posteriores del asistente con IA. |
| Intento de carga con formato no soportado:<br>Formato: .docx | "El formato del archivo no es soportado. Solo se aceptan archivos PDF o imágenes." | El sistema rechaza la carga al detectar un formato no permitido y notifica al usuario el error, manteniéndose en la vista del módulo. |
| Consulta al asistente con IA:<br>Pregunta: "¿Cuál fue el total de ventas del mes pasado?" | "Las ventas del mes de febrero de 2026 totalizaron $125.450,00 distribuidos en 47 comprobantes." | El motor RAG recupera el contexto relevante de los datos del sistema, valida el límite de uso por organización y genera la respuesta en lenguaje natural. |

**COMENTARIO DE LA PRUEBA REALIZADA**

Las pruebas se llevaron a cabo con total normalidad y los resultados obtenidos cumplen con los criterios de validación de formatos de archivo, procesamiento de documentos y respuestas coherentes del asistente con inteligencia artificial.

---

## Tabla 13
### Casos de Prueba para el Módulo de Auditoría y Configuración

| ENTRADAS | SALIDA | RESULTADOS OBTENIDOS |
|---|---|---|
| Consulta del registro de auditoría aplicando filtros:<br>Usuario: marco@avicont.com<br>Módulo: Libro Diario<br>Rango: Marzo 2026 | "Se encontraron 23 registros de auditoría." | El sistema aplica los filtros sobre el log de auditoría, presenta los resultados ordenados cronológicamente y permite consultar el detalle de cada acción registrada. La información se muestra en modo solo lectura. |
| Modificación de la configuración del sistema:<br>Tipo de comprobante: Factura A<br>Cambio: Activación de firma digital | "Configuración actualizada correctamente." | El sistema aplica el cambio, actualiza los parámetros de generación de comprobantes y registra automáticamente la modificación en el log de auditoría con el usuario, fecha y detalle del cambio realizado. |

**COMENTARIO DE LA PRUEBA REALIZADA**

Las pruebas se llevaron a cabo con total normalidad y los resultados obtenidos cumplen con los criterios de trazabilidad y control administrativo, garantizando que toda modificación crítica del sistema quede debidamente registrada en el log de auditoría.

---

## Resumen de las pruebas de caja negra

| Métrica | Valor |
|---|---:|
| Tablas de prueba evaluadas | 13 |
| Escenarios totales (entradas / salidas validadas) | 40 |
| Escenarios aprobados | 40 |
| Escenarios no aprobados | 0 |
| **Tasa de aprobación** | **100 %** |

La totalidad de los escenarios funcionales evaluados sobre el sistema avicont-ia respondió de manera correcta tanto a las entradas válidas como a las entradas inválidas, validando los mecanismos de detección de errores, las reglas de negocio del dominio contable y la coherencia de los mensajes presentados al usuario. Esto confirma que el sistema cumple con los criterios funcionales esperados desde la perspectiva del usuario externo, garantizando una experiencia robusta frente a distintos escenarios de uso.

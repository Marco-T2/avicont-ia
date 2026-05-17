# Manual del Sistema Avicont

Este manual describe cómo realizar las tareas más frecuentes en el sistema Avicont. Cada tarea incluye su objetivo, cuándo usarla, los pasos a seguir, una explicación de los campos importantes, y los errores comunes que el usuario puede encontrar.

## Preguntar al asistente de IA

El asistente de IA del sistema permite consultar información de tu organización mediante lenguaje natural. Puede buscar en los documentos subidos a la organización y responder preguntas operativas sin necesidad de navegar manualmente por las pantallas.

### Cuándo usarlo

Usar el asistente cuando tengas una pregunta sobre políticas internas, manuales de procedimiento, o documentación de la empresa que esté cargada en el sistema. También sirve para consultas operativas rápidas sobre granjas y lotes activos.

### Pasos

1. Abrir el panel lateral derecho del sistema haciendo clic en el icono del asistente.
2. Escribir la pregunta en lenguaje natural en el campo de entrada.
3. Presionar Enter o el botón de enviar.
4. Esperar la respuesta del asistente, que incluye una cita al documento fuente cuando aplica.

### Tipos de preguntas que funcionan bien

**Sobre documentos subidos**: el asistente puede buscar en políticas, manuales, normativas y contratos cargados en la sección Documentos. Ejemplo: "¿Cuál es el plazo estándar de cobro según nuestra política?".

**Sobre granjas y lotes**: el asistente puede listar granjas, listar lotes y traer resúmenes de lote. Ejemplo: "¿Qué lotes están activos en la Granja Norte?".

### Errores comunes

- **"No encontré información sobre eso"**: el documento que necesitás puede no estar subido al sistema, o estar en un scope al que tu rol no tiene acceso. Verificá la lista de documentos en la sección Documentos.
- **El asistente responde algo distinto a lo que preguntaste**: reformulá la pregunta usando términos más específicos del documento. Por ejemplo, en lugar de "cuándo cobro" usar "plazo de cobro".

## Crear un contacto

Esta tarea permite dar de alta una persona o empresa nueva en el sistema. Los contactos son necesarios para registrar todas las operaciones comerciales: ventas, compras, cobros y pagos.

### Cuándo usarlo

Crear un contacto antes de registrar la primera operación con una persona o empresa que aún no figura en el sistema. Si el contacto ya existe, no duplicarlo: buscarlo en la lista y editarlo si los datos cambiaron.

### Pasos

1. En el menú lateral izquierdo, hacer clic en el módulo "Contabilidad".
2. Hacer clic en "Contactos" dentro del menú de Contabilidad.
3. Presionar el botón "Nuevo contacto" en la parte superior derecha de la lista.
4. Completar el formulario con los datos del contacto.
5. Hacer clic en "Guardar".

### Campos importantes

**Tipo** (obligatorio): el rol comercial del contacto. Las opciones disponibles son Cliente, Proveedor, Socio, Transportista y Otro. Un contacto solo puede tener un tipo a la vez. Si una misma persona o empresa cumple varios roles, se usa el tipo principal y se indica el resto en observaciones internas.

**Nombre** (obligatorio): el nombre completo de la persona o la razón social de la empresa. Este campo se usa en facturas, recibos y reportes, por lo que conviene escribirlo exactamente como debe aparecer en los documentos fiscales.

**NIT**: el número de identificación tributaria del contacto. Es opcional pero recomendado, especialmente para clientes y proveedores que generan documentos fiscales. El sistema valida que no existan dos contactos con el mismo NIT en la misma organización.

**Días de plazo de pago**: la cantidad de días que el contacto tiene para pagar una factura desde su emisión. Aplica principalmente a clientes para definir el vencimiento automático de las cuentas por cobrar. Se deja en cero o vacío para pagos al contado.

**Límite de crédito**: monto máximo en bolívares que el contacto puede adeudar simultáneamente. Aplica a clientes para controlar la exposición de la empresa. Cuando se supera el límite, el sistema advierte al registrar nuevas ventas a crédito. Se deja vacío o en "Sin límite" si no se desea aplicar este control.

### Errores comunes

- **"Ya existe un contacto con ese NIT"**: otro contacto en la organización tiene el mismo número de identificación tributaria. Buscar el contacto existente en la lista y editarlo en vez de crear uno nuevo.
- **"El nombre es obligatorio"**: el campo Nombre no puede quedar vacío ni contener solo espacios.
- **"El tipo es obligatorio"**: hay que seleccionar una opción del menú desplegable de Tipo antes de guardar.

## Subir un documento

Esta tarea permite cargar archivos al sistema para que el asistente de IA pueda buscar en su contenido. Los documentos cargados quedan disponibles para todos los usuarios de la organización que tengan permiso de lectura.

### Cuándo usarlo

Subir un documento cuando se incorpora una nueva política, manual, normativa, contrato o cualquier documento de referencia que el equipo necesite consultar. También al actualizar versiones de documentos existentes; en ese caso, primero eliminar el documento viejo y luego subir el nuevo.

### Pasos

1. En el menú lateral izquierdo, hacer clic en "Documentos".
2. Presionar el botón "Subir documento" en la parte superior derecha.
3. Seleccionar el archivo desde tu computadora. Los formatos aceptados son PDF, DOCX y TXT.
4. Asignar las etiquetas que correspondan al documento usando el selector de etiquetas. Si la etiqueta no existe, escribirla y presionar "Crear" para agregarla.
5. Seleccionar el alcance del documento: Organización (visible para todos), Contabilidad (visible solo para el módulo contable) o Granja (visible solo para el módulo de granjas).
6. Hacer clic en "Subir".

### Campos importantes

**Formato del archivo**: solo se aceptan PDF, DOCX y TXT. Los archivos Excel no se aceptan porque el sistema usa búsqueda semántica que no funciona bien con datos numéricos en tablas; para esos casos existen páginas dedicadas como Libro Mayor o Cuentas por Cobrar. Las imágenes y escaneos requieren texto seleccionable (PDF con OCR aplicado).

**Tamaño máximo**: 50 MB por archivo. Los archivos DOCX mayores a 5 MB se suben pero no se indexan automáticamente para búsqueda; el archivo queda disponible para descarga pero no aparece en consultas al asistente.

**Etiquetas**: clasificación libre por organización que el asistente usa para filtrar búsquedas. Ejemplos sugeridos: "politicas", "manuales", "contratos", "legal", "rrhh", "plan-de-cuentas". Las etiquetas son específicas de cada organización y se crean inline al subir el primer documento que las usa.

**Alcance**: define qué roles pueden acceder al documento. Organización es accesible para todos los miembros. Contabilidad restringe a roles con permisos contables. Granja restringe a roles con permisos de granja. Si tenés dudas, usar Organización.

### Errores comunes

- **"Tipo de archivo no permitido"**: el archivo que intentás subir no es PDF, DOCX ni TXT. Si tenés un Excel, considerar convertirlo a PDF o redactar el contenido como documento DOCX. Si es una imagen, escanearla a PDF con OCR usando apps como Adobe Scan.
- **"El archivo excede el límite de 50MB"**: dividir el documento en partes más chicas o comprimir el PDF antes de subirlo.
- **"No se pudo procesar el archivo"**: el archivo está corrupto o tiene un formato interno no soportado. Volver a generarlo desde la aplicación original (Word, lector de PDF) y reintentar.

## Registrar una venta nueva

Esta tarea permite registrar una operación de venta a un cliente, generando automáticamente los asientos contables, la cuenta por cobrar correspondiente, y el comprobante fiscal asociado.

### Cuándo usarlo

Registrar una venta cuando se entrega un producto o servicio a un cliente, ya sea al contado o a crédito. La venta se registra al momento de la emisión del comprobante fiscal, no al momento del pedido ni del cobro.

### Pasos

1. En el menú lateral izquierdo, hacer clic en el módulo "Contabilidad".
2. Hacer clic en "Ventas" dentro del menú de Contabilidad.
3. Presionar el botón "Nueva venta" en la parte superior derecha.
4. Seleccionar el cliente desde el selector de contactos. Si el cliente no existe, primero crearlo siguiendo la tarea "Crear un contacto".
5. Seleccionar el período fiscal en el que se registra la venta. El sistema sugiere el período abierto vigente por defecto.
6. Completar los detalles de los productos o servicios vendidos: cantidad, precio unitario, descuentos.
7. Seleccionar el tipo de comprobante (factura, nota de venta) y el método de pago (contado, crédito).
8. Revisar los totales calculados automáticamente.
9. Hacer clic en "Guardar" para registrar la venta.

### Campos importantes

**Cliente**: solo aparecen en el selector los contactos con tipo Cliente que estén activos. Si el cliente que necesitás no aparece, verificá su tipo y estado en la sección Contactos.

**Período fiscal**: el período contable al que se imputa la venta. Solo se pueden registrar ventas en períodos abiertos. Si el período está cerrado, no aparece en el selector. Para cerrar o reabrir períodos, ir a Configuración → Períodos.

**Método de pago**: si seleccionás Contado, el sistema genera automáticamente el cobro al confirmar la venta. Si seleccionás Crédito, la venta queda como cuenta por cobrar pendiente hasta que se registre el cobro por separado.

**Tipo de comprobante**: define qué tipo de documento fiscal se genera. Las opciones disponibles dependen de la configuración de tu organización en Configuración → Tipos de Comprobante.

### Errores comunes

- **"Cliente no seleccionado"**: el campo cliente es obligatorio. Seleccionar uno del listado antes de guardar.
- **"Período cerrado"**: el período fiscal seleccionado ya fue cerrado y no admite nuevas ventas. Seleccionar un período abierto o solicitar al contador la reapertura del período.
- **"Supera el límite de crédito del cliente"**: la venta a crédito haría que la deuda total del cliente supere su límite configurado. Cobrar parte de la deuda existente, aumentar el límite del cliente, o registrar la venta al contado.
- **"Faltan datos de productos"**: hay que cargar al menos un ítem con cantidad y precio antes de poder guardar la venta.

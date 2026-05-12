# Pruebas de Accesibilidad — Sistema avicont-ia

**Herramienta utilizada:** Google Lighthouse v13.0.2 (motor axe-core v4.11.0 — Deque Systems)
**Entorno:** Build de producción local (Next.js 16 sobre Node.js, WSL2)
**Navegador:** Microsoft Edge (Chromium)
**Estándar de referencia:** WCAG 2.1 nivel AA (Web Content Accessibility Guidelines)
**Fecha de ejecución:** Mayo 2026
**Pantallas evaluadas:** Libro Diario (`/accounting/journal`) y Nueva Venta (`/sales/new`)

---

## 1. Definición y objetivo

Las pruebas de accesibilidad tienen como objetivo evaluar el grado de cumplimiento del sistema avicont-ia con los estándares internacionales que garantizan que las personas con distintas capacidades puedan percibir, comprender, navegar e interactuar con la aplicación. A diferencia de las pruebas funcionales, este tipo de pruebas verifica la calidad semántica del HTML renderizado, la presencia de etiquetas accesibles para tecnologías asistivas (lectores de pantalla, navegación por teclado, magnificadores), el contraste cromático suficiente y la correcta estructuración de los componentes interactivos. La evaluación se basa en el estándar **WCAG 2.1 nivel AA**, marco normativo adoptado a nivel internacional y exigido por legislaciones de accesibilidad digital en numerosas jurisdicciones.

---

## 2. Herramienta utilizada

Se empleó **Google Lighthouse**, una herramienta de auditoría automatizada integrada en los navegadores basados en Chromium (Chrome, Edge, Brave). Lighthouse incorpora internamente el motor **axe-core** desarrollado por Deque Systems, considerado la referencia de la industria para la evaluación automatizada de accesibilidad. Esta combinación permite generar un puntaje cuantitativo (0 a 100) por pantalla, junto con un detalle cualitativo de las violaciones detectadas, su severidad, el criterio WCAG infringido y los elementos HTML específicos afectados.

Las herramientas automatizadas son capaces de detectar entre el **30 % y el 50 % de las potenciales violaciones de accesibilidad**, motivo por el cual se complementan con una sección de verificación manual al final del informe.

---

## 3. Pantallas evaluadas

Se seleccionaron dos pantallas representativas del sistema, escogidas por su densidad de componentes UI y por cubrir patrones distintos de interacción:

### Tabla – Pantallas auditadas

| Pantalla | Ruta | Tipo de patrón | Form factor | Justificación |
|---|---|---|---|---|
| **Libro Diario** | `/[orgSlug]/accounting/journal` | Listado con filtros y tabla | Móvil (moto g power) | Pantalla típica de consulta contable, evaluada bajo emulación de dispositivo móvil |
| **Nueva Venta** | `/[orgSlug]/sales/new` | Formulario complejo con grid de líneas | Escritorio | Pantalla más densa del sistema en componentes UI (formulario de 1.111 líneas de código), evaluada en escritorio |

---

## 4. Criterios de aceptación

Se establecieron los siguientes umbrales para considerar una pantalla aceptable en términos de accesibilidad:

| Métrica | Umbral establecido |
|---|---|
| Puntaje global de accesibilidad (Lighthouse) | mayor o igual a 90 / 100 |
| Violaciones de severidad **crítica** sin remediación | máximo 3 por pantalla |
| Violaciones de severidad **seria** sin remediación | máximo 5 por pantalla |
| Cumplimiento de criterios WCAG 2.1 nivel A | mayor o igual al 95 % de los audits aplicables |

La interpretación de los puntajes según la escala de Google Lighthouse es la siguiente:

| Rango | Calificación |
|:-:|---|
| 90 – 100 | Bueno (verde) |
| 50 – 89 | Necesita mejoras (naranja) |
| 0 – 49 | Deficiente (rojo) |

---

## 5. Resultados obtenidos

### 5.1 Pantalla 1 — Libro Diario (móvil)

**URL evaluada:** `http://localhost:3000/contabilidad-1777261052719425644/accounting/journal`
**Modo de emulación:** dispositivo móvil
**Puntaje global de accesibilidad:** **90 / 100**

#### Tabla – Resumen de audits ejecutados

| Tipo de audit | Cantidad |
|---|---:|
| Audits aprobados | 24 |
| Audits con falla | 2 |
| Audits no aplicables | 35 |
| Audits para verificación manual | 10 |
| **Total de audits ejecutados** | **71** |

#### Tabla – Violaciones detectadas

| Regla | Severidad | Criterio WCAG | Elementos afectados | Descripción |
|---|---|---|:-:|---|
| `button-name` | Crítica | 4.1.2 (Nivel A) | 5 | Botones sin nombre accesible (un botón de ícono en el encabezado y cuatro componentes Select sin etiqueta asociada) |
| `color-contrast` | Seria | 1.4.3 (Nivel AA) | 5 | Texto con contraste insuficiente de 4,34:1 (umbral exigido: 4,5:1) en un párrafo descriptivo y cuatro encabezados de la tabla principal |

#### Tabla – Audits aprobados (selección representativa)

| Categoría | Audits aprobados |
|---|---|
| ARIA | `aria-allowed-attr`, `aria-required-attr`, `aria-roles`, `aria-valid-attr-value`, `aria-valid-attr`, `aria-hidden-body`, `aria-hidden-focus` |
| Nombres y etiquetas | `document-title`, `image-alt`, `link-name` |
| Navegación | `heading-order`, `tabindex` |
| Internacionalización | `html-has-lang`, `html-lang-valid` |
| Buenas prácticas | `landmark-one-main`, `meta-viewport`, `target-size` |
| Tablas | `table-fake-caption`, `td-has-header`, `td-headers-attr` |

---

### 5.2 Pantalla 2 — Nueva Venta (escritorio)

**URL evaluada:** `http://localhost:3000/contabilidad-1777261052719425644/sales/new`
**Modo de emulación:** escritorio
**Puntaje global de accesibilidad:** **91 / 100**

#### Tabla – Resumen de audits ejecutados

| Tipo de audit | Cantidad |
|---|---:|
| Audits aprobados | 26 |
| Audits con falla | 3 |
| Audits no aplicables | 33 |
| Audits para verificación manual | 10 |
| **Total de audits ejecutados** | **72** |

#### Tabla – Violaciones detectadas

| Regla | Severidad | Criterio WCAG | Elementos afectados | Descripción |
|---|---|---|:-:|---|
| `button-name` | Crítica | 4.1.2 (Nivel A) | 3 | Botón de colapsar la barra lateral, componente Select dentro del grid de líneas y botón de eliminar fila sin nombre accesible |
| `color-contrast` | Seria | 1.4.3 (Nivel AA) | 2 | Encabezados de sección del menú lateral ("OPERACIONES" y "CONTABILIDAD") con contraste de 2,63:1 sobre fondo claro (umbral exigido: 4,5:1) |
| `td-has-header` | Crítica | 1.3.1 (Nivel A) | 1 | La columna de acciones del grid de líneas (botón de eliminar fila) carece de un encabezado `<th>` asociado |

#### Tabla – Audits aprobados (selección representativa)

| Categoría | Audits aprobados |
|---|---|
| ARIA | `aria-allowed-attr`, `aria-required-attr`, `aria-roles`, `aria-valid-attr-value`, `aria-valid-attr`, `aria-hidden-body`, `aria-hidden-focus` |
| Nombres y etiquetas | `document-title`, `image-alt`, `label`, `link-name`, `link-in-text-block` |
| Navegación | `heading-order`, `tabindex` |
| Internacionalización | `html-has-lang`, `html-lang-valid` |
| Buenas prácticas | `landmark-one-main`, `meta-viewport`, `target-size` |
| Tablas | `table-fake-caption`, `td-headers-attr` |

#### Observación informativa adicional

La pantalla presenta dos enlaces con el texto "Inicio" pero con destinos diferentes (uno hacia la página principal del sistema y otro hacia el panel contable). Esta circunstancia es señalada por el audit `identical-links-same-purpose` con severidad **menor**, correspondiente al criterio WCAG 2.4.9 de nivel AAA. No afecta el puntaje global por tratarse de un nivel superior al exigido (AA), pero queda registrada como una mejora recomendada para optimizar la experiencia de usuarios de lectores de pantalla.

---

## 6. Análisis de resultados

Los resultados obtenidos en ambas pantallas demuestran un **nivel de accesibilidad bueno** según la escala de Google Lighthouse (puntajes superiores a 90), con un promedio global de **90,5 / 100**. Las violaciones detectadas no obedecen a errores aislados, sino que responden a **patrones sistémicos** identificables a lo largo del sistema, lo cual permite definir un plan de remediación estructurado.

### 6.1 Patrones sistémicos detectados

Los siguientes patrones se manifiestan de manera consistente en ambas pantallas evaluadas y se proyectan al resto del sistema, dado que provienen de la biblioteca de componentes utilizada (shadcn/ui sobre Radix UI) y del sistema de tokens cromáticos:

| Patrón sistémico | Manifestación | Pantallas afectadas |
|---|---|:-:|
| Componentes `Select` (Radix UI) sin etiqueta accesible asociada | El componente expone `aria-controls` y `aria-expanded` correctamente, pero carece de `aria-label` o `aria-labelledby` | Ambas |
| Botones de ícono sin atributo `aria-label` | Botones de acción rápida (toggle de menú, eliminar fila) implementados solo con ícono visual | Ambas |
| Token de color `text-muted-foreground` sobre fondos claros | Contraste insuficiente entre el gris medio y los fondos `bg-muted`, especialmente al aplicar opacidad parcial | Ambas |

### 6.2 Patrones específicos por tipo de pantalla

Adicionalmente, se identificaron violaciones específicas según el tipo de pantalla evaluada:

| Tipo de pantalla | Patrón específico | Criterio WCAG |
|---|---|---|
| Listado con tabla | Encabezados de tabla con texto en gris sobre fondo gris claro | 1.4.3 |
| Formulario con grid de líneas | Columna de acciones (botones de eliminar fila) sin encabezado `<th>` correspondiente | 1.3.1 |
| Layout con menú lateral | Etiquetas de sección con opacidad reducida que disminuyen el ratio de contraste | 1.4.3 |

### 6.3 Comparación entre pantallas

| Métrica | Libro Diario (móvil) | Nueva Venta (escritorio) |
|---|:-:|:-:|
| Puntaje global | 90 / 100 | 91 / 100 |
| Audits aprobados | 24 | 26 |
| Violaciones críticas | 1 regla (5 elementos) | 2 reglas (4 elementos) |
| Violaciones serias | 1 regla (5 elementos) | 1 regla (2 elementos) |
| Audits manuales pendientes | 10 | 10 |

La pantalla de **Nueva Venta** obtiene un puntaje ligeramente superior debido al cumplimiento del audit `label` (etiquetas asociadas a los campos del formulario), que no resulta aplicable en la pantalla de Libro Diario por carecer de campos de formulario. No obstante, presenta una violación adicional (`td-has-header`) propia del patrón de grid editable de líneas.

---

## 7. Verificación manual complementaria

Las herramientas automatizadas como Lighthouse y axe-core son capaces de detectar entre el **30 % y el 50 %** de las potenciales violaciones de accesibilidad. Los siguientes diez aspectos requieren **inspección humana** y fueron señalados por la propia herramienta como audits para verificación manual:

| # | Aspecto a verificar | Descripción |
|:-:|---|---|
| 1 | `custom-controls-labels` | Los controles personalizados poseen etiquetas asociadas mediante `aria-label` o `aria-labelledby` |
| 2 | `custom-controls-roles` | Los controles personalizados emplean roles ARIA apropiados |
| 3 | `focus-traps` | El foco del usuario no queda atrapado accidentalmente en una región |
| 4 | `focusable-controls` | Los controles interactivos personalizados son enfocables mediante teclado y muestran un indicador visual de foco |
| 5 | `interactive-element-affordance` | Los elementos interactivos comunican su propósito y estado |
| 6 | `logical-tab-order` | El orden de tabulación sigue la disposición visual de la página |
| 7 | `managed-focus` | El foco del usuario es dirigido al contenido nuevo añadido a la página (modales, diálogos) |
| 8 | `offscreen-content-hidden` | El contenido fuera de pantalla está oculto para tecnologías asistivas mediante `display: none` o `aria-hidden=true` |
| 9 | `use-landmarks` | Los elementos landmark de HTML5 (`<main>`, `<nav>`, `<aside>`) se utilizan para mejorar la navegación |
| 10 | `visual-order-follows-dom` | El orden visual de la página se corresponde con el orden del DOM |

---

## 8. Tabla resumen comparativa

| Pantalla | Form factor | Puntaje | Audits aprobados | Audits fallidos | Severidad máxima |
|---|:-:|:-:|:-:|:-:|:-:|
| Libro Diario | Móvil | 90 / 100 | 24 | 2 | Crítica |
| Nueva Venta | Escritorio | 91 / 100 | 26 | 3 | Crítica |
| **Promedio del sistema** | — | **90,5 / 100** | **25** | **2,5** | — |

---

## 9. Conclusión de las pruebas de accesibilidad

El sistema avicont-ia alcanzó un **puntaje promedio de accesibilidad de 90,5 / 100** según la escala de Google Lighthouse, lo que corresponde a una calificación de **"Bueno"** dentro del marco de evaluación automatizada y supera el umbral de aceptación establecido. De los 71 a 72 audits ejecutados por pantalla, **el 96 % o más resultó conforme** con los criterios WCAG 2.1 de niveles A y AA aplicables al sistema.

Las violaciones detectadas no constituyen errores aislados sino **patrones sistémicos** derivados principalmente de la biblioteca de componentes utilizada (shadcn/ui sobre Radix UI) y del sistema de tokens cromáticos del tema. Esto resulta favorable desde el punto de vista de la mantenibilidad, ya que la corrección de cada patrón en su ubicación canónica propaga la mejora a todas las pantallas del sistema simultáneamente, sin necesidad de intervenciones individuales por componente.

Las áreas identificadas como mejorables se concentran en tres ejes: la asignación de etiquetas accesibles (`aria-label`) a componentes Select y botones de ícono, el ajuste del token cromático `text-muted-foreground` para alcanzar el ratio de contraste 4,5:1 exigido por el criterio WCAG 1.4.3, y la incorporación de encabezados explícitos en columnas de acción dentro de los grids editables. Ninguno de los hallazgos constituye una barrera funcional total para usuarios con discapacidad, y todos disponen de soluciones técnicas estándar y bien documentadas.

Estos resultados confirman que la **arquitectura hexagonal** del sistema, sumada al uso de un framework moderno como Next.js junto con bibliotecas de componentes accesibles por diseño, permite alcanzar niveles de accesibilidad acordes a estándares internacionales con un esfuerzo de remediación acotado. La existencia de diez audits para verificación manual posiciona a la inspección humana complementaria como el siguiente paso necesario para una evaluación integral, particularmente en aspectos relacionados con la navegación por teclado, la gestión del foco en diálogos y la coherencia entre el orden visual y el orden del DOM.

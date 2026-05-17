# Plantillas de documentos para RAG

Estos 6 archivos son ejemplos de cómo estructurar documentos para que el AI agent los aproveche al máximo cuando los buscás vía `searchDocuments`.

## Cómo usarlos

### Opción A: Copiar y pegar a Word
1. Abrí el `.md` que querés usar en un editor de texto.
2. Seleccioná todo (`Ctrl+A`), copiá (`Ctrl+C`).
3. Abrí Word nuevo.
4. Pegá con **"Pegar con formato fuente"** (botón derecho → "Mantener formato fuente" o `Ctrl+Shift+V`).
5. Word reconoce `#` como Heading 1, `##` como Heading 2, etc.
6. Adaptá el contenido a tu empresa real.
7. Guardá como `.docx`.
8. Subí al sistema con los tags correctos.

### Opción B: Convertir a DOCX desde terminal
Si tenés pandoc instalado:
```bash
pandoc templates/document-examples/politica-de-cobros.md -o politica-de-cobros.docx
```

## Reglas que estos templates respetan

- **Headings markdown** → el chunker detecta y popula `sectionPath` para citas verificables.
- **Cada sección 200-500 palabras** → sweet spot del chunker word-based.
- **Cada sección autocontenida** → no usa "como vimos antes" / "ver arriba".
- **Vocabulario consistente** → un solo término por concepto.
- **Frases completas con punto final** → embeddings funcionan en oraciones, no fragmentos.
- **Términos definidos al inicio** → CxC = Cuentas por Cobrar, etc.

## Tag sugerido al subir cada uno

| Archivo | Tag sugerido | Scope |
|---------|--------------|-------|
| `politica-de-cobros.md` | `politicas`, `cobros` | ACCOUNTING |
| `manual-de-funciones.md` | `manuales`, `rrhh` | ORGANIZATION |
| `plan-de-cuentas.md` | `plan-de-cuentas`, `contable` | ACCOUNTING |
| `contrato-tipo.md` | `contratos`, `legal` | ORGANIZATION |
| `estatutos-empresa.md` | `legal`, `constitucion` | ORGANIZATION |
| `manual-del-sistema.md` | `manual-sistema`, `instrucciones` | ORGANIZATION |

## Sobre el template `manual-del-sistema.md`

Este template es **especial**: documenta el uso del propio sistema Avicont (cómo crear contactos, subir documentos, registrar ventas). Es ideal para que usuarios nuevos consulten al agente *"¿cómo hago X?"* y obtengan instrucciones paso a paso citadas.

Las 4 tareas incluidas como ejemplo son: preguntar al asistente de IA, crear un contacto, subir un documento, y registrar una venta nueva. Los pasos y campos están verificados contra el código real del sistema. Adaptá según evolucione la app, y sumá tareas siguiendo el mismo formato: objetivo + cuándo usarlo + pasos numerados + campos importantes + errores comunes.

## Testeo post-upload

Para validar que el sistema está usando bien tu doc, preguntale al agente:
- *"Según la política de cobros, ¿cuál es el plazo estándar?"* → debe citar la sección.
- *"¿Cuáles son las tareas del galponero?"* → debe responder con la sección Galponero del manual.
- *"¿Qué cuenta uso para registrar caja chica?"* → debe traer el chunk de 1.01.01 Caja del plan de cuentas.
- *"¿Cómo creo un contacto?"* → debe responder con la sección Crear un contacto del manual del sistema.
- *"¿Qué formatos puedo subir?"* → debe explicar PDF/DOCX/TXT desde la sección Subir un documento.

Si la respuesta es vaga o cita una sección incorrecta, el doc puede necesitar más estructura.

# Learnings — timestamptz-migration

Aprendizajes emergentes durante la implementación del cambio. **Se incluyen en el PR description (T-18, Fase 8)** y se sintetizan al hacer `sdd-archive`.

---

## Aprendizaje #1 — Las specs sobre bugs de timezone/paginación necesitan verificación empírica

### Contexto

Durante la fase `sdd-spec` se modeló el bug del cursor `::timestamp` "desde afuera" (razonamiento sobre lo que Postgres "debería" hacer al castear un string ISO-8601 con sufijo `Z` a `TIMESTAMP` sin TZ). El razonamiento llevó a dos errores en cascada que el gate TDD detectó después:

### Error 1 — Dirección del shift (commit `4b4fdbf`)

**Lo que decía la spec original**: el cast `::timestamp` produce un offset "hacia atrás" (-4h) que **omite filas** de la comparación.

**Lo que Postgres realmente hace** (verificado empíricamente):
1. `'2026-04-27T04:00:00.000Z'::timestamp` descarta el `Z` y produce `2026-04-27T04:00:00.000` naive
2. Al comparar `timestamptz_col < timestamp_value`, Postgres coerce el TIMESTAMP a TIMESTAMPTZ usando `current_setting('TimeZone')`
3. Con `TimeZone = 'America/La_Paz'` (UTC-4), el valor naive `04:00` se interpreta como `04:00 BO-local` = **`08:00:00Z`** efectivos
4. La comparación queda `< 08:00Z` en vez de `< 04:00Z` → **shift expansivo (+4h), incluye filas extra**

**Cómo se detectó**: los tests originales (escritos según la spec) pasaron en RED sin el fix aplicado. El sub-agente del `sdd-apply` Fase 5 paró, ejecutó queries diagnósticas directas a Postgres, y reveló la dirección real del shift.

### Error 2 — Cardinalidad de scenarios diferenciales (commit `7497abb`)

**Lo que decía la spec original**: 3 scenarios diferenciales (A1-S7, A1-S8, A1-S9) cubren ángulos distintos del bug.

**Realidad geométrica**: solo hay 2 fenómenos físicos distintos:
- **A1-S8**: duplicación cross-page con cursor real (manifestación natural del bug en paginación)
- **A1-S9**: verificación negativa con cursor sintetizado a un instante arbitrario + fila en rango shifted

**Por qué A1-S7 colapsa**: el "rango shifted" es `[cursor, cursor+4h]`. En orden DESC, una fila en ese rango es **más reciente** que el cursor, por lo que **ya fue entregada en una página previa**. El bug se manifiesta como duplicación entre páginas (que es A1-S8), no como "fila extra en página posterior".

**Cómo se detectó**: igual que el error 1 — gate TDD. El sub-agente intentó materializar A1-S7 con un setup específico, ejecutó el primer test, falló en el assertion de página 1 (orden DESC contradictorio), y reportó.

### Recomendación accionable para SDD futuros

**Las specs sobre bugs que dependen de comportamiento específico de un sistema externo (timezone, locale, paginación, sort order, transacciones, locks) deben incluir al menos una query/script empírico de verificación antes de listar scenarios.**

No basta con razonar "Postgres debería hacer X". Verificar con `pnpm tsx -e "..."` o equivalente, capturar el output crudo, y solo entonces redactar los scenarios. El costo de la verificación empírica es ~10 minutos. El costo de re-trabajar specs + tests + commits adicionales después es ~2 horas.

**Considerar agregar este chequeo al template de `sdd-spec` o como gate explícito** cuando el spec involucra alguno de estos tags: `timezone`, `pagination`, `cursor`, `transaction`, `lock`, `index`, `concurrency`.

---

## Aprendizaje #2 — Gate TDD funciona cuando los tests no son ornamentales

### Observación

El gate TDD (RED debe fallar por la razón correcta antes de aplicar el fix) se diseñó como protección contra fixes prematuros. En este SDD funcionó dos veces consecutivas como **detector de problemas en specs**, no en código:

- Primera vez: detectó la dirección incorrecta del shift en la spec
- Segunda vez: detectó la cardinalidad incorrecta de scenarios diferenciales

En ambos casos, sin el gate, el fix se habría aplicado, los tests "pasarían" (porque eran no-diferenciales), y la spec quedaría con descripción incorrecta del bug. Deuda silenciosa para reviewers futuros.

### Costo vs beneficio

- **Costo del gate**: ~30-40 min extra por iteración (re-escribir tests, re-correr, ajustar spec)
- **Beneficio**: spec correcta, tests diferenciales reales, fix con regresión defensiva válida
- **Sin el gate**: deuda silenciosa difícil de detectar después (un reviewer al ver "tests pasan" no investiga si son diferenciales)

### Recomendación

Mantener el gate TDD como invariante en `sdd-apply`, **especialmente para fixes de bugs sutiles donde el comportamiento del sistema no es obvio** (timezone, paginación, race conditions, side effects). En esos casos, el riesgo de "test ornamental que pasa por la razón equivocada" es alto.

Para refactors triviales, fixes evidentes, o features green-field, el gate puede relajarse — pero la decisión debe ser explícita y registrarse en el commit message ("TDD gate skipped because [razón]").

---

## Para incluir en el PR description (T-18)

Versión condensada de los aprendizajes para el PR body:

> ### Aprendizajes del cambio
>
> 1. **Specs de bugs timezone/paginación requieren verificación empírica**. Modelarlos "desde afuera" llevó a 2 errores (shift contractivo vs expansivo, cardinalidad de scenarios) que el gate TDD detectó pero costó re-trabajo. Recomendación para SDDs futuros con tags `timezone`/`pagination`/`cursor`: incluir query empírica antes de redactar scenarios.
>
> 2. **El gate TDD detectó problemas en specs, no en código**. En ambos casos, sin el gate, los tests "pasarían" siendo no-diferenciales y la spec quedaría con descripción incorrecta del bug. Mantener el gate como invariante para fixes de bugs sutiles.

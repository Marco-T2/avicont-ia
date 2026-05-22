# Glosa Enriquecida Ventas+Cobros — CONTINUACIÓN (próxima sesión)

> **Estado**: ✅ COMPLETADO (2026-05-22). Las 7 fases entregadas. Bugs A-G resueltos.
> **Verificación final**: TSC clean · suite 7149/7150 (único fail = α18 sentinel baseline pre-existente) · backfills no-op (data ya canónica: 6/6 AR con `VG`, 0 descripciones a regenerar) · browser checklist §3 Fase 7 confirmado OK por Marco.
> **Baseline commit pre-fix**: `b2b6a717` · **HEAD final**: `4e34871f`.
>
> **Decisión Marco (2026-05-19)**: Push through con simplificación radical. Eliminar `descriptionOverride` flag complejo. Builder = canónico. Notas para info manual del usuario.

---

## 1. Contexto — qué pasó

### Lo que YA funciona

| Componente | Estado |
|---|---|
| Schema `AccountsReceivable.sourceTypeCode` | Columna agregada en migration (PR commits Batch A) |
| Builder `buildSaleGlosa` | Pure function en `modules/sale/domain/sale-glosa-builder.ts` — funcional |
| Builder `buildPaymentGlosa` | Pure function en `modules/payment/domain/payment-glosa-builder.ts` — funcional |
| `formatDateConditional` shared | `modules/accounting/shared/domain/date-format.ts` — funcional |
| Sale.post (draft → posted) wired | Llama builder cuando `descriptionOverride === false` |
| Payment.post / createAndPost wired | Llama builder cuando `descriptionOverride === false` |
| Sale.createAndPost wired (W-1 fix) | Llama builder, mismo gate. Commit `b2b6a717`. |
| Forms con Pencil pattern + override toggle | UI presente pero defectuosa (ver Bugs A-E) |
| Tests builder + service-glosa-wiring | 191/191 GREEN |
| ReceivablesPort.findGlosaMetaTx | Adapter retorna (sourceTypeCode, refNo, sourceDate) |

### Bugs reales detectados por Marco en runtime (no cubiertos por SDD)

#### Bug A — Form preview hardcodea `allocations: []` (deviation D7)

`components/payments/payment-form.tsx:670` literalmente hardcodea allocations vacío:
```ts
const auto = buildPaymentGlosa({
  method, contactName, totalAmount: effectiveTotal,
  allocations: [],   // ← SIEMPRE VACÍO — defer documentado en el comentario
  journalEntryDate: ...,
});
```
Causa: `PendingDocument` DTO no carga (sourceTypeCode, referenceNumber, sourceDate). Marco quiere ver la glosa completa **antes de submit**, no solo en la JE final.

#### Bug B — `VG-` sin número en ventas existentes

Marco: *"vi que en ventas cuando tratas de editar una venta que no tenía código, la glosa no se vuelve a generar"*.
- Builder usa `numbered.referenceNumber` (campo OPCIONAL en form de venta)
- Cuando user crea venta sin código → JE.description = "VENTA: Marco VG- por Bs. ..."
- Después user edita venta y agrega referenceNumber → JE.description NO se regenera con el nuevo dato

Marco confirma que quiere usar `referenceNumber` (no `sequenceNumber`). La fix correcta es **regeneración al editar**, no cambiar la fuente del campo.

#### Bug C — `()` vacío en line concepts

`buildSaleGlosa` recibe `lineConcepts: numbered.details.map(d => d.description)`. Si todos los details tienen `description` vacío (user creó venta rápida sin descripción de líneas), el join produce `()` vacío.

Marco's decisión: **es OK que quede vacío si user no llenó las descripciones** — no es bug del builder, es data input incompleta. Aceptado.

#### Bug D — JE regeneration al editar venta usa passthrough viejo

`modules/sale/application/sale.service.ts:614-616` (en `updatePosted`):
```ts
const journalDescription = edited.notes
  ? `${edited.description} | ${edited.notes}`
  : edited.description;
```
**Ignora completamente el builder.** Cuando user edita venta posteada, la JE regenerada usa user-typed text + notes, NO el builder. Esto explica por qué Bug B persiste aún editando.

#### Bug E — AR.description NO se actualiza al editar venta

En `updatePosted` flow, **no hay** llamada a `receivables.updateDescriptionTx`. El AR queda con la glosa vieja (rota) aunque la JE se regenere correctamente. Por eso Marco ve "VG-" en la lista de "Asignación a Cuentas por Cobrar" del cobro — viene de `AR.description` que no se sincronizó.

#### Bug F — `AR.sourceTypeCode = NULL` en DB local de Marco

Batch A reporte D5:
> *"Direct DB write to apply backfill manually was sandbox-denied; the SQL file remains the contract."*

La migration creó la columna pero el backfill SQL **nunca se ejecutó en la DB local**. Todos los AR existentes tienen `sourceTypeCode = NULL`. Cuando el server intenta rebuildar glosa COBRO, el builder rendea `DOC-` (fallback per design D5) en vez de `VG-`.

#### Bug G — AR.description histórico está roto

Aunque arreglemos todo el flow nuevo, los AR existentes en DB de Marco tienen `description` con "VENTA: Marco VG- por Bs. 100,00 ()" (cuajado al post inicial). Necesitamos **backfill regenerando AR.description usando el builder** sobre todos los Sale y Dispatch ya posteados.

---

## 2. Decisión arquitectural — simplificación radical (Marco lock)

> Marco: *"el espacio de descripcion existe la parte que se genea y depende del usuario puede escribir algo manual, y si volvemos a editar el comprobante, no importa que se borre el dato que escribio el usuario, ya que lo puede volver a hacer o de igual manera tenemos un campo Notas (opcional)... no le metas logica compleja a eso"*

### Implicaciones

1. **Eliminar el flag `descriptionOverride`** completamente del stack:
   - Schema Zod (`createSaleSchema`, `createPaymentSchema`)
   - DTOs (`CreatePaymentInput`)
   - Service options (`PostSaleOptions`, `PostPaymentOptions`)
   - Adapter passthrough
   - Form state + Pencil button + readOnly logic
2. **El builder es canónico siempre** — service rebuilds en TODO post (create, createAndPost, post-from-draft, regenerate-on-edit).
3. **Field "description" en el form** queda como display/preview del builder. Puede editarse libremente, pero al próximo cambio de línea/contacto/total se sobrescribe. Sin guard, sin toggle.
4. **Field "notas"** ya existe en sale-form + payment-form. Esa es la vía oficial para info manual del usuario. Persiste a través de edits.

### Lo que queda eliminado

| Cosa | Por qué se elimina |
|---|---|
| `descriptionOverride: boolean` state en forms | No hay override semántico — builder siempre gana |
| Pencil button toggle (Editar/Auto) | Solo confunde si description siempre es builder output |
| `readOnly={!descriptionOverride}` en Input | Field siempre editable (UX), pero efímero |
| Service `options.descriptionOverride` branch | Reemplazado por "siempre rebuilds via builder" |
| Tests del Pencil pattern | Borrar o re-escribir bajo el nuevo modelo |

### Lo que queda intacto

- Builder puro (`buildSaleGlosa`, `buildPaymentGlosa`) — sin cambios
- `formatDateConditional` shared — sin cambios
- Schema `AccountsReceivable.sourceTypeCode` — sin cambios
- Migration backfill SQL — sin cambios (ya está en el archivo, solo falta correrla)
- `ReceivablesPort.findGlosaMetaTx` — sin cambios
- Pattern de UI auto-rebuild on changes — se simplifica (sin guard)
- "Notas" field — sin cambios

---

## 3. Plan de ejecución — 7 fases

> Ejecutar EN ORDEN. Cada fase es RED→GREEN+commit. No paralelizar (per [[sdd_parallel_subagents_git_commit_hygiene]]).

### Fase 1 — Backfill en DB local (PRIMER PASO antes de cualquier código)

**Objetivo**: poblar `AR.sourceTypeCode` para todos los AR existentes en DB de Marco.

**Comando** (Marco corre esto en su psql/Prisma Studio):
```sql
-- Step 1: sale → "VG"
UPDATE accounts_receivables ar
SET source_type_code = 'VG'
WHERE ar.source_type = 'sale' AND ar.source_type_code IS NULL;

-- Step 2: dispatch → ND/BC via lookup
UPDATE accounts_receivables ar
SET source_type_code = CASE
  WHEN d.dispatch_type = 'NOTA_DESPACHO' THEN 'ND'
  WHEN d.dispatch_type = 'BOLETA_CERRADA' THEN 'BC'
  ELSE NULL
END
FROM dispatches d
WHERE ar.source_type = 'dispatch'
  AND ar.source_id::text = d.id::text
  AND ar.source_type_code IS NULL;

-- Verify: must return 0 rows after backfill (excepting orphans)
SELECT COUNT(*) FROM accounts_receivables WHERE source_type_code IS NULL;
```

**Alternativa** (script Node ejecutable):
- Crear `scripts/backfill-ar-source-type-code.ts` que use prisma directo
- `pnpm tsx scripts/backfill-ar-source-type-code.ts`

**Verificación**:
```sql
SELECT source_type, source_type_code, COUNT(*)
FROM accounts_receivables
GROUP BY source_type, source_type_code;
-- Expected: ("sale", "VG", N1), ("dispatch", "ND", N2), ("dispatch", "BC", N3)
```

### Fase 2 — Extender `PendingDocument` DTO

**Archivos a tocar**:
- `modules/contact-balances/application/contact-balances.service.ts` — interface `PendingDocument` líneas 29-40
- `modules/contact-balances/infrastructure/receivables.adapter.ts` — query que pobla PendingDocument
- `modules/contact-balances/infrastructure/payables.adapter.ts` — paralelo si aplica
- `modules/contact-balances/domain/ports/types.ts` — `PendingDocumentSnapshot` línea 6

**Shape nuevo**:
```ts
export interface PendingDocument {
  id: string;
  type: "receivable" | "payable";
  description: string;
  amount: number;
  paid: number;
  balance: number;
  dueDate: Date;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date;
  // NUEVOS — para form-side buildPaymentGlosa
  sourceTypeCode: string | null;  // "VG" | "ND" | "BC" | null
  referenceNumber: number | null; // del Sale.referenceNumber o Dispatch (TBD si dispatch tiene)
  sourceDate: Date;               // Sale.date o Dispatch.date
}
```

**Adapter query change** (receivables.adapter.ts):
- Join `accounts_receivables` con `sales` (cuando sourceType=sale) y `dispatches` (cuando sourceType=dispatch)
- Select `sale.referenceNumber, sale.date` o `dispatch.referenceNumber, dispatch.date`
- O en su defecto: leer de `ar.sourceTypeCode` (ya backfilleado) + un nuevo query de meta

**Tests**:
- RED: PendingDocument debe incluir sourceTypeCode, referenceNumber, sourceDate
- GREEN: adapter retorna esos campos
- Test scenarios: sale-sourced, dispatch-sourced ND, dispatch-sourced BC, NULL sourceTypeCode (orphan)

### Fase 3 — Form preview con allocations reales

**Archivos**:
- `components/payments/payment-form.tsx` (rebuildDescription)

**Cambio en `rebuildDescription` (líneas 647-693 hoy)**:
```ts
const rebuildDescription = useCallback((overrides?: {...}) => {
  // sin guard
  if (paymentType !== "COBRO") return;
  const effectiveMethod = ...;
  const contactName = ...;
  if (!contactName) { setDescription(""); return; }
  const effectiveTotal = ...;

  // NUEVO — construir allocations array desde state del form
  const selectedAllocations = allocations
    .filter(a => a.amount > 0 && a.receivableId)
    .map(a => {
      const doc = pendingDocuments.find(d => d.id === a.receivableId);
      if (!doc) return null;
      return {
        sourceTypeCode: doc.sourceTypeCode,
        referenceNumber: String(doc.referenceNumber ?? ""),
        sourceDate: doc.sourceDate,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  const auto = buildPaymentGlosa({
    method: effectiveMethod.toUpperCase(),
    contactName,
    totalAmount: effectiveTotal,
    allocations: selectedAllocations,
    journalEntryDate: date ? new Date(date) : new Date(),
  });
  setDescription(auto);
}, [/* dependencies */]);
```

**Trigger expansion**: el `useEffect` debe escuchar también cambios en `allocations` y `pendingDocuments`.

**Tests**:
- RED+GREEN: form preview construye glosa con allocations seleccionadas, no header-only
- Scenarios: 0 allocations (header only), 1 sale allocation (VG-XX del DD/MM), 2 allocations cross-year, NULL sourceTypeCode → DOC fallback
- W-2 deferrals del verify quedan cubiertos por estos tests

### Fase 4 — Eliminar `descriptionOverride` end-to-end (simplificación Marco)

**Archivos a tocar (sequential, atomic commit por archivo):**

1. `modules/sale/presentation/schemas/sale.schemas.ts` — quitar `descriptionOverride: z.boolean().optional()`
2. `modules/payment/presentation/validation.ts` — idem
3. `modules/payment/presentation/dto/payment-input-types.ts` — quitar field de CreatePaymentInput
4. `modules/payment/presentation/payment-service.adapter.ts` — quitar el 4to arg `{ descriptionOverride }` del inner.createAndPost
5. `app/api/organizations/[orgSlug]/sales/route.ts` — quitar la destructuring + el 4to arg
6. `modules/sale/application/sale.service.ts`:
   - Quitar `PostSaleOptions` interface (línea ~86)
   - Quitar 4to arg `options: PostSaleOptions = {}` de `post()` (línea 246) y `createAndPost()` (línea 700)
   - Reemplazar el gate `options.descriptionOverride === false ? buildSaleGlosa(...) : passthrough` con SIEMPRE `buildSaleGlosa(...)`. En 3 lugares: post (línea 325), createAndPost (línea 791), updatePosted (línea 614)
   - Pre-fetch contact en `updatePosted` antes del builder (verificar que `contact` esté disponible — añadir fetch si no)
7. `modules/payment/application/payments.service.ts`:
   - Quitar `PostPaymentOptions` interface
   - Quitar 4to arg en `post` (línea 285) + `createAndPost` (línea 316)
   - Reemplazar el gate `if (opts.descriptionOverride === false && direction === "COBRO")` con SIEMPRE rebuild para COBRO (línea 733 area)
8. `components/sales/sale-form.tsx`:
   - Quitar `useState<boolean> descriptionOverride`
   - Quitar Pencil button (líneas ~1013-1025 hoy)
   - Quitar `readOnly={!descriptionOverride}` del Input
   - Quitar `if (descriptionOverride) return;` guard en rebuildDescription
   - Quitar `descriptionOverride` del submit body
9. `components/payments/payment-form.tsx`:
   - Idem que (8)

**Tests a actualizar/eliminar**:
- `modules/sale/application/__tests__/sale-service-glosa-wiring.test.ts` — refactor todos los tests:
  - Tests "descriptionOverride=false: builder" → ahora simplemente "builder is called" (sin flag)
  - Tests "descriptionOverride=true: passthrough preserved" → ELIMINAR (no más passthrough)
  - Tests "options omitted: legacy passthrough" → ELIMINAR
- `modules/payment/application/__tests__/payments-service-glosa-wiring.test.ts` — idem
- `modules/payment/presentation/__tests__/payment-adapter-description-override.test.ts` — ELIMINAR (no más adapter flag propagation)
- `components/sales/__tests__/sale-form-glosa.test.tsx` — refactor sin Pencil
- `components/payments/__tests__/payment-form-glosa.test.tsx` — idem

### Fase 5 — JE + AR regeneración al editar venta (Bug D + E)

**Archivos**:
- `modules/sale/application/sale.service.ts` — método `updatePosted` (línea ~496)

**Cambio principal** (línea 614-616):
```ts
// ANTES (passthrough)
const journalDescription = edited.notes
  ? `${edited.description} | ${edited.notes}`
  : edited.description;

// DESPUÉS — siempre builder
const journalDescription = buildSaleGlosa({
  contactName: contact.name, // pre-fetch arriba si no está
  referenceNumber: String(edited.referenceNumber ?? ""),
  totalAmount: edited.totalAmount.value,
  lineConcepts: edited.details.map(d => d.description),
  saleDate: edited.date,
});
```

**Pre-fetch contact**: verificar que `contact` esté cargado en `updatePosted` antes del builder call. Si no, agregar fetch al inicio (mismo patrón que `post()` línea 306).

**AR.description update** (después de regenerateForSaleEdit, antes de saveTx):
```ts
if (edited.receivableId) {
  await scope.receivables.updateDescriptionTx(scope.tx, {
    id: edited.receivableId,
    description: journalDescription,
  });
}
```

Esto requiere agregar método `updateDescriptionTx` al `ReceivablePort` o equivalente. Verificar la firma actual del puerto.

**Tests**:
- RED: editar venta posteada → JE.description usa builder, NO passthrough
- RED: editar venta posteada → AR.description se actualiza con la nueva glosa
- GREEN: ambos pasan tras la edit-regen wiring

### Fase 6 — Backfill histórico de AR.description (Bug G)

**Objetivo**: regenerar AR.description usando builder para TODOS los Sale y Dispatch ya posteados.

**Estrategia**: script TSX corrido manualmente, NO migration (no tocar archivos de migration).

**Archivo nuevo**: `scripts/backfill-ar-description.ts`
```ts
// Pseudo:
// 1. Conectar a Prisma
// 2. Para cada AR donde source_type IN ('sale', 'dispatch'):
//    - Si sale: cargar sale + contact → buildSaleGlosa(...) → update AR.description
//    - Si dispatch: cargar dispatch + contact → (decisión: usar la glosa existente del dispatch o construir una nueva — ver §6.1)
// 3. Log resultados (N actualizados, M errores, K orphans)
```

**§6.1 — Decisión open**: para AR de Dispatch, ¿qué glosa va en AR.description?
- Opción 1: la glosa del Dispatch (pattern actual de dispatch-form, peso/kg) — más natural
- Opción 2: una glosa estilo "VENTA" pero usando "ND" o "BC" — para uniformidad
- **Recomendación**: Opción 1. El AR.description debería describir el documento que generó el saldo. Dispatch tiene su propio formato; Sale tiene VENTA: ...

**Commando**:
```bash
pnpm tsx scripts/backfill-ar-description.ts --dry-run  # preview
pnpm tsx scripts/backfill-ar-description.ts            # apply
```

**Verificación**:
- Antes: `SELECT description FROM accounts_receivables LIMIT 10;` → muestra glosas rotas "VENTA: Marco VG- por Bs. ..."
- Después: mismas filas deberían mostrar "VENTA: Marco VG-XX por Bs. XX,XX (...)" o el formato dispatch

### Fase 7 — Verify + Browser test

**Suite**:
- `pnpm vitest run` → todo GREEN (excepto α18 pre-existing)
- `pnpm exec tsc --noEmit` → clean

**Browser test (CRÍTICO — esto faltó en SDD original)**:

| Test | Esperado |
|---|---|
| Crear venta con `referenceNumber=99`, 1 línea "Pollo faenado" Bs.100 + postear | JE.description = `VENTA: <Contacto> VG-99 por Bs. 100,00 (Pollo faenado)` |
| Editar la venta, cambiar referenceNumber a 100, guardar | JE.description regenerada con `VG-100`. AR.description igualmente actualizada |
| Ver el AR en `/contacts/[id]/balance` o en lista de cobros pendientes | Description correcta `VENTA: ... VG-100 por Bs. ...` |
| Crear cobro tipo COBRO EFECTIVO seleccionando 2 ventas | Form preview muestra `COBRO EFECTIVO: <Contacto> Bs. 250,00: VG-99 del DD/MM \| VG-100 del DD/MM` **en tiempo real conforme selecciono allocations** |
| Postear el cobro | JE.description del cobro = mismo string del preview (idempotente) |
| Editar el cobro (cambiar método a TRANSFERENCIA) y guardar | JE regenerada con `COBRO TRANSFERENCIA: ...` |

---

## 4. Verificación final

### Criterios de aceptación (DONE = todos check)

- [ ] Backfill `AR.sourceTypeCode` ejecutado en DB local — query devuelve 0 NULL excepto orphans
- [ ] Backfill histórico `AR.description` ejecutado — ver muestreo manual
- [ ] `descriptionOverride` flag eliminado de TODOS los archivos (`grep -rn "descriptionOverride"` debe retornar 0 matches en `modules/` y `components/` y `app/`)
- [ ] `useEffect`/`useState`/`useCallback` con `descriptionOverride` removidos de los forms
- [ ] Pencil button removido de sale-form + payment-form
- [ ] `buildSaleGlosa` invocado en `sale.service.post`, `sale.service.createAndPost`, `sale.service.updatePosted` (3 sitios)
- [ ] `buildPaymentGlosa` invocado en `payments.service.post` + `payments.service.createAndPost` para COBRO
- [ ] `receivables.updateDescriptionTx` invocado en `updatePosted` tras edit
- [ ] `PendingDocument` DTO carga (sourceTypeCode, referenceNumber, sourceDate)
- [ ] Payment-form `rebuildDescription` usa allocations reales (no `[]`)
- [ ] Browser test "venta sin código + edit con código" → glosa se actualiza visible
- [ ] Browser test "cobro 2 ventas" → form preview muestra VG-XX completo antes de submit
- [ ] Browser test "edit cobro" → JE regenerada
- [ ] Suite: 7146/7147 (alpha18 pre-existing acceptable, otros 0 fail)
- [ ] TSC clean

### Anti-criterios (NO se deben introducir)

- ❌ Lógica condicional basada en flag `descriptionOverride`
- ❌ Tests que asuman passthrough legacy
- ❌ Nuevo helper `formatBsWithPrefix` (usar inline `` `Bs. ${formatBs(n)}` ``)
- ❌ Mock de Prisma.Decimal value-form en domain layer (DEC-1 violation)
- ❌ `pnpm build` post-cambios (regla global)
- ❌ Co-Authored-By en commits (regla global)

---

## 5. Estimación de tiempo

| Fase | Esfuerzo |
|---|---|
| 1 — Backfill DB | 5 min (Marco corre SQL) |
| 2 — Extender PendingDocument DTO | 25-30 min |
| 3 — Form preview con allocations | 20 min |
| 4 — Eliminar `descriptionOverride` | 45-60 min (touch ~10 archivos + actualizar/borrar ~6 tests) |
| 5 — JE+AR regen on edit | 25-30 min |
| 6 — Backfill AR.description script + correr | 30 min |
| 7 — Verify suite + browser | 20 min |
| **Total** | **~3 hs** |

---

## 6. Referencias engram

| Topic | ID | Descripción |
|---|---|---|
| `sdd/glosa-enriquecida-ventas-cobros/proposal` | 2981 | Proposal original |
| `sdd/glosa-enriquecida-ventas-cobros/spec` | 2982 | Spec con REQs |
| `sdd/glosa-enriquecida-ventas-cobros/design` | (~2983) | Design D1-D12 |
| `sdd/glosa-enriquecida-ventas-cobros/tasks` | 2984 | 31 tasks TDD |
| `sdd/glosa-enriquecida-ventas-cobros/apply-progress` | varios | Check-ins Batch A/B/C |
| `sdd/glosa-enriquecida-ventas-cobros/verify-report` | 2986 | W-1/W-2/W-3 warnings |
| `sdd/glosa-enriquecida-ventas-cobros/archive-report` | 2987 | Archive ORIGINAL |
| `sdd/glosa-enriquecida-ventas-cobros/w1-fix` | (recent) | W-1 fix b2b6a717 |
| `sdd/glosa-enriquecida-ventas-cobros/continuation` | (NEW) | Este documento + engram pointer |

---

## 7. Commits hasta acá

```
b2b6a717 fix(glosa): W-1 propagar descriptionOverride end-to-end Sale+Payment createAndPost
93864008 fix(accounting): T-28/T-29 GREEN — guard empty description in JE detail
04696d56 feat(payment): T-27 GREEN — payment-form rebuildDescription + Pencil toggle
2e5beb3c feat(sale-form): T-23/24/25/26 GREEN — sale-form glosa Pencil pattern
f075976c feat(payment): T-21/T-22 GREEN — wire buildPaymentGlosa
250390e3 feat(sale): T-19/T-20 GREEN — wire buildSaleGlosa
b8a4d08d feat(payment-glosa): T-16/T-17/T-18 GREEN — domain builder buildPaymentGlosa
9b0ca56f feat(sale-glosa): T-13/T-14/T-15 GREEN — domain builder buildSaleGlosa
9fc92a6b feat(accounting): T-11/T-12 GREEN — formatDateConditional shared formatter
b64ee584 feat(dispatch): T-09/T-10 GREEN — dispatch.service passes sourceTypeCode ND/BC
503ea541 feat(sale): T-07/T-08 GREEN — sale.service passes sourceTypeCode "VG"
c09a3d83 feat(ar): T-03/T-04/T-05/T-06 GREEN — backfill sourceTypeCode + idempotency
e9e16eb1 feat(ar): T-01/T-02 GREEN — add AccountsReceivable.sourceTypeCode column
```

Si por algún motivo en la próxima sesión decidís cambiar de rumbo y rollback, el comando es:
```bash
git revert --no-edit e9e16eb1..b2b6a717  # 13 commits — confirmar antes
```

---

## 8. Open questions para resolver ANTES de Fase 5

1. **Glosa para AR de Dispatch (§6.1)**: ¿usar glosa Dispatch original o uniformar a formato VENTA-style con ND/BC? **Recomendación documentada**: usar formato Dispatch (pattern actual peso/kg). Confirmar con Marco al arrancar Fase 6.

2. **Pre-fetch de contact en `updatePosted`**: hoy `sale.service.ts:447 applyEdit` recibe edited; ¿el contact ya está cargado por el código existente o hay que agregar fetch? Verificar al inicio de Fase 5.

3. **`receivables.updateDescriptionTx` existencia**: ¿el puerto ya tiene este método o hay que crearlo? Verificar al inicio de Fase 5.

---

**Última actualización**: 2026-05-19 — sesión pre-tesis. Marco lockeó Opción C + simplificación radical descriptionOverride.

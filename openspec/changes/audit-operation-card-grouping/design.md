# Design: Card de Operación en Auditoría

**Change**: `audit-operation-card-grouping`
**Date**: 2026-04-26
**Depends on**: `proposal.md` + `exploration.md` + `specs/audit-module/spec.md` (REQ-AUDIT.11, A11-S1..A11-S5)

## Technical Approach

Refactor UI-only de `components/audit/audit-event-list.tsx` que adopta el patrón **Operation Card** sobre el `AuditGroup[]` que ya entrega `AuditService.listGrouped()`. Se centraliza la heurística "header vs detail" en un helper puro (`isHeaderEvent(entityType)`) en `features/audit/audit.types.ts`, se reutiliza `<AuditDiffViewer>` para la cabecera (único evento con UPDATE genuino), y se computa el resumen agregado de líneas (counters CREATE / DELETE / UPDATE + transición de status) **client-side** a partir del `AuditGroup` existente — sin cambios al contrato HTTP, al servicio, ni al schema. Sin cambios en RSC boundaries: la página `app/(dashboard)/[orgSlug]/audit/page.tsx` sigue siendo Server Component que pasa `initialData` ya serializado al client component.

## Architecture Decisions

### Decision 1 — Helper `isHeaderEvent` location

**Choice**: vive en `features/audit/audit.types.ts` como función pura exportada (sin `server-only`), re-exportada desde `features/audit/index.ts` (barrel client-safe).

**Alternatives considered**:
- (a) Inline en `audit-event-list.tsx` — descartado: viola DRY, no testeable de forma aislada, futuros consumers (sales/purchases) lo redefinirían.
- (c) Nuevo archivo `audit.classifier.ts` extendido — descartado: el classifier existente devuelve `"directa" | "indirecta"`, mezclar dimensiones (clasificación contable vs rol estructural en el grupo) confunde el contrato. Se mantiene clasificación contable en `audit.classifier.ts` y rol estructural en `audit.types.ts`.

**Rationale**: el helper no es lógica de dominio contable — es una proyección estructural sobre el conjunto cerrado `AuditEntityType`. Vive donde vive el tipo. `audit.types.ts` ya tiene la convención "client-safe sin server-only" (comentario explícito en línea 1-3), encaja sin fricción. El re-export desde `index.ts` lo hace importable desde el componente cliente respetando `feature-module-boundaries`.

### Decision 2 — Client-side vs server-side summary

**Choice**: cálculo **client-side** en `audit-event-list.tsx` mediante una función pura `buildGroupSummary(group: AuditGroup): AuditGroupSummary`.

**Alternatives considered**:
- Server-side en `groupByVoucher` — descartado: requiere ampliar el shape de `AuditGroup` (que es público en `index.ts` y consumido también por `getVoucherHistory` indirectamente), y agrega coupling entre `AuditService` y decisiones de presentación.

**Rationale**: el summary es derivable en O(N) sobre `group.events`, que ya está completo en el cliente (límite 50 grupos, ~200 eventos top). Cero cambios al contrato HTTP, cero cambios al spec del repositorio, cero invalidación de los tests del service ya escritos. Mantiene a `AuditGroup` como puro DTO de transporte. Si el día de mañana queremos enviar el summary precomputado, el helper queda como referencia para el server.

### Decision 3 — `AuditGroupSummary` shape

```ts
// features/audit/audit.types.ts (cliente-safe)
export interface AuditGroupSummary {
  /** Evento de cabecera más reciente del grupo, si existe. */
  headerEvent: AuditEvent | null;
  /** Contadores agregados de eventos de detalle. */
  detailCounts: { created: number; updated: number; deleted: number };
  /** Total de eventos de detalle (suma de detailCounts) — atajo para render condicional. */
  detailTotal: number;
  /** Transición de status en la cabecera, si la hubo. null si no aplica. */
  statusTransition: { from: string | null; to: string | null } | null;
  /** Indica si el grupo carece de identidad de comprobante (parentVoucherId vacío/desconocido). */
  isOrphan: boolean;
}
```

**Notas de derivación**:
- `headerEvent`: primer evento (orden DESC) con `isHeaderEvent(ev.entityType) === true`. Si no hay → `null`.
- `detailCounts`: reduce sobre eventos con `isHeaderEvent(ev.entityType) === false`, agrupando por `ev.action`. `STATUS_CHANGE` no se cuenta como detail (solo aplica a cabecera).
- `statusTransition`: derivado del `headerEvent` cuando `action === "STATUS_CHANGE"` o cuando `oldValues.status !== newValues.status`. Lectura directa de los snapshots — sin Decimal, sin formatters.
- `isOrphan`: `!group.parentVoucherId`. Hoy `groupByVoucher` resuelve `parentVoucherId` para todas las entityTypes auditadas (CASE en `audit.repository.ts:65-75`). El flag queda como contrato defensivo para A11-S5.

### Decision 4 — Render pattern (Card composition + AuditDiffViewer)

**Choice**: una sola `<Card>` por grupo (reuso de `@/components/ui/card`), composición declarativa con secciones internas:

```
<Card>
  <CardHeader>
    [ClassificationBadge] [ENTITY_TYPE_LABELS[parentVoucherType]] · #ID
    [right: lastActivityAt formateado · "N eventos"]
    [statusTransition badge si aplica: "Borrador → Contabilizado"]
  </CardHeader>
  <CardContent>
    {headerEvent && (
      <section data-testid="header-section">
        <ActionBadge action={headerEvent.action} />
        <span>{changedBy.name} · {createdAt}</span>
        {expanded && <AuditDiffViewer event={headerEvent} />}
        <button onClick={toggle}>Ver / Ocultar diff</button>
      </section>
    )}
    {detailTotal > 0 && (
      <section data-testid="detail-section">
        Líneas: {created > 0 && `${created} creadas`} · {deleted > 0 && `${deleted} eliminadas`} · {updated > 0 && `${updated} modificadas`}
      </section>
    )}
    {!isOrphan && <Link href={detailUrl}>Ver comprobante →</Link>}
  </CardContent>
</Card>
```

`AuditDiffViewer` se pasa como **prop child renderizado condicionalmente**, no como prop. Mantiene el contrato actual del viewer (`event: AuditEvent`) intacto. La transición de status se renderiza como **badge de texto reusando `ClassificationBadge`** (no inventamos un nuevo componente: usamos badges con clases ya definidas y la tabla `STATUS_BADGE` que vive privada en `audit-diff-viewer.tsx` — se promueve a export del módulo o se duplica en una constante compartida; preferencia: extraer `STATUS_BADGE_LABELS` a `audit.types.ts` como const exportada).

**Rationale**: reuso máximo de UI primitives ya validados (`Card`, `Badge`, `AuditDiffViewer`, `ActionBadge`). Cero componentes nuevos no triviales. La expansión del diff sigue el patrón actual de `expanded[key]` ya presente en el componente.

### Decision 5 — Orphan event fallback

**Choice**: card minimalista sin CTA cuando `isOrphan === true`. Se renderiza con `headerEvent` o (si no hay header) con el primer evento del grupo, sin sección de líneas y sin link al detail.

**Rationale**: el spec A11-S5 requiere render no-crash + ausencia de CTA. La heurística es defensiva: hoy todas las entityTypes auditadas resuelven `parentVoucherId`, pero futuras entidades (`fiscal_periods`, etc.) podrían entrar al pipeline sin parent resolver. El fallback evita que un mismatch de schema rompa la UI y deja un placeholder informativo.

### Decision 6 — CTA URL mapping

**Choice**: helper `getVoucherDetailUrl(orgSlug, parentVoucherType, parentVoucherId)` en `features/audit/audit.types.ts` (cliente-safe), retorna `string | null`.

```ts
export function getVoucherDetailUrl(
  orgSlug: string,
  parentVoucherType: AuditEntityType,
  parentVoucherId: string,
): string | null {
  switch (parentVoucherType) {
    case "journal_entries": return `/${orgSlug}/accounting/journal/${parentVoucherId}`;
    case "sales":           return `/${orgSlug}/sales/${parentVoucherId}`;
    case "purchases":       return `/${orgSlug}/purchases/${parentVoucherId}`;
    case "payments":        return `/${orgSlug}/payments/${parentVoucherId}`;
    case "dispatches":      return `/${orgSlug}/dispatches/${parentVoucherId}`;
    // detail types (sale_details, purchase_details, journal_lines) NO deberían
    // aparecer como parentVoucherType — el repository ya las mapea a su padre.
    // Si llegase una, retornamos null (defensivo).
    case "sale_details":
    case "purchase_details":
    case "journal_lines":
      return null;
    default: {
      const _exhaustive: never = parentVoucherType;
      return null;
    }
  }
}
```

**Rationale**: rutas verificadas en `app/(dashboard)/[orgSlug]/{sales,purchases,payments,dispatches,accounting/journal}/[id]/page.tsx`. El helper centraliza el mapping para que sea testeable y para que A11-S4 tenga un único punto de actualización si cambia el routing.

### Decision 7 — Testing strategy

| Layer | What | File | Approach |
|-------|------|------|----------|
| Unit | `isHeaderEvent` | `features/audit/__tests__/audit-types-helpers.test.ts` (NEW) | Vitest puro, fixture por cada `AuditEntityType`, asserción binaria. |
| Unit | `buildGroupSummary` | `features/audit/__tests__/audit-types-helpers.test.ts` | Fixtures: grupo solo cabecera, solo detail, mixto, orphan, con STATUS_CHANGE. Asserts sobre shape de `AuditGroupSummary`. |
| Unit | `getVoucherDetailUrl` | `features/audit/__tests__/audit-types-helpers.test.ts` | Tabla por entityType. Asserts sobre URL retornada. |
| RTL | `AuditEventList` | `components/audit/__tests__/audit-event-list.test.tsx` (NEW) | `@testing-library/react` con `cleanup()` afterEach, igual que el test ya existente de `audit-diff-viewer`. Cubre A11-S1..A11-S5. |

**Mapeo scenario → test**:
- A11-S1 → RTL: render de un grupo `journal_entries` con 1 header UPDATE + 3 lines DELETE/CREATE → `screen.getAllByRole('article')` o `getAllByTestId('audit-card')` debe ser length 1.
- A11-S2 → RTL: header section visible con `AuditDiffViewer` invocable, detail section visible con counters.
- A11-S3 → RTL: grupo con 2 DELETE + 3 CREATE de `journal_lines` → texto "2 líneas eliminadas · 3 líneas creadas" presente; `queryAllByTestId('detail-event-row')` length 0.
- A11-S4 → RTL: link `/[orgSlug]/accounting/journal/{id}` presente sin expandir.
- A11-S5 → RTL: grupo orphan (`parentVoucherId === ""` o ad-hoc) → no crash, no CTA `Ver comprobante`.

**Comando**: `pnpm vitest run`. Sin cambios al runner ni al setup.

### Decision 8 — Module boundary preservation

**Choice**: helper `isHeaderEvent`, tipo `AuditGroupSummary`, helper `buildGroupSummary` y helper `getVoucherDetailUrl` viven en `features/audit/audit.types.ts` (sin `server-only`) y se exportan desde `features/audit/index.ts` (barrel client-safe).

`features/audit/server.ts` NO recibe nuevos exports. Cero cambios a `audit.service.ts`, `audit.repository.ts`, `audit.validation.ts` y `audit.classifier.ts`. El test `feature-boundaries.test.ts` existente sigue pasando porque ningún símbolo termina en `Repository` ni `Service` y porque ningún `$queryRaw` aparece fuera del repositorio.

**Validación**: `pnpm vitest run features/audit/__tests__/feature-boundaries.test.ts` post-refactor.

## Data Flow

```
┌────────────────────────────────────────────────────────────────────┐
│ Server (sin cambios)                                               │
│                                                                    │
│ AuditRepository.listFlat()                                         │
│   ↓ (SQL: CTE audit_with_parent + LEFT JOIN journal_entries)       │
│ AuditService.listGrouped()                                         │
│   ↓ classify() + groupByVoucher() + resolveUserNames()             │
│ → { groups: AuditGroup[], nextCursor }                             │
└────────────────────────────────────────────────────────────────────┘
                          │ JSON.stringify (Date → ISO string en page.tsx)
                          ▼
┌────────────────────────────────────────────────────────────────────┐
│ Client — components/audit/audit-event-list.tsx                     │
│                                                                    │
│ initialData.groups.map(group => {                                  │
│   const summary = buildGroupSummary(group);   // ← NUEVO           │
│   return <OperationCard group={group} summary={summary} … />;      │
│ })                                                                 │
│                                                                    │
│ OperationCard:                                                     │
│   ├─ Header: ENTITY_TYPE_LABELS, ClassificationBadge, lastActivity │
│   ├─ Header section: ActionBadge + AuditDiffViewer (toggle)        │
│   ├─ Detail section: counters de detailCounts                      │
│   └─ CTA: getVoucherDetailUrl(orgSlug, type, id) si !isOrphan      │
└────────────────────────────────────────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `components/audit/audit-event-list.tsx` | Modify | Refactor del map: una `<Card>` por grupo con header section + detail counters + CTA. Reusa `AuditDiffViewer`, `ActionBadge`, `ClassificationBadge`. Elimina render plano de `visible.map`. |
| `features/audit/audit.types.ts` | Modify | Agrega `isHeaderEvent`, `buildGroupSummary`, `getVoucherDetailUrl`, tipo `AuditGroupSummary`, const `STATUS_BADGE_LABELS` (extraída desde `audit-diff-viewer.tsx`). Sin `server-only`. |
| `features/audit/index.ts` | Modify | Re-export de los 3 helpers + tipo + const. Confirma client-safety. |
| `components/audit/audit-diff-viewer.tsx` | Modify (small) | Reemplaza `STATUS_BADGE` local por import desde `@/features/audit`. Sin cambio de comportamiento. |
| `components/audit/__tests__/audit-event-list.test.tsx` | New | Suite RTL: A11-S1..A11-S5. Mocks: `next/navigation` (`useRouter`) + `next/link`. |
| `features/audit/__tests__/audit-types-helpers.test.ts` | New | Tests unit puros para `isHeaderEvent`, `buildGroupSummary`, `getVoucherDetailUrl`. |

**Sin cambios**: `features/audit/audit.service.ts`, `features/audit/audit.repository.ts`, `features/audit/audit.classifier.ts`, `features/audit/audit.validation.ts`, `features/audit/server.ts`, `app/(dashboard)/[orgSlug]/audit/page.tsx`.

## Interfaces / Contracts

```ts
// features/audit/audit.types.ts (additions, client-safe)

const HEADER_ENTITY_TYPES = new Set<AuditEntityType>([
  "journal_entries", "sales", "purchases", "payments", "dispatches",
]);

export function isHeaderEvent(entityType: AuditEntityType): boolean {
  return HEADER_ENTITY_TYPES.has(entityType);
}

export interface AuditGroupSummary {
  headerEvent: AuditEvent | null;
  detailCounts: { created: number; updated: number; deleted: number };
  detailTotal: number;
  statusTransition: { from: string | null; to: string | null } | null;
  isOrphan: boolean;
}

export function buildGroupSummary(group: AuditGroup): AuditGroupSummary;

export function getVoucherDetailUrl(
  orgSlug: string,
  parentVoucherType: AuditEntityType,
  parentVoucherId: string,
): string | null;

export const STATUS_BADGE_LABELS: Record<string, string>;
```

## Testing Strategy

| Layer | What to Test | File | Tooling |
|-------|--------------|------|---------|
| Unit | `isHeaderEvent` exhaustivo por entityType | `features/audit/__tests__/audit-types-helpers.test.ts` | vitest |
| Unit | `buildGroupSummary` — solo header / solo detail / mixto / con STATUS_CHANGE / orphan | idem | vitest |
| Unit | `getVoucherDetailUrl` — 5 vouchers + 3 detail types defensivos | idem | vitest |
| RTL | `AuditEventList` cubriendo A11-S1..A11-S5 | `components/audit/__tests__/audit-event-list.test.tsx` | @testing-library/react + jsdom |
| Boundary | re-validar que `feature-boundaries.test.ts` sigue verde | (existente) | vitest |

Comando único: `pnpm vitest run`. Cobertura mínima: 5/5 scenarios del spec REQ-AUDIT.11 mapean a ≥1 test RTL.

## Migration / Rollout

No requiere migración. Cambio UI-only sin tocar schema, triggers, RBAC, ni APIs. Deploy estándar (build + restart). Rollback: `git revert` del/los commits del refactor — la data en `audit_logs` y el contrato HTTP permanecen intactos durante todo el ciclo.

## Open Questions

None. Todos los open questions del exploration y del proposal están resueltos en las 8 decisiones de arriba.

# Tasks: Card de Operación en Auditoría

## Convención de commits

- Conventional commits, scope `audit`, sin `Co-Authored-By`.
- 1 commit por fase (Phase 1..Phase 3).
- Después de cada commit: `pnpm exec tsc --noEmit` + `pnpm vitest run`.

---

## Phase 1: Foundation — types & helpers

Archivos afectados: `features/audit/audit.types.ts`, `features/audit/index.ts`, `components/audit/audit-diff-viewer.tsx`, `features/audit/__tests__/audit-types-helpers.test.ts`.

- [x] 1.1 **RED**: crear `features/audit/__tests__/audit-types-helpers.test.ts` con tests para `isHeaderEvent`:
  - 5 tests afirmativos: `journal_entries`, `sales`, `purchases`, `payments`, `dispatches` → `true`.
  - 3 tests negativos: `journal_lines`, `sale_details`, `purchase_details` → `false`.
  - Failure mode esperado: `ImportError` — "The requested module … does not provide an export named 'isHeaderEvent'" porque la función todavía no existe en `audit.types.ts`.

- [x] 1.2 **GREEN**: implementar `isHeaderEvent(entityType: AuditEntityType): boolean` en `features/audit/audit.types.ts` usando `HEADER_ENTITY_TYPES = new Set([...])`. Re-exportar desde `features/audit/index.ts`. Todos los tests de 1.1 deben pasar.

- [x] 1.3 **RED**: agregar tests para `buildGroupSummary` en el mismo archivo:
  - Fixture A — solo cabecera `journal_entries / UPDATE` → `headerEvent != null`, `detailTotal === 0`, `isOrphan === false`.
  - Fixture B — solo 3 `journal_lines / CREATE` → `headerEvent === null`, `detailCounts.created === 3`, `detailTotal === 3`.
  - Fixture C — mix: 1 cabecera UPDATE + 2 DELETE + 3 CREATE de `journal_lines` → `detailCounts.deleted === 2`, `detailCounts.created === 3`, `detailTotal === 5`.
  - Fixture D — grupo vacío (`events: []`) → `headerEvent === null`, `detailTotal === 0`, `isOrphan === true` (sin `parentVoucherId`).
  - Failure mode esperado: `ImportError` — "does not provide an export named 'buildGroupSummary'".

- [x] 1.4 **GREEN**: implementar `buildGroupSummary(group: AuditGroup): AuditGroupSummary` + tipo `AuditGroupSummary` en `features/audit/audit.types.ts` según el shape del design (Decision 3). Re-exportar desde `features/audit/index.ts`. Todos los tests de 1.3 deben pasar.

- [x] 1.5 **RED**: agregar tests para `getVoucherDetailUrl` en el mismo archivo:
  - 5 tests de voucher types: `journal_entries` → `/org/accounting/journal/id`, `sales` → `/org/sales/id`, `purchases` → `/org/purchases/id`, `payments` → `/org/payments/id`, `dispatches` → `/org/dispatches/id`.
  - 3 tests defensivos: `journal_lines`, `sale_details`, `purchase_details` → `null`.
  - Failure mode esperado: `ImportError` — "does not provide an export named 'getVoucherDetailUrl'".

- [x] 1.6 **GREEN**: implementar `getVoucherDetailUrl(orgSlug, parentVoucherType, parentVoucherId): string | null` en `features/audit/audit.types.ts` con el switch exhaustivo del design (Decision 6). Re-exportar desde `features/audit/index.ts`. Todos los tests de 1.5 deben pasar.

- [x] 1.7 **REFACTOR**: extraer `STATUS_BADGE_LABELS` como `export const` en `features/audit/audit.types.ts` (proviene de `STATUS_BADGE` privada en `audit-diff-viewer.tsx`). Actualizar `components/audit/audit-diff-viewer.tsx` para importarla desde `@/features/audit`. Re-exportar desde `features/audit/index.ts`. Sin cambio de comportamiento — los tests existentes de `audit-diff-viewer` deben seguir verdes.

Commit de cierre de Phase 1: `feat(audit): agregar helpers y tipos para operation card`

---

## Phase 2: RTL test suite — RED (A11-S1..A11-S5)

Archivo afectado: `components/audit/__tests__/audit-event-list.test.tsx` (nuevo).

- [x] 2.1 **RED**: crear `components/audit/__tests__/audit-event-list.test.tsx` con 5 tests mapeados a A11-S1..A11-S5. Mocks necesarios: `next/navigation` (`useRouter`), `next/link` (passthroughs). Fixture compartido: `AuditGroup` de tipo `journal_entries` con 1 evento `UPDATE` de cabecera + 3 eventos `journal_lines` (2 `DELETE` + 1 `CREATE`).

  - **test S1** (A11-S1): `getAllByRole('article')` length === 1 (no 4 ítems separados).
    Failure mode esperado: `TestingLibraryElementError` — "Unable to find role: article" porque el componente actual renderiza filas planas sin `<article>`.

  - **test S2** (A11-S2): `getByTestId('header-section')` presente; `queryByTestId('detail-section')` presente. Fixture: grupo `sales / UPDATE` + 2 `sale_details / CREATE`.
    Failure mode esperado: `TestingLibraryElementError` — "Unable to find an element by: [data-testid="header-section"]".

  - **test S3** (A11-S3): texto que coincide con `/2.*eliminadas/i` y `/1.*creada/i` presente; `queryAllByTestId('detail-event-row')` length === 0. Fixture: 2 `journal_lines / DELETE` + 1 `journal_lines / CREATE`.
    Failure mode esperado: `TestingLibraryElementError` — "Unable to find an element with the text: /2.*eliminadas/i".

  - **test S4** (A11-S4): `getByRole('link', { name: /ver.*comprobante/i })` con `href` que contiene `/accounting/journal/je_001`. Fixture: `parentVoucherId = 'je_001'`, `parentVoucherType = 'journal_entries'`, `orgSlug = 'org'`.
    Failure mode esperado: `TestingLibraryElementError` — "Unable to find an accessible element with the role "link" and name matching /ver.*comprobante/i".

  - **test S5** (A11-S5): fixture `parentVoucherId = undefined`. Render no lanza error; `queryByRole('link', { name: /ver.*comprobante/i })` === null.
    Failure mode esperado: el componente actual probablemente lanza `TypeError` al intentar construir la URL con `parentVoucherId` indefinido, o renderiza el link igualmente — el test fallará porque el comportamiento actual no cumple ninguna de las dos aserciones a la vez.

Commit de cierre de Phase 2: `test(audit): RED suite operation card render (A11-S1..S5)`

---

## Phase 3: Component refactor — GREEN

Archivos afectados: `components/audit/audit-event-list.tsx`.

- [x] 3.1 **GREEN**: refactorizar `components/audit/audit-event-list.tsx`:
  - Reemplazar el map plano actual por un map sobre `AuditGroup[]` donde cada grupo renderiza una `<Card>` (de `@/components/ui/card`) con `role="article"`.
  - Usar `buildGroupSummary` para derivar `AuditGroupSummary` por grupo.
  - Sección `data-testid="header-section"`: mostrar `ActionBadge`, nombre de usuario, fecha, y `<AuditDiffViewer>` con toggle de expansión (patrón `expanded[key]` ya existente).
  - Sección `data-testid="detail-section"` (solo si `detailTotal > 0`): contadores en texto `"{N} creadas · {N} eliminadas · {N} modificadas"` sin renderizar filas atómicas de detail. Sin `data-testid="detail-event-row"`.
  - CTA `<Link>` con texto "Ver comprobante" y `href = getVoucherDetailUrl(orgSlug, type, id)` — solo si `!isOrphan`.
  - Fallback orphan (A11-S5): card minimalista sin CTA; usar primer evento del grupo si no hay `headerEvent`.
  - Todos los 5 tests RTL de Phase 2 deben pasar.

- [x] 3.2 **Smoke manual** (no automatizado): `pnpm dev`, navegar a `/[orgSlug]/audit`, modificar un asiento contable con líneas y validar render visual de la card con header diff + contador de líneas + link al comprobante. _(Pendiente verificación visual del usuario — sub-agente no puede levantar dev server interactivo.)_

Commit de cierre de Phase 3: `feat(audit): renderizar grupos de auditoría como operation card`

---

## Phase 4: Spec archive prep

- [x] 4.1 Confirmar que `openspec/changes/audit-operation-card-grouping/specs/audit-module/spec.md` está listo (cerrado, sin TODOs). No requiere edición — quedó escrito en la fase spec. Solo verificación visual.

_(Sin commit para esta fase.)_

---

## Phase 5: Validation gates

- [x] 5.1 `pnpm exec tsc --noEmit` retorna exit 0 (cero errores de tipos). Verificado en check-ins de Phases 1, 2 y 3.
- [x] 5.2 `pnpm vitest run features/audit components/audit` retorna verde (83/83 passing en check-in de Phase 3).
- [ ] 5.3 Smoke manual en `/audit` confirmado (ver 3.2). **Pendiente verificación visual del usuario** — el sub-agente no puede levantar dev server interactivo.
- [ ] 5.4 Si todo verde → handoff a `sdd-verify` (orquestador pausa y confirma con el usuario).

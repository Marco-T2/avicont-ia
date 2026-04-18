# Proposal: accounting-rbac

## Intent

Refinar el framework RBAC existente (hoy `Role × Resource` de 4 roles × 7 recursos gruesos) para soportar 5 roles y granularidad por módulo contable. Necesidad operativa: distintos perfiles del equipo contable (Contador, Cobrador, Auxiliar) requieren acceso diferenciado a sales / purchases / payments / journal / dispatches / reports. Requisito funcional declarado del sistema contable boliviano.

## Scope

### In Scope
- Agregar roles `cobrador` y `auxiliar` a `Role` type + `assignableRoles` Zod enum
- Splitear recurso `accounting` en sub-recursos por módulo: `sales`, `purchases`, `payments`, `journal`, `dispatches`, `reports` (6 nuevos)
- Encoding read/write: elegir entre (a) maps separados `PERMISSIONS_READ`/`PERMISSIONS_WRITE` o (b) recursos duplicados. Decisión en design.
- Reescribir matriz `PERMISSIONS` (5 roles × ~12 recursos)
- Sweep de ~74 route files: migrar `requireRole([...])` → `requirePermission(resource, orgSlug)` donde aún no está
- Componente `<Gated resource action>` para gatear botones de acción (Editar/Anular/Contabilizar) en forms + detail views
- Members admin UI: role picker con los 5 roles asignables
- Tests: 2-3 representativos por rol + unit test completo de matriz PERMISSIONS

### Out of Scope
- Refactor a action-level permissions (`sale:create`, `sale:void`) — pospuesto
- Reemplazar `member` por `auxiliar` (coexisten — member queda como fallback legacy)
- Onboarding/invitation flow de Clerk (default role al invitar)
- Audit log de cambios de rol
- Permisos sobre entidades individuales (RBAC a nivel objeto)

## Capabilities

### New Capabilities
- `rbac-roles`: definición de roles (owner, admin, contador, cobrador, auxiliar, member) y su asignación per-org
- `rbac-permissions-matrix`: matriz Role × Resource × (read|write) como fuente de verdad de autorización
- `rbac-ui-gating`: componente `<Gated>` y hook `useCanAccess` para ocultar/deshabilitar acciones en UI

### Modified Capabilities
- None (no existen specs previas de auth/rbac en `openspec/specs/`)

## Approach

Extender framework existente (no reescribir). Scoping resource granularity primero, después matriz, después sweep API + UI en paralelo. Strict TDD por PR. Mantener `requirePermission` como punto único de enforcement server-side.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `features/shared/permissions.ts` | Modified | Role type + Resource type + PERMISSIONS matrix |
| `features/shared/middleware.ts` | Modified | `requireRole` deprecation path |
| `features/organizations/members.validation.ts` | Modified | `assignableRoles` extendido |
| `components/common/use-org-role.ts` | Modified | widen MemberRole |
| `components/common/gated.tsx` | New | wrapper `<Gated>` + `useCanAccess` hook |
| `app/api/organizations/[orgSlug]/**/route.ts` | Modified (~74) | sweep a `requirePermission` |
| `components/{sales,purchases,payments,journal,dispatches}/**` | Modified | gatear botones de acción |
| `app/(dashboard)/[orgSlug]/settings/members/**` | Modified | role picker expandido |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Drift durante sweep de 74 rutas | High | Checklist por módulo + grep CI para detectar `requireRole` remanente |
| Regresión UI (botones ocultos que deberían estar visibles) | Med | Matrix test por rol en forms críticos + QA manual por rol |
| Rows `"member"` legacy tras cambio | Low | Coexisten; ningún backfill destructivo |
| Test matrix explosion | Med | 1 unit test completo de matriz + 2-3 integration por rol |

## Rollback Plan

Revert commits por PR (6 PRs planeados). El framework viejo (`requireRole`) sigue funcionando durante la migración — cada PR es independientemente reversible. Matriz vieja en permissions.ts hasta que el sweep esté 100%. DB no se toca (role es `String`, no enum).

## Dependencies

- Clerk como auth provider (sin cambios)
- `VoucherTypeCfg`, `Sale`, `Purchase`, etc. sin cambios de schema

## Success Criteria

- [ ] 5 roles asignables vía UI de members
- [ ] Zero usos de `requireRole([...])` en `app/api/` (todos migrados a `requirePermission`)
- [ ] Cobrador puede aplicar payments pero no crear JE manual (verificado E2E)
- [ ] Auxiliar puede crear draft de sale/purchase pero no post (verificado E2E)
- [ ] Unit test de matriz PERMISSIONS cubre 5 roles × todos los recursos
- [ ] tsc clean + suite completa verde

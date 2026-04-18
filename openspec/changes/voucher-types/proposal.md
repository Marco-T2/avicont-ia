# Proposal: Voucher Types — CRUD + numeración independiente + seed

## Intent

Hoy `VoucherTypeCode` es un **enum de Prisma** (`CI, CE, CD, CT, CA`) — agregar un tipo nuevo requiere migración + deploy. El contador no puede dar de alta "Nómina" o "Depreciación" desde la app. La **API expone GET y PATCH**, pero el POST y la UI de alta no existen (la pantalla dice "Próximamente"). La numeración SÍ es independiente por voucher-type + período (vía `@@unique([organizationId, voucherTypeId, periodId, number])` y `getNextNumber()`), pero el lector de `getNextNumber` usa `findFirst+orderBy desc` sin lock y es vulnerable a race-condition en concurrencia. El display existente (`formatCorrelativeNumber`) emite `D2604-000015`, no un `CI-0042` amigable; decidiremos en design si mantener o permitir override.

## Scope

### In Scope
- CRUD admin de `VoucherTypeCfg`: list, create, edit, soft-deactivate (`isActive=false`)
- Migrar `code` de enum Prisma a `String` (o tabla catálogo) para permitir alta dinámica
- Endurecer `getNextNumber()` contra concurrencia (transacción + serialización)
- Seed expandido con tipos estándar boliviano faltantes: **CN (Comprobante de Nómina)** y **CM (Comprobante de Depreciación/Amortización)**. Evaluar en design si agregar CB (Bancario).
- Mantener display `formatCorrelativeNumber` y extender para soportar tipos nuevos; decidir en design si además se expone un formato corto `{CODE}-{N}`

### Out of Scope (deliberate)
- Permisos RBAC por voucher type → cambio futuro
- Listado de asientos filtrado por voucher type + estadísticas → no prioritario (filtro básico ya existe)
- Re-numeración de asientos históricos → los asientos preservan su número original

## Capabilities

### New Capabilities
- `voucher-type-management`: CRUD + soft-deactivation
- `voucher-type-sequence`: numeración independiente segura en concurrencia + display formateado

### Modified Capabilities
- Ninguna spec previa registrada en `openspec/specs/` (no existe el directorio aún)

## Approach

Reutilizar el patrón CRUD de `/accounting/periods` y `/accounting/accounts` (page.tsx flat + service + repository ya establecidos). Migrar `VoucherTypeCode` enum → `String` en schema (o tabla catálogo) preservando los códigos existentes. Agregar POST en la API + formulario React para crear/editar. Endurecer `getNextNumber` con `SELECT FOR UPDATE` dentro de transacción o usando el `@@unique` constraint con retry. Extender seed con CN y CM. Tipos inactivos quedan ocultos en los `Select` de creación de asientos pero siguen visibles en los asientos ya existentes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | `code` enum → String; posible validación en service |
| `prisma/seeds/voucher-types.ts` | Modified | Agregar CN, CM |
| `features/voucher-types/*` | Modified | `create()` method + validación de código único |
| `features/accounting/journal.repository.ts` | Modified | `getNextNumber` safe-concurrency |
| `features/accounting/correlative.utils.ts` | Modified | Map de prefijos dinámico o ampliado para CN/CM |
| `app/(dashboard)/[orgSlug]/accounting/voucher-types/page.tsx` | Modified | Reemplazar placeholder por CRUD real |
| `app/api/organizations/[orgSlug]/voucher-types/route.ts` | Modified | Agregar POST |
| `components/accounting/voucher-type-*` | New | list + form |
| `components/accounting/journal-entry-form.tsx` | Modified | Filtrar `isActive=true` en dropdown de creación |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Race condition en `getNextNumber` genera números duplicados | High | Transacción + SELECT FOR UPDATE o retry sobre `@@unique` constraint |
| Migración enum → String rompe tipos generados | Med | Migración con DEFAULT + cast; actualizar imports de `VoucherTypeCode` |
| Prefijos de `formatCorrelativeNumber` no contempla códigos nuevos | Med | Hacer el map configurable o derivar prefijo desde `code` (primera letra después de "C") |
| Soft-deactivate de un tipo con asientos asociados | Low | Deactivate NO borra; asientos históricos siguen visibles |

## Rollback Plan

Migración de schema reversible (revert enum + drop columna string). La UI nueva se oculta detrás de feature flag o se elimina la ruta. El seed nuevo (CN, CM) se revierte con `down migration`. Asientos creados con nuevos tipos post-deploy mantienen su número — no intentar rollback destructivo sobre datos.

## Dependencies

Ninguna externa. Depende del patrón CRUD ya establecido (`/accounting/accounts`, `/accounting/periods`).

## Success Criteria

- [ ] Contador puede crear un nuevo VoucherType desde UI sin deploy
- [ ] Contador puede editar nombre/descripción y desactivar un VoucherType existente
- [ ] Cada voucher type mantiene numeración independiente por período (ya existente, ahora a prueba de concurrencia)
- [ ] Asientos muestran código formateado en list + detail (incluye CN y CM)
- [ ] Seed incluye CN y CM
- [ ] Tipos inactivos no aparecen en dropdowns de creación pero sí en asientos históricos
- [ ] Zero regresión en asientos existentes; tests de numeración pasan bajo concurrencia simulada

## Open Questions for Design

1. ¿Migrar `VoucherTypeCode` enum a `String`, o mantener enum + tabla alias para tipos custom?
2. ¿Formato corto `{CODE}-{N}` adicional al `{prefix}{YYMM}-{NNNNNN}` actual, o solo extender el existente?
3. ¿Incluir CB (Bancario) en seed además de CN y CM?
4. ¿SELECT FOR UPDATE vs retry sobre unique constraint para concurrencia?

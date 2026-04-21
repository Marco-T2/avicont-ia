# Proposal: Balance Inicial

## Intent

Contadores necesitan emitir el **Balance Inicial** (Bolivian legal report) derivado exclusivamente del Comprobante de Apertura (CA) de la organización. Hoy el catálogo lo lista como `planned` sin ruta. El reporte debe renderizarse en UI, exportarse en PDF (formato legal) y XLSX, y respetar aislamiento multi-tenant y RBAC.

## Scope

### In Scope
- `initial-balance` feature folder (repo, builder, service, 2 exporters, validation, barrels, tests)
- API route `GET /api/organizations/[orgSlug]/initial-balance?format=json|pdf|xlsx`
- Page `/accounting/initial-balance` (server RBAC gate + client orchestrator + view)
- Catalog flip en `features/reports/catalog.ts` a `status: "available"`
- Empty-state UX cuando no existe CA

### Out of Scope
- Enmiendas/correcciones al CA existente
- Reconciliación entre múltiples CA (solo se agregan)
- Caching/snapshots del reporte

## Capabilities

### New Capabilities
- `initial-balance-report`: domain types, repository (CA date + CA-line aggregation), builder (subtype grouping + invariant), service (RBAC + orchestration), PDF/XLSX exporters (Bolivian legal layout), API route, UI page & view.

### Modified Capabilities
- None. `voucher-type-seed` already guarantees CA existe (REQ-D.1 S5 no aplica pero CA está en la tabla de 11 tipos).

## Approach

Approach B (dedicated folder), mirror del patrón `features/accounting/equity-statement/`. Builder consume *solo* líneas del CA (filtro `vt.code = 'CA'`), agrupa por `AccountSubtype`, calcula subtotales y asserta invariante `Activo = Pasivo + Patrimonio`; si falla setea flag `imbalanced` (banner tipo EEPN v2). PDF exporter custom (pdfmake A4 portrait, encabezado legal + firmas). XLSX exporter paridad (ExcelJS, misma estructura).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `features/accounting/initial-balance/` | New | repo, builder, service, validation, exporters, barrels, tests |
| `app/api/organizations/[orgSlug]/initial-balance/route.ts` | New | GET handler json/pdf/xlsx |
| `app/(dashboard)/[orgSlug]/accounting/initial-balance/page.tsx` | New | RBAC gate + client |
| `components/accounting/initial-balance-page-client.tsx` | New | Fetch + export orchestration |
| `components/accounting/initial-balance-view.tsx` | New | Presentational two-section view |
| `features/reports/catalog.ts` | Modified | `initial-balance` → `status: "available"`, `route: "/accounting/initial-balance"` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `orgId` missing en query raw → fuga multi-tenant | CRITICAL | Todo `$queryRaw` incluye `je."organizationId" = ${orgId}`; tests por tenant aislado |
| No CA registrado → reporte inexistente | High | Service lanza `NotFoundError`; UI empty-state con CTA a registrar CA |
| RBAC gate ausente | High | `requirePermission("reports","read",orgSlug)`; roles `owner/admin/contador` |
| Múltiples CA en la org | Medium | Builder suma todas las líneas POSTED CA; warning opcional si `count > 1` |
| Invariante Activo = Pasivo + Patrimonio no se cumple (corrupción) | Medium | Builder asserta y setea `imbalanced` + delta; banner en UI |
| CA editable post-emisión | Low | Recalculo en vivo, sin caché |

## Rollback Plan

Cambio puramente aditivo. Rollback = revertir commits del feature y volver `catalog.ts` a `status: "planned"`, `route: null`. Sin migraciones de DB, sin feature flag.

## Dependencies

- CA voucher seed garantizado por `openspec/specs/voucher-type-seed/` (REQ-D.1).
- Patrón precedente: `features/accounting/equity-statement/` (repo + builder + service + exporters).
- Util compartido: `features/accounting/account-subtype.utils.ts#formatSubtypeLabel`.

## Success Criteria

- [ ] Catálogo muestra `Balance Inicial` como `available` con ruta válida
- [ ] `/accounting/initial-balance` renderiza con layout de dos secciones y totales correctos
- [ ] PDF cumple formato legal boliviano (encabezado org + NIT + representante + dirección; título; secciones con subtotales; firmas)
- [ ] XLSX tiene paridad de datos con PDF
- [ ] Invariante Activo = Pasivo + Patrimonio verificada; flag `imbalanced` surface banner si falla
- [ ] RBAC bloquea roles no autorizados (401/403)
- [ ] Empty-state claro cuando no existe CA
- [ ] Todas las queries filtran por `orgId`; tests multi-tenant pasan

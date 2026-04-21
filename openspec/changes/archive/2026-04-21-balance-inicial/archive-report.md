# Archive Report: balance-inicial

**Archived**: 2026-04-21
**Verdict**: PASS (from verify-report)

## Specs Synced

| Capability | Action | Details |
|-----------|--------|---------|
| initial-balance-report | Created | NEW capability. Full spec: REQ-1 through REQ-11 (11 requirements, 19 scenarios) |

## Archive Contents

- proposal.md
- specs/initial-balance-report/spec.md
- design.md
- tasks.md (25/25 complete)
- exploration.md
- verify-report.md
- archive-report.md (this file)

## Implementation Commits

- `feat(initial-balance): add domain types` — T02
- `feat(initial-balance): add repository with CA aggregation and org metadata` — T04
- `feat(initial-balance): add builder with subtype grouping and invariant` — T09
- `feat(initial-balance): add service with RBAC and error handling` — T12
- `feat(initial-balance): add PDF exporter with A4 portrait layout` — T14
- `feat(initial-balance): add XLSX exporter with numeric formatting` — T16
- `feat(initial-balance): add page + route handler + RBAC wiring` — T19
- `feat(initial-balance): add view + client orchestrator` — T21
- `chore(initial-balance): flip catalog entry to available` — T23

## File Tree: Feature Folder

```
features/accounting/initial-balance/
├── initial-balance.types.ts              (domain types)
├── initial-balance.repository.ts          (CA query, org metadata, CA count)
├── initial-balance.builder.ts             (subtype grouping, invariant)
├── initial-balance.service.ts             (RBAC + orchestration)
├── initial-balance.validation.ts          (Zod query schema)
├── exporters/
│   ├── initial-balance-pdf.exporter.ts   (pdfmake A4 portrait)
│   ├── initial-balance-xlsx.exporter.ts  (ExcelJS)
│   └── __tests__/
│       ├── initial-balance-pdf.exporter.test.ts
│       └── initial-balance-xlsx.exporter.test.ts
├── server.ts                              (barrel for server imports)
├── index.ts                               (barrel for client imports)
└── __tests__/
    ├── initial-balance.types.test.ts
    ├── initial-balance.repository.test.ts
    ├── initial-balance.builder.test.ts
    └── initial-balance.service.test.ts
```

## File Tree: App Routes & Components

```
app/api/organizations/[orgSlug]/initial-balance/
├── route.ts                               (GET handler, format dispatch)
└── __tests__/
    └── route.test.ts

app/(dashboard)/[orgSlug]/accounting/initial-balance/
├── page.tsx                               (server page + RBAC gate)
└── __tests__/
    └── page-rbac.test.ts

components/accounting/
├── initial-balance-view.tsx               (presentational sections)
├── initial-balance-page-client.tsx        (fetch + export orchestration)
└── __tests__/
    ├── initial-balance-view.test.tsx
    └── initial-balance-page-client.test.tsx
```

## Implementation Summary

### Types
- `InitialBalanceRow`: account code, name, signed-net amount (Decimal)
- `InitialBalanceGroup`: subtype label, rows, subtotal
- `InitialBalanceSection`: ACTIVO or PASIVO_PATRIMONIO, groups, section total
- `InitialBalanceStatement`: sections, invariant flags (imbalanced, imbalanceDelta), multi-CA flags (multipleCA, caCount)
- `BuildInitialBalanceInput`: repo outputs + CA count

### Repository
- `getInitialBalanceFromCA(orgId)`: $queryRaw with signed-net (DEUDORA: debit−credit, ACREEDORA: credit−debit), CA-type filter, POSTED status, org isolation
- `countCAVouchers(orgId)`: count distinct CA vouchers per org
- `getOrgMetadata(orgId)`: razonSocial, NIT, representanteLegal, dirección

### Builder
- Groups rows by AccountSubtype (CURRENT, NON_CURRENT, DISPONIBLE_INMEDIATO, CAPITAL_SOCIAL, UTILIDADES_GANANCIAS, etc.)
- Computes subtotals per group and section totals
- Checks invariant: ACTIVO total === PASIVO total + PATRIMONIO total
- Sets `imbalanced` flag and `imbalanceDelta` (in Bs.) if invariant fails
- Sets `multipleCA` flag if `caCount > 1`

### Service
- `generate(orgId, role)`: calls `requirePermission("reports", "read", orgSlug)` before proceeding
- Runs `Promise.all([getInitialBalanceFromCA, getOrgMetadata, findAccountsWithSubtype, countCAVouchers])`
- Calls builder with all inputs
- Raises `NotFoundError` if no CA exists (caCount === 0)

### PDF Exporter
- pdfmake A4 portrait (595 pt × 842 pt)
- Org header: razón social, NIT, representante legal, dirección
- Title: `BALANCE INICIAL — Al {fecha CA ISO}`
- Subtitle: `(Expresado en Bolivianos)`
- Two sections: ACTIVO, PASIVO Y PATRIMONIO (each with subtype subsections and subtotals)
- Signature footer: Contador, Propietario lines
- Number formatting: es-BO locale, thousands separator, 2 decimals
- Negative amounts in parentheses

### XLSX Exporter
- ExcelJS workbook, single sheet "Balance Inicial"
- A4 portrait page setup (for printability parity)
- Same data structure as PDF: sections, subtype groups, subtotals, totals
- `numFmt: '#,##0.00'` applied to amount cells for Bolivian locale rendering

### API Route
- `GET /api/organizations/[orgSlug]/initial-balance?format=json|pdf|xlsx`
- Dispatches format param: json → JSON response, pdf → PDF buffer, xlsx → XLSX buffer
- Uses `initialBalanceValidation` (Zod) to validate query params
- Returns 400 on invalid format
- Returns 404 if service throws `NotFoundError`
- Returns 403 if `requirePermission` fails
- Sets correct `Content-Type` and `Content-Disposition` headers

### Page
- Server page at `/accounting/initial-balance`
- Calls `requirePermission("reports", "read", orgSlug)` — redirects on failure
- Renders `InitialBalancePageClient` (marked as `"use client"`)

### Client Orchestrator
- Fetches JSON via `GET /api/organizations/[orgSlug]/initial-balance?format=json`
- Renders `InitialBalanceView` with fetched data
- "Export PDF" button fetches `?format=pdf` and triggers `blob.download()`
- "Export XLSX" button fetches `?format=xlsx` and triggers `blob.download()`

### View Component
- Renders two sections: ACTIVO (left column), PASIVO Y PATRIMONIO (right column) — optional two-column layout
- Each section shows groups with subtype labels and per-subtype subtotals
- Row items show account code, name, signed-net amount (formatted es-BO)
- Alerts:
  - **Imbalance banner**: "⚠️ El Balance Inicial no está balanceado. Diferencia: {delta} Bs." (shown if `imbalanced: true`)
  - **Multiple CA warning**: "⚠️ Esta organización tiene {caCount} comprobantes de apertura. El reporte agrega todos." (shown if `multipleCA: true`)
- Amount formatting:
  - Positive: `1234.56` → `1.234,56` (es-BO)
  - Negative: `-1234.56` → `(1.234,56)` (parentheses, not minus sign)
  - Zero in detail row: empty string
  - Zero in total row: `0,00`

### Catalog
- Updated `features/reports/catalog.ts` entry:
  - `id: "initial-balance"`
  - `status: "available"` (was `"planned"`)
  - `route: "/accounting/initial-balance"` (was `null`)
  - `category: "estados-financieros"`

## Test Results

- **2416/2416 tests passing** (full suite including all phases)
- **0 new TypeScript errors** in changed sources (7 pre-existing errors in unrelated modules: voucher-pdf and worksheet-pdf exporters)
- **Strict TDD**: All 25 tasks follow RED → GREEN discipline

## Known Opportunities

1. **`fmtDecimal` helper duplication**: Both PDF exporters (`voucher-pdf` and `initial-balance-pdf`) have similar `fmtDecimal` functions for es-BO formatting. Should extract to a shared utility in `features/accounting/number-formatters/` or similar. NOT a blocker for this change.

## Engram Observation IDs (Traceability)

- proposal: 893
- design: 895
- spec: 894
- exploration: 892
- tasks: (in openspec filesystem only)
- verify-report: (in openspec filesystem only)
- archive-report: (this file — saved to engram post-archive)

## Source of Truth Updated

- Created: `openspec/specs/initial-balance-report/spec.md` (NEW capability, not modifying existing)

## SDD Cycle Complete

Ready for the next change.

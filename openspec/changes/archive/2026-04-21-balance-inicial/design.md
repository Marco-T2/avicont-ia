# Design: Balance Inicial

## Technical Approach

Replicate the `features/accounting/equity-statement/` pattern (repo → builder → service → PDF+XLSX exporters → API route → server page + client orchestrator + view) but produce a **point-in-time snapshot** sourced exclusively from POSTED `CA` (Comprobante de Apertura) voucher lines. Repo runs signed-net raw SQL aggregation by account; builder groups by `AccountSubtype` into two sections (ACTIVO vs PASIVO+PATRIMONIO), computes totals, and asserts the invariant. Service orchestrates, enforces RBAC, and raises `NotFoundError` when no CA exists. Exporters follow Bolivian legal layout (single column, A4 portrait).

## Architecture Decisions

| # | Option | Tradeoff | Decision |
|---|--------|----------|----------|
| 1 | **Query strategy**: `$queryRaw` vs Prisma findMany + aggregation in JS | Raw SQL: precise signed-net math in-DB, fewer rows on the wire, mirrors `getAperturaPatrimonyDelta`. Prisma: safer but N+1 and JS-side sign flipping. | **Raw SQL** — reuse CA delta pattern, group by accountId, return Map<accountId, Decimal>. |
| 2 | **Subtype grouping** in repo SQL vs builder | Repo: denormalized rows per subtype. Builder: keeps repo thin, lets builder join with account catalog. | **Builder** — repo stays aggregate-by-account; builder merges catalog + balances and groups by `AccountSubtype` (matches `balance-sheet.builder.ts`). |
| 3 | **Invariant check location** | Builder (pure, testable) vs service (side-effectful) vs view (late). | **Builder** — compute `imbalanced` + `imbalanceDelta`; surface flags through types; view renders banner. |
| 4 | **Multiple CA entries** in org | Fail, take latest, or aggregate. | **Aggregate all** POSTED CA lines in `$queryRaw`; expose `multipleCA: boolean` + `caCount` so UI can warn (repo counts `DISTINCT je.id`). |
| 5 | **Empty state (no CA)** — who raises | Repo empty Map, builder throws, service throws. | **Service** — `NotFoundError` is a business-flow concern, not data-shape; builder stays pure; API route maps to 404. |
| 6 | **Decimal representation** | `number` vs `Decimal` vs serialized string. | **Domain `Prisma.Decimal`**, serialized as strings at JSON boundary via `serializeStatement` — identical to equity-statement. |
| 7 | **PDF library** | pdfmake vs puppeteer. | **pdfmake** — already used by equity-statement and trial-balance; fonts registered in `financial-statements/exporters/pdf.fonts.ts`. |
| 8 | **Page size / orientation** | A4 landscape (EEPN) vs A4 portrait. | **A4 portrait** — Bolivian legal balance-inicial is a two-column vertical layout (ACTIVO left, PASIVO+PATRIMONIO right OR stacked sections). Single subtotal column per section fits portrait naturally. |
| 9 | **API route pattern** | Server action vs route handler. | **Route handler** `GET /api/organizations/[orgSlug]/initial-balance` — consistent with equity-statement, supports `?format=json\|pdf\|xlsx`, `runtime = "nodejs"`. |

## Data Flow

```
UI click ──→ /accounting/initial-balance (server page, RBAC gate)
                  │
                  ▼
          InitialBalancePageClient (fetch)
                  │
                  ▼
     GET /api/organizations/[orgSlug]/initial-balance?format=…
                  │
                  ▼
      InitialBalanceService.generate(orgId, role)
             │            │
     requirePermission    │
                          ▼
        Promise.all([
          repo.getAperturaBalances(orgId),      // $queryRaw CA signed-net per accountId
          repo.findAccountsWithSubtype(orgId),  // catalog
          repo.countCAEntries(orgId),           // multiple-CA warning
          repo.getOrgMetadata(orgId),           // header
        ])
                          │
                          ▼
        buildInitialBalance({ balances, accounts, caCount })
         → group by AccountSubtype → sections → subtotals
         → invariant: |Σ ACTIVO − Σ (PASIVO+PATRIMONIO)| ≤ 0
         → { sections, imbalanced, imbalanceDelta, multipleCA }
                          │
                          ▼
         service injects orgId → InitialBalance domain
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
     serializeStatement  exportPdf     exportXlsx
        (JSON)           (Buffer)       (Buffer)
                          │
                          ▼
                    Response to UI
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `features/accounting/initial-balance/initial-balance.types.ts` | Create | Domain + serialized types, builder input |
| `features/accounting/initial-balance/initial-balance.repository.ts` | Create | CA signed-net `$queryRaw`, account catalog, orgMetadata, CA count |
| `features/accounting/initial-balance/initial-balance.builder.ts` | Create | Group-by-subtype, section totals, invariant flag |
| `features/accounting/initial-balance/initial-balance.service.ts` | Create | RBAC, Promise.all orchestration, `NotFoundError` when no CA |
| `features/accounting/initial-balance/initial-balance.validation.ts` | Create | Zod schema for `?format=json\|pdf\|xlsx` |
| `features/accounting/initial-balance/exporters/initial-balance-pdf.exporter.ts` | Create | pdfmake A4 portrait Bolivian legal layout |
| `features/accounting/initial-balance/exporters/initial-balance-xlsx.exporter.ts` | Create | ExcelJS parity, sheet name `"Balance Inicial"` |
| `features/accounting/initial-balance/server.ts` | Create | Barrel re-exporting repo + service (server-only) |
| `features/accounting/initial-balance/index.ts` | Create | Client-safe barrel (types only) |
| `features/accounting/initial-balance/__tests__/initial-balance.repository.test.ts` | Create | Integration: seeded CA, multi-tenant isolation |
| `features/accounting/initial-balance/__tests__/initial-balance.builder.test.ts` | Create | Pure fixtures: grouping, invariant, imbalance |
| `features/accounting/initial-balance/__tests__/initial-balance.service.test.ts` | Create | NotFoundError, multiple-CA warning, RBAC |
| `features/accounting/initial-balance/__tests__/exporters.test.ts` | Create | PDF file signature, XLSX sheet name + numFmt |
| `app/api/organizations/[orgSlug]/initial-balance/route.ts` | Create | GET handler, `runtime = "nodejs"`, format switch |
| `app/api/organizations/[orgSlug]/initial-balance/__tests__/route.test.ts` | Create | RBAC 401/403, 404 when no CA, format matrix |
| `app/(dashboard)/[orgSlug]/accounting/initial-balance/page.tsx` | Create | Server RBAC gate + client orchestrator mount |
| `app/(dashboard)/[orgSlug]/accounting/initial-balance/__tests__/page-rbac.test.ts` | Create | Redirect unauthorized roles |
| `components/accounting/initial-balance-page-client.tsx` | Create | Fetch + export buttons + empty/imbalanced banners |
| `components/accounting/initial-balance-view.tsx` | Create | Presentational: two sections, totals, imbalance banner |
| `components/accounting/__tests__/initial-balance-view.test.tsx` | Create | Render sections, empty, imbalanced, multipleCA |
| `features/reports/catalog.ts` | Modify | `initial-balance` → `status: "available"`, `route: "/accounting/initial-balance"` |
| `features/reports/__tests__/catalog.test.ts` | Modify | Bump available count, add route assertion |

## Interfaces / Contracts

```ts
// initial-balance.types.ts
import type { Prisma } from "@/generated/prisma/client";
import type { AccountSubtype } from "@/generated/prisma/enums";
export type Decimal = Prisma.Decimal;

export type InitialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  amount: Decimal;                 // signed-net from CA lines
};

export type InitialBalanceGroup = {
  subtype: AccountSubtype;         // e.g. ACTIVO_CORRIENTE
  label: string;                   // formatSubtypeLabel(subtype)
  rows: InitialBalanceRow[];
  subtotal: Decimal;
};

export type InitialBalanceSection = {
  key: "ACTIVO" | "PASIVO_PATRIMONIO";
  label: string;                   // "Activo" | "Pasivo y Patrimonio"
  groups: InitialBalanceGroup[];
  sectionTotal: Decimal;
};

export type InitialBalanceStatement = {
  orgId: string;
  dateAt: Date;                    // min(je.date) of POSTED CA entries
  sections: [InitialBalanceSection, InitialBalanceSection]; // [ACTIVO, PASIVO_PATRIMONIO]
  imbalanced: boolean;
  imbalanceDelta: Decimal;         // |ACTIVO − (PASIVO+PATRIMONIO)|
  multipleCA: boolean;
  caCount: number;
};

export type BuildInitialBalanceInput = {
  balances: Map<string, Decimal>;  // accountId → signed-net from CA
  accounts: AccountMetadata[];     // reuse from financial-statements.types
  dateAt: Date;
  caCount: number;
};

// Serialized (JSON) variant: Decimals → string, Date → ISO string. Mirrors SerializedEquityStatement.
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit (builder) | Subtype grouping, section subtotals, `imbalanced` + `imbalanceDelta`, `multipleCA` | Pure fixtures (no DB) |
| Unit (service) | RBAC forbidden, `NotFoundError` on empty balances, inject `orgId` | Mocked repo |
| Integration (repo) | Signed-net per `AccountNature`, orgId isolation, aggregation of N CA entries | Vitest + existing test-db pattern |
| Unit (exporters) | PDF `%PDF-` signature + A4 portrait, XLSX sheet name `"Balance Inicial"` + numFmt `#,##0.00;(#,##0.00)` | Smoke assertions on buffer |
| Route | 401/403 by role, 404 when no CA, json/pdf/xlsx content-type | Vitest + mocked service |
| Page RBAC | Redirect when `requirePermission` throws | Mocked permission |
| Catalog | `initial-balance.status === "available"`, route match, available count bumps | Existing catalog test file |

## Migration / Rollout

Pure additive. No DB migrations, no feature flag. Rollback = revert commits and flip `features/reports/catalog.ts` entry back to `status: "planned"`, `route: null`.

## Open Questions

None.

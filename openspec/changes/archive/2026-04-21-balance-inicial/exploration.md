# Exploration: Balance Inicial

**Change**: `balance-inicial`
**Date**: 2026-04-21
**Status**: Ready for Proposal

---

## Current State

### Existing reports in the accounting module

| Report | Feature folder | Route | Pattern |
|--------|---------------|-------|---------|
| Balance General | `features/accounting/financial-statements/` | `/accounting/financial-statements/balance-sheet` | repo + builder + service + exporters (PDF/XLSX) + API route + UI client |
| Estado de Resultados | same folder as Balance General | `/accounting/financial-statements/income-statement` | shares repo/service with Balance General |
| Estado de Evolución del Patrimonio | `features/accounting/equity-statement/` | `/accounting/equity-statement` | own repo + builder + service + own PDF/XLSX exporters + API route + UI client |
| Balance de Comprobación de Sumas y Saldos | `features/accounting/trial-balance/` | `/accounting/trial-balance` | own pattern |
| Hoja de Trabajo | `features/accounting/worksheet/` | `/accounting/worksheet` | own pattern |

### How CA vouchers are queried today

`EquityStatementRepository.getAperturaPatrimonyDelta()` (introduced in the `2026-04-21-apertura-patrimony-baseline` change) is the canonical example of CA-aware querying:

```sql
SELECT jl."accountId" AS account_id,
  SUM(CASE
    WHEN a.nature = 'DEUDORA'   THEN jl.debit - jl.credit
    WHEN a.nature = 'ACREEDORA' THEN jl.credit - jl.debit
  END)::text AS net
FROM journal_lines   jl
JOIN journal_entries je ON je.id  = jl."journalEntryId"
JOIN accounts        a  ON a.id   = jl."accountId"
JOIN voucher_types   vt ON vt.id  = je."voucherTypeId"
WHERE
  je."organizationId" = ${orgId}
  AND je.status       = 'POSTED'
  AND je.date        >= ${dateFrom}
  AND je.date        <= ${dateTo}
  AND vt.code         = 'CA'
  AND a.type          = 'PATRIMONIO'
GROUP BY jl."accountId"
HAVING SUM(...) <> 0
```

For the Balance Inicial, the query is more general: it must cover ALL account types (ACTIVO, PASIVO, PATRIMONIO), not only PATRIMONIO, and must be scoped to ALL journal lines of the CA voucher — not a date range, but specifically `vt.code = 'CA'` entries (there is one CA per org, corresponding to the Comprobante de Apertura).

### How PDF/XLSX exporters are structured

Two patterns exist:

1. **financial-statements pattern**: abstract `ExportSheet` shape (`statement-shape.ts`) built by `sheet.builder.ts`, rendered generically by `pdf.exporter.ts` and `excel.exporter.ts`. Portrait / LETTER. Reusable for multi-column layouts.

2. **equity-statement pattern**: self-contained exporters (`equity-statement-pdf.exporter.ts`, `equity-statement-xlsx.exporter.ts`) with specific layout for the wide EEPN matrix (A4 landscape). No shared abstract shape.

The Balance Inicial PDF has a mandated Bolivian legal layout: portrait A4, header block (org name, NIT, representante legal, address), title "BALANCE INICIAL — Al {fecha CA}", subtitle "(Expresado en Bolivianos)", two sections (ACTIVO / PASIVO Y PATRIMONIO) with per-subtype groups and totals, footer with signature lines (contador + propietario/representante). This layout diverges enough from the QuickBooks-style balance-sheet exporter that a dedicated exporter is warranted.

### Account subtype grouping

`AccountSubtype` enum values relevant to the Balance Inicial:

- **ACTIVO**: `ACTIVO_CORRIENTE`, `ACTIVO_NO_CORRIENTE`
- **PASIVO**: `PASIVO_CORRIENTE`, `PASIVO_NO_CORRIENTE`
- **PATRIMONIO**: `PATRIMONIO_CAPITAL`, `PATRIMONIO_RESULTADOS`

Labels come from `features/accounting/account-subtype.utils.ts` → `formatSubtypeLabel()`. The same function is reusable.

### Catalog entry (existing)

In `features/reports/catalog.ts`:
```ts
{
  id: "initial-balance",
  title: "Balance Inicial",
  description: "Estado de apertura al inicio del ejercicio contable.",
  category: "para-mi-contador",
  status: "planned",
  route: null,
  icon: "FlagTriangleRight",
}
```

The route needs to change to `"/accounting/initial-balance"` and status to `"available"` once the feature is live.

---

## Affected Areas

### New files to create

| Path | Purpose |
|------|---------|
| `features/accounting/initial-balance/initial-balance.types.ts` | Domain types: `InitialBalance`, `BuildInitialBalanceInput`, serialized variants |
| `features/accounting/initial-balance/initial-balance.repository.ts` | `getCAVoucherDate()` (finds the CA entry date), `getCAJournalLines()` (all lines of CA entries), `findAccountsWithSubtype()` (delegate or duplicate from FS repo) |
| `features/accounting/initial-balance/initial-balance.builder.ts` | Pure builder: takes CA lines + account metadata → `InitialBalance` structure |
| `features/accounting/initial-balance/initial-balance.service.ts` | RBAC gate + orchestration: find CA date → aggregate lines → build → return |
| `features/accounting/initial-balance/initial-balance.validation.ts` | Zod schema for API query (format only — no date params, the CA date is derived internally) |
| `features/accounting/initial-balance/exporters/initial-balance-pdf.exporter.ts` | Custom pdfmake exporter: header block + sections + signature footer (A4 portrait) |
| `features/accounting/initial-balance/exporters/initial-balance-xlsx.exporter.ts` | ExcelJS exporter: header rows + two sections + totals |
| `features/accounting/initial-balance/index.ts` | Public barrel (types only — no server-only imports) |
| `features/accounting/initial-balance/server.ts` | Server-only barrel |
| `features/accounting/initial-balance/__tests__/` | Test suite |
| `features/accounting/initial-balance/exporters/__tests__/` | Exporter smoke tests |
| `app/(dashboard)/[orgSlug]/accounting/initial-balance/page.tsx` | Server component: RBAC gate + `<InitialBalancePageClient>` |
| `app/api/organizations/[orgSlug]/initial-balance/route.ts` | GET handler: JSON/PDF/XLSX dispatch |
| `components/accounting/initial-balance-page-client.tsx` | Client orchestrator: fetch → view → export buttons |
| `components/accounting/initial-balance-view.tsx` | Presentational view (two-section table) |

### Files to modify

| Path | Change |
|------|--------|
| `features/reports/catalog.ts` | `status: "available"`, `route: "/accounting/initial-balance"` for `id: "initial-balance"` |

---

## Approaches

### Approach A — Reuse `FinancialStatementsRepository.aggregateJournalLinesUpTo()` with `date = CA_date` parameter

Pass the CA date as `asOfDate` to the existing balance-sheet pipeline. `aggregateJournalLinesUpTo(orgId, caDate)` returns all POSTED lines up to that date, then `buildBalanceSheet()` produces the familiar `BalanceSheetCurrent` shape.

- **Pros**: Near-zero new data code; reuses tested balance-sheet builder and exporters.
- **Cons**: Semantically wrong — Balance Inicial is NOT "all lines up to the CA date"; it is ONLY the lines of the CA voucher itself. Using cumulative history contaminates it with pre-CA entries (e.g. a company that changed fiscal year). The PDF layout also diverges significantly from the QuickBooks-style balance-sheet (requires signatures block, different header, Bolivian legal format). The existing PDF exporter cannot accommodate signatures without invasive changes.
- **Effort**: Low initially, but high correction cost later.

### Approach B — New dedicated feature folder `features/accounting/initial-balance/` (RECOMMENDED)

New repo/builder/service/exporters mirroring the equity-statement pattern. The repository adds two specific methods:
1. `getCAVoucherDate(orgId)` — finds the date of the POSTED CA journal entry (joins `voucher_types` on `code = 'CA'`).
2. `getCAAccountBalances(orgId)` — aggregates ALL journal lines of POSTED CA entries grouped by accountId, returning signed-net balance per account (same sign convention as balance-sheet builder).

The builder is essentially `buildBalanceSheet` but receiving ONLY the CA-derived balances, with no `retainedEarningsOfPeriod` (CA is a point-in-time snapshot with no income statement).

- **Pros**: Semantically pure; the CA voucher is the ONLY data source (no date-range ambiguity). Clean separation — future changes to the regular balance-sheet don't affect the Balance Inicial. The dedicated exporter can implement the Bolivian legal layout (signatures, specific header) without coupling to the QuickBooks-style exporter.
- **Cons**: More files to create. Builder logic partially overlaps with `buildBalanceSheet`.
- **Effort**: Medium (~12-15 files, but each is small and follows a clear pattern).

### Approach C — New feature that delegates data to `FinancialStatementsRepository` but has its own builder and exporters

The service calls `fsRepo.aggregateJournalLinesUpTo(orgId, caDate)` BUT additionally filters to only the CA voucher lines (via a WHERE on `vt.code = 'CA'`). New repo method, reuses FS account metadata query.

- **Pros**: Shares `findAccountsWithSubtype` logic, correct CA-only scoping.
- **Cons**: Creates cross-feature dependency (`initial-balance` imports from `financial-statements`). The equity-statement already takes this cross-import approach (imports `FinancialStatementsRepository`, `buildIncomeStatement`, `calculateRetainedEarnings`) — it is documented as a technical debt risk. Adding another cross-import perpetuates this pattern.
- **Effort**: Medium. Slightly less code than B.

---

## Recommendation

**Approach B — New dedicated feature folder**, with one pragmatic allowance: the builder may import `formatSubtypeLabel` from `features/accounting/account-subtype.utils.ts` (shared utility, not a cross-feature import) and may reuse `Prisma.Decimal` math utilities from `features/accounting/financial-statements/money.utils.ts` if extracted to a shared accounting utils location, or inline equivalents.

**Rationale**:
1. The Balance Inicial is semantically defined by the CA voucher, not a date range. Using `aggregateJournalLinesUpTo` would require an extra filter that doesn't exist on the current repository method — making Approach A/C create a new method anyway.
2. The Bolivian legal PDF format (header with NIT/representante legal/address, signature block at the bottom) is incompatible with the QuickBooks-style exporter. A dedicated exporter is required regardless of approach.
3. The equity-statement precedent shows that cross-feature imports (Approach C) lead to tight coupling warnings in comments (`// Reutilización de FS — fuente única de verdad del Resultado del Ejercicio`). Balance Inicial has no logical dependency on the income statement — the CA voucher is self-contained.
4. Approach B yields a folder with a clear screaming-architecture identity: `initial-balance/` contains everything needed to understand and maintain the report.

**Recommended route**: `/accounting/initial-balance`
(Consistent with `equity-statement` which lives at `/accounting/equity-statement`, NOT under `/accounting/financial-statements/`)

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **No CA registered** — org has no CA voucher yet | HIGH — the report cannot be generated | Service returns a domain error (`NotFoundError("Comprobante de Apertura no encontrado")`) before any computation. UI must render a clear empty state with guidance. |
| **Multiple CA entries** — org created more than one CA voucher | MEDIUM — legally there should be only one, but the DB does not enforce uniqueness at DB level | Repository query should aggregate ALL POSTED CA lines (HAVING `count(*) > 0`); optionally warn in the response if more than one CA entry exists. The builder must handle it gracefully (sum all CA lines — consistent with how the equity-statement handles the apertura baseline). |
| **Editable CA date** — CA voucher date can be modified after the Balance Inicial is generated | LOW — report is always computed live (no snapshot caching) | No special mitigation needed; next request recomputes. Document in the spec that this report is always "on-the-fly". |
| **Multi-tenant scoping** | CRITICAL — must filter by `orgId` on every query | Every `$queryRaw` must include `je."organizationId" = ${orgId}`. `BaseRepository.requireOrg()` enforces the ORM scope; the raw queries need it explicitly. |
| **RBAC gate missing** | HIGH | Service gates on `ALLOWED_ROLES: ["owner", "admin", "contador"]` same as other financial reports. |
| **CA entries with income/expense accounts** | LOW | If someone incorrectly records income/expense accounts in the CA voucher, they will appear in ACTIVO/PASIVO/PATRIMONIO grouping with `subtype = null` and be dropped by the builder (same behavior as balance-sheet). Document as known limitation. |
| **Zero-balance accounts** | LOW | Follow balance-sheet convention: omit accounts with balance = 0 from output groups. |

---

## Ready for Proposal

**Yes** — all inputs are available. No clarifications needed.

The proposal should define:
1. The SQL query shape for `getCAAccountBalances` (ALL accounts, not just PATRIMONIO).
2. The `InitialBalance` type structure (same shape as `BalanceSheetCurrent` minus `retainedEarningsOfPeriod` and `imbalanced`/`imbalanceDelta`).
3. The PDF layout spec (header fields, section structure, signature block).
4. The API contract (`GET /api/organizations/[orgSlug]/initial-balance?format=json|pdf|xlsx`).
5. The UI pattern (no date picker — date is derived from the CA; show CA date in the report header).

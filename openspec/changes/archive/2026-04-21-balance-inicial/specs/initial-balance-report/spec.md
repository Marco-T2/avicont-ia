# Initial Balance Report Specification

## Purpose

Allows accountants to generate the **Balance Inicial** — a Bolivian legal opening-balance report derived exclusively from the organization's Comprobante de Apertura (CA) voucher. The system renders it in UI, exports it as PDF (legal layout) or XLSX, enforces multi-tenant isolation, and gates access via RBAC.

## Requirements

### Requirement: Build from CA Voucher Data (REQ-1)

The system MUST build the report by aggregating all journal-entry lines from CA-type vouchers posted for the organization, grouped first by AccountType (ACTIVO vs. PASIVO+PATRIMONIO) and then by AccountSubtype.

#### Scenario: Single CA voucher exists

- GIVEN an organization has exactly one CA voucher with posted lines
- WHEN the report is requested
- THEN all account balances as of the CA date are returned, grouped by AccountType then AccountSubtype

#### Scenario: Multiple CA vouchers exist

- GIVEN an organization has more than one CA voucher
- WHEN the report is requested
- THEN all CA-posted lines are aggregated and a warning flag (`multipleCA: true`) is raised

---

### Requirement: Error When No CA Exists (REQ-2)

The system MUST raise a `NotFoundError` when no CA voucher exists for the organization, and the UI MUST display an empty state with a call-to-action to register the CA.

#### Scenario: No CA voucher

- GIVEN an organization has no CA voucher
- WHEN the report is requested
- THEN the service raises `NotFoundError` and the UI renders an empty-state page with a CTA

---

### Requirement: Multi-Tenant Isolation (REQ-3)

Every raw SQL query MUST include an explicit `je."organizationId" = ${orgId}` filter. Data from other organizations MUST NOT appear in the report.

#### Scenario: Isolated query per org

- GIVEN organizations A and B with separate CA vouchers
- WHEN org A requests the report
- THEN only org A's CA lines are returned; org B's data does not appear

#### Scenario: SQL filter enforced

- GIVEN a raw SQL query against journal-entry lines
- WHEN the query is executed
- THEN the WHERE clause includes `je."organizationId" = ${orgId}`

---

### Requirement: RBAC Gate (REQ-4)

The system MUST allow access to users with roles `owner`, `admin`, or `contador`, and MUST redirect or throw for any other role.

#### Scenario: Authorized role

- GIVEN a user with role `owner`, `admin`, or `contador`
- WHEN the report page or API is accessed
- THEN the report is rendered or returned normally

#### Scenario: Unauthorized role

- GIVEN a user with any other role
- WHEN the report page or API is accessed
- THEN `requirePermission` redirects or throws a 403

---

### Requirement: Activo = Pasivo + Patrimonio Invariant (REQ-5)

The system MUST verify that total Activo equals total Pasivo + Patrimonio. If totals match, `imbalanced` SHALL be `false` and delta `0`. If totals do not match, `imbalanced` SHALL be `true` and the delta in Bs. MUST be surfaced.

#### Scenario: Balanced CA

- GIVEN a CA where Activo total equals Pasivo + Patrimonio total
- WHEN the report is built
- THEN `imbalanced: false` and `delta: 0`

#### Scenario: Corrupted CA

- GIVEN a CA where totals do not match
- WHEN the report is built
- THEN `imbalanced: true` and `delta` contains the difference in Bs.; UI shows an alert banner

---

### Requirement: Grouping by AccountSubtype (REQ-6)

The system MUST render each AccountType section as separate subsections per AccountSubtype, each with its own subtotal.

#### Scenario: Activo with multiple subtypes

- GIVEN Activo accounts of subtypes CURRENT and NON_CURRENT
- WHEN the report is rendered
- THEN each subtype appears as a separate subsection with its subtotal

#### Scenario: Pasivo with multiple subtypes

- GIVEN Pasivo accounts of subtypes CURRENT, NON_CURRENT, and Capital Social
- WHEN the report is rendered
- THEN each subtype appears as a separate subsection with its subtotal

---

### Requirement: PDF Export — Bolivian Legal Layout (REQ-7)

The system MUST export a PDF that includes: org header (razón social, representante legal, NIT, dirección), title "BALANCE INICIAL — Al {fecha CA}", subtitle "(Expresado en Bolivianos)", ACTIVO section, PASIVO Y PATRIMONIO section, and signature footer (Contador / Propietario).

#### Scenario: User exports PDF

- GIVEN a valid report with balanced data
- WHEN the user clicks Export PDF
- THEN a PDF is returned containing org header, report title with CA date, both sections with subtotals and totals, and a signature footer

---

### Requirement: XLSX Export Parity (REQ-8)

The system MUST export an XLSX file with the same data as the PDF, in a single sheet with formatted numbers.

#### Scenario: User exports XLSX

- GIVEN a valid report
- WHEN the user clicks Export XLSX
- THEN an XLSX file is returned with one sheet containing the same account data, subtotals, and totals as the PDF

---

### Requirement: Catalog Entry Activation (REQ-9)

The system MUST update the `initial-balance` entry in `features/reports/catalog.ts` from `status: "planned"`, `route: null` to `status: "available"`, `route: "/accounting/initial-balance"`.

#### Scenario: Catalog reflects availability

- GIVEN the catalog entry for `initial-balance` was `planned` with no route
- WHEN the feature is deployed
- THEN the entry reads `status: "available"` and `route: "/accounting/initial-balance"`

---

### Requirement: Amount Formatting (REQ-10)

The system MUST format all monetary amounts using Bolivian locale (`es-BO`) with 2 decimal places. Negative amounts MUST be rendered in parentheses. Zero in detail rows SHOULD render as empty; zero in total rows MUST render as `0,00`.

#### Scenario: Positive amount

- GIVEN an amount of `1234.56`
- WHEN rendered
- THEN it displays as `1.234,56`

#### Scenario: Negative amount

- GIVEN an amount of `-1234.56`
- WHEN rendered
- THEN it displays as `(1.234,56)`

#### Scenario: Zero amounts

- GIVEN a detail row with amount `0` and a total row with amount `0`
- WHEN rendered
- THEN the detail row is empty and the total row shows `0,00`

---

### Requirement: Signed-Net Amounts (REQ-11)

The system MUST compute signed-net balances: DEUDORA accounts (Activo) as debit − credit; ACREEDORA accounts (Pasivo + Patrimonio) as credit − debit. This mirrors EEPN v2 conventions.

#### Scenario: Activo account (DEUDORA)

- GIVEN an account with DEUDORA nature
- WHEN the signed-net is calculated
- THEN result = debit − credit

#### Scenario: Pasivo/Patrimonio account (ACREEDORA)

- GIVEN an account with ACREEDORA nature
- WHEN the signed-net is calculated
- THEN result = credit − debit

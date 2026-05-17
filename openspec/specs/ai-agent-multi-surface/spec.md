# ai-agent-multi-surface Specification

## Purpose

Define the surface taxonomy and per-surface tool resolution contract for the Gemini-backed AI agent endpoint `POST /api/organizations/[orgSlug]/agent`. A "surface" is the named UX entry point (sidebar Q&A, registrar modal, journal-entry-ai modal) from which an agent invocation originates. Tool availability is the product of (surface bundle) × (role permissions matrix). The surface axis is orthogonal to and composes with the existing role-based RBAC: surface declares "what tools may live on this UX entry point", role declares "what this user may do on the underlying resource".

Canonicalized from change `agent-surface-separation` (archived 2026-05-17, baseline `80c66169` → final `4f807d7e`). Engram references: spec `#2660`, design `#2659`, archive-report `sdd/agent-surface-separation/archive-report`.

## Requirements

### Requirement: Surface Taxonomy

The system MUST define exactly three named surfaces as a closed `as const` tuple `SURFACES = ["sidebar-qa", "modal-registrar", "modal-journal-ai"]`, with a derived `Surface = (typeof SURFACES)[number]` type. Each surface MUST have one dedicated bundle file in `modules/ai-agent/domain/tools/surfaces/*.surface.ts` exporting a `SurfaceBundle = { name: Surface; tools: readonly Tool[] }` object. A `SURFACE_REGISTRY: Record<Surface, SurfaceBundle>` MUST exist in `modules/ai-agent/domain/tools/surfaces/index.ts` and be keyed by every member of `SURFACES`.

Bundle files MUST import only from `./surface.types`, `../agent.tool-definitions`, `../../ports/llm-provider.port`, and `@/modules/permissions/domain/permissions` (or its relative-path equivalent — see Notes). Bundle files MUST NOT import from any `application/`, `infrastructure/`, or `presentation/` layer.

Initial F1 bundle composition:
- `sidebar-qa` → `[searchDocumentsTool]`
- `modal-registrar` → `[createExpenseTool, logMortalityTool, getLotSummaryTool, listFarmsTool, listLotsTool, searchDocumentsTool]`
- `modal-journal-ai` → `[parseAccountingOperationToSuggestionTool]`

#### Scenario: SCN-1.1 — sidebar-qa excludes write tools

- GIVEN `SIDEBAR_QA_SURFACE` is imported
- WHEN its `tools` array is inspected
- THEN it MUST NOT contain `createExpenseTool` or `logMortalityTool`
- AND it MUST contain `searchDocumentsTool`
- AND `bundle.name === "sidebar-qa"`

#### Scenario: SCN-1.2 — modal-registrar contains all 6 chat tools

- GIVEN `MODAL_REGISTRAR_SURFACE` is imported
- WHEN its `tools` array is inspected
- THEN it MUST contain exactly 6 tools: `createExpense`, `logMortality`, `getLotSummary`, `listFarms`, `listLots`, `searchDocuments`

#### Scenario: SCN-1.3 — modal-journal-ai is single-tool

- GIVEN `MODAL_JOURNAL_AI_SURFACE` is imported
- WHEN its `tools` array is inspected
- THEN `tools.length === 1`
- AND `tools[0] === parseAccountingOperationToSuggestionTool`

#### Scenario: SCN-1.4 — SURFACE_REGISTRY covers all surfaces

- GIVEN `SURFACE_REGISTRY` is imported
- WHEN `Object.keys(SURFACE_REGISTRY)` is sorted
- THEN it equals `["modal-journal-ai", "modal-registrar", "sidebar-qa"]`

---

### Requirement: Request-Level Surface Field

`agentQuerySchema` (`modules/ai-agent/domain/validation/agent.validation.ts`) MUST declare `surface: z.enum(SURFACES)` as a REQUIRED field with NO default. Requests omitting `surface` or sending an unknown value MUST be rejected by the route at validation time, returning HTTP 400 via the existing `handleError` middleware. Silent defaults are prohibited.

The validated `surface` field MUST propagate from the route handler → `AgentService.query(orgId, userId, role, prompt, sessionId?, surface, mode?, contextHints?)` → the per-mode executor (`executeChatMode` or `executeJournalEntryAiMode`).

#### Scenario: SCN-2.1 — schema rejects body without surface

- GIVEN `agentQuerySchema.safeParse({ prompt: "hola" })`
- THEN `result.success === false`
- AND `result.error.issues` MUST contain an issue with `path === ["surface"]`

#### Scenario: SCN-2.2 — schema rejects unknown surface value

- GIVEN `agentQuerySchema.safeParse({ prompt: "hola", surface: "sidebar-unknown" })`
- THEN `result.success === false`
- AND the issue code MUST be `invalid_enum_value`

#### Scenario: SCN-2.3 — schema accepts the three valid surface values

- GIVEN `agentQuerySchema.safeParse({ prompt: "hola", surface: <S> })` for each `S ∈ SURFACES`
- THEN `result.success === true`
- AND `result.data.surface === S`

#### Scenario: SCN-2.4 — route returns 400 when surface absent

- GIVEN POST `/api/organizations/[orgSlug]/agent` with body `{ prompt: "test" }`
- WHEN the route handler processes the request
- THEN response status === 400
- AND response body contains a validation error mentioning `surface`

#### Scenario: SCN-2.5 — parsed surface propagates to AgentService.query

- GIVEN POST body `{ prompt: "hola", surface: "sidebar-qa" }`
- AND `agentService.query` is spied
- WHEN the route handler processes the valid request
- THEN `agentService.query` MUST be called with `surface === "sidebar-qa"` in its positional args

---

### Requirement: Tool Domain Augmentation

The `Tool<TSchema>` type in `modules/ai-agent/domain/ports/llm-provider.port.ts` MUST expose `readonly resource: Resource` and `readonly action: Extract<Action, "read" | "write">` fields, sourcing `Resource` and `Action` types verbatim from `@/modules/permissions/domain/permissions`. Every `defineTool(...)` call in `modules/ai-agent/domain/tools/agent.tool-definitions.ts` MUST tag its `resource` and `action`. The canonical F1 mapping:

| Tool | resource | action |
| --- | --- | --- |
| `createExpenseTool` | `farms` | `write` |
| `logMortalityTool` | `farms` | `write` |
| `getLotSummaryTool` | `farms` | `read` |
| `listFarmsTool` | `farms` | `read` |
| `listLotsTool` | `farms` | `read` |
| `searchDocumentsTool` | `documents` | `read` |
| `parseAccountingOperationToSuggestionTool` | `journal` | `write` |

#### Scenario: SCN-3.0 — Tool type carries resource and action

- GIVEN any `defineTool({...})` call missing `resource` or `action`
- THEN `tsc --noEmit` MUST fail at that call site

---

### Requirement: Surface × Role Cross-Filter Resolver

`modules/ai-agent/domain/tools/surfaces/index.ts` MUST export a pure synchronous function `getToolsForSurface({ surface, role }: { surface: Surface; role: Role }): Tool[]` that returns the subset of `SURFACE_REGISTRY[surface].tools` where, for each tool `t`, `(t.action === "read" ? PERMISSIONS_READ : PERMISSIONS_WRITE)[t.resource].includes(role)`. The function MUST NOT perform I/O, async work, or infrastructure access.

`PERMISSIONS_READ` and `PERMISSIONS_WRITE` (from `@/modules/permissions/domain/permissions`) are the single source of truth. Any drift between the previously hardcoded `getToolsForRole` role-tool sets and the matrix is resolved in favor of the matrix.

#### Scenario: SCN-3.1 — sidebar-qa × member returns only searchDocuments

- GIVEN `getToolsForSurface({ surface: "sidebar-qa", role: "member" })`
- THEN `result.map(t => t.name) === ["searchDocuments"]`

#### Scenario: SCN-3.2 — modal-registrar × member returns all 6 chat tools

- GIVEN `getToolsForSurface({ surface: "modal-registrar", role: "member" })`
- THEN `result.length === 6`
- AND `result` contains `createExpense`, `logMortality`, `getLotSummary`, `listFarms`, `listLots`, `searchDocuments`

#### Scenario: SCN-3.3 — sidebar-qa × cobrador returns [searchDocuments, listSales, listPayments]

- GIVEN `getToolsForSurface({ surface: "sidebar-qa", role: "cobrador" })`
- THEN `result.map(t => t.name)` includes `"searchDocuments"`, `"listSales"`, `"listPayments"` (3 tools total)
- (RBAC delta from `agent-surface-separation`: `PERMISSIONS_READ.documents` includes `cobrador`. F2 (`agent-accounting-query-tools`) adds `listSales` (PERMISSIONS_READ.sales) and `listPayments` (PERMISSIONS_READ.payments) which also include cobrador. The prior `getToolsForRole("cobrador") === []` was matrix-drift. Updated SCN supersedes the F1-locked version in test commit ed30fd36.)

#### Scenario: SCN-3.4 — modal-registrar × cobrador returns [searchDocuments]

- GIVEN `getToolsForSurface({ surface: "modal-registrar", role: "cobrador" })`
- THEN `result.map(t => t.name) === ["searchDocuments"]`

#### Scenario: SCN-3.5 — modal-registrar × contador returns all 6 tools

- GIVEN `getToolsForSurface({ surface: "modal-registrar", role: "contador" })`
- THEN `result.length === 6`
- (RBAC delta: `PERMISSIONS_WRITE.farms` includes `contador`; the prior `contadorTools = [searchDocuments]` was matrix-drift. Locked via the same engram entry as SCN-3.3.)

#### Scenario: SCN-3.6 — modal-journal-ai × contador returns the single accounting tool

- GIVEN `getToolsForSurface({ surface: "modal-journal-ai", role: "contador" })`
- THEN `result.map(t => t.name) === ["parseAccountingOperationToSuggestion"]`

#### Scenario: SCN-3.7 — modal-journal-ai × cobrador returns empty

- GIVEN `getToolsForSurface({ surface: "modal-journal-ai", role: "cobrador" })`
- THEN `result.length === 0`
- (cobrador has no `journal:write` permission; empty result triggers the no-tools fallback per Requirement: Empty-Tools Graceful Path.)

---

### Requirement: Empty-Tools Graceful Path

When `getToolsForSurface({ surface, role })` returns an empty array, the chat mode (`executeChatMode`) MUST short-circuit and return an `AgentResponse` with message `"No tienes herramientas disponibles para tu rol actual."`, `suggestion: null`, and `requiresConfirmation: false`. The LLM MUST NOT be invoked. The existing `no_tools_for_role` guard at the start of `executeChatMode` covers both the surface-empty and the role-empty cases without branching.

#### Scenario: SCN-4.1 — cobrador on modal-journal-ai triggers no_tools_for_role

- GIVEN `executeChatMode` is invoked with `{ surface: "modal-journal-ai", role: "cobrador", ... }` (via the chat dispatch wiring; resolver returns `[]`)
- THEN `result.message === "No tienes herramientas disponibles para tu rol actual."`
- AND `result.suggestion === null`
- AND `result.requiresConfirmation === false`
- AND the LLM provider MUST NOT be called

---

### Requirement: Client Surface Propagation

Each known client of the agent endpoint MUST include the matching `surface` literal in its POST body:

| Client | File | Surface literal |
| --- | --- | --- |
| Sidebar chat | `components/agent/agent-chat.tsx` | `"sidebar-qa"` |
| Registrar modal | `components/agent/registrar-con-ia/index.tsx` (both `handleSend` and `handleRetry`) | `"modal-registrar"` |
| Journal-entry-AI modal | `components/accounting/journal-entry-ai-modal/index.tsx` (both `handleInterpret` and `handleCorrection`) | `"modal-journal-ai"` |

`AgentQueryParams` in `modules/ai-agent/presentation/client.ts` MUST declare `surface: Surface` as a REQUIRED field. Compile-time enforcement is the primary defense against new clients omitting the field; the route schema is the runtime defense.

#### Scenario: SCN-5.1 — sidebar fetch body contains surface

- GIVEN agent-chat renders and submits a message
- THEN the resulting fetch body JSON MUST contain `surface: "sidebar-qa"`

#### Scenario: SCN-5.2 — registrar modal query call contains surface

- GIVEN registrar-con-ia invokes `query({ ... })`
- THEN the call args MUST contain `surface: "modal-registrar"`

#### Scenario: SCN-5.3 — journal-entry-ai modal query call contains surface

- GIVEN journal-entry-ai-modal invokes `query({ ... })`
- THEN the call args MUST contain `surface: "modal-journal-ai"`

---

### Requirement: Telemetry Surface Field

The `agent_invocation` event emitted by `logStructured` MUST include a `surface` field for every chat-mode and journal-entry-ai-mode invocation (success, error, and `no_tools_for_role` paths alike). Emit sites:

- `modules/ai-agent/application/modes/chat.ts` — finally block of `executeChatMode`
- `modules/ai-agent/application/modes/journal-entry-ai.ts` — finally block of `executeJournalEntryAiMode` (constant `surface: "modal-journal-ai"`)

#### Scenario: SCN-6.1 — telemetry includes surface on success

- GIVEN `logStructured` is spied
- AND `executeChatMode` is invoked with `surface: "sidebar-qa"` and completes successfully
- THEN at least one `logStructured` call with `event: "agent_invocation"` MUST include `surface: "sidebar-qa"`

#### Scenario: SCN-6.2 — telemetry includes surface on error

- GIVEN the LLM provider throws
- AND `executeChatMode` is invoked with `surface: "modal-registrar"`
- THEN the finally-block `logStructured` call MUST include `surface: "modal-registrar"`

---

### Requirement: Surface Coverage Sentinel

A sentinel test at `modules/ai-agent/__tests__/surface-tool-coverage.sentinel.test.ts` MUST assert, via direct runtime-graph imports (NOT filesystem glob), that every entry in `TOOL_REGISTRY` appears in `SURFACE_REGISTRY[surface].tools` for at least one `surface`. The failure message MUST name the orphan tool(s) so triage requires no investigation.

#### Scenario: SCN-7.1 — all registered tools are covered by ≥1 surface bundle

- GIVEN `TOOL_REGISTRY` and `SURFACE_REGISTRY` are imported
- WHEN the sentinel computes `coveredNames = SURFACES.flatMap(s => SURFACE_REGISTRY[s].tools.map(t => t.name))`
- THEN `Object.keys(TOOL_REGISTRY).filter(n => !coveredNames.has(n)) === []`

#### Scenario: SCN-7.2 — orphan tool produces a named failure

- GIVEN a hypothetical new tool `listExpenses` is added to `TOOL_REGISTRY` but to no bundle
- WHEN the sentinel runs
- THEN the test MUST fail with a message containing `listExpenses` and the phrase `not in any surface bundle`

---

### Requirement: No Schema Migration

The `surface` field is a request-shape contract only. No Prisma model gains a `surface` column in F1. No DB migration is shipped. Forward additions (e.g., persisting `surface` on agent logs) are out of scope for this capability and would be introduced by a separate change.

#### Scenario: SCN-8.1 — no DB migration in agent-surface-separation

- GIVEN the diff `git diff 80c66169..4f807d7e --name-only`
- THEN zero files under `prisma/` are modified

---

### Requirement: Module hint for sidebar surface

`agentQuerySchema` (`modules/ai-agent/domain/validation/agent.validation.ts`) MUST declare `module_hint: z.enum(MODULE_HINTS).nullable().optional()` as an OPTIONAL field, where `MODULE_HINTS = ["accounting", "farm"] as const` is sourced from `modules/ai-agent/domain/types/module-hint.types.ts`. The field is OPTIONAL on the wire so modal clients (`modal-registrar`, `modal-journal-ai`) keep parsing without sending it, and NULLABLE so the sidebar can emit explicit `null` for non-mapped routes.

The sidebar client (`components/agent/agent-chat.tsx`) MUST derive its value client-side from `usePathname()` via the pure helper `deriveModuleHint(pathname: string): ModuleHintValue` at `components/agent/derive-module-hint.ts`. The route handler MUST coerce `undefined` to `null` at the HTTP boundary (`parsed.module_hint ?? null`) before calling `AgentService.query(...)`. The validated value MUST propagate through `AgentService.query` → `executeChatMode` args → `buildSystemPrompt(role, context, contextHints, moduleHint)`.

When `moduleHint !== null`, `buildSystemPrompt` MUST append the EXACT Spanish paragraph (substituting `Contabilidad` for `"accounting"` and `Granja` for `"farm"`):

> `Contexto del usuario: el usuario está actualmente en la sección de {Contabilidad|Granja}. Cuando elijas herramientas, priorizá las que sean relevantes a este módulo. No fuerces el dominio si la pregunta es explícitamente de otra área.`

The `agent_invocation` `logStructured` payload MUST include `moduleHint: ModuleHintValue` (the resolved value, explicit `null` when absent). The hint is a SOFT priority signal — it MUST NOT narrow the tool set (that is the surface's responsibility per Requirement: Surface Taxonomy).

Canonicalized from change `agent-sidebar-module-hint` (archived 2026-05-17, baseline `fcdf8d4e` → final `a5d66f94`). Engram references: proposal `#2749`, design `#2750`, archive-report `sdd/agent-sidebar-module-hint/archive-report`.

#### Scenario: SCN-9.1 — schema accepts valid enum, null, and absent

- GIVEN `agentQuerySchema.safeParse({ prompt: "x", surface: "sidebar-qa", module_hint: <V> })` for each `V ∈ {"accounting", "farm", null}`
- THEN `result.success === true`
- AND `result.data.module_hint === V`
- AND for the same body WITHOUT `module_hint`, `result.success === true` AND `result.data.module_hint === undefined`

#### Scenario: SCN-9.2 — schema rejects unknown enum value

- GIVEN `agentQuerySchema.safeParse({ prompt: "x", surface: "sidebar-qa", module_hint: "foo" })`
- THEN `result.success === false`
- AND `result.error.issues[0].code === "invalid_enum_value"`
- AND `result.error.issues[0].path` includes `"module_hint"`

#### Scenario: SCN-9.3 — deriveModuleHint maps pathnames per module table

- GIVEN `deriveModuleHint(pathname)`
- THEN the following table holds:

| pathname | result |
| --- | --- |
| `/acme/accounting` | `"accounting"` |
| `/acme/accounting/journals` | `"accounting"` |
| `/acme/accounting/cxc/contact-123` | `"accounting"` |
| `/acme/farms` | `"farm"` |
| `/acme/farms/farm-123` | `"farm"` |
| `/acme/lots` | `"farm"` |
| `/acme/lots/lot-456` | `"farm"` |
| `/acme/documents` | `null` |
| `/acme/members` | `null` |
| `/acme/settings` | `null` |
| `/acme` | `null` |
| `/` | `null` |
| `""` | `null` |

#### Scenario: SCN-9.4 — sidebar client emits module_hint in fetch body

- GIVEN agent-chat renders with `usePathname()` returning `/test-org/accounting/journals`
- WHEN the user submits a message
- THEN the resulting fetch body JSON MUST contain `module_hint: "accounting"`
- AND for `/test-org/documents` → `module_hint: null` (explicit null, not absent)

#### Scenario: SCN-9.5 — system prompt augmentation when moduleHint is non-null

- GIVEN `executeChatMode` is invoked with `moduleHint: "accounting"`
- WHEN the system prompt is captured (via spy on `llmProvider.query`)
- THEN it MUST contain the EXACT substring `Contexto del usuario: el usuario está actualmente en la sección de Contabilidad. Cuando elijas herramientas, priorizá las que sean relevantes a este módulo. No fuerces el dominio si la pregunta es explícitamente de otra área.`
- AND for `moduleHint: "farm"` the substring contains `sección de Granja`
- AND for `moduleHint: null` the prompt does NOT contain `Contexto del usuario: el usuario está actualmente en la sección de`

#### Scenario: SCN-9.6 — telemetry includes moduleHint

- GIVEN `logStructured` is spied
- AND `executeChatMode` is invoked with `moduleHint: "accounting"`
- THEN at least one `logStructured` call with `event: "agent_invocation"` MUST include `moduleHint: "accounting"`
- AND for `moduleHint: null` the call includes `moduleHint: null` (key present, value null — NOT undefined / missing key)

---

### Requirement: listRecentJournalEntries Tool (REQ-10)

The system SHALL expose a `listRecentJournalEntries` tool to the chat agent on the `sidebar-qa` surface, callable by roles with `PERMISSIONS_READ["journal"] = true` (owner, admin, contador).

**Input schema**: `{ limit?: z.number().int().min(1).max(50) }` (default 10)

**Return DTO** (`JournalEntrySummaryDto[]`): `Array<{ id: string; date: string; displayNumber: string; description: string; status: "DRAFT"|"POSTED"|"LOCKED"|"VOIDED"; totalDebit: string; totalCredit: string }>` — `lines[]` MUST NOT be included (trimmed to bound LLM context cost).

#### Scenario: SCN-10.1 — contador retrieves recent journal entries

- GIVEN `getToolsForSurface({ surface: "sidebar-qa", role: "contador" })` returns `listRecentJournalEntries`
- WHEN the tool is called with `{ limit: 5 }`
- THEN the handler returns an array of up to 5 entries, each with `id`, `date`, `displayNumber`, `description`, `status`, `totalDebit`, `totalCredit` as strings
- AND the `lines` array is absent from every entry

#### Scenario: SCN-10.2 — cobrador is denied listRecentJournalEntries

- GIVEN `getToolsForSurface({ surface: "sidebar-qa", role: "cobrador" })`
- THEN `listRecentJournalEntries` MUST NOT appear in the result

---

### Requirement: getAccountMovements Tool (REQ-11)

The system SHALL expose a `getAccountMovements` tool to the chat agent on the `sidebar-qa` surface, callable by roles with `PERMISSIONS_READ["journal"] = true` (owner, admin, contador).

**Input schema**: `{ accountId: z.string(), dateFrom?: z.string(), dateTo?: z.string() }`

**Return DTO** (`LedgerEntryDto[]`): `Array<{ entryId: string; date: string; displayNumber: string; description: string; debit: string; credit: string; balance: string }>` — `balance` is the running balance after each movement.

#### Scenario: SCN-11.1 — contador retrieves account movements

- GIVEN `getToolsForSurface({ surface: "sidebar-qa", role: "contador" })` includes `getAccountMovements`
- WHEN the tool is called with `{ accountId: "acc-123" }`
- THEN the handler returns an array of ledger entries with `entryId`, `date`, `displayNumber`, `description`, `debit`, `credit`, `balance` as strings

#### Scenario: SCN-11.2 — cobrador is denied getAccountMovements

- GIVEN `getToolsForSurface({ surface: "sidebar-qa", role: "cobrador" })`
- THEN `getAccountMovements` MUST NOT appear in the result

---

### Requirement: getAccountBalance Tool (REQ-12)

The system SHALL expose a `getAccountBalance` tool to the chat agent on the `sidebar-qa` surface, callable by roles with `PERMISSIONS_READ["journal"] = true` (owner, admin, contador). The balance SHALL be the running balance derived from the account's last ledger entry (no periodId required). An empty ledger returns `{ balance: "0.00", asOf: null }`.

**Input schema**: `{ accountId: z.string() }`

**Return DTO** (`AccountBalanceDto`): `{ accountId: string; balance: string; asOf: string | null }` — `asOf` is the ISO date of the last ledger entry, or `null` when the ledger is empty.

#### Scenario: SCN-12.1 — contador retrieves account balance

- GIVEN `getToolsForSurface({ surface: "sidebar-qa", role: "contador" })` includes `getAccountBalance`
- WHEN the tool is called with `{ accountId: "acc-123" }`
- THEN the handler returns `{ accountId: "acc-123", balance: "<string>", asOf: "<ISO date or null>" }`
- AND `balance` is a string formatted as `roundHalfUp(...).toFixed(2)`, or `"0.00"` when the ledger is empty

#### Scenario: SCN-12.2 — cobrador is denied getAccountBalance

- GIVEN `getToolsForSurface({ surface: "sidebar-qa", role: "cobrador" })`
- THEN `getAccountBalance` MUST NOT appear in the result

---

### Requirement: listSales Tool (REQ-13)

The system SHALL expose a `listSales` tool to the chat agent on the `sidebar-qa` surface, callable by roles with `PERMISSIONS_READ["sales"] = true` (owner, admin, contador, cobrador).

**Input schema**: `{ dateFrom?: z.string(), dateTo?: z.string(), limit?: z.number().int().min(1).max(50) }` (default 20)

**Return DTO** (`SaleSummaryDto[]`): `Array<{ id: string; date: string; sequenceNumber: number | null; status: "DRAFT"|"POSTED"|"LOCKED"|"VOIDED"; contactId: string; description: string; totalAmount: string }>` — uses `contactId` (the raw contact UUID from the Sale aggregate, no denormalized customer name).

#### Scenario: SCN-13.1 — contador retrieves recent sales

- GIVEN `getToolsForSurface({ surface: "sidebar-qa", role: "contador" })` includes `listSales`
- WHEN the tool is called with `{ limit: 10 }`
- THEN the handler returns an array where each entry contains `id`, `date`, `sequenceNumber`, `status`, `contactId`, `description`, `totalAmount`
- AND `totalAmount` is a string formatted as `roundHalfUp(...).toFixed(2)`

#### Scenario: SCN-13.2 — member is denied listSales

- GIVEN `getToolsForSurface({ surface: "sidebar-qa", role: "member" })`
- THEN `listSales` MUST NOT appear in the result

---

### Requirement: listPurchases Tool (REQ-14)

The system SHALL expose a `listPurchases` tool to the chat agent on the `sidebar-qa` surface, callable by roles with `PERMISSIONS_READ["purchases"] = true` (owner, admin, contador).

**Input schema**: `{ dateFrom?: z.string(), dateTo?: z.string(), limit?: z.number().int().min(1).max(50) }` (default 20)

**Return DTO** (`PurchaseSummaryDto[]`): `Array<{ id: string; date: string; sequenceNumber: number | null; status: "DRAFT"|"POSTED"|"LOCKED"|"VOIDED"; purchaseType: "FLETE"|"POLLO_FAENADO"|"COMPRA_GENERAL"|"SERVICIO"; contactId: string; description: string; totalAmount: string }>` — uses `contactId` (no denormalized supplier name).

#### Scenario: SCN-14.1 — contador retrieves recent purchases

- GIVEN `getToolsForSurface({ surface: "sidebar-qa", role: "contador" })` includes `listPurchases`
- WHEN the tool is called with `{ limit: 10 }`
- THEN the handler returns an array where each entry contains `id`, `date`, `sequenceNumber`, `status`, `purchaseType`, `contactId`, `description`, `totalAmount`
- AND `totalAmount` is a string formatted as `roundHalfUp(...).toFixed(2)`

#### Scenario: SCN-14.2 — cobrador is denied listPurchases

- GIVEN `getToolsForSurface({ surface: "sidebar-qa", role: "cobrador" })`
- THEN `listPurchases` MUST NOT appear in the result

---

### Requirement: listPayments Tool (REQ-15)

The system SHALL expose a `listPayments` tool to the chat agent on the `sidebar-qa` surface, callable by roles with `PERMISSIONS_READ["payments"] = true` (owner, admin, contador, cobrador).

**Input schema**: `{ dateFrom?: z.string(), dateTo?: z.string(), limit?: z.number().int().min(1).max(50) }` (default 20)

**Return DTO** (`PaymentSummaryDto[]`): `Array<{ id: string; date: string; status: "DRAFT"|"POSTED"|"LOCKED"|"VOIDED"; method: string; direction: "COBRO" | "PAGO" | null; contactId: string; amount: string; description: string }>` — uses `contactId` (PaymentsService does not expose a denormalized counterparty name; Marco lock — design §10). `direction` is `null` when the payment has no allocations.

#### Scenario: SCN-15.1 — cobrador retrieves recent payments

- GIVEN `getToolsForSurface({ surface: "sidebar-qa", role: "cobrador" })` includes `listPayments`
- WHEN the tool is called with `{ limit: 10 }`
- THEN the handler returns an array where each entry contains `id`, `date`, `status`, `method`, `direction`, `contactId`, `amount`, `description`
- AND `direction` is one of `"COBRO"`, `"PAGO"`, or `null`
- AND `amount` is a string formatted as `roundHalfUp(...).toFixed(2)`

#### Scenario: SCN-15.2 — member is denied listPayments

- GIVEN `getToolsForSurface({ surface: "sidebar-qa", role: "member" })`
- THEN `listPayments` MUST NOT appear in the result

---

### Requirement: AccountingQueryPort Umbrella Contract (REQ-16)

The `chat` mode SHALL receive accounting query capabilities via a single `AccountingQueryPort` injected through `ChatModeDeps`, NOT via per-service ports. The port SHALL declare exactly 6 methods:

| Method | Signature |
|--------|-----------|
| `listRecentJournalEntries` | `(orgId: string, limit: number) => Promise<JournalEntrySummaryDto[]>` |
| `getAccountMovements` | `(orgId: string, accountId: string, dateFrom?: string, dateTo?: string) => Promise<LedgerEntryDto[]>` |
| `getAccountBalance` | `(orgId: string, accountId: string) => Promise<AccountBalanceDto>` |
| `listSales` | `(orgId: string, dateFrom?: string, dateTo?: string, limit?: number) => Promise<SaleSummaryDto[]>` |
| `listPurchases` | `(orgId: string, dateFrom?: string, dateTo?: string, limit?: number) => Promise<PurchaseSummaryDto[]>` |
| `listPayments` | `(orgId: string, dateFrom?: string, dateTo?: string, limit?: number) => Promise<PaymentSummaryDto[]>` |

#### Scenario: SCN-16.1 — composition root constructs a single adapter

- GIVEN the composition root in `presentation/server.ts`
- WHEN it wires `ChatModeDeps`
- THEN exactly one `AccountingQueryAdapter` instance is constructed and assigned to `deps.accountingQuery`
- AND no per-service port for journals, ledger, sales, purchases, or payments is individually injected into `ChatModeDeps`

#### Scenario: SCN-16.2 — test doubles replace one port not six services

- GIVEN a unit test for any of the 6 accounting tool handlers
- WHEN the test sets up `ChatModeDeps`
- THEN only `accountingQuery` is replaced with a test double (stub/spy)
- AND no individual service mock (JournalsService, LedgerService, etc.) is required in the same test

---

### Requirement: TOOL_REGISTRY Surface-Coverage Sentinel (REQ-17)

Every tool registered in `TOOL_REGISTRY` SHALL belong to at least one surface bundle. The 6 new accounting tools SHALL belong exclusively to `sidebar-qa`. The existing sentinel test at `surface-tool-coverage.sentinel.test.ts` SHALL pass GREEN after F2 apply with all 6 tools bundled.

#### Scenario: SCN-17.1 — sentinel passes with all 6 new tools in sidebar-qa

- GIVEN all 6 new tools are added to `TOOL_REGISTRY` AND to `SIDEBAR_QA_SURFACE.tools`
- WHEN `surface-tool-coverage.sentinel.test.ts` runs
- THEN the test passes (no orphan tools)

#### Scenario: SCN-17.2 — sentinel fails RED if a new tool is registered but not bundled

- GIVEN a new accounting tool is added to `TOOL_REGISTRY` but NOT to any `*.surface.ts`
- WHEN the sentinel runs
- THEN the test MUST fail with a message containing the orphan tool name and the phrase `not in any surface bundle`

---

### Requirement: MonetaryAmount Serialization Contract (REQ-18)

Tool handlers SHALL serialize all monetary values to strings using `roundHalfUp(...).toFixed(2)` before returning to the LLM. Raw `MonetaryAmount` value objects MUST NOT be returned directly in any tool result DTO. The serialization helper `toMoneyString` is LOCAL to the adapter (not exported) — serialization is a transport concern of the agent layer; domain `MonetaryAmount` stays serialization-agnostic.

#### Scenario: SCN-18.1 — sale totalAmount serialized as string

- GIVEN a `Sale` aggregate with `totalAmount` as a `MonetaryAmount` VO equal to 1234.5
- WHEN `listSales` tool handler maps the result to DTO
- THEN `dto.totalAmount === "1234.50"`

#### Scenario: SCN-18.2 — payment amount serialized as string

- GIVEN a `Payment` aggregate with `amount` as a `MonetaryAmount` VO equal to 99.9
- WHEN `listPayments` tool handler maps the result to DTO
- THEN `dto.amount === "99.90"`

---

---

### Requirement: Multi-Turn LLM Loop for Chat-Mode Read Tools (REQ-19)

The chat mode SHALL drive a multi-turn LLM conversation when read tools are invoked: each LLM response with `tool_call`s SHALL be followed by tool execution and a subsequent LLM call with the tool results appended to the conversation history, until the LLM returns a response with no `tool_call`s OR the max-turn cap is reached.

#### Scenario: SCN-19.1 — Single-tool happy path

- GIVEN user sends "mostrame los últimos asientos" in sidebar-qa
- WHEN the LLM returns a `listRecentJournalEntries` tool_call
- THEN the backend executes the tool AND calls the LLM again with the tool result in conversation history
- AND the LLM returns formatted natural-Spanish text
- AND the user sees the actual data (NOT the placeholder)

#### Scenario: SCN-19.2 — Multi-tool single turn (S-03 fix)

- GIVEN the LLM returns 2 tool_calls (`listSales` + `listPurchases`) in a single response
- WHEN the backend processes turn 1
- THEN BOTH tools execute (none dropped)
- AND the second LLM call receives both tool results
- AND the LLM returns a unified response

#### Scenario: SCN-19.3 — Multi-turn sequential (2 tool rounds)

- GIVEN the LLM returns tool_call in turn 1, then another tool_call in turn 2 based on first result
- WHEN both rounds execute
- THEN the LLM returns final text on turn 3
- AND turn count equals 3

#### Scenario: SCN-19.4 — Max-turn cap fires

- GIVEN a mock LLM always returns a tool_call (pathological case)
- WHEN the loop reaches turn 5
- THEN the loop stops and returns the fallback message
- AND a `chat_max_turns_reached` warn event is logged

---

### Requirement: ConversationTurn Domain Type (Port-Neutral) (REQ-20)

The domain SHALL define a `ConversationTurn` discriminated union with variants `{kind: 'user', content: string}`, `{kind: 'model', content: string, toolCalls?: ReadonlyArray<ToolCall>}`, and `{kind: 'tool_result', toolCallId: string, name: string, result: unknown}`. No LLM-vendor types (Gemini `Content`, etc.) SHALL appear in domain modules.

#### Scenario: SCN-20.1 — Domain type narrowing

- GIVEN `ConversationTurn` is imported and a value `t` is assigned
- WHEN a `switch (t.kind)` is compiled
- THEN TypeScript narrows correctly to each variant and `tsc --noEmit` passes

#### Scenario: SCN-20.2 — Hex purity assertion

- GIVEN grep runs on `modules/ai-agent/domain/**` for the string `Content[]`
- THEN zero matches are returned

---

### Requirement: LLMProviderPort.query() Accepts Optional Conversation History (REQ-21)

`LLMQuery` SHALL accept an optional `conversationHistory?: readonly ConversationTurn[]` parameter. When omitted or empty, behavior is identical to the prior single-call shape (backward compatible). When provided, the LLM provider SHALL include the history in the LLM invocation.

#### Scenario: SCN-21.1 — Backward compat: callers without conversationHistory unaffected

- GIVEN existing call `llmProvider.query({ systemPrompt, userMessage, tools })`
- THEN the response shape and behavior are identical to pre-change behavior

#### Scenario: SCN-21.2 — History-aware multi-turn call

- GIVEN caller passes `conversationHistory` with 3 turns (user → model+tool_call → tool_result)
- WHEN `query()` is invoked
- THEN the provider includes all 3 history turns plus the new user message in the LLM call
- AND returns a new response

---

### Requirement: Gemini Adapter Maps ConversationTurn[] to Content[] (REQ-22)

The Gemini LLM adapter SHALL translate `ConversationTurn[]` into Gemini SDK `Content[]`, mapping `tool_result` turns to `FunctionResponsePart` entries (`{ functionResponse: { name, response } }`) and `model` turns with `toolCalls` to `FunctionCallPart` entries (`{ functionCall: { name, args } }`). The Gemini SDK specifies `FunctionResponsePart` MUST be wrapped in a `Content` with `role: "user"`. `FunctionResponse.response` MUST be `object` — primitives, `null`, and arrays are wrapped via `wrapForFunctionResponse(result)` as `{ value: <raw> }`.

#### Scenario: SCN-22.1 — Mapping round-trip

- GIVEN input history `[user-turn, model-turn-with-tool-call, tool_result-turn]`
- WHEN the adapter maps to Gemini `Content[]`
- THEN output length is 3
- AND the third element is `{ role: "user", parts: [{ functionResponse: { name: <name>, response: <result> } }] }`

#### Scenario: SCN-22.2 — Vendor type leak guard

- GIVEN the `ConversationTurn` interface at `modules/ai-agent/domain/types/conversation.ts`
- THEN no `@google/generative-ai` type is imported in that file

---

### Requirement: Max-Turn Cap with Safe Exit (REQ-23)

The chat-mode loop SHALL be bounded by `MAX_CHAT_TURNS = 5` (configurable constant in `chat.constants.ts`; hard upper bound `HARD_CAP = 10` enforced at module load via `throw` when exceeded). When the cap is reached, the loop SHALL return the most recent text response or the fallback message `"No pude completar la consulta. Intentá ser más específico."`, and SHALL log a `chat_max_turns_reached` warn event with `turnCount` and `toolNames` invoked.

#### Scenario: SCN-23.1 — Cap fires, fallback returned

- GIVEN mock LLM always returns a tool_call
- WHEN the loop completes turn 5
- THEN result message equals `"No pude completar la consulta. Intentá ser más específico."`
- AND logStructured is called with `event: "chat_max_turns_reached"` and `turnCount: 5`

#### Scenario: SCN-23.2 — Normal flow does not trigger cap

- GIVEN a 2-turn flow (1 tool + 1 text response)
- THEN no `chat_max_turns_reached` event is logged
- AND result message equals the LLM's natural-language text

#### Scenario: SCN-23.3 — Hard bound rejects cap > 10

- GIVEN `MAX_CHAT_TURNS` is set to 11
- THEN the module MUST throw at import time (`MAX_CHAT_TURNS > HARD_CAP` assertion)

---

### Requirement: Telemetry Accumulation Across Turns (REQ-24)

The `agent_invocation` log event in chat mode SHALL accumulate `inputTokens`, `outputTokens`, and `totalTokens` across ALL turns into the existing single fields. A new `turnCount: number` field SHALL be added. The existing `toolCallsCount` and `toolNames` fields SHALL include tool calls from ALL turns.

#### Scenario: SCN-24.1 — Token accumulation across 2 turns

- GIVEN turn 1: inputTokens=1000, outputTokens=10; turn 2: inputTokens=1200, outputTokens=80
- WHEN `agent_invocation` is logged
- THEN `inputTokens === 2200`, `outputTokens === 90`, `totalTokens === 2290`, `turnCount === 2`
- AND `toolCallsCount === 1`, `toolNames === ["listRecentJournalEntries"]`

#### Scenario: SCN-24.2 — Multi-tool telemetry

- GIVEN turn 1 returns 2 tool_calls (`listSales` + `listPurchases`); turn 2 returns text
- WHEN `agent_invocation` is logged
- THEN `toolCallsCount === 2`, `toolNames === ["listSales", "listPurchases"]`, `turnCount === 2`

---

### Requirement: searchDocuments Retains Early-Return Bypass (REQ-25)

The `searchDocuments` tool case SHALL continue to bypass the multi-turn loop and return the RAG context text directly in `message`. Multi-turn behavior does NOT apply to `searchDocuments`. The bypass fires ONLY when `searchDocuments` is the sole tool_call at turn 1; mixed-call cases fall through to the normal loop.

#### Scenario: SCN-25.1 — searchDocuments single-turn bypass

- GIVEN user asks "buscame docs sobre X" on sidebar-qa
- WHEN the LLM returns a `searchDocuments` tool_call (sole call at turn 1)
- THEN the backend returns `{ message: ragContext, suggestion: null }` immediately
- AND no second LLM call is made

---

### Requirement: System Prompt Addition for Tool-Result Formatting (REQ-26)

`buildSystemPrompt` SHALL include the following Spanish instruction appended after `moduleHintLines` and before the `DATOS:` block: `"Cuando recibas resultados de herramientas, presenta los datos al usuario en español natural y conciso."` This applies to ALL chat-mode invocations regardless of surface or role. EXACT Spanish text locked per `[[textual_rule_verification]]` — any change requires a new SDD with a RED test mirroring the new text.

#### Scenario: SCN-26.1 — Golden test on buildSystemPrompt output

- GIVEN `buildSystemPrompt` is called with any valid args
- THEN the result includes the literal string `"Cuando recibas resultados de herramientas, presenta los datos al usuario en español natural y conciso."`

---

### Requirement: Mid-Loop Tool Error Handling (REQ-27)

When a tool execution throws or returns an error mid-loop, the backend SHALL append an error `ToolResultTurn` with `result: { error: msg }` to the conversation history and continue the loop. The loop SHALL NOT abort on tool error unless the cap is also reached.

#### Scenario: SCN-27.1 — Tool throws: error surfaced via LLM

- GIVEN the first tool call throws an error
- WHEN an error ToolResultTurn (`{ error: msg }`) is appended and the LLM is called again
- THEN the LLM returns a user-facing text like "Hubo un error al consultar X"
- AND the user sees the error message (not an uncaught exception)

#### Scenario: SCN-27.2 — Tool error + LLM retries with different tool_call

- GIVEN the LLM emits a new tool_call after seeing an error ToolResultTurn
- THEN the loop continues normally (error does not short-circuit)

---

### Requirement: Write Flow Unaffected (REQ-28)

Write tool calls (`createExpense`, `logMortality`, `createJournalEntry`, etc.) SHALL retain their current single-turn behavior with `requiresConfirmation: true`. The multi-turn loop applies ONLY to read-mode flows in chat mode. The write-tool short-circuit in `executeChatMode` exits the loop before any read-tool turn is appended.

#### Scenario: SCN-28.1 — Write tool single-turn unchanged

- GIVEN user in modal-registrar triggers `createExpense`
- THEN flow is unchanged: single LLM call + tool emission, modal handles confirmation
- AND no multi-turn loop is entered for write tools

---

### Requirement: Prescribed Compact Tool-Result Format (REQ-29)

**Derived from:** REQ-26 (per `[[named_rule_immutability]]` — same intent: instruct LLM to format tool-result lists; this derivative supersedes REQ-26's literal Spanish text with a prescribed compact format so the sidebar stays readable when tool results contain long descriptions or unbroken strings).

`buildSystemPrompt` SHALL include the following Spanish instruction appended after `moduleHintLines` and before the `DATOS:` block: `"Cuando muestres listas de resultados, usá formato compacto: una línea por entrada con campos esenciales (fecha, identificador, monto). Sin descripciones extensas, sin status, sin markdown. Ejemplo para asientos: '16/05/2026 CI-2 Bs2000' (CI=Comprobante Ingreso, N sin ceros)."` This applies to ALL chat-mode invocations regardless of surface or role. EXACT Spanish text locked per `[[textual_rule_verification]]` — any change requires a new SDD with a RED test mirroring the new text.

**Motivation**: smoke test post-`agent-chat-tool-result-rendering` (F3) revealed the LLM was rendering verbose multi-clause sentences per entry ("estado: PUBLICADO, por un total de $2000.00") which combined with `react-markdown` rendering still produced visually noisy output and amplified the long-string overflow issue in the sidebar. The compact format restricts presentation to essential fields and prescribes a short comprobante code (`CX-N`) that the LLM derives from the underlying `displayNumber`.

#### Scenario: SCN-29.1 — Golden test on buildSystemPrompt output

- GIVEN `buildSystemPrompt` is called with any valid args
- THEN the result includes the literal string `"Cuando muestres listas de resultados, usá formato compacto: una línea por entrada con campos esenciales (fecha, identificador, monto). Sin descripciones extensas, sin status, sin markdown. Ejemplo para asientos: '16/05/2026 CI-2 Bs2000' (CI=Comprobante Ingreso, N sin ceros)."`
- AND the literal from REQ-26 is NOT present (the derivative supersedes it)

---

## Notes

- **Runtime alias gotcha**: `modules/ai-agent/domain/tools/surfaces/index.ts` uses the RELATIVE path `../../../../permissions/domain/permissions.ts` instead of the `@/modules/permissions/...` alias. Reason: the `c1-application-shape.poc-ai-agent-hex` smoke test loads `agent.service.ts` via CommonJS `require()`, which bypasses the Vitest alias resolver in the dynamic-import chain. JSDoc at the import site (lines 1-6 of `surfaces/index.ts`) is the durable defense against well-meaning "fix the path back to alias" PRs. Type-only `@/` imports elsewhere are erased by the TS compiler and unaffected.

- **`getToolsForRole` deprecation**: `getToolsForRole` in `modules/ai-agent/domain/tools/agent.tool-definitions.ts` carries an `@deprecated` JSDoc pointing to `getToolsForSurface`. Removal is scheduled as a follow-up SDD once all callers are gone (`agent.tools.ts` barrel still re-exports it as of `4f807d7e`).

- **`isWriteAction` retention**: `isWriteAction(name)` in the same domain file is unchanged and remains authoritative for the `executeChatMode` write-vs-read suggestion-vs-direct dispatch branch. The surface filter is upstream; `isWriteAction` is downstream; they are orthogonal.

- **Multi-tool-call fix (S-03 resolved)**: The pre-F3 limitation at `chat.ts:164` that dropped all but the first tool call when the LLM returned multiple simultaneously (`multiple_tool_calls_dropped` warn log) has been resolved in change `agent-chat-tool-result-rendering` (F3). The multi-turn loop now executes ALL tool calls per turn via `for (const call of turnToolCalls)` — natural side-effect of the loop architecture.

- **Source-of-truth permissions matrix**: `modules/permissions/domain/permissions.ts` defines `PERMISSIONS_READ` and `PERMISSIONS_WRITE` as `Record<Resource, Role[]>`. Any future tool's RBAC is determined by its `(resource, action)` tag combined with the matrix — no new entries in role-tool arrays are required.

- **MODULE_HINTS location**: `MODULE_HINTS = ["accounting", "farm"] as const` lives at `modules/ai-agent/domain/types/module-hint.types.ts` along with `ModuleHint = (typeof MODULE_HINTS)[number]` and `ModuleHintValue = ModuleHint | null`. It is intentionally SEPARATE from `modules/ai-agent/domain/tools/surfaces/surface.types.ts` because module_hint does NOT narrow the tool set (surface's job) — it is a soft contextual signal for the chat-mode system prompt. Adding a new module hint requires editing only the const tuple and the Spanish mapping table in `modules/ai-agent/application/modes/chat.ts` `buildSystemPrompt`. See Requirement: Module hint for sidebar surface above.

- **AgentService.query signature debt**: as of `agent-sidebar-module-hint` archive (`a5d66f94`), `AgentService.query(...)` carries 9 positional arguments (`orgId, userId, role, prompt, surface, mode, contextHints, sessionId, moduleHint`). The `moduleHint` parameter was inserted at the 9th position (NOT the 7th as originally designed) to preserve the F1 `agent-surface-separation` surface-validation test mocks — documented in apply-progress D-1 and verified per `[[invariant_collision_elevation]]`. A dedicated follow-up SDD is tracked to refactor this to a named-options object.

- **ConversationTurn location**: `modules/ai-agent/domain/types/conversation.ts` — port-neutral discriminated union, no vendor SDK imports. Adapters (Gemini) translate to provider shapes at the infrastructure boundary only.

- **chat.constants.ts**: `MAX_CHAT_TURNS = 5`, `HARD_CAP = 10`, `MAX_TURN_FALLBACK_MESSAGE` — module-load throw enforces the hard cap. Any change to these values requires a new SDD + RED test per `[[textual_rule_verification]]`.

- **Canonicalized from change `agent-chat-tool-result-rendering`** (archived 2026-05-17, baseline `b74c379f` → final `ab45f9d4`). Engram references: spec `#2772`, design `#2771`, archive-report `sdd/agent-chat-tool-result-rendering/archive-report`.

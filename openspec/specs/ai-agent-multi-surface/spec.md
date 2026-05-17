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

#### Scenario: SCN-3.3 — sidebar-qa × cobrador returns [searchDocuments]

- GIVEN `getToolsForSurface({ surface: "sidebar-qa", role: "cobrador" })`
- THEN `result.map(t => t.name) === ["searchDocuments"]`
- (RBAC delta from `agent-surface-separation`: `PERMISSIONS_READ.documents` includes `cobrador`; the prior `getToolsForRole("cobrador") === []` was matrix-drift. Locked via engram `sdd/agent-surface-separation/rbac-deltas-lock`.)

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

## Notes

- **Runtime alias gotcha**: `modules/ai-agent/domain/tools/surfaces/index.ts` uses the RELATIVE path `../../../../permissions/domain/permissions.ts` instead of the `@/modules/permissions/...` alias. Reason: the `c1-application-shape.poc-ai-agent-hex` smoke test loads `agent.service.ts` via CommonJS `require()`, which bypasses the Vitest alias resolver in the dynamic-import chain. JSDoc at the import site (lines 1-6 of `surfaces/index.ts`) is the durable defense against well-meaning "fix the path back to alias" PRs. Type-only `@/` imports elsewhere are erased by the TS compiler and unaffected.

- **`getToolsForRole` deprecation**: `getToolsForRole` in `modules/ai-agent/domain/tools/agent.tool-definitions.ts` carries an `@deprecated` JSDoc pointing to `getToolsForSurface`. Removal is scheduled as a follow-up SDD once all callers are gone (`agent.tools.ts` barrel still re-exports it as of `4f807d7e`).

- **`isWriteAction` retention**: `isWriteAction(name)` in the same domain file is unchanged and remains authoritative for the `executeChatMode` write-vs-read suggestion-vs-direct dispatch branch. The surface filter is upstream; `isWriteAction` is downstream; they are orthogonal.

- **Multi-tool-call execution limitation**: `chat.ts:164` drops all but the first tool call when the LLM returns multiple simultaneously (`multiple_tool_calls_dropped` warn log). This pre-existing limitation affects every surface and is out of scope for this capability; it is tracked as a separate follow-up.

- **Source-of-truth permissions matrix**: `modules/permissions/domain/permissions.ts` defines `PERMISSIONS_READ` and `PERMISSIONS_WRITE` as `Record<Resource, Role[]>`. Any future tool's RBAC is determined by its `(resource, action)` tag combined with the matrix — no new entries in role-tool arrays are required.

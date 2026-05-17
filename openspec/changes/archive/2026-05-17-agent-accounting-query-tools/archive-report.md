# Archive Report: agent-accounting-query-tools (F2)

**Change**: `agent-accounting-query-tools`
**Archived**: 2026-05-17
**Artifact store**: engram (primary) — no `openspec/changes/agent-accounting-query-tools/` active folder existed
**Status**: COMPLETE — PASS WITH WARNINGS (W-01 resolved at archive)
**Verdict**: 18/18 scenarios compliant, 7876 tests passing (9 pre-existing baseline failures, 0 F2-introduced), BUILD GREEN.

---

## Executive Summary

F2 (`agent-accounting-query-tools`) completes the sidebar accounting Q&A capability for Avicont. It adds 6 new read-only tools to the `sidebar-qa` surface — `listRecentJournalEntries`, `getAccountMovements`, `getAccountBalance`, `listSales`, `listPurchases`, `listPayments` — wired through a single `AccountingQueryPort` umbrella adapter injected at the composition root. The 6 tools cover all accounting domain reads needed for a role-appropriate sidebar chat agent: contadores get all 7 sidebar tools, cobradores get 3 (searchDocuments + listSales + listPayments), members get 1. All monetary amounts are serialized to strings via `roundHalfUp(...).toFixed(2)` at the adapter boundary. The TOOL_REGISTRY surface-coverage sentinel remains GREEN with 7 sidebar-qa tools and 0 orphans. The α18 vi.mock sentinel remained at 92 (F2 handler tests hit `executeChatMode` directly without mocking permissions). One WARNING (W-01: DTO field names diverged from delta spec text) was resolved at archive by updating the canonical spec to match the adapter reality per [[textual_rule_verification]].

---

## Phase Timeline

| Phase | Date | Engram ID | Topic Key |
|-------|------|-----------|-----------|
| Exploration | 2026-05-17 | #2759 | `sdd/agent-accounting-query-tools/explore` |
| Proposal | 2026-05-17 | #2760 | `sdd/agent-accounting-query-tools/proposal` |
| Spec (delta) | 2026-05-17 | #2762 | `sdd/agent-accounting-query-tools/spec` |
| Design | 2026-05-17 | #2761 | `sdd/agent-accounting-query-tools/design` |
| Tasks | 2026-05-17 | #2763 | `sdd/agent-accounting-query-tools/tasks` |
| Apply | 2026-05-17 | #2764 | `sdd/agent-accounting-query-tools/apply-progress` |
| Verify | 2026-05-17 | #2765 | `sdd/agent-accounting-query-tools/verify-report` |
| Archive | 2026-05-17 | (this doc) | `sdd/agent-accounting-query-tools/archive-report` |
| State | 2026-05-17 | (engram) | `sdd/agent-accounting-query-tools/state` |

---

## Commit Chain (baseline `77029e5c` → HEAD)

| Hash | Description | REQs |
|------|-------------|------|
| `d3179bf9` | feat(ai-agent): scaffold AccountingQueryPort + adapter + wire composition root | REQ-16 |
| `f74b4dec` | feat(ai-agent): add listRecentJournalEntries tool + bundle in sidebar-qa | REQ-10, REQ-17 |
| `ec5df43b` | feat(ai-agent): add getAccountMovements tool + bundle in sidebar-qa | REQ-11, REQ-17 |
| `8a84715b` | feat(ai-agent): add getAccountBalance tool + bundle in sidebar-qa | REQ-12, REQ-17 |
| `11d10a4d` | feat(ai-agent): add listSales tool + bundle in sidebar-qa | REQ-13, REQ-17, REQ-18 |
| `b3b80f42` | feat(ai-agent): add listPurchases tool + bundle in sidebar-qa | REQ-14, REQ-17, REQ-18 |
| `8bdaafa8` | feat(ai-agent): add listPayments tool + bundle in sidebar-qa | REQ-15, REQ-17, REQ-18 |
| `2fe777d5` | test(ai-agent): per-role sidebar-qa tool count + name smoke | REQ-10..15 RBAC |
| `ed30fd36` | test(ai-agent): update SCN-3.3 to reflect F2 cobrador RBAC delta | REQ-13, REQ-15 |
| *(archive)* | docs(specs): amend ai-agent-multi-surface spec with F2 accounting query tools (REQ-10..18) | REQ-10..18 |

---

## Sentinel Guardrails

| Sentinel | Baseline before F2 | Final |
|----------|--------------------|-------|
| α18 vi.mock count | 92 | 92 (unchanged — F2 tests bypass permissions mock) |
| surface-tool-coverage.sentinel | GREEN (1 tool in sidebar-qa) | GREEN (7 tools, 0 orphans) |
| sidebar-qa × contador tool count | 1 | 7 |
| sidebar-qa × cobrador tool count | 1 | 3 |
| sidebar-qa × member tool count | 1 | 1 |

---

## W-01 Resolution (spec vs adapter field names)

Delta spec (engram #2762) used idealized DTO field names. Canonical spec updated at archive to match the actual port/adapter contract per [[textual_rule_verification]] and [[engram_textual_rule_verification]]:

| REQ | Field in delta spec | Field in adapter reality | Note |
|-----|---------------------|--------------------------|------|
| REQ-11 `LedgerEntryDto` | `journalEntryId` | `entryId` | Design §2 is authority post-spec |
| REQ-11 `LedgerEntryDto` | `runningBalance` | `balance` | Same — design §2 |
| REQ-13 `SaleSummaryDto` | `customerName` | `contactId` | No denormalized name in Sale aggregate |
| REQ-14 `PurchaseSummaryDto` | `supplierName` | `contactId` | No denormalized name in Purchase aggregate |
| REQ-15 `PaymentSummaryDto` | `counterpartyName` | `contactId` | Marco lock — design §10 |

Additionally REQ-13/14/15 DTO shapes in canonical spec now include extra fields present in the real DTOs (`sequenceNumber`, `description`, `purchaseType`, `status`, `method`).

No code change required — design document was the contractual authority, tests already passed against the real field names.

---

## Open Follow-ups (out of scope for F2)

| ID | Description | Priority |
|----|-------------|----------|
| S-01 | O(N) `getAccountBalance` via full ledger materialization — optimize to O(1) query if profiling shows hotspot | Low |
| S-02 | `getToolsForRole` deprecated function retirement — remove once all callers confirmed gone | Medium |
| S-03 | Multi-tool-call drop at `chat.ts:164` — `multiple_tool_calls_dropped` warn log; affects all surfaces | Medium |
| S-04 | `AgentService.query(...)` 9-positional-arg debt — refactor to named-options object | Medium |

---

## Files Affected (F2 net new + modified)

### New files
- `modules/ai-agent/domain/ports/accounting-query.port.ts` — `AccountingQueryPort` interface + 6 DTOs
- `modules/ai-agent/infrastructure/adapters/accounting-query.adapter.ts` — 5-arg adapter implementing the port
- `modules/ai-agent/__tests__/c0-accounting-port-adapter-shape.accounting-query-tools.test.ts`
- `modules/ai-agent/__tests__/list-recent-journal-entries.accounting-query-tools.test.ts`
- `modules/ai-agent/__tests__/get-account-movements.accounting-query-tools.test.ts`
- `modules/ai-agent/__tests__/get-account-balance.accounting-query-tools.test.ts`
- `modules/ai-agent/__tests__/list-sales.accounting-query-tools.test.ts`
- `modules/ai-agent/__tests__/list-purchases.accounting-query-tools.test.ts`
- `modules/ai-agent/__tests__/list-payments.accounting-query-tools.test.ts`
- `modules/ai-agent/domain/tools/surfaces/__tests__/sidebar-qa-rbac-f2.accounting-query-tools.test.ts`

### Modified files
- `modules/ai-agent/domain/tools/agent.tool-definitions.ts` — +6 `defineTool` + `TOOL_REGISTRY` entries
- `modules/ai-agent/domain/tools/surfaces/sidebar-qa.surface.ts` — 1→7 tools
- `modules/ai-agent/application/modes/chat.ts` — `ChatModeDeps` += `accountingQuery`; +6 switch cases in `handleReadCall`
- `modules/ai-agent/application/agent.service.ts` — `AgentServiceDeps` += `accountingQuery`; `query()` forwards
- `modules/ai-agent/presentation/server.ts` — 5 new factory imports + `AccountingQueryAdapter` construction
- 5 existing test files — `accountingQuery` noop stubs (mock hygiene, bundled with C0)
- `modules/ai-agent/__tests__/get-tools-for-surface.surface-separation.test.ts` — SCN-3.3 updated for F2 cobrador delta
- `openspec/specs/ai-agent-multi-surface/spec.md` — REQ-10..18 added; SCN-3.3 updated; W-01 field names corrected (archive commit)

---

## Source of Truth Updated

- `openspec/specs/ai-agent-multi-surface/spec.md` — now contains REQ-1..18 (F1 REQ-1..8, F2-mini REQ-9, F2 REQ-10..18)

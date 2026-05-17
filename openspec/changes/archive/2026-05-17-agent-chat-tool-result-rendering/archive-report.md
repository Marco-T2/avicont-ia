# Archive Report: agent-chat-tool-result-rendering (F3)

**Change**: `agent-chat-tool-result-rendering`
**Archived**: 2026-05-17
**Artifact store**: engram (primary) — no `openspec/changes/agent-chat-tool-result-rendering/` active folder existed
**Status**: COMPLETE — PASS (no warnings at archive)
**Verdict**: 20/20 scenarios compliant, 7917 tests passing (7 pre-existing baseline failures, 0 F3-introduced), BUILD GREEN.

---

## Executive Summary

F3 (`agent-chat-tool-result-rendering`) fixes the root cause of the smoke-test regression where the sidebar chat returned "Aquí están los datos solicitados." (a static placeholder) instead of the actual accounting data. The bug was architectural: `executeChatMode` was strictly 1-turn — after the LLM emitted a `tool_call`, the backend executed the tool and packaged the raw DTO into a canned response without feeding it back to the LLM. F3 replaces this with a `runChatTurnLoop` multi-turn loop: tool results are appended to conversation history as port-neutral `ConversationTurn` records, the LLM is called again with the full history, and the loop continues until the model returns a text-only response or the `MAX_CHAT_TURNS = 5` cap fires. As a natural side-effect of the loop architecture, S-03 (multi-tool drop) is also resolved — all tool_calls per turn execute sequentially via `for (const call of turnToolCalls)`. The `ConversationTurn` union lives in the domain layer with zero vendor imports; the Gemini adapter translates it to `Content[]` + `FunctionResponsePart` at the infrastructure boundary.

---

## Phase Timeline

| Phase | Date | Engram ID | Topic Key |
|-------|------|-----------|-----------|
| Exploration | 2026-05-17 | #2769 | `sdd/agent-chat-tool-result-rendering/explore` |
| Proposal | 2026-05-17 | #2770 | `sdd/agent-chat-tool-result-rendering/proposal` |
| Spec (delta) | 2026-05-17 | #2772 | `sdd/agent-chat-tool-result-rendering/spec` |
| Design | 2026-05-17 | #2771 | `sdd/agent-chat-tool-result-rendering/design` |
| Tasks | 2026-05-17 | #2773 | `sdd/agent-chat-tool-result-rendering/tasks` |
| Apply | 2026-05-17 | #2774 | `sdd/agent-chat-tool-result-rendering/apply-progress` |
| Verify | 2026-05-17 | #2775 | `sdd/agent-chat-tool-result-rendering/verify-report` |
| Archive | 2026-05-17 | (this doc) | `sdd/agent-chat-tool-result-rendering/archive-report` |
| State | 2026-05-17 | (engram) | `sdd/agent-chat-tool-result-rendering/state` |

---

## Commit Chain (baseline `b74c379f` → HEAD `ab45f9d4`)

| Hash | Description | REQs |
|------|-------------|------|
| `e3b7f8ad` | feat(ai-agent): add ConversationTurn domain type | REQ-20 |
| `3c66ae8b` | feat(ai-agent): extend LLMQuery port with optional conversationHistory | REQ-21 |
| `82b00325` | feat(ai-agent): Gemini adapter dual-mode + ConversationTurn mapping | REQ-22 |
| `761da5ed` | feat(ai-agent): introduce MAX_CHAT_TURNS = 5 with hard bound 10 | REQ-23 |
| `a6ddda2b` | feat(ai-agent): introduce runChatTurnLoop for multi-turn LLM | REQ-19, REQ-23, REQ-24, REQ-25, REQ-27, S-03 |
| `ab45f9d4` | feat(ai-agent): system prompt instructs LLM to format tool results | REQ-26 |
| *(archive)* | docs(specs): amend ai-agent-multi-surface spec with multi-turn LLM loop (REQ-19..28) | REQ-19..28 |

> Note: C4 (`a6ddda2b`) bundles cycles C5/C6/C7/C9/C10 — the multi-turn loop implementation satisfies all those scenarios simultaneously; the cycle breakdown was a planning convenience, not an implementation constraint.

---

## Sentinel Guardrails

| Sentinel | Baseline before F3 | Final |
|----------|--------------------|-------|
| α18 vi.mock count | 92 | 92 (unchanged — F3 tests do not add new `vi.mock("@/features/permissions/server")`) |
| surface-tool-coverage.sentinel | GREEN (7 tools in sidebar-qa) | GREEN (unchanged) |
| tsc --noEmit | PASS | PASS |
| Build | GREEN | GREEN |

---

## Baseline Failure Correction

The F2 archive report (mem #2756 era) stated 9 pre-existing baseline failures. The actual baseline confirmed at F3 apply via stash gate is **7 failures** — 2 were likely resolved in master between the F2 archive and the start of this SDD. None of the 7 remaining failures are caused by F3.

---

## S-03 Resolution

The pre-F3 `multiple_tool_calls_dropped` warn log at `chat.ts` (the old 1-turn path) is REMOVED. The multi-turn loop executes ALL tool_calls per turn via `for (const call of turnToolCalls)` — S-03 resolved as a natural side-effect of the architectural change. Test SCN-19.2 asserts both tools execute with no dropped event.

---

## Textual Verification (per [[textual_rule_verification]])

All REQ statements verified against implementation at archive time. No drift found:

| REQ | Verified field/text | Source | Status |
|-----|---------------------|--------|--------|
| REQ-22 | `FunctionResponsePart` wrapping: `role: "user"` | `gemini-llm.adapter.ts:134-145` | ✅ EXACT |
| REQ-23 | `MAX_CHAT_TURNS = 5`, `HARD_CAP = 10`, module-load throw | `chat.constants.ts:17-26` | ✅ EXACT |
| REQ-24 | `inputTokens`, `outputTokens`, `totalTokens`, `turnCount` in `agent_invocation` | `chat.ts:339-358` | ✅ EXACT |
| REQ-26 | `"Cuando recibas resultados de herramientas, presenta los datos al usuario en español natural y conciso."` | `chat.ts:409` | ✅ EXACT |

No code correction required — spec was written against design which matched implementation.

---

## Open Follow-ups (carried forward)

| ID | Description | Status | Priority |
|----|-------------|--------|----------|
| S-01 | O(N) `getAccountBalance` via full ledger materialization — optimize to O(1) query if profiling shows hotspot | Open (from F2) | Low |
| S-02 | `getToolsForRole` deprecated function retirement — remove once all callers confirmed gone | Open (from F2) | Medium |
| S-03 | Multi-tool-call drop | **RESOLVED** in this SDD (F3) | — |
| S-04 | `AgentService.query(...)` 9-positional-arg debt — refactor to named-options object | Open (from F2) | Medium |
| S-05 (new) | `chat.ts` grew from 542→570 LOC (C4 + C8). Future refactor candidate: extract `runChatTurnLoop` to `chat-turn-loop.ts` if file continues to grow. No action needed now — file is still coherent. | Open | Low |

---

## Files Affected (F3 net new + modified)

### New files
- `modules/ai-agent/domain/types/conversation.ts` — port-neutral `ConversationTurn` union
- `modules/ai-agent/application/modes/chat.constants.ts` — `MAX_CHAT_TURNS`, `HARD_CAP`, `MAX_TURN_FALLBACK_MESSAGE`
- `modules/ai-agent/domain/__tests__/conversation-turn.type.test.ts` — 9 tests (REQ-20)
- `modules/ai-agent/domain/__tests__/llm-provider.port.test.ts` — 4 tests (REQ-21)
- `modules/ai-agent/infrastructure/llm/__tests__/gemini-llm.adapter.history.test.ts` — 7 tests (REQ-22)
- `modules/ai-agent/application/modes/__tests__/chat.constants.test.ts` — 5 tests (REQ-23)
- `modules/ai-agent/application/modes/__tests__/chat.multi-turn.test.ts` — 11 tests (REQ-19, REQ-23, REQ-24, REQ-25, REQ-27)
- `modules/ai-agent/application/modes/__tests__/chat.system-prompt.test.ts` — 3 tests (REQ-26)

### Modified files
- `modules/ai-agent/domain/ports/llm-provider.port.ts` — optional `conversationHistory` field on `LLMQuery` (REQ-21)
- `modules/ai-agent/infrastructure/llm/gemini-llm.adapter.ts` — `mapTurnsToGeminiContents`, `wrapForFunctionResponse`, dual-mode `query` dispatch (REQ-22)
- `modules/ai-agent/application/modes/chat.ts` — `runChatTurnLoop` replaces 1-turn read path; `executeReadTool` returns raw data; aggregated telemetry + `turnCount`; system prompt format instruction (REQ-19, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28)
- 6 × `modules/ai-agent/__tests__/*.accounting-query-tools.test.ts` — mock target rewrites per [[mock_hygiene_commit_scope]] (F2 tests asserted `result.suggestion.data`; F3 contract returns raw data via `conversationHistory[i].result`)
- `openspec/specs/ai-agent-multi-surface/spec.md` — REQ-19..28 added; S-03 note updated; multi-turn Notes added (archive commit)

---

## Source of Truth Updated

- `openspec/specs/ai-agent-multi-surface/spec.md` — now contains REQ-1..28 (F1 REQ-1..8, F2-mini REQ-9, F2 REQ-10..18, F3 REQ-19..28)

---

## Smoke Test Verification Needed

Marco should re-run "mostrame los últimos asientos" (or similar accounting query) in the sidebar chat to confirm the fix works end-to-end: the response should now contain actual journal entry data formatted in natural Spanish, NOT the static "Aquí están los datos solicitados." placeholder.

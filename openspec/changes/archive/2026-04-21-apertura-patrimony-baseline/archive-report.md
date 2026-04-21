# Archive Report: apertura-patrimony-baseline

**Archived**: 2026-04-21
**Verdict**: PASS WITH WARNINGS (from verify-report)

## Specs Synced
| Domain | Action | Details |
|--------|--------|---------|
| equity-statement-typed-movements | Updated | REQ-3 MODIFIED (full block replaced with apertura-aware invariant) + REQ-APERTURA-MERGE ADDED (6 scenarios) |

## Archive Contents
- proposal.md
- specs/equity-statement-typed-movements/spec.md
- design.md
- tasks.md (17/17 complete)
- exploration.md
- verify-report.md
- archive-report.md (this file)

## Implementation Commits
- fdf4158 test(apertura): add repo tests for getAperturaPatrimonyDelta (T01-T05)
- 82c9fc5 feat(apertura): add getAperturaPatrimonyDelta repo method (T06)
- d61237e feat(apertura): add optional aperturaBaseline field to BuildEquityStatementInput (T07)
- 2f9e06a test(apertura): add builder test for aperturaBaseline absorption into SALDO_INICIAL (T09)
- 43f0f47 test(apertura): lock retrocompat — builder ignores aperturaBaseline when absent (T10)
- a5f34c6 feat(apertura): merge aperturaBaseline into initialByColumn pre-invariant (T11)
- 7bebe44 test(apertura): add service test for getAperturaPatrimonyDelta wiring (T12)
- 2a4278e feat(apertura): wire getAperturaPatrimonyDelta into service Promise.all (T13)
- 5accd71 test(apertura): add integration tests for newborn-company happy path and N+1 no-double-count (T14, T15)
- 5aac6bf test(apertura): add regression guard for date-range lower bound (T17)
- 229f0e4 chore(apertura): mark T14-T18 and DoD items complete

## Manual Smoke Results (user-verified)
- April 2026 newborn company: SALDO_INICIAL[CAPITAL_SOCIAL]=200000, imbalanced=false, no banner ✅
- May 2026 period N+1: SALDO_INICIAL=200000 (via getPatrimonioBalancesAt), no double-count ✅

## Engram Observation IDs (Traceability)
- proposal: 880
- spec: (in openspec filesystem only)
- design: (in openspec filesystem only)
- tasks: 884
- apply-progress: (in openspec filesystem only)
- verify-report: (in openspec filesystem only)

## Source of Truth Updated
- openspec/specs/equity-statement-typed-movements/spec.md (REQ-3 updated + REQ-APERTURA-MERGE added)

## SDD Cycle Complete
Ready for the next change.

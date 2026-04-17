# Archive Report: manual-journal-ux

**Change**: `manual-journal-ux`
**Archived**: 2026-04-17
**Status**: CLOSED — PASS
**Verdict**: 9/9 REQs COMPLIANT, 952/952 tests, tsc clean

## Intent

Close the UX gap on manual journal entries (asientos contables manuales — traspasos, ajustes, apertura, cierre). The model/service/API already supported them, but the UI treated them identically to auto-generated entries: no edit capability post-DRAFT, no visual distinction, and — discovered mid-cycle — no "Editar" button on the detail page for POSTED manuals.

## Scope Delivered

7 PRs, 35 tasks, 53 new tests.

1. **PR1 — Shared plumbing**: `AUTO_ENTRY_VOID_FORBIDDEN` error code + `features/accounting/journal.ui.ts` with `sourceTypeLabel()` helper
2. **PR2 — Void guard**: `transitionStatus` rejects API void of auto-JE (sourceType !== null); internal cascades via direct `tx.journalEntry.update` unaffected
3. **PR3 — Edit page unlock**: `/accounting/journal/[id]/edit` accepts POSTED manual
4. **PR4 — Origin badge**: list + detail show badge via `sourceTypeLabel()`
5. **PR5 — Manual/Auto filter**: `JournalFilters.origin` + repo query + UI Select + URL persistence
6. **PR6 — Display-date fix**: `journal-entry-list` + `detail` use `formatDateBO()` — closes deferred D.5 from `fix-comprobante-date-tz`
7. **PR7 — Detail button + period-gate** (scope extension post-batch-3): detail "Editar" button for DRAFT/POSTED manual while period OPEN; edit page 404 when period CLOSED; dialog copy honest

## Business Rule (final)

| Status JE | Origin | Period | Editable? |
|-----------|--------|--------|-----------|
| DRAFT | manual | OPEN | YES |
| DRAFT | manual | CLOSED | NO |
| POSTED | manual | OPEN | YES |
| POSTED | manual | CLOSED | NO |
| POSTED | auto | any | NO |
| VOIDED | any | any | NO |

## Commits (chronological)

- `99eeb26` feat(errors): AUTO_ENTRY_VOID_FORBIDDEN
- `1be0596` feat(accounting): journal.ui.ts + sourceTypeLabel
- `d6904f8` feat(accounting): transitionStatus guard
- `8228d60` feat(journal): edit page unlock for POSTED manual
- `c302864` chore(sdd): PR1+PR2+PR3 done
- `48a362f` test(journal-ui): RED origin badge
- `2245947` feat(journal): origin badge wired
- `da16735` test(journal-ui): RED origin filter
- `5e277af` feat(journal): origin filter end-to-end
- `f7b51e7` chore(sdd): PR4+PR5 done
- `77187b2` test(accounting): RED display-date
- `888cbec` fix(accounting): formatDateBO in list+detail
- `77ec745` chore(sdd): PR6 done
- `bc2f610` docs(sdd): amend REQ-A.1 + add REQ-A.2
- `4304130` test(accounting): RED T7.1-T7.6 detail button
- `1e3a6a8` test(accounting): RED T7.8-T7.9 period-gate
- `eb14fd7` feat(accounting): period-gate + detail button + dialog copy
- `73e4cb2` chore(sdd): PR7 complete
- `9edc640` docs(sdd): align REQ-B.3 S-B3.6 fallback label to implemented copy

## Files Modified

- `features/shared/errors.ts` — new error code
- `features/accounting/journal.ui.ts` — new file
- `features/accounting/journal/journal.service.ts` — guard added
- `features/accounting/journal/journal.repository.ts` — filter support
- `components/accounting/journal-entry-list.tsx` — badge + filter + formatDateBO
- `components/accounting/journal-entry-detail.tsx` — badge + formatDateBO + period-gate button + dialog copy
- `app/organizations/[orgSlug]/accounting/journal/[id]/edit/page.tsx` — guard relaxation + period-gate
- Spec trail: `openspec/changes/manual-journal-ux/*.md`

## Known Non-Blocking Items

- **S-1 (SUGGESTION)**: T2.3b internal cascade test is an architectural contract (`expect(true).toBe(true)`) rather than a live regression spy. Improve with a real `vi.spyOn(transitionStatus)` if SaleService is ever refactored.
- **Pre-existing bug** from design note D.7: `status/route.ts:29` passes `justification` as 5th arg but position 5 is `role?`. Out of scope — separate change.

## Follow-ups

- `manual-journal-templates` (Approach 2 from exploration): "Duplicar asiento" button on detail for repetitive traspasos diarios caja↔banco
- Improve S-1 test with a real service-boundary spy

## Related Changes

- Depends on `fix-comprobante-date-tz` (`formatDateBO` helper, `TZ=America/La_Paz` vitest env)
- Closes deferred item from `fix-comprobante-date-tz` design D.5 (accounting display dates)

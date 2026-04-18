# Archive Report: voucher-types

**Change**: `voucher-types`
**Archived**: 2026-04-17
**Status**: CLOSED — PASS
**Verdict**: 25/26 scenarios COMPLIANT (1 PARTIAL on doc-only), 1005/1005 tests, tsc clean

---

## Intent

Migrate `VoucherTypeCfg.code` from Prisma enum `VoucherTypeCode` to plain `String` to enable dynamic code management without schema migrations. Add `prefix` column on `VoucherTypeCfg` so `{prefix}{YYMM}-{NNNNNN}` display format is DB-driven instead of hardcoded TS map. Deliver full per-org CRUD admin UI. Expand standard seed 5→8 Bolivian types (CN Nómina, CM Depreciación, CB Bancario). Harden `getNextNumber()` against races via optimistic retry.

## Scope Delivered

- ✅ Schema migration (enum → String + prefix column) with 5-step backfill SQL
- ✅ 8-type seed with upsert on `{organizationId_code}`
- ✅ `correlative.utils` signature change: `(prefix, date, number)`; 6 callsites updated
- ✅ Concurrency retry in `JournalRepository.createWithRetryTx` (5-attempt loop, P2002 detection)
- ✅ `VOUCHER_NUMBER_CONTENTION`, `VOUCHER_TYPE_CODE_DUPLICATE`, `VOUCHER_TYPE_CODE_IMMUTABLE` errors
- ✅ CRUD API: POST + PATCH + `?active=true` filter + `_count` include
- ✅ Zod `.strict()` enforces code immutability at validation layer
- ✅ Admin UI `voucher-types-manager.tsx` (inline rows, toggle, POST/PATCH)
- ✅ Journal form dropdown filters to active + preserves stale selection in edit mode
- ✅ Journal detail renders "Inactivo" badge for historical entries

## Canonical Commits

```
06aeb0e feat(voucher-types): CRUD admin + migration + concurrency retry
f3b1779 docs(voucher-types): SDD artifacts — proposal, spec, design, tasks
```

## Artifacts

| Phase | Location (filesystem) | Engram topic key |
|-------|----------------------|------------------|
| Proposal | `archive/2026-04-17-voucher-types/proposal.md` | `sdd/voucher-types/proposal` |
| Spec | `archive/2026-04-17-voucher-types/spec.md` | `sdd/voucher-types/spec` |
| Design | `archive/2026-04-17-voucher-types/design.md` | `sdd/voucher-types/design` |
| Tasks | `archive/2026-04-17-voucher-types/tasks.md` | `sdd/voucher-types/tasks` |
| Apply | — | `sdd/voucher-types/apply-progress` |
| Verify | `archive/2026-04-17-voucher-types/verify-report.md` | `sdd/voucher-types/verify-report` |
| Archive | `archive/2026-04-17-voucher-types/archive-report.md` | `sdd/voucher-types/archive-report` |

## Specs Synced to Main

| Domain | Action | Source of Truth |
|--------|--------|----------------|
| `voucher-type-management` | CREATED | `openspec/specs/voucher-type-management/spec.md` |
| `voucher-type-sequence` | CREATED | `openspec/specs/voucher-type-sequence/spec.md` |
| `voucher-type-schema-migration` | CREATED | `openspec/specs/voucher-type-schema-migration/spec.md` |
| `voucher-type-seed` | CREATED | `openspec/specs/voucher-type-seed/spec.md` |

All 4 capabilities are NEW — no existing main specs to merge against.

## Phase Completion

| Phase | Status | Notes |
|-------|--------|-------|
| explore | ✅ | CRUD admin + concurrency hardening + seed expansion analyzed |
| propose | ✅ | 3 scope items + rollback + success criteria |
| spec | ✅ | 4 domains, 13 REQs, 26 scenarios |
| design | ✅ | D.1..D.9 decisions; 5-step migration; Zod `.strict()` for immutability |
| tasks | ✅ | 6 PRs, 30 tasks (14 RED, 14 GREEN, 2 verify/docs) |
| apply | ✅ | Strict TDD; all 30 tasks complete; 1005/1005 green |
| verify | ✅ | 25/26 scenarios COMPLIANT; 1 PARTIAL (C.4-S1 doc-only) |
| archive | ✅ | Specs synced, folder moved to `archive/2026-04-17-voucher-types/` |

## Open Items (not blockers)

- **S-1**: REQ-C.4 inverse migration is documented in comments within `migration.sql` rather than a separate executable `down.sql`. Matches Prisma convention; no action unless future policy requires executable down scripts.
- **S-2**: Next.js dev RSC cache served stale `voucherTypes` list once after a toggle; resolved by dev server restart. If it recurs in production, revisit streaming Server Actions or explicit `revalidatePath`.

## SDD Cycle Complete

Ready for the next change.

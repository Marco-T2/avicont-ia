# Apply Progress: rbac-page-gating-fix

**Status**: COMPLETE
**Started**: 2026-04-18
**Artifact Store**: hybrid

## PR1 — 12 Bypass Pages (T1.1–T1.25) — STATUS: COMPLETE

- [x] T1.1 — RED test: accounting/contacts (RED verified: 2/2 fail before GREEN)
- [x] T1.2 — GREEN impl: accounting/contacts (requirePermission("contacts","read",orgSlug))
- [x] T1.3 — RED test: accounting/cxc
- [x] T1.4 — GREEN impl: accounting/cxc (sales:read)
- [x] T1.5 — RED test: accounting/cxp
- [x] T1.6 — GREEN impl: accounting/cxp (purchases:read)
- [x] T1.7 — RED test: accounting/journal
- [x] T1.8 — GREEN impl: accounting/journal (journal:read)
- [x] T1.9 — RED test: accounting/ledger
- [x] T1.10 — GREEN impl: accounting/ledger (journal:read)
- [x] T1.11 — RED test: dispatches
- [x] T1.12 — GREEN impl: dispatches (sales:read — NOT dispatches, per REQ-PG.7)
- [x] T1.13 — RED test: informes
- [x] T1.14 — GREEN impl: informes (reports:read)
- [x] T1.15 — RED test: informes/impuestos/libro-compras
- [x] T1.16 — GREEN impl: informes/impuestos/libro-compras (reports:read)
- [x] T1.17 — RED test: informes/impuestos/libro-ventas
- [x] T1.18 — GREEN impl: informes/impuestos/libro-ventas (reports:read)
- [x] T1.19 — RED test: payments
- [x] T1.20 — GREEN impl: payments (payments:read)
- [x] T1.21 — RED test: purchases
- [x] T1.22 — GREEN impl: purchases (purchases:read)
- [x] T1.23 — RED test: sales
- [x] T1.24 — GREEN impl: sales (sales:read)
- [x] T1.25 — Regression guard: vitest 1675/1675 pass, tsc exit 0, grep of 12 PR1 pages clean (0 hits for requireRole|requireAuth|requireOrgAccess)

### Deviations from plan (PR1)

- **informes/page.tsx**: dropped `let orgId: string; ... orgId = result.orgId;` because the page body never consumes `orgId` (renders `<CatalogPage orgSlug={orgSlug} />` only). Used shorter form `try { await requirePermission("reports","read",orgSlug); } catch { redirect(\`/${orgSlug}\`); }`. Semantic equivalence preserved; REQ-PG.10 is satisfied implicitly (no orgId-dependent logic exists to satisfy).
- No other deviations.

## PR2 — 4 requireRole Upgrades (T2.1–T2.9) — STATUS: COMPLETE

- [x] T2.1 — RED test: accounting/monthly-close (RED: 2/2 fail — page used requireRole)
- [x] T2.2 — GREEN impl: accounting/monthly-close (journal:read; triple chain removed atomically; also removed non-null assertion `orgId!`)
- [x] T2.3 — RED test: accounting/financial-statements (RED: test 1 fails — requirePermission never called)
- [x] T2.4 — GREEN impl: accounting/financial-statements (reports:read)
- [x] T2.5 — RED test: accounting/financial-statements/balance-sheet
- [x] T2.6 — GREEN impl: accounting/financial-statements/balance-sheet (reports:read)
- [x] T2.7 — RED test: accounting/financial-statements/income-statement
- [x] T2.8 — GREEN impl: accounting/financial-statements/income-statement (reports:read)
- [x] T2.9 — Regression guard: vitest 1683/1683 pass (185 files), tsc exit 0, grep "requireRole" on **/page.tsx = 0 hits (REQ-PG.8), zero orphan requireAuth/requireOrgAccess imports in all 16 modified pages (REQ-PG.13)

### Deviations from plan (PR2)

- **financial-statements/page.tsx + balance-sheet/page.tsx + income-statement/page.tsx**: dropped `let orgId: string; ... orgId = result.orgId;` because these 3 pages' bodies don't use orgId (only pass `orgSlug` to their respective client components). Used shorter form `try { await requirePermission("reports","read",orgSlug); } catch { redirect(\`/${orgSlug}\`); }`. Same rationale as `informes/page.tsx` deviation in PR1 — pattern is consistent.
- **accounting/monthly-close/page.tsx**: followed the canonical `let orgId: string` form (page uses orgId for `periodsService.list(orgId)`). Also removed pre-existing `orgId!` non-null assertion from line 25 of the old code — improvement beyond the stated task scope, but aligned with DCSN-002's rejection of non-null assertions. Previously-broken redirect to `/sign-in` on any failure (including role denial) is now correctly `/${orgSlug}` on permission denial — this aligns with REQ-PG.2 and is a behavior improvement.
- **RED test for 3 financial-statements pages**: only test 1 shows explicit assertion failure (not both 2). Reason: the existing pre-migration pages have 3 try/catch blocks where the third catches requireRole failures and already redirects to `/${orgSlug}`, which accidentally satisfies test 2 for the wrong reason. However, test 1 reliably fails because `requirePermission` is never called — which is the genuine RED state proving the gate is missing. Sufficient to justify GREEN.

## Final verification

- **Full vitest**: 1683/1683 passing (185 test files, 1675 from PR1 + 8 new from PR2 × 4 pages × 2 assertions)
- **tsc --noEmit**: exit 0 (zero type errors)
- **grep requireRole in app/**/page.tsx**: 0 hits (REQ-PG.8 satisfied)
- **grep requireAuth|requireOrgAccess|requireRole in all 16 modified pages**: 0 hits (REQ-PG.13 satisfied)

### Files modified (16)

All under `app/(dashboard)/[orgSlug]/`:
1. `accounting/contacts/page.tsx` — contacts:read
2. `accounting/cxc/page.tsx` — sales:read
3. `accounting/cxp/page.tsx` — purchases:read
4. `accounting/journal/page.tsx` — journal:read
5. `accounting/ledger/page.tsx` — journal:read
6. `dispatches/page.tsx` — sales:read
7. `informes/page.tsx` — reports:read
8. `informes/impuestos/libro-compras/page.tsx` — reports:read
9. `informes/impuestos/libro-ventas/page.tsx` — reports:read
10. `payments/page.tsx` — payments:read
11. `purchases/page.tsx` — purchases:read
12. `sales/page.tsx` — sales:read
13. `accounting/monthly-close/page.tsx` — journal:read (U)
14. `accounting/financial-statements/page.tsx` — reports:read (U)
15. `accounting/financial-statements/balance-sheet/page.tsx` — reports:read (U)
16. `accounting/financial-statements/income-statement/page.tsx` — reports:read (U)

### Files created (16 tests)

All under `__tests__/page.test.ts` for the above pages.

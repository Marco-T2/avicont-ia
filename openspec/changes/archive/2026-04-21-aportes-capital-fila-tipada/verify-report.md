# Verification Report — aportes-capital-fila-tipada

**Change**: `aportes-capital-fila-tipada`
**Version**: N/A (delta spec: `equity-statement-typed-movements` + `voucher-type-seed`)
**Mode**: **Strict TDD**
**Date**: 2026-04-21

---

## Completeness

| Metric | Value |
|--------|-------|
| Batches total (T01–T10)   | 10 |
| Batches complete          | 10 |
| Sub-tasks total           | 27 |
| Sub-tasks marked `[x]`    | 19 |
| Sub-tasks still `[ ]`     | 8  |

### Sub-tasks still marked `[ ]`

All correspond to T01–T04 and are **cleanup-only**. The underlying work landed in git (see TDD cycle evidence below) but the tasks.md cleanup was not applied in the session that produced those commits:

- T01-RED / T01-GREEN / T01-COMMIT  (seed CP/CL/CV)
- T02-RED / T02-GREEN / T02-COMMIT  (backfill script)
- T03-COMMIT  (types contract)
- T04-COMMIT  (repository method)

**Definition of Done** — 5 of 7 checked. The 2 remaining items are **manual dev-server smoke checks** that require a human in the loop:
- [ ] Asiento CP 200k → fila tipada, sin banner imbalanced (manual)
- [ ] EEPN sin typed entries → idéntico a v1 (3 filas) (manual)

---

## Build & Tests Execution

### Type-check (in-scope)
- `npx tsc --noEmit` — **0 errors** inside `features/accounting/equity-statement/**` and `prisma/seeds/**`.
- 7 pre-existing errors outside scope (voucher-pdf composer, worksheet PDF/XLSX) — **not introduced by this change**. Out of scope per T10-CHECK.

### Tests — full suite
- `npx vitest run` — **270 test files / 2316 tests passed** (full suite, prior session).
- Targeted run (non-DB subset, 6 files / 82 tests) — **all passing**, 1.38s.

### Coverage — non-DB subset
- Statements: **77.32%** (249/322)
- Branches:   **69.4%**  (93/134)
- Functions:  **76.78%** (43/56)
- Lines:      **77.96%** (230/295)

> Subset excludes the two DB-backed suites (`equity-statement.repository.test.ts`, `equity-statement.integration.test.ts`) which would raise branch coverage of the repository module significantly. No coverage threshold is configured for this change — values are informational.

---

## Strict TDD Compliance

### TDD Cycle Evidence (from git history)

| Batch | RED commit (test) | GREEN commit (feat) | Cycle respected? |
|-------|-------------------|---------------------|------------------|
| T01 — seed CP/CL/CV | bundled in `b2a05d5` | bundled in `b2a05d5` | ⚠️ **combined** |
| T02 — backfill script | bundled in `d67fffe` | bundled in `d67fffe` | ⚠️ **combined** |
| T03 — types contract | bundled in `0ec1ef2` | bundled in `0ec1ef2` | ⚠️ **combined** |
| T04 — repo method | bundled in `3976552` | bundled in `3976552` | ⚠️ **combined** |
| T05 — builder typed rows | `1454f3c test(eepn)…` | `75a32b6 feat(eepn)…` | ✅ |
| T06 — service wiring | `f7b815a test(eepn)…` | `7e64a00 feat(eepn)…` | ✅ |
| T07 — exporter refactor | `e130efa test(eepn-exporters)…` | `a074d5a refactor(eepn-exporters)…` | ✅ |
| T08 — UI verify | `04b5b98 docs(eepn-ui)…` | (no code change) | ✅ verify-only |
| T09 — CP integration | `9e0f14c test(eepn-integration)…` | (builder/service already green) | ✅ |

**Finding**: T01–T04 were delivered as single commits containing both tests and implementation. Tests are present and passing, but the per-commit RED → GREEN split mandated by Strict TDD was not recorded separately. From T05 onward the discipline is clean.

### Apply-progress TDD Cycle Table
The `apply-progress` artifact (engram observation #874) **does NOT include** the "TDD Cycle Evidence" table required by `strict-tdd-verify.md` Step 5a. Mitigated by the git-history table above.

### Assertion Quality Audit
Scanned all 9 in-scope test files — **no trivial or meaningless assertions found**:
- No tautologies (`expect(x).toBe(x)`)
- No empty-only checks (`expect(…).toBeDefined()` as sole assertion)
- No ghost loops (iteration without assertion)
- No smoke-only tests (every test makes ≥1 concrete claim about behavior)
- `Prisma.Decimal` equality uses `.equals(...)` consistently (no string-coerced comparisons)

---

## Spec Compliance Matrix (behavioral)

### `equity-statement-typed-movements`

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-1 | S1: CP 200k → fila APORTE_CAPITAL · 200k en CAPITAL_SOCIAL | `equity-statement.builder.test.ts > "REQ-1-S1 — CP 200k …"` | ✅ COMPLIANT |
| REQ-1 | S1 (repo layer): CP POSTED agregado en Map | `equity-statement.repository.test.ts > "REQ-1 — CP POSTED …"` | ✅ COMPLIANT |
| REQ-1 | S1 (repo layer): CL POSTED agregado en Map | `equity-statement.repository.test.ts > "REQ-1 — CL POSTED …"` | ✅ COMPLIANT |
| REQ-1 | S2: typedMovements vacío → 3 filas v1 | `equity-statement.builder.test.ts > "REQ-1-S2 — typedMovements vacío …"` | ✅ COMPLIANT |
| REQ-1 | Integration: CP 200k end-to-end (real DB) | `equity-statement.integration.test.ts > "CP 200k aporte produces APORTE_CAPITAL …"` | ✅ COMPLIANT |
| REQ-2 | S1: CP+CL+CV + resultado → 6 filas en orden canónico | `equity-statement.builder.test.ts > "REQ-2-S1 …"` | ✅ COMPLIANT |
| REQ-2 | S2: solo CP → 4 filas | `equity-statement.builder.test.ts > "REQ-2-S2 …"` | ✅ COMPLIANT |
| REQ-3 | S1: CP tipado coherente → imbalanced=false | `equity-statement.builder.test.ts > "REQ-3-S1 …"` | ✅ COMPLIANT |
| REQ-3 | S2: 200k sin voucher tipado (delta huérfano) → imbalanced=true | `equity-statement.builder.test.ts > "REQ-3-S2 …"` | ✅ COMPLIANT |
| REQ-4 | CV débito a 3.4 por 50k → DISTRIBUCION_DIVIDENDO con −50k en RA | `equity-statement.builder.test.ts > "REQ-4 — CV débito …"` + `equity-statement.repository.test.ts > "REQ-4 — CV POSTED …"` | ✅ COMPLIANT |
| REQ-5 | CV presente + preliminary=true → SALDO_FINAL[RA] NO proyecta periodResult | `equity-statement.builder.test.ts > "REQ-5 …"` | ✅ COMPLIANT |
| REQ-6 | PDF y XLSX iteran por `row.key`, `SALDO_FINAL` bold por clave | `equity-statement-pdf.exporter.test.ts > "T07 — only SALDO_FINAL row has bold cells"` + `equity-statement-xlsx.exporter.test.ts > "T07 — statement with 5 rows …"` | ✅ COMPLIANT |

### `voucher-type-seed`

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-D.1 | S1: fresh org → 12 rows (9 legacy + CP/CL/CV) | `voucher-types.seed.test.ts > "D.1-S1 — fresh org: upsert invoked once per standard code"` | ✅ COMPLIANT |
| REQ-D.1 | S2: idempotente (upsert semantics) | `voucher-types.seed.test.ts > "D.1-S2 — re-running on the same org uses upsert …"` | ✅ COMPLIANT |
| REQ-D.1 | S3: prefix no vacío | `voucher-types.seed.test.ts > "D.1-S3 — every entry has the expected single-character prefix"` | ✅ COMPLIANT |
| REQ-D.1 | S4: no importa enum VoucherTypeCode | `voucher-types.seed.test.ts > "D.1-S4 — voucher-types.ts does NOT import VoucherTypeCode"` | ✅ COMPLIANT |
| REQ-D.1 | S5: CJ isAdjustment=true; CP/CL/CV false | `voucher-types.seed.test.ts > "D.1-S5 — CJ is the only entry flagged as isAdjustment=true"` + "D.1-S5b", "D.1-S5c" | ✅ COMPLIANT |
| REQ-D.1 | S6: re-seed en org con legacy → adds CP/CL/CV sin mutar | `voucher-types.seed.test.ts > "D.1-S6 — re-seed on org with 9 legacy types …"` | ✅ COMPLIANT |
| REQ-D.2 | S1: org con types legacy → backfill agrega CP/CL/CV | `backfill-patrimony-voucher-types.test.ts > "D.2-S1 — con 2 orgs …"` | ✅ COMPLIANT |
| REQ-D.2 | S2: org vacía → backfill seedea los 12 | `backfill-patrimony-voucher-types.test.ts > "D.2-S2 — org sin types …"` | ✅ COMPLIANT |
| REQ-D.2 | S3: segunda corrida idempotente | `backfill-patrimony-voucher-types.test.ts > "D.2-S3 — segunda corrida …"` | ✅ COMPLIANT |

**Compliance summary**: **21 / 21 scenarios compliant** (100%).

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|-------------|--------|-------|
| REQ-1 (row emission from voucher code) | ✅ Implemented | `TYPED_ROW_CONFIG` drives emission in `equity-statement.builder.ts`; raw SQL in `equity-statement.repository.ts:92-137` filters `vt.code IN ('CP','CL','CV')`. |
| REQ-2 (canonical row order) | ✅ Implemented | `typedCandidates: Array<{order, row}>` sort chain in builder. |
| REQ-3 (imbalance recalculated with typed rows) | ✅ Implemented | Invariant `initial + Σtyped + result = final` in builder. Backward-compatible when typed empty. |
| REQ-4 (CV debit to 3.4 produces negative delta) | ✅ Implemented | ACREEDORA sign convention in raw SQL: `credit - debit`. |
| REQ-5 (CV bypass projection) | ✅ Implemented | `cvTouchesResultados` flag short-circuits periodResult projection. |
| REQ-6 (exporters iterate by key) | ✅ Implemented | Both PDF and XLSX exporters use `row.key === "SALDO_FINAL"` instead of `idx === 2`. |
| REQ-D.1 (seed 12 types, CJ + CP/CL/CV) | ✅ Implemented | `DEFAULT_VOUCHER_TYPES` = 12 entries, `isAdjustment` on CJ only. |
| REQ-D.2 (backfill script idempotent) | ✅ Implemented | `backfill-patrimony-voucher-types.ts` iterates orgs + upserts with `update:{}`. |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Approach A: voucher-type driven classification | ✅ Yes | Raw SQL filters `vt.code IN ('CP','CL','CV')` rather than relying on isAdjustment or account-only heuristics. |
| Exact-match voucher codes (no namespacing) | ✅ Yes | Repo query uses literal `'CP','CL','CV'`. |
| `Prisma.Decimal` arithmetic throughout | ✅ Yes | No number coercion found in builder, repo or service paths. |
| Signed-net ACREEDORA convention | ✅ Yes | `credit - debit` in getTypedPatrimonyMovements. |
| Isolated integration fixture for T09 | ✅ Yes | Separate `beforeAll/afterAll` with fresh org — does not pollute shared fixture. |
| Backward compatibility: 3-row case | ✅ Yes | Empty typedMovements → `stmt.rows` still `[SALDO_INICIAL, RESULTADO_EJERCICIO, SALDO_FINAL]`. Covered by REQ-1-S2. |

---

## Issues Found

### CRITICAL (must fix before archive)
**None.**

### WARNING (should fix)
1. **T01–T04 TDD cycle bundled in single commits.** `b2a05d5`, `d67fffe`, `0ec1ef2`, `3976552` each contain both test files and implementation. Strict TDD requires separate test(RED) → feat(GREEN) commits. Tests exist and pass, but the process record is incomplete. No code change required; documentation for future sessions.
2. **Apply-progress artifact (observation #874) is missing the "TDD Cycle Evidence" table** required by `strict-tdd-verify.md` Step 5a. Mitigated by git log, but the artifact itself does not satisfy the template.
3. **tasks.md still marks 8 sub-tasks as `[ ]`** (all T01–T04 RED/GREEN/COMMIT lines plus some). The work landed in git but the checkboxes were never updated. Pure housekeeping.

### SUGGESTION (nice to have)
1. **Manual dev-server smoke checks pending** (2 DoD items). Should be executed by a human before tagging the change "production-ready".
2. **Coverage is moderate on the non-DB subset** (77% stmt / 69% branch). Repository module coverage will rise with integration tests running against a live DB; consider running full `npx vitest run` with coverage in CI.
3. **VoucherTypeCode enum removal** is referenced in seed file but not verified at the TypeScript level. `D.1-S4` covers the literal grep; consider a second check that the enum is also absent from Prisma schema imports.

---

## Verdict

### ✅ **PASS WITH WARNINGS**

All 21 spec scenarios across both specs are behaviorally compliant — every scenario maps to a named test that passed in the full suite run. Implementation matches design (Approach A, voucher-type driven). Backward compatibility preserved (typedMovements-empty case yields legacy 3-row output).

Warnings are **process/documentation** issues, not correctness issues:
- T01–T04 committed as bundled test+feat rather than split test→feat
- Apply-progress observation lacks its required TDD table
- tasks.md housekeeping for T01–T04 rows

**Recommendation**: Proceed to `sdd-archive`. The two pending manual dev-server smoke checks remain the user's responsibility before announcing the change as production-ready.

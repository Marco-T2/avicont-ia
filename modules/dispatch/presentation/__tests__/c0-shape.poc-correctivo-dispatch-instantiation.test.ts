/**
 * POC correctivo dispatch-instantiation — C0 RED textual gate
 * corrective POC fixing 7 broken `new DispatchService()` (zero-args form)
 * consumer sites post-dispatch-hex C4 cutover (commit e3e6ad8b).
 *
 * Root cause: `poc-dispatch-hex` C4 cutover switched DispatchService
 * constructor to require `DispatchServiceDeps` arg. 7 consumer sites in
 * `app/` were NOT updated — they still call `new DispatchService()` (no-arg),
 * breaking `pnpm build` at TSC.
 *
 * Fix axis: replace `new DispatchService()` → `makeDispatchService()` factory
 * at all 7 runtime consumer sites + add barrel re-export + extend 3 test mocks.
 * Paired sister: `poc-correctivo-contacts` (4-commit corrective precedent).
 *
 * 18α distribution (per spec §2 normalized table):
 *   α1-α14  — 7 consumer sites × POS+NEG (makeDispatchService() present /
 *              new DispatchService() zero-args absent)
 *   α15     — barrel re-export on modules/dispatch/presentation/server.ts
 *   α16-α18 — 3 test mock files contain makeDispatchService keyword
 *
 * ROOT = 4 levels up from __tests__/ dir (mirror sister contacts corrective EXACT):
 *   modules/dispatch/presentation/__tests__/ → modules/dispatch/presentation/
 *   → modules/dispatch/ → modules/ → (project root)
 *
 * Expected failure mode pre-GREEN (per [[red_acceptance_failure_mode]] +
 * [[enumerated_baseline_failure_ledger]]): ALL 18 FAIL at C0 commit state.
 *
 *   α1  FAIL: page.tsx has `new HubService(makeSaleService(), new DispatchService())`
 *             at line 29 — makeDispatchService() call absent
 *   α2  FAIL: `new DispatchService()` present in dispatches/page.tsx line 29
 *   α3  FAIL: [dispatchId]/page.tsx has `new DispatchService()` at line 28
 *   α4  FAIL: `new DispatchService()` present in [dispatchId]/page.tsx
 *   α5  FAIL: dispatches/route.ts module-level `new DispatchService()` at line 10
 *             — makeDispatchService() call absent
 *   α6  FAIL: `new DispatchService()` present in dispatches/route.ts
 *   α7  FAIL: [dispatchId]/route.ts module-level `new DispatchService()` at line 6
 *             — makeDispatchService() call absent
 *   α8  FAIL: `new DispatchService()` present in [dispatchId]/route.ts
 *   α9  FAIL: status/route.ts module-level `new DispatchService()` at line 8
 *             — makeDispatchService() call absent
 *   α10 FAIL: `new DispatchService()` present in status/route.ts
 *   α11 FAIL: recreate/route.ts module-level `new DispatchService()` at line 7
 *             — makeDispatchService() call absent
 *   α12 FAIL: `new DispatchService()` present in recreate/route.ts
 *   α13 FAIL: dispatches-hub/route.ts `new DispatchService()` at module-level
 *             — makeDispatchService() call absent
 *   α14 FAIL: `new DispatchService()` present in dispatches-hub/route.ts
 *   α15 FAIL: server.ts does NOT export makeDispatchService (only DispatchService,
 *             HubService, hubQuerySchema)
 *   α16 FAIL: makeDispatchService keyword absent in page.test.ts mock factory
 *             (PASS-lock pre-C1b: C1a delivers this)
 *   α17 FAIL: makeDispatchService keyword absent in page-rbac.test.ts mock factory
 *             (PASS-lock pre-C1b: C1a delivers this)
 *   α18 FAIL: makeDispatchService keyword absent in route.test.ts mock factory
 *             dispatches-hub (PASS-lock pre-C1b: C1a delivers this)
 *
 * Post-C1a: α16-α18 PASS (mock factories extended), α1-α15 still FAIL.
 * Post-C1b: all 18 PASS (source files + barrel updated).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

// POS consumer: makeDispatchService() call present as call expression
const MAKE_DISPATCH_SERVICE_CALL_REGEX = /^.*makeDispatchService\(\).*$/m;

// NEG consumer: new DispatchService() zero-args form absent
// Matches `new DispatchService()` strictly (zero-arg — no chars between parens)
const NEW_DISPATCH_SERVICE_ZERO_ARGS_REGEX = /new DispatchService\(\)/;

// BARREL: server.ts re-exports makeDispatchService from composition-root
const BARREL_EXPORT_REGEX =
  /export \{ makeDispatchService \} from ["']\.\/composition-root["']/;

// MOCK: makeDispatchService keyword present in mock factory return object
const MOCK_MAKE_DISPATCH_SERVICE_REGEX = /makeDispatchService/;

describe("POC correctivo dispatch-instantiation — C0 RED shape gate 18α", () => {
  // ── α1-α2: app/(dashboard)/[orgSlug]/dispatches/page.tsx ─────────────────

  // RETIRED by poc-dispatch-retirement-into-sales C3 GREEN: dispatches/page.tsx
  // is a 308 permanentRedirect shim — no DispatchService instantiation. The
  // makeDispatchService() factory call moved to /sales/page.tsx (C0 GREEN).
  it.skip("α1 POS: dispatches/page.tsx contains makeDispatchService() call (POS) (RETIRED — redirect shim)", () => {
    expect(
      read("app/(dashboard)/[orgSlug]/dispatches/page.tsx"),
    ).toMatch(MAKE_DISPATCH_SERVICE_CALL_REGEX);
  });

  it("α2 NEG: dispatches/page.tsx does NOT contain new DispatchService() zero-args (NEG)", () => {
    expect(
      read("app/(dashboard)/[orgSlug]/dispatches/page.tsx"),
    ).not.toMatch(NEW_DISPATCH_SERVICE_ZERO_ARGS_REGEX);
  });

  // ── α3-α4: app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx ────

  it("α3 POS: dispatches/[dispatchId]/page.tsx contains makeDispatchService() call (POS)", () => {
    expect(
      read("app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx"),
    ).toMatch(MAKE_DISPATCH_SERVICE_CALL_REGEX);
  });

  it("α4 NEG: dispatches/[dispatchId]/page.tsx does NOT contain new DispatchService() zero-args (NEG)", () => {
    expect(
      read("app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx"),
    ).not.toMatch(NEW_DISPATCH_SERVICE_ZERO_ARGS_REGEX);
  });

  // ── α5-α6: app/api/organizations/[orgSlug]/dispatches/route.ts ───────────

  it("α5 POS: dispatches/route.ts contains makeDispatchService() call (POS)", () => {
    expect(
      read("app/api/organizations/[orgSlug]/dispatches/route.ts"),
    ).toMatch(MAKE_DISPATCH_SERVICE_CALL_REGEX);
  });

  it("α6 NEG: dispatches/route.ts does NOT contain new DispatchService() zero-args (NEG)", () => {
    expect(
      read("app/api/organizations/[orgSlug]/dispatches/route.ts"),
    ).not.toMatch(NEW_DISPATCH_SERVICE_ZERO_ARGS_REGEX);
  });

  // ── α7-α8: app/api/organizations/[orgSlug]/dispatches/[dispatchId]/route.ts

  it("α7 POS: dispatches/[dispatchId]/route.ts contains makeDispatchService() call (POS)", () => {
    expect(
      read("app/api/organizations/[orgSlug]/dispatches/[dispatchId]/route.ts"),
    ).toMatch(MAKE_DISPATCH_SERVICE_CALL_REGEX);
  });

  it("α8 NEG: dispatches/[dispatchId]/route.ts does NOT contain new DispatchService() zero-args (NEG)", () => {
    expect(
      read("app/api/organizations/[orgSlug]/dispatches/[dispatchId]/route.ts"),
    ).not.toMatch(NEW_DISPATCH_SERVICE_ZERO_ARGS_REGEX);
  });

  // ── α9-α10: app/api/organizations/[orgSlug]/dispatches/[dispatchId]/status/route.ts

  it("α9 POS: dispatches/[dispatchId]/status/route.ts contains makeDispatchService() call (POS)", () => {
    expect(
      read(
        "app/api/organizations/[orgSlug]/dispatches/[dispatchId]/status/route.ts",
      ),
    ).toMatch(MAKE_DISPATCH_SERVICE_CALL_REGEX);
  });

  it("α10 NEG: dispatches/[dispatchId]/status/route.ts does NOT contain new DispatchService() zero-args (NEG)", () => {
    expect(
      read(
        "app/api/organizations/[orgSlug]/dispatches/[dispatchId]/status/route.ts",
      ),
    ).not.toMatch(NEW_DISPATCH_SERVICE_ZERO_ARGS_REGEX);
  });

  // ── α11-α12: app/api/organizations/[orgSlug]/dispatches/[dispatchId]/recreate/route.ts

  it("α11 POS: dispatches/[dispatchId]/recreate/route.ts contains makeDispatchService() call (POS)", () => {
    expect(
      read(
        "app/api/organizations/[orgSlug]/dispatches/[dispatchId]/recreate/route.ts",
      ),
    ).toMatch(MAKE_DISPATCH_SERVICE_CALL_REGEX);
  });

  it("α12 NEG: dispatches/[dispatchId]/recreate/route.ts does NOT contain new DispatchService() zero-args (NEG)", () => {
    expect(
      read(
        "app/api/organizations/[orgSlug]/dispatches/[dispatchId]/recreate/route.ts",
      ),
    ).not.toMatch(NEW_DISPATCH_SERVICE_ZERO_ARGS_REGEX);
  });

  // ── α13-α14: app/api/organizations/[orgSlug]/dispatches-hub/route.ts ─────

  // RETIRED by poc-dispatch-retirement-into-sales C1 GREEN: dispatches-hub/route.ts
  // DELETED atomically with HubService class — internal-only endpoint, zero
  // external consumers confirmed per [[retirement_reinventory_gate]].
  it.skip("α13 POS: dispatches-hub/route.ts contains makeDispatchService() call (POS) (RETIRED — endpoint deleted)", () => {
    expect(
      read("app/api/organizations/[orgSlug]/dispatches-hub/route.ts"),
    ).toMatch(MAKE_DISPATCH_SERVICE_CALL_REGEX);
  });

  it.skip("α14 NEG: dispatches-hub/route.ts does NOT contain new DispatchService() zero-args (NEG) (RETIRED — endpoint deleted)", () => {
    expect(
      read("app/api/organizations/[orgSlug]/dispatches-hub/route.ts"),
    ).not.toMatch(NEW_DISPATCH_SERVICE_ZERO_ARGS_REGEX);
  });

  // ── α15 BARREL: modules/dispatch/presentation/server.ts ──────────────────

  it("α15 BARREL: server.ts re-exports makeDispatchService from composition-root", () => {
    expect(
      read("modules/dispatch/presentation/server.ts"),
    ).toMatch(BARREL_EXPORT_REGEX);
  });

  // ── α16-α18 MOCK: 3 test mock files ──────────────────────────────────────
  // PASS-lock justification: mock files contain vi.mock("@/modules/dispatch/presentation/server", ...)
  // factory. `makeDispatchService` keyword currently absent — FAIL at RED.
  // After C1a, keyword added to all 3 → PASS (pre-C1b, source files unchanged).

  // RETIRED by poc-dispatch-retirement-into-sales C3 GREEN: page.test.ts now
  // asserts permanentRedirect shim — no vi.mock for modules/dispatch needed.
  it.skip("α16 MOCK: page.test.ts vi.mock factory contains makeDispatchService keyword (PASS-lock pre-C1b: C1a delivers) (RETIRED — redirect shim test)", () => {
    expect(
      read(
        "app/(dashboard)/[orgSlug]/dispatches/__tests__/page.test.ts",
      ),
    ).toMatch(MOCK_MAKE_DISPATCH_SERVICE_REGEX);
  });

  it("α17 MOCK: page-rbac.test.ts vi.mock factory contains makeDispatchService keyword (PASS-lock pre-C1b: C1a delivers)", () => {
    expect(
      read(
        "app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/__tests__/page-rbac.test.ts",
      ),
    ).toMatch(MOCK_MAKE_DISPATCH_SERVICE_REGEX);
  });

  // RETIRED by poc-dispatch-retirement-into-sales C1 GREEN: route.test.ts
  // DELETED atomically with API endpoint it tested.
  it.skip("α18 MOCK: dispatches-hub/route.test.ts vi.mock factory contains makeDispatchService keyword (PASS-lock pre-C1b: C1a delivers) (RETIRED — endpoint deleted)", () => {
    expect(
      read(
        "app/api/organizations/[orgSlug]/dispatches-hub/__tests__/route.test.ts",
      ),
    ).toMatch(MOCK_MAKE_DISPATCH_SERVICE_REGEX);
  });
});

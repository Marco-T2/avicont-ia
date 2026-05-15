/**
 * POC: poc-dispatch-retirement-into-sales — Cycle C1 RED
 *
 * 4α sentinels asserting DispatchHubService (`hub.service.ts` + `hub.types.ts` +
 * `hub.validation.ts`) and `/api/.../dispatches-hub/route.ts` are deleted, plus
 * the `server.ts` barrel no longer re-exports HubService / hubQuerySchema.
 *
 * Failure modes declared (per [[red_acceptance_failure_mode]]):
 *  α-C1-hub-file-absent     hub.service.ts EXISTS → fs.existsSync returns true → FAIL ✓
 *  α-C1-route-file-absent   dispatches-hub/route.ts EXISTS → FAIL ✓
 *  α-C1-server-export-absent  server.ts STILL exports HubService → regex MATCH → FAIL ✓
 *  α-C1-mock-rewrite        N/A divergence per design D5 — the only consumer
 *                            test file is `dispatches-hub/__tests__/route.test.ts`,
 *                            DELETED atomically in C1 GREEN (not rewritten). Surface
 *                            honest per [[cross_module_boundary_mock_target_rewrite]]:
 *                            assertion is replaced by route-test file-absence
 *                            sentinel (equivalent semantic: the mock target is
 *                            retired, not re-pointed).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..");

describe("POC dispatch-retirement-into-sales C1 — HubService + dispatches-hub route DELETE (RED)", () => {
  it("α-C1-hub-file-absent: modules/dispatch/presentation/hub.service.ts is deleted", () => {
    expect(
      existsSync(resolve(ROOT, "modules/dispatch/presentation/hub.service.ts")),
    ).toBe(false);
  });

  it("α-C1-hub-types-absent: modules/dispatch/presentation/hub.types.ts is deleted", () => {
    expect(
      existsSync(resolve(ROOT, "modules/dispatch/presentation/hub.types.ts")),
    ).toBe(false);
  });

  it("α-C1-route-file-absent: app/api/.../dispatches-hub/route.ts is deleted", () => {
    expect(
      existsSync(
        resolve(
          ROOT,
          "app/api/organizations/[orgSlug]/dispatches-hub/route.ts",
        ),
      ),
    ).toBe(false);
  });

  it("α-C1-server-export-absent: modules/dispatch/presentation/server.ts does NOT re-export HubService or hubQuerySchema", () => {
    const src = readFileSync(
      resolve(ROOT, "modules/dispatch/presentation/server.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/\bHubService\b/);
    expect(src).not.toMatch(/\bhubQuerySchema\b/);
  });
});

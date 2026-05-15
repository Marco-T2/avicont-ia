import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * C4 RED — Cross-feature cutover shape tests for POC dispatch-hex migration.
 * Verifies that ALL consumers import from modules/dispatch instead of features/dispatch.
 *
 * Consumer map (16 import sites across ~13 files):
 * - 7 app source files (pages + API routes)
 * - 1 component source (type-only)
 * - 3 test-mock files (vi.mock)
 * - 2 test-type files
 * - 1 internal test file
 */

const root = join(__dirname, "../../..");

function readFile(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf-8");
}

describe("POC dispatch-hex C4 — cross-feature cutover", () => {
  // ── App source files ────────────────────────────────────────────────────

  // RETIRED by poc-dispatch-retirement-into-sales C3 GREEN: dispatches/page.tsx
  // is now a 308 permanentRedirect shim to /sales (no longer a consumer of
  // modules/dispatch). Cementación invariant superseded by retirement intent.
  it.skip("dispatches/page.tsx imports from modules/dispatch (RETIRED — redirect shim)", () => {
    const content = readFile(
      "app/(dashboard)/[orgSlug]/dispatches/page.tsx",
    );
    expect(content).not.toContain("features/dispatch");
    expect(content).toContain("modules/dispatch");
  });

  it("dispatches/[dispatchId]/page.tsx imports from modules/dispatch", () => {
    const content = readFile(
      "app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx",
    );
    expect(content).not.toContain("features/dispatch");
    expect(content).toContain("modules/dispatch");
  });

  it("dispatches/route.ts imports from modules/dispatch", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/dispatches/route.ts",
    );
    expect(content).not.toContain("features/dispatch");
    expect(content).toContain("modules/dispatch");
  });

  it("dispatches/[id]/route.ts imports from modules/dispatch", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/dispatches/[dispatchId]/route.ts",
    );
    expect(content).not.toContain("features/dispatch");
    expect(content).toContain("modules/dispatch");
  });

  it("dispatches/[id]/status/route.ts imports from modules/dispatch", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/dispatches/[dispatchId]/status/route.ts",
    );
    expect(content).not.toContain("features/dispatch");
    expect(content).toContain("modules/dispatch");
  });

  it("dispatches/[id]/recreate/route.ts imports from modules/dispatch", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/dispatches/[dispatchId]/recreate/route.ts",
    );
    expect(content).not.toContain("features/dispatch");
    expect(content).toContain("modules/dispatch");
  });

  it("dispatches-hub/route.ts imports from modules/dispatch", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/dispatches-hub/route.ts",
    );
    expect(content).not.toContain("features/dispatch");
    expect(content).toContain("modules/dispatch");
  });

  // ── Component source ────────────────────────────────────────────────────

  it("dispatch-list.tsx imports from modules/dispatch", () => {
    const content = readFile("components/dispatches/dispatch-list.tsx");
    expect(content).not.toContain("features/dispatch");
    expect(content).toContain("modules/dispatch");
  });

  // ── Test files ──────────────────────────────────────────────────────────

  // RETIRED by poc-dispatch-retirement-into-sales C3 GREEN: page.test.ts now
  // asserts permanentRedirect shim semantics (no modules/dispatch mock needed).
  // Cementación invariant superseded by retirement intent.
  it.skip("dispatches/__tests__/page.test.ts mocks modules/dispatch (RETIRED — redirect shim test)", () => {
    const content = readFile(
      "app/(dashboard)/[orgSlug]/dispatches/__tests__/page.test.ts",
    );
    expect(content).not.toContain("features/dispatch");
    expect(content).toContain("modules/dispatch");
  });

  it("dispatches/[dispatchId]/__tests__/page-rbac.test.ts mocks modules/dispatch", () => {
    const content = readFile(
      "app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/__tests__/page-rbac.test.ts",
    );
    expect(content).not.toContain("features/dispatch");
    expect(content).toContain("modules/dispatch");
  });

  it("dispatches-hub/__tests__/route.test.ts mocks modules/dispatch", () => {
    const content = readFile(
      "app/api/organizations/[orgSlug]/dispatches-hub/__tests__/route.test.ts",
    );
    expect(content).not.toContain("features/dispatch");
    expect(content).toContain("modules/dispatch");
  });

  it("dispatch-list-date-format.test.tsx imports from modules/dispatch", () => {
    const content = readFile(
      "components/dispatches/__tests__/dispatch-list-date-format.test.tsx",
    );
    expect(content).not.toContain("features/dispatch");
    expect(content).toContain("modules/dispatch");
  });

  it("dispatch-list.test.tsx imports from modules/dispatch", () => {
    const content = readFile(
      "components/dispatches/__tests__/dispatch-list.test.tsx",
    );
    expect(content).not.toContain("features/dispatch");
    expect(content).toContain("modules/dispatch");
  });
});

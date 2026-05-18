/**
 * T22 [RED → GREEN] — /farms UI + API + components retirement
 * cementación (retire-farm-collapse-to-lot F4).
 *
 * Asserts FILE-EXISTENCE absence of the 12 farms surface files
 * scheduled for deletion at T22:
 *
 *   UI (4):  app/(dashboard)/[orgSlug]/farms/
 *     - page.tsx
 *     - farms-client.tsx
 *     - [farmId]/page.tsx
 *     - [farmId]/farm-detail-client.tsx
 *
 *   API (2): app/api/organizations/[orgSlug]/farms/
 *     - route.ts
 *     - [farmId]/route.ts
 *
 *   Components (1): components/farms/
 *     - create-farm-dialog.tsx
 *
 *   POC tests (5): components/farms/__tests__/
 *     - c0-farm-detail-accordion-shape.*.test.ts
 *     - c1-farm-detail-accordion-expanded.*.test.ts
 *     - c1h-farm-detail-layout-full-width.*.test.ts
 *     - c2-farm-detail-responsive-breakpoints.*.test.ts
 *     - c2h-farm-detail-no-farm-level-ai-button.*.test.ts
 *
 * Expected failure mode (RED): all 12 files currently exist at
 * HEAD `71611a7f`. All 12 assertions fire. GREEN after `git rm`
 * removes them.
 *
 * This cementación test SURVIVES F5 — once the files are gone,
 * the assertions become vacuously stable and prevent any future
 * accidental resurrection of the /farms surface.
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// __dirname = app/(dashboard)/__tests__ → up 2 = `app/`, up 3 = repo root
const REPO_ROOT = resolve(__dirname, "../../..");

const RETIRED_FILES = [
  // UI pages + clients
  "app/(dashboard)/[orgSlug]/farms/page.tsx",
  "app/(dashboard)/[orgSlug]/farms/farms-client.tsx",
  "app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx",
  "app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx",
  // API routes
  "app/api/organizations/[orgSlug]/farms/route.ts",
  "app/api/organizations/[orgSlug]/farms/[farmId]/route.ts",
  // Components
  "components/farms/create-farm-dialog.tsx",
  // POC-1-ux-accordion tests
  "components/farms/__tests__/c0-farm-detail-accordion-shape.poc-1-ux-accordion-granjero-mayor.test.ts",
  "components/farms/__tests__/c1-farm-detail-accordion-expanded.poc-1-ux-accordion-granjero-mayor.test.ts",
  "components/farms/__tests__/c1h-farm-detail-layout-full-width.poc-1-ux-accordion-granjero-mayor.test.ts",
  "components/farms/__tests__/c2-farm-detail-responsive-breakpoints.poc-1-ux-accordion-granjero-mayor.test.ts",
  "components/farms/__tests__/c2h-farm-detail-no-farm-level-ai-button.poc-1-ux-accordion-granjero-mayor.test.ts",
] as const;

describe("T22 — /farms surface retirement (file-existence cementación)", () => {
  it.each(RETIRED_FILES)("file is retired: %s", (rel) => {
    expect(existsSync(resolve(REPO_ROOT, rel))).toBe(false);
  });
});

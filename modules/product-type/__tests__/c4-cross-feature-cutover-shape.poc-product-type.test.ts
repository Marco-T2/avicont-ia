import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../..");

function readRepoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

// ── Regex patterns ──
const IMPORT_MAKE_PT_SERVICE_HEX_RE =
  /^import\s*\{[^}]*\bmakeProductTypeService\b[^}]*\}\s*from\s*["']@\/modules\/product-type\/presentation\/server["']/m;
const LEGACY_FEATURES_PT_SERVICE_IMPORT_RE =
  /from\s+["']@\/features\/product-types\/server["']/;
const LEGACY_FEATURES_PT_BARREL_IMPORT_RE =
  /from\s+["']@\/features\/product-types["']/;
const NEW_PT_SERVICE_CTOR_RE = /new\s+ProductTypesService\s*\(/;
const TO_SNAPSHOT_RE = /\.toSnapshot\(\)/;

describe("POC product-type hex C4 — cross-feature cutover shape (paired sister operational-doc-type C4 EXACT mirror)", () => {
  // ── A: dispatches/new/page.tsx cutover ──
  // α41
  it("α41: dispatches/new/page.tsx imports makeProductTypeService hex + NO legacy + .toSnapshot() + NO new ProductTypesService(", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/dispatches/new/page.tsx",
    );
    expect(src).toMatch(IMPORT_MAKE_PT_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_PT_SERVICE_IMPORT_RE);
    expect(src).toMatch(TO_SNAPSHOT_RE);
    expect(src).not.toMatch(NEW_PT_SERVICE_CTOR_RE);
  });

  // α42
  it("α42: dispatches/[dispatchId]/page.tsx imports makeProductTypeService hex + NO legacy + .toSnapshot() + NO new ProductTypesService(", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx",
    );
    expect(src).toMatch(IMPORT_MAKE_PT_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_PT_SERVICE_IMPORT_RE);
    expect(src).toMatch(TO_SNAPSHOT_RE);
    expect(src).not.toMatch(NEW_PT_SERVICE_CTOR_RE);
  });

  // ── B: purchases cutover ──
  // α43
  it("α43: purchases/new/page.tsx imports makeProductTypeService hex + NO legacy + .toSnapshot() + NO new ProductTypesService(", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/purchases/new/page.tsx",
    );
    expect(src).toMatch(IMPORT_MAKE_PT_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_PT_SERVICE_IMPORT_RE);
    expect(src).toMatch(TO_SNAPSHOT_RE);
    expect(src).not.toMatch(NEW_PT_SERVICE_CTOR_RE);
  });

  // α44
  it("α44: purchases/[purchaseId]/page.tsx imports makeProductTypeService hex + NO legacy + .toSnapshot() + NO new ProductTypesService(", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx",
    );
    expect(src).toMatch(IMPORT_MAKE_PT_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_PT_SERVICE_IMPORT_RE);
    expect(src).toMatch(TO_SNAPSHOT_RE);
    expect(src).not.toMatch(NEW_PT_SERVICE_CTOR_RE);
  });

  // ── C: settings/product-types cutover ──
  // α45
  it("α45: settings/product-types/page.tsx imports makeProductTypeService hex + NO legacy + .toSnapshot() + NO new ProductTypesService(", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/settings/product-types/page.tsx",
    );
    expect(src).toMatch(IMPORT_MAKE_PT_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_PT_SERVICE_IMPORT_RE);
    expect(src).toMatch(TO_SNAPSHOT_RE);
    expect(src).not.toMatch(NEW_PT_SERVICE_CTOR_RE);
  });

  // ── D: API routes cutover ──
  // α46
  it("α46: api/product-types/route.ts imports from hex barrel + NO legacy features/product-types + NO new ProductTypesService(", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/product-types/route.ts",
    );
    expect(src).toMatch(IMPORT_MAKE_PT_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_PT_SERVICE_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_PT_BARREL_IMPORT_RE);
    expect(src).not.toMatch(NEW_PT_SERVICE_CTOR_RE);
  });

  // α47
  it("α47: api/product-types/route.ts uses .toSnapshot() for API response", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/product-types/route.ts",
    );
    expect(src).toMatch(TO_SNAPSHOT_RE);
  });

  // α48
  it("α48: api/product-types/[productTypeId]/route.ts imports from hex barrel + NO legacy features/product-types + NO new ProductTypesService(", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/product-types/[productTypeId]/route.ts",
    );
    expect(src).toMatch(IMPORT_MAKE_PT_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_PT_SERVICE_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_PT_BARREL_IMPORT_RE);
    expect(src).not.toMatch(NEW_PT_SERVICE_CTOR_RE);
  });

  // α49
  it("α49: api/product-types/[productTypeId]/route.ts uses .toSnapshot() for API response", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/product-types/[productTypeId]/route.ts",
    );
    expect(src).toMatch(TO_SNAPSHOT_RE);
  });
});

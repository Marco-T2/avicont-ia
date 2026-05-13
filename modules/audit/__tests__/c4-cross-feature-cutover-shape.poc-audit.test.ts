import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../..");

function readRepoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

function repoFileExists(rel: string): boolean {
  return existsSync(resolve(REPO_ROOT, rel));
}

// ── Regex patterns ──
const IMPORT_MAKE_AUDIT_SERVICE_HEX_RE =
  /^import\s*\{[^}]*\bmakeAuditService\b[^}]*\}\s*from\s*["']@\/modules\/audit\/presentation\/server["']/m;
const HEX_SERVER_IMPORT_RE =
  /from\s+["']@\/modules\/audit\/presentation\/server["']/;
const HEX_CLIENT_IMPORT_RE =
  /from\s+["']@\/modules\/audit\/presentation["']/;
const LEGACY_FEATURES_AUDIT_SERVER_IMPORT_RE =
  /from\s+["']@\/features\/audit\/server["']/;
const LEGACY_FEATURES_AUDIT_BARREL_IMPORT_RE =
  /from\s+["']@\/features\/audit["']/;
const NEW_AUDIT_SERVICE_CTOR_RE = /new\s+AuditService\s*\(/;

describe("POC audit hex C4 — cross-feature cutover shape", () => {
  // ── A: RSC pages cutover ──

  // α28
  it("α28: audit/page.tsx imports makeAuditService hex + NO legacy + NO new AuditService(", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/audit/page.tsx",
    );
    expect(src).toMatch(IMPORT_MAKE_AUDIT_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_AUDIT_SERVER_IMPORT_RE);
    expect(src).not.toMatch(NEW_AUDIT_SERVICE_CTOR_RE);
  });

  // α29
  it("α29: audit/[entityType]/[entityId]/page.tsx imports from hex server + NO legacy", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/audit/[entityType]/[entityId]/page.tsx",
    );
    expect(src).toMatch(HEX_SERVER_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_AUDIT_SERVER_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_AUDIT_BARREL_IMPORT_RE);
    expect(src).not.toMatch(NEW_AUDIT_SERVICE_CTOR_RE);
  });

  // ── B: API routes cutover ──

  // α30
  it("α30: api/audit/route.ts imports from hex server + NO legacy + NO new AuditService(", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/audit/route.ts",
    );
    expect(src).toMatch(IMPORT_MAKE_AUDIT_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_AUDIT_SERVER_IMPORT_RE);
    expect(src).not.toMatch(NEW_AUDIT_SERVICE_CTOR_RE);
  });

  // α31
  it("α31: api/audit/[entityType]/[entityId]/route.ts imports from hex server + NO legacy", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/audit/[entityType]/[entityId]/route.ts",
    );
    expect(src).toMatch(IMPORT_MAKE_AUDIT_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_AUDIT_SERVER_IMPORT_RE);
    expect(src).not.toMatch(NEW_AUDIT_SERVICE_CTOR_RE);
  });

  // ── C: Client components cutover ──

  // α32
  it("α32: audit-detail-timeline.tsx imports from hex client barrel + NO legacy", () => {
    const src = readRepoFile("components/audit/audit-detail-timeline.tsx");
    expect(src).toMatch(HEX_CLIENT_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_AUDIT_BARREL_IMPORT_RE);
  });

  // α33
  it("α33: audit-event-list.tsx imports from hex client barrel + NO legacy", () => {
    const src = readRepoFile("components/audit/audit-event-list.tsx");
    expect(src).toMatch(HEX_CLIENT_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_AUDIT_BARREL_IMPORT_RE);
  });

  // α34
  it("α34: audit-diff-viewer.tsx imports from hex client barrel + NO legacy", () => {
    const src = readRepoFile("components/audit/audit-diff-viewer.tsx");
    expect(src).toMatch(HEX_CLIENT_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_AUDIT_BARREL_IMPORT_RE);
  });

  // α35
  it("α35: audit-event-badges.tsx imports from hex client barrel + NO legacy", () => {
    const src = readRepoFile("components/audit/audit-event-badges.tsx");
    expect(src).toMatch(HEX_CLIENT_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_AUDIT_BARREL_IMPORT_RE);
  });

  // ── D: Test files cutover ──

  // α36
  it("α36: audit-types-helpers.test.ts (if present) imports from hex client barrel + NO legacy", () => {
    // C5 wholesale-delete removed features/audit/ entirely; this sentinel pre-dates
    // that deletion. Guard with existsSync: post-C5 the file is gone (assertion
    // satisfied vacuously); pre-C5 the cutover invariant still applies. See
    // §13.audit-c5-wholesale-delete entry in 04-sigma-13-canonical-homes.md.
    const rel = "features/audit/__tests__/audit-types-helpers.test.ts";
    if (!repoFileExists(rel)) return;
    const src = readRepoFile(rel);
    expect(src).toMatch(HEX_CLIENT_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_AUDIT_BARREL_IMPORT_RE);
  });

  // α37
  it("α37: audit-detail-timeline.test.tsx imports AuditEvent from hex + NO legacy", () => {
    const src = readRepoFile("components/audit/__tests__/audit-detail-timeline.test.tsx");
    expect(src).toMatch(HEX_CLIENT_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_AUDIT_BARREL_IMPORT_RE);
  });

  // α38
  it("α38: audit-event-list.test.tsx imports types from hex + NO legacy", () => {
    const src = readRepoFile("components/audit/__tests__/audit-event-list.test.tsx");
    expect(src).toMatch(HEX_CLIENT_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_AUDIT_BARREL_IMPORT_RE);
  });

  // α39
  it("α39: audit-diff-viewer.test.tsx imports AuditEvent from hex + NO legacy", () => {
    const src = readRepoFile("components/audit/__tests__/audit-diff-viewer.test.tsx");
    expect(src).toMatch(HEX_CLIENT_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_AUDIT_BARREL_IMPORT_RE);
  });
});

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/modules/shared/__tests__/strip-source-comments";

const REPO_ROOT = resolve(__dirname, "../../..");

// COMMENTS STRIPPED (poc-rag-hex C3). Every lock in this file pins RUNTIME
// CODE — none asserts a comment on purpose — so the strip is applied at the
// read boundary. Anchoring alone left residue: `^import` still matches an
// UNINDENTED line sitting inside a block comment.
function readRepoFile(rel: string): string {
  return stripSourceComments(readFileSync(resolve(REPO_ROOT, rel), "utf-8"));
}

// ANCHORED (^) — kept as defense in depth on top of the strip. Both real forms
// are allowed: a single-line `import ... from "X"` and the closing line of a
// multi-line named import (`} from "X"`). Neither can begin a comment line.
const IMPORT_HEX_BARREL_RE =
  /^(?:import\b.*|\})\s*from\s+["']@\/modules\/documents\/presentation\/server["']/m;
const LEGACY_FEATURES_SERVER_RE =
  /from\s+["']@\/features\/documents\/server["']/;
const NEW_DOCUMENTS_SERVICE_CTOR_RE = /new\s+DocumentsService\s*\(/;
// Repointed at poc-rag-hex C2: rag's canonical home moved to modules/rag.
// ANCHORED (^) — same rationale as IMPORT_HEX_BARREL_RE above.
const RAG_MODULES_PATH_RE =
  /^(?:import\b.*|\})\s*from\s+["']@\/modules\/rag\/presentation\/server["']/m;

describe("C4 cross-feature cutover shape — Documents module (3 API routes + rag carve-out invariant) paired sister poc-org-profile-hex C4", () => {
  // α38 — app/api/documents/route.ts imports from hex barrel
  it("α38: app/api/documents/route.ts imports from @/modules/documents/presentation/server (POSITIVE)", () => {
    const src = readRepoFile("app/api/documents/route.ts");
    expect(src).toMatch(IMPORT_HEX_BARREL_RE);
  });

  // α39 — app/api/documents/route.ts NO legacy
  it("α39: app/api/documents/route.ts NO legacy @/features/documents/server import + NO new DocumentsService(", () => {
    const src = readRepoFile("app/api/documents/route.ts");
    expect(src).not.toMatch(LEGACY_FEATURES_SERVER_RE);
    expect(src).not.toMatch(NEW_DOCUMENTS_SERVICE_CTOR_RE);
  });

  // α40 — app/api/documents/[documentId]/route.ts imports from hex barrel
  it("α40: app/api/documents/[documentId]/route.ts imports from @/modules/documents/presentation/server (POSITIVE)", () => {
    const src = readRepoFile("app/api/documents/[documentId]/route.ts");
    expect(src).toMatch(IMPORT_HEX_BARREL_RE);
  });

  // α41 — app/api/documents/[documentId]/route.ts NO legacy
  it("α41: app/api/documents/[documentId]/route.ts NO legacy + NO new DocumentsService(", () => {
    const src = readRepoFile("app/api/documents/[documentId]/route.ts");
    expect(src).not.toMatch(LEGACY_FEATURES_SERVER_RE);
    expect(src).not.toMatch(NEW_DOCUMENTS_SERVICE_CTOR_RE);
  });

  // α42 — app/api/analyze/route.ts imports from hex barrel
  it("α42: app/api/analyze/route.ts imports from @/modules/documents/presentation/server (POSITIVE)", () => {
    const src = readRepoFile("app/api/analyze/route.ts");
    expect(src).toMatch(IMPORT_HEX_BARREL_RE);
  });

  // α43 — app/api/analyze/route.ts NO legacy
  it("α43: app/api/analyze/route.ts NO legacy + NO new DocumentsService(", () => {
    const src = readRepoFile("app/api/analyze/route.ts");
    expect(src).not.toMatch(LEGACY_FEATURES_SERVER_RE);
    expect(src).not.toMatch(NEW_DOCUMENTS_SERVICE_CTOR_RE);
  });

  // α44 — rag carve-out invariant: legacy-rag.adapter.ts is the single
  // insulation point naming rag. Specifier repointed at poc-rag-hex C2 to
  // @/modules/rag/presentation/server (features/documents/rag/ deleted).
  it("α44: modules/ai-agent/infrastructure/legacy-rag.adapter.ts imports @/modules/rag/presentation/server (rag carve-out invariant — single insulation point)", () => {
    const src = readRepoFile("modules/ai-agent/infrastructure/legacy-rag.adapter.ts");
    expect(src).toMatch(RAG_MODULES_PATH_RE);
  });

  // α45 — relocated test file exists at hex application path
  it("α45: modules/documents/application/__tests__/documents.service.error-propagation.test.ts EXISTS (relocated in C1)", () => {
    const newPath = resolve(
      REPO_ROOT,
      "modules/documents/application/__tests__/documents.service.error-propagation.test.ts",
    );
    expect(existsSync(newPath)).toBe(true);
  });
});

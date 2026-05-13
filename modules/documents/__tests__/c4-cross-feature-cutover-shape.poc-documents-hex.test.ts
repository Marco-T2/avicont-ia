import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../..");

function readRepoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

const IMPORT_HEX_BARREL_RE =
  /from\s+["']@\/modules\/documents\/presentation\/server["']/;
const LEGACY_FEATURES_SERVER_RE =
  /from\s+["']@\/features\/documents\/server["']/;
const NEW_DOCUMENTS_SERVICE_CTOR_RE = /new\s+DocumentsService\s*\(/;
const RAG_FEATURES_PATH_RE =
  /from\s+["']@\/features\/documents\/rag\/server["']/;

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

  // α44 — rag carve-out invariant: legacy-rag.adapter.ts imports @/features/documents/rag/server
  // Path migrated at poc-ai-agent-hex C5: features/ai-agent/agent.context.ts deleted;
  // rag import now lives at modules/ai-agent/infrastructure/legacy-rag.adapter.ts (REQ-004 insulation point)
  it("α44: modules/ai-agent/infrastructure/legacy-rag.adapter.ts imports @/features/documents/rag/server (rag carve-out invariant — REQ-004 insulation; poc-ai-agent-hex C5 wholesale delete migrated path)", () => {
    const src = readRepoFile("modules/ai-agent/infrastructure/legacy-rag.adapter.ts");
    expect(src).toMatch(RAG_FEATURES_PATH_RE);
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

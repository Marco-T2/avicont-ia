/**
 * Shape sentinel: poc-quick-cleanup — rag relocation
 * 18α (9 POSITIVE-presence + 9 NEGATIVE-absence)
 * RED: all 18 FAIL (new home empty; old home still populated)
 * GREEN: all 18 PASS (new home populated; old home deleted)
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

// ---------------------------------------------------------------------------
// α01–α05: POSITIVE — new home file existence
// ---------------------------------------------------------------------------

describe("POSITIVE-presence: new home files exist", () => {
  it("α01: features/documents/rag/chunking.ts exists", () => {
    expect(existsSync(join(ROOT, "features/documents/rag/chunking.ts"))).toBe(true);
  });

  it("α02: features/documents/rag/embedding.service.ts exists", () => {
    expect(existsSync(join(ROOT, "features/documents/rag/embedding.service.ts"))).toBe(true);
  });

  it("α03: features/documents/rag/rag.service.ts exists", () => {
    expect(existsSync(join(ROOT, "features/documents/rag/rag.service.ts"))).toBe(true);
  });

  it("α04: features/documents/rag/vector.repository.ts exists", () => {
    expect(existsSync(join(ROOT, "features/documents/rag/vector.repository.ts"))).toBe(true);
  });

  it("α05: features/documents/rag/server.ts exists", () => {
    expect(existsSync(join(ROOT, "features/documents/rag/server.ts"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// α06–α10: NEGATIVE-absence — old home file absence
// ---------------------------------------------------------------------------

describe("NEGATIVE-absence: old home files absent", () => {
  it("α06: features/rag/chunking.ts absent", () => {
    expect(existsSync(join(ROOT, "features/rag/chunking.ts"))).toBe(false);
  });

  it("α07: features/rag/embedding.service.ts absent", () => {
    expect(existsSync(join(ROOT, "features/rag/embedding.service.ts"))).toBe(false);
  });

  it("α08: features/rag/rag.service.ts absent", () => {
    expect(existsSync(join(ROOT, "features/rag/rag.service.ts"))).toBe(false);
  });

  it("α09: features/rag/vector.repository.ts absent", () => {
    expect(existsSync(join(ROOT, "features/rag/vector.repository.ts"))).toBe(false);
  });

  it("α10: features/rag/server.ts absent", () => {
    expect(existsSync(join(ROOT, "features/rag/server.ts"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// α11–α12: agent.context.ts consumer import
// ---------------------------------------------------------------------------

describe("agent.context.ts consumer import", () => {
  it("α11: POSITIVE — agent.context.ts imports from @/features/documents/rag/server", () => {
    const src = read("features/ai-agent/agent.context.ts");
    expect(/^import.*@\/features\/documents\/rag\/server/m.test(src)).toBe(true);
  });

  it("α12: NEGATIVE — agent.context.ts does NOT import from @/features/rag/server", () => {
    const src = read("features/ai-agent/agent.context.ts");
    expect(/^import.*@\/features\/rag\/server/m.test(src)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// α13–α14: documents.service.ts consumer import
// ---------------------------------------------------------------------------

describe("documents.service.ts consumer import", () => {
  it("α13: POSITIVE — documents.service.ts imports from @/features/documents/rag/server", () => {
    const src = read("features/documents/documents.service.ts");
    expect(/^import.*@\/features\/documents\/rag\/server/m.test(src)).toBe(true);
  });

  it("α14: NEGATIVE — documents.service.ts does NOT import from @/features/rag/server", () => {
    const src = read("features/documents/documents.service.ts");
    expect(/^import.*@\/features\/rag\/server/m.test(src)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// α15–α16: agent.context.dispatch.test.ts vi.mock
// ---------------------------------------------------------------------------

describe("agent.context.dispatch.test.ts vi.mock path", () => {
  it("α15: NEGATIVE — vi.mock NOT on old path @/features/rag/server", () => {
    const src = read("features/ai-agent/__tests__/agent.context.dispatch.test.ts");
    expect(/vi\.mock\("@\/features\/rag\/server"/m.test(src)).toBe(false);
  });

  it("α16: POSITIVE — vi.mock on new path @/features/documents/rag/server", () => {
    const src = read("features/ai-agent/__tests__/agent.context.dispatch.test.ts");
    expect(/vi\.mock\("@\/features\/documents\/rag\/server"/m.test(src)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// α17–α18: documents.service.error-propagation.test.ts vi.mock
// ---------------------------------------------------------------------------

describe("documents.service.error-propagation.test.ts vi.mock path", () => {
  // NOTE: test was physically relocated to modules/documents/application/__tests__/
  // as part of poc-documents-hex C1 (hex migration). Path updated atomic to
  // preserve the rag carve-out invariant assertion at the new test location.
  const RELOCATED_PATH =
    "modules/documents/application/__tests__/documents.service.error-propagation.test.ts";

  it("α17: NEGATIVE — vi.mock NOT on old path @/features/rag/server", () => {
    const src = read(RELOCATED_PATH);
    expect(/vi\.mock\("@\/features\/rag\/server"/m.test(src)).toBe(false);
  });

  it("α18: POSITIVE — vi.mock on new path @/features/documents/rag/server", () => {
    const src = read(RELOCATED_PATH);
    expect(/vi\.mock\("@\/features\/documents\/rag\/server"/m.test(src)).toBe(true);
  });
});

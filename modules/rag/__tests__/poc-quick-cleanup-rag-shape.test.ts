/**
 * Shape sentinel: rag relocation — inverted + relocated at poc-rag-hex C2.
 * 18α (9 POSITIVE-presence + 9 NEGATIVE-absence)
 *
 * The sentinel itself lived inside the tree being moved, so it was `git mv`'d
 * rather than edited in place: its readFileSync/existsSync calls target paths
 * that C2 deletes, which would have been an ENOENT at COLLECTION time.
 *
 * POSITIVE locks now assert the modules/rag home; NEGATIVE locks assert the
 * features/documents/rag home is GONE. Nothing here asserts a features/ rag
 * path as present any more.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { stripSourceComments } from "@/modules/shared/__tests__/strip-source-comments";

const ROOT = join(process.cwd());

// COMMENTS STRIPPED (poc-rag-hex C3). Every import/vi.mock lock below asserts
// RUNTIME CODE, so prose must not be able to satisfy — or falsely break — it.
// No lock in this file asserts a comment on purpose, so the strip is applied
// at the read boundary. Anchoring alone was insufficient: `^import` still
// matches an UNINDENTED line sitting inside a block comment.
function read(rel: string): string {
  return stripSourceComments(readFileSync(join(ROOT, rel), "utf-8"));
}

// Multi-line-aware import matcher. Catches BOTH the single-line
// `import ... from "X"` and the closing line of a multi-line named import
// (`} from "X"`). Anchoring a NEGATIVE narrows what it can catch, so a bare
// `^import.*` negative was evadable by splitting the import across lines —
// proven exploit at C3 verify. `SPEC` is a regex source fragment.
function importFrom(spec: string): RegExp {
  return new RegExp(`^(?:import\\b.*|\\})\\s*from\\s+["']${spec}["']`, "m");
}

// ---------------------------------------------------------------------------
// α01–α05: POSITIVE — new home file existence
// ---------------------------------------------------------------------------

describe("POSITIVE-presence: new home files exist", () => {
  it("α01: modules/rag/domain/chunking.ts exists", () => {
    expect(existsSync(join(ROOT, "modules/rag/domain/chunking.ts"))).toBe(true);
  });

  it("α02: modules/rag/infrastructure/gemini-embedding.adapter.ts exists", () => {
    expect(existsSync(join(ROOT, "modules/rag/infrastructure/gemini-embedding.adapter.ts"))).toBe(true);
  });

  it("α03: modules/rag/application/rag.service.ts exists", () => {
    expect(existsSync(join(ROOT, "modules/rag/application/rag.service.ts"))).toBe(true);
  });

  it("α04: modules/rag/infrastructure/prisma/prisma-vector.repository.ts exists", () => {
    expect(existsSync(join(ROOT, "modules/rag/infrastructure/prisma/prisma-vector.repository.ts"))).toBe(true);
  });

  it("α05: modules/rag/presentation/server.ts exists", () => {
    expect(existsSync(join(ROOT, "modules/rag/presentation/server.ts"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// α06–α10: NEGATIVE-absence — old home file absence
// ---------------------------------------------------------------------------

describe("NEGATIVE-absence: old home files absent", () => {
  it("α06: features/documents/rag/chunking.ts absent", () => {
    expect(existsSync(join(ROOT, "features/documents/rag/chunking.ts"))).toBe(false);
  });

  it("α07: features/documents/rag/embedding.service.ts absent", () => {
    expect(existsSync(join(ROOT, "features/documents/rag/embedding.service.ts"))).toBe(false);
  });

  it("α08: features/documents/rag/rag.service.ts absent", () => {
    expect(existsSync(join(ROOT, "features/documents/rag/rag.service.ts"))).toBe(false);
  });

  it("α09: features/documents/rag/vector.repository.ts absent", () => {
    expect(existsSync(join(ROOT, "features/documents/rag/vector.repository.ts"))).toBe(false);
  });

  it("α10: features/documents/rag/server.ts absent", () => {
    expect(existsSync(join(ROOT, "features/documents/rag/server.ts"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// α11–α12: agent.context.ts consumer import
// ---------------------------------------------------------------------------

describe("agent.context.ts consumer import", () => {
  // Path migrated at poc-ai-agent-hex C5: features/ai-agent/agent.context.ts deleted.
  // Rag import now lives at modules/ai-agent/infrastructure/legacy-rag.adapter.ts (REQ-004 insulation)
  it("α11: POSITIVE — modules/ai-agent/infrastructure/legacy-rag.adapter.ts imports from @/modules/rag/presentation/server (migrated from features/ai-agent/agent.context.ts at poc-ai-agent-hex C5)", () => {
    const src = read("modules/ai-agent/infrastructure/legacy-rag.adapter.ts");
    expect(importFrom("@\\/modules\\/rag\\/presentation\\/server").test(src)).toBe(true);
  });

  it("α12: NEGATIVE — modules/ai-agent/infrastructure/legacy-rag.adapter.ts does NOT import from @/features/documents/rag/** (retired home)", () => {
    const src = read("modules/ai-agent/infrastructure/legacy-rag.adapter.ts");
    expect(importFrom("@\\/features\\/documents\\/rag\\/[^\"']*").test(src)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// α13–α14: documents.service.ts consumer import
// ---------------------------------------------------------------------------

describe("documents.service.ts consumer import", () => {
  // INVERTED AT poc-rag-hex C2 — polarity FLIPPED, not just repointed.
  // α13 used to be a POSITIVE lock pinning the REQ-004 cross-module
  // canonical-bypass (`import { RagService } from ".../rag/server"`) into the
  // documents application layer. C2 KILLED REQ-004: DocumentsService now
  // depends only on DocumentIndexingPort, so a POSITIVE lock on ANY rag
  // import would re-assert exactly the coupling this change removed.
  // Both α13 and α14 are therefore NEGATIVE now.
  const RELOCATED_PATH = "modules/documents/application/documents.service.ts";

  it("α13: NEGATIVE — documents.service.ts does NOT import from @/modules/rag/** (REQ-004 killed; DocumentIndexingPort is the only seam)", () => {
    const src = read(RELOCATED_PATH);
    expect(importFrom("@\\/modules\\/rag\\/[^\"']*").test(src)).toBe(false);
  });

  it("α14: NEGATIVE — documents.service.ts does NOT import from @/features/documents/rag/** (retired home)", () => {
    const src = read(RELOCATED_PATH);
    expect(importFrom("@\\/features\\/documents\\/rag\\/[^\"']*").test(src)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// α15–α16: agent.context.dispatch.test.ts vi.mock
// ---------------------------------------------------------------------------

describe("agent.context.dispatch.test.ts vi.mock path", () => {
  // features/ai-agent/__tests__/agent.context.dispatch.test.ts was deleted at poc-ai-agent-hex C5.
  // The rag invariant is now covered by legacy-rag.adapter.ts (REQ-004 insulation point).
  // vi.mock for rag in modules/ai-agent is covered by modules/ai-agent __tests__ sentinel c2.
  it("α15: features/ai-agent/__tests__/agent.context.dispatch.test.ts NO LONGER EXISTS (deleted wholesale at poc-ai-agent-hex C5)", () => {
    expect(existsSync(join(ROOT, "features/ai-agent/__tests__/agent.context.dispatch.test.ts"))).toBe(false);
  });

  it("α16: modules/ai-agent/infrastructure/legacy-rag.adapter.ts imports @/modules/rag/presentation/server (rag import insulation — replaces agent.context.ts direct import, deleted at poc-ai-agent-hex C5)", () => {
    const src = read("modules/ai-agent/infrastructure/legacy-rag.adapter.ts");
    expect(importFrom("@\\/modules\\/rag\\/presentation\\/server").test(src)).toBe(true);
  });
});

// Multi-line-aware vi.mock matcher — `vi.mock(` and its specifier may sit on
// separate lines, so a `^vi\.mock\("spec` negative was evadable by a newline.
function viMockOf(spec: string): RegExp {
  return new RegExp(`^vi\\.mock\\(\\s*["']${spec}["']`, "m");
}

// ---------------------------------------------------------------------------
// α17–α18: documents.service.error-propagation.test.ts vi.mock
// ---------------------------------------------------------------------------

describe("documents.service.error-propagation.test.ts vi.mock path", () => {
  // NOTE: test was physically relocated to modules/documents/application/__tests__/
  // as part of poc-documents-hex C1 (hex migration).
  //
  // INVERTED AT poc-rag-hex C2 — both locks are NEGATIVE now. DocumentsService
  // takes a DocumentIndexingPort and imports NO rag barrel, so a module mock on
  // any rag specifier would intercept nothing: a mock that is never consulted is
  // worse than no mock, because it reads as coverage it does not provide. The
  // test wires a port-shaped stub directly instead.
  const RELOCATED_PATH =
    "modules/documents/application/__tests__/documents.service.error-propagation.test.ts";

  it("α17: NEGATIVE — vi.mock NOT on retired path @/features/documents/rag/server", () => {
    const src = read(RELOCATED_PATH);
    expect(viMockOf("@\\/features\\/documents\\/rag\\/server").test(src)).toBe(false);
  });

  it("α18: NEGATIVE — no vi.mock on @/modules/rag/** either; the test injects a DocumentIndexingPort stub instead of mocking a barrel the service never imports", () => {
    const src = read(RELOCATED_PATH);
    // COMMENTS STRIPPED at the read boundary + multi-line-aware matcher, so
    // neither prose nor a newline after `vi.mock(` can hide a real mock.
    expect(viMockOf("@\\/modules\\/rag\\/[^\"']*").test(src)).toBe(false);
    // and the replacement seam is actually present. A bare /DocumentIndexingPort/
    // was once satisfied by this test's own explanatory comment even with the
    // real port import and annotation both deleted (comment at :104 still says
    // the name). Pin the PORT MODULE instead of the bare symbol: stripping kills
    // the prose route, and importFrom catches the multi-line named-import form.
    expect(
      importFrom(
        "@\\/modules\\/documents\\/domain\\/ports\\/document-indexing\\.port",
      ).test(src),
    ).toBe(true);
  });
});

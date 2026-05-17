/**
 * REQ-43 — RagPort.search accepts optional tags?: string[] (slugs).
 *
 * Two assertions:
 *  1. Port shape: the 5th positional param `tags?: string[]` compiles.
 *  2. LegacyRagAdapter resolves slug strings -> tag IDs via
 *     TagsRepositoryPort.findBySlugs before delegating to RagService.search,
 *     which now receives the resolved IDs (NOT the original slugs).
 *
 * AND-semantics is enforced downstream by VectorRepository (Commit D); this
 * test only verifies the slug->id translation contract at the adapter
 * boundary. Backward compat: omitting `tags` returns the existing behavior
 * (RagService.search called without the tagIds 5th arg).
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - TS compile error on `.search(query, orgId, scopes, limit, tags)` —
 *     5th arg not accepted on current signature.
 *   - Even if TS bypassed, LegacyRagAdapter currently ignores any 5th
 *     positional arg, so RagService.search NEVER receives tagIds — the
 *     spy assertion `expect(ragSearchSpy.mock.calls[0][4]).toEqual([...])`
 *     fails because index 4 is `undefined`.
 */

import { describe, it, expect, vi } from "vitest";

// Mock the embedding service to bypass GEMINI_API_KEY env guard (module-load
// chain: legacy-rag.adapter -> rag/server -> rag.service -> embedding.service).
vi.mock("@/features/documents/rag/embedding.service", () => ({
  EmbeddingService: class {
    async embed() {
      return [0.1, 0.2];
    }
    async embedBatch(texts: string[]) {
      return texts.map(() => [0.1, 0.2]);
    }
  },
}));

import { LegacyRagAdapter } from "../infrastructure/legacy-rag.adapter";
import type { RagPort } from "../domain/ports/rag.port";
import type { TagsRepositoryPort } from "@/modules/tags/domain/ports/tags-repository.port";
import type { Tag } from "@/modules/tags/domain/tag.types";

function makeRagServiceStub(spy: ReturnType<typeof vi.fn>) {
  return {
    search: spy,
    indexDocument: vi.fn(),
    deleteByDocument: vi.fn(),
  };
}

function makeTagsRepoFake(tags: Tag[]): TagsRepositoryPort {
  return {
    async listByOrg(orgId: string) {
      return tags.filter((t) => t.organizationId === orgId);
    },
    async findBySlugs(orgId: string, slugs: string[]) {
      return tags.filter(
        (t) => t.organizationId === orgId && slugs.includes(t.slug),
      );
    },
    async create() {
      throw new Error("not used in test");
    },
    async attachToDocument() {
      throw new Error("not used in test");
    },
  };
}

describe("REQ-43 — RagPort.search accepts optional tags + adapter resolves slugs", () => {
  it("RagPort.search signature accepts `tags?: string[]` as 5th positional param", () => {
    // Type-level assertion — adapter call below MUST compile.
    const port: RagPort | undefined = undefined;
    if (port) {
      // Should compile after REQ-43 lands.
      void port.search("q", "org-1", ["ORGANIZATION"], 5, ["a", "b"]);
    }
    expect(true).toBe(true);
  });

  it("LegacyRagAdapter resolves slug strings to tag IDs via TagsRepositoryPort.findBySlugs", async () => {
    const ragSearchSpy = vi.fn(async () => []);
    const ragService = makeRagServiceStub(ragSearchSpy);
    const tagsRepo = makeTagsRepoFake([
      {
        id: "tag-a-id",
        organizationId: "org-1",
        name: "Política",
        slug: "politica",
        color: null,
        createdAt: new Date(),
      },
      {
        id: "tag-b-id",
        organizationId: "org-1",
        name: "Cobros",
        slug: "cobros",
        color: null,
        createdAt: new Date(),
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new LegacyRagAdapter(ragService as any, tagsRepo);

    await adapter.search("query", "org-1", ["ORGANIZATION"], 5, [
      "politica",
      "cobros",
    ]);

    expect(ragSearchSpy).toHaveBeenCalledTimes(1);
    const args = ragSearchSpy.mock.calls[0];
    // 5th positional (index 4) — RESOLVED tag IDs, NOT the slugs.
    expect(args[4]).toEqual(["tag-a-id", "tag-b-id"]);
  });

  it("LegacyRagAdapter passes undefined for tagIds when slugs omitted (back-compat)", async () => {
    const ragSearchSpy = vi.fn(async () => []);
    const ragService = makeRagServiceStub(ragSearchSpy);
    const tagsRepo = makeTagsRepoFake([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new LegacyRagAdapter(ragService as any, tagsRepo);

    await adapter.search("query", "org-1", ["ORGANIZATION"], 5);

    expect(ragSearchSpy).toHaveBeenCalledTimes(1);
    // 5th positional (index 4) — undefined (no filter requested).
    expect(ragSearchSpy.mock.calls[0][4]).toBeUndefined();
  });

  it("LegacyRagAdapter passes undefined for tagIds when slug array is empty (no DB hit on findBySlugs)", async () => {
    const ragSearchSpy = vi.fn(async () => []);
    const ragService = makeRagServiceStub(ragSearchSpy);
    const findBySlugsSpy = vi.fn(async () => []);
    const tagsRepo: TagsRepositoryPort = {
      listByOrg: vi.fn(),
      findBySlugs: findBySlugsSpy,
      create: vi.fn(),
      attachToDocument: vi.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new LegacyRagAdapter(ragService as any, tagsRepo);

    await adapter.search("query", "org-1", ["ORGANIZATION"], 5, []);

    expect(findBySlugsSpy).not.toHaveBeenCalled();
    expect(ragSearchSpy.mock.calls[0][4]).toBeUndefined();
  });

  it("LegacyRagAdapter still resolves and forwards tagIds even when some slugs are unknown (silent drop)", async () => {
    const ragSearchSpy = vi.fn(async () => []);
    const ragService = makeRagServiceStub(ragSearchSpy);
    const tagsRepo = makeTagsRepoFake([
      {
        id: "tag-a-id",
        organizationId: "org-1",
        name: "Política",
        slug: "politica",
        color: null,
        createdAt: new Date(),
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new LegacyRagAdapter(ragService as any, tagsRepo);

    await adapter.search("query", "org-1", ["ORGANIZATION"], 5, [
      "politica",
      "does-not-exist",
    ]);

    // Only the resolved one is forwarded; unknown slugs are dropped.
    expect(ragSearchSpy.mock.calls[0][4]).toEqual(["tag-a-id"]);
  });
});

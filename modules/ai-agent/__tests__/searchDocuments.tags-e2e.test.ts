/**
 * REQ-42/43 — end-to-end wiring for searchDocuments tag filter.
 *
 * Threads the validated `tags` slugs from the searchDocumentsTool input
 * through buildRagContext -> RagPort.search -> LegacyRagAdapter.findBySlugs
 * resolution -> RagService.search 5th positional. This is the "no new code,
 * cements the wiring" cycle — every layer was added in commits C..E; this
 * test would catch any future refactor that drops one of the hops.
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - If any layer regresses (adapter ignores tagsRepo, buildRagContext
 *     drops the param, schema strips the field), the spy assertion
 *     `expect(ragSearchSpy.mock.calls[0][4]).toEqual([...])` fails. The
 *     test PASSES on the current HEAD because all wiring is in place.
 *     Functions as a coherence-sentinel for future drift.
 */

import { describe, it, expect, vi } from "vitest";

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
import { searchDocumentsTool } from "../domain/tools/agent.tool-definitions";
import { buildRagContext } from "../application/agent.context";
import type { TagsRepositoryPort } from "@/modules/tags/domain/ports/tags-repository.port";
import type { Tag } from "@/modules/tags/domain/tag.types";

type RagSearchSpy = ReturnType<
  typeof vi.fn<
    (
      query: string,
      orgId: string,
      scopes: string[],
      limit: number,
      tagIds?: string[],
    ) => Promise<
      Array<{
        content: string;
        documentId: string;
        score: number;
        documentName: string;
        chunkIndex: number;
        sectionPath: string | null;
      }>
    >
  >
>;

function makeRagServiceStub(spy: RagSearchSpy) {
  return {
    search: spy,
    indexDocument: vi.fn(),
    deleteByDocument: vi.fn(),
  };
}

function makeTagsRepo(tags: Tag[]): TagsRepositoryPort {
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

describe("REQ-42/43 e2e — searchDocumentsTool tags flow through to RagService", () => {
  it("validated { query, tags: [a,b] } reaches RagService.search as resolved tag IDs", async () => {
    // Step 1 — LLM tool-call input shape.
    const validated = searchDocumentsTool.inputSchema.parse({
      query: "iva credito fiscal",
      tags: ["politica", "cobros"],
    });
    expect(validated.tags).toEqual(["politica", "cobros"]);

    // Step 2 — build the adapter with a fake RagService + slug catalog.
    const ragSearchSpy: RagSearchSpy = vi.fn(async () => [
      {
        content: "snippet",
        documentId: "doc-1",
        score: 0.91,
        documentName: "Plan",
        chunkIndex: 0,
        sectionPath: null,
      },
    ]);
    const ragService = makeRagServiceStub(ragSearchSpy);
    const tagsRepo = makeTagsRepo([
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

    // Step 3 — bypass-path consumer (buildRagContext) forwards tags.
    const text = await buildRagContext(
      adapter,
      "org-1",
      validated.query,
      "admin",
      validated.tags,
    );

    // Sanity — rendering happened (citation token from REQ-32 prefix).
    expect(text).toContain("[Plan#chunk 0]");

    // Wiring assertion — RagService.search received the RESOLVED tag IDs.
    expect(ragSearchSpy).toHaveBeenCalledTimes(1);
    const args = ragSearchSpy.mock.calls[0];
    expect(args[0]).toBe("iva credito fiscal");
    expect(args[1]).toBe("org-1");
    expect(args[4]).toEqual(["tag-a-id", "tag-b-id"]);
  });

  it("validated { query } (no tags) flows undefined down to RagService.search 5th arg", async () => {
    const validated = searchDocumentsTool.inputSchema.parse({ query: "iva" });

    const ragSearchSpy: RagSearchSpy = vi.fn(async () => []);
    const ragService = makeRagServiceStub(ragSearchSpy);
    const tagsRepo = makeTagsRepo([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new LegacyRagAdapter(ragService as any, tagsRepo);

    await buildRagContext(adapter, "org-1", validated.query, "admin", validated.tags);

    expect(ragSearchSpy).toHaveBeenCalledTimes(1);
    expect(ragSearchSpy.mock.calls[0][4]).toBeUndefined();
  });
});

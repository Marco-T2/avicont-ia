/**
 * REQ-35 — RagService.indexDocument forwards chunker-emitted sectionPath
 * to VectorRepository.storeChunks (the wiring seam).
 *
 * Module-boundary mocks: embedding.service is mocked to bypass the
 * GEMINI_API_KEY env guard (production-only); vector.repository is mocked
 * to capture the storeChunks payload without touching pgvector. The chunker
 * is invoked for REAL — the input text drives the chunker through markdown
 * / fallback detectors so the sectionPath value comes from the real cascade.
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - F2-PRE indexDocument explicitly drops sectionPath (see rag.service.ts
 *     line 28 "F2-PRE: sectionPath emitted by chunker but NOT yet persisted").
 *     The captured storeChunks call has no `sectionPath` key, so the
 *     `expect(chunk.sectionPath).toBe("ACME")` assertion FAILS with
 *     `expected undefined to be "ACME"`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../embedding.service", () => ({
  EmbeddingService: class {
    async embed(_text: string) {
      return [0.1, 0.2, 0.3];
    }
    async embedBatch(texts: string[]) {
      return texts.map(() => [0.1, 0.2, 0.3]);
    }
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const storeChunksMock = vi.fn<(chunks: any[]) => Promise<void>>(async () => undefined);
vi.mock("../vector.repository", () => ({
  VectorRepository: class {
    storeChunks = storeChunksMock;
    async searchSimilar() {
      return [];
    }
    async deleteByDocument() {}
  },
}));

// Import RagService AFTER vi.mock declarations (hoisted, but explicit for clarity).
import { RagService } from "../rag.service";

describe("REQ-35 — RagService.indexDocument forwards sectionPath to storeChunks", () => {
  beforeEach(() => {
    storeChunksMock.mockClear();
  });

  afterEach(() => {
    storeChunksMock.mockClear();
  });

  it("each chunk persisted carries the sectionPath emitted by the chunker", async () => {
    const service = new RagService();
    // Markdown header → chunker emits sectionPath "ACME"
    await service.indexDocument(
      "doc-1",
      "org-1",
      "ORGANIZATION" as never,
      "# ACME\nbody line one\nbody line two",
    );

    expect(storeChunksMock).toHaveBeenCalledTimes(1);
    const stored = storeChunksMock.mock.calls[0][0] as unknown as Array<{
      sectionPath: string | null;
    }>;
    expect(stored.length).toBeGreaterThan(0);
    for (const chunk of stored) {
      expect(chunk.sectionPath).toBe("ACME");
    }
  });

  it("unstructured text persists sectionPath: null", async () => {
    const service = new RagService();
    await service.indexDocument(
      "doc-2",
      "org-1",
      "ORGANIZATION" as never,
      "just a plain paragraph with no detectable structure at all here.",
    );

    expect(storeChunksMock).toHaveBeenCalledTimes(1);
    const stored = storeChunksMock.mock.calls[0][0] as unknown as Array<{
      sectionPath: string | null;
    }>;
    expect(stored.length).toBeGreaterThan(0);
    for (const chunk of stored) {
      expect(chunk.sectionPath).toBeNull();
    }
  });
});

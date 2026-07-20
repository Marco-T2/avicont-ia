/**
 * REQ-35 — RagService.indexDocument forwards chunker-emitted sectionPath
 * to VectorStorePort.storeChunks (the wiring seam).
 *
 * Rewritten at poc-rag-hex C2. Before the migration this file module-mocked
 * `../embedding.service` (to bypass the import-time GEMINI_API_KEY guard) and
 * `../vector.repository` (to capture the storeChunks payload). Both mocks are
 * gone: RagService now takes its two ports by constructor injection, so the
 * fakes are passed DIRECTLY. Keeping the module mocks would have been doubly
 * wrong — they no longer intercept anything AND they pointed at specifiers
 * that no longer exist.
 *
 * The chunker is still invoked for REAL — the input text drives it through the
 * markdown / fallback detectors so the sectionPath value comes from the real
 * cascade, which is the whole point of this test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { RagService } from "../application/rag.service";
import type { EmbeddingPort } from "../domain/ports/embedding.port";
import type { VectorStorePort } from "../domain/ports/vector-store.port";
import type { ChunkInput } from "../domain/rag.types";

const storeChunksMock = vi.fn<(chunks: ChunkInput[]) => Promise<void>>(
  async () => undefined,
);

const fakeEmbedding: EmbeddingPort = {
  async embed(_text: string) {
    return [0.1, 0.2, 0.3];
  },
  async embedBatch(texts: string[]) {
    return texts.map(() => [0.1, 0.2, 0.3]);
  },
};

const fakeVectorStore: VectorStorePort = {
  storeChunks: storeChunksMock,
  async searchSimilar() {
    return [];
  },
  async deleteByDocument() {},
};

describe("REQ-35 — RagService.indexDocument forwards sectionPath to storeChunks", () => {
  beforeEach(() => {
    storeChunksMock.mockClear();
  });

  afterEach(() => {
    storeChunksMock.mockClear();
  });

  it("each chunk persisted carries the sectionPath emitted by the chunker", async () => {
    const service = new RagService(fakeEmbedding, fakeVectorStore);
    // Markdown header → chunker emits sectionPath "ACME"
    await service.indexDocument(
      "doc-1",
      "org-1",
      "ORGANIZATION" as never,
      "# ACME\nbody line one\nbody line two",
    );

    expect(storeChunksMock).toHaveBeenCalledTimes(1);
    const stored = storeChunksMock.mock.calls[0][0];
    expect(stored.length).toBeGreaterThan(0);
    for (const chunk of stored) {
      expect(chunk.sectionPath).toBe("ACME");
    }
  });

  it("unstructured text persists sectionPath: null", async () => {
    const service = new RagService(fakeEmbedding, fakeVectorStore);
    await service.indexDocument(
      "doc-2",
      "org-1",
      "ORGANIZATION" as never,
      "just a plain paragraph with no detectable structure at all here.",
    );

    expect(storeChunksMock).toHaveBeenCalledTimes(1);
    const stored = storeChunksMock.mock.calls[0][0];
    expect(stored.length).toBeGreaterThan(0);
    for (const chunk of stored) {
      expect(chunk.sectionPath).toBeNull();
    }
  });
});

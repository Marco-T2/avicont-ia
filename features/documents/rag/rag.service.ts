import "server-only";
import type { DocumentScope } from "@/features/permissions";
import { EmbeddingService } from "./embedding.service";
import { VectorRepository } from "./vector.repository";
import { chunkText } from "./chunking";

export class RagService {
  private readonly embeddingService: EmbeddingService;
  private readonly vectorRepo: VectorRepository;

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.vectorRepo = new VectorRepository();
  }

  /** Chunk text, generate embeddings, and store chunks for a document. */
  async indexDocument(
    documentId: string,
    organizationId: string,
    scope: DocumentScope,
    text: string,
  ): Promise<void> {
    const chunks = chunkText(text);
    const embeddings = await this.embeddingService.embedBatch(
      chunks.map((c) => c.content),
    );

    // F2-PRE: sectionPath emitted by chunker but NOT yet persisted —
    // DB column lands in F2-POST after Marco runs the migration.
    await this.vectorRepo.storeChunks(
      chunks.map((chunk, index) => ({
        documentId,
        organizationId,
        scope,
        content: chunk.content,
        chunkIndex: index,
        embedding: embeddings[index],
      })),
    );
  }

  /**
   * Embed a query and search for similar document chunks.
   *
   * Return shape carries `documentName` + `chunkIndex` for citations (REQ-30),
   * populated by `VectorRepository.searchSimilar` via the documents JOIN.
   */
  async search(
    query: string,
    organizationId: string,
    scopes: DocumentScope[],
    topK = 5,
  ): Promise<
    {
      content: string;
      documentId: string;
      score: number;
      documentName: string;
      chunkIndex: number;
    }[]
  > {
    const queryVector = await this.embeddingService.embed(query);
    return this.vectorRepo.searchSimilar(queryVector, organizationId, scopes, topK);
  }

  /** Delete all chunks for a document. */
  async deleteByDocument(documentId: string): Promise<void> {
    await this.vectorRepo.deleteByDocument(documentId);
  }
}

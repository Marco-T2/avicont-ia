import "server-only";
import type { DocumentScope } from "@/features/shared/permissions";
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
    const embeddings = await this.embeddingService.embedBatch(chunks);

    await this.vectorRepo.storeChunks(
      chunks.map((content, index) => ({
        documentId,
        organizationId,
        scope,
        content,
        chunkIndex: index,
        embedding: embeddings[index],
      })),
    );
  }

  /** Embed a query and search for similar document chunks. */
  async search(
    query: string,
    organizationId: string,
    scopes: DocumentScope[],
    topK = 5,
  ): Promise<{ content: string; documentId: string; score: number }[]> {
    const queryVector = await this.embeddingService.embed(query);
    return this.vectorRepo.searchSimilar(queryVector, organizationId, scopes, topK);
  }

  /** Delete all chunks for a document. */
  async deleteByDocument(documentId: string): Promise<void> {
    await this.vectorRepo.deleteByDocument(documentId);
  }
}

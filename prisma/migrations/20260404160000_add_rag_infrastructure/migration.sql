-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "DocumentScope" AS ENUM ('ORGANIZATION', 'ACCOUNTING', 'FARM');

-- AlterTable: add scope to documents
ALTER TABLE "documents" ADD COLUMN "scope" "DocumentScope" NOT NULL DEFAULT 'ORGANIZATION';

-- CreateIndex: composite index for scoped document queries
CREATE INDEX "documents_organizationId_scope_idx" ON "documents"("organizationId", "scope");

-- CreateTable: document_chunks for RAG embeddings
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scope" "DocumentScope" NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" vector(768) NOT NULL,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: composite index for scoped vector search
CREATE INDEX "document_chunks_organizationId_scope_idx" ON "document_chunks"("organizationId", "scope");

-- CreateIndex: HNSW index for fast approximate nearest neighbor search
CREATE INDEX "document_chunks_embedding_idx" ON "document_chunks"
USING hnsw ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: chat_messages for conversational memory
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_messages_sessionId_createdAt_idx" ON "chat_messages"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_organizationId_userId_idx" ON "chat_messages"("organizationId", "userId");

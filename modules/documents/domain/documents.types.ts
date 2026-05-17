/**
 * Documents hex — domain types (R5 absoluta).
 *
 * NO Prisma imports here; NO `server-only` marker (REQ-005 NEGATIVE).
 * `DocumentWithRelations` was previously typed via `PrismaDocument` in
 * features/documents/documents.types.ts; relocated here we re-express the
 * Document shape inline so the domain remains framework-agnostic.
 */
import type { DocumentScope } from "@/features/permissions";

// ── Domain types ──

/** Persistence-agnostic Document shape (mirrors Prisma Document fields). */
export interface Document {
  id: string;
  name: string;
  content: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  fileType: string | null;
  scope: DocumentScope;
  organizationId: string;
  userId: string;
  aiSummary: string | null;
  createdAt: Date;
}

export type DocumentWithRelations = Document & {
  user: { name: string | null; email: string };
  organization: { name: string; clerkOrgId: string };
};

export interface CreateDocumentInput {
  name: string;
  content?: string | null;
  fileUrl?: string | null;
  fileSize?: number;
  fileType?: string;
  scope?: DocumentScope;
  organizationId: string;
  userId: string;
}

export interface DocumentListResult {
  documents: DocumentWithRelations[];
  metadata: {
    organization: string;
    clerkOrgId: string;
    documentCount: number;
    userRole: string;
  };
}

export interface DocumentUploadResult {
  id: string;
  name: string;
  fileUrl: string | null;
  organization: string;
  clerkOrgId: string;
  uploadedBy: string | null;
}

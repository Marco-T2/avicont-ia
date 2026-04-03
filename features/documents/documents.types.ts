import type { Document as PrismaDocument } from "@/generated/prisma/client";

// ── Domain types ──

export type DocumentWithRelations = PrismaDocument & {
  user: { name: string | null; email: string };
  organization: { name: string; clerkOrgId: string };
};

export interface CreateDocumentInput {
  name: string;
  content?: string | null;
  fileUrl?: string | null;
  fileSize?: number;
  fileType?: string;
  organizationId: string;
  userId: string;
}

export interface DocumentListResult {
  documents: DocumentWithRelations[];
  metadata: {
    organization: string;
    clerkOrgId: string;
    documentCount: number;
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

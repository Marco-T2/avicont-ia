import type { Document as PrismaDocument } from "@/generated/prisma/client";
import type { DocumentScope } from "@/features/shared/permissions";

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

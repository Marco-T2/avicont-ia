import { prisma } from "@/lib/prisma";
import { uploadToBlob, deleteFromBlob } from "@/lib/blob";
import { NotFoundError, ForbiddenError, ValidationError } from "@/features/shared/errors";
import { DocumentsRepository } from "./documents.repository";
import type {
  DocumentListResult,
  DocumentUploadResult,
  DocumentWithRelations,
} from "./documents.types";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export class DocumentsService {
  private readonly repo: DocumentsRepository;

  constructor(repo?: DocumentsRepository) {
    this.repo = repo ?? new DocumentsRepository();
  }

  // ── List documents for an organization ──

  async list(clerkOrgId: string, clerkUserId: string): Promise<DocumentListResult> {
    const { orgId, org } = await this.resolveOrgAccess(clerkOrgId, clerkUserId);

    const documents = await this.repo.findAll(orgId);

    return {
      documents,
      metadata: {
        organization: org.name,
        clerkOrgId: org.clerkOrgId,
        documentCount: documents.length,
      },
    };
  }

  // ── Get a single document ──

  async getById(
    documentId: string,
    organizationId: string,
  ): Promise<DocumentWithRelations> {
    const doc = await this.repo.findById(documentId, organizationId);
    if (!doc) throw new NotFoundError("Documento");
    return doc;
  }

  // ── Upload / create a document ──

  async upload(
    clerkOrgId: string,
    clerkUserId: string,
    name: string,
    content?: string | null,
    file?: File | null,
  ): Promise<DocumentUploadResult> {
    const { orgId, org, user } = await this.resolveOrgAccess(clerkOrgId, clerkUserId);

    let fileUrl: string | null = null;
    let fileSize: number | undefined;
    let fileType: string | undefined;
    let extractedContent = content;

    if (file && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        throw new ValidationError("El archivo excede el límite de 50MB");
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new ValidationError("Tipo de archivo no permitido");
      }

      const blob = await uploadToBlob(file, clerkOrgId, clerkUserId);
      fileUrl = blob.url;
      fileSize = file.size;
      fileType = file.type;

      if (!extractedContent && file.type.includes("text")) {
        extractedContent = await file.text();
      }
    }

    const document = await this.repo.create({
      name,
      content: extractedContent,
      fileUrl,
      fileSize,
      fileType,
      organizationId: orgId,
      userId: user.id,
    });

    return {
      id: document.id,
      name: document.name,
      fileUrl: document.fileUrl,
      organization: org.name,
      clerkOrgId: org.clerkOrgId,
      uploadedBy: document.user.name,
    };
  }

  // ── Delete a document ──

  async delete(documentId: string, clerkUserId: string): Promise<void> {
    const document = await this.repo.findByIdWithMembers(documentId, clerkUserId);

    if (!document) throw new NotFoundError("Documento");
    if (document.organization.members.length === 0) {
      throw new ForbiddenError();
    }

    // Delete blob if it exists
    if (document.fileUrl) {
      try {
        await deleteFromBlob(document.fileUrl);
      } catch {
        // Continue with DB deletion even if blob deletion fails
        console.error("Failed to delete blob for document:", documentId);
      }
    }

    await this.repo.delete(documentId, document.organizationId);
  }

  // ── Private helpers ──

  private async resolveOrgAccess(clerkOrgId: string, clerkUserId: string) {
    const org = await prisma.organization.findUnique({
      where: { clerkOrgId },
    });
    if (!org) throw new NotFoundError("Organización");

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        memberships: {
          where: { organizationId: org.id },
        },
      },
    });

    if (!user || user.memberships.length === 0) {
      throw new ForbiddenError();
    }

    return { orgId: org.id, org, user };
  }
}

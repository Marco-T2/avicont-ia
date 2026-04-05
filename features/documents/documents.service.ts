import { uploadToBlob, deleteFromBlob } from "@/lib/blob";
import { NotFoundError, ForbiddenError, ValidationError } from "@/features/shared/errors";
import { canUploadToScope, type DocumentScope } from "@/features/shared/permissions";
import { RagService } from "@/features/rag";
import { DocumentsRepository } from "./documents.repository";
import type {
  DocumentListResult,
  DocumentUploadResult,
  DocumentWithRelations,
} from "./documents.types";
import path from "path";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

// Point to the real worker file for server-side usage
GlobalWorkerOptions.workerSrc = path.resolve(
  process.cwd(),
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
);

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
  private readonly ragService: RagService;

  constructor(repo?: DocumentsRepository) {
    this.repo = repo ?? new DocumentsRepository();
    this.ragService = new RagService();
  }

  // ── List documents for an organization ──

  async list(clerkOrgId: string, clerkUserId: string): Promise<DocumentListResult> {
    const { orgId, org, user } = await this.resolveOrgAccess(clerkOrgId, clerkUserId);

    const documents = await this.repo.findAll(orgId);
    const membership = user.memberships[0];

    return {
      documents,
      metadata: {
        organization: org.name,
        clerkOrgId: org.clerkOrgId,
        documentCount: documents.length,
        userRole: membership.role,
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
    scope: DocumentScope = "ORGANIZATION",
  ): Promise<DocumentUploadResult> {
    const { orgId, org, user } = await this.resolveOrgAccess(clerkOrgId, clerkUserId);

    // Validate scope against user role
    const membership = user.memberships[0];
    if (!canUploadToScope(membership.role, scope)) {
      throw new ForbiddenError();
    }

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

      // Extract text from PDFs
      if (file.type === "application/pdf") {
        extractedContent = await this.extractPdfText(file);
      } else if (!extractedContent && file.type.includes("text")) {
        extractedContent = await file.text();
      }
    }

    const document = await this.repo.create({
      name,
      content: extractedContent,
      fileUrl,
      fileSize,
      fileType,
      scope,
      organizationId: orgId,
      userId: user.id,
    });

    // Generate embeddings for text content (async, non-blocking for response)
    if (extractedContent && extractedContent.length > 10) {
      this.ragService.indexDocument(document.id, orgId, scope, extractedContent).catch(
        (err) => console.error("Embedding generation failed:", err),
      );
    }

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

    // Delete chunks (cascade also handled by DB FK, but explicit cleanup is safer)
    await this.ragService.deleteByDocument(documentId);

    // Delete blob if it exists
    if (document.fileUrl) {
      try {
        await deleteFromBlob(document.fileUrl);
      } catch {
        console.error("Failed to delete blob for document:", documentId);
      }
    }

    await this.repo.delete(documentId, document.organizationId);
  }

  // ── Analysis ──

  async findForAnalysis(documentId: string, clerkUserId: string) {
    return this.repo.findForAnalysis(documentId, clerkUserId);
  }

  async updateAnalysis(
    documentId: string,
    data: { aiSummary: string; aiKeywords: string[]; sentiment: string },
  ) {
    return this.repo.updateAnalysis(documentId, data);
  }

  // ── Private helpers ──

  private async extractPdfText(file: File): Promise<string | null> {
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
      }
      await pdf.destroy();
      return pages.join("\n").trim() || null;
    } catch (err) {
      console.error("PDF text extraction failed:", err);
      return null;
    }
  }

  private async resolveOrgAccess(clerkOrgId: string, clerkUserId: string) {
    const org = await this.repo.findOrgByClerkId(clerkOrgId);
    if (!org) throw new NotFoundError("Organización");

    const user = await this.repo.findUserWithMembership(clerkUserId, org.id);

    if (!user || user.memberships.length === 0) {
      throw new ForbiddenError();
    }

    return { orgId: org.id, org, user };
  }
}

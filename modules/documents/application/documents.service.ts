/**
 * DocumentsService — application layer (hex).
 *
 * R5 absoluta: no server-only marker here (REQ-005 NEGATIVE) and no
 * direct `@/lib/blob` import (REQ-002). Blob storage flows through
 * BlobStoragePort. RagService is reached via cross-module canonical-bypass
 * (REQ-004) — rag/ stays at features path until poc-rag-hex closes.
 *
 * Paired sister: modules/org-profile/application/org-profile.service.ts.
 */
import { NotFoundError, ForbiddenError, ValidationError } from "@/features/shared/errors";
import { canUploadToScope, type DocumentScope } from "@/features/permissions";
// cross-module canonical-bypass REQ-004 — rag/ stays at features path (poc-rag-hex)
import { RagService } from "@/features/documents/rag/server";
import type { BlobStoragePort } from "@/modules/documents/domain/ports/blob-storage.port";
import type {
  DocumentListResult,
  DocumentUploadResult,
  DocumentWithRelations,
  CreateDocumentInput,
} from "@/modules/documents/domain/documents.types";
import path from "path";
// processing library accepted exception — no PdfPort (REQ-007)
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
// processing library accepted exception — no DocxPort (REQ-007, mirrors pdfjs)
import mammoth from "mammoth";
// processing library accepted exception — no XlsxPort (REQ-007, mirrors pdfjs)
import ExcelJS from "exceljs";

// Apuntar al archivo worker real para uso en el servidor
GlobalWorkerOptions.workerSrc = path.resolve(
  process.cwd(),
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/** Structural port for the documents repository (compile-shape only). */
export interface DocumentsRepositoryPort {
  findAll(organizationId: string): Promise<DocumentWithRelations[]>;
  findById(id: string, organizationId: string): Promise<DocumentWithRelations | null>;
  findByIdWithMembers(id: string, clerkUserId: string): Promise<unknown>;
  create(input: CreateDocumentInput): Promise<DocumentWithRelations>;
  delete(id: string, organizationId: string): Promise<void>;
  findOrgByClerkId(clerkOrgId: string): Promise<{ id: string; name: string; clerkOrgId: string } | null>;
  findUserWithMembership(
    clerkUserId: string,
    organizationId: string,
  ): Promise<{ id: string; memberships: Array<{ role: string }> } | null>;
  findForAnalysis(documentId: string, clerkUserId: string): Promise<unknown>;
  updateAnalysis(
    organizationId: string,
    documentId: string,
    data: { aiSummary: string },
  ): Promise<unknown>;
}

export class DocumentsService {
  constructor(
    private readonly repo: DocumentsRepositoryPort,
    private readonly blobStorage: BlobStoragePort,
    private readonly ragService: RagService,
  ) {}

  // ── Listar documentos de una organización ──

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

  // ── Obtener un documento por ID ──

  async getById(
    documentId: string,
    organizationId: string,
  ): Promise<DocumentWithRelations> {
    const doc = await this.repo.findById(documentId, organizationId);
    if (!doc) throw new NotFoundError("Documento");
    return doc;
  }

  // ── Subir / crear un documento ──

  async upload(
    clerkOrgId: string,
    clerkUserId: string,
    name: string,
    content?: string | null,
    file?: File | null,
    scope: DocumentScope = "ORGANIZATION",
  ): Promise<DocumentUploadResult> {
    const { orgId, org, user } = await this.resolveOrgAccess(clerkOrgId, clerkUserId);

    // Validar el scope contra el rol del usuario
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

      const blob = await this.blobStorage.upload(file, clerkOrgId, clerkUserId);
      fileUrl = blob.url;
      fileSize = file.size;
      fileType = file.type;
    }

    // Saga: desde acá adelante, cualquier fallo compensa el blob subido y el
    // documento creado para no dejar estado parcial (blob huérfano sin doc,
    // o doc sin embeddings invisible al RAG).
    let documentId: string | undefined;
    try {
      if (file && file.size > 0 && file.type === "application/pdf") {
        extractedContent = await this.extractPdfText(file);
      } else if (
        file &&
        file.size > 0 &&
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        extractedContent = await this.extractDocxText(file);
      } else if (
        file &&
        file.size > 0 &&
        file.type ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ) {
        extractedContent = await this.extractXlsxText(file);
      } else if (
        file &&
        file.size > 0 &&
        !extractedContent &&
        file.type.includes("text")
      ) {
        extractedContent = await file.text();
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
      documentId = document.id;

      if (extractedContent && extractedContent.length > 10) {
        await this.ragService.indexDocument(
          document.id,
          orgId,
          scope,
          extractedContent,
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
    } catch (err) {
      if (documentId) {
        await this.repo.delete(documentId, orgId).catch((rollbackErr) =>
          console.error("Rollback failed (document):", rollbackErr),
        );
      }
      if (fileUrl) {
        await this.blobStorage.del(fileUrl).catch((rollbackErr) =>
          console.error("Rollback failed (blob):", rollbackErr),
        );
      }
      throw err;
    }
  }

  // ── Eliminar un documento ──

  async delete(documentId: string, clerkUserId: string): Promise<void> {
    const document = (await this.repo.findByIdWithMembers(
      documentId,
      clerkUserId,
    )) as
      | {
          fileUrl: string | null;
          organizationId: string;
          organization: { members: unknown[] };
        }
      | null;

    if (!document) throw new NotFoundError("Documento");
    if (document.organization.members.length === 0) {
      throw new ForbiddenError();
    }

    // Eliminar chunks (el cascade también lo maneja la FK de la BD, pero la limpieza explícita es más segura)
    await this.ragService.deleteByDocument(documentId);

    // Eliminar el blob si existe
    if (document.fileUrl) {
      try {
        await this.blobStorage.del(document.fileUrl);
      } catch {
        console.error("Failed to delete blob for document:", documentId);
      }
    }

    await this.repo.delete(documentId, document.organizationId);
  }

  // ── Análisis ──

  async findForAnalysis(documentId: string, clerkUserId: string) {
    return this.repo.findForAnalysis(documentId, clerkUserId);
  }

  async updateAnalysis(
    organizationId: string,
    documentId: string,
    data: { aiSummary: string },
  ) {
    return this.repo.updateAnalysis(organizationId, documentId, data);
  }

  // ── Auxiliares privados ──

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
      // null legítimo: el PDF parseó OK pero no contiene texto extraíble
      // (p. ej. escaneo sin OCR). Caso distinto del catch de abajo.
      return pages.join("\n").trim() || null;
    } catch (err) {
      // El parser explotó — PDF corrupto o formato no soportado. Antes
      // devolvíamos null, conflating con "sin texto"; el documento se creaba
      // de todos modos y nunca llegaba al RAG. Ahora falla explícito.
      console.error("PDF text extraction failed:", err);
      throw new ValidationError("No se pudo procesar el PDF");
    }
  }

  private async extractDocxText(file: File): Promise<string | null> {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      // null legítimo cuando el DOCX no tiene texto en el body.
      return result.value?.trim() || null;
    } catch (err) {
      // Paired sister: extractPdfText — el parser explotó; falla explícito
      // (saga rollback en upload limpia blob + doc).
      console.error("DOCX text extraction failed:", err);
      throw new ValidationError("No se pudo procesar el archivo");
    }
  }

  private async extractXlsxText(file: File): Promise<string | null> {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const sheetBlocks: string[] = [];
      workbook.eachSheet((sheet) => {
        const lines: string[] = [`=== ${sheet.name} ===`];
        sheet.eachRow((row) => {
          // row.values is 1-indexed: first element is undefined.
          const raw = (row.values as unknown[]) ?? [];
          const cells = raw
            .slice(1)
            .map((v) => this.flattenXlsxCell(v))
            .join("\t");
          lines.push(cells);
        });
        sheetBlocks.push(lines.join("\n"));
      });

      const text = sheetBlocks.join("\n\n").trim();
      return text || null;
    } catch (err) {
      // Paired sister: extractPdfText / extractDocxText — falla explícito
      // para que la saga del upload limpie blob + doc.
      console.error("XLSX text extraction failed:", err);
      throw new ValidationError("No se pudo procesar el archivo");
    }
  }

  /** Flatten a single exceljs cell value to its string representation. */
  private flattenXlsxCell(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      // Rich text: { richText: [{ text: '...' }, ...] }
      if (Array.isArray(obj.richText)) {
        return (obj.richText as Array<{ text?: unknown }>)
          .map((r) => (typeof r.text === "string" ? r.text : ""))
          .join("");
      }
      // Formula cell: { formula, result } — prefer evaluated result
      if ("result" in obj && obj.result !== undefined && obj.result !== null) {
        return this.flattenXlsxCell(obj.result);
      }
      // Hyperlink: { text, hyperlink }
      if (typeof obj.text === "string") return obj.text;
      // Error cell: { error: '#REF!' }
      if (typeof obj.error === "string") return obj.error;
      return "";
    }
    return String(value);
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

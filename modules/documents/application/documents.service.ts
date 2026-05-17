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
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "@/features/shared/errors";
import {
  canUploadToScope,
  getRagScopes,
  type DocumentScope,
} from "@/features/permissions";
// cross-module canonical-bypass REQ-004 — rag/ stays at features path (poc-rag-hex)
import { RagService } from "@/features/documents/rag/server";
import type { BlobStoragePort } from "@/modules/documents/domain/ports/blob-storage.port";
// F5/REQ-45 — optional tags attachment port. Optional ctor param keeps every
// existing instantiation (tests, composition root pre-wire) source-compatible.
import type { TagsRepositoryPort } from "@/modules/tags/domain/ports/tags-repository.port";
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

// Apuntar al archivo worker real para uso en el servidor
GlobalWorkerOptions.workerSrc = path.resolve(
  process.cwd(),
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
// RESOLVED-3: DOCX sync extractor (mammoth) blocks the event loop on large
// files; >5MB short-circuits to null content + warning log. Document still
// uploads, just absent from RAG search. Worker-thread offload deferred.
const MAX_SYNC_EXTRACT_SIZE = 5 * 1024 * 1024; // 5 MB
// Scope-locked 2026-05-17: PDF + DOCX + TXT only. XLSX retired (Excel
// is for tabular/numeric data — RAG semantic search is the wrong tool;
// REQ-37/38 RETIRED). Images retired (sin OCR no aportan al RAG; users
// con escaneos deben convertir a PDF con OCR client-side, ej. Adobe Scan).
const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/** Structural port for the documents repository (compile-shape only). */
export interface DocumentsRepositoryPort {
  findAll(
    organizationId: string,
    allowedScopes: DocumentScope[],
  ): Promise<DocumentWithRelations[]>;
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
    // F5/REQ-45 — optional to preserve back-compat with existing test fakes
    // and composition-root pre-F5 instantiations; upload() guards on null.
    private readonly tagsRepository?: TagsRepositoryPort,
  ) {}

  // ── Listar documentos de una organización ──

  async list(clerkOrgId: string, clerkUserId: string): Promise<DocumentListResult> {
    const { orgId, org, user } = await this.resolveOrgAccess(clerkOrgId, clerkUserId);
    const membership = user.memberships[0];

    // C1 bug fix — filter the listing by the caller role's RAG scope matrix
    // (single source of truth shared with the AI agent's RAG search). Previously
    // findAll returned every doc of the org regardless of scope, so a `member`
    // (granjero) saw ACCOUNTING-scoped docs and could open their Vercel Blob URL.
    // Null → role has no RAG access at all; short-circuit with an empty list
    // BEFORE touching the repo (no DB round-trip for a forbidden viewer).
    const allowedScopes = getRagScopes(membership.role);
    const documents = allowedScopes === null
      ? []
      : await this.repo.findAll(orgId, allowedScopes);

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
    tagIds?: string[],
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

      // F5/REQ-45 — attach tags BEFORE indexing so a failure still rolls back
      // the parent document via the existing saga catch (blob + delete). When
      // tagsRepository is absent (back-compat ctor) any tagIds passed here
      // are silently dropped — surface honest: caller wired upload without
      // providing the optional dep, so attach is a no-op by design.
      if (tagIds && tagIds.length > 0 && this.tagsRepository) {
        await this.tagsRepository.attachToDocument(document.id, tagIds);
      }

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
          scope: DocumentScope;
          organizationId: string;
          organization: { members: unknown[] };
        }
      | null;

    if (!document) throw new NotFoundError("Documento");
    if (document.organization.members.length === 0) {
      throw new ForbiddenError();
    }

    // C1 bug fix — scope-aware RBAC. Same-org membership is necessary but not
    // sufficient: a `member` (granjero) in an org with ACCOUNTING docs must NOT
    // be able to delete them by guessing the id. Match the caller role's RAG
    // scope matrix (same matrix list() and the AI agent use). FAIL CLOSED: if
    // the role lookup misses (custom role w/o RAG access), getRagScopes returns
    // null → no scope is allowed → Forbidden.
    const user = await this.repo.findUserWithMembership(
      clerkUserId,
      document.organizationId,
    );
    const role = user?.memberships[0]?.role;
    const allowedScopes = role ? getRagScopes(role) : null;
    if (!allowedScopes || !allowedScopes.includes(document.scope)) {
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
    if (file.size > MAX_SYNC_EXTRACT_SIZE) {
      console.warn(
        `[documents] DOCX extraction skipped (file > ${MAX_SYNC_EXTRACT_SIZE} bytes): ${file.name} (${file.size} bytes). Document persists without indexed content (RESOLVED-3).`,
      );
      return null;
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      // Markdown preserva headings (`# H1`) — el chunker F2 (REQ-33) detecta
      // `^#+\s` para sectionPath. extractRawText los aplasta a texto plano.
      // convertToMarkdown existe en runtime (mammoth 1.12) pero falta en d.ts.
      const mammothExt = mammoth as unknown as {
        convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
      };
      const result = await mammothExt.convertToMarkdown({ buffer });
      return result.value?.trim() || null;
    } catch (err) {
      // Paired sister: extractPdfText — el parser explotó; falla explícito
      // (saga rollback en upload limpia blob + doc).
      console.error("DOCX text extraction failed:", err);
      throw new ValidationError("No se pudo procesar el archivo");
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

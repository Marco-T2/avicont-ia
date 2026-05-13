/**
 * PrismaDocumentsRepository — infrastructure adapter for documents persistence.
 *
 * R5 isolation: this is the Prisma-bearing layer for documents. NO server-only
 * marker here (REQ-005 NEGATIVE — that concern is carried by presentation/server.ts).
 *
 * Extends BaseRepository (canonical at @/modules/shared/infrastructure/base.repository
 * via the @/features/shared/base.repository SHIM).
 */
import { BaseRepository } from "@/features/shared/base.repository";
import type { Prisma } from "@/generated/prisma/client";
import type {
  CreateDocumentInput,
  DocumentWithRelations,
} from "@/modules/documents/domain/documents.types";

const documentInclude = {
  user: { select: { name: true, email: true } },
  organization: { select: { name: true, clerkOrgId: true } },
} as const satisfies Prisma.DocumentInclude;

export class PrismaDocumentsRepository extends BaseRepository {
  async findAll(organizationId: string): Promise<DocumentWithRelations[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.document.findMany({
      where: scope,
      include: documentInclude,
      orderBy: { createdAt: "desc" },
    }) as Promise<DocumentWithRelations[]>;
  }

  async findById(
    id: string,
    organizationId: string,
  ): Promise<DocumentWithRelations | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.document.findFirst({
      where: { id, ...scope },
      include: documentInclude,
    }) as Promise<DocumentWithRelations | null>;
  }

  async findByIdWithMembers(id: string, clerkUserId: string) {
    return this.db.document.findUnique({
      where: { id },
      include: {
        organization: {
          include: {
            members: {
              where: { user: { clerkUserId } },
            },
          },
        },
      },
    });
  }

  async create(input: CreateDocumentInput): Promise<DocumentWithRelations> {
    const scope = this.requireOrg(input.organizationId);

    return this.db.document.create({
      data: {
        name: input.name,
        content: input.content ?? null,
        fileUrl: input.fileUrl ?? null,
        fileSize: input.fileSize ?? 0,
        fileType: input.fileType ?? "unknown",
        scope: input.scope ?? "ORGANIZATION",
        organizationId: scope.organizationId,
        userId: input.userId,
        aiKeywords: [],
      },
      include: documentInclude,
    }) as Promise<DocumentWithRelations>;
  }

  async findForAnalysis(documentId: string, clerkUserId: string) {
    return this.db.document.findFirst({
      where: {
        id: documentId,
        organization: {
          members: { some: { user: { clerkUserId } } },
        },
      },
    });
  }

  async updateAnalysis(
    organizationId: string,
    documentId: string,
    data: { aiSummary: string; aiKeywords: string[]; sentiment: string },
  ) {
    return this.db.document.update({
      where: { id: documentId, organizationId },
      data,
    });
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const scope = this.requireOrg(organizationId);

    await this.db.document.delete({
      where: { id, ...scope },
    });
  }

  async findOrgByClerkId(clerkOrgId: string) {
    return this.db.organization.findUnique({
      where: { clerkOrgId },
    });
  }

  async findUserWithMembership(clerkUserId: string, organizationId: string) {
    return this.db.user.findUnique({
      where: { clerkUserId },
      include: {
        memberships: {
          where: { organizationId },
        },
      },
    });
  }
}

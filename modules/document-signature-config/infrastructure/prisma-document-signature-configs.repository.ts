import "server-only";
import { prisma } from "@/lib/prisma";
import { type PrismaClient } from "@/generated/prisma/client";
import type { DocumentSignatureConfigsRepository } from "../domain/document-signature-config.repository";
import {
  DocumentSignatureConfig,
  type DocumentPrintType,
} from "../domain/document-signature-config.entity";
import { toDomain, toPersistence } from "./document-signature-config.mapper";

type DbClient = Pick<PrismaClient, "documentSignatureConfig">;

export class PrismaDocumentSignatureConfigsRepository
  implements DocumentSignatureConfigsRepository
{
  constructor(private readonly db: DbClient = prisma) {}

  async findMany(
    organizationId: string,
  ): Promise<DocumentSignatureConfig[]> {
    const rows = await this.db.documentSignatureConfig.findMany({
      where: { organizationId },
    });
    return rows.map(toDomain);
  }

  async findOne(
    organizationId: string,
    documentType: DocumentPrintType,
  ): Promise<DocumentSignatureConfig | null> {
    const row = await this.db.documentSignatureConfig.findUnique({
      where: {
        organizationId_documentType: {
          organizationId,
          documentType,
        },
      },
    });
    return row ? toDomain(row) : null;
  }

  async save(entity: DocumentSignatureConfig): Promise<void> {
    const data = toPersistence(entity);
    await this.db.documentSignatureConfig.upsert({
      where: {
        organizationId_documentType: {
          organizationId: data.organizationId,
          documentType: data.documentType,
        },
      },
      create: data,
      update: {
        labels: data.labels,
        showReceiverRow: data.showReceiverRow,
        updatedAt: data.updatedAt,
      },
    });
  }
}

import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { PrismaDocumentSignatureConfigsRepository } from "../prisma-document-signature-configs.repository";
import { DocumentSignatureConfig } from "../../domain/document-signature-config.entity";

const dbWith = (
  dscOverrides: Record<string, unknown>,
): PrismaClient =>
  ({
    documentSignatureConfig: dscOverrides,
  }) as unknown as PrismaClient;

const buildEntity = () =>
  DocumentSignatureConfig.create("org-1", "COMPROBANTE", {
    labels: ["ELABORADO", "APROBADO"],
    showReceiverRow: false,
  });

const buildRow = (override: Record<string, unknown> = {}) => ({
  id: "dsc-1",
  organizationId: "org-1",
  documentType: "COMPROBANTE",
  labels: ["ELABORADO", "APROBADO"],
  showReceiverRow: false,
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
  ...override,
});

describe("PrismaDocumentSignatureConfigsRepository", () => {
  describe("findMany", () => {
    // α24
    it("scopes by organizationId", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([buildRow()]);
      const repo = new PrismaDocumentSignatureConfigsRepository(
        dbWith({ findMany }),
      );

      const result = await repo.findMany("org-1");

      expect(findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.organizationId).toBe("org-1");
    });
  });

  describe("findOne", () => {
    // α25
    it("queries by composite (organizationId, documentType) unique", async () => {
      const findUnique = vi.fn().mockResolvedValueOnce(buildRow());
      const repo = new PrismaDocumentSignatureConfigsRepository(
        dbWith({ findUnique }),
      );

      const result = await repo.findOne("org-1", "COMPROBANTE");

      expect(findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_documentType: {
            organizationId: "org-1",
            documentType: "COMPROBANTE",
          },
        },
      });
      expect(result?.documentType).toBe("COMPROBANTE");
    });

    // α26
    it("returns null when no row found", async () => {
      const findUnique = vi.fn().mockResolvedValueOnce(null);
      const repo = new PrismaDocumentSignatureConfigsRepository(
        dbWith({ findUnique }),
      );

      const result = await repo.findOne("org-1", "VENTA");

      expect(result).toBeNull();
    });
  });

  describe("save", () => {
    // α27
    it("upserts by composite unique (organizationId_documentType)", async () => {
      const upsert = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaDocumentSignatureConfigsRepository(
        dbWith({ upsert }),
      );

      const entity = buildEntity();
      await repo.save(entity);

      expect(upsert).toHaveBeenCalledTimes(1);
      const callArg = upsert.mock.calls[0]?.[0];
      expect(callArg.where.organizationId_documentType).toEqual({
        organizationId: entity.organizationId,
        documentType: entity.documentType,
      });
      expect(callArg.create.labels).toEqual(["ELABORADO", "APROBADO"]);
      expect(callArg.update.labels).toEqual(["ELABORADO", "APROBADO"]);
    });
  });
});

import { describe, it, expect } from "vitest";
import type { DocumentSignatureConfig as PrismaDocumentSignatureConfig } from "@/generated/prisma/client";
import { toDomain, toPersistence } from "../document-signature-config.mapper";
import { DocumentSignatureConfig } from "../../domain/document-signature-config.entity";

const row = (
  override: Partial<PrismaDocumentSignatureConfig> = {},
): PrismaDocumentSignatureConfig => ({
  id: "dsc-1",
  organizationId: "org-1",
  documentType: "COMPROBANTE",
  labels: ["ELABORADO", "APROBADO"],
  showReceiverRow: false,
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
  ...override,
});

describe("document-signature-config mapper", () => {
  describe("toDomain()", () => {
    // α17
    it("hydrates a DocumentSignatureConfig from a Prisma row", () => {
      const d = toDomain(row());
      expect(d).toBeInstanceOf(DocumentSignatureConfig);
      expect(d.id).toBe("dsc-1");
      expect(d.organizationId).toBe("org-1");
      expect(d.documentType).toBe("COMPROBANTE");
    });

    // α18
    it("preserves labels array", () => {
      const d = toDomain(row({ labels: ["VISTO_BUENO", "PROPIETARIO"] }));
      expect(d.labels).toEqual(["VISTO_BUENO", "PROPIETARIO"]);
    });

    // α19
    it("preserves showReceiverRow boolean", () => {
      const withTrue = toDomain(row({ showReceiverRow: true }));
      const withFalse = toDomain(row({ showReceiverRow: false }));
      expect(withTrue.showReceiverRow).toBe(true);
      expect(withFalse.showReceiverRow).toBe(false);
    });

    // α20
    it("handles empty labels array", () => {
      const d = toDomain(row({ labels: [] }));
      expect(d.labels).toEqual([]);
    });
  });

  describe("toPersistence()", () => {
    const buildEntity = () =>
      DocumentSignatureConfig.create("org-1", "VENTA", {
        labels: ["REGISTRADO"],
        showReceiverRow: true,
      });

    // α21
    it("returns a Prisma persistence payload", () => {
      const entity = buildEntity();
      const data = toPersistence(entity);
      expect(data.id).toBe(entity.id);
      expect(data.documentType).toBe("VENTA");
      expect(data.organizationId).toBe("org-1");
      expect(data.labels).toEqual(["REGISTRADO"]);
      expect(data.showReceiverRow).toBe(true);
    });

    // α22
    it("preserves createdAt + updatedAt timestamps", () => {
      const entity = buildEntity();
      const data = toPersistence(entity);
      expect(data.createdAt).toBeInstanceOf(Date);
      expect(data.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("roundtrip", () => {
    // α23
    it("toPersistence(toDomain(row)) yields equivalent payload", () => {
      const original = row();
      const entity = toDomain(original);
      const data = toPersistence(entity);
      expect(data.id).toBe(original.id);
      expect(data.documentType).toBe(original.documentType);
      expect(data.organizationId).toBe(original.organizationId);
      expect(data.labels).toEqual(original.labels);
      expect(data.showReceiverRow).toBe(original.showReceiverRow);
      expect(data.createdAt.getTime()).toBe(original.createdAt.getTime());
    });
  });
});

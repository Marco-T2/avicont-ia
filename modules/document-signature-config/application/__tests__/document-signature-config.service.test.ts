import { describe, it, expect, beforeEach } from "vitest";
import { DocumentSignatureConfigService } from "../document-signature-config.service";
import {
  DocumentSignatureConfig,
  ALL_DOCUMENT_PRINT_TYPES,
  type DocumentPrintType,
  type SignatureLabel,
} from "../../domain/document-signature-config.entity";
import type { DocumentSignatureConfigsRepository } from "../../domain/document-signature-config.repository";

class InMemoryDocumentSignatureConfigsRepository
  implements DocumentSignatureConfigsRepository
{
  private readonly store = new Map<string, DocumentSignatureConfig>();

  reset() {
    this.store.clear();
  }

  async findMany(orgId: string): Promise<DocumentSignatureConfig[]> {
    return [...this.store.values()].filter(
      (d) => d.organizationId === orgId,
    );
  }

  async findOne(
    orgId: string,
    documentType: DocumentPrintType,
  ): Promise<DocumentSignatureConfig | null> {
    return (
      [...this.store.values()].find(
        (d) =>
          d.organizationId === orgId && d.documentType === documentType,
      ) ?? null
    );
  }

  async save(config: DocumentSignatureConfig): Promise<void> {
    // Upsert by composite key (organizationId, documentType)
    const existing = await this.findOne(
      config.organizationId,
      config.documentType,
    );
    if (existing) {
      this.store.delete(existing.id);
    }
    this.store.set(config.id, config);
  }
}

const ORG = "org-1";

describe("DocumentSignatureConfigService", () => {
  let repo: InMemoryDocumentSignatureConfigsRepository;
  let svc: DocumentSignatureConfigService;

  beforeEach(() => {
    repo = new InMemoryDocumentSignatureConfigsRepository();
    svc = new DocumentSignatureConfigService(repo);
  });

  describe("listAll", () => {
    // α9
    it("returns exactly 8 views — one per docType — when no rows exist (defaults)", async () => {
      const views = await svc.listAll(ORG);
      expect(views).toHaveLength(8);
      expect(views.map((v) => v.documentType)).toEqual([
        ...ALL_DOCUMENT_PRINT_TYPES,
      ]);
      for (const v of views) {
        expect(v.labels).toEqual([]);
        expect(v.showReceiverRow).toBe(false);
      }
    });

    // α10
    it("merges existing rows over the default shape (preserves order)", async () => {
      await svc.upsert(ORG, "COMPROBANTE", {
        labels: ["ELABORADO", "APROBADO"],
        showReceiverRow: false,
      });
      await svc.upsert(ORG, "COBRO", {
        labels: ["VISTO_BUENO"],
        showReceiverRow: true,
      });

      const views = await svc.listAll(ORG);
      expect(views).toHaveLength(8);

      const comp = views.find((v) => v.documentType === "COMPROBANTE");
      expect(comp?.labels).toEqual(["ELABORADO", "APROBADO"]);
      expect(comp?.showReceiverRow).toBe(false);

      const cobro = views.find((v) => v.documentType === "COBRO");
      expect(cobro?.labels).toEqual(["VISTO_BUENO"]);
      expect(cobro?.showReceiverRow).toBe(true);

      const venta = views.find((v) => v.documentType === "VENTA");
      expect(venta?.labels).toEqual([]);
      expect(venta?.showReceiverRow).toBe(false);
    });

    // α11
    it("does NOT call repo.save (read-only)", async () => {
      const views = await svc.listAll(ORG);
      expect(views).toHaveLength(8);
      // InMemory store is empty — no side-effects
      const stored = await repo.findMany(ORG);
      expect(stored).toHaveLength(0);
    });
  });

  describe("getOrDefault", () => {
    // α12
    it("returns the default shape when no row exists", async () => {
      const view = await svc.getOrDefault(ORG, "VENTA");
      expect(view).toEqual({
        documentType: "VENTA",
        labels: [],
        showReceiverRow: false,
      });
    });

    // α13
    it("returns the existing row projected to the View shape", async () => {
      await svc.upsert(ORG, "COMPROBANTE", {
        labels: ["ELABORADO", "APROBADO"] as SignatureLabel[],
        showReceiverRow: true,
      });

      const view = await svc.getOrDefault(ORG, "COMPROBANTE");
      expect(view).toEqual({
        documentType: "COMPROBANTE",
        labels: ["ELABORADO", "APROBADO"],
        showReceiverRow: true,
      });
    });
  });

  describe("upsert", () => {
    // α14
    it("creates a new config and returns the snapshot", async () => {
      const snapshot = await svc.upsert(ORG, "COMPROBANTE", {
        labels: ["APROBADO"],
        showReceiverRow: false,
      });
      expect(snapshot.organizationId).toBe(ORG);
      expect(snapshot.documentType).toBe("COMPROBANTE");
      expect(snapshot.labels).toEqual(["APROBADO"]);
      expect(snapshot.showReceiverRow).toBe(false);
      expect(typeof snapshot.id).toBe("string");
    });

    // α15
    it("updates existing config on second upsert (same orgId+docType)", async () => {
      await svc.upsert(ORG, "COMPROBANTE", {
        labels: ["ELABORADO"],
        showReceiverRow: false,
      });
      const updated = await svc.upsert(ORG, "COMPROBANTE", {
        labels: ["APROBADO", "VISTO_BUENO"],
        showReceiverRow: true,
      });
      expect(updated.labels).toEqual(["APROBADO", "VISTO_BUENO"]);
      expect(updated.showReceiverRow).toBe(true);

      // Only one config for COMPROBANTE
      const all = await repo.findMany(ORG);
      const comprobantes = all.filter(
        (c) => c.documentType === "COMPROBANTE",
      );
      expect(comprobantes).toHaveLength(1);
    });

    // α16
    it("accepts empty labels array", async () => {
      const snapshot = await svc.upsert(ORG, "PAGO", {
        labels: [],
        showReceiverRow: false,
      });
      expect(snapshot.labels).toEqual([]);
    });
  });
});

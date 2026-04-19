/**
 * T3.3 — DocumentSignatureConfigRepository tests.
 *
 * Strategy: inject a mocked PrismaClient via BaseRepository DI constructor.
 * No real DB.
 *
 * Covers REQ-OP.4 (composite unique upsert) and REQ-OP.7 (orgId scoping).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { DocumentSignatureConfigRepository } from "../document-signature-config.repository";

function makeDbStub() {
  return {
    documentSignatureConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DocumentSignatureConfigRepository — findMany", () => {
  it("queries Prisma with where: { organizationId } — scopes by orgId", async () => {
    const db = makeDbStub();
    db.documentSignatureConfig.findMany.mockResolvedValue([]);

    const repo = new DocumentSignatureConfigRepository(db as unknown as PrismaClient);
    await repo.findMany("org-1");

    expect(db.documentSignatureConfig.findMany).toHaveBeenCalledTimes(1);
    expect(db.documentSignatureConfig.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
    });
  });

  it("returns the list from Prisma", async () => {
    const db = makeDbStub();
    const rows = [
      {
        id: "c-1",
        organizationId: "org-1",
        documentType: "COMPROBANTE",
        labels: ["ELABORADO", "APROBADO"],
        showReceiverRow: false,
      },
    ];
    db.documentSignatureConfig.findMany.mockResolvedValue(rows);

    const repo = new DocumentSignatureConfigRepository(db as unknown as PrismaClient);
    const result = await repo.findMany("org-1");

    expect(result).toBe(rows);
  });
});

describe("DocumentSignatureConfigRepository — findOne", () => {
  it("queries by composite (organizationId, documentType) unique", async () => {
    const db = makeDbStub();
    db.documentSignatureConfig.findUnique.mockResolvedValue(null);

    const repo = new DocumentSignatureConfigRepository(db as unknown as PrismaClient);
    await repo.findOne("org-1", "COMPROBANTE");

    expect(db.documentSignatureConfig.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_documentType: {
          organizationId: "org-1",
          documentType: "COMPROBANTE",
        },
      },
    });
  });

  it("scopes by different orgs correctly (org-A vs org-B)", async () => {
    const db = makeDbStub();
    db.documentSignatureConfig.findUnique.mockResolvedValue(null);

    const repo = new DocumentSignatureConfigRepository(db as unknown as PrismaClient);
    await repo.findOne("org-B", "VENTA");

    expect(db.documentSignatureConfig.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_documentType: {
          organizationId: "org-B",
          documentType: "VENTA",
        },
      },
    });
  });
});

describe("DocumentSignatureConfigRepository — upsert", () => {
  it("upserts by composite unique with full create + update payload, preserving label order", async () => {
    const db = makeDbStub();
    db.documentSignatureConfig.upsert.mockResolvedValue({
      id: "c-1",
      organizationId: "org-1",
      documentType: "COMPROBANTE",
      labels: ["APROBADO", "ELABORADO"],
      showReceiverRow: true,
    });

    const repo = new DocumentSignatureConfigRepository(db as unknown as PrismaClient);
    const result = await repo.upsert("org-1", "COMPROBANTE", {
      labels: ["APROBADO", "ELABORADO"],
      showReceiverRow: true,
    });

    expect(db.documentSignatureConfig.upsert).toHaveBeenCalledTimes(1);
    const call = db.documentSignatureConfig.upsert.mock.calls[0][0];
    expect(call.where).toEqual({
      organizationId_documentType: {
        organizationId: "org-1",
        documentType: "COMPROBANTE",
      },
    });
    expect(call.create).toEqual({
      organizationId: "org-1",
      documentType: "COMPROBANTE",
      labels: ["APROBADO", "ELABORADO"],
      showReceiverRow: true,
    });
    expect(call.update).toEqual({
      labels: ["APROBADO", "ELABORADO"],
      showReceiverRow: true,
    });
    // Label order in the returned row is what Prisma gave back
    expect(result.labels).toEqual(["APROBADO", "ELABORADO"]);
  });

  it("accepts empty labels array without collapsing it to undefined", async () => {
    const db = makeDbStub();
    db.documentSignatureConfig.upsert.mockResolvedValue({
      id: "c-2",
      organizationId: "org-1",
      documentType: "PAGO",
      labels: [],
      showReceiverRow: false,
    });

    const repo = new DocumentSignatureConfigRepository(db as unknown as PrismaClient);
    await repo.upsert("org-1", "PAGO", { labels: [], showReceiverRow: false });

    const call = db.documentSignatureConfig.upsert.mock.calls[0][0];
    expect(call.create.labels).toEqual([]);
    expect(call.update.labels).toEqual([]);
  });
});

/**
 * T4.3 — DocumentSignatureConfigService tests.
 *
 * Strategy: mock repo via DI.
 *
 * Covers REQ-OP.4 (listAll returns 8 views, missing → default shape, no inserts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DocumentSignatureConfigRepository } from "../document-signature-config.repository";
import { DocumentSignatureConfigService } from "../document-signature-config.service";
import { ALL_DOCUMENT_PRINT_TYPES } from "../document-signature-config.types";

function makeRepoMock(): DocumentSignatureConfigRepository {
  return {
    findMany: vi.fn(),
    findOne: vi.fn(),
    upsert: vi.fn(),
  } as unknown as DocumentSignatureConfigRepository;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DocumentSignatureConfigService.listAll", () => {
  it("returns exactly 8 views — one per docType — when no rows exist", async () => {
    const repo = makeRepoMock();
    vi.mocked(repo.findMany).mockResolvedValue([]);

    const service = new DocumentSignatureConfigService(repo);
    const views = await service.listAll("org-1");

    expect(views).toHaveLength(8);
    expect(views.map((v) => v.documentType)).toEqual([
      ...ALL_DOCUMENT_PRINT_TYPES,
    ]);
    // All views default to empty labels + showReceiverRow false
    for (const v of views) {
      expect(v.labels).toEqual([]);
      expect(v.showReceiverRow).toBe(false);
    }
  });

  it("merges existing rows over the default shape (preserves order)", async () => {
    const repo = makeRepoMock();
    vi.mocked(repo.findMany).mockResolvedValue([
      {
        id: "c-1",
        organizationId: "org-1",
        documentType: "COMPROBANTE",
        labels: ["ELABORADO", "APROBADO"],
        showReceiverRow: false,
      },
      {
        id: "c-2",
        organizationId: "org-1",
        documentType: "COBRO",
        labels: ["VISTO_BUENO"],
        showReceiverRow: true,
      },
    ] as never);

    const service = new DocumentSignatureConfigService(repo);
    const views = await service.listAll("org-1");

    expect(views).toHaveLength(8);
    // COMPROBANTE view has the merged data
    const comp = views.find((v) => v.documentType === "COMPROBANTE");
    expect(comp?.labels).toEqual(["ELABORADO", "APROBADO"]);
    expect(comp?.showReceiverRow).toBe(false);
    // COBRO view has the merged data
    const cobro = views.find((v) => v.documentType === "COBRO");
    expect(cobro?.labels).toEqual(["VISTO_BUENO"]);
    expect(cobro?.showReceiverRow).toBe(true);
    // VENTA has no row → defaults
    const venta = views.find((v) => v.documentType === "VENTA");
    expect(venta?.labels).toEqual([]);
    expect(venta?.showReceiverRow).toBe(false);
  });

  it("does NOT call repo.upsert (read-only)", async () => {
    const repo = makeRepoMock();
    vi.mocked(repo.findMany).mockResolvedValue([]);

    const service = new DocumentSignatureConfigService(repo);
    await service.listAll("org-1");

    expect(repo.upsert).not.toHaveBeenCalled();
  });
});

describe("DocumentSignatureConfigService.getOrDefault", () => {
  it("returns the default shape without calling upsert when no row exists", async () => {
    const repo = makeRepoMock();
    vi.mocked(repo.findOne).mockResolvedValue(null);

    const service = new DocumentSignatureConfigService(repo);
    const view = await service.getOrDefault("org-1", "VENTA");

    expect(view).toEqual({
      documentType: "VENTA",
      labels: [],
      showReceiverRow: false,
    });
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it("returns the existing row projected to the View shape", async () => {
    const repo = makeRepoMock();
    vi.mocked(repo.findOne).mockResolvedValue({
      id: "c-1",
      organizationId: "org-1",
      documentType: "COMPROBANTE",
      labels: ["ELABORADO", "APROBADO"],
      showReceiverRow: true,
    } as never);

    const service = new DocumentSignatureConfigService(repo);
    const view = await service.getOrDefault("org-1", "COMPROBANTE");

    expect(view).toEqual({
      documentType: "COMPROBANTE",
      labels: ["ELABORADO", "APROBADO"],
      showReceiverRow: true,
    });
  });
});

describe("DocumentSignatureConfigService.upsert", () => {
  it("delegates to repo.upsert with (orgId, docType, patch)", async () => {
    const repo = makeRepoMock();
    const row = {
      id: "c-1",
      organizationId: "org-1",
      documentType: "COMPROBANTE",
      labels: ["APROBADO"],
      showReceiverRow: false,
    } as never;
    vi.mocked(repo.upsert).mockResolvedValue(row);

    const service = new DocumentSignatureConfigService(repo);
    const result = await service.upsert("org-1", "COMPROBANTE", {
      labels: ["APROBADO"],
      showReceiverRow: false,
    });

    expect(repo.upsert).toHaveBeenCalledWith("org-1", "COMPROBANTE", {
      labels: ["APROBADO"],
      showReceiverRow: false,
    });
    expect(result).toBe(row);
  });
});

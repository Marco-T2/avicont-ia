import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuditRow, AuditRepository } from "../../domain/audit.repository";

// Service under test — will fail until source is created
import { AuditService } from "../audit.service";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    id: overrides.id ?? "audit_1",
    createdAt: overrides.createdAt ?? new Date("2026-04-24T12:00:00Z"),
    entityType: overrides.entityType ?? "sales",
    entityId: overrides.entityId ?? "sale_1",
    action: overrides.action ?? "CREATE",
    changedById: overrides.changedById ?? "user_1",
    justification: overrides.justification ?? null,
    correlationId: overrides.correlationId ?? null,
    oldValues: overrides.oldValues ?? null,
    newValues: overrides.newValues ?? null,
    parentEntityType: overrides.parentEntityType ?? "sales",
    parentEntityId: overrides.parentEntityId ?? "sale_1",
    parentSourceType: overrides.parentSourceType ?? null,
  };
}

// In-memory repository implementing the domain interface
class InMemoryAuditRepository implements AuditRepository {
  private listFlatResult: { rows: AuditRow[]; nextCursor: { createdAt: string; id: string } | null } = { rows: [], nextCursor: null };
  private historyResult: AuditRow[] = [];

  setListFlatResult(rows: AuditRow[], nextCursor: { createdAt: string; id: string } | null = null) {
    this.listFlatResult = { rows, nextCursor };
  }

  setHistoryResult(rows: AuditRow[]) {
    this.historyResult = rows;
  }

  async listFlat() {
    return this.listFlatResult;
  }

  async getVoucherHistory() {
    return this.historyResult;
  }
}

// UserResolver mock
const mockUserResolver = {
  resolveNames: vi.fn().mockResolvedValue(new Map<string, string>()),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── α9: listGrouped grouping ─────────────────────────────────────────────────

describe("AuditService.listGrouped — grouping por voucher lógico", () => {
  it("α9: agrupa filas por (parentVoucherType, parentVoucherId)", async () => {
    const repo = new InMemoryAuditRepository();
    repo.setListFlatResult([
      makeRow({
        id: "a_1",
        entityType: "sales",
        entityId: "sale_A",
        parentEntityType: "sales",
        parentEntityId: "sale_A",
        createdAt: new Date("2026-04-24T12:00:00Z"),
      }),
      makeRow({
        id: "a_2",
        entityType: "sale_details",
        entityId: "sd_A_1",
        parentEntityType: "sales",
        parentEntityId: "sale_A",
        createdAt: new Date("2026-04-24T12:05:00Z"),
      }),
      makeRow({
        id: "b_1",
        entityType: "purchases",
        entityId: "pur_B",
        parentEntityType: "purchases",
        parentEntityId: "pur_B",
        createdAt: new Date("2026-04-24T11:00:00Z"),
      }),
    ]);
    mockUserResolver.resolveNames.mockResolvedValue(
      new Map([["user_1", "Alice"]]),
    );

    const service = new AuditService(repo, mockUserResolver);
    const { groups } = await service.listGrouped("org_1", {
      dateFrom: new Date("2026-04-01"),
      dateTo: new Date("2026-04-30"),
    });

    expect(groups).toHaveLength(2);
    const saleGroup = groups.find((g) => g.parentVoucherId === "sale_A");
    const purGroup = groups.find((g) => g.parentVoucherId === "pur_B");
    expect(saleGroup).toBeDefined();
    expect(purGroup).toBeDefined();
    expect(saleGroup!.eventCount).toBe(2);
    expect(purGroup!.eventCount).toBe(1);
  });
});

// ── α10: classifier applied ──────────────────────────────────────────────────

describe("AuditService.listGrouped — classifier aplicado a cada row", () => {
  it("α10: rows de journal_entries reflejo (sourceType='sale') → classification 'indirecta'", async () => {
    const repo = new InMemoryAuditRepository();
    repo.setListFlatResult([
      makeRow({
        id: "je1",
        entityType: "journal_entries",
        entityId: "je_A",
        parentEntityType: "journal_entries",
        parentEntityId: "je_A",
        parentSourceType: "sale",
      }),
    ]);

    const service = new AuditService(repo, mockUserResolver);
    const { groups } = await service.listGrouped("org_1", {
      dateFrom: new Date("2026-04-01"),
      dateTo: new Date("2026-04-30"),
    });
    expect(groups[0].events[0].classification).toBe("indirecta");
  });
});

// ── α11: changedBy resolution ────────────────────────────────────────────────

describe("AuditService.listGrouped — resolución de changedBy", () => {
  it("α11: resuelve changedBy.name desde el user resolver", async () => {
    const repo = new InMemoryAuditRepository();
    repo.setListFlatResult([
      makeRow({ id: "r1", changedById: "user_active" }),
    ]);
    mockUserResolver.resolveNames.mockResolvedValue(
      new Map([["user_active", "Alice Wonderland"]]),
    );

    const service = new AuditService(repo, mockUserResolver);
    const { groups } = await service.listGrouped("org_1", {
      dateFrom: new Date("2026-04-01"),
      dateTo: new Date("2026-04-30"),
    });
    expect(groups[0].events[0].changedBy).toEqual({
      id: "user_active",
      name: "Alice Wonderland",
    });
  });

  it("α12: usuario eliminado → changedBy.name = 'Usuario eliminado'", async () => {
    const repo = new InMemoryAuditRepository();
    repo.setListFlatResult([
      makeRow({ id: "r1", changedById: "user_deleted" }),
    ]);
    mockUserResolver.resolveNames.mockResolvedValue(new Map());

    const service = new AuditService(repo, mockUserResolver);
    const { groups } = await service.listGrouped("org_1", {
      dateFrom: new Date("2026-04-01"),
      dateTo: new Date("2026-04-30"),
    });
    expect(groups[0].events[0].changedBy).toEqual({
      id: "user_deleted",
      name: "Usuario eliminado",
    });
  });
});

// ── α13: nextCursor propagation ──────────────────────────────────────────────

describe("AuditService.listGrouped — nextCursor propagation", () => {
  it("α13: propaga nextCursor desde el repo al resultado", async () => {
    const cursor = { createdAt: "2026-04-20T10:00:00.000Z", id: "audit_99" };
    const repo = new InMemoryAuditRepository();
    repo.setListFlatResult([makeRow({ id: "r1" })], cursor);

    const service = new AuditService(repo, mockUserResolver);
    const result = await service.listGrouped("org_1", {
      dateFrom: new Date("2026-04-01"),
      dateTo: new Date("2026-04-30"),
    });
    expect(result.nextCursor).toEqual(cursor);
  });
});

// ── α14: getVoucherHistory ───────────────────────────────────────────────────

describe("AuditService.getVoucherHistory — timeline ordenado ASC", () => {
  it("α14: retorna events ordenados createdAt ASC con tiebreak id ASC", async () => {
    const shared = new Date("2026-04-24T12:00:00Z");
    const repo = new InMemoryAuditRepository();
    repo.setHistoryResult([
      makeRow({
        id: "z_late",
        entityType: "sales",
        entityId: "sale_TL",
        createdAt: shared,
      }),
      makeRow({
        id: "a_early",
        entityType: "sales",
        entityId: "sale_TL",
        createdAt: shared,
      }),
      makeRow({
        id: "m_earliest",
        entityType: "sales",
        entityId: "sale_TL",
        createdAt: new Date("2026-04-24T11:00:00Z"),
      }),
    ]);

    const service = new AuditService(repo, mockUserResolver);
    const events = await service.getVoucherHistory("org_1", "sales", "sale_TL");

    expect(events).toHaveLength(3);
    expect(events[0].id).toBe("m_earliest");
    expect(events[1].id).toBe("a_early");
    expect(events[2].id).toBe("z_late");
  });

  it("α15: retorna [] para comprobante sin filas de audit", async () => {
    const repo = new InMemoryAuditRepository();
    repo.setHistoryResult([]);

    const service = new AuditService(repo, mockUserResolver);
    const events = await service.getVoucherHistory(
      "org_1",
      "sales",
      "sale_empty",
    );
    expect(events).toHaveLength(0);
  });
});

/**
 * T11a / T11b RED — AuditService unit tests.
 *
 * Expected failure: `Cannot find module '../audit.service'`. El archivo de
 * producción se crea en T12. Tras T12 pasa GREEN.
 *
 * Mocks:
 *   - AuditRepository: inyectado via constructor (design §2.6).
 *   - prisma.user.findMany: via vi.mock("@/lib/prisma"). El service hace lookup
 *     batch de usernames a partir de los changedById de las rows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { AuditService } from "../audit.service";
import type { AuditRow } from "../audit.repository";

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

function mockRepoWithRows(
  rows: AuditRow[],
  nextCursor: { createdAt: string; id: string } | null = null,
) {
  return {
    listFlat: vi.fn().mockResolvedValue({ rows, nextCursor }),
    getVoucherHistory: vi.fn(),
  };
}

function mockRepoWithHistory(rows: AuditRow[]) {
  return {
    listFlat: vi.fn(),
    getVoucherHistory: vi.fn().mockResolvedValue(rows),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── T11a: listGrouped ────────────────────────────────────────────────────────

describe("AuditService.listGrouped — grouping por voucher lógico", () => {
  it("agrupa filas por (parentVoucherType, parentVoucherId)", async () => {
    const repo = mockRepoWithRows([
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
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "user_1", name: "Alice", email: "a@test" },
      // biome-ignore lint: test stub
    ] as never);

    const service = new AuditService(repo as never);
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

describe("AuditService.listGrouped — classifier aplicado a cada row", () => {
  it("rows de sales/purchases → classification 'directa'", async () => {
    const repo = mockRepoWithRows([
      makeRow({
        id: "s1",
        entityType: "sales",
        parentEntityType: "sales",
        parentEntityId: "sale_A",
      }),
      makeRow({
        id: "p1",
        entityType: "purchases",
        parentEntityType: "purchases",
        parentEntityId: "pur_A",
      }),
    ]);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const service = new AuditService(repo as never);
    const { groups } = await service.listGrouped("org_1", {
      dateFrom: new Date("2026-04-01"),
      dateTo: new Date("2026-04-30"),
    });
    for (const g of groups) {
      for (const ev of g.events) {
        expect(ev.classification).toBe("directa");
      }
    }
  });

  it("rows de journal_entries reflejo (sourceType='sale') → classification 'indirecta'", async () => {
    const repo = mockRepoWithRows([
      makeRow({
        id: "je1",
        entityType: "journal_entries",
        entityId: "je_A",
        parentEntityType: "journal_entries",
        parentEntityId: "je_A",
        parentSourceType: "sale",
      }),
    ]);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const service = new AuditService(repo as never);
    const { groups } = await service.listGrouped("org_1", {
      dateFrom: new Date("2026-04-01"),
      dateTo: new Date("2026-04-30"),
    });
    expect(groups[0].events[0].classification).toBe("indirecta");
  });

  it("rows de journal_entries manual (sourceType=null) → classification 'directa'", async () => {
    const repo = mockRepoWithRows([
      makeRow({
        id: "je_manual",
        entityType: "journal_entries",
        entityId: "je_M",
        parentEntityType: "journal_entries",
        parentEntityId: "je_M",
        parentSourceType: null,
      }),
    ]);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const service = new AuditService(repo as never);
    const { groups } = await service.listGrouped("org_1", {
      dateFrom: new Date("2026-04-01"),
      dateTo: new Date("2026-04-30"),
    });
    expect(groups[0].events[0].classification).toBe("directa");
  });
});

describe("AuditService.listGrouped — resolución de changedBy", () => {
  it("resuelve changedBy.name desde el lookup de usuarios", async () => {
    const repo = mockRepoWithRows([
      makeRow({ id: "r1", changedById: "user_active" }),
    ]);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "user_active", name: "Alice Wonderland", email: "alice@test" },
    ] as never);

    const service = new AuditService(repo as never);
    const { groups } = await service.listGrouped("org_1", {
      dateFrom: new Date("2026-04-01"),
      dateTo: new Date("2026-04-30"),
    });
    expect(groups[0].events[0].changedBy).toEqual({
      id: "user_active",
      name: "Alice Wonderland",
    });
  });

  it("cuando el usuario no existe en findMany → changedBy.name = 'Usuario eliminado'", async () => {
    const repo = mockRepoWithRows([
      makeRow({ id: "r1", changedById: "user_deleted" }),
    ]);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const service = new AuditService(repo as never);
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

describe("AuditService.listGrouped — nextCursor propagation", () => {
  it("propaga nextCursor desde el repo al resultado", async () => {
    const cursor = { createdAt: "2026-04-20T10:00:00.000Z", id: "audit_99" };
    const repo = mockRepoWithRows([makeRow({ id: "r1" })], cursor);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const service = new AuditService(repo as never);
    const result = await service.listGrouped("org_1", {
      dateFrom: new Date("2026-04-01"),
      dateTo: new Date("2026-04-30"),
    });
    expect(result.nextCursor).toEqual(cursor);
  });
});

describe("AuditService.listGrouped — orden por lastActivityAt DESC", () => {
  it("los groups salen ordenados del más reciente al más antiguo", async () => {
    // Repo devuelve rows en orden DESC; grouping las agrupa pero el orden
    // entre groups debe preservarse por lastActivityAt.
    const repo = mockRepoWithRows([
      makeRow({
        id: "new_1",
        entityType: "sales",
        entityId: "sale_NEW",
        parentEntityType: "sales",
        parentEntityId: "sale_NEW",
        createdAt: new Date("2026-04-24T15:00:00Z"),
      }),
      makeRow({
        id: "old_1",
        entityType: "sales",
        entityId: "sale_OLD",
        parentEntityType: "sales",
        parentEntityId: "sale_OLD",
        createdAt: new Date("2026-04-20T10:00:00Z"),
      }),
    ]);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const service = new AuditService(repo as never);
    const { groups } = await service.listGrouped("org_1", {
      dateFrom: new Date("2026-04-01"),
      dateTo: new Date("2026-04-30"),
    });
    expect(groups).toHaveLength(2);
    expect(groups[0].parentVoucherId).toBe("sale_NEW");
    expect(groups[1].parentVoucherId).toBe("sale_OLD");
    expect(groups[0].lastActivityAt.getTime()).toBeGreaterThan(
      groups[1].lastActivityAt.getTime(),
    );
  });
});

// ── T11b: getVoucherHistory ──────────────────────────────────────────────────

describe("AuditService.getVoucherHistory — timeline ordenado ASC", () => {
  it("retorna events ordenados createdAt ASC con tiebreak id ASC", async () => {
    const shared = new Date("2026-04-24T12:00:00Z");
    const repo = mockRepoWithHistory([
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
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const service = new AuditService(repo as never);
    const events = await service.getVoucherHistory("org_1", "sales", "sale_TL");

    expect(events).toHaveLength(3);
    // First event: earliest createdAt
    expect(events[0].id).toBe("m_earliest");
    // Tied pair: id ASC → a_early before z_late
    expect(events[1].id).toBe("a_early");
    expect(events[2].id).toBe("z_late");
  });

  it("aplica classifier a cada event", async () => {
    const repo = mockRepoWithHistory([
      makeRow({
        id: "je_ref",
        entityType: "journal_entries",
        entityId: "je_X",
        parentEntityType: "journal_entries",
        parentEntityId: "je_X",
        parentSourceType: "purchase",
      }),
    ]);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const service = new AuditService(repo as never);
    const events = await service.getVoucherHistory(
      "org_1",
      "journal_entries",
      "je_X",
    );
    expect(events[0].classification).toBe("indirecta");
  });

  it("retorna [] para comprobante sin filas de audit", async () => {
    const repo = mockRepoWithHistory([]);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const service = new AuditService(repo as never);
    const events = await service.getVoucherHistory(
      "org_1",
      "sales",
      "sale_empty",
    );
    expect(events).toHaveLength(0);
  });
});

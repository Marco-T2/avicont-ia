/**
 * T09a / T09b RED — AuditRepository integration tests.
 *
 * Expected failure (RED): `Cannot find module '../audit.repository'`. El
 * archivo de producción se crea en T10. Tras T10 pasa GREEN.
 *
 * Scope de tenant isolation cubierto acá (todos a nivel repository):
 *   - Case 1 (happy path): todos los rows devueltos tienen organizationId === scopedOrgId.
 *   - Case 2 (aislamiento): fixture 2 orgs, listFlat(orgA) no contiene rows de orgB.
 *   - Case 4 (Prisma.sql binding): orgId entra como bound param, no interpolado en sql.strings.
 *   - Case 5 (guard): scopedQueryRaw rechaza organizationId vacío.
 *
 * Out of scope acá (covered at other layers):
 *   - Case 3 (orgId manipulado por el cliente): el repository recibe orgId como
 *     parámetro y lo trata como scope autoritativo. La validación del origen
 *     (session vs body/query) vive en la API route via requirePermission. El
 *     repo solo responde "lo que pasás, lo que devuelvo" — ese contrato es
 *     lo que protegemos en el caso 2.
 *
 * Fixtures: seed directo de audit_logs con prisma.auditLog.createMany (no
 * depende de triggers). Cleanup en afterAll.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  afterEach,
} from "vitest";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AuditRepository, type AuditRow } from "../audit.repository";

// ── Fixtures compartidos ──────────────────────────────────────────────────────

let orgAId: string;
let orgBId: string;
let userAId: string;
let userBId: string;

/**
 * IDs de audit rows inyectadas en orgA. Usamos una nomenclatura prefijada que
 * nos permite cleanup granular sin borrar filas ajenas al test.
 */
const AUDIT_PREFIX = "audit-repo-test";

function nowPlus(ms: number): Date {
  return new Date(Date.now() + ms);
}

beforeAll(async () => {
  const stamp = Date.now();

  const [userA, userB] = await Promise.all([
    prisma.user.create({
      data: {
        clerkUserId: `test-audit-repo-a-${stamp}`,
        email: `audit-repo-a-${stamp}@test.com`,
        name: "Audit Repo User A",
      },
    }),
    prisma.user.create({
      data: {
        clerkUserId: `test-audit-repo-b-${stamp}`,
        email: `audit-repo-b-${stamp}@test.com`,
        name: "Audit Repo User B",
      },
    }),
  ]);
  userAId = userA.id;
  userBId = userB.id;

  const [orgA, orgB] = await Promise.all([
    prisma.organization.create({
      data: {
        clerkOrgId: `test-audit-repo-a-${stamp}`,
        name: "Audit Repo Org A",
        slug: `audit-repo-a-${stamp}`,
      },
    }),
    prisma.organization.create({
      data: {
        clerkOrgId: `test-audit-repo-b-${stamp}`,
        name: "Audit Repo Org B",
        slug: `audit-repo-b-${stamp}`,
      },
    }),
  ]);
  orgAId = orgA.id;
  orgBId = orgB.id;
});

afterAll(async () => {
  // Cleanup en orden: audit_logs primero (por FK organizationId), luego org y user.
  await prisma.auditLog.deleteMany({
    where: { organizationId: { in: [orgAId, orgBId] } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: [orgAId, orgBId] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [userAId, userBId] } },
  });
});

afterEach(async () => {
  // Limpiamos audit_logs entre tests para que cada caso tenga su fixture propio.
  await prisma.auditLog.deleteMany({
    where: { organizationId: { in: [orgAId, orgBId] } },
  });
});

// ── Helper para seedear audit_logs ────────────────────────────────────────────

type SeedRow = {
  id?: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  action: string;
  changedById?: string | null;
  createdAt?: Date;
  oldValues?: Prisma.InputJsonValue | null;
  newValues?: Prisma.InputJsonValue | null;
  correlationId?: string | null;
  justification?: string | null;
};

async function seedAuditRows(rows: SeedRow[]): Promise<void> {
  // createMany no soporta Json? nullable correctly en algunas versiones — usamos loop.
  for (const r of rows) {
    await prisma.auditLog.create({
      data: {
        id: r.id,
        organizationId: r.organizationId,
        entityType: r.entityType,
        entityId: r.entityId,
        action: r.action,
        changedById: r.changedById ?? null,
        createdAt: r.createdAt,
        oldValues: r.oldValues ?? Prisma.JsonNull,
        newValues: r.newValues ?? Prisma.JsonNull,
        correlationId: r.correlationId ?? null,
        justification: r.justification ?? null,
      },
    });
  }
}

// ── TESTS ─────────────────────────────────────────────────────────────────────

describe("AuditRepository — scopedQueryRaw guard (REQ-AUDIT.4 Case 5)", () => {
  it("lanza cuando organizationId es vacío", async () => {
    const repo = new AuditRepository();
    await expect(
      repo.listFlat("", {
        dateFrom: new Date("2026-04-01"),
        dateTo: new Date("2026-04-30"),
      }),
    ).rejects.toThrow(/organizationId is required/i);
  });
});

describe("AuditRepository.listFlat — happy path scoped (REQ-AUDIT.1, REQ-AUDIT.4 Case 1)", () => {
  it("devuelve únicamente rows con organizationId === scopedOrgId", async () => {
    await seedAuditRows([
      {
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_a_1",
        action: "CREATE",
        changedById: userAId,
        createdAt: nowPlus(-1000),
        newValues: { totalAmount: 100 },
      },
      {
        organizationId: orgAId,
        entityType: "purchases",
        entityId: "pur_a_1",
        action: "UPDATE",
        changedById: userAId,
        createdAt: nowPlus(-2000),
        newValues: { totalAmount: 50 },
      },
    ]);

    const repo = new AuditRepository();
    const { rows } = await repo.listFlat(orgAId, {
      dateFrom: nowPlus(-1000_000),
      dateTo: nowPlus(1000_000),
    });

    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row).toMatchObject({
        entityId: expect.stringMatching(/^(sale|pur)_a_/),
      });
    }
  });
});

describe("AuditRepository.listFlat — aislamiento cross-org (REQ-AUDIT.4 Case 2)", () => {
  it("listFlat(orgA) no contiene ninguna fila de orgB", async () => {
    await seedAuditRows([
      {
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_a_x",
        action: "CREATE",
        changedById: userAId,
        createdAt: nowPlus(-1000),
      },
      {
        organizationId: orgBId,
        entityType: "sales",
        entityId: "sale_b_x",
        action: "CREATE",
        changedById: userBId,
        createdAt: nowPlus(-1000),
      },
      {
        organizationId: orgBId,
        entityType: "purchases",
        entityId: "pur_b_x",
        action: "UPDATE",
        changedById: userBId,
        createdAt: nowPlus(-500),
      },
    ]);

    const repo = new AuditRepository();
    const { rows } = await repo.listFlat(orgAId, {
      dateFrom: nowPlus(-1000_000),
      dateTo: nowPlus(1000_000),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].entityId).toBe("sale_a_x");
    // Paranoid assertion — ningún row debe tener entityId de orgB.
    for (const row of rows) {
      expect(row.entityId).not.toMatch(/_b_/);
    }
  });

  it("listFlat(orgB) no contiene ninguna fila de orgA", async () => {
    await seedAuditRows([
      {
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_a_y",
        action: "CREATE",
        changedById: userAId,
        createdAt: nowPlus(-1000),
      },
      {
        organizationId: orgBId,
        entityType: "sales",
        entityId: "sale_b_y",
        action: "CREATE",
        changedById: userBId,
        createdAt: nowPlus(-1000),
      },
    ]);

    const repo = new AuditRepository();
    const { rows } = await repo.listFlat(orgBId, {
      dateFrom: nowPlus(-1000_000),
      dateTo: nowPlus(1000_000),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].entityId).toBe("sale_b_y");
  });
});

describe("AuditRepository — organizationId bindea como parámetro (REQ-AUDIT.5 Case 4)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("organizationId entra en sql.values, no interpolado en sql.strings", async () => {
    const capturedSqls: Prisma.Sql[] = [];
    // Cast a `any` — el tipo real es PrismaPromise (con brand field), pero para
    // este test solo necesitamos capturar el sql y devolver array vacío.
    const spy = vi.spyOn(prisma, "$queryRaw").mockImplementation(((
      sql: unknown,
    ) => {
      capturedSqls.push(sql as Prisma.Sql);
      return Promise.resolve([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    const SENTINEL_ORG = "org_sentinel_leak_check_xyz123";
    const repo = new AuditRepository();
    await repo.listFlat(SENTINEL_ORG, {
      dateFrom: new Date("2026-04-01"),
      dateTo: new Date("2026-04-30"),
    });

    expect(spy).toHaveBeenCalled();
    expect(capturedSqls.length).toBeGreaterThan(0);
    const sql = capturedSqls[0];

    // 1. orgId DEBE estar en values como parámetro bindeado.
    expect(sql.values).toEqual(expect.arrayContaining([SENTINEL_ORG]));

    // 2. orgId NO DEBE aparecer literal en los strings del template — si aparece,
    //    alguien concatenó en vez de usar ${...} dentro del Prisma.sql`...`.
    const rawStrings = Array.isArray((sql as unknown as { strings?: string[] }).strings)
      ? (sql as unknown as { strings: string[] }).strings.join("")
      : (sql as unknown as { sql?: string }).sql ?? "";
    expect(rawStrings).not.toContain(SENTINEL_ORG);
  });
});

describe("AuditRepository.listFlat — paginación cursor-based (A1-S2, A1-S3)", () => {
  it("devuelve nextCursor = null cuando hay ≤ limit filas", async () => {
    await seedAuditRows(
      Array.from({ length: 3 }, (_, i) => ({
        organizationId: orgAId,
        entityType: "sales",
        entityId: `sale_small_${i}`,
        action: "CREATE",
        changedById: userAId,
        createdAt: nowPlus(-i * 1000),
      })),
    );

    const repo = new AuditRepository();
    const { rows, nextCursor } = await repo.listFlat(orgAId, {
      dateFrom: nowPlus(-1000_000),
      dateTo: nowPlus(1000_000),
      limit: 50,
    });

    expect(rows).toHaveLength(3);
    expect(nextCursor).toBeNull();
  });

  it("devuelve nextCursor poblado y limit rows cuando hay > limit filas", async () => {
    await seedAuditRows(
      Array.from({ length: 5 }, (_, i) => ({
        organizationId: orgAId,
        entityType: "sales",
        entityId: `sale_page_${i}`,
        action: "CREATE",
        changedById: userAId,
        createdAt: nowPlus(-i * 1000),
      })),
    );

    const repo = new AuditRepository();
    const { rows, nextCursor } = await repo.listFlat(orgAId, {
      dateFrom: nowPlus(-1000_000),
      dateTo: nowPlus(1000_000),
      limit: 3,
    });

    expect(rows).toHaveLength(3);
    expect(nextCursor).not.toBeNull();
    expect(nextCursor).toMatchObject({
      createdAt: expect.any(String),
      id: expect.any(String),
    });
  });

  it("segunda página (usando nextCursor) trae las filas restantes sin duplicados", async () => {
    await seedAuditRows(
      Array.from({ length: 5 }, (_, i) => ({
        organizationId: orgAId,
        entityType: "sales",
        entityId: `sale_p2_${i}`,
        action: "CREATE",
        changedById: userAId,
        createdAt: nowPlus(-i * 1000),
      })),
    );

    const repo = new AuditRepository();
    const page1 = await repo.listFlat(orgAId, {
      dateFrom: nowPlus(-1000_000),
      dateTo: nowPlus(1000_000),
      limit: 3,
    });

    expect(page1.rows).toHaveLength(3);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await repo.listFlat(orgAId, {
      dateFrom: nowPlus(-1000_000),
      dateTo: nowPlus(1000_000),
      limit: 3,
      cursor: page1.nextCursor!,
    });

    expect(page2.rows).toHaveLength(2);
    expect(page2.nextCursor).toBeNull();

    const page1Ids = new Set(page1.rows.map((r) => r.id));
    const duplicates = page2.rows.filter((r) => page1Ids.has(r.id));
    expect(duplicates).toHaveLength(0);
  });
});

describe("AuditRepository.listFlat — filtros opcionales (A1-S4)", () => {
  it("filtro entityType reduce el resultado", async () => {
    await seedAuditRows([
      {
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_f1",
        action: "CREATE",
        changedById: userAId,
        createdAt: nowPlus(-1000),
      },
      {
        organizationId: orgAId,
        entityType: "purchases",
        entityId: "pur_f1",
        action: "CREATE",
        changedById: userAId,
        createdAt: nowPlus(-2000),
      },
    ]);

    const repo = new AuditRepository();
    const { rows } = await repo.listFlat(orgAId, {
      dateFrom: nowPlus(-1000_000),
      dateTo: nowPlus(1000_000),
      entityType: "sales",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].entityType).toBe("sales");
  });

  it("filtro changedById reduce el resultado", async () => {
    await seedAuditRows([
      {
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_cb1",
        action: "CREATE",
        changedById: userAId,
        createdAt: nowPlus(-1000),
      },
      {
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_cb2",
        action: "CREATE",
        changedById: userBId,
        createdAt: nowPlus(-2000),
      },
    ]);

    const repo = new AuditRepository();
    const { rows } = await repo.listFlat(orgAId, {
      dateFrom: nowPlus(-1000_000),
      dateTo: nowPlus(1000_000),
      changedById: userAId,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].entityId).toBe("sale_cb1");
  });

  it("filtro action reduce el resultado", async () => {
    await seedAuditRows([
      {
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_ac1",
        action: "CREATE",
        changedById: userAId,
        createdAt: nowPlus(-1000),
      },
      {
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_ac2",
        action: "UPDATE",
        changedById: userAId,
        createdAt: nowPlus(-2000),
      },
    ]);

    const repo = new AuditRepository();
    const { rows } = await repo.listFlat(orgAId, {
      dateFrom: nowPlus(-1000_000),
      dateTo: nowPlus(1000_000),
      action: "UPDATE",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("UPDATE");
  });
});

describe("AuditRepository.getVoucherHistory — timeline completo (REQ-AUDIT.2)", () => {
  it("retorna todas las filas de la cabecera y detail rows por JSONB FK, ordenadas createdAt ASC con tiebreak id ASC", async () => {
    const t0 = nowPlus(-30_000);
    const t1 = nowPlus(-20_000);
    const t2 = nowPlus(-10_000);
    await seedAuditRows([
      {
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_timeline",
        action: "CREATE",
        changedById: userAId,
        createdAt: t0,
        newValues: { totalAmount: 100 },
      },
      {
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_timeline",
        action: "UPDATE",
        changedById: userAId,
        createdAt: t1,
        oldValues: { totalAmount: 100 },
        newValues: { totalAmount: 150 },
      },
      {
        organizationId: orgAId,
        entityType: "sale_details",
        entityId: "sd_1",
        action: "CREATE",
        changedById: userAId,
        createdAt: t2,
        newValues: { saleId: "sale_timeline", quantity: 2 },
      },
      // Row irrelevante — pertenece a otro sale de la misma org
      {
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_other",
        action: "CREATE",
        changedById: userAId,
        createdAt: t2,
        newValues: { totalAmount: 999 },
      },
    ]);

    const repo = new AuditRepository();
    const timeline = await repo.getVoucherHistory(orgAId, "sales", "sale_timeline");

    expect(timeline).toHaveLength(3);
    // Orden ASC por createdAt
    expect(timeline[0].createdAt.getTime()).toBeLessThanOrEqual(
      timeline[1].createdAt.getTime(),
    );
    expect(timeline[1].createdAt.getTime()).toBeLessThanOrEqual(
      timeline[2].createdAt.getTime(),
    );
    // Incluye cabecera + detail
    const entityTypes = timeline.map((r) => r.entityType);
    expect(entityTypes).toContain("sales");
    expect(entityTypes).toContain("sale_details");
    // NO incluye otro sale
    expect(timeline.find((r) => r.entityId === "sale_other")).toBeUndefined();
  });

  it("retorna [] cuando el comprobante no existe / no tiene audit rows", async () => {
    // No seed rows for this entityId
    const repo = new AuditRepository();
    const timeline = await repo.getVoucherHistory(
      orgAId,
      "sales",
      "sale_does_not_exist",
    );
    expect(timeline).toHaveLength(0);
  });

  it("cross-org: getVoucherHistory(orgA, ...) no devuelve rows cuyo entityId existe sólo en orgB", async () => {
    await seedAuditRows([
      {
        organizationId: orgBId,
        entityType: "sales",
        entityId: "sale_only_in_b",
        action: "CREATE",
        changedById: userBId,
        createdAt: nowPlus(-1000),
      },
      {
        organizationId: orgBId,
        entityType: "sale_details",
        entityId: "sd_only_in_b",
        action: "CREATE",
        changedById: userBId,
        createdAt: nowPlus(-500),
        newValues: { saleId: "sale_only_in_b", quantity: 1 },
      },
    ]);

    const repo = new AuditRepository();
    const timeline = await repo.getVoucherHistory(
      orgAId,
      "sales",
      "sale_only_in_b",
    );
    expect(timeline).toHaveLength(0);
  });

  it("desempata por id ASC cuando dos rows comparten createdAt", async () => {
    const sharedTs = nowPlus(-5000);
    await seedAuditRows([
      {
        id: "b_tie_row",
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_tied",
        action: "UPDATE",
        changedById: userAId,
        createdAt: sharedTs,
        newValues: { totalAmount: 1 },
      },
      {
        id: "a_tie_row",
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_tied",
        action: "UPDATE",
        changedById: userAId,
        createdAt: sharedTs,
        newValues: { totalAmount: 2 },
      },
    ]);

    const repo = new AuditRepository();
    const timeline = await repo.getVoucherHistory(orgAId, "sales", "sale_tied");

    expect(timeline).toHaveLength(2);
    // ASC: "a_tie_row" antes que "b_tie_row"
    expect(timeline[0].id).toBe("a_tie_row");
    expect(timeline[1].id).toBe("b_tie_row");
  });
});

describe("AuditRepository.listFlat — cursor estable con empate de createdAt (A1-S3)", () => {
  it("dos filas con mismo createdAt se desempatan por id DESC y no se duplican entre páginas", async () => {
    const sharedTs = nowPlus(-5000);
    await seedAuditRows([
      {
        id: "z_row_higher",
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_tie_1",
        action: "CREATE",
        changedById: userAId,
        createdAt: sharedTs,
      },
      {
        id: "a_row_lower",
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_tie_2",
        action: "CREATE",
        changedById: userAId,
        createdAt: sharedTs,
      },
      {
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_tie_3",
        action: "CREATE",
        changedById: userAId,
        createdAt: nowPlus(-10_000),
      },
    ]);

    const repo = new AuditRepository();
    const page1 = await repo.listFlat(orgAId, {
      dateFrom: nowPlus(-1000_000),
      dateTo: nowPlus(1000_000),
      limit: 1,
    });
    expect(page1.rows).toHaveLength(1);
    expect(page1.rows[0].id).toBe("z_row_higher");

    const page2 = await repo.listFlat(orgAId, {
      dateFrom: nowPlus(-1000_000),
      dateTo: nowPlus(1000_000),
      limit: 1,
      cursor: page1.nextCursor!,
    });
    expect(page2.rows).toHaveLength(1);
    expect(page2.rows[0].id).toBe("a_row_lower");

    const page3 = await repo.listFlat(orgAId, {
      dateFrom: nowPlus(-1000_000),
      dateTo: nowPlus(1000_000),
      limit: 5,
      cursor: page2.nextCursor!,
    });
    expect(page3.rows.map((r: AuditRow) => r.id)).not.toContain("z_row_higher");
    expect(page3.rows.map((r: AuditRow) => r.id)).not.toContain("a_row_lower");
  });
});

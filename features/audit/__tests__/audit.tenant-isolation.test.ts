/**
 * T13 — AuditService cross-org tenant isolation (integration, DB real).
 *
 * Defense in depth sobre el blindaje repo-layer (T09a/T09b): acá verificamos
 * que el service también resiste cross-org leaks. Redundancia deliberada — el
 * invariante de scope vive en el repo, pero testearlo en el service detecta
 * cualquier path donde el service ignore el orgId (p.ej. si un helper futuro
 * consulta prisma directo sin pasar por el repo).
 *
 * Cubre REQ-AUDIT.4 scenarios A4-S2 y A4-S3.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AuditService } from "../audit.service";

let orgAId: string;
let orgBId: string;
let userAId: string;
let userBId: string;

beforeAll(async () => {
  const stamp = Date.now();
  const [userA, userB] = await Promise.all([
    prisma.user.create({
      data: {
        clerkUserId: `test-audit-svc-a-${stamp}`,
        email: `audit-svc-a-${stamp}@test.com`,
        name: "Audit Svc User A",
      },
    }),
    prisma.user.create({
      data: {
        clerkUserId: `test-audit-svc-b-${stamp}`,
        email: `audit-svc-b-${stamp}@test.com`,
        name: "Audit Svc User B",
      },
    }),
  ]);
  userAId = userA.id;
  userBId = userB.id;

  const [orgA, orgB] = await Promise.all([
    prisma.organization.create({
      data: {
        clerkOrgId: `test-audit-svc-a-${stamp}`,
        name: "Audit Svc Org A",
        slug: `audit-svc-a-${stamp}`,
      },
    }),
    prisma.organization.create({
      data: {
        clerkOrgId: `test-audit-svc-b-${stamp}`,
        name: "Audit Svc Org B",
        slug: `audit-svc-b-${stamp}`,
      },
    }),
  ]);
  orgAId = orgA.id;
  orgBId = orgB.id;
});

afterAll(async () => {
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
  await prisma.auditLog.deleteMany({
    where: { organizationId: { in: [orgAId, orgBId] } },
  });
});

async function seedTwoOrgFixture(): Promise<{ saleAId: string; saleBId: string }> {
  const saleAId = `sale_svc_A_${Date.now()}`;
  const saleBId = `sale_svc_B_${Date.now() + 1}`;

  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: orgAId,
        entityType: "sales",
        entityId: saleAId,
        action: "CREATE",
        changedById: userAId,
        oldValues: Prisma.JsonNull,
        newValues: { totalAmount: 500 },
      },
      {
        organizationId: orgAId,
        entityType: "sale_details",
        entityId: `sd_A_1_${Date.now()}`,
        action: "CREATE",
        changedById: userAId,
        oldValues: Prisma.JsonNull,
        newValues: { saleId: saleAId, quantity: 1 },
      },
      {
        organizationId: orgBId,
        entityType: "sales",
        entityId: saleBId,
        action: "CREATE",
        changedById: userBId,
        oldValues: Prisma.JsonNull,
        newValues: { totalAmount: 999 },
      },
    ],
  });
  return { saleAId, saleBId };
}

describe("AuditService — cross-org isolation en listGrouped (A4-S2)", () => {
  it("listGrouped(orgA) solo devuelve events con changedBy.id === userA", async () => {
    await seedTwoOrgFixture();
    const service = new AuditService();
    const { groups } = await service.listGrouped(orgAId, {
      dateFrom: new Date(Date.now() - 86400_000),
      dateTo: new Date(Date.now() + 86400_000),
    });
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      for (const ev of g.events) {
        expect(ev.changedBy?.id).toBe(userAId);
      }
    }
  });

  it("listGrouped(orgB) no contiene ningún event con changedBy.id === userA", async () => {
    await seedTwoOrgFixture();
    const service = new AuditService();
    const { groups } = await service.listGrouped(orgBId, {
      dateFrom: new Date(Date.now() - 86400_000),
      dateTo: new Date(Date.now() + 86400_000),
    });
    for (const g of groups) {
      for (const ev of g.events) {
        expect(ev.changedBy?.id).not.toBe(userAId);
      }
    }
  });
});

describe("AuditService — cross-org isolation en getVoucherHistory (A4-S3)", () => {
  it("getVoucherHistory(orgB, saleIdDeOrgA) retorna []", async () => {
    const { saleAId } = await seedTwoOrgFixture();
    const service = new AuditService();
    const events = await service.getVoucherHistory(orgBId, "sales", saleAId);
    expect(events).toHaveLength(0);
  });
});

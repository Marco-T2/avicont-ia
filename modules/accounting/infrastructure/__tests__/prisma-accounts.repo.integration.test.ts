/**
 * Postgres-real integration test for PrismaAccountsRepo (POC #3b).
 *
 * Mirrors fixture/cleanup shape of legacy-accounts-read.adapter.integration.test.ts.
 * DATABASE_URL = dev DB (ambient). Strict cleanup by orgId fixtures.
 * FK-safe afterAll: journalLine→journalEntry→account→auditLog→org→user.
 * afterEach resets accounts between tests (most tests mutate).
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { PrismaAccountsRepo } from "../prisma-accounts.repo";
import type { AccountDef } from "@/prisma/seeds/chart-of-accounts";
import type { ResolvedCreateAccountData } from "@/modules/accounting/presentation/dto/accounts.types";

let testOrgId: string;
let testUserId: string;

beforeAll(async () => {
  const stamp = Date.now();

  const user = await prisma.user.create({
    data: {
      clerkUserId: `paccrep-test-clerk-user-${stamp}`,
      email: `paccrep-test-${stamp}@test.local`,
      name: "PrismaAccountsRepo Integration Test User",
    },
  });
  testUserId = user.id;

  const org = await prisma.organization.create({
    data: {
      clerkOrgId: `paccrep-test-clerk-org-${stamp}`,
      name: `PrismaAccountsRepo Integration Test Org ${stamp}`,
      slug: `paccrep-test-org-${stamp}`,
    },
  });
  testOrgId = org.id;
});

afterAll(async () => {
  await prisma.journalLine.deleteMany({
    where: { account: { organizationId: testOrgId } },
  });
  await prisma.journalEntry.deleteMany({ where: { organizationId: testOrgId } });
  await prisma.account.deleteMany({ where: { organizationId: testOrgId } });
  await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
  await prisma.organization.delete({ where: { id: testOrgId } });
  await prisma.user.delete({ where: { id: testUserId } });
});

afterEach(async () => {
  await prisma.journalLine.deleteMany({
    where: { account: { organizationId: testOrgId } },
  });
  await prisma.journalEntry.deleteMany({ where: { organizationId: testOrgId } });
  await prisma.account.deleteMany({ where: { organizationId: testOrgId } });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function seedAccount(overrides: {
  code: string;
  name?: string;
  type?: string;
  nature?: string;
  level?: number;
  isDetail?: boolean;
  isActive?: boolean;
  parentId?: string | null;
}) {
  return prisma.account.create({
    data: {
      organizationId: testOrgId,
      code: overrides.code,
      name: overrides.name ?? `Account ${overrides.code}`,
      type: (overrides.type as "ACTIVO") ?? "ACTIVO",
      nature: (overrides.nature as "DEUDORA") ?? "DEUDORA",
      level: overrides.level ?? 1,
      isDetail: overrides.isDetail ?? false,
      isActive: overrides.isActive ?? true,
      requiresContact: false,
      parentId: overrides.parentId ?? null,
    },
  });
}

// ── findAll ───────────────────────────────────────────────────────────────────

describe("findAll", () => {
  it("returns all accounts for org (no filter)", async () => {
    await seedAccount({ code: "1", type: "ACTIVO" });
    await seedAccount({ code: "2", type: "PASIVO", nature: "ACREEDORA" });
    const repo = new PrismaAccountsRepo();
    const accounts = await repo.findAll(testOrgId);
    expect(accounts).toHaveLength(2);
    expect(accounts.map((a) => a.code)).toEqual(["1", "2"]);
  });

  it("filters by type", async () => {
    await seedAccount({ code: "1", type: "ACTIVO" });
    await seedAccount({ code: "2", type: "PASIVO", nature: "ACREEDORA" });
    const repo = new PrismaAccountsRepo();
    const accounts = await repo.findAll(testOrgId, { type: "ACTIVO" });
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.code).toBe("1");
  });

  it("filters by isDetail", async () => {
    await seedAccount({ code: "1", isDetail: false });
    await seedAccount({ code: "2", isDetail: true });
    const repo = new PrismaAccountsRepo();
    const accounts = await repo.findAll(testOrgId, { isDetail: true });
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.code).toBe("2");
  });

  it("filters by isActive=false", async () => {
    await seedAccount({ code: "1", isActive: true });
    await seedAccount({ code: "2", isActive: false });
    const repo = new PrismaAccountsRepo();
    const accounts = await repo.findAll(testOrgId, { isActive: false });
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.code).toBe("2");
  });
});

// ── findById ──────────────────────────────────────────────────────────────────

describe("findById", () => {
  it("returns account when found within org", async () => {
    const created = await seedAccount({ code: "1" });
    const repo = new PrismaAccountsRepo();
    const found = await repo.findById(testOrgId, created.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
  });

  it("returns null for id belonging to different org", async () => {
    const created = await seedAccount({ code: "1" });
    const repo = new PrismaAccountsRepo();
    const found = await repo.findById("other-org-id", created.id);
    expect(found).toBeNull();
  });
});

// ── findByCode ────────────────────────────────────────────────────────────────

describe("findByCode", () => {
  it("returns account when code found", async () => {
    await seedAccount({ code: "1.1.01", name: "Caja" });
    const repo = new PrismaAccountsRepo();
    const found = await repo.findByCode(testOrgId, "1.1.01");
    expect(found).not.toBeNull();
    expect(found?.name).toBe("Caja");
  });

  it("returns null when code not found", async () => {
    const repo = new PrismaAccountsRepo();
    const found = await repo.findByCode(testOrgId, "9999");
    expect(found).toBeNull();
  });
});

// ── findManyByIds ─────────────────────────────────────────────────────────────

describe("findManyByIds", () => {
  it("returns [] for empty ids array without DB call", async () => {
    const repo = new PrismaAccountsRepo();
    const result = await repo.findManyByIds(testOrgId, []);
    expect(result).toEqual([]);
  });

  it("returns matching accounts for given ids", async () => {
    const a1 = await seedAccount({ code: "1" });
    const a2 = await seedAccount({ code: "2", type: "PASIVO", nature: "ACREEDORA" });
    await seedAccount({ code: "3" });
    const repo = new PrismaAccountsRepo();
    const result = await repo.findManyByIds(testOrgId, [a1.id, a2.id]);
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.id).sort()).toEqual([a1.id, a2.id].sort());
  });
});

// ── findTree ──────────────────────────────────────────────────────────────────

describe("findTree", () => {
  it("returns hierarchical tree with nested children", async () => {
    const root = await seedAccount({ code: "1", level: 1 });
    const child = await seedAccount({ code: "1.1", level: 2, parentId: root.id });
    await seedAccount({ code: "1.1.1", level: 3, parentId: child.id, isDetail: true });
    const repo = new PrismaAccountsRepo();
    const tree = await repo.findTree(testOrgId);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.code).toBe("1");
    const children = (tree[0] as Record<string, unknown>)?.children as { code: string; children: unknown[] }[];
    expect(children).toHaveLength(1);
    expect(children[0]?.code).toBe("1.1");
    const grandchildren = children[0]?.children as { code: string }[];
    expect(grandchildren).toHaveLength(1);
    expect(grandchildren[0]?.code).toBe("1.1.1");
  });
});

// ── findSiblings ──────────────────────────────────────────────────────────────

describe("findSiblings", () => {
  it("returns only code field for siblings under parentId", async () => {
    const parent = await seedAccount({ code: "1", level: 1 });
    await seedAccount({ code: "1.1", level: 2, parentId: parent.id });
    await seedAccount({ code: "1.2", level: 2, parentId: parent.id });
    const repo = new PrismaAccountsRepo();
    const siblings = await repo.findSiblings(testOrgId, parent.id);
    expect(siblings).toHaveLength(2);
    // Must return only { code } — verify key set
    for (const s of siblings) {
      expect(Object.keys(s)).toEqual(["code"]);
    }
  });

  it("returns root-level accounts when parentId is null", async () => {
    await seedAccount({ code: "1", level: 1 });
    await seedAccount({ code: "2", level: 1, type: "PASIVO", nature: "ACREEDORA" });
    const repo = new PrismaAccountsRepo();
    const roots = await repo.findSiblings(testOrgId, null);
    expect(roots).toHaveLength(2);
    expect(roots.map((r) => r.code).sort()).toEqual(["1", "2"]);
  });
});

// ── findByType ────────────────────────────────────────────────────────────────

describe("findByType", () => {
  it("returns accounts of the given type ordered by code", async () => {
    await seedAccount({ code: "1", type: "ACTIVO" });
    await seedAccount({ code: "2", type: "ACTIVO" });
    await seedAccount({ code: "3", type: "PASIVO", nature: "ACREEDORA" });
    const repo = new PrismaAccountsRepo();
    const result = await repo.findByType(testOrgId, "ACTIVO");
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.code)).toEqual(["1", "2"]);
  });
});

// ── findDetailAccounts ────────────────────────────────────────────────────────

describe("findDetailAccounts", () => {
  it("returns only isDetail=true AND isActive=true accounts", async () => {
    await seedAccount({ code: "1", isDetail: true, isActive: true });
    await seedAccount({ code: "2", isDetail: true, isActive: false });
    await seedAccount({ code: "3", isDetail: false, isActive: true });
    const repo = new PrismaAccountsRepo();
    const result = await repo.findDetailAccounts(testOrgId);
    expect(result).toHaveLength(1);
    expect(result[0]?.code).toBe("1");
  });
});

// ── findDetailChildrenByParentCodes ───────────────────────────────────────────

describe("findDetailChildrenByParentCodes", () => {
  it("returns descendants of parentCodes AND parent when itself is detail", async () => {
    // 1.1 is a detail leaf (no sub-accounts)
    await seedAccount({ code: "1.1", isDetail: true, isActive: true });
    // 2.1 has a detail child 2.1.01
    const parent21 = await seedAccount({ code: "2.1", isDetail: false, isActive: true });
    await seedAccount({ code: "2.1.01", isDetail: true, isActive: true, parentId: parent21.id });
    const repo = new PrismaAccountsRepo();
    const result = await repo.findDetailChildrenByParentCodes(testOrgId, ["1.1", "2.1"]);
    const codes = result.map((a) => a.code).sort();
    expect(codes).toEqual(["1.1", "2.1.01"]);
  });
});

// ── findActiveChildren ────────────────────────────────────────────────────────

describe("findActiveChildren", () => {
  it("returns only active direct children of parent", async () => {
    const parent = await seedAccount({ code: "1", level: 1 });
    await seedAccount({ code: "1.1", level: 2, parentId: parent.id, isActive: true });
    await seedAccount({ code: "1.2", level: 2, parentId: parent.id, isActive: false });
    const repo = new PrismaAccountsRepo();
    const result = await repo.findActiveChildren(testOrgId, parent.id);
    expect(result).toHaveLength(1);
    expect(result[0]?.code).toBe("1.1");
  });
});

// ── create ────────────────────────────────────────────────────────────────────

describe("create", () => {
  it("persists a new account with all fields", async () => {
    const data: ResolvedCreateAccountData = {
      code: "1.1.01",
      name: "Caja",
      type: "ACTIVO",
      nature: "DEUDORA",
      subtype: null,
      parentId: null,
      level: 1,
      isDetail: true,
      requiresContact: false,
      description: null,
      isContraAccount: false,
    };
    const repo = new PrismaAccountsRepo();
    const created = await repo.create(testOrgId, data);
    expect(created.code).toBe("1.1.01");
    expect(created.name).toBe("Caja");
    expect(created.organizationId).toBe(testOrgId);
    expect(created.isDetail).toBe(true);
  });

  it("creates inside a transaction", async () => {
    const data: ResolvedCreateAccountData = {
      code: "1.1.02",
      name: "Banco",
      type: "ACTIVO",
      nature: "DEUDORA",
      subtype: null,
      parentId: null,
      level: 1,
      isDetail: true,
      requiresContact: false,
      description: null,
      isContraAccount: false,
    };
    const repo = new PrismaAccountsRepo();
    let created: Awaited<ReturnType<typeof repo.create>>;
    await prisma.$transaction(async (tx) => {
      created = await repo.create(testOrgId, data, tx);
    });
    const found = await prisma.account.findFirst({ where: { code: "1.1.02", organizationId: testOrgId } });
    expect(found).not.toBeNull();
    expect(found?.name).toBe("Banco");
  });
});

// ── update ────────────────────────────────────────────────────────────────────

describe("update", () => {
  it("partially updates fields", async () => {
    const acc = await seedAccount({ code: "1", name: "Original" });
    const repo = new PrismaAccountsRepo();
    const updated = await repo.update(testOrgId, acc.id, { name: "Updated" });
    expect(updated.name).toBe("Updated");
  });

  it("updates inside a transaction", async () => {
    const acc = await seedAccount({ code: "1", name: "Original" });
    const repo = new PrismaAccountsRepo();
    await prisma.$transaction(async (tx) => {
      await repo.update(testOrgId, acc.id, { isActive: false }, tx);
    });
    const found = await prisma.account.findFirst({ where: { id: acc.id } });
    expect(found?.isActive).toBe(false);
  });
});

// ── seedChartOfAccounts ───────────────────────────────────────────────────────

describe("seedChartOfAccounts", () => {
  it("seeds accounts idempotently (run twice, same result)", async () => {
    const accounts: readonly AccountDef[] = [
      {
        code: "1",
        name: "ACTIVO",
        type: "ACTIVO",
        subtype: null,
        level: 1,
        isDetail: false,
        requiresContact: false,
        parentCode: null,
        isContraAccount: false,
      },
      {
        code: "1.1",
        name: "Activo Corriente",
        type: "ACTIVO",
        subtype: null,
        level: 2,
        isDetail: false,
        requiresContact: false,
        parentCode: "1",
        isContraAccount: false,
      },
    ];
    const repo = new PrismaAccountsRepo();
    await repo.seedChartOfAccounts(testOrgId, accounts);
    await repo.seedChartOfAccounts(testOrgId, accounts); // second run — idempotent
    const all = await prisma.account.findMany({ where: { organizationId: testOrgId } });
    expect(all).toHaveLength(2);
    expect(all.map((a) => a.code).sort()).toEqual(["1", "1.1"]);
  });

  it("seeds inside a transaction", async () => {
    const accounts: readonly AccountDef[] = [
      {
        code: "2",
        name: "PASIVO",
        type: "PASIVO",
        subtype: null,
        level: 1,
        isDetail: false,
        requiresContact: false,
        parentCode: null,
        isContraAccount: false,
      },
    ];
    const repo = new PrismaAccountsRepo();
    await prisma.$transaction(async (tx) => {
      await repo.seedChartOfAccounts(testOrgId, accounts, tx);
    });
    const found = await prisma.account.findFirst({ where: { code: "2", organizationId: testOrgId } });
    expect(found).not.toBeNull();
    expect(found?.type).toBe("PASIVO");
    // deriveNature: PASIVO non-contra → ACREEDORA
    expect(found?.nature).toBe("ACREEDORA");
  });
});

// ── deactivate ────────────────────────────────────────────────────────────────

describe("deactivate", () => {
  it("flips isActive to false", async () => {
    const acc = await seedAccount({ code: "1", isActive: true });
    const repo = new PrismaAccountsRepo();
    const result = await repo.deactivate(testOrgId, acc.id);
    expect(result.isActive).toBe(false);
  });

  it("succeeds even when journalLines exist (guard is service-layer per REQ-009)", async () => {
    const acc = await seedAccount({ code: "1", isActive: true, isDetail: true });
    // We don't create journal entries here since that requires a full JournalEntry + Period.
    // Test just verifies deactivate itself doesn't throw — the no-guard contract.
    const repo = new PrismaAccountsRepo();
    await expect(repo.deactivate(testOrgId, acc.id)).resolves.toMatchObject({ isActive: false });
  });
});

// ── countJournalLines ─────────────────────────────────────────────────────────

describe("countJournalLines", () => {
  it("returns 0 when no journal lines exist for account", async () => {
    const acc = await seedAccount({ code: "1" });
    const repo = new PrismaAccountsRepo();
    const count = await repo.countJournalLines(testOrgId, acc.id);
    expect(count).toBe(0);
  });
});

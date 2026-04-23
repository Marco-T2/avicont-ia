/**
 * Unit tests for AccountsService — contra-account support.
 *
 * Covers: REQ-CA.2 (deriveNature with isContraAccount),
 *         REQ-CA.3 (nature validation on create),
 *         REQ-CA.10 (no signature breakage)
 *
 * Uses a mock AccountsRepository — no real DB.
 */

import { describe, it, expect, vi } from "vitest";
import { AccountsService } from "@/features/accounting/accounts.service";
import type { AccountsRepository } from "@/features/accounting/accounts.repository";
import type { Account } from "@/generated/prisma/client";

// ── Mock helpers ──

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    code: "1.1.9",
    name: "Test Account",
    type: "ACTIVO",
    nature: "DEUDORA",
    subtype: "ACTIVO_CORRIENTE",
    parentId: "parent-1",
    level: 3,
    isDetail: true,
    requiresContact: false,
    description: null,
    isActive: true,
    isContraAccount: false,
    organizationId: "org-1",
    ...overrides,
  } as Account;
}

function makeParentAccount(overrides: Partial<Account> = {}): Account {
  return makeAccount({
    id: "parent-1",
    code: "1.1",
    name: "Activo Corriente",
    level: 2,
    isDetail: false,
    isContraAccount: false,
    ...overrides,
  });
}

function makeMockRepo(): AccountsRepository {
  const parent = makeParentAccount();
  return {
    findById: vi.fn(async (_orgId: string, id: string) => {
      if (id === "parent-1") return parent;
      return null;
    }),
    findByCode: vi.fn(async () => null), // code available
    findSiblings: vi.fn(async () => []),
    findAll: vi.fn(async () => []),
    findTree: vi.fn(async () => []),
    findActiveChildren: vi.fn(async () => []),
    countJournalLines: vi.fn(async () => 0),
    create: vi.fn(async (_orgId: string, data: object) => makeAccount(data as Partial<Account>)),
    update: vi.fn(async (_orgId: string, id: string, data: object) => makeAccount({ id, ...(data as Partial<Account>) })),
    deactivate: vi.fn(async (_orgId: string, id: string) => makeAccount({ id, isActive: false })),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<Account>) => fn(null)),
  } as unknown as AccountsRepository;
}

// ── T3: deriveNature respects contra flag ──

describe("deriveNature via AccountsService.create (REQ-CA.2)", () => {
  it("CA.2-S1 — ACTIVO + isContraAccount=false → nature DEUDORA (normal)", async () => {
    const repo = makeMockRepo();
    const service = new AccountsService(repo);

    // Should NOT throw — ACTIVO+false → derives DEUDORA → matches input.nature=DEUDORA
    await expect(
      service.create("org-1", {
        name: "Test",
        parentId: "parent-1",
        nature: "DEUDORA",
        isContraAccount: false,
      })
    ).resolves.toBeDefined();
  });

  it("CA.2-S2 — ACTIVO + isContraAccount=true → derives ACREEDORA (accepts ACREEDORA)", async () => {
    const repo = makeMockRepo();
    const service = new AccountsService(repo);

    await expect(
      service.create("org-1", {
        name: "Depreciación Acumulada",
        parentId: "parent-1",
        nature: "ACREEDORA",
        isContraAccount: true,
      })
    ).resolves.toBeDefined();
  });

  it("CA.2-S3 — ACTIVO + isContraAccount=true + nature=DEUDORA → throws INVALID_ACCOUNT_NATURE", async () => {
    const repo = makeMockRepo();
    const service = new AccountsService(repo);

    await expect(
      service.create("org-1", {
        name: "Contra ACTIVO mal natural",
        parentId: "parent-1",
        nature: "DEUDORA",
        isContraAccount: true,
      })
    ).rejects.toMatchObject({ code: "INVALID_ACCOUNT_NATURE" });
  });

  it("CA.2-S4 — ACTIVO + isContraAccount=false + nature=ACREEDORA → throws INVALID_ACCOUNT_NATURE (regression)", async () => {
    const repo = makeMockRepo();
    const service = new AccountsService(repo);

    await expect(
      service.create("org-1", {
        name: "ACTIVO mal con ACREEDORA",
        parentId: "parent-1",
        nature: "ACREEDORA",
        isContraAccount: false,
      })
    ).rejects.toMatchObject({ code: "INVALID_ACCOUNT_NATURE" });
  });

  it("CA.2-S5 — backward compat: no isContraAccount field → derives DEUDORA for ACTIVO", async () => {
    const repo = makeMockRepo();
    const service = new AccountsService(repo);

    // Existing callers omit isContraAccount — should default to false → DEUDORA for ACTIVO
    await expect(
      service.create("org-1", {
        name: "Normal ACTIVO no contra",
        parentId: "parent-1",
        nature: "DEUDORA",
        // no isContraAccount field
      })
    ).resolves.toBeDefined();
  });
});

// ── T4: validate nature against contra flag on create ──

describe("AccountsService.create — contra nature validation (REQ-CA.3)", () => {
  it("CA.3-S1 — ACTIVO + isContraAccount=true + nature=ACREEDORA → persisted successfully", async () => {
    const repo = makeMockRepo();
    const service = new AccountsService(repo);

    const result = await service.create("org-1", {
      name: "Depreciación Acumulada",
      parentId: "parent-1",
      nature: "ACREEDORA",
      isContraAccount: true,
    });

    expect(result).toBeDefined();
    // The create repo mock was called with isContraAccount: true
    expect(repo.create).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ isContraAccount: true, nature: "ACREEDORA" }),
    );
  });

  it("CA.3-S2 — ACTIVO + isContraAccount=true + nature=DEUDORA → throws INVALID_ACCOUNT_NATURE", async () => {
    const repo = makeMockRepo();
    const service = new AccountsService(repo);

    await expect(
      service.create("org-1", {
        name: "Contra ACTIVO wrong nature",
        parentId: "parent-1",
        nature: "DEUDORA",
        isContraAccount: true,
      })
    ).rejects.toMatchObject({ code: "INVALID_ACCOUNT_NATURE" });
  });

  it("CA.3-S3 — ACTIVO + isContraAccount=false + nature=ACREEDORA → throws INVALID_ACCOUNT_NATURE (regression)", async () => {
    const repo = makeMockRepo();
    const service = new AccountsService(repo);

    await expect(
      service.create("org-1", {
        name: "ACTIVO mal",
        parentId: "parent-1",
        nature: "ACREEDORA",
        isContraAccount: false,
      })
    ).rejects.toMatchObject({ code: "INVALID_ACCOUNT_NATURE" });
  });

  it("CA.3-S4 — isContraAccount omitted → defaults to false, behavior unchanged", async () => {
    const repo = makeMockRepo();
    // Use PASIVO parent for this test
    const pasivoParent = makeParentAccount({
      id: "parent-pasivo",
      code: "2.1",
      name: "Pasivo Corriente",
      type: "PASIVO",
      nature: "ACREEDORA",
    });
    (repo.findById as ReturnType<typeof vi.fn>).mockImplementation(async (_orgId: string, id: string) => {
      if (id === "parent-pasivo") return pasivoParent;
      return null;
    });

    const service = new AccountsService(repo);

    const result = await service.create("org-1", {
      name: "Cuentas por Pagar",
      parentId: "parent-pasivo",
      // no isContraAccount field → defaults false
    });

    expect(result).toBeDefined();
    expect(repo.create).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ isContraAccount: false }),
    );
  });
});

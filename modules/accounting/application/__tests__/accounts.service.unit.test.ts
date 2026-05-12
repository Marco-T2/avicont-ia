/**
 * Unit tests for AccountsService (POC #3c) — application layer.
 *
 * Mocks AccountsCrudPort (all 15 methods) and PrismaClient.$transaction.
 * No DB dependency — pure orchestration coverage.
 *
 * Paired-sister precedent: journals.service.test.ts (vi.mock port pattern).
 * Design locks: D6 mock strategy, D3 atomic tx, D9 decision matrix.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountsService } from "../accounts.service";
import type { AccountsCrudPort } from "../../domain/ports/accounts-crud.port";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "@/features/shared/errors";

// ── Mock factories ─────────────────────────────────────────────────────────

const makeMockRepo = (): AccountsCrudPort => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  findManyByIds: vi.fn(),
  findTree: vi.fn(),
  findByType: vi.fn(),
  findSiblings: vi.fn(),
  findDetailAccounts: vi.fn(),
  findDetailChildrenByParentCodes: vi.fn(),
  findActiveChildren: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  seedChartOfAccounts: vi.fn(),
  deactivate: vi.fn(),
  countJournalLines: vi.fn(),
});

const makeMockPrisma = () => ({
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn("TX_TOKEN")),
});

// ── Helpers ────────────────────────────────────────────────────────────────

const makeAccount = (overrides: Partial<{
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: "ACTIVO" | "PASIVO" | "PATRIMONIO" | "INGRESO" | "GASTO";
  nature: "DEUDORA" | "ACREEDORA";
  subtype: string | null;
  parentId: string | null;
  level: number;
  isDetail: boolean;
  isActive: boolean;
  requiresContact: boolean;
  description: string | null;
  isContraAccount: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = {}) => ({
  id: "acc-1",
  organizationId: "org-1",
  code: "1",
  name: "Activos",
  type: "ACTIVO" as const,
  nature: "DEUDORA" as const,
  subtype: null,
  parentId: null,
  level: 1,
  isDetail: false,
  isActive: true,
  requiresContact: false,
  description: null,
  isContraAccount: false,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  ...overrides,
});

// ── Test suite ─────────────────────────────────────────────────────────────

describe("AccountsService", () => {
  let repo: AccountsCrudPort;
  let prisma: ReturnType<typeof makeMockPrisma>;
  let service: AccountsService;

  beforeEach(() => {
    repo = makeMockRepo();
    prisma = makeMockPrisma();
    service = new AccountsService({ repo, prisma: prisma as never });
    vi.clearAllMocks();
    // Re-create service after clearAllMocks so fresh mocks are in place
    repo = makeMockRepo();
    prisma = makeMockPrisma();
    service = new AccountsService({ repo, prisma: prisma as never });
  });

  // ── list ─────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("happy: returns all accounts from repo", async () => {
      const accounts = [makeAccount(), makeAccount({ id: "acc-2" })];
      vi.mocked(repo.findAll).mockResolvedValueOnce(accounts);
      const result = await service.list("org-1");
      expect(result).toBe(accounts);
      expect(repo.findAll).toHaveBeenCalledWith("org-1", undefined);
    });

    it("happy: passes filters through to repo.findAll", async () => {
      vi.mocked(repo.findAll).mockResolvedValueOnce([]);
      await service.list("org-1", { type: "ACTIVO" });
      expect(repo.findAll).toHaveBeenCalledWith("org-1", { type: "ACTIVO" });
    });
  });

  // ── getTree ───────────────────────────────────────────────────────────────

  describe("getTree", () => {
    it("happy: delegates to repo.findTree", async () => {
      const tree = [{ ...makeAccount(), children: [] }];
      vi.mocked(repo.findTree).mockResolvedValueOnce(tree);
      const result = await service.getTree("org-1");
      expect(result).toBe(tree);
      expect(repo.findTree).toHaveBeenCalledWith("org-1");
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("happy: returns account when found", async () => {
      const account = makeAccount();
      vi.mocked(repo.findById).mockResolvedValueOnce(account);
      const result = await service.getById("org-1", "acc-1");
      expect(result).toBe(account);
    });

    it("error: throws NotFoundError when repo returns null", async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(null);
      await expect(service.getById("org-1", "missing")).rejects.toThrow(NotFoundError);
    });
  });

  // ── seedChartOfAccounts ───────────────────────────────────────────────────

  describe("seedChartOfAccounts", () => {
    it("happy: delegates to repo.seedChartOfAccounts without tx", async () => {
      vi.mocked(repo.seedChartOfAccounts).mockResolvedValueOnce(undefined);
      await service.seedChartOfAccounts("org-1");
      expect(repo.seedChartOfAccounts).toHaveBeenCalledWith(
        "org-1",
        expect.any(Array),
        undefined,
      );
    });

    it("happy: passes tx param to repo.seedChartOfAccounts", async () => {
      vi.mocked(repo.seedChartOfAccounts).mockResolvedValueOnce(undefined);
      await service.seedChartOfAccounts("org-1", "some-tx");
      expect(repo.seedChartOfAccounts).toHaveBeenCalledWith(
        "org-1",
        expect.any(Array),
        "some-tx",
      );
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("happy: no parent — creates level-1 account directly", async () => {
      const created = makeAccount();
      vi.mocked(repo.findSiblings).mockResolvedValueOnce([]);
      vi.mocked(repo.findByCode).mockResolvedValueOnce(null);
      vi.mocked(repo.create).mockResolvedValueOnce(created);
      const result = await service.create("org-1", { name: "Activos", type: "ACTIVO" });
      expect(result).toBe(created);
      expect(repo.create).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("happy: parent.isDetail=false — no tx triggered", async () => {
      const parent = makeAccount({ id: "parent-1", isDetail: false, level: 1, code: "1" });
      const created = makeAccount({ id: "child-1", level: 2 });
      vi.mocked(repo.findById).mockResolvedValueOnce(parent);
      vi.mocked(repo.findSiblings).mockResolvedValueOnce([]);
      vi.mocked(repo.findByCode).mockResolvedValueOnce(null);
      vi.mocked(repo.create).mockResolvedValueOnce(created);
      await service.create("org-1", { name: "Child", parentId: "parent-1" });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledTimes(1);
    });

    it("happy: parent.isDetail=true — atomic tx: update parent + create child", async () => {
      const parent = makeAccount({ id: "parent-1", isDetail: true, level: 1, code: "1" });
      const created = makeAccount({ id: "child-1", level: 2 });
      vi.mocked(repo.findById).mockResolvedValueOnce(parent);
      vi.mocked(repo.findSiblings).mockResolvedValueOnce([]);
      vi.mocked(repo.findByCode).mockResolvedValueOnce(null);
      vi.mocked(repo.update).mockResolvedValueOnce(parent);
      vi.mocked(repo.create).mockResolvedValueOnce(created);
      await service.create("org-1", { name: "Child", parentId: "parent-1" });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(repo.update).toHaveBeenCalledWith("org-1", "parent-1", { isDetail: false }, "TX_TOKEN");
      expect(repo.create).toHaveBeenCalledWith("org-1", expect.objectContaining({ level: 2 }), "TX_TOKEN");
    });

    it("error: parentId provided but not found → NotFoundError('Cuenta padre')", async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(null);
      await expect(
        service.create("org-1", { name: "Child", parentId: "missing" }),
      ).rejects.toThrow(NotFoundError);
    });

    it("error: level > 4 → ValidationError MAX_ACCOUNT_DEPTH_EXCEEDED", async () => {
      const parent = makeAccount({ id: "p4", level: 4, code: "1.1.1.1" });
      vi.mocked(repo.findById).mockResolvedValueOnce(parent);
      await expect(
        service.create("org-1", { name: "Too deep", parentId: "p4", type: "ACTIVO" }),
      ).rejects.toThrow(ValidationError);
    });

    it("error: root account with no type → ValidationError", async () => {
      await expect(
        service.create("org-1", { name: "Unnamed" }),
      ).rejects.toThrow(ValidationError);
    });

    it("error: input.type !== parent.type → ValidationError ACCOUNT_TYPE_MISMATCH", async () => {
      const parent = makeAccount({ id: "p1", type: "ACTIVO" });
      vi.mocked(repo.findById).mockResolvedValueOnce(parent);
      await expect(
        service.create("org-1", { name: "Wrong type", parentId: "p1", type: "PASIVO" }),
      ).rejects.toThrow(ValidationError);
    });

    it("error: nature mismatch → ValidationError INVALID_ACCOUNT_NATURE", async () => {
      vi.mocked(repo.findSiblings).mockResolvedValueOnce([]);
      vi.mocked(repo.findByCode).mockResolvedValueOnce(null);
      await expect(
        service.create("org-1", { name: "Bad nature", type: "ACTIVO", nature: "ACREEDORA" }),
      ).rejects.toThrow(ValidationError);
    });

    it("error: manual code wrong prefix → ValidationError INVALID_ACCOUNT_CODE_PREFIX", async () => {
      const parent = makeAccount({ id: "p1", code: "1", level: 1 });
      vi.mocked(repo.findById).mockResolvedValueOnce(parent);
      await expect(
        service.create("org-1", { name: "Wrong prefix", parentId: "p1", code: "2.1" }),
      ).rejects.toThrow(ValidationError);
    });

    it("error: code already exists → ConflictError", async () => {
      vi.mocked(repo.findSiblings).mockResolvedValueOnce([]);
      vi.mocked(repo.findByCode).mockResolvedValueOnce(makeAccount({ code: "1" }));
      await expect(
        service.create("org-1", { name: "Dup code", type: "ACTIVO", code: "1" }),
      ).rejects.toThrow(ConflictError);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("happy: no subtype in input → delegates directly to repo.update", async () => {
      const account = makeAccount({ id: "acc-1", level: 2 });
      const updated = makeAccount({ id: "acc-1", name: "Updated" });
      vi.mocked(repo.findById).mockResolvedValueOnce(account);
      vi.mocked(repo.update).mockResolvedValueOnce(updated);
      const result = await service.update("org-1", "acc-1", { name: "Updated" });
      expect(result).toBe(updated);
    });

    it("error: account not found → NotFoundError", async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(null);
      await expect(service.update("org-1", "missing", { name: "X" })).rejects.toThrow(NotFoundError);
    });

    it("error: level-1 account with subtype → ValidationError (level-1 no subtype)", async () => {
      const account = makeAccount({ id: "root-1", level: 1 });
      vi.mocked(repo.findById).mockResolvedValueOnce(account);
      await expect(
        service.update("org-1", "root-1", { subtype: "ACTIVO_CORRIENTE" as never }),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ── deactivate ────────────────────────────────────────────────────────────

  describe("deactivate", () => {
    it("happy: level=3, no active children, 0 journal lines → deactivates", async () => {
      const account = makeAccount({ id: "acc-3", level: 3 });
      const deactivated = makeAccount({ id: "acc-3", isActive: false });
      vi.mocked(repo.findById).mockResolvedValueOnce(account);
      vi.mocked(repo.findActiveChildren).mockResolvedValueOnce([]);
      vi.mocked(repo.countJournalLines).mockResolvedValueOnce(0);
      vi.mocked(repo.deactivate).mockResolvedValueOnce(deactivated);
      const result = await service.deactivate("org-1", "acc-3");
      expect(result).toBe(deactivated);
    });

    it("error: account not found → NotFoundError", async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(null);
      await expect(service.deactivate("org-1", "missing")).rejects.toThrow(NotFoundError);
    });

    it("error: level=1 → ValidationError (structural)", async () => {
      const account = makeAccount({ id: "root-1", level: 1 });
      vi.mocked(repo.findById).mockResolvedValueOnce(account);
      await expect(service.deactivate("org-1", "root-1")).rejects.toThrow(ValidationError);
    });

    it("error: level=2 → ValidationError (structural)", async () => {
      const account = makeAccount({ id: "l2-acc", level: 2 });
      vi.mocked(repo.findById).mockResolvedValueOnce(account);
      await expect(service.deactivate("org-1", "l2-acc")).rejects.toThrow(ValidationError);
    });

    it("error: active children > 0 → ValidationError", async () => {
      const account = makeAccount({ id: "acc-3", level: 3 });
      vi.mocked(repo.findById).mockResolvedValueOnce(account);
      vi.mocked(repo.findActiveChildren).mockResolvedValueOnce([makeAccount({ id: "child-1" })]);
      await expect(service.deactivate("org-1", "acc-3")).rejects.toThrow(ValidationError);
    });

    it("error: journalLines > 0 → ValidationError", async () => {
      const account = makeAccount({ id: "acc-3", level: 3 });
      vi.mocked(repo.findById).mockResolvedValueOnce(account);
      vi.mocked(repo.findActiveChildren).mockResolvedValueOnce([]);
      vi.mocked(repo.countJournalLines).mockResolvedValueOnce(5);
      await expect(service.deactivate("org-1", "acc-3")).rejects.toThrow(ValidationError);
    });
  });
});

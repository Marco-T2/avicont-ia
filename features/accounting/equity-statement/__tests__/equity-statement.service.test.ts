/**
 * T06 — RED: EquityStatementService unit tests with mocked repositories.
 *
 * Covers: REQ-4 (shared periodResult), REQ-5 (cross-statement basis), REQ-8 (RBAC gate),
 *         REQ-9 (role check), REQ-10 (date validation)
 */

import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { Prisma } from "@/generated/prisma/client";
import { EquityStatementService } from "../equity-statement.service";
import { EquityStatementRepository } from "../equity-statement.repository";
import { PrismaFinancialStatementsRepo } from "@/modules/accounting/financial-statements/infrastructure/prisma-financial-statements.repo";
import { ForbiddenError, ValidationError } from "@/features/shared/errors";
import type { EquityAccountMetadata } from "../equity-statement.types";

const D = (v: string | number) => new Prisma.Decimal(String(v));

// ── Minimal mock helpers ──────────────────────────────────────────────────────

const minimalAccounts: EquityAccountMetadata[] = [
  { id: "acc-capital", code: "3.1.1", name: "Capital Social", nature: "ACREEDORA" },
];

function createMockRepo(): EquityStatementRepository {
  return {
    getPatrimonioBalancesAt: vi.fn().mockResolvedValue(new Map()),
    getTypedPatrimonyMovements: vi.fn().mockResolvedValue(new Map()),
    getAperturaPatrimonyDelta: vi.fn().mockResolvedValue(new Map()),
    findPatrimonioAccounts: vi.fn().mockResolvedValue(minimalAccounts),
    getOrgMetadata: vi.fn().mockResolvedValue({ name: "Test Org", taxId: null, address: null }),
    isClosedPeriodMatch: vi.fn().mockResolvedValue(false),
    requireOrg: vi.fn().mockReturnValue({ organizationId: "org-1" }),
    transaction: vi.fn(),
    db: {} as unknown,
  } as unknown as EquityStatementRepository;
}

function createMockFsRepo(): PrismaFinancialStatementsRepo {
  return {
    findAccountsWithSubtype: vi.fn().mockResolvedValue([]),
    aggregateJournalLinesInRange: vi.fn().mockResolvedValue([]),
    requireOrg: vi.fn().mockReturnValue({ organizationId: "org-1" }),
    transaction: vi.fn(),
    db: {} as unknown,
  } as unknown as PrismaFinancialStatementsRepo;
}

const INPUT_VALID = {
  dateFrom: new Date("2024-01-01"),
  dateTo:   new Date("2024-12-31"),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("EquityStatementService — server-only boundary", () => {
  it("service file starts with import 'server-only'", () => {
    const svcPath = path.join(__dirname, "../equity-statement.service.ts");
    const content = fs.readFileSync(svcPath, "utf8");
    expect(content.startsWith(`import "server-only"`)).toBe(true);
  });
});

describe("EquityStatementService — RBAC", () => {
  it("role='member' → ForbiddenError BEFORE any DB call", async () => {
    const repo = createMockRepo();
    const fsRepo = createMockFsRepo();
    const service = new EquityStatementService(repo, fsRepo);

    await expect(service.generate("org-1", "member", INPUT_VALID)).rejects.toThrow(ForbiddenError);
    expect(repo.getPatrimonioBalancesAt).not.toHaveBeenCalled();
    expect(fsRepo.findAccountsWithSubtype).not.toHaveBeenCalled();
  });

  it("role='viewer' (non-existent) → ForbiddenError", async () => {
    const service = new EquityStatementService(createMockRepo(), createMockFsRepo());
    await expect(service.generate("org-1", "viewer", INPUT_VALID)).rejects.toThrow(ForbiddenError);
  });

  it("role='contador' → resolves without throwing", async () => {
    const service = new EquityStatementService(createMockRepo(), createMockFsRepo());
    const result = await service.generate("org-1", "contador", INPUT_VALID);
    expect(result).toBeDefined();
    expect(result.orgId).toBe("org-1");
  });

  it("role='admin' → resolves", async () => {
    const service = new EquityStatementService(createMockRepo(), createMockFsRepo());
    const result = await service.generate("org-1", "admin", INPUT_VALID);
    expect(result.orgId).toBe("org-1");
  });

  it("role='owner' → resolves", async () => {
    const service = new EquityStatementService(createMockRepo(), createMockFsRepo());
    const result = await service.generate("org-1", "owner", INPUT_VALID);
    expect(result.orgId).toBe("org-1");
  });
});

describe("EquityStatementService — date validation", () => {
  it("dateFrom > dateTo → ValidationError", async () => {
    const service = new EquityStatementService(createMockRepo(), createMockFsRepo());
    await expect(
      service.generate("org-1", "contador", {
        dateFrom: new Date("2024-12-31"),
        dateTo:   new Date("2024-01-01"),
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("EquityStatementService — orchestration", () => {
  it("orgId is injected into returned statement", async () => {
    const service = new EquityStatementService(createMockRepo(), createMockFsRepo());
    const result = await service.generate("org-test-999", "contador", INPUT_VALID);
    expect(result.orgId).toBe("org-test-999");
  });

  it("preliminary=true when isClosedPeriodMatch returns false", async () => {
    const repo = createMockRepo();
    (repo.isClosedPeriodMatch as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const service = new EquityStatementService(repo, createMockFsRepo());
    const result = await service.generate("org-1", "contador", INPUT_VALID);
    expect(result.preliminary).toBe(true);
  });

  it("preliminary=false when isClosedPeriodMatch returns true", async () => {
    const repo = createMockRepo();
    (repo.isClosedPeriodMatch as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const service = new EquityStatementService(repo, createMockFsRepo());
    const result = await service.generate("org-1", "contador", INPUT_VALID);
    expect(result.preliminary).toBe(false);
  });

  it("periodResult is derived from calculateRetainedEarnings(buildIncomeStatement(...))", async () => {
    // When fsRepo returns empty accounts and movements → net income = 0 → periodResult = 0
    const service = new EquityStatementService(createMockRepo(), createMockFsRepo());
    const result = await service.generate("org-1", "contador", INPUT_VALID);
    expect(result.periodResult.isZero()).toBe(true);
  });

  it("T06 — invokes repo.getTypedPatrimonyMovements(orgId, dateFrom, dateTo) exactly once", async () => {
    const repo = createMockRepo();
    const service = new EquityStatementService(repo, createMockFsRepo());
    await service.generate("org-xyz", "contador", INPUT_VALID);
    expect(repo.getTypedPatrimonyMovements).toHaveBeenCalledTimes(1);
    expect(repo.getTypedPatrimonyMovements).toHaveBeenCalledWith(
      "org-xyz",
      INPUT_VALID.dateFrom,
      INPUT_VALID.dateTo,
    );
  });

  it("T06 — typedMovements from repo propagate into builder → emitted as typed rows", async () => {
    const repo = createMockRepo();
    // Return CP movement of 200k on acc-capital
    (repo.getTypedPatrimonyMovements as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Map([["CP", new Map([["acc-capital", D("200000")]])]]),
    );
    // Final balance reflects the CP entry so the invariant holds
    (repo.getPatrimonioBalancesAt as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new Map())                                         // dayBefore
      .mockResolvedValueOnce(new Map([["acc-capital", D("200000")]]));          // dateTo

    const service = new EquityStatementService(repo, createMockFsRepo());
    const result = await service.generate("org-1", "contador", INPUT_VALID);

    const aporte = result.rows.find((r) => r.key === "APORTE_CAPITAL");
    expect(aporte).toBeDefined();
    const cs = aporte!.cells.find((c) => c.column === "CAPITAL_SOCIAL");
    expect(cs?.amount.equals(D("200000"))).toBe(true);
    expect(result.imbalanced).toBe(false);
  });

  /**
   * T12 — RED: service wires getAperturaPatrimonyDelta into Promise.all (8th slot)
   * and threads the result through to the builder's aperturaBaseline input field.
   *
   * Covers: REQ-APERTURA-MERGE scenario 1 — CA in range absorbed into SALDO_INICIAL
   */
  it("T12 — invokes repo.getAperturaPatrimonyDelta(orgId, dateFrom, dateTo) exactly once", async () => {
    const repo = createMockRepo();
    const service = new EquityStatementService(repo, createMockFsRepo());
    await service.generate("org-xyz", "contador", INPUT_VALID);
    expect(repo.getAperturaPatrimonyDelta).toHaveBeenCalledTimes(1);
    expect(repo.getAperturaPatrimonyDelta).toHaveBeenCalledWith(
      "org-xyz",
      INPUT_VALID.dateFrom,
      INPUT_VALID.dateTo,
    );
  });

  it("T12 — aperturaBaseline from repo is threaded into builder → SALDO_INICIAL absorbs CA", async () => {
    const repo = createMockRepo();
    // getAperturaPatrimonyDelta returns 200k on acc-capital (CA entry)
    (repo.getAperturaPatrimonyDelta as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Map([["acc-capital", D("200000")]]),
    );
    // Final balance reflects the CA entry so the invariant holds
    (repo.getPatrimonioBalancesAt as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new Map())                                         // dayBefore (pre-CA)
      .mockResolvedValueOnce(new Map([["acc-capital", D("200000")]]));          // dateTo

    const service = new EquityStatementService(repo, createMockFsRepo());
    const result = await service.generate("org-1", "contador", INPUT_VALID);

    const saldoInicial = result.rows.find((r) => r.key === "SALDO_INICIAL");
    expect(saldoInicial).toBeDefined();
    const cs = saldoInicial!.cells.find((c) => c.column === "CAPITAL_SOCIAL");
    expect(cs?.amount.equals(D("200000"))).toBe(true);
    expect(result.imbalanced).toBe(false);
  });
});

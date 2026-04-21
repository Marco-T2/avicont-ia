/**
 * B4 — RED: TrialBalanceService unit tests with mocked repository.
 *
 * Covers: C11.S1, C11.S2, C10.S4, C13.S5, C11.E1
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { Prisma } from "@/generated/prisma/client";
import { TrialBalanceService } from "../trial-balance.service";
import { TrialBalanceRepository } from "../trial-balance.repository";
import { ForbiddenError, ValidationError } from "@/features/shared/errors";
import type {
  TrialBalanceAccountMetadata,
  TrialBalanceMovement,
} from "../trial-balance.repository";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));

const minimalAccounts: TrialBalanceAccountMetadata[] = [
  { id: "acc-1", code: "1.1.1", name: "Caja", isDetail: true },
];

const minimalMovements: TrialBalanceMovement[] = [
  { accountId: "acc-1", totalDebit: D("1000"), totalCredit: D("0") },
];

// ── Mock repo factory ─────────────────────────────────────────────────────────

type MockRepoOverrides = Partial<{
  findAccounts: TrialBalanceRepository["findAccounts"];
  aggregateAllVouchers: TrialBalanceRepository["aggregateAllVouchers"];
}>;

function createMockRepo(overrides: MockRepoOverrides = {}): TrialBalanceRepository {
  const base = {
    findAccounts: vi.fn().mockResolvedValue(minimalAccounts),
    aggregateAllVouchers: vi.fn().mockResolvedValue(minimalMovements),
    requireOrg: vi.fn().mockReturnValue({ organizationId: "org-1" }),
    getOrgMetadata: vi.fn().mockResolvedValue({ name: "Test Org", taxId: null, address: null }),
    transaction: vi.fn(),
    db: {} as unknown,
    ...overrides,
  };
  return base as unknown as TrialBalanceRepository;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TrialBalanceService — RBAC (C11)", () => {
  it("C11.S1 — role='member' → ForbiddenError BEFORE any DB call", async () => {
    const mockRepo = createMockRepo();
    const service = new TrialBalanceService(mockRepo);

    await expect(
      service.generate("org-1", "member", {
        dateFrom: new Date("2025-01-01"),
        dateTo: new Date("2025-12-31"),
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("C11.E1 — after ForbiddenError, findAccounts and aggregateAllVouchers call count = 0", async () => {
    const mockRepo = createMockRepo();
    const service = new TrialBalanceService(mockRepo);

    await expect(
      service.generate("org-1", "member", {
        dateFrom: new Date("2025-01-01"),
        dateTo: new Date("2025-12-31"),
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(mockRepo.findAccounts).not.toHaveBeenCalled();
    expect(mockRepo.aggregateAllVouchers).not.toHaveBeenCalled();
  });

  it("C11.S2 — role='contador' → returns TrialBalanceReport with orgId injected", async () => {
    const mockRepo = createMockRepo();
    const service = new TrialBalanceService(mockRepo);

    const result = await service.generate("org-1", "contador", {
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
    });

    expect(result).toBeDefined();
    expect(result.orgId).toBe("org-1");
    expect(result.rows).toBeDefined();
  });

  it("C11.S2 — role='owner' → succeeds", async () => {
    const service = new TrialBalanceService(createMockRepo());
    const result = await service.generate("org-1", "owner", {
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
    });
    expect(result.orgId).toBe("org-1");
  });

  it("C11.S2 — role='admin' → succeeds", async () => {
    const service = new TrialBalanceService(createMockRepo());
    const result = await service.generate("org-1", "admin", {
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
    });
    expect(result.orgId).toBe("org-1");
  });
});

describe("TrialBalanceService — date validation (C10)", () => {
  it("C10.S4 — dateFrom > dateTo → ValidationError", async () => {
    const service = new TrialBalanceService(createMockRepo());

    await expect(
      service.generate("org-1", "contador", {
        dateFrom: new Date("2025-12-31"),
        dateTo: new Date("2025-01-01"),
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("TrialBalanceService — server-only boundary (C13.S5)", () => {
  it("service file starts with import 'server-only'", () => {
    const servicePath = path.join(__dirname, "../trial-balance.service.ts");
    const content = fs.readFileSync(servicePath, "utf8");
    expect(content.startsWith(`import "server-only"`)).toBe(true);
  });
});

/**
 * Tests de integración (mock de repo) para el service de estados financieros.
 *
 * Cubre PR2:
 * - Task 6: Smoke test — breakdownBy=months con rango 3 meses produce 3 columnas (REQ-R3)
 * - Task 7: Backward-compat — sin nuevos params retorna shape legado (columns undefined/vacío)
 *
 * El repo es un mock manual que retorna datos mínimos válidos.
 * No se testean métodos de repo (tienen su propia smoke test de integración DB).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import { FinancialStatementsService } from "../financial-statements.service";
import { FinancialStatementsRepository } from "../financial-statements.repository";
import { ForbiddenError } from "@/features/shared/errors";
import type { MovementAggregation, AccountMetadata } from "../financial-statements.types";

// ── Helpers ──

const D = (v: string | number) => new Prisma.Decimal(v);
const ZERO = D("0");

// Cuenta de ingreso mínima para que los builders no colapsen
const minimalAccounts: AccountMetadata[] = [
  {
    id: "acc-ingreso",
    code: "4.1.01",
    name: "Ventas",
    level: 2,
    subtype: AccountSubtype.INGRESO_OPERATIVO,
    nature: "ACREEDORA",
    isActive: true,
    isContraAccount: false,
  },
];

// Movimiento mínimo (crédito en cuenta acreedora = ingreso positivo)
const minimalMovement: MovementAggregation = {
  accountId: "acc-ingreso",
  totalDebit: ZERO,
  totalCredit: D("1000.00"),
  nature: "ACREEDORA",
  subtype: AccountSubtype.INGRESO_OPERATIVO,
};

// ── Mock del repo ──

function createMockRepo(overrides: Partial<FinancialStatementsRepository> = {}): FinancialStatementsRepository {
  const base = {
    findFiscalPeriod: vi.fn().mockResolvedValue(null),
    findAccountBalances: vi.fn().mockResolvedValue([]),
    findAccountsWithSubtype: vi.fn().mockResolvedValue(minimalAccounts),
    aggregateJournalLinesUpTo: vi.fn().mockResolvedValue([]),
    aggregateJournalLinesInRange: vi.fn().mockResolvedValue([minimalMovement]),
    aggregateJournalLinesUpToBulk: vi.fn().mockImplementation(
      async (_orgId: string, buckets: Array<{ columnId: string; asOfDate: Date }>) => {
        const map = new Map<string, MovementAggregation[]>();
        for (const b of buckets) map.set(b.columnId, []);
        return map;
      },
    ),
    aggregateJournalLinesInRangeBulk: vi.fn().mockImplementation(
      async (_orgId: string, buckets: Array<{ columnId: string; dateFrom: Date; dateTo: Date }>) => {
        const map = new Map<string, MovementAggregation[]>();
        for (const b of buckets) map.set(b.columnId, [minimalMovement]);
        return map;
      },
    ),
    writeImbalanceAuditLog: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return base as unknown as FinancialStatementsRepository;
}

// ── Tests ──

describe("FinancialStatementsService — PR2 smoke tests", () => {
  let service: FinancialStatementsService;
  let mockRepo: FinancialStatementsRepository;

  beforeEach(() => {
    mockRepo = createMockRepo();
    service = new FinancialStatementsService(mockRepo);
  });

  // ── Task 6: Estado de Resultados — breakdownBy=months, rango 3 meses → 3 columnas ──

  describe("generateIncomeStatement con breakdownBy=months", () => {
    it("produce exactamente 3 columnas para un rango de 3 meses completos", async () => {
      const result = await service.generateIncomeStatement("org-1", "owner", {
        dateFrom: new Date("2026-01-01"),
        dateTo: new Date("2026-03-31"),
        breakdownBy: "months",
        compareWith: "none",
      });

      // Debe tener columns poblado con 3 entradas (una por mes)
      expect(result.columns).toBeDefined();
      expect(result.columns!.length).toBe(3);
      expect(result.columns![0].role).toBe("current");
      expect(result.columns![1].role).toBe("current");
      expect(result.columns![2].role).toBe("current");
    });

    it("llama a aggregateJournalLinesInRangeBulk con 3 buckets", async () => {
      await service.generateIncomeStatement("org-1", "owner", {
        dateFrom: new Date("2026-01-01"),
        dateTo: new Date("2026-03-31"),
        breakdownBy: "months",
        compareWith: "none",
      });

      expect(mockRepo.aggregateJournalLinesInRangeBulk).toHaveBeenCalledOnce();
      const [, buckets] = (mockRepo.aggregateJournalLinesInRangeBulk as ReturnType<typeof vi.fn>).mock.calls[0] as [string, Array<{ columnId: string }>];
      expect(buckets.length).toBe(3);
    });
  });

  // ── Task 6: Balance General — breakdownBy=months, rango 2 meses → 2 columnas ──

  describe("generateBalanceSheet con breakdownBy=months", () => {
    it("produce 2 columnas para rango enero-febrero 2026", async () => {
      const result = await service.generateBalanceSheet("org-1", "owner", {
        asOfDate: new Date("2026-02-28"),
        breakdownBy: "months",
        compareWith: "none",
      });

      expect(result.columns).toBeDefined();
      expect(result.columns!.length).toBe(2);
    });

    it("llama a aggregateJournalLinesUpToBulk para BS breakdown", async () => {
      await service.generateBalanceSheet("org-1", "owner", {
        asOfDate: new Date("2026-02-28"),
        breakdownBy: "months",
        compareWith: "none",
      });

      expect(mockRepo.aggregateJournalLinesUpToBulk).toHaveBeenCalledOnce();
    });
  });

  // ── Task 7: Backward-compat — sin nuevos params retorna shape legado ──

  describe("generateIncomeStatement sin nuevos params (backward compat)", () => {
    it("columns tiene exactamente 1 columna con role=current cuando no hay breakdownBy", async () => {
      const result = await service.generateIncomeStatement("org-1", "owner", {
        dateFrom: new Date("2026-01-01"),
        dateTo: new Date("2026-03-31"),
      });

      // columns siempre se puebla; sin breakdownBy = "total" → 1 columna
      expect(result.columns).toBeDefined();
      expect(result.columns!.length).toBe(1);
      expect(result.columns![0].role).toBe("current");
    });

    it("current sigue poblado con el payload legacy", async () => {
      const result = await service.generateIncomeStatement("org-1", "owner", {
        dateFrom: new Date("2026-01-01"),
        dateTo: new Date("2026-03-31"),
      });

      // El campo current debe existir y tener la estructura legacy
      expect(result.current).toBeDefined();
      expect(result.current.netIncome).toBeDefined();
    });
  });

  describe("generateBalanceSheet sin nuevos params (backward compat)", () => {
    it("columns tiene exactamente 1 columna cuando no hay breakdownBy", async () => {
      const result = await service.generateBalanceSheet("org-1", "owner", {
        asOfDate: new Date("2026-03-31"),
      });

      expect(result.columns).toBeDefined();
      expect(result.columns!.length).toBe(1);
      expect(result.columns![0].role).toBe("current");
    });

    it("current sigue poblado con el payload legacy", async () => {
      const result = await service.generateBalanceSheet("org-1", "owner", {
        asOfDate: new Date("2026-03-31"),
      });

      expect(result.current).toBeDefined();
      expect(result.current.assets).toBeDefined();
    });
  });

  // ── Comparative: compareWith=previous_period añade columnas comparative + diff_percent ──

  describe("generateIncomeStatement con compareWith=previous_period", () => {
    it("produce columnas current + comparative + diff_percent", async () => {
      const result = await service.generateIncomeStatement("org-1", "owner", {
        dateFrom: new Date("2026-01-01"),
        dateTo: new Date("2026-03-31"),
        compareWith: "previous_period",
      });

      expect(result.columns).toBeDefined();
      const roles = result.columns!.map((c) => c.role);
      expect(roles).toContain("current");
      expect(roles).toContain("comparative");
      expect(roles).toContain("diff_percent");
    });
  });

  // ── RBAC: rol member es rechazado ──

  describe("RBAC", () => {
    it("lanza ForbiddenError para rol member en generateIncomeStatement", async () => {
      await expect(
        service.generateIncomeStatement("org-1", "member" as never, {
          dateFrom: new Date("2026-01-01"),
          dateTo: new Date("2026-03-31"),
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("lanza ForbiddenError para rol member en generateBalanceSheet", async () => {
      await expect(
        service.generateBalanceSheet("org-1", "member" as never, {
          asOfDate: new Date("2026-03-31"),
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

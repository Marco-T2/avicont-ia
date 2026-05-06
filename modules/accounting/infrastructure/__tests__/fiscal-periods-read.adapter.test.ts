import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetById } = vi.hoisted(() => ({
  mockGetById: vi.fn(),
}));

vi.mock("@/modules/fiscal-periods/presentation/server", () => ({
  makeFiscalPeriodsService: () => ({
    getById: mockGetById,
  }),
}));

import { NotFoundError, PERIOD_NOT_FOUND } from "@/features/shared/errors";

import { FiscalPeriodsReadAdapter } from "../fiscal-periods-read.adapter";

/**
 * Mock-del-colaborador test for FiscalPeriodsReadAdapter (POC #10 C3-C Ciclo 5
 * — Block C). Forma 1 sub-variante c: narrow map (13→2 fields) del retorno
 * legacy con throw pass-through. Body-shape promocionable bajo mismo helper
 * que Ciclos 1 (hydrate) y 2 (narrow + null collapse) — la diferencia
 * null/throw viene del contrato legacy, no del wrapper.
 *
 * Aspirational mock check (`feedback/aspirational_mock_signals_unimplemented_contract`):
 * el legacy `FiscalPeriodsService.getById` está implementado y verificado por
 * sus propios tests (`modules/fiscal-periods/application/__tests__/fiscal-periods.service.test.ts:45-60`).
 * El mock acá testea narrow + pass-through del wrapper accounting, NO el
 * contrato del legacy. NO aspirational.
 */

describe("FiscalPeriodsReadAdapter — narrow 13→2 con throw pass-through", () => {
  beforeEach(() => {
    mockGetById.mockReset();
  });

  it("getById: narrows aggregate to { id, status } and forwards args (orgId, periodId)", async () => {
    mockGetById.mockResolvedValue({
      toSnapshot: () => ({
        id: "p-2026-01",
        organizationId: "org-1",
        name: "Enero 2026",
        year: 2026,
        month: 1,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
        status: "OPEN",
        closedAt: null,
        closedBy: null,
        createdById: "u-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });

    const adapter = new FiscalPeriodsReadAdapter();
    const result = await adapter.getById("org-1", "p-2026-01");

    expect(result).toEqual({ id: "p-2026-01", status: "OPEN" });
    expect(mockGetById).toHaveBeenCalledTimes(1);
    expect(mockGetById).toHaveBeenCalledWith("org-1", "p-2026-01");
  });

  it("getById: propagates legacy throw without re-wrap (same instance)", async () => {
    // Guard contra refactors futuros que introduzcan lógica condicional en el
    // pass-through del throw (try/catch + re-wrap, swallow, o cambio de
    // clase). El failure mode esperado ("adapter swallow / re-wrap / pérdida
    // de code") NO es manifestable en `await legacy.getById(...)` sin código
    // explícito — TypeScript no exige captura, sin sitio donde insertar
    // transform sin diff visible. Paridad Ciclo 3 test 1b + Ciclo 4 test 4b
    // (`feedback/red-acceptance-failure-mode`): el test corre y pasa como
    // guard de propagation literal, NO está con `.skip()`.
    // `.rejects.toBe(legacyError)` (identity, no `.toBeInstanceOf`) lockea
    // que el adapter propaga el MISMO instance del legacy, no una clase
    // distinta con el mismo code.
    const legacyError = new NotFoundError("Período fiscal", PERIOD_NOT_FOUND);
    mockGetById.mockRejectedValue(legacyError);

    const adapter = new FiscalPeriodsReadAdapter();

    await expect(
      adapter.getById("org-1", "p-missing"),
    ).rejects.toBe(legacyError);
    expect(mockGetById).toHaveBeenCalledTimes(1);
    expect(mockGetById).toHaveBeenCalledWith("org-1", "p-missing");
  });
});

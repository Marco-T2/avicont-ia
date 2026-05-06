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

import { LegacyFiscalPeriodsAdapter } from "../legacy-fiscal-periods.adapter";

/**
 * Mock-del-colaborador test for LegacyFiscalPeriodsAdapter (POC #11.0c A3
 * C1 RED Round 1). Mirror precedent payment
 * `modules/payment/infrastructure/adapters/legacy-fiscal-periods.adapter.ts`
 * + accounting unit test pattern
 * `modules/accounting/infrastructure/__tests__/fiscal-periods-read.adapter.test.ts`.
 *
 * Adapter contract (`fiscal-period-reader.port.ts`): narrow snapshot
 * `{ id, status }` desde `FiscalPeriodsService.getById` retorno (13→2 fields)
 * + throw `NotFoundError(PERIOD_NOT_FOUND)` pass-through legacy parity. Es el
 * 3rd own port duplicate (accounting + payment + iva-books) — promote a
 * `modules/shared/domain/ports/` scheduled POC #11.0c A5 reorg E-2.
 *
 * Aspirational mock check (`feedback/aspirational_mock_signal_signals_unimplemented_contract`):
 * el legacy `FiscalPeriodsService.getById` está implementado y verificado por
 * sus propios tests
 * (`modules/fiscal-periods/application/__tests__/fiscal-periods.service.test.ts`).
 * El mock testea narrow + pass-through del wrapper IVA-hex, NO el contrato
 * del legacy. NO aspirational.
 *
 * RED honesty preventivo (`feedback/red-acceptance-failure-mode`): TODOS los
 * `it()` FAIL pre-implementación por module resolution failure
 * (`LegacyFiscalPeriodsAdapter` no existe en `infrastructure/`). Post-GREEN:
 * PASSES cuando el adapter delega a `service.getById(orgId, periodId)` y
 * narrow al shape `IvaFiscalPeriod` `{ id, status }`.
 */

describe("LegacyFiscalPeriodsAdapter — narrow 13→2 con throw pass-through", () => {
  beforeEach(() => {
    mockGetById.mockReset();
  });

  it("getById: narrows aggregate to { id, status } and forwards args (orgId, periodId)", async () => {
    // RED honesty preventivo: FAILS pre-implementación por module resolution
    // failure (`LegacyFiscalPeriodsAdapter` no existe). Post-GREEN: PASSES
    // porque adapter wraps `FiscalPeriodsService.getById` con narrow al
    // shape `IvaFiscalPeriod`. Discriminantes elegidos para detectar
    // mapping cruzado / args swap:
    //   id="p-2026-04", orgId="org-1", status="OPEN".
    // Si el adapter cruzara args (e.g. service.getById(periodId, orgId)),
    // el `toHaveBeenCalledWith` los detectaría intercambiados.
    mockGetById.mockResolvedValue({
      toSnapshot: () => ({
        id: "p-2026-04",
        organizationId: "org-1",
        name: "Abril 2026",
        year: 2026,
        month: 4,
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-04-30"),
        status: "OPEN",
        closedAt: null,
        closedBy: null,
        createdById: "u-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });

    const adapter = new LegacyFiscalPeriodsAdapter();
    const result = await adapter.getById("org-1", "p-2026-04");

    expect(result).toEqual({ id: "p-2026-04", status: "OPEN" });
    expect(mockGetById).toHaveBeenCalledTimes(1);
    expect(mockGetById).toHaveBeenCalledWith("org-1", "p-2026-04");
  });

  it("getById: propagates legacy throw without re-wrap (same instance)", async () => {
    // RED honesty: FAILS pre-implementación por module resolution failure.
    // Post-GREEN: el adapter no captura — el throw del legacy se propaga
    // bit-exact. Guard contra refactors futuros que introduzcan lógica
    // condicional en el pass-through (try/catch + re-wrap, swallow, o
    // cambio de clase). El failure mode esperado ("adapter swallow /
    // re-wrap / pérdida de code") NO es manifestable en
    // `await service.getById(...)` sin código explícito — TypeScript no
    // exige captura, sin sitio donde insertar transform sin diff visible.
    // Paridad accounting precedent test 2 + payment precedent estructural.
    // `.rejects.toBe(legacyError)` (identity, no `.toBeInstanceOf`) lockea
    // que el adapter propaga el MISMO instance del legacy, no una clase
    // distinta con el mismo code.
    const legacyError = new NotFoundError("Período fiscal", PERIOD_NOT_FOUND);
    mockGetById.mockRejectedValue(legacyError);

    const adapter = new LegacyFiscalPeriodsAdapter();

    await expect(
      adapter.getById("org-1", "p-missing"),
    ).rejects.toBe(legacyError);
    expect(mockGetById).toHaveBeenCalledTimes(1);
    expect(mockGetById).toHaveBeenCalledWith("org-1", "p-missing");
  });
});

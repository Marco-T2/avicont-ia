import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetById } = vi.hoisted(() => ({
  mockGetById: vi.fn(),
}));

// Mock hex factory: the adapter source still imports legacy
// `VoucherTypesService` (Cat 3 deferred A5-C2b), but the legacy shim's
// `getById` internally calls `makeVoucherTypesService().getById()` and
// adapts the entity via `toSnapshot()`. Mocking hex intercepts the chain;
// mock value must be entity-like with `.toSnapshot()` so `toLegacyShape`
// produces the legacy POJO shape the adapter narrows.
vi.mock("@/modules/voucher-types/presentation/server", () => ({
  makeVoucherTypesService: () => ({ getById: mockGetById }),
}));

import { NotFoundError } from "@/features/shared/errors";

import { VoucherTypesReadAdapter } from "../voucher-types-read.adapter";

/**
 * Mock-del-colaborador test for VoucherTypesReadAdapter (POC #10 C3-C Ciclo 6
 * — Block C). Forma 1 sub-variante c (paridad exacta Ciclo 5
 * `FiscalPeriodsReadAdapter`): narrow map del retorno legacy con throw
 * pass-through. Narrow extremo 8→1 — el use case
 * (`journals.service.ts:301`) solo verifica existencia, no lee el retorno,
 * así que el port retorna `{ id }` y nada más.
 *
 * Aspirational mock check (`feedback/aspirational_mock_signals_unimplemented_contract`):
 * el legacy `VoucherTypesService.getById` está implementado y verificado por
 * sus propios tests (`modules/voucher-types/application/__tests__/voucher-types.service.test.ts`).
 * El mock acá testea narrow + pass-through del wrapper accounting, NO el
 * contrato del legacy. NO aspirational.
 */

describe("VoucherTypesReadAdapter — narrow 8→1 con throw pass-through", () => {
  beforeEach(() => {
    mockGetById.mockReset();
  });

  it("getById: narrows aggregate to { id } and forwards args (orgId, voucherTypeId)", async () => {
    mockGetById.mockResolvedValue({
      toSnapshot: () => ({
        id: "vt-1",
        organizationId: "org-1",
        code: "FA",
        prefix: "FA-A",
        name: "Factura A",
        description: "Factura tipo A",
        isActive: true,
        isAdjustment: false,
      }),
    });

    const adapter = new VoucherTypesReadAdapter();
    const result = await adapter.getById("org-1", "vt-1");

    expect(result).toEqual({ id: "vt-1" });
    expect(mockGetById).toHaveBeenCalledTimes(1);
    expect(mockGetById).toHaveBeenCalledWith("org-1", "vt-1");
  });

  it("getById: propagates legacy throw without re-wrap (same instance)", async () => {
    // Guard contra refactors futuros que introduzcan lógica condicional en el
    // pass-through del throw (try/catch + re-wrap, swallow, o cambio de
    // clase). El failure mode esperado ("adapter swallow / re-wrap / pérdida
    // de mensaje") NO es manifestable en `await legacy.getById(...)` sin
    // código explícito — TypeScript no exige captura, sin sitio donde
    // insertar transform sin diff visible. Paridad Ciclo 3 test 1b + Ciclo 4
    // test 4b + Ciclo 5 test 5b (`feedback/red-acceptance-failure-mode`): el
    // test corre y pasa como guard de propagation literal, NO está con
    // `.skip()`. `.rejects.toBe(legacyError)` (identity, no
    // `.toBeInstanceOf`) lockea que el adapter propaga el MISMO instance del
    // legacy, no una clase distinta. NotFoundError("Tipo de comprobante")
    // SIN code parameter (distinto Ciclo 5 que tenía PERIOD_NOT_FOUND).
    const legacyError = new NotFoundError("Tipo de comprobante");
    mockGetById.mockRejectedValue(legacyError);

    const adapter = new VoucherTypesReadAdapter();

    await expect(
      adapter.getById("org-1", "vt-missing"),
    ).rejects.toBe(legacyError);
    expect(mockGetById).toHaveBeenCalledTimes(1);
    expect(mockGetById).toHaveBeenCalledWith("org-1", "vt-missing");
  });
});

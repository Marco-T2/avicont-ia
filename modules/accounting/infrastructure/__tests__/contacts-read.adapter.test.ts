import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetActiveById } = vi.hoisted(() => ({
  mockGetActiveById: vi.fn(),
}));

vi.mock("@/modules/contacts/presentation/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/contacts/presentation/server")>();
  return {
    ...actual,
    makeContactsService: vi.fn(() => ({
      getActiveById: mockGetActiveById,
    })),
  };
});

import { ContactInactiveOrMissing } from "@/modules/contacts/presentation/server";

import { ContactsReadAdapter } from "../contacts-read.adapter";

/**
 * Mock-del-colaborador test for ContactsReadAdapter — pass-through con narrow
 * de retorno `Contact -> void`. POC nuevo contacts C2 GREEN cutover dependency
 * legacy shim → hex factory `makeContactsService()` mirror receivables/payables
 * `contacts-existence.adapter.ts` precedent EXACT (constructor DI default
 * factory pattern hex canonical adapter).
 *
 * El hex `ContactsService.getActiveById` (via `makeContactsService()` factory)
 * ya valida active+missing y throwa `ContactInactiveOrMissing` (extends
 * NotFoundError, code CONTACT_NOT_FOUND). El adapter es pass-through con
 * narrow de retorno — el use case journal-entries sólo necesita la aserción
 * de existencia, no la entity.
 *
 * vi.mock pattern post-cutover: factory return shape (NOT class identity
 * preserved Opción A pattern from C1) — `makeContactsService` mocked como
 * factory que retorna service instance con `getActiveById = mockGetActiveById`.
 * `importOriginal` preserva named exports adicionales del barrel
 * (`ContactInactiveOrMissing` importado below).
 *
 * §8.6 evaluado y descartado: la validación isActive NO es regla local del
 * use case journal-entries — vive en `ContactsService.getActiveById` hex y
 * se comparte con cualquier consumer cross-módulo. No hay regla local que
 * aislar, por lo tanto no hay JSDoc lock §8.6 que aplicar al adapter.
 *
 * Aspirational mock check (`feedback/aspirational_mock_signals_unimplemented_contract`):
 * el hex `ContactsService.getActiveById` está implementado y verificado por
 * sus propios tests (`modules/contacts/application/__tests__/`). El mock acá
 * testea pass-through del wrapper accounting, NO el contrato del hex
 * service. NO aspirational.
 */

describe("ContactsReadAdapter — method pass-through con narrow de retorno", () => {
  beforeEach(() => {
    mockGetActiveById.mockReset();
  });

  it("getActiveById: returns void and forwards args (orgId, contactId) when legacy resolves", async () => {
    mockGetActiveById.mockResolvedValue({ id: "c-123", isActive: true });

    const adapter = new ContactsReadAdapter();
    const result = await adapter.getActiveById("org-1", "c-123");

    expect(result).toBeUndefined();
    expect(mockGetActiveById).toHaveBeenCalledTimes(1);
    expect(mockGetActiveById).toHaveBeenCalledWith("org-1", "c-123");
  });

  it("getActiveById: propagates throw without re-wrap (same instance)", async () => {
    // Guard contra refactors futuros que introduzcan lógica condicional en el
    // pass-through (try/catch + re-wrap, swallow, o cambio de clase). El
    // failure mode esperado ("adapter swallow / re-wrap / pérdida de code") NO
    // es manifestable en `await this.contactsService.getActiveById(...)` sin
    // código explícito — TypeScript no exige captura, sin sitio donde insertar
    // transform sin diff visible. Paridad Ciclo 3 test 1b
    // (`feedback/red-acceptance-failure-mode`): el test corre y pasa como guard
    // de propagation literal, NO está con `.skip()`. `.rejects.toBe(thrownError)`
    // (identity, no `.toBeInstanceOf`) lockea que el adapter propaga el MISMO
    // instance del hex service, no una clase distinta con el mismo code.
    const thrownError = new ContactInactiveOrMissing();
    mockGetActiveById.mockRejectedValue(thrownError);

    const adapter = new ContactsReadAdapter();

    await expect(
      adapter.getActiveById("org-1", "c-missing"),
    ).rejects.toBe(thrownError);
    expect(mockGetActiveById).toHaveBeenCalledTimes(1);
    expect(mockGetActiveById).toHaveBeenCalledWith("org-1", "c-missing");
  });
});

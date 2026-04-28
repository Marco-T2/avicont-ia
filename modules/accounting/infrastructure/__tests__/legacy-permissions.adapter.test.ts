import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/permissions/server", () => ({
  canPost: vi.fn(),
}));

import { canPost as legacyCanPost } from "@/features/permissions/server";

import { LegacyPermissionsAdapter } from "../legacy-permissions.adapter";

/**
 * Mock-del-colaborador test for LegacyPermissionsAdapter (POC #10 C3-C
 * Ciclo 3 — Block B). Forma estructural: function pass-through (vs Block A
 * class+hydration form). Tests verifican que el adapter delega los args
 * tal cual al legacy `canPost` y devuelve el boolean sin transformación.
 *
 * NO integration contra Postgres: el legacy `canPost` lee cache que lee
 * Prisma — testear en integration requiere seedear matriz, overhead
 * injustificado para pass-through. Lo que se valida es el wiring del
 * wrapper, NO el contrato del legacy (verificado por
 * `features/permissions/__tests__/permissions.test.ts`).
 *
 * Aspirational mock check (`feedback/aspirational_mock_signals_unimplemented_contract`):
 * el legacy `canPost` está implementado y verificado por sus propios tests.
 * El mock acá testea pass-through del wrapper, no el contrato del legacy.
 * NO aspirational.
 */

const mockedCanPost = vi.mocked(legacyCanPost);

describe("LegacyPermissionsAdapter — function pass-through", () => {
  beforeEach(() => {
    mockedCanPost.mockReset();
  });

  it("canPost: returns true and forwards args (role, scope, organizationId) when legacy resolves true", async () => {
    mockedCanPost.mockResolvedValue(true);

    const adapter = new LegacyPermissionsAdapter();
    const result = await adapter.canPost("admin", "journal", "org-123");

    expect(result).toBe(true);
    expect(mockedCanPost).toHaveBeenCalledTimes(1);
    expect(mockedCanPost).toHaveBeenCalledWith("admin", "journal", "org-123");
  });

  it("canPost: returns false (no swallowing) when legacy resolves false", async () => {
    // Guard contra refactors futuros que introduzcan lógica condicional en el
    // pass-through (ej: "swallow false on missing role" o "throw en vez de
    // return false"). Mismo patrón Ciclo 1 test 1b / Ciclo 2 test 2b
    // (`feedback/red-acceptance-failure-mode`): el failure mode esperado
    // ("adapter swallows o transforma el boolean") NO es manifestable —
    // adapter es `return legacyCanPost(...)`, single return statement,
    // TypeScript exige el boolean. Sin sitio donde insertar swallow o
    // transform sin código explícito. El test corre y pasa como guard del
    // contrato pass-through, NO está con `.skip()`.
    mockedCanPost.mockResolvedValue(false);

    const adapter = new LegacyPermissionsAdapter();
    const result = await adapter.canPost("viewer", "journal", "org-456");

    expect(result).toBe(false);
    expect(mockedCanPost).toHaveBeenCalledTimes(1);
    expect(mockedCanPost).toHaveBeenCalledWith("viewer", "journal", "org-456");
  });
});

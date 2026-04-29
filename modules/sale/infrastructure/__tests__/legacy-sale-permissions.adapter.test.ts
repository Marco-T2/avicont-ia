import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/permissions/server", () => ({
  canPost: vi.fn(),
}));

import { canPost as legacyCanPost } from "@/features/permissions/server";

import { LegacySalePermissionsAdapter } from "../legacy-sale-permissions.adapter";

/**
 * Mock-del-colaborador test for `LegacySalePermissionsAdapter` (POC #11.0a A3
 * Ciclo 1 — Block B). Estructuralmente idéntico a `LegacyPermissionsAdapter`
 * (POC #10 C3-C Ciclo 3): forma function pass-through (vs Block A
 * class+hydration). Sale-hex declara port propio `SalePermissionsPort` por
 * §11.1 STICK lockeado Step 0 A2 (2 consumers known, no promote).
 *
 * NO integration contra Postgres: el legacy `canPost` lee cache que lee
 * Prisma — testear en integration requiere seedear matriz de roles + custom
 * roles + cache eviction, overhead injustificado para pass-through. Lo que se
 * valida acá es el wiring del wrapper, NO el contrato del legacy (verificado
 * por `features/permissions/__tests__/permissions.test.ts`).
 *
 * Aspirational mock check (`feedback/aspirational_mock_signals_unimplemented_contract`):
 * el legacy `canPost` está implementado y verificado por sus propios tests.
 * El mock acá testea pass-through del wrapper, no el contrato del legacy.
 * NO aspirational.
 *
 * RED acceptance failure mode (`feedback/red-acceptance-failure-mode`): el
 * failure mode esperado ("adapter swallows o transforma el boolean") NO es
 * manifestable — adapter es `return legacyCanPost(...)`, single return
 * statement, TypeScript exige el boolean. Sin sitio donde insertar swallow o
 * transform sin código explícito. Los 2 tests corren y pasan como guards del
 * contrato pass-through (NO `.skip()`).
 */

const mockedCanPost = vi.mocked(legacyCanPost);

describe("LegacySalePermissionsAdapter — function pass-through", () => {
  beforeEach(() => {
    mockedCanPost.mockReset();
  });

  it("canPost: returns true and forwards args (role, scope, organizationId) when legacy resolves true", async () => {
    mockedCanPost.mockResolvedValue(true);

    const adapter = new LegacySalePermissionsAdapter();
    const result = await adapter.canPost("admin", "sales", "org-123");

    expect(result).toBe(true);
    expect(mockedCanPost).toHaveBeenCalledTimes(1);
    expect(mockedCanPost).toHaveBeenCalledWith("admin", "sales", "org-123");
  });

  it("canPost: returns false (no swallowing) when legacy resolves false", async () => {
    mockedCanPost.mockResolvedValue(false);

    const adapter = new LegacySalePermissionsAdapter();
    const result = await adapter.canPost("viewer", "sales", "org-456");

    expect(result).toBe(false);
    expect(mockedCanPost).toHaveBeenCalledTimes(1);
    expect(mockedCanPost).toHaveBeenCalledWith("viewer", "sales", "org-456");
  });
});

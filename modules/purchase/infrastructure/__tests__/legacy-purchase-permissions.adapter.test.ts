import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/permissions/server", () => ({
  canPost: vi.fn(),
}));

import { canPost as legacyCanPost } from "@/features/permissions/server";

import { LegacyPurchasePermissionsAdapter } from "../legacy-purchase-permissions.adapter";

/**
 * Mock-del-colaborador test for `LegacyPurchasePermissionsAdapter` (POC #11.0b
 * A3 Ciclo 1 — Block B). Mirror exact `LegacySalePermissionsAdapter` test
 * (POC #11.0a A3 Ciclo 1) — function pass-through, no Block A class+hydration.
 *
 * NO integration contra Postgres: legacy `canPost` lee cache que lee Prisma;
 * contrato verificado por `features/permissions/__tests__/permissions.test.ts`.
 *
 * RED acceptance failure mode: pre-adapter el import al adapter inexistente
 * resuelve módulo no encontrado → ambos tests fallan en resolución, NO en
 * aserción. Ese ES el RED honesto declarado upfront.
 */

const mockedCanPost = vi.mocked(legacyCanPost);

describe("LegacyPurchasePermissionsAdapter — function pass-through", () => {
  beforeEach(() => {
    mockedCanPost.mockReset();
  });

  it("canPost: returns true and forwards args (role, scope, organizationId) when legacy resolves true", async () => {
    mockedCanPost.mockResolvedValue(true);

    const adapter = new LegacyPurchasePermissionsAdapter();
    const result = await adapter.canPost("admin", "purchases", "org-123");

    expect(result).toBe(true);
    expect(mockedCanPost).toHaveBeenCalledTimes(1);
    expect(mockedCanPost).toHaveBeenCalledWith("admin", "purchases", "org-123");
  });

  it("canPost: returns false (no swallowing) when legacy resolves false", async () => {
    mockedCanPost.mockResolvedValue(false);

    const adapter = new LegacyPurchasePermissionsAdapter();
    const result = await adapter.canPost("viewer", "purchases", "org-456");

    expect(result).toBe(false);
    expect(mockedCanPost).toHaveBeenCalledTimes(1);
    expect(mockedCanPost).toHaveBeenCalledWith("viewer", "purchases", "org-456");
  });
});

/**
 * Fase B (app móvil): `requireAuth` debe aceptar el session token de Clerk por
 * el header `Authorization: Bearer <jwt>` cuando no hay sesión por cookie, sin
 * romper el flujo web (cookie) existente. Normaliza el retorno a
 * { userId, orgId, viaBearer } — verificado: ningún llamador usa otros campos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockVerifyToken, mockHeadersGet } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockVerifyToken: vi.fn(),
  mockHeadersGet: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
  verifyToken: mockVerifyToken,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: mockHeadersGet })),
}));

import { requireAuth } from "../middleware";
import { UnauthorizedError } from "@/modules/shared/domain/errors";

beforeEach(() => {
  vi.clearAllMocks();
  mockHeadersGet.mockReturnValue(null);
  process.env.CLERK_SECRET_KEY = "sk_test_dummy";
});

describe("requireAuth — sesión por cookie (web)", () => {
  it("devuelve userId+orgId de auth() con viaBearer=false y no toca el header", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", orgId: "o1" });

    const r = await requireAuth();

    expect(r).toEqual({ userId: "u1", orgId: "o1", viaBearer: false });
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it("orgId null cuando la sesión web no tiene org activa", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", orgId: null });

    const r = await requireAuth();

    expect(r).toEqual({ userId: "u1", orgId: null, viaBearer: false });
  });
});

describe("requireAuth — fallback Bearer (app móvil)", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ userId: null });
  });

  it("verifica el JWT del header y devuelve userId+orgId con viaBearer=true", async () => {
    mockHeadersGet.mockReturnValue("Bearer tok123");
    mockVerifyToken.mockResolvedValue({ sub: "u2", org_id: "o2" });

    const r = await requireAuth();

    expect(mockVerifyToken).toHaveBeenCalledWith(
      "tok123",
      expect.objectContaining({ secretKey: "sk_test_dummy" }),
    );
    expect(r).toEqual({ userId: "u2", orgId: "o2", viaBearer: true });
  });

  it("orgId null cuando el JWT no trae claim de organización (caso F2: org diferida)", async () => {
    mockHeadersGet.mockReturnValue("Bearer tok123");
    mockVerifyToken.mockResolvedValue({ sub: "u3" });

    const r = await requireAuth();

    expect(r).toEqual({ userId: "u3", orgId: null, viaBearer: true });
  });

  it("401 si no hay sesión por cookie ni header Bearer", async () => {
    mockHeadersGet.mockReturnValue(null);

    await expect(requireAuth()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it("401 si el token Bearer es inválido (verifyToken lanza)", async () => {
    mockHeadersGet.mockReturnValue("Bearer bad");
    mockVerifyToken.mockRejectedValue(new Error("invalid token"));

    await expect(requireAuth()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

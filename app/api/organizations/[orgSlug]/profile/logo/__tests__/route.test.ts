/**
 * T5.3 — Route tests for POST /api/organizations/[orgSlug]/profile/logo.
 *
 * Strategy: mock @vercel/blob (`put`) + middleware + OrgProfileService.
 *
 * Covers:
 *   - REQ-OP.3 validate MIME + size BEFORE calling put()
 *   - REQ-OP.3 on success: swap logoUrl + best-effort blob delete
 *   - REQ-OP.6 admin-only including exact-args assertion (W-2)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePermission = vi.fn();

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/shared/middleware", () => ({
  requireAuth: vi.fn(),
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
  handleError: vi.fn((err: unknown) => {
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; code?: string; statusCode: number };
      return Response.json(
        { error: e.message, code: e.code },
        { status: e.statusCode },
      );
    }
    return Response.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }),
}));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
}));

const mockServiceInstance = {
  updateLogo: vi.fn(),
};

vi.mock("@/features/org-profile", async () => {
  const actual = await vi.importActual<typeof import("@/features/org-profile")>(
    "@/features/org-profile",
  );
  return {
    ...actual,
    OrgProfileService: vi.fn().mockImplementation(function () {
      return mockServiceInstance;
    }),
  };
});

import { put } from "@vercel/blob";
import {
  requireAuth,
  requireOrgAccess,
  requireRole,
} from "@/features/shared/middleware";
import { ForbiddenError } from "@/features/shared/errors";

const ORG_SLUG = "test-org";
const ORG_ID = "org-test-id";
const USER_ID = "user-test-id";
const UPLOADED_URL = "https://blob.example.com/org-test-id/logo.png";

function makeFormData(file: File) {
  const form = new FormData();
  form.append("file", file);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();

  mockRequirePermission.mockResolvedValue({ orgId: ORG_ID });

  vi.mocked(requireAuth).mockResolvedValue({
    userId: USER_ID,
  } as Awaited<ReturnType<typeof requireAuth>>);
  vi.mocked(requireOrgAccess).mockResolvedValue(ORG_ID);
  vi.mocked(requireRole).mockResolvedValue({
    role: "admin",
  } as Awaited<ReturnType<typeof requireRole>>);

  vi.mocked(put).mockResolvedValue({
    url: UPLOADED_URL,
    downloadUrl: UPLOADED_URL,
    pathname: "org-test-id/logo.png",
    contentType: "image/png",
    contentDisposition: "inline",
  } as Awaited<ReturnType<typeof put>>);

  mockServiceInstance.updateLogo.mockResolvedValue({
    id: "p-1",
    organizationId: ORG_ID,
    logoUrl: UPLOADED_URL,
  });
});

describe("POST /api/organizations/[orgSlug]/profile/logo", () => {
  it("retorna 200 con { url } al subir un PNG válido", async () => {
    const file = new File(["abc"], "logo.png", { type: "image/png" });
    const form = makeFormData(file);

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile/logo`,
      { method: "POST", body: form },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe(UPLOADED_URL);
    expect(put).toHaveBeenCalled();
    expect(mockServiceInstance.updateLogo).toHaveBeenCalledWith(
      ORG_ID,
      UPLOADED_URL,
    );
  });

  it("retorna 400 cuando el MIME no es permitido (application/pdf)", async () => {
    const file = new File(["pdfdata"], "logo.pdf", {
      type: "application/pdf",
    });
    const form = makeFormData(file);

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile/logo`,
      { method: "POST", body: form },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
    expect(mockServiceInstance.updateLogo).not.toHaveBeenCalled();
  });

  it("retorna 400 cuando el archivo supera 2 MB", async () => {
    // Crear un archivo de 2MB + 1 byte
    const oversize = new Uint8Array(2 * 1024 * 1024 + 1);
    const file = new File([oversize], "big.png", { type: "image/png" });
    const form = makeFormData(file);

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile/logo`,
      { method: "POST", body: form },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
    expect(mockServiceInstance.updateLogo).not.toHaveBeenCalled();
  });

  it("retorna 400 cuando no se envía archivo", async () => {
    const form = new FormData();

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile/logo`,
      { method: "POST", body: form },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it("retorna 403 cuando requirePermission falla (non-admin)", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError());

    const file = new File(["abc"], "logo.png", { type: "image/png" });
    const form = makeFormData(file);

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile/logo`,
      { method: "POST", body: form },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(403);
    expect(put).not.toHaveBeenCalled();
    expect(mockServiceInstance.updateLogo).not.toHaveBeenCalled();
  });

  it("acepta image/jpeg, image/webp e image/svg+xml", async () => {
    const mimes = ["image/jpeg", "image/webp", "image/svg+xml"];
    for (const mime of mimes) {
      vi.clearAllMocks();
      mockRequirePermission.mockResolvedValue({ orgId: ORG_ID });
      vi.mocked(requireAuth).mockResolvedValue({
        userId: USER_ID,
      } as Awaited<ReturnType<typeof requireAuth>>);
      vi.mocked(requireOrgAccess).mockResolvedValue(ORG_ID);
      vi.mocked(requireRole).mockResolvedValue({
        role: "admin",
      } as Awaited<ReturnType<typeof requireRole>>);
      vi.mocked(put).mockResolvedValue({
        url: UPLOADED_URL,
      } as Awaited<ReturnType<typeof put>>);
      mockServiceInstance.updateLogo.mockResolvedValue({ logoUrl: UPLOADED_URL });

      const ext = mime.split("/")[1];
      const file = new File(["x"], `logo.${ext}`, { type: mime });
      const form = makeFormData(file);

      const { POST } = await import("../route");
      const request = new Request(
        `http://localhost/api/organizations/${ORG_SLUG}/profile/logo`,
        { method: "POST", body: form },
      );
      const res = await POST(request, {
        params: Promise.resolve({ orgSlug: ORG_SLUG }),
      });

      expect(res.status, `MIME ${mime} debería ser aceptado`).toBe(200);
    }
  });
});

// ── Permission key assertions (W-2) ──────────────────────────────────────────

describe("requirePermission args — profile/logo route", () => {
  it("POST calls requirePermission('accounting-config', 'write', orgSlug)", async () => {
    const file = new File(["abc"], "logo.png", { type: "image/png" });
    const form = makeFormData(file);

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile/logo`,
      { method: "POST", body: form },
    );
    await POST(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "accounting-config",
      "write",
      ORG_SLUG,
    );
  });
});

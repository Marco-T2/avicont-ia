/**
 * pago-credit-system Phase 5 (task 5.1/5.2) RED → GREEN —
 * POST /api/organizations/[orgSlug]/payments/apply-credits.
 *
 * Covers the generalized credit-target XOR at the Zod `.refine` edge:
 *   POST 200  — creditSources[].payableId set, receivableId absent (PAGO credit)
 *   POST 200  — creditSources[].receivableId set, payableId absent (COBRO, backward-compat)
 *   POST 400  — both receivableId AND payableId set    (XOR violation → ZodError)
 *   POST 400  — neither receivableId NOR payableId set  (XOR violation → ZodError)
 *
 * The XOR rejection lives purely at the Zod schema (mirrors `allocationInputSchema`
 * in modules/payment/presentation/validation.ts:14). The custom issue carries
 * `params.code = PAYMENT_CREDIT_INVALID_TARGET`. A failed refine surfaces as a
 * ZodError → handleError maps it to HTTP 400 (http-error-serializer.ts:6).
 *
 * Expected RED failure (pre-GREEN): the inline `applyCreditSchema` in ../route.ts
 * requires `receivableId: z.string().min(1)` UNCONDITIONALLY. The payable-only
 * body therefore fails Zod parse → 400 instead of the expected 200. That single
 * assertion (`(a) PAGO payable credit → 200`) is the discriminating RED. The
 * both/neither cases ALSO return 400 today (receivableId missing), so they pass
 * trivially pre-GREEN — they are kept to lock the post-GREEN XOR behavior.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks (hoisted before route import) ─────────────────────────────

vi.mock("@/modules/shared/presentation/middleware", () => ({
  handleError: vi.fn((err: unknown) => {
    if (
      err != null &&
      typeof err === "object" &&
      "flatten" in err &&
      typeof (err as Record<string, unknown>).flatten === "function"
    ) {
      return Response.json(
        { error: "Datos inválidos", details: (err as { flatten: () => unknown }).flatten() },
        { status: 400 },
      );
    }
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; code?: string; statusCode: number };
      return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }),
}));

vi.mock("@/modules/permissions/application/server", () => ({
  requirePermission: vi.fn(),
}));

const mockPaymentServiceInstance = vi.hoisted(() => ({
  applyCreditOnly: vi.fn(),
}));

vi.mock("@/modules/payment/presentation/server", () => ({
  PaymentService: class {
    applyCreditOnly = mockPaymentServiceInstance.applyCreditOnly;
  },
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { requirePermission } from "@/modules/permissions/application/server";

// ─── Constants ───────────────────────────────────────────────────────────────

const ORG_SLUG = "acme";
const ORG_ID = "org_acme_id";
const CLERK_USER_ID = "user_clerk_id";
const CONTACT_ID = "contact_1";
const SOURCE_PAYMENT_ID = "pay_source_1";

function postBody(creditSources: unknown[]) {
  return new Request(
    `http://localhost/api/organizations/${ORG_SLUG}/payments/apply-credits`,
    {
      method: "POST",
      body: JSON.stringify({ contactId: CONTACT_ID, creditSources }),
    },
  );
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue({
    session: { userId: CLERK_USER_ID },
    orgId: ORG_ID,
    role: "admin",
  } as Awaited<ReturnType<typeof requirePermission>>);
  mockPaymentServiceInstance.applyCreditOnly.mockResolvedValue({
    correlationId: "corr_1",
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/organizations/[orgSlug]/payments/apply-credits — credit-target XOR", () => {
  it("(a) accepts a PAGO payable-credit source (payableId set, receivableId absent) → 200", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      postBody([
        { sourcePaymentId: SOURCE_PAYMENT_ID, payableId: "payable_1", amount: 50 },
      ]),
      { params: Promise.resolve({ orgSlug: ORG_SLUG }) },
    );

    expect(res.status).toBe(200);
    expect(mockPaymentServiceInstance.applyCreditOnly).toHaveBeenCalledWith(
      ORG_ID,
      CLERK_USER_ID,
      CONTACT_ID,
      [{ sourcePaymentId: SOURCE_PAYMENT_ID, payableId: "payable_1", amount: 50 }],
    );
  });

  it("(b) accepts a COBRO receivable-credit source (receivableId set) → 200 (backward-compat)", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      postBody([
        { sourcePaymentId: SOURCE_PAYMENT_ID, receivableId: "recv_1", amount: 30 },
      ]),
      { params: Promise.resolve({ orgSlug: ORG_SLUG }) },
    );

    expect(res.status).toBe(200);
    expect(mockPaymentServiceInstance.applyCreditOnly).toHaveBeenCalledWith(
      ORG_ID,
      CLERK_USER_ID,
      CONTACT_ID,
      [{ sourcePaymentId: SOURCE_PAYMENT_ID, receivableId: "recv_1", amount: 30 }],
    );
  });

  it("(c) rejects a source with BOTH receivableId and payableId set → 400, service not called", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      postBody([
        {
          sourcePaymentId: SOURCE_PAYMENT_ID,
          receivableId: "recv_1",
          payableId: "payable_1",
          amount: 20,
        },
      ]),
      { params: Promise.resolve({ orgSlug: ORG_SLUG }) },
    );

    expect(res.status).toBe(400);
    expect(mockPaymentServiceInstance.applyCreditOnly).not.toHaveBeenCalled();
  });

  it("(d) rejects a source with NEITHER receivableId nor payableId → 400, service not called", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      postBody([{ sourcePaymentId: SOURCE_PAYMENT_ID, amount: 10 }]),
      { params: Promise.resolve({ orgSlug: ORG_SLUG }) },
    );

    expect(res.status).toBe(400);
    expect(mockPaymentServiceInstance.applyCreditOnly).not.toHaveBeenCalled();
  });
});

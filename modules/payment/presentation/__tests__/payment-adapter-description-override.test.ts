/**
 * W-1 fix: payment-service.adapter.createAndPost was dropping
 * `input.descriptionOverride` on the floor — the inner service received
 * `options = {}` (default) and the builder gate (payments.service.ts:733)
 * never fired. Marco hit this in production: a COBRO posted via Guardar
 * y Contabilizar emitted "COBRO EFECTIVO: Marco Bs. 250,00" (form
 * header-only preview) instead of enumerating the two VG-XX allocations.
 *
 * Declared RED failure mode: the spy captures inner.createAndPost call
 * arguments; pre-fix the 4th positional argument (options) is `undefined`.
 * Assertion `expect(opts).toEqual({ descriptionOverride: false })` fails
 * with "undefined" vs the expected object literal.
 */
import { describe, expect, it, vi } from "vitest";
import { PaymentService } from "../payment-service.adapter";
import type { CreatePaymentInput } from "../dto/payment-input-types";

describe("PaymentService adapter.createAndPost — descriptionOverride propagation (W-1 fix)", () => {
  function makeInput(
    descriptionOverride: boolean | undefined,
  ): CreatePaymentInput {
    return {
      method: "EFECTIVO",
      date: new Date("2026-05-17"),
      amount: 250,
      direction: "COBRO",
      description: "preview header-only from form",
      periodId: "period-1",
      contactId: "c-1",
      allocations: [
        { receivableId: "ar-1", amount: 150 },
        { receivableId: "ar-2", amount: 100 },
      ],
      createdById: "user-1",
      descriptionOverride,
    };
  }

  function spyAdapter(
    innerOverrides: Partial<{
      createAndPost: ReturnType<typeof vi.fn>;
    }> = {},
  ): { adapter: PaymentService; createAndPostSpy: ReturnType<typeof vi.fn> } {
    const createAndPostSpy =
      innerOverrides.createAndPost ??
      vi.fn().mockResolvedValue({
        payment: { id: "payment-1" },
        correlationId: "corr-1",
      });

    const adapter = new PaymentService();
    // Inject a spy as `inner` + a no-op `readById` to short-circuit the post-
    // call DB lookup. `readById` lives on the adapter instance itself.
    (adapter as unknown as { inner: { createAndPost: typeof createAndPostSpy } }).inner = {
      createAndPost: createAndPostSpy,
    };
    (adapter as unknown as { readById: (orgId: string, id: string) => Promise<unknown> }).readById = vi
      .fn()
      .mockResolvedValue({ id: "payment-1" });

    return { adapter, createAndPostSpy };
  }

  it("propagates descriptionOverride=false to inner.createAndPost as 4th positional arg", async () => {
    const { adapter, createAndPostSpy } = spyAdapter();

    await adapter.createAndPost("org-1", makeInput(false), "user-1");

    expect(createAndPostSpy).toHaveBeenCalledTimes(1);
    const callArgs = createAndPostSpy.mock.calls[0]!;
    expect(callArgs[0]).toBe("org-1");
    expect(callArgs[1]).toBe("user-1");
    expect(callArgs[3]).toEqual({ descriptionOverride: false });
  });

  it("propagates descriptionOverride=true to inner.createAndPost", async () => {
    const { adapter, createAndPostSpy } = spyAdapter();

    await adapter.createAndPost("org-1", makeInput(true), "user-1");

    expect(createAndPostSpy.mock.calls[0]![3]).toEqual({
      descriptionOverride: true,
    });
  });

  it("propagates undefined descriptionOverride (legacy callers preserved)", async () => {
    const { adapter, createAndPostSpy } = spyAdapter();

    await adapter.createAndPost("org-1", makeInput(undefined), "user-1");

    expect(createAndPostSpy.mock.calls[0]![3]).toEqual({
      descriptionOverride: undefined,
    });
  });
});

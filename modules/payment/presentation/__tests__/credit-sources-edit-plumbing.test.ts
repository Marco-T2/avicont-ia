/**
 * Phase 5 (REQ-PAY-3b) — 4-layer creditSources plumbing on the EDIT path.
 *
 * L4 (UpdatePaymentServiceInput.creditSources + edit-path consumption) landed in
 * Phase 4 (commit b9625ecd). This slice wires the three HTTP-facing layers that
 * still DROP the field on a PATCH edit:
 *
 *   L1 Zod  — `updatePaymentSchema` (validation.ts) did NOT declare creditSources,
 *             so Zod silently STRIPPED it from the parsed PATCH body
 *             (discovery #3022: createPaymentSchema:35 declares it, the update
 *             schema did not).
 *   L2 DTO  — `UpdatePaymentInput` (presentation/dto/payment-input-types.ts) had
 *             no creditSources field, so even a hand-built input could not carry it
 *             through the typed boundary.
 *   L3 Adapter — `PaymentService.update()` (payment-service.adapter.ts:165-175)
 *             maps fields explicitly into the inner service input and OMITTED
 *             creditSources, dropping it before it reached the application layer.
 *
 * This is a BEHAVIORAL end-to-end plumbing test (stronger than the c0-style
 * source-string shape checks): it exercises the real Zod parse → real adapter
 * mapping → spy inner service, and asserts the creditSources payload SURVIVES the
 * whole chain unchanged (Scenario G-plumbing). A fake reader + spy inner are
 * injected via the adapter constructor seam (reader?, inner?) — no Prisma, no DB.
 *
 * Expected RED failure mode pre-GREEN (feedback_red_acceptance_failure_mode):
 *   - L1 assertion FAILS: `updatePaymentSchema.parse(body).creditSources` is
 *     `undefined` (Zod strips the undeclared key) instead of the payload array.
 *   - L3/end-to-end assertion FAILS: `spyInner.update` is called WITHOUT
 *     creditSources in its input arg (adapter never maps it). The DTO type gap
 *     (L2) surfaces as a compile error once the test threads creditSources through
 *     the typed `UpdatePaymentInput` — resolved in the same GREEN slice.
 *
 * Cross-ref:
 *   - sdd/pagos-cobros-fifo/spec — REQ-PAY-3b, Scenario G-plumbing
 *   - sdd/pagos-cobros-fifo/design §4 (4-layer creditSources plumbing)
 *   - discovery #3022 (edit ignores credit at TWO layers: Zod strips + service
 *     does not read; here we close the HTTP-facing layers)
 */
import { describe, it, expect, vi } from "vitest";
import { updatePaymentSchema } from "../validation";
import { PaymentService } from "../payment-service.adapter";
import type { UpdatePaymentInput } from "../dto/payment-input-types";
import type { PaymentWithRelationsReaderPort } from "../../domain/ports/payment-with-relations-reader.port";
import type { PaymentsService } from "../../application/payments.service";

const ORG = "org-1";
const PAYMENT_ID = "pay-1";

function makeFakeReader(): PaymentWithRelationsReaderPort {
  const snapshot = {
    id: PAYMENT_ID,
    organizationId: ORG,
    amount: 2762,
    allocations: [],
  };
  return {
    findAllWithRelations: vi.fn().mockResolvedValue([snapshot]),
    findPaginatedWithRelations: vi
      .fn()
      .mockResolvedValue({ items: [snapshot], total: 1, page: 1, pageSize: 10 }),
    findByIdWithRelations: vi.fn().mockResolvedValue(snapshot),
  };
}

function makeSpyInner() {
  const update = vi.fn().mockResolvedValue({
    payment: { id: PAYMENT_ID },
    correlationId: "corr-1",
  });
  // Only `update` is exercised by this test; cast the partial spy to the inner
  // service type for the adapter constructor seam.
  return { update } as unknown as PaymentsService & {
    update: ReturnType<typeof vi.fn>;
  };
}

describe("Phase 5 — creditSources 4-layer plumbing on EDIT (REQ-PAY-3b, Scenario G-plumbing)", () => {
  it("L1 Zod: updatePaymentSchema RETAINS creditSources from the PATCH body (not stripped)", () => {
    const body = {
      allocations: [{ receivableId: "r-1", amount: 1530 }],
      creditSources: [
        { sourcePaymentId: "src-1", receivableId: "r-2", amount: 1232 },
      ],
    };

    const parsed = updatePaymentSchema.parse(body);

    expect(parsed.creditSources).toEqual([
      { sourcePaymentId: "src-1", receivableId: "r-2", amount: 1232 },
    ]);
  });

  it("L1 Zod: omitted creditSources parses to undefined (optional, no false default)", () => {
    const parsed = updatePaymentSchema.parse({
      allocations: [{ receivableId: "r-1", amount: 1530 }],
    });
    expect(parsed.creditSources).toBeUndefined();
  });

  it("L2+L3 end-to-end: a PATCH creditSources payload survives Zod → DTO → adapter → inner service.update()", async () => {
    const body = {
      allocations: [{ receivableId: "r-1", amount: 1530 }],
      creditSources: [
        { sourcePaymentId: "src-1", receivableId: "r-2", amount: 1232 },
      ],
    };

    // L1: real Zod parse (mirrors the route handler at
    // app/api/.../payments/[paymentId]/route.ts:39).
    const parsed = updatePaymentSchema.parse(body);

    // L2: thread the parsed result through the typed presentation DTO. If
    // UpdatePaymentInput lacks creditSources, this line fails to type-check.
    const input: UpdatePaymentInput = parsed;

    const spyInner = makeSpyInner();
    const adapter = new PaymentService(makeFakeReader(), spyInner);

    // L3: real adapter mapping into the inner service input.
    await adapter.update(ORG, PAYMENT_ID, input, "ADMIN", "edit note", "user-1");

    expect(spyInner.update).toHaveBeenCalledTimes(1);
    const innerInput = spyInner.update.mock.calls[0][3];
    expect(innerInput.creditSources).toEqual([
      { sourcePaymentId: "src-1", receivableId: "r-2", amount: 1232 },
    ]);
  });
});

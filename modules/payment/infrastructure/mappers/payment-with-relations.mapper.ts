import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import type { PaymentWithRelations } from "@/modules/payment/presentation/dto/payment-with-relations";

/**
 * Payment-with-relations mapper — infrastructure layer canonical home (POC
 * nuevo payment C4-α GREEN MOVE presentation→infrastructure, atomic JSDoc
 * revoke same edit per `feedback_jsdoc_atomic_revoke` discipline).
 *
 * Bridges Prisma `payment.findMany/findFirst({ include: paymentInclude })`
 * rows a hex local `PaymentWithRelations` DTO. Pure transformation function
 * row → DTO, data-access concern (Prisma include shape + row→DTO assembly)
 * — infrastructure layer canonical home post-MOVE drop reverse smell + DRY
 * violation cumulative.
 *
 * Decimal → number coerción semantic preservation (legacy consumer wire
 * contract):
 *   - amount: Prisma `Decimal` → POJO `number`
 *   - allocations[].amount: Prisma `Decimal` → POJO `number`
 *
 * §13 NEW classification cementación target D1 sub-pattern emergent:
 * paymentInclude + mapper move from presentation/ → infrastructure/ when
 * Prisma include shape + row→DTO assembly conceptual data-access concern
 * (NOT presentation/dto territory). Forward-applicable cualquier feature con
 * mapper Prisma include + DTO assembly.
 *
 * Cross-ref:
 *   - modules/payment/presentation/dto/payment-with-relations.ts (DTO contract
 *     stays in presentation/dto — DTO is presentation territory)
 *   - modules/payment/infrastructure/adapters/payment-with-relations.reader.adapter.ts
 *     (consumer reader port adapter — Prisma queries + this mapper invocation)
 *   - features/payment/payment.service.ts (legacy shim consumer post-MOVE
 *     transitorio cascade — full removal C4-β wholesale)
 *   - architecture.md §13 NEW classification "Adapter Layer presentation/
 *     delegate via reader port + composition-root chain canonical R4 exception
 *     path EXACT mirror α-A3.B" cementación target D1 doc-only
 */

// ── Prisma include shape: payment query con relations ─────────────────────────

export const paymentInclude = {
  contact: true,
  period: true,
  journalEntry: true,
  operationalDocType: { select: { id: true, code: true, name: true } },
  allocations: {
    include: {
      receivable: { include: { contact: true } },
      payable: { include: { contact: true } },
    },
  },
} as const satisfies Prisma.PaymentInclude;

// ── Mapper: Prisma row → PaymentWithRelations DTO ─────────────────────────────
//
// Pure transformation function row → DTO. Convierte Prisma `amount: Decimal` a
// POJO `amount: number` (EXACT semantic preservation pre-extract per legacy
// consumer wire contract). Allocations nested `amount: Decimal` también convertidos.

export function toPaymentWithRelations(row: unknown): PaymentWithRelations {
  const r = row as Record<string, unknown>;
  const result: Record<string, unknown> = {
    ...r,
    amount: Number(r.amount),
  };
  if (Array.isArray(r.allocations)) {
    result.allocations = (r.allocations as Record<string, unknown>[]).map(
      (a) => ({
        ...a,
        amount: Number(a.amount),
      }),
    );
  }
  return result as unknown as PaymentWithRelations;
}

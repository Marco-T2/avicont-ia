import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import type { PaymentWithRelations } from "@/features/payment/payment.types";

/**
 * Payment-with-relations mapper (POC nuevo payment C2 GREEN — DTO mapper
 * centralizado extraction Path γ scope, mapper extraction only NO drop type
 * axis defer C3 expand).
 *
 * Bridges Prisma `payment.findMany/findFirst({ include: paymentInclude })` rows
 * a legacy `PaymentWithRelations` DTO consumido por features/payment/payment.service.ts
 * shim (11 métodos return PaymentWithRelations | WithCorrelation<PaymentWithRelations>)
 * + components/payments/payment-list.tsx + payment-form.tsx (TYPE consumers,
 * defer drop axis C3).
 *
 * §13.A NEW emergent classification "hex presentation TYPE-only import desde
 * legacy features/" 1ra evidencia formal — Opción A cross-module type-only
 * import `import type { PaymentWithRelations } from "@/features/payment/payment.types"`.
 * Type-only NO violates R5 banPrismaInPresentation pattern (allowTypeImports
 * §13.V analog applicable a R-features-legacy-type-import temporal pre-wholesale-delete
 * C4). Distinto §13.A5-α multi-level composition delegation (VALUE class chain) +
 * §13.A5-γ DTO divergence (runtime path coverage) + §13 R-name-collision
 * (TYPE-vs-VALUE re-export ambiguity). Cementación target D1 doc-only post-mortem
 * cumulative POC nuevo payment closure. Forward-applicable Path γ pattern
 * reusable cualquier feature legacy con DTO type pendiente migration hex donde
 * mapper extraction precede type drop axis.
 *
 * §13.A5-γ DTO divergence runtime path coverage MATERIAL precedent A5-C1 5ta
 * aplicación post-cementación canonical cumulative cross-POC matures. Mapper
 * convierte Prisma row con `amount: Decimal` → POJO con `amount: number` (EXACT
 * shim semantic preservation pre-extract per legacy consumer wire contract).
 * Allocations nested `amount: Decimal` también convertidos.
 *
 * Pattern: pure transformation function row → DTO (R5 banPrismaInPresentation
 * honored estricto — NO runtime Prisma value imports, solo type-only carve-out
 * §13.V allowTypeImports). Shim `features/payment/payment.service.ts` mantiene
 * fetchWithRelations helper invocation (R5 NO aplica features/) + invoca este
 * mapper post-fetch para preservar `PaymentWithRelations` legacy contract
 * (Decimal → number coerción + nested allocations conversion).
 *
 * Marco lock #1 Path γ confirmed mapper extraction only — defer drop type axis
 * a C3 expand. Mirror precedent A3-C5 sale-to-with-details.mapper EXACT scope
 * (mapper extraction, NO type drop). Granularity bisect-friendly L1 ESTRICTO 5
 * ciclos preserved.
 *
 * Marco lock #2 signature Opción mixta — paymentInclude + toPaymentWithRelations
 * puro mapper exports. NO exportar fetchWithRelations helper (Prisma runtime
 * query container STAYS en shim layer).
 *
 * Marco lock #3 §13 emergente Opción A cross-module type-only import desde
 * legacy `import type { PaymentWithRelations } from "@/features/payment/payment.types"`.
 *
 * Cross-ref:
 *   - architecture.md §13.A5-γ DTO divergence runtime path coverage (5ta
 *     aplicación post-cementación matures cumulative cross-POC payment C2)
 *   - architecture.md §13.A NEW emergent "hex presentation TYPE-only import desde
 *     legacy features/" cementación target D1 doc-only (1ra evidencia formal)
 *   - engram canonical home `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage`
 *     #1582 (precedent — POC nuevo payment §13.A5-γ MATERIAL forward C2)
 *   - engram canonical home `arch/§13/A-features-legacy-type-only-import` (NEW
 *     canonical home target — 1ra evidencia formal cementación PROACTIVE pre-D1
 *     save post-GREEN canonical home this batch C2)
 *   - modules/sale/presentation/mappers/sale-to-with-details.mapper.ts (precedent
 *     A3-C5 build mappers presentation EXACT scope)
 *   - features/payment/payment.service.ts (consumer shim post-extract — imports
 *     paymentInclude + toPaymentWithRelations + invokes mapper post-fetch)
 *   - features/payment/payment.types.ts línea 32 (PaymentWithRelations type def
 *     preserved — defer drop axis C3 per Path γ)
 *   - components/payments/payment-list.tsx + payment-form.tsx (TYPE consumers
 *     PaymentWithRelations — defer C3 drop type axis swap import path)
 */

// ── Prisma include shape: payment query con relations ─────────────────────────
//
// Type-only Prisma import per §13.V allowTypeImports carve-out — R5
// banPrismaInPresentation honored estricto (NO runtime Prisma value imports).

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

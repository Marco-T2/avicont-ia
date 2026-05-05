import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import type { PaymentWithRelations } from "@/modules/payment/presentation/dto/payment-with-relations";

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
 * legacy features/" 1ra evidencia C2 commit `0c79740` GREEN (Opción A
 * cross-module type-only import `import type { PaymentWithRelations } from
 * "@/features/payment/payment.types"` emergent) — RESUELTA NO-OP transitorio
 * post-C3 commit `5d2aa20` RED + GREEN apply Path β-prod scope (mirror A3-C3
 * sale-with-details EXACT precedent — hex local DTO canonical home
 * modules/payment/presentation/dto/payment-with-relations.ts). Cross-module
 * reverse import desde @/features/payment/payment.types DESAPARECE post-C3,
 * import path resuelto a hex local DTO estable post-C4 wholesale delete
 * features/payment/. Type-only NO violates R5 banPrismaInPresentation pattern
 * (allowTypeImports §13.V analog applicable a R-features-legacy-type-import
 * temporal pre-wholesale-delete C4 — historical context C2 — post-C3 NO aplica
 * porque cross-module import desaparece). Distinto §13.A5-α multi-level
 * composition delegation (VALUE class chain) + §13.A5-γ DTO divergence
 * (runtime path coverage) + §13 R-name-collision (TYPE-vs-VALUE re-export
 * ambiguity). Cementación target D1 doc-only post-mortem cumulative POC nuevo
 * payment closure documenta clase emergent + resolution Path β-prod precedent
 * forward-applicable cualquier feature single con DTO type pendiente migration
 * hex donde mapper extraction precede type drop axis (Path γ + β-prod sequence
 * pattern reusable cross-POC).
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
 * Marco lock #3 (C2 commit `6c35779` RED + `0c79740` GREEN) §13 emergente
 * Opción A cross-module type-only import desde legacy `import type {
 * PaymentWithRelations } from "@/features/payment/payment.types"` RESUELTA
 * post-C3 commit `5d2aa20` RED + GREEN apply Path β-prod scope (mirror A3-C3
 * EXACT) — import path swap a hex local DTO canonical home `import type {
 * PaymentWithRelations } from "@/modules/payment/presentation/dto/payment-with-relations"`.
 * Cross-module reverse import NO-OP transitorio resolved post-C3 — §13.A NEW
 * emergent classification 2da evidencia formal post-cementación canonical
 * PROACTIVE pre-D1 (JSDoc atomic revoke per feedback_jsdoc_atomic_revoke este
 * turn).
 *
 * Cross-ref:
 *   - architecture.md §13.A5-γ DTO divergence runtime path coverage (5ta
 *     aplicación post-cementación matures cumulative cross-POC payment C2)
 *   - architecture.md §13.A NEW emergent "hex presentation TYPE-only import desde
 *     legacy features/" cementación target D1 doc-only (1ra evidencia formal)
 *   - engram canonical home `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage`
 *     #1582 (precedent — POC nuevo payment §13.A5-γ MATERIAL forward C2)
 *   - engram canonical home `arch/§13/A-features-legacy-type-only-import` (NEW
 *     canonical home target — 1ra evidencia formal C2 + 2da evidencia
 *     resolution C3 Path β-prod precedent forward-applicable, cementación
 *     PROACTIVE pre-D1 doc-only)
 *   - modules/payment/presentation/dto/payment-with-relations.ts (post-C3 hex
 *     local DTO canonical home — type import path resolved a hex local stable
 *     post-C4 wholesale delete features/payment/)
 *   - modules/sale/presentation/mappers/sale-to-with-details.mapper.ts (precedent
 *     A3-C5 build mappers presentation EXACT scope)
 *   - features/payment/payment.service.ts (consumer shim post-extract — imports
 *     paymentInclude + toPaymentWithRelations + invokes mapper post-fetch)
 *   - features/payment/payment.types.ts (PaymentWithRelations type def REMOVED
 *     post-C3 commit `5d2aa20` — extracted a hex local DTO canonical home
 *     modules/payment/presentation/dto/payment-with-relations.ts)
 *   - components/payments/payment-list.tsx + payment-form.tsx (TYPE consumers
 *     PaymentWithRelations swap import path post-C3 — desde
 *     @/features/payment/payment.types → @/modules/payment/presentation/dto/
 *     payment-with-relations)
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

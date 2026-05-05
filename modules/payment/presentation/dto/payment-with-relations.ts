import type {
  Payment,
  Contact,
  FiscalPeriod,
  JournalEntry,
  PaymentAllocation,
  AccountsReceivable,
  AccountsPayable,
} from "@/generated/prisma/client";

/**
 * Hex local DTO canonical home for `PaymentWithRelations` — POC nuevo payment
 * C3 GREEN drop type axis Path β-prod scope (mirror A3-C3 sale-with-details
 * EXACT precedent estructura type alias Omit<Prisma model, "amount"> & { ...
 * relations ... } — modules/sale/presentation/dto/sale-with-details.ts).
 *
 * Migrado bit-exact desde features/payment/payment.types.ts:32-43 (legacy shim
 * DTO type — extracted to hex local canonical home C3 commit `5d2aa20` RED +
 * GREEN apply + drop transition legacy file).
 *
 * §13.A NEW emergent classification "hex presentation TYPE-only import desde
 * legacy features/" 2da evidencia formal post-cementación canonical PROACTIVE
 * pre-D1 — Path β-prod resolves Opción A NEW §13.A NO-OP transitorio post-C3
 * (cross-module reverse import desde @/features/payment/payment.types
 * desaparece, hex local resolve estable post-C4 wholesale delete
 * features/payment/). 1ra evidencia POC nuevo payment C2 commit `0c79740`
 * GREEN (Opción A cross-module type-only import emergent) + 2da evidencia
 * resolution C3 (Path β-prod). Cementación target D1 doc-only documenta clase
 * emergent + resolution Path β-prod precedent forward-applicable cualquier
 * feature single con DTO type pendiente migration hex donde mapper extraction
 * precede type drop axis (Path γ + β-prod sequence pattern reusable cross-POC).
 *
 * Decimal → number coerción semantic preservation (legacy consumer wire
 * contract):
 *   - amount: Prisma `Decimal` → POJO `number`
 *   - allocations[].amount: Prisma `Decimal` → POJO `number`
 *
 * Mapper transformación pure row → DTO en
 * modules/payment/presentation/mappers/payment-with-relations.mapper.ts
 * (toPaymentWithRelations function — extracted C2 commit `0c79740` GREEN).
 *
 * Cross-ref:
 *   - modules/sale/presentation/dto/sale-with-details.ts (precedent A3-C3 build
 *     DTO presentation hex local canonical home EXACT mirror — interface
 *     SaleWithDetails extends Omit<Sale, "totalAmount">, NO server.ts barrel
 *     re-export, prod consumers importan DIRECTO desde dto/ subdir)
 *   - modules/payment/presentation/mappers/payment-with-relations.mapper.ts
 *     (mapper hex post-C3 imports type from this hex local DTO — Opción A
 *     NO-OP transitorio resolved cross-module import desaparece)
 *   - components/payments/payment-list.tsx + payment-form.tsx (prod consumers
 *     post-C3 cross-feature swap import path desde hex local DTO)
 *   - features/payment/payment.service.ts (shim cascade swap post-C3 imports
 *     type from hex local DTO until C4 wholesale delete)
 *   - architecture.md §13.A NEW emergent classification cementación target D1
 *     doc-only post-mortem cumulative POC nuevo payment closure
 */

export type PaymentWithRelations = Omit<Payment, "amount"> & {
  amount: number;
  contact: Contact;
  period: FiscalPeriod;
  journalEntry: JournalEntry | null;
  operationalDocType?: { id: string; code: string; name: string } | null;
  allocations: (Omit<PaymentAllocation, "amount"> & {
    amount: number;
    receivable?: (AccountsReceivable & { contact: Contact }) | null;
    payable?: (AccountsPayable & { contact: Contact }) | null;
  })[];
};

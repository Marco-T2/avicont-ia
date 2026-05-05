import type { PaymentFilters } from "../payment.repository";

/**
 * Reader port for the payment envelope shape — read-side queries for the
 * presentation `PaymentService` Adapter via composition-root chain canonical
 * R4 exception path (mirror α-A3.B paired C1b-α `89e6441` precedent).
 *
 * Domain-internal `PaymentWithRelationsSnapshot` defined LOCALLY mirror
 * precedent `SaleSnapshot` en sale-reader.port.ts:17-28 + `FiscalPeriodSnapshot`
 * cumulative cross-modules — definido localmente para no cruzar boundary §12
 * importando cross-layer presentation/dto/. R1 banDomainCrossLayer honored
 * estricto (NO allowTypeImports carve-out at domain layer).
 *
 * Distinction explicit cementación target D1:
 *   - `PaymentWithRelationsSnapshot` (este file, domain/ports/) — domain-internal
 *     port boundary projection type. Narrow contract: id + organizationId +
 *     amount-coerced-to-number + allocations-amount-coerced. Rest opaque via
 *     index signature (mirror sale-reader.port.ts narrow projection only-fields-
 *     consumer-inspecciona pattern).
 *   - `PaymentWithRelations` (modules/payment/presentation/dto/) — UI envelope
 *     DTO canonical home for UI consumers (payment-list.tsx + payment-form.tsx
 *     + legacy shim downstream). STAYS post-C4-α (C3 Path β-prod cementación
 *     preserved).
 *
 * Cast trivial via structural equivalence at presentation Adapter boundary
 * post-reader-return — runtime shape identical. Snapshot+DTO coexisten:
 * Snapshot is the type-system boundary at port; DTO is the type-system
 * boundary at UI consumer surface.
 *
 * Implementation lives en `modules/payment/infrastructure/adapters/...` (R5
 * — only place allowed to touch Prisma + invoke mapper for envelope assembly).
 */
export interface PaymentWithRelationsSnapshot {
  id: string;
  organizationId: string;
  amount: number;
  allocations: Array<{
    id: string;
    amount: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface PaymentWithRelationsReaderPort {
  findAllWithRelations(
    organizationId: string,
    filters?: PaymentFilters,
  ): Promise<PaymentWithRelationsSnapshot[]>;

  findByIdWithRelations(
    organizationId: string,
    id: string,
  ): Promise<PaymentWithRelationsSnapshot | null>;
}

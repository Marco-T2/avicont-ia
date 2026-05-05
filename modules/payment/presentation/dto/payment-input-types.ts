import type { PaymentMethod } from "@/generated/prisma/client";
import type {
  PaymentDirection,
  CreditAllocationSource,
} from "@/modules/payment/presentation/server";
import type { AllocationInput } from "@/modules/payment/application/payments.service";

/**
 * Hex local DTO canonical home for `CreatePaymentInput` + `UpdatePaymentInput`
 * + `AllocationInput` UI/API-facing input cluster — POC nuevo payment C4-β
 * GREEN wholesale delete features/payment/* atomic + cross-feature TYPE swap
 * consumers via this LOCAL DTO (Path a §13.A5-ε signature divergence MATERIAL
 * 3ra evidencia post-cementación canonical, mirror PaymentWithRelations C3
 * EXACT precedent estructura presentation/dto/ subdir + JSDoc verbose canonical
 * convention).
 *
 * Migrado bit-exact desde features/payment/payment.types.ts:23-50 (legacy shim
 * input types — extracted to hex local canonical home C4-β commit RED `3bc8fec`
 * + GREEN apply este turno + drop transition legacy file wholesale).
 *
 * §13.A5-ε signature divergence drop alias 3ra evidencia post-cementación
 * canonical — Path a LOCAL DTO presentation/dto/ canonical home preserve
 * UI/API-facing shape distinct de domain entity construction shape:
 *   - hex domain `CreatePaymentInput` (`../domain/payment.entity`):
 *     organizationId + journalEntryId + AllocationDraft (entity construction
 *     puro — NO direction NO creditSources NO createdById)
 *   - LOCAL `CreatePaymentInput` (este archivo): legacy 13 fields shape
 *     preservation UI/API-facing orchestration (createdById + direction?
 *     + creditSources? + allocations: AllocationInput[])
 * Same name semantic distinto resolved vía namespace path
 * (presentation/dto/ vs domain/). 1ra A5-C2c voucher-types
 * `seedForOrg→seedDefaultsForOrg` + 2da C1 `findUnappliedPayments→
 * findUnappliedByContact` + 3ra C4-β este.
 *
 * §13 R-name-collision NEW invariant collision RESOLVES double pair
 * CreatePaymentInput/CreatePaymentServiceInput — hex barrel re-exporta DOS
 * pares mismo concepto distinct shapes (entity construction vs orchestration).
 * Path a LOCAL DTO unified canonical home presentation/dto/ resolves naming
 * clarity vía namespace path (LOCAL CreatePaymentInput presentation/dto/
 * distinct de domain CreatePaymentInput).
 *
 * §13.A features-legacy-type-only-import WHOLESALE RESOLUCIÓN — wholesale
 * delete features/payment/* drops cross-module type-only import vector entire
 * (1ra C2 + 2da C3 + 3ra C4-α evidencias cumulative resueltas wholesale).
 *
 * Convention pre-existing precedent VERIFIED — components import TYPES desde
 * presentation/dto/ deep path (PaymentWithRelations C3 EXACT) NOT desde
 * server-only barrel. Path a LOCAL DTO double-justified (resolve §13.A5-ε
 * divergence + match convention pre-existing). TYPE-only erasure safe vs
 * server-only directive — `import type` fully erased compile-time, NO runtime
 * server-only check tripped.
 *
 * Marco lock #4 LOCAL DTO clusters — `AllocationInput` re-exported directly
 * from `@/modules/payment/application/payments.service` NO double-chain via
 * hex barrel `./server`. Marco lock #5 hex barrel direct para Adapter
 * `PaymentFilters` + `CreditAllocationSource` (single source-of-truth NO
 * re-exported aquí).
 *
 * Cross-ref:
 *   - modules/payment/presentation/dto/payment-with-relations.ts (precedent
 *     LOCAL DTO C3 EXACT mirror estructura presentation/dto/ subdir + JSDoc
 *     verbose canonical convention)
 *   - modules/payment/presentation/server.ts (hex barrel re-export
 *     `CreatePaymentInput` from `../domain/payment.entity` línea 22 +
 *     `CreatePaymentServiceInput` from `../application/payments.service`
 *     línea 70 — DOS pares distinct shapes + R-name-collision RESOLVES
 *     namespace path)
 *   - modules/payment/application/payments.service (canonical home
 *     `AllocationInput` + `CreditAllocationSource` — re-export `AllocationInput`
 *     directly aquí per Marco lock #4 NO double-chain via hex barrel)
 *   - architecture.md §13.A5-ε signature divergence drop alias (3ra evidencia
 *     post-cementación canonical aplicado C4-β — cementación target D1)
 *   - architecture.md §13 R-name-collision NEW invariant collision (Path a
 *     RESOLVES double pair — cementación target D1)
 *   - architecture.md §13.A features-legacy-type-only-import (WHOLESALE
 *     RESOLUCIÓN cumulative — cementación target D1)
 */

export type { AllocationInput };

export interface CreatePaymentInput {
  method: PaymentMethod;
  date: Date;
  amount: number;
  direction?: PaymentDirection;
  description: string;
  periodId: string;
  contactId: string;
  referenceNumber?: number;
  operationalDocTypeId?: string;
  accountCode?: string;
  allocations: AllocationInput[];
  notes?: string;
  createdById: string;
  creditSources?: CreditAllocationSource[];
}

export interface UpdatePaymentInput {
  method?: PaymentMethod;
  date?: Date;
  amount?: number;
  description?: string;
  referenceNumber?: number;
  operationalDocTypeId?: string | null;
  accountCode?: string | null;
  allocations?: AllocationInput[];
  notes?: string;
}

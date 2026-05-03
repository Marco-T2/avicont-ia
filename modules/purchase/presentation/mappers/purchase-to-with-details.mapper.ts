import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { IvaPurchaseBookDTO } from "@/features/accounting/iva-books";

import type { Purchase, PurchaseType } from "../../domain/purchase.entity";
import type { PurchaseDetail } from "../../domain/purchase-detail.entity";
import type {
  PaymentAllocationSummary,
  PayableSummary,
  PurchaseDetailRow,
  PurchaseWithDetails,
} from "../dto/purchase-with-details";

/**
 * Purchase presentation mappers (POC nuevo A3-C5.5 GREEN — atomic build mapper
 * + drop user-summary paired collapse A3-C3+C3.5 sale precedent).
 *
 * Bridges hex domain `Purchase` entity (returned por `makePurchaseService().
 * list/getById`) a legacy `PurchaseWithDetails` DTO consumido por PurchaseList
 * + PurchaseForm (production cero consumers user-summary verified pre-recon —
 * §13.W-purchase resolution applied este ciclo). §13.X-purchase preparation
 * pre A3-C6 cutover 4 callers (page list lean + page detail Prisma direct
 * payable+ivaPurchaseBook + routes 3+4 atomic interdependence).
 *
 * Pattern: caller (page/route) loads external deps via separate Prisma
 * queries (contact via Prisma direct, period via reuse periods list o Prisma
 * direct, payable via Prisma direct §13.X-purchase, ivaPurchaseBook via
 * Prisma direct mirror A3-C4b sale precedent) y pasa al main compositor
 * `toPurchaseWithDetails(purchase, deps)` que invoca sub-mappers cohesivos.
 *
 * Hex purity preserved: mapper consume Purchase domain entity output
 * (`makePurchaseService`), NO toca presentation concerns dentro de
 * application layer. Sub-mappers EXTERNAL deps (contact/period/payable)
 * reciben Prisma raw shape passthrough (Marco Q-final-4 lock — caller ya
 * carga via Prisma queries, mapper recibe directo).
 *
 * §13.W-purchase resolution (A3-C5.5 atomic paired este ciclo): unused
 * user-summary nested field dropeado del mapper deps signature + DTO. Verified
 * pre-recon expand profundo: PurchaseList (purchase-list.tsx) +
 * PurchaseForm (purchase-form.tsx) + components/purchases/*.tsx non-test
 * cero consumers `\bcreatedBy\b`. Purchase entity `createdById` field
 * preservado via `Omit<Purchase, ...decimal_fields>` passthrough Prisma
 * type. Cross-ref engram `poc-nuevo/a3/c5-5/locked` Marco Q-final-1.
 *
 * Sub-mapper `toPurchaseDetailRow` recibe DOMAIN PurchaseDetail entity (NO
 * Prisma raw) porque Purchase.details son entities — internal Purchase data,
 * NOT external dep. Conversion MonetaryAmount→number + 12+ optional fields
 * (PolloFaenado/Flete/General/Servicio polymorphic) `T | undefined → T |
 * null` per PurchaseDetailRow `number | null` shape (Prisma optional fields
 * llegan como `T | null` en DTO; hex entity getters como `T | undefined`).
 *
 * R5 banPrismaInPresentation preserved via type-only Prisma import (A3-C1.5
 * §13.V carve-out allowTypeImports: true). NO runtime Prisma value usage en
 * mapper module — Decimal.toNumber() invocado sobre instance ya construida
 * upstream por Prisma query (caller-side).
 *
 * Asimetría purchase vs sale precedent (mirror estructura, different concept):
 *   - sale `toReceivableSummary` ↔ purchase `toPayableSummary` (cuentas por
 *     cobrar vs pagar — Prisma raw → DTO Decimal→number + nested allocations)
 *   - sale fixed prefix `VG` ↔ purchase TYPE_PREFIXES `FL/PF/CG/SV` per
 *     `PurchaseType` (4 polymorphic discriminators, mirror legacy
 *     `features/purchase/purchase.utils.ts:47-49 getDisplayCode`)
 *   - sale `toSaleDetailRow` 5 fields ↔ purchase `toPurchaseDetailRow` 12+
 *     optional fields (asimetría discriminator polymorphism)
 *
 * Cross-ref:
 * - architecture.md §13.W (sale resolution applied — purchase analogue resuelto este ciclo)
 * - architecture.md §13.X (sale resolution Prisma direct — purchase analogue C6b/c)
 * - architecture.md §13.V allowTypeImports presentation carve-out (A3-C1.5)
 * - engram bookmark `poc-nuevo/a3/c5-5/locked` Marco Q-final 1-5
 * - engram bookmark `poc-nuevo/a3/c5/closed` (#1534) atomic precedent + computeDisplayCode reuse
 * - engram bookmark `poc-nuevo/a3/c3/locked` (sale precedent Marco locks Q1-Q6 SubQ-a–h)
 * - features/purchase/purchase.utils.ts:47-49 (legacy getDisplayCode formula reference)
 * - modules/purchase/application/purchase.service.ts:46-51 (TYPE_PREFIXES FL/PF/CG/SV)
 * - modules/purchase/application/purchase.service.ts:109-119 (hex .list/.getById return Purchase)
 * - modules/purchase/presentation/dto/purchase-with-details.ts (target shape destination)
 * - modules/purchase/infrastructure/prisma-purchase.repository.ts:31-39 (hex `payable: null` always)
 * - modules/sale/presentation/mappers/sale-to-with-details.mapper.ts (229 LOC simétrico precedent)
 */

// ── Types: Prisma raw shapes mirror legacy `purchaseInclude` ──────────────────
//
// External dep input shapes corresponden 1:1 a legacy `purchaseInclude` /
// `purchaseDetailInclude` Prisma select projections
// (`features/purchase/purchase.repository.ts:purchaseInclude+purchaseDetailInclude`).
// Caller carga estos shapes via Prisma queries (typically con `select`
// matching estos fields).

export type ContactRaw = {
  id: string;
  name: string;
  type: string;
  nit?: string | null;
  paymentTermsDays?: number | null;
};

export type PeriodRaw = {
  id: string;
  name: string;
  status: string;
};

export type AllocationRaw = {
  id: string;
  paymentId: string;
  amount: Prisma.Decimal;
  payment: {
    id: string;
    date: Date;
    description: string;
  };
};

export type PayableRaw = {
  id: string;
  amount: Prisma.Decimal;
  paid: Prisma.Decimal;
  balance: Prisma.Decimal;
  status: string;
  dueDate: Date;
  allocations: AllocationRaw[];
};

// ── Main mapper deps (caller-passes-deps signature) ───────────────────────────

export interface ToPurchaseWithDetailsDeps {
  contact: ContactRaw;
  period: PeriodRaw;
  payable?: PayableRaw | null;
  ivaPurchaseBook?: IvaPurchaseBookDTO | null;
  /**
   * Caller-computed displayCode (A3-C6a §13.AC-purchase resolution variante 4):
   * non-DRAFT path = `computeDisplayCode(purchase.purchaseType, purchase.sequenceNumber)`,
   * DRAFT path = `${TYPE_PREFIXES[purchase.purchaseType]}-DRAFT` polymorphic
   * fallback per purchaseType discriminator. Caller responsibility null guard
   * mirror §13.AC HubService A3-C5 SubQ-β + A3-C4a.5 sale paired pattern.
   */
  displayCode: string;
}

// ── Utility: TYPE_PREFIXES per purchaseType (mirror legacy purchase.utils.ts) ─

/**
 * Purchase displayCode prefix lookup exportado para caller responsibility null
 * guard fallback (A3-C6a §13.AC-purchase variante 4): callers que invocan
 * `toPurchaseWithDetails` con DRAFT purchases (sequenceNumber=null) construyen
 * fallback `${TYPE_PREFIXES[purchaseType]}-DRAFT` polymorphic per purchaseType
 * discriminator (FL/PF/CG/SV asimetría purchase vs sale fixed prefix VG)
 * mirror A3-C4a.5 sale paired pattern. SubQ-d fail-fast invariant standalone
 * preservado en `computeDisplayCode` (sigue throwing on null).
 */
export const TYPE_PREFIXES: Record<PurchaseType, string> = {
  FLETE: "FL",
  POLLO_FAENADO: "PF",
  COMPRA_GENERAL: "CG",
  SERVICIO: "SV",
};

// ── Utility: displayCode formula (DRY A3-C6 callers reuse mirror sale A3-C5) ──

export function computeDisplayCode(
  purchaseType: PurchaseType,
  sequenceNumber: number | null,
): string {
  if (sequenceNumber === null) {
    throw new Error(
      "computeDisplayCode requires sequenceNumber — DRAFT purchases (null sequenceNumber) NO tienen displayCode (SubQ-d fail-fast lock mirror sale)",
    );
  }
  return `${TYPE_PREFIXES[purchaseType]}-${String(sequenceNumber).padStart(3, "0")}`;
}

// ── Sub-mappers: passthrough EXTERNAL deps (Prisma raw shape) ─────────────────

export function toContactSummary(
  contact: ContactRaw,
): PurchaseWithDetails["contact"] {
  return {
    id: contact.id,
    name: contact.name,
    type: contact.type,
    nit: contact.nit,
    paymentTermsDays: contact.paymentTermsDays,
  };
}

export function toPeriodSummary(period: PeriodRaw): PurchaseWithDetails["period"] {
  return {
    id: period.id,
    name: period.name,
    status: period.status,
  };
}

// ── Sub-mapper: payable Decimal→number + nested allocations + payment ─────────

export function toPayableSummary(payable: PayableRaw): PayableSummary {
  return {
    id: payable.id,
    amount: payable.amount.toNumber(),
    paid: payable.paid.toNumber(),
    balance: payable.balance.toNumber(),
    status: payable.status,
    dueDate: payable.dueDate,
    allocations: payable.allocations.map(toPaymentAllocationSummary),
  };
}

function toPaymentAllocationSummary(
  allocation: AllocationRaw,
): PaymentAllocationSummary {
  return {
    id: allocation.id,
    paymentId: allocation.paymentId,
    amount: allocation.amount.toNumber(),
    payment: {
      id: allocation.payment.id,
      date: allocation.payment.date.toISOString(),
      description: allocation.payment.description,
    },
  };
}

// ── Sub-mapper: PurchaseDetail entity (INTERNAL Purchase data) → PurchaseDetailRow DTO
//
// Input es domain PurchaseDetail entity (NO Prisma raw) porque viene desde
// Purchase.details. MonetaryAmount.value extracts numeric. 12+ optional fields
// `T | undefined → T | null` per PurchaseDetailRow shape (Prisma optional
// llegan como `T | null` en DTO; hex entity getters como `T | undefined`).

export function toPurchaseDetailRow(detail: PurchaseDetail): PurchaseDetailRow {
  return {
    id: detail.id,
    purchaseId: detail.purchaseId,
    description: detail.description,
    order: detail.order,
    fecha: detail.fecha ?? null,
    docRef: detail.docRef ?? null,
    chickenQty: detail.chickenQty ?? null,
    productTypeId: detail.productTypeId ?? null,
    detailNote: detail.detailNote ?? null,
    boxes: detail.boxes ?? null,
    expenseAccountId: detail.expenseAccountId ?? null,
    lineAmount: detail.lineAmount.value,
    pricePerChicken: detail.pricePerChicken ?? null,
    grossWeight: detail.grossWeight ?? null,
    tare: detail.tare ?? null,
    netWeight: detail.netWeight ?? null,
    unitPrice: detail.unitPrice ?? null,
    shrinkage: detail.shrinkage ?? null,
    shortage: detail.shortage ?? null,
    realNetWeight: detail.realNetWeight ?? null,
    quantity: detail.quantity ?? null,
  };
}

// ── Main compositor: caller-passes-deps Purchase + deps → PurchaseWithDetails ─

export function toPurchaseWithDetails(
  purchase: Purchase,
  deps: ToPurchaseWithDetailsDeps,
): PurchaseWithDetails {
  // displayCode caller responsibility (A3-C6a §13.AC-purchase variante 4):
  // caller computa con null guard ternary + ${TYPE_PREFIXES[purchaseType]}-DRAFT
  // polymorphic fallback DRAFT path mirror A3-C4a.5 sale paired pattern.
  return {
    id: purchase.id,
    organizationId: purchase.organizationId,
    purchaseType: purchase.purchaseType,
    status: purchase.status,
    sequenceNumber: purchase.sequenceNumber as number,
    date: purchase.date,
    contactId: purchase.contactId,
    periodId: purchase.periodId,
    description: purchase.description,
    referenceNumber: purchase.referenceNumber,
    notes: purchase.notes,
    totalAmount: purchase.totalAmount.value,
    ruta: purchase.ruta,
    farmOrigin: purchase.farmOrigin,
    chickenCount: purchase.chickenCount,
    shrinkagePct: purchase.shrinkagePct,
    totalGrossKg: purchase.totalGrossKg,
    totalNetKg: purchase.totalNetKg,
    totalShrinkKg: purchase.totalShrinkKg,
    totalShortageKg: purchase.totalShortageKg,
    totalRealNetKg: purchase.totalRealNetKg,
    journalEntryId: purchase.journalEntryId,
    payableId: purchase.payableId,
    createdById: purchase.createdById,
    createdAt: purchase.createdAt,
    updatedAt: purchase.updatedAt,
    details: purchase.details.map(toPurchaseDetailRow),
    contact: toContactSummary(deps.contact),
    period: toPeriodSummary(deps.period),
    payable: deps.payable ? toPayableSummary(deps.payable) : null,
    displayCode: deps.displayCode,
    ivaPurchaseBook: deps.ivaPurchaseBook ?? null,
  };
}

import "server-only";

import type { Purchase } from "../../domain/purchase.entity";
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
 * Pattern: caller (page/route) loads external deps via services/read ports
 * (contact + payable via `makePurchaseReads()` purchase read ports, period
 * via reuse periods list) y pasa al main compositor
 * `toPurchaseWithDetails(purchase, deps)` que invoca sub-mappers cohesivos.
 *
 * Hex purity preserved: mapper consume Purchase domain entity output
 * (`makePurchaseService`), NO toca presentation concerns dentro de
 * application layer. Sub-mappers EXTERNAL deps (contact/period/payable)
 * reciben clean views desde los read ports (purchase-pure-read — mirror
 * sale-pure-read pilot: los adapters Prisma convierten Decimal→number en el
 * boundary infrastructure, mapper recibe numbers).
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
 * R5 banPrismaInPresentation preserved — purchase-pure-read removed even the
 * type-only Prisma import (mirror sale-pure-read pilot): deps arrive as clean
 * views (plain numbers) from the purchase read ports, so no `Prisma.Decimal`
 * appears anywhere in this module.
 *
 * Asimetría purchase vs sale precedent (mirror estructura, different concept):
 *   - sale `toReceivableSummary` ↔ purchase `toPayableSummary` (cuentas por
 *     cobrar vs pagar — clean numbers passthrough + nested allocations)
 *   - sale fixed prefix `VG` ↔ purchase TYPE_PREFIXES `FL/PF/CG/SV` per
 *     `PurchaseType` (4 polymorphic discriminators)
 *   - sale `toSaleDetailRow` 5 fields ↔ purchase `toPurchaseDetailRow` 12+
 *     optional fields (asimetría discriminator polymorphism)
 *
 * Cross-ref:
 * - architecture.md §13.W (sale resolution applied — purchase analogue resuelto este ciclo)
 * - architecture.md §13.X (sale resolution Prisma direct — purchase analogue C6b/c)
 * - architecture.md §13.V allowTypeImports presentation carve-out (A3-C1.5)
 * - engram bookmark `poc-nuevo/a3/c5-5/locked` Marco Q-final 1-5
 * - engram bookmark `poc-nuevo/a3/c3/locked` (sale precedent Marco locks Q1-Q6 SubQ-a–h)
 * - modules/purchase/application/purchase.service.ts:46-51 (TYPE_PREFIXES FL/PF/CG/SV)
 * - modules/purchase/application/purchase.service.ts:109-119 (hex .list/.getById return Purchase)
 * - modules/purchase/presentation/dto/purchase-with-details.ts (target shape destination)
 * - modules/purchase/infrastructure/prisma-purchase.repository.ts:31-39 (hex `payable: null` always)
 * - modules/sale/presentation/mappers/sale-to-with-details.mapper.ts (229 LOC simétrico precedent)
 */

// ── Types: clean external dep views (mirror legacy `purchaseInclude` fields) ──
//
// External dep input shapes corresponden 1:1 a legacy `purchaseInclude` /
// `purchaseDetailInclude` select projections (post-A3-C8 atomic delete commit
// 4aa8480) PERO ya limpios: monetary fields son `number` (purchase-pure-read
// — caller carga via `makePurchaseReads()` read ports cuyos adapters
// convierten Decimal→number en infrastructure). Structural typing:
// `PurchaseContactView` / `PurchasePayableView` (domain ports) satisfacen
// estos shapes sin acoplar el mapper a los ports.

export type ContactView = {
  id: string;
  name: string;
  type: string;
  nit?: string | null;
  paymentTermsDays?: number | null;
};

export type PeriodView = {
  id: string;
  name: string;
  status: string;
};

export type AllocationView = {
  id: string;
  paymentId: string;
  amount: number;
  payment: {
    id: string;
    date: Date;
    description: string;
  };
};

export type PayableView = {
  id: string;
  amount: number;
  paid: number;
  balance: number;
  status: string;
  dueDate: Date;
  allocations: AllocationView[];
};

// ── Main mapper deps (caller-passes-deps signature) ───────────────────────────

export interface ToPurchaseWithDetailsDeps {
  contact: ContactView;
  period: PeriodView;
  payable?: PayableView | null;
}

// ── Sub-mappers: passthrough EXTERNAL deps (clean views) ──────────────────────

export function toContactSummary(
  contact: ContactView,
): PurchaseWithDetails["contact"] {
  return {
    id: contact.id,
    name: contact.name,
    type: contact.type,
    nit: contact.nit,
    paymentTermsDays: contact.paymentTermsDays,
  };
}

export function toPeriodSummary(period: PeriodView): PurchaseWithDetails["period"] {
  return {
    id: period.id,
    name: period.name,
    status: period.status,
  };
}

// ── Sub-mapper: payable clean numbers + nested allocations + payment ──────────

export function toPayableSummary(payable: PayableView): PayableSummary {
  return {
    id: payable.id,
    amount: payable.amount,
    paid: payable.paid,
    balance: payable.balance,
    status: payable.status,
    dueDate: payable.dueDate,
    allocations: payable.allocations.map(toPaymentAllocationSummary),
  };
}

function toPaymentAllocationSummary(
  allocation: AllocationView,
): PaymentAllocationSummary {
  return {
    id: allocation.id,
    paymentId: allocation.paymentId,
    amount: allocation.amount,
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
  };
}

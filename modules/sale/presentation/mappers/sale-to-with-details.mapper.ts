import "server-only";

import type { Sale } from "../../domain/sale.entity";
import type { SaleDetail } from "../../domain/sale-detail.entity";
import type {
  PaymentAllocationSummary,
  ReceivableSummary,
  SaleDetailRow,
  SaleWithDetails,
} from "../dto/sale-with-details";

/**
 * Sale presentation mappers (POC nuevo A3-C3 GREEN — caller-passes-deps pattern).
 *
 * Bridges hex domain `Sale` entity (returned por `makeSaleService().list/getById`)
 * a legacy `SaleWithDetails` DTO consumido por SaleList + SaleForm + HubService
 * SaleServiceForHub interface. §13.T resolution preparation pre A3-C4 cutover
 * 2 sale pages + A3-C5 cutover 2 HubService deps.
 *
 * Pattern: caller (page) loads external deps via services/read ports
 * (contact + receivable via `makeSaleReads()` sale read ports, period via
 * FiscalPeriodsService) y pasa al main compositor
 * `toSaleWithDetails(sale, deps)` que invoca sub-mappers cohesivos.
 *
 * Hex purity preserved: mapper consume Sale domain entity output (`makeSaleService`),
 * NO toca presentation concerns dentro de application layer. Sub-mappers
 * EXTERNAL deps (contact/period/receivable) reciben clean views desde los
 * read ports (sale-pure-read pilot — los adapters Prisma convierten
 * Decimal→number en el boundary infrastructure, mapper recibe numbers).
 *
 * §13.W resolution (A3-C3.5 paired follow-up): unused user-summary nested
 * field dropeado del mapper deps signature + DTO + sub-mapper export. Verified
 * pre-recon profundo A3-C4: SaleList (sale-list.tsx) + SaleForm (sale-form.tsx)
 * + HubService SaleServiceForHub interface (hub.service.ts:11-35) cero
 * consumers. Sale entity user-id field preserved via Omit<Sale, "totalAmount">
 * passthrough. Cross-ref engram bookmark `poc-nuevo/a3/c3-5/closed`.
 *
 * Sub-mapper `toSaleDetailRow` recibe DOMAIN SaleDetail entity (NO Prisma raw)
 * porque Sale.details son entities — internal Sale data, NOT external dep.
 * Conversion MonetaryAmount→number + quantity/unitPrice undefined→null per
 * SaleDetailRow `number | null` shape.
 *
 * R5 banPrismaInPresentation preserved — sale-pure-read pilot removed even the
 * type-only Prisma import: deps arrive as clean views (plain numbers) from the
 * sale read ports, so no `Prisma.Decimal` appears anywhere in this module.
 *
 * Cross-ref:
 * - architecture.md §13.T DTO shape divergence Sale entity vs SaleWithDetails
 * - architecture.md §13.V allowTypeImports presentation carve-out (A3-C1.5)
 * - engram bookmark `poc-nuevo/a3/c3/locked` Marco locks Q1-Q6 + SubQ-a–h
 * - legacy saleInclude shape source completo (post-A3-C7 atomic delete commit ad36da2)
 * - legacy withDisplayCode pattern reference (post-A3-C7 atomic delete)
 * - modules/sale/presentation/dto/sale-with-details.ts (target shape destination)
 * - modules/sale/application/sale.service.ts:94-105 (hex .list/.getById return Sale entity)
 */

// ── Types: clean external dep views (mirror legacy `saleInclude` fields) ───────
//
// External dep input shapes corresponden 1:1 a legacy `saleInclude` select
// projections (post-A3-C7 atomic delete) PERO ya limpios: monetary fields son
// `number` (sale-pure-read pilot — caller carga via `makeSaleReads()` read
// ports cuyos adapters convierten Decimal→number en infrastructure).
// Structural typing: `SaleContactView` / `SaleReceivableView` (domain ports)
// satisfacen estos shapes sin acoplar el mapper a los ports.

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

export type ReceivableView = {
  id: string;
  amount: number;
  paid: number;
  balance: number;
  status: string;
  dueDate: Date;
  allocations: AllocationView[];
};

// ── Main mapper deps (caller-passes-deps signature) ────────────────────────────

export interface ToSaleWithDetailsDeps {
  contact: ContactView;
  period: PeriodView;
  receivable?: ReceivableView | null;
}

// ── Sub-mappers: passthrough EXTERNAL deps (clean views) ──────────────────────

export function toContactSummary(
  contact: ContactView,
): SaleWithDetails["contact"] {
  return {
    id: contact.id,
    name: contact.name,
    type: contact.type,
    nit: contact.nit,
    paymentTermsDays: contact.paymentTermsDays,
  };
}

export function toPeriodSummary(period: PeriodView): SaleWithDetails["period"] {
  return {
    id: period.id,
    name: period.name,
    status: period.status,
  };
}

// ── Sub-mapper: receivable clean numbers + nested allocations + payment ────────

export function toReceivableSummary(
  receivable: ReceivableView,
): ReceivableSummary {
  return {
    id: receivable.id,
    amount: receivable.amount,
    paid: receivable.paid,
    balance: receivable.balance,
    status: receivable.status,
    dueDate: receivable.dueDate,
    allocations: receivable.allocations.map(toPaymentAllocationSummary),
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

// ── Sub-mapper: SaleDetail entity (INTERNAL Sale data) → SaleDetailRow DTO ─────
//
// Input es domain SaleDetail entity (NO Prisma raw) porque viene desde
// Sale.details. MonetaryAmount.value extracts numeric. quantity/unitPrice
// undefined→null per SaleDetailRow `number | null` shape.

export function toSaleDetailRow(detail: SaleDetail): SaleDetailRow {
  return {
    id: detail.id,
    saleId: detail.saleId,
    description: detail.description,
    order: detail.order,
    incomeAccountId: detail.incomeAccountId,
    lineAmount: detail.lineAmount.value,
    quantity: detail.quantity ?? null,
    unitPrice: detail.unitPrice ?? null,
  };
}

// ── Main compositor: caller-passes-deps Sale + deps → SaleWithDetails ──────────

export function toSaleWithDetails(
  sale: Sale,
  deps: ToSaleWithDetailsDeps,
): SaleWithDetails {
  return {
    id: sale.id,
    organizationId: sale.organizationId,
    status: sale.status,
    sequenceNumber: sale.sequenceNumber as number,
    date: sale.date,
    contactId: sale.contactId,
    periodId: sale.periodId,
    description: sale.description,
    referenceNumber: sale.referenceNumber,
    notes: sale.notes,
    totalAmount: sale.totalAmount.value,
    journalEntryId: sale.journalEntryId,
    receivableId: sale.receivableId,
    createdById: sale.createdById,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
    details: sale.details.map(toSaleDetailRow),
    contact: toContactSummary(deps.contact),
    period: toPeriodSummary(deps.period),
    receivable: deps.receivable ? toReceivableSummary(deps.receivable) : null,
  };
}

import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { IvaSalesBookDTO } from "@/modules/iva-books/presentation/index";

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
 * Pattern: caller (page) loads external deps via separate Prisma queries
 * (contact via ContactsService, period via FiscalPeriodsService, receivable via
 * Prisma direct, ivaSalesBook via Prisma direct) y pasa al main compositor
 * `toSaleWithDetails(sale, deps)` que invoca sub-mappers cohesivos.
 *
 * Hex purity preserved: mapper consume Sale domain entity output (`makeSaleService`),
 * NO toca presentation concerns dentro de application layer. Sub-mappers
 * EXTERNAL deps (contact/period/receivable) reciben Prisma raw shape
 * passthrough (Marco lock GREEN — caller ya carga via Prisma queries, mapper
 * recibe directo).
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
 * R5 banPrismaInPresentation preserved via type-only Prisma import (A3-C1.5
 * §13.V carve-out allowTypeImports: true). NO runtime Prisma value usage en
 * mapper module — Decimal.toNumber() invocado sobre instance ya construida
 * upstream por Prisma query (caller-side).
 *
 * Cross-ref:
 * - architecture.md §13.T DTO shape divergence Sale entity vs SaleWithDetails
 * - architecture.md §13.V allowTypeImports presentation carve-out (A3-C1.5)
 * - engram bookmark `poc-nuevo/a3/c3/locked` Marco locks Q1-Q6 + SubQ-a–h
 * - legacy saleInclude shape source completo (post-A3-C7 atomic delete commit ad36da2)
 * - legacy withDisplayCode pattern reference (post-A3-C7 atomic delete)
 * - legacy getDisplayCode formula `VG-NNN` (post-A3-C7 atomic delete)
 * - modules/sale/presentation/dto/sale-with-details.ts (target shape destination)
 * - modules/sale/application/sale.service.ts:94-105 (hex .list/.getById return Sale entity)
 */

// ── Types: Prisma raw shapes mirror legacy `saleInclude` ───────────────────────
//
// External dep input shapes corresponden 1:1 a legacy `saleInclude` Prisma select
// projections (legacy saleInclude — post-A3-C7 atomic delete). Caller carga estos
// shapes via Prisma queries (typically con `select` matching estos fields).

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

export type ReceivableRaw = {
  id: string;
  amount: Prisma.Decimal;
  paid: Prisma.Decimal;
  balance: Prisma.Decimal;
  status: string;
  dueDate: Date;
  allocations: AllocationRaw[];
};

// ── Main mapper deps (caller-passes-deps signature) ────────────────────────────

export interface ToSaleWithDetailsDeps {
  contact: ContactRaw;
  period: PeriodRaw;
  receivable?: ReceivableRaw | null;
  ivaSalesBook?: IvaSalesBookDTO | null;
  /**
   * Caller-computed displayCode (A3-C4a.5 §13.AC-sale-paged resolution):
   * non-DRAFT path = `computeDisplayCode(sale.sequenceNumber)`, DRAFT path =
   * `${SALE_PREFIX}-DRAFT` fallback. Caller responsibility null guard mirror
   * §13.AC HubService A3-C5 SubQ-β precedent.
   */
  displayCode: string;
}

// ── Utility: displayCode formula `VG-NNN` (DRY A3-C5 HubService inline) ────────

/**
 * Sale displayCode prefix exportado para caller responsibility null guard
 * fallback (A3-C4a.5 paired §13.AC-sale-paged): callers que invocan
 * `toSaleWithDetails` para listas con DRAFT sales (sequenceNumber=null)
 * construyen fallback `${SALE_PREFIX}-DRAFT` mirror §13.AC HubService A3-C5
 * SubQ-β precedent. SubQ-d fail-fast invariant standalone preservado en
 * `computeDisplayCode` (sigue throwing on null).
 */
export const SALE_PREFIX = "VG";

export function computeDisplayCode(sequenceNumber: number | null): string {
  if (sequenceNumber === null) {
    throw new Error(
      "computeDisplayCode requires sequenceNumber — DRAFT sales (null sequenceNumber) NO tienen displayCode (SubQ-d fail-fast lock)",
    );
  }
  return `${SALE_PREFIX}-${String(sequenceNumber).padStart(3, "0")}`;
}

// ── Sub-mappers: passthrough EXTERNAL deps (Prisma raw shape) ─────────────────

export function toContactSummary(
  contact: ContactRaw,
): SaleWithDetails["contact"] {
  return {
    id: contact.id,
    name: contact.name,
    type: contact.type,
    nit: contact.nit,
    paymentTermsDays: contact.paymentTermsDays,
  };
}

export function toPeriodSummary(period: PeriodRaw): SaleWithDetails["period"] {
  return {
    id: period.id,
    name: period.name,
    status: period.status,
  };
}

// ── Sub-mapper: receivable Decimal→number + nested allocations + payment ───────

export function toReceivableSummary(
  receivable: ReceivableRaw,
): ReceivableSummary {
  return {
    id: receivable.id,
    amount: receivable.amount.toNumber(),
    paid: receivable.paid.toNumber(),
    balance: receivable.balance.toNumber(),
    status: receivable.status,
    dueDate: receivable.dueDate,
    allocations: receivable.allocations.map(toPaymentAllocationSummary),
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
  // displayCode caller responsibility (A3-C4a.5 §13.AC-sale-paged): caller
  // computa con null guard ternary + ${SALE_PREFIX}-DRAFT fallback DRAFT path
  // mirror §13.AC HubService A3-C5 SubQ-β precedent.
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
    displayCode: deps.displayCode,
    ivaSalesBook: deps.ivaSalesBook ?? null,
  };
}

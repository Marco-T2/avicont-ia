import "server-only";
import { prisma } from "@/lib/prisma";
import type { Sale } from "@/modules/sale/domain/sale.entity";
import { computeDisplayCode } from "@/modules/sale/presentation/mappers/sale-to-with-details.mapper";
import type { HubItem, HubItemSale, HubItemDispatch, HubFilters } from "./hub.types";

// ── Monetary amount accepted from DispatchService (legacy shape) ──────────
// DispatchService still returns Prisma.Decimal | number. The mapper normalises
// to string via toFixed(2). SaleService (post A3-C5 cutover) returns hex
// `Sale[]` — totalAmount via `sale.totalAmount.value: number`, no union needed.
type MonetaryAmount = { toFixed(d: number): string } | number | string;

// ── Dependency interfaces (no circular imports) ───────────────────────────
//
// `SaleServiceForHub` (POC nuevo A3-C5 refactor (a) inline) — drops `displayCode`
// + nested `contact: {id,name,type}` fields. Hex `Sale[]` entity shape
// passthrough; HubService computes displayCode via `computeDisplayCode`
// (DRY A3-C3 SubQ-d) + batch contact name lookup via Prisma direct
// (mirror A3-C4a Map<id, name> pattern). DRAFT sales (sequenceNumber null)
// receive literal `"VG-DRAFT"` displayCode (§13.AC caller responsibility
// null guard preserva A3-C3 mapper fail-fast invariant).

export interface SaleServiceForHub {
  list(
    organizationId: string,
    filters?: {
      status?: string;
      contactId?: string;
      periodId?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
  ): Promise<Sale[]>;
}

export interface DispatchServiceForHub {
  list(
    organizationId: string,
    filters?: {
      status?: string;
      contactId?: string;
      periodId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      dispatchType?: string;
    },
  ): Promise<
    Array<{
      id: string;
      displayCode: string;
      referenceNumber: number | null;
      date: Date;
      contactId: string;
      contact: { id: string; name: string; type: string };
      periodId: string;
      description: string;
      dispatchType: string;
      totalAmount: MonetaryAmount;
      status: string;
    }>
  >;
}

// ── Normaliser: converts Prisma.Decimal | number | string → "0.00" string ─

function normaliseMoney(amount: MonetaryAmount): string {
  if (typeof amount === "string") {
    return parseFloat(amount).toFixed(2);
  }
  if (typeof amount === "number") {
    return amount.toFixed(2);
  }
  // Prisma.Decimal duck-type: has .toFixed()
  return amount.toFixed(2);
}

// ── Mappers (private pure functions) ─────────────────────────────────────

function toHubItemSale(
  sale: Sale,
  contactName: string,
  displayCode: string,
): HubItemSale {
  return {
    source: "sale",
    type: "VENTA_GENERAL",
    id: sale.id,
    displayCode,
    referenceNumber: sale.referenceNumber,
    date: sale.date,
    contactId: sale.contactId,
    contactName,
    periodId: sale.periodId,
    description: sale.description,
    totalAmount: sale.totalAmount.value.toFixed(2),
    status: sale.status as HubItemSale["status"],
  };
}

function toHubItemDispatch(
  dispatch: Awaited<ReturnType<DispatchServiceForHub["list"]>>[number],
): HubItemDispatch {
  return {
    source: "dispatch",
    type: dispatch.dispatchType as HubItemDispatch["type"],
    id: dispatch.id,
    displayCode: dispatch.displayCode,
    referenceNumber: dispatch.referenceNumber,
    date: dispatch.date,
    contactId: dispatch.contactId,
    contactName: dispatch.contact.name,
    periodId: dispatch.periodId,
    description: dispatch.description,
    totalAmount: normaliseMoney(dispatch.totalAmount),
    status: dispatch.status as HubItemDispatch["status"],
  };
}

// ── HubService ─────────────────────────────────────────────────────────────

export class HubService {
  constructor(
    private readonly sales: SaleServiceForHub,
    private readonly dispatches: DispatchServiceForHub,
  ) {}

  async listHub(
    organizationId: string,
    filters: HubFilters,
  ): Promise<{ items: HubItem[]; total: number }> {
    const { type, status, contactId, periodId, dateFrom, dateTo, limit = 50, offset = 0 } =
      filters;

    const commonFilters = { status, contactId, periodId, dateFrom, dateTo };

    // D3 step 1: branch on type to avoid unnecessary DB queries
    let saleItems: HubItemSale[] = [];
    let dispatchItems: HubItemDispatch[] = [];

    if (type === "VENTA_GENERAL") {
      const sales = await this.sales.list(organizationId, commonFilters);
      saleItems = await this.mapSalesWithContacts(organizationId, sales);
    } else if (type === "NOTA_DESPACHO" || type === "BOLETA_CERRADA") {
      const rows = await this.dispatches.list(organizationId, {
        ...commonFilters,
        dispatchType: type,
      });
      dispatchItems = rows.map(toHubItemDispatch);
    } else {
      const [sales, dispatches] = await Promise.all([
        this.sales.list(organizationId, commonFilters),
        this.dispatches.list(organizationId, commonFilters),
      ]);
      saleItems = await this.mapSalesWithContacts(organizationId, sales);
      dispatchItems = dispatches.map(toHubItemDispatch);
    }

    // D3 step 4: concat + sort date desc, id desc
    const merged: HubItem[] = [...saleItems, ...dispatchItems].sort((a, b) => {
      const dateDiff = b.date.getTime() - a.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.id.localeCompare(a.id);
    });

    const total = merged.length;
    const items = merged.slice(offset, offset + limit);

    return { items, total };
  }

  private async mapSalesWithContacts(
    organizationId: string,
    sales: Sale[],
  ): Promise<HubItemSale[]> {
    if (sales.length === 0) return [];

    const contactIds = [...new Set(sales.map((s) => s.contactId))];
    const contacts = await prisma.contact.findMany({
      where: { organizationId, id: { in: contactIds } },
      select: { id: true, name: true },
    });
    const contactNameById = new Map(contacts.map((c) => [c.id, c.name]));

    return sales.map((s) => {
      const contactName = contactNameById.get(s.contactId) ?? "";
      const displayCode =
        s.sequenceNumber !== null
          ? computeDisplayCode(s.sequenceNumber)
          : "VG-DRAFT";
      return toHubItemSale(s, contactName, displayCode);
    });
  }
}

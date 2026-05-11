import "server-only";
import { prisma } from "@/lib/prisma";
import type { Sale } from "@/modules/sale/domain/sale.entity";
import { computeDisplayCode } from "@/modules/sale/presentation/mappers/sale-to-with-details.mapper";
import type {
  HubItem,
  HubItemSale,
  HubItemDispatch,
  HubFilters,
} from "./hub.types";
import { getDisplayCode } from "../infrastructure/dispatch-display-code";
import type { Dispatch } from "../domain/dispatch.entity";

// ── Dependency interfaces (no circular imports) ───────────────────────────

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
  ): Promise<Dispatch[]>;
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
  dispatch: Dispatch,
  contactName: string,
): HubItemDispatch {
  const displayCode = getDisplayCode(
    dispatch.dispatchType,
    dispatch.sequenceNumber,
  );
  return {
    source: "dispatch",
    type: dispatch.dispatchType as HubItemDispatch["type"],
    id: dispatch.id,
    displayCode,
    referenceNumber: dispatch.referenceNumber,
    date: dispatch.date,
    contactId: dispatch.contactId,
    contactName,
    periodId: dispatch.periodId,
    description: dispatch.description,
    totalAmount: dispatch.totalAmount.toFixed(2),
    status: dispatch.status as HubItemDispatch["status"],
  };
}

// ── DispatchHubService ─────────────────────────────────────────────────────

export class DispatchHubService {
  constructor(
    private readonly sales: SaleServiceForHub,
    private readonly dispatches: DispatchServiceForHub,
  ) {}

  async listHub(
    organizationId: string,
    filters: HubFilters,
  ): Promise<{ items: HubItem[]; total: number }> {
    const {
      type,
      status,
      contactId,
      periodId,
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0,
    } = filters;

    const commonFilters = { status, contactId, periodId, dateFrom, dateTo };

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
      dispatchItems = await this.mapDispatchesWithContacts(
        organizationId,
        rows,
      );
    } else {
      const [sales, dispatches] = await Promise.all([
        this.sales.list(organizationId, commonFilters),
        this.dispatches.list(organizationId, commonFilters),
      ]);
      saleItems = await this.mapSalesWithContacts(organizationId, sales);
      dispatchItems = await this.mapDispatchesWithContacts(
        organizationId,
        dispatches,
      );
    }

    const merged: HubItem[] = [...saleItems, ...dispatchItems].sort(
      (a, b) => {
        const dateDiff = b.date.getTime() - a.date.getTime();
        if (dateDiff !== 0) return dateDiff;
        return b.id.localeCompare(a.id);
      },
    );

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

  private async mapDispatchesWithContacts(
    organizationId: string,
    dispatches: Dispatch[],
  ): Promise<HubItemDispatch[]> {
    if (dispatches.length === 0) return [];

    const contactIds = [...new Set(dispatches.map((d) => d.contactId))];
    const contacts = await prisma.contact.findMany({
      where: { organizationId, id: { in: contactIds } },
      select: { id: true, name: true },
    });
    const contactNameById = new Map(contacts.map((c) => [c.id, c.name]));

    return dispatches.map((d) => {
      const contactName = contactNameById.get(d.contactId) ?? "";
      return toHubItemDispatch(d, contactName);
    });
  }
}

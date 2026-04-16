// ── Common status shared by Sale and Dispatch ──────────────────────────────

export type CommonStatus = "DRAFT" | "POSTED" | "LOCKED" | "VOIDED";

// ── HubItem discriminated union ────────────────────────────────────────────

export type HubItemSale = {
  source: "sale";
  type: "VENTA_GENERAL";
  id: string;
  displayCode: string;
  referenceNumber: number | null;
  date: Date;
  contactId: string;
  contactName: string;
  periodId: string;
  description: string;
  /** Serialised to string at the service boundary — safe for browser (no Prisma.Decimal). */
  totalAmount: string;
  status: CommonStatus;
};

export type HubItemDispatch = {
  source: "dispatch";
  type: "NOTA_DESPACHO" | "BOLETA_CERRADA";
  id: string;
  displayCode: string;
  referenceNumber: number | null;
  date: Date;
  contactId: string;
  contactName: string;
  periodId: string;
  description: string;
  /** Serialised to string at the service boundary — safe for browser (no Prisma.Decimal). */
  totalAmount: string;
  status: CommonStatus;
};

export type HubItem = HubItemSale | HubItemDispatch;

// ── Filter bag ─────────────────────────────────────────────────────────────

export type HubFilters = {
  type?: "VENTA_GENERAL" | "NOTA_DESPACHO" | "BOLETA_CERRADA";
  status?: CommonStatus;
  contactId?: string;
  periodId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
};

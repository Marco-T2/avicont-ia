/** R5 absoluta — local const arrays + types, ZERO Prisma imports. */

// ── Entity type & action enums (domain-owned) ────────────────────────────────

export const AUDITED_ENTITY_TYPES = [
  "sales",
  "purchases",
  "payments",
  "dispatches",
  "journal_entries",
  "sale_details",
  "purchase_details",
  "journal_lines",
] as const;

export type AuditEntityType = (typeof AUDITED_ENTITY_TYPES)[number];

export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "STATUS_CHANGE",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditClassification = "directa" | "indirecta";

// ── UI labels (domain constants) ─────────────────────────────────────────────

/** Etiquetas en español para mostrar AuditEntityType en la UI. */
export const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  sales: "Ventas",
  purchases: "Compras",
  payments: "Pagos",
  dispatches: "Despachos",
  journal_entries: "Asientos contables",
  sale_details: "Detalle de venta",
  purchase_details: "Detalle de compra",
  journal_lines: "Línea de asiento",
};

/** Etiquetas en español para mostrar AuditAction en la UI. */
export const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: "Creación",
  UPDATE: "Actualización",
  DELETE: "Eliminación",
  STATUS_CHANGE: "Cambio de estado",
};

/**
 * Mapa de valores de status (inglés, DB) a etiquetas en español para la UI.
 */
export const STATUS_BADGE_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  POSTED: "Contabilizado",
  VOIDED: "Anulado",
  PENDING: "Pendiente",
  PARTIAL: "Parcial",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};

// ── Core domain interfaces ───────────────────────────────────────────────────

/** Fila individual de auditoría enriquecida con clasificación y display data. */
export interface AuditEvent {
  id: string;
  createdAt: Date;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  /** Clasificación resuelta vía classifier — no viene del schema. */
  classification: AuditClassification;
  changedBy: { id: string; name: string } | null;
  justification: string | null;
  /** FK al voucher lógico al que pertenece la fila. */
  parentVoucherType: AuditEntityType;
  parentVoucherId: string;
  /**
   * Solo presente cuando el padre es journal_entries.
   * Null para el resto.
   */
  parentSourceType: string | null;
  /** JSONB snapshot — serializado a JSON plano por Postgres. */
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  correlationId: string | null;
}

export interface AuditGroup {
  parentVoucherType: AuditEntityType;
  parentVoucherId: string;
  parentClassification: AuditClassification;
  lastActivityAt: Date;
  eventCount: number;
  events: AuditEvent[];
}

/** Cursor estable sobre (createdAt DESC, id DESC). Se encodea como JSON base64url. */
export interface AuditCursor {
  createdAt: string; // ISO 8601
  id: string; // cuid
}

export interface AuditListFilters {
  dateFrom: Date;
  dateTo: Date;
  entityType?: AuditEntityType;
  changedById?: string;
  action?: AuditAction;
  cursor?: AuditCursor;
  /** Default 50, max 200. */
  limit?: number;
}

// ── Helpers de clasificación estructural (client-safe) ───────────────────────

const HEADER_ENTITY_TYPES = new Set<AuditEntityType>([
  "journal_entries",
  "sales",
  "purchases",
  "payments",
  "dispatches",
]);

export function isHeaderEvent(entityType: AuditEntityType): boolean {
  return HEADER_ENTITY_TYPES.has(entityType);
}

// ── AuditGroupSummary — shape derivado client-side ───────────────────────────

/** Resumen agregado de un AuditGroup para renderizar la operation card. */
export interface AuditGroupSummary {
  headerEvent: AuditEvent | null;
  detailCounts: { created: number; updated: number; deleted: number };
  detailTotal: number;
  statusTransition: { from: string | null; to: string | null } | null;
  isOrphan: boolean;
}

export function buildGroupSummary(group: AuditGroup): AuditGroupSummary {
  const detailCounts = { created: 0, updated: 0, deleted: 0 };
  let headerEvent: AuditEvent | null = null;
  let statusTransition: { from: string | null; to: string | null } | null = null;

  for (const event of group.events) {
    if (isHeaderEvent(event.entityType)) {
      if (headerEvent === null) {
        headerEvent = event;
      }
      if (
        event.action === "STATUS_CHANGE" ||
        (event.oldValues?.["status"] !== undefined &&
          event.newValues?.["status"] !== undefined &&
          event.oldValues["status"] !== event.newValues["status"])
      ) {
        statusTransition = {
          from: event.oldValues?.["status"] != null
            ? String(event.oldValues["status"])
            : null,
          to: event.newValues?.["status"] != null
            ? String(event.newValues["status"])
            : null,
        };
      }
    } else {
      switch (event.action) {
        case "CREATE":
          detailCounts.created += 1;
          break;
        case "UPDATE":
          detailCounts.updated += 1;
          break;
        case "DELETE":
          detailCounts.deleted += 1;
          break;
      }
    }
  }

  const detailTotal =
    detailCounts.created + detailCounts.updated + detailCounts.deleted;
  const isOrphan = !group.parentVoucherId;

  return {
    headerEvent,
    detailCounts,
    detailTotal,
    statusTransition,
    isOrphan,
  };
}

// ── buildTimelineSummary ─────────────────────────────────────────────────────

export function buildTimelineSummary(events: AuditEvent[]): string {
  const counts = { created: 0, updated: 0, deleted: 0, header: 0 };
  for (const ev of events) {
    if (isHeaderEvent(ev.entityType)) {
      counts.header += 1;
    } else if (ev.action === "CREATE") {
      counts.created += 1;
    } else if (ev.action === "DELETE") {
      counts.deleted += 1;
    } else {
      counts.updated += 1;
    }
  }
  const parts: string[] = [];
  if (counts.header > 0) parts.push(`${counts.header} cabecera modificada`);
  if (counts.created > 0)
    parts.push(
      `${counts.created} ${counts.created === 1 ? "línea creada" : "líneas creadas"}`,
    );
  if (counts.updated > 0)
    parts.push(
      `${counts.updated} ${counts.updated === 1 ? "línea modificada" : "líneas modificadas"}`,
    );
  if (counts.deleted > 0)
    parts.push(
      `${counts.deleted} ${counts.deleted === 1 ? "línea eliminada" : "líneas eliminadas"}`,
    );
  return parts.join(" · ");
}

// ── getVoucherDetailUrl ──────────────────────────────────────────────────────

export function getVoucherDetailUrl(
  orgSlug: string,
  parentVoucherType: AuditEntityType,
  parentVoucherId: string,
): string | null {
  switch (parentVoucherType) {
    case "journal_entries":
      return `/${orgSlug}/accounting/journal/${parentVoucherId}`;
    case "sales":
      return `/${orgSlug}/sales/${parentVoucherId}`;
    case "purchases":
      return `/${orgSlug}/purchases/${parentVoucherId}`;
    case "payments":
      return `/${orgSlug}/payments/${parentVoucherId}`;
    case "dispatches":
      return `/${orgSlug}/dispatches/${parentVoucherId}`;
    case "sale_details":
    case "purchase_details":
    case "journal_lines":
      return null;
    default: {
      const _exhaustive: never = parentVoucherType;
      void _exhaustive;
      return null;
    }
  }
}

// ── Whitelist de campos a renderizar en el diff ──────────────────────────────

export interface DiffField {
  key: string;
  label: string;
  formatter?: "decimal" | "date" | "status" | "reference";
}

export const DIFF_FIELDS: Record<AuditEntityType, DiffField[]> = {
  sales: [
    { key: "status", label: "Estado", formatter: "status" },
    { key: "date", label: "Fecha", formatter: "date" },
    { key: "contactId", label: "Cliente", formatter: "reference" },
    { key: "description", label: "Descripción" },
    { key: "totalAmount", label: "Monto total", formatter: "decimal" },
  ],
  purchases: [
    { key: "status", label: "Estado", formatter: "status" },
    { key: "date", label: "Fecha", formatter: "date" },
    { key: "contactId", label: "Proveedor", formatter: "reference" },
    { key: "description", label: "Descripción" },
    { key: "totalAmount", label: "Monto total", formatter: "decimal" },
  ],
  payments: [
    { key: "status", label: "Estado", formatter: "status" },
    { key: "date", label: "Fecha", formatter: "date" },
    { key: "contactId", label: "Contacto", formatter: "reference" },
    { key: "amount", label: "Monto", formatter: "decimal" },
    { key: "type", label: "Tipo" },
  ],
  dispatches: [
    { key: "status", label: "Estado", formatter: "status" },
    { key: "date", label: "Fecha", formatter: "date" },
    { key: "description", label: "Descripción" },
  ],
  journal_entries: [
    { key: "status", label: "Estado", formatter: "status" },
    { key: "date", label: "Fecha", formatter: "date" },
    { key: "description", label: "Descripción" },
    { key: "number", label: "Número" },
    { key: "referenceNumber", label: "Ref." },
  ],
  sale_details: [
    { key: "description", label: "Descripción" },
    { key: "quantity", label: "Cantidad", formatter: "decimal" },
    { key: "unitPrice", label: "Precio unitario", formatter: "decimal" },
    { key: "lineAmount", label: "Subtotal", formatter: "decimal" },
    { key: "incomeAccountId", label: "Cuenta de ingreso", formatter: "reference" },
  ],
  purchase_details: [
    { key: "description", label: "Descripción" },
    { key: "quantity", label: "Cantidad", formatter: "decimal" },
    { key: "unitPrice", label: "Precio unitario", formatter: "decimal" },
    { key: "lineAmount", label: "Subtotal", formatter: "decimal" },
    { key: "expenseAccountId", label: "Cuenta de gasto", formatter: "reference" },
  ],
  journal_lines: [
    { key: "debit", label: "Debe", formatter: "decimal" },
    { key: "credit", label: "Haber", formatter: "decimal" },
    { key: "accountId", label: "Cuenta", formatter: "reference" },
    { key: "contactId", label: "Contacto", formatter: "reference" },
    { key: "description", label: "Descripción" },
  ],
};

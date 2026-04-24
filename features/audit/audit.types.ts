// features/audit/audit.types.ts
//
// NO `import "server-only"` — este archivo se re-exporta desde index.ts
// y puede importarse desde client components (para renderizar DIFF_FIELDS).

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
  /** FK al voucher lógico al que pertenece la fila. Para cabeceras coincide con (entityType, entityId). */
  parentVoucherType: AuditEntityType;
  parentVoucherId: string;
  /**
   * Solo presente cuando el padre es journal_entries (la fila misma o una journal_lines).
   * Null para el resto — sale, purchase, payment, dispatch y sus detalles.
   */
  parentSourceType: string | null;
  /** JSONB snapshot — serializado a JSON plano por Postgres (Decimals → numbers, Dates → ISO strings). */
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
  /**
   * Eventos del grupo, ordenados por createdAt DESC con tiebreak id DESC.
   * El repository retorna todos; la UI decide cuántos colapsa/expande.
   */
  events: AuditEvent[];
}

/** Cursor estable sobre (createdAt DESC, id DESC). Se encodea como JSON base64url. */
export interface AuditCursor {
  createdAt: string; // ISO 8601
  id: string; // cuid
}

export interface AuditListFilters {
  /** Requerido. Default resuelto en el handler: startOfMonth(today, TZ America/La_Paz). */
  dateFrom: Date;
  /** Requerido. Default: endOfMonth(today, TZ America/La_Paz). */
  dateTo: Date;
  entityType?: AuditEntityType;
  changedById?: string;
  action?: AuditAction;
  cursor?: AuditCursor;
  /** Default 50, max 200. Clamp en validation. */
  limit?: number;
}

/** Whitelist de campos a renderizar en el diff, por entityType. */
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

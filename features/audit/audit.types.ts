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

// ── Helpers de clasificación estructural (client-safe) ───────────────────────

/**
 * Conjunto cerrado de entityTypes que actúan como cabecera de un comprobante.
 * Refleja el mismo conjunto que REQ-AUDIT.3 usa para clasificación contable,
 * pero con semántica estructural: "este evento es la fila padre del grupo".
 */
const HEADER_ENTITY_TYPES = new Set<AuditEntityType>([
  "journal_entries",
  "sales",
  "purchases",
  "payments",
  "dispatches",
]);

/**
 * Retorna `true` si el entityType corresponde a un evento de cabecera de
 * comprobante (vs. evento de línea/detalle). Helper centralizado para todos
 * los consumers (REQ-AUDIT.11).
 */
export function isHeaderEvent(entityType: AuditEntityType): boolean {
  return HEADER_ENTITY_TYPES.has(entityType);
}

// ── AuditGroupSummary — shape derivado client-side (Decision 3) ───────────────

/** Resumen agregado de un AuditGroup para renderizar la operation card. */
export interface AuditGroupSummary {
  /** Evento de cabecera más reciente del grupo, si existe. */
  headerEvent: AuditEvent | null;
  /** Contadores agregados de eventos de detalle. */
  detailCounts: { created: number; updated: number; deleted: number };
  /** Total de eventos de detalle (suma de detailCounts) — atajo para render condicional. */
  detailTotal: number;
  /** Transición de status en la cabecera, si la hubo. null si no aplica. */
  statusTransition: { from: string | null; to: string | null } | null;
  /** Indica si el grupo carece de identidad de comprobante (parentVoucherId vacío/desconocido). */
  isOrphan: boolean;
}

/**
 * Deriva un `AuditGroupSummary` a partir de un `AuditGroup` completo.
 * Complejidad O(N) sobre `group.events`. Sin side-effects, sin I/O.
 */
export function buildGroupSummary(group: AuditGroup): AuditGroupSummary {
  const detailCounts = { created: 0, updated: 0, deleted: 0 };
  let headerEvent: AuditEvent | null = null;
  let statusTransition: { from: string | null; to: string | null } | null = null;

  for (const event of group.events) {
    if (isHeaderEvent(event.entityType)) {
      // Tomamos el primero (los eventos vienen ordenados DESC por createdAt).
      if (headerEvent === null) {
        headerEvent = event;
      }
      // Derivar transición de status desde el headerEvent.
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
      // Evento de detalle — acumular contadores.
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
        // STATUS_CHANGE en detalle no se cuenta.
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

// ── buildTimelineSummary — correlation group header string (D3.c) ─────────────

/**
 * Derives a Spanish one-liner summary for a correlation group, e.g.
 * "1 cabecera modificada · 3 líneas creadas · 2 líneas eliminadas".
 *
 * Used by `groupByCorrelation` in `audit-detail-timeline.tsx` to populate the
 * card header for multi-event groups (REQ-CORR.5, D3.c).
 */
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
      // UPDATE, STATUS_CHANGE → modified
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

// ── getVoucherDetailUrl — mapping CTA (Decision 6) ────────────────────────────

/**
 * Retorna la URL del detail page del comprobante para el orgSlug dado.
 * Retorna `null` para entityTypes de detalle (nunca son padre lógico del grupo)
 * y para cualquier entityType desconocido (exhaustiveness check).
 */
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
    // Los detail types no deberían aparecer como parentVoucherType —
    // el repository los mapea a su padre. Retornamos null de forma defensiva.
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

// ── STATUS_BADGE_LABELS — etiquetas de estado (promovida desde audit-diff-viewer) ──

/**
 * Mapa de valores de status (inglés, DB) a etiquetas en español para la UI.
 * Promovida desde `audit-diff-viewer.tsx` (era privada `STATUS_BADGE`) para
 * que pueda ser reutilizada por la operation card sin duplicar (Decision 4).
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

// ── Whitelist de campos a renderizar en el diff, por entityType. ──────────────

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

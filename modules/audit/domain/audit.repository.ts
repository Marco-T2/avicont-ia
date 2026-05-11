import type {
  AuditAction,
  AuditCursor,
  AuditEntityType,
  AuditListFilters,
} from "./audit.types";

/**
 * Forma cruda emitida por los queries del repository. El service la consume y
 * la enriquece con `classification` + display names antes de devolver a la UI.
 */
export interface AuditRow {
  id: string;
  createdAt: Date;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  changedById: string | null;
  justification: string | null;
  correlationId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  parentEntityType: AuditEntityType;
  parentEntityId: string;
  parentSourceType: string | null;
}

/** Read-only repository port — NO write methods. Writes come from DB triggers. */
export interface AuditRepository {
  listFlat(
    organizationId: string,
    filters: AuditListFilters,
  ): Promise<{ rows: AuditRow[]; nextCursor: AuditCursor | null }>;

  getVoucherHistory(
    organizationId: string,
    parentVoucherType: AuditEntityType,
    parentVoucherId: string,
  ): Promise<AuditRow[]>;
}

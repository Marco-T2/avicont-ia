import type {
  AuditCursor,
  AuditEntityType,
  AuditEvent,
  AuditGroup,
  AuditListFilters,
} from "../audit.types";

/** Read-only cross-module inquiry port for the audit module. */
export interface AuditInquiryPort {
  listGrouped(
    organizationId: string,
    filters: AuditListFilters,
  ): Promise<{ groups: AuditGroup[]; nextCursor: AuditCursor | null }>;

  getVoucherHistory(
    organizationId: string,
    entityType: AuditEntityType,
    entityId: string,
  ): Promise<AuditEvent[]>;
}

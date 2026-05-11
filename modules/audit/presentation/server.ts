import "server-only";

export { makeAuditService } from "./composition-root";

export {
  auditListQuerySchema,
  parseCursor,
  voucherHistoryParamsSchema,
} from "./validation";

// Domain types re-exported for server consumers
export type {
  AuditAction,
  AuditClassification,
  AuditCursor,
  AuditEntityType,
  AuditEvent,
  AuditGroup,
  AuditGroupSummary,
  AuditListFilters,
  DiffField,
} from "../domain/audit.types";

export {
  ACTION_LABELS,
  AUDIT_ACTIONS,
  AUDITED_ENTITY_TYPES,
  DIFF_FIELDS,
  ENTITY_TYPE_LABELS,
  STATUS_BADGE_LABELS,
  buildGroupSummary,
  buildTimelineSummary,
  getVoucherDetailUrl,
  isHeaderEvent,
} from "../domain/audit.types";

export { AuditService, type UserNameResolver } from "../application/audit.service";
export type { AuditRepository, AuditRow } from "../domain/audit.repository";
export { classify, type ParentContext } from "../domain/audit.classifier";
export type { AuditInquiryPort } from "../domain/ports/audit-inquiry.port";

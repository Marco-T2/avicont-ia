// Client-safe barrel: solo tipos y constantes planas. NO re-exporta Repository
// ni Service (cumple split-native client/server barrels).

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

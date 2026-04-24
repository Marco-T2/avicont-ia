// Client-safe barrel: solo tipos y constantes planas. NO re-exporta Repository
// ni Service (cumple REQ-FMB.1 / REQ-AUDIT.10 A10-S3). El feature-boundaries
// test hace grep sobre este archivo y falla si aparece algún símbolo con
// nombre terminado en Repository o Service.

export type {
  AuditAction,
  AuditClassification,
  AuditCursor,
  AuditEntityType,
  AuditEvent,
  AuditGroup,
  AuditListFilters,
  DiffField,
} from "./audit.types";

export {
  AUDIT_ACTIONS,
  AUDITED_ENTITY_TYPES,
  DIFF_FIELDS,
} from "./audit.types";

import { z } from "zod";
import { ValidationError, AUDIT_CURSOR_INVALID } from "@/features/shared/errors";
import {
  AUDIT_ACTIONS,
  AUDITED_ENTITY_TYPES,
  type AuditCursor,
} from "./audit.types";

const auditActionEnum = z.enum(AUDIT_ACTIONS);
const auditEntityTypeEnum = z.enum(AUDITED_ENTITY_TYPES);

// Solo las 5 cabeceras son navegables por detalle (design §3.2).
const VOUCHER_HISTORY_ENTITY_TYPES = [
  "sales",
  "purchases",
  "payments",
  "dispatches",
  "journal_entries",
] as const;

const voucherHistoryEntityTypeEnum = z.enum(VOUCHER_HISTORY_ENTITY_TYPES);

/**
 * Query params para GET /audit.
 *
 * Fechas opcionales: el handler aplica default mes-en-curso cuando ambas faltan
 * (REQ-AUDIT.1 A1-S1). Si sólo una viene, el handler devuelve 422
 * AUDIT_DATE_RANGE_INVALID (no se valida a este nivel).
 */
export const auditListQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  entityType: auditEntityTypeEnum.optional(),
  changedById: z.string().min(1).optional(),
  action: auditActionEnum.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const voucherHistoryParamsSchema = z.object({
  orgSlug: z.string().min(1),
  entityType: voucherHistoryEntityTypeEnum,
  entityId: z.string().min(1),
});

/**
 * Decodifica un cursor opaco a AuditCursor. Lanza ValidationError con código
 * AUDIT_CURSOR_INVALID ante cualquier falla (base64url malformado, JSON
 * inválido, o shape que no matchee { createdAt, id }).
 */
export function parseCursor(raw: string): AuditCursor {
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { createdAt?: unknown }).createdAt !== "string" ||
      typeof (parsed as { id?: unknown }).id !== "string"
    ) {
      throw new Error("cursor shape invalid");
    }
    return parsed as AuditCursor;
  } catch (error) {
    throw new ValidationError(
      "Cursor de auditoría inválido",
      AUDIT_CURSOR_INVALID,
      { cursor: raw },
    );
  }
}

import { z } from "zod";
import { ValidationError, AUDIT_CURSOR_INVALID } from "@/features/shared/errors";
import {
  AUDIT_ACTIONS,
  AUDITED_ENTITY_TYPES,
  type AuditCursor,
} from "../domain/audit.types";

const auditActionEnum = z.enum(AUDIT_ACTIONS);
const auditEntityTypeEnum = z.enum(AUDITED_ENTITY_TYPES);

const VOUCHER_HISTORY_ENTITY_TYPES = [
  "sales",
  "purchases",
  "payments",
  "dispatches",
  "journal_entries",
] as const;

const voucherHistoryEntityTypeEnum = z.enum(VOUCHER_HISTORY_ENTITY_TYPES);

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

"use client";

import {
  DIFF_FIELDS,
  STATUS_BADGE_LABELS,
  type AuditEvent,
  type DiffField,
} from "@/features/audit";
import { formatDateBO } from "@/lib/date-utils";

const MISSING = "—";

interface AuditDiffViewerProps {
  event: AuditEvent;
  /** Override opcional — si se provee, ignora el lookup por entityType. */
  fieldsOverride?: DiffField[];
}

export function AuditDiffViewer({ event, fieldsOverride }: AuditDiffViewerProps) {
  const fields = fieldsOverride ?? DIFF_FIELDS[event.entityType] ?? [];

  // Si no hay campos whitelist para este entityType, fallback seguro: no renderizar
  // ninguna fila. El wrapper <table> puede seguir presente vacío (header).
  if (fields.length === 0) {
    return <div className="rounded-md border" />;
  }

  const rows = fields
    .map((field) => buildRow(field, event))
    .filter((r) => r !== null) as Array<NonNullable<ReturnType<typeof buildRow>>>;

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Campo</th>
            <th className="px-3 py-2 text-left font-medium">Antes</th>
            <th className="px-3 py-2 text-left font-medium">Después</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t">
              <td className="px-3 py-2 font-medium">{row.label}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.before}</td>
              <td className="px-3 py-2">{row.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildRow(field: DiffField, event: AuditEvent) {
  const oldRaw = event.oldValues?.[field.key];
  const newRaw = event.newValues?.[field.key];

  const oldPresent = event.oldValues !== null && field.key in (event.oldValues ?? {});
  const newPresent = event.newValues !== null && field.key in (event.newValues ?? {});

  // Si ningún lado tiene el campo → no aportar fila al diff.
  if (!oldPresent && !newPresent) return null;

  // Si ambos tienen el mismo valor → no es un cambio, no aportar fila.
  if (oldPresent && newPresent && stableEquals(oldRaw, newRaw)) {
    return null;
  }

  const before = oldPresent
    ? formatValue(oldRaw, field)
    : event.oldValues === null
    ? ""
    : MISSING;
  const after = newPresent
    ? formatValue(newRaw, field)
    : event.newValues === null
    ? ""
    : MISSING;

  return {
    key: field.key,
    label: field.label,
    before,
    after,
  };
}

function formatValue(value: unknown, field: DiffField): string {
  if (value === null || value === undefined) return MISSING;

  switch (field.formatter) {
    case "decimal": {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(n)) return String(value);
      return n.toLocaleString("es-BO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    case "date":
      return formatDateBO(value as string);
    case "status":
      return STATUS_BADGE_LABELS[String(value)] ?? String(value);
    case "reference":
      return `Ref. ${String(value)}`;
    default:
      return String(value);
  }
}

/** Comparación estable de valores JSONB (objetos planos, primitivos, arrays). */
function stableEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

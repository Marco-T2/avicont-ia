"use client";

import type { DocumentPrintType } from "@/generated/prisma/client";
import { DOCUMENT_PRINT_TYPE_LABELS } from "@/lib/document-print-type-labels";
import { Label } from "@/components/ui/label";

/**
 * DocTypeDropdown — native <select> with 8 DocumentPrintType options.
 *
 * REQ-OP.10. Human-readable labels come from
 * `lib/document-print-type-labels.ts`.
 */
export interface DocTypeDropdownProps {
  value: DocumentPrintType;
  onChange: (value: DocumentPrintType) => void;
  id?: string;
  label?: string;
}

const ORDER: DocumentPrintType[] = [
  "BALANCE_GENERAL",
  "ESTADO_RESULTADOS",
  "COMPROBANTE",
  "DESPACHO",
  "VENTA",
  "COMPRA",
  "COBRO",
  "PAGO",
];

export function DocTypeDropdown({
  value,
  onChange,
  id = "doc-type",
  label = "Tipo de documento",
}: DocTypeDropdownProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        data-testid="doc-type-dropdown"
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as DocumentPrintType)}
      >
        {ORDER.map((docType) => (
          <option key={docType} value={docType}>
            {DOCUMENT_PRINT_TYPE_LABELS[docType]}
          </option>
        ))}
      </select>
    </div>
  );
}

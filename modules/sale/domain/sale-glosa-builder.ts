// DEC-1: money formatting via decimal.js (decimal.js@10.6.0 direct in domain).
// Canonical text at modules/accounting/shared/domain/money.utils.ts.
// This file does NO math — it consumes already-converted `number` and delegates
// `Bs.` rendering to `formatBs` (which is itself DEC-1-compliant). Therefore
// this builder MUST NOT import `Prisma.Decimal` value-form NOR `decimal.js`.

import { formatBs } from "@/lib/format-currency";

/**
 * Input shape for the sale glosa builder (REQ-GE-1, design D3).
 *
 * Pure values only — the application layer is responsible for fetching the
 * contact name, mapping detail lines to concept strings, and converting the
 * sale total from `MonetaryAmount` to plain `number`. The builder is a
 * deterministic pure function: same input → byte-identical output.
 */
export interface SaleGlosaInput {
  /** Contact display name. Already-fetched at the application layer. */
  contactName: string;
  /** Sale reference number stringified (sale.referenceNumber). */
  referenceNumber: string;
  /** Sale total in plain number form (DEC-1: converted at app layer). */
  totalAmount: number;
  /** Ordered list of line concepts (description ?? productName ?? ""). */
  lineConcepts: string[];
  /** Sale date — reserved for future use (current template does not include). */
  saleDate: Date;
}

/**
 * Builds the canonical VENTA glosa for a Sale's JournalEntry.description.
 *
 * Template:
 *   `VENTA: <contactName> VG-<referenceNumber> por Bs. <total,XX> (<lineConcepts joined by " | ">)`
 *
 * Behaviour contract:
 *  - Line concepts preserved as-is (no filter, no dedupe — design D3 / open Q3).
 *  - `Bs. <amount>` uses `formatBs` (es-BO locale, decimal comma, dot thousands).
 *  - Output is byte-deterministic across calls for identical input.
 *  - No I/O, no Date.now(), no randomness — pure domain primitive.
 *
 * @example
 *   buildSaleGlosa({
 *     contactName: "Marco",
 *     referenceNumber: "45",
 *     totalAmount: 460,
 *     lineConcepts: ["Venta de pollo faenado"],
 *     saleDate: new Date(2026, 4, 17),
 *   });
 *   // → "VENTA: Marco VG-45 por Bs. 460,00 (Venta de pollo faenado)"
 */
export function buildSaleGlosa(input: SaleGlosaInput): string {
  const concepts = input.lineConcepts.join(" | ");
  return `VENTA: ${input.contactName} VG-${input.referenceNumber} por Bs. ${formatBs(input.totalAmount)} (${concepts})`;
}

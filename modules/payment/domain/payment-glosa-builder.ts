// DEC-1: money formatting via decimal.js (decimal.js@10.6.0 direct in domain).
// Canonical text at modules/accounting/shared/domain/money.utils.ts.
// This file does NO math — it consumes already-converted `number` and delegates
// `Bs.` rendering to `formatBs` (DEC-1-compliant). MUST NOT import
// `Prisma.Decimal` value-form NOR `decimal.js`.

import { formatBs } from "@/lib/format-currency";
import { formatDateConditional } from "@/modules/accounting/shared/domain/date-format";

/**
 * Per-allocation glosa fragment (design D3).
 *
 * `sourceTypeCode` is the denormalised AR doc-type discriminator
 * ("VG" | "ND" | "BC" | null). NULL signals an orphan AR row (legacy backfill
 * miss or source-document delete race) — the builder falls back to literal
 * `DOC-<refNo>` per design D5.
 */
export interface PaymentAllocationGlosa {
  sourceTypeCode: string | null;
  referenceNumber: string;
  sourceDate: Date;
}

/**
 * Input shape for the payment glosa builder (REQ-GE-2, design D3).
 *
 * Pure values only. The application layer is responsible for:
 *  - Fetching the contact name (already-fetched).
 *  - Uppercasing the payment method (already done at caller; builder renders verbatim).
 *  - Converting payment total from `MonetaryAmount` to plain `number`.
 *  - Pre-resolving per-allocation `sourceTypeCode`/`referenceNumber`/`sourceDate`
 *    via LOOKUP-B / the AR.sourceTypeCode denormalised column (Phase 0).
 *
 * The builder is deterministic and pure: same input → byte-identical output.
 */
export interface PaymentGlosaInput {
  /** Payment method in UPPERCASE (caller's responsibility). */
  method: string;
  /** Contact display name (already-fetched). */
  contactName: string;
  /** Payment header total in plain number form (DEC-1: converted at app layer). */
  totalAmount: number;
  /** Per-allocation metadata, in user-visible order. */
  allocations: PaymentAllocationGlosa[];
  /**
   * Journal entry posting date in organization-local timezone (design D6).
   * Used as `refYear` for conditional DD/MM vs DD/MM/YY date formatting.
   */
  journalEntryDate: Date;
}

/**
 * Builds the canonical COBRO glosa for a Payment's JournalEntry.description.
 *
 * Template:
 *   `COBRO <METHOD>: <contactName> Bs. <total,XX>[: <TIPO>-<refNo> del <fecha> | ...]`
 *
 * Per-allocation token:
 *   - `<sourceTypeCode>-<refNo> del <fecha>` when `sourceTypeCode` non-null.
 *   - `DOC-<refNo> del <fecha>` when NULL (orphan fallback, design D5).
 *   - `<fecha>` = `DD/MM` if same year as `journalEntryDate`; else `DD/MM/YY`.
 *
 * Empty allocations:
 *   - Omit the `:` doc-list suffix entirely (design D4).
 *   - Output ends at `<total,XX>`.
 *
 * Determinism: no `Date.now()`, no randomness, locale pinned via `formatBs` (es-BO).
 * Pure function — no I/O, no side effects.
 */
export function buildPaymentGlosa(input: PaymentGlosaInput): string {
  const head = `COBRO ${input.method}: ${input.contactName} Bs. ${formatBs(input.totalAmount)}`;

  if (input.allocations.length === 0) {
    return head;
  }

  const refYear = input.journalEntryDate.getFullYear();
  const tokens = input.allocations.map((a) => {
    const prefix = a.sourceTypeCode ?? "DOC";
    const dateStr = formatDateConditional(a.sourceDate, refYear);
    return `${prefix}-${a.referenceNumber} del ${dateStr}`;
  });

  return `${head}: ${tokens.join(" | ")}`;
}

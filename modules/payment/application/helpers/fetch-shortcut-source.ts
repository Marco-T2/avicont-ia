import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";

/**
 * Read-only application-layer helper. Validates and fetches the source
 * comprobante (Sale or Purchase) for the "registrar pago" shortcut flow.
 *
 * Called from `/[orgSlug]/payments/new` Server Component when the URL carries
 * `?type=COBRO&saleId=...` or `?type=PAGO&purchaseId=...`. The helper enforces
 * cross-org isolation, status guards (VOIDED), and balance guards (must be
 * positive) BEFORE the form is rendered with pre-filled values.
 *
 * Money math: DEC-1. Balance returned as `decimal.js` Decimal (not Prisma
 * runtime value). Conversion from `Prisma.Decimal` happens at the boundary
 * via `new Decimal(...)`. Only `import type` of Prisma is permitted here.
 *
 * Returns a discriminated union — caller switches on `kind`:
 *  - `ok`              → render shortcut form
 *  - `not-found`       → next/navigation `notFound()`
 *  - `cross-org`       → redirect to list
 *  - `voided`          → redirect with `?error=voided`
 *  - `fully-paid`      → redirect with `?error=fully-paid`
 *  - `invalid-params`  → fall through to normal /payments/new form
 *
 * SDD change: register-payment-shortcut. Phase 1 (T-01..T-08).
 */

export type ShortcutSourceKind = "sale" | "purchase";

export type ShortcutSource = {
  kind: ShortcutSourceKind;
  id: string;
  contactId: string;
  voucherCode: string;
  number: number;
  referenceNumber: string | null;
  allocationTargetId: string;
  balance: Decimal;
  defaultDescription: string;
};

export type ShortcutSourceResult =
  | { kind: "ok"; source: ShortcutSource }
  | { kind: "not-found" }
  | { kind: "cross-org" }
  | { kind: "voided" }
  | { kind: "fully-paid" }
  | { kind: "invalid-params" };

export interface FetchShortcutSourceParams {
  orgId: string;
  type: "COBRO" | "PAGO";
  saleId?: string;
  purchaseId?: string;
}

export async function fetchShortcutSource(
  params: FetchShortcutSourceParams,
): Promise<ShortcutSourceResult> {
  const { orgId, type, saleId, purchaseId } = params;

  const hasSale = Boolean(saleId);
  const hasPurchase = Boolean(purchaseId);
  if (hasSale === hasPurchase) {
    // XOR: both present OR neither present → invalid.
    return { kind: "invalid-params" };
  }

  // type ↔ id-kind agreement: COBRO must carry a saleId, PAGO a purchaseId.
  if ((hasSale && type !== "COBRO") || (hasPurchase && type !== "PAGO")) {
    return { kind: "invalid-params" };
  }

  const sale = await prisma.sale.findUnique({
    where: { id: saleId as string },
    include: { receivable: true },
  });

  if (!sale) {
    return { kind: "not-found" };
  }

  if (sale.organizationId !== orgId) {
    return { kind: "cross-org" };
  }

  if (sale.status === "VOIDED") {
    return { kind: "voided" };
  }

  if (!sale.receivable) {
    return { kind: "fully-paid" };
  }

  const balance = new Decimal(sale.receivable.balance.toString());
  if (balance.lte(0)) {
    return { kind: "fully-paid" };
  }

  return {
    kind: "ok",
    source: {
      kind: "sale",
      id: sale.id,
      contactId: sale.contactId,
      voucherCode: `V-${sale.sequenceNumber}`,
      number: sale.sequenceNumber,
      referenceNumber:
        sale.referenceNumber == null ? null : String(sale.referenceNumber),
      allocationTargetId: sale.receivable.id,
      balance,
      defaultDescription: `Cobro Venta #${sale.sequenceNumber}`,
    },
  };
}

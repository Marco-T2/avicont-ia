import Decimal from "decimal.js";
import type { ShortcutSourceQueryPort } from "../../domain/ports/shortcut-source-query.port";

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
 * runtime value). Conversion from the port's `string` projection happens at
 * `new Decimal(...)`.
 *
 * DI: [PRISMA] cluster paydown (D4) — this helper used to import
 * `@/lib/prisma` directly (R5 violation: live DB client reached from
 * application/). It now depends on `ShortcutSourceQueryPort` (domain/ports),
 * injected by the caller. The Prisma-backed implementation lives in
 * `modules/payment/infrastructure/adapters/prisma-shortcut-source-query.adapter.ts`,
 * wired via `modules/payment/presentation/composition-root.ts`
 * (`makeShortcutSourceQueryPort`). Runtime behaviour is unchanged — same
 * queries, same results.
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

export interface FetchShortcutSourceDeps {
  query: ShortcutSourceQueryPort;
}

export async function fetchShortcutSource(
  params: FetchShortcutSourceParams,
  deps: FetchShortcutSourceDeps,
): Promise<ShortcutSourceResult> {
  const { orgId, type, saleId, purchaseId } = params;
  const { query } = deps;

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

  if (hasSale) {
    const sale = await query.findSaleWithReceivable(saleId as string);

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

    const balance = new Decimal(sale.receivable.balance);
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

  // Purchase branch (hasPurchase, type === "PAGO").
  const purchase = await query.findPurchaseWithPayable(purchaseId as string);

  if (!purchase) {
    return { kind: "not-found" };
  }
  if (purchase.organizationId !== orgId) {
    return { kind: "cross-org" };
  }
  if (purchase.status === "VOIDED") {
    return { kind: "voided" };
  }
  if (!purchase.payable) {
    return { kind: "fully-paid" };
  }

  const purchaseBalance = new Decimal(purchase.payable.balance);
  if (purchaseBalance.lte(0)) {
    return { kind: "fully-paid" };
  }

  return {
    kind: "ok",
    source: {
      kind: "purchase",
      id: purchase.id,
      contactId: purchase.contactId,
      voucherCode: `C-${purchase.sequenceNumber}`,
      number: purchase.sequenceNumber,
      referenceNumber:
        purchase.referenceNumber == null
          ? null
          : String(purchase.referenceNumber),
      allocationTargetId: purchase.payable.id,
      balance: purchaseBalance,
      defaultDescription: `Pago Compra #${purchase.sequenceNumber}`,
    },
  };
}

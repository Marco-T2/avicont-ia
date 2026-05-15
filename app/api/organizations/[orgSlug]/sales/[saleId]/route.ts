import { Prisma } from "@/generated/prisma/client";
import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { updateSaleSchema } from "@/modules/sale/presentation/schemas/sale.schemas";
import { UsersService } from "@/features/users/server";
import { makeSaleService } from "@/modules/sale/presentation/composition-root";
import { roundHalfUp } from "@/modules/accounting/shared/domain/money.utils";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

const saleService = makeSaleService();
const usersService = new UsersService();

const M = (v: number | undefined): MonetaryAmount =>
  v === undefined ? MonetaryAmount.zero() : MonetaryAmount.of(v);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; saleId: string }> },
) {
  try {
    const { orgSlug, saleId } = await params;
    const { orgId } = await requirePermission("sales", "read", orgSlug);

    const sale = await saleService.getById(orgId, saleId);

    return Response.json(sale);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; saleId: string }> },
) {
  try {
    const { orgSlug, saleId } = await params;
    const { session, orgId, role } = await requirePermission(
      "sales",
      "write",
      orgSlug,
    );
    const clerkUserId = session.userId;

    // Parse dryRun and confirmTrim at route level BEFORE Zod schema validation.
    // These are route-level concerns, not domain validation (D3).
    const body = await request.json();
    const { justification, dryRun, confirmTrim, ...rest } = body as {
      justification?: string;
      dryRun?: boolean;
      confirmTrim?: boolean;
      [key: string]: unknown;
    };
    const input = updateSaleSchema.parse(rest);

    // dryRun: true → return preview without executing any writes
    if (dryRun === true) {
      const newTotal = computeNewTotal(input);
      const { trimPreview } = await saleService.getEditPreview(orgId, saleId, newTotal);
      return Response.json({ dryRun: true, trimPreview });
    }

    // No confirmTrim → run a preview; if trim is needed, require confirmation
    if (!confirmTrim) {
      const newTotal = computeNewTotal(input);
      const { trimPreview } = await saleService.getEditPreview(orgId, saleId, newTotal);
      if (trimPreview.length > 0) {
        return Response.json({ requiresConfirmation: true, trimPreview });
      }
    }

    // confirmTrim: true OR no trim needed → proceed with normal edit
    const user = await usersService.resolveByClerkId(clerkUserId);
    const wrappedInput = {
      ...input,
      date: input.date !== undefined ? new Date(input.date) : undefined,
      details: input.details?.map((d) => ({ ...d, lineAmount: M(d.lineAmount) })),
    };
    const result = await saleService.update(orgId, saleId, wrappedInput, {
      userId: user.id,
      role,
      justification,
    });

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Computes the new total amount from the update input's details array.
 * Falls back to 0 if details are absent (server will use existing total).
 */
function computeNewTotal(input: { details?: Array<{ lineAmount?: number; quantity?: number; unitPrice?: number }> }): number {
  if (!input.details || input.details.length === 0) return 0;
  return input.details.reduce((sum, d) => {
    const qty = d.quantity ?? 1;
    const unitPrice = d.unitPrice ?? 0;
    const line = d.lineAmount !== undefined
      ? d.lineAmount
      : roundHalfUp(new Prisma.Decimal(qty).mul(unitPrice)).toNumber();
    return sum + line;
  }, 0);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; saleId: string }> },
) {
  try {
    const { orgSlug, saleId } = await params;
    const { orgId } = await requirePermission("sales", "write", orgSlug);

    await saleService.delete(orgId, saleId);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}

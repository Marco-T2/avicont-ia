import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { PurchaseService } from "@/features/purchase";
import { updatePurchaseSchema } from "@/features/purchase";
import { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";
import { UsersService } from "@/features/shared/users.service";

const ivaBooksService = new IvaBooksService();
const purchaseService = new PurchaseService(
  undefined, // repo
  undefined, // orgSettingsService
  undefined, // autoEntryGenerator
  undefined, // contactsService
  undefined, // payablesRepo
  undefined, // balancesService
  undefined, // periodsService
  undefined, // accountsRepo
  undefined, // journalRepo
  ivaBooksService,
);
const usersService = new UsersService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; purchaseId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, purchaseId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const purchase = await purchaseService.getById(orgId, purchaseId);

    return Response.json(purchase);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; purchaseId: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug, purchaseId } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);
    const member = await requireRole(clerkUserId, orgId, ["owner", "admin", "contador"]);

    // Parse dryRun and confirmTrim at route level BEFORE Zod schema validation.
    // These are route-level concerns, not domain validation (mirrors Sale route D3/D5).
    const body = await request.json();
    const { justification, dryRun, confirmTrim, ...rest } = body as {
      justification?: string;
      dryRun?: boolean;
      confirmTrim?: boolean;
      [key: string]: unknown;
    };
    const input = updatePurchaseSchema.parse(rest);

    // dryRun: true → return preview without executing any writes
    if (dryRun === true) {
      const newTotal = computeNewTotal(input);
      const { trimPreview } = await purchaseService.getEditPreview(purchaseId, orgId, newTotal);
      return Response.json({ dryRun: true, trimPreview });
    }

    // No confirmTrim → run a preview; if trim is needed, require confirmation
    if (!confirmTrim) {
      const newTotal = computeNewTotal(input);
      const { trimPreview } = await purchaseService.getEditPreview(purchaseId, orgId, newTotal);
      if (trimPreview.length > 0) {
        return Response.json({ requiresConfirmation: true, trimPreview });
      }
    }

    // confirmTrim: true OR no trim needed → proceed with normal edit
    const user = await usersService.resolveByClerkId(clerkUserId);
    const purchase = await purchaseService.update(orgId, purchaseId, input, user.id, member.role, justification);

    return Response.json(purchase);
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
    const line = d.lineAmount !== undefined ? d.lineAmount : Math.round(qty * unitPrice * 100) / 100;
    return sum + line;
  }, 0);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; purchaseId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, purchaseId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    await purchaseService.delete(orgId, purchaseId);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}

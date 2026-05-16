import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeAnnualCloseService,
  annualCloseRequestSchema,
} from "@/modules/annual-close/presentation/server";
import { UsersService } from "@/features/users/server";

/**
 * POST /api/organizations/[orgSlug]/annual-close (Phase 5.4 GREEN).
 *
 * Per design rev 2 §7 + spec REQ-2.6 + REQ-2.3:
 *   - RBAC: `requirePermission("period", "close", orgSlug)` → 403 on reject.
 *   - Zod validation: `annualCloseRequestSchema` parses `{year, justification}`.
 *     Failure throws `ZodError` → `handleError` maps to 400.
 *   - Calls `service.close(orgId, year, userId, justification)`.
 *   - Errors propagate to `handleError`, which dispatches by class:
 *     - AppError subclasses: status = error.statusCode (set per REQ-2.3).
 *     - W-7 carve-out: `MissingResultAccountError.statusCode === 500` because
 *       the absence of `3.2.2 Resultado de la Gestión` is a chart-of-accounts
 *       seed bug, not user input. Handler does NOT special-case it — the
 *       error class itself encodes the 500 (see annual-close-errors.ts).
 *
 * **Next.js 16 async `params`**: `params: Promise<{ orgSlug: string }>` per
 * `node_modules/next/dist/docs/...`. Awaited at handler entry; matches the
 * monthly-close route pattern verbatim.
 *
 * Response body:
 *   - Success: `AnnualCloseResult` shape (see annual-close.service.ts).
 *   - Error: `{ error, code, details?, ...status }` per handleError.
 */

const service = makeAnnualCloseService();
const usersService = new UsersService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { session, orgId } = await requirePermission(
      "period",
      "close",
      orgSlug,
    );

    const body = await request.json();
    const parsed = annualCloseRequestSchema.parse(body);

    const user = await usersService.resolveByClerkId(session.userId);

    const result = await service.close(
      orgId,
      parsed.year,
      user.id,
      parsed.justification,
    );

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}

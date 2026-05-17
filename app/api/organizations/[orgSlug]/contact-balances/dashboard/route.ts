import { z } from "zod";
import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { makeContactBalancesService } from "@/modules/contact-balances/presentation/server";
import { ValidationError } from "@/features/shared/errors";

export const runtime = "nodejs";

const service = makeContactBalancesService();

/**
 * GET /api/organizations/[orgSlug]/contact-balances/dashboard
 *
 * Dashboard de contactos por tipo (CxC = CLIENTE, CxP = PROVEEDOR) —
 * spec REQ "API Contract — Contact Balances" + "Contact Dashboard".
 *
 * Query params:
 *   type                — required ("CLIENTE" | "PROVEEDOR").
 *   includeZeroBalance  — optional boolean (string coerced). Default false.
 *   page                — optional int. Default 1.
 *   pageSize            — optional int 1..100. Default 20.
 *   sort                — optional ("openBalance" | "name" |
 *                         "lastMovementDate"). Default "openBalance".
 *   direction           — optional ("asc" | "desc"). Default "desc".
 *
 * Permissions: `reports:read` (sister parity con /contact-ledger).
 *
 * Response: ContactsDashboardPaginatedResult — items have openBalance as
 * Decimal string (DEC-1 boundary).
 */
const querySchema = z.object({
  type: z.enum(["CLIENTE", "PROVEEDOR"]),
  includeZeroBalance: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(["openBalance", "name", "lastMovementDate"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("reports", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const raw = Object.fromEntries(searchParams);

    let parsed: z.infer<typeof querySchema>;
    try {
      parsed = querySchema.parse(raw);
    } catch (zerr) {
      // Surface Zod validation as ValidationError (422) for consistency
      // with sister routes; handleError already maps `.flatten` Zod errors
      // to 400, but we elevate type=missing/invalid to a domain
      // ValidationError to keep status codes consistent across the
      // contact-* surfaces.
      throw new ValidationError(
        zerr instanceof z.ZodError
          ? `Parámetros inválidos: ${zerr.issues
              .map((i) => `${i.path.join(".")} ${i.message}`)
              .join("; ")}`
          : "Parámetros inválidos",
      );
    }

    const result = await service.listContactsWithOpenBalance(
      orgId,
      parsed.type,
      {
        includeZeroBalance: parsed.includeZeroBalance,
        page: parsed.page,
        pageSize: parsed.pageSize,
        sort: parsed.sort,
        direction: parsed.direction,
      },
    );
    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}

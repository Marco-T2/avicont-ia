import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeMonthlyCloseService,
  closeRequestSchema,
} from "@/modules/monthly-close/presentation/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { UsersService } from "@/features/users/server";

const service = makeMonthlyCloseService();
const periodsService = makeFiscalPeriodsService();
const usersService = new UsersService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { session, orgId } = await requirePermission("period", "close", orgSlug);

    const body = await request.json();
    const parsed = closeRequestSchema.parse(body); // throws ZodError → handleError maps to 400

    const user = await usersService.resolveByClerkId(session.userId);

    // Justification was removed from the UI (friction without audit value —
    // mirror del annual-close pattern). Auto-generate a deterministic string
    // que pase la MIN_JUSTIFICATION_LENGTH invariant del service y deje un
    // audit_logs.justification trail legible. Resolvemos el period name
    // primero para evitar UUIDs feos en la audit trail.
    const period = await periodsService.getById(orgId, parsed.periodId);
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const autoJustification = `Cierre mensual del período ${period.name} ejecutado el ${today} (justificación auto-generada por el sistema)`;

    const result = await service.close(
      orgId,
      parsed.periodId,
      user.id,
      autoJustification,
    );

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}

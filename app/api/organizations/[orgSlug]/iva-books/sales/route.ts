import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";
import {
  createSaleInputSchema,
  listQuerySchema,
  type CreateSaleInputDto,
} from "@/features/accounting/iva-books/iva-books.validation";
import type { CreateSaleInput } from "@/features/accounting/iva-books/iva-books.types";
import { Prisma } from "@/generated/prisma/client";

const service = new IvaBooksService();

/**
 * Convierte los campos monetarios string del DTO Zod a Prisma.Decimal
 * antes de pasarlos al service.
 */
function toSaleInput(dto: CreateSaleInputDto): CreateSaleInput {
  const D = (v: string) => new Prisma.Decimal(v);
  return {
    ...dto,
    importeTotal: D(dto.importeTotal),
    importeIce: D(dto.importeIce),
    importeIehd: D(dto.importeIehd),
    importeIpj: D(dto.importeIpj),
    tasas: D(dto.tasas),
    otrosNoSujetos: D(dto.otrosNoSujetos),
    exentos: D(dto.exentos),
    tasaCero: D(dto.tasaCero),
    subtotal: D(dto.subtotal),
    dfIva: D(dto.dfIva),
    codigoDescuentoAdicional: D(dto.codigoDescuentoAdicional),
    importeGiftCard: D(dto.importeGiftCard),
    baseIvaSujetoCf: D(dto.baseIvaSujetoCf),
    dfCfIva: D(dto.dfCfIva),
    tasaIva: D(dto.tasaIva),
  };
}

/**
 * GET /api/organizations/[orgSlug]/iva-books/sales
 *
 * Lista entradas del Libro de Ventas IVA filtradas por período y/o estado.
 *
 * Query params:
 * - fiscalPeriodId (opcional): filtra por período fiscal
 * - status (opcional): ACTIVE | VOIDED
 *
 * Respuestas:
 * - 200: array de IvaSalesBookDTO
 * - 401: sin sesión Clerk
 * - 403: sin acceso a la org
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const { searchParams } = new URL(request.url);
    const query = listQuerySchema.parse({
      fiscalPeriodId: searchParams.get("fiscalPeriodId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const entries = await service.listSalesByPeriod(orgId, query);

    return Response.json(entries);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/organizations/[orgSlug]/iva-books/sales
 *
 * Crea una nueva entrada en el Libro de Ventas IVA.
 * El campo `estadoSIN` es obligatorio (A/V/C/L) y se almacena tal cual (sin lógica automática).
 * El service recomputa campos IVA server-side (defense-in-depth).
 *
 * Respuestas:
 * - 201: IvaSalesBookDTO creado
 * - 400: body inválido (Zod), incl. estadoSIN fuera de A/V/C/L
 * - 401: sin sesión Clerk
 * - 403: sin acceso a la org
 * - 409: entrada duplicada (unique constraint)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const dto = createSaleInputSchema.parse(body);
    const input = toSaleInput(dto);

    const entry = await service.createSale(orgId, userId, input);

    return Response.json(entry, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

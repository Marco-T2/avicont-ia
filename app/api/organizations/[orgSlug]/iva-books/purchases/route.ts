import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { IvaBooksService, IvaBooksRepository } from "@/features/accounting/iva-books/server";
import { SaleService } from "@/features/sale/sale.service";
import { PurchaseService } from "@/features/purchase/purchase.service";
import {
  createPurchaseInputSchema,
  listQuerySchema,
  type CreatePurchaseInputDto,
  type CreatePurchaseInput,
} from "@/features/accounting/iva-books";
import { Prisma } from "@/generated/prisma/client";

const service = new IvaBooksService(
  new IvaBooksRepository(),
  new SaleService(),
  new PurchaseService(),
);

/**
 * Convierte los campos monetarios string del DTO Zod a Prisma.Decimal
 * antes de pasarlos al service.
 */
function toPurchaseInput(dto: CreatePurchaseInputDto): CreatePurchaseInput {
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
 * GET /api/organizations/[orgSlug]/iva-books/purchases
 *
 * Lista entradas del Libro de Compras IVA filtradas por período y/o estado.
 *
 * Query params:
 * - fiscalPeriodId (opcional): filtra por período fiscal
 * - status (opcional): ACTIVE | VOIDED
 *
 * Respuestas:
 * - 200: array de IvaPurchaseBookDTO
 * - 401: sin sesión Clerk
 * - 403: sin acceso a la org
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("reports", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const query = listQuerySchema.parse({
      fiscalPeriodId: searchParams.get("fiscalPeriodId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const entries = await service.listPurchasesByPeriod(orgId, query);

    return Response.json(entries);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/organizations/[orgSlug]/iva-books/purchases
 *
 * Crea una nueva entrada en el Libro de Compras IVA.
 * El service recomputa campos IVA server-side (defense-in-depth).
 *
 * Respuestas:
 * - 201: IvaPurchaseBookDTO creado
 * - 400: body inválido (Zod)
 * - 401: sin sesión Clerk
 * - 403: sin acceso a la org
 * - 409: entrada duplicada (unique constraint)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { session, orgId } = await requirePermission(
      "reports",
      "write",
      orgSlug,
    );
    const userId = session.userId;

    const body = await request.json();
    const dto = createPurchaseInputSchema.parse(body);
    const input = toPurchaseInput(dto);

    const entry = await service.createPurchase(orgId, userId, input);

    return Response.json(entry, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

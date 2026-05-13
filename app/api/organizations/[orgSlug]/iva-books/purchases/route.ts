import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  createPurchaseInputSchema,
  listQuerySchema,
  type CreatePurchaseInputDto,
} from "@/modules/iva-books/presentation/server";
import { makeIvaBookService } from "@/modules/iva-books/presentation/composition-root";
import type { RegenerateIvaPurchaseBookInput } from "@/modules/iva-books/application/iva-book.service";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

const service = makeIvaBookService();

/**
 * Adapter route → hex `regeneratePurchase` input. POC #11.0c A4-a Ciclo 2 — Q2
 * lock: `MonetaryAmount.of(string)` directo + `codigoControl ?? ""` (Q2.5)
 * + `fechaFactura "YYYY-MM-DD"` → `Date`. Defense-in-depth: hex recomputa
 * `IvaCalcResult` server-side; los 5 campos derivados que el DTO Zod requiere
 * (`subtotal`/`dfIva`/`baseIvaSujetoCf`/`dfCfIva`/`tasaIva`) se ignoran acá
 * por diseño (paridad legacy `computeIvaFields`). Asimetría con sale-side:
 * `tipoCompra` raw int (vs `estadoSIN` VO), `nitProveedor` (vs `nitCliente`).
 */
function toRegenerateIvaPurchaseBookInput(
  dto: CreatePurchaseInputDto,
  organizationId: string,
  userId: string,
): RegenerateIvaPurchaseBookInput {
  const M = (v: string) => MonetaryAmount.of(v);
  return {
    organizationId,
    userId,
    fiscalPeriodId: dto.fiscalPeriodId,
    purchaseId: dto.purchaseId,
    fechaFactura: new Date(dto.fechaFactura),
    nitProveedor: dto.nitProveedor,
    razonSocial: dto.razonSocial,
    numeroFactura: dto.numeroFactura,
    codigoAutorizacion: dto.codigoAutorizacion,
    codigoControl: dto.codigoControl ?? "",
    tipoCompra: dto.tipoCompra,
    notes: dto.notes ?? null,
    inputs: {
      importeTotal: M(dto.importeTotal),
      importeIce: M(dto.importeIce),
      importeIehd: M(dto.importeIehd),
      importeIpj: M(dto.importeIpj),
      tasas: M(dto.tasas),
      otrosNoSujetos: M(dto.otrosNoSujetos),
      exentos: M(dto.exentos),
      tasaCero: M(dto.tasaCero),
      codigoDescuentoAdicional: M(dto.codigoDescuentoAdicional),
      importeGiftCard: M(dto.importeGiftCard),
    },
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
    const input = toRegenerateIvaPurchaseBookInput(dto, orgId, userId);

    const result = await service.regeneratePurchase(input);

    return Response.json(result.entry, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

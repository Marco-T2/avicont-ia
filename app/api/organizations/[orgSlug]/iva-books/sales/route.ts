import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  createSaleInputSchema,
  listQuerySchema,
  type CreateSaleInputDto,
} from "@/modules/iva-books/presentation/server";
import { makeIvaBookService } from "@/modules/iva-books/presentation/composition-root";
import type { RegenerateIvaSalesBookInput } from "@/modules/iva-books/application/iva-book.service";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

const service = makeIvaBookService();

/**
 * Adapter route → hex `regenerateSale` input. POC #11.0c A4-a Ciclo 1 — Q2
 * lock: `MonetaryAmount.of(string)` directo + `codigoControl ?? ""` (Q2.5)
 * + `fechaFactura "YYYY-MM-DD"` → `Date`. Defense-in-depth: hex recomputa
 * `IvaCalcResult` server-side; los 5 campos derivados que el DTO Zod requiere
 * (`subtotal`/`dfIva`/`baseIvaSujetoCf`/`dfCfIva`/`tasaIva`) se ignoran acá
 * por diseño (paridad legacy `computeIvaFields`).
 */
function toRegenerateIvaSalesBookInput(
  dto: CreateSaleInputDto,
  organizationId: string,
  userId: string,
): RegenerateIvaSalesBookInput {
  const M = (v: string) => MonetaryAmount.of(v);
  return {
    organizationId,
    userId,
    fiscalPeriodId: dto.fiscalPeriodId,
    saleId: dto.saleId,
    fechaFactura: new Date(dto.fechaFactura),
    nitCliente: dto.nitCliente,
    razonSocial: dto.razonSocial,
    numeroFactura: dto.numeroFactura,
    codigoAutorizacion: dto.codigoAutorizacion,
    codigoControl: dto.codigoControl ?? "",
    estadoSIN: dto.estadoSIN,
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
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("reports", "read", orgSlug);

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
    const { orgSlug } = await params;
    const { session, orgId } = await requirePermission(
      "reports",
      "write",
      orgSlug,
    );
    const userId = session.userId;

    const body = await request.json();
    const dto = createSaleInputSchema.parse(body);
    const input = toRegenerateIvaSalesBookInput(dto, orgId, userId);

    const result = await service.regenerateSale(input);

    return Response.json(result.entry, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

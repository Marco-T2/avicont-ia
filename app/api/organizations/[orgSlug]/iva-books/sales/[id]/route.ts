import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  updateSaleInputSchema,
  type UpdateSaleInputDto,
} from "@/modules/iva-books/presentation/server";
import { makeIvaBookService } from "@/modules/iva-books/presentation/composition-root";
import type {
  RecomputeIvaSalesBookInput,
  PartialIvaSalesBookEntryInputs,
} from "@/modules/iva-books/application/iva-book.service";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

const service = makeIvaBookService();

/**
 * Adapter route → hex `recomputeSale` input parcial. POC #11.0c A4-a Ciclo 1
 * — Q2 lock: `MonetaryAmount.of(string)` directo solo para campos presentes
 * en el patch + `codigoControl ?? ""` (Q2.5) + `fechaFactura "YYYY-MM-DD"`
 * → `Date`. Defense-in-depth: hex recomputa `IvaCalcResult` server-side
 * cuando hay monetary change. Notes patch-vs-preserve via `"notes" in dto`
 * (mirror hex `:397` distingo).
 */
function toRecomputeIvaSalesBookInput(
  dto: UpdateSaleInputDto,
  organizationId: string,
  userId: string,
  id: string,
): RecomputeIvaSalesBookInput {
  const M = (v: string) => MonetaryAmount.of(v);

  const inputs: PartialIvaSalesBookEntryInputs = {
    ...(dto.importeTotal !== undefined ? { importeTotal: M(dto.importeTotal) } : {}),
    ...(dto.importeIce !== undefined ? { importeIce: M(dto.importeIce) } : {}),
    ...(dto.importeIehd !== undefined ? { importeIehd: M(dto.importeIehd) } : {}),
    ...(dto.importeIpj !== undefined ? { importeIpj: M(dto.importeIpj) } : {}),
    ...(dto.tasas !== undefined ? { tasas: M(dto.tasas) } : {}),
    ...(dto.otrosNoSujetos !== undefined ? { otrosNoSujetos: M(dto.otrosNoSujetos) } : {}),
    ...(dto.exentos !== undefined ? { exentos: M(dto.exentos) } : {}),
    ...(dto.tasaCero !== undefined ? { tasaCero: M(dto.tasaCero) } : {}),
    ...(dto.codigoDescuentoAdicional !== undefined
      ? { codigoDescuentoAdicional: M(dto.codigoDescuentoAdicional) }
      : {}),
    ...(dto.importeGiftCard !== undefined ? { importeGiftCard: M(dto.importeGiftCard) } : {}),
  };

  return {
    organizationId,
    userId,
    id,
    ...(dto.fechaFactura !== undefined ? { fechaFactura: new Date(dto.fechaFactura) } : {}),
    ...(dto.nitCliente !== undefined ? { nitCliente: dto.nitCliente } : {}),
    ...(dto.razonSocial !== undefined ? { razonSocial: dto.razonSocial } : {}),
    ...(dto.numeroFactura !== undefined ? { numeroFactura: dto.numeroFactura } : {}),
    ...(dto.codigoAutorizacion !== undefined ? { codigoAutorizacion: dto.codigoAutorizacion } : {}),
    ...(dto.codigoControl !== undefined ? { codigoControl: dto.codigoControl ?? "" } : {}),
    ...(dto.estadoSIN !== undefined ? { estadoSIN: dto.estadoSIN } : {}),
    ...("notes" in dto ? { notes: dto.notes ?? null } : {}),
    ...(Object.keys(inputs).length > 0 ? { inputs } : {}),
  };
}

/**
 * GET /api/organizations/[orgSlug]/iva-books/sales/[id]
 *
 * Retorna una entrada del Libro de Ventas IVA por id.
 *
 * Respuestas:
 * - 200: IvaSalesBookDTO
 * - 401: sin sesión Clerk
 * - 403: sin acceso a la org
 * - 404: entrada no encontrada (hex `IvaBookNotFound`)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; id: string }> },
) {
  try {
    const { orgSlug, id } = await params;
    const { orgId } = await requirePermission("reports", "read", orgSlug);

    const entry = await service.getSaleById(orgId, id);

    return Response.json(entry);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/organizations/[orgSlug]/iva-books/sales/[id]
 *
 * Actualiza campos de una entrada del Libro de Ventas IVA.
 * `estadoSIN` puede actualizarse manualmente (A/V/C/L) — sin lógica automática.
 * Si se envían campos monetarios, el service recomputa IVA.
 *
 * Respuestas:
 * - 200: IvaSalesBookDTO actualizado
 * - 400: body inválido (Zod)
 * - 401: sin sesión Clerk
 * - 403: sin acceso a la org
 * - 404: entrada no encontrada (hex `IvaBookNotFound`)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; id: string }> },
) {
  try {
    const { orgSlug, id } = await params;
    const { session, orgId } = await requirePermission(
      "reports",
      "write",
      orgSlug,
    );
    const userId = session.userId;

    const body = await request.json();
    const dto = updateSaleInputSchema.parse(body);
    const input = toRecomputeIvaSalesBookInput(dto, orgId, userId, id);

    const result = await service.recomputeSale(input);

    return Response.json(result.entry);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/organizations/[orgSlug]/iva-books/sales/[id]
 *
 * Anula (soft-delete) una entrada del Libro de Ventas IVA (status → VOIDED).
 * CRÍTICO: estadoSIN NO se modifica — es ortogonal al status de lifecycle.
 * No elimina el registro de la DB.
 *
 * Respuestas:
 * - 204: anulado correctamente
 * - 401: sin sesión Clerk
 * - 403: sin acceso a la org
 * - 404: entrada no encontrada (hex `IvaBookNotFound`)
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; id: string }> },
) {
  try {
    const { orgSlug, id } = await params;
    const { session, orgId } = await requirePermission(
      "reports",
      "write",
      orgSlug,
    );
    const userId = session.userId;

    await service.voidSale({ organizationId: orgId, userId, id });

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}

import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  updatePurchaseInputSchema,
  type UpdatePurchaseInputDto,
} from "@/modules/iva-books/presentation/server";
import { makeIvaBookService } from "@/modules/iva-books/presentation/composition-root";
import type {
  RecomputeIvaPurchaseBookInput,
  PartialIvaPurchaseBookEntryInputs,
} from "@/modules/iva-books/application/iva-book.service";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

const service = makeIvaBookService();

/**
 * Adapter route → hex `recomputePurchase` input parcial. POC #11.0c A4-a Ciclo
 * 2 — Q2 lock: `MonetaryAmount.of(string)` directo solo para campos presentes
 * en el patch + `codigoControl ?? ""` (Q2.5) + `fechaFactura "YYYY-MM-DD"`
 * → `Date`. Defense-in-depth: hex recomputa `IvaCalcResult` server-side
 * cuando hay monetary change. Notes patch-vs-preserve via `"notes" in dto`
 * (mirror hex `:468` distingo). Asimetría con sale-side: `tipoCompra` raw int
 * (vs `estadoSIN` VO), `nitProveedor` (vs `nitCliente`).
 */
function toRecomputeIvaPurchaseBookInput(
  dto: UpdatePurchaseInputDto,
  organizationId: string,
  userId: string,
  id: string,
): RecomputeIvaPurchaseBookInput {
  const M = (v: string) => MonetaryAmount.of(v);

  const inputs: PartialIvaPurchaseBookEntryInputs = {
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
    ...(dto.nitProveedor !== undefined ? { nitProveedor: dto.nitProveedor } : {}),
    ...(dto.razonSocial !== undefined ? { razonSocial: dto.razonSocial } : {}),
    ...(dto.numeroFactura !== undefined ? { numeroFactura: dto.numeroFactura } : {}),
    ...(dto.codigoAutorizacion !== undefined ? { codigoAutorizacion: dto.codigoAutorizacion } : {}),
    ...(dto.codigoControl !== undefined ? { codigoControl: dto.codigoControl ?? "" } : {}),
    ...(dto.tipoCompra !== undefined ? { tipoCompra: dto.tipoCompra } : {}),
    ...("notes" in dto ? { notes: dto.notes ?? null } : {}),
    ...(Object.keys(inputs).length > 0 ? { inputs } : {}),
  };
}

/**
 * GET /api/organizations/[orgSlug]/iva-books/purchases/[id]
 *
 * Retorna una entrada del Libro de Compras IVA por id.
 *
 * Respuestas:
 * - 200: IvaPurchaseBookDTO
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

    const entry = await service.getPurchaseById(orgId, id);

    return Response.json(entry);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]
 *
 * Actualiza campos de una entrada del Libro de Compras IVA.
 * Si se envían campos monetarios, el service recomputa IVA.
 *
 * Respuestas:
 * - 200: IvaPurchaseBookDTO actualizado
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
    const dto = updatePurchaseInputSchema.parse(body);
    const input = toRecomputeIvaPurchaseBookInput(dto, orgId, userId, id);

    const result = await service.recomputePurchase(input);

    return Response.json(result.entry);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/organizations/[orgSlug]/iva-books/purchases/[id]
 *
 * Anula (soft-delete) una entrada del Libro de Compras IVA (status → VOIDED).
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

    await service.voidPurchase({ organizationId: orgId, userId, id });

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}

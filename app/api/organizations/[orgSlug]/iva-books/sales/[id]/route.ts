import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { IvaBooksService, IvaBooksRepository } from "@/features/accounting/iva-books/server";
import { SaleService } from "@/features/sale/server";
import { PurchaseService } from "@/features/purchase/server";
import {
  updateSaleInputSchema,
  type UpdateSaleInputDto,
  type UpdateSaleInput,
} from "@/features/accounting/iva-books";
import { NotFoundError } from "@/features/shared/errors";
import { Prisma } from "@/generated/prisma/client";

const service = new IvaBooksService(
  new IvaBooksRepository(),
  new SaleService(),
  new PurchaseService(),
);

/**
 * Convierte los campos monetarios string del DTO Zod parcial a Prisma.Decimal.
 * Solo convierte los campos que están presentes en el patch.
 * El resultado final es seguro porque todos los campos monetarios son convertidos explícitamente.
 */
function toSaleUpdateInput(dto: UpdateSaleInputDto): UpdateSaleInput {
  const D = (v: string) => new Prisma.Decimal(v);
  const result: UpdateSaleInput = {
    ...(dto.fechaFactura !== undefined ? { fechaFactura: dto.fechaFactura } : {}),
    ...(dto.nitCliente !== undefined ? { nitCliente: dto.nitCliente } : {}),
    ...(dto.razonSocial !== undefined ? { razonSocial: dto.razonSocial } : {}),
    ...(dto.numeroFactura !== undefined ? { numeroFactura: dto.numeroFactura } : {}),
    ...(dto.codigoAutorizacion !== undefined ? { codigoAutorizacion: dto.codigoAutorizacion } : {}),
    ...(dto.codigoControl !== undefined ? { codigoControl: dto.codigoControl } : {}),
    ...(dto.estadoSIN !== undefined ? { estadoSIN: dto.estadoSIN } : {}),
    ...(dto.fiscalPeriodId !== undefined ? { fiscalPeriodId: dto.fiscalPeriodId } : {}),
    ...(dto.saleId !== undefined ? { saleId: dto.saleId } : {}),
    ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    ...(dto.importeTotal !== undefined ? { importeTotal: D(dto.importeTotal) } : {}),
    ...(dto.importeIce !== undefined ? { importeIce: D(dto.importeIce) } : {}),
    ...(dto.importeIehd !== undefined ? { importeIehd: D(dto.importeIehd) } : {}),
    ...(dto.importeIpj !== undefined ? { importeIpj: D(dto.importeIpj) } : {}),
    ...(dto.tasas !== undefined ? { tasas: D(dto.tasas) } : {}),
    ...(dto.otrosNoSujetos !== undefined ? { otrosNoSujetos: D(dto.otrosNoSujetos) } : {}),
    ...(dto.exentos !== undefined ? { exentos: D(dto.exentos) } : {}),
    ...(dto.tasaCero !== undefined ? { tasaCero: D(dto.tasaCero) } : {}),
    ...(dto.subtotal !== undefined ? { subtotal: D(dto.subtotal) } : {}),
    ...(dto.dfIva !== undefined ? { dfIva: D(dto.dfIva) } : {}),
    ...(dto.codigoDescuentoAdicional !== undefined ? { codigoDescuentoAdicional: D(dto.codigoDescuentoAdicional) } : {}),
    ...(dto.importeGiftCard !== undefined ? { importeGiftCard: D(dto.importeGiftCard) } : {}),
    ...(dto.baseIvaSujetoCf !== undefined ? { baseIvaSujetoCf: D(dto.baseIvaSujetoCf) } : {}),
    ...(dto.dfCfIva !== undefined ? { dfCfIva: D(dto.dfCfIva) } : {}),
    ...(dto.tasaIva !== undefined ? { tasaIva: D(dto.tasaIva) } : {}),
  };
  return result;
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
 * - 404: entrada no encontrada
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; id: string }> },
) {
  try {
    const { orgSlug, id } = await params;
    const { orgId } = await requirePermission("reports", "read", orgSlug);

    const entry = await service.findSaleById(orgId, id);
    if (!entry) throw new NotFoundError("Entrada de Libro de Ventas");

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
 * - 404: entrada no encontrada
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
    const input = toSaleUpdateInput(dto);

    const entry = await service.updateSale(orgId, userId, id, input);

    return Response.json(entry);
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
 * - 404: entrada no encontrada
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

    await service.voidSale(orgId, userId, id);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}

import { BaseRepository } from "@/features/shared/base.repository";
import { ConflictError, NotFoundError } from "@/features/shared/errors";
import { Prisma } from "@/generated/prisma/client";
import type { IvaBookStatus } from "@/generated/prisma/enums";
import type {
  CreatePurchaseInput,
  CreateSaleInput,
  IvaPurchaseBookDTO,
  IvaSalesBookDTO,
  UpdatePurchaseInput,
  UpdateSaleInput,
} from "./iva-books.types";

// ── Tipos de filtro ───────────────────────────────────────────────────────────

export type ListIvaBooksFilter = {
  fiscalPeriodId?: string;
  status?: IvaBookStatus;
};

// ── Helpers de mapeo ──────────────────────────────────────────────────────────

/**
 * Convierte un registro Prisma IvaPurchaseBook en un IvaPurchaseBookDTO.
 * Preserva todos los Decimal como Prisma.Decimal (no los convierte a number).
 */
function toPurchaseDTO(row: {
  id: string;
  organizationId: string;
  fiscalPeriodId: string;
  purchaseId: string | null;
  fechaFactura: Date;
  nitProveedor: string;
  razonSocial: string;
  numeroFactura: string;
  codigoAutorizacion: string;
  codigoControl: string;
  tipoCompra: number;
  importeTotal: Prisma.Decimal;
  importeIce: Prisma.Decimal;
  importeIehd: Prisma.Decimal;
  importeIpj: Prisma.Decimal;
  tasas: Prisma.Decimal;
  otrosNoSujetos: Prisma.Decimal;
  exentos: Prisma.Decimal;
  tasaCero: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  dfIva: Prisma.Decimal;
  codigoDescuentoAdicional: Prisma.Decimal;
  importeGiftCard: Prisma.Decimal;
  baseIvaSujetoCf: Prisma.Decimal;
  dfCfIva: Prisma.Decimal;
  tasaIva: Prisma.Decimal;
  status: IvaBookStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): IvaPurchaseBookDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    fiscalPeriodId: row.fiscalPeriodId,
    purchaseId: row.purchaseId ?? undefined,
    fechaFactura: row.fechaFactura.toISOString().slice(0, 10),
    nitProveedor: row.nitProveedor,
    razonSocial: row.razonSocial,
    numeroFactura: row.numeroFactura,
    codigoAutorizacion: row.codigoAutorizacion,
    codigoControl: row.codigoControl,
    tipoCompra: row.tipoCompra,
    importeTotal: row.importeTotal,
    importeIce: row.importeIce,
    importeIehd: row.importeIehd,
    importeIpj: row.importeIpj,
    tasas: row.tasas,
    otrosNoSujetos: row.otrosNoSujetos,
    exentos: row.exentos,
    tasaCero: row.tasaCero,
    subtotal: row.subtotal,
    dfIva: row.dfIva,
    codigoDescuentoAdicional: row.codigoDescuentoAdicional,
    importeGiftCard: row.importeGiftCard,
    baseIvaSujetoCf: row.baseIvaSujetoCf,
    dfCfIva: row.dfCfIva,
    tasaIva: row.tasaIva,
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSaleDTO(row: {
  id: string;
  organizationId: string;
  fiscalPeriodId: string;
  saleId: string | null;
  fechaFactura: Date;
  nitCliente: string;
  razonSocial: string;
  numeroFactura: string;
  codigoAutorizacion: string;
  codigoControl: string;
  importeTotal: Prisma.Decimal;
  importeIce: Prisma.Decimal;
  importeIehd: Prisma.Decimal;
  importeIpj: Prisma.Decimal;
  tasas: Prisma.Decimal;
  otrosNoSujetos: Prisma.Decimal;
  exentos: Prisma.Decimal;
  tasaCero: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  dfIva: Prisma.Decimal;
  codigoDescuentoAdicional: Prisma.Decimal;
  importeGiftCard: Prisma.Decimal;
  baseIvaSujetoCf: Prisma.Decimal;
  dfCfIva: Prisma.Decimal;
  tasaIva: Prisma.Decimal;
  estadoSIN: "A" | "V" | "C" | "L";
  status: IvaBookStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): IvaSalesBookDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    fiscalPeriodId: row.fiscalPeriodId,
    saleId: row.saleId ?? undefined,
    fechaFactura: row.fechaFactura.toISOString().slice(0, 10),
    nitCliente: row.nitCliente,
    razonSocial: row.razonSocial,
    numeroFactura: row.numeroFactura,
    codigoAutorizacion: row.codigoAutorizacion,
    codigoControl: row.codigoControl,
    importeTotal: row.importeTotal,
    importeIce: row.importeIce,
    importeIehd: row.importeIehd,
    importeIpj: row.importeIpj,
    tasas: row.tasas,
    otrosNoSujetos: row.otrosNoSujetos,
    exentos: row.exentos,
    tasaCero: row.tasaCero,
    subtotal: row.subtotal,
    dfIva: row.dfIva,
    codigoDescuentoAdicional: row.codigoDescuentoAdicional,
    importeGiftCard: row.importeGiftCard,
    baseIvaSujetoCf: row.baseIvaSujetoCf,
    dfCfIva: row.dfCfIva,
    tasaIva: row.tasaIva,
    estadoSIN: row.estadoSIN,
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Captura de error de restricción única ────────────────────────────────────

/**
 * Si el error de Prisma es P2002 (unique constraint), lanza un ConflictError de dominio.
 * Cualquier otro error se re-lanza tal cual.
 */
function handlePrismaError(err: unknown, resource: string): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw new ConflictError(`${resource} con los mismos datos ya existe`);
  }
  throw err;
}

// ── IvaBooksRepository ────────────────────────────────────────────────────────

/**
 * Repositorio de IVA Books (Libro de Compras y Ventas).
 * Toda la lógica de acceso a Prisma vive aquí.
 * El service NO importa Prisma directamente.
 */
export class IvaBooksRepository extends BaseRepository {
  // ── Compras ────────────────────────────────────────────────────────────────

  async createPurchase(orgId: string, input: CreatePurchaseInput): Promise<IvaPurchaseBookDTO> {
    try {
      const row = await this.db.ivaPurchaseBook.create({
        data: {
          organizationId: orgId,
          fiscalPeriodId: input.fiscalPeriodId,
          purchaseId: input.purchaseId ?? null,
          fechaFactura: new Date(input.fechaFactura),
          nitProveedor: input.nitProveedor,
          razonSocial: input.razonSocial,
          numeroFactura: input.numeroFactura,
          codigoAutorizacion: input.codigoAutorizacion,
          codigoControl: input.codigoControl ?? "",
          tipoCompra: input.tipoCompra ?? 1,
          importeTotal: input.importeTotal,
          importeIce: input.importeIce,
          importeIehd: input.importeIehd,
          importeIpj: input.importeIpj,
          tasas: input.tasas,
          otrosNoSujetos: input.otrosNoSujetos,
          exentos: input.exentos,
          tasaCero: input.tasaCero,
          subtotal: input.subtotal,
          dfIva: input.dfIva,
          codigoDescuentoAdicional: input.codigoDescuentoAdicional,
          importeGiftCard: input.importeGiftCard,
          baseIvaSujetoCf: input.baseIvaSujetoCf,
          dfCfIva: input.dfCfIva,
          tasaIva: input.tasaIva,
          notes: input.notes ?? null,
        },
      });

      return toPurchaseDTO(row);
    } catch (err) {
      handlePrismaError(err, "Entrada de Libro de Compras");
    }
  }

  async findPurchaseById(orgId: string, id: string): Promise<IvaPurchaseBookDTO | null> {
    const row = await this.db.ivaPurchaseBook.findFirst({
      where: { id, organizationId: orgId },
    });
    return row ? toPurchaseDTO(row) : null;
  }

  async listPurchasesByPeriod(
    orgId: string,
    filter: ListIvaBooksFilter,
  ): Promise<IvaPurchaseBookDTO[]> {
    const rows = await this.db.ivaPurchaseBook.findMany({
      where: {
        organizationId: orgId,
        ...(filter.fiscalPeriodId ? { fiscalPeriodId: filter.fiscalPeriodId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: { fechaFactura: "asc" },
    });
    return rows.map(toPurchaseDTO);
  }

  async updatePurchase(
    orgId: string,
    id: string,
    input: UpdatePurchaseInput,
  ): Promise<IvaPurchaseBookDTO> {
    // Verificar existencia y scope antes de actualizar
    const existing = await this.db.ivaPurchaseBook.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundError("Entrada de Libro de Compras");

    const row = await this.db.ivaPurchaseBook.update({
      where: { id },
      data: {
        ...(input.fechaFactura !== undefined
          ? { fechaFactura: new Date(input.fechaFactura) }
          : {}),
        ...(input.nitProveedor !== undefined ? { nitProveedor: input.nitProveedor } : {}),
        ...(input.razonSocial !== undefined ? { razonSocial: input.razonSocial } : {}),
        ...(input.numeroFactura !== undefined ? { numeroFactura: input.numeroFactura } : {}),
        ...(input.codigoAutorizacion !== undefined
          ? { codigoAutorizacion: input.codigoAutorizacion }
          : {}),
        ...(input.codigoControl !== undefined ? { codigoControl: input.codigoControl } : {}),
        ...(input.tipoCompra !== undefined ? { tipoCompra: input.tipoCompra } : {}),
        ...(input.importeTotal !== undefined ? { importeTotal: input.importeTotal } : {}),
        ...(input.importeIce !== undefined ? { importeIce: input.importeIce } : {}),
        ...(input.importeIehd !== undefined ? { importeIehd: input.importeIehd } : {}),
        ...(input.importeIpj !== undefined ? { importeIpj: input.importeIpj } : {}),
        ...(input.tasas !== undefined ? { tasas: input.tasas } : {}),
        ...(input.otrosNoSujetos !== undefined ? { otrosNoSujetos: input.otrosNoSujetos } : {}),
        ...(input.exentos !== undefined ? { exentos: input.exentos } : {}),
        ...(input.tasaCero !== undefined ? { tasaCero: input.tasaCero } : {}),
        ...(input.subtotal !== undefined ? { subtotal: input.subtotal } : {}),
        ...(input.dfIva !== undefined ? { dfIva: input.dfIva } : {}),
        ...(input.codigoDescuentoAdicional !== undefined
          ? { codigoDescuentoAdicional: input.codigoDescuentoAdicional }
          : {}),
        ...(input.importeGiftCard !== undefined ? { importeGiftCard: input.importeGiftCard } : {}),
        ...(input.baseIvaSujetoCf !== undefined ? { baseIvaSujetoCf: input.baseIvaSujetoCf } : {}),
        ...(input.dfCfIva !== undefined ? { dfCfIva: input.dfCfIva } : {}),
        ...(input.tasaIva !== undefined ? { tasaIva: input.tasaIva } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    return toPurchaseDTO(row);
  }

  async voidPurchase(orgId: string, id: string): Promise<IvaPurchaseBookDTO> {
    const existing = await this.db.ivaPurchaseBook.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundError("Entrada de Libro de Compras");

    const row = await this.db.ivaPurchaseBook.update({
      where: { id },
      // SOLO status — estadoSIN no existe en compras; la semántica de void
      // es exclusivamente interna (lifecycle Avicont).
      data: { status: "VOIDED" },
    });

    return toPurchaseDTO(row);
  }

  // ── Ventas ─────────────────────────────────────────────────────────────────

  async createSale(orgId: string, input: CreateSaleInput): Promise<IvaSalesBookDTO> {
    try {
      const row = await this.db.ivaSalesBook.create({
        data: {
          organizationId: orgId,
          fiscalPeriodId: input.fiscalPeriodId,
          saleId: input.saleId ?? null,
          fechaFactura: new Date(input.fechaFactura),
          nitCliente: input.nitCliente,
          razonSocial: input.razonSocial,
          numeroFactura: input.numeroFactura,
          codigoAutorizacion: input.codigoAutorizacion,
          codigoControl: input.codigoControl ?? "",
          importeTotal: input.importeTotal,
          importeIce: input.importeIce,
          importeIehd: input.importeIehd,
          importeIpj: input.importeIpj,
          tasas: input.tasas,
          otrosNoSujetos: input.otrosNoSujetos,
          exentos: input.exentos,
          tasaCero: input.tasaCero,
          subtotal: input.subtotal,
          dfIva: input.dfIva,
          codigoDescuentoAdicional: input.codigoDescuentoAdicional,
          importeGiftCard: input.importeGiftCard,
          baseIvaSujetoCf: input.baseIvaSujetoCf,
          dfCfIva: input.dfCfIva,
          tasaIva: input.tasaIva,
          estadoSIN: input.estadoSIN,
          notes: input.notes ?? null,
        },
      });

      return toSaleDTO(row);
    } catch (err) {
      handlePrismaError(err, "Entrada de Libro de Ventas");
    }
  }

  async findSaleById(orgId: string, id: string): Promise<IvaSalesBookDTO | null> {
    const row = await this.db.ivaSalesBook.findFirst({
      where: { id, organizationId: orgId },
    });
    return row ? toSaleDTO(row) : null;
  }

  async listSalesByPeriod(orgId: string, filter: ListIvaBooksFilter): Promise<IvaSalesBookDTO[]> {
    const rows = await this.db.ivaSalesBook.findMany({
      where: {
        organizationId: orgId,
        ...(filter.fiscalPeriodId ? { fiscalPeriodId: filter.fiscalPeriodId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: { fechaFactura: "asc" },
    });
    return rows.map(toSaleDTO);
  }

  async updateSale(orgId: string, id: string, input: UpdateSaleInput): Promise<IvaSalesBookDTO> {
    const existing = await this.db.ivaSalesBook.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundError("Entrada de Libro de Ventas");

    const row = await this.db.ivaSalesBook.update({
      where: { id },
      data: {
        ...(input.fechaFactura !== undefined
          ? { fechaFactura: new Date(input.fechaFactura) }
          : {}),
        ...(input.nitCliente !== undefined ? { nitCliente: input.nitCliente } : {}),
        ...(input.razonSocial !== undefined ? { razonSocial: input.razonSocial } : {}),
        ...(input.numeroFactura !== undefined ? { numeroFactura: input.numeroFactura } : {}),
        ...(input.codigoAutorizacion !== undefined
          ? { codigoAutorizacion: input.codigoAutorizacion }
          : {}),
        ...(input.codigoControl !== undefined ? { codigoControl: input.codigoControl } : {}),
        ...(input.estadoSIN !== undefined ? { estadoSIN: input.estadoSIN } : {}),
        ...(input.importeTotal !== undefined ? { importeTotal: input.importeTotal } : {}),
        ...(input.importeIce !== undefined ? { importeIce: input.importeIce } : {}),
        ...(input.importeIehd !== undefined ? { importeIehd: input.importeIehd } : {}),
        ...(input.importeIpj !== undefined ? { importeIpj: input.importeIpj } : {}),
        ...(input.tasas !== undefined ? { tasas: input.tasas } : {}),
        ...(input.otrosNoSujetos !== undefined ? { otrosNoSujetos: input.otrosNoSujetos } : {}),
        ...(input.exentos !== undefined ? { exentos: input.exentos } : {}),
        ...(input.tasaCero !== undefined ? { tasaCero: input.tasaCero } : {}),
        ...(input.subtotal !== undefined ? { subtotal: input.subtotal } : {}),
        ...(input.dfIva !== undefined ? { dfIva: input.dfIva } : {}),
        ...(input.codigoDescuentoAdicional !== undefined
          ? { codigoDescuentoAdicional: input.codigoDescuentoAdicional }
          : {}),
        ...(input.importeGiftCard !== undefined ? { importeGiftCard: input.importeGiftCard } : {}),
        ...(input.baseIvaSujetoCf !== undefined ? { baseIvaSujetoCf: input.baseIvaSujetoCf } : {}),
        ...(input.dfCfIva !== undefined ? { dfCfIva: input.dfCfIva } : {}),
        ...(input.tasaIva !== undefined ? { tasaIva: input.tasaIva } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    return toSaleDTO(row);
  }

  async voidSale(orgId: string, id: string): Promise<IvaSalesBookDTO> {
    const existing = await this.db.ivaSalesBook.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundError("Entrada de Libro de Ventas");

    // SOLO status — estadoSIN NO se toca (orthogonal axes per design decision)
    const row = await this.db.ivaSalesBook.update({
      where: { id },
      data: { status: "VOIDED" },
    });

    return toSaleDTO(row);
  }

  async reactivateSale(orgId: string, id: string): Promise<IvaSalesBookDTO> {
    const existing = await this.db.ivaSalesBook.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundError("Entrada de Libro de Ventas");

    // Guard: solo se puede reactivar desde VOIDED (idempotency/sanity)
    if (existing.status !== "VOIDED") {
      throw new ConflictError("La entrada ya está activa (status !== VOIDED)");
    }

    // SOLO status — estadoSIN NO se toca (orthogonal axes per design decision)
    const row = await this.db.ivaSalesBook.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    return toSaleDTO(row);
  }
}

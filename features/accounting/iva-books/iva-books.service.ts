import { Prisma } from "@/generated/prisma/client";
import { calcTotales } from "./iva-calc.utils";
import { IvaBooksRepository, type ListIvaBooksFilter } from "./iva-books.repository";
import type {
  CreatePurchaseInput,
  CreateSaleInput,
  IvaPurchaseBookDTO,
  IvaSalesBookDTO,
  UpdatePurchaseInput,
  UpdateSaleInput,
} from "./iva-books.types";

// ── Constantes ────────────────────────────────────────────────────────────────

const TASA_IVA = new Prisma.Decimal("0.1300");

// ── Helpers de cálculo ────────────────────────────────────────────────────────

/**
 * Recomputa server-side todos los campos derivados IVA (defense-in-depth).
 * El cliente puede pre-calcular, pero el server siempre recomputa antes de persistir.
 *
 * Retorna los campos calculados que deben sobreescribir los del input.
 */
function computeIvaFields(input: {
  importeTotal: Prisma.Decimal;
  importeIce: Prisma.Decimal;
  importeIehd: Prisma.Decimal;
  importeIpj: Prisma.Decimal;
  tasas: Prisma.Decimal;
  otrosNoSujetos: Prisma.Decimal;
  exentos: Prisma.Decimal;
  tasaCero: Prisma.Decimal;
  codigoDescuentoAdicional: Prisma.Decimal;
  importeGiftCard: Prisma.Decimal;
}): {
  subtotal: Prisma.Decimal;
  baseIvaSujetoCf: Prisma.Decimal;
  dfCfIva: Prisma.Decimal;
  dfIva: Prisma.Decimal;
  tasaIva: Prisma.Decimal;
} {
  const { subtotal, baseImponible, ivaAmount } = calcTotales({
    importeTotal: input.importeTotal,
    importeIce: input.importeIce,
    importeIehd: input.importeIehd,
    importeIpj: input.importeIpj,
    tasas: input.tasas,
    otrosNoSujetos: input.otrosNoSujetos,
    exentos: input.exentos,
    tasaCero: input.tasaCero,
    codigoDescuentoAdicional: input.codigoDescuentoAdicional,
    importeGiftCard: input.importeGiftCard,
  });

  return {
    subtotal,
    baseIvaSujetoCf: baseImponible,
    dfCfIva: ivaAmount,
    dfIva: ivaAmount, // simétrico: dfIva = dfCfIva (mismo 13/113)
    tasaIva: TASA_IVA,
  };
}

// ── IvaBooksService ───────────────────────────────────────────────────────────

/**
 * Servicio de IVA Books.
 *
 * Responsabilidades:
 * - Recomputar campos IVA server-side antes de persistir (defense-in-depth)
 * - Delegar operaciones CRUD al repositorio
 * - estadoSIN se pasa tal cual desde el input (sin auto-lógica)
 * - VOIDED (lifecycle interno) y estadoSIN (SIN) son ejes ortogonales
 *
 * NO importa Prisma directamente — toda la persistencia va por el repo.
 */
export class IvaBooksService {
  private readonly repo: IvaBooksRepository;

  constructor(repo?: IvaBooksRepository) {
    this.repo = repo ?? new IvaBooksRepository();
  }

  // ── Compras ────────────────────────────────────────────────────────────────

  async createPurchase(orgId: string, input: CreatePurchaseInput): Promise<IvaPurchaseBookDTO> {
    const computed = computeIvaFields(input);

    return this.repo.createPurchase(orgId, {
      ...input,
      ...computed,
    });
  }

  async findPurchaseById(orgId: string, id: string): Promise<IvaPurchaseBookDTO | null> {
    return this.repo.findPurchaseById(orgId, id);
  }

  async listPurchasesByPeriod(
    orgId: string,
    filter: ListIvaBooksFilter,
  ): Promise<IvaPurchaseBookDTO[]> {
    return this.repo.listPurchasesByPeriod(orgId, filter);
  }

  async updatePurchase(
    orgId: string,
    id: string,
    input: UpdatePurchaseInput,
  ): Promise<IvaPurchaseBookDTO> {
    // Si el update incluye algún campo monetario, recomputamos IVA con la base actual + cambios
    const hasMonetaryChange =
      input.importeTotal !== undefined ||
      input.importeIce !== undefined ||
      input.importeIehd !== undefined ||
      input.importeIpj !== undefined ||
      input.tasas !== undefined ||
      input.otrosNoSujetos !== undefined ||
      input.exentos !== undefined ||
      input.tasaCero !== undefined ||
      input.codigoDescuentoAdicional !== undefined ||
      input.importeGiftCard !== undefined;

    if (hasMonetaryChange) {
      // Obtener los valores actuales para combinar con el patch
      const current = await this.repo.findPurchaseById(orgId, id);

      const D = (v: string | number) => new Prisma.Decimal(String(v));
      const ZERO = D("0");

      const merged = {
        importeTotal: input.importeTotal ?? current?.importeTotal ?? ZERO,
        importeIce: input.importeIce ?? current?.importeIce ?? ZERO,
        importeIehd: input.importeIehd ?? current?.importeIehd ?? ZERO,
        importeIpj: input.importeIpj ?? current?.importeIpj ?? ZERO,
        tasas: input.tasas ?? current?.tasas ?? ZERO,
        otrosNoSujetos: input.otrosNoSujetos ?? current?.otrosNoSujetos ?? ZERO,
        exentos: input.exentos ?? current?.exentos ?? ZERO,
        tasaCero: input.tasaCero ?? current?.tasaCero ?? ZERO,
        codigoDescuentoAdicional:
          input.codigoDescuentoAdicional ?? current?.codigoDescuentoAdicional ?? ZERO,
        importeGiftCard: input.importeGiftCard ?? current?.importeGiftCard ?? ZERO,
      };

      const computed = computeIvaFields(merged);
      return this.repo.updatePurchase(orgId, id, { ...input, ...computed });
    }

    return this.repo.updatePurchase(orgId, id, input);
  }

  async voidPurchase(orgId: string, id: string): Promise<IvaPurchaseBookDTO> {
    return this.repo.voidPurchase(orgId, id);
  }

  // ── Ventas ─────────────────────────────────────────────────────────────────

  async createSale(orgId: string, input: CreateSaleInput): Promise<IvaSalesBookDTO> {
    const computed = computeIvaFields(input);

    return this.repo.createSale(orgId, {
      ...input,
      ...computed,
    });
  }

  async findSaleById(orgId: string, id: string): Promise<IvaSalesBookDTO | null> {
    return this.repo.findSaleById(orgId, id);
  }

  async listSalesByPeriod(orgId: string, filter: ListIvaBooksFilter): Promise<IvaSalesBookDTO[]> {
    return this.repo.listSalesByPeriod(orgId, filter);
  }

  async updateSale(orgId: string, id: string, input: UpdateSaleInput): Promise<IvaSalesBookDTO> {
    const hasMonetaryChange =
      input.importeTotal !== undefined ||
      input.importeIce !== undefined ||
      input.importeIehd !== undefined ||
      input.importeIpj !== undefined ||
      input.tasas !== undefined ||
      input.otrosNoSujetos !== undefined ||
      input.exentos !== undefined ||
      input.tasaCero !== undefined ||
      input.codigoDescuentoAdicional !== undefined ||
      input.importeGiftCard !== undefined;

    if (hasMonetaryChange) {
      const current = await this.repo.findSaleById(orgId, id);

      const D = (v: string | number) => new Prisma.Decimal(String(v));
      const ZERO = D("0");

      const merged = {
        importeTotal: input.importeTotal ?? current?.importeTotal ?? ZERO,
        importeIce: input.importeIce ?? current?.importeIce ?? ZERO,
        importeIehd: input.importeIehd ?? current?.importeIehd ?? ZERO,
        importeIpj: input.importeIpj ?? current?.importeIpj ?? ZERO,
        tasas: input.tasas ?? current?.tasas ?? ZERO,
        otrosNoSujetos: input.otrosNoSujetos ?? current?.otrosNoSujetos ?? ZERO,
        exentos: input.exentos ?? current?.exentos ?? ZERO,
        tasaCero: input.tasaCero ?? current?.tasaCero ?? ZERO,
        codigoDescuentoAdicional:
          input.codigoDescuentoAdicional ?? current?.codigoDescuentoAdicional ?? ZERO,
        importeGiftCard: input.importeGiftCard ?? current?.importeGiftCard ?? ZERO,
      };

      const computed = computeIvaFields(merged);
      return this.repo.updateSale(orgId, id, { ...input, ...computed });
    }

    return this.repo.updateSale(orgId, id, input);
  }

  async voidSale(orgId: string, id: string): Promise<IvaSalesBookDTO> {
    // SOLO status = VOIDED — estadoSIN NO se toca (eje ortogonal, design decision)
    return this.repo.voidSale(orgId, id);
  }
}

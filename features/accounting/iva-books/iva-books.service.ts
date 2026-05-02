import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { withAuditTx, type WithCorrelation } from "@/features/shared/audit-tx";
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

/**
 * Alícuota IVA Bolivia 13% — exported para consumo cross-module legacy↔hex
 * bridge (POC #11.0c A4-c C2 GREEN P3.4 lock Marco): mapper hex
 * `IvaSalesBookEntry → IvaSalesBookDTO` requiere `tasaIva: Decimal` campo
 * que NO existe en `IvaCalcResult` VO (solo subtotal/baseImponible/ivaAmount).
 * Single source of truth hasta retirement final del legacy `IvaBooksService`
 * — cuando TASA_IVA migre a hex (POC futuro) el import path swap es trivial.
 */
export const TASA_IVA = new Prisma.Decimal("0.1300");

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
    dfIva: ivaAmount, // simétrico: dfIva = dfCfIva (alícuota nominal 0.13)
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

  async createPurchase(
    orgId: string,
    userId: string,
    input: CreatePurchaseInput,
  ): Promise<WithCorrelation<IvaPurchaseBookDTO>> {
    const computed = computeIvaFields(input);

    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId: orgId },
      async (tx) => {
        return this.repo.createPurchase(
          orgId,
          { ...input, ...computed },
          tx,
        );
      },
    );

    return { ...result, correlationId };
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
    userId: string,
    id: string,
    input: UpdatePurchaseInput,
  ): Promise<WithCorrelation<IvaPurchaseBookDTO>> {

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

    // Audit F #4/#5: write IVA + regen journal bajo la misma tx.
    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId: orgId },
      async (tx, cid) => {
        let inner: IvaPurchaseBookDTO;

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
          inner = await this.repo.updatePurchase(orgId, id, { ...input, ...computed }, tx);
        } else {
          inner = await this.repo.updatePurchase(orgId, id, input, tx);
        }

        return inner;
      },
    );
    return { ...result, correlationId };
  }

  async voidPurchase(
    orgId: string,
    userId: string,
    id: string,
  ): Promise<WithCorrelation<IvaPurchaseBookDTO>> {

    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId: orgId },
      async (tx) => {
        return this.repo.voidPurchase(orgId, id, tx);
      },
    );
    return { ...result, correlationId };
  }

  // ── Ventas ─────────────────────────────────────────────────────────────────

  async createSale(
    orgId: string,
    userId: string,
    input: CreateSaleInput,
  ): Promise<WithCorrelation<IvaSalesBookDTO>> {
    const computed = computeIvaFields(input);

    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId: orgId },
      async (tx) => {
        return this.repo.createSale(
          orgId,
          { ...input, ...computed },
          tx,
        );
      },
    );

    return { ...result, correlationId };
  }

  async findSaleById(orgId: string, id: string): Promise<IvaSalesBookDTO | null> {
    return this.repo.findSaleById(orgId, id);
  }

  async listSalesByPeriod(orgId: string, filter: ListIvaBooksFilter): Promise<IvaSalesBookDTO[]> {
    return this.repo.listSalesByPeriod(orgId, filter);
  }

  async updateSale(
    orgId: string,
    userId: string,
    id: string,
    input: UpdateSaleInput,
  ): Promise<WithCorrelation<IvaSalesBookDTO>> {

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

    // Audit F #4/#5: write IVA + regen journal bajo la misma tx.
    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId: orgId },
      async (tx, cid) => {
        let inner: IvaSalesBookDTO;

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
          inner = await this.repo.updateSale(orgId, id, { ...input, ...computed }, tx);
        } else {
          inner = await this.repo.updateSale(orgId, id, input, tx);
        }

        return inner;
      },
    );
    return { ...result, correlationId };
  }

  // ── Cascade desde SaleService.editPosted ─────────────────────────────────

  /**
   * Recomputa los campos IVA de un IvaSalesBook desde dentro de la transacción
   * de SaleService.editPosted.
   *
   * Contrato:
   * - Recibe la transacción activa (tx) para ejecutarse en el mismo bloque atómico.
   * - Si no existe IvaSalesBook para el saleId dado, es un no-op (no lanza error).
   * - Conserva todas las deducciones (importeIce, importeIehd, importeIpj, tasas,
   *   otrosNoSujetos, exentos, tasaCero, codigoDescuentoAdicional, importeGiftCard)
   *   sin modificarlas — solo actualiza importeTotal y los campos derivados.
   */
  async recomputeFromSaleCascade(
    tx: Prisma.TransactionClient,
    orgId: string,
    saleId: string,
    newTotal: Prisma.Decimal,
  ): Promise<void> {
    const existing = await tx.ivaSalesBook.findFirst({
      where: { saleId, organizationId: orgId },
    });

    if (!existing) return; // no-op: no IvaSalesBook linked

    // Leer deducciones existentes (se conservan sin cambios)
    const D = (v: Prisma.Decimal) => v;
    const ZERO = new Prisma.Decimal("0");

    const deductions = {
      importeTotal: newTotal,
      importeIce: D(existing.importeIce ?? ZERO),
      importeIehd: D(existing.importeIehd ?? ZERO),
      importeIpj: D(existing.importeIpj ?? ZERO),
      tasas: D(existing.tasas ?? ZERO),
      otrosNoSujetos: D(existing.otrosNoSujetos ?? ZERO),
      exentos: D(existing.exentos ?? ZERO),
      tasaCero: D(existing.tasaCero ?? ZERO),
      codigoDescuentoAdicional: D(existing.codigoDescuentoAdicional ?? ZERO),
      importeGiftCard: D(existing.importeGiftCard ?? ZERO),
    };

    // Recomputar usando la misma utilidad que el resto del servicio
    const { subtotal, baseImponible, ivaAmount } = calcTotales(deductions);

    await tx.ivaSalesBook.update({
      where: { id: existing.id },
      data: {
        importeTotal: newTotal,
        subtotal,
        baseIvaSujetoCf: baseImponible,
        dfIva: ivaAmount,
        dfCfIva: ivaAmount,
        tasaIva: TASA_IVA,
      },
    });
  }

  // ── Cascade desde PurchaseService.editPosted ─────────────────────────────

  /**
   * Recomputa los campos IVA de un IvaPurchaseBook desde dentro de la transacción
   * de PurchaseService.editPosted.
   *
   * Contrato:
   * - Recibe la transacción activa (tx) para ejecutarse en el mismo bloque atómico.
   * - Si no existe IvaPurchaseBook para el purchaseId dado, es un no-op (no lanza error).
   * - Conserva todas las deducciones (importeIce, importeIehd, importeIpj, tasas,
   *   otrosNoSujetos, exentos, tasaCero, codigoDescuentoAdicional, importeGiftCard)
   *   sin modificarlas — solo actualiza importeTotal y los campos derivados.
   */
  async recomputeFromPurchaseCascade(
    tx: Prisma.TransactionClient,
    orgId: string,
    purchaseId: string,
    newTotal: Prisma.Decimal,
  ): Promise<void> {
    const existing = await tx.ivaPurchaseBook.findFirst({
      where: { purchaseId, organizationId: orgId },
    });

    if (!existing) return; // no-op: no IvaPurchaseBook linked

    const D = (v: Prisma.Decimal) => v;
    const ZERO = new Prisma.Decimal("0");

    const deductions = {
      importeTotal: newTotal,
      importeIce: D(existing.importeIce ?? ZERO),
      importeIehd: D(existing.importeIehd ?? ZERO),
      importeIpj: D(existing.importeIpj ?? ZERO),
      tasas: D(existing.tasas ?? ZERO),
      otrosNoSujetos: D(existing.otrosNoSujetos ?? ZERO),
      exentos: D(existing.exentos ?? ZERO),
      tasaCero: D(existing.tasaCero ?? ZERO),
      codigoDescuentoAdicional: D(existing.codigoDescuentoAdicional ?? ZERO),
      importeGiftCard: D(existing.importeGiftCard ?? ZERO),
    };

    const { subtotal, baseImponible, ivaAmount } = calcTotales(deductions);

    await tx.ivaPurchaseBook.update({
      where: { id: existing.id },
      data: {
        importeTotal: newTotal,
        subtotal,
        baseIvaSujetoCf: baseImponible,
        dfIva: ivaAmount,
        dfCfIva: ivaAmount,
        tasaIva: TASA_IVA,
      },
    });
  }

  async voidSale(
    orgId: string,
    userId: string,
    id: string,
  ): Promise<WithCorrelation<IvaSalesBookDTO>> {

    // SOLO status = VOIDED — estadoSIN NO se toca (eje ortogonal, design decision)
    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId: orgId },
      async (tx) => {
        return this.repo.voidSale(orgId, id, tx);
      },
    );
    return { ...result, correlationId };
  }

  async reactivateSale(
    orgId: string,
    userId: string,
    id: string,
  ): Promise<WithCorrelation<IvaSalesBookDTO>> {
    // status = ACTIVE — estadoSIN NO se toca (eje ortogonal, design decision)
    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId: orgId },
      async (tx) => {
        return this.repo.reactivateSale(orgId, id, tx);
      },
    );
    return { ...result, correlationId };
  }

  async reactivatePurchase(
    orgId: string,
    userId: string,
    id: string,
  ): Promise<WithCorrelation<IvaPurchaseBookDTO>> {
    // status = ACTIVE — IvaPurchaseBook no tiene estadoSIN (campo exclusivo de ventas)
    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId: orgId },
      async (tx) => {
        return this.repo.reactivatePurchase(orgId, id, tx);
      },
    );
    return { ...result, correlationId };
  }
}

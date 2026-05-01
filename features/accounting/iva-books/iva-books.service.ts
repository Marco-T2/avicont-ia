import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { ValidationError, FISCAL_PERIOD_CLOSED } from "@/features/shared/errors";
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

// ── Interfaces de dependencias (evitar importación circular) ──────────────────

/**
 * Contrato mínimo de SaleService necesario para el bridge de regeneración.
 * Usar la interfaz en vez del tipo concreto para evitar acoplamiento circular.
 */
interface SaleServiceForBridge {
  getById(
    organizationId: string,
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    id: string;
    status: string;
    periodId: string;
    period: { id: string; status: string };
  }>;
  regenerateJournalForIvaChange(
    opts:
      | {
          organizationId: string;
          saleId: string;
          userId: string;
          externalTx: Prisma.TransactionClient;
          correlationId: string;
        }
      | {
          organizationId: string;
          saleId: string;
          userId: string;
          externalTx?: undefined;
          correlationId?: undefined;
        },
  ): Promise<unknown>;
}

/**
 * Contrato mínimo de PurchaseService necesario para el bridge de regeneración.
 */
interface PurchaseServiceForBridge {
  getById(
    organizationId: string,
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    id: string;
    status: string;
    periodId: string;
    period: { id: string; status: string };
  }>;
  regenerateJournalForIvaChange(
    opts:
      | {
          organizationId: string;
          purchaseId: string;
          userId: string;
          externalTx: Prisma.TransactionClient;
          correlationId: string;
        }
      | {
          organizationId: string;
          purchaseId: string;
          userId: string;
          externalTx?: undefined;
          correlationId?: undefined;
        },
  ): Promise<unknown>;
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
 * - SPEC-6: Bridge CUD → regenerar asiento cuando Sale/Purchase es POSTED + período OPEN
 * - SPEC-6: Lanzar FISCAL_PERIOD_CLOSED cuando el período está CERRADO antes de persistir
 *
 * NO importa Prisma directamente — toda la persistencia va por el repo.
 */
export class IvaBooksService {
  private readonly repo: IvaBooksRepository;
  private readonly saleService?: SaleServiceForBridge;
  private readonly purchaseService?: PurchaseServiceForBridge;

  constructor(
    repo?: IvaBooksRepository,
    saleService?: SaleServiceForBridge,
    purchaseService?: PurchaseServiceForBridge,
  ) {
    this.repo = repo ?? new IvaBooksRepository();
    this.saleService = saleService;
    this.purchaseService = purchaseService;
  }

  // ── Bridge helper: verificar período y llamar regeneración ────────────────

  /**
   * Verifica si la entidad vinculada (Sale/Purchase) es POSTED y tiene período OPEN.
   * Si cumple las condiciones, llama a regenerateJournalForIvaChange.
   * Si el período está CLOSED, lanza FISCAL_PERIOD_CLOSED (SPEC-6).
   *
   * @param entityType - "sale" | "purchase"
   * @param entityId - ID de la venta o compra
   * @param orgId - ID de la organización
   * @param userId - ID del usuario que ejecuta la operación
   */
  private async maybeRegenerateJournal(
    entityType: "sale" | "purchase",
    entityId: string,
    orgId: string,
    userId: string,
    tx: Prisma.TransactionClient,
    correlationId: string,
  ): Promise<void> {
    if (entityType === "sale" && this.saleService) {
      const sale = await this.saleService.getById(orgId, entityId, tx);
      const periodStatus = sale.period?.status ?? "OPEN";

      if (sale.status === "POSTED") {
        if (periodStatus !== "OPEN") {
          throw new ValidationError(
            "No se puede modificar el Libro IVA de una venta contabilizada con período cerrado",
            FISCAL_PERIOD_CLOSED,
          );
        }
        await this.saleService.regenerateJournalForIvaChange({
          organizationId: orgId,
          saleId: entityId,
          userId,
          externalTx: tx,
          correlationId,
        });
      }
    } else if (entityType === "purchase" && this.purchaseService) {
      const purchase = await this.purchaseService.getById(orgId, entityId, tx);
      const periodStatus = purchase.period?.status ?? "OPEN";

      if (purchase.status === "POSTED") {
        if (periodStatus !== "OPEN") {
          throw new ValidationError(
            "No se puede modificar el Libro IVA de una compra contabilizada con período cerrado",
            FISCAL_PERIOD_CLOSED,
          );
        }
        await this.purchaseService.regenerateJournalForIvaChange({
          organizationId: orgId,
          purchaseId: entityId,
          userId,
          externalTx: tx,
          correlationId,
        });
      }
    }
  }

  // ── Compras ────────────────────────────────────────────────────────────────

  async createPurchase(
    orgId: string,
    userId: string,
    input: CreatePurchaseInput,
  ): Promise<WithCorrelation<IvaPurchaseBookDTO>> {

    // SPEC-6: Si hay purchaseId y período CERRADO → lanzar antes de persistir.
    // Si POSTED + OPEN → regenerar después de crear. Todo el chequeo ocurre en maybeRegenerateJournal.
    // Pre-check de período cerrado: evita persistir el IvaBook si el período ya está CERRADO.
    // NOTA (Audit F #4/#5): el pre-check es READ-ONLY y se mantiene FUERA de la tx
    // para fallar rápido antes de tomar locks. El write + regen van adentro.
    if (input.purchaseId && userId && this.purchaseService) {
      const purchase = await this.purchaseService.getById(orgId, input.purchaseId);
      const periodStatus = purchase.period?.status ?? "OPEN";
      if (purchase.status === "POSTED" && periodStatus !== "OPEN") {
        throw new ValidationError(
          "No se puede crear el Libro IVA de una compra contabilizada con período cerrado",
          FISCAL_PERIOD_CLOSED,
        );
      }

      const computed = computeIvaFields(input);

      // Audit F #4/#5: write IVA + regen journal bajo la misma tx. Si el regen
      // falla, la escritura IVA se revierte — audit trail consistente.
      const purchaseId = input.purchaseId;
      const purchaseServiceRef = this.purchaseService;
      const { result, correlationId } = await withAuditTx(
        this.repo,
        { userId, organizationId: orgId },
        async (tx, cid) => {
          const created = await this.repo.createPurchase(
            orgId,
            { ...input, ...computed },
            tx,
          );

          // Regenerar si POSTED + OPEN (ya validamos que no es CLOSED arriba)
          if (purchase.status === "POSTED" && periodStatus === "OPEN") {
            await purchaseServiceRef.regenerateJournalForIvaChange({
              organizationId: orgId,
              purchaseId,
              userId,
              externalTx: tx,
              correlationId: cid,
            });
          }

          return created;
        },
      );
      return { ...result, correlationId };
    }

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

        // SPEC-6: bridge regeneración si hay purchaseId y userId
        const purchaseId = inner.purchaseId;
        if (purchaseId && userId) {
          await this.maybeRegenerateJournal("purchase", purchaseId, orgId, userId, tx, cid);
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

    // Audit F #4/#5: void IVA + regen journal bajo la misma tx.
    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId: orgId },
      async (tx, cid) => {
        const inner = await this.repo.voidPurchase(orgId, id, tx);

        // SPEC-6: bridge regeneración (non-IVA path — IvaBook ya tiene status VOIDED)
        const purchaseId = inner.purchaseId;
        if (purchaseId && userId) {
          await this.maybeRegenerateJournal("purchase", purchaseId, orgId, userId, tx, cid);
        }

        return inner;
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

    // SPEC-6: Pre-check de período cerrado + regeneración post-create (un solo getById).
    // NOTA (Audit F #4/#5): el pre-check es READ-ONLY y se mantiene FUERA de la tx
    // para fallar rápido antes de tomar locks. El write + regen van adentro.
    if (input.saleId && userId && this.saleService) {
      const sale = await this.saleService.getById(orgId, input.saleId);
      const periodStatus = sale.period?.status ?? "OPEN";
      if (sale.status === "POSTED" && periodStatus !== "OPEN") {
        throw new ValidationError(
          "No se puede crear el Libro IVA de una venta contabilizada con período cerrado",
          FISCAL_PERIOD_CLOSED,
        );
      }

      const computed = computeIvaFields(input);

      // Audit F #4/#5: write IVA + regen journal bajo la misma tx.
      const saleId = input.saleId;
      const saleServiceRef = this.saleService;
      const { result, correlationId } = await withAuditTx(
        this.repo,
        { userId, organizationId: orgId },
        async (tx, cid) => {
          const created = await this.repo.createSale(
            orgId,
            { ...input, ...computed },
            tx,
          );

          // Regenerar si POSTED + OPEN (ya validamos que no es CLOSED arriba)
          if (sale.status === "POSTED" && periodStatus === "OPEN") {
            await saleServiceRef.regenerateJournalForIvaChange({
              organizationId: orgId,
              saleId,
              userId,
              externalTx: tx,
              correlationId: cid,
            });
          }

          return created;
        },
      );
      return { ...result, correlationId };
    }

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

        // SPEC-6: bridge regeneración si hay saleId y userId
        const saleId = inner.saleId;
        if (saleId && userId) {
          await this.maybeRegenerateJournal("sale", saleId, orgId, userId, tx, cid);
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
   * - NO llama a maybeRegenerateJournal — esto previene el loop Sale→IVA→Journal→Sale.
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
   * - NO llama a maybeRegenerateJournal — previene el loop Purchase→IVA→Journal→Purchase.
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
    // Audit F #4/#5: void IVA + regen journal bajo la misma tx.
    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId: orgId },
      async (tx, cid) => {
        const inner = await this.repo.voidSale(orgId, id, tx);

        // SPEC-6: bridge regeneración (non-IVA path — IvaBook ya tiene status VOIDED)
        const saleId = inner.saleId;
        if (saleId && userId) {
          await this.maybeRegenerateJournal("sale", saleId, orgId, userId, tx, cid);
        }

        return inner;
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
    // Audit F #4/#5: reactivate IVA + regen journal bajo la misma tx.
    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId: orgId },
      async (tx, cid) => {
        const inner = await this.repo.reactivateSale(orgId, id, tx);

        // SPEC-6: bridge regeneración (IVA path — IvaBook ya tiene status ACTIVE)
        const saleId = inner.saleId;
        if (saleId && userId) {
          await this.maybeRegenerateJournal("sale", saleId, orgId, userId, tx, cid);
        }

        return inner;
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
    // Audit F #4/#5: reactivate IVA + regen journal bajo la misma tx.
    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId: orgId },
      async (tx, cid) => {
        const inner = await this.repo.reactivatePurchase(orgId, id, tx);

        // SPEC-6: bridge regeneración (IVA path — IvaBook ya tiene status ACTIVE)
        const purchaseId = inner.purchaseId;
        if (purchaseId && userId) {
          await this.maybeRegenerateJournal("purchase", purchaseId, orgId, userId, tx, cid);
        }

        return inner;
      },
    );
    return { ...result, correlationId };
  }
}

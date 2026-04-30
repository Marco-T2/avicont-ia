import { NotFoundError } from "@/features/shared/errors";
import type { ContactRepository } from "@/modules/contacts/domain/contact.repository";
import { ContactNotFound } from "@/modules/contacts/domain/errors/contact-errors";
import {
  Purchase,
  type CreatePurchaseDraftInput,
} from "../domain/purchase.entity";
import type {
  PurchaseFilters,
  PurchaseRepository,
} from "../domain/ports/purchase.repository";
import type { PurchasePermissionsPort } from "../domain/ports/purchase-permissions.port";
import type { PayableRepository } from "@/modules/payables/domain/payable.repository";
import {
  computeTrimPlan,
  type TrimPreviewItem,
} from "../domain/compute-trim-plan";
import { computePfSummary } from "../domain/compute-pf-summary";
import {
  PurchaseContactInactive,
  PurchaseContactNotProvider,
} from "./errors/purchase-orchestration-errors";
import type { PurchaseUnitOfWork } from "./purchase-unit-of-work";

/**
 * `PurchaseServiceDeps` — object DI patrón consolidado durante POC #11.0a
 * A2 Ciclo 5b sale-hex (Marco trigger 6+ deps opcionales). Sólo `repo` es
 * obligatorio en C1; el resto entra conforme los use cases landeen
 * (§11.1 STICK on-arrival).
 */
export interface PurchaseServiceDeps {
  repo: PurchaseRepository;
  payables?: PayableRepository;
  contacts?: ContactRepository;
  uow?: PurchaseUnitOfWork;
  purchasePermissions?: PurchasePermissionsPort;
}

export interface EditPreview {
  trimPreview: TrimPreviewItem[];
}

export type CreateDraftInput = Omit<
  CreatePurchaseDraftInput,
  "organizationId" | "createdById"
>;

export interface CreateDraftResult {
  purchase: Purchase;
  correlationId: string;
}

export class PurchaseService {
  constructor(private readonly deps: PurchaseServiceDeps) {}

  async list(
    organizationId: string,
    filters?: PurchaseFilters,
  ): Promise<Purchase[]> {
    return this.deps.repo.findAll(organizationId, filters);
  }

  async getById(organizationId: string, id: string): Promise<Purchase> {
    const found = await this.deps.repo.findById(organizationId, id);
    if (!found) throw new NotFoundError("Compra");
    return found;
  }

  /**
   * Simulates the LIFO trim plan for an `editPosted` operation that would
   * lower the purchase's total to `newTotal`. Read-only — no DB writes.
   * Mirrors legacy `purchase.service.ts:779-813` (fidelidad regla #1) y
   * espejo simétrico de sale-hex `getEditPreview`.
   */
  async getEditPreview(
    organizationId: string,
    purchaseId: string,
    newTotal: number,
  ): Promise<EditPreview> {
    if (!this.deps.payables) {
      throw new Error(
        "PurchaseService.getEditPreview requires PayableRepository — inject in constructor",
      );
    }

    const purchase = await this.getById(organizationId, purchaseId);
    if (!purchase.payableId) {
      return { trimPreview: [] };
    }

    const payable = await this.deps.payables.findById(
      organizationId,
      purchase.payableId,
    );
    const rawPaid = payable ? Number(payable.paid.value) : 0;

    if (newTotal >= rawPaid) {
      return { trimPreview: [] };
    }

    const allocations =
      await this.deps.payables.findAllocationsForPayable(
        organizationId,
        purchase.payableId,
      );

    return { trimPreview: computeTrimPlan(allocations, rawPaid - newTotal) };
  }

  /**
   * Creates a purchase in DRAFT status. Mirrors legacy
   * `purchase.service.ts:316-369` (fidelidad regla #1) — valida contact
   * existence, active status, y `PROVEEDOR` type antes de delegar a
   * `Purchase.createDraft` (que enforcea CG/SV expenseAccountId vía
   * `assertExpenseAccountsSetForType` post-D1.4b A1 C6). Para POLLO_FAENADO
   * el use case calcula `computePfSummary(input.details)` para hidratar
   * los totalKg fields header (decisión D3 β thin aggregate A1 — aggregate
   * desconoce composición, use case asume responsabilidad). Persiste dentro
   * de UoW para audit context trigger.
   */
  async createDraft(
    organizationId: string,
    input: CreateDraftInput,
    userId: string,
  ): Promise<CreateDraftResult> {
    if (!this.deps.contacts) {
      throw new Error(
        "PurchaseService.createDraft requires ContactRepository",
      );
    }
    if (!this.deps.uow) {
      throw new Error("PurchaseService.createDraft requires PurchaseUnitOfWork");
    }

    const contact = await this.deps.contacts.findById(
      organizationId,
      input.contactId,
    );
    if (!contact) throw new ContactNotFound();
    if (!contact.isActive) throw new PurchaseContactInactive(input.contactId);
    if (contact.type !== "PROVEEDOR") {
      throw new PurchaseContactNotProvider(contact.type);
    }

    const pfSummary =
      input.purchaseType === "POLLO_FAENADO"
        ? computePfSummary(input.details)
        : undefined;

    const purchase = Purchase.createDraft({
      ...input,
      organizationId,
      createdById: userId,
      ...(pfSummary
        ? {
            totalGrossKg: pfSummary.totalGrossKg,
            totalNetKg: pfSummary.totalNetKg,
            totalShrinkKg: pfSummary.totalShrinkKg,
            totalShortageKg: pfSummary.totalShortageKg,
            totalRealNetKg: pfSummary.totalRealNetKg,
          }
        : {}),
    });

    const { result, correlationId } = await this.deps.uow.run(
      { userId, organizationId },
      (scope) => scope.purchases.saveTx(purchase),
    );

    return { purchase: result, correlationId };
  }
}

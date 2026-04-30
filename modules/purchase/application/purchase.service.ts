import { NotFoundError } from "@/features/shared/errors";
import type { Purchase } from "../domain/purchase.entity";
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
  uow?: PurchaseUnitOfWork;
  purchasePermissions?: PurchasePermissionsPort;
}

export interface EditPreview {
  trimPreview: TrimPreviewItem[];
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
}

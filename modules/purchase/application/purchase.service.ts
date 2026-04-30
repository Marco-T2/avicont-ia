import { NotFoundError } from "@/features/shared/errors";
import type { Purchase } from "../domain/purchase.entity";
import type {
  PurchaseFilters,
  PurchaseRepository,
} from "../domain/ports/purchase.repository";
import type { PurchasePermissionsPort } from "../domain/ports/purchase-permissions.port";
import type { PurchaseUnitOfWork } from "./purchase-unit-of-work";

/**
 * `PurchaseServiceDeps` — object DI patrón consolidado durante POC #11.0a
 * A2 Ciclo 5b sale-hex (Marco trigger 6+ deps opcionales). Sólo `repo` es
 * obligatorio en C1; el resto entra conforme los use cases landeen
 * (§11.1 STICK on-arrival).
 */
export interface PurchaseServiceDeps {
  repo: PurchaseRepository;
  uow?: PurchaseUnitOfWork;
  purchasePermissions?: PurchasePermissionsPort;
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
}

import { canPost as legacyCanPost } from "@/features/permissions/server";
import type {
  SalePermissionScope,
  SalePermissionsPort,
} from "@/modules/sale/domain/ports/sale-permissions.port";

/**
 * Function pass-through wrapper sobre legacy `canPost` para sale-hex (POC
 * #11.0a A3 Ciclo 1). Estructuralmente idéntico a `LegacyPermissionsAdapter`
 * (POC #10 C3-C Ciclo 3) — Block B: function pass-through, no Block A
 * wrap-thin class+hydration.
 *
 * Sale-hex declara `SalePermissionsPort` propio (NO reusa `PermissionsPort`
 * de accounting) por §11.1 STICK lockeado Step 0 A2 — 2 consumers known
 * (journal hex + sales hex), promoción a `modules/shared/` deferida hasta
 * tercer consumer (rule of three).
 *
 * Type widening trivial en arg 2: `SalePermissionScope = "sales"` es subset
 * de `PostableResource = "sales" | "purchases" | "journal"` del legacy.
 * TypeScript acepta el pass-through estructuralmente.
 */
export class LegacySalePermissionsAdapter implements SalePermissionsPort {
  async canPost(
    role: string,
    scope: SalePermissionScope,
    organizationId: string,
  ): Promise<boolean> {
    return legacyCanPost(role, scope, organizationId);
  }
}

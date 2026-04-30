import { canPost as legacyCanPost } from "@/features/permissions/server";
import type {
  PurchasePermissionScope,
  PurchasePermissionsPort,
} from "@/modules/purchase/domain/ports/purchase-permissions.port";

/**
 * Function pass-through wrap legacy `canPost` para purchase-hex (POC #11.0b A3 C1).
 * Mirror sale-hex Ciclo 1 (POC #11.0a A3) — Block B, no Block A class+hydration.
 */
export class LegacyPurchasePermissionsAdapter
  implements PurchasePermissionsPort
{
  async canPost(
    role: string,
    scope: PurchasePermissionScope,
    organizationId: string,
  ): Promise<boolean> {
    return legacyCanPost(role, scope, organizationId);
  }
}

import type {
  PurchasePermissionScope,
  PurchasePermissionsPort,
} from "../../../domain/ports/purchase-permissions.port";

/**
 * In-memory `PurchasePermissionsPort` fake. Espejo simétrico a
 * `InMemorySalePermissions`. `allow(role)` / `deny(role)` configura outcomes
 * RBAC por role; `canPostCalls` registra cada invocación para assertions.
 * Default: deny — explicit allow mantiene los tests honestos sobre qué
 * roles bypass RBAC.
 */
export class InMemoryPurchasePermissions implements PurchasePermissionsPort {
  private readonly allowed = new Set<string>();
  canPostCalls: {
    role: string;
    scope: PurchasePermissionScope;
    organizationId: string;
  }[] = [];

  allow(role: string): void {
    this.allowed.add(role);
  }

  deny(role: string): void {
    this.allowed.delete(role);
  }

  async canPost(
    role: string,
    scope: PurchasePermissionScope,
    organizationId: string,
  ): Promise<boolean> {
    this.canPostCalls.push({ role, scope, organizationId });
    return this.allowed.has(role);
  }
}

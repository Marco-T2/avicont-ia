import type {
  SalePermissionScope,
  SalePermissionsPort,
} from "../../../domain/ports/sale-permissions.port";

/**
 * In-memory `SalePermissionsPort` fake. Tests `allow(role)` / `deny(role)` to
 * configure RBAC outcomes per role; `canPostCalls` records every invocation
 * for assertion. Default: deny — explicit allow keeps the test honest about
 * which roles bypass RBAC.
 */
export class InMemorySalePermissions implements SalePermissionsPort {
  private readonly allowed = new Set<string>();
  canPostCalls: {
    role: string;
    scope: SalePermissionScope;
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
    scope: SalePermissionScope,
    organizationId: string,
  ): Promise<boolean> {
    this.canPostCalls.push({ role, scope, organizationId });
    return this.allowed.has(role);
  }
}

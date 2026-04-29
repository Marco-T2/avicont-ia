/**
 * RBAC port for sale-hex. Distinct from
 * `modules/accounting/domain/ports/permissions.port.ts:PermissionsPort` whose
 * scope is hardcoded `"journal"`. §11.1 STICK applied — only 2 known consumers
 * (journal hex + sales hex); promotion to `modules/shared/` is preventive and
 * deferred until a third consumer (rule of three) appears.
 *
 * Not tx-aware — use cases resolve permissions BEFORE entering `uow.run` so
 * a denied request never opens a Postgres tx (parity with legacy
 * `sale.service.ts:387` where `canPost` runs above the transactional flow).
 */
export type SalePermissionScope = "sales";

export interface SalePermissionsPort {
  canPost(
    role: string,
    scope: SalePermissionScope,
    organizationId: string,
  ): Promise<boolean>;
}

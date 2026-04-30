/**
 * RBAC port para purchase-hex. Distinto de
 * `modules/sale/domain/ports/sale-permissions.port.ts:SalePermissionsPort`
 * cuyo scope es `"sales"`. §11.1 STICK aplicado — sólo 2 consumers conocidos
 * (sale-hex + purchase-hex); promoción a `modules/shared/` deferida hasta
 * que aparezca un tercer consumer (rule of three).
 *
 * No tx-aware — los use cases resuelven permisos ANTES de entrar a `uow.run`,
 * para que un request denegado nunca abra una tx Postgres (paridad con
 * legacy `purchase.service.ts:511` donde `canPost` corre por encima del flujo
 * transaccional).
 */
export type PurchasePermissionScope = "purchases";

export interface PurchasePermissionsPort {
  canPost(
    role: string,
    scope: PurchasePermissionScope,
    organizationId: string,
  ): Promise<boolean>;
}

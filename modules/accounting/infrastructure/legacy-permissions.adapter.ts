import { canPost as legacyCanPost } from "@/features/permissions/server";
import type {
  PermissionScope,
  PermissionsPort,
} from "@/modules/accounting/domain/ports/permissions.port";

/**
 * Function pass-through wrapper sobre legacy `canPost` (POC #10 C3-C Ciclo 3).
 *
 * Forma estructural Block B: function pass-through. Diferencias respecto del
 * Block A (Ciclos 1-2 wrap-thin class+hydration):
 *   - Legacy es function export, no class — sin `new LegacyX()` instance.
 *   - Sin singleton module-scope: la función es free, import directo.
 *   - Sin null collapse: el return es total `Promise<boolean>`, sin null path.
 *   - Sin hydration/mapping: boolean → boolean, cuerpo `return legacy(...)` puro.
 *
 * Type widening trivial en arg 2: `PermissionScope = "journal"` es subset de
 * `PostableResource = "sales" | "purchases" | "journal"` del legacy. TypeScript
 * acepta el pass-through estructuralmente, sin código de translation. Si el
 * port amplía `PermissionScope` en el futuro (sale/purchase migrados), el
 * pass-through sigue válido sin cambios — el legacy ya cubre el dominio entero.
 *
 * §13 lockeado en C3-C Ciclo 3 (spike pre-RED legítimo, no ceremonial — el
 * shape del legacy se destapó leyendo `features/permissions/permissions.server.ts`,
 * NO estaba en el bookmark de Step 0):
 *   - **Wrap-thin** legitimado por análisis 0-divergencia material:
 *     async match, throw semantics match (fail-closed missing role + propagate
 *     infra throws), side effects match (read-only sobre cache), return total
 *     match. Tabla dimensión-por-dimensión cierra el caso.
 *   - **NO adapter sustantivo** — sin translation logic. Si emerge divergencia
 *     futura (cambio de signature legacy o de port), la decisión reabre.
 *   - **Mock-del-colaborador test shape**: legacy es función pura sobre cache;
 *     mockear cache+Prisma en integration es overhead injustificado.
 *
 * Convention `infrastructure-adapter-naming` (lockeada C3-C):
 *   - Filename `legacy-permissions.adapter.ts` (sin `-read-` infix porque el
 *     port es `PermissionsPort`, no `PermissionsReadPort` — adapter sigue al
 *     port).
 *   - Sub-prefijo `legacy-` porque wrappea `features/permissions/`.
 */

export class LegacyPermissionsAdapter implements PermissionsPort {
  async canPost(
    role: string,
    scope: PermissionScope,
    organizationId: string,
  ): Promise<boolean> {
    return legacyCanPost(role, scope, organizationId);
  }
}

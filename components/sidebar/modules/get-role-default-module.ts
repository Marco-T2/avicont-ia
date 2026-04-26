import type {
  ClientMatrix,
  ClientMatrixSnapshot,
} from "@/components/common/roles-matrix-provider";
import type { Resource } from "@/features/permissions";
import type { ModuleId } from "./registry";

export const ACCOUNTING_RESOURCES: Resource[] = [
  "sales",
  "purchases",
  "payments",
  "journal",
  "dispatches",
  "reports",
  "contacts",
  "accounting-config",
];

export function getRoleDefaultModule(
  matrix: ClientMatrix | null,
): ModuleId | null {
  if (!matrix) return null;
  if (ACCOUNTING_RESOURCES.some((r) => matrix.canAccess(r, "read"))) {
    return "contabilidad";
  }
  if (matrix.canAccess("farms", "read")) return "granjas";
  return null;
}

export function getRoleDefaultModuleFromSnapshot(
  snapshot: ClientMatrixSnapshot | null,
): ModuleId | null {
  if (!snapshot) return null;
  const reads = snapshot.permissionsRead;
  if (ACCOUNTING_RESOURCES.some((r) => reads.includes(r))) {
    return "contabilidad";
  }
  if (reads.includes("farms")) return "granjas";
  return null;
}

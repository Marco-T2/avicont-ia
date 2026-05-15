/**
 * PR2.8 [GREEN] — RolesMatrixGrouped
 * REQ-RM.1, REQ-RM.2, REQ-RM.4, REQ-RM.7, REQ-RM.21, REQ-RM.22
 *
 * Top-level presentational grouped matrix. Derives sections from MODULES[] +
 * "Organización" via groupResources(). No "Contabilizar" section.
 *
 * Fully controlled — owns no state. Receives readSet/writeSet/postSet + onToggle
 * from the parent (RoleEditDrawer in PR5). disabled=true for system roles.
 */
import type { Resource, PostableResource } from "@/features/permissions";
import { MODULES } from "@/components/sidebar/modules/registry";
import { groupResources } from "@/lib/settings/group-resources";
import { MatrixSection } from "@/components/settings/matrix-section";

// ─── Canonical resource order (same as drawer + static viewer) ───────────────

const RESOURCE_ORDER: Resource[] = [
  "members",
  "accounting-config",
  "sales",
  "purchases",
  "payments",
  "journal",
  "dispatches",
  "reports",
  "contacts",
  "farms",
  "documents",
  "agent",
  "period",
  "audit",
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface RolesMatrixGroupedProps {
  readSet: Set<Resource>;
  writeSet: Set<Resource>;
  postSet: Set<PostableResource>;
  /** true for system roles — all checkboxes rendered disabled */
  disabled: boolean;
  onToggle: (
    resource: Resource,
    column: "read" | "write" | "post",
    next: boolean,
  ) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RolesMatrixGrouped({
  readSet,
  writeSet,
  postSet,
  disabled,
  onToggle,
}: RolesMatrixGroupedProps) {
  // Derive sections dynamically — new modules in registry auto-appear
  const groups = groupResources(RESOURCE_ORDER, MODULES);

  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Recurso</th>
            <th className="text-center px-3 py-2 font-medium">Ver</th>
            <th className="text-center px-3 py-2 font-medium">Editar</th>
            <th className="text-center px-3 py-2 font-medium">Registrar</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <MatrixSection
              key={group.label}
              label={group.label}
              resources={group.resources}
              readSet={readSet}
              writeSet={writeSet}
              postSet={postSet}
              disabled={disabled}
              onToggle={onToggle}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

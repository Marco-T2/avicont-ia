/**
 * PR2.10 [GREEN] — RolesPermissionsMatrix — grouped static viewer
 * REQ-RM.25
 *
 * Read-only view of the 6 roles × 12 resources × (read/write/post) matrix,
 * now rendered with module-grouped sections matching the drawer (REQ-RM.25).
 *
 * Replaces the 3 flat tables (read, write, post) with a single grouped table
 * showing Ver / Editar / Registrar columns per row — same structure as the drawer,
 * but fully static (no toggle handlers, no edit state).
 */
import { Check, X } from "lucide-react";
import {
  PERMISSIONS_READ,
  PERMISSIONS_WRITE,
  getPostAllowedRoles,
  type PostableResource,
  type Resource,
  type Role,
} from "@/features/permissions";
import { MODULES } from "@/components/sidebar/modules/registry";
import { groupResources } from "@/lib/settings/group-resources";
import { RESOURCE_LABELS } from "@/lib/settings/resource-labels";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: Role[] = [
  "owner",
  "admin",
  "contador",
  "cobrador",
  "member",
];

const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  contador: "Contador",
  cobrador: "Cobrador",
  member: "Miembro",
};

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
];

const POSTABLE_RESOURCES = new Set<Resource>(["sales", "purchases", "journal"] as PostableResource[]);
const POST_ALLOWED = getPostAllowedRoles();

// ─── Cell ─────────────────────────────────────────────────────────────────────

function Cell({
  allowed,
  testId,
}: {
  allowed: boolean;
  testId: string;
}) {
  return (
    <td
      data-testid={testId}
      data-allowed={allowed}
      className="text-center px-2 py-1.5"
    >
      {allowed ? (
        <Check className="h-4 w-4 text-success inline-block" aria-label="permitido" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground/50 inline-block" aria-label="denegado" />
      )}
    </td>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RolesPermissionsMatrix() {
  const groups = groupResources(RESOURCE_ORDER, MODULES);

  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Recurso</th>
            {ROLES.map((role) => (
              <th
                key={`${role}-read`}
                scope="col"
                colSpan={POSTABLE_RESOURCES.has("sales") ? 3 : 2}
                className="text-center px-2 py-2 font-medium border-l"
              >
                {ROLE_LABELS[role]}
              </th>
            ))}
          </tr>
          <tr className="bg-muted/50 border-b text-xs text-muted-foreground">
            <th className="px-3 py-1" />
            {ROLES.map((role) => (
              <>
                <th key={`${role}-read-sub`} className="text-center px-2 py-1 border-l">Ver</th>
                <th key={`${role}-write-sub`} className="text-center px-2 py-1">Editar</th>
                <th key={`${role}-post-sub`} className="text-center px-2 py-1">Registrar</th>
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <>
              {/* Section heading row */}
              <tr key={`heading-${group.label}`} className="bg-muted">
                <td
                  colSpan={1 + ROLES.length * 3}
                  className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {group.label}
                </td>
              </tr>

              {/* Resource rows */}
              {group.resources.map((res, i) => {
                const isPostable = POSTABLE_RESOURCES.has(res);
                return (
                  <tr
                    key={res}
                    className={cn("border-b last:border-b-0", i % 2 === 1 && "bg-muted/30")}
                  >
                    <td className="px-3 py-1.5 font-medium">
                      {RESOURCE_LABELS[res as Resource]}
                    </td>
                    {ROLES.map((role) => (
                      <>
                        {/* Ver (read) */}
                        <Cell
                          key={`${res}-${role}-read`}
                          allowed={PERMISSIONS_READ[res as Resource]?.includes(role) ?? false}
                          testId={`cell-${res}-${role}-read`}
                        />
                        {/* Editar (write) */}
                        <Cell
                          key={`${res}-${role}-write`}
                          allowed={PERMISSIONS_WRITE[res as Resource]?.includes(role) ?? false}
                          testId={`cell-${res}-${role}-write`}
                        />
                        {/* Registrar (post) — only for postable; empty cell otherwise */}
                        {isPostable ? (
                          <Cell
                            key={`${res}-${role}-post`}
                            allowed={(POST_ALLOWED as Record<string, Role[]>)[res]?.includes(role) ?? false}
                            testId={`cell-${res}-${role}-post`}
                          />
                        ) : (
                          <td key={`${res}-${role}-post-empty`} className="text-center px-2 py-1.5" aria-hidden="true" />
                        )}
                      </>
                    ))}
                  </tr>
                );
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

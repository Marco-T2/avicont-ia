import { Check, X } from "lucide-react";
import {
  PERMISSIONS_READ,
  PERMISSIONS_WRITE,
  getPostAllowedRoles,
  type PostableResource,
  type Resource,
  type Role,
} from "@/features/shared/permissions";
import { cn } from "@/lib/utils";

const ROLES: Role[] = [
  "owner",
  "admin",
  "contador",
  "cobrador",
  "auxiliar",
  "member",
];

const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  contador: "Contador",
  cobrador: "Cobrador",
  auxiliar: "Auxiliar",
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

const RESOURCE_LABELS: Record<Resource, string> = {
  members: "Miembros",
  "accounting-config": "Configuración contable",
  sales: "Ventas",
  purchases: "Compras",
  payments: "Cobros y Pagos",
  journal: "Libro Diario",
  dispatches: "Despachos",
  reports: "Informes",
  contacts: "Contactos",
  farms: "Granjas",
  documents: "Documentos",
  agent: "Agente IA",
};

const POSTABLE_RESOURCES: PostableResource[] = ["sales", "purchases", "journal"];

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
        <Check className="h-4 w-4 text-emerald-600 inline-block" aria-label="permitido" />
      ) : (
        <X className="h-4 w-4 text-gray-300 inline-block" aria-label="denegado" />
      )}
    </td>
  );
}

function MatrixSection({
  title,
  description,
  action,
  matrix,
  resources,
}: {
  title: string;
  description: string;
  action: "read" | "write" | "post";
  matrix: Record<string, Role[]>;
  resources: readonly (Resource | PostableResource)[];
}) {
  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Recurso</th>
              {ROLES.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className="text-center px-2 py-2 font-medium"
                >
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map((res, i) => (
              <tr
                key={res}
                className={cn("border-b last:border-b-0", i % 2 === 1 && "bg-gray-50/50")}
              >
                <td className="px-3 py-1.5 font-medium">
                  {RESOURCE_LABELS[res as Resource]}
                </td>
                {ROLES.map((role) => (
                  <Cell
                    key={role}
                    allowed={matrix[res]?.includes(role) ?? false}
                    testId={`cell-${res}-${role}-${action}`}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RolesPermissionsMatrix() {
  return (
    <div className="space-y-6">
      <MatrixSection
        title="Lectura"
        description="Quién puede ver el recurso y acceder a sus vistas."
        action="read"
        matrix={PERMISSIONS_READ}
        resources={RESOURCE_ORDER}
      />
      <MatrixSection
        title="Escritura"
        description="Quién puede crear, editar o eliminar registros en el recurso."
        action="write"
        matrix={PERMISSIONS_WRITE}
        resources={RESOURCE_ORDER}
      />
      <MatrixSection
        title="Contabilizar"
        description="Quién puede postear (cambiar de borrador a definitivo) en los recursos contabilizables."
        action="post"
        matrix={getPostAllowedRoles() as Record<string, Role[]>}
        resources={POSTABLE_RESOURCES}
      />
    </div>
  );
}

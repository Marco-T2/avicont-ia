"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Resource, PostableResource } from "@/features/shared/permissions";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CustomRoleShape = {
  id: string;
  slug: string;
  name: string;
  isSystem: boolean;
  permissionsRead: string[];
  permissionsWrite: string[];
  canPost: string[];
};

interface RoleEditDrawerProps {
  orgSlug: string;
  role: CustomRoleShape;
  onUpdated: () => void;
}

// ─── Constants (12 resources × 2 actions, same order as matrix viewer) ───────

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
  "accounting-config": "Config. contable",
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

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * RoleEditDrawer — matrix toggle grid + canPost switch for a custom role.
 *
 * PR7.4 / REQ CR.5-S1, CR.5-S2, CR.2-S3, U.5-S1, U.5-S2
 * - Shows 12 resources × (read + write) checkboxes
 * - Shows 3 canPost checkboxes (sales, purchases, journal)
 * - All controls disabled when role.isSystem
 * - PATCH /api/organizations/[orgSlug]/roles/[roleSlug] on Save
 */
export default function RoleEditDrawer({
  orgSlug,
  role,
  onUpdated,
}: RoleEditDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Local copies of permission arrays (editing state)
  const [readSet, setReadSet] = useState<Set<string>>(
    new Set(role.permissionsRead),
  );
  const [writeSet, setWriteSet] = useState<Set<string>>(
    new Set(role.permissionsWrite),
  );
  const [postSet, setPostSet] = useState<Set<string>>(
    new Set(role.canPost),
  );

  function resetState() {
    setReadSet(new Set(role.permissionsRead));
    setWriteSet(new Set(role.permissionsWrite));
    setPostSet(new Set(role.canPost));
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) resetState(); // reset to server state every time drawer opens
  }

  function toggleSet(
    set: Set<string>,
    setter: (s: Set<string>) => void,
    key: string,
  ) {
    const next = new Set(set);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setter(next);
  }

  async function handleSave() {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/roles/${role.slug}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            permissionsRead: Array.from(readSet),
            permissionsWrite: Array.from(writeSet),
            canPost: Array.from(postSet),
          }),
        },
      );

      if (res.ok) {
        toast.success("Rol actualizado");
        setOpen(false);
        onUpdated();
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Error al actualizar el rol");
      }
    } catch {
      toast.error("Error al actualizar el rol");
    } finally {
      setIsLoading(false);
    }
  }

  const disabled = role.isSystem || isLoading;

  return (
    <Sheet key={role.id} open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Editar
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Editar rol: <span className="font-mono">{role.name}</span>
          </SheetTitle>
          {role.isSystem && (
            <p className="text-sm text-muted-foreground">
              Los roles del sistema no se pueden modificar.
            </p>
          )}
        </SheetHeader>

        {/* Matrix grid */}
        <div className="mt-4 space-y-4">
          {/* Read + Write */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Permisos de recurso</h3>
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Recurso</th>
                    <th className="text-center px-3 py-2 font-medium">Leer</th>
                    <th className="text-center px-3 py-2 font-medium">Escribir</th>
                  </tr>
                </thead>
                <tbody>
                  {RESOURCE_ORDER.map((res, i) => (
                    <tr
                      key={res}
                      className={cn(
                        "border-b last:border-b-0",
                        i % 2 === 1 && "bg-gray-50/50",
                      )}
                    >
                      <td className="px-3 py-2 font-medium">
                        {RESOURCE_LABELS[res]}
                      </td>
                      <td className="text-center px-3 py-2">
                        <input
                          type="checkbox"
                          data-testid={`toggle-read-${res}`}
                          checked={readSet.has(res)}
                          disabled={disabled}
                          onChange={() =>
                            toggleSet(readSet, setReadSet, res)
                          }
                          className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="text-center px-3 py-2">
                        <input
                          type="checkbox"
                          data-testid={`toggle-write-${res}`}
                          checked={writeSet.has(res)}
                          disabled={disabled}
                          onChange={() =>
                            toggleSet(writeSet, setWriteSet, res)
                          }
                          className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* canPost */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Contabilizar (post)</h3>
            <div className="border rounded-md divide-y">
              {POSTABLE_RESOURCES.map((res) => (
                <div key={res} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm">{RESOURCE_LABELS[res as Resource]}</span>
                  <input
                    type="checkbox"
                    data-testid={`toggle-canpost-${res}`}
                    checked={postSet.has(res)}
                    disabled={disabled}
                    onChange={() => toggleSet(postSet, setPostSet, res)}
                    className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={disabled || role.isSystem}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

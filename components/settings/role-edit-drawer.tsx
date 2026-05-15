"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Resource, PostableResource } from "@/features/permissions";
import { MODULES } from "@/components/sidebar/modules/registry";
import { RolesMatrixGrouped } from "@/components/settings/roles-matrix-grouped";
import { MatrixWarnings } from "@/components/settings/matrix-warnings";
import { RoleSidebarPreview } from "@/components/settings/role-sidebar-preview";
import { computeWarnings } from "@/lib/settings/compute-warnings";

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

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * RoleEditDrawer — grouped matrix (Ver/Editar/Registrar) + live sidebar preview
 * + soft inline warnings for a custom role.
 *
 * PR5.2 / REQ-RM.1–8, RM.15–24
 * - RolesMatrixGrouped replaces the old flat table + "Contabilizar" section
 * - MatrixWarnings shows soft yellow badges (write-without-read, etc.)
 * - RoleSidebarPreview renders as desktop side-panel or mobile <details>
 * - Dialog (modal) instead of Sheet: centered, wider canvas (sm:max-w-6xl)
 *   avoids the lateral-scroll issue caused by the 2-col layout inside a side-drawer
 * - All controls disabled when role.isSystem (REQ-RM.21)
 * - Save button hidden for system roles (REQ-RM.22)
 * - PATCH payload unchanged: permissionsRead, permissionsWrite, canPost (REQ-RM.23)
 */
export default function RoleEditDrawer({
  orgSlug,
  role,
  onUpdated,
}: RoleEditDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Local copies of permission sets (editing state)
  const [readSet, setReadSet] = useState<Set<Resource>>(
    new Set(role.permissionsRead as Resource[]),
  );
  const [writeSet, setWriteSet] = useState<Set<Resource>>(
    new Set(role.permissionsWrite as Resource[]),
  );
  const [postSet, setPostSet] = useState<Set<PostableResource>>(
    new Set(role.canPost as PostableResource[]),
  );

  function resetState() {
    setReadSet(new Set(role.permissionsRead as Resource[]));
    setWriteSet(new Set(role.permissionsWrite as Resource[]));
    setPostSet(new Set(role.canPost as PostableResource[]));
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) resetState(); // reset to server state every time drawer opens
  }

  /** Unified toggle handler wired to RolesMatrixGrouped. */
  function handleToggle(
    resource: Resource,
    column: "read" | "write" | "post",
    next: boolean,
  ) {
    if (column === "read") {
      const s = new Set(readSet);
      if (next) s.add(resource);
      else s.delete(resource);
      setReadSet(s);
    } else if (column === "write") {
      const s = new Set(writeSet);
      if (next) s.add(resource);
      else s.delete(resource);
      setWriteSet(s);
    } else {
      const s = new Set(postSet);
      if (next) s.add(resource as PostableResource);
      else s.delete(resource as PostableResource);
      setPostSet(s);
    }
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

  // Derived at render time — no new state, no useMemo needed (MODULES.length is tiny)
  const warnings = computeWarnings(readSet, writeSet, postSet, MODULES);

  const matrixDisabled = role.isSystem || isLoading;

  return (
    <Dialog key={role.id} open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {role.isSystem ? (
            <Eye className="h-3.5 w-3.5 mr-1.5" />
          ) : (
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
          )}
          {role.isSystem ? "Ver" : "Editar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {role.isSystem ? "Ver permisos del rol" : "Editar rol"}:{" "}
            <span className="font-mono">{role.name}</span>
          </DialogTitle>
          {role.isSystem && (
            <p className="text-sm text-muted-foreground">
              Los roles del sistema no se pueden modificar.
            </p>
          )}
        </DialogHeader>

        {/* Main body — matrix + preview side by side on sm+; stacked on mobile */}
        <div className="mt-4 flex flex-col sm:grid sm:grid-cols-[3fr_2fr] gap-6">

          {/* Left column: grouped matrix + warnings */}
          <div className="space-y-3 min-w-0">
            <RolesMatrixGrouped
              readSet={readSet}
              writeSet={writeSet}
              postSet={postSet}
              disabled={matrixDisabled}
              onToggle={handleToggle}
            />
            <MatrixWarnings warnings={warnings} />
          </div>

          {/* Right column: live sidebar preview (dual-mount via RoleSidebarPreview) */}
          <div className="min-w-0">
            <RoleSidebarPreview
              readSet={readSet}
              writeSet={writeSet}
              orgSlug={orgSlug}
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          {/* REQ-RM.22: Save button hidden for system roles */}
          {!role.isSystem && (
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

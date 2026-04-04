"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, UserMinus, UserCog } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  role: string;
  userId: string;
  name: string;
  email: string;
}

interface MembersTableProps {
  orgSlug: string;
  members: Member[];
  onUpdated?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  contador: "Contador",
  member: "Socio",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800 border-purple-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  contador: "bg-green-100 text-green-800 border-green-200",
  member: "bg-gray-100 text-gray-800 border-gray-200",
};

const ASSIGNABLE_ROLES = ["member", "contador", "admin"] as const;

export default function MembersTable({
  orgSlug,
  members,
  onUpdated,
}: MembersTableProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [roleDialogMember, setRoleDialogMember] = useState<Member | null>(null);
  const [deactivateDialogMember, setDeactivateDialogMember] = useState<Member | null>(null);
  const [newRole, setNewRole] = useState("");

  const handleUpdateRole = async () => {
    if (!roleDialogMember || !newRole) return;

    setLoadingId(roleDialogMember.id);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/members/${roleDialogMember.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        },
      );

      if (response.ok) {
        toast.success("Rol actualizado exitosamente");
        setRoleDialogMember(null);
        onUpdated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al actualizar el rol");
      }
    } catch {
      toast.error("Error al actualizar el rol");
    } finally {
      setLoadingId(null);
    }
  };

  const handleRemove = async () => {
    if (!deactivateDialogMember) return;

    setLoadingId(deactivateDialogMember.id);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/members/${deactivateDialogMember.id}`,
        { method: "DELETE" },
      );

      if (response.ok) {
        toast.success("Miembro desactivado exitosamente");
        setDeactivateDialogMember(null);
        onUpdated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al desactivar miembro");
      }
    } catch {
      toast.error("Error al desactivar miembro");
    } finally {
      setLoadingId(null);
    }
  };

  const openRoleDialog = (member: Member) => {
    setNewRole(member.role);
    setRoleDialogMember(member);
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Nombre</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Rol</th>
              <th className="text-right px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-muted/25">
                <td className="px-4 py-3 font-medium">{member.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {member.email}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={ROLE_COLORS[member.role] ?? ROLE_COLORS.member}
                  >
                    {ROLE_LABELS[member.role] ?? member.role}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {member.role !== "owner" && (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openRoleDialog(member)}
                        disabled={loadingId === member.id}
                      >
                        <UserCog className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeactivateDialogMember(member)}
                        disabled={loadingId === member.id}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Change role dialog */}
      <Dialog
        open={!!roleDialogMember}
        onOpenChange={(open) => !open && setRoleDialogMember(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Cambiar Rol</DialogTitle>
            <DialogDescription>
              Cambiar el rol de {roleDialogMember?.name}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="block text-sm font-medium mb-2">
              Nuevo Rol
            </label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialogMember(null)}
              disabled={!!loadingId}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={!!loadingId || newRole === roleDialogMember?.role}
            >
              {loadingId ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm deactivate dialog */}
      <Dialog
        open={!!deactivateDialogMember}
        onOpenChange={(open) => !open && setDeactivateDialogMember(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>¿Desactivar miembro?</DialogTitle>
            <DialogDescription>
              El miembro {deactivateDialogMember?.name} será desactivado y
              perderá acceso a la organización. Podrá ser reactivado más
              adelante.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateDialogMember(null)}
              disabled={!!loadingId}
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={handleRemove}
              disabled={!!loadingId}
            >
              {loadingId ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Desactivando...
                </>
              ) : (
                "Desactivar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

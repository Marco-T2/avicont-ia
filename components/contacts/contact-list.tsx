"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import ContactFiltersBar from "./contact-filters";
import ContactForm from "./contact-form";
import type { ContactWithBalance, ContactFilters, Contact } from "@/modules/contacts/presentation/index";

const TYPE_BADGE_STYLES: Record<string, string> = {
  CLIENTE: "bg-info/10 text-info dark:bg-info/20",
  PROVEEDOR: "bg-warning/10 text-warning dark:bg-warning/20",
  SOCIO: "bg-success/10 text-success dark:bg-success/20",
  TRANSPORTISTA: "bg-primary/10 text-primary dark:bg-primary/20",
  OTRO: "bg-muted text-muted-foreground",
};

const TYPE_LABELS: Record<string, string> = {
  CLIENTE: "Cliente",
  PROVEEDOR: "Proveedor",
  SOCIO: "Socio",
  TRANSPORTISTA: "Transportista",
  OTRO: "Otro",
};

function formatCurrency(value: string | number | null | undefined): string {
  if (value == null) return "Bs. 0,00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return `Bs. ${num.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface ContactListProps {
  contacts: ContactWithBalance[];
  orgSlug: string;
}

export default function ContactList({ contacts: initialContacts, orgSlug }: ContactListProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<ContactFilters>({ isActive: true });
  const [showCreate, setShowCreate] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ContactWithBalance | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const filtered = initialContacts.filter((contact) => {
    if (filters.type && contact.type !== filters.type) return false;
    if (filters.isActive !== undefined && contact.isActive !== filters.isActive) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !contact.name.toLowerCase().includes(q) &&
        !(contact.nit ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setIsDeactivating(true);

    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/contacts/${deactivateTarget.id}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al desactivar el contacto");
      }

      toast.success(`Contacto "${deactivateTarget.name}" desactivado`);
      setDeactivateTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al desactivar el contacto");
    } finally {
      setIsDeactivating(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <ContactFiltersBar filters={filters} onChange={setFilters} />
          <Button onClick={() => setShowCreate(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Contacto
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nombre</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">NIT</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Teléfono</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">CxC Abierta</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">CxP Abierta</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Estado</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <Users className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
                        <p className="text-muted-foreground">No hay contactos registrados</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">
                          {filters.type || filters.search || filters.isActive !== undefined
                            ? "Pruebe ajustando los filtros"
                            : "Cree el primer contacto para comenzar"}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((contact) => (
                      <tr
                        key={contact.id}
                        className={`border-b hover:bg-accent/50 ${!contact.isActive ? "opacity-50" : ""}`}
                      >
                        <td className="py-3 px-4">
                          <Badge
                            className={TYPE_BADGE_STYLES[contact.type] ?? "bg-muted text-muted-foreground"}
                          >
                            {TYPE_LABELS[contact.type] ?? contact.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-medium">
                          <Link
                            href={`/${orgSlug}/accounting/contacts/${contact.id}`}
                            className="hover:underline"
                          >
                            {contact.name}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
                          {contact.nit ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {contact.phone ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-info">
                          {formatCurrency(String(contact.balanceSummary.totalReceivable))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-warning">
                          {formatCurrency(String(contact.balanceSummary.totalPayable))}
                        </td>
                        <td className="py-3 px-4">
                          {contact.isActive ? (
                            <Badge className="bg-success/10 text-success dark:bg-success/20">Activo</Badge>
                          ) : (
                            <Badge className="bg-muted text-muted-foreground">Inactivo</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditContact(contact)}
                            >
                              Editar
                            </Button>
                            {contact.isActive && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => setDeactivateTarget(contact)}
                              >
                                Desactivar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create dialog */}
      <ContactForm
        orgSlug={orgSlug}
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={() => {
          setShowCreate(false);
          router.refresh();
        }}
      />

      {/* Edit dialog */}
      {editContact && (
        <ContactForm
          orgSlug={orgSlug}
          contact={editContact}
          open={!!editContact}
          onOpenChange={(open) => { if (!open) setEditContact(null); }}
          onSuccess={() => {
            setEditContact(null);
            router.refresh();
          }}
        />
      )}

      {/* Deactivate confirmation dialog */}
      <Dialog
        open={!!deactivateTarget}
        onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Desactivar contacto</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Está seguro de que desea desactivar a{" "}
            <span className="font-semibold text-foreground">{deactivateTarget?.name}</span>?
            El contacto no podrá ser seleccionado en nuevas transacciones.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateTarget(null)}
              disabled={isDeactivating}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={isDeactivating}
            >
              {isDeactivating ? (
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

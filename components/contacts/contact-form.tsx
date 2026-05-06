"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CONTACT_NIT_EXISTS } from "@/features/shared/errors";
import type { Contact } from "@/modules/contacts/presentation/index";

const CONTACT_TYPE_OPTIONS = [
  { value: "CLIENTE", label: "Cliente" },
  { value: "PROVEEDOR", label: "Proveedor" },
  { value: "SOCIO", label: "Socio" },
  { value: "TRANSPORTISTA", label: "Transportista" },
  { value: "OTRO", label: "Otro" },
] as const;

interface ContactFormProps {
  orgSlug: string;
  contact?: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormState {
  type: string;
  name: string;
  nit: string;
  email: string;
  phone: string;
  address: string;
  paymentTermsDays: string;
  creditLimit: string;
}

function getInitialState(contact?: Contact): FormState {
  if (contact) {
    return {
      type: contact.type,
      name: contact.name,
      nit: contact.nit ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      address: contact.address ?? "",
      paymentTermsDays: String(contact.paymentTermsDays),
      creditLimit: contact.creditLimit != null ? String(contact.creditLimit) : "",
    };
  }
  return {
    type: "",
    name: "",
    nit: "",
    email: "",
    phone: "",
    address: "",
    paymentTermsDays: "30",
    creditLimit: "",
  };
}

export default function ContactForm({
  orgSlug,
  contact,
  open,
  onOpenChange,
  onSuccess,
}: ContactFormProps) {
  const isEditing = !!contact;
  const [form, setForm] = useState<FormState>(() => getInitialState(contact));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nitError, setNitError] = useState<string | null>(null);

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "nit") setNitError(null);
  }

  function resetForm() {
    setForm(getInitialState(contact));
    setNitError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setNitError(null);

    try {
      const body = {
        type: form.type,
        name: form.name.trim(),
        nit: form.nit.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        paymentTermsDays: parseInt(form.paymentTermsDays, 10) || 30,
        creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : null,
      };

      const url = isEditing
        ? `/api/organizations/${orgSlug}/contacts/${contact.id}`
        : `/api/organizations/${orgSlug}/contacts`;

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.code === CONTACT_NIT_EXISTS) {
          setNitError("Ya existe un contacto con este NIT en la organización.");
          return;
        }
        throw new Error(data.error ?? "Error al guardar el contacto");
      }

      toast.success(isEditing ? "Contacto actualizado exitosamente" : "Contacto creado exitosamente");
      handleOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el contacto");
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = form.type && form.name.trim();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Contacto" : "Nuevo Contacto"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-type">Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => handleChange("type", v)} required>
                <SelectTrigger id="contact-type">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-name">Nombre *</Label>
              <Input
                id="contact-name"
                placeholder="Nombre del contacto"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-nit">NIT</Label>
            <Input
              id="contact-nit"
              placeholder="Ej: 12345678"
              value={form.nit}
              onChange={(e) => handleChange("nit", e.target.value)}
            />
            {nitError && (
              <p className="text-sm text-destructive">{nitError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-email">Correo electrónico</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-phone">Teléfono</Label>
              <Input
                id="contact-phone"
                placeholder="Ej: +591 70000000"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-address">Dirección</Label>
            <Input
              id="contact-address"
              placeholder="Dirección del contacto"
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-payment-terms">Días de plazo de pago</Label>
              <Input
                id="contact-payment-terms"
                type="number"
                min={0}
                max={365}
                value={form.paymentTermsDays}
                onChange={(e) => handleChange("paymentTermsDays", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-credit-limit">Límite de crédito (Bs.)</Label>
              <Input
                id="contact-credit-limit"
                type="number"
                min={0}
                step="0.01"
                placeholder="Sin límite"
                value={form.creditLimit}
                onChange={(e) => handleChange("creditLimit", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : isEditing ? (
                "Actualizar"
              ) : (
                "Crear Contacto"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

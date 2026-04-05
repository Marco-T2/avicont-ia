"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "radix-ui";
import { Pencil } from "lucide-react";
import ContactForm from "./contact-form";
import type { ContactWithBalance } from "@/features/contacts";

const TYPE_BADGE_STYLES: Record<string, string> = {
  CLIENTE: "bg-blue-100 text-blue-800",
  PROVEEDOR: "bg-orange-100 text-orange-800",
  SOCIO: "bg-green-100 text-green-800",
  TRANSPORTISTA: "bg-purple-100 text-purple-800",
  OTRO: "bg-gray-100 text-gray-600",
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

interface ContactDetailProps {
  contact: ContactWithBalance;
  orgSlug: string;
}

export default function ContactDetail({ contact, orgSlug }: ContactDetailProps) {
  const [showEdit, setShowEdit] = useState(false);

  const totalReceivable = parseFloat(String(contact.balanceSummary.totalReceivable));
  const totalPayable = parseFloat(String(contact.balanceSummary.totalPayable));
  const netPosition = parseFloat(String(contact.balanceSummary.netPosition));

  return (
    <>
      <div className="space-y-6">
        {/* Header card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-xl">{contact.name}</CardTitle>
                  <Badge
                    className={TYPE_BADGE_STYLES[contact.type] ?? "bg-gray-100 text-gray-600"}
                  >
                    {TYPE_LABELS[contact.type] ?? contact.type}
                  </Badge>
                  {!contact.isActive && (
                    <Badge className="bg-gray-100 text-gray-500">Inactivo</Badge>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEdit(true)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {contact.nit && (
                <div>
                  <dt className="text-muted-foreground">NIT</dt>
                  <dd className="font-mono font-medium mt-0.5">{contact.nit}</dd>
                </div>
              )}
              {contact.email && (
                <div>
                  <dt className="text-muted-foreground">Correo electrónico</dt>
                  <dd className="font-medium mt-0.5">{contact.email}</dd>
                </div>
              )}
              {contact.phone && (
                <div>
                  <dt className="text-muted-foreground">Teléfono</dt>
                  <dd className="font-medium mt-0.5">{contact.phone}</dd>
                </div>
              )}
              {contact.address && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Dirección</dt>
                  <dd className="font-medium mt-0.5">{contact.address}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">Días de plazo</dt>
                <dd className="font-medium mt-0.5">{contact.paymentTermsDays} días</dd>
              </div>
              {contact.creditLimit != null && (
                <div>
                  <dt className="text-muted-foreground">Límite de crédito</dt>
                  <dd className="font-medium mt-0.5">
                    {formatCurrency(String(contact.creditLimit))}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Balance summary card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total CxC</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {formatCurrency(totalReceivable)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Cuentas por cobrar abiertas</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total CxP</p>
              <p className="text-2xl font-bold text-orange-700 mt-1">
                {formatCurrency(totalPayable)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Cuentas por pagar abiertas</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Posición Neta</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  netPosition >= 0 ? "text-green-700" : "text-red-600"
                }`}
              >
                {formatCurrency(netPosition)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {netPosition >= 0 ? "Saldo a favor" : "Saldo en contra"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CxC / CxP tabs */}
        <Tabs.Root defaultValue="cxc">
          <Tabs.List className="flex border-b mb-4">
            <Tabs.Trigger
              value="cxc"
              className="px-4 py-2 text-sm font-medium text-muted-foreground border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground transition-colors"
            >
              Cuentas por Cobrar
            </Tabs.Trigger>
            <Tabs.Trigger
              value="cxp"
              className="px-4 py-2 text-sm font-medium text-muted-foreground border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground transition-colors"
            >
              Cuentas por Pagar
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="cxc">
            <p className="text-sm text-muted-foreground py-6 text-center">
              Los detalles de cuentas por cobrar estarán disponibles próximamente.
            </p>
          </Tabs.Content>

          <Tabs.Content value="cxp">
            <p className="text-sm text-muted-foreground py-6 text-center">
              Los detalles de cuentas por pagar estarán disponibles próximamente.
            </p>
          </Tabs.Content>
        </Tabs.Root>
      </div>

      <ContactForm
        orgSlug={orgSlug}
        contact={contact}
        open={showEdit}
        onOpenChange={setShowEdit}
        onSuccess={() => {
          setShowEdit(false);
          // Refresh is handled by server component re-render via router.refresh() in the page
          window.location.reload();
        }}
      />
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface OrgSettings {
  id: string;
  cajaGeneralAccountCode: string;
  bancoAccountCode: string;
  cxcAccountCode: string;
  cxpAccountCode: string;
  roundingThreshold: number;
}

interface OrgSettingsFormProps {
  orgSlug: string;
  settings: OrgSettings;
}

export function OrgSettingsForm({ orgSlug, settings }: OrgSettingsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [cajaGeneral, setCajaGeneral] = useState(settings.cajaGeneralAccountCode);
  const [banco, setBanco] = useState(settings.bancoAccountCode);
  const [cxc, setCxc] = useState(settings.cxcAccountCode);
  const [cxp, setCxp] = useState(settings.cxpAccountCode);
  const [threshold, setThreshold] = useState(String(settings.roundingThreshold));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${orgSlug}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cajaGeneralAccountCode: cajaGeneral,
          bancoAccountCode: banco,
          cxcAccountCode: cxc,
          cxpAccountCode: cxp,
          roundingThreshold: parseFloat(threshold) || 0.7,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al guardar configuración");
        return;
      }

      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cuentas Contables</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Códigos de las cuentas del Plan de Cuentas que el sistema utiliza
            para generar asientos automáticos.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="caja-general">Caja General</Label>
              <Input
                id="caja-general"
                value={cajaGeneral}
                onChange={(e) => setCajaGeneral(e.target.value)}
                placeholder="1.1.1.1"
              />
              <p className="text-xs text-muted-foreground">
                Se usa en cobros y pagos como cuenta puente de tesorería.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="banco">Banco</Label>
              <Input
                id="banco"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                placeholder="1.1.2.1"
              />
              <p className="text-xs text-muted-foreground">
                Se usa en transferencias y depósitos bancarios.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cxc">Cuentas por Cobrar</Label>
              <Input
                id="cxc"
                value={cxc}
                onChange={(e) => setCxc(e.target.value)}
                placeholder="1.1.4.1"
              />
              <p className="text-xs text-muted-foreground">
                Se debita al contabilizar despachos (ND/BC).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cxp">Cuentas por Pagar</Label>
              <Input
                id="cxp"
                value={cxp}
                onChange={(e) => setCxp(e.target.value)}
                placeholder="2.1.1.1"
              />
              <p className="text-xs text-muted-foreground">
                Se usa en órdenes de compra y pagos a proveedores.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Redondeo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="threshold">Umbral de Redondeo</Label>
            <Input
              id="threshold"
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="0.70"
            />
            <p className="text-xs text-muted-foreground">
              Si el primer decimal del total es ≥ este umbral, se redondea hacia
              arriba. Caso contrario, hacia abajo. Valor entre 0 y 1.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Guardando..." : "Guardar Configuración"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface OrgSettings {
  id: string;
  cajaGeneralAccountCode: string;
  bancoAccountCode: string;
  cxcAccountCode: string;
  cxpAccountCode: string;
  roundingThreshold: number;
  cashParentCode: string;
  pettyCashParentCode: string;
  bankParentCode: string;
  fleteExpenseAccountCode: string;
  polloFaenadoCOGSAccountCode: string;
}

/**
 * Subset del modelo Prisma `Account` que el form necesita para poblar los
 * dropdowns. El server component mapea las cuentas crudas a este shape antes
 * de pasarlas como prop — el modelo Prisma completo NUNCA cruza al cliente.
 */
export interface AccountOption {
  code: string;
  name: string;
  isDetail: boolean;
}

interface OrgSettingsFormProps {
  orgSlug: string;
  settings: OrgSettings;
  /** Cuentas posteables (isDetail:true, isActive:true) — para los 6 campos operativos/gasto. */
  detailAccounts: AccountOption[];
  /** Cuentas agrupadoras (isDetail:false) — para los 3 campos parent de tesorería. */
  parentAccounts: AccountOption[];
}

function optionLabel(account: AccountOption): string {
  return `${account.code} - ${account.name}`;
}

export function OrgSettingsForm({
  orgSlug,
  settings,
  detailAccounts,
  parentAccounts,
}: OrgSettingsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [cajaGeneral, setCajaGeneral] = useState(settings.cajaGeneralAccountCode);
  const [banco, setBanco] = useState(settings.bancoAccountCode);
  const [cxc, setCxc] = useState(settings.cxcAccountCode);
  const [cxp, setCxp] = useState(settings.cxpAccountCode);
  const [threshold, setThreshold] = useState(String(settings.roundingThreshold));
  const [cashParentCode, setCashParentCode] = useState(settings.cashParentCode);
  const [pettyCashParentCode, setPettyCashParentCode] = useState(
    settings.pettyCashParentCode,
  );
  const [bankParentCode, setBankParentCode] = useState(settings.bankParentCode);
  const [fleteExpense, setFleteExpense] = useState(
    settings.fleteExpenseAccountCode,
  );
  const [polloCOGS, setPolloCOGS] = useState(
    settings.polloFaenadoCOGSAccountCode,
  );

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
          cashParentCode,
          pettyCashParentCode,
          bankParentCode,
          fleteExpenseAccountCode: fleteExpense,
          polloFaenadoCOGSAccountCode: polloCOGS,
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

  /** Render helper — un <Select> de cuentas con label, ayuda y placeholder. */
  const renderAccountSelect = (
    id: string,
    label: string,
    help: string,
    value: string,
    onChange: (next: string) => void,
    options: AccountOption[],
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-label={label} className="w-full">
          <SelectValue placeholder="Seleccione una cuenta" />
        </SelectTrigger>
        <SelectContent>
          {options.map((account) => (
            <SelectItem key={account.code} value={account.code}>
              {optionLabel(account)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cuentas Contables</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Cuentas del Plan de Cuentas que el sistema utiliza para generar
            asientos automáticos. Solo se listan cuentas de detalle (posteables).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderAccountSelect(
              "caja-general",
              "Caja General",
              "Se usa en cobros y pagos como cuenta puente de tesorería.",
              cajaGeneral,
              setCajaGeneral,
              detailAccounts,
            )}
            {renderAccountSelect(
              "banco",
              "Banco",
              "Se usa en transferencias y depósitos bancarios.",
              banco,
              setBanco,
              detailAccounts,
            )}
            {renderAccountSelect(
              "cxc",
              "Cuentas por Cobrar",
              "Se debita al contabilizar despachos (ND/BC).",
              cxc,
              setCxc,
              detailAccounts,
            )}
            {renderAccountSelect(
              "cxp",
              "Cuentas por Pagar",
              "Se usa en órdenes de compra y pagos a proveedores.",
              cxp,
              setCxp,
              detailAccounts,
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuentas Padre — Tesorería</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Cuentas padre que agrupan las cuentas de tesorería disponibles para
            seleccionar en cobros y pagos. Solo se listan cuentas agrupadoras.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderAccountSelect(
              "cash-parent-code",
              "Cuenta padre — Caja",
              "Agrupa las cuentas de caja disponibles para cobros en efectivo.",
              cashParentCode,
              setCashParentCode,
              parentAccounts,
            )}
            {renderAccountSelect(
              "petty-cash-parent-code",
              "Cuenta padre — Caja Chica",
              "Agrupa las cuentas de caja chica disponibles para cobros en efectivo.",
              pettyCashParentCode,
              setPettyCashParentCode,
              parentAccounts,
            )}
            {renderAccountSelect(
              "bank-parent-code",
              "Cuenta padre — Bancos",
              "Agrupa las cuentas bancarias disponibles para transferencias y depósitos.",
              bankParentCode,
              setBankParentCode,
              parentAccounts,
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuentas de Gasto — Compras</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Cuentas de gasto por defecto que se debitan al contabilizar compras
            de flete y pollo faenado.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderAccountSelect(
              "flete-expense",
              "Gasto de Flete",
              "Se debita al contabilizar compras de tipo Flete.",
              fleteExpense,
              setFleteExpense,
              detailAccounts,
            )}
            {renderAccountSelect(
              "pollo-cogs",
              "Costo de Pollo Faenado",
              "Se debita al contabilizar compras de tipo Pollo Faenado.",
              polloCOGS,
              setPolloCOGS,
              detailAccounts,
            )}
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

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, ChevronsUpDown } from "lucide-react";
import { Popover } from "radix-ui";

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

/** Combobox con búsqueda — patrón Popover+Input, igual que contact-selector.tsx. */
interface AccountComboboxProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: AccountOption[];
}

function AccountCombobox({ id, label, value, onChange, options }: AccountComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((a) => a.code === value) ?? null;

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setTimeout(() => setSearch(""), 0);
    }
  }, [open]);

  const filtered = options.filter((a) => {
    const q = search.toLowerCase();
    return optionLabel(a).toLowerCase().includes(q);
  });

  function handleSelect(account: AccountOption) {
    onChange(account.code);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={selected ? "text-foreground" : "text-muted-foreground"}>
            {selected ? optionLabel(selected) : "Seleccione una cuenta"}
          </span>
          <ChevronsUpDown className="h-4 w-4 ml-2 shrink-0 text-muted-foreground" />
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          data-testid="account-combobox-content"
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-64 rounded-xl border bg-popover p-0 shadow-md outline-none"
          align="start"
          sideOffset={4}
        >
          <div className="p-2 border-b">
            <Input
              ref={searchRef}
              placeholder="Buscar cuenta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Sin resultados.
              </div>
            ) : (
              filtered.map((account) => (
                <button
                  key={account.code}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                  onClick={() => handleSelect(account)}
                >
                  {optionLabel(account)}
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
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

  /** Render helper — un combobox con búsqueda, label y texto de ayuda. */
  const renderAccountCombobox = (
    id: string,
    label: string,
    help: string,
    value: string,
    onChange: (next: string) => void,
    options: AccountOption[],
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <AccountCombobox
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        options={options}
      />
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
            {renderAccountCombobox(
              "caja-general",
              "Caja General",
              "Se usa en cobros y pagos como cuenta puente de tesorería.",
              cajaGeneral,
              setCajaGeneral,
              detailAccounts,
            )}
            {renderAccountCombobox(
              "banco",
              "Banco",
              "Se usa en transferencias y depósitos bancarios.",
              banco,
              setBanco,
              detailAccounts,
            )}
            {renderAccountCombobox(
              "cxc",
              "Cuentas por Cobrar",
              "Se debita al contabilizar despachos (ND/BC).",
              cxc,
              setCxc,
              detailAccounts,
            )}
            {renderAccountCombobox(
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
            {renderAccountCombobox(
              "cash-parent-code",
              "Cuenta padre — Caja",
              "Agrupa las cuentas de caja disponibles para cobros en efectivo.",
              cashParentCode,
              setCashParentCode,
              parentAccounts,
            )}
            {renderAccountCombobox(
              "petty-cash-parent-code",
              "Cuenta padre — Caja Chica",
              "Agrupa las cuentas de caja chica disponibles para cobros en efectivo.",
              pettyCashParentCode,
              setPettyCashParentCode,
              parentAccounts,
            )}
            {renderAccountCombobox(
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
            {renderAccountCombobox(
              "flete-expense",
              "Gasto de Flete",
              "Se debita al contabilizar compras de tipo Flete.",
              fleteExpense,
              setFleteExpense,
              detailAccounts,
            )}
            {renderAccountCombobox(
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

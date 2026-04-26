"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ContactSelector from "@/components/contacts/contact-selector";
import type { SuggestionData, CatalogBundle, CatalogAccount } from "./types";

interface ParsedFormProps {
  orgSlug: string;
  data: SuggestionData;
  catalog: CatalogBundle | null;
  onChange: (next: SuggestionData) => void;
  disabled?: boolean;
}

const TEMPLATE_LABELS: Record<SuggestionData["template"], string> = {
  expense_bank_payment: "Compra pagada por banco",
  expense_cash_payment: "Compra pagada en efectivo",
  bank_deposit: "Depósito de caja a banco",
};

function formatBolivianAmount(amount: number): string {
  return amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Helpers de manipulación del shape ────────────────────────────────────

function rebuildLines(data: SuggestionData): SuggestionData["lines"] {
  // Reconstruimos las lines según template + IDs + amount actuales del form.
  // El backend hace lo mismo en parse-operation; acá replicamos para que el
  // preview se actualice on-the-fly cuando el usuario edita.
  const amount = Number.isFinite(data.amount) ? data.amount : 0;
  switch (data.template) {
    case "expense_bank_payment": {
      const exp = data.lines.find((l) => l.debit > 0)?.accountId;
      const bank = data.lines.find((l) => l.credit > 0)?.accountId;
      return [
        { accountId: exp ?? "", debit: amount, credit: 0 },
        { accountId: bank ?? "", debit: 0, credit: amount },
      ];
    }
    case "expense_cash_payment": {
      const exp = data.lines.find((l) => l.debit > 0)?.accountId;
      const cash = data.lines.find((l) => l.credit > 0)?.accountId;
      return [
        { accountId: exp ?? "", debit: amount, credit: 0 },
        { accountId: cash ?? "", debit: 0, credit: amount },
      ];
    }
    case "bank_deposit": {
      const bank = data.lines.find((l) => l.debit > 0)?.accountId;
      const cash = data.lines.find((l) => l.credit > 0)?.accountId;
      return [
        { accountId: bank ?? "", debit: amount, credit: 0 },
        { accountId: cash ?? "", debit: 0, credit: amount },
      ];
    }
  }
}

function patchLineAccount(
  data: SuggestionData,
  side: "debit" | "credit",
  accountId: string,
): SuggestionData["lines"] {
  return data.lines.map((line) =>
    (side === "debit" ? line.debit > 0 : line.credit > 0)
      ? { ...line, accountId }
      : line,
  );
}

function getAccountId(data: SuggestionData, side: "debit" | "credit"): string {
  return data.lines.find((l) => (side === "debit" ? l.debit > 0 : l.credit > 0))?.accountId ?? "";
}

function getExpenseAccount(data: SuggestionData): { exp: CatalogAccount | undefined; expId: string } | null {
  if (data.template !== "expense_bank_payment" && data.template !== "expense_cash_payment") return null;
  const expId = getAccountId(data, "debit");
  return { expId, exp: data.resolvedAccounts[expId] ? toCatalogAccount(expId, data.resolvedAccounts[expId]) : undefined };
}

function toCatalogAccount(
  id: string,
  info: SuggestionData["resolvedAccounts"][string],
): CatalogAccount {
  return { id, code: info.code, name: info.name, requiresContact: info.requiresContact };
}

// ── Component ────────────────────────────────────────────────────────────

export function ParsedForm({ orgSlug, data, catalog, onChange, disabled }: ParsedFormProps) {
  const debitAccountId = getAccountId(data, "debit");
  const creditAccountId = getAccountId(data, "credit");

  const expenseInfo = getExpenseAccount(data);
  const expenseAccount =
    expenseInfo?.exp ?? catalog?.byId.get(expenseInfo?.expId ?? "") ?? null;
  const requiresContact = !!expenseAccount?.requiresContact;

  // Listas según el template
  const debitOptions = useMemo<CatalogAccount[]>(() => {
    if (!catalog) return [];
    if (data.template === "bank_deposit") return catalog.bank;
    return catalog.expense;
  }, [catalog, data.template]);

  const creditOptions = useMemo<CatalogAccount[]>(() => {
    if (!catalog) return [];
    if (data.template === "expense_bank_payment") return catalog.bank;
    if (data.template === "expense_cash_payment") return catalog.cash;
    if (data.template === "bank_deposit") return catalog.cash;
    return [];
  }, [catalog, data.template]);

  const debitLabel =
    data.template === "bank_deposit" ? "Cuenta destino (banco)" : "Cuenta de gasto";
  const creditLabel =
    data.template === "expense_bank_payment"
      ? "Cuenta bancaria"
      : data.template === "expense_cash_payment"
        ? "Cuenta de caja"
        : "Cuenta origen (caja)";

  function patchAccount(side: "debit" | "credit", accountId: string) {
    const newLines = patchLineAccount(data, side, accountId);
    // Si cambió la cuenta de gasto, refrescamos resolvedAccounts con el catálogo
    const fromCatalog = catalog?.byId.get(accountId);
    const nextResolved = fromCatalog
      ? {
          ...data.resolvedAccounts,
          [accountId]: {
            code: fromCatalog.code,
            name: fromCatalog.name,
            requiresContact: !!fromCatalog.requiresContact,
          },
        }
      : data.resolvedAccounts;
    onChange({ ...data, lines: newLines, resolvedAccounts: nextResolved });
  }

  function patchAmount(amount: number) {
    onChange({ ...data, amount, lines: rebuildLines({ ...data, amount }) });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Plantilla detectada:</span>
        <Badge variant="outline">{TEMPLATE_LABELS[data.template]}</Badge>
        <Badge variant="outline" className="font-mono text-xs">
          {data.voucherTypeCode}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="ai-date">Fecha</Label>
          <Input
            id="ai-date"
            type="date"
            value={data.date.split("T")[0]}
            onChange={(e) => onChange({ ...data, date: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ai-amount">Monto (Bs.)</Label>
          <Input
            id="ai-amount"
            type="number"
            step="0.01"
            min="0.01"
            value={data.amount || ""}
            onChange={(e) => patchAmount(Number(e.target.value))}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="ai-description">Glosa</Label>
        <Input
          id="ai-description"
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          maxLength={500}
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>{debitLabel}</Label>
          <Select
            value={debitAccountId}
            onValueChange={(v) => patchAccount("debit", v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar cuenta..." />
            </SelectTrigger>
            <SelectContent>
              {debitOptions.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="font-mono text-xs mr-2">{a.code}</span>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{creditLabel}</Label>
          <Select
            value={creditAccountId}
            onValueChange={(v) => patchAccount("credit", v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar cuenta..." />
            </SelectTrigger>
            <SelectContent>
              {creditOptions.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="font-mono text-xs mr-2">{a.code}</span>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {requiresContact && (
        <div className="space-y-1">
          <Label>
            Proveedor <span className="text-destructive">*</span>
          </Label>
          <ContactSelector
            orgSlug={orgSlug}
            value={data.contactId ?? null}
            onChange={(v) => onChange({ ...data, contactId: v ?? undefined })}
            required
            disabled={disabled}
          />
          {!data.contactId && (
            <p className="text-xs text-destructive">
              La cuenta {expenseAccount?.code} {expenseAccount?.name} requiere proveedor.
            </p>
          )}
        </div>
      )}

      {/* Preview del asiento */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Vista previa del asiento</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b">
              <th className="text-left py-1">Cuenta</th>
              <th className="text-right py-1 w-32">Débito</th>
              <th className="text-right py-1 w-32">Haber</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line, idx) => {
              const acc =
                catalog?.byId.get(line.accountId) ??
                (data.resolvedAccounts[line.accountId]
                  ? toCatalogAccount(line.accountId, data.resolvedAccounts[line.accountId])
                  : null);
              return (
                <tr key={idx} className="border-b last:border-0">
                  <td className="py-1.5">
                    {acc ? (
                      <>
                        <span className="font-mono text-xs text-muted-foreground mr-1">{acc.code}</span>
                        {acc.name}
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">Sin cuenta</span>
                    )}
                  </td>
                  <td className="text-right font-mono">
                    {line.debit > 0 ? formatBolivianAmount(line.debit) : "—"}
                  </td>
                  <td className="text-right font-mono">
                    {line.credit > 0 ? formatBolivianAmount(line.credit) : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="font-medium">
              <td className="py-1.5 text-right pr-3">Total</td>
              <td className="text-right font-mono">{formatBolivianAmount(data.amount)}</td>
              <td className="text-right font-mono">{formatBolivianAmount(data.amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

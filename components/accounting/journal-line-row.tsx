"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Account } from "@/generated/prisma/client";
import ContactSelector from "@/components/contacts/contact-selector";
import AccountSelector from "@/components/accounting/account-selector";

export interface JournalLineData {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  description: string;
  contactId?: string;
}

interface JournalLineRowProps {
  line: JournalLineData;
  accounts: Account[];
  canRemove: boolean;
  orgSlug: string;
  onUpdate: (id: string, field: keyof JournalLineData, value: string) => void;
  onRemove: (id: string) => void;
}

export default function JournalLineRow({
  line,
  accounts,
  canRemove,
  orgSlug,
  onUpdate,
  onRemove,
}: JournalLineRowProps) {
  const selectedAccount = accounts.find((a) => a.id === line.accountId) ?? null;
  const requiresContact = selectedAccount?.requiresContact ?? false;

  function handleDebitChange(value: string) {
    onUpdate(line.id, "debit", value);
    // If debit has a value, clear credit
    if (value && parseFloat(value) > 0) {
      onUpdate(line.id, "credit", "");
    }
  }

  function handleCreditChange(value: string) {
    onUpdate(line.id, "credit", value);
    // If credit has a value, clear debit
    if (value && parseFloat(value) > 0) {
      onUpdate(line.id, "debit", "");
    }
  }

  return (
    <tr className="border-b">
      <td className="py-2 px-2">
        <AccountSelector
          accounts={accounts.filter((a) => a.isActive && a.isDetail)}
          value={line.accountId}
          valueKey="id"
          onChange={(val) => onUpdate(line.id, "accountId", val)}
        />
      </td>
      <td className="py-2 px-2">
        <Input
          placeholder="Detalle (opcional)"
          value={line.description}
          onChange={(e) => onUpdate(line.id, "description", e.target.value)}
        />
      </td>
      <td className="py-2 px-2 min-w-[180px]">
        {requiresContact ? (
          <ContactSelector
            orgSlug={orgSlug}
            value={line.contactId ?? null}
            onChange={(val) => onUpdate(line.id, "contactId", val ?? "")}
          />
        ) : null}
      </td>
      <td className="py-2 px-2">
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          className="text-right font-mono"
          value={line.debit}
          disabled={!!line.credit && parseFloat(line.credit) > 0}
          onChange={(e) => handleDebitChange(e.target.value)}
        />
      </td>
      <td className="py-2 px-2">
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          className="text-right font-mono"
          value={line.credit}
          disabled={!!line.debit && parseFloat(line.debit) > 0}
          onChange={(e) => handleCreditChange(e.target.value)}
        />
      </td>
      <td className="py-2 px-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canRemove}
          onClick={() => onRemove(line.id)}
          className="text-destructive hover:text-destructive/80 disabled:opacity-30"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

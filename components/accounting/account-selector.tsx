"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronsUpDown, X } from "lucide-react";
import { Popover } from "radix-ui";
import type { Account } from "@/generated/prisma/client";

interface AccountSelectorProps {
  accounts: Account[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function AccountSelector({
  accounts,
  value,
  onChange,
  disabled,
}: AccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const detailAccounts = useMemo(
    () => accounts.filter((a) => a.isActive && a.isDetail),
    [accounts],
  );

  const selectedAccount = accounts.find((a) => a.id === value) ?? null;

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return detailAccounts;
    const q = search.toLowerCase();
    return detailAccounts.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q),
    );
  }, [detailAccounts, search]);

  function handleSelect(account: Account) {
    onChange(account.id);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  return (
    <Popover.Root open={open} onOpenChange={disabled ? undefined : setOpen}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span
            className={`truncate ${selectedAccount ? "text-foreground" : "text-muted-foreground"}`}
          >
            {selectedAccount
              ? `${selectedAccount.code} - ${selectedAccount.name}`
              : "Seleccione cuenta..."}
          </span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {value && !disabled && (
              <X
                className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-72 rounded-xl border bg-popover p-0 shadow-md outline-none"
          align="start"
          sideOffset={4}
        >
          <div className="p-2 border-b">
            <Input
              ref={searchRef}
              placeholder="Buscar por codigo o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {search ? "Sin resultados." : "No hay cuentas disponibles."}
              </div>
            ) : (
              filtered.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer flex items-center gap-2"
                  onClick={() => handleSelect(account)}
                >
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {account.code}
                  </span>
                  <span className="truncate">{account.name}</span>
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronsUpDown, X } from "lucide-react";
import { Popover } from "radix-ui";

/**
 * Shape mínima que el combobox necesita de una cuenta. Es un subconjunto
 * estructural del modelo Prisma `Account` — cualquier objeto con `code` y `name`
 * (e `id` opcional) sirve. La selección se matchea y se emite por `valueKey`.
 */
export interface AccountSelectorAccount {
  id?: string;
  code: string;
  name: string;
}

interface AccountSelectorProps {
  /** Lista YA filtrada por el consumidor — el componente NO filtra por activa/detalle. */
  accounts: AccountSelectorAccount[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Campo usado para matchear el valor seleccionado y para lo que emite `onChange`. */
  valueKey?: "id" | "code";
  /** Forwarded al `<Button>` trigger — útil para asociar un `<Label htmlFor>`. */
  id?: string;
  /** `aria-label` del trigger — útil cuando el label visible vive fuera del componente. */
  ariaLabel?: string;
}

export default function AccountSelector({
  accounts,
  value,
  onChange,
  disabled,
  valueKey = "id",
  id,
  ariaLabel,
}: AccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedAccount =
    accounts.find((a) => a[valueKey] === value) ?? null;

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      // Defer reset so setState is not synchronous in the effect body
      setTimeout(() => setSearch(""), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q),
    );
  }, [accounts, search]);

  function handleSelect(account: AccountSelectorAccount) {
    onChange(account[valueKey] ?? "");
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
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
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
          data-testid="account-selector-content"
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
                  key={account[valueKey] ?? account.code}
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

"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronsUpDown, X } from "lucide-react";
import { Popover } from "radix-ui";
import type { Contact } from "@/features/contacts";

function formatContact(contact: Contact): string {
  return `[${contact.type}] ${contact.name}`;
}

interface ContactSelectorProps {
  orgSlug: string;
  value: string | null;
  onChange: (value: string | null) => void;
  required?: boolean;
  disabled?: boolean;
}

export default function ContactSelector({
  orgSlug,
  value,
  onChange,
  required,
  disabled,
}: ContactSelectorProps) {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedContact = contacts.find((c) => c.id === value) ?? null;

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/organizations/${orgSlug}/contacts?isActive=true`);
        const data: { contacts: Contact[] } = await res.json();
        setContacts(data.contacts ?? []);
      } catch {
        setContacts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, orgSlug]);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      // Defer reset so setState is not synchronous in the effect body
      setTimeout(() => setSearch(""), 0);
    }
  }, [open]);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.nit ?? "").toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q)
    );
  });

  function handleSelect(contact: Contact) {
    onChange(contact.id);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  return (
    <Popover.Root open={open} onOpenChange={disabled ? undefined : setOpen}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-required={required}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={selectedContact ? "text-foreground" : "text-muted-foreground"}>
            {selectedContact ? formatContact(selectedContact) : "Seleccionar contacto..."}
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
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-64 rounded-xl border bg-popover p-0 shadow-md outline-none"
          align="start"
          sideOffset={4}
        >
          <div className="p-2 border-b">
            <Input
              ref={searchRef}
              placeholder="Buscar contacto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Cargando...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {search ? "Sin resultados." : "No hay contactos activos."}
              </div>
            ) : (
              filtered.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer flex items-center gap-2"
                  onClick={() => handleSelect(contact)}
                >
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    [{contact.type}]
                  </span>
                  <span className="truncate">{contact.name}</span>
                  {contact.nit && (
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                      {contact.nit}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

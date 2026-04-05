"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { ContactFilters } from "@/features/contacts";

const CONTACT_TYPE_LABELS: Record<string, string> = {
  CLIENTE: "Cliente",
  PROVEEDOR: "Proveedor",
  SOCIO: "Socio",
  TRANSPORTISTA: "Transportista",
  OTRO: "Otro",
};

interface ContactFiltersProps {
  filters: ContactFilters;
  onChange: (filters: ContactFilters) => void;
}

export default function ContactFiltersBar({ filters, onChange }: ContactFiltersProps) {
  function handleTypeChange(value: string) {
    onChange({
      ...filters,
      type: value === "ALL" ? undefined : (value as ContactFilters["type"]),
    });
  }

  function handleStatusChange(value: string) {
    onChange({
      ...filters,
      isActive: value === "ALL" ? undefined : value === "true",
    });
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange({ ...filters, search: e.target.value || undefined });
  }

  function handleClear() {
    onChange({});
  }

  const hasFilters = filters.type !== undefined || filters.isActive !== undefined || !!filters.search;

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Input
        placeholder="Buscar por nombre o NIT..."
        value={filters.search ?? ""}
        onChange={handleSearchChange}
        className="sm:w-64"
      />

      <Select
        value={filters.type ?? "ALL"}
        onValueChange={handleTypeChange}
      >
        <SelectTrigger className="sm:w-44">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos los tipos</SelectItem>
          {Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.isActive === undefined ? "ALL" : String(filters.isActive)}
        onValueChange={handleStatusChange}
      >
        <SelectTrigger className="sm:w-36">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos</SelectItem>
          <SelectItem value="true">Activos</SelectItem>
          <SelectItem value="false">Inactivos</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="outline" size="sm" onClick={handleClear} className="self-start sm:self-auto">
          Limpiar
        </Button>
      )}
    </div>
  );
}

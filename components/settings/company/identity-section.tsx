"use client";

import type { UpdateOrgProfileInput } from "@/features/org-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

/**
 * IdentitySection — text fields for the OrgProfile identity block.
 *
 * REQ-OP.2, REQ-OP.10. Shows inline per-field errors coming from the route's
 * zod `fieldErrors` payload.
 */
export interface IdentityValues {
  razonSocial: string;
  nit: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  nroPatronal: string;
}

export interface IdentitySectionProps {
  values: IdentityValues;
  onChange: (next: IdentityValues) => void;
  onSave: (patch: UpdateOrgProfileInput) => void | Promise<void>;
  saving?: boolean;
  fieldErrors?: Partial<Record<keyof IdentityValues, string[]>>;
}

const FIELDS: {
  key: keyof IdentityValues;
  label: string;
  placeholder?: string;
}[] = [
  { key: "razonSocial", label: "Razón Social" },
  { key: "nit", label: "NIT" },
  { key: "direccion", label: "Dirección" },
  { key: "ciudad", label: "Ciudad" },
  { key: "telefono", label: "Teléfono" },
  { key: "nroPatronal", label: "Nº Patronal (opcional)" },
];

export function IdentitySection({
  values,
  onChange,
  onSave,
  saving = false,
  fieldErrors,
}: IdentitySectionProps) {
  const handleSave = () => {
    const patch: UpdateOrgProfileInput = {
      razonSocial: values.razonSocial,
      nit: values.nit,
      direccion: values.direccion,
      ciudad: values.ciudad,
      telefono: values.telefono,
      nroPatronal: values.nroPatronal || null,
    };
    void onSave(patch);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map(({ key, label, placeholder }) => {
          const errors = fieldErrors?.[key];
          return (
            <div key={key} className="space-y-2">
              <Label htmlFor={`identity-${key}`}>{label}</Label>
              <Input
                id={`identity-${key}`}
                data-testid={`identity-${key}`}
                value={values[key]}
                placeholder={placeholder}
                onChange={(e) =>
                  onChange({ ...values, [key]: e.target.value })
                }
                aria-invalid={errors ? true : undefined}
              />
              {errors && errors.length > 0 && (
                <p
                  data-testid={`identity-${key}-error`}
                  className="text-xs text-destructive"
                >
                  {errors[0]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          data-testid="identity-save"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Guardando…" : "Guardar Identidad"}
        </Button>
      </div>
    </div>
  );
}

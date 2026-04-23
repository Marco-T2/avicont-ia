"use client";

import type { SignatureLabel } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SIGNATURE_LABEL_LABELS } from "@/lib/document-print-type-labels";
import { ArrowDown, ArrowUp, X } from "lucide-react";

/**
 * LabelPicker — ordered list of signature labels with add/remove/reorder.
 *
 * REQ-OP.10. Fully controlled: parent holds `labels` and `showReceiverRow`,
 * this component fires `onChange` on every mutation. No internal state for
 * the picker values themselves.
 */
interface LabelPickerProps {
  labels: SignatureLabel[];
  showReceiverRow: boolean;
  onChange: (next: {
    labels: SignatureLabel[];
    showReceiverRow: boolean;
  }) => void;
}

const ALL_LABELS: SignatureLabel[] = [
  "ELABORADO",
  "APROBADO",
  "VISTO_BUENO",
  "PROPIETARIO",
  "REVISADO",
  "REGISTRADO",
  "CONTABILIZADO",
];

export function LabelPicker({
  labels,
  showReceiverRow,
  onChange,
}: LabelPickerProps) {
  const available = ALL_LABELS.filter((l) => !labels.includes(l));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= labels.length) return;
    const next = [...labels];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ labels: next, showReceiverRow });
  };

  const remove = (index: number) => {
    const next = labels.filter((_, i) => i !== index);
    onChange({ labels: next, showReceiverRow });
  };

  const add = (value: SignatureLabel) => {
    onChange({ labels: [...labels, value], showReceiverRow });
  };

  const toggleReceiver = (checked: boolean) => {
    onChange({ labels, showReceiverRow: checked });
  };

  return (
    <div className="space-y-3">
      {labels.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Sin firmantes configurados.
        </p>
      ) : (
        <ul className="space-y-2">
          {labels.map((label, index) => (
            <li
              key={label}
              data-testid="label-picker-item"
              className="flex items-center gap-2 rounded-md border px-3 py-2"
            >
              <span className="flex-1 text-sm">
                {SIGNATURE_LABEL_LABELS[label]}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Subir"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Bajar"
                disabled={index === labels.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Eliminar"
                onClick={() => remove(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Agregar:</Label>
          <select
            data-testid="label-picker-add"
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value=""
            onChange={(e) => {
              const value = e.target.value as SignatureLabel;
              if (value) add(value);
              // reset so the same option can be re-added after remove
              e.target.value = "";
            }}
          >
            <option value="">Seleccionar…</option>
            {available.map((label) => (
              <option key={label} value={label}>
                {SIGNATURE_LABEL_LABELS[label]}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          data-testid="label-picker-receiver"
          type="checkbox"
          checked={showReceiverRow}
          onChange={(e) => toggleReceiver(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        <span>Incluir fila de firma del receptor</span>
      </label>
    </div>
  );
}

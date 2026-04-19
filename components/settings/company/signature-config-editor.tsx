"use client";

import type {
  DocumentPrintType,
  SignatureLabel,
} from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { DOCUMENT_PRINT_TYPE_LABELS } from "@/lib/document-print-type-labels";
import { LabelPicker } from "./label-picker";

/**
 * SignatureConfigEditor — the editor for a single DocumentPrintType.
 * Composes LabelPicker + a per-section Guardar button.
 *
 * REQ-OP.10.
 */
export interface SignatureConfigView {
  documentType: DocumentPrintType;
  labels: SignatureLabel[];
  showReceiverRow: boolean;
}

export interface SignatureConfigEditorProps {
  docType: DocumentPrintType;
  view: SignatureConfigView;
  onChange: (next: SignatureConfigView) => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
}

export function SignatureConfigEditor({
  docType,
  view,
  onChange,
  onSave,
  saving = false,
}: SignatureConfigEditorProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configuración de firmas para <strong>{DOCUMENT_PRINT_TYPE_LABELS[docType]}</strong>.
        El orden es el que se imprimirá en el PDF.
      </p>

      <LabelPicker
        labels={view.labels}
        showReceiverRow={view.showReceiverRow}
        onChange={(next) =>
          onChange({ documentType: docType, ...next })
        }
      />

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          data-testid="signature-config-save"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

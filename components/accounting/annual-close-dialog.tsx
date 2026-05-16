"use client";

/**
 * AnnualCloseDialog — confirm + justification + POST /annual-close.
 *
 * Triggered by the 'Cerrar la gestion {year}' button in
 * `annual-period-list.tsx`. Mirrors `monthly-close-panel.tsx` confirm flow
 * EXACT (Dialog + justification textarea + sonner toast + router.refresh).
 *
 * Phase 7.4 GREEN lands the real dialog + POST. This Phase 7.1 stub is a
 * placeholder for the `vi.mock(../annual-close-dialog)` in
 * `__tests__/annual-period-list.test.tsx`.
 *
 * Voseo Rioplatense:
 *   - Title: 'Confirmar Cierre de Gestion'
 *   - Body: 'Estas a punto de cerrar la gestion {year}'
 *   - Justification label: 'Justificacion (min 50 caracteres)'
 *   - Confirm button: 'Confirmar Cierre'
 *   - Success toast: 'Gestion cerrada exitosamente'
 *
 * Phase 7.4 will replace this stub with the real impl.
 */

import type { AnnualCloseSummary } from "@/modules/annual-close/presentation/index";

export interface AnnualCloseDialogProps {
  orgSlug: string;
  year: number;
  summary: AnnualCloseSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AnnualCloseDialog(_props: AnnualCloseDialogProps) {
  // Phase 7.1 stub. Phase 7.4 GREEN ships the real Dialog + POST flow.
  return null;
}
